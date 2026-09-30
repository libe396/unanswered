import { buildActionEvidence, PROCESS_GUIDE } from '../../lib/reportActionEvidence';
import { useExperienceStore } from '../../store/experienceStore';
import { useEffect, useState } from 'react';
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

export function ReportStage05Observation({ record, report, findings, index, total, locked, onAdvance }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const finalPhase = 2;
  const [phase, setPhase] = useState(prefersReducedMotion ? finalPhase : 0);
  const behavior = useExperienceStore((state) => state.behavior);
  const evidence = buildActionEvidence(record, behavior);
  const hasProcess = evidence.some((item) => item.kind !== 'selection');
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
      <p className="report-stage__eyebrow report-stage-05__label">
        <span className="report-stage__eyebrow-code">REPORT {String(index).padStart(2, '0')}</span>
        <span className="report-stage__eyebrow-sep" aria-hidden="true">·</span>
        <span className="report-stage__eyebrow-title">선택의 과정</span>
      </p>

      <div className="report-stage-05__composition" aria-hidden="true">
        {TRACE_LAYOUT.map((trace) => (
          <motion.div
            key={trace.sceneId}
            className="report-stage-05__trace"
            initial={{ opacity: 0, x: trace.x, y: trace.y, scale: 1 }}
            animate={{
              opacity: phase >= 0 ? 1 : 0,
              x: phase >= 2 ? 0 : trace.x,
              y: phase >= 2 ? 0 : trace.y,
              scale: 1,
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
          <motion.div key={phase === 0 ? 'guide' : 'evidence'} className="report-stage-05__facts"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: prefersReducedMotion ? .1 : .8 }}>
            <p>{hasProcess ? PROCESS_GUIDE : '이번 기록에서 확인할 수 있는 선택입니다.'}</p>
            {phase >= 1 && (evidence.length ? <ul>{evidence.map((item) => <li key={item.kind + item.text}>{item.text}</li>)}</ul> : <p>확인할 수 있는 선택 기록이 없습니다.</p>)}
          </motion.div>
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
