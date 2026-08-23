/**
 * Every heuristic SOUND leans on, in one place.
 *
 * These are the numbers that decide whether a stretch of playback was a listen
 * or a slip of the hand, and they are guesses. Reasonable ones — each is
 * argued for below — but guesses, made before anybody has stood in front of
 * the Zone. Once visitors have, the arguments will be worth less than the
 * recordings, and the numbers will move.
 *
 * They are gathered here rather than left beside the code that reads them so
 * that moving them is a single edit in a single file, and so that a figure in
 * a report can always be traced back to the assumption it rests on. Nothing
 * derived from them is stored: the raw log keeps playheads and durations, so
 * changing a threshold re-reads visits that have already happened rather than
 * only the next one.
 *
 * The clips are all a little over five seconds, which is what makes the
 * absolute values below sit where they do.
 */
export const SOUND_THRESHOLDS = {
  /**
   * Playback shorter than this is not counted as having listened at all.
   *
   * Clicking down the list to see what is there produces a trail of
   * hundred-millisecond touches, and without a floor those fill the listen
   * path and turn every pass down the column into a series of returns. Four
   * tenths of a second is longer than a mis-click and shorter than any of
   * these sounds takes to become recognisable.
   */
  meaningfulListenMs: 400,

  /**
   * How much of a sound must already have been heard for starting it over to
   * count as listening *again*.
   *
   * Starting a clip, stopping it at once and starting it again is one attempt
   * at a first listen, not two listens. A fifth of the clip is enough to have
   * formed an impression worth going back to.
   */
  replayMinPriorListenMs: 1000,

  /**
   * …and how much the second listen must itself gather.
   *
   * Otherwise a double-click, or a play immediately corrected into a pause,
   * reads as a deliberate re-listen.
   */
  replayMinListenMs: 800,

  /**
   * Replays of one sound before REPLAY_LOOP fires.
   *
   * Two means the sound was heard three times over. Going back to something
   * once is comparison, and nearly everybody does it; twice is the sound being
   * returned to after having been left twice, which is the behaviour the
   * pattern is named for. Deliberately the same reading as LIGHT's
   * RETURN_LOOP, which asks for three views of an image.
   */
  replayLoopMinReplays: 2,

  /**
   * Below this, stopping a sound is a mis-click rather than a rejection.
   *
   * A visitor who stops something after two hundred milliseconds has most
   * likely hit the wrong row, or hit the same row twice.
   */
  earlyRejectionMinListenMs: 300,

  /**
   * Stopping at or before this share of a clip is stopping early.
   *
   * Around a third: far enough in to have heard what the sound is, early
   * enough that hearing it out was clearly not the intention. On these clips
   * it falls at roughly the first 1.8 seconds.
   */
  earlyRejectionMaxRatio: 0.35,

  /**
   * Floor for calling the pause before NEXT long.
   *
   * Absolute, because a fraction alone would flag a visitor who decided in
   * half a second and then took a perfectly ordinary two to click on. Same
   * value as LIGHT's, and for the same reason — the pause is the same act
   * whichever Zone it happens in.
   */
  postDecisionFloorMs: 3000,

  /**
   * …and relative, because "long" depends on the person.
   *
   * The pause has to be a real share of how long the decision itself took
   * before it means anything.
   */
  postDecisionRatio: 0.35,
} as const;

export type SoundThresholds = typeof SOUND_THRESHOLDS;
