import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { renderLightGraphic } from '../../lib/lightRenderer.js';
import { drawStrokes } from '../../lib/memorySketch';
import type { RecordLayerDerived, ReportData } from '../../types';
import type { ReportFinding } from '../../lib/reportStageFacts';
import { useStageReveal } from './useStageReveal';
import { FINAL_RECORD_LAYER_COPY, finalRecordEvidence } from '../../lib/reportFindingCopy';
import { ReportEvidenceVisual } from './ReportEvidenceVisual';
import './FinalRecordLayer.css';

interface Props {
  record: RecordLayerDerived;
  report: ReportData;
  findings: ReportFinding[];
  index: number;
  total: number;
  onSave: () => void;
  onRestart: () => void;
}

/**
 * Final Record Layer.
 *
 * The record box reuses Record Layer II's own layers
 * (src/scenes/RecordLayerSecondVisitScene.tsx) — `renderLightGraphic`,
 * `drawStrokes`, a dark veil — recomposed rather than reinvented. Record
 * Layer II was the accumulation of what the visitor left; this is the same
 * accumulation seen again, once, now that the visitor knows whose it was.
 *
 * The evidence row below it is the session's own real Findings
 * (`finalRecordEvidence`, src/lib/reportFindingCopy.ts) — 2–4 tiles at most,
 * only for what this visit actually showed. The assembled sentence is one
 * tile among them, not the page's centerpiece: this record is the whole
 * response, not a single chosen line.
 */
export function FinalRecordLayer({ record, report, findings, index, total, onSave, onRestart }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const revealed = useStageReveal(prefersReducedMotion ? 300 : 6600);
  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sketchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const evidenceItems = useMemo(
    () => finalRecordEvidence(findings, Boolean(report.customSentence)),
    [findings, report.customSentence],
  );

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

  return (
    <div className="final-record-layer">
      <div className="final-record-layer__veil" />

      <p className="final-record-layer__eyebrow">RESPONSE RECORD</p>

      <div className="final-record-layer__narrative">
        <motion.div
          className="final-record-layer__record"
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: prefersReducedMotion ? 0.15 : 1.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <canvas ref={lightCanvasRef} width={1000} height={1000} className="final-record-layer__light-canvas" />
          <canvas ref={sketchCanvasRef} width={1200} height={800} className="final-record-layer__sketch-canvas" />
          <span className="final-record-layer__record-grid" aria-hidden="true" />
        </motion.div>

        <motion.p
          className="final-record-layer__title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0.15 : 1.1, delay: prefersReducedMotion ? 0 : 1.4 }}
        >
          미응답 : UNANSWERED_
        </motion.p>

        {evidenceItems.length > 0 ? (
          <motion.div
            className="final-record-layer__evidence"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.15 : 1.1, delay: prefersReducedMotion ? 0 : 2.3 }}
          >
            {evidenceItems.map((item) => (
              <ReportEvidenceVisual
                key={item.sceneId}
                sceneId={item.sceneId}
                record={record}
                report={report}
                mode="converge"
                caption={item.tag}
              />
            ))}
          </motion.div>
        ) : null}

        <motion.p
          className="final-record-layer__caption"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0.15 : 1.2, delay: prefersReducedMotion ? 0 : 4 }}
        >
          {FINAL_RECORD_LAYER_COPY}
        </motion.p>

        <AnimatePresence>
          {revealed ? (
            <motion.div
              className="final-record-layer__actions"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: prefersReducedMotion ? 0.15 : 0.7 }}
            >
              <span className="final-record-layer__index" aria-hidden="true">
                {String(index).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>
              <div className="final-record-layer__buttons">
                <button className="final-record-layer__button" onClick={onSave}>
                  나의 기록 저장하기
                </button>
                <button className="final-record-layer__button final-record-layer__button--ghost" onClick={onRestart}>
                  처음으로 돌아가기
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
