import { useInteractionClock } from '../hooks/useInteractionClock';
import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeImage } from '../lib/imageAnalysis.js';
import { LightTransformation } from '../components/LightTransformation';
import { ARCHIVE_META } from '../archiveMeta.js';
import { EMOTION_KEYWORDS, MAX_EMOTION_KEYWORDS } from '../data/content';
import { useExperienceStore } from '../store/experienceStore';
import { logSceneTracking, useSceneTracking } from '../hooks/useSceneTracking';
import { playClueRecordedSignature } from '../lib/postElevatorAudio';
import { StageLayout } from '../components/StageLayout';
import type { LightAnalysisRules } from '../types';
import './LightArchiveScene.css';

const ARCHIVE_IMAGE_MODULES = import.meta.glob('../assets/archive/light-trace-*.png', {
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
  // Metadata order and explicit slot paths are authoritative, never ZIP/file order.
  return meta.map(({ slot, label }) => {
    const src = ARCHIVE_IMAGE_MODULES[`../assets/archive/light-trace-${slot}.png`];
    if (!src) throw new Error(`Missing light trace image: ${slot}`);
    return { id: `IMAGE_${slot}`, label, src };
  });
}

type Phase = 'browse' | 'feeling' | 'reading';

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
  const tracking = useSceneTracking('lightArchive', TRACKING_GROUPS);

  const [phase, setPhase] = useState<Phase>('browse');
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
  /* Which cell the pointer or focus is on, purely so the large preview in the
     object column knows what to show. Selection is still `selectedIdx`;
     nothing here is read by tracking. */
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [analysisStartedAt, setAnalysisStartedAt] = useState(0);

  const interactionNow = useInteractionClock();
  const enteredAtRef = useRef(interactionNow());
  const analysisActiveRef = useRef(false);

  const selectedImage = selectedIdx !== null ? archiveImages[selectedIdx] : null;
  /* What the large preview shows: whatever the pointer is on, falling back to
     the committed choice. Null until the visitor has touched the grid, which
     is what keeps the preview unresolved on arrival. */
  const focusIdx = hoveredIdx ?? selectedIdx;
  const focusedImage = focusIdx !== null ? archiveImages[focusIdx] : null;

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

  useEffect(() => {
    analysisActiveRef.current = true;
    setSaved(false);
    return () => {
      analysisActiveRef.current = false;
    };
  }, []);

  useEffect(() => { tracking.openGroup('image'); }, [tracking]);

  async function startAnalysis() {
    if (!selectedImage) return;
    setAnalysisStartedAt(performance.now());
    tracking.commit('emotion');
    setPhase('reading');
    setRules(null);

    const analysis = await analyzeImage(selectedImage.src);
    const mergedRules = { ...analysis, emotionKeywords: selectedKeywords } as LightAnalysisRules;
    setRules(mergedRules);
  }

  function handleConfirm() {
    if (!selectedImage || !rules || saved) return;
    setSaved(true);
    setLightArchive({
      imageId: selectedImage.id,
      imagePath: selectedImage.src,
      rules,
      variation: 1,
      selectDwellMs: interactionNow() - enteredAtRef.current,
    });
    tracking.save();
    logSceneTracking('lightArchive', tracking);
    playClueRecordedSignature();
    completeScene('lightArchive');
  }

  return (
    <div className="light-archive-scene scroll-quiet">
      {phase === 'browse' ? (
        <StageLayout
          eyebrow="빛의 흔적"
          title="그 사람이 남긴 흔적의 이미지를 선택하세요"
          description="끌리는 사진 하나를 골라 주세요."
          object={
            /*
              The grid shows ten uncropped thumbnails; this is the one that is
              currently under the pointer, at a size worth looking at. The
              large preview retains its blur→clear reveal: nothing
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
          eyebrow="빛의 흔적"
          title="이 이미지에서 어떤 것이 느껴지나요?"
          description={`이 사진에 어울리는 단어를 ${MAX_EMOTION_KEYWORDS}개까지 골라 주세요.`}
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

      {phase === 'reading' && selectedImage ? rules ? <LightTransformation startedAt={analysisStartedAt} src={selectedImage.src} rules={rules} onConfirm={handleConfirm} saved={saved} /> : <div className="light-transformation" role="status"><p>사진에서 빛의 단서를 찾고 있습니다.</p></div> : null}

    </div>
  );
}
