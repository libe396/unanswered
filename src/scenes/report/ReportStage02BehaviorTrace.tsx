import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReportFinding } from '../../lib/reportStageFacts';
import type { RecordLayerDerived, ReportData } from '../../types';
import { useStageReveal } from './useStageReveal';
import { ReportStageNav } from './ReportStageNav';
import { ReportEvidenceVisual, evidenceCopy } from './ReportEvidenceVisual';
import './ReportStage02BehaviorTrace.css';

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
 * REPORT 02 · 다시 돌아본 것.
 *
 * `finding` is always a `kind: 'return'` Finding with at least one Scene of
 * evidence — src/lib/reportStageFacts.ts's `pickReturnFinding` returns null
 * when there is nothing to show, and FinalReportScene.tsx leaves this Stage
 * out of the sequence entirely in that case (see its `stageKeys` build),
 * rather than rendering it empty.
 *
 * The point is never *what* was returned to — no content is compared across
 * Scenes here, only whether the same shape of behaviour (leaving something
 * and coming back to it) shows up once or more than once. `finding.evidence`
 * traces back to a named Pattern (`RETURN_LOOP`, `SOUND_RETURN`,
 * `FRAGMENT_RETURN`, `OBJECT_RETURN`, or `RECHECK`'s consecutive-repeat
 * reading) for every line rendered here.
 */
const SETUP_COPY = '그런데 몇몇 흔적은\n한 번으로 끝나지 않았습니다.';
const CLOSING_COPY = '지나친 뒤에도,\n다시 돌아온 것들이 있었습니다.';

export function ReportStage02BehaviorTrace({ finding, record, report, index, total, locked, onAdvance }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const isCrossScene = finding.zoneCount >= 2;
  const evidence = useMemo(() => finding.evidence.slice(0, isCrossScene ? 2 : 1), [finding.evidence, isCrossScene]);
  const finalPhase = evidence.length + 1;
  const [phase, setPhase] = useState(prefersReducedMotion ? finalPhase : 0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase(finalPhase);
      return;
    }

    setPhase(0);
    const holds = [2300, ...evidence.map(() => 3000), 2500];
    let elapsed = 0;
    const timers = holds.slice(0, -1).map((hold, idx) => {
      elapsed += hold;
      return window.setTimeout(() => setPhase(idx + 1), elapsed);
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [evidence, finalPhase, prefersReducedMotion]);

  const revealDelayMs = prefersReducedMotion ? 260 : 2300 + evidence.length * 3000 + 3800;
  const revealed = useStageReveal(revealDelayMs);
  const activeEvidence = evidence[Math.max(0, Math.min(evidence.length - 1, phase - 1))];

  return (
    <div className="report-stage report-stage-02">
      <p className="report-stage__eyebrow">REPORT 02 · 다시 돌아본 것</p>

      <div className="report-stage__body report-stage-02__body">
        <AnimatePresence mode="wait">
          {phase === 0 ? (
            <motion.p
              key="setup"
              className="report-stage-02__line report-stage-02__line--setup"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: prefersReducedMotion ? 0.15 : 0.75 }}
            >
              {SETUP_COPY}
            </motion.p>
          ) : null}

          {phase > 0 && phase <= evidence.length && activeEvidence ? (
            <motion.div
              key={`evidence-${phase}`}
              className="report-stage-02__evidence-wrap"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: prefersReducedMotion ? 0.15 : 0.75 }}
            >
              <ReportEvidenceVisual sceneId={activeEvidence.sceneId} record={record} report={report} mode="return" />
              <span className="report-stage-02__line report-stage-02__line--evidence">
                {evidenceCopy(activeEvidence.sceneId, 'return')}
              </span>
            </motion.div>
          ) : null}

          {phase >= finalPhase ? (
            <motion.p
              key="closing"
              className="report-stage-02__line report-stage-02__line--closing"
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: prefersReducedMotion ? 0.15 : 0.9 }}
            >
              {CLOSING_COPY}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <ReportStageNav
        label="머문 순간 보기"
        index={index}
        total={total}
        visible={revealed}
        onAdvance={onAdvance}
        disabled={locked}
      />
    </div>
  );
}
