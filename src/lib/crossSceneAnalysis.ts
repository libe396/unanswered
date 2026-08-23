/**
 * Cross-Scene Behavioral Analysis — v2.
 *
 * Every Zone up to this point reads its own record and says what it saw
 * there: LIGHT reads a look and a choice, SOUND reads a listen and a place,
 * MEMORY reads a mark, SENTENCE reads an assembly. Nothing in any of those
 * files knows the other three Zones exist.
 *
 * This file is the first thing that does. Its question is not "did this
 * happen in this Zone" — every Scene Pattern already answers that — but "did
 * the same *shape* of behaviour turn up in more than one Zone, independently,
 * on media that have nothing else in common." An image returned to, a sound
 * returned to, a place on a canvas returned to and a fragment returned to are
 * four different acts on four different materials. What they can share is a
 * structure: something left and come back to. Seeing that structure repeat
 * across media that could not have influenced one another is a different
 * kind of evidence than seeing it once, and this file is only about counting
 * how many Zones independently observed the same structure — never about
 * what it means.
 *
 * ── What this file will not do ─────────────────────────────────────────────
 *
 * It will not say a visitor is indecisive, attached to the past, or
 * uncertain. "Four Zones independently show a return to something left" is
 * everything a Finding here claims. The distance from that sentence to a
 * character trait is exactly the distance the rest of the exhibition has
 * been careful not to close, and this file does not close it either.
 *
 * ── Where this sits in the pipeline ────────────────────────────────────────
 *
 *   Raw Event → Scene Summary → Scene Pattern → Cross-Scene Finding → (Report Narrative)
 *
 * This file is the fourth stage. It reads what summarizeScene / summarizeSound
 * / summarizeMemory / summarizeSentence and their pattern detectors have
 * already computed, and combines it. It does not read a raw event, a DOM
 * node, localStorage, or the zustand store — see `CrossSceneInput` below. And
 * it stops at the Finding: turning a Finding into a sentence for the Final
 * Report is deliberately the next stage's job, not this one's.
 *
 * ── Four Zones, not five ────────────────────────────────────────────────────
 *
 * SOUND's second question — where to place the point — is summarised and
 * detected in its own files (src/lib/positionTracking.ts,
 * positionPatterns.ts) because placing a point and choosing a sound answer
 * different enough questions to need different arithmetic. But they are one
 * visit to one Scene with one commit at the end, not two Scenes a visitor
 * moved between. Counting them as independent Zones would let one Scene say
 * "two different media agree" about itself, which is exactly the inflation
 * this file exists to avoid — see `CrossSceneSoundInput`. So there are four
 * Zones: LIGHT, SOUND (sound choice and placement together), MEMORY,
 * SENTENCE.
 *
 * ── Which group answers for a Zone ─────────────────────────────────────────
 *
 * LIGHT asks two questions under two groups, 'image' (single-select) and
 * 'emotion' (multi-select). Every trace below except POST_DECISION reads
 * 'image': it is the question with a single answer that can be left and
 * returned to, the same shape SOUND's sound choice and SENTENCE's fragments
 * have. POST_DECISION reads 'emotion' instead, since it is LIGHT's last
 * question before the visitor moves on, and "settled on an answer, then kept
 * going" is a fact about whichever question that was.
 *
 * ── MEMORY v2 ────────────────────────────────────────────────────────────
 *
 * MEMORY is no longer only a canvas. A visit now always passes through the
 * Room (an 'object' question — explore, select at least two, optionally
 * revise) and only *optionally* through Drawing (the 'sketch' question this
 * file already knew). Two things follow, and both are read off
 * `MemoryBehaviorSummary` exactly as computed — nothing below re-derives
 * anything memoryTracking.ts or memoryPatterns.ts has not already worked
 * out:
 *
 * 1. RETURN, REVISION, ATTENTION_CHOICE_GAP and RECHECK can all be read from
 *    the Room alone (OBJECT_RETURN, OBJECT_REVISION, OBJECT_ATTENTION_GAP,
 *    and a RECHECK reading of `objectViewPath` on the same terms as LIGHT's
 *    and SENTENCE's), and the Room is never skipped — so MEMORY is
 *    `applicable: true` for those four on every visit that reached the Zone
 *    at all, the same as before, just answered by different evidence now.
 *    Where a drawing-side pattern also bears on the same trace (ERASE_RETURN
 *    on RETURN, REPEATED_REVISION on REVISION) it is folded in alongside the
 *    Room's own evidence — still one MEMORY zone count, never two.
 *
 * 2. POST_DECISION and PAUSE have only ever been answered by Drawing
 *    (POST_DRAWING_HESITATION; DELAYED_START / LONG_PAUSE), and the Room has
 *    no pattern of its own that bears on either — no new one is invented
 *    here to fill the gap. So both are now read off `summary.drawingEntered`
 *    per visit: skipped Drawing and MEMORY is `applicable: false` for that
 *    trace this time (nothing was there to observe, not "observed and
 *    nothing happened"); entered Drawing and it is `applicable: true`,
 *    detected however the existing pattern already reads. This is the one
 *    place a Zone's applicability is decided per-visit rather than fixed —
 *    see the note on `applicable` above ZoneEvidence.
 */
import type { BehaviorFact, BehaviorPattern, BehaviorPatternId } from './behaviorPatterns';
import type { GroupSummary } from './behaviorTracking';
import type { SoundBehaviorSummary } from './soundTracking';
import type { MemoryBehaviorSummary } from './memoryTracking';
import type { SentenceBehaviorSummary } from './sentenceTracking';
import { CROSS_SCENE_THRESHOLDS } from './crossSceneThresholds';

/* ── Types ───────────────────────────────────────────────────────────────── */

export type CrossSceneTraceId =
  | 'RETURN'
  | 'REVISION'
  | 'ATTENTION_CHOICE_GAP'
  | 'POST_DECISION'
  | 'RECHECK'
  | 'PAUSE';

/** Declaration order, and the final tie-break when two Findings agree on
 *  everything ranking otherwise looks at. Fixed, so the same input always
 *  returns Findings in the same order. */
const TRACE_ORDER: readonly CrossSceneTraceId[] = [
  'RETURN',
  'REVISION',
  'ATTENTION_CHOICE_GAP',
  'POST_DECISION',
  'RECHECK',
  'PAUSE',
];

export type FindingStrength = 'primary' | 'secondary' | 'observation' | 'none';

/** The four Zones a Finding can be independently observed in. See the module
 *  doc for why SOUND's placement question is not a fifth. */
export type CrossSceneZoneId = 'LIGHT' | 'SOUND' | 'MEMORY' | 'SENTENCE';

const ZONE_ORDER: readonly CrossSceneZoneId[] = ['LIGHT', 'SOUND', 'MEMORY', 'SENTENCE'];

export interface ZoneEvidence {
  sceneId: CrossSceneZoneId;
  /** False when this Zone's interaction structure cannot express this trace
   *  at all, or when no record exists for it on this visit. Either way,
   *  `facts.reason` says which. */
  applicable: boolean;
  detected: boolean;
  /** Which Scene Pattern id(s) or Scene Summary value(s) this reads. Traceable
   *  back to a specific figure, never invented for this layer. */
  sources: string[];
  /** The measurements the verdict was reached from. Reuses BehaviorFact, the
   *  same evidence type every Scene Pattern detector already returns. */
  facts: Record<string, BehaviorFact>;
}

export interface CrossSceneFinding {
  id: CrossSceneTraceId;
  strength: FindingStrength;
  /** How many Zones, independently, detected this trace. Never more than
   *  once per Zone regardless of how many patterns fired inside it. */
  detectedZoneCount: number;
  /** How many Zones could have detected it at all. */
  applicableZoneCount: number;
  zoneEvidence: ZoneEvidence[];
  /** Up to three zoneEvidence entries worth leading with. Deterministic —
   *  see `choosePrimaryEvidence`. */
  primaryEvidence: ZoneEvidence[];
  priority: number;
}

/* ── Input ───────────────────────────────────────────────────────────────── */

export interface CrossSceneLightInput {
  imageGroup: GroupSummary;
  /** Null when the visitor never reached the second question this visit. */
  emotionGroup: GroupSummary | null;
  /** detectPatterns(imageGroup). */
  imagePatterns: BehaviorPattern[];
  /** detectPatterns(emotionGroup), or null on the same condition as the group. */
  emotionPatterns: BehaviorPattern[] | null;
}

/**
 * SOUND's second question — where to place the point — is summarised and
 * detected separately (src/lib/positionTracking.ts, positionPatterns.ts) but
 * is not a Scene of its own: one record, one `soundClues` visit, one commit.
 * Its evidence is folded into the SOUND zone below rather than counted as a
 * fifth independently-observing Zone. See the module doc.
 */
export interface CrossSceneSoundInput {
  summary: SoundBehaviorSummary;
  /** detectSoundPatterns(summary). */
  soundPatterns: BehaviorPattern[];
  /** detectPositionPatterns(summary). */
  positionPatterns: BehaviorPattern[];
}

export interface CrossSceneMemoryInput {
  summary: MemoryBehaviorSummary;
  /** detectMemoryPatterns(summary). */
  patterns: BehaviorPattern[];
}

export interface CrossSceneSentenceInput {
  summary: SentenceBehaviorSummary;
  /** detectSentencePatterns(summary). */
  patterns: BehaviorPattern[];
}

/**
 * What analyzeCrossScene reads. Every field is already-computed Scene
 * Summary and Scene Pattern output — nothing here is a raw event, a DOM node,
 * localStorage or the zustand store. Building this from an actual visit is
 * the caller's job (see src/hooks/useCrossSceneDebug.ts for the dev-only
 * example); this file never reaches for the data itself.
 *
 * A Zone the visitor has not reached yet, or a visit recorded before that
 * Zone existed, is `null` here. analyzeCrossScene reads that as "no record to
 * judge this visit's behaviour by" — the Zone contributes `applicable: false`
 * to every trace, with the reason said plainly, rather than the caller
 * needing to fake an empty summary or this file crashing on one.
 */
export interface CrossSceneInput {
  light: CrossSceneLightInput | null;
  sound: CrossSceneSoundInput | null;
  memory: CrossSceneMemoryInput | null;
  sentence: CrossSceneSentenceInput | null;
}

/* ── Shared helpers ──────────────────────────────────────────────────────── */

function findPattern(
  patterns: readonly BehaviorPattern[] | null | undefined,
  id: BehaviorPatternId,
): BehaviorPattern | null {
  return patterns?.find((pattern) => pattern.id === id) ?? null;
}

function inapplicable(sceneId: CrossSceneZoneId, reason: string): ZoneEvidence {
  return { sceneId, applicable: false, detected: false, sources: [], facts: { reason } };
}

/**
 * How many times each target repeats *immediately* in a viewPath — nothing
 * else viewed in between. This is RECHECK's own reading of a viewPath, kept
 * separate from RETURN_LOOP's total-view count: A, B, A is a return (B sits
 * between the two looks at A); A, A is a recheck (nothing does). Both are
 * read from the same already-computed `viewPath`, never from raw events.
 */
function consecutiveRepeatCounts(viewPath: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 1; i < viewPath.length; i += 1) {
    if (viewPath[i] === viewPath[i - 1]) {
      counts[viewPath[i]] = (counts[viewPath[i]] ?? 0) + 1;
    }
  }
  return counts;
}

/* ── RETURN ──────────────────────────────────────────────────────────────── */

function evaluateReturn(input: CrossSceneInput): ZoneEvidence[] {
  const light: ZoneEvidence = input.light
    ? (() => {
        const returnLoop = findPattern(input.light!.imagePatterns, 'RETURN_LOOP');
        const finalReturn = findPattern(input.light!.imagePatterns, 'FINAL_RETURN');
        const sources: string[] = [];
        if (returnLoop?.detected) sources.push('RETURN_LOOP');
        if (finalReturn?.detected) sources.push('FINAL_RETURN');
        return {
          sceneId: 'LIGHT' as const,
          applicable: true,
          detected: sources.length > 0,
          sources,
          facts: {
            loopedTargets: (returnLoop?.facts.loopedTargets as BehaviorFact) ?? [],
            firstSelectedTarget: (finalReturn?.facts.firstSelectedTarget as BehaviorFact) ?? null,
            finalSelectedTarget: (finalReturn?.facts.finalSelectedTarget as BehaviorFact) ?? null,
          },
        };
      })()
    : inapplicable('LIGHT', 'no lightArchive behavior record for this visit');

  const sound: ZoneEvidence = input.sound
    ? (() => {
        const soundReturn = findPattern(input.sound!.soundPatterns, 'SOUND_RETURN');
        const finalReturn = findPattern(input.sound!.soundPatterns, 'FINAL_RETURN');
        const positionReturn = findPattern(input.sound!.positionPatterns, 'POSITION_RETURN');
        const sources: string[] = [];
        if (soundReturn?.detected) sources.push('SOUND_RETURN');
        if (finalReturn?.detected) sources.push('FINAL_RETURN');
        if (positionReturn?.detected) sources.push('POSITION_RETURN');
        return {
          sceneId: 'SOUND' as const,
          applicable: true,
          detected: sources.length > 0,
          sources,
          facts: {
            returnedSounds: (soundReturn?.facts.returnedSounds as BehaviorFact) ?? [],
            distanceBetweenFirstAndFinal:
              (positionReturn?.facts.distanceBetweenFirstAndFinal as BehaviorFact) ?? null,
          },
        };
      })()
    : inapplicable('SOUND', 'no soundClues behavior record for this visit');

  const memory: ZoneEvidence = input.memory
    ? (() => {
        /*
          The Room is never optional, so its own return evidence
          (OBJECT_RETURN) is read on every visit that reached MEMORY at all.
          Drawing's ERASE_RETURN is folded in alongside it when Drawing was
          entered — never a reason to withhold RETURN when it was not.
        */
        const objectReturn = findPattern(input.memory!.patterns, 'OBJECT_RETURN');
        const eraseReturn = findPattern(input.memory!.patterns, 'ERASE_RETURN');
        const sources: string[] = [];
        if (objectReturn?.detected) sources.push('OBJECT_RETURN');
        if (eraseReturn?.detected) sources.push('ERASE_RETURN');
        return {
          sceneId: 'MEMORY' as const,
          applicable: true,
          detected: sources.length > 0,
          sources,
          facts: {
            viewReturnedObjects: (objectReturn?.facts.viewReturnedObjects as BehaviorFact) ?? [],
            selectionReturnCount: (objectReturn?.facts.selectionReturnCount as BehaviorFact) ?? 0,
            eraseReturnCount: (eraseReturn?.facts.eraseReturnCount as BehaviorFact) ?? 0,
            closestDistance: (eraseReturn?.facts.closestDistance as BehaviorFact) ?? null,
            drawingEntered: input.memory!.summary.drawingEntered,
          },
        };
      })()
    : inapplicable('MEMORY', 'no memorySketch behavior record for this visit');

  const sentence: ZoneEvidence = input.sentence
    ? (() => {
        const fragmentReturn = findPattern(input.sentence!.patterns, 'FRAGMENT_RETURN');
        return {
          sceneId: 'SENTENCE' as const,
          applicable: true,
          detected: fragmentReturn?.detected ?? false,
          sources: fragmentReturn?.detected ? ['FRAGMENT_RETURN'] : [],
          facts: {
            fragmentReturnCount: (fragmentReturn?.facts.fragmentReturnCount as BehaviorFact) ?? 0,
            returnedFragments: (fragmentReturn?.facts.returnedFragments as BehaviorFact) ?? [],
          },
        };
      })()
    : inapplicable('SENTENCE', 'no sentenceClues behavior record for this visit');

  return [light, sound, memory, sentence];
}

/* ── REVISION ────────────────────────────────────────────────────────────── */

function evaluateRevision(input: CrossSceneInput): ZoneEvidence[] {
  const light: ZoneEvidence = input.light
    ? (() => {
        const g = input.light!.imageGroup;
        /*
          LIGHT has no named REVISION pattern, so this reads the objective
          values a revision has to leave behind: the choice changed at least
          once (selectionChangeCount), and it changed *net* — settled
          somewhere other than where it started. That second condition is
          what keeps this independent of RETURN: A → B → A changed and came
          back, which is RETURN's shape, not REVISION's. Only A → B, staying
          on B, counts here.
        */
        const finalTarget = g.finalSelectedIds[0] ?? null;
        const detected =
          g.selectionChangeCount >= 1 &&
          g.firstSelectedId !== null &&
          finalTarget !== null &&
          g.firstSelectedId !== finalTarget;
        return {
          sceneId: 'LIGHT' as const,
          applicable: true,
          detected,
          sources: detected ? ['image.firstSelectedId≠finalSelectedIds[0]'] : [],
          facts: {
            firstSelectedTarget: g.firstSelectedId,
            finalSelectedTarget: finalTarget,
            selectionChangeCount: g.selectionChangeCount,
          },
        };
      })()
    : inapplicable('LIGHT', 'no lightArchive behavior record for this visit');

  const sound: ZoneEvidence = input.sound
    ? (() => {
        const p = findPattern(input.sound!.positionPatterns, 'POSITION_REVISION');
        return {
          sceneId: 'SOUND' as const,
          applicable: true,
          detected: p?.detected ?? false,
          sources: p?.detected ? ['POSITION_REVISION'] : [],
          facts: {
            distanceBetweenFirstAndFinal: (p?.facts.distanceBetweenFirstAndFinal as BehaviorFact) ?? null,
            positionRevisionCount: (p?.facts.positionRevisionCount as BehaviorFact) ?? 0,
          },
        };
      })()
    : inapplicable('SOUND', 'no soundClues behavior record for this visit');

  const memory: ZoneEvidence = input.memory
    ? (() => {
        /*
          Same reasoning as RETURN above: the Room's OBJECT_REVISION is
          always readable, Drawing's REPEATED_REVISION joins it when Drawing
          happened. Neither withholds the other.
        */
        const objectRevision = findPattern(input.memory!.patterns, 'OBJECT_REVISION');
        const repeatedRevision = findPattern(input.memory!.patterns, 'REPEATED_REVISION');
        const sources: string[] = [];
        if (objectRevision?.detected) sources.push('OBJECT_REVISION');
        if (repeatedRevision?.detected) sources.push('REPEATED_REVISION');
        return {
          sceneId: 'MEMORY' as const,
          applicable: true,
          detected: sources.length > 0,
          sources,
          facts: {
            addedSinceFirstValid: (objectRevision?.facts.addedSinceFirstValid as BehaviorFact) ?? [],
            removedSinceFirstValid: (objectRevision?.facts.removedSinceFirstValid as BehaviorFact) ?? [],
            reachedFirstValidObjectState:
              (objectRevision?.facts.reachedFirstValidState as BehaviorFact) ?? false,
            revisionCount: (repeatedRevision?.facts.revisionCount as BehaviorFact) ?? 0,
            drawingEntered: input.memory!.summary.drawingEntered,
          },
        };
      })()
    : inapplicable('MEMORY', 'no memorySketch behavior record for this visit');

  const sentence: ZoneEvidence = input.sentence
    ? (() => {
        const rewrite = findPattern(input.sentence!.patterns, 'REPEATED_REWRITE');
        const order = findPattern(input.sentence!.patterns, 'ORDER_REVISION');
        const sources: string[] = [];
        if (rewrite?.detected) sources.push('REPEATED_REWRITE');
        if (order?.detected) sources.push('ORDER_REVISION');
        return {
          sceneId: 'SENTENCE' as const,
          applicable: true,
          detected: sources.length > 0,
          sources,
          facts: {
            rewriteCount: (rewrite?.facts.rewriteCount as BehaviorFact) ?? 0,
            reorderCount: (order?.facts.reorderCount as BehaviorFact) ?? 0,
          },
        };
      })()
    : inapplicable('SENTENCE', 'no sentenceClues behavior record for this visit');

  return [light, sound, memory, sentence];
}

/* ── ATTENTION_CHOICE_GAP ────────────────────────────────────────────────── */

function evaluateAttentionChoiceGap(input: CrossSceneInput): ZoneEvidence[] {
  const light: ZoneEvidence = input.light
    ? (() => {
        const p = findPattern(input.light!.imagePatterns, 'ATTENTION_SELECTION_GAP');
        return {
          sceneId: 'LIGHT' as const,
          applicable: true,
          detected: p?.detected ?? false,
          sources: p?.detected ? ['ATTENTION_SELECTION_GAP'] : [],
          facts: {
            longestViewedTarget: (p?.facts.longestViewedTarget as BehaviorFact) ?? null,
            finalSelectedTarget: (p?.facts.finalSelectedTarget as BehaviorFact) ?? null,
          },
        };
      })()
    : inapplicable('LIGHT', 'no lightArchive behavior record for this visit');

  const sound: ZoneEvidence = input.sound
    ? (() => {
        const p = findPattern(input.sound!.soundPatterns, 'LISTEN_SELECTION_GAP');
        return {
          sceneId: 'SOUND' as const,
          applicable: true,
          detected: p?.detected ?? false,
          sources: p?.detected ? ['LISTEN_SELECTION_GAP'] : [],
          facts: {
            mostListenedSound: (p?.facts.mostListenedSound as BehaviorFact) ?? null,
            finalSelectedSound: (p?.facts.finalSelectedSound as BehaviorFact) ?? null,
          },
        };
      })()
    : inapplicable('SOUND', 'no soundClues behavior record for this visit');

  /*
    v1 had nothing here — a canvas is drawn on, not chosen from. v2's Room
    is a selection question with exploration to weigh against it, on the
    same terms LIGHT's image question is, so MEMORY reads OBJECT_ATTENTION_GAP
    the same way LIGHT reads ATTENTION_SELECTION_GAP. Applicable on every
    visit that reached the Room, Drawing or no.
  */
  const memory: ZoneEvidence = input.memory
    ? (() => {
        const p = findPattern(input.memory!.patterns, 'OBJECT_ATTENTION_GAP');
        return {
          sceneId: 'MEMORY' as const,
          applicable: true,
          detected: p?.detected ?? false,
          sources: p?.detected ? ['OBJECT_ATTENTION_GAP'] : [],
          facts: {
            mostViewedObject: (p?.facts.mostViewedObject as BehaviorFact) ?? null,
            finalSelectedObjects: (p?.facts.finalSelectedObjects as BehaviorFact) ?? [],
            hasObjectViewData: (p?.facts.hasObjectViewData as BehaviorFact) ?? false,
          },
        };
      })()
    : inapplicable('MEMORY', 'no memorySketch behavior record for this visit');

  const sentence: ZoneEvidence = input.sentence
    ? (() => {
        const p = findPattern(input.sentence!.patterns, 'VIEW_SELECTION_GAP');
        return {
          sceneId: 'SENTENCE' as const,
          applicable: true,
          detected: p?.detected ?? false,
          sources: p?.detected ? ['VIEW_SELECTION_GAP'] : [],
          facts: {
            gapFragmentCount: (p?.facts.gapFragmentCount as BehaviorFact) ?? 0,
            hasViewData: (p?.facts.hasViewData as BehaviorFact) ?? false,
          },
        };
      })()
    : inapplicable('SENTENCE', 'no sentenceClues behavior record for this visit');

  return [light, sound, memory, sentence];
}

/* ── POST_DECISION ───────────────────────────────────────────────────────── */

function evaluatePostDecision(input: CrossSceneInput): ZoneEvidence[] {
  const light: ZoneEvidence = input.light
    ? (() => {
        // Reads 'emotion', LIGHT's last question — see the module doc.
        const p = input.light!.emotionPatterns
          ? findPattern(input.light!.emotionPatterns, 'POST_DECISION_HESITATION')
          : null;
        return {
          sceneId: 'LIGHT' as const,
          applicable: true,
          detected: p?.detected ?? false,
          sources: p?.detected ? ['POST_DECISION_HESITATION(emotion)'] : [],
          facts: {
            postDecisionMs: (p?.facts.postDecisionMs as BehaviorFact) ?? null,
            emotionGroupReached: input.light!.emotionGroup !== null,
          },
        };
      })()
    : inapplicable('LIGHT', 'no lightArchive behavior record for this visit');

  const sound: ZoneEvidence = input.sound
    ? (() => {
        const hesitation = findPattern(input.sound!.soundPatterns, 'POST_DECISION_HESITATION');
        const replay = findPattern(input.sound!.positionPatterns, 'POST_PLACEMENT_REPLAY');
        const sources: string[] = [];
        if (hesitation?.detected) sources.push('POST_DECISION_HESITATION');
        if (replay?.detected) sources.push('POST_PLACEMENT_REPLAY');
        return {
          sceneId: 'SOUND' as const,
          applicable: true,
          detected: sources.length > 0,
          sources,
          facts: {
            postDecisionMs: (hesitation?.facts.postDecisionMs as BehaviorFact) ?? null,
            replayCount: (replay?.facts.replayCount as BehaviorFact) ?? 0,
          },
        };
      })()
    : inapplicable('SOUND', 'no soundClues behavior record for this visit');

  const memory: ZoneEvidence = input.memory
    ? (() => {
        /*
          POST_DRAWING_HESITATION is the only post-decision figure MEMORY
          computes, and it is exactly what its name says — there is no
          Room-side equivalent (no pattern reads what happens after the
          Room's own selection settles). A visit that skipped Drawing has
          nothing for this trace to read, which is `applicable: false`, not
          "reached a decision and did not linger" — that would be crediting
          a visitor with calm they were never in a position to show.
        */
        if (!input.memory!.summary.drawingEntered) {
          return inapplicable(
            'MEMORY',
            'Drawing was skipped this visit — POST_DRAWING_HESITATION is the only post-decision figure MEMORY computes, and there is nothing to measure without a canvas entered',
          );
        }
        const p = findPattern(input.memory!.patterns, 'POST_DRAWING_HESITATION');
        return {
          sceneId: 'MEMORY' as const,
          applicable: true,
          detected: p?.detected ?? false,
          sources: p?.detected ? ['POST_DRAWING_HESITATION'] : [],
          facts: {
            postDrawingMs: (p?.facts.postDrawingMs as BehaviorFact) ?? null,
          },
        };
      })()
    : inapplicable('MEMORY', 'no memorySketch behavior record for this visit');

  const sentence: ZoneEvidence = input.sentence
    ? (() => {
        const hesitation = findPattern(input.sentence!.patterns, 'POST_SENTENCE_HESITATION');
        const revision = findPattern(input.sentence!.patterns, 'POST_COMPLETION_REVISION');
        const sources: string[] = [];
        if (hesitation?.detected) sources.push('POST_SENTENCE_HESITATION');
        if (revision?.detected) sources.push('POST_COMPLETION_REVISION');
        return {
          sceneId: 'SENTENCE' as const,
          applicable: true,
          detected: sources.length > 0,
          sources,
          facts: {
            postSentenceMs: (hesitation?.facts.postSentenceMs as BehaviorFact) ?? null,
            editCountAfterValid: (revision?.facts.editCountAfterValid as BehaviorFact) ?? 0,
          },
        };
      })()
    : inapplicable('SENTENCE', 'no sentenceClues behavior record for this visit');

  return [light, sound, memory, sentence];
}

/* ── RECHECK ─────────────────────────────────────────────────────────────── */

function evaluateRecheck(input: CrossSceneInput): ZoneEvidence[] {
  const threshold = CROSS_SCENE_THRESHOLDS.recheckMinConsecutiveRepeats;

  const light: ZoneEvidence = input.light
    ? (() => {
        const counts = consecutiveRepeatCounts(input.light!.imageGroup.viewPath);
        const targets = Object.entries(counts)
          .filter(([, count]) => count >= threshold)
          .map(([id]) => id);
        return {
          sceneId: 'LIGHT' as const,
          applicable: true,
          detected: targets.length > 0,
          sources: targets.length > 0 ? ['image.viewPath (consecutive repeat)'] : [],
          facts: {
            recheckedTargets: targets,
            consecutiveRepeatCountByTarget: counts,
            threshold,
          },
        };
      })()
    : inapplicable('LIGHT', 'no lightArchive behavior record for this visit');

  const sound: ZoneEvidence = input.sound
    ? (() => {
        const p = findPattern(input.sound!.soundPatterns, 'REPLAY_LOOP');
        return {
          sceneId: 'SOUND' as const,
          applicable: true,
          detected: p?.detected ?? false,
          sources: p?.detected ? ['REPLAY_LOOP'] : [],
          facts: {
            loopedSounds: (p?.facts.loopedSounds as BehaviorFact) ?? [],
            maxReplayCount: (p?.facts.maxReplayCount as BehaviorFact) ?? 0,
          },
        };
      })()
    : inapplicable('SOUND', 'no soundClues behavior record for this visit');

  /*
    v1's reasoning ("a mark is not a named thing looked at again") no longer
    holds: the Room's objects are exactly the kind of discrete, named target
    RECHECK reads elsewhere, and `objectViewPath` is built by the same
    generic view machinery LIGHT's and SENTENCE's viewPaths are — so this
    reads it on the identical terms, the same adjacent-repeat count and the
    same CROSS_SCENE_THRESHOLDS.recheckMinConsecutiveRepeats, not a new
    MEMORY-only rule. Drawing still has nothing comparable (a stroke is not
    a named thing checked again either — see PAUSE and POST_DECISION below
    for where Drawing's gap actually shows up), so this is Room-only,
    applicable on every visit that reached MEMORY at all.
  */
  const memory: ZoneEvidence = input.memory
    ? (() => {
        const counts = consecutiveRepeatCounts(input.memory!.summary.objectViewPath);
        const targets = Object.entries(counts)
          .filter(([, count]) => count >= threshold)
          .map(([id]) => id);
        return {
          sceneId: 'MEMORY' as const,
          applicable: true,
          detected: targets.length > 0,
          sources: targets.length > 0 ? ['object.viewPath (consecutive repeat)'] : [],
          facts: {
            recheckedObjects: targets,
            consecutiveRepeatCountByObject: counts,
            hasObjectViewData: input.memory!.summary.hasObjectViewData,
            threshold,
          },
        };
      })()
    : inapplicable('MEMORY', 'no memorySketch behavior record for this visit');

  const sentence: ZoneEvidence = input.sentence
    ? (() => {
        const counts = consecutiveRepeatCounts(input.sentence!.summary.viewPath);
        const targets = Object.entries(counts)
          .filter(([, count]) => count >= threshold)
          .map(([id]) => id);
        return {
          sceneId: 'SENTENCE' as const,
          applicable: true,
          detected: targets.length > 0,
          sources: targets.length > 0 ? ['sentence.viewPath (consecutive repeat)'] : [],
          facts: {
            recheckedFragments: targets,
            consecutiveRepeatCountByFragment: counts,
            hasViewData: input.sentence!.summary.hasViewData,
            threshold,
          },
        };
      })()
    : inapplicable('SENTENCE', 'no sentenceClues behavior record for this visit');

  return [light, sound, memory, sentence];
}

/* ── PAUSE ───────────────────────────────────────────────────────────────── */

function evaluatePause(input: CrossSceneInput): ZoneEvidence[] {
  /*
    LIGHT has no gap figure that is not already POST_DECISION's evidence —
    msFromFinalSelectionToCommit is the only wait it measures, and reusing it
    here would count the same wait under two different traces rather than
    observing two different things. Left unclaimed rather than duplicated.
  */
  const light: ZoneEvidence = inapplicable(
    'LIGHT',
    "LIGHT's only gap figure (last answer → NEXT) is already POST_DECISION's evidence; no separate mid-decision pause is recorded",
  );

  const sound: ZoneEvidence = input.sound
    ? (() => {
        const p = findPattern(input.sound!.positionPatterns, 'POSITION_HESITATION');
        return {
          sceneId: 'SOUND' as const,
          applicable: true,
          detected: p?.detected ?? false,
          sources: p?.detected ? ['POSITION_HESITATION'] : [],
          facts: {
            pauseCount: (p?.facts.pauseCount as BehaviorFact) ?? 0,
            longestPositionPauseMs: (p?.facts.longestPositionPauseMs as BehaviorFact) ?? 0,
            directionChangeCount: (p?.facts.directionChangeCount as BehaviorFact) ?? 0,
          },
        };
      })()
    : inapplicable('SOUND', 'no soundClues behavior record for this visit');

  const memory: ZoneEvidence = input.memory
    ? (() => {
        /*
          DELAYED_START and LONG_PAUSE are both Drawing-only figures — the
          Room has no pause pattern of its own to fall back on (no new one
          is invented here). Skipped Drawing means neither could have been
          observed this visit.
        */
        if (!input.memory!.summary.drawingEntered) {
          return inapplicable(
            'MEMORY',
            'Drawing was skipped this visit — DELAYED_START and LONG_PAUSE are both Drawing-only figures with nothing to measure without a canvas entered',
          );
        }
        const delayed = findPattern(input.memory!.patterns, 'DELAYED_START');
        const longPause = findPattern(input.memory!.patterns, 'LONG_PAUSE');
        const sources: string[] = [];
        if (delayed?.detected) sources.push('DELAYED_START');
        if (longPause?.detected) sources.push('LONG_PAUSE');
        return {
          sceneId: 'MEMORY' as const,
          applicable: true,
          detected: sources.length > 0,
          sources,
          facts: {
            msToFirstStroke: (delayed?.facts.msToFirstStroke as BehaviorFact) ?? null,
            longPauseCount: (longPause?.facts.longPauseCount as BehaviorFact) ?? 0,
          },
        };
      })()
    : inapplicable('MEMORY', 'no memorySketch behavior record for this visit');

  /*
    SENTENCE has no recorded gap-*during*-construction figure distinct from
    POST_SENTENCE_HESITATION (already POST_DECISION's evidence). Computing
    one from operation timestamps would mean deciding, for this layer alone,
    what counts as a meaningful pause between edits — a judgement
    src/lib/sentenceThresholds.ts deliberately does not make, unlike MEMORY's
    carefully-reasoned pauseMinMs. Left unclaimed rather than guessed at.
  */
  const sentence: ZoneEvidence = inapplicable(
    'SENTENCE',
    "SENTENCE has no distinct mid-construction pause figure — the only gap computed (before submitting) is already POST_DECISION's evidence",
  );

  return [light, sound, memory, sentence];
}

/* ── Composition ─────────────────────────────────────────────────────────── */

const EVALUATORS: Record<CrossSceneTraceId, (input: CrossSceneInput) => ZoneEvidence[]> = {
  RETURN: evaluateReturn,
  REVISION: evaluateRevision,
  ATTENTION_CHOICE_GAP: evaluateAttentionChoiceGap,
  POST_DECISION: evaluatePostDecision,
  RECHECK: evaluateRecheck,
  PAUSE: evaluatePause,
};

function strengthFor(detectedZoneCount: number): FindingStrength {
  if (detectedZoneCount >= CROSS_SCENE_THRESHOLDS.primaryMinZones) return 'primary';
  if (detectedZoneCount === CROSS_SCENE_THRESHOLDS.secondaryMinZones) return 'secondary';
  if (detectedZoneCount === 1) return 'observation';
  return 'none';
}

function numericFactCount(facts: Record<string, BehaviorFact>): number {
  return Object.values(facts).filter((value) => typeof value === 'number').length;
}

/**
 * Up to three zoneEvidence entries worth leading with.
 *
 * Detected-and-applicable only. Ranked by how many concrete numbers back the
 * entry, then by a fixed Zone order — never at random, so the same input
 * always picks the same evidence. Distinct Zones are automatic here, not a
 * rule to enforce separately: zoneEvidence never holds two entries for the
 * same Zone.
 */
function choosePrimaryEvidence(zoneEvidence: readonly ZoneEvidence[]): ZoneEvidence[] {
  return zoneEvidence
    .filter((zone) => zone.applicable && zone.detected)
    .slice()
    .sort((a, b) => {
      const byFacts = numericFactCount(b.facts) - numericFactCount(a.facts);
      if (byFacts !== 0) return byFacts;
      return ZONE_ORDER.indexOf(a.sceneId) - ZONE_ORDER.indexOf(b.sceneId);
    })
    .slice(0, 3);
}

function buildFinding(id: CrossSceneTraceId, zoneEvidence: ZoneEvidence[]): CrossSceneFinding {
  const detectedZoneCount = zoneEvidence.filter((zone) => zone.applicable && zone.detected).length;
  const applicableZoneCount = zoneEvidence.filter((zone) => zone.applicable).length;
  return {
    id,
    strength: strengthFor(detectedZoneCount),
    detectedZoneCount,
    applicableZoneCount,
    zoneEvidence,
    primaryEvidence: choosePrimaryEvidence(zoneEvidence),
    priority: CROSS_SCENE_THRESHOLDS.tracePriority[id],
  };
}

/**
 * Reads whatever Scene Summaries and Scene Patterns are available for this
 * visit and finds where the same shape of behaviour turns up in more than
 * one of them.
 *
 * Pure — see the module doc's note on where this sits in the pipeline. Six
 * Findings come back always, one per CrossSceneTraceId in a fixed order; a
 * trace nothing was observed for still gets a Finding with strength 'none'
 * rather than being left out, on the same principle every Scene Pattern
 * detector returns its evidence whether or not it fired.
 */
export function analyzeCrossScene(input: CrossSceneInput): CrossSceneFinding[] {
  return TRACE_ORDER.map((id) => buildFinding(id, EVALUATORS[id](input)));
}

const STRENGTH_RANK: Record<FindingStrength, number> = {
  primary: 3,
  secondary: 2,
  observation: 1,
  none: 0,
};

/**
 * A fixed reading order over whatever analyzeCrossScene returned.
 *
 * Strength first, then how many Zones agreed, then what share of the Zones
 * that could have agreed did, then the trace's own priority — with PAUSE's
 * priority set lowest of the six, so two Findings tied on everything else
 * never seat it above a better-grounded trace. Anything still tied after all
 * four falls back to CrossSceneTraceId's fixed declaration order, so the same
 * input always returns Findings in the same order.
 */
export function rankFindings(findings: readonly CrossSceneFinding[]): CrossSceneFinding[] {
  return findings.slice().sort((a, b) => {
    if (STRENGTH_RANK[a.strength] !== STRENGTH_RANK[b.strength]) {
      return STRENGTH_RANK[b.strength] - STRENGTH_RANK[a.strength];
    }
    if (a.detectedZoneCount !== b.detectedZoneCount) return b.detectedZoneCount - a.detectedZoneCount;

    const ratioA = a.applicableZoneCount > 0 ? a.detectedZoneCount / a.applicableZoneCount : 0;
    const ratioB = b.applicableZoneCount > 0 ? b.detectedZoneCount / b.applicableZoneCount : 0;
    if (ratioA !== ratioB) return ratioB - ratioA;

    if (a.priority !== b.priority) return b.priority - a.priority;
    return TRACE_ORDER.indexOf(a.id) - TRACE_ORDER.indexOf(b.id);
  });
}

export interface CrossSceneReport {
  findings: CrossSceneFinding[];
  rankedFindings: CrossSceneFinding[];
  primary: CrossSceneFinding[];
  secondary: CrossSceneFinding[];
  observations: CrossSceneFinding[];
}

/**
 * The bundle a dev console (or a future Report Narrative stage) reads.
 * Composition only — every number in it was already computed by
 * analyzeCrossScene and rankFindings above.
 */
export function buildCrossSceneReport(input: CrossSceneInput): CrossSceneReport {
  const findings = analyzeCrossScene(input);
  const rankedFindings = rankFindings(findings);
  return {
    findings,
    rankedFindings,
    primary: rankedFindings.filter((finding) => finding.strength === 'primary'),
    secondary: rankedFindings.filter((finding) => finding.strength === 'secondary'),
    observations: rankedFindings.filter((finding) => finding.strength === 'observation'),
  };
}
