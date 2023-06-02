import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, MeshProps, useFrame } from "@react-three/fiber";
import {
  XPointer,
  XPointerFunctions,
  XSphereCollider,
  XWebPointers,
} from "xinteraction/react";
import { Box, OrbitControls } from "@react-three/drei";
import { Group, Mesh, Vector3Tuple } from "three";

export default function App() {
  return (
    <Canvas
      style={{ width: "100wh", height: "100vh" }}
      camera={{ position: [0, 0, -5] }}
      events={() => ({
        enabled: false,
        priority: 0,
      })}
    >
      <OrbitControls />
      <XWebPointers />
      <ambientLight />
      <ColliderSphere id={99} />
      <RotateCubePointer id={100} position={[0, 0, 0]} />
      <RotateCubePointer id={101} position={[0, 0, -3]} />
      <directionalLight position={[-1, -1, -1]} />
      <HoverBox position={[-2, 0, 0]} />
      <HoverBox position={[-2, 0, -2]} />
      <HoverBox position={[2, 0.5, 0]} />
      <HoverBox position={[4, 0, 0]} />
      <HoverBox position={[-4, 0, 0]} />
    </Canvas>
  );
}

//TODO: make sure that dragging a pressed pointer on an object causes a pointer down event

function RotateCubePointer({
  id,
  ...props
}: {
  id: number;
  position?: Vector3Tuple;
}) {
  const ref = useRef<Mesh>(null);
  const pointerRef = useRef<XPointerFunctions>(null);
  const [pressed, setPressed] = useState<Array<number>>([]);
  useFrame((_, delta) => {
    if (ref.current == null) {
      return;
    }
    ref.current.rotateY(delta * 1);
  });
  return (
    <Box
      onPointerDown={(e) => {
        e.stopPropagation();
        setPressed((c) => {
          if (c.length === 0) {
            pointerRef.current?.press(1, e);
          }
          return [...c, e.pointerId];
        });
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setPressed((c) => {
          const result = c.filter((id) => id != e.pointerId);
          if (result.length === 0) {
            pointerRef.current?.release(1, e);
          }
          return result;
        });
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        setPressed((c) => {
          const result = c.filter((id) => id != e.pointerId);
          if (result.length === 0) {
            pointerRef.current?.release(1, e);
          }
          return result;
        });
      }}
      {...props}
      ref={ref}
    >
      <XPointer ref={pointerRef} id={id} visualize />
    </Box>
  );
}

function ColliderSphere({ id }: { id: number }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (ref.current == null) {
      return;
    }
    ref.current.position.x = Math.sin(clock.elapsedTime * 0.1) * 9;
  });
  return (
    <group ref={ref}>
      <XSphereCollider
        id={id}
        radius={0.5}
        downDistance={0.1}
        enterDistance={0.5}
        visualize
      />
    </group>
  );
}

function HoverBox(props: MeshProps) {
  const [hovered, setHovered] = useState<Array<number>>([]);
  const [pressed, setPressed] = useState<Array<number>>([]);
  return (
    <mesh
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHovered((c) => [...c, e.pointerId]);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHovered((c) => c.filter((id) => id != e.pointerId));
        setPressed((c) => c.filter((id) => id != e.pointerId));
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        setPressed((c) => [...c, e.pointerId]);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        setPressed((c) => c.filter((id) => id != e.pointerId));
      }}
      {...props}
    >
      <boxGeometry />
      <meshPhongMaterial
        color={
          pressed.length > 0 ? "green" : hovered.length > 0 ? "red" : "blue"
        }
      />
    </mesh>
  );
}
