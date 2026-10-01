import { useEffect, useMemo, useRef, useState } from 'react';
import { renderLightGraphic } from '../../lib/lightRenderer.js';
import { EMOTION_KEYWORDS, MEMORY_ROOM_OBJECTS, SENTENCE_RECONSTRUCTION_FRAGMENTS, SOUND_CLUES } from '../../data/content';
import { actionEvidenceText, PROCESS_GUIDE, RECORD_CLOSING, RECORD_MEANING } from '../../lib/reportActionEvidence';
import { buildColorPresentationFromRules, formatIssuedAt, type FinalReportClueTag } from '../../lib/finalReportPresentation';
import { copyText, decodeReport } from '../../lib/reportShare';
import type { LightAnalysisRules } from '../../types';
import './MobileReportView.css';

interface Props {
  payload: string;
}

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
  const report = useMemo(() => decodeReport(payload), [payload]);
  const [rules, setRules] = useState<LightAnalysisRules | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!report?.img) return;
    let active = true;
    // Lazy: ~1MB of contours stays out of the exhibition bundle.
    import('../../data/lightRulesCache.json').then((module) => {
      const cache = module.default as unknown as Record<string, CachedRules>;
      const cached = report.img ? cache[report.img] : undefined;
      if (!active || !cached) return;
      setRules({ ...cached, emotionKeywords: report.kw.map((index) => EMOTION_KEYWORDS[index].ko) });
    });
    return () => { active = false; };
  }, [report]);

  useEffect(() => {
    if (rules && report && canvasRef.current) renderLightGraphic(canvasRef.current, rules, report.var);
  }, [rules, report]);

  if (!report) {
    return (
      <main className="mobile-report mobile-report--error">
        <p className="mobile-report__error">기록을 읽을 수 없습니다. QR을 다시 찍어주세요.</p>
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
  const clueLines: Array<{ text: string; tag: FinalReportClueTag }> = [
    ...(sound ? [{ text: sound.label, tag: 'SOUND' as const }] : []),
    ...sentences.map((text) => ({ text, tag: 'SENTENCE' as const })),
    ...(objects.length ? [{ text: objects.join(' · '), tag: 'MEMORY' as const }] : []),
  ];
  const evidence = report.ev
    .map((item) => ({ kind: item.kind, text: actionEvidenceText(item.kind, item.sceneId, item.targetId, item.tenths) }))
    .filter((item): item is { kind: typeof item.kind; text: string } => Boolean(item.text))
    .slice(0, 3);
  const hasProcess = evidence.some((item) => item.kind !== 'selection');

  function saveGraphic() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `UNANSWERED_${report!.id}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 4000);
    }, 'image/png');
  }

  async function copyLink() {
    if (await copyText(window.location.href)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <main className="mobile-report">
      <article className="mobile-report__receipt">
        <p className="mobile-report__brand">UNANSWERED ARCHIVE</p>
        <h1 className="mobile-report__title">최종보고서 요약본</h1>
        <p className="mobile-report__subtitle">SUMMARY RECEIPT</p>

        <div className="mobile-report__divider" role="presentation" />

        <div className="mobile-report__meta">
          <div>
            <p className="mobile-report__meta-label">REPORT ID</p>
            <p className="mobile-report__meta-value">{report.id}</p>
          </div>
          <p className="mobile-report__meta-date">{formatIssuedAt(report.t === null ? null : report.t * 60_000)}</p>
        </div>

        <div className="mobile-report__divider" role="presentation" />

        <section className="mobile-report__section">
          <p className="mobile-report__label">COLOR / 가장 오래 남은 색</p>
          {hasLight ? (
            <>
              <div className="mobile-report__light">
                <canvas ref={canvasRef} width={1000} height={1000} className="mobile-report__light-canvas" />
              </div>
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
          <p className="mobile-report__label">SOUND · SENTENCE · MEMORY</p>
          <ol className="mobile-report__clues">
            {clueLines.length ? (
              clueLines.map((line, i) => (
                <li key={`${line.tag}-${i}`} className="mobile-report__clue">
                  <span className="mobile-report__clue-index">{String(i + 1).padStart(2, '0')}</span>
                  <span className="mobile-report__clue-text">{line.text}</span>
                  <span className="mobile-report__clue-tag">{line.tag}</span>
                </li>
              ))
            ) : (
              <li className="mobile-report__clue mobile-report__clue--empty">
                <span className="mobile-report__clue-text">기록된 단서가 없습니다.</span>
              </li>
            )}
          </ol>
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
          <p className="mobile-report__observation">{RECORD_MEANING}</p>
          <p className="mobile-report__observation">{RECORD_CLOSING}</p>
        </section>

        <div className="mobile-report__divider" role="presentation" />

        <div className="mobile-report__owner">
          <p className="mobile-report__owner-label">흔적을 남긴 관객</p>
          <p className="mobile-report__owner-value">{report.n || '이름 없음'}</p>
        </div>

        <div className="mobile-report__actions">
          {hasLight ? (
            <button type="button" className="mobile-report__btn" onClick={saveGraphic} disabled={!rules}>
              빛 그래픽 저장
            </button>
          ) : null}
          <button type="button" className="mobile-report__btn" onClick={copyLink}>
            {copied ? '복사했습니다' : '링크 복사'}
          </button>
        </div>

        <p className="mobile-report__note">이 기록은 이 링크에만 담겨 있습니다. 서버에 저장되지 않습니다.</p>
      </article>
    </main>
  );
}
