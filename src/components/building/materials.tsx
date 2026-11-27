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

// ---- Foliage: painted leaf sprites on alpha-cut cards ----------------------

type LeafKind = "olive" | "box";
const leafTextures = new Map<LeafKind, THREE.CanvasTexture>();

/**
 * A twig of leaves painted on a transparent canvas. Olive: narrow, lance-
 * shaped leaves, grey-green above with silvery undersides. Box: small, dense,
 * glossy oval leaves. Each leaf gets its own shade and a midrib.
 */
function leafTexture(kind: LeafKind) {
  const cached = leafTextures.get(kind);
  if (cached) return cached;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  let seed = kind === "olive" ? 11 : 29;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const olive = kind === "olive";
  const tops = olive ? ["#5d6b51", "#6a785b", "#55634a", "#768567"] : ["#3f5c2c", "#4a6a33", "#355026", "#56763b"];
  const unders = olive ? ["#98a491", "#a7b19f", "#8e9a87"] : ["#5f7c43", "#6b8a4c"];

  // Twig through the middle.
  ctx.strokeStyle = olive ? "#5a4a3a" : "#4a3b2c";
  ctx.lineWidth = olive ? 3 : 2.5;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.98);
  ctx.quadraticCurveTo(size * 0.46, size * 0.55, size * 0.52, size * 0.06);
  ctx.stroke();

  const leaves = olive ? 22 : 40;
  for (let i = 0; i < leaves; i += 1) {
    const t = i / leaves;
    const along = size * (0.95 - t * 0.85);
    const side = i % 2 ? 1 : -1;
    const angle = side * (olive ? 0.55 + rand() * 0.35 : 0.4 + rand() * 0.9) - Math.PI / 2;
    const length = olive ? size * (0.2 + rand() * 0.08) * (1 - t * 0.25) : size * (0.075 + rand() * 0.03);
    const width = olive ? length * 0.26 : length * 0.62;
    const cx = size * 0.5 + Math.cos(angle) * length * 0.5 + (olive ? 0 : (rand() - 0.5) * size * 0.18);
    const cy = along + Math.sin(angle) * length * 0.5;
    const under = rand() < (olive ? 0.35 : 0.15);
    const palette = under ? unders : tops;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(-length / 2, 0, length / 2, 0);
    const base = palette[Math.floor(rand() * palette.length)];
    g.addColorStop(0, base);
    g.addColorStop(1, palette[(palette.indexOf(base) + 1) % palette.length]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, length / 2, width / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Midrib and a hint of gloss.
    ctx.strokeStyle = "rgba(230, 235, 210, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-length / 2 + 2, 0);
    ctx.lineTo(length / 2 - 2, 0);
    ctx.stroke();
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  leafTextures.set(kind, texture);
  return texture;
}

const leafDepthMaterials = new Map<LeafKind, THREE.MeshDepthMaterial>();

/** Depth material for shadow maps, so leaves cast leaf-shaped shadows. */
export function leafDepthMaterial(part: ExteriorPart) {
  const kind: LeafKind | null = part === "leafOlive" ? "olive" : part === "leafBox" ? "box" : null;
  if (!kind) return undefined;
  let material = leafDepthMaterials.get(kind);
  if (!material) {
    material = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafTexture(kind), alphaTest: 0.5 });
    leafDepthMaterials.set(kind, material);
  }
  return material;
}

function Leaves({ kind, state }: { kind: LeafKind; state: LevelState }) {
  const color = useTone("#ffffff", state);
  return (
    <meshStandardMaterial
      map={leafTexture(kind)}
      color={color}
      alphaTest={0.5}
      side={THREE.DoubleSide}
      roughness={kind === "olive" ? 0.78 : 0.55}
      metalness={0}
    />
  );
}

/** One material per exterior part key; `state` dims or lifts a whole storey. */
export function ExteriorMaterial({ part, state }: { part: ExteriorPart; state: LevelState }) {
  switch (part) {
    case "travertine":
      return <SurfacePart kind="travertineCladding" hex="#dccfb6" state={state} roughness={0.72} />;
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
      return <SurfacePart kind="foliage" hex="#2a3322" state={state} roughness={0.95} />;
    case "bark":
      return <SurfacePart kind="walnut" hex="#4d3d2e" state={state} roughness={0.85} />;
    case "planter":
      return <SurfacePart kind="concrete" hex="#7f796f" state={state} roughness={0.85} />;
    case "paving":
      return <SurfacePart kind="stonePaving" hex="#9a9080" state={state} roughness={0.82} />;
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
    case "leafOlive":
      return <Leaves kind="olive" state={state} />;
    case "leafBox":
      return <Leaves kind="box" state={state} />;
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
  "leafOlive",
  "leafBox",
  "foliageShade",
]);
