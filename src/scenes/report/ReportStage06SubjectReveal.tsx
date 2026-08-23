import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  STAGE_06_BEATS,
  STAGE_06_CLOSURE,
  STAGE_06_DETAIL,
  STAGE_06_FINAL_LINE,
  STAGE_06_MEANING,
  STAGE_06_REFRAME,
  STAGE_06_REVEAL,
} from '../../lib/reportFindingCopy';
import { useStageReveal } from './useStageReveal';
import { ReportStageNav } from './ReportStageNav';
import './ReportStage06SubjectReveal.css';

interface Props {
  index: number;
  total: number;
  locked: boolean;
  onAdvance: () => void;
}

type Tone = 'reveal' | 'detail' | 'reframe' | 'closure' | 'final';

/** How long each phase holds before the next replaces it. Setup reads fast;
 *  the longest pause sits right before the reveal; the final line outlasts
 *  everything else, and the CTA only appears well after that (see
 *  `useStageReveal` below) — never at the same moment as the reveal itself. */
const HOLD_MS = [2600, 900, 2800, 2200, 3400, 3200, 3400, 3800, 3800, 1400];
const REDUCED_HOLD_MS = HOLD_MS.map((ms) => Math.round(ms / 7));

const PHASES: Array<{ text: string | null; tone?: Tone }> = [
  { text: STAGE_06_BEATS[0] },
  { text: null },
  { text: STAGE_06_BEATS[1] },
  { text: null },
  { text: STAGE_06_REVEAL, tone: 'reveal' },
  { text: STAGE_06_DETAIL, tone: 'detail' },
  { text: STAGE_06_REFRAME, tone: 'reframe' },
  { text: STAGE_06_MEANING, tone: 'reframe' },
  { text: STAGE_06_CLOSURE, tone: 'closure' },
  { text: null },
  { text: STAGE_06_FINAL_LINE, tone: 'final' },
];
const FINAL_PHASE = PHASES.length - 1;

/**
 * REPORT 06 · Subject Reveal.
 *
 * A fixed narrative sequence, not driven by any Finding — Subject Reveal is
 * data-independent by design (the Data / Finding Audit classified it as
 * "READY, narrative layer" precisely because it doesn't need session data to
 * be true). One line replaces the last rather than accumulating.
 *
 * The reveal ("당신도 기록되고 있었습니다.") is not the ending. Pilot
 * testing showed visitors reading it as "이 결과가 나라는 뜻인가?" — a
 * personality reading the project never makes. So the reveal is followed by
 * a Reframe (this is not a reading of who the visitor is), a Meaning (an
 * improvised choice counts the same as a considered one), and a plain
 * Closure stating the project's own thesis — all read before the one poetic
 * line that actually closes the sequence, so no line is left for the
 * visitor to have to interpret alone.
 */
export function ReportStage06SubjectReveal({ index, total, locked, onAdvance }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const holds = prefersReducedMotion ? REDUCED_HOLD_MS : HOLD_MS;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (phase >= FINAL_PHASE) return;
    const timer = window.setTimeout(() => setPhase((p) => p + 1), holds[phase]);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Reaching the final phase, plus a further hold on it alone — the CTA
  // must never appear at the same moment as the sequence's last line.
  const msToFinalPhase = holds.reduce((sum, ms) => sum + ms, 0);
  const revealed = useStageReveal(msToFinalPhase + (prefersReducedMotion ? 300 : 4600));

  const activePhase = PHASES[phase];
  const isFinal = phase === FINAL_PHASE;

  return (
    <div className="report-stage report-stage-06">
      <p className="report-stage__eyebrow report-stage-06__eyebrow">REPORT 06 · SUBJECT REVEAL</p>

      <div className="report-stage-06__frame">
        <AnimatePresence mode="wait">
          {activePhase.text ? (
            <motion.p
              key={phase}
              className={`report-stage-06__line${
                activePhase.tone ? ` report-stage-06__line--${activePhase.tone}` : ''
              }`}
              initial={{ opacity: 0, filter: 'blur(4px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, filter: 'blur(4px)' }}
              transition={{ duration: prefersReducedMotion ? 0.15 : isFinal ? 1.7 : 1.1 }}
            >
              {activePhase.text}
            </motion.p>
          ) : (
            <motion.span
              key={`blank-${phase}`}
              className="report-stage-06__blank"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0.05 : 0.4 }}
            />
          )}
        </AnimatePresence>
      </div>

      <ReportStageNav
        label="최종 기록으로"
        index={index}
        total={total}
        visible={revealed}
        onAdvance={onAdvance}
        disabled={locked}
      />
    </div>
  );
}
