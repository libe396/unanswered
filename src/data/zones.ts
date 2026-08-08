import type { SceneId } from '../types';

/**
 * Wayfinding labels shown consistently across every Scene (see ZoneLabel).
 * Numbering and names follow SCENES.md's scene order exactly. Record Layer
 * keeps its own zone number on each visit (04 / 09) rather than sharing one —
 * the two visits are the same physical space at different points in the
 * story, and SCENES.md already numbers them as distinct steps.
 *
 * Landing sits before Zone 01 — it's the cover, not a numbered space inside
 * the exhibition, so it gets an archive tag instead of a ZONE number.
 */
export const ZONE_INFO: Record<SceneId, { zone: string; label: string }> = {
  landing: { zone: 'UNANSWERED', label: 'Archive' },
  intro: { zone: 'ZONE 01', label: 'Elevator Entry' },
  registration: { zone: 'ZONE 02', label: 'Registration' },
  lightArchive: { zone: 'ZONE 03', label: 'Light Archive' },
  recordLayerFirstVisit: { zone: 'ZONE 04', label: 'Record Layer' },
  zone03Intro: { zone: 'ZONE 05', label: 'Zone 03 Intro' },
  soundClues: { zone: 'ZONE 06', label: 'Sound Clues' },
  memorySketch: { zone: 'ZONE 07', label: 'Memory Sketch' },
  sentenceClues: { zone: 'ZONE 08', label: 'Sentence Clues' },
  recordLayerSecondVisit: { zone: 'ZONE 09', label: 'Record Layer' },
  finalReport: { zone: 'ZONE 10', label: 'Final Report' },
};
