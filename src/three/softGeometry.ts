import * as THREE from "three";

// Procedural soft-goods geometry: draped bedding, pillows and pleated
// curtains. These are real deformed surfaces (folds, drape, pinched seams),
// not boxes, generated once and cached by their parameters.

const cache = new Map<string, THREE.BufferGeometry>();

function cached(key: string, build: () => THREE.BufferGeometry) {
  let geometry = cache.get(key);
  if (!geometry) {
    geometry = build();
    cache.set(key, geometry);
  }
  return geometry;
}

/** Cheap deterministic pseudo-noise in [-1, 1]. */
function wave(x: number, y: number, seed: number) {
  return (
    Math.sin(x * 7.3 + seed * 1.7 + Math.sin(y * 3.1 + seed)) * 0.5 +
    Math.sin(y * 11.7 - x * 4.3 + seed * 2.3) * 0.3 +
    Math.sin((x + y) * 19.1 + seed * 5.1) * 0.2
  );
}

export type DrapeOptions = {
  /** Width of the surface being covered (x). */
  width: number;
  /** Covered length along z, starting at z = 0 (head end) toward +z. */
  length: number;
  /** Height of the covered top surface. */
  top: number;
  /** How far the cloth hangs down each side and over the foot end. */
  sideDrop: number;
  endDrop: number;
  /** Loft of a filled duvet; 0 for a flat throw or sheet. */
  loft?: number;
  /** Amplitude of surface wrinkles. */
  wrinkle?: number;
  seed?: number;
};

/**
 * Cloth lying on a box and falling over its sides and foot end, with a lofted
 * crown, rounded edge roll, vertical drape folds and fine surface wrinkles.
 * Local frame: x across, y up, z along the length (head at z = 0).
 */
export function drapeGeometry(o: DrapeOptions) {
  const key = `drape:${JSON.stringify(o)}`;
  return cached(key, () => {
    const loft = o.loft ?? 0;
    const wrinkle = o.wrinkle ?? 0.006;
    const seed = o.seed ?? 1;
    const roll = Math.max(0.03, loft * 0.9); // edge roll radius
    const halfW = o.width / 2;
    const clothW = o.width + 2 * (o.sideDrop + roll * 0.6);
    const clothL = o.length + o.endDrop + roll * 0.6;
    const segX = 72;
    const segZ = 90;
    const geometry = new THREE.PlaneGeometry(1, 1, segX, segZ);
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;

    for (let i = 0; i < position.count; i += 1) {
      const u = position.getX(i) + 0.5; // 0..1 across
      const v = 0.5 - position.getY(i); // 0..1 along
      const s = (u - 0.5) * clothW; // signed arc length from centre line
      const t = v * clothL; // arc length from head end

      // Across: flat crown, quarter-round roll over the edge, then a hang.
      const across = (arc: number) => {
        const a = Math.abs(arc);
        const sign = Math.sign(arc) || 1;
        if (a <= halfW) {
          const crown = loft * (1 - Math.pow(a / halfW, 6));
          return { x: arc, y: crown, hang: 0 };
        }
        const d = a - halfW;
        const quarter = (Math.PI / 2) * roll;
        if (d <= quarter) {
          const angle = d / roll;
          return { x: sign * (halfW + Math.sin(angle) * roll), y: -(1 - Math.cos(angle)) * roll, hang: 0 };
        }
        const hang = d - quarter;
        return { x: sign * (halfW + roll + hang * 0.05), y: -roll - hang, hang };
      };
      const side = across(s);

      // Along: same treatment at the foot end.
      let z = t;
      let endY = 0;
      let endHang = 0;
      if (t > o.length) {
        const d = t - o.length;
        const quarter = (Math.PI / 2) * roll;
        if (d <= quarter) {
          const angle = d / roll;
          z = o.length + Math.sin(angle) * roll;
          endY = -(1 - Math.cos(angle)) * roll;
        } else {
          endHang = d - quarter;
          z = o.length + roll + endHang * 0.05;
          endY = -roll - endHang;
        }
      }

      // Combine; at the corners the cloth falls along both directions.
      let x = side.x;
      let y = o.top + loft * 0.15 + Math.min(side.y, 0) + endY + Math.max(side.y, 0) * (endY < 0 ? 0.3 : 1);
      // Vertical drape folds deepen as the cloth falls.
      const hang = Math.max(side.hang, endHang);
      if (side.hang > 0) x += Math.sign(s) * Math.sin(t * 9 + seed) * 0.018 * Math.min(1, side.hang / 0.15);
      if (endHang > 0) z += Math.sin(s * 9 + seed * 2) * 0.018 * Math.min(1, endHang / 0.15);
      // Crown wrinkles, strongest where the duvet is turned and handled.
      const onTop = hang === 0 ? 1 : 0.35;
      y += wave(s, t, seed) * wrinkle * onTop;
      // Hem: cloth weights flare slightly and the hem line undulates.
      if (hang > o.sideDrop * 0.85) y += Math.sin((s + t) * 6 + seed) * 0.008;
      position.setXYZ(i, x, y, z);
    }
    geometry.computeVertexNormals();
    return geometry;
  });
}

/**
 * A plump pillow: a squared superellipsoid whose edges pinch to a seam.
 * Size is the outer width (x), thickness (y) and depth (z).
 */
export function pillowGeometry(width: number, thickness: number, depth: number, seed = 1) {
  return cached(`pillow:${width}:${thickness}:${depth}:${seed}`, () => {
    const geometry = new THREE.SphereGeometry(1, 40, 28);
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      // Map the sphere toward a rounded square in plan.
      const px = Math.sign(x) * Math.pow(Math.abs(x), 0.42);
      const pz = Math.sign(z) * Math.pow(Math.abs(z), 0.42);
      const edge = Math.max(Math.abs(px), Math.abs(pz));
      // Thick in the middle, pinched to a seam at the edge, slightly squashed.
      const fill = Math.pow(Math.max(0, 1 - Math.pow(edge, 5)), 0.55);
      const dent = 1 - 0.08 * Math.exp(-(px * px + pz * pz) * 6);
      const py = Math.sign(y) * Math.pow(Math.abs(y), 0.75) * fill * dent;
      const lump = 1 + 0.03 * wave(px * 2, pz * 2, seed);
      position.setXYZ(i, (px * width) / 2, (py * thickness * lump) / 2, (pz * depth) / 2);
    }
    geometry.computeVertexNormals();
    return geometry;
  });
}

/**
 * A pleated curtain panel hanging from y = height down to y = 0, gathered
 * into regular pinch pleats with a softly swinging hem.
 */
export function curtainGeometry(width: number, height: number, pleats: number, depth = 0.06, seed = 1) {
  return cached(`curtain:${width}:${height}:${pleats}:${depth}:${seed}`, () => {
    const geometry = new THREE.PlaneGeometry(width, height, Math.max(24, pleats * 10), 40);
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i) + height / 2; // 0 at hem, height at heading
      const phase = (x / width + 0.5) * pleats * Math.PI * 2;
      const fall = 1 - y / height; // 0 at heading, 1 at hem
      // Pleats are crisp at the heading and open into soft waves below.
      const pleat = Math.sin(phase) * (0.55 + 0.45 * fall) + Math.sin(phase * 2 + seed) * 0.12 * fall;
      const z = pleat * (depth / 2) + fall * fall * 0.02 * Math.sin(x * 3 + seed);
      const hem = y < 0.04 ? Math.sin(phase + seed) * 0.006 : 0;
      position.setXYZ(i, x, y + hem, z);
    }
    geometry.computeVertexNormals();
    return geometry;
  });
}
