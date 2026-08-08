import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { renderLightGraphic } from '../lib/lightRenderer.js';
import { drawStrokes } from '../lib/memorySketch';
import { selectRecordLayerDerived, useExperienceStore } from '../store/experienceStore';
import { buildReport } from '../utils/report';
import './FinalReportScene.css';

export function FinalReportScene() {
  const record = useExperienceStore(useShallow(selectRecordLayerDerived));
  const markFinalReportGenerated = useExperienceStore((s) => s.markFinalReportGenerated);
  const completeScene = useExperienceStore((s) => s.completeScene);
  const reset = useExperienceStore((s) => s.reset);
  const prefersReducedMotion = useReducedMotion();

  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sketchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const report = buildReport(record);

  useEffect(() => {
    markFinalReportGenerated();
    completeScene('finalReport');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const stepDelay = prefersReducedMotion ? 0.06 : 0.4;

  const lines = [
    { label: 'REPORT ID', value: report.reportId },
    { label: 'EMOTION', value: report.emotionKeywords.join(' · ') || '-' },
    { label: 'SOUND', value: report.selectedSoundLabel },
    { label: 'SOUND PATTERN', value: report.soundPattern },
    { label: 'MEMORY SKETCH', value: report.memorySketchSummary },
    { label: 'SENTENCES', value: report.selectedSentences.join(' / ') || '-' },
    { label: 'YOUR SENTENCE', value: report.customSentence || '-' },
    { label: 'REPEATED', value: report.repeatedKeywords.join(', ') || '-' },
    { label: 'DWELL', value: report.dwellSummary },
  ];

  return (
    <div className="final-report-scene">
      <div className="final-report-scene__paper">
        <p className="final-report-scene__eyebrow">RECORD REPORT</p>

        <div className="final-report-scene__visuals">
          <canvas
            ref={lightCanvasRef}
            width={1000}
            height={1000}
            className="final-report-scene__light-canvas"
          />
          {report.imagePath ? (
            <img src={report.imagePath} alt="" className="final-report-scene__source-img" />
          ) : null}
          <canvas
            ref={sketchCanvasRef}
            width={1200}
            height={800}
            className="final-report-scene__sketch-canvas"
          />
        </div>

        <motion.div
          className="final-report-scene__lines"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: stepDelay } } }}
        >
          {lines.map((line) => (
            <motion.div
              key={line.label}
              className="final-report-scene__line"
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
            >
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          className="final-report-scene__observation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: stepDelay * (lines.length + 1) }}
        >
          {report.observationText}
        </motion.p>

        <motion.div
          className="final-report-scene__reveal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: stepDelay * (lines.length + 1) + 1.2 }}
        >
          <p className="final-report-scene__reveal-line">대상 식별 완료.</p>
          <p className="final-report-scene__reveal-line">
            기록의 소유자와 조사원이 일치합니다 — {report.targetIdentity}.
          </p>
        </motion.div>
      </div>

      <div className="final-report-scene__actions">
        <button className="final-report-scene__btn" onClick={() => window.print()}>
          기록 인쇄
        </button>
        <button className="final-report-scene__btn" onClick={reset}>
          다시 시작
        </button>
      </div>
    </div>
  );
}
