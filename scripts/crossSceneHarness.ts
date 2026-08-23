/**
 * Standalone verification harness for Cross-Scene Behavioral Analysis (v1).
 *
 * There is no test runner in this project (no vitest/jest in package.json),
 * so this is a plain assert-based script, run with `npx tsx
 * scripts/crossSceneHarness.ts`. It is not part of the app build — nothing
 * under src/ imports it.
 *
 * Every scenario below drives the *real*, unmodified tracker
 * (createSceneTracker) through a scripted sequence of calls — exactly what a
 * Zone component does — then runs the *real*, unmodified summarize/detect
 * functions for that Zone, and only then hands the result to
 * analyzeCrossScene. Nothing here hand-builds a Summary object. That means
 * every scenario doubles as a regression check on the existing LIGHT / SOUND
 * / MEMORY / SENTENCE pipeline, exercised end to end, in addition to
 * checking the new Cross-Scene layer.
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
  rankFindings,
  type CrossSceneFinding,
  type CrossSceneInput,
  type CrossSceneTraceId,
  type FindingStrength,
} from '../src/lib/crossSceneAnalysis';
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

/* ── Clock ───────────────────────────────────────────────────────────────── */

function makeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

/* ── Record builders — script real tracker calls, exactly as a Zone would ── */

function findGroup(record: SceneBehaviorRecord, name: string) {
  return summarizeScene(record).groups[name];
}

function lightRecord(build: (t: ReturnType<typeof createSceneTracker>, clock: ReturnType<typeof makeClock>) => void): SceneBehaviorRecord {
  const clock = makeClock();
  const t = createSceneTracker('lightArchive', { image: 'single', emotion: 'multi' }, clock.now);
  clock.advance(300);
  t.openGroup('image');
  build(t, clock);
  return t.snapshot();
}

function soundRecord(build: (t: ReturnType<typeof createSceneTracker>, clock: ReturnType<typeof makeClock>) => void): SceneBehaviorRecord {
  const clock = makeClock();
  const t = createSceneTracker('soundClues', { sound: 'single', position: 'single' }, clock.now);
  clock.advance(300);
  t.openGroup('sound');
  build(t, clock);
  return t.snapshot();
}

function memoryRecord(build: (t: ReturnType<typeof createSceneTracker>, clock: ReturnType<typeof makeClock>) => void): SceneBehaviorRecord {
  const clock = makeClock();
  const t = createSceneTracker('memorySketch', { sketch: 'single' }, clock.now);
  clock.advance(300);
  t.openGroup('sketch');
  build(t, clock);
  return t.snapshot();
}

function sentenceRecord(build: (t: ReturnType<typeof createSceneTracker>, clock: ReturnType<typeof makeClock>) => void): SceneBehaviorRecord {
  const clock = makeClock();
  const t = createSceneTracker('sentenceClues', { sentence: 'multi' }, clock.now);
  clock.advance(300);
  t.openGroup('sentence');
  build(t, clock);
  return t.snapshot();
}

/* ── Zone input adapters — same translation useCrossSceneDebug.ts does ───── */

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

const EMPTY_INPUT: CrossSceneInput = { light: null, sound: null, memory: null, sentence: null };

function findingFor(findings: CrossSceneFinding[], id: CrossSceneTraceId): CrossSceneFinding {
  const found = findings.find((f) => f.id === id);
  if (!found) throw new Error(`no finding for ${id}`);
  return found;
}

function zoneOf(finding: CrossSceneFinding, sceneId: string) {
  const zone = finding.zoneEvidence.find((z) => z.sceneId === sceneId);
  if (!zone) throw new Error(`no zone evidence for ${sceneId} in ${finding.id}`);
  return zone;
}

/* ══════════════════════════════════════════════════════════════════════════
   Scenario fixtures — one real, tracker-driven record per Zone behaviour.
   ══════════════════════════════════════════════════════════════════════════ */

// LIGHT: nothing notable — one quick, uneventful pick.
const LIGHT_NEUTRAL = lightRecord((t, c) => {
  c.advance(300);
  t.viewStart('image', 'IMG_01');
  c.advance(250);
  t.viewEnd('image', 'IMG_01');
  t.select('image', 'IMG_01');
  c.advance(200);
  t.commit('image');
  t.openGroup('emotion');
  c.advance(300);
  t.setSelection('emotion', ['calm']);
  c.advance(150);
  t.commit('emotion');
});

// LIGHT: RETURN_LOOP + FINAL_RETURN on 'image' (A → B → A → A).
const LIGHT_RETURN = lightRecord((t, c) => {
  c.advance(300);
  t.viewStart('image', 'IMG_A');
  c.advance(250);
  t.viewEnd('image', 'IMG_A');
  c.advance(500);
  t.viewStart('image', 'IMG_B');
  c.advance(250);
  t.viewEnd('image', 'IMG_B');
  c.advance(500);
  t.select('image', 'IMG_A'); // first choice
  t.select('image', 'IMG_B'); // changes mind
  t.viewStart('image', 'IMG_A');
  c.advance(250);
  t.viewEnd('image', 'IMG_A');
  c.advance(500);
  t.viewStart('image', 'IMG_A');
  c.advance(250);
  t.viewEnd('image', 'IMG_A');
  t.select('image', 'IMG_A'); // settles back on the first choice
  c.advance(200);
  t.commit('image');
  t.openGroup('emotion');
  c.advance(300);
  t.setSelection('emotion', ['calm']);
  c.advance(150);
  t.commit('emotion');
});

// LIGHT: net REVISION on 'image' (A → B, stays on B — no return).
const LIGHT_REVISION = lightRecord((t, c) => {
  c.advance(300);
  t.select('image', 'IMG_A');
  c.advance(300);
  t.select('image', 'IMG_B');
  c.advance(200);
  t.commit('image');
  t.openGroup('emotion');
  c.advance(300);
  t.setSelection('emotion', ['calm']);
  c.advance(150);
  t.commit('emotion');
});

// LIGHT: ATTENTION_SELECTION_GAP — longest-viewed image is not the one chosen.
const LIGHT_ATTENTION_GAP = lightRecord((t, c) => {
  c.advance(300);
  t.viewStart('image', 'IMG_LONG');
  c.advance(3000);
  t.viewEnd('image', 'IMG_LONG');
  c.advance(300);
  t.viewStart('image', 'IMG_CHOSEN');
  c.advance(250);
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

// LIGHT: POST_DECISION_HESITATION on 'emotion' (long, disproportionate wait before NEXT).
const LIGHT_POST_DECISION = lightRecord((t, c) => {
  c.advance(300);
  t.select('image', 'IMG_01');
  c.advance(200);
  t.commit('image');
  t.openGroup('emotion');
  c.advance(10_000); // decisionMs ~10s
  t.setSelection('emotion', ['calm']);
  c.advance(6000); // pause ~6s: >= 3000 floor, >= 0.35 * 10000
  t.commit('emotion');
});

// LIGHT: RECHECK — same image looked at three times running, nothing else in between.
const LIGHT_RECHECK = lightRecord((t, c) => {
  c.advance(300);
  t.viewStart('image', 'IMG_A');
  c.advance(250);
  t.viewEnd('image', 'IMG_A');
  c.advance(500);
  t.viewStart('image', 'IMG_A');
  c.advance(250);
  t.viewEnd('image', 'IMG_A');
  c.advance(500);
  t.viewStart('image', 'IMG_A');
  c.advance(250);
  t.viewEnd('image', 'IMG_A');
  t.select('image', 'IMG_A');
  c.advance(200);
  t.commit('image');
  t.openGroup('emotion');
  c.advance(300);
  t.setSelection('emotion', ['calm']);
  c.advance(150);
  t.commit('emotion');
});

// SOUND: nothing notable.
const SOUND_NEUTRAL = soundRecord((t, c) => {
  c.advance(200);
  t.playStart('sound', 'SND_A', 0);
  c.advance(2000);
  t.playStop('sound', 'SND_A', { fromMs: 0, toMs: 2000, durationMs: 5200, reason: 'paused' });
  t.select('sound', 'SND_A');
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

// SOUND: SOUND_RETURN + POSITION_RETURN.
const SOUND_RETURN = soundRecord((t, c) => {
  c.advance(200);
  t.playStart('sound', 'SND_A', 0);
  c.advance(1000);
  t.playStop('sound', 'SND_A', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
  c.advance(200);
  t.playStart('sound', 'SND_B', 0);
  c.advance(1000);
  t.playStop('sound', 'SND_B', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
  c.advance(200);
  t.playStart('sound', 'SND_A', 0); // back to A after B — a genuine return
  c.advance(1000);
  t.playStop('sound', 'SND_A', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
  t.select('sound', 'SND_A');
  c.advance(150);
  t.commit('sound');
  t.openGroup('position');
  c.advance(150);
  t.positionStart('position', { x: 0.1, y: 0.1 }, { gesture: 'place', pointerType: 'mouse' });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(150);
  t.positionStart('position', { x: 0.5, y: 0.1 }, { gesture: 'drag', pointerType: 'mouse' }); // far away
  t.positionMove('position', { x: 0.5, y: 0.1 });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(150);
  t.positionStart('position', { x: 0.12, y: 0.1 }, { gesture: 'drag', pointerType: 'mouse' }); // back close to start
  t.positionMove('position', { x: 0.12, y: 0.1 });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(150);
  t.advanceReady();
  c.advance(150);
  t.commit('position');
});

// SOUND: POSITION_REVISION only (ends up somewhere else, no return).
const SOUND_REVISION = soundRecord((t, c) => {
  c.advance(200);
  t.playStart('sound', 'SND_A', 0);
  c.advance(1000);
  t.playStop('sound', 'SND_A', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
  t.select('sound', 'SND_A');
  c.advance(150);
  t.commit('sound');
  t.openGroup('position');
  c.advance(150);
  t.positionStart('position', { x: 0.1, y: 0.1 }, { gesture: 'place', pointerType: 'mouse' });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(150);
  t.positionStart('position', { x: 0.4, y: 0.1 }, { gesture: 'drag', pointerType: 'mouse' }); // moved far, stays there
  t.positionMove('position', { x: 0.4, y: 0.1 });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(150);
  t.advanceReady();
  c.advance(150);
  t.commit('position');
});

// SOUND: LISTEN_SELECTION_GAP.
const SOUND_ATTENTION_GAP = soundRecord((t, c) => {
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

// SOUND: POST_DECISION_HESITATION + POST_PLACEMENT_REPLAY.
const SOUND_POST_DECISION = soundRecord((t, c) => {
  c.advance(200);
  t.playStart('sound', 'SND_A', 0);
  c.advance(1500);
  t.playStop('sound', 'SND_A', { fromMs: 0, toMs: 1500, durationMs: 5200, reason: 'paused' });
  t.select('sound', 'SND_A');
  c.advance(150);
  t.commit('sound');
  t.openGroup('position');
  c.advance(300);
  t.positionStart('position', { x: 0.3, y: 0.3 }, { gesture: 'place', pointerType: 'mouse' });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(200);
  t.advanceReady();
  c.advance(500);
  // Replayed after the point was already placed.
  t.playStart('sound', 'SND_A', 0);
  c.advance(1000);
  t.playStop('sound', 'SND_A', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
  c.advance(5000); // long pause before NEXT
  t.commit('position');
});

// SOUND: REPLAY_LOOP (RECHECK).
const SOUND_RECHECK = soundRecord((t, c) => {
  c.advance(200);
  t.playStart('sound', 'SND_A', 0);
  c.advance(1500); // prior listening
  t.playStop('sound', 'SND_A', { fromMs: 0, toMs: 1500, durationMs: 5200, reason: 'paused' });
  c.advance(150);
  t.playStart('sound', 'SND_A', 0); // restart from the top — replay #1
  c.advance(1000);
  t.playStop('sound', 'SND_A', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
  c.advance(150);
  t.playStart('sound', 'SND_A', 0); // restart again — replay #2
  c.advance(1000);
  t.playStop('sound', 'SND_A', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
  t.select('sound', 'SND_A');
  c.advance(150);
  t.commit('sound');
  t.openGroup('position');
  c.advance(150);
  t.positionStart('position', { x: 0.3, y: 0.3 }, { gesture: 'place', pointerType: 'mouse' });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(150);
  t.commit('position');
});

// SOUND: POSITION_HESITATION (PAUSE) — repeated stops while positioning.
const SOUND_PAUSE = soundRecord((t, c) => {
  c.advance(200);
  t.playStart('sound', 'SND_A', 0);
  c.advance(1000);
  t.playStop('sound', 'SND_A', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
  t.select('sound', 'SND_A');
  c.advance(150);
  t.commit('sound');
  t.openGroup('position');
  c.advance(150);
  t.positionStart('position', { x: 0.2, y: 0.2 }, { gesture: 'place', pointerType: 'mouse' });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(2000); // pause #1, >= positionPauseMinMs
  t.positionStart('position', { x: 0.25, y: 0.2 }, { gesture: 'drag', pointerType: 'mouse' });
  t.positionMove('position', { x: 0.25, y: 0.2 });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(2000); // pause #2
  t.positionStart('position', { x: 0.3, y: 0.2 }, { gesture: 'drag', pointerType: 'mouse' });
  t.positionMove('position', { x: 0.3, y: 0.2 });
  t.positionEnd('position', { reason: 'pointerUp' });
  c.advance(150);
  t.advanceReady();
  c.advance(150);
  t.commit('position');
});

// MEMORY: nothing notable.
const MEMORY_NEUTRAL = memoryRecord((t, c) => {
  c.advance(500);
  t.strokeStart('sketch', 's1', { x: 0.2, y: 0.2 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
  t.strokePoint('sketch', { x: 0.25, y: 0.25 });
  t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
  c.advance(300);
  t.commit('sketch');
});

// MEMORY: ERASE_RETURN — a mark rubbed out and redrawn in the same place.
const MEMORY_RETURN = memoryRecord((t, c) => {
  c.advance(500);
  t.strokeStart('sketch', 's1', { x: 0.2, y: 0.2 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
  t.strokePoint('sketch', { x: 0.24, y: 0.24 });
  t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
  c.advance(500);
  t.removeStrokes('sketch', ['s1'], 'erase');
  c.advance(1000);
  t.strokeStart('sketch', 's2', { x: 0.2, y: 0.2 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
  t.strokePoint('sketch', { x: 0.24, y: 0.24 });
  t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
  c.advance(300);
  t.commit('sketch');
});

// MEMORY: REPEATED_REVISION — three separate undos.
const MEMORY_REVISION = memoryRecord((t, c) => {
  for (const [id, x] of [['s1', 0.1], ['s2', 0.4], ['s3', 0.7]] as const) {
    c.advance(500);
    t.strokeStart('sketch', id, { x, y: 0.1 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
    t.strokePoint('sketch', { x: x + 0.04, y: 0.14 });
    t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
    c.advance(200);
    t.removeStrokes('sketch', [id], 'undo');
  }
  c.advance(500);
  t.strokeStart('sketch', 's4', { x: 0.9, y: 0.9 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
  t.strokePoint('sketch', { x: 0.94, y: 0.94 });
  t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
  c.advance(300);
  t.commit('sketch');
});

// MEMORY: DELAYED_START + LONG_PAUSE (PAUSE).
const MEMORY_PAUSE = memoryRecord((t, c) => {
  c.advance(9000); // delayedStartMs floor is 8000
  t.strokeStart('sketch', 's1', { x: 0.2, y: 0.2 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
  t.strokePoint('sketch', { x: 0.24, y: 0.24 });
  t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
  c.advance(6000); // longPauseMs floor is 5000
  t.strokeStart('sketch', 's2', { x: 0.6, y: 0.6 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
  t.strokePoint('sketch', { x: 0.64, y: 0.64 });
  t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
  c.advance(300);
  t.commit('sketch');
});

// MEMORY: POST_DRAWING_HESITATION.
const MEMORY_POST_DECISION = memoryRecord((t, c) => {
  c.advance(500);
  t.strokeStart('sketch', 's1', { x: 0.2, y: 0.2 }, { tool: 'pen', color: '#fff', pointerType: 'mouse' });
  t.strokePoint('sketch', { x: 0.24, y: 0.24 });
  t.strokeEnd('sketch', { discarded: false, reason: 'pointerUp' });
  c.advance(4000); // >= floor 3000, >= 0.35 * (short drawing span)
  t.commit('sketch');
});

// SENTENCE: nothing notable.
const SENTENCE_NEUTRAL = sentenceRecord((t, c) => {
  c.advance(300);
  t.fragmentAdd('sentence', 'F1', 0);
  c.advance(300);
  t.fragmentAdd('sentence', 'F2', 1);
  c.advance(300);
  t.fragmentAdd('sentence', 'F3', 2);
  c.advance(300);
  t.commit('sentence');
});

// SENTENCE: FRAGMENT_RETURN.
const SENTENCE_RETURN = sentenceRecord((t, c) => {
  c.advance(300);
  t.fragmentAdd('sentence', 'F1', 0);
  c.advance(300);
  t.fragmentAdd('sentence', 'F2', 1);
  c.advance(300);
  t.fragmentRemove('sentence', 'F1', 0);
  c.advance(1000);
  t.fragmentAdd('sentence', 'F1', 1); // returned
  c.advance(300);
  t.fragmentAdd('sentence', 'F3', 2);
  c.advance(300);
  t.commit('sentence');
});

// SENTENCE: REPEATED_REWRITE + ORDER_REVISION.
const SENTENCE_REVISION = sentenceRecord((t, c) => {
  c.advance(300);
  t.fragmentAdd('sentence', 'F1', 0);
  c.advance(300);
  t.fragmentAdd('sentence', 'F2', 1);
  c.advance(300);
  t.fragmentAdd('sentence', 'F3', 2);
  c.advance(300);
  t.fragmentReorder('sentence', 'F3', 2, 0); // reorder #1
  c.advance(300);
  t.fragmentRemove('sentence', 'F2', 1); // remove #1
  c.advance(300);
  t.fragmentAdd('sentence', 'F4', 1);
  c.advance(300);
  t.fragmentRemove('sentence', 'F4', 1); // remove #2 -> rewriteCount = 3
  c.advance(300);
  t.commit('sentence');
});

// SENTENCE: VIEW_SELECTION_GAP.
const SENTENCE_ATTENTION_GAP = sentenceRecord((t, c) => {
  c.advance(300);
  t.viewStart('sentence', 'F_UNUSED');
  c.advance(3000); // long dwell, never added
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

// SENTENCE: POST_SENTENCE_HESITATION + POST_COMPLETION_REVISION.
const SENTENCE_POST_DECISION = sentenceRecord((t, c) => {
  c.advance(300);
  t.fragmentAdd('sentence', 'F1', 0);
  c.advance(300);
  t.fragmentAdd('sentence', 'F2', 1);
  c.advance(300);
  t.fragmentAdd('sentence', 'F3', 2); // becomes valid here
  c.advance(20_000); // well past lateAddition's own elapsed floor
  t.fragmentAdd('sentence', 'F4', 3); // edit after already valid
  c.advance(5000); // long pause before NEXT, >= floor, >= ratio * constructionTime
  t.commit('sentence');
});

// SENTENCE: RECHECK — same fragment looked at three times running.
const SENTENCE_RECHECK = sentenceRecord((t, c) => {
  c.advance(300);
  t.viewStart('sentence', 'F1');
  c.advance(250);
  t.viewEnd('sentence', 'F1');
  c.advance(500);
  t.viewStart('sentence', 'F1');
  c.advance(250);
  t.viewEnd('sentence', 'F1');
  c.advance(500);
  t.viewStart('sentence', 'F1');
  c.advance(250);
  t.viewEnd('sentence', 'F1');
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
   A. No pattern anywhere
   ══════════════════════════════════════════════════════════════════════════ */

section('A. no pattern anywhere -> every trace strength = none', () => {
  const input: CrossSceneInput = {
    light: toLightInput(LIGHT_NEUTRAL),
    sound: toSoundInput(SOUND_NEUTRAL),
    memory: toMemoryInput(MEMORY_NEUTRAL),
    sentence: toSentenceInput(SENTENCE_NEUTRAL),
  };
  const findings = analyzeCrossScene(input);
  eq(findings.length, 6, 'six findings always returned');
  for (const f of findings) {
    eq(f.strength, 'none' as FindingStrength, `${f.id} strength`);
    eq(f.detectedZoneCount, 0, `${f.id} detectedZoneCount`);
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   B. RETURN / observation — SOUND_RETURN only
   ══════════════════════════════════════════════════════════════════════════ */

section('B. RETURN observation (SOUND only)', () => {
  const input: CrossSceneInput = {
    light: toLightInput(LIGHT_NEUTRAL),
    sound: toSoundInput(SOUND_RETURN),
    memory: toMemoryInput(MEMORY_NEUTRAL),
    sentence: toSentenceInput(SENTENCE_NEUTRAL),
  };
  const finding = findingFor(analyzeCrossScene(input), 'RETURN');
  eq(finding.detectedZoneCount, 1, 'detectedZoneCount');
  eq(finding.strength, 'observation' as FindingStrength, 'strength');
  assert(zoneOf(finding, 'SOUND').detected, 'SOUND zone detected');
  assert(!zoneOf(finding, 'LIGHT').detected, 'LIGHT zone not detected');
  assert(!zoneOf(finding, 'MEMORY').detected, 'MEMORY zone not detected');
  assert(!zoneOf(finding, 'SENTENCE').detected, 'SENTENCE zone not detected');
});

/* ══════════════════════════════════════════════════════════════════════════
   C. RETURN / secondary — LIGHT + SOUND
   ══════════════════════════════════════════════════════════════════════════ */

section('C. RETURN secondary (LIGHT + SOUND)', () => {
  const input: CrossSceneInput = {
    light: toLightInput(LIGHT_RETURN),
    sound: toSoundInput(SOUND_RETURN),
    memory: toMemoryInput(MEMORY_NEUTRAL),
    sentence: toSentenceInput(SENTENCE_NEUTRAL),
  };
  const finding = findingFor(analyzeCrossScene(input), 'RETURN');
  eq(finding.detectedZoneCount, 2, 'detectedZoneCount');
  eq(finding.strength, 'secondary' as FindingStrength, 'strength');
});

/* ══════════════════════════════════════════════════════════════════════════
   D. RETURN / primary — LIGHT + SOUND + MEMORY
   ══════════════════════════════════════════════════════════════════════════ */

section('D. RETURN primary (LIGHT + SOUND + MEMORY)', () => {
  const input: CrossSceneInput = {
    light: toLightInput(LIGHT_RETURN),
    sound: toSoundInput(SOUND_RETURN),
    memory: toMemoryInput(MEMORY_RETURN),
    sentence: toSentenceInput(SENTENCE_NEUTRAL),
  };
  const finding = findingFor(analyzeCrossScene(input), 'RETURN');
  eq(finding.detectedZoneCount, 3, 'detectedZoneCount');
  eq(finding.strength, 'primary' as FindingStrength, 'strength');
});

/* ══════════════════════════════════════════════════════════════════════════
   D2 (extra, edge case 5). RETURN across all four zones.
   ══════════════════════════════════════════════════════════════════════════ */

section('D2. RETURN across all four zones -> primary, detectedZoneCount 4', () => {
  const input: CrossSceneInput = {
    light: toLightInput(LIGHT_RETURN),
    sound: toSoundInput(SOUND_RETURN),
    memory: toMemoryInput(MEMORY_RETURN),
    sentence: toSentenceInput(SENTENCE_RETURN),
  };
  const finding = findingFor(analyzeCrossScene(input), 'RETURN');
  eq(finding.detectedZoneCount, 4, 'detectedZoneCount');
  eq(finding.applicableZoneCount, 4, 'applicableZoneCount');
  eq(finding.strength, 'primary' as FindingStrength, 'strength');
  eq(finding.primaryEvidence.length, 3, 'primaryEvidence capped at 3');
  const scenes = finding.primaryEvidence.map((z) => z.sceneId);
  eq(new Set(scenes).size, scenes.length, 'primaryEvidence has no duplicate scenes');
});

/* ══════════════════════════════════════════════════════════════════════════
   E. Attention gap: LIGHT + SOUND detected, MEMORY applicable but not
      detected (v2: the Room makes MEMORY applicable on every visit), SENTENCE false
   ══════════════════════════════════════════════════════════════════════════ */

section('E. ATTENTION_CHOICE_GAP: detected 2 / applicable 4 / secondary', () => {
  const input: CrossSceneInput = {
    light: toLightInput(LIGHT_ATTENTION_GAP),
    sound: toSoundInput(SOUND_ATTENTION_GAP),
    memory: toMemoryInput(MEMORY_NEUTRAL), // no object events at all in this old fixture
    sentence: toSentenceInput(SENTENCE_NEUTRAL), // no gap in this fixture
  };
  const finding = findingFor(analyzeCrossScene(input), 'ATTENTION_CHOICE_GAP');
  eq(finding.detectedZoneCount, 2, 'detectedZoneCount');
  eq(finding.applicableZoneCount, 4, 'applicableZoneCount — MEMORY v2 is applicable on every visit');
  eq(finding.strength, 'secondary' as FindingStrength, 'strength');
  assert(zoneOf(finding, 'MEMORY').applicable, 'MEMORY applicable (v2: the Room, not Drawing, answers this)');
  assert(!zoneOf(finding, 'MEMORY').detected, 'MEMORY not detected — this fixture never touched the object group');
  assert(!zoneOf(finding, 'SENTENCE').detected, 'SENTENCE not detected (but applicable)');
  assert(zoneOf(finding, 'SENTENCE').applicable, 'SENTENCE applicable');
});

/* ══════════════════════════════════════════════════════════════════════════
   F. Revision — SOUND + MEMORY + SENTENCE -> primary
   ══════════════════════════════════════════════════════════════════════════ */

section('F. REVISION primary (SOUND + MEMORY + SENTENCE)', () => {
  const input: CrossSceneInput = {
    light: toLightInput(LIGHT_NEUTRAL),
    sound: toSoundInput(SOUND_REVISION),
    memory: toMemoryInput(MEMORY_REVISION),
    sentence: toSentenceInput(SENTENCE_REVISION),
  };
  const finding = findingFor(analyzeCrossScene(input), 'REVISION');
  eq(finding.detectedZoneCount, 3, 'detectedZoneCount');
  eq(finding.strength, 'primary' as FindingStrength, 'strength');
});

/* ══════════════════════════════════════════════════════════════════════════
   G. Post decision — LIGHT + SOUND + SENTENCE -> primary
   ══════════════════════════════════════════════════════════════════════════ */

section('G. POST_DECISION primary (LIGHT + SOUND + SENTENCE)', () => {
  const input: CrossSceneInput = {
    light: toLightInput(LIGHT_POST_DECISION),
    sound: toSoundInput(SOUND_POST_DECISION),
    memory: toMemoryInput(MEMORY_NEUTRAL),
    sentence: toSentenceInput(SENTENCE_POST_DECISION),
  };
  const finding = findingFor(analyzeCrossScene(input), 'POST_DECISION');
  eq(finding.detectedZoneCount, 3, 'detectedZoneCount');
  eq(finding.strength, 'primary' as FindingStrength, 'strength');
});

/* ══════════════════════════════════════════════════════════════════════════
   H. Same-scene duplication — SOUND_RETURN + FINAL_RETURN + POSITION_RETURN
      all true -> RETURN detectedZoneCount = 1, evidence preserved.
   ══════════════════════════════════════════════════════════════════════════ */

section('H. same-Zone duplication collapses to one zone count', () => {
  // Reuses SOUND_RETURN, which already fires SOUND_RETURN + POSITION_RETURN
  // together; add a selection change that returns to the first choice too so
  // all three sound-bucket RETURN patterns fire on one record.
  const record = soundRecord((t, c) => {
    c.advance(200);
    t.playStart('sound', 'SND_A', 0);
    c.advance(1000);
    t.playStop('sound', 'SND_A', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
    c.advance(200);
    t.playStart('sound', 'SND_B', 0);
    c.advance(1000);
    t.playStop('sound', 'SND_B', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
    c.advance(200);
    t.playStart('sound', 'SND_A', 0);
    c.advance(1000);
    t.playStop('sound', 'SND_A', { fromMs: 0, toMs: 1000, durationMs: 5200, reason: 'paused' });
    t.select('sound', 'SND_A');
    t.select('sound', 'SND_B');
    t.select('sound', 'SND_A'); // FINAL_RETURN: back to the first choice
    c.advance(150);
    t.commit('sound');
    t.openGroup('position');
    c.advance(150);
    t.positionStart('position', { x: 0.1, y: 0.1 }, { gesture: 'place', pointerType: 'mouse' });
    t.positionEnd('position', { reason: 'pointerUp' });
    c.advance(150);
    t.positionStart('position', { x: 0.5, y: 0.1 }, { gesture: 'drag', pointerType: 'mouse' });
    t.positionMove('position', { x: 0.5, y: 0.1 });
    t.positionEnd('position', { reason: 'pointerUp' });
    c.advance(150);
    t.positionStart('position', { x: 0.12, y: 0.1 }, { gesture: 'drag', pointerType: 'mouse' });
    t.positionMove('position', { x: 0.12, y: 0.1 });
    t.positionEnd('position', { reason: 'pointerUp' });
    c.advance(150);
    t.commit('position');
  });
  const soundInput = toSoundInput(record);
  const soundPatternIds = soundInput!.soundPatterns.filter((p) => p.detected).map((p) => p.id);
  const positionPatternIds = soundInput!.positionPatterns.filter((p) => p.detected).map((p) => p.id);
  assert(soundPatternIds.includes('SOUND_RETURN'), 'fixture: SOUND_RETURN detected');
  assert(soundPatternIds.includes('FINAL_RETURN'), 'fixture: FINAL_RETURN detected');
  assert(positionPatternIds.includes('POSITION_RETURN'), 'fixture: POSITION_RETURN detected');

  const input: CrossSceneInput = { ...EMPTY_INPUT, sound: soundInput };
  const finding = findingFor(analyzeCrossScene(input), 'RETURN');
  eq(finding.detectedZoneCount, 1, 'detectedZoneCount stays 1 despite 3 sources');
  const soundZone = zoneOf(finding, 'SOUND');
  assert(soundZone.detected, 'SOUND zone detected');
  eq(soundZone.sources.length, 3, 'all three sources preserved in zoneEvidence');
});

/* ══════════════════════════════════════════════════════════════════════════
   Extra edge cases
   ══════════════════════════════════════════════════════════════════════════ */

section('edge: missing scene record -> applicable false, no crash, reason present', () => {
  const input: CrossSceneInput = { ...EMPTY_INPUT, light: toLightInput(LIGHT_NEUTRAL) };
  const findings = analyzeCrossScene(input);
  for (const f of findings) {
    for (const zoneId of ['SOUND', 'MEMORY', 'SENTENCE'] as const) {
      const z = zoneOf(f, zoneId);
      assert(!z.applicable, `${f.id}/${zoneId} not applicable when record missing`);
      assert(typeof z.facts.reason === 'string' && z.facts.reason.length > 0, `${f.id}/${zoneId} has a reason`);
    }
  }
});

section('edge: applicableZoneCount 0 -> no ratio division error', () => {
  const findings = analyzeCrossScene(EMPTY_INPUT);
  const ranked = rankFindings(findings);
  eq(ranked.length, 6, 'still six findings, ranked without throwing');
  for (const f of ranked) {
    eq(f.applicableZoneCount, 0, `${f.id} applicableZoneCount is 0 when every Zone is missing`);
  }
});

section('edge: MEMORY v2 is applicable for ATTENTION_CHOICE_GAP and RECHECK on every visit (the Room, not Drawing)', () => {
  // MEMORY_RETURN never touches the object group — Drawing-only fixture,
  // carried over from before the Room existed — so both traces should read
  // applicable (the Room question is always there to have been answered)
  // but not detected (nothing about the object group was ever recorded).
  const withDrawingOnlyData: CrossSceneInput = { ...EMPTY_INPUT, memory: toMemoryInput(MEMORY_RETURN) };
  const attn = zoneOf(findingFor(analyzeCrossScene(withDrawingOnlyData), 'ATTENTION_CHOICE_GAP'), 'MEMORY');
  const recheck = zoneOf(findingFor(analyzeCrossScene(withDrawingOnlyData), 'RECHECK'), 'MEMORY');
  assert(attn.applicable, 'ATTENTION_CHOICE_GAP/MEMORY applicable — the Room answers this, not Drawing');
  assert(!attn.detected, 'ATTENTION_CHOICE_GAP/MEMORY not detected — no object-group data in this fixture');
  assert(recheck.applicable, 'RECHECK/MEMORY applicable — objectViewPath answers this, not Drawing');
  assert(!recheck.detected, 'RECHECK/MEMORY not detected — no object-group data in this fixture');

  // A record missing entirely is still applicable:false, unchanged from v1.
  const noRecord = zoneOf(findingFor(analyzeCrossScene(EMPTY_INPUT), 'ATTENTION_CHOICE_GAP'), 'MEMORY');
  assert(!noRecord.applicable, 'ATTENTION_CHOICE_GAP/MEMORY still inapplicable with no memorySketch record at all');
});

section('edge: LIGHT and SENTENCE structurally not applicable for PAUSE', () => {
  const full: CrossSceneInput = {
    light: toLightInput(LIGHT_POST_DECISION),
    sound: toSoundInput(SOUND_PAUSE),
    memory: toMemoryInput(MEMORY_PAUSE),
    sentence: toSentenceInput(SENTENCE_POST_DECISION),
  };
  const finding = findingFor(analyzeCrossScene(full), 'PAUSE');
  assert(!zoneOf(finding, 'LIGHT').applicable, 'LIGHT inapplicable for PAUSE');
  assert(!zoneOf(finding, 'SENTENCE').applicable, 'SENTENCE inapplicable for PAUSE');
  eq(finding.applicableZoneCount, 2, 'only SOUND + MEMORY applicable');
  eq(finding.detectedZoneCount, 2, 'both applicable zones detected in this fixture');
  eq(finding.strength, 'secondary' as FindingStrength, 'PAUSE cannot exceed secondary under this zone mapping');
});

section('edge: RECHECK fixtures actually exercise the consecutive-repeat reading, not RETURN_LOOP twice', () => {
  const input: CrossSceneInput = {
    light: toLightInput(LIGHT_RECHECK),
    sound: toSoundInput(SOUND_RECHECK),
    memory: toMemoryInput(MEMORY_NEUTRAL),
    sentence: toSentenceInput(SENTENCE_RECHECK),
  };
  const finding = findingFor(analyzeCrossScene(input), 'RECHECK');
  assert(zoneOf(finding, 'LIGHT').detected, 'LIGHT RECHECK detected');
  assert(zoneOf(finding, 'SOUND').detected, 'SOUND RECHECK detected (REPLAY_LOOP)');
  assert(zoneOf(finding, 'SENTENCE').detected, 'SENTENCE RECHECK detected');
  assert(zoneOf(finding, 'MEMORY').applicable, 'MEMORY applicable in v2 (Room-based)');
  assert(!zoneOf(finding, 'MEMORY').detected, 'MEMORY not detected — MEMORY_NEUTRAL never touches the object group');
  eq(finding.detectedZoneCount, 3, 'three independently-observing zones');
  eq(finding.strength, 'primary' as FindingStrength, 'strength');
});

section('edge: determinism — same input twice gives identical findings and ranking', () => {
  const input: CrossSceneInput = {
    light: toLightInput(LIGHT_RETURN),
    sound: toSoundInput(SOUND_RETURN),
    memory: toMemoryInput(MEMORY_RETURN),
    sentence: toSentenceInput(SENTENCE_RETURN),
  };
  const a = rankFindings(analyzeCrossScene(input));
  const b = rankFindings(analyzeCrossScene(input));
  eq(a, b, 'repeated analysis of identical input is byte-identical');
});

/* ══════════════════════════════════════════════════════════════════════════
   I. Ranking — synthetic Findings, testing rankFindings in isolation.
   ══════════════════════════════════════════════════════════════════════════ */

function synthetic(
  id: CrossSceneTraceId,
  strength: FindingStrength,
  detectedZoneCount: number,
  applicableZoneCount: number,
): CrossSceneFinding {
  return {
    id,
    strength,
    detectedZoneCount,
    applicableZoneCount,
    zoneEvidence: [],
    primaryEvidence: [],
    priority: { RETURN: 60, REVISION: 50, ATTENTION_CHOICE_GAP: 40, POST_DECISION: 30, RECHECK: 20, PAUSE: 10 }[id],
  };
}

section('I. ranking — primary above secondary, PAUSE below same-strength peers, deterministic', () => {
  const findings = [
    synthetic('REVISION', 'secondary', 2, 4),
    synthetic('PAUSE', 'primary', 3, 4),
    synthetic('ATTENTION_CHOICE_GAP', 'secondary', 2, 4),
    synthetic('RETURN', 'primary', 3, 4),
  ];
  const ranked = rankFindings(findings);
  eq(
    ranked.map((f) => f.id),
    ['RETURN', 'PAUSE', 'REVISION', 'ATTENTION_CHOICE_GAP'],
    'RETURN and PAUSE (both primary, RETURN has the higher priority) precede the two secondaries; REVISION before ATTENTION_CHOICE_GAP by priority',
  );

  const ranked2 = rankFindings(findings.slice().reverse());
  eq(
    ranked2.map((f) => f.id),
    ranked.map((f) => f.id),
    'input order does not affect the result',
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   Result
   ══════════════════════════════════════════════════════════════════════════ */

console.log(`\nCross-Scene harness: ${checks} checks / ${failures.length} failures`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
