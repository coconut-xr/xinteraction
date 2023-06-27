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

const inputSourcePositionHelper = new Vector3();
const inputSourceRotationHelper = new Quaternion();

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

type ObjectInteractionState<I extends XIntersection> = {
  lastIntersectedTime?: number;
  blockFollowingIntersections: boolean;
  lastLeftTime?: number;
  lastPressedElementIds: Set<number>;
  elementStateMap: Map<
    number,
    {
      lastPressEventTime: number;
      lastPressEventIntersection: I;
    }
  >;
};

const traversalIdSymbol = Symbol("traversal-id");

const emptySet = new Set<number>();

export const voidObject = new Object3D();

/**
 * translates the events from one input device to a 3D Scene
 */
export class EventTranslator<
  ReceivedEvent = Event,
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

  constructor(
    public readonly inputDeviceId: number,
    private readonly dispatchPressAlways: boolean,
    protected eventDispatcher: EventDispatcher<any, I>, //SendEvent
    protected computeIntersections: (
      event: ReceivedEvent,
      capturedEvents?: Map<Object3D, I>
    ) => Array<I>,
    protected getPressedElementIds: (intersection?: I) => Iterable<number>,
    protected getInputDeviceTransformation: (
      position: Vector3,
      rotation: Quaternion
    ) => void,
    protected wasDragged?: (inputDeviceElementId: number) => boolean,
    public onIntersections?: (intersections: ReadonlyArray<I>) => void,
    public filterIntersections?: (intersections: Array<I>) => Array<I>,
    public onStartEventCaptures?: (event: ReceivedEvent) => void,
    public onEndEventCaptures?: (event: ReceivedEvent) => void
  ) {}

  /**
   * called when the input device receives a press, release, or move event
   * @param positionChanged flag to indicate that the input device was moved and therefore requires the **sceneIntersections** to recompute. When the **sceneIntersections** are recomputed, we check whether objects where hovered or released and dispatch events accordingly.
   * @param pressChanged flag to indicate that any input device element was either pressed or released. Therefore, we check whether the objects in **sceneIntersections** are released or pressed and dispatch events accordingly.
   * @param dispatchPressFor list of ids of elements that were pressed after the last update
   */
  update(
    event: ReceivedEvent,
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

      //filter insections when not events captured
      if (this.capturedEvents == null && this.filterIntersections != null) {
        this.intersections = this.filterIntersections(this.intersections);
      }
      this.onIntersections?.(this.intersections);

      if (this.intersections.length === 0) {
        this.getInputDeviceTransformation(
          inputSourcePositionHelper,
          inputSourceRotationHelper
        );
        this.intersections = [
          {
            distance: Infinity,
            inputDevicePosition: inputSourcePositionHelper.clone(),
            inputDeviceRotation: inputSourceRotationHelper.clone(),
            object: voidObject,
            point: inputSourcePositionHelper.clone(),
          } as I,
        ];
      }
    }

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
          this.dispatchEnterOrMove(eventObject, interactionState, intersection);
          //update last intersection time
          interactionState.lastIntersectedTime = currentTime;
        }

        if (pressChanged) {
          this.dispatchPress(
            eventObject,
            intersection,
            pressedElementIds,
            dispatchPressFor
          );
          this.dispatchRelease(
            event,
            eventObject,
            intersection,
            interactionState,
            pressedElementIds
          );
          this.updateElementStateMap(
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
          this.dispatchRelease(
            event,
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

  cancel(event: ReceivedEvent): void {
    this.eventDispatcher.bind(event, this);
    this.traverseIntersections(
      this.intersections,
      (eventObject, interactionState, intersection) => {
        this.eventDispatcher.cancel(eventObject, intersection);
        return true;
      }
    );
  }

  wheel(event: ReceivedEvent): void {
    this.eventDispatcher.bind(event, this);
    this.traverseIntersections(
      this.intersections,
      (eventObject, interactionState, intersection) => {
        this.eventDispatcher.wheel(eventObject, intersection);
        return true;
      }
    );
  }

  leave(event: ReceivedEvent): void {
    this.eventDispatcher.bind(event, this);
    this.traverseIntersections(
      this.intersections,
      (eventObject, interactionState, intersection) => {
        this.eventDispatcher.leave(eventObject, intersection);
        return true;
      }
    );

    if (this.capturedEvents != null) {
      this.onEndEventCaptures?.(event);
    }

    //reset state
    this.lastPositionChangeTime = undefined;
    this.intersections.length = 0;
    this.capturedEvents = undefined;
  }

  private updateElementStateMap(
    intersection: I,
    interactionState: ObjectInteractionState<I>,
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
          lastPressEventIntersection: intersection,
        });
      }
    }
  }

  private dispatchPress(
    eventObject: Object3D,
    intersection: I,
    pressedElementIds: Set<number>,
    dispatchPressFor: Array<number>
  ) {
    for (const pressedElementId of pressedElementIds) {
      if (
        this.dispatchPressAlways ||
        dispatchPressFor.includes(pressedElementId)
      ) {
        this.eventDispatcher.press(eventObject, intersection, pressedElementId);
      }
    }
  }

  private dispatchRelease(
    fromEvent: ReceivedEvent,
    eventObject: Object3D,
    intersection: I,
    interactionState: ObjectInteractionState<I>,
    pressedElementIds: Set<number>
  ) {
    for (const releasedElementId of interactionState.lastPressedElementIds) {
      if (pressedElementIds.has(releasedElementId)) {
        continue;
      }
      //pressedElementId was not pressed this time
      this.eventDispatcher.release(
        eventObject,
        intersection,
        releasedElementId
      );
      this.removeEventCapture(fromEvent, eventObject);

      const elementState =
        interactionState.elementStateMap.get(releasedElementId);
      if (
        elementState != null &&
        (interactionState.lastLeftTime == null ||
          interactionState.lastLeftTime < elementState.lastPressEventTime) &&
        (this.wasDragged == null || !this.wasDragged(releasedElementId))
      ) {
        //=> the object wasn't left and dragged since it was pressed last
        this.eventDispatcher.select(
          eventObject,
          intersection,
          releasedElementId
        );
      }
    }
  }

  /**
   * @returns if the object was entered
   */
  private dispatchEnterOrMove(
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

  public addEventCapture(
    fromEvent: ReceivedEvent,
    eventObject: Object3D,
    intersection: I
  ): void {
    if (this.capturedEvents == null) {
      this.capturedEvents = new Map();
      this.onStartEventCaptures?.(fromEvent);
    }
    this.capturedEvents.set(eventObject, intersection);
  }

  public removeEventCapture(
    fromEvent: ReceivedEvent,
    eventObject: Object3D
  ): void {
    if (this.capturedEvents == null) {
      return;
    }
    this.eventDispatcher.losteventcapture(eventObject, undefined as any);
    if (!this.capturedEvents.delete(eventObject)) {
      return;
    }
    if (this.capturedEvents.size === 0) {
      this.capturedEvents = undefined;
      this.onEndEventCaptures?.(fromEvent);
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
      intersectionIndex: number,
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

export * from "./intersections/index.js";
