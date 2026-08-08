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
}

export interface MemorySketchData {
  strokes: Stroke[];
  emptyAreaRatio: number;
  lastInputAt: number;
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
