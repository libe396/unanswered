/**
 * One particle skin, repeatedly cut, folded, unrolled and sewn back together.
 * Every index owns the same stratified (u, v) on every target. No volume fill,
 * drifters, random target reassignment, meshes or new rendering passes.
 * The existing float-texture spring simulation retains pointer interference
 * and the fixed vertical-line handoff to the elevator.
 */
const TAU = Math.PI * 2;
const FIELD_SCALE = 0.92;
const LINE_HALF_LENGTH = 0.56;
const POINTER_RADIUS = 0.3;
const PARTICLE_SIZE_MIN = 1.75;
const PARTICLE_SIZE_MAX = 3.95;
const CAMERA_Z = 3.7;
const FOV_Y = (46 * Math.PI) / 180;

function hash11(i: number): number {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type Surface = (u: number, v: number) => [number, number, number, number];
const rim = (distance: number) => Math.exp(-distance * 180);

/** Equal-area sphere. Tilt is shared by the cut plane and its descendants. */
function shell(u: number, v: number, cut: boolean): [number, number, number, number] {
  const y = cut ? -0.48 + 1.48 * Math.pow(1 - v, 1.18) : 1 - 2 * v;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = TAU * u;
  return [radius * Math.cos(angle), y, radius * Math.sin(angle), cut ? rim(1 - v) : 0];
}

/** Eight large curved panels, still indexed to the original sphere's skin. */
function panel(u: number, v: number, folded: boolean): [number, number, number, number] {
  const sector = Math.min(3, Math.floor(u * 4));
  const band = Math.min(1, Math.floor(v * 2));
  const localU = u * 4 - sector;
  const localV = v * 2 - band;
  const pu = (sector + 0.035 + localU * 0.93) / 4;
  const pv = (band + 0.045 + localV * 0.91) / 2;
  let [x, y, z] = shell(pu, pv, true);
  const angle = (sector + 0.5) * TAU / 4;
  const nx = Math.cos(angle), nz = Math.sin(angle);
  const cy = band === 0 ? 0.58 : -0.23;
  const cr = Math.sqrt(1 - cy * cy);
  // Flatten each curved panel toward its own tangent plane, then hinge it.
  const normalDistance = x * nx + z * nz - cr;
  const flatten = folded ? 0.8 : 0;
  x -= nx * normalDistance * flatten;
  z -= nz * normalDistance * flatten;
  const hinge = (folded ? 0.48 : 0.10) * (band === 0 ? 1 : -1)
    * (sector % 2 === 0 ? 1 : -1);
  const tangent = -x * nz + z * nx;
  const dy = y - cy;
  const rotatedTangent = tangent * Math.cos(hinge) - dy * Math.sin(hinge);
  y = cy + tangent * Math.sin(hinge) + dy * Math.cos(hinge);
  const radial = x * nx + z * nz + (folded ? 0.08 : 0.07);
  x = nx * radial - nz * rotatedTangent;
  z = nz * radial + nx * rotatedTangent;
  y += band === 0 ? 0.045 : -0.045;
  const edge = rim(Math.min(localU, 1 - localU, localV, 1 - localV));
  return [x, y, z, edge];
}

const sphere: Surface = (u, v) => shell(u, v, false);
const cutSphere: Surface = (u, v) => shell(u, v, true);
const segmented: Surface = (u, v) => panel(u, v, false);
const folded: Surface = (u, v) => panel(u, v, true);
const rolled: Surface = (u, v) => {
  const t = (u - 0.5) * Math.PI * 1.7;
  const h = 1 - 2 * v;
  const radius = 0.68 + 0.12 * h;
  return [Math.sin(t) * radius, h * 0.9 + Math.sin(t) * 0.14,
    Math.cos(t) * radius - 0.13, rim(Math.min(u, 1 - u, v, 1 - v))];
};
const ribbon: Surface = (u, v) => {
  const h = 1 - 2 * v;
  const twist = h * Math.PI * 0.92;
  const width = (u * 2 - 1) * (0.62 + 0.2 * h * h);
  return [width * Math.cos(twist) + 0.18 * Math.sin(h * Math.PI), h * 1.08,
    width * Math.sin(twist), rim(Math.min(u, 1 - u, v, 1 - v))];
};

// Anatomical sections of one anonymous bust, from temple to upper torso.
// Monotone tangents keep the jaw and shoulder joins smooth without overshoot.
const PORTRAIT_PROFILE = [
  [0.72, 0.285], [0.58, 0.274], [0.46, 0.239],
  [0.34, 0.181], [0.28, 0.125], [0.17, 0.128], [0.11, 0.171],
  [0.04, 0.30], [-0.03, 0.46], [-0.14, 0.65], [-0.26, 0.724],
  [-0.50, 0.73], [-1, 0.66],
] as const;
const portraitSlopes = PORTRAIT_PROFILE.map(([y, width], i, profile) => {
  if (i === 0) return 0;
  if (i === profile.length - 1) return 0.14;
  const before = (width - profile[i - 1][1]) / (y - profile[i - 1][0]);
  const after = (profile[i + 1][1] - width) / (profile[i + 1][0] - y);
  return before * after <= 0 ? 0 : 2 * before * after / (before + after);
});

function portraitWidth(y: number): number {
  if (y >= 0.72) {
    return 0.285 * Math.sqrt(Math.max(0, 1 - ((y - 0.72) / 0.28) ** 2));
  }
  let i = 0;
  while (i < PORTRAIT_PROFILE.length - 2 && y < PORTRAIT_PROFILE[i + 1][0]) i += 1;
  const [top, a] = PORTRAIT_PROFILE[i];
  const [bottom, b] = PORTRAIT_PROFILE[i + 1];
  const span = bottom - top;
  const t = (y - top) / span;
  return (2 * t ** 3 - 3 * t ** 2 + 1) * a
    + (t ** 3 - 2 * t ** 2 + t) * span * portraitSlopes[i]
    + (-2 * t ** 3 + 3 * t ** 2) * b
    + (t ** 3 - t ** 2) * span * portraitSlopes[i + 1];
}

// A turned head and relaxed shoulders give the skin human volume.
// The face has no eyes or expression; identity remains open to the visitor.
const portraitTrace: Surface = (u, v) => {
  const y = 1 - 2 * v;
  const ease = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
  const radius = portraitWidth(y);
  const angle = TAU * u;
  const side = Math.cos(angle);
  const front = Math.sin(angle);
  const head = ease((y - 0.22) / 0.14);
  const depth = y > 0.28 ? radius * 0.94 : 0.13 + 0.16 * ease((0.28 - y) / 0.8);
  const ear = 0.026 * Math.exp(-(((y - 0.53) / 0.07) ** 2)) * Math.abs(side) ** 12;
  let x = (radius + ear) * side;
  let z = depth * front;
  // Broad cheek planes and a small nose ridge, rather than a painted-on face.
  const face = Math.max(0, front);
  z += head * (0.07 * Math.exp(-(((y - 0.55) / 0.06) ** 2)) * face ** 28
    + 0.025 * Math.exp(-(((y - 0.49) / 0.11) ** 2)) * face ** 3
    + 0.035 * Math.exp(-(((y - 0.35) / 0.055) ** 2)) * face ** 8);
  const yaw = -1.08 * head;
  const turnedX = x * Math.cos(yaw) + z * Math.sin(yaw);
  z = -x * Math.sin(yaw) + z * Math.cos(yaw);
  x = turnedX - 0.026 * head;
  const shoulder = ease((0.17 - y) / 0.32);
  return [x, y + 0.023 * side * shoulder, z, 0];
};

// Keep the existing surfaces and their continuous crossings, returning to a
// human trace between abstractions. Flat forms have only brief holds.
const SHAPE_TARGETS = [
  { surface: portraitTrace, hold: 2.2, morph: 1.8 },
  { surface: sphere, hold: 0.7, morph: 1.0 },
  { surface: cutSphere, hold: 0.7, morph: 1.6 },
  { surface: segmented, hold: 1.0, morph: 1.8 },
  { surface: folded, hold: 0.8, morph: 1.9 },
  { surface: portraitTrace, hold: 1.4, morph: 1.8 },
  { surface: rolled, hold: 0.7, morph: 1.6 },
  { surface: ribbon, hold: 0.6, morph: 2.4 },
];

function buildShape(count: number, _targetIndex: number): Float32Array {
  const data = new Float32Array(count * 4);
  const side = Math.sqrt(count);
  for (let i = 0; i < count; i += 1) {
    // Fixed small within-cell jitter avoids scan lines without changing the
    // correspondence or adding thickness. Neighbours remain surface neighbours.
    const u = (i % side + 0.2 + hash11(i * 2 + 17) * 0.6) / side;
    const v = (Math.floor(i / side) + 0.2 + hash11(i * 2 + 31) * 0.6) / side;
    const [x, y, z, edge] = SHAPE_TARGETS[0].surface(u, v);
    const o = i * 4;
    // An oblique cut reads as an opening, instead of a horizontal missing cap.
    data[o] = (x * Math.cos(0.06) - y * Math.sin(0.06)) * FIELD_SCALE;
    data[o + 1] = (x * Math.sin(0.06) + y * Math.cos(0.06)) * FIELD_SCALE;
    data[o + 2] = z * FIELD_SCALE;
    data[o + 3] = edge;
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

// Preserve the original collapse height mapping independently of shell size.
const FIELD_HALF_HEIGHT = 1.47 * 1.18;

/** Compile-time constants rather than uniforms: none of these change at
 *  runtime, and baking them keeps the per-frame uniform set to the things that
 *  actually vary. */
const SHADER_CONSTANTS = `
#define FIELD_HALF_HEIGHT ${FIELD_HALF_HEIGHT.toFixed(4)}
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
uniform mat4 uView;
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

  // One interpolation fraction for neighbours: a surface throughout the morph.
  float m = uMorph * uMorph * (3.0 - 2.0 * uMorph);
  vec3 home = mix(texelFetch(uHomeFrom, cell, 0).xyz, texelFetch(uHomeTo, cell, 0).xyz, m);
  // Coherent sub-pixel breathing, never random volume offsets.
  home += flow(home, uTime * 0.35) * 0.002 * (1.0 - uCollapse);

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

  /* A responsive, damped spring keeps the travelling skin thin. Entry retains
     the original collapse spring and damping for the elevator match cut. */
  float stiffness = mix(48.0, 36.0, uCollapse);
  velocity += (home - position) * (stiffness * uDelta);

  /* Interference. Radial push plus a tangential component, so a pass of the
     pointer opens the field and turns it rather than only shoving it aside. */
  // Compare in view space so interference still meets the visible layers
  // after rotation. Perspective follows the cursor ray through their depths.
  vec3 viewed = (uView * vec4(position, 1.0)).xyz;
  vec2 ray = uPointer.xy * (-viewed.z / ${CAMERA_Z.toFixed(4)});
  vec3 offset = vec3(viewed.xy - ray, position.z * 0.32);
  float dist = length(offset) + 1e-4;
  float falloff = exp(-(dist * dist) / (uPointerRadius * uPointerRadius));
  float influence = falloff * uPointerPower;
  vec3 pushDir = offset / dist;
  vec3 swirl = normalize(cross(pushDir, vec3(0.0, 0.0, 1.0)) + vec3(1e-5));
  velocity += transpose(mat3(uView)) * (pushDir * 2.0 + swirl * 0.95) * influence * uDelta * 9.5 * (1.0 - uCollapse);

  /* Memory of having been disturbed. Rises instantly, releases over seconds —
     this is what the render pass tints, so the trace outlives the gesture. */
  disturbance = max(disturbance * exp(-uDelta * 0.6), influence);

  /* Just under critical damping for the collapsed spring (2*sqrt(36) = 12), so
     it closes on the line fast with the faintest overshoot rather than crawling. */
  velocity *= exp(-uDelta * mix(12.0, 11.5, uCollapse));
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
uniform sampler2D uHomeFrom;
uniform sampler2D uHomeTo;
uniform float uMorph;
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
out float vSurfaceLight;

void main() {
  ivec2 cell = ivec2(gl_VertexID % uTextureWidth, gl_VertexID / uTextureWidth);
  vec4 P = texelFetch(uPosition, cell, 0);
  vec4 V = texelFetch(uVelocity, cell, 0);

  // Remove the spring's last lateral residue during the existing line hold.
  // Thin sheets otherwise leave tiny slits even when the target is on-axis.
  vec3 drawnPosition = P.xyz;
  drawnPosition.xz *= 1.0 - smoothstep(0.82, 1.0, uCollapse);
  vec4 viewPosition = uView * vec4(drawnPosition, 1.0);
  gl_Position = uProjection * viewPosition;

  float depth = -viewPosition.z;
  vDisturbance = V.w * (1.0 - uCollapse);
  vDepth = depth;
  vSeed = P.w;

  // Actual skin normals from two adjacent simulated particles. This also
  // catches folds and the temporary dents made by the pointer.
  ivec2 stepX = ivec2(cell.x < uTextureWidth - 1 ? 1 : -1, 0);
  ivec2 stepY = ivec2(0, cell.y < uTextureWidth - 1 ? 1 : -1);
  vec3 dx = texelFetch(uPosition, cell + stepX, 0).xyz - P.xyz;
  vec3 dy = texelFetch(uPosition, cell + stepY, 0).xyz - P.xyz;
  vec3 normal = normalize(mat3(uView) * cross(dx, dy) + vec3(1e-10));
  float facing = abs(dot(normal, normalize(-viewPosition.xyz)));
  float rimLight = pow(1.0 - facing, 2.0);
  float m = uMorph * uMorph * (3.0 - 2.0 * uMorph);
  float edge = mix(texelFetch(uHomeFrom, cell, 0).w, texelFetch(uHomeTo, cell, 0).w, m);
  vSurfaceLight = mix(0.8 + rimLight * 0.8 + edge * 4.5, 1.0, uCollapse);


  /*
    Stable near-white grains. The existing lavender/blue palette is strongest
    at a cut, a grazing edge, or a disturbed patch, not across the whole skin.
  */
  float pickA = fract(P.w * 17.0);
  float pickB = fract(P.w * 53.0);
  vec3 tint = mix(mix(uTintA, uTintB, pickA), mix(uTintC, uTintD, pickA), pickB);

  float chroma = uChroma * (0.10 + edge * 0.55 + rimLight * 0.18 + vDisturbance * 0.25);
  vColor = mix(uCalm, tint, chroma);

  /* Screen-space only. Independent of how large the body is — shrinking the
     mass must make the mass smaller, not the particles in it. */
  float base = mix(PARTICLE_SIZE_MIN, PARTICLE_SIZE_MAX, fract(P.w * 13.0));
  float swell = 1.0 + vDisturbance * 0.8 + uHover * 0.18 + uCollapse * 0.5;
  float depthSize = mix(clamp(1.0 + (3.7 - depth) * 0.14, 0.8, 1.2), 1.0, uCollapse);
  gl_PointSize = uPixelRatio * base * (2.5 / max(depth, 0.4)) * swell * depthSize;
}
`;

const RENDER_FRAG = `#version 300 es
precision highp float;

in float vDisturbance;
in float vDepth;
in float vSeed;
in vec3 vColor;
in float vSurfaceLight;

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
  float core = (1.0 - smoothstep(0.02, 0.34, r));
  float halo = (1.0 - smoothstep(0.0, 0.5, r));
  float coreAlpha = core * 0.82;
  /* Lighter than it was: with the halo whitened, too much of it accumulates
     into a flat sheet of white and the individual particles stop reading. */
  float haloAlpha = halo * halo * mix(0.035, 0.19, uCollapse);

  /* Depth fade doubles as the atmospheric haze that keeps the far side of the
     field from reading as a second, separate cloud. */
  float atmosphere = mix(0.055, 0.43, (1.0 - smoothstep(2.8, 4.5, vDepth)));
  float fade = mix(atmosphere, 0.26, uCollapse)
    * mix(0.72, 1.0, fract(vSeed * 31.0));
  // A fixed sparse bright population makes individual grains legible at
  // this large GPU count; the remaining skin stays faint, never vanishes.
  float grain = mix(0.10, 4.8, step(0.84, fract(vSeed * 97.0)));
  float gain = uIntensity * vSurfaceLight * mix(grain, 1.0, uCollapse)
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

/** Slow automatic yaw exposes the skin; the pointer adds a heavily eased offset. */
function fieldView(out: Float32Array, x: number, y: number, release: number, time: number) {
  const angle = -0.22 + Math.sin(time * 0.10) * 0.025 + Math.max(-1, Math.min(1, x)) * 0.0873;
  // The shortest route back to neutral, even after many unattended loops.
  const yaw = Math.atan2(Math.sin(angle), Math.cos(angle)) * release;
  const pitch = (-0.08 + Math.sin(time * 0.17) * 0.012 - Math.max(-1, Math.min(1, y)) * 0.0698) * release;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cx = Math.cos(pitch), sx = Math.sin(pitch);
  out.fill(0);
  out[0] = cy; out[1] = sx * sy; out[2] = -cx * sy;
  out[5] = cx; out[6] = sx;
  out[8] = sy; out[9] = -sx * cy; out[10] = cx * cy;
  out[12] = -x * 0.045 * release;
  out[13] = -y * 0.035 * release;
  out[14] = -CAMERA_Z;
  out[15] = 1;
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
  // Generate each skin once, lazily. The same targets recur on every loop.
  const shapeCache = new Map<number, Float32Array>();
  function getShape(targetIndex: number): Float32Array {
    let data = shapeCache.get(targetIndex);
    if (!data) {
      data = buildShape(count, targetIndex);
      shapeCache.set(targetIndex, data);
    }
    return data;
  }
  const firstShape = getShape(0);

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

  // The opening is already a thin shell; the existing Landing opacity reveal
  // brings it into the room. No volume cloud before the first readable form.
  const initial = firstShape.slice();
  for (let i = 0; i < count; i += 1) initial[i * 4 + 3] = hash11(i);

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
    createFloatTexture(gl, size, getShape(1)),
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
    view: gl.getUniformLocation(simProgram, 'uView'),
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
    homeFrom: gl.getUniformLocation(renderProgram, 'uHomeFrom'),
    homeTo: gl.getUniformLocation(renderProgram, 'uHomeTo'),
    morph: gl.getUniformLocation(renderProgram, 'uMorph'),
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
  let previousTime = 0;
  let rotationTime = 0;
  const parallax = { x: 0, y: 0 };

  // Morph scheduling. `shapeIndex` counts upward forever: the target data is
  // shapes[shapeIndex % shapes.length] and it lives in homeTextures[shapeIndex % 2],
  // so the two home slots simply alternate as the sequence advances.
  let shapeIndex = 0;
  let phaseSeconds = 0;
  let uploadedNext = true;
  let heldMorph = 0;

  function bindTexture(unit: number, texture: WebGLTexture, location: WebGLUniformLocation | null) {
    gl!.activeTexture(gl!.TEXTURE0 + unit);
    gl!.bindTexture(gl!.TEXTURE_2D, texture);
    gl!.uniform1i(location, unit);
  }

  function advanceMorph(delta: number) {
    phaseSeconds += delta;

    const current = SHAPE_TARGETS[shapeIndex % SHAPE_TARGETS.length];
    const holdSeconds = current.hold;
    const morphSeconds = current.morph;

    if (phaseSeconds < holdSeconds) {
      // Upload the next target during the hold, never during the crossing, so
      // the texture write can never land inside an animating frame.
      if (!uploadedNext && phaseSeconds > holdSeconds * 0.4) {
        // Cache and upload during the hold, before the next crossing begins.
        const nextTarget = (shapeIndex + 1) % SHAPE_TARGETS.length;
        const nextData = getShape(nextTarget);
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

  function updateView() {
    // Settle exactly on the original camera before the final line hold.
    const t = Math.min(collapse / 0.66, 1);
    fieldView(viewMatrix, parallax.x, parallax.y, 1 - t * t * (3 - 2 * t), rotationTime);
  }

  function simulate(time: number, delta: number, morph: number) {
    updateView();
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
    gl!.uniform1f(sim.pointerPower, collapse > 0 ? 0 : pointerPower);
    gl!.uniformMatrix4fv(sim.view, false, viewMatrix);
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
    bindTexture(2, homeTextures[0], render.homeFrom);
    bindTexture(3, homeTextures[1], render.homeTo);
    gl!.uniform1f(render.morph, heldMorph);

    perspective(projectionMatrix, FOV_Y, aspect, 0.1, 20);
    updateView();

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
    gl!.uniform1f(render.intensity, 0.42 + collapse * 0.18);
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
      const elapsed = Math.min(Math.max(time - previousTime, 0), 0.1);
      previousTime = time;
      if (collapse === 0) {
        renderTime = time;
        rotationTime += elapsed;
      }
      // The pointer itself is eased, so a fast flick still arrives as a swell
      // through the field rather than as a jump.
      const ease = 1 - Math.exp(-delta / 0.09);
      pointer.x += (pointerTarget.x - pointer.x) * ease;
      pointer.y += (pointerTarget.y - pointer.y) * ease;
      pointerPower += (pointerPowerTarget - pointerPower) * (1 - Math.exp(-delta / 0.25));
      // Slow enough that crossing the edge of the field is a swell, not a switch.
      hover += (hoverTarget - hover) * (1 - Math.exp(-delta / 0.42));

      const parallaxEase = 1 - Math.exp(-delta / 1.5);
      parallax.x += (Math.max(-1, Math.min(1, pointerTarget.x)) - parallax.x) * parallaxEase;
      parallax.y += (Math.max(-1, Math.min(1, pointerTarget.y)) - parallax.y) * parallaxEase;

      // The form is frozen once entry begins. Letting it keep crossing to the
      // next target while it is being wrung into a line produces a gather that
      // fights itself.
      const morph = collapse > 0 ? heldMorph : advanceMorph(elapsed);
      heldMorph = morph;
      simulate(renderTime, delta, morph);
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
      for (let i = 0; i < steps; i += 1) simulate(0, 0.008, heldMorph);
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
