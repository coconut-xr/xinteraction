import { useThree, useFrame } from "@react-three/fiber";
import React, {
  useRef,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Intersection, Object3D } from "three";
import { EventTranslator } from "../index.js";
import { InputDeviceFunctions, R3FEventDispatcher } from "./index.js";
import { collideSphereFromObject } from "../intersections/collider.js";

const emptyIntersections: Array<Intersection> = [];

export const XSphereCollider = forwardRef<
  InputDeviceFunctions,
  {
    id: number;
    radius: number;
    enterDistance: number;
    distanceElement?: { id: number; downDistance: number };
    onIntersections?: (intersections: Array<Intersection>) => void;
  }
>(({ id, radius, distanceElement, enterDistance, onIntersections }, ref) => {
  const objectRef = useRef<Object3D>(null);
  const scene = useThree(({ scene }) => scene);
  const pressedElementIds = useMemo(() => new Set<number>(), []);
  const translator = useMemo(() => {
    const dispatcher = new R3FEventDispatcher();
    return new EventTranslator<{}>(
      id,
      true,
      dispatcher,
      () => {
        if (objectRef.current == null) {
          return emptyIntersections;
        }
        return collideSphereFromObject(
          objectRef.current,
          radius,
          enterDistance,
          scene,
          dispatcher
        );
      },
      (intersection) => {
        if (distanceElement == null) {
          return pressedElementIds;
        }
        if (intersection.distance <= distanceElement.id) {
          pressedElementIds.add(distanceElement.id);
        } else {
          pressedElementIds.delete(distanceElement.id);
        }
        return pressedElementIds;
      }
    );
  }, [id, radius, enterDistance, distanceElement, scene]);

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
});
