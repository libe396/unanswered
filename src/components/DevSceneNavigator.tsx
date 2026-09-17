import { useState } from 'react';
import { SCENE_ORDER, useExperienceStore } from '../store/experienceStore';
import { ZONE_INFO } from '../data/zones';
import { MOCK_EXPERIENCE_PATCH } from '../dev/mockExperienceData';
import type { SceneId } from '../types';
import './DevSceneNavigator.css';

/**
 * Dev-only Scene jump list — the exhibition otherwise only reaches a Scene
 * by finishing the one before it, which makes checking a single Zone's
 * design a full replay from Landing every time. Lists `SCENE_ORDER` itself
 * (src/store/experienceStore.ts), through the same `ZONE_INFO` labels
 * ZoneLabel already shows, so this can never list a Scene the real app
 * doesn't have or name it something the real app doesn't call it.
 *
 * Every entry but Final Report backfills `completedScenes` up to the target
 * (see jumpTo) and jumps straight there. Final Report expands into two:
 * "Final Report Sequence" (the real entry point — mounts FinalReportScene at
 * its own first stage, 'clues', same as a real visit) and "Summary Receipt"
 * (a shortcut that mounts it already on its *last* stage, 'archive' — the
 * screen that renders `FinalReportSummaryReceipt`). Both additionally seed
 * the store with `MOCK_EXPERIENCE_PATCH` (src/dev/mockExperienceData.ts) —
 * real-shaped answer data, injected the same way a real visit's Zones would
 * (`setLightArchive` etc. use the exact same fields), since Final Report is
 * the one Scene that reads that data back out rather than just needing
 * `completedScenes` to look finished. The shortcut additionally sets
 * `devFinalReportEntryStage: 'summary'` (experienceStore.ts), the one signal
 * FinalReportScene.tsx reads to pick its *initial* stage index — no second
 * receipt component exists anywhere; both entries mount the exact same
 * `FinalRecordLayer`/`FinalReportSummaryReceipt` production tree, just
 * starting at a different point in the same sequence.
 *
 * Rendered only under `import.meta.env.DEV`, exactly like DevSceneNav.tsx —
 * never reachable in the shipped exhibition build.
 */
export function DevSceneNavigator() {
  const [open, setOpen] = useState(false);
  const currentScene = useExperienceStore((s) => s.currentScene);

  if (!import.meta.env.DEV) return null;

  function seedMockFinalReport(entryStage: 'sequence' | 'summary') {
    const finalReportIndex = SCENE_ORDER.indexOf('finalReport');
    useExperienceStore.setState({
      ...MOCK_EXPERIENCE_PATCH,
      completedScenes: SCENE_ORDER.slice(0, finalReportIndex),
      currentScene: 'finalReport',
      devFinalReportEntryStage: entryStage,
    });
    setOpen(false);
  }

  function jumpTo(id: SceneId) {
    if (id === 'finalReport') {
      seedMockFinalReport('sequence');
      return;
    }
    // A plain `goToScene` only moves the currentScene pointer — it leaves
    // completedScenes empty, so the first completeScene() call a jumped-to
    // Scene makes finds every earlier Scene "incomplete" and snaps back to
    // Landing (getFurthestAllowedScene in experienceStore.ts). Backfilling
    // completedScenes up to (not including) the target keeps that guard
    // happy: the target Scene still reads as the furthest reached, so its
    // own completeScene() advances to the next Scene exactly as it would on
    // a real playthrough.
    const targetIndex = SCENE_ORDER.indexOf(id);
    useExperienceStore.setState({
      completedScenes: SCENE_ORDER.slice(0, targetIndex),
      currentScene: id,
    });
    setOpen(false);
  }

  return (
    <div className="dev-scene-navigator">
      <button
        type="button"
        className="dev-scene-navigator__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        DEV
      </button>

      {open ? (
        <div className="dev-scene-navigator__panel">
          {SCENE_ORDER.map((id) =>
            id === 'finalReport' ? (
              <div key={id} className="dev-scene-navigator__group">
                <span className="dev-scene-navigator__group-label">
                  {ZONE_INFO[id].zone} · {ZONE_INFO[id].label}
                </span>
                <button
                  type="button"
                  className={`dev-scene-navigator__item dev-scene-navigator__item--sub${
                    id === currentScene ? ' dev-scene-navigator__item--active' : ''
                  }`}
                  onClick={() => jumpTo(id)}
                >
                  <span className="dev-scene-navigator__item-label">Final Report Sequence</span>
                </button>
                <button
                  type="button"
                  className="dev-scene-navigator__item dev-scene-navigator__item--sub"
                  onClick={() => seedMockFinalReport('summary')}
                >
                  <span className="dev-scene-navigator__item-label">Summary Receipt</span>
                </button>
              </div>
            ) : (
              <button
                key={id}
                type="button"
                className={`dev-scene-navigator__item${id === currentScene ? ' dev-scene-navigator__item--active' : ''}`}
                onClick={() => jumpTo(id)}
              >
                <span className="dev-scene-navigator__item-zone">{ZONE_INFO[id].zone}</span>
                <span className="dev-scene-navigator__item-label">{ZONE_INFO[id].label}</span>
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
