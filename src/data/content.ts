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

/**
 * SENTENCE v2 — reconstructing what happened after the record breaks off.
 *
 * The Zone no longer offers one flat archive of interchangeable scraps. LIGHT,
 * SOUND and MEMORY have already left the visitor a short, deterministic
 * Recovered Context (see src/lib/sentenceNarrative.ts) that ends at a named
 * gap — the record simply stops. What is assembled here is the visitor's own
 * account of what might have followed that gap, built from exactly three
 * roles: a direction the moment took, a trace it left in the room, and how
 * the case record itself concludes. Each role is called a `slot`, numbered
 * 1–3 in the order a restored record reads.
 *
 * The four candidates within a slot are not four ways of saying the same
 * thing. Each is its own narrative branch: slot 1 asks
 * whether the person waited, left deliberately, left and came back, or tried
 * to leave and couldn't; slot 2 asks whether the room stayed as it was, some
 * of it moved, one thing was left behind, or something new appeared; slot 3
 * asks whether the person's trail ends, the room's trail ends, a later visit
 * was found, or the record picks up again somewhere else. Any one candidate
 * from each of the three groups combines with any other without asserting a
 * fact the other two contradict — the three groups describe three different
 * moments in the same short timeline (the choice, what it left, how the file
 * closes), not three opinions about one moment, so they never have to agree
 * with each other on a single detail to stay coherent together.
 *
 * `그 사람` (never `나`) is the subject throughout, matching how LIGHT and
 * MEMORY's own on-screen copy already refers to whoever is being
 * investigated ("그 사람이 남긴 흔적", "그 사람의 기억에선…") — SENTENCE is
 * the first Zone to let that person appear as the subject of a full
 * sentence, but it is the same person the rest of the exhibition has been
 * describing all along.
 *
 * Every candidate stays in the same register the rest of the exhibition
 * holds to: an observation or a possibility, never a diagnosis. None of them
 * name what actually happened — nothing here does — and none of them
 * contradict what LIGHT, SOUND or MEMORY already left behind. They are fixed
 * rather than chosen per-visit from those clues: a candidate list that changed
 * shape depending on which sound or which objects a visitor picked would be a
 * second combinatorial surface on top of the Recovered Context's own, and
 * this Zone already has one narrative layer — it does not need two.
 *
 * The ids are stable and readable for the same reason the old fragment ids
 * were: they are what every fragmentAdd/fragmentRemove/fragmentReorder event
 * names, and what anyone reading a record has to recognise at a glance.
 */
export type SentenceSlot = 1 | 2 | 3;

export interface SentenceReconstructionFragment {
  id: string;
  slot: SentenceSlot;
  text: string;
}

/** Short, internal-facing names for the three slots — shown in the UI as a
 *  quiet section marker, never as a "correct category" to fill in. */
export const SENTENCE_SLOT_LABELS: Record<SentenceSlot, string> = {
  1: '그날의 선택',
  2: '남겨진 흔적',
  3: '기록의 끝',
};

export const SENTENCE_SLOTS: readonly SentenceSlot[] = [1, 2, 3];

export const SENTENCE_RECONSTRUCTION_FRAGMENTS: SentenceReconstructionFragment[] = [
  // 1 — 그날의 선택: the direction the moment took, just before the record breaks off.
  { id: 'RECON_A_WAITED', slot: 1, text: '그 사람은 누군가를 기다리듯, 그 자리에 머물러 있었던 것으로 보인다.' },
  { id: 'RECON_A_LEFT_CALM', slot: 1, text: '그 사람은 필요한 것만 챙겨 방을 나선 듯하다.' },
  { id: 'RECON_A_RETURNED_FOR', slot: 1, text: '한번 떠났다가, 두고 간 것을 찾으러 다시 돌아온 듯하다.' },
  { id: 'RECON_A_HESITATED', slot: 1, text: '떠나려 했지만, 한동안 방을 벗어나지 못했을 가능성이 있다.' },

  // 2 — 남겨진 흔적: what changed, or didn't, in the room because of it.
  { id: 'RECON_B_UNTOUCHED', slot: 2, text: '남아 있는 것들은 대부분 원래 자리를 지키고 있는 것 같다.' },
  { id: 'RECON_B_DISPLACED', slot: 2, text: '몇몇 물건은 원래 있던 자리에서 벗어난 흔적이 있다.' },
  { id: 'RECON_B_LEFT_BEHIND', slot: 2, text: '미처 챙기지 못한 물건 하나가 그 자리에 남아 있는 듯하다.' },
  { id: 'RECON_B_NEW_TRACE', slot: 2, text: '전에는 없던 작은 흔적이 새로 생겨난 것으로 추정된다.' },

  // 3 — 기록의 끝: how the case record itself concludes.
  { id: 'RECON_C_PERSON_ENDS', slot: 3, text: '그 사람에 대한 더 이상의 기록은 확인되지 않았다.' },
  { id: 'RECON_C_SPACE_ENDS', slot: 3, text: '그날 이후, 이 공간에 대한 기록은 이어지지 않았다.' },
  { id: 'RECON_C_LATER_VISIT', slot: 3, text: '얼마 뒤, 누군가 다시 이곳을 다녀간 흔적이 남아 있다.' },
  { id: 'RECON_C_CONTINUES_ELSEWHERE', slot: 3, text: '다음 기록은 이곳이 아닌, 다른 곳에서 다시 시작될 가능성이 있다.' },
];

/**
 * How many fragments a reconstruction must hold before it can be recorded,
 * and how many it can hold at all.
 *
 * Product rules rather than heuristics, so they live here with the content
 * and not in the threshold file. Exactly one candidate per slot, three slots:
 * the lower bound is what "the record can be submitted" means, the upper
 * bound is what "every slot is filled" means, and both are enforced by the
 * scene rather than inferred.
 */
export const SENTENCE_MIN_FRAGMENTS = 3;
export const SENTENCE_MAX_FRAGMENTS = 3;

/*
  The Zone's seven recordings.

  Bundled through the same route as the archive images — imported rather than
  fetched from a path — so the hashed filenames and the deployment's base path
  are Vite's problem rather than something to keep in step by hand.

  What is in each recording is deliberately not written down here, and is not
  named anywhere the visitor can reach it. A sound labelled "rain" is heard as
  rain; the same recording labelled SOUND 01 is heard, and what it is heard as
  is the visitor's own. The whole Zone rests on that, and a description under
  the label would answer the question the Zone is asking. Anyone needing to
  know which file is which can compare the numbered files in src/assets/sound.

  Real durations come off the audio itself, so nothing is declared here.
*/
import sound01 from '../assets/sound/01.mp3';
import sound02 from '../assets/sound/02.mp3';
import sound03 from '../assets/sound/03.mp3';
import sound04 from '../assets/sound/04.mp3';
import sound05 from '../assets/sound/05.mp3';
import sound06 from '../assets/sound/06.mp3';
import sound07 from '../assets/sound/07.mp3';

export interface SoundClue {
  /** Also the tracking target id — the name every recorded event is filed under. */
  id: string;
  /** The only thing shown. */
  label: string;
  src: string;
}

export const SOUND_CLUES: SoundClue[] = [
  { id: 'SOUND_01', label: 'SOUND 01', src: sound01 },
  { id: 'SOUND_02', label: 'SOUND 02', src: sound02 },
  { id: 'SOUND_03', label: 'SOUND 03', src: sound03 },
  { id: 'SOUND_04', label: 'SOUND 04', src: sound04 },
  { id: 'SOUND_05', label: 'SOUND 05', src: sound05 },
  { id: 'SOUND_06', label: 'SOUND 06', src: sound06 },
  { id: 'SOUND_07', label: 'SOUND 07', src: sound07 },
];

/**
 * Shared sensory vocabulary. Currently unused.
 *
 * SOUND's second question was a row of these words until it became a place in
 * a field; LIGHT asks for feelings from EMOTION_KEYWORDS directly. Left here
 * because it is written content rather than code, and SENTENCE has not been
 * built yet — delete it if that Zone turns out not to want it either.
 */
export const SENSORY_WORDS = EMOTION_KEYWORDS.map((keyword) => keyword.ko);

/** Muted, restrained palette for Memory Sketch — 4 colors per the "절제된 색" requirement. */
export const SKETCH_COLORS = ['#c9a3ff', '#7fa7d9', '#e2b6a0', '#9fd6c9'];

/**
 * MEMORY's Reconstructed Room — the interactive objects a visitor can
 * recognise as "that person's trace."
 *
 * `label` exists for assistive technology only. The UI never renders it as
 * visible text — the object's line art is the only thing anyone reading the
 * room sees, on the same principle as SOUND_CLUES: a labelled list would
 * turn the room into a form.
 *
 * A flat, swappable table on purpose. Nothing about the interaction (hover,
 * select, the color that washes in) reads `id` or `label` for meaning — see
 * src/components/MemoryRoom.tsx, which maps each `id` to its own line art and
 * position and would keep working unchanged if this list grew, shrank, or
 * was replaced by a different room entirely.
 */
export interface MemoryRoomObject {
  id: string;
  /** Screen-reader only. Never shown as UI text. */
  label: string;
}

export const MEMORY_ROOM_OBJECTS: MemoryRoomObject[] = [
  { id: 'window', label: '창문' },
  { id: 'lamp', label: '스탠드' },
  { id: 'book', label: '책' },
  { id: 'photo', label: '사진' },
  { id: 'cup', label: '컵' },
  { id: 'chair', label: '의자' },
  { id: 'bag', label: '가방' },
  { id: 'bedside', label: '침대 위의 작은 물건' },
];

/**
 * Objects to select before the Room can be left.
 *
 * A product rule rather than a heuristic — same reasoning as
 * SENTENCE_MIN_FRAGMENTS just above: what "the record can be submitted"
 * means is decided by the Zone, not inferred from behaviour, so it lives
 * here with the content it gates rather than in memoryThresholds.ts.
 */
export const MEMORY_MIN_OBJECT_SELECTION = 2;
