import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { HotelFloor } from "../data/floors";
import { Surface, SurfaceUVs } from "../three/Surface";
import { Model, preloadModels } from "../three/assets";
import { preloadPBR } from "../three/pbr";
import { StaticBatch, StaticContactShadows, StaticShadowMap } from "../three/performance";
import { BED_CENTER, BedroomDesk, BedroomFurnishings, DESK_POSITION, PlacedBed, WINDOW, mattressWidthFor } from "./interior/Bedroom";
import {
  Bathroom,
  Dining,
  FEATURE_ANCHORS,
  Foyer,
  Living,
  PantryBar,
  PenthouseShell,
  ResidenceShell,
  Washroom,
  paletteFor,
} from "./interior/Apartment";
import {
  PENTHOUSE_LIVING,
  PenthouseKitchen,
  PenthouseLiving,
  PenthouseTerrace,
  TERRACE_CENTER,
  TerraceGlazing,
} from "./interior/Penthouse";
import { Banquette, ChefTable, MarbleBar, TAVOLA, TavolaDining, TavolaLighting, WineCellar } from "./interior/Tavola";
import {
  LOUNGE_CENTER,
  LobbyArchitecture,
  LobbyArtwork,
  LobbyDecor,
  LobbyLighting,
  LobbyLounge,
  ReceptionDesk,
} from "./interior/Lobby";

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
    { id: "tavola-chef", name: "The chef's table", note: "Twelve seats around one long Calacatta marble table, set with brass chargers and crystal under twin chandeliers." },
    { id: "tavola-banquette", name: "The velvet banquette", note: "Channel-tufted emerald velvet along bronze mirrors: intimate tables for two, lit by brass sconces." },
    { id: "tavola-bar", name: "The marble bar", note: "A fluted walnut bar with a waterfall marble top, backlit onyx and the evening's aperitivo." },
    { id: "tavola-cellar", name: "The wine cellar", note: "A glass-fronted cellar of over two hundred bottles, from Barolo to Franciacorta, kept at a steady 14°C." },
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

function FloorSurface({ livingRug = true }: { livingRug?: boolean }) {
  return (
    <group>
      <mesh position={[0, -0.13, 0]} receiveShadow>
        <bevelBoxGeometry args={[13, 0.25, 9.2]} />
        <Surface kind="oak"
          color="#927a5a"
          roughness={0.78}
        />
      </mesh>
      {livingRug && <group position={[1.8, 0.012, 0.65]} receiveShadow>
        <mesh receiveShadow>
          <bevelBoxGeometry args={[4.8, 0.025, 3.4]} />
          <Surface kind="rug" color="#17394b" roughness={0.94} />
        </mesh>
        <mesh position={[0, 0.015, 0]} receiveShadow>
          <bevelBoxGeometry args={[4.7, 0.012, 3.3]} />
          <Surface kind="rug" color="#c99d54" roughness={0.68} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.026, 0]} receiveShadow>
          <bevelBoxGeometry args={[4.58, 0.012, 3.18]} />
          <Surface kind="rug"
            color="#c4b69f"
            roughness={0.98}
          />
        </mesh>
        {[-2.16, 2.16].map((x) => (
          <mesh key={`carpet-side-border-${x}`} position={[x, 0.035, 0]}>
            <bevelBoxGeometry args={[0.035, 0.006, 2.78]} />
            <Surface kind="rug" color="#17394b" roughness={0.92} />
          </mesh>
        ))}
        {[-1.36, 1.36].map((z) => (
          <mesh key={`carpet-end-border-${z}`} position={[0, 0.035, z]}>
            <bevelBoxGeometry args={[4.35, 0.006, 0.035]} />
            <Surface kind="rug" color="#17394b" roughness={0.92} />
          </mesh>
        ))}
        {[-2.06, 2.06].map((x) => (
          <mesh key={`carpet-gold-side-${x}`} position={[x, 0.039, 0]}>
            <bevelBoxGeometry args={[0.012, 0.004, 2.62]} />
            <Surface kind="rug" color="#c99d54" roughness={0.55} metalness={0.18} />
          </mesh>
        ))}
        {[-1.26, 1.26].map((z) => (
          <mesh key={`carpet-gold-end-${z}`} position={[0, 0.039, z]}>
            <bevelBoxGeometry args={[4.1, 0.004, 0.012]} />
            <Surface kind="rug" color="#c99d54" roughness={0.55} metalness={0.18} />
          </mesh>
        ))}
        <group position={[0, 0.042, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.3, 0.34, 48]} />
            <Surface kind="rug" color="#c99d54" roughness={0.55} metalness={0.18} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.17, 0.19, 40]} />
            <Surface kind="rug" color="#17394b" roughness={0.92} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.1, 32]} />
            <Surface kind="rug" color="#c99d54" roughness={0.55} metalness={0.18} />
          </mesh>
          {[-1, 1].flatMap((side) =>
            [-1, 1].map((depthSide) => (
              <mesh
                key={`${side}-${depthSide}`}
                position={[side * 1.9, 0.002, depthSide * 1.12]}
                rotation={[0, Math.PI / 4, 0]}
              >
                <bevelBoxGeometry args={[0.16, 0.004, 0.16]} />
                <Surface kind="rug" color="#c99d54" roughness={0.55} metalness={0.18} />
              </mesh>
            )),
          )}
        </group>
      </group>}
    </group>
  );
}

function RoomShell({ residence = false }: { residence?: boolean }) {
  return (
    <group>
      <FloorSurface livingRug={false} />
      <mesh position={[-6.15, 1.18, 0]} receiveShadow>
        <bevelBoxGeometry args={[0.22, 2.36, 9.1]} />
        <Surface kind="plaster" color="#9a8c74" roughness={0.92} />
      </mesh>
      <mesh position={[6.15, 0.82, -1.7]} receiveShadow>
        <bevelBoxGeometry args={[0.2, 0.72, 5.7]} />
        <Surface kind="plaster"
          color="#95866e"
          roughness={0.92}
        />
      </mesh>
      {residence ? (
        // North bedroom wall, opened for a window (see interior/Bedroom).
        [
          { x: (-6.15 + WINDOW.x0) / 2, y: 1.65, w: WINDOW.x0 + 6.15, h: 3.3 },
          { x: (WINDOW.x1 - 1.65) / 2, y: 1.65, w: -1.65 - WINDOW.x1, h: 3.3 },
          { x: (WINDOW.x0 + WINDOW.x1) / 2, y: WINDOW.sill / 2, w: WINDOW.x1 - WINDOW.x0, h: WINDOW.sill },
          { x: (WINDOW.x0 + WINDOW.x1) / 2, y: (WINDOW.head + 3.3) / 2, w: WINDOW.x1 - WINDOW.x0, h: 3.3 - WINDOW.head },
        ].map(({ x, y, w, h }) => (
          <mesh key={`${x}:${y}`} position={[x, y, -4.45]} receiveShadow castShadow>
            <bevelBoxGeometry args={[w, h, 0.18]} />
            <Surface kind="plaster" color="#a0927a" roughness={0.92} />
          </mesh>
        ))
      ) : (
        <mesh position={[-3.9, 1.65, -4.45]} receiveShadow>
          <bevelBoxGeometry args={[4.5, 3.3, 0.18]} />
          <Surface kind="plaster" color="#a0927a" roughness={0.92} />
        </mesh>
      )}
      <mesh position={[4.15, 1.65, -4.45]} receiveShadow>
        <bevelBoxGeometry args={[3.9, 3.3, 0.18]} />
        <Surface kind="plaster" color="#a0927a" roughness={0.92} />
      </mesh>
      <mesh position={[0.1, 0.36, -4.39]} receiveShadow>
        <bevelBoxGeometry args={[3.45, 0.68, 0.22]} />
        <Surface kind="plaster" color="#d2c7b7" roughness={0.92} />
      </mesh>
      <mesh position={[0.1, 1.97, -4.47]} castShadow receiveShadow>
        <bevelBoxGeometry args={[3.35, 2.55, 0.055]} />
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
          <bevelBoxGeometry args={[0.045, 2.6, 0.075]} />
          <Surface kind="brass" color="#9d805c" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0.1, 3.27, -4.41]}>
        <bevelBoxGeometry args={[3.35, 0.05, 0.075]} />
        <Surface kind="brass" color="#9d805c" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[-6.005, 0.14, 0]}>
        <bevelBoxGeometry args={[0.065, 0.2, 8.95]} />
        <Surface kind="brass" color="#a98b63" roughness={0.4} metalness={0.22} />
      </mesh>
      <mesh position={[6.02, 0.14, -1.7]}>
        <bevelBoxGeometry args={[0.065, 0.2, 5.55]} />
        <Surface kind="brass" color="#a98b63" roughness={0.4} metalness={0.22} />
      </mesh>
      {[-3.9, 4.15].map((x, index) => (
        <mesh key={x} position={[x, 0.14, -4.32]}>
          <bevelBoxGeometry args={[index ? 3.82 : 4.42, 0.2, 0.065]} />
          <Surface kind="brass" color="#a98b63" roughness={0.4} metalness={0.22} />
        </mesh>
      ))}
      <mesh position={[-6.005, 3.12, 0]}>
        <bevelBoxGeometry args={[0.08, 0.12, 8.95]} />
        <Surface kind="plaster" color="#c5b69d" roughness={0.82} />
      </mesh>
      <mesh position={[6.02, 1.2, -1.7]}>
        <bevelBoxGeometry args={[0.08, 0.12, 5.55]} />
        <Surface kind="plaster" color="#c5b69d" roughness={0.82} />
      </mesh>
    </group>
  );
}

function BedroomPartition() {
  return (
    <group>
      {[{ z: -3.2, length: 2.4 }, { z: -0.6, length: 1 }].map(({ z, length }) => (
        <mesh key={z} position={[-1.05, 0.82, z]} castShadow receiveShadow>
          <bevelBoxGeometry args={[0.16, 1.64, length]} />
          <Surface kind="plaster" color="#95866e" roughness={0.92} />
        </mesh>
      ))}
      <mesh position={[-1.05, 1.62, -1.95]}>
        <bevelBoxGeometry args={[0.14, 0.08, 0.42]} />
        <Surface kind="brass" color="#a68960" roughness={0.35} metalness={0.45} />
      </mesh>
      <mesh position={[-3.6, 0.48, 0.28]} castShadow receiveShadow>
        <bevelBoxGeometry args={[5, 0.96, 0.16]} />
        <Surface kind="plaster" color="#95866e" roughness={0.92} />
      </mesh>
      <mesh position={[-3.6, 0.98, 0.22]}>
        <bevelBoxGeometry args={[5.02, 0.08, 0.16]} />
        <Surface kind="brass" color="#9e845e" roughness={0.38} metalness={0.42} />
      </mesh>
      {/* Bedroom door: a full-height walnut leaf hinged at the north jamb of
          the opening (z −2.0 … −1.1), swung open into the bedroom. */}
      <group position={[-1.05, 0, -1.98]} rotation={[0, -1.15, 0]}>
        <mesh position={[0, 1.0, 0.44]} castShadow receiveShadow>
          <bevelBoxGeometry args={[0.045, 2.0, 0.86]} />
          <Surface kind="walnut" color="#513219" roughness={0.48} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.04, 1.0, 0.78]} castShadow>
            <bevelBoxGeometry args={[0.02, 0.32, 0.02]} />
            <Surface kind="brass" color="#c9a36a" roughness={0.25} metalness={0.9} />
          </mesh>
        ))}
      </group>
      <mesh position={[-5.96, 0.08, -1.78]} receiveShadow>
        <bevelBoxGeometry args={[0.08, 0.16, 4.65]} />
        <Surface kind="walnut" color="#9c886c" roughness={0.5} />
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
        <Surface kind="ceramic" physical color="#e7e0d3" roughness={0.24} metalness={0.04} clearcoat={0.32} />
      </mesh>
      <mesh position={[0, 0.425, 0]}>
        <torusGeometry args={[0.19, 0.018, 8, 28]} />
        <Surface kind="brass" color="#b6925e" roughness={0.32} metalness={0.62} />
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
              <Surface kind="foliage" color="#536449" roughness={0.9} />
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
                <Surface kind="foliage" color={leafIndex % 2 ? "#627451" : "#7d8964"} roughness={0.86} />
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
                    <Surface kind="foliage" physical color={flowerColor} roughness={0.58} clearcoat={0.12} />
                  </mesh>
                );
              })}
              <mesh position={[0, 0.025, 0]} castShadow>
                <sphereGeometry args={[0.045, 14, 12]} />
                <Surface kind="walnut" color="#c99d54" roughness={0.58} />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
}

function featureAnchor(id: string): [number, number, number] | undefined {
  if (id === "panoramic-lounge") return [PENTHOUSE_LIVING[0], 0.95, PENTHOUSE_LIVING[2]];
  if (id === "terrace") return [TERRACE_CENTER[0], 0.8, TERRACE_CENTER[2]];
  if (id === "writing-desk") return [DESK_POSITION[0], 0.9, DESK_POSITION[2]];
  if (id === "tavola-chef") return [TAVOLA.chef[0], 0.95, TAVOLA.chef[2]];
  if (id === "tavola-banquette") return [TAVOLA.banquette[0] + 0.6, 0.9, TAVOLA.banquette[2]];
  if (id === "tavola-bar") return [TAVOLA.bar[0], 1.1, TAVOLA.bar[2]];
  if (id === "tavola-cellar") return [TAVOLA.cellar[0], 1.5, TAVOLA.cellar[2] + 0.4];
  return FEATURE_ANCHORS[id];
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
    "lobby-lounge": LOUNGE_CENTER,
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
    "king-bed": BED_CENTER,
    "suite-bed": BED_CENTER,
    "canopy-bed": BED_CENTER,
    "penthouse-bed": BED_CENTER,
    "writing-desk": [4.6, 0, 3.05],
    "dining-table": [4.6, 0, 3.4],
    terrace: [5, 0, 2.3],
  };
  const interactive = {
    feature,
    active: activeFeature === feature.id,
    onSelect,
    indicatorPosition: ((): [number, number, number] => {
      const anchor = featureAnchor(feature.id);
      return anchor ? [anchor[0], 0, anchor[2]] : indicatorPositions[feature.id] ?? [0, 0, 0];
    })(),
  };

  if (feature.id === "reception-desk") {
    return (
      <Interactive {...interactive}>
        <Suspense fallback={null}>
          <ReceptionDesk />
        </Suspense>
      </Interactive>
    );
  }
  if (feature.id === "lobby-lounge") {
    return (
      <Interactive {...interactive}>
        <Suspense fallback={null}>
          <LobbyLounge />
        </Suspense>
      </Interactive>
    );
  }
  if (feature.id === "reception-flowers") {
    return (
      <Interactive {...interactive}>
        <FloralArrangement position={[-1.15, 1.125 - 0.2 * 0.72, -1.78]} scale={0.72} />
        <FloralArrangement position={[1.15, 1.125 - 0.2 * 0.72, -1.78]} scale={0.72} />
      </Interactive>
    );
  }
  if (feature.id === "lobby-artwork") {
    return (
      <Interactive {...interactive}>
        <Suspense fallback={null}>
          <LobbyArtwork />
        </Suspense>
      </Interactive>
    );
  }

  if (feature.id === "tavola-chef") {
    return (
      <Interactive {...interactive}>
        <ChefTable />
      </Interactive>
    );
  }
  if (feature.id === "tavola-banquette") {
    return (
      <Interactive {...interactive}>
        <Banquette />
      </Interactive>
    );
  }
  if (feature.id === "tavola-bar") {
    return (
      <Interactive {...interactive}>
        <MarbleBar />
      </Interactive>
    );
  }
  if (feature.id === "tavola-cellar") {
    return (
      <Interactive {...interactive}>
        <WineCellar />
      </Interactive>
    );
  }

  if (feature.id === "bathroom") {
    return (
      <Interactive {...interactive}>
        <group position={[4.1, 0, -2.8]}>
          <mesh position={[0, 0.9, 0]}>
            <bevelBoxGeometry args={[3.8, 1.8, 3.05]} />
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
            <bevelBoxGeometry args={[1.7, 1.6, 1.65]} />
            <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
          </mesh>
        </group>
      </Interactive>
    );
  }

  if (feature.name === "The living hall") {
    return (
      <Interactive {...interactive}>
        <Suspense fallback={null}>
          {floor.id === 5 ? <PenthouseLiving /> : <Living palette={paletteFor(floor.id)} />}
        </Suspense>
      </Interactive>
    );
  }

  if (feature.id.includes("bed")) {
    return (
      <Interactive {...interactive}>
        <Suspense fallback={null}>
          <PlacedBed mattressWidth={mattressWidthFor(floor.id)} />
        </Suspense>
      </Interactive>
    );
  }
  if (feature.id === "dining-table") {
    return (
      <Interactive {...interactive}>
        <Suspense fallback={null}>
          <Dining round={floor.id === 5} fabric={paletteFor(floor.id).chair} />
        </Suspense>
      </Interactive>
    );
  }
  if (feature.id === "writing-desk") {
    return (
      <Interactive {...interactive}>
        <Suspense fallback={null}>
          <BedroomDesk />
        </Suspense>
      </Interactive>
    );
  }

  if (feature.id === "terrace") {
    return (
      <Interactive {...interactive}>
        <Suspense fallback={null}>
          <PenthouseTerrace />
        </Suspense>
      </Interactive>
    );
  }

  return null;
}

function InteriorRoom({
  floor,
  resetSignal,
  selectedFeature,
  onFeatureSelect,
}: {
  floor: HotelFloor;
  resetSignal: number;
  selectedFeature: string | null;
  onFeatureSelect: (feature: InteriorFeature) => void;
}) {
  const features = FEATURES[floor.id] ?? FEATURES[0];
  const isLobby = floor.id === 0;
  const isTavola = floor.id === 1;
  useEffect(() => {
    if (isLobby) {
      preloadModels(["loungeChair", "ottoman", "mediaCabinet", "pendant", "plant", "vaseRound", "vaseTall"]);
      preloadPBR(["walnut", "wool"]);
      return;
    }
    preloadModels(["loungeChair", "deskChair", "ottoman", "pendant", "plant", "vaseRound", "vaseTall", "photoFrame"]);
    preloadPBR(["parquet", "wool", "walnut"]);
  }, [isLobby]);
  const isMobile = useThree((state) => state.size.width <= 640);
  const invalidate = useThree((state) => state.invalidate);
  const controls = useRef<OrbitControlsImpl | null>(null);
  const desiredTarget = useRef(new THREE.Vector3(0, 1.12, 0));
  const desiredCamera = useRef(
    new THREE.Vector3(9.5, 10.5, 11.5).multiplyScalar(isMobile ? 1.45 : 1),
  );
  const isAnimatingCamera = useRef(true);

  useEffect(() => {
    desiredCamera.current.set(9.5, 10.5, 11.5).multiplyScalar(isMobile ? 1.45 : 1);
    isAnimatingCamera.current = true;
    invalidate();
  }, [isMobile, invalidate]);

  // A new floor or "Reset view" returns to the default view immediately, as
  // the old per-floor canvas did, but keeps the GPU context, compiled shaders
  // and uploaded textures.
  useEffect(() => {
    desiredTarget.current.set(0, 1.12, 0);
    desiredCamera.current.set(9.5, 10.5, 11.5).multiplyScalar(isMobile ? 1.45 : 1);
    const c = controls.current;
    if (c) {
      c.target.copy(desiredTarget.current);
      c.object.position.copy(desiredCamera.current);
      c.update();
    }
    isAnimatingCamera.current = false;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor.id, resetSignal]);

  useFrame((state, delta) => {
    if (!isAnimatingCamera.current) return;
    state.invalidate();
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
      "lobby-lounge": [LOUNGE_CENTER[0], 1.05, LOUNGE_CENTER[2]],
      "reception-flowers": [0, 1.7, -1.7],
      "lobby-artwork": [0, 1.95, -4.1],
      lounge: [1.8, 0.95, 0.15],
      "olive-tree": [5, 1.2, 2.3],
      "chef-table": [1.8, 0.95, 0.15],
      "king-bed": [BED_CENTER[0], 0.85, BED_CENTER[2]],
      "reading-chair": [1.8, 0.95, 0.15],
      "writing-desk": [4.6, 0.9, 3.05],
      "suite-bed": [BED_CENTER[0], 0.85, BED_CENTER[2]],
      "lounge-sofa": [1.8, 0.95, 0.15],
      "canopy-bed": [BED_CENTER[0], 0.85, BED_CENTER[2]],
      "living-room": [1.8, 0.95, 0.15],
      "dining-table": [4.6, 0.95, 3.4],
      "penthouse-bed": [BED_CENTER[0], 0.85, BED_CENTER[2]],
      "panoramic-lounge": [1.8, 0.95, 0.15],
      bathroom: [3.9, 1.1, -2.8],
      toilet: [5, 0.9, -0.2],
      terrace: [5, 1.2, 2.3],
    };
    const [x, y, z] = featureAnchor(feature.id) ?? focusPoints[feature.id] ?? [0, 1.1, 0];
    desiredTarget.current.set(x, y, z);
    desiredCamera.current.set(x + 3.6, y + 2.1, z + 4.5);
    isAnimatingCamera.current = true;
    invalidate();
  };

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", isMobile ? 24 : 15, isMobile ? 48 : 28]} />
      <ambientLight intensity={isMobile ? 1 : 0.72} color="#fff4df" />
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
      <StaticBatch key={`static-${floor.id}`}>
      <RoomShell residence={!isLobby && !isTavola} />
      {isTavola ? (
        <Suspense fallback={null}>
          <TavolaDining />
          <TavolaLighting />
        </Suspense>
      ) : isLobby ? (
        <>
          <Suspense fallback={null}>
            <LobbyArchitecture />
          </Suspense>
          <LobbyLighting />
          <Suspense fallback={null}>
            <LobbyDecor />
          </Suspense>
        </>
      ) : (
        <>
          <BedroomPartition />
          <Suspense fallback={null}>
            {floor.id === 5 ? <PenthouseShell /> : <ResidenceShell />}
          </Suspense>
          <Suspense fallback={null}>
            <Bathroom />
            <Washroom />
          </Suspense>
          <Suspense fallback={null}>
            {floor.id === 5 ? (
              <>
                <PenthouseKitchen />
                <TerraceGlazing />
              </>
            ) : (
              <>
                <Foyer />
                <PantryBar />
              </>
            )}
            {!features.some((f) => f.id === "dining-table") && (
              <Dining round={floor.id === 5} fabric={paletteFor(floor.id).chair} />
            )}
          </Suspense>
          <Suspense fallback={null}>
            <BedroomFurnishings withDesk={!features.some((f) => f.id === "writing-desk")} />
          </Suspense>
        </>
      )}
      </StaticBatch>
      {features.map((feature) => (
        <FeatureObject
          key={feature.id}
          floor={floor}
          feature={feature}
          activeFeature={selectedFeature}
          onSelect={focusFeature}
        />
      ))}
      <StaticShadowMap />
      <StaticContactShadows
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
      shadows
      frameloop="demand"
      dpr={[1, 1.4]}
      camera={{ position: [9.5, 10.5, 11.5], fov: 40, near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl, camera, size }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = size.width <= 640 ? 1.2 : 1.16;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = size.width <= 640 ? 46 : 40;
          camera.updateProjectionMatrix();
        }
      }}
    >
      <SurfaceUVs />
      <InteriorRoom
        floor={floor}
        resetSignal={resetSignal}
        selectedFeature={selectedFeature}
        onFeatureSelect={handleFeatureSelect}
      />
    </Canvas>
  );
}
