import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TerminalCorners } from '../components/TerminalCorners';
import { useExperienceStore } from '../store/experienceStore';
import './IntroScene.css';

const STATUS_LINES = ['신호를 확인하는 중', '미응답 기록 감지됨', '접근 권한이 필요합니다'];

const DUST_PARTICLES = [
  { left: '10%', delay: 0, duration: 16 },
  { left: '24%', delay: 4, duration: 19 },
  { left: '39%', delay: 8, duration: 15 },
  { left: '58%', delay: 2, duration: 21 },
  { left: '74%', delay: 6, duration: 17 },
  { left: '90%', delay: 10, duration: 20 },
];

export function IntroScene() {
  const completeScene = useExperienceStore((s) => s.completeScene);
  const prefersReducedMotion = useReducedMotion();
  const timeScale = prefersReducedMotion ? 0.4 : 1;

  const [statusIndex, setStatusIndex] = useState(0);
  const [panelReady, setPanelReady] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [floor, setFloor] = useState('3');
  const [floorFlicker, setFloorFlicker] = useState(false);
  const [departing, setDeparting] = useState(false);

  const timeoutsRef = useRef<number[]>([]);

  function schedule(fn: () => void, ms: number) {
    timeoutsRef.current.push(window.setTimeout(fn, ms));
  }

  useEffect(() => {
    schedule(() => setStatusIndex(1), 3300 * timeScale);
    schedule(() => setStatusIndex(2), 4600 * timeScale);
    schedule(() => setPanelReady(true), 6400 * timeScale);

    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApprove() {
    // Guards against double-input while the departure sequence is already running.
    if (!panelReady || isApproving) return;
    setIsApproving(true);

    const stillness = 400 * timeScale;
    const doorAt = stillness + 250 * timeScale;
    const leaveAt = doorAt + (prefersReducedMotion ? 500 : 1100) * timeScale;

    schedule(() => {
      setFloorFlicker(true);
      setFloor('B1');
    }, stillness);
    schedule(() => setDeparting(true), doorAt);
    schedule(() => completeScene('intro'), leaveAt);
  }

  const vibrationAnimate = prefersReducedMotion
    ? {}
    : isApproving
      ? { x: [0, 1.4, -1.1, 1.6, -0.8, 0], y: [0, -0.6, 0.5, -0.4, 0.3, 0] }
      : { x: [0, 0.5, -0.4, 0.3, 0], y: [0, -0.3, 0.2, -0.2, 0] };
  const vibrationTransition = prefersReducedMotion
    ? { duration: 0 }
    : isApproving
      ? { duration: 0.5, repeat: 2, ease: 'easeInOut' as const }
      : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' as const };

  return (
    <div className={`intro-scene${departing ? ' intro-scene--departing' : ''}`}>
      <motion.div
        className="intro-scene__stage"
        animate={vibrationAnimate}
        transition={vibrationTransition}
      >
        <motion.div
          className="intro-scene__wall intro-scene__wall--left"
          animate={prefersReducedMotion ? {} : { opacity: [0.55, 0.68, 0.55] }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 9, repeat: Infinity, ease: 'easeInOut' }
          }
        />
        <motion.div
          className="intro-scene__wall intro-scene__wall--right"
          animate={prefersReducedMotion ? {} : { opacity: [0.6, 0.5, 0.6] }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }
          }
        />

        {!prefersReducedMotion
          ? DUST_PARTICLES.map((particle, index) => (
              <motion.span
                key={index}
                className="intro-scene__dust"
                style={{ left: particle.left }}
                animate={{ y: ['0%', '-120%'], opacity: [0, 0.5, 0] }}
                transition={{
                  duration: particle.duration,
                  delay: particle.delay,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            ))
          : null}

        <div className="intro-scene__seam" />
        <div className="intro-scene__vignette" />

        <motion.div
          className="intro-scene__led"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4 * timeScale, delay: 1.8 * timeScale }}
        >
          <span
            className={`intro-scene__led-floor${
              floorFlicker ? ' intro-scene__led-floor--flicker' : ''
            }`}
          >
            {floor}
          </span>
          <span className="intro-scene__led-caption">목적지 미확인</span>
        </motion.div>

        <motion.div
          className="intro-scene__status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 * timeScale, delay: 2.3 * timeScale }}
          aria-live="polite"
        >
          <span className="intro-scene__status-label">STATUS</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={statusIndex}
              className="intro-scene__status-line"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.6 }}
            >
              {STATUS_LINES[statusIndex]}
            </motion.span>
          </AnimatePresence>
        </motion.div>

        <motion.button
          type="button"
          className={`intro-scene__panel${panelReady ? ' intro-scene__panel--ready' : ''}${
            isApproving ? ' intro-scene__panel--approving' : ''
          }`}
          onClick={handleApprove}
          disabled={!panelReady || isApproving}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4 * timeScale, delay: 5.6 * timeScale }}
        >
          <TerminalCorners />
          <span className="intro-scene__panel-label">
            {isApproving ? '접근 승인됨' : '접근 승인'}
          </span>
        </motion.button>
      </motion.div>

      <div className="intro-scene__flash" />
    </div>
  );
}
