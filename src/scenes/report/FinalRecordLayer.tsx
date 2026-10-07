import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { VENUE_IDLE_RESET_MS } from '../../lib/venueMode';
import type { FinalReportPresentation } from '../../lib/finalReportPresentation';
import type { RecordLayerDerived } from '../../types';
import { useStageReveal } from './useStageReveal';
import { FinalReportDetail } from './FinalReportDetail';
import type { PersonalFinding } from '../../lib/personalFindingInterpretation';
import { ReportQr } from './ReportQr';
import './FinalRecordLayer.css';

interface Props {
  record: RecordLayerDerived;
  presentation: FinalReportPresentation;
  findings: readonly PersonalFinding[];
  index: number;
  total: number;
  onIssueFullReport: () => void;
  onRestart: () => void;
  reportUrl: string;
  venue: boolean;
}

const VENUE_GUIDE = `QR을 찍어 보고서를 받아 가세요.

입구에서 받은 조사원증 카드에
이름과, 아직 대답하지 못한 것 하나를 적어
벽에 꽂아주세요.
비워두어도 괜찮습니다.`;

const IDLE_INPUTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/** Venue only: the next visitor should find Landing, not this receipt. */
function useVenueIdleReset(enabled: boolean, onRestart: () => void) {
  useEffect(() => {
    if (!enabled) return;
    let timer = window.setTimeout(onRestart, VENUE_IDLE_RESET_MS);
    const restartTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onRestart, VENUE_IDLE_RESET_MS);
    };
    // Capture: the receipt scrolls inside its own container, and scroll does not bubble.
    IDLE_INPUTS.forEach((type) => window.addEventListener(type, restartTimer, { capture: true, passive: true }));
    return () => {
      window.clearTimeout(timer);
      IDLE_INPUTS.forEach((type) => window.removeEventListener(type, restartTimer, { capture: true }));
    };
  }, [enabled, onRestart]);
}

/**
 * Final Record Layer — the Narrative Flow's last stage.
 *
 * Presents the visit as `FinalReportDetail`, an issued document
 * rather than another cinematic beat: the same `presentation` model
 * (src/lib/finalReportPresentation.ts) that `PrintableFullReport` reads,
 * read here only for the receipt's condensed view of it. "전체 조사 기록
 * 발급하기" hands off to `onIssueFullReport` (FinalReportScene.tsx's
 * `window.print()`), which renders `PrintableFullReport` — hidden on screen,
 * shown only under `@media print`.
 */
export function FinalRecordLayer({ record, presentation, findings, index, total, onIssueFullReport, onRestart, reportUrl, venue }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const revealed = useStageReveal(prefersReducedMotion ? 300 : 2400);
  useVenueIdleReset(venue, onRestart);

  return (
    <div className={`final-record-layer${venue ? ' final-record-layer--venue' : ''}`}>
      <div className="final-record-layer__veil" />


      <div className="final-record-layer__narrative">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: prefersReducedMotion ? 0.15 : 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <FinalReportDetail
            record={record}
            presentation={presentation}
            findings={findings}
            onIssueFullReport={onIssueFullReport}
            reportUrl={reportUrl}
            venue={venue}
          />
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
              {/* The venue PC stays inside the exhibition; the catalogue link is for the web. */}
              {!venue ? (
                <a
                  className="cta cta--text final-record-layer__catalog"
                  href={`${import.meta.env.BASE_URL}catalog/`}
                >
                  전시 소개
                </a>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {venue ? (
        <aside className="final-record-layer__venue">
          <motion.div
            className="final-record-layer__venue-body"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.15 : 1, delay: prefersReducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <ReportQr url={reportUrl} size={220} className="final-record-layer__venue-qr" />
            <p className="final-record-layer__venue-scan">폰으로 요약본 받기 / SCAN TO KEEP</p>
            <p className="final-record-layer__venue-guide">{VENUE_GUIDE}</p>
          </motion.div>
        </aside>
      ) : null}
    </div>
  );
}
