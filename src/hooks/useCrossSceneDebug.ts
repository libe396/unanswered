/**
 * Exposes Cross-Scene Behavioral Analysis — and the Report Engine built on
 * top of it — on `window`, development only.
 *
 * Every other Zone's debug entry (see useSceneTracking.ts) reads one live
 * tracker while its own Zone is mounted. This one is different in kind: a
 * Cross-Scene Finding needs more than one Zone's record at once, and by the
 * time a visitor has answers in more than one Zone, only one of them is ever
 * still mounted. So this reads the persisted records the store already keeps
 * — `behavior`, one per Zone that has been instrumented — rather than a
 * tracker in scope, and is mounted once for the whole app instead of once
 * per Zone.
 *
 * The `state.behavior` → `CrossSceneInput` translation itself lives in
 * src/lib/crossSceneAdapter.ts now, shared with src/lib/reportStageFacts.ts
 * (the Final Report's production consumer of the same Cross-Scene engine) —
 * this hook's only remaining job is reaching into the store and handing the
 * result to `window`, which is still the one thing src/lib/crossSceneAnalysis.ts
 * itself never does — see its module doc. src/lib/reportEngine.ts keeps the
 * same promise one stage further on: `report()` below is the only place that
 * hands it a `Date.now()`, and buildReportModel itself never calls one.
 */
import { useEffect } from 'react';
import { useExperienceStore } from '../store/experienceStore';
import { buildCrossSceneInput } from '../lib/crossSceneAdapter';
import { buildCrossSceneReport } from '../lib/crossSceneAnalysis';
import { buildReportModel } from '../lib/reportEngine';

/**
 * Registers `window.__unansweredTracking.crossScene()` and `.report()`.
 * Mount once, near the app root — see src/components/SceneController.tsx.
 */
export function useCrossSceneDebug(): void {
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const record = () => buildCrossSceneInput(useExperienceStore.getState().behavior);

    function crossSceneApi() {
      return buildCrossSceneReport(record());
    }
    crossSceneApi.record = record;

    /*
      buildReportModel is pure and never stamps its own generatedAt — see
      reportEngine.ts. Passing Date.now() is this call site's job alone;
      it happens here and nowhere inside the engine, so the model a test
      builds from a fixed CrossSceneReport stays byte-identical across runs.
    */
    function reportApi() {
      return buildReportModel(buildCrossSceneReport(record()), { generatedAt: Date.now() });
    }
    reportApi.record = record;

    window.__unansweredTracking = {
      ...window.__unansweredTracking,
      crossScene: crossSceneApi,
      report: reportApi,
    };
    console.info(
      '[tracking] cross-scene analysis available — read it with window.__unansweredTracking.crossScene()',
    );
    console.info('[tracking] report model available — read it with window.__unansweredTracking.report()');

    return () => {
      const rest = { ...window.__unansweredTracking };
      delete rest.crossScene;
      delete rest.report;
      window.__unansweredTracking = rest;
    };
  }, []);
}
