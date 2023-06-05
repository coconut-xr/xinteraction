import { RootState, useStore, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { EventTranslator } from "../index.js";
import { R3FEventDispatcher } from "./index.js";
import {
  BufferGeometry,
  Group,
  Intersection,
  LineSegments,
  Object3D,
  Vector2,
  Vector3,
} from "three";
import React from "react";
import { raycastFromCamera } from "../intersections/raycaster.js";

const lineGeometry = new BufferGeometry().setFromPoints([
  new Vector3(),
  new Vector3(0, 0, 100),
]);

type PointerMapEntry = {
  object: Object3D;
  translator: EventTranslator<PointerEvent>;
  pressedInputDeviceElements: Set<number>;
};

export function XWebPointers({ visualize = false }: { visualize?: boolean }) {
  const canvas = useThree(({ gl }) => gl.domElement);
  const ref = useRef<Group>(null);
  const visualizeRef = useRef(visualize);
  visualizeRef.current = visualize;
  const pointerMap = useMemo(() => new Map<number, PointerMapEntry>(), []);

  const store = useStore();

  useEffect(() => {
    if (ref.current == null) {
      return;
    }
    const getOrCreate = getOrCreatePointerMapEntry.bind(
      null,
      pointerMap,
      ref.current,
      visualizeRef,
      () => store.getState()
    );
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
      translator.update(event, true, true);
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

  useEffect(() => {
    for (const { object } of pointerMap.values()) {
      object.visible = visualize;
    }
  }, [visualize]);

  return <group ref={ref} />;
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
  parent: Object3D,
  visualizeRef: { current: boolean },
  getState: () => RootState,
  pointerId: number
): PointerMapEntry {
  let entry = pointerMap.get(pointerId);
  if (entry == null) {
    pointerMap.set(
      pointerId,
      (entry = createPointerMapEntry(
        pointerId,
        parent,
        visualizeRef.current,
        getState
      ))
    );
  }
  return entry;
}

const emptyIntersection: Array<Intersection> = [];

function createPointerMapEntry(
  pointerId: number,
  parent: Object3D,
  visualize: boolean,
  getState: () => RootState
): PointerMapEntry {
  const object = new LineSegments(lineGeometry);
  object.visible = visualize;
  parent.add(object);
  const pressedInputDeviceElements = new Set<number>();
  const dispatcher = new R3FEventDispatcher();
  const translator = new EventTranslator<PointerEvent>(
    pointerId,
    false,
    dispatcher,
    (event) => {
      if (!(event.target instanceof HTMLCanvasElement)) {
        return emptyIntersection;
      }
      //compute rotation based on pointer position
      const { camera, scene, size } = getState();
      return raycastFromCamera(
        camera,
        new Vector2(
          (event.offsetX / size.width) * 2 - 1,
          -(event.offsetY / size.height) * 2 + 1
        ),
        scene,
        dispatcher
      );
    },
    () => pressedInputDeviceElements
  );

  return {
    object,
    pressedInputDeviceElements,
    translator,
  };
}
