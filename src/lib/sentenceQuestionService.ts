/**
 * SENTENCE's unresolved question — a content service, not a behavioural one.
 *
 * The visitor draws three to five fragments and reads them, in draw order,
 * as one possible account of what happened to CASE 017 after the record
 * breaks off. This file's whole job is one sentence long: find the one
 * unnamed thing in that account, and ask about it.
 *
 * "Question is not a new event. It only points at a gap that already
 * exists in the story the visitor built." Nothing here writes a story —
 * see the module doc on src/data/content.ts's `openSlots` for what "a gap
 * that already exists" means concretely: a fragment either explicitly names
 * something as unnamed (a물건, a 말, a 기록, a 결정, a 사람) or it does not,
 * and this file is not in the business of deciding that a fragment which
 * names nothing missing secretly does. Roughly half the archive has no
 * `openSlots` at all, and a visitor whose whole draw is made of those
 * fragments gets no question — see `findQuestionTarget` and
 * `NO_TARGET_MESSAGE` below, not a manufactured one.
 *
 * ── Which fragment gets asked about ─────────────────────────────────────────
 *
 * `findQuestionTarget` always runs locally and deterministically, but — as
 * of the Final Logic Patch — no longer by draw order. Draw order said
 * nothing about which gap actually mattered most in the account the visitor
 * built; it only said which card they happened to touch first. What decides
 * now is a score, computed once over every drawn fragment that has an open
 * slot at all:
 *
 *   1. `SLOT_BASE_SCORE[openSlot]` — some kinds of gap are just more
 *      concrete and easier to answer than others (a missing object vs. an
 *      unnamed feeling-shaped "purpose"). See that table's own doc.
 *   2. + a bonus for every *other* drawn fragment that shares a
 *      `semanticTags` entry with this candidate (`SAME_TAG_BONUS`) — two
 *      fragments both about an object left behind make "which object"
 *      read as the more central question of *this particular* account.
 *   3. + a smaller bonus for every other drawn fragment whose tags are
 *      merely *linked* to this candidate's, via `SEMANTIC_LINKS`
 *      (`LINKED_TAG_BONUS`) — "waiting" and "absence" are not the same
 *      idea, but a visitor who drew both is reading the same thread.
 *
 * Ties (equal total score) are broken, in order: more same-tag matches,
 * then more linked-tag matches, then a small fixed `QUALITY_RANK` per
 * fragment, then — only as the very last resort — draw order. None of this
 * changes *what* a question can say, only *which* of the visitor's own
 * named gaps gets asked about; see "Fallback" below for why the wording
 * itself still never drifts from the fragment's own text.
 *
 * ── Fallback, and why it is not a last resort ──────────────────────────────
 *
 * No backend exists for this exhibition to call yet — see the module doc on
 * `REMOTE_ENDPOINT` below — so `generateFragmentQuestion` runs the local
 * fallback on every visit today, and does so instantly: no network wait, no
 * loading state, nothing that could read as "AI is thinking." That is the
 * intended behaviour at the exhibition, not a degraded one. Every one of
 * the eleven fragments that carries an `openSlots` entry has its own specific
 * fallback question below (`FRAGMENT_QUESTIONS`) — never a single question
 * shared by every fragment of the same slot type, which would read as
 * generic exactly the way this Zone is not supposed to (see the quality
 * test in the module doc on `FRAGMENT_QUESTIONS`). `SLOT_TYPE_FALLBACK` is
 * kept only as a defensive second layer, for an `openSlots` type that ever
 * gets added to a fragment without a specific entry alongside it.
 *
 * The remote branch exists so a real service can be pointed at later
 * (`VITE_SENTENCE_QUESTION_ENDPOINT`) without this file, or the Scene,
 * changing shape. Per this revision's own brief, a configured remote
 * service is not asked to invent a question freely — it receives the
 * target fragment's text and its openSlot, and its job is to phrase that
 * one gap naturally, not to add anything the fragment does not already
 * name. Its answer is validated before it is trusted
 * (`isAcceptableQuestion`) and discarded rather than shown if it fails.
 * Whichever branch answers, the visitor is never told which — `source` is
 * recorded for the record's own honesty and never rendered.
 */
import type { SentenceReconstructionFragment } from '../data/content';

export interface SentenceQuestionResult {
  /** Which fragment the question is about — null only when nothing drawn
   *  has an open slot at all; see `NO_TARGET_MESSAGE`. */
  fragmentId: string | null;
  openSlot: string | null;
  question: string;
  source: 'ai' | 'fallback' | null;
}

/**
 * A same-origin or CORS-enabled URL for a future question-phrasing service,
 * configured by whoever deploys this build — never a secret. No API key is
 * read, held or sent from this file or anywhere in the client: if a real
 * model needs one, the endpoint above is expected to be a small proxy that
 * holds it server-side. Unset by default, which is what every environment
 * this project builds for today should leave it as.
 */
const REMOTE_ENDPOINT = (import.meta.env.VITE_SENTENCE_QUESTION_ENDPOINT as string | undefined)?.trim();

/** How long the remote branch is given before this falls back anyway. Short:
 *  a visitor should never notice a wait either way. */
const REMOTE_TIMEOUT_MS = 2500;

const MAX_QUESTION_LENGTH = 40;

/**
 * The one fallback question for each fragment that has an `openSlots`
 * entry — keyed by fragment id, not by slot type, and written specifically
 * against that fragment's own wording. This is the whole point of keying by
 * fragment rather than type: "미처 챙기지 못한 물건은 무엇이었을까요?" and
 * "몇 번이고 챙겼다가 다시 내려놓은 물건은 무엇이었을까요?" are both about
 * an `object`, but neither would sit naturally under the other fragment —
 * the quality test this revision's brief sets is exactly "would this
 * question read fine under a completely different fragment," and a
 * shared, type-level default fails it by construction. Every fragment
 * listed in src/data/content.ts with a non-empty `openSlots` has an entry
 * here; `SLOT_TYPE_FALLBACK` below is the safety net for the day that stops
 * being true.
 */
const FRAGMENT_QUESTIONS: Readonly<Record<string, string>> = {
  RECON_A_RETURNED_FOR: '그 사람이 다시 확인하려 했던 것은 무엇이었을까요?',
  RECON_A_WAITED: '그 사람이 기다리던 사람은 누구였을까요?',
  RECON_B_LEFT_BEHIND: '미처 챙기지 못한 물건은 무엇이었을까요?',
  RECON_B_PUT_DOWN_AGAIN: '몇 번이고 챙겼다가 다시 내려놓은 물건은 무엇이었을까요?',
  RECON_B_LEFT_ON_PURPOSE: '일부러 남겨두고 간 물건은 무엇이었을까요?',
  // Final Logic Patch: RECON_B_DISPLACED gained an openSlots entry — "몇몇
  // 물건" already names an unspecified plural, this only asks which one.
  RECON_B_DISPLACED: '어떤 물건의 자리가 달라져 있었을까요?',
  RECON_C_UNSPOKEN: '그 사람이 끝내 전하지 못한 말은 무엇이었을까요?',
  RECON_C_UNDONE_ACTION: '하려다 그만둔 행동은 무엇이었을까요?',
  RECON_C_UNWRITTEN_RECORD: '남기려 했던 기록에는 무엇이 적혀 있었을까요?',
  RECON_C_UNDECIDED: '마지막까지 결정하지 못한 것은 무엇이었을까요?',
  RECON_D_VANISHED_LATER: '나중에 사라진 물건은 무엇이었을까요?',
};

/** Defensive only — every fragment with an `openSlots` entry has a specific
 *  question above. Reached only if that ever stops being true. */
const SLOT_TYPE_FALLBACK: Readonly<Record<string, string>> = {
  object: '남아 있던 물건은 무엇이었을까요?',
  message: '전하지 못한 말은 무엇이었을까요?',
  record: '남기려 했던 기록에는 무엇이 담겨 있었을까요?',
  decision: '결정하지 못한 것은 무엇이었을까요?',
  action: '하려다 그만둔 것은 무엇이었을까요?',
  person: '기다리던 사람은 누구였을까요?',
  purpose: '다시 확인하려 했던 것은 무엇이었을까요?',
};

/** Shown — briefly, as part of the `discovering` beat — when nothing the
 *  visitor drew has anything left to ask about. Not an error: some
 *  accounts are already whole. */
export const NO_TARGET_MESSAGE = '추가로 복원할 수 있는 정보가 확인되지 않았습니다.';

/**
 * How concrete and answerable a kind of gap is, on its own — see the module
 * doc's point 1. Higher means "easier for a visitor to name in a few words
 * and more central to what actually happened," lower means "more abstract,
 * more likely to pull the visitor into inventing a new thread of story."
 * `message` / `object` / `record` / `decision` sit well above `action` /
 * `person` / `purpose` for exactly that reason. Numbers are tunable; the
 * ordering between those two bands is the part that matters.
 */
const SLOT_BASE_SCORE: Readonly<Record<string, number>> = {
  message: 100,
  object: 95,
  record: 90,
  decision: 85,
  action: 75,
  person: 65,
  purpose: 60,
};

/** Per other drawn fragment that shares an identical `semanticTags` entry
 *  with a candidate — see the module doc's point 2. */
const SAME_TAG_BONUS = 12;
/** Per other drawn fragment whose tags are merely *linked* (not identical)
 *  to a candidate's — see the module doc's point 3 and `SEMANTIC_LINKS`. */
const LINKED_TAG_BONUS = 6;

/**
 * Tag pairs treated as one thread of meaning without being the same word.
 * Order within a pair does not matter. Kept intentionally short — this is
 * scoring nuance, not a thesaurus, and every entry has to earn its place
 * against a concrete fragment pair (see content.ts's `semanticTags` doc).
 */
const SEMANTIC_LINKS: ReadonlyArray<readonly [string, string]> = [['waiting', 'absence']];

function tagsAreLinked(a: string, b: string): boolean {
  return SEMANTIC_LINKS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/**
 * Final, fixed tie-breaker between candidates whose score and both bonus
 * counts are still equal — the module doc's "fragment-specific question
 * quality" step. Only meaningful within a shared `openSlots` type (today,
 * only ever among the `object` fragments); unlisted fragments default to 0.
 * Authored once, not derived — this is a judgment call about which fragment
 * of a tied pair asks the more central question, not a measurement.
 */
const QUALITY_RANK: Readonly<Record<string, number>> = {
  RECON_B_LEFT_BEHIND: 3,
  RECON_B_PUT_DOWN_AGAIN: 2,
  RECON_D_VANISHED_LATER: 2,
  RECON_B_LEFT_ON_PURPOSE: 1,
  RECON_B_DISPLACED: 1,
};

interface ScoredCandidate {
  fragment: SentenceReconstructionFragment;
  drawIndex: number;
  sameTagMatches: number;
  linkedTagMatches: number;
  totalScore: number;
}

/**
 * The drawn fragment whose named gap scores highest — see the module doc
 * above for the full rule and its tie-break chain. `drawnIds` is the
 * visitor's own collected fragments, in draw order; fragments not drawn are
 * never considered, and draw order only ever settles a complete tie.
 */
export function findQuestionTarget(
  drawnIds: readonly string[],
  fragmentsById: ReadonlyMap<string, SentenceReconstructionFragment>,
): SentenceReconstructionFragment | null {
  const drawn = drawnIds
    .map((id) => fragmentsById.get(id))
    .filter((f): f is SentenceReconstructionFragment => f !== undefined);

  const candidates: ScoredCandidate[] = [];
  drawn.forEach((fragment, drawIndex) => {
    const openSlot = fragment.openSlots[0];
    if (!openSlot) return;

    let sameTagMatches = 0;
    let linkedTagMatches = 0;
    for (const other of drawn) {
      if (other.id === fragment.id) continue;
      if (fragment.semanticTags.some((tag) => other.semanticTags.includes(tag))) {
        sameTagMatches += 1;
        continue;
      }
      if (fragment.semanticTags.some((tag) => other.semanticTags.some((t) => tagsAreLinked(tag, t)))) {
        linkedTagMatches += 1;
      }
    }

    const baseScore = SLOT_BASE_SCORE[openSlot] ?? 50;
    candidates.push({
      fragment,
      drawIndex,
      sameTagMatches,
      linkedTagMatches,
      totalScore: baseScore + sameTagMatches * SAME_TAG_BONUS + linkedTagMatches * LINKED_TAG_BONUS,
    });
  });

  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) =>
      b.totalScore - a.totalScore ||
      b.sameTagMatches - a.sameTagMatches ||
      b.linkedTagMatches - a.linkedTagMatches ||
      (QUALITY_RANK[b.fragment.id] ?? 0) - (QUALITY_RANK[a.fragment.id] ?? 0) ||
      a.drawIndex - b.drawIndex,
  );

  return candidates[0].fragment;
}

function fallbackQuestionFor(fragment: SentenceReconstructionFragment): string {
  const specific = FRAGMENT_QUESTIONS[fragment.id];
  if (specific) return specific;
  const slotType = fragment.openSlots[0];
  return slotType ? (SLOT_TYPE_FALLBACK[slotType] ?? NO_TARGET_MESSAGE) : NO_TARGET_MESSAGE;
}

/**
 * A remote answer is trusted only if it still obeys this Zone's own rules:
 * one line, short, no forbidden register, and — since a configured remote
 * service is only ever asked to *phrase* a named gap, never to invent one —
 * this does not (and structurally cannot) check "is this question grounded
 * in the fragment," because the request never gave the remote service room
 * to answer anything else. Never patches or truncates a response that
 * fails — a question this file cannot vouch for is not shown at all, and
 * `generateFragmentQuestion` falls back instead.
 */
function isAcceptableQuestion(candidate: unknown): candidate is string {
  if (typeof candidate !== 'string') return false;
  const trimmed = candidate.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_QUESTION_LENGTH) return false;
  if (/\n/.test(trimmed)) return false;
  // The register this exhibition never uses — see docs/PROMPTS.md's "Words
  // to avoid" and the ban on personality/diagnosis framing. A response
  // carrying any of these is refused outright rather than trimmed.
  const forbidden = ['성격', '진단', '우울', '불안', '트라우마', '왜 ', '이유가'];
  if (forbidden.some((word) => trimmed.includes(word))) return false;
  return true;
}

async function requestRemoteQuestion(
  fragment: SentenceReconstructionFragment,
  openSlot: string,
): Promise<string | null> {
  if (!REMOTE_ENDPOINT) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS);
  try {
    const response = await fetch(REMOTE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The service is asked to phrase one named gap, not to invent one —
      // see the module doc. `allowedContext` is exactly the fragment's own
      // text; nothing else about the visit is ever sent.
      body: JSON.stringify({ fragmentText: fragment.text, openSlot, allowedContext: fragment.text }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    const question = (data as { question?: unknown } | null)?.question;
    return isAcceptableQuestion(question) ? question : null;
  } catch {
    // Network failure, timeout, malformed JSON — all read the same way here:
    // nothing to show, fall back. Never surfaced to the visitor as an error.
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Finds the question for one fragment's one named gap. `fragment` must have
 * a non-empty `openSlots` — callers decide *whether* to ask at all via
 * `findQuestionTarget`; this only decides what to ask once that is settled.
 */
export async function generateFragmentQuestion(
  fragment: SentenceReconstructionFragment,
): Promise<SentenceQuestionResult> {
  const openSlot = fragment.openSlots[0] ?? null;
  if (!openSlot) {
    return { fragmentId: null, openSlot: null, question: NO_TARGET_MESSAGE, source: null };
  }

  const remoteQuestion = await requestRemoteQuestion(fragment, openSlot);
  if (remoteQuestion) {
    return { fragmentId: fragment.id, openSlot, question: remoteQuestion, source: 'ai' };
  }
  return { fragmentId: fragment.id, openSlot, question: fallbackQuestionFor(fragment), source: 'fallback' };
}

/* ── Response synthesis — template, not free generation ──────────────────────
   "관객 입력은 새로운 독립 문장을 쓰는 것이 아니라 기존 기록의 미확정
   정보를 보완하는 값입니다." One template per fragment that carries an
   `openSlots` entry, each written against that fragment's own grammar, so
   the visitor's word is inserted rather than a new sentence assembled
   around it. The closing register shifts from the fragment's own hedge
   ("~듯하다", "~것으로 보인다") to "~것으로 기록되었다" — not because the
   visitor's word makes the case more certain, but because *this specific
   detail*, once written down, is now part of the record the way the rest
   of an answered question is; the hedge belongs to what stays unconfirmed,
   not to the one thing this step exists to let the visitor confirm. */

/** True when the last syllable of `word` carries a trailing consonant
 *  (받침) — batchim-aware particle selection for text a visitor typed, not
 *  fixed content, so this has to hold for arbitrary short Korean input. */
function hasBatchim(word: string): boolean {
  const trimmed = word.trim();
  if (trimmed.length === 0) return false;
  const code = trimmed.charCodeAt(trimmed.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  return hasBatchim(word) ? withBatchim : withoutBatchim;
}

type ResponseTemplate = (response: string) => string;

const RESPONSE_TEMPLATES: Readonly<Record<string, ResponseTemplate>> = {
  RECON_A_RETURNED_FOR: (r) =>
    `한번 떠났다가, ${r}${josa(r, '을', '를')} 확인하기 위해 다시 돌아온 것으로 기록되었다.`,
  RECON_A_WAITED: (r) => `그 사람은 ${r}${josa(r, '을', '를')} 기다리며 그 자리에 머물러 있었던 것으로 기록되었다.`,
  RECON_B_LEFT_BEHIND: (r) => `미처 챙기지 못한 ${r}${josa(r, '이', '가')} 그 자리에 남아 있었던 것으로 기록되었다.`,
  RECON_B_PUT_DOWN_AGAIN: (r) =>
    `그 사람이 몇 번이고 챙겼다가 다시 내려놓은 것은 ${r}${josa(r, '이었던', '였던')} 것으로 기록되었다.`,
  RECON_B_LEFT_ON_PURPOSE: (r) =>
    `가져갈 수 있었지만, ${r}${josa(r, '을', '를')} 일부러 남겨둔 것으로 기록되었다.`,
  RECON_B_DISPLACED: (r) => `${r}${josa(r, '이', '가')} 이전과 다른 자리에 놓여 있었던 것으로 기록되었다.`,
  RECON_C_UNSPOKEN: (r) => `그 사람이 끝내 전하지 못한 말은 "${r}"${josa(r, '이었던', '였던')} 것으로 기록되었다.`,
  RECON_C_UNDONE_ACTION: (r) => `하려다 그만둔 행동은 ${r}${josa(r, '이었을', '였을')} 가능성으로 기록되었다.`,
  RECON_C_UNWRITTEN_RECORD: (r) =>
    `누군가에게 남기려던 기록에는 "${r}"${josa(r, '이', '가')} 적혀 있었던 것으로 기록되었다.`,
  RECON_C_UNDECIDED: (r) => `마지막까지 결정하지 못한 것은 ${r}${josa(r, '이었던', '였던')} 것으로 기록되었다.`,
  RECON_D_VANISHED_LATER: (r) => `시간이 지난 뒤, 남겨져 있던 ${r}${josa(r, '이', '가')} 사라진 것으로 기록되었다.`,
};

/**
 * The fragment's text, with the visitor's own answer written into its named
 * gap. `response` is used exactly as left — trimmed, never rewritten,
 * corrected or expanded — only positioned grammatically by the template.
 * Falls back to the fragment's own original text if it carries no template
 * (should not happen for a fragment `generateFragmentQuestion` was ever
 * asked about, but this stays total rather than throwing).
 */
export function synthesizeRestoredLine(fragment: SentenceReconstructionFragment, response: string): string {
  const template = RESPONSE_TEMPLATES[fragment.id];
  const trimmed = response.trim();
  if (!template || trimmed.length === 0) return fragment.text;
  return template(trimmed);
}
