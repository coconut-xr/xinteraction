import { Intersection, ThreeEvent } from "@react-three/fiber";
import { Object3D } from "three";
import { makeId } from "./util";
import { EventHandlers } from "@react-three/fiber/dist/declarations/src/core/events";

export type PointerCaptureTarget = {
  releasePointerCapture: (id: number) => void;
  setPointerCapture: (id: number) => void;
};

export type PointerCaptureData = {
  intersection: Intersection;
  target: PointerCaptureTarget;
};

type StoppedRef = { stopped: boolean };

export type EventProxy = {
  [Key in keyof EventHandlers]-?: (
    object: Object3D,
    event: ThreeEvent<PointerEvent>
  ) => void;
} & {
  hasEventHandlers(object: Object3D): boolean;
  hasEventHandler(
    object: Object3D,
    ...oneOf: Array<keyof EventHandlers>
  ): boolean;
};

export type PointerEvent = { pointerId?: number; target: PointerCaptureTarget };

export class EventManager {
  //state
  protected hovered = new Map<string, ThreeEvent<PointerEvent>>();
  protected capturedMap = new Map<number, Map<Object3D, PointerCaptureData>>();

  constructor(protected eventProxy: EventProxy) {}

  protected createEventData(
    globalRef: StoppedRef,
    intersection: Intersection,
    intersectionIndex: number,
    intersections: Array<Intersection>,
    event: PointerEvent
  ): ThreeEvent<PointerEvent> {
    const localRef: StoppedRef = { stopped: false };
    // Add native event props
    let extractEventProps: any = {};
    // This iterates over the event's properties including the inherited ones. Native PointerEvents have most of their props as getters which are inherited, but polyfilled PointerEvents have them all as their own properties (i.e. not inherited). We can't use Object.keys() or Object.entries() as they only return "own" properties; nor Object.getPrototypeOf(event) as that *doesn't* return "own" properties, only inherited ones.
    for (let prop in event) {
      const property = event[prop as keyof typeof event];
      // Only copy over atomics, leave functions alone as these should be
      // called as event.nativeEvent.fn()
      if (typeof property === "function") {
        continue;
      }
      extractEventProps[prop] = property;
    }

    const target = {
      hasPointerCapture: (id: number) => {
        this.capturedMap.get(id)?.has(intersection.eventObject) ?? false;
      },
      setPointerCapture: this.setPointerCapture.bind(this, intersection, event),
      releasePointerCapture: this.releasePointerCapture.bind(
        this,
        intersection
      ),
    };

    return Object.assign(localRef, intersection, extractEventProps, {
      pointer,
      intersections,
      unprojectedPoint,
      // Hijack stopPropagation, which just sets a flag
      stopPropagation: () =>
        this.stopPropagation(
          globalRef,
          localRef,
          intersection,
          intersectionIndex,
          intersections,
          event
        ),
      // there should be a distinction between target and currentTarget
      target,
      currentTarget: target,
      nativeEvent: event,
    });
  }

  protected cancelHoversExcept(intersections: Array<Intersection>) {
    for (const hoveredEvent of this.hovered.values()) {
      if (
        intersections.find(
          (hit) =>
            hit.object === hoveredEvent.object &&
            hit.index === hoveredEvent.index &&
            hit.instanceId === hoveredEvent.instanceId
        ) != null
      ) {
        continue;
      }

      // => hoveredEvent.eventObject is in this.hovered but currently not intersected

      this.hovered.delete(makeId(hoveredEvent));

      // Clear out intersects, they are outdated by now
      const data = {
        ...hoveredEvent,
        intersections,
      } as any;

      this.eventProxy.onPointerOut(hoveredEvent.object, data);
      this.eventProxy.onPointerLeave(hoveredEvent.object, data);
    }
  }

  private setPointerCapture(
    intersection: Intersection,
    event: PointerEvent,
    pointerId: number
  ) {
    const captureData: PointerCaptureData = {
      intersection,
      target: event.target,
    };

    //add the catpureData to the capture map under pointerId -> intersection.eventObject -> captureData
    let captureMapEntry = this.capturedMap.get(pointerId);
    if (captureMapEntry == null) {
      this.capturedMap.set(pointerId, (captureMapEntry = new Map()));
    }
    captureMapEntry.set(intersection.eventObject, captureData);

    // Call the original event now
    event.target.setPointerCapture(pointerId);
  }

  private releasePointerCapture(intersection: Intersection, id: number) {
    const captures = this.capturedMap.get(id);
    if (captures == null) {
      return;
    }

    const captureData: PointerCaptureData | undefined = captures.get(
      intersection.eventObject
    );
    if (captureData == null) {
      return;
    }

    captures.delete(intersection.eventObject);

    // release the native pointer capture, if this was the last object captured by this pointer
    if (captures.size === 0) {
      this.capturedMap.delete(id);
      captureData.target.releasePointerCapture(id);
    }
  }

  private stopPropagation(
    globalRef: StoppedRef,
    localRef: StoppedRef,
    intersection: Intersection,
    intersectionIndex: number,
    intersections: Array<Intersection>,
    event: PointerEvent
  ) {
    //all objects that are captured by this pointer (undefined if nothing captured by this pointer)
    const capturesForPointer =
      event.pointerId != null
        ? this.capturedMap.get(event.pointerId)
        : undefined;

    //check if the pointer has not captured anything or has captured the intersected object
    if (
      capturesForPointer != null &&
      !capturesForPointer.has(intersection.eventObject)
    ) {
      return;
    }

    //set stop flag to true
    globalRef.stopped = localRef.stopped = true;

    //if the object itself is hovered, cancel hovering the objects that are comming afterwards
    if (this.hovered.has(makeId(intersection))) {
      //cancel all hovers except the earlier hovers (the ones before stop propagation was called)
      this.cancelHoversExcept(intersections.slice(0, intersectionIndex + 1));
    }
  }
}
