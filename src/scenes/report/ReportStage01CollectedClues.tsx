import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { renderLightGraphic } from '../../lib/lightRenderer.js';
import type { RecordLayerDerived, ReportData } from '../../types';
import { useStageReveal } from './useStageReveal';
import { ReportStageNav } from './ReportStageNav';
import { buildSoundWaveform } from '../../lib/finalReportPresentation';
import { STAGE_01_COPY } from '../../lib/reportFindingCopy';
import './ReportStage01CollectedClues.css';

interface Props {
  record: RecordLayerDerived;
  report: ReportData;
  index: number;
  total: number;
  locked: boolean;
  onAdvance: () => void;
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

const itemVariantsReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

// Third person only: this stage is the report on the person, not the visitor.
const INTRO_BEATS = ['이름 없는 사람에 대한 보고서입니다.', '이 사람이 남긴 빛, 소리, 문장입니다.'];

const INTRO_HOLDS_MS = [2300, 2500];
const MAP_PHASE = INTRO_BEATS.length;

/**
 * REPORT 01 · 수집된 단서.
 *
 * A reading step, not an analysis step — every clue the visitor already
 * left, reassembled one at a time into a single record cluster. Nothing
 * here is derived beyond what `report`/`record` already carry: the same
 * `ReportData` src/scenes/report/PrintableFullReport.tsx reads, the same
 * `renderLightGraphic`/`drawStrokes` calls the rest of the exhibition uses.
 */
export function ReportStage01CollectedClues({ record, report, index, total, locked, onAdvance }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState(prefersReducedMotion ? MAP_PHASE : 0);
  const revealed = useStageReveal(prefersReducedMotion ? 260 : 8600);
  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // The map is hidden during the opening lines. Its full-resolution light
    // must not block the incoming Zone film/title crossfade.
    if (phase < MAP_PHASE || !record.light || !lightCanvasRef.current) return;
    renderLightGraphic(lightCanvasRef.current, record.light.rules, record.light.variation);
  }, [record.light, phase]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase(MAP_PHASE);
      return;
    }

    setPhase(0);
    let elapsed = 0;
    const timers = INTRO_HOLDS_MS.map((hold, idx) => {
      elapsed += hold;
      return window.setTimeout(() => setPhase(idx + 1), elapsed);
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [prefersReducedMotion]);

  const waveform = buildSoundWaveform(record.soundClues.selectedSoundId ?? 'none', 40);
  const variants = prefersReducedMotion ? itemVariantsReduced : itemVariants;
  const mapVisible = phase >= MAP_PHASE;

  return (
    <div className="report-stage report-stage-01">
      <p className="report-stage__eyebrow">
        <span className="report-stage__eyebrow-code">REPORT {String(index).padStart(2, '0')}</span>
        <span className="report-stage__eyebrow-sep" aria-hidden="true">·</span>
        <span className="report-stage__eyebrow-title">이 사람의 단서</span>
      </p>

      <AnimatePresence mode="wait">
        {!mapVisible ? (
          <motion.p
            key={phase}
            className="report-stage-01__intro"
            initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
            transition={{ duration: prefersReducedMotion ? 0.15 : 0.75 }}
          >
            {INTRO_BEATS[phase]}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <motion.div
        className={`report-stage-01__trace-map${
          mapVisible ? ' report-stage-01__trace-map--visible' : ' report-stage-01__trace-map--hidden'
        }`}
        initial="hidden"
        animate={mapVisible ? 'visible' : 'hidden'}
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: prefersReducedMotion ? 0.05 : 0.6,
              delayChildren: prefersReducedMotion ? 0 : 0.3,
            },
          },
        }}
      >
        <span className="report-stage-01__route" aria-hidden="true" />

        {record.light ? (
          <motion.div className="report-stage-01__trace-row report-stage-01__trace-row--light" variants={variants}>
            <span className="report-stage-01__trace-label">빛</span>
            <span className="report-stage-01__node" aria-hidden="true" />
            <div className="report-stage-01__trace-visual report-stage-01__trace-visual--light">
              <canvas ref={lightCanvasRef} width={1000} height={1000} className="report-stage-01__light-canvas" />
              {report.imagePath ? <img src={report.imagePath} alt="" className="report-stage-01__source-image" /> : null}
            </div>
            {report.emotionKeywords.length ? (
              <span className="report-stage-01__tag">{report.emotionKeywords.join(' · ')}</span>
            ) : null}
          </motion.div>
        ) : null}

        {record.soundClues.selectedSoundId ? (
          <motion.div className="report-stage-01__trace-row report-stage-01__trace-row--sound" variants={variants}>
            <span className="report-stage-01__trace-label">소리</span>
            <span className="report-stage-01__node" aria-hidden="true" />
            <span className="report-stage-01__sound-label">{report.selectedSoundLabel.replace(/^SOUND\s*/i, '소리 ')}</span>
            <span className="report-stage-01__sound-trace" aria-hidden="true">
              {waveform.map((height, i) => <span key={i} className="report-stage-01__sound-bar" style={{ height: `${Math.max(8, height * 100)}%` }} />)}
            </span>
          </motion.div>
        ) : null}

        {report.selectedSentences.length || report.customSentence ? (
          <motion.div className="report-stage-01__trace-row report-stage-01__trace-row--sentence" variants={variants}>
            <span className="report-stage-01__trace-label">문장</span>
            <span className="report-stage-01__node" aria-hidden="true" />
            <ol className="report-stage-01__sentences">
              {(report.selectedSentences.length ? report.selectedSentences : report.customSentence ? [report.customSentence] : []).map((sentence, i) => <li key={i}><span>{String(i + 1).padStart(2, '0')}</span><p>{sentence}</p></li>)}
              {record.sentenceClues.responseText ? <li><span>+</span><p>{record.sentenceClues.responseText}</p></li> : null}
            </ol>
          </motion.div>
        ) : null}


      </motion.div>

      <motion.p
        className="report-stage__lede report-stage-01__closing"
        initial={{ opacity: 0 }}
        animate={{ opacity: revealed ? 1 : 0 }}
        transition={{ duration: prefersReducedMotion ? 0.15 : 1 }}
      >
        {STAGE_01_COPY.closing}
      </motion.p>

      <ReportStageNav
        label="계속"
        index={index}
        total={total}
        visible={revealed}
        onAdvance={onAdvance}
        disabled={locked}
      />
    </div>
  );
}
