/**
 * Config for the Cross-Scene layer.
 *
 * Kept apart from every Zone's own thresholds for the same reason
 * src/lib/soundThresholds.ts, memoryThresholds.ts and sentenceThresholds.ts
 * are kept apart from the detectors that read them: a number here is a guess
 * about how to read *across* Zones, which is a different kind of guess from
 * how to read one, and moving it should never mean touching a Zone file.
 *
 * Nothing here changes what any individual Zone detects. RETURN_LOOP still
 * fires at three views, POSITION_REVISION still fires at the same distance —
 * this file only decides how many independently-observing Zones make a
 * Cross-Scene Finding worth calling primary, how to tell a repeated check
 * from a return, and in what order two Findings of the same strength are
 * read.
 */

export const CROSS_SCENE_THRESHOLDS = {
  /** detectedZoneCount at or above this makes a Finding PRIMARY. */
  primaryMinZones: 3,

  /** detectedZoneCount exactly this makes a Finding SECONDARY. */
  secondaryMinZones: 2,

  /**
   * How many *adjacent* repeats of the same target in a viewPath — nothing
   * else viewed in between — before RECHECK calls it a repeated check rather
   * than one look and a coincidence.
   *
   * This is a narrower question than RETURN_LOOP already answers. LIGHT and
   * SENTENCE both keep a viewPath, and both already spend the count of a
   * target's *total* views on RETURN evidence — three views of one target is
   * RETURN_LOOP's threshold, whether or not something else was looked at in
   * between. RECHECK asks about the narrower case where nothing else was
   * recorded in between at all, so it is read from *adjacent* repeats in the
   * path, not the total count, and needs its own threshold rather than
   * reusing RETURN_LOOP's.
   *
   * Two adjacent repeats — the same target appearing three times running,
   * A, A, A — is the same "twice past the once that means nothing" reading
   * used everywhere else in this codebase: RETURN_LOOP's three views,
   * REPLAY_LOOP's two replays, MEMORY's three revisions.
   */
  recheckMinConsecutiveRepeats: 2,

  /**
   * Read order when two Findings tie on strength, detected count, and
   * detected/applicable ratio. Higher goes first.
   *
   * RETURN and REVISION are the most literal of the six — a target or a
   * choice named as the same one before and after. ATTENTION_CHOICE_GAP and
   * POST_DECISION still name a moment, but reach it by reading two different
   * figures against each other rather than one thing returned to. RECHECK is
   * the narrowest by definition — nothing else recorded in between at all.
   * PAUSE sits last on purpose: a gap in the timeline is the
   * weakest-grounded of the six, since nothing in any Zone can tell a
   * visitor's silence apart from a conversation happening next to them.
   */
  tracePriority: {
    RETURN: 60,
    REVISION: 50,
    ATTENTION_CHOICE_GAP: 40,
    POST_DECISION: 30,
    RECHECK: 20,
    PAUSE: 10,
  },
} as const;

export type CrossSceneThresholds = typeof CROSS_SCENE_THRESHOLDS;
