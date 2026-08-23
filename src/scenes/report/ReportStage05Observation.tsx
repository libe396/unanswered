import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReportFinding } from '../../lib/reportStageFacts';
import type { RecordLayerDerived, ReportData, SceneId } from '../../types';
import { useStageReveal } from './useStageReveal';
import { ReportStageNav } from './ReportStageNav';
import { ReportEvidenceVisual } from './ReportEvidenceVisual';
import './ReportStage05Observation.css';

interface Props {
  record: RecordLayerDerived;
  report: ReportData;
  findings: ReportFinding[];
  index: number;
  total: number;
  locked: boolean;
  onAdvance: () => void;
}

const TRACE_LAYOUT: Array<{ sceneId: SceneId; x: number; y: number; delay: number }> = [
  { sceneId: 'lightArchive', x: -250, y: -120, delay: 0 },
  { sceneId: 'soundClues', x: 240, y: -88, delay: 0.25 },
  { sceneId: 'sentenceClues', x: -220, y: 132, delay: 0.5 },
  { sceneId: 'memorySketch', x: 230, y: 124, delay: 0.75 },
];

function buildConvergenceCopy(findings: readonly ReportFinding[], record: RecordLayerDerived): string {
  const hasReturn = findings.some((finding) => finding.kind === 'return' || finding.kind === 'replay');
  const hasHold = findings.some(
    (finding) => finding.kind === 'hesitation' || finding.kind === 'dwell' || finding.kind === 'revision',
  );
  const memoryClause = findings.some((finding) => finding.kind === 'non_intervention')
    ? '남겨둔 자리도'
    : record.memorySketch.strokes.length > 0
      ? '덧붙인 흔적도'
      : '마지막 방의 흔적도';

  const parts = [
    hasReturn ? '다시 돌아본 순간도' : null,
    hasHold ? '잠시 머물렀던 시간도' : null,
    memoryClause,
  ].filter(Boolean);

  if (parts.length <= 1) return `${memoryClause}\n이번 기록에 함께 있습니다.`;
  return `${parts.join(',\n')}\n함께 있습니다.`;
}

export function ReportStage05Observation({ record, report, findings, index, total, locked, onAdvance }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const finalPhase = 2;
  const [phase, setPhase] = useState(prefersReducedMotion ? finalPhase : 0);
  const convergenceCopy = useMemo(() => buildConvergenceCopy(findings, record), [findings, record]);
  const hasReturn = findings.some((finding) => finding.kind === 'return' || finding.kind === 'replay');
  const hasHold = findings.some(
    (finding) => finding.kind === 'hesitation' || finding.kind === 'dwell' || finding.kind === 'revision',
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase(finalPhase);
      return;
    }

    setPhase(0);
    const timers = [window.setTimeout(() => setPhase(1), 3200), window.setTimeout(() => setPhase(2), 6800)];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [prefersReducedMotion]);

  const revealed = useStageReveal(prefersReducedMotion ? 260 : 10300);

  return (
    <div className="report-stage report-stage-05">
      <p className="report-stage__eyebrow report-stage-05__label">REPORT 05 · 수렴</p>

      <div className="report-stage-05__composition" aria-hidden="true">
        {TRACE_LAYOUT.map((trace) => (
          <motion.div
            key={trace.sceneId}
            className="report-stage-05__trace"
            initial={{ opacity: 0, x: trace.x, y: trace.y, scale: 0.88 }}
            animate={{
              opacity: phase >= 0 ? 1 : 0,
              x: phase >= 2 ? 0 : trace.x,
              y: phase >= 2 ? 0 : trace.y,
              scale: phase >= 2 ? 0.72 : 0.88,
            }}
            transition={{
              duration: prefersReducedMotion ? 0.15 : phase >= 2 ? 2.2 : 1,
              delay: prefersReducedMotion ? 0 : trace.delay,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <ReportEvidenceVisual sceneId={trace.sceneId} record={record} report={report} mode="converge" />
          </motion.div>
        ))}

        <motion.div
          className="report-stage-05__record-core"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: phase >= 2 ? 1 : 0.18, scale: phase >= 2 ? 1 : 0.92 }}
          transition={{ duration: prefersReducedMotion ? 0.15 : 1.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <span />
          <span />
          <span />
          {hasReturn ? <b className="report-stage-05__marker report-stage-05__marker--return">RETURN</b> : null}
          {hasHold ? <b className="report-stage-05__marker report-stage-05__marker--hold">HOLD</b> : null}
        </motion.div>
      </div>

      <div className="report-stage-05__copy-frame">
        <AnimatePresence mode="wait">
          {phase === 0 ? (
            <motion.p
              key="copy-0"
              className="report-stage-05__line"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: prefersReducedMotion ? 0.15 : 0.8 }}
            >
              이 기록에는{'\n'}당신이 고른 것만 남아 있는 게 아닙니다.
            </motion.p>
          ) : null}

          {phase === 1 ? (
            <motion.p
              key="copy-1"
              className="report-stage-05__line"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: prefersReducedMotion ? 0.15 : 0.8 }}
            >
              {convergenceCopy}
            </motion.p>
          ) : null}

          {phase >= finalPhase ? (
            <motion.p
              key="question"
              className="report-stage-05__question"
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: prefersReducedMotion ? 0.15 : 1.1 }}
            >
              그렇다면,{'\n'}이 기록은 누구의 것이었을까요?
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <ReportStageNav
        label="기록 확인"
        index={index}
        total={total}
        visible={revealed}
        onAdvance={onAdvance}
        disabled={locked}
      />
    </div>
  );
}
