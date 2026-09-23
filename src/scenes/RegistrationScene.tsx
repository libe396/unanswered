import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TerminalCorners } from '../components/TerminalCorners';
import { useExperienceStore } from '../store/experienceStore';
import './RegistrationScene.css';

const ISSUE_DELAY_MS = 1400;
const ISSUE_DELAY_MS_REDUCED = 400;

export function RegistrationScene() {
  const [name, setName] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);
  const investigator = useExperienceStore((s) => s.investigator);
  const setInvestigator = useExperienceStore((s) => s.setInvestigator);
  const completeScene = useExperienceStore((s) => s.completeScene);
  const prefersReducedMotion = useReducedMotion();
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isIssuing) return;
    setInvestigator(trimmed);
    setIsIssuing(true);
    timeoutRef.current = window.setTimeout(
      () => completeScene('registration'),
      prefersReducedMotion ? ISSUE_DELAY_MS_REDUCED : ISSUE_DELAY_MS,
    );
  }

  return (
    <div className="registration-scene">
      <div className="registration-scene__glow registration-scene__glow--a" />
      <div className="registration-scene__glow registration-scene__glow--b" />
      <div className="registration-scene__vignette" />

      {/* No outer border: TerminalCorners is the frame. The panel used to
          carry both, which read as two nested rectangles. */}
      <div className="registration-scene__panel">
        <TerminalCorners />

        <AnimatePresence mode="wait">
          {!isIssuing ? (
            <motion.form
              key="form"
              className="registration-scene__form"
              onSubmit={handleSubmit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <p className="registration-scene__eyebrow">REGISTRATION</p>
              <h1 className="registration-scene__title">조사원증을 발급합니다</h1>
              {/*
                Deliberately narrow about where the name turns up. It is shown
                in the Record Layer header (Zone 07) and nowhere else — the
                Summary Receipt and the printed A4 report both carry only the
                REPORT ID (see finalReportPresentation.ts). Promising "조사
                기록에 표시됩니다" in general would be a promise two of the
                three record surfaces do not keep.
              */}
              <p className="registration-scene__description">
                조사 기록 화면에 표시될 이름을 입력해주세요.
              </p>

              <div className="registration-scene__field">
                <label className="registration-scene__field-label" htmlFor="registration-name">
                  이름
                </label>
                <input
                  id="registration-name"
                  className="registration-scene__input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="이름을 입력하세요"
                  autoComplete="off"
                  autoFocus
                />
              </div>

              <button
                className="cta cta--primary registration-scene__submit"
                type="submit"
                disabled={!name.trim()}
              >
                조사원증 발급
              </button>
            </motion.form>
          ) : (
            <motion.div
              key="issuing"
              className="registration-scene__issuing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <p className="registration-scene__issued-label">REPORT ID</p>
              <p className="registration-scene__issued-id">
                {(investigator?.reportId ?? '').split('').map((char, index) => (
                  <motion.span
                    key={index}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: prefersReducedMotion ? 0 : index * 0.05 }}
                  >
                    {char}
                  </motion.span>
                ))}
              </p>
              <motion.p
                className="registration-scene__issued-note"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: prefersReducedMotion ? 0 : 0.5 }}
              >
                조사원증이 발급되었습니다.
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
