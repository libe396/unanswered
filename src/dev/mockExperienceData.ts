/**
 * Dev-only test fixture for the Final Report.
 *
 * Every value here is shaped exactly like the real answer data
 * `RecordLayerDerived` reads (`Investigator`, `LightArchiveData`,
 * `SoundCluesData`, `MemorySketchData`, `SentenceCluesData`) and the real
 * behavioural log `SceneBehaviorRecord` — no new field, no shortcut shape.
 * `DevSceneNavigator.tsx` writes this straight into `useExperienceStore` the
 * same way a real visit's Zones do (`setLightArchive`, `setSoundSelection`,
 * …), so the Final Report never has to know whether what it is reading came
 * from an actual visit or from here: both paths end at the same
 * `buildFinalReportPresentation()`.
 *
 * Content ids (`SOUND_03`, `RECON_A_HESITATED`, `lamp`, …) are the real ones
 * from src/data/content.ts, not invented strings — a lookup like
 * src/utils/report.ts's `buildDwellSummary` (which finds a sentence fragment
 * by id) resolves against this data exactly as it would against a real
 * visit's.
 *
 * Imported only by src/components/DevSceneNavigator.tsx, itself rendered
 * only under `import.meta.env.DEV` — never reachable from the shipped
 * exhibition build's user flow.
 */
import type {
  Investigator,
  LightAnalysisRules,
  LightArchiveData,
  MemorySketchData,
  SceneBehaviorRecord,
  SceneId,
  SentenceCluesData,
  SoundCluesData,
} from '../types';
import { generateReportId } from '../utils/id';

const ARCHIVE_IMAGE_MODULES = import.meta.glob('../assets/archive/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function pickMockArchiveImage(): { id: string; path: string } {
  const entries = Object.entries(ARCHIVE_IMAGE_MODULES).sort(([a], [b]) => a.localeCompare(b));
  const [path, url] = entries[Math.min(4, entries.length - 1)] ?? entries[0] ?? [null, null];
  if (!path || !url) return { id: 'IMAGE_00', path: '' };
  const slotMatch = path.match(/(\d+)\.[^.]+$/);
  const slot = slotMatch ? slotMatch[1].padStart(2, '0') : '00';
  return { id: `IMAGE_${slot}`, path: url };
}

const MOCK_IMAGE = pickMockArchiveImage();

/** A plausible, internally-consistent `LightAnalysisRules` — the same shape
 *  src/lib/imageAnalysis.js#analyzeImage produces, hand-built here instead
 *  of run through the real (async, canvas-dependent) analyzer. */
const MOCK_LIGHT_RULES: LightAnalysisRules = {
  palette: ['#5c7179', '#71888e', '#9eb4a6', '#b3d3c8', '#c8ecec'],
  paletteWeights: [0.12, 0.34, 0.2, 0.14, 0.2],
  lightOrigin: { x: 0.42, y: 0.38 },
  brightRegions: [{ x: 0.42, y: 0.38, brightness: 0.8, size: 0.3, strength: 0.7, color: '#c8ecec' }],
  structureAnchors: [{ x: 0.5, y: 0.5, color: '#9eb4a6', strength: 0.4, type: 'center' }],
  averageBrightness: 0.4,
  blurDensity: 0.3,
  motionDirection: { angle: 20, label: 'diagonal' },
  structure: {
    type: 'diffuse',
    compositionType: 'abstract / unclear',
    dominantAxis: 'diagonal',
    shapeEnergy: 'low',
    spatialWeight: 'center',
    balance: { x: 0.5, y: 0.5 },
    concentration: 0.3,
    distribution: 0.5,
    geometricRhythm: 0.2,
    diagonalDominance: 0.4,
    horizontalDominance: 0.3,
    radialDominance: 0.2,
    repetition: 0.1,
    verticalDominance: 0.3,
  },
  emotionKeywords: ['고요함', '아련함'],
};

export const MOCK_INVESTIGATOR: Investigator = {
  investigatorName: '테스트 조사자',
  reportId: generateReportId(),
  entryTime: Date.now() - 40 * 60_000,
  registrationStatus: 'registered',
};

export const MOCK_LIGHT_ARCHIVE: LightArchiveData = {
  imageId: MOCK_IMAGE.id,
  imagePath: MOCK_IMAGE.path,
  rules: MOCK_LIGHT_RULES,
  variation: 3,
  selectDwellMs: 4200,
};

export const MOCK_SOUND_CLUES: SoundCluesData = {
  events: [
    { soundId: 'SOUND_01', totalPlayedMs: 4300, replayCount: 0, completedFully: false, skipped: false },
    { soundId: 'SOUND_03', totalPlayedMs: 18400, replayCount: 1, completedFully: true, skipped: false },
  ],
  selectedSoundId: 'SOUND_03',
  memoryPosition: { x: 0.32, y: 0.58 },
  selectedKeyword: null,
};

export const MOCK_MEMORY_SKETCH: MemorySketchData = {
  strokes: [
    {
      id: 'stroke-1',
      color: '#9fb2f2',
      width: 3,
      points: [
        { x: 0.2, y: 0.3 },
        { x: 0.4, y: 0.5 },
        { x: 0.6, y: 0.3 },
      ],
    },
    {
      id: 'stroke-2',
      color: '#baa8ec',
      width: 2,
      points: [
        { x: 0.5, y: 0.6 },
        { x: 0.7, y: 0.7 },
      ],
    },
  ],
  emptyAreaRatio: 0.82,
  lastInputAt: Date.now() - 24 * 60_000,
  roomVariant: 'default',
  selectedObjects: ['lamp', 'window'],
  drawingUsed: true,
  selectedColors: ['#9fb2f2', '#baa8ec'],
};

export const MOCK_SENTENCE_CLUES: SentenceCluesData = {
  selectedSentenceIds: ['RECON_A_HESITATED', 'RECON_C_UNSPOKEN'],
  selectedSentences: [
    '떠나려 했지만, 한동안 방을 벗어나지 못했을 가능성이 있다.',
    '그 사람이 끝내 전하지 못한 말이 있었던 것으로 보인다.',
  ],
  // Real shape, not a distinct line: SentenceCluesScene.handleComplete()
  // always writes `selectedSentences.join(' ')` here — see
  // SentenceCluesData's own doc. `responseText` below is the field that
  // actually carries a separate, freely-typed answer.
  customSentence: '떠나려 했지만, 한동안 방을 벗어나지 못했을 가능성이 있다. 그 사람이 끝내 전하지 못한 말이 있었던 것으로 보인다.',
  dwellTimes: { RECON_A_HESITATED: 4200, RECON_C_UNSPOKEN: 9100 },
  selectionOrder: ['RECON_A_HESITATED', 'RECON_C_UNSPOKEN'],
  repeatedKeywords: ['기억'],
  questionTargetFragmentId: 'RECON_C_UNSPOKEN',
  questionOpenSlot: 'message',
  generatedQuestion: '그 사람이 전하지 못한 말은 무엇이었을까요?',
  questionSource: 'fallback',
  responseText: '아마 미안하다는 말이었을 것이다.',
  responseSkipped: false,
  noQuestionAvailable: false,
  responseEditCount: 0,
  responseDeleteCount: 0,
  behavioralTrace: null,
  sceneDurationMs: 42_000,
};

/** One zone's behavioural log — real event shapes and real group names
 *  (`SOUND_TRACKING_GROUPS` etc.'s own keys), timestamped as a plausible,
 *  strictly increasing sequence rather than all at once. */
function buildMockBehavior(): Partial<Record<SceneId, SceneBehaviorRecord>> {
  const lightBase = Date.now() - 40 * 60_000;
  const soundBase = Date.now() - 32 * 60_000;
  const memoryBase = Date.now() - 24 * 60_000;
  const sentenceBase = Date.now() - 16 * 60_000;

  const lightArchive: SceneBehaviorRecord = {
    sceneId: 'lightArchive',
    sceneEnteredAt: lightBase,
    groupModes: { image: 'single', emotion: 'multi' },
    events: [
      { type: 'sceneEnter', at: lightBase },
      { type: 'groupOpen', at: lightBase + 200, group: 'image' },
      { type: 'view', at: lightBase + 800, group: 'image', targetId: 'IMAGE_02', durationMs: 1200 },
      { type: 'view', at: lightBase + 2200, group: 'image', targetId: MOCK_IMAGE.id, durationMs: 4200 },
      { type: 'select', at: lightBase + 6500, group: 'image', targetId: MOCK_IMAGE.id },
      { type: 'commit', at: lightBase + 6800, group: 'image' },
      { type: 'groupOpen', at: lightBase + 6900, group: 'emotion' },
      { type: 'select', at: lightBase + 7400, group: 'emotion', targetId: '고요함' },
      { type: 'select', at: lightBase + 8100, group: 'emotion', targetId: '아련함' },
      { type: 'commit', at: lightBase + 8600, group: 'emotion' },
      { type: 'advanceReady', at: lightBase + 8700 },
    ],
  };

  const soundClues: SceneBehaviorRecord = {
    sceneId: 'soundClues',
    sceneEnteredAt: soundBase,
    groupModes: { sound: 'single', position: 'single' },
    events: [
      { type: 'sceneEnter', at: soundBase },
      { type: 'groupOpen', at: soundBase + 200, group: 'sound' },
      { type: 'playStart', at: soundBase + 900, group: 'sound', targetId: 'SOUND_01', positionMs: 0, resumed: false },
      {
        type: 'play',
        at: soundBase + 5200,
        group: 'sound',
        targetId: 'SOUND_01',
        fromMs: 0,
        toMs: 4300,
        listenedMs: 4300,
        durationMs: 12_000,
        reason: 'switched',
      },
      { type: 'playStart', at: soundBase + 5300, group: 'sound', targetId: 'SOUND_03', positionMs: 0, resumed: false },
      {
        type: 'play',
        at: soundBase + 23_700,
        group: 'sound',
        targetId: 'SOUND_03',
        fromMs: 0,
        toMs: 18_400,
        listenedMs: 18_400,
        durationMs: 18_400,
        reason: 'ended',
      },
      { type: 'select', at: soundBase + 23_900, group: 'sound', targetId: 'SOUND_03' },
      { type: 'commit', at: soundBase + 24_200, group: 'sound' },
      { type: 'groupOpen', at: soundBase + 24_300, group: 'position' },
      {
        type: 'position',
        at: soundBase + 27_000,
        group: 'position',
        startedAt: soundBase + 25_000,
        gesture: 'place',
        from: null,
        to: { x: 0.32, y: 0.58 },
        path: [{ x: 0.32, y: 0.58, t: 0 }],
        rawPointCount: 1,
        pointerType: 'mouse',
        endReason: 'pointerUp',
      },
      { type: 'advanceReady', at: soundBase + 27_100 },
      { type: 'commit', at: soundBase + 27_300, group: 'position' },
    ],
  };

  const memorySketch: SceneBehaviorRecord = {
    sceneId: 'memorySketch',
    sceneEnteredAt: memoryBase,
    groupModes: { object: 'multi', sketch: 'single' },
    events: [
      { type: 'sceneEnter', at: memoryBase },
      { type: 'groupOpen', at: memoryBase + 200, group: 'object' },
      { type: 'view', at: memoryBase + 900, group: 'object', targetId: 'lamp', durationMs: 1800 },
      { type: 'select', at: memoryBase + 2800, group: 'object', targetId: 'lamp' },
      { type: 'view', at: memoryBase + 3200, group: 'object', targetId: 'window', durationMs: 2100 },
      { type: 'select', at: memoryBase + 5400, group: 'object', targetId: 'window' },
      { type: 'commit', at: memoryBase + 5700, group: 'object' },
      { type: 'groupOpen', at: memoryBase + 5800, group: 'sketch' },
      { type: 'advanceReady', at: memoryBase + 5900 },
      {
        type: 'stroke',
        at: memoryBase + 9200,
        group: 'sketch',
        strokeId: 'stroke-1',
        startedAt: memoryBase + 8100,
        tool: 'pen',
        color: '#9fb2f2',
        pointerType: 'mouse',
        points: [
          { x: 0.2, y: 0.3, t: 0 },
          { x: 0.4, y: 0.5, t: 600 },
          { x: 0.6, y: 0.3, t: 1100 },
        ],
        rawPointCount: 24,
        discarded: false,
        endReason: 'pointerUp',
      },
      {
        type: 'stroke',
        at: memoryBase + 12_400,
        group: 'sketch',
        strokeId: 'stroke-2',
        startedAt: memoryBase + 11_600,
        tool: 'pen',
        color: '#baa8ec',
        pointerType: 'mouse',
        points: [
          { x: 0.5, y: 0.6, t: 0 },
          { x: 0.7, y: 0.7, t: 800 },
        ],
        rawPointCount: 16,
        discarded: false,
        endReason: 'pointerUp',
      },
      { type: 'commit', at: memoryBase + 12_700, group: 'sketch' },
    ],
  };

  const sentenceClues: SceneBehaviorRecord = {
    sceneId: 'sentenceClues',
    sceneEnteredAt: sentenceBase,
    groupModes: { sentence: 'multi' },
    events: [
      { type: 'sceneEnter', at: sentenceBase },
      { type: 'groupOpen', at: sentenceBase + 200, group: 'sentence' },
      { type: 'view', at: sentenceBase + 700, group: 'sentence', targetId: 'RECON_A_HESITATED', durationMs: 4200 },
      { type: 'fragmentAdd', at: sentenceBase + 5000, group: 'sentence', fragmentId: 'RECON_A_HESITATED', index: 0 },
      { type: 'view', at: sentenceBase + 6200, group: 'sentence', targetId: 'RECON_C_UNSPOKEN', durationMs: 9100 },
      { type: 'fragmentAdd', at: sentenceBase + 15_400, group: 'sentence', fragmentId: 'RECON_C_UNSPOKEN', index: 1 },
      { type: 'commit', at: sentenceBase + 15_700, group: 'sentence' },
    ],
  };

  return { lightArchive, soundClues, memorySketch, sentenceClues };
}

export const MOCK_BEHAVIOR: Partial<Record<SceneId, SceneBehaviorRecord>> = buildMockBehavior();

/** Every field `injectMockFinalReportData` (src/components/DevSceneNavigator.tsx)
 *  writes into the store — grouped here so that call site is a single spread
 *  rather than a hand-kept field list that could drift from this file. */
export const MOCK_EXPERIENCE_PATCH = {
  investigator: MOCK_INVESTIGATOR,
  lightArchive: MOCK_LIGHT_ARCHIVE,
  soundClues: MOCK_SOUND_CLUES,
  memorySketch: MOCK_MEMORY_SKETCH,
  sentenceClues: MOCK_SENTENCE_CLUES,
  behavior: MOCK_BEHAVIOR,
} satisfies {
  investigator: Investigator;
  lightArchive: LightArchiveData;
  soundClues: SoundCluesData;
  memorySketch: MemorySketchData;
  sentenceClues: SentenceCluesData;
  behavior: Partial<Record<SceneId, SceneBehaviorRecord>>;
};
