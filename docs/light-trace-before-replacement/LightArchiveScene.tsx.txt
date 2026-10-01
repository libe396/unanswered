import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { analyzeImage } from '../lib/imageAnalysis.js';
import { renderLightGraphic } from '../lib/lightRenderer.js';
import { ARCHIVE_META } from '../archiveMeta.js';
import { EMOTION_KEYWORDS, MAX_EMOTION_KEYWORDS } from '../data/content';
import { useExperienceStore } from '../store/experienceStore';
import { logSceneTracking, useSceneTracking } from '../hooks/useSceneTracking';
import { playClueRecordedSignature } from '../lib/postElevatorAudio';
import { ZoneIntroCard } from '../components/ZoneIntroCard';
import { StageLayout } from '../components/StageLayout';
import { ZONE_INFO } from '../data/zones';
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

function stageClassName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
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

const RULE_REVEAL_INTERVAL_MS = 520;
const RULE_HOLD_MS = 900;
const RECONSTRUCT_MS = 1400;

type Phase = 'zoneIntro' | 'browse' | 'feeling' | 'reading' | 'complete' | 'reconstructing' | 'projecting';

/*
  The two questions this Zone asks, and how each one answers.

  Naming them is the whole of what tracking needs from a scene: the image grid
  holds one choice at a time, the feeling row holds several. Everything the
  report reads later is derived from events filed under these two names.
*/
const TRACKING_GROUPS = { image: 'single', emotion: 'multi' } as const;

export function LightArchiveScene() {
  const archiveImages = useMemo(buildArchiveImages, []);
  const storedLightArchive = useExperienceStore((s) => s.lightArchive);
  const setLightArchive = useExperienceStore((s) => s.setLightArchive);
  const completeScene = useExperienceStore((s) => s.completeScene);
  const prefersReducedMotion = useReducedMotion();
  const tracking = useSceneTracking('lightArchive', TRACKING_GROUPS);

  const [phase, setPhase] = useState<Phase>('zoneIntro');
  // Seeded from any answer this visit already saved — e.g. via Back
  // navigation and back forward again — so re-confirming without changing
  // anything re-saves the same choice instead of a blank one. A first-ever
  // visit has no `lightArchive` yet, so these fall back to empty exactly as
  // before.
  const [selectedIdx, setSelectedIdx] = useState<number | null>(() => {
    if (!storedLightArchive) return null;
    const idx = archiveImages.findIndex((img) => img.id === storedLightArchive.imageId);
    return idx === -1 ? null : idx;
  });
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(
    () => storedLightArchive?.rules.emotionKeywords ?? [],
  );
  const [rules, setRules] = useState<LightAnalysisRules | null>(() => storedLightArchive?.rules ?? null);
  const [revealedCount, setRevealedCount] = useState(0);
  /* Which cell the pointer or focus is on, purely so the large preview in the
     object column knows what to show. Selection is still `selectedIdx`;
     nothing here is read by tracking. */
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const enteredAtRef = useRef(Date.now());
  const timersRef = useRef<number[]>([]);

  const selectedImage = selectedIdx !== null ? archiveImages[selectedIdx] : null;
  /* What the large preview shows: whatever the pointer is on, falling back to
     the committed choice. Null until the visitor has touched the grid, which
     is what keeps the preview unresolved on arrival. */
  const focusIdx = hoveredIdx ?? selectedIdx;
  const focusedImage = focusIdx !== null ? archiveImages[focusIdx] : null;
  const isAnalysisPhase = phase === 'reading' || phase === 'complete' || phase === 'reconstructing';

  function nextKeywords(prev: string[], ko: string): string[] {
    if (prev.includes(ko)) return prev.filter((k) => k !== ko);
    if (prev.length >= MAX_EMOTION_KEYWORDS) return [...prev.slice(1), ko];
    return [...prev, ko];
  }

  function toggleKeyword(ko: string) {
    /*
      Computed from the rendered value rather than inside a functional updater.
      The rule is unchanged — same eviction, same order — but React invokes
      updaters twice under StrictMode, and a tracker called from in there would
      record every feeling the visitor picked twice over.
    */
    const next = nextKeywords(selectedKeywords, ko);
    setSelectedKeywords(next);
    tracking.setSelection('emotion', next);
  }

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  async function startAnalysis() {
    if (!selectedImage) return;
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
    tracking.commit('emotion');
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
      () => setPhase('complete'),
      RULE_STAGES.length * interval + (prefersReducedMotion ? RULE_HOLD_MS * 0.3 : RULE_HOLD_MS),
    );
    timersRef.current.push(closingTimer);
  }

  /*
    `phase` is a dependency because the canvas element moves in the tree
    between the analysis backdrop and the result stage's object slot, and a
    canvas that React re-parents comes back blank. renderLightGraphic is a
    single synchronous draw with no animation loop of its own, so redrawing
    on arrival is safe and idempotent.
  */
  useEffect(() => {
    if (!rules || !canvasRef.current) return;
    renderLightGraphic(canvasRef.current, rules, 1);
  }, [rules, phase]);

  useEffect(() => {
    if (phase !== 'reconstructing') return;
    const timer = window.setTimeout(
      () => setPhase('projecting'),
      prefersReducedMotion ? RECONSTRUCT_MS * 0.3 : RECONSTRUCT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [phase, prefersReducedMotion]);

  function handleRevealLight() {
    if (phase !== 'complete') return;
    setPhase('reconstructing');
  }

  function handleConfirm() {
    if (!selectedImage || !rules || saved) return;
    setSaved(true);
    setLightArchive({
      imageId: selectedImage.id,
      imagePath: selectedImage.src,
      rules,
      variation: 1,
      selectDwellMs: Date.now() - enteredAtRef.current,
    });
    tracking.save();
    logSceneTracking('lightArchive', tracking);
    playClueRecordedSignature();
    completeScene('lightArchive');
  }

  function renderRuleValue(stage: RuleStage, currentRules: LightAnalysisRules): ReactNode {
    if (stage.name === 'LIGHT ORIGIN') {
      return (
        <span className="light-archive-scene__result-stack">
          <strong>
            x {Math.round(currentRules.lightOrigin.x * 100)} · y {Math.round(currentRules.lightOrigin.y * 100)}
          </strong>
          <small>{originLabel(currentRules.lightOrigin)}</small>
        </span>
      );
    }

    if (stage.name === 'DIRECTION') {
      return (
        <span className="light-archive-scene__result-stack">
          <strong>{Math.round(currentRules.motionDirection.angle)}°</strong>
          <small>{currentRules.motionDirection.label}</small>
        </span>
      );
    }

    if (stage.name === 'BRIGHTNESS') {
      const percent = Math.round(currentRules.averageBrightness * 100);
      return (
        <span className="light-archive-scene__result-stack">
          <strong>{percent}%</strong>
          <span className="light-archive-scene__brightness-meter" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </span>
        </span>
      );
    }

    if (stage.name === 'HIGHLIGHTS') {
      const region = currentRules.brightRegions[0];
      const color = region?.color ?? currentRules.palette[0] ?? '#c9a3ff';
      return (
        <span className="light-archive-scene__highlight-value">
          <span className="light-archive-scene__color-swatch" style={{ backgroundColor: color }} />
          <span className="light-archive-scene__result-stack">
            <strong>{currentRules.brightRegions.length} BRIGHT REGIONS</strong>
            <small>{color}</small>
          </span>
        </span>
      );
    }

    if (stage.name === 'STRUCTURE MATCH') {
      const tokens = [
        currentRules.structure.compositionType,
        currentRules.structure.dominantAxis,
        currentRules.structure.shapeEnergy,
        currentRules.structure.spatialWeight,
      ].filter(Boolean);
      return (
        <span className="light-archive-scene__structure-tokens">
          {tokens.map((token, index) => (
            <span key={`${token}-${index}`} style={{ transitionDelay: `${index * 90}ms` }}>
              {token}
            </span>
          ))}
        </span>
      );
    }

    if (stage.name === 'PALETTE') {
      return (
        <span className="light-archive-scene__palette">
          {currentRules.palette.slice(0, 4).map((color, index) => (
            <span
              key={`${color}-${index}`}
              className="light-archive-scene__palette-item"
              style={{ transitionDelay: `${index * 110}ms` }}
              title={color}
            >
              <span className="light-archive-scene__palette-swatch" style={{ backgroundColor: color }} />
              <small>{color}</small>
            </span>
          ))}
        </span>
      );
    }

    return <span>{stage.describe(currentRules)}</span>;
  }

  if (phase === 'zoneIntro') {
    return (
      <ZoneIntroCard
        zone={ZONE_INFO.lightArchive.zone}
        title="빛의 흔적"
        subtitle="빛은 그 사람의 흔적을 가장 잘 담고 있다."
        ctaLabel="조사 시작"
        onContinue={() => {
          tracking.openGroup('image');
          setPhase('browse');
        }}
      />
    );
  }

  return (
    <div className="light-archive-scene scroll-quiet">
      {phase === 'browse' ? (
        <StageLayout
          eyebrow="LIGHT ARCHIVE"
          title="그 사람이 남긴 흔적의 이미지를 선택하세요"
          description="하나를 고르면, 그 이미지가 품고 있는 빛을 읽습니다."
          object={
            /*
              The grid shows ten blurred thumbnails; this is the one that is
              currently under the pointer, at a size worth looking at. The
              blur→clear reading is unchanged, just moved up a scale: nothing
              focused means nothing has resolved yet.
            */
            <div
              className={`light-archive-scene__preview${
                focusedImage ? ' light-archive-scene__preview--focused' : ''
              }`}
            >
              <img
                src={(focusedImage ?? archiveImages[0])?.src}
                alt=""
                className="light-archive-scene__preview-img"
              />
              <span className="light-archive-scene__preview-slot">
                {(focusedImage ?? archiveImages[0])?.id.replace('IMAGE_', 'IMG ')}
              </span>
            </div>
          }
        >
          <div className="light-archive-scene__grid">
            {archiveImages.map((img, idx) => (
              <button
                key={img.id}
                className={`light-archive-scene__cell${
                  selectedIdx === idx ? ' light-archive-scene__cell--selected' : ''
                }`}
                /*
                  Looking and choosing are separate acts, and the grid shows
                  every image at once — so what counts as "viewing an image" has
                  to be the pointer resting on it, not the image being on
                  screen. Focus is bound as well so a keyboard visitor is
                  recorded on the same terms as a pointer one.
                */
                onPointerEnter={() => {
                  setHoveredIdx(idx);
                  tracking.viewStart('image', img.id);
                }}
                onPointerLeave={() => {
                  setHoveredIdx((current) => (current === idx ? null : current));
                  tracking.viewEnd('image', img.id);
                }}
                onFocus={() => {
                  setHoveredIdx(idx);
                  tracking.viewStart('image', img.id);
                }}
                onBlur={() => {
                  setHoveredIdx((current) => (current === idx ? null : current));
                  tracking.viewEnd('image', img.id);
                }}
                onClick={() => {
                  setSelectedIdx(idx);
                  tracking.select('image', img.id);
                }}
              >
                <img src={img.src} alt={img.label} className="light-archive-scene__cell-img" />
                {selectedIdx === idx ? (
                  <span className="light-archive-scene__cell-badge">
                    {img.id.replace('IMAGE_', '')}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <button
            className="cta cta--primary light-archive-scene__proceed"
            onClick={() => {
              tracking.commit('image');
              tracking.openGroup('emotion');
              setPhase('feeling');
            }}
            disabled={selectedIdx === null}
          >
            이 단서를 따라간다
          </button>
        </StageLayout>
      ) : null}

      {phase === 'feeling' && selectedImage ? (
        <StageLayout
          eyebrow="LIGHT ARCHIVE"
          title="이 이미지에서 어떤 것이 느껴지나요?"
          description={`가장 가까운 감각을 최대 ${MAX_EMOTION_KEYWORDS}개까지 고를 수 있습니다.`}
          object={
            <div className="light-archive-scene__preview light-archive-scene__preview--focused">
              <img src={selectedImage.src} alt="" className="light-archive-scene__preview-img" />
              <span className="light-archive-scene__preview-slot">
                {selectedImage.id.replace('IMAGE_', 'IMG ')}
              </span>
            </div>
          }
        >
          <p className="metric light-archive-scene__count" aria-live="polite">
            <span className="metric__value">
              {selectedKeywords.length} / {MAX_EMOTION_KEYWORDS}
            </span>
            <span className="metric__label">선택</span>
          </p>
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
            className="cta cta--primary light-archive-scene__proceed"
            onClick={startAnalysis}
            disabled={selectedKeywords.length === 0}
          >
            다음으로
          </button>
        </StageLayout>
      ) : null}

      {isAnalysisPhase ? (
        <div
          className={`light-archive-scene__analysis-overlay${
            phase === 'reconstructing' ? ' light-archive-scene__analysis-overlay--reveal' : ''
          }`}
        />
      ) : null}

      {isAnalysisPhase && selectedImage ? (
        <div
          className={`light-archive-scene__reading${
            phase === 'reconstructing' ? ' light-archive-scene__reading--leaving' : ''
          }`}
        >
          <div className="light-archive-scene__reading-visual">
            <motion.img
              src={selectedImage.src}
              alt=""
              className="light-archive-scene__reading-img"
            />
            {rules && revealedCount >= 1 ? (
              <motion.span
                className="light-archive-scene__origin-marker"
                style={{
                  left: `${rules.lightOrigin.x * 100}%`,
                  top: `${rules.lightOrigin.y * 100}%`,
                }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: prefersReducedMotion ? 0.15 : 0.42, ease: [0.22, 1, 0.36, 1] }}
              />
            ) : null}
            {rules && revealedCount >= 2 ? (
              <motion.span
                className="light-archive-scene__direction-line"
                style={{
                  left: `${rules.lightOrigin.x * 100}%`,
                  top: `${rules.lightOrigin.y * 100}%`,
                  rotate: `${rules.motionDirection.angle}deg`,
                }}
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: prefersReducedMotion ? 0.15 : 0.55, ease: [0.22, 1, 0.36, 1] }}
              />
            ) : null}
            <div className="light-archive-scene__reading-scan" aria-hidden="true" />
          </div>

          <div className="light-archive-scene__rules">
            <div className="light-archive-scene__rules-header">
              {/*
                Driven by the counter beside it rather than by `phase`. The
                sixth rule lands, the counter reads 06 / 06, and the Scene
                then holds for RULE_HOLD_MS before `phase` becomes
                'complete' — for that second the heading still said
                IN PROGRESS over a finished readout.
              */}
              <p className="light-archive-scene__rules-heading">
                {revealedCount >= RULE_STAGES.length ? 'ANALYSIS COMPLETE' : 'ANALYSIS IN PROGRESS'}
              </p>
              <span className="light-archive-scene__rules-progress">
                {String(Math.min(revealedCount, RULE_STAGES.length)).padStart(2, '0')} /{' '}
                {String(RULE_STAGES.length).padStart(2, '0')}
              </span>
            </div>

            <div className="light-archive-scene__rules-grid">
              {RULE_STAGES.map((stage, index) => {
                const isRevealed = Boolean(rules) && index < revealedCount;
                return (
                  <motion.div
                    key={stage.code}
                    className={`light-archive-scene__rule light-archive-scene__rule--${stageClassName(
                      stage.name,
                    )}${isRevealed ? ' light-archive-scene__rule--matched' : ''}`}
                    initial={{ opacity: 0, y: 7 }}
                    animate={{ opacity: isRevealed ? 1 : 0, y: isRevealed ? 0 : 7 }}
                    transition={{ duration: prefersReducedMotion ? 0.15 : 0.46, ease: [0.22, 1, 0.36, 1] }}
                    aria-hidden={!isRevealed}
                  >
                    <span className="light-archive-scene__rule-code">{stage.code}</span>
                    <span className="light-archive-scene__rule-name">{stage.name}</span>
                    <span className="light-archive-scene__rule-value">
                      {isRevealed && rules ? renderRuleValue(stage, rules) : null}
                    </span>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              className="light-archive-scene__analysis-complete"
              initial={{ opacity: 0.32 }}
              animate={{ opacity: phase === 'complete' ? 1 : 0.32 }}
              transition={{ duration: prefersReducedMotion ? 0.15 : 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                type="button"
                className="cta cta--primary"
                onClick={handleRevealLight}
                disabled={phase !== 'complete'}
              >
                <span>VIEW DETECTED LIGHT</span>
                <span className="cta__arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </motion.div>
          </div>
        </div>
      ) : null}

      {/* Analysis backdrop only — the result screen mounts its own copy of
          this canvas inside the stage's object slot (see below). */}
      {phase !== 'projecting' ? (
        <canvas
          ref={canvasRef}
          width={1000}
          height={1000}
          className={`light-archive-scene__canvas${
            isAnalysisPhase ? ' light-archive-scene__canvas--visible light-archive-scene__canvas--analysis' : ''
          }`}
        />
      ) : null}

      {phase === 'projecting' && rules ? (
        <StageLayout
          eyebrow="LIGHT TRACE"
          title="당신이 고른 색으로 번역된 빛입니다"
          description="이 빛은 조사 기록에 그대로 남습니다."
          object={
            <div className="light-archive-scene__result">
              <canvas
                ref={canvasRef}
                width={1000}
                height={1000}
                className="light-archive-scene__result-canvas"
              />
            </div>
          }
        >
          <ul className="light-archive-scene__palette-list">
            {rules.palette.slice(0, 5).map((color, index) => (
              <li key={`${color}-${index}`} className="light-archive-scene__palette-chip">
                <span
                  className="light-archive-scene__palette-dot"
                  style={{ backgroundColor: color }}
                />
                <span className="light-archive-scene__palette-hex">{color}</span>
              </li>
            ))}
          </ul>

          <motion.button
            className="cta cta--primary light-archive-scene__confirm"
            onClick={handleConfirm}
            disabled={saved}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: prefersReducedMotion ? 0.2 : 1.2,
              delay: prefersReducedMotion ? 0 : 0.6,
            }}
          >
            {saved ? '저장됨' : '기록 저장'}
          </motion.button>
        </StageLayout>
      ) : null}

    </div>
  );
}
