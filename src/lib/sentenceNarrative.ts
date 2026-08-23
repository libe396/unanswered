/**
 * SENTENCE's Recovered Context — a content narrative, not a behavioural one.
 *
 * This is deliberately a separate layer from everything else in src/lib.
 * Every other file under this Zone's umbrella (sentenceTracking.ts,
 * sentencePatterns.ts) reads what the visitor *did* — raw events, replayed
 * into a summary, read into a pattern. This file reads none of that. It
 * reads only what LIGHT, SOUND and MEMORY's visitors *finally answered* —
 * `LightArchiveData`, `SoundCluesData`, `MemorySketchData`, exactly as
 * `experienceStore` already holds them — and turns those answers into the
 * short passage SENTENCE opens with, before any fragment is chosen.
 *
 * Deterministic and content-only, on purpose:
 *
 *   - No raw `BehaviorEvent` is read here, and no `SceneBehaviorRecord`,
 *     `SceneBehaviorSummary`, `BehaviorPattern` or `CrossSceneFinding` is
 *     either. What a visitor dwelt on or returned to in LIGHT has nothing to
 *     say about what this passage reads — only the answer they left
 *     standing does.
 *   - Nothing here calls out to an LLM or any other live service. The same
 *     three answers always produce the same passage, byte for byte, which is
 *     what lets a visit be replayed and checked later.
 *   - Nothing here names what a SOUND clue actually is, the way SOUND_CLUES
 *     itself never does — only where its selected place sat in the field
 *     (how clear, how far) is legible from `memoryPosition`, and that is all
 *     this reads. Naming the sound would answer, in SENTENCE, the one
 *     question SOUND spent its whole Zone declining to.
 *   - `selectedObjects` is grouped into three light, purely spatial buckets
 *     (activity / personal / environment — see OBJECT_GROUP_BY_ID) so the
 *     traces paragraph reads as one scene rather than a list, but the
 *     grouping only ever chooses *phrasing*. It is never read as evidence of
 *     a state of mind — see buildTracesParagraph's doc for the line that
 *     rule draws.
 *   - Every sentence stays in the same register the rest of the exhibition
 *     holds to: an observation or a possibility ("~것으로 보인다", "~것
 *     같다"), never a diagnosis of the missing person or the visitor. See
 *     SENTENCE_RECONSTRUCTION_FRAGMENTS in src/data/content.ts for the same
 *     rule applied to the fragments the visitor goes on to choose.
 */
import { MEMORY_ROOM_OBJECTS } from '../data/content';
import type { LightArchiveData, MemorySketchData, SoundCluesData } from '../types';

export interface SentenceNarrativeContext {
  /** 2–4 short paragraphs, read in order: the space, what it held, what
   *  could still be heard, and a single hedged line tying them together.
   *  Never a bare list of which clues were picked — see the module doc on
   *  buildSoundParagraph for why a clue's *content* is never named directly. */
  paragraphs: string[];
  /** Where the record stops. Stated plainly, without a fabricated duration —
   *  nothing upstream of this file records how long any gap actually was. */
  missingSegmentText: string;
  /** The question Reconstruction answers — asked of the room, not of the
   *  visitor, so it never reads as a quiz. */
  promptText: string;
  /** The instruction that turns the question into an action. Kept apart from
   *  `promptText` so the two can carry a different weight on screen — a
   *  question the visitor reads, then a line that tells them what to do
   *  about it. */
  instructionText: string;
}

/* ── Korean particle helpers ─────────────────────────────────────────────── */

/** True when the last syllable of `word` carries a trailing consonant
 *  (받침). Non-Hangul input (should not occur — every string this is called
 *  on is fixed Korean content) is treated as batchim-less rather than
 *  thrown on. */
function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  return hasBatchim(word) ? withBatchim : withoutBatchim;
}

/** "A와 B" for two items, "A, B, 그리고 C" for three or more — the two shapes
 *  a short spoken-Korean list naturally takes. */
function joinNatural(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]}${josa(items[0], '와', '과')} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, 그리고 ${items[items.length - 1]}`;
}

/* ── Space — LIGHT's final answer only (rules.lightOrigin, .averageBrightness) ─ */

function lightOriginPhrase(origin: { x: number; y: number }): string {
  const vertical = origin.y < 0.4 ? '위쪽' : origin.y > 0.6 ? '아래쪽' : '';
  const horizontal = origin.x < 0.4 ? '왼편' : origin.x > 0.6 ? '오른편' : '';
  const label = `${vertical} ${horizontal}`.trim();
  return label || '한가운데';
}

function buildSpaceParagraph(light: LightArchiveData | null): string {
  if (!light) return '그 방에 어떤 빛이 남아 있었는지는 기록되지 않았다.';
  const brightness = light.rules.averageBrightness;
  const brightnessWord = brightness < 0.35 ? '희미한' : brightness < 0.65 ? '은은한' : '선명한';
  const originPhrase = lightOriginPhrase(light.rules.lightOrigin);
  return `그 방에는 아직 ${brightnessWord} 빛이 ${originPhrase}에 남아 있었다.`;
}

/* ── Traces — MEMORY's final answer only (selectedObjects, drawingUsed) ─────
   selectedObjects is grouped into three light, purely spatial buckets so the
   paragraph reads as one observed scene instead of an inventory. The
   grouping decides phrasing only — "물건이 쓰던 자리에서 멈춰 있었다" versus
   "손이 닿는 자리에 남아 있었다" — never a claim about why those objects
   were chosen or what the person felt. A visitor who picked book + cup and
   one who picked bag + photo read two different sentences because they left
   two different *scenes*, not because this file has judged one of them. */

type ObjectGroup = 'activity' | 'personal' | 'environment';

const OBJECT_GROUP_BY_ID: Record<string, ObjectGroup> = {
  book: 'activity',
  cup: 'activity',
  lamp: 'activity',
  bag: 'personal',
  photo: 'personal',
  bedside: 'personal',
  window: 'environment',
  chair: 'environment',
};

const OBJECT_GROUP_ORDER: readonly ObjectGroup[] = ['activity', 'personal', 'environment'];

/** The one group most of the selected objects belong to, or null when no
 *  single group leads (nothing recognised, or a tie) — a mixed trace claims
 *  no particular character and falls back to the plain, ungrouped phrasing. */
function dominantObjectGroup(ids: readonly string[]): ObjectGroup | null {
  const counts: Record<ObjectGroup, number> = { activity: 0, personal: 0, environment: 0 };
  ids.forEach((id) => {
    const group = OBJECT_GROUP_BY_ID[id];
    if (group) counts[group] += 1;
  });
  let best: ObjectGroup | null = null;
  let bestCount = 0;
  let tied = false;
  for (const group of OBJECT_GROUP_ORDER) {
    if (counts[group] > bestCount) {
      best = group;
      bestCount = counts[group];
      tied = false;
    } else if (counts[group] === bestCount && bestCount > 0) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/** `subject` already carries its topic marker (은/는) — the caller decides
 *  that once, from the actual joined item list, rather than each template
 *  guessing at batchim on its own copy of the phrase. */
const OBJECT_GROUP_TEMPLATE: Record<ObjectGroup, (subject: string) => string> = {
  activity: (subject) => `${subject} 쓰던 자리에서 그대로 멈춰 있었다.`,
  personal: (subject) => `${subject} 손이 닿는 자리에 그대로 남아 있었다.`,
  environment: (subject) => `${subject} 그 자리를 조용히 지키고 있었다.`,
};

function buildTracesParagraph(memory: MemorySketchData): string {
  const ordered = MEMORY_ROOM_OBJECTS.filter((o) => memory.selectedObjects.includes(o.id));
  if (ordered.length === 0) return '뚜렷한 흔적은 남아 있지 않았다.';

  const shownLabels = ordered.slice(0, 3).map((o) => o.label);
  const extra = ordered.length - shownLabels.length;
  const listText = joinNatural(shownLabels) + (extra > 0 ? ' 등' : '');
  // "등" ends in ㅇ — always batchim — so the extra-items case never needs
  // to ask josa() about it.
  const subject = `${listText}${extra > 0 ? '은' : josa(shownLabels[shownLabels.length - 1], '은', '는')}`;

  const group = dominantObjectGroup(ordered.map((o) => o.id));
  const traceLine = group ? OBJECT_GROUP_TEMPLATE[group](subject) : `${subject} 그대로 남아 있었다.`;

  const sentences = [traceLine];
  if (memory.drawingUsed) sentences.push('그 위로 남겨진 손짓의 흔적도 함께 있었다.');
  return sentences.join(' ');
}

/* ── Sound — SOUND's final answer only (memoryPosition), never the clue itself ─ */

function buildSoundParagraph(sound: SoundCluesData): string {
  if (!sound.memoryPosition) return '그 순간 주변에 어떤 소리가 있었는지는 남아 있지 않다.';
  const { x, y } = sound.memoryPosition;
  const clarityWord = x < 0.4 ? '희미하게' : x > 0.6 ? '또렷하게' : '어렴풋이';
  const distanceWord = y < 0.4 ? '가까운 곳에서' : y > 0.6 ? '먼 곳에서' : '적당한 거리에서';
  return `그 사이, ${distanceWord} ${clarityWord} 이어지는 소리가 있었다.`;
}

/* ── Bridge — ties the three above into one line, on MEMORY's own count ──────
   The only paragraph that reaches a conclusion at all, and it reaches the
   smallest one available: how many traces were left, not what they mean.
   Object *count* is a fact `selectedObjects` already carries — reading it is
   not a step further than reading which objects they are, and it lets the
   line respond to the visit without inventing anything past what MEMORY
   itself recorded. */

function buildBridgeLine(memory: MemorySketchData): string {
  const count = memory.selectedObjects.length;
  if (count >= 4) return '남겨진 흔적으로 보면, 그 사람은 이곳에서 꽤 오랜 시간을 보낸 것처럼 보인다.';
  if (count <= 2) return '남겨진 흔적은 많지 않았지만, 누군가 이곳에 있었던 것만은 분명해 보인다.';
  return '남겨진 흔적으로 보아, 그 사람은 이곳에서 한동안 머물렀던 것으로 보인다.';
}

/* ── Fixed lines — no clue determines these; they hold the Zone's own voice ── */

const MISSING_SEGMENT_TEXT = '그러나 기록은 여기서 끝난다.';
const PROMPT_TEXT = '그날, 이 방에서는 무슨 일이 있었을까.';
const INSTRUCTION_TEXT = '남아 있는 단서를 바탕으로, 마지막 기록을 복원해 주세요.';

/**
 * Builds SENTENCE's Recovered Context from LIGHT/SOUND/MEMORY's final
 * answers alone. Pure and total — every argument may be in whatever state a
 * visit that has actually reached SENTENCE leaves them in (LIGHT is always
 * answered by then; SOUND's `memoryPosition` and MEMORY's `selectedObjects`
 * are guarded individually since old or partial records can still lack
 * them), and this never throws.
 */
export function buildSentenceNarrativeContext(
  light: LightArchiveData | null,
  sound: SoundCluesData,
  memory: MemorySketchData,
): SentenceNarrativeContext {
  return {
    paragraphs: [
      buildSpaceParagraph(light),
      buildTracesParagraph(memory),
      buildSoundParagraph(sound),
      buildBridgeLine(memory),
    ],
    missingSegmentText: MISSING_SEGMENT_TEXT,
    promptText: PROMPT_TEXT,
    instructionText: INSTRUCTION_TEXT,
  };
}
