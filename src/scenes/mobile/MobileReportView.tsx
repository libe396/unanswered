import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { renderLightGraphic } from '../../lib/lightRenderer.js';
import { EMOTION_KEYWORDS, MEMORY_ROOM_OBJECTS, SENTENCE_RECONSTRUCTION_FRAGMENTS, SOUND_CLUES } from '../../data/content';
import { actionEvidenceText, PROCESS_GUIDE, RECORD_CLOSING, RECORD_MEANING } from '../../lib/reportActionEvidence';
import { buildColorPresentationFromRules, formatIssuedAt } from '../../lib/finalReportPresentation';
import { soundPositionMeaning } from '../../lib/soundPositionMeaning';
import { readFindingCopy } from '../../lib/personalFindingInterpretation';
import { decodeReport } from '../../lib/reportShare';
import { shareReport } from '../../lib/shareReport';
import { isStoredReport, loadStoredReport, type TransferReport } from '../../lib/reportTransfer';
import { MemoryRoom } from '../../components/MemoryRoom';
import { SpecimenGlyph } from '../../components/SoundSpecimenGlyph';
import { drawStrokes } from '../../lib/memorySketch';
import { ROOM_WIDTH, ROOM_HEIGHT } from '../../data/memoryRoomGeometry';
import type { LightAnalysisRules } from '../../types';
import { ExhibitionFeedback } from '../../components/ExhibitionFeedback';
import './MobileReportView.css';

interface Props {
  payload: string;
}

const EvidenceReplay = lazy(() => import('../report/ChoiceReplayPlayer').then(module => ({ default: module.EvidenceReplay })));

// Display-only 1024px WebP (≈100KB instead of ≈2MB on mobile data); the light itself is redrawn from lightRulesCache.
const REPORT_PHOTOS = import.meta.glob('../../assets/archive/preview/light-trace-*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

type CachedRules = Omit<LightAnalysisRules, 'emotionKeywords'>;

/**
 * The phone's copy of the Final Report — `FinalReportSummaryReceipt` in
 * colour, rebuilt from a `#/r/` link alone (src/lib/reportShare.ts).
 *
 * Reads nothing from and writes nothing to the experience store: a visitor
 * opening their link on a device that also holds an in-progress visit must
 * not have that visit touched. The light is redrawn from the cached analysis
 * of the chosen photo plus the link's keywords and variation — the same
 * `renderLightGraphic` input the exhibition used.
 */
export function MobileReportView({ payload }: Props) {
  const [bundlePayload, setBundlePayload] = useState('');
  const [bundle, setBundle] = useState<TransferReport | null>(null);
  const [loadError, setLoadError] = useState('');
  const report = useMemo(() => isStoredReport(payload) ? (bundlePayload === payload ? bundle?.report ?? null : null) : decodeReport(payload), [payload, bundle, bundlePayload]);
  const articleRef = useRef<HTMLElement | null>(null);
  const sketchRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    document.documentElement.classList.add('mobile-report-page');
    return () => document.documentElement.classList.remove('mobile-report-page');
  }, []);
  useEffect(() => {
    if (!isStoredReport(payload)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => { setLoadError('기록을 불러오는 시간이 길어지고 있습니다. 다시 열어 주세요.'); controller.abort(); }, 25000);
    setLoadError('');
    void loadStoredReport(payload, controller.signal).then(data => { if (!controller.signal.aborted) { setBundle(data); setBundlePayload(payload); } })
      .catch(error => { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : '기록을 불러오지 못했습니다.'); })
      .finally(() => window.clearTimeout(timer));
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [payload]);
  useEffect(() => {
    const canvas = sketchRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && bundle) { ctx.clearRect(0, 0, canvas.width, canvas.height); drawStrokes(ctx, bundle.strokes, ROOM_WIDTH, ROOM_HEIGHT, ROOM_WIDTH / 1200); }
  }, [bundle]);
  const [rules, setRules] = useState<LightAnalysisRules | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!report?.img) { setRules(null); setRulesLoading(false); return; }
    if (bundle?.light && bundlePayload === payload) { setRules(bundle.light.rules); setRulesLoading(false); return; }
    let active = true;
    setRulesLoading(true);
    // Lazy: ~1MB of contours stays out of the exhibition bundle.
    import('../../data/lightRulesCache.json').then((module) => {
      const cache = module.default as unknown as Record<string, CachedRules>;
      const cached = report.img ? cache[report.img] : undefined;
      if (!active) return;
      setRulesLoading(false);
      if (!cached) { setRules(null); return; }
      setRules({ ...cached, emotionKeywords: report.kw.map((index) => EMOTION_KEYWORDS[index].ko) });
    }).catch(() => { if (active) { setRules(null); setRulesLoading(false); } });
    return () => { active = false; };
  }, [report, bundle, bundlePayload, payload]);

  useEffect(() => {
    if (rules && report && canvasRef.current) renderLightGraphic(canvasRef.current, rules, report.var);
  }, [rules, report]);

  if (!report) {
    return (
      <main className="mobile-report mobile-report--error">
        <p className="mobile-report__error">{loadError || (isStoredReport(payload) ? '기록을 불러오고 있습니다.' : '기록을 읽을 수 없습니다. QR을 다시 찍어 주세요.')}</p>
      </main>
    );
  }

  const color = buildColorPresentationFromRules(rules);
  const hasLight = Boolean(report.img);
  const sound = SOUND_CLUES.find((item) => item.id === report.snd);
  const sentences = report.sen
    .map((id) => SENTENCE_RECONSTRUCTION_FRAGMENTS.find((item) => item.id === id)?.text)
    .filter((text): text is string => Boolean(text));
  const objects = report.obj
    .map((id) => MEMORY_ROOM_OBJECTS.find((item) => item.id === id)?.label)
    .filter((label): label is string => Boolean(label));
  const evidence = report.ev
    .map((item) => ({ kind: item.kind, text: actionEvidenceText(item.kind, item.sceneId, item.targetId, item.tenths) }))
    .filter((item): item is { kind: typeof item.kind; text: string } => Boolean(item.text));
  const positionMeaning = soundPositionMeaning(report.pos ? { x: report.pos[0], y: report.pos[1] } : null);
  const hasProcess = evidence.some((item) => item.kind !== 'selection');

  async function saveReport() {
    setSaving(true);
    try {
      await document.fonts.ready;
      await Promise.all(Array.from(articleRef.current?.querySelectorAll('img') ?? []).map(image => image.decode().catch(() => {})));
      window.print();
    } finally { setSaving(false); }
  }

  async function share() {
    const result = await shareReport(window.location.href);
    if (result === 'copied') { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  }
  const sourceImage = report.img ? REPORT_PHOTOS[`../../assets/archive/preview/light-trace-${report.img.replace('IMAGE_', '')}.webp`] : null;

  return (
    <main className="mobile-report">
      <article ref={articleRef} className="mobile-report__receipt">
        <p className="mobile-report__brand">UNANSWERED ARCHIVE</p>
        <h1 className="mobile-report__title">최종보고서</h1>
        <p className="mobile-report__subtitle">YOUR INVESTIGATION RECORD</p>

        <div className="mobile-report__divider" role="presentation" />

        <div className="mobile-report__meta">
          <div>
            <p className="mobile-report__meta-label">REPORT ID</p>
            <p className="mobile-report__meta-value">{report.id}</p>
          </div>
          <p className="mobile-report__meta-date">{formatIssuedAt(report.t === null ? null : report.t * 60_000)}</p>
        </div>

        <div className="mobile-report__divider" role="presentation" />

        {report.findings.length > 0 && <>
          <section className="mobile-report__section" aria-label="이번 기록의 해석">
            <p className="mobile-report__label">이번 기록의 해석</p>
            {report.findings.map((finding, index) => {
              const detail = bundle?.findings.find(item => item.id === finding.id);
              const copy = detail ?? readFindingCopy(finding.id, finding.context);
              return copy && <div className="mobile-report__finding" key={finding.id}>
                <p className="mobile-report__label">{String(index + 1).padStart(2, '0')}</p>
                <h2>{copy.headline}</h2>
                <p className="mobile-report__observation">{copy.interpretation}</p>
                <p className="mobile-report__reflection">{copy.reflection}</p>
                {detail && <div className="mobile-report__grounds"><h3>이 해석의 근거</h3><p>{detail.pattern}</p><Suspense fallback={<p>선택 화면을 준비하고 있습니다.</p>}><EvidenceReplay finding={detail} records={bundle!.replays} /></Suspense>{detail.evidence.map((item, i) => <div key={`${item.zone}-${i}`}><strong>{item.scene}</strong><p>{item.description}</p><p>{item.metrics.join(' · ')}</p></div>)}</div>}
              </div>;
            })}
          </section>
          <div className="mobile-report__divider" role="presentation" />
        </>}

        <section className="mobile-report__section">
          <p className="mobile-report__label">02 · 사진과 빛의 기록</p>
          {hasLight ? (
            <>
              {sourceImage && <figure className="mobile-report__photo"><img src={sourceImage} alt="내가 고른 원본 사진" /><figcaption>내가 고른 사진</figcaption></figure>}
              <div className="mobile-report__light">
                <canvas ref={canvasRef} width={1000} height={1000} className="mobile-report__light-canvas" />
              </div>
              {report.kw.length > 0 && <p className="mobile-report__desc">고른 단어 · {report.kw.map(index => EMOTION_KEYWORDS[index].ko).join(' · ')}</p>}
              {color.paletteSwatches.length ? (
                <ul className="mobile-report__swatches" aria-label="팔레트">
                  {color.paletteSwatches.map((hex) => (
                    <li key={hex} className="mobile-report__swatch" style={{ background: hex }} title={hex} />
                  ))}
                </ul>
              ) : null}
              {color.dominantHex ? (
                <>
                  <p className="mobile-report__hex">{color.dominantHex.toUpperCase()} · {color.temperatureLabel}</p>
                  <p className="mobile-report__desc">{color.description}</p>
                </>
              ) : null}
            </>
          ) : (
            <p className="mobile-report__desc">기록된 빛의 흔적이 없습니다.</p>
          )}
        </section>

        <div className="mobile-report__divider" role="presentation" />

        <section className="mobile-report__section">
          <p className="mobile-report__label">03 · 소리의 흔적</p>
          {sound ? <><div className="mobile-report__sound"><SpecimenGlyph clue={sound} /></div><h2 className="mobile-report__section-title">{sound.label}</h2>{positionMeaning && <p className="mobile-report__desc">{positionMeaning}</p>}<p className="mobile-report__desc">이 위치는 그 사람에게 어떻게 들렸을지 상상해 표시한 기억입니다.</p></> : <p className="mobile-report__desc">기록된 소리가 없습니다.</p>}
        </section>
        <div className="mobile-report__divider" role="presentation" />
        <section className="mobile-report__section">
          <p className="mobile-report__label">04 · 기억 속에서 고른 물건</p>
          <div className="mobile-report__memory"><MemoryRoom selectedIds={report.obj} onSelectToggle={() => {}} onViewStart={() => {}} onViewEnd={() => {}} interactive={false} /><canvas ref={sketchRef} width={ROOM_WIDTH} height={ROOM_HEIGHT} aria-label="직접 남긴 그림" /></div>
          <p className="mobile-report__desc">{objects.join(' · ') || '기록된 물건이 없습니다.'}</p>
        </section>
        <div className="mobile-report__divider" role="presentation" />
        <section className="mobile-report__section">
          <p className="mobile-report__label">05 · 이어 붙인 이야기</p>
          <ol className="mobile-report__sentences">{sentences.map((text, i) => <li key={i}>{text}</li>)}</ol>
          <h3 className="mobile-report__section-title">덧붙인 기록</h3>
          <p className="mobile-report__observation">{report.responseAvailable === false ? '이 링크에는 직접 쓴 문장이 포함되지 않았습니다.' : report.response || (report.skipped ? '빈칸으로 남겼습니다.' : '덧붙인 문장이 없습니다.')}</p>
        </section>

        <div className="mobile-report__divider" role="presentation" />

        <section className="mobile-report__section">
          <p className="mobile-report__label">선택의 과정</p>
          <p className="mobile-report__observation">{hasProcess ? PROCESS_GUIDE : '이번 기록에서 확인할 수 있는 선택입니다.'}</p>
          {evidence.length ? (
            evidence.map((item) => <p className="mobile-report__observation" key={item.text}>{item.text}</p>)
          ) : (
            <p className="mobile-report__observation">확인할 수 있는 선택 기록이 없습니다.</p>
          )}
          {positionMeaning && <p className="mobile-report__observation">{positionMeaning}</p>}
          <p className="mobile-report__observation">{RECORD_MEANING}</p>
          <p className="mobile-report__observation">{RECORD_CLOSING}</p>
        </section>

        <div className="mobile-report__divider" role="presentation" />

        <div className="mobile-report__owner">
          <p className="mobile-report__owner-label">흔적을 남긴 관객</p>
          <p className="mobile-report__owner-value">{report.n || '이름 없음'}</p>
        </div>

        <div className="mobile-report__actions">
          <button type="button" className="mobile-report__btn" onClick={saveReport} disabled={rulesLoading || saving}>{saving ? '보고서 준비 중…' : '보고서 PDF로 저장'}</button>
          <button type="button" className="mobile-report__btn" onClick={share}>{copied ? '공유 링크를 복사했습니다' : '공유하기'}</button>
        </div>

        <ExhibitionFeedback key={report.id} reportLink={payload} />

        <p className="mobile-report__print-link"><a href={window.location.href}>온라인에서 이 기록 다시 열기</a></p>
        <p className="mobile-report__note">PDF로 저장을 누른 뒤 인쇄 화면에서 ‘PDF로 저장’을 선택해 주세요.</p>
        <p className="mobile-report__note">{bundle ? '이 링크에서 나의 선택과 기록을 다시 볼 수 있습니다.' : '이 링크에는 고른 단서와 해석이 담겨 있습니다. 선택 화면의 재생 기록은 포함되지 않습니다.'}</p>
      </article>
    </main>
  );
}
