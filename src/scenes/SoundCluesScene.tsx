import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { SOUND_CLUES } from '../data/content';
import { StageActions, StageHeader } from '../components/StageHeader';
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

// Five reference glyphs traced from zone3_1.png; subway/car share their stroke and scale.
// Keys follow audio identity, never shelf position.
const SPECIMEN_GLYPHS = {
  subway: 'M7 7Q7 3 18 3Q29 3 29 7V26Q29 30 25 30H11Q7 30 7 26Z M11 9H25V19H11Z M18 9V19 M14 6H22 M11 24a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0 M22 24a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0 M12 30L8 35 M24 30L28 35 M10 33H26',
  car: 'M5 18L9 8Q10 6 13 6H23Q26 6 27 8L31 18 M5 18Q3 19 3 22V29H33V22Q33 19 31 18Z M10 10H26L29 17H7Z M3 20L1 17 M33 20L35 17 M7 29V33H11V29 M25 29V33H29V29 M7 23H12 M24 23H29 M15 26H21',

  rain: 'M7 21C2 21 2 13 7 13C7 8 12 6 15 10C19 3 25 7 25 12C32 12 33 21 27 21Z M8 25v2 M14 24v3 M20 25v2 M26 24v3 M11 30v1 M23 30v1',
  paper: 'M4 24L18 4L29 12L15 31Z M8 23L19 8L25 13L14 27Z M7 28L18 33L30 17 M9 32L30 35L30 22 M12 22L20 12 M15 23L22 14',
  pencil: 'M3 33L7 24L27 4L32 9L12 29Z M7 24L12 29 M24 7L29 12 M9 26L27 8 M3 33L9 31',
  elevator: 'M3 5H33V35H3Z M6 8H17V32H6Z M20 8H30V32H20Z M18 2V5 M11 15V23 M8 20L11 23L14 20 M25 15V23 M22 20L25 23L28 20',
  people: 'M8 9a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7 M18 9a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7 M28 9a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7 M3 23V16Q3 12 8 12Q13 12 13 16V23 M5 17V34H8V25 M8 34H11V17 M14 23V16Q14 12 18 12Q22 12 22 16V23 M16 17V34H18V25 M18 34H20V17 M23 23V16Q23 12 28 12Q33 12 33 16V23 M25 17V34H28V25 M28 34H31V17',
};

const WAVEFORM_BARS = [
  0.18, 0.34, 0.24, 0.52, 0.38, 0.68, 0.3, 0.46, 0.22, 0.62, 0.36, 0.78,
  0.42, 0.58, 0.28, 0.7, 0.32, 0.5, 0.2, 0.44, 0.66, 0.36, 0.82, 0.48,
  0.26, 0.54, 0.72, 0.4, 0.24, 0.6, 0.34, 0.5,
];

function SpecimenGlyph({ clue }: { clue: (typeof SOUND_CLUES)[number] }) {
  return <svg viewBox="0 0 36 38" aria-hidden="true" focusable="false"><path d={SPECIMEN_GLYPHS[clue.icon]} fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" /></svg>;
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
  const storedSoundClues = useExperienceStore((s) => s.soundClues);
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
  // Seeded from an answer this visit already saved (e.g. Back navigation and
  // forward again) so a re-confirm without changes re-saves the same choice
  // rather than forcing it to be redone from nothing. A first-ever visit has
  // no prior selection, so this is null exactly as before.
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(
    () => storedSoundClues.selectedSoundId,
  );
  // Every dome that has been played at least once — drives the "N / 7 들어 본 소리"
  // readout and the small "heard" mark on a dome. Presentation only; kept
  // separate from selection, which is still a single deliberate choice.
  // Seeded from any dome this visit already recorded a listen for.
  const [listenedIds, setListenedIds] = useState<Set<string>>(
    () => new Set(storedSoundClues.events.filter((e) => e.totalPlayedMs > 0).map((e) => e.soundId)),
  );
  // The dome the player strip is currently describing: the last one the
  // visitor opened. Not the same as the selected one — you can listen back
  // through the shelf without changing your answer.
  const [focusedSoundId, setFocusedSoundId] = useState<string | null>(null);
  // Null until the visitor puts the point down. Deliberately not seeded at the
  // centre: an empty field asks a question, and a point already sitting in the
  // middle answers it before they arrive. A field that already holds a real
  // prior answer (Back navigation, forward again) is a different case —
  // restoring it, not pre-answering for a first-time visitor.
  const [position, setPosition] = useState<MemoryPosition | null>(() => storedSoundClues.memoryPosition);

  const [echo, setEcho] = useState<(MemoryPosition & { key: number }) | null>(null);
  const echoSequence = useRef(0);
  function pulse(point: MemoryPosition) { setEcho({ ...point, key: ++echoSequence.current }); }

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
    pulse(next);
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
    if ((event.key === 'Enter' || event.key === ' ') && position) { event.preventDefault(); pulse(position); return; }
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
    pulse(next);
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
  function renderCloche(clue: (typeof SOUND_CLUES)[number]) {
    const r = getRuntime(clue.id);
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
        aria-label={`${clue.label}${listened ? ', 청취함' : ''}${r.isPlaying ? ', 현재 재생 중' : ''}${selectedSoundId === clue.id ? ', 최종 선택됨' : ''}`}
        onClick={() => handleClocheClick(clue.id)}
      >
        <span className="sound-clues-scene__cloche-stage">
          <span className="sound-clues-scene__cloche-handle" aria-hidden="true" />
          <span className="sound-clues-scene__cloche-dome">
            <span className="sound-clues-scene__cloche-glass" aria-hidden="true" />
            <span className="sound-clues-scene__cloche-fill" aria-hidden="true" />
            <span className="sound-clues-scene__cloche-glyph">
              <SpecimenGlyph clue={clue} />
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
          <span className="sound-clues-scene__cloche-caption-label">
            {clue.label}
            {selectedSoundId === clue.id && <span className="sound-clues-scene__selection-check" aria-hidden="true">✓</span>}
            {listened ? (
              <span className="sound-clues-scene__cloche-heard" aria-hidden="true" />
            ) : null}
          </span>
          <span className="sound-clues-scene__cloche-status">{r.isPlaying ? '재생 중' : '\u00a0'}</span>
        </span>
      </button>
    );
  }

  function renderPlayer(clue: (typeof SOUND_CLUES)[number] | null, runtimeForClue: SoundRuntime | null) {
    if (!clue || !runtimeForClue) {
      return (
        /* Empty, not captioned: what to do is said once, in the header. */
        <div className="sound-clues-scene__player sound-clues-scene__player--empty" />
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
              className="cta cta--secondary sound-clues-scene__mini-btn"
              onClick={() => handleClocheClick(clue.id)}
            >
              {runtimeForClue.isPlaying ? '일시정지' : runtimeForClue.heardToEnd ? '다시 듣기' : '재생'}
            </button>
            <button
              type="button"
              className={`cta cta--secondary sound-clues-scene__mini-btn${
                selectedSoundId === clue.id ? ' sound-clues-scene__mini-btn--marked' : ''
              }`}
              onClick={() => selectSound(clue.id)}
              disabled={selectedSoundId === clue.id}
            >
              {selectedSoundId === clue.id ? '선택한 소리 ✓' : '이 소리 선택'}
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
        {/*
          Not the two-column stage: the shelf runs the full width of the
          container and is itself the object, so the heading sits above it and
          the action row below it, both on the same 960 measure and the same
          left edge.
        */}
        <StageHeader
          eyebrow="소리의 흔적"
          title="그 사람 곁에는 어떤 소리가 있었을까요?"
          description="유리 돔을 눌러 들어 보고, 하나를 골라 주세요."
        />

        <div className="sound-clues-scene__shelf-scroll">
          <span className="residue sound-clues-scene__residue" aria-hidden="true" />
          <div className="sound-clues-scene__shelf">
            <div className="sound-clues-scene__shelf-row">
              {SOUND_CLUES.map((clue) => renderCloche(clue))}
            </div>
            <div className="sound-clues-scene__shelf-surface" aria-hidden="true" />
          </div>
        </div>

        {renderPlayer(focusedClue, focusedRuntime)}

        <StageActions
          info={
            <p className="metric sound-clues-scene__progress">
              <span className="metric__value">
                {listenedIds.size} / {SOUND_CLUES.length}
              </span>
              <span className="metric__label">들어 본 소리</span>
            </p>
          }
        >
          <button
            className="cta cta--primary"
            onClick={goToPositioning}
            disabled={!selectedSoundId}
          >
            다음으로
          </button>
        </StageActions>
      </div>
    );
  }

  return (
    <div className="sound-clues-scene sound-clues-scene--positioning">
      <StageHeader
        eyebrow="소리의 흔적"
        title="이 소리는 어떻게 기억될까요?"
        description="그 사람에게 가깝고 또렷했을지, 점으로 남겨 주세요."
      />

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
            aria-label="이 소리는 어떻게 기억될까요? 가로는 흐릿함에서 선명함, 세로는 가까이 남아 있음에서 멀리 남아 있음. 방향키로 표시를 옮길 수 있습니다."
            onPointerDown={handleFieldPointerDown}
            onPointerMove={handleFieldPointerMove}
            onPointerUp={handleFieldPointerUp}
            onPointerCancel={handleFieldPointerUp}
            onKeyDown={handleFieldKeyDown}
          >
            <span className="sound-clues-scene__field-hair sound-clues-scene__field-hair--v" />
            <span className="sound-clues-scene__field-hair sound-clues-scene__field-hair--h" />
            {echo && <span key={echo.key} className="sound-clues-scene__echo" style={{ left: `${echo.x * 100}%`, top: `${echo.y * 100}%` }} aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} style={{ animationDelay: `${i * 160}ms` }} />)}</span>}
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

      <StageActions
        info={
          <p className="metric sound-clues-scene__progress">
            <span className="metric__label">
              {position ? '표시한 위치로 기록됩니다.' : '패드를 눌러 위치를 표시하세요.'}
            </span>
          </p>
        }
      >
        <button className="cta cta--primary" onClick={handleConfirm} disabled={!position}>
          다음으로
        </button>
      </StageActions>
    </div>
  );
}
