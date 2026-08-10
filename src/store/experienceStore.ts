import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Investigator,
  LandingData,
  LightArchiveData,
  MemorySketchData,
  RecordLayerDerived,
  RecordLayerFirstVisitData,
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

  updateLanding: (data: Partial<LandingData>) => void;
  setInvestigator: (name: string) => void;
  setLightArchive: (data: LightArchiveData) => void;
  markRecordLayerFirstVisit: () => void;
  recordSoundEvent: (event: SoundPlayEvent) => void;
  setSoundSelection: (soundId: string, keyword: string) => void;
  setMemorySketch: (data: MemorySketchData) => void;
  setSentenceClues: (data: SentenceCluesData) => void;
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
    selectedKeyword: null,
  } as SoundCluesData,
  memorySketch: {
    strokes: [],
    emptyAreaRatio: 1,
    lastInputAt: 0,
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

      setSoundSelection: (soundId, keyword) =>
        set((state) => ({
          soundClues: { ...state.soundClues, selectedSoundId: soundId, selectedKeyword: keyword },
        })),

      setMemorySketch: (data) => set({ memorySketch: data }),

      setSentenceClues: (data) => set({ sentenceClues: data }),

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
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // A browser visit always starts at the exhibition entrance. Persisted
        // answers remain available, but navigation state is intentionally
        // session-local so reloads never resume into a later Zone.
        state.currentScene = 'landing';
        state.completedScenes = [];
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
