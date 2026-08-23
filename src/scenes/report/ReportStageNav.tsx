import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TerminalCorners } from '../../components/TerminalCorners';

interface ReportStageNavProps {
  label: string;
  index: number;
  total: number;
  visible: boolean;
  onAdvance: () => void;
  disabled?: boolean;
}

/**
 * The one recurring control across REPORT 01–06 — deliberately not the same
 * button every time. Each stage passes its own `label`, so the exhibition
 * reads as one record replacing another rather than an onboarding slider's
 * repeated "Next". `visible` is driven by each stage's own
 * `useStageReveal`, so the control only appears once that stage's reveal has
 * settled; `disabled` is the transition lock `FinalReportScene` holds while
 * the next stage is still fading in.
 */
export function ReportStageNav({ label, index, total, visible, onAdvance, disabled }: ReportStageNavProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="report-stage-nav"
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
          transition={{ duration: prefersReducedMotion ? 0.12 : 0.6 }}
        >
          <span className="report-stage-nav__index" aria-hidden="true">
            {String(index).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
          <button className="report-stage-nav__cta" onClick={onAdvance} disabled={disabled}>
            <TerminalCorners />
            <span>{label}</span>
            <span aria-hidden="true">→</span>
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
