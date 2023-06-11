import { useThree, useFrame } from "@react-three/fiber";
import React, {
  useRef,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Object3D, Quaternion, Vector3 } from "three";
import { EventTranslator, XIntersection } from "../index.js";
import { InputDeviceFunctions, R3FEventDispatcher } from "./index.js";
import {
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
    enterDistance: number;
    distanceElement?: { id: number; downDistance: number };
    onIntersections?: (intersections: Array<XIntersection>) => void;
    filterIntersections?: (
      intersections: Array<XIntersection>
    ) => Array<XIntersection>;
  }
>(
  (
    {
      id,
      distanceElement,
      enterDistance,
      onIntersections,
      filterIntersections,
    },
    ref
  ) => {
    const objectRef = useRef<Object3D>(null);
    const scene = useThree(({ scene }) => scene);
    const pressedElementIds = useMemo(() => new Set<number>(), []);
    const translator = useMemo(() => {
      const dispatcher = new R3FEventDispatcher();
      return new EventTranslator<{}, XIntersection>(
        id,
        true,
        dispatcher,
        (_, capturedEvents) => {
          if (objectRef.current == null) {
            return emptyIntersections;
          }
          objectRef.current.getWorldPosition(worldPositionHelper);
          objectRef.current.getWorldQuaternion(worldRotationHelper);

          if (capturedEvents == null) {
            //events not captured -> compute intersections normally
            return intersectSphereFromObject(
              worldPositionHelper,
              worldRotationHelper,
              enterDistance,
              scene,
              dispatcher,
              filterIntersections
            );
          }
          return intersectSphereFromCapturedEvents(
            worldPositionHelper,
            worldRotationHelper,
            capturedEvents
          );
        },
        (intersection) => {
          if (distanceElement == null || intersection == null) {
            return pressedElementIds;
          }
          if (intersection.distance <= distanceElement.downDistance) {
            pressedElementIds.add(distanceElement.id);
          } else {
            pressedElementIds.delete(distanceElement.id);
          }
          return pressedElementIds;
        }
      );
    }, [id, filterIntersections, enterDistance, distanceElement, scene]);

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
    useEffect(() => () => translator.leave({} as any), [translator]);
    useFrame(() => {
      translator.update({}, true, distanceElement != null);
      onIntersections?.(translator.intersections);
    });
    return <object3D ref={objectRef} />;
  }
);
