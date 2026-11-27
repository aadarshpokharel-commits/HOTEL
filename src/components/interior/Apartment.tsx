import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ArchBuilder } from "../../three/ArchBuilder";
import { Model } from "../../three/assets";
import { PBRMaterial } from "../../three/pbr";
import { Surface } from "../../three/Surface";
import { BedsideLamp } from "./Bedroom";
import { CoffeeTable, ModernSofa } from "./Lobby";

// One-bedroom residence (floors 1–4), planned as a real apartment inside the
// 12.1 × 8.9 m floor plate (metres; the camera looks in from the south-east):
//
//   NW  bedroom (see Bedroom.tsx)        N   dining by the window
//   NE  marble bathroom + separate WC    C   living room facing a media wall
//   SW  entrance gallery / foyer         SE  pantry bar
//
// Floors are herringbone parquet, the bathroom and WC are marble. Interior
// partitions stay low on the camera side so the plan reads as a cutaway.

export const PLATE = { x0: -6.04, x1: 6.04, z0: -4.36, z1: 4.55 };
export const BATH = { x0: 2.08, x1: 6.04, z0: -4.36, z1: -1.2 };
export const WC = { x0: 4.2, x1: 6.04, z0: -1.2, z1: 0.75 };
const BEDROOM_EAST = -1.13;
const BEDROOM_SOUTH = 0.36;
const T = 0.12; // partition thickness

export const LIVING_CENTER: [number, number, number] = [0.9, 0, 1.45];
export const DINING_CENTER: [number, number, number] = [0.52, 0, -2.75];

const noRaycast = () => undefined;

/** Per-floor palette so each residence has its own character. */
export type Palette = { sofa: string; cushion: string; accents: [string, string]; chair: string };
const PALETTES: Record<number, Palette> = {
  1: { sofa: "#d8cbb6", cushion: "#e4d8c4", accents: ["#a45f3c", "#c99a6b"], chair: "#a4663f" },
  2: { sofa: "#cfd0c0", cushion: "#dddccc", accents: ["#6f7d61", "#c9b38f"], chair: "#7b8667" },
  3: { sofa: "#c7ccd0", cushion: "#d6dadb", accents: ["#2f4454", "#b9a27c"], chair: "#3c5262" },
  4: { sofa: "#d9cbb9", cushion: "#e6dacb", accents: ["#8c5a3c", "#4d5b4a"], chair: "#8c5a3c" },
  5: { sofa: "#e6dccb", cushion: "#efe7d9", accents: ["#b98d63", "#8a9478"], chair: "#b98d63" },
};
export function paletteFor(floorId: number) {
  return PALETTES[floorId] ?? PALETTES[4];
}

// --------------------------------------------------------------------------
// Merged static architecture.

type Part = "plaster" | "marble" | "marbleFloor" | "parquetFloor" | "travertineFloor" | "deck" | "walnut" | "brass" | "dark" | "glow";

function PartMaterial({ part, plaster }: { part: Part; plaster: string }) {
  switch (part) {
    case "plaster":
      return <Surface kind="plaster" color={plaster} roughness={0.92} />;
    case "marble":
      return <Surface kind="marble" color="#ece6dc" roughness={0.22} />;
    case "marbleFloor":
      return <Surface kind="marble" color="#e2dbcf" roughness={0.3} />;
    case "parquetFloor":
      return <PBRMaterial set="parquet" roughness={0.9} />;
    case "travertineFloor":
      return <Surface kind="travertine" color="#e2d6c2" roughness={0.4} />;
    case "deck":
      return <Surface kind="oak" color="#8a6a4f" roughness={0.75} />;
    case "walnut":
      return <PBRMaterial set="walnut" color="#c9ae90" roughness={0.85} />;
    case "brass":
      return <Surface kind="brass" color="#c9a36a" roughness={0.28} metalness={0.92} />;
    case "dark":
      return <meshStandardMaterial color="#1b1612" roughness={0.8} />;
    case "glow":
      return <meshStandardMaterial color="#fff0d6" emissive="#ffc27a" emissiveIntensity={2.2} />;
  }
}

function Merged({ build, plaster = "#cfc4b2" }: { build: () => Map<string, THREE.BufferGeometry>; plaster?: string }) {
  const parts = useMemo(build, [build]);
  useEffect(() => () => parts.forEach((geometry) => geometry.dispose()), [parts]);
  return (
    <>
      {[...parts].map(([key, geometry]) => (
        <mesh key={key} geometry={geometry} castShadow={!/Floor|glow|deck/.test(key)} receiveShadow raycast={noRaycast}>
          <PartMaterial part={key as Part} plaster={plaster} />
        </mesh>
      ))}
    </>
  );
}

/** A wall run with optional door gaps, capped with walnut. */
function wall(b: ArchBuilder, axis: "x" | "z", at: number, from: number, to: number, height: number, gaps: [number, number][] = [], skin?: -1 | 1) {
  const pieces: [number, number][] = [];
  let start = from;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (g0 > start) pieces.push([start, g0]);
    start = Math.max(start, g1);
  }
  if (to > start) pieces.push([start, to]);
  for (const [p0, p1] of pieces) {
    const len = p1 - p0;
    const mid = (p0 + p1) / 2;
    if (axis === "x") {
      b.box("plaster", [len, height, T], [mid, height / 2, at], { bevel: 0.004 });
      b.box("walnut", [len + 0.004, 0.03, T + 0.01], [mid, height + 0.015, at], { bevel: 0.004 });
      if (skin) b.box("marble", [len, height - 0.02, 0.012], [mid, height / 2, at + skin * (T / 2 + 0.006)]);
    } else {
      b.box("plaster", [T, height, len], [at, height / 2, mid], { bevel: 0.004 });
      b.box("walnut", [T + 0.01, 0.03, len + 0.004], [at, height + 0.015, mid], { bevel: 0.004 });
      if (skin) b.box("marble", [0.012, height - 0.02, len], [at + skin * (T / 2 + 0.006), height / 2, mid]);
    }
  }
}

function floorPiece(b: ArchBuilder, key: Part, x0: number, x1: number, z0: number, z1: number) {
  b.box(key, [x1 - x0, 0.012, z1 - z0], [(x0 + x1) / 2, 0.006, (z0 + z1) / 2]);
}

function buildResidenceShell() {
  const b = new ArchBuilder();
  // Floors: parquet everywhere except the marble bathroom and WC.
  floorPiece(b, "parquetFloor", PLATE.x0, BATH.x0, PLATE.z0, PLATE.z1);
  floorPiece(b, "parquetFloor", BATH.x0, WC.x0, BATH.z1, PLATE.z1);
  floorPiece(b, "parquetFloor", WC.x0, PLATE.x1, WC.z1, PLATE.z1);
  floorPiece(b, "marbleFloor", BATH.x0, BATH.x1, BATH.z0, BATH.z1);
  floorPiece(b, "marbleFloor", WC.x0, WC.x1, WC.z0, WC.z1);
  bathroomWalls(b);
  return b.build();
}

function bathroomWalls(b: ArchBuilder) {
  // Back (west) wall of the bathroom is tall; camera-side walls stay low.
  wall(b, "z", BATH.x0, BATH.z0, BATH.z1, 2.4, [], 1);
  wall(b, "x", BATH.z1, BATH.x0, BATH.x1, 1.1, [[2.25, 3.05]], -1);
  wall(b, "z", WC.x0, WC.z0 + T / 2, WC.z1, 1.1, [], 1);
  wall(b, "x", WC.z1, WC.x0, WC.x1, 1.1, [[4.35, 5.1]], -1);
}

// --------------------------------------------------------------------------
// Bathroom and WC.

function Basin({ position }: { position: [number, number, number] }) {
  const geometry = useMemo(() => {
    const outer = [[0, 0], [0.09, 0], [0.16, 0.03], [0.2, 0.1], [0.21, 0.14]];
    const inner = [[0.19, 0.14], [0.17, 0.08], [0.1, 0.03], [0, 0.025]];
    const g = new THREE.LatheGeometry([...outer, ...inner].map(([x, y]) => new THREE.Vector2(x, y)), 48);
    g.userData.boxUV = true;
    return g;
  }, []);
  return (
    <mesh geometry={geometry} position={position} castShadow receiveShadow raycast={noRaycast}>
      <Surface kind="ceramic" physical color="#f4f1ec" roughness={0.12} clearcoat={0.8} clearcoatRoughness={0.1} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Wall-mounted brass spout. */
function Spout({ position, rotationY = 0, reach = 0.16 }: { position: [number, number, number]; rotationY?: number; reach?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, reach / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow raycast={noRaycast}>
        <cylinderGeometry args={[0.011, 0.011, reach, 14]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
      </mesh>
      <mesh position={[0, 0, 0.002]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[0.035, 0.035, 0.012, 24]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
      </mesh>
      <mesh position={[0.08, 0.06, 0.012]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[0.022, 0.022, 0.03, 20]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
      </mesh>
    </group>
  );
}

function Bathtub({ position, length = 1.7, width = 0.8 }: { position: [number, number, number]; length?: number; width?: number }) {
  const geometry = useMemo(() => {
    // Closed profile: outer wall up to a rolled rim, then down the inside.
    const profile = [
      [0, 0], [0.4, 0], [0.43, 0.03], [0.47, 0.3], [0.5, 0.55], [0.5, 0.58], [0.47, 0.585],
      [0.45, 0.56], [0.43, 0.35], [0.38, 0.14], [0.3, 0.09], [0, 0.085],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.LatheGeometry(profile, 72);
    g.userData.boxUV = true;
    return g;
  }, []);
  return (
    <group position={position}>
      <mesh geometry={geometry} scale={[length, 1, width]} castShadow receiveShadow raycast={noRaycast}>
        <Surface kind="ceramic" physical color="#f3f0ea" roughness={0.14} clearcoat={0.9} clearcoatRoughness={0.08} side={THREE.DoubleSide} />
      </mesh>
      {/* Floor-mounted brass tub filler. */}
      <group position={[length * 0.5 + 0.1, 0, 0]}>
        <mesh position={[0, 0.48, 0]} castShadow raycast={noRaycast}>
          <cylinderGeometry args={[0.016, 0.02, 0.96, 16]} />
          <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
        </mesh>
        <mesh position={[-0.11, 0.96, 0]} rotation={[0, 0, Math.PI / 2]} raycast={noRaycast}>
          <torusGeometry args={[0.11, 0.014, 10, 24, Math.PI / 2]} />
          <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
        </mesh>
      </group>
    </group>
  );
}

function Towel({ position, rotation = 0, color = "#efe9df", size = [0.42, 0.62] }: { position: [number, number, number]; rotation?: number; color?: string; size?: [number, number] }) {
  return (
    <RoundedBox args={[size[0], size[1], 0.03]} radius={0.012} smoothness={3} position={position} rotation={[0, rotation, 0]} castShadow raycast={noRaycast}>
      <Surface kind="fabric" color={color} roughness={1} />
    </RoundedBox>
  );
}

export function Bathroom({ tub = true }: { tub?: boolean }) {
  const vanityX = 4.6;
  const wallZ = BATH.z0;
  return (
    <group>
      {/* Walk-in shower in the north-west corner. */}
      <mesh position={[3.3, 1.02, -3.68]} raycast={noRaycast}>
        <boxGeometry args={[0.012, 2.0, 1.36]} />
        <meshPhysicalMaterial color="#e6eeec" roughness={0.03} metalness={0.05} transparent opacity={0.16} envMapIntensity={1.6} depthWrite={false} />
      </mesh>
      <mesh position={[2.42, 1.02, -3.0]} raycast={noRaycast}>
        <boxGeometry args={[0.56, 2.0, 0.012]} />
        <meshPhysicalMaterial color="#e6eeec" roughness={0.03} metalness={0.05} transparent opacity={0.16} envMapIntensity={1.6} depthWrite={false} />
      </mesh>
      <mesh position={[3.3, 2.03, -3.68]} raycast={noRaycast}>
        <boxGeometry args={[0.025, 0.025, 1.38]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
      </mesh>
      <mesh position={[2.72, 2.24, -4.02]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[0.01, 0.01, 0.66, 10]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
      </mesh>
      <mesh position={[2.72, 2.22, -3.68]} raycast={noRaycast}>
        <cylinderGeometry args={[0.15, 0.15, 0.012, 40]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
      </mesh>
      <mesh position={[2.16, 1.1, -3.75]} rotation={[0, 0, Math.PI / 2]} raycast={noRaycast}>
        <cylinderGeometry args={[0.06, 0.06, 0.012, 32]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
      </mesh>
      <mesh position={[2.72, 0.014, -4.24]} raycast={noRaycast}>
        <boxGeometry args={[1.0, 0.004, 0.05]} />
        <Surface kind="brass" color="#9c7f55" roughness={0.4} metalness={0.9} />
      </mesh>

      {/* Floating walnut double vanity, marble top, vessel basins. */}
      <group position={[vanityX, 0, wallZ + 0.26]}>
        <RoundedBox args={[2.1, 0.42, 0.5]} radius={0.01} smoothness={2} position={[0, 0.64, 0]} castShadow receiveShadow raycast={noRaycast}>
          <PBRMaterial set="walnut" color="#cdb497" roughness={0.85} />
        </RoundedBox>
        <mesh position={[0, 0.64, 0.251]} raycast={noRaycast}>
          <boxGeometry args={[0.004, 0.38, 0.004]} />
          <meshStandardMaterial color="#1a120c" />
        </mesh>
        <RoundedBox args={[2.14, 0.035, 0.53]} radius={0.006} smoothness={2} position={[0, 0.875, 0.01]} castShadow receiveShadow raycast={noRaycast}>
          <Surface kind="marble" color="#f0ebe2" roughness={0.18} />
        </RoundedBox>
        <mesh position={[0, 0.44, 0.1]} raycast={noRaycast}>
          <boxGeometry args={[2.0, 0.01, 0.3]} />
          <meshStandardMaterial color="#fff0d6" emissive="#ffc27a" emissiveIntensity={1.4} />
        </mesh>
        {[-0.52, 0.52].map((x) => (
          <group key={x}>
            <Basin position={[x, 0.892, 0.04]} />
            <Spout position={[x, 1.12, -0.25]} reach={0.18} />
            {/* Backlit round-cornered mirror above each basin. */}
            <RoundedBox args={[0.74, 0.96, 0.02]} radius={0.08} smoothness={4} position={[x, 1.62, -0.245]} raycast={noRaycast}>
              <meshStandardMaterial color="#fff0d6" emissive="#ffc993" emissiveIntensity={1.1} />
            </RoundedBox>
            <RoundedBox args={[0.7, 0.92, 0.02]} radius={0.075} smoothness={4} position={[x, 1.62, -0.225]} raycast={noRaycast}>
              <meshStandardMaterial color="#e9eeee" metalness={0.8} roughness={0.1} envMapIntensity={1.6} emissive="#3a3d3c" emissiveIntensity={0.6} />
            </RoundedBox>
          </group>
        ))}
        <Model name="vaseRound" position={[0, 0.893, -0.08]} scale={0.6} castShadow={false} />
        <Towel position={[0.88, 0.97, 0.02]} size={[0.3, 0.12]} color="#e9e2d6" />
      </group>
      {/* Light budget: max four point lights per scene; this fixture glows (emissive) without casting light. */}

      {tub && <Bathtub position={[4.75, 0.012, -2.3]} />}
      {/* Bath mat between vanity and tub. */}
      <RoundedBox args={[0.9, 0.012, 0.55]} radius={0.004} smoothness={2} position={[4.6, 0.02, -3.32]} receiveShadow raycast={noRaycast}>
        <Surface kind="rug" color="#e6ded2" roughness={1} />
      </RoundedBox>

      {/* Heated brass towel ladder with towels on the west wall. */}
      <group position={[BATH.x0 + T / 2 + 0.06, 0, -1.95]}>
        {[-0.25, 0.25].map((z) => (
          <mesh key={z} position={[0, 0.95, z]} raycast={noRaycast}>
            <cylinderGeometry args={[0.012, 0.012, 1.3, 10]} />
            <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
          </mesh>
        ))}
        {[0.45, 0.7, 0.95, 1.2, 1.45].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
            <cylinderGeometry args={[0.008, 0.008, 0.5, 8]} />
            <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
          </mesh>
        ))}
        <Towel position={[0.025, 1.0, 0]} rotation={Math.PI / 2} size={[0.44, 0.7]} />
      </group>
      <Model name="plant" position={[5.7, 0.012, -1.65]} scale={0.6} rotation={[0, 1.4, 0]} />
      {/* Bathroom door, open into the room. */}
      <group position={[2.27, 0, BATH.z1 - 0.06]} rotation={[0, -1.25, 0]}>
        <mesh position={[0.4, 1.0, 0]} castShadow raycast={noRaycast}>
          <boxGeometry args={[0.8, 2.0, 0.04]} />
          <PBRMaterial set="walnut" color="#b89b7c" roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}

function WallHungWC({ position }: { position: [number, number, number] }) {
  const bowl = useMemo(() => {
    const profile = [[0, 0.06], [0.12, 0.05], [0.18, 0.12], [0.2, 0.3], [0.19, 0.38], [0.16, 0.39], [0.15, 0.3], [0.08, 0.18], [0, 0.17]].map(
      ([x, y]) => new THREE.Vector2(x, y),
    );
    const g = new THREE.LatheGeometry(profile, 48);
    g.userData.boxUV = true;
    return g;
  }, []);
  return (
    <group position={position}>
      <mesh geometry={bowl} position={[0, 0.02, 0.27]} scale={[0.95, 1, 1.35]} castShadow raycast={noRaycast}>
        <Surface kind="ceramic" physical color="#f4f1ec" roughness={0.12} clearcoat={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.17, 0.08]} castShadow raycast={noRaycast}>
        <boxGeometry args={[0.32, 0.3, 0.16]} />
        <Surface kind="ceramic" physical color="#f4f1ec" roughness={0.12} clearcoat={0.8} />
      </mesh>
      <mesh position={[0, 0.415, 0.29]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1.3, 1]} castShadow raycast={noRaycast}>
        <torusGeometry args={[0.15, 0.022, 12, 40]} />
        <Surface kind="satin" color="#f7f4ef" roughness={0.3} />
      </mesh>
    </group>
  );
}

export function Washroom() {
  return (
    <group>
      {/* Marble-clad concealed cistern ledge along the north wall. */}
      <RoundedBox args={[WC.x1 - WC.x0 - T / 2 - 0.02, 0.86, 0.2]} radius={0.006} smoothness={2} position={[(WC.x0 + WC.x1) / 2 + 0.03, 0.43, WC.z0 + T / 2 + 0.1]} castShadow receiveShadow raycast={noRaycast}>
        <Surface kind="marble" color="#ece6dc" roughness={0.22} />
      </RoundedBox>
      <mesh position={[5.45, 0.98, WC.z0 + T / 2 + 0.005]} raycast={noRaycast}>
        <boxGeometry args={[0.24, 0.16, 0.012]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
      </mesh>
      <WallHungWC position={[5.45, 0.0, WC.z0 + T / 2 + 0.2]} />
      <Basin position={[4.65, 0.865, WC.z0 + T / 2 + 0.12]} />
      <Spout position={[4.65, 1.03, WC.z0 + T / 2 + 0.01]} reach={0.12} />
      <mesh position={[(WC.x0 + WC.x1) / 2, 0.05, WC.z0 + T / 2 + 0.205]} raycast={noRaycast}>
        <boxGeometry args={[1.6, 0.01, 0.01]} />
        <meshStandardMaterial color="#fff0d6" emissive="#ffc27a" emissiveIntensity={1.4} />
      </mesh>
      {/* WC door, open outward. */}
      <group position={[4.37, 0, WC.z1 + 0.06]} rotation={[0, 1.2, 0]}>
        <mesh position={[0.37, 1.0, 0]} castShadow raycast={noRaycast}>
          <boxGeometry args={[0.74, 2.0, 0.04]} />
          <PBRMaterial set="walnut" color="#b89b7c" roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}

// --------------------------------------------------------------------------
// Dining by the window.

function DiningChair({ position, rotation, fabric }: { position: [number, number, number]; rotation: number; fabric: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[0.46, 0.09, 0.46]} radius={0.035} smoothness={4} position={[0, 0.47, 0]} castShadow receiveShadow>
        <Surface kind="fabric" color={fabric} roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[0.44, 0.4, 0.07]} radius={0.03} smoothness={4} position={[0, 0.74, -0.2]} rotation={[-0.12, 0, 0]} castShadow>
        <Surface kind="fabric" color={fabric} roughness={0.95} />
      </RoundedBox>
      {[[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.215, z]} castShadow>
          <cylinderGeometry args={[0.016, 0.012, 0.43, 10]} />
          <PBRMaterial set="walnut" color="#8f735a" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

export function Dining({ round = false, fabric }: { round?: boolean; fabric: string }) {
  const [cx, , cz] = DINING_CENTER;
  const chairs: [number, number, number][] = round
    ? Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        return [cx + Math.sin(a) * 1.02, 0.012, cz + Math.cos(a) * 1.02];
      })
    : [
        [cx - 0.5, 0.012, cz - 0.72], [cx + 0.5, 0.012, cz - 0.72],
        [cx - 0.5, 0.012, cz + 0.72], [cx + 0.5, 0.012, cz + 0.72],
        [cx - 1.28, 0.012, cz], [cx + 1.28, 0.012, cz],
      ];
  return (
    <group>
      {round ? (
        <group position={[cx, 0.012, cz]}>
          <mesh position={[0, 0.36, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.32, 0.7, 48]} />
            <Surface kind="travertine" color="#d9ccb6" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.735, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.76, 0.75, 0.05, 72]} />
            <Surface kind="travertine" color="#e4d9c6" roughness={0.3} />
          </mesh>
        </group>
      ) : (
        <group position={[cx, 0.012, cz]}>
          <RoundedBox args={[2.0, 0.045, 0.95]} radius={0.012} smoothness={3} position={[0, 0.74, 0]} castShadow receiveShadow>
            <PBRMaterial set="walnut" color="#d2b998" roughness={0.75} />
          </RoundedBox>
          {[-0.72, 0.72].map((x) => (
            <mesh key={x} position={[x, 0.36, 0]} castShadow>
              <boxGeometry args={[0.08, 0.72, 0.7]} />
              <Surface kind="travertine" color="#d9ccb6" roughness={0.45} />
            </mesh>
          ))}
        </group>
      )}
      {chairs.map((p, i) => (
        <DiningChair key={i} position={p} rotation={Math.atan2(cx - p[0], cz - p[2])} fabric={fabric} />
      ))}
      <Model name="vaseTall" position={[cx - 0.12, 0.775, cz]} scale={0.8} castShadow={false} />
      <Model name="vaseRound" position={[cx + 0.2, 0.775, cz + 0.05]} scale={0.55} castShadow={false} />
      {/* Linear brass pendant with opal globes. */}
      <group position={[cx, 1.78, cz]}>
        {[-0.75, 0.75].map((x) => (
          <mesh key={x} position={[x, 0.76, 0]} raycast={noRaycast}>
            <cylinderGeometry args={[0.004, 0.004, 1.52, 6]} />
            <Surface kind="brass" color="#c9a36a" roughness={0.3} metalness={0.9} />
          </mesh>
        ))}
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow raycast={noRaycast}>
          <cylinderGeometry args={[0.016, 0.016, round ? 1.0 : 1.6, 16]} />
          <Surface kind="brass" color="#c9a36a" roughness={0.25} metalness={0.92} />
        </mesh>
        {(round ? [-0.4, 0, 0.4] : [-0.6, -0.2, 0.2, 0.6]).map((x) => (
          <mesh key={x} position={[x, -0.12, 0]} raycast={noRaycast}>
            <sphereGeometry args={[0.08, 24, 16]} />
            <meshStandardMaterial color="#fff6e8" emissive="#ffc68a" emissiveIntensity={1.5} />
          </mesh>
        ))}
      </group>
      <pointLight position={[cx, 1.6, cz]} intensity={2.6} distance={4.5} decay={2} color="#ffcf96" />
    </group>
  );
}

// --------------------------------------------------------------------------
// Living room facing a walnut media wall.

export function Living({ palette }: { palette: Palette }) {
  const [cx, , cz] = LIVING_CENTER;
  const wallX = 3.95;
  return (
    <group>
      <RoundedBox args={[3.9, 0.012, 3.4]} radius={0.004} smoothness={2} position={[cx - 0.15, 0.018, cz]} receiveShadow raycast={noRaycast}>
        <Surface kind="rug" color="#5f5246" roughness={1} />
      </RoundedBox>
      <RoundedBox args={[3.7, 0.012, 3.2]} radius={0.004} smoothness={2} position={[cx - 0.15, 0.022, cz]} receiveShadow raycast={noRaycast}>
        <Surface kind="rug" color="#d2c5b0" roughness={1} />
      </RoundedBox>
      <ModernSofa position={[cx - 1.35, 0.03, cz]} rotation={Math.PI / 2} width={2.6} fabric={palette.sofa} cushion={palette.cushion} accents={palette.accents} />
      <CoffeeTable position={[cx + 0.05, 0.03, cz]} />
      <Model name="loungeChair" position={[cx + 0.15, 0.03, cz - 1.55]} rotation={[0, 0.25, 0]} />
      <Model name="loungeChair" position={[cx + 0.15, 0.03, cz + 1.55]} rotation={[0, Math.PI - 0.25, 0]} />
      {/* Side table with lamp at the sofa's end. */}
      <group position={[cx - 1.35, 0.03, cz + 1.55]}>
        <mesh position={[0, 0.26, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.22, 0.52, 40]} />
          <PBRMaterial set="walnut" color="#a68667" roughness={0.8} />
        </mesh>
        <BedsideLamp position={[0, 0.52, 0]} scale={0.9} light={false} />
      </group>

      {/* Media wall: walnut panelling, flush TV, low console, cove light. */}
      <mesh position={[wallX + 0.06, 0.8, cz]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 1.6, 3.2]} />
        <PBRMaterial set="walnut" color="#bfa283" roughness={0.85} />
      </mesh>
      <mesh position={[wallX - 0.005, 1.13, cz]} castShadow>
        <boxGeometry args={[0.03, 0.74, 1.3]} />
        <meshStandardMaterial color="#121314" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh position={[wallX - 0.021, 1.13, cz]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[1.28, 0.72]} />
        <meshPhysicalMaterial color="#05080b" roughness={0.08} metalness={0.2} clearcoat={1} clearcoatRoughness={0.05} />
      </mesh>
      <mesh position={[wallX - 0.01, 1.58, cz]}>
        <boxGeometry args={[0.02, 0.012, 3.1]} />
        <meshStandardMaterial color="#fff0d6" emissive="#ffc27a" emissiveIntensity={2} />
      </mesh>
      <Model name="mediaCabinet" position={[wallX - 0.28, 0.03, cz]} rotation={[0, -Math.PI / 2, 0]} />
      <Model name="vaseTall" position={[wallX - 0.3, 0.71, cz - 0.95]} castShadow={false} />
      <Model name="plant" position={[wallX - 0.45, 0.012, cz + 2.0]} scale={1.1} rotation={[0, 0.6, 0]} />
      <Model name="pendant" position={[cx, 3.3 - 1.172 + 0.15, cz]} castShadow={false} />
      <pointLight position={[cx, 2.2, cz]} intensity={3.4} distance={6} decay={2} color="#ffcf96" />
    </group>
  );
}

// --------------------------------------------------------------------------
// Entrance gallery (SW) and pantry bar (SE) for the residences.

function FrontDoor({ z }: { z: number }) {
  return (
    <group position={[PLATE.x0 + 0.02, 0, z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 1.12, 0]} castShadow raycast={noRaycast}>
        <boxGeometry args={[1.14, 2.24, 0.05]} />
        <PBRMaterial set="walnut" color="#5d4636" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.08, 0.03]} castShadow raycast={noRaycast}>
        <boxGeometry args={[0.98, 2.12, 0.03]} />
        <PBRMaterial set="walnut" color="#a2846a" roughness={0.8} />
      </mesh>
      <mesh position={[0.36, 1.05, 0.08]} raycast={noRaycast}>
        <boxGeometry args={[0.02, 0.5, 0.02]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
      </mesh>
    </group>
  );
}

export function Foyer() {
  return (
    <group>
      <FrontDoor z={3.7} />
      {/* Console with round mirror, lamp and vase. */}
      <group position={[PLATE.x0 + 0.22, 0.012, 1.55]}>
        <RoundedBox args={[0.4, 0.04, 1.4]} radius={0.008} smoothness={2} position={[0, 0.82, 0]} castShadow receiveShadow>
          <Surface kind="travertine" color="#e0d4c0" roughness={0.35} />
        </RoundedBox>
        {[-0.62, 0.62].map((z) => (
          <mesh key={z} position={[0, 0.4, z]} castShadow>
            <boxGeometry args={[0.3, 0.8, 0.02]} />
            <Surface kind="brass" color="#b8925c" roughness={0.3} metalness={0.9} />
          </mesh>
        ))}
        <BedsideLamp position={[0, 0.84, -0.4]} />
        <Model name="vaseRound" position={[0, 0.84, 0.35]} scale={0.9} castShadow={false} />
      </group>
      <group position={[PLATE.x0 + 0.03, 1.65, 1.55]} rotation={[0, Math.PI / 2, 0]}>
        <mesh raycast={noRaycast}>
          <torusGeometry args={[0.42, 0.02, 12, 64]} />
          <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
        </mesh>
        <mesh position={[0, 0, 0.005]} raycast={noRaycast}>
          <circleGeometry args={[0.41, 64]} />
          <meshStandardMaterial color="#e9eeee" metalness={0.8} roughness={0.1} envMapIntensity={1.6} emissive="#3a3d3c" emissiveIntensity={0.6} />
        </mesh>
      </group>
      <Model name="ottoman" position={[PLATE.x0 + 0.4, 0.012, 2.75]} rotation={[0, 0, 0]} />

      {/* Gallery table under a pendant, on a round rug. */}
      <mesh position={[-3.6, 0.018, 2.45]} receiveShadow raycast={noRaycast}>
        <cylinderGeometry args={[1.25, 1.25, 0.012, 72]} />
        <Surface kind="rug" color="#cbbda6" roughness={1} />
      </mesh>
      <group position={[-3.6, 0.025, 2.45]}>
        <mesh position={[0, 0.36, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.26, 0.72, 40]} />
          <PBRMaterial set="walnut" color="#8f735a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.52, 0.5, 0.05, 64]} />
          <Surface kind="marble" color="#ece5d9" roughness={0.2} />
        </mesh>
        <Model name="vaseTall" position={[0.05, 0.775, 0]} castShadow={false} />
        <Model name="vaseRound" position={[-0.22, 0.775, 0.12]} scale={0.7} castShadow={false} />
      </group>
      <Model name="pendant" position={[-3.6, 3.3 - 1.172 + 0.1, 2.45]} castShadow={false} />
      {/* Light budget: max four point lights per scene; this fixture glows (emissive) without casting light. */}
      <Model name="plant" position={[-1.55, 0.012, 4.1]} rotation={[0, 2.2, 0]} />
    </group>
  );
}

function BarStool({ position, rotation = 0, seat = "#5b3b28" }: { position: [number, number, number]; rotation?: number; seat?: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.01, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 32]} />
        <Surface kind="brass" color="#b8925c" roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[0, 0.33, 0]} castShadow raycast={noRaycast}>
        <cylinderGeometry args={[0.025, 0.025, 0.62, 12]} />
        <Surface kind="brass" color="#b8925c" roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <torusGeometry args={[0.16, 0.008, 8, 32]} />
        <Surface kind="brass" color="#b8925c" roughness={0.3} metalness={0.9} />
      </mesh>
      <RoundedBox args={[0.4, 0.07, 0.4]} radius={0.03} smoothness={4} position={[0, 0.68, 0]} castShadow>
        <Surface kind="satin" color={seat} roughness={0.55} />
      </RoundedBox>
      <RoundedBox args={[0.38, 0.2, 0.05]} radius={0.02} smoothness={3} position={[0, 0.82, -0.17]} castShadow>
        <Surface kind="satin" color={seat} roughness={0.55} />
      </RoundedBox>
    </group>
  );
}

export function PantryBar() {
  const x = PLATE.x1 - 0.3;
  return (
    <group>
      <group position={[x, 0.012, 2.8]}>
        <mesh position={[0, 0.05, 0.0]} raycast={noRaycast}>
          <boxGeometry args={[0.5, 0.1, 2.76]} />
          <meshStandardMaterial color="#17110c" roughness={0.9} />
        </mesh>
        <RoundedBox args={[0.6, 0.76, 2.8]} radius={0.008} smoothness={2} position={[0, 0.48, 0]} castShadow receiveShadow>
          <PBRMaterial set="walnut" color="#c9ae90" roughness={0.85} />
        </RoundedBox>
        {[-0.7, 0, 0.7].map((z) => (
          <mesh key={z} position={[-0.301, 0.48, z]} raycast={noRaycast}>
            <boxGeometry args={[0.004, 0.72, 0.004]} />
            <meshStandardMaterial color="#1a120c" />
          </mesh>
        ))}
        <RoundedBox args={[0.66, 0.04, 2.86]} radius={0.006} smoothness={2} position={[-0.02, 0.88, 0]} castShadow receiveShadow>
          <Surface kind="marble" color="#efe9df" roughness={0.18} />
        </RoundedBox>
        {/* Undermount sink with brass gooseneck. */}
        <mesh position={[0, 0.9, -0.55]} raycast={noRaycast}>
          <boxGeometry args={[0.38, 0.004, 0.45]} />
          <meshStandardMaterial color="#2a2c2d" roughness={0.3} metalness={0.6} />
        </mesh>
        <group position={[0.2, 0.9, -0.55]}>
          <mesh position={[0, 0.17, 0]} raycast={noRaycast}>
            <cylinderGeometry args={[0.013, 0.016, 0.34, 12]} />
            <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
          </mesh>
          <mesh position={[-0.08, 0.34, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} raycast={noRaycast}>
            <torusGeometry args={[0.08, 0.012, 8, 24, Math.PI]} />
            <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
          </mesh>
        </group>
        {/* Espresso machine and wine fridge. */}
        <RoundedBox args={[0.34, 0.36, 0.3]} radius={0.02} smoothness={3} position={[0.05, 1.08, 0.55]} castShadow raycast={noRaycast}>
          <meshStandardMaterial color="#c9cacb" roughness={0.25} metalness={0.9} />
        </RoundedBox>
        <mesh position={[-0.302, 0.48, 1.05]} rotation={[0, -Math.PI / 2, 0]} raycast={noRaycast}>
          <planeGeometry args={[0.55, 0.66]} />
          <meshPhysicalMaterial color="#0d0f10" roughness={0.05} metalness={0.3} clearcoat={1} emissive="#3a1d10" emissiveIntensity={0.35} />
        </mesh>
        <Model name="vaseRound" position={[0, 0.9, 1.15]} scale={0.7} castShadow={false} />
      </group>
      <BarStool position={[x - 0.75, 0.012, 2.4]} rotation={Math.PI / 2} />
      <BarStool position={[x - 0.75, 0.012, 3.1]} rotation={Math.PI / 2} />
      {[2.3, 3.3].map((z) => (
        <Model key={z} name="pendant" position={[x - 0.05, 3.3 - 1.172 + 0.45, z]} scale={0.8} castShadow={false} />
      ))}
    </group>
  );
}

export const TERRACE = { x0: 3.1, z0: 0.85 };

function buildPenthouseShell() {
  const b = new ArchBuilder();
  // Oak parquet in the bedroom, travertine through the living spaces, marble
  // in the bathrooms and a teak deck on the terrace.
  floorPiece(b, "parquetFloor", PLATE.x0, BEDROOM_EAST, PLATE.z0, BEDROOM_SOUTH);
  floorPiece(b, "travertineFloor", PLATE.x0, BEDROOM_EAST, BEDROOM_SOUTH, PLATE.z1);
  floorPiece(b, "travertineFloor", BEDROOM_EAST, BATH.x0, PLATE.z0, PLATE.z1);
  floorPiece(b, "travertineFloor", BATH.x0, TERRACE.x0, BATH.z1, PLATE.z1);
  floorPiece(b, "travertineFloor", TERRACE.x0, WC.x0, BATH.z1, TERRACE.z0);
  floorPiece(b, "marbleFloor", BATH.x0, BATH.x1, BATH.z0, BATH.z1);
  floorPiece(b, "marbleFloor", WC.x0, WC.x1, WC.z0, WC.z1);
  floorPiece(b, "deck", TERRACE.x0, PLATE.x1, TERRACE.z0 + 0.0, PLATE.z1);
  bathroomWalls(b);
  return b.build();
}

/** Penthouse finishes and partitions, with warmer lime-washed walls. */
export function PenthouseShell() {
  return <Merged build={buildPenthouseShell} plaster="#e3d9c8" />;
}

/** Floor finishes, partitions and doors shared by the residences. */
export function ResidenceShell() {
  return <Merged build={buildResidenceShell} />;
}

/** Things anchored to a feature id: used for the selection ring and camera. */
export const FEATURE_ANCHORS: Record<string, [number, number, number]> = {
  "chef-table": [LIVING_CENTER[0], 0.95, LIVING_CENTER[2]],
  "reading-chair": [LIVING_CENTER[0], 0.95, LIVING_CENTER[2]],
  "lounge-sofa": [LIVING_CENTER[0], 0.95, LIVING_CENTER[2]],
  "living-room": [LIVING_CENTER[0], 0.95, LIVING_CENTER[2]],
  "dining-table": [DINING_CENTER[0], 0.9, DINING_CENTER[2]],
  bathroom: [4.1, 1.0, -2.8],
  toilet: [5.1, 0.85, -0.25],
};

export function Flame({ position, width }: { position: [number, number, number]; width: number }) {
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  // The scene renders on demand; ask for ~15 frames a second for the flicker.
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const timer = window.setInterval(() => invalidate(), 66);
    return () => window.clearInterval(timer);
  }, [invalidate]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const flicker = 0.82 + Math.sin(t * 9.1) * 0.08 + Math.sin(t * 23.7) * 0.06 + Math.sin(t * 3.3) * 0.05;
    if (material.current) material.current.emissiveIntensity = 2.6 * flicker;
    if (light.current) light.current.intensity = 2.6 * flicker;
  });
  return (
    <group position={position}>
      <mesh raycast={noRaycast}>
        <boxGeometry args={[width, 0.16, 0.06]} />
        <meshStandardMaterial ref={material} color="#ffb05a" emissive="#ff8a2a" emissiveIntensity={2.6} />
      </mesh>
      <pointLight ref={light} position={[0, 0.15, 0]} intensity={2.6} distance={4.5} decay={2} color="#ff9a4a" />
    </group>
  );
}
