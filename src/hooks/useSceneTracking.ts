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
import { useEffect, useMemo, useRef } from 'react';
import { createSceneTracker, summarizeScene } from '../lib/behaviorTracking';
import type { SceneTracker } from '../lib/behaviorTracking';
import { detectScenePatterns } from '../lib/behaviorPatterns';
import { useExperienceStore } from '../store/experienceStore';
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
    trackerRef.current = createSceneTracker(sceneId, modesRef.current);
  }

  const tracking = useMemo<SceneTracking>(() => {
    const tracker = trackerRef.current!;
    const save = () => setSceneBehavior(tracker.snapshot());

    return {
      openGroup: (group) => tracker.openGroup(group),
      viewStart: (group, targetId) => tracker.viewStart(group, targetId),
      viewEnd: (group, targetId) => tracker.viewEnd(group, targetId),
      select: (group, targetId) => tracker.select(group, targetId),
      deselect: (group, targetId) => tracker.deselect(group, targetId),
      setSelection: (group, targetIds) => tracker.setSelection(group, targetIds),
      advanceReady: () => tracker.advanceReady(),
      playStart: (group, targetId, positionMs) => tracker.playStart(group, targetId, positionMs),
      playStop: (group, targetId, stop) => tracker.playStop(group, targetId, stop),
      strokeStart: (group, strokeId, point, meta) =>
        tracker.strokeStart(group, strokeId, point, meta),
      strokePoint: (group, point) => tracker.strokePoint(group, point),
      strokeEnd: (group, end) => tracker.strokeEnd(group, end),
      removeStrokes: (group, strokeIds, reason) =>
        tracker.removeStrokes(group, strokeIds, reason),
      toolChange: (group, next) => tracker.toolChange(group, next),
      positionStart: (group, point, meta) => tracker.positionStart(group, point, meta),
      positionMove: (group, point) => tracker.positionMove(group, point),
      positionEnd: (group, end) => tracker.positionEnd(group, end),
      fragmentAdd: (group, fragmentId, index) => tracker.fragmentAdd(group, fragmentId, index),
      fragmentRemove: (group, fragmentId, index) =>
        tracker.fragmentRemove(group, fragmentId, index),
      fragmentReorder: (group, fragmentId, fromIndex, toIndex) =>
        tracker.fragmentReorder(group, fragmentId, fromIndex, toIndex),
      commit: (group) => {
        tracker.commit(group);
        save();
      },
      snapshot: () => tracker.snapshot(),
      save,
    };
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
