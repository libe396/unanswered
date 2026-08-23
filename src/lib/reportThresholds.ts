/**
 * Config for the Report Engine.
 *
 * Same arrangement as crossSceneThresholds.ts, and the same reason: a number
 * here is a guess about how much of an already-finished analysis to surface,
 * not a guess about behaviour. It never changes what any Cross-Scene Finding
 * *is* — only how many of the weakest ones (`observation`) make it into the
 * Report Content Model.
 */

export const REPORT_THRESHOLDS = {
  /**
   * Observation-strength Findings included in the report, at most.
   *
   * `primary` and `secondary` Findings are always included — they are
   * exactly the Findings independently observed in two or more Zones, which
   * is already a deliberately high bar (see crossSceneThresholds.ts). An
   * `observation` was seen in exactly one Zone, the weakest-grounded tier
   * Cross-Scene produces, and a report that listed every single one would
   * read as a behaviour log rather than a curator's note — the thing
   * docs/PROJECT.md's AI Report section says this is not. Two is enough to
   * add texture without turning the report into a list.
   *
   * Selection order is never reinterpreted here: this takes the first two
   * of `CrossSceneReport.observations`, which is already in the same
   * deterministic order rankFindings produced.
   */
  maxObservations: 2,
} as const;

export type ReportThresholds = typeof REPORT_THRESHOLDS;
