/**
 * Verification harness for MEMORY v2 (the Reconstructed Room + optional
 * Free Drawing).
 *
 * Same convention as scripts/crossSceneHarness.ts: a plain assert-based
 * script (no test runner in this project), run with
 *   npx esbuild scripts/memoryV2Harness.ts --bundle --platform=node \
 *     --format=esm --outfile=/tmp/memoryV2.mjs \
 *     --loader:.mp3=empty --loader:.jpg=empty && node /tmp/memoryV2.mjs
 * (the mp3/jpg loaders stand in for Vite's asset pipeline — see
 * src/data/content.ts, which imports sound files that only Vite knows how
 * to load, and which src/lib/memoryTracking.ts now pulls in transitively
 * for MEMORY_MIN_OBJECT_SELECTION).
 *
 * Every scenario drives the real, unmodified createSceneTracker through a
 * scripted call sequence — exactly what MemorySketchScene.tsx does — then
 * the real, unmodified summarizeMemory / detectMemoryPatterns. Nothing here
 * hand-builds a MemoryBehaviorSummary or a BehaviorPattern.
 */
import { createSceneTracker } from '../src/lib/behaviorTracking';
import { MEMORY_TRACKING_GROUPS, OBJECT_GROUP, SKETCH_GROUP, summarizeMemory } from '../src/lib/memoryTracking';
import { detectMemoryPatterns } from '../src/lib/memoryPatterns';
import { MEMORY_MIN_OBJECT_SELECTION } from '../src/data/content';
import type { BehaviorPattern } from '../src/lib/behaviorPatterns';
import type { SceneBehaviorRecord } from '../src/types';

/* ── Tiny assert harness ─────────────────────────────────────────────────── */

let checks = 0;
const failures: string[] = [];

function assert(cond: boolean, msg: string) {
  checks += 1;
  if (!cond) failures.push(msg);
}

function eq<T>(actual: T, expected: T, msg: string) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function section(name: string, fn: () => void) {
  const before = failures.length;
  fn();
  const added = failures.length - before;
  console.log(added === 0 ? `  ok  ${name}` : `FAIL  ${name} (${added} failing check(s))`);
}

function pattern(patterns: BehaviorPattern[], id: string): BehaviorPattern {
  const found = patterns.find((p) => p.id === id);
  if (!found) throw new Error(`no pattern ${id}`);
  return found;
}

/* ── Clock + record builder ──────────────────────────────────────────────── */

function makeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

function memoryRecord(
  build: (t: ReturnType<typeof createSceneTracker>, c: ReturnType<typeof makeClock>) => void,
): SceneBehaviorRecord {
  const c = makeClock();
  const t = createSceneTracker('memorySketch', MEMORY_TRACKING_GROUPS, c.now);
  c.advance(300);
  build(t, c);
  return t.snapshot();
}

eq(MEMORY_MIN_OBJECT_SELECTION, 2, 'sanity: MEMORY_MIN_OBJECT_SELECTION is 2 as configured');

/* ══════════════════════════════════════════════════════════════════════════
   A. DIRECT — enter, select 2, skip Drawing.
   ══════════════════════════════════════════════════════════════════════════ */

section('A. DIRECT: no forced pattern anywhere', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup(OBJECT_GROUP);
    c.advance(300);
    t.viewStart(OBJECT_GROUP, 'window');
    c.advance(220);
    t.select(OBJECT_GROUP, 'window');
    t.viewEnd(OBJECT_GROUP, 'window');
    c.advance(300);
    t.viewStart(OBJECT_GROUP, 'lamp');
    c.advance(220);
    t.select(OBJECT_GROUP, 'lamp');
    t.viewEnd(OBJECT_GROUP, 'lamp');
    c.advance(200);
    t.commit(OBJECT_GROUP);
    // Skip Drawing: commit('sketch') with no prior openGroup.
    c.advance(100);
    t.commit(SKETCH_GROUP);
  });

  const summary = summarizeMemory(record);
  const patterns = detectMemoryPatterns(summary);

  eq(summary.finalSelectedObjects.sort(), ['lamp', 'window'], 'selected exactly the 2 clicked objects');
  eq(summary.drawingEntered, false, 'drawingEntered false — sketch group never opened');
  eq(summary.drawingUsed, false, 'drawingUsed false');

  for (const id of ['OBJECT_RETURN', 'OBJECT_ATTENTION_GAP', 'OBJECT_REVISION']) {
    assert(!pattern(patterns, id).detected, `${id} not detected on a direct visit`);
  }
  for (const id of ['DELAYED_START', 'LONG_PAUSE', 'ERASE_RETURN', 'REPEATED_REVISION', 'SPATIAL_CONCENTRATION', 'POST_DRAWING_HESITATION']) {
    const p = pattern(patterns, id);
    assert(!p.detected, `${id} not detected when Drawing was skipped`);
    eq(p.facts.drawingEntered, false, `${id} facts say drawingEntered:false, not just detected:false`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   B. RETURN — A explored, B explored, A explored again.
   ══════════════════════════════════════════════════════════════════════════ */

section('B. OBJECT_RETURN: A -> B -> A, literal single return (view-side)', () => {
  /*
    objectReturnMinViews is 2 — resolved after the Cross-Scene v2 update:
    the Room's eight objects are large, well-separated hit-areas rather than
    a dense grid, so a single deliberate A -> B -> A is read as meaningful on
    its own, unlike RETURN_LOOP's three-view threshold for LIGHT's grid. This
    fixture is the spec's example taken literally: two views of window.
  */
  const record = memoryRecord((t, c) => {
    t.openGroup(OBJECT_GROUP);
    c.advance(300);
    t.viewStart(OBJECT_GROUP, 'window');
    c.advance(250);
    t.viewEnd(OBJECT_GROUP, 'window');
    c.advance(500);
    t.viewStart(OBJECT_GROUP, 'lamp');
    c.advance(250);
    t.viewEnd(OBJECT_GROUP, 'lamp');
    c.advance(500);
    t.viewStart(OBJECT_GROUP, 'window'); // returned to window after lamp
    c.advance(250);
    t.viewEnd(OBJECT_GROUP, 'window');
    c.advance(200);
    t.select(OBJECT_GROUP, 'window');
    t.select(OBJECT_GROUP, 'lamp');
    c.advance(200);
    t.commit(OBJECT_GROUP);
    c.advance(100);
    t.commit(SKETCH_GROUP);
  });

  const summary = summarizeMemory(record);
  const patterns = detectMemoryPatterns(summary);
  const objectReturn = pattern(patterns, 'OBJECT_RETURN');

  eq(summary.viewCountByObject.window, 2, 'window viewed twice, as in the spec’s literal example');
  assert(objectReturn.detected, 'OBJECT_RETURN detected — a single A -> B -> A is enough at threshold 2');
  eq(objectReturn.facts.viewReturnedObjects, ['window'], 'window is the view-returned object');
  eq(objectReturn.facts.selectionReturns, [], 'no deselect-reselect happened in this scenario');

  // Not contaminated by REVISION or ATTENTION_GAP.
  assert(!pattern(patterns, 'OBJECT_REVISION').detected, 'no OBJECT_REVISION — nothing was deselected');
});

/* ══════════════════════════════════════════════════════════════════════════
   C. ATTENTION GAP — A explored at length, B/C selected instead.
   ══════════════════════════════════════════════════════════════════════════ */

section('C. OBJECT_ATTENTION_GAP: longest-viewed object never selected', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup(OBJECT_GROUP);
    c.advance(300);
    t.viewStart(OBJECT_GROUP, 'window');
    c.advance(4000);
    t.viewEnd(OBJECT_GROUP, 'window');
    c.advance(300);
    t.viewStart(OBJECT_GROUP, 'lamp');
    c.advance(220);
    t.select(OBJECT_GROUP, 'lamp');
    t.viewEnd(OBJECT_GROUP, 'lamp');
    c.advance(300);
    t.viewStart(OBJECT_GROUP, 'book');
    c.advance(220);
    t.select(OBJECT_GROUP, 'book');
    t.viewEnd(OBJECT_GROUP, 'book');
    c.advance(200);
    t.commit(OBJECT_GROUP);
    c.advance(100);
    t.commit(SKETCH_GROUP);
  });

  const summary = summarizeMemory(record);
  const patterns = detectMemoryPatterns(summary);
  const gap = pattern(patterns, 'OBJECT_ATTENTION_GAP');

  eq(summary.mostViewedObject, 'window', 'window has the longest dwell');
  eq(summary.finalSelectedObjects.sort(), ['book', 'lamp'], 'window was not selected');
  assert(gap.detected, 'OBJECT_ATTENTION_GAP detected');
  eq(gap.facts.mostViewedObject, 'window', 'facts name the object attention landed on');
});

/* ══════════════════════════════════════════════════════════════════════════
   D. REVISION — A/B selected, A deselected, C selected.
   ══════════════════════════════════════════════════════════════════════════ */

section('D. OBJECT_REVISION: final configuration differs from the first valid one', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup(OBJECT_GROUP);
    c.advance(300);
    t.select(OBJECT_GROUP, 'window'); // 1 selected — not yet valid
    c.advance(200);
    t.select(OBJECT_GROUP, 'lamp'); // 2 selected — first valid state: {window, lamp}
    c.advance(300);
    t.deselect(OBJECT_GROUP, 'window');
    c.advance(300);
    t.select(OBJECT_GROUP, 'book'); // final: {lamp, book}
    c.advance(200);
    t.commit(OBJECT_GROUP);
    c.advance(100);
    t.commit(SKETCH_GROUP);
  });

  const summary = summarizeMemory(record);
  const patterns = detectMemoryPatterns(summary);
  const revision = pattern(patterns, 'OBJECT_REVISION');

  eq(summary.firstValidObjectSet, ['window', 'lamp'], 'first valid state captured at the moment of the 2nd select');
  eq(summary.finalSelectedObjects.sort(), ['book', 'lamp'], 'final configuration');
  assert(revision.detected, 'OBJECT_REVISION detected');
  eq(revision.facts.addedSinceFirstValid, ['book'], 'book was added');
  eq(revision.facts.removedSinceFirstValid, ['window'], 'window was removed');

  // Accidental single click-and-undo, isolated: select+immediate deselect of
  // the same object before it even becomes part of a valid state must not
  // fire OBJECT_REVISION on its own.
  const accidental = memoryRecord((t, c) => {
    t.openGroup(OBJECT_GROUP);
    c.advance(200);
    t.select(OBJECT_GROUP, 'cup');
    c.advance(150);
    t.deselect(OBJECT_GROUP, 'cup'); // misclick, undone
    c.advance(150);
    t.select(OBJECT_GROUP, 'window');
    c.advance(150);
    t.select(OBJECT_GROUP, 'lamp'); // valid at {window, lamp}, never touched again
    c.advance(200);
    t.commit(OBJECT_GROUP);
    c.advance(100);
    t.commit(SKETCH_GROUP);
  });
  const accidentalSummary = summarizeMemory(accidental);
  const accidentalRevision = pattern(detectMemoryPatterns(accidentalSummary), 'OBJECT_REVISION');
  assert(!accidentalRevision.detected, 'a misclick undone before the valid state forms does not fire OBJECT_REVISION');
});

/* ══════════════════════════════════════════════════════════════════════════
   E. DRAWING SKIP
   ══════════════════════════════════════════════════════════════════════════ */

section('E. Drawing skipped: drawingUsed false, no drawing pattern misfires', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup(OBJECT_GROUP);
    c.advance(200);
    t.select(OBJECT_GROUP, 'chair');
    c.advance(200);
    t.select(OBJECT_GROUP, 'bag');
    c.advance(200);
    t.commit(OBJECT_GROUP);
    c.advance(50);
    t.commit(SKETCH_GROUP); // skip — no openGroup, no advanceReady
  });

  const summary = summarizeMemory(record);
  const patterns = detectMemoryPatterns(summary);

  eq(summary.drawingEntered, false, 'drawingEntered false');
  eq(summary.drawingUsed, false, 'drawingUsed false');
  eq(summary.postDrawingMs, null, 'postDrawingMs is null (nothing to gate a wait on), not zero');
  assert(!pattern(patterns, 'POST_DRAWING_HESITATION').detected, 'POST_DRAWING_HESITATION not detected');
  assert(!pattern(patterns, 'DELAYED_START').detected, 'DELAYED_START not detected');
});

/* ══════════════════════════════════════════════════════════════════════════
   F. DRAWING USED
   ══════════════════════════════════════════════════════════════════════════ */

section('F. Drawing used: drawingUsed true, existing drawing summary intact', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup(OBJECT_GROUP);
    c.advance(200);
    t.select(OBJECT_GROUP, 'chair');
    c.advance(200);
    t.select(OBJECT_GROUP, 'bag');
    c.advance(200);
    t.commit(OBJECT_GROUP);

    c.advance(200);
    t.openGroup(SKETCH_GROUP);
    t.advanceReady();
    c.advance(500);
    t.strokeStart(SKETCH_GROUP, 's1', { x: 0.2, y: 0.2 }, { tool: 'brush', color: '#c9a3ff', pointerType: 'mouse' });
    t.strokePoint(SKETCH_GROUP, { x: 0.3, y: 0.3 });
    t.strokePoint(SKETCH_GROUP, { x: 0.4, y: 0.35 });
    t.strokeEnd(SKETCH_GROUP, { discarded: false, reason: 'pointerUp' });
    c.advance(300);
    t.commit(SKETCH_GROUP);
  });

  const summary = summarizeMemory(record);
  const patterns = detectMemoryPatterns(summary);

  eq(summary.drawingEntered, true, 'drawingEntered true');
  eq(summary.drawingUsed, true, 'drawingUsed true');
  eq(summary.strokeCount, 1, 'one stroke landed');
  assert(summary.totalStrokeLength > 0, 'totalStrokeLength computed as before');
  eq(pattern(patterns, 'DELAYED_START').facts.drawingEntered, true, 'drawing patterns see drawingEntered:true here');
});

/* ══════════════════════════════════════════════════════════════════════════
   G. ERASE RETURN (existing drawing pattern, unmodified logic)
   ══════════════════════════════════════════════════════════════════════════ */

section('G. ERASE_RETURN still fires exactly as in v1', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup(OBJECT_GROUP);
    c.advance(200);
    t.select(OBJECT_GROUP, 'chair');
    c.advance(200);
    t.select(OBJECT_GROUP, 'bag');
    c.advance(200);
    t.commit(OBJECT_GROUP);

    c.advance(200);
    t.openGroup(SKETCH_GROUP);
    t.advanceReady();
    c.advance(500);
    t.strokeStart(SKETCH_GROUP, 's1', { x: 0.3, y: 0.3 }, { tool: 'brush', color: '#c9a3ff', pointerType: 'mouse' });
    t.strokePoint(SKETCH_GROUP, { x: 0.34, y: 0.34 });
    t.strokeEnd(SKETCH_GROUP, { discarded: false, reason: 'pointerUp' });
    c.advance(500);
    t.removeStrokes(SKETCH_GROUP, ['s1'], 'undo');
    c.advance(1000);
    t.strokeStart(SKETCH_GROUP, 's2', { x: 0.3, y: 0.3 }, { tool: 'brush', color: '#c9a3ff', pointerType: 'mouse' });
    t.strokePoint(SKETCH_GROUP, { x: 0.34, y: 0.34 });
    t.strokeEnd(SKETCH_GROUP, { discarded: false, reason: 'pointerUp' });
    c.advance(300);
    t.commit(SKETCH_GROUP);
  });

  const summary = summarizeMemory(record);
  const eraseReturn = pattern(detectMemoryPatterns(summary), 'ERASE_RETURN');
  assert(eraseReturn.detected, 'ERASE_RETURN detected');
  eq(summary.eraseReturnCount, 1, 'one erase-return recorded');
});

/* ══════════════════════════════════════════════════════════════════════════
   H. OLD DATA — pre-v2 persisted MemorySketchData rehydrates without crashing
   ══════════════════════════════════════════════════════════════════════════ */

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

async function testOldDataRehydrate() {
  const mockStorage = new MemoryStorage();
  const oldBlob = {
    state: {
      memorySketch: {
        strokes: [
          {
            id: 'STROKE_01',
            color: '#7fa7d9',
            width: 5,
            points: [
              { x: 0.2, y: 0.2 },
              { x: 0.4, y: 0.4 },
            ],
          },
        ],
        emptyAreaRatio: 0.87,
        lastInputAt: 1_700_000_000_000,
        // No roomVariant / selectedObjects / drawingUsed / selectedColors —
        // this is exactly what v1 persisted.
      },
    },
    version: 0,
  };
  mockStorage.setItem('unanswered-experience-v2', JSON.stringify(oldBlob));
  // zustand's default persist storage reads `window.localStorage`, not a
  // bare `localStorage` — both are set so the real code path is exercised
  // rather than silently falling back to defaults inside zustand's own
  // try/catch around a missing `window`.
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = mockStorage;
  (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = {
    localStorage: mockStorage,
  };

  let threw: unknown = null;
  let memorySketch: unknown = null;
  try {
    const mod = await import('../src/store/experienceStore');
    memorySketch = mod.useExperienceStore.getState().memorySketch;
  } catch (error) {
    threw = error;
  }

  section('H. OLD DATA: rehydrate does not crash and backfills v2 fields', () => {
    assert(threw === null, `rehydrating pre-v2 data did not throw${threw ? `: ${String(threw)}` : ''}`);
    const ms = memorySketch as {
      strokes: unknown[];
      roomVariant: string;
      selectedObjects: string[];
      drawingUsed: boolean;
      selectedColors: string[];
    };
    assert(!!ms, 'memorySketch is defined after rehydrate');
    if (!ms) return;
    eq(ms.strokes.length, 1, 'old strokes preserved');
    eq(ms.roomVariant, 'default', 'roomVariant backfilled');
    eq(ms.selectedObjects, [], 'selectedObjects backfilled to empty — no Room existed for this old visit');
    eq(ms.drawingUsed, true, 'drawingUsed inferred true from the presence of old strokes');
    eq(ms.selectedColors, ['#7fa7d9'], 'selectedColors backfilled from the old strokes');
  });
}

await testOldDataRehydrate();

/* ══════════════════════════════════════════════════════════════════════════
   Extra edge cases
   ══════════════════════════════════════════════════════════════════════════ */

section('edge: selection-side OBJECT_RETURN (deselect then reselect)', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup(OBJECT_GROUP);
    c.advance(200);
    t.select(OBJECT_GROUP, 'cup');
    c.advance(200);
    t.select(OBJECT_GROUP, 'photo'); // valid at {cup, photo}
    c.advance(300);
    t.deselect(OBJECT_GROUP, 'cup');
    c.advance(1000);
    t.select(OBJECT_GROUP, 'cup'); // returned to
    c.advance(200);
    t.commit(OBJECT_GROUP);
    c.advance(100);
    t.commit(SKETCH_GROUP);
  });
  const summary = summarizeMemory(record);
  const objectReturn = pattern(detectMemoryPatterns(summary), 'OBJECT_RETURN');
  assert(objectReturn.detected, 'OBJECT_RETURN detected on the selection side');
  eq(summary.returnedObjects, ['cup'], 'cup recorded as the returned object');
  eq(summary.objectReturnCount, 1, 'one selection return');
});

section('edge: Room left before reaching MEMORY_MIN_OBJECT_SELECTION does not crash', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup(OBJECT_GROUP);
    c.advance(200);
    t.viewStart(OBJECT_GROUP, 'window');
    c.advance(200);
    t.viewEnd(OBJECT_GROUP, 'window');
    // Zone abandoned mid-Room: no select ever reached, no commit.
  });
  const summary = summarizeMemory(record);
  eq(summary.firstValidObjectSet, null, 'no first valid state ever reached');
  const revision = pattern(detectMemoryPatterns(summary), 'OBJECT_REVISION');
  assert(!revision.detected, 'OBJECT_REVISION not detected — nothing to compare');
  eq(revision.facts.reachedFirstValidState, false, 'facts say why: never reached');
  assert(summary.drawingEntered === false, 'drawingEntered false — sketch group never touched at all');
});

section('edge: touchscreen visit (no hover data) does not misread as no attention', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup(OBJECT_GROUP);
    c.advance(200);
    t.select(OBJECT_GROUP, 'window'); // tap-to-select, no hover/focus ever fired
    c.advance(200);
    t.select(OBJECT_GROUP, 'lamp');
    c.advance(200);
    t.commit(OBJECT_GROUP);
    c.advance(100);
    t.commit(SKETCH_GROUP);
  });
  const summary = summarizeMemory(record);
  eq(summary.hasObjectViewData, false, 'no view data on a touch-only visit');
  const gap = pattern(detectMemoryPatterns(summary), 'OBJECT_ATTENTION_GAP');
  assert(!gap.detected, 'OBJECT_ATTENTION_GAP false — but for lack of data, not lack of attention');
  eq(gap.facts.hasObjectViewData, false, 'facts carry the disambiguating flag');
});

section('edge: determinism — same input twice gives identical summary and patterns', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup(OBJECT_GROUP);
    c.advance(300);
    t.select(OBJECT_GROUP, 'window');
    c.advance(300);
    t.select(OBJECT_GROUP, 'lamp');
    c.advance(200);
    t.commit(OBJECT_GROUP);
    c.advance(100);
    t.commit(SKETCH_GROUP);
  });
  const a = detectMemoryPatterns(summarizeMemory(record));
  const b = detectMemoryPatterns(summarizeMemory(record));
  eq(a, b, 'repeated summarize+detect on the same record is byte-identical');
});

/* ══════════════════════════════════════════════════════════════════════════
   Result
   ══════════════════════════════════════════════════════════════════════════ */

console.log(`\nMEMORY v2 harness: ${checks} checks / ${failures.length} failures`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
