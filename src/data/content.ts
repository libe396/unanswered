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
 * SENTENCE — the Archive. Narrative System v3.0.
 *
 * LIGHT, SOUND and MEMORY have already left the visitor a short, deterministic
 * Recovered Context (see src/lib/sentenceNarrative.ts) that ends at a named
 * gap — the record simply stops. What is listed here is the archive the
 * visitor goes on to search: twenty fragments, shown as one wall of cards in
 * `explore` (see SentenceCluesScene.tsx), of which the visitor draws three to
 * five and reads as one possible account of what happened to CASE 017 after
 * the record breaks off.
 *
 * A fragment is not a self-portrait the visitor picks because it resembles
 * them. It is a possible piece of that account, never a statement about
 * whoever is standing in front of the screen. Every fragment keeps `그 사람`
 * (never `나`) as its subject, matching how LIGHT and MEMORY's own on-screen
 * copy already refers to whoever is being investigated ("그 사람이 남긴
 * 흔적", "그 사람의 기억에선…"). No fragment fixes the case to one kind of
 * story (romance, loss, death, …) — different visitors drawing different
 * cards should be able to arrive at genuinely different, equally plausible
 * continuations.
 *
 * `narrativeRole` groups the twenty by what part of "afterward" they answer
 * — never shown on screen; it exists so the wall can eventually be read (by
 * this file, by whoever tunes it next) as five kinds of continuation rather
 * than twenty unrelated lines:
 *
 *   - `aftermath`  (01–04) — did they leave, or stay?
 *   - `remains`    (05–08) — what did the room keep?
 *   - `unresolved` (09–12) — what never got finished?
 *   - `after`      (13–16) — what happened once time passed?
 *   - `ending`     (17–20) — where the case record itself stops. Gated in
 *      the UI — see SENTENCE_MIN_NON_ENDING_BEFORE_ENDING below — and always
 *      drawn last in a restored record regardless of when it was drawn.
 *
 * `openSlots` names the one piece of each fragment that is *explicitly*
 * unnamed — an object, a message, a decision, a person — if the fragment
 * has one at all. This is what src/lib/sentenceQuestionService.ts reads to
 * decide which of the visitor's drawn fragments has something left to ask
 * about; roughly half the twenty have none, on purpose — not every
 * fragment is a question waiting to happen, and forcing one onto a
 * fragment that does not name anything missing (see every `ending`
 * fragment, or 13/14/16) would mean inventing a gap that was never there.
 * See that file's module doc for the full reasoning and the one open slot
 * type (`purpose`) that names an implied target rather than an unnamed noun.
 *
 * `semanticTags` is internal scoring metadata only — never rendered, never
 * read outside src/lib/sentenceQuestionService.ts. When more than one drawn
 * fragment carries an open slot, the question service scores candidates
 * partly on whether their tags echo another drawn fragment's (see that
 * file's module doc), and this is the raw material for that: a short,
 * deliberately sparse set of shared-theme words (`object`, `waiting`,
 * `absence`, …), added only to fragments where a real thematic echo exists
 * — most fragments carry none at all.
 *
 * Every fragment stays in the same register the rest of the exhibition
 * holds to: an observation or a possibility, never a diagnosis.
 */
export type SentenceNarrativeRole = 'aftermath' | 'remains' | 'unresolved' | 'after' | 'ending';

export interface SentenceReconstructionFragment {
  id: string;
  text: string;
  narrativeRole: SentenceNarrativeRole;
  /** The one unnamed thing this fragment could be asked about, if any — see
   *  the module doc above. At most one entry in practice; a list rather
   *  than a single field only so a fragment could carry more than one
   *  without a shape change if a future revision ever needs it. */
  openSlots: readonly string[];
  /** Internal scoring metadata only — see the module doc above. Empty for
   *  most fragments. */
  semanticTags: readonly string[];
}

/** How many non-`ending` fragments must already be drawn before an `ending`
 *  card can be drawn at all — the case cannot be declared closed before
 *  there is anything else on record. See SentenceCluesScene.tsx's
 *  `isEndingLocked`. */
export const SENTENCE_MIN_NON_ENDING_BEFORE_ENDING = 2;

export const SENTENCE_RECONSTRUCTION_FRAGMENTS: SentenceReconstructionFragment[] = [
  // ── A. 떠났는가, 남았는가 — aftermath ─────────────────────────────────────
  { id: 'RECON_A_LEFT_CALM', narrativeRole: 'aftermath', openSlots: [], semanticTags: [],
    text: '필요한 것만 챙겨 방을 나섰다.' },
  { id: 'RECON_A_HESITATED', narrativeRole: 'aftermath', openSlots: [], semanticTags: [],
    text: '떠나려 했지만, 한동안 방을 나서지 못했다.' },
  { id: 'RECON_A_RETURNED_FOR', narrativeRole: 'aftermath', openSlots: ['purpose'], semanticTags: [],
    text: '떠났다가, 두고 간 것을 보러 다시 돌아왔다.' },
  { id: 'RECON_A_WAITED', narrativeRole: 'aftermath', openSlots: ['person'], semanticTags: ['waiting'],
    text: '누군가를 기다리며 그 자리에 있었다.' },

  // ── B. 무엇을 남겼는가 — remains ──────────────────────────────────────────
  { id: 'RECON_B_LEFT_BEHIND', narrativeRole: 'remains', openSlots: ['object'], semanticTags: ['object'],
    text: '챙기지 못한 물건 하나가 남아 있다.' },
  { id: 'RECON_B_PUT_DOWN_AGAIN', narrativeRole: 'remains', openSlots: ['object'], semanticTags: ['object'],
    text: '몇 번이고 챙겼다가 다시 내려놓은 물건이 있다.' },
  { id: 'RECON_B_LEFT_ON_PURPOSE', narrativeRole: 'remains', openSlots: ['object'], semanticTags: ['object'],
    text: '가져갈 수 있었지만 일부러 두고 간 물건이 있다.' },
  // openSlots added in the Final Logic Patch: "몇몇 물건" already names a
  // plural of unnamed objects, so 'object' only makes explicit what the
  // sentence already implies — see src/lib/sentenceQuestionService.ts's
  // FRAGMENT_QUESTIONS for the fallback this unlocks.
  { id: 'RECON_B_DISPLACED', narrativeRole: 'remains', openSlots: ['object'], semanticTags: ['object'],
    text: '몇몇 물건의 자리가 바뀌어 있다.' },

  // ── C. 무엇을 하지 못했는가 — unresolved ──────────────────────────────────
  { id: 'RECON_C_UNSPOKEN', narrativeRole: 'unresolved', openSlots: ['message'], semanticTags: [],
    text: '끝내 전하지 못한 말이 있었다.' },
  { id: 'RECON_C_UNDONE_ACTION', narrativeRole: 'unresolved', openSlots: ['action'], semanticTags: [],
    text: '하려다 그만둔 일이 있었다.' },
  { id: 'RECON_C_UNWRITTEN_RECORD', narrativeRole: 'unresolved', openSlots: ['record'], semanticTags: [],
    text: '누군가에게 남기려다 만 메모가 있었다.' },
  { id: 'RECON_C_UNDECIDED', narrativeRole: 'unresolved', openSlots: ['decision'], semanticTags: [],
    text: '끝까지 정하지 못한 일이 하나 있었다.' },

  // ── D. 그 이후에는 — after ────────────────────────────────────────────────
  { id: 'RECON_D_REVISITED', narrativeRole: 'after', openSlots: [], semanticTags: [],
    text: '그날 이후에도 몇 번 이곳을 다시 찾았다.' },
  { id: 'RECON_D_UNCHANGED', narrativeRole: 'after', openSlots: [], semanticTags: [],
    text: '한동안 이 방은 그대로였다.' },
  { id: 'RECON_D_VANISHED_LATER', narrativeRole: 'after', openSlots: ['object'], semanticTags: ['object'],
    text: '얼마 뒤, 남아 있던 물건 하나가 사라졌다.' },
  { id: 'RECON_D_DOOR_LEFT_OPEN', narrativeRole: 'after', openSlots: [], semanticTags: [],
    text: '열린 문은 한동안 그대로였다.' },

  // ── E. 마지막 기록 — ending (gated; always drawn last in a restored record) ─
  // 'absence' — never a candidate itself (no openSlots), but its tag can
  // still lend a linked-tag bonus to another drawn fragment's score (e.g.
  // RECON_A_WAITED's 'waiting') — see sentenceQuestionService.ts's
  // SEMANTIC_LINKS. No new fact is ever asserted by this: a shared theme
  // nudges *which* open slot gets asked about, never what the answer is.
  { id: 'RECON_E_NEVER_RETURNED', narrativeRole: 'ending', openSlots: [], semanticTags: ['absence'],
    text: '그 사람은 다시 돌아오지 않았다.' },
  { id: 'RECON_E_RECORD_ENDS', narrativeRole: 'ending', openSlots: [], semanticTags: ['absence'],
    text: '그 뒤의 기록은 없다.' },
  { id: 'RECON_E_CONTINUES_ELSEWHERE', narrativeRole: 'ending', openSlots: [], semanticTags: ['absence'],
    text: '다음 기록은 다른 곳에서 이어진다.' },
  { id: 'RECON_E_LAST_RECORD_HERE', narrativeRole: 'ending', openSlots: [], semanticTags: ['absence'],
    text: '이 방의 기록은 여기까지다.' },
];

/**
 * How many fragments a collected record must hold before the Zone can move
 * on, and how many it can hold at all.
 *
 * A product rule rather than a heuristic, so it lives here with the content
 * and not in the threshold file — this is what "enough to move on" and "no
 * more room" mean to the Zone, decided by the Zone rather than inferred from
 * behaviour. Three is a short account rather than a single answer; five is
 * a full hand of fragments without turning the archive into a checklist.
 */
export const SENTENCE_MIN_FRAGMENTS = 3;
export const SENTENCE_MAX_FRAGMENTS = 5;

/*
  The Zone's seven recordings.

  Bundled through the same route as the archive images — imported rather than
  fetched from a path — so the hashed filenames and the deployment's base path
  are Vite's problem rather than something to keep in step by hand.

  Labels and icons match the byte-identical named source recordings.
  Existing SOUND IDs remain stable for saved visits.

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
  /** Human-readable source identity. */
  label: string;
  src: string;
  icon: 'rain' | 'paper' | 'people' | 'elevator' | 'pencil' | 'subway' | 'car';
}

export const SOUND_CLUES: SoundClue[] = [
  { id: 'SOUND_01', label: '빗소리', src: sound01, icon: 'rain' },
  { id: 'SOUND_02', label: '종이 넘기는 소리', src: sound02, icon: 'paper' },
  { id: 'SOUND_03', label: '사람들 웃고 떠드는 소리', src: sound03, icon: 'people' },
  { id: 'SOUND_04', label: '엘리베이터', src: sound04, icon: 'elevator' },
  { id: 'SOUND_05', label: '연필로 쓰고 지우는 소리', src: sound05, icon: 'pencil' },
  { id: 'SOUND_06', label: '지하철', src: sound06, icon: 'subway' },
  { id: 'SOUND_07', label: '차가 지나가는 소리', src: sound07, icon: 'car' },
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
 * Labels serve the room tooltip, selection list and downstream record.
 * Legacy IDs remain readable; only IDs with current room geometry are selectable.
 *
 * A flat, swappable table on purpose. Nothing about the interaction (hover,
 * select, the color that washes in) reads `id` or `label` for meaning — see
 * src/components/MemoryRoom.tsx, which maps each `id` to its own line art and
 * position and would keep working unchanged if this list grew, shrank, or
 * was replaced by a different room entirely.
 */
export interface MemoryRoomObject {
  id: string;
  /** Accessible name and visible record label. */
  label: string;
}

export const MEMORY_ROOM_OBJECTS: MemoryRoomObject[] = [
  { id: 'window', label: '창문' },
  { id: 'lamp', label: '스탠드' },
  { id: 'book', label: '책' },
  { id: 'photo', label: '사진' },
  { id: 'cup', label: '컵' },
  { id: 'chair', label: '의자' },
  { id: 'pillow', label: '베개' },
  { id: 'duvet', label: '이불' },
  { id: 'bedsidePlant', label: '협탁 위 화분' },
  // Historical records keep their names without acquiring new hit areas.
  { id: 'bag', label: '가방' },
  { id: 'bedside', label: '책상 아래 쌓인 물건' },
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
