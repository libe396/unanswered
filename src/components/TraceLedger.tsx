import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useExperienceStore } from '../store/experienceStore';
import type { SceneId } from '../types';
import './TraceLedger.css';

interface Category {
  label: string;
  sceneId: SceneId;
}

const CATEGORIES: Category[] = [
  { label: 'LIGHT', sceneId: 'lightArchive' },
  { label: 'SOUND', sceneId: 'soundClues' },
  { label: 'MEMORY', sceneId: 'memorySketch' },
  { label: 'SENTENCE', sceneId: 'sentenceClues' },
];

const BLOCK_COUNT = 4;

/**
 * Record Layer 1차 방문에서 "무엇이 쌓였는가"를 보여주는 누적 흔적판.
 * 진행률 바가 아니다 — 카테고리별로 지나온 Zone의 결과 조각을 보관한다.
 *
 * 2026-11-03: Collected Trace 판독 화면(CollectedTraceScene)이 구역마다 이
 * 흔적판을 다시 보여준다. LIGHT만 조각을 채우던 상태에서는 구역을 지나도
 * 판이 자라지 않아, SOUND·MEMORY·SENTENCE도 기록된 수만큼 조각을 채운다.
 * 색을 가진 단서는 LIGHT뿐이므로 나머지는 --trace 한 색으로 표시한다.
 */
const NON_COLOR_FRAGMENT = 'rgba(171, 147, 255, 0.72)';

export function TraceLedger() {
  const completedScenes = useExperienceStore((s) => s.completedScenes);
  const lightArchive = useExperienceStore((s) => s.lightArchive);
  const soundClues = useExperienceStore((s) => s.soundClues);
  const memorySketch = useExperienceStore((s) => s.memorySketch);
  const sentenceClues = useExperienceStore((s) => s.sentenceClues);
  const lightPalette = useMemo(() => {
    const palette = lightArchive?.rules?.palette;
    if (!Array.isArray(palette)) return [];
    return palette.filter((color): color is string => typeof color === 'string' && color.length > 0).slice(0, BLOCK_COUNT);
  }, [lightArchive]);
  const prefersReducedMotion = useReducedMotion();
  const marks = (count: number) => Array.from({ length: Math.min(count, BLOCK_COUNT) }, () => NON_COLOR_FRAGMENT);
  const recordFragmentsByScene: Partial<Record<SceneId, string[]>> = {
    lightArchive: lightPalette,
    // The clue, then where it was put down in the memory field.
    soundClues: marks((soundClues.selectedSoundId ? 1 : 0) + (soundClues.memoryPosition ? 1 : 0)),
    memorySketch: marks(memorySketch.selectedObjects.length),
    sentenceClues: marks(sentenceClues.selectedSentences.length),
  };

  return (
    <div className="trace-ledger">
      {CATEGORIES.map((category, index) => {
        const fragments = recordFragmentsByScene[category.sceneId] ?? [];
        const active = completedScenes.includes(category.sceneId) || fragments.length > 0;
        const hasFragments = active && fragments.length > 0;
        const statusDelay = prefersReducedMotion ? 0 : 0.78 + Math.max(fragments.length - 1, 0) * 0.14;
        return (
          <motion.div
            key={category.sceneId}
            className={`trace-ledger__row${active ? ' trace-ledger__row--active' : ''}${
              hasFragments ? ' trace-ledger__row--archived' : ''
            }`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0.15 : 0.6,
              delay: prefersReducedMotion ? 0 : 0.3 + index * 0.12,
            }}
            aria-label={`${category.label} — ${active ? '기록됨' : '흔적 없음'}`}
          >
            <span className="trace-ledger__label">{category.label}</span>
            <span className="trace-ledger__blocks" aria-hidden="true">
              {Array.from({ length: BLOCK_COUNT }).map((_, blockIndex) => (
                <span
                  key={blockIndex}
                  className={`trace-ledger__block${
                    fragments[blockIndex] ? ' trace-ledger__block--filled' : ''
                  }`}
                  style={
                    fragments[blockIndex]
                      ? {
                          backgroundColor: fragments[blockIndex],
                          animationDelay: prefersReducedMotion ? '0ms' : `${620 + blockIndex * 140}ms`,
                        }
                      : undefined
                  }
                >
                  <span />
                </span>
              ))}
            </span>
            <span
              className="trace-ledger__status"
              style={hasFragments ? { animationDelay: `${statusDelay}s` } : undefined}
              aria-hidden="true"
            >
              {active ? '기록됨' : '흔적 없음'}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
