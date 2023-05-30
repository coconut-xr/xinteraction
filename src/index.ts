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
  lastIntersectedTime: number;
  lastLeftTime: number;
  lastPressedElementIds: Array<number>;
  lastPressedElementTimeMap: Map<number, number>;
};

const traversalIdSymbol = Symbol("traversal-id");

export class EventTranslator<E> {
  //state
  private intersections: Array<Intersection> = [];
  private lastPositionChangeTime: number = -1;
  private capturedEvents: Set<Object3D> | undefined;
  private objectInteractionDataMap = new Map<Object3D, ObjectInteractionData>();

  constructor(
    protected eventDispatcher: EventDispatcher<E>,
    protected computeIntersections: (
      event: E,
      objects?: Array<Object3D>
    ) => Array<Intersection>,
    protected getPressedElementIds: (
      intersection: Intersection
    ) => Array<number>,
    protected onPointerMissed: () => void
  ) {}

  update(event: E, positionChanged: boolean, pressChanged: boolean): void {
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

    //enter, move, press, release, click, canceleventcapture events
    this.traverseIntersections(
      this.intersections,
      (object, intersection, pressedElementIds) => {
        const interactionData = this.getInteractionData(object);

        if (positionChanged) {
          this.dispatchEnterAndLeave(object, interactionData, intersection);
          //update last intersection time
          interactionData.lastIntersectedTime = currentTime;
        }

        if (pressChanged) {
          this.dispatchPressAndRelease(
            object,
            interactionData,
            intersection,
            pressedElementIds
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
      },
      this.getPressedElementIds
    );

    if (!positionChanged) {
      return;
    }

    //leave events
    this.traverseIntersections(prevIntersections, (object, intersection) => {
      const interactionData = this.getInteractionData(object);
      if (interactionData.lastIntersectedTime === currentTime) {
        //object was intersected this time
        return;
      }
      this.eventDispatcher.leave(object, intersection);
      interactionData.lastLeftTime = currentTime;
    });

    this.lastPositionChangeTime = currentTime;
  }

  cancel(event: E): void {
    this.eventDispatcher.bind(event, this);
    //TODO
  }

  wheel(event: E): void {
    this.eventDispatcher.bind(event, this);
    this.traverseIntersections(this.intersections, (object, intersection) =>
      this.eventDispatcher.wheel(object, intersection)
    );
  }

  leave(event: E): void {
    this.eventDispatcher.bind(event, this);
    this.traverseIntersections(this.intersections, (object, intersection) =>
      this.eventDispatcher.leave(object, intersection)
    );

    //reset state
    this.lastPositionChangeTime = -1;
    this.intersections.length = 0;
    this.capturedEvents = undefined;
  }

  private dispatchPressAndRelease(
    object: Object3D,
    interactionData: ObjectInteractionData,
    intersection: Intersection,
    pressedElementIds: Array<number>
  ): void {
    const lastPressedElementIds = new Set(
      interactionData.lastPressedElementTimeMap.keys()
    );
    for (const pressedElementId of pressedElementIds) {
      if (lastPressedElementIds.delete(pressedElementId)) {
        //was pressed last time
        continue;
      }
      //pressedElementId was not pressed last time
      this.eventDispatcher.press(object, intersection, pressedElementId);
    }
    for (const pressedElementId of lastPressedElementIds) {
      //pressedElementId was not pressed this time
      this.eventDispatcher.release(object, intersection, pressedElementId);

      const lastPressedElementTime =
        interactionData.lastPressedElementTimeMap.get(pressedElementId) ?? -1;
      if (interactionData.lastLeftTime < lastPressedElementTime) {
        //the object wasn't left since it was pressed last
        this.eventDispatcher.select(object, intersection, pressedElementId);
      }
      this.removeEventCapture(object);
    }
  }

  private dispatchEnterAndLeave(
    object: Object3D,
    interactionData: ObjectInteractionData,
    intersection: Intersection
  ): void {
    if (interactionData.lastIntersectedTime === this.lastPositionChangeTime) {
      //object was intersected last time
      this.eventDispatcher.move(object, intersection);
    } else {
      //object was not intersected last time
      this.eventDispatcher.enter(object, intersection);
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
    this.capturedEvents.delete(object);
    if (this.capturedEvents.size === 0) {
      this.capturedEvents = undefined;
    }
  }

  public hasEventCapture(object: Object3D): boolean {
    return this.capturedEvents?.has(object) ?? false;
  }

  private traverseIntersections<I>(
    intersections: Array<Intersection>,
    callback: (object: Object3D, intersection: Intersection, info: I) => void,
    intersectionInfo: (intersection: Intersection) => I = () => undefined as any
  ): void {
    const traversalId = Math.random();
    outer: for (const intersection of intersections) {
      let object: Object3D | null = intersection.object;
      const info = intersectionInfo(intersection);
      while (object != null) {
        if (!checkUniqueTraversal(object, traversalId)) {
          continue outer;
        }
        if (!this.eventDispatcher.hasEventHandlers(object)) {
          continue;
        }
        callback(object, intersection, info);
      }
    }
  }

  private getInteractionData(object: Object3D): ObjectInteractionData {
    let data = this.objectInteractionDataMap.get(object);
    if (data == null) {
      this.objectInteractionDataMap.set(
        object,
        (data = {
          lastLeftTime: -1,
          lastIntersectedTime: -1,
          lastPressedElementTimeMap: new Map(),
          lastPressedElementIds: [],
        })
      );
    }
    return data;
  }
}

function checkUniqueTraversal(value: any, traversalId: number): boolean {
  const tId = value[traversalIdSymbol];
  if (tId != traversalId) {
    return false;
  }
  value[traversalIdSymbol] = traversalId;
  return true;
}
