import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { SOUND_CLUES } from '../data/content';
import { useExperienceStore } from '../store/experienceStore';
import { logSceneTracking, useSceneTracking } from '../hooks/useSceneTracking';
import { detectSoundPatterns } from '../lib/soundPatterns';
import { detectPositionPatterns } from '../lib/positionPatterns';
import { playClueRecordedSignature, setArchiveAmbienceDucked } from '../lib/postElevatorAudio';
import {
  POSITION_GROUP,
  SOUND_GROUP,
  SOUND_TRACKING_GROUPS,
  summarizeSound,
} from '../lib/soundTracking';
import { SOUND_THRESHOLDS } from '../lib/soundThresholds';
import { POSITION_THRESHOLDS } from '../lib/positionThresholds';
import { TerminalCorners } from '../components/TerminalCorners';
import type {
  MemoryPosition,
  PlayStopReason,
  SceneBehaviorRecord,
  SoundPlayEvent,
} from '../types';
import './SoundCluesScene.css';

/** What the list needs to draw itself. Everything countable is derived from the
 *  event log instead — see summarizeSound — so nothing here is a tally. */
interface SoundRuntime {
  isPlaying: boolean;
  progress: number;
  heardToEnd: boolean;
  /** Live playhead / clip length, in seconds — only so the player strip
   *  can show a time readout. Still not a tally: every measured figure comes
   *  from the event log via summarizeSound. */
  currentSec: number;
  durationSec: number;
}

function emptyRuntime(): SoundRuntime {
  return { isPlaying: false, progress: 0, heardToEnd: false, currentSec: 0, durationSec: 0 };
}

/** mm:ss for the player readout. */
function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * One abstract line glyph per glass dome.
 *
 * Deliberately not pictures of rain, a cup, a pencil. The Zone's whole premise
 * (see the note over SOUND_CLUES in content.ts) is that a sound named is a
 * sound answered — so each specimen gets a neutral mark, not an illustration
 * of what it might be. They differ only enough to tell the domes apart.
 */
const SPECIMEN_GLYPHS: string[] = [
  'M3 15 Q7 9 11 15 T19 15 M3 9 Q7 4 11 9 T19 9',
  'M11 3 A8 8 0 1 0 11 19 M11 7 A4 4 0 1 1 11 15',
  'M4 18 A14 14 0 0 1 18 4 M4 13 A9 9 0 0 1 13 4 M4 8 A4 4 0 0 1 8 4',
  'M4 18 L16 6 M15 5 L18 8 M6 16 L4 18 L6 16',
  'M7 3 L7 11 M7 15 L7 19 M14 5 L14 13 M14 17 L14 21',
  'M6 4 L16 4 L16 18 L6 18 Z M6 11 L16 11 M11 4 L11 18',
  'M11 3 C5 11 5 15 11 19 C17 15 17 11 11 3 Z',
];

const WAVEFORM_BARS = [
  0.18, 0.34, 0.24, 0.52, 0.38, 0.68, 0.3, 0.46, 0.22, 0.62, 0.36, 0.78,
  0.42, 0.58, 0.28, 0.7, 0.32, 0.5, 0.2, 0.44, 0.66, 0.36, 0.82, 0.48,
  0.26, 0.54, 0.72, 0.4, 0.24, 0.6, 0.34, 0.5,
];

function SpecimenGlyph({ index }: { index: number }) {
  const d = SPECIMEN_GLYPHS[index % SPECIMEN_GLYPHS.length];
  return (
    <svg viewBox="0 0 22 22" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayerWaveform({ active, progress }: { active: boolean; progress: number }) {
  return (
    <div
      className={`sound-clues-scene__player-wave${active ? ' sound-clues-scene__player-wave--active' : ''}`}
      aria-hidden="true"
    >
      <span className="sound-clues-scene__player-wave-progress" style={{ width: `${progress * 100}%` }} />
      {WAVEFORM_BARS.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className="sound-clues-scene__player-wave-bar"
          style={{ height: `${Math.round(height * 100)}%`, animationDelay: `${index * 46}ms` }}
        />
      ))}
    </div>
  );
}

/** Which of the Zone's two questions is in front of the visitor. */
type Phase = 'browse' | 'positioning';

const SOUND_CLUE_VOLUME = 0.5;

/**
 * How the Zone reads its own record back, in development.
 *
 * Named rather than raw, because the point of looking is to check a figure
 * against something that just happened in the browser, and `listenTimeBySound`
 * answers that where a list of events does not. The events are still here,
 * underneath, as the thing every figure above them can be checked against.
 */
function readSoundTracking(record: SceneBehaviorRecord) {
  const summary = summarizeSound(record);
  return {
    events: record.events,
    sessions: summary.sessions,

    listenTimeBySound: summary.listenTimeBySound,
    playCountBySound: summary.playCountBySound,
    resumeCountBySound: summary.resumeCountBySound,
    completionCountBySound: summary.completionCountBySound,
    completionRatioBySound: summary.completionRatioBySound,

    listenPath: summary.listenPath,
    firstPlayedSound: summary.firstPlayedSound,
    lastPlayedSound: summary.lastPlayedSound,
    mostListenedSound: summary.mostListenedSound,

    replayCount: summary.replayCount,
    replayCountBySound: summary.replayCountBySound,
    returnCount: summary.returnCount,
    returnCountBySound: summary.returnCountBySound,

    firstSelected: summary.firstSelected,
    finalSelected: summary.finalSelected,
    selectionPath: summary.selectionPath,
    selectionChangeCount: summary.selectionChangeCount,

    positioning: summary.positioning,
    positionPath: summary.positioning.positionPath,
    firstPosition: summary.positioning.firstPosition,
    finalPosition: summary.positioning.finalPosition,
    msToFirstPlacement: summary.positioning.msToFirstPlacement,
    positioningTime: summary.positioning.positioningTime,
    totalDragDistance: summary.positioning.totalDragDistance,
    directionChangeCount: summary.positioning.directionChangeCount,
    positionRevisionCount: summary.positioning.positionRevisionCount,
    longestPositionPauseMs: summary.positioning.longestPositionPauseMs,
    distanceBetweenFirstAndFinal: summary.positioning.distanceBetweenFirstAndFinal,
    soundReplayDuringPositioning: summary.soundReplayDuringPositioning,
    soundReplayAfterFinalPlacement: summary.soundReplayAfterPlacement,

    decisionMs: summary.decisionMs,
    postDecisionMs: summary.postDecisionMs,

    patterns: detectSoundPatterns(summary),
    positioningPatterns: detectPositionPatterns(summary),
    thresholds: { ...SOUND_THRESHOLDS, ...POSITION_THRESHOLDS },
    summary,
  };
}

export function SoundCluesScene() {
  const recordSoundEvent = useExperienceStore((s) => s.recordSoundEvent);
  const setSoundSelection = useExperienceStore((s) => s.setSoundSelection);
  const completeScene = useExperienceStore((s) => s.completeScene);
  const tracking = useSceneTracking('soundClues', SOUND_TRACKING_GROUPS, {
    debugView: readSoundTracking,
  });

  /*
    The Zone asks two things, and now asks them one at a time: which sound, and
    then where it stayed. Splitting them is not only presentation — it is what
    makes "the field appeared" a moment that exists, so the wait before the
    first mark is measured against a field the visitor could actually see.

    The chosen sound comes along to the second step. It has to: going back to
    it after placing the point is exactly what POST_PLACEMENT_REPLAY is about,
    and a step that could not replay it would make the pattern unobservable.
  */
  const [phase, setPhase] = useState<Phase>('browse');
  const [runtime, setRuntime] = useState<Record<string, SoundRuntime>>({});
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null);
  // Every dome that has been played at least once — drives the "N / 7 단서 청취"
  // readout and the small "heard" mark on a dome. Presentation only; kept
  // separate from selection, which is still a single deliberate choice.
  const [listenedIds, setListenedIds] = useState<Set<string>>(() => new Set());
  // The dome the player strip is currently describing: the last one the
  // visitor opened. Not the same as the selected one — you can listen back
  // through the shelf without changing your answer.
  const [focusedSoundId, setFocusedSoundId] = useState<string | null>(null);
  // Null until the visitor puts the point down. Deliberately not seeded at the
  // centre: an empty field asks a question, and a point already sitting in the
  // middle answers it before they arrive.
  const [position, setPosition] = useState<MemoryPosition | null>(null);

  const fieldRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  /*
    One audio element per clue, kept for the life of the scene.

    Per clue rather than one shared element because each keeps its own playhead:
    coming back to a sound picks it up where it was left, which is what makes
    resuming distinguishable from starting it over — and that distinction is the
    difference between a pause and a re-listen everywhere downstream.
  */
  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const activeIdRef = useRef<string | null>(null);
  /** Playhead where the current stretch of playback began, in ms. */
  const startedAtMsRef = useRef(0);

  function audioFor(soundId: string): HTMLAudioElement | null {
    const existing = audiosRef.current.get(soundId);
    if (existing) return existing;

    const clue = SOUND_CLUES.find((c) => c.id === soundId);
    if (!clue) return null;

    const audio = new Audio(clue.src);
    audio.preload = 'metadata';
    audio.volume = SOUND_CLUE_VOLUME;

    audio.addEventListener('timeupdate', () => {
      if (activeIdRef.current !== soundId) return;
      const duration = audio.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      const progress = Math.min(1, audio.currentTime / duration);
      setRuntime((prev) => ({
        ...prev,
        [soundId]: {
          ...(prev[soundId] ?? emptyRuntime()),
          progress,
          currentSec: audio.currentTime,
          durationSec: duration,
        },
      }));
    });

    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      setRuntime((prev) => ({
        ...prev,
        [soundId]: {
          ...(prev[soundId] ?? emptyRuntime()),
          currentSec: audio.currentTime,
          durationSec: duration,
        },
      }));
    });

    audio.addEventListener('ended', () => finalizeRef.current('ended'));

    /*
      A safety net, not the usual route. Every stop the Zone itself makes is
      finalised before the element is paused, so by the time this runs the
      playback has already been closed and it does nothing. It is here for the
      pauses the Zone did not make — a headset disconnecting, a call arriving —
      which would otherwise leave playback recorded as still running.

      The `ended` guard is not optional: reaching the end of a clip fires
      `pause` *before* `ended`, so without it every completed listen would be
      closed as an ordinary stop and no completion would ever be recorded.
    */
    audio.addEventListener('pause', () => {
      if (audio.ended) return;
      if (activeIdRef.current !== soundId) return;
      finalizeRef.current('paused');
    });

    audiosRef.current.set(soundId, audio);
    return audio;
  }

  /**
   * Closes whatever is playing and writes down what was heard.
   *
   * Safe to call when nothing is playing. Must run before starting a different
   * sound, on a manual stop, before confirming, and on unmount — the stretch of
   * listening in progress is only recorded here, and skipping it loses it.
   */
  function finalizePlayback(reason: PlayStopReason) {
    const soundId = activeIdRef.current;
    if (soundId === null) return;
    // Cleared first, so the `pause` event this is about to provoke sees no
    // active playback and does not close the same stretch a second time.
    activeIdRef.current = null;

    const audio = audiosRef.current.get(soundId);
    if (!audio) return;

    const duration = audio.duration;
    const durationMs = Number.isFinite(duration) ? duration * 1000 : 0;
    /*
      A playhead at the end of a clip is reported a hair short of the duration
      about as often as it is reported exactly, so a completed listen is
      measured to the duration rather than to wherever the last frame landed.
    */
    const toMs = reason === 'ended' && durationMs > 0 ? durationMs : audio.currentTime * 1000;

    if (!audio.paused) audio.pause();
    setArchiveAmbienceDucked(false);

    tracking.playStop(SOUND_GROUP, soundId, {
      fromMs: startedAtMsRef.current,
      toMs,
      durationMs,
      reason,
    });

    setRuntime((prev) => {
      const current = prev[soundId] ?? emptyRuntime();
      return {
        ...prev,
        [soundId]: {
          ...current,
          isPlaying: false,
          progress: reason === 'ended' ? 1 : current.progress,
          currentSec: reason === 'ended' && current.durationSec > 0 ? current.durationSec : audio.currentTime,
          durationSec: current.durationSec || (durationMs > 0 ? durationMs / 1000 : 0),
          heardToEnd: current.heardToEnd || reason === 'ended',
        },
      };
    });
  }

  // Held in a ref so the audio listeners above — bound once, when the element
  // is built — and the unmount cleanup below always reach the current one
  // rather than the closure they happened to be created in.
  const finalizeRef = useRef(finalizePlayback);
  finalizeRef.current = finalizePlayback;

  function play(soundId: string) {
    if (activeIdRef.current === soundId) return;
    finalizePlayback('switched');

    const audio = audioFor(soundId);
    if (!audio) return;

    // A clip sitting at its end starts again from the top. Anything else picks
    // up where it stopped, which is what makes it a resume and not a replay.
    if (audio.ended || (audio.duration > 0 && audio.currentTime >= audio.duration)) {
      audio.currentTime = 0;
    }

    const positionMs = audio.currentTime * 1000;
    activeIdRef.current = soundId;
    startedAtMsRef.current = positionMs;
    tracking.playStart(SOUND_GROUP, soundId, positionMs);
    setListenedIds((prev) => (prev.has(soundId) ? prev : new Set(prev).add(soundId)));

    setRuntime((prev) => {
      const current = prev[soundId] ?? emptyRuntime();
      return {
        ...prev,
        [soundId]: {
          ...current,
          isPlaying: true,
          progress: positionMs > 0 && audio.duration > 0 ? current.progress : 0,
          currentSec: audio.currentTime,
          durationSec: Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : current.durationSec,
        },
      };
    });

    // Rejected playback is playback that never happened — rolled back rather
    // than left in the log as a listen of zero length that still counts as
    // having started the clip.
    void audio.play().catch(() => {
      setArchiveAmbienceDucked(false);
      if (activeIdRef.current === soundId) finalizePlayback('paused');
    });
    setArchiveAmbienceDucked(true);
  }

  function stop(soundId: string) {
    if (activeIdRef.current !== soundId) return;
    finalizePlayback('paused');
  }

  function selectSound(soundId: string) {
    // Pressing the same choice again is not a change of mind, and recording it
    // as one would turn a visitor who confirmed their pick into one who
    // wavered.
    if (selectedSoundId === soundId) return;
    setSelectedSoundId(soundId);
    tracking.select(SOUND_GROUP, soundId);
  }

  /**
   * Opening a glass dome: bring it into the player strip and play what is
   * kept inside. Clicking the dome that is already sounding closes it. Playback
   * is toggle-only here — choosing the sound as the answer is a separate act,
   * made from the player, so listening back through the shelf never disturbs it.
   */
  function handleClocheClick(soundId: string) {
    setFocusedSoundId(soundId);
    if (getRuntime(soundId).isPlaying) {
      stop(soundId);
    } else {
      play(soundId);
    }
  }

  /* ── The memory field ───────────────────────────────────────────────────── */

  /**
   * Where a pointer is, as a place in the field rather than on the screen.
   *
   * Read from the element's own box every time, so the answer means the same
   * thing whatever size the field has been given — and still means it after
   * the window is resized mid-gesture.
   */
  function positionFromEvent(event: ReactPointerEvent<HTMLDivElement>): MemoryPosition {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0.5, y: 0.5 };
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
  }

  function handleFieldPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!selectedSoundId) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = positionFromEvent(event);
    draggingRef.current = true;
    // The gesture that brings the point into existence is a different act from
    // every one after it, and the record says which this was.
    tracking.positionStart(POSITION_GROUP, next, {
      gesture: position === null ? 'place' : 'drag',
      pointerType: event.pointerType,
    });
    setPosition(next);
  }

  function handleFieldPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const next = positionFromEvent(event);
    tracking.positionMove(POSITION_GROUP, next);
    setPosition(next);
  }

  function handleFieldPointerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    tracking.positionEnd(POSITION_GROUP, { reason: 'pointerUp' });
  }

  /**
   * Arrow keys move the point, and place it if there is none.
   *
   * Recorded as its own kind of gesture rather than as a very short drag: a
   * step is a step, and reading a row of them as a wavering hand would be
   * wrong. Placing at the centre is right here and only here — the visitor
   * asked for a point, which is not the same as finding one already sitting
   * there.
   */
  function handleFieldKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!selectedSoundId) return;
    const step = POSITION_THRESHOLDS.keyboardStep;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();

    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    const from = position ?? { x: 0.5, y: 0.5 };
    const next = position === null
      ? from
      : { x: clamp(from.x + move[0]), y: clamp(from.y + move[1]) };

    tracking.positionStart(POSITION_GROUP, position === null ? next : from, {
      gesture: position === null ? 'place' : 'nudge',
      pointerType: 'keyboard',
    });
    if (position !== null) tracking.positionMove(POSITION_GROUP, next);
    tracking.positionEnd(POSITION_GROUP, { reason: 'pointerUp' });
    setPosition(next);
  }

  // The sound list is on screen from the moment the Zone opens. The field is
  // not — it is a step of its own — so its group opens when that step does, and
  // everything measured from "the field appeared" is measured from a field the
  // visitor could actually see. Both are recorded once however often this runs.
  useEffect(() => {
    tracking.openGroup(SOUND_GROUP);
  }, [tracking]);

  useEffect(() => {
    if (phase === 'positioning') tracking.openGroup(POSITION_GROUP);
  }, [phase, tracking]);

  /*
    The moment the Zone's last control became usable — the NEXT on the
    positioning step, not the one that moved between steps. Leaving the sound
    list is not leaving the Zone, and the wait this anchors is the wait before
    finally moving on.
  */
  useEffect(() => {
    if (position) tracking.advanceReady();
  }, [position, tracking]);

  function goToPositioning() {
    if (!selectedSoundId) return;
    /*
      Playback is closed as `sceneExit` rather than `paused`, because that is
      what it is: the visitor moved on while a sound happened to be running,
      not a sound they turned off. The distinction matters — `paused` early in
      a clip is what EARLY_REJECTION reads, and pressing NEXT mid-listen would
      otherwise be recorded as having rejected the sound just chosen.
    */
    finalizePlayback('sceneExit');
    // The sound question is finished here, the same way LIGHT commits its
    // image question on leaving the grid.
    tracking.commit(SOUND_GROUP);
    setFocusedSoundId(selectedSoundId);
    setPhase('positioning');
  }

  useEffect(
    () => () => {
      finalizeRef.current('sceneExit');
      setArchiveAmbienceDucked(false);
      // A pointer still down on the field when the Zone is left would otherwise
      // leave the gesture open and its movement unrecorded.
      tracking.positionEnd(POSITION_GROUP, { reason: 'sceneExit' });
      tracking.save();
    },
    [tracking],
  );

  function handleConfirm() {
    if (!selectedSoundId || !position) return;
    // Before the commit, so a sound still playing when NEXT is pressed leaves
    // its last stretch of listening in the record rather than out of it.
    finalizePlayback('sceneExit');
    tracking.commit(POSITION_GROUP);

    /*
      The Final Report reads the older, per-sound shape, so it is still written
      — but derived from the event log at the last moment rather than counted up
      as the visitor went, so both readings of this Zone come from one source.
    */
    const summary = summarizeSound(tracking.snapshot());
    SOUND_CLUES.forEach((clue) => {
      const listenedMs = summary.listenTimeBySound[clue.id] ?? 0;
      const completions = summary.completionCountBySound[clue.id] ?? 0;
      const event: SoundPlayEvent = {
        soundId: clue.id,
        totalPlayedMs: Math.round(listenedMs),
        replayCount: summary.replayCountBySound[clue.id] ?? 0,
        completedFully: completions > 0,
        skipped: listenedMs < SOUND_THRESHOLDS.meaningfulListenMs && completions === 0,
      };
      recordSoundEvent(event);
    });

    setSoundSelection(selectedSoundId, position);
    tracking.save();
    logSceneTracking('soundClues', tracking, readSoundTracking);
    playClueRecordedSignature();
    completeScene('soundClues');
  }

  function getRuntime(id: string): SoundRuntime {
    return runtime[id] ?? emptyRuntime();
  }

  /**
   * One glass dome on the shelf.
   *
   * The specimen silhouette — handle, dome, base, the glow under it — is the
   * thing that has to read first. Everything else (the number, the glyph, the
   * waveform while it plays) sits quietly inside or below it.
   */
  function renderCloche(clue: (typeof SOUND_CLUES)[number], index: number) {
    const r = getRuntime(clue.id);
    const number = clue.label.replace(/[^0-9]/g, '') || String(index + 1).padStart(2, '0');
    const listened = listenedIds.has(clue.id);
    const state = [
      r.isPlaying ? 'sound-clues-scene__cloche--playing' : '',
      listened ? 'sound-clues-scene__cloche--listened' : '',
      selectedSoundId === clue.id ? 'sound-clues-scene__cloche--selected' : '',
      focusedSoundId === clue.id ? 'sound-clues-scene__cloche--focused' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        key={clue.id}
        type="button"
        className={`sound-clues-scene__cloche ${state}`}
        aria-pressed={r.isPlaying}
        aria-label={`${clue.label}${listened ? ', 청취함' : ''}${r.isPlaying ? ', 재생 중' : ''}`}
        onClick={() => handleClocheClick(clue.id)}
      >
        <span className="sound-clues-scene__cloche-stage">
          <span className="sound-clues-scene__cloche-handle" aria-hidden="true" />
          <span className="sound-clues-scene__cloche-dome">
            <span className="sound-clues-scene__cloche-glass" aria-hidden="true" />
            <span className="sound-clues-scene__cloche-fill" aria-hidden="true" />
            <span className="sound-clues-scene__cloche-glyph">
              <SpecimenGlyph index={index} />
            </span>
            <span className="sound-clues-scene__cloche-inner-label" aria-hidden="true">
              <span className="sound-clues-scene__cloche-inner-word">SOUND</span>
              <span className="sound-clues-scene__cloche-inner-num">{number}</span>
            </span>
            <span className="sound-clues-scene__cloche-wave" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
              ))}
            </span>
          </span>
          <span className="sound-clues-scene__cloche-base" aria-hidden="true" />
          <span className="sound-clues-scene__cloche-glow" aria-hidden="true" />
        </span>
        <span className="sound-clues-scene__cloche-caption">
          <span className="sound-clues-scene__cloche-caption-num">{number}</span>
          <span className="sound-clues-scene__cloche-caption-label">
            {clue.label}
            {listened ? (
              <span className="sound-clues-scene__cloche-heard" aria-hidden="true" />
            ) : null}
          </span>
        </span>
      </button>
    );
  }

  function renderPlayer(clue: (typeof SOUND_CLUES)[number] | null, runtimeForClue: SoundRuntime | null) {
    if (!clue || !runtimeForClue) {
      return (
        <div className="sound-clues-scene__player sound-clues-scene__player--empty">
          <span className="sound-clues-scene__player-empty">소리 단서를 선택해 주세요</span>
        </div>
      );
    }

    return (
      <div className={`sound-clues-scene__player${runtimeForClue.isPlaying ? ' sound-clues-scene__player--active' : ''}`}>
        <span className="sound-clues-scene__player-title">{clue.label}</span>
        <PlayerWaveform active={runtimeForClue.isPlaying} progress={runtimeForClue.progress} />
        <div className="sound-clues-scene__player-controls">
          <span className="sound-clues-scene__player-time">
            {formatClock(runtimeForClue.currentSec)} / {formatClock(runtimeForClue.durationSec)}
          </span>
          <div className="sound-clues-scene__player-actions">
            <button
              type="button"
              className="sound-clues-scene__mini-btn"
              onClick={() => handleClocheClick(clue.id)}
            >
              {runtimeForClue.isPlaying ? '일시정지' : runtimeForClue.heardToEnd ? '다시 듣기' : '재생'}
            </button>
            <button
              type="button"
              className="sound-clues-scene__mini-btn sound-clues-scene__mini-btn--mark"
              onClick={() => selectSound(clue.id)}
              disabled={selectedSoundId === clue.id}
            >
              {selectedSoundId === clue.id ? '표시됨' : '이 소리로 표시'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const focusedClue = SOUND_CLUES.find((clue) => clue.id === focusedSoundId) ?? null;
  const focusedRuntime = focusedSoundId ? getRuntime(focusedSoundId) : null;
  const selectedClue = SOUND_CLUES.find((clue) => clue.id === selectedSoundId) ?? null;

  if (phase === 'browse') {
    return (
      <div className="sound-clues-scene">
        <p className="sound-clues-scene__hint">그 사람의 기억에선 어떤 소리가 존재했을까요?</p>

        <div className="sound-clues-scene__shelf-scroll">
          <div className="sound-clues-scene__shelf">
            <div className="sound-clues-scene__shelf-row">
              {SOUND_CLUES.map((clue, index) => renderCloche(clue, index))}
            </div>
            <div className="sound-clues-scene__shelf-surface" aria-hidden="true" />
          </div>
        </div>

        {renderPlayer(focusedClue, focusedRuntime)}

        <p className="sound-clues-scene__progress">
          {listenedIds.size} / {SOUND_CLUES.length} 단서 청취
        </p>

        <button
          className="sound-clues-scene__confirm"
          onClick={goToPositioning}
          disabled={!selectedSoundId}
        >
          <TerminalCorners />
          다음으로
        </button>
      </div>
    );
  }

  return (
    <div className="sound-clues-scene">
      <p className="sound-clues-scene__hint">이 소리가 기억 속 어디쯤 남아 있는지 표시하세요.</p>

      {renderPlayer(selectedClue, selectedSoundId ? getRuntime(selectedSoundId) : null)}

      <div className="sound-clues-scene__field-block">
        <div className="sound-clues-scene__field-frame">
          <span className="sound-clues-scene__axis sound-clues-scene__axis--top">
            가까이 남아 있음
          </span>
          <span className="sound-clues-scene__axis sound-clues-scene__axis--left">흐릿함</span>
          <span className="sound-clues-scene__axis sound-clues-scene__axis--right">선명함</span>
          <span className="sound-clues-scene__axis sound-clues-scene__axis--bottom">
            멀리 남아 있음
          </span>

          <div
            ref={fieldRef}
            className={`sound-clues-scene__field${
              position ? ' sound-clues-scene__field--placed' : ''
            }`}
            /*
              A group rather than a slider: a slider has a value, and a value
              has a number, and a number is the one thing this must never put
              in front of anybody. The label says what the space means and
              leaves the reading of it where it belongs.
            */
            role="group"
            tabIndex={0}
            aria-label="이 소리가 기억 속 어디쯤 남아 있는지 표시하세요. 가로는 흐릿함에서 선명함, 세로는 가까이 남아 있음에서 멀리 남아 있음. 방향키로 표시를 옮길 수 있습니다."
            onPointerDown={handleFieldPointerDown}
            onPointerMove={handleFieldPointerMove}
            onPointerUp={handleFieldPointerUp}
            onPointerCancel={handleFieldPointerUp}
            onKeyDown={handleFieldKeyDown}
          >
            <span className="sound-clues-scene__field-hair sound-clues-scene__field-hair--v" />
            <span className="sound-clues-scene__field-hair sound-clues-scene__field-hair--h" />
            {position ? (
              <span
                className="sound-clues-scene__mark"
                style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
              >
                <span className="sound-clues-scene__mark-dot" />
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <button
        className="sound-clues-scene__confirm"
        onClick={handleConfirm}
        disabled={!position}
      >
        <TerminalCorners />
        다음으로
      </button>
    </div>
  );
}
