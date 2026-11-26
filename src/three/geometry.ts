import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

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
