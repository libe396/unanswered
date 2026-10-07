import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { PersonalFinding } from '../../lib/personalFindingInterpretation';
import { FindingRecordGraphic } from './FindingRecordGraphic';
import { ReportStageNav } from './ReportStageNav';
import './ReportStageFindings.css';

interface Props {
  finding: PersonalFinding;
  /** 1-based position among this visit's Findings. */
  order: number;
  count: number;
  index: number;
  total: number;
  locked: boolean;
  onAdvance: () => void;
  nextLabel: string;
}

export function ReportStageFinding({ finding, order, count, index, total, locked, onAdvance, nextLabel }: Props) {
  const reduced = useReducedMotion();
  const step = 3;
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const openButton = useRef<HTMLButtonElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const evidenceRef = useRef<HTMLElement | null>(null);

  // Reading and the next action are available together; no timed reading gate.

  useEffect(() => {
    if (!evidenceOpen) return;
    const dialog = evidenceRef.current;
    if (!dialog) return;
    // Disable only siblings of the dialog's ancestor path; restore their
    // original state on close so global scene controls remain untouched.
    const background: { node: HTMLElement; inert: boolean }[] = [];
    let branch: HTMLElement = dialog;
    while (branch.parentElement) {
      const parent = branch.parentElement;
      Array.from(parent.children).forEach((node) => {
        if (node !== branch && node instanceof HTMLElement) {
          background.push({ node, inert: node.inert });
          node.inert = true;
        }
      });
      if (parent === document.body) break;
      branch = parent;
    }
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeEvidence();
      } else if (event.key === 'Tab') {
        // The evidence currently has one action: close. Keep both Tab
        // directions here while the scrollable record remains readable.
        event.preventDefault();
        closeButton.current?.focus();
      }
    };
    const keepFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) closeButton.current?.focus();
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', keepFocus);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', keepFocus);
      background.forEach(({ node, inert }) => { node.inert = inert; });
    };
  }, [evidenceOpen]);

  function closeEvidence() {
    setEvidenceOpen(false);
    window.setTimeout(() => openButton.current?.focus(), 0);
  }

  const fade = (delay = 0) => ({ duration: reduced ? 0.1 : 1, delay: reduced ? 0 : delay, ease: [0.22, 1, 0.36, 1] as const });

  return (
    <div className={`report-stage report-finding${evidenceOpen ? ' report-finding--evidence' : ''}`}>
      <p className="report-stage__eyebrow">
        <span className="report-stage__eyebrow-code">REPORT {String(index).padStart(2, '0')}</span>
        <span className="report-stage__eyebrow-sep" aria-hidden="true">·</span>
        <span className="report-stage__eyebrow-title">
          {count > 1 ? `발견 ${order} / ${count}` : '발견'}
        </span>
      </p>

      <div className="report-stage__body report-finding__body" aria-hidden={evidenceOpen}>
        <FindingRecordGraphic finding={finding} />
        <motion.h2 className="report-finding__headline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={fade(0.2)}>
          {finding.headline}
        </motion.h2>
        <p className="report-finding__record-caption">{finding.evidence.map((item) => item.scene).filter((scene, i, scenes) => scenes.indexOf(scene) === i).join(' · ')}</p>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: step >= 3 ? 1 : 0 }} transition={fade()}>
          <button
            ref={openButton}
            type="button"
            className="cta cta--text report-finding__why"
            onClick={() => setEvidenceOpen(true)}
            tabIndex={step >= 3 ? 0 : -1}
            aria-haspopup="dialog"
          >
            내 기록 살펴보기
          </button>
        </motion.div>
      </div>

      <AnimatePresence>
        {evidenceOpen ? (
          <motion.section
            ref={evidenceRef}
            key="evidence"
            className="report-evidence-layer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-evidence-title"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: reduced ? 0.1 : 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="report-evidence-layer__head">
              <p id="report-evidence-title" className="report-evidence-layer__title">조사 기록</p>
              <button ref={closeButton} type="button" className="report-evidence-layer__close" onClick={closeEvidence}>
                닫기
              </button>
            </header>
            <h3 className="report-evidence-layer__headline">{finding.headline}</h3>
            <p className="report-evidence-layer__pattern">{finding.interpretation}</p>
            <p className="report-evidence-layer__reflection">{finding.reflection}</p>
            <p className="report-evidence-layer__pattern">{finding.pattern}</p>
            <ol className="report-evidence-layer__list">
              {finding.evidence.map((item, i) => (
                <li key={`${item.zone}-${i}`} className="report-evidence-layer__item">
                  <span className="report-evidence-layer__scene">{item.scene}</span>
                  <span className="report-evidence-layer__description">{item.description}</span>
                  {item.metrics.length > 0 ? (
                    <span className="report-evidence-layer__metrics">
                      {item.metrics.map((metric) => (
                        <span key={metric}>{metric}</span>
                      ))}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            <p className="report-evidence-layer__note">이번 방문에서 실제로 기록된 값입니다. 머문 시간에는 읽기와 조작 시간이 포함되며, 그 이유까지 알 수는 없습니다.</p>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <ReportStageNav
        label={nextLabel}
        index={index}
        total={total}
        visible={step >= 3 && !evidenceOpen}
        onAdvance={onAdvance}
        disabled={locked}
      />
    </div>
  );
}
