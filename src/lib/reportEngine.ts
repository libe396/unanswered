/**
 * The Report Engine.
 *
 * Raw Event → Scene Summary → Scene Pattern → Cross-Scene Finding →
 * **Report Rule Matching → Report Evidence → Report Content Model** →
 * (AI Narrative, not built here) → Final Report UI (not touched here).
 *
 * This file is the fifth stage. It does not analyse behaviour — every
 * verdict it reads (`detected`, `strength`, `applicable`) was already
 * decided by src/lib/crossSceneAnalysis.ts, which decided it from what
 * src/lib/*Patterns.ts already decided, which decided it from what
 * src/lib/*Tracking.ts already computed from the raw event log. Nothing
 * below opens a raw event, reads a Scene Summary number that has not
 * already passed through a Scene Pattern or Cross-Scene Finding, or invents
 * a threshold. What it does is entirely mechanical: pick which Findings
 * belong in a report, and reshape their already-computed evidence into a
 * stable, narrative-ready structure — never a sentence, per docs/PROJECT.md
 * §7 and docs/DECISIONS.md ADR-004: the report describes patterns, it does
 * not diagnose.
 *
 * Pure function, deliberately. `buildReportModel` takes a `CrossSceneReport`
 * — never a `CrossSceneInput`, never the zustand store, never a raw event —
 * so that reaching back into a Scene Summary from this layer is a type
 * error, not a discipline problem. See src/hooks/useCrossSceneDebug.ts for
 * where the actual data comes from in a running app.
 */
import type {
  CrossSceneFinding,
  CrossSceneReport,
  CrossSceneTraceId,
  CrossSceneZoneId,
  FindingStrength,
  ZoneEvidence,
} from './crossSceneAnalysis';
import type { BehaviorFact } from './behaviorPatterns';
import { REPORT_THRESHOLDS } from './reportThresholds';

/* ── Types ───────────────────────────────────────────────────────────────── */

/**
 * A stable, narrative-ready name for what a Finding structurally is.
 *
 * Deliberately not a sentence and not a claim about the visitor — "the
 * choice changed after it had already been settled" is what
 * `revised_choice` names, not "indecisive". A later Narrative stage reads
 * this key to select *how* to describe the Finding; it never has to see a
 * `CrossSceneTraceId` or re-derive what one structurally means.
 */
export type ReportObservationKey =
  | 'repeated_return'
  | 'revised_choice'
  | 'attention_choice_gap'
  | 'lingered_after_decision'
  | 'repeated_recheck'
  | 'paused_during_process';

const OBSERVATION_KEYS: Record<CrossSceneTraceId, ReportObservationKey> = {
  RETURN: 'repeated_return',
  REVISION: 'revised_choice',
  ATTENTION_CHOICE_GAP: 'attention_choice_gap',
  POST_DECISION: 'lingered_after_decision',
  RECHECK: 'repeated_recheck',
  PAUSE: 'paused_during_process',
};

/**
 * One Zone's contribution to a Finding, reshaped for a report.
 *
 * `sources` and `facts` are exactly `ZoneEvidence.sources` /
 * `ZoneEvidence.facts` — the original pattern ids and raw numbers,
 * untouched. `evidenceKeys` is the only thing added: a stable slug per
 * source, e.g. `SOURCE_KEYS['OBJECT_RETURN'] === 'object_return'`, so a
 * consumer can name "the fact behind this" without restating the pattern id
 * or re-deriving anything from `facts`.
 */
export interface ReportEvidence {
  sceneId: CrossSceneZoneId;
  traceId: CrossSceneTraceId;
  sources: string[];
  /** `${sceneId.toLowerCase()}.${slug}`, one per entry in `sources`, same order. */
  evidenceKeys: string[];
  facts: Record<string, BehaviorFact>;
}

export interface ReportFinding {
  traceId: CrossSceneTraceId;
  /** Never 'none' — a Finding with nothing detected anywhere never becomes a ReportFinding. */
  strength: Exclude<FindingStrength, 'none'>;
  detectedZoneCount: number;
  applicableZoneCount: number;
  observationKey: ReportObservationKey;
  /** Every Zone that was applicable and detected, reshaped. Same Zones as
   *  the source CrossSceneFinding's zoneEvidence, filtered — never more. */
  evidence: ReportEvidence[];
  /** Up to three, exactly which Zones crossSceneAnalysis.ts already chose
   *  to lead with — see choosePrimaryEvidence there. Not re-chosen here. */
  primaryEvidence: ReportEvidence[];
}

export interface ReportOverview {
  /** Whether at least one Finding reached `primary` — the only bar
   *  Cross-Scene itself treats as strong (independently observed in three
   *  or more Zones). Not a new judgement: a direct readout of
   *  `primaryCount > 0`. */
  hasStrongBehavioralPattern: boolean;
  primaryCount: number;
  secondaryCount: number;
  /** How many observation-strength Findings existed in the Cross-Scene
   *  result — which may be more than `findings` actually carries, since at
   *  most REPORT_THRESHOLDS.maxObservations are included. */
  observationCount: number;
}

export interface ReportContentModel {
  /** Schema version of this model, not a build or a timestamp. Bump it if
   *  ReportContentModel's shape changes in a way a consumer needs to branch on. */
  version: '1';
  /** Set only if the caller passes one in — see `BuildReportModelOptions`.
   *  Absent by default so the same input always produces a byte-identical
   *  model; this file never calls Date.now() itself. */
  generatedAt?: number;
  overview: ReportOverview;
  /** primary Findings, then secondary, then up to
   *  REPORT_THRESHOLDS.maxObservations observations — the exact order
   *  CrossSceneReport.rankedFindings already put them in. Never re-sorted
   *  here. */
  findings: ReportFinding[];
}

export interface BuildReportModelOptions {
  /** Injected, never generated internally — see the note on `generatedAt` above. */
  generatedAt?: number;
}

/* ── Evidence keys ───────────────────────────────────────────────────────── */

/**
 * Every `sources` string src/lib/crossSceneAnalysis.ts can currently
 * produce, mapped to a stable slug. A closed table rather than a slugify
 * function: some sources are already-stable BehaviorPatternIds
 * (`'OBJECT_RETURN'`), others are free-text descriptions written for a
 * human reading the evidence directly (`'image.viewPath (consecutive
 * repeat)'`) — turning the second kind into a key by pattern-matching
 * punctuation would be fragile in exactly the way a hand-kept table is not.
 * Read src/lib/crossSceneAnalysis.ts's six evaluators to find every string
 * that can appear here; nothing is derived from data at runtime.
 */
const SOURCE_KEYS: Record<string, string> = {
  // RETURN
  RETURN_LOOP: 'return_loop',
  FINAL_RETURN: 'final_return',
  SOUND_RETURN: 'sound_return',
  POSITION_RETURN: 'position_return',
  OBJECT_RETURN: 'object_return',
  ERASE_RETURN: 'erase_return',
  FRAGMENT_RETURN: 'fragment_return',
  // REVISION
  'image.firstSelectedId≠finalSelectedIds[0]': 'net_selection_change',
  POSITION_REVISION: 'position_revision',
  OBJECT_REVISION: 'object_revision',
  REPEATED_REVISION: 'repeated_revision',
  REPEATED_REWRITE: 'repeated_rewrite',
  ORDER_REVISION: 'order_revision',
  // ATTENTION_CHOICE_GAP
  ATTENTION_SELECTION_GAP: 'attention_selection_gap',
  LISTEN_SELECTION_GAP: 'listen_selection_gap',
  OBJECT_ATTENTION_GAP: 'object_attention_gap',
  VIEW_SELECTION_GAP: 'view_selection_gap',
  // POST_DECISION
  'POST_DECISION_HESITATION(emotion)': 'post_decision_hesitation_emotion',
  POST_DECISION_HESITATION: 'post_decision_hesitation',
  POST_PLACEMENT_REPLAY: 'post_placement_replay',
  POST_DRAWING_HESITATION: 'post_drawing_hesitation',
  POST_SENTENCE_HESITATION: 'post_sentence_hesitation',
  POST_COMPLETION_REVISION: 'post_completion_revision',
  // RECHECK
  'image.viewPath (consecutive repeat)': 'consecutive_view_repeat',
  'object.viewPath (consecutive repeat)': 'consecutive_view_repeat',
  'sentence.viewPath (consecutive repeat)': 'consecutive_view_repeat',
  REPLAY_LOOP: 'replay_loop',
  // PAUSE
  POSITION_HESITATION: 'position_hesitation',
  DELAYED_START: 'delayed_start',
  LONG_PAUSE: 'long_pause',
};

/**
 * A source this table has not seen before still gets a usable key rather
 * than crashing the report — lowercased and underscored — but this should
 * never actually run: it means crossSceneAnalysis.ts grew a new source
 * string that SOURCE_KEYS was not updated for. Kept as a safety net, not a
 * design a caller should rely on.
 */
function fallbackSlug(source: string): string {
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function evidenceKeyFor(sceneId: CrossSceneZoneId, source: string): string {
  const slug = SOURCE_KEYS[source] ?? fallbackSlug(source);
  return `${sceneId.toLowerCase()}.${slug}`;
}

/* ── Building ────────────────────────────────────────────────────────────── */

function toReportEvidence(traceId: CrossSceneTraceId, zone: ZoneEvidence): ReportEvidence {
  return {
    sceneId: zone.sceneId,
    traceId,
    sources: zone.sources,
    evidenceKeys: zone.sources.map((source) => evidenceKeyFor(zone.sceneId, source)),
    facts: zone.facts,
  };
}

function toReportFinding(finding: CrossSceneFinding): ReportFinding {
  const evidence = finding.zoneEvidence
    .filter((zone) => zone.applicable && zone.detected)
    .map((zone) => toReportEvidence(finding.id, zone));
  const primaryEvidence = finding.primaryEvidence.map((zone) => toReportEvidence(finding.id, zone));

  return {
    traceId: finding.id,
    // Safe: buildReportModel only calls this for strength !== 'none'.
    strength: finding.strength as Exclude<FindingStrength, 'none'>,
    detectedZoneCount: finding.detectedZoneCount,
    applicableZoneCount: finding.applicableZoneCount,
    observationKey: OBSERVATION_KEYS[finding.id],
    evidence,
    primaryEvidence,
  };
}

/**
 * Turns an already-computed Cross-Scene result into a Report Content Model.
 *
 * Inclusion follows Cross-Scene's own strength classification directly:
 * every `primary` and `secondary` Finding, and up to
 * `REPORT_THRESHOLDS.maxObservations` of the `observation`-strength ones —
 * in the order `crossSceneReport.rankedFindings` already put them in, never
 * re-sorted. `none`-strength Findings (a trace nothing was observed for)
 * are never included; see the note on DIRECT visits below.
 *
 * A visit with `primary: [] , secondary: [], observations: []` — every
 * trace at 'none', the shape Cross-Scene Scenario A produces — returns
 * `findings: []` and `overview.hasStrongBehavioralPattern: false` rather
 * than a Finding being manufactured to fill the report. An empty report is
 * a correct report.
 *
 * Pure: reading the same `crossSceneReport` twice returns byte-identical
 * models (aside from `generatedAt`, which this function never sets itself —
 * see `BuildReportModelOptions`).
 */
export function buildReportModel(
  crossSceneReport: CrossSceneReport,
  options: BuildReportModelOptions = {},
): ReportContentModel {
  const primaryFindings = crossSceneReport.primary;
  const secondaryFindings = crossSceneReport.secondary;
  const observationFindings = crossSceneReport.observations.slice(0, REPORT_THRESHOLDS.maxObservations);

  const findings = [...primaryFindings, ...secondaryFindings, ...observationFindings].map(toReportFinding);

  const overview: ReportOverview = {
    hasStrongBehavioralPattern: primaryFindings.length > 0,
    primaryCount: primaryFindings.length,
    secondaryCount: secondaryFindings.length,
    observationCount: crossSceneReport.observations.length,
  };

  return {
    version: '1',
    ...(options.generatedAt !== undefined ? { generatedAt: options.generatedAt } : {}),
    overview,
    findings,
  };
}
