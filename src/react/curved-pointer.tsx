import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { Object3D, Quaternion, Vector3 } from "three";
import { EventTranslator } from "../index.js";
import {
  XLinesIntersection,
  intersectLinesFromCapturedEvents,
  intersectLinesFromObject,
} from "../intersections/lines.js";
import { InputDeviceFunctions, R3FEventDispatcher } from "./index.js";
import { useFrame, useThree } from "@react-three/fiber";

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
  }
>(({ id, points, onIntersections, filterIntersections }, ref) => {
  const objectRef = useRef<Object3D>(null);
  const scene = useThree(({ scene }) => scene);
  const pressedElementIds = useMemo(() => new Set<number>(), []);
  const translator = useMemo(() => {
    const dispatcher = new R3FEventDispatcher<XLinesIntersection>();
    return new EventTranslator<{}, XLinesIntersection>(
      id,
      false,
      dispatcher,
      (_, capturedEvents) => {
        if (objectRef.current == null) {
          return emptyIntersections;
        }
        objectRef.current.getWorldPosition(worldPositionHelper);
        objectRef.current.getWorldQuaternion(worldRotationHelper);

        if (capturedEvents == null) {
          return intersectLinesFromObject(
            objectRef.current,
            worldPositionHelper,
            worldRotationHelper,
            points,
            scene,
            dispatcher,
            filterIntersections
          );
        }
        return intersectLinesFromCapturedEvents(
          objectRef.current,
          worldPositionHelper,
          worldRotationHelper,
          points,
          capturedEvents
        );
      },
      () => pressedElementIds
    );
  }, [id, filterIntersections, points, scene]);
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
