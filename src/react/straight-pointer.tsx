/* eslint-disable react/display-name */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { Object3D, Quaternion, Vector3, Event } from "three";
import { EventTranslator, XIntersection, isDragDefault } from "../index.js";
import {
  intersectRayFromCapturedEvents,
  intersectRayFromObject,
} from "../intersections/ray.js";
import { InputDeviceFunctions, R3FEventDispatcher } from "./index.js";
import { ThreeEvent, useFrame, useStore } from "@react-three/fiber";

const emptyIntersections: Array<XIntersection> = [];

const worldPositionHelper = new Vector3();
const worldRotationHelper = new Quaternion();

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
      isDrag: customIsDrag,
      filterClipped = true,
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

    const properties = useMemo(() => ({ customIsDrag, filterClipped }), []);
    properties.customIsDrag = customIsDrag;
    properties.filterClipped = filterClipped;

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
                  properties.filterClipped
                )
              : //events captured
                intersectRayFromCapturedEvents(
                  worldPositionHelper,
                  worldRotationHelper,
                  capturedEvents
                );
          },
          () => pressedElementIds,
          (i1, i2) =>
            properties.customIsDrag == null
              ? isDragDefault(store.getState().camera, i1, i2)
              : properties.customIsDrag(i1, i2),
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
