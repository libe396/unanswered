/**
 * Memory Field — the particle system the Landing scene is built around.
 *
 * The premise: the field is a memory the archive has not finished reconstructing.
 * It drifts through a sequence of half-formed targets — a sphere, a lattice, a
 * wireframe solid, a human outline — and never arrives cleanly at any of them.
 * Three mechanisms guarantee that:
 *
 *  - every particle carries a permanent random offset from its target, so the
 *    form is always slightly dissolved;
 *  - each particle crosses to the next target on its own stagger, so a shape is
 *    still assembling when the next one begins;
 *  - a fraction of the field ignores the targets entirely and drifts as ambient
 *    noise, which keeps a silhouette from ever closing.
 *
 * The pointer is not a cursor the particles follow — it is an interference. It
 * pushes them out of place and spins them, and the only thing that brings them
 * back is the spring toward the target. Stop moving and the reconstruction
 * slowly resumes. That is the whole interaction, and it is the narrative:
 * observation disturbs the record.
 *
 * Simulation runs entirely on the GPU. Position and velocity live in two pairs
 * of float textures that are ping-ponged through a fragment shader each frame
 * (MRT, so one pass writes both), and the render pass reads positions back with
 * texelFetch keyed on gl_VertexID. No per-particle data crosses the bus after
 * init, so particle count is bounded by fill rate rather than by JS.
 *
 * Deliberately no dependency: WebGL2 is enough, and CLAUDE.md asks for a small
 * tree. The figure target is sampled from FIGURE_RULES so the erased subject in
 * lib/figureLight.ts survives here as one of the forms the field passes through.
 */

import { DESIGN_H, DESIGN_W, FIGURE_RULES } from './figureLight';

const TAU = Math.PI * 2;

/** Fraction of the field that never joins a target — ambient archive noise. */
const DRIFTER_RATIO = 0.11;

/**
 * Overall size of the mass in world units, and the proportions of its
 * silhouette. Every target is scaled by these after it is generated, so the
 * mass keeps one consistent, slightly vertical footprint no matter which form
 * it is currently passing through.
 *
 * This is deliberately independent of two other sizes it would be easy to
 * conflate:
 *
 *  - how big an individual particle is drawn (PARTICLE_SIZE_MIN/MAX below —
 *    a screen-space property, unaffected by how large the body is);
 *  - how long the line is that the mass collapses into on entry
 *    (LINE_HALF_LENGTH — an absolute length, because it has to match the
 *    elevator door seam and must not move when the body is resized).
 *
 * Shrinking the body must not shrink the particles or shorten the line.
 */
const FIELD_SCALE = 1.47;
const FIELD_ASPECT: [number, number, number] = [0.86, 1.18, 0.86];

/** Vertical half-extent of the line the mass is wrung into, in world units.
 *  Fixed, not derived from FIELD_SCALE — the elevator seam is cut to this, so
 *  resizing the body must leave the line exactly where it was. */
const LINE_HALF_LENGTH = 0.56;

/**
 * Reach of the pointer's interference, in world units.
 *
 * Absolute, and deliberately not scaled with FIELD_SCALE. The disturbance is
 * meant to be a touch at one spot on the body, so as the body grows the ripple
 * should stay the size it was — scaling it would keep it proportionally huge.
 */
const POINTER_RADIUS = 0.3;

/** Drawn size of one particle, in device pixels before the depth term. Purely
 *  screen-space: the body can be resized without touching these. */
const PARTICLE_SIZE_MIN = 1.75;
const PARTICLE_SIZE_MAX = 3.95;
/** Seconds a target is held before the field starts crossing to the next one. */
const HOLD_SECONDS = 5.5;
/** Seconds the crossing itself takes. Long: the field should read as searching. */
const MORPH_SECONDS = 7;

/** Far enough back that the field sits inside the frame as a contained mass
 *  with black around it, rather than filling the room edge to edge. */
const CAMERA_Z = 3.7;
const FOV_Y = (46 * Math.PI) / 180;

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable per-index hash. Decides drifters, so it must agree across every shape. */
function hash11(i: number): number {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function isDrifter(index: number): boolean {
  return hash11(index * 3 + 11) < DRIFTER_RATIO;
}

/** Box–Muller, for clouds that fall off smoothly instead of ending at a rim. */
function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-6);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * random());
}

/** Uniform point on the unit sphere — direction only, no radius bias. */
function randomDirection(random: () => number): [number, number, number] {
  const z = random() * 2 - 1;
  const theta = random() * TAU;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [Math.cos(theta) * r, z, Math.sin(theta) * r];
}

// ---------------------------------------------------------------------------
// Targets
//
// Every generator writes the same particle index to a different place, so the
// crossing between two targets is a per-index interpolation. Each is authored
// to roughly fill a unit-and-a-bit sphere, so no target reads as a size change.
// ---------------------------------------------------------------------------

type ShapeWriter = (out: Float32Array, count: number, random: () => number) => void;

function writeDrifter(out: Float32Array, i: number, random: () => number) {
  const o = i * 4;
  // Tight enough that the drifters read as the form coming apart at its edge,
  // rather than as a starfield filling the room. Scaled up with everything else
  // afterwards, so this is roughly a third of the field's nominal radius.
  out[o] = gaussian(random) * 0.32;
  out[o + 1] = gaussian(random) * 0.34;
  out[o + 2] = gaussian(random) * 0.28;
}

/**
 * The resting form, and the one the visitor meets first: a filled volume rather
 * than a shell, dense at the core and thinning outward with no defined surface.
 *
 * Two populations make it read as a body instead of a fog. Most particles fall
 * on a centre-weighted radius, which supplies the glow; the rest cluster around
 * a handful of interior nodes, which is what keeps the inside lumpy and organic
 * as it turns over. A shell was the wrong instinct here — it reads as a
 * planet, and the brief asks for something closer to a thought than an object.
 */
const NUCLEUS_NODES = 9;

const writeNucleus: ShapeWriter = (out, count, random) => {
  const nodes: Array<[number, number, number]> = [];
  for (let n = 0; n < NUCLEUS_NODES; n += 1) {
    const dir = randomDirection(random);
    const radius = 0.32 + random() * 0.42;
    nodes.push([dir[0] * radius, dir[1] * radius, dir[2] * radius]);
  }

  for (let i = 0; i < count; i += 1) {
    if (isDrifter(i)) {
      writeDrifter(out, i, random);
      continue;
    }
    const o = i * 4;
    if (random() < 0.42) {
      const node = nodes[Math.floor(random() * nodes.length) % nodes.length];
      out[o] = node[0] + gaussian(random) * 0.28;
      out[o + 1] = node[1] + gaussian(random) * 0.3;
      out[o + 2] = node[2] + gaussian(random) * 0.26;
      continue;
    }
    // Exponent well above the 1/3 that would fill the volume evenly: this is
    // what puts the mass in the core and lets the edge thin out to nothing.
    const radius = Math.pow(random(), 0.82);
    const dir = randomDirection(random);
    out[o] = dir[0] * radius;
    out[o + 1] = dir[1] * radius;
    out[o + 2] = dir[2] * radius;
  }
};

/** Points along the twelve edges of a cube — a wireframe, not a filled solid. */
const writeWireCube: ShapeWriter = (out, count, random) => {
  const corners: Array<[number, number, number]> = [];
  for (let i = 0; i < 8; i += 1) {
    corners.push([(i & 1 ? 1 : -1) * 0.72, (i & 2 ? 1 : -1) * 0.72, (i & 4 ? 1 : -1) * 0.72]);
  }
  const edges: Array<[number, number]> = [];
  for (let a = 0; a < 8; a += 1) {
    for (let b = a + 1; b < 8; b += 1) {
      // Two corners share an edge when they differ in exactly one axis bit.
      const diff = a ^ b;
      if (diff === 1 || diff === 2 || diff === 4) edges.push([a, b]);
    }
  }
  for (let i = 0; i < count; i += 1) {
    if (isDrifter(i)) {
      writeDrifter(out, i, random);
      continue;
    }
    const [a, b] = edges[i % edges.length];
    const t = random();
    const o = i * 4;
    for (let axis = 0; axis < 3; axis += 1) {
      out[o + axis] = corners[a][axis] + (corners[b][axis] - corners[a][axis]) * t + gaussian(random) * 0.022;
    }
  }
};

/** Regular lattice — the most "indexed / catalogued" the field ever looks. */
const writeLattice: ShapeWriter = (out, count, random) => {
  const side = 13;
  for (let i = 0; i < count; i += 1) {
    if (isDrifter(i)) {
      writeDrifter(out, i, random);
      continue;
    }
    const cell = i % (side * side * side);
    const gx = cell % side;
    const gy = Math.floor(cell / side) % side;
    const gz = Math.floor(cell / (side * side)) % side;
    const o = i * 4;
    out[o] = ((gx / (side - 1)) * 2 - 1) * 0.8 + gaussian(random) * 0.02;
    out[o + 1] = ((gy / (side - 1)) * 2 - 1) * 0.8 + gaussian(random) * 0.02;
    out[o + 2] = ((gz / (side - 1)) * 2 - 1) * 0.7 + gaussian(random) * 0.02;
  }
};

/** A slow torus — the field at its most "flowing". */
const writeRing: ShapeWriter = (out, count, random) => {
  for (let i = 0; i < count; i += 1) {
    if (isDrifter(i)) {
      writeDrifter(out, i, random);
      continue;
    }
    const major = random() * TAU;
    const minor = random() * TAU;
    const tube = 0.26 * Math.sqrt(random());
    const radius = 0.82 + Math.cos(minor) * tube;
    const o = i * 4;
    out[o] = Math.cos(major) * radius;
    out[o + 1] = Math.sin(minor) * tube * 1.5;
    out[o + 2] = Math.sin(major) * radius;
  }
};

/** A double helix drawn loosely enough to read as a current, not as DNA. */
const writeStream: ShapeWriter = (out, count, random) => {
  for (let i = 0; i < count; i += 1) {
    if (isDrifter(i)) {
      writeDrifter(out, i, random);
      continue;
    }
    const t = random();
    const strand = i % 2 === 0 ? 0 : Math.PI;
    const angle = t * TAU * 2.1 + strand;
    const radius = 0.52 + Math.sin(t * Math.PI) * 0.24;
    const o = i * 4;
    out[o] = Math.cos(angle) * radius + gaussian(random) * 0.05;
    out[o + 1] = (t * 2 - 1) * 1.02 + gaussian(random) * 0.04;
    out[o + 2] = Math.sin(angle) * radius + gaussian(random) * 0.05;
  }
};

/** Formless. Deliberately in the rotation: the archive loses the thread too. */
const writeCloud: ShapeWriter = (out, count, random) => {
  for (let i = 0; i < count; i += 1) {
    const o = i * 4;
    out[o] = gaussian(random) * 0.46;
    out[o + 1] = gaussian(random) * 0.5;
    out[o + 2] = gaussian(random) * 0.42;
  }
};

/**
 * The subject, sampled from the Light Rule System's ellipses.
 *
 * Weighted by area and tone so the strong cues carry more particles, then
 * scattered hard. It has to survive only as a suggestion of a head and
 * shoulders — the moment it is legible as a face it becomes the horror image
 * this redesign exists to remove.
 */
/**
 * How much of the field each light cue is given.
 *
 * Weighting by area and tone alone spread the particles evenly and the result
 * read as a person-shaped lump. What makes a head legible is its contour, so
 * the ridge of the nose, the jaw and the chin are given two to three times
 * their share, while the cues that would read as features — eye sockets, the
 * brow band, the mouth — are starved. The silhouette firms up and the face
 * stays empty, which is the only version of this that is not frightening.
 */
const FIGURE_EMPHASIS: Record<string, number> = {
  cranium: 1.35,
  foreheadPlane: 1.35,
  templeL: 1.05,
  templeR: 1.05,
  browBand: 0.7,
  socketL: 0.4,
  socketR: 0.4,
  noseBridge: 1.9,
  noseSide: 1.5,
  noseBase: 1.0,
  cheekL: 0.95,
  cheekR: 0.95,
  hollowL: 0.85,
  hollowR: 0.85,
  mouthShadow: 0.45,
  chinLight: 1.5,
  jawShadow: 1.9,
  neckShadow: 1.45,
  neckLight: 1.35,
  clavicle: 1.2,
  chestFall: 0.85,
  chestFallLow: 0.7,
  sideL: 0.75,
  sideR: 0.75,
};

/** The cues that sit on the face rather than on its outline. A head turning
 *  slides these across the skull; the skull and jaw themselves barely move. */
const FIGURE_FACE_CUES = new Set([
  'browBand',
  'socketL',
  'socketR',
  'noseBridge',
  'noseSide',
  'noseBase',
  'cheekL',
  'cheekR',
  'hollowL',
  'hollowR',
  'mouthShadow',
  'chinLight',
]);

interface FigurePose {
  /** In-plane tilt, degrees. Reads as the head leaning. */
  roll: number;
  /** Sideways slide of the face cues only, in normalised units. Reads as the
   *  head turning: a true yaw would do almost nothing to a form this flat. */
  faceShiftX: number;
  /** Downward slide of the face cues. Reads as the gaze dropping. */
  faceShiftY: number;
}

/**
 * Three poses, cycled so the figure is never twice the same.
 *
 * Kept to a few degrees and a few hundredths of a unit. The point is not that
 * the visitor sees a head turn — it is that the apparition is not identical
 * each time it surfaces, which is the difference between a recurring asset and
 * something remembered slightly differently on each occasion.
 */
const FIGURE_POSES: FigurePose[] = [
  { roll: 0, faceShiftX: 0, faceShiftY: 0 },
  { roll: -3.5, faceShiftX: 0.055, faceShiftY: 0.008 },
  { roll: 2.5, faceShiftX: -0.032, faceShiftY: 0.03 },
];

const makeFigureWriter =
  (pose: FigurePose): ShapeWriter =>
  (out, count, random) => {
  const weights: number[] = [];
  let total = 0;
  for (const r of FIGURE_RULES) {
    const w = Math.abs(r.tone) * Math.sqrt(r.rx * r.ry) * (FIGURE_EMPHASIS[r.id] ?? 1);
    total += w;
    weights.push(total);
  }
  const rollSin = Math.sin((pose.roll * Math.PI) / 180);
  const rollCos = Math.cos((pose.roll * Math.PI) / 180);

  for (let i = 0; i < count; i += 1) {
    if (isDrifter(i)) {
      writeDrifter(out, i, random);
      continue;
    }

    const pick = random() * total;
    let index = 0;
    while (index < weights.length - 1 && weights[index] < pick) index += 1;
    const r = FIGURE_RULES[index];

    const angle = random() * TAU;
    const radius = Math.sqrt(random());
    const ex = Math.cos(angle) * radius * r.rx;
    const ey = Math.sin(angle) * radius * r.ry;
    const rot = (r.rot * Math.PI) / 180;
    const px = r.x + ex * Math.cos(rot) - ey * Math.sin(rot);
    const py = r.y + ex * Math.sin(rot) + ey * Math.cos(rot);

    // Scattered in proportion to how readily the cue erodes: the structural
    // ones (skull, jaw, neck) stay crisp enough to draw an outline, the
    // identifying ones stay smeared. Same ordering the Light Rule System uses,
    // reused here rather than restated.
    // Slightly softer overall than a drawn outline would be: the form should
    // look like particles that happened to gather this way, not like features
    // that were placed.
    const blur = 0.03 + r.erosion * 0.075;

    let nx = ((px - DESIGN_W / 2) / (DESIGN_W / 2)) * 0.78 + gaussian(random) * blur;
    let ny = -((py - DESIGN_H * 0.44) / (DESIGN_H / 2)) * 1.06 + gaussian(random) * blur;

    // The face slides across the skull; the outline stays where it is.
    if (FIGURE_FACE_CUES.has(r.id)) {
      nx += pose.faceShiftX;
      ny -= pose.faceShiftY;
    }

    const o = i * 4;
    out[o] = nx * rollCos - ny * rollSin;
    out[o + 1] = nx * rollSin + ny * rollCos;
    // Shallow: a head reads from its outline, and depth only softens it.
    out[o + 2] = gaussian(random) * 0.13;
  }
};

/**
 * Ordered so the figure is always approached from, and left for, an abstract
 * form — it never sits next to another representational shape.
 *
 * Each target carries its own scale because equal radii do not read as equal
 * sizes. The nucleus is centre-weighted, so its outermost particles are too
 * sparse and too dim to register and it reads compact; a lattice or a wireframe
 * populates its full extent and reads enormous at the same nominal radius.
 * Measured on screen, the nucleus occupies 37% × 70% of the frame while the
 * lattice at 0.72 occupied 51% × 95% — visibly bursting out of the room.
 *
 * These are also fighting a fixed term: the breathing and permanent-offset
 * displacements add roughly ±0.23 world units whatever the target's size, so
 * the smaller forms need proportionally more reduction than arithmetic implies.
 * They are tuned by measurement, not by ratio.
 */
interface ShapeTarget {
  /** One writer, or several variants cycled on successive appearances. */
  write: ShapeWriter | ShapeWriter[];
  scale: number;
  /** Seconds held before crossing onward. Defaults to HOLD_SECONDS. */
  hold?: number;
  /** Seconds of the crossing on either side of this target. The shorter of the
   *  two targets' values wins, so setting it here shortens both the gather into
   *  this form and the dispersal out of it. Defaults to MORPH_SECONDS. */
  morph?: number;
}

const SHAPE_TARGETS: ShapeTarget[] = [
  { write: writeNucleus, scale: 1.0 },
  { write: writeLattice, scale: 0.66 },
  // The figure is an apparition, not a form the field rests in: it gathers
  // slowly, is legible for about two seconds, and is already coming apart
  // again. Holding it as long as the abstract shapes turns a memory surfacing
  // into a portrait on display. Three poses, cycled, so it is never twice the
  // same apparition.
  { write: FIGURE_POSES.map(makeFigureWriter), scale: 0.74, hold: 2.0, morph: 4.1 },
  { write: writeCloud, scale: 0.92 },
  { write: writeWireCube, scale: 0.66 },
  { write: writeStream, scale: 0.72 },
  { write: writeRing, scale: 0.64 },
];

/** How many pose variants a target cycles through. */
function variantCount(target: ShapeTarget): number {
  return Array.isArray(target.write) ? target.write.length : 1;
}

/**
 * Generates one target's point set.
 *
 * Called on demand rather than up front. Building every target and every pose
 * at startup cost a 523ms freeze on the first frame — roughly 2.7 million
 * points generated before anything could be drawn, which is the worst possible
 * place in this piece to drop half a second. Each set is now built during the
 * hold before it is needed, where the cost is a single dropped frame nobody is
 * looking for.
 */
function buildShape(count: number, targetIndex: number, variant: number): Float32Array {
  const target = SHAPE_TARGETS[targetIndex];
  const writers = Array.isArray(target.write) ? target.write : [target.write];
  const write = writers[variant % writers.length];
  const scale = FIELD_SCALE * target.scale;

  const data = new Float32Array(count * 4);
  const random = mulberry32(0x5eed + targetIndex * 7919 + variant * 104729);
  write(data, count, random);
  for (let i = 0; i < count; i += 1) {
    const o = i * 4;
    // One set of proportions across every target, so the silhouette stays
    // recognisably the same body as it changes form.
    data[o] *= scale * FIELD_ASPECT[0];
    data[o + 1] *= scale * FIELD_ASPECT[1];
    data[o + 2] *= scale * FIELD_ASPECT[2];
    // Alpha carries a per-particle seed. Constant across every target so a
    // particle keeps the same identity — size, stagger, wobble, tint — as it
    // moves.
    data[o + 3] = hash11(i);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const QUAD_VERT = `#version 300 es
in vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

/** Vertical half-extent of the body itself, used only to normalise a particle's
 *  height before it is remapped onto the fixed line length. */
const FIELD_HALF_HEIGHT = FIELD_SCALE * FIELD_ASPECT[1];

/**
 * Hard ceiling on the body's radius, in aspect-normalised world units.
 *
 * Per-target scale factors alone could not hold this. A centre-weighted form
 * and a fully-populated lattice read at completely different sizes for the same
 * nominal radius, and the breathing terms add a fixed displacement on top that
 * hurts the small forms most — measured, the field ranged from 25% to 100% of
 * the frame height across one morph cycle. Rather than keep guessing seven
 * numbers, the extent is bounded here: tanh leaves small radii untouched and
 * asymptotes to this limit, so the body can never leave the room whatever
 * geometry it is passing through, including any target added later.
 */
const FIELD_LIMIT = FIELD_SCALE * 0.95;

/** Compile-time constants rather than uniforms: none of these change at
 *  runtime, and baking them keeps the per-frame uniform set to the things that
 *  actually vary. */
const SHADER_CONSTANTS = `
#define FIELD_HALF_HEIGHT ${FIELD_HALF_HEIGHT.toFixed(4)}
#define FIELD_LIMIT ${FIELD_LIMIT.toFixed(4)}
#define FIELD_ASPECT vec3(${FIELD_ASPECT.map((v) => v.toFixed(4)).join(', ')})
#define LINE_HALF_LENGTH ${LINE_HALF_LENGTH.toFixed(4)}
#define PARTICLE_SIZE_MIN ${PARTICLE_SIZE_MIN.toFixed(4)}
#define PARTICLE_SIZE_MAX ${PARTICLE_SIZE_MAX.toFixed(4)}
`;

const SIM_FRAG = `#version 300 es
precision highp float;
${SHADER_CONSTANTS}

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform sampler2D uHomeFrom;
uniform sampler2D uHomeTo;
uniform float uMorph;
uniform float uTime;
uniform float uDelta;
uniform vec3 uPointer;
uniform float uPointerPower;
uniform float uPointerRadius;
uniform float uHover;
uniform float uCollapse;

layout(location = 0) out vec4 outPosition;
layout(location = 1) out vec4 outVelocity;

/* Cheap divergence-light flow. Sines rather than gradient noise: this only has
   to breathe, and it is evaluated once per particle per frame. */
vec3 flow(vec3 p, float t) {
  return vec3(
    sin(p.y * 1.7 + t * 0.31) + sin(p.z * 1.3 - t * 0.21),
    sin(p.z * 1.9 + t * 0.27) + sin(p.x * 1.1 - t * 0.19),
    sin(p.x * 1.5 + t * 0.23) + sin(p.y * 1.7 - t * 0.25)
  );
}

void main() {
  ivec2 cell = ivec2(gl_FragCoord.xy);
  vec4 P = texelFetch(uPosition, cell, 0);
  vec4 V = texelFetch(uVelocity, cell, 0);

  vec3 position = P.xyz;
  float seed = P.w;
  vec3 velocity = V.xyz;
  float disturbance = V.w;

  /* Per-particle stagger across the crossing. The field is always partly
     arrived and partly still travelling — no frame where the form is whole. */
  float stagger = fract(seed * 7.31);
  float m = clamp((uMorph - stagger * 0.34) / 0.66, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);

  vec3 home = mix(texelFetch(uHomeFrom, cell, 0).xyz, texelFetch(uHomeTo, cell, 0).xyz, m);

  /* Permanent offset: the reconstruction is never finished. */
  float a = seed * 43.0;
  home += vec3(sin(a), cos(a * 1.7), sin(a * 2.3)) * 0.08;

  /* Breathing, on two scales so it never reads as a single pulse. Hover opens
     the mass slightly and quickens the interior without moving it anywhere. */
  float agitation = 1.0 + uHover * 0.55;
  home += flow(home * 0.62, uTime * agitation) * 0.055 * agitation;
  home += flow(home * 1.9 + 11.0, uTime * 0.6) * 0.022;
  home *= 1.0 + 0.035 * sin(uTime * 0.17 + seed * 6.2831) + uHover * 0.04;

  /* Soft ceiling, applied in aspect-normalised space so the ellipse keeps its
     proportions instead of rounding off at the extremes. Identity near the
     centre, asymptotic at the edge — nothing is clipped onto a shell. */
  vec3 normalised = home / FIELD_ASPECT;
  float extent = length(normalised) + 1e-5;
  home = normalised * ((FIELD_LIMIT * tanh(extent / FIELD_LIMIT)) / extent) * FIELD_ASPECT;

  /*
    Entry. The mass is drawn into a single vertical line: first the horizontal
    axes close, then the vertical extent compresses, so it reads as something
    being wrung out rather than simply scaled down. The residual jitter is faded
    out with it, because a line made of scattered particles is a smudge — the
    last frame has to be clean enough to cut against the elevator door seam.
  */
  if (uCollapse > 0.0) {
    float radial = 1.0 - smoothstep(0.0, 0.66, uCollapse);
    float toLine = smoothstep(0.30, 1.0, uCollapse);
    home.xz *= radial * radial;
    /* Mapped onto an absolute length rather than scaled by a fraction. Scaling
       would tie the line to the body's size, and the line has to stay matched
       to the elevator seam however large or small the body is made. */
    float ySign = home.y < 0.0 ? -1.0 : 1.0;
    float yNorm = clamp(abs(home.y) / FIELD_HALF_HEIGHT, 0.0, 1.0);
    home.y = mix(home.y, ySign * yNorm * LINE_HALF_LENGTH, toLine);
    home.xz += vec2(sin(seed * 91.0), cos(seed * 57.0)) * 0.02 * radial;
  }

  /* Stiffening as it collapses is what makes the gather feel decisive: the same
     spring that idles slowly enough to breathe would take ten seconds to close. */
  float stiffness = mix(2.7, 36.0, uCollapse);
  velocity += (home - position) * (stiffness * uDelta);

  /* Slow differential turn, so the interior is always rearranging itself even
     when nothing is touching it. Faster at the core than at the edge — a rigid
     rotation reads as a spinning object rather than as something alive. */
  vec3 axis = normalize(vec3(0.16, 1.0, 0.07));
  float spin = 0.075 * (1.0 - 0.5 * clamp(length(position) / 2.1, 0.0, 1.0));
  velocity += cross(axis, position) * spin * uDelta * agitation * (1.0 - uCollapse);

  /* Interference. Radial push plus a tangential component, so a pass of the
     pointer opens the field and turns it rather than only shoving it aside. */
  vec3 offset = position - uPointer;
  float dist = length(offset) + 1e-4;
  float falloff = exp(-(dist * dist) / (uPointerRadius * uPointerRadius));
  float influence = falloff * uPointerPower;
  vec3 pushDir = offset / dist;
  vec3 swirl = normalize(cross(pushDir, vec3(0.0, 0.0, 1.0)) + vec3(1e-5));
  velocity += (pushDir * 2.0 + swirl * 0.95) * influence * uDelta * 9.5 * (1.0 - uCollapse);

  /* Memory of having been disturbed. Rises instantly, releases over seconds —
     this is what the render pass tints, so the trace outlives the gesture. */
  disturbance = max(disturbance * exp(-uDelta * 0.6), influence);

  /* Just under critical damping for the collapsed spring (2*sqrt(36) = 12), so
     it closes on the line fast with the faintest overshoot rather than crawling. */
  velocity *= exp(-uDelta * mix(2.15, 11.5, uCollapse));
  position += velocity * uDelta;

  outPosition = vec4(position, seed);
  outVelocity = vec4(velocity, disturbance);
}
`;

const RENDER_VERT = `#version 300 es
precision highp float;
${SHADER_CONSTANTS}

uniform sampler2D uPosition;
uniform sampler2D uVelocity;
uniform mat4 uProjection;
uniform mat4 uView;
uniform int uTextureWidth;
uniform float uPixelRatio;
uniform float uTime;
uniform float uHover;
uniform float uCollapse;
uniform vec3 uCalm;
uniform vec3 uTintA;
uniform vec3 uTintB;
uniform vec3 uTintC;
uniform vec3 uTintD;
uniform float uChroma;

out float vDisturbance;
out float vDepth;
out float vSeed;
out vec3 vColor;

void main() {
  ivec2 cell = ivec2(gl_VertexID % uTextureWidth, gl_VertexID / uTextureWidth);
  vec4 P = texelFetch(uPosition, cell, 0);
  vec4 V = texelFetch(uVelocity, cell, 0);

  vec4 viewPosition = uView * vec4(P.xyz, 1.0);
  gl_Position = uProjection * viewPosition;

  float depth = -viewPosition.z;
  vDisturbance = V.w;
  vDepth = depth;
  vSeed = P.w;

  /*
    Colour. Four cool tints blended per particle from its seed, then pulled most
    of the way back to white — the field has to read as achromatic at a glance
    and only show its blue/violet/cyan/mint on inspection. The second term makes
    the mixture drift slowly through the body, so the chroma is internal weather
    rather than a fixed pattern painted on.
  */
  float pickA = fract(P.w * 17.0);
  float pickB = fract(P.w * 53.0);
  vec3 tint = mix(mix(uTintA, uTintB, pickA), mix(uTintC, uTintD, pickA), pickB);
  float drift = 0.5 + 0.5 * sin(uTime * 0.13 + P.x * 1.3 + P.y * 0.9 + P.w * 6.2831);

  /*
    Colour falls off toward the body's edge, so the lavender lives in the dense
    middle and the outskirts stay near-white. Whitening each particle's halo was
    not enough on its own: every pixel receives a similar mix of nearby cores
    and distant halos, so it desaturated the whole field evenly instead of
    leaving the spread of light colourless. Tying the hue to where a particle
    sits in the mass is what actually confines it to the centre.
  */
  float radial = length(P.xyz / FIELD_ASPECT) / FIELD_LIMIT;
  float centreness = 1.0 - smoothstep(0.12, 0.95, radial);

  float chroma = uChroma * (0.35 + 0.65 * drift) * mix(0.22, 1.0, centreness);
  vColor = mix(uCalm, tint, chroma);

  /* Screen-space only. Independent of how large the body is — shrinking the
     mass must make the mass smaller, not the particles in it. */
  float base = mix(PARTICLE_SIZE_MIN, PARTICLE_SIZE_MAX, fract(P.w * 13.0));
  float swell = 1.0 + V.w * 0.8 + uHover * 0.18 + uCollapse * 0.5;
  gl_PointSize = uPixelRatio * base * (2.5 / max(depth, 0.4)) * swell;
}
`;

const RENDER_FRAG = `#version 300 es
precision highp float;

in float vDisturbance;
in float vDepth;
in float vSeed;
in vec3 vColor;

uniform vec3 uDisturbed;
uniform vec3 uSignal;
uniform float uIntensity;
uniform float uHover;
uniform float uCollapse;
uniform float uHaloWhitening;

out vec4 fragColor;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float r = length(uv);
  if (r > 0.5) discard;

  /*
    Bloom without a bloom pass: a tight bright core inside a much wider, much
    fainter halo. Overlapping halos are what produce the glow, so the effect
    scales with density exactly the way a real one would, for the cost of two
    smoothsteps instead of a second framebuffer and a blur.
  */
  /* The core's radius is widened without touching the halo's, so each particle
     reads as a more definite point rather than the whole field getting foggier.
     Growing gl_PointSize instead would have widened both. */
  float core = smoothstep(0.34, 0.02, r);
  float halo = smoothstep(0.5, 0.0, r);
  float coreAlpha = core * 0.82;
  /* Lighter than it was: with the halo whitened, too much of it accumulates
     into a flat sheet of white and the individual particles stop reading. */
  float haloAlpha = halo * halo * 0.19;

  /* Depth fade doubles as the atmospheric haze that keeps the far side of the
     field from reading as a second, separate cloud. */
  float fade = mix(0.26, 0.92, clamp((3.6 - vDepth) / 2.4, 0.0, 1.0))
    * mix(0.72, 1.0, fract(vSeed * 31.0));
  float gain = uIntensity
    * (0.62 + vDisturbance * 0.55)
    * (1.0 + uHover * 0.28)
    * (1.0 + uCollapse * 2.4);

  vec3 tint = mix(vColor, uDisturbed, clamp(vDisturbance * 0.95, 0.0, 1.0));
  /* On entry everything converges on the one colour the elevator will be lit in. */
  tint = mix(tint, uSignal, uCollapse * 0.72);

  /*
    The colour is held inside the core and the halo is pulled back toward white.
    Tinting the whole sprite made the lavender read as paint applied to each
    particle and turned the accumulated bloom into a violet wash; confining it
    this way leaves the spread of light almost colourless and lets the hue show
    only where the particles are densest — which is the light-from-within the
    brief is after.
  */
  vec3 haloTint = mix(tint, vec3(1.0), uHaloWhitening);

  float coreWeight = coreAlpha * fade * gain;
  float haloWeight = haloAlpha * fade * gain;
  fragColor = vec4(
    tint * coreWeight + haloTint * haloWeight,
    coreWeight + haloWeight
  );
}
`;

// ---------------------------------------------------------------------------
// GL helpers
// ---------------------------------------------------------------------------

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`MemoryField shader failed to compile: ${log}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const program = gl.createProgram()!;
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`MemoryField program failed to link: ${log}`);
  }
  return program;
}

function createFloatTexture(gl: WebGL2RenderingContext, size: number, data: Float32Array | null) {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

/** Column-major perspective, written out rather than pulled from a matrix lib. */
function perspective(out: Float32Array, fovY: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fovY / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
}

/** Translation only. Under perspective that is already true parallax — near
 *  particles sweep further across the frame than far ones — without the camera
 *  ever turning, which is what keeps the space meditative. */
function translation(out: Float32Array, x: number, y: number, z: number) {
  out.fill(0);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  out[12] = -x;
  out[13] = -y;
  out[14] = -z;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export interface MemoryFieldRenderer {
  /** Sizes the drawing buffer. `dpr` should already be clamped by the caller. */
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  /** Pointer in CSS pixels relative to the canvas. `active` false releases it. */
  setPointer(x: number, y: number, active: boolean): void;
  /** 0–1. Eased internally; callers pass the raw on/off state. */
  setHover(hovered: boolean): void;
  /** 0–1 entry progress. The caller owns the easing curve and the timing. */
  setCollapse(progress: number): void;
  /** Advances the simulation and draws one frame. */
  frame(time: number, delta: number): void;
  /** Runs the simulation without drawing — used to settle the still frame. */
  settle(steps: number): void;
  /** Draws without advancing. */
  draw(): void;
  dispose(): void;
}

export function createMemoryField(
  canvas: HTMLCanvasElement,
  particleTextureSize: number,
): MemoryFieldRenderer | null {
  // Premultiplied, because the field is additive light composited over the room
  // gradient behind it. With straight alpha the browser multiplies each pixel by
  // an accumulated alpha that additive blending never drives above a few percent,
  // and the whole field disappears into the background.
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    powerPreference: 'high-performance',
  });

  // No WebGL2, or no float render targets: the caller falls back rather than
  // showing a black rectangle where the exhibition's cover should be.
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;

  const size = particleTextureSize;
  const count = size * size;
  // Built on demand and kept, keyed by target and pose.
  const shapeCache = new Map<string, Float32Array>();
  function getShape(targetIndex: number, variant: number): Float32Array {
    const target = SHAPE_TARGETS[targetIndex];
    const pose = variant % variantCount(target);
    const key = `${targetIndex}:${pose}`;
    let data = shapeCache.get(key);
    if (!data) {
      data = buildShape(count, targetIndex, pose);
      shapeCache.set(key, data);
    }
    return data;
  }
  const firstShape = getShape(0, 0);

  const simProgram = link(gl, QUAD_VERT, SIM_FRAG);
  const renderProgram = link(gl, RENDER_VERT, RENDER_FRAG);

  // Fullscreen triangle for the simulation pass.
  const quadVao = gl.createVertexArray()!;
  const quadBuffer = gl.createBuffer()!;
  gl.bindVertexArray(quadVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const quadLocation = gl.getAttribLocation(simProgram, 'aPosition');
  gl.enableVertexAttribArray(quadLocation);
  gl.vertexAttribPointer(quadLocation, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // The render pass reads everything from textures, so it needs a bound VAO but
  // no attribute buffers at all.
  const pointVao = gl.createVertexArray()!;

  // Seed positions on the first target, nudged outward so the opening frames
  // are the field converging rather than a shape simply appearing.
  const initial = new Float32Array(count * 4);
  const seedRandom = mulberry32(0x1d0a);
  for (let i = 0; i < count; i += 1) {
    const o = i * 4;
    // Modest: the opening should be the mass drawing itself together over a
    // couple of seconds, not a long fall inward from off screen.
    const spread = 1.25 + seedRandom() * 0.9;
    initial[o] = firstShape[o] * spread + gaussian(seedRandom) * 0.35;
    initial[o + 1] = firstShape[o + 1] * spread + gaussian(seedRandom) * 0.35;
    initial[o + 2] = firstShape[o + 2] * spread + gaussian(seedRandom) * 0.35;
    initial[o + 3] = firstShape[o + 3];
  }

  const positionTextures = [
    createFloatTexture(gl, size, initial),
    createFloatTexture(gl, size, initial),
  ];
  const velocityTextures = [
    createFloatTexture(gl, size, new Float32Array(count * 4)),
    createFloatTexture(gl, size, new Float32Array(count * 4)),
  ];
  const homeTextures = [
    createFloatTexture(gl, size, firstShape),
    createFloatTexture(gl, size, getShape(1, 0)),
  ];

  const framebuffers = [0, 1].map((index) => {
    const framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      positionTextures[index],
      0,
    );
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT1,
      gl.TEXTURE_2D,
      velocityTextures[index],
      0,
    );
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    return framebuffer;
  });

  // Float MRT is the one thing here a driver can advertise and still refuse.
  const complete = framebuffers.every((framebuffer) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!complete) return null;

  const sim = {
    position: gl.getUniformLocation(simProgram, 'uPosition'),
    velocity: gl.getUniformLocation(simProgram, 'uVelocity'),
    homeFrom: gl.getUniformLocation(simProgram, 'uHomeFrom'),
    homeTo: gl.getUniformLocation(simProgram, 'uHomeTo'),
    morph: gl.getUniformLocation(simProgram, 'uMorph'),
    time: gl.getUniformLocation(simProgram, 'uTime'),
    delta: gl.getUniformLocation(simProgram, 'uDelta'),
    pointer: gl.getUniformLocation(simProgram, 'uPointer'),
    pointerPower: gl.getUniformLocation(simProgram, 'uPointerPower'),
    pointerRadius: gl.getUniformLocation(simProgram, 'uPointerRadius'),
    hover: gl.getUniformLocation(simProgram, 'uHover'),
    collapse: gl.getUniformLocation(simProgram, 'uCollapse'),
  };

  const render = {
    position: gl.getUniformLocation(renderProgram, 'uPosition'),
    velocity: gl.getUniformLocation(renderProgram, 'uVelocity'),
    projection: gl.getUniformLocation(renderProgram, 'uProjection'),
    view: gl.getUniformLocation(renderProgram, 'uView'),
    textureWidth: gl.getUniformLocation(renderProgram, 'uTextureWidth'),
    pixelRatio: gl.getUniformLocation(renderProgram, 'uPixelRatio'),
    time: gl.getUniformLocation(renderProgram, 'uTime'),
    calm: gl.getUniformLocation(renderProgram, 'uCalm'),
    disturbed: gl.getUniformLocation(renderProgram, 'uDisturbed'),
    signal: gl.getUniformLocation(renderProgram, 'uSignal'),
    tintA: gl.getUniformLocation(renderProgram, 'uTintA'),
    tintB: gl.getUniformLocation(renderProgram, 'uTintB'),
    tintC: gl.getUniformLocation(renderProgram, 'uTintC'),
    tintD: gl.getUniformLocation(renderProgram, 'uTintD'),
    chroma: gl.getUniformLocation(renderProgram, 'uChroma'),
    intensity: gl.getUniformLocation(renderProgram, 'uIntensity'),
    hover: gl.getUniformLocation(renderProgram, 'uHover'),
    collapse: gl.getUniformLocation(renderProgram, 'uCollapse'),
    haloWhitening: gl.getUniformLocation(renderProgram, 'uHaloWhitening'),
  };

  const projectionMatrix = new Float32Array(16);
  const viewMatrix = new Float32Array(16);

  let read = 0;
  let write = 1;
  let viewportWidth = 1;
  let viewportHeight = 1;
  let pixelRatio = 1;
  let aspect = 1;

  // Pointer state, in world units on the z = 0 plane.
  const pointer = { x: 0, y: 0 };
  const pointerTarget = { x: 0, y: 0 };
  let pointerPower = 0;
  let pointerPowerTarget = 0;
  let hover = 0;
  let hoverTarget = 0;
  let collapse = 0;
  let renderTime = 0;
  const parallax = { x: 0, y: 0 };

  // Morph scheduling. `shapeIndex` counts upward forever: the target data is
  // shapes[shapeIndex % shapes.length] and it lives in homeTextures[shapeIndex % 2],
  // so the two home slots simply alternate as the sequence advances.
  let shapeIndex = 0;
  let phaseSeconds = 0;
  let uploadedNext = false;
  let heldMorph = 0;

  function bindTexture(unit: number, texture: WebGLTexture, location: WebGLUniformLocation | null) {
    gl!.activeTexture(gl!.TEXTURE0 + unit);
    gl!.bindTexture(gl!.TEXTURE_2D, texture);
    gl!.uniform1i(location, unit);
  }

  function advanceMorph(delta: number) {
    phaseSeconds += delta;

    const current = SHAPE_TARGETS[shapeIndex % SHAPE_TARGETS.length];
    const upcoming = SHAPE_TARGETS[(shapeIndex + 1) % SHAPE_TARGETS.length];
    const holdSeconds = current.hold ?? HOLD_SECONDS;
    // The shorter of the pair, so a brief target is brief coming and going.
    const morphSeconds = Math.min(current.morph ?? MORPH_SECONDS, upcoming.morph ?? MORPH_SECONDS);

    if (phaseSeconds < holdSeconds) {
      // Upload the next target during the hold, never during the crossing, so
      // the texture write can never land inside an animating frame.
      if (!uploadedNext && phaseSeconds > holdSeconds * 0.4) {
        // Which variant depends on how many full rotations of the sequence
        // have passed, so a target with several poses shows a different one
        // each time it comes round.
        const nextTarget = (shapeIndex + 1) % SHAPE_TARGETS.length;
        const cycle = Math.floor((shapeIndex + 1) / SHAPE_TARGETS.length);
        const nextData = getShape(nextTarget, cycle);
        gl!.bindTexture(gl!.TEXTURE_2D, homeTextures[(shapeIndex + 1) % 2]);
        gl!.texSubImage2D(gl!.TEXTURE_2D, 0, 0, 0, size, size, gl!.RGBA, gl!.FLOAT, nextData);
        uploadedNext = true;
      }
      return shapeIndex % 2;
    }

    const t = Math.min((phaseSeconds - holdSeconds) / morphSeconds, 1);
    if (t >= 1) {
      shapeIndex += 1;
      phaseSeconds = 0;
      uploadedNext = false;
      return shapeIndex % 2;
    }

    // The crossing runs from the slot holding the current target to the slot
    // holding the next one, and those slots alternate — so an odd index counts
    // 1 → 0 and an even one counts 0 → 1.
    return shapeIndex % 2 === 1 ? 1 - t : t;
  }

  function simulate(time: number, delta: number, morph: number) {
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, framebuffers[write]);
    gl!.viewport(0, 0, size, size);
    gl!.disable(gl!.BLEND);
    gl!.useProgram(simProgram);
    gl!.bindVertexArray(quadVao);

    bindTexture(0, positionTextures[read], sim.position);
    bindTexture(1, velocityTextures[read], sim.velocity);
    bindTexture(2, homeTextures[0], sim.homeFrom);
    bindTexture(3, homeTextures[1], sim.homeTo);

    gl!.uniform1f(sim.morph, morph);
    gl!.uniform1f(sim.time, time);
    gl!.uniform1f(sim.delta, delta);
    gl!.uniform3f(sim.pointer, pointer.x, pointer.y, 0);
    gl!.uniform1f(sim.pointerPower, pointerPower);
    gl!.uniform1f(sim.pointerRadius, POINTER_RADIUS);
    gl!.uniform1f(sim.hover, hover);
    gl!.uniform1f(sim.collapse, collapse);

    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    gl!.bindVertexArray(null);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);

    read = write;
    write = 1 - write;
  }

  function drawField() {
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.viewport(0, 0, viewportWidth, viewportHeight);
    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.enable(gl!.BLEND);
    // Additive over premultiplied output: density is what makes the glow, so no
    // single particle needs to be bright.
    gl!.blendFunc(gl!.ONE, gl!.ONE);

    gl!.useProgram(renderProgram);
    gl!.bindVertexArray(pointVao);

    bindTexture(0, positionTextures[read], render.position);
    bindTexture(1, velocityTextures[read], render.velocity);

    perspective(projectionMatrix, FOV_Y, aspect, 0.1, 20);
    translation(viewMatrix, parallax.x, parallax.y, CAMERA_Z);

    gl!.uniformMatrix4fv(render.projection, false, projectionMatrix);
    gl!.uniformMatrix4fv(render.view, false, viewMatrix);
    gl!.uniform1i(render.textureWidth, size);
    gl!.uniform1f(render.pixelRatio, pixelRatio);
    gl!.uniform1f(render.time, renderTime);
    // Near-white base, and a lavender that only ever arrives where touched.
    gl!.uniform3f(render.calm, 0.93, 0.93, 0.96);
    gl!.uniform3f(render.disturbed, 0.79, 0.71, 0.95);
    // Three lavenders and one muted blue. The previous set spread across blue,
    // violet, cyan and mint, and neighbouring particles in opposite corners of
    // that range averaged back to white — which is why the field read as
    // colourless however high the chroma went. Keeping every tint inside one
    // hue family lets the mixture stay lavender instead of cancelling.
    // All four sit on the violet side of blue — red above green by about half
    // the amount blue is, which is hue ~268° and reads as lavender rather than
    // as blue. The previous set included a tint with green above red; averaged
    // against its neighbours that pulled the whole field to hue 250°, measurably
    // blue, which is why the lavender never appeared however high chroma went.
    gl!.uniform3f(render.tintA, 0.74, 0.48, 1.0);
    gl!.uniform3f(render.tintB, 0.80, 0.55, 1.0);
    gl!.uniform3f(render.tintC, 0.70, 0.46, 0.96);
    // The one genuinely blue tint of the four, so the mixture keeps a trace of
    // cool blue inside the lavender instead of being uniformly violet.
    gl!.uniform3f(render.tintD, 0.60, 0.62, 1.0);
    // Raised, but the halo whitening below keeps it from reaching the bloom —
    // more hue where the particles are, no more violet in the spread.
    gl!.uniform1f(render.chroma, 0.86);
    // The colour the whole field converges on as it is drawn into the line, and
    // the colour the elevator is lit in on the other side of the cut.
    gl!.uniform3f(render.signal, 0.62, 0.70, 0.95);
    // Tuned against the drawing buffer: dense regions peak around 150–190 of 255.
    // Bright enough that individual particles read as particles, dim enough that
    // the field is lit rather than emitting. Lower than it looks like it should
    // be because the same particle count in a smaller body is roughly twice as
    // dense on screen, and density is what sets the apparent brightness here.
    // Holds brightness steady against the chroma: the tints sit well below
    // white in luminance, so mixing more of them in costs exposure that has to
    // be paid back here rather than by desaturating.
    gl!.uniform1f(render.intensity, 0.6);
    gl!.uniform1f(render.hover, hover);
    gl!.uniform1f(render.collapse, collapse);
    // How far the halo is pulled back to white. High: the spread of light is
    // near-colourless and only the dense centres carry the lavender.
    gl!.uniform1f(render.haloWhitening, 0.82);

    gl!.drawArrays(gl!.POINTS, 0, count);
    gl!.bindVertexArray(null);
  }

  return {
    resize(cssWidth, cssHeight, dpr) {
      pixelRatio = dpr;
      viewportWidth = Math.max(1, Math.round(cssWidth * dpr));
      viewportHeight = Math.max(1, Math.round(cssHeight * dpr));
      canvas.width = viewportWidth;
      canvas.height = viewportHeight;
      aspect = cssWidth / Math.max(cssHeight, 1);
    },

    setPointer(x, y, active) {
      pointerPowerTarget = active ? 1 : 0;
      if (!active) return;
      // Exact inverse of the projection for the z = 0 plane, which is where the
      // field is centred — cheaper and steadier than un-projecting a ray.
      const halfHeight = Math.tan(FOV_Y / 2) * CAMERA_Z;
      const ndcX = (x / Math.max(viewportWidth / pixelRatio, 1)) * 2 - 1;
      const ndcY = 1 - (y / Math.max(viewportHeight / pixelRatio, 1)) * 2;
      pointerTarget.x = ndcX * halfHeight * aspect;
      pointerTarget.y = ndcY * halfHeight;
    },

    setHover(hovered) {
      hoverTarget = hovered ? 1 : 0;
    },

    setCollapse(progress) {
      collapse = Math.max(0, Math.min(1, progress));
    },

    frame(time, delta) {
      renderTime = time;
      // The pointer itself is eased, so a fast flick still arrives as a swell
      // through the field rather than as a jump.
      const ease = 1 - Math.exp(-delta / 0.09);
      pointer.x += (pointerTarget.x - pointer.x) * ease;
      pointer.y += (pointerTarget.y - pointer.y) * ease;
      pointerPower += (pointerPowerTarget - pointerPower) * (1 - Math.exp(-delta / 0.25));
      // Slow enough that crossing the edge of the field is a swell, not a switch.
      hover += (hoverTarget - hover) * (1 - Math.exp(-delta / 0.42));

      const parallaxEase = 1 - Math.exp(-delta / 1.5);
      parallax.x += (pointerTarget.x * 0.045 - parallax.x) * parallaxEase;
      parallax.y += (pointerTarget.y * 0.035 - parallax.y) * parallaxEase;

      // The form is frozen once entry begins. Letting it keep crossing to the
      // next target while it is being wrung into a line produces a gather that
      // fights itself.
      const morph = collapse > 0 ? heldMorph : advanceMorph(delta);
      heldMorph = morph;
      simulate(time, delta, morph);
      drawField();
    },

    settle(steps) {
      // Interaction state is cleared, but `collapse` deliberately is not: the
      // reduced-motion entry sets it and then settles onto the line, and
      // clearing it here would silently undo that.
      pointerPower = 0;
      hover = 0;
      hoverTarget = 0;
      // Half the frame time of a 60Hz tick. Integration here is explicit Euler,
      // and at 0.016 the circulation term injects enough energy per step to
      // inflate the orbits — the settled field measured half again as large as
      // the same field running live. Smaller steps, more of them.
      for (let i = 0; i < steps; i += 1) simulate(i * 0.008, 0.008, 0);
    },

    draw() {
      drawField();
    },

    dispose() {
      positionTextures.forEach((texture) => gl.deleteTexture(texture));
      velocityTextures.forEach((texture) => gl.deleteTexture(texture));
      homeTextures.forEach((texture) => gl.deleteTexture(texture));
      framebuffers.forEach((framebuffer) => gl.deleteFramebuffer(framebuffer));
      gl.deleteBuffer(quadBuffer);
      gl.deleteVertexArray(quadVao);
      gl.deleteVertexArray(pointVao);
      gl.deleteProgram(simProgram);
      gl.deleteProgram(renderProgram);
      // Deliberately no WEBGL_lose_context here. getContext returns the same
      // context object for the life of the element, so losing it would leave a
      // dead context bound to a canvas that is about to be mounted again —
      // which is exactly what StrictMode's double mount does.
    },
  };
}
