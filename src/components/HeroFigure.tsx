import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { createFigureRenderer, DESIGN_H } from '../lib/figureLight';
import './HeroFigure.css';

/** Where the head sits vertically in the design space — the anchor the cursor
 *  and the observation radius are measured against, since that is what people
 *  actually look at. */
const HEAD_CENTRE_RATIO = 160 / DESIGN_H;
/** How close the cursor must come, as a fraction of the figure's width, before
 *  observation starts accumulating. */
const NEAR_RADIUS_RATIO = 0.55;

/** Lag on the cursor, in seconds. The brief's 0.3–0.6s: long enough that the
 *  face is never seen reacting, only seen having reacted. */
const CURSOR_TAU = 0.45;
/** Observation accrues over seconds and releases over much longer, so the face
 *  responds to having been watched rather than to the pointer being present. */
const ENERGY_RISE_TAU = 3.2;
const ENERGY_FALL_TAU = 9;

/**
 * UNANSWERED's first investigation subject: a person whose identity has been
 * erased, not an abstract shape that resembles one.
 *
 * The figure is painted by the Light Rule System (`lib/figureLight.ts`) onto a
 * canvas — a portrait's worth of light and shadow cues, each laid down with a
 * noise-eroded brush so no boundary is a clean gradient. It should read as
 * somebody quiet on the first frame.
 *
 * What observation does is take it apart. As `energy` accumulates, the cues
 * that would let you identify a face — cheekbone, socket, mouth shadow — fade
 * fastest, while the structural ones hold. The longer it is looked at, the less
 * there is to recognise. Legibility never increases; that is the rule the whole
 * project rests on (ADR-012).
 */
export function HeroFigure() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const renderer = createFigureRenderer(canvas);
    const pointer = { x: Number.NaN, y: Number.NaN };
    const cursor = { x: 0, y: 0 };
    let energy = 0;
    let rafId = 0;
    // Cancelling the pending frame alone is not enough: if teardown lands while
    // a frame is executing, that frame reschedules itself and the loop survives
    // as a zombie. Under StrictMode's double-mount that stacks up loops all
    // painting the same canvas.
    let cancelled = false;
    let lastFrame = performance.now();
    const startedAt = lastFrame;

    function applySize() {
      const rect = host!.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      renderer.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 2));
    }

    function handleMove(event: MouseEvent) {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }

    function paint(time: number, dt: number) {
      const rect = host!.getBoundingClientRect();
      const centreX = rect.left + rect.width / 2;
      const headY = rect.top + rect.height * HEAD_CENTRE_RATIO;
      const idle = Number.isNaN(pointer.x);

      if (!idle) {
        const radius = Math.max(rect.width, rect.height) * 0.75;
        const rawX = Math.max(-1, Math.min(1, (pointer.x - centreX) / radius));
        const rawY = Math.max(-1, Math.min(1, (pointer.y - headY) / radius));
        const k = 1 - Math.exp(-dt / CURSOR_TAU);
        cursor.x += (rawX - cursor.x) * k;
        cursor.y += (rawY - cursor.y) * k;
      }

      const distance = idle
        ? Number.POSITIVE_INFINITY
        : Math.hypot(pointer.x - centreX, pointer.y - headY);
      const target = distance < rect.width * NEAR_RADIUS_RATIO ? 1 : 0;
      const tau = target > energy ? ENERGY_RISE_TAU : ENERGY_FALL_TAU;
      energy += (target - energy) * (1 - Math.exp(-dt / tau));

      renderer.render({ time, energy, cursorX: cursor.x, cursorY: cursor.y });
    }

    function tick(now: number) {
      if (cancelled) return;
      // Clamped so a backgrounded tab does not resume with one enormous step.
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      paint((now - startedAt) / 1000, dt);
      rafId = requestAnimationFrame(tick);
    }

    applySize();

    if (prefersReducedMotion) {
      // Still a portrait, just a fixed one: rendered at t=0 with no observation,
      // which is the intact state.
      renderer.render({ time: 0, energy: 0, cursorX: 0, cursorY: 0 });
      const observer = new ResizeObserver(() => {
        applySize();
        renderer.render({ time: 0, energy: 0, cursorX: 0, cursorY: 0 });
      });
      observer.observe(host);
      return () => observer.disconnect();
    }

    const observer = new ResizeObserver(applySize);
    observer.observe(host);
    window.addEventListener('mousemove', handleMove, { passive: true });
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener('mousemove', handleMove);
      cancelAnimationFrame(rafId);
    };
  }, [prefersReducedMotion]);

  return (
    <div className="hero-figure" ref={hostRef} aria-hidden="true">
      <canvas className="hero-figure__canvas" ref={canvasRef} />
    </div>
  );
}
