import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { drawStrokes } from '../../lib/memorySketch';
import { MemoryRoom } from '../../components/MemoryRoom';
import type { RecordLayerDerived, Stroke } from '../../types';
import { useStageReveal } from './useStageReveal';
import { ReportStageNav } from './ReportStageNav';
import './ReportStage04MemoryReconstruction.css';

interface Props {
  record: RecordLayerDerived;
  index: number;
  total: number;
  locked: boolean;
  onAdvance: () => void;
}

/** Slices `strokes` down to its first `revealedPoints` points, in stroke
 *  order — every earlier stroke stays whole, the stroke the count lands
 *  inside is cut short, everything after is not drawn yet. */
function buildPartialStrokes(strokes: Stroke[], revealedPoints: number): Stroke[] {
  const result: Stroke[] = [];
  let remaining = revealedPoints;
  for (const stroke of strokes) {
    if (remaining <= 0) break;
    if (remaining >= stroke.points.length) {
      result.push(stroke);
      remaining -= stroke.points.length;
    } else if (remaining >= 2) {
      result.push({ ...stroke, points: stroke.points.slice(0, remaining) });
      remaining = 0;
    } else {
      remaining = 0;
    }
  }
  return result;
}

/**
 * REPORT 04 · 기억의 복원.
 *
 * The base layer is `MemoryRoom` in its existing non-interactive mode — the
 * system's own restoration, unchanged. The strokes on top are
 * `record.memorySketch.strokes`, replayed in stored order via the same
 * `drawStrokes` every other Scene already uses, just called with a growing
 * slice each frame instead of the whole array at once. No new drawing data,
 * no new room art.
 */
export function ReportStage04MemoryReconstruction({ record, index, total, locked, onAdvance }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const strokes = record.memorySketch.strokes;
  const hasStrokes = strokes.length > 0;
  const totalPoints = strokes.reduce((sum, s) => sum + s.points.length, 0);
  const replayDurationMs = Math.min(4200, Math.max(1400, totalPoints * 14));
  const finalPhase = hasStrokes ? 2 : 1;
  const [phase, setPhase] = useState(prefersReducedMotion ? finalPhase : 0);
  const revealed = useStageReveal(prefersReducedMotion ? 260 : replayDurationMs + 4300);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    if (!hasStrokes) {
      drawStrokes(context, [], canvas.width, canvas.height);
      return;
    }

    if (prefersReducedMotion) {
      drawStrokes(context, strokes, canvas.width, canvas.height);
      return;
    }

    let start: number | null = null;
    function frame(t: number) {
      if (start === null) start = t;
      const elapsed = t - start;
      const progress = Math.min(1, elapsed / replayDurationMs);
      const revealedPoints = Math.round(progress * totalPoints);
      drawStrokes(context as CanvasRenderingContext2D, buildPartialStrokes(strokes, revealedPoints), canvas!.width, canvas!.height);
      if (progress < 1) rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, hasStrokes, prefersReducedMotion, replayDurationMs, totalPoints]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase(finalPhase);
      return;
    }

    setPhase(0);
    const timers = hasStrokes
      ? [
          window.setTimeout(() => setPhase(1), 2200),
          window.setTimeout(() => setPhase(2), replayDurationMs + 3000),
        ]
      : [window.setTimeout(() => setPhase(1), 3000)];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [finalPhase, hasStrokes, prefersReducedMotion, replayDurationMs]);

  const copy = hasStrokes
    ? [
        '마지막 방에는\n비어 있는 자리가 있었습니다.',
        '당신은 그곳에\n직접 흔적을 덧붙였습니다.',
        '기억에 없던 흔적이\n당신의 손에서 새로 생겨났습니다.',
      ]
    : [
        '마지막 방에서,\n당신은 이곳을 그대로 두었습니다.',
        '남겨둔 빈자리도\n이번 기록에 함께 남았습니다.',
      ];

  return (
    <div className="report-stage report-stage-04">
      <p className="report-stage__eyebrow">REPORT 04 · 당신이 채운 빈자리</p>

      <div className="report-stage-04__room">
        <MemoryRoom
          selectedIds={record.memorySketch.selectedObjects}
          onSelectToggle={() => {}}
          onViewStart={() => {}}
          onViewEnd={() => {}}
          interactive={false}
        />
        <canvas ref={canvasRef} width={1200} height={800} className="report-stage-04__canvas" />
      </div>

      <div className="report-stage-04__copy-frame">
        <AnimatePresence mode="wait">
          <motion.p
            key={phase}
            className={`report-stage-04__line${phase === finalPhase ? ' report-stage-04__line--final' : ''}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: prefersReducedMotion ? 0.15 : 0.8 }}
          >
            {copy[phase]}
          </motion.p>
        </AnimatePresence>
      </div>

      <ReportStageNav
        label="흔적 모으기"
        index={index}
        total={total}
        visible={revealed}
        onAdvance={onAdvance}
        disabled={locked}
      />
    </div>
  );
}
