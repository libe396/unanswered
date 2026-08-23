import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useExperienceStore } from '../store/experienceStore';
import { TerminalCorners } from '../components/TerminalCorners';
import { TraceLedger } from '../components/TraceLedger';
import './RecordLayerFirstVisitScene.css';

export function RecordLayerFirstVisitScene() {
  const markRecordLayerFirstVisit = useExperienceStore((s) => s.markRecordLayerFirstVisit);
  const completeScene = useExperienceStore((s) => s.completeScene);
  const prefersReducedMotion = useReducedMotion();
  const [canContinue, setCanContinue] = useState(false);

  useEffect(() => {
    markRecordLayerFirstVisit();
  }, [markRecordLayerFirstVisit]);

  useEffect(() => {
    const timer = window.setTimeout(() => setCanContinue(true), prefersReducedMotion ? 700 : 1500);
    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion]);

  return (
    <div className="record-layer-first-visit">
      <motion.div
        className={`record-layer-first-visit__glow${
          canContinue ? ' record-layer-first-visit__glow--stored' : ''
        }`}
        animate={prefersReducedMotion ? {} : { opacity: canContinue ? [0.26, 0.34, 0.26] : [0.16, 0.22, 0.16] }}
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
        disabled={!canContinue}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: prefersReducedMotion ? 0.45 : 1.25 }}
      >
        <TerminalCorners />
        <span>다음 기록 조사</span>
        <span aria-hidden="true">→</span>
      </motion.button>
    </div>
  );
}
