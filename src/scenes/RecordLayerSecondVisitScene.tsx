import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { renderLightGraphic } from '../lib/lightRenderer.js';
import { drawStrokes } from '../lib/memorySketch';
import { selectRecordLayerDerived, useExperienceStore } from '../store/experienceStore';
import { TerminalCorners } from '../components/TerminalCorners';
import './RecordLayerSecondVisitScene.css';

const WAVEFORM_BARS = Array.from({ length: 24 }, (_, i) => i);

export function RecordLayerSecondVisitScene() {
  const record = useExperienceStore(useShallow(selectRecordLayerDerived));
  const completeScene = useExperienceStore((s) => s.completeScene);
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

  const sentenceFragment =
    record.sentenceClues.customSentence || record.sentenceClues.selectedSentences[0] || '';

  return (
    <div className="record-layer-second-visit">
      <div className="record-layer-second-visit__vignette" />

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

      {sentenceFragment ? (
        <motion.p
          className="record-layer-second-visit__sentence"
          animate={prefersReducedMotion ? {} : { y: [0, -10, 0], opacity: [0.45, 0.7, 0.45] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        >
          {sentenceFragment}
        </motion.p>
      ) : null}

      {record.soundClues.selectedSoundId ? (
        <div className="record-layer-second-visit__waveform">
          {WAVEFORM_BARS.map((bar) => (
            <motion.span
              key={bar}
              className="record-layer-second-visit__waveform-bar"
              animate={prefersReducedMotion ? {} : { scaleY: [0.2, 1, 0.3, 0.8, 0.2] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: bar * 0.06 }}
            />
          ))}
        </div>
      ) : null}

      <div className="record-layer-second-visit__meta">
        <span>{record.investigator?.investigatorName ?? '-'}</span>
        <span>{record.investigator?.reportId ?? '-'}</span>
      </div>

      <motion.button
        className="record-layer-second-visit__confirm"
        onClick={() => completeScene('recordLayerSecondVisit')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, delay: 2.6 }}
      >
        <TerminalCorners />
        기록 확인
      </motion.button>
    </div>
  );
}
