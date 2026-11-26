import { useTexture } from "@react-three/drei";
import type { MeshStandardMaterialProps } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { IS_MOBILE } from "./assets";

// Photographic CC0 PBR texture sets (Poly Haven, see assets manifest):
// base colour, OpenGL normal, roughness and ambient occlusion. `size` is the
// real-world width one texture covers, in metres, so with scene-unit UVs
// (see <SurfaceUVs>) every surface is mapped at true scale.

const SETS = {
  parquet: { dir: "/textures/wood/herringbone_parquet", size: 3.4 },
  plaster: { dir: "/textures/plaster/plastered_wall_04", size: 3.2 },
  wool: { dir: "/textures/fabric/poly_wool_herringbone", size: 0.27 },
  walnut: { dir: "/textures/wood/american_walnut_veneer", size: 1 },
} as const;

export type PBRSet = keyof typeof SETS;

type Maps = {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  aoMap: THREE.Texture;
};

const suffix = IS_MOBILE ? ".mobile.webp" : ".webp";
const cache = new Map<string, Maps>();

function urls(set: PBRSet) {
  const { dir } = SETS[set];
  return {
    map: `${dir}/diff${suffix}`,
    normalMap: `${dir}/nor_gl${suffix}`,
    roughnessMap: `${dir}/rough${suffix}`,
    aoMap: `${dir}/ao${suffix}`,
  };
}

/** Loaded, tiled maps for a set. Suspends while loading. */
export function usePBR(set: PBRSet, scale = 1): Maps {
  const loaded = useTexture(urls(set)) as Maps;
  return useMemo(() => {
    const key = `${set}:${scale}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const repeat = 1 / (SETS[set].size * scale);
    const tiled = {} as Maps;
    for (const [name, texture] of Object.entries(loaded) as [keyof Maps, THREE.Texture][]) {
      // Clones share the image source, so the GPU upload is shared as well.
      const clone = texture.clone();
      clone.wrapS = THREE.RepeatWrapping;
      clone.wrapT = THREE.RepeatWrapping;
      clone.repeat.set(repeat, repeat);
      clone.colorSpace = name === "map" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      clone.anisotropy = 8;
      // Opt in to scene-scale UV projection by <SurfaceUVs>.
      clone.userData = { surface: set };
      clone.needsUpdate = true;
      tiled[name] = clone;
    }
    cache.set(key, tiled);
    return tiled;
  }, [loaded, set, scale]);
}

export function preloadPBR(sets: PBRSet[]) {
  for (const set of sets) useTexture.preload(Object.values(urls(set)));
}

type PBRMaterialProps = Omit<MeshStandardMaterialProps, "map" | "normalMap" | "roughnessMap" | "aoMap"> & {
  set: PBRSet;
  /** Multiplies the real-world tile size. */
  textureScale?: number;
  relief?: number;
};

/** MeshStandardMaterial driven by a photographic PBR set. */
export function PBRMaterial({ set, textureScale = 1, relief = 1, roughness = 1, ...rest }: PBRMaterialProps) {
  const maps = usePBR(set, textureScale);
  const normalScale = useMemo(() => new THREE.Vector2(relief, relief), [relief]);
  return (
    <meshStandardMaterial
      {...maps}
      normalScale={normalScale}
      roughness={roughness}
      aoMapIntensity={0.9}
      {...rest}
    />
  );
}
