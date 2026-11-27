import {
  extend,
  useFrame,
  useThree,
  type BufferGeometryNode,
  type MeshPhysicalMaterialProps,
  type MeshStandardMaterialProps,
} from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { BevelBoxGeometry } from "./geometry";
import { getSurface, projectSurfaceUVs, type SurfaceKind } from "./surfaces";

export type { SurfaceKind } from "./surfaces";
export { BevelBoxGeometry } from "./geometry";

// ---------------------------------------------------------------------------

extend({ BevelBoxGeometry });

declare module "@react-three/fiber" {
  interface ThreeElements {
    bevelBoxGeometry: BufferGeometryNode<BevelBoxGeometry, typeof BevelBoxGeometry>;
  }
}

// ---------------------------------------------------------------------------

type SurfaceProps = Omit<MeshPhysicalMaterialProps, "map" | "normalMap" | "roughnessMap"> & {
  kind: SurfaceKind;
  /** Use MeshPhysicalMaterial (clearcoat, sheen, etc.). */
  physical?: boolean;
  /** Multiplies the real-world texture tile size. */
  textureScale?: number;
  /** Multiplies the kind's default normal-map strength. */
  relief?: number;
};

/**
 * A PBR material backed by a procedural texture set. `color` and `roughness`
 * keep their usual meaning: the maps add detail around those averages.
 */
export function Surface({
  kind,
  physical = false,
  textureScale = 1,
  relief = 1,
  color = "#ffffff",
  roughness = 0.8,
  ...rest
}: SurfaceProps) {
  const surface = getSurface(kind, textureScale);
  const key = `surface|${kind}|${physical}|${textureScale}|${relief}|${materialKey(color)}|${roughness}|${materialKey(rest)}`;
  // Identical surfaces share one material instance: fewer GPU state changes,
  // and it lets <StaticBatch> merge meshes that use the same finish.
  const material = useMemo(
    () =>
      sharedMaterial(key, () => {
        const created = physical ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
        created.setValues({
          map: surface.map,
          normalMap: surface.normalMap,
          roughnessMap: surface.roughnessMap,
          normalScale: new THREE.Vector2(relief, relief),
          color: new THREE.Color(color as THREE.ColorRepresentation).multiplyScalar(1 / surface.albedoMean),
          roughness: (roughness as number) / surface.roughMean,
          ...(rest as THREE.MeshPhysicalMaterialParameters),
        });
        return created;
      }),
    [key],
  );
  return <primitive object={material} attach="material" />;
}

// ---------------------------------------------------------------------------
// Shared material cache.

const materialCache = new Map<string, THREE.Material>();

/** Returns the cached material for `key`, creating it once. Never disposed. */
export function sharedMaterial<T extends THREE.Material>(key: string, create: () => T): T {
  let material = materialCache.get(key) as T | undefined;
  if (!material) {
    material = create();
    materialCache.set(key, material);
  }
  return material;
}

/** Stable string for material parameters (colours, numbers, strings, flags). */
export function materialKey(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === "object" && (v as THREE.Color).isColor) {
      const c = v as THREE.Color;
      return `rgb(${c.r.toFixed(5)},${c.g.toFixed(5)},${c.b.toFixed(5)})`;
    }
    if (v && typeof v === "object" && (v as THREE.Texture).isTexture) return `tex:${(v as THREE.Texture).uuid}`;
    return v;
  }) ?? "";
}

/**
 * Keeps textured meshes mapped at scene scale. Place once inside a Canvas.
 * New geometries (remounts, changed args) are picked up on the next frame.
 */
export function SurfaceUVs() {
  const scene = useThree((state) => state.scene);
  useFrame(() => {
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || mesh.geometry?.userData.surfaceUV) return;
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const map = (material as THREE.MeshStandardMaterial | undefined)?.map;
      if (map?.userData.surface) projectSurfaceUVs(mesh);
    });
  }, -1);
  return null;
}
