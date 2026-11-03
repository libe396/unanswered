import { MEMORY_ROOM_OBJECTS, SENTENCE_RECONSTRUCTION_FRAGMENTS, SOUND_CLUES } from '../data/content';
import type { RecordLayerDerived, SceneBehaviorRecord, SceneId } from '../types';
import { sentenceDwellNote } from './sentenceDwellNote';
import { OBJECT_GROUP } from './memoryTracking';
import { summarizeSound } from './soundTracking';
import type { ReportFinding } from './reportStageFacts';

export type ActionEvidenceKind = 'dwell' | 'removed' | 'replay' | 'selection';
export type ActionEvidenceScene = 'soundClues' | 'memorySketch' | 'sentenceClues';
/** `text` is always `actionEvidenceText(kind, sceneId, targetId, tenths)`; the
 *  structured fields let the mobile report (src/lib/reportShare.ts) carry the
 *  evidence by id and rebuild the identical sentence on the phone. */
export interface ActionEvidence {
  kind: ActionEvidenceKind;
  text: string;
  sceneId: ActionEvidenceScene;
  targetId: string;
  /** Dwell only: seconds × 10, exactly as the sentence shows them. */
  tenths?: number;
}
export type BehaviorRecords = Partial<Record<SceneId, SceneBehaviorRecord>>;
export const PROCESS_GUIDE = '바꾸고, 머물고, 비워 둔 순간까지 함께 적었습니다.';
export const RECORD_MEANING = '이 보고서에는 당신이 고른 단서와\n고르는 동안 남은 움직임이 함께 적혀 있습니다.';
export const RECORD_CLOSING = '누구를 떠올렸는지는 적지 않았습니다.\n당신이 무엇을, 어떻게 골랐는지만 남겼습니다.';

/** A look this long or longer counts toward the hesitation conclusion. */
export const HESITATION_VIEW_MS = 1000;

/** Whether the visit left any hesitation evidence: a return, a changed choice,
 *  a replayed sound, or a look of `HESITATION_VIEW_MS`+. Picks the conclusion
 *  line; reads existing Findings and raw events only. */
export function hasHesitationEvidence(findings: readonly ReportFinding[], record: RecordLayerDerived, behavior: BehaviorRecords = {}): boolean {
  if (findings.some((finding) => finding.kind === 'return' || finding.kind === 'revision' || finding.kind === 'replay')) return true;
  const replays = behavior.soundClues ? Object.values(summarizeSound(behavior.soundClues).replayCountBySound)
    : record.soundClues.events.map((event) => event.replayCount);
  if (replays.some((count) => Number.isInteger(count) && count > 0)) return true;
  return Object.values(behavior).some((scene) => scene?.events.some((event) =>
    event.type === 'deselect' || (event.type === 'view' && event.durationMs >= HESITATION_VIEW_MS)));
}

function objectParticle(label: string): string {
  const code = label.charCodeAt(label.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0 ? '을' : '를';
}

/** The one place each evidence sentence is worded. Null for an id that no
 *  longer exists in content, so a stale shared link drops that line. */
export function actionEvidenceText(kind: ActionEvidenceKind, sceneId: ActionEvidenceScene, targetId: string, tenths = 0): string | null {
  if (sceneId === 'sentenceClues') {
    const fragment = SENTENCE_RECONSTRUCTION_FRAGMENTS.find((item) => item.id === targetId);
    if (!fragment) return null;
    if (kind === 'dwell') return `‘${fragment.text}’ 앞에 ${(tenths / 10).toFixed(1)}초 머물렀습니다.`;
    return kind === 'selection' ? `‘${fragment.text}’라는 문장을 골랐습니다.` : null;
  }
  if (sceneId === 'soundClues') {
    const sound = SOUND_CLUES.find((item) => item.id === targetId);
    if (!sound) return null;
    if (kind === 'replay') return `‘${sound.label}’를 다시 들었습니다.`;
    return kind === 'selection' ? `‘${sound.label}’를 골랐습니다.` : null;
  }
  const object = MEMORY_ROOM_OBJECTS.find((item) => item.id === targetId);
  if (!object) return null;
  if (kind === 'removed') return `‘${object.label}’${objectParticle(object.label)} 선택했다가 해제했습니다.`;
  return kind === 'selection' ? `‘${object.label}’${objectParticle(object.label)} 골랐습니다.` : null;
}

function evidence(kind: ActionEvidenceKind, sceneId: ActionEvidenceScene, targetId: string, tenths?: number): ActionEvidence {
  const item: ActionEvidence = { kind, text: actionEvidenceText(kind, sceneId, targetId, tenths) ?? '', sceneId, targetId };
  if (tenths !== undefined) item.tenths = tenths;
  return item;
}

/** Presentation only. Reuse measured dwell/tie rules and the existing replay reader. */
export function buildActionEvidence(record: RecordLayerDerived, behavior: BehaviorRecords = {}): ActionEvidence[] {
  const items: ActionEvidence[] = [];
  record.sentenceClues.selectedSentenceIds.some((id, index) => {
    const fragment = SENTENCE_RECONSTRUCTION_FRAGMENTS.find((item) => item.id === id);
    if (!fragment || !sentenceDwellNote(record, index)) return false;
    items.push(evidence('dwell', 'sentenceClues', id, Math.round(Number((record.sentenceClues.dwellTimes[id] / 1000).toFixed(1)) * 10)));
    return true;
  });

  const selected = new Set<string>();
  for (const event of behavior.memorySketch?.events ?? []) {
    if ((event.type !== 'select' && event.type !== 'deselect') || event.group !== OBJECT_GROUP || !Number.isFinite(event.at)) continue;
    if (event.type === 'select') selected.add(event.targetId);
    else if (selected.delete(event.targetId)) {
      const object = MEMORY_ROOM_OBJECTS.find((item) => item.id === event.targetId);
      if (object) { items.push(evidence('removed', 'memorySketch', object.id)); break; }
    }
  }

  const replays = behavior.soundClues ? summarizeSound(behavior.soundClues).replayCountBySound :
    Object.fromEntries(record.soundClues.events.map((event) => [event.soundId, event.replayCount]));
  const sound = SOUND_CLUES.find((item) => Number.isInteger(replays[item.id]) && replays[item.id] > 0);
  if (sound) items.push(evidence('replay', 'soundClues', sound.id));
  if (items.length) return items.slice(0, 3);

  // No process evidence: only explicit selections, never invented durations/actions.
  const fragment = SENTENCE_RECONSTRUCTION_FRAGMENTS.find((item) => item.id === record.sentenceClues.selectedSentenceIds[0]);
  if (fragment) items.push(evidence('selection', 'sentenceClues', fragment.id));
  const selectedSound = SOUND_CLUES.find((item) => item.id === record.soundClues.selectedSoundId);
  if (selectedSound) items.push(evidence('selection', 'soundClues', selectedSound.id));
  const object = MEMORY_ROOM_OBJECTS.find((item) => item.id === record.memorySketch.selectedObjects[0]);
  if (object) items.push(evidence('selection', 'memorySketch', object.id));
  return items.slice(0, 3);
}
