import {
  BufferGeometry,
  InstancedMesh,
  Intersection,
  Matrix4,
  Mesh,
  Object3D,
  Vector3,
  Line,
  LineSegments,
  Box3,
  Sphere,
  Triangle,
} from "three";
import { EventDispatcher } from "../index.js";
import { traverseUntilInteractable } from "./index.js";

const collisionSphere = new Sphere();

export function intersectSphereFromObject(
  from: Object3D,
  radius: number,
  intersectDistance: number,
  on: Object3D,
  dispatcher: EventDispatcher<Event>,
  filterIntersections?: (
    intersections: Array<Intersection>
  ) => Array<Intersection>
): Array<Intersection> {
  from.getWorldPosition(collisionSphere.center);
  collisionSphere.radius = radius;
  let intersections = traverseUntilInteractable<
    Array<Intersection>,
    Array<Intersection>
  >(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) => intersectSphereRecursive(object, intersectDistance),
    (prev, cur) => prev.concat(cur),
    []
  );
  intersections = filterIntersections?.(intersections) ?? intersections;
  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}

function intersectSphereRecursive(
  object: Object3D,
  collideDistance: number,
  target: Array<Intersection> = []
): Array<Intersection> {
  const intersections = intersectSphere(object, collideDistance);
  if (Array.isArray(intersections)) {
    target.push(...intersections);
  } else if (intersections != null) {
    target.push(intersections);
  }
  for (const child of object.children) {
    intersectSphereRecursive(child, collideDistance, target);
  }
  return target;
}

const invertedMatrixHelper = new Matrix4();
const matrixHelper = new Matrix4();

function intersectSphere(
  object: Object3D,
  collideDistance: number
): Array<Intersection> | Intersection | undefined {
  object.updateWorldMatrix(true, false);
  if (object instanceof InstancedMesh<BufferGeometry>) {
    object.geometry.computeBoundingSphere();
    object.geometry.computeBoundingBox();
    const intersections: Array<Intersection> = [];
    for (let i = 0; i < object.count; i++) {
      object.getMatrixAt(i, matrixHelper);
      invertedMatrixHelper.copy(matrixHelper);
      invertedMatrixHelper.premultiply(object.matrixWorld);
      if (
        !intersectSphereSphere(
          invertedMatrixHelper,
          object.geometry,
          collideDistance
        )
      ) {
        continue;
      }
      invertedMatrixHelper.invert();
      const intersection = intersectSphereBox(
        object,
        matrixHelper,
        invertedMatrixHelper,
        object.geometry,
        collideDistance,
        i
      );
      if (intersection != null) {
        intersections.push(intersection);
      }
    }
  }
  if (object instanceof Mesh<BufferGeometry>) {
    object.geometry.computeBoundingSphere();
    if (
      !intersectSphereSphere(
        object.matrixWorld,
        object.geometry,
        collideDistance
      )
    ) {
      return undefined;
    }
    object.geometry.computeBoundingBox();
    invertedMatrixHelper.copy(object.matrixWorld).invert();
    return intersectSphereBox(
      object,
      object.matrixWorld,
      invertedMatrixHelper,
      object.geometry,
      collideDistance
    );
  }
  return undefined;
}

const helperSphere = new Sphere();

function intersectSphereSphere(
  matrixWorld: Matrix4,
  geometry: BufferGeometry,
  collideDistance: number
): boolean {
  helperSphere.copy(geometry.boundingSphere!).applyMatrix4(matrixWorld);
  return (
    helperSphere.center.distanceToSquared(collisionSphere.center) <
    (collideDistance + collisionSphere.radius + helperSphere.radius) ** 2
  );
}

const vectorHelper = new Vector3();

function intersectSphereBox(
  object: Object3D,
  matrixWorld: Matrix4,
  invertedMatrixWorld: Matrix4,
  geometry: BufferGeometry,
  collideDistance: number,
  instanceId?: number
): Intersection | undefined {
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
    (helperSphere.radius + collideDistance) ** 2
  ) {
    return undefined;
  }
  const point = vectorHelper.clone();
  return {
    distance: Math.sqrt(distanceToSphereCenterSquared) - helperSphere.radius,
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
