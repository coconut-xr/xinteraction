/* eslint-disable react/display-name */
import { useFrame, ThreeEvent, useStore } from "@react-three/fiber";
import React, {
  useRef,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Object3D, Event, Quaternion, Vector3 } from "three";
import { EventTranslator, XIntersection, isDragDefault } from "../index.js";
import { InputDeviceFunctions, R3FEventDispatcher } from "./index.js";
import {
  XSphereIntersection,
  intersectSphereFromCapturedEvents,
  intersectSphereFromObject,
} from "../intersections/sphere.js";

const emptyIntersections: Array<XIntersection> = [];

const worldPositionHelper = new Vector3();
const worldRotationHelper = new Quaternion();

export const XSphereCollider = forwardRef<
  InputDeviceFunctions,
  {
    id: number;
    radius: number;
    distanceElement?: { id: number; downRadius: number };
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
      distanceElement,
      radius,
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
    const pressedElementIds = useMemo(() => new Set<number>(), []);

    const dispatcher = useMemo(
      () => new R3FEventDispatcher<XIntersection>(),
      []
    );
    dispatcher.onPointerDownMissed = onPointerDownMissed;
    dispatcher.onPointerUpMissed = onPointerUpMissed;
    dispatcher.onClickMissed = onClickMissed;

    const properties = useMemo(
      () => ({ distanceElement, radius, customIsDrag, filterClipped }),
      []
    );
    properties.distanceElement = distanceElement;
    properties.radius = radius;
    properties.customIsDrag = customIsDrag;
    properties.filterClipped = filterClipped;

    const translator = useMemo(
      () =>
        new EventTranslator<any, XIntersection>(
          id,
          true,
          dispatcher,
          (_: any, capturedEvents?: Map<Object3D, XIntersection>) => {
            if (objectRef.current == null) {
              return emptyIntersections;
            }
            objectRef.current.getWorldPosition(worldPositionHelper);
            objectRef.current.getWorldQuaternion(worldRotationHelper);

            return capturedEvents == null
              ? //events not captured -> compute intersections normally
                intersectSphereFromObject(
                  worldPositionHelper,
                  worldRotationHelper,
                  properties.radius,
                  store.getState().scene,
                  dispatcher,
                  properties.filterClipped
                )
              : //event captured
                intersectSphereFromCapturedEvents(
                  worldPositionHelper,
                  worldRotationHelper,
                  capturedEvents
                );
          },
          (intersection?: XSphereIntersection) => {
            if (properties.distanceElement == null || intersection == null) {
              return pressedElementIds;
            }
            if (
              intersection.distance <= properties.distanceElement.downRadius &&
              // either the intersection is not captured (=> actualDistance == null) OR the actual distance to the object is smaller then 2x downRadius => if not we release the capture
              (intersection.actualDistance == null ||
                intersection.actualDistance <
                  2 * properties.distanceElement.downRadius * 2)
            ) {
              pressedElementIds.add(properties.distanceElement.id);
            } else {
              pressedElementIds.delete(properties.distanceElement.id);
            }
            return pressedElementIds;
          },
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

    useEffect(
      () => () => {
        if (distanceElement == null) {
          return;
        }
        pressedElementIds.delete(distanceElement.id);
      },
      [distanceElement]
    );

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
    useFrame(() => {
      translator.update({}, true, distanceElement != null);
    });
    return <object3D ref={objectRef} />;
  }
);
