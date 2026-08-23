/**
 * The memory field's patterns.
 *
 * The same restraint as everywhere else, and the field tests it harder than
 * anything so far. Its two axes are named with words about memory, so a point
 * in the lower left is *sitting under a label* in a way a sound file or an
 * image never was — and the temptation is to read the label back out as a
 * finding. Nothing here does. Not one detector below looks at where in the
 * field the point ended up. They look at whether it moved, how far, how many
 * times it turned, and whether the visitor went back to the sound before
 * settling. Where the point landed is the visitor's answer, and it is reported
 * as a coordinate and left alone.
 *
 * Every detector returns its evidence whether or not it fired.
 *
 * Thresholds live in src/lib/positionThresholds.ts.
 */
import type { BehaviorPattern } from './behaviorPatterns';
import { POSITION_THRESHOLDS } from './positionThresholds';
import { SOUND_THRESHOLDS } from './soundThresholds';
import type { SoundBehaviorSummary } from './soundTracking';

const round = (n: number | null, places = 3): number | null => {
  if (n === null || !Number.isFinite(n)) return null;
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
};

/**
 * The point ended up somewhere other than where it was first put down.
 *
 * Straight-line distance between the two, not distance travelled: a point
 * dragged in a long loop back to almost where it began has not been revised,
 * whatever the route. That case is POSITION_RETURN's.
 */
function positionRevision(summary: SoundBehaviorSummary): BehaviorPattern {
  const p = summary.positioning;
  const moved = p.distanceBetweenFirstAndFinal;
  return {
    id: 'POSITION_REVISION',
    detected: moved !== null && moved >= POSITION_THRESHOLDS.meaningfulMoveDistance,
    facts: {
      firstPositionX: round(p.firstPosition?.x ?? null),
      firstPositionY: round(p.firstPosition?.y ?? null),
      finalPositionX: round(p.finalPosition?.x ?? null),
      finalPositionY: round(p.finalPosition?.y ?? null),
      distanceBetweenFirstAndFinal: round(moved),
      positionRevisionCount: p.positionRevisionCount,
      gestureCount: p.gestures.length,
      minDistance: POSITION_THRESHOLDS.meaningfulMoveDistance,
    },
  };
}

/**
 * The point went somewhere and came back.
 *
 * Two conditions, and both are needed: it has to have genuinely left — the
 * furthest it ever got from where it started is what says so — and it has to
 * have ended up back within a distance a visitor would call the same place.
 * Between the two thresholds is a band that is neither, and nothing fires
 * there.
 */
function positionReturn(summary: SoundBehaviorSummary): BehaviorPattern {
  const p = summary.positioning;
  const back = p.distanceBetweenFirstAndFinal;
  const detected =
    p.placed &&
    p.maxDistanceFromFirst >= POSITION_THRESHOLDS.meaningfulMoveDistance &&
    back !== null &&
    back <= POSITION_THRESHOLDS.positionReturnRadius;
  return {
    id: 'POSITION_RETURN',
    detected,
    facts: {
      maxDistanceFromFirst: round(p.maxDistanceFromFirst),
      distanceBetweenFirstAndFinal: round(back),
      totalDragDistance: round(p.totalDragDistance),
      gestureCount: p.gestures.length,
      minDistanceAway: POSITION_THRESHOLDS.meaningfulMoveDistance,
      returnRadius: POSITION_THRESHOLDS.positionReturnRadius,
    },
  };
}

/**
 * The point changed direction repeatedly, or kept being left and picked up.
 *
 * Either signal is enough, because they are two ways of doing the same visible
 * thing and a visitor rarely does both. Turns are counted over segments long
 * enough to have a direction at all; stops are counted between gestures, not
 * inside them.
 *
 * This is a count of turns and gaps. It is not a state of mind, and the fact
 * that the field happens to be labelled with words about memory does not make
 * it one.
 */
function positionHesitation(summary: SoundBehaviorSummary): BehaviorPattern {
  const p = summary.positioning;
  const turns = p.directionChangeCount;
  const stops = p.pauses.length;
  const detected =
    p.placed &&
    (turns >= POSITION_THRESHOLDS.hesitationMinDirectionChanges ||
      stops >= POSITION_THRESHOLDS.hesitationMinPauses);
  return {
    id: 'POSITION_HESITATION',
    detected,
    facts: {
      directionChangeCount: turns,
      pauseCount: stops,
      longestPositionPauseMs: Math.round(p.longestPositionPauseMs),
      pauses: p.pauses.map((pause) => ({
        afterGestureIndex: pause.afterGestureIndex,
        durationMs: Math.round(pause.durationMs),
      })),
      totalDragDistance: round(p.totalDragDistance),
      // Travelling much further than the point actually moved is the same
      // observation from another side, and is reported rather than tested.
      displacementRatio:
        p.totalDragDistance > 0 && p.distanceBetweenFirstAndFinal !== null
          ? round(p.distanceBetweenFirstAndFinal / p.totalDragDistance)
          : null,
      gestureCount: p.gestures.length,
      positioningTimeMs: p.positioningTime === null ? null : Math.round(p.positioningTime),
      minDirectionChanges: POSITION_THRESHOLDS.hesitationMinDirectionChanges,
      minPauses: POSITION_THRESHOLDS.hesitationMinPauses,
      directionChangeAngle: POSITION_THRESHOLDS.directionChangeAngle,
    },
  };
}

/**
 * The sound was played again after the point had been put down.
 *
 * Whether the point then moved is recorded separately, because the two read
 * differently: going back to the sound and leaving the answer where it was is
 * confirming it, and going back and then moving the point is not.
 */
function postPlacementReplay(summary: SoundBehaviorSummary): BehaviorPattern {
  const p = summary.positioning;
  const replays = summary.soundReplayAfterPlacement;
  const firstReplayAt = replays.length > 0 ? replays[0].startedAt : null;
  const movedAfterReplay =
    firstReplayAt === null
      ? []
      : p.gestures.filter((g) => g.startedAt >= firstReplayAt && g.meaningful);

  return {
    id: 'POST_PLACEMENT_REPLAY',
    detected: replays.length > 0,
    facts: {
      replayCount: replays.length,
      soundsReplayed: [...new Set(replays.map((s) => s.soundId))],
      listenMsAfterPlacement: Math.round(
        replays.reduce((total, s) => total + s.listenedMs, 0),
      ),
      selectedSound: summary.finalSelected,
      // Did the answer move after going back to the sound?
      revisedAfterReplay: movedAfterReplay.length > 0,
      revisionCountAfterReplay: movedAfterReplay.length,
      distanceMovedAfterReplay:
        movedAfterReplay.length > 0
          ? round(
              movedAfterReplay.reduce((total, g) => total + g.displacement, 0),
            )
          : 0,
      replaysDuringPositioning: summary.soundReplayDuringPositioning.length,
      // A replay has to have been long enough to be a listen — the same floor
      // the rest of SOUND uses, so a stray click on play is not a return to it.
      minListenMs: SOUND_THRESHOLDS.meaningfulListenMs,
    },
  };
}

export function detectPositionPatterns(summary: SoundBehaviorSummary): BehaviorPattern[] {
  return [
    positionRevision(summary),
    positionReturn(summary),
    positionHesitation(summary),
    postPlacementReplay(summary),
  ];
}
