import { ContactShadows } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Rendering-cost helpers for scenes that are static apart from the camera.
//
// - The shadow map and contact shadows are redrawn only when the scene's
//   content changes (a model finishes loading, a floor changes), instead of
//   every frame. Lights and furniture never move, so the result is identical.
// - <StaticBatch> merges the static meshes under it into one mesh per shared
//   material, cutting hundreds of draw calls without changing what is drawn.

/** Children of an object flagged with this are ignored by the content check. */
const IGNORE = "ignoreContentSignature";

/**
 * A cheap fingerprint of the scene's content: which meshes exist, are visible
 * and cast shadows. Camera movement does not change it.
 */
function contentSignature(root: THREE.Object3D) {
  let count = 0;
  let sum = 0;
  const visit = (object: THREE.Object3D) => {
    if (object.userData[IGNORE] || !object.visible) return;
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      count += 1;
      sum = (sum + mesh.id * (mesh.castShadow ? 3 : 1)) % 1e9;
    }
    for (const child of object.children) visit(child);
  };
  visit(root);
  return `${count}:${sum}`;
}

/** Calls `onChange` (after the first frame) whenever the scene content changes. */
function useContentChange(onChange: () => void) {
  const scene = useThree((state) => state.scene);
  const last = useRef("");
  const callback = useRef(onChange);
  callback.current = onChange;
  useFrame(() => {
    const signature = contentSignature(scene);
    if (signature !== last.current) {
      last.current = signature;
      callback.current();
    }
  });
}

/** Renders the shadow map only when the scene content changes. */
export function StaticShadowMap() {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useContentChange(() => {
    gl.shadowMap.needsUpdate = true;
  });
  return null;
}

/**
 * drei's <ContactShadows> re-renders the whole scene every frame by default.
 * This renders it once, and again (by remounting) whenever content changes.
 */
export function StaticContactShadows(props: ComponentProps<typeof ContactShadows>) {
  const [version, setVersion] = useState(0);
  useContentChange(() => setVersion((value) => value + 1));
  return (
    <group userData={{ [IGNORE]: true }}>
      <ContactShadows key={version} frames={1} {...props} />
    </group>
  );
}

// --------------------------------------------------------------------------
// Static batching.

type BatchKey = { material: THREE.Material; cast: boolean; receive: boolean };

function canBatch(mesh: THREE.Mesh) {
  if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh) return false;
  if (Array.isArray(mesh.material)) return false;
  const material = mesh.material as THREE.Material;
  if (material.transparent || !material.visible) return false;
  if (mesh.userData.noBatch) return false;
  const geometry = mesh.geometry as THREE.BufferGeometry & { isInstancedBufferGeometry?: boolean };
  if (geometry.isInstancedBufferGeometry) return false; // e.g. text glyphs
  const position = geometry.getAttribute("position");
  if (!position || !geometry.getAttribute("normal") || !geometry.getAttribute("uv")) return false;
  // Only plain float geometry (compressed/quantised model data stays as is).
  if (!(position.array instanceof Float32Array) || position.normalized) return false;
  // Interactive objects keep their own meshes.
  const handlers = (mesh as unknown as { __r3f?: { handlers?: Record<string, unknown> } }).__r3f?.handlers;
  if (handlers && Object.keys(handlers).length > 0) return false;
  return true;
}

/**
 * Merges static descendant meshes into one mesh per (material, shadow flags).
 *
 * Originals stay mounted (React owns them) but are hidden. Merging waits until
 * the subtree has stopped changing for a few frames, and redoes itself if it
 * changes again (for example when a model finishes loading). Library models
 * (GLB scenes) already share materials and are left alone.
 */
export function StaticBatch({ children, settleFrames = 12 }: { children: ReactNode; settleFrames?: number }) {
  const source = useRef<THREE.Group>(null);
  const output = useRef<THREE.Group>(null);
  const state = useRef({ signature: "", stable: 0, merged: [] as THREE.Mesh[], hidden: [] as THREE.Mesh[] });
  const invalidate = useThree((s) => s.invalidate);

  const restore = () => {
    const s = state.current;
    s.hidden.forEach((mesh) => (mesh.visible = true));
    s.merged.forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.removeFromParent();
    });
    s.hidden = [];
    s.merged = [];
  };

  useLayoutEffect(() => () => restore(), []);

  useFrame(() => {
    const root = source.current;
    const out = output.current;
    if (!root || !out) return;
    const s = state.current;
    // Signature of the source subtree, ignoring our own hiding.
    let count = 0;
    let sum = 0;
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        count += 1;
        sum = (sum + mesh.id + ((mesh.material as THREE.Material).id ?? 0) * 7) % 1e9;
      }
    });
    const signature = `${count}:${sum}`;
    if (signature !== s.signature) {
      s.signature = signature;
      s.stable = 0;
      if (s.merged.length) restore();
      invalidate();
      return;
    }
    if (s.merged.length || s.stable > settleFrames) return;
    s.stable += 1;
    invalidate();
    if (s.stable <= settleFrames) return;

    // Group batchable meshes by material and shadow flags.
    root.updateWorldMatrix(true, true);
    const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const groups = new Map<string, { key: BatchKey; meshes: THREE.Mesh[] }>();
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!canBatch(mesh)) return;
      // Skip anything inside a hidden branch or a library model instance.
      let p: THREE.Object3D | null = mesh;
      while (p && p !== root) {
        if (!p.visible || p.userData.noBatch) return;
        p = p.parent;
      }
      const material = mesh.material as THREE.Material;
      const id = `${material.uuid}|${mesh.castShadow ? 1 : 0}|${mesh.receiveShadow ? 1 : 0}`;
      let group = groups.get(id);
      if (!group) {
        group = { key: { material, cast: mesh.castShadow, receive: mesh.receiveShadow }, meshes: [] };
        groups.set(id, group);
      }
      group.meshes.push(mesh);
    });

    for (const { key, meshes } of groups.values()) {
      if (meshes.length < 2) continue;
      const parts = meshes.map((mesh) => {
        const source = mesh.geometry as THREE.BufferGeometry;
        const geometry = source.index ? source.toNonIndexed() : source.clone();
        for (const name of Object.keys(geometry.attributes)) {
          if (name !== "position" && name !== "normal" && name !== "uv") geometry.deleteAttribute(name);
        }
        geometry.clearGroups();
        geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
        return geometry;
      });
      const merged = mergeGeometries(parts, false);
      parts.forEach((geometry) => geometry.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.userData.surfaceUV = true;
      const mesh = new THREE.Mesh(merged, key.material);
      mesh.castShadow = key.cast;
      mesh.receiveShadow = key.receive;
      mesh.raycast = () => undefined;
      out.add(mesh);
      s.merged.push(mesh);
      meshes.forEach((original) => {
        original.visible = false;
        s.hidden.push(original);
      });
    }
    // Hidden originals change the content signature: that is intended, the
    // shadow map and contact shadows refresh once with the merged meshes.
  });

  return (
    <>
      <group ref={source}>{children}</group>
      <group ref={output} />
    </>
  );
}
