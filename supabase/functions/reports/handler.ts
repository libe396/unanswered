/** Deploy behind Supabase Edge Functions. No browser credential or SDK required. */
export interface StorageConfig { url: string; key: string; origins: string[]; salt: string }
const MAX_BYTES = 25 * 1024 * 1024;
const ID = /^[a-f0-9]{48}$/;
/* Every wording the feedback form has ever shipped. A row stores the version
   it was answered under, so answers to different questions never merge; the
   set only grows, since a visitor on a cached page may still send an older
   one. v1: "무엇에 관한 경험" + replay 1-5. v2: what stayed + 0 for 보지 않았다. */
const FEEDBACK_VERSIONS = new Set(['ut-2026-11-02-v1', 'ut-2026-11-03-v2']);
const digest = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), value => value.toString(16).padStart(2, '0')).join('');

async function readBody(request: Request): Promise<string> {
  if (Number(request.headers.get('content-length')) > MAX_BYTES) throw new Error('TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('INVALID');
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BYTES) { await reader.cancel(); throw new Error('TOO_LARGE'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function createReportHandler(config: StorageConfig, transport: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const headers = new Headers({ 'Cache-Control': 'no-store', 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' });
    const respond = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
    if (origin && !config.origins.includes(origin)) return respond(403, { error: 'ORIGIN' });
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!config.url || !config.key || !config.salt) return respond(503, { error: 'NOT_CONFIGURED' });
    const adminHeaders = { apikey: config.key, Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' };
    const admin = (path: string, init: RequestInit = {}) => transport(`${config.url}${path}`, { ...init, headers: { ...adminHeaders, ...init.headers } });
    const path = new URL(request.url).pathname.split('/').filter(Boolean);
    const route = path.lastIndexOf('reports');
    const tail = route < 0 ? ['invalid'] : path.slice(route + 1);
    try {
      if (request.method === 'POST' && tail.length === 1 && tail[0] === 'feedback') {
        if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return respond(415, { error: 'JSON_REQUIRED' });
        const text = await readBody(request);
        if (text.length > 16000) return respond(413, { error: 'TOO_LARGE' });
        const input = JSON.parse(text);
        if (input?.feedbackConsent !== true || !FEEDBACK_VERSIONS.has(input.consentVersion) || typeof input.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.id)
          || typeof input.meaning !== 'string' || input.meaning.length > 600 || typeof input.friction !== 'string' || input.friction.length > 600
          || (input.replayHelp !== null && (!Number.isInteger(input.replayHelp) || input.replayHelp < 0 || input.replayHelp > 5))
          || typeof input.recordConsent !== 'boolean' || (!input.meaning.trim() && input.replayHelp === null && !input.friction.trim())
          || (input.recordConsent && (typeof input.reportRef !== 'string' || !ID.test(input.reportRef)))) return respond(400, { error: 'INVALID' });
        const address = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
        const client = await digest(`${config.salt}:${new Date().toISOString().slice(0, 10)}:${address}`);
        const saved = await admin('/rest/v1/rpc/submit_exhibition_feedback', { method: 'POST', body: JSON.stringify({ p_id: input.id, p_meaning: input.meaning.trim(), p_help: input.replayHelp, p_friction: input.friction.trim(), p_record_consent: input.recordConsent, p_report: input.recordConsent ? input.reportRef : null, p_client: client }) });
        if (!saved.ok) return respond(503, { error: 'STORAGE' });
        const result = await saved.json();
        if (result === 'RATE_LIMIT') return respond(429, { error: result });
        if (result === 'CAPACITY') return respond(507, { error: result });
        if (result !== 'OK') return respond(400, { error: 'INVALID' });
        return respond(200, { ok: true });
      }
      if (request.method === 'GET'  && tail.length === 1 && ID.test(tail[0])) {
        const metadata = await admin(`/rest/v1/exhibition_reports?id=eq.${tail[0]}&ready=eq.true&select=id`);
        if (!metadata.ok) return respond(503, { error: 'STORAGE' });
        if (!(await metadata.json()).length) return respond(404, { error: 'NOT_FOUND' });
        const file = await admin(`/storage/v1/object/exhibition-reports/${tail[0]}.json`);
        if (!file.ok) return respond(file.status === 404 ? 404 : 503, { error: 'STORAGE' });
        return new Response(file.body, { status: 200, headers });
      }
      if (request.method !== 'POST' || tail.length) return respond(404, { error: 'NOT_FOUND' });
      if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return respond(415, { error: 'JSON_REQUIRED' });
      const body = await readBody(request);
      const value = JSON.parse(body);
      if (value?.v !== 1 || value.report?.v !== 1 || typeof value.report.id !== 'string' || !Array.isArray(value.findings) || !Array.isArray(value.replays) || !Array.isArray(value.strokes)) return respond(400, { error: 'INVALID' });
      // Allow only the report contract, never arbitrary camera/audio/log fields.
      const bundle = { v: 1, report: value.report, findings: value.findings, replays: value.replays, strokes: value.strokes, light: value.light ?? null };
      const json = JSON.stringify(bundle);
      const byteSize = new TextEncoder().encode(json).byteLength;
      const hash = await digest(json);
      const address = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
      const client = await digest(`${config.salt}:${new Date().toISOString().slice(0, 10)}:${address}`);
      const reserved = await admin('/rest/v1/rpc/reserve_exhibition_report', { method: 'POST', body: JSON.stringify({ p_hash: hash, p_bytes: byteSize, p_client: client }) });
      if (!reserved.ok) return respond(503, { error: 'STORAGE' });
      const id: unknown = await reserved.json();
      if (id === 'RATE_LIMIT') return respond(429, { error: id });
      if (id === 'CAPACITY') return respond(507, { error: id });
      if (id === 'TOO_LARGE') return respond(413, { error: id });
      if (typeof id !== 'string' || !ID.test(id)) return respond(503, { error: 'STORAGE' });
      const existing = await admin(`/rest/v1/exhibition_reports?id=eq.${id}&ready=eq.true&select=id`);
      if (!existing.ok) return respond(503, { error: 'STORAGE' });
      if ((await existing.json()).length) return respond(200, { id });
      const file = await admin(`/storage/v1/object/exhibition-reports/${id}.json`, { method: 'POST', headers: { 'x-upsert': 'false' }, body: json });
      // A duplicate is immutable and has identical content by reservation hash.
      if (!file.ok) {
        const conflict = await file.json().catch(() => ({}));
        if (file.status !== 409 && String(conflict.statusCode) !== '409' && conflict.error !== 'Duplicate') return respond(503, { error: 'STORAGE' });
      }
      const ready = await admin(`/rest/v1/exhibition_reports?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ ready: true }) });
      if (!ready.ok) return respond(503, { error: 'STORAGE' });
      return respond(200, { id });
    } catch (error) {
      return respond(error instanceof Error && error.message === 'TOO_LARGE' ? 413 : error instanceof SyntaxError || error instanceof TypeError ? 400 : 503, { error: 'REQUEST_FAILED' });
    }
  };
}
