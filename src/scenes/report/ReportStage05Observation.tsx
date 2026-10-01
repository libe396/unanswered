import { actionEvidenceText, buildActionEvidence, PROCESS_GUIDE } from '../../lib/reportActionEvidence';
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

/** Each component and its sentence hold this long before the next appears. */
const STEP_MS = 2600;
/** How long the four take to gather into one layered mass. */
const GATHER_MS = 2400;

const TRACE_ORDER: SceneId[] = ['lightArchive', 'soundClues', 'sentenceClues', 'memorySketch'];
/** Where each card settles in the gathered stack — a slight offset and turn,
 *  so the four read as layers of one record rather than a single card. */
const STACK_OFFSET: Record<string, { x: number; y: number; rotate: number }> = {
  lightArchive: { x: -18, y: -14, rotate: -5 },
  soundClues: { x: 16, y: -8, rotate: 4 },
  sentenceClues: { x: -10, y: 12, rotate: 2 },
  memorySketch: { x: 14, y: 16, rotate: -2 },
};

export function ReportStage05Observation({ record, report, findings, index, total, locked, onAdvance }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const behavior = useExperienceStore((state) => state.behavior);
  const evidence = buildActionEvidence(record, behavior);
  const hasProcess = evidence.some((item) => item.kind !== 'selection');
  // One small sentence per component: this visit's process evidence for that
  // scene when there is one, otherwise the plain recorded choice.
  const caption = (sceneId: SceneId): string => {
    const found = evidence.find((item) => item.sceneId === sceneId && item.text);
    if (found) return found.text;
    if (sceneId === 'lightArchive') return record.light ? '이 빛을 골랐습니다.' : '고른 빛이 없습니다.';
    if (sceneId === 'soundClues') return (record.soundClues.selectedSoundId && actionEvidenceText('selection', 'soundClues', record.soundClues.selectedSoundId)) || '고른 소리가 없습니다.';
    if (sceneId === 'sentenceClues') return (record.sentenceClues.selectedSentenceIds[0] && actionEvidenceText('selection', 'sentenceClues', record.sentenceClues.selectedSentenceIds[0])) || '고른 문장이 없습니다.';
    return (record.memorySketch.selectedObjects[0] && actionEvidenceText('selection', 'memorySketch', record.memorySketch.selectedObjects[0])) || '고른 물건이 없습니다.';
  };
  const closingLine = hasProcess ? PROCESS_GUIDE.replace(', ', ',\n') : '이번 기록에서 확인할 수 있는\n선택입니다.';
  // 0–3: components appear one by one · 4: they gather · 5: the closing line.
  const GATHER_PHASE = TRACE_ORDER.length;
  const FINAL_PHASE = GATHER_PHASE + 1;
  const [phase, setPhase] = useState(prefersReducedMotion ? FINAL_PHASE : 0);
  const gathered = phase >= GATHER_PHASE;
  const hasReturn = findings.some((finding) => finding.kind === 'return' || finding.kind === 'replay');
  const hasHold = findings.some(
    (finding) => finding.kind === 'hesitation' || finding.kind === 'dwell' || finding.kind === 'revision',
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase(FINAL_PHASE);
      return;
    }

    setPhase(0);
    const timers = [
      ...TRACE_ORDER.slice(1).map((_, i) => window.setTimeout(() => setPhase(i + 1), (i + 1) * STEP_MS)),
      window.setTimeout(() => setPhase(GATHER_PHASE), TRACE_ORDER.length * STEP_MS),
      window.setTimeout(() => setPhase(FINAL_PHASE), TRACE_ORDER.length * STEP_MS + GATHER_MS),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [prefersReducedMotion, GATHER_PHASE, FINAL_PHASE]);

  const revealed = useStageReveal(prefersReducedMotion ? 260 : TRACE_ORDER.length * STEP_MS + GATHER_MS + 2400);
  const motionTransition = (seconds: number) => ({ duration: prefersReducedMotion ? 0 : seconds, ease: [0.22, 1, 0.36, 1] as const });

  return (
    <div className="report-stage report-stage-05">
      <p className="report-stage__eyebrow report-stage-05__label">
        <span className="report-stage__eyebrow-code">REPORT {String(index).padStart(2, '0')}</span>
        <span className="report-stage__eyebrow-sep" aria-hidden="true">·</span>
        <span className="report-stage__eyebrow-title">선택의 과정</span>
      </p>

      <div className={`report-stage-05__composition${gathered ? ' report-stage-05__composition--gathered' : ''}`}>
        <motion.div
          className="report-stage-05__record-core"
          aria-hidden="true"
          initial={false}
          animate={{ opacity: gathered ? 1 : 0, scale: gathered ? 1 : 0.92 }}
          transition={motionTransition(1.6)}
        >
          {hasReturn ? <b className="report-stage-05__marker report-stage-05__marker--return">RETURN</b> : null}
          {hasHold ? <b className="report-stage-05__marker report-stage-05__marker--hold">HOLD</b> : null}
        </motion.div>
        {TRACE_ORDER.map((sceneId, order) => {
          const offset = STACK_OFFSET[sceneId];
          return (
            <motion.figure
              key={sceneId}
              layout={!prefersReducedMotion}
              className="report-stage-05__trace"
              style={{ zIndex: order + 1 }}
              initial={false}
              animate={{
                opacity: phase >= order ? 1 : 0,
                y: gathered ? offset.y : phase >= order ? 0 : 14,
                x: gathered ? offset.x : 0,
                rotate: gathered ? offset.rotate : 0,
              }}
              transition={{ ...motionTransition(gathered ? GATHER_MS / 1000 : 1), layout: motionTransition(GATHER_MS / 1000) }}
            >
              <ReportEvidenceVisual sceneId={sceneId} record={record} report={report} mode="converge" />
              <motion.figcaption
                className="report-stage-05__caption"
                initial={false}
                animate={{ opacity: gathered ? 0 : 1 }}
                transition={motionTransition(gathered ? 0.6 : 1)}
              >
                {caption(sceneId)}
              </motion.figcaption>
            </motion.figure>
          );
        })}
      </div>

      <div className="report-stage-05__copy-frame">
        <AnimatePresence>
          {phase >= FINAL_PHASE ? (
            <motion.p key="closing" className="report-stage-05__line"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: prefersReducedMotion ? .1 : .8 }}>
              {closingLine}
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
