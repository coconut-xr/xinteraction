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

export function collideSphereFromObject(
  from: Object3D,
  radius: number,
  collideDistance: number,
  on: Object3D,
  dispatcher: EventDispatcher<Event>
): Array<Intersection> {
  from.getWorldPosition(collisionSphere.center);
  collisionSphere.radius = radius;
  const intersections = traverseUntilInteractable<
    Array<Intersection>,
    Array<Intersection>
  >(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) => collideSphereRecursive(object, collideDistance),
    (prev, cur) => prev.concat(cur),
    []
  );
  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}

function collideSphereRecursive(
  object: Object3D,
  collideDistance: number,
  target: Array<Intersection> = []
): Array<Intersection> {
  const intersections = collideSphere(object, collideDistance);
  if (Array.isArray(intersections)) {
    target.push(...intersections);
  } else if (intersections != null) {
    target.push(intersections);
  }
  for (const child of object.children) {
    collideSphereRecursive(child, collideDistance, target);
  }
  return target;
}

const matrixHelper = new Matrix4();

function collideSphere(
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
      matrixHelper.premultiply(object.matrixWorld);
      if (
        !collideSphereSphere(matrixHelper, object.geometry, collideDistance)
      ) {
        continue;
      }
      matrixHelper.invert();
      const intersection = collideSphereBox(
        object,
        matrixHelper,
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
      !collideSphereSphere(object.matrixWorld, object.geometry, collideDistance)
    ) {
      return undefined;
    }
    object.geometry.computeBoundingBox();
    matrixHelper.copy(object.matrixWorld).invert();
    return collideSphereBox(
      object,
      matrixHelper,
      object.geometry,
      collideDistance
    );
  }
  return undefined;
}

const helperSphere = new Sphere();

function collideSphereSphere(
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

function collideSphereBox(
  object: Object3D,
  invertedMatrixWorld: Matrix4,
  geometry: BufferGeometry,
  collideDistance: number,
  instanceId?: number
): Intersection | undefined {
  helperSphere.copy(collisionSphere).applyMatrix4(invertedMatrixWorld);
  geometry.boundingBox!.clampPoint(helperSphere.center, vectorHelper);
  const distanceToSphereCenterSquared = vectorHelper.distanceToSquared(
    helperSphere.center
  );
  if (
    vectorHelper.distanceToSquared(helperSphere.center) >
    (helperSphere.radius + collideDistance) ** 2
  ) {
    return undefined;
  }
  return {
    distance: Math.sqrt(distanceToSphereCenterSquared) - helperSphere.radius,
    object,
    point: vectorHelper.clone(),
    instanceId,
  };
}
