import type { RecordLayerDerived } from '../types';
import { SENTENCE_THRESHOLDS } from './sentenceThresholds';

/** Only measured, selected fragments with a unique longest dwell receive a note. */
export function sentenceDwellNote(record: RecordLayerDerived, index: number): string | null {
  const { selectedSentenceIds: ids, dwellTimes } = record.sentenceClues;
  const id = ids[index];
  const ms = dwellTimes[id];
  if (!id || !Number.isFinite(ms) || ms < SENTENCE_THRESHOLDS.viewSelectionGapMinDwellMs) return null;
  if (Object.entries(dwellTimes).some(([other, value]) => other !== id && value >= ms)) return null;
  return `가장 오래 살펴본 문장 · ${(ms / 1000).toFixed(1)}초`;
}
