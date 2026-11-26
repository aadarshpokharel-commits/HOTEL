import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { HotelFloor } from "../data/floors";

export type InteriorFeature = {
  id: string;
  name: string;
  note: string;
};

type InteriorSceneProps = {
  floor: HotelFloor;
  resetSignal: number;
  onFeatureSelect: (feature: InteriorFeature) => void;
};

const FEATURES: Record<number, InteriorFeature[]> = {
  0: [
    { id: "reception-desk", name: "The reception desk", note: "A sculptural walnut welcome counter, fluted by hand and finished with warm champagne-brass details." },
    { id: "lobby-lounge", name: "The guest lounge", note: "A quiet sitting area with tailored upholstery, a hand-finished coffee table, and soft Italian textiles." },
    { id: "reception-flowers", name: "Fresh floral arrangements", note: "Seasonal garden roses and delicate greenery bring a fresh welcome to the heart of the lobby." },
    { id: "lobby-artwork", name: "The art collection", note: "Original botanical studies and abstract Milanese landscapes, framed in dark walnut and brass." },
  ],
  1: [
    { id: "suite-bed", name: "The bedroom", note: "A calm bedroom with a tailored headboard and crisp hotel linens." },
    { id: "chef-table", name: "The living hall", note: "An open hall arranged for conversation, dining, and a little lingering." },
    { id: "bathroom", name: "The marble bathroom", note: "A private bath with a walk-in shower, vanity, and brushed brass fittings." },
    { id: "toilet", name: "The private water closet", note: "A separate, private toilet room with its own door and quiet detailing." },
  ],
  2: [
    { id: "king-bed", name: "The bedroom", note: "A quiet bedroom with layered linen, walnut, and warm bedside lighting." },
    { id: "reading-chair", name: "The living hall", note: "A welcoming lounge with sculptural seating and a reading corner." },
    { id: "bathroom", name: "The marble bathroom", note: "A private bath with a walk-in shower, vanity, and brushed brass fittings." },
    { id: "toilet", name: "The private water closet", note: "A separate, private toilet room with its own door and quiet detailing." },
    { id: "writing-desk", name: "The writing desk", note: "A considered workspace in warm walnut." },
  ],
  3: [
    { id: "suite-bed", name: "The bedroom", note: "A generous bedroom with sculptural upholstered details and city views." },
    { id: "lounge-sofa", name: "The living hall", note: "A residential lounge with generous, tactile seating." },
    { id: "bathroom", name: "The marble bathroom", note: "A private bath with a walk-in shower, vanity, and brushed brass fittings." },
    { id: "toilet", name: "The private water closet", note: "A separate, private toilet room with its own door and quiet detailing." },
  ],
  4: [
    { id: "canopy-bed", name: "The bedroom", note: "A spacious bedroom layered in soft stone, linen, and walnut." },
    { id: "living-room", name: "The living hall", note: "A private salon for conversation and unhurried afternoons." },
    { id: "bathroom", name: "The marble bathroom", note: "A private bath with a walk-in shower, vanity, and brushed brass fittings." },
    { id: "toilet", name: "The private water closet", note: "A separate, private toilet room with its own door and quiet detailing." },
    { id: "dining-table", name: "The dining table", note: "Intimate dinners, set around a solid oak table." },
  ],
  5: [
    { id: "penthouse-bed", name: "The bedroom", note: "An elevated bedroom retreat with a view over the rooftops." },
    { id: "panoramic-lounge", name: "The living hall", note: "A private salon framed by the Milan skyline." },
    { id: "bathroom", name: "The marble bathroom", note: "A private bath with a walk-in shower, vanity, and brushed brass fittings." },
    { id: "toilet", name: "The private water closet", note: "A separate, private toilet room with its own door and quiet detailing." },
    { id: "terrace", name: "The terrace", note: "A private terrace, just beyond your own quiet corner." },
  ],
};

function createSurfaceTexture(surface: "oak" | "walnut" | "linen" | "stone", size = 256) {
  const data = new Uint8Array(size * size * 4);
  const palette = {
    oak: [146, 124, 96],
    walnut: [115, 82, 54],
    linen: [218, 210, 196],
    stone: [190, 181, 163],
  }[surface];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const wave = surface === "oak" || surface === "walnut"
        ? Math.sin(y * 0.21 + Math.sin(x * 0.045) * 1.8) * 3 +
          Math.sin(y * 0.73 + x * 0.025) * 1.4
        : surface === "stone"
          ? Math.sin(x * 0.055 + Math.sin(y * 0.035) * 2.8) * 2.4
          : Math.sin(x * 0.82) * Math.sin(y * 0.74) * 2.1;
      const grain = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      const noise = ((grain - Math.floor(grain)) - 0.5) * (surface === "linen" ? 9 : 6);
      let seam = 0;
      if (surface === "oak") {
        const row = y % 16;
        const column = (x + (Math.floor(y / 16) % 2) * 64) % 128;
        if (row < 2 || column < 2) seam = -23;
        else if (row < 4 || column < 4) seam = -7;
      }
      const variation = wave + noise + seam;
      data[index] = Math.max(0, Math.min(255, palette[0] + variation));
      data[index + 1] = Math.max(0, Math.min(255, palette[1] + variation * 0.94));
      data[index + 2] = Math.max(0, Math.min(255, palette[2] + variation * 0.82));
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(surface === "oak" ? 4 : 1, surface === "oak" ? 2 : 1);
  texture.needsUpdate = true;
  return texture;
}

const OAK_TEXTURE = createSurfaceTexture("oak");
const WALNUT_TEXTURE = createSurfaceTexture("walnut");
const LINEN_TEXTURE = createSurfaceTexture("linen");
const STONE_TEXTURE = createSurfaceTexture("stone");

function Interactive({
  feature,
  active,
  onSelect,
  children,
  indicatorPosition = [0, 0, 0],
}: {
  feature: InteriorFeature;
  active: boolean;
  onSelect: (feature: InteriorFeature) => void;
  children: ReactNode;
  indicatorPosition?: [number, number, number];
}) {
  const [hovered, setHovered] = useState(false);
  const handlePointer = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
  };
  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(false);
  };

  // Tie the pointer cursor to hover state so it is also restored when this
  // object unmounts mid-hover (floor change, reset, leaving the interior).
  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  // Scale around the object's own footprint rather than the room origin,
  // so hovered furniture grows in place instead of sliding sideways.
  const [pivotX, , pivotZ] = indicatorPosition;
  const highlighted = hovered || active;

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect(feature);
      }}
      onPointerOver={handlePointer}
      onPointerOut={handlePointerOut}
    >
      <group position={[pivotX, 0, pivotZ]} scale={highlighted ? 1.025 : 1}>
        <group position={[-pivotX, 0, -pivotZ]}>{children}</group>
      </group>
      {highlighted && (
        <mesh position={[pivotX, 0.045, pivotZ]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <ringGeometry args={[0.48, 0.51, 40]} />
          <meshBasicMaterial
            color="#d5b987"
            transparent
            opacity={0.85}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

function FloorSurface() {
  return (
    <group>
      <mesh position={[0, -0.13, 0]} receiveShadow>
        <boxGeometry args={[13, 0.25, 9.2]} />
        <meshStandardMaterial
          map={OAK_TEXTURE}
          bumpMap={OAK_TEXTURE}
          bumpScale={0.009}
          color="#fffaf0"
          roughness={0.78}
        />
      </mesh>
      <group position={[1.8, 0.012, 0.65]} receiveShadow>
        <mesh receiveShadow>
          <boxGeometry args={[4.8, 0.025, 3.4]} />
          <meshStandardMaterial color="#17394b" roughness={0.94} />
        </mesh>
        <mesh position={[0, 0.015, 0]} receiveShadow>
          <boxGeometry args={[4.7, 0.012, 3.3]} />
          <meshStandardMaterial color="#c99d54" roughness={0.68} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.026, 0]} receiveShadow>
          <boxGeometry args={[4.58, 0.012, 3.18]} />
          <meshStandardMaterial
            map={LINEN_TEXTURE}
            bumpMap={LINEN_TEXTURE}
            bumpScale={0.004}
            color="#e5ddcf"
            roughness={0.98}
          />
        </mesh>
        {[-2.16, 2.16].map((x) => (
          <mesh key={`carpet-side-border-${x}`} position={[x, 0.035, 0]}>
            <boxGeometry args={[0.035, 0.006, 2.78]} />
            <meshStandardMaterial color="#17394b" roughness={0.92} />
          </mesh>
        ))}
        {[-1.36, 1.36].map((z) => (
          <mesh key={`carpet-end-border-${z}`} position={[0, 0.035, z]}>
            <boxGeometry args={[4.35, 0.006, 0.035]} />
            <meshStandardMaterial color="#17394b" roughness={0.92} />
          </mesh>
        ))}
        {[-2.06, 2.06].map((x) => (
          <mesh key={`carpet-gold-side-${x}`} position={[x, 0.039, 0]}>
            <boxGeometry args={[0.012, 0.004, 2.62]} />
            <meshStandardMaterial color="#c99d54" roughness={0.55} metalness={0.18} />
          </mesh>
        ))}
        {[-1.26, 1.26].map((z) => (
          <mesh key={`carpet-gold-end-${z}`} position={[0, 0.039, z]}>
            <boxGeometry args={[4.1, 0.004, 0.012]} />
            <meshStandardMaterial color="#c99d54" roughness={0.55} metalness={0.18} />
          </mesh>
        ))}
        <group position={[0, 0.042, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.3, 0.34, 48]} />
            <meshStandardMaterial color="#c99d54" roughness={0.55} metalness={0.18} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.17, 0.19, 40]} />
            <meshStandardMaterial color="#17394b" roughness={0.92} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.1, 32]} />
            <meshStandardMaterial color="#c99d54" roughness={0.55} metalness={0.18} />
          </mesh>
          {[-1, 1].flatMap((side) =>
            [-1, 1].map((depthSide) => (
              <mesh
                key={`${side}-${depthSide}`}
                position={[side * 1.9, 0.002, depthSide * 1.12]}
                rotation={[0, Math.PI / 4, 0]}
              >
                <boxGeometry args={[0.16, 0.004, 0.16]} />
                <meshStandardMaterial color="#c99d54" roughness={0.55} metalness={0.18} />
              </mesh>
            )),
          )}
        </group>
      </group>
    </group>
  );
}

function RoomShell() {
  return (
    <group>
      <FloorSurface />
      <mesh position={[-6.15, 1.18, 0]} receiveShadow>
        <boxGeometry args={[0.22, 2.36, 9.1]} />
        <meshStandardMaterial map={STONE_TEXTURE} color="#cfc5b5" roughness={0.92} />
      </mesh>
      <mesh position={[6.15, 0.82, -1.7]} receiveShadow>
        <boxGeometry args={[0.2, 0.72, 5.7]} />
        <meshStandardMaterial
          map={STONE_TEXTURE}
          color="#c8bdac"
          roughness={0.92}
        />
      </mesh>
      <mesh position={[-3.9, 1.65, -4.45]} receiveShadow>
        <boxGeometry args={[4.5, 3.3, 0.18]} />
        <meshStandardMaterial map={STONE_TEXTURE} color="#d7cebf" roughness={0.92} />
      </mesh>
      <mesh position={[4.15, 1.65, -4.45]} receiveShadow>
        <boxGeometry args={[3.9, 3.3, 0.18]} />
        <meshStandardMaterial map={STONE_TEXTURE} color="#d7cebf" roughness={0.92} />
      </mesh>
      <mesh position={[0.1, 0.36, -4.39]} receiveShadow>
        <boxGeometry args={[3.45, 0.68, 0.22]} />
        <meshStandardMaterial color="#d2c7b7" roughness={0.92} />
      </mesh>
      <mesh position={[0.1, 1.97, -4.47]} castShadow receiveShadow>
        <boxGeometry args={[3.35, 2.55, 0.055]} />
        <meshStandardMaterial
          color="#354a48"
          roughness={0.18}
          metalness={0.2}
          transparent
          opacity={0.6}
        />
      </mesh>
      {[-1.53, 0.1, 1.73].map((x) => (
        <mesh key={x} position={[x, 1.97, -4.41]}>
          <boxGeometry args={[0.045, 2.6, 0.075]} />
          <meshStandardMaterial color="#9d805c" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0.1, 3.27, -4.41]}>
        <boxGeometry args={[3.35, 0.05, 0.075]} />
        <meshStandardMaterial color="#9d805c" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[-6.005, 0.14, 0]}>
        <boxGeometry args={[0.065, 0.2, 8.95]} />
        <meshStandardMaterial color="#a98b63" roughness={0.4} metalness={0.22} />
      </mesh>
      <mesh position={[6.02, 0.14, -1.7]}>
        <boxGeometry args={[0.065, 0.2, 5.55]} />
        <meshStandardMaterial color="#a98b63" roughness={0.4} metalness={0.22} />
      </mesh>
      {[-3.9, 4.15].map((x, index) => (
        <mesh key={x} position={[x, 0.14, -4.32]}>
          <boxGeometry args={[index ? 3.82 : 4.42, 0.2, 0.065]} />
          <meshStandardMaterial color="#a98b63" roughness={0.4} metalness={0.22} />
        </mesh>
      ))}
      <mesh position={[-6.005, 3.12, 0]}>
        <boxGeometry args={[0.08, 0.12, 8.95]} />
        <meshStandardMaterial color="#c5b69d" roughness={0.82} />
      </mesh>
      <mesh position={[6.02, 1.2, -1.7]}>
        <boxGeometry args={[0.08, 0.12, 5.55]} />
        <meshStandardMaterial color="#c5b69d" roughness={0.82} />
      </mesh>
    </group>
  );
}

function BathroomCutaway() {
  const wallMat = <meshStandardMaterial map={STONE_TEXTURE} color="#e2d9c9" roughness={0.88} />;
  const brassMat = <meshStandardMaterial color="#9d805c" roughness={0.32} metalness={0.62} />;
  return (
    <group>
      <mesh position={[4.05, 0.015, -2.78]} receiveShadow>
        <boxGeometry args={[4.05, 0.055, 3.22]} />
        <meshStandardMaterial map={STONE_TEXTURE} color="#c9bda8" roughness={0.27} metalness={0.04} />
      </mesh>
      <mesh position={[5.02, 0.018, -0.18]} receiveShadow>
        <boxGeometry args={[2.08, 0.06, 1.92]} />
        <meshStandardMaterial map={STONE_TEXTURE} color="#b7ad9c" roughness={0.29} />
      </mesh>
      <mesh position={[6.02, 0.82, -2.8]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 1.64, 3.3]} />
        {wallMat}
      </mesh>
      <mesh position={[4.05, 0.78, -4.38]} castShadow receiveShadow>
        <boxGeometry args={[4.05, 1.56, 0.16]} />
        {wallMat}
      </mesh>
      {[
        { x: 2.08, z: -3.68, depth: 1.42 },
        { x: 2.08, z: -1.72, depth: 1.42 },
      ].map(({ x, z, depth }) => (
        <mesh key={z} position={[x, 0.78, z]} castShadow receiveShadow>
          <boxGeometry args={[0.16, 1.56, depth]} />
          {wallMat}
        </mesh>
      ))}
      {[
        { x: 2.75, width: 1.34 },
        { x: 5.38, width: 1.26 },
      ].map(({ x, width }) => (
        <mesh key={x} position={[x, 0.5, -1.2]} castShadow receiveShadow>
          <boxGeometry args={[width, 1, 0.16]} />
          {wallMat}
        </mesh>
      ))}
      <mesh position={[4.06, 1.03, -1.2]} castShadow>
        <boxGeometry args={[1.3, 0.08, 0.16]} />
        {wallMat}
      </mesh>
      <mesh position={[4.08, 0.78, -0.18]} castShadow receiveShadow>
        <boxGeometry args={[0.14, 1.56, 0.38]} />
        {wallMat}
      </mesh>
      <mesh position={[4.08, 0.78, 0.53]} castShadow receiveShadow>
        <boxGeometry args={[0.14, 1.56, 0.42]} />
        {wallMat}
      </mesh>
      <mesh position={[4.13, 0.68, -0.37]} rotation={[0, -0.82, 0]} castShadow>
        <boxGeometry args={[0.055, 1.36, 0.72]} />
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#b49b77" roughness={0.48} />
      </mesh>
      <mesh position={[4.47, 0.72, -0.1]}>
        <sphereGeometry args={[0.035, 12, 10]} />
        {brassMat}
      </mesh>
      <mesh position={[5.02, 0.78, 0.74]} castShadow receiveShadow>
        <boxGeometry args={[2.08, 1.56, 0.14]} />
        {wallMat}
      </mesh>
      <mesh position={[4.93, 1.53, -0.18]}>
        <boxGeometry args={[0.9, 0.08, 0.14]} />
        {wallMat}
      </mesh>
      <mesh position={[5.04, 0.82, -2.95]} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.16, 1.18]} />
        <meshStandardMaterial color="#958878" roughness={0.72} />
      </mesh>
      <mesh position={[5.04, 0.92, -2.95]} receiveShadow>
        <boxGeometry args={[1.62, 0.045, 1.1]} />
        <meshStandardMaterial map={STONE_TEXTURE} color="#f2eadc" roughness={0.24} />
      </mesh>
      <mesh position={[5.04, 0.96, -2.95]}>
        <cylinderGeometry args={[0.18, 0.24, 0.13, 36]} />
        <meshPhysicalMaterial color="#eee9e0" roughness={0.18} />
      </mesh>
      <mesh position={[5.04, 1.03, -2.95]}>
        <cylinderGeometry args={[0.14, 0.14, 0.018, 36]} />
        <meshStandardMaterial color="#aca392" roughness={0.24} metalness={0.12} />
      </mesh>
      <mesh position={[5.42, 1.11, -2.95]}>
        <cylinderGeometry args={[0.022, 0.022, 0.18, 10]} />
        {brassMat}
      </mesh>
      <mesh position={[5.42, 1.2, -3.02]}>
        <cylinderGeometry args={[0.022, 0.022, 0.13, 10]} />
        {brassMat}
      </mesh>
      <mesh position={[5.02, 1.73, -2.56]}>
        <boxGeometry args={[0.78, 0.88, 0.045]} />
        <meshPhysicalMaterial color="#8d918d" roughness={0.09} metalness={0.72} />
      </mesh>
      <mesh position={[5.04, 1.28, -3.82]}>
        <boxGeometry args={[1.32, 0.035, 0.56]} />
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#d6c3a2" roughness={0.48} />
      </mesh>
      <mesh position={[5.04, 1.15, -3.88]}>
        <boxGeometry args={[1.2, 0.22, 0.38]} />
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#b99b73" roughness={0.52} />
      </mesh>
      <mesh position={[3.1, 0.23, -3.55]}>
        <boxGeometry args={[1.35, 0.34, 0.92]} />
        <meshPhysicalMaterial color="#dedbd2" roughness={0.22} />
      </mesh>
      <mesh position={[3.1, 0.43, -3.55]}>
        <boxGeometry args={[1.4, 0.06, 0.96]} />
        <meshPhysicalMaterial color="#f1ece2" roughness={0.18} />
      </mesh>
      {[-0.52, 0.52].map((x) => (
        <mesh key={x} position={[3.1 + x, 0.52, -3.55]}>
          <cylinderGeometry args={[0.022, 0.022, 0.2, 10]} />
          {brassMat}
        </mesh>
      ))}
      <group position={[5.02, 0, -0.43]}>
        <mesh position={[0, 0.22, 0.02]} castShadow>
          <cylinderGeometry args={[0.19, 0.25, 0.42, 28]} />
          <meshPhysicalMaterial color="#f0ece4" roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.48, -0.08]} castShadow scale={[1, 0.62, 1.35]}>
          <sphereGeometry args={[0.32, 32, 24]} />
          <meshPhysicalMaterial color="#f2eee7" roughness={0.16} />
        </mesh>
        <mesh position={[0, 0.69, -0.47]} castShadow>
          <boxGeometry args={[0.58, 0.72, 0.16]} />
          <meshPhysicalMaterial color="#f2eee7" roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.86, -0.365]}>
          <boxGeometry args={[0.42, 0.035, 0.018]} />
          {brassMat}
        </mesh>
        <mesh position={[0, 0.58, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.235, 0.025, 12, 36]} />
          <meshPhysicalMaterial color="#e5e0d7" roughness={0.22} />
        </mesh>
        <mesh position={[0.24, 0.55, -0.08]}>
          <cylinderGeometry args={[0.018, 0.018, 0.09, 8]} />
          {brassMat}
        </mesh>
      </group>
      <mesh position={[4.72, 0.89, -2.95]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.02, 1.64]} />
        <meshPhysicalMaterial
          color="#bdd0cc"
          roughness={0.14}
          metalness={0.08}
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[3.5, 0.9, -2.95]}>
        <boxGeometry args={[0.03, 1.76, 0.035]} />
        {brassMat}
      </mesh>
      <mesh position={[5.04, 0.9, -3.62]}>
        <boxGeometry args={[1.8, 1.72, 0.035]} />
        <meshPhysicalMaterial color="#bdd0cc" roughness={0.13} metalness={0.07} transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[5.04, 1.78, -3.62]}>
        <boxGeometry args={[1.86, 0.035, 0.04]} />
        {brassMat}
      </mesh>
      <mesh position={[4.1, 0.01, -0.18]} receiveShadow>
        <boxGeometry args={[0.06, 0.02, 0.44]} />
        <meshStandardMaterial color="#988367" roughness={0.48} metalness={0.18} />
      </mesh>
      <pointLight position={[4.6, 2.5, -2.8]} intensity={3.8} distance={4.5} color="#f4d9ae" />
    </group>
  );
}

function BedroomPartition() {
  return (
    <group>
      <mesh position={[-3.9, 2.45, -4.335]} receiveShadow>
        <boxGeometry args={[4.08, 1.62, 0.065]} />
        <meshStandardMaterial color="#24434a" roughness={0.82} />
      </mesh>
      {Array.from({ length: 19 }, (_, index) => {
        const x = -5.82 + index * 0.214;
        return (
          <mesh key={index} position={[x, 2.45, -4.292]} castShadow>
            <boxGeometry args={[0.018, 1.56, 0.018]} />
            <meshStandardMaterial
              color={index % 3 === 0 ? "#36565a" : "#2b484d"}
              roughness={0.58}
              metalness={0.08}
            />
          </mesh>
        );
      })}
      <mesh position={[-3.9, 1.63, -4.29]}>
        <boxGeometry args={[4.08, 0.025, 0.035]} />
        <meshStandardMaterial color="#efc07b" roughness={0.42} metalness={0.48} />
      </mesh>
      {[{ z: -3.2, length: 2.4 }, { z: -0.6, length: 1 }].map(({ z, length }) => (
        <mesh key={z} position={[-1.05, 0.82, z]} castShadow receiveShadow>
          <boxGeometry args={[0.16, 1.64, length]} />
          <meshStandardMaterial map={STONE_TEXTURE} color="#c8bdac" roughness={0.92} />
        </mesh>
      ))}
      <mesh position={[-1.05, 1.62, -1.95]}>
        <boxGeometry args={[0.14, 0.08, 0.42]} />
        <meshStandardMaterial color="#a68960" roughness={0.35} metalness={0.45} />
      </mesh>
      <mesh position={[-3.6, 0.48, 0.28]} castShadow receiveShadow>
        <boxGeometry args={[5, 0.96, 0.16]} />
        <meshStandardMaterial map={STONE_TEXTURE} color="#c8bdac" roughness={0.92} />
      </mesh>
      <mesh position={[-3.6, 0.98, 0.22]}>
        <boxGeometry args={[5.02, 0.08, 0.16]} />
        <meshStandardMaterial color="#9e845e" roughness={0.38} metalness={0.42} />
      </mesh>
      <mesh position={[-1.12, 0.12, -1.98]} rotation={[0, -0.95, 0]} castShadow>
        <boxGeometry args={[0.055, 1.48, 0.9]} />
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#b49b77" roughness={0.48} />
      </mesh>
      <mesh position={[-1.08, 0.17, -2.38]} rotation={[0, -0.95, 0]}>
        <boxGeometry args={[0.045, 0.08, 0.08]} />
        <meshStandardMaterial color="#a9804e" roughness={0.28} metalness={0.72} />
      </mesh>
      <mesh position={[-5.96, 0.08, -1.78]} receiveShadow>
        <boxGeometry args={[0.08, 0.16, 4.65]} />
        <meshStandardMaterial color="#9c886c" roughness={0.5} />
      </mesh>
    </group>
  );
}

function ApartmentEntry() {
  return (
    <group position={[-4.9, 0, 0]}>
      <mesh position={[-0.08, 0.82, 4.31]} castShadow>
        <boxGeometry args={[0.08, 1.64, 0.13]} />
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#7d6242" roughness={0.45} />
      </mesh>
      <mesh position={[1.08, 0.82, 4.31]} castShadow>
        <boxGeometry args={[0.08, 1.64, 0.13]} />
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#7d6242" roughness={0.45} />
      </mesh>
      <mesh position={[0.5, 1.64, 4.31]}>
        <boxGeometry args={[1.24, 0.08, 0.13]} />
        <meshStandardMaterial color="#b6925e" roughness={0.36} metalness={0.5} />
      </mesh>
      <mesh position={[0.5, 0.06, 4.28]} receiveShadow>
        <boxGeometry args={[2.15, 0.12, 0.48]} />
        <meshStandardMaterial map={STONE_TEXTURE} color="#c2b49a" roughness={0.44} />
      </mesh>
      <mesh position={[0.5, 0.74, 4.38]} rotation={[0, -0.24, 0]} castShadow>
        <boxGeometry args={[1.02, 1.45, 0.075]} />
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#c9b18f" roughness={0.5} />
      </mesh>
      <mesh position={[0.84, 0.75, 4.31]} rotation={[0, -0.24, 0]}>
        <boxGeometry args={[0.018, 1.18, 0.018]} />
        <meshStandardMaterial color="#b08b58" roughness={0.34} metalness={0.5} />
      </mesh>
      <mesh position={[0.16, 0.76, 4.43]}>
        <sphereGeometry args={[0.035, 12, 10]} />
        <meshStandardMaterial color="#b18c57" roughness={0.28} metalness={0.72} />
      </mesh>
      <mesh position={[1.15, 1.32, 4.25]}>
        <boxGeometry args={[0.28, 0.22, 0.045]} />
        <meshStandardMaterial color="#b6925e" roughness={0.32} metalness={0.6} />
      </mesh>
      <mesh position={[1.15, 1.32, 4.22]}>
        <boxGeometry args={[0.2, 0.14, 0.018]} />
        <meshStandardMaterial color="#30332d" roughness={0.58} />
      </mesh>
      <mesh position={[-0.55, 0.14, 3.35]} receiveShadow>
        <boxGeometry args={[1.4, 0.025, 2.35]} />
        <meshStandardMaterial color="#b9a789" roughness={0.96} />
      </mesh>
      <mesh position={[-0.55, 0.16, 3.35]} receiveShadow>
        <boxGeometry args={[1.24, 0.02, 2.18]} />
        <meshStandardMaterial map={LINEN_TEXTURE} color="#d4c7b2" roughness={0.98} />
      </mesh>
    </group>
  );
}

function LivingRoomTelevision() {
  return (
    <group position={[1.8, 0, -0.1]}>
      <mesh position={[0, 1.88, 4.34]} castShadow>
        <boxGeometry args={[2.64, 1.68, 0.075]} />
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#4b3829" roughness={0.58} />
      </mesh>
      <mesh position={[0, 1.88, 4.285]}>
        <boxGeometry args={[2.5, 1.54, 0.025]} />
        <meshStandardMaterial color="#c99d54" roughness={0.4} metalness={0.38} />
      </mesh>
      <mesh position={[0, 1.88, 4.263]}>
        <boxGeometry args={[2.44, 1.48, 0.025]} />
        <meshStandardMaterial color="#101820" roughness={0.2} metalness={0.24} />
      </mesh>
      <mesh position={[0, 1.88, 4.245]}>
        <boxGeometry args={[2.34, 1.38, 0.012]} />
        <meshPhysicalMaterial
          color="#13212a"
          emissive="#07131c"
          emissiveIntensity={0.24}
          roughness={0.18}
          metalness={0.16}
          clearcoat={0.72}
          clearcoatRoughness={0.18}
        />
      </mesh>
      <mesh position={[1.12, 1.22, 4.236]}>
        <sphereGeometry args={[0.018, 12, 10]} />
        <meshStandardMaterial color="#d5b987" emissive="#d5b987" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.72, 4.02]} castShadow receiveShadow>
        <boxGeometry args={[2.3, 0.22, 0.34]} />
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#5a4030" roughness={0.54} />
      </mesh>
      <mesh position={[0, 0.835, 4.005]}>
        <boxGeometry args={[2.2, 0.018, 0.3]} />
        <meshStandardMaterial color="#c99d54" roughness={0.4} metalness={0.42} />
      </mesh>
      {[-1.02, 1.02].map((x) => (
        <mesh key={x} position={[x * 0.9, 0.57, 4.04]} castShadow>
          <boxGeometry args={[0.045, 0.24, 0.22]} />
          <meshStandardMaterial color="#9d805c" roughness={0.4} metalness={0.42} />
        </mesh>
      ))}
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.29, 0.2, 0.6, 32, 1, true]} />
        <meshStandardMaterial color="#9b7955" roughness={0.42} metalness={0.08} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.055, 32]} />
        <meshStandardMaterial color="#40382d" roughness={1} />
      </mesh>
      <mesh position={[0, 0.61, 0]}>
        <torusGeometry args={[0.29, 0.025, 8, 32]} />
        <meshStandardMaterial color="#c0a376" roughness={0.34} metalness={0.55} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const height = 1.05 + (i % 3) * 0.18;
        return (
          <group key={i} position={[Math.cos(angle) * 0.12, 0.62, Math.sin(angle) * 0.12]}>
            <mesh position={[Math.cos(angle) * 0.16, height * 0.45, Math.sin(angle) * 0.16]} rotation={[0.12, 0, -Math.cos(angle) * 0.14]} castShadow>
              <cylinderGeometry args={[0.018, 0.025, height, 8]} />
              <meshStandardMaterial color="#526247" roughness={0.88} />
            </mesh>
            {[0.32, 0.55, 0.77].map((fraction, leafIndex) => (
              <mesh
                key={leafIndex}
                position={[
                  Math.cos(angle + (leafIndex % 2 ? 0.7 : -0.7)) * (0.18 + fraction * 0.08),
                  height * fraction,
                  Math.sin(angle + (leafIndex % 2 ? 0.7 : -0.7)) * (0.18 + fraction * 0.08),
                ]}
                rotation={[0.2, angle + leafIndex * 0.65, Math.cos(angle) * -0.32]}
                scale={[0.1, 0.27, 0.045]}
                castShadow
              >
                <sphereGeometry args={[1, 14, 12]} />
                <meshStandardMaterial color={leafIndex % 2 ? "#596c4c" : "#74815b"} roughness={0.86} />
              </mesh>
            ))}
          </group>
        );
      })}
      <mesh position={[0, 0.61, 0]}>
        <cylinderGeometry args={[0.24, 0.2, 0.08, 20]} />
        <meshStandardMaterial color="#2e3228" roughness={1} />
      </mesh>
    </group>
  );
}

function FloralArrangement({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const flowerColors = ["#f1e7d8", "#d9b7a3", "#e7d9c5", "#c98f80"];
  const stems = [
    [-0.24, -0.08, 0.82],
    [0.02, 0.14, 1.02],
    [0.25, -0.06, 0.88],
    [-0.1, 0.2, 0.92],
    [0.16, 0.18, 1.08],
    [-0.3, 0.1, 0.76],
    [0.32, 0.12, 0.8],
  ];

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <latheGeometry args={[[
          new THREE.Vector2(0.13, 0),
          new THREE.Vector2(0.2, 0.06),
          new THREE.Vector2(0.25, 0.25),
          new THREE.Vector2(0.18, 0.42),
          new THREE.Vector2(0.2, 0.46),
        ], 32]} />
        <meshPhysicalMaterial color="#e7e0d3" roughness={0.24} metalness={0.04} clearcoat={0.32} />
      </mesh>
      <mesh position={[0, 0.425, 0]}>
        <torusGeometry args={[0.19, 0.018, 8, 28]} />
        <meshStandardMaterial color="#b6925e" roughness={0.32} metalness={0.62} />
      </mesh>
      {stems.map(([x, z, height], index) => {
        const angle = Math.atan2(x, z);
        const flowerColor = flowerColors[index % flowerColors.length];
        const tip: [number, number, number] = [x, 0.4 + height, z];
        return (
          <group key={index}>
            <mesh
              position={[x * 0.44, 0.4 + height * 0.48, z * 0.44]}
              rotation={[Math.atan2(x, height) * 0.35, 0, -Math.atan2(z, height) * 0.35]}
              castShadow
            >
              <cylinderGeometry args={[0.009, 0.016, height, 8]} />
              <meshStandardMaterial color="#536449" roughness={0.9} />
            </mesh>
            {[0.35, 0.58, 0.76].map((fraction, leafIndex) => (
              <mesh
                key={leafIndex}
                position={[
                  x * fraction + Math.cos(angle + leafIndex * 2.3) * 0.13,
                  0.4 + height * fraction,
                  z * fraction + Math.sin(angle + leafIndex * 2.3) * 0.13,
                ]}
                rotation={[0.15, angle + leafIndex * 0.6, leafIndex % 2 ? -0.5 : 0.48]}
                scale={[0.085, 0.18, 0.035]}
                castShadow
              >
                <sphereGeometry args={[1, 12, 10]} />
                <meshStandardMaterial color={leafIndex % 2 ? "#627451" : "#7d8964"} roughness={0.86} />
              </mesh>
            ))}
            <group position={tip}>
              {Array.from({ length: 6 }, (_, petalIndex) => {
                const petalAngle = (petalIndex / 6) * Math.PI * 2;
                return (
                  <mesh
                    key={petalIndex}
                    position={[Math.cos(petalAngle) * 0.09, 0, Math.sin(petalAngle) * 0.09]}
                    rotation={[0.08, -petalAngle, 0.28]}
                    scale={[0.075, 0.11, 0.045]}
                    castShadow
                  >
                    <sphereGeometry args={[1, 12, 10]} />
                    <meshPhysicalMaterial color={flowerColor} roughness={0.58} clearcoat={0.12} />
                  </mesh>
                );
              })}
              <mesh position={[0, 0.025, 0]} castShadow>
                <sphereGeometry args={[0.045, 14, 12]} />
                <meshStandardMaterial color="#c99d54" roughness={0.58} />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
}

function Sofa({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox position={[0, 0.48, 0]} args={[2.8, 0.5, 0.95]} radius={0.09} smoothness={4} castShadow>
        <meshStandardMaterial map={LINEN_TEXTURE} color="#0f4863" roughness={0.82} />
      </RoundedBox>
      <RoundedBox position={[0, 0.91, -0.37]} args={[2.8, 0.85, 0.22]} radius={0.09} smoothness={4} castShadow>
        <meshStandardMaterial map={LINEN_TEXTURE} color="#123e58" roughness={0.84} />
      </RoundedBox>
      {[-1.34, 1.34].map((x) => (
        <RoundedBox key={x} position={[x, 0.69, 0.02]} args={[0.24, 0.75, 0.94]} radius={0.06} smoothness={4} castShadow>
          <meshStandardMaterial map={LINEN_TEXTURE} color="#0f4863" roughness={0.82} />
        </RoundedBox>
      ))}
      <RoundedBox position={[0, 0.71, 0.16]} args={[2.48, 0.34, 0.66]} radius={0.1} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial map={LINEN_TEXTURE} color="#eee8dc" roughness={0.98} />
      </RoundedBox>
      {[-0.88, 0, 0.88].map((x) => (
        <RoundedBox key={x} position={[x, 0.84, -0.18]} args={[0.76, 0.5, 0.16]} radius={0.08} smoothness={4} castShadow>
          <meshStandardMaterial map={LINEN_TEXTURE} color="#f4efe5" roughness={0.98} />
        </RoundedBox>
      ))}
      {[-0.66, 0.66].map((x, index) => (
        <group key={x} position={[x, 0.77, 0.16]} rotation={[0.08, index ? -0.12 : 0.12, index ? -0.12 : 0.12]}>
          <RoundedBox args={[0.62, 0.43, 0.18]} radius={0.08} smoothness={4} castShadow>
            <meshStandardMaterial map={LINEN_TEXTURE} color="#f4efe5" roughness={0.97} />
          </RoundedBox>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.465, 0.69, 0.03]} rotation={[0, side * Math.PI / 2, 0]}>
          <RoundedBox args={[0.68, 0.62, 0.035]} radius={0.06} smoothness={4}>
            <meshStandardMaterial map={LINEN_TEXTURE} color="#0f4863" roughness={0.84} />
          </RoundedBox>
          {[0.43, -0.43].map((y) => (
            <mesh key={y} position={[0, y, 0.022]}>
              <boxGeometry args={[0.74, 0.014, 0.012]} />
              <meshStandardMaterial color="#c99d54" roughness={0.42} metalness={0.48} />
            </mesh>
          ))}
          {[-0.19, 0.19].map((x) => (
            <mesh key={x} position={[x, 0.06, 0.025]}>
              <boxGeometry args={[0.012, 0.25, 0.012]} />
              <meshStandardMaterial color="#174f69" roughness={0.78} />
            </mesh>
          ))}
          <mesh position={[0, 0.37, 0.025]}>
            <boxGeometry args={[0.64, 0.035, 0.022]} />
            <meshStandardMaterial color="#eee8dc" roughness={0.92} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.205, 0.485]}>
        <boxGeometry args={[2.52, 0.035, 0.035]} />
        <meshStandardMaterial color="#c99d54" roughness={0.4} metalness={0.5} />
      </mesh>
      {[-1.1, 1.1].flatMap((x) =>
        [-0.29, 0.29].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.19, z]}>
            <cylinderGeometry args={[0.04, 0.04, 0.36, 8]} />
            <meshStandardMaterial color="#b18b4e" roughness={0.38} metalness={0.62} />
          </mesh>
        )),
      )}
    </group>
  );
}

function Bed({ position, width = 2.7 }: { position: [number, number, number]; width?: number }) {
  return (
    <group position={position}>
      <RoundedBox position={[0, 0.34, -0.48]} args={[width + 0.2, 0.72, 0.15]} radius={0.055} smoothness={4} castShadow>
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#3a2a23" roughness={0.56} />
      </RoundedBox>
      <RoundedBox position={[0, 0.51, -0.382]} args={[width - 0.16, 0.38, 0.045]} radius={0.07} smoothness={4} castShadow>
        <meshStandardMaterial map={LINEN_TEXTURE} color="#1a1a2e" roughness={0.92} />
      </RoundedBox>
      {Array.from({ length: 7 }, (_, index) => {
        const x = (index - 3) * ((width - 0.38) / 6);
        return (
          <mesh key={index} position={[x, 0.51, -0.355]}>
            <boxGeometry args={[0.012, 0.31, 0.009]} />
            <meshStandardMaterial color="#33334a" roughness={0.82} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.294, -0.355]}>
        <boxGeometry args={[width - 0.26, 0.018, 0.02]} />
        <meshStandardMaterial color="#efc07b" roughness={0.42} metalness={0.38} />
      </mesh>
      <RoundedBox position={[0, 0.22, 0]} args={[width + 0.22, 0.42, 2.72]} radius={0.06} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#5a4030" roughness={0.58} />
      </RoundedBox>
      <RoundedBox position={[0, 0.52, 0.08]} args={[width, 0.44, 2.38]} radius={0.15} smoothness={5} castShadow>
        <meshStandardMaterial map={LINEN_TEXTURE} color="#fffaf0" roughness={0.98} />
      </RoundedBox>
      <mesh position={[0, 0.79, 0.55]} castShadow>
        <boxGeometry args={[width - 0.12, 0.14, 1.35]} />
        <meshStandardMaterial map={LINEN_TEXTURE} color="#0f3460" roughness={0.94} />
      </mesh>
      {[-0.38, 0, 0.38].map((z) => (
        <mesh key={z} position={[0, 0.866, z]}>
          <boxGeometry args={[width - 0.36, 0.008, 0.012]} />
          <meshStandardMaterial color="#29486b" roughness={0.92} />
        </mesh>
      ))}
      <RoundedBox position={[0, 0.88, 1.03]} args={[width - 0.16, 0.12, 0.62]} radius={0.045} smoothness={3} castShadow>
        <meshStandardMaterial map={LINEN_TEXTURE} color="#16213e" roughness={0.94} />
      </RoundedBox>
      {[0.72, 1.34].map((z) => (
        <mesh key={z} position={[0, 0.944, z]}>
          <boxGeometry args={[width - 0.28, 0.008, 0.018]} />
          <meshStandardMaterial color="#efc07b" roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
      {[-width * 0.27, width * 0.27].map((x) => (
        <group key={x} position={[x, 0.77, -0.82]}>
          <RoundedBox args={[0.76, 0.22, 0.58]} radius={0.08} smoothness={4} castShadow>
            <meshStandardMaterial map={LINEN_TEXTURE} color="#16213e" roughness={0.96} />
          </RoundedBox>
          <mesh position={[0, -0.1, 0.3]} rotation={[-0.12, 0, 0]}>
            <boxGeometry args={[0.77, 0.015, 0.025]} />
            <meshStandardMaterial color="#efc07b" roughness={0.56} metalness={0.18} />
          </mesh>
        </group>
      ))}
      <group position={[0, 0.77, -0.36]} rotation={[0.04, 0, 0]}>
        <RoundedBox args={[0.82, 0.25, 0.36]} radius={0.1} smoothness={5} castShadow>
          <meshStandardMaterial map={LINEN_TEXTURE} color="#0f3460" roughness={0.93} />
        </RoundedBox>
        <mesh position={[0, -0.1, 0.19]}>
          <boxGeometry args={[0.68, 0.012, 0.012]} />
          <meshStandardMaterial color="#efc07b" roughness={0.52} metalness={0.2} />
        </mesh>
      </group>
      <mesh position={[0, 0.81, 1.04]} castShadow>
        <boxGeometry args={[width - 0.08, 0.12, 0.35]} />
        <meshStandardMaterial map={LINEN_TEXTURE} color="#16213e" roughness={0.94} />
      </mesh>
      <mesh position={[width * 0.22, 0.855, 1.04]}>
        <boxGeometry args={[0.11, 0.015, 0.34]} />
        <meshStandardMaterial color="#efc07b" roughness={0.5} metalness={0.24} />
      </mesh>
    </group>
  );
}

function SideTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.74, 0.12, 0.68]} />
        <meshStandardMaterial
          map={WALNUT_TEXTURE}
          color="#3b2b23"
          roughness={0.48}
          metalness={0.03}
        />
      </mesh>
      <mesh position={[0, 0.38, 0.015]} castShadow>
        <boxGeometry args={[0.49, 0.27, 0.46]} />
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#493326" roughness={0.54} />
      </mesh>
      {[-0.06, 0.1].map((y) => (
        <group key={y}>
          <mesh position={[0, 0.38 + y, 0.252]}>
            <boxGeometry args={[0.45, 0.012, 0.012]} />
            <meshStandardMaterial color="#684a34" roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.38 + y, 0.264]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.018, 0.018, 0.13, 10]} />
            <meshStandardMaterial color="#efc07b" metalness={0.58} roughness={0.34} />
          </mesh>
        </group>
      ))}
      {[[-0.28, -0.25], [0.28, -0.25], [-0.28, 0.25], [0.28, 0.25]].map(
        ([x, z]) => (
          <mesh key={`${x}-${z}`} position={[x, 0.27, z]}>
            <cylinderGeometry args={[0.025, 0.025, 0.52, 8]} />
            <meshStandardMaterial color="#8f704d" metalness={0.65} roughness={0.34} />
          </mesh>
        ),
      )}
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.16, 16]} />
        <meshStandardMaterial color="#c6a575" metalness={0.68} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.84, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 0.18, 12]} />
        <meshStandardMaterial color="#b89258" roughness={0.32} metalness={0.65} />
      </mesh>
      <mesh position={[0, 0.98, 0]}>
        <coneGeometry args={[0.2, 0.22, 24, 1, true]} />
        <meshStandardMaterial color="#e8dcc5" roughness={0.72} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.93, 0]}>
        <sphereGeometry args={[0.065, 16, 12]} />
        <meshStandardMaterial color="#ffe7b9" emissive="#ffc97b" emissiveIntensity={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

function UpholsteredChair({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox position={[0, 0.55, 0]} args={[0.68, 0.2, 0.68]} radius={0.07} smoothness={4} castShadow>
        <meshStandardMaterial map={LINEN_TEXTURE} color="#d3c7b5" roughness={0.97} />
      </RoundedBox>
      <RoundedBox
        position={[0, 1.01, -0.27]}
        rotation={[-0.09, 0, 0]}
        args={[0.68, 0.82, 0.18]}
        radius={0.08}
        smoothness={4}
        castShadow
      >
        <meshStandardMaterial map={LINEN_TEXTURE} color="#b8aa96" roughness={0.97} />
      </RoundedBox>
      {[-0.27, 0.27].map((x) =>
        [-0.25, 0.25].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.28, z]} castShadow>
            <cylinderGeometry args={[0.027, 0.02, 0.5, 10]} />
            <meshStandardMaterial color="#74583d" roughness={0.52} metalness={0.08} />
          </mesh>
        )),
      )}
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 0.96, -0.27]} castShadow>
          <boxGeometry args={[0.045, 0.76, 0.22]} />
          <meshStandardMaterial color="#806346" roughness={0.48} />
        </mesh>
      ))}
    </group>
  );
}

function DiningSet({ position, round = true }: { position: [number, number, number]; round?: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        {round ? (
          <cylinderGeometry args={[0.82, 0.82, 0.12, 32]} />
        ) : (
          <boxGeometry args={[1.8, 0.12, 0.95]} />
        )}
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#e1cfb1" roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.47, 0]}>
        <cylinderGeometry args={[0.1, 0.16, 0.82, 12]} />
        <meshStandardMaterial color="#a58a67" metalness={0.38} roughness={0.48} />
      </mesh>
      {[-1, 1].map((side) =>
        [-1, 1].map((forward) => (
          <UpholsteredChair
            key={`${side}-${forward}`}
            position={[side * 1.28, 0, forward * 0.54]}
            rotation={Math.atan2(-side * 1.28, -forward * 0.54)}
          />
        )),
      )}
      <mesh position={[0, 1.02, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.025, 16]} />
        <meshStandardMaterial color="#e8e0d1" roughness={0.55} />
      </mesh>
      <mesh position={[0.2, 1.09, 0]}>
        <cylinderGeometry args={[0.045, 0.055, 0.14, 12]} />
        <meshStandardMaterial color="#6d4333" roughness={0.25} />
      </mesh>
      <mesh position={[-0.2, 1.075, 0.08]}>
        <cylinderGeometry args={[0.018, 0.025, 0.1, 10]} />
        <meshStandardMaterial color="#e9e2d6" roughness={0.28} />
      </mesh>
      <mesh position={[-0.2, 1.13, 0.08]}>
        <cylinderGeometry args={[0.022, 0.022, 0.018, 12]} />
        <meshStandardMaterial color="#b6925e" roughness={0.3} metalness={0.6} />
      </mesh>
    </group>
  );
}

function ReceptionDesk() {
  return (
    <group position={[0, 0, -1.8]}>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.5, 1.38, 0.88]} />
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#dfc7a6" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.72, 0.455]} castShadow>
        <boxGeometry args={[3.22, 0.94, 0.045]} />
        <meshStandardMaterial color="#71563a" roughness={0.48} />
      </mesh>
      <mesh position={[0, 1.43, 0.02]} castShadow>
        <boxGeometry args={[3.62, 0.12, 0.98]} />
        <meshStandardMaterial color="#c1a477" roughness={0.34} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.36, 0.02]}>
        <boxGeometry args={[3.48, 0.035, 0.91]} />
        <meshStandardMaterial color="#6e5237" roughness={0.36} />
      </mesh>
      <mesh position={[0, 0.72, 0.45]}>
        <boxGeometry args={[3.04, 0.74, 0.035]} />
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#a98a63" roughness={0.5} />
      </mesh>
      {Array.from({ length: 23 }, (_, i) => (
        <mesh key={i} position={[-1.38 + i * 0.125, 0.72, 0.478]}>
          <boxGeometry args={[0.025, 0.72, 0.035]} />
          <meshStandardMaterial color={i % 2 ? "#c4a878" : "#dfc69c"} roughness={0.42} metalness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 0.72, 0.51]}>
        <torusGeometry args={[0.2, 0.012, 8, 48]} />
        <meshStandardMaterial color="#d6b77f" roughness={0.28} metalness={0.68} />
      </mesh>
      <mesh position={[0, 0.72, 0.51]}>
        <circleGeometry args={[0.16, 40]} />
        <meshStandardMaterial color="#76583a" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.72, 0.525]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.08, 0.13, 3]} />
        <meshStandardMaterial color="#d8bb88" roughness={0.32} metalness={0.42} />
      </mesh>
      <mesh position={[0, 1.02, 0.52]}>
        <boxGeometry args={[3.12, 0.025, 0.025]} />
        <meshStandardMaterial color="#d5b77f" roughness={0.3} metalness={0.62} />
      </mesh>
      {[-1.64, 1.64].map((x) => (
        <mesh key={x} position={[x, 0.75, 0.08]}>
          <boxGeometry args={[0.035, 1.18, 0.88]} />
          <meshStandardMaterial color="#c9aa76" roughness={0.34} metalness={0.48} />
        </mesh>
      ))}
    </group>
  );
}

function LobbyLounge() {
  return (
    <group>
      <Sofa position={[-2.05, 0, 1.55]} rotation={Math.PI} />
      <Sofa position={[2.05, 0, 1.55]} rotation={Math.PI} />
      <RoundedBox position={[0, 0.43, 0.52]} args={[1.72, 0.13, 0.86]} radius={0.055} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#bc9b70" roughness={0.43} />
      </RoundedBox>
      {[-0.68, 0.68].flatMap((x) =>
        [-0.25, 0.25].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.2, 0.52 + z]} castShadow>
            <cylinderGeometry args={[0.026, 0.03, 0.38, 10]} />
            <meshStandardMaterial color="#74583d" roughness={0.4} metalness={0.22} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.52, 0.52]}>
        <cylinderGeometry args={[0.16, 0.16, 0.025, 24]} />
        <meshPhysicalMaterial color="#e8e0d1" roughness={0.22} />
      </mesh>
      <mesh position={[0, 0.56, 0.52]}>
        <sphereGeometry args={[0.07, 16, 12]} />
        <meshStandardMaterial color="#c08a5a" roughness={0.48} />
      </mesh>
      <UpholsteredChair position={[-0.1, 0, 3.25]} rotation={Math.PI} />
      <UpholsteredChair position={[0.1, 0, -0.5]} rotation={0} />
    </group>
  );
}

function LobbyArtwork() {
  const paintings = [
    { x: -4.15, base: "#d8cbb5", accent: "#6d7965", secondary: "#b98970" },
    { x: 4.15, base: "#e1d4c0", accent: "#65766c", secondary: "#b58362" },
  ];

  return (
    <group>
      {paintings.map(({ x, base, accent, secondary }, index) => (
        <group key={x} position={[x, 1.96, -4.31]}>
          <mesh castShadow>
            <boxGeometry args={[1.34, 1.68, 0.13]} />
            <meshStandardMaterial map={WALNUT_TEXTURE} color="#72583c" roughness={0.46} />
          </mesh>
          <mesh position={[0, 0, 0.073]}>
            <boxGeometry args={[1.2, 1.54, 0.025]} />
            <meshStandardMaterial color="#d4bd96" roughness={0.38} metalness={0.26} />
          </mesh>
          <mesh position={[0, 0, 0.092]}>
            <boxGeometry args={[1.12, 1.46, 0.025]} />
            <meshStandardMaterial color={base} roughness={0.91} />
          </mesh>
          <mesh position={[-0.2, -0.16, 0.113]} rotation={[0, 0, index ? 0.27 : -0.2]} scale={[0.25, 0.61, 0.025]}>
            <sphereGeometry args={[1, 20, 16]} />
            <meshStandardMaterial color={accent} roughness={0.92} />
          </mesh>
          <mesh position={[0.23, 0.18, 0.12]} rotation={[0, 0, index ? -0.58 : 0.48]} scale={[0.22, 0.43, 0.025]}>
            <sphereGeometry args={[1, 20, 16]} />
            <meshStandardMaterial color={secondary} roughness={0.88} />
          </mesh>
          <mesh position={[0.05, -0.34, 0.125]} rotation={[0, 0, -0.12]}>
            <boxGeometry args={[0.72, 0.055, 0.018]} />
            <meshStandardMaterial color="#8f7758" roughness={0.84} />
          </mesh>
          <mesh position={[0, 0.65, 0.12]}>
            <boxGeometry args={[0.66, 0.018, 0.018]} />
            <meshStandardMaterial color="#b6925e" roughness={0.35} metalness={0.48} />
          </mesh>
          <mesh position={[0, 1.02, 0.12]}>
            <boxGeometry args={[0.38, 0.08, 0.12]} />
            <meshStandardMaterial color="#ab8d62" roughness={0.36} metalness={0.48} />
          </mesh>
          <pointLight position={[0, 0.88, 0.45]} intensity={0.75} distance={2.2} color="#ffe4ba" />
        </group>
      ))}
    </group>
  );
}

function LobbyFloorDetails() {
  return (
    <group>
      <mesh position={[0, 0.075, 1.38]} receiveShadow>
        <boxGeometry args={[6.35, 0.045, 3.72]} />
        <meshStandardMaterial map={LINEN_TEXTURE} color="#8d7b62" roughness={0.98} />
      </mesh>
      <mesh position={[0, 0.101, 1.38]}>
        <boxGeometry args={[6.12, 0.012, 3.49]} />
        <meshStandardMaterial color="#c7b390" roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.11, 1.38]}>
        <boxGeometry args={[5.98, 0.012, 3.35]} />
        <meshStandardMaterial map={LINEN_TEXTURE} color="#9b896f" roughness={0.98} />
      </mesh>
      {[-2.91, 2.91].map((x) => (
        <mesh key={x} position={[x, 0.12, 1.38]}>
          <boxGeometry args={[0.018, 0.01, 3.18]} />
          <meshStandardMaterial color="#d7bb88" roughness={0.35} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function LobbyLighting() {
  return (
    <group>
      <mesh position={[0, 3.05, 0.35]}>
        <cylinderGeometry args={[0.025, 0.025, 0.32, 12]} />
        <meshStandardMaterial color="#b18c57" roughness={0.28} metalness={0.72} />
      </mesh>
      <mesh position={[0, 2.86, 0.35]}>
        <sphereGeometry args={[0.18, 24, 16]} />
        <meshPhysicalMaterial color="#c5a36d" roughness={0.22} metalness={0.62} />
      </mesh>
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 6) * Math.PI * 2;
        const x = Math.cos(angle) * 0.6;
        const z = 0.35 + Math.sin(angle) * 0.6;
        return (
          <group key={index} position={[x, 2.76, z]}>
            <mesh position={[0, 0.12, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.28, 8]} />
              <meshStandardMaterial color="#bd9b68" roughness={0.3} metalness={0.65} />
            </mesh>
            <mesh position={[0, -0.04, 0]}>
              <sphereGeometry args={[0.12, 18, 14]} />
              <meshPhysicalMaterial color="#fff1d2" emissive="#d7ae6d" emissiveIntensity={0.38} roughness={0.2} />
            </mesh>
          </group>
        );
      })}
      <pointLight position={[0, 2.8, 0.35]} intensity={3.5} distance={6.5} color="#ffdfae" />
      <pointLight position={[0, 2.45, -2.4]} intensity={2.2} distance={4.5} color="#ffe8c8" />
    </group>
  );
}

function WritingDesk() {
  return (
    <group>
      <group position={[4.6, 0, 3.05]}>
        <RoundedBox position={[0, 0.79, 0]} args={[2, 0.13, 0.72]} radius={0.035} smoothness={3} castShadow receiveShadow>
          <meshStandardMaterial map={WALNUT_TEXTURE} color="#e1ceb0" roughness={0.48} />
        </RoundedBox>
        <mesh position={[0, 0.58, -0.18]} castShadow>
          <boxGeometry args={[1.48, 0.34, 0.38]} />
          <meshStandardMaterial map={WALNUT_TEXTURE} color="#cbb18d" roughness={0.55} />
        </mesh>
        {[-0.84, 0.84].map((x) => (
          <mesh key={x} position={[x, 0.38, 0.02]} castShadow>
            <boxGeometry args={[0.08, 0.7, 0.58]} />
            <meshStandardMaterial map={WALNUT_TEXTURE} color="#d5c09f" roughness={0.52} />
          </mesh>
        ))}
        <mesh position={[0, 0.73, 0.22]}>
          <boxGeometry args={[0.42, 0.012, 0.018]} />
          <meshStandardMaterial color="#a17c4d" roughness={0.34} metalness={0.48} />
        </mesh>
        <mesh position={[-0.55, 0.88, -0.13]} rotation={[-0.06, 0, -0.08]} castShadow>
          <boxGeometry args={[0.4, 0.035, 0.28]} />
          <meshStandardMaterial color="#a18b6e" roughness={0.8} />
        </mesh>
        <mesh position={[-0.53, 0.91, -0.13]} rotation={[-0.06, 0, -0.08]}>
          <boxGeometry args={[0.34, 0.012, 0.24]} />
          <meshStandardMaterial color="#e6ddcc" roughness={0.94} />
        </mesh>
        <group position={[0.63, 0.87, -0.15]}>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.13, 0.16, 0.05, 20]} />
            <meshStandardMaterial color="#9d805d" roughness={0.42} metalness={0.32} />
          </mesh>
          <mesh position={[0, 0.28, 0]}>
            <cylinderGeometry args={[0.025, 0.035, 0.48, 10]} />
            <meshStandardMaterial color="#92744d" roughness={0.42} metalness={0.45} />
          </mesh>
          <mesh position={[0, 0.52, 0]} rotation={[0, 0, -0.15]}>
            <coneGeometry args={[0.18, 0.2, 20, 1, true]} />
            <meshStandardMaterial color="#d7c7aa" roughness={0.72} side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[0, 0.48, 0]} intensity={1.6} distance={2.2} color="#f4d39c" />
        </group>
      </group>
      <UpholsteredChair position={[4.6, 0, 1.9]} rotation={Math.PI} />
    </group>
  );
}

function WallArtwork() {
  const veins = [
    [[-0.58, -0.72, 0.095], [-0.36, -0.44, 0.095], [-0.44, -0.16, 0.095], [-0.13, 0.08, 0.095], [-0.24, 0.42, 0.095], [0.02, 0.74, 0.095]],
    [[-0.41, -0.18, 0.096], [-0.12, -0.27, 0.096], [0.05, -0.48, 0.096], [0.39, -0.62, 0.096], [0.58, -0.78, 0.096]],
    [[-0.17, 0.08, 0.097], [0.15, 0.02, 0.097], [0.3, -0.12, 0.097], [0.58, -0.18, 0.097]],
    [[-0.24, 0.42, 0.097], [0.04, 0.34, 0.097], [0.24, 0.46, 0.097], [0.59, 0.38, 0.097]],
  ].map((points) => new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z))));

  return (
    <group position={[-3.6, 1.94, -4.31]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.52, 1.72, 0.1]} />
        <meshStandardMaterial map={WALNUT_TEXTURE} color="#30251f" roughness={0.52} />
      </mesh>
      <mesh position={[0, 0, 0.058]}>
        <boxGeometry args={[1.39, 1.59, 0.025]} />
        <meshStandardMaterial color="#efc07b" roughness={0.36} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.079]}>
        <boxGeometry args={[1.34, 1.54, 0.025]} />
        <meshStandardMaterial color="#0f3460" roughness={0.66} metalness={0.1} />
      </mesh>
      {veins.map((curve, index) => (
        <mesh key={index} castShadow>
          <tubeGeometry args={[curve, 32, index === 0 ? 0.012 : 0.007, 6, false]} />
          <meshStandardMaterial
            color={index === 0 ? "#efc07b" : "#d9b36f"}
            roughness={0.36}
            metalness={0.48}
          />
        </mesh>
      ))}
      {Array.from({ length: 11 }, (_, index) => {
        const angle = -0.9 + index * 0.18;
        const endX = 0.16 + Math.sin(angle) * 0.65;
        const endY = 0.18 + Math.cos(angle) * 0.66;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.16, 0.18, 0.096),
          new THREE.Vector3(0.2 + (endX - 0.2) * 0.48, 0.3 + (endY - 0.3) * 0.5, 0.096),
          new THREE.Vector3(endX, endY, 0.096),
        ]);
        return (
          <mesh key={index}>
            <tubeGeometry args={[curve, 12, 0.0035, 5, false]} />
            <meshStandardMaterial color="#efc07b" roughness={0.45} metalness={0.52} />
          </mesh>
        );
      })}
    </group>
  );
}

function FeatureObject({
  floor,
  feature,
  activeFeature,
  onSelect,
}: {
  floor: HotelFloor;
  feature: InteriorFeature;
  activeFeature: string | null;
  onSelect: (feature: InteriorFeature) => void;
}) {
  const indicatorPositions: Record<string, [number, number, number]> = {
    "reception-desk": [0, 0, -1.8],
    "lobby-lounge": [0, 0, 1.25],
    "reception-flowers": [0, 0, -1.8],
    "lobby-artwork": [0, 0, -4.25],
    bathroom: [4.1, 0, -2.8],
    toilet: [5, 0, -0.2],
    lounge: [1.8, 0, 0.15],
    "chef-table": [1.8, 0, 0.15],
    "reading-chair": [1.8, 0, 0.15],
    "lounge-sofa": [1.8, 0, 0.15],
    "living-room": [1.8, 0, 0.15],
    "panoramic-lounge": [1.8, 0, 0.15],
    "king-bed": [-3.65, 0, -1.65],
    "suite-bed": [-3.65, 0, -1.65],
    "canopy-bed": [-3.65, 0, -1.65],
    "penthouse-bed": [-3.65, 0, -1.65],
    "writing-desk": [4.6, 0, 3.05],
    "dining-table": [4.6, 0, 3.4],
    terrace: [5, 0, 2.3],
  };
  const interactive = {
    feature,
    active: activeFeature === feature.id,
    onSelect,
    indicatorPosition: indicatorPositions[feature.id] ?? [0, 0, 0],
  };

  if (feature.id === "reception-desk") {
    return (
      <Interactive {...interactive}>
        <ReceptionDesk />
      </Interactive>
    );
  }
  if (feature.id === "lobby-lounge") {
    return (
      <Interactive {...interactive}>
        <LobbyLounge />
      </Interactive>
    );
  }
  if (feature.id === "reception-flowers") {
    return (
      <Interactive {...interactive}>
        <FloralArrangement position={[-1.12, 1.48, -1.8]} scale={0.78} />
        <FloralArrangement position={[1.12, 1.48, -1.8]} scale={0.78} />
      </Interactive>
    );
  }
  if (feature.id === "lobby-artwork") {
    return (
      <Interactive {...interactive}>
        <LobbyArtwork />
      </Interactive>
    );
  }

  if (feature.id === "bathroom") {
    return (
      <Interactive {...interactive}>
        <group position={[4.1, 0, -2.8]}>
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[3.8, 1.8, 3.05]} />
            <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
          </mesh>
        </group>
      </Interactive>
    );
  }
  if (feature.id === "toilet") {
    return (
      <Interactive {...interactive}>
        <group position={[5, 0, -0.2]}>
          <mesh position={[0, 0.8, 0]}>
            <boxGeometry args={[1.7, 1.6, 1.65]} />
            <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
          </mesh>
        </group>
      </Interactive>
    );
  }

  if (feature.name === "The living hall") {
    return (
      <Interactive {...interactive}>
        <group position={[1.8, 0, 0.15]}>
          <Sofa position={[0, 0, 0]} />
          <RoundedBox position={[0, 0.4, 1.35]} args={[1.45, 0.1, 0.78]} radius={0.05} smoothness={3} castShadow>
            <meshStandardMaterial map={WALNUT_TEXTURE} color="#ddc8a9" roughness={0.48} />
          </RoundedBox>
          {[-0.58, 0.58].flatMap((x) =>
            [-0.28, 0.28].map((z) => (
              <mesh key={`${x}-${z}`} position={[x, 0.2, 1.35 + z]}>
                <cylinderGeometry args={[0.025, 0.025, 0.4, 8]} />
                <meshStandardMaterial color="#70583e" roughness={0.48} metalness={0.12} />
              </mesh>
            )),
          )}
          <mesh position={[0, 0.47, 1.35]}>
            <cylinderGeometry args={[0.12, 0.12, 0.025, 20]} />
            <meshStandardMaterial color="#e9e1d3" roughness={0.48} />
          </mesh>
          <group position={[2.1, 0, 0.55]}>
            <UpholsteredChair position={[0, 0, 0]} rotation={-Math.PI / 2} />
          </group>
        </group>
      </Interactive>
    );
  }
  if (feature.id.includes("bed")) {
    return (
      <Interactive {...interactive}>
        <group position={[-3.65, 0, -1.65]}>
          <Bed position={[0, 0, 0]} width={floor.id > 3 ? 2.65 : 2.4} />
          <SideTable position={[-1.42, 0, -0.85]} />
          <SideTable position={[1.42, 0, -0.85]} />
        </group>
      </Interactive>
    );
  }
  if (feature.id.includes("table") || feature.id === "chef-table") {
    return (
      <Interactive {...interactive}>
        <DiningSet
        position={feature.id === "dining-table" ? [4.6, 0, 3.4] : [1.15, 0, 0.2]}
          round={feature.id !== "dining-table"}
        />
      </Interactive>
    );
  }
  if (feature.id === "olive-tree" || feature.id === "terrace") {
    return (
      <Interactive {...interactive}>
        <Plant position={[5, 0.03, 2.3]} />
        {feature.id === "terrace" && (
          <mesh position={[4.8, 0.08, 3.2]} castShadow>
            <boxGeometry args={[2.2, 0.12, 0.52]} />
            <meshStandardMaterial color="#a78b68" roughness={0.65} />
          </mesh>
        )}
      </Interactive>
    );
  }
  if (feature.id === "banquette") {
    return (
      <Interactive {...interactive}>
        <group position={[0, 0, -2.55]} rotation={[0, Math.PI, 0]}>
          <Sofa position={[0, 0, 0]} />
        </group>
      </Interactive>
    );
  }
  if (feature.id === "wine-wall") {
    return (
      <Interactive {...interactive}>
        <group position={[-4.5, 0.4, -4]}>
          <mesh position={[0, 1.3, 0]}>
            <boxGeometry args={[1.1, 2.4, 0.38]} />
            <meshStandardMaterial color="#57422f" roughness={0.58} />
          </mesh>
          {Array.from({ length: 4 }, (_, i) => (
            <mesh key={i} position={[0, 0.45 + i * 0.5, 0.23]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.085, 0.085, 0.4, 12]} />
              <meshStandardMaterial color={i % 2 ? "#784d37" : "#463c32"} roughness={0.3} />
            </mesh>
          ))}
        </group>
      </Interactive>
    );
  }
  if (feature.id === "reading-chair") {
    return (
      <Interactive {...interactive}>
        <group position={[3.75, 0, 0.75]}>
          <UpholsteredChair position={[0, 0, 0]} rotation={-Math.PI / 2} />
          <mesh position={[-0.82, 0.5, 0.05]} castShadow>
            <cylinderGeometry args={[0.34, 0.38, 0.1, 24]} />
            <meshStandardMaterial map={WALNUT_TEXTURE} color="#ddc8a9" roughness={0.48} />
          </mesh>
          <mesh position={[-0.82, 0.25, 0.05]}>
            <cylinderGeometry args={[0.035, 0.05, 0.48, 10]} />
            <meshStandardMaterial color="#816443" roughness={0.44} metalness={0.32} />
          </mesh>
          <mesh position={[-0.82, 0.78, 0.05]}>
            <cylinderGeometry args={[0.105, 0.14, 0.13, 18]} />
            <meshPhysicalMaterial color="#eee5d7" roughness={0.24} />
          </mesh>
        </group>
      </Interactive>
    );
  }
  if (feature.id === "window-seat") {
    return (
      <Interactive {...interactive}>
        <group position={[3.7, 0, -3.1]}>
          <RoundedBox position={[0, 0.48, 0]} args={[1.95, 0.24, 0.72]} radius={0.06} smoothness={3} castShadow>
            <meshStandardMaterial map={WALNUT_TEXTURE} color="#d7c3a3" roughness={0.52} />
          </RoundedBox>
          <RoundedBox position={[0, 0.66, 0.04]} args={[1.82, 0.16, 0.63]} radius={0.08} smoothness={4} castShadow>
            <meshStandardMaterial map={LINEN_TEXTURE} color="#d9cdbb" roughness={0.97} />
          </RoundedBox>
          <RoundedBox position={[0, 1.02, -0.25]} args={[1.88, 0.68, 0.16]} radius={0.08} smoothness={4} castShadow>
            <meshStandardMaterial map={LINEN_TEXTURE} color="#c5b49b" roughness={0.97} />
          </RoundedBox>
          {[-0.75, 0.75].map((x) => (
            <mesh key={x} position={[x, 0.93, 0.13]} castShadow>
              <boxGeometry args={[0.015, 0.4, 0.018]} />
              <meshStandardMaterial color="#a58255" roughness={0.4} metalness={0.35} />
            </mesh>
          ))}
        </group>
      </Interactive>
    );
  }
  if (feature.id === "writing-desk") {
    return (
      <Interactive {...interactive}>
        <WritingDesk />
      </Interactive>
    );
  }
  return (
    <Interactive {...interactive}>
      <group position={[4.4, 0, -2.3]}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <boxGeometry args={[1.8, 2.6, 0.14]} />
          <meshStandardMaterial color="#513f30" roughness={0.68} />
        </mesh>
        <mesh position={[0, 1.4, 0.09]}>
          <boxGeometry args={[1.62, 2.38, 0.045]} />
          <meshStandardMaterial color="#787767" roughness={0.82} />
        </mesh>
        {[-0.68, 0, 0.68].map((x) => (
          <mesh key={x} position={[x, 1.4, 0.14]} castShadow>
            <boxGeometry args={[0.06, 2.2, 0.12]} />
            <meshStandardMaterial color="#c0a376" metalness={0.36} roughness={0.4} />
          </mesh>
        ))}
      </group>
    </Interactive>
  );
}

function CeilingLights() {
  return (
    <group>
      {[-2.5, 2.5].map((x) => (
        <group key={x} position={[x, 2.95, -0.3]}>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.38, 8]} />
            <meshStandardMaterial color="#9d835f" metalness={0.7} roughness={0.25} />
          </mesh>
          <mesh position={[0, -0.05, 0]}>
            <sphereGeometry args={[0.22, 20, 12]} />
            <meshStandardMaterial
              color="#f4d7a2"
              emissive="#d4a45f"
              emissiveIntensity={0.62}
              roughness={0.3}
            />
          </mesh>
          <pointLight position={[0, -0.05, 0]} intensity={4.5} distance={5} color="#ffdb9d" />
        </group>
      ))}
    </group>
  );
}

function InteriorRoom({
  floor,
  selectedFeature,
  onFeatureSelect,
}: {
  floor: HotelFloor;
  selectedFeature: string | null;
  onFeatureSelect: (feature: InteriorFeature) => void;
}) {
  const features = FEATURES[floor.id] ?? FEATURES[0];
  const isLobby = floor.id === 0;
  const isMobile = useThree((state) => state.size.width <= 640);
  const controls = useRef<OrbitControlsImpl | null>(null);
  const desiredTarget = useRef(new THREE.Vector3(0, 1.12, 0));
  const desiredCamera = useRef(
    new THREE.Vector3(9.5, 10.5, 11.5).multiplyScalar(isMobile ? 1.45 : 1),
  );
  const isAnimatingCamera = useRef(true);

  useEffect(() => {
    desiredCamera.current.set(9.5, 10.5, 11.5).multiplyScalar(isMobile ? 1.45 : 1);
    isAnimatingCamera.current = true;
  }, [isMobile]);

  useFrame((_, delta) => {
    if (!isAnimatingCamera.current) return;
    const easing = 1 - Math.exp(-delta * 2.8);
    if (!controls.current) return;
    controls.current.target.lerp(desiredTarget.current, easing);
    controls.current.object.position.lerp(desiredCamera.current, easing);
    controls.current.update();
    if (
      controls.current.target.distanceToSquared(desiredTarget.current) < 0.0004 &&
      controls.current.object.position.distanceToSquared(desiredCamera.current) < 0.0004
    ) {
      controls.current.target.copy(desiredTarget.current);
      controls.current.object.position.copy(desiredCamera.current);
      controls.current.update();
      isAnimatingCamera.current = false;
    }
  });

  const focusFeature = (feature: InteriorFeature) => {
    onFeatureSelect(feature);
    const focusPoints: Record<string, [number, number, number]> = {
      "reception-desk": [0, 1.05, -1.75],
      "lobby-lounge": [0, 1.05, 1.15],
      "reception-flowers": [0, 1.7, -1.7],
      "lobby-artwork": [0, 1.95, -4.1],
      lounge: [1.8, 0.95, 0.15],
      "olive-tree": [5, 1.2, 2.3],
      "chef-table": [1.8, 0.95, 0.15],
      "king-bed": [-3.65, 0.85, -1.65],
      "reading-chair": [1.8, 0.95, 0.15],
      "writing-desk": [4.6, 0.9, 3.05],
      "suite-bed": [-3.65, 0.85, -1.65],
      "lounge-sofa": [1.8, 0.95, 0.15],
      "canopy-bed": [-3.65, 0.85, -1.65],
      "living-room": [1.8, 0.95, 0.15],
      "dining-table": [4.6, 0.95, 3.4],
      "penthouse-bed": [-3.65, 0.85, -1.65],
      "panoramic-lounge": [1.8, 0.95, 0.15],
      bathroom: [3.9, 1.1, -2.8],
      toilet: [5, 0.9, -0.2],
      terrace: [5, 1.2, 2.3],
    };
    const [x, y, z] = focusPoints[feature.id] ?? [0, 1.1, 0];
    desiredTarget.current.set(x, y, z);
    desiredCamera.current.set(x + 3.6, y + 2.1, z + 4.5);
    isAnimatingCamera.current = true;
  };

  return (
    <>
      <color attach="background" args={["#22241f"]} />
      <fog attach="fog" args={["#22241f", isMobile ? 24 : 15, isMobile ? 48 : 28]} />
      <ambientLight intensity={isMobile ? 0.9 : 0.58} color="#fff4df" />
      <hemisphereLight args={["#f2e7d2", "#625747", isMobile ? 1.2 : 0.9]} />
      <directionalLight
        position={[-4, 8, 5]}
        intensity={isMobile ? 2.25 : 1.85}
        color="#ffdfaa"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={8}
        shadow-camera-bottom={-7}
      />
      <pointLight position={[0, 3.1, -3.4]} intensity={isMobile ? 15 : 12} distance={9} color="#ffe2b6" />
      {isMobile && (
        <pointLight position={[0, 7, 8]} intensity={11} distance={20} color="#f4e7d1" />
      )}
      <Environment resolution={128} background={false}>
        <Lightformer form="rect" intensity={2} position={[-5, 6, 1]} scale={[7, 5, 1]} color="#eee5d3" />
        <Lightformer form="rect" intensity={1.8} position={[5, 4, -4]} scale={[6, 4, 1]} color="#f0d7b0" />
        <Lightformer form="rect" intensity={1.5} position={[0, 6, 0]} scale={[10, 0.6, 1]} color="#fff3dc" />
      </Environment>
      <RoomShell />
      {isLobby ? (
        <>
          <LobbyFloorDetails />
          <LobbyLighting />
          <Plant position={[-5.05, 0.08, -2.55]} />
          <Plant position={[5.05, 0.08, -2.55]} />
        </>
      ) : (
        <>
          <BedroomPartition />
          <BathroomCutaway />
          <ApartmentEntry />
          <LivingRoomTelevision />
          <CeilingLights />
        </>
      )}
      {features.map((feature) => (
        <FeatureObject
          key={feature.id}
          floor={floor}
          feature={feature}
          activeFeature={selectedFeature}
          onSelect={focusFeature}
        />
      ))}
      {!isLobby && <WallArtwork />}
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.3}
        scale={15}
        blur={2.5}
        far={5}
        resolution={512}
        color="#302a20"
      />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.075}
        minDistance={4.5}
        maxDistance={isMobile ? 30 : 18}
        minPolarAngle={0.02}
        maxPolarAngle={Math.PI - 0.02}
        target={[0, 1.12, 0]}
        rotateSpeed={0.58}
        panSpeed={0.62}
        onStart={() => {
          isAnimatingCamera.current = false;
        }}
      />
    </>
  );
}

export default function InteriorScene({
  floor,
  resetSignal,
  onFeatureSelect,
}: InteriorSceneProps) {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  useEffect(() => {
    setSelectedFeature(null);
  }, [floor.id, resetSignal]);

  const handleFeatureSelect = (feature: InteriorFeature) => {
    setSelectedFeature(feature.id);
    onFeatureSelect(feature);
  };

  return (
    <Canvas
      key={`${floor.id}-${resetSignal}`}
      shadows
      dpr={[1, 1.4]}
      camera={{ position: [9.5, 10.5, 11.5], fov: 40, near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl, camera, size }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = size.width <= 640 ? 1.12 : 1;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = size.width <= 640 ? 46 : 40;
          camera.updateProjectionMatrix();
        }
      }}
    >
      <InteriorRoom
        floor={floor}
        selectedFeature={selectedFeature}
        onFeatureSelect={handleFeatureSelect}
      />
    </Canvas>
  );
}
