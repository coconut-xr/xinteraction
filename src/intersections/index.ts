import { Intersection, Mesh, Object3D, Plane } from "three";
import { XIntersection } from "../index.js";

export function traverseUntilInteractable<T, R>(
  object: Object3D,
  isInteractable: (object: Object3D) => boolean,
  callback: (object: Object3D) => T,
  reduce: (prev: R, value: T) => R,
  initial: R
): R {
  if (isInteractable(object)) {
    return reduce(initial, callback(object));
  }
  let current = initial;
  for (const child of object.children) {
    current = traverseUntilInteractable(
      child,
      isInteractable,
      callback,
      reduce,
      current
    );
  }
  return current;
}

export function isIntersectionNotClipped(intersection: Intersection): boolean {
  if (
    !(intersection.object instanceof Mesh) ||
    intersection.object.material.clippingPlanes == null
  ) {
    return true;
  }
  const planes = intersection.object.material.clippingPlanes as Array<Plane>;
  for (const plane of planes) {
    if (plane.distanceToPoint(intersection.point) < 0) {
      return false;
    }
  }
  return true;
}

export function computeIntersectionWorldPlane(
  plane: Plane,
  intersection: XIntersection,
  object: Object3D
): boolean {
  if (intersection.face == null) {
    return false;
  }
  plane.setFromNormalAndCoplanarPoint(
    intersection.face.normal,
    intersection.localPoint
  );
  plane.applyMatrix4(object.matrixWorld);
  return true;
}

export * from "./lines.js";
export * from "./ray.js";
export * from "./sphere.js";
