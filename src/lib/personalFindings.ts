/**
 * Personal Findings — the Final Report's relationship reading.
 *
 *   Raw Trace → Scene Pattern → Cross-scene Pattern → Personal Finding
 *   → (AI Interpretation, src/lib/personalFindingInterpretation.ts)
 *   → (Final Report Rendering, src/scenes/report/ReportStageFinding.tsx)
 *
 * The earlier report showed one behaviour per screen — "you returned here",
 * "you lingered there" — which the visitor already knew. This file reads
 * *between* behaviours instead: the same move repeated in two Zones, what was
 * said against how it was arrived at, what was attended to against what was
 * kept, what was left empty. One act alone is never a Finding here; every
 * candidate below needs at least two recorded behaviours to stand on.
 *
 * Nothing here measures anything new. Every figure is read off the existing
 * Scene Summaries (`summarizeScene` / `summarizeSound` / `summarizeMemory` /
 * `summarizeSentence`) and Scene Patterns, via `buildCrossSceneInput` and
 * `analyzeCrossScene` — the same thresholds every Zone already validated.
 * Where a Zone recorded nothing (touchscreen hover, a skipped step, a Zone
 * never reached), the figure is null and the candidate that needed it simply
 * does not fire.
 *
 * What this file will not do: name a trait. A Finding describes what
 * happened in this session between two recorded acts — never what kind of
 * person did it. The strength score is internal ranking only and is never
 * shown to the visitor.
 */
import { soundPositionMeaning } from './soundPositionMeaning';
import { buildCrossSceneInput } from './crossSceneAdapter';
import { analyzeCrossScene } from './crossSceneAnalysis';
import type { CrossSceneFinding, CrossSceneInput, CrossSceneTraceId, CrossSceneZoneId } from './crossSceneAnalysis';
import { summarizeScene } from './behaviorTracking';
import type { GroupSummary } from './behaviorTracking';
import { OBJECT_GROUP } from './memoryTracking';
import { SENTENCE_THRESHOLDS } from './sentenceThresholds';
import { MEMORY_ROOM_OBJECTS, SENTENCE_RECONSTRUCTION_FRAGMENTS, SOUND_CLUES } from '../data/content';
import { ARCHIVE_META } from '../archiveMeta.js';
import type { RecordLayerDerived, SceneBehaviorRecord, SceneId } from '../types';

/* ── Types ───────────────────────────────────────────────────────────────── */

export type PatternType = 'repeat' | 'contradiction' | 'absence' | 'sequence';

export type ZoneKey = CrossSceneZoneId;

export type FindingKind =
  | 'settled-words-lingered'
  | 'settled-words-revised'
  | 'unsettled-words-steady'
  | 'first-answer-moved'
  | 'came-back'
  | 'before-heavy'
  | 'after-heavy'
  | 'attention-not-kept'
  | 'left-blank'
  | 'kept-first'
  | 'no-convergence';

/** One Zone's share of a Finding's evidence — only recorded values. */
export interface FindingEvidence {
  zone: ZoneKey;
  /** The Zone's own name, as the exhibition shows it ('빛의 흔적' …). */
  scene: string;
  /** What happened there, in one plain line. */
  description: string;
  /** Short measured values ('선택 전 18.2초' …). Never estimated. */
  metrics: string[];
}

/**
 * A Finding before it is put into words. `context` holds the few labels the
 * interpretation step is allowed to name (a fragment's text, an object's
 * label) — all copied from the record, nothing inferred.
 */
export interface PersonalFindingDraft {
  id: FindingKind;
  patternType: PatternType;
  /** The two behaviours held against each other, e.g. '첫 판단 ↔ 최종 판단'. */
  tension: string;
  /** What the pattern is, in neutral terms — the "Pattern" layer. */
  pattern: string;
  evidence: FindingEvidence[];
  /** Internal ranking only. Never rendered. */
  strength: number;
  /** Zones that independently showed it. */
  zones: ZoneKey[];
  context: Record<string, string>;
}

/* ── Names ───────────────────────────────────────────────────────────────── */

export const ZONE_SCENE_NAME: Record<ZoneKey, string> = {
  LIGHT: '빛의 흔적',
  SOUND: '소리의 흔적',
  MEMORY: '기억의 흔적',
  SENTENCE: '문장의 흔적',
};

/** The short noun used inside sentences ("빛과 문장에서"). */
export const ZONE_SHORT_NAME: Record<ZoneKey, string> = {
  LIGHT: '빛',
  SOUND: '소리',
  MEMORY: '기억',
  SENTENCE: '문장',
};

const ZONE_ORDER: readonly ZoneKey[] = ['LIGHT', 'SOUND', 'MEMORY', 'SENTENCE'];

const ZONE_TO_SCENE: Record<ZoneKey, SceneId> = {
  LIGHT: 'lightArchive',
  SOUND: 'soundClues',
  MEMORY: 'memorySketch',
  SENTENCE: 'sentenceClues',
};

const IMAGE_LABELS = new Map(
  (ARCHIVE_META as Array<{ slot: string; label: string }>).map(({ slot, label }) => [`IMAGE_${slot}`, label]),
);

function targetLabel(zone: ZoneKey, id: string | null | undefined): string | null {
  if (!id) return null;
  if (zone === 'LIGHT') return IMAGE_LABELS.get(id) || null;
  if (zone === 'SOUND') return SOUND_CLUES.find((item) => item.id === id)?.label ?? null;
  if (zone === 'MEMORY') return MEMORY_ROOM_OBJECTS.find((item) => item.id === id)?.label ?? null;
  return SENTENCE_RECONSTRUCTION_FRAGMENTS.find((item) => item.id === id)?.text ?? null;
}

/** A target as it is named in evidence. A SENTENCE fragment is a whole
 *  sentence, so it is named as "‘…’ 문장" — particles then attach to 문장. */
function quoted(zone: ZoneKey, id: string | null | undefined): string {
  const label = targetLabel(zone, id);
  if (!label) return '';
  return zone === 'SENTENCE' ? `‘${label}’ 문장` : `‘${label}’`;
}

/**
 * The only content reading this file makes, and it is literal: a handful of
 * SENTENCE fragments narrate, in their own words, either a settled act (left
 * with what was needed; left something on purpose) or an unsettled one
 * (could not leave; never decided; picked up and put down again). No other
 * fragment is classified — anything not listed here is never used to build
 * a "said ↔ did" contradiction. The phrase is how a Finding may restate the
 * fragment, in the past tense of the exhibition's guide voice.
 */
const SETTLED_FRAGMENTS: Record<string, string> = {
  RECON_A_LEFT_CALM: '필요한 것만 챙겨 방을 나섰습니다.',
  RECON_B_LEFT_ON_PURPOSE: '가져갈 수 있었던 물건을 일부러 두고 갔습니다.',
};

const UNSETTLED_FRAGMENTS: Record<string, string> = {
  RECON_A_HESITATED: '떠나려 했지만 한동안 방을 나서지 못했습니다.',
  RECON_C_UNDECIDED: '끝까지 정하지 못한 일을 남겨 두었습니다.',
  RECON_B_PUT_DOWN_AGAIN: '몇 번이고 물건을 챙겼다가 다시 내려놓았습니다.',
  RECON_C_UNDONE_ACTION: '하려던 일을 끝내 그만두었습니다.',
};

/* ── Formatting ──────────────────────────────────────────────────────────── */

function seconds(ms: number): string {
  return `${(Math.round(ms / 100) / 10).toFixed(1)}초`;
}

function hasBatchim(word: string): boolean {
  // The last Hangul syllable decides, past any closing quote or period.
  const match = word.match(/[\uac00-\ud7a3](?=[^\uac00-\ud7a3]*$)/);
  if (!match) return true;
  return (match[0].charCodeAt(0) - 0xac00) % 28 !== 0;
}

/** 을/를 after `word`. */
function eul(word: string): string {
  return `${word}${hasBatchim(word) ? '을' : '를'}`;
}

/** 은/는 after `word`. */
function eun(word: string): string {
  return `${word}${hasBatchim(word) ? '은' : '는'}`;
}

/** "빛과 문장", "소리와 기억", "빛, 소리, 문장". */
export function joinZoneNames(zones: readonly ZoneKey[]): string {
  const names = ZONE_ORDER.filter((zone) => zones.includes(zone)).map((zone) => ZONE_SHORT_NAME[zone]);
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]}${hasBatchim(names[0]) ? '과' : '와'} ${names[1]}`;
  return names.join(', ');
}

/* ── Stage 1–2 · Raw Trace → Scene Pattern ──────────────────────────────── */

/**
 * One Zone, read for the few things a relationship can be built from. Every
 * field is either copied from a Scene Summary / Scene Pattern or null when
 * this visit did not record it. No interpretation yet.
 */
export interface ZoneTrace {
  zone: ZoneKey;
  /** First answer → final answer differ (net), per the existing REVISION
   *  reading plus SOUND's own sound-choice change. */
  firstAnswerMoved: boolean;
  firstAnswerDetail: string | null;
  /** Time from the question opening to the first answer. */
  preMs: number | null;
  /** Time from the last answer to moving on. */
  postMs: number | null;
  /** Left something and came back to it (RETURN, or RECHECK). */
  cameBack: boolean;
  cameBackDetail: string | null;
  /** Kept working on the answer after it was already given. */
  afterActivity: boolean;
  afterDetail: string | null;
  /** The measured value behind `afterDetail`, when it is not `postMs`. */
  afterMetric: string | null;
  /** The most-attended target was not kept. Null when attention could not
   *  be measured reliably (no hover on touch, nothing listened to). */
  attentionGap: { topLabel: string; topMs: number; keptMs: number | null } | null;
  /** Optional places this Zone offered and the visitor left empty. */
  blanks: string[];
}

function traceDetected(findings: Map<CrossSceneTraceId, CrossSceneFinding>, id: CrossSceneTraceId, zone: ZoneKey): boolean {
  const evidence = findings.get(id)?.zoneEvidence.find((item) => item.sceneId === zone);
  return Boolean(evidence?.applicable && evidence.detected);
}

function patternDetected(patterns: readonly { id: string; detected: boolean }[] | null | undefined, id: string): boolean {
  return Boolean(patterns?.find((pattern) => pattern.id === id)?.detected);
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function lightTrace(input: CrossSceneInput, cross: Map<CrossSceneTraceId, CrossSceneFinding>): ZoneTrace | null {
  const light = input.light;
  if (!light) return null;
  const image = light.imageGroup;
  const emotion = light.emotionGroup;
  const finalId = image.finalSelectedIds[0] ?? null;
  const firstAnswerMoved = traceDetected(cross, 'REVISION', 'LIGHT');

  const cameBack = traceDetected(cross, 'RETURN', 'LIGHT') || traceDetected(cross, 'RECHECK', 'LIGHT');
  const mostReturned = Object.entries(image.viewCountByTarget).sort((a, b) => b[1] - a[1])[0];

  const topId = image.longestViewedTargetId;
  const gap = traceDetected(cross, 'ATTENTION_CHOICE_GAP', 'LIGHT') && topId && topId !== finalId;

  return {
    zone: 'LIGHT',
    firstAnswerMoved,
    firstAnswerDetail: firstAnswerMoved
      ? `최초 선택 ${quoted('LIGHT', image.firstSelectedId) || '첫 사진'} → 최종 선택 ${quoted('LIGHT', finalId) || '다른 사진'}`
      : null,
    preMs: finiteOrNull(image.msFromGroupOpenToFirstSelection ?? image.msFromSceneEnterToFirstSelection),
    postMs: finiteOrNull(emotion?.msFromFinalSelectionToCommit),
    cameBack,
    cameBackDetail:
      cameBack && mostReturned && mostReturned[1] >= 2
        ? `${quoted('LIGHT', mostReturned[0]) || '한 사진'} 앞에 ${mostReturned[1]}번 머묾`
        : cameBack
          ? '지나친 사진으로 다시 돌아감'
          : null,
    afterActivity: traceDetected(cross, 'POST_DECISION', 'LIGHT'),
    afterDetail: traceDetected(cross, 'POST_DECISION', 'LIGHT') ? '마지막 감정 단어를 고른 뒤에도 머묾' : null,
    afterMetric: null,
    attentionGap: gap
      ? {
          topLabel: quoted('LIGHT', topId) || '한 사진',
          topMs: image.dwellMsByTarget[topId] ?? 0,
          keptMs: finalId ? image.dwellMsByTarget[finalId] ?? null : null,
        }
      : null,
    blanks: [],
  };
}

function soundTrace(input: CrossSceneInput, cross: Map<CrossSceneTraceId, CrossSceneFinding>): ZoneTrace | null {
  const sound = input.sound;
  if (!sound) return null;
  const s = sound.summary;
  const soundMoved = s.firstSelected !== null && s.finalSelected !== null && s.firstSelected !== s.finalSelected;
  const positionMoved = traceDetected(cross, 'REVISION', 'SOUND');

  const cameBack = traceDetected(cross, 'RETURN', 'SOUND') || traceDetected(cross, 'RECHECK', 'SOUND');
  // Listening on after choosing counts as checking only when the choice then
  // stayed — a listen that led to a different sound is the revision itself.
  const replayAfter = patternDetected(sound.soundPatterns, 'POST_SELECTION_REPLAY') && !soundMoved;
  const afterActivity = traceDetected(cross, 'POST_DECISION', 'SOUND') || replayAfter;

  const top = s.mostListenedSound;
  const gap = traceDetected(cross, 'ATTENTION_CHOICE_GAP', 'SOUND') && top && top !== s.finalSelected;

  return {
    zone: 'SOUND',
    firstAnswerMoved: soundMoved || positionMoved,
    firstAnswerDetail: soundMoved
      ? `최초 선택 ${quoted('SOUND', s.firstSelected)} → 최종 선택 ${quoted('SOUND', s.finalSelected)}`
      : positionMoved
        ? `처음 놓은 자리에서 ${s.positioning.positionRevisionCount}번 옮김`
        : null,
    preMs: finiteOrNull(s.sceneEnterToFirstSelectionMs),
    postMs: finiteOrNull(s.postDecisionMs),
    cameBack,
    cameBackDetail: cameBack
      ? s.replayCount > 0
        ? `들었던 소리를 ${s.replayCount}번 다시 재생`
        : `지나친 소리로 ${Math.max(1, s.returnCount)}번 돌아감`
      : null,
    afterActivity,
    afterDetail: afterActivity
      ? replayAfter
        ? `고른 뒤에도 소리를 ${s.sessionsAfterFirstSelection.length}번 더 재생`
        : '고른 뒤에도 한동안 머묾'
      : null,
    afterMetric: replayAfter ? `고른 뒤 들은 시간 ${seconds(s.sessionsAfterFirstSelection.reduce((sum, item) => sum + item.listenedMs, 0))}` : null,
    attentionGap: gap
      ? {
          topLabel: quoted('SOUND', top),
          topMs: s.listenTimeBySound[top] ?? 0,
          keptMs: s.finalSelected ? s.listenTimeBySound[s.finalSelected] ?? null : null,
        }
      : null,
    blanks: [],
  };
}

function memoryTrace(
  input: CrossSceneInput,
  cross: Map<CrossSceneTraceId, CrossSceneFinding>,
  record: SceneBehaviorRecord | undefined,
): ZoneTrace | null {
  const memory = input.memory;
  if (!memory || !record) return null;
  const m = memory.summary;
  const objectGroup: GroupSummary | undefined = summarizeScene(record).groups[OBJECT_GROUP];

  // Objects selected and then let go, in the order it happened.
  const released: string[] = [];
  const held = new Set<string>();
  for (const event of record.events) {
    if ((event.type !== 'select' && event.type !== 'deselect') || event.group !== OBJECT_GROUP) continue;
    if (event.type === 'select') held.add(event.targetId);
    else if (held.delete(event.targetId) && !released.includes(event.targetId)) released.push(event.targetId);
  }
  const releasedLabels = released.map((id) => quoted('MEMORY', id)).filter(Boolean);

  const firstAnswerMoved = traceDetected(cross, 'REVISION', 'MEMORY') || released.length > 0;
  // Changing the set after it was already valid is a revision (above), not
  // a check on a kept answer — only Drawing's own post-decision wait counts.
  const afterActivity = traceDetected(cross, 'POST_DECISION', 'MEMORY');
  const cameBack = traceDetected(cross, 'RETURN', 'MEMORY') || traceDetected(cross, 'RECHECK', 'MEMORY');

  const top = m.mostViewedObject;
  const gap =
    m.hasObjectViewData && traceDetected(cross, 'ATTENTION_CHOICE_GAP', 'MEMORY') && top && !m.finalSelectedObjects.includes(top);

  const blanks: string[] = [];
  if (!m.drawingEntered) blanks.push('그리기 단계를 열지 않고 넘어감');
  else if (!m.drawingUsed && m.strokeCount > 0) blanks.push(`그렸던 선 ${m.strokeCount}개를 모두 지우고 비워 둠`);
  else if (!m.drawingUsed) blanks.push('빈 캔버스를 열었지만 아무것도 남기지 않음');

  const selectedCount = m.objectSelectionPath.length;
  return {
    zone: 'MEMORY',
    firstAnswerMoved,
    firstAnswerDetail: firstAnswerMoved
      ? releasedLabels.length > 0
        ? `${eul(releasedLabels.slice(0, 2).join(', '))}${releasedLabels.length > 2 ? ` (외 ${releasedLabels.length - 2}개)` : ''} 골랐다가 해제 · 선택 ${selectedCount}번 → 최종 ${m.finalSelectedObjects.length}개`
        : `처음 고른 물건 조합에서 ${m.objectSelectionChangeCount}번 바꿈`
      : null,
    preMs: finiteOrNull(objectGroup?.msFromGroupOpenToFirstSelection),
    postMs: finiteOrNull(objectGroup?.msFromFinalSelectionToCommit),
    cameBack,
    cameBackDetail: cameBack
      ? m.returnedObjects.length > 0
        ? `${m.returnedObjects.map((id) => quoted('MEMORY', id)).filter(Boolean).slice(0, 2).join(', ')} 앞으로 다시 돌아감`
        : '지나친 물건을 다시 확인함'
      : null,
    afterActivity,
    afterDetail: afterActivity ? '그리기를 마친 뒤에도 한동안 머묾' : null,
    afterMetric: afterActivity && m.postDrawingMs !== null ? `마지막 선 이후 ${seconds(m.postDrawingMs)}` : null,
    attentionGap: gap
      ? { topLabel: quoted('MEMORY', top), topMs: m.dwellByObject[top] ?? 0, keptMs: null }
      : null,
    blanks,
  };
}

function sentenceTrace(
  input: CrossSceneInput,
  cross: Map<CrossSceneTraceId, CrossSceneFinding>,
  record: RecordLayerDerived,
): ZoneTrace | null {
  const sentence = input.sentence;
  if (!sentence) return null;
  const s = sentence.summary;
  const dropped = s.addedButDroppedFragments;
  const firstAnswerMoved = dropped.length > 0 || traceDetected(cross, 'REVISION', 'SENTENCE');
  const cameBack = traceDetected(cross, 'RETURN', 'SENTENCE') || traceDetected(cross, 'RECHECK', 'SENTENCE');
  const afterActivity = traceDetected(cross, 'POST_DECISION', 'SENTENCE');

  const top = s.longestViewedFragment;
  const gap =
    s.hasViewData && traceDetected(cross, 'ATTENTION_CHOICE_GAP', 'SENTENCE') && top && !s.finalFragments.includes(top);

  const blanks: string[] = [];
  if (record.sentenceClues.responseSkipped && !record.sentenceClues.noQuestionAvailable) {
    blanks.push('마지막 질문에 답하지 않고 비워 둠');
  }

  return {
    zone: 'SENTENCE',
    firstAnswerMoved,
    firstAnswerDetail: firstAnswerMoved
      ? dropped.length > 0
        ? `${eul(quoted('SENTENCE', dropped[0]))} 골랐다가 뺌`
        : `문장의 순서나 구성을 ${Math.max(s.rewriteCount, s.reorderCount)}번 고침`
      : null,
    preMs: finiteOrNull(s.msToFirstAdd),
    postMs: finiteOrNull(s.msFromLastEditToCommit),
    cameBack,
    cameBackDetail: cameBack
      ? s.returnedFragments.length > 0
        ? `${eul(quoted('SENTENCE', s.returnedFragments[0]))} 뺐다가 다시 넣음`
        : '지나친 문장으로 다시 돌아감'
      : null,
    afterActivity,
    afterDetail: afterActivity ? '문장을 완성한 뒤에도 고치거나 머묾' : null,
    afterMetric: null,
    attentionGap: gap
      ? {
          topLabel: quoted('SENTENCE', top),
          topMs: s.dwellMsByFragment[top] ?? 0,
          keptMs: null,
        }
      : null,
    blanks,
  };
}

/* ── Stage 3 · Cross-scene Pattern ──────────────────────────────────────── */

/**
 * Floors for this layer only. Every Zone floor stays where its own
 * `*Thresholds.ts` put it; these only decide when two already-measured times
 * in the same Zone are far enough apart to call one of them the heavier.
 */
export const PERSONAL_FINDING_THRESHOLDS = {
  /** A wait before the first answer counts as "long" from here. Reading a
   *  new question always takes a moment, so this sits well above that… */
  longPreMs: 6000,
  /** …and only when it is this many times the wait after the last answer,
   *  in a strict majority of the Zones that measured both — otherwise
   *  "longer before than after" would describe nearly every visitor. */
  preOverPostRatio: 3,
  /** The existing gap patterns fire on any difference. A Zone counts toward
   *  "most attended was not kept" only past this floor and margin, so a
   *  near-tie is never read as a gap. */
  attentionGapMinMs: 1500,
  attentionGapMargin: 1.25,
  /** A single-Zone attention gap is used only when the attended target held
   *  at least this long, and at least `singleGapRatio` × the kept one. */
  singleGapMinMs: 3000,
  singleGapRatio: 2,
  /** "Fast here, slow there": slowest Zone's wait ≥ this × the fastest's. */
  spreadRatio: 2.5,
  maxFindings: 3,
} as const;

function timeMetrics(trace: ZoneTrace): string[] {
  const metrics: string[] = [];
  if (trace.preMs !== null) metrics.push(`선택 전 ${seconds(trace.preMs)}`);
  if (trace.postMs !== null) metrics.push(`선택 후 ${seconds(trace.postMs)}`);
  return metrics;
}

function evidenceFor(trace: ZoneTrace, description: string, extra: string[] = [], withTime = true): FindingEvidence {
  return {
    zone: trace.zone,
    scene: ZONE_SCENE_NAME[trace.zone],
    description,
    metrics: [...extra, ...(withTime ? timeMetrics(trace) : [])],
  };
}

function settledWordsCandidates(
  traces: ZoneTrace[],
  input: CrossSceneInput,
  record: RecordLayerDerived,
): PersonalFindingDraft[] {
  const sentence = input.sentence?.summary;
  const sentenceTrace = traces.find((trace) => trace.zone === 'SENTENCE');
  if (!sentence || !sentenceTrace) return [];
  const finalIds = sentence.finalFragments.length > 0 ? sentence.finalFragments : record.sentenceClues.selectedSentenceIds;
  const candidates: PersonalFindingDraft[] = [];

  const settledId = finalIds.find((id) => id in SETTLED_FRAGMENTS);
  if (settledId) {
    const dwell = sentence.dwellMsByFragment[settledId] ?? 0;
    const others = Object.entries(sentence.dwellMsByFragment).filter(([id]) => id !== settledId);
    const nextLongest = others.reduce((max, [, ms]) => Math.max(max, ms), 0);
    const lingeredLongest =
      sentence.hasViewData &&
      sentence.longestViewedFragment === settledId &&
      dwell >= SENTENCE_THRESHOLDS.viewSelectionGapMinDwellMs;
    const reAdded = sentence.returnedFragments.includes(settledId);

    if (lingeredLongest || reAdded) {
      const metrics: string[] = [];
      if (dwell > 0) metrics.push(`이 문장 앞 ${seconds(dwell)}`);
      if (lingeredLongest && nextLongest > 0) metrics.push(`다른 문장 중 가장 긴 머묾 ${seconds(nextLongest)}`);
      if (reAdded) metrics.push('뺐다가 다시 넣음');
      const support = traces.filter((trace) => trace.zone !== 'SENTENCE' && (trace.firstAnswerMoved || trace.cameBack));
      candidates.push({
        id: 'settled-words-lingered',
        patternType: 'contradiction',
        tension: '말 ↔ 행동',
        pattern: '단호하게 끝나는 문장을 남겼지만, 그 문장 앞에서 가장 오래 머물렀거나 다시 고쳐 넣었다.',
        evidence: [
          evidenceFor(sentenceTrace, `${eul(quoted('SENTENCE', settledId))} 남김`, metrics),
          ...support.slice(0, 1).map((trace) =>
            evidenceFor(trace, trace.firstAnswerDetail ?? trace.cameBackDetail ?? '', [], false),
          ),
        ],
        strength: 320 + Math.min(19, Math.round(dwell / 1000)) + (reAdded ? 6 : 0) + support.length * 4,
        zones: ['SENTENCE', ...support.slice(0, 1).map((trace) => trace.zone)],
        context: {
          fragment: targetLabel('SENTENCE', settledId) ?? '',
          fragmentAct: SETTLED_FRAGMENTS[settledId],
          how: lingeredLongest ? 'lingered' : 'readded',
        },
      });
    } else {
      const moved = traces.filter((trace) => trace.zone !== 'SENTENCE' && (trace.firstAnswerMoved || trace.cameBack));
      if (moved.length >= 2) {
        candidates.push({
          id: 'settled-words-revised',
          patternType: 'contradiction',
          tension: '말 ↔ 행동',
          pattern: '남긴 문장은 망설임 없이 끝나지만, 다른 두 공간 이상에서 첫 답을 바꾸거나 다시 돌아갔다.',
          evidence: [
            evidenceFor(sentenceTrace, `${eul(quoted('SENTENCE', settledId))} 남김`),
            ...moved.map((trace) => evidenceFor(trace, trace.firstAnswerDetail ?? trace.cameBackDetail ?? '')),
          ],
          strength: 290 + moved.length * 10,
          zones: ['SENTENCE', ...moved.map((trace) => trace.zone)],
          context: {
            fragment: targetLabel('SENTENCE', settledId) ?? '',
            fragmentAct: SETTLED_FRAGMENTS[settledId],
            zones: joinZoneNames(moved.map((trace) => trace.zone)),
          },
        });
      }
    }
  }

  const unsettledId = finalIds.find((id) => id in UNSETTLED_FRAGMENTS);
  if (unsettledId) {
    const others = traces.filter((trace) => trace.zone !== 'SENTENCE');
    const steady = others.filter((trace) => !trace.firstAnswerMoved && !trace.cameBack);
    if (others.length >= 3 && steady.length === others.length && !sentenceTrace.firstAnswerMoved) {
      candidates.push({
        id: 'unsettled-words-steady',
        patternType: 'contradiction',
        tension: '말 ↔ 행동',
        pattern: '망설이는 장면의 문장을 남겼지만, 다른 모든 공간에서 첫 답이 바뀌지 않았고 다시 돌아가지도 않았다.',
        evidence: [
          evidenceFor(sentenceTrace, `${eul(quoted('SENTENCE', unsettledId))} 남김`),
          ...steady.map((trace) => evidenceFor(trace, '처음 고른 답을 마지막까지 유지')),
        ],
        strength: 260 + steady.length * 5,
        zones: ['SENTENCE', ...steady.map((trace) => trace.zone)],
        context: {
          fragment: targetLabel('SENTENCE', unsettledId) ?? '',
          fragmentAct: UNSETTLED_FRAGMENTS[unsettledId],
          zones: joinZoneNames(steady.map((trace) => trace.zone)),
        },
      });
    }
  }

  return candidates;
}

function repeatCandidates(traces: ZoneTrace[]): PersonalFindingDraft[] {
  const candidates: PersonalFindingDraft[] = [];

  const moved = traces.filter((trace) => trace.firstAnswerMoved);
  if (moved.length >= 2) {
    candidates.push({
      id: 'first-answer-moved',
      patternType: 'repeat',
      tension: '첫 판단 ↔ 최종 판단',
      pattern: '서로 다른 공간에서 처음 고른 답이 마지막까지 유지되지 않았다.',
      evidence: moved.map((trace) => evidenceFor(trace, trace.firstAnswerDetail ?? '첫 선택을 바꿈')),
      strength: 200 + moved.length * 25,
      zones: moved.map((trace) => trace.zone),
      context: { zones: joinZoneNames(moved.map((trace) => trace.zone)) },
    });
  }

  const back = traces.filter((trace) => trace.cameBack);
  if (back.length >= 2) {
    candidates.push({
      id: 'came-back',
      patternType: 'repeat',
      tension: '지나침 ↔ 돌아옴',
      pattern: '서로 다른 공간에서 한 번 지나친 것으로 다시 돌아갔다.',
      evidence: back.map((trace) => evidenceFor(trace, trace.cameBackDetail ?? '지나친 것으로 다시 돌아감')),
      strength: 190 + back.length * 25,
      zones: back.map((trace) => trace.zone),
      context: { zones: joinZoneNames(back.map((trace) => trace.zone)) },
    });
  }

  return candidates;
}

function sequenceCandidates(traces: ZoneTrace[]): PersonalFindingDraft[] {
  const t = PERSONAL_FINDING_THRESHOLDS;
  const timed = traces.filter((trace) => trace.preMs !== null && trace.postMs !== null);
  const before = timed.filter(
    (trace) => trace.preMs! >= t.longPreMs && trace.preMs! >= trace.postMs! * t.preOverPostRatio && !trace.afterActivity,
  );
  const after = traces.filter((trace) => trace.afterActivity);

  const candidates: PersonalFindingDraft[] = [];
  if (before.length >= 2 && before.length * 2 > timed.length && before.length >= after.length) {
    candidates.push({
      id: 'before-heavy',
      patternType: 'sequence',
      tension: '선택 전 ↔ 선택 후',
      pattern: '여러 공간에서 고르기 전의 시간이 고른 뒤의 시간보다 훨씬 길었고, 고른 뒤 다시 손대지 않았다.',
      evidence: before.map((trace) => evidenceFor(trace, '고르기 전에 오래 머물고, 고른 뒤에는 곧 넘어감')),
      strength: 195 + before.length * 22,
      zones: before.map((trace) => trace.zone),
      context: { zones: joinZoneNames(before.map((trace) => trace.zone)) },
    });
  } else if (after.length >= 2) {
    candidates.push({
      id: 'after-heavy',
      patternType: 'sequence',
      tension: '결정 ↔ 확인',
      pattern: '여러 공간에서 답을 정한 뒤에도, 그 답을 유지한 채 다시 확인하거나 머무르는 시간이 이어졌다.',
      evidence: after.map((trace) =>
        trace.afterMetric
          ? evidenceFor(trace, trace.afterDetail ?? '고른 뒤에도 머묾', [trace.afterMetric], false)
          : evidenceFor(trace, trace.afterDetail ?? '고른 뒤에도 머묾'),
      ),
      strength: 195 + after.length * 22,
      zones: after.map((trace) => trace.zone),
      context: { zones: joinZoneNames(after.map((trace) => trace.zone)) },
    });
  }
  return candidates;
}

function absenceCandidates(traces: ZoneTrace[]): PersonalFindingDraft[] {
  const t = PERSONAL_FINDING_THRESHOLDS;
  const candidates: PersonalFindingDraft[] = [];

  const gaps = traces.filter((trace) => {
    const gap = trace.attentionGap;
    if (!gap || gap.topMs < t.attentionGapMinMs) return false;
    return gap.keptMs === null || gap.topMs >= gap.keptMs * t.attentionGapMargin;
  });
  const clearSingle = gaps.filter((trace) => {
    const gap = trace.attentionGap!;
    return gap.topMs >= t.singleGapMinMs && (gap.keptMs === null || gap.topMs >= gap.keptMs * t.singleGapRatio);
  });
  if (gaps.length >= 2 || clearSingle.length === 1) {
    const used = gaps.length >= 2 ? gaps : clearSingle;
    candidates.push({
      id: 'attention-not-kept',
      patternType: 'absence',
      tension: '관심 ↔ 선택',
      pattern: '가장 오래 머문 대상이 최종 선택에 들어가지 않았다.',
      evidence: used.map((trace) => {
        const gap = trace.attentionGap!;
        const metrics = [`${gap.topLabel} ${seconds(gap.topMs)}`];
        if (gap.keptMs !== null) metrics.push(`고른 것 ${seconds(gap.keptMs)}`);
        return evidenceFor(trace, `가장 오래 머문 ${eun(gap.topLabel)} 고르지 않음`, metrics, false);
      }),
      strength: gaps.length >= 2 ? 150 + gaps.length * 25 : 95,
      zones: used.map((trace) => trace.zone),
      context: {
        zones: joinZoneNames(used.map((trace) => trace.zone)),
        single: used.length === 1 ? 'yes' : '',
        topLabel: used.length === 1 ? eun(used[0].attentionGap!.topLabel) : '',
        zone: used.length === 1 ? ZONE_SHORT_NAME[used[0].zone] : '',
      },
    });
  }

  const blank = traces.filter((trace) => trace.blanks.length > 0);
  const blankCount = blank.reduce((sum, trace) => sum + trace.blanks.length, 0);
  if (blankCount >= 2) {
    candidates.push({
      id: 'left-blank',
      patternType: 'absence',
      tension: '채움 ↔ 남겨둠',
      pattern: '채울 수 있었던 선택적 자리를 두 곳 이상 비워 둔 채 지나갔다.',
      evidence: blank.flatMap((trace) => trace.blanks.map((line) => evidenceFor(trace, line, [], false))),
      strength: 140 + blankCount * 20,
      zones: blank.map((trace) => trace.zone),
      context: {
        memoryBlank: blank.find((trace) => trace.zone === 'MEMORY')?.blanks[0] ?? '',
        sentenceBlank: blank.find((trace) => trace.zone === 'SENTENCE')?.blanks[0] ?? '',
      },
    });
  }

  const kept = traces.filter((trace) => !trace.firstAnswerMoved && !trace.cameBack && !trace.afterActivity);
  if (traces.length >= 3 && kept.length === traces.length) {
    candidates.push({
      id: 'kept-first',
      patternType: 'absence',
      tension: '첫 판단 ↔ 다시 보기',
      pattern: '모든 공간에서 첫 답을 바꾸지 않았고, 지나친 것으로 다시 돌아가지 않았다.',
      evidence: kept.map((trace) => evidenceFor(trace, '처음 고른 답을 마지막까지 유지, 다시 돌아가지 않음')),
      strength: 120 + kept.length * 5,
      zones: kept.map((trace) => trace.zone),
      context: { zones: joinZoneNames(kept.map((trace) => trace.zone)) },
    });
  }

  return candidates;
}

/** "하나의 방식으로 수렴하지 않음" — only when the record itself shows it:
 *  at least two timed Zones, nothing repeated, and the pace differs. */
function noConvergence(traces: ZoneTrace[]): PersonalFindingDraft | null {
  const timed = traces.filter((trace) => trace.preMs !== null);
  if (timed.length < 2) return null;
  const sorted = timed.slice().sort((a, b) => a.preMs! - b.preMs!);
  const fastest = sorted[0];
  const slowest = sorted[sorted.length - 1];
  const spread = fastest.preMs! > 0 ? slowest.preMs! / fastest.preMs! : slowest.preMs! > 0 ? Infinity : 1;
  return {
    id: 'no-convergence',
    patternType: 'sequence',
    tension: '반복 ↔ 변화',
    pattern: '어느 한 공간의 움직임도 다른 공간에서 그대로 반복되지 않았다.',
    evidence: timed.map((trace) =>
      evidenceFor(
        trace,
        trace === slowest && spread >= PERSONAL_FINDING_THRESHOLDS.spreadRatio
          ? '가장 오래 머문 뒤 고른 곳'
          : trace === fastest && spread >= PERSONAL_FINDING_THRESHOLDS.spreadRatio
            ? '가장 빨리 고른 곳'
            : '처음 답하기까지',
      ),
    ),
    strength: 10,
    zones: timed.map((trace) => trace.zone),
    context: { spread: spread >= PERSONAL_FINDING_THRESHOLDS.spreadRatio ? 'yes' : '' },
  };
}

/* ── Stage 4 · Personal Finding selection ───────────────────────────────── */

/**
 * Strongest first, at most three, one per tension — two Findings about the
 * same relationship would be one observation said twice. Contradictions are
 * based highest, then multi-Zone repeats and sequences, then absences; see
 * each candidate's `strength`.
 */
function selectFindings(candidates: PersonalFindingDraft[]): PersonalFindingDraft[] {
  const chosen: PersonalFindingDraft[] = [];
  const tensions = new Set<string>();
  for (const candidate of candidates.slice().sort((a, b) => b.strength - a.strength)) {
    if (chosen.length >= PERSONAL_FINDING_THRESHOLDS.maxFindings) break;
    if (tensions.has(candidate.tension)) continue;
    // "kept the first answer everywhere" cannot sit beside a Finding built on
    // changing or revisiting one.
    if (candidate.id === 'kept-first' && chosen.some((item) => item.id === 'first-answer-moved' || item.id === 'came-back' || item.id === 'unsettled-words-steady')) continue;
    // 'settled-words-revised' already carries the changed / revisited Zones
    // as its evidence; repeating them as their own Finding says it twice.
    if ((candidate.id === 'first-answer-moved' || candidate.id === 'came-back') && chosen.some((item) => item.id === 'settled-words-revised')) continue;
    tensions.add(candidate.tension);
    chosen.push(candidate);
  }
  return chosen;
}

export interface PersonalFindingAnalysis {
  /** Every Zone this visit has a record for, read for relationships. */
  traces: ZoneTrace[];
  /** Every candidate that met its floor, strongest first. */
  candidates: PersonalFindingDraft[];
  /** What the report shows — up to three, or one 'no-convergence'. */
  findings: PersonalFindingDraft[];
  /** True when any shown Finding rests on two or more Zones. */
  crossScene: boolean;
}

export function analyzePersonalFindings(
  behavior: Partial<Record<SceneId, SceneBehaviorRecord>>,
  record: RecordLayerDerived,
): PersonalFindingAnalysis {
  const input = buildCrossSceneInput(behavior);
  const cross = new Map(analyzeCrossScene(input).map((finding) => [finding.id, finding]));

  const traces = [
    lightTrace(input, cross),
    soundTrace(input, cross),
    memoryTrace(input, cross, behavior[ZONE_TO_SCENE.MEMORY]),
    sentenceTrace(input, cross, record),
  ].filter((trace): trace is ZoneTrace => trace !== null);

  const candidates = [
    ...settledWordsCandidates(traces, input, record),
    ...repeatCandidates(traces),
    ...sequenceCandidates(traces),
    ...absenceCandidates(traces),
  ].sort((a, b) => b.strength - a.strength);

  let findings = selectFindings(candidates);
  if (findings.length === 0) {
    const fallback = noConvergence(traces);
    findings = fallback ? [fallback] : [];
  }

  const positionMeaning = soundPositionMeaning(record.soundClues.memoryPosition);
  if (positionMeaning) findings = findings.map(finding => finding.zones.includes('SOUND') ? {
    ...finding,
    evidence: [...finding.evidence, { zone: 'SOUND' as const, scene: '소리의 흔적', description: positionMeaning, metrics: ['관객이 상상해 놓은 위치이며, 실제 소리의 거리나 청력을 측정한 값은 아닙니다.'] }],
  } : finding);
  return {
    traces,
    candidates,
    findings,
    crossScene: findings.some((finding) => finding.id !== 'no-convergence' && new Set(finding.zones).size >= 2),
  };
}
