import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useExperienceStore } from '../store/experienceStore';
import { MemoryField } from '../components/MemoryField';
import { LandingPortrait } from '../components/LandingPortrait';
import wordmarkUrl from '../assets/wordmark.svg';
import { activateFilmSound } from '../hooks/useFilmSound';
import { isVenueMode } from '../lib/venueMode';
import './LandingScene.css';

// Keep the entry available as soon as the short reveal finishes.
const ENTRY_ARMED_AFTER_MS = 600;
const FIGURE_PROXIMITY_PX = 320;

export function LandingScene() {
  const completeScene = useExperienceStore((s) => s.completeScene);
  const updateLanding = useExperienceStore((s) => s.updateLanding);
  const prefersReducedMotion = useReducedMotion();
  const d = (full: number) => (prefersReducedMotion ? full * 0.3 : full);

  const [entryArmed, setEntryArmed] = useState(false);
  const [fieldActive, setFieldActive] = useState(false);
  const [entryFocused, setEntryFocused] = useState(false);
  const [entering, setEntering] = useState(false);
  // The venue PC stays inside the exhibition; the catalogue link is for the web.
  const [venue] = useState(isVenueMode);
  const startEntryRef = useRef<(() => void) | null>(null);
  const figureWrapRef = useRef<HTMLDivElement>(null);
  const mountedAtRef = useRef(0);
  const dwellRef = useRef(0);
  const travelRef = useRef(0);
  const advancedRef = useRef(false);

  // Trace recording. Deliberately separate from MemoryField's own loop: the
  // field owns how it *looks*, this owns what the visit *left behind*.
  useEffect(() => {
    mountedAtRef.current = Date.now();
    // Landing is re-entered on every reload, so only the first arrival counts
    // as "when did this person show up" — later passes must not overwrite it.
    if (!useExperienceStore.getState().landing.enteredAt) {
      updateLanding({ enteredAt: mountedAtRef.current });
    }
    const armTimer = window.setTimeout(() => setEntryArmed(true), d(ENTRY_ARMED_AFTER_MS));

    let lastPoint: { x: number; y: number } | null = null;
    let lastSampleAt = performance.now();

    function handleMove(event: MouseEvent) {
      const now = performance.now();
      if (lastPoint) {
        travelRef.current += Math.hypot(event.clientX - lastPoint.x, event.clientY - lastPoint.y);
      }
      lastPoint = { x: event.clientX, y: event.clientY };

      const wrap = figureWrapRef.current;
      if (wrap) {
        const rect = wrap.getBoundingClientRect();
        const distance = Math.hypot(
          event.clientX - (rect.left + rect.width / 2),
          event.clientY - (rect.top + rect.height / 2),
        );
        // Time spent close to the mass — how long they stayed with it.
        if (distance < FIGURE_PROXIMITY_PX) {
          dwellRef.current += Math.min(now - lastSampleAt, 200);
        }
      }
      lastSampleAt = now;
    }

    function handleBeforeUnload() {
      if (advancedRef.current) return;
      updateLanding({
        bounced: true,
        figureDwellMs: Math.round(dwellRef.current),
        cursorTravelPx: Math.round(travelRef.current),
      });
    }

    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.clearTimeout(armTimer);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Keep the existing entry timing and recorded traces after the portrait dissolves. */
  function handleEnter() {
    if (advancedRef.current) return;
    advancedRef.current = true;
    updateLanding({
      timeToEnterMs: Date.now() - mountedAtRef.current,
      figureDwellMs: Math.round(dwellRef.current),
      cursorTravelPx: Math.round(travelRef.current),
      bounced: false,
    });
    const advance = () => {
      completeScene('landing');
      if (import.meta.env.DEV) {
        console.info(`[entry] scene-change:${useExperienceStore.getState().currentScene}`);
      }
    };
    advance();
  }

  function handleCollapseStart() {
    activateFilmSound();
    setFieldActive(false);
    setEntering(true);
  }

  function handleFieldHoverChange(hovered: boolean) {
    setFieldActive(hovered);
  }

  const sceneClass = [
    'landing-scene',
    fieldActive || entryFocused ? 'landing-scene--field-active' : '',
    entering ? 'landing-scene--entering' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={sceneClass}>
      <div className="landing-scene__room" />
      <p className="landing-scene__title" inert={entering}>
        <img className="landing-scene__wordmark" src={wordmarkUrl} alt="UNANSWERED" />
      </p>

      {/* The hidden field preserves the existing entry timing and callbacks. */}
      <div className="landing-scene__visual">
      <LandingPortrait entering={entering} subjectRef={figureWrapRef} onEnter={() => { if (entryArmed && !entering) startEntryRef.current?.(); }} />
      <motion.div
        className="landing-scene__figure"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: d(0.6), ease: [0.22, 1, 0.36, 1] }}
      >
        <MemoryField
          startEntryRef={startEntryRef}
          onEnter={handleEnter}
          onCollapseStart={handleCollapseStart}
          onHoverChange={handleFieldHoverChange}
          interactive={entryArmed}
        />
      </motion.div>
      </div>

      <div className="landing-scene__content" inert={entering}>
        <motion.h1
          className="landing-scene__headline"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: d(0.45) }}
        >
          <span>한 사람의 기록이</span>
          <span>발견되었습니다.</span>
        </motion.h1>
        <motion.p
          className="landing-scene__description"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: d(0.45), delay: d(0.12) }}
        >
          <span>남겨진 단서로 그 사람을 떠올려 보세요.</span>
        </motion.p>
        <motion.button
          type="button"
          className="landing-scene__start"
          disabled={!entryArmed || entering}
          onClick={() => startEntryRef.current?.()}
          onPointerEnter={() => setEntryFocused(true)}
          onPointerLeave={() => setEntryFocused(false)}
          onFocus={() => setEntryFocused(true)}
          onBlur={() => setEntryFocused(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: d(0.4), delay: d(0.24) }}
        >
          단서 따라가기 <span aria-hidden="true">↗</span>
        </motion.button>
      </div>
      <p className="landing-scene__visit-time" inert={entering}>약 5분의 온라인 전시</p>

      {/* The venue PC stays inside the exhibition; the catalogue link is for the web. */}
      {!venue && (
        <motion.a
          className="landing-scene__catalog"
          href={`${import.meta.env.BASE_URL}catalog/`}
          inert={entering}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: d(0.4), delay: d(0.36) }}
        >
          전시 소개 <span aria-hidden="true">↗</span>
        </motion.a>
      )}
    </div>
  );
}
