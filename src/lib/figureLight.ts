/**
 * Light Rule System for the Hero Figure.
 *
 * This is not an illustration. The figure is described as a set of *rules about
 * where light falls on a face*, and the renderer paints them. Nothing here
 * draws an eye, a nose or a mouth — it places a brow shadow, a nose-side
 * shadow, a cheekbone plane, a jaw boundary. The face is whatever those cues
 * add up to, which is why it can come apart again without ever having been a
 * drawing of anybody.
 *
 * Two things keep it from reading as assembled shapes:
 *  - every cue is painted with a noise-eroded brush, so no boundary is a clean
 *    gradient edge;
 *  - the cues overlap densely enough that no single one is separable.
 *
 * Deliberately achromatic. The renderer caps how light the lightest value can
 * get, because the figure has to look *lit*, never self-illuminated.
 */

const TAU = Math.PI * 2;

/** Design space the rules are authored in. The renderer scales to the canvas. */
export const DESIGN_W = 400;
export const DESIGN_H = 560;

/** Ceiling on accumulated light. Well below white — the moment the highlights
 *  approach white the figure starts to glow instead of being lit. */
const LIGHT_CEIL = 0.62;
const BASE_TONE = 58;

export interface FigureRule {
  id: string;
  /** Ellipse centre and radii, in design px. */
  x: number;
  y: number;
  rx: number;
  ry: number;
  /** Rotation in degrees. */
  rot: number;
  /** Negative = shadow, positive = light. Magnitude is paint alpha. */
  tone: number;
  /** Which eroded brush to paint with. Varying this stops repeated cues from
   *  sharing a recognisable texture. */
  brush: number;
  /** How readily this cue dissolves as the figure is observed. The structural
   *  cues (skull, shoulders) stay; the identifying ones (cheekbone, socket,
   *  mouth shadow) go first. That ordering is the whole point: what erodes is
   *  precisely what would let you name the person. */
  erosion: number;
  /** Autonomous drift in design px, and its period in Hz. */
  drift: [number, number];
  freq: [number, number];
  phase: [number, number];
  /** How far the cursor may bias this cue, in design px. Mixed signs across
   *  rules so the group never resolves into "following the pointer". */
  cursor: [number, number];
  /** Slow intensity wobble depth. Starts at zero deviation so the first frame
   *  is the intact portrait. */
  wobble: number;
  wobbleFreq: number;
}

type RuleSpec = Partial<FigureRule> & Pick<FigureRule, 'id' | 'x' | 'y' | 'rx' | 'ry' | 'tone'>;

function rule(spec: RuleSpec, index: number): FigureRule {
  // Deterministic spread of drift phases/frequencies so cues never resynchronise
  // into a visible pulse, without hand-authoring 23 sets of numbers.
  const s = index * 2.399963;
  return {
    rot: 0,
    brush: index % 5,
    erosion: 0.4,
    drift: [2.2 + (index % 3) * 0.9, 1.6 + (index % 4) * 0.7],
    freq: [0.021 + (index % 5) * 0.004, 0.017 + (index % 7) * 0.003],
    phase: [s % TAU, (s * 1.7) % TAU],
    cursor: [index % 2 === 0 ? 3.4 : -2.8, index % 3 === 0 ? -2.4 : 2.0],
    wobble: 0.18,
    wobbleFreq: 0.023 + (index % 6) * 0.005,
    ...spec,
  } as FigureRule;
}

/**
 * A front-lit portrait, top light slightly to the figure's left.
 * Ordered roughly back-to-front so later cues sit on top of earlier ones.
 */
export const FIGURE_RULES: FigureRule[] = [
  // --- skull and its planes -------------------------------------------------
  { id: 'cranium', x: 200, y: 120, rx: 78, ry: 54, tone: 0.4, erosion: 0.18 },
  { id: 'foreheadPlane', x: 192, y: 152, rx: 58, ry: 34, tone: 0.3, erosion: 0.34 },
  { id: 'templeL', x: 134, y: 150, rx: 27, ry: 41, tone: -0.28, erosion: 0.3 },
  { id: 'templeR', x: 266, y: 147, rx: 25, ry: 38, tone: -0.32, erosion: 0.3 },

  // --- the brow / eye region ------------------------------------------------
  // One continuous band, with two shallow depressions inside it. Never two
  // isolated dark spots on a blank head: that is read as a pair of eyes
  // instantly, no matter how it is positioned.
  { id: 'browBand', x: 200, y: 172, rx: 70, ry: 19, tone: -0.4, erosion: 0.5 },
  { id: 'socketL', x: 166, y: 177, rx: 25, ry: 14, tone: -0.26, erosion: 0.74 },
  { id: 'socketR', x: 237, y: 174, rx: 22, ry: 12, tone: -0.22, erosion: 0.82 },

  // --- nose: a ridge of light and the shadow beside and beneath it ----------
  { id: 'noseBridge', x: 202, y: 190, rx: 13, ry: 35, tone: 0.28, erosion: 0.46 },
  { id: 'noseSide', x: 184, y: 199, rx: 11, ry: 29, tone: -0.26, erosion: 0.56 },
  { id: 'noseBase', x: 203, y: 212, rx: 17, ry: 9, tone: -0.3, erosion: 0.7 },

  // --- cheekbones and the hollows under them --------------------------------
  { id: 'cheekL', x: 156, y: 196, rx: 31, ry: 25, tone: 0.29, erosion: 0.8 },
  { id: 'cheekR', x: 246, y: 193, rx: 28, ry: 22, tone: 0.25, erosion: 0.86 },
  { id: 'hollowL', x: 150, y: 223, rx: 27, ry: 20, tone: -0.24, erosion: 0.6 },
  { id: 'hollowR', x: 252, y: 219, rx: 24, ry: 18, tone: -0.21, erosion: 0.62 },

  // --- mouth and chin: shadow only, never a lip line ------------------------
  { id: 'mouthShadow', x: 201, y: 232, rx: 25, ry: 9, tone: -0.2, erosion: 0.78 },
  { id: 'chinLight', x: 200, y: 248, rx: 21, ry: 13, tone: 0.23, erosion: 0.56 },

  // --- jaw boundary and neck ------------------------------------------------
  { id: 'jawShadow', x: 200, y: 267, rx: 53, ry: 15, tone: -0.46, erosion: 0.42 },
  { id: 'neckShadow', x: 200, y: 293, rx: 45, ry: 27, tone: -0.32, erosion: 0.28 },
  { id: 'neckLight', x: 211, y: 317, rx: 22, ry: 27, tone: 0.15, erosion: 0.34 },

  // --- body -----------------------------------------------------------------
  // Kept well down in value. The face is the thing being investigated; a bright
  // chest turns the bust into a lit slab and pulls the eye straight off it.
  { id: 'clavicle', x: 200, y: 358, rx: 74, ry: 24, tone: 0.12, erosion: 0.18 },
  { id: 'chestFall', x: 200, y: 452, rx: 138, ry: 78, tone: -0.44, erosion: 0.12 },
  { id: 'chestFallLow', x: 200, y: 528, rx: 170, ry: 62, tone: -0.5, erosion: 0.08 },
  { id: 'sideL', x: 48, y: 468, rx: 84, ry: 88, tone: -0.56, erosion: 0.1 },
  { id: 'sideR', x: 352, y: 464, rx: 82, ry: 86, tone: -0.58, erosion: 0.1 },
].map((spec, index) => rule(spec as RuleSpec, index));

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

function hash2(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x: number, y: number, seed: number, octaves: number) {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Brushes
// ---------------------------------------------------------------------------

const BRUSH_SIZE = 192;
const BRUSH_COUNT = 5;

/**
 * A soft ellipse whose falloff is chewed up by fractal noise, so its edge is a
 * ragged trace rather than a gradient ramp. Built once, then reused for every
 * cue — this is the single thing that removes the "Gradient Tool" read.
 */
function createBrush(seed: number, ink: 0 | 255) {
  const canvas = document.createElement('canvas');
  canvas.width = BRUSH_SIZE;
  canvas.height = BRUSH_SIZE;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(BRUSH_SIZE, BRUSH_SIZE);
  const data = image.data;
  const r = BRUSH_SIZE / 2;
  // Coarse noise carves the silhouette of the stroke; fine noise breaks up the
  // interior so the paint never looks like flat airbrush.
  const coarse = 26 + (seed % 3) * 7;
  const fine = 7 + (seed % 4) * 2;

  for (let y = 0; y < BRUSH_SIZE; y++) {
    for (let x = 0; x < BRUSH_SIZE; x++) {
      const dx = (x - r) / r;
      const dy = (y - r) / r;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let a = 1 - dist;
      if (a > 0) {
        a = a * a * (3 - 2 * a);
        const nc = fbm(x / coarse, y / coarse, seed, 4);
        const nf = fbm(x / fine, y / fine, seed + 37, 3);
        a *= 0.18 + 1.25 * nc;
        a *= 0.78 + 0.34 * nf;
        a = a > 1 ? 1 : a;
      } else {
        a = 0;
      }
      const i = (y * BRUSH_SIZE + x) * 4;
      data[i] = ink;
      data[i + 1] = ink;
      data[i + 2] = ink;
      data[i + 3] = (a * 255) | 0;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function createGrain(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(size, size);
  const data = image.data;
  for (let i = 0; i < size * size; i++) {
    const v = (hash2(i % size, (i / size) | 0, 991) * 255) | 0;
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 26;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

// ---------------------------------------------------------------------------
// Silhouette
// ---------------------------------------------------------------------------

/**
 * One continuous bust outline at real proportions: cranium widest just above
 * the ear line, the sides falling to the jaw angle, then a concave sweep into
 * the neck. The chin is *not* on this outline — in a front view the neck is
 * narrower than the jaw, so the jaw line belongs to the shading (see
 * `jawShadow`), not to the silhouette. Getting that wrong is what makes a bust
 * read as a head balanced on a stem.
 */
function tracePath(context: CanvasRenderingContext2D, sx: number, sy: number) {
  const p = (x: number, y: number) => [x * sx, y * sy] as const;
  context.beginPath();
  context.moveTo(...p(200, 58));
  context.bezierCurveTo(...p(243, 58), ...p(274, 94), ...p(274, 136));
  context.bezierCurveTo(...p(274, 176), ...p(266, 208), ...p(252, 228));
  context.bezierCurveTo(...p(246, 250), ...p(243, 262), ...p(242, 284));
  context.bezierCurveTo(...p(241, 310), ...p(244, 326), ...p(250, 340));
  context.bezierCurveTo(...p(280, 352), ...p(330, 372), ...p(362, 398));
  context.bezierCurveTo(...p(388, 420), ...p(400, 448), ...p(400, 480));
  context.lineTo(...p(400, 560));
  context.lineTo(...p(0, 560));
  context.lineTo(...p(0, 480));
  context.bezierCurveTo(...p(0, 448), ...p(12, 420), ...p(38, 398));
  context.bezierCurveTo(...p(70, 372), ...p(120, 352), ...p(150, 340));
  context.bezierCurveTo(...p(156, 326), ...p(159, 310), ...p(158, 284));
  context.bezierCurveTo(...p(157, 262), ...p(154, 250), ...p(148, 228));
  context.bezierCurveTo(...p(134, 208), ...p(126, 176), ...p(126, 136));
  context.bezierCurveTo(...p(126, 94), ...p(157, 58), ...p(200, 58));
  context.closePath();
}

function createMask(width: number, height: number, grain: HTMLCanvasElement) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  const sx = width / DESIGN_W;
  const sy = height / DESIGN_H;

  context.filter = `blur(${Math.max(2, width * 0.011)}px)`;
  context.fillStyle = '#fff';
  tracePath(context, sx, sy);
  context.fill();
  context.filter = 'none';

  // Bite irregular notches out of the softened edge so the body dissolves into
  // the room instead of ending on a traceable contour.
  context.globalCompositeOperation = 'destination-out';
  context.globalAlpha = 0.5;
  const tile = grain.width;
  for (let y = 0; y < height; y += tile) {
    for (let x = 0; x < width; x += tile) context.drawImage(grain, x, y);
  }
  context.globalAlpha = 1;

  // The shoulders run off the frame, so without this they end on the canvas
  // boundary as three straight cuts. Fading the outer margins lets the body
  // leave the picture by running out of light instead of being trimmed.
  const bottom = context.createLinearGradient(0, height * 0.66, 0, height);
  bottom.addColorStop(0, 'rgba(0,0,0,0)');
  bottom.addColorStop(1, 'rgba(0,0,0,0.96)');
  context.fillStyle = bottom;
  context.fillRect(0, height * 0.66, width, height * 0.34);

  const left = context.createLinearGradient(0, 0, width * 0.17, 0);
  left.addColorStop(0, 'rgba(0,0,0,0.98)');
  left.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = left;
  context.fillRect(0, 0, width * 0.17, height);

  const right = context.createLinearGradient(width, 0, width * 0.83, 0);
  right.addColorStop(0, 'rgba(0,0,0,0.98)');
  right.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = right;
  context.fillRect(width * 0.83, 0, width * 0.17, height);

  context.globalCompositeOperation = 'source-over';
  return canvas;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export interface FigureRenderState {
  /** Seconds since the figure appeared. */
  time: number;
  /** 0..1 accumulated observation. Drives erosion — never legibility. */
  energy: number;
  /** Smoothed, lagged cursor offset from the head, each in -1..1. */
  cursorX: number;
  cursorY: number;
}

export function createFigureRenderer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')!;
  const lightBrushes: HTMLCanvasElement[] = [];
  const darkBrushes: HTMLCanvasElement[] = [];
  for (let i = 0; i < BRUSH_COUNT; i++) {
    lightBrushes.push(createBrush(i * 7 + 3, 255));
    darkBrushes.push(createBrush(i * 7 + 3, 0));
  }
  const grain = createGrain(128);
  let mask: HTMLCanvasElement | null = null;
  let width = 0;
  let height = 0;

  function resize(cssWidth: number, cssHeight: number, dpr: number) {
    width = Math.max(1, Math.round(cssWidth * dpr));
    height = Math.max(1, Math.round(cssHeight * dpr));
    canvas.width = width;
    canvas.height = height;
    mask = createMask(width, height, grain);
  }

  function render(state: FigureRenderState) {
    if (!mask || !width || !height) return;
    const sx = width / DESIGN_W;
    const sy = height / DESIGN_H;
    const { time, energy, cursorX, cursorY } = state;

    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
    context.clearRect(0, 0, width, height);

    // The tone the whole figure sits on. Everything else adds light or takes it
    // away from here.
    context.fillStyle = `rgb(${BASE_TONE}, ${BASE_TONE}, ${BASE_TONE + 4})`;
    context.fillRect(0, 0, width, height);

    for (const r of FIGURE_RULES) {
      // Wobble starts at exactly 1 (cos 0), so the first frame is the portrait
      // intact — a quiet person, not something already wrong.
      const wob = 1 - r.wobble * (1 - Math.cos(time * r.wobbleFreq * TAU + r.phase[0])) * 0.5;
      const strength = Math.abs(r.tone) * wob * (1 - r.erosion * energy);
      if (strength <= 0.002) continue;

      const dx =
        r.drift[0] * Math.sin(time * r.freq[0] * TAU + r.phase[0]) * (1 + energy * 1.6) +
        cursorX * r.cursor[0] * energy;
      const dy =
        r.drift[1] * Math.cos(time * r.freq[1] * TAU + r.phase[1]) * (1 + energy * 1.6) +
        cursorY * r.cursor[1] * energy;

      const brush = r.tone > 0 ? lightBrushes[r.brush] : darkBrushes[r.brush];
      context.save();
      context.translate((r.x + dx) * sx, (r.y + dy) * sy);
      if (r.rot) context.rotate((r.rot * Math.PI) / 180);
      context.globalAlpha = Math.min(r.tone > 0 ? LIGHT_CEIL : 1, strength);
      context.drawImage(brush, -r.rx * sx, -r.ry * sy, r.rx * 2 * sx, r.ry * 2 * sy);
      context.restore();
    }

    // The 5% of colour. Cool in the shadow side, the faintest warm violet where
    // the light lands — enough to stop the greys going dead, never enough to be
    // noticed as colour.
    context.globalAlpha = 0.05;
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = 'rgb(96, 128, 132)';
    context.fillRect(0, 0, width, height * 0.55);
    context.globalAlpha = 0.045;
    context.fillStyle = 'rgb(126, 108, 156)';
    context.fillRect(0, height * 0.3, width, height * 0.7);

    context.globalAlpha = 1;
    context.globalCompositeOperation = 'overlay';
    const tile = grain.width;
    for (let y = 0; y < height; y += tile) {
      for (let x = 0; x < width; x += tile) context.drawImage(grain, x, y);
    }

    context.globalCompositeOperation = 'destination-in';
    context.drawImage(mask, 0, 0);
    context.globalCompositeOperation = 'source-over';
  }

  return { resize, render };
}
