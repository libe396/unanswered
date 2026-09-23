import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import { useState, type ComponentType } from 'react';
import { useExperienceStore } from '../store/experienceStore';
import { useCrossSceneDebug } from '../hooks/useCrossSceneDebug';
import { LandingScene } from '../scenes/LandingScene';
import { IntroScene } from '../scenes/IntroScene';
import { IntroFilmScene } from '../scenes/IntroFilmScene';
import { InvestigationStartScene } from '../scenes/InvestigationStartScene';
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
import { DevSceneNavigator } from './DevSceneNavigator';
import { PostElevatorSoundManager } from './PostElevatorSoundManager';
import { ZoneLabel } from './ZoneLabel';
import { ArchiveHUD } from './ArchiveHUD';
import { BackButton } from './BackButton';

const SCENE_COMPONENTS: Record<SceneId, ComponentType> = {
  landing: LandingScene,
  intro: IntroScene,
  introFilm: IntroFilmScene,
  investigationStart: InvestigationStartScene,
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
  useCrossSceneDebug();
  const ActiveScene = SCENE_COMPONENTS[currentScene];
  const isMatchCut = MATCH_CUT_SCENES.has(currentScene);

  /*
    The Scene that is actually on screen. `currentScene` changes as soon as a
    Scene completes, but with mode="wait" the outgoing Scene stays mounted for
    its whole exit — so anything rendered outside AnimatePresence that reads
    the store directly runs ahead of what the visitor is looking at.
    `onExitComplete` fires exactly as the incoming Scene mounts, which is the
    beat the ArchiveHUD's zone marker should move on.
  */
  const [displayedScene, setDisplayedScene] = useState<SceneId>(currentScene);

  const variants = isMatchCut ? cutVariants : prefersReducedMotion ? reducedVariants : motionVariants;
  const transition = isMatchCut
    ? { duration: 0 }
    : prefersReducedMotion
      ? { duration: 0.15 }
      : { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <>
      <PostElevatorSoundManager currentScene={currentScene} />
      <AnimatePresence
        mode="wait"
        onExitComplete={() => setDisplayedScene(useExperienceStore.getState().currentScene)}
      >
        <motion.div
          key={currentScene}
          className="scene-frame"
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
      <BackButton />
      {/* Decides for itself which Zones it belongs on — see ArchiveHUD. */}
      <ArchiveHUD scene={displayedScene} />
      {/* Above every Scene and below nothing. Static, decorative, never
          interactive — see .grain-overlay in styles/global.css. */}
      <div className="grain-overlay" aria-hidden="true" />
      <DevSceneNav />
      <DevSceneNavigator />
    </>
  );
}
