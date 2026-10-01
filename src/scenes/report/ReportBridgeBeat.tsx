import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import './ReportBridgeBeat.css';

/**
 * The turn between the two layers of the report: what was chosen (the
 * person's record) and what was left while choosing (the visitor's).
 * Shown exactly once, before whichever of REPORT return / hesitation /
 * memory comes first. Full screen, text only, a click moves on.
 */
export function ReportBridgeBeat({ onContinue }: { onContinue: () => void }) {
  const reduced = useReducedMotion();
  const d = (full: number) => (reduced ? 0 : full);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div
      ref={ref}
      className="report-bridge"
      role="button"
      tabIndex={0}
      aria-label="계속"
      onClick={onContinue}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onContinue();
        }
      }}
    >
      <motion.p
        className="report-bridge__line"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: d(0.9) }}
      >
        당신은 누군가를 떠올리며 골랐을지도 모릅니다.
      </motion.p>
      <motion.p
        className="report-bridge__line report-bridge__line--turn"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: d(0.9), delay: d(2.2) }}
      >
        그런데 이 보고서에는
        <br />
        고르는 동안 남은 기록이 하나 더 있습니다.
      </motion.p>
      <motion.span
        className="report-bridge__hint"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: d(0.8), delay: d(4) }}
      >
        클릭하여 계속
      </motion.span>
    </div>
  );
}
