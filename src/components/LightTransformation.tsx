import { useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { renderLightGraphic } from '../lib/lightRenderer.js';
import type { LightAnalysisRules } from '../types';
import './LightTransformation.css';

type Point = { x: number; y: number };
type Field = { circles: Array<Point & { radius: number; color: string; secondaryColor: string }>; lines: Array<{ start: Point; control: Point; end: Point; color: string }> };
const captions = ['사진에서 밝은 영역이 드러납니다.', '사진 속 색이 빛으로 번집니다.', '구조점과 방향이 선으로 이어집니다.', '빛 위에 선과 질감이 겹쳐집니다.', '사진에서 이어진 빛입니다.'];
const progress = (time: number, start: number, end: number) => Math.max(0, Math.min(1, (time - start) / (end - start)));
const smooth = (t: number) => t * t * (3 - 2 * t);

export function LightTransformation({ src, rules, onConfirm, saved, startedAt }: { startedAt: number; src: string; rules: LightAnalysisRules; onConfirm: () => void; saved: boolean }) {
  const reducedMotion = useReducedMotion();
  const arrowId = useId();
  const canvas = useRef<HTMLCanvasElement>(null);
  const transition = useRef<HTMLCanvasElement>(null);
  const layers = useRef<Array<HTMLCanvasElement | null>>([]);
  const field = useRef<Field>({ circles: [], lines: [] });
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const [ready, setReady] = useState(false);
  const [compare, setCompare] = useState(false);
  const [ratio, setRatio] = useState(1);
  const [time, setTime] = useState(0);
  const stopped = useRef(false);
  useEffect(() => {
    if (!canvas.current) return;
    renderLightGraphic(canvas.current, rules, 1, (source: HTMLCanvasElement, index: number, data: Field) => {
      const target = layers.current[index];
      if (target) { target.width = 1000; target.height = 1000; target.getContext('2d')?.drawImage(source, 0, 0); }
      field.current = data;
    });
    setReady(true);
  }, [rules, startedAt]);
  useEffect(() => {
    if (!ready || stopped.current) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      if (stopped.current) return;
      const elapsed = Math.min(8400, now - start);
      setTime(elapsed);
      setStep(elapsed < 1500 ? 0 : elapsed < 4700 ? 1 : elapsed < 6200 ? 2 : elapsed < 8400 ? 3 : 4);
      if (elapsed < 8400) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, run]);
  // Preview only: source swatches form a shared mixture, not invented one-to-one
  // matches. That mixture unfolds at the renderer's actual circle positions.
  useEffect(() => {
    const ctx = transition.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 1000, 1000);
    if (step !== 1 || reducedMotion) return;
    const blend = smooth(progress(time, 2050, 4650));
    const sources = rules.paletteSources ?? [];
    const pw = Math.min(1, ratio), ph = Math.min(1, 1 / ratio);
    const points = sources.map(p => ({ x: (1 - pw) * 500 + p.x * 1000 * pw, y: (1 - ph) * 500 + p.y * 1000 * ph }));
    const center = points.length ? { x: points.reduce((s,p) => s+p.x,0)/points.length, y: points.reduce((s,p) => s+p.y,0)/points.length } : { x: 500, y: 500 };
    points.forEach((p,i) => {
      const size = 66 + blend * 280;
      ctx.save(); ctx.globalAlpha = progress(time,1500,1750) * (1 - smooth(progress(blend,.45,1)));
      ctx.filter = `blur(${blend * 35}px)`;
      ctx.fillStyle = rules.palette[i]; ctx.strokeStyle = '#fff3'; ctx.lineWidth = 3;
      const x = p.x + (center.x-p.x)*blend, y=p.y+(center.y-p.y)*blend;
      ctx.beginPath(); ctx.roundRect(x-size/2,y-size/2,size,size,5+blend*size/2);ctx.fill();ctx.stroke();ctx.restore();
    });
    field.current.circles.forEach(circle => {
      const spread = smooth(progress(blend,.15,1));
      const x = center.x+(circle.x-center.x)*spread, y=center.y+(circle.y-center.y)*spread;
      const r=30+(circle.radius-30)*spread;
      const gradient=ctx.createRadialGradient(x,y,0,x,y,r);
      gradient.addColorStop(0,circle.color);gradient.addColorStop(.4,circle.secondaryColor);gradient.addColorStop(1,'transparent');
      ctx.save();ctx.globalAlpha=progress(blend,.2,.8)*.65*(1-progress(time,4150,4700));ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
    });
  }, [time, step, rules, ratio, reducedMotion]);
  const angle = rules.motionDirection.angle * Math.PI / 180;
  const origin = rules.lightOrigin;
  const done = step === 4;
  const replay = () => { stopped.current=false; setTime(0); setStep(0); setCompare(false); setRun(n=>n+1); };
  const photoOpacity = done ? (compare ? 1 : 0) : reducedMotion ? (step < 3 ? 1 : 0) : 1-progress(time,2350,4700)*.92;
  return <section className={`light-transformation${reducedMotion ? ' light-transformation--static' : ''}`} data-step={step} aria-label="사진에서 빛으로 이어지는 과정">
    <p className="light-transformation__eyebrow">빛의 흔적</p><h1 aria-live="polite">{captions[step]}</h1>
    <div className="light-transformation__stage">
      {[0,1,2,3].map(index=><canvas key={index} ref={node=>{layers.current[index]=node;}} className="light-transformation__layer" style={{opacity: done ? 0 : reducedMotion ? (step===3 && index===3 ? 1 : 0) : progress(time,...([[2600,4650],[3900,4700],[6350,7350],[7500,8400]][index] as [number,number]))}} aria-hidden="true" />)}
      <div className="light-transformation__photo" style={{width:`${Math.min(1,ratio)*100}%`,height:`${Math.min(1,1/ratio)*100}%`,opacity:step===3?0:photoOpacity}}>
        <img src={src} alt="선택한 원본 사진" onLoad={e=>setRatio(e.currentTarget.naturalWidth/e.currentTarget.naturalHeight)} />
        {!done && <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="실제 분석에서 찾은 밝은 영역과 구조점">
          <defs><marker id={arrowId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="#eee5ff" /></marker></defs>
          <g className="light-transformation__regions" opacity={step===0?1:0}>{rules.brightRegions.map((r,i)=>r.contour?<path key={i} d={r.contour} fill="#fff6c412" stroke="#fff4ce" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />:<ellipse key={i} cx={r.x*1000} cy={r.y*1000} rx={r.size*500*Math.max(1,1/ratio)} ry={r.size*500*Math.max(1,ratio)} fill="none" stroke="#fff4ce" strokeWidth="4" />)}</g>
          {reducedMotion && step===1 && rules.paletteSources?.map((p,i)=><rect key={i} x={p.x*1000-33} y={p.y*1000-33} width="66" height="66" fill={rules.palette[i]} stroke="white" strokeWidth="3" />)}
        </svg>}
      </div>
      <canvas ref={transition} width={1000} height={1000} className="light-transformation__morph" aria-hidden="true" />
      {step===2 && <svg className="light-transformation__structure" viewBox="0 0 1000 1000" aria-label="사진의 구조점과 방향">
        <g transform={`translate(${(1-Math.min(1,ratio))*500} ${(1-Math.min(1,1/ratio))*500}) scale(${Math.min(1,ratio)} ${Math.min(1,1/ratio)})`}>
          {rules.structureAnchors.map((p,i)=><circle key={i} cx={p.x*1000} cy={p.y*1000} r="9" fill={p.color} stroke="#fff" strokeWidth="3" />)}
          <line className="light-transformation__direction" x1={origin.x*1000} y1={origin.y*1000} x2={(origin.x+Math.cos(angle)*.18)*1000} y2={(origin.y+Math.sin(angle)*.18)*1000} stroke="#eee5ff" strokeWidth="5" markerEnd={`url(#${arrowId})`} />
        </g>
      </svg>}
      <svg className="light-transformation__result-lines" viewBox="0 0 1000 1000" style={{opacity:done?0:reducedMotion?(step===2?1:0):progress(time,5100,5700)*(1-progress(time,6400,7300))}} aria-hidden="true">{field.current.lines.map((line,i)=><path key={i} d={`M${line.start.x},${line.start.y}Q${line.control.x},${line.control.y} ${line.end.x},${line.end.y}`} stroke={line.color} fill="none" strokeWidth="3" pathLength="1" strokeDasharray="1" strokeDashoffset={reducedMotion?0:1-progress(time,5200,6350)} />)}</svg>
      <canvas ref={canvas} width={1000} height={1000} className="light-transformation__result" style={{opacity:done&&!compare?1:0}} aria-label="선택한 사진의 분석으로 생성한 빛 그래픽" />
    </div>
    {done ? <><button className="cta cta--primary" disabled={saved} onClick={onConfirm}>{saved?'기록 저장됨':'기록 저장하고 다음으로'}</button><div className="light-transformation__tools"><button aria-pressed={compare} onClick={()=>setCompare(!compare)}>{compare?'빛 그래픽으로 돌아가기':'원본과 비교'}</button><button onClick={replay}>변환 과정 다시 보기</button></div></> : <button className="light-transformation__skip" onClick={()=>{stopped.current=true;setTime(8400);setStep(4);setRun(n=>n+1);}}>결과 바로 보기</button>}
  </section>;
}
