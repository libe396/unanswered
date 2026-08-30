import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { SceneId } from '../types';
import {
  ARCHIVE_AMBIENCE_DUCK_EVENT,
  ARCHIVE_AMBIENCE_DUCK_VOLUME,
  ARCHIVE_AMBIENCE_VOLUME,
  ARCHIVE_DUCK_FADE_MS,
  ARCHIVE_FINAL_FADE_MS,
  ARCHIVE_RESTORE_FADE_MS,
  CLUE_SIGNATURE_EVENT,
  CLUE_SIGNATURE_VOLUME,
  FINAL_REPORT_BGM_START_EVENT,
  FINAL_REPORT_BGM_FADE_IN_MS,
  FINAL_REPORT_BGM_FADE_OUT_MS,
  FINAL_REPORT_BGM_VOLUME,
  LANDING_BGM_FADE_IN_MS,
  LANDING_BGM_FADE_OUT_MS,
  LANDING_BGM_VOLUME,
  SOUND_CLUES_AMBIENCE_DUCK_VOLUME,
  SOUND_CLUES_AMBIENCE_VOLUME,
  UI_BUTTON_CLICK_VOLUME,
  ZONE_BGM_FADE_IN_MS,
  ZONE_BGM_FADE_OUT_MS,
  ZONE_BGM_GAP_MS,
  type ArchiveAmbienceDuckDetail,
} from '../lib/postElevatorAudio';

const POST_ELEVATOR_AMBIENCE_SCENES = new Set<SceneId>([
  'registration',
  'lightArchive',
  'recordLayerFirstVisit',
  'zone03Intro',
  'soundClues',
  'memorySketch',
  'sentenceClues',
  'recordLayerSecondVisit',
]);

const FINAL_REPORT_BGM_SCENES = new Set<SceneId>(['recordLayerSecondVisit', 'finalReport']);
const FINAL_REPORT_SEQUENCE_SCENES = new Set<SceneId>(['sentenceClues', 'recordLayerSecondVisit', 'finalReport']);

interface ZoneBgmConfig {
  id: string;
  file: string;
  volume: number;
  loop: boolean;
  silenceAfterEndMs?: number;
}

const ZONE_BGM_BY_SCENE: Partial<Record<SceneId, ZoneBgmConfig>> = {
  lightArchive: {
    id: 'zone-01-light-archive',
    file: 'zone-01-light-archive.mp3',
    volume: 0.19,
    loop: true,
  },
  memorySketch: {
    id: 'zone-03-memory-sketch-edit',
    file: 'zone-03-memory-sketch-edit.mp3',
    volume: 0.14,
    loop: false,
    silenceAfterEndMs: 7000,
  },
  sentenceClues: {
    id: 'empty-archive-fade',
    file: 'empty-archive-fade.mp3',
    volume: 0.11,
    loop: true,
  },
};

const SIGNATURE_RETRIGGER_GUARD_MS = 700;
const BUTTON_CLICK_RETRIGGER_GUARD_MS = 45;

interface PostElevatorSoundManagerProps {
  currentScene: SceneId;
}

export function PostElevatorSoundManager({ currentScene }: PostElevatorSoundManagerProps) {
  const landingBgmRef = useRef<HTMLAudioElement | null>(null);
  const ambienceRef = useRef<HTMLAudioElement | null>(null);
  const zoneBgmRef = useRef<HTMLAudioElement | null>(null);
  const zoneBgmIdRef = useRef<string | null>(null);
  const zoneBgmConfigRef = useRef<ZoneBgmConfig | null>(null);
  const finalReportBgmRef = useRef<HTMLAudioElement | null>(null);
  const signatureRef = useRef<HTMLAudioElement | null>(null);
  const buttonClickContextRef = useRef<AudioContext | null>(null);

  const landingVolumeFrameRef = useRef<number | null>(null);
  const ambienceVolumeFrameRef = useRef<number | null>(null);
  const zoneBgmVolumeFrameRef = useRef<number | null>(null);
  const finalReportVolumeFrameRef = useRef<number | null>(null);
  const zoneTransitionTimerRef = useRef<number | null>(null);
  const memoryReplayTimerRef = useRef<number | null>(null);
  const zoneTransitionTokenRef = useRef(0);
  const lastSignaturePlayedAtRef = useRef(0);
  const lastButtonClickPlayedAtRef = useRef(0);
  const unlockArmedRef = useRef(false);
  const finalReportActiveRef = useRef(false);
  const currentSceneRef = useRef(currentScene);
  const duckedRef = useRef(false);
  const [ducked, setDucked] = useState(false);
  const [finalReportBgmArmed, setFinalReportBgmArmed] = useState(false);

  currentSceneRef.current = currentScene;
  duckedRef.current = ducked;

  useEffect(() => {
    const handleDuck = (event: Event) => {
      const detail = (event as CustomEvent<ArchiveAmbienceDuckDetail>).detail;
      setDucked(Boolean(detail?.ducked));
    };

    const handleSignature = () => playSignature();
    const handleFinalReportBgmStart = () => setFinalReportBgmArmed(true);
    const handleUserGesture = () => {
      playCurrentSceneBed({ immediateLanding: true });
    };
    const handleButtonClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('button');
      if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
      playButtonClick();
    };

    window.addEventListener(ARCHIVE_AMBIENCE_DUCK_EVENT, handleDuck);
    window.addEventListener(CLUE_SIGNATURE_EVENT, handleSignature);
    window.addEventListener(FINAL_REPORT_BGM_START_EVENT, handleFinalReportBgmStart);
    window.addEventListener('click', handleButtonClick, true);
    window.addEventListener('pointerdown', handleUserGesture, true);
    window.addEventListener('click', handleUserGesture, true);
    window.addEventListener('touchstart', handleUserGesture, true);
    window.addEventListener('keydown', handleUserGesture, true);

    return () => {
      window.removeEventListener(ARCHIVE_AMBIENCE_DUCK_EVENT, handleDuck);
      window.removeEventListener(CLUE_SIGNATURE_EVENT, handleSignature);
      window.removeEventListener(FINAL_REPORT_BGM_START_EVENT, handleFinalReportBgmStart);
      window.removeEventListener('click', handleButtonClick, true);
      window.removeEventListener('pointerdown', handleUserGesture, true);
      window.removeEventListener('click', handleUserGesture, true);
      window.removeEventListener('touchstart', handleUserGesture, true);
      window.removeEventListener('keydown', handleUserGesture, true);
    };
  }, []);

  useEffect(() => {
    const isLanding = currentScene === 'landing';
    const shouldPlayAmbience = POST_ELEVATOR_AMBIENCE_SCENES.has(currentScene);
    const isFinalReportBgmScene =
      FINAL_REPORT_BGM_SCENES.has(currentScene) || (currentScene === 'sentenceClues' && finalReportBgmArmed);
    const zoneConfig = ZONE_BGM_BY_SCENE[currentScene] ?? null;
    const wasFinalReport = finalReportActiveRef.current;
    finalReportActiveRef.current = isFinalReportBgmScene;

    if (!FINAL_REPORT_SEQUENCE_SCENES.has(currentScene) && finalReportBgmArmed) {
      setFinalReportBgmArmed(false);
    }

    if (isLanding) {
      playLandingBgm();
      fadeLandingBgmTo(LANDING_BGM_VOLUME, LANDING_BGM_FADE_IN_MS);
    } else {
      fadeLandingBgmTo(0, LANDING_BGM_FADE_OUT_MS, () => stopLandingBgm());
    }

    if (!isFinalReportBgmScene) {
      fadeFinalReportBgmTo(0, FINAL_REPORT_BGM_FADE_OUT_MS, () => stopFinalReportBgm());
    }

    if (isFinalReportBgmScene) {
      if (!wasFinalReport) stopFinalReportBgm();
      transitionZoneBgm(null, ducked);
      fadeAmbienceTo(0, ARCHIVE_FINAL_FADE_MS, () => {
        ambienceRef.current?.pause();
      });
      playFinalReportBgm({ restart: !wasFinalReport });
      fadeFinalReportBgmTo(FINAL_REPORT_BGM_VOLUME, FINAL_REPORT_BGM_FADE_IN_MS);
      return;
    }

    transitionZoneBgm(zoneConfig, ducked);

    if (!shouldPlayAmbience) {
      fadeAmbienceTo(0, 520, () => {
        ambienceRef.current?.pause();
      });
      return;
    }

    playAmbience();
    fadeAmbienceTo(getAmbienceTargetVolume(currentScene, ducked), ducked ? ARCHIVE_DUCK_FADE_MS : ARCHIVE_RESTORE_FADE_MS);
  }, [currentScene, ducked, finalReportBgmArmed]);

  useEffect(
    () => () => {
      cancelFrame(landingVolumeFrameRef);
      cancelFrame(ambienceVolumeFrameRef);
      cancelFrame(zoneBgmVolumeFrameRef);
      cancelFrame(finalReportVolumeFrameRef);
      clearTimer(zoneTransitionTimerRef);
      clearTimer(memoryReplayTimerRef);
      landingBgmRef.current?.pause();
      ambienceRef.current?.pause();
      zoneBgmRef.current?.pause();
      finalReportBgmRef.current?.pause();
      signatureRef.current?.pause();
      buttonClickContextRef.current?.close().catch(() => {});
    },
    [],
  );

  function audioUrl(file: string): string {
    return `${import.meta.env.BASE_URL}audio/${file}`;
  }

  function getLandingBgmAudio(): HTMLAudioElement {
    if (landingBgmRef.current) return landingBgmRef.current;
    const audio = new Audio(audioUrl('landing.mp3'));
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    landingBgmRef.current = audio;
    return audio;
  }

  function getAmbienceAudio(): HTMLAudioElement {
    if (ambienceRef.current) return ambienceRef.current;
    const audio = new Audio(audioUrl('archive-room-tone.wav'));
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    ambienceRef.current = audio;
    return audio;
  }

  function createZoneBgmAudio(config: ZoneBgmConfig): HTMLAudioElement {
    const audio = new Audio(audioUrl(config.file));
    audio.loop = config.loop;
    audio.preload = 'auto';
    audio.volume = 0;
    audio.addEventListener('ended', () => {
      if (!config.silenceAfterEndMs) return;
      if (zoneBgmIdRef.current !== config.id) return;
      clearTimer(memoryReplayTimerRef);
      memoryReplayTimerRef.current = window.setTimeout(() => {
        if (zoneBgmIdRef.current !== config.id || currentSceneRef.current !== 'memorySketch') return;
        audio.currentTime = 0;
        playAudio(audio);
        fadeZoneBgmTo(getZoneTargetVolume(config), ZONE_BGM_FADE_IN_MS);
      }, config.silenceAfterEndMs);
    });
    return audio;
  }

  function getFinalReportBgmAudio(): HTMLAudioElement {
    if (finalReportBgmRef.current) return finalReportBgmRef.current;
    const audio = new Audio(audioUrl('final-report-trace-room.mp3'));
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    finalReportBgmRef.current = audio;
    return audio;
  }

  function getSignatureAudio(): HTMLAudioElement {
    if (signatureRef.current) return signatureRef.current;
    const audio = new Audio(audioUrl('clue-recorded-signature.wav'));
    audio.preload = 'auto';
    audio.volume = CLUE_SIGNATURE_VOLUME;
    signatureRef.current = audio;
    return audio;
  }

  function playSignature() {
    const now = performance.now();
    if (now - lastSignaturePlayedAtRef.current < SIGNATURE_RETRIGGER_GUARD_MS) return;

    const audio = getSignatureAudio();
    lastSignaturePlayedAtRef.current = now;
    audio.volume = CLUE_SIGNATURE_VOLUME;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }

  function playAudio(audio: HTMLAudioElement) {
    if (!audio.paused) return;
    void audio.play().catch(() => {
      armAudioUnlock();
    });
  }

  function playLandingBgm() {
    playAudio(getLandingBgmAudio());
  }

  function stopLandingBgm() {
    const audio = landingBgmRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }

  function playAmbience() {
    playAudio(getAmbienceAudio());
  }

  function playFinalReportBgm(options: { restart?: boolean } = {}) {
    const audio = getFinalReportBgmAudio();
    if (options.restart) audio.currentTime = 0;
    playAudio(audio);
  }

  function stopFinalReportBgm() {
    const audio = finalReportBgmRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }

  function stopZoneBgm() {
    clearTimer(memoryReplayTimerRef);
    const audio = zoneBgmRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    zoneBgmRef.current = null;
    zoneBgmIdRef.current = null;
    zoneBgmConfigRef.current = null;
  }

  function playCurrentSceneBed(options: { immediateLanding?: boolean } = {}) {
    const latestScene = currentSceneRef.current;
    if (latestScene === 'landing') {
      if (options.immediateLanding) {
        const audio = getLandingBgmAudio();
        cancelFrame(landingVolumeFrameRef);
        audio.volume = LANDING_BGM_VOLUME;
        playAudio(audio);
      } else {
        playLandingBgm();
        fadeLandingBgmTo(LANDING_BGM_VOLUME, LANDING_BGM_FADE_IN_MS);
      }
      return;
    }

    if (FINAL_REPORT_BGM_SCENES.has(latestScene)) {
      playFinalReportBgm();
      fadeFinalReportBgmTo(FINAL_REPORT_BGM_VOLUME, FINAL_REPORT_BGM_FADE_IN_MS);
      return;
    }

    if (POST_ELEVATOR_AMBIENCE_SCENES.has(latestScene)) {
      playAmbience();
      fadeAmbienceTo(
        getAmbienceTargetVolume(latestScene, duckedRef.current),
        duckedRef.current ? ARCHIVE_DUCK_FADE_MS : ARCHIVE_RESTORE_FADE_MS,
      );
    }

    const zoneConfig = ZONE_BGM_BY_SCENE[latestScene] ?? null;
    if (zoneConfig) transitionZoneBgm(zoneConfig, duckedRef.current);
  }

  function armAudioUnlock() {
    if (unlockArmedRef.current) return;
    unlockArmedRef.current = true;

    const unlock = () => {
      unlockArmedRef.current = false;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      playCurrentSceneBed();
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  function transitionZoneBgm(nextConfig: ZoneBgmConfig | null, isDucked: boolean) {
    const currentConfig = zoneBgmConfigRef.current;
    const currentAudio = zoneBgmRef.current;
    const targetVolume = nextConfig ? getZoneTargetVolume(nextConfig) : 0;

    clearTimer(zoneTransitionTimerRef);
    clearTimer(memoryReplayTimerRef);

    if (currentConfig?.id === nextConfig?.id && currentAudio) {
      playAudio(currentAudio);
      fadeZoneBgmTo(targetVolume, isDucked ? ARCHIVE_DUCK_FADE_MS : ARCHIVE_RESTORE_FADE_MS);
      return;
    }

    const token = zoneTransitionTokenRef.current + 1;
    zoneTransitionTokenRef.current = token;

    const startNext = () => {
      if (zoneTransitionTokenRef.current !== token || !nextConfig) return;
      const audio = createZoneBgmAudio(nextConfig);
      zoneBgmRef.current = audio;
      zoneBgmIdRef.current = nextConfig.id;
      zoneBgmConfigRef.current = nextConfig;
      playAudio(audio);
      fadeZoneBgmTo(getZoneTargetVolume(nextConfig), ZONE_BGM_FADE_IN_MS);
    };

    if (currentAudio) {
      fadeZoneBgmTo(0, ZONE_BGM_FADE_OUT_MS, () => {
        if (zoneTransitionTokenRef.current !== token) return;
        stopZoneBgm();
        if (!nextConfig) return;
        zoneTransitionTimerRef.current = window.setTimeout(startNext, ZONE_BGM_GAP_MS);
      });
      return;
    }

    if (nextConfig) {
      zoneTransitionTimerRef.current = window.setTimeout(startNext, ZONE_BGM_GAP_MS);
    }
  }

  function getZoneTargetVolume(config: ZoneBgmConfig) {
    return config.volume;
  }

  function getAmbienceTargetVolume(scene: SceneId, isDucked: boolean) {
    if (scene === 'soundClues') {
      return isDucked ? SOUND_CLUES_AMBIENCE_DUCK_VOLUME : SOUND_CLUES_AMBIENCE_VOLUME;
    }
    return isDucked ? ARCHIVE_AMBIENCE_DUCK_VOLUME : ARCHIVE_AMBIENCE_VOLUME;
  }

  function playButtonClick() {
    const now = performance.now();
    if (now - lastButtonClickPlayedAtRef.current < BUTTON_CLICK_RETRIGGER_GUARD_MS) return;
    lastButtonClickPlayedAtRef.current = now;

    const AudioContextCtor = window.AudioContext;
    if (!AudioContextCtor) return;

    const context = buttonClickContextRef.current ?? new AudioContextCtor();
    buttonClickContextRef.current = context;

    void context.resume().then(() => {
      const startedAt = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(620, startedAt);
      oscillator.frequency.exponentialRampToValueAtTime(390, startedAt + 0.045);
      gain.gain.setValueAtTime(0.0001, startedAt);
      gain.gain.exponentialRampToValueAtTime(UI_BUTTON_CLICK_VOLUME, startedAt + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.055);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startedAt);
      oscillator.stop(startedAt + 0.06);
    }).catch(() => {});
  }

  function fadeLandingBgmTo(targetVolume: number, durationMs: number, onComplete?: () => void) {
    fadeAudioTo(getLandingBgmAudio(), landingVolumeFrameRef, targetVolume, durationMs, onComplete);
  }

  function fadeAmbienceTo(targetVolume: number, durationMs: number, onComplete?: () => void) {
    fadeAudioTo(getAmbienceAudio(), ambienceVolumeFrameRef, targetVolume, durationMs, onComplete);
  }

  function fadeZoneBgmTo(targetVolume: number, durationMs: number, onComplete?: () => void) {
    const audio = zoneBgmRef.current;
    if (!audio) {
      onComplete?.();
      return;
    }
    fadeAudioTo(audio, zoneBgmVolumeFrameRef, targetVolume, durationMs, onComplete);
  }

  function fadeFinalReportBgmTo(targetVolume: number, durationMs: number, onComplete?: () => void) {
    const audio = finalReportBgmRef.current;
    if (!audio) {
      onComplete?.();
      return;
    }
    fadeAudioTo(audio, finalReportVolumeFrameRef, targetVolume, durationMs, onComplete);
  }

  function fadeAudioTo(
    audio: HTMLAudioElement,
    frameRef: MutableRefObject<number | null>,
    targetVolume: number,
    durationMs: number,
    onComplete?: () => void,
  ) {
    cancelFrame(frameRef);

    const fromVolume = audio.volume;
    const startedAt = performance.now();
    const clampedTarget = Math.min(1, Math.max(0, targetVolume));

    if (durationMs <= 0 || Math.abs(fromVolume - clampedTarget) < 0.001) {
      audio.volume = clampedTarget;
      onComplete?.();
      return;
    }

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      audio.volume = fromVolume + (clampedTarget - fromVolume) * eased;

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(step);
        return;
      }

      frameRef.current = null;
      onComplete?.();
    };

    frameRef.current = window.requestAnimationFrame(step);
  }

  function cancelFrame(frameRef: MutableRefObject<number | null>) {
    if (frameRef.current === null) return;
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }

  function clearTimer(timerRef: MutableRefObject<number | null>) {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  return null;
}
