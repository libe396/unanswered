import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ComponentType } from 'react';
import { useExperienceStore } from '../store/experienceStore';
import { LandingScene } from '../scenes/LandingScene';
import { IntroScene } from '../scenes/IntroScene';
import { RegistrationScene } from '../scenes/RegistrationScene';
import { LightArchiveScene } from '../scenes/LightArchiveScene';
import { RecordLayerFirstVisitScene } from '../scenes/RecordLayerFirstVisitScene';
import { Zone03IntroScene } from '../scenes/Zone03IntroScene';
import { SoundCluesScene } from '../scenes/SoundCluesScene';
import { MemorySketchScene } from '../scenes/MemorySketchScene';
import { SentenceCluesScene } from '../scenes/SentenceCluesScene';
import { RecordLayerSecondVisitScene } from '../scenes/RecordLayerSecondVisitScene';
import { FinalReportScene } from '../scenes/FinalReportScene';
import type { SceneId } from '../types';
import { DevSceneNav } from './DevSceneNav';
import { ZoneLabel } from './ZoneLabel';

const SCENE_COMPONENTS: Record<SceneId, ComponentType> = {
  landing: LandingScene,
  intro: IntroScene,
  registration: RegistrationScene,
  lightArchive: LightArchiveScene,
  recordLayerFirstVisit: RecordLayerFirstVisitScene,
  zone03Intro: Zone03IntroScene,
  soundClues: SoundCluesScene,
  memorySketch: MemorySketchScene,
  sentenceClues: SentenceCluesScene,
  recordLayerSecondVisit: RecordLayerSecondVisitScene,
  finalReport: FinalReportScene,
};

const motionVariants: Variants = {
  initial: { opacity: 0, scale: 0.98, filter: 'blur(8px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 1.02, filter: 'blur(8px)' },
};

const reducedVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/** A true cut: no fade in, no fade out, no blur, no scale. */
const cutVariants: Variants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 1 },
};

/**
 * Landing and Elevator Entry are joined by a match cut, so both are listed.
 *
 * Landing ends on a vertical line of light and Elevator Entry opens on the same
 * line in the same place, which only works as one continuous shot if nothing at
 * all happens between the two frames.
 *
 * Both ends have to be listed, not just the incoming one. AnimatePresence keeps
 * an exiting child rendered with the props it last had, so listing only 'intro'
 * left Landing exiting on the default 0.9s blur-and-scale — and because the mode
 * is "wait", the elevator did not mount until that finished. Measured: the store
 * changed at 1312ms and IntroScene mounted at 2228ms, with a blurred gap in
 * between where the cut was supposed to be.
 */
const MATCH_CUT_SCENES: ReadonlySet<SceneId> = new Set<SceneId>(['landing', 'intro']);

export function SceneController() {
  const currentScene = useExperienceStore((s) => s.currentScene);
  const prefersReducedMotion = useReducedMotion();
  const ActiveScene = SCENE_COMPONENTS[currentScene];
  const isMatchCut = MATCH_CUT_SCENES.has(currentScene);

  const variants = isMatchCut ? cutVariants : prefersReducedMotion ? reducedVariants : motionVariants;
  const transition = isMatchCut
    ? { duration: 0 }
    : prefersReducedMotion
      ? { duration: 0.15 }
      : { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScene}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={variants}
          transition={transition}
        >
          <ActiveScene />
        </motion.div>
      </AnimatePresence>
      <ZoneLabel />
      <DevSceneNav />
    </>
  );
}
