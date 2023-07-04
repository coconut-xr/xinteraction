import {
  Camera,
  Euler,
  Matrix4,
  Object3D,
  Plane,
  Quaternion,
  Ray,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { EventDispatcher, XIntersection } from "../index.js";
import {
  computeIntersectionWorldPlane,
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
const rayHelper = new Ray();

export function intersectRayFromCapturedEvents(
  fromPosition: Vector3,
  fromRotation: Quaternion,
  capturedEvents: Map<Object3D, XIntersection>,
  direction: Vector3
): Array<XIntersection> {
  directionHelper.copy(direction).applyQuaternion(fromRotation);
  return Array.from(capturedEvents).map(([capturedObject, intersection]) => {
    rayHelper.set(fromPosition, directionHelper);
    computeIntersectionWorldPlane(planeHelper, intersection, capturedObject);
    const pointOnFace =
      rayHelper.intersectPlane(planeHelper, new Vector3()) ??
      intersection.point;
    return {
      ...intersection,
      pointOnFace,
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
    const point = raycaster.ray.intersectPlane(planeHelper, new Vector3())!;

    computeIntersectionWorldPlane(planeHelper, intersection, capturedObject);
    const pointOnFace =
      raycaster.ray.intersectPlane(planeHelper, new Vector3()) ?? point;
    return {
      ...intersection,
      point,
      pointOnFace,
      inputDevicePosition: worldPositionTarget.clone(),
      inputDeviceRotation: worldQuaternionTarget.clone(),
      capturedObject,
    };
  });
}

const invertedMatrixHelper = new Matrix4();

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
      raycaster.intersectObject(object, true).map((intersection) => {
        invertedMatrixHelper.copy(object.matrixWorld).invert();
        return Object.assign(intersection, {
          inputDevicePosition: fromPosition.clone(),
          inputDeviceRotation: fromRotation.clone(),
          pointOnFace: intersection.point,
          localPoint: intersection.point
            .clone()
            .applyMatrix4(invertedMatrixHelper),
        });
      }),
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
      raycaster.intersectObject(object, true).map((intersection) => {
        invertedMatrixHelper.copy(object.matrixWorld).invert();
        return Object.assign(intersection, {
          pointOnFace: intersection.point,
          inputDevicePosition: worldPositionTarget.clone(),
          inputDeviceRotation: worldQuaternionTarget.clone(),
          distanceViewPlane: planeHelper.distanceToPoint(intersection.point),
          localPoint: intersection.point
            .clone()
            .applyMatrix4(invertedMatrixHelper),
        });
      }),
    (prev, cur) => prev.concat(cur),
    []
  );
  if (filterClipped) {
    intersections = intersections.filter(isIntersectionNotClipped);
  }
  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}
