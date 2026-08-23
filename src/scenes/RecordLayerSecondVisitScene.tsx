import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { renderLightGraphic } from '../lib/lightRenderer.js';
import { drawStrokes } from '../lib/memorySketch';
import { selectRecordLayerDerived, useExperienceStore } from '../store/experienceStore';
import { TerminalCorners } from '../components/TerminalCorners';
import './RecordLayerSecondVisitScene.css';

const ARCHIVE_TRACE_MARKS = [
  { kind: 'segment', width: 46 },
  { kind: 'dot' },
  { kind: 'segment', width: 24 },
  { kind: 'tick', height: 14 },
  { kind: 'segment', width: 62 },
  { kind: 'dot' },
  { kind: 'segment', width: 36 },
  { kind: 'tick', height: 20 },
  { kind: 'segment', width: 18 },
  { kind: 'dot' },
  { kind: 'segment', width: 72 },
] as const;

export function RecordLayerSecondVisitScene() {
  const record = useExperienceStore(useShallow(selectRecordLayerDerived));
  const completeScene = useExperienceStore((s) => s.completeScene);
  const prefersReducedMotion = useReducedMotion();
  const [isRevealing, setIsRevealing] = useState(false);

  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sketchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const revealTimerRef = useRef<number | null>(null);

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

  useEffect(
    () => () => {
      if (revealTimerRef.current !== null) window.clearTimeout(revealTimerRef.current);
    },
    [],
  );

  const sentenceLines = record.sentenceClues.selectedSentences.length
    ? record.sentenceClues.selectedSentences
    : record.sentenceClues.customSentence
      ? [record.sentenceClues.customSentence]
      : [];

  function handleConfirm() {
    if (isRevealing) return;
    setIsRevealing(true);
    revealTimerRef.current = window.setTimeout(
      () => completeScene('recordLayerSecondVisit'),
      prefersReducedMotion ? 1200 : 3000,
    );
  }

  return (
    <div className={`record-layer-second-visit${isRevealing ? ' record-layer-second-visit--revealing' : ''}`}>
      <canvas
        ref={lightCanvasRef}
        width={1000}
        height={1000}
        className="record-layer-second-visit__light-canvas"
      />

      <canvas
        ref={sketchCanvasRef}
        width={1200}
        height={800}
        className="record-layer-second-visit__sketch-canvas"
      />

      <div className="record-layer-second-visit__record-veil" />

      <div className="record-layer-second-visit__record-traces" aria-hidden="true">
        <div className="record-layer-second-visit__record-trace record-layer-second-visit__record-trace--1">
          <span />
          <span />
        </div>
        <div className="record-layer-second-visit__record-trace record-layer-second-visit__record-trace--2">
          <span />
          <span />
          <span />
        </div>
        <div className="record-layer-second-visit__record-trace record-layer-second-visit__record-trace--3">
          <span />
          <span />
        </div>
      </div>

      <div className="record-layer-second-visit__narrative">
        {sentenceLines.length ? (
          <motion.p
            className="record-layer-second-visit__sentence"
            initial={prefersReducedMotion ? { opacity: 1 } : false}
          >
            {sentenceLines.map((line, index) => (
              <motion.span
                key={`${line}-${index}`}
                className="record-layer-second-visit__sentence-line"
                initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                animate={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.58, delay: prefersReducedMotion ? 0 : 0.34 + index * 0.5 }}
              >
                {line}
              </motion.span>
            ))}
          </motion.p>
        ) : null}

        <motion.button
          className="record-layer-second-visit__confirm"
          onClick={handleConfirm}
          disabled={isRevealing}
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
          animate={prefersReducedMotion ? { opacity: isRevealing ? 0 : 1, y: 0 } : { opacity: isRevealing ? 0 : 1, y: isRevealing ? 4 : 0 }}
          transition={{ duration: isRevealing ? 0.72 : 0.68, delay: isRevealing || prefersReducedMotion ? 0 : 2.55 }}
        >
          <TerminalCorners />
          <span>기록 확인</span>
          <span aria-hidden="true">→</span>
        </motion.button>
      </div>

      {record.soundClues.selectedSoundId ? (
        <motion.div
          className="record-layer-second-visit__archive-trace"
          aria-hidden="true"
          initial={prefersReducedMotion ? { opacity: 0.26 } : { opacity: 0 }}
          animate={{ opacity: isRevealing ? 0 : 0.3 }}
          transition={{ duration: isRevealing ? 0.72 : 0.8, delay: isRevealing || prefersReducedMotion ? 0 : 2.25 }}
        >
          {ARCHIVE_TRACE_MARKS.map((mark, index) => (
            <motion.span
              key={`${mark.kind}-${index}`}
              className={`record-layer-second-visit__archive-trace-mark record-layer-second-visit__archive-trace-mark--${mark.kind}`}
              style={{ width: 'width' in mark ? mark.width : undefined, height: 'height' in mark ? mark.height : undefined }}
              animate={prefersReducedMotion || mark.kind === 'segment' ? {} : { opacity: [0.22, 0.48, 0.22] }}
              transition={{ duration: 5.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.42 }}
            />
          ))}
        </motion.div>
      ) : null}

      <div className="record-layer-second-visit__meta">
        <span>{record.investigator?.investigatorName ?? '-'}</span>
        <span>{record.investigator?.reportId ?? '-'}</span>
      </div>

    </div>
  );
}
