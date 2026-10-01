import { create } from 'zustand';
import type { SceneId } from '../types';
import { useExperienceStore } from './experienceStore';

/**
 * Display-only signals from the Zones' trackers.
 *
 * Nothing here is recorded, saved or read by the report. The hesitation nudge
 * and the HUD's "기록 중" mark read it; the BehaviorEvent log is untouched.
 */
interface ActivitySignalState {
  /** performance.now() of the visitor's last input in a choice Zone. */
  lastInputAt: number;
  /** performance.now() of the last deselect / replay / revisit, 0 if none. */
  pulseAt: number;
  /** Zones that have already shown their one nudge this visit. */
  nudged: SceneId[];
  input(): void;
  pulse(): void;
  markNudged(scene: SceneId): void;
}

export const useActivitySignal = create<ActivitySignalState>((set, get) => ({
  lastInputAt: 0,
  pulseAt: 0,
  nudged: [],
  input: () => set({ lastInputAt: performance.now() }),
  pulse: () => {
    const now = performance.now();
    // One flash at a time; a burst of removals reads as one moment.
    if (now - get().pulseAt < 800) return;
    set({ pulseAt: now });
  },
  markNudged: (scene) => set((state) => ({ nudged: [...state.nudged, scene] })),
}));

/**
 * Which choice groups are open, and which sounds are playing, per Zone.
 * Plain maps rather than store state: only read when the nudge timer fires,
 * so they never need to re-render anything.
 */
export const openChoiceGroups = new Map<SceneId, Set<string>>();
export const playingTargets = new Map<SceneId, Set<string>>();

// A new visit gets its nudges back.
useExperienceStore.subscribe((state, previous) => {
  if (state.visitId !== previous.visitId) useActivitySignal.setState({ nudged: [], pulseAt: 0 });
});
