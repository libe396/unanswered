import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { drawStrokes } from '../../lib/memorySketch';
import { MemoryRoom } from '../../components/MemoryRoom';
import { ROOM_WIDTH, ROOM_HEIGHT, ROOM_OBJECT_GEOMETRY } from '../../data/memoryRoomGeometry';
import { MEMORY_ROOM_OBJECTS } from '../../data/content';
import type { RecordLayerDerived, SceneBehaviorRecord, Stroke } from '../../types';
import { useStageReveal } from './useStageReveal';
import { ReportStageNav } from './ReportStageNav';
import { REPORT_CONCLUSION } from '../../lib/reportFindingCopy';
import { HESITATION_VIEW_MS } from '../../lib/reportActionEvidence';
import { OBJECT_GROUP } from '../../lib/memoryTracking';
import { useExperienceStore } from '../../store/experienceStore';
import './ReportStage04MemoryReconstruction.css';

interface Props {
  record: RecordLayerDerived;
  index: number;
  total: number;
  locked: boolean;
  onAdvance: () => void;
  /** No REPORT 03 this visit: this stage carries the conclusion line instead. */
  conclude?: boolean;
  /** The conclusion to carry; defaults to the hesitation wording. */
  conclusion?: string;
}

const CONCLUSION_HOLD_MS = 3800;

/** Total hover time per object in the room, summed from the scene's own
 *  `view` events. Empty on touch, where nothing can be hovered. */
function objectDwellMs(events: SceneBehaviorRecord['events']): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const event of events) {
    if (event.type !== 'view' || event.group !== OBJECT_GROUP || !Number.isFinite(event.durationMs)) continue;
    totals[event.targetId] = (totals[event.targetId] ?? 0) + event.durationMs;
  }
  return totals;
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
export function ReportStage04MemoryReconstruction({ record, index, total, locked, onAdvance, conclude = false, conclusion = REPORT_CONCLUSION }: Props) {
  const prefersReducedMotion = useReducedMotion();
  const memory = record.memorySketch;
  const hasRecord = memory.lastInputAt > 0 || memory.selectedObjects.length > 0 || memory.strokes.length > 0;
  const unselected = hasRecord ? MEMORY_ROOM_OBJECTS.filter((object) => ROOM_OBJECT_GEOMETRY.some(({ id }) => id === object.id) && !memory.selectedObjects.includes(object.id)) : [];
  // Unselected objects the pointer rested on, longest first. Only real `view`
  // events count; without them (touch, older records) the stage falls back to
  // marking every unselected object, as before.
  const memoryEvents = useExperienceStore((state) => state.behavior.memorySketch?.events);
  const dwellMs = objectDwellMs(memoryEvents ?? []);
  const dwelled = unselected
    .filter((object) => (dwellMs[object.id] ?? 0) >= HESITATION_VIEW_MS)
    .map((object) => ({ ...object, ms: dwellMs[object.id], geometry: ROOM_OBJECT_GEOMETRY.find(({ id }) => id === object.id)! }))
    .sort((a, b) => b.ms - a.ms);
  const hasDwell = dwelled.length > 0;
  const overlayRef = useRef<SVGSVGElement>(null);
  const [labelScale, setLabelScale] = useState(1);
  useLayoutEffect(() => {
    const svg = overlayRef.current;
    if (!svg) return;
    const measure = () => {
      const matrix = svg.getScreenCTM();
      if (matrix) setLabelScale(1 / Math.max(0.01, Math.hypot(matrix.a, matrix.b)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(svg); measure();
    return () => observer.disconnect();
  }, [hasDwell]);
  // Labels sit just below each object, as the room's own hover label does,
  // and step further down when they would overlap one placed before them.
  const dwellLabels: { id: string; text: string; width: number; x: number; y: number; top: number; bottom: number }[] = [];
  for (const [rank, { id, label, ms, geometry }] of dwelled.entries()) {
    const text = `${label} · ${(ms / 1000).toFixed(1)}초`;
    const width = Math.max(96, text.length * 15 + 28);
    const x = geometry.marker[0];
    let y = geometry.marker[1] + 45 * labelScale;
    // Box extents in room units; the longest also carries its tag above.
    const above = (rank === 0 ? 52 : 21) * labelScale;
    const below = 19 * labelScale;
    const collides = () => dwellLabels.some((placed) =>
      Math.abs(placed.x - x) * 2 < (placed.width + width) * labelScale && y - above < placed.bottom && y + below > placed.top);
    for (let tries = 0; tries < 6 && collides(); tries++) y += 44 * labelScale;
    dwellLabels.push({ id, text, width, x, y, top: y - above, bottom: y + below });
  }
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
  const finalPhase = (hasStrokes ? 2 : 1) + (conclude ? 1 : 0);
  const [phase, setPhase] = useState(prefersReducedMotion ? finalPhase : 0);
  const revealed = useStageReveal(
    prefersReducedMotion ? 260 : (hasStrokes ? replayDurationMs + 4300 : 4300) + (conclude ? CONCLUSION_HOLD_MS : 0),
  );

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
    const lastAt = hasStrokes ? replayDurationMs + 3000 : 3000;
    const timers = hasStrokes
      ? [
          window.setTimeout(() => setPhase(1), 2200),
          window.setTimeout(() => setPhase(2), replayDurationMs + 3000),
        ]
      : [window.setTimeout(() => setPhase(1), 3000)];
    if (conclude) timers.push(window.setTimeout(() => setPhase((hasStrokes ? 2 : 1) + 1), lastAt + CONCLUSION_HOLD_MS));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [finalPhase, hasStrokes, prefersReducedMotion, replayDurationMs, conclude]);

  const finalCopy = !hasRecord ? '이 공간에 남겨진 선택 기록이 없습니다.'
    : unselected.length === 0 ? '선택할 수 있는 모든 물건을 기록에 남겼습니다.'
    : memory.selectedObjects.length === 0 ? '물건을 선택하지 않고 이 공간을 지나갔습니다.'
    : hasDwell ? '고르지 않았지만 오래 머문 자리도\n기록에 남았습니다.'
    : '선택하지 않고 남겨둔 자리도\n이번 기록에 함께 남았습니다.';
  const copy = [
    ...(hasStrokes ? ['익숙한 방에 당신의 흔적이 남아 있습니다.', '당신이 남긴 선과 선택한 물건들입니다.', finalCopy]
      : ['이 방에서 남긴 기록을 다시 살펴봅니다.', finalCopy]),
    ...(conclude ? [conclusion] : []),
  ];

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
          highlightIds={hasDwell ? [] : unselected.map((object) => object.id)}
          highlightsVisible={showUnselected}
        />
        <canvas ref={canvasRef} width={ROOM_WIDTH} height={ROOM_HEIGHT} className="report-stage-04__canvas" />
        {hasDwell ? (
          <svg ref={overlayRef} className={`report-stage-04__dwell${showUnselected ? ' report-stage-04__dwell--visible' : ''}`}
            viewBox={`0 0 ${ROOM_WIDTH} ${ROOM_HEIGHT}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {dwelled.map(({ id, geometry }) => (
              <path key={id} d={geometry.path} fillRule={id === 'cup' || id === 'window' ? 'evenodd' : 'nonzero'}
                className="report-stage-04__dwell-outline" />
            ))}
            {dwellLabels.map(({ id, text, width, x, y }, rank) => {
              return (
                <g key={id} className={`report-stage-04__dwell-label${rank === 0 ? ' report-stage-04__dwell-label--longest' : ''}`}
                  transform={`translate(${x} ${y}) scale(${labelScale})`}>
                  {rank === 0 ? <text className="report-stage-04__dwell-tag" y="-30" textAnchor="middle">가장 오래 머문 곳</text> : null}
                  <rect x={-width / 2} y="-19" width={width} height="36" rx="4" />
                  <text y="6" textAnchor="middle">{text}</text>
                </g>
              );
            })}
          </svg>
        ) : null}
      </div>

      <p className="report-stage-04__legend" aria-live="polite">
        {hasDwell ? <><span className="report-stage-04__key report-stage-04__key--selected" aria-hidden="true" />고른 것<span className="report-stage-04__key report-stage-04__key--dwell" aria-hidden="true" />머물렀던 것</>
          : showUnselected && hasRecord && unselected.length > 0 ? <><span aria-hidden="true" />선택하지 않고 남겨둔 자리 · {unselected.map((object) => object.label).join(' · ')}</> : !hasRecord ? '선택 기록 없음 · 미선택 영역을 표시하지 않습니다.' : unselected.length === 0 ? '모든 물건을 선택했습니다.' : '선택한 물건과 남긴 흔적'}
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
