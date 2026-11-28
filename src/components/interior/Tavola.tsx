import { RoundedBox } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { Model } from "../../three/assets";
import { PBRMaterial } from "../../three/pbr";
import { Surface } from "../../three/Surface";

// Tavola: the hotel's first-floor restaurant, inside the 12.1 × 8.9 m plate
// (metres; the camera looks in from the south-east):
//
//   NW  glass wine cellar        N   window          NE  marble bar + back bar
//   W   velvet banquette with two-tops and mirrored panels
//   C   the chef's table: one long marble table for twelve under chandeliers
//   SE  round tables dressed in white linen     SW  maître d' stand
//
// Everything is modelled at real scale: tables 0.75 m high, chairs 0.47 m
// seats, wine glasses 0.22 m. Repeated small things (bottles, glassware,
// cutlery) share geometry so the room stays light to render.

const noRaycast = () => undefined;

export const TAVOLA = {
  chef: [-0.2, 0, 0.35] as [number, number, number],
  banquette: [-5.35, 0, 0] as [number, number, number],
  bar: [4.05, 0, -3.15] as [number, number, number],
  cellar: [-3.95, 0, -4.05] as [number, number, number],
  rounds: [3.9, 0, 2.55] as [number, number, number],
};

const TABLE_H = 0.75;
const BRASS = "#c39a5e";
const LINEN = "#f4efe6";

// ---- Shared geometry --------------------------------------------------------

const lathe = (points: [number, number][], segments = 28) =>
  new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);

const GEO = {
  wineGlass: lathe([
    [0, 0], [0.034, 0], [0.036, 0.004], [0.006, 0.01], [0.004, 0.012], [0.004, 0.105],
    [0.012, 0.115], [0.036, 0.14], [0.042, 0.17], [0.038, 0.205], [0.034, 0.22], [0.032, 0.22],
  ]),
  tumbler: lathe([[0, 0], [0.03, 0], [0.033, 0.004], [0.036, 0.1], [0.034, 0.1]]),
  bottle: lathe([
    [0, 0], [0.036, 0], [0.037, 0.005], [0.037, 0.19], [0.033, 0.225], [0.016, 0.255],
    [0.013, 0.3], [0.014, 0.305], [0.014, 0.315], [0, 0.315],
  ], 14),
  plate: lathe([[0, 0], [0.11, 0], [0.125, 0.012], [0.14, 0.016], [0.141, 0.02], [0.128, 0.017], [0, 0.009]], 40),
  charger: lathe([[0, 0], [0.155, 0], [0.16, 0.008], [0.158, 0.011], [0, 0.004]], 44),
  candle: new THREE.CylinderGeometry(0.011, 0.011, 0.16, 12),
  flame: new THREE.SphereGeometry(0.012, 10, 8).scale(1, 2.2, 1),
  fork: new THREE.BoxGeometry(0.018, 0.004, 0.19),
  knife: new THREE.BoxGeometry(0.014, 0.004, 0.21),
};

// ---- Small pieces ------------------------------------------------------------

function GlassMaterial({ tint = "#ffffff" }: { tint?: string }) {
  return <meshStandardMaterial color={tint} transparent opacity={0.28} roughness={0.04} metalness={0.15} envMapIntensity={2.2} depthWrite={false} />;
}

/** One cover: charger, plate, folded napkin, cutlery, wine and water glasses. */
function PlaceSetting({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={GEO.charger} position={[0, 0.001, 0]} castShadow raycast={noRaycast}>
        <Surface kind="brass" color="#b88f58" roughness={0.32} metalness={0.85} />
      </mesh>
      <mesh geometry={GEO.plate} position={[0, 0.006, 0]} castShadow raycast={noRaycast}>
        <Surface kind="ceramic" color="#f7f3ec" roughness={0.18} />
      </mesh>
      {/* Napkin folded on the plate. */}
      <RoundedBox args={[0.11, 0.02, 0.16]} radius={0.008} smoothness={2} position={[0, 0.03, 0]} castShadow raycast={noRaycast}>
        <Surface kind="linen" color="#e9e0d1" roughness={0.95} />
      </RoundedBox>
      <mesh geometry={GEO.fork} position={[-0.19, 0.003, 0]} raycast={noRaycast}>
        <meshStandardMaterial color="#d8d2c6" metalness={1} roughness={0.22} />
      </mesh>
      <mesh geometry={GEO.knife} position={[0.19, 0.003, 0]} raycast={noRaycast}>
        <meshStandardMaterial color="#d8d2c6" metalness={1} roughness={0.22} />
      </mesh>
      <mesh geometry={GEO.wineGlass} position={[0.16, 0, -0.17]} raycast={noRaycast}>
        <GlassMaterial />
      </mesh>
      <mesh geometry={GEO.tumbler} position={[0.24, 0, -0.1]} raycast={noRaycast}>
        <GlassMaterial tint="#e8f0f2" />
      </mesh>
    </group>
  );
}

function Candle({ position, height = 0.16 }: { position: [number, number, number]; height?: number }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]} castShadow raycast={noRaycast}>
        <cylinderGeometry args={[0.022, 0.032, 0.06, 16]} />
        <Surface kind="brass" color={BRASS} roughness={0.28} metalness={0.9} />
      </mesh>
      <mesh geometry={GEO.candle} position={[0, 0.06 + height / 2, 0]} scale={[1, height / 0.16, 1]} raycast={noRaycast}>
        <meshStandardMaterial color="#f6efe0" roughness={0.6} emissive="#ffcf8f" emissiveIntensity={0.08} />
      </mesh>
      <mesh geometry={GEO.flame} position={[0, 0.06 + height + 0.022, 0]} raycast={noRaycast}>
        <meshBasicMaterial color="#ffd38a" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Upholstered dining chair: curved back, piped seat, tapered walnut legs. */
function DiningChair({ position, rotation, fabric }: { position: [number, number, number]; rotation: number; fabric: string }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[0.48, 0.1, 0.48]} radius={0.04} smoothness={4} position={[0, 0.47, 0]} castShadow receiveShadow>
        <Surface kind="satin" color={fabric} roughness={0.62} />
      </RoundedBox>
      {/* Curved back: three slightly angled pads read as one shell. */}
      {[-1, 0, 1].map((k) => (
        <RoundedBox
          key={k}
          args={[0.17, 0.42, 0.07]}
          radius={0.03}
          smoothness={4}
          position={[k * 0.155, 0.76, -0.2 + Math.abs(k) * 0.03]}
          rotation={[-0.14, -k * 0.32, 0]}
          castShadow
        >
          <Surface kind="satin" color={fabric} roughness={0.62} />
        </RoundedBox>
      ))}
      {[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.21, z]} rotation={[z * 0.12, 0, -x * 0.12]} castShadow>
          <cylinderGeometry args={[0.018, 0.011, 0.43, 10]} />
          <PBRMaterial set="walnut" color="#6d5240" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** Tiered brass chandelier with candle bulbs and frosted glass drops. */
function Chandelier({ position, radius = 0.55 }: { position: [number, number, number]; radius?: number }) {
  const arms = 10;
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[0.006, 0.006, 1.1, 6]} />
        <Surface kind="brass" color={BRASS} roughness={0.3} metalness={0.9} />
      </mesh>
      {[radius, radius * 0.6].map((r, tier) => (
        <group key={r} position={[0, tier * 0.28, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow raycast={noRaycast}>
            <torusGeometry args={[r, 0.014, 10, 64]} />
            <Surface kind="brass" color={BRASS} roughness={0.25} metalness={0.92} />
          </mesh>
          {Array.from({ length: tier ? 6 : arms }, (_, i) => {
            const a = (i / (tier ? 6 : arms)) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
                <mesh position={[0, 0.05, 0]} raycast={noRaycast}>
                  <cylinderGeometry args={[0.012, 0.012, 0.1, 10]} />
                  <meshStandardMaterial color="#f3ead8" roughness={0.5} />
                </mesh>
                <mesh position={[0, 0.13, 0]} scale={[1, 1.5, 1]} raycast={noRaycast}>
                  <sphereGeometry args={[0.024, 12, 10]} />
                  <meshBasicMaterial color="#ffe0a8" toneMapped={false} />
                </mesh>
                <mesh position={[0, -0.06, 0]} raycast={noRaycast}>
                  <octahedronGeometry args={[0.022, 0]} />
                  <GlassMaterial tint="#fff4e0" />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.cos(a) * radius * 0.5, 0.18, Math.sin(a) * radius * 0.5]} rotation={[0, -a, Math.PI / 2 - 0.75]} raycast={noRaycast}>
            <cylinderGeometry args={[0.005, 0.005, radius * 1.15, 6]} />
            <Surface kind="brass" color={BRASS} roughness={0.3} metalness={0.9} />
          </mesh>
        );
      })}
      <pointLight position={[0, -0.1, 0]} intensity={3.4} distance={4.2} decay={2} color="#ffcf92" />
    </group>
  );
}

/** Low arrangement of roses and greenery for a table runner. */
function Centerpiece({ position }: { position: [number, number, number] }) {
  const blooms = useMemo(() => {
    const items: { p: [number, number, number]; c: string; s: number }[] = [];
    const colors = ["#f3dfd2", "#e9c3b4", "#fbf3ea", "#d89f8f"];
    for (let i = 0; i < 11; i += 1) {
      const a = i * 2.39;
      const r = 0.035 + (i % 4) * 0.022;
      items.push({ p: [Math.cos(a) * r * 1.8, 0.1 + (i % 3) * 0.018, Math.sin(a) * r], c: colors[i % colors.length], s: 0.032 + (i % 3) * 0.006 });
    }
    return items;
  }, []);
  return (
    <group position={position}>
      <mesh position={[0, 0.04, 0]} castShadow raycast={noRaycast}>
        <cylinderGeometry args={[0.1, 0.075, 0.08, 28]} />
        <Surface kind="ceramic" color="#e8e1d6" roughness={0.25} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => {
        const a = i * 0.7;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.12, 0.1, Math.sin(a) * 0.06]} rotation={[Math.sin(a) * 0.6, a, Math.cos(a) * 0.6]} scale={[1, 0.3, 2]} raycast={noRaycast}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <Surface kind="foliage" color="#55693f" roughness={0.8} />
          </mesh>
        );
      })}
      {blooms.map((b, i) => (
        <mesh key={i} position={b.p} castShadow raycast={noRaycast}>
          <icosahedronGeometry args={[b.s, 1]} />
          <Surface kind="satin" color={b.c} roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

// ---- The chef's table ---------------------------------------------------------

export function ChefTable() {
  const [cx, , cz] = TAVOLA.chef;
  const L = 4.3;
  const D = 1.15;
  const seatsPerSide = 5;
  const sides = Array.from({ length: seatsPerSide }, (_, i) => -L / 2 + 0.43 + (i * (L - 0.86)) / (seatsPerSide - 1));
  return (
    <group>
      <group position={[cx, 0, cz]}>
        {/* Thick Calacatta top on a walnut apron and two sculpted pedestals. */}
        <RoundedBox args={[L, 0.06, D]} radius={0.02} smoothness={4} position={[0, TABLE_H - 0.03, 0]} castShadow receiveShadow>
          <Surface kind="marble" color="#efe8de" roughness={0.18} />
        </RoundedBox>
        <RoundedBox args={[L - 0.24, 0.08, D - 0.22]} radius={0.015} smoothness={3} position={[0, TABLE_H - 0.1, 0]} castShadow>
          <PBRMaterial set="walnut" color="#7a5a42" roughness={0.55} />
        </RoundedBox>
        {[-L / 2 + 0.75, L / 2 - 0.75].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 0.34, 0]} castShadow>
              <cylinderGeometry args={[0.14, 0.24, 0.62, 6]} />
              <PBRMaterial set="walnut" color="#6c4e39" roughness={0.55} />
            </mesh>
            <RoundedBox args={[0.7, 0.06, 0.62]} radius={0.02} smoothness={3} position={[0, 0.03, 0]} castShadow>
              <PBRMaterial set="walnut" color="#5d4332" roughness={0.6} />
            </RoundedBox>
          </group>
        ))}
        {/* Linen runner, flowers, candles, wine and water. */}
        <RoundedBox args={[L - 0.5, 0.006, 0.36]} radius={0.002} smoothness={2} position={[0, TABLE_H + 0.003, 0]} receiveShadow raycast={noRaycast}>
          <Surface kind="linen" color="#e6dccb" roughness={0.95} />
        </RoundedBox>
        {[-1.2, 0, 1.2].map((x) => (
          <Centerpiece key={x} position={[x, TABLE_H + 0.006, 0]} />
        ))}
        {[-1.75, -0.62, 0.62, 1.75].map((x, i) => (
          <Candle key={x} position={[x, TABLE_H + 0.006, (i % 2 ? 1 : -1) * 0.06]} height={0.14 + (i % 2) * 0.05} />
        ))}
        {[-0.92, 0.38].map((x, i) => (
          <mesh key={x} geometry={GEO.bottle} position={[x, TABLE_H + 0.006, i ? 0.08 : -0.07]} castShadow raycast={noRaycast}>
            <meshStandardMaterial color={i ? "#3a1420" : "#2f3a22"} roughness={0.12} metalness={0.25} />
          </mesh>
        ))}
        {sides.map((x) =>
          [-1, 1].map((s) => (
            <PlaceSetting key={`${x}${s}`} position={[x, TABLE_H, s * (D / 2 - 0.22)]} rotation={s > 0 ? 0 : Math.PI} />
          )),
        )}
        <PlaceSetting position={[-L / 2 + 0.24, TABLE_H, 0]} rotation={-Math.PI / 2} />
        <PlaceSetting position={[L / 2 - 0.24, TABLE_H, 0]} rotation={Math.PI / 2} />
      </group>
      {sides.map((x) =>
        [-1, 1].map((s) => (
          <DiningChair key={`c${x}${s}`} position={[cx + x, 0.012, cz + s * (D / 2 + 0.24)]} rotation={s > 0 ? Math.PI : 0} fabric="#6b2f2a" />
        )),
      )}
      <DiningChair position={[cx - L / 2 - 0.26, 0.012, cz]} rotation={Math.PI / 2} fabric="#6b2f2a" />
      <DiningChair position={[cx + L / 2 + 0.26, 0.012, cz]} rotation={-Math.PI / 2} fabric="#6b2f2a" />
      <Chandelier position={[cx - 1.05, 2.15, cz]} />
      <Chandelier position={[cx + 1.05, 2.15, cz]} />
    </group>
  );
}

// ---- Banquette along the west wall -----------------------------------------------

export function Banquette() {
  const [bx, , bz] = TAVOLA.banquette;
  const length = 7.4;
  const channels = 22;
  const tables = [-2.45, 0, 2.45];
  return (
    <group>
      <group position={[bx - 0.35, 0, bz]}>
        {/* Walnut plinth, deep velvet seat and channel-tufted back. */}
        <RoundedBox args={[0.7, 0.14, length]} radius={0.02} smoothness={3} position={[0.05, 0.07, 0]} castShadow receiveShadow>
          <PBRMaterial set="walnut" color="#5b4231" roughness={0.6} />
        </RoundedBox>
        <RoundedBox args={[0.62, 0.17, length - 0.04]} radius={0.06} smoothness={4} position={[0.08, 0.3, 0]} castShadow receiveShadow>
          <Surface kind="satin" color="#26453b" roughness={0.58} />
        </RoundedBox>
        {Array.from({ length: channels }, (_, i) => {
          const z = -length / 2 + (length / channels) * (i + 0.5);
          return (
            <RoundedBox key={i} args={[0.15, 0.62, length / channels - 0.012]} radius={0.06} smoothness={4} position={[-0.2, 0.7, z]} rotation={[0, 0, -0.1]} castShadow>
              <Surface kind="satin" color="#2a4c41" roughness={0.58} />
            </RoundedBox>
          );
        })}
      </group>
      {/* Bronze mirror panels and sconces on the wall above. */}
      {[-2.45, 0, 2.45].map((z) => (
        <group key={z} position={[-6.03, 1.62, bz + z]}>
          <mesh rotation={[0, Math.PI / 2, 0]} raycast={noRaycast}>
            <planeGeometry args={[1.9, 1.05]} />
            <meshStandardMaterial color="#8a7a66" metalness={1} roughness={0.08} />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]} position={[-0.005, 0, 0]} raycast={noRaycast}>
            <planeGeometry args={[1.98, 1.13]} />
            <Surface kind="brass" color={BRASS} roughness={0.3} metalness={0.9} />
          </mesh>
        </group>
      ))}
      {[-3.68, -1.22, 1.22, 3.68].map((z) => (
        <group key={z} position={[-5.98, 1.62, bz + z]}>
          <mesh rotation={[0, 0, Math.PI / 2]} raycast={noRaycast}>
            <cylinderGeometry args={[0.04, 0.04, 0.06, 16]} />
            <Surface kind="brass" color={BRASS} roughness={0.3} metalness={0.9} />
          </mesh>
          <mesh position={[0.12, 0.08, 0]} raycast={noRaycast}>
            <cylinderGeometry args={[0.06, 0.08, 0.14, 20, 1, true]} />
            <meshStandardMaterial color="#f6e9d2" emissive="#ffc98a" emissiveIntensity={1.1} side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[0.2, 0.05, 0]} intensity={0.9} distance={2.2} decay={2} color="#ffcb8a" />
        </group>
      ))}
      {tables.map((z) => (
        <group key={z}>
          <group position={[bx + 0.55, 0, bz + z]}>
            <RoundedBox args={[0.78, 0.04, 0.78]} radius={0.012} smoothness={3} position={[0, TABLE_H - 0.02, 0]} castShadow receiveShadow>
              <Surface kind="marble" color="#e9e2d7" roughness={0.2} />
            </RoundedBox>
            <mesh position={[0, 0.36, 0]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 0.7, 14]} />
              <Surface kind="brass" color={BRASS} roughness={0.3} metalness={0.9} />
            </mesh>
            <mesh position={[0, 0.012, 0]} castShadow>
              <cylinderGeometry args={[0.24, 0.26, 0.024, 32]} />
              <Surface kind="brass" color={BRASS} roughness={0.3} metalness={0.9} />
            </mesh>
            <PlaceSetting position={[-0.2, TABLE_H, 0]} rotation={-Math.PI / 2} />
            <PlaceSetting position={[0.2, TABLE_H, 0]} rotation={Math.PI / 2} />
            <Candle position={[0, TABLE_H, 0.22]} height={0.1} />
          </group>
          <DiningChair position={[bx + 1.22, 0.012, bz + z]} rotation={-Math.PI / 2} fabric="#b9875a" />
        </group>
      ))}
    </group>
  );
}

// ---- Wine cellar -----------------------------------------------------------------

export function WineCellar() {
  const [wx, , wz] = TAVOLA.cellar;
  const W = 4.1;
  const H = 3.0;
  const cols = 22;
  const rows = 11;
  const bottles = useMemo(() => {
    const list: { x: number; y: number; c: string }[] = [];
    const reds = ["#3a1420", "#2b0f17", "#4a1a24", "#2f3a22", "#1f2a1c", "#c9b27a", "#3b2a14"];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if ((r * 7 + c * 3) % 11 === 0) continue; // a few empty slots
        list.push({ x: -W / 2 + 0.22 + (c * (W - 0.44)) / (cols - 1), y: 0.3 + r * 0.24, c: reds[(r * 5 + c * 2) % reds.length] });
      }
    }
    return list;
  }, []);
  // Bottles lie on their side, neck toward the room.
  const bottleMatrix = useMemo(() => new THREE.Euler(Math.PI / 2, 0, 0), []);
  return (
    <group position={[wx, 0, wz]}>
      {/* Walnut case, warm backlit wall, brass racks. */}
      <RoundedBox args={[W + 0.16, H + 0.12, 0.5]} radius={0.02} smoothness={3} position={[0, (H + 0.12) / 2, -0.05]} castShadow receiveShadow>
        <PBRMaterial set="walnut" color="#4d3626" roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, H / 2 + 0.06, 0.205]} raycast={noRaycast}>
        <planeGeometry args={[W - 0.08, H - 0.06]} />
        <meshStandardMaterial color="#3a2516" emissive="#ff9e4f" emissiveIntensity={0.35} roughness={0.8} />
      </mesh>
      {Array.from({ length: rows + 1 }, (_, r) => (
        <mesh key={`r${r}`} position={[0, 0.18 + r * 0.24, 0.27]} raycast={noRaycast}>
          <boxGeometry args={[W - 0.1, 0.012, 0.012]} />
          <Surface kind="brass" color={BRASS} roughness={0.3} metalness={0.9} />
        </mesh>
      ))}
      {bottles.map((b, i) => (
        <mesh key={i} geometry={GEO.bottle} position={[b.x, b.y, 0.08]} rotation={bottleMatrix} raycast={noRaycast}>
          <meshStandardMaterial color={b.c} roughness={0.14} metalness={0.2} />
        </mesh>
      ))}
      {/* Frameless glass front with slim brass mullions and a pull. */}
      <mesh position={[0, H / 2 + 0.06, 0.43]} raycast={noRaycast}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color="#d8e2e0" transparent opacity={0.12} roughness={0.03} metalness={0.2} envMapIntensity={2} depthWrite={false} />
      </mesh>
      {[-W / 2, -W / 6, W / 6, W / 2].map((x) => (
        <mesh key={x} position={[x, H / 2 + 0.06, 0.44]} raycast={noRaycast}>
          <boxGeometry args={[0.025, H, 0.025]} />
          <Surface kind="brass" color={BRASS} roughness={0.3} metalness={0.9} />
        </mesh>
      ))}
      <mesh position={[W / 6 - 0.08, 1.2, 0.47]} raycast={noRaycast}>
        <cylinderGeometry args={[0.012, 0.012, 0.6, 10]} />
        <Surface kind="brass" color={BRASS} roughness={0.3} metalness={0.9} />
      </mesh>
      <pointLight position={[0, 1.6, 0.6]} intensity={2.2} distance={3.4} decay={2} color="#ffb56a" />
    </group>
  );
}

// ---- Marble bar ------------------------------------------------------------------

function BarStool({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.012, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[0.21, 0.22, 0.024, 32]} />
        <Surface kind="brass" color={BRASS} roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[0, 0.36, 0]} castShadow raycast={noRaycast}>
        <cylinderGeometry args={[0.024, 0.024, 0.7, 12]} />
        <Surface kind="brass" color={BRASS} roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <torusGeometry args={[0.17, 0.009, 8, 32]} />
        <Surface kind="brass" color={BRASS} roughness={0.3} metalness={0.9} />
      </mesh>
      <RoundedBox args={[0.42, 0.08, 0.42]} radius={0.035} smoothness={4} position={[0, 0.76, 0]} castShadow>
        <Surface kind="satin" color="#3b2418" roughness={0.45} />
      </RoundedBox>
      <RoundedBox args={[0.4, 0.22, 0.06]} radius={0.025} smoothness={3} position={[0, 0.92, -0.18]} rotation={[-0.15, 0, 0]} castShadow>
        <Surface kind="satin" color="#3b2418" roughness={0.45} />
      </RoundedBox>
    </group>
  );
}

export function MarbleBar() {
  const [bx, , bz] = TAVOLA.bar;
  const L = 3.5;
  const flutes = 34;
  const shelfBottles = useMemo(() => {
    const colors = ["#6b3a12", "#b7802f", "#2f3a22", "#d8c58f", "#47162a", "#c9d6d2", "#8c4a1c", "#1d2a3a"];
    const list: { x: number; y: number; c: string; s: number }[] = [];
    [1.32, 1.78, 2.24].forEach((y, row) => {
      for (let i = 0; i < 18; i += 1) {
        list.push({ x: -L / 2 + 0.15 + i * 0.19 + (row % 2) * 0.05, y, c: colors[(i * 3 + row) % colors.length], s: 0.9 + ((i + row) % 3) * 0.08 });
      }
    });
    return list;
  }, []);
  return (
    <group>
      <group position={[bx, 0, bz]}>
        {/* Fluted walnut front, waterfall Calacatta top, brass foot rail. */}
        <RoundedBox args={[L, 1.02, 0.62]} radius={0.02} smoothness={3} position={[0, 0.51, 0]} castShadow receiveShadow>
          <PBRMaterial set="walnut" color="#5b4130" roughness={0.55} />
        </RoundedBox>
        {Array.from({ length: flutes }, (_, i) => (
          <mesh key={i} position={[-L / 2 + 0.06 + (i * (L - 0.12)) / (flutes - 1), 0.52, 0.315]} castShadow raycast={noRaycast}>
            <cylinderGeometry args={[0.04, 0.04, 0.9, 10, 1, false, -Math.PI / 2, Math.PI]} />
            <PBRMaterial set="walnut" color="#6a4d38" roughness={0.5} />
          </mesh>
        ))}
        <RoundedBox args={[L + 0.1, 0.07, 0.74]} radius={0.015} smoothness={3} position={[0, 1.07, 0.04]} castShadow receiveShadow>
          <Surface kind="marble" color="#efe8de" roughness={0.16} />
        </RoundedBox>
        {[-1, 1].map((s) => (
          <RoundedBox key={s} args={[0.07, 1.04, 0.74]} radius={0.015} smoothness={3} position={[s * (L / 2 + 0.035), 0.52, 0.04]} castShadow receiveShadow>
            <Surface kind="marble" color="#efe8de" roughness={0.16} />
          </RoundedBox>
        ))}
        <mesh position={[0, 0.22, 0.46]} rotation={[0, 0, Math.PI / 2]} castShadow raycast={noRaycast}>
          <cylinderGeometry args={[0.022, 0.022, L - 0.1, 14]} />
          <Surface kind="brass" color={BRASS} roughness={0.25} metalness={0.92} />
        </mesh>
        {[-L / 2 + 0.3, 0, L / 2 - 0.3].map((x) => (
          <mesh key={x} position={[x, 0.12, 0.4]} raycast={noRaycast}>
            <cylinderGeometry args={[0.014, 0.014, 0.22, 8]} />
            <Surface kind="brass" color={BRASS} roughness={0.25} metalness={0.92} />
          </mesh>
        ))}
        {/* On the bar: glassware, a cocktail station and a small lamp. */}
        {[-1.2, -0.95, 0.9, 1.15].map((x, i) => (
          <mesh key={x} geometry={i % 2 ? GEO.tumbler : GEO.wineGlass} position={[x, 1.105, 0.12]} raycast={noRaycast}>
            <GlassMaterial />
          </mesh>
        ))}
        <group position={[0.15, 1.105, -0.1]}>
          <mesh position={[0, 0.16, 0]} castShadow raycast={noRaycast}>
            <cylinderGeometry args={[0.012, 0.05, 0.32, 16]} />
            <Surface kind="brass" color={BRASS} roughness={0.25} metalness={0.92} />
          </mesh>
          <mesh position={[0, 0.36, 0]} raycast={noRaycast}>
            <sphereGeometry args={[0.11, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#f5ead6" emissive="#ffc98a" emissiveIntensity={0.9} side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[0, 0.3, 0]} intensity={0.8} distance={1.8} decay={2} color="#ffcf92" />
        </group>
      </group>
      {/* Back bar on the north wall: backlit onyx between walnut shelving. */}
      <group position={[bx, 0, -4.2]}>
        <RoundedBox args={[L + 0.3, 0.92, 0.5]} radius={0.02} smoothness={3} position={[0, 0.46, 0.06]} castShadow receiveShadow>
          <PBRMaterial set="walnut" color="#4d3626" roughness={0.6} />
        </RoundedBox>
        <RoundedBox args={[L + 0.34, 0.05, 0.54]} radius={0.01} smoothness={2} position={[0, 0.94, 0.06]} castShadow>
          <Surface kind="marble" color="#efe8de" roughness={0.16} />
        </RoundedBox>
        <mesh position={[0, 1.85, 0.01]} raycast={noRaycast}>
          <planeGeometry args={[L + 0.2, 1.7]} />
          <Surface kind="marble" color="#e8b77a" roughness={0.3} emissive="#ff9d4a" emissiveIntensity={0.55} />
        </mesh>
        {[1.18, 1.64, 2.1].map((y) => (
          <mesh key={y} position={[0, y, 0.12]} castShadow raycast={noRaycast}>
            <boxGeometry args={[L + 0.1, 0.03, 0.24]} />
            <Surface kind="brass" color={BRASS} roughness={0.28} metalness={0.9} />
          </mesh>
        ))}
        {shelfBottles.map((b, i) => (
          <mesh key={i} geometry={GEO.bottle} position={[b.x, b.y + 0.015, 0.12]} scale={[1, b.s, 1]} raycast={noRaycast}>
            <meshStandardMaterial color={b.c} roughness={0.1} metalness={0.15} transparent opacity={0.9} />
          </mesh>
        ))}
        <pointLight position={[0, 1.8, 0.6]} intensity={2.4} distance={3.6} decay={2} color="#ffb067" />
      </group>
      {[-1.25, -0.42, 0.42, 1.25].map((x) => (
        <BarStool key={x} position={[bx + x, 0.012, bz + 0.72]} rotation={Math.PI} />
      ))}
    </group>
  );
}

// ---- Round tables, maître d' stand, plants (not interactive) ------------------------

function RoundTable({ position, seats = 4 }: { position: [number, number, number]; seats?: number }) {
  const [x, , z] = position;
  const r = 0.55;
  return (
    <group>
      <group position={[x, 0, z]}>
        {/* White linen to the floor over a round top. */}
        <mesh position={[0, TABLE_H / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r + 0.02, r + 0.11, TABLE_H, 48, 1, true]} />
          <Surface kind="linen" color={LINEN} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, TABLE_H, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[r + 0.02, r + 0.02, 0.012, 48]} />
          <Surface kind="linen" color={LINEN} roughness={0.95} />
        </mesh>
        {Array.from({ length: seats }, (_, i) => {
          const a = (i / seats) * Math.PI * 2 + Math.PI / 4;
          return <PlaceSetting key={i} position={[Math.sin(a) * (r - 0.2), TABLE_H + 0.006, Math.cos(a) * (r - 0.2)]} rotation={a} />;
        })}
        <Candle position={[0.06, TABLE_H + 0.006, 0]} height={0.12} />
        <mesh position={[-0.08, TABLE_H + 0.006 + 0.06, 0.02]} castShadow raycast={noRaycast}>
          <cylinderGeometry args={[0.03, 0.035, 0.12, 16]} />
          <Surface kind="ceramic" color="#e9e2d6" roughness={0.22} />
        </mesh>
        <mesh position={[-0.08, TABLE_H + 0.15, 0.02]} raycast={noRaycast}>
          <icosahedronGeometry args={[0.05, 1]} />
          <Surface kind="satin" color="#efd6c7" roughness={0.75} />
        </mesh>
      </group>
      {Array.from({ length: seats }, (_, i) => {
        const a = (i / seats) * Math.PI * 2 + Math.PI / 4;
        return <DiningChair key={i} position={[x + Math.sin(a) * (r + 0.32), 0.012, z + Math.cos(a) * (r + 0.32)]} rotation={a + Math.PI} fabric="#b9875a" />;
      })}
    </group>
  );
}

function MaitreDStand({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, -0.6, 0]}>
      <RoundedBox args={[0.62, 1.08, 0.42]} radius={0.03} smoothness={3} position={[0, 0.54, 0]} castShadow receiveShadow>
        <PBRMaterial set="walnut" color="#5b4130" roughness={0.55} />
      </RoundedBox>
      <RoundedBox args={[0.7, 0.04, 0.48]} radius={0.01} smoothness={2} position={[0, 1.1, 0]} rotation={[0.18, 0, 0]} castShadow>
        <Surface kind="marble" color="#efe8de" roughness={0.18} />
      </RoundedBox>
      <RoundedBox args={[0.34, 0.03, 0.24]} radius={0.006} smoothness={2} position={[0, 1.14, 0.02]} rotation={[0.18, 0, 0]} raycast={noRaycast}>
        <meshStandardMaterial color="#2b1d16" roughness={0.6} />
      </RoundedBox>
      <group position={[0.22, 1.12, -0.1]}>
        <mesh position={[0, 0.13, 0]} raycast={noRaycast}>
          <cylinderGeometry args={[0.01, 0.04, 0.26, 12]} />
          <Surface kind="brass" color={BRASS} roughness={0.25} metalness={0.92} />
        </mesh>
        <mesh position={[0, 0.3, 0]} raycast={noRaycast}>
          <sphereGeometry args={[0.07, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#f5ead6" emissive="#ffc98a" emissiveIntensity={0.9} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

export function TavolaDining() {
  const [rx, , rz] = TAVOLA.rounds;
  return (
    <group>
      <RoundTable position={[rx - 0.95, 0, rz]} />
      <RoundTable position={[rx + 1.35, 0, rz - 0.15]} />
      <RoundTable position={[2.6, 0, -0.95]} seats={2} />
      <RoundTable position={[-1.75, 0, 2.75]} />
      <MaitreDStand position={[-3.55, 0, 4.0]} />
      <Model name="plant" position={[-5.55, 0, 4.0]} scale={1.25} />
      <Model name="plant" position={[5.55, 0, 4.05]} scale={1.15} />
      <Model name="plant" position={[1.95, 0, -3.95]} scale={1.05} />
      <Model name="plant" position={[-1.75, 0, -3.95]} scale={1.05} />
      {/* Service console with stacked plates and carafes. */}
      <group position={[5.62, 0, 0.6]} rotation={[0, -Math.PI / 2, 0]}>
        <RoundedBox args={[1.4, 0.88, 0.46]} radius={0.02} smoothness={3} position={[0, 0.44, 0]} castShadow receiveShadow>
          <PBRMaterial set="walnut" color="#5b4130" roughness={0.55} />
        </RoundedBox>
        <RoundedBox args={[1.44, 0.04, 0.5]} radius={0.01} smoothness={2} position={[0, 0.9, 0]} castShadow>
          <Surface kind="marble" color="#efe8de" roughness={0.18} />
        </RoundedBox>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} geometry={GEO.plate} position={[-0.35, 0.92 + i * 0.018, 0]} raycast={noRaycast}>
            <Surface kind="ceramic" color="#f7f3ec" roughness={0.18} />
          </mesh>
        ))}
        {[0.15, 0.32, 0.49].map((x) => (
          <mesh key={x} geometry={GEO.tumbler} position={[x, 0.92, 0.05]} scale={[1.4, 2.2, 1.4]} raycast={noRaycast}>
            <GlassMaterial tint="#e8f0f2" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Warm restaurant lighting: low pools over the tables, cool window light. */
export function TavolaLighting() {
  const [rx, , rz] = TAVOLA.rounds;
  return (
    <group>
      {[rx - 0.95, rx + 1.35].map((x) => (
        <group key={x} position={[x, 2.35, rz]}>
          <mesh position={[0, 0.5, 0]} raycast={noRaycast}>
            <cylinderGeometry args={[0.004, 0.004, 1, 6]} />
            <Surface kind="brass" color={BRASS} roughness={0.3} metalness={0.9} />
          </mesh>
          <mesh raycast={noRaycast}>
            <sphereGeometry args={[0.2, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Surface kind="brass" color={BRASS} roughness={0.25} metalness={0.92} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.01, 0]} raycast={noRaycast}>
            <circleGeometry args={[0.17, 28]} />
            <meshBasicMaterial color="#ffe2b0" toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <pointLight position={[0, -0.25, 0]} intensity={2.6} distance={3.4} decay={2} color="#ffcf92" />
        </group>
      ))}
    </group>
  );
}
