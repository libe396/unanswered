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
    text: '그 사람은 필요한 것만 챙겨 방을 나선 듯하다.' },
  { id: 'RECON_A_HESITATED', narrativeRole: 'aftermath', openSlots: [], semanticTags: [],
    text: '떠나려 했지만, 한동안 방을 벗어나지 못했을 가능성이 있다.' },
  { id: 'RECON_A_RETURNED_FOR', narrativeRole: 'aftermath', openSlots: ['purpose'], semanticTags: [],
    text: '한번 떠났다가, 두고 간 것을 확인하기 위해 다시 돌아온 듯하다.' },
  { id: 'RECON_A_WAITED', narrativeRole: 'aftermath', openSlots: ['person'], semanticTags: ['waiting'],
    text: '그 사람은 누군가를 기다리듯 그 자리에 머물러 있었던 것으로 보인다.' },

  // ── B. 무엇을 남겼는가 — remains ──────────────────────────────────────────
  { id: 'RECON_B_LEFT_BEHIND', narrativeRole: 'remains', openSlots: ['object'], semanticTags: ['object'],
    text: '미처 챙기지 못한 물건 하나가 그 자리에 남아 있는 듯하다.' },
  { id: 'RECON_B_PUT_DOWN_AGAIN', narrativeRole: 'remains', openSlots: ['object'], semanticTags: ['object'],
    text: '몇 번이고 챙겼다가 다시 내려놓은 물건이 있었던 것으로 보인다.' },
  { id: 'RECON_B_LEFT_ON_PURPOSE', narrativeRole: 'remains', openSlots: ['object'], semanticTags: ['object'],
    text: '가져갈 수 있었지만 일부러 남겨둔 것으로 보이는 물건이 있다.' },
  // openSlots added in the Final Logic Patch: "몇몇 물건" already names a
  // plural of unnamed objects, so 'object' only makes explicit what the
  // sentence already implies — see src/lib/sentenceQuestionService.ts's
  // FRAGMENT_QUESTIONS for the fallback this unlocks.
  { id: 'RECON_B_DISPLACED', narrativeRole: 'remains', openSlots: ['object'], semanticTags: ['object'],
    text: '몇몇 물건은 이전과 다른 자리에 놓여 있었던 것으로 보인다.' },

  // ── C. 무엇을 하지 못했는가 — unresolved ──────────────────────────────────
  { id: 'RECON_C_UNSPOKEN', narrativeRole: 'unresolved', openSlots: ['message'], semanticTags: [],
    text: '그 사람이 끝내 전하지 못한 말이 있었던 것으로 보인다.' },
  { id: 'RECON_C_UNDONE_ACTION', narrativeRole: 'unresolved', openSlots: ['action'], semanticTags: [],
    text: '하려다 그만둔 행동이 있었을 가능성이 있다.' },
  { id: 'RECON_C_UNWRITTEN_RECORD', narrativeRole: 'unresolved', openSlots: ['record'], semanticTags: [],
    text: '누군가에게 남기려다 끝내 남기지 않은 기록이 있었던 것으로 보인다.' },
  { id: 'RECON_C_UNDECIDED', narrativeRole: 'unresolved', openSlots: ['decision'], semanticTags: [],
    text: '마지막까지 결정하지 못한 일이 하나 있었던 듯하다.' },

  // ── D. 그 이후에는 — after ────────────────────────────────────────────────
  { id: 'RECON_D_REVISITED', narrativeRole: 'after', openSlots: [], semanticTags: [],
    text: '그 사람은 그날 이후에도 몇 차례 이곳을 다시 찾은 듯하다.' },
  { id: 'RECON_D_UNCHANGED', narrativeRole: 'after', openSlots: [], semanticTags: [],
    text: '한동안 이 공간에는 별다른 변화가 없었던 것으로 보인다.' },
  { id: 'RECON_D_VANISHED_LATER', narrativeRole: 'after', openSlots: ['object'], semanticTags: ['object'],
    text: '시간이 지난 뒤, 남겨져 있던 물건 하나가 사라졌다.' },
  { id: 'RECON_D_DOOR_LEFT_OPEN', narrativeRole: 'after', openSlots: [], semanticTags: [],
    text: '열린 채 남아 있던 문은 한동안 그대로였던 것으로 보인다.' },

  // ── E. 마지막 기록 — ending (gated; always drawn last in a restored record) ─
  // 'absence' — never a candidate itself (no openSlots), but its tag can
  // still lend a linked-tag bonus to another drawn fragment's score (e.g.
  // RECON_A_WAITED's 'waiting') — see sentenceQuestionService.ts's
  // SEMANTIC_LINKS. No new fact is ever asserted by this: a shared theme
  // nudges *which* open slot gets asked about, never what the answer is.
  { id: 'RECON_E_NEVER_RETURNED', narrativeRole: 'ending', openSlots: [], semanticTags: ['absence'],
    text: '그 사람은 결국 이곳으로 다시 돌아오지 않은 것으로 보인다.' },
  { id: 'RECON_E_RECORD_ENDS', narrativeRole: 'ending', openSlots: [], semanticTags: ['absence'],
    text: '이후 그 사람에 대한 기록은 더 이상 확인되지 않는다.' },
  { id: 'RECON_E_CONTINUES_ELSEWHERE', narrativeRole: 'ending', openSlots: [], semanticTags: ['absence'],
    text: '다음 기록은 이곳이 아닌 다른 장소에서 이어졌을 가능성이 있다.' },
  { id: 'RECON_E_LAST_RECORD_HERE', narrativeRole: 'ending', openSlots: [], semanticTags: ['absence'],
    text: '그날 이후 이 공간에서 확인되는 기록은 여기까지다.' },
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
