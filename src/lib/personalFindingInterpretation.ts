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
 * `interpretPersonalFindings` writes every Finding from the templates below,
 * synchronously, on every visit, and that stays the behaviour whenever no
 * interpreter is configured — it is the intended fallback, not a degraded
 * one. `VITE_REPORT_INTERPRETATION_ENDPOINT` points at a service that
 * rewrites them; supabase/functions/interpret is the one this exhibition
 * deploys, and it is off until that variable is set. No API key ever lives
 * in client code: the endpoint holds the key itself.
 *
 * Why it is worth connecting (user test, 2026-11-03): with the templates
 * alone every visitor reads one of eleven fixed lines, and because each one
 * only restates behaviour the visitor just performed, the report lands as
 * something already known ("내가 그전에 했던, 당연히 알고 있던 내용만
 * 나와서"). The request below therefore asks for the *contrast* between two
 * records — the thing a visitor cannot see about their own visit — not a
 * rephrasing of either one.
 *
 * A remote answer is validated before it replaces a template
 * (`isAcceptableInterpretation`): length limits, a question mark on the
 * reflection, and a list of phrasings this exhibition never uses — typing a
 * person, naming a trait, diagnosing, judging. Anything that fails is
 * discarded and the template stays.
 */
import type { FindingKind, PersonalFindingDraft } from './personalFindings';
import { reportStorageHeaders } from './reportTransfer';

export interface PersonalFinding extends PersonalFindingDraft {
  headline: string;
  interpretation: string;
  reflection: string;
  /** Never shown — kept so the record can be read back honestly. */
  source: 'template' | 'ai';
}

export type Copy = Pick<PersonalFinding, 'headline' | 'interpretation' | 'reflection'>;

/* ── Templates ───────────────────────────────────────────────────────────── */

type CopyBuilder = (context: Record<string, string>) => Copy;

/**
 * Several ways of writing each Finding kind. Register: the exhibition's guide
 * voice ("~습니다"), describing what happened in this session and what it
 * *may* have been — never what the visitor is. Hesitation is never written as
 * a fault, and no line could be read the same way by anyone (each names the
 * Zones or the record it rests on).
 *
 * Every entry leads with the *relationship* between two records rather than
 * restating one of them. A visitor already knows what they chose; the only
 * thing this page can tell them that they could not have told themselves is
 * where two of their own records disagree — which Zone was quickest and which
 * was slowest, that the longest look was not the answer, that the first answer
 * was not the last. User testing read the earlier one-behaviour phrasings as
 * things they already knew ("내가 그전에 했던, 당연히 알고 있던 내용만 나와서").
 *
 * The variants exist so two visitors whose records produce the same Finding do
 * not read the same screen; `variantIndex` picks one from the Finding's own
 * values, so a single visit always reads the same way — the Report is printed,
 * carried to a phone by QR, and re-rendered from the shared record.
 */
const TEMPLATES: Record<FindingKind, CopyBuilder[]> = {
  'settled-words-lingered': [
    (c) => ({
      headline: c.how === 'lingered' ? '결정을 담은 문장 앞에서\n가장 오래 머물렀습니다.' : '결정을 담은 문장을\n한 번 뺐다가 다시 넣었습니다.',
      interpretation:
        c.how === 'lingered'
          ? `당신이 고른 문장 속 사람은 ${c.fragmentAct}\n그 문장 앞에서 머문 시간은 다른 어떤 문장보다 길었습니다.\n문장은 단호하게 끝나지만, 그 문장을 고르기까지는 오래 걸렸습니다.`
          : `당신이 고른 문장 속 사람은 ${c.fragmentAct}\n당신은 그 문장을 한 번 뺐다가 다시 넣었습니다.\n문장은 단호하게 끝나지만, 고르는 일은 한 번에 끝나지 않았습니다.`,
      reflection: c.how === 'lingered' ? '그 문장 앞에서 무엇을 확인하고 있었나요?' : '그 문장을 다시 넣게 한 것은 무엇이었나요?',
    }),
    (c) => ({
      headline: c.how === 'lingered' ? '문장은 한 번에 끝납니다.\n그 앞의 시간은 그렇지 않았습니다.' : '문장은 한 번에 끝납니다.\n고르는 일은 두 번에 끝났습니다.',
      interpretation:
        c.how === 'lingered'
          ? `문장 속 사람은 ${c.fragmentAct}\n그 문장을 고르는 데 쓴 시간은 이 구역에서 가장 길었습니다.\n기록에는 고른 문장과, 고르기까지 걸린 시간이 나란히 남아 있습니다.`
          : `문장 속 사람은 ${c.fragmentAct}\n그 문장은 한 번 목록에서 빠졌다가 다시 들어왔습니다.\n기록에 남은 것은 최종 목록이 아니라 그 왕복입니다.`,
      reflection: c.how === 'lingered' ? '그 시간 동안 무엇을 재고 있었나요?' : '뺐을 때와 다시 넣었을 때, 무엇이 달랐나요?',
    }),
  ],
  'settled-words-revised': [
    (c) => ({
      headline: '단호하게 끝나는 문장을 골랐습니다.\n다른 곳에서는 답을 바꾸거나 되돌아갔습니다.',
      interpretation: `문장 속 사람은 ${c.fragmentAct}\n${c.zones}에서 당신은 처음 고른 답을 바꾸거나 다시 돌아봤습니다.\n이야기 속의 결정과 당신이 고른 방식은 서로 다른 모양이었습니다.`,
      reflection: '문장 속의 단호함은 누구의 것이었을까요?',
    }),
    (c) => ({
      headline: '고른 문장은 끝맺는 문장이었고\n고르는 방식은 되돌아가는 방식이었습니다.',
      interpretation: `문장 속 사람은 ${c.fragmentAct}\n같은 조사 안에서 ${c.zones}의 당신은 한 번 정한 답을 다시 열었습니다.\n고른 것과 고르는 방식이 서로 다른 이야기를 적었습니다.`,
      reflection: '그 문장에 끌린 것은 그 사람의 결정이었을까요?',
    }),
  ],
  'unsettled-words-steady': [
    (c) => ({
      headline: '머뭇거리는 문장을 골랐습니다.\n정작 당신은 한 번도 답을 바꾸지 않았습니다.',
      interpretation: `문장 속 사람은 ${c.fragmentAct}\n${c.zones}에서 당신은 처음 고른 답을 끝까지 그대로 두었습니다.\n머뭇거린 것은 이야기 속 사람이었고, 당신의 답은 바뀌지 않았습니다.`,
      reflection: '그 머뭇거리는 문장에서 무엇이 마음에 남았나요?',
    }),
    (c) => ({
      headline: '끝맺지 못한 문장을 골라 두고\n당신의 답은 한 번에 끝났습니다.',
      interpretation: `문장 속 사람은 ${c.fragmentAct}\n그 문장을 고른 사람의 기록에는 ${c.zones} 어디에도 고쳐 쓴 자리가 없습니다.\n끌린 문장과 남긴 기록이 서로 반대쪽에 있습니다.`,
      reflection: '끝맺지 않은 문장 쪽에 무엇이 있었나요?',
    }),
  ],
  'first-answer-moved': [
    (c) => ({
      headline: `${c.zones}에서\n첫 답과 마지막 답이 달랐습니다.`,
      interpretation: `${c.zones}에서 처음 고른 답은 마지막 답이 아니었습니다.\n기록에는 두 답이 모두 남아 있습니다.\n보고서에 적히는 것은 바뀐 답이 아니라, 바꿨다는 사실입니다.`,
      reflection: '무엇이 첫 답을 놓게 했을까요?',
    }),
    (c) => ({
      headline: '첫 답을 지운 자리가\n한 곳에만 있지 않았습니다.',
      interpretation: `${c.zones}에서 각각 첫 선택이 최종 선택으로 이어지지 않았습니다.\n같은 일이 서로 다른 공간에서 되풀이되었습니다.\n이번 조사에서 첫 선택은 결론보다 출발점에 가까웠습니다.`,
      reflection: '첫 답과 마지막 답 사이에 무엇이 있었나요?',
    }),
  ],
  'came-back': [
    (c) => ({
      headline: `${c.zones}에서\n지나친 것으로 다시 돌아갔습니다.`,
      interpretation: `한 번 지나친 것을 ${c.zones}에서 다시 열어 보았습니다.\n되돌아가는 일이 한 공간의 일이 아니라 이번 조사 전체의 움직임이었습니다.`,
      reflection: '다시 돌아갔을 때, 무엇이 달라 보였나요?',
    }),
    (c) => ({
      headline: '지나친 것을 다시 보러 돌아갔습니다.\n한 곳에서만이 아니었습니다.',
      interpretation: `${c.zones}에서 한 번 지나친 것으로 다시 돌아갔습니다.\n떠난 자리를 한 번 더 보는 것도 이번 조사의 일부였습니다.`,
      reflection: '처음 지나칠 때는 무엇이 보이지 않았을까요?',
    }),
  ],
  'before-heavy': [
    (c) => ({
      headline: '고르기까지는 오래 걸렸고\n고른 뒤에는 바로 넘어갔습니다.',
      interpretation: `${c.zones}에서 고르기 전에는 오래 머물렀고, 고른 뒤에는 거의 돌아보지 않았습니다.\n한 번 정한 답은 그대로 두었습니다.`,
      reflection: '고르기 전, 무엇을 살펴보고 있었나요?',
    }),
    (c) => ({
      headline: '시간은 전부\n고르기 전에 쓰였습니다.',
      interpretation: `${c.zones}에서 같은 모양이 반복됩니다. 답을 정하기 전의 시간은 길고, 정한 뒤의 시간은 거의 없습니다.\n확인은 선택보다 먼저 끝났습니다.`,
      reflection: '정하고 난 뒤에는 왜 더 볼 것이 없었을까요?',
    }),
  ],
  'after-heavy': [
    (c) => ({
      headline: '답을 고른 뒤에도\n화면을 바로 떠나지 않았습니다.',
      interpretation: `${c.zones}에서 답을 고른 뒤에도 한동안 머물거나 다시 손을 댔습니다.\n읽기와 조작 시간도 포함되어 있어, 그 이유까지는 알 수 없습니다.`,
      reflection: '답을 고른 뒤의 그 시간은 어떻게 기억되나요?',
    }),
    (c) => ({
      headline: '선택은 끝났는데\n기록은 끝나지 않았습니다.',
      interpretation: `${c.zones}에서 답을 남긴 뒤에도 머문 시간이나 손댄 기록이 이어집니다.\n기록이 멈춘 자리는 당신이 답한 자리가 아니라 당신이 떠난 자리입니다.`,
      reflection: '떠나기 전에 무엇을 한 번 더 보았나요?',
    }),
  ],
  'attention-not-kept': [
    (c) => ({
      headline: '가장 오래 본 것을\n고르지는 않았습니다.',
      interpretation: c.single
        ? `${c.zone}의 공간에서 가장 오래 머문 ${c.topLabel}\n마지막 답에 들어가지 않았습니다.\n오래 보는 것과 고르는 것이 따로 움직였습니다.`
        : `${c.zones}에서 오래 머문 것과 마지막에 고른 것이 달랐습니다.\n오래 보는 것과 고르는 것이 따로 움직였습니다.`,
      reflection: '고르지 않은 것에도 이유가 있었을까요?',
    }),
    (c) => ({
      headline: '시선이 가장 오래 멈춘 자리와\n답이 적힌 자리가 달랐습니다.',
      interpretation: c.single
        ? `${c.zone}의 공간에서 ${c.topLabel} 가장 오래 본 대상이었지만, 고른 것은 다른 쪽이었습니다.\n보고서는 당신이 고른 것과 함께, 오래 보고도 고르지 않은 것을 적어 둡니다.`
        : `${c.zones}에서 가장 오래 본 것과 최종 답이 각각 달랐습니다.\n한 곳의 예외가 아니라 반복된 거리입니다.`,
      reflection: '오래 본 쪽은 왜 답이 되지 않았을까요?',
    }),
  ],
  // Only MEMORY (Drawing) and SENTENCE (the closing question) offer an
  // optional place to leave empty, one each — 'left-blank' needs two, so it
  // always rests on both.
  'left-blank': [
    (c) => ({
      headline: '채울 수 있는 칸을\n비워 두고 지나갔습니다.',
      interpretation: c.memoryBlank && c.sentenceBlank
        ? `기록에 남은 두 줄입니다.\n— ${c.memoryBlank}\n— ${c.sentenceBlank}\n두 자리 모두 채울 수 있었고, 비워 둔 채로 기록되었습니다.`
        : '그림도, 마지막 문장의 빈칸도 비워 두었습니다.\n비워 둔 칸도 고른 답과 똑같이 기록에 남았습니다.',
      reflection: '그 빈칸에는 무엇이 들어갈 수 있었을까요?',
    }),
    (c) => ({
      headline: '비워 둔 자리가\n한 곳이 아니었습니다.',
      interpretation: c.memoryBlank && c.sentenceBlank
        ? `기록에 남은 두 줄입니다.\n— ${c.memoryBlank}\n— ${c.sentenceBlank}\n답하지 않는 것은 실패가 아니라 선택지였고, 두 번 다 그 쪽을 골랐습니다.`
        : '채워도 되고 비워도 되는 자리가 두 곳 있었고, 두 곳 다 비었습니다.\n이 조사에서 답하지 않는 것은 실패가 아니라 선택지였습니다.',
      reflection: '비워 두는 쪽을 고르게 한 것은 무엇이었나요?',
    }),
  ],
  'kept-first': [
    (c) => ({
      headline: `${c.zones}\n어디에도 고쳐 쓴 자리가 없습니다.`,
      interpretation: `${c.zones}에서 첫 선택이 그대로 마지막 선택이 되었습니다.\n지나친 것으로 돌아간 기록도, 고른 뒤 다시 손댄 기록도 없습니다.\n고른 순간과 답한 순간 사이에 아무것도 적히지 않았습니다.`,
      reflection: '한 번에 정해진 답은 무엇으로 정해졌을까요?',
    }),
    (c) => ({
      headline: '처음 고른 답을\n끝까지 바꾸지 않았습니다.',
      interpretation: `${c.zones}에서 첫 선택을 바꾸지 않았고, 지나친 것으로 돌아가지도 않았습니다.\n고른 순간이 곧 마지막 답이었습니다.`,
      reflection: '처음 고른 답에서 무엇이 마음에 남았나요?',
    }),
  ],
  'no-convergence': [
    (c) => ({
      headline: c.spread
        ? `${c.slowestZone}에서는 오래 머물렀고\n${c.fastestZone}에서는 바로 골랐습니다.`
        : '곳마다\n고르는 방식이 달랐습니다.',
      interpretation: c.spread
        ? `${c.slowestZone}의 흔적에서 첫 답까지 ${c.slowestTime}, ${c.fastestZone}의 흔적에서는 ${c.fastestTime}였습니다.\n같은 조사 안에서 공간마다 다른 속도로 답했습니다.\n이 차이는 어느 쪽이 더 어려웠는지를 뜻하지 않습니다. 기록은 속도만 압니다.`
        : '한 곳에서 보인 움직임이 다른 곳에서 되풀이되지 않았습니다.\n하나의 패턴으로 묶이지 않는 것도 이번 기록의 모습입니다.',
      reflection: c.spread ? `${c.slowestZone}에서 시간이 더 걸린 이유는 무엇이었을까요?` : '곳마다 무엇이 당신의 속도를 바꾸었을까요?',
    }),
    (c) => ({
      headline: c.spread
        ? `가장 빠른 답과 가장 느린 답\n사이가 ${c.fastestTime}과 ${c.slowestTime}였습니다.`
        : '한 공간의 움직임이\n다음 공간에서 반복되지 않았습니다.',
      interpretation: c.spread
        ? `${c.fastestZone}의 흔적에서는 ${c.fastestTime} 만에 첫 답을 남겼고, ${c.slowestZone}의 흔적에서는 ${c.slowestTime}가 걸렸습니다.\n하나의 속도로 묶이지 않는 것도 이번 기록의 모습입니다.`
        : '어떤 곳에서는 빨리 골랐고, 어떤 곳에서는 오래 머물렀습니다.\n하나의 패턴으로 묶이지 않는 것도 이번 기록의 모습입니다.',
      reflection: c.spread ? `${c.fastestZone}에서는 무엇이 그렇게 빨리 정해졌을까요?` : '곳마다 무엇이 당신의 속도를 바꾸었을까요?',
    }),
  ],
};

/**
 * The local interpretation — every Finding, every visit. Synchronous and
 * deterministic: the same record always reads the same way.
 */
export function interpretPersonalFindings(drafts: readonly PersonalFindingDraft[]): PersonalFinding[] {
  return drafts.map((draft) => ({ ...draft, ...writeCopy(draft.id, draft.context)!, source: 'template' }));
}

export function readFindingCopy(id: string, context: Record<string, string>): Copy | null {
  return writeCopy(id, context);
}

/**
 * Which wording this record gets. Derived from the Finding's id and its own
 * context values only — the two things every caller holds, so the Scene, the
 * phone Report and the printed sheet all land on the same variant for the
 * same visit.
 */
function variantIndex(id: string, context: Record<string, string>, count: number): number {
  if (count <= 1) return 0;
  const seed = [id, ...Object.keys(context).sort().map((key) => `${key}=${context[key]}`)].join('|');
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (Math.imul(hash, 31) + seed.charCodeAt(index)) >>> 0;
  return hash % count;
}

function writeCopy(id: string, context: Record<string, string>): Copy | null {
  if (!Object.prototype.hasOwnProperty.call(TEMPLATES, id)) return null;
  const variants = TEMPLATES[id as FindingKind];
  return variants[variantIndex(id, context, variants.length)](context);
}

/* ── Optional remote interpretation ─────────────────────────────────────── */

const REMOTE_ENDPOINT = (import.meta.env.VITE_REPORT_INTERPRETATION_ENDPOINT as string | undefined)?.trim();
/*
  The request is sent once, on the Final Report's mount, and its answer is
  only ever used if it lands before the first Finding is on screen
  (`findingShownRef` in FinalReportScene). The Subject Reveal's own holds run
  8.8s before that, and the Reframe / Method stage is two reads further on, so
  a model call has room — 4s was cutting off answers that would still have
  arrived in good time. Nothing waits on this: the templates are already on
  screen when it resolves.
*/
const REMOTE_TIMEOUT_MS = 9000;

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
      '각 Finding은 이번 세션에서 서로 다른 두 행동 사이에 관찰된 관계입니다. 사람을 설명하지 말고, 그 관계를 관객이 이해할 수 있는 짧은 문장으로 해석하세요. 관객은 자기가 무엇을 골랐는지 이미 압니다. 그러므로 고른 것을 다시 말해 주는 문장은 이 보고서에 적을 이유가 없습니다. 관객이 스스로는 볼 수 없었던 것, 즉 evidence 안의 두 기록이 서로 어긋나는 지점을 말하세요.',
    rules: [
      '"당신은 ~한 사람입니다" 금지, 유형명·성격·진단·병리 표현 금지',
      '좋음/나쁨 평가 금지. 머문 시간을 망설임이나 심리의 증거로 단정하지 않기',
      '"~했을 수 있습니다", "~에 가까웠을지도 모릅니다" 같은 열린 표현',
      'evidence에 없는 사실은 쓰지 않기',
      'headline 2줄 이내, interpretation 2~3줄, reflection은 열린 질문 한 문장',
      'headline은 두 기록 사이의 어긋남을 말할 것. 한 가지 행동의 재진술("~을 골랐습니다", "~초 머물렀습니다")로 끝나면 실패다',
      'interpretation은 그 어긋남이 어느 공간과 어느 공간 사이에서 생겼는지 밝힐 것',
      'reflection은 관객이 답을 이미 아는 질문이 아니라, 처음 생각해 보게 되는 질문 한 문장',
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
      // The same public anon key the report storage call sends, so the
      // interpreter can be deployed with Supabase's own JWT check on rather
      // than as an open endpoint. It is not a secret — it already ships in
      // the bundle — and the function's origin allowlist is the real gate.
      headers: { ...reportStorageHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(remoteRequestBody(findings)),
      signal: controller.signal,
      credentials: 'omit',
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
