import { Camera, Intersection, Object3D, Raycaster, Vector2 } from "three";
import { EventDispatcher } from "../index.js";
import { traverseUntilInteractable } from "./index.js";

const raycaster = new Raycaster();

export function raycastFromObject(
  from: Object3D,
  on: Object3D,
  dispatcher: EventDispatcher<Event>
): Array<Intersection> {
  from.getWorldPosition(raycaster.ray.origin);
  from.getWorldDirection(raycaster.ray.direction);
  return traverseUntilInteractable<Array<Intersection>, Array<Intersection>>(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) => raycaster.intersectObject(object, true),
    (prev, cur) => prev.concat(cur),
    []
  );
}

export function raycastFromCamera(
  from: Camera,
  coords: Vector2,
  on: Object3D,
  dispatcher: EventDispatcher<Event>
): Array<Intersection> {
  raycaster.setFromCamera(coords, from);
  return traverseUntilInteractable<Array<Intersection>, Array<Intersection>>(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) => raycaster.intersectObject(object, true),
    (prev, cur) => prev.concat(cur),
    []
  );
}
