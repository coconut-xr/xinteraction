import { Box } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useCallback, useMemo, useRef } from "react";
import { Matrix4, Mesh, Quaternion, Vector3 } from "three";
import { XWebPointers } from "xinteraction/react";
import { isXIntersection } from "../../dist/index.js";

export default function DoubleGrabScene() {
  return (
    <Canvas
      style={{ width: "100wh", height: "100vh", touchAction: "none" }}
      camera={{ position: [0, 0, -5] }}
      gl={{ localClippingEnabled: true }}
      events={() => ({
        enabled: false,
        priority: 0,
      })}
    >
      <XWebPointers />
      <DoubleGrabCube />
    </Canvas>
  );
}

const pointOffsetPosition = new Vector3();
const deltaRotation = new Quaternion();

const initialInputDeviceOffset = new Vector3();
const currentInputDeviceOffset = new Vector3();

function DoubleGrabCube() {
  const ref = useRef<Mesh>(null);

  const state = useMemo<{
    objectPosition: Vector3;
    objectRotation: Quaternion;
    objectScale: Vector3;
    intersections: Map<
      number,
      {
        startPosition: Vector3;
        startRotation: Quaternion;
        currentPosition: Vector3;
        currentRotation: Quaternion;
      }
    >;
  }>(
    () => ({
      intersections: new Map(),
      objectPosition: new Vector3(),
      objectRotation: new Quaternion(),
      objectScale: new Vector3(),
    }),
    []
  );

  useFrame(() => {
    if (ref.current == null) {
      return;
    }
    switch (state.intersections.size) {
      case 1:
        const [
          { currentPosition, currentRotation, startPosition, startRotation },
        ] = state.intersections.values();
        //compute offset from point to object
        pointOffsetPosition.copy(state.objectPosition).sub(startPosition);
        //compute delta rotation
        deltaRotation.copy(startRotation).invert().multiply(currentRotation);

        //calculate new position using the offset from the initial intersection point to the object
        //then rotating this offset by the rotation offset of the input device
        //and lastly add the initial position of the box
        ref.current.position
          .copy(pointOffsetPosition)
          .applyQuaternion(deltaRotation)
          .add(currentPosition);

        //calculating the new rotation by applying the offset rotation of the input device to the original rotation of the box
        ref.current.quaternion
          .copy(state.objectRotation)
          .multiply(deltaRotation);

        ref.current.scale.copy(state.objectScale);
        break;
      case 2:
        const [i1, i2] = state.intersections.values();

        //initial and current input device offset from 1 to 2
        initialInputDeviceOffset.copy(i2.startPosition).sub(i1.startPosition);
        currentInputDeviceOffset
          .copy(i2.currentPosition)
          .sub(i1.currentPosition);

        //compute scale scalar
        const initialLength = initialInputDeviceOffset.length();
        const currentLength = currentInputDeviceOffset.length();
        const deltaScale = currentLength / initialLength;

        //normalize vectors
        initialInputDeviceOffset.divideScalar(initialLength);
        currentInputDeviceOffset.divideScalar(currentLength);

        //compute quaternion
        deltaRotation.setFromUnitVectors(
          initialInputDeviceOffset,
          currentInputDeviceOffset
        );

        ref.current.position
          .copy(state.objectPosition)
          .sub(i1.startPosition)
          .multiplyScalar(deltaScale)
          .applyQuaternion(deltaRotation)
          .add(i1.currentPosition);

        ref.current.quaternion
          .copy(state.objectRotation)
          .multiply(deltaRotation);

        ref.current.scale.copy(state.objectScale).multiplyScalar(deltaScale);
        break;
    }
  });

  const updateObjectMatrix = useCallback(() => {
    if (ref.current == null) {
      return;
    }
    state.objectPosition.copy(ref.current.position);
    state.objectRotation.copy(ref.current.quaternion);
    state.objectScale.copy(ref.current.scale);
    for (const intersection of state.intersections.values()) {
      intersection.startPosition = intersection.currentPosition;
      intersection.startRotation = intersection.currentRotation;
    }
  }, []);

  return (
    <Box
      onPointerDown={(e) => {
        if (!isXIntersection(e)) {
          return;
        }
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        updateObjectMatrix();
        state.intersections.set(e.pointerId, {
          startPosition: e.point,
          currentPosition: e.point,
          startRotation: e.inputDeviceRotation,
          currentRotation: e.inputDeviceRotation,
        });
      }}
      onPointerUp={(e) => {
        state.intersections.delete(e.pointerId);
        updateObjectMatrix();
      }}
      onPointerLeave={(e) => {
        state.intersections.delete(e.pointerId);
        updateObjectMatrix();
      }}
      onPointerMove={(e) => {
        if (!isXIntersection(e)) {
          return;
        }
        const intersection = state.intersections.get(e.pointerId);
        if (intersection == null) {
          return;
        }
        intersection.currentPosition = e.point;
        intersection.currentRotation = e.inputDeviceRotation;
      }}
      ref={ref}
    >
      <meshBasicMaterial color="yellow" toneMapped={false} />
    </Box>
  );
}
