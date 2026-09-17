import { useEffect, useRef } from 'react';
import { renderLightGraphic } from '../../lib/lightRenderer.js';
import type { FinalReportPresentation } from '../../lib/finalReportPresentation';
import type { RecordLayerDerived } from '../../types';
import './FinalReportSummaryReceipt.css';

interface Props {
  record: RecordLayerDerived;
  presentation: FinalReportPresentation;
  onIssueFullReport: () => void;
}

/**
 * The screen surface of the Final Report — a narrow printed-receipt read of
 * the visit, not the full investigation document. Every value comes from
 * `presentation` (src/lib/finalReportPresentation.ts), the same model
 * `PrintableFullReport` reads, so the two never show different numbers for
 * the same visit. This component only decides which of those values are
 * worth a receipt's few lines and how they're laid out — it computes
 * nothing itself.
 */
export function FinalReportSummaryReceipt({ record, presentation, onIssueFullReport }: Props) {
  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!record.light || !lightCanvasRef.current) return;
    renderLightGraphic(lightCanvasRef.current, record.light.rules, record.light.variation);
  }, [record.light]);

  const { color, sound, memory, clueLines } = presentation;

  return (
    <div className="summary-receipt">
      <p className="summary-receipt__brand">UNANSWERED ARCHIVE</p>
      <h2 className="summary-receipt__title">결과 요약본</h2>
      <p className="summary-receipt__subtitle">SUMMARY RECEIPT</p>

      <div className="summary-receipt__divider" role="presentation" />

      <div className="summary-receipt__meta">
        <div>
          <dt>REPORT ID</dt>
          <dd>{presentation.reportId}</dd>
        </div>
        <dd className="summary-receipt__meta-date">{presentation.issuedAtLabel}</dd>
      </div>

      <div className="summary-receipt__divider" role="presentation" />

      <section className="summary-receipt__section">
        <p className="summary-receipt__section-label">COLOR / 가장 오래 남은 색</p>
        {color.dominantHex ? (
          <>
            <div className="summary-receipt__color-visual">
              <canvas ref={lightCanvasRef} width={1000} height={1000} className="summary-receipt__light-canvas" />
            </div>
            <p className="summary-receipt__color-hex">
              {color.dominantHex.toUpperCase()} · {color.temperatureLabel}
            </p>
            <p className="summary-receipt__color-desc">{color.description}</p>
          </>
        ) : (
          <p className="summary-receipt__color-desc">기록된 빛의 흔적이 없습니다.</p>
        )}
      </section>

      <div className="summary-receipt__divider" role="presentation" />

      <section className="summary-receipt__section">
        <p className="summary-receipt__section-label">SOUND · SENTENCE · MEMORY</p>
        <ol className="summary-receipt__clues">
          {clueLines.length > 0 ? (
            clueLines.map((line, i) => (
              <li key={`${line.tag}-${i}`} className="summary-receipt__clue">
                <span className="summary-receipt__clue-index">{String(i + 1).padStart(2, '0')}</span>
                <span className="summary-receipt__clue-text">{line.text}</span>
                <span className="summary-receipt__clue-tag">{line.tag}</span>
              </li>
            ))
          ) : (
            <li className="summary-receipt__clue summary-receipt__clue--empty">
              <span className="summary-receipt__clue-text">기록된 단서가 없습니다.</span>
            </li>
          )}
        </ol>
      </section>

      <div className="summary-receipt__divider" role="presentation" />

      <section className="summary-receipt__section">
        <p className="summary-receipt__section-label">LIBERO GRAPHIC</p>
        <p className="summary-receipt__color-desc">
          {sound.hasSound || memory.strokeCount > 0 || memory.selectedObjectCount > 0
            ? '빛 위치 · 색 분포 · 구조점을 번역한 시각 기록'
            : '번역할 행동 데이터가 아직 기록되지 않았습니다.'}
        </p>
      </section>

      <div className="summary-receipt__divider" role="presentation" />

      <section className="summary-receipt__section">
        <p className="summary-receipt__section-label">AI OBSERVATION</p>
        <p className="summary-receipt__observation">{presentation.observationText}</p>
      </section>

      <div className="summary-receipt__divider" role="presentation" />

      <div className="summary-receipt__owner">
        <p className="summary-receipt__owner-label">THE OWNER OF THIS REPORT</p>
        <p className="summary-receipt__owner-value">{presentation.ownerLabel}</p>
        <p className="summary-receipt__owner-scan">SCAN FOR FULL A4 REPORT</p>
      </div>

      <button type="button" className="summary-receipt__issue-btn" onClick={onIssueFullReport}>
        전체 조사 기록 발급하기
        <span className="summary-receipt__issue-btn-en">ISSUE FULL REPORT</span>
      </button>
    </div>
  );
}
