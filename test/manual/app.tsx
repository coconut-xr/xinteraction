import { useState } from "react";
import { Canvas, MeshProps } from "@react-three/fiber";
import { Web2DPointers } from "../../dist/react/web-2d-pointers.js";

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
      <Web2DPointers />
      <ambientLight />
      <directionalLight position={[-1, -1, -1]} />
      <HoverBox position={[-2, 0, 0]} />
      <HoverBox position={[-2, 0, -2]} />
      <HoverBox position={[2, 0, 0]} />
    </Canvas>
  );
}

function HoverBox(props: MeshProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <mesh
      onPointerEnter={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
      {...props}
    >
      <boxGeometry />
      <meshPhongMaterial color={hovered ? "red" : "blue"} />
    </mesh>
  );
}
