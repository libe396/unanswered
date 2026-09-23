import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { FinalReportPresentation } from '../../lib/finalReportPresentation';
import type { RecordLayerDerived } from '../../types';
import { useStageReveal } from './useStageReveal';
import { FinalReportSummaryReceipt } from './FinalReportSummaryReceipt';
import './FinalRecordLayer.css';

interface Props {
  record: RecordLayerDerived;
  presentation: FinalReportPresentation;
  index: number;
  total: number;
  onIssueFullReport: () => void;
  onRestart: () => void;
}

/**
 * Final Record Layer — the Narrative Flow's last stage.
 *
 * Presents the visit as `FinalReportSummaryReceipt`, an issued document
 * rather than another cinematic beat: the same `presentation` model
 * (src/lib/finalReportPresentation.ts) that `PrintableFullReport` reads,
 * read here only for the receipt's condensed view of it. "전체 조사 기록
 * 발급하기" hands off to `onIssueFullReport` (FinalReportScene.tsx's
 * `window.print()`), which renders `PrintableFullReport` — hidden on screen,
 * shown only under `@media print`.
 */
export function FinalRecordLayer({ record, presentation, index, total, onIssueFullReport, onRestart }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const revealed = useStageReveal(prefersReducedMotion ? 300 : 2400);

  return (
    <div className="final-record-layer">
      <div className="final-record-layer__veil" />

      <p className="final-record-layer__eyebrow">RESPONSE RECORD</p>

      <div className="final-record-layer__narrative">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: prefersReducedMotion ? 0.15 : 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <FinalReportSummaryReceipt record={record} presentation={presentation} onIssueFullReport={onIssueFullReport} />
        </motion.div>

        <AnimatePresence>
          {revealed ? (
            <motion.div
              className="final-record-layer__actions"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: prefersReducedMotion ? 0.15 : 0.7 }}
            >
              <span className="final-record-layer__index" aria-hidden="true">
                {String(index).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>
              <button
                type="button"
                className="cta cta--text final-record-layer__button"
                onClick={onRestart}
              >
                처음으로 돌아가기
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
