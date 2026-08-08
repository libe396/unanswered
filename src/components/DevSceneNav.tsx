import { useEffect } from 'react';
import { SCENE_ORDER, useExperienceStore } from '../store/experienceStore';

/**
 * Alt+ArrowLeft / Alt+ArrowRight jumps between scenes directly, bypassing the
 * completion guard. Dev-only, active in `import.meta.env.DEV` builds only,
 * and renders nothing — must never surface as visible UI.
 */
export function DevSceneNav() {
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (!event.altKey) return;
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;

      const { currentScene, goToScene } = useExperienceStore.getState();
      const index = SCENE_ORDER.indexOf(currentScene);
      const nextIndex =
        event.key === 'ArrowRight'
          ? Math.min(index + 1, SCENE_ORDER.length - 1)
          : Math.max(index - 1, 0);

      goToScene(SCENE_ORDER[nextIndex]);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return null;
}
