/**
 * Every heuristic MEMORY leans on, in one place.
 *
 * Same arrangement as src/lib/soundThresholds.ts and for the same reasons: one
 * file to edit, and a figure in a report that can always be traced back to the
 * assumption underneath it. Nothing derived from these is stored, so moving a
 * number re-reads visits that have already happened.
 *
 * They matter more here than in the other Zones. LIGHT and SOUND ask a visitor
 * to choose from things already on the screen; MEMORY hands them an empty
 * rectangle, where there is no wrong move and therefore no natural scale for
 * what counts as a long time or a small area. Every number below is a guess at
 * that scale, and the ones about space are guesses about a canvas of this
 * shape in particular.
 *
 * Distances and areas are in normalized canvas units: 0–1 across each axis,
 * whatever the canvas is actually sized at on the day.
 */
export const MEMORY_THRESHOLDS = {
  /* ── Time ──────────────────────────────────────────────────────────────── */

  /**
   * The shortest gap between two marks that counts as having stopped.
   *
   * Lifting the pen to cross the canvas takes a moment, and counting every one
   * of those would make a pause count out of an ordinary drawing hand. Just
   * over a second is longer than the reach between two marks and shorter than
   * a look at what has been drawn so far.
   */
  pauseMinMs: 1200,

  /**
   * Sitting this long in front of an empty canvas before the first mark.
   *
   * Measured from the canvas appearing, never from the Zone opening — the
   * intro card is read at the visitor's own pace and that reading is not
   * hesitation in front of anything.
   */
  delayedStartMs: 8000,

  /** A gap this long mid-drawing is a stop worth naming, not a reach. */
  longPauseMs: 5000,

  /**
   * Revision actions before repetition is claimed.
   *
   * One undo is a correction and almost everybody makes one. Three is the
   * behaviour the pattern is named for, and is deliberately the same reading
   * as LIGHT's RETURN_LOOP and SOUND's REPLAY_LOOP: twice more than the once
   * that means nothing.
   */
  revisionMinCount: 3,

  /* ── Coming back to an erased place ────────────────────────────────────── */

  /**
   * How close the new mark's centre must be to the removed one's.
   *
   * Fifteen percent of the canvas. Wide enough that redrawing a shape slightly
   * off from where it was still counts, narrow enough that the next mark along
   * does not.
   */
  eraseReturnMaxDistance: 0.15,

  /**
   * …and how much the two marks' boxes must share.
   *
   * Distance between centres alone is not enough: a long diagonal line and a
   * small dot can share a centre and occupy nothing in common. Requiring both
   * a near centre and real overlap is what makes this "came back to that
   * place" rather than "drew somewhere in the region".
   *
   * Measured against the smaller of the two boxes, so a small mark redrawn
   * inside the area of a large removed one still counts.
   */
  eraseReturnMinOverlap: 0.15,

  /**
   * Both boxes are grown by this before overlap is measured.
   *
   * A straight line has a bounding box with no thickness and therefore no
   * area, which would make every overlap involving one exactly zero. The
   * padding also matches the fact that a stroke is drawn with a brush that has
   * width, so it covers a little more than its path.
   */
  eraseReturnBoxPadding: 0.02,

  /**
   * How long after a removal a new mark can still be a return to it.
   *
   * Half a minute. Beyond that the visitor is drawing, not correcting.
   */
  eraseReturnMaxTimeGapMs: 30_000,

  /* ── Space ─────────────────────────────────────────────────────────────── */

  /**
   * Coverage at or below this is drawing in one small part of the canvas.
   *
   * Coverage is measured by grid occupancy, not by the bounding box — see
   * canvasCoverageRatio. Eight percent of the cells is a mark that reaches
   * very little of what it was given.
   */
  spatialConcentrationCoverage: 0.08,

  /**
   * …and everything drawn must fit inside a box this big on its longest side.
   *
   * On its own, low coverage says almost nothing: a few thin lines flung to
   * opposite corners occupy hardly any cells while using the whole canvas.
   * That is dispersal, and the opposite of what this pattern is about.
   *
   * The longest side rather than the area, which is the distinction that
   * matters and one it is easy to get wrong. A single line straight across the
   * canvas has a bounding box of almost no *area* — it is thin — while reaching
   * from edge to edge, and an area test calls that concentrated. Asking that
   * neither side be long cannot be fooled that way.
   *
   * Three tenths: the marks all fall inside a window less than a third of the
   * canvas across, which is under a tenth of it by area.
   */
  spatialConcentrationMaxExtent: 0.3,

  /** Cells per side when measuring how much of the canvas was reached. */
  coverageGridSize: 24,

  /**
   * How wide the border band is when splitting edge from centre.
   *
   * A point within this of any side is at the edge. A fifth leaves the middle
   * three fifths of each axis as the centre — a little over a third of the
   * area, which is about what reads as "the middle" on a canvas this shape.
   */
  edgeBandRatio: 0.2,

  /* ── Ending ────────────────────────────────────────────────────────────── */

  /**
   * Floor for calling the wait before submitting long.
   *
   * Same value as LIGHT's and SOUND's: the pause before moving on is the same
   * act whichever Zone it happens in.
   */
  postDrawingFloorMs: 3000,

  /** …and the same relative test, against how long the drawing itself took. */
  postDrawingRatio: 0.35,

  /* ── What counts as a mark ─────────────────────────────────────────────── */

  /**
   * A mark shorter than this in total path length is a touch, not a drawing.
   *
   * The canvas itself already throws away a press with no movement. This
   * catches the one just past it — the flinch, the click that dragged a few
   * pixels — which does land on the canvas but should not be what a return is
   * measured against, or what "the last thing they drew" means.
   */
  trivialStrokeMaxLength: 0.01,

  /* ── The Room's objects (v2) ───────────────────────────────────────────── */

  /**
   * How much the final selected-object set must differ from the set as it
   * first stood the moment MEMORY_MIN_OBJECT_SELECTION was reached, before
   * OBJECT_REVISION calls it a meaningfully different configuration.
   *
   * One object swapped is already a real difference. Nothing about *how
   * many* changes were made is tested, only what the set became — because
   * the thing the spec is worried about, a single object clicked and
   * unclicked right back, already nets to zero in a before/after set
   * comparison and never reaches this threshold at all. That is a property
   * of comparing two sets rather than counting edits, and it is why this
   * reads 1 rather than something like MEMORY's own revisionMinCount: 3
   * above, which counts repeated undo/clear/erase actions instead of asking
   * what the canvas ended up looking like.
   */
  objectRevisionMinSetChange: 1,

  /**
   * Separate views of the same object, with something else viewed in
   * between, before OBJECT_RETURN's view-side evidence fires.
   *
   * Deliberately *not* RETURN_LOOP's reading (three views — twice past the
   * once that means nothing). The Room holds eight objects as large,
   * well-separated hit-areas, not a dense grid a pointer crosses on the way
   * to somewhere else, so a single A → B → A is not the same kind of
   * coincidence LIGHT's grid has to filter out — the visitor had to
   * deliberately re-navigate to A rather than merely pass back over it.
   * Two views (one genuine return) is read as meaningful on its own.
   * `MERGE_GAP_MS` in behaviorTracking.ts is still what stands between this
   * and hover noise: two views only exist at all once a re-entry has
   * survived that merge, so this number is filtering *returns*, not noise —
   * that filtering already happened before this ever sees the data.
   */
  objectReturnMinViews: 2,

  /*
    No separate "minimum dwell" threshold for OBJECT_ATTENTION_GAP.

    LIGHT's ATTENTION_SELECTION_GAP — which OBJECT_ATTENTION_GAP is read the
    same way as — has no floor beyond the base view filtering already
    enforced everywhere (MIN_VIEW_MS, MERGE_GAP_MS in behaviorTracking.ts):
    whatever view survives that floor counts as attention, however short.
    Inventing a second, MEMORY-only floor on top would make "sufficiently
    explored" mean something different in this Zone than it does in LIGHT's,
    for no reason drawn from this Zone's own data.
  */
} as const;

export type MemoryThresholds = typeof MEMORY_THRESHOLDS;
