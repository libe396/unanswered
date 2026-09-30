// LIGHT LAB — 빛 그래픽 렌더러 테스트 페이지 (dev 전용, 빌드에 포함되지 않음)
// 실행: npm run dev → http://localhost:5173/unanswered/lab/light-lab.html
//
// A = 기존 src/lib/lightRenderer.js
// B = 실험 lab/lightRenderer.exp.js (기존 사본 + 원 크기 편차 + 와이드 비율 직접 렌더)
// A는 정사각형을 가운데 크롭, B는 선택 비율로 직접 그린다.
// 어느 파일이든 저장하면 페이지가 새로고침되고, 선택 상태는 그대로 유지된다.

import { analyzeImage } from '../src/lib/imageAnalysis.js';
import { renderLightGraphic } from '../src/lib/lightRenderer.js';
import { renderLightGraphicExp } from './lightRenderer.exp.js';
import { ARCHIVE_META } from '../src/archiveMeta.js';
import { EMOTION_KEYWORDS, MAX_EMOTION_KEYWORDS } from '../src/data/content.ts';

const IMAGE_MODULES = import.meta.glob('../src/assets/archive/light-trace-*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const images = ARCHIVE_META.map(({ slot, label }) => ({
  id: slot,
  label,
  src: IMAGE_MODULES[`../src/assets/archive/light-trace-${slot}.png`],
})).filter((image) => image.src);

const ASPECTS = {
  '1:1': () => 1,
  '16:10': () => 16 / 10,
  '16:9': () => 16 / 9,
  wall: () => 3.5,
  viewport: () => window.innerWidth / window.innerHeight,
};
const ASPECT_KEYS = Object.keys(ASPECTS);
const RENDERERS = ['orig', 'exp', 'ab'];
const LABEL = { orig: 'A 기존', exp: 'B 실험' };

// ── state (새로고침에도 유지) ─────────────────────────────────────────
const STORE_KEY = 'light-lab-state-v2';
const state = {
  mode: 'single',
  renderer: 'ab',
  aspect: '16:9',
  imageId: images[0]?.id,
  variation: 1,
  keywords: [],
  showSource: true,
  ...load(STORE_KEY),
};
restoreUpload();

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}
function restoreUpload() {
  try {
    const upload = JSON.parse(sessionStorage.getItem('light-lab-upload'));
    if (upload) images.push(upload);
  } catch { /* ignore */ }
  if (!images.some((image) => image.id === state.imageId)) state.imageId = images[0]?.id;
}

// ── analysis / render ─────────────────────────────────────────────────
const analysisCache = new Map();
function getAnalysis(image) {
  if (!analysisCache.has(image.id)) analysisCache.set(image.id, analyzeImage(image.src));
  return analysisCache.get(image.id);
}
const rulesFor = (analysis) => ({ ...analysis, emotionKeywords: state.keywords });
const activeRenderers = () => (state.renderer === 'ab' ? ['orig', 'exp'] : [state.renderer]);

function sizeFor(longSide) {
  const a = ASPECTS[state.aspect]();
  return a >= 1
    ? { width: longSide, height: Math.round(longSide / a) }
    : { width: Math.round(longSide * a), height: longSide };
}

// 기존 렌더러는 느리고 정사각형 고정이라 결과를 캐시해두고 크롭만 다시 한다
const origCache = new Map();
function drawRenderer(kind, canvas, image, analysis, size) {
  const rules = rulesFor(analysis);
  const start = performance.now();
  const info = null;
  // A 기존: 1000×1000 정사각형 → 선택 비율로 가운데 크롭
  // B 실험: 선택 비율 그대로 직접 렌더 (세로 1000 기준)
  const aspect = size.width / size.height;
  const key = `${kind}|${image.id}|${state.variation}|${state.keywords.join(',')}|${kind === 'exp' ? aspect.toFixed(3) : ''}`;
  let base = origCache.get(key);
  if (!base) {
    base = document.createElement('canvas');
    if (kind === 'exp') renderLightGraphicExp(base, rules, state.variation, { aspect });
    else renderLightGraphic(base, rules, state.variation);
    origCache.set(key, base);
  }
  coverCrop(base, canvas, size);
  return { ms: performance.now() - start, info };
}

function coverCrop(src, dst, { width, height }) {
  dst.width = width;
  dst.height = height;
  const a = width / height;
  const sa = src.width / src.height;
  let sw = src.width;
  let sh = src.height;
  if (a > sa) sh = src.width / a;
  else sw = src.height * a;
  const ctx = dst.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, width, height);
}

// ── DOM ───────────────────────────────────────────────────────────────
const $ = (selector) => document.querySelector(selector);

function renderControls() {
  document.body.dataset.mode = state.mode;
  document.body.classList.toggle('hide-source', !state.showSource);
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === state.mode));
  document.querySelectorAll('[data-renderer]').forEach((b) => b.classList.toggle('on', b.dataset.renderer === state.renderer));
  document.querySelectorAll('[data-aspect]').forEach((b) => b.classList.toggle('on', b.dataset.aspect === state.aspect));
  $('#varInput').value = state.variation;
  $('#toggleSource').textContent = state.showSource ? '원본 보임' : '원본 숨김';

  const kw = $('#keywords');
  kw.innerHTML = `<span class="lbl">감정 ${state.keywords.length}/${MAX_EMOTION_KEYWORDS}</span>`;
  EMOTION_KEYWORDS.forEach(({ ko }) => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (state.keywords.includes(ko) ? ' on' : '');
    chip.textContent = ko;
    chip.onclick = () => toggleKeyword(ko);
    kw.append(chip);
  });

  const thumbs = $('#thumbs');
  thumbs.innerHTML = '';
  images.forEach((image) => {
    const button = document.createElement('button');
    button.className = 'thumb' + (image.id === state.imageId ? ' on' : '');
    button.title = `${image.id} ${image.label}`;
    button.innerHTML = `<img src="${image.src}" alt="">`;
    button.onclick = () => set({ imageId: image.id });
    thumbs.append(button);
  });
  const upload = document.createElement('button');
  upload.className = 'thumb upload';
  upload.textContent = '+ 업로드';
  upload.onclick = pickFile;
  thumbs.append(upload);
}

function toggleKeyword(keyword) {
  let next = state.keywords.includes(keyword)
    ? state.keywords.filter((k) => k !== keyword)
    : [...state.keywords, keyword];
  if (next.length > MAX_EMOTION_KEYWORDS) next = next.slice(-MAX_EMOTION_KEYWORDS);
  set({ keywords: next });
}

let renderToken = 0;
const nextFrame = () => new Promise(requestAnimationFrame);

async function renderSingle() {
  const token = ++renderToken;
  const image = images.find((item) => item.id === state.imageId);
  if (!image) return;
  const stage = $('#stage');
  const kinds = activeRenderers();
  const aspect = ASPECTS[state.aspect]();

  // 스테이지 안에 비율 그대로 들어가는 최대 크기
  // 정사각형에 가까우면 좌우로, 넓은 비율이면 위아래로 나란히
  const sideBySide = kinds.length > 1 && aspect < 1.3;
  stage.style.flexDirection = sideBySide ? 'row' : 'column';
  const pad = 40;
  const n = kinds.length;
  const availW = sideBySide ? (stage.clientWidth - pad - (n - 1) * 14) / n : stage.clientWidth - pad;
  const availH = sideBySide ? stage.clientHeight - pad - 26 : (stage.clientHeight - pad - n * 26 - (n - 1) * 14) / n;
  const frameW = Math.max(120, Math.min(availW, availH * aspect));

  stage.innerHTML = '';
  const frames = kinds.map((kind) => {
    const fig = document.createElement('figure');
    fig.className = 'frame';
    fig.style.width = `${frameW}px`;
    fig.innerHTML = `<canvas style="aspect-ratio:${aspect}"></canvas><img class="src" src="${image.src}" alt=""><figcaption><b>${LABEL[kind]}</b> · 렌더 중…</figcaption>`;
    stage.append(fig);
    return { kind, fig };
  });

  const analysis = await getAnalysis(image);
  if (token !== renderToken) return;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const size = sizeFor(Math.min(2400, Math.round(Math.max(frameW, frameW / aspect) * dpr)));
  let expInfo = null;
  const times = {};
  for (const { kind, fig } of frames) {
    await nextFrame();
    if (token !== renderToken) return;
    const { ms, info } = drawRenderer(kind, fig.querySelector('canvas'), image, analysis, size);
    if (info) expInfo = info;
    times[kind] = ms;
    fig.querySelector('figcaption').innerHTML =
      `<b>${LABEL[kind]}</b> · ${image.id} ${image.label} · var ${state.variation} · ${size.width}×${size.height} · ${ms.toFixed(0)}ms`;
  }
  renderPanel(analysis, expInfo, times);
}

async function renderGrid() {
  const token = ++renderToken;
  const grid = $('#grid');
  const kinds = activeRenderers();
  const aspect = ASPECTS[state.aspect]();
  grid.style.setProperty('--card-min', `${Math.round(Math.min(900, 240 * Math.max(1, aspect * 0.75)))}px`);
  grid.innerHTML = '';

  const cards = images.map((image) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="pair">${kinds.map(() => `<canvas style="aspect-ratio:${aspect}"></canvas>`).join('')}
        <img class="src" src="${image.src}" alt=""></div>
      <div class="cap"><span>${image.id} ${image.label}</span><span class="ms"></span></div>`;
    card.onclick = () => set({ mode: 'single', imageId: image.id });
    grid.append(card);
    return card;
  });

  const size = sizeFor(state.aspect === 'wall' ? 1400 : 900);
  const order = kinds;
  for (const kind of order) {
    for (let i = 0; i < images.length; i += 1) {
      const analysis = await getAnalysis(images[i]);
      if (token !== renderToken) return;
      await nextFrame();
      const canvas = cards[i].querySelectorAll('canvas')[kinds.indexOf(kind)];
      const { ms } = drawRenderer(kind, canvas, images[i], analysis, size);
      const label = cards[i].querySelector('.ms');
      label.textContent = `${label.textContent ? label.textContent + ' · ' : ''}${kind === 'exp' ? 'B' : 'A'} ${ms.toFixed(0)}ms`;
    }
  }
}

function renderPanel(analysis, expInfo, times) {
  const weights = analysis.paletteWeights || [];
  const maxWeight = Math.max(...weights, 0.0001);
  const fmt = (value) => (typeof value === 'number' ? value.toFixed(3) : String(value));
  const rows = (pairs) => pairs.map(([k, v]) => `<div class="row"><span>${k}</span><span>${v}</span></div>`).join('');
  const hsl = (c) => `hsl(${c.h.toFixed(0)} ${(c.s * 100).toFixed(0)}% ${(c.l * 100).toFixed(0)}%)`;
  const structure = analysis.structure || {};

  $('#panel').innerHTML = `
    <h4>SOURCE PALETTE (${analysis.palette.length})</h4>
    <div class="swatches">
      ${analysis.palette.map((hex, i) => `
        <div class="sw"><i style="background:${hex}"></i><span>${hex}</span>
        <b style="width:${((weights[i] || 0) / maxWeight) * 100}%"></b><span>${fmt(weights[i] ?? 0).slice(0, 5)}</span></div>`).join('')}
    </div>
    ${expInfo ? `
      <h4>B 실험 — 고른 빛 ${expInfo.palette.neutral ? '(무채색 이미지)' : ''}</h4>
      <div class="lights">${expInfo.palette.lights.map((c) => `<i style="background:${hsl(c)}" title="${hsl(c)}"></i>`).join('')}</div>
      <div class="lights" style="margin-top:4px"><i style="background:${hsl(expInfo.palette.deep)}" title="deep"></i><i style="background:${hsl(expInfo.palette.bg)}" title="bg"></i></div>
    ` : ''}
    <h4>LIGHT</h4>
    ${rows([
      ['origin', `${fmt(analysis.lightOrigin.x)}, ${fmt(analysis.lightOrigin.y)}`],
      ['brightness', fmt(analysis.averageBrightness)],
      ['blurDensity', fmt(analysis.blurDensity)],
      ['motion', `${Math.round(analysis.motionDirection.angle)}° ${analysis.motionDirection.label}`],
      ['brightRegions', analysis.brightRegions.length],
      ['structureAnchors', analysis.structureAnchors.length],
    ])}
    <h4>STRUCTURE</h4>
    ${rows(Object.entries(structure).filter(([, v]) => typeof v !== 'object').map(([k, v]) => [k, fmt(v)]))}
    <h4>RENDER</h4>
    ${rows([
      ['variation', state.variation],
      ['keywords', state.keywords.join(', ') || '—'],
      ...Object.entries(times).map(([k, ms]) => [LABEL[k], `${ms.toFixed(0)}ms`]),
    ])}
    <details><summary>raw analysis JSON</summary><pre>${JSON.stringify(analysis, null, 2)}</pre></details>
  `;
}

function render() {
  renderControls();
  if (state.mode === 'grid') renderGrid();
  else renderSingle();
}

function set(patch) {
  Object.assign(state, patch);
  save();
  render();
}

// ── fullscreen preview ────────────────────────────────────────────────
async function openFull() {
  const image = images.find((item) => item.id === state.imageId);
  if (!image) return;
  const full = $('#full');
  full.hidden = false;
  const kind = state.renderer === 'orig' ? 'orig' : 'exp';
  const aspect = ASPECTS[state.aspect]();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const fitW = Math.min(window.innerWidth, window.innerHeight * aspect);
  const canvas = full.querySelector('canvas');
  canvas.style.width = `${fitW}px`;
  canvas.style.aspectRatio = aspect;
  const size = sizeFor(Math.min(3200, Math.round(Math.max(fitW, fitW / aspect) * dpr)));
  const analysis = await getAnalysis(image);
  drawRenderer(kind, canvas, image, analysis, size);
}
function closeFull() { $('#full').hidden = true; }
$('#full').onclick = closeFull;

// ── upload ────────────────────────────────────────────────────────────
function pickFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => input.files[0] && addUpload(input.files[0]);
  input.click();
}

function addUpload(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const upload = { id: 'UP', label: file.name, src: reader.result };
    const existing = images.findIndex((image) => image.id === 'UP');
    if (existing >= 0) images.splice(existing, 1);
    images.push(upload);
    analysisCache.delete('UP');
    [...origCache.keys()].filter((k) => k.includes('|UP|')).forEach((k) => origCache.delete(k));
    try { sessionStorage.setItem('light-lab-upload', JSON.stringify(upload)); } catch { /* too big — 새로고침 시 사라짐 */ }
    set({ mode: 'single', imageId: 'UP' });
  };
  reader.readAsDataURL(file);
}

window.addEventListener('dragover', (event) => { event.preventDefault(); document.body.classList.add('dragging'); });
window.addEventListener('dragleave', (event) => { if (!event.relatedTarget) document.body.classList.remove('dragging'); });
window.addEventListener('drop', (event) => {
  event.preventDefault();
  document.body.classList.remove('dragging');
  const file = event.dataTransfer.files[0];
  if (file?.type.startsWith('image/')) addUpload(file);
});

// ── controls ──────────────────────────────────────────────────────────
document.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => set({ mode: b.dataset.mode }); });
document.querySelectorAll('[data-renderer]').forEach((b) => { b.onclick = () => set({ renderer: b.dataset.renderer }); });
document.querySelectorAll('[data-aspect]').forEach((b) => { b.onclick = () => set({ aspect: b.dataset.aspect }); });
$('#varDown').onclick = () => set({ variation: Math.max(1, state.variation - 1) });
$('#varUp').onclick = () => set({ variation: state.variation + 1 });
$('#varInput').onchange = (event) => set({ variation: Math.max(1, parseInt(event.target.value, 10) || 1) });
$('#varRandom').onclick = () => set({ variation: 1 + Math.floor(Math.random() * 9999) });
$('#toggleSource').onclick = () => set({ showSource: !state.showSource });
$('#fullscreen').onclick = openFull;
$('#download').onclick = async () => {
  const image = images.find((item) => item.id === state.imageId);
  const kind = state.renderer === 'orig' ? 'orig' : 'exp';
  const canvas = document.createElement('canvas');
  const size = sizeFor(state.aspect === 'wall' ? 3500 : 2400);
  drawRenderer(kind, canvas, image, await getAnalysis(image), size);
  const link = document.createElement('a');
  const kw = state.keywords.length ? '-' + state.keywords.join('_') : '';
  link.download = `light-${kind}-${image.id}-${state.aspect.replace(':', 'x')}-v${state.variation}${kw}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => state.mode === 'single' && renderSingle(), 250);
});

window.addEventListener('keydown', (event) => {
  if (event.target.tagName === 'INPUT') return;
  if (!$('#full').hidden && (event.key === 'Escape' || event.key === 'f' || event.key === 'F')) return closeFull();
  const index = images.findIndex((image) => image.id === state.imageId);
  const key = event.key;
  if (key === 'ArrowRight') set({ imageId: images[(index + 1) % images.length].id });
  else if (key === 'ArrowLeft') set({ imageId: images[(index - 1 + images.length) % images.length].id });
  else if (key === 'r' || key === 'R') $('#varRandom').click();
  else if (key === ']') $('#varUp').click();
  else if (key === '[') $('#varDown').click();
  else if (key === 'g' || key === 'G') set({ mode: state.mode === 'grid' ? 'single' : 'grid' });
  else if (key === 'a' || key === 'A') set({ renderer: RENDERERS[(RENDERERS.indexOf(state.renderer) + 1) % RENDERERS.length] });
  else if (key === 's' || key === 'S') set({ showSource: !state.showSource });
  else if (key === 'f' || key === 'F') openFull();
  else if (key >= '1' && key <= '5') set({ aspect: ASPECT_KEYS[Number(key) - 1] });
});

render();
