import {
  Camera,
  Object3D,
  Plane,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { EventDispatcher, XIntersection } from "../index.js";
import { traverseUntilInteractable } from "./index.js";

const raycaster = new Raycaster();

export type XCameraRayIntersection = XIntersection & {
  distanceViewPlane: number;
};

const directionHelper = new Vector3();
const planeHelper = new Plane();

export function intersectRayFromCapturedEvents(
  fromPosition: Vector3,
  fromRotation: Quaternion,
  capturedEvents: Map<Object3D, XIntersection>
): Array<XIntersection> {
  directionHelper.set(0, 0, 1).applyQuaternion(fromRotation);
  return Array.from(capturedEvents).map(([capturedObject, intersection]) => {
    return {
      ...intersection,
      point: directionHelper
        .clone()
        .multiplyScalar(intersection.distance)
        .add(fromPosition),
      inputDevicePosition: fromPosition.clone(),
      inputDeviceRotation: fromRotation.clone(),
      capturedObject,
    };
  });
}

export function intersectRayFromCameraCapturedEvents(
  camera: Camera,
  coords: Vector2,
  capturedEvents: Map<Object3D, XCameraRayIntersection>
): Array<XCameraRayIntersection> {
  raycaster.setFromCamera(coords, camera);
  rayQuaternion.setFromUnitVectors(ZAXIS, raycaster.ray.direction);
  camera.getWorldDirection(directionHelper);
  return Array.from(capturedEvents).map(([capturedObject, intersection]) => {
    //set the plane to the viewPlane + the distance of the prev intersection in the camera distance
    planeHelper.setFromNormalAndCoplanarPoint(
      directionHelper,
      raycaster.ray.origin
    );
    planeHelper.constant -= intersection.distanceViewPlane;

    //find captured intersection point by intersecting the ray to the plane of the camera
    const point = new Vector3();
    raycaster.ray.intersectPlane(planeHelper, point);
    return {
      ...intersection,
      point,
      inputDevicePosition: raycaster.ray.origin.clone(),
      inputDeviceRotation: rayQuaternion.clone(),
      capturedObject,
    };
  });
}

export function intersectRayFromObject(
  fromPosition: Vector3,
  fromRotation: Quaternion,
  on: Object3D,
  dispatcher: EventDispatcher<Event, XIntersection>,
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
  dispatcher: EventDispatcher<Event, XCameraRayIntersection>,
  filterIntersections?: (
    intersections: Array<XCameraRayIntersection>
  ) => Array<XCameraRayIntersection>
): Array<XCameraRayIntersection> {
  raycaster.setFromCamera(coords, from);
  rayQuaternion.setFromUnitVectors(ZAXIS, raycaster.ray.direction);
  planeHelper.setFromNormalAndCoplanarPoint(
    from.getWorldDirection(directionHelper),
    raycaster.ray.origin
  );

  let intersections = traverseUntilInteractable<
    Array<XCameraRayIntersection>,
    Array<XCameraRayIntersection>
  >(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) =>
      raycaster.intersectObject(object, true).map((intersection) =>
        Object.assign(intersection, {
          inputDevicePosition: raycaster.ray.origin.clone(),
          inputDeviceRotation: rayQuaternion.clone(),
          distanceViewPlane: planeHelper.distanceToPoint(intersection.point),
        })
      ),
    (prev, cur) => prev.concat(cur),
    []
  );
  intersections = filterIntersections?.(intersections) ?? intersections;
  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}
