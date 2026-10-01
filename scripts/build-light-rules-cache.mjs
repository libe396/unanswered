/**
 * Dev-only. Builds src/data/lightRulesCache.json — `analyzeImage` output for
 * every archive photo, keyed by the same image id LightArchiveScene records
 * (`IMAGE_01` …). The mobile report redraws the light graphic from this
 * cache plus the payload's `var`, since full rules are too large for a URL.
 *
 * Runs the real analyzer inside headless Chrome against the running Vite dev
 * server, so the numbers come from the same canvas path the exhibition uses.
 *
 *   npm run dev            # in another terminal
 *   node scripts/build-light-rules-cache.mjs
 *
 * Env: DEV_URL (default http://localhost:5173/unanswered/), CHROME_PATH.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEV_URL = process.env.DEV_URL ?? 'http://localhost:5173/unanswered/';
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const OUT = new URL('../src/data/lightRulesCache.json', import.meta.url);

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'unanswered-cache-'))}`,
  'about:blank',
], { stdio: 'ignore' });

async function waitForTarget() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Chrome did not start');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  return new Promise((resolve) => { ws.onopen = () => resolve({ ws, send }); });
}

const SCRIPT = `(async () => {
  const base = ${JSON.stringify(new URL(DEV_URL).pathname)};
  const { analyzeImage } = await import(base + 'src/lib/imageAnalysis.js');
  const { ARCHIVE_META } = await import(base + 'src/archiveMeta.js');
  const cache = {};
  for (const { slot } of ARCHIVE_META) {
    const url = (await import(base + 'src/assets/archive/light-trace-' + slot + '.png?url')).default;
    cache['IMAGE_' + slot] = await analyzeImage(url);
  }
  return JSON.stringify(cache);
})()`;

try {
  const { ws, send } = await connect(await waitForTarget());
  await send('Page.enable');
  await send('Page.navigate', { url: DEV_URL });
  await new Promise((r) => setTimeout(r, 2500));
  const result = await send('Runtime.evaluate', { expression: SCRIPT, awaitPromise: true, returnByValue: true });
  if (result.result?.exceptionDetails) throw new Error(JSON.stringify(result.result.exceptionDetails));
  const cache = JSON.parse(result.result.result.value);
  writeFileSync(OUT, `${JSON.stringify(cache)}\n`);
  console.log(`Wrote ${Object.keys(cache).length} entries to ${OUT.pathname}`);
  ws.close();
} finally {
  chrome.kill();
}
