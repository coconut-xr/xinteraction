import { RootState, useStore, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { EventTranslator, XIntersection } from "../index.js";
import { R3FEventDispatcher } from "./index.js";
import { Vector2 } from "three";
import {
  XCameraRayIntersection,
  intersectRayFromCamera,
  intersectRayFromCameraCapturedEvents,
} from "../intersections/ray.js";

type PointerMapEntry = {
  translator: EventTranslator<PointerEvent, XCameraRayIntersection>;
  pressedInputDeviceElements: Set<number>;
};

export function XWebPointers({
  onIntersections,
  filterIntersections,
}: {
  onIntersections?: (
    id: number,
    intersections: Array<XCameraRayIntersection>
  ) => void;
  filterIntersections?: (
    intersections: Array<XCameraRayIntersection>
  ) => Array<XCameraRayIntersection>;
}) {
  const canvas = useThree(({ gl }) => gl.domElement);
  const pointerMap = useMemo(() => new Map<number, PointerMapEntry>(), []);

  const store = useStore();

  useEffect(() => {
    const getOrCreate = getOrCreatePointerMapEntry.bind(null, pointerMap, () =>
      store.getState()
    );
    const pointercancel = (event: PointerEvent) => {
      const { translator } = getOrCreate(event.pointerId, filterIntersections);
      translator.cancel(event);
    };
    const pointerdown = (event: PointerEvent) => {
      const { pressedInputDeviceElements, translator } = getOrCreate(
        event.pointerId,
        filterIntersections
      );
      updatePressedButtons(event.buttons, pressedInputDeviceElements);
      translator.update(event, false, true, event.button);
    };
    const pointerup = (event: PointerEvent) => {
      const { pressedInputDeviceElements, translator } = getOrCreate(
        event.pointerId,
        filterIntersections
      );
      updatePressedButtons(event.buttons, pressedInputDeviceElements);
      translator.update(event, false, true);
    };
    const pointerover = (event: PointerEvent) => {
      const { translator, pressedInputDeviceElements } = getOrCreate(
        event.pointerId,
        filterIntersections
      );
      updatePressedButtons(event.buttons, pressedInputDeviceElements);
      translator.update(event, true, true);
      onIntersections?.(event.pointerId, translator.intersections);
    };
    const pointermove = (event: PointerEvent) => {
      const { translator } = getOrCreate(event.pointerId, filterIntersections);
      translator.update(event, true, false);
      onIntersections?.(event.pointerId, translator.intersections);
    };
    const wheel = (event: WheelEvent) => {
      for (const { translator } of pointerMap.values()) {
        translator.wheel(event as any);
      }
    };
    const pointerout = (event: PointerEvent) => {
      const { translator } = getOrCreate(event.pointerId, filterIntersections);
      translator.leave(event);
      pointerMap.delete(event.pointerId);
      onIntersections?.(event.pointerId, emptyIntersection);
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
  }, [canvas, filterIntersections, store]);

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
  getState: () => RootState,
  pointerId: number,
  filterIntersections:
    | ((
        intersections: Array<XCameraRayIntersection>
      ) => Array<XCameraRayIntersection>)
    | undefined
): PointerMapEntry {
  let entry = pointerMap.get(pointerId);
  if (entry == null) {
    pointerMap.set(
      pointerId,
      (entry = createPointerMapEntry(pointerId, getState, filterIntersections))
    );
  }
  return entry;
}

const emptyIntersection: Array<XCameraRayIntersection> = [];

function createPointerMapEntry(
  pointerId: number,
  getState: () => RootState,
  filterIntersections:
    | ((
        intersections: Array<XCameraRayIntersection>
      ) => Array<XCameraRayIntersection>)
    | undefined
): PointerMapEntry {
  const pressedInputDeviceElements = new Set<number>();
  const dispatcher = new R3FEventDispatcher<XCameraRayIntersection>();
  const translator = new EventTranslator<PointerEvent, XCameraRayIntersection>(
    pointerId,
    false,
    dispatcher,
    (event, capturedEvents) => {
      if (!(event.target instanceof HTMLCanvasElement)) {
        return emptyIntersection;
      }
      const { camera, scene, size } = getState();
      const coords = new Vector2(
        (event.offsetX / size.width) * 2 - 1,
        -(event.offsetY / size.height) * 2 + 1
      );
      if (capturedEvents == null) {
        return intersectRayFromCamera(
          camera,
          coords,
          scene,
          dispatcher,
          filterIntersections
        );
      }
      return intersectRayFromCameraCapturedEvents(
        camera,
        coords,
        capturedEvents
      );
    },
    () => pressedInputDeviceElements
  );

  return {
    pressedInputDeviceElements,
    translator,
  };
}
