/**
 * MEMORY's patterns.
 *
 * The same restraint as LIGHT's and SOUND's, and it needs stating hardest here.
 * A drawing looks like it means something in a way a click never does, and
 * every figure below is one short step from a claim nobody has earned: a small
 * mark in one corner is *not* timidity, three undos are *not* perfectionism, a
 * long stare at an empty canvas is *not* a blocked memory. What is recorded is
 * that the marks covered eight percent of the canvas, that three were taken
 * back, that fifty seconds passed. The reading stays with the person reading.
 *
 * Every detector returns its evidence whether or not it fired, so a `false` can
 * be argued with.
 *
 * Thresholds live in src/lib/memoryThresholds.ts, with the reasoning for each.
 *
 * ── v2: Free Drawing is optional now, and the six drawing patterns below
 * are unchanged arithmetic over the same figures they always read — a Zone
 * left without ever opening the canvas simply produces a summary where
 * those figures are null or zero, on their own terms, without any of these
 * functions needing to know the canvas was skippable at all.
 *
 * What changed is how a `false` from one of them should be read. `detected`
 * has always meant "this did not happen", and for six patterns whose whole
 * premise is a canvas with marks on it, "did not happen" now has two
 * different causes worth telling apart: drew and never triggered it, or
 * never drew at all. `BehaviorPattern` has no `applicable` field — that
 * would be a change to every Zone's pattern type for one Zone's new
 * ambiguity — so each detector below reports `drawingEntered` in its facts
 * instead, the same way SENTENCE's VIEW_SELECTION_GAP already reports
 * `hasViewData` to disambiguate a `false` that might just mean "no pointer
 * to read". A consumer that cares about the difference reads the flag; one
 * that does not can ignore it and read `detected` exactly as before.
 */
import type { BehaviorPattern } from './behaviorPatterns';
import { MEMORY_THRESHOLDS } from './memoryThresholds';
import type { MemoryBehaviorSummary } from './memoryTracking';

const round = (n: number | null, places = 0): number | null => {
  if (n === null || !Number.isFinite(n)) return null;
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
};

/**
 * A long wait in front of the canvas before the first mark.
 *
 * Measured from the canvas appearing, not from the Zone opening: the intro card
 * before it is read at whatever pace the visitor reads, and that is not time
 * spent in front of anything blank. Contact that left no mark is reported
 * alongside, because reaching out and pulling back is not the same as not
 * having reached.
 */
function delayedStart(summary: MemoryBehaviorSummary): BehaviorPattern {
  const wait = summary.msToFirstStroke;
  return {
    id: 'DELAYED_START',
    detected: wait !== null && wait >= MEMORY_THRESHOLDS.delayedStartMs,
    facts: {
      msToFirstStroke: round(wait),
      msToFirstCanvasTouch: round(summary.msToFirstCanvasTouch),
      // True when the wait ended in a press that left nothing on the canvas.
      touchedBeforeDrawing:
        summary.msToFirstCanvasTouch !== null &&
        summary.msToFirstStroke !== null &&
        summary.msToFirstCanvasTouch < summary.msToFirstStroke,
      strokeCount: summary.strokeCount,
      thresholdMs: MEMORY_THRESHOLDS.delayedStartMs,
      // False means there was no record of when the canvas became drawable, and
      // the figure above could not be measured from anywhere trustworthy.
      measuredFromCanvasOpen: summary.canvasOpenedAt !== null,
      // v2: false on a visit that never opened the optional Drawing step at
      // all. `detected` is already false in that case — there is no first
      // mark to have waited for — but this says *why*, the same way
      // SENTENCE's hasViewData disambiguates a `false` VIEW_SELECTION_GAP.
      // See the module doc's note on `applicable`.
      drawingEntered: summary.drawingEntered,
    },
  };
}

/**
 * The drawing stopped, for a while, in the middle.
 *
 * Gaps are only counted between one mark ending and the next beginning, and
 * only past the floor that separates stopping from reaching across the canvas.
 * Where each gap fell is reported, since a stop after the first mark and a stop
 * after the twelfth are different facts about the same drawing.
 */
function longPause(summary: MemoryBehaviorSummary): BehaviorPattern {
  const long = summary.pauses.filter((p) => p.durationMs >= MEMORY_THRESHOLDS.longPauseMs);
  return {
    id: 'LONG_PAUSE',
    detected: long.length > 0,
    facts: {
      longPauseCount: long.length,
      longestPauseMs: round(summary.longestPauseMs),
      pauses: long.map((p) => ({
        afterStrokeIndex: p.afterStrokeIndex,
        durationMs: Math.round(p.durationMs),
        // Undos and brush changes inside the gap. A gap spent taking things
        // back is not a gap spent still.
        actionsDuring: p.actionsDuring,
      })),
      countedPauseCount: summary.pauses.length,
      totalPauseMs: round(summary.totalPauseMs),
      strokeCount: summary.strokeCount,
      pauseMinMs: MEMORY_THRESHOLDS.pauseMinMs,
      longPauseMs: MEMORY_THRESHOLDS.longPauseMs,
      drawingEntered: summary.drawingEntered,
    },
  };
}

/**
 * A mark landed where one had been rubbed out.
 *
 * Two spatial tests, both required. The centres have to be close, and the areas
 * the two marks occupy have to genuinely share ground — because either alone
 * misfires: a long line and a small dot can share a centre while overlapping in
 * nothing, and two boxes can clip corners while the marks sit well apart.
 *
 * Clears are excluded. Wiping the canvas removes every place at once, so every
 * later mark would land where something had been, and the pattern would fire on
 * the fact of starting over. That is counted separately and reported here.
 */
function eraseReturn(summary: MemoryBehaviorSummary): BehaviorPattern {
  const returns = summary.eraseReturns;
  const closest = returns.reduce<(typeof returns)[number] | null>(
    (best, r) => (best === null || r.distance < best.distance ? r : best),
    null,
  );
  return {
    id: 'ERASE_RETURN',
    detected: returns.length > 0,
    facts: {
      eraseReturnCount: returns.length,
      redrawnAreaCount: summary.redrawnAreaCount,
      returns: returns.map((r) => ({
        removedStrokeId: r.removedStrokeId,
        removedBy: r.removedBy,
        newStrokeId: r.newStrokeId,
        distance: round(r.distance, 3),
        overlap: round(r.overlap, 3),
        timeGapMs: Math.round(r.timeGapMs),
      })),
      closestDistance: closest ? round(closest.distance, 3) : null,
      closestOverlap: closest ? round(closest.overlap, 3) : null,
      closestTimeGapMs: closest ? Math.round(closest.timeGapMs) : null,
      removedStrokeCount: summary.removedStrokeCount,
      // Starting the canvas over. Recorded, never read as a return.
      strokesAfterClearCount: summary.strokesAfterClearCount,
      clearCount: summary.clearCount,
      maxDistance: MEMORY_THRESHOLDS.eraseReturnMaxDistance,
      minOverlap: MEMORY_THRESHOLDS.eraseReturnMinOverlap,
      maxTimeGapMs: MEMORY_THRESHOLDS.eraseReturnMaxTimeGapMs,
      boxPadding: MEMORY_THRESHOLDS.eraseReturnBoxPadding,
      drawingEntered: summary.drawingEntered,
    },
  };
}

/**
 * Taking things back, repeatedly.
 *
 * Every undo, clear and erase counts the same amount, since all three are the
 * visitor deciding that what is on the canvas is not what they meant. One is a
 * correction and nearly everybody makes one; the threshold is set where it is
 * so that the ordinary single change of mind says nothing.
 */
function repeatedRevision(summary: MemoryBehaviorSummary): BehaviorPattern {
  return {
    id: 'REPEATED_REVISION',
    detected: summary.revisionCount >= MEMORY_THRESHOLDS.revisionMinCount,
    facts: {
      revisionCount: summary.revisionCount,
      undoCount: summary.undoCount,
      clearCount: summary.clearCount,
      eraseCount: summary.eraseCount,
      removedStrokeCount: summary.removedStrokeCount,
      strokeCount: summary.strokeCount,
      survivingStrokeCount: summary.survivingStrokeCount,
      minCount: MEMORY_THRESHOLDS.revisionMinCount,
      drawingEntered: summary.drawingEntered,
    },
  };
}

/**
 * Everything drawn sits within a small part of the canvas.
 *
 * Two measurements, both required, because each is misleading alone. Coverage
 * counts the cells any mark passes through, so a few thin lines flung to
 * opposite corners score very low while using the whole canvas — dispersal, not
 * concentration. The box catches that. And the box alone would call a single
 * dense scribble filling half the canvas "concentrated", which coverage
 * catches.
 *
 * The box is measured by its longest side, not its area. A line drawn straight
 * across the canvas has a bounding box with almost no area, because it is thin,
 * and an area test would call that most spread-out of drawings concentrated.
 *
 * This is a statement about where marks are, and about nothing else.
 */
function spatialConcentration(summary: MemoryBehaviorSummary): BehaviorPattern {
  const extent = summary.boundingBox
    ? Math.max(summary.boundingBox.width, summary.boundingBox.height)
    : null;
  const detected =
    summary.survivingStrokeCount > 0 &&
    extent !== null &&
    summary.canvasCoverageRatio <= MEMORY_THRESHOLDS.spatialConcentrationCoverage &&
    extent <= MEMORY_THRESHOLDS.spatialConcentrationMaxExtent;
  return {
    id: 'SPATIAL_CONCENTRATION',
    detected,
    facts: {
      canvasCoverageRatio: round(summary.canvasCoverageRatio, 4),
      boundingBoxExtent: round(extent, 4),
      boundingBoxWidth: summary.boundingBox ? round(summary.boundingBox.width, 4) : null,
      boundingBoxHeight: summary.boundingBox ? round(summary.boundingBox.height, 4) : null,
      boundingBoxAreaRatio: round(summary.boundingBoxAreaRatio, 4),
      centerOfDrawing: summary.centerOfDrawing
        ? { x: round(summary.centerOfDrawing.x, 3) ?? 0, y: round(summary.centerOfDrawing.y, 3) ?? 0 }
        : null,
      quadrantDistribution: {
        topLeft: round(summary.quadrantDistribution.topLeft, 3) ?? 0,
        topRight: round(summary.quadrantDistribution.topRight, 3) ?? 0,
        bottomLeft: round(summary.quadrantDistribution.bottomLeft, 3) ?? 0,
        bottomRight: round(summary.quadrantDistribution.bottomRight, 3) ?? 0,
      },
      edgeShare: round(summary.edgeVsCenterDistribution.edge, 3),
      centerShare: round(summary.edgeVsCenterDistribution.center, 3),
      survivingStrokeCount: summary.survivingStrokeCount,
      totalStrokeLength: round(summary.totalStrokeLength, 3),
      maxCoverage: MEMORY_THRESHOLDS.spatialConcentrationCoverage,
      maxExtent: MEMORY_THRESHOLDS.spatialConcentrationMaxExtent,
      gridSize: MEMORY_THRESHOLDS.coverageGridSize,
      drawingEntered: summary.drawingEntered,
    },
  };
}

/**
 * A wait between finishing and saying so.
 *
 * The same floor and ratio as the other Zones, over a window this Zone has to
 * measure its own way. Submitting is possible from the moment the canvas
 * appears, so nothing here is ever waiting for a button — but the last thing
 * done is not always the last mark: undoing everything and then sitting still
 * is a shorter silence than the marks alone would suggest. Marks too short to
 * be deliberate do not count as the last thing done either.
 */
function postDrawingHesitation(summary: MemoryBehaviorSummary): BehaviorPattern {
  const pauseMs = summary.postDrawingMs;
  const spanMs = summary.drawingSpanMs;
  const detected =
    pauseMs !== null &&
    pauseMs >= MEMORY_THRESHOLDS.postDrawingFloorMs &&
    (spanMs === null || pauseMs >= spanMs * MEMORY_THRESHOLDS.postDrawingRatio);
  return {
    id: 'POST_DRAWING_HESITATION',
    detected,
    facts: {
      postDrawingMs: round(pauseMs),
      drawingSpanMs: round(spanMs),
      msFromLastStrokeToCommit: round(summary.msFromLastStrokeToCommit),
      // True when the last thing done was not a mark — an undo, or a clear.
      endedOnRevision:
        summary.lastActionAt !== null &&
        summary.strokeCount > 0 &&
        summary.msFromLastStrokeToCommit !== null &&
        (summary.postDrawingMs ?? 0) < summary.msFromLastStrokeToCommit,
      submittedEmpty: summary.submittedEmpty,
      floorMs: MEMORY_THRESHOLDS.postDrawingFloorMs,
      ratio: MEMORY_THRESHOLDS.postDrawingRatio,
      gatedByAdvanceReady: summary.advanceReadyAt !== null,
      // v2: false on a visit that skipped Drawing outright — `postDrawingMs`
      // is null there (nothing to gate a wait on), not zero, so `detected`
      // is already false; this says the null means "never entered" rather
      // than "entered and finished at once". See the module doc.
      drawingEntered: summary.drawingEntered,
    },
  };
}

/* ── The Room's objects (v2) ─────────────────────────────────────────────── */

/**
 * A previously seen or chosen object was returned to.
 *
 * Two independent readings, combined. Coming back to *look* at an object
 * after leaving it is read exactly as LIGHT reads RETURN_LOOP on the image
 * question — a target seen three separate times, the third one a genuine
 * return rather than the ordinary look-elsewhere-look-again of comparing two
 * things. Coming back to *choose* an object after letting it go is this
 * Zone's own reading, since a multi-select group has no single
 * first-and-final choice for the generic FINAL_RETURN to compare against —
 * see `ObjectReturn` in memoryTracking.ts, built the same way SENTENCE's
 * `FragmentReturn` is.
 *
 * Ordinary hover noise never reaches either count: MIN_VIEW_MS and
 * MERGE_GAP_MS have already thrown out anything too short, or too quickly
 * re-entered to be a second look, before this ever sees the data.
 */
function objectReturn(summary: MemoryBehaviorSummary): BehaviorPattern {
  const viewReturned = Object.entries(summary.viewCountByObject)
    .filter(([, count]) => count >= MEMORY_THRESHOLDS.objectReturnMinViews)
    .map(([id]) => id);
  const selectionReturned = summary.objectReturns;

  return {
    id: 'OBJECT_RETURN',
    detected: viewReturned.length > 0 || selectionReturned.length > 0,
    facts: {
      viewReturnedObjects: viewReturned,
      viewCountByObject: summary.viewCountByObject,
      minViewsForReturn: MEMORY_THRESHOLDS.objectReturnMinViews,
      selectionReturns: selectionReturned.map((r) => ({
        objectId: r.objectId,
        deselectedAt: r.deselectedAt,
        reselectedAt: r.reselectedAt,
        timeGapMs: Math.round(r.timeGapMs),
      })),
      returnedObjects: summary.returnedObjects,
      selectionReturnCount: summary.objectReturnCount,
      hasObjectViewData: summary.hasObjectViewData,
    },
  };
}

/**
 * An object explored well enough to have the longest dwell was never selected.
 *
 * The multi-select reading of LIGHT's ATTENTION_SELECTION_GAP: this tests set
 * membership rather than equality against one final choice, because the
 * Room's answer is a set, and "not equal to the first element of the set"
 * would fail for reasons that have nothing to do with attention — the same
 * reason SENTENCE keeps VIEW_SELECTION_GAP as its own function rather than
 * sharing the generic one (see the note in src/lib/behaviorPatterns.ts).
 *
 * No dwell floor beyond the base view filtering already enforced everywhere
 * — see the note in memoryThresholds.ts on why a second one was not added.
 */
function objectAttentionGap(summary: MemoryBehaviorSummary): BehaviorPattern {
  const longest = summary.mostViewedObject;
  const detected = longest !== null && !summary.finalSelectedObjects.includes(longest);
  return {
    id: 'OBJECT_ATTENTION_GAP',
    detected,
    facts: {
      mostViewedObject: longest,
      mostViewedMs: longest ? Math.round(summary.dwellByObject[longest] ?? 0) : null,
      finalSelectedObjects: summary.finalSelectedObjects,
      hasObjectViewData: summary.hasObjectViewData,
    },
  };
}

/**
 * The selected set settled somewhere meaningfully different from where it
 * first stood.
 *
 * Anchored on the set exactly as it first stood the moment
 * MEMORY_MIN_OBJECT_SELECTION was reached — the same "first valid state"
 * SENTENCE anchors POST_COMPLETION_REVISION on — rather than on the very
 * first object ever selected, since a set has no single "first choice" the
 * way a single-select question does.
 *
 * A before/after set comparison rather than a count of changes: an object
 * selected and deselected right back nets to zero here on its own, which is
 * what keeps one accidental click from firing this without needing a second,
 * separate debounce rule — see the reasoning on objectRevisionMinSetChange
 * in memoryThresholds.ts.
 */
function objectRevision(summary: MemoryBehaviorSummary): BehaviorPattern {
  const before = summary.firstValidObjectSet;
  const after = summary.finalSelectedObjects;
  const reachedFirstValidState = before !== null;
  const added = before ? after.filter((id) => !before.includes(id)) : [];
  const removed = before ? before.filter((id) => !after.includes(id)) : [];
  const changedCount = added.length + removed.length;
  return {
    id: 'OBJECT_REVISION',
    detected: reachedFirstValidState && changedCount >= MEMORY_THRESHOLDS.objectRevisionMinSetChange,
    facts: {
      firstValidObjectSet: before,
      finalSelectedObjects: after,
      addedSinceFirstValid: added,
      removedSinceFirstValid: removed,
      changedCount,
      objectSelectionChangeCount: summary.objectSelectionChangeCount,
      minSetChange: MEMORY_THRESHOLDS.objectRevisionMinSetChange,
      // False means the Room was left before the minimum selection was ever
      // reached this visit — there is no "first configuration" to compare
      // the final one against, distinct from having reached it and having
      // it match the final one exactly.
      reachedFirstValidState,
    },
  };
}

export function detectMemoryPatterns(summary: MemoryBehaviorSummary): BehaviorPattern[] {
  return [
    delayedStart(summary),
    longPause(summary),
    eraseReturn(summary),
    repeatedRevision(summary),
    spatialConcentration(summary),
    postDrawingHesitation(summary),
    objectReturn(summary),
    objectAttentionGap(summary),
    objectRevision(summary),
  ];
}
