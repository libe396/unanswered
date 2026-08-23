import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReportFinding } from '../../lib/reportStageFacts';
import type { RecordLayerDerived, ReportData } from '../../types';
import { useStageReveal } from './useStageReveal';
import { ReportStageNav } from './ReportStageNav';
import { ReportEvidenceVisual, evidenceCopy } from './ReportEvidenceVisual';
import './ReportStage03Hesitation.css';

interface Props {
  finding: ReportFinding;
  record: RecordLayerDerived;
  report: ReportData;
  index: number;
  total: number;
  locked: boolean;
  onAdvance: () => void;
}

/**
 * REPORT 03 · 쉽게 지나가지 못한 순간.
 *
 * `finding` is whatever src/lib/reportStageFacts.ts's `pickStage03Highlight`
 * selected — HESITATION (`POST_DECISION_HESITATION`/`POSITION_HESITATION`)
 * first, then an actual REVISION, then a reliability-guarded DWELL reading,
 * then REPLAY/RETURN as a last resort. `finding.kind` is always one of
 * those five here; FinalReportScene.tsx leaves this Stage out of the
 * sequence when none of them found anything, rather than inventing a
 * hesitation that was not observed.
 */
function formatEvidenceTime(finding: ReportFinding): string | null {
  const facts = finding.evidence[0]?.facts ?? {};
  const keys = ['postDecisionMs', 'postDrawingMs', 'postSentenceMs', 'longestPositionPauseMs', 'msToFirstStroke'];
  const value = keys.map((key) => facts[key]).find((fact) => typeof fact === 'number' && fact > 0);
  return typeof value === 'number' ? `${(value / 1000).toFixed(1)} sec` : null;
}

function evidenceLabel(finding: ReportFinding): string {
  if (finding.kind === 'dwell') return 'DWELL TRACE';
  if (finding.kind === 'revision') return 'REVISION TRACE';
  if (finding.kind === 'replay') return 'REPLAY TRACE';
  if (finding.kind === 'return') return 'RETURN TRACE';
  return 'HOLD TRACE';
}

function stage03EvidenceCopy(finding: ReportFinding): string {
  if (finding.kind === 'revision') return '한 번 고른 뒤,\n다시 바꾼 순간이 있었습니다.';
  if (finding.kind === 'replay') return '한 번으로 끝내지 않고\n다시 확인한 순간이 있었습니다.';
  if (finding.kind === 'return') return '한 번 지나친 뒤\n다시 돌아온 순간이 있었습니다.';
  return evidenceCopy(finding.evidence[0]?.sceneId ?? 'lightArchive', 'hold');
}

export function ReportStage03Hesitation({ finding, record, report, index, total, locked, onAdvance }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const finalPhase = 2;
  const [phase, setPhase] = useState(prefersReducedMotion ? finalPhase : 0);
  const evidence = finding.evidence[0];
  const timeLabel = formatEvidenceTime(finding);

  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase(finalPhase);
      return;
    }

    setPhase(0);
    const timers = [
      window.setTimeout(() => setPhase(1), 2200),
      window.setTimeout(() => setPhase(2), 5800),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [prefersReducedMotion]);

  const revealed = useStageReveal(prefersReducedMotion ? 260 : 9000);

  return (
    <div className="report-stage report-stage-03">
      <p className="report-stage__eyebrow">REPORT 03 · 머문 순간</p>

      <div className="report-stage__body report-stage-03__body">
        <AnimatePresence mode="wait">
          {phase === 0 ? (
            <motion.p
              key="opening"
              className="report-stage-03__opening"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: prefersReducedMotion ? 0.15 : 0.75 }}
            >
              어떤 것은 금방 지나갔지만,
            </motion.p>
          ) : null}

          {phase === 1 && evidence ? (
            <motion.div
              key="evidence"
              className="report-stage-03__hold-wrap"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: prefersReducedMotion ? 0.15 : 0.85 }}
            >
              <ReportEvidenceVisual
                sceneId={evidence.sceneId}
                record={record}
                report={report}
                mode="hold"
                label={evidenceLabel(finding)}
              />
              {timeLabel ? <span className="report-stage-03__time-label">{timeLabel}</span> : null}
              <p className="report-stage-03__variant">{stage03EvidenceCopy(finding)}</p>
            </motion.div>
          ) : null}

          {phase >= finalPhase ? (
            <motion.p
              key="closing"
              className="report-stage-03__closing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0.2 : 1.1, ease: [0.22, 1, 0.36, 1] }}
            >
              무엇을 골랐는지만큼,{'\n'}어디에서 멈춰 섰는지도 남았습니다.
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <ReportStageNav
        label="기억의 방으로"
        index={index}
        total={total}
        visible={revealed}
        onAdvance={onAdvance}
        disabled={locked}
      />
    </div>
  );
}
