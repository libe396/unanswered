import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ARCHIVE_META } from '../../archiveMeta.js';
import { MEMORY_ROOM_OBJECTS, SENTENCE_RECONSTRUCTION_FRAGMENTS, SOUND_CLUES } from '../../data/content';
import { summarizeSound } from '../../lib/soundTracking';
import { useExperienceStore } from '../../store/experienceStore';
import type { BehaviorEvent, SceneBehaviorRecord, SceneId } from '../../types';
import './TraceReplay.css';

/**
 * REPORT · 증거 재생.
 *
 * Replays what the visitor did in one Zone from the events that Zone already
 * saved — nothing is collected for this, and nothing is invented. The
 * highlight moves between choices in `view` order only: the cursor's path
 * between them was never recorded, so it is not drawn.
 *
 * Every panel is compressed onto the same timeline of at most 6 seconds.
 */

const MAX_REPLAY_MS = 6000;

type ChoiceKind = 'view' | 'select' | 'deselect';
interface ChoiceStep { kind: ChoiceKind; target: string; weight: number }
interface ChoiceTrack { options: { id: string; label: string }[]; steps: ChoiceStep[] }
interface SoundStep { target: string; weight: number }
interface PathStep { points: { x: number; y: number }[]; weight: number }
interface SketchStep { kind: 'stroke' | 'remove'; id: string[]; points: { x: number; y: number }[]; color: string; weight: number }

interface ReplayModel {
  choice: ChoiceTrack | null;
  sound: SoundStep[] | null;
  path: PathStep[] | null;
  sketch: SketchStep[] | null;
  facts: string[];
}

const CHOICE_GROUP: Partial<Record<SceneId, string>> = {
  lightArchive: 'image',
  memorySketch: 'object',
  sentenceClues: 'sentence',
};

const ZONE_NAME: Partial<Record<SceneId, string>> = {
  lightArchive: '빛',
  soundClues: '소리',
  memorySketch: '기억',
  sentenceClues: '문장',
};

const CHOICE_NOUN: Partial<Record<SceneId, { unit: string; noun: string }>> = {
  lightArchive: { unit: '장의 사진', noun: '사진' },
  memorySketch: { unit: '개의 물건', noun: '물건' },
  sentenceClues: { unit: '개의 문장', noun: '문장' },
};

function objectParticle(label: string): string {
  const code = label.charCodeAt(label.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0 ? '을' : '를';
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function choiceOptions(sceneId: SceneId, touched: string[]): { id: string; label: string }[] {
  if (sceneId === 'lightArchive') {
    return (ARCHIVE_META as Array<{ slot: string }>).map(({ slot }) => ({ id: `IMAGE_${slot}`, label: `사진 ${slot}` }));
  }
  if (sceneId === 'memorySketch') return MEMORY_ROOM_OBJECTS.map((o) => ({ id: o.id, label: o.label }));
  // Twenty fragments are too many to lay out; only the ones the visitor touched.
  return touched.flatMap((id) => {
    const fragment = SENTENCE_RECONSTRUCTION_FRAGMENTS.find((f) => f.id === id);
    if (!fragment) return [];
    const text = fragment.text.length > 14 ? `${fragment.text.slice(0, 13)}…` : fragment.text;
    return [{ id, label: text }];
  });
}

function buildChoiceTrack(sceneId: SceneId, events: BehaviorEvent[]): ChoiceTrack | null {
  const group = CHOICE_GROUP[sceneId];
  if (!group) return null;
  const steps: ChoiceStep[] = [];
  for (const event of events) {
    if (!('group' in event) || event.group !== group) continue;
    if (event.type === 'view') steps.push({ kind: 'view', target: event.targetId, weight: clamp(event.durationMs, 250, 8000) });
    else if (event.type === 'select') steps.push({ kind: 'select', target: event.targetId, weight: 400 });
    else if (event.type === 'deselect') steps.push({ kind: 'deselect', target: event.targetId, weight: 500 });
    else if (event.type === 'fragmentAdd') steps.push({ kind: 'select', target: event.fragmentId, weight: 400 });
    else if (event.type === 'fragmentRemove') steps.push({ kind: 'deselect', target: event.fragmentId, weight: 500 });
  }
  if (steps.length === 0) return null;
  const touched = [...new Set(steps.map((step) => step.target))];
  const options = choiceOptions(sceneId, touched).filter((option) => sceneId !== 'sentenceClues' || touched.includes(option.id));
  return { options, steps };
}

function buildModel(sceneId: SceneId, record: SceneBehaviorRecord | undefined): ReplayModel {
  const events = record?.events ?? [];
  const facts: string[] = [];
  const choice = buildChoiceTrack(sceneId, events);

  if (choice) {
    const views = choice.steps.filter((step) => step.kind === 'view');
    const distinct = new Set(views.map((step) => step.target)).size;
    const moves = views.reduce((n, step, i) => (i > 0 && views[i - 1].target !== step.target ? n + 1 : n), 0);
    const noun = CHOICE_NOUN[sceneId];
    if (noun && distinct >= 2 && moves >= 1) {
      facts.push(`${ZONE_NAME[sceneId]} 구역에서 ${distinct}${noun.unit} 사이를 ${moves}번 오갔습니다.`);
    }
    const removed = choice.steps.filter((step) => step.kind === 'deselect');
    const readded = removed.some((step) =>
      choice.steps
        .slice(choice.steps.indexOf(step) + 1)
        .some((later) => later.kind === 'select' && later.target === step.target),
    );
    if (readded && noun) facts.push(`한 번 고른 ${noun.noun}을 뺐다가 다시 넣었습니다.`);
    else if (removed[0]) {
      const label = choice.options.find((o) => o.id === removed[0].target)?.label ?? '';
      if (label) facts.push(`「${label}」${objectParticle(label)} 골랐다가 뺐습니다.`);
    }
  }

  let sound: SoundStep[] | null = null;
  let path: PathStep[] | null = null;
  if (sceneId === 'soundClues' && record) {
    const plays = events.filter((e): e is Extract<BehaviorEvent, { type: 'play' }> => e.type === 'play');
    sound = plays.length ? plays.map((play) => ({ target: play.targetId, weight: clamp(play.listenedMs, 300, 8000) })) : null;
    const replays = summarizeSound(record).replayCountBySound;
    for (const clue of SOUND_CLUES) {
      const n = replays[clue.id] ?? 0;
      if (n > 0) facts.push(`「${clue.label}」${objectParticle(clue.label)} ${n}번 다시 들었습니다.`);
    }
    const positions = events.filter((e): e is Extract<BehaviorEvent, { type: 'position' }> => e.type === 'position');
    path = positions.length
      ? positions.map((p) => ({ points: p.path.map(({ x, y }) => ({ x, y })), weight: clamp(p.at - p.startedAt, 300, 4000) }))
      : null;
    if (positions.length > 1) facts.push(`소리의 자리를 ${positions.length - 1}번 옮겼습니다.`);
  }

  let sketch: SketchStep[] | null = null;
  if (sceneId === 'memorySketch') {
    const steps: SketchStep[] = [];
    for (const event of events) {
      if (event.type === 'stroke' && !event.discarded && event.points.length) {
        steps.push({
          kind: 'stroke',
          id: [event.strokeId],
          points: event.points.map(({ x, y }) => ({ x, y })),
          color: event.color,
          weight: clamp(event.at - event.startedAt, 300, 4000),
        });
      } else if (event.type === 'strokeRemove') {
        steps.push({ kind: 'remove', id: event.strokeIds, points: [], color: '', weight: 500 });
      }
    }
    sketch = steps.length ? steps : null;
    const drawn = steps.filter((s) => s.kind === 'stroke').length;
    const removed = new Set(steps.filter((s) => s.kind === 'remove').flatMap((s) => s.id)).size;
    if (removed > 0) facts.push(`선 ${drawn}개를 그리고, ${removed}개를 지웠습니다.`);
  }

  return { choice, sound, path, sketch, facts: facts.slice(0, 3) };
}

/** True when the Zone left anything this component can replay. */
export function hasTraceReplay(sceneId: SceneId, record: SceneBehaviorRecord | undefined): boolean {
  const model = buildModel(sceneId, record);
  return Boolean(model.choice || model.sound || model.path || model.sketch);
}

/** Where `progress` (0–1) falls among weighted steps: index and fraction. */
function locate(weights: number[], progress: number): { index: number; fraction: number } {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const target = progress * total;
  for (let i = 0; i < weights.length; i += 1) {
    if (target < acc + weights[i]) return { index: i, fraction: (target - acc) / weights[i] };
    acc += weights[i];
  }
  return { index: weights.length, fraction: 0 };
}

function ChoicePanel({ track, progress }: { track: ChoiceTrack; progress: number }) {
  const { index, fraction } = locate(track.steps.map((s) => s.weight), progress);
  const filled = new Set<string>();
  const struck = new Set<string>();
  for (let i = 0; i < Math.min(index + (fraction > 0 ? 1 : 0), track.steps.length); i += 1) {
    const step = track.steps[i];
    if (step.kind === 'select') { filled.add(step.target); struck.delete(step.target); }
    if (step.kind === 'deselect') { filled.delete(step.target); struck.add(step.target); }
  }
  const current = track.steps[index];
  const active = current?.kind === 'view' ? current.target : null;
  const fresh = current?.kind === 'deselect' ? current.target : null;
  return (
    <ul className="trace-replay__chips">
      {track.options.map((option) => (
        <li
          key={option.id}
          className={[
            'trace-replay__chip',
            active === option.id ? 'trace-replay__chip--active' : '',
            filled.has(option.id) ? 'trace-replay__chip--filled' : '',
            struck.has(option.id) ? 'trace-replay__chip--struck' : '',
            fresh === option.id ? 'trace-replay__chip--striking' : '',
          ].join(' ')}
        >
          {option.label}
        </li>
      ))}
    </ul>
  );
}

function SoundPanel({ steps, progress, replays }: { steps: SoundStep[]; progress: number; replays: Record<string, number> }) {
  const { index } = locate(steps.map((s) => s.weight), progress);
  const counts: Record<string, number> = {};
  steps.slice(0, Math.min(steps.length, index + 1)).forEach((s) => { counts[s.target] = (counts[s.target] ?? 0) + 1; });
  const totals: Record<string, number> = {};
  steps.forEach((s) => { totals[s.target] = (totals[s.target] ?? 0) + 1; });
  const max = Math.max(1, ...Object.values(totals));
  const done = progress >= 1;
  return (
    <ul className="trace-replay__bars">
      {SOUND_CLUES.map((clue) => (
        <li key={clue.id} className="trace-replay__bar-row">
          <span className="trace-replay__bar-label">{clue.label}</span>
          <span className="trace-replay__bar-track">
            <span className="trace-replay__bar-fill" style={{ width: `${((counts[clue.id] ?? 0) / max) * 100}%` }} />
          </span>
          <span className="trace-replay__bar-note">
            {done && (replays[clue.id] ?? 0) > 0 ? `다시 들음 ×${replays[clue.id]}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

function partialPoints(points: { x: number; y: number }[], fraction: number) {
  const count = Math.max(1, Math.ceil(points.length * fraction));
  return points.slice(0, count);
}

const toPolyline = (points: { x: number; y: number }[], w: number, h: number) =>
  points.map((p) => `${(p.x * w).toFixed(1)},${(p.y * h).toFixed(1)}`).join(' ');

function PathPanel({ steps, progress }: { steps: PathStep[]; progress: number }) {
  const { index, fraction } = locate(steps.map((s) => s.weight), progress);
  const visible = steps.slice(0, Math.min(index, steps.length)).map((s) => s.points);
  if (index < steps.length) visible.push(partialPoints(steps[index].points, fraction));
  const last = visible[visible.length - 1]?.[visible[visible.length - 1].length - 1];
  return (
    <div className="trace-replay__field">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <rect x="0.5" y="0.5" width="199" height="199" className="trace-replay__field-frame" />
        {visible.map((points, i) => (
          <polyline key={i} points={toPolyline(points, 200, 200)} className="trace-replay__field-path" />
        ))}
        {last ? <circle cx={last.x * 200} cy={last.y * 200} r="5" className="trace-replay__field-dot" /> : null}
      </svg>
      <span className="trace-replay__axis trace-replay__axis--x">흐릿함 ← → 선명함</span>
      <span className="trace-replay__axis trace-replay__axis--y">가까이 ↑ ↓ 멀리</span>
    </div>
  );
}

function SketchPanel({ steps, progress }: { steps: SketchStep[]; progress: number }) {
  const { index, fraction } = locate(steps.map((s) => s.weight), progress);
  const removedAt = new Map<string, number>();
  steps.forEach((s, i) => { if (s.kind === 'remove' && i < index) s.id.forEach((id) => removedAt.set(id, i)); });
  return (
    <svg className="trace-replay__sketch" viewBox="0 0 300 200" aria-hidden="true">
      {steps.map((s, i) => {
        if (s.kind !== 'stroke' || i > index) return null;
        const points = i === index ? partialPoints(s.points, fraction) : s.points;
        if (points.length < 1) return null;
        return (
          <polyline
            key={s.id[0]}
            points={toPolyline(points.length === 1 ? [points[0], points[0]] : points, 300, 200)}
            stroke={s.color}
            className={`trace-replay__stroke${removedAt.has(s.id[0]) ? ' trace-replay__stroke--removed' : ''}`}
          />
        );
      })}
    </svg>
  );
}

interface TraceReplayProps {
  sceneId: SceneId;
  onDone?: () => void;
  /** Called on "다시 보기", so a stage can hold its next beat again. */
  onRestart?: () => void;
}

export function TraceReplay({ sceneId, onDone, onRestart }: TraceReplayProps) {
  const reduced = useReducedMotion();
  const record = useExperienceStore((s) => s.behavior[sceneId]);
  const model = useMemo(() => buildModel(sceneId, record), [sceneId, record]);
  const replays = useMemo(() => (sceneId === 'soundClues' && record ? summarizeSound(record).replayCountBySound : {}), [sceneId, record]);
  const [run, setRun] = useState(0);
  const [progress, setProgress] = useState(reduced ? 1 : 0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (reduced) {
      setProgress(1);
      doneRef.current?.();
      return;
    }
    setProgress(0);
    let raf = 0;
    let start: number | null = null;
    const frame = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / MAX_REPLAY_MS);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(frame);
      else doneRef.current?.();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [run, reduced]);

  if (!model.choice && !model.sound && !model.path && !model.sketch) return null;

  return (
    <div className="trace-replay">
      <p className="trace-replay__label">{ZONE_NAME[sceneId]} 구역 · 기록 재생</p>
      <div className="trace-replay__panels">
        {model.choice ? <ChoicePanel track={model.choice} progress={progress} /> : null}
        {model.sound ? <SoundPanel steps={model.sound} progress={progress} replays={replays} /> : null}
        {model.path ? <PathPanel steps={model.path} progress={progress} /> : null}
        {model.sketch ? <SketchPanel steps={model.sketch} progress={progress} /> : null}
      </div>
      <div className="trace-replay__facts" aria-live="polite">
        {progress >= 1 ? model.facts.map((fact) => <p key={fact}>{fact}</p>) : null}
      </div>
      {progress >= 1 && !reduced ? (
        <button
          type="button"
          className="trace-replay__again"
          onClick={() => {
            onRestart?.();
            setRun((n) => n + 1);
          }}
        >
          다시 보기
        </button>
      ) : null}
    </div>
  );
}
