import { Line3, Object3D, Quaternion, Raycaster, Vector3 } from "three";
import { EventDispatcher, XIntersection } from "../index.js";
import {
  isIntersectionNotClipped,
  traverseUntilInteractable,
} from "./index.js";

const raycaster = new Raycaster();

export type XLinesIntersection = XIntersection & {
  lineIndex: number;
  distanceOnLine: number;
};

const directionHelper = new Vector3();
const lineHelper = new Line3();

export function intersectLinesFromCapturedEvents(
  from: Object3D,
  fromPosition: Vector3,
  fromRotation: Quaternion,
  linePoints: Array<Vector3>,
  capturedEvents: Map<Object3D, XLinesIntersection>
): Array<XLinesIntersection> {
  return Array.from(capturedEvents).map(([capturedObject, intersection]) => {
    directionHelper.set(0, 0, 1).applyQuaternion(fromRotation);
    lineHelper
      .set(
        linePoints[intersection.lineIndex],
        linePoints[intersection.lineIndex + 1]
      )
      .applyMatrix4(from.matrixWorld);

    const point = lineHelper.at(intersection.distanceOnLine, new Vector3());
    return {
      ...intersection,
      point,
      inputDevicePosition: fromPosition.clone(),
      inputDeviceRotation: fromRotation.clone(),
      capturedObject,
    };
  });
}

export function intersectLinesFromObject(
  from: Object3D,
  fromPosition: Vector3,
  fromRotation: Quaternion,
  linePoints: Array<Vector3>,
  on: Object3D,
  dispatcher: EventDispatcher<Event, XLinesIntersection>,
  filterClipped: boolean
): Array<XLinesIntersection> {
  let intersections = traverseUntilInteractable<
    Array<XLinesIntersection>,
    Array<XLinesIntersection>
  >(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) => {
      const intersections: Array<XLinesIntersection> = [];
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
          const duplicateIntersectionIndex = intersections.findIndex(
            ({ object }) => object === newIntersection.object
          );
          if (duplicateIntersectionIndex != -1) {
            //duplicate detected
            continue;
          }
          const distanceOnLine = newIntersection.distance;
          newIntersection.distance += prevAccLineLength;
          intersections.push(
            Object.assign(newIntersection, {
              inputDevicePosition: fromPosition.clone(),
              inputDeviceRotation: fromRotation.clone(),
              lineIndex: i - 1,
              distanceOnLine,
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

  if (filterClipped) {
    intersections = intersections.filter(isIntersectionNotClipped);
  }

  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}
