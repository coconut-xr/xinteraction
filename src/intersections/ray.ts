import { Camera, Intersection, Object3D, Raycaster, Vector2 } from "three";
import { EventDispatcher } from "../index.js";
import { traverseUntilInteractable } from "./index.js";

const raycaster = new Raycaster();

export function intersectRayFromObject(
  from: Object3D,
  on: Object3D,
  dispatcher: EventDispatcher<Event>,
  filterIntersections?: (
    intersections: Array<Intersection>
  ) => Array<Intersection>
): Array<Intersection> {
  from.getWorldPosition(raycaster.ray.origin);
  from.getWorldDirection(raycaster.ray.direction);
  let intersections = traverseUntilInteractable<
    Array<Intersection>,
    Array<Intersection>
  >(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) => raycaster.intersectObject(object, true),
    (prev, cur) => prev.concat(cur),
    []
  );
  intersections = filterIntersections?.(intersections) ?? intersections;
  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}

export function intersectRayFromCamera(
  from: Camera,
  coords: Vector2,
  on: Object3D,
  dispatcher: EventDispatcher<Event>,
  filterIntersections?: (
    intersections: Array<Intersection>
  ) => Array<Intersection>
): Array<Intersection> {
  raycaster.setFromCamera(coords, from);
  let intersections = traverseUntilInteractable<
    Array<Intersection>,
    Array<Intersection>
  >(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) => raycaster.intersectObject(object, true),
    (prev, cur) => prev.concat(cur),
    []
  );
  intersections = filterIntersections?.(intersections) ?? intersections;
  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}
