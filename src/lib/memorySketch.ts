import type { Stroke } from '../types';

/** Draws normalized (0-1) stroke coordinates onto a canvas sized to `width`x`height`.
 *  Used both for live drawing and for reconstructing the sketch later from stored
 *  stroke data alone (no data URL is ever persisted). */
export function drawStrokes(
  context: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number,
) {
  context.clearRect(0, 0, width, height);
  context.lineCap = 'round';
  context.lineJoin = 'round';

  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.beginPath();
    context.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
    for (let i = 1; i < stroke.points.length; i += 1) {
      context.lineTo(stroke.points[i].x * width, stroke.points[i].y * height);
    }
    context.stroke();
  }
}

/** Rasterizes strokes at a small sample size to estimate the fraction of the
 *  canvas left untouched by the user. */
export function computeEmptyAreaRatio(strokes: Stroke[], sampleSize = 48): number {
  if (strokes.length === 0) return 1;

  const canvas = document.createElement('canvas');
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const context = canvas.getContext('2d');
  if (!context) return 1;

  drawStrokes(context, strokes, sampleSize, sampleSize);
  const { data } = context.getImageData(0, 0, sampleSize, sampleSize);

  let covered = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 10) covered += 1;
  }

  const total = sampleSize * sampleSize;
  return 1 - covered / total;
}
