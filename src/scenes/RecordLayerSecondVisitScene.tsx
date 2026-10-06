import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { buildSoundWaveform } from '../lib/finalReportPresentation';
import { MEMORY_ROOM_OBJECTS, SOUND_CLUES } from '../data/content';
import { selectRecordLayerDerived, useExperienceStore } from '../store/experienceStore';
import type { RecordLayerDerived } from '../types';
import './RecordLayerSecondVisitScene.css';

const ARCHIVE_TRACE_MARKS = [
  { kind: 'segment', width: 46 },
  { kind: 'dot' },
  { kind: 'segment', width: 24 },
  { kind: 'tick', height: 14 },
  { kind: 'segment', width: 62 },
  { kind: 'dot' },
  { kind: 'segment', width: 36 },
  { kind: 'tick', height: 20 },
  { kind: 'segment', width: 18 },
  { kind: 'dot' },
  { kind: 'segment', width: 72 },
] as const;

/** The layer stack opens on entry; confirmation goes straight to the report. */
const SPREAD_MS = 900;

const LAYERS = [
  { n: 1, latin: 'LIGHT', ko: '빛의 흔적' },
  { n: 2, latin: 'SOUND', ko: '소리의 흔적' },
  { n: 3, latin: 'MEMORY', ko: '기억의 흔적' },
  { n: 4, latin: 'SENTENCE', ko: '문장의 흔적' },
] as const;

const EMPTY_MARK = '기록 없음';

/** "IMAGE_07" → "IMG 07". Presentational only. */
function imageMark(imageId: string): string {
  return `IMG ${imageId.replace(/^IMAGE_/, '')}`;
}

/**
 * Where in the memory field the sound was put down, in words.
 *
 * Same reading of the two axes as the Recovered Context paragraph in
 * src/lib/sentenceNarrative.ts — x is how clearly it carried, y is how far
 * away it was — shortened to fit a pane footer.
 */
function positionMark(position: { x: number; y: number } | null): string | null {
  if (!position) return null;
  const clarity = position.x < 0.4 ? '희미하게' : position.x > 0.6 ? '또렷하게' : '어렴풋이';
  // Short forms: the footer is one mono line inside a 240px pane, and the
  // long middle phrase ran into the neighbouring pane's footer.
  const distance = position.y < 0.4 ? '가까이' : position.y > 0.6 ? '멀리' : '중간 거리에서';
  return `${distance} ${clarity}`;
}

/** The five most-weighted colours of the chosen image, heaviest first. */
function rankedPalette(light: RecordLayerDerived['light']): string[] {
  const rules = light?.rules;
  if (!rules?.palette?.length) return [];
  const weights =
    rules.paletteWeights?.length === rules.palette.length ? rules.paletteWeights : rules.palette.map(() => 1);
  return rules.palette
    .map((hex, index) => ({ hex, weight: weights[index] ?? 0 }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map((entry) => entry.hex);
}

export function RecordLayerSecondVisitScene() {
  const stackStageRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const stage = stackStageRef.current;
    if (!stage) return;
    const panes = [...stage.querySelectorAll<HTMLElement>('.record-layer-second-visit__pane')];
    const measure = () => {
      const narrow = window.matchMedia('(max-width: 900px)').matches;
      const floor = narrow ? 390 : 560;
      stage.style.height = `${Math.max(floor, ...panes.map(pane => pane.offsetHeight + (narrow ? 55 : 120)))}px`;
    };
    const observer = new ResizeObserver(measure);
    panes.forEach(pane => observer.observe(pane)); measure();
    return () => observer.disconnect();
  }, []);

  const record = useExperienceStore(useShallow(selectRecordLayerDerived));
  const completeScene = useExperienceStore((s) => s.completeScene);
  const prefersReducedMotion = useReducedMotion();
  /* Reduced motion gets the opened stack as its resting state: there is no
     transition to watch, so there is nothing to wait for either. */
  const [isOpen, setIsOpen] = useState(() => Boolean(prefersReducedMotion));
  const [isMoving, setIsMoving] = useState(false);
  /** The layer a legend row is pointing at, or the one a row has pinned. */
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null);
  const [pinnedLayer, setPinnedLayer] = useState<number | null>(null);

  const movingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setIsOpen(true);
    if (!prefersReducedMotion) markMoving();
  }, [prefersReducedMotion]);

  useEffect(
    () => {
      setIsMoving(false);
      return () => {
        if (movingTimerRef.current !== null) window.clearTimeout(movingTimerRef.current);
      };
    },
    [],
  );

  const palette = useMemo(() => rankedPalette(record.light), [record.light]);
  const emotion = record.light?.rules.emotionKeywords?.[0] ?? null;

  const soundId = record.soundClues.selectedSoundId;
  const soundLabel = SOUND_CLUES.find((clue) => clue.id === soundId)?.label ?? soundId;
  /* No per-clip amplitude data exists anywhere in the project, so the bars
     come from the same seeded generator the Final Report already draws with —
     the same clue always draws the same shape. */
  const waveform = useMemo(() => (soundId ? buildSoundWaveform(soundId, 16) : []), [soundId]);
  const soundPosition = positionMark(record.soundClues.memoryPosition);

  const objectLabels = record.memorySketch.selectedObjects.map(
    (id) => MEMORY_ROOM_OBJECTS.find((object) => object.id === id)?.label ?? id,
  );

  const sentenceLines = record.sentenceClues.selectedSentences.length
    ? record.sentenceClues.selectedSentences
    : record.sentenceClues.customSentence
      ? [record.sentenceClues.customSentence]
      : [];
  const sentenceMark = sentenceLines.length
    ? `${sentenceLines.length} FRAGMENTS${
        record.sentenceClues.noQuestionAvailable
          ? ''
          : record.sentenceClues.responseSkipped
            ? ' · 1 UNANSWERED'
            : ' · 1 RESTORED'
      }`
    : null;

  /** Bring a pane forward without moving it out of the stack. */
  const liftedLayer = hoveredLayer ?? pinnedLayer;

  function markMoving() {
    setIsMoving(true);
    if (movingTimerRef.current !== null) window.clearTimeout(movingTimerRef.current);
    // will-change is carried only while something is actually in motion.
    movingTimerRef.current = window.setTimeout(() => setIsMoving(false), SPREAD_MS + 60);
  }

  function handleConfirm() {
    completeScene('recordLayerSecondVisit');
  }

  function paneClass(n: number) {
    return `record-layer-second-visit__pane record-layer-second-visit__pane--${n}${
      liftedLayer === n ? ' record-layer-second-visit__pane--lifted' : ''
    }`;
  }

  return (
    <div className="record-layer-second-visit">
      <div className="record-layer-second-visit__record-veil" />

      <div className="record-layer-second-visit__record-traces" aria-hidden="true">
        <div className="record-layer-second-visit__record-trace record-layer-second-visit__record-trace--1">
          <span />
          <span />
        </div>
        <div className="record-layer-second-visit__record-trace record-layer-second-visit__record-trace--2">
          <span />
          <span />
          <span />
        </div>
        <div className="record-layer-second-visit__record-trace record-layer-second-visit__record-trace--3">
          <span />
          <span />
        </div>
      </div>

      <div className="record-layer-second-visit__layout">
        {/* ── The stack ─────────────────────────────────────────────────── */}
        <div ref={stackStageRef} className="record-layer-second-visit__stage3d">
          {/* The one violet area on this Scene: the light the panes sit in
              front of. Everything else borrows its edge from --line. */}
          <div className="record-layer-second-visit__glow" aria-hidden="true" />
          <div
            className={`record-layer-second-visit__stack${
              isOpen ? ' record-layer-second-visit__stack--open' : ''
            }${isMoving ? ' record-layer-second-visit__stack--moving' : ''}`}
            aria-hidden="true"
          >
            <div className={paneClass(1)}>
              <div className="record-layer-second-visit__pane-head">
                <b>LAYER 01</b>
                <span>LIGHT</span>
              </div>
              <div className="record-layer-second-visit__pane-body">
                {palette.length ? (
                  <div className="record-layer-second-visit__swatches">
                    {palette.map((hex, index) => (
                      <i key={`${hex}-${index}`} style={{ background: hex }} />
                    ))}
                  </div>
                ) : (
                  <p className="record-layer-second-visit__pane-empty">{EMPTY_MARK}</p>
                )}
              </div>
              <div className="record-layer-second-visit__pane-foot">
                {record.light ? `${imageMark(record.light.imageId)}${emotion ? ` · ${emotion}` : ''}` : null}
              </div>
            </div>

            <div className={paneClass(2)}>
              <div className="record-layer-second-visit__pane-head">
                <b>LAYER 02</b>
                <span>SOUND</span>
              </div>
              <div className="record-layer-second-visit__pane-body">
                {waveform.length ? (
                  <svg width="200" height="70" viewBox="0 0 200 70" role="presentation">
                    <g stroke="rgba(237, 236, 242, 0.75)" strokeWidth="2" strokeLinecap="round">
                      {waveform.map((level, index) => {
                        const x = 10 + index * 12;
                        const half = Math.max(1, level * 27);
                        return <line key={index} x1={x} y1={35 - half} x2={x} y2={35 + half} />;
                      })}
                    </g>
                  </svg>
                ) : (
                  <p className="record-layer-second-visit__pane-empty">{EMPTY_MARK}</p>
                )}
              </div>
              <div className="record-layer-second-visit__pane-foot">
                {soundId ? `${soundLabel}${soundPosition ? ` · ${soundPosition}` : ''}` : null}
              </div>
            </div>

            <div className={paneClass(3)}>
              <div className="record-layer-second-visit__pane-head">
                <b>LAYER 03</b>
                <span>MEMORY</span>
              </div>
              <div className="record-layer-second-visit__pane-body">
                {objectLabels.length ? (
                  <ul className="record-layer-second-visit__objects">
                    {objectLabels.map((label, index) => (
                      <li key={`${label}-${index}`}>{label}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="record-layer-second-visit__pane-empty">{EMPTY_MARK}</p>
                )}
              </div>
              <div className="record-layer-second-visit__pane-foot">
                {objectLabels.length ? `${String(objectLabels.length).padStart(2, '0')} OBJECTS` : null}
              </div>
            </div>

            <div className={paneClass(4)}>
              <div className="record-layer-second-visit__pane-head">
                <b>LAYER 04</b>
                <span>SENTENCE</span>
              </div>
              <div className="record-layer-second-visit__pane-body record-layer-second-visit__pane-body--top">
                {sentenceLines.length ? (
                  <div className="record-layer-second-visit__lines">
                    {sentenceLines.map((line, index) => (
                      <p key={`${line}-${index}`}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="record-layer-second-visit__pane-empty">{EMPTY_MARK}</p>
                )}
              </div>
              <div className="record-layer-second-visit__pane-foot">{sentenceMark}</div>
            </div>
          </div>
        </div>

        {/* ── The column that reads it back ─────────────────────────────── */}
        <div className="record-layer-second-visit__content">
          <p className="record-layer-second-visit__eyebrow">모은 기록</p>
          <h1 className="record-layer-second-visit__title">당신이 고른 단서들입니다</h1>
          <p className="record-layer-second-visit__desc">
            각 흔적을 눌러 다시 살펴볼 수 있습니다.
          </p>

          <ul className="record-layer-second-visit__legend">
            {LAYERS.map((layer) => (
              <li key={layer.n}>
                <button
                  type="button"
                  className={`record-layer-second-visit__legend-row${
                    liftedLayer === layer.n ? ' record-layer-second-visit__legend-row--on' : ''
                  }`}
                  aria-pressed={pinnedLayer === layer.n}
                  onPointerEnter={() => setHoveredLayer(layer.n)}
                  onPointerLeave={() => setHoveredLayer(null)}
                  onFocus={() => setHoveredLayer(layer.n)}
                  onBlur={() => setHoveredLayer(null)}
                  onClick={() => setPinnedLayer((current) => (current === layer.n ? null : layer.n))}
                >
                  <span className="record-layer-second-visit__legend-no">
                    {String(layer.n).padStart(2, '0')}
                  </span>
                  <span className="record-layer-second-visit__legend-ko">{layer.ko}</span>
                  <span className="record-layer-second-visit__legend-latin">{layer.latin}</span>
                </button>
              </li>
            ))}
          </ul>

          <motion.button
            className="cta cta--primary record-layer-second-visit__confirm"
            onClick={handleConfirm}
            disabled={false}
            initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.68, delay: prefersReducedMotion ? 0 : 0.35 }}
          >
            <span>기록 확인</span>
            <span aria-hidden="true">→</span>
          </motion.button>
        </div>
      </div>

      {record.soundClues.selectedSoundId ? (
        <motion.div
          className="record-layer-second-visit__archive-trace"
          aria-hidden="true"
          initial={prefersReducedMotion ? { opacity: 0.26 } : { opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 0.8, delay: prefersReducedMotion ? 0 : 1.1 }}
        >
          {ARCHIVE_TRACE_MARKS.map((mark, index) => (
            <motion.span
              key={`${mark.kind}-${index}`}
              className={`record-layer-second-visit__archive-trace-mark record-layer-second-visit__archive-trace-mark--${mark.kind}`}
              style={{ width: 'width' in mark ? mark.width : undefined, height: 'height' in mark ? mark.height : undefined }}
              animate={prefersReducedMotion || mark.kind === 'segment' ? {} : { opacity: [0.22, 0.48, 0.22] }}
              transition={{ duration: 5.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.42 }}
            />
          ))}
        </motion.div>
      ) : null}

      {/* The investigator name and REPORT ID used to print here, under
          BackButton. ArchiveHUD says the same thing along the bottom of every
          Zone from Registration on, and prefixes the name on this Scene
          specifically — so this block was the second copy. */}
    </div>
  );
}
