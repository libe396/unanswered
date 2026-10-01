import type { SceneId } from '../types';

export interface ZoneFilm {
  file: string;
  title?: string;
  subtitle?: string;
  /** 'full' (default) keeps the original playback; 'cut' plays a short muted excerpt; 'none' skips the film. */
  mode?: 'full' | 'cut' | 'none';
  /** cut mode: where playback starts. Default 0. */
  cutStartMs?: number;
  /** cut mode: how long playback lasts. Default 2500. */
  cutMs?: number;
}

// Scene identities, never filename numbering, determine the exhibition route.
export const ZONE_FILMS: Partial<Record<SceneId, ZoneFilm>> = {
  lightArchive: { file: '01_Color_Trace_Final.mp4', mode: 'cut', title: '빛의 흔적', subtitle: '빛은 그 사람의 흔적을 가장 잘 담고 있다.' },
  zone03Intro: { file: '02_Stairs_Final.mp4', mode: 'none' },
  soundClues: { file: '03_Sound_Trace_Final.mp4', mode: 'cut', title: '소리의 흔적', subtitle: '소리는 사라져도, 그 순간의 공기는 남아 있다.' },
  memorySketch: { file: '05_Memory_Sketch_Final.mp4', mode: 'cut', title: '기억의 흔적', subtitle: '수집된 단서를 바탕으로 공간의 일부가 복원되었습니다.' },
  sentenceClues: { file: '04_Sentence_Clues_Final.mp4', mode: 'cut', title: '문장의 흔적', subtitle: '사람의 기억은, 결국 글자로 남는 법.' },
  recordLayerSecondVisit: { file: '06_Memory_Layers_Entry_3p2s.mp4', mode: 'cut', title: '기록의 레이어' },
  // The one full stop before the reveal.
  finalReport: { file: '07_Final_Report_Final.mp4', mode: 'full', title: '최종보고서' },
};
