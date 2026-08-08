import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { SKETCH_COLORS } from '../data/content';
import { useExperienceStore } from '../store/experienceStore';
import { computeEmptyAreaRatio, drawStrokes } from '../lib/memorySketch';
import { TerminalCorners } from '../components/TerminalCorners';
import { ZoneIntroCard } from '../components/ZoneIntroCard';
import type { Stroke, StrokePoint } from '../types';
import './MemorySketchScene.css';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const BRUSH_WIDTH = 5;

export function MemorySketchScene() {
  const lightArchive = useExperienceStore((s) => s.lightArchive);
  const setMemorySketch = useExperienceStore((s) => s.setMemorySketch);
  const completeScene = useExperienceStore((s) => s.completeScene);

  const [showIntro, setShowIntro] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeColor, setActiveColor] = useState(SKETCH_COLORS[0]);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const drawingRef = useRef<Stroke | null>(null);
  const lastInputRef = useRef(Date.now());

  function redraw(currentStroke?: Stroke | null) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const strokesToDraw = currentStroke ? [...strokes, currentStroke] : strokes;
    drawStrokes(context, strokesToDraw, canvas.width, canvas.height);
  }

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

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
    drawingRef.current = { points: [pointFromEvent(event)], color: activeColor, width: BRUSH_WIDTH };
    lastInputRef.current = Date.now();
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const current = drawingRef.current;
    if (!current) return;
    current.points.push(pointFromEvent(event));
    lastInputRef.current = Date.now();
    redraw(current);
  }

  function handlePointerUp() {
    const current = drawingRef.current;
    drawingRef.current = null;
    if (!current || current.points.length < 2) return;
    setStrokes((prev) => [...prev, current]);
  }

  function handleUndo() {
    setStrokes((prev) => prev.slice(0, -1));
    lastInputRef.current = Date.now();
  }

  function handleClear() {
    setStrokes([]);
    lastInputRef.current = Date.now();
  }

  function saveAndAdvance() {
    setMemorySketch({
      strokes,
      emptyAreaRatio: computeEmptyAreaRatio(strokes),
      lastInputAt: lastInputRef.current,
    });
    completeScene('memorySketch');
  }

  function handleConfirm() {
    if (strokes.length === 0) {
      setShowEmptyConfirm(true);
      return;
    }
    saveAndAdvance();
  }

  if (showIntro) {
    return (
      <ZoneIntroCard
        zone="ZONE 07"
        title="기억을 스케치한다."
        subtitle="기억은 항상 완전하지 않다."
        ctaLabel="스케치 시작"
        onContinue={() => setShowIntro(false)}
      />
    );
  }

  return (
    <div className="memory-sketch-scene">
      {lightArchive ? (
        <img src={lightArchive.imagePath} alt="" className="memory-sketch-scene__backdrop" />
      ) : null}
      <div className="memory-sketch-scene__backdrop-veil" />

      <p className="memory-sketch-scene__hint">흐릿한 기억 위에 당신의 흔적을 더하세요.</p>

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
              onClick={() => setActiveColor(color)}
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
        스케치 남기기
      </button>

      {showEmptyConfirm ? (
        <div className="memory-sketch-scene__modal-veil">
          <div className="memory-sketch-scene__modal">
            <TerminalCorners />
            <p className="memory-sketch-scene__modal-text">
              아무 흔적도 남기지 않고 기록하시겠습니까?
            </p>
            <div className="memory-sketch-scene__modal-actions">
              <button className="memory-sketch-scene__mini-btn" onClick={saveAndAdvance}>
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
