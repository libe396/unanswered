/*
  Personal Finding interpretation. Deploy behind Supabase Edge Functions.

  The browser sends the Findings it already wrote from templates — the
  relationship between two recorded behaviours, and the evidence each rests
  on — and gets back the same Findings in other words. It never sends who the
  visitor is, their name, or the raw event log: see `remoteRequestBody` in
  src/lib/personalFindingInterpretation.ts for exactly what leaves the page.

  The model key lives here and only here. The page holds no key and talks to
  nothing but this function, which is why the client's endpoint variable is a
  plain URL.

  Everything this returns is validated twice — once here, once again in the
  browser (`isAcceptableInterpretation`). A Finding whose rewrite fails either
  check keeps its template text, so a bad answer degrades to the exhibition's
  own voice instead of reaching a visitor.
*/
export interface InterpretConfig {
  /** Anthropic API key. Server-side only. */
  key: string;
  origins: string[];
  model?: string;
}

const MAX_BYTES = 64 * 1024;
const MAX_FINDINGS = 5;
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const API = 'https://api.anthropic.com/v1/messages';

/** Phrasings this exhibition never uses about a visitor — mirrors the client's list. */
const FORBIDDEN = [
  /사람입니다/,
  /사람이에요/,
  /성격/,
  /성향/,
  /유형/,
  /타입/,
  /MBTI/i,
  /진단/,
  /우유부단/,
  /회피/,
  /불안/,
  /강박/,
  /장애/,
  /(신중|직관|탐색|회피)형/,
  /당신은\s*[^.\n]{0,12}(한|인)\s*사람/,
];

interface Copy { id: string; headline: string; interpretation: string; reflection: string }

function acceptable(value: unknown): value is Copy {
  if (!value || typeof value !== 'object') return false;
  const { id, headline, interpretation, reflection } = value as Record<string, unknown>;
  if (typeof id !== 'string' || !id) return false;
  if (typeof headline !== 'string' || headline.length < 4 || headline.length > 60) return false;
  if (typeof interpretation !== 'string' || interpretation.length < 10 || interpretation.length > 200) return false;
  if (typeof reflection !== 'string' || reflection.length > 50 || !/\?\s*$/.test(reflection)) return false;
  if (/망설|주저|고민/.test(headline)) return false;
  return ![headline, interpretation, reflection].some((text) => FORBIDDEN.some((rule) => rule.test(text)));
}

/** The task and rules the page sent, as the system prompt. */
function systemPrompt(task: string, rules: string[]): string {
  return [
    task,
    '',
    '규칙:',
    ...rules.map((rule) => `- ${rule}`),
    '',
    '출력은 JSON 하나만. 설명, 머리말, 코드펜스 없이:',
    '{"findings":[{"id":"<입력과 같은 id>","headline":"","interpretation":"","reflection":""}]}',
    'headline 60자 이내, interpretation 200자 이내, reflection 50자 이내이며 물음표로 끝난다.',
    '줄바꿈은 \\n 으로 넣는다. 입력에 있는 모든 id를 빠짐없이 돌려준다.',
  ].join('\n');
}

/** The model's text answer → the findings array, or null if it is not usable. */
function parseAnswer(text: string): Copy[] | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { findings?: unknown };
    if (!Array.isArray(parsed.findings)) return null;
    const findings = parsed.findings.filter(acceptable);
    return findings.length ? findings : null;
  } catch {
    return null;
  }
}

export function createInterpretHandler(config: InterpretConfig, transport: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const headers = new Headers({
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Origin',
    });
    const respond = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
    if (origin && !config.origins.includes(origin)) return respond(403, { error: 'ORIGIN' });
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return respond(405, { error: 'METHOD' });
    if (!config.key) return respond(503, { error: 'NOT_CONFIGURED' });
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
      return respond(415, { error: 'JSON_REQUIRED' });
    }
    if (Number(request.headers.get('content-length')) > MAX_BYTES) return respond(413, { error: 'TOO_LARGE' });

    let input: { task?: unknown; rules?: unknown; findings?: unknown };
    try {
      const text = await request.text();
      if (text.length > MAX_BYTES) return respond(413, { error: 'TOO_LARGE' });
      input = JSON.parse(text);
    } catch {
      return respond(400, { error: 'INVALID' });
    }

    const task = typeof input.task === 'string' ? input.task : '';
    const rules = Array.isArray(input.rules) ? input.rules.filter((rule): rule is string => typeof rule === 'string') : [];
    const findings = Array.isArray(input.findings) ? input.findings.slice(0, MAX_FINDINGS) : [];
    if (!task || !rules.length || !findings.length) return respond(400, { error: 'INVALID' });

    let answer: Response;
    try {
      answer = await transport(API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model || DEFAULT_MODEL,
          max_tokens: 1600,
          temperature: 0.7,
          system: systemPrompt(task, rules),
          messages: [{ role: 'user', content: JSON.stringify({ findings }) }],
        }),
      });
    } catch {
      return respond(503, { error: 'UPSTREAM' });
    }
    if (!answer.ok) return respond(503, { error: 'UPSTREAM' });

    let text = '';
    try {
      const data = (await answer.json()) as { content?: Array<{ type?: string; text?: string }> };
      text = (data.content ?? []).filter((part) => part.type === 'text').map((part) => part.text ?? '').join('');
    } catch {
      return respond(503, { error: 'UPSTREAM' });
    }

    const rewritten = parseAnswer(text);
    // Nothing usable is not an error the page needs to handle: it keeps the
    // templates either way. Say so plainly rather than returning a 5xx.
    if (!rewritten) return respond(200, { findings: [] });
    return respond(200, { findings: rewritten });
  };
}
