/** Local, ephemeral visual/input record. Deliberately outside the persisted report store. */
export type ChoiceScene = 'lightArchive' | 'soundClues' | 'memorySketch' | 'sentenceClues';
export interface ReplayInput {
  t: number;
  kind: 'move' | 'enter' | 'leave' | 'down' | 'up' | 'click' | 'focus' | 'blur';
  x?: number;
  y?: number;
  target: string;
  pointerType?: string;
}
export interface ReplayFrame {
  t: number;
  width: number;
  height: number;
  html: string;
  scroll: Array<[number, number, number]>;
}
export interface ChoiceReplay {
  id: number;
  scene: ChoiceScene;
  phase: string;
  duration: number;
  completed: boolean;
  frames: ReplayFrame[];
  inputs: ReplayInput[];
  styles: string[];
}
let nextId = 0;
let visit: number | string | undefined;
let records: ChoiceReplay[] = [];
const viewedFindings = new Set<string>();
export function hasViewedReplay(key: string) { return viewedFindings.has(key); }
export function markReplayViewed(key: string) { viewedFindings.add(key); }
export function syncReplayVisit(id: number | string) {
  if (visit !== id) { visit = id; records = []; viewedFindings.clear(); }
}
export function beginChoiceReplay(scene: ChoiceScene, phase: string): ChoiceReplay {
  const record: ChoiceReplay = { id: ++nextId, scene, phase, duration: 0, completed: false, frames: [], inputs: [], styles: [] };
  records.push(record);
  return record;
}
export function discardChoiceReplay(record: ChoiceReplay) { records = records.filter(item => item !== record); }
export function getChoiceReplays() { return records.filter(r => r.frames.length > 0 && r.duration > 0); }

/** Last observed event, never interpolated: stationary intervals retain their duration. */
export function replayIndexAt<T extends { t: number }>(events: T[], t: number): number {
  let low = 0, high = events.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (events[mid].t <= t) low = mid + 1;
    else high = mid;
  }
  return low - 1;
}
