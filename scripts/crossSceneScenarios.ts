/**
 * Semantic validation for Cross-Scene Behavioral Analysis v2.
 *
 * Builds synthetic visitor scenarios, each driving the *real*
 * createSceneTracker through a scripted call sequence, then the real
 * per-Zone summarize/detect functions, then the *real, unmodified*
 * analyzeCrossScene / rankFindings. Nothing here hand-builds a
 * CrossSceneFinding or a Summary object — every number below came out of the
 * actual pipeline.
 *
 * Two parts: scenarios A–E (qualitative, printed in full — this is the
 * "does the ranked read make sense" check) and M1–M8 (MEMORY v2's Room +
 * optional Drawing, asserted pass/fail — this is "does the Room's evidence
 * actually reach Cross-Scene, and does skipping Drawing behave correctly").
 *
 * This script does not alter crossSceneAnalysis.ts, crossSceneThresholds.ts,
 * or any Zone tracking/pattern file. It only constructs input and checks
 * what the unmodified pipeline returns.
 *
 * Run: npx esbuild scripts/crossSceneScenarios.ts --bundle --platform=node \
 *        --format=esm --outfile=/tmp/scenarios.mjs \
 *        --loader:.mp3=empty --loader:.jpg=empty && node /tmp/scenarios.mjs
 * (Plain `npx tsx` fails: src/data/content.ts imports .mp3 assets that only
 * Vite's own asset pipeline knows how to load; the empty-loader bundle step
 * stands in for that, exactly as documented in scripts/crossSceneHarness.ts.)
 */
import { createSceneTracker, summarizeScene } from '../src/lib/behaviorTracking';
import { detectPatterns } from '../src/lib/behaviorPatterns';
import { summarizeSound } from '../src/lib/soundTracking';
import { detectSoundPatterns } from '../src/lib/soundPatterns';
import { detectPositionPatterns } from '../src/lib/positionPatterns';
import { summarizeMemory } from '../src/lib/memoryTracking';
import { detectMemoryPatterns } from '../src/lib/memoryPatterns';
import { summarizeSentence } from '../src/lib/sentenceTracking';
import { detectSentencePatterns } from '../src/lib/sentencePatterns';
import {
  analyzeCrossScene,
  buildCrossSceneReport,
  rankFindings,
  type CrossSceneFinding,
  type CrossSceneInput,
  type CrossSceneTraceId,
  type ZoneEvidence,
} from '../src/lib/crossSceneAnalysis';
import { buildReportModel } from '../src/lib/reportEngine';
import { REPORT_THRESHOLDS } from '../src/lib/reportThresholds';
import type { SceneBehaviorRecord } from '../src/types';

/* ── Clock + record builders (identical convention to crossSceneHarness.ts) ── */

function makeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

function lightRecord(build: (t: ReturnType<typeof createSceneTracker>, c: ReturnType<typeof makeClock>) => void): SceneBehaviorRecord {
  const c = makeClock();
  const t = createSceneTracker('lightArchive', { image: 'single', emotion: 'multi' }, c.now);
  c.advance(300);
  t.openGroup('image');
  build(t, c);
  return t.snapshot();
}

function soundRecord(build: (t: ReturnType<typeof createSceneTracker>, c: ReturnType<typeof makeClock>) => void): SceneBehaviorRecord {
  const c = makeClock();
  const t = createSceneTracker('soundClues', { sound: 'single', position: 'single' }, c.now);
  c.advance(300);
  t.openGroup('sound');
  build(t, c);
  return t.snapshot();
}

/**
 * v2: 'object' (the Room) and 'sketch' (optional Drawing), neither opened
 * automatically — a real visit opens 'object' on entering the Room and
 * 'sketch' only if Drawing is actually chosen, exactly as
 * MemorySketchScene.tsx does, so each fixture below calls openGroup itself
 * at the point that matches what it is testing.
 */
function memoryRecord(build: (t: ReturnType<typeof createSceneTracker>, c: ReturnType<typeof makeClock>) => void): SceneBehaviorRecord {
  const c = makeClock();
  const t = createSceneTracker('memorySketch', { object: 'multi', sketch: 'single' }, c.now);
  c.advance(300);
  build(t, c);
  return t.snapshot();
}

/* ── Tiny assert harness, for the M1–M8 section (same convention as
   scripts/crossSceneHarness.ts) ─────────────────────────────────────────── */

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

function findingFor(findings: CrossSceneFinding[], id: CrossSceneTraceId): CrossSceneFinding {
  const found = findings.find((f) => f.id === id);
  if (!found) throw new Error(`no finding for ${id}`);
  return found;
}

function zoneOf(finding: CrossSceneFinding, sceneId: string): ZoneEvidence {
  const zone = finding.zoneEvidence.find((z) => z.sceneId === sceneId);
  if (!zone) throw new Error(`no zone evidence for ${sceneId} in ${finding.id}`);
  return zone;
}

const EMPTY_INPUT: CrossSceneInput = { light: null, sound: null, memory: null, sentence: null };

function sentenceRecord(build: (t: ReturnType<typeof createSceneTracker>, c: ReturnType<typeof makeClock>) => void): SceneBehaviorRecord {
  const c = makeClock();
  const t = createSceneTracker('sentenceClues', { sentence: 'multi' }, c.now);
  c.advance(300);
  t.openGroup('sentence');
  build(t, c);
  return t.snapshot();
}

function toLightInput(record: SceneBehaviorRecord): CrossSceneInput['light'] {
  const scene = summarizeScene(record);
  const imageGroup = scene.groups.image;
  if (!imageGroup) return null;
  const emotionGroup = scene.groups.emotion ?? null;
  return {
    imageGroup,
    emotionGroup,
    imagePatterns: detectPatterns(imageGroup),
    emotionPatterns: emotionGroup ? detectPatterns(emotionGroup) : null,
  };
}

function toSoundInput(record: SceneBehaviorRecord): CrossSceneInput['sound'] {
  const summary = summarizeSound(record);
  return {
    summary,
    soundPatterns: detectSoundPatterns(summary),
    positionPatterns: detectPositionPatterns(summary),
  };
}

function toMemoryInput(record: SceneBehaviorRecord): CrossSceneInput['memory'] {
  const summary = summarizeMemory(record);
  return { summary, patterns: detectMemoryPatterns(summary) };
}

function toSentenceInput(record: SceneBehaviorRecord): CrossSceneInput['sentence'] {
  const summary = summarizeSentence(record);
  return { summary, patterns: detectSentencePatterns(summary) };
}

/* ══════════════════════════════════════════════════════════════════════════
   A. DIRECT — keeps the first choice everywhere, almost no revisit/revision.
   ══════════════════════════════════════════════════════════════════════════ */

const A_light = lightRecord((t, c) => {
  c.advance(300);
  t.viewStart('image', 'IMG_01');
  c.advance(220);
  t.viewEnd('image', 'IMG_01');
  t.select('image', 'IMG_01');
  c.advance(150);
  t.commit('image');
  t.openGroup('emotion');
  c.advance(300);
  t.setSelection('emotion', ['calm']);
  c.advance(150);
  t.commit('emotion');
});

const A_sound = soundRecord((t, c) => {
  c.advance(200);
  t.playStart('sound', 'SND_01', 0);
  c.advance(2000);
  t.playStop('sound', 'SND_01', { fromMs: 0, toMs: 2000, durationMs: 5200, reason: 'paused' });
  t.select('sound', 'SND_01');
  c.advance(150);
  t.commit('sound');
  t.openGroup('position');
  c.advance(150);
  t.advanceReady();
  t.positionStart('position', { x: 0.3, y: 0.3 }, { gesture: 'place', pointerType: 'mouse' });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(150);
  t.commit('position');
});

const A_memory = memoryRecord((t, c) => {
  // Room: straight to two objects, no revisit, no revision. Drawing skipped.
  t.openGroup('object');
  c.advance(200);
  t.select('object', 'window');
  c.advance(200);
  t.select('object', 'lamp');
  c.advance(200);
  t.commit('object');
  c.advance(100);
  t.commit('sketch');
});

const A_sentence = sentenceRecord((t, c) => {
  c.advance(300);
  t.fragmentAdd('sentence', 'F1', 0);
  c.advance(300);
  t.fragmentAdd('sentence', 'F2', 1);
  c.advance(300);
  t.fragmentAdd('sentence', 'F3', 2);
  c.advance(300);
  t.commit('sentence');
});

/* ══════════════════════════════════════════════════════════════════════════
   B. RETURNING — A→B→A / 03→05→03 / undo-then-redraw-nearby / remove-then-re-add.
   ══════════════════════════════════════════════════════════════════════════ */

const B_light = lightRecord((t, c) => {
  c.advance(300);
  t.viewStart('image', 'IMG_A');
  c.advance(250);
  t.viewEnd('image', 'IMG_A');
  c.advance(500);
  t.viewStart('image', 'IMG_B');
  c.advance(250);
  t.viewEnd('image', 'IMG_B');
  c.advance(500);
  t.select('image', 'IMG_A');
  t.select('image', 'IMG_B');
  t.viewStart('image', 'IMG_A');
  c.advance(250);
  t.viewEnd('image', 'IMG_A');
  c.advance(500);
  t.viewStart('image', 'IMG_A');
  c.advance(250);
  t.viewEnd('image', 'IMG_A');
  t.select('image', 'IMG_A'); // A -> B -> A
  c.advance(200);
  t.commit('image');
  t.openGroup('emotion');
  c.advance(300);
  t.setSelection('emotion', ['calm']);
  c.advance(150);
  t.commit('emotion');
});

const B_sound = soundRecord((t, c) => {
  c.advance(200);
  t.playStart('sound', 'SND_03', 0);
  c.advance(1000);
  t.playStop('sound', 'SND_03', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
  c.advance(200);
  t.playStart('sound', 'SND_05', 0);
  c.advance(1000);
  t.playStop('sound', 'SND_05', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
  c.advance(200);
  t.playStart('sound', 'SND_03', 0); // 03 -> 05 -> 03
  c.advance(1000);
  t.playStop('sound', 'SND_03', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
  t.select('sound', 'SND_03');
  c.advance(150);
  t.commit('sound');
  t.openGroup('position');
  c.advance(150);
  t.advanceReady();
  t.positionStart('position', { x: 0.3, y: 0.3 }, { gesture: 'place', pointerType: 'mouse' });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(150);
  t.commit('position');
});

const B_memory = memoryRecord((t, c) => {
  // Room: window -> lamp -> window again (OBJECT_RETURN, view-side).
  // Drawing skipped, so this exercises the Room's own RETURN evidence only.
  t.openGroup('object');
  c.advance(300);
  t.viewStart('object', 'window');
  c.advance(250);
  t.viewEnd('object', 'window');
  c.advance(500);
  t.viewStart('object', 'lamp');
  c.advance(250);
  t.viewEnd('object', 'lamp');
  c.advance(500);
  t.viewStart('object', 'window'); // returned to window after lamp
  c.advance(250);
  t.viewEnd('object', 'window');
  c.advance(200);
  t.select('object', 'window');
  t.select('object', 'lamp');
  c.advance(200);
  t.commit('object');
  c.advance(100);
  t.commit('sketch');
});

const B_sentence = sentenceRecord((t, c) => {
  c.advance(300);
  t.fragmentAdd('sentence', 'F1', 0);
  c.advance(300);
  t.fragmentAdd('sentence', 'F2', 1);
  c.advance(300);
  t.fragmentRemove('sentence', 'F1', 0); // removed
  c.advance(1000);
  t.fragmentAdd('sentence', 'F1', 1); // re-added
  c.advance(300);
  t.fragmentAdd('sentence', 'F3', 2);
  c.advance(300);
  t.commit('sentence');
});

/* ══════════════════════════════════════════════════════════════════════════
   C. REVISING — settled selection change / meaningful position move / repeated
      undo-clear / repeated reorder-remove. None of these return to the start.
   ══════════════════════════════════════════════════════════════════════════ */

const C_light = lightRecord((t, c) => {
  c.advance(300);
  t.select('image', 'IMG_A');
  c.advance(300);
  t.select('image', 'IMG_B'); // settles on B, never goes back to A
  c.advance(200);
  t.commit('image');
  t.openGroup('emotion');
  c.advance(300);
  t.setSelection('emotion', ['calm']);
  c.advance(150);
  t.commit('emotion');
});

const C_sound = soundRecord((t, c) => {
  c.advance(200);
  t.playStart('sound', 'SND_01', 0);
  c.advance(1000);
  t.playStop('sound', 'SND_01', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
  t.select('sound', 'SND_01');
  c.advance(150);
  t.commit('sound');
  t.openGroup('position');
  c.advance(150);
  t.positionStart('position', { x: 0.1, y: 0.1 }, { gesture: 'place', pointerType: 'mouse' });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(150);
  t.positionStart('position', { x: 0.4, y: 0.1 }, { gesture: 'drag', pointerType: 'mouse' }); // moves far, stays
  t.positionMove('position', { x: 0.4, y: 0.1 });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(150);
  t.advanceReady();
  c.advance(150);
  t.commit('position');
});

const C_memory = memoryRecord((t, c) => {
  // Room: {window, lamp} valid, then window swapped for book (OBJECT_REVISION).
  // Drawing skipped.
  t.openGroup('object');
  c.advance(200);
  t.select('object', 'window');
  c.advance(200);
  t.select('object', 'lamp'); // valid at {window, lamp}
  c.advance(300);
  t.deselect('object', 'window');
  c.advance(300);
  t.select('object', 'book'); // final: {lamp, book} — never returns to window
  c.advance(200);
  t.commit('object');
  c.advance(100);
  t.commit('sketch');
});

const C_sentence = sentenceRecord((t, c) => {
  c.advance(300);
  t.fragmentAdd('sentence', 'F1', 0);
  c.advance(300);
  t.fragmentAdd('sentence', 'F2', 1);
  c.advance(300);
  t.fragmentAdd('sentence', 'F3', 2);
  c.advance(300);
  t.fragmentReorder('sentence', 'F3', 2, 0); // reorder
  c.advance(300);
  t.fragmentRemove('sentence', 'F2', 1); // remove, never re-added
  c.advance(300);
  t.fragmentAdd('sentence', 'F4', 1);
  c.advance(300);
  t.fragmentRemove('sentence', 'F4', 1); // remove, never re-added -> rewriteCount = 3
  c.advance(300);
  t.commit('sentence');
});

/* ══════════════════════════════════════════════════════════════════════════
   D. ATTENTION_GAP — longest-looked-at / longest-listened-to / most-explored
      fragment is not what ended up chosen.
   ══════════════════════════════════════════════════════════════════════════ */

const D_light = lightRecord((t, c) => {
  c.advance(300);
  t.viewStart('image', 'IMG_LONG');
  c.advance(3000);
  t.viewEnd('image', 'IMG_LONG');
  c.advance(300);
  t.viewStart('image', 'IMG_CHOSEN');
  c.advance(220);
  t.viewEnd('image', 'IMG_CHOSEN');
  t.select('image', 'IMG_CHOSEN');
  c.advance(200);
  t.commit('image');
  t.openGroup('emotion');
  c.advance(300);
  t.setSelection('emotion', ['calm']);
  c.advance(150);
  t.commit('emotion');
});

const D_sound = soundRecord((t, c) => {
  c.advance(200);
  t.playStart('sound', 'SND_LONG', 0);
  c.advance(4000);
  t.playStop('sound', 'SND_LONG', { fromMs: 0, toMs: 4000, durationMs: 5200, reason: 'paused' });
  c.advance(150);
  t.playStart('sound', 'SND_CHOSEN', 0);
  c.advance(1000);
  t.playStop('sound', 'SND_CHOSEN', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
  t.select('sound', 'SND_CHOSEN');
  c.advance(150);
  t.commit('sound');
  t.openGroup('position');
  c.advance(150);
  t.positionStart('position', { x: 0.3, y: 0.3 }, { gesture: 'place', pointerType: 'mouse' });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(150);
  t.commit('position');
});

const D_memory = memoryRecord((t, c) => {
  // Room: window explored at length, lamp + book chosen instead (OBJECT_ATTENTION_GAP).
  t.openGroup('object');
  c.advance(300);
  t.viewStart('object', 'window');
  c.advance(4000);
  t.viewEnd('object', 'window');
  c.advance(300);
  t.viewStart('object', 'lamp');
  c.advance(220);
  t.select('object', 'lamp');
  t.viewEnd('object', 'lamp');
  c.advance(300);
  t.viewStart('object', 'book');
  c.advance(220);
  t.select('object', 'book');
  t.viewEnd('object', 'book');
  c.advance(200);
  t.commit('object');
  c.advance(100);
  t.commit('sketch');
});

const D_sentence = sentenceRecord((t, c) => {
  c.advance(300);
  t.viewStart('sentence', 'F_UNUSED');
  c.advance(3000); // long single dwell, never added
  t.viewEnd('sentence', 'F_UNUSED');
  c.advance(300);
  t.fragmentAdd('sentence', 'F1', 0);
  c.advance(300);
  t.fragmentAdd('sentence', 'F2', 1);
  c.advance(300);
  t.fragmentAdd('sentence', 'F3', 2);
  c.advance(300);
  t.commit('sentence');
});

/* ══════════════════════════════════════════════════════════════════════════
   E. AFTER_DECISION — meaningful activity/stillness after the answer was
      already in place, in each Zone's own terms.
   ══════════════════════════════════════════════════════════════════════════ */

const E_light = lightRecord((t, c) => {
  c.advance(300);
  t.select('image', 'IMG_01');
  c.advance(200);
  t.commit('image');
  t.openGroup('emotion');
  c.advance(10_000); // decisionMs ~10s
  t.setSelection('emotion', ['calm']);
  c.advance(6000); // meaningful stay after the choice was made
  t.commit('emotion');
});

const E_sound = soundRecord((t, c) => {
  c.advance(200);
  t.playStart('sound', 'SND_01', 0);
  c.advance(1500);
  t.playStop('sound', 'SND_01', { fromMs: 0, toMs: 1500, durationMs: 5200, reason: 'paused' });
  t.select('sound', 'SND_01');
  c.advance(150);
  t.commit('sound');
  t.openGroup('position');
  c.advance(300);
  t.positionStart('position', { x: 0.3, y: 0.3 }, { gesture: 'place', pointerType: 'mouse' });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(200);
  t.advanceReady();
  c.advance(500);
  t.playStart('sound', 'SND_01', 0); // replayed after the point was already placed
  c.advance(1000);
  t.playStop('sound', 'SND_01', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
  c.advance(5000); // long pause before NEXT
  t.commit('position');
});

const E_memory = memoryRecord((t, c) => {
  // Room: quick, uneventful selection (not what this scenario is testing).
  t.openGroup('object');
  c.advance(200);
  t.select('object', 'window');
  c.advance(200);
  t.select('object', 'lamp');
  c.advance(200);
  t.commit('object');
  // Drawing entered: meaningful stay after the last stroke (POST_DRAWING_HESITATION).
  c.advance(200);
  t.openGroup('sketch');
  t.advanceReady();
  c.advance(500);
  t.strokeStart('sketch', 's1', { x: 0.2, y: 0.2 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
  t.strokePoint('sketch', { x: 0.25, y: 0.25 });
  t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
  c.advance(1500);
  t.strokeStart('sketch', 's2', { x: 0.6, y: 0.6 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' }); // last meaningful stroke
  t.strokePoint('sketch', { x: 0.64, y: 0.64 });
  t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
  c.advance(4500); // meaningful stay after the last stroke
  t.commit('sketch');
});

const E_sentence = sentenceRecord((t, c) => {
  c.advance(300);
  t.fragmentAdd('sentence', 'F1', 0);
  c.advance(300);
  t.fragmentAdd('sentence', 'F2', 1);
  c.advance(300);
  t.fragmentAdd('sentence', 'F3', 2); // becomes valid here
  c.advance(20_000);
  t.fragmentAdd('sentence', 'F4', 3); // repeated revision after first valid state
  c.advance(2000);
  t.fragmentRemove('sentence', 'F4', 3);
  c.advance(2000);
  t.fragmentAdd('sentence', 'F5', 3);
  c.advance(5000); // long pause before NEXT
  t.commit('sentence');
});

/* ══════════════════════════════════════════════════════════════════════════
   Assemble + run
   ══════════════════════════════════════════════════════════════════════════ */

interface Scenario {
  id: string;
  label: string;
  expectedPrimary: CrossSceneTraceId | null;
  input: CrossSceneInput;
}

const scenarios: Scenario[] = [
  {
    id: 'A',
    label: 'DIRECT',
    expectedPrimary: null,
    input: { light: toLightInput(A_light), sound: toSoundInput(A_sound), memory: toMemoryInput(A_memory), sentence: toSentenceInput(A_sentence) },
  },
  {
    id: 'B',
    label: 'RETURNING',
    expectedPrimary: 'RETURN',
    input: { light: toLightInput(B_light), sound: toSoundInput(B_sound), memory: toMemoryInput(B_memory), sentence: toSentenceInput(B_sentence) },
  },
  {
    id: 'C',
    label: 'REVISING',
    expectedPrimary: 'REVISION',
    input: { light: toLightInput(C_light), sound: toSoundInput(C_sound), memory: toMemoryInput(C_memory), sentence: toSentenceInput(C_sentence) },
  },
  {
    id: 'D',
    label: 'ATTENTION_GAP',
    expectedPrimary: 'ATTENTION_CHOICE_GAP',
    input: { light: toLightInput(D_light), sound: toSoundInput(D_sound), memory: toMemoryInput(D_memory), sentence: toSentenceInput(D_sentence) },
  },
  {
    id: 'E',
    label: 'AFTER_DECISION',
    expectedPrimary: 'POST_DECISION',
    input: { light: toLightInput(E_light), sound: toSoundInput(E_sound), memory: toMemoryInput(E_memory), sentence: toSentenceInput(E_sentence) },
  },
];

/* ── Printing ────────────────────────────────────────────────────────────── */

function fmtZone(z: ZoneEvidence): string {
  const flag = !z.applicable ? 'n/a' : z.detected ? 'DETECTED' : 'no';
  const src = z.sources.length > 0 ? ` [${z.sources.join(', ')}]` : '';
  return `${z.sceneId.padEnd(8)} ${flag.padEnd(8)}${src}`;
}

function fmtFinding(f: CrossSceneFinding): string {
  return `${f.id.padEnd(22)} ${f.strength.padEnd(11)} detected ${f.detectedZoneCount}/${f.applicableZoneCount}  priority ${f.priority}`;
}

const report: Record<string, unknown> = {};

for (const scenario of scenarios) {
  console.log(`\n${'='.repeat(78)}`);
  console.log(`${scenario.id}. ${scenario.label}  (expected primary: ${scenario.expectedPrimary ?? 'none'})`);
  console.log('='.repeat(78));

  const findings1 = analyzeCrossScene(scenario.input);
  const findings2 = analyzeCrossScene(scenario.input);
  const deterministic = JSON.stringify(rankFindings(findings1)) === JSON.stringify(rankFindings(findings2));

  const ranked = rankFindings(findings1);
  const primary = ranked.filter((f) => f.strength === 'primary');
  const secondary = ranked.filter((f) => f.strength === 'secondary');
  const observations = ranked.filter((f) => f.strength === 'observation');

  console.log('\nrankedFindings:');
  ranked.forEach((f, i) => console.log(`  ${i + 1}. ${fmtFinding(f)}`));

  console.log(`\nprimary:      [${primary.map((f) => f.id).join(', ') || '(none)'}]`);
  console.log(`secondary:    [${secondary.map((f) => f.id).join(', ') || '(none)'}]`);
  console.log(`observations: [${observations.map((f) => f.id).join(', ') || '(none)'}]`);
  console.log(`deterministic (same input, re-run twice): ${deterministic}`);

  console.log('\nzoneEvidence per finding:');
  for (const f of ranked) {
    console.log(`  ${f.id} (${f.strength}):`);
    for (const z of f.zoneEvidence) console.log(`    ${fmtZone(z)}`);
  }

  console.log('\nprimaryEvidence per non-none finding:');
  for (const f of ranked.filter((f) => f.strength !== 'none')) {
    console.log(`  ${f.id}:`);
    for (const z of f.primaryEvidence) {
      console.log(`    ${z.sceneId}: sources=[${z.sources.join(', ')}] facts=${JSON.stringify(z.facts)}`);
    }
  }

  report[scenario.id] = { label: scenario.label, expectedPrimary: scenario.expectedPrimary, ranked, deterministic };
}

/* ── Summary table ───────────────────────────────────────────────────────── */

console.log(`\n${'='.repeat(78)}`);
console.log('SUMMARY');
console.log('='.repeat(78));

interface Row {
  scenario: string;
  expectedPrimary: string;
  actualPrimary: string;
  pass: boolean;
  unexpected: string;
}

const rows: Row[] = scenarios.map((scenario) => {
  const findings = analyzeCrossScene(scenario.input);
  const ranked = rankFindings(findings);
  const primaryIds = ranked.filter((f) => f.strength === 'primary').map((f) => f.id);
  const nonNone = ranked.filter((f) => f.strength !== 'none').map((f) => f.id);

  const expected = scenario.expectedPrimary;
  let pass: boolean;
  let unexpected: string[];
  if (expected === null) {
    pass = primaryIds.length === 0;
    unexpected = nonNone.filter((id) => ranked.find((f) => f.id === id)!.strength !== 'observation');
  } else {
    pass = ranked[0]?.id === expected && ranked[0]?.strength === 'primary';
    unexpected = primaryIds.filter((id) => id !== expected);
  }

  return {
    scenario: `${scenario.id}. ${scenario.label}`,
    expectedPrimary: expected ?? '(none)',
    actualPrimary: primaryIds.join(', ') || '(none)',
    pass,
    unexpected: unexpected.join(', ') || '(none)',
  };
});

const col = (s: string, w: number) => s.padEnd(w);
console.log(
  `\n${col('Scenario', 20)}${col('Expected Primary', 24)}${col('Actual Primary', 24)}${col('Pass/Fail', 10)}Unexpected Findings`,
);
for (const r of rows) {
  console.log(
    `${col(r.scenario, 20)}${col(r.expectedPrimary, 24)}${col(r.actualPrimary, 24)}${col(r.pass ? 'PASS' : 'FAIL', 10)}${r.unexpected}`,
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   M1–M8 — MEMORY v2 (Room + optional Drawing), asserted.
   ══════════════════════════════════════════════════════════════════════════ */

console.log(`\n${'='.repeat(78)}`);
console.log('M1–M8: MEMORY v2 Cross-Scene scenarios');
console.log('='.repeat(78));

function patternDetected(input: CrossSceneInput['memory'], id: string): boolean {
  return input?.patterns.find((p) => p.id === id)?.detected ?? false;
}

section('M1. Room Return Only — OBJECT_RETURN, drawing skipped', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup('object');
    c.advance(300);
    t.viewStart('object', 'window');
    c.advance(250);
    t.viewEnd('object', 'window');
    c.advance(500);
    t.viewStart('object', 'lamp');
    c.advance(250);
    t.viewEnd('object', 'lamp');
    c.advance(500);
    t.viewStart('object', 'window'); // A -> B -> A
    c.advance(250);
    t.viewEnd('object', 'window');
    c.advance(200);
    t.select('object', 'window');
    t.select('object', 'lamp');
    c.advance(200);
    t.commit('object');
    c.advance(100);
    t.commit('sketch'); // skip
  });
  const memoryInput = toMemoryInput(record);
  assert(patternDetected(memoryInput, 'OBJECT_RETURN'), 'Scene Pattern: OBJECT_RETURN detected');

  const findings = analyzeCrossScene({ ...EMPTY_INPUT, memory: memoryInput });
  const returnZone = zoneOf(findingFor(findings, 'RETURN'), 'MEMORY');
  assert(returnZone.applicable && returnZone.detected, 'Cross-Scene: MEMORY x RETURN detected:true');
  eq(returnZone.sources, ['OBJECT_RETURN'], 'RETURN sources — no ERASE_RETURN needed');

  const pauseZone = zoneOf(findingFor(findings, 'PAUSE'), 'MEMORY');
  assert(!pauseZone.applicable, 'Cross-Scene: drawing-only PAUSE = applicable:false');
});

section('M2. Object Revision Only — OBJECT_REVISION, drawing skipped', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup('object');
    c.advance(200);
    t.select('object', 'window'); // A
    c.advance(200);
    t.select('object', 'lamp'); // B -> valid at {A, B}
    c.advance(300);
    t.deselect('object', 'lamp'); // B released
    c.advance(300);
    t.select('object', 'book'); // C selected -> final {A, C}
    c.advance(200);
    t.commit('object');
    c.advance(100);
    t.commit('sketch'); // skip
  });
  const memoryInput = toMemoryInput(record);
  assert(patternDetected(memoryInput, 'OBJECT_REVISION'), 'Scene Pattern: OBJECT_REVISION detected');

  const findings = analyzeCrossScene({ ...EMPTY_INPUT, memory: memoryInput });
  const revisionZone = zoneOf(findingFor(findings, 'REVISION'), 'MEMORY');
  assert(revisionZone.applicable && revisionZone.detected, 'Cross-Scene: MEMORY x REVISION detected:true');
  eq(revisionZone.sources, ['OBJECT_REVISION'], 'REVISION sources — no drawing REPEATED_REVISION');
});

section('M3. Object Attention Gap — drawing skipped', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup('object');
    c.advance(300);
    t.viewStart('object', 'window');
    c.advance(4000); // explored at length
    t.viewEnd('object', 'window');
    c.advance(300);
    t.viewStart('object', 'lamp');
    c.advance(220);
    t.select('object', 'lamp');
    t.viewEnd('object', 'lamp');
    c.advance(300);
    t.viewStart('object', 'book');
    c.advance(220);
    t.select('object', 'book');
    t.viewEnd('object', 'book');
    c.advance(200);
    t.commit('object');
    c.advance(100);
    t.commit('sketch'); // skip
  });
  const memoryInput = toMemoryInput(record);
  assert(patternDetected(memoryInput, 'OBJECT_ATTENTION_GAP'), 'Scene Pattern: OBJECT_ATTENTION_GAP detected');

  const findings = analyzeCrossScene({ ...EMPTY_INPUT, memory: memoryInput });
  const gapZone = zoneOf(findingFor(findings, 'ATTENTION_CHOICE_GAP'), 'MEMORY');
  eq(gapZone.applicable, true, 'Cross-Scene: MEMORY x ATTENTION_CHOICE_GAP applicable:true');
  eq(gapZone.detected, true, 'Cross-Scene: MEMORY x ATTENTION_CHOICE_GAP detected:true');
});

section('M4. Drawing Skipped — drawingEntered false, no false drawing evidence', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup('object');
    c.advance(200);
    t.select('object', 'chair');
    c.advance(200);
    t.select('object', 'bag');
    c.advance(200);
    t.commit('object');
    c.advance(100);
    t.commit('sketch'); // skip
  });
  const memoryInput = toMemoryInput(record);
  eq(memoryInput!.summary.drawingEntered, false, 'drawingEntered false');

  const findings = analyzeCrossScene({ ...EMPTY_INPUT, memory: memoryInput });
  const pause = zoneOf(findingFor(findings, 'PAUSE'), 'MEMORY');
  const postDecision = zoneOf(findingFor(findings, 'POST_DECISION'), 'MEMORY');
  assert(!pause.applicable, 'MEMORY x PAUSE = applicable:false when Drawing was skipped');
  assert(!postDecision.applicable, 'MEMORY x POST_DECISION = applicable:false when Drawing was skipped');
  // Room-based traces stay applicable — the Room was reached — just not detected on this neutral pick.
  for (const id of ['RETURN', 'REVISION', 'ATTENTION_CHOICE_GAP', 'RECHECK'] as const) {
    const zone = zoneOf(findingFor(findings, id), 'MEMORY');
    assert(zone.applicable, `MEMORY x ${id} stays applicable:true (Room-based, always reachable)`);
    assert(!zone.detected, `MEMORY x ${id} detected:false on this neutral pick`);
  }
});

section('M5. Drawing Entered, No Pause — drawingEntered true, PAUSE applicable but not detected', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup('object');
    c.advance(200);
    t.select('object', 'chair');
    c.advance(200);
    t.select('object', 'bag');
    c.advance(200);
    t.commit('object');
    c.advance(150);
    t.openGroup('sketch');
    t.advanceReady();
    c.advance(300); // quick — well under any pause/delay floor
    t.strokeStart('sketch', 's1', { x: 0.3, y: 0.3 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
    t.strokePoint('sketch', { x: 0.34, y: 0.34 });
    t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
    c.advance(200); // immediate submit
    t.commit('sketch');
  });
  const memoryInput = toMemoryInput(record);
  eq(memoryInput!.summary.drawingEntered, true, 'drawingEntered true');

  const findings = analyzeCrossScene({ ...EMPTY_INPUT, memory: memoryInput });
  const pause = zoneOf(findingFor(findings, 'PAUSE'), 'MEMORY');
  assert(pause.applicable, 'MEMORY x PAUSE applicable:true once Drawing is entered');
  assert(!pause.detected, 'MEMORY x PAUSE detected:false — nothing paused');
});

section('M6. Room Return + Drawing Return — one MEMORY zone count, both sources kept', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup('object');
    c.advance(300);
    t.viewStart('object', 'window');
    c.advance(250);
    t.viewEnd('object', 'window');
    c.advance(500);
    t.viewStart('object', 'lamp');
    c.advance(250);
    t.viewEnd('object', 'lamp');
    c.advance(500);
    t.viewStart('object', 'window'); // A -> B -> A
    c.advance(250);
    t.viewEnd('object', 'window');
    c.advance(200);
    t.select('object', 'window');
    t.select('object', 'lamp');
    c.advance(200);
    t.commit('object');

    c.advance(150);
    t.openGroup('sketch');
    t.advanceReady();
    c.advance(300);
    t.strokeStart('sketch', 's1', { x: 0.3, y: 0.3 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
    t.strokePoint('sketch', { x: 0.34, y: 0.34 });
    t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
    c.advance(500);
    t.removeStrokes('sketch', ['s1'], 'undo');
    c.advance(1000);
    t.strokeStart('sketch', 's2', { x: 0.3, y: 0.3 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' }); // same location
    t.strokePoint('sketch', { x: 0.34, y: 0.34 });
    t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
    c.advance(300);
    t.commit('sketch');
  });
  const memoryInput = toMemoryInput(record);
  assert(patternDetected(memoryInput, 'OBJECT_RETURN'), 'Scene Pattern: OBJECT_RETURN detected');
  assert(patternDetected(memoryInput, 'ERASE_RETURN'), 'Scene Pattern: ERASE_RETURN detected');

  const findings = analyzeCrossScene({ ...EMPTY_INPUT, memory: memoryInput });
  const finding = findingFor(findings, 'RETURN');
  eq(finding.detectedZoneCount, 1, 'MEMORY contributes exactly 1 zone despite 2 patterns firing');
  const returnZone = zoneOf(finding, 'MEMORY');
  eq(
    returnZone.sources,
    ['OBJECT_RETURN', 'ERASE_RETURN'],
    'both sources preserved in zoneEvidence, in Room-then-Drawing order',
  );
});

section('M7. Room Revision + Drawing Revision — one MEMORY zone count, both sources kept', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup('object');
    c.advance(200);
    t.select('object', 'window');
    c.advance(200);
    t.select('object', 'lamp'); // valid at {window, lamp}
    c.advance(300);
    t.deselect('object', 'lamp');
    c.advance(300);
    t.select('object', 'book'); // final {window, book}
    c.advance(200);
    t.commit('object');

    c.advance(150);
    t.openGroup('sketch');
    t.advanceReady();
    for (const [id, x] of [['s1', 0.1], ['s2', 0.4], ['s3', 0.7]] as const) {
      c.advance(300);
      t.strokeStart('sketch', id, { x, y: 0.2 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
      t.strokePoint('sketch', { x: x + 0.04, y: 0.24 });
      t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
      c.advance(200);
      t.removeStrokes('sketch', [id], 'undo'); // 3 separate undos -> REPEATED_REVISION
    }
    c.advance(300);
    t.strokeStart('sketch', 's4', { x: 0.9, y: 0.9 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
    t.strokePoint('sketch', { x: 0.94, y: 0.94 });
    t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
    c.advance(300);
    t.commit('sketch');
  });
  const memoryInput = toMemoryInput(record);
  assert(patternDetected(memoryInput, 'OBJECT_REVISION'), 'Scene Pattern: OBJECT_REVISION detected');
  assert(patternDetected(memoryInput, 'REPEATED_REVISION'), 'Scene Pattern: REPEATED_REVISION detected');

  const findings = analyzeCrossScene({ ...EMPTY_INPUT, memory: memoryInput });
  const finding = findingFor(findings, 'REVISION');
  eq(finding.detectedZoneCount, 1, 'MEMORY contributes exactly 1 zone despite 2 patterns firing');
  const revisionZone = zoneOf(finding, 'MEMORY');
  eq(
    revisionZone.sources,
    ['OBJECT_REVISION', 'REPEATED_REVISION'],
    'both sources preserved in zoneEvidence',
  );
});

section('M8. Missing / old MEMORY data does not crash and never false-positives', () => {
  // Literal v1 shape: groupModes never even declares 'object', and no event
  // ever names it — exactly what a visit recorded before the Room existed
  // looks like.
  const oldClock = makeClock();
  const oldTracker = createSceneTracker('memorySketch', { sketch: 'single' }, oldClock.now);
  oldClock.advance(300);
  oldTracker.openGroup('sketch');
  oldClock.advance(500);
  oldTracker.strokeStart('sketch', 's1', { x: 0.2, y: 0.2 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
  oldTracker.strokePoint('sketch', { x: 0.24, y: 0.24 });
  oldTracker.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
  oldClock.advance(300);
  oldTracker.commit('sketch');
  const oldRecord = oldTracker.snapshot();

  let threw: unknown = null;
  let findings: CrossSceneFinding[] = [];
  try {
    const memoryInput = toMemoryInput(oldRecord);
    findings = analyzeCrossScene({ ...EMPTY_INPUT, memory: memoryInput });
  } catch (error) {
    threw = error;
  }
  assert(threw === null, `old-shaped MEMORY record does not crash the pipeline${threw ? `: ${String(threw)}` : ''}`);

  for (const id of ['RETURN', 'REVISION', 'ATTENTION_CHOICE_GAP', 'RECHECK'] as const) {
    const zone = zoneOf(findingFor(findings, id), 'MEMORY');
    assert(zone.applicable, `${id}/MEMORY still applicable:true — the record exists, even if old-shaped`);
    assert(!zone.detected, `${id}/MEMORY not a false positive — no object-group data exists in this old record`);
  }
  // No record at all — the other crash-safety floor.
  const noRecordFindings = analyzeCrossScene(EMPTY_INPUT);
  for (const id of ['RETURN', 'REVISION', 'ATTENTION_CHOICE_GAP', 'RECHECK', 'POST_DECISION', 'PAUSE'] as const) {
    assert(!zoneOf(findingFor(noRecordFindings, id), 'MEMORY').applicable, `${id}/MEMORY inapplicable with no record at all`);
  }
});

console.log(`\nM1-M8: ${checks} checks / ${failures.length} failures`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
}

/* ══════════════════════════════════════════════════════════════════════════
   Report Engine — Report Rule Matching / Report Evidence / Report Content
   Model, built on the exact same CrossSceneInput objects scenarios A–E and
   M1–M8 already constructed above. Nothing new is driven through the
   tracker here; this section only checks what buildReportModel does with
   an already-computed CrossSceneReport.
   ══════════════════════════════════════════════════════════════════════════ */

const checksBeforeReportEngine = checks;
const failuresBeforeReportEngine = failures.length;

console.log(`\n${'='.repeat(78)}`);
console.log('Report Engine (buildReportModel)');
console.log('='.repeat(78));

section('R1. Scenario A (DIRECT) -> empty report, no manufactured Finding', () => {
  const crossSceneReport = buildCrossSceneReport(scenarios[0].input);
  const model = buildReportModel(crossSceneReport);
  eq(model.findings, [], 'findings is []');
  eq(model.overview.hasStrongBehavioralPattern, false, 'hasStrongBehavioralPattern false');
  eq(model.overview.primaryCount, 0, 'primaryCount 0');
  eq(model.overview.secondaryCount, 0, 'secondaryCount 0');
  eq(model.overview.observationCount, 0, 'observationCount 0');
  eq(model.version, '1', 'version is the schema version, not a timestamp');
  assert(model.generatedAt === undefined, 'generatedAt absent when not injected');
});

section('R2. Scenario B (RETURNING) -> first Finding is RETURN, primary, multi-zone evidence', () => {
  const crossSceneReport = buildCrossSceneReport(scenarios[1].input);
  const model = buildReportModel(crossSceneReport);
  assert(model.findings.length > 0, 'at least one Finding');
  const first = model.findings[0];
  eq(first.traceId, 'RETURN', 'first Finding is RETURN');
  eq(first.strength, 'primary', 'strength primary');
  eq(first.observationKey, 'repeated_return', 'observationKey');
  assert(first.evidence.length >= 3, `evidence spans multiple Zones (got ${first.evidence.length})`);
  const memoryEvidence = first.evidence.find((e) => e.sceneId === 'MEMORY');
  assert(!!memoryEvidence, 'MEMORY evidence present');
  eq(memoryEvidence!.sources, ['OBJECT_RETURN'], 'MEMORY RETURN evidence is v2 Room-based');
  eq(memoryEvidence!.evidenceKeys, ['memory.object_return'], 'evidenceKey for MEMORY x OBJECT_RETURN');
  const sentenceEvidence = first.evidence.find((e) => e.sceneId === 'SENTENCE');
  eq(sentenceEvidence?.evidenceKeys, ['sentence.fragment_return'], 'evidenceKey for SENTENCE x FRAGMENT_RETURN');
});

section('R3. Scenario C (REVISING) -> first Finding is REVISION, primary; does not get displaced', () => {
  const crossSceneReport = buildCrossSceneReport(scenarios[2].input);
  const model = buildReportModel(crossSceneReport);
  const first = model.findings[0];
  eq(first.traceId, 'REVISION', 'first Finding is REVISION');
  eq(first.strength, 'primary', 'strength primary');
  // POST_DECISION may legitimately also appear (SENTENCE's POST_COMPLETION_REVISION
  // overlap, already documented in the Cross-Scene v2 report) but only ever
  // as a weaker Finding, never ahead of REVISION.
  const postDecisionIndex = model.findings.findIndex((f) => f.traceId === 'POST_DECISION');
  if (postDecisionIndex !== -1) {
    assert(postDecisionIndex > 0, 'POST_DECISION, if present, never ranks ahead of REVISION');
    assert(
      model.findings[postDecisionIndex].strength !== 'primary',
      'POST_DECISION, if present, is not primary — does not compete with REVISION',
    );
  }
});

section('R4. Scenario D (ATTENTION_GAP) -> first Finding is ATTENTION_CHOICE_GAP, includes MEMORY v2 evidence', () => {
  const crossSceneReport = buildCrossSceneReport(scenarios[3].input);
  const model = buildReportModel(crossSceneReport);
  const first = model.findings[0];
  eq(first.traceId, 'ATTENTION_CHOICE_GAP', 'first Finding is ATTENTION_CHOICE_GAP');
  eq(first.strength, 'primary', 'strength primary');
  const memoryEvidence = first.evidence.find((e) => e.sceneId === 'MEMORY');
  assert(!!memoryEvidence, 'MEMORY evidence present');
  eq(memoryEvidence!.sources, ['OBJECT_ATTENTION_GAP'], 'MEMORY evidence is OBJECT_ATTENTION_GAP (v2 Room)');
  eq(memoryEvidence!.evidenceKeys, ['memory.object_attention_gap'], 'evidenceKey');
});

section('R5. Scenario E (AFTER_DECISION) -> first Finding is POST_DECISION, primary', () => {
  const crossSceneReport = buildCrossSceneReport(scenarios[4].input);
  const model = buildReportModel(crossSceneReport);
  const first = model.findings[0];
  eq(first.traceId, 'POST_DECISION', 'first Finding is POST_DECISION');
  eq(first.strength, 'primary', 'strength primary');
});

section('R6. determinism — same CrossSceneReport, called twice, byte-identical (no generatedAt)', () => {
  const crossSceneReport = buildCrossSceneReport(scenarios[1].input);
  const a = buildReportModel(crossSceneReport);
  const b = buildReportModel(crossSceneReport);
  eq(a, b, 'two calls on the same input produce an identical model');

  // Rebuilding the CrossSceneReport from scratch (fresh objects, same
  // source data) must also be identical — this is the real byte-identical
  // guarantee a caller relies on, not just re-reading the same reference.
  const crossSceneReport2 = buildCrossSceneReport(scenarios[1].input);
  const c = buildReportModel(crossSceneReport2);
  eq(a, c, 'rebuilding from the same CrossSceneInput is still identical');
});

section('R7. none-strength traces never appear in findings', () => {
  const crossSceneReport = buildCrossSceneReport(scenarios[1].input); // RETURNING
  const model = buildReportModel(crossSceneReport);
  const noneTraceIds = crossSceneReport.findings.filter((f) => f.strength === 'none').map((f) => f.id);
  assert(noneTraceIds.length > 0, 'sanity: this scenario does have some none-strength traces');
  for (const id of noneTraceIds) {
    assert(!model.findings.some((f) => f.traceId === id), `'none'-strength trace ${id} excluded from findings`);
  }
});

section('R8. observation cap — at most REPORT_THRESHOLDS.maxObservations, in ranked order', () => {
  // Three independent single-Zone detections, each on a different trace,
  // combined so all three land at 'observation' strength simultaneously:
  // RETURN (LIGHT only), REVISION (MEMORY only), ATTENTION_CHOICE_GAP (SOUND only).
  const combined: CrossSceneInput = {
    light: toLightInput(B_light), // RETURN_LOOP + FINAL_RETURN on LIGHT alone
    sound: toSoundInput(D_sound), // LISTEN_SELECTION_GAP on SOUND alone
    memory: toMemoryInput(C_memory), // OBJECT_REVISION on MEMORY alone
    sentence: null,
  };
  const crossSceneReport = buildCrossSceneReport(combined);
  const observationTraces = crossSceneReport.observations.map((f) => f.id);
  assert(
    observationTraces.length >= 3,
    `sanity: fixture produces at least 3 observation-strength Findings (got ${JSON.stringify(observationTraces)})`,
  );

  const model = buildReportModel(crossSceneReport);
  const includedObservations = model.findings.filter((f) => f.strength === 'observation');
  eq(includedObservations.length, REPORT_THRESHOLDS.maxObservations, `at most ${REPORT_THRESHOLDS.maxObservations} observations included`);
  eq(
    includedObservations.map((f) => f.traceId),
    crossSceneReport.observations.slice(0, REPORT_THRESHOLDS.maxObservations).map((f) => f.id),
    'the included observations are exactly the first N in Cross-Scene ranked order — never re-sorted',
  );
  eq(model.overview.observationCount, observationTraces.length, 'overview reports the full observation count, not just the included ones');
});

section('R9. MEMORY drawing skipped -> no drawing-only evidence anywhere in the report', () => {
  const record = memoryRecord((t, c) => {
    t.openGroup('object');
    c.advance(200);
    t.select('object', 'chair');
    c.advance(200);
    t.select('object', 'bag');
    c.advance(200);
    t.commit('object');
    c.advance(100);
    t.commit('sketch'); // skipped — never opened
  });
  const memoryInput = toMemoryInput(record);
  const crossSceneReport = buildCrossSceneReport({ ...EMPTY_INPUT, memory: memoryInput });
  const model = buildReportModel(crossSceneReport);

  const drawingOnlySources = new Set([
    'POST_DRAWING_HESITATION',
    'DELAYED_START',
    'LONG_PAUSE',
    'ERASE_RETURN',
    'REPEATED_REVISION',
  ]);
  for (const finding of model.findings) {
    for (const evidence of finding.evidence) {
      if (evidence.sceneId !== 'MEMORY') continue;
      for (const source of evidence.sources) {
        assert(!drawingOnlySources.has(source), `no drawing-only source (${source}) leaks into the report when Drawing was skipped`);
      }
    }
  }
  // PAUSE and POST_DECISION should not even be applicable for MEMORY here,
  // so they should not surface as MEMORY evidence under any trace.
  const pauseFinding = model.findings.find((f) => f.traceId === 'PAUSE');
  if (pauseFinding) {
    assert(!pauseFinding.evidence.some((e) => e.sceneId === 'MEMORY'), 'PAUSE finding, if present, has no MEMORY evidence');
  }
});

section('R10. same-Zone duplicate patterns do not inflate detectedZoneCount in the report', () => {
  // MEMORY: OBJECT_RETURN (Room) + ERASE_RETURN (Drawing) together — one Zone.
  const record = memoryRecord((t, c) => {
    t.openGroup('object');
    c.advance(300);
    t.viewStart('object', 'window');
    c.advance(250);
    t.viewEnd('object', 'window');
    c.advance(500);
    t.viewStart('object', 'lamp');
    c.advance(250);
    t.viewEnd('object', 'lamp');
    c.advance(500);
    t.viewStart('object', 'window');
    c.advance(250);
    t.viewEnd('object', 'window');
    c.advance(200);
    t.select('object', 'window');
    t.select('object', 'lamp');
    c.advance(200);
    t.commit('object');

    c.advance(150);
    t.openGroup('sketch');
    t.advanceReady();
    c.advance(300);
    t.strokeStart('sketch', 's1', { x: 0.3, y: 0.3 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
    t.strokePoint('sketch', { x: 0.34, y: 0.34 });
    t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
    c.advance(500);
    t.removeStrokes('sketch', ['s1'], 'undo');
    c.advance(1000);
    t.strokeStart('sketch', 's2', { x: 0.3, y: 0.3 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
    t.strokePoint('sketch', { x: 0.34, y: 0.34 });
    t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
    c.advance(300);
    t.commit('sketch');
  });
  const memoryInput = toMemoryInput(record);
  const crossSceneReport = buildCrossSceneReport({ ...EMPTY_INPUT, memory: memoryInput });
  const model = buildReportModel(crossSceneReport);
  const returnFinding = model.findings.find((f) => f.traceId === 'RETURN');
  assert(!!returnFinding, 'RETURN finding present');
  eq(returnFinding!.detectedZoneCount, 1, 'detectedZoneCount stays 1 despite 2 MEMORY sources');
  const memoryEvidence = returnFinding!.evidence.find((e) => e.sceneId === 'MEMORY');
  eq(memoryEvidence!.sources, ['OBJECT_RETURN', 'ERASE_RETURN'], 'both sources preserved in one ReportEvidence entry');
  eq(
    memoryEvidence!.evidenceKeys,
    ['memory.object_return', 'memory.erase_return'],
    'both evidenceKeys preserved, same order as sources',
  );
  // Only one ReportEvidence entry for MEMORY under this Finding, not two.
  eq(returnFinding!.evidence.filter((e) => e.sceneId === 'MEMORY').length, 1, 'exactly one MEMORY evidence entry, not two');
});

section('R11. missing/old Scene data does not crash the Report Engine', () => {
  // A record missing entirely (LIGHT never reached).
  const crossSceneReport1 = buildCrossSceneReport({ ...EMPTY_INPUT, sound: toSoundInput(A_sound) });
  let threw: unknown = null;
  let model1 = null;
  try {
    model1 = buildReportModel(crossSceneReport1);
  } catch (error) {
    threw = error;
  }
  assert(threw === null, `missing LIGHT record does not crash buildReportModel${threw ? `: ${String(threw)}` : ''}`);
  assert(model1 !== null, 'a model is still returned');

  // Literal v1-shaped MEMORY record (no 'object' group ever touched).
  const oldClock = makeClock();
  const oldTracker = createSceneTracker('memorySketch', { sketch: 'single' }, oldClock.now);
  oldClock.advance(300);
  oldTracker.openGroup('sketch');
  oldClock.advance(500);
  oldTracker.strokeStart('sketch', 's1', { x: 0.2, y: 0.2 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
  oldTracker.strokePoint('sketch', { x: 0.24, y: 0.24 });
  oldTracker.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
  oldClock.advance(300);
  oldTracker.commit('sketch');
  const oldRecord = oldTracker.snapshot();

  let threw2: unknown = null;
  try {
    const crossSceneReport2 = buildCrossSceneReport({ ...EMPTY_INPUT, memory: toMemoryInput(oldRecord) });
    buildReportModel(crossSceneReport2);
  } catch (error) {
    threw2 = error;
  }
  assert(threw2 === null, `old-shaped MEMORY record does not crash buildReportModel${threw2 ? `: ${String(threw2)}` : ''}`);

  // No records at all.
  let threw3: unknown = null;
  try {
    buildReportModel(buildCrossSceneReport(EMPTY_INPUT));
  } catch (error) {
    threw3 = error;
  }
  assert(threw3 === null, `no records at all does not crash buildReportModel${threw3 ? `: ${String(threw3)}` : ''}`);
});

section('R12. Cross-Scene ranking order is never reinterpreted', () => {
  const crossSceneReport = buildCrossSceneReport(scenarios[1].input); // RETURNING
  const model = buildReportModel(crossSceneReport);
  const expectedOrder = [
    ...crossSceneReport.primary,
    ...crossSceneReport.secondary,
    ...crossSceneReport.observations.slice(0, REPORT_THRESHOLDS.maxObservations),
  ].map((f) => f.id);
  eq(model.findings.map((f) => f.traceId), expectedOrder, 'findings order matches primary+secondary+observations exactly');
});

const reportEngineChecks = checks - checksBeforeReportEngine;
const reportEngineFailures = failures.length - failuresBeforeReportEngine;
console.log(`\nReport Engine: ${reportEngineChecks} checks / ${reportEngineFailures} failures`);
if (reportEngineFailures > 0) {
  console.log('\nFailures:');
  for (const f of failures.slice(failuresBeforeReportEngine)) console.log(`  - ${f}`);
}

console.log('\n(done)');
if (failures.length > 0) process.exit(1);
