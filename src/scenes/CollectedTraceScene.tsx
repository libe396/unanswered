import { useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { renderLightGraphic } from '../lib/lightRenderer.js';
import { summarizeScene } from '../lib/behaviorTracking';
import { MEMORY_ROOM_OBJECTS, SOUND_CLUES } from '../data/content';
import { selectRecordLayerDerived, useExperienceStore } from '../store/experienceStore';
import { TraceLedger } from '../components/TraceLedger';
import type { SceneId } from '../types';
import './CollectedTraceScene.css';

/**
 * The Collected Trace readout — one screen after each clue Zone.
 *
 * Why it exists: in user testing the first three Zones read as a run of
 * choices with nothing coming back ("계속 선택지만 있고 그래서 이게 무슨
 * 결과인거지?"). Every result was deferred to the Final Report, so only
 * LIGHT — which turns a choice into a generated graphic on the spot — felt
 * like it answered anything. This screen gives the other Zones the same
 * beat: the light the visit has generated so far, the clue ledger filling
 * up, and the part of the record the visitor cannot see for themselves —
 * what was logged *besides* the answer.
 *
 * It states figures, never motives: "고르기까지 8.4초" and "바꾼 선택 2회"
 * are what the log holds, and nothing here calls either one hesitation
 * (EXHIBITION_FEEDBACK 개선 항목 4). The reading of those figures is still
 * the Final Report's Personal Findings, which are the only place a
 * relationship between two behaviours is put into words.
 *
 * Collects nothing itself, so it carries the Zone number of the Zone it
 * reports on (see data/zones.ts) and Back steps over it (see
 * BACK_TRANSIT_SCENES in store/experienceStore.ts).
 */
interface Props {
  /** This readout's own Scene, the one it completes to move on. */
  scene: SceneId;
  /** The Zone whose record it reports. */
  reports: SceneId;
  /** Which of the four clues was just filed, 1-based. */
  step: number;
  nextLabel: string;
}

const TOTAL_CLUES = 4;

/** Figures from the Zone's own log — recorded values, not readings of them. */
function zoneMarks(scene: SceneId, behavior: ReturnType<typeof useExperienceStore.getState>['behavior']): string[] {
  const record = behavior[scene];
  if (!record) return [];
  const groups = Object.values(summarizeScene(record).groups);
  if (!groups.length) return [];
  const marks: string[] = [];

  const toFirst = groups
    .map((group) => group.msFromSceneEnterToFirstSelection)
    .filter((value): value is number => typeof value === 'number' && value > 0)
    .sort((a, b) => a - b)[0];
  if (toFirst) marks.push(`고르기까지 ${(toFirst / 1000).toFixed(1)}초`);

  const changes = groups.reduce((sum, group) => sum + group.selectionChangeCount, 0);
  if (changes > 0) marks.push(`바꾼 선택 ${changes}회`);

  // Only when the record can tell the two apart: something was looked at
  // longest, something was chosen, and they are not the same thing.
  const lookedPast = groups.some(
    (group) =>
      group.longestViewedTargetId &&
      group.finalSelectedIds.length > 0 &&
      !group.finalSelectedIds.includes(group.longestViewedTargetId),
  );
  if (lookedPast) marks.push('가장 오래 본 것은 고르지 않았습니다');

  if (marks.length < 3) {
    const revisits = groups.reduce(
      (sum, group) => sum + Object.values(group.revisitCountByTarget).reduce((a, b) => a + b, 0),
      0,
    );
    if (revisits > 0) marks.push(`다시 돌아본 횟수 ${revisits}회`);
  }

  return marks.slice(0, 3);
}

export function CollectedTraceScene({ scene, reports, step, nextLabel }: Props) {
  const record = useExperienceStore(useShallow(selectRecordLayerDerived));
  const behavior = useExperienceStore((state) => state.behavior);
  const completeScene = useExperienceStore((state) => state.completeScene);
  const reduced = useReducedMotion();
  const lightCanvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!record.light || !lightCanvas.current) return;
    renderLightGraphic(lightCanvas.current, record.light.rules, record.light.variation);
  }, [record.light]);

  const marks = useMemo(() => zoneMarks(reports, behavior), [reports, behavior]);

  /** What the clue itself holds, in the words the rest of the exhibition uses. */
  const filed = useMemo(() => {
    if (reports === 'lightArchive') {
      const keyword = record.light?.rules.emotionKeywords?.[0] ?? null;
      const hex = record.light?.rules.palette?.[0] ?? null;
      return ['빛의 흔적', [hex, keyword].filter(Boolean).join(' · ')] as const;
    }
    if (reports === 'soundClues') {
      const id = record.soundClues.selectedSoundId;
      const label = SOUND_CLUES.find((clue) => clue.id === id)?.label ?? id;
      return ['소리의 흔적', label ?? '기록 없음'] as const;
    }
    const labels = record.memorySketch.selectedObjects.map(
      (id) => MEMORY_ROOM_OBJECTS.find((object) => object.id === id)?.label ?? id,
    );
    return ['기억의 흔적', labels.length ? labels.join(' · ') : '기록 없음'] as const;
  }, [reports, record]);

  const fade = (delay: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0.15 : 0.7, delay: reduced ? 0 : delay },
  });

  return (
    <div className="collected-trace">
      <div className="collected-trace__residue" aria-hidden="true" />

      <motion.p className="collected-trace__eyebrow" {...fade(0)}>
        <span className="collected-trace__code">CLUE {String(step).padStart(2, '0')} / {String(TOTAL_CLUES).padStart(2, '0')}</span>
        <span className="collected-trace__sep" aria-hidden="true">·</span>
        <span>수집된 기록</span>
      </motion.p>

      <div className="collected-trace__body">
        <motion.div className="collected-trace__light" {...fade(0.1)}>
          {record.light ? (
            <canvas
              ref={lightCanvas}
              className="collected-trace__canvas"
              role="img"
              aria-label="지금까지 수집된 단서로 생성된 빛"
            />
          ) : (
            <div className="collected-trace__canvas collected-trace__canvas--empty" aria-hidden="true" />
          )}
          <span className="collected-trace__light-caption">
            수집된 단서가 쌓일수록 이 빛이 짙어집니다
          </span>
        </motion.div>

        <div className="collected-trace__panel">
          <motion.div className="collected-trace__filed" {...fade(0.2)}>
            <span className="collected-trace__filed-label">{filed[0]}</span>
            <span className="collected-trace__filed-value">{filed[1]}</span>
          </motion.div>

          <motion.div {...fade(0.3)}>
            <TraceLedger />
          </motion.div>

          <motion.div className="collected-trace__marks" {...fade(0.45)}>
            <p className="collected-trace__marks-title">이 구역에서 함께 기록된 것</p>
            {marks.length ? (
              <ul>
                {marks.map((mark) => (
                  <li key={mark}>{mark}</li>
                ))}
              </ul>
            ) : (
              <p className="collected-trace__marks-empty">이 구역에서는 선택 기록만 남았습니다.</p>
            )}
          </motion.div>
        </div>
      </div>

      <motion.div className="collected-trace__foot" {...fade(0.6)}>
        {/* Stays inside the investigation's own voice. An earlier draft read
            "조사 기록은 당신이 고른 것과, 고르는 동안 남은 것으로
            이루어집니다" — which hands the visitor the Final Report's turn
            (고른 것 / 고르는 동안의 당신) three Zones before the reveal. The
            archive states its procedure; the reveal is what makes it mean
            something. */}
        <p className="collected-trace__note">
          조사 기록에는 수집한 단서와 함께 수집 과정도 남습니다.
        </p>
        <button type="button" className="collected-trace__next" onClick={() => completeScene(scene)}>
          {nextLabel}
        </button>
      </motion.div>
    </div>
  );
}

export function CollectedTrace01Scene() {
  return <CollectedTraceScene scene="collectedTrace01" reports="lightArchive" step={1} nextLabel="다음 단서로" />;
}

export function CollectedTrace02Scene() {
  return <CollectedTraceScene scene="collectedTrace02" reports="soundClues" step={2} nextLabel="다음 단서로" />;
}

export function CollectedTrace03Scene() {
  return <CollectedTraceScene scene="collectedTrace03" reports="memorySketch" step={3} nextLabel="마지막 단서로" />;
}
