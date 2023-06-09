import {
  Camera,
  Object3D,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { EventDispatcher, XIntersection } from "../index.js";
import { traverseUntilInteractable } from "./index.js";

const raycaster = new Raycaster();

export function intersectRayFromObject(
  fromPosition: Vector3,
  fromRotation: Quaternion,
  on: Object3D,
  dispatcher: EventDispatcher<Event>,
  filterIntersections?: (
    intersections: Array<XIntersection>
  ) => Array<XIntersection>
): Array<XIntersection> {
  raycaster.ray.origin.copy(fromPosition);
  raycaster.ray.direction.set(0, 0, 1).applyQuaternion(fromRotation);
  let intersections = traverseUntilInteractable<
    Array<XIntersection>,
    Array<XIntersection>
  >(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) =>
      raycaster.intersectObject(object, true).map((intersection) =>
        Object.assign(intersection, {
          inputDevicePosition: fromPosition.clone(),
          inputDeviceRotation: fromRotation.clone(),
        })
      ),
    (prev, cur) => prev.concat(cur),
    []
  );
  intersections = filterIntersections?.(intersections) ?? intersections;
  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}

const rayQuaternion = new Quaternion();
const ZAXIS = new Vector3();

export function intersectRayFromCamera(
  from: Camera,
  coords: Vector2,
  on: Object3D,
  dispatcher: EventDispatcher<Event>,
  filterIntersections?: (
    intersections: Array<XIntersection>
  ) => Array<XIntersection>
): Array<XIntersection> {
  raycaster.setFromCamera(coords, from);
  rayQuaternion.setFromUnitVectors(ZAXIS, raycaster.ray.direction);

  let intersections = traverseUntilInteractable<
    Array<XIntersection>,
    Array<XIntersection>
  >(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) =>
      raycaster.intersectObject(object, true).map((intersection) =>
        Object.assign(intersection, {
          inputDevicePosition: raycaster.ray.origin.clone(),
          inputDeviceRotation: rayQuaternion.clone(),
        })
      ),
    (prev, cur) => prev.concat(cur),
    []
  );
  intersections = filterIntersections?.(intersections) ?? intersections;
  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}
