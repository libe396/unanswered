import type { SceneId } from '../types';

/**
 * Wayfinding labels shown consistently across every Scene (see ZoneLabel).
 * This is the one source of truth for a Scene's displayed zone number and
 * name — deliberately its own Record, not derived from SCENE_ORDER's index,
 * because SCENE_ORDER is a navigation sequence (it grows whenever a
 * transition Scene like introFilm or investigationStart is inserted, or a
 * Scene turns out to be unreachable) while the numbers here are exhibition
 * numbering, shown to a visitor, and must stay a clean 01→08 run regardless
 * of how many navigation-only Scenes sit between them. Any Scene that shows
 * its own zone badge inline (see ZoneIntroCard usages in LightArchiveScene,
 * Zone03IntroScene, MemorySketchScene, SentenceCluesScene) reads its number
 * from here too, so the corner ZoneLabel and the centered intro card can
 * never disagree.
 *
 * Landing sits before Zone 01 — it's the cover, not a numbered space inside
 * the exhibition, so it gets an archive tag instead of a ZONE number.
 *
 * The visitor-facing sequence this Record produces:
 *   01 Elevator Entry · 02 Registration · 03 Light Archive · 04 Sound Clues
 *   · 05 Memory Sketch · 06 Sentence Clues · 07 Record Layer · 08 Final Report
 */
export const ZONE_INFO: Record<SceneId, { zone: string; label: string }> = {
  landing: { zone: 'UNANSWERED', label: 'Archive' },
  intro: { zone: 'ZONE 01', label: 'Elevator Entry' },
  // Not shown — ZoneLabel hides on this Scene along with landing. The film
  // carries its own subtitles; a wayfinding label over it would be a second
  // caption fighting the first.
  introFilm: { zone: 'ZONE 01', label: 'Intro Film' },
  // Not shown — same reasoning as introFilm. This Scene is one held breath
  // continuing the film's black-out, not a new space with its own heading.
  investigationStart: { zone: 'ZONE 01', label: 'Investigation Start' },
  registration: { zone: 'ZONE 02', label: 'Registration' },
  lightArchive: { zone: 'ZONE 03', label: 'Light Archive' },
  // Unreachable in the real flow — see the SCENE_ORDER comment in
  // experienceStore.ts. Kept out of the visitor-facing 01–08 run entirely
  // (rather than parked on a retired number) so nobody sees a gap for a
  // Scene they could never have skipped. The entry itself stays, purely so
  // `ZONE_INFO` can remain a total Record over SceneId — this value is
  // never rendered, since the Scene it describes is never reached and
  // DevSceneNavigator's list is built from SCENE_ORDER, which doesn't
  // include it either.
  recordLayerFirstVisit: { zone: 'ZONE —', label: 'Record Layer (unused)' },
  // zone03Intro and soundClues are two Scenes for one physical zone — the
  // ZoneIntroCard beat, then the experience itself (see ZoneIntroCard.tsx's
  // "Zone Intro → Experience" rhythm; every other Zone does both in a single
  // Scene). They must always carry the *same* zone number. Label mirrors
  // soundClues's — this card is what introduces Sound Clues, not a distinct
  // "Zone 03 Intro" space of its own.
  zone03Intro: { zone: 'ZONE 04', label: 'Sound Clues' },
  soundClues: { zone: 'ZONE 04', label: 'Sound Clues' },
  memorySketch: { zone: 'ZONE 05', label: 'Memory Sketch' },
  sentenceClues: { zone: 'ZONE 06', label: 'Sentence Clues' },
  recordLayerSecondVisit: { zone: 'ZONE 07', label: 'Record Layer' },
  finalReport: { zone: 'ZONE 08', label: 'Final Report' },
};
