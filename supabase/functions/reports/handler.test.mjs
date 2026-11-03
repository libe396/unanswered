import ts from 'typescript';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const source = await fs.readFile(new URL('./handler.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText;
const { createReportHandler } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const config = { url: 'https://project.invalid', key: 'server-only-test-key', salt: 'test-only-salt', origins: ['http://localhost:5173'] };
const id = 'a'.repeat(48);
const bundle = { v: 1, report: { v: 1, id: 'RPT-TEST' }, findings: [], replays: [], strokes: [] };
let files = new Map(), ready = false, result = id, calls = 0;
const transport = async (url, init) => {
  calls++;
  assert.equal(init.headers.apikey, config.key);
  if (url.includes('/rpc/')) return Response.json(result);
  if (url.includes('/rest/')) {
    if (init.method === 'PATCH') { ready = true; return new Response(null, { status: 204 }); }
    return Response.json(ready ? [{ id }] : []);
  }
  if (init.method === 'POST') { files.set(url, init.body); return Response.json({}); }
  return files.has(url) ? new Response(files.get(url)) : new Response(null, { status: 404 });
};
const handler = createReportHandler(config, transport);
const req = (method, path = '', data = bundle, origin = config.origins[0]) => new Request(`https://project.invalid/functions/v1/reports${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify(data) : undefined });
assert.equal((await handler(req('OPTIONS'))).status, 204);
assert.equal((await handler(req('POST', '', bundle, 'https://unexpected.invalid'))).status, 403);
assert.equal(calls, 0);
assert.equal((await handler(req('POST', '', { bad: true }))).status, 400);
const stored = await handler(req('POST'));
assert.equal(stored.status, 200); assert.equal((await stored.json()).id, id);
const loaded = await handler(req('GET', `/${id}`));
assert.equal(loaded.status, 200); assert.deepEqual(await loaded.json(), { ...bundle, light: null });
assert.equal(loaded.headers.get('cache-control'), 'no-store');
assert.equal((await handler(req('GET', '/invalid'))).status, 404);
assert.equal(files.size, 1);
assert.equal((await handler(req('POST'))).status, 200); assert.equal(files.size, 1);
result = 'RATE_LIMIT'; assert.equal((await handler(req('POST'))).status, 429);
result = 'CAPACITY'; assert.equal((await handler(req('POST'))).status, 507);
const unconfigured = createReportHandler({ ...config, key: '' }, transport);
assert.equal((await unconfigured(req('POST'))).status, 503);
console.log('PASS: CORS, body validation, private upload/read, deduplication, random ID route, quota/rate-limit responses, no-store and missing config (mocked Supabase only)');
let feedbackSaved, feedbackResult = 'OK';
const feedbackHandler = createReportHandler(config, async (url, init) => {
  assert.ok(url.endsWith('/rest/v1/rpc/submit_exhibition_feedback'));
  feedbackSaved = JSON.parse(init.body);
  return Response.json(feedbackResult);
});
const feedback = { id: crypto.randomUUID(), meaning: 'test', friction: '', replayHelp: 4, feedbackConsent: true, recordConsent: false, reportRef: id, consentVersion: 'ut-2026-11-02-v1' };
assert.equal((await feedbackHandler(req('POST', '/feedback', { ...feedback, feedbackConsent: false }))).status, 400);
assert.equal(feedbackSaved, undefined);
assert.equal((await feedbackHandler(req('POST', '/feedback', feedback))).status, 200);
assert.equal(feedbackSaved.p_report, null);
assert.equal(feedbackSaved.p_record_consent, false);
assert.equal((await feedbackHandler(req('POST', '/feedback', { ...feedback, recordConsent: true }))).status, 200);
assert.equal(feedbackSaved.p_report, id);
assert.equal((await feedbackHandler(req('POST', '/feedback', { ...feedback, meaning: '', replayHelp: null }))).status, 400);
assert.equal((await feedbackHandler(req('POST', '/feedback', { ...feedback, recordConsent: true, reportRef: '../bad' }))).status, 400);
assert.equal((await feedbackHandler(req('POST', '/feedback', { ...feedback, replayHelp: 9 }))).status, 400);
// Both shipped wordings are accepted, each stored under its own version; 0 is
// v2's "보지 않았다" and an unknown version is refused.
assert.equal((await feedbackHandler(req('POST', '/feedback', { ...feedback, consentVersion: 'ut-2026-11-03-v2', replayHelp: 0 }))).status, 200);
assert.equal((await feedbackHandler(req('POST', '/feedback', { ...feedback, consentVersion: 'ut-2099-01-01-v9' }))).status, 400);
assert.equal((await feedbackHandler(req('GET', '/feedback'))).status, 404);
feedbackResult = 'RATE_LIMIT';
assert.equal((await feedbackHandler(req('POST', '/feedback', feedback))).status, 429);
console.log('PASS: feedback consent required, optional record linkage, validation, no public feedback reads, rate-limit responses (mocked only)');
