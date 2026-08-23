/**
 * Production-safe input builder for src/lib/crossSceneAnalysis.ts.
 *
 * Extracted from src/hooks/useCrossSceneDebug.ts's former private
 * `buildCrossSceneInput()` so both the dev console and the Final Report can
 * read the same translation from `state.behavior` into a `CrossSceneInput`
 * — nothing here computes a new figure or a new threshold; every read is
 * reused verbatim from the Tracking/Pattern layer (summarizeScene,
 * summarizeSound, summarizeMemory, summarizeSentence and their matching
 * detect*Patterns functions).
 *
 * Pure and store-independent by construction: takes `behavior` as a
 * parameter rather than reaching into `useExperienceStore` itself, so it can
 * be called from a Scene component (see src/lib/reportStageFacts.ts) or a
 * test with no store, no DOM, and no browser in sight — the same guarantee
 * src/lib/crossSceneAnalysis.ts's module doc asks of everything downstream
 * of this file.
 */
import { summarizeScene } from './behaviorTracking';
import { detectPatterns } from './behaviorPatterns';
import { summarizeSound } from './soundTracking';
import { detectSoundPatterns } from './soundPatterns';
import { detectPositionPatterns } from './positionPatterns';
import { summarizeMemory } from './memoryTracking';
import { detectMemoryPatterns } from './memoryPatterns';
import { summarizeSentence } from './sentenceTracking';
import { detectSentencePatterns } from './sentencePatterns';
import type { CrossSceneInput } from './crossSceneAnalysis';
import type { SceneBehaviorRecord, SceneId } from '../types';

export function buildCrossSceneInput(
  behavior: Partial<Record<SceneId, SceneBehaviorRecord>>,
): CrossSceneInput {
  const lightRecord = behavior.lightArchive;
  const light: CrossSceneInput['light'] = (() => {
    if (!lightRecord) return null;
    const scene = summarizeScene(lightRecord);
    const imageGroup = scene.groups.image;
    if (!imageGroup) return null;
    const emotionGroup = scene.groups.emotion ?? null;
    return {
      imageGroup,
      emotionGroup,
      imagePatterns: detectPatterns(imageGroup),
      emotionPatterns: emotionGroup ? detectPatterns(emotionGroup) : null,
    };
  })();

  const soundRecord = behavior.soundClues;
  const sound: CrossSceneInput['sound'] = (() => {
    if (!soundRecord) return null;
    const summary = summarizeSound(soundRecord);
    return {
      summary,
      soundPatterns: detectSoundPatterns(summary),
      positionPatterns: detectPositionPatterns(summary),
    };
  })();

  const memoryRecord = behavior.memorySketch;
  const memory: CrossSceneInput['memory'] = (() => {
    if (!memoryRecord) return null;
    const summary = summarizeMemory(memoryRecord);
    return { summary, patterns: detectMemoryPatterns(summary) };
  })();

  const sentenceRecord = behavior.sentenceClues;
  const sentence: CrossSceneInput['sentence'] = (() => {
    if (!sentenceRecord) return null;
    const summary = summarizeSentence(sentenceRecord);
    return { summary, patterns: detectSentencePatterns(summary) };
  })();

  return { light, sound, memory, sentence };
}
