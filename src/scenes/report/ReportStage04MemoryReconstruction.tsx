import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { drawStrokes } from '../../lib/memorySketch';
import { MemoryRoom } from '../../components/MemoryRoom';
import { ROOM_WIDTH, ROOM_HEIGHT, ROOM_OBJECT_GEOMETRY } from '../../data/memoryRoomGeometry';
import { MEMORY_ROOM_OBJECTS } from '../../data/content';
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
  const memory = record.memorySketch;
  const hasRecord = memory.lastInputAt > 0 || memory.selectedObjects.length > 0 || memory.strokes.length > 0;
  const unselected = hasRecord ? MEMORY_ROOM_OBJECTS.filter((object) => ROOM_OBJECT_GEOMETRY.some(({ id }) => id === object.id) && !memory.selectedObjects.includes(object.id)) : [];
  const [showUnselected, setShowUnselected] = useState(Boolean(prefersReducedMotion));
  useEffect(() => {
    if (prefersReducedMotion) { setShowUnselected(true); return; }
    const timer = window.setTimeout(() => setShowUnselected(true), 2200);
    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion]);
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
      drawStrokes(context, [], canvas.width, canvas.height, ROOM_WIDTH / 1200);
      return;
    }

    if (prefersReducedMotion) {
      drawStrokes(context, strokes, canvas.width, canvas.height, ROOM_WIDTH / 1200);
      return;
    }

    let start: number | null = null;
    function frame(t: number) {
      if (start === null) start = t;
      const elapsed = t - start;
      const progress = Math.min(1, elapsed / replayDurationMs);
      const revealedPoints = Math.round(progress * totalPoints);
      drawStrokes(context as CanvasRenderingContext2D, buildPartialStrokes(strokes, revealedPoints), canvas!.width, canvas!.height, ROOM_WIDTH / 1200);
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

  const finalCopy = !hasRecord ? '이 공간에 남겨진 선택 기록이 없습니다.'
    : unselected.length === 0 ? '선택할 수 있는 모든 물건을 기록에 남겼습니다.'
    : memory.selectedObjects.length === 0 ? '물건을 선택하지 않고 이 공간을 지나갔습니다.'
    : '선택하지 않고 남겨둔 자리도 이번 기록에 함께 남았습니다.';
  const copy = hasStrokes ? ['익숙한 방에 당신의 흔적이 남아 있습니다.', '당신이 남긴 선과 선택한 물건들입니다.', finalCopy]
    : ['이 방에서 남긴 기록을 다시 살펴봅니다.', finalCopy];

  return (
    <div className="report-stage report-stage-04">
      <p className="report-stage__eyebrow">
        <span className="report-stage__eyebrow-code">REPORT {String(index).padStart(2, '0')}</span>
        <span className="report-stage__eyebrow-sep" aria-hidden="true">·</span>
        <span className="report-stage__eyebrow-title">선택한 자리, 남겨둔 자리</span>
      </p>

      <div className="report-stage-04__room">
        <MemoryRoom
          selectedIds={record.memorySketch.selectedObjects}
          onSelectToggle={() => {}}
          onViewStart={() => {}}
          onViewEnd={() => {}}
          interactive={false}
          highlightIds={unselected.map((object) => object.id)}
          highlightsVisible={showUnselected}
        />
        <canvas ref={canvasRef} width={ROOM_WIDTH} height={ROOM_HEIGHT} className="report-stage-04__canvas" />
      </div>

      <p className="report-stage-04__legend" aria-live="polite">
        {showUnselected && hasRecord && unselected.length > 0 ? <><span aria-hidden="true" />선택하지 않고 남겨둔 자리 · {unselected.map((object) => object.label).join(' · ')}</> : !hasRecord ? '선택 기록 없음 · 미선택 영역을 표시하지 않습니다.' : unselected.length === 0 ? '모든 물건을 선택했습니다.' : '선택한 물건과 남긴 흔적'}
      </p>
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
