/** Run against Vite: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verifyZoneTransitions.mjs */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ZONE_QA_URL || 'http://localhost:5173/unanswered/';
const output = process.env.ZONE_QA_OUTPUT || '/private/tmp/unanswered-zone-qa';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const cases = [
  ['ZONE 03 Light Archive', '01_Color', '빛의 흔적', 'lightArchive'],
  ['ZONE 04 Sound Clues', '03_Sound', '소리의 단서', 'soundClues'],
  ['ZONE 05 Memory Sketch', '05_Memory', '복원된 기억의 방.', 'memorySketch'],
  ['ZONE 06 Sentence Clues', '04_Sentence', '문장의 흔적', 'sentenceClues'],
  ['ZONE 07 Record Layer', '06_Memory', 'Record Layer'],
  ['Final Report Sequence', '07_Final', 'Final Report'],
];
async function page(options = {}) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, ...options });
  p.on('pageerror', e => errors.push(e.message));
  p.setDefaultTimeout(15000);
  await p.addInitScript(() => {
    window.filmEntries = [];
    document.addEventListener('playing', event => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement)) return;
      const entry = { src: video.currentSrc, duration: getComputedStyle(video).transitionDuration, samples: [] };
      window.filmEntries.push(entry);
      const started = performance.now();
      const sample = () => {
        entry.samples.push({ at: performance.now() - started, opacity: Number(getComputedStyle(video).opacity) });
        if (performance.now() - started < 950 && video.isConnected) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, true);
  });
  await p.goto(base);
  await p.getByRole('button', { name: 'DEV', exact: true }).waitFor();
  return p;
}
async function jump(p, label, stairs = false) {
  await p.getByRole('button', { name: 'DEV', exact: true }).click();
  const buttons = p.getByRole('button', { name: label, exact: true });
  await (label === 'ZONE 04 Sound Clues' ? buttons.nth(stairs ? 0 : 1) : buttons).click();
}
async function ready(p) {
  await p.locator('.zone-film').waitFor({ state: 'detached', timeout: 60000 });
  await p.locator('.zone-experience:not([hidden]) .zone-experience__interaction:not([inert])').waitFor();
}
async function skip(p) {
  await p.getByRole('button', { name: '건너뛰기', exact: true }).click();
  await ready(p);
}
async function observe(p) {
  await p.evaluate(() => {
    window.zoneQA = [];
    const capture = () => {
      const phase = document.querySelector('.zone-film')?.getAttribute('data-phase') || 'active';
      if (window.zoneQA.at(-1)?.phase !== phase) window.zoneQA.push({ phase, at: performance.now(), blocked: Boolean(document.querySelector('.zone-experience:not([hidden]) .zone-experience__interaction[inert]')) });
    };
    new MutationObserver(capture).observe(document.querySelector('#root'), { childList: true, subtree: true, attributes: true, attributeFilter: ['data-phase'] });
    capture();
  });
}
try {
  // Actual playback at delivered speed and duration; no artificial ended event.
  for (const [label, file, title, tracking] of cases.filter(c => !process.env.ZONE_QA_ONLY || c[1] === process.env.ZONE_QA_ONLY)) {
    const p = await page();
    await jump(p, label);
    const video = p.locator('.zone-film video');
    await video.waitFor();
    await observe(p);
    assert.match(await video.getAttribute('src'), new RegExp(file));
    assert.equal(await p.locator('.zone-film h1').count(), 0);
    assert.equal(await p.locator('.zone-label').count(), 0);
    const props = await video.evaluate(v => ({ loop: v.loop, inline: v.playsInline, rate: v.playbackRate, fit: getComputedStyle(v).objectFit }));
    assert.deepEqual(props, { loop: false, inline: true, rate: 1, fit: 'contain' });
    await video.evaluate(v => { window.zoneEnded = false; v.addEventListener('ended', () => { window.zoneEnded = true; window.zoneFinalFrame = [v.currentTime, v.duration]; }, { once: true }); });
    await p.locator('[data-phase="titleHold"]').waitFor({ timeout: 60000 });
    assert.equal(await p.locator('.zone-film h1').innerText(), title);
    assert.equal(await p.evaluate(() => window.zoneEnded), true);
    const entry = await p.evaluate(() => window.filmEntries[0]);
    assert.equal(entry.duration, '0.8s');
    assert.ok(entry.samples.some(sample => sample.at < 750 && sample.opacity > 0 && sample.opacity < 1), 'entry must gradually fade in');
    if (label === cases[0][0]) await p.screenshot({ path: `${output}/desktop-title.png` });
    await ready(p);
    const phases = await p.evaluate(() => window.zoneQA.filter(p => p.phase !== 'done'));
    assert.equal(phases.find(p => p.phase === 'reveal').blocked, true);
    assert.deepEqual(phases.map(p => p.phase), ['video', 'videoOut', 'titleIn', 'titleHold', 'reveal', 'active']);
    for (const [phase, expected] of [['videoOut', 800], ['titleIn', 250], ['titleHold', 1500], ['reveal', 400]]) {
      const i = phases.findIndex(p => p.phase === phase);
      const duration = phases[i + 1].at - phases[i].at;
      assert.ok(duration >= expected - 45 && duration < expected + 900, `${phase}: ${duration}ms`);
    }
    if (tracking) {
      const span = await p.evaluate(id => { const r = window.__unansweredTracking[id].record(); return Math.max(...r.events.map(e => e.at)) - r.sceneEnteredAt; }, tracking);
      assert.ok(span < 250, `cinema leaked into ${tracking}: ${span}`);
    }
    console.log('PASS natural end + timing + input gate:', file, await p.evaluate(() => window.zoneFinalFrame));
    await p.close();
  }

  const stairs = await page();
  await jump(stairs, 'ZONE 04 Sound Clues', true);
  await stairs.locator('video[src*="02_Stairs"]').waitFor();
  await stairs.locator('video').evaluate(video => { window.stairsVideo = video; });
  await stairs.locator('video[src*="03_Sound"]').waitFor({ timeout: 60000 });
  assert.equal(await stairs.locator('.zone-film h1').count(), 0);
  await stairs.waitForFunction(() => {
    const video = document.querySelector('.zone-film video');
    return video && video.currentSrc.includes('03_Sound') && !video.paused && video.currentTime > 0;
  });
  assert.equal(await stairs.locator('video').evaluate(video => video === window.stairsVideo), true);
  assert.equal(await stairs.getByRole('button', { name: '소리 켜고 재생', exact: true }).count(), 0);
  await stairs.locator('[data-phase="titleHold"]').waitFor({ timeout: 60000 });
  assert.equal(await stairs.locator('.zone-film h1').innerText(), '소리의 단서');
  await ready(stairs);
  const soundEntry = await stairs.evaluate(() => window.filmEntries.find(entry => entry.src.includes('03_Sound')));
  assert.ok(soundEntry.samples.some(sample => sample.at < 750 && sample.opacity > 0 && sample.opacity < 1));
  await stairs.getByRole('button', { name: /이전 기록으로/ }).click();
  await stairs.locator('video[src*="01_Color"]').waitFor();
  console.log('PASS stairs → sound on SAME player, both fade in, no play click, one sound title, back skips transit');
  await stairs.close();

  // End/skip/error can race; there must still be exactly one title/reveal.
  const race = await page();
  await jump(race, cases[0][0]);
  await observe(race);
  await race.locator('video').evaluate(v => { v.dispatchEvent(new Event('ended')); document.querySelector('.zone-film__skip')?.click(); v.dispatchEvent(new Event('ended')); });
  await ready(race);
  assert.equal((await race.evaluate(() => window.zoneQA)).filter(p => p.phase === 'titleIn').length, 1);
  await race.reload();
  await race.locator('.landing-scene').waitFor();
  assert.equal(await race.locator('.zone-film').count(), 0);
  console.log('PASS duplicate end/skip + reload returns Landing');
  await race.close();

  const failed = await page();
  await failed.route('**/video/zones/01_Color_Trace_Final.mp4', route => route.abort());
  await jump(failed, cases[0][0]);
  await failed.getByText('영상을 재생할 수 없습니다.', { exact: true }).waitFor();
  await failed.getByRole('button', { name: '계속하기', exact: true }).click();
  await ready(failed);
  console.log('PASS failed media → title → interaction');
  await failed.close();

  const blocked = await page();
  await blocked.evaluate(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLVideoElement && !window.zoneAllowPlay) return Promise.reject(new DOMException('Blocked for QA', 'NotAllowedError'));
      return play.call(this);
    };
  });
  await jump(blocked, cases[0][0]);
  await blocked.getByRole('button', { name: '소리 켜고 재생', exact: true }).waitFor();
  await blocked.evaluate(() => { window.zoneAllowPlay = true; });
  await blocked.getByRole('button', { name: '소리 켜고 재생', exact: true }).click();
  await blocked.waitForFunction(() => { const v = document.querySelector('.zone-film video'); return v && !v.paused && v.currentTime > 0; });
  await skip(blocked);
  console.log('PASS autoplay denied → inline play button');
  await blocked.close();

  const silent = await page();
  await silent.evaluate(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLVideoElement && !this.muted && !window.allowSound) return Promise.reject(new DOMException('Sound requires gesture', 'NotAllowedError'));
      return play.call(this);
    };
  });
  await jump(silent, 'ZONE 04 Sound Clues', true);
  await silent.getByRole('button', { name: '소리 켜고 재생', exact: true }).waitFor();
  assert.equal(await silent.locator('video').evaluate(v => v.muted), false);
  await silent.evaluate(() => { window.allowSound = true; });
  await silent.getByRole('button', { name: '소리 켜고 재생', exact: true }).click();
  await silent.locator('video[src*="03_Sound"]').waitFor({ timeout: 60000 });
  await silent.waitForFunction(() => { const v = document.querySelector('.zone-film video'); return v && !v.muted && !v.paused && v.currentTime > 0; });
  await skip(silent);
  console.log('PASS sound-blocked autoplay offers explicit audible retry; stairs/sound retain sound');
  await silent.close();

  const intro = await page();
  await jump(intro, 'ZONE 01 Intro Film');
  await intro.waitForFunction(() => window.filmEntries.some(entry => entry.src.includes('intro-film') && entry.samples.some(sample => sample.at > 850)));
  const introEntry = await intro.evaluate(() => window.filmEntries.find(entry => entry.src.includes('intro-film')));
  assert.equal(introEntry.duration, '0.8s');
  assert.ok(introEntry.samples.some(sample => sample.at < 750 && sample.opacity > 0 && sample.opacity < 1));
  await intro.locator('.intro-film-scene__skip').click();
  await intro.locator('.investigation-start-scene').waitFor();
  console.log('PASS intro fades in on real playback and still reaches investigation start');
  await intro.close();

  // Preserve an unfinished drawing, selected objects and the exact work phase.
  const memory = await page();
  await jump(memory, cases[2][0]);
  await skip(memory);
  await memory.getByRole('button', { name: '창문', exact: true }).click();
  await memory.getByRole('button', { name: '베개', exact: true }).click();
  await memory.getByRole('button', { name: '다음으로', exact: true }).click();
  await memory.getByRole('button', { name: '흔적 덧그리기', exact: true }).click();
  const canvas = memory.locator('.memory-sketch-scene canvas');
  const bounds = await canvas.boundingBox();
  assert.ok(bounds);
  await memory.mouse.move(bounds.x + bounds.width * .35, bounds.y + bounds.height * .5);
  await memory.mouse.down();
  await memory.mouse.move(bounds.x + bounds.width * .55, bounds.y + bounds.height * .45, { steps: 12 });
  await memory.mouse.up();
  const before = await canvas.evaluate(c => c.toDataURL());
  const recordBefore = await memory.evaluate(() => window.__unansweredTracking.memorySketch.record());
  await jump(memory, cases[3][0]);
  await skip(memory);
  await memory.getByRole('button', { name: /이전 기록으로/ }).click();
  await canvas.waitFor();
  assert.equal(await memory.locator('.zone-film').count(), 0);
  assert.equal(await canvas.evaluate(c => c.toDataURL()), before);
  await memory.getByRole('button', { name: '기록 남기기', exact: true }).waitFor();
  const recordAfter = await memory.evaluate(() => window.__unansweredTracking.memorySketch.record());
  assert.equal(recordAfter.sceneEnteredAt, recordBefore.sceneEnteredAt);
  assert.ok(recordAfter.events.length >= recordBefore.events.length);
  console.log('PASS previous Zone restores drawing, objects, phase and behavior history');
  await memory.close();

  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const mobile = await page({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await jump(mobile, cases[2][0]);
    await mobile.locator('video').waitFor();
    await mobile.waitForFunction(() => { const video = document.querySelector('.zone-film video'); return video && !video.paused && video.currentTime > 0.4; });
    await mobile.screenshot({ path: `${output}/mobile-${viewport.width}-video.png` });
    const rect = await mobile.locator('video').boundingBox();
    assert.ok(rect.x >= 0 && rect.y >= 0 && rect.width <= viewport.width && rect.height <= viewport.height);
    await mobile.getByRole('button', { name: '건너뛰기', exact: true }).click();
    await mobile.locator('[data-phase="titleHold"]').waitFor();
    await mobile.screenshot({ path: `${output}/mobile-${viewport.width}-title.png` });
    await ready(mobile);
    await mobile.screenshot({ path: `${output}/mobile-${viewport.width}-interaction.png` });
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log('PASS mobile contain/title/auto-entry:', viewport);
    await mobile.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS no uncaught browser errors');
} finally {
  await browser.close();
}
