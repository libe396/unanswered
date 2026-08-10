import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { analyzeImage } from '../lib/imageAnalysis.js';
import { renderLightGraphic } from '../lib/lightRenderer.js';
import { ARCHIVE_META } from '../archiveMeta.js';
import { EMOTION_KEYWORDS, MAX_EMOTION_KEYWORDS } from '../data/content';
import { useExperienceStore } from '../store/experienceStore';
import { TerminalCorners } from '../components/TerminalCorners';
import { ZoneIntroCard } from '../components/ZoneIntroCard';
import type { LightAnalysisRules } from '../types';
import './LightArchiveScene.css';

const ARCHIVE_IMAGE_MODULES = import.meta.glob('../assets/archive/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

interface ArchiveImage {
  id: string;
  label: string;
  src: string;
}

function buildArchiveImages(): ArchiveImage[] {
  const meta = ARCHIVE_META as Array<{ slot: string; label: string }>;
  return Object.entries(ARCHIVE_IMAGE_MODULES)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, url]) => {
      const slotMatch = path.match(/(\d+)\.[^.]+$/);
      const slot = slotMatch ? slotMatch[1].padStart(2, '0') : '00';
      const found = meta.find((m) => m.slot === slot);
      return { id: `IMAGE_${slot}`, label: found?.label ?? '', src: url };
    });
}

function originLabel(origin: { x: number; y: number }): string {
  const vertical = origin.y < 0.4 ? '상단' : origin.y > 0.6 ? '하단' : '';
  const horizontal = origin.x < 0.4 ? '좌측' : origin.x > 0.6 ? '우측' : '';
  const label = `${vertical} ${horizontal}`.trim();
  return label || '중앙';
}

interface RuleStage {
  code: string;
  name: string;
  describe: (rules: LightAnalysisRules) => string;
}

// Each stage surfaces one real facet of the actual analyzeImage() output —
// no fabricated data. Order follows the AI's own read of the image: where
// the light sits, which way it moves, how bright it is, where it clusters,
// how the composition resolves, and finally the palette it distilled.
const RULE_STAGES: RuleStage[] = [
  {
    code: 'RULE 01',
    name: 'LIGHT ORIGIN',
    describe: (r) =>
      `x ${Math.round(r.lightOrigin.x * 100)} · y ${Math.round(r.lightOrigin.y * 100)} — ${originLabel(r.lightOrigin)}`,
  },
  {
    code: 'RULE 02',
    name: 'DIRECTION',
    describe: (r) => `${r.motionDirection.label} · ${Math.round(r.motionDirection.angle)}°`,
  },
  {
    code: 'RULE 03',
    name: 'BRIGHTNESS',
    describe: (r) => `${Math.round(r.averageBrightness * 100)}%`,
  },
  {
    code: 'RULE 04',
    name: 'HIGHLIGHTS',
    describe: (r) => `${r.brightRegions.length}개의 광원 감지 · ${r.brightRegions[0]?.color ?? '—'}`,
  },
  {
    code: 'RULE 05',
    name: 'STRUCTURE MATCH',
    describe: (r) => `${r.structure.compositionType} / ${r.structure.dominantAxis} / ${r.structure.shapeEnergy}`,
  },
  {
    code: 'RULE 06',
    name: 'PALETTE',
    describe: (r) => r.palette.slice(0, 4).join(' · '),
  },
];

const RULE_REVEAL_INTERVAL_MS = 850;
const RULE_HOLD_MS = 900;
const RECONSTRUCT_MS = 1400;

type Phase = 'zoneIntro' | 'browse' | 'feeling' | 'reading' | 'reconstructing' | 'projecting';

export function LightArchiveScene() {
  const archiveImages = useMemo(buildArchiveImages, []);
  const setLightArchive = useExperienceStore((s) => s.setLightArchive);
  const completeScene = useExperienceStore((s) => s.completeScene);
  const prefersReducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>('zoneIntro');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [rules, setRules] = useState<LightAnalysisRules | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const enteredAtRef = useRef(Date.now());
  const timersRef = useRef<number[]>([]);

  const selectedImage = selectedIdx !== null ? archiveImages[selectedIdx] : null;

  function toggleKeyword(ko: string) {
    setSelectedKeywords((prev) => {
      if (prev.includes(ko)) return prev.filter((k) => k !== ko);
      if (prev.length >= MAX_EMOTION_KEYWORDS) return [...prev.slice(1), ko];
      return [...prev, ko];
    });
  }

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  async function startAnalysis() {
    if (!selectedImage) return;
    setPhase('reading');
    setRevealedCount(0);
    setRules(null);

    const analysis = await analyzeImage(selectedImage.src);
    const mergedRules = { ...analysis, emotionKeywords: selectedKeywords } as LightAnalysisRules;
    setRules(mergedRules);

    const interval = prefersReducedMotion ? RULE_REVEAL_INTERVAL_MS * 0.3 : RULE_REVEAL_INTERVAL_MS;
    RULE_STAGES.forEach((_, index) => {
      const timer = window.setTimeout(() => {
        setRevealedCount((prev) => Math.max(prev, index + 1));
      }, index * interval);
      timersRef.current.push(timer);
    });

    const closingTimer = window.setTimeout(
      () => setPhase('reconstructing'),
      RULE_STAGES.length * interval + (prefersReducedMotion ? RULE_HOLD_MS * 0.3 : RULE_HOLD_MS),
    );
    timersRef.current.push(closingTimer);
  }

  useEffect(() => {
    if (phase !== 'reconstructing' || !rules || !canvasRef.current) return;
    renderLightGraphic(canvasRef.current, rules, 1);
    const timer = window.setTimeout(
      () => setPhase('projecting'),
      prefersReducedMotion ? RECONSTRUCT_MS * 0.3 : RECONSTRUCT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [phase, rules, prefersReducedMotion]);

  function handleConfirm() {
    if (!selectedImage || !rules) return;
    setLightArchive({
      imageId: selectedImage.id,
      imagePath: selectedImage.src,
      rules,
      variation: 1,
      selectDwellMs: Date.now() - enteredAtRef.current,
    });
    completeScene('lightArchive');
  }

  if (phase === 'zoneIntro') {
    return (
      <ZoneIntroCard
        zone="ZONE 03"
        title="빛의 흔적"
        subtitle="빛은 그 사람의 흔적을 가장 잘 담고 있다."
        ctaLabel="조사 시작"
        onContinue={() => setPhase('browse')}
      />
    );
  }

  return (
    <div className="light-archive-scene">
      {phase === 'browse' ? (
        <div className="light-archive-scene__browse">
          <p className="light-archive-scene__hint">그 사람이 남긴 흔적의 이미지를 선택하세요</p>
          <div className="light-archive-scene__grid">
            {archiveImages.map((img, idx) => (
              <button
                key={img.id}
                className={`light-archive-scene__cell${
                  selectedIdx === idx ? ' light-archive-scene__cell--selected' : ''
                }`}
                onClick={() => setSelectedIdx(idx)}
              >
                <img src={img.src} alt={img.label} className="light-archive-scene__cell-img" />
                {img.label ? (
                  <span className="light-archive-scene__cell-label">{img.label}</span>
                ) : null}
              </button>
            ))}
          </div>
          <button
            className="light-archive-scene__proceed"
            onClick={() => setPhase('feeling')}
            disabled={selectedIdx === null}
          >
            <TerminalCorners />
            이 단서를 따라간다
          </button>
        </div>
      ) : null}

      {phase === 'feeling' && selectedImage ? (
        <div className="light-archive-scene__feeling">
          <img src={selectedImage.src} alt="" className="light-archive-scene__feeling-img" />
          <div className="light-archive-scene__feeling-panel">
            <p className="light-archive-scene__label">이 이미지에서 어떤 것이 느껴지나요?</p>
            <p className="light-archive-scene__sublabel">최대 {MAX_EMOTION_KEYWORDS}개 선택</p>
            <div className="light-archive-scene__keywords">
              {EMOTION_KEYWORDS.map((kw) => (
                <button
                  key={kw.ko}
                  className={`light-archive-scene__keyword${
                    selectedKeywords.includes(kw.ko) ? ' light-archive-scene__keyword--selected' : ''
                  }`}
                  onClick={() => toggleKeyword(kw.ko)}
                >
                  {kw.ko}
                </button>
              ))}
            </div>
            <button
              className="light-archive-scene__proceed"
              onClick={startAnalysis}
              disabled={selectedKeywords.length === 0}
            >
              <TerminalCorners />
              다음으로
            </button>
          </div>
        </div>
      ) : null}

      {(phase === 'reading' || phase === 'reconstructing') && selectedImage ? (
        <div className="light-archive-scene__reading">
          <div className="light-archive-scene__reading-visual">
            <motion.img
              src={selectedImage.src}
              alt=""
              className="light-archive-scene__reading-img"
              initial={{ filter: 'grayscale(0) contrast(1) brightness(1)' }}
              animate={{ filter: 'grayscale(1) contrast(1.3) brightness(0.55)' }}
              transition={{ duration: prefersReducedMotion ? 0.4 : 1.8, ease: 'easeInOut' }}
            />
            <div className="light-archive-scene__reading-scan" aria-hidden="true" />
          </div>

          <div className="light-archive-scene__rules">
            <p className="light-archive-scene__rules-heading">
              {phase === 'reconstructing' ? '그 사람의 빛을 찾았어요' : 'LIGHT RULE MATCHING'}
            </p>
            {RULE_STAGES.map((stage, index) => {
              const isRevealed = index < revealedCount || phase === 'reconstructing';
              return (
                <motion.div
                  key={stage.code}
                  className={`light-archive-scene__rule${
                    isRevealed ? ' light-archive-scene__rule--matched' : ''
                  }`}
                  initial={{ opacity: 0.25 }}
                  animate={{ opacity: isRevealed ? 1 : 0.25 }}
                  transition={{ duration: 0.5 }}
                >
                  <span className="light-archive-scene__rule-code">{stage.code}</span>
                  <span className="light-archive-scene__rule-name">{stage.name}</span>
                  <span className="light-archive-scene__rule-value">
                    {isRevealed && rules ? stage.describe(rules) : 'MATCHING…'}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : null}

      <canvas
        ref={canvasRef}
        width={1000}
        height={1000}
        className={`light-archive-scene__canvas${
          phase === 'reconstructing' || phase === 'projecting'
            ? ' light-archive-scene__canvas--visible'
            : ''
        }`}
      />

      {phase === 'projecting' ? (
        <motion.button
          className="light-archive-scene__confirm"
          onClick={handleConfirm}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: prefersReducedMotion ? 0.2 : 1.2,
            delay: prefersReducedMotion ? 0 : 1,
          }}
        >
          <TerminalCorners />
          기록 저장
        </motion.button>
      ) : null}
    </div>
  );
}
