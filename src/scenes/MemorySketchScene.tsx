import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { MEMORY_MIN_OBJECT_SELECTION, SKETCH_COLORS } from '../data/content';
import { useExperienceStore } from '../store/experienceStore';
import { computeEmptyAreaRatio, drawStrokes } from '../lib/memorySketch';
import { logSceneTracking, useSceneTracking } from '../hooks/useSceneTracking';
import { detectMemoryPatterns } from '../lib/memoryPatterns';
import { playClueRecordedSignature } from '../lib/postElevatorAudio';
import {
  MEMORY_TRACKING_GROUPS,
  OBJECT_GROUP,
  SKETCH_GROUP,
  selectRoomVariant,
  summarizeMemory,
} from '../lib/memoryTracking';
import { MEMORY_THRESHOLDS } from '../lib/memoryThresholds';
import { TerminalCorners } from '../components/TerminalCorners';
import { ZoneIntroCard } from '../components/ZoneIntroCard';
import { MemoryRoom } from '../components/MemoryRoom';
import type { SceneBehaviorRecord, Stroke, StrokePoint } from '../types';
import './MemorySketchScene.css';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const BRUSH_WIDTH = 5;

/** The only implement the Zone offers. Named so the record has something to
 *  say when a second one is added, rather than a field that means nothing. */
const TOOL = 'brush';

type Phase = 'intro' | 'room' | 'drawingChoice' | 'drawing';

/**
 * How the Zone reads its own record back, in development.
 *
 * Named values rather than raw events, for the same reason as SOUND's: what is
 * worth checking is a figure against something that just happened — on the
 * canvas, or in the Room. The strokes, the object selections and the events
 * are still underneath, as the thing every figure above them can be checked
 * against.
 */
function readMemoryTracking(record: SceneBehaviorRecord) {
  const summary = summarizeMemory(record);
  return {
    events: record.events,
    strokes: summary.strokes,
    survivingStrokes: summary.survivingStrokes,

    // Object exploration
    hasObjectViewData: summary.hasObjectViewData,
    objectViewPath: summary.objectViewPath,
    dwellByObject: summary.dwellByObject,
    viewCountByObject: summary.viewCountByObject,
    revisitCountByObject: summary.revisitCountByObject,
    firstViewedObject: summary.firstViewedObject,
    mostViewedObject: summary.mostViewedObject,

    // Object selection
    firstSelectedObject: summary.firstSelectedObject,
    finalSelectedObjects: summary.finalSelectedObjects,
    objectSelectionPath: summary.objectSelectionPath,
    objectSelectionChangeCount: summary.objectSelectionChangeCount,
    deselectionCount: summary.deselectionCount,
    objectReturns: summary.objectReturns,
    firstValidObjectSet: summary.firstValidObjectSet,

    // Drawing status + timing
    drawingEntered: summary.drawingEntered,
    drawingUsed: summary.drawingUsed,
    msToFirstStroke: summary.msToFirstStroke,
    msToFirstCanvasTouch: summary.msToFirstCanvasTouch,
    totalDrawingMs: summary.totalDrawingMs,
    activeDrawingMs: summary.activeDrawingMs,
    pauses: summary.pauses,
    totalPauseMs: summary.totalPauseMs,
    longestPauseMs: summary.longestPauseMs,
    msFromLastStrokeToCommit: summary.msFromLastStrokeToCommit,
    postDrawingMs: summary.postDrawingMs,

    strokeCount: summary.strokeCount,
    survivingStrokeCount: summary.survivingStrokeCount,
    discardedStrokeCount: summary.discardedStrokeCount,
    trivialStrokeCount: summary.trivialStrokeCount,
    totalPointCount: summary.totalPointCount,
    totalRawPointCount: summary.totalRawPointCount,
    totalStrokeLength: summary.totalStrokeLength,
    undoCount: summary.undoCount,
    clearCount: summary.clearCount,
    eraseCount: summary.eraseCount,
    toolChangeCount: summary.toolChangeCount,
    colorChangeCount: summary.colorChangeCount,

    boundingBox: summary.boundingBox,
    canvasCoverageRatio: summary.canvasCoverageRatio,
    boundingBoxAreaRatio: summary.boundingBoxAreaRatio,
    centerOfDrawing: summary.centerOfDrawing,
    quadrantDistribution: summary.quadrantDistribution,
    edgeVsCenterDistribution: summary.edgeVsCenterDistribution,

    removedStrokeCount: summary.removedStrokeCount,
    eraseReturns: summary.eraseReturns,
    eraseReturnCount: summary.eraseReturnCount,
    redrawnAreaCount: summary.redrawnAreaCount,
    strokesAfterClearCount: summary.strokesAfterClearCount,

    patterns: detectMemoryPatterns(summary),
    thresholds: MEMORY_THRESHOLDS,
    summary,
  };
}

export function MemorySketchScene() {
  const setMemorySketch = useExperienceStore((s) => s.setMemorySketch);
  const completeScene = useExperienceStore((s) => s.completeScene);
  const tracking = useSceneTracking('memorySketch', MEMORY_TRACKING_GROUPS, {
    debugView: readMemoryTracking,
  });

  const [phase, setPhase] = useState<Phase>('intro');
  const [selectedObjects, setSelectedObjects] = useState<string[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeColor, setActiveColor] = useState(SKETCH_COLORS[0]);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const drawingRef = useRef<Stroke | null>(null);
  const lastInputRef = useRef(Date.now());
  // Marks are numbered in the order they were begun. Sequential rather than
  // random because these ids are read by a person, in a console, next to a
  // canvas they have just drawn on.
  const strokeSeqRef = useRef(0);

  function redraw(currentStroke?: Stroke | null) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const strokesToDraw = currentStroke ? [...strokes, currentStroke] : strokes;
    drawStrokes(context, strokesToDraw, canvas.width, canvas.height);
  }

  useEffect(() => {
    if (phase !== 'drawing') return;
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, phase]);

  /*
    Marks the Room's own question as in front of the visitor. Idempotent —
    openGroup ignores a repeat call — so re-running under StrictMode is safe.
  */
  useEffect(() => {
    if (phase !== 'room') return;
    tracking.openGroup(OBJECT_GROUP);
  }, [phase, tracking]);

  /*
    Submitting the optional Drawing step is possible the instant its canvas
    appears — there is no minimum mark, just as v1 never required one — so
    the group opens and the Zone's proceed control is marked ready in the
    same beat. Both calls are recorded once however often this runs, which
    is what makes it safe under StrictMode's double-invoked effects.
  */
  useEffect(() => {
    if (phase !== 'drawing') return;
    tracking.openGroup(SKETCH_GROUP);
    tracking.advanceReady();
  }, [phase, tracking]);

  function toggleObject(id: string) {
    /*
      Computed from the rendered value rather than inside a functional
      updater. The result is the same — the object goes in or out — but
      React invokes updaters twice under StrictMode, and the tracker has to
      be told which happened, which cannot be worked out from inside a call
      that may run again. Exactly LightArchiveScene's toggleKeyword.
    */
    const isSelected = selectedObjects.includes(id);
    if (isSelected) {
      setSelectedObjects(selectedObjects.filter((objectId) => objectId !== id));
      tracking.deselect(OBJECT_GROUP, id);
    } else {
      setSelectedObjects([...selectedObjects, id]);
      tracking.select(OBJECT_GROUP, id);
    }
  }

  function proceedFromRoom() {
    tracking.commit(OBJECT_GROUP);
    setPhase('drawingChoice');
  }

  function pointFromEvent(event: PointerEvent<HTMLCanvasElement>): StrokePoint {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    return { x: x / canvas.width, y: y / canvas.height };
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    strokeSeqRef.current += 1;
    const id = `STROKE_${String(strokeSeqRef.current).padStart(2, '0')}`;
    drawingRef.current = { id, points: [point], color: activeColor, width: BRUSH_WIDTH };
    lastInputRef.current = Date.now();
    tracking.strokeStart(SKETCH_GROUP, id, point, {
      tool: TOOL,
      color: activeColor,
      // Carried through so a record made with a finger is never compared with
      // one made with a mouse as though the two reported movement alike.
      pointerType: event.pointerType,
    });
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const current = drawingRef.current;
    if (!current) return;
    const point = pointFromEvent(event);
    current.points.push(point);
    lastInputRef.current = Date.now();
    tracking.strokePoint(SKETCH_GROUP, point);
    redraw(current);
  }

  function handlePointerUp() {
    const current = drawingRef.current;
    drawingRef.current = null;
    if (!current) return;
    // The canvas's own rule, unchanged: a press that never moved is not a mark.
    // It is still recorded — reaching for the canvas and pulling back is a
    // thing that happened — but as a stroke that never landed.
    const discarded = current.points.length < 2;
    tracking.strokeEnd(SKETCH_GROUP, { discarded, reason: 'pointerUp' });
    if (discarded) return;
    setStrokes((prev) => [...prev, current]);
  }

  function handleUndo() {
    /*
      Computed from the rendered value rather than inside a functional updater.
      The result is the same — the last mark goes — but React invokes updaters
      twice under StrictMode, and the tracker has to be told which mark was
      removed, which cannot be worked out from inside a call that may run again.
    */
    const removed = strokes[strokes.length - 1];
    if (!removed) return;
    setStrokes(strokes.slice(0, -1));
    lastInputRef.current = Date.now();
    if (removed.id) tracking.removeStrokes(SKETCH_GROUP, [removed.id], 'undo');
  }

  function handleClear() {
    const ids = strokes.map((stroke) => stroke.id).filter((id): id is string => Boolean(id));
    setStrokes([]);
    lastInputRef.current = Date.now();
    tracking.removeStrokes(SKETCH_GROUP, ids, 'clear');
  }

  function selectColor(color: string) {
    // Pressing the colour already held is not a change, and recording it as one
    // would turn a visitor confirming their choice into one switching about.
    if (color === activeColor) return;
    setActiveColor(color);
    tracking.toolChange(SKETCH_GROUP, { tool: TOOL, color });
  }

  /**
   * Closes a mark still being drawn.
   *
   * Held in a ref so the unmount cleanup reaches the current one rather than
   * the closure it was created in. The mark never reaches the canvas — the
   * pointer never came up, so nothing was added to `strokes` — but it did
   * happen, and the record says so rather than losing the last thing the
   * visitor was doing when they left.
   */
  const finalizeRef = useRef<() => void>(() => {});
  finalizeRef.current = () => {
    if (!drawingRef.current) return;
    drawingRef.current = null;
    tracking.strokeEnd(SKETCH_GROUP, { discarded: true, reason: 'sceneExit' });
  };

  useEffect(
    () => () => {
      finalizeRef.current();
      tracking.save();
    },
    [tracking],
  );

  /**
   * The Zone's one finishing move, reached from either branch of STEP 3.
   *
   * Skipping Drawing never opens the 'sketch' group at all — `commit` is
   * still called on it, so the record always has a committedAt for the
   * question, but with no `openedAt` the summary reads this visit as never
   * having entered Drawing at all, distinct from having entered it and drawn
   * nothing. That distinction is `drawingEntered` in memoryTracking.ts.
   */
  function finishMemory() {
    finalizeRef.current();
    setMemorySketch({
      strokes,
      emptyAreaRatio: computeEmptyAreaRatio(strokes),
      lastInputAt: lastInputRef.current,
      roomVariant: selectRoomVariant(),
      selectedObjects,
      drawingUsed: strokes.length > 0,
      selectedColors: [...new Set(strokes.map((stroke) => stroke.color))],
    });
    tracking.commit(SKETCH_GROUP);
    logSceneTracking('memorySketch', tracking, readMemoryTracking);
    playClueRecordedSignature();
    completeScene('memorySketch');
  }

  function handleSkipDrawing() {
    lastInputRef.current = Date.now();
    finishMemory();
  }

  function handleConfirm() {
    if (strokes.length === 0) {
      setShowEmptyConfirm(true);
      return;
    }
    finishMemory();
  }

  if (phase === 'intro') {
    return (
      <ZoneIntroCard
        zone="ZONE 07"
        title="복원된 기억의 방."
        subtitle="수집된 단서를 바탕으로 공간의 일부가 복원되었습니다."
        ctaLabel="공간으로 들어가기"
        onContinue={() => setPhase('room')}
      />
    );
  }

  if (phase === 'room') {
    const canProceed = selectedObjects.length >= MEMORY_MIN_OBJECT_SELECTION;
    return (
      <div className="memory-sketch-scene">
        <p className="memory-sketch-scene__hint">
          이곳에 남아 있는 흔적을 살펴보고, 최소 {MEMORY_MIN_OBJECT_SELECTION}개를 선택하세요.
        </p>

        <MemoryRoom
          selectedIds={selectedObjects}
          onSelectToggle={toggleObject}
          onViewStart={(id) => tracking.viewStart(OBJECT_GROUP, id)}
          onViewEnd={(id) => tracking.viewEnd(OBJECT_GROUP, id)}
        />

        <button className="memory-sketch-scene__confirm" onClick={proceedFromRoom} disabled={!canProceed}>
          <TerminalCorners />
          다음으로
        </button>
      </div>
    );
  }

  // 'drawingChoice' and 'drawing' share the same Room-with-traces backdrop.
  return (
    <div className="memory-sketch-scene">
      <div className="memory-sketch-scene__room-backdrop" aria-hidden="true">
        <MemoryRoom
          selectedIds={selectedObjects}
          onSelectToggle={() => {}}
          onViewStart={() => {}}
          onViewEnd={() => {}}
          interactive={false}
        />
      </div>

      {phase === 'drawingChoice' ? (
        <div className="memory-sketch-scene__choice">
          <p className="memory-sketch-scene__hint">복원된 공간에서 빠진 흔적이 보인다면, 직접 덧그려 보세요.</p>
          <div className="memory-sketch-scene__choice-actions">
            <button className="memory-sketch-scene__mini-btn" onClick={handleSkipDrawing}>
              그대로 기록하기
            </button>
            <button
              className="memory-sketch-scene__confirm"
              onClick={() => setPhase('drawing')}
            >
              <TerminalCorners />
              흔적 덧그리기
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="memory-sketch-scene__hint">기억 속 비어 있는 흔적을 직접 덧그려 보세요.</p>

          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="memory-sketch-scene__canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />

          <div className="memory-sketch-scene__controls">
            <div className="memory-sketch-scene__colors">
              {SKETCH_COLORS.map((color) => (
                <button
                  key={color}
                  className={`memory-sketch-scene__color${
                    activeColor === color ? ' memory-sketch-scene__color--active' : ''
                  }`}
                  style={{ background: color }}
                  onClick={() => selectColor(color)}
                  aria-label={color}
                />
              ))}
            </div>
            <div className="memory-sketch-scene__actions">
              <button
                className="memory-sketch-scene__mini-btn"
                onClick={handleUndo}
                disabled={strokes.length === 0}
              >
                되돌리기
              </button>
              <button
                className="memory-sketch-scene__mini-btn"
                onClick={handleClear}
                disabled={strokes.length === 0}
              >
                전체 지우기
              </button>
            </div>
          </div>

          <button className="memory-sketch-scene__confirm" onClick={handleConfirm}>
            <TerminalCorners />
            기록 남기기
          </button>
        </>
      )}

      {showEmptyConfirm ? (
        <div className="memory-sketch-scene__modal-veil">
          <div className="memory-sketch-scene__modal">
            <TerminalCorners />
            <p className="memory-sketch-scene__modal-text">
              아무 흔적도 남기지 않고 기록하시겠습니까?
            </p>
            <div className="memory-sketch-scene__modal-actions">
              <button className="memory-sketch-scene__mini-btn" onClick={finishMemory}>
                계속하기
              </button>
              <button
                className="memory-sketch-scene__mini-btn"
                onClick={() => setShowEmptyConfirm(false)}
              >
                돌아가기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
