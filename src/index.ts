import { Intersection, Object3D, Quaternion, Vector3 } from "three";

export type ObjectEventTypes =
  | "press"
  | "release"
  | "cancel"
  | "select"
  | "move"
  | "enter"
  | "leave"
  | "wheel"
  | "losteventcapture";

export type XIntersection = Intersection & {
  inputDevicePosition: Vector3;
  inputDeviceRotation: Quaternion;
  capturedObject?: Object3D;
};

export function isXIntersection(val: Intersection): val is XIntersection {
  return "inputDevicePosition" in val;
}

export type EventDispatcher<E, I extends XIntersection> = {
  [Key in ObjectEventTypes]: (
    object: Object3D,
    intersection: I,
    inputDeviceElementId?: number
  ) => void;
} & {
  bind(event: E, eventTranslater: EventTranslator<E, I>): void;
  hasEventHandlers(object: Object3D): boolean;
};

type InteractionState<I extends XIntersection> = {
  lastLeftTime?: number;
  lastPressedElementIds: Set<number>;
  elementStateMap: Map<
    number,
    {
      lastPressEventTime: number;
      lastPressEventInteraction: I;
      lastDragTime?: number;
    }
  >;
};

type ObjectInteractionState<I extends XIntersection> = {
  lastIntersectedTime?: number;
  blockFollowingIntersections: boolean;
} & InteractionState<I>;

const traversalIdSymbol = Symbol("traversal-id");

const emptySet = new Set<number>();

export const voidObject = new Object3D()

export class EventTranslator<
  E = Event,
  I extends XIntersection = XIntersection
> {
  //state
  public intersections: Array<I> = [];
  private lastPositionChangeTime: number | undefined;
  private capturedEvents: Map<Object3D, I> | undefined;
  private objectInteractionStateMap = new Map<
    Object3D,
    ObjectInteractionState<I>
  >();

  private voidInteractionState: Omit<
    ObjectInteractionState<I>,
    "lastIntersectedTime" | "blockFollowingIntersections"
  > = {
    lastPressedElementIds: emptySet,
    elementStateMap: new Map(),
  };

  constructor(
    public readonly inputDeviceId: number,
    private readonly dispatchPressAlways: boolean,
    protected eventDispatcher: EventDispatcher<E, I>,
    protected computeIntersections: (
      event: E,
      capturedEvents?: Map<Object3D, I>
    ) => Array<I>,
    protected getPressedElementIds: (intersection?: I) => Iterable<number>,
    protected isDrag: (downIntersection: I, currentIntersection: I) => boolean,
    protected onPressMissed?: (event: E) => void,
    protected onReleaseMissed?: (event: E) => void,
    protected onSelectMissed?: (event: E) => void
  ) {}

  /**
   * called when the input device receives a press, release, or move event
   * @param positionChanged flag to indicate that the input device was moved and therefore requires the **sceneIntersections** to recompute. When the **sceneIntersections** are recomputed, we check whether objects where hovered or released and dispatch events accordingly.
   * @param pressChanged flag to indicate that any input device element was either pressed or released. Therefore, we check whether the objects in **sceneIntersections** are released or pressed and dispatch events accordingly.
   * @param dispatchPressFor list of ids of elements that were pressed after the last update
   */
  update(
    event: E,
    positionChanged: boolean,
    pressChanged: boolean,
    ...dispatchPressFor: Array<number>
  ): void {
    //binds the event and the translator (this) to the dispatcher, which are used to create and deliver the events finally
    this.eventDispatcher.bind(event, this);

    const currentTime = performance.now();
    const prevIntersections = this.intersections;

    if (positionChanged) {
      this.intersections = this.computeIntersections(
        event,
        this.capturedEvents
      );
      if (this.intersections.length > 0) {
        //leave void
        this.voidInteractionState.lastLeftTime = currentTime;
        this.voidInteractionState.lastPressedElementIds = emptySet;
      }
    }

    //onPressMissed, onReleaseMissed, onSelectMissed
    const pressedElementIds = new Set(this.getPressedElementIds());
    if (pressChanged) {
      //dispatch onPressMissed if intersected with nothing
      if (this.intersections.length === 0) {
        this.dispatchPress(pressedElementIds, dispatchPressFor, () =>
          this.onPressMissed?.(event)
        );

        this.dispatchRelease(
          this.voidInteractionState,
          pressedElementIds,
          () => this.onReleaseMissed?.(event),
          () => this.onSelectMissed?.(event)
        );

        this.updateLastPressElementEventTimeMap(
          {
            distance: 0,
            point: new Vector3(),
            inputDevicePosition: ,
            inputDeviceRotation: ,
            object: undefined,
          },
          this.voidInteractionState,
          pressedElementIds,
          dispatchPressFor,
          currentTime
        );
      }
    }
    this.voidInteractionState.lastPressedElementIds = pressedElementIds;

    //enter, move, press, release, click, losteventcapture events
    this.traverseIntersections<Set<number>>(
      this.intersections,
      (
        eventObject,
        interactionState,
        intersection,
        intersectionIndex,
        pressedElementIds
      ) => {
        if (positionChanged) {
          this.dispatchEnterAndMove(
            eventObject,
            interactionState,
            intersection
          );
          //update last intersection time
          interactionState.lastIntersectedTime = currentTime;
        }

        if (pressChanged) {
          this.dispatchPress(
            pressedElementIds,
            dispatchPressFor,
            this.eventDispatcher.press.bind(
              this.eventDispatcher,
              eventObject,
              intersection
            )
          );
          this.dispatchReleaseObject(
            eventObject,
            intersection,
            interactionState,
            pressedElementIds
          );
          this.updateLastPressElementEventTimeMap(
            intersection,
            interactionState,
            pressedElementIds,
            dispatchPressFor,
            currentTime
          );
        }
        interactionState.lastPressedElementIds = pressedElementIds;

        if (interactionState.blockFollowingIntersections) {
          //we remove the intersections that happen after
          this.intersections.length = intersectionIndex + 1;
        }

        return true;
      },
      (intersection) => new Set(this.getPressedElementIds(intersection))
    );

    if (positionChanged) {
      const pressedElementIds = new Set(this.getPressedElementIds());
      //leave events
      this.traverseIntersections(
        prevIntersections,
        (eventObject, interactionState, intersection) => {
          if (interactionState.lastIntersectedTime === currentTime) {
            //object was intersected this time –> therefore also all the ancestors –> can stop bubbeling up here
            return false;
          }
          this.dispatchReleaseObject(
            eventObject,
            intersection,
            interactionState,
            pressedElementIds
          );
          this.eventDispatcher.leave(eventObject, intersection);
          interactionState.lastLeftTime = currentTime;
          interactionState.lastPressedElementIds = emptySet;
          return true;
        }
      );

      this.lastPositionChangeTime = currentTime;
    }
  }

  cancel(event: E): void {
    this.eventDispatcher.bind(event, this);
    this.traverseIntersections(
      this.intersections,
      (eventObject, interactionState, intersection) => {
        this.eventDispatcher.cancel(eventObject, intersection);
        return true;
      }
    );
  }

  wheel(event: E): void {
    this.eventDispatcher.bind(event, this);
    this.traverseIntersections(
      this.intersections,
      (eventObject, interactionState, intersection) => {
        this.eventDispatcher.wheel(eventObject, intersection);
        return true;
      }
    );
  }

  leave(event: E): void {
    this.eventDispatcher.bind(event, this);
    this.traverseIntersections(
      this.intersections,
      (eventObject, interactionState, intersection) => {
        this.eventDispatcher.leave(eventObject, intersection);
        return true;
      }
    );

    //reset state
    this.lastPositionChangeTime = undefined;
    this.intersections.length = 0;
    this.capturedEvents = undefined;
  }

  private updateLastPressElementEventTimeMap(
    interaction: I,
    interactionState: InteractionState<I>,
    pressedElementIds: Set<number>,
    dispatchPressFor: Array<number>,
    currentTime: number
  ) {
    for (const pressedElementId of pressedElementIds) {
      if (
        dispatchPressFor.includes(pressedElementId) ||
        this.dispatchPressAlways
      ) {
        interactionState.elementStateMap.set(pressedElementId, {
          lastPressEventTime: currentTime,
          lastPressEventInteraction: interaction,
        });
      }
    }
  }

  private dispatchPress(
    pressedElementIds: Set<number>,
    dispatchPressFor: Array<number>,
    press: (id: number) => void
  ) {
    for (const pressedElementId of pressedElementIds) {
      //pressedElementId was not pressed last time
      if (
        this.dispatchPressAlways ||
        dispatchPressFor.includes(pressedElementId)
      ) {
        press(pressedElementId);
      }
    }
  }

  private dispatchReleaseObject(
    eventObject: Object3D,
    intersection: I,
    interactionState: ObjectInteractionState<I>,
    pressedElementIds: Set<number>
  ) {
    this.dispatchRelease(
      interactionState,
      pressedElementIds,
      (id) => {
        this.eventDispatcher.release(eventObject, intersection, id);
        this.removeEventCapture(eventObject);
      },
      this.eventDispatcher.select.bind(
        this.eventDispatcher,
        eventObject,
        intersection
      )
    );
  }

  private dispatchRelease(
    interactionState: InteractionState<I>,
    pressedElementIds: Set<number>,
    release: (elementId: number) => void,
    select: (elementId: number) => void
  ) {
    for (const releasedElementId of interactionState.lastPressedElementIds) {
      if (pressedElementIds.has(releasedElementId)) {
        continue;
      }
      //pressedElementId was not pressed this time
      release(releasedElementId);

      const elementState =
        interactionState.elementStateMap.get(releasedElementId);
      if (
        elementState != null &&
        (interactionState.lastLeftTime == null ||
          interactionState.lastLeftTime < elementState.lastPressEventTime) &&
        (elementState.lastDragTime == null ||
          elementState.lastDragTime < elementState.lastPressEventTime)
      ) {
        //=> the object wasn't left and dragged since it was pressed last
        select(releasedElementId);
      }
    }
  }

  /**
   * @returns if the object was entered
   */
  private dispatchEnterAndMove(
    eventObject: Object3D,
    interactionState: ObjectInteractionState<I>,
    intersection: I
  ): void {
    if (
      interactionState.lastIntersectedTime != null &&
      interactionState.lastIntersectedTime === this.lastPositionChangeTime
    ) {
      //object was intersected last time
      this.eventDispatcher.move(eventObject, intersection);
    } else {
      //reset to not block the following intersections
      interactionState.blockFollowingIntersections = false;
      //object was not intersected last time
      this.eventDispatcher.enter(eventObject, intersection);
    }
  }

  public addEventCapture(eventObject: Object3D, intersection: I): void {
    if (this.capturedEvents == null) {
      this.capturedEvents = new Map();
    }
    this.capturedEvents.set(eventObject, intersection);
  }

  public removeEventCapture(eventObject: Object3D): void {
    if (this.capturedEvents == null) {
      return;
    }
    this.eventDispatcher.losteventcapture(eventObject, undefined as any);
    if (!this.capturedEvents.delete(eventObject)) {
      return;
    }
    if (this.capturedEvents.size === 0) {
      this.capturedEvents = undefined;
    }
  }

  public hasEventCapture(eventObject: Object3D): boolean {
    return this.capturedEvents?.has(eventObject) ?? false;
  }

  /**
   * @param callback returns false if the event should stop bubbeling upwards
   */
  private traverseIntersections<T>(
    intersections: Array<I>,
    callback: (
      eventObject: Object3D,
      interactionState: ObjectInteractionState<I>,
      intersection: I,
      interactionIndex: number,
      info: T
    ) => boolean,
    intersectionInfo: (intersection: I) => T = () => undefined as any
  ): void {
    const traversalId = Math.random();
    outer: for (
      let intersectionIndex = 0;
      intersectionIndex < intersections.length;
      intersectionIndex++
    ) {
      const intersection = intersections[intersectionIndex];
      let eventObject: Object3D | null =
        intersection.capturedObject ?? intersection.object;
      const info = intersectionInfo(intersection);
      while (eventObject != null) {
        if (!checkUniqueTraversal(eventObject, traversalId)) {
          continue outer;
        }
        if (this.eventDispatcher.hasEventHandlers(eventObject)) {
          const interactionState = this.getInteractionState(eventObject);
          const continueUpwards = callback(
            eventObject,
            interactionState,
            intersection,
            intersectionIndex,
            info
          );
          if (!continueUpwards) {
            continue outer;
          }
        }
        eventObject = eventObject.parent;
      }
    }
  }

  public blockFollowingIntersections(eventObject: Object3D): void {
    const interactionState = this.getInteractionState(eventObject);
    interactionState.blockFollowingIntersections = true;
  }

  private getInteractionState(
    eventObject: Object3D
  ): ObjectInteractionState<I> {
    let interactionState = this.objectInteractionStateMap.get(eventObject);
    if (interactionState == null) {
      this.objectInteractionStateMap.set(
        eventObject,
        (interactionState = {
          elementStateMap: new Map(),
          lastPressedElementIds: emptySet,
          blockFollowingIntersections: false,
        })
      );
    }
    return interactionState;
  }
}

function checkUniqueTraversal(value: any, traversalId: number): boolean {
  const tId = value[traversalIdSymbol];
  if (tId === traversalId) {
    return false;
  }
  value[traversalIdSymbol] = traversalId;
  return true;
}
