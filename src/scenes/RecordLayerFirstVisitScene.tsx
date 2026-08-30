import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useExperienceStore } from '../store/experienceStore';
import './RecordLayerFirstVisitScene.css';

const AUTO_ADVANCE_MS = 900;
const AUTO_ADVANCE_REDUCED_MS = 360;

export function RecordLayerFirstVisitScene() {
  const markRecordLayerFirstVisit = useExperienceStore((s) => s.markRecordLayerFirstVisit);
  const completeScene = useExperienceStore((s) => s.completeScene);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    markRecordLayerFirstVisit();
    const timer = window.setTimeout(
      () => completeScene('recordLayerFirstVisit'),
      prefersReducedMotion ? AUTO_ADVANCE_REDUCED_MS : AUTO_ADVANCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [completeScene, markRecordLayerFirstVisit, prefersReducedMotion]);

  return (
    <div className="record-layer-first-visit">
      <motion.div
        className="record-layer-first-visit__glow record-layer-first-visit__glow--stored"
        animate={prefersReducedMotion ? {} : { opacity: [0.22, 0.32, 0.22] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.p
        className="record-layer-first-visit__line"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: prefersReducedMotion ? 0.12 : 0.42 }}
      >
        기록이 저장되었습니다.
      </motion.p>
      <motion.span
        className="record-layer-first-visit__passing"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.62 }}
        transition={{ duration: prefersReducedMotion ? 0.12 : 0.38, delay: prefersReducedMotion ? 0 : 0.18 }}
      >
        다음 조사 구역으로 이동 중
      </motion.span>
    </div>
  );
}
