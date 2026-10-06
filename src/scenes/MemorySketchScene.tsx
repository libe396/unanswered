import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { MEMORY_MIN_OBJECT_SELECTION, MEMORY_ROOM_OBJECTS, SKETCH_COLORS } from '../data/content';
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
import { StageHeader } from '../components/StageHeader';
import { MemoryRoom } from '../components/MemoryRoom';
import { ROOM_WIDTH, ROOM_HEIGHT } from '../data/memoryRoomGeometry';
import type { SceneBehaviorRecord, Stroke, StrokePoint } from '../types';
import './MemorySketchScene.css';

const CANVAS_WIDTH = ROOM_WIDTH;
const CANVAS_HEIGHT = ROOM_HEIGHT;
const BRUSH_WIDTHS = [{ label: '가늘게', width: 2 }, { label: '보통', width: 4 }, { label: '굵게', width: 7 }];

/** The only implement the Zone offers. Named so the record has something to
 *  say when a second one is added, rather than a field that means nothing. */
const TOOL = 'brush';

type Phase = 'room' | 'drawingChoice' | 'drawing';

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
  const storedMemorySketch = useExperienceStore((s) => s.memorySketch);
  const setMemorySketch = useExperienceStore((s) => s.setMemorySketch);
  const completeScene = useExperienceStore((s) => s.completeScene);
  const tracking = useSceneTracking('memorySketch', MEMORY_TRACKING_GROUPS, {
    debugView: readMemoryTracking,
  });

  const [phase, setPhase] = useState<Phase>('room');
  // Seeded from any answer this visit already saved — finishMemory() below
  // always writes whatever these hold, so without this, Back navigation
  // followed by skipping (or finishing without redrawing) would silently
  // overwrite a real earlier answer with an empty one. A first-ever visit has
  // no prior `memorySketch`, so these fall back to empty exactly as before.
  const [selectedObjects, setSelectedObjects] = useState<string[]>(() => storedMemorySketch.selectedObjects);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(() => storedMemorySketch.strokes);
  const [activeColor, setActiveColor] = useState(SKETCH_COLORS[0]);
  const [activeWidth, setActiveWidth] = useState(2);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const drawingRef = useRef<Stroke | null>(null);
  const lastInputRef = useRef(Date.now());
  // Marks are numbered in the order they were begun. Sequential rather than
  // random because these ids are read by a person, in a console, next to a
  // canvas they have just drawn on.
  const strokeSeqRef = useRef(storedMemorySketch.strokes.reduce((max, stroke) => Math.max(max, Number(stroke.id?.replace('STROKE_', '')) || 0), 0));

  function redraw(currentStroke?: Stroke | null) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const strokesToDraw = currentStroke ? [...strokes, currentStroke] : strokes;
    // Smooth only this preview. Stored coordinates and tracking timestamps stay raw.
    drawStrokes(context, [], canvas.width, canvas.height);
    for (const stroke of strokesToDraw) {
      if (stroke.points.length < 2) continue;
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.width * CANVAS_WIDTH / 1200;
      context.beginPath();
      context.moveTo(stroke.points[0].x * canvas.width, stroke.points[0].y * canvas.height);
      for (let i = 1; i < stroke.points.length - 1; i += 1) {
        const point = stroke.points[i];
        const next = stroke.points[i + 1];
        context.quadraticCurveTo(point.x * canvas.width, point.y * canvas.height,
          (point.x + next.x) / 2 * canvas.width, (point.y + next.y) / 2 * canvas.height);
      }
      const end = stroke.points[stroke.points.length - 1];
      context.lineTo(end.x * canvas.width, end.y * canvas.height);
      context.stroke();
    }
  }

  useEffect(() => {
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

  useEffect(() => {
    setMemorySketch({ ...useExperienceStore.getState().memorySketch, selectedObjects, strokes,
      drawingUsed: strokes.length > 0, selectedColors: [...new Set(strokes.map((stroke) => stroke.color))],
      emptyAreaRatio: computeEmptyAreaRatio(strokes), lastInputAt: lastInputRef.current });
  }, [selectedObjects, strokes, setMemorySketch]);

  function selectWidth(width: number) {
    if (width === activeWidth) return;
    setActiveWidth(width);
    tracking.toolChange(SKETCH_GROUP, { tool: `${TOOL}:${width}`, color: activeColor });
  }

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
    drawingRef.current = { id, points: [point], color: activeColor, width: activeWidth };
    lastInputRef.current = Date.now();
    tracking.strokeStart(SKETCH_GROUP, id, point, {
      tool: `${TOOL}:${activeWidth}`,
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
    tracking.toolChange(SKETCH_GROUP, { tool: `${TOOL}:${activeWidth}`, color });
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


  const isRoom = phase === 'room';
  const isDrawing = phase === 'drawing';
  const isChoice = phase === 'drawingChoice';

  /*
    One object across all three phases: the room, with the stroke canvas laid
    over it. The canvas is `inset: 0` inside the same box the illustration
    fills, so the two rects are identical by construction and stay identical
    at any size — no observer needed. Stroke points stay normalized to 0–1; the canvas bitmap and SVG both use
    the final image dimensions, so display size never changes their alignment.
  */
  const surface = (
    <div className="memory-sketch-scene__surface">
      <MemoryRoom
        showSelectionMarkers
        showAvailableObjects
        selectedIds={selectedObjects}
        interactive={isRoom}
        onSelectToggle={toggleObject}
        onViewStart={(id) => tracking.viewStart(OBJECT_GROUP, id)}
        onViewEnd={(id) => tracking.viewEnd(OBJECT_GROUP, id)}
      />
      {isDrawing || strokes.length > 0 ? (
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={`memory-sketch-scene__canvas${
            isDrawing ? '' : ' memory-sketch-scene__canvas--preview'
          }`}
          aria-label="방 위에 흔적 덧그리기"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      ) : null}
    </div>
  );

  const collected = (
    <div className="memory-sketch-scene__collected">
      <p className="memory-sketch-scene__collected-label">남겨둔 흔적</p>
      {selectedObjects.length ? (
        <ol className="memory-sketch-scene__object-list">
          {selectedObjects.map((id, index) => {
            const label = MEMORY_ROOM_OBJECTS.find((item) => item.id === id)?.label ?? id;
            return (
              <li key={id} className="memory-sketch-scene__object">
                <span className="memory-sketch-scene__object-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="memory-sketch-scene__object-label">{label}</span>
                {isRoom ? (
                  <button
                    type="button"
                    className="memory-sketch-scene__object-remove"
                    onClick={() => toggleObject(id)}
                    aria-label={`${label} 선택 해제`}
                  >
                    ×
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="memory-sketch-scene__object-empty">선택한 사물이 여기에 남아요.</p>
      )}
    </div>
  );

  return (
    <div className="memory-sketch-scene memory-sketch-scene--room">
      <div className="memory-sketch-scene__workspace">
        <StageHeader
          eyebrow="기억의 흔적"
          title={isDrawing ? '남기고 싶은 흔적을 그려 주세요' : '그 사람은 무엇을 두고 갔을까요?'}
          description={
            isDrawing
              ? '남기고 싶은 곳에 선 하나를 그려 주세요. 그냥 넘어가도 됩니다.'
              : `물건을 ${MEMORY_MIN_OBJECT_SELECTION}개 이상 골라 주세요.`
          }
        />
        <div className="memory-sketch-scene__body">
          {surface}
          <aside className="memory-sketch-scene__sidebar" aria-label={isDrawing ? '드로잉 도구' : '선택한 흔적과 다음 단계'}>
            {isDrawing ? (
              <div className="memory-sketch-scene__controls" aria-label="드로잉 도구">
                <div className="memory-sketch-scene__colors" role="group" aria-label="선 색상">
                  {SKETCH_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`memory-sketch-scene__color${
                        activeColor === color ? ' memory-sketch-scene__color--active' : ''
                      }`}
                      style={{ background: color }}
                      onClick={() => selectColor(color)}
                      aria-label={color}
                      aria-pressed={activeColor === color}
                    />
                  ))}
                </div>

                <div className="memory-sketch-scene__widths" role="group" aria-label="선 굵기">
                  {BRUSH_WIDTHS.map(({ label, width }) => (
                    <button
                      key={width}
                      type="button"
                      className={`cta cta--secondary memory-sketch-scene__mini-btn${
                        activeWidth === width ? ' memory-sketch-scene__mini-btn--on' : ''
                      }`}
                      aria-pressed={activeWidth === width}
                      onClick={() => selectWidth(width)}
                    >
                      <span aria-hidden="true" style={{ height: width }} />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="memory-sketch-scene__actions">
                  <button
                    className="cta cta--secondary memory-sketch-scene__mini-btn"
                    onClick={handleUndo}
                    disabled={!strokes.length}
                  >
                    되돌리기
                  </button>
                  <button
                    className="cta cta--secondary memory-sketch-scene__mini-btn"
                    onClick={handleClear}
                    disabled={!strokes.length}
                  >
                    전체 지우기
                  </button>
                </div>

                <button
                  className="cta cta--primary memory-sketch-scene__confirm"
                  onClick={handleConfirm}
                >
                  기록 남기기
                </button>
              </div>
            ) : (
              <>
                {collected}
                {isChoice ? (
                  <div className="memory-sketch-scene__choice">
                    <p>더 남기고 싶은 흔적이 있나요?</p>
                    <div className="memory-sketch-scene__choice-actions">
                      <button className="cta cta--secondary" onClick={handleSkipDrawing}>
                        그리지 않고 계속
                      </button>
                      <button className="cta cta--primary" onClick={() => setPhase('drawing')}>
                        흔적 덧그리기
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="metric memory-sketch-scene__count">
                      <span className="metric__label">
                        {selectedObjects.length}개 선택
                        {selectedObjects.length < MEMORY_MIN_OBJECT_SELECTION
                          ? ` · ${MEMORY_MIN_OBJECT_SELECTION}개 이상 선택해 주세요`
                          : ''}
                      </span>
                    </p>
                    <button
                      className="cta cta--primary memory-sketch-scene__confirm"
                      onClick={proceedFromRoom}
                      disabled={selectedObjects.length < MEMORY_MIN_OBJECT_SELECTION}
                    >
                      다음으로
                    </button>
                  </>
                )}
              </>
            )}
          </aside>
        </div>
      </div>

      {showEmptyConfirm ? (
        <div className="memory-sketch-scene__modal-veil">
          <div className="memory-sketch-scene__modal glass">
            <p className="memory-sketch-scene__modal-text">
              아무 흔적도 남기지 않고 기록하시겠습니까?
            </p>
            <div className="memory-sketch-scene__modal-actions">
              <button className="cta cta--secondary" onClick={() => setShowEmptyConfirm(false)}>
                돌아가기
              </button>
              <button className="cta cta--primary" onClick={finishMemory}>
                계속하기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
