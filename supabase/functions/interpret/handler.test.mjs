import ts from 'typescript';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const source = await fs.readFile(new URL('./handler.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText;
const { createInterpretHandler } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

const config = { key: 'server-only-test-key', origins: ['http://localhost:5173'] };
const body = {
  task: '두 기록이 어긋나는 지점을 말하세요.',
  rules: ['유형명 금지'],
  findings: [{ id: 'came-back', patternType: 'revisit', tension: null, pattern: '두 구역에서 되돌아갔다', evidence: [] }],
};
const good = {
  id: 'came-back',
  headline: '지나친 것을 다시 보러\n두 번 돌아갔습니다.',
  interpretation: '빛의 구역과 소리의 구역에서 같은 움직임이 반복되었습니다. 되돌아간 쪽을 고르지는 않았습니다.',
  reflection: '무엇을 확인하러 돌아갔나요?',
};

let sent = null;
const reply = (findings) => async (url, init) => {
  sent = { url, init };
  assert.equal(init.headers['x-api-key'], config.key);
  return Response.json({ content: [{ type: 'text', text: JSON.stringify({ findings }) }] });
};
const req = (data = body, origin = config.origins[0], method = 'POST') =>
  new Request('https://project.invalid/functions/v1/interpret', {
    method,
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(data) : undefined,
  });

// Preflight, origin allowlist, and a key that never leaves the function.
assert.equal((await createInterpretHandler(config, reply([good]))(req(body, config.origins[0], 'OPTIONS'))).status, 204);
assert.equal((await createInterpretHandler(config, reply([good]))(req(body, 'https://unexpected.invalid'))).status, 403);
assert.equal(sent, null);
assert.equal((await createInterpretHandler({ ...config, key: '' }, reply([good]))(req())).status, 503);
assert.equal((await createInterpretHandler(config, reply([good]))(req({ task: '', rules: [], findings: [] }))).status, 400);

// A valid rewrite comes back, and the visitor's findings are all that was sent.
const ok = await createInterpretHandler(config, reply([good]))(req());
assert.equal(ok.status, 200);
assert.deepEqual((await ok.json()).findings, [good]);
assert.equal(sent.url, 'https://api.anthropic.com/v1/messages');
const forwarded = JSON.parse(sent.init.body);
assert.equal(forwarded.model, 'claude-sonnet-5-5');
assert.match(forwarded.system, /유형명 금지/);
assert.equal(JSON.parse(forwarded.messages[0].content).findings[0].id, 'came-back');

// Anything the exhibition would not say is dropped, and an empty list is a
// normal 200 — the page keeps its template copy.
const typed = { ...good, headline: '당신은 신중한 사람입니다.' };
const noQuestion = { ...good, id: 'other', reflection: '돌아간 이유를 적어 둡니다.' };
for (const bad of [typed, noQuestion, { ...good, interpretation: '짧다' }]) {
  const response = await createInterpretHandler(config, reply([bad]))(req());
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).findings, []);
}
const mixed = await createInterpretHandler(config, reply([typed, good]))(req());
assert.deepEqual((await mixed.json()).findings, [good]);

// An upstream failure is a 503, never a half-written Finding.
const failing = await createInterpretHandler(config, async () => new Response(null, { status: 429 }))(req());
assert.equal(failing.status, 503);
const throwing = await createInterpretHandler(config, async () => { throw new Error('network'); })(req());
assert.equal(throwing.status, 503);

console.log('interpret handler: ok');
