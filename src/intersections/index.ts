import { Intersection, Mesh, Object3D, Plane } from "three";

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

export * from "./lines.js";
export * from "./ray.js";
export * from "./sphere.js";
