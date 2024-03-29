import {
  BufferGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Vector3,
  Sphere,
  Quaternion,
  Intersection,
  Plane,
} from "three";
import { EventDispatcher, XIntersection } from "../index.js";
import {
  computeIntersectionWorldPlane,
  isIntersectionNotClipped,
  isPointNotClipped,
  traverseUntilInteractable,
} from "./index.js";
import { ThreeEvent } from "@react-three/fiber";

const oldInputDevicePointOffset = new Vector3();
const inputDeviceQuaternionOffset = new Quaternion();
const planeHelper = new Plane();

export type XSphereIntersection = XIntersection & {
  /**
   * set when the event is captured because the "distance" property is only the distance to a "expected intersection"
   */
  distanceToFace?: number;
};

export function intersectSphereFromCapturedEvents(
  fromPosition: Vector3,
  fromRotation: Quaternion,
  capturedEvents: Map<Object3D, XSphereIntersection>
): Array<XSphereIntersection> {
  //events are captured
  const intersections: Array<XSphereIntersection> = [];

  for (const [capturedObject, intersection] of capturedEvents) {
    //compute old inputDevicePosition-point offset
    oldInputDevicePointOffset
      .copy(intersection.point)
      .sub(intersection.inputDevicePosition);
    //compute oldInputDeviceQuaternion-newInputDeviceQuaternion offset
    inputDeviceQuaternionOffset
      .copy(intersection.inputDeviceRotation)
      .invert()
      .multiply(fromRotation);
    //apply quaternion offset to old inputDevicePosition-point offset and add to new inputDevicePosition
    const point = oldInputDevicePointOffset
      .clone()
      .applyQuaternion(inputDeviceQuaternionOffset)
      .add(fromPosition);

    computeIntersectionWorldPlane(planeHelper, intersection, capturedObject);

    const pointOnFace = planeHelper.projectPoint(fromPosition, new Vector3());

    intersections.push({
      distance: intersection.distance,
      intersections,
      inputDevicePosition: fromPosition.clone(),
      inputDeviceRotation: fromRotation.clone(),
      object: intersection.object,
      point,
      pointOnFace,
      face: intersection.face,
      capturedObject,
      distanceToFace: pointOnFace.distanceTo(fromPosition),
      localPoint: intersection.localPoint,
    });
  }

  return intersections;
}

const collisionSphere = new Sphere();

export function intersectSphereFromObject(
  fromPosition: Vector3,
  fromQuaternion: Quaternion,
  radius: number,
  on: Object3D,
  dispatcher: EventDispatcher<ThreeEvent<Event>, XSphereIntersection>,
  filterClipped: boolean
): Array<XSphereIntersection> {
  collisionSphere.center.copy(fromPosition);
  collisionSphere.radius = radius;

  const intersections: Array<XSphereIntersection> = [];

  traverseUntilInteractable(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) =>
      intersectSphereRecursive(
        object,
        fromQuaternion,
        filterClipped,
        intersections
      )
  );
  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}

function intersectSphereRecursive(
  object: Object3D,
  inputDeviceRotation: Quaternion,
  filterClipped: boolean,
  allIntersections: Array<XSphereIntersection>
): void {
  intersectSphere(object, inputDeviceRotation, filterClipped, allIntersections);
  for (const child of object.children) {
    intersectSphereRecursive(
      child,
      inputDeviceRotation,
      filterClipped,
      allIntersections
    );
  }
}

const invertedMatrixHelper = new Matrix4();
const matrixHelper = new Matrix4();

function isSpherecastable(obj: Object3D): obj is Object3D & {
  spherecast(sphere: Sphere, intersects: Intersection[]): void;
} {
  return "spherecast" in obj;
}

function intersectSphere(
  object: Object3D,
  inputDeviceRotation: Quaternion,
  filterClipped: boolean,
  intersections: Array<XSphereIntersection>
): void {
  object.updateWorldMatrix(true, false);
  if (isSpherecastable(object)) {
    const newIntersections: Array<Intersection> = [];
    object.spherecast(collisionSphere, newIntersections);
    for (const newIntersection of newIntersections) {
      if (filterClipped && !isIntersectionNotClipped(newIntersection)) {
        continue;
      }
      intersections.push({
        ...newIntersection,
        pointOnFace: newIntersection.point,
        intersections: intersections,
        inputDevicePosition: collisionSphere.center.clone(),
        inputDeviceRotation: inputDeviceRotation.clone(),
        localPoint: newIntersection.point
          .clone()
          .applyMatrix4(
            invertedMatrixHelper
              .copy(newIntersection.object.matrixWorld)
              .invert()
          ),
      });
    }
  }
  if (object instanceof InstancedMesh) {
    if (object.geometry.boundingSphere == null) {
      object.geometry.computeBoundingSphere();
    }
    if (object.geometry.boundingBox == null) {
      object.geometry.computeBoundingBox();
    }
    const intersections: Array<XSphereIntersection> = [];
    for (let i = 0; i < object.count; i++) {
      object.getMatrixAt(i, matrixHelper);
      matrixHelper.premultiply(object.matrixWorld);
      if (!intersectSphereSphere(matrixHelper, object.geometry)) {
        continue;
      }

      invertedMatrixHelper.copy(matrixHelper).invert();
      intersectSphereBox(
        object,
        collisionSphere.center,
        inputDeviceRotation,
        matrixHelper,
        invertedMatrixHelper,
        object.geometry,
        filterClipped,
        intersections
      );
    }
  }

  if (!(object instanceof Mesh)) {
    return;
  }
  if (object.geometry.boundingSphere == null) {
    object.geometry.computeBoundingSphere();
  }
  if (!intersectSphereSphere(object.matrixWorld, object.geometry)) {
    return;
  }
  if (object.geometry.boundingBox == null) {
    object.geometry.computeBoundingBox();
  }

  invertedMatrixHelper.copy(object.matrixWorld).invert();

  intersectSphereBox(
    object,
    collisionSphere.center,
    inputDeviceRotation,
    object.matrixWorld,
    invertedMatrixHelper,
    object.geometry,
    filterClipped,
    intersections
  );
}

const helperSphere = new Sphere();

function intersectSphereSphere(
  matrixWorld: Matrix4,
  geometry: BufferGeometry
): boolean {
  helperSphere.copy(geometry.boundingSphere!).applyMatrix4(matrixWorld);
  return (
    helperSphere.center.distanceToSquared(collisionSphere.center) <
    (collisionSphere.radius + helperSphere.radius) ** 2
  );
}

const vectorHelper = new Vector3();

const boxSizeHelper = new Vector3();
const boxCenterHelper = new Vector3();

const vec0_0001 = new Vector3(0.0001, 0.0001, 0.0001);

function intersectSphereBox(
  object: Object3D,
  inputDevicePosition: Vector3,
  inputDeviceRotation: Quaternion,
  matrixWorld: Matrix4,
  invertedMatrixWorld: Matrix4,
  geometry: BufferGeometry,
  filterClipped: boolean,
  intersections: Array<XSphereIntersection>,
  instanceId?: number
): void {
  helperSphere.copy(collisionSphere).applyMatrix4(invertedMatrixWorld);

  geometry.boundingBox!.getSize(boxSizeHelper);
  geometry.boundingBox!.getCenter(boxCenterHelper);

  geometry.boundingBox!.clampPoint(helperSphere.center, vectorHelper);

  vectorHelper.applyMatrix4(matrixWorld); //world coordinates
  const distanceToSphereCenterSquared = vectorHelper.distanceToSquared(
    collisionSphere.center
  );
  if (
    distanceToSphereCenterSquared >
    collisionSphere.radius * collisionSphere.radius
  ) {
    return;
  }

  boxSizeHelper.max(vec0_0001);
  const normal = helperSphere.center.clone().sub(boxCenterHelper);

  normal.divide(boxSizeHelper);
  maximizeAxisVector(normal);

  const point = vectorHelper.clone();

  if (filterClipped && !isPointNotClipped(object, point)) {
    return;
  }

  intersections.push({
    intersections,
    distance: Math.sqrt(distanceToSphereCenterSquared),
    object,
    face: {
      a: 0,
      b: 0,
      c: 0,
      materialIndex: 0,
      normal,
    },
    pointOnFace: point,
    point,
    instanceId,
    inputDevicePosition: inputDevicePosition.clone(),
    inputDeviceRotation: inputDeviceRotation.clone(),
    localPoint: point.clone().applyMatrix4(invertedMatrixWorld),
  });
}

function maximizeAxisVector(vec: Vector3): void {
  const absX = Math.abs(vec.x);
  const absY = Math.abs(vec.y);
  const absZ = Math.abs(vec.z);
  if (absX >= absY && absX >= absZ) {
    //x biggest
    vec.set(vec.x < 0 ? -1 : 1, 0, 0);
    return;
  }

  if (absY >= absX && absY >= absZ) {
    //y biggest
    vec.set(0, vec.y < 0 ? -1 : 1, 0);
    return;
  }

  //z biggest
  vec.set(0, 0, vec.z < 0 ? -1 : 1);
}
