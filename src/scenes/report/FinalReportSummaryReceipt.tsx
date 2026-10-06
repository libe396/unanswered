import { buildActionEvidence, PROCESS_GUIDE, RECORD_MEANING } from '../../lib/reportActionEvidence';
import { useExperienceStore } from '../../store/experienceStore';
import { useEffect, useRef, useState } from 'react';
import { renderLightGraphic } from '../../lib/lightRenderer.js';
import type { FinalReportPresentation } from '../../lib/finalReportPresentation';
import { copyText } from '../../lib/reportShare';
import { ReportQr } from './ReportQr';
import type { RecordLayerDerived } from '../../types';
import './FinalReportSummaryReceipt.css';

interface Props {
  record: RecordLayerDerived;
  presentation: FinalReportPresentation;
  onIssueFullReport: () => void;
  /** This visit's mobile report link (src/lib/reportShare.ts). */
  reportUrl: string;
  /** `?venue=1`: the large QR lives beside the receipt (FinalRecordLayer), and
   *  there is no printer or clipboard worth offering on the venue PC. */
  venue: boolean;
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
export function FinalReportSummaryReceipt({ record, presentation, onIssueFullReport, reportUrl, venue }: Props) {
  const behavior = useExperienceStore((state) => state.behavior);
  const evidence = buildActionEvidence(record, behavior);
  const hasProcess = evidence.some((item) => item.kind !== 'selection');
  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (await copyText(reportUrl)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  useEffect(() => {
    if (!record.light || !lightCanvasRef.current) return;
    renderLightGraphic(lightCanvasRef.current, record.light.rules, record.light.variation);
  }, [record.light]);

  const { color, sound, memory, clueLines } = presentation;

  return (
    <div className="summary-receipt">
      <p className="summary-receipt__brand">UNANSWERED ARCHIVE</p>
      <h2 className="summary-receipt__title">최종보고서 요약본</h2>
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
        <p className="summary-receipt__section-label">단서가 남긴 빛</p>
        <p className="summary-receipt__color-desc">
          {sound.hasSound || memory.strokeCount > 0 || memory.selectedObjectCount > 0
            ? '고른 사진의 빛과 색이 남긴 모습입니다.'
            : '아직 남은 흔적이 없습니다.'}
        </p>
      </section>

      <div className="summary-receipt__divider" role="presentation" />

      <section className="summary-receipt__section">
        <p className="summary-receipt__section-label">선택의 과정</p>
        <p className="summary-receipt__observation">{hasProcess ? PROCESS_GUIDE : '이번 기록에서 확인할 수 있는 선택입니다.'}</p>
        {evidence.length ? evidence.map((item) => <p className="summary-receipt__observation" key={item.text}>{item.text}</p>) : <p className="summary-receipt__observation">확인할 수 있는 선택 기록이 없습니다.</p>}
        <p className="summary-receipt__observation">{RECORD_MEANING}</p>
      </section>

      <div className="summary-receipt__divider" role="presentation" />

      <div className="summary-receipt__owner">
        <p className="summary-receipt__owner-label">흔적을 남긴 관객</p>
        <p className="summary-receipt__owner-value">{presentation.ownerLabel}</p>
        {!venue ? (
          <div className="summary-receipt__qr">
            <ReportQr url={reportUrl} size={150} className="summary-receipt__qr-code" />
            <p className="summary-receipt__owner-scan">폰으로 보고서 받기 / SCAN TO KEEP</p>
            <button type="button" className="summary-receipt__copy-btn" onClick={copyLink}>
              {copied ? '복사했습니다' : '링크 복사'}
            </button>
          </div>
        ) : null}
      </div>

      {!venue ? (
        <button type="button" className="summary-receipt__issue-btn" onClick={onIssueFullReport}>
          전체 조사 기록 발급하기
          <span className="summary-receipt__issue-btn-en">ISSUE FULL REPORT</span>
        </button>
      ) : null}
    </div>
  );
}
