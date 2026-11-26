import { useMemo } from "react";
import * as THREE from "three";
import { Surface } from "../../three/Surface";
import type { ExteriorPart } from "./architecture";

/** The exterior is modelled at ~1:3.2, so real-world texture tiles scale down. */
const EXTERIOR_SCALE = 0.31;

export type LevelState = "normal" | "dim" | "active";

function useTone(hex: string, state: LevelState, dim = 0.58) {
  return useMemo(() => {
    const k = state === "dim" ? dim : state === "active" ? 1.07 : 1;
    return new THREE.Color(hex).multiplyScalar(k);
  }, [hex, state, dim]);
}

function SurfacePart({
  kind,
  hex,
  state,
  roughness,
  metalness = 0,
}: {
  kind: Parameters<typeof Surface>[0]["kind"];
  hex: string;
  state: LevelState;
  roughness: number;
  metalness?: number;
}) {
  const color = useTone(hex, state);
  return (
    <Surface
      kind={kind}
      textureScale={EXTERIOR_SCALE}
      color={color}
      roughness={roughness}
      metalness={metalness}
    />
  );
}

function Glass({ opacity }: { opacity: number }) {
  return (
    <meshPhysicalMaterial
      color="#a9b8b6"
      roughness={0.04}
      metalness={0.12}
      transparent
      opacity={opacity}
      envMapIntensity={1.9}
      side={THREE.DoubleSide}
      depthWrite={false}
    />
  );
}

function Interior({ state }: { state: LevelState }) {
  const color = useTone("#ffffff", state, 0.7);
  return <meshBasicMaterial vertexColors color={color} side={THREE.DoubleSide} />;
}

function Drape({ state }: { state: LevelState }) {
  const color = useTone("#e8dece", state);
  return (
    <Surface
      kind="linen"
      textureScale={EXTERIOR_SCALE}
      color={color}
      roughness={0.95}
      emissive="#7a5832"
      emissiveIntensity={0.24}
      side={THREE.DoubleSide}
    />
  );
}

/** One material per exterior part key; `state` dims or lifts a whole storey. */
export function ExteriorMaterial({ part, state }: { part: ExteriorPart; state: LevelState }) {
  switch (part) {
    case "travertine":
      return <SurfacePart kind="travertine" hex="#dccfb6" state={state} roughness={0.72} />;
    case "granite":
      return <SurfacePart kind="limestone" hex="#5a554d" state={state} roughness={0.48} metalness={0.04} />;
    case "concrete":
      return <SurfacePart kind="concrete" hex="#b6b0a5" state={state} roughness={0.88} />;
    case "bronze":
      return <SurfacePart kind="brass" hex="#5c4733" state={state} roughness={0.4} metalness={0.82} />;
    case "brass":
      return <SurfacePart kind="brass" hex="#caa56b" state={state} roughness={0.28} metalness={0.92} />;
    case "deck":
      return <SurfacePart kind="oak" hex="#806247" state={state} roughness={0.74} />;
    case "walnut":
      return <SurfacePart kind="walnut" hex="#6a4b34" state={state} roughness={0.55} />;
    case "foliage":
      return <SurfacePart kind="foliage" hex="#58693f" state={state} roughness={0.86} />;
    case "foliageLight":
      return <SurfacePart kind="foliage" hex="#74805a" state={state} roughness={0.86} />;
    case "foliageShade":
      return <SurfacePart kind="foliage" hex="#46543b" state={state} roughness={0.9} />;
    case "bark":
      return <SurfacePart kind="walnut" hex="#4d3d2e" state={state} roughness={0.85} />;
    case "planter":
      return <SurfacePart kind="concrete" hex="#7f796f" state={state} roughness={0.85} />;
    case "paving":
      return <SurfacePart kind="limestone" hex="#8f8676" state={state} roughness={0.82} />;
    case "glass":
      return <Glass opacity={0.34} />;
    case "railGlass":
      return <Glass opacity={0.2} />;
    case "interior":
      return <Interior state={state} />;
    case "drape":
      return <Drape state={state} />;
    case "light":
      return <meshStandardMaterial color="#fff1d6" emissive="#ffc27a" emissiveIntensity={2.4} />;
  }
}

/** Parts that cast and receive shadows (glass, glow and lights do not). */
export const SHADOW_PARTS = new Set<ExteriorPart>([
  "travertine",
  "granite",
  "concrete",
  "bronze",
  "brass",
  "deck",
  "walnut",
  "foliage",
  "bark",
  "planter",
  "paving",
]);
