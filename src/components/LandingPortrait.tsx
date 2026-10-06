import { useEffect, useRef, type RefObject } from 'react';
import { useReducedMotion } from 'framer-motion';
import portraitUrl from '../assets/landing/unknown-presence-v3.jpg';

interface Grain { x: number; y: number; dx: number; dy: number; vx: number; vy: number; light: number }

/** The diffuse presence gathers briefly, without revealing a face. */
export function LandingPortrait({ onEnter, subjectRef, entering }: { onEnter: () => void; subjectRef: RefObject<HTMLDivElement | null>; entering: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const faceGestureRef = useRef(false);
  const distortionRef = useRef({ x: 0.5, y: 0.3, strength: 0, lastMove: -Infinity });
  const reducedMotion = useReducedMotion();
  const entryAtRef = useRef<number | null>(null);
  useEffect(() => { entryAtRef.current = entering ? performance.now() : null; }, [entering]);

  function pointAt(clientX: number, clientY: number) {
    const rect = hostRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  }
  function isFace(point: { x: number; y: number }) {
    return point.x >= 0.18 && point.x <= 0.82 && point.y >= 0.12 && point.y <= 0.46;
  }
  function disturb(point: { x: number; y: number }, pulse = false) {
    if (!isFace(point) || reducedMotion) return;
    Object.assign(distortionRef.current, { x: point.x, y: point.y, lastMove: performance.now() + (pulse ? 220 : 0) });
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !host || !context) return;
    let disposed = false;
    let frame = 0;
    let width = 0;
    let height = 0;
    let previous = 0;
    const grains: Grain[] = [];
    const departing: { x: number; y: number; light: number }[] = [];
    const photo = new Image();
    const seed = (i: number) => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

    function draw(now: number) {
      if (disposed) return;
      const dt = previous ? Math.min((now - previous) / 16.67, 2) : 1;
      previous = now;
      context!.clearRect(0, 0, width, height);
      if (entryAtRef.current !== null) {
        if (!reducedMotion) {
          // First arrive at the centre, then release the fine light traces.
          const progress = Math.max(0, Math.min((now - entryAtRef.current - 450) / 800, 1));
          departing.forEach((grain, i) => {
            const t = Math.max(0, Math.min((progress - seed(i + 4000) * 0.2) / 0.8, 1));
            const drift = t * t;
            const x = grain.x * width + (grain.x - 0.5) * 90 * drift + Math.sin(i) * 18 * drift;
            const y = grain.y * height - (18 + seed(i + 5000) * 45) * drift;
            context!.fillStyle = `rgba(210,205,239,${grain.light * Math.sin(Math.PI * t)})`;
            context!.beginPath();
            context!.arc(x, y, 0.3 + seed(i + 6000) * 0.45, 0, Math.PI * 2);
            context!.fill();
          });
        }
        if (!reducedMotion) frame = requestAnimationFrame(draw);
        return;
      }
      const distortion = distortionRef.current;
      const target = !reducedMotion && now - distortion.lastMove < 180 ? 1 : 0;
      distortion.strength += (target - distortion.strength) * (1 - Math.exp(-0.08 * dt));
      if (distortion.strength > 0.015 && photo.complete && photo.naturalWidth) {
        const cx = distortion.x * width;
        const cy = distortion.y * height;
        const radius = Math.min(width * 0.24, 190);
        const left = Math.max(width * 0.08, cx - radius);
        const right = Math.min(width * 0.92, cx + radius);
        const top = height * 0.12;
        const bottom = height * 0.46;
        context!.save();
        context!.beginPath();
        context!.rect(width * 0.08, top, width * 0.84, bottom - top);
        context!.clip();
        // Continuous neighbouring offsets feel like a passing wave, not static.
        for (let y = top; y < bottom; y += 4) {
          const heightHere = Math.min(4, bottom - y);
          const influence = Math.max(0, 1 - Math.abs(y - cy) / radius);
          const phase = (y - cy) / radius * Math.PI * 1.5 - now * 0.002;
          const shift = Math.sin(phase) * 14 * distortion.strength * influence;
          const ripple = Math.cos(phase) * 2.5 * distortion.strength * influence;
          context!.globalAlpha = distortion.strength * 0.65;
          context!.drawImage(photo,
            left / width * photo.naturalWidth, y / height * photo.naturalHeight,
            (right - left) / width * photo.naturalWidth, heightHere / height * photo.naturalHeight,
            left + shift, y + ripple, right - left, heightHere);
        }
        context!.restore();
        // Feather the intervention into the untouched face, without a box edge.
        context!.save();
        context!.globalCompositeOperation = 'destination-in';
        const feather = context!.createRadialGradient(cx, cy, radius * 0.12, cx, cy, radius);
        feather.addColorStop(0, '#fff');
        feather.addColorStop(1, 'transparent');
        context!.fillStyle = feather;
        context!.fillRect(0, 0, width, height);
        context!.restore();
      }
      grains.forEach((grain, i) => {
        const homeX = grain.x * width;
        const homeY = grain.y * height;
        const pointer = !reducedMotion && target ? pointerRef.current : null;
        if (pointer) {
          const x = homeX + grain.dx - pointer.x;
          const y = homeY + grain.dy - pointer.y;
          const distance = Math.hypot(x, y);
          const force = Math.max(0, 1 - distance / 75) * -0.45;
          grain.vx += x / Math.max(distance, 1) * force * dt;
          grain.vy += y / Math.max(distance, 1) * force * dt;
        }
        grain.vx = (grain.vx - grain.dx * 0.018 * dt) * 0.9 ** dt;
        grain.vy = (grain.vy - grain.dy * 0.018 * dt) * 0.9 ** dt;
        grain.dx += grain.vx * dt;
        grain.dy += grain.vy * dt;
        const breath = reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(now * 0.00065 + i);
        context!.fillStyle = `rgba(194,185,239,${grain.light * breath})`;
        context!.beginPath();
        context!.arc(homeX + grain.dx, homeY + grain.dy, 0.5 + seed(i + 3000) * 0.6, 0, Math.PI * 2);
        context!.fill();
      });
      if (!reducedMotion) frame = requestAnimationFrame(draw);
    }

    function resize() {
      width = host!.clientWidth;
      height = host!.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(width * ratio);
      canvas!.height = Math.round(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (reducedMotion) draw(0);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    photo.onload = () => {
      if (disposed) return;
      const sample = document.createElement('canvas');
      sample.width = 64;
      sample.height = 96;
      const sampleContext = sample.getContext('2d');
      if (!sampleContext) return;
      sampleContext.drawImage(photo, 0, 0, 64, 96);
      const pixels = sampleContext.getImageData(0, 0, 64, 96).data;
      for (let i = 0; i < 12000 && departing.length < 2400; i += 1) {
        const x = 0.12 + seed(i * 2 + 7000) * 0.76;
        const y = 0.12 + seed(i * 2 + 7001) * 0.6;
        const index = (Math.floor(y * 96) * 64 + Math.floor(x * 64)) * 4;
        const light = pixels[index + 2] / 255;
        if (light < 0.2) continue;
        departing.push({ x, y, light: light * 0.85 });
      }
      for (let i = 0; i < 1000 && grains.length < 240; i += 1) {
        const x = 0.22 + seed(i * 2) * 0.56;
        const y = 0.13 + seed(i * 2 + 1) * 0.33;
        const index = (Math.floor(y * 96) * 64 + Math.floor(x * 64)) * 4;
        if (pixels[index + 2] < 65) continue;
        grains.push({ x, y, dx: 0, dy: 0, vx: 0, vy: 0, light: 0.15 + seed(i + 2000) * 0.3 });
      }
      resize();
      if (!reducedMotion) frame = requestAnimationFrame(draw);
    };
    photo.src = portraitUrl;
    return () => {
      disposed = true;
      photo.onload = null;
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [reducedMotion]);

  return (
    <div className="landing-scene__portrait" ref={(node) => { hostRef.current = node; subjectRef.current = node; }} aria-hidden="true"
      onClick={(event) => {
        const point = pointAt(event.clientX, event.clientY);
        if (faceGestureRef.current || isFace(point)) disturb(point, true);
        else onEnter();
        faceGestureRef.current = false;
      }}
      onPointerDown={(event) => {
        const point = pointAt(event.clientX, event.clientY);
        faceGestureRef.current = isFace(point);
        disturb(point, true);
      }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        pointerRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        disturb(pointAt(event.clientX, event.clientY));
      }}
      onPointerUp={(event) => { if (event.pointerType !== 'mouse') pointerRef.current = null; }}
      onPointerCancel={() => { pointerRef.current = null; faceGestureRef.current = false; distortionRef.current.lastMove = -Infinity; }}
      onPointerLeave={() => { pointerRef.current = null; distortionRef.current.lastMove = -Infinity; }}>
      <img src={portraitUrl} alt="" draggable={false} fetchPriority="high" />
      <img className="landing-scene__face-drift" src={portraitUrl} alt="" draggable={false} />
      <canvas ref={canvasRef} />
    </div>
  );
}
