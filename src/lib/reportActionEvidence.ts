import { MEMORY_ROOM_OBJECTS, SENTENCE_RECONSTRUCTION_FRAGMENTS, SOUND_CLUES } from '../data/content';
import type { RecordLayerDerived, SceneBehaviorRecord, SceneId } from '../types';
import { sentenceDwellNote } from './sentenceDwellNote';
import { OBJECT_GROUP } from './memoryTracking';
import { summarizeSound } from './soundTracking';

export interface ActionEvidence { kind: 'dwell' | 'removed' | 'replay' | 'selection'; text: string }
export type BehaviorRecords = Partial<Record<SceneId, SceneBehaviorRecord>>;
export const PROCESS_GUIDE = '고른 단서뿐 아니라, 선택에 이르는 과정도 기록에 남았습니다.';
export const RECORD_MEANING = '누구를 떠올렸든, 선택의 순간에는 당신이 있었습니다.\n이 보고서는 그 순간에 남은 당신의 흔적을 모았습니다.';
export const RECORD_CLOSING = '보고서에 적히는 것은 결론이 아니라 흔적입니다.';

function objectParticle(label: string): string {
  const code = label.charCodeAt(label.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0 ? '을' : '를';
}

/** Presentation only. Reuse measured dwell/tie rules and the existing replay reader. */
export function buildActionEvidence(record: RecordLayerDerived, behavior: BehaviorRecords = {}): ActionEvidence[] {
  const items: ActionEvidence[] = [];
  record.sentenceClues.selectedSentenceIds.some((id, index) => {
    const fragment = SENTENCE_RECONSTRUCTION_FRAGMENTS.find((item) => item.id === id);
    if (!fragment || !sentenceDwellNote(record, index)) return false;
    items.push({ kind: 'dwell', text: `‘${fragment.text}’ 앞에 ${(record.sentenceClues.dwellTimes[id] / 1000).toFixed(1)}초 머물렀습니다.` });
    return true;
  });

  const selected = new Set<string>();
  for (const event of behavior.memorySketch?.events ?? []) {
    if ((event.type !== 'select' && event.type !== 'deselect') || event.group !== OBJECT_GROUP || !Number.isFinite(event.at)) continue;
    if (event.type === 'select') selected.add(event.targetId);
    else if (selected.delete(event.targetId)) {
      const object = MEMORY_ROOM_OBJECTS.find((item) => item.id === event.targetId);
      if (object) { items.push({ kind: 'removed', text: `‘${object.label}’${objectParticle(object.label)} 선택했다가 해제했습니다.` }); break; }
    }
  }

  const replays = behavior.soundClues ? summarizeSound(behavior.soundClues).replayCountBySound :
    Object.fromEntries(record.soundClues.events.map((event) => [event.soundId, event.replayCount]));
  const sound = SOUND_CLUES.find((item) => Number.isInteger(replays[item.id]) && replays[item.id] > 0);
  if (sound) items.push({ kind: 'replay', text: `‘${sound.label}’를 다시 들었습니다.` });
  if (items.length) return items.slice(0, 3);

  // No process evidence: only explicit selections, never invented durations/actions.
  const fragment = SENTENCE_RECONSTRUCTION_FRAGMENTS.find((item) => item.id === record.sentenceClues.selectedSentenceIds[0]);
  if (fragment) items.push({ kind: 'selection', text: `‘${fragment.text}’을 골랐습니다.` });
  const selectedSound = SOUND_CLUES.find((item) => item.id === record.soundClues.selectedSoundId);
  if (selectedSound) items.push({ kind: 'selection', text: `‘${selectedSound.label}’를 골랐습니다.` });
  const object = MEMORY_ROOM_OBJECTS.find((item) => item.id === record.memorySketch.selectedObjects[0]);
  if (object) items.push({ kind: 'selection', text: `‘${object.label}’${objectParticle(object.label)} 골랐습니다.` });
  return items.slice(0, 3);
}
