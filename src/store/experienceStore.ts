import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Investigator,
  LandingData,
  LightArchiveData,
  MemoryPosition,
  MemorySketchData,
  RecordLayerDerived,
  RecordLayerFirstVisitData,
  SceneBehaviorRecord,
  SceneId,
  SentenceCluesData,
  SoundCluesData,
  SoundPlayEvent,
} from '../types';
import { generateReportId } from '../utils/id';

export const SCENE_ORDER: SceneId[] = [
  'landing',
  'intro',
  'registration',
  'lightArchive',
  'recordLayerFirstVisit',
  'zone03Intro',
  'soundClues',
  'memorySketch',
  'sentenceClues',
  'recordLayerSecondVisit',
  'finalReport',
];

function getFurthestAllowedScene(completedScenes: SceneId[]): SceneId {
  for (const id of SCENE_ORDER) {
    if (!completedScenes.includes(id)) return id;
  }
  return SCENE_ORDER[SCENE_ORDER.length - 1];
}

interface ExperienceState {
  currentScene: SceneId;
  completedScenes: SceneId[];
  landing: LandingData;
  investigator: Investigator | null;
  lightArchive: LightArchiveData | null;
  recordLayerFirstVisit: RecordLayerFirstVisitData | null;
  soundClues: SoundCluesData;
  memorySketch: MemorySketchData;
  sentenceClues: SentenceCluesData;
  finalReport: { generatedAt: number } | null;
  /*
    Behavioural records, one per Zone that has been instrumented.

    Keyed by scene and kept beside the answers rather than inside them, so a
    Zone's answer shape stays exactly what it was and adding tracking to the
    next Zone is a new key, not a migration.
  */
  behavior: Partial<Record<SceneId, SceneBehaviorRecord>>;

  updateLanding: (data: Partial<LandingData>) => void;
  setInvestigator: (name: string) => void;
  setLightArchive: (data: LightArchiveData) => void;
  markRecordLayerFirstVisit: () => void;
  recordSoundEvent: (event: SoundPlayEvent) => void;
  setSoundSelection: (soundId: string, memoryPosition: MemoryPosition) => void;
  setMemorySketch: (data: MemorySketchData) => void;
  setSentenceClues: (data: SentenceCluesData) => void;
  setSceneBehavior: (record: SceneBehaviorRecord) => void;
  markFinalReportGenerated: () => void;
  completeScene: (id: SceneId) => void;
  /** Dev-only direct scene jump. Never expose in user-facing UI. */
  goToScene: (id: SceneId) => void;
  reset: () => void;
}

const initialState = {
  currentScene: SCENE_ORDER[0],
  completedScenes: [] as SceneId[],
  landing: {
    enteredAt: 0,
    timeToEnterMs: 0,
    figureDwellMs: 0,
    cursorTravelPx: 0,
    bounced: false,
  } as LandingData,
  investigator: null as Investigator | null,
  lightArchive: null as LightArchiveData | null,
  recordLayerFirstVisit: null as RecordLayerFirstVisitData | null,
  soundClues: {
    events: [] as SoundPlayEvent[],
    selectedSoundId: null,
    memoryPosition: null,
    // Retired — the Zone no longer asks for a word. See SoundCluesData.
    selectedKeyword: null,
  } as SoundCluesData,
  memorySketch: {
    strokes: [],
    emptyAreaRatio: 1,
    lastInputAt: 0,
    roomVariant: 'default',
    selectedObjects: [],
    drawingUsed: false,
    selectedColors: [],
  } as MemorySketchData,
  sentenceClues: {
    selectedSentenceIds: [],
    selectedSentences: [],
    customSentence: '',
    dwellTimes: {},
    selectionOrder: [],
    repeatedKeywords: [],
  } as SentenceCluesData,
  finalReport: null as { generatedAt: number } | null,
  behavior: {} as Partial<Record<SceneId, SceneBehaviorRecord>>,
};

export const useExperienceStore = create<ExperienceState>()(
  persist(
    (set) => ({
      ...initialState,

      updateLanding: (data) => set((state) => ({ landing: { ...state.landing, ...data } })),

      setInvestigator: (name) =>
        set({
          investigator: {
            investigatorName: name,
            reportId: generateReportId(),
            entryTime: Date.now(),
            registrationStatus: 'registered',
          },
        }),

      setLightArchive: (data) => set({ lightArchive: data }),

      markRecordLayerFirstVisit: () => set({ recordLayerFirstVisit: { enteredAt: Date.now() } }),

      recordSoundEvent: (event) =>
        set((state) => {
          const events = state.soundClues.events.filter((e) => e.soundId !== event.soundId);
          return { soundClues: { ...state.soundClues, events: [...events, event] } };
        }),

      setSoundSelection: (soundId, memoryPosition) =>
        set((state) => ({
          soundClues: { ...state.soundClues, selectedSoundId: soundId, memoryPosition },
        })),

      setMemorySketch: (data) => set({ memorySketch: data }),

      setSentenceClues: (data) => set({ sentenceClues: data }),

      setSceneBehavior: (record) =>
        set((state) => ({ behavior: { ...state.behavior, [record.sceneId]: record } })),

      markFinalReportGenerated: () => set({ finalReport: { generatedAt: Date.now() } }),

      completeScene: (id) =>
        set((state) => {
          const completedScenes = state.completedScenes.includes(id)
            ? state.completedScenes
            : [...state.completedScenes, id];
          return {
            completedScenes,
            currentScene: getFurthestAllowedScene(completedScenes),
          };
        }),

      goToScene: (id) => set({ currentScene: id }),

      reset: () => set({ ...initialState }),
    }),
    {
      name: 'unanswered-experience-v2',
      partialize: (state) => ({
        landing: state.landing,
        investigator: state.investigator,
        lightArchive: state.lightArchive,
        recordLayerFirstVisit: state.recordLayerFirstVisit,
        soundClues: state.soundClues,
        memorySketch: state.memorySketch,
        sentenceClues: state.sentenceClues,
        finalReport: state.finalReport,
        behavior: state.behavior,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // A browser visit always starts at the exhibition entrance. Persisted
        // answers remain available, but navigation state is intentionally
        // session-local so reloads never resume into a later Zone.
        state.currentScene = 'landing';
        state.completedScenes = [];
        // Storage written before behavioural tracking existed has no such key,
        // and the merge leaves it undefined rather than falling back.
        if (!state.behavior) state.behavior = {};
        // Likewise for storage written while SOUND still asked for a feeling
        // word: it holds a keyword and no position at all.
        if (state.soundClues && state.soundClues.memoryPosition === undefined) {
          state.soundClues.memoryPosition = null;
        }
        // Storage written before MEMORY had a Room has strokes and nothing
        // else — Free Drawing was the whole Zone then, so a visit that made
        // any mark at all is read as having used it. `roomVariant` reads
        // 'default' rather than nothing, matching every visit made since,
        // since no visit before the Room existed had one to record.
        if (state.memorySketch && (state.memorySketch as { roomVariant?: string }).roomVariant === undefined) {
          const strokes = state.memorySketch.strokes ?? [];
          state.memorySketch.roomVariant = 'default';
          state.memorySketch.selectedObjects = [];
          state.memorySketch.drawingUsed = strokes.length > 0;
          state.memorySketch.selectedColors = [...new Set(strokes.map((s) => s.color))];
        }
      },
    },
  ),
);

export function selectRecordLayerDerived(state: ExperienceState): RecordLayerDerived {
  return {
    investigator: state.investigator,
    light: state.lightArchive,
    soundClues: state.soundClues,
    memorySketch: state.memorySketch,
    sentenceClues: state.sentenceClues,
    completedCount: state.completedScenes.length,
    totalCount: SCENE_ORDER.length,
  };
}
