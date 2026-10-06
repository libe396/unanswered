import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ReportStageNav } from './ReportStageNav';
import './ReportStageFindings.css';

interface Props {
  index: number;
  total: number;
  locked: boolean;
  onAdvance: () => void;
}

/**
 * The close of the reading — back to the exhibition's own premise rather
 * than to a conclusion about the visitor. The last line stays.
 */
const LINES = [
  '당신이 남긴 것은\n선택한 답만이 아니었습니다.',
  '멈춘 순간, 바꾼 선택,\n끝내 고르지 않은 것까지\n모두 기록으로 남았습니다.',
];
const FINAL_LINE = '답하지 못한 순간도\n당신의 기록이었습니다.';
const HOLDS = [3200, 3800];

export function ReportStageClosing({ index, total, locked, onAdvance }: Props) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const navReady = true;

  useEffect(() => {
    if (phase >= LINES.length) {
      return;
    }
    const timer = window.setTimeout(() => setPhase((p) => p + 1), reduced ? 1200 : HOLDS[phase]);
    return () => window.clearTimeout(timer);
  }, [phase, reduced]);

  return (
    <div className="report-stage report-closing">
      <div className="report-stage__body" aria-live="polite">
        <AnimatePresence mode="wait">
          {phase < LINES.length ? (
            <motion.p key={phase} className="report-method__line"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: reduced ? 0.15 : 0.9 }}>
              {LINES[phase]}
            </motion.p>
          ) : (
            <motion.p key="final" className="report-closing__final"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0.15 : 1.4 }}>
              {FINAL_LINE}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <ReportStageNav label="최종 기록으로" index={index} total={total} visible={navReady} onAdvance={onAdvance} disabled={locked} />
    </div>
  );
}
