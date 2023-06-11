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

type ObjectInteractionData = {
  lastIntersectedTime?: number;
  lastLeftTime?: number;
  lastPressedElementIds: Set<number>;
  lastPressedElementEventTimeMap: Map<number, number>;
  blockFollowingIntersections: boolean;
};

const traversalIdSymbol = Symbol("traversal-id");

const emptySet = new Set<number>();

export class EventTranslator<
  E = Event,
  I extends XIntersection = XIntersection
> {
  //state
  public intersections: Array<I> = [];
  private lastPositionChangeTime: number | undefined;
  private capturedEvents: Map<Object3D, I> | undefined;
  private objectInteractionDataMap = new Map<Object3D, ObjectInteractionData>();

  private voidInteractionData: Omit<
    ObjectInteractionData,
    "lastIntersectedTime" | "blockFollowingIntersections"
  > = {
    lastPressedElementIds: emptySet,
    lastPressedElementEventTimeMap: new Map(),
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
        this.voidInteractionData.lastLeftTime = currentTime;
        this.voidInteractionData.lastPressedElementIds = emptySet;
      }
    }

    //TODO: refactor (the following code is the same for "objects")

    //onPressMissed, onReleaseMissed, onSelectMissed
    if (pressChanged) {
      const pressedElementIds = new Set(this.getPressedElementIds());

      //dispatch onPressMissed if intersected with nothing
      if (this.intersections.length === 0) {
        const lastPressedElementIds = new Set(
          this.voidInteractionData.lastPressedElementIds
        );
        for (const pressedElementId of pressedElementIds) {
          lastPressedElementIds.delete(pressedElementId);
          if (
            dispatchPressFor.includes(pressedElementId) ||
            this.dispatchPressAlways
          ) {
            this.onPressMissed?.(event);
          }
        }
        for (const releasedElementId of lastPressedElementIds) {
          this.onReleaseMissed?.(event);
          const lastPressedElementEventTime =
            this.voidInteractionData.lastPressedElementEventTimeMap.get(
              releasedElementId
            );
          if (
            lastPressedElementEventTime != null &&
            (this.voidInteractionData.lastLeftTime == null ||
              this.voidInteractionData.lastLeftTime <
                lastPressedElementEventTime)
          ) {
            this.onSelectMissed?.(event);
          }
        }

        //update lastPressedElementIds
        this.voidInteractionData.lastPressedElementIds = pressedElementIds;
        //update lastPressedElementTimeMap
        for (const pressedElementId of pressedElementIds) {
          if (dispatchPressFor.includes(pressedElementId)) {
            this.voidInteractionData.lastPressedElementEventTimeMap.set(
              pressedElementId,
              currentTime
            );
          }
        }
      }
    }

    //enter, move, press, release, click, losteventcapture events
    this.traverseIntersections<Set<number>>(
      this.intersections,
      (
        eventObject,
        interactionData,
        intersection,
        intersectionIndex,
        pressedElementIds
      ) => {
        if (positionChanged) {
          this.dispatchEnterAndMove(eventObject, interactionData, intersection);
          //update last intersection time
          interactionData.lastIntersectedTime = currentTime;
        }

        if (pressChanged) {
          this.dispatchPressAndRelease(
            eventObject,
            interactionData,
            intersection,
            pressedElementIds,
            dispatchPressFor
          );
          //update lastPressedElementIds
          interactionData.lastPressedElementIds = pressedElementIds;
          //update lastPressedElementTimeMap
          for (const pressedElementId of pressedElementIds) {
            if (dispatchPressFor.includes(pressedElementId)) {
              interactionData.lastPressedElementEventTimeMap.set(
                pressedElementId,
                currentTime
              );
            }
          }
        }

        if (interactionData.blockFollowingIntersections) {
          //we remove the intersections that happen after
          this.intersections.length = intersectionIndex + 1;
        }

        return true;
      },
      (intersection) => new Set(this.getPressedElementIds(intersection))
    );

    if (positionChanged) {
      //leave events
      this.traverseIntersections(
        prevIntersections,
        (eventObject, interactionData, intersection) => {
          if (interactionData.lastIntersectedTime === currentTime) {
            //object was intersected this time –> therefore also all the ancestors –> can stop bubbeling up here
            return false;
          }
          this.eventDispatcher.leave(eventObject, intersection);
          interactionData.lastLeftTime = currentTime;
          interactionData.lastPressedElementIds = emptySet;
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
      (eventObject, interactionData, intersection) => {
        this.eventDispatcher.cancel(eventObject, intersection);
        return true;
      }
    );
  }

  wheel(event: E): void {
    this.eventDispatcher.bind(event, this);
    this.traverseIntersections(
      this.intersections,
      (eventObject, interactionData, intersection) => {
        this.eventDispatcher.wheel(eventObject, intersection);
        return true;
      }
    );
  }

  leave(event: E): void {
    this.eventDispatcher.bind(event, this);
    this.traverseIntersections(
      this.intersections,
      (eventObject, interactionData, intersection) => {
        this.eventDispatcher.leave(eventObject, intersection);
        return true;
      }
    );

    //reset state
    this.lastPositionChangeTime = undefined;
    this.intersections.length = 0;
    this.capturedEvents = undefined;
  }

  private dispatchPressAndRelease(
    eventObject: Object3D,
    interactionData: ObjectInteractionData,
    intersection: I,
    pressedElementIds: Set<number>,
    dispatchPressFor: Array<number>
  ): void {
    const lastPressedElementIds = new Set(
      interactionData.lastPressedElementIds
    );
    for (const pressedElementId of pressedElementIds) {
      if (lastPressedElementIds.delete(pressedElementId)) {
        //was pressed last time
        continue;
      }
      //pressedElementId was not pressed last time
      if (
        this.dispatchPressAlways ||
        dispatchPressFor.includes(pressedElementId)
      ) {
        this.eventDispatcher.press(eventObject, intersection, pressedElementId);
      }
    }
    for (const releasedElementId of lastPressedElementIds) {
      //pressedElementId was not pressed this time
      this.eventDispatcher.release(
        eventObject,
        intersection,
        releasedElementId
      );

      const lastPressedElementEventTime =
        interactionData.lastPressedElementEventTimeMap.get(releasedElementId);
      if (
        lastPressedElementEventTime != null &&
        (interactionData.lastLeftTime == null ||
          interactionData.lastLeftTime < lastPressedElementEventTime)
      ) {
        //the object wasn't left since it was pressed last
        this.eventDispatcher.select(
          eventObject,
          intersection,
          releasedElementId
        );
      }
      this.removeEventCapture(eventObject);
    }
  }

  /**
   * @returns if the object was entered
   */
  private dispatchEnterAndMove(
    eventObject: Object3D,
    interactionData: ObjectInteractionData,
    intersection: I
  ): void {
    if (
      interactionData.lastIntersectedTime != null &&
      interactionData.lastIntersectedTime === this.lastPositionChangeTime
    ) {
      //object was intersected last time
      this.eventDispatcher.move(eventObject, intersection);
    } else {
      //reset to not block the following intersections
      interactionData.blockFollowingIntersections = false;
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
      interactionData: ObjectInteractionData,
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
          const interactionData = this.getInteractionData(eventObject);
          const continueUpwards = callback(
            eventObject,
            interactionData,
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
    const interactionData = this.getInteractionData(eventObject);
    interactionData.blockFollowingIntersections = true;
  }

  private getInteractionData(eventObject: Object3D): ObjectInteractionData {
    let data = this.objectInteractionDataMap.get(eventObject);
    if (data == null) {
      this.objectInteractionDataMap.set(
        eventObject,
        (data = {
          lastPressedElementEventTimeMap: new Map(),
          lastPressedElementIds: emptySet,
          blockFollowingIntersections: false,
        })
      );
    }
    return data;
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
