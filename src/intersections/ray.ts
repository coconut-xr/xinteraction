import {
  Camera,
  Euler,
  Object3D,
  Plane,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { EventDispatcher, XIntersection } from "../index.js";
import {
  isIntersectionNotClipped,
  traverseUntilInteractable,
} from "./index.js";
import { ThreeEvent } from "@react-three/fiber";

const raycaster = new Raycaster();

export type XCameraRayIntersection = XIntersection & {
  distanceViewPlane: number;
};

const directionHelper = new Vector3();
const planeHelper = new Plane();

export function intersectRayFromCapturedEvents(
  fromPosition: Vector3,
  fromRotation: Quaternion,
  capturedEvents: Map<Object3D, XIntersection>,
  direction: Vector3
): Array<XIntersection> {
  directionHelper.copy(direction).applyQuaternion(fromRotation);
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
  capturedEvents: Map<Object3D, XCameraRayIntersection>,
  worldPositionTarget: Vector3,
  worldQuaternionTarget: Quaternion
): Array<XCameraRayIntersection> {
  raycaster.setFromCamera(coords, camera);

  camera.getWorldPosition(worldPositionTarget);
  camera.getWorldQuaternion(worldQuaternionTarget);

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
      inputDevicePosition: worldPositionTarget.clone(),
      inputDeviceRotation: worldQuaternionTarget.clone(),
      capturedObject,
    };
  });
}

export function intersectRayFromObject(
  fromPosition: Vector3,
  fromRotation: Quaternion,
  on: Object3D,
  dispatcher: EventDispatcher<ThreeEvent<Event>, XIntersection>,
  filterClipped: boolean,
  direction: Vector3
): Array<XIntersection> {
  raycaster.ray.origin.copy(fromPosition);
  raycaster.ray.direction.copy(direction).applyQuaternion(fromRotation);
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
  if (filterClipped) {
    intersections = intersections.filter(isIntersectionNotClipped);
  }
  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}

export function intersectRayFromCamera(
  from: Camera,
  coords: Vector2,
  on: Object3D,
  dispatcher: EventDispatcher<ThreeEvent<Event>, XCameraRayIntersection>,
  filterClipped: boolean,
  worldPositionTarget: Vector3,
  worldQuaternionTarget: Quaternion
): Array<XCameraRayIntersection> {
  raycaster.setFromCamera(coords, from);

  from.getWorldPosition(worldPositionTarget);
  from.getWorldQuaternion(worldQuaternionTarget);

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
          inputDevicePosition: worldPositionTarget.clone(),
          inputDeviceRotation: worldQuaternionTarget.clone(),
          distanceViewPlane: planeHelper.distanceToPoint(intersection.point),
        })
      ),
    (prev, cur) => prev.concat(cur),
    []
  );
  if (filterClipped) {
    intersections = intersections.filter(isIntersectionNotClipped);
  }
  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}
