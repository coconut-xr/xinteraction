/* eslint-disable react/display-name */
import { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";
import { EventDispatcher, EventTranslator, XIntersection } from "../index.js";
import { R3FEventDispatcher } from "./index.js";
import { Event, Vector3, Quaternion, Object3D } from "three";

type PointerMapEntry<I extends XIntersection> = {
  translator: EventTranslator<ThreeEvent<Event>, I>;
  pressedInputDeviceElements: Set<number>;
};

export type ForwardEventsFunctions = {
  press(
    pointerId: number,
    event: any,
    ...pressedElementIds: Array<number>
  ): void;
  release(
    pointerId: number,
    event: any,
    ...pressedElementIds: Array<number>
  ): void;
  cancel(pointerId: number, event: any): void;
  enter(pointerId: number, event: any): void;
  leave(pointerId: number, event: any): void;
  move(pointerId: number, event: any): void;
  wheel(event: any): void;
  blur(event: any): void;
};

export type ComputeIntersections<I extends XIntersection> = (
  event: ThreeEvent<Event>,
  capturedEvents: Map<Object3D, I> | undefined,
  filterClipped: boolean,
  dispatcher: EventDispatcher<ThreeEvent<Event>, I>,
  targetWorldPosition: Vector3,
  targetWorldQuaternion: Quaternion
) => Array<I>;

export function useForwardEvents<I extends XIntersection>(
  computeIntersections: ComputeIntersections<I>,
  onIntersections?: (id: number, intersections: ReadonlyArray<I>) => void,
  filterIntersections?: (id: number, intersections: Array<I>) => Array<I>,
  onPointerDownMissed?: (event: ThreeEvent<Event>) => void,
  onPointerUpMissed?: (event: ThreeEvent<Event>) => void,
  onClickMissed?: (event: ThreeEvent<Event>) => void,
  filterClipped?: boolean
): ForwardEventsFunctions {
  const pointerMap = useMemo(() => new Map<number, PointerMapEntry<I>>(), []);

  const dispatcher = useMemo(() => new R3FEventDispatcher<I>(), []);
  dispatcher.onPointerDownMissed = onPointerDownMissed;
  dispatcher.onPointerUpMissed = onPointerUpMissed;
  dispatcher.onClickMissed = onClickMissed;

  const properties = useMemo(
    () => ({
      filterClipped: filterClipped ?? true,
      computeIntersections,
    }),
    []
  );
  properties.filterClipped = filterClipped ?? true;
  properties.computeIntersections = computeIntersections;

  //update properties for all pointers
  for (const [pointerId, entry] of pointerMap) {
    entry.translator.onIntersections = onIntersections?.bind(null, pointerId);
    entry.translator.filterIntersections = filterIntersections?.bind(
      null,
      pointerId
    );
  }

  return useMemo(() => {
    const getOrCreate = (id: number) =>
      getOrCreatePointerMapEntry(pointerMap, dispatcher, properties, id);
    return {
      cancel: (pointerId: number, event: any) => {
        const { translator } = getOrCreate(pointerId);
        translator.cancel(event);
      },
      enter: (pointerId: number, event: any) => {
        const { translator } = getOrCreate(pointerId);
        translator.update(event, true, true);
      },
      leave: (pointerId: number, event: any) => {
        const { translator } = getOrCreate(pointerId);
        translator.leave(event);
        pointerMap.delete(pointerId);
      },
      press: (
        pointerId: number,
        event: any,
        ...pressedElementIds: Array<number>
      ) => {
        const { pressedInputDeviceElements, translator } =
          getOrCreate(pointerId);
        for (const pressedElementId of pressedElementIds) {
          pressedInputDeviceElements.add(pressedElementId);
        }
        translator.update(event, false, true, ...pressedElementIds);
      },
      release: (
        pointerId: number,
        event: any,
        ...pressedElementIds: Array<number>
      ) => {
        const { pressedInputDeviceElements, translator } =
          getOrCreate(pointerId);
        for (const pressedElementId of pressedElementIds) {
          pressedInputDeviceElements.delete(pressedElementId);
        }
        translator.update(event, false, true);
      },
      move: (pointerId: number, event: any) => {
        const { translator } = getOrCreate(pointerId);
        translator.update(event, true, false);
      },
      wheel: (event: any) => {
        for (const { translator } of pointerMap.values()) {
          translator.wheel(event as any);
        }
      },
      blur: (event: any) => {
        for (const { translator } of pointerMap.values()) {
          translator.leave(event);
        }
        pointerMap.clear();
      },
    };
  }, []);
}

function getOrCreatePointerMapEntry<I extends XIntersection>(
  pointerMap: Map<number, PointerMapEntry<I>>,
  dispatcher: R3FEventDispatcher<I>,
  properties: {
    filterClipped: boolean;
    computeIntersections: ComputeIntersections<I>;
  },
  pointerId: number
): PointerMapEntry<I> {
  let entry = pointerMap.get(pointerId);
  if (entry == null) {
    const lastWorldPosition = new Vector3();
    const lastWorldRotation = new Quaternion();

    const newEntry: PointerMapEntry<I> = {
      pressedInputDeviceElements: new Set<number>(),
      translator: new EventTranslator<ThreeEvent<Event>, I>(
        pointerId,
        false,
        dispatcher,
        (event, capturedEvents) =>
          properties.computeIntersections(
            event,
            capturedEvents,
            properties.filterClipped,
            dispatcher,
            lastWorldPosition,
            lastWorldRotation
          ),
        () => newEntry.pressedInputDeviceElements,
        (position, rotation) => {
          position.copy(lastWorldPosition);
          rotation.copy(lastWorldRotation);
        }
      ),
    };

    pointerMap.set(pointerId, (entry = newEntry));
  }
  return entry;
}
