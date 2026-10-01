import { MEMORY_ROOM_OBJECTS, SENTENCE_RECONSTRUCTION_FRAGMENTS, SOUND_CLUES } from '../data/content';
import type { RecordLayerDerived, SceneBehaviorRecord, SceneId } from '../types';
import { sentenceDwellNote } from './sentenceDwellNote';
import { OBJECT_GROUP } from './memoryTracking';
import { summarizeSound } from './soundTracking';

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
export const PROCESS_GUIDE = '고른 단서뿐 아니라, 선택에 이르는 과정도 기록에 남았습니다.';
export const RECORD_MEANING = '누구를 떠올렸든, 선택의 순간에는 당신이 있었습니다.\n이 보고서는 그 순간에 남은 당신의 흔적을 모았습니다.';
export const RECORD_CLOSING = '이 보고서는 상상한 사람을 알아맞히는 대신, 고르는 동안 남은 흔적을 기록합니다.';

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
    return kind === 'selection' ? `‘${fragment.text}’을 골랐습니다.` : null;
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
