// lightRenderer.exp.js — 실험용 빛 그래픽 렌더러 (LIGHT LAB 전용)
// 원본 src/lib/lightRenderer.js 는 건드리지 않는다. 같은 analyzeImage() 결과를 받아서
//   1) 어두운 바닥 위로 빛이 올라오게 (명암 폭)
//   2) 원본 안에서 색상이 서로 먼 2~3색을 골라 채도를 올려 흐르게 (색 폭)
//   3) 원 대신 큰 흐름 + 그 안의 어둠, 얇은 선·교차점은 보조로 (형태)
// 그리고 캔버스 비율을 자유롭게 받는다 (1:1, 16:9, 벽 3.5:1 …).

import { hexToRgb } from '../src/lib/color.js';

export function renderLightGraphicExp(canvas, rules, variation = 1, { width = 1600, height = 1600 } = {}) {
  if (!canvas || !rules) return null;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const seed = hashRules(rules, variation);
  const random = mulberry32(seed);
  const mood = readEmotion(rules.emotionKeywords);
  const blur = clamp((rules.blurDensity ?? 0.5) * mood.blur, 0.05, 0.98);
  const brightness = clamp((rules.averageBrightness ?? 0.5) * mood.brightness, 0, 1);
  const palette = buildPalette(rules, mood);
  const origin = {
    x: clamp(rules.lightOrigin?.x ?? 0.5, 0.08, 0.92),
    y: clamp(rules.lightOrigin?.y ?? 0.5, 0.1, 0.9),
  };

  // ── 저해상도 빛 필드: 해상도가 낮을수록 부드럽다. 흐린 사진일수록 더 낮게.
  const fieldScale = 0.5 - blur * 0.2;
  const fw = Math.max(48, Math.round(width * fieldScale));
  const fh = Math.max(48, Math.round(height * fieldScale));
  const field = document.createElement('canvas');
  field.width = fw;
  field.height = fh;
  const f = field.getContext('2d');
  const F = { ctx: f, w: fw, h: fh, s: Math.min(fw, fh), l: Math.max(fw, fh) };

  paintBase(F, palette, origin);
  const ribbons = paintRibbons(F, palette, origin, rules, random, brightness, blur);
  paintShadows(F, palette, origin, ribbons, random);
  const glows = paintGlows(F, palette, origin, rules, brightness, blur);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // 크롬은 그라데이션에 디더링을 넣는데, 그대로 확대하면 격자무늬가 보인다 → 확대하면서 살짝 블러
  const softPx = Math.round(Math.min(width, height) * (0.004 + blur * 0.008));
  if ('filter' in ctx) ctx.filter = `blur(${softPx}px)`;
  ctx.drawImage(field, -softPx, -softPx, width + softPx * 2, height + softPx * 2);
  if ('filter' in ctx) ctx.filter = 'none';

  // ── 풀해상도: 얇은 선과 교차점 (기록 시스템의 흔적)
  const C = { ctx, w: width, h: height, s: Math.min(width, height), l: Math.max(width, height) };
  paintTraces(C, palette, origin, glows, rules, random);
  tonePass(C, brightness, seed);

  return { palette };
}

// ─── palette ───────────────────────────────────────────────────────────────

function buildPalette(rules, mood) {
  const weights = rules.paletteWeights || [];
  const source = rules.palette || [];
  const cands = [];
  source.forEach((hex, i) => cands.push({ ...hexToHsl(hex), w: weights[i] ?? 1 / Math.max(1, source.length) }));
  (rules.brightRegions || []).forEach((r) => r.color && cands.push({ ...hexToHsl(r.color), w: 0.12 * (r.strength ?? 0.5) }));
  (rules.structureAnchors || []).forEach((a) => a.color && cands.push({ ...hexToHsl(a.color), w: 0.06 * (a.strength ?? 0.5) }));
  if (!cands.length) cands.push({ h: 250, s: 0.4, l: 0.6, w: 1 });

  const chroma = (c) => c.s * (1 - Math.abs(c.l - 0.5) * 2);
  const totalW = cands.reduce((sum, c) => sum + c.w, 0) || 1;
  const avgChroma = cands.reduce((sum, c) => sum + chroma(c) * c.w, 0) / totalW;
  const neutral = avgChroma < 0.09;

  const primary = cands.reduce((best, c) => (score(c) > score(best) ? c : best));
  function score(c) { return c.w * (0.35 + chroma(c) * 2.5); }

  // 색상환에서 이미 고른 색과 가장 먼 색을 추가 (원본 안에 있는 색만)
  const chosen = [primary];
  for (let k = 0; k < 2; k += 1) {
    let best = null;
    let bestScore = 0;
    for (const c of cands) {
      if (chroma(c) < 0.04) continue;
      const dist = Math.min(...chosen.map((x) => hueDist(x.h, c.h)));
      if (dist < 28) continue;
      const sc = (dist / 180) * Math.sqrt(c.w) * (0.3 + chroma(c));
      if (sc > bestScore) { best = c; bestScore = sc; }
    }
    // 원본에 먼 색이 없으면 주색의 인접색으로 흐름만 만든다
    chosen.push(best || { ...primary, h: wrapHue(primary.h + (k === 0 ? 34 : -28)) });
  }

  const lights = chosen.map((c) => refineLight(c, neutral, mood));
  const deepHue = mixHue(primary.h, 250, neutral ? 0.7 : 0.5);
  return {
    lights,
    deep: { h: deepHue, s: neutral ? 0.22 : 0.42, l: 0.075 },
    bg: { h: deepHue, s: 0.35, l: 0.022 },
    neutral,
  };
}

function refineLight(c, neutral, mood) {
  const h = mood.hue == null ? c.h : mixHue(c.h, mood.hue, 0.22);
  const s = neutral ? clamp(c.s * 1.3 + 0.06, 0.08, 0.32) : clamp(c.s * 1.3 + 0.12, 0.4, 0.82);
  const l = clamp(0.52 + c.l * 0.2, 0.55, 0.72);
  return { h, s, l };
}

// ─── field layers (low-res) ────────────────────────────────────────────────

function paintBase(F, palette, origin) {
  const { ctx, w, h, l } = F;
  ctx.fillStyle = hsla(palette.bg, 1);
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(origin.x * w, origin.y * h, 0, origin.x * w, origin.y * h, l * 0.85);
  g.addColorStop(0, hsla(palette.deep, 1));
  g.addColorStop(1, hsla(palette.bg, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 넓은 대기광: 광원 주변 + 긴 축을 따라 한두 곳 더 — 화면이 '비어' 보이지 않게
  ctx.globalCompositeOperation = 'lighter';
  const wash = (x, y, r, col, a) => {
    const gw = ctx.createRadialGradient(x, y, 0, x, y, r);
    gw.addColorStop(0, hsla(col, a));
    gw.addColorStop(1, hsla(col, 0));
    ctx.fillStyle = gw;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  wash(origin.x * w, origin.y * h, l * 0.6, palette.lights[0], 0.07);
  const extra = w / h > 2 ? 2 : 1;
  for (let i = 0; i < extra; i += 1) {
    const x = ((origin.x + (i + 1) / (extra + 1)) % 1) * w;
    const y = (0.3 + 0.4 * ((i * 0.618 + origin.y) % 1)) * h;
    wash(x, y, F.s * 0.9, palette.lights[(i + 1) % palette.lights.length], 0.06);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function paintRibbons(F, palette, origin, rules, random, brightness, blur) {
  const { ctx, w, h, s, l } = F;
  // 와이드 캔버스일수록 흐름을 긴 축(가로) 쪽으로 눕힌다
  const rawAngle = ((rules.motionDirection?.angle ?? 0) * Math.PI) / 180;
  const flatten = clamp((w / h - 1) / 3, 0, 0.7);
  const baseAngle = mixAngle(rawAngle, Math.round(rawAngle / Math.PI) * Math.PI, flatten);
  const count = 2 + (random() < 0.55 ? 1 : 0);
  const ribbons = [];
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < count; i += 1) {
    const a = baseAngle + (i - (count - 1) / 2) * 0.38 + (random() - 0.5) * 0.3;
    const dir = { x: Math.cos(a), y: Math.sin(a) };
    const nrm = { x: -dir.y, y: dir.x };
    const off = (i - (count - 1) / 2) * s * 0.2 + (random() - 0.5) * s * 0.1;
    const c = { x: origin.x * w + nrm.x * off, y: origin.y * h + nrm.y * off };
    const reach = l * 0.75;
    const p0 = { x: c.x - dir.x * reach, y: c.y - dir.y * reach };
    const p3 = { x: c.x + dir.x * reach, y: c.y + dir.y * reach };
    const bend = () => (random() - 0.5) * s * 0.7;
    const p1 = { x: c.x - dir.x * reach * 0.35 + nrm.x * bend(), y: c.y - dir.y * reach * 0.35 + nrm.y * bend() };
    const p2 = { x: c.x + dir.x * reach * 0.35 + nrm.x * bend(), y: c.y + dir.y * reach * 0.35 + nrm.y * bend() };
    const from = palette.lights[i % palette.lights.length];
    const to = palette.lights[(i + 1) % palette.lights.length];
    const points = [];
    const steps = 40;
    const phase = random() * Math.PI * 2;

    for (let t = 0; t <= steps; t += 1) {
      const u = t / steps;
      const p = cubic(p0, p1, p2, p3, u);
      points.push(p);
      const swell = Math.pow(Math.sin(Math.PI * u), 0.8);
      const radius = s * (0.13 + 0.22 * swell) * (0.8 + 0.4 * (0.5 + 0.5 * Math.sin(u * 7 + phase))) * (1 + blur * 0.5);
      const alpha = (0.03 + 0.045 * swell) * (0.7 + brightness * 0.6);
      const col = mixHsl(from, to, u);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      g.addColorStop(0, hsla(col, alpha));
      g.addColorStop(0.55, hsla(col, alpha * 0.45));
      g.addColorStop(1, hsla(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
    }
    ribbons.push(points);
  }
  ctx.globalCompositeOperation = 'source-over';
  return ribbons;
}

// 빛 띠 안에 어둠을 파낸다 — 빛이 어디서 끊기는지가 드라마를 만든다
function paintShadows(F, palette, origin, ribbons, random) {
  const { ctx, w, h, s } = F;
  const count = 2 + (random() < 0.4 ? 1 : 0);
  for (let i = 0; i < count; i += 1) {
    const path = ribbons[i % ribbons.length];
    let p = null;
    for (let tries = 0; tries < 12; tries += 1) {
      const cand = path[Math.floor((0.2 + random() * 0.6) * (path.length - 1))];
      if (Math.hypot(cand.x / w - origin.x, cand.y / h - origin.y) > 0.28) { p = cand; break; }
    }
    if (!p) continue;
    // 구멍처럼 보이지 않게: 크고, 흐름 방향으로 길게, 가장자리는 아주 천천히
    const idx = path.indexOf(p);
    const q = path[Math.min(path.length - 1, idx + 1)];
    const angle = Math.atan2(q.y - p.y, q.x - p.x);
    const r = s * (0.18 + random() * 0.16);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.scale(1.9, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, hsla(palette.bg, 0.55));
    g.addColorStop(0.35, hsla(palette.bg, 0.38));
    g.addColorStop(0.7, hsla(palette.bg, 0.12));
    g.addColorStop(1, hsla(palette.bg, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
}

function paintGlows(F, palette, origin, rules, brightness, blur) {
  const { ctx, w, h, s } = F;
  ctx.globalCompositeOperation = 'lighter';
  const regions = [...(rules.brightRegions || [])].sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0)).slice(0, 6);
  const glows = [];

  const drawGlow = (x, y, radius, col, alpha) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, hsla(col, alpha));
    g.addColorStop(0.4, hsla(col, alpha * 0.35));
    g.addColorStop(1, hsla(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    const core = { ...col, s: col.s * 0.75, l: 0.8 };
    const r2 = radius * 0.28;
    const g2 = ctx.createRadialGradient(x, y, 0, x, y, r2);
    g2.addColorStop(0, hsla(core, alpha * 0.7));
    g2.addColorStop(1, hsla(core, 0));
    ctx.fillStyle = g2;
    ctx.fillRect(x - r2, y - r2, r2 * 2, r2 * 2);
  };

  // 주 광원
  drawGlow(origin.x * w, origin.y * h, s * (0.3 + blur * 0.14), palette.lights[0], 0.2 + brightness * 0.12);
  glows.push({ x: origin.x, y: origin.y, strength: 1 });

  regions.forEach((r) => {
    const own = r.color ? hexToHsl(r.color) : palette.lights[0];
    const near = palette.lights.reduce((best, c) => (hueDist(c.h, own.h) < hueDist(best.h, own.h) ? c : best));
    const col = own.s < 0.12 ? near : { h: own.h, s: near.s, l: near.l };
    const strength = r.strength ?? 0.5;
    drawGlow(r.x * w, r.y * h, s * (0.05 + (r.size ?? 0.1) * 0.9) * (1 + blur * 0.6), col, 0.2 * strength * (0.6 + brightness));
    glows.push({ x: r.x, y: r.y, strength });
  });

  ctx.globalCompositeOperation = 'source-over';
  return glows;
}

// ─── traces (full-res) ─────────────────────────────────────────────────────

function paintTraces(C, palette, origin, glows, rules, random) {
  const { ctx, w, h, s } = C;
  const ox = origin.x * w;
  const oy = origin.y * h;
  const lineCol = { ...palette.lights[0], s: palette.lights[0].s * 0.5, l: 0.86 };
  const lw = Math.max(1, s / 1100);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  // 광원을 지나는 큰 원호 3개 — 전시의 '흐린 선, 원형 레이어'
  for (let i = 0; i < 3; i += 1) {
    const a = random() * Math.PI * 2;
    const dist = s * (1.1 + random() * 1.6);
    const cx = ox + Math.cos(a) * dist;
    const cy = oy + Math.sin(a) * dist;
    const start = Math.atan2(oy - cy, ox - cx) + (random() - 0.5) * 0.12;
    const spread = 0.28 + random() * 0.3;
    const peak = 0.09 + random() * 0.08;
    strokeFadedArc(ctx, cx, cy, dist + s * (random() - 0.5) * 0.35, start - spread, start + spread, lineCol, peak, lw);
  }

  // 교차점: 광원과 가장 강한 빛 2곳
  glows.slice(0, 3).forEach((g, i) => {
    const x = g.x * w;
    const y = g.y * h;
    const halo = s * (i === 0 ? 0.022 : 0.012);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, halo);
    gr.addColorStop(0, hsla(lineCol, 0.22 * g.strength));
    gr.addColorStop(1, hsla(lineCol, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(x - halo, y - halo, halo * 2, halo * 2);
    ctx.fillStyle = hsla({ ...lineCol, l: 0.92 }, (i === 0 ? 0.75 : 0.45) * g.strength);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, s * 0.0018), 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.globalCompositeOperation = 'source-over';
}

function strokeFadedArc(ctx, cx, cy, r, a0, a1, col, peak, lw) {
  const segs = 64;
  ctx.lineWidth = lw;
  for (let i = 0; i < segs; i += 1) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const alpha = peak * Math.pow(Math.sin(Math.PI * (t0 + t1) * 0.5), 1.5);
    ctx.strokeStyle = hsla(col, alpha);
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0 + (a1 - a0) * t0, a0 + (a1 - a0) * t1);
    ctx.stroke();
  }
}

// ─── tone: 암부 누르기 + 하이라이트 소프트 클립 + 비네팅 + 밝은 곳 위주의 얇은 그레인

function tonePass(C, brightness, seed) {
  const { ctx, w, h } = C;
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;
  const exposure = 1.1 + brightness * 0.35;
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = (i / 255) * exposure;
    c = c < 0.4 ? 0.4 * Math.pow(c / 0.4, 1.35) : c;
    c = (c / (1 + c * 0.7)) * 1.7; // 하이라이트를 눌러서 하얗게 날아가지 않게
    lut[i] = c * 255;
  }
  const aspect = w / h;
  const vx = 0.26 / Math.max(1, aspect * 0.8);
  let rnd = seed >>> 0 || 1;

  for (let y = 0; y < h; y += 1) {
    const dy = (y / h - 0.5) * 2;
    for (let x = 0; x < w; x += 1) {
      const dx = (x / w - 0.5) * 2;
      const vig = 1 - vx * dx * dx - 0.3 * dy * dy;
      const i = (y * w + x) * 4;
      const r = lut[d[i]] * vig;
      const g = lut[d[i + 1]] * vig;
      const b = lut[d[i + 2]] * vig;
      rnd ^= rnd << 13; rnd ^= rnd >>> 17; rnd ^= rnd << 5;
      const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
      const n = (((rnd >>> 0) & 255) / 255 - 0.5) * 9 * (0.25 + lum);
      d[i] = r + n;
      d[i + 1] = g + n;
      d[i + 2] = b + n;
    }
  }
  ctx.putImageData(image, 0, 0);
}

// ─── emotion ───────────────────────────────────────────────────────────────

const EMOTION_TINTS = {
  '그리움': { rgb: [190, 145, 95], brightness: 0.88, blur: 1.12 },
  '설렘': { rgb: [220, 130, 190], brightness: 1.14, blur: 0.88 },
  '고요함': { rgb: [120, 155, 210], brightness: 0.94, blur: 1.22 },
  '슬픔': { rgb: [90, 105, 185], brightness: 0.78, blur: 1.18 },
  '따뜻함': { rgb: [225, 170, 95], brightness: 1.12, blur: 0.86 },
  '공허함': { rgb: [75, 80, 105], brightness: 0.68, blur: 1.28 },
  '낯섦': { rgb: [90, 195, 185], brightness: 1.02, blur: 0.84 },
  '불안': { rgb: [165, 95, 210], brightness: 0.84, blur: 0.82 },
  '평온': { rgb: [165, 182, 190], brightness: 1.0, blur: 1.1 },
  '아련함': { rgb: [185, 155, 205], brightness: 0.9, blur: 1.15 },
};

function readEmotion(keywords) {
  const active = (keywords || []).map((k) => EMOTION_TINTS[k]).filter(Boolean);
  if (!active.length) return { hue: null, brightness: 1, blur: 1 };
  const hues = active.map((e) => rgbToHsl(e.rgb)).filter((c) => c.s > 0.1).map((c) => c.h);
  const hue = hues.length ? hues.reduce((acc, hh) => mixHue(acc, hh, 0.5)) : null;
  const geo = (key) => active.reduce((acc, e) => acc * e[key], 1) ** (1 / active.length);
  return { hue, brightness: geo('brightness'), blur: geo('blur') };
}

// ─── color utils ───────────────────────────────────────────────────────────

function hexToHsl(hex) { return rgbToHsl(hexToRgb(hex)); }

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const dd = max - min;
  const s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
  let h;
  if (max === r) h = (g - b) / dd + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / dd + 2;
  else h = (r - g) / dd + 4;
  return { h: h * 60, s, l };
}

function hsla(c, a) {
  return `hsla(${c.h.toFixed(1)}, ${(c.s * 100).toFixed(1)}%, ${(c.l * 100).toFixed(1)}%, ${clamp(a, 0, 1).toFixed(3)})`;
}

function hueDist(a, b) {
  const dd = Math.abs(wrapHue(a) - wrapHue(b)) % 360;
  return dd > 180 ? 360 - dd : dd;
}
function wrapHue(h) { return ((h % 360) + 360) % 360; }
function mixHue(a, b, t) {
  let dd = wrapHue(b) - wrapHue(a);
  if (dd > 180) dd -= 360;
  if (dd < -180) dd += 360;
  return wrapHue(a + dd * t);
}
function mixHsl(a, b, t) {
  if (hueDist(a.h, b.h) <= 70) {
    return { h: mixHue(a.h, b.h, t), s: a.s + (b.s - a.s) * t, l: a.l + (b.l - a.l) * t };
  }
  // 색상환에서 먼 두 색은 빛처럼 RGB로 섞는다 — 중간에 엉뚱한 초록·청록이 생기지 않게
  const ra = hslToRgb(a);
  const rb = hslToRgb(b);
  return rgbToHsl(ra.map((v, i) => v + (rb[i] - v) * t));
}

function hslToRgb({ h, s, l }) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
function mixAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ─── math utils ────────────────────────────────────────────────────────────

function cubic(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function hashRules(rules, variation) {
  const text = JSON.stringify([rules.palette, rules.lightOrigin, rules.emotionKeywords, variation]);
  let hh = 2166136261;
  for (let i = 0; i < text.length; i += 1) { hh ^= text.charCodeAt(i); hh = Math.imul(hh, 16777619); }
  return hh >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
