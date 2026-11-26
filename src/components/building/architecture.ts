import * as THREE from "three";
import { ArchBuilder, type Vec3 } from "../../three/ArchBuilder";
import { hash2 } from "../../three/noise";

// Aurelia exterior, modelled as a contemporary Milanese boutique hotel:
// a travertine structural grid (corner piers, pilasters, thin expressed
// slabs) with deeply recessed bronze windows, a glazed ground-floor portico,
// a deep fourth-floor loggia and a glass penthouse pavilion, plus a
// board-formed concrete service core.
//
// Scene units: the model is built at roughly 1:3.2, so a 1.02-unit storey is
// a 3.3 m floor-to-floor height and the 4.8 × 3.25 footprint is ~15.5 × 10.5 m.

export const FLOOR_HEIGHT = 1.02;
export const GROUND_Y = 0.18;
export const BLOCK_W = 4.8;
export const BLOCK_D = 3.25;
export const LEVEL_COUNT = 6;

const SLAB = 0.07; // structural slab (~22 cm)
const WALL_T = 0.12; // external wall build-up (~38 cm)
const PIER = 0.17; // corner pier
const PILASTER = 0.12; // intermediate pilaster
const PROJ = 0.05; // pier/pilaster projection beyond the wall plane
const LOGGIA = 0.5; // fourth-floor setback
export const PENTHOUSE = { w: 3.3, d: 2.05, z: -0.4 };
export const CORE = { x0: -BLOCK_W / 2 + 0.22, x1: -BLOCK_W / 2 + 1.32, depth: 0.46 };

/** Material keys used by the exterior; each maps to one material. */
export type ExteriorPart =
  | "travertine"
  | "granite"
  | "concrete"
  | "bronze"
  | "brass"
  | "glass"
  | "railGlass"
  | "interior"
  | "drape"
  | "deck"
  | "walnut"
  | "light"
  | "foliage"
  | "foliageLight"
  | "foliageShade"
  | "bark"
  | "planter"
  | "paving";

type BayType = "window" | "french" | "balcony" | "full" | "solid";

type FacadeOptions = {
  length: number;
  bays: BayType[];
  /** Corner treatment: stone piers or slender bronze posts (pavilion). */
  corner?: "stone" | "bronze";
  /** Add vertical bronze fins over full-height glazing. */
  fins?: boolean;
  seed: number;
};

// 2700 K reference: warm interior light seen through the glass.
// Defined in sRGB so the warmth survives conversion to linear vertex colours.
const WARM_CEILING = new THREE.Color().setRGB(1, 0.84, 0.62, THREE.SRGBColorSpace);
const WARM_WALL = new THREE.Color().setRGB(0.9, 0.7, 0.5, THREE.SRGBColorSpace);
const WARM_FLOOR = new THREE.Color().setRGB(0.5, 0.36, 0.25, THREE.SRGBColorSpace);

function scaled(color: THREE.Color, k: number) {
  return color.clone().multiplyScalar(k);
}

/** Occupancy: some rooms are bright, some dim, a few have drapes drawn. */
function roomLight(seed: number) {
  const h = hash2(seed, 91, 3);
  if (h < 0.2) return 0.14;
  return 0.42 + hash2(seed, 37, 5) * 0.55;
}

/**
 * A single bay between two pilasters: stone spandrel/header/jambs around a
 * recessed opening, bronze frame, glass, drapes and a lit room behind.
 * Local frame: u along the facade (x), y up, n outward (z); wall plane at n = 0.
 */
function bay(b: ArchBuilder, cx: number, bw: number, type: BayType, seed: number, fins: boolean) {
  const top = FLOOR_HEIGHT;
  if (type === "solid") {
    b.box("travertine", [bw, top - SLAB, WALL_T], [cx, SLAB + (top - SLAB) / 2, -WALL_T / 2], { bevel: 0.006 });
    return;
  }
  const sill = type === "window" ? SLAB + 0.25 : SLAB + 0.005;
  const head = type === "full" ? top - 0.05 : top - 0.13;
  const jamb = type === "full" ? 0.025 : type === "window" ? 0.075 : 0.055;
  const ow = bw - jamb * 2;
  const oh = head - sill;
  const fz = type === "full" ? -0.04 : -0.075; // frame recess
  const fw = type === "full" ? 0.022 : 0.028; // frame member
  const fd = 0.035;
  const midY = sill + oh / 2;

  // Stone surround. The jambs and header are the full wall depth, so their
  // inner faces read as deep stone reveals.
  if (sill - SLAB > 0.01) {
    b.box("travertine", [bw, sill - SLAB, WALL_T], [cx, SLAB + (sill - SLAB) / 2, -WALL_T / 2], { bevel: 0.006 });
  }
  b.box("travertine", [bw, top - head, WALL_T], [cx, head + (top - head) / 2, -WALL_T / 2], { bevel: 0.006 });
  for (const side of [-1, 1]) {
    b.box("travertine", [jamb, oh, WALL_T], [cx + side * (ow / 2 + jamb / 2), midY, -WALL_T / 2], { bevel: 0.006 });
  }
  if (type === "window") {
    // Projecting stone sill with a drip edge.
    b.box("travertine", [ow + 0.05, 0.022, 0.085], [cx, sill + 0.011, -0.022], { bevel: 0.005 });
  }

  // Bronze frame, mullion and transom.
  for (const side of [-1, 1]) {
    b.box("bronze", [fw, oh, fd], [cx + side * (ow / 2 - fw / 2), midY, fz]);
  }
  b.box("bronze", [ow, fw, fd], [cx, sill + fw / 2, fz]);
  b.box("bronze", [ow, fw, fd], [cx, head - fw / 2, fz]);
  if (ow > 0.42) b.box("bronze", [0.016, oh - fw * 2, fd * 0.8], [cx, midY, fz]);
  if (type !== "window") b.box("bronze", [ow - fw * 2, 0.016, fd * 0.8], [cx, sill + oh * 0.8, fz]);
  b.plane("glass", ow - fw * 2, oh - fw * 2, [cx, midY, fz + 0.004]);

  // The room behind the glass: lit ceiling, walls and floor in 2700 K tones.
  const light = roomLight(seed);
  const depth = 0.36;
  const back = -WALL_T - depth;
  const inner = ow + 0.12;
  const roomTop = head + 0.04;
  const roomBottom = SLAB + 0.004;
  const roomH = roomTop - roomBottom;
  const roomMid = (roomTop + roomBottom) / 2;
  const nMid = -WALL_T - depth / 2;
  b.plane("interior", inner, roomH, [cx, roomMid, back], { color: scaled(WARM_WALL, light * 0.8) });
  b.plane("interior", inner, depth + 0.02, [cx, roomTop, nMid], {
    rot: [Math.PI / 2, 0, 0],
    color: scaled(WARM_CEILING, light),
  });
  b.plane("interior", inner, depth + 0.02, [cx, roomBottom, nMid], {
    rot: [-Math.PI / 2, 0, 0],
    color: scaled(WARM_FLOOR, light),
  });
  for (const side of [-1, 1]) {
    b.plane("interior", depth + 0.02, roomH, [cx + side * (inner / 2), roomMid, nMid], {
      rot: [0, -side * Math.PI / 2, 0],
      color: scaled(WARM_WALL, light * 0.62),
    });
  }
  // A pendant or ceiling fixture glowing near the back of each lit room.
  if (light > 0.3) {
    b.box("light", [0.09, 0.012, 0.09], [cx + (hash2(seed, 13) - 0.5) * ow * 0.4, roomTop - 0.01, back + 0.12]);
  }

  // Sheer drapes: pulled back in lit rooms, drawn in dark ones.
  const drapeW = light < 0.2 ? (ow - fw * 2) / 2 - 0.01 : ow * 0.15;
  const drapeH = oh - fw * 2 - 0.02;
  for (const side of [-1, 1]) {
    const x = cx + side * ((ow - fw * 2) / 2 - drapeW / 2);
    b.box("drape", [drapeW, drapeH, 0.004], [x, midY, fz - 0.035]);
  }

  if (type === "french") {
    // Juliet balcony: frameless glass guard inside the opening, bronze rail.
    b.box("railGlass", [ow - fw * 2, 0.3, 0.012], [cx, SLAB + 0.17, fz + 0.035]);
    b.box("bronze", [ow, 0.016, 0.028], [cx, SLAB + 0.33, fz + 0.035]);
  }

  if (type === "balcony") {
    // Thin cantilevered slab, glass balustrade, bronze capping, soffit light.
    const depthOut = 0.44;
    const bwOut = bw + 0.1;
    b.box("travertine", [bwOut, 0.045, depthOut], [cx, SLAB - 0.0225, depthOut / 2], { bevel: 0.006 });
    b.box("railGlass", [bwOut - 0.02, 0.3, 0.012], [cx, SLAB + 0.15, depthOut - 0.02]);
    b.box("bronze", [bwOut, 0.016, 0.03], [cx, SLAB + 0.31, depthOut - 0.02]);
    for (const side of [-1, 1]) {
      b.box("railGlass", [0.012, 0.3, depthOut - 0.04], [cx + side * (bwOut / 2 - 0.01), SLAB + 0.15, depthOut / 2]);
      b.box("bronze", [0.03, 0.016, depthOut - 0.02], [cx + side * (bwOut / 2 - 0.01), SLAB + 0.31, depthOut / 2]);
    }
    b.cylinder("light", 0.022, 0.004, [cx, SLAB - 0.047, depthOut * 0.55], { segments: 16 });
  }

  if (fins && type === "full") {
    // Vertical bronze fins for solar shading on the deep loggia glazing.
    const count = Math.max(3, Math.round(ow / 0.17));
    for (let i = 1; i < count; i += 1) {
      const x = cx - ow / 2 + (ow / count) * i;
      b.box("bronze", [0.012, oh, 0.075], [x, midY, 0.03]);
    }
  }
}

/** One facade between two corners, in a local frame (u along, n outward). */
function facade(b: ArchBuilder, options: FacadeOptions) {
  const { length, bays, seed } = options;
  const corner = options.corner === "bronze" ? 0.06 : PIER;
  const pilaster = options.corner === "bronze" ? 0.045 : PILASTER;
  const count = bays.length;
  const bayW = (length - corner * 2 - pilaster * (count - 1)) / count;
  for (let i = 0; i < count; i += 1) {
    const u0 = -length / 2 + corner + i * (bayW + pilaster);
    bay(b, u0 + bayW / 2, bayW, bays[i], seed * 31 + i, options.fins ?? false);
    if (i < count - 1) {
      const x = u0 + bayW + pilaster / 2;
      const h = FLOOR_HEIGHT - SLAB;
      if (options.corner === "bronze") {
        b.box("bronze", [pilaster, h, 0.05], [x, SLAB + h / 2, -0.02]);
      } else {
        b.box("travertine", [pilaster, h, WALL_T + PROJ], [x, SLAB + h / 2, -WALL_T + (WALL_T + PROJ) / 2], {
          bevel: 0.008,
        });
      }
    }
  }
}

type Footprint = { w: number; d: number; cz: number };

/** Corner piers (or bronze posts) at the four corners of a footprint. */
function corners(b: ArchBuilder, fp: Footprint, style: "stone" | "bronze", frontDepth = 0) {
  const h = FLOOR_HEIGHT - SLAB;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      if (style === "bronze") {
        b.box("bronze", [0.06, h, 0.06], [sx * (fp.w / 2 - 0.03), SLAB + h / 2, fp.cz + sz * (fp.d / 2 - 0.03)]);
        continue;
      }
      const size = PIER + PROJ;
      // Front corners on the ground floor wrap the recessed portico.
      const depth = sz > 0 && frontDepth > 0 ? frontDepth + PROJ : size;
      b.box(
        "travertine",
        [size, h, depth],
        [sx * (fp.w / 2 - PIER + size / 2), SLAB + h / 2, fp.cz + sz * (fp.d / 2 + PROJ - depth / 2)],
        { bevel: 0.01 },
      );
    }
  }
}

/** The four facades of a rectangular footprint. */
function enclosure(
  b: ArchBuilder,
  fp: Footprint,
  bays: { front?: BayType[]; back: BayType[]; side: BayType[] },
  seed: number,
  style: "stone" | "bronze" = "stone",
  fins = false,
) {
  if (bays.front) {
    b.at([0, 0, fp.cz + fp.d / 2], 0, () =>
      facade(b, { length: fp.w, bays: bays.front!, seed: seed + 1, corner: style, fins }),
    );
  }
  b.at([0, 0, fp.cz - fp.d / 2], Math.PI, () =>
    facade(b, { length: fp.w, bays: bays.back, seed: seed + 2, corner: style }),
  );
  b.at([fp.w / 2, 0, fp.cz], Math.PI / 2, () =>
    facade(b, { length: fp.d, bays: bays.side, seed: seed + 3, corner: style, fins }),
  );
  b.at([-fp.w / 2, 0, fp.cz], -Math.PI / 2, () =>
    facade(b, { length: fp.d, bays: [...bays.side].reverse(), seed: seed + 4, corner: style, fins }),
  );
}

/** Structural slab, expressed as a thin travertine band flush with the piers. */
function slab(b: ArchBuilder, material: ExteriorPart = "travertine") {
  b.box(material, [BLOCK_W + PROJ * 2, SLAB, BLOCK_D + PROJ * 2], [0, SLAB / 2, 0], { bevel: 0.006 });
}

/** Frameless glass guard with bronze capping along a straight edge. */
function guard(b: ArchBuilder, from: [number, number], to: [number, number], y: number) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const angle = Math.atan2(-dz, dx);
  const mid: Vec3 = [(from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2];
  b.at(mid, angle, () => {
    b.box("railGlass", [length, 0.3, 0.012], [0, y + 0.15, 0]);
    b.box("bronze", [length + 0.02, 0.016, 0.03], [0, y + 0.31, 0]);
  });
}

function planter(b: ArchBuilder, position: Vec3, size: Vec3, plants: "shrub" | "tree", seed: number) {
  const [w, h, d] = size;
  b.box("planter", [w, h, d], [position[0], position[1] + h / 2, position[2]], { bevel: 0.01 });
  if (plants === "tree") {
    const [x, y, z] = position;
    const crownY = y + h + 0.5;
    b.cylinder("bark", 0.022, 0.52, [x, y + h + 0.26, z], { radiusTop: 0.012, segments: 10 });
    for (let i = 0; i < 5; i += 1) {
      const angle = (i / 5) * Math.PI * 2 + hash2(seed, i) * 0.45;
      const branchEnd: Vec3 = [
        x + Math.cos(angle) * 0.16,
        y + h + 0.4 + hash2(seed, i + 12) * 0.08,
        z + Math.sin(angle) * 0.14,
      ];
      b.rod("bark", [x, y + h + 0.29, z], branchEnd, 0.008, 7);
    }
    b.sphere("foliageShade", 0.13, [x, crownY, z], {
      scale: [1.2, 0.72, 0.95],
      segments: 14,
    });
    for (let i = 0; i < 11; i += 1) {
      const angle = (i / 11) * Math.PI * 2 + hash2(seed, i + 20) * 0.5;
      const radius = 0.07 + hash2(seed, i + 30) * 0.09;
      const leafSize = 0.09 + hash2(seed, i + 40) * 0.035;
      const leafY = crownY + (hash2(seed, i + 50) - 0.5) * 0.17;
      b.sphere(i % 3 === 0 ? "foliageShade" : "foliageLight", leafSize, [
        x + Math.cos(angle) * radius,
        leafY,
        z + Math.sin(angle) * radius * 0.82,
      ], {
        scale: [1.3, 0.72, 0.92],
        segments: 12,
      });
    }
    return;
  }
  const count = Math.max(2, Math.round(w / 0.14));
  for (let i = 0; i < count; i += 1) {
    const sx = -w / 2 + (w / count) * (i + 0.5);
    b.sphere("foliage", 0.07 + hash2(seed, i) * 0.02, [position[0] + sx, position[1] + h + 0.04, position[2]], {
      scale: [1.1, 0.75, Math.min(1.2, d / 0.16)],
      segments: 10,
    });
  }
}

const FULL_BLOCK: Footprint = { w: BLOCK_W, d: BLOCK_D, cz: 0 };
const REAR_WITH_CORE: BayType[] = ["window", "window", "window", "solid", "solid"];

function groundLevel(b: ArchBuilder) {
  slab(b, "granite");
  const recess = 0.42;
  const h = FLOOR_HEIGHT - SLAB;

  // Back and sides: punched windows over a granite base course.
  enclosure(b, FULL_BLOCK, { back: REAR_WITH_CORE, side: ["window", "window", "window"] }, 100);
  corners(b, FULL_BLOCK, "stone", recess);

  // Front portico: pilasters run full height at the facade line and carry a
  // travertine lintel; the glazed lobby wall sits 1.3 m behind them.
  const front = BLOCK_D / 2;
  const count = 5;
  const bayW = (BLOCK_W - PIER * 2 - PILASTER * (count - 1)) / count;
  const lintelH = 0.13;
  b.box("travertine", [BLOCK_W - PIER * 2 + 0.002, lintelH, WALL_T + PROJ], [0, FLOOR_HEIGHT - lintelH / 2, front - WALL_T + (WALL_T + PROJ) / 2], { bevel: 0.008 });
  // Portico soffit with recessed downlights, and a granite floor.
  b.box("concrete", [BLOCK_W - PIER * 2, 0.02, recess], [0, FLOOR_HEIGHT - lintelH - 0.01, front - recess / 2]);
  for (let i = 0; i < count; i += 1) {
    const u0 = -BLOCK_W / 2 + PIER + i * (bayW + PILASTER);
    const cx = u0 + bayW / 2;
    b.cylinder("light", 0.02, 0.004, [cx, FLOOR_HEIGHT - lintelH - 0.022, front - recess / 2], { segments: 16 });
    if (i < count - 1) {
      const x = u0 + bayW + PILASTER / 2;
      b.box("travertine", [PILASTER, h - lintelH, PILASTER + 0.02], [x, SLAB + (h - lintelH) / 2, front - 0.03], { bevel: 0.008 });
      // Wide bronze mullion closing the storefront behind each pilaster.
      const gh = FLOOR_HEIGHT - lintelH - 0.02 - SLAB;
      b.box("bronze", [PILASTER, gh, 0.04], [x, SLAB + gh / 2, front - recess]);
      // Uplight at the foot of each pilaster.
      b.cylinder("light", 0.018, 0.004, [x, SLAB + 0.003, front + 0.09], { segments: 12 });
    }

    // Storefront glazing with bronze mullions; the centre bay is the entrance.
    const z = front - recess;
    const glazingTop = FLOOR_HEIGHT - lintelH - 0.02;
    const gh = glazingTop - SLAB;
    const gMid = SLAB + gh / 2;
    b.box("bronze", [0.026, gh, 0.04], [u0, gMid, z]);
    b.box("bronze", [0.026, gh, 0.04], [u0 + bayW, gMid, z]);
    b.box("bronze", [bayW, 0.026, 0.04], [cx, glazingTop - 0.013, z]);
    b.box("bronze", [bayW, 0.03, 0.045], [cx, SLAB + 0.015, z]);
    b.box("bronze", [bayW, 0.018, 0.035], [cx, SLAB + gh * 0.8, z]);
    if (i === 2) {
      // Pair of bronze-framed glass doors with tall brass pulls.
      const doorH = gh * 0.8 - 0.01;
      for (const side of [-1, 1]) {
        const dx = cx + side * (bayW / 4);
        b.box("bronze", [bayW / 2 - 0.01, doorH, 0.02], [dx, SLAB + doorH / 2, z + 0.006]);
        b.plane("glass", bayW / 2 - 0.07, doorH - 0.07, [dx, SLAB + doorH / 2, z + 0.018]);
        b.box("brass", [0.012, 0.34, 0.012], [cx + side * 0.035, SLAB + 0.36, z + 0.04]);
        b.box("brass", [0.012, 0.012, 0.03], [cx + side * 0.035, SLAB + 0.2, z + 0.028]);
        b.box("brass", [0.012, 0.012, 0.03], [cx + side * 0.035, SLAB + 0.52, z + 0.028]);
      }
    } else {
      b.box("bronze", [0.018, gh * 0.8, 0.035], [cx, SLAB + gh * 0.4, z]);
      b.plane("glass", bayW - 0.03, gh - 0.05, [cx, gMid, z + 0.005]);
    }
  }

  // The lobby seen through the glass: warm room, walnut slatted wall,
  // reception desk, pendant globes and two large plants.
  const lobbyBack = front - 1.45;
  const lobbyW = BLOCK_W - PIER * 2 - 0.02;
  const ceiling = FLOOR_HEIGHT - lintelH - 0.03;
  const lobbyDepth = front - recess - lobbyBack;
  const lobbyMid = (front - recess + lobbyBack) / 2;
  b.plane("interior", lobbyW, ceiling - SLAB, [0, (ceiling + SLAB) / 2, lobbyBack], { color: scaled(WARM_WALL, 0.55) });
  b.plane("interior", lobbyW, lobbyDepth, [0, ceiling, lobbyMid], { rot: [Math.PI / 2, 0, 0], color: scaled(WARM_CEILING, 0.95) });
  b.plane("interior", lobbyW, lobbyDepth, [0, SLAB + 0.002, lobbyMid], { rot: [-Math.PI / 2, 0, 0], color: new THREE.Color(0.62, 0.5, 0.38) });
  for (const side of [-1, 1]) {
    b.plane("interior", lobbyDepth, ceiling - SLAB, [side * lobbyW / 2, (ceiling + SLAB) / 2, lobbyMid], {
      rot: [0, -side * Math.PI / 2, 0],
      color: scaled(WARM_WALL, 0.6),
    });
  }
  for (let i = 0; i < 15; i += 1) {
    b.box("walnut", [0.035, ceiling - SLAB - 0.02, 0.025], [-0.84 + i * 0.12, (ceiling + SLAB) / 2, lobbyBack + 0.02]);
  }
  b.box("walnut", [1.15, 0.3, 0.2], [0, SLAB + 0.15, lobbyBack + 0.42], { bevel: 0.01 });
  b.box("travertine", [1.2, 0.02, 0.24], [0, SLAB + 0.31, lobbyBack + 0.42], { bevel: 0.005 });
  for (const x of [-0.4, 0, 0.4]) {
    b.rod("brass", [x, ceiling, lobbyBack + 0.55], [x, ceiling - 0.2, lobbyBack + 0.55], 0.003, 6);
    b.sphere("light", 0.045, [x, ceiling - 0.24, lobbyBack + 0.55], { segments: 14 });
  }
  for (const side of [-1, 1]) {
    planter(b, [side * 1.75, SLAB, lobbyBack + 0.35], [0.2, 0.18, 0.2], "tree", 40 + side);
  }

  // Entrance canopy: a thin bronze-clad cantilever with signage fascia,
  // downlights and slender tie rods back to the facade.
  const canopyY = FLOOR_HEIGHT - 0.2;
  const canopyW = 1.7;
  const canopyD = 0.86;
  b.box("bronze", [canopyW, 0.045, canopyD], [0, canopyY, front + canopyD / 2], { bevel: 0.006 });
  b.box("bronze", [canopyW + 0.01, 0.1, 0.02], [0, canopyY - 0.005, front + canopyD + 0.01]);
  for (const x of [-0.55, 0, 0.55]) {
    b.cylinder("light", 0.022, 0.004, [x, canopyY - 0.024, front + canopyD * 0.55], { segments: 16 });
  }
  for (const side of [-1, 1]) {
    b.rod("bronze", [side * 0.75, canopyY + 0.02, front + canopyD - 0.04], [side * 0.75, FLOOR_HEIGHT + 0.32, front + 0.06], 0.006);
  }
}

function typicalLevel(b: ArchBuilder, id: number) {
  slab(b);
  const front: BayType[] =
    id === 1
      ? ["french", "french", "french", "french", "french"]
      : id === 2
        ? ["window", "balcony", "window", "balcony", "window"]
        : ["window", "window", "window", "window", "window"];
  enclosure(b, FULL_BLOCK, { front, back: REAR_WITH_CORE, side: ["window", "window", "window"] }, id * 10);
  corners(b, FULL_BLOCK, "stone");
  if (id === 3) {
    // Attic cornice marking the top of the stone body below the loggia.
    b.box("travertine", [BLOCK_W + PROJ * 2 + 0.06, 0.035, BLOCK_D + PROJ * 2 + 0.06], [0, FLOOR_HEIGHT - 0.0175, 0], { bevel: 0.006 });
  }
}

function loggiaLevel(b: ArchBuilder) {
  slab(b);
  const fp: Footprint = { w: BLOCK_W, d: BLOCK_D - LOGGIA, cz: -LOGGIA / 2 };
  enclosure(
    b,
    fp,
    {
      front: ["full", "full", "full", "full", "full"],
      back: REAR_WITH_CORE,
      side: ["window", "window", "window"],
    },
    40,
    "stone",
    true,
  );
  corners(b, fp, "stone");
  // Covered terrace: decking, glass guard, slender bronze columns supporting
  // the penthouse slab above, and planters at either end.
  const front = BLOCK_D / 2;
  b.box("deck", [BLOCK_W - 0.04, 0.016, LOGGIA + PROJ], [0, SLAB + 0.008, front - LOGGIA / 2 + PROJ / 2]);
  guard(b, [-BLOCK_W / 2, front + 0.02], [BLOCK_W / 2, front + 0.02], SLAB);
  for (const side of [-1, 1]) guard(b, [side * BLOCK_W / 2, front - LOGGIA + 0.02], [side * BLOCK_W / 2, front + 0.02], SLAB);
  for (const x of [-BLOCK_W / 2 + 0.05, -0.8, 0.8, BLOCK_W / 2 - 0.05]) {
    b.cylinder("bronze", 0.022, FLOOR_HEIGHT - SLAB, [x, SLAB + (FLOOR_HEIGHT - SLAB) / 2, front - 0.04], { segments: 12 });
  }
  for (const side of [-1, 1]) {
    planter(b, [side * 1.9, SLAB, front - LOGGIA / 2 + 0.02], [0.5, 0.13, 0.16], "shrub", 70 + side);
  }
}

function penthouseLevel(b: ArchBuilder) {
  slab(b);
  // Deep travertine crown band at the front edge carries the hotel name.
  b.box("travertine", [BLOCK_W + PROJ * 2, 0.15, 0.03], [0, 0.0, BLOCK_D / 2 + PROJ + 0.015], { bevel: 0.006 });
  const fp: Footprint = { w: PENTHOUSE.w, d: PENTHOUSE.d, cz: PENTHOUSE.z };
  enclosure(
    b,
    fp,
    {
      front: ["full", "full", "full", "full"],
      back: ["window", "window", "window", "window"],
      side: ["full", "full"],
    },
    50,
    "bronze",
  );
  corners(b, fp, "bronze");

  // Roof: thin slab with a generous overhang and bronze fascia.
  const roofY = FLOOR_HEIGHT;
  const over = 0.24;
  b.box("concrete", [fp.w + over * 2, 0.05, fp.d + over * 2], [0, roofY + 0.025, fp.cz], { bevel: 0.006 });
  b.box("bronze", [fp.w + over * 2 + 0.02, 0.07, 0.012], [0, roofY + 0.02, fp.cz + fp.d / 2 + over + 0.006]);
  b.box("bronze", [fp.w + over * 2 + 0.02, 0.07, 0.012], [0, roofY + 0.02, fp.cz - fp.d / 2 - over - 0.006]);
  for (const side of [-1, 1]) {
    b.box("bronze", [0.012, 0.07, fp.d + over * 2 + 0.02], [side * (fp.w / 2 + over + 0.006), roofY + 0.02, fp.cz]);
  }
  // Soffit downlights along the overhang.
  for (let i = 0; i < 6; i += 1) {
    b.cylinder("light", 0.016, 0.004, [-fp.w / 2 + 0.25 + i * ((fp.w - 0.5) / 5), roofY - 0.002, fp.cz + fp.d / 2 + over * 0.55], { segments: 12 });
  }

  // Rooftop plant room, screened by bronze louvres.
  const plant = { x: 0.7, z: fp.cz - 0.25, w: 1.1, h: 0.34, d: 0.7 };
  const py = roofY + 0.05;
  b.box("concrete", [plant.w - 0.04, plant.h - 0.02, plant.d - 0.04], [plant.x, py + plant.h / 2, plant.z]);
  for (let i = 0; i < 9; i += 1) {
    const y = py + 0.03 + i * 0.035;
    b.box("bronze", [plant.w, 0.008, 0.03], [plant.x, y, plant.z + plant.d / 2], { rot: [0.5, 0, 0] });
    b.box("bronze", [plant.w, 0.008, 0.03], [plant.x, y, plant.z - plant.d / 2], { rot: [-0.5, 0, 0] });
    for (const side of [-1, 1]) {
      b.box("bronze", [0.03, 0.008, plant.d], [plant.x + side * plant.w / 2, y, plant.z], { rot: [0, 0, side * 0.5] });
    }
  }
  b.box("concrete", [plant.w + 0.04, 0.02, plant.d + 0.04], [plant.x, py + plant.h + 0.01, plant.z]);
  // Skylight over the penthouse living area.
  b.box("bronze", [0.6, 0.03, 0.45], [-0.8, roofY + 0.065, fp.cz], { bevel: 0.005 });
  b.box("glass", [0.56, 0.006, 0.41], [-0.8, roofY + 0.083, fp.cz]);

  // Open roof terrace around the pavilion.
  b.box("deck", [BLOCK_W - 0.04, 0.016, BLOCK_D - 0.04], [0, SLAB + 0.008, 0]);
  const x = BLOCK_W / 2;
  const zf = BLOCK_D / 2;
  guard(b, [-x, zf + 0.02], [x, zf + 0.02], SLAB);
  for (const side of [-1, 1]) guard(b, [side * x, -zf], [side * x, zf + 0.02], SLAB);
  guard(b, [CORE.x1, -zf], [x, -zf], SLAB);
  for (const side of [-1, 1]) {
    planter(b, [side * 1.95, SLAB, zf - 0.25], [0.32, 0.18, 0.32], "tree", 80 + side);
    planter(b, [side * 2.15, SLAB, -0.6], [0.16, 0.12, 0.9], "shrub", 90 + side);
  }
}

/** Geometry for one storey, positioned with the storey base at y = 0. */
export function buildLevel(id: number) {
  const b = new ArchBuilder();
  if (id === 0) groundLevel(b);
  else if (id === 4) loggiaLevel(b);
  else if (id === 5) penthouseLevel(b);
  else typicalLevel(b, id);
  return b.build();
}

/** Podium, site, service core and other parts that belong to no storey. */
export function buildSite() {
  const b = new ArchBuilder();
  const front = BLOCK_D / 2;
  const podiumFront = front + 0.95;
  const podiumBack = -front - CORE.depth - 0.3;
  const podiumD = podiumFront - podiumBack;

  // Ground: limestone paving with a darker street band beyond.
  b.box("paving", [BLOCK_W + 4.2, 0.04, 7.2], [0, -0.02, 0.6]);
  b.box("granite", [BLOCK_W + 4.2, 0.03, 0.8], [0, -0.025, 4.6]);

  // Granite podium (the visible foundation) the building stands on.
  b.box("granite", [BLOCK_W + 0.9, GROUND_Y, podiumD], [0, GROUND_Y / 2, (podiumFront + podiumBack) / 2], { bevel: 0.008 });
  b.box("travertine", [BLOCK_W + 0.94, 0.02, podiumD + 0.04], [0, GROUND_Y + 0.0, (podiumFront + podiumBack) / 2], { bevel: 0.004 });

  // Entrance steps down from the podium to the street.
  const steps = 3;
  const rise = GROUND_Y / steps;
  for (let i = 0; i < steps; i += 1) {
    const depth = 0.13;
    const z = podiumFront + depth * (i + 0.5);
    b.box("granite", [1.9 + i * 0.12, rise * (steps - i), depth], [0, (rise * (steps - i)) / 2, z], { bevel: 0.004 });
  }

  // Planters with olive trees flanking the entrance, and bollard lights.
  for (const side of [-1, 1]) {
    planter(b, [side * 1.55, GROUND_Y, podiumFront - 0.35], [0.42, 0.3, 0.42], "tree", 10 + side);
    planter(b, [side * 2.55, GROUND_Y, front + 0.45], [0.18, 0.16, 0.95], "shrub", 20 + side);
    for (const z of [podiumFront + 0.7, podiumFront + 1.6]) {
      b.cylinder("bronze", 0.028, 0.24, [side * 1.25, 0.12, z], { segments: 12 });
      b.cylinder("light", 0.029, 0.03, [side * 1.25, 0.2, z], { segments: 12 });
    }
  }

  // Service core: board-formed concrete stair and lift core on the rear,
  // rising past the roof as the lift overrun, with a glazed stair slot.
  const top = GROUND_Y + LEVEL_COUNT * FLOOR_HEIGHT + 0.42;
  const coreW = CORE.x1 - CORE.x0;
  const coreX = (CORE.x0 + CORE.x1) / 2;
  const coreZ = -front - CORE.depth / 2 + 0.02;
  b.box("concrete", [coreW, top - GROUND_Y, CORE.depth + 0.04], [coreX, GROUND_Y + (top - GROUND_Y) / 2, coreZ], { bevel: 0.01 });
  b.box("bronze", [coreW + 0.03, 0.03, CORE.depth + 0.07], [coreX, top + 0.015, coreZ]);
  const slotX = coreX + coreW * 0.22;
  const slotZ = -front - CORE.depth + 0.0;
  for (let level = 0; level < LEVEL_COUNT; level += 1) {
    const y0 = GROUND_Y + level * FLOOR_HEIGHT;
    b.plane("interior", 0.11, FLOOR_HEIGHT - 0.12, [slotX, y0 + FLOOR_HEIGHT / 2, slotZ - 0.002], {
      rot: [0, Math.PI, 0],
      color: scaled(WARM_WALL, 0.55 + hash2(level, 7) * 0.3),
    });
    b.plane("glass", 0.11, FLOOR_HEIGHT - 0.12, [slotX, y0 + FLOOR_HEIGHT / 2, slotZ - 0.006], { rot: [0, Math.PI, 0] });
    b.box("bronze", [0.14, 0.02, 0.02], [slotX, y0 + 0.06, slotZ - 0.01]);
    // Formwork pour joint at each storey.
    b.box("bronze", [coreW + 0.002, 0.006, CORE.depth + 0.042], [coreX, y0, coreZ]);
  }
  return b.build();
}
