/* eslint-disable react/display-name */
import { RefObject, useEffect, useMemo, useRef } from "react";
import {
  EventDispatcher,
  EventTranslator,
  XCameraRayIntersection,
  XIntersection,
  intersectRayFromCamera,
  intersectRayFromCameraCapturedEvents,
} from "../index.js";
import { R3FEventDispatcher } from "./index.js";
import {
  Event,
  Vector3,
  Quaternion,
  Object3D,
  Scene,
  Mesh,
  Vector2,
  PerspectiveCamera,
  OrthographicCamera,
} from "three";
import { RootState, ThreeEvent } from "@react-three/fiber";
import { EventHandlers } from "@react-three/fiber/dist/declarations/src/core/events.js";

type PointerMapEntry<E, I extends XIntersection> = {
  translator: EventTranslator<E, I>;
  inputDeviceElementPressSet: Set<number>;
  inputDeviceElementPressMap: Map<number, E>;
  inputDeviceElementDragSet: Set<number>;
};

export type ForwardEventsFunctions<E> = {
  press(pointerId: number, event: E, ...pressedElementIds: Array<number>): void;
  release(
    pointerId: number,
    event: E,
    ...releasedElementIds: Array<number>
  ): void;
  cancel(pointerId: number, event: E): void;
  enter(pointerId: number, event: E): void;
  leave(pointerId: number, event: E): void;
  move(pointerId: number, event: E): void;
  wheel(event: E): void;
  blur(event: E): void;
};

export type ComputeIntersections<E, I extends XIntersection> = (
  event: E,
  capturedEvents: Map<Object3D, I> | undefined,
  filterClipped: boolean,
  dispatcher: EventDispatcher<ThreeEvent<Event>, I>,
  targetWorldPosition: Vector3,
  targetWorldQuaternion: Quaternion
) => Array<I>;

export function useForwardEvents<ReceivedEvent, I extends XIntersection>(
  computeIntersections: ComputeIntersections<ReceivedEvent, I>,
  isDrag: (down: ReceivedEvent, current: ReceivedEvent) => boolean,
  onIntersections?: (id: number, intersections: ReadonlyArray<I>) => void,
  filterIntersections?: (id: number, intersections: Array<I>) => Array<I>,
  onPointerDownMissed?: (event: ThreeEvent<Event>) => void,
  onPointerUpMissed?: (event: ThreeEvent<Event>) => void,
  onClickMissed?: (event: ThreeEvent<Event>) => void,
  onStartEventCaptures?: (id: number, event: ReceivedEvent) => void,
  onEndEventCaptures?: (id: number, event: ReceivedEvent) => void,
  filterClipped?: boolean
): ForwardEventsFunctions<ReceivedEvent> {
  const pointerMap = useMemo(
    () => new Map<number, PointerMapEntry<ReceivedEvent, I>>(),
    []
  );

  const dispatcher = useMemo(() => new R3FEventDispatcher<I>(), []);
  dispatcher.onPointerDownMissed = onPointerDownMissed;
  dispatcher.onPointerUpMissed = onPointerUpMissed;
  dispatcher.onClickMissed = onClickMissed;

  const properties = useMemo(
    () => ({
      filterClipped: filterClipped ?? true,
      computeIntersections,
      isDrag,
      onIntersections,
      filterIntersections,
      onStartEventCaptures,
      onEndEventCaptures,
    }),
    []
  );
  properties.filterClipped = filterClipped ?? true;
  properties.computeIntersections = computeIntersections;
  properties.isDrag = isDrag;
  properties.onIntersections = onIntersections;
  properties.filterIntersections = filterIntersections;
  properties.onStartEventCaptures = onStartEventCaptures;
  properties.onEndEventCaptures = onEndEventCaptures;

  //update properties for all pointers
  for (const [pointerId, entry] of pointerMap) {
    setTranslatorProperties(entry.translator, pointerId, properties);
  }

  useEffect(
    () => () => {
      //cleanup
      for (const { translator } of pointerMap.values()) {
        translator.leave({} as any);
      }
      pointerMap.clear();
    },
    []
  );

  return useMemo(() => {
    const getOrCreate = (id: number) =>
      getOrCreatePointerMapEntry(pointerMap, dispatcher, properties, id);
    return {
      cancel: (pointerId: number, event: ReceivedEvent) => {
        const { translator } = getOrCreate(pointerId);
        translator.cancel(event);
      },
      enter: (pointerId: number, event: ReceivedEvent) => {
        const { translator } = getOrCreate(pointerId);
        translator.update(event, true, true);
      },
      leave: (pointerId: number, event: ReceivedEvent) => {
        const { translator } = getOrCreate(pointerId);
        translator.leave(event);
        pointerMap.delete(pointerId);
      },
      press: (
        pointerId: number,
        event: ReceivedEvent,
        ...pressedElementIds: Array<number>
      ) => {
        const {
          inputDeviceElementPressMap,
          inputDeviceElementPressSet,
          translator,
        } = getOrCreate(pointerId);
        for (const pressedElementId of pressedElementIds) {
          inputDeviceElementPressSet.add(pressedElementId);
          inputDeviceElementPressMap.set(pressedElementId, event);
        }
        translator.update(event, false, true, ...pressedElementIds);
      },
      release: (
        pointerId: number,
        event: ReceivedEvent,
        ...releasedElementIds: Array<number>
      ) => {
        const {
          inputDeviceElementPressMap,
          inputDeviceElementPressSet,
          inputDeviceElementDragSet,
          translator,
        } = getOrCreate(pointerId);
        for (const releasedElementId of releasedElementIds) {
          inputDeviceElementPressSet.delete(releasedElementId);
          inputDeviceElementPressMap.delete(releasedElementId);
        }
        translator.update(event, false, true);
        for (const releasedElementId of releasedElementIds) {
          inputDeviceElementDragSet.delete(releasedElementId);
        }
      },
      move: (pointerId: number, event: ReceivedEvent) => {
        const {
          translator,
          inputDeviceElementPressMap,
          inputDeviceElementDragSet,
        } = getOrCreate(pointerId);

        for (const [elementId, downEvent] of inputDeviceElementPressMap) {
          if (properties.isDrag(downEvent, event)) {
            inputDeviceElementDragSet.add(elementId);
          }
        }

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

function setTranslatorProperties<E, I extends XIntersection>(
  translator: EventTranslator<E, I>,
  pointerId: number,
  {
    filterIntersections,
    onEndEventCaptures,
    onIntersections,
    onStartEventCaptures,
  }: {
    onIntersections:
      | ((id: number, intersections: ReadonlyArray<I>) => void)
      | undefined;
    filterIntersections:
      | ((id: number, intersections: Array<I>) => Array<I>)
      | undefined;
    onStartEventCaptures: ((id: number, event: E) => void) | undefined;
    onEndEventCaptures: ((id: number, event: E) => void) | undefined;
  }
) {
  translator.onIntersections = onIntersections?.bind(null, pointerId);
  translator.filterIntersections = filterIntersections?.bind(null, pointerId);
  translator.onStartEventCaptures = onStartEventCaptures?.bind(null, pointerId);
  translator.onEndEventCaptures = onEndEventCaptures?.bind(null, pointerId);
}

function getOrCreatePointerMapEntry<E, I extends XIntersection>(
  pointerMap: Map<number, PointerMapEntry<E, I>>,
  dispatcher: R3FEventDispatcher<I>,
  properties: {
    filterClipped: boolean;
    computeIntersections: ComputeIntersections<E, I>;
    onIntersections:
      | ((id: number, intersections: ReadonlyArray<I>) => void)
      | undefined;
    filterIntersections:
      | ((id: number, intersections: Array<I>) => Array<I>)
      | undefined;
    onStartEventCaptures: ((id: number, event: E) => void) | undefined;
    onEndEventCaptures: ((id: number, event: E) => void) | undefined;
  },
  pointerId: number
): PointerMapEntry<E, I> {
  let entry = pointerMap.get(pointerId);
  if (entry == null) {
    const lastWorldPosition = new Vector3();
    const lastWorldRotation = new Quaternion();

    const newEntry: PointerMapEntry<E, I> = {
      inputDeviceElementPressSet: new Set<number>(),
      inputDeviceElementPressMap: new Map(),
      translator: new EventTranslator<E, I>(
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
        () => newEntry.inputDeviceElementPressSet,
        (position, rotation) => {
          position.copy(lastWorldPosition);
          rotation.copy(lastWorldRotation);
        },
        (inputDeviceElementId) =>
          newEntry.inputDeviceElementDragSet.has(inputDeviceElementId)
      ),
      inputDeviceElementDragSet: new Set(),
    };

    setTranslatorProperties(newEntry.translator, pointerId, properties);

    pointerMap.set(pointerId, (entry = newEntry));
  }
  return entry;
}

export function useMeshForwardEvents(
  camera?: PerspectiveCamera | OrthographicCamera,
  scene?: Scene,
  dragDistance?: number,
  onIntersections?: (
    id: number,
    intersections: ReadonlyArray<XCameraRayIntersection>
  ) => void,
  filterIntersections?: (
    id: number,
    intersections: Array<XCameraRayIntersection>
  ) => Array<XCameraRayIntersection>,
  onPointerDownMissed?: (event: ThreeEvent<Event>) => void,
  onPointerUpMissed?: (event: ThreeEvent<Event>) => void,
  onClickMissed?: (event: ThreeEvent<Event>) => void
) {
  const properties = useMemo<Partial<RootState>>(() => ({ camera, scene }), []);
  properties.camera = camera;
  properties.scene = scene;

  return useMeshForwardEventsFromStore(
    properties,
    dragDistance,
    onIntersections,
    filterIntersections,
    onPointerDownMissed,
    onPointerUpMissed,
    onClickMissed
  );
}

export function useMeshForwardEventsFromStore(
  store: Partial<RootState> | (() => Partial<RootState>),
  dragDistance?: number,
  onIntersections?: (
    id: number,
    intersections: ReadonlyArray<XCameraRayIntersection>
  ) => void,
  filterIntersections?: (
    id: number,
    intersections: Array<XCameraRayIntersection>
  ) => Array<XCameraRayIntersection>,
  onPointerDownMissed?: (event: ThreeEvent<Event>) => void,
  onPointerUpMissed?: (event: ThreeEvent<Event>) => void,
  onClickMissed?: (event: ThreeEvent<Event>) => void
): EventHandlers & { ref: RefObject<Mesh> } {
  const ref = useRef<Mesh>(null);
  const eventFunctions = useForwardEvents(
    computeIntersections.bind(null, store, ref),
    isDrag.bind(
      null,
      dragDistance == null ? undefined : dragDistance * dragDistance
    ),
    onIntersections,
    filterIntersections,
    onPointerDownMissed,
    onPointerUpMissed,
    onClickMissed,
    startCaptureMeshEvents,
    endCaptureMeshEvents
  );
  return useMemo(
    () => ({
      ref,
      onPointerDown: (e) => eventFunctions.press(e.pointerId, e, e.button),
      onPointerUp: (e) => eventFunctions.release(e.pointerId, e, e.button),
      onPointerCancel: (e) => eventFunctions.cancel(e.pointerId, e),
      onPointerEnter: (e) => {
        e.stopPropagation();
        eventFunctions.enter(e.pointerId, e);
      },
      onPointerLeave: (e) => eventFunctions.leave(e.pointerId, e),
      onPointerMove: (e) => eventFunctions.move(e.pointerId, e),
      onWheel: eventFunctions.wheel,
    }),
    []
  );
}

function startCaptureMeshEvents(id: number, event: ThreeEvent<Event>) {
  (event.target as HTMLCanvasElement).setPointerCapture(id);
}
function endCaptureMeshEvents(id: number, event: ThreeEvent<Event>) {
  (event.target as HTMLCanvasElement).releasePointerCapture(id);
}

function isDrag(
  dragDistanceSquared: number | undefined,
  downEvent: ThreeEvent<Event>,
  currentEvent: ThreeEvent<Event>
): boolean {
  if (dragDistanceSquared == null) {
    return false;
  }
  return (
    downEvent.point.distanceToSquared(currentEvent.point) > dragDistanceSquared
  );
}

const emptyIntersections: Array<any> = [];

const pointHelper = new Vector3();

function computeIntersections(
  properties: Partial<RootState> | (() => Partial<RootState>),
  planeRef: RefObject<Mesh>,
  event: ThreeEvent<Event>,
  capturedEvents: Map<Object3D, XCameraRayIntersection> | undefined,
  filterClipped: boolean,
  dispatcher: EventDispatcher<ThreeEvent<Event>, XCameraRayIntersection>,
  targetWorldPosition: Vector3,
  targetWorldQuaternion: Quaternion
) {
  const { camera, scene } =
    typeof properties === "function" ? properties() : properties;
  if (planeRef.current == null || camera == null || scene == null) {
    return emptyIntersections;
  }
  pointHelper.copy(event.point);
  planeRef.current.worldToLocal(pointHelper);
  const coords = new Vector2(pointHelper.x, pointHelper.y).multiplyScalar(2);

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
