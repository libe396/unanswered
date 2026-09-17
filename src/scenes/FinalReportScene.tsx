import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { selectRecordLayerDerived, useExperienceStore } from '../store/experienceStore';
import { buildReport } from '../utils/report';
import { buildReportFindings, pickReturnFinding, pickStage03Highlight } from '../lib/reportStageFacts';
import { buildFinalReportPresentation } from '../lib/finalReportPresentation';
import { ReportStage01CollectedClues } from './report/ReportStage01CollectedClues';
import { ReportStage02BehaviorTrace } from './report/ReportStage02BehaviorTrace';
import { ReportStage03Hesitation } from './report/ReportStage03Hesitation';
import { ReportStage04MemoryReconstruction } from './report/ReportStage04MemoryReconstruction';
import { ReportStage05Observation } from './report/ReportStage05Observation';
import { ReportStage06SubjectReveal } from './report/ReportStage06SubjectReveal';
import { FinalRecordLayer } from './report/FinalRecordLayer';
import { PrintableFullReport } from './report/PrintableFullReport';
import './report/ReportStage.css';
import './FinalReportScene.css';

/**
 * The viewed Final Report — a no-scroll, one-viewport-per-idea Narrative
 * Flow (수집 → 발견 → 관찰 → 재구성 → 수렴 → Reveal → Closure), ending on
 * the 'archive' stage's screen receipt (`FinalReportSummaryReceipt`) and the
 * A4 document behind its "전체 조사 기록 발급하기" button
 * (`PrintableFullReport`, print-only) — both built from the same
 * `buildFinalReportPresentation` model so they can never disagree about the
 * same visit.
 *
 * Every behavioural claim in this sequence traces back to
 * `src/lib/reportStageFacts.ts`'s `ReportFinding[]` — itself built entirely
 * from the existing named Scene Patterns via `analyzeCrossScene` — never
 * from a threshold invented for this Scene. Stages whose Finding is null
 * for this session ('return' with nothing to show, 'hesitation' with no
 * HESITATION/REVISION/DWELL/REPLAY evidence at all) are left out of the
 * sequence rather than rendered empty. The convergence stage receives the
 * real Findings only to decide which already-observed trace markers may be
 * shown; it does not introduce another analysis result.
 */
type StageKey = 'clues' | 'return' | 'hesitation' | 'memory' | 'observation' | 'reveal' | 'archive';

const stageVariants: Variants = {
  initial: { opacity: 0, scale: 0.985, filter: 'blur(6px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 1.012, filter: 'blur(6px)' },
};

const reducedStageVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export function FinalReportScene() {
  const record = useExperienceStore(useShallow(selectRecordLayerDerived));
  const behavior = useExperienceStore((s) => s.behavior);
  const finalReportMeta = useExperienceStore((s) => s.finalReport);
  const devFinalReportEntryStage = useExperienceStore((s) => s.devFinalReportEntryStage);
  const markFinalReportGenerated = useExperienceStore((s) => s.markFinalReportGenerated);
  const completeScene = useExperienceStore((s) => s.completeScene);
  const reset = useExperienceStore((s) => s.reset);
  const prefersReducedMotion = useReducedMotion();

  const report = buildReport(record);
  const findings = useMemo(() => buildReportFindings(behavior, record), [behavior, record]);
  const returnFinding = useMemo(() => pickReturnFinding(findings), [findings]);
  const stage03Finding = useMemo(() => pickStage03Highlight(findings), [findings]);
  const presentation = useMemo(
    () => buildFinalReportPresentation(record, report, finalReportMeta?.generatedAt ?? null),
    [record, report, finalReportMeta],
  );

  useEffect(() => {
    markFinalReportGenerated();
    completeScene('finalReport');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stageKeys = useMemo(() => {
    const keys: StageKey[] = ['clues'];
    if (returnFinding) keys.push('return');
    if (stage03Finding) keys.push('hesitation');
    keys.push('memory', 'observation', 'reveal', 'archive');
    return keys;
  }, [returnFinding, stage03Finding]);

  // Dev-only shortcut (see experienceStore.ts's `devFinalReportEntryStage`
  // doc): 'summary' starts the sequence already on its last stage — the
  // Summary Receipt — instead of at 'clues'. Read once, on mount, exactly
  // like `stageIndex` itself; a real visit's value is always 'sequence',
  // so this is a no-op outside DevSceneNavigator.tsx's shortcut.
  const [stageIndex, setStageIndex] = useState(() =>
    devFinalReportEntryStage === 'summary' ? stageKeys.length - 1 : 0,
  );
  const [locked, setLocked] = useState(false);

  function handleAdvance() {
    if (locked || stageIndex >= stageKeys.length - 1) return;
    setLocked(true);
    setStageIndex((i) => i + 1);
  }

  function renderStage(key: StageKey, stageNumber: number, total: number) {
    switch (key) {
      case 'clues':
        return (
          <ReportStage01CollectedClues
            record={record}
            report={report}
            index={stageNumber}
            total={total}
            locked={locked}
            onAdvance={handleAdvance}
          />
        );
      case 'return':
        return (
          <ReportStage02BehaviorTrace
            finding={returnFinding!}
            record={record}
            report={report}
            index={stageNumber}
            total={total}
            locked={locked}
            onAdvance={handleAdvance}
          />
        );
      case 'hesitation':
        return (
          <ReportStage03Hesitation
            finding={stage03Finding!}
            record={record}
            report={report}
            index={stageNumber}
            total={total}
            locked={locked}
            onAdvance={handleAdvance}
          />
        );
      case 'memory':
        return (
          <ReportStage04MemoryReconstruction
            record={record}
            index={stageNumber}
            total={total}
            locked={locked}
            onAdvance={handleAdvance}
          />
        );
      case 'observation':
        return (
          <ReportStage05Observation
            record={record}
            report={report}
            findings={findings}
            index={stageNumber}
            total={total}
            locked={locked}
            onAdvance={handleAdvance}
          />
        );
      case 'reveal':
        return (
          <ReportStage06SubjectReveal
            index={stageNumber}
            total={total}
            locked={locked}
            onAdvance={handleAdvance}
          />
        );
      case 'archive':
        return (
          <FinalRecordLayer
            record={record}
            presentation={presentation}
            index={stageNumber}
            total={total}
            onIssueFullReport={() => window.print()}
            onRestart={reset}
          />
        );
    }
  }

  const variants = prefersReducedMotion ? reducedStageVariants : stageVariants;
  const transition = prefersReducedMotion
    ? { duration: 0.15 }
    : { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const };

  const activeKey = stageKeys[stageIndex];

  return (
    <div
      className={`final-report-scene${activeKey === 'archive' ? ' final-report-scene--scrollable' : ''}`}
    >

      <AnimatePresence mode="wait" onExitComplete={() => setLocked(false)}>
        <motion.div
          key={activeKey}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={variants}
          transition={transition}
        >
          {renderStage(stageKeys[stageIndex], stageIndex + 1, stageKeys.length)}
        </motion.div>
      </AnimatePresence>
      <PrintableFullReport record={record} presentation={presentation} />
    </div>
  );
}
