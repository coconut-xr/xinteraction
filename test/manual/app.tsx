import { useCallback, useRef, useState } from "react";
import { Canvas, MeshProps, useFrame } from "@react-three/fiber";
import { XPointer, XPointerFunctions, XWebPointers } from "xinteraction/react";
import { Box, OrbitControls } from "@react-three/drei";
import { Mesh, Vector3Tuple } from "three";

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
      <RotateCubePointer id={100} position={[0, 0, 0]} />
      <RotateCubePointer id={101} position={[0, 0, -3]} />
      <directionalLight position={[-1, -1, -1]} />
      <HoverBox position={[-2, 0, 0]} />
      <HoverBox position={[-2, 0, -2]} />
      <HoverBox position={[2, 0.5, 0]} />
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
  useFrame((_, delta) => {
    if (ref.current == null) {
      return;
    }
    ref.current.rotateY(delta * 1);
  });
  return (
    <Box
      onPointerDown={(event) => pointerRef.current?.press(event.button, event)}
      onPointerUp={(event) => pointerRef.current?.release(event.button, event)}
      {...props}
      ref={ref}
    >
      <XPointer ref={pointerRef} id={id} visualize />
    </Box>
  );
}

function HoverBox(props: MeshProps) {
  const [hovered, setHovered] = useState(0);
  const [pressed, setPressed] = useState(0);
  return (
    <mesh
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHovered((c) => c + 1);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHovered((c) => c - 1);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        setPressed((c) => c + 1);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        setPressed((c) => c - 1);
      }}
      {...props}
    >
      <boxGeometry />
      <meshPhongMaterial
        color={pressed > 0 ? "green" : hovered > 0 ? "red" : "blue"}
      />
    </mesh>
  );
}
