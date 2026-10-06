import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { openChoiceGroups, playingTargets, useActivitySignal } from '../store/activitySignal';
import type { SceneId } from '../types';
import './HesitationNudge.css';

const NUDGE_SCENES: ReadonlySet<SceneId> = new Set<SceneId>([
  'lightArchive',
  'soundClues',
  'memorySketch',
  'sentenceClues',
]);
const IDLE_MS = 30000;
const VISIBLE_MS = 4000;

/**
 * Once per choice Zone: after 30s without input while a choice is still open,
 * a quiet line at the bottom centre. Display only — it records nothing.
 */
export function HesitationNudge({ scene }: { scene: SceneId }) {
  const reduced = useReducedMotion();
  const lastInputAt = useActivitySignal((s) => s.lastInputAt);
  const alreadyNudged = useActivitySignal((s) => s.nudged.includes(scene));
  const mountedAt = useRef(performance.now());
  const [visible, setVisible] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!NUDGE_SCENES.has(scene) || alreadyNudged) return;
    const since = Math.max(lastInputAt, mountedAt.current);
    const wait = Math.max(0, since + IDLE_MS - performance.now());
    const timer = window.setTimeout(() => {
      const open = (openChoiceGroups.get(scene)?.size ?? 0) > 0;
      const listening = (playingTargets.get(scene)?.size ?? 0) > 0;
      // Not in a choice, or a sound is still playing: look again later.
      if (!open || listening) {
        setRetry((n) => n + 1);
        return;
      }
      useActivitySignal.getState().markNudged(scene);
      setVisible(true);
    }, retry > 0 && wait === 0 ? 1000 : wait);
    return () => window.clearTimeout(timer);
  }, [scene, alreadyNudged, lastInputAt, retry]);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.p
          className="hesitation-nudge"
          role="status"
          initial={{ opacity: reduced ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: reduced ? 1 : 0, transition: { duration: reduced ? 0 : 0.8 } }}
          transition={{ duration: reduced ? 0 : 0.8 }}
        >
          천천히 살펴보세요.
          <br />
          정답을 맞힐 필요는 없습니다.
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}
