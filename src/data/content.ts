export interface EmotionKeyword {
  ko: string;
  en: string;
}

/** Korean keys must match EMOTION_TINTS in src/lib/lightRenderer.js exactly. */
export const EMOTION_KEYWORDS: EmotionKeyword[] = [
  { ko: '그리움', en: 'longing' },
  { ko: '설렘', en: 'flutter' },
  { ko: '고요함', en: 'stillness' },
  { ko: '슬픔', en: 'sadness' },
  { ko: '따뜻함', en: 'warmth' },
  { ko: '공허함', en: 'emptiness' },
  { ko: '낯섦', en: 'strangeness' },
  { ko: '불안', en: 'anxiety' },
  { ko: '평온', en: 'serenity' },
  { ko: '아련함', en: 'bittersweet' },
];

export const MAX_EMOTION_KEYWORDS = 2;

export interface SentenceOption {
  id: string;
  text: string;
}

export const SENTENCE_OPTIONS: SentenceOption[] = [
  { id: 's1', text: '나는 그날을 정확히 기억하지 못한다.' },
  { id: 's2', text: '어떤 질문은 답을 원하지 않는다.' },
  { id: 's3', text: '나는 아직도 그 문 앞에 서 있다.' },
  { id: 's4', text: '기억은 나를 떠나지 않았다.' },
  { id: 's5', text: '나는 아직도 나를 잘 모른다.' },
  { id: 's6', text: '누군가 나를 대신 설명해줬으면 좋겠다.' },
  { id: 's7', text: '나는 늘 같은 자리에서 머뭇거린다.' },
];

export const MAX_SENTENCE_SELECTION = 3;

export interface SoundClue {
  id: string;
  label: string;
  description: string;
  /** Expected duration in ms — drives simulated playback progress until a real file exists. */
  durationMs: number;
  /** Placeholder path. Swap the audio file at this path later; no code changes needed. */
  src: string;
}

export const SOUND_CLUES: SoundClue[] = [
  { id: 'snd1', label: '비 오는 날의 소리', description: '멀리서 들려오는 낮은 빗소리', durationMs: 12000, src: '/audio/sound-clues/rain.mp3' },
  { id: 'snd2', label: '커피 내리는 소리', description: '천천히 떨어지는 물방울과 김', durationMs: 9000, src: '/audio/sound-clues/coffee.mp3' },
  { id: 'snd3', label: '종이 넘기는 소리', description: '페이지를 넘기는 마찰음', durationMs: 7000, src: '/audio/sound-clues/paper.mp3' },
  { id: 'snd4', label: '연필로 쓰는 소리', description: '종이 위를 긁는 낮은 마찰음', durationMs: 8000, src: '/audio/sound-clues/pencil.mp3' },
  { id: 'snd5', label: '발걸음 소리', description: '텅 빈 복도를 걷는 발소리', durationMs: 10000, src: '/audio/sound-clues/footsteps.mp3' },
  { id: 'snd6', label: '엘리베이터 문이 열리는 소리', description: '기계적인 개폐음', durationMs: 5000, src: '/audio/sound-clues/elevator.mp3' },
  { id: 'snd7', label: '누군가의 웃음소리', description: '멀리서 들려오는 웃음', durationMs: 6000, src: '/audio/sound-clues/laughter.mp3' },
];

/** Shared sensory vocabulary — reused as-is by Sound Clues' "선택 감각 단어" step. */
export const SENSORY_WORDS = EMOTION_KEYWORDS.map((keyword) => keyword.ko);

/** Muted, restrained palette for Memory Sketch — 4 colors per the "절제된 색" requirement. */
export const SKETCH_COLORS = ['#c9a3ff', '#7fa7d9', '#e2b6a0', '#9fd6c9'];
