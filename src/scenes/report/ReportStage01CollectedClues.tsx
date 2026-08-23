import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { renderLightGraphic } from '../../lib/lightRenderer.js';
import { drawStrokes } from '../../lib/memorySketch';
import { MemoryRoom } from '../../components/MemoryRoom';
import type { RecordLayerDerived, ReportData } from '../../types';
import { useStageReveal } from './useStageReveal';
import { ReportStageNav } from './ReportStageNav';
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

const INTRO_BEATS = [
  '조사를 마쳤습니다.',
  '그런데,\n확인해야 할 것이 하나 남아 있습니다.',
  '그동안 당신은\n생각보다 많은 흔적을 남겼습니다.',
];

const INTRO_HOLDS_MS = [1900, 2300, 2500];
const MAP_PHASE = INTRO_BEATS.length;

/**
 * REPORT 01 · 수집된 단서.
 *
 * A reading step, not an analysis step — every clue the visitor already
 * left, reassembled one at a time into a single record cluster. Nothing
 * here is derived beyond what `report`/`record` already carry: the same
 * `ReportData` src/scenes/SavedReportDocument.tsx reads, the same
 * `renderLightGraphic`/`drawStrokes` calls the rest of the exhibition uses.
 */
export function ReportStage01CollectedClues({ record, report, index, total, locked, onAdvance }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState(prefersReducedMotion ? MAP_PHASE : 0);
  const revealed = useStageReveal(prefersReducedMotion ? 260 : 9800);
  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sketchCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!record.light || !lightCanvasRef.current) return;
    renderLightGraphic(lightCanvasRef.current, record.light.rules, record.light.variation);
  }, [record.light]);

  useEffect(() => {
    const canvas = sketchCanvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    drawStrokes(context, record.memorySketch.strokes, canvas.width, canvas.height);
  }, [record.memorySketch]);

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

  const hasMemoryTrace = record.memorySketch.strokes.length > 0 || record.memorySketch.selectedObjects.length > 0;
  const soundEvents = record.soundClues.events;
  const maxPlayedMs = Math.max(1, ...soundEvents.map((e) => e.totalPlayedMs));
  const variants = prefersReducedMotion ? itemVariantsReduced : itemVariants;
  const mapVisible = phase >= MAP_PHASE;

  return (
    <div className="report-stage report-stage-01">
      <p className="report-stage__eyebrow">REPORT 01 · 당신이 남긴 것</p>

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
            <span className="report-stage-01__trace-label">LIGHT</span>
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
            <span className="report-stage-01__trace-label">SOUND</span>
            <span className="report-stage-01__node" aria-hidden="true" />
            <span className="report-stage-01__sound-label">{report.selectedSoundLabel}</span>
            <span className="report-stage-01__sound-trace" aria-hidden="true">
              {soundEvents.length ? (
                soundEvents.map((event) => (
                  <span
                    key={event.soundId}
                    className={`report-stage-01__sound-bar${
                      event.completedFully ? ' report-stage-01__sound-bar--full' : ''
                    }${event.skipped ? ' report-stage-01__sound-bar--skipped' : ''}`}
                    style={{ height: `${Math.max(12, (event.totalPlayedMs / maxPlayedMs) * 100)}%` }}
                  />
                ))
              ) : (
                <span className="report-stage-01__sound-bar" style={{ height: '30%' }} />
              )}
            </span>
          </motion.div>
        ) : null}

        {report.selectedSentences.length || report.customSentence ? (
          <motion.div className="report-stage-01__trace-row report-stage-01__trace-row--sentence" variants={variants}>
            <span className="report-stage-01__trace-label">SENTENCE</span>
            <span className="report-stage-01__node" aria-hidden="true" />
            <p className="report-stage-01__sentence">
              {report.customSentence || report.selectedSentences.join(' ')}
            </p>
          </motion.div>
        ) : null}

        {hasMemoryTrace ? (
          <motion.div className="report-stage-01__trace-row report-stage-01__trace-row--memory" variants={variants}>
            <span className="report-stage-01__trace-label">MEMORY</span>
            <span className="report-stage-01__node" aria-hidden="true" />
            <div className="report-stage-01__memory-preview">
              <MemoryRoom
                selectedIds={record.memorySketch.selectedObjects}
                onSelectToggle={() => {}}
                onViewStart={() => {}}
                onViewEnd={() => {}}
                interactive={false}
              />
              <canvas
                ref={sketchCanvasRef}
                width={480}
                height={320}
                className="report-stage-01__memory-canvas"
              />
            </div>
            <span className="report-stage-01__tag">
              {record.memorySketch.strokes.length > 0
                ? `${record.memorySketch.strokes.length} STROKES`
                : `${record.memorySketch.selectedObjects.length} OBJECTS`}
            </span>
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
        label="다음 흔적 확인"
        index={index}
        total={total}
        visible={revealed}
        onAdvance={onAdvance}
        disabled={locked}
      />
    </div>
  );
}
