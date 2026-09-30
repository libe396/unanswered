import { Activity, useEffect, useLayoutEffect, useState, type ComponentType } from 'react';
import { ZONE_FILMS } from '../data/zoneFilms';
import { ZONE_INFO } from '../data/zones';
import { createInteractionClock } from '../lib/interactionClock';
import { InteractionClockContext } from '../hooks/useInteractionClock';
import { useExperienceStore } from '../store/experienceStore';
import type { SceneId } from '../types';
import { ZoneFilmTransition } from './ZoneFilmTransition';

interface Props {
  currentScene: SceneId;
  components: Record<SceneId, ComponentType>;
  onReady: (scene: SceneId, ready: boolean) => void;
}

/** Activity retains drafts/phase/canvas DOM, while cleaning up hidden scene effects. */
function ZoneSlot({ scene, entryScene, active, Component, onReady }: {
  scene: SceneId;
  entryScene: SceneId;
  active: boolean;
  Component: ComponentType;
  onReady: Props['onReady'];
}) {
  const [revealed, setRevealed] = useState(false);
  const [ready, setReady] = useState(false);
  const isPassage = entryScene === 'zone03Intro';
  const [clock] = useState(() => createInteractionClock());
  useLayoutEffect(() => {
    clock.setActive(active && ready && !isPassage);
    return () => clock.setActive(false);
  }, [active, ready, isPassage, clock]);
  useEffect(() => { if (active) onReady(entryScene, ready && !isPassage); }, [active, ready, isPassage, entryScene, onReady]);
  const film = ZONE_FILMS[entryScene]!;

  return <div className="zone-experience" hidden={!active}>
    {/* Prepare the work tree at background priority during playback. Hidden
        Activity does not run its effects, audio, or tracking effects. This
        keeps a large report from blocking the 400ms reveal on first entry. */}
    <Activity mode={active && revealed && !isPassage ? 'visible' : 'hidden'}>
      <InteractionClockContext value={clock.now}>
        <div className="zone-experience__interaction" inert={!ready} aria-hidden={!ready}>
          <Component />
        </div>
      </InteractionClockContext>
    </Activity>
    {active && (!ready || isPassage) && <ZoneFilmTransition
      film={film}
      zone={ZONE_INFO[scene].zone}
      onReveal={() => setRevealed(true)}
      onComplete={() => {
        if (isPassage) {
          // The old sound title scene now holds only the stairs passage.
          useExperienceStore.getState().completeScene('zone03Intro');
        } else {
          setRevealed(true);
          setReady(true);
        }
      }}
    />}
  </div>;
}

export function ZoneExperienceHost({ currentScene, components, onReady }: Props) {
  const [visited, setVisited] = useState<SceneId[]>([]);
  // Stairs and sound share one mounted player, retaining media-element playback
  // permission across the fade. Their files and scene completion remain separate.
  const workScene = currentScene === 'zone03Intro' ? 'soundClues' : currentScene;
  // Add a slot before painting its first video. Slots live until the visit resets.
  if (ZONE_FILMS[currentScene] && !visited.includes(workScene)) {
    setVisited([...visited, workScene]);
  }
  return visited.map((scene) => <ZoneSlot
    key={scene}
    scene={scene}
    entryScene={scene === workScene ? currentScene : scene}
    active={scene === workScene}
    Component={components[scene]}
    onReady={onReady}
  />);
}
