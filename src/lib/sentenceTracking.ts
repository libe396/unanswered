/**
 * SENTENCE's derived layer.
 *
 * The other Zones record an answer and how it was arrived at. This one records
 * an answer that was *assembled*, which makes the arriving and the answer the
 * same material: a sentence is an ordered list, and every intermediate list the
 * visitor passed through is as real as the one they stopped on.
 *
 * So the raw log holds operations — put this in, take that out, move this one —
 * and the sentence at any moment is replayed from them here. Nothing stores the
 * list as it stood. That is not only tidiness: a log of snapshots taken under
 * one definition of "an edit" cannot be re-read under a better one, and the
 * whole arrangement of this codebase exists so that it can be.
 *
 * As everywhere else, nothing below reads the sentence. Which fragments were
 * used, in which order, after how many changes of mind — all recorded. What the
 * assembled sentence *means*, and what choosing '떠났다' over '기억한다' says
 * about anybody, is exactly the part the exhibition is about not answering.
 */
import { summarizeScene } from './behaviorTracking';
import type { GroupSummary } from './behaviorTracking';
import { SENTENCE_MIN_FRAGMENTS } from '../data/content';
import type { BehaviorSelectionMode, SceneBehaviorRecord, SceneId } from '../types';

/**
 * The one question this Zone asks.
 *
 * `multi` because the answer is a set of fragments — though nothing here uses
 * the select/deselect machinery that mode normally implies, since a selection
 * has no position and position is most of what is being decided.
 */
export const SENTENCE_TRACKING_GROUPS: Record<string, BehaviorSelectionMode> = {
  sentence: 'multi',
};

export const SENTENCE_GROUP = 'sentence';

export type SentenceOperationKind = 'add' | 'remove' | 'reorder';

export interface SentenceOperation {
  /** Position in the sequence of operations, from 0. */
  step: number;
  at: number;
  kind: SentenceOperationKind;
  fragmentId: string;
  fromIndex: number | null;
  toIndex: number | null;
  /**
   * The sentence as it stood immediately after this operation.
   *
   * Replayed, never recorded — see the note at the top of the file. It is put
   * on the operation because almost everything downstream wants to ask "and
   * what did it read then", and replaying it once here is cheaper and less
   * error-prone than every caller doing it again.
   */
  orderAfter: string[];
  /** Whether the sentence could be submitted at this point. */
  validAfter: boolean;
}

export interface FragmentReturn {
  fragmentId: string;
  removedAt: number;
  returnedAt: number;
  timeGapMs: number;
  /** What the sentence read just before the fragment was taken out. */
  sentenceBeforeRemoval: string[];
  /** …and just after it was put back. */
  orderAfterReturn: string[];
  /** Operations that happened in between. */
  operationsBetween: number;
}

export interface SentenceBehaviorSummary {
  sceneId: SceneId;
  sceneEnteredAt: number;
  /** When the archive and the reconstruction area appeared. */
  openedAt: number | null;
  committedAt: number | null;
  advanceReadyAt: number | null;

  /* ── Exploration ───────────────────────────────────────────────────────── */
  dwellMsByFragment: Record<string, number>;
  viewCountByFragment: Record<string, number>;
  revisitCountByFragment: Record<string, number>;
  viewPath: string[];
  firstViewedFragment: string | null;
  longestViewedFragment: string | null;
  viewedFragments: string[];
  /** Looked at, never put into the sentence that was submitted. */
  viewedButUnusedFragments: string[];
  /**
   * Whether any looking was recorded at all.
   *
   * A visitor on a touchscreen has no pointer to rest, so the exploration
   * figures above will be empty or thin however carefully they read. Anything
   * reading this summary should check here before treating an absence of
   * looking as a fact about the person rather than about the device.
   */
  hasViewData: boolean;

  /* ── Construction ──────────────────────────────────────────────────────── */
  operations: SentenceOperation[];
  firstAddedFragment: string | null;
  finalFragments: string[];
  /** Every fragment put in, in order, repeats included. */
  addPath: string[];
  /** Every fragment taken out, in order. */
  removePath: string[];
  reorderCount: number;
  addCount: number;
  removeCount: number;
  uniqueFragmentsUsed: number;
  /** Every operation of any kind. */
  constructionChangeCount: number;
  /** Removals and reorders — changes to what was already there. */
  rewriteCount: number;
  /** Put in at some point, absent from the submitted sentence. */
  addedButDroppedFragments: string[];

  /* ── Going back ────────────────────────────────────────────────────────── */
  removedThenReturnedFragments: FragmentReturn[];
  returnedFragments: string[];
  fragmentReturnCount: number;

  /* ── Time ──────────────────────────────────────────────────────────────── */
  /** Area appearing → the first fragment looked at. */
  msToFirstFragment: number | null;
  /** Area appearing → the first fragment put in. */
  msToFirstAdd: number | null;
  /** First operation → last operation. */
  constructionTime: number | null;
  /** Area appearing → the sentence first being long enough to submit. */
  msToFirstValidSentence: number | null;
  msFromValidSentenceToCommit: number | null;
  msFromLastEditToCommit: number | null;

  /* ── Revision after the sentence could have been submitted ─────────────── */
  firstValidAt: number | null;
  operationsAfterFirstValid: SentenceOperation[];
  editsAfterFirstValidSentence: number;
  additionsAfterFirstValidSentence: number;
  removalsAfterFirstValidSentence: number;
  reordersAfterFirstValidSentence: number;
  /**
   * How many times the sentence became long enough to submit.
   *
   * More than one means it dropped back under the minimum and was built up
   * again. Only the first crossing anchors the figures above.
   */
  becameValidCount: number;
  /** The sentence as it first stood when it could have been submitted. */
  firstValidOrder: string[];
  /** Whether the submitted order differs from that one. */
  orderChangedSinceFirstValid: boolean;

  lastEditAt: number | null;
  eventCount: number;
}

const EMPTY_GROUP: Pick<GroupSummary, 'openedAt' | 'committedAt'> = {
  openedAt: null,
  committedAt: null,
};

export function summarizeSentence(record: SceneBehaviorRecord): SentenceBehaviorSummary {
  const scene = summarizeScene(record);
  const group = scene.groups[SENTENCE_GROUP] ?? EMPTY_GROUP;
  const openedAt = group.openedAt;
  const committedAt = group.committedAt;

  /* ── Exploration, on exactly LIGHT's terms ──────────────────────────────── */

  const dwellMsByFragment: Record<string, number> = {};
  const viewCountByFragment: Record<string, number> = {};
  const revisitCountByFragment: Record<string, number> = {};
  const viewPath: string[] = [];
  const viewedFragments: string[] = [];
  let firstViewAt: number | null = null;

  /* ── Construction ───────────────────────────────────────────────────────── */

  const operations: SentenceOperation[] = [];
  const addPath: string[] = [];
  const removePath: string[] = [];
  // The sentence as it stands, rebuilt operation by operation.
  const order: string[] = [];
  let becameValidCount = 0;
  let wasValid = false;
  let firstValidAt: number | null = null;
  let firstValidOrder: string[] = [];

  // Where each fragment was last taken out, so putting it back can be paired
  // with the removal it undoes rather than with any earlier one.
  const removedAt = new Map<string, { at: number; sentenceBefore: string[]; step: number }>();
  const removedThenReturnedFragments: FragmentReturn[] = [];

  for (const event of record.events) {
    if (event.type === 'view' && event.group === SENTENCE_GROUP) {
      const { targetId, durationMs } = event;
      dwellMsByFragment[targetId] = (dwellMsByFragment[targetId] ?? 0) + durationMs;
      viewCountByFragment[targetId] = (viewCountByFragment[targetId] ?? 0) + 1;
      revisitCountByFragment[targetId] = viewCountByFragment[targetId] - 1;
      viewPath.push(targetId);
      if (!viewedFragments.includes(targetId)) viewedFragments.push(targetId);
      if (firstViewAt === null) firstViewAt = event.at;
      continue;
    }

    if (event.type !== 'fragmentAdd' && event.type !== 'fragmentRemove' && event.type !== 'fragmentReorder') {
      continue;
    }
    if (event.group !== SENTENCE_GROUP) continue;

    const step = operations.length;
    let kind: SentenceOperationKind;
    let fromIndex: number | null = null;
    let toIndex: number | null = null;

    if (event.type === 'fragmentAdd') {
      kind = 'add';
      toIndex = event.index;
      // Clamped rather than trusted: an index past the end would otherwise
      // silently drop the fragment out of the replayed sentence.
      order.splice(Math.min(Math.max(0, event.index), order.length), 0, event.fragmentId);
      addPath.push(event.fragmentId);

      const removal = removedAt.get(event.fragmentId);
      if (removal) {
        removedAt.delete(event.fragmentId);
        removedThenReturnedFragments.push({
          fragmentId: event.fragmentId,
          removedAt: removal.at,
          returnedAt: event.at,
          timeGapMs: event.at - removal.at,
          sentenceBeforeRemoval: removal.sentenceBefore,
          orderAfterReturn: [...order],
          operationsBetween: step - removal.step - 1,
        });
      }
    } else if (event.type === 'fragmentRemove') {
      kind = 'remove';
      fromIndex = event.index;
      const sentenceBefore = [...order];
      const at = order.indexOf(event.fragmentId);
      if (at !== -1) order.splice(at, 1);
      removePath.push(event.fragmentId);
      removedAt.set(event.fragmentId, { at: event.at, sentenceBefore, step });
    } else {
      kind = 'reorder';
      fromIndex = event.fromIndex;
      toIndex = event.toIndex;
      const at = order.indexOf(event.fragmentId);
      if (at !== -1) {
        order.splice(at, 1);
        order.splice(Math.min(Math.max(0, event.toIndex), order.length), 0, event.fragmentId);
      }
    }

    const validAfter = order.length >= SENTENCE_MIN_FRAGMENTS;
    if (validAfter && !wasValid) {
      becameValidCount += 1;
      if (firstValidAt === null) {
        firstValidAt = event.at;
        firstValidOrder = [...order];
      }
    }
    wasValid = validAfter;

    operations.push({
      step,
      at: event.at,
      kind,
      fragmentId: event.fragmentId,
      fromIndex,
      toIndex,
      orderAfter: [...order],
      validAfter,
    });
  }

  const finalFragments = [...order];
  const addCount = operations.filter((op) => op.kind === 'add').length;
  const removeCount = operations.filter((op) => op.kind === 'remove').length;
  const reorderCount = operations.filter((op) => op.kind === 'reorder').length;

  let longestViewedFragment: string | null = null;
  let longestMs = -1;
  for (const [fragmentId, ms] of Object.entries(dwellMsByFragment)) {
    if (ms > longestMs) {
      longestMs = ms;
      longestViewedFragment = fragmentId;
    }
  }

  const firstOp = operations[0] ?? null;
  const lastOp = operations[operations.length - 1] ?? null;
  const firstAdd = operations.find((op) => op.kind === 'add') ?? null;
  const operationsAfterFirstValid =
    firstValidAt === null ? [] : operations.filter((op) => op.at > firstValidAt);

  return {
    sceneId: record.sceneId,
    sceneEnteredAt: record.sceneEnteredAt,
    openedAt,
    committedAt,
    advanceReadyAt: scene.advanceReadyAt,

    dwellMsByFragment,
    viewCountByFragment,
    revisitCountByFragment,
    viewPath,
    firstViewedFragment: viewPath[0] ?? null,
    longestViewedFragment,
    viewedFragments,
    viewedButUnusedFragments: viewedFragments.filter((id) => !finalFragments.includes(id)),
    hasViewData: viewPath.length > 0,

    operations,
    firstAddedFragment: firstAdd?.fragmentId ?? null,
    finalFragments,
    addPath,
    removePath,
    reorderCount,
    addCount,
    removeCount,
    uniqueFragmentsUsed: new Set(addPath).size,
    constructionChangeCount: operations.length,
    // Removals and reorders only. Putting another fragment into a sentence
    // that is still being built is building it; taking one out or moving one
    // is changing something that was already decided.
    rewriteCount: removeCount + reorderCount,
    addedButDroppedFragments: [...new Set(addPath)].filter((id) => !finalFragments.includes(id)),

    removedThenReturnedFragments,
    returnedFragments: [...new Set(removedThenReturnedFragments.map((r) => r.fragmentId))],
    fragmentReturnCount: removedThenReturnedFragments.length,

    msToFirstFragment: openedAt !== null && firstViewAt !== null ? firstViewAt - openedAt : null,
    msToFirstAdd: openedAt !== null && firstAdd ? firstAdd.at - openedAt : null,
    constructionTime: firstOp && lastOp ? lastOp.at - firstOp.at : null,
    msToFirstValidSentence: openedAt !== null && firstValidAt !== null ? firstValidAt - openedAt : null,
    msFromValidSentenceToCommit:
      committedAt !== null && firstValidAt !== null ? committedAt - firstValidAt : null,
    msFromLastEditToCommit: committedAt !== null && lastOp ? committedAt - lastOp.at : null,

    firstValidAt,
    operationsAfterFirstValid,
    editsAfterFirstValidSentence: operationsAfterFirstValid.length,
    additionsAfterFirstValidSentence: operationsAfterFirstValid.filter((op) => op.kind === 'add').length,
    removalsAfterFirstValidSentence: operationsAfterFirstValid.filter((op) => op.kind === 'remove').length,
    reordersAfterFirstValidSentence: operationsAfterFirstValid.filter((op) => op.kind === 'reorder').length,
    becameValidCount,
    firstValidOrder,
    orderChangedSinceFirstValid:
      firstValidOrder.length > 0 && firstValidOrder.join(' ') !== finalFragments.join(' '),

    lastEditAt: lastOp?.at ?? null,
    eventCount: record.events.length,
  };
}
