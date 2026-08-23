import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { renderLightGraphic } from '../lib/lightRenderer.js';
import { drawStrokes } from '../lib/memorySketch';
import type { RecordLayerDerived, ReportData } from '../types';
import './SavedReportDocument.css';

interface SavedReportDocumentProps {
  record: RecordLayerDerived;
  report: ReportData;
}

/**
 * The document-style Final Report — everything src/scenes/FinalReportScene.tsx
 * used to render on screen, unchanged in content and layout, moved here
 * verbatim. It no longer *is* the Final Report screen; it is the artifact
 * "결과 보고서 저장" prints (see FinalReportScene.tsx's save stage, which
 * calls `window.print()` against this component). Kept hidden on screen by
 * SavedReportDocument.css and shown only under `@media print`, so the
 * existing print rendering/layout is reused exactly as it was rather than
 * rebuilt.
 */
export function SavedReportDocument({ record, report }: SavedReportDocumentProps) {
  const prefersReducedMotion = useReducedMotion();
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
    <div className="saved-report-document">
      <div className="saved-report-document__paper">
        <p className="saved-report-document__eyebrow">RECORD REPORT</p>

        <div className="saved-report-document__visuals">
          <canvas
            ref={lightCanvasRef}
            width={1000}
            height={1000}
            className="saved-report-document__light-canvas"
          />
          {report.imagePath ? (
            <img src={report.imagePath} alt="" className="saved-report-document__source-img" />
          ) : null}
          <canvas
            ref={sketchCanvasRef}
            width={1200}
            height={800}
            className="saved-report-document__sketch-canvas"
          />
        </div>

        <motion.div
          className="saved-report-document__lines"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: stepDelay } } }}
        >
          {lines.map((line) => (
            <motion.div
              key={line.label}
              className="saved-report-document__line"
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
            >
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          className="saved-report-document__observation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: stepDelay * (lines.length + 1) }}
        >
          {report.observationText}
        </motion.p>

        <motion.div
          className="saved-report-document__reveal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: stepDelay * (lines.length + 1) + 1.2 }}
        >
          <p className="saved-report-document__reveal-line">대상 식별 완료.</p>
          <p className="saved-report-document__reveal-line">
            기록의 소유자와 조사원이 일치합니다 — {report.targetIdentity}.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
