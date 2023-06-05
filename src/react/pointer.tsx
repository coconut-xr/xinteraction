import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { BufferGeometry, Group, Intersection, Vector3 } from "three";
import { EventTranslator } from "../index.js";
import { raycastFromObject } from "../intersections/raycaster.js";
import { R3FEventDispatcher } from "./index.js";
import { useFrame, useThree } from "@react-three/fiber";

const emptyIntersections: Array<Intersection> = [];
const lineGeometry = new BufferGeometry().setFromPoints([
  new Vector3(),
  new Vector3(0, 0, 100),
]);

export type XPointerFunctions = {
  press(id: number, event: any): void;
  release(id: number, event: any): void;
  leave(event: any): void;
  enter(event: any): void;
  cancel(event: any): void;
  wheel(event: any): void;
};

export const XPointer = forwardRef<
  XPointerFunctions,
  {
    id: number;
    visualize?: boolean;
  }
>(({ visualize, id }, ref) => {
  const groupRef = useRef<Group>(null);
  const scene = useThree(({ scene }) => scene);
  const pressedElementIds = useMemo(() => new Set<number>(), []);
  const disabledRef = useRef(false);
  const translator = useMemo(() => {
    const dispatcher = new R3FEventDispatcher();
    return new EventTranslator<{}>(
      id,
      false,
      dispatcher,
      () => {
        if (groupRef.current == null) {
          return emptyIntersections;
        }
        return raycastFromObject(groupRef.current, scene, dispatcher);
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
      leave(event) {
        translator.leave(event);
        disabledRef.current = true;
      },
      enter() {
        disabledRef.current = false;
      },
      wheel(event) {
        translator.wheel(event);
      },
    }),
    [translator]
  );
  //cleanup translator
  useEffect(
    () => () => {
      //cleanup by calling leave if not already disabled
      if (disabledRef.current) {
        return;
      }
      translator.leave({} as any);
    },
    [translator]
  );
  useFrame(() => {
    if (disabledRef.current) {
      return;
    }
    translator.update({}, true, false);
  });
  return (
    <group ref={groupRef}>
      {visualize && (
        <lineSegments geometry={lineGeometry}>
          <meshBasicMaterial color="red" />
        </lineSegments>
      )}
    </group>
  );
});
