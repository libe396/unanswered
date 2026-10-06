import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ReportStageNav } from './ReportStageNav';
import './ReportStageFindings.css';

interface Props {
  index: number;
  total: number;
  locked: boolean;
  onAdvance: () => void;
  /** The turn into the Findings — null when this visit has none to show. */
  transitionLine: string | null;
  nextLabel: string;
}

const REFRAME = '누구를 떠올렸든,\n선택의 순간에는 당신이 있었습니다.';
const METHOD = '당신이 고른 단서와\n고르는 순간을 함께 기록했습니다.';
/** What was recorded — the method, not a claim about this visit. */
const RECORDED = ['바꾼 선택', '머문 시간', '비워 둔 자리'];

/** Hold per phase: reframe · method · method with what was recorded. */
const HOLDS = [3600, 2600, RECORDED.length * 650 + 2400];

/**
 * REFRAME → METHOD → the turn into the Findings. Text only, one idea at a
 * time, the same slow single-line rhythm as ReportBridgeBeat.
 */
export function ReportStageMethod({ index, total, locked, onAdvance, transitionLine, nextLabel }: Props) {
  const reduced = useReducedMotion();
  const finalPhase = transitionLine ? 3 : 2;
  const [phase, setPhase] = useState(0);
  const navReady = true;

  useEffect(() => {
    if (phase >= finalPhase) {
      return;
    }
    const timer = window.setTimeout(() => setPhase((p) => p + 1), reduced ? 1200 : HOLDS[phase]);
    return () => window.clearTimeout(timer);
  }, [phase, finalPhase, reduced]);

  const fade = { duration: reduced ? 0.15 : 0.9 };

  return (
    <div className="report-stage report-method">
      <p className="report-stage__eyebrow">
        <span className="report-stage__eyebrow-code">REPORT {String(index).padStart(2, '0')}</span>
        <span className="report-stage__eyebrow-sep" aria-hidden="true">·</span>
        <span className="report-stage__eyebrow-title">조사 방식</span>
      </p>

      <div className="report-stage__body report-method__body" aria-live="polite">
        <AnimatePresence mode="wait">
          {phase === 0 ? (
            <motion.p key="reframe" className="report-method__line"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={fade}>
              {REFRAME}
            </motion.p>
          ) : null}

          {phase === 1 || phase === 2 ? (
            <motion.div key="method" className="report-method__group"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={fade}>
              <p className="report-method__line report-method__line--strong">{METHOD}</p>
              <ul className="report-method__recorded" aria-label="기록한 것">
                {RECORDED.map((item, i) => (
                  <motion.li key={item} initial={{ opacity: 0 }} animate={{ opacity: phase === 2 ? 1 : 0 }}
                    transition={{ duration: reduced ? 0 : 0.8, delay: reduced || phase !== 2 ? 0 : i * 0.65 }}>
                    {item}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ) : null}

          {phase >= 3 && transitionLine ? (
            <motion.p key="turn" className="report-method__line report-method__line--turn"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0.15 : 1.1 }}>
              {transitionLine}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <ReportStageNav label={nextLabel} index={index} total={total} visible={navReady} onAdvance={onAdvance} disabled={locked} />
    </div>
  );
}
