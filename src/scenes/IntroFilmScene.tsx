import { useEffect, useRef, useState } from 'react';
import { useExperienceStore } from '../store/experienceStore';
import './IntroFilmScene.css';

/**
 * Fade-to-black on the film's last frame, then a short held silence before
 * the next Scene is allowed to mount — see handleEnded. The black-to-frame
 * fade-in on the way in is CSS-driven (IntroFilmScene.css, 550ms), inside
 * the 400–700ms window the piece calls for elsewhere.
 */
const FADE_TO_BLACK_MS = 550;
const POST_BLACK_HOLD_MS = 500;

const VIDEO_SRC = `${import.meta.env.BASE_URL}video/intro-film.mp4`;

/**
 * The bridge between the elevator and the first investigation Scene. It is
 * deliberately not a "video player" — no controls, no chrome, nothing to
 * click during playback. Advancing past it is driven entirely by the video's
 * own `ended` event (never a timer guessing at duration), so a slow network
 * or a paused tab can never leave the visitor stranded on the wrong side of
 * the departure sequence, and it can never advance a beat early either.
 *
 * Sound matters here — the film carries its own narration — so autoplay is
 * attempted unmuted first. Browsers that block that (no proximate gesture
 * survives the elevator's own departure timers) fall back to starting on the
 * next click/key/touch anywhere on screen, with no visible prompt for it.
 */
export function IntroFilmScene() {
  const completeScene = useExperienceStore((s) => s.completeScene);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [ended, setEnded] = useState(false);
  const advancedRef = useRef(false);

  function advance() {
    if (advancedRef.current) return;
    advancedRef.current = true;
    completeScene('introFilm');
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    function attemptPlay() {
      if (!video) return;
      video.play().catch(() => {
        if (cancelled) return;
        setNeedsGesture(true);
      });
    }

    function handleLoadedData() {
      if (cancelled) return;
      setFrameReady(true);
      attemptPlay();
    }

    function handlePlaying() {
      if (cancelled) return;
      setNeedsGesture(false);
    }

    function handleEnded() {
      if (cancelled) return;
      setEnded(true);
      window.setTimeout(() => {
        if (cancelled) return;
        window.setTimeout(advance, POST_BLACK_HOLD_MS);
      }, FADE_TO_BLACK_MS);
    }

    function handleError() {
      if (cancelled) return;
      // The show must go on even if the file failed to load — hold on black
      // for a beat rather than exposing a broken player, then continue.
      window.setTimeout(advance, POST_BLACK_HOLD_MS);
    }

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    return () => {
      cancelled = true;
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!needsGesture) return;

    function handleGesture() {
      videoRef.current?.play().catch(() => {});
    }

    window.addEventListener('pointerdown', handleGesture);
    window.addEventListener('keydown', handleGesture);
    window.addEventListener('touchstart', handleGesture);

    return () => {
      window.removeEventListener('pointerdown', handleGesture);
      window.removeEventListener('keydown', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
    };
  }, [needsGesture]);

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
        playsInline
        controls={false}
        disablePictureInPicture
        controlsList="nodownload noremoteplayback nofullscreen"
      />
      {needsGesture ? <div className="intro-film-scene__gesture-catcher" aria-hidden="true" /> : null}
      <div className="intro-film-scene__curtain" aria-hidden="true" />
    </div>
  );
}
