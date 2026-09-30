import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { selectRecordLayerDerived, useExperienceStore } from '../../store/experienceStore';
import { useCameraPreference } from '../../store/cameraPreference';
import { renderLightGraphic } from '../../lib/lightRenderer.js';
import { drawStrokes } from '../../lib/memorySketch';
import { CameraOptIn } from '../../components/CameraOptIn';
import { ReportStageNav } from './ReportStageNav';
import './ReportStage06SubjectReveal.css';

interface Props { index: number; total: number; locked: boolean; onAdvance: () => void }

export function ReportStage06SubjectReveal({ index, total, locked, onAdvance }: Props) {
  const reduced = useReducedMotion();
  const { enabled, setEnabled } = useCameraPreference();
  const record = useExperienceStore(useShallow(selectRecordLayerDerived));
  const video = useRef<HTMLVideoElement>(null);
  const light = useRef<HTMLCanvasElement>(null);
  const sketch = useRef<HTMLCanvasElement>(null);
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
    if (!ready || phase >= 3) return;
    const timer = window.setTimeout(() => setPhase((p) => p + 1), reduced ? 450 : [2200, 1700, 2700][phase]);
    return () => window.clearTimeout(timer);
  }, [ready, phase, reduced]);

  useEffect(() => {
    if (!ready || live) return;
    if (light.current && record.light) renderLightGraphic(light.current, record.light.rules, record.light.variation);
    const context = sketch.current?.getContext('2d');
    if (context) drawStrokes(context, record.memorySketch.strokes, 600, 400);
  }, [ready, live, record]);

  return <div className="report-stage report-stage-06" data-reveal-phase={phase}>
    <p className="report-stage__eyebrow">마지막 기록</p>
    {choice === null && <CameraOptIn onUse={() => { setChoice('camera'); setEnabled(true); }} onSkip={continueWithoutCamera} />}
    {choice !== null && !ready && <div className="camera-consent" role="status"><p>마지막 장면에 내 얼굴을 비추기 위해 카메라를 준비하고 있습니다.</p><button className="cta cta--secondary" onClick={continueWithoutCamera}>카메라 없이 계속하기</button></div>}
    <div className="identity-reveal" aria-live="polite" hidden={!ready}>
      <p className="identity-reveal__setup">{ready ? '당신이 찾던 사람은' : '\u00a0'}</p>
      <motion.div className="identity-reveal__portrait" animate={{ opacity: ready && phase >= 1 ? 1 : 0 }} transition={{ duration: reduced ? .1 : 1.6 }}>
        <video ref={video} muted playsInline autoPlay className={`identity-reveal__video${live ? ' identity-reveal__video--live' : ''}`} aria-label="저장되지 않는 실시간 거울 화면" />
        {ready && !live && <div className="identity-reveal__traces">
          {record.light && <canvas ref={light} width={1000} height={1000} aria-label="당신이 남긴 빛" />}
          <canvas ref={sketch} width={600} height={400} aria-label="당신이 남긴 스케치" />
          <div>{record.sentenceClues.selectedSentences.map((text, i) => <p key={i}>{text}</p>)}</div>
        </div>}
      </motion.div>
      <motion.h1 animate={{ opacity: ready && phase >= 2 ? 1 : 0 }} transition={{ duration: reduced ? .1 : 1 }}>당신입니다.</motion.h1>
      <p className="identity-reveal__closure" style={{ opacity: phase >= 3 ? 1 : 0 }}>당신이 남긴 선택과 망설임이 하나의 기록이 되었습니다.</p>
    </div>
    {notice && <p className="identity-reveal__notice" role="status">{notice}</p>}
    {enabled && ready && <button className="identity-reveal__off" onClick={() => setEnabled(false)}>카메라 끄기</button>}
    <ReportStageNav label="최종 기록으로" index={index} total={total} visible={ready && phase >= 3} onAdvance={() => { stopCamera.current(); setEnabled(false); onAdvance(); }} disabled={locked} />
  </div>;
}
