import * as THREE from "three";
import { fbm, hash2, smoothstep, valueNoise } from "./noise";

// Procedural PBR texture sets. Each surface kind synthesises a tileable albedo
// (neutral, so a material's `color` still sets the hue), a roughness map and a
// normal map derived from a height field. Textures are generated lazily, once
// per kind, and UVs are expected in scene units (see `projectSurfaceUVs`).

export type SurfaceKind =
  | "limestone"
  | "plaster"
  | "marble"
  | "oak"
  | "walnut"
  | "linen"
  | "fabric"
  | "rug"
  | "brass"
  | "satin"
  | "ceramic"
  | "foliage"
  | "travertine"
  | "concrete";

type Fields = {
  height: Float32Array;
  albedo: Float32Array; // rgb, sRGB-ish values in [0, 1]
  rough: Float32Array;
};

type Generator = (u: number, v: number, i: number, f: Fields) => void;

type SurfaceSpec = {
  size: number;
  /** Scene units covered by one repeat of the texture. */
  tile: number;
  /** Strength of the derived normal map. */
  bump: number;
  generate: Generator;
};

const TAU = Math.PI * 2;

function setRGB(f: Fields, i: number, r: number, g: number, b: number) {
  f.albedo[i * 3] = r;
  f.albedo[i * 3 + 1] = g;
  f.albedo[i * 3 + 2] = b;
}

/** Wood-style tint: darker values drift warmer and more saturated. */
function setWood(f: Fields, i: number, a: number) {
  const value = Math.min(1, Math.max(0, a));
  setRGB(f, i, value, Math.pow(value, 1.04), Math.pow(value, 1.1));
}

function setGrey(f: Fields, i: number, a: number) {
  const value = Math.min(1, Math.max(0, a));
  setRGB(f, i, value, value, value);
}

const SPECS: Record<SurfaceKind, SurfaceSpec> = {
  travertine: {
    size: 512,
    tile: 1.2,
    bump: 2.2,
    generate(u, v, i, f) {
      // Vein-cut travertine: horizontal bedding bands with elongated pores.
      const band = fbm(u, v, 2, 18, 4, 121);
      const fineBand = fbm(u, v, 3, 56, 3, 122);
      const poreNoise = valueNoise(u * 28, v * 176, 28, 176, 123);
      const pore = poreNoise > 0.8 ? smoothstep(0.8, 0.93, poreNoise) : 0;
      const cloud = fbm(u, v, 4, 4, 3, 124);
      f.height[i] = band * 0.28 + fineBand * 0.18 - pore * 0.75;
      const a =
        0.89 + (band - 0.5) * 0.2 + (fineBand - 0.5) * 0.08 + (cloud - 0.5) * 0.06 - pore * 0.2;
      setRGB(f, i, a, Math.pow(Math.max(0, a), 1.04), Math.pow(Math.max(0, a), 1.13));
      f.rough[i] = 0.8 + fineBand * 0.14 + pore * 0.18;
    },
  },
  concrete: {
    size: 512,
    tile: 2.4,
    bump: 1.7,
    generate(u, v, i, f) {
      // Board-formed architectural concrete: vertical board strips, seams,
      // pinholes, mottling and a regular grid of formwork tie holes.
      const boards = 8;
      const su = u * boards;
      const board = Math.floor(su);
      const fu = su - board;
      const boardTone = (hash2(board, 5) - 0.5) * 0.06;
      const seam = 1 - smoothstep(0.004, 0.012, Math.min(fu, 1 - fu) / boards);
      const grain = fbm(u, v, 3, 40, 3, 131);
      const mottle = fbm(u, v, 4, 4, 4, 132);
      const pinNoise = valueNoise(u * 160, v * 160, 160, 160, 133);
      const pin = pinNoise > 0.9 ? (pinNoise - 0.9) / 0.1 : 0;
      const tu = (u * 2) % 1;
      const tv = (v * 2) % 1;
      const tie = 1 - smoothstep(0.008, 0.014, Math.hypot(tu - 0.5, tv - 0.5) / 2);
      f.height[i] = mottle * 0.2 + grain * 0.18 - seam * 0.45 - pin * 0.5 - tie * 0.9;
      setGrey(
        f,
        i,
        0.9 + (mottle - 0.5) * 0.12 + (grain - 0.5) * 0.05 + boardTone - seam * 0.1 - pin * 0.2 - tie * 0.35,
      );
      f.rough[i] = 0.86 + grain * 0.12 + tie * 0.1;
    },
  },
  limestone: {
    size: 512,
    tile: 1.6,
    bump: 2.2,
    generate(u, v, i, f) {
      const base = fbm(u, v, 5, 5, 5, 1);
      const fine = fbm(u, v, 40, 40, 3, 2);
      const pitNoise = valueNoise(u * 128, v * 128, 128, 128, 3);
      const pit = pitNoise > 0.86 ? (pitNoise - 0.86) / 0.14 : 0;
      const bedding = 0.5 + 0.5 * Math.sin(TAU * v * 6 + base * 6);
      f.height[i] = base * 0.45 + fine * 0.3 - pit * 0.55 + bedding * 0.06;
      const a =
        0.9 + (base - 0.5) * 0.16 + (fine - 0.5) * 0.07 - pit * 0.16 + (bedding - 0.5) * 0.035;
      setRGB(f, i, a, Math.pow(a, 1.02), Math.pow(a, 1.07));
      f.rough[i] = 0.84 + fine * 0.14 + pit * 0.1;
    },
  },
  plaster: {
    size: 256,
    tile: 1.4,
    bump: 1.1,
    generate(u, v, i, f) {
      const low = fbm(u, v, 3, 3, 4, 11);
      const trowel = fbm(u, v, 8, 3, 4, 12);
      const fine = fbm(u, v, 48, 48, 2, 13);
      f.height[i] = low * 0.25 + trowel * 0.5 + fine * 0.25;
      setGrey(f, i, 0.93 + (low - 0.5) * 0.08 + (trowel - 0.5) * 0.05);
      f.rough[i] = 0.82 + (1 - trowel) * 0.18;
    },
  },
  marble: {
    size: 512,
    tile: 1.8,
    bump: 0.6,
    generate(u, v, i, f) {
      const warp = fbm(u, v, 4, 4, 6, 21);
      const warp2 = fbm(u, v, 6, 6, 5, 22);
      // |sin(π·x)| repeats every 1, so each tile carries one sweeping main vein
      // and a pair of fine hairline veins, all broken up by domain warping.
      const main = Math.abs(Math.sin(Math.PI * (u + v) + warp * 4.5));
      const vein = 1 - smoothstep(0, 0.06, main);
      const halo = 1 - smoothstep(0, 0.32, main);
      const hair = 1 - smoothstep(0, 0.025, Math.abs(Math.sin(Math.PI * (2 * u - v) + warp2 * 6)));
      const cloud = fbm(u, v, 5, 5, 4, 23);
      const a = 0.97 - vein * 0.24 - halo * 0.06 - hair * 0.08 - (cloud - 0.5) * 0.05;
      setRGB(f, i, a + vein * 0.03, a + vein * 0.005, a - vein * 0.025);
      f.height[i] = cloud * 0.06 - vein * 0.12 - hair * 0.04;
      f.rough[i] = 0.78 + vein * 0.22 + cloud * 0.08;
    },
  },
  oak: {
    size: 512,
    tile: 2.4,
    bump: 2.4,
    generate(u, v, i, f) {
      // Plank floor: 12 rows of planks, two planks per row, staggered.
      const rows = 12;
      const sv = v * rows;
      const row = Math.floor(sv);
      const fv = sv - row;
      const su = u * 2 + hash2(row, 7);
      const plank = Math.floor(su);
      const fu = su - plank;
      const plankId = row * 2 + (((plank % 2) + 2) % 2);
      const tint = (hash2(plankId, 3) - 0.5) * 0.08;
      const offset = hash2(plankId, 11);
      const grain = fbm(u, (v + offset) % 1, 3, 72, 4, 31);
      const rings = Math.sin(TAU * (v * rows * 4) + grain * 11 + offset * 20);
      const knot = valueNoise(u * 12, v * 24, 12, 24, 33);
      const seamV = Math.min(fv, 1 - fv) * (2.4 / rows);
      const seamU = Math.min(fu, 1 - fu) * (2.4 / 2);
      const seam = 1 - smoothstep(0.0015, 0.004, Math.min(seamU, seamV));
      const a = 0.84 + tint + (grain - 0.5) * 0.18 + rings * 0.03 - seam * 0.28 - Math.max(0, knot - 0.9) * 0.9;
      setWood(f, i, a);
      f.height[i] = grain * 0.3 + rings * 0.05 - seam * 0.9;
      f.rough[i] = 0.78 + grain * 0.18 + seam * 0.15;
    },
  },
  walnut: {
    size: 256,
    tile: 0.9,
    bump: 1.4,
    generate(u, v, i, f) {
      const grain = fbm(u, v, 2, 32, 5, 41);
      const figure = fbm(u, v, 3, 6, 4, 42);
      const rings = Math.abs(Math.sin(TAU * v * 9 + figure * 12 + grain * 3));
      const line = 1 - smoothstep(0, 0.22, rings);
      const pores = valueNoise(u * 96, v * 192, 96, 192, 43);
      const pore = pores > 0.82 ? (pores - 0.82) / 0.18 : 0;
      const a = 0.8 + (grain - 0.5) * 0.26 - line * 0.17 + (figure - 0.5) * 0.12 - pore * 0.08;
      setRGB(f, i, a, Math.pow(Math.max(0, a), 1.1), Math.pow(Math.max(0, a), 1.26));
      f.height[i] = grain * 0.25 - line * 0.2 - pore * 0.25;
      f.rough[i] = 0.84 + line * 0.12 + pore * 0.1;
    },
  },
  linen: {
    size: 256,
    tile: 0.16,
    bump: 2.6,
    generate(u, v, i, f) {
      const threads = 40;
      const su = u * threads;
      const sv = v * threads;
      const iu = Math.floor(su);
      const iv = Math.floor(sv);
      const fu = su - iu;
      const fv = sv - iv;
      const warpSlub = fbm(u, v, threads, 5, 3, 51);
      const weftSlub = fbm(u, v, 5, threads, 3, 52);
      const warpOnTop = ((iu + iv) & 1) === 0;
      const warp = Math.sin(Math.PI * fu) * (0.55 + 0.45 * Math.sin(Math.PI * fv));
      const weft = Math.sin(Math.PI * fv) * (0.55 + 0.45 * Math.sin(Math.PI * fu));
      const thread = warpOnTop ? warp * (0.7 + warpSlub * 0.5) : weft * (0.7 + weftSlub * 0.5);
      const slub = warpOnTop ? warpSlub : weftSlub;
      f.height[i] = thread;
      setGrey(f, i, 0.84 + (slub - 0.5) * 0.18 + thread * 0.08);
      f.rough[i] = 0.92 + (1 - thread) * 0.08;
    },
  },
  fabric: {
    size: 256,
    tile: 0.32,
    bump: 2.2,
    generate(u, v, i, f) {
      // Bouclé / wool upholstery: looped, nubby pile.
      const nub = fbm(u, v, 20, 20, 4, 61);
      const loops = 1 - Math.abs(2 * valueNoise(u * 48, v * 48, 48, 48, 62) - 1);
      const twill = 0.5 + 0.5 * Math.sin(TAU * (u * 64 + v * 64));
      f.height[i] = nub * 0.5 + loops * loops * 0.4 + twill * 0.1;
      setGrey(f, i, 0.86 + (nub - 0.5) * 0.18 + (loops - 0.5) * 0.08);
      f.rough[i] = 0.94 + (1 - loops) * 0.06;
    },
  },
  rug: {
    size: 256,
    tile: 0.6,
    bump: 2.4,
    generate(u, v, i, f) {
      const pile = fbm(u, v, 64, 64, 3, 71);
      const tufts = fbm(u, v, 16, 16, 3, 72);
      const rows = 0.5 + 0.5 * Math.sin(TAU * v * 48);
      f.height[i] = pile * 0.55 + tufts * 0.35 + rows * 0.1;
      setGrey(f, i, 0.85 + (pile - 0.5) * 0.16 + (tufts - 0.5) * 0.1);
      f.rough[i] = 1;
    },
  },
  brass: {
    size: 256,
    tile: 0.5,
    bump: 0.7,
    generate(u, v, i, f) {
      // Brushed metal: fine streaks along u, with soft tarnish blooms.
      const streak = fbm(u, v, 2, 128, 3, 81);
      const tarnish = fbm(u, v, 3, 3, 4, 82);
      const bloom = Math.max(0, tarnish - 0.58) * 2.2;
      setGrey(f, i, 0.93 + (streak - 0.5) * 0.08 - bloom * 0.12);
      f.height[i] = streak * 0.4;
      f.rough[i] = 0.7 + streak * 0.3 + bloom * 0.25;
    },
  },
  satin: {
    size: 256,
    tile: 0.8,
    bump: 0.55,
    generate(u, v, i, f) {
      // Lacquer, paint and leather-like finishes: subtle orange-peel.
      const peel = fbm(u, v, 18, 18, 3, 91);
      const tone = fbm(u, v, 3, 3, 3, 92);
      f.height[i] = peel;
      setGrey(f, i, 0.95 + (tone - 0.5) * 0.06);
      f.rough[i] = 0.88 + peel * 0.12;
    },
  },
  ceramic: {
    size: 128,
    tile: 1,
    bump: 0.25,
    generate(u, v, i, f) {
      const glaze = fbm(u, v, 6, 6, 3, 101);
      f.height[i] = glaze;
      setGrey(f, i, 0.97 + (glaze - 0.5) * 0.03);
      f.rough[i] = 0.9 + glaze * 0.1;
    },
  },
  foliage: {
    size: 256,
    tile: 0.35,
    bump: 1.6,
    generate(u, v, i, f) {
      const body = fbm(u, v, 6, 6, 4, 111);
      const veins = 1 - smoothstep(0, 0.08, Math.abs(Math.sin(TAU * u * 4 + body * 3)));
      const side = 1 - smoothstep(0, 0.05, Math.abs(Math.sin(TAU * (u * 8 + v * 8) + body * 2)));
      f.height[i] = veins * 0.35 + side * 0.15 + body * 0.2;
      setRGB(
        f,
        i,
        0.8 + (body - 0.5) * 0.25 + veins * 0.12,
        0.84 + (body - 0.5) * 0.2 + veins * 0.1,
        0.78 + (body - 0.5) * 0.2 + veins * 0.06,
      );
      f.rough[i] = 0.86 + body * 0.14;
    },
  },
};

export type SurfaceTextures = {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  /** Mean linear albedo; divide the material colour by this to keep its look. */
  albedoMean: number;
  /** Mean roughness-map value; divide `roughness` by this. */
  roughMean: number;
  bump: number;
};

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function makeTexture(data: Uint8Array, size: number, srgb: boolean) {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

const baseCache = new Map<SurfaceKind, SurfaceTextures>();

function buildSurface(kind: SurfaceKind): SurfaceTextures {
  const spec = SPECS[kind];
  const { size } = spec;
  const count = size * size;
  const fields: Fields = {
    height: new Float32Array(count),
    albedo: new Float32Array(count * 3),
    rough: new Float32Array(count),
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      spec.generate(x / size, y / size, y * size + x, fields);
    }
  }

  const albedo = new Uint8Array(count * 4);
  const rough = new Uint8Array(count * 4);
  const normal = new Uint8Array(count * 4);
  let albedoSum = 0;
  let roughSum = 0;
  const strength = spec.bump * (size / 256);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const r = Math.min(1, Math.max(0, fields.albedo[i * 3]));
      const g = Math.min(1, Math.max(0, fields.albedo[i * 3 + 1]));
      const b = Math.min(1, Math.max(0, fields.albedo[i * 3 + 2]));
      albedo[i * 4] = r * 255;
      albedo[i * 4 + 1] = g * 255;
      albedo[i * 4 + 2] = b * 255;
      albedo[i * 4 + 3] = 255;
      albedoSum += 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);

      const roughness = Math.min(1, Math.max(0.02, fields.rough[i]));
      const roughByte = roughness * 255;
      rough[i * 4] = roughByte;
      rough[i * 4 + 1] = roughByte;
      rough[i * 4 + 2] = roughByte;
      rough[i * 4 + 3] = 255;
      roughSum += roughness;

      const left = fields.height[y * size + ((x - 1 + size) % size)];
      const right = fields.height[y * size + ((x + 1) % size)];
      const down = fields.height[((y - 1 + size) % size) * size + x];
      const up = fields.height[((y + 1) % size) * size + x];
      const nx = (left - right) * strength;
      const ny = (down - up) * strength;
      const length = Math.hypot(nx, ny, 1);
      normal[i * 4] = (nx / length * 0.5 + 0.5) * 255;
      normal[i * 4 + 1] = (ny / length * 0.5 + 0.5) * 255;
      normal[i * 4 + 2] = (1 / length * 0.5 + 0.5) * 255;
      normal[i * 4 + 3] = 255;
    }
  }

  const map = makeTexture(albedo, size, true);
  map.userData.surface = kind;
  return {
    map,
    normalMap: makeTexture(normal, size, false),
    roughnessMap: makeTexture(rough, size, false),
    albedoMean: albedoSum / count,
    roughMean: roughSum / count,
    bump: spec.bump,
  };
}

function baseSurface(kind: SurfaceKind) {
  let surface = baseCache.get(kind);
  if (!surface) {
    surface = buildSurface(kind);
    baseCache.set(kind, surface);
  }
  return surface;
}

const scaledCache = new Map<string, SurfaceTextures>();

/**
 * Texture set for a surface kind. `scale` multiplies the real-world tile size,
 * e.g. 0.33 for the exterior model, which is built at roughly 1:3.
 */
export function getSurface(kind: SurfaceKind, scale = 1): SurfaceTextures {
  const key = `${kind}:${scale}`;
  let surface = scaledCache.get(key);
  if (surface) return surface;
  const base = baseSurface(kind);
  const repeat = 1 / (SPECS[kind].tile * scale);
  const scaled = (texture: THREE.DataTexture) => {
    // Clones share the same image source, so the GPU upload is shared too.
    const clone = texture.clone();
    clone.repeat.set(repeat, repeat);
    clone.userData = { ...texture.userData };
    clone.needsUpdate = true;
    return clone;
  };
  surface = {
    ...base,
    map: scaled(base.map),
    normalMap: scaled(base.normalMap),
    roughnessMap: scaled(base.roughnessMap),
  };
  scaledCache.set(key, surface);
  return surface;
}

// ---------------------------------------------------------------------------
// UVs in scene units. Primitive geometries ship with 0–1 UVs per face, which
// stretches textures on long walls and magnifies them on small parts. We
// rewrite UVs so one UV unit equals one scene unit on every textured mesh.

const tmpNormal = new THREE.Vector3();

function boxProject(geometry: THREE.BufferGeometry, scale: THREE.Vector3, offset: number) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  if (!position || !normal || !uv) return;
  geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  geometry.boundingBox!.getSize(size).multiply(scale);
  for (let i = 0; i < position.count; i += 1) {
    tmpNormal.fromBufferAttribute(normal, i);
    const ax = Math.abs(tmpNormal.x);
    const ay = Math.abs(tmpNormal.y);
    const az = Math.abs(tmpNormal.z);
    const x = position.getX(i) * scale.x;
    const y = position.getY(i) * scale.y;
    const z = position.getZ(i) * scale.z;
    let a: number;
    let b: number;
    let longA: boolean;
    if (ax >= ay && ax >= az) {
      a = z;
      b = y;
      longA = size.z >= size.y;
    } else if (ay >= az) {
      a = x;
      b = z;
      longA = size.x >= size.z;
    } else {
      a = x;
      b = y;
      longA = size.x >= size.y;
    }
    // Run the texture's u axis (wood grain, brushing) along the longer side.
    if (longA) uv.setXY(i, a + offset, b + offset * 0.7);
    else uv.setXY(i, b + offset, a + offset * 0.7);
  }
  uv.needsUpdate = true;
}

function scaleUVs(geometry: THREE.BufferGeometry, su: number, sv: number, center: boolean, offset: number) {
  const uv = geometry.getAttribute("uv");
  if (!uv) return;
  for (let i = 0; i < uv.count; i += 1) {
    const u = center ? uv.getX(i) - 0.5 : uv.getX(i);
    const v = center ? uv.getY(i) - 0.5 : uv.getY(i);
    uv.setXY(i, u * su + offset, v * sv + offset * 0.7);
  }
  uv.needsUpdate = true;
}

/** Rewrite a mesh's UVs so textures are mapped at scene scale. Runs once per geometry. */
export function projectSurfaceUVs(mesh: THREE.Mesh) {
  const geometry = mesh.geometry as THREE.BufferGeometry & {
    parameters?: Record<string, number>;
  };
  if (!geometry || geometry.userData.surfaceUV) return;
  geometry.userData.surfaceUV = true;
  // Stable per-object offset so repeated pieces don't show identical patterns.
  const offset = (parseInt(mesh.uuid.replace(/-/g, "").slice(0, 6), 16) % 997) / 97;
  const p = geometry.parameters ?? {};
  const s = mesh.scale;
  // Deformed procedural shapes (drapes, pillows) opt in to box projection.
  if (geometry.userData.boxUV) {
    boxProject(geometry, s, offset);
    return;
  }
  switch (geometry.type) {
    case "CylinderGeometry": {
      const radius = ((p.radiusTop ?? 1) + (p.radiusBottom ?? 1)) / 2;
      const uv = geometry.getAttribute("uv");
      const normal = geometry.getAttribute("normal");
      if (!uv || !normal) return;
      for (let i = 0; i < uv.count; i += 1) {
        const isCap = Math.abs(normal.getY(i)) > 0.999;
        if (isCap) {
          uv.setXY(i, (uv.getX(i) - 0.5) * radius * 2 + offset, (uv.getY(i) - 0.5) * radius * 2 + offset);
        } else {
          // Grain and brushing run along the length of legs, rods and posts.
          uv.setXY(i, uv.getY(i) * (p.height ?? 1) * s.y + offset, uv.getX(i) * Math.PI * 2 * radius + offset);
        }
      }
      uv.needsUpdate = true;
      return;
    }
    case "SphereGeometry": {
      const radius = p.radius ?? 1;
      scaleUVs(geometry, Math.PI * 2 * radius * s.x, Math.PI * radius * s.y, false, offset);
      return;
    }
    case "PlaneGeometry":
      scaleUVs(geometry, (p.width ?? 1) * s.x, (p.height ?? 1) * s.y, false, offset);
      return;
    case "CircleGeometry":
    case "RingGeometry": {
      const radius = p.radius ?? p.outerRadius ?? 1;
      scaleUVs(geometry, radius * 2 * s.x, radius * 2 * s.y, true, offset);
      return;
    }
    default:
      boxProject(geometry, s, offset);
  }
}
