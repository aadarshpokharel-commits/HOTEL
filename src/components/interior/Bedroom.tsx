import { RoundedBox } from "@react-three/drei";
import { useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { Model } from "../../three/assets";
import { PBRMaterial } from "../../three/pbr";
import { curtainGeometry, drapeGeometry, pillowGeometry } from "../../three/softGeometry";
import { Surface } from "../../three/Surface";

// Residence bedroom, laid out to real hotel dimensions (metres):
//   west wall   — upholstered headboard on a walnut wall panel, king/queen bed,
//                 floating nightstands with ceramic lamps, artwork above
//   north wall  — window with sheers and full-height drapes, reading corner
//                 (lounge chair, pendant, plant), walnut wardrobe
//   east wall   — dressing mirror, wall-mounted TV, writing desk and chair
// Downloaded CC0 models: lounge chair, desk chair, ottoman, pendant, plant,
// vases, photo frame. Bed, bedding, joinery, lamps, TV, mirror, curtains and
// artwork are modelled here.

export const BEDROOM = { wallX: -6.04, northZ: -4.36, eastX: -1.13, southZ: 0.2 };
export const WINDOW = { x0: -4.55, x1: -3.15, sill: 0.6, head: 2.65 };
const BED_LENGTH = 2.05; // mattress
const BED_Z = -1.85;
const BED_HEAD_X = BEDROOM.wallX + 0.14;
/** Centre of the bed on the floor, used for the selection ring and camera. */
export const BED_CENTER: [number, number, number] = [BED_HEAD_X + BED_LENGTH / 2, 0, BED_Z];

const noRaycast = () => undefined;
const IVORY = "#f2ede4";

/** Mattress width per floor: queen (1.8 m) on 1–3, king (2.0 m) above. */
export function mattressWidthFor(floorId: number) {
  return floorId >= 4 ? 2.0 : 1.8;
}

function markDrape(geometry: THREE.BufferGeometry) {
  // Use box projection for scene-scale UVs, not the plane's own parameters.
  geometry.userData.boxUV = true;
  return geometry;
}

function BedsideLamp({ position, scale = 1, light = true }: { position: [number, number, number]; scale?: number; light?: boolean }) {
  const base = useMemo(() => {
    const profile = [
      [0, 0], [0.055, 0], [0.062, 0.012], [0.085, 0.06], [0.098, 0.13], [0.09, 0.2],
      [0.062, 0.255], [0.03, 0.285], [0.02, 0.3], [0.02, 0.31], [0, 0.31],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const geometry = new THREE.LatheGeometry(profile, 40);
    geometry.userData.boxUV = true;
    return geometry;
  }, []);
  return (
    <group position={position} scale={scale}>
      <mesh geometry={base} castShadow raycast={noRaycast}>
        <Surface kind="ceramic" physical color="#d9d1c4" roughness={0.32} clearcoat={0.6} clearcoatRoughness={0.25} />
      </mesh>
      <mesh position={[0, 0.37, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[0.007, 0.007, 0.13, 10]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.3} metalness={0.9} />
      </mesh>
      {/* Linen drum shade, glowing from the bulb inside. */}
      <mesh position={[0, 0.5, 0]} castShadow raycast={noRaycast}>
        <cylinderGeometry args={[0.14, 0.165, 0.23, 40, 1, true]} />
        <Surface kind="linen" color="#efe4d1" roughness={0.95} emissive="#ffbf7a" emissiveIntensity={light ? 0.55 : 0.05} side={THREE.DoubleSide} />
      </mesh>
      {[0.385, 0.615].map((y, i) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <torusGeometry args={[i ? 0.14 : 0.165, 0.003, 6, 48]} />
          <Surface kind="brass" color="#c9a36a" roughness={0.3} metalness={0.9} />
        </mesh>
      ))}
      {light && (
        <>
          <mesh position={[0, 0.47, 0]} raycast={noRaycast}>
            <sphereGeometry args={[0.035, 16, 12]} />
            <meshStandardMaterial color="#fff1d8" emissive="#ffc27c" emissiveIntensity={3} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Nightstand({ position, children }: { position: [number, number, number]; children?: ReactNode }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.55, 0.26, 0.42]} radius={0.015} smoothness={3} position={[0, 0.47, 0]} castShadow receiveShadow raycast={noRaycast}>
        <PBRMaterial set="walnut" color="#d9c2a6" roughness={0.9} />
      </RoundedBox>
      {/* Drawer reveal and a slim brass pull. */}
      <mesh position={[0, 0.47, 0.211]} raycast={noRaycast}>
        <boxGeometry args={[0.5, 0.006, 0.004]} />
        <meshStandardMaterial color="#1a120c" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.41, 0.218]} rotation={[0, 0, Math.PI / 2]} raycast={noRaycast}>
        <cylinderGeometry args={[0.006, 0.006, 0.16, 10]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.28} metalness={0.92} />
      </mesh>
      {[[-0.24, -0.17], [0.24, -0.17], [-0.24, 0.17], [0.24, 0.17]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.17, z]} castShadow raycast={noRaycast}>
          <cylinderGeometry args={[0.009, 0.007, 0.34, 10]} />
          <Surface kind="brass" color="#b8925c" roughness={0.32} metalness={0.9} />
        </mesh>
      ))}
      {children}
    </group>
  );
}

/**
 * The bed in its own frame: head at z = 0, foot toward +z, centred on x.
 * Includes headboard wall panel and nightstands with lamps.
 */
export function LuxuryBed({ mattressWidth }: { mattressWidth: number }) {
  const W = mattressWidth;
  const L = BED_LENGTH;
  const mattressTop = 0.64;
  const duvetStart = 0.5;

  const duvet = useMemo(
    () => markDrape(drapeGeometry({ width: W, length: L - duvetStart, top: mattressTop, sideDrop: 0.3, endDrop: 0.3, loft: 0.07, wrinkle: 0.007, seed: 3 })),
    [W, L],
  );
  const turnDown = useMemo(
    () => markDrape(drapeGeometry({ width: W + 0.02, length: 0.34, top: mattressTop + 0.075, sideDrop: 0.06, endDrop: 0, loft: 0.03, wrinkle: 0.004, seed: 7 })),
    [W],
  );
  const throwBlanket = useMemo(
    () => markDrape(drapeGeometry({ width: W + 0.04, length: 0.62, top: mattressTop + 0.08, sideDrop: 0.34, endDrop: 0, loft: 0.012, wrinkle: 0.005, seed: 11 })),
    [W],
  );
  const sleeping = useMemo(() => {
    const g = pillowGeometry(0.72, 0.17, 0.5, 2);
    g.userData.boxUV = true;
    return g;
  }, []);
  const euro = useMemo(() => {
    const g = pillowGeometry(0.64, 0.19, 0.64, 5);
    g.userData.boxUV = true;
    return g;
  }, []);
  const accent = useMemo(() => {
    const g = pillowGeometry(0.52, 0.14, 0.32, 9);
    g.userData.boxUV = true;
    return g;
  }, []);

  const pillowXs = W >= 2 ? [-0.47, 0.47] : [-0.42, 0.42];
  const channels = 9;
  const headW = W + 0.34;
  const channelW = headW / channels;
  const nightstandX = W / 2 + 0.14 + 0.275;

  return (
    <group>
      {/* Walnut wall panel behind the bed, with a brass reveal on top. */}
      <mesh position={[0, 0.88, -0.1]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[W + 1.6, 1.3, 0.04]} />
        <PBRMaterial set="walnut" color="#c8ae90" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.535, -0.085]} raycast={noRaycast}>
        <boxGeometry args={[W + 1.6, 0.012, 0.02]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.3} metalness={0.9} />
      </mesh>

      {/* Channel-tufted wool headboard. */}
      {Array.from({ length: channels }, (_, i) => (
        <RoundedBox
          key={i}
          args={[channelW - 0.008, 1.02, 0.09]}
          radius={0.04}
          smoothness={4}
          position={[-headW / 2 + channelW * (i + 0.5), 0.97, -0.035]}
          castShadow
          receiveShadow
          raycast={noRaycast}
        >
          <PBRMaterial set="wool" color="#b9ab97" roughness={1} />
        </RoundedBox>
      ))}

      {/* Recessed walnut plinth, upholstered base, mattress. */}
      <mesh position={[0, 0.05, L / 2 + 0.04]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[W - 0.24, 0.1, L - 0.3]} />
        <PBRMaterial set="walnut" color="#6b5443" roughness={0.9} />
      </mesh>
      <RoundedBox args={[W + 0.1, 0.28, L + 0.06]} radius={0.035} smoothness={4} position={[0, 0.24, L / 2]} castShadow receiveShadow raycast={noRaycast}>
        <PBRMaterial set="wool" color="#9d917f" roughness={1} />
      </RoundedBox>
      <RoundedBox args={[W, 0.26, L]} radius={0.075} smoothness={5} position={[0, 0.51, L / 2]} castShadow receiveShadow raycast={noRaycast}>
        <Surface kind="linen" color={IVORY} roughness={0.95} />
      </RoundedBox>

      {/* Duvet with its turned-down fold, and a wool throw across the foot. */}
      <mesh geometry={duvet} position={[0, 0, duvetStart]} castShadow receiveShadow raycast={noRaycast}>
        <Surface kind="linen" color={IVORY} roughness={0.96} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={turnDown} position={[0, 0, duvetStart]} castShadow receiveShadow raycast={noRaycast}>
        <Surface kind="linen" color="#f6f2ea" roughness={0.96} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, mattressTop + 0.06, duvetStart + 0.01]} rotation={[0, 0, Math.PI / 2]} castShadow raycast={noRaycast}>
        <capsuleGeometry args={[0.042, W - 0.02, 6, 16]} />
        <Surface kind="linen" color="#f4efe6" roughness={0.96} />
      </mesh>
      <mesh geometry={throwBlanket} position={[0, 0, L - 0.78]} castShadow receiveShadow raycast={noRaycast}>
        <PBRMaterial set="wool" color="#a8754c" roughness={1} side={THREE.DoubleSide} />
      </mesh>

      {/* Pillows: euro shams against the headboard, sleeping pillows, accent. */}
      {pillowXs.map((x, i) => (
        <mesh key={`euro${x}`} geometry={euro} position={[x * 1.05, mattressTop + 0.3, 0.12]} rotation={[1.32, 0, i ? -0.04 : 0.05]} castShadow receiveShadow raycast={noRaycast}>
          <Surface kind="linen" color="#e9e2d6" roughness={0.95} />
        </mesh>
      ))}
      {pillowXs.map((x, i) => (
        <mesh key={`sleep${x}`} geometry={sleeping} position={[x, mattressTop + 0.19, 0.31]} rotation={[1.05, i ? 0.05 : -0.06, 0]} castShadow receiveShadow raycast={noRaycast}>
          <Surface kind="linen" color={IVORY} roughness={0.95} />
        </mesh>
      ))}
      <mesh geometry={accent} position={[0, mattressTop + 0.15, 0.5]} rotation={[0.9, 0, 0]} castShadow raycast={noRaycast}>
        <Surface kind="fabric" color="#8c5a3c" roughness={0.9} />
      </mesh>

      {/* Floating nightstands with lamps; one ~2700 K light serves both. */}
      <pointLight position={[0, 1.15, 0.25]} intensity={2.2} distance={3.6} decay={2} color="#ffb46a" />
      <Nightstand position={[-nightstandX, 0, 0.24]}>
        <BedsideLamp position={[0.06, 0.6, -0.04]} />
      </Nightstand>
      <Nightstand position={[nightstandX, 0, 0.24]}>
        <BedsideLamp position={[-0.06, 0.6, -0.04]} />
        <Model name="photoFrame" position={[0.17, 0.6, 0.08]} rotation={[0, -0.5, 0]} castShadow={false} />
      </Nightstand>
    </group>
  );
}

/** Bed placed in the room (wrapped by the interactive feature in the scene). */
export function PlacedBed({ mattressWidth }: { mattressWidth: number }) {
  return (
    <group position={[BED_HEAD_X, 0, BED_Z]} rotation={[0, Math.PI / 2, 0]}>
      {/* Invisible hit volume: the bed's visible meshes skip raycasting, so
          this box is what the room's click/hover selection responds to. */}
      <mesh position={[0, 0.7, BED_LENGTH / 2 - 0.05]}>
        <boxGeometry args={[mattressWidth + 1.3, 1.4, BED_LENGTH + 0.3]} />
        <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
      </mesh>
      <LuxuryBed mattressWidth={mattressWidth} />
    </group>
  );
}

function useDuskTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const sky = ctx.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, "#26324a");
    sky.addColorStop(0.55, "#7f6f78");
    sky.addColorStop(0.78, "#d9a47a");
    sky.addColorStop(1, "#e9b98a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 512, 512);
    // Distant Milan rooftops with a few lit windows.
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    ctx.fillStyle = "#2b2626";
    for (let x = 0; x < 512; ) {
      const w = 30 + rand() * 60;
      const h = 70 + rand() * 120;
      ctx.fillRect(x, 512 - h, w + 1, h);
      if (rand() > 0.6) ctx.fillRect(x + w * 0.3, 512 - h - 30, 8, 30);
      for (let i = 0; i < 6; i += 1) {
        if (rand() > 0.55) {
          ctx.fillStyle = "#f0c27e";
          ctx.fillRect(x + 6 + rand() * (w - 14), 512 - h + 12 + rand() * (h - 24), 5, 7);
          ctx.fillStyle = "#2b2626";
        }
      }
      x += w;
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

function useArtTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 384;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#e8ddca";
    ctx.fillRect(0, 0, 768, 384);
    // A quiet abstract landscape: layered washes in ochre, sage and ink.
    const wash = (x: number, y: number, r: number, color: string, alpha: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 768, 384);
    };
    wash(220, 250, 260, "#c08a4e", 0.55);
    wash(520, 210, 240, "#7d8a6a", 0.5);
    wash(650, 300, 160, "#2f3a3c", 0.45);
    wash(120, 120, 140, "#d9b98a", 0.5);
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = "#2a2522";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, 270);
    ctx.bezierCurveTo(220, 200, 380, 310, 520, 240);
    ctx.bezierCurveTo(610, 200, 690, 230, 740, 210);
    ctx.stroke();
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

function Curtain({ position, width, height, pleats, sheer = false, seed = 1 }: {
  position: [number, number, number];
  width: number;
  height: number;
  pleats: number;
  sheer?: boolean;
  seed?: number;
}) {
  const geometry = useMemo(() => curtainGeometry(width, height, pleats, sheer ? 0.05 : 0.08, seed), [width, height, pleats, sheer, seed]);
  return (
    <mesh geometry={geometry} position={position} castShadow={!sheer} receiveShadow raycast={noRaycast}>
      {sheer ? (
        // Plain alpha, not physical transmission: transmission re-renders the
        // whole room every frame, which integrated GPUs cannot afford.
        <meshStandardMaterial color="#f4efe6" roughness={0.9} transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
      ) : (
        <Surface kind="linen" color="#bcae98" roughness={0.97} side={THREE.DoubleSide} />
      )}
    </mesh>
  );
}

/** Everything in the bedroom except the (interactive) bed. */
export function BedroomFurnishings() {
  const dusk = useDuskTexture();
  const art = useArtTexture();
  const { wallX, northZ, eastX, southZ } = BEDROOM;
  const roomW = eastX - wallX;
  const roomD = southZ - northZ;
  const windowW = WINDOW.x1 - WINDOW.x0;
  const windowH = WINDOW.head - WINDOW.sill;
  const windowX = (WINDOW.x0 + WINDOW.x1) / 2;
  const windowY = (WINDOW.sill + WINDOW.head) / 2;
  const frameZ = northZ - 0.06;

  return (
    <group>
      {/* Herringbone oak parquet and a wool rug under the bed. */}
      <mesh position={[(wallX + eastX) / 2, 0.006, (northZ + southZ) / 2]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[roomW, 0.012, roomD]} />
        <PBRMaterial set="parquet" roughness={0.9} />
      </mesh>
      <RoundedBox args={[3.0, 0.012, 2.6]} radius={0.004} smoothness={2} position={[-4.45, 0.018, BED_Z]} receiveShadow raycast={noRaycast}>
        <Surface kind="rug" color="#6f5f4f" roughness={1} />
      </RoundedBox>
      <RoundedBox args={[2.84, 0.012, 2.44]} radius={0.004} smoothness={2} position={[-4.45, 0.022, BED_Z]} receiveShadow raycast={noRaycast}>
        <Surface kind="rug" color="#d3c6b2" roughness={1} />
      </RoundedBox>

      {/* Window: bronze frame, mullion, glass, and a dusk view of the city. */}
      <mesh position={[windowX, windowY, northZ - 0.42]} raycast={noRaycast}>
        <planeGeometry args={[windowW + 1.2, windowH + 0.9]} />
        <meshBasicMaterial map={dusk} toneMapped={false} />
      </mesh>
      {[WINDOW.x0 + 0.02, WINDOW.x1 - 0.02, windowX].map((x, i) => (
        <mesh key={x} position={[x, windowY, frameZ]} raycast={noRaycast}>
          <boxGeometry args={[i === 2 ? 0.03 : 0.045, windowH, 0.06]} />
          <Surface kind="brass" color="#4e3e2e" roughness={0.42} metalness={0.8} />
        </mesh>
      ))}
      {[WINDOW.sill + 0.02, WINDOW.head - 0.02].map((y) => (
        <mesh key={y} position={[windowX, y, frameZ]} raycast={noRaycast}>
          <boxGeometry args={[windowW, 0.045, 0.06]} />
          <Surface kind="brass" color="#4e3e2e" roughness={0.42} metalness={0.8} />
        </mesh>
      ))}
      <mesh position={[windowX, windowY, frameZ - 0.01]} raycast={noRaycast}>
        <planeGeometry args={[windowW - 0.06, windowH - 0.06]} />
        <meshPhysicalMaterial color="#c9d4d2" roughness={0.03} metalness={0.05} transparent opacity={0.14} envMapIntensity={1.5} depthWrite={false} />
      </mesh>
      <mesh position={[windowX, WINDOW.sill - 0.015, northZ + 0.05]} castShadow raycast={noRaycast}>
        <boxGeometry args={[windowW + 0.1, 0.03, 0.14]} />
        <Surface kind="marble" color="#e4dccd" roughness={0.3} />
      </mesh>

      {/* Curtain rod, full-height drapes stacked at the sides, a drawn sheer. */}
      <mesh position={[(WINDOW.x0 - 0.45 + WINDOW.x1 + 0.27) / 2, 2.86, northZ + 0.16]} rotation={[0, 0, Math.PI / 2]} raycast={noRaycast}>
        <cylinderGeometry args={[0.013, 0.013, windowW + 0.78, 12]} />
        <Surface kind="brass" color="#c9a36a" roughness={0.3} metalness={0.9} />
      </mesh>
      <Curtain position={[WINDOW.x0 - 0.22, 0.03, northZ + 0.16]} width={0.42} height={2.8} pleats={5} seed={2} />
      <Curtain position={[WINDOW.x1 + 0.135, 0.03, northZ + 0.16]} width={0.27} height={2.8} pleats={3} seed={4} />
      <Curtain position={[WINDOW.x0 + 0.42, 0.03, northZ + 0.1]} width={0.86} height={2.8} pleats={9} sheer seed={6} />

      {/* Reading corner by the window: lounge chair, pendant, plant. */}
      <Model name="loungeChair" position={[-3.85, 0.012, -3.5]} rotation={[0, 0.45, 0]} />
      <Model name="pendant" position={[-3.95, 2.1, -3.65]} castShadow={false} />
      <pointLight position={[-3.95, 2.45, -3.65]} intensity={1.4} distance={3.4} decay={2} color="#ffbf80" />
      <Model name="plant" position={[-5.3, 0.012, -3.98]} rotation={[0, 0.8, 0]} />

      {/* Walnut wardrobe: three flush doors, shadow-gap plinth, brass pulls. */}
      <group position={[-2.03, 0, northZ + 0.3]}>
        <mesh position={[0, 0.05, 0.02]} raycast={noRaycast}>
          <boxGeometry args={[1.6, 0.1, 0.52]} />
          <meshStandardMaterial color="#17110c" roughness={0.9} />
        </mesh>
        <RoundedBox args={[1.65, 2.25, 0.6]} radius={0.01} smoothness={2} position={[0, 1.225, 0]} castShadow receiveShadow raycast={noRaycast}>
          <PBRMaterial set="walnut" color="#d6bea2" roughness={0.85} />
        </RoundedBox>
        {[-0.275, 0.275].map((x) => (
          <mesh key={x} position={[x, 1.225, 0.301]} raycast={noRaycast}>
            <boxGeometry args={[0.005, 2.2, 0.004]} />
            <meshStandardMaterial color="#1a120c" roughness={0.9} />
          </mesh>
        ))}
        {[-0.3, 0.25, 0.8].map((x) => (
          <mesh key={x} position={[x - 0.27, 1.15, 0.315]} raycast={noRaycast}>
            <cylinderGeometry args={[0.007, 0.007, 0.5, 10]} />
            <Surface kind="brass" color="#c9a36a" roughness={0.28} metalness={0.92} />
          </mesh>
        ))}
        <Model name="vaseTall" position={[-0.45, 2.35, 0.05]} castShadow={false} />
        <Model name="vaseRound" position={[0.35, 2.35, 0]} scale={0.8} castShadow={false} />
      </group>

      {/* Full-length dressing mirror leaning on the east wall. */}
      <group position={[eastX - 0.09, 0, -3.42]} rotation={[0, -Math.PI / 2, 0]}>
        <group rotation={[-0.08, 0, 0]}>
          <RoundedBox args={[0.56, 1.8, 0.03]} radius={0.012} smoothness={3} position={[0, 0.92, 0]} castShadow raycast={noRaycast}>
            <Surface kind="brass" color="#b8925c" roughness={0.3} metalness={0.9} />
          </RoundedBox>
          <mesh position={[0, 0.92, 0.017]} raycast={noRaycast}>
            <planeGeometry args={[0.5, 1.74]} />
            <meshStandardMaterial color="#dfe4e3" metalness={1} roughness={0.03} envMapIntensity={1.4} />
          </mesh>
        </group>
      </group>

      {/* Slim wall-mounted TV facing the bed. */}
      <group position={[eastX - 0.03, 1.12, -2.5]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh castShadow raycast={noRaycast}>
          <boxGeometry args={[1.12, 0.65, 0.028]} />
          <meshStandardMaterial color="#141516" roughness={0.45} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.0145]} raycast={noRaycast}>
          <planeGeometry args={[1.1, 0.63]} />
          <meshPhysicalMaterial color="#05080b" roughness={0.08} metalness={0.2} clearcoat={1} clearcoatRoughness={0.05} envMapIntensity={1.2} />
        </mesh>
      </group>

      {/* Writing desk on the east wall: walnut top on a brass frame. */}
      <group position={[eastX - 0.29, 0, -0.6]} rotation={[0, -Math.PI / 2, 0]}>
        <RoundedBox args={[1.05, 0.035, 0.55]} radius={0.008} smoothness={2} position={[0, 0.745, 0]} castShadow receiveShadow raycast={noRaycast}>
          <PBRMaterial set="walnut" color="#d6bea2" roughness={0.8} />
        </RoundedBox>
        <mesh position={[0, 0.69, -0.18]} castShadow raycast={noRaycast}>
          <boxGeometry args={[0.7, 0.08, 0.16]} />
          <PBRMaterial set="walnut" color="#c8ae90" roughness={0.85} />
        </mesh>
        {[-0.5, 0.5].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            {[-0.24, 0.24].map((z) => (
              <mesh key={z} position={[0, 0.365, z]} castShadow raycast={noRaycast}>
                <boxGeometry args={[0.016, 0.73, 0.016]} />
                <Surface kind="brass" color="#b8925c" roughness={0.32} metalness={0.9} />
              </mesh>
            ))}
            <mesh position={[0, 0.02, 0]} raycast={noRaycast}>
              <boxGeometry args={[0.016, 0.016, 0.5]} />
              <Surface kind="brass" color="#b8925c" roughness={0.32} metalness={0.9} />
            </mesh>
          </group>
        ))}
        <mesh position={[0.05, 0.766, 0.05]} raycast={noRaycast}>
          <boxGeometry args={[0.5, 0.006, 0.34]} />
          <Surface kind="satin" color="#3a2a20" roughness={0.6} />
        </mesh>
        <BedsideLamp position={[-0.38, 0.763, -0.14]} scale={0.9} light={false} />
        <Model name="vaseTall" position={[0.4, 0.763, -0.16]} scale={0.7} castShadow={false} />
      </group>
      <Model name="deskChair" position={[eastX - 0.82, 0.012, -0.55]} rotation={[0, Math.PI / 2 + 0.15, 0]} />

      {/* Ottoman bench at the foot of the bed. */}
      <Model name="ottoman" position={[BED_HEAD_X + BED_LENGTH + 0.48, 0.012, BED_Z]} rotation={[0, Math.PI / 2, 0]} />

      {/* Framed artwork above the headboard. */}
      <group position={[wallX + 0.03, 1.98, BED_Z]} rotation={[0, Math.PI / 2, 0]}>
        <RoundedBox args={[1.34, 0.6, 0.035]} radius={0.006} smoothness={2} castShadow raycast={noRaycast}>
          <PBRMaterial set="walnut" color="#5d4636" roughness={0.8} />
        </RoundedBox>
        <mesh position={[0, 0, 0.019]} raycast={noRaycast}>
          <planeGeometry args={[1.24, 0.5]} />
          <meshStandardMaterial map={art} roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}
