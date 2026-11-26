import { useMemo } from "react";
import * as THREE from "three";

// Original abstract paintings, painted procedurally onto a canvas: layered
// colour washes with a single ink line, in the hotel's ochre/sage/ink palette.
// Each variant is a different composition.

type Wash = [x: number, y: number, r: number, color: string, alpha: number];

const VARIANTS: { ground: string; washes: Wash[]; line: [number, number][] }[] = [
  {
    ground: "#e8ddca",
    washes: [
      [0.29, 0.65, 0.34, "#c08a4e", 0.55],
      [0.68, 0.55, 0.31, "#7d8a6a", 0.5],
      [0.85, 0.78, 0.21, "#2f3a3c", 0.45],
      [0.16, 0.31, 0.18, "#d9b98a", 0.5],
    ],
    line: [[0.05, 0.7], [0.29, 0.52], [0.49, 0.81], [0.68, 0.62], [0.8, 0.52], [0.96, 0.55]],
  },
  {
    ground: "#e4d8c4",
    washes: [
      [0.5, 0.42, 0.42, "#8f9a7c", 0.5],
      [0.3, 0.72, 0.28, "#b57d52", 0.55],
      [0.72, 0.78, 0.22, "#3b4442", 0.4],
      [0.62, 0.2, 0.2, "#d8c09a", 0.6],
    ],
    line: [[0.1, 0.45], [0.3, 0.38], [0.45, 0.5], [0.62, 0.36], [0.9, 0.42]],
  },
  {
    ground: "#ebe1d0",
    washes: [
      [0.35, 0.35, 0.36, "#2f3b3d", 0.38],
      [0.62, 0.62, 0.34, "#c4925a", 0.5],
      [0.2, 0.78, 0.24, "#9aa184", 0.45],
      [0.82, 0.3, 0.18, "#d6b88c", 0.55],
    ],
    line: [[0.08, 0.6], [0.24, 0.66], [0.42, 0.55], [0.58, 0.72], [0.92, 0.64]],
  },
];

export function useAbstractArt(variant = 0, aspect = 2) {
  return useMemo(() => {
    const { ground, washes, line } = VARIANTS[variant % VARIANTS.length];
    const width = 768;
    const height = Math.round(width / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, width, height);
    const size = Math.max(width, height);
    for (const [x, y, r, color, alpha] of washes) {
      const g = ctx.createRadialGradient(x * width, y * height, 0, x * width, y * height, r * size);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
    // Paper/canvas grain.
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 3000; i += 1) {
      ctx.fillStyle = i % 2 ? "#ffffff" : "#000000";
      ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
    }
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = "#2a2522";
    ctx.lineWidth = 3;
    ctx.beginPath();
    line.forEach(([x, y], i) => (i ? ctx.lineTo(x * width, y * height) : ctx.moveTo(x * width, y * height)));
    ctx.stroke();
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [variant, aspect]);
}
