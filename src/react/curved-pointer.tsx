import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { Intersection, Object3D, Vector3 } from "three";
import { EventTranslator } from "../index.js";
import { intersectLinesFromObject } from "../intersections/lines.js";
import { InputDeviceFunctions, R3FEventDispatcher } from "./index.js";
import { useFrame, useThree } from "@react-three/fiber";

const emptyIntersections: Array<Intersection> = [];

export const XCurvedPointer = forwardRef<
  InputDeviceFunctions,
  {
    id: number;
    points: Array<Vector3>;
    onIntersections?: (intersections: ReadonlyArray<Intersection>) => void;
    filterIntersections?: (
      intersections: Array<Intersection>
    ) => Array<Intersection>;
  }
>(({ id, points, onIntersections, filterIntersections }, ref) => {
  const objectRef = useRef<Object3D>(null);
  const scene = useThree(({ scene }) => scene);
  const pressedElementIds = useMemo(() => new Set<number>(), []);
  const translator = useMemo(() => {
    const dispatcher = new R3FEventDispatcher();
    return new EventTranslator<{}>(
      id,
      false,
      dispatcher,
      () => {
        if (objectRef.current == null) {
          return emptyIntersections;
        }
        return intersectLinesFromObject(
          objectRef.current,
          points,
          scene,
          dispatcher,
          filterIntersections
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
