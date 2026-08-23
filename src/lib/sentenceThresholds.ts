/**
 * Every heuristic SENTENCE leans on, in one place.
 *
 * Same arrangement as the sound, memory and position threshold files, and the
 * same promise: nothing derived from these is stored, so moving a number
 * re-reads visits that have already happened.
 *
 * The bounds on how many fragments a sentence may hold are deliberately *not*
 * here. Those are product rules — what the Zone will accept — and they live
 * with the content in src/data/content.ts. Everything below is a guess about
 * how to read a recording, which is a different kind of number and one that is
 * expected to move.
 */
import { MERGE_GAP_MS, MIN_VIEW_MS } from './behaviorTracking';

export const SENTENCE_THRESHOLDS = {
  /* ── Looking ───────────────────────────────────────────────────────────── */

  /**
   * Mirrored from the recorder, where they are enforced.
   *
   * SENTENCE reuses LIGHT's view filtering exactly — a floor under how long a
   * look must last, and a gap under which two looks at the same thing are one
   * look interrupted. Twenty fragments laid out in a field means the pointer
   * crosses things it was never reading, and without the floor the record
   * would describe the route across the archive rather than the reading of it.
   */
  viewMinMs: MIN_VIEW_MS,
  viewMergeGapMs: MERGE_GAP_MS,

  /**
   * How long a fragment must be dwelt on before leaving it out is notable.
   *
   * Two and a half seconds is long enough to have read a short Korean phrase
   * several times over. Below it, a look is just the pointer passing through
   * on the way to something else, and every unused fragment in the archive
   * would qualify — which would make the pattern say nothing at all.
   */
  viewSelectionGapMinDwellMs: 2500,

  /**
   * …or this many separate looks, which says the same thing another way.
   *
   * Either bound alone is enough. Coming back to a fragment three times and
   * still not using it is as legible as staring at it once, and a visitor
   * tends to do one or the other rather than both.
   */
  viewSelectionGapMinViews: 3,

  /* ── Rewriting ─────────────────────────────────────────────────────────── */

  /**
   * Changes to what is already in the sentence before it counts as repeated.
   *
   * Counting only removals and reorders, never plain additions: putting a
   * third fragment into a sentence that has two is building it, not rewriting
   * it, and a threshold that counted adds would fire on everybody who made a
   * sentence at all. Three is the same reading as LIGHT's RETURN_LOOP and
   * SOUND's REPLAY_LOOP — twice more than the once that means nothing.
   */
  repeatedRewriteMinEdits: 3,

  /**
   * Reorders before the order is treated as having been reconsidered.
   *
   * One is enough, because a reorder is already filtered: a drag that ends
   * where it began never reaches the log. Named anyway, so it can be raised
   * without hunting through the detector.
   */
  orderRevisionMinCount: 1,

  /* ── Adding late ───────────────────────────────────────────────────────── */

  /**
   * A fragment added before this much time has passed is not a late addition.
   *
   * Fifteen seconds of building. Below it the whole sentence was made in one
   * go and there is no "late" to be.
   */
  lateAdditionMinElapsedMs: 15_000,

  /** …and it has to land within this long of the record being submitted. */
  lateAdditionMaxTimeToCommitMs: 8000,

  /**
   * …and this far through the building, measured against how long the
   * building actually took.
   *
   * The absolute bounds alone would call an ordinary third fragment "late" in
   * anyone who worked slowly. This asks where the addition sits in that
   * person's own timeline: in the last quarter of it, or not late at all.
   */
  lateAdditionMinProgressRatio: 0.75,

  /* ── Ending ────────────────────────────────────────────────────────────── */

  /**
   * Floor for calling the wait before submitting long.
   *
   * The same value as LIGHT's, SOUND's and MEMORY's. The pause before moving
   * on is the same act whichever Zone it happens in, and the four Zones should
   * not disagree about when it became one.
   */
  postSentenceFloorMs: 3000,

  /** …and the same relative test, against how long the sentence took to build. */
  postSentenceRatio: 0.35,
} as const;

export type SentenceThresholds = typeof SENTENCE_THRESHOLDS;
