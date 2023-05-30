import {
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Ray,
  Intersection as ThreeIntersection,
  Vector2,
  Vector3,
} from "three";
import {
  ContinuousEventPriority,
  DiscreteEventPriority,
  DefaultEventPriority,
} from "react-reconciler/constants";
import { Properties, RootState, getRootState } from "@react-three/fiber";
import type { Instance } from "@react-three/fiber/dist/declarations/src/core/renderer";
import type { UseBoundStore } from "zustand";

export interface Intersection extends ThreeIntersection {
  /** The event source (the object which registered the handler) */
  eventObject: Object3D;
}

export interface IntersectionEvent<TSourceEvent> extends Intersection {
  /** The event source (the object which registered the handler) */
  eventObject: Object3D;
  /** An array of intersections */
  intersections: Intersection[];
  /** vec3.set(pointer.x, pointer.y, 0).unproject(camera) */
  unprojectedPoint: Vector3;
  /** Normalized event coordinates */
  pointer: Vector2;
  /** Delta between first click and this event */
  delta: number;
  /** The ray that pierced it */
  ray: Ray;
  /** The camera that was used by the raycaster */
  camera: Camera;
  /** stopPropagation will stop underlying handlers from firing */
  stopPropagation: () => void;
  /** The original host event */
  nativeEvent: TSourceEvent;
  /** If the event was stopped by calling stopPropagation */
  stopped: boolean;
}

export type Camera = OrthographicCamera | PerspectiveCamera;
export type ThreeEvent<TEvent> = IntersectionEvent<TEvent> & Properties<TEvent>;
export type DomEvent = PointerEvent | MouseEvent | WheelEvent;

export type Events = {
  onClick: EventListener;
  onContextMenu: EventListener;
  onDoubleClick: EventListener;
  onWheel: EventListener;
  onPointerDown: EventListener;
  onPointerUp: EventListener;
  onPointerLeave: EventListener;
  onPointerMove: EventListener;
  onPointerCancel: EventListener;
  onLostPointerCapture: EventListener;
};

export type FilterFunction = (
  items: Intersection[],
  state: RootState
) => Intersection[];
export type ComputeFunction = (
  event: DomEvent,
  root: RootState,
  previous?: RootState
) => void;

export interface EventManager<TTarget> {
  /** Determines if the event layer is active */
  enabled: boolean;
  /** Event layer priority, higher prioritized layers come first and may stop(-propagate) lower layer  */
  priority: number;
  /** The compute function needs to set up the raycaster and an xy- pointer  */
  compute?: ComputeFunction;
  /** The filter can re-order or re-structure the intersections  */
  filter?: FilterFunction;
  /** The target node the event layer is tied to */
  connected?: TTarget;
  /** All the pointer event handlers through which the host forwards native events */
  handlers?: Events;
  /** Allows re-connecting to another target */
  connect?: (target: TTarget) => void;
  /** Removes all existing events handlers from the target */
  disconnect?: () => void;
  /** Triggers a onPointerMove with the last known event. This can be useful to enable raycasting without
   *  explicit user interaction, for instance when the camera moves a hoverable object underneath the cursor.
   */
  update?: () => void;
}

export interface PointerCaptureTarget {
  intersection: Intersection;
  target: Element;
}

function makeId(event: Intersection) {
  return (
    (event.eventObject || event.object).uuid +
    "/" +
    event.index +
    event.instanceId
  );
}

// https://github.com/facebook/react/tree/main/packages/react-reconciler#getcurrenteventpriority
// Gives React a clue as to how import the current interaction is
export function getEventPriority() {
  // Get a handle to the current global scope in window and worker contexts if able
  // https://github.com/pmndrs/react-three-fiber/pull/2493
  const globalScope =
    (typeof self !== "undefined" && self) ||
    (typeof window !== "undefined" && window);
  if (!globalScope) return DefaultEventPriority;

  const name = globalScope.event?.type;
  switch (name) {
    case "click":
    case "contextmenu":
    case "dblclick":
    case "pointercancel":
    case "pointerdown":
    case "pointerup":
      return DiscreteEventPriority;
    case "pointermove":
    case "pointerout":
    case "pointerover":
    case "pointerenter":
    case "pointerleave":
    case "wheel":
      return ContinuousEventPriority;
    default:
      return DefaultEventPriority;
  }
}

/** Calculates delta */
function calculateDistance(event: DomEvent) {
  const { internal } = store.getState();
  const dx = event.offsetX - internal.initialClick[0];
  const dy = event.offsetY - internal.initialClick[1];
  return Math.round(Math.sqrt(dx * dx + dy * dy));
}

/** Returns true if an instance has a valid pointer-event registered, this excludes scroll, clicks etc */
function filterPointerEvents(objects: Object3D[]) {
  return objects.filter((obj) =>
    ["Move", "Over", "Enter", "Out", "Leave"].some(
      (name) =>
        (obj as unknown as Instance).__r3f?.handlers[
          ("onPointer" + name) as keyof EventHandlers
        ]
    )
  );
}

function intersect(
  event: DomEvent,
  filter?: (objects: Object3D[]) => Object3D[]
) {
  const state = store.getState();
  const duplicates = new Set<string>();
  const intersections: Intersection[] = [];
  // Allow callers to eliminate event objects
  const eventsObjects = filter
    ? filter(state.internal.interaction)
    : state.internal.interaction;
  // Reset all raycaster cameras to undefined
  for (let i = 0; i < eventsObjects.length; i++) {
    const state = getRootState(eventsObjects[i]);
    if (state) {
      state.raycaster.camera = undefined!;
    }
  }

  if (!state.previousRoot) {
    // Make sure root-level pointer and ray are set up
    state.events.compute?.(event, state);
  }

  function handleRaycast(obj: Object3D<Event>) {
    const state = getRootState(obj);
    // Skip event handling when noEvents is set, or when the raycasters camera is null
    if (!state || !state.events.enabled || state.raycaster.camera === null)
      return [];

    // When the camera is undefined we have to call the event layers update function
    if (state.raycaster.camera === undefined) {
      state.events.compute?.(event, state, state.previousRoot?.getState());
      // If the camera is still undefined we have to skip this layer entirely
      if (state.raycaster.camera === undefined) state.raycaster.camera = null!;
    }

    // Intersect object by object
    return state.raycaster.camera
      ? state.raycaster.intersectObject(obj, true)
      : [];
  }

  // Collect events
  let hits: Intersection<Object3D<Event>>[] = eventsObjects
    // Intersect objects
    .flatMap(handleRaycast)
    // Sort by event priority and distance
    .sort((a, b) => {
      const aState = getRootState(a.object);
      const bState = getRootState(b.object);
      if (!aState || !bState) return a.distance - b.distance;
      return (
        bState.events.priority - aState.events.priority ||
        a.distance - b.distance
      );
    })
    // Filter out duplicates
    .filter((item) => {
      const id = makeId(item as Intersection);
      if (duplicates.has(id)) return false;
      duplicates.add(id);
      return true;
    });

  // https://github.com/mrdoob/js/issues/16031
  // Allow custom userland intersect sort order, this likely only makes sense on the root filter
  if (state.events.filter) hits = state.events.filter(hits, state);

  // Bubble up the events, find the event source (eventObject)
  for (const hit of hits) {
    let eventObject: Object3D | null = hit.object;
    // Bubble event up
    while (eventObject) {
      if ((eventObject as unknown as Instance).__r3f?.eventCount)
        intersections.push({ ...hit, eventObject });
      eventObject = eventObject.parent;
    }
  }

  // If the interaction is captured, make all capturing targets part of the intersect.
  if ("pointerId" in event && state.internal.capturedMap.has(event.pointerId)) {
    for (let captureData of state.internal.capturedMap
      .get(event.pointerId)!
      .values()) {
      if (!duplicates.has(makeId(captureData.intersection)))
        intersections.push(captureData.intersection);
    }
  }
  return intersections;
}