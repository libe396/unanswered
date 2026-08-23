/**
 * SENTENCE's patterns.
 *
 * The same restraint as the other three Zones, and this is where it is hardest
 * to hold. The fragments are written in the first person and the assembled
 * result reads like a confession, so every detector below sits one short step
 * from a claim nobody has earned: taking '그 사람을' out is *not* avoidance,
 * putting '잊었다고 생각했다' back is *not* denial, four rewrites are *not*
 * uncertainty. What is recorded is that a fragment was removed at one moment
 * and added again at another, that the order changed twice, that eleven seconds
 * passed. Not one detector reads the words.
 *
 * That restriction is deliberate and worth stating plainly, because the data to
 * break it is right there: every summary carries the fragment ids, and it would
 * take one lookup table to start scoring sentences for sentiment. The exhibition
 * is about what stays unanswered, and a system that told a visitor what their
 * own sentence revealed would have answered it for them.
 *
 * Every detector returns its evidence whether or not it fired.
 *
 * Thresholds live in src/lib/sentenceThresholds.ts.
 */
import type { BehaviorPattern } from './behaviorPatterns';
import { SENTENCE_THRESHOLDS } from './sentenceThresholds';
import type { SentenceBehaviorSummary, SentenceOperation } from './sentenceTracking';

/** Operations, flattened for evidence. The order is the whole point of them. */
function describeOperations(
  operations: readonly SentenceOperation[],
): Array<Record<string, string | number | boolean | null>> {
  return operations.map((op) => ({
    step: op.step,
    kind: op.kind,
    fragmentId: op.fragmentId,
    fromIndex: op.fromIndex,
    toIndex: op.toIndex,
    orderAfter: op.orderAfter.join(' '),
  }));
}

/**
 * A fragment taken out of the sentence and later put back in.
 *
 * Paired with the removal it undoes rather than with the first removal ever
 * recorded, so a fragment that went in and out three times reads as three
 * returns and not as one long one.
 */
function fragmentReturn(summary: SentenceBehaviorSummary): BehaviorPattern {
  const returns = summary.removedThenReturnedFragments;
  return {
    id: 'FRAGMENT_RETURN',
    detected: returns.length > 0,
    facts: {
      fragmentReturnCount: returns.length,
      returnedFragments: summary.returnedFragments,
      returns: returns.map((r) => ({
        fragmentId: r.fragmentId,
        removedAt: r.removedAt,
        returnedAt: r.returnedAt,
        timeGapMs: Math.round(r.timeGapMs),
        sentenceBeforeRemoval: r.sentenceBeforeRemoval.join(' '),
        orderAfterReturn: r.orderAfterReturn.join(' '),
        operationsBetween: r.operationsBetween,
      })),
      // Put in at some point and absent at the end — the opposite move, and
      // worth having beside this one rather than confused with it.
      addedButDroppedFragments: summary.addedButDroppedFragments,
      removeCount: summary.removeCount,
    },
  };
}

/**
 * A fragment read at length, or returned to repeatedly, and then left out.
 *
 * Either bound is enough on its own — a long single look and several short
 * ones are two ways of paying attention. Both are needed as bounds, though,
 * because without them every fragment the pointer crossed on its way somewhere
 * else would qualify, and twenty unused fragments is not an observation.
 *
 * Reports which fragments, and how they were looked at. Nothing about why one
 * might read something carefully and not use it.
 */
function viewSelectionGap(summary: SentenceBehaviorSummary): BehaviorPattern {
  const candidates = summary.viewedButUnusedFragments
    .map((fragmentId) => ({
      fragmentId,
      dwellMs: Math.round(summary.dwellMsByFragment[fragmentId] ?? 0),
      viewCount: summary.viewCountByFragment[fragmentId] ?? 0,
      revisitCount: summary.revisitCountByFragment[fragmentId] ?? 0,
    }))
    .filter(
      (f) =>
        f.dwellMs >= SENTENCE_THRESHOLDS.viewSelectionGapMinDwellMs ||
        f.viewCount >= SENTENCE_THRESHOLDS.viewSelectionGapMinViews,
    )
    .sort((a, b) => b.dwellMs - a.dwellMs);

  return {
    id: 'VIEW_SELECTION_GAP',
    /*
      A sentence has to exist for a fragment to have been left out of one. A
      visitor who read carefully and then built nothing has not passed anything
      over — they left, and "read this closely but did not use it" would be a
      finding about a decision that was never made.
    */
    detected: summary.finalFragments.length > 0 && candidates.length > 0,
    facts: {
      gapFragments: candidates.map((f) => ({ ...f, finalIncluded: false })),
      sentenceExists: summary.finalFragments.length > 0,
      gapFragmentCount: candidates.length,
      longestViewedFragment: summary.longestViewedFragment,
      longestViewedIncluded:
        summary.longestViewedFragment !== null &&
        summary.finalFragments.includes(summary.longestViewedFragment),
      viewedButUnusedCount: summary.viewedButUnusedFragments.length,
      // False on a touchscreen, where there is no pointer to rest and so no
      // looking to record. A `false` verdict means nothing here.
      hasViewData: summary.hasViewData,
      minDwellMs: SENTENCE_THRESHOLDS.viewSelectionGapMinDwellMs,
      minViews: SENTENCE_THRESHOLDS.viewSelectionGapMinViews,
    },
  };
}

/**
 * The sentence was changed, repeatedly, after parts of it were already there.
 *
 * Counts removals and reorders, never plain additions. Adding a fragment to a
 * half-built sentence is building it; taking one out or moving one is undoing
 * something already decided, and only the second is rewriting.
 */
function repeatedRewrite(summary: SentenceBehaviorSummary): BehaviorPattern {
  return {
    id: 'REPEATED_REWRITE',
    detected: summary.rewriteCount >= SENTENCE_THRESHOLDS.repeatedRewriteMinEdits,
    facts: {
      rewriteCount: summary.rewriteCount,
      removeCount: summary.removeCount,
      reorderCount: summary.reorderCount,
      addCount: summary.addCount,
      constructionChangeCount: summary.constructionChangeCount,
      uniqueFragmentsUsed: summary.uniqueFragmentsUsed,
      finalFragmentCount: summary.finalFragments.length,
      minEdits: SENTENCE_THRESHOLDS.repeatedRewriteMinEdits,
    },
  };
}

/**
 * Fragments already in the sentence were put in a different order.
 *
 * A drag that ends where it began never becomes an event, so everything
 * counted here moved something. Whether the order ended up back where it
 * started is reported rather than tested — going out and back is still a
 * reordering that happened.
 */
function orderRevision(summary: SentenceBehaviorSummary): BehaviorPattern {
  const reorders = summary.operations.filter((op) => op.kind === 'reorder');
  const firstOrder = summary.operations.length > 0 ? summary.operations[0].orderAfter : [];
  const initialOrder = reorders.length > 0
    ? (summary.operations[reorders[0].step - 1]?.orderAfter ?? firstOrder)
    : firstOrder;
  return {
    id: 'ORDER_REVISION',
    detected: summary.reorderCount >= SENTENCE_THRESHOLDS.orderRevisionMinCount,
    facts: {
      reorderCount: summary.reorderCount,
      reorders: describeOperations(reorders),
      initialOrder: initialOrder.join(' '),
      finalOrder: summary.finalFragments.join(' '),
      // True when the moves cancelled out and the sentence reads as it did
      // before any of them.
      orderUnchanged: initialOrder.join(' ') === summary.finalFragments.join(' '),
      minCount: SENTENCE_THRESHOLDS.orderRevisionMinCount,
    },
  };
}

/**
 * The sentence was changed after it was already long enough to submit.
 *
 * "Long enough to submit" is a fact about the Zone's rule, not about the
 * sentence being finished — a visitor who reaches three fragments has not
 * declared anything, and nothing here treats that moment as completion in any
 * sense but the mechanical one.
 */
function postCompletionRevision(summary: SentenceBehaviorSummary): BehaviorPattern {
  return {
    id: 'POST_COMPLETION_REVISION',
    detected: summary.firstValidAt !== null && summary.editsAfterFirstValidSentence > 0,
    facts: {
      firstValidAt: summary.firstValidAt,
      msToFirstValidSentence:
        summary.msToFirstValidSentence === null ? null : Math.round(summary.msToFirstValidSentence),
      editCountAfterValid: summary.editsAfterFirstValidSentence,
      additionsAfterValid: summary.additionsAfterFirstValidSentence,
      removalsAfterValid: summary.removalsAfterFirstValidSentence,
      reordersAfterValid: summary.reordersAfterFirstValidSentence,
      operationsAfterValid: describeOperations(summary.operationsAfterFirstValid),
      firstValidOrder: summary.firstValidOrder.join(' '),
      finalOrder: summary.finalFragments.join(' '),
      orderChangedSinceFirstValid: summary.orderChangedSinceFirstValid,
      // More than one means the sentence dropped back under the minimum at
      // some point and was built up again.
      becameValidCount: summary.becameValidCount,
    },
  };
}

/**
 * A fragment went in near the end of a long build, just before submitting.
 *
 * Four conditions, and the first is the one that does the real work: the
 * addition has to come *after the sentence could already have been submitted*.
 * Without it the pattern fires on anybody who worked slowly, because the last
 * fragment of a steady build is always the most recent thing that happened and
 * always sits at the very end of its own timeline — which is the "fired merely
 * for being last" failure this is supposed to avoid. A fragment added while the
 * sentence was still too short to record is not a late addition; it is the
 * sentence being built.
 *
 * The rest bound it: the build has to have been going a while, the addition has
 * to land shortly before the record was submitted, and it has to fall late in
 * this visitor's own timeline — measured against the span from the first
 * operation to the submission, not to the last operation, since every last
 * operation is trivially at the end of that one.
 */
function lateAddition(summary: SentenceBehaviorSummary): BehaviorPattern {
  const { lateAdditionMinElapsedMs, lateAdditionMaxTimeToCommitMs, lateAdditionMinProgressRatio } =
    SENTENCE_THRESHOLDS;
  const firstOp = summary.operations[0] ?? null;
  const committedAt = summary.committedAt;
  const firstValidAt = summary.firstValidAt;
  const span = firstOp && committedAt !== null ? committedAt - firstOp.at : 0;

  const late =
    firstOp === null || committedAt === null || firstValidAt === null
      ? []
      : summary.operations.filter((op) => {
          if (op.kind !== 'add') return false;
          // The sentence was already long enough to record before this went in.
          if (op.at <= firstValidAt) return false;
          const elapsed = op.at - firstOp.at;
          if (elapsed < lateAdditionMinElapsedMs) return false;
          if (committedAt - op.at > lateAdditionMaxTimeToCommitMs) return false;
          const progress = span > 0 ? elapsed / span : 1;
          return progress >= lateAdditionMinProgressRatio;
        });

  return {
    id: 'LATE_ADDITION',
    detected: late.length > 0,
    facts: {
      lateAdditionCount: late.length,
      lateAdditions: late.map((op) => ({
        fragmentId: op.fragmentId,
        index: op.toIndex,
        msIntoConstruction: firstOp ? Math.round(op.at - firstOp.at) : null,
        msBeforeCommit: committedAt === null ? null : Math.round(committedAt - op.at),
        msAfterSentenceWasSubmittable:
          firstValidAt === null ? null : Math.round(op.at - firstValidAt),
        progressRatio: span > 0 && firstOp ? Math.round(((op.at - firstOp.at) / span) * 100) / 100 : null,
        orderAfter: op.orderAfter.join(' '),
      })),
      // First operation → submission, which is what "late" is measured against.
      spanToCommitMs: span === 0 ? 0 : Math.round(span),
      constructionTimeMs:
        summary.constructionTime === null ? null : Math.round(summary.constructionTime),
      // Additions made while the sentence was still too short to record. Never
      // late, however long they took — the sentence was still being built.
      addsBeforeSubmittable: summary.addCount - summary.additionsAfterFirstValidSentence,
      msFromLastEditToCommit:
        summary.msFromLastEditToCommit === null ? null : Math.round(summary.msFromLastEditToCommit),
      minElapsedMs: lateAdditionMinElapsedMs,
      maxTimeToCommitMs: lateAdditionMaxTimeToCommitMs,
      minProgressRatio: lateAdditionMinProgressRatio,
    },
  };
}

/**
 * A wait between the last change and saying the sentence is the sentence.
 *
 * LIGHT's floor and ratio, on the window this Zone has: from the last edit — or
 * from the moment the record could first be submitted, whichever is later — to
 * the submission. Measuring from the last edit alone would count a visitor who
 * built a two-fragment sentence and then sat looking at an unusable button as
 * having hesitated over a decision they had not yet been allowed to make.
 */
function postSentenceHesitation(summary: SentenceBehaviorSummary): BehaviorPattern {
  const gateAt = Math.max(
    summary.advanceReadyAt ?? Number.NEGATIVE_INFINITY,
    summary.lastEditAt ?? Number.NEGATIVE_INFINITY,
  );
  const pauseMs =
    summary.committedAt !== null && Number.isFinite(gateAt)
      ? Math.max(0, summary.committedAt - gateAt)
      : null;
  const buildMs = summary.constructionTime;
  const detected =
    pauseMs !== null &&
    pauseMs >= SENTENCE_THRESHOLDS.postSentenceFloorMs &&
    (buildMs === null || buildMs === 0 || pauseMs >= buildMs * SENTENCE_THRESHOLDS.postSentenceRatio);

  return {
    id: 'POST_SENTENCE_HESITATION',
    detected,
    facts: {
      postSentenceMs: pauseMs === null ? null : Math.round(pauseMs),
      msFromLastEditToCommit:
        summary.msFromLastEditToCommit === null ? null : Math.round(summary.msFromLastEditToCommit),
      constructionTimeMs: buildMs === null ? null : Math.round(buildMs),
      gatedByAdvanceReady: summary.advanceReadyAt !== null,
      finalFragmentCount: summary.finalFragments.length,
      floorMs: SENTENCE_THRESHOLDS.postSentenceFloorMs,
      ratio: SENTENCE_THRESHOLDS.postSentenceRatio,
    },
  };
}

export function detectSentencePatterns(summary: SentenceBehaviorSummary): BehaviorPattern[] {
  return [
    fragmentReturn(summary),
    viewSelectionGap(summary),
    repeatedRewrite(summary),
    orderRevision(summary),
    postCompletionRevision(summary),
    lateAddition(summary),
    postSentenceHesitation(summary),
  ];
}
