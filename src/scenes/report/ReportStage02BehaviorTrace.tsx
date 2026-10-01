import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { ReportFinding } from '../../lib/reportStageFacts';
import type { RecordLayerDerived, ReportData } from '../../types';
import { useExperienceStore } from '../../store/experienceStore';
import { ReportStageNav } from './ReportStageNav';
import { ReportEvidenceVisual, evidenceCopy } from './ReportEvidenceVisual';
import { TraceReplay, hasTraceReplay } from './TraceReplay';
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
  const [phase, setPhase] = useState(0);
  const behavior = useExperienceStore((s) => s.behavior);
  const replayable = useMemo(
    () => evidence.map((item) => hasTraceReplay(item.sceneId, behavior[item.sceneId])),
    [evidence, behavior],
  );
  // An evidence beat with a replay holds until the replay has finished, and
  // again after "다시 보기"; without one it keeps its original 3s.
  const [replayDone, setReplayDone] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (phase >= finalPhase) return;
    const hasReplay = phase > 0 && replayable[phase - 1];
    if (hasReplay && !replayDone) return;
    const hold = phase === 0 ? 2300 : hasReplay ? 4500 : 3000;
    const timer = window.setTimeout(() => {
      setReplayDone(false);
      setPhase((p) => p + 1);
    }, prefersReducedMotion ? Math.min(hold, 2000) : hold);
    return () => window.clearTimeout(timer);
  }, [phase, finalPhase, replayable, replayDone, prefersReducedMotion]);

  useEffect(() => {
    if (phase < finalPhase) return;
    const timer = window.setTimeout(() => setRevealed(true), prefersReducedMotion ? 200 : 1300);
    return () => window.clearTimeout(timer);
  }, [phase, finalPhase, prefersReducedMotion]);

  const activeEvidence = evidence[Math.max(0, Math.min(evidence.length - 1, phase - 1))];
  const activeReplayable = phase > 0 && phase <= evidence.length && replayable[phase - 1];

  return (
    <div className="report-stage report-stage-02">
      <p className="report-stage__eyebrow">
        <span className="report-stage__eyebrow-code">REPORT {String(index).padStart(2, '0')}</span>
        <span className="report-stage__eyebrow-sep" aria-hidden="true">·</span>
        <span className="report-stage__eyebrow-title">다시 돌아본 것</span>
      </p>

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
              {activeReplayable ? (
                <TraceReplay
                  sceneId={activeEvidence.sceneId}
                  onDone={() => setReplayDone(true)}
                  onRestart={() => setReplayDone(false)}
                />
              ) : (
                <ReportEvidenceVisual sceneId={activeEvidence.sceneId} record={record} report={report} mode="return" />
              )}
              <span className="report-stage-02__line report-stage-02__line--evidence">
                {evidenceCopy(activeEvidence.sceneId, 'return')}
              </span>
              {activeReplayable && replayDone ? (
                <motion.div
                  className="report-stage-02__after-replay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.8 }}
                >
                  <ReportEvidenceVisual sceneId={activeEvidence.sceneId} record={record} report={report} mode="return" />
                </motion.div>
              ) : null}
            </motion.div>
          ) : null}

          {phase >= finalPhase ? (
            <motion.p
              key="closing"
              className="report-stage-02__line report-stage-02__line--closing"
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
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
