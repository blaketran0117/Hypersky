/** Renders the aircraft silhouette to an ImageData for map.addImage — one per altitude band. */

// Right half of a jet silhouette in unit space: x 0..1, y -1 (nose) .. 1 (tail).
const RIGHT_HALF: [number, number][] = [
  [0.0, -1.0],
  [0.09, -0.78],
  [0.11, -0.3],
  [0.95, 0.16],
  [0.95, 0.28],
  [0.12, 0.2],
  [0.1, 0.6],
  [0.4, 0.84],
  [0.4, 0.95],
  [0.04, 0.86],
  [0.0, 0.88],
];

export function createPlaneImage(color: string, size = 64): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas unavailable");

  const cx = size / 2;
  const cy = size / 2;
  const scale = (size / 2) * 0.86;

  ctx.beginPath();
  ctx.moveTo(cx + RIGHT_HALF[0][0] * scale, cy + RIGHT_HALF[0][1] * scale);
  for (let i = 1; i < RIGHT_HALF.length; i++) {
    ctx.lineTo(cx + RIGHT_HALF[i][0] * scale, cy + RIGHT_HALF[i][1] * scale);
  }
  for (let i = RIGHT_HALF.length - 1; i >= 0; i--) {
    ctx.lineTo(cx - RIGHT_HALF[i][0] * scale, cy + RIGHT_HALF[i][1] * scale);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  // Hairline dark outline keeps light icons legible over bright basemap labels.
  ctx.strokeStyle = "rgba(5, 8, 12, 0.9)";
  ctx.lineWidth = size / 32;
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}
