import { Intersection, ThreeEvent } from "@react-three/fiber";
import { EventHandlers } from "@react-three/fiber/dist/declarations/src/core/events";
import { Object3D, Intersection as ThreeIntersection } from "three";
import { EventManager, EventProxy } from "./event-manager";
import { makeId } from "./util";

export type PointerCaptureTarget = {
  releasePointerCapture: (id: number) => void;
  setPointerCapture: (id: number) => void;
};

export type PointerCaptureData = {
  intersection: Intersection;
  target: PointerCaptureTarget;
};

export type PointerEvent = { pointerId?: number; target: PointerCaptureTarget };

export class PointerManager extends EventManager {
  private initialHittedObjects: Array<Object3D> = [];

  constructor(
    eventProxy: EventProxy,
    private getInteractables: () => Array<Object3D>
  ) {
    super(eventProxy);
  }

  //events without intersections
  pointerCancel = this.cancelHoversExcept.bind(this, []);
  pointerLeave = this.cancelHoversExcept.bind(this, []);
  lostPointerCapture(event: PointerEvent) {
    if (event.pointerId == null || !this.capturedMap.has(event.pointerId)) {
      return;
    }
    const pointerId = event.pointerId;
    // If the object event interface had onLostPointerCapture, we'd call it here on every
    // object that's getting removed. We call it on the next frame because onLostPointerCapture
    // fires before onPointerUp. Otherwise pointerUp would never be called if the event didn't
    // happen in the object it originated from, leaving components in a in-between state.
    requestAnimationFrame(() => {
      // Only release if pointer-up didn't do it already
      if (!this.capturedMap.has(pointerId)) {
        return;
      }
      this.capturedMap.delete(pointerId);
      this.cancelHoversExcept([]);
    });
  }

  //events with intersections
  pointerClick = this.handlePointerEvent.bind(this, "onClick");
  pointerContextMenu = this.handlePointerEvent.bind(this, "onContextMenu");
  pointerDoubleClick = this.handlePointerEvent.bind(this, "onDoubleClick");
  pointerDown = this.handlePointerEvent.bind(this, "onPointerDown");
  pointerMove = this.handlePointerEvent.bind(this, "onPointerMove");
  pointerUp = this.handlePointerEvent.bind(this, "onPointerUp");
  pointerWheel = this.handlePointerEvent.bind(this, "onWheel");

  //cleanup
  destroy = this.cancelHoversExcept.bind(this, []);

  //utils
  private handlePointerEvent(
    name: keyof EventHandlers,
    hits: Array<ThreeIntersection>,
    event: PointerEvent
  ) {
    const isPointerMove = name === "onPointerMove";
    const isClickEvent =
      name === "onClick" ||
      name === "onDoubleClick" ||
      name === "onContextMenu";

    const intersections: Array<Intersection> = this.computeIntersections(
      hits,
      event
    );

    // Save initial coordinates on pointer-down
    if (name === "onPointerDown") {
      this.initialHittedObjects = intersections.map((hit) => hit.eventObject);
    }

    // If a click yields no results, pass it back to the user as a miss
    // Missed events have to come first in order to establish user-land side-effect clean up
    if (isClickEvent && intersections.length === 0) {
      for (const object of this.getInteractables()) {
        this.eventProxy.onPointerMissed(object, event as any);
      }
      return;
    }

    if (isPointerMove) {
      // unhover all hovered objects that are not intersected when moving the pointer
      this.cancelHoversExcept(intersections);
    }

    const globalRef = {
      stopped: false,
    };

    // forward to the event listeners
    for (
      let intersectionIndex = 0;
      //loop through intersections as long
      intersectionIndex < intersections.length && !globalRef.stopped;
      intersectionIndex++
    ) {
      const intersection = intersections[intersectionIndex];

      const object = intersection.object;

      const eventData = this.createEventData(
        globalRef,
        intersection,
        intersectionIndex,
        intersections,
        event
      );

      if (!isClickEvent || this.initialHittedObjects.includes(object)) {
        const interactables = this.getInteractables();

        //all
        for (const object of interactables) {
          if (this.initialHittedObjects.includes(object)) {
            continue;
          }
          this.eventProxy.onPointerMissed(object, event as any);
        }
        // Now call the handler
        this.eventProxy[name](object, eventData);

        return;
      }

      if (!isPointerMove) {
        return;
      }

      // Move event ...
      if (
        this.eventProxy.hasEventHandler(
          object,
          "onPointerOver",
          "onPointerEnter",
          "onPointerOut",
          "onPointerLeave"
        )
      ) {
        // When enter or out is present take care of hover-state
        const id = makeId(eventData);
        const hoveredItem = this.hovered.get(id);
        if (hoveredItem == null) {
          // If the object wasn't previously hovered, book it and call its handler
          this.hovered.set(id, eventData);
          this.eventProxy.onPointerOver(object, eventData);
          this.eventProxy.onPointerEnter(object, eventData);
        } else if (hoveredItem.stopped) {
          // If the object was previously hovered and stopped, we shouldn't allow other items to proceed
          eventData.stopPropagation();
        }
      }

      // Call mouse move
      this.eventProxy.onPointerMove(object, eventData);
    }
  }

  private computeIntersections(
    hits: Array<ThreeIntersection>,
    event: PointerEvent
  ) {
    const intersections: Array<Intersection> = [];

    // Bubble up the events, find the event source (eventObject)
    for (const hit of hits) {
      let eventObject: Object3D | null = hit.object;
      // Bubble event up
      while (eventObject != null) {
        if (this.eventProxy.hasEventHandlers(eventObject)) {
          intersections.push({ ...hit, eventObject });
        }
        eventObject = eventObject.parent;
      }
    }

    const duplicates = new Set<string>();

    // If the interaction is captured, make all capturing targets part of the intersect.
    if (event.pointerId != null && this.capturedMap.has(event.pointerId)) {
      for (let captureData of this.capturedMap.get(event.pointerId)!.values()) {
        if (!duplicates.has(makeId(captureData.intersection)))
          intersections.push(captureData.intersection);
      }
    }

    return intersections;
  }
}
