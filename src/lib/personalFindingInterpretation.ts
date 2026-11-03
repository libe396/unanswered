/**
 * AI Interpretation for Personal Findings — and its local fallback.
 *
 * The question this step answers is never "what kind of person is this". It
 * is: "this session shows a relationship between two recorded behaviours —
 * say it in a few plain lines the visitor can recognise, and leave a
 * question open." Each Finding carries four layers:
 *
 *   Evidence        — recorded values only (src/lib/personalFindings.ts)
 *   Pattern         — the relationship, in neutral terms (same file)
 *   Interpretation  — headline + 2–3 lines (here)
 *   Reflection      — one open question (here)
 *
 * ── Fallback first ──────────────────────────────────────────────────────────
 *
 * No backend exists for this exhibition (static hosting), so
 * `interpretPersonalFindings` writes every Finding from the templates below,
 * synchronously, on every visit. That is the intended behaviour, not a
 * degraded one. `requestRemoteInterpretation` exists so a real service can be
 * pointed at later through `VITE_REPORT_INTERPRETATION_ENDPOINT` — the same
 * shape src/lib/sentenceQuestionService.ts uses for its own optional
 * endpoint. No API key ever lives in client code: the endpoint is expected to
 * be the exhibition's own server, which holds any key itself.
 *
 * A remote answer is validated before it replaces a template
 * (`isAcceptableInterpretation`): length limits, a question mark on the
 * reflection, and a list of phrasings this exhibition never uses — typing a
 * person, naming a trait, diagnosing, judging. Anything that fails is
 * discarded and the template stays.
 */
import type { FindingKind, PersonalFindingDraft } from './personalFindings';

export interface PersonalFinding extends PersonalFindingDraft {
  headline: string;
  interpretation: string;
  reflection: string;
  /** Never shown — kept so the record can be read back honestly. */
  source: 'template' | 'ai';
}

export type Copy = Pick<PersonalFinding, 'headline' | 'interpretation' | 'reflection'>;

/* ── Templates ───────────────────────────────────────────────────────────── */

/**
 * One template per Finding kind. Register: the exhibition's guide voice
 * ("~습니다"), describing what happened in this session and what it *may*
 * have been — never what the visitor is. Hesitation is never written as a
 * fault, and no line could be read the same way by anyone (each names the
 * Zones or the record it rests on).
 */
const TEMPLATES: Record<FindingKind, (context: Record<string, string>) => Copy> = {
  'settled-words-lingered': (c) => ({
    headline: c.how === 'lingered' ? '결정을 담은 문장 앞에서\n가장 오래 머물렀습니다.' : '결정을 담은 문장을\n한 번 뺐다가 다시 넣었습니다.',
    interpretation:
      c.how === 'lingered'
        ? `당신이 고른 문장 속 사람은 ${c.fragmentAct}\n그 문장 앞에서 머문 시간은 다른 어떤 문장보다 길었습니다.\n문장은 단호하게 끝나지만, 그 문장을 고르기까지는 오래 걸렸습니다.`
        : `당신이 고른 문장 속 사람은 ${c.fragmentAct}\n당신은 그 문장을 한 번 뺐다가 다시 넣었습니다.\n문장은 단호하게 끝나지만, 고르는 일은 한 번에 끝나지 않았습니다.`,
    reflection: c.how === 'lingered' ? '그 문장 앞에서 무엇을 확인하고 있었나요?' : '그 문장을 다시 넣게 한 것은 무엇이었나요?',
  }),
  'settled-words-revised': (c) => ({
    headline: '단호하게 끝나는 문장을 골랐습니다.\n다른 곳에서는 답을 바꾸거나 되돌아갔습니다.',
    interpretation: `문장 속 사람은 ${c.fragmentAct}\n${c.zones}에서 당신은 처음 고른 답을 바꾸거나 다시 돌아봤습니다.\n이야기 속의 결정과 당신이 고른 방식은 서로 다른 모양이었습니다.`,
    reflection: '문장 속의 단호함은 누구의 것이었을까요?',
  }),
  'unsettled-words-steady': (c) => ({
    headline: '머뭇거리는 문장을 골랐습니다.\n정작 당신은 한 번도 답을 바꾸지 않았습니다.',
    interpretation: `문장 속 사람은 ${c.fragmentAct}\n${c.zones}에서 당신은 처음 고른 답을 끝까지 그대로 두었습니다.\n머뭇거린 것은 이야기 속 사람이었고, 당신의 답은 바뀌지 않았습니다.`,
    reflection: '그 머뭇거리는 문장에서 무엇이 마음에 남았나요?',
  }),
  'first-answer-moved': (c) => ({
    headline: '처음 고른 답이\n마지막까지 가지 않았습니다.',
    interpretation: `${c.zones}에서 처음 고른 답을 나중에 바꿨습니다.\n이번 조사에서 첫 선택은 결론보다 출발점에 가까웠습니다.`,
    reflection: '무엇을 다시 확인하고 있었나요?',
  }),
  'came-back': (c) => ({
    headline: '지나친 것을 다시 보러 돌아갔습니다.\n한 곳에서만이 아니었습니다.',
    interpretation: `${c.zones}에서 한 번 지나친 것으로 다시 돌아갔습니다.\n떠난 자리를 한 번 더 보는 것도 이번 조사의 일부였습니다.`,
    reflection: '다시 돌아갔을 때, 무엇이 달라 보였나요?',
  }),
  'before-heavy': (c) => ({
    headline: '고르기까지는 오래 걸렸고\n고른 뒤에는 바로 넘어갔습니다.',
    interpretation: `${c.zones}에서 고르기 전에는 오래 머물렀고, 고른 뒤에는 거의 돌아보지 않았습니다.\n한 번 정한 답은 그대로 두었습니다.`,
    reflection: '고르기 전, 무엇을 살펴보고 있었나요?',
  }),
  'after-heavy': (c) => ({
    headline: '답을 고른 뒤에도\n화면을 바로 떠나지 않았습니다.',
    interpretation: `${c.zones}에서 답을 고른 뒤에도 한동안 머물거나 다시 손을 댔습니다.\n읽기와 조작 시간도 포함되어 있어, 그 이유까지는 알 수 없습니다.`,
    reflection: '답을 고른 뒤의 그 시간은 어떻게 기억되나요?',
  }),
  'attention-not-kept': (c) => ({
    headline: '가장 오래 본 것을\n고르지는 않았습니다.',
    interpretation: c.single
      ? `${c.zone}의 공간에서 가장 오래 머문 ${c.topLabel}\n마지막 답에 들어가지 않았습니다.\n오래 보는 것과 고르는 것이 따로 움직였습니다.`
      : `${c.zones}에서 오래 머문 것과 마지막에 고른 것이 달랐습니다.\n오래 보는 것과 고르는 것이 따로 움직였습니다.`,
    reflection: '고르지 않은 것에도 이유가 있었을까요?',
  }),
  // Only MEMORY (Drawing) and SENTENCE (the closing question) offer an
  // optional place to leave empty, one each — 'left-blank' needs two, so it
  // always rests on both.
  'left-blank': () => ({
    headline: '채울 수 있는 칸을\n비워 두고 지나갔습니다.',
    interpretation: '그림도, 마지막 문장의 빈칸도 비워 두었습니다.\n비워 둔 칸도 고른 답과 똑같이 기록에 남았습니다.',
    reflection: '그 빈칸에는 무엇이 들어갈 수 있었을까요?',
  }),
  'kept-first': (c) => ({
    headline: '처음 고른 답을\n끝까지 바꾸지 않았습니다.',
    interpretation: `${c.zones}에서 첫 선택을 바꾸지 않았고, 지나친 것으로 돌아가지도 않았습니다.\n고른 순간이 곧 마지막 답이었습니다.`,
    reflection: '처음 고른 답에서 무엇이 마음에 남았나요?',
  }),
  'no-convergence': (c) => ({
    headline: '곳마다\n고르는 방식이 달랐습니다.',
    interpretation: c.spread
      ? '어떤 곳에서는 빨리 골랐고, 어떤 곳에서는 오래 머물렀습니다.\n하나의 패턴으로 묶이지 않는 것도 이번 기록의 모습입니다.'
      : '한 곳에서 보인 움직임이 다른 곳에서 되풀이되지 않았습니다.\n하나의 패턴으로 묶이지 않는 것도 이번 기록의 모습입니다.',
    reflection: '곳마다 무엇이 당신의 속도를 바꾸었을까요?',
  }),
};

/**
 * The local interpretation — every Finding, every visit. Synchronous and
 * deterministic: the same record always reads the same way.
 */
export function interpretPersonalFindings(drafts: readonly PersonalFindingDraft[]): PersonalFinding[] {
  return drafts.map((draft) => ({ ...draft, ...TEMPLATES[draft.id](draft.context), source: 'template' }));
}

export function readFindingCopy(id: string, context: Record<string, string>): Copy | null {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, id) ? TEMPLATES[id as FindingKind](context) : null;
}

/* ── Optional remote interpretation ─────────────────────────────────────── */

const REMOTE_ENDPOINT = (import.meta.env.VITE_REPORT_INTERPRETATION_ENDPOINT as string | undefined)?.trim();
const REMOTE_TIMEOUT_MS = 4000;

export function hasRemoteInterpreter(): boolean {
  return Boolean(REMOTE_ENDPOINT);
}

/** Phrasings this exhibition never uses about a visitor. */
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

function isAcceptableInterpretation(copy: Partial<Copy> | null | undefined): copy is Copy {
  if (!copy) return false;
  const { headline, interpretation, reflection } = copy;
  if (typeof headline !== 'string' || typeof interpretation !== 'string' || typeof reflection !== 'string') return false;
  if (headline.length < 4 || headline.length > 60) return false;
  if (interpretation.length < 10 || interpretation.length > 200) return false;
  if (!/\?\s*$/.test(reflection) || reflection.length > 50) return false;
  return ![headline, interpretation, reflection].some((text) => FORBIDDEN.some((rule) => rule.test(text)));
}

/**
 * What a remote interpreter is sent: the relationship and its recorded
 * evidence, and the rules it must write under — never the visitor's name,
 * never the raw event log, never anything about who they are.
 */
function remoteRequestBody(findings: readonly PersonalFinding[]) {
  return {
    task:
      '각 Finding은 이번 세션에서 서로 다른 두 행동 사이에 관찰된 관계입니다. 사람을 설명하지 말고, 그 관계를 관객이 이해할 수 있는 짧은 문장으로 해석하세요.',
    rules: [
      '"당신은 ~한 사람입니다" 금지, 유형명·성격·진단·병리 표현 금지',
      '좋음/나쁨 평가 금지. 머문 시간을 망설임이나 심리의 증거로 단정하지 않기',
      '"~했을 수 있습니다", "~에 가까웠을지도 모릅니다" 같은 열린 표현',
      'evidence에 없는 사실은 쓰지 않기',
      'headline 2줄 이내, interpretation 2~3줄, reflection은 열린 질문 한 문장',
    ],
    findings: findings.map((finding) => ({
      id: finding.id,
      patternType: finding.patternType,
      tension: finding.tension,
      pattern: finding.pattern,
      evidence: finding.evidence,
    })),
  };
}

/**
 * Asks the configured interpreter to rephrase the template Findings. Returns
 * null when no endpoint is configured, on timeout, or on any failure; returns
 * the Findings with only the validated entries replaced otherwise.
 */
export async function requestRemoteInterpretation(
  findings: readonly PersonalFinding[],
): Promise<PersonalFinding[] | null> {
  if (!REMOTE_ENDPOINT || findings.length === 0) return null;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(REMOTE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(remoteRequestBody(findings)),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { findings?: Array<Partial<Copy> & { id?: string }> };
    const byId = new Map((data.findings ?? []).map((item) => [item.id, item]));
    return findings.map((finding) => {
      const remote = byId.get(finding.id);
      return isAcceptableInterpretation(remote) && !/망설|주저|고민/.test(remote.headline)
        ? { ...finding, headline: remote.headline, interpretation: remote.interpretation, reflection: remote.reflection, source: 'ai' }
        : finding;
    });
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}
