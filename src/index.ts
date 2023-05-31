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
  lastPressedElementIds: Array<number>;
  lastPressedElementTimeMap: Map<number, number>;
};

const traversalIdSymbol = Symbol("traversal-id");

export class EventTranslator<E> {
  //state
  private intersections: Array<Intersection> = [];
  private lastPositionChangeTime: number | undefined;
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

    //enter, move, press, release, click, losteventcapture events
    this.traverseIntersections(
      this.intersections,
      (object, intersection, pressedElementIds) => {
        const interactionData = this.getInteractionData(object);

        if (positionChanged) {
          this.dispatchEnterAndMove(object, interactionData, intersection);
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

        return true
      },
      this.getPressedElementIds
    );

    if (positionChanged) {
      //leave events
      this.traverseIntersections(prevIntersections, (object, intersection) => {
        const interactionData = this.getInteractionData(object);
        if (interactionData.lastIntersectedTime === currentTime) {
          //object was intersected this time –> therefore also all the ancestors –> can stop bubbeling up here
          return false;
        }
        this.eventDispatcher.leave(object, intersection);
        interactionData.lastLeftTime = currentTime;
        return true
      });

      this.lastPositionChangeTime = currentTime;
    }
  }

  cancel(event: E): void {
    this.eventDispatcher.bind(event, this);
    //TODO
  }

  wheel(event: E): void {
    this.eventDispatcher.bind(event, this);
    this.traverseIntersections(this.intersections, (object, intersection) => {
      this.eventDispatcher.wheel(object, intersection);
      return true;
    });
  }

  leave(event: E): void {
    this.eventDispatcher.bind(event, this);
    this.traverseIntersections(this.intersections, (object, intersection) => {
      this.eventDispatcher.leave(object, intersection);
      return true;
    });

    //reset state
    this.lastPositionChangeTime = undefined;
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
      interactionData.lastPressedElementIds
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
        interactionData.lastPressedElementTimeMap.get(pressedElementId);
      if (
        interactionData.lastLeftTime == null ||
        (lastPressedElementTime != null &&
          interactionData.lastLeftTime < lastPressedElementTime)
      ) {
        //the object wasn't left since it was pressed last
        this.eventDispatcher.select(object, intersection, pressedElementId);
      }
      this.removeEventCapture(object);
    }
  }

  private dispatchEnterAndMove(
    object: Object3D,
    interactionData: ObjectInteractionData,
    intersection: Intersection
  ): void {
    if (
      interactionData.lastIntersectedTime != null &&
      interactionData.lastIntersectedTime === this.lastPositionChangeTime
    ) {
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
      intersection: Intersection,
      info: I
    ) => boolean,
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
        if (!callback(object, intersection, info)) {
          continue outer;
        }
        object = object.parent;
      }
    }
  }

  private getInteractionData(object: Object3D): ObjectInteractionData {
    let data = this.objectInteractionDataMap.get(object);
    if (data == null) {
      this.objectInteractionDataMap.set(
        object,
        (data = {
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
  if (tId === traversalId) {
    return false;
  }
  value[traversalIdSymbol] = traversalId;
  return true;
}
