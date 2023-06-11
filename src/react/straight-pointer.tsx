/* eslint-disable react/display-name */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { Object3D, Quaternion, Vector3 } from "three";
import { EventTranslator, XIntersection } from "../index.js";
import {
  intersectRayFromCapturedEvents,
  intersectRayFromObject,
} from "../intersections/ray.js";
import { InputDeviceFunctions, R3FEventDispatcher } from "./index.js";
import { useFrame, useThree } from "@react-three/fiber";

const emptyIntersections: Array<XIntersection> = [];

const worldPositionHelper = new Vector3();
const worldRotationHelper = new Quaternion();

export const XStraightPointer = forwardRef<
  InputDeviceFunctions,
  {
    id: number;
    onIntersections?: (intersections: Array<XIntersection>) => void;
    filterIntersections?: (
      intersections: Array<XIntersection>
    ) => Array<XIntersection>;
  }
>(({ id, onIntersections, filterIntersections }, ref) => {
  const objectRef = useRef<Object3D>(null);
  const scene = useThree(({ scene }) => scene);
  const pressedElementIds = useMemo(() => new Set<number>(), []);
  const translator = useMemo(() => {
    const dispatcher = new R3FEventDispatcher();
    return new EventTranslator<any>(
      id,
      false,
      dispatcher,
      (_, capturedEvents) => {
        if (objectRef.current == null) {
          return emptyIntersections;
        }
        objectRef.current.getWorldPosition(worldPositionHelper);
        objectRef.current.getWorldQuaternion(worldRotationHelper);

        if (capturedEvents != null) {
          return intersectRayFromCapturedEvents(
            worldPositionHelper,
            worldRotationHelper,
            capturedEvents
          );
        }

        return intersectRayFromObject(
          worldPositionHelper,
          worldRotationHelper,
          scene,
          dispatcher,
          filterIntersections
        );
      },
      () => pressedElementIds
    );
  }, [id, filterIntersections, scene]);
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
  //update translator every frame
  useFrame(() => {
    translator.update({}, true, false);
    onIntersections?.(translator.intersections);
  });
  return <object3D ref={objectRef} />;
});
