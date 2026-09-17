import { SCENE_ORDER, useExperienceStore } from '../store/experienceStore';
import './BackButton.css';

/**
 * Site-wide "이전 기록으로" control — one common component rather than each
 * Scene wiring its own, so Back reads the same everywhere: one step earlier
 * in `SCENE_ORDER` (`goToPreviousScene`, src/store/experienceStore.ts),
 * never a Scene-specific "undo". That action only ever changes
 * `currentScene` — every Zone's already-saved answer is exactly as the
 * visitor left it, so returning to a Scene and leaving it again re-saves
 * what was already there rather than something blank.
 *
 * Hidden on the same Scenes ZoneLabel already hides on (landing has nothing
 * before it; introFilm/investigationStart are cinematic continuations of
 * intro without wayfinding of their own) and hidden at `SCENE_ORDER[0]`
 * regardless, so it never renders as a control with nothing to do.
 */
export function BackButton() {
  const currentScene = useExperienceStore((s) => s.currentScene);
  const goToPreviousScene = useExperienceStore((s) => s.goToPreviousScene);

  if (currentScene === 'landing' || currentScene === 'introFilm' || currentScene === 'investigationStart') {
    return null;
  }
  if (SCENE_ORDER.indexOf(currentScene) <= 0) return null;

  return (
    <button type="button" className="back-button" onClick={goToPreviousScene}>
      <span className="back-button__arrow" aria-hidden="true">
        ←
      </span>
      <span className="back-button__label">
        BACK
        <span className="back-button__label-ko">이전 기록으로</span>
      </span>
    </button>
  );
}
