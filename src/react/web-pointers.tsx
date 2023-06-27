import { RootState, ThreeEvent, useStore, useThree } from "@react-three/fiber";
import { Object3D, Quaternion, Vector2, Vector3, Event } from "three";
import { StoreApi } from "zustand";
import {
  XCameraRayIntersection,
  intersectRayFromCamera,
  intersectRayFromCameraCapturedEvents,
} from "../intersections/ray.js";
import { EventDispatcher } from "../index.js";
import { useForwardEvents } from "./forward-events.js";
import { MutableRefObject, useEffect, useMemo, useRef } from "react";

const emptyIntersection: Array<XCameraRayIntersection> = [];

function isDrag(
  distanceRef: MutableRefObject<number | undefined>,
  downEvent: PointerEvent,
  currentEvent: PointerEvent
): boolean {
  if (distanceRef.current == null) {
    return false;
  }
  const distanceSquared = distanceRef.current * distanceRef.current;
  const distanceX = downEvent.offsetX - currentEvent.offsetX;
  const distanceY = downEvent.offsetY - currentEvent.offsetY;
  return distanceX * distanceX + distanceY * distanceY > distanceSquared;
}

export function XWebPointers({
  filterClipped,
  filterIntersections,
  onClickMissed,
  onIntersections,
  onPointerDownMissed,
  onPointerUpMissed,
  dragDistance,
}: {
  onIntersections?: (
    id: number,
    intersections: ReadonlyArray<XCameraRayIntersection>
  ) => void;
  filterIntersections?: (
    id: number,
    intersections: Array<XCameraRayIntersection>
  ) => Array<XCameraRayIntersection>;
  onPointerDownMissed?: (event: ThreeEvent<Event>) => void;
  onPointerUpMissed?: (event: ThreeEvent<Event>) => void;
  onClickMissed?: (event: ThreeEvent<Event>) => void;
  filterClipped?: boolean;
  dragDistance?: number;
}) {
  const store = useStore();
  const canvas = useThree(({ gl }) => gl.domElement);
  const intersections = useMemo(
    () => computeIntersections.bind(null, store),
    [store]
  );
  const ref = useRef(dragDistance);
  ref.current = dragDistance;
  const eventFunctions = useForwardEvents<PointerEvent, XCameraRayIntersection>(
    intersections,
    isDrag.bind(null, ref),
    onIntersections,
    filterIntersections,
    onPointerDownMissed,
    onPointerUpMissed,
    onClickMissed,
    startCaptureEvents,
    endCaptureEvents,
    filterClipped
  );
  useEffect(() => {
    const pointerCancel = (e: PointerEvent) =>
      eventFunctions.cancel(e.pointerId, e);
    const pointerDown = (e: PointerEvent) =>
      eventFunctions.press(e.pointerId, e, e.button);
    const pointerUp = (e: PointerEvent) =>
      eventFunctions.release(e.pointerId, e, e.button);
    const pointerOver = (e: PointerEvent) =>
      eventFunctions.enter(e.pointerId, e);
    const pointerOut = (e: PointerEvent) =>
      eventFunctions.leave(e.pointerId, e);
    const pointerMove = (e: PointerEvent) =>
      eventFunctions.move(e.pointerId, e);

    canvas.addEventListener("pointercancel", pointerCancel);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointerover", pointerOver);
    canvas.addEventListener("pointerout", pointerOut);
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("wheel", eventFunctions.wheel as any);
    canvas.addEventListener("blur", eventFunctions.blur as any);

    return () => {
      canvas.removeEventListener("pointercancel", pointerCancel);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointerover", pointerOver);
      canvas.removeEventListener("pointerout", pointerOut);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("wheel", eventFunctions.wheel as any);
      canvas.removeEventListener("blur", eventFunctions.blur as any);
    };
  }, [canvas, eventFunctions]);
  return null;
}

function computeIntersections(
  store: StoreApi<RootState>,
  event: PointerEvent,
  capturedEvents: Map<Object3D, XCameraRayIntersection> | undefined,
  filterClipped: boolean,
  dispatcher: EventDispatcher<ThreeEvent<Event>, XCameraRayIntersection>,
  targetWorldPosition: Vector3,
  targetWorldQuaternion: Quaternion
) {
  if (!(event.target instanceof HTMLCanvasElement)) {
    return emptyIntersection;
  }
  const { camera, scene, size } = store.getState();
  const coords = new Vector2(
    (event.offsetX / size.width) * 2 - 1,
    -(event.offsetY / size.height) * 2 + 1
  );
  return capturedEvents == null
    ? intersectRayFromCamera(
        camera,
        coords,
        scene,
        dispatcher,
        filterClipped,
        targetWorldPosition,
        targetWorldQuaternion
      )
    : intersectRayFromCameraCapturedEvents(
        camera,
        coords,
        capturedEvents as any as Map<Object3D, XCameraRayIntersection>,
        targetWorldPosition,
        targetWorldQuaternion
      );
}

function startCaptureEvents(pointerId: number, event: PointerEvent) {
  if (!(event.target instanceof HTMLCanvasElement)) {
    return;
  }
  event.target.setPointerCapture(pointerId);
}

function endCaptureEvents(pointerId: number, event: PointerEvent) {
  if (!(event.target instanceof HTMLCanvasElement)) {
    return;
  }
  event.target.releasePointerCapture(pointerId);
}
