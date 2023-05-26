import React from "react";
import { Canvas } from "@react-three/fiber";
import { BoxGeometry } from "three";

export default function App() {
  return (
    <Canvas
      style={{ width: "100wh", height: "100vh" }}
      camera={{ position: [0, 0, -5] }}
    >
      <ambientLight />
      <directionalLight position={[-1,-1,-1]}/>
      <mesh position={[0, 0, 0]}>
        <boxGeometry />
        <meshPhongMaterial color="red" />
      </mesh>
      <mesh position={[-2, 0, 0]}>
        <boxGeometry />
        <meshPhongMaterial color="green" />
      </mesh>
      <mesh position={[2, 0, 0]}>
        <boxGeometry />
        <meshPhongMaterial color="blue" />
      </mesh>
    </Canvas>
  );
}
