import { buildActionEvidence, RECORD_CLOSING } from '../../lib/reportActionEvidence';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { selectRecordLayerDerived, useExperienceStore } from '../../store/experienceStore';
import { useCameraPreference } from '../../store/cameraPreference';
import { renderLightGraphic } from '../../lib/lightRenderer.js';
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
    4  당신입니다.
    5  closure (only when there is a recorded choice to speak of)
    6  the closing line
  Hold for each phase before the next, in ms.
*/
const REVEAL_HOLDS = [2200, 2600, 2200, 1800, 2600, 5200];
const FINAL_PHASE = REVEAL_HOLDS.length;

export function ReportStage06SubjectReveal({ index, total, locked, onAdvance }: Props) {
  const reduced = useReducedMotion();
  const { enabled, setEnabled } = useCameraPreference();
  const record = useExperienceStore(useShallow(selectRecordLayerDerived));
  const behavior = useExperienceStore((state) => state.behavior);
  const evidence = buildActionEvidence(record, behavior);
  const hasDwell = evidence.some((item) => item.kind === 'dwell');
  const video = useRef<HTMLVideoElement>(null);
  const light = useRef<HTMLCanvasElement>(null);
  const [lightUrl, setLightUrl] = useState<string | null>(null);
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

  const hasClosure = evidence.length > 0;
  useEffect(() => {
    if (!ready || phase >= FINAL_PHASE) return;
    const hold = REVEAL_HOLDS[phase];
    const timer = window.setTimeout(
      // Without a recorded choice there is no closure line; go straight on.
      () => setPhase((p) => (p + 1 === 5 && !hasClosure ? 6 : p + 1)),
      reduced ? Math.min(hold, 1200) : hold,
    );
    return () => window.clearTimeout(timer);
  }, [ready, phase, reduced, hasClosure]);

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

  return <div className="report-stage report-stage-06" data-reveal-phase={phase}>
    <p className="report-stage__eyebrow">마지막 기록</p>
    {/* The "누군가를 떠올리며" line now opens the second layer (ReportBridgeBeat). */}
    {choice === null && <CameraOptIn onUse={() => { setChoice('camera'); setEnabled(true); }} onSkip={continueWithoutCamera} />}
    {choice !== null && !ready && <div className="camera-consent" role="status"><p>마지막 장면에 내 얼굴을 비추기 위해 카메라를 준비하고 있습니다.</p><button className="cta cta--secondary" onClick={continueWithoutCamera}>카메라 없이 계속하기</button></div>}
    <div className="identity-reveal" aria-live="polite" hidden={!ready}>
      <p className="identity-reveal__setup" style={{ visibility: phase <= 3 ? 'visible' : 'hidden' }}>
        {ready ? '하지만 이 선택들 외의 것들에서\n발견할 수 있던 건 바로,' : '\u00a0'}
      </p>
      <motion.div className="identity-figure" initial={{ opacity: 0 }} animate={{ opacity: ready ? 1 : 0 }} transition={t(1.4)}>
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
          </motion.div>
        ))}
        <video
          ref={video}
          muted
          playsInline
          autoPlay
          className={`identity-figure__mirror${live && phase >= 3 ? ' identity-figure__mirror--on' : ''}`}
          aria-label="저장되지 않는 실시간 거울 화면"
        />
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
          {phase === 4 && <motion.h1 key="you" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={t(1)}>당신입니다.</motion.h1>}
          {phase === 5 && <motion.p key="closure" className="identity-reveal__closure" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={t(0.9)}>{`그 사람을 상상하는 동안,\n당신의 ${hasDwell ? '선택과 머무름도' : '선택의 흔적도'} 이곳에 남았습니다.`}</motion.p>}
          {phase >= FINAL_PHASE && <motion.p key="final" className="identity-reveal__final" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={t(0.9)}>{RECORD_CLOSING}</motion.p>}
        </AnimatePresence>
      </div>
      {record.light ? <canvas ref={light} width={1000} height={1000} className="identity-figure__source" aria-hidden="true" /> : null}
    </div>
    {notice && <p className="identity-reveal__notice" role="status">{notice}</p>}
    {enabled && ready && <button className="identity-reveal__off" onClick={() => setEnabled(false)}>카메라 끄기</button>}
    <ReportStageNav label="최종 기록으로" index={index} total={total} visible={navReady} onAdvance={() => { stopCamera.current(); setEnabled(false); onAdvance(); }} disabled={locked} />
  </div>;
}
