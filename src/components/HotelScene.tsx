import { Environment, Lightformer, OrbitControls, Text } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { HotelFloor } from "../data/floors";
import { SurfaceUVs } from "../three/Surface";
import { StaticContactShadows, StaticShadowMap } from "../three/performance";
import {
  BLOCK_D,
  BLOCK_W,
  FLOOR_HEIGHT,
  GROUND_Y,
  buildLevel,
  buildSite,
  type ExteriorPart,
} from "./building/architecture";
import { ExteriorMaterial, SHADOW_PARTS, type LevelState } from "./building/materials";

type HotelSceneProps = {
  floors: HotelFloor[];
  selectedFloor: number | null;
  onSelectFloor: (id: number) => void;
  onHoverFloor: (id: number | null) => void;
  onFocusBuilding: () => void;
  resetSignal: number;
  controlsLocked: boolean;
};

const GOLD = "#efc07b";
const noRaycast = () => null;

/** Renders merged architecture: one mesh per material key. */
function MergedParts({ parts, state }: { parts: Map<string, THREE.BufferGeometry>; state: LevelState }) {
  useEffect(() => () => parts.forEach((geometry) => geometry.dispose()), [parts]);
  return (
    <>
      {[...parts].map(([key, geometry]) => {
        const part = key as ExteriorPart;
        const shadows = SHADOW_PARTS.has(part);
        return (
          <mesh
            key={key}
            geometry={geometry}
            castShadow={shadows}
            receiveShadow={shadows}
            raycast={noRaycast}
          >
            <ExteriorMaterial part={part} state={state} />
          </mesh>
        );
      })}
    </>
  );
}

function FloorLevel({
  floor,
  isActive,
  isHovered,
  hasSelection,
  onHover,
  onSelect,
}: {
  floor: HotelFloor;
  isActive: boolean;
  isHovered: boolean;
  hasSelection: boolean;
  onHover: (id: number | null) => void;
  onSelect: (id: number) => void;
}) {
  const parts = useMemo(() => buildLevel(floor.id), [floor.id]);
  const outline = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(BLOCK_W + 0.16, FLOOR_HEIGHT, BLOCK_D + 0.16)),
    [],
  );
  useEffect(() => () => outline.dispose(), [outline]);

  const y = GROUND_Y + floor.id * FLOOR_HEIGHT;
  const highlight = isActive || isHovered;
  const state: LevelState = highlight ? "active" : hasSelection ? "dim" : "normal";
  const clickFloor = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(floor.id);
  };
  const hoverFloor = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHover(floor.id);
  };
  // Floor numbers sit on the front face of the left corner pier; on the
  // set-back storeys they hang just in front of the terrace guard.
  const labelZ = floor.id >= 4 ? BLOCK_D / 2 + 0.06 : BLOCK_D / 2 + 0.052;

  return (
    <group position={[0, y, 0]}>
      {/* Invisible hit volume: the only interactive object for this storey. */}
      <mesh
        position={[0, FLOOR_HEIGHT / 2, 0]}
        onClick={clickFloor}
        onPointerOver={hoverFloor}
        onPointerOut={(event) => {
          event.stopPropagation();
          onHover(null);
        }}
      >
        <boxGeometry args={[BLOCK_W + 0.2, FLOOR_HEIGHT - 0.06, BLOCK_D + 0.2]} />
        <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
      </mesh>

      <MergedParts parts={parts} state={state} />

      {highlight && (
        <lineSegments position={[0, FLOOR_HEIGHT / 2, 0]} geometry={outline} raycast={noRaycast}>
          <lineBasicMaterial color={GOLD} transparent opacity={isActive ? 0.85 : 0.5} depthWrite={false} />
        </lineSegments>
      )}

      <Text
        position={[-BLOCK_W / 2 + 0.06, FLOOR_HEIGHT / 2, labelZ]}
        fontSize={0.1}
        color={highlight ? "#f0d7ad" : "#6f6455"}
        anchorX="center"
        anchorY="middle"
        raycast={noRaycast}
      >
        {floor.id === 0 ? "G" : String(floor.id).padStart(2, "0")}
      </Text>

      {floor.id === 0 && (
        // Backlit lettering on the entrance canopy fascia.
        <Text
          position={[0, FLOOR_HEIGHT - 0.205, BLOCK_D / 2 + 0.86 + 0.022]}
          fontSize={0.05}
          letterSpacing={0.45}
          color="#f6dfb2"
          anchorX="center"
          anchorY="middle"
          raycast={noRaycast}
        >
          AURELIA
        </Text>
      )}
      {floor.id === 5 && (
        // Bronze letters on the travertine crown band.
        <Text
          position={[0, 0, BLOCK_D / 2 + 0.05 + 0.032]}
          fontSize={0.09}
          letterSpacing={0.55}
          color="#4a3a29"
          anchorX="center"
          anchorY="middle"
          raycast={noRaycast}
        >
          AURELIA
        </Text>
      )}
    </group>
  );
}

function CameraRig({
  selectedFloor,
  resetSignal,
  controls,
}: {
  selectedFloor: number | null;
  resetSignal: number;
  controls: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera, size, invalidate } = useThree();
  const cameraTarget = useRef(new THREE.Vector3(8, 6, 12));
  const controlsTarget = useRef(new THREE.Vector3(0, 2.85, 0));
  const isAnimating = useRef(false);

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = size.width < 640 ? 48 : selectedFloor === null ? 52 : 36;
      camera.updateProjectionMatrix();
    }
  }, [camera, selectedFloor, size.width]);

  useEffect(() => {
    if (selectedFloor === null) {
      cameraTarget.current.set(8, 6.15, 12);
      controlsTarget.current.set(0, 2.85, 0);
    } else {
      const focusY = GROUND_Y + selectedFloor * FLOOR_HEIGHT + FLOOR_HEIGHT / 2;
      controlsTarget.current.set(0, focusY, 0);
      cameraTarget.current.set(4.1, focusY + 1.25, 7.5);
    }
    isAnimating.current = true;
    invalidate();
  }, [selectedFloor, resetSignal, invalidate]);

  useFrame((state, delta) => {
    if (!isAnimating.current || !controls.current) return;
    state.invalidate();

    const easing = 1 - Math.exp(-delta * 2.4);
    controls.current.target.lerp(controlsTarget.current, easing);
    camera.position.lerp(cameraTarget.current, easing);
    controls.current.update();

    if (
      camera.position.distanceToSquared(cameraTarget.current) < 0.0004 &&
      controls.current.target.distanceToSquared(controlsTarget.current) < 0.0004
    ) {
      camera.position.copy(cameraTarget.current);
      controls.current.target.copy(controlsTarget.current);
      controls.current.update();
      isAnimating.current = false;
    }
  });

  return null;
}

function Building({
  floors,
  selectedFloor,
  onSelectFloor,
  onHoverFloor,
}: Pick<HotelSceneProps, "floors" | "selectedFloor" | "onSelectFloor" | "onHoverFloor">) {
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);
  const site = useMemo(() => buildSite(), []);
  const handleHover = (floorId: number | null) => {
    setHoveredFloor(floorId);
    onHoverFloor(floorId);
  };

  return (
    <group>
      <MergedParts parts={site} state="normal" />
      {floors.map((floor) => (
        <FloorLevel
          key={floor.id}
          floor={floor}
          isActive={selectedFloor === floor.id}
          isHovered={hoveredFloor === floor.id}
          hasSelection={selectedFloor !== null}
          onHover={handleHover}
          onSelect={onSelectFloor}
        />
      ))}
    </group>
  );
}

export default function HotelScene({
  floors,
  selectedFloor,
  onSelectFloor,
  onHoverFloor,
  onFocusBuilding,
  resetSignal,
  controlsLocked,
}: HotelSceneProps) {
  const controls = useRef<OrbitControlsImpl | null>(null);

  return (
    <Canvas
      shadows
      frameloop="demand"
      dpr={[1, 1.7]}
      camera={{ position: [8, 6.15, 12], fov: 36, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
      }}
      onPointerMissed={() => undefined}
      onDoubleClick={() => onFocusBuilding()}
    >
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 18, 32]} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#e2ddcf", "#373027", 1.15]} />
      <directionalLight
        position={[-7, 12, 8]}
        intensity={2.35}
        color="#ffe0b0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-far={30}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={12}
        shadow-camera-bottom={-5}
      />
      <pointLight position={[5, 5, -4]} intensity={24} color="#cbd6d6" />
      {/* Warm 2700 K pools at the entrance: street side and under the canopy. */}
      <pointLight position={[0, 1, BLOCK_D / 2 + 2.2]} intensity={7} distance={7} color="#e3b978" />
      <pointLight
        position={[0, GROUND_Y + FLOOR_HEIGHT - 0.35, BLOCK_D / 2 + 0.45]}
        intensity={2.2}
        distance={2.6}
        color="#ffc27a"
      />
      <Environment resolution={128} background={false}>
        <Lightformer form="rect" intensity={2.3} position={[-5, 5, -5]} scale={[8, 5, 1]} color="#e5dfd1" />
        <Lightformer form="rect" intensity={1.7} position={[5, 4, 4]} scale={[6, 4, 1]} color="#f3d9ac" />
        <Lightformer form="rect" intensity={1.4} position={[0, 6, 0]} scale={[10, 0.5, 1]} color="#fff4dd" />
      </Environment>
      <SurfaceUVs />
      <Building
        floors={floors}
        selectedFloor={selectedFloor}
        onSelectFloor={onSelectFloor}
        onHoverFloor={onHoverFloor}
      />
      <StaticShadowMap />
      <StaticContactShadows
        position={[0, 0.002, 0]}
        opacity={0.42}
        scale={13}
        blur={2.6}
        far={5}
        resolution={512}
        color="#070807"
      />
      <CameraRig
        selectedFloor={selectedFloor}
        resetSignal={resetSignal}
        controls={controls}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        enabled={!controlsLocked}
        enableDamping
        dampingFactor={0.065}
        minDistance={7}
        maxDistance={23}
        minPolarAngle={0.18}
        maxPolarAngle={Math.PI / 2.03}
        target={[0, 2.85, 0]}
        panSpeed={0.65}
        rotateSpeed={0.55}
      />
    </Canvas>
  );
}
