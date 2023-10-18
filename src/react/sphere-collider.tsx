/* eslint-disable react/display-name */
import { useFrame, ThreeEvent, useStore } from "@react-three/fiber";
import React, {
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import { Object3D, Event, Quaternion, Vector3 } from "three";
import { EventTranslator } from "../index.js";
import { InputDeviceFunctions, R3FEventDispatcher } from "./index.js";
import {
  XSphereIntersection,
  intersectSphereFromCapturedEvents,
  intersectSphereFromObject,
} from "../intersections/sphere.js";

const worldPositionHelper = new Vector3();
const worldRotationHelper = new Quaternion();

export const XSphereCollider = forwardRef<
  InputDeviceFunctions,
  {
    id: number;
    radius: number;
    distanceElement?: { id: number; downRadius: number };
    onIntersections?: (
      intersections: ReadonlyArray<XSphereIntersection>
    ) => void;
    filterIntersections?: (
      intersections: Array<XSphereIntersection>
    ) => Array<XSphereIntersection>;
    onPointerDownMissed?: (event: ThreeEvent<Event>) => void;
    onPointerUpMissed?: (event: ThreeEvent<Event>) => void;
    onClickMissed?: (event: ThreeEvent<Event>) => void;
    filterClipped?: boolean;
    initialPressedElementIds?: Array<number>;
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
      filterClipped = true,
      initialPressedElementIds,
    },
    ref
  ) => {
    const object = useMemo(() => new Object3D(), []);
    const store = useStore();
    const pressedElementIds = useMemo(
      () => new Set<number>(initialPressedElementIds),
      []
    );

    const dispatcher = useMemo(
      () => new R3FEventDispatcher<XSphereIntersection>(),
      []
    );
    dispatcher.onPointerDownMissed = onPointerDownMissed;
    dispatcher.onPointerUpMissed = onPointerUpMissed;
    dispatcher.onClickMissed = onClickMissed;

    const properties = useMemo(
      () => ({
        distanceElement,
        radius,
        filterClipped,
      }),
      []
    );
    properties.distanceElement = distanceElement;
    properties.radius = radius;
    properties.filterClipped = filterClipped;

    const translator = useMemo(
      () =>
        new EventTranslator<any, XSphereIntersection>(
          id,
          true,
          dispatcher,
          (_: any, capturedEvents?: Map<Object3D, XSphereIntersection>) => {
            object.getWorldPosition(worldPositionHelper);
            object.getWorldQuaternion(worldRotationHelper);

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
            if (
              intersection != null &&
              properties.distanceElement != null &&
              intersection.distance <= properties.distanceElement.downRadius &&
              // either the intersection is not captured (=> distanceToFace == null) OR the distanceToFace is smaller then 2x downRadius => if not we release the capture
              (intersection.distanceToFace == null ||
                intersection.distanceToFace <
                  2 * properties.distanceElement.downRadius * 2)
            ) {
              return [...pressedElementIds, properties.distanceElement.id];
            }
            return [...pressedElementIds];
          },
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
