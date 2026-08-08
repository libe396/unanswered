import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { createMemoryField, type MemoryFieldRenderer } from '../lib/memoryField';
import './MemoryField.css';

/**
 * Simulation grid. 544² = 295,936 particles.
 *
 * Kept in step with the body: every time the mass grows, the same particles
 * spread over a larger area and the field thins back toward the haze this
 * design keeps trying to become. Count is raised by the square of the size
 * change so the on-screen density stays put and only the size moves. The cost
 * is fill rate, not JS.
 */
const TEXTURE_SIZE_DESKTOP = 544;
const TEXTURE_SIZE_TOUCH = 256;

/**
 * How long after the last pointer movement the interference is released.
 *
 * This is the load-bearing number of the whole interaction. The pointer is not
 * a standing repulsor — it only disturbs the field while it is *moving*. Stop,
 * and within a fraction of a second the push is gone and the spring starts
 * pulling the form back together. Making this longer turns the cursor into a
 * hole the field can never close.
 */
const POINTER_IDLE_MS = 140;

/** Radius around the centre, as a fraction of the smaller viewport axis, that
 *  counts as being over the mass. Generous: the field has no edge to hit. */
const HOVER_RADIUS_RATIO = 0.34;

/** Entry is a hand-off across two Scenes and a store write, and every stage of
 *  it is invisible if one link is broken. Traced in dev builds only. */
function trace(stage: string) {
  if (import.meta.env.DEV) console.info(`[entry] ${stage}`);
}

/** Duration of the gather into the vertical line. The elevator doors take over
 *  from there — see IntroScene — so this is only the first half of the entry. */
const COLLAPSE_MS = 1300;
const COLLAPSE_MS_REDUCED = 520;

/**
 * Fraction of the collapse spent moving; the remainder is spent arriving.
 *
 * The particles chase their target through a spring, so driving the target all
 * the way to the line on the final frame hands the elevator a soft smudge
 * rather than a line — measured at 122 × 491 css px when this was 1.0. Reaching
 * the final geometry early and holding gives the spring time to close, and the
 * hold is invisible because the field is still visibly tightening during it.
 */
const COLLAPSE_SETTLE_FRACTION = 0.56;

/** Frames run without drawing, to bring the still frame to rest. */
const REDUCED_MOTION_SETTLE_STEPS = 520;

/** Cubic ease-in-out. Slow to commit, quick through the middle, settling into
 *  the line rather than arriving at it — the opposite of a linear collapse. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface MemoryFieldProps {
  /** Fires once the mass has finished compressing into the line. */
  onEnter?: () => void;
  /** While false the field is inert: no hover, no click, no pointer cursor. */
  interactive?: boolean;
}

/**
 * The Landing scene's subject, and its only control.
 *
 * A volume of particles the archive is still reconstructing: it drifts between
 * half-formed targets and never finishes any of them. Moving the pointer
 * through it scatters the particles and leaves a faint trace on the ones that
 * were touched; holding still lets the form reassemble. Clicking it draws the
 * whole mass into a single vertical line of light, which the elevator Scene
 * picks up as its door seam.
 *
 * The simulation lives in lib/memoryField.ts. This component owns the
 * lifecycle — sizing, pointer and hover state, the entry timing, and teardown.
 */
export function MemoryField({ onEnter, interactive = true }: MemoryFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [unsupported, setUnsupported] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Read inside the frame loop, which must not be torn down and rebuilt every
  // time the parent re-renders or the callback identity changes.
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const textureSize = coarsePointer ? TEXTURE_SIZE_TOUCH : TEXTURE_SIZE_DESKTOP;

    let field: MemoryFieldRenderer | null = null;
    try {
      field = createMemoryField(canvas, textureSize);
    } catch (error) {
      // A driver that links neither program is not something the visitor can
      // act on, but silently showing an empty room would read as a broken page.
      console.error('MemoryField could not start', error);
      field = null;
    }

    if (!field) {
      setUnsupported(true);
      return;
    }

    const renderer = field;
    let rafId = 0;
    // Cancelling the pending frame is not enough on its own: a frame already
    // executing at teardown reschedules itself and the loop survives. Under
    // StrictMode's double mount that stacks loops onto one canvas.
    let cancelled = false;
    let lastFrame = performance.now();
    const startedAt = lastFrame;
    let lastPointerMoveAt = -Infinity;
    let pointerX = 0;
    let pointerY = 0;
    let isOver = false;
    let collapseStartedAt = 0;
    let entered = false;

    function applySize() {
      // clientWidth/Height rather than getBoundingClientRect: Landing reveals
      // this element with an animated scale, and the bounding rect reports the
      // transformed box — which would resize the drawing buffer every frame of
      // the reveal, and settle on a size 4% off.
      const width = host!.clientWidth;
      const height = host!.clientHeight;
      if (!width || !height) return;
      renderer.resize(width, height, Math.min(window.devicePixelRatio || 1, 2));
    }

    /** Whether a point in canvas-local CSS pixels is over the mass. */
    function isOverMass(x: number, y: number) {
      const rect = canvas!.getBoundingClientRect();
      const radius = Math.min(rect.width, rect.height) * HOVER_RADIUS_RATIO;
      return Math.hypot(x - rect.width / 2, y - rect.height / 2) < radius;
    }

    function updateHover() {
      const next = interactiveRef.current && !collapseStartedAt && isOverMass(pointerX, pointerY);
      if (next !== isOver) {
        isOver = next;
        setHovered(next);
      }
      renderer.setHover(isOver);
    }

    function handleMove(event: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
      lastPointerMoveAt = performance.now();
      updateHover();
    }

    function handleLeave() {
      lastPointerMoveAt = -Infinity;
      isOver = false;
      setHovered(false);
      renderer.setHover(false);
    }

    /**
     * Hit-tested from the click's own coordinates rather than from the last
     * hover state. Trusting `isOver` meant a click that arrived without a
     * preceding mousemove — a tap, an assistive click, anything synthetic —
     * was silently swallowed and the visitor simply could not enter.
     */
    function handleClick(event: MouseEvent) {
      trace('particle-click');
      const rect = canvas!.getBoundingClientRect();
      const overMass = isOverMass(event.clientX - rect.left, event.clientY - rect.top);
      if (!interactiveRef.current || collapseStartedAt || !overMass) return;
      collapseStartedAt = performance.now();
      isOver = false;
      setHovered(false);
      renderer.setHover(false);
      trace('collapse-start');
    }

    applySize();

    if (prefersReducedMotion) {
      // Still an unfinished reconstruction, just a motionless one: settled onto
      // the first target, with the permanent per-particle offsets intact.
      renderer.settle(REDUCED_MOTION_SETTLE_STEPS);
      renderer.draw();
      const staticObserver = new ResizeObserver(() => {
        applySize();
        renderer.draw();
      });
      staticObserver.observe(host);
      // Entry still has to work; it just does not get an animation. The line is
      // held briefly so the cut to the door seam is still a cut and not a jump.
      function handleReducedClick(event: MouseEvent) {
        trace('particle-click');
        const rect = canvas!.getBoundingClientRect();
        if (!interactiveRef.current || entered) return;
        if (!isOverMass(event.clientX - rect.left, event.clientY - rect.top)) return;
        entered = true;
        trace('collapse-start');
        renderer.setCollapse(1);
        renderer.settle(90);
        renderer.draw();
        window.setTimeout(() => {
          trace('collapse-complete');
          onEnterRef.current?.();
        }, COLLAPSE_MS_REDUCED);
      }
      canvas.addEventListener('click', handleReducedClick);
      return () => {
        staticObserver.disconnect();
        canvas.removeEventListener('click', handleReducedClick);
        renderer.dispose();
      };
    }

    function tick(now: number) {
      if (cancelled) return;
      // Clamped so a backgrounded tab does not resume with one enormous step
      // and fling the whole field off screen.
      const delta = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;

      if (collapseStartedAt) {
        const raw = Math.min((now - collapseStartedAt) / COLLAPSE_MS, 1);
        renderer.setCollapse(easeInOutCubic(Math.min(raw / COLLAPSE_SETTLE_FRACTION, 1)));
        if (raw >= 1 && !entered) {
          entered = true;
          trace('collapse-complete');
          onEnterRef.current?.();
        }
      }

      renderer.setPointer(pointerX, pointerY, now - lastPointerMoveAt < POINTER_IDLE_MS);
      renderer.frame((now - startedAt) / 1000, delta);
      rafId = requestAnimationFrame(tick);
    }

    const observer = new ResizeObserver(applySize);
    observer.observe(host);
    window.addEventListener('mousemove', handleMove, { passive: true });
    document.addEventListener('mouseleave', handleLeave);
    canvas.addEventListener('click', handleClick);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseleave', handleLeave);
      canvas.removeEventListener('click', handleClick);
      cancelAnimationFrame(rafId);
      renderer.dispose();
    };
  }, [prefersReducedMotion]);

  return (
    <div
      className={`memory-field${hovered ? ' memory-field--hovered' : ''}`}
      ref={hostRef}
      aria-hidden="true"
    >
      <canvas className="memory-field__canvas" ref={canvasRef} />
      {unsupported ? <div className="memory-field__fallback" /> : null}
    </div>
  );
}
