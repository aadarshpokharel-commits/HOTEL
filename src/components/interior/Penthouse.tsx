import { RoundedBox } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { Model } from "../../three/assets";
import { PBRMaterial } from "../../three/pbr";
import { pillowGeometry } from "../../three/softGeometry";
import { Surface } from "../../three/Surface";
import { PLATE, TERRACE, WC, Flame } from "./Apartment";
import { CoffeeTable } from "./Lobby";

// The penthouse: one generous open plan in a warmer, more natural palette —
// lime-washed walls, travertine floors, oatmeal bouclé, walnut and greenery.
//   centre  — a freestanding double-sided travertine fireplace, with a curved
//             bouclé sofa wrapping around it (the "panoramic lounge")
//   north   — round travertine dining table by the window (see Apartment)
//   SW      — chef's kitchen: tall walnut cabinetry, marble waterfall island
//   SE      — glazed private terrace with a raised plunge pool, teak
//             loungers and an olive tree
// Bedroom and bathroom are shared with the residences.

const noRaycast = () => undefined;
export const FIREPLACE: [number, number, number] = [0.52, 0, -0.75];
export const PENTHOUSE_LIVING: [number, number, number] = [0.52, 0, 0.9];
export const TERRACE_CENTER: [number, number, number] = [4.55, 0, 2.7];

/** Ring sector around a local centre; angles from +z toward +x. */
function ringSector(r0: number, r1: number, a0: number, a1: number, y0: number, height: number, bevel = 0.03) {
  const shape = new THREE.Shape();
  const n = 48;
  for (let i = 0; i <= n; i += 1) {
    const a = a0 + ((a1 - a0) * i) / n;
    const p: [number, number] = [Math.sin(a) * r1, -Math.cos(a) * r1];
    if (i === 0) shape.moveTo(...p);
    else shape.lineTo(...p);
  }
  for (let i = n; i >= 0; i -= 1) {
    const a = a0 + ((a1 - a0) * i) / n;
    shape.lineTo(Math.sin(a) * r0, -Math.cos(a) * r0);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, height - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 12,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y0 + bevel, 0);
  geometry.userData.boxUV = true;
  return geometry;
}

function CurvedSofa({ center }: { center: [number, number, number] }) {
  const span = 0.6;
  const parts = useMemo(() => {
    const seatCount = 4;
    const gap = 0.012;
    const seats = Array.from({ length: seatCount }, (_, i) => {
      const a0 = -span + ((2 * span) / seatCount) * i + gap;
      const a1 = -span + ((2 * span) / seatCount) * (i + 1) - gap;
      return ringSector(2.36, 2.98, a0, a1, 0.36, 0.16, 0.05);
    });
    return {
      plinth: ringSector(2.45, 3.08, -span + 0.01, span - 0.01, 0, 0.1, 0.01),
      base: ringSector(2.34, 3.12, -span, span, 0.1, 0.27, 0.04),
      back: ringSector(2.95, 3.2, -span - 0.02, span + 0.02, 0.1, 0.72, 0.06),
      seats,
    };
  }, []);
  const pillow = useMemo(() => {
    const g = pillowGeometry(0.5, 0.15, 0.5, 8);
    g.userData.boxUV = true;
    return g;
  }, []);
  const fabric = "#e7ddcc";
  return (
    <group position={center}>
      <mesh geometry={parts.plinth} castShadow receiveShadow>
        <PBRMaterial set="walnut" color="#7a5f49" roughness={0.85} />
      </mesh>
      <mesh geometry={parts.base} castShadow receiveShadow>
        <Surface kind="fabric" color={fabric} roughness={0.98} />
      </mesh>
      <mesh geometry={parts.back} castShadow receiveShadow>
        <Surface kind="fabric" color={fabric} roughness={0.98} />
      </mesh>
      {parts.seats.map((geometry, i) => (
        <mesh key={i} geometry={geometry} castShadow receiveShadow>
          <Surface kind="fabric" color="#efe7d9" roughness={0.98} />
        </mesh>
      ))}
      {[-0.42, -0.14, 0.2, 0.45].map((a, i) => (
        // Outer group faces the cushion outward (toward the backrest); the
        // inner tilt leans it back against the back cushion.
        <group key={a} position={[Math.sin(a) * 2.8, 0.66, Math.cos(a) * 2.8]} rotation={[0, a, 0]}>
          <mesh geometry={pillow} rotation={[1.1, 0, 0]} castShadow>
            <Surface kind="fabric" color={["#b98d63", "#8a9478", "#d9c7a8", "#b98d63"][i]} roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* A soft throw folded over the backrest. */}
      <RoundedBox args={[0.7, 0.04, 0.5]} radius={0.015} smoothness={3} position={[Math.sin(0.3) * 2.9, 0.82, Math.cos(0.3) * 2.9]} rotation={[0.4, 0.3 + Math.PI, 0]} castShadow>
        <PBRMaterial set="wool" color="#b39a7c" roughness={1} />
      </RoundedBox>
    </group>
  );
}

function FireplaceIsland() {
  const [x, , z] = FIREPLACE;
  return (
    <group position={[x, 0.012, z]}>
      <RoundedBox args={[1.95, 0.12, 0.6]} radius={0.01} smoothness={2} position={[0, 0.06, 0]} castShadow receiveShadow>
        <Surface kind="travertine" color="#d8cbb4" roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[1.8, 0.95, 0.44]} radius={0.012} smoothness={2} position={[0, 0.595, 0]} castShadow receiveShadow>
        <Surface kind="travertine" color="#e0d3bd" roughness={0.55} />
      </RoundedBox>
      {/* Blackened-steel firebox running through, visible from both sides. */}
      <mesh position={[0, 0.48, 0]} raycast={noRaycast}>
        <boxGeometry args={[1.26, 0.32, 0.455]} />
        <meshStandardMaterial color="#141210" roughness={0.75} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.355, 0]} raycast={noRaycast}>
        <boxGeometry args={[1.12, 0.05, 0.46]} />
        <meshStandardMaterial color="#3a332c" roughness={1} />
      </mesh>
      <Flame position={[0, 0.44, 0]} width={1.05} />
      <RoundedBox args={[1.92, 0.045, 0.52]} radius={0.008} smoothness={2} position={[0, 1.09, 0]} castShadow receiveShadow>
        <Surface kind="travertine" color="#e6dbc7" roughness={0.3} />
      </RoundedBox>
      <Model name="vaseTall" position={[-0.6, 1.115, 0.02]} castShadow={false} />
      <Model name="vaseRound" position={[0.55, 1.115, -0.04]} scale={0.8} castShadow={false} />
    </group>
  );
}

export function PenthouseLiving() {
  const [cx, , cz] = PENTHOUSE_LIVING;
  return (
    <group>
      <mesh position={[cx, 0.018, cz]} receiveShadow raycast={noRaycast}>
        <cylinderGeometry args={[1.95, 1.95, 0.012, 96]} />
        <Surface kind="rug" color="#d9cdb9" roughness={1} />
      </mesh>
      <mesh position={[cx, 0.021, cz]} receiveShadow raycast={noRaycast}>
        <torusGeometry args={[1.82, 0.03, 4, 96]} />
        <Surface kind="rug" color="#a88d6e" roughness={1} />
      </mesh>
      <FireplaceIsland />
      <CurvedSofa center={FIREPLACE} />
      <CoffeeTable position={[cx, 0.03, cz - 0.35]} />
      {/* West of the fireplace there is no room for a lounge chair between
          the bedroom partition and the coffee table, so a tall plant fills
          the corner instead. */}
      <Model name="plant" position={[-0.55, 0.012, 0.3]} scale={1.15} rotation={[0, 0.7, 0]} />
      <Model name="loungeChair" position={[2.05, 0.03, 0.15]} rotation={[0, -Math.PI / 2 + 0.35, 0]} />
      <Model name="plant" position={[-0.95, 0.012, 3.85]} scale={1.3} rotation={[0, 1, 0]} />
      <Model name="plant" position={[2.6, 0.012, 3.9]} scale={1.2} rotation={[0, 2.4, 0]} />
      <Model name="pendant" position={[cx - 0.7, 3.3 - 1.172 + 0.25, cz + 0.2]} castShadow={false} />
      <Model name="pendant" position={[cx + 0.7, 3.3 - 1.172 + 0.05, cz + 0.4]} castShadow={false} />
    </group>
  );
}

function BarStool({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {[[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.33, z]} rotation={[-z * 0.25, 0, x * 0.25]} castShadow raycast={noRaycast}>
          <cylinderGeometry args={[0.014, 0.012, 0.68, 10]} />
          <PBRMaterial set="walnut" color="#8f735a" roughness={0.8} />
        </mesh>
      ))}
      <RoundedBox args={[0.42, 0.07, 0.4]} radius={0.03} smoothness={4} position={[0, 0.68, 0]} castShadow>
        <Surface kind="fabric" color="#d6c9b4" roughness={0.98} />
      </RoundedBox>
      <RoundedBox args={[0.4, 0.18, 0.05]} radius={0.022} smoothness={3} position={[0, 0.82, -0.18]} castShadow>
        <Surface kind="fabric" color="#d6c9b4" roughness={0.98} />
      </RoundedBox>
    </group>
  );
}

export function PenthouseKitchen() {
  const runX = PLATE.x0 + 0.3;
  const doorReveal = <meshStandardMaterial color="#1a120c" />;
  return (
    <group>
      {/* Tall walnut run: fridge, pantry, lit coffee niche, oven. */}
      <group position={[runX, 0.012, 1.75]}>
        <RoundedBox args={[0.6, 2.3, 2.4]} radius={0.008} smoothness={2} position={[0, 1.15, 0]} castShadow receiveShadow>
          <PBRMaterial set="walnut" color="#c9ae90" roughness={0.85} />
        </RoundedBox>
        {[-0.6, 0, 0.6].map((z) => (
          <mesh key={z} position={[0.301, 1.15, z]} raycast={noRaycast}>
            <boxGeometry args={[0.004, 2.24, 0.004]} />
            {doorReveal}
          </mesh>
        ))}
        <mesh position={[0.302, 1.15, 0.6]} rotation={[0, Math.PI / 2, 0]} raycast={noRaycast}>
          <planeGeometry args={[0.56, 0.56]} />
          <meshPhysicalMaterial color="#0b0c0d" roughness={0.05} metalness={0.3} clearcoat={1} />
        </mesh>
        <mesh position={[0.24, 1.25, 0.0]} rotation={[0, Math.PI / 2, 0]} raycast={noRaycast}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshStandardMaterial color="#fff0d6" emissive="#ffc27a" emissiveIntensity={1.2} />
        </mesh>
        <RoundedBox args={[0.3, 0.3, 0.26]} radius={0.02} smoothness={3} position={[0.12, 1.15, 0.0]} castShadow raycast={noRaycast}>
          <meshStandardMaterial color="#c9cacb" roughness={0.25} metalness={0.9} />
        </RoundedBox>
        {[-0.95, -0.35, 0.95].map((z) => (
          <mesh key={z} position={[0.315, 1.15, z]} raycast={noRaycast}>
            <cylinderGeometry args={[0.007, 0.007, 0.6, 10]} />
            <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
          </mesh>
        ))}
      </group>

      {/* Marble waterfall island with hob and prep sink. */}
      <group position={[-3.7, 0.012, 2.3]}>
        <mesh position={[0, 0.05, 0]} raycast={noRaycast}>
          <boxGeometry args={[0.75, 0.1, 2.4]} />
          <meshStandardMaterial color="#17110c" roughness={0.9} />
        </mesh>
        <RoundedBox args={[0.9, 0.76, 2.5]} radius={0.008} smoothness={2} position={[0, 0.48, 0]} castShadow receiveShadow>
          <PBRMaterial set="walnut" color="#a88a6c" roughness={0.85} />
        </RoundedBox>
        <RoundedBox args={[1.06, 0.05, 2.7]} radius={0.006} smoothness={2} position={[0, 0.885, 0]} castShadow receiveShadow>
          <Surface kind="marble" color="#f1ece3" roughness={0.16} />
        </RoundedBox>
        {[-1.325, 1.325].map((z) => (
          <RoundedBox key={z} args={[1.06, 0.88, 0.05]} radius={0.006} smoothness={2} position={[0, 0.44, z]} castShadow receiveShadow>
            <Surface kind="marble" color="#f1ece3" roughness={0.16} />
          </RoundedBox>
        ))}
        <mesh position={[-0.1, 0.912, -0.6]} raycast={noRaycast}>
          <boxGeometry args={[0.52, 0.004, 0.6]} />
          <meshPhysicalMaterial color="#0b0c0d" roughness={0.05} clearcoat={1} />
        </mesh>
        <mesh position={[-0.1, 0.912, 0.65]} raycast={noRaycast}>
          <boxGeometry args={[0.4, 0.004, 0.36]} />
          <meshStandardMaterial color="#2a2c2d" roughness={0.3} metalness={0.6} />
        </mesh>
        <group position={[-0.38, 0.91, 0.65]}>
          <mesh position={[0, 0.17, 0]} raycast={noRaycast}>
            <cylinderGeometry args={[0.013, 0.016, 0.34, 12]} />
            <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
          </mesh>
          <mesh position={[0.08, 0.34, 0]} rotation={[Math.PI / 2, 0, -Math.PI / 2]} raycast={noRaycast}>
            <torusGeometry args={[0.08, 0.012, 8, 24, Math.PI]} />
            <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
          </mesh>
        </group>
        <Model name="vaseRound" position={[0.25, 0.91, 0.1]} scale={0.75} castShadow={false} />
      </group>
      {[1.6, 2.3, 3.0].map((z) => (
        <BarStool key={z} position={[-2.85, 0.012, z]} rotation={-Math.PI / 2} />
      ))}
      {[1.75, 2.85].map((z) => (
        <Model key={z} name="pendant" position={[-3.7, 3.3 - 1.172 + 0.35, z]} castShadow={false} />
      ))}
      <pointLight position={[-3.7, 2.0, 2.3]} intensity={2.6} distance={4.5} decay={2} color="#ffcf96" />
      {/* Front door. */}
      <group position={[PLATE.x0 + 0.02, 0, 3.95]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 1.12, 0]} castShadow raycast={noRaycast}>
          <boxGeometry args={[1.14, 2.24, 0.05]} />
          <PBRMaterial set="walnut" color="#5d4636" roughness={0.8} />
        </mesh>
        <mesh position={[0.36, 1.05, 0.04]} raycast={noRaycast}>
          <boxGeometry args={[0.02, 0.5, 0.02]} />
          <Surface kind="brass" color="#c9a36a" roughness={0.22} metalness={0.95} />
        </mesh>
      </group>
      <Model name="plant" position={[-4.9, 0.012, 4.2]} rotation={[0, 0.3, 0]} />
    </group>
  );
}

/** Glazed sliding wall between the living space and the terrace. */
export function TerraceGlazing() {
  const x = TERRACE.x0;
  const z = TERRACE.z0;
  const h = 2.6;
  const runs: { from: [number, number]; to: [number, number] }[] = [
    { from: [x, z], to: [x, PLATE.z1] },
    { from: [x, z], to: [WC.x0, z] },
  ];
  return (
    <group>
      {runs.map(({ from, to }, r) => {
        const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
        const angle = Math.atan2(-(to[1] - from[1]), to[0] - from[0]);
        const panels = Math.max(1, Math.round(length / 0.95));
        return (
          <group key={r} position={[(from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2]} rotation={[0, angle, 0]}>
            <mesh position={[0, h / 2, 0]} raycast={noRaycast}>
              <boxGeometry args={[length, h, 0.012]} />
              <meshPhysicalMaterial color="#dfe8e6" roughness={0.03} metalness={0.05} transparent opacity={0.12} envMapIntensity={1.6} depthWrite={false} />
            </mesh>
            {[0.015, h].map((y) => (
              <mesh key={y} position={[0, y, 0]} castShadow raycast={noRaycast}>
                <boxGeometry args={[length, 0.04, 0.06]} />
                <Surface kind="brass" color="#4e3e2e" roughness={0.42} metalness={0.8} />
              </mesh>
            ))}
            {Array.from({ length: panels + 1 }, (_, i) => (
              <mesh key={i} position={[-length / 2 + (length / panels) * i, h / 2, 0]} castShadow raycast={noRaycast}>
                <boxGeometry args={[0.035, h, 0.06]} />
                <Surface kind="brass" color="#4e3e2e" roughness={0.42} metalness={0.8} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function OliveTree({ position }: { position: [number, number, number] }) {
  const crowns = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const a = i * 2.39996;
        const r = 0.12 + (i % 5) * 0.07;
        return { p: [Math.cos(a) * r, 1.55 + ((i * 37) % 11) * 0.03, Math.sin(a) * r] as [number, number, number], s: 0.16 + (i % 4) * 0.035 };
      }),
    [],
  );
  return (
    <group position={position}>
      <RoundedBox args={[0.75, 0.6, 0.75]} radius={0.02} smoothness={2} position={[0, 0.3, 0]} castShadow receiveShadow>
        <Surface kind="travertine" color="#d8cbb4" roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0.6, 0]} raycast={noRaycast}>
        <boxGeometry args={[0.68, 0.01, 0.68]} />
        <meshStandardMaterial color="#3e3326" roughness={1} />
      </mesh>
      {/* A gnarled, twisting trunk. */}
      {[[0, 0.6, 0, 0.06, 0.95, 0.04], [0.06, 0.95, 0.04, -0.05, 1.3, 0.1], [-0.05, 1.3, 0.1, 0.08, 1.55, -0.05], [0.06, 0.95, 0.04, 0.25, 1.4, -0.1]].map(
        ([x0, y0, z0, x1, y1, z1], i) => {
          const a = new THREE.Vector3(x0, y0, z0);
          const b = new THREE.Vector3(x1, y1, z1);
          const mid = a.clone().add(b).multiplyScalar(0.5);
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
          return (
            <mesh key={i} position={mid} quaternion={q} castShadow raycast={noRaycast}>
              <cylinderGeometry args={[0.035 - i * 0.004, 0.05 - i * 0.005, a.distanceTo(b), 10]} />
              <Surface kind="walnut" color="#6b5a49" roughness={0.95} />
            </mesh>
          );
        },
      )}
      {crowns.map(({ p, s }, i) => (
        <mesh key={i} position={p} scale={[1.25, 0.7, 1.1]} castShadow raycast={noRaycast}>
          <sphereGeometry args={[s, 12, 10]} />
          <Surface kind="foliage" color={i % 3 ? "#8b9a76" : "#6f7d5f"} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function SunLounger({ position }: { position: [number, number, number] }) {
  const teak = <Surface kind="oak" color="#9a7656" roughness={0.7} />;
  return (
    <group position={position}>
      {[[-0.28, -0.85], [0.28, -0.85], [-0.28, 0.85], [0.28, 0.85]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.13, z]} castShadow>
          <boxGeometry args={[0.05, 0.26, 0.05]} />
          {teak}
        </mesh>
      ))}
      <RoundedBox args={[0.65, 0.05, 1.85]} radius={0.01} smoothness={2} position={[0, 0.27, 0]} castShadow receiveShadow>
        {teak}
      </RoundedBox>
      <RoundedBox args={[0.6, 0.08, 1.2]} radius={0.035} smoothness={4} position={[0, 0.34, 0.3]} castShadow>
        <Surface kind="fabric" color="#efe9de" roughness={0.98} />
      </RoundedBox>
      <RoundedBox args={[0.6, 0.08, 0.66]} radius={0.035} smoothness={4} position={[0, 0.52, -0.58]} rotation={[0.75, 0, 0]} castShadow>
        <Surface kind="fabric" color="#efe9de" roughness={0.98} />
      </RoundedBox>
      <RoundedBox args={[0.5, 0.05, 0.3]} radius={0.02} smoothness={3} position={[0, 0.41, 0.75]} castShadow>
        <Surface kind="fabric" color="#c4a27c" roughness={1} />
      </RoundedBox>
    </group>
  );
}

function PlungePool() {
  const x0 = 4.72;
  const x1 = 5.92;
  const z0 = 1.2;
  const z1 = 4.25;
  const h = 0.5;
  const w = 0.12;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const stone = <Surface kind="travertine" color="#dfd2bc" roughness={0.55} />;
  return (
    <group>
      {[
        [cx, z0 + w / 2, x1 - x0, w],
        [cx, z1 - w / 2, x1 - x0, w],
      ].map(([x, z, lx, lz]) => (
        <mesh key={`a${z}`} position={[x, h / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[lx, h, lz]} />
          {stone}
        </mesh>
      ))}
      {[
        [x0 + w / 2, cz],
        [x1 - w / 2, cz],
      ].map(([x, z]) => (
        <mesh key={`b${x}`} position={[x, h / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[w, h, z1 - z0 - 2 * w]} />
          {stone}
        </mesh>
      ))}
      {/* Coping, tiled interior and water. */}
      {/* Coping: a travertine frame around the water, slightly overhanging. */}
      {[
        { p: [cx, z0 + w / 2], s: [x1 - x0 + 0.08, w + 0.08] },
        { p: [cx, z1 - w / 2], s: [x1 - x0 + 0.08, w + 0.08] },
        { p: [x0 + w / 2, cz], s: [w + 0.08, z1 - z0 - 2 * w] },
        { p: [x1 - w / 2, cz], s: [w + 0.08, z1 - z0 - 2 * w] },
      ].map(({ p, s }, i) => (
        <RoundedBox key={i} args={[s[0], 0.04, s[1]]} radius={0.01} smoothness={2} position={[p[0], h + 0.02, p[1]]} castShadow receiveShadow>
          <Surface kind="travertine" color="#e8ddca" roughness={0.4} />
        </RoundedBox>
      ))}
      <mesh position={[cx, 0.03, cz]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <planeGeometry args={[x1 - x0 - 2 * w, z1 - z0 - 2 * w]} />
        <meshStandardMaterial color="#6fa9a3" roughness={0.4} />
      </mesh>
      <mesh position={[cx, h - 0.06, cz]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <planeGeometry args={[x1 - x0 - 2 * w, z1 - z0 - 2 * w]} />
        <meshPhysicalMaterial color="#5fa6a3" roughness={0.04} metalness={0.05} transparent opacity={0.72} envMapIntensity={1.8} clearcoat={1} clearcoatRoughness={0.04} />
      </mesh>
      <mesh position={[x1 - w - 0.002, 0.25, cz]} rotation={[0, -Math.PI / 2, 0]} raycast={noRaycast}>
        <planeGeometry args={[0.6, 0.05]} />
        <meshStandardMaterial color="#d6fff7" emissive="#8ff0e4" emissiveIntensity={1.5} />
      </mesh>
    </group>
  );
}

export function PenthouseTerrace() {
  const [tx, , tz] = TERRACE_CENTER;
  return (
    <group>
      {/* Invisible hit volume so the whole terrace responds to selection. */}
      <mesh position={[tx, 0.6, tz]}>
        <boxGeometry args={[PLATE.x1 - TERRACE.x0, 1.2, PLATE.z1 - TERRACE.z0]} />
        <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
      </mesh>
      <PlungePool />
      <SunLounger position={[3.55, 0.012, 2.75]} />
      <SunLounger position={[4.28, 0.012, 2.75]} />
      <OliveTree position={[3.75, 0.012, 4.1]} />
      <Model name="plant" position={[5.55, 0.012, 0.95 + 0.05]} scale={0.8} />
      {/* Glass balustrade along the terrace edges. */}
      {[
        { p: [PLATE.x1 - 0.02, 0.5, (TERRACE.z0 + PLATE.z1) / 2], s: [0.012, 1.0, PLATE.z1 - TERRACE.z0] },
        { p: [(TERRACE.x0 + PLATE.x1) / 2, 0.5, PLATE.z1 - 0.02], s: [PLATE.x1 - TERRACE.x0, 1.0, 0.012] },
      ].map(({ p, s }, i) => (
        <group key={i}>
          <mesh position={p as [number, number, number]} raycast={noRaycast}>
            <boxGeometry args={s as [number, number, number]} />
            <meshPhysicalMaterial color="#dfe8e6" roughness={0.03} transparent opacity={0.14} envMapIntensity={1.6} depthWrite={false} />
          </mesh>
          <mesh position={[p[0], 1.01, p[2]]} raycast={noRaycast}>
            <boxGeometry args={[Math.max(s[0], 0.04), 0.025, Math.max(s[2], 0.04)]} />
            <Surface kind="brass" color="#b8925c" roughness={0.3} metalness={0.9} />
          </mesh>
        </group>
      ))}
      {/* Brass lantern by the loungers. */}
      <group position={[3.15 + 0.15, 0.012, 1.25]}>
        <mesh position={[0, 0.3, 0]} castShadow raycast={noRaycast}>
          <cylinderGeometry args={[0.12, 0.12, 0.5, 6, 1, true]} />
          <Surface kind="brass" color="#b8925c" roughness={0.3} metalness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.28, 0]} raycast={noRaycast}>
          <cylinderGeometry args={[0.03, 0.03, 0.14, 12]} />
          <meshStandardMaterial color="#fff1d6" emissive="#ffb86a" emissiveIntensity={2.5} />
        </mesh>
      </group>
    </group>
  );
}
