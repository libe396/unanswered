import { useCallback, useEffect, useRef, useState } from 'react';
import { useExperienceStore } from '../store/experienceStore';
import { setFilmMuted } from '../hooks/useFilmSound';
import './IntroFilmScene.css';

/**
 * Fade-to-black on the film's last frame, then a short held silence before
 * the next Scene is allowed to mount — see finishFilm. The black-to-frame
 * fade-in on the way in is CSS-driven (IntroFilmScene.css, 800ms).
 */
const FADE_TO_BLACK_MS = 800;
const POST_BLACK_HOLD_MS = 500;

const VIDEO_SRC = `${import.meta.env.BASE_URL}video/intro-film.mp4?v=d1f817509c4c`;

/**
 * The bridge between the elevator and the first investigation Scene. It is
 * deliberately not a "video player" — advancing past it is still driven by
 * the video's own `ended` event (never a timer guessing at duration), so a
 * slow network or a paused tab can never leave the visitor stranded on the
 * wrong side of the departure sequence, and it can never advance a beat
 * early either.
 *
 * The film must finish before advancing. Only progress and an explicit
 * audible-play fallback remain; no skip or sound-off control is offered.
 */
export function IntroFilmScene() {
  const completeScene = useExperienceStore((s) => s.completeScene);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [ended, setEnded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const advancedRef = useRef(false);
  const finishTimersRef = useRef<number[]>([]);

  const advance = useCallback(() => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    completeScene('introFilm');
  }, [completeScene]);

  /** Fade and hold after the video ends, then enter the letter. */
  const finishFilm = useCallback(() => {
    if (advancedRef.current || finishTimersRef.current.length > 0) return;
    setEnded(true);
    videoRef.current?.pause();
    finishTimersRef.current.push(
      window.setTimeout(() => {
        finishTimersRef.current.push(window.setTimeout(advance, POST_BLACK_HOLD_MS));
      }, FADE_TO_BLACK_MS),
    );
  }, [advance]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    setFilmMuted(false);
    video.muted = false;

    function attemptPlay() {
      if (!video) return;
      video.play().catch(() => {
        if (cancelled) return;
        setNeedsGesture(true);
      });
    }

    function handleLoadedData() {
      if (cancelled) return;
      attemptPlay();
    }

    function handlePlaying() {
      if (cancelled) return;
      setPlaybackFailed(false);
      setFrameReady(true);
      setNeedsGesture(false);
    }

    function handleTimeUpdate() {
      if (cancelled || !video) return;
      const { currentTime, duration } = video;
      if (!Number.isFinite(duration) || duration <= 0) return;
      setProgress(Math.min(1, currentTime / duration));
    }

    function handleEnded() {
      if (cancelled) return;
      setProgress(1);
      finishFilm();
    }

    function handleError() {
      if (cancelled) return;
      setPlaybackFailed(true);
      setNeedsGesture(true);
    }

    function handlePause() {
      if (!cancelled && video && !video.ended && finishTimersRef.current.length === 0) setNeedsGesture(true);
    }

    video.addEventListener('pause', handlePause);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    if (video.readyState >= 2) attemptPlay();

    return () => {
      cancelled = true;
      finishTimersRef.current.forEach((id) => window.clearTimeout(id));
      finishTimersRef.current = [];
      video.pause();
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [advance, finishFilm]);

  const sceneClass = [
    'intro-film-scene',
    frameReady ? 'intro-film-scene--ready' : '',
    ended ? 'intro-film-scene--ended' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={sceneClass} onContextMenu={(event) => event.preventDefault()}>
      <video
        ref={videoRef}
        className="intro-film-scene__video"
        src={VIDEO_SRC}
        preload="auto"
        muted={false}
        playsInline
        controls={false}
        disablePictureInPicture
        controlsList="nodownload noremoteplayback nofullscreen"
      />
      {needsGesture && !ended ? (
        <div className="intro-film-scene__gesture-catcher">
          <button className="cta cta--secondary" onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            setFilmMuted(false);
            if (playbackFailed) video.load();
            video.muted = false;
            void video.play().catch(() => setNeedsGesture(true));
          }}>
            {playbackFailed ? '영상 다시 재생' : '소리 켜고 재생'}
          </button>
        </div>
      ) : null}

      {/* No time readout by design: how far in you are is a shape, not a
          number to be counted down. */}
      <div className="intro-film-scene__progress" aria-hidden="true">
        <div
          className="intro-film-scene__progress-fill"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      <div className="intro-film-scene__curtain" aria-hidden="true" />
    </div>
  );
}
