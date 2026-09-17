import { useEffect, useRef, useState } from 'react';
import { useExperienceStore } from '../store/experienceStore';
import './InvestigationStartScene.css';

/** How long the screen stays fully black before the CTA begins to appear —
 *  the film has just finished saying what needs to be said; nothing should
 *  rush in behind it. */
const HOLD_BEFORE_CTA_MS = 650;

/** Quick, quiet exit — the CTA is accepted and steps aside, it doesn't
 *  perform leaving. */
const EXIT_FADE_MS = 350;

/**
 * The one deliberate choice between the film and Registration. Intro Film
 * already delivered the premise and the mission in its own closing line, so
 * this Scene repeats none of it — it is a single held black frame with one
 * restrained text CTA, not a menu or a landing page of its own.
 */
export function InvestigationStartScene() {
  const completeScene = useExperienceStore((s) => s.completeScene);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const advancedRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    const id = window.setTimeout(() => setVisible(true), HOLD_BEFORE_CTA_MS);
    timeoutsRef.current.push(id);
    return () => {
      timeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (visible) buttonRef.current?.focus();
  }, [visible]);

  function handleStart() {
    // Guards both a double click and a double Enter/Space before the button's
    // own `disabled` takes effect on the next render.
    if (advancedRef.current) return;
    advancedRef.current = true;
    setExiting(true);
    const id = window.setTimeout(() => completeScene('investigationStart'), EXIT_FADE_MS);
    timeoutsRef.current.push(id);
  }

  const ctaClass = [
    'investigation-start-scene__cta',
    visible ? 'investigation-start-scene__cta--visible' : '',
    exiting ? 'investigation-start-scene__cta--exiting' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="investigation-start-scene">
      <button
        ref={buttonRef}
        type="button"
        className={ctaClass}
        onClick={handleStart}
        disabled={exiting}
      >
        <span>조사 시작하기</span>
        <span className="investigation-start-scene__cta-arrow" aria-hidden="true">
          →
        </span>
      </button>
    </div>
  );
}
