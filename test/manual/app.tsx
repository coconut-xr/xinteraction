import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Canvas,
  GroupProps,
  MeshProps,
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  InputDeviceFunctions,
  XSphereCollider,
  XStraightPointer,
  XWebPointers,
} from "xinteraction/react";
import { Box, OrbitControls } from "@react-three/drei";
import {
  BufferGeometry,
  Group,
  MOUSE,
  Mesh,
  Object3D,
  SphereGeometry,
  Vector3,
  Vector3Tuple,
} from "three";
import { Container, RootContainer, Text } from "@coconut-xr/koestlich";
import {
  Select,
  Button,
  Checkbox,
  Dropdown,
  DropdownContent,
  Link,
  Progess,
  Radio,
  Slider,
  StepConnection,
  StepNumber,
  StepNumbers,
  StepTitle,
  StepTitles,
  Steps,
  Tab,
  Table,
  TableCell,
  TableRow,
  Tabs,
  Toggle,
} from "@coconut-xr/kruemel";
import { loadYoga } from "@coconut-xr/flex";
import {
  Plus,
  Play,
  Pause,
  Trash,
  MagnifyingGlass,
  Bars3,
} from "@coconut-xr/kruemel/icons/solid";

const tableData = [
  ["Entry Name", "Entry Number", "Entry Description"],
  ["ABC", "1", "ABC is CBA reversed"],
  ["Koestlich", "2", "User Interfaces for Three.js"],
  ["Coconut XR", "3", "Powered by Coconut Capital GmbH"],
];

const lineGeometry = new BufferGeometry().setFromPoints([
  new Vector3(),
  new Vector3(0, 0, 100),
]);
const sphereGeometry = new SphereGeometry(1);

export default function App() {
  return (
    <Canvas
      style={{ width: "100wh", height: "100vh" }}
      camera={{ position: [0, 0, -5] }}
      gl={{ localClippingEnabled: true }}
      events={() => ({
        enabled: false,
        priority: 0,
      })}
    >
      <OrbitControls
        target={[0, 0, 0]}
        enableZoom={false}
        enablePan={false}
        minDistance={5}
        maxDistance={5}
        mouseButtons={{
          LEFT: MOUSE.RIGHT,
          MIDDLE: MOUSE.MIDDLE,
          RIGHT: MOUSE.LEFT,
        }}
      />
      <XWebPointers />
      <ambientLight />
      <ColliderSelectSphere id={98} />
      <ColliderSphere id={99} />
      <RotateCubePointer id={100} position={[0, 0, 0]} />
      <RotateCubePointer id={101} position={[0, 0, -3]} />
      <directionalLight position={[-1, -1, -1]} />
      <HoverBox position={[-2, 0, 0]} />
      <HoverBox position={[-2, 0, -2]} />
      <HoverBox position={[2, 0.5, 0]} />
      <HoverBox position={[4, 0, 0]} />
      <HoverBox position={[-4, 0, 0]} />
      <DragCube position={[-4, 0, -4]} />
      <Koestlich position={[0, 5, -6]} />
    </Canvas>
  );
}

function DragCube({ position }: { position: Vector3Tuple }) {
  const ref = useRef<Group>(null);
  const downState = useRef<{
    pointerId: number;
    point: Vector3;
    box: Vector3;
  }>();
  useEffect(() => {
    if (ref.current == null) {
      return;
    }
    ref.current.position.set(...position);
  }, []);
  return (
    <group
      onPointerDown={(e) => {
        if (ref.current == null || downState.current != null) {
          return;
        }
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        downState.current = {
          pointerId: e.pointerId,
          box: ref.current.position.clone(),
          point: e.point,
        };
      }}
      onPointerUp={() => {
        downState.current = undefined;
      }}
      onPointerMove={(e) => {
        if (
          ref.current == null ||
          downState.current == null ||
          e.pointerId != downState.current.pointerId
        ) {
          return;
        }
        ref.current.position
          .copy(e.point)
          .sub(downState.current.point)
          .add(downState.current.box);
      }}
      ref={ref}
    >
      <Box>
        <meshBasicMaterial color="yellow" toneMapped={false} />
      </Box>
    </group>
  );
}

function RotateCubePointer({
  id,
  ...props
}: {
  id: number;
  position?: Vector3Tuple;
}) {
  const ref = useRef<Group>(null);
  const pointerRef = useRef<InputDeviceFunctions>(null);
  useFrame((_, delta) => {
    if (ref.current == null) {
      return;
    }
    ref.current.rotateY(delta * 1);
  });
  return (
    <group {...props} ref={ref}>
      <Box
        onPointerDown={(e) => {
          if ((e as any).inputDeviceId === 98) {
            return;
          }
          e.stopPropagation();
          pointerRef.current?.press(e.pointerId, e);
        }}
        onPointerUp={(e) => {
          if ((e as any).inputDeviceId === 98) {
            return;
          }
          e.stopPropagation();
          pointerRef.current?.release(e.pointerId, e);
        }}
      >
        <group position={[0, 0, 0.6]}>
          <XStraightPointer ref={pointerRef} id={id} />
        </group>
      </Box>
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color="red" toneMapped={false} />
      </lineSegments>
    </group>
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
        distanceElement={{ id: 1, downDistance: 0.1 }}
        enterDistance={0.5}
      />
      <mesh scale={0.5} geometry={sphereGeometry}>
        <meshBasicMaterial color="red" toneMapped={false} />
      </mesh>
    </group>
  );
}

function ColliderSelectSphere({ id }: { id: number }) {
  const ref = useRef<Group>(null);
  const sphereRef = useRef<InputDeviceFunctions>(null);
  const keyPressMap = useMemo(() => new Set<string>(), []);
  useEffect(() => {
    const keyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        sphereRef.current?.press(1, e);
      }
      keyPressMap.add(e.key);
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        sphereRef.current?.release(1, e);
      }
      keyPressMap.delete(e.key);
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };
  }, []);
  useFrame((_, delta) => {
    if (ref.current == null) {
      return;
    }
    if (keyPressMap.has("w")) {
      ref.current.position.z += delta * 1;
    }
    if (keyPressMap.has("s")) {
      ref.current.position.z -= delta * 1;
    }
    if (keyPressMap.has("a")) {
      ref.current.position.x -= delta * 1;
    }
    if (keyPressMap.has("d")) {
      ref.current.position.x += delta * 1;
    }
  });
  return (
    <group ref={ref} position={[0, 0, 0]}>
      <XSphereCollider
        ref={sphereRef}
        id={id}
        radius={0.5}
        enterDistance={0.5}
      />
      <mesh scale={0.5} geometry={sphereGeometry}>
        <meshBasicMaterial color="violet" toneMapped={false} />
      </mesh>
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
        toneMapped={false}
      />
    </mesh>
  );
}

function Koestlich(props: GroupProps) {
  const [checked, setChecked] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [sliderValue, setSliderValue] = useState(0.5);

  return (
    <group {...props}>
      <RootContainer
        height={3}
        width={3}
        alignItems="flex-start"
        padding={0.05}
        overflow="scroll"
        flexDirection="column"
        loadYoga={loadYoga}
      >
        <Text fontSize={0.2}>Button</Text>
        <Button onClick={() => setChecked((checked) => !checked)}>
          Toggle Checked
        </Button>

        <Text fontSize={0.2} marginTop={0.1}>
          Checkbox
        </Text>
        <Container
          alignItems="center"
          flexDirection="row"
          onClick={() => setChecked((checked) => !checked)}
        >
          <Checkbox marginRight={0.02} checked={checked} />
          <Text>Checked</Text>
        </Container>

        <Text fontSize={0.2} marginTop={0.1}>
          Toggle
        </Text>
        <Container
          alignItems="center"
          flexDirection="row"
          onClick={() => setChecked((checked) => !checked)}
        >
          <Toggle marginRight={0.02} checked={checked} />
          <Text>Checked</Text>
        </Container>

        <Text fontSize={0.2} marginTop={0.1}>
          Dropdown
        </Text>
        <Dropdown>
          <Button onClick={() => setChecked((checked) => !checked)}>
            Toggle Dropdown
          </Button>
          <DropdownContent
            border={0.003}
            borderColor="black"
            borderOpacity={0.5}
            padding={0.015}
            open={checked}
          >
            <Text>Dropdown Content</Text>
          </DropdownContent>
        </Dropdown>

        <Text fontSize={0.2} marginTop={0.2}>
          Slider
        </Text>
        <Slider value={sliderValue} range={10} onChange={setSliderValue} />

        <Text fontSize={0.2} marginTop={0.1}>
          Select
        </Text>
        <Select
          value={activeTab}
          options={new Array(3)
            .fill(null)
            .map((_, i) => ({ value: i, label: `Option ${i + 1}` }))}
          onChange={setActiveTab}
        />

        <Text fontSize={0.2} marginTop={0.1}>
          Radio
        </Text>
        <Container alignItems="center" flexDirection="column">
          {new Array(3).fill(null).map((_, i) => (
            <Container
              key={i}
              alignItems="center"
              flexDirection="row"
              onClick={() => setActiveTab(i)}
            >
              <Radio
                marginRight={0.02}
                checked={i === activeTab ? true : false}
              />
              <Text>{`Radio ${i + 1}`}</Text>
            </Container>
          ))}
        </Container>

        <Text fontSize={0.2} marginTop={0.1}>
          Tabs
        </Text>
        <Tabs width="100%">
          {new Array(3).fill(null).map((_, i) => (
            <Tab
              key={i}
              onClick={() => setActiveTab(i)}
              active={i === activeTab}
            >{`Tab ${i + 1}`}</Tab>
          ))}
        </Tabs>

        <Text fontSize={0.2} marginTop={0.1}>
          Table
        </Text>
        <Table>
          {tableData.map((rowData, rowIndex) => (
            <TableRow key={rowIndex}>
              {rowData.map((cellData, columnIndex) => (
                <TableCell key={columnIndex}>
                  <Text>{cellData}</Text>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </Table>
        <Text fontSize={0.2} marginTop={0.1}>
          Link
        </Text>
        <Container flexDirection="row">
          <Text>Find our Website </Text>
          <Link href="https://coconut-xr.com" target="_blank">
            here.
          </Link>
        </Container>

        <Text fontSize={0.2} marginTop={0.1}>
          Steps
        </Text>
        <Steps maxWidth={4}>
          <StepNumbers>
            <StepNumber>1</StepNumber>
            <StepConnection />
            <StepNumber>2</StepNumber>
            <StepConnection />
            <StepNumber>3</StepNumber>
            <StepConnection backgroundColor="gray" />
            <StepNumber backgroundColor="gray">4</StepNumber>
          </StepNumbers>
          <StepTitles>
            <StepTitle>Login</StepTitle>
            <StepTitle>Do Something</StepTitle>
            <StepTitle>Logout</StepTitle>
            <StepTitle>Shut Down</StepTitle>
          </StepTitles>
        </Steps>

        <Text fontSize={0.2} marginTop={0.1}>
          Icons
        </Text>
        <Container flexWrap="wrap" flexDirection="row" gapColumn={0.1}>
          <Plus />
          <Play />
          <Pause />
          <Trash />
          <MagnifyingGlass />
        </Container>

        <Text fontSize={0.2} marginTop={0.1}>
          Pagination
        </Text>
        <Container flexDirection="row">
          <Button>1</Button>
          <Button backgroundColor="gray">2</Button>
          <Button backgroundColor="gray">3</Button>
          <Button backgroundColor="gray">4</Button>
        </Container>

        <Text fontSize={0.2} marginTop={0.1}>
          Navbar
        </Text>

        <Container
          width="100%"
          maxWidth={4}
          backgroundColor="black"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          paddingY={0.06}
          paddingX={0.1}
          gapColumn={0.1}
        >
          <Bars3 height={0.05} color="white" />
          <Text color="white" fontSize={0.1}>
            COCONUT-XR
          </Text>
          <Container flexGrow={1} />
          <MagnifyingGlass color="white" />
          <Plus color="white" />
        </Container>

        <Text fontSize={0.2} marginTop={0.1}>
          Progress
        </Text>
        <Progess value={0.5} />
      </RootContainer>
    </group>
  );
}
