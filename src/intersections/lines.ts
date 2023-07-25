import {
  Line3,
  Matrix4,
  Object3D,
  Plane,
  Quaternion,
  Ray,
  Raycaster,
  Vector3,
} from "three";
import { EventDispatcher, XIntersection } from "../index.js";
import {
  isIntersectionNotClipped,
  computeIntersectionWorldPlane,
  traverseUntilInteractable,
} from "./index.js";
import { ThreeEvent } from "@react-three/fiber";

const raycaster = new Raycaster();

export type XLinesIntersection = XIntersection & {
  lineIndex: number;
  distanceOnLine: number;
};

const lineHelper = new Line3();
const planeHelper = new Plane();

export function intersectLinesFromCapturedEvents(
  from: Object3D,
  fromPosition: Vector3,
  fromRotation: Quaternion,
  linePoints: Array<Vector3>,
  capturedEvents: Map<Object3D, XLinesIntersection>
): Array<XLinesIntersection> {
  const intersections: Array<XLinesIntersection> = [];
  for (const [capturedObject, intersection] of capturedEvents) {
    lineHelper
      .set(
        linePoints[intersection.lineIndex],
        linePoints[intersection.lineIndex + 1]
      )
      .applyMatrix4(from.matrixWorld);

    const point = lineHelper.at(
      intersection.distanceOnLine / lineHelper.distance(),
      new Vector3()
    );
    computeIntersectionWorldPlane(planeHelper, intersection, capturedObject);
    const pointOnFace =
      backwardsIntersectionLinesWithPlane(from, linePoints, planeHelper) ??
      point;

    intersections.push({
      ...intersection,
      intersections,
      pointOnFace,
      point,
      inputDevicePosition: fromPosition.clone(),
      inputDeviceRotation: fromRotation.clone(),
      capturedObject,
    });
  }
  return intersections;
}

const vectorHelper = new Vector3();
const rayHelper = new Ray();

function backwardsIntersectionLinesWithPlane(
  from: Object3D,
  linePoints: Array<Vector3>,
  plane: Plane
): Vector3 | undefined {
  for (let i = linePoints.length - 1; i > 0; i--) {
    const start = linePoints[i - 1];
    const end = linePoints[i];
    rayHelper.origin.copy(start).applyMatrix4(from.matrixWorld);
    rayHelper.direction
      .copy(end)
      .applyMatrix4(from.matrixWorld)
      .sub(raycaster.ray.origin)
      .normalize();
    const point = rayHelper.intersectPlane(plane, vectorHelper);
    if (point != null) {
      return vectorHelper.clone();
    }
  }
  return undefined;
}

const invertedMatrixHelper = new Matrix4();

export function intersectLinesFromObject(
  from: Object3D,
  fromPosition: Vector3,
  fromRotation: Quaternion,
  linePoints: Array<Vector3>,
  on: Object3D,
  dispatcher: EventDispatcher<ThreeEvent<Event>, XLinesIntersection>,
  filterClipped: boolean
): Array<XLinesIntersection> {
  const intersections: Array<XLinesIntersection> = [];

  traverseUntilInteractable(
    on,
    dispatcher.hasEventHandlers.bind(dispatcher),
    (object) => {
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
        const newIntersectionsFromObject = raycaster.intersectObject(
          object,
          true
        );
        for (const newIntersection of newIntersectionsFromObject) {
          if (filterClipped && !isIntersectionNotClipped(newIntersection)) {
            continue;
          }
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
              intersections,
              inputDevicePosition: fromPosition.clone(),
              inputDeviceRotation: fromRotation.clone(),
              lineIndex: i - 1,
              distanceOnLine,
              pointOnFace: newIntersection.point,
              localPoint: newIntersection.point
                .clone()
                .applyMatrix4(
                  invertedMatrixHelper
                    .copy(newIntersection.object.matrixWorld)
                    .invert()
                ),
            })
          );
        }
        prevAccLineLength += lineLength;
      }
    }
  );

  //sort smallest distance first
  return intersections.sort((a, b) => a.distance - b.distance);
}
