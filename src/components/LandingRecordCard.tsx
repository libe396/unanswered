import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import { useReducedMotion } from 'framer-motion';
import portraitUrl from '../assets/landing/unknown-presence-v3.jpg';
import './LandingRecordCard.css';

/**
 * The record the archive is still reading.
 *
 * One object in the middle of Landing: a dim photographic print of the unknown
 * person, held inside a tilted sheet of frosted glass. A scan line crosses the
 * photograph on a loop, and four analysis notes are pinned to places on the
 * print and lead out to both margins. Only the photograph reacts — the notes
 * stay quiet until the pointer comes near the region they describe.
 *
 * Layout, timings and crop come from lab/landing-scan.html, the approved
 * Landing direction. The entry itself stays with MemoryField: this card only
 * has to come apart when the visitor goes in.
 */

interface Note {
  key: string;
  value: string;
  side: 'left' | 'right';
  /** Anchor inside the print, as a fraction of the photo. */
  x: number;
  y: number;
  /** Leader line shape: horizontal/vertical steps before it reaches the margin. */
  path: string;
}

const NOTES: Note[] = [
  { key: 'NAME', value: 'UNKNOWN', side: 'left', x: 0.42, y: 0.23, path: '' },
  { key: 'FACE', value: 'NOT IDENTIFIED', side: 'right', x: 0.6, y: 0.38, path: 'h:0.16 v:-0.11' },
  { key: 'CLUES', value: '0 / 4', side: 'left', x: 0.2, y: 0.61, path: 'v:-0.24' },
  { key: 'STATUS', value: 'UNANSWERED', side: 'right', x: 0.68, y: 0.73, path: 'h:0.10 v:0.08' },
];

/** Thin stacked edges behind the front face, so the glass reads as a slab. */
const SLAB_DEPTHS = [-18, -15, -12, -9, -6, -3];

const FIRST_DELAY_MS = 1800;
const SWEEP_MS = 3600;
const REST_MS = 5600;
/** Negative: headroom above the source image, so the figure sits lower. */
const CROP_TOP = -0.07;
const SCRAMBLE_MS = 480;
/** Must stay inside MemoryField's 1300ms collapse — no new waiting is added. */
const DISSOLVE_MS = 1100;
/** How close to an anchor the pointer has to be, as a fraction of the photo width. */
const HOT_RADIUS_RATIO = 0.26;
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/';

interface Part { x: number; y: number; r: number; a: number; ph: number }

const easeInOutQuad = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

interface LandingRecordCardProps {
  /** True once the entry collapse has started; the card comes apart. */
  entering: boolean;
  /** The glass card is the mass Landing measures dwell against. */
  cardRef: RefObject<HTMLDivElement | null>;
}

export function LandingRecordCard({ entering, cardRef }: LandingRecordCardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const recordRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const enteringAtRef = useRef<number | null>(null);
  useEffect(() => {
    enteringAtRef.current = entering ? performance.now() : null;
  }, [entering]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const print = printRef.current;
    const record = recordRef.current;
    const canvas = canvasRef.current;
    const svg = svgRef.current;
    const ctx = canvas?.getContext('2d');
    if (!wrap || !print || !record || !canvas || !svg || !ctx) return;

    const noteEls = Array.from(wrap.querySelectorAll<HTMLElement>('.landing-record__note'));
    const anchorEls = Array.from(record.querySelectorAll<HTMLElement>('.landing-record__anchor'));
    const groupEls = Array.from(svg.querySelectorAll<SVGGElement>('.landing-record__leader'));

    let disposed = false;
    let raf = 0;
    let ready = false;
    let width = 0;
    let height = 0;
    let cover = { s: 1, dy: 0, dh: 0 };
    let parts: Part[] = [];
    let wrapBox: DOMRect | null = null;
    let columnLeft = 0;
    let columnRight = 0;
    let pointer: { x: number; y: number; energy: number; inside: boolean } | null = null;
    let hot = -1;
    const tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const startedAt = performance.now();
    const image = new Image();

    /** Where the leader lines end: just outside the print, inside the screen. */
    function measureColumns() {
      wrapBox = wrap!.getBoundingClientRect();
      const printBox = print!.getBoundingClientRect();
      const outset = 36;
      const edge = 48;
      const rightWidth = Math.max(
        0,
        ...noteEls.filter((n) => n.dataset.side === 'right').map((n) => n.offsetWidth),
      );
      columnLeft = printBox.left - wrapBox.left - outset;
      columnRight = Math.min(
        printBox.right - wrapBox.left + outset,
        wrapBox.width - edge - rightWidth - 12,
      );
      svg!.setAttribute('viewBox', `0 0 ${wrapBox.width} ${wrapBox.height}`);
    }

    /** The anchors live inside the tilted card, so every frame reads back where
     *  they actually landed on screen. The note text itself is never tilted. */
    function updateNotes() {
      if (!wrapBox) return;
      NOTES.forEach((note, i) => {
        const anchorBox = anchorEls[i].getBoundingClientRect();
        const x = anchorBox.left - wrapBox!.left;
        const y = anchorBox.top - wrapBox!.top;
        const endX = note.side === 'left' ? columnLeft : columnRight;
        const points: [number, number][] = [[x, y]];
        let cx = x;
        let cy = y;
        for (const step of note.path.split(' ').filter(Boolean)) {
          const [axis, value] = step.split(':');
          const delta = parseFloat(value);
          if (axis === 'h') cx += delta * width;
          else cy += delta * height;
          points.push([cx, cy]);
        }
        points.push([endX, cy]);
        // Start the line clear of the sight, not under it.
        const [nx, ny] = points[1];
        points[0] = [x + Math.sign(nx - x) * 5, y + Math.sign(ny - y) * 5];

        const group = groupEls[i];
        const [line, tick, pin] = Array.from(group.children) as [SVGPolylineElement, SVGLineElement, SVGGElement];
        line.setAttribute('points', points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
        tick.setAttribute('x1', String(endX));
        tick.setAttribute('x2', String(endX));
        tick.setAttribute('y1', String(cy - 4));
        tick.setAttribute('y2', String(cy + 4));
        const [sight, dot] = Array.from(pin.children) as [SVGRectElement, SVGCircleElement];
        sight.setAttribute('x', String(x - 5));
        sight.setAttribute('y', String(y - 5));
        dot.setAttribute('cx', String(x));
        dot.setAttribute('cy', String(y));

        const el = noteEls[i];
        el.style.top = `${cy}px`;
        if (note.side === 'left') {
          el.style.right = `${wrapBox!.width - endX + 10}px`;
          el.style.left = 'auto';
        } else {
          el.style.left = `${endX + 10}px`;
          el.style.right = 'auto';
        }
      });
    }

    function fitCrop() {
      const s = width / image.naturalWidth;
      cover = { s, dy: -CROP_TOP * image.naturalHeight * s, dh: image.naturalHeight * s };
    }

    /** Light specks lifted off the photograph, so the scan has something to catch. */
    function sample() {
      const gw = 96;
      const gh = 144;
      const off = document.createElement('canvas');
      off.width = gw;
      off.height = gh;
      const octx = off.getContext('2d');
      if (!octx) return;
      octx.drawImage(image, 0, 0, gw, gh);
      const data = octx.getImageData(0, 0, gw, gh).data;
      parts = [];
      for (let i = 0; i < 1500; i += 1) {
        const x = (Math.random() * gw) | 0;
        const y = (Math.random() * gh) | 0;
        const k = (y * gw + x) * 4;
        const lum = (data[k] + data[k + 1] + data[k + 2]) / 765;
        if (lum < 0.22) continue;
        const py = cover.dy + ((y + Math.random()) / gh) * cover.dh;
        if (py < 0 || py > height) continue;
        parts.push({
          x: ((x + Math.random()) / gw) * width,
          y: py,
          r: 0.35 + Math.random() * 0.7,
          a: lum,
          ph: Math.random() * 6.28,
        });
      }
    }

    function layout() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = record!.offsetWidth;
      height = record!.offsetHeight;
      if (!width || !height) return;
      canvas!.width = Math.round(width * ratio);
      canvas!.height = Math.round(height * ratio);
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
      measureColumns();
      if (ready) {
        fitCrop();
        sample();
        updateNotes();
        if (reducedMotion) draw(performance.now());
      }
    }

    function scanState(now: number) {
      const t = now - startedAt - FIRST_DELAY_MS;
      if (t < 0 || reducedMotion) return { on: false, y: -999, progress: 0 };
      const m = t % (SWEEP_MS + REST_MS);
      if (m > SWEEP_MS) return { on: false, y: -999, progress: 1 };
      const progress = easeInOutQuad(m / SWEEP_MS);
      return { on: true, y: -0.04 * height + progress * 1.08 * height, progress };
    }

    /** The value finds its way back to itself instead of simply appearing. */
    function scramble(el: HTMLElement, text: string) {
      if (reducedMotion) {
        el.textContent = text;
        return;
      }
      const begun = performance.now();
      const tick = () => {
        if (disposed) return;
        const k = Math.min(1, (performance.now() - begun) / SCRAMBLE_MS);
        const settled = Math.floor(k * text.length);
        el.textContent =
          text.slice(0, settled) +
          Array.from(text.slice(settled))
            .map((c) => (c === ' ' ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
            .join('');
        if (k < 1) requestAnimationFrame(tick);
        else el.textContent = text;
      };
      tick();
    }

    function setHot(next: number) {
      if (next === hot) return;
      if (hot >= 0) {
        noteEls[hot].classList.remove('is-on');
        groupEls[hot].classList.remove('is-on');
      }
      hot = next;
      if (hot >= 0) {
        noteEls[hot].classList.add('is-on');
        groupEls[hot].classList.add('is-on');
        const value = noteEls[hot].querySelector<HTMLElement>('.landing-record__value');
        if (value) scramble(value, NOTES[hot].value);
      }
    }

    /** The card comes apart into the light it was holding. */
    function drawDissolve(now: number, dissolveAt: number) {
      const p = Math.min(1, Math.max(0, (now - dissolveAt) / DISSOLVE_MS));
      ctx!.clearRect(0, 0, width, height);
      ctx!.globalAlpha = Math.max(0, 1 - p * 1.6);
      if (cover.dy > 0) ctx!.drawImage(image, 0, 0, image.naturalWidth, 6, 0, 0, width, cover.dy + 2);
      ctx!.drawImage(image, 0, cover.dy, width, cover.dh);
      ctx!.globalAlpha = 1;
      parts.forEach((part, i) => {
        const t = Math.max(0, Math.min((p - (i % 17) / 60) / 0.8, 1));
        const drift = t * t;
        const x = part.x + (part.x / width - 0.5) * 90 * drift + Math.sin(i) * 18 * drift;
        const y = part.y - (18 + (i % 23) * 2) * drift;
        ctx!.fillStyle = `rgba(226,228,240,${(part.a * Math.sin(Math.PI * t) * 0.9).toFixed(3)})`;
        ctx!.fillRect(x, y, part.r + 0.3, part.r + 0.3);
      });
    }

    function draw(now: number) {
      const dissolveAt = enteringAtRef.current;
      if (dissolveAt !== null) {
        pointer = null;
        setHot(-1);
        drawDissolve(now, dissolveAt);
        return;
      }
      const scan = scanState(now);
      const tt = reducedMotion ? 0 : now / 1000;
      ctx!.clearRect(0, 0, width, height);
      // Headroom above the source image: stretch its top rows so no seam shows.
      if (cover.dy > 0) ctx!.drawImage(image, 0, 0, image.naturalWidth, 6, 0, 0, width, cover.dy + 2);
      ctx!.drawImage(image, 0, cover.dy, width, cover.dh);

      // Bands of the photograph slip sideways: under the scan line, and under
      // the pointer while it is reading a region.
      const bands: { y: number; w: number; amp: number }[] = [];
      if (scan.on) bands.push({ y: scan.y, w: 40, amp: 12 });
      if (pointer && !reducedMotion) bands.push({ y: pointer.y, w: 36, amp: 13 * pointer.energy });
      for (const band of bands) {
        const y0 = Math.max(0, band.y - band.w * 2.4);
        const y1 = Math.min(height, band.y + band.w * 2.4);
        if (y1 <= y0) continue;
        ctx!.clearRect(0, y0, width, y1 - y0);
        for (let y = y0; y < y1; y += 3) {
          const g = Math.exp(-Math.pow((y - band.y) / band.w, 2));
          const offset =
            g * band.amp * Math.sin(tt * 7 + y * 0.09) + g * band.amp * 0.5 * Math.sin(y * 0.31 + tt * 3);
          ctx!.drawImage(
            image,
            0,
            (y - cover.dy) / cover.s,
            width / cover.s,
            3 / cover.s,
            offset,
            y,
            width,
            3,
          );
        }
      }

      if (scan.on) {
        const y = scan.y;
        const trail = ctx!.createLinearGradient(0, y - 120, 0, y);
        trail.addColorStop(0, 'rgba(159,178,242,0)');
        trail.addColorStop(1, 'rgba(159,178,242,0.10)');
        ctx!.fillStyle = trail;
        ctx!.fillRect(0, y - 120, width, 120);
        const line = ctx!.createLinearGradient(0, 0, width, 0);
        line.addColorStop(0, 'rgba(159,178,242,0.1)');
        line.addColorStop(0.5, 'rgba(214,222,250,0.75)');
        line.addColorStop(1, 'rgba(159,178,242,0.1)');
        ctx!.fillStyle = line;
        ctx!.fillRect(0, y - 0.5, width, 1);
      }

      for (const part of parts) {
        let x = part.x + Math.sin(tt * 0.4 + part.ph) * 2.2;
        let y = part.y + Math.cos(tt * 0.33 + part.ph) * 1.6;
        let a = part.a * 0.16;
        if (scan.on) {
          const g = Math.exp(-Math.pow((y - scan.y) / 30, 2));
          a += g * 0.85;
          x += g * 6 * Math.sin(part.ph * 3);
        }
        if (pointer) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 12000) {
            const f = (1 - d2 / 12000) * 16 * pointer.energy;
            const d = Math.sqrt(d2 + 1);
            x += (dx / d) * f;
            y += (dy / d) * f;
            a += 0.4 * pointer.energy;
          }
        }
        ctx!.fillStyle = `rgba(226,228,240,${Math.min(a, 1).toFixed(3)})`;
        ctx!.fillRect(x, y, part.r, part.r);
      }

      if (pointer && !pointer.inside) {
        pointer.energy *= 0.94;
        if (pointer.energy < 0.02) pointer = null;
      }
      if (percentRef.current) {
        percentRef.current.textContent = String(Math.round(scan.progress * 100)).padStart(3, '0');
      }
    }

    function frame(now: number) {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      if (!ready) return;
      draw(now);
      if (!reducedMotion) {
        tilt.x += (tilt.targetX - tilt.x) * 0.06;
        tilt.y += (tilt.targetY - tilt.y) * 0.06;
        print!.style.setProperty('--rx', `${tilt.x.toFixed(2)}deg`);
        print!.style.setProperty('--ry', `${tilt.y.toFixed(2)}deg`);
        wrap!.style.setProperty('--px', (-tilt.y / 6).toFixed(3));
        wrap!.style.setProperty('--py', (tilt.x / 4).toFixed(3));
      }
      updateNotes();
    }

    function handleScenePointer(event: PointerEvent) {
      if (reducedMotion) return;
      const rect = wrap!.getBoundingClientRect();
      tilt.targetY = ((event.clientX - rect.left) / rect.width - 0.5) * 6;
      tilt.targetX = -((event.clientY - rect.top) / rect.height - 0.5) * 4;
    }

    // Local to the canvas: the browser has already undone the tilt for us.
    function handleCanvasPointer(event: PointerEvent) {
      const x = event.offsetX;
      const y = event.offsetY;
      if (x < 0 || y < 0 || x > width || y > height) return;
      pointer = { x, y, energy: 1, inside: true };
      let best = -1;
      let bestDistance = Infinity;
      NOTES.forEach((note, i) => {
        const d = Math.hypot(note.x * width - x, note.y * height - y);
        if (d < bestDistance) {
          bestDistance = d;
          best = i;
        }
      });
      setHot(bestDistance < width * HOT_RADIUS_RATIO ? best : -1);
    }

    function handleCanvasLeave() {
      if (pointer) pointer.inside = false;
      setHot(-1);
    }

    noteEls.forEach((el, i) => {
      const meta = el.querySelector<HTMLElement>('.landing-record__meta');
      if (meta) {
        meta.textContent = `${NOTES[i].key}  ·  X ${NOTES[i].x.toFixed(2)}  ·  Y ${NOTES[i].y.toFixed(2)}`;
      }
    });

    image.onload = () => {
      if (disposed) return;
      ready = true;
      layout();
      if (reducedMotion) draw(performance.now());
    };
    image.src = portraitUrl;

    const observer = new ResizeObserver(() => layout());
    observer.observe(record);
    observer.observe(wrap);
    window.addEventListener('pointermove', handleScenePointer, { passive: true });
    canvas.addEventListener('pointermove', handleCanvasPointer);
    canvas.addEventListener('pointerleave', handleCanvasLeave);
    if (document.fonts) document.fonts.ready.then(() => { if (!disposed) layout(); });
    layout();
    // A still Landing still has to come apart on entry, so the loop runs either
    // way; with reduced motion every moving term above is already frozen.
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      image.onload = null;
      window.removeEventListener('pointermove', handleScenePointer);
      canvas.removeEventListener('pointermove', handleCanvasPointer);
      canvas.removeEventListener('pointerleave', handleCanvasLeave);
    };
  }, [reducedMotion]);

  return (
    <div
      className={`landing-record${entering ? ' landing-record--entering' : ''}`}
      ref={wrapRef}
      aria-hidden="true"
    >
      <div className="landing-record__glow" />
      {/* Other records in the archive, out of focus at different depths. */}
      <i className="landing-record__plate landing-record__plate--far" />
      <i className="landing-record__plate landing-record__plate--near" />
      <img className="landing-record__ghost" src={portraitUrl} alt="" draggable={false} />

      <div className="landing-record__print" ref={(node) => { printRef.current = node; cardRef.current = node; }}>
        {SLAB_DEPTHS.map((z) => (
          <i key={z} className="landing-record__slab" style={{ '--z': `${z}px` } as CSSProperties} />
        ))}
        <div className="landing-record__face" />
        <div className="landing-record__record" ref={recordRef}>
          <div className="landing-record__shot">
            <canvas ref={canvasRef} />
          </div>
          {NOTES.map((note) => (
            <i
              key={note.key}
              className="landing-record__anchor"
              style={{ left: `${note.x * 100}%`, top: `${note.y * 100}%` }}
            />
          ))}
        </div>
        <div className="landing-record__caption">
          <span>UNKNOWN RECORD</span>
          <span>
            SCAN <span ref={percentRef}>000</span>
          </span>
        </div>
      </div>

      <svg className="landing-record__leaders" ref={svgRef}>
        {NOTES.map((note) => (
          <g key={note.key} className="landing-record__leader">
            <polyline />
            <line className="landing-record__tick" />
            <g className="landing-record__pin">
              <rect width="10" height="10" />
              <circle r="1.6" />
            </g>
          </g>
        ))}
      </svg>
      {NOTES.map((note) => (
        <div
          key={note.key}
          className={`landing-record__note landing-record__note--${note.side}`}
          data-side={note.side}
        >
          <em className="landing-record__value">{note.value}</em>
          <small className="landing-record__meta" />
        </div>
      ))}
    </div>
  );
}
