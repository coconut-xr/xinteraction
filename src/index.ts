import { Intersection, Object3D } from "three";

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

export type EventDispatcher<E> = {
  [Key in ObjectEventTypes]: (
    object: Object3D,
    intersection: Intersection,
    inputDeviceElementId?: number
  ) => void;
} & {
  bind(event: E, eventTranslater: EventTranslator<E>): void;
  hasEventHandlers(object: Object3D): boolean;
};

type ObjectInteractionData = {
  lastIntersectedTime?: number;
  lastLeftTime?: number;
  lastPressedElementIds: Set<number>;
  lastPressedElementTimeMap: Map<number, number>;
  blockFollowingIntersections: boolean;
};

const traversalIdSymbol = Symbol("traversal-id");

const emptySet = new Set<number>();

export class EventTranslator<E> {
  //state
  private intersections: Array<Intersection> = [];
  private lastPositionChangeTime: number | undefined;
  private capturedEvents: Set<Object3D> | undefined;
  private objectInteractionDataMap = new Map<Object3D, ObjectInteractionData>();

  constructor(
    public readonly inputDeviceId: number,
    private readonly dispatchPressAlways: boolean,
    protected eventDispatcher: EventDispatcher<E>,
    protected computeIntersections: (
      event: E,
      objects?: Array<Object3D>
    ) => Array<Intersection>,
    protected getPressedElementIds: (
      intersection: Intersection
    ) => Iterable<number>
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
        this.capturedEvents == null
          ? undefined
          : Array.from(this.capturedEvents)
      );
    }

    //enter, move, press, release, click, losteventcapture events
    this.traverseIntersections<Set<number>>(
      this.intersections,
      (
        object,
        interactionData,
        intersection,
        intersectionIndex,
        pressedElementIds
      ) => {
        let entered = false;
        if (positionChanged) {
          entered = this.dispatchEnterAndMove(
            object,
            interactionData,
            intersection
          );
          //update last intersection time
          interactionData.lastIntersectedTime = currentTime;
        }

        if (pressChanged || entered) {
          this.dispatchPressAndRelease(
            object,
            interactionData,
            intersection,
            pressedElementIds,
            dispatchPressFor
          );
          //update lastPressedElementIds
          interactionData.lastPressedElementIds = pressedElementIds;
          //update lastPressedElementTimeMap
          for (const pressedElementId of pressedElementIds) {
            interactionData.lastPressedElementTimeMap.set(
              pressedElementId,
              currentTime
            );
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
        (object, interactionData, intersection) => {
          if (interactionData.lastIntersectedTime === currentTime) {
            //object was intersected this time –> therefore also all the ancestors –> can stop bubbeling up here
            return false;
          }
          this.eventDispatcher.leave(object, intersection);
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
      (object, interactionData, intersection) => {
        this.eventDispatcher.cancel(object, intersection);
        return true;
      }
    );
  }

  wheel(event: E): void {
    this.eventDispatcher.bind(event, this);
    this.traverseIntersections(
      this.intersections,
      (object, interactionData, intersection) => {
        this.eventDispatcher.wheel(object, intersection);
        return true;
      }
    );
  }

  leave(event: E): void {
    this.eventDispatcher.bind(event, this);
    this.traverseIntersections(
      this.intersections,
      (object, interactionData, intersection) => {
        this.eventDispatcher.leave(object, intersection);
        return true;
      }
    );

    //reset state
    this.lastPositionChangeTime = undefined;
    this.intersections.length = 0;
    this.capturedEvents = undefined;
  }

  private dispatchPressAndRelease(
    object: Object3D,
    interactionData: ObjectInteractionData,
    intersection: Intersection,
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
        this.eventDispatcher.press(object, intersection, pressedElementId);
      }
    }
    for (const releasedElementId of lastPressedElementIds) {
      //pressedElementId was not pressed this time
      this.eventDispatcher.release(object, intersection, releasedElementId);

      const lastPressedElementTime =
        interactionData.lastPressedElementTimeMap.get(releasedElementId);
      if (
        interactionData.lastLeftTime == null ||
        (lastPressedElementTime != null &&
          interactionData.lastLeftTime < lastPressedElementTime)
      ) {
        //the object wasn't left since it was pressed last
        this.eventDispatcher.select(object, intersection, releasedElementId);
      }
      this.removeEventCapture(object);
    }
  }

  /**
   * @returns if the object was entered
   */
  private dispatchEnterAndMove(
    object: Object3D,
    interactionData: ObjectInteractionData,
    intersection: Intersection
  ): boolean {
    if (
      interactionData.lastIntersectedTime != null &&
      interactionData.lastIntersectedTime === this.lastPositionChangeTime
    ) {
      //object was intersected last time
      this.eventDispatcher.move(object, intersection);
      return false;
    } else {
      //reset to not block the following intersections
      interactionData.blockFollowingIntersections = false;
      //object was not intersected last time
      this.eventDispatcher.enter(object, intersection);
      return true;
    }
  }

  public addEventCapture(object: Object3D): void {
    if (this.capturedEvents == null) {
      this.capturedEvents = new Set();
    }
    this.capturedEvents.add(object);
  }

  public removeEventCapture(object: Object3D): void {
    if (this.capturedEvents == null) {
      return;
    }
    this.eventDispatcher.losteventcapture(object, undefined as any);
    if (!this.capturedEvents.delete(object)) {
      return;
    }
    if (this.capturedEvents.size === 0) {
      this.capturedEvents = undefined;
    }
  }

  public hasEventCapture(object: Object3D): boolean {
    return this.capturedEvents?.has(object) ?? false;
  }

  /**
   * @param callback returns false if the event should stop bubbeling upwards
   */
  private traverseIntersections<I>(
    intersections: Array<Intersection>,
    callback: (
      object: Object3D,
      interactionData: ObjectInteractionData,
      intersection: Intersection,
      interactionIndex: number,
      info: I
    ) => boolean,
    intersectionInfo: (intersection: Intersection) => I = () => undefined as any
  ): void {
    const traversalId = Math.random();
    outer: for (
      let intersectionIndex = 0;
      intersectionIndex < intersections.length;
      intersectionIndex++
    ) {
      const intersection = intersections[intersectionIndex];
      let object: Object3D | null = intersection.object;
      const info = intersectionInfo(intersection);
      while (object != null) {
        if (!checkUniqueTraversal(object, traversalId)) {
          continue outer;
        }
        if (!this.eventDispatcher.hasEventHandlers(object)) {
          continue;
        }
        const interactionData = this.getInteractionData(object);
        const continueUpwards = callback(
          object,
          interactionData,
          intersection,
          intersectionIndex,
          info
        );
        if (!continueUpwards) {
          continue outer;
        }
        object = object.parent;
      }
    }
  }

  public blockFollowingIntersections(object: Object3D): void {
    const interactionData = this.getInteractionData(object);
    interactionData.blockFollowingIntersections = true;
  }

  private getInteractionData(object: Object3D): ObjectInteractionData {
    let data = this.objectInteractionDataMap.get(object);
    if (data == null) {
      this.objectInteractionDataMap.set(
        object,
        (data = {
          lastPressedElementTimeMap: new Map(),
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
