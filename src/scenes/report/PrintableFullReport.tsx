import { useEffect, useRef } from 'react';
import { renderLightGraphic } from '../../lib/lightRenderer.js';
import { drawStrokes } from '../../lib/memorySketch';
import { MemoryRoom } from '../../components/MemoryRoom';
import type { FinalReportPresentation } from '../../lib/finalReportPresentation';
import type { RecordLayerDerived } from '../../types';
import './PrintableFullReport.css';

interface Props {
  record: RecordLayerDerived;
  presentation: FinalReportPresentation;
}

/**
 * The print surface of the Final Report — the A4 investigation document
 * `window.print()` produces (see FinalRecordLayer.tsx's issue action).
 * Invisible on screen (src/scenes/report/PrintableFullReport.css hides it
 * outside `@media print`, the same technique this file's predecessor,
 * src/scenes/SavedReportDocument.tsx, already used) and rendered only when
 * the browser actually paginates the page.
 *
 * Reads the same `presentation` model FinalReportSummaryReceipt does, plus
 * `record` directly only for the two canvases (`renderLightGraphic`,
 * `drawStrokes`) that need the raw light rules / stroke list to draw — never
 * a number computed independently of what the receipt already shows.
 */
export function PrintableFullReport({ record, presentation }: Props) {
  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sketchCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!record.light || !lightCanvasRef.current) return;
    renderLightGraphic(lightCanvasRef.current, record.light.rules, record.light.variation);
  }, [record.light]);

  useEffect(() => {
    const canvas = sketchCanvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    drawStrokes(context, record.memorySketch.strokes, canvas.width, canvas.height);
  }, [record.memorySketch]);

  const { color, sound, sentence, memory } = presentation;
  const hasMemoryTrace = record.memorySketch.strokes.length > 0 || record.memorySketch.selectedObjects.length > 0;

  return (
    <div className="printable-full-report">
      <div className="printable-full-report__page">
        <header className="pfr-header">
          <p className="pfr-header__eyebrow">UNANSWERED ARCHIVE / 미응답 보관소</p>
          <h1 className="pfr-header__title">이름 없는 사람 조사 보고서</h1>
          <p className="pfr-header__subtitle">ANONYMOUS PERSON INVESTIGATION REPORT</p>
        </header>

        <section className="pfr-meta">
          <div className="pfr-meta__item">
            <dt>REPORT ID</dt>
            <dd>{presentation.reportId}</dd>
          </div>
          <div className="pfr-meta__item">
            <dt>ISSUED</dt>
            <dd>{presentation.issuedAtLabel}</dd>
          </div>
          <div className="pfr-meta__item">
            <dt>RECORD STATUS</dt>
            <dd className="pfr-meta__status">{presentation.recordStatus}</dd>
          </div>
        </section>

        <section className="pfr-section">
          <p className="pfr-section__label">01&nbsp;&nbsp;COLOR / 색의 단서</p>

          {color.dominantHex ? (
            <>
              <div className="pfr-color__visual">
                <canvas ref={lightCanvasRef} width={1000} height={1000} className="pfr-color__canvas" />
                {record.light?.imagePath ? (
                  <img src={record.light.imagePath} alt="" className="pfr-color__source-image" />
                ) : null}
              </div>

              {color.paletteSwatches.length > 0 ? (
                <div className="pfr-color__palette">
                  {color.paletteSwatches.map((hex, i) => (
                    <div key={`${hex}-${i}`} className="pfr-color__swatch">
                      <span className="pfr-color__swatch-chip" style={{ background: hex }} />
                      <span className="pfr-color__swatch-hex">{hex.replace('#', '').toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="pfr-color__facts">
                <div>
                  <dt>중심 빛</dt>
                  <dd>{color.centerLightHex?.toUpperCase() ?? '-'}</dd>
                </div>
                <div>
                  <dt>배경 잔상</dt>
                  <dd>{color.residueHex?.toUpperCase() ?? '-'}</dd>
                </div>
                <div>
                  <dt>색의 온도</dt>
                  <dd>{color.temperatureLabel}</dd>
                </div>
              </div>

              <p className="pfr-section__body">{color.description}</p>
            </>
          ) : (
            <p className="pfr-section__body">기록된 빛의 흔적이 없습니다.</p>
          )}
        </section>

        <section className="pfr-section pfr-section--avoid-break">
          <p className="pfr-section__label">02&nbsp;&nbsp;SOUND / 소리의 단서</p>

          {sound.hasSound ? (
            <>
              <div className="pfr-sound__waveform" aria-hidden="true">
                {sound.waveform.map((level, i) => (
                  <span key={i} className="pfr-sound__bar" style={{ height: `${Math.round(level * 100)}%` }} />
                ))}
                <span className="pfr-sound__cursor" style={{ left: `${Math.round(sound.progress * 100)}%` }} />
              </div>
              <p className="pfr-section__body">
                선택한 소리 — {sound.label}
                {sound.dwellSeconds !== null ? ` · 머문 시간 ${sound.dwellSeconds}초` : ''}
              </p>
              <p className="pfr-section__body pfr-section__body--dim">소리의 감각 — {sound.sensation}</p>
            </>
          ) : (
            <p className="pfr-section__body">기록된 청취 반응이 없습니다.</p>
          )}
        </section>

        <section className="pfr-section pfr-section--avoid-break">
          <p className="pfr-section__label">03&nbsp;&nbsp;SENTENCE / 문장의 단서</p>

          {sentence.selectedSentences.length > 0 ? (
            <div className="pfr-sentence__capsules">
              {sentence.selectedSentences.map((text, i) => (
                <span key={i} className="pfr-sentence__capsule">
                  {text}
                </span>
              ))}
            </div>
          ) : (
            <p className="pfr-section__body">기록된 문장이 없습니다.</p>
          )}

          {sentence.authoredResponse ? (
            <p className="pfr-section__body">직접 쓴 문장 — &ldquo;{sentence.authoredResponse}&rdquo;</p>
          ) : null}

          {sentence.repeatedKeywords.length > 0 ? (
            <p className="pfr-section__body pfr-section__body--dim">반복된 단어 — {sentence.repeatedKeywords.join(', ')}</p>
          ) : null}
        </section>

        <section className="pfr-section pfr-section--avoid-break">
          <p className="pfr-section__label">04&nbsp;&nbsp;MEMORY / 기억의 단서</p>

          <div className="pfr-memory__bars">
            <div className="pfr-memory__bar-row">
              <dt>기억 형태</dt>
              <div className="pfr-memory__bar-track">
                <div className="pfr-memory__bar-fill" style={{ width: `${Math.round(memory.formRatio * 100)}%` }} />
              </div>
              <dd>{memory.formLabel}</dd>
            </div>
            <div className="pfr-memory__bar-row">
              <dt>기억의 색온도</dt>
              <div className="pfr-memory__bar-track">
                <div className="pfr-memory__bar-fill" style={{ width: `${Math.round(memory.temperatureRatio * 100)}%` }} />
              </div>
              <dd>{memory.temperatureLabel}</dd>
            </div>
          </div>

          {hasMemoryTrace ? (
            <div className="pfr-memory__visual">
              <MemoryRoom
                selectedIds={record.memorySketch.selectedObjects}
                onSelectToggle={() => {}}
                onViewStart={() => {}}
                onViewEnd={() => {}}
                interactive={false}
              />
              <canvas ref={sketchCanvasRef} width={1200} height={800} className="pfr-memory__sketch" />
            </div>
          ) : null}

          <p className="pfr-section__body pfr-section__body--dim">{memory.markedPointsSummary}</p>
        </section>

        <section className="pfr-section pfr-observation pfr-section--avoid-break">
          <p className="pfr-section__label">05&nbsp;&nbsp;AI OBSERVATION / 관찰문</p>
          <p className="pfr-observation__text">{presentation.observationText}</p>
        </section>

        <footer className="pfr-footer">
          <div>
            <p className="pfr-footer__label">THE OWNER OF THIS REPORT / 보고서의 주인</p>
            <p className="pfr-footer__owner">{presentation.ownerLabel}</p>
          </div>
          <p className="pfr-footer__report-id">{presentation.reportId}</p>
        </footer>
      </div>
    </div>
  );
}
