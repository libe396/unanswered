/**
 * Behavioural tracking — the raw layer.
 *
 * Every Zone currently stores only what the visitor *answered*. This records
 * what they did on the way to answering: which clues they looked at, in what
 * order, which ones they went back to, and where the pauses fell. The answer is
 * one data point; the approach to it is a different one, and the Final Report
 * has nothing to say about hesitation unless the hesitation was written down.
 *
 * ── Raw and derived are kept apart ─────────────────────────────────────────
 *
 * What is stored is an append-only list of events and nothing else. Every
 * figure the report reads — dwell times, revisit counts, decision gaps — is
 * computed from that list by `summarizeScene`, and every pattern is computed
 * from the summary by `detectPatterns`. Nothing is accumulated as it happens.
 *
 * That matters because interpretation changes and recorded facts do not. If the
 * definition of a revisit is revised, or a pattern turns out to need a different
 * threshold, the new rule can be applied to visits that have already happened.
 * Had the counters been incremented live, every past visit would be stuck with
 * the definition that was in force on the day.
 *
 * ── Groups ─────────────────────────────────────────────────────────────────
 *
 * A Zone usually asks more than one question — LIGHT asks for an image and then
 * for a feeling — so events are filed under a named `group`, each with its own
 * timeline and its own selection mode. This is the part that carries over: a
 * Zone is described by naming its groups, not by writing another tracker.
 */
import type {
  BehaviorEvent,
  BehaviorSelectionMode,
  PlayStopReason,
  PositionGesture,
  SceneBehaviorRecord,
  SceneId,
  StrokeEndReason,
  StrokeRemoveReason,
  TrackedPositionPoint,
  TrackedStrokePoint,
} from '../types';

/**
 * Views shorter than this are discarded rather than recorded.
 *
 * A grid of clues means the pointer crosses cells it was never looking at — on
 * the way to somewhere else, or through a corner. Without a floor, those
 * crossings land in the view path and the revisit counts, and the record then
 * describes the shortest route across the grid rather than the visitor's
 * attention. A fifth of a second is longer than a traversal and shorter than a
 * glance.
 */
export const MIN_VIEW_MS = 180;

/**
 * Two views of the same target this close together are treated as one.
 *
 * Leaving a cell and re-entering it immediately is one look interrupted, not
 * two looks — most often the pointer has clipped a gap or a label. Merging them
 * keeps `RETURN_LOOP` measuring genuine returns instead of unsteady hands.
 */
export const MERGE_GAP_MS = 400;

/**
 * Playback starting this far in or less counts as starting from the top.
 *
 * Pausing and carrying on is one listen; starting the clip over is a second
 * one. The distinction is drawn from the playhead, and a playhead that has
 * just been reset does not always read exactly zero — so a small tolerance,
 * far below anything audible, keeps a fresh listen from being filed as a
 * resume and losing its replay.
 */
const RESUME_EPSILON_MS = 250;

/**
 * How far the pointer must travel, in canvas widths, before a point is kept.
 *
 * A pointer reports its position up to a couple of hundred times a second, and
 * a pen more often than a mouse — keeping every report would make the record a
 * description of the input hardware, and a long one. Sampling by distance
 * rather than by time keeps the shape of a mark at whatever speed it was made:
 * a slow, careful line and a fast one leave the same path.
 *
 * Roughly one percent of the canvas. Fine enough for where a mark sits and how
 * far it reaches, which is all anything downstream asks of it.
 */
const SAMPLE_MIN_DISTANCE = 0.012;

/**
 * …and a ceiling on the gap between kept points, for the pointer that stops
 * without lifting.
 *
 * Resting mid-stroke is holding still, not moving slowly, and distance alone
 * would record nothing at all until the hand set off again — leaving a pause
 * inside a mark indistinguishable from a straight fast line across it.
 */
const SAMPLE_MAX_INTERVAL_MS = 200;

/**
 * The same two rules for dragging a point around a field.
 *
 * Separate from the stroke pair because the two gestures are not the same
 * size. A drawing stroke crosses the canvas; positioning is one point being
 * nudged, often within a small part of the field, and the movement worth
 * keeping is finer. A hundredth of the field is well under what anyone means
 * to express by moving the point, and well over the tremor of holding still.
 *
 * Exported so POSITION_THRESHOLDS can carry them without a second copy — they
 * are tunable, and everything tunable about positioning should be readable in
 * one place even when it is enforced here.
 */
export const POSITION_SAMPLE_MIN_DISTANCE = 0.01;
export const POSITION_SAMPLE_MAX_INTERVAL_MS = 200;

export interface SceneTracker {
  /** Marks a question as now being in front of the visitor. */
  openGroup(group: string): void;
  /**
   * A "look" is the pointer resting on a target, or the target holding
   * keyboard focus — never eye/gaze tracking. Nothing in this file reads a
   * camera; naming and comments throughout should keep that distinction
   * clear so a `view` is never mistaken for literal gaze data.
   */
  viewStart(group: string, targetId: string): void;
  viewEnd(group: string, targetId: string): void;
  select(group: string, targetId: string): void;
  deselect(group: string, targetId: string): void;
  /**
   * Records whatever changed between the current selection and `targetIds`.
   *
   * For multi-select questions this is the honest way in: the scene owns rules
   * about how many may be held at once and which gets dropped, and restating
   * those rules here would mean two copies that can disagree. The scene says
   * what the selection now is; the diff works out what that implies.
   */
  setSelection(group: string, targetIds: string[]): void;
  /**
   * The Zone's proceed control became usable. Recorded once; calling it again
   * is ignored, so the scene can hand it the same condition every render.
   */
  advanceReady(): void;
  /**
   * Playback of `targetId` began, `positionMs` into the clip.
   *
   * The scene reports the playhead rather than a flag because "did this start
   * from the top" is the whole difference between listening again and picking
   * up where a pause left off, and only the audio element knows.
   */
  playStart(group: string, targetId: string, positionMs: number): void;
  /**
   * Playback stopped. `fromMs`/`toMs` are the playhead at either end.
   *
   * Ignored unless it matches the sound `playStart` last opened, so a stray
   * `pause` event — browsers fire one on `ended`, and one more when the
   * element is torn down — cannot write a second stretch of listening or a
   * second completion.
   */
  playStop(
    group: string,
    targetId: string,
    stop: { fromMs: number; toMs: number; durationMs: number; reason: PlayStopReason },
  ): void;
  /**
   * The pointer went down and a mark began.
   *
   * Coordinates are normalized to the canvas (0–1 on each axis) by the scene,
   * so nothing recorded here depends on the size of the drawing surface or the
   * screen it was drawn on.
   */
  strokeStart(
    group: string,
    strokeId: string,
    point: { x: number; y: number },
    meta: { tool: string; color: string; pointerType: string },
  ): void;
  /**
   * The pointer moved while drawing. Sampled — see SAMPLE_MIN_DISTANCE.
   *
   * The scene reports every move it receives and lets the sampler decide what
   * is worth keeping, rather than thinning the stream itself: how much detail
   * a behavioural record needs is a question about the record, and the answer
   * should be in one place and changeable there.
   */
  strokePoint(group: string, point: { x: number; y: number }): void;
  /**
   * The mark ended. `discarded` says whether it reached the canvas — a tap too
   * short to be a line does not, and neither does a stroke still in progress
   * when the Zone is left.
   */
  strokeEnd(group: string, end: { discarded: boolean; reason: StrokeEndReason }): void;
  /** Marks were taken back. */
  removeStrokes(group: string, strokeIds: string[], reason: StrokeRemoveReason): void;
  /** The brush changed. Recorded whole rather than as a diff. */
  toolChange(group: string, next: { tool: string; color: string }): void;
  /**
   * A gesture on a two-dimensional field began.
   *
   * `gesture` says whether this one brings the point into existence. Where the
   * point was before is not passed in — the tracker already knows, from the
   * last gesture it recorded, and asking the scene to remember it too would be
   * two copies of one fact.
   */
  positionStart(
    group: string,
    point: { x: number; y: number },
    meta: { gesture: PositionGesture; pointerType: string },
  ): void;
  /** The point moved. Sampled — see POSITION_SAMPLE_MIN_DISTANCE. */
  positionMove(group: string, point: { x: number; y: number }): void;
  /** The gesture ended, wherever the point had got to. */
  positionEnd(group: string, end: { reason: StrokeEndReason }): void;
  /**
   * A fragment was put into the sentence at `index`.
   *
   * An operation, not a new state: what the sentence now reads is replayed
   * from the log rather than written down again here.
   */
  fragmentAdd(group: string, fragmentId: string, index: number): void;
  /** A fragment was taken out of the sentence, from `index`. */
  fragmentRemove(group: string, fragmentId: string, index: number): void;
  /**
   * A fragment already in the sentence moved.
   *
   * Ignored when it did not actually move. A drag that ends where it started
   * is a drag that failed, or a mind unchanged, and either way the order is
   * the same afterwards as before — recording it would put a revision in the
   * log that nobody made.
   */
  fragmentReorder(group: string, fragmentId: string, fromIndex: number, toIndex: number): void;
  /** The visitor moved on from this question. */
  commit(group: string): void;
  /** The events so far, safe to persist. */
  snapshot(): SceneBehaviorRecord;
}

export function createSceneTracker(
  sceneId: SceneId,
  groupModes: Record<string, BehaviorSelectionMode>,
  now: () => number = Date.now,
): SceneTracker {
  const sceneEnteredAt = now();
  const events: BehaviorEvent[] = [];

  // The view currently under the pointer, if any. Held here rather than written
  // as a `viewStart` event so the log never contains a look that has no end —
  // a pointer can leave the window, and the scene can unmount mid-hover.
  let openView: { group: string; targetId: string; startedAt: number } | null = null;
  // Where the last recorded view landed in `events`, so a resumed look can be
  // folded back into it instead of appearing as a return.
  let lastView: { group: string; targetId: string; endedAt: number; index: number } | null = null;
  // The sound currently playing, if any. Held so a `playStop` can be matched
  // against the `playStart` it belongs to and duplicates dropped — an audio
  // element fires `pause` on its way to `ended`, and again when it is torn
  // down, and neither is a second stretch of listening.
  let openPlay: { group: string; targetId: string } | null = null;
  // The mark currently being drawn. Held rather than written on the way down,
  // for the same reason as the two above: a stroke that has begun is not yet a
  // fact about the drawing, and the Zone can be left in the middle of one.
  let openStroke: {
    group: string;
    strokeId: string;
    startedAt: number;
    tool: string;
    color: string;
    pointerType: string;
    points: TrackedStrokePoint[];
    rawPointCount: number;
    // The latest reported position that sampling did not keep. Held back so
    // that where the pointer actually lifted is never lost to the sampler —
    // the end of a mark is one of the few points that always matters.
    pending: TrackedStrokePoint | null;
  } | null = null;
  // The gesture currently moving a point around a field, and — outside it —
  // where that point was left. The tracker keeps the point's position because
  // every gesture after the first is a move *from* somewhere, and that
  // somewhere is a fact about the log rather than about the scene's state.
  let openPosition: {
    group: string;
    startedAt: number;
    gesture: PositionGesture;
    pointerType: string;
    from: { x: number; y: number } | null;
    path: TrackedPositionPoint[];
    rawPointCount: number;
    pending: TrackedPositionPoint | null;
  } | null = null;
  let lastPosition: { x: number; y: number } | null = null;

  function closeOpenView(at: number) {
    if (!openView) return;
    const { group, targetId, startedAt } = openView;
    openView = null;
    const durationMs = at - startedAt;
    if (durationMs < MIN_VIEW_MS) return;

    if (
      lastView &&
      lastView.group === group &&
      lastView.targetId === targetId &&
      // Measured from when the look *resumed*, not when it ended. Comparing
      // ends folds the resumed look's own duration into the gap, so a long
      // second look never merges however briefly the pointer slipped away.
      startedAt - lastView.endedAt <= MERGE_GAP_MS
    ) {
      const previous = events[lastView.index];
      if (previous.type === 'view') {
        previous.durationMs += durationMs;
        lastView.endedAt = at;
        return;
      }
    }

    events.push({ type: 'view', at: startedAt, group, targetId, durationMs });
    lastView = { group, targetId, endedAt: at, index: events.length - 1 };
  }

  function closeOpenStroke(end: { discarded: boolean; reason: StrokeEndReason }) {
    if (!openStroke) return;
    const stroke = openStroke;
    openStroke = null;
    // Where the pointer lifted, if sampling had not yet kept it.
    if (stroke.pending) stroke.points.push(stroke.pending);
    events.push({
      type: 'stroke',
      at: now(),
      group: stroke.group,
      strokeId: stroke.strokeId,
      startedAt: stroke.startedAt,
      tool: stroke.tool,
      color: stroke.color,
      pointerType: stroke.pointerType,
      points: stroke.points,
      rawPointCount: stroke.rawPointCount,
      discarded: end.discarded,
      endReason: end.reason,
    });
  }

  function closeOpenPosition(end: { reason: StrokeEndReason }) {
    if (!openPosition) return;
    const gesture = openPosition;
    openPosition = null;
    // Where the pointer let go, if sampling had not yet kept it. For a point
    // being placed this is the whole answer, so it is never dropped.
    if (gesture.pending) gesture.path.push(gesture.pending);
    const to = gesture.path[gesture.path.length - 1];
    lastPosition = { x: to.x, y: to.y };
    events.push({
      type: 'position',
      at: now(),
      group: gesture.group,
      startedAt: gesture.startedAt,
      gesture: gesture.gesture,
      from: gesture.from,
      to: { x: to.x, y: to.y },
      path: gesture.path,
      rawPointCount: gesture.rawPointCount,
      pointerType: gesture.pointerType,
      endReason: end.reason,
    });
  }

  /** Replays the log to find what is currently held for a group. */
  function currentSelection(group: string): string[] {
    const mode = groupModes[group] ?? 'single';
    const held: string[] = [];
    for (const event of events) {
      if (event.type === 'select' && event.group === group) {
        if (mode === 'single') {
          held.length = 0;
          held.push(event.targetId);
        } else if (!held.includes(event.targetId)) {
          held.push(event.targetId);
        }
      } else if (event.type === 'deselect' && event.group === group) {
        const at = held.indexOf(event.targetId);
        if (at !== -1) held.splice(at, 1);
      }
    }
    return held;
  }

  events.push({ type: 'sceneEnter', at: sceneEnteredAt });

  return {
    openGroup(group) {
      if (events.some((event) => event.type === 'groupOpen' && event.group === group)) return;
      events.push({ type: 'groupOpen', at: now(), group });
    },

    viewStart(group, targetId) {
      const at = now();
      // Defensive: a missed pointerleave would otherwise leave the previous look
      // open and charge it every second until the next one ends.
      closeOpenView(at);
      openView = { group, targetId, startedAt: at };
    },

    viewEnd(group, targetId) {
      if (!openView || openView.group !== group || openView.targetId !== targetId) return;
      closeOpenView(now());
    },

    select(group, targetId) {
      events.push({ type: 'select', at: now(), group, targetId });
    },

    deselect(group, targetId) {
      events.push({ type: 'deselect', at: now(), group, targetId });
    },

    setSelection(group, targetIds) {
      const at = now();
      const held = currentSelection(group);
      for (const targetId of held) {
        if (!targetIds.includes(targetId)) {
          events.push({ type: 'deselect', at, group, targetId });
        }
      }
      for (const targetId of targetIds) {
        if (!held.includes(targetId)) {
          events.push({ type: 'select', at, group, targetId });
        }
      }
    },

    advanceReady() {
      if (events.some((event) => event.type === 'advanceReady')) return;
      events.push({ type: 'advanceReady', at: now() });
    },

    playStart(group, targetId, positionMs) {
      openPlay = { group, targetId };
      events.push({
        type: 'playStart',
        at: now(),
        group,
        targetId,
        positionMs,
        /*
          A resume is playback picking up where it stopped. The tolerance is
          for audio elements that report a playhead a few ms shy of zero after
          a reset — without it, a fresh listen occasionally reads as a resume,
          which would quietly cost it a replay.
        */
        resumed: positionMs > RESUME_EPSILON_MS,
      });
    },

    playStop(group, targetId, stop) {
      if (!openPlay || openPlay.group !== group || openPlay.targetId !== targetId) return;
      openPlay = null;
      events.push({
        type: 'play',
        at: now(),
        group,
        targetId,
        fromMs: stop.fromMs,
        toMs: stop.toMs,
        // Clamped: a playhead can tick past the reported duration on the last
        // frame, and negative time is not a thing that can be listened to.
        listenedMs: Math.max(0, stop.toMs - stop.fromMs),
        durationMs: stop.durationMs,
        reason: stop.reason,
      });
    },

    strokeStart(group, strokeId, point, meta) {
      // Defensive: a pointer can be cancelled by the system without ever
      // lifting, and the mark it was making would otherwise stay open and
      // absorb the next one.
      if (openStroke) closeOpenStroke({ discarded: true, reason: 'interrupted' });
      openStroke = {
        group,
        strokeId,
        startedAt: now(),
        tool: meta.tool,
        color: meta.color,
        pointerType: meta.pointerType,
        points: [{ x: point.x, y: point.y, t: 0 }],
        rawPointCount: 1,
        pending: null,
      };
    },

    strokePoint(group, point) {
      if (!openStroke || openStroke.group !== group) return;
      const t = now() - openStroke.startedAt;
      openStroke.rawPointCount += 1;

      const last = openStroke.points[openStroke.points.length - 1];
      const movedFar = Math.hypot(point.x - last.x, point.y - last.y) >= SAMPLE_MIN_DISTANCE;
      const waitedLong = t - last.t >= SAMPLE_MAX_INTERVAL_MS;

      if (movedFar || waitedLong) {
        openStroke.points.push({ x: point.x, y: point.y, t });
        openStroke.pending = null;
        return;
      }
      openStroke.pending = { x: point.x, y: point.y, t };
    },

    strokeEnd(group, end) {
      if (!openStroke || openStroke.group !== group) return;
      closeOpenStroke(end);
    },

    removeStrokes(group, strokeIds, reason) {
      if (strokeIds.length === 0) return;
      events.push({ type: 'strokeRemove', at: now(), group, strokeIds, reason });
    },

    toolChange(group, next) {
      events.push({ type: 'toolChange', at: now(), group, tool: next.tool, color: next.color });
    },

    positionStart(group, point, meta) {
      // Defensive, as with strokes: a pointer can be taken away without ever
      // coming up, and the gesture it was making would otherwise stay open.
      if (openPosition) closeOpenPosition({ reason: 'interrupted' });
      openPosition = {
        group,
        startedAt: now(),
        gesture: meta.gesture,
        pointerType: meta.pointerType,
        from: lastPosition,
        path: [{ x: point.x, y: point.y, t: 0 }],
        rawPointCount: 1,
        pending: null,
      };
    },

    positionMove(group, point) {
      if (!openPosition || openPosition.group !== group) return;
      const t = now() - openPosition.startedAt;
      openPosition.rawPointCount += 1;

      const last = openPosition.path[openPosition.path.length - 1];
      const movedFar =
        Math.hypot(point.x - last.x, point.y - last.y) >= POSITION_SAMPLE_MIN_DISTANCE;
      const waitedLong = t - last.t >= POSITION_SAMPLE_MAX_INTERVAL_MS;

      if (movedFar || waitedLong) {
        openPosition.path.push({ x: point.x, y: point.y, t });
        openPosition.pending = null;
        return;
      }
      openPosition.pending = { x: point.x, y: point.y, t };
    },

    positionEnd(group, end) {
      if (!openPosition || openPosition.group !== group) return;
      closeOpenPosition(end);
    },

    fragmentAdd(group, fragmentId, index) {
      events.push({ type: 'fragmentAdd', at: now(), group, fragmentId, index });
    },

    fragmentRemove(group, fragmentId, index) {
      events.push({ type: 'fragmentRemove', at: now(), group, fragmentId, index });
    },

    fragmentReorder(group, fragmentId, fromIndex, toIndex) {
      if (fromIndex === toIndex) return;
      events.push({ type: 'fragmentReorder', at: now(), group, fragmentId, fromIndex, toIndex });
    },

    commit(group) {
      const at = now();
      closeOpenView(at);
      events.push({ type: 'commit', at, group });
    },

    snapshot() {
      closeOpenView(now());
      return { sceneId, sceneEnteredAt, groupModes, events: events.map((event) => ({ ...event })) };
    },
  };
}

/* ── Derived layer ───────────────────────────────────────────────────────── */

export interface GroupSummary {
  group: string;
  mode: BehaviorSelectionMode;
  /** When this question was first put in front of the visitor. */
  openedAt: number | null;
  /** Total time spent looking at each target, in ms. */
  dwellMsByTarget: Record<string, number>;
  /** Every look in order, repeats included. */
  viewPath: string[];
  /** Distinct targets, in the order each was first looked at. */
  viewedTargets: string[];
  viewCountByTarget: Record<string, number>;
  /** Looks after the first, per target. Zero means seen once and not returned to. */
  revisitCountByTarget: Record<string, number>;
  longestViewedTargetId: string | null;
  firstSelectedId: string | null;
  finalSelectedIds: string[];
  /**
   * Every selection made, in order, repeats included. For a single-select
   * group this traces how the answer moved between targets — e.g. picking
   * IMAGE_03, changing to IMAGE_07, then settling back on IMAGE_03 reads as
   * `['IMAGE_03', 'IMAGE_07', 'IMAGE_03']`, distinct from `finalSelectedIds`,
   * which only holds where it ended up.
   */
  selectionPath: string[];
  /** Distinct targets ever selected, regardless of where the selection ended. */
  uniqueSelectionCount: number;
  /** How many times a selection was made at all. */
  selectionCount: number;
  /** Changes of mind: every selection after the first one. */
  selectionChangeCount: number;
  /** Scene entry → first selection. The spec's "Scene 진입 → 최초 선택". */
  msFromSceneEnterToFirstSelection: number | null;
  /** Question appearing → first selection, which excludes time on the Zone card. */
  msFromGroupOpenToFirstSelection: number | null;
  /** Last selection → moving on. The spec's "최종 선택 → NEXT 클릭". */
  msFromFinalSelectionToCommit: number | null;
  committedAt: number | null;
}

export interface SceneBehaviorSummary {
  sceneId: SceneId;
  sceneEnteredAt: number;
  groups: Record<string, GroupSummary>;
  /**
   * When the Zone's proceed control first became usable, if it said so.
   *
   * Null for Zones that never emit it, which is every Zone that has not been
   * given a reason to — the figures that do not depend on it are unchanged
   * either way.
   */
  advanceReadyAt: number | null;
  eventCount: number;
}

function emptyGroup(group: string, mode: BehaviorSelectionMode): GroupSummary {
  return {
    group,
    mode,
    openedAt: null,
    dwellMsByTarget: {},
    viewPath: [],
    viewedTargets: [],
    viewCountByTarget: {},
    revisitCountByTarget: {},
    longestViewedTargetId: null,
    firstSelectedId: null,
    finalSelectedIds: [],
    selectionPath: [],
    uniqueSelectionCount: 0,
    selectionCount: 0,
    selectionChangeCount: 0,
    msFromSceneEnterToFirstSelection: null,
    msFromGroupOpenToFirstSelection: null,
    msFromFinalSelectionToCommit: null,
    committedAt: null,
  };
}

/**
 * Replays a record into figures.
 *
 * Pure, and deliberately so: the Final Report can call this on a visit recorded
 * weeks ago and get whatever the current definitions say, and a test can call it
 * on a hand-written event list without a browser anywhere in sight.
 */
export function summarizeScene(record: SceneBehaviorRecord): SceneBehaviorSummary {
  const groups: Record<string, GroupSummary> = {};
  // Tracked outside the summary because the last one wins and only the final
  // value is wanted, not a running column in the output.
  const lastSelectionAt: Record<string, number> = {};
  let advanceReadyAt: number | null = null;

  function groupFor(name: string): GroupSummary {
    if (!groups[name]) groups[name] = emptyGroup(name, record.groupModes[name] ?? 'single');
    return groups[name];
  }

  for (const event of record.events) {
    if (event.type === 'sceneEnter') continue;
    if (event.type === 'advanceReady') {
      advanceReadyAt = event.at;
      continue;
    }
    /*
      Playback and drawing belong to a question the same way a look does, but
      what can be asked of them is different enough — a ratio of a clip heard
      has no meaning for an image, and neither has a bounding box — that each
      is summarised separately: summarizeSound in src/lib/soundTracking.ts,
      summarizeMemory in src/lib/memoryTracking.ts. Naming the group is still
      worth it here: it keeps every reading of a Zone reading the same log.
    */
    if (
      event.type === 'playStart' ||
      event.type === 'play' ||
      event.type === 'stroke' ||
      event.type === 'strokeRemove' ||
      event.type === 'toolChange' ||
      event.type === 'position' ||
      event.type === 'fragmentAdd' ||
      event.type === 'fragmentRemove' ||
      event.type === 'fragmentReorder'
    ) {
      groupFor(event.group);
      continue;
    }
    const summary = groupFor(event.group);

    switch (event.type) {
      case 'groupOpen':
        summary.openedAt = event.at;
        break;

      case 'view': {
        const { targetId, durationMs } = event;
        summary.dwellMsByTarget[targetId] = (summary.dwellMsByTarget[targetId] ?? 0) + durationMs;
        summary.viewPath.push(targetId);
        summary.viewCountByTarget[targetId] = (summary.viewCountByTarget[targetId] ?? 0) + 1;
        summary.revisitCountByTarget[targetId] = summary.viewCountByTarget[targetId] - 1;
        if (!summary.viewedTargets.includes(targetId)) summary.viewedTargets.push(targetId);
        break;
      }

      case 'select': {
        const { targetId } = event;
        if (summary.firstSelectedId === null) {
          summary.firstSelectedId = targetId;
          summary.msFromSceneEnterToFirstSelection = event.at - record.sceneEnteredAt;
          if (summary.openedAt !== null) {
            summary.msFromGroupOpenToFirstSelection = event.at - summary.openedAt;
          }
        }
        summary.selectionPath.push(targetId);
        summary.selectionCount += 1;
        if (summary.mode === 'single') {
          summary.finalSelectedIds = [targetId];
        } else if (!summary.finalSelectedIds.includes(targetId)) {
          summary.finalSelectedIds.push(targetId);
        }
        lastSelectionAt[event.group] = event.at;
        break;
      }

      case 'deselect': {
        const at = summary.finalSelectedIds.indexOf(event.targetId);
        if (at !== -1) summary.finalSelectedIds.splice(at, 1);
        /*
          A deselect is a change of mind too, but it is not a *selection*, so it
          moves the change counter without moving the selection counter. Picking
          one image and then picking another is one change; picking two feelings
          and dropping one is also one change.
        */
        summary.selectionChangeCount += 1;
        lastSelectionAt[event.group] = event.at;
        break;
      }

      case 'commit':
        summary.committedAt = event.at;
        break;
    }
  }

  for (const summary of Object.values(groups)) {
    // Every selection after the first is a change of mind. Deselects have
    // already been counted above.
    summary.selectionChangeCount += Math.max(0, summary.selectionCount - 1);
    summary.uniqueSelectionCount = new Set(summary.selectionPath).size;

    let longest: string | null = null;
    let longestMs = -1;
    for (const [targetId, ms] of Object.entries(summary.dwellMsByTarget)) {
      if (ms > longestMs) {
        longestMs = ms;
        longest = targetId;
      }
    }
    summary.longestViewedTargetId = longest;

    const finalAt = lastSelectionAt[summary.group];
    if (finalAt !== undefined && summary.committedAt !== null) {
      summary.msFromFinalSelectionToCommit = summary.committedAt - finalAt;
    }
  }

  return {
    sceneId: record.sceneId,
    sceneEnteredAt: record.sceneEnteredAt,
    groups,
    advanceReadyAt,
    eventCount: record.events.length,
  };
}
