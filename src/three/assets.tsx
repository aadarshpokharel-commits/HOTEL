import { useGLTF } from "@react-three/drei";
import type { ThreeElements } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import * as THREE from "three";

// Local, CC0 glTF assets (see public/assets-manifest.json). Every model ships
// as meshopt-compressed GLB with WebP textures, in a 1024 px desktop variant
// and a 512 px ".mobile" variant. Models load on demand (Suspense) and are
// cached per URL by useGLTF; each placement clones the scene graph but shares
// geometry and materials, so repeated pieces cost no extra memory.

export const IS_MOBILE =
  typeof window !== "undefined" &&
  (window.matchMedia("(max-width: 640px)").matches ||
    (navigator.maxTouchPoints > 0 && Math.min(window.innerWidth, window.innerHeight) < 820));

const MODELS = {
  loungeChair: "/models/furniture/mid_century_lounge_chair",
  deskChair: "/models/furniture/modern_arm_chair_01",
  ottoman: "/models/furniture/ottoman_01",
  mediaCabinet: "/models/furniture/modern_wooden_cabinet",
  pendant: "/models/lighting/modern_ceiling_lamp_01",
  plant: "/models/decoration/potted_plant_02",
  vaseRound: "/models/decoration/ceramic_vase_01",
  vaseTall: "/models/decoration/ceramic_vase_03",
  photoFrame: "/models/decoration/standing_picture_frame_01",
} as const;

export type ModelName = keyof typeof MODELS;

export function modelUrl(name: ModelName) {
  return `${MODELS[name]}${IS_MOBILE ? ".mobile" : ""}.glb`;
}

// Decoders are bundled with three-stdlib: no Draco (none of our files use
// it, and it would otherwise fetch a decoder from a CDN); meshopt on.
const USE_DRACO = false;
const USE_MESHOPT = true;

export function preloadModels(names: ModelName[]) {
  for (const name of names) useGLTF.preload(modelUrl(name), USE_DRACO, USE_MESHOPT);
}

type ModelProps = Omit<ThreeElements["group"], "children"> & {
  name: ModelName;
  castShadow?: boolean;
  /** Tint applied to every material (multiplies the texture). */
  tint?: THREE.ColorRepresentation;
};

function ModelInstance({ name, castShadow = true, tint, ...group }: ModelProps) {
  const { scene } = useGLTF(modelUrl(name), USE_DRACO, USE_MESHOPT);
  const instance = useMemo(() => {
    const clone = scene.clone(true);
    // Library models use compressed vertex data and already share materials.
    clone.userData.noBatch = true;
    const tintColor = tint !== undefined ? new THREE.Color(tint) : null;
    clone.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      // Library models are interaction-transparent: room features own clicks.
      mesh.raycast = () => undefined;
      if (tintColor) {
        const tinted = (material: THREE.Material) => {
          const copy = material.clone() as THREE.MeshStandardMaterial;
          copy.color?.multiply(tintColor);
          return copy;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tinted) : tinted(mesh.material);
      }
    });
    return clone;
  }, [scene, castShadow, tint]);
  return (
    <group {...group}>
      <primitive object={instance} />
    </group>
  );
}

/** A placed instance of a library model; appears once loaded. */
export function Model(props: ModelProps) {
  return (
    <Suspense fallback={null}>
      <ModelInstance {...props} />
    </Suspense>
  );
}
