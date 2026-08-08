import { motion, useReducedMotion } from 'framer-motion';
import { useExperienceStore } from '../store/experienceStore';
import type { SceneId } from '../types';
import './TraceLedger.css';

const CATEGORIES: Array<{ label: string; sceneId: SceneId }> = [
  { label: 'LIGHT', sceneId: 'lightArchive' },
  { label: 'SOUND', sceneId: 'soundClues' },
  { label: 'MEMORY', sceneId: 'memorySketch' },
  { label: 'SENTENCE', sceneId: 'sentenceClues' },
];

const BLOCK_COUNT = 4;

/**
 * Record Layer 1차 방문에서 "무엇이 쌓였는가"를 보여주는 누적 흔적판.
 * 진행률 바가 아니다 — 카테고리별로 지나온 Zone인지 아닌지만 켜고 끈다.
 * ADR-001을 지키기 위해 선택 값(이미지, 문장, 팔레트 등)은 노출하지 않고
 * completedScenes만 참조한다.
 */
export function TraceLedger() {
  const completedScenes = useExperienceStore((s) => s.completedScenes);
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="trace-ledger">
      {CATEGORIES.map((category, index) => {
        const active = completedScenes.includes(category.sceneId);
        return (
          <motion.div
            key={category.sceneId}
            className={`trace-ledger__row${active ? ' trace-ledger__row--active' : ''}`}
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
                <span key={blockIndex} className="trace-ledger__block">
                  {active ? '■' : '□'}
                </span>
              ))}
            </span>
            <span className="trace-ledger__status" aria-hidden="true">
              {active ? '기록됨' : '흔적 없음'}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
