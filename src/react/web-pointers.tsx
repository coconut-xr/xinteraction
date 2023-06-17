import { RootState, ThreeEvent, useStore, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { EventTranslator, XIntersection, isDragDefault } from "../index.js";
import { R3FEventDispatcher } from "./index.js";
import { Vector2, Event, Vector3, Quaternion } from "three";
import {
  XCameraRayIntersection,
  intersectRayFromCamera,
  intersectRayFromCameraCapturedEvents,
} from "../intersections/ray.js";
import { StoreApi } from "zustand";

type PointerMapEntry = {
  translator: EventTranslator<PointerEvent, XCameraRayIntersection>;
  pressedInputDeviceElements: Set<number>;
  customIsDrag?: (i1: XIntersection, i2: XIntersection) => boolean;
  filterClipped: boolean;
};

export function XWebPointers({
  onIntersections,
  filterIntersections,
  onClickMissed,
  onPointerDownMissed,
  onPointerUpMissed,
  isDrag: customIsDrag,
  filterClipped = true,
}: {
  onIntersections?: (
    id: number,
    intersections: ReadonlyArray<XCameraRayIntersection>
  ) => void;
  filterIntersections?: (
    intersections: Array<XCameraRayIntersection>
  ) => Array<XCameraRayIntersection>;
  onPointerDownMissed?: (event: ThreeEvent<Event>) => void;
  onPointerUpMissed?: (event: ThreeEvent<Event>) => void;
  onClickMissed?: (event: ThreeEvent<Event>) => void;
  isDrag?: (i1: XIntersection, i2: XIntersection) => boolean;
  filterClipped?: boolean;
}) {
  const pointerMap = useMemo(() => new Map<number, PointerMapEntry>(), []);

  const store = useStore();

  const dispatcher = useMemo(
    () => new R3FEventDispatcher<XCameraRayIntersection>(),
    []
  );
  dispatcher.onPointerDownMissed = onPointerDownMissed;
  dispatcher.onPointerUpMissed = onPointerUpMissed;
  dispatcher.onClickMissed = onClickMissed;

  //update properties for all pointers
  for (const [pointerId, entry] of pointerMap) {
    entry.translator.onIntersections = onIntersections?.bind(null, pointerId);
    entry.translator.filterIntersections = filterIntersections;
    entry.customIsDrag = customIsDrag;
    entry.filterClipped = filterClipped;
  }

  const canvas = useThree(({ gl }) => gl.domElement);
  useEffect(() => {
    const getOrCreate = (id: number) =>
      getOrCreatePointerMapEntry(pointerMap, store, dispatcher, id);
    const pointercancel = (event: PointerEvent) => {
      const { translator } = getOrCreate(event.pointerId);
      translator.cancel(event);
    };
    const pointerdown = (event: PointerEvent) => {
      const { pressedInputDeviceElements, translator } = getOrCreate(
        event.pointerId
      );
      updatePressedButtons(event.buttons, pressedInputDeviceElements);
      translator.update(event, false, true, event.button);
    };
    const pointerup = (event: PointerEvent) => {
      const { pressedInputDeviceElements, translator } = getOrCreate(
        event.pointerId
      );
      updatePressedButtons(event.buttons, pressedInputDeviceElements);
      translator.update(event, false, true);
    };
    const pointerover = (event: PointerEvent) => {
      const { translator, pressedInputDeviceElements } = getOrCreate(
        event.pointerId
      );
      updatePressedButtons(event.buttons, pressedInputDeviceElements);
      translator.update(event, true, true, event.button);
    };
    const pointermove = (event: PointerEvent) => {
      const { translator } = getOrCreate(event.pointerId);
      translator.update(event, true, false);
    };
    const wheel = (event: WheelEvent) => {
      for (const { translator } of pointerMap.values()) {
        translator.wheel(event as any);
      }
    };
    const pointerout = (event: PointerEvent) => {
      const { translator } = getOrCreate(event.pointerId);
      translator.leave(event);
      pointerMap.delete(event.pointerId);
    };
    const blur = (event: any) => {
      for (const { translator } of pointerMap.values()) {
        translator.leave(event);
      }
      pointerMap.clear();
    };

    canvas.addEventListener("pointercancel", pointercancel);
    canvas.addEventListener("pointerdown", pointerdown);
    canvas.addEventListener("pointerup", pointerup);
    canvas.addEventListener("pointerover", pointerover);
    canvas.addEventListener("pointerout", pointerout);
    canvas.addEventListener("pointermove", pointermove);
    canvas.addEventListener("wheel", wheel);
    canvas.addEventListener("blur", blur);

    return () => {
      canvas.removeEventListener("pointercancel", pointercancel);
      canvas.removeEventListener("pointerdown", pointerdown);
      canvas.removeEventListener("pointerup", pointerup);
      canvas.removeEventListener("pointerover", pointerover);
      canvas.removeEventListener("pointerout", pointerout);
      canvas.removeEventListener("pointermove", pointermove);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("blur", blur);
    };
  }, [canvas, store]);

  return null;
}

function updatePressedButtons(
  buttons: number,
  pressedInputDeviceElements: Set<number>
) {
  let value = 1;

  //5 buttons can be expected https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
  for (let i = 0; i < 5; i++) {
    const inputDeviceElementActive = (value & buttons) > 0;
    if (inputDeviceElementActive) {
      pressedInputDeviceElements.add(i);
    } else {
      pressedInputDeviceElements.delete(i);
    }
    value *= 2;
  }
}

function getOrCreatePointerMapEntry(
  pointerMap: Map<number, PointerMapEntry>,
  store: StoreApi<RootState>,
  dispatcher: R3FEventDispatcher<XCameraRayIntersection>,
  pointerId: number
): PointerMapEntry {
  let entry = pointerMap.get(pointerId);
  if (entry == null) {
    pointerMap.set(
      pointerId,
      (entry = createPointerMapEntry(pointerId, store, dispatcher))
    );
  }
  return entry;
}

const emptyIntersection: Array<XCameraRayIntersection> = [];

function createPointerMapEntry(
  pointerId: number,
  store: StoreApi<RootState>,
  dispatcher: R3FEventDispatcher<XCameraRayIntersection>
): PointerMapEntry {
  const lastWorldPosition = new Vector3();
  const lastWorldRotation = new Quaternion();
  const pointerMapEntry: PointerMapEntry = {
    filterClipped: true,
    pressedInputDeviceElements: new Set<number>(),
    translator: new EventTranslator<PointerEvent, XCameraRayIntersection>(
      pointerId,
      false,
      dispatcher,
      (event, capturedEvents) => {
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
              pointerMapEntry.filterClipped,
              lastWorldPosition,
              lastWorldRotation
            )
          : intersectRayFromCameraCapturedEvents(
              camera,
              coords,
              capturedEvents,
              lastWorldPosition,
              lastWorldRotation
            );
      },
      () => pointerMapEntry.pressedInputDeviceElements,
      (i1, i2) =>
        pointerMapEntry.customIsDrag == null
          ? isDragDefault(store.getState().camera, i1, i2)
          : pointerMapEntry.customIsDrag(i1, i2),
      (position, rotation) => {
        position.copy(lastWorldPosition);
        rotation.copy(lastWorldRotation);
      }
    ),
  };
  return pointerMapEntry;
}
