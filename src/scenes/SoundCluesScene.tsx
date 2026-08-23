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
}

function emptyRuntime(): SoundRuntime {
  return { isPlaying: false, progress: 0, heardToEnd: false };
}

/** Which of the Zone's two questions is in front of the visitor. */
type Phase = 'browse' | 'positioning';

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

    audio.addEventListener('timeupdate', () => {
      if (activeIdRef.current !== soundId) return;
      const duration = audio.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      const progress = Math.min(1, audio.currentTime / duration);
      setRuntime((prev) => ({ ...prev, [soundId]: { ...(prev[soundId] ?? emptyRuntime()), progress } }));
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
          isPlaying: false,
          progress: reason === 'ended' ? 1 : current.progress,
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

    setRuntime((prev) => {
      const current = prev[soundId] ?? emptyRuntime();
      return {
        ...prev,
        [soundId]: {
          ...current,
          isPlaying: true,
          progress: positionMs > 0 && audio.duration > 0 ? current.progress : 0,
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
   * One sound, drawn the same way on both steps.
   *
   * Shared rather than written twice so the row on the positioning step cannot
   * drift from the ones in the list — it is meant to be recognisably the same
   * object, carried forward. `selectable` is the only difference: on the second
   * step there is nothing left to choose, only something left to hear again.
   */
  function renderSoundRow(clue: (typeof SOUND_CLUES)[number], selectable: boolean) {
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
        </div>
        <div className="sound-clues-scene__item-track">
          <div
            className="sound-clues-scene__item-track-fill"
            style={{ width: `${r.progress * 100}%` }}
          />
        </div>
        <div className="sound-clues-scene__item-actions">
          <button
            className="sound-clues-scene__mini-btn"
            onClick={() => (r.isPlaying ? stop(clue.id) : play(clue.id))}
          >
            {r.isPlaying ? '멈춤' : r.heardToEnd ? '다시 듣기' : '재생'}
          </button>
          {selectable ? (
            <button className="sound-clues-scene__mini-btn" onClick={() => selectSound(clue.id)}>
              이 소리 선택
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const selectedClue = SOUND_CLUES.find((clue) => clue.id === selectedSoundId) ?? null;

  if (phase === 'browse') {
    return (
      <div className="sound-clues-scene">
        <p className="sound-clues-scene__hint">그 사람의 기억에선 어떤 소리가 존재했을까요?</p>

        <div className="sound-clues-scene__list">
          {SOUND_CLUES.map((clue) => renderSoundRow(clue, true))}
        </div>

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

      {selectedClue ? (
        <div className="sound-clues-scene__list sound-clues-scene__list--single">
          {renderSoundRow(selectedClue, false)}
        </div>
      ) : null}

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
