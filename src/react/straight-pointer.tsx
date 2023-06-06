import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { Intersection, Object3D } from "three";
import { EventTranslator } from "../index.js";
import { raycastFromObject } from "../intersections/raycaster.js";
import { InputDeviceFunctions, R3FEventDispatcher } from "./index.js";
import { useFrame, useThree } from "@react-three/fiber";

const emptyIntersections: Array<Intersection> = [];

export const XStraightPointer = forwardRef<
  InputDeviceFunctions,
  {
    id: number;
  }
>(({ id }, ref) => {
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
        return raycastFromObject(objectRef.current, scene, dispatcher);
      },
      () => pressedElementIds
    );
  }, [id, scene]);
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
  useFrame(() => translator.update({}, true, false));
  return <object3D ref={objectRef} />;
});
