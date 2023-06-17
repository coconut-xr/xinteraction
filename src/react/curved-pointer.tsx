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
  XLinesIntersection,
  intersectLinesFromCapturedEvents,
  intersectLinesFromObject,
} from "../intersections/lines.js";
import { InputDeviceFunctions, R3FEventDispatcher } from "./index.js";
import { ThreeEvent, useFrame, useStore } from "@react-three/fiber";

const emptyIntersections: Array<XLinesIntersection> = [];

const worldPositionHelper = new Vector3();
const worldRotationHelper = new Quaternion();

export const XCurvedPointer = forwardRef<
  InputDeviceFunctions,
  {
    id: number;
    points: Array<Vector3>;
    onIntersections?: (
      intersections: ReadonlyArray<XLinesIntersection>
    ) => void;
    filterIntersections?: (
      intersections: Array<XLinesIntersection>
    ) => Array<XLinesIntersection>;
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
      points,
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
    const objectRef = useRef<Object3D>(null);
    const store = useStore();

    const dispatcher = useMemo(
      () => new R3FEventDispatcher<XLinesIntersection>(),
      []
    );
    dispatcher.onPointerDownMissed = onPointerDownMissed;
    dispatcher.onPointerUpMissed = onPointerUpMissed;
    dispatcher.onClickMissed = onClickMissed;

    const pressedElementIds = useMemo(() => new Set<number>(), []);

    const properties = useMemo(
      () => ({ points, customIsDrag, filterClipped }),
      []
    );
    properties.points = points;
    properties.customIsDrag = customIsDrag;
    properties.filterClipped = filterClipped;

    const translator = useMemo(
      () =>
        new EventTranslator<any, XLinesIntersection>(
          id,
          false,
          dispatcher,
          (_: any, capturedEvents?: Map<Object3D, XLinesIntersection>) => {
            if (objectRef.current == null) {
              return emptyIntersections;
            }
            objectRef.current.getWorldPosition(worldPositionHelper);
            objectRef.current.getWorldQuaternion(worldRotationHelper);

            return capturedEvents == null
              ? //events not captured -> compute normally
                intersectLinesFromObject(
                  objectRef.current,
                  worldPositionHelper,
                  worldRotationHelper,
                  properties.points,
                  store.getState().scene,
                  dispatcher,
                  properties.filterClipped
                )
              : intersectLinesFromCapturedEvents(
                  objectRef.current,
                  worldPositionHelper,
                  worldRotationHelper,
                  properties.points,
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
