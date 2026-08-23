/**
 * SOUND's derived layer.
 *
 * LIGHT asks what a visitor looked at, and a look is one number: how long the
 * pointer rested. A listen is not. It has a beginning that is either the top of
 * the clip or somewhere in the middle, an end that is either the end of the
 * sound or a decision to stop, and a length that is only comparable to other
 * listens once it is read against how long the sound actually is. So the raw
 * events differ — `playStart`/`play` where LIGHT records `view` — and this file
 * is where they are replayed into the figures the Zone is read by.
 *
 * Everything else is deliberately shared. Selections, changes of mind, the time
 * from a question appearing to the first answer and from the last answer to
 * NEXT are the same acts in both Zones, recorded by the same events and
 * summarised by the same code in src/lib/behaviorTracking.ts. This file reads
 * that summary rather than restating it.
 *
 * Pure, like its LIGHT counterpart: hand it a record from any visit and it
 * answers with whatever the current definitions say. Nothing here is stored.
 */
import { summarizeScene } from './behaviorTracking';
import type { GroupSummary } from './behaviorTracking';
import { POSITION_GROUP as POSITION_GROUP_NAME, summarizePositioning } from './positionTracking';
import type { PositioningSummary } from './positionTracking';
import { SOUND_THRESHOLDS } from './soundThresholds';
import type {
  BehaviorSelectionMode,
  PlayStopReason,
  SceneBehaviorRecord,
  SceneId,
} from '../types';

/**
 * The two questions the Zone asks, and how each answers.
 *
 * Exported so the scene declares its groups by importing this rather than by
 * writing the same two names again — the summary below looks them up by name,
 * and a typo in the scene would otherwise produce an empty report rather than
 * an error.
 */
export const SOUND_TRACKING_GROUPS: Record<string, BehaviorSelectionMode> = {
  sound: 'single',
  position: 'single',
};

export const SOUND_GROUP = 'sound';
/*
  The Zone's second question used to be a feeling word, filed under an
  `emotion` group with the same select/deselect events as LIGHT's. It is now a
  place in a field, which has no options to select and so records nothing of
  that kind — the group is named here and summarised by summarizePositioning.

  LIGHT still asks for feelings and is untouched. Records made before the
  change still hold their `emotion` group; nothing below reads it, and the
  summary of an old visit simply has no positioning in it.
*/
export { POSITION_GROUP } from './positionTracking';

/** One uninterrupted stretch of playback, from pressing play to it stopping. */
export interface SoundSession {
  soundId: string;
  startedAt: number;
  endedAt: number;
  /** Playhead at either end of the stretch, in ms. */
  fromMs: number;
  toMs: number;
  listenedMs: number;
  /** Full length of the clip. */
  durationMs: number;
  reason: PlayStopReason;
  /** Playback picked up mid-clip rather than starting at the top. */
  resumed: boolean;
  /** Ran to the end of the clip. */
  completed: boolean;
  /** How far into the clip this stretch reached, 0–1. */
  progressRatio: number;
  /** Long enough to count as having listened at all. */
  meaningful: boolean;
}

export interface SoundBehaviorSummary {
  sceneId: SceneId;
  sceneEnteredAt: number;

  /** Every stretch of playback, in order. The layer everything below reads. */
  sessions: SoundSession[];

  /* ── Per sound ─────────────────────────────────────────────────────────── */
  /** Audio actually heard, summed across every stretch. */
  listenTimeBySound: Record<string, number>;
  /** Times the sound was started from the top. Resuming a pause is not one. */
  playCountBySound: Record<string, number>;
  /** Times playback was picked up mid-clip instead. */
  resumeCountBySound: Record<string, number>;
  /** Times it ran to the end. */
  completionCountBySound: Record<string, number>;
  /** Completions per play from the top: how often starting it meant hearing it out. */
  completionRatioBySound: Record<string, number>;
  /** The furthest into the clip the visitor ever got, 0–1. */
  maxProgressRatioBySound: Record<string, number>;

  /* ── Order ─────────────────────────────────────────────────────────────── */
  /**
   * The sounds listened to, in order, with consecutive repeats collapsed.
   *
   * Collapsed because pausing and carrying on, and playing the same clip twice
   * over, are both one continuous engagement with one sound — neither is a move
   * to somewhere else and back. That distinction is what makes a repeat
   * anywhere in this path a genuine return; the repeats that were collapsed out
   * are counted as replays instead.
   */
  listenPath: string[];
  firstPlayedSound: string | null;
  lastPlayedSound: string | null;
  /** Where the most listening time went, which is not always where the choice went. */
  mostListenedSound: string | null;

  /* ── Going back ────────────────────────────────────────────────────────── */
  /** Deliberate re-listens: started from the top again, having already heard it. */
  replayCountBySound: Record<string, number>;
  replayCount: number;
  /** Came back to this sound after listening to at least one other. */
  returnCountBySound: Record<string, number>;
  returnCount: number;

  /* ── The sound question ────────────────────────────────────────────────── */
  firstSelected: string | null;
  finalSelected: string | null;
  /** Every choice made, in order — where the answer moved, not just where it landed. */
  selectionPath: string[];
  selectionChangeCount: number;
  /** Playback that happened after a choice had already been made. */
  sessionsAfterFirstSelection: SoundSession[];
  firstSelectionAt: number | null;

  /* ── Where the sound was placed ────────────────────────────────────────── */
  positioning: PositioningSummary;
  /** Listening that happened once the field was open. */
  soundReplayDuringPositioning: SoundSession[];
  /** …and once the point had actually been put down. */
  soundReplayAfterPlacement: SoundSession[];

  /* ── Time ──────────────────────────────────────────────────────────────── */
  /** The Zone opening → the first sound chosen. */
  decisionMs: number | null;
  sceneEnterToFirstSelectionMs: number | null;
  /**
   * Everything answered → NEXT pressed.
   *
   * Measured from the later of the last answer and the moment NEXT actually
   * became usable, so that time spent still owing the Zone an answer is not
   * counted as sitting on a decision already made.
   */
  postDecisionMs: number | null;
  advanceReadyAt: number | null;
  committedAt: number | null;

  eventCount: number;
}

const EMPTY_GROUP_FALLBACK: Pick<
  GroupSummary,
  'firstSelectedId' | 'finalSelectedIds' | 'selectionPath' | 'selectionChangeCount'
> = {
  firstSelectedId: null,
  finalSelectedIds: [],
  selectionPath: [],
  selectionChangeCount: 0,
};

/** Rebuilds the play/stop pairs into whole stretches of playback. */
function buildSessions(record: SceneBehaviorRecord): SoundSession[] {
  const sessions: SoundSession[] = [];
  let pending: { targetId: string; at: number; positionMs: number; resumed: boolean } | null = null;

  for (const event of record.events) {
    if (event.type === 'playStart') {
      pending = {
        targetId: event.targetId,
        at: event.at,
        positionMs: event.positionMs,
        resumed: event.resumed,
      };
      continue;
    }
    if (event.type !== 'play') continue;

    /*
      A stop with no start before it should not happen — the tracker drops any
      stop that does not match the playback it has open. Recovering rather than
      discarding is still the right call: the listening in this stretch is
      recorded on the stop, and throwing it away would lose real listening to
      defend a bookkeeping invariant.
    */
    const start =
      pending && pending.targetId === event.targetId
        ? pending
        : { at: event.at - event.listenedMs, resumed: event.fromMs > 0 };
    pending = null;

    const durationMs = event.durationMs;
    sessions.push({
      soundId: event.targetId,
      startedAt: start.at,
      endedAt: event.at,
      fromMs: event.fromMs,
      toMs: event.toMs,
      listenedMs: event.listenedMs,
      durationMs,
      reason: event.reason,
      resumed: start.resumed,
      completed: event.reason === 'ended',
      progressRatio: durationMs > 0 ? Math.min(1, event.toMs / durationMs) : 0,
      meaningful: event.listenedMs >= SOUND_THRESHOLDS.meaningfulListenMs,
    });
  }

  return sessions;
}

export function summarizeSound(record: SceneBehaviorRecord): SoundBehaviorSummary {
  const scene = summarizeScene(record);
  const soundGroup = scene.groups[SOUND_GROUP];
  const positionGroup = scene.groups[POSITION_GROUP_NAME];
  const sound = soundGroup ?? EMPTY_GROUP_FALLBACK;

  const sessions = buildSessions(record);

  const listenTimeBySound: Record<string, number> = {};
  const playCountBySound: Record<string, number> = {};
  const resumeCountBySound: Record<string, number> = {};
  const completionCountBySound: Record<string, number> = {};
  const completionRatioBySound: Record<string, number> = {};
  const maxProgressRatioBySound: Record<string, number> = {};
  const replayCountBySound: Record<string, number> = {};
  const returnCountBySound: Record<string, number> = {};

  // Listening banked *before* the stretch being examined, which is what decides
  // whether starting the clip over is a re-listen or a second run at a first
  // one. Kept separately from the running totals for that reason.
  const listenedBefore: Record<string, number> = {};

  const listenPath: string[] = [];

  for (const session of sessions) {
    const id = session.soundId;
    // Seeded on first sight so every map is keyed in the order the sounds were
    // played — which makes `mostListenedSound` settle a tie on whichever was
    // reached first, rather than on however the keys happened to land.
    if (!(id in listenTimeBySound)) {
      listenTimeBySound[id] = 0;
      playCountBySound[id] = 0;
      resumeCountBySound[id] = 0;
      completionCountBySound[id] = 0;
      maxProgressRatioBySound[id] = 0;
      replayCountBySound[id] = 0;
      returnCountBySound[id] = 0;
      listenedBefore[id] = 0;
    }

    const priorListening = listenedBefore[id];

    if (session.resumed) resumeCountBySound[id] += 1;
    else playCountBySound[id] += 1;

    if (session.completed) completionCountBySound[id] += 1;

    /*
      A replay is starting a sound over having already heard a fair amount of
      it, and then hearing a fair amount again. All three conditions earn their
      place: without the first, resuming a pause is a replay; without the
      second, a false start followed by the real listen is a replay; without the
      third, a stray double-click is one.
    */
    if (
      !session.resumed &&
      priorListening >= SOUND_THRESHOLDS.replayMinPriorListenMs &&
      session.listenedMs >= SOUND_THRESHOLDS.replayMinListenMs
    ) {
      replayCountBySound[id] += 1;
    }

    listenTimeBySound[id] += session.listenedMs;
    listenedBefore[id] += session.listenedMs;
    maxProgressRatioBySound[id] = Math.max(maxProgressRatioBySound[id], session.progressRatio);

    if (session.meaningful && listenPath[listenPath.length - 1] !== id) listenPath.push(id);
  }

  for (const id of Object.keys(listenTimeBySound)) {
    const plays = playCountBySound[id];
    completionRatioBySound[id] = plays > 0 ? completionCountBySound[id] / plays : 0;
  }

  // A repeat anywhere in the collapsed path is by definition a return: the
  // collapsing already removed every repeat that had nothing in between.
  const seen = new Set<string>();
  for (const id of listenPath) {
    if (seen.has(id)) returnCountBySound[id] = (returnCountBySound[id] ?? 0) + 1;
    seen.add(id);
  }

  let mostListenedSound: string | null = null;
  let mostListenedMs = -1;
  for (const [id, ms] of Object.entries(listenTimeBySound)) {
    if (ms > mostListenedMs) {
      mostListenedMs = ms;
      mostListenedSound = id;
    }
  }

  const firstSelectionAt =
    record.events.find(
      (event) => event.type === 'select' && event.group === SOUND_GROUP,
    )?.at ?? null;

  /*
    The Zone's two questions are asked on two steps and committed separately —
    the sound when the visitor leaves the list, the position when they leave the
    Zone. The later one is what "finished" means here, so it is read first;
    falling back to the sound's covers a visit that ended before the field.
  */
  const committedAt = positionGroup?.committedAt ?? soundGroup?.committedAt ?? null;

  const positioning = summarizePositioning(
    record,
    POSITION_GROUP_NAME,
    positionGroup?.openedAt ?? null,
    committedAt,
  );

  /*
    The last time either question was answered. Both count: NEXT waits on the
    two of them — a sound chosen and a point put down — so the decision is not
    finished until neither has moved. The second half used to be a feeling word
    and read from `select` events; it is now the last time the point was moved.
  */
  let lastSelectionAt: number | null = null;
  for (const event of record.events) {
    if (event.type !== 'select' && event.type !== 'deselect') continue;
    if (event.group !== SOUND_GROUP) continue;
    lastSelectionAt = event.at;
  }
  const lastAnswerAt = Math.max(
    lastSelectionAt ?? Number.NEGATIVE_INFINITY,
    positioning.lastMovedAt ?? Number.NEGATIVE_INFINITY,
  );

  const decisionStart = Math.max(
    scene.advanceReadyAt ?? Number.NEGATIVE_INFINITY,
    lastAnswerAt,
  );
  const postDecisionMs =
    committedAt !== null && Number.isFinite(decisionStart)
      ? Math.max(0, committedAt - decisionStart)
      : null;

  return {
    sceneId: record.sceneId,
    sceneEnteredAt: record.sceneEnteredAt,
    sessions,

    listenTimeBySound,
    playCountBySound,
    resumeCountBySound,
    completionCountBySound,
    completionRatioBySound,
    maxProgressRatioBySound,

    listenPath,
    firstPlayedSound: listenPath[0] ?? null,
    lastPlayedSound: listenPath[listenPath.length - 1] ?? null,
    mostListenedSound,

    replayCountBySound,
    replayCount: Object.values(replayCountBySound).reduce((total, n) => total + n, 0),
    returnCountBySound,
    returnCount: Object.values(returnCountBySound).reduce((total, n) => total + n, 0),

    firstSelected: sound.firstSelectedId,
    finalSelected: sound.finalSelectedIds[0] ?? null,
    selectionPath: sound.selectionPath,
    selectionChangeCount: sound.selectionChangeCount,
    sessionsAfterFirstSelection:
      firstSelectionAt === null
        ? []
        : sessions.filter((session) => session.startedAt >= firstSelectionAt),
    firstSelectionAt,

    positioning,
    /*
      Listening measured against two different moments. The field opening is
      when the visitor could start answering the second question; the point
      going down is when they had. Going back to the sound before deciding and
      going back after are not the same act, and only the second is what
      POST_PLACEMENT_REPLAY is about.
    */
    soundReplayDuringPositioning:
      positioning.openedAt === null
        ? []
        : sessions.filter((s) => s.meaningful && s.startedAt >= positioning.openedAt!),
    soundReplayAfterPlacement:
      positioning.placedAt === null
        ? []
        : sessions.filter((s) => s.meaningful && s.startedAt >= positioning.placedAt!),

    decisionMs:
      soundGroup?.msFromGroupOpenToFirstSelection ??
      soundGroup?.msFromSceneEnterToFirstSelection ??
      null,
    sceneEnterToFirstSelectionMs: soundGroup?.msFromSceneEnterToFirstSelection ?? null,
    postDecisionMs,
    advanceReadyAt: scene.advanceReadyAt,
    committedAt,

    eventCount: record.events.length,
  };
}
