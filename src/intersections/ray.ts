import {
  Camera,
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
  const intersections: Array<XIntersection> = [];
  for (const [capturedObject, intersection] of capturedEvents) {
    rayHelper.set(fromPosition, directionHelper);
    computeIntersectionWorldPlane(planeHelper, intersection, capturedObject);
    const pointOnFace =
      rayHelper.intersectPlane(planeHelper, new Vector3()) ??
      intersection.point;
    intersections.push({
      ...intersection,
      intersections,
      pointOnFace,
      point: directionHelper
        .clone()
        .multiplyScalar(intersection.distance)
        .add(fromPosition),
      inputDevicePosition: fromPosition.clone(),
      inputDeviceRotation: fromRotation.clone(),
      capturedObject,
    });
  }
  return intersections;
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
  const intersections: Array<XCameraRayIntersection> = [];
  for (const [capturedObject, intersection] of capturedEvents) {
    //set the plane to the viewPlane + the distance of the prev intersection in the camera distance
    planeHelper.setFromNormalAndCoplanarPoint(
      directionHelper,
      raycaster.ray.origin
    );
    planeHelper.constant -= intersection.distanceViewPlane;

    //find captured intersection point by intersecting the ray to the plane of the camera
    const point = raycaster.ray.intersectPlane(planeHelper, new Vector3());

    if (point == null) {
      continue;
    }

    computeIntersectionWorldPlane(planeHelper, intersection, capturedObject);
    const pointOnFace =
      raycaster.ray.intersectPlane(planeHelper, new Vector3()) ?? point;
    intersections.push({
      ...intersection,
      intersections,
      point,
      pointOnFace,
      inputDevicePosition: worldPositionTarget.clone(),
      inputDeviceRotation: worldQuaternionTarget.clone(),
      capturedObject,
    });
  }
  return intersections;
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
  const intersections: Array<XIntersection> = [];
  traverseUntilInteractable(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) => {
      const newIntersections = raycaster.intersectObject(object, true);
      for (const newIntersection of newIntersections) {
        if (filterClipped && !isIntersectionNotClipped(newIntersection)) {
          continue;
        }
        invertedMatrixHelper.copy(object.matrixWorld).invert();
        intersections.push(
          Object.assign(newIntersection, {
            intersections,
            inputDevicePosition: fromPosition.clone(),
            inputDeviceRotation: fromRotation.clone(),
            pointOnFace: newIntersection.point,
            localPoint: newIntersection.point
              .clone()
              .applyMatrix4(invertedMatrixHelper),
          })
        );
      }
    }
  );
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

  const intersections: Array<XCameraRayIntersection> = [];
  traverseUntilInteractable(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) => {
      const newIntersections = raycaster.intersectObject(object, true);

      for (const newIntersection of newIntersections) {
        if (filterClipped && !isIntersectionNotClipped(newIntersection)) {
          continue;
        }
        invertedMatrixHelper.copy(object.matrixWorld).invert();
        intersections.push(
          Object.assign(newIntersection, {
            intersections,
            pointOnFace: newIntersection.point,
            inputDevicePosition: worldPositionTarget.clone(),
            inputDeviceRotation: worldQuaternionTarget.clone(),
            distanceViewPlane: planeHelper.distanceToPoint(
              newIntersection.point
            ),
            localPoint: newIntersection.point
              .clone()
              .applyMatrix4(invertedMatrixHelper),
          })
        );
      }
    }
  );
  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}
