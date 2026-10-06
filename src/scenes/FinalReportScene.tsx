import { useCameraPreference } from '../store/cameraPreference';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { selectRecordLayerDerived, useExperienceStore } from '../store/experienceStore';
import { buildReport } from '../utils/report';
import { buildFinalReportPresentation } from '../lib/finalReportPresentation';
import { buildReportUrl, encodeReport } from '../lib/reportShare';
import { isVenueMode } from '../lib/venueMode';
import { analyzePersonalFindings } from '../lib/personalFindings';
import {
  hasRemoteInterpreter,
  interpretPersonalFindings,
  requestRemoteInterpretation,
  type PersonalFinding,
} from '../lib/personalFindingInterpretation';
import { ReportStage06SubjectReveal } from './report/ReportStage06SubjectReveal';
import { ReportStageMethod } from './report/ReportStageMethod';
import { ReportStageFinding } from './report/ReportStageFinding';
import { ReportStageClosing } from './report/ReportStageClosing';
import { FinalRecordLayer } from './report/FinalRecordLayer';
import { PrintableFullReport } from './report/PrintableFullReport';
import './report/ReportStage.css';
import './FinalReportScene.css';

/**
 * The viewed Final Report — a no-scroll, one-viewport-per-idea Narrative
 * Flow: SUBJECT REVEAL → REFRAME / METHOD → PERSONAL FINDINGS (one per
 * screen, each with its Evidence Layer) → CLOSING, ending on
 * the 'archive' stage's screen receipt (`FinalReportSummaryReceipt`) and the
 * A4 document behind its "전체 조사 기록 발급하기" button
 * (`PrintableFullReport`, print-only) — both built from the same
 * `buildFinalReportPresentation` model so they can never disagree about the
 * same visit.
 *
 * Every behavioural claim in this sequence is a Personal Finding from
 * `src/lib/personalFindings.ts` — relationships *between* recorded
 * behaviours, read off the existing Scene Summaries / Scene Patterns and
 * `analyzeCrossScene` — put into words by
 * `src/lib/personalFindingInterpretation.ts`. The stages only render those
 * Findings; none reads raw interaction data. A visit with fewer Findings
 * gets fewer Finding stages (zero to three), never a filled-in one.
 *
 * The earlier one-behaviour-per-screen stages (ReportStage01–05,
 * ReportBridgeBeat) are no longer in the sequence; their files are kept.
 */
type StageKey = 'reveal' | 'method' | `finding-${number}` | 'closing' | 'archive';

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
  const analysis = useMemo(() => analyzePersonalFindings(behavior, record), [behavior, record]);
  const templateFindings = useMemo(() => interpretPersonalFindings(analysis.findings), [analysis]);
  // Only ever set when VITE_REPORT_INTERPRETATION_ENDPOINT is configured and
  // its answer passed validation — and only before any Finding is on screen,
  // so a line never changes while it is being read.
  const [remoteFindings, setRemoteFindings] = useState<PersonalFinding[] | null>(null);
  const findingShownRef = useRef(false);
  const personalFindings = remoteFindings ?? templateFindings;
  useEffect(() => {
    if (!hasRemoteInterpreter()) return;
    let cancelled = false;
    void requestRemoteInterpretation(templateFindings).then((result) => {
      if (!cancelled && result && !findingShownRef.current) setRemoteFindings(result);
    });
    return () => { cancelled = true; };
  }, [templateFindings]);
  const presentation = useMemo(
    () => buildFinalReportPresentation(record, report, finalReportMeta?.generatedAt ?? null),
    [record, report, finalReportMeta],
  );

  const reportUrl = useMemo(
    () => buildReportUrl(encodeReport(record, behavior, presentation)),
    [record, behavior, presentation],
  );
  const [venue] = useState(isVenueMode);

  const generatedRef = useRef(false);
  useEffect(() => {
    if (generatedRef.current) return;
    generatedRef.current = true;
    markFinalReportGenerated();
    completeScene('finalReport');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findingCount = personalFindings.length;
  const stageKeys = useMemo(() => {
    const keys: StageKey[] = ['reveal', 'method'];
    for (let i = 0; i < findingCount; i += 1) keys.push(`finding-${i}`);
    keys.push('closing', 'archive');
    return keys;
  }, [findingCount]);

  const transitionLine =
    findingCount === 0
      ? null
      : analysis.crossScene
        ? '서로 다른 공간에서\n같은 움직임이 반복되었습니다.'
        : personalFindings[0]?.id === 'no-convergence'
          ? '당신이 남긴 답 사이의 움직임을\n서로 맞대어 보았습니다.'
          : `당신이 남긴 답 사이에서\n${findingCount > 1 ? '몇 가지' : '하나의'} 흔적이 발견되었습니다.`;

  // Dev-only shortcut (see experienceStore.ts's `devFinalReportEntryStage`
  // doc): 'summary' starts the sequence already on its last stage — the
  // Summary Receipt — instead of at 'reveal'. Read once, on mount, exactly
  // like `stageIndex` itself; a real visit's value is always 'sequence',
  // so this is a no-op outside DevSceneNavigator.tsx's shortcut.
  const [rawStageIndex, setStageIndex] = useState(() =>
    devFinalReportEntryStage === 'summary' ? stageKeys.length - 1 : 0,
  );
  // The number of Finding stages follows the record; if it ever shrinks
  // while the report is open, stay on a stage that still exists.
  const stageIndex = Math.min(rawStageIndex, stageKeys.length - 1);
  const [locked, setLocked] = useState(false);

  function handleAdvance() {
    if (locked || stageIndex >= stageKeys.length - 1) return;
    setLocked(true);
    setStageIndex(stageIndex + 1);
  }

  const handleRestart = useCallback(() => { useCameraPreference.getState().setEnabled(false); reset(); }, [reset]);

  function renderStage(key: StageKey, stageNumber: number, total: number) {
    if (key.startsWith('finding-')) {
      const order = Number(key.slice('finding-'.length));
      const finding = personalFindings[order];
      if (!finding) return null;
      findingShownRef.current = true;
      return (
        <ReportStageFinding
          finding={finding}
          order={order + 1}
          count={findingCount}
          index={stageNumber}
          total={total}
          locked={locked}
          onAdvance={handleAdvance}
          nextLabel={order + 1 < findingCount ? '다음 발견' : '기록 마무리'}
        />
      );
    }
    switch (key) {
      case 'reveal':
        return (
          <ReportStage06SubjectReveal
            index={stageNumber}
            total={total}
            locked={locked}
            onAdvance={handleAdvance}
          />
        );
      case 'method':
        return (
          <ReportStageMethod
            index={stageNumber}
            total={total}
            locked={locked}
            onAdvance={handleAdvance}
            transitionLine={transitionLine}
            nextLabel={findingCount > 0 ? '발견 보기' : '기록 마무리'}
          />
        );
      case 'closing':
        return <ReportStageClosing index={stageNumber} total={total} locked={locked} onAdvance={handleAdvance} />;
      case 'archive':
        return (
          <FinalRecordLayer
            record={record}
            presentation={presentation}
            index={stageNumber}
            total={total}
            onIssueFullReport={() => window.print()}
            onRestart={handleRestart}
            reportUrl={reportUrl}
            venue={venue}
          />
        );
    }
    return null;
  }

  const variants = prefersReducedMotion ? reducedStageVariants : stageVariants;
  const transition = prefersReducedMotion
    ? { duration: 0.15 }
    : { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const };

  const activeKey = stageKeys[stageIndex];

  return (
    <div
      className={`final-report-scene${
        activeKey === 'archive' ? ' final-report-scene--scrollable scroll-quiet' : ''
      }`}
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
