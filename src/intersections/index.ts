import { Object3D } from "three";

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
