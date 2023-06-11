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
} from "three";
import { EventDispatcher, XIntersection } from "../index.js";
import { traverseUntilInteractable } from "./index.js";

const oldInputDevicePointOffset = new Vector3();
const inputDeviceQuaternionOffset = new Quaternion();

export function intersectSphereFromCapturedEvents(
  fromPosition: Vector3,
  fromRotation: Quaternion,
  capturedEvents: Map<Object3D, XIntersection>
): Array<XIntersection> {
  //events are captured
  return Array.from(capturedEvents.entries()).map(
    ([capturedObject, intersection]) => {
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
      return {
        distance: intersection.distance,
        inputDevicePosition: fromPosition.clone(),
        inputDeviceRotation: fromRotation.clone(),
        object: intersection.object,
        point,
        face: intersection.face,
        capturedObject,
      };
    }
  );
}

const collisionSphere = new Sphere();

export function intersectSphereFromObject(
  fromPosition: Vector3,
  fromQuaternion: Quaternion,
  radius: number,
  on: Object3D,
  dispatcher: EventDispatcher<Event, XIntersection>,
  filterIntersections?: (
    intersections: Array<XIntersection>
  ) => Array<XIntersection>
): Array<XIntersection> {
  collisionSphere.center.copy(fromPosition);
  collisionSphere.radius = radius;
  let intersections = traverseUntilInteractable<
    Array<XIntersection>,
    Array<XIntersection>
  >(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) => intersectSphereRecursive(object, fromQuaternion),
    (prev, cur) => prev.concat(cur),
    []
  );
  intersections = filterIntersections?.(intersections) ?? intersections;
  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}

function intersectSphereRecursive(
  object: Object3D,
  inputDeviceRotation: Quaternion,
  target: Array<XIntersection> = []
): Array<XIntersection> {
  const intersections = intersectSphere(object, inputDeviceRotation);
  if (Array.isArray(intersections)) {
    target.push(...intersections);
  } else if (intersections != null) {
    target.push(intersections);
  }
  for (const child of object.children) {
    intersectSphereRecursive(child, inputDeviceRotation, target);
  }
  return target;
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
  inputDeviceRotation: Quaternion
): Array<XIntersection> | XIntersection | undefined {
  object.updateWorldMatrix(true, false);
  if (isSpherecastable(object)) {
    const intersections: Array<Intersection> = [];
    object.spherecast(collisionSphere, intersections);
    return intersections.map((intersection) => ({
      ...intersection,
      inputDevicePosition: collisionSphere.center.clone(),
      inputDeviceRotation: inputDeviceRotation.clone(),
    }));
  }
  if (object instanceof InstancedMesh) {
    if (object.geometry.boundingSphere == null) {
      object.geometry.computeBoundingSphere();
    }
    if (object.geometry.boundingBox == null) {
      object.geometry.computeBoundingBox();
    }
    const intersections: Array<XIntersection> = [];
    for (let i = 0; i < object.count; i++) {
      object.getMatrixAt(i, matrixHelper);
      invertedMatrixHelper.copy(matrixHelper);
      invertedMatrixHelper.premultiply(object.matrixWorld);
      if (!intersectSphereSphere(invertedMatrixHelper, object.geometry)) {
        continue;
      }
      invertedMatrixHelper.invert();
      const intersection = intersectSphereBox(
        object,
        collisionSphere.center,
        inputDeviceRotation,
        matrixHelper,
        invertedMatrixHelper,
        object.geometry,
        i
      );
      if (intersection != null) {
        intersections.push(intersection);
      }
    }
  }
  if (object instanceof Mesh) {
    if (object.geometry.boundingSphere == null) {
      object.geometry.computeBoundingSphere();
    }
    if (!intersectSphereSphere(object.matrixWorld, object.geometry)) {
      return undefined;
    }
    if (object.geometry.boundingBox == null) {
      object.geometry.computeBoundingBox();
    }
    invertedMatrixHelper.copy(object.matrixWorld).invert();
    return intersectSphereBox(
      object,
      collisionSphere.center,
      inputDeviceRotation,
      object.matrixWorld,
      invertedMatrixHelper,
      object.geometry
    );
  }
  return undefined;
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

function intersectSphereBox(
  object: Object3D,
  inputDevicePosition: Vector3,
  inputDeviceRotation: Quaternion,
  matrixWorld: Matrix4,
  invertedMatrixWorld: Matrix4,
  geometry: BufferGeometry,
  instanceId?: number
): XIntersection | undefined {
  helperSphere.copy(collisionSphere).applyMatrix4(invertedMatrixWorld);
  geometry.boundingBox!.clampPoint(helperSphere.center, vectorHelper);

  const normal = vectorHelper.clone();
  maximizeAxisVector(normal);

  vectorHelper.applyMatrix4(matrixWorld); //world coordinates
  const distanceToSphereCenterSquared = vectorHelper.distanceToSquared(
    collisionSphere.center
  );
  if (
    distanceToSphereCenterSquared >
    helperSphere.radius * helperSphere.radius
  ) {
    return undefined;
  }
  const point = vectorHelper.clone();
  return {
    distance: Math.sqrt(distanceToSphereCenterSquared),
    object,
    face: {
      a: 0,
      b: 0,
      c: 0,
      materialIndex: 0,
      normal,
    },
    point,
    instanceId,
    inputDevicePosition: inputDevicePosition.clone(),
    inputDeviceRotation: inputDeviceRotation.clone(),
  };
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

  if (absZ >= absY && absZ >= absX) {
    //z biggest
    vec.set(0, 0, vec.z < 0 ? -1 : 1);
    return;
  }
}
