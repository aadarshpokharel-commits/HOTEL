// Small, fast, tileable value-noise helpers used to synthesise surface textures.
// Every function takes (u, v) in [0, 1) and an integer lattice period per axis,
// so the result wraps seamlessly when the texture repeats.

const PERM = (() => {
  const table = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) base[i] = i;
  let seed = 0x9e3779b1;
  for (let i = 255; i > 0; i -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const swap = base[i];
    base[i] = base[j];
    base[j] = swap;
  }
  for (let i = 0; i < 512; i += 1) table[i] = base[i & 255];
  return table;
})();

/** Deterministic hash of two integers and a seed, in [0, 1]. */
export function hash2(x: number, y: number, seed = 0) {
  return PERM[(PERM[(x + seed * 31) & 255] + y) & 255] / 255;
}

function lattice(x: number, y: number, seed: number) {
  return PERM[(PERM[(PERM[seed & 255] + x) & 255] + y) & 255] / 255;
}

/** Tileable value noise. x, y are lattice coordinates; px, py are periods. */
export function valueNoise(x: number, y: number, px: number, py: number, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const x0 = ((xi % px) + px) % px;
  const y0 = ((yi % py) + py) % py;
  const x1 = (x0 + 1) % px;
  const y1 = (y0 + 1) % py;
  const sx = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const sy = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const a = lattice(x0, y0, seed);
  const b = lattice(x1, y0, seed);
  const c = lattice(x0, y1, seed);
  const d = lattice(x1, y1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Fractal (fBm) tileable noise in roughly [0, 1]. */
export function fbm(
  u: number,
  v: number,
  px: number,
  py: number,
  octaves = 4,
  seed = 0,
  gain = 0.5,
) {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  let fx = px;
  let fy = py;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += valueNoise(u * fx, v * fy, fx, fy, seed + octave * 17) * amplitude;
    total += amplitude;
    amplitude *= gain;
    fx *= 2;
    fy *= 2;
  }
  return sum / total;
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
