import { useEffect, useRef, useState } from 'react';
import { useExperienceStore } from '../store/experienceStore';
import { useCameraPreference } from '../store/cameraPreference';
import { VENUE_IDLE_CONFIRM_MS, VENUE_IDLE_PROMPT_MS } from '../lib/venueMode';
import './VenueIdleGuard.css';

const IDLE_INPUTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/**
 * Venue mode only (mounted by App.tsx under `?venue=1`). A visitor who walks
 * away mid-visit is asked once whether to continue; no answer within
 * VENUE_IDLE_CONFIRM_MS returns to Landing through the same reset as the
 * Final Report's "처음으로 돌아가기".
 *
 * Display-only: lives outside SceneController and every Zone tracker, so
 * neither the prompt nor its button reaches the behaviour log. Landing is
 * already where a reset leads; the Final Report keeps its own 90s reset
 * (FinalRecordLayer.tsx).
 */
export function VenueIdleGuard() {
  const currentScene = useExperienceStore((s) => s.currentScene);
  const active = currentScene !== 'landing' && currentScene !== 'finalReport';
  const [prompting, setPrompting] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!active || prompting) return;
    let timer = window.setTimeout(() => setPrompting(true), VENUE_IDLE_PROMPT_MS);
    const restartTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setPrompting(true), VENUE_IDLE_PROMPT_MS);
    };
    IDLE_INPUTS.forEach((type) => window.addEventListener(type, restartTimer, { capture: true, passive: true }));
    return () => {
      window.clearTimeout(timer);
      IDLE_INPUTS.forEach((type) => window.removeEventListener(type, restartTimer, { capture: true }));
    };
  }, [active, prompting, currentScene]);

  useEffect(() => {
    if (!prompting) return;
    buttonRef.current?.focus();
    const timer = window.setTimeout(() => {
      setPrompting(false);
      useCameraPreference.getState().setEnabled(false);
      useExperienceStore.getState().reset();
    }, VENUE_IDLE_CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [prompting]);

  // A scene change while open (e.g. a film ending) is not an answer, but the
  // prompt must never outlive the scenes it belongs to.
  useEffect(() => {
    if (!active) setPrompting(false);
  }, [active]);

  if (!prompting || !active) return null;

  return (
    <div className="venue-idle" role="alertdialog" aria-modal="true" aria-labelledby="venue-idle-title">
      <div className="venue-idle__panel">
        <p id="venue-idle-title" className="venue-idle__title">계속 조사하시겠습니까?</p>
        <button ref={buttonRef} type="button" className="cta cta--primary" onClick={() => setPrompting(false)}>
          계속하기
        </button>
      </div>
    </div>
  );
}
