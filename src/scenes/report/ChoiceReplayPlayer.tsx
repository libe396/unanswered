import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getChoiceReplays, hasViewedReplay, markReplayViewed, replayIndexAt, type ChoiceReplay } from '../../lib/replay/choiceReplay';
import type { PersonalFinding } from '../../lib/personalFindingInterpretation';
import { buildReplaySummary } from '../../lib/replay/choiceReplaySummary';
import './ChoiceReplayPlayer.css';


/** Scriptless sandbox: displays captured DOM, never mounts live scene components. */
export function ReplaySurface({ record, time }: { record: ChoiceReplay; time: number }) {
  const viewport = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const [box, setBox] = useState({ width: 1, height: 1 });
  const [loaded, setLoaded] = useState(false);
  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const fittedBounds = useRef<{ size: string; x: number; y: number; width: number; height: number } | null>(null);
  const frame = record.frames[Math.max(0, replayIndexAt(record.frames, time))];
  const pointer = useMemo(() => {
    for (let i = replayIndexAt(record.inputs, time); i >= 0; i--) {
      const event = record.inputs[i];
      if ((event.kind === 'leave' && event.target === '') || (event.pointerType && event.pointerType !== 'mouse')) return null;
      if (event.x !== undefined && event.pointerType === 'mouse') return event;
    }
    return null;
  }, [record, time]);
  const recentClick = useMemo(() => {
    for (let i = replayIndexAt(record.inputs, time); i >= 0; i--) {
      const event = record.inputs[i];
      if (time - event.t > 220) break;
      if (event.kind === 'click' && event.x !== undefined && event.pointerType === 'mouse') return event;
    }
    return null;
  }, [record, time]);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const srcDoc = useMemo(() => {
    // Only font faces are reused; live page selectors cannot react to the current pointer.
    const faces: string[] = [];
    for (const sheet of document.styleSheets) {
      try { for (const rule of sheet.cssRules) if (rule instanceof CSSFontFaceRule) faces.push(rule.cssText); } catch { /* Cross-origin stylesheets aren't needed. */ }
    }
    return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'unsafe-inline'; media-src 'none'; connect-src 'none'"><style>${faces.join('\n')}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#08080a}*{pointer-events:none!important;caret-color:transparent!important}</style><style id="recorded-styles"></style></head><body><main id="recorded-screen" inert></main></body></html>`;
  }, []);
  useLayoutEffect(() => {
    const doc = iframe.current?.contentDocument;
    if (!loaded || !doc || !frame) return;
    const style = doc.getElementById('recorded-styles');
    const screen = doc.getElementById('recorded-screen');
    if (!style || !screen) return;
    style.textContent = record.styles.map((css, i) => `.r${i}{${css}}`).join('\n');
    screen.innerHTML = frame.html;
    for (const [index, x, y] of frame.scroll) {
      const element = screen.querySelector(`[data-replay-node="${index}"]`);
      if (element) { element.scrollLeft = x; element.scrollTop = y; }
    }
    // Fit visible content including panel/field edges, not only text and buttons.
    // If a later frame adds content, expand the fit rather than cropping it out.
    let active = true;
    const measure = () => {
      if (!active) return;
      const rects = Array.from(screen.querySelectorAll('[data-replay-node]'))
        .filter(element => {
          if (element.getAttribute('data-replay-node') === '0' || element.closest('[aria-hidden="true"]')) return false;
          const style = doc.defaultView!.getComputedStyle(element);
          if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
          const rect = element.getBoundingClientRect();
          const semantic = element.matches('h1,h2,h3,p,button,img,svg,summary,textarea,input,[role="button"]');
          const text = Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
          const painted = style.backgroundImage !== 'none' ||
            (style.backgroundColor !== 'transparent' && style.backgroundColor !== 'rgba(0, 0, 0, 0)') ||
            [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth].some(width => parseFloat(width) > 0);
          // The full scene background is the empty space being removed.
          const backdrop = rect.width >= frame.width * 0.95 && rect.height >= frame.height * 0.95;
          return !backdrop && (semantic || text || painted);
        })
        .map(element => element.getBoundingClientRect())
        .filter(rect => rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < frame.width && rect.top < frame.height);
      if (!rects.length) return;
      const size = `${frame.width}:${frame.height}`;
      const previous = fittedBounds.current?.size === size ? fittedBounds.current : null;
      const x = Math.max(0, Math.min(previous?.x ?? frame.width, ...rects.map(rect => rect.left - 32)));
      const y = Math.max(0, Math.min(previous?.y ?? frame.height, ...rects.map(rect => rect.top - 32)));
      const right = Math.min(frame.width, Math.max(previous ? previous.x + previous.width : 0, ...rects.map(rect => rect.right + 32)));
      const bottom = Math.min(frame.height, Math.max(previous ? previous.y + previous.height : 0, ...rects.map(rect => rect.bottom + 32)));
      const next = { size, x, y, width: right - x, height: bottom - y };
      fittedBounds.current = next;
      if (!previous || previous.x !== x || previous.y !== y || previous.width !== next.width || previous.height !== next.height) setCrop(next);
    };
    measure();
    // Font loading can change wrapping after the initial measurement.
    void doc.fonts.ready.then(measure);
    return () => { active = false; };
  }, [frame, record, loaded]);
  if (!frame) return null;
  const view = crop ?? { x: 0, y: 0, width: frame.width, height: frame.height };
  const scale = Math.min(Math.max(1, box.width - 24) / view.width, Math.max(1, box.height - 24) / view.height);
  return <div className="choice-replay__viewport" ref={viewport} aria-label="당시 선택 화면의 읽기 전용 재생">
    <div className="choice-replay__screen" style={{ width: frame.width, height: frame.height,
      left: (box.width - view.width * scale) / 2 - view.x * scale,
      top: (box.height - view.height * scale) / 2 - view.y * scale,
      transform: `scale(${scale})` }}>
      <iframe ref={iframe} title="기록된 선택 화면" sandbox="allow-same-origin" srcDoc={srcDoc} onLoad={() => setLoaded(true)} tabIndex={-1} />
      {pointer && <svg className="choice-replay__cursor" width="24" height="30" viewBox="0 0 24 30"
        style={{ left: pointer.x, top: pointer.y }} aria-hidden="true">
        <path d="M2 2v23l6-6 5 10 4-2-5-10h9Z" fill="#eee9ff" stroke="#18131f" strokeWidth="1.5" />
      </svg>}
      {recentClick && <span className="choice-replay__click" style={{ left: recentClick.x, top: recentClick.y }} />}
    </div>
    <span className="choice-replay__badge">선택 순간 요약 · 1×</span>
  </div>;
}

/** Lives inside “내 기록 살펴보기”. One automatic pass per finding per visit. */
export function ChoiceReplayPlayer({ finding, records, viewingKey = finding.id }: { finding: PersonalFinding; records?: ChoiceReplay[]; viewingKey?: string }) {
  const [seen] = useState(() => hasViewedReplay(viewingKey));
  const [sequence] = useState(() => buildReplaySummary(finding, records ?? getChoiceReplays()));
  const duration = sequence.reduce((sum, item) => sum + item.duration, 0);
  const [elapsed, setElapsed] = useState(seen ? duration : 0);
  useEffect(() => { markReplayViewed(viewingKey); }, [viewingKey]);
  useEffect(() => {
    if (seen) return;
    let raf = 0;
    let previous = performance.now();
    let position = 0;
    const tick = (now: number) => {
      const delta = document.hidden ? 0 : now - previous;
      previous = now;
      position = Math.min(duration, position + delta);
      setElapsed(position);
      if (position < duration && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const resume = () => { cancelAnimationFrame(raf); previous = performance.now(); if (!document.hidden && position < duration) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', resume);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', resume); };
  }, [seen, duration]);
  let offset = 0;
  const steps = sequence.map(item => { const step = { ...item, start: offset }; offset += item.duration; return step; });
  const done = elapsed >= duration;
  const active = steps.findIndex(item => elapsed < item.start + item.duration);
  const item = steps[active < 0 ? steps.length - 1 : active];
  let clipOffset = item?.start ?? 0;
  const clips = item?.clips.map(clip => { const result = { ...clip, at: clipOffset }; clipOffset += clip.duration; return result; }) ?? [];
  const clip = clips.find(value => elapsed < value.at + value.duration) ?? clips.at(-1);
  const clipTime = clip ? clip.start + Math.min(clip.duration, Math.max(0, elapsed - clip.at)) : 0;
  return <div className="choice-replay" aria-label="이번 발견의 기록 요약">
    <ol className="choice-replay__timeline" aria-label="기록 요약 진행 단계">
      {steps.map((step, i) => <li key={`${step.evidence.zone}-${i}`} aria-current={!done && i === active ? 'step' : undefined}
        className={elapsed >= step.start + step.duration ? 'is-complete' : i === active ? 'is-current' : ''}>
        <span className="choice-replay__step-number">{String(i + 1).padStart(2, '0')}</span>
        <span>{step.evidence.scene}</span>
        <span className="choice-replay__track"><span style={{ width: `${Math.max(0, Math.min(1, (elapsed - step.start) / step.duration)) * 100}%` }} /></span>
      </li>)}
      <li className={done ? 'is-current' : ''} aria-current={done ? 'step' : undefined}><span className="choice-replay__step-number">{String(steps.length + 1).padStart(2, '0')}</span><span>남겨진 기록</span><span className="choice-replay__track"><span style={{width: done ? '100%' : '0%'}} /></span></li>
    </ol>
    <div className="choice-replay__body">
      <div className="choice-replay__visual">
        {clip ? <ReplaySurface key={clip.record.id} record={clip.record} time={clipTime} />
          : <div className="choice-replay__unavailable"><p>이 순간의 재생 기록은 남아 있지 않습니다.</p><span>기록된 선택으로 살펴봅니다.</span></div>}
      </div>
      <div className="choice-replay__summary" aria-live="polite">
        <p className="choice-replay__eyebrow">{done ? '남겨진 기록' : item?.evidence.scene}</p>
        <h3>{done ? finding.headline : item?.evidence.description}</h3>
        {done ? <><p>{finding.interpretation.split('\n').slice(0, 2).join('\n')}</p><p className="choice-replay__reflection">{finding.reflection}</p></>
          : <><p className="choice-replay__metrics">{item?.evidence.metrics.slice(0, 2).join(' · ')}</p><p className="choice-replay__caption">당신이 단서를 고르던 순간입니다.</p></>}
        <p className="choice-replay__note">{done ? '이 기록은 한 번의 흐름으로 지나갑니다.' : '선택의 일부를 원래 속도로 이어 보여드립니다.'}</p>
      </div>
    </div>
  </div>;
}


/** In-place phone evidence: starts once when the visitor reaches this part. */
export function EvidenceReplay({ finding, records }: { finding: PersonalFinding; records: ChoiceReplay[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const clips = useMemo(() => buildReplaySummary(finding, records).flatMap(step => step.clips), [finding, records]);
  const duration = clips.reduce((sum, clip) => sum + clip.duration, 0);
  useEffect(() => {
    if (!root.current || !clips.length) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setStarted(true); observer.disconnect(); }
    }, { threshold: 0.35 });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [clips.length]);
  useEffect(() => {
    if (!started) return;
    let raf = 0, position = 0, previous = performance.now();
    const tick = (now: number) => {
      if (!document.hidden) position = Math.min(duration, position + now - previous);
      previous = now; setElapsed(position);
      if (position < duration) raf = requestAnimationFrame(tick);
    };
    const visibility = () => { cancelAnimationFrame(raf); previous = performance.now(); if (!document.hidden && position < duration) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', visibility);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', visibility); };
  }, [started, duration]);
  let offset = 0;
  const timeline = clips.map(clip => { const result = { ...clip, at: offset }; offset += clip.duration; return result; });
  const active = timeline.find(clip => elapsed < clip.at + clip.duration) ?? timeline.at(-1);
  if (!active) return <p className="evidence-replay__missing">이 근거에 해당하는 선택 화면 기록은 남아 있지 않습니다.</p>;
  return <div ref={root} className="evidence-replay" aria-label="근거에 해당하는 실제 선택 화면">
    <p className="evidence-replay__caption">당신이 단서를 고르던 순간입니다.</p>
    <div className="evidence-replay__surface"><ReplaySurface key={active.record.id} record={active.record} time={active.start + Math.min(active.duration, Math.max(0, elapsed - active.at))} /></div>
    <div className="evidence-replay__progress" aria-hidden="true"><span style={{width: `${duration ? elapsed / duration * 100 : 0}%`}} /></div>
    <p className="evidence-replay__caption">{elapsed >= duration ? '남겨진 선택 화면입니다.' : '기록 재생 · 원래 속도 1×'}</p>
  </div>;
}
