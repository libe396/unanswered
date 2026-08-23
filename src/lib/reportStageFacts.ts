/**
 * The Final Report's production Finding model.
 *
 * Replaces this file's earlier version, which read `summarizeScene` /
 * `summarizeSentence` / `summarizeSound` directly and ranked what it found
 * against a threshold (`MIN_NOTABLE_DWELL_MS = 1500`) invented for this file
 * alone. Per the Data / Finding Audit, that threshold and that ranking were
 * never validated anywhere else in the codebase, and Memory was never
 * considered at all.
 *
 * This version computes nothing new. Every Finding below is read off
 * `src/lib/crossSceneAnalysis.ts`'s `analyzeCrossScene` — which is itself
 * built entirely from the existing named Patterns (`detectPatterns`,
 * `detectSoundPatterns`, `detectPositionPatterns`, `detectMemoryPatterns`,
 * `detectSentencePatterns`) and their `*Thresholds.ts` floors — via
 * `src/lib/crossSceneAdapter.ts`'s production-safe `buildCrossSceneInput`.
 * Two Findings fall outside what Cross-Scene's six traces cover
 * (`replay`, which needs Sound's own `REPLAY_LOOP` specifically, and
 * `reconstruction`/`non_intervention`, which are Memory-only and partly
 * presentational) and are read directly off the same Tracking/Pattern layer
 * for the same reason.
 *
 * What this file will not do, on the same terms crossSceneAnalysis.ts holds
 * to: no Finding here compares *what* was chosen across Scenes — no shared
 * tag, axis or mapping table exists to support that (see the Audit's
 * Metadata Gap section) — only *whether the same shape of behaviour* showed
 * up, and where.
 */
import { buildCrossSceneInput } from './crossSceneAdapter';
import { analyzeCrossScene } from './crossSceneAnalysis';
import type { CrossSceneFinding, CrossSceneZoneId, ZoneEvidence } from './crossSceneAnalysis';
import type { BehaviorFact } from './behaviorPatterns';
import { summarizeSound } from './soundTracking';
import { detectSoundPatterns } from './soundPatterns';
import { summarizeMemory } from './memoryTracking';
import type { RecordLayerDerived } from '../types';
import type { SceneBehaviorRecord, SceneId } from '../types';

export type ReportFindingKind =
  | 'return'
  | 'hesitation'
  | 'revision'
  | 'replay'
  | 'dwell'
  | 'reconstruction'
  | 'non_intervention'
  | 'none';

export interface ReportEvidence {
  sceneId: SceneId;
  /** Which named Pattern this reads — always a real BehaviorPatternId (or a
   *  short joined list of them), never invented for this layer. */
  source: string;
  /** The measurements the verdict rests on, copied verbatim from that
   *  Pattern's own `facts` — never recomputed here. */
  facts: Record<string, BehaviorFact>;
}

export interface ReportFinding {
  kind: ReportFindingKind;
  sceneIds: SceneId[];
  evidence: ReportEvidence[];
  /** How many Scenes independently showed this shape of behaviour. 1 for a
   *  within-zone-only Finding. */
  zoneCount: number;
  confidence: 'high' | 'medium';
}

const ZONE_TO_SCENE_ID: Record<CrossSceneZoneId, SceneId> = {
  LIGHT: 'lightArchive',
  SOUND: 'soundClues',
  MEMORY: 'memorySketch',
  SENTENCE: 'sentenceClues',
};

function zoneEvidenceToReportEvidence(evidence: ZoneEvidence): ReportEvidence | null {
  if (!evidence.applicable || !evidence.detected) return null;
  return {
    sceneId: ZONE_TO_SCENE_ID[evidence.sceneId],
    source: evidence.sources.length > 0 ? evidence.sources.join(' + ') : evidence.sceneId,
    facts: evidence.facts,
  };
}

/** RETURN, falling back to RECHECK — see crossSceneAnalysis.ts's module doc:
 *  RECHECK is "a narrower question RETURN already answers" (nothing viewed
 *  in between), so it is read here only when RETURN itself found nothing to
 *  show. Never both at once, so 'return' never double-counts one zone. */
function buildReturnFinding(
  returnTrace: CrossSceneFinding | undefined,
  recheckTrace: CrossSceneFinding | undefined,
): ReportFinding | null {
  return buildTraceFinding('return', returnTrace) ?? buildTraceFinding('return', recheckTrace);
}

function buildTraceFinding(
  kind: ReportFindingKind,
  trace: CrossSceneFinding | undefined,
): ReportFinding | null {
  if (!trace || trace.detectedZoneCount === 0) return null;
  const evidence = trace.primaryEvidence
    .map(zoneEvidenceToReportEvidence)
    .filter((e): e is ReportEvidence => e !== null);
  if (evidence.length === 0) return null;
  return {
    kind,
    sceneIds: evidence.map((e) => e.sceneId),
    zoneCount: trace.detectedZoneCount,
    confidence: trace.detectedZoneCount >= 2 ? 'high' : 'medium',
    evidence,
  };
}

/** POST_DECISION (a wait after answering) plus PAUSE (a stop mid-decision —
 *  Sound's POSITION_HESITATION, Memory's DELAYED_START/LONG_PAUSE) folded
 *  into one 'hesitation' Finding. The two traces never claim the same zone —
 *  PAUSE is explicitly `inapplicable` for LIGHT/SENTENCE in
 *  crossSceneAnalysis.ts — so this can simply concatenate their evidence. */
function buildHesitationFinding(
  postDecisionTrace: CrossSceneFinding | undefined,
  pauseTrace: CrossSceneFinding | undefined,
): ReportFinding | null {
  const combined = [...(postDecisionTrace?.zoneEvidence ?? []), ...(pauseTrace?.zoneEvidence ?? [])];
  const seen = new Set<SceneId>();
  const evidence: ReportEvidence[] = [];
  for (const zoneEvidence of combined) {
    const mapped = zoneEvidenceToReportEvidence(zoneEvidence);
    if (!mapped || seen.has(mapped.sceneId)) continue;
    seen.add(mapped.sceneId);
    evidence.push(mapped);
  }
  if (evidence.length === 0) return null;
  return {
    kind: 'hesitation',
    sceneIds: evidence.map((e) => e.sceneId),
    zoneCount: evidence.length,
    confidence: evidence.length >= 2 ? 'high' : 'medium',
    evidence,
  };
}

/**
 * ATTENTION_CHOICE_GAP ("looked longest at X, chose Y") — 'dwell'.
 *
 * Reliability guard: Sentence's and Memory's own evidence already carries
 * `hasViewData`/`hasObjectViewData` (false on a touchscreen, where there is
 * no pointer to rest and so no dwell to read). A zone that says so is
 * skipped here rather than trusted — this is the guard the Audit's Finding
 * #5 (DWELL) asked for, applied at the point the number would otherwise be
 * read as if it meant something. Light's and Sound's readings are not
 * hover-based (Sound's is audio playback time) and carry no such flag.
 */
function buildDwellFinding(trace: CrossSceneFinding | undefined): ReportFinding | null {
  if (!trace) return null;
  const evidence: ReportEvidence[] = [];
  for (const zoneEvidence of trace.zoneEvidence) {
    if (zoneEvidence.facts.hasViewData === false) continue;
    if (zoneEvidence.facts.hasObjectViewData === false) continue;
    const mapped = zoneEvidenceToReportEvidence(zoneEvidence);
    if (mapped) evidence.push(mapped);
  }
  if (evidence.length === 0) return null;
  return {
    kind: 'dwell',
    sceneIds: evidence.map((e) => e.sceneId),
    zoneCount: evidence.length,
    confidence: 'medium',
    evidence,
  };
}

/** Sound's REPLAY_LOOP specifically — restarted a clip from the top, more
 *  than once, having already heard it. Not one of Cross-Scene's six traces
 *  (RETURN/SOUND_RETURN already covers "came back to a sound"; this is the
 *  stricter, audio-specific reading), so read directly off the Pattern layer. */
function buildReplayFinding(soundRecord: SceneBehaviorRecord | undefined): ReportFinding | null {
  if (!soundRecord) return null;
  const replayLoop = detectSoundPatterns(summarizeSound(soundRecord)).find(
    (pattern) => pattern.id === 'REPLAY_LOOP',
  );
  if (!replayLoop?.detected) return null;
  return {
    kind: 'replay',
    sceneIds: ['soundClues'],
    zoneCount: 1,
    confidence: 'high',
    evidence: [{ sceneId: 'soundClues', source: 'REPLAY_LOOP', facts: replayLoop.facts }],
  };
}

/** The visitor added a stroke to the Reconstructed Room — a raw-response
 *  presentation fact (did MEMORY's answer include a surviving mark), not a
 *  behavioural inference. */
function buildReconstructionFinding(record: RecordLayerDerived): ReportFinding | null {
  if (!record.memorySketch.drawingUsed || record.memorySketch.strokes.length === 0) return null;
  return {
    kind: 'reconstruction',
    sceneIds: ['memorySketch'],
    zoneCount: 1,
    confidence: 'high',
    evidence: [
      {
        sceneId: 'memorySketch',
        source: 'drawingUsed',
        facts: {
          strokeCount: record.memorySketch.strokes.length,
          emptyAreaRatio: record.memorySketch.emptyAreaRatio,
        },
      },
    ],
  };
}

/**
 * The visitor saw Drawing's blank canvas and left it blank.
 *
 * Guarded by `drawingEntered`, on the same reasoning crossSceneAnalysis.ts
 * already applies to POST_DECISION/PAUSE for MEMORY: a visit that never
 * opened the canvas has nothing to read a non-intervention from — that is
 * "no record", not "decided not to draw". Only `drawingEntered &&
 * !drawingUsed` counts.
 */
function buildNonInterventionFinding(memoryRecord: SceneBehaviorRecord | undefined): ReportFinding | null {
  if (!memoryRecord) return null;
  const summary = summarizeMemory(memoryRecord);
  if (!summary.drawingEntered || summary.drawingUsed) return null;
  return {
    kind: 'non_intervention',
    sceneIds: ['memorySketch'],
    zoneCount: 1,
    confidence: 'high',
    evidence: [
      {
        sceneId: 'memorySketch',
        source: 'drawingEntered && !drawingUsed',
        facts: { canvasOpenedAt: summary.canvasOpenedAt, strokeCount: summary.strokeCount },
      },
    ],
  };
}

/**
 * Every Finding this session's data can support, in a fixed order
 * (`return`, `hesitation`, `revision`, `dwell`, `replay`, `reconstruction`,
 * `non_intervention`) — never ranked or filtered here. Stage components pick
 * what they need from this list; this function only says what is real.
 */
export function buildReportFindings(
  behavior: Partial<Record<SceneId, SceneBehaviorRecord>>,
  record: RecordLayerDerived,
): ReportFinding[] {
  const crossSceneInput = buildCrossSceneInput(behavior);
  const crossSceneFindings = analyzeCrossScene(crossSceneInput);
  const byTraceId = new Map(crossSceneFindings.map((finding) => [finding.id, finding]));

  const findings: ReportFinding[] = [];

  const returnFinding = buildReturnFinding(byTraceId.get('RETURN'), byTraceId.get('RECHECK'));
  if (returnFinding) findings.push(returnFinding);

  const hesitationFinding = buildHesitationFinding(byTraceId.get('POST_DECISION'), byTraceId.get('PAUSE'));
  if (hesitationFinding) findings.push(hesitationFinding);

  const revisionFinding = buildTraceFinding('revision', byTraceId.get('REVISION'));
  if (revisionFinding) findings.push(revisionFinding);

  const dwellFinding = buildDwellFinding(byTraceId.get('ATTENTION_CHOICE_GAP'));
  if (dwellFinding) findings.push(dwellFinding);

  const replayFinding = buildReplayFinding(behavior.soundClues);
  if (replayFinding) findings.push(replayFinding);

  const reconstructionFinding = buildReconstructionFinding(record);
  if (reconstructionFinding) findings.push(reconstructionFinding);

  const nonInterventionFinding = buildNonInterventionFinding(behavior.memorySketch);
  if (nonInterventionFinding) findings.push(nonInterventionFinding);

  return findings;
}

function findKind(findings: readonly ReportFinding[], kind: ReportFindingKind): ReportFinding | null {
  return findings.find((f) => f.kind === kind) ?? null;
}

/** REPORT 02's "다시 돌아본 것" — the return Finding alone, or null when the
 *  session has nothing to show (the Stage is skipped, never shown empty). */
export function pickReturnFinding(findings: readonly ReportFinding[]): ReportFinding | null {
  return findKind(findings, 'return');
}

/**
 * REPORT 03's "쉽게 지나가지 못한 순간" highlight.
 *
 * Fixed priority, per the brief: a wait after deciding or a stop mid-gesture
 * first, then an actual reversed choice, then a trustworthy dwell reading,
 * and only then the weaker return/replay signal as a last resort. Never
 * re-ranked by strength of numbers — the order itself is the judgement call,
 * made once, here.
 */
export function pickStage03Highlight(findings: readonly ReportFinding[]): ReportFinding | null {
  return (
    findKind(findings, 'hesitation') ??
    findKind(findings, 'revision') ??
    findKind(findings, 'dwell') ??
    findKind(findings, 'replay') ??
    findKind(findings, 'return')
  );
}

/**
 * REPORT 05's Primary Finding — the brief's exact priority order. A
 * `zoneCount >= 2` return/revision (independently observed in more than one
 * Scene) outranks everything else; short of that, hesitation, then a clear
 * replay/return, then a within-zone revision, then reconstruction, then
 * non-intervention. `'none'` — never a fabricated pick — when nothing above
 * has evidence at all.
 */
export function pickPrimaryFinding(findings: readonly ReportFinding[]): ReportFinding {
  const crossSceneReturn = findings.find((f) => f.kind === 'return' && f.zoneCount >= 2);
  if (crossSceneReturn) return crossSceneReturn;
  const crossSceneRevision = findings.find((f) => f.kind === 'revision' && f.zoneCount >= 2);
  if (crossSceneRevision) return crossSceneRevision;

  const hesitation = findKind(findings, 'hesitation');
  if (hesitation) return hesitation;

  const replay = findKind(findings, 'replay');
  if (replay) return replay;
  const anyReturn = findKind(findings, 'return');
  if (anyReturn) return anyReturn;

  const revision = findKind(findings, 'revision');
  if (revision) return revision;

  const reconstruction = findKind(findings, 'reconstruction');
  if (reconstruction) return reconstruction;

  const nonIntervention = findKind(findings, 'non_intervention');
  if (nonIntervention) return nonIntervention;

  return { kind: 'none', sceneIds: [], evidence: [], zoneCount: 0, confidence: 'medium' };
}
