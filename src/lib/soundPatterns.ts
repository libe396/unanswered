/**
 * SOUND's patterns.
 *
 * The same restraint as LIGHT's, and it bears repeating here because sound
 * invites the overreach more than images do: a visitor who plays a recording of
 * rain four times has done something legible, and the temptation is to say what
 * it meant. Nothing in this file says. "The sound listened to longest is not
 * the sound chosen" is arithmetic about a log. Whether that is doubt, or care,
 * or a phone ringing in the room, is exactly the part the exhibition is about
 * not answering.
 *
 * So every detector returns its evidence alongside its verdict, and returns it
 * whether or not the pattern fired — a `false` with the numbers attached can be
 * argued with, and a bare `false` cannot.
 *
 * The thresholds all live in src/lib/soundThresholds.ts; the reasoning for each
 * is there rather than here.
 */
import type { BehaviorPattern } from './behaviorPatterns';
import { SOUND_THRESHOLDS } from './soundThresholds';
import type { SoundBehaviorSummary, SoundSession } from './soundTracking';

/** Rounds a map of milliseconds, so evidence reads in whole ms. */
function roundMs(map: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(map)) out[key] = Math.round(value);
  return out;
}

function roundRatios(map: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(map)) out[key] = Math.round(value * 100) / 100;
  return out;
}

/**
 * The sound given the most listening is not the sound chosen.
 *
 * Nothing more is claimed than that. Attention and choice are two different
 * records, and this notes where they disagree.
 */
function listenSelectionGap(summary: SoundBehaviorSummary): BehaviorPattern {
  const mostListened = summary.mostListenedSound;
  const chosen = summary.finalSelected;
  return {
    id: 'LISTEN_SELECTION_GAP',
    detected: mostListened !== null && chosen !== null && mostListened !== chosen,
    facts: {
      mostListenedSound: mostListened,
      mostListenedMs: mostListened ? Math.round(summary.listenTimeBySound[mostListened] ?? 0) : null,
      finalSelectedSound: chosen,
      finalSelectedListenMs: chosen ? Math.round(summary.listenTimeBySound[chosen] ?? 0) : null,
      listenTimeBySound: roundMs(summary.listenTimeBySound),
    },
  };
}

/**
 * A sound started over from the top, more than once, having already been heard.
 *
 * The three conditions that make a restart count as a re-listen are applied in
 * summarizeSound, where the playheads are; this only asks how many survived.
 * Resuming after a pause never reaches here — it is not a start from the top.
 */
function replayLoop(summary: SoundBehaviorSummary): BehaviorPattern {
  const looped = Object.entries(summary.replayCountBySound)
    .filter(([, count]) => count >= SOUND_THRESHOLDS.replayLoopMinReplays)
    .sort((a, b) => b[1] - a[1]);
  return {
    id: 'REPLAY_LOOP',
    detected: looped.length > 0,
    facts: {
      loopedSounds: looped.map(([soundId]) => soundId),
      replayCountBySound: summary.replayCountBySound,
      maxReplayCount: looped.length > 0 ? looped[0][1] : 0,
      totalReplayCount: summary.replayCount,
      minReplaysForLoop: SOUND_THRESHOLDS.replayLoopMinReplays,
      minPriorListenMs: SOUND_THRESHOLDS.replayMinPriorListenMs,
      minReplayListenMs: SOUND_THRESHOLDS.replayMinListenMs,
      listenTimeBySound: roundMs(summary.listenTimeBySound),
    },
  };
}

/**
 * A sound came back to after at least one other was listened to.
 *
 * Read off the collapsed listen path, so playing the same clip twice in a row
 * is not a return — going somewhere else first is the whole of what is being
 * recorded.
 */
function soundReturn(summary: SoundBehaviorSummary): BehaviorPattern {
  // Every sound that was played at all has an entry, most of them zero — the
  // map is keyed for reading, not filtered for counting.
  const returned = Object.entries(summary.returnCountBySound)
    .filter(([, count]) => count > 0)
    .map(([soundId]) => soundId);
  return {
    id: 'SOUND_RETURN',
    detected: returned.length > 0,
    facts: {
      returnedSounds: returned,
      returnCountBySound: summary.returnCountBySound,
      returnCount: summary.returnCount,
      listenPath: summary.listenPath,
      distinctListened: new Set(summary.listenPath).size,
    },
  };
}

/**
 * A sound stopped near its beginning, on purpose.
 *
 * Two bounds, and both are needed. Below the floor it is a mis-click — the row
 * hit twice, or the wrong row hit once — and above the ratio it is not early.
 * Playback that stopped because the Zone was left is excluded outright: being
 * taken away from a sound is not turning away from it.
 */
function earlyRejection(summary: SoundBehaviorSummary): BehaviorPattern {
  const rejections = summary.sessions.filter(
    (session: SoundSession) =>
      session.reason !== 'ended' &&
      session.reason !== 'sceneExit' &&
      session.listenedMs >= SOUND_THRESHOLDS.earlyRejectionMinListenMs &&
      session.durationMs > 0 &&
      session.progressRatio <= SOUND_THRESHOLDS.earlyRejectionMaxRatio,
  );

  const stoppedAtRatio: Record<string, number> = {};
  const stoppedAfterMs: Record<string, number> = {};
  for (const session of rejections) {
    // The earliest stop is kept when a sound was cut short more than once: it
    // is the strongest reading of the same behaviour, not a separate one.
    const seenRatio = stoppedAtRatio[session.soundId];
    if (seenRatio === undefined || session.progressRatio < seenRatio) {
      stoppedAtRatio[session.soundId] = session.progressRatio;
      stoppedAfterMs[session.soundId] = session.listenedMs;
    }
  }

  return {
    id: 'EARLY_REJECTION',
    detected: rejections.length > 0,
    facts: {
      rejectedSounds: Object.keys(stoppedAtRatio),
      stoppedAtRatio: roundRatios(stoppedAtRatio),
      stoppedAfterMs: roundMs(stoppedAfterMs),
      rejectionCount: rejections.length,
      // A sound cut short early and later heard out is a different record from
      // one only ever cut short, so the deepest point reached rides along.
      maxProgressRatioBySound: roundRatios(summary.maxProgressRatioBySound),
      completionCountBySound: summary.completionCountBySound,
      minListenMs: SOUND_THRESHOLDS.earlyRejectionMinListenMs,
      maxRatio: SOUND_THRESHOLDS.earlyRejectionMaxRatio,
    },
  };
}

/**
 * Listening carried on after a sound had already been chosen.
 *
 * Anchored on the *first* choice rather than the last, because the question is
 * whether the visitor kept listening once they had an answer — and if the
 * answer later moved, that is what FINAL_RETURN and the selection path are for.
 * Whether what they went back to was something other than their own choice is
 * recorded separately, since the two read differently: confirming a pick and
 * weighing it against a rival are not the same act.
 */
function postSelectionReplay(summary: SoundBehaviorSummary): BehaviorPattern {
  const after = summary.sessionsAfterFirstSelection.filter((session) => session.meaningful);
  const played: string[] = [];
  const listenMs: Record<string, number> = {};
  for (const session of after) {
    if (!played.includes(session.soundId)) played.push(session.soundId);
    listenMs[session.soundId] = (listenMs[session.soundId] ?? 0) + session.listenedMs;
  }
  const chosenFirst = summary.firstSelected;
  const others = played.filter((soundId) => soundId !== chosenFirst);

  return {
    id: 'POST_SELECTION_REPLAY',
    detected: after.length > 0,
    facts: {
      firstSelectedSound: chosenFirst,
      finalSelectedSound: summary.finalSelected,
      soundsPlayedAfterSelection: played,
      playedOtherThanSelected: others.length > 0,
      otherSoundsPlayed: others,
      listenMsAfterSelection: roundMs(listenMs),
      sessionCountAfterSelection: after.length,
      minListenMs: SOUND_THRESHOLDS.meaningfulListenMs,
    },
  };
}

/**
 * The choice moved, and came back to where it started.
 *
 * The same reading as LIGHT's, on the sound question.
 */
function finalReturn(summary: SoundBehaviorSummary): BehaviorPattern {
  const first = summary.firstSelected;
  const chosen = summary.finalSelected;
  return {
    id: 'FINAL_RETURN',
    detected: summary.selectionChangeCount >= 1 && first !== null && first === chosen,
    facts: {
      firstSelectedSound: first,
      finalSelectedSound: chosen,
      selectionPath: summary.selectionPath,
      selectionChangeCount: summary.selectionChangeCount,
    },
  };
}

/**
 * A pause between having decided and moving on.
 *
 * LIGHT's floor and ratio, on a window SOUND has to measure differently. Its
 * NEXT waits on two answers, so the gap from the last sound chosen to the click
 * routinely contains time the visitor spent picking a feeling — time in which
 * moving on was not yet possible, and which is therefore not hesitation.
 * summarizeSound measures from the later of the last answer and the moment NEXT
 * became usable; this only reads that figure.
 */
function postDecisionHesitation(summary: SoundBehaviorSummary): BehaviorPattern {
  const pauseMs = summary.postDecisionMs;
  const decideMs = summary.decisionMs;
  const detected =
    pauseMs !== null &&
    pauseMs >= SOUND_THRESHOLDS.postDecisionFloorMs &&
    (decideMs === null || pauseMs >= decideMs * SOUND_THRESHOLDS.postDecisionRatio);
  return {
    id: 'POST_DECISION_HESITATION',
    detected,
    facts: {
      postDecisionMs: pauseMs === null ? null : Math.round(pauseMs),
      decisionMs: decideMs === null ? null : Math.round(decideMs),
      // False means the Zone never said when NEXT became usable, and the figure
      // above falls back to running from the last answer — worth knowing when
      // reading it.
      gatedByAdvanceReady: summary.advanceReadyAt !== null,
      floorMs: SOUND_THRESHOLDS.postDecisionFloorMs,
      ratio: SOUND_THRESHOLDS.postDecisionRatio,
    },
  };
}

export function detectSoundPatterns(summary: SoundBehaviorSummary): BehaviorPattern[] {
  return [
    listenSelectionGap(summary),
    replayLoop(summary),
    soundReturn(summary),
    earlyRejection(summary),
    postSelectionReplay(summary),
    finalReturn(summary),
    postDecisionHesitation(summary),
  ];
}
