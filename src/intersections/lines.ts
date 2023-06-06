/*import {
  Box3,
  BufferGeometry,
  InstancedMesh,
  Intersection,
  Line,
  Line3,
  Matrix4,
  Mesh,
  Object3D,
  Vector3,
} from "three";
import { EventDispatcher } from "../index.js";
import { traverseUntilInteractable } from "./index.js";

const currentLines = Array<

export function collideSphereFromObject(
  from: Object3D,
  lines: Array<Vector3>,
  on: Object3D,
  dispatcher: EventDispatcher<{}>
): Array<Intersection> {
  const intersections = traverseUntilInteractable<
    Array<Intersection>,
    Array<Intersection>
  >(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) => {
      const result: Array<Intersection> = [];
      for (let i = 1; i < lines.length; i++) {
        currentLine.set();
      }
      return result;
    },
    (prev, cur) => prev.concat(cur),
    []
  );
  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}

function collideLinesRecursive(
  object: Object3D,
  collideDistance: number,
  target: Array<Intersection>
): Array<Intersection> {
  const intersections = collideSphere(object, collideDistance);
  if (Array.isArray(intersections)) {
    target.push(...intersections);
  } else if (intersections != null) {
    target.push(intersections);
  }
  for (const child of object.children) {
    collideLinesRecursive(child, collideDistance, target);
  }
  return target;
}

const matrixHelper = new Matrix4();

function collideLine(
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
      if (!collideLineSphere(matrixHelper, object.geometry, collideDistance)) {
        continue;
      }
    }
  }
  if (object instanceof Mesh<BufferGeometry>) {
    object.geometry.computeBoundingSphere();
    if (
      !collideLineSphere(object.matrixWorld, object.geometry, collideDistance)
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

function collideLineSphere(
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
*/
