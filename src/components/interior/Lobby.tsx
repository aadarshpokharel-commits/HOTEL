import { RoundedBox, Text } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { ArchBuilder } from "../../three/ArchBuilder";
import { useAbstractArt } from "../../three/artwork";
import { Model } from "../../three/assets";
import { PBRMaterial } from "../../three/pbr";
import { pillowGeometry } from "../../three/softGeometry";
import { Surface } from "../../three/Surface";
import { BedsideLamp } from "./Bedroom";

// Ground-floor reception and lobby, at real dimensions (metres). The room is
// 12.1 × 8.9 m inside, open to the south (camera side):
//   north   — curved travertine reception desk with a fluted front, marble top
//             and brass plinth, before a fluted walnut feature wall with
//             backlit lettering; globe pendants over the desk
//   centre  — lounge on a wool rug: sofa, two leather lounge chairs, ottomans,
//             travertine coffee table, brass ring chandelier above
//   west    — travertine-clad wall: walnut console, artwork, brass sconces
//   east    — a pair of window chairs with a side table and lamp
//   entry   — brass luggage trolley
// Floor: large-format travertine tiles with fine joints.
// Downloaded CC0 models: lounge chairs, ottomans, walnut console, pendants,
// plants, vases. Everything else is modelled here.

const noRaycast = () => undefined;

// Reception desk: a gentle convex arc whose centre of curvature sits behind.
const DESK = { radius: 4.0, cz: -5.35, halfSpan: 1.8, depth: 0.75, height: 1.08 };
export const DESK_FRONT_Z = DESK.cz + DESK.radius; // −1.35
const DESK_ANGLE = Math.asin(DESK.halfSpan / DESK.radius);

/** A ring-sector slab (plan arc) extruded upward from y0 by height. */
function arcBand(rInner: number, rOuter: number, a0: number, a1: number, y0: number, height: number, bevel = 0.006) {
  const shape = new THREE.Shape();
  const segments = 56;
  // Shape y maps to −z after rotateX(−π/2), so store −z.
  for (let i = 0; i <= segments; i += 1) {
    const a = a0 + ((a1 - a0) * i) / segments;
    const x = Math.sin(a) * rOuter;
    const z = DESK.cz + Math.cos(a) * rOuter;
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  }
  for (let i = segments; i >= 0; i -= 1) {
    const a = a0 + ((a1 - a0) * i) / segments;
    shape.lineTo(Math.sin(a) * rInner, -(DESK.cz + Math.cos(a) * rInner));
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y0, 0);
  return geometry;
}

type LobbyPart = "travertine" | "travertinePolished" | "joint" | "walnut" | "brass" | "glow";

function PartMaterial({ part }: { part: LobbyPart }) {
  switch (part) {
    case "travertine":
      return <Surface kind="travertine" color="#e0d3bd" roughness={0.62} />;
    case "travertinePolished":
      return <Surface kind="travertine" color="#e6dbc8" roughness={0.32} />;
    case "joint":
      return <meshStandardMaterial color="#8a7d6c" roughness={0.9} />;
    case "walnut":
      return <PBRMaterial set="walnut" color="#c9ae90" roughness={0.85} />;
    case "brass":
      return <Surface kind="brass" color="#c9a36a" roughness={0.28} metalness={0.92} />;
    case "glow":
      return <meshStandardMaterial color="#fff0d6" emissive="#ffc27a" emissiveIntensity={2.2} />;
  }
}

function Merged({ build, shadows = true }: { build: () => Map<string, THREE.BufferGeometry>; shadows?: boolean }) {
  const parts = useMemo(build, [build]);
  useEffect(() => () => parts.forEach((geometry) => geometry.dispose()), [parts]);
  return (
    <>
      {[...parts].map(([key, geometry]) => (
        <mesh
          key={key}
          geometry={geometry}
          castShadow={shadows && key !== "glow" && key !== "joint"}
          receiveShadow
          raycast={noRaycast}
        >
          <PartMaterial part={key as LobbyPart} />
        </mesh>
      ))}
    </>
  );
}

// --------------------------------------------------------------------------
// Static architecture: floor tiles, clad west wall, reception feature wall.

function buildArchitecture() {
  const b = new ArchBuilder();
  const x0 = -6.04;
  const x1 = 6.04;
  const z0 = -4.36;
  const z1 = 4.55;
  // Large-format travertine floor, 1.2 m tiles with 3 mm joints.
  b.box("travertinePolished", [x1 - x0, 0.014, z1 - z0], [(x0 + x1) / 2, 0.007, (z0 + z1) / 2]);
  for (let x = x0 + 1.2; x < x1; x += 1.2) b.box("joint", [0.004, 0.002, z1 - z0], [x, 0.0145, (z0 + z1) / 2]);
  for (let z = z0 + 1.2; z < z1; z += 1.2) b.box("joint", [x1 - x0, 0.002, 0.004], [0, 0.0145, z]);

  // West wall clad in travertine slabs (1.2 × 0.78 m) with a walnut base.
  const wallX = -6.03;
  b.box("travertine", [0.03, 2.2, z1 - z0], [wallX + 0.015, 1.25, (z0 + z1) / 2]);
  for (let z = z0 + 1.2; z < z1; z += 1.2) b.box("joint", [0.034, 2.2, 0.004], [wallX + 0.015, 1.25, z]);
  for (const y of [0.93, 1.71]) b.box("joint", [0.034, 0.004, z1 - z0], [wallX + 0.015, y, (z0 + z1) / 2]);
  b.box("walnut", [0.04, 0.15, z1 - z0], [wallX + 0.02, 0.075, (z0 + z1) / 2], { bevel: 0.004 });

  // Reception feature wall: fluted walnut on a dark field, brass frame and
  // concealed warm cove lighting top and bottom.
  const fw = 4.6;
  const fz = -3.78;
  b.box("walnut", [fw, 2.95, 0.1], [0, 1.475, fz], { bevel: 0.006 });
  const slats = 34;
  for (let i = 0; i < slats; i += 1) {
    const x = -fw / 2 + 0.12 + ((fw - 0.24) * (i + 0.5)) / slats;
    b.cylinder("walnut", 0.032, 2.55, [x, 1.43, fz + 0.05], { segments: 12 });
  }
  b.box("brass", [fw + 0.04, 0.03, 0.12], [0, 2.965, fz + 0.01]);
  b.box("brass", [fw + 0.04, 0.03, 0.12], [0, 0.135, fz + 0.01]);
  b.box("glow", [fw - 0.3, 0.012, 0.012], [0, 2.92, fz + 0.075]);
  b.box("glow", [fw - 0.3, 0.012, 0.012], [0, 0.17, fz + 0.075]);
  return b.build();
}

export function LobbyArchitecture() {
  return (
    <group>
      <Merged build={buildArchitecture} />
      <Text
        position={[0, 2.18, -3.66]}
        fontSize={0.24}
        letterSpacing={0.42}
        color="#e6c78f"
        outlineWidth={0.004}
        outlineColor="#3a2a1c"
        anchorX="center"
        anchorY="middle"
        raycast={noRaycast}
      >
        AURELIA
      </Text>
      {/* Warm wash on the feature wall from the cove. */}
      <pointLight position={[0, 2.5, -3.1]} intensity={2.4} distance={4.5} decay={2} color="#ffc98c" />
    </group>
  );
}

// --------------------------------------------------------------------------
// Reception desk.

function buildDesk() {
  const b = new ArchBuilder();
  const { radius: R, height } = DESK;
  const a0 = -DESK_ANGLE;
  const a1 = DESK_ANGLE;
  const add = (key: LobbyPart, geometry: THREE.BufferGeometry) => b.add(key, geometry, new THREE.Matrix4());
  // Recessed brass plinth, travertine body, polished top, walnut back counter.
  add("brass", arcBand(R - 0.72, R - 0.06, a0 + 0.01, a1 - 0.01, 0, 0.08, 0.003));
  add("travertine", arcBand(R - DESK.depth, R - 0.02, a0, a1, 0.08, height - 0.08));
  add("travertinePolished", arcBand(R - DESK.depth - 0.05, R + 0.03, a0 - 0.012, a1 + 0.012, height, 0.045));
  add("walnut", arcBand(R - 1.32, R - DESK.depth, a0 + 0.02, a1 - 0.02, 0.74, 0.035, 0.004));
  add("walnut", arcBand(R - 1.3, R - 1.26, a0 + 0.03, a1 - 0.03, 0.08, 0.66, 0.003));
  // Hand-fluted front: half-round reeds following the curve.
  const reeds = 46;
  for (let i = 0; i < reeds; i += 1) {
    const a = a0 + ((a1 - a0) * (i + 0.5)) / reeds;
    const r = R - 0.012;
    b.cylinder("travertine", 0.03, height - 0.16, [Math.sin(a) * r, 0.08 + (height - 0.08) / 2, DESK.cz + Math.cos(a) * r], {
      segments: 12,
    });
  }
  // Brass shadow-line under the top.
  add("brass", arcBand(R - 0.01, R + 0.005, a0, a1, height - 0.035, 0.012, 0));
  return b.build();
}

export function ReceptionDesk() {
  return (
    <group>
      <Merged build={buildDesk} />
      {/* Invisible hit volume so the whole desk responds to selection. */}
      <mesh position={[0, 0.6, -1.85]}>
        <boxGeometry args={[3.8, 1.2, 1.1]} />
        <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
      </mesh>
      {/* Staff side: two slim terminals, desk lamps. */}
      {[-0.85, 0.85].map((x) => (
        <group key={x} position={[x, 0.775, -2.15]} rotation={[0, x > 0 ? -0.2 : 0.2, 0]}>
          <mesh position={[0, 0.2, 0]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.5, 0.3, 0.012]} />
            <meshStandardMaterial color="#111213" roughness={0.3} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0.07, -0.03]} raycast={noRaycast}>
            <boxGeometry args={[0.04, 0.14, 0.04]} />
            <Surface kind="brass" color="#b8925c" roughness={0.3} metalness={0.9} />
          </mesh>
        </group>
      ))}
      <BedsideLamp position={[-1.45, 0.775, -2.35]} scale={0.95} light={false} />
      <BedsideLamp position={[1.45, 0.775, -2.35]} scale={0.95} light={false} />
      {/* A brass service bell on the counter. */}
      <group position={[0.35, DESK.height + 0.045, -1.55]}>
        <mesh position={[0, 0.035, 0]} castShadow raycast={noRaycast}>
          <sphereGeometry args={[0.055, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Surface kind="brass" color="#d4b072" roughness={0.18} metalness={0.95} />
        </mesh>
        <mesh position={[0, 0.012, 0]} raycast={noRaycast}>
          <cylinderGeometry args={[0.065, 0.07, 0.024, 24]} />
          <meshStandardMaterial color="#1b1612" roughness={0.6} />
        </mesh>
      </group>
      {/* Globe pendants over the desk (CC0). */}
      {[-1.1, 0, 1.1].map((x) => (
        <Model key={x} name="pendant" position={[x, 3.3 - 1.172 + 0.3, -1.95]} castShadow={false} />
      ))}
    </group>
  );
}

// --------------------------------------------------------------------------
// Lounge.

export function ModernSofa({
  position,
  rotation = 0,
  width = 2.4,
  fabric = "#d9ccb7",
  cushion = "#e3d7c3",
  accents = ["#8c5a3c", "#55614a"],
}: {
  position: [number, number, number];
  rotation?: number;
  width?: number;
  fabric?: string;
  cushion?: string;
  accents?: [string, string];
}) {
  const pillow = useMemo(() => {
    const g = pillowGeometry(0.5, 0.15, 0.5, 4);
    g.userData.boxUV = true;
    return g;
  }, []);
  const seatW = width - 0.36;
  const seats = 3;
  const cushionW = seatW / seats;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Walnut plinth with brass shadow line, low upholstered body. */}
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[width - 0.1, 0.1, 0.86]} />
        <PBRMaterial set="walnut" color="#6b5443" roughness={0.9} />
      </mesh>
      <RoundedBox args={[width, 0.26, 0.95]} radius={0.04} smoothness={4} position={[0, 0.23, 0]} castShadow receiveShadow>
        <Surface kind="fabric" color={fabric} roughness={0.98} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <RoundedBox key={side} args={[0.18, 0.36, 0.95]} radius={0.06} smoothness={4} position={[side * (width / 2 - 0.09), 0.52, 0]} castShadow>
          <Surface kind="fabric" color={fabric} roughness={0.98} />
        </RoundedBox>
      ))}
      <RoundedBox args={[width, 0.42, 0.2]} radius={0.07} smoothness={4} position={[0, 0.57, -0.38]} castShadow>
        <Surface kind="fabric" color={fabric} roughness={0.98} />
      </RoundedBox>
      {Array.from({ length: seats }, (_, i) => {
        const x = -seatW / 2 + cushionW * (i + 0.5);
        return (
          <group key={i}>
            <RoundedBox args={[cushionW - 0.012, 0.15, 0.7]} radius={0.06} smoothness={5} position={[x, 0.43, 0.08]} castShadow>
              <Surface kind="fabric" color={cushion} roughness={0.98} />
            </RoundedBox>
            <RoundedBox args={[cushionW - 0.02, 0.4, 0.16]} radius={0.08} smoothness={5} position={[x, 0.68, -0.24]} rotation={[-0.14, 0, 0]} castShadow>
              <Surface kind="fabric" color={cushion} roughness={0.98} />
            </RoundedBox>
          </group>
        );
      })}
      {[-1, 1].map((side) => (
        <mesh key={side} geometry={pillow} position={[side * (seatW / 2 - 0.25), 0.66, -0.1]} rotation={[1.2, side * -0.25, 0]} castShadow>
          <Surface kind="fabric" color={side < 0 ? accents[0] : accents[1]} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export function CoffeeTable({ position }: { position: [number, number, number] }) {
  const base = useMemo(() => {
    const profile = [[0, 0], [0.3, 0], [0.31, 0.02], [0.24, 0.06], [0.2, 0.2], [0.22, 0.33], [0.26, 0.37], [0, 0.37]].map(
      ([x, y]) => new THREE.Vector2(x, y),
    );
    const geometry = new THREE.LatheGeometry(profile, 48);
    geometry.userData.boxUV = true;
    return geometry;
  }, []);
  return (
    <group position={position}>
      <mesh geometry={base} castShadow receiveShadow>
        <Surface kind="travertine" color="#d8cbb5" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.62, 0.6, 0.06, 64]} />
        <Surface kind="travertine" color="#e2d6c2" roughness={0.35} />
      </mesh>
      {/* Coffee-table books and a brass bowl. */}
      {[["#2f3a3c", 0.32, 0.24, 0.03], ["#b88a5a", 0.28, 0.21, 0.025], ["#e8e0d2", 0.26, 0.19, 0.02]].map(([color, w, d, h], i) => (
        <mesh key={i} position={[-0.18, 0.43 + 0.028 * i + (h as number) / 2, 0.08]} rotation={[0, 0.3 + i * 0.15, 0]} castShadow>
          <boxGeometry args={[w as number, h as number, d as number]} />
          <Surface kind="satin" color={color as string} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0.2, 0.47, -0.1]} castShadow>
        <sphereGeometry args={[0.13, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export const LOUNGE_CENTER: [number, number, number] = [0, 0, 1.85];

export function LobbyLounge() {
  const [cx, , cz] = LOUNGE_CENTER;
  return (
    <group>
      {/* Wool rug with a darker border. */}
      <RoundedBox args={[4.8, 0.012, 3.6]} radius={0.004} smoothness={2} position={[cx, 0.02, cz]} receiveShadow raycast={noRaycast}>
        <Surface kind="rug" color="#5b4e41" roughness={1} />
      </RoundedBox>
      <RoundedBox args={[4.56, 0.012, 3.36]} radius={0.004} smoothness={2} position={[cx, 0.024, cz]} receiveShadow raycast={noRaycast}>
        <Surface kind="rug" color="#cdbfa9" roughness={1} />
      </RoundedBox>
      <ModernSofa position={[cx, 0.03, cz + 1.15]} rotation={Math.PI} width={2.5} />
      <CoffeeTable position={[cx, 0.03, cz]} />
      <Model name="loungeChair" position={[cx - 0.95, 0.03, cz - 1.0]} rotation={[0, 0.35, 0]} />
      <Model name="loungeChair" position={[cx + 0.95, 0.03, cz - 1.0]} rotation={[0, -0.35, 0]} />
      <Model name="ottoman" position={[cx - 1.9, 0.03, cz + 0.1]} rotation={[0, Math.PI / 2, 0]} />
      <Model name="ottoman" position={[cx + 1.9, 0.03, cz + 0.1]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  );
}

// --------------------------------------------------------------------------
// Chandelier over the lounge: brass ring with frosted globes.

export function LobbyLighting() {
  const [cx, , cz] = LOUNGE_CENTER;
  const globes = 12;
  const ringY = 2.72;
  return (
    <group position={[cx, 0, cz]}>
      {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.95, (3.3 + ringY) / 2, Math.sin(a) * 0.95]} raycast={noRaycast}>
          <cylinderGeometry args={[0.004, 0.004, 3.3 - ringY, 6]} />
          <Surface kind="brass" color="#c9a36a" roughness={0.3} metalness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, ringY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow raycast={noRaycast}>
        <torusGeometry args={[0.95, 0.03, 16, 96]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.25} metalness={0.92} />
      </mesh>
      {Array.from({ length: globes }, (_, i) => {
        const a = (i / globes) * Math.PI * 2;
        const drop = 0.12 + (i % 2) * 0.1;
        return (
          <group key={i} position={[Math.cos(a) * 0.95, ringY, Math.sin(a) * 0.95]}>
            <mesh position={[0, -drop / 2, 0]} raycast={noRaycast}>
              <cylinderGeometry args={[0.005, 0.005, drop, 6]} />
              <Surface kind="brass" color="#c9a36a" roughness={0.3} metalness={0.9} />
            </mesh>
            <mesh position={[0, -drop - 0.085, 0]} raycast={noRaycast}>
              <sphereGeometry args={[0.085, 24, 16]} />
              <meshStandardMaterial color="#fff6e8" emissive="#ffc68a" emissiveIntensity={1.6} roughness={0.4} />
            </mesh>
          </group>
        );
      })}
      <pointLight position={[0, ringY - 0.25, 0]} intensity={4.2} distance={7.5} decay={2} color="#ffcf96" />
    </group>
  );
}

// --------------------------------------------------------------------------
// Artwork on the north walls, each with a brass picture light.

export function LobbyArtwork() {
  const left = useAbstractArt(1, 0.78);
  const right = useAbstractArt(2, 0.78);
  return (
    <group>
      {[
        { x: -4.15, art: left },
        { x: 4.15, art: right },
      ].map(({ x, art }) => (
        <group key={x} position={[x, 1.85, -4.3]}>
          <RoundedBox args={[1.32, 1.68, 0.05]} radius={0.008} smoothness={2} castShadow>
            <PBRMaterial set="walnut" color="#5d4636" roughness={0.8} />
          </RoundedBox>
          <mesh position={[0, 0, 0.027]}>
            <planeGeometry args={[1.2, 1.56]} />
            <meshStandardMaterial color="#f3ecdf" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.028]}>
            <planeGeometry args={[1.0, 1.32]} />
            <meshStandardMaterial map={art} roughness={0.85} />
          </mesh>
          <group position={[0, 0.98, 0.1]}>
            <mesh rotation={[0, 0, Math.PI / 2]} raycast={noRaycast}>
              <cylinderGeometry args={[0.028, 0.028, 0.5, 20]} />
              <Surface kind="brass" color="#c9a36a" roughness={0.25} metalness={0.92} />
            </mesh>
            {/* Warm glowing slot on the underside of the picture light. */}
            <mesh position={[0, -0.029, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
              <planeGeometry args={[0.46, 0.02]} />
              <meshStandardMaterial color="#fff1d6" emissive="#ffc27a" emissiveIntensity={2.5} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, -0.03, -0.06]} rotation={[0.6, 0, 0]} raycast={noRaycast}>
              <cylinderGeometry args={[0.008, 0.008, 0.12, 8]} />
              <Surface kind="brass" color="#c9a36a" roughness={0.25} metalness={0.92} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

// --------------------------------------------------------------------------
// Supporting pieces: west console wall, window chairs, plants, trolley.

function Sconce({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0, 0.01]} raycast={noRaycast}>
        <boxGeometry args={[0.09, 0.3, 0.02]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.28} metalness={0.92} />
      </mesh>
      <mesh position={[0, 0.04, 0.09]} raycast={noRaycast}>
        <cylinderGeometry args={[0.055, 0.055, 0.2, 24, 1, true]} />
        <meshStandardMaterial color="#fff4e2" emissive="#ffc483" emissiveIntensity={1.3} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.06, 0.05]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[0.01, 0.01, 0.08, 8]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.28} metalness={0.92} />
      </mesh>
    </group>
  );
}

function LuggageTrolley({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const brass = <Surface kind="brass" color="#d1ad70" roughness={0.2} metalness={0.95} />;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[1.05, 0.06, 0.6]} radius={0.015} smoothness={2} position={[0, 0.2, 0]} castShadow receiveShadow raycast={noRaycast}>
        <Surface kind="rug" color="#5a2a2a" roughness={1} />
      </RoundedBox>
      <mesh position={[0, 0.17, 0]} raycast={noRaycast}>
        <boxGeometry args={[1.08, 0.025, 0.62]} />
        {brass}
      </mesh>
      {/* Arched uprights and hanging rail. */}
      {[-0.5, 0.5].map((x) => (
        <group key={x}>
          {[-0.26, 0.26].map((z) => (
            <mesh key={z} position={[x, 1.0, z]} castShadow raycast={noRaycast}>
              <cylinderGeometry args={[0.016, 0.016, 1.6, 12]} />
              {brass}
            </mesh>
          ))}
          <mesh position={[x, 1.8, 0]} rotation={[0, Math.PI / 2, 0]} castShadow raycast={noRaycast}>
            <torusGeometry args={[0.26, 0.016, 10, 32, Math.PI]} />
            {brass}
          </mesh>
        </group>
      ))}
      <mesh position={[0, 2.06, 0]} rotation={[0, 0, Math.PI / 2]} castShadow raycast={noRaycast}>
        <cylinderGeometry args={[0.016, 0.016, 1.0, 12]} />
        {brass}
      </mesh>
      <mesh position={[0, 1.7, 0]} rotation={[0, 0, Math.PI / 2]} raycast={noRaycast}>
        <cylinderGeometry args={[0.011, 0.011, 1.0, 10]} />
        {brass}
      </mesh>
      {[[-0.45, -0.24], [0.45, -0.24], [-0.45, 0.24], [0.45, 0.24]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.06, z]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <cylinderGeometry args={[0.06, 0.06, 0.035, 20]} />
          <meshStandardMaterial color="#222" roughness={0.7} />
        </mesh>
      ))}
      {/* A guest's suitcase and garment bag. */}
      <RoundedBox args={[0.7, 0.42, 0.26]} radius={0.03} smoothness={3} position={[-0.1, 0.44, 0]} castShadow raycast={noRaycast}>
        <Surface kind="satin" color="#5b3b28" roughness={0.55} />
      </RoundedBox>
      <RoundedBox args={[0.5, 0.85, 0.06]} radius={0.025} smoothness={3} position={[0.15, 1.24, 0.02]} rotation={[0, 0, 0.03]} castShadow raycast={noRaycast}>
        <Surface kind="linen" color="#2e3436" roughness={0.9} />
      </RoundedBox>
    </group>
  );
}

export function LobbyDecor() {
  return (
    <group>
      {/* West wall: walnut console (CC0), vases, lamp, painting, sconces. */}
      <Model name="mediaCabinet" position={[-5.75, 0.014, 0.55]} rotation={[0, Math.PI / 2, 0]} />
      <Model name="vaseTall" position={[-5.72, 0.694, -0.3]} castShadow={false} />
      <Model name="vaseRound" position={[-5.72, 0.694, 1.35]} scale={0.85} castShadow={false} />
      <BedsideLamp position={[-5.72, 0.694, 0.55]} />
      <group position={[-5.985, 1.6, 0.55]} rotation={[0, Math.PI / 2, 0]}>
        <ArtPanel variant={0} width={1.5} height={0.75} />
      </group>
      <Sconce position={[-5.99, 1.65, -0.85]} />
      <Sconce position={[-5.99, 1.65, 1.95]} />

      {/* East window seating: two lounge chairs, side table and lamp. */}
      <Model name="loungeChair" position={[4.05, 0.014, 0.15]} rotation={[0, -0.9, 0]} />
      <Model name="loungeChair" position={[4.05, 0.014, 1.75]} rotation={[0, -2.25, 0]} />
      <group position={[4.65, 0.014, 0.95]}>
        <mesh position={[0, 0.27, 0]} castShadow raycast={noRaycast}>
          <cylinderGeometry args={[0.28, 0.24, 0.54, 40]} />
          <Surface kind="travertine" color="#d8cbb5" roughness={0.45} />
        </mesh>
        <BedsideLamp position={[0, 0.54, 0]} scale={0.9} light={false} />
      </group>

      {/* Plants flanking the reception wall and in the corners (CC0). */}
      <Model name="plant" position={[-2.75, 0.014, -3.55]} rotation={[0, 0.4, 0]} scale={1.25} />
      <Model name="plant" position={[2.75, 0.014, -3.55]} rotation={[0, 2.1, 0]} scale={1.25} />
      <Model name="plant" position={[5.45, 0.014, 3.7]} rotation={[0, 1.2, 0]} scale={1.15} />
      <Model name="plant" position={[-5.5, 0.014, -3.8]} rotation={[0, 2.6, 0]} scale={1.15} />

      <LuggageTrolley position={[5.0, 0.014, 3.35]} rotation={-0.5} />
    </group>
  );
}

function ArtPanel({ variant, width, height }: { variant: number; width: number; height: number }) {
  const art = useAbstractArt(variant, width / height);
  return (
    <group>
      <RoundedBox args={[width + 0.1, height + 0.1, 0.04]} radius={0.006} smoothness={2} castShadow raycast={noRaycast}>
        <PBRMaterial set="walnut" color="#5d4636" roughness={0.8} />
      </RoundedBox>
      <mesh position={[0, 0, 0.021]} raycast={noRaycast}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={art} roughness={0.85} />
      </mesh>
    </group>
  );
}
