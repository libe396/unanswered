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

      <div className="registration-scene__panel">
        <TerminalCorners />
        <p className="registration-scene__label">조사 요청서 확인 · 조사원증 발급</p>

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
              <input
                className="registration-scene__input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="이름을 입력하세요"
                autoFocus
              />
              <button className="registration-scene__submit" type="submit" disabled={!name.trim()}>
                등록
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
              <motion.p
                className="registration-scene__issuing-label"
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.4, 1, 0.4] }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.2 }
                    : { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                }
              >
                REPORT ID 발급 중
              </motion.p>
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
