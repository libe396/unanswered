import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useExperienceStore } from '../store/experienceStore';
import { MemoryField } from '../components/MemoryField';
import wordmarkUrl from '../assets/wordmark.svg';
import './LandingScene.css';

/** Nothing can enter until the field has actually arrived. Without it, a click
 *  landing during the reveal drops the audience into a room they never saw the
 *  door of — and Elevator Entry opens on near-black, so it reads as a failure. */
const ENTRY_ARMED_AFTER_MS = 2600;
const FIGURE_PROXIMITY_PX = 320;

export function LandingScene() {
  const completeScene = useExperienceStore((s) => s.completeScene);
  const updateLanding = useExperienceStore((s) => s.updateLanding);
  const prefersReducedMotion = useReducedMotion();
  const d = (full: number) => (prefersReducedMotion ? full * 0.3 : full);

  const [entryArmed, setEntryArmed] = useState(false);
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
    completeScene('landing');
    if (import.meta.env.DEV) {
      console.info(`[entry] scene-change:${useExperienceStore.getState().currentScene}`);
    }
  }

  return (
    <div className="landing-scene">
      <div className="landing-scene__room" />

      {/* The mass arrives first and alone — the space introduces its subject
          before it names itself. */}
      <motion.div
        ref={figureWrapRef}
        className="landing-scene__figure"
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: d(2.6), ease: [0.22, 1, 0.36, 1] }}
      >
        <MemoryField onEnter={handleEnter} interactive={entryArmed} />
      </motion.div>

      <div className="landing-scene__mark">
        <motion.img
          className="landing-scene__wordmark"
          src={wordmarkUrl}
          alt="UNANSWERED"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: d(1.6), delay: d(1.4) }}
        />
        <motion.p
          className="landing-scene__subcopy"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: d(1.8), delay: d(2.9) }}
        >
          What remains unanswered?
        </motion.p>
      </div>
    </div>
  );
}
