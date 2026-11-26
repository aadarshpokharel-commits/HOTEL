import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BevelBoxGeometry } from "./geometry";

// Collects architectural parts (boxes, planes, cylinders…) under a transform
// stack and merges them into one BufferGeometry per material key. A whole
// floor of facade detail then costs one draw call per material instead of one
// per part. UVs are projected in builder space, so stone and concrete run
// continuously across neighbouring pieces at real-world scale.

export type Vec3 = [number, number, number];

type PartOptions = {
  rot?: Vec3;
  /** Round the box edges (use for stone and joinery). */
  bevel?: boolean | number;
  /** Per-vertex colour (only for keys rendered with vertexColors). */
  color?: THREE.ColorRepresentation;
};

const tmpNormal = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const ONE = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

/** Box projection with a fixed orientation: u runs horizontally, v vertically. */
function projectWorldUVs(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  if (!position || !normal || !uv) return;
  for (let i = 0; i < position.count; i += 1) {
    tmpNormal.fromBufferAttribute(normal, i);
    const ax = Math.abs(tmpNormal.x);
    const ay = Math.abs(tmpNormal.y);
    const az = Math.abs(tmpNormal.z);
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    if (ay >= ax && ay >= az) uv.setXY(i, x, z);
    else if (ax >= az) uv.setXY(i, z, y);
    else uv.setXY(i, x, y);
  }
  uv.needsUpdate = true;
}

export class ArchBuilder {
  private parts = new Map<string, THREE.BufferGeometry[]>();
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];

  private get matrix() {
    return this.stack[this.stack.length - 1];
  }

  /** Run `draw` with an extra local transform applied to every part. */
  within(local: THREE.Matrix4, draw: () => void) {
    this.stack.push(this.matrix.clone().multiply(local));
    draw();
    this.stack.pop();
  }

  at(position: Vec3, rotY: number, draw: () => void) {
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      tmpQuat.setFromAxisAngle(UP, rotY).clone(),
      ONE,
    );
    this.within(local, draw);
  }

  add(key: string, source: THREE.BufferGeometry, local: THREE.Matrix4, color?: THREE.ColorRepresentation) {
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    geometry.applyMatrix4(this.matrix.clone().multiply(local));
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") geometry.deleteAttribute(name);
    }
    geometry.clearGroups();
    projectWorldUVs(geometry);
    if (color !== undefined) {
      const c = new THREE.Color(color);
      const count = geometry.getAttribute("position").count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
    const list = this.parts.get(key);
    if (list) list.push(geometry);
    else this.parts.set(key, [geometry]);
  }

  private local(position: Vec3, rot?: Vec3, scale?: Vec3) {
    tmpEuler.set(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0);
    return new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      tmpQuat.setFromEuler(tmpEuler).clone(),
      scale ? new THREE.Vector3(...scale) : ONE,
    );
  }

  box(key: string, size: Vec3, position: Vec3, options: PartOptions = {}) {
    const [w, h, d] = size;
    if (w <= 0 || h <= 0 || d <= 0) return;
    const geometry =
      options.bevel === undefined || options.bevel === false
        ? new THREE.BoxGeometry(w, h, d)
        : new BevelBoxGeometry(w, h, d, typeof options.bevel === "number" ? options.bevel : undefined);
    this.add(key, geometry, this.local(position, options.rot), options.color);
  }

  /** A plane facing +z in its local frame. */
  plane(key: string, width: number, height: number, position: Vec3, options: PartOptions = {}) {
    if (width <= 0 || height <= 0) return;
    this.add(key, new THREE.PlaneGeometry(width, height), this.local(position, options.rot), options.color);
  }

  cylinder(
    key: string,
    radius: number,
    height: number,
    position: Vec3,
    options: PartOptions & { radiusTop?: number; segments?: number } = {},
  ) {
    const geometry = new THREE.CylinderGeometry(
      options.radiusTop ?? radius,
      radius,
      height,
      options.segments ?? 16,
    );
    this.add(key, geometry, this.local(position, options.rot), options.color);
  }

  sphere(key: string, radius: number, position: Vec3, options: PartOptions & { scale?: Vec3; segments?: number } = {}) {
    const segments = options.segments ?? 12;
    const geometry = new THREE.SphereGeometry(radius, segments, Math.max(6, Math.round(segments * 0.75)));
    this.add(key, geometry, this.local(position, options.rot, options.scale), options.color);
  }

  /** A cylinder running between two points. */
  rod(key: string, from: Vec3, to: Vec3, radius: number, segments = 8) {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    const length = direction.length();
    const geometry = new THREE.CylinderGeometry(radius, radius, length, segments);
    const local = new THREE.Matrix4().compose(
      a.clone().add(b).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize()),
      ONE,
    );
    this.add(key, geometry, local);
  }

  /** Merge everything collected so far into one geometry per key. */
  build(): Map<string, THREE.BufferGeometry> {
    const result = new Map<string, THREE.BufferGeometry>();
    for (const [key, list] of this.parts) {
      const hasColor = list.some((geometry) => geometry.getAttribute("color"));
      if (hasColor) {
        for (const geometry of list) {
          if (geometry.getAttribute("color")) continue;
          const count = geometry.getAttribute("position").count;
          geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
        }
      }
      const merged = mergeGeometries(list, false);
      list.forEach((geometry) => geometry.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      // Already mapped at scene scale; tell <SurfaceUVs> to leave it alone.
      merged.userData.surfaceUV = true;
      result.set(key, merged);
    }
    this.parts.clear();
    return result;
  }
}
