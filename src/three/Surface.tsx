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
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { getSurface, projectSurfaceUVs, type SurfaceKind } from "./surfaces";

export type { SurfaceKind } from "./surfaces";

// ---------------------------------------------------------------------------
// Bevelled boxes: real objects never have razor-sharp edges, and a small
// rounded edge catches light, which is most of what makes a box read as
// furniture, joinery or stone instead of a primitive.

const MAX_BEVEL = 0.014;

export class BevelBoxGeometry extends RoundedBoxGeometry {
  constructor(width = 1, height = 1, depth = 1, radius?: number) {
    const edge = radius ?? Math.min(MAX_BEVEL, Math.min(width, height, depth) * 0.22);
    super(width, height, depth, 1, edge);
  }
}

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
  const colorKey = typeof color === "string" || typeof color === "number" ? color : null;
  const tinted = useMemo(
    () => new THREE.Color(color as THREE.ColorRepresentation).multiplyScalar(1 / surface.albedoMean),
    [colorKey ?? color, surface],
  );
  const normalScale = useMemo(() => new THREE.Vector2(relief, relief), [relief]);
  const props = {
    map: surface.map,
    normalMap: surface.normalMap,
    roughnessMap: surface.roughnessMap,
    normalScale,
    color: tinted,
    roughness: (roughness as number) / surface.roughMean,
    ...rest,
  };
  return physical ? (
    <meshPhysicalMaterial {...props} />
  ) : (
    <meshStandardMaterial {...(props as MeshStandardMaterialProps)} />
  );
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
