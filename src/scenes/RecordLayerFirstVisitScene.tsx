import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useExperienceStore } from '../store/experienceStore';
import { TerminalCorners } from '../components/TerminalCorners';
import { TraceLedger } from '../components/TraceLedger';
import './RecordLayerFirstVisitScene.css';

export function RecordLayerFirstVisitScene() {
  const markRecordLayerFirstVisit = useExperienceStore((s) => s.markRecordLayerFirstVisit);
  const completeScene = useExperienceStore((s) => s.completeScene);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    markRecordLayerFirstVisit();
  }, [markRecordLayerFirstVisit]);

  return (
    <div className="record-layer-first-visit">
      <motion.div
        className="record-layer-first-visit__glow"
        animate={prefersReducedMotion ? {} : { opacity: [0.2, 0.32, 0.2] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.p
        className="record-layer-first-visit__line"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4 }}
      >
        기록이 쌓이는 공간이다.
      </motion.p>
      <TraceLedger />
      <motion.button
        className="record-layer-first-visit__continue"
        onClick={() => completeScene('recordLayerFirstVisit')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: prefersReducedMotion ? 0.6 : 2.1 }}
      >
        <TerminalCorners />
        다음으로
      </motion.button>
    </div>
  );
}
