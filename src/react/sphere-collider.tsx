import { useThree, useFrame } from "@react-three/fiber";
import React, { useRef, useMemo, useEffect } from "react";
import { Group, Intersection, SphereGeometry } from "three";
import { EventTranslator } from "../index.js";
import { R3FEventDispatcher } from "./index.js";
import { collideSphereFromObject } from "../intersections/collider.js";

const emptyIntersections: Array<Intersection> = [];

const noElementPress: Array<number> = [];
const primaryElementPress: Array<number> = [1];

const sphereGeometry = new SphereGeometry(1);

export function XSphereCollider({
  id,
  radius,
  visualize,
  downDistance = 0.05, //5cm
  enterDistance = 0.1, //10cm
}: {
  id: number;
  radius: number;
  visualize?: boolean;
  enterDistance?: number;
  downDistance?: number;
}) {
  const groupRef = useRef<Group>(null);
  const scene = useThree(({ scene }) => scene);
  const translator = useMemo(() => {
    const dispatcher = new R3FEventDispatcher();
    return new EventTranslator<{}>(
      id,
      true,
      dispatcher,
      () => {
        if (groupRef.current == null) {
          return emptyIntersections;
        }
        return collideSphereFromObject(
          groupRef.current,
          radius,
          enterDistance,
          scene,
          dispatcher
        );
      },
      (intersection) =>
        intersection.distance <= downDistance
          ? primaryElementPress
          : noElementPress
    );
  }, [id, radius, enterDistance, scene]);
  //cleanup translator
  useEffect(() => () => translator.leave({} as any), [translator]);
  useFrame(() => translator.update({}, true, true));
  return (
    <group ref={groupRef}>
      {visualize && (
        <mesh scale={radius} geometry={sphereGeometry}>
          <meshBasicMaterial color="red" />
        </mesh>
      )}
    </group>
  );
}
