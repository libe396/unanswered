import { useCallback, useEffect, useRef, useState } from 'react';
import { useExperienceStore } from '../store/experienceStore';
import './IntroFilmScene.css';

/**
 * Fade-to-black on the film's last frame, then a short held silence before
 * the next Scene is allowed to mount — see finishFilm. The black-to-frame
 * fade-in on the way in is CSS-driven (IntroFilmScene.css, 400ms).
 */
const FADE_TO_BLACK_MS = 550;
const POST_BLACK_HOLD_MS = 500;

/** The film has to be underway before anything is offered on top of it. */
const SKIP_VISIBLE_AFTER_MS = 2000;

const VIDEO_SRC = `${import.meta.env.BASE_URL}video/intro-film.mp4`;

/**
 * The bridge between the elevator and the first investigation Scene. It is
 * deliberately not a "video player" — advancing past it is still driven by
 * the video's own `ended` event (never a timer guessing at duration), so a
 * slow network or a paused tab can never leave the visitor stranded on the
 * wrong side of the departure sequence, and it can never advance a beat
 * early either.
 *
 * Three pieces of chrome, and no more: a SKIP, a 2px progress bar with no
 * time readout, and a sound toggle (the film carries narration, and a
 * gallery visitor has to be able to silence it). No scrubber, no play/pause,
 * no volume slider — those would make this a player.
 *
 * Sound matters here, so autoplay is attempted unmuted first. Browsers that
 * block that (no proximate gesture survives the elevator's own departure
 * timers) fall back to starting on the next click/key/touch anywhere on
 * screen, with no visible prompt for it.
 */
export function IntroFilmScene() {
  const completeScene = useExperienceStore((s) => s.completeScene);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [ended, setEnded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const [skipVisible, setSkipVisible] = useState(false);
  const advancedRef = useRef(false);
  const finishTimersRef = useRef<number[]>([]);

  const advance = useCallback(() => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    completeScene('introFilm');
  }, [completeScene]);

  /**
   * The single exit from this Scene. `ended` and SKIP both come through here,
   * so skipping lands on exactly the same beat the film's own ending does —
   * fade to black, hold, then advance — rather than cutting straight out.
   */
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
      // The show must go on even if the file failed to load — hold on black
      // for a beat rather than exposing a broken player, then continue.
      window.setTimeout(advance, POST_BLACK_HOLD_MS);
    }

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);

    const skipTimer = window.setTimeout(() => {
      if (!cancelled) setSkipVisible(true);
    }, SKIP_VISIBLE_AFTER_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(skipTimer);
      finishTimersRef.current.forEach((id) => window.clearTimeout(id));
      finishTimersRef.current = [];
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
    };
  }, [advance, finishFilm]);

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

  function toggleSound() {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    setMuted(next);
  }

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

      {/* Chrome sits above the gesture catcher so SKIP and the sound toggle
          stay clickable even while playback is waiting on a gesture. */}
      <div className="intro-film-scene__chrome">
        <button
          type="button"
          className="intro-film-scene__sound"
          onClick={toggleSound}
          aria-pressed={muted}
        >
          {muted ? 'SOUND OFF' : 'SOUND ON'}
        </button>

        <button
          type="button"
          className={`intro-film-scene__skip${
            skipVisible ? ' intro-film-scene__skip--visible' : ''
          }`}
          onClick={finishFilm}
          tabIndex={skipVisible ? 0 : -1}
        >
          <span>SKIP</span>
          <span className="intro-film-scene__skip-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>

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
