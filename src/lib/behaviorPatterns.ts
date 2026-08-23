/**
 * Behavioural patterns — the derived layer.
 *
 * A pattern here is an arithmetic statement about recorded events and nothing
 * more. "The image looked at longest is not the image chosen" is a fact. What
 * that says about the person is not, and this file makes none of those claims:
 * no mood, no temperament, no confidence score. That restraint is the point —
 * the exhibition's whole subject is what stays unanswered, and a system that
 * announces what a visitor was feeling has answered it on their behalf.
 *
 * Every detector therefore returns its evidence alongside its verdict, and
 * returns it whether or not the pattern fired. A report that can see the numbers
 * behind a `false` is a report that can be argued with.
 */
import type { GroupSummary, SceneBehaviorSummary } from './behaviorTracking';

export type BehaviorPatternId =
  | 'ATTENTION_SELECTION_GAP'
  | 'RETURN_LOOP'
  | 'FINAL_RETURN'
  | 'POST_DECISION_HESITATION'
  /* SOUND's own, detected in src/lib/soundPatterns.ts. The two above them are
     shared: going back to a first answer and pausing before NEXT are the same
     acts whichever Zone they happen in, and are read the same way in both. */
  | 'LISTEN_SELECTION_GAP'
  | 'REPLAY_LOOP'
  | 'SOUND_RETURN'
  | 'EARLY_REJECTION'
  | 'POST_SELECTION_REPLAY'
  /* SOUND's second question, detected in src/lib/positionPatterns.ts. Not
     shared with anything: no other Zone asks for a place. */
  | 'POSITION_REVISION'
  | 'POSITION_RETURN'
  | 'POSITION_HESITATION'
  | 'POST_PLACEMENT_REPLAY'
  /* SENTENCE's own, detected in src/lib/sentencePatterns.ts. VIEW_SELECTION_GAP
     is LIGHT's ATTENTION_SELECTION_GAP asked of an answer with several parts,
     and kept separate rather than shared: LIGHT compares one chosen thing
     against one looked-at longest, and a sentence has no single choice to
     compare against. */
  | 'FRAGMENT_RETURN'
  | 'VIEW_SELECTION_GAP'
  | 'REPEATED_REWRITE'
  | 'ORDER_REVISION'
  | 'POST_COMPLETION_REVISION'
  | 'LATE_ADDITION'
  | 'POST_SENTENCE_HESITATION'
  /* MEMORY's own, detected in src/lib/memoryPatterns.ts. Nothing is shared
     with the other two: a Zone with nothing to choose from has no selection to
     go back to, and waiting in front of an empty canvas is not the same act as
     waiting with an answer already given. */
  | 'DELAYED_START'
  | 'LONG_PAUSE'
  | 'ERASE_RETURN'
  | 'REPEATED_REVISION'
  | 'SPATIAL_CONCENTRATION'
  | 'POST_DRAWING_HESITATION'
  /* MEMORY v2's own, detected in src/lib/memoryPatterns.ts. The Room's object
     question is a new group ('object') on the same Zone, read on the same
     terms as every other group here — see detectPatterns below, which these
     three lean on for their view-based evidence. */
  | 'OBJECT_RETURN'
  | 'OBJECT_ATTENTION_GAP'
  | 'OBJECT_REVISION';

/**
 * One measurement standing behind a verdict.
 *
 * Per-target maps are allowed because a Zone with seven clues has verdicts that
 * cannot be explained without saying which clue — "the loop was on these two,
 * this many times each" is evidence, and "a loop happened" is not.
 */
export type BehaviorFact =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | Record<string, number>
  /**
   * A list of occurrences, each described by flat named values.
   *
   * Some verdicts rest on a handful of separate events rather than on one
   * aggregate — three pauses at different points, two marks redrawn where
   * others were rubbed out. Parallel arrays would technically carry the same
   * numbers, but nobody reading a report can be asked to line them up by index.
   */
  | Array<Record<string, string | number | boolean | null>>;

export interface BehaviorPattern {
  id: BehaviorPatternId;
  detected: boolean;
  /** The measurements the verdict was reached from. */
  facts: Record<string, BehaviorFact>;
}

/**
 * A target has to be come back to this many times over to count as a loop.
 *
 * Two views is a comparison — look, look elsewhere, look again — and almost
 * everybody does it. Three is going back to the same clue after having left it
 * twice, which is the behaviour the pattern is named for.
 */
const RETURN_LOOP_MIN_VIEWS = 3;

/**
 * Floor for calling a pause after the decision long.
 *
 * Absolute, because a fraction alone would flag a visitor who decided in half a
 * second and then took a perfectly ordinary two to click on.
 */
const HESITATION_FLOOR_MS = 3000;

/**
 * …and relative, because "long" depends on the person.
 *
 * Ten seconds of deliberation followed by four of stillness is a different act
 * from two minutes followed by the same four. The pause has to be a real share
 * of how long the decision itself took before it means anything.
 */
const HESITATION_RATIO = 0.35;

function attentionSelectionGap(group: GroupSummary): BehaviorPattern {
  const longest = group.longestViewedTargetId;
  const chosen = group.finalSelectedIds[0] ?? null;
  return {
    id: 'ATTENTION_SELECTION_GAP',
    detected: longest !== null && chosen !== null && longest !== chosen,
    facts: {
      longestViewedTarget: longest,
      longestViewedMs: longest ? Math.round(group.dwellMsByTarget[longest] ?? 0) : null,
      finalSelectedTarget: chosen,
      finalSelectedViewedMs: chosen ? Math.round(group.dwellMsByTarget[chosen] ?? 0) : null,
    },
  };
}

function returnLoop(group: GroupSummary): BehaviorPattern {
  const looped = Object.entries(group.viewCountByTarget)
    .filter(([, count]) => count >= RETURN_LOOP_MIN_VIEWS)
    .sort((a, b) => b[1] - a[1]);
  return {
    id: 'RETURN_LOOP',
    detected: looped.length > 0,
    facts: {
      loopedTargets: looped.map(([targetId]) => targetId),
      maxViewCount: looped.length > 0 ? looped[0][1] : 0,
      threshold: RETURN_LOOP_MIN_VIEWS,
      viewPathLength: group.viewPath.length,
      distinctViewed: group.viewedTargets.length,
    },
  };
}

function finalReturn(group: GroupSummary): BehaviorPattern {
  const first = group.firstSelectedId;
  const chosen = group.finalSelectedIds[0] ?? null;
  /*
    Only meaningful for a question with one answer. A multi-select group ends
    holding a set, and "went back to the first one" has no clear reading when
    the first one may simply never have been dropped.
  */
  const applicable = group.mode === 'single';
  return {
    id: 'FINAL_RETURN',
    detected:
      applicable && group.selectionChangeCount >= 1 && first !== null && first === chosen,
    facts: {
      applicable,
      firstSelectedTarget: first,
      finalSelectedTarget: chosen,
      selectionChangeCount: group.selectionChangeCount,
    },
  };
}

function postDecisionHesitation(group: GroupSummary): BehaviorPattern {
  const pauseMs = group.msFromFinalSelectionToCommit;
  const decideMs =
    group.msFromGroupOpenToFirstSelection ?? group.msFromSceneEnterToFirstSelection ?? null;
  const detected =
    pauseMs !== null &&
    pauseMs >= HESITATION_FLOOR_MS &&
    (decideMs === null || pauseMs >= decideMs * HESITATION_RATIO);
  return {
    id: 'POST_DECISION_HESITATION',
    detected,
    facts: {
      postDecisionMs: pauseMs === null ? null : Math.round(pauseMs),
      decisionMs: decideMs === null ? null : Math.round(decideMs),
      floorMs: HESITATION_FLOOR_MS,
      ratio: HESITATION_RATIO,
    },
  };
}

/**
 * Runs every detector over one group.
 *
 * Takes a group rather than a scene because the question is the unit that has
 * patterns, not the room. LIGHT asks two, and only the image question is worth
 * asking `FINAL_RETURN` about.
 */
export function detectPatterns(group: GroupSummary): BehaviorPattern[] {
  return [
    attentionSelectionGap(group),
    returnLoop(group),
    finalReturn(group),
    postDecisionHesitation(group),
  ];
}

export function detectScenePatterns(
  summary: SceneBehaviorSummary,
): Record<string, BehaviorPattern[]> {
  const byGroup: Record<string, BehaviorPattern[]> = {};
  for (const [name, group] of Object.entries(summary.groups)) {
    byGroup[name] = detectPatterns(group);
  }
  return byGroup;
}
