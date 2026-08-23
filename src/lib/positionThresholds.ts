/**
 * Every heuristic the memory field leans on, in one place.
 *
 * Same arrangement as the sound and memory threshold files, and the same
 * promise: nothing derived from these is stored, so moving a number re-reads
 * visits that have already happened.
 *
 * All distances are in field units — 0–1 across each axis — so they mean the
 * same thing on any screen. Note that the diagonal of the field is about 1.41,
 * so a distance of 0.12 is roughly a twelfth of the way across it.
 *
 * The field has no numbers on it and the visitor never sees one. These are
 * about reading the record afterwards, not about scoring anybody.
 */
import {
  POSITION_SAMPLE_MAX_INTERVAL_MS,
  POSITION_SAMPLE_MIN_DISTANCE,
} from './behaviorTracking';

export const POSITION_THRESHOLDS = {
  /**
   * How far the point must move for the move to have been meant.
   *
   * Below this, a drag is the hand settling rather than the answer changing —
   * and a field with no gridlines invites small adjustments that are really
   * one act of placing. Twelve hundredths is a visible distance on the field
   * and well beyond a steadying hand.
   */
  meaningfulMoveDistance: 0.12,

  /**
   * How close to where it started the point must end for that to be a return.
   *
   * Deliberately smaller than the distance above: going away and coming back
   * is only a return if it came back to somewhere a visitor would recognise as
   * the same place. Between the two values is a band that is neither — moved,
   * but not moved far, and not quite back.
   */
  positionReturnRadius: 0.06,

  /**
   * The turn, in degrees, that counts as changing direction.
   *
   * Ninety would only catch reversals; thirty would count the curve of an
   * ordinary hand-drawn arc as a series of decisions. Sixty is a turn that had
   * to be intended.
   */
  directionChangeAngle: 60,

  /**
   * …measured between movements at least this long.
   *
   * Direction is meaningless over a tiny step: two samples a hundredth apart
   * can point anywhere, and counting the angle between them would turn a
   * straight drag into dozens of direction changes. The path is walked in
   * segments of at least this length before any angle is taken.
   */
  directionChangeMinSegment: 0.04,

  /** A gap between gestures this long is the visitor stopping, not repositioning. */
  positionPauseMinMs: 1500,

  /* ── What makes a pattern ──────────────────────────────────────────────── */

  /**
   * Direction changes before the movement is called unsettled.
   *
   * Three turns past sixty degrees is a point that went one way, came back,
   * and went somewhere else again. One or two is ordinary aiming.
   */
  hesitationMinDirectionChanges: 3,

  /** …or this many real stops, which says the same thing a different way. */
  hesitationMinPauses: 2,

  /* ── Sampling ──────────────────────────────────────────────────────────── */

  /**
   * Mirrored from the recorder, where they are enforced.
   *
   * They belong to the tracker — how densely a gesture is written down is a
   * decision about recording, not about interpretation — but they are as
   * tunable as everything above, so they are readable here rather than being
   * the one knob that lives somewhere else.
   */
  dragSamplingDistance: POSITION_SAMPLE_MIN_DISTANCE,
  dragSamplingMaxIntervalMs: POSITION_SAMPLE_MAX_INTERVAL_MS,

  /** How far one arrow-key press moves the point. */
  keyboardStep: 0.04,
} as const;

export type PositionThresholds = typeof POSITION_THRESHOLDS;
