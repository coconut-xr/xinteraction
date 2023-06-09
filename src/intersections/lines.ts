import { Object3D, Quaternion, Raycaster, Vector3 } from "three";
import { EventDispatcher, XIntersection } from "../index.js";
import { traverseUntilInteractable } from "./index.js";

const raycaster = new Raycaster();

export function intersectLinesFromObject(
  from: Object3D,
  fromPosition: Vector3,
  fromRotation: Quaternion,
  linePoints: Array<Vector3>,
  on: Object3D,
  dispatcher: EventDispatcher<Event>,
  filterIntersections?: (
    intersections: Array<XIntersection>
  ) => Array<XIntersection>
): Array<XIntersection> {
  let intersections = traverseUntilInteractable<
    Array<XIntersection>,
    Array<XIntersection>
  >(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) => {
      const intersections: Array<XIntersection> = [];
      let prevAccLineLength = 0;
      for (let i = 1; i < linePoints.length; i++) {
        const start = linePoints[i - 1];
        const end = linePoints[i];

        //transform from local object to world
        raycaster.ray.origin.copy(start).applyMatrix4(from.matrixWorld);
        raycaster.ray.direction.copy(end).applyMatrix4(from.matrixWorld);

        //compute length & normalized direction
        raycaster.ray.direction.sub(raycaster.ray.origin);
        const lineLength = raycaster.ray.direction.length();
        raycaster.ray.direction.divideScalar(lineLength);

        raycaster.far = lineLength;
        const newIntersections = raycaster.intersectObject(object, true);
        for (const newIntersection of newIntersections) {
          newIntersection.distance += prevAccLineLength;
          const duplicateIntersectionIndex = intersections.findIndex(
            ({ object }) => object === newIntersection.object
          );
          if (duplicateIntersectionIndex != -1) {
            //duplicate detected
            continue;
          }
          intersections.push(
            Object.assign(newIntersection, {
              inputDevicePosition: fromPosition.clone(),
              inputDeviceRotation: fromRotation.clone(),
            })
          );
        }
        prevAccLineLength += lineLength;
      }
      return intersections;
    },
    (prev, cur) => prev.concat(cur),
    []
  );
  intersections = filterIntersections?.(intersections) ?? intersections;
  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}
