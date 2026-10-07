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
    headline: c.how === 'lingered' ? '결정을 담은 문장을 남기기 전,\n그 문장 앞에서 가장 오래 머물렀습니다.' : '결정을 담은 문장을\n한 번 뺐다가 다시 넣었습니다.',
    interpretation:
      c.how === 'lingered'
        ? `당신이 남긴 문장 속 사람은 ${c.fragmentAct}\n그 문장 앞에서 머문 시간은 다른 어떤 문장보다 길었습니다.\n남긴 말과 그 말을 고르는 움직임은 서로 다른 속도였을 수 있습니다.`
        : `당신이 남긴 문장 속 사람은 ${c.fragmentAct}\n당신은 그 문장을 한 번 뺐다가, 다시 넣었습니다.\n남긴 말과 그 말을 고르는 움직임은 서로 다른 속도였을 수 있습니다.`,
    reflection: c.how === 'lingered' ? '그 문장 앞에서, 무엇을 오래 확인하고 있었을까요?' : '그 문장을 다시 남기게 한 것은 무엇이었을까요?',
  }),
  'settled-words-revised': (c) => ({
    headline: '결정을 담은 문장을 남겼지만,\n당신의 첫 답은 그대로 남지 않았습니다.',
    interpretation: `문장 속 사람은 ${c.fragmentAct}\n그러나 ${c.zones}에서 당신은 처음 고른 답을 바꾸거나 다시 돌아보았습니다.\n이야기 속의 결정과 결정에 이르는 움직임은 같은 모양이 아니었을지도 모릅니다.`,
    reflection: '문장 속의 단호함은 누구의 것이었을까요?',
  }),
  'unsettled-words-steady': (c) => ({
    headline: '머뭇거리는 문장을 남겼지만,\n당신의 선택은 되돌려지지 않았습니다.',
    interpretation: `문장 속 사람은 ${c.fragmentAct}\n${c.zones}에서 당신이 처음 고른 답은 마지막까지 그대로 남았습니다.\n이야기 속의 머뭇거림과 당신이 답을 남기는 움직임은 다른 모양으로 기록되었습니다.`,
    reflection: '문장 속의 머뭇거림에서, 무엇이 마음에 남았을까요?',
  }),
  'first-answer-moved': (c) => ({
    headline: '첫 번째 답보다,\n돌아본 뒤의 답이 더 오래 남았습니다.',
    interpretation: `${c.zones}에서 처음 고른 답이 마지막까지 유지되지 않았습니다.\n이번 조사에서 첫 번째 선택은 결론이라기보다\n확인을 위한 시작점이었을 수 있습니다.`,
    reflection: '당신은 무엇을 다시 확인하고 있었을까요?',
  }),
  'came-back': (c) => ({
    headline: '지나친 것을 다시 찾아가는 움직임이,\n서로 다른 공간에서 반복되었습니다.',
    interpretation: `${c.zones}에서 한 번 지나친 것으로 다시 돌아갔습니다.\n떠난 자리를 한 번 더 확인하는 일이\n이번 조사의 일부였을지도 모릅니다.`,
    reflection: '다시 돌아갔을 때, 무엇이 달라 보였을까요?',
  }),
  'before-heavy': (c) => ({
    headline: '답을 고른 뒤보다,\n고르기 전에 더 오래 머물렀습니다.',
    interpretation: `${c.zones}에서 고르기 전에는 오래 머물렀고,\n고른 뒤에는 거의 돌아보지 않았습니다.\n한 번 정한 답은 그대로 두는 쪽에 가까웠을지도 모릅니다.`,
    reflection: '고르기 전, 무엇을 살펴보고 있었을까요?',
  }),
  'after-heavy': (c) => ({
    headline: '답을 고른 뒤에도,\n그 곁에 한동안 머물렀습니다.',
    interpretation: `${c.zones}에서 선택을 마친 뒤에도\n고른 답 곁에 머무르는 시간이 이어졌습니다.\n이번 조사에서 결정은 끝이라기보다 확인의 시작이었을 수 있습니다.`,
    reflection: '이미 고른 답에서, 무엇을 더 확인하고 싶었을까요?',
  }),
  'attention-not-kept': (c) => ({
    headline: '가장 오래 머문 것이,\n당신이 선택한 것은 아니었습니다.',
    interpretation: c.single
      ? `${c.zone}의 공간에서 가장 오래 머문 ${c.topLabel}\n마지막 답에 들어가지 않았습니다.\n오래 바라보는 것과 남겨두는 것은 서로 다른 일이었을지도 모릅니다.`
      : `${c.zones}에서 오래 머문 대상과 마지막에 남긴 대상이 달랐습니다.\n이번 조사에서 관심과 선택은 같은 방향으로 움직이지 않았습니다.\n오래 바라보는 것과 남겨두는 것은 서로 다른 일이었을지도 모릅니다.`,
    reflection: '남기지 않은 것에도 이유가 있었을까요?',
  }),
  // Only MEMORY (Drawing) and SENTENCE (the closing question) offer an
  // optional place to leave empty, one each — 'left-blank' needs two, so it
  // always rests on both.
  'left-blank': () => ({
    headline: '채울 수 있었던 자리를,\n비워 둔 채 지나갔습니다.',
    interpretation:
      '기억의 공간에서도, 문장의 공간에서도\n선택할 수 있었던 자리 하나가 그대로 남았습니다.\n비워 둔 자리는 빠진 답이 아니라, 남겨 둔 응답으로 기록되었습니다.',
    reflection: '비워 둔 자리에는 무엇이 들어갈 수 있었을까요?',
  }),
  'kept-first': (c) => ({
    headline: '처음 고른 답이,\n마지막까지 그대로 남았습니다.',
    interpretation: `${c.zones}에서 첫 선택은 바뀌지 않았고,\n지나친 것으로 다시 돌아가지도 않았습니다.\n이번 조사에서는 처음 고른 답을 그대로 남겼습니다.`,
    reflection: '처음 고른 답에서, 무엇이 마음에 남았을까요?',
  }),
  'no-convergence': (c) => ({
    headline: '이번 조사에서 당신의 선택은,\n하나의 방식으로 반복되지 않았습니다.',
    interpretation: c.spread
      ? '어떤 곳에서는 빠르게,\n어떤 곳에서는 오래 머물렀습니다.\n하나의 패턴으로 정리되지 않는 것 역시 이번 기록에 남은 특징입니다.'
      : '한 공간에서 보인 움직임이\n다른 공간에서 그대로 되풀이되지는 않았습니다.\n하나의 패턴으로 정리되지 않는 것 역시 이번 기록에 남은 특징입니다.',
    reflection: '공간마다, 무엇이 당신의 속도를 바꾸었을까요?',
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
