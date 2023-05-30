import type { EventHandlers } from "@react-three/fiber/dist/declarations/src/core/events";
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

export type StoppedRef = { stopped: boolean };

const lastIntersectionSymbol = Symbol("last-intersection");

/**
 * combines a actual intersection with any ancestor object or the intersected object itself
 * can be computed by "bubbeling up" the "real" intersections
 */
type SceneIntersection = {
  intersection: Intersection;
  interactableObject: Object3D;
};

export type EventCaptureTarget = {
  releasePointerCapture: (id: number) => void;
  setPointerCapture: (id: number) => void;
  hasPointerCapture: (id: number) => boolean;
};

/**
 *–> press, release, cancel, move, and wheel are simply forwarded to the intersected objects

 *–> enter, leave are based on 'entered-objects'

 *–> select are based on 'pressed-objects'

 *–> event captures are based on 'captured-objects'

 */
export type EventDispatcher<E> = {
  [Key in ObjectEventTypes]: (
    object: Object3D,
    event: E,
    intersection: Intersection,
    target: EventCaptureTarget,
    stopRef: StoppedRef
  ) => void;
} & {
  hasEventHandlers(object: Object3D): boolean;
  hasEventHandler(
    object: Object3D,
    ...oneOf: Array<keyof EventHandlers>
  ): boolean;
};

//careful: the objects that we operate must not be the same object in the intersection (we also go through the ancestors)

export class EventTranslator<E> {
  protected enteredObjects: Array<Object3D> = [];
  protected capturedObjects: Array<Object3D> = [];

  private lastTimeMove: number = performance.now();
  private lastTimePress: number = performance.now();

  constructor(
    public readonly inputDeviceId: number,
    protected eventDispatcher: EventDispatcher<E>,
    protected getInteractableObjects: () => Array<Object3D>,
    protected computeIntersections: (
      objects: Array<Object3D>,
      event: E
    ) => Array<Intersection>,
    protected fakeIntersections: (
      objects: Array<Object3D>,
      event: E
    ) => Array<Intersection>,
    protected getPressedElementIds: (intersection: Intersection) => Array<number>,
    protected onPointerMissed: () => void
  ) {}

  move(event: E): void {
    const time = performance.now();
    const sceneIntersections = this.computeSceneIntersections(event);
    if (this.capturedObjects.length === 0) {
      //enter events
      for (const { interactableObject, intersection } of sceneIntersections) {
        if (
          (interactableObject as any)[lastIntersectionSymbol] ===
          this.lastTimeMove
        ) {
          //object was already intersected last time –> no new intersection
          continue;
        }
        this.eventDispatcher.enter(
          interactableObject,
          event,
          intersection,
          target,
          enterEventStoppedRef
        );
      }

      //leave events
      for (const object of this.enteredObjects) {
        if ((object as any)[lastIntersectionSymbol] === time) {
          continue;
        }
        this.eventDispatcher.leave(
          object,
          event,
          intersection,
          target,
          leaveEventStoppedRef
        );
      }

      this.enteredObjects = sceneIntersections.map()
    }

    const moveEventStoppedRef: StoppedRef = { stopped: false };

    for (const { interactableObject, intersection } of sceneIntersections) {
      this.eventDispatcher.move(
        interactableObject,
        event,
        intersection,
        target,
        moveEventStoppedRef
      );
    }

    this.lastTimeMove = time;
  }

  press(event: E): void {
    this.move(event)
    for (const { interactableObject, intersection } of sceneIntersections) {

    }
  }

  release(event: E): void {
    //release captured
    for (const object of this.capturedObjects) {
        this.eventDispatcher.losteventcapture(object, event, , target, stopRef)
    }
    this.capturedObjects = [];

    //release event
    for (const object of this.enteredObjects) {

    }
    

    //select event
    for (const object of this.enteredObjects) {
        if((object as any)[lastPressSymbol] < (object as any)[lastLeaveSymbol]) {
            continue
        }
        this.eventDispatcher.select(object, event, )
    }

  }

  cancel(event: E): void {
    //TODO?

  }

  enter(event: E): void {
    this.interact(event, true, false, false)
  }

  leave(event: E): void {
    for(const object of this.enteredObjects) {
        this.eventDispatcher.leave(object, event, , target, stopRef)
    }
  }

    interact(event: E, move: boolean): void {
    }


  private computeSceneIntersections(event: E): Array<SceneIntersection> {}

  /**
   * traverses the intersected objects and their ancestors
   * beginning by the first entry in the intersections and its ancestors
   */
  private traverseIntersectedObjects(
    intersections: Array<Intersection>,
    ref: StoppedRef,
    callback: (object: Object3D, intersection: Intersection) => void
  ): void {
    for (const intersection of intersections) {
      let object: Object3D | null = intersection.object;
      while (object != null) {
        callback(object, intersection);
        if (ref.stopped) {
          return;
        }
        object = object.parent;
      }
    }
  }
}
