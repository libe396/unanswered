import { useEffect, useRef, useState } from 'react';
import { SENSORY_WORDS, SOUND_CLUES } from '../data/content';
import { useExperienceStore } from '../store/experienceStore';
import { TerminalCorners } from '../components/TerminalCorners';
import type { SoundPlayEvent } from '../types';
import './SoundCluesScene.css';

interface SoundRuntime {
  totalPlayedMs: number;
  replayCount: number;
  completedFully: boolean;
  isPlaying: boolean;
  progress: number;
}

function emptyRuntime(): SoundRuntime {
  return { totalPlayedMs: 0, replayCount: 0, completedFully: false, isPlaying: false, progress: 0 };
}

export function SoundCluesScene() {
  const recordSoundEvent = useExperienceStore((s) => s.recordSoundEvent);
  const setSoundSelection = useExperienceStore((s) => s.setSoundSelection);
  const completeScene = useExperienceStore((s) => s.completeScene);

  const [runtime, setRuntime] = useState<Record<string, SoundRuntime>>({});
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  const intervalRef = useRef<number | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const playStartRef = useRef(0);

  function getRuntime(id: string): SoundRuntime {
    return runtime[id] ?? emptyRuntime();
  }

  // ─── Playback engine (placeholder) ──────────────────────────────────────
  // TODO(real audio): once files exist at SOUND_CLUES[].src, replace the
  // setInterval-driven simulation below with a real HTMLAudioElement — drive
  // `progress` from its `timeupdate` event, flip `completedFully` on `ended`,
  // and compute elapsed time in finalizeActivePlayback() from
  // `audio.currentTime` instead of `Date.now() - playStartRef.current`. The
  // public shape (SoundRuntime / SoundPlayEvent) and every call site below
  // (play/stop/handleConfirm/unmount) stays identical either way.

  /** Commits whatever sound is currently active into totalPlayedMs and stops
   *  it. Safe to call when nothing is playing (no-op). Must run before
   *  starting a different sound, on manual stop, right before confirming the
   *  scene, and on unmount/scene change — otherwise the in-progress listen
   *  time for the active sound is silently lost. */
  function finalizeActivePlayback() {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const activeId = activeIdRef.current;
    if (activeId === null) return;
    activeIdRef.current = null;

    const clue = SOUND_CLUES.find((c) => c.id === activeId);
    const duration = clue?.durationMs ?? 0;
    const elapsed = Date.now() - playStartRef.current;
    const cappedElapsed = duration > 0 ? Math.min(elapsed, duration) : elapsed;
    const progress = duration > 0 ? cappedElapsed / duration : 1;

    setRuntime((prev) => {
      const current = prev[activeId];
      // Already finalized by the completion branch in play()'s interval —
      // avoid double-counting durationMs.
      if (!current || !current.isPlaying) return prev;
      return {
        ...prev,
        [activeId]: {
          ...current,
          isPlaying: false,
          progress,
          totalPlayedMs: current.totalPlayedMs + cappedElapsed,
        },
      };
    });
  }

  useEffect(() => () => finalizeActivePlayback(), []);

  function play(soundId: string) {
    const clue = SOUND_CLUES.find((c) => c.id === soundId);
    if (!clue || activeIdRef.current === soundId) return;

    finalizeActivePlayback();
    const alreadyListened = getRuntime(soundId).totalPlayedMs > 0;
    activeIdRef.current = soundId;
    playStartRef.current = Date.now();

    setRuntime((prev) => {
      const current = prev[soundId] ?? emptyRuntime();
      return {
        ...prev,
        [soundId]: {
          ...current,
          isPlaying: true,
          progress: 0,
          replayCount: alreadyListened ? current.replayCount + 1 : current.replayCount,
        },
      };
    });

    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - playStartRef.current;
      const progress = Math.min(elapsed / clue.durationMs, 1);

      if (elapsed >= clue.durationMs) {
        window.clearInterval(intervalRef.current!);
        intervalRef.current = null;
        activeIdRef.current = null;
        setRuntime((prev) => {
          const current = prev[soundId] ?? emptyRuntime();
          return {
            ...prev,
            [soundId]: {
              ...current,
              isPlaying: false,
              completedFully: true,
              progress: 1,
              totalPlayedMs: current.totalPlayedMs + clue.durationMs,
            },
          };
        });
        return;
      }

      setRuntime((prev) => ({
        ...prev,
        [soundId]: { ...(prev[soundId] ?? emptyRuntime()), progress },
      }));
    }, 100);
  }

  function stop(soundId: string) {
    if (activeIdRef.current !== soundId) return;
    finalizeActivePlayback();
  }

  function handleConfirm() {
    if (!selectedSoundId || !selectedKeyword) return;
    finalizeActivePlayback();

    SOUND_CLUES.forEach((clue) => {
      const r = getRuntime(clue.id);
      const event: SoundPlayEvent = {
        soundId: clue.id,
        totalPlayedMs: Math.round(r.totalPlayedMs),
        replayCount: r.replayCount,
        completedFully: r.completedFully,
        skipped: r.totalPlayedMs === 0 && !r.completedFully,
      };
      recordSoundEvent(event);
    });

    setSoundSelection(selectedSoundId, selectedKeyword);
    completeScene('soundClues');
  }

  return (
    <div className="sound-clues-scene">
      <p className="sound-clues-scene__hint">그 사람의 기억에선 어떤 소리가 존재했을까요?</p>

      <div className="sound-clues-scene__list">
        {SOUND_CLUES.map((clue) => {
          const r = getRuntime(clue.id);
          return (
            <div
              key={clue.id}
              className={`sound-clues-scene__item${
                selectedSoundId === clue.id ? ' sound-clues-scene__item--selected' : ''
              }`}
            >
              <div className="sound-clues-scene__item-text">
                <span className="sound-clues-scene__item-label">{clue.label}</span>
                <span className="sound-clues-scene__item-desc">{clue.description}</span>
              </div>
              <div className="sound-clues-scene__item-track">
                <div className="sound-clues-scene__item-track-fill" style={{ width: `${r.progress * 100}%` }} />
              </div>
              <div className="sound-clues-scene__item-actions">
                <button
                  className="sound-clues-scene__mini-btn"
                  onClick={() => (r.isPlaying ? stop(clue.id) : play(clue.id))}
                >
                  {r.isPlaying ? '멈춤' : r.completedFully ? '다시 듣기' : '재생'}
                </button>
                <button
                  className="sound-clues-scene__mini-btn"
                  onClick={() => setSelectedSoundId(clue.id)}
                >
                  이 소리 선택
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sound-clues-scene__keyword-block">
        <p className="sound-clues-scene__sublabel">이 소리를 들었을 때, 그 사람이 느꼈을 것 같은 감정은 무엇일까요?</p>
        <div className="sound-clues-scene__keywords">
          {SENSORY_WORDS.map((word) => (
            <button
              key={word}
              className={`sound-clues-scene__keyword${
                selectedKeyword === word ? ' sound-clues-scene__keyword--selected' : ''
              }`}
              onClick={() => setSelectedKeyword(word)}
            >
              {word}
            </button>
          ))}
        </div>
      </div>

      <button
        className="sound-clues-scene__confirm"
        onClick={handleConfirm}
        disabled={!selectedSoundId || !selectedKeyword}
      >
        <TerminalCorners />
        다음으로
      </button>
    </div>
  );
}
