import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ZoneFilm } from '../data/zoneFilms';
import { useFilmSound, setFilmMuted } from '../hooks/useFilmSound';
import './ZoneIntroCard.css';
import './ZoneFilmTransition.css';

type Phase = 'video' | 'videoOut' | 'titleIn' | 'titleHold' | 'reveal' | 'done';
interface Props {
  film: ZoneFilm;
  zone: string;
  onReveal: () => void;
  onComplete: () => void;
}

export function ZoneFilmTransition({ film, zone, onReveal, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('video');
  const [phaseFile, setPhaseFile] = useState(film.file);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const muted = useFilmSound();
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishedRef = useRef(false);
  const mountedRef = useRef(false);
  const playAttemptRef = useRef(0);
  const callbacks = useRef({ onReveal, onComplete });
  callbacks.current = { onReveal, onComplete };

  useLayoutEffect(() => {
    finishedRef.current = false;
    setPhase('video');
    setPhaseFile(film.file);
    setPlaying(false);
    setNeedsPlay(false);
    setFailed(false);
  }, [film.file]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    videoRef.current?.pause(); // Do not seek: hold the delivered final frame.
    setPhase('videoOut');
  }, []);

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const attempt = ++playAttemptRef.current;
    const isCurrent = () => mountedRef.current && !finishedRef.current && attempt === playAttemptRef.current;
    const showFailure = (error: unknown) => {
      if (!isCurrent()) return;
      if (error instanceof DOMException && error.name === 'NotAllowedError') setNeedsPlay(true);
      else if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(true);
    };
    try {
      await video.play();
      if (isCurrent()) setNeedsPlay(false);
    } catch (error) {
      if (!isCurrent()) return;
      showFailure(error);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const video = videoRef.current;
    void play();
    return () => {
      mountedRef.current = false;
      playAttemptRef.current += 1;
      video?.pause();
    };
  }, [play, film.file]);

  const playWithSound = () => {
    if (videoRef.current) videoRef.current.muted = false;
    setFilmMuted(false);
    void play();
  };

  useEffect(() => {
    // A source swap must not deliver the previous file's "done" to the new one.
    if (phaseFile !== film.file) return;
    let delay: number;
    let next: () => void;
    switch (phase) {
      case 'videoOut':
        delay = 800;
        next = () => setPhase(film.title ? 'titleIn' : 'done');
        break;
      case 'titleIn': delay = 250; next = () => setPhase('titleHold'); break;
      case 'titleHold':
        delay = 1500;
        next = () => { callbacks.current.onReveal(); setPhase('reveal'); };
        break;
      case 'reveal': delay = 400; next = () => setPhase('done'); break;
      case 'done': callbacks.current.onComplete(); return;
      default: return;
    }
    const timer = window.setTimeout(next, delay);
    return () => window.clearTimeout(timer);
  }, [phase, phaseFile, film.title, film.file]);

  const showingVideo = phaseFile !== film.file || phase === 'video' || phase === 'videoOut';
  return (
    <section className={`zone-film zone-film--${phase}`} aria-label="공간 진입 영상" data-phase={phase}>
      <video
        ref={videoRef}
        className={`zone-film__video${playing ? ' zone-film__video--playing' : ''}`}
        hidden={!showingVideo && Boolean(film.title)}
        src={`${import.meta.env.BASE_URL}video/zones/${film.file}`}
        muted={muted}
        playsInline
        preload="auto"
        onEnded={finish}
        onError={() => setFailed(true)}
        onPlaying={() => {
          if (finishedRef.current) return;
          setPlaying(true);
          setNeedsPlay(false);
        }}
        onPause={(event) => {
          const video = event.currentTarget;
          // Source changes and cleanup can emit pause too; only offer resume
          // for a real interruption of an already-playing, unfinished clip.
          if (mountedRef.current && !finishedRef.current && !video.ended && video.currentTime > 0) setNeedsPlay(true);
        }}
      />
      {phase === 'video' && <>
        {(needsPlay || failed) && <div className="zone-film__fallback" role="status">
          {failed && <p>영상을 재생할 수 없습니다.</p>}
          <button type="button" className="cta cta--secondary" onClick={failed ? finish : playWithSound}>
            {failed ? '계속하기' : '소리 켜고 재생'}
          </button>
        </div>}
        {!failed && <button type="button" className="zone-film__sound" aria-pressed={muted} onClick={() => { const next = !muted; setFilmMuted(next); if (videoRef.current) videoRef.current.muted = next; if (needsPlay) void play(); }}>{muted ? '소리 켜기' : '소리 끄기'}</button>}
        <button type="button" className="zone-film__skip" onClick={finish}>건너뛰기</button>
      </>}
      {!showingVideo && film.title && <div className="zone-intro-card zone-film__title" role="status">
        <span className="zone-intro-card__zone">{zone}</span>
        <h1 className="zone-intro-card__title">{film.title}</h1>
        {film.subtitle && <p className="zone-intro-card__subtitle">{film.subtitle}</p>}
      </div>}
    </section>
  );
}
