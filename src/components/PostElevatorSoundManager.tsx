import { useEffect, useRef, useState } from 'react';
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
  FINAL_REPORT_BGM_FADE_IN_MS,
  FINAL_REPORT_BGM_FADE_OUT_MS,
  FINAL_REPORT_BGM_VOLUME,
  type ArchiveAmbienceDuckDetail,
} from '../lib/postElevatorAudio';

const NON_FINAL_AMBIENCE_SCENES = new Set<SceneId>([
  'landing',
  'intro',
  'registration',
  'lightArchive',
  'recordLayerFirstVisit',
  'zone03Intro',
  'soundClues',
  'memorySketch',
  'sentenceClues',
  'recordLayerSecondVisit',
]);

const SIGNATURE_RETRIGGER_GUARD_MS = 90;

interface PostElevatorSoundManagerProps {
  currentScene: SceneId;
}

export function PostElevatorSoundManager({ currentScene }: PostElevatorSoundManagerProps) {
  const ambienceRef = useRef<HTMLAudioElement | null>(null);
  const finalReportBgmRef = useRef<HTMLAudioElement | null>(null);
  const signatureRef = useRef<HTMLAudioElement | null>(null);
  const ambienceVolumeFrameRef = useRef<number | null>(null);
  const finalReportVolumeFrameRef = useRef<number | null>(null);
  const lastSignaturePlayedAtRef = useRef(0);
  const previousSceneRef = useRef(currentScene);
  const unlockArmedRef = useRef(false);
  const finalReportActiveRef = useRef(false);
  const currentSceneRef = useRef(currentScene);
  const [ducked, setDucked] = useState(false);

  currentSceneRef.current = currentScene;

  useEffect(() => {
    const handleDuck = (event: Event) => {
      const detail = (event as CustomEvent<ArchiveAmbienceDuckDetail>).detail;
      setDucked(Boolean(detail?.ducked));
    };

    const handleSignature = () => playSignature();
    const handleDocumentClick = (event: MouseEvent) => {
      if (!isButtonLikeClick(event)) return;
      playSignature();
    };

    window.addEventListener(ARCHIVE_AMBIENCE_DUCK_EVENT, handleDuck);
    window.addEventListener(CLUE_SIGNATURE_EVENT, handleSignature);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      window.removeEventListener(ARCHIVE_AMBIENCE_DUCK_EVENT, handleDuck);
      window.removeEventListener(CLUE_SIGNATURE_EVENT, handleSignature);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, []);

  useEffect(() => {
    if (previousSceneRef.current !== currentScene) {
      playSignature();
      previousSceneRef.current = currentScene;
    }

    const shouldPlayAmbience = NON_FINAL_AMBIENCE_SCENES.has(currentScene);
    const isFinalReport = currentScene === 'finalReport';
    const wasFinalReport = finalReportActiveRef.current;
    finalReportActiveRef.current = isFinalReport;

    if (!isFinalReport) {
      fadeFinalReportBgmTo(0, FINAL_REPORT_BGM_FADE_OUT_MS, () => stopFinalReportBgm());
    }

    if (!shouldPlayAmbience && !isFinalReport) {
      if (!ambienceRef.current) return;
      fadeAmbienceTo(0, 360, () => {
        ambienceRef.current?.pause();
      });
      return;
    }

    if (isFinalReport) {
      if (!wasFinalReport) stopFinalReportBgm();
      fadeAmbienceTo(0, ARCHIVE_FINAL_FADE_MS, () => {
        ambienceRef.current?.pause();
      });
      playFinalReportBgm();
      fadeFinalReportBgmTo(FINAL_REPORT_BGM_VOLUME, FINAL_REPORT_BGM_FADE_IN_MS);
      return;
    }

    playAmbience();

    fadeAmbienceTo(
      ducked ? ARCHIVE_AMBIENCE_DUCK_VOLUME : ARCHIVE_AMBIENCE_VOLUME,
      ducked ? ARCHIVE_DUCK_FADE_MS : ARCHIVE_RESTORE_FADE_MS,
    );
  }, [currentScene, ducked]);

  useEffect(
    () => () => {
      if (ambienceVolumeFrameRef.current !== null) window.cancelAnimationFrame(ambienceVolumeFrameRef.current);
      if (finalReportVolumeFrameRef.current !== null) window.cancelAnimationFrame(finalReportVolumeFrameRef.current);
      ambienceRef.current?.pause();
      finalReportBgmRef.current?.pause();
      signatureRef.current?.pause();
    },
    [],
  );

  function getAmbienceAudio(): HTMLAudioElement | null {
    if (ambienceRef.current) return ambienceRef.current;
    const audio = new Audio(`${import.meta.env.BASE_URL}audio/archive-room-tone.wav`);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    ambienceRef.current = audio;
    return audio;
  }

  function getFinalReportBgmAudio(): HTMLAudioElement | null {
    if (finalReportBgmRef.current) return finalReportBgmRef.current;
    const audio = new Audio(`${import.meta.env.BASE_URL}audio/final-report-trace-room.mp3`);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    finalReportBgmRef.current = audio;
    return audio;
  }

  function getSignatureAudio(): HTMLAudioElement | null {
    if (signatureRef.current) return signatureRef.current;
    const audio = new Audio(`${import.meta.env.BASE_URL}audio/clue-recorded-signature.wav`);
    audio.preload = 'auto';
    audio.volume = CLUE_SIGNATURE_VOLUME;
    signatureRef.current = audio;
    return audio;
  }

  function playSignature() {
    const now = performance.now();
    if (now - lastSignaturePlayedAtRef.current < SIGNATURE_RETRIGGER_GUARD_MS) return;

    const audio = getSignatureAudio();
    if (!audio) return;

    lastSignaturePlayedAtRef.current = now;
    audio.volume = CLUE_SIGNATURE_VOLUME;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }

  function isButtonLikeClick(event: MouseEvent) {
    if (event.defaultPrevented) return false;
    const target = event.target;
    if (!(target instanceof Element)) return false;

    const interactive = target.closest('button, a, [role="button"], input[type="button"], input[type="submit"]');
    if (!interactive) return false;
    if (interactive instanceof HTMLButtonElement && interactive.disabled) return false;
    if (interactive instanceof HTMLInputElement && interactive.disabled) return false;
    if (interactive.getAttribute('aria-disabled') === 'true') return false;
    return true;
  }

  function playAmbience() {
    const audio = getAmbienceAudio();
    if (!audio || !audio.paused) return;

    void audio.play().catch(() => {
      armAudioUnlock();
    });
  }

  function playFinalReportBgm() {
    const audio = getFinalReportBgmAudio();
    if (!audio || !audio.paused) return;

    audio.currentTime = 0;
    void audio.play().catch(() => {
      armAudioUnlock();
    });
  }

  function stopFinalReportBgm() {
    const audio = finalReportBgmRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }

  function armAudioUnlock() {
    if (unlockArmedRef.current) return;
    unlockArmedRef.current = true;

    const unlock = () => {
      unlockArmedRef.current = false;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      const latestScene = currentSceneRef.current;
      if (latestScene === 'finalReport') {
        playFinalReportBgm();
        fadeFinalReportBgmTo(FINAL_REPORT_BGM_VOLUME, FINAL_REPORT_BGM_FADE_IN_MS);
        return;
      }
      if (NON_FINAL_AMBIENCE_SCENES.has(latestScene)) playAmbience();
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  function fadeAmbienceTo(targetVolume: number, durationMs: number, onComplete?: () => void) {
    const audio = getAmbienceAudio();
    if (!audio) return;

    if (ambienceVolumeFrameRef.current !== null) {
      window.cancelAnimationFrame(ambienceVolumeFrameRef.current);
      ambienceVolumeFrameRef.current = null;
    }

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
        ambienceVolumeFrameRef.current = window.requestAnimationFrame(step);
        return;
      }

      ambienceVolumeFrameRef.current = null;
      onComplete?.();
    };

    ambienceVolumeFrameRef.current = window.requestAnimationFrame(step);
  }

  function fadeFinalReportBgmTo(targetVolume: number, durationMs: number, onComplete?: () => void) {
    const audio = finalReportBgmRef.current;
    if (!audio) {
      onComplete?.();
      return;
    }

    if (finalReportVolumeFrameRef.current !== null) {
      window.cancelAnimationFrame(finalReportVolumeFrameRef.current);
      finalReportVolumeFrameRef.current = null;
    }

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
        finalReportVolumeFrameRef.current = window.requestAnimationFrame(step);
        return;
      }

      finalReportVolumeFrameRef.current = null;
      onComplete?.();
    };

    finalReportVolumeFrameRef.current = window.requestAnimationFrame(step);
  }

  return null;
}
