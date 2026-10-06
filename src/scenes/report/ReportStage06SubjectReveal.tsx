import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { selectRecordLayerDerived, useExperienceStore } from '../../store/experienceStore';
import { useCameraPreference } from '../../store/cameraPreference';
import { renderLightGraphic } from '../../lib/lightRenderer.js';
import { createFigureRenderer, DESIGN_H, DESIGN_W } from '../../lib/figureLight';
import { CameraOptIn } from '../../components/CameraOptIn';
import { ReportStageNav } from './ReportStageNav';
import './ReportStage06SubjectReveal.css';

interface Props { index: number; total: number; locked: boolean; onAdvance: () => void }

/*
  The reveal, the same with or without the camera:
    0  the ID card's silhouette returns, turned away
    1  it fills with the visitor's light and chosen colours
    2  the card's name line: 이름 없음 → the visitor's name
    3  it turns to face front (a crossfade — there is no turning asset);
       with the camera on, the live mirror settles over it
    4  우리가 찾고 있던 사람은 당신이었습니다. — held; this is now the
       Final Report's opening beat, and REFRAME / METHOD follow it as their
       own stage (ReportStageMethod).
  Hold for each phase before the next, in ms.
*/
const REVEAL_HOLDS = [2200, 2600, 2200, 1800];
const FINAL_PHASE = REVEAL_HOLDS.length;

export function ReportStage06SubjectReveal({ index, total, locked, onAdvance }: Props) {
  const reduced = useReducedMotion();
  const { enabled, setEnabled } = useCameraPreference();
  const record = useExperienceStore(useShallow(selectRecordLayerDerived));
  const video = useRef<HTMLVideoElement>(null);
  const light = useRef<HTMLCanvasElement>(null);
  const [lightUrl, setLightUrl] = useState<string | null>(null);
  // Landing's HeroFigure, painted once in its intact first frame. Its alpha is
  // the bust silhouette (head, neck and shoulders in one outline), so it serves
  // as the reveal's mask; on the turn to front its shading returns as the face.
  const [figureUrl, setFigureUrl] = useState<string | null>(null);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const renderer = createFigureRenderer(canvas);
      renderer.resize(DESIGN_W, DESIGN_H, 2);
      renderer.render({ time: 0, energy: 0, cursorX: 0, cursorY: 0 });
      setFigureUrl(canvas.toDataURL('image/png'));
    } catch { /* CSS fallback silhouette stays */ }
  }, []);
  const investigatorName = useExperienceStore((state) => state.investigator?.investigatorName ?? '');
  const palette = record.light?.rules.palette ?? [];
  const stopCamera = useRef<() => void>(() => {});
  const [choice, setChoice] = useState<'camera' | 'without' | null>(null);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState('');
  const [phase, setPhase] = useState(0);

  // Ask again on each entry; a previous session choice is not permission to
  // start a new stream. The shared preference reflects only this live use.
  useEffect(() => {
    setEnabled(false);
    return () => { setEnabled(false); };
  }, [setEnabled]);

  function continueWithoutCamera() {
    stopCamera.current();
    setEnabled(false);
    setChoice('without');
  }

  useEffect(() => {
    if (choice === null) return;
    if (!enabled) { setLive(false); setReady(true); return; }
    let cancelled = false;
    let stream: MediaStream | null = null;
    setReady(false);
    const stop = () => { stream?.getTracks().forEach((track) => track.stop()); if (video.current) video.current.srcObject = null; };
    stopCamera.current = stop;
    const fallback = () => {
      if (cancelled) return;
      cancelled = true;
      stop();
      setLive(false);
      setEnabled(false);
      setNotice('카메라를 연결하지 못했습니다. 남겨진 단서로 마지막 장면을 이어갑니다.');
      setReady(true);
    };
    // Permission stays pending until the visitor decides or chooses the fallback.
    // Only an already-authorized video connection has a readiness deadline.
    let timeout: number | undefined;
    async function connect() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) { fallback(); return; }
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
        stream = media;
        timeout = window.setTimeout(fallback, 8000);
        media.getVideoTracks().forEach((track) => track.addEventListener('ended', fallback));
        const element = video.current;
        if (!element) { fallback(); return; }
        element.srcObject = media;
        await element.play();
        if (cancelled) return;
        // play() resolves when playback starts; the reveal never waits on a permission prompt.
        window.clearTimeout(timeout);
        setLive(true);
        setReady(true);
      } catch { fallback(); }
    }
    const connectTimer = window.setTimeout(() => void connect(), 0);
    const hide = () => { stop(); setEnabled(false); };
    window.addEventListener('pagehide', hide);
    const unsubscribe = useExperienceStore.subscribe((state, previous) => { if (state.currentScene !== previous.currentScene) hide(); });
    return () => { cancelled = true; window.clearTimeout(timeout); window.clearTimeout(connectTimer); stop(); window.removeEventListener('pagehide', hide); unsubscribe(); };
  }, [choice, enabled, setEnabled]);

  useEffect(() => {
    if (!ready || phase >= FINAL_PHASE) return;
    const hold = REVEAL_HOLDS[phase];
    const timer = window.setTimeout(() => setPhase((p) => p + 1), reduced ? Math.min(hold, 1200) : hold);
    return () => window.clearTimeout(timer);
  }, [ready, phase, reduced]);

  // The control waits until the closing line has settled in.
  const [navReady, setNavReady] = useState(false);
  useEffect(() => {
    if (!ready || phase < FINAL_PHASE) return;
    const timer = window.setTimeout(() => setNavReady(true), reduced ? 200 : 2000);
    return () => window.clearTimeout(timer);
  }, [ready, phase, reduced]);

  // The visitor's light, rendered once and reused as the silhouette's fill.
  useEffect(() => {
    if (!ready || lightUrl || !light.current || !record.light) return;
    renderLightGraphic(light.current, record.light.rules, record.light.variation);
    try { setLightUrl(light.current.toDataURL('image/png')); } catch { /* fill falls back to the palette alone */ }
  }, [ready, lightUrl, record.light]);

  const fillStyle = {
    backgroundImage: [
      lightUrl ? `url(${lightUrl})` : null,
      palette.length > 1 ? `linear-gradient(160deg, ${palette.join(', ')})` : palette.length === 1 ? `linear-gradient(${palette[0]}, ${palette[0]})` : null,
    ].filter(Boolean).join(', ') || undefined,
  };
  const t = (seconds: number) => ({ duration: reduced ? 0 : seconds });
  const figureStyle = figureUrl ? ({ '--figure-mask': `url(${figureUrl})` } as CSSProperties) : undefined;

  return <div className="report-stage report-stage-06" data-reveal-phase={phase}>
    <p className="report-stage__eyebrow">조사 결과</p>
    {/* The "누군가를 떠올리며" line now opens the second layer (ReportBridgeBeat). */}
    {choice === null && <CameraOptIn onUse={() => { setChoice('camera'); setEnabled(true); }} onSkip={continueWithoutCamera} />}
    {choice !== null && !ready && <div className="camera-consent" role="status"><p>마지막 장면에 내 얼굴을 비추기 위해 카메라를 준비하고 있습니다.</p><button className="cta cta--secondary" onClick={continueWithoutCamera}>카메라 없이 계속하기</button></div>}
    <div className="identity-reveal" aria-live="polite" hidden={!ready}>
      <p className="identity-reveal__setup" style={{ visibility: phase <= 3 ? 'visible' : 'hidden' }}>
        {ready ? '수집한 단서에서 당신의 흔적을 찾았습니다.' : '\u00a0'}
      </p>
      <motion.div className={`identity-figure${figureUrl ? ' identity-figure--hero' : ''}`} style={figureStyle} initial={{ opacity: 0 }} animate={{ opacity: ready ? 1 : 0 }} transition={t(1.4)}>
        {(['side', 'front'] as const).map((pose) => (
          <motion.div
            key={pose}
            className={`identity-figure__pose identity-figure__pose--${pose}`}
            initial={false}
            animate={{ opacity: (pose === 'front') === (phase >= 3) ? 1 : 0 }}
            transition={t(1.4)}
          >
            <span className="identity-figure__mass" />
            <motion.span
              className="identity-figure__fill"
              style={fillStyle}
              initial={false}
              animate={{ opacity: phase >= 1 ? 1 : 0 }}
              transition={t(2.4)}
            />
            {pose === 'front' && figureUrl ? <span className="identity-figure__face" style={{ backgroundImage: `url(${figureUrl})` }} /> : null}
          </motion.div>
        ))}
        {choice === 'camera' && <video
          ref={video}
          muted
          playsInline
          autoPlay
          className={`identity-figure__mirror${live && phase >= 3 ? ' identity-figure__mirror--on' : ''}`}
          aria-label="저장되지 않는 실시간 거울 화면"
          aria-hidden={!live}
        />}
      </motion.div>
      <div className="identity-card">
        <span className="identity-card__label">NAME</span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={phase >= 2 ? 'named' : 'unnamed'}
            className={`identity-card__name${phase >= 2 ? ' identity-card__name--named' : ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={t(0.6)}
          >
            {phase >= 2 && investigatorName ? investigatorName : '이름 없음'}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="identity-reveal__slot">
        <AnimatePresence mode="wait">
          {phase >= FINAL_PHASE && <motion.h1 key="you" className="identity-reveal__you" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={t(1.2)}>{'그 사람을 바라보는 동안,\n당신의 흔적이 남았습니다.'}</motion.h1>}
        </AnimatePresence>
      </div>
      {record.light ? <canvas ref={light} width={1000} height={1000} className="identity-figure__source" aria-hidden="true" /> : null}
    </div>
    {notice && <p className="identity-reveal__notice" role="status">{notice}</p>}
    {enabled && ready && <button className="identity-reveal__off" onClick={() => setEnabled(false)}>카메라 끄기</button>}
    <ReportStageNav label="기록 읽기" index={index} total={total} visible={navReady} onAdvance={() => { stopCamera.current(); setEnabled(false); onAdvance(); }} disabled={locked} />
  </div>;
}
