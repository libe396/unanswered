/**
 * Binds a scene tracker to a React scene.
 *
 * The whole point of the split is that a Zone's component keeps saying what the
 * visitor did — looked here, chose that, moved on — and never has to hold a
 * timer, a counter or a previous value. Everything below is bookkeeping so the
 * scene's own code reads as a description of the interaction.
 *
 * The tracker is created once per mount and the returned handle is stable, so
 * these can be dropped straight into JSX without giving anything a new identity
 * on every render.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInteractionClock } from './useInteractionClock';
import { createSceneTracker, MIN_VIEW_MS, summarizeScene } from '../lib/behaviorTracking';
import type { SceneTracker } from '../lib/behaviorTracking';
import { detectScenePatterns } from '../lib/behaviorPatterns';
import { useExperienceStore } from '../store/experienceStore';
import { openChoiceGroups, playingTargets, useActivitySignal } from '../store/activitySignal';
import { SOUND_THRESHOLDS } from '../lib/soundThresholds';
import type { BehaviorSelectionMode, SceneBehaviorRecord, SceneId } from '../types';

/**
 * How a Zone wants its own record read back.
 *
 * A look and a listen do not answer the same questions, so the default reading
 * — dwell times, view paths — says nothing useful about a Zone made of audio.
 * A Zone that summarises itself differently passes its own reader here, and the
 * console shows that instead. Zones that do not pass one are unaffected.
 */
export type TrackingDebugView = (record: SceneBehaviorRecord) => unknown;

export interface SceneTrackingOptions {
  debugView?: TrackingDebugView;
}

export interface SceneTracking extends SceneTracker {
  /**
   * Writes the record to the store.
   *
   * Called on each `commit` as well, so a visitor who leaves half way through
   * still leaves the part they finished behind. Calling it again is harmless —
   * the record replaces the previous one for this scene.
   */
  save(): void;
}

/**
 * Exposed on `window` in development only, and never rendered.
 *
 * A behavioural record is invisible by nature: nothing about the interface
 * changes when it is working, so without a way to read it back the only way to
 * know it is recording is to trust that it is. This is that way.
 */
interface TrackingDebugApi {
  (): unknown;
  record: () => unknown;
}

declare global {
  interface Window {
    __unansweredTracking?: Record<string, TrackingDebugApi>;
  }
}

export function useSceneTracking(
  sceneId: SceneId,
  groupModes: Record<string, BehaviorSelectionMode>,
  options: SceneTrackingOptions = {},
): SceneTracking {
  const interactionNow = useInteractionClock();
  const setSceneBehavior = useExperienceStore((s) => s.setSceneBehavior);

  // Group modes are written inline at the call site, so a fresh object arrives
  // every render. The tracker must not be rebuilt for that — it holds the log.
  const modesRef = useRef(groupModes);
  // Same reasoning, and one more: the debug effect must not tear down and
  // re-register every render just because a closure changed identity.
  const debugViewRef = useRef(options.debugView);
  debugViewRef.current = options.debugView;
  const trackerRef = useRef<SceneTracker | null>(null);
  if (trackerRef.current === null) {
    trackerRef.current = createSceneTracker(sceneId, modesRef.current, interactionNow);
  }

  // Held in state, not created inside the memo: StrictMode runs the memo twice
  // and keeps one result, so sets made there could be the discarded copy.
  // Registered from an effect so the map always holds the committed sets.
  const [signalSets] = useState(() => ({ openGroups: new Set<string>(), playing: new Set<string>() }));
  useEffect(() => {
    openChoiceGroups.set(sceneId, signalSets.openGroups);
    playingTargets.set(sceneId, signalSets.playing);
    return () => {
      if (openChoiceGroups.get(sceneId) === signalSets.openGroups) openChoiceGroups.delete(sceneId);
      if (playingTargets.get(sceneId) === signalSets.playing) playingTargets.delete(sceneId);
    };
  }, [sceneId, signalSets]);

  const tracking = useMemo<SceneTracking>(() => {
    const tracker = trackerRef.current!;
    const save = () => setSceneBehavior(tracker.snapshot());

    /*
      Display-only signals for the hesitation nudge and the HUD's "기록 중"
      mark. They sit beside the tracker calls, never inside them: nothing here
      writes to the event log or the saved record.
    */
    const signal = useActivitySignal.getState();
    const { openGroups, playing } = signalSets;
    const selections = new Map<string, Set<string>>();
    const viewed = new Set<string>();
    const viewStarts = new Map<string, number>();
    const revisitTimers = new Map<string, number>();
    const listened = new Map<string, number>();
    const playFrom = new Map<string, number>();
    let lastInput = 0;
    const input = () => {
      const now = performance.now();
      if (now - lastInput < 250) return;
      lastInput = now;
      signal.input();
    };

    return {
      openGroup: (group) => {
        tracker.openGroup(group);
        openGroups.add(group);
        signal.input();
      },
      viewStart: (group, targetId) => {
        tracker.viewStart(group, targetId);
        input();
        const key = `${group}:${targetId}`;
        viewStarts.set(key, performance.now());
        // Back on something already looked at, and staying: a revisit.
        if (viewed.has(key) && !revisitTimers.has(key)) {
          revisitTimers.set(key, window.setTimeout(() => {
            revisitTimers.delete(key);
            signal.pulse();
          }, 600));
        }
      },
      viewEnd: (group, targetId) => {
        tracker.viewEnd(group, targetId);
        const key = `${group}:${targetId}`;
        const timer = revisitTimers.get(key);
        if (timer !== undefined) {
          window.clearTimeout(timer);
          revisitTimers.delete(key);
        }
        const startedAt = viewStarts.get(key);
        if (startedAt !== undefined && performance.now() - startedAt >= MIN_VIEW_MS) viewed.add(key);
        viewStarts.delete(key);
      },
      select: (group, targetId) => {
        tracker.select(group, targetId);
        input();
      },
      deselect: (group, targetId) => {
        tracker.deselect(group, targetId);
        input();
        signal.pulse();
      },
      setSelection: (group, targetIds) => {
        tracker.setSelection(group, targetIds);
        input();
        const previous = selections.get(group) ?? new Set<string>();
        if ([...previous].some((id) => !targetIds.includes(id))) signal.pulse();
        selections.set(group, new Set(targetIds));
      },
      advanceReady: () => tracker.advanceReady(),
      playStart: (group, targetId, positionMs) => {
        tracker.playStart(group, targetId, positionMs);
        input();
        playing.add(targetId);
        playFrom.set(targetId, performance.now());
        // From the top, after having already heard a fair amount: listening again.
        if (positionMs < 250 && (listened.get(targetId) ?? 0) >= SOUND_THRESHOLDS.replayMinPriorListenMs) {
          signal.pulse();
        }
      },
      playStop: (group, targetId, stop) => {
        tracker.playStop(group, targetId, stop);
        signal.input();
        playing.delete(targetId);
        const startedAt = playFrom.get(targetId);
        if (startedAt !== undefined) {
          listened.set(targetId, (listened.get(targetId) ?? 0) + (performance.now() - startedAt));
          playFrom.delete(targetId);
        }
      },
      strokeStart: (group, strokeId, point, meta) => {
        tracker.strokeStart(group, strokeId, point, meta);
        input();
      },
      strokePoint: (group, point) => {
        tracker.strokePoint(group, point);
        input();
      },
      strokeEnd: (group, end) => {
        tracker.strokeEnd(group, end);
        input();
      },
      removeStrokes: (group, strokeIds, reason) => {
        tracker.removeStrokes(group, strokeIds, reason);
        input();
      },
      toolChange: (group, next) => {
        tracker.toolChange(group, next);
        input();
      },
      positionStart: (group, point, meta) => {
        tracker.positionStart(group, point, meta);
        input();
      },
      positionMove: (group, point) => {
        tracker.positionMove(group, point);
        input();
      },
      positionEnd: (group, end) => {
        tracker.positionEnd(group, end);
        input();
      },
      fragmentAdd: (group, fragmentId, index) => {
        tracker.fragmentAdd(group, fragmentId, index);
        input();
      },
      fragmentRemove: (group, fragmentId, index) => {
        tracker.fragmentRemove(group, fragmentId, index);
        input();
        signal.pulse();
      },
      fragmentReorder: (group, fragmentId, fromIndex, toIndex) => {
        tracker.fragmentReorder(group, fragmentId, fromIndex, toIndex);
        input();
      },
      commit: (group) => {
        tracker.commit(group);
        openGroups.delete(group);
        signal.input();
        save();
      },
      snapshot: () => tracker.snapshot(),
      save,
    };
    // sceneId is fixed for the life of a Zone's mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSceneBehavior]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const tracker = trackerRef.current!;

    const read = () => {
      const record = tracker.snapshot();
      const debugView = debugViewRef.current;
      if (debugView) return debugView(record);
      const summary = summarizeScene(record);
      return { record, summary, patterns: detectScenePatterns(summary) };
    };
    const api = (() => read()) as TrackingDebugApi;
    api.record = () => tracker.snapshot();

    window.__unansweredTracking = { ...window.__unansweredTracking, [sceneId]: api };
    console.info(
      `[tracking] ${sceneId} recording — read it with window.__unansweredTracking.${sceneId}()`,
    );

    return () => {
      const rest = { ...window.__unansweredTracking };
      delete rest[sceneId];
      window.__unansweredTracking = rest;
    };
  }, [sceneId]);

  return tracking;
}

/**
 * Prints one scene's record as it stands. Development only.
 *
 * Separate from the hook because the useful moment to look is when the visitor
 * leaves the Zone, and that is the scene's call to make, not the hook's.
 */
export function logSceneTracking(
  sceneId: SceneId,
  tracking: SceneTracking,
  view?: TrackingDebugView,
) {
  if (!import.meta.env.DEV) return;
  const record = tracking.snapshot();
  if (view) {
    console.info(`[tracking] ${sceneId} complete`, view(record));
    return;
  }
  const summary = summarizeScene(record);
  console.info(`[tracking] ${sceneId} complete`, {
    summary: summary.groups,
    patterns: detectScenePatterns(summary),
    events: record.events,
  });
}
