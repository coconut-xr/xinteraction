/* eslint-disable react/display-name */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { Object3D, Quaternion, Vector3, Event } from "three";
import { EventTranslator, XIntersection } from "../index.js";
import {
  intersectRayFromCapturedEvents,
  intersectRayFromObject,
} from "../intersections/ray.js";
import { InputDeviceFunctions, R3FEventDispatcher } from "./index.js";
import { ThreeEvent, useFrame, useStore } from "@react-three/fiber";

const worldPositionHelper = new Vector3();
const worldRotationHelper = new Quaternion();

const ZAXIS = new Vector3(0, 0, 1);

export const XStraightPointer = forwardRef<
  InputDeviceFunctions,
  {
    id: number;
    onIntersections?: (intersections: ReadonlyArray<XIntersection>) => void;
    filterIntersections?: (
      intersections: Array<XIntersection>
    ) => Array<XIntersection>;
    onPointerDownMissed?: (event: ThreeEvent<Event>) => void;
    onPointerUpMissed?: (event: ThreeEvent<Event>) => void;
    onClickMissed?: (event: ThreeEvent<Event>) => void;
    isDrag?: (i1: XIntersection, i2: XIntersection) => boolean;
    direction?: Vector3;
    filterClipped?: boolean;
    initialPressedElementIds?: Array<number>;
  }
>(
  (
    {
      id,
      onIntersections,
      filterIntersections,
      onClickMissed,
      onPointerDownMissed,
      onPointerUpMissed,
      filterClipped = true,
      direction = ZAXIS,
      initialPressedElementIds,
    },
    ref
  ) => {
    const store = useStore();

    const object = useMemo(() => new Object3D(), []);

    const dispatcher = useMemo(
      () => new R3FEventDispatcher<XIntersection>(),
      []
    );
    dispatcher.onPointerDownMissed = onPointerDownMissed;
    dispatcher.onPointerUpMissed = onPointerUpMissed;
    dispatcher.onClickMissed = onClickMissed;

    const pressedElementIds = useMemo(
      () => new Set<number>(initialPressedElementIds),
      []
    );

    const properties = useMemo(
      () => ({
        filterClipped,
        direction,
      }),
      []
    );
    properties.filterClipped = filterClipped;
    properties.direction = direction;

    const translator = useMemo(
      () =>
        new EventTranslator<any>(
          id,
          false,
          dispatcher,
          (events: any, capturedEvents?: Map<Object3D, XIntersection>) => {
            object.getWorldPosition(worldPositionHelper);
            object.getWorldQuaternion(worldRotationHelper);

            return capturedEvents == null
              ? //no events captured -> compute intersections normally
                intersectRayFromObject(
                  worldPositionHelper,
                  worldRotationHelper,
                  store.getState().scene,
                  dispatcher,
                  properties.filterClipped,
                  properties.direction
                )
              : //events captured
                intersectRayFromCapturedEvents(
                  worldPositionHelper,
                  worldRotationHelper,
                  capturedEvents,
                  properties.direction
                );
          },
          () => [...pressedElementIds],
          (position, rotation) => {
            object.getWorldPosition(position);
            object.getWorldQuaternion(rotation);
          }
        ),
      [id, store]
    );

    translator.onIntersections = onIntersections;
    translator.filterIntersections = filterIntersections;

    useImperativeHandle(
      ref,
      () => ({
        press: (id, event) => {
          pressedElementIds.add(id);
          translator.update(event, false, true, id);
        },
        release: (id, event) => {
          pressedElementIds.delete(id);
          translator.update(event, false, true);
        },
        cancel: translator.cancel.bind(translator),
        wheel(event) {
          translator.wheel(event);
        },
      }),
      [translator]
    );
    //cleanup translator
    useEffect(() => translator.leave.bind(translator, {} as any), [translator]);
    //update translator every frame (we use pressedElementsChangedRef to update the translator for the initial pressed elements)
    const pressedElementsChangedRef = useRef(pressedElementIds.size > 0);
    useFrame(() => {
      translator.update(
        {},
        true,
        pressedElementsChangedRef.current,
        ...pressedElementIds
      );
      pressedElementsChangedRef.current = false;
    });
    // eslint-disable-next-line react/no-unknown-property
    return <primitive object={object} />;
  }
);
