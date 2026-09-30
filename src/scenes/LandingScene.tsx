import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useExperienceStore } from '../store/experienceStore';
import { MemoryField } from '../components/MemoryField';
import wordmarkUrl from '../assets/wordmark.svg';
import { activateFilmSound } from '../hooks/useFilmSound';
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
  const [entering, setEntering] = useState(false);
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

  /** Called once the mass has finished compressing into the line. The elevator
   *  Scene takes the line from here, so this hands over without a beat of its own. */
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
    fieldActive ? 'landing-scene--field-active' : '',
    entering ? 'landing-scene--entering' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={sceneClass}>
      <div className="landing-scene__room" />

      {/* Preserve the particle field and its transition into the elevator. */}
      <motion.div
        ref={figureWrapRef}
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

      <div className="landing-scene__content" inert={entering}>
        <p className="landing-scene__title">
          <img className="landing-scene__wordmark" src={wordmarkUrl} alt="UNANSWERED" />
        </p>
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
          <span>흩어진 색과 문장, 소리 속에서</span>
          <span>이름 없는 사람의 단서를 수집해 주세요.</span>
        </motion.p>
        <motion.button
          type="button"
          className="landing-scene__start"
          disabled={!entryArmed || entering}
          onClick={() => startEntryRef.current?.()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: d(0.4), delay: d(0.24) }}
        >
          조사 시작하기 <span aria-hidden="true">↗</span>
        </motion.button>
      </div>
    </div>
  );
}
