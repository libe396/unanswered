/**
 * Deterministic Guide Voice copy for the Final Report's Cinematic Sequence.
 *
 * Kept apart from src/lib/reportStageFacts.ts on purpose — the same
 * separation crossSceneAnalysis.ts's own module doc draws between computing
 * a Finding and turning it into a sentence ("Cross-Scene Finding →
 * (Report Narrative)"). Every sentence here is written once and reused
 * verbatim; nothing is generated per visit.
 *
 * Voice: one register throughout ("~습니다"), plain guide-alongside-you
 * tone — never system phrasing ("~되었습니다" as a status report), never a
 * trait, never "분석 결과". "흔적" names one piece of evidence; "기록" names
 * the session's accumulated result; "응답" names the whole experience's
 * response, never the visitor's identity.
 */
import type { ReportFinding, ReportFindingKind } from './reportStageFacts';
import type { SceneId } from '../types';

/* ── STAGE 01 · 당신이 남긴 것 ───────────────────────────────────────────── */

export const STAGE_01_COPY = {
  closing: '당신이 지나온 경로가\n하나의 기록으로 연결되었습니다.',
};

/* ── STAGE 06 · Subject Reveal ──────────────────────────────────────────── */

/**
 * One line replaces the last rather than accumulating. Structured as the
 * brief asks: REVEAL, then REFRAME (this is not a personality reading),
 * then MEANING (an improvised choice counts the same as a deliberate one),
 * then a plain, unambiguous CLOSURE — before the one poetic line that
 * closes the whole sequence.
 */
export const STAGE_06_BEATS = [
  '처음 이곳에 들어왔을 때,\n당신은 이름 모를 누군가의 기록을 조사하고 있었습니다.',
  '그런데 지금까지 따라온 기록은,\n다른 누군가의 것이 아니었습니다.',
];

/** The reveal itself — the strongest single beat before the closing line. */
export const STAGE_06_REVEAL = '당신도\n기록되고 있었습니다.';

export const STAGE_06_DETAIL = '무엇을 고르고,\n다시 돌아보고,\n어디에서 쉽게 지나가지 못했는지까지.';

/** REFRAME — directly answers "이 결과가 나라는 뜻인가?" before it can
 *  settle in as a misreading. */
export const STAGE_06_REFRAME = '하지만 이 기록이\n당신이라는 사람 전체를 설명하지는 않습니다.';

/** MEANING — an improvised choice and a long-considered one are recorded
 *  on the same terms; neither is treated as the "truer" answer. */
export const STAGE_06_MEANING =
  '즉흥적으로 고른 선택도,\n오래 머문 순간도,\n이번 경험 안에서는 같은 하나의 응답이었습니다.';

/** CLOSURE — the plain, unambiguous statement of the project's thesis,
 *  read before the poetic line rather than left for the visitor to infer. */
export const STAGE_06_CLOSURE = '답은\n마지막에 고른 하나만으로\n만들어지지 않았습니다.';

/** The strongest visual emphasis in the whole sequence. */
export const STAGE_06_FINAL_LINE = '대답하지 못한 순간에도\n당신은 남아 있었습니다.';

/* ── Final Record Layer ─────────────────────────────────────────────────── */

/** Short, system-voice tag per Finding kind — the Final Record composition's
 *  personalized evidence row reads only these, never the Finding's raw
 *  numbers. 'dwell' and 'none' are intentionally absent: dwell alone is not
 *  reliable enough to headline a piece of the closing record (see the Data /
 *  Finding Audit), and 'none' names an absence, not a tile to show. */
const FINAL_RECORD_TAG: Partial<Record<ReportFindingKind, string>> = {
  return: '다시 확인한 흔적',
  hesitation: '머물렀던 순간',
  revision: '바꾸어 고른 선택',
  replay: '다시 들은 소리',
  reconstruction: '직접 채운 자리',
  non_intervention: '그대로 둔 자리',
};

export interface FinalRecordEvidenceItem {
  sceneId: SceneId;
  tag: string;
}

/**
 * Up to 4 distinct Scenes' worth of real evidence for the Final Record
 * Layer's personalized composition.
 *
 * One entry per Scene — the first Finding that names it, in `findings`'s own
 * fixed order (src/lib/reportStageFacts.ts's `buildReportFindings`) — plus
 * the assembled sentence itself when no Finding already covers Sentence and
 * one exists. A session with fewer real Findings gets fewer tiles; nothing
 * here fills the gap with a placeholder for a Scene that has nothing to show.
 */
export function finalRecordEvidence(
  findings: readonly ReportFinding[],
  hasSentence: boolean,
): FinalRecordEvidenceItem[] {
  const items: FinalRecordEvidenceItem[] = [];
  const seen = new Set<SceneId>();

  for (const finding of findings) {
    if (items.length >= 4) break;
    const tag = FINAL_RECORD_TAG[finding.kind];
    const sceneId = finding.evidence[0]?.sceneId;
    if (!tag || !sceneId || seen.has(sceneId)) continue;
    seen.add(sceneId);
    items.push({ sceneId, tag });
  }

  if (items.length < 4 && hasSentence && !seen.has('sentenceClues')) {
    items.push({ sceneId: 'sentenceClues', tag: '선택한 문장' });
  }

  return items;
}

/** Short closing line — reframe and meaning folded into one, so the Final
 *  Record Layer does not repeat Subject Reveal's fuller statement. */
export const FINAL_RECORD_LAYER_COPY = '이번 조사 안에서 남은,\n당신의 응답 기록입니다.';
