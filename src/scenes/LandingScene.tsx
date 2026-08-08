import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useExperienceStore } from '../store/experienceStore';
import { HeroFigure } from '../components/HeroFigure';
import wordmarkUrl from '../assets/wordmark.svg';
import scrollUrl from '../assets/scroll.svg';
import './LandingScene.css';

/** Accumulated wheel delta / swipe distance needed to leave. High enough that a
 *  stray trackpad nudge doesn't eject someone still looking at the figure. */
const SCROLL_THRESHOLD_PX = 420;
/** The accumulator decays to nothing if scrolling pauses for this long, so only
 *  one deliberate gesture counts. Without it, idle flicks minutes apart add up
 *  and eventually eject the audience with no gesture that felt like leaving. */
const SCROLL_DECAY_MS = 500;
/** Nothing can advance the scene until the SCROLL_ mark has actually appeared.
 *  Matches the mark's reveal delay + fade in the JSX below. */
const EXIT_ARMED_AFTER_MS = 5000;
const FIGURE_PROXIMITY_PX = 260;

export function LandingScene() {
  const completeScene = useExperienceStore((s) => s.completeScene);
  const updateLanding = useExperienceStore((s) => s.updateLanding);
  const prefersReducedMotion = useReducedMotion();
  const d = (full: number) => (prefersReducedMotion ? full * 0.3 : full);

  const [exitArmed, setExitArmed] = useState(false);
  const figureWrapRef = useRef<HTMLDivElement>(null);
  const mountedAtRef = useRef(0);
  const dwellRef = useRef(0);
  const travelRef = useRef(0);
  const advancedRef = useRef(false);

  // Trace recording. Deliberately separate from HeroFigure's own loop: the
  // figure owns how it *looks*, this owns what the visit *left behind*.
  useEffect(() => {
    mountedAtRef.current = Date.now();
    // Landing is re-entered on every reload, so only the first arrival counts
    // as "when did this person show up" — later passes must not overwrite it.
    if (!useExperienceStore.getState().landing.enteredAt) {
      updateLanding({ enteredAt: mountedAtRef.current });
    }
    const armTimer = window.setTimeout(() => setExitArmed(true), d(EXIT_ARMED_AFTER_MS));

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
        // Time spent close to the figure — how long they tried to resolve it.
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

  // Scroll / swipe / key are all the same gesture as far as the space is
  // concerned: the audience decides to move further in.
  useEffect(() => {
    let accumulated = 0;
    let lastWheelAt = 0;
    let touchStartY: number | null = null;
    const armedAt = mountedAtRef.current + d(EXIT_ARMED_AFTER_MS);

    function advance() {
      // Nothing may leave before the SCROLL_ mark is on screen. Otherwise a
      // flick during the reveal drops the audience into Elevator Entry — which
      // opens on near-black — and it reads as the page having failed to load.
      if (advancedRef.current || Date.now() < armedAt) return;
      advancedRef.current = true;
      updateLanding({
        timeToEnterMs: Date.now() - mountedAtRef.current,
        figureDwellMs: Math.round(dwellRef.current),
        cursorTravelPx: Math.round(travelRef.current),
        bounced: false,
      });
      completeScene('landing');
    }

    function handleWheel(event: WheelEvent) {
      if (event.deltaY <= 0) return;
      const now = Date.now();
      if (now - lastWheelAt > SCROLL_DECAY_MS) accumulated = 0;
      lastWheelAt = now;
      accumulated += event.deltaY;
      if (accumulated >= SCROLL_THRESHOLD_PX) advance();
    }

    function handleTouchStart(event: TouchEvent) {
      touchStartY = event.touches[0]?.clientY ?? null;
    }

    function handleTouchMove(event: TouchEvent) {
      if (touchStartY === null) return;
      const delta = touchStartY - (event.touches[0]?.clientY ?? touchStartY);
      if (delta >= SCROLL_THRESHOLD_PX * 0.5) advance();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (['ArrowDown', 'PageDown', ' ', 'Enter'].includes(event.key)) advance();
    }

    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScrollMarkClick() {
    if (advancedRef.current || !exitArmed) return;
    advancedRef.current = true;
    updateLanding({
      timeToEnterMs: Date.now() - mountedAtRef.current,
      figureDwellMs: Math.round(dwellRef.current),
      cursorTravelPx: Math.round(travelRef.current),
      bounced: false,
    });
    completeScene('landing');
  }

  return (
    <div className="landing-scene">
      <div className="landing-scene__room" />

      {/* The figure arrives first and alone — the space introduces its subject
          before it names itself. */}
      <motion.div
        ref={figureWrapRef}
        className="landing-scene__figure"
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: d(2.6), ease: [0.22, 1, 0.36, 1] }}
      >
        <HeroFigure />
      </motion.div>

      <motion.img
        className="landing-scene__wordmark"
        src={wordmarkUrl}
        alt="UNANSWERED"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: d(1.6), delay: d(1.4) }}
      />

      <motion.button
        type="button"
        className="landing-scene__scroll"
        onClick={handleScrollMarkClick}
        disabled={!exitArmed}
        aria-label="스크롤하여 조사를 시작합니다"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: d(1.4), delay: d(3.6) }}
      >
        <img src={scrollUrl} alt="" />
      </motion.button>
    </div>
  );
}
