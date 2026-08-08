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

export function SceneController() {
  const currentScene = useExperienceStore((s) => s.currentScene);
  const prefersReducedMotion = useReducedMotion();
  const ActiveScene = SCENE_COMPONENTS[currentScene];

  const variants = prefersReducedMotion ? reducedVariants : motionVariants;
  const transition = prefersReducedMotion
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
