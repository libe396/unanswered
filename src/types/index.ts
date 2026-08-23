export type SceneId =
  | 'landing'
  | 'intro'
  | 'registration'
  | 'lightArchive'
  | 'recordLayerFirstVisit'
  | 'zone03Intro'
  | 'soundClues'
  | 'memorySketch'
  | 'sentenceClues'
  | 'recordLayerSecondVisit'
  | 'finalReport';

/** Traces from the pre-entry Landing scene. No completion condition —
 *  scrolling on is the only action, everything else is passive observation.
 *  `cursorTravelPx` is the give-away one: it measures how much someone moved
 *  trying to resolve a face that never resolves. */
export interface LandingData {
  enteredAt: number;
  timeToEnterMs: number;
  figureDwellMs: number;
  cursorTravelPx: number;
  bounced: boolean;
}

export interface Investigator {
  investigatorName: string;
  reportId: string;
  entryTime: number;
  registrationStatus: 'registered';
}

/** Shape returned by src/lib/imageAnalysis.js#analyzeImage, plus emotionKeywords merged in
 *  before being passed to src/lib/lightRenderer.js#renderLightGraphic. Untyped at the source
 *  (plain JS) — this interface documents the contract from the TS side only. */
export interface LightAnalysisRules {
  palette: string[];
  paletteWeights: number[];
  lightOrigin: { x: number; y: number };
  brightRegions: Array<{
    x: number;
    y: number;
    brightness: number;
    size: number;
    strength: number;
    color: string;
  }>;
  structureAnchors: Array<{ x: number; y: number; color: string; strength: number; type: string }>;
  averageBrightness: number;
  blurDensity: number;
  motionDirection: { angle: number; label: string };
  structure: {
    type: string;
    compositionType: string;
    dominantAxis: string;
    shapeEnergy: string;
    spatialWeight: string;
    balance: { x: number; y: number };
    concentration: number;
    distribution: number;
    geometricRhythm: number;
    diagonalDominance: number;
    horizontalDominance: number;
    radialDominance: number;
    repetition: number;
    verticalDominance: number;
  };
  emotionKeywords: string[];
}

export interface LightArchiveData {
  imageId: string;
  imagePath: string;
  rules: LightAnalysisRules;
  variation: number;
  selectDwellMs: number;
}

export interface RecordLayerFirstVisitData {
  enteredAt: number;
}

/* ── Behavioural tracking, raw layer ──────────────────────────────────────────
   What a visitor did on the way to an answer, as an append-only event log.

   Only the raw shape lives here, because only the raw shape is persisted. Every
   figure derived from it — dwell times, revisit counts, patterns — is computed
   on demand by src/lib/behaviorTracking.ts and src/lib/behaviorPatterns.ts and
   deliberately never stored, so that a change to what a revisit *means* applies
   to visits that have already been recorded rather than only to future ones. */

/** Whether a question holds one answer at a time or several. */
export type BehaviorSelectionMode = 'single' | 'multi';

/**
 * One recorded action.
 *
 * A look is written as a single completed `view` carrying its duration, rather
 * than as a start and an end. A pointer can leave the window and a scene can
 * unmount mid-hover, so a log built from pairs would routinely contain looks
 * that never finish; this way the log is only ever a list of things that
 * actually happened.
 */
export type BehaviorEvent =
  | { type: 'sceneEnter'; at: number }
  /**
   * The Zone's proceed control became usable for the first time.
   *
   * Scene-level rather than per-question, because a Zone has one NEXT and it
   * usually waits on more than one answer. Without this, "how long they sat on
   * a decision before moving on" is measured from the last selection, which
   * over-reports whenever a *different* question was the one still blocking.
   * Only Zones that emit it get the gated reading; the rest are unaffected.
   */
  | { type: 'advanceReady'; at: number }
  | { type: 'groupOpen'; at: number; group: string }
  | { type: 'view'; at: number; group: string; targetId: string; durationMs: number }
  | { type: 'select'; at: number; group: string; targetId: string }
  | { type: 'deselect'; at: number; group: string; targetId: string }
  | { type: 'commit'; at: number; group: string }
  /* ── Audio, for Zones whose clues are listened to rather than looked at ───
     SOUND's unit of attention is a stretch of playback, so the pair below
     replaces `view` there. A `play` is written when the sound *stops*, the
     same way and for the same reason a `view` is: playback can be interrupted
     by leaving the Zone, and a log built from starts and ends would routinely
     hold listens that never finish. `playStart` is still recorded, because
     when playback began — and whether it began from the top — is the
     difference between a re-listen and resuming after a pause. */
  | {
      type: 'playStart';
      at: number;
      group: string;
      targetId: string;
      /** Playhead when playback began, in ms. */
      positionMs: number;
      /** False when playback began at the top: a fresh listen, not a resume. */
      resumed: boolean;
    }
  | {
      type: 'play';
      at: number;
      group: string;
      targetId: string;
      /** Playhead when playback began, in ms. */
      fromMs: number;
      /** Playhead when it stopped, in ms. */
      toMs: number;
      /**
       * Audio actually heard in this stretch, measured from the playhead
       * rather than the clock. A stalled buffer, a backgrounded tab or a
       * device falling asleep all move the clock without moving the audio.
       */
      listenedMs: number;
      /** Full length of the clip, so a ratio needs nothing but this event. */
      durationMs: number;
      reason: PlayStopReason;
    }
  /* ── Drawing, for the Zone whose answer is a mark rather than a choice ────
     MEMORY has nothing to select. What it has is a blank rectangle and
     whatever the visitor decides to put on it, so the unit here is a stroke:
     written when the pointer lifts, carrying its own sampled path. Same shape
     of thing as a `view` or a `play` — one completed act, never a start
     waiting for an end that a scene change might take away.

     Nothing in these events is a reading of *what* was drawn. They hold
     positions, times and what was taken back; a drawing is not interpreted
     here or anywhere downstream. */
  | {
      type: 'stroke';
      /** When the pointer lifted. `startedAt` is when it went down. */
      at: number;
      group: string;
      strokeId: string;
      startedAt: number;
      tool: string;
      color: string;
      /** 'mouse' | 'pen' | 'touch' — whatever the pointer event reported. */
      pointerType: string;
      /** Sampled path. Always includes where the stroke began and ended. */
      points: TrackedStrokePoint[];
      /**
       * Pointer moves seen before sampling, so the sampler's own effect on the
       * record is visible. Device-dependent — a pen reports far more often
       * than a mouse — so it describes the hardware, never the person.
       */
      rawPointCount: number;
      /** True when the mark never reached the canvas — see `endReason`. */
      discarded: boolean;
      endReason: StrokeEndReason;
    }
  | {
      type: 'strokeRemove';
      at: number;
      group: string;
      /** Which marks went. A clear names all of them, one at a time. */
      strokeIds: string[];
      reason: StrokeRemoveReason;
    }
  | { type: 'toolChange'; at: number; group: string; tool: string; color: string }
  /* ── Positioning, for placing one point in a two-dimensional field ───────
     SOUND's second question used to be a row of feeling words. It is now a
     blank field with a meaning on each side, and the answer is a place in it.

     Written when the gesture ends, carrying its own sampled path — the same
     shape as `stroke` and for the same reasons. Where the point ended up is
     the answer, but how it got there is the recording: whether it was put
     down once, or moved, or moved and brought back. */
  | {
      type: 'position';
      /** When the gesture ended. `startedAt` is when it began. */
      at: number;
      group: string;
      startedAt: number;
      gesture: PositionGesture;
      /** Where the point was before this gesture. Null for the one that made it. */
      from: { x: number; y: number } | null;
      to: { x: number; y: number };
      /** Sampled path of the gesture. Always includes both ends. */
      path: TrackedPositionPoint[];
      /** Pointer moves seen before sampling. Describes the device, not the visitor. */
      rawPointCount: number;
      pointerType: string;
      endReason: StrokeEndReason;
    }
  /* ── Assembling, for the Zone whose answer is built rather than picked ────
     SENTENCE's answer is an ordered list that the visitor grows, cuts and
     rearranges. `select` cannot describe it — a selection has no position, and
     position is most of what is being decided here.

     These are operations, not states. No event carries the sentence as it
     stood, because storing the whole thing on every keystroke would be a pile
     of snapshots that disagree with each other the moment the meaning of an
     operation is revised; the order at any moment is replayed from the log
     instead, by summarizeSentence. That is the same rule the rest of this file
     follows, applied to a value that happens to be a list. */
  | { type: 'fragmentAdd'; at: number; group: string; fragmentId: string; index: number }
  | { type: 'fragmentRemove'; at: number; group: string; fragmentId: string; index: number }
  | {
      type: 'fragmentReorder';
      at: number;
      group: string;
      fragmentId: string;
      fromIndex: number;
      toIndex: number;
    };

/** One sampled position along a gesture. `t` is ms since the gesture began. */
export interface TrackedPositionPoint {
  x: number;
  y: number;
  t: number;
}

/**
 * How the point was moved.
 *
 * `place` is the gesture that brought it into existence, which is a different
 * act from every one after it — there is nothing to revise until something has
 * been put down. `nudge` is the keyboard, which arrives as a step rather than
 * a path and should never be read as a hesitant drag.
 */
export type PositionGesture = 'place' | 'drag' | 'nudge';

/**
 * A point in the memory field, normalized to it.
 *
 * x: 0 흐릿함 → 1 선명함.  y: 0 가까이 남아 있음 → 1 멀리 남아 있음.
 *
 * Normalized so the field can be any size on any screen and the answer still
 * means the same thing. The numbers are never shown to anyone standing in
 * front of it; they exist so the record can be read, not so the visitor can be
 * scored.
 */
export interface MemoryPosition {
  x: number;
  y: number;
}

/** One sampled position along a stroke. `t` is ms since the stroke began. */
export interface TrackedStrokePoint {
  x: number;
  y: number;
  t: number;
}

export type StrokeEndReason =
  /** The pointer lifted. The ordinary end of a mark. */
  | 'pointerUp'
  /** The Zone was left mid-stroke, so the mark never landed on the canvas. */
  | 'sceneExit'
  /** A new stroke began while this one was still open. */
  | 'interrupted';

/**
 * How a mark was taken back.
 *
 * Told apart because they answer different questions. An undo names the mark
 * it removed, so the space it occupied is known and a return to that space can
 * be recognised. A clear removes the whole canvas, so "came back to where it
 * was" has no meaning — everywhere was where it was.
 */
export type StrokeRemoveReason = 'undo' | 'erase' | 'clear';

/**
 * Why a stretch of playback ended.
 *
 * `ended` is the only one that means the clip was heard to the end; the others
 * each describe a different way of leaving it, and telling them apart is what
 * keeps abandoning a sound distinct from being taken away from it.
 */
export type PlayStopReason =
  /** Reached the end of the clip on its own. */
  | 'ended'
  /** The visitor stopped it. */
  | 'paused'
  /** Another sound was started, which stops this one. */
  | 'switched'
  /** The Zone was left, or answers were confirmed, while it was still playing. */
  | 'sceneExit';

export interface SceneBehaviorRecord {
  sceneId: SceneId;
  sceneEnteredAt: number;
  /** The questions this Zone asked, and how each one behaves. */
  groupModes: Record<string, BehaviorSelectionMode>;
  events: BehaviorEvent[];
}

export interface SoundPlayEvent {
  soundId: string;
  totalPlayedMs: number;
  replayCount: number;
  completedFully: boolean;
  skipped: boolean;
}

export interface SoundCluesData {
  events: SoundPlayEvent[];
  selectedSoundId: string | null;
  /**
   * Where the chosen sound was placed in the memory field.
   *
   * Null until the visitor puts the point down, and on any visit recorded
   * before the field replaced the feeling words.
   */
  memoryPosition: MemoryPosition | null;
  /**
   * The feeling word this Zone used to ask for. Always null now.
   *
   * Kept because the Final Report still reads it, as the second of three
   * fallbacks behind LIGHT's own keywords — which are required to leave LIGHT,
   * so the fallback was never what answered. Removing the field would mean
   * editing the report to drop a branch that never ran, and the report is not
   * in scope. Visits recorded before the change still carry their word.
   */
  selectedKeyword: string | null;
}

export interface StrokePoint {
  x: number;
  y: number;
}

export interface Stroke {
  points: StrokePoint[];
  color: string;
  width: number;
  /**
   * Names this mark in the behavioural record.
   *
   * Optional because a sketch stored before tracking existed has none, and
   * because nothing about drawing or redrawing the canvas reads it — it exists
   * so that "the mark that was undone" and "the mark drawn afterwards" can be
   * talked about as the same kind of thing.
   */
  id?: string;
}

/**
 * MEMORY's response, v2.
 *
 * `strokes`, `emptyAreaRatio` and `lastInputAt` are unchanged from v1 and
 * read the same way by src/utils/report.ts and RecordLayerSecondVisitScene —
 * Free Drawing is now optional rather than the whole Zone, but what it
 * produces is recorded exactly as it always was. Everything below is new in
 * v2 and additive; a visit recorded before the Room existed rehydrates with
 * these backfilled by experienceStore's onRehydrateStorage, the same way an
 * old SoundCluesData backfills `memoryPosition`.
 */
export interface MemorySketchData {
  strokes: Stroke[];
  emptyAreaRatio: number;
  lastInputAt: number;
  /** The Room background this visit used. Always 'default' for now — see the
   *  note on room variation in src/lib/memoryTracking.ts. */
  roomVariant: string;
  /** Objects in the Room this visitor recognised as a trace. */
  selectedObjects: string[];
  /** Whether the optional Free Drawing step left a surviving mark. */
  drawingUsed: boolean;
  /** Brush colors actually present in `strokes`, in the order first used. */
  selectedColors: string[];
}

export interface SentenceCluesData {
  selectedSentenceIds: string[];
  selectedSentences: string[];
  customSentence: string;
  dwellTimes: Record<string, number>;
  selectionOrder: string[];
  repeatedKeywords: string[];
}

export interface FinalReportMeta {
  generatedAt: number;
}

export interface RecordLayerDerived {
  investigator: Investigator | null;
  light: LightArchiveData | null;
  soundClues: SoundCluesData;
  memorySketch: MemorySketchData;
  sentenceClues: SentenceCluesData;
  completedCount: number;
  totalCount: number;
}

export interface ReportData {
  reportId: string;
  investigatorName: string;
  entryTime: number;
  imageId: string;
  imagePath: string;
  palette: string[];
  emotionKeywords: string[];
  selectedSoundLabel: string;
  soundPattern: string;
  memorySketchSummary: string;
  selectedSentences: string[];
  customSentence: string;
  repeatedKeywords: string[];
  dwellSummary: string;
  observationText: string;
  targetIdentity: string;
}
