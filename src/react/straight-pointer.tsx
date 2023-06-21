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

const emptyIntersections: Array<XIntersection> = [];

const worldPositionHelper = new Vector3();
const worldRotationHelper = new Quaternion();

const ZAXIS = new Vector3();

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
    },
    ref
  ) => {
    const store = useStore();

    const objectRef = useRef<Object3D>(null);

    const dispatcher = useMemo(
      () => new R3FEventDispatcher<XIntersection>(),
      []
    );
    dispatcher.onPointerDownMissed = onPointerDownMissed;
    dispatcher.onPointerUpMissed = onPointerUpMissed;
    dispatcher.onClickMissed = onClickMissed;

    const pressedElementIds = useMemo(() => new Set<number>(), []);

    const properties = useMemo(() => ({ filterClipped, direction }), []);
    properties.filterClipped = filterClipped;
    properties.direction = direction;

    const translator = useMemo(
      () =>
        new EventTranslator<any>(
          id,
          false,
          dispatcher,
          (events: any, capturedEvents?: Map<Object3D, XIntersection>) => {
            if (objectRef.current == null) {
              return emptyIntersections;
            }
            objectRef.current.getWorldPosition(worldPositionHelper);
            objectRef.current.getWorldQuaternion(worldRotationHelper);

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
          () => pressedElementIds,
          (position, rotation) => {
            if (objectRef.current == null) {
              return;
            }
            objectRef.current.getWorldPosition(position);
            objectRef.current.getWorldQuaternion(rotation);
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
    //update translator every frame
    useFrame(() => {
      translator.update({}, true, false);
    });
    return <object3D ref={objectRef} />;
  }
);
