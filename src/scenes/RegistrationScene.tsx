import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { TerminalCorners } from '../components/TerminalCorners';
import { StageLayout, type StageStep } from '../components/StageLayout';
import { useExperienceStore } from '../store/experienceStore';
import './RegistrationScene.css';

/** The issue beat — how long the card takes to come back with an id. */
const ISSUE_DELAY_MS = 1400;
const ISSUE_DELAY_MS_REDUCED = 400;

/*
  The id arrives one character at a time on the card's REPORT ID line. These
  two mirror the per-character motion in the markup below; change them
  together.
*/
const ID_REVEAL_STAGGER_MS = 50; // matches `delay: index * 0.05`
const ID_REVEAL_CHAR_MS = 300; // matches `duration: 0.3`

/** When the last character has finished arriving. */
function idRevealEndMs(length: number, reduced: boolean): number {
  if (reduced) return ID_REVEAL_CHAR_MS;
  return Math.max(0, length - 1) * ID_REVEAL_STAGGER_MS + ID_REVEAL_CHAR_MS;
}

const STEPS: StageStep[] = [
  { index: '01', label: '이름 입력' },
  { index: '02', label: 'ID 발급' },
  { index: '03', label: '조사 시작' },
];

/** Shown on the card before an id exists — the same shape, none of the value. */
const ID_PLACEHOLDER = 'RPT-·····';

type Phase = 'form' | 'issuing' | 'issued';

/**
 * Zone 02 — the pass is issued.
 *
 * The reference screen for the two-column stage: the card is the object, and
 * everything the visitor reads or does sits beside it. That is also what
 * fixed the Scene's two real problems at once. The card no longer swaps
 * itself out for a separate "id reveal" layout, so the id is not on screen
 * for three quarters of a second and then gone; and because the Scene now
 * ends on a button rather than a timer, coming back to it with Back is no
 * longer a dead end that can only be escaped by issuing a second REPORT ID
 * over the one already on the visitor's record.
 */
export function RegistrationScene() {
  const investigator = useExperienceStore((s) => s.investigator);
  const setInvestigator = useExperienceStore((s) => s.setInvestigator);
  const completeScene = useExperienceStore((s) => s.completeScene);
  const prefersReducedMotion = useReducedMotion();
  const timeoutRef = useRef<number | undefined>(undefined);

  /*
    Read once, on mount. `investigator` becomes non-null the moment the form
    is submitted, so checking it on every render would report a first-time
    issue as a return visit halfway through its own animation.
  */
  const enteredWithCardRef = useRef(investigator !== null);

  const [phase, setPhase] = useState<Phase>(() =>
    enteredWithCardRef.current ? 'issued' : 'form',
  );
  const [name, setName] = useState(() =>
    enteredWithCardRef.current ? (investigator?.investigatorName ?? '') : '',
  );

  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (phase !== 'form') return;
    const trimmed = name.trim();
    if (!trimmed) return;

    setInvestigator(trimmed);
    setPhase('issuing');

    // Zustand's set is synchronous, so the id the reveal is about to animate
    // is already readable.
    const issuedId = useExperienceStore.getState().investigator?.reportId ?? '';
    const revealEnd = idRevealEndMs(issuedId.length, Boolean(prefersReducedMotion));
    const settleAfter = prefersReducedMotion
      ? Math.max(ISSUE_DELAY_MS_REDUCED, revealEnd)
      : Math.max(ISSUE_DELAY_MS, revealEnd);

    timeoutRef.current = window.setTimeout(() => setPhase('issued'), settleAfter);
  }

  const reportId = investigator?.reportId ?? '';
  const showsId = phase !== 'form' && reportId.length > 0;
  const isIssued = phase === 'issued';
  const activeStep = phase === 'form' ? '01' : phase === 'issuing' ? '02' : '03';

  const card = (
    <div className="pass-card glass">
      <TerminalCorners />

      <div className="pass-card__head">
        <span className="pass-card__kind">
          TEMPORARY
          <br />
          INVESTIGATOR
        </span>
        <span className="pass-card__kind-mark">ID</span>
      </div>

      {/*
        No portrait exists for this person, which is the point of the
        exhibition — so the frame holds a shape rather than a face. Drawn in
        CSS (see .pass-card__silhouette): there is no figure asset in the
        project, and Landing's figure is a particle field, not an image.
      */}
      <div className="pass-card__photo">
        <span className="pass-card__silhouette" aria-hidden="true" />
        <span className="pass-card__photo-note">UNIDENTIFIED</span>
      </div>

      <div className="pass-card__field">
        <span className="pass-card__field-label">NAME</span>
        <span className={`pass-card__name${name.trim() ? '' : ' pass-card__name--empty'}`}>
          {name.trim() || '—'}
        </span>
      </div>

      <div className="pass-card__field">
        <span className="pass-card__field-label">REPORT ID</span>
        <span className={`pass-card__id${isIssued ? ' pass-card__id--issued' : ''}`}>
          {showsId
            ? reportId.split('').map((char, index) => (
                <motion.span
                  key={index}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: ID_REVEAL_CHAR_MS / 1000,
                    delay: prefersReducedMotion ? 0 : (index * ID_REVEAL_STAGGER_MS) / 1000,
                  }}
                >
                  {char}
                </motion.span>
              ))
            : ID_PLACEHOLDER}
        </span>
      </div>

      {/* Decoration, not a real symbology — nothing is encoded here. */}
      <span className="pass-card__barcode" aria-hidden="true" />

      <div className="pass-card__foot">
        <span className="pass-card__ticks" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <span
              key={index}
              className={`pass-card__tick${index === 1 ? ' pass-card__tick--current' : ''}`}
            />
          ))}
        </span>
        <span className="pass-card__foot-row">
          <span>ZONE</span>
          <span>02 / 08</span>
        </span>
      </div>
    </div>
  );

  return (
    <div className="registration-scene">
      <StageLayout
        className="registration-scene__stage"
        object={card}
        eyebrow="REGISTRATION"
        title="조사원증을 발급합니다"
        description="이름 없는 사람을 찾는 동안 사용할 임시 조사원증입니다. 조사 기록 화면에 표시될 이름을 입력해주세요."
        steps={STEPS}
        activeStep={activeStep}
      >
        <form className="registration-scene__form" onSubmit={handleSubmit}>
          <label className="registration-scene__field-label" htmlFor="registration-name">
            이름
          </label>
          <input
            id="registration-name"
            className="registration-scene__input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="닉네임도 가능합니다"
            /* The card prints this name at 18px in a 224px-wide field; past
               a dozen characters it is an ellipsis either way. */
            maxLength={12}
            autoComplete="off"
            autoFocus={phase === 'form'}
            disabled={phase !== 'form'}
          />

          {isIssued ? (
            <button
              type="button"
              className="cta cta--primary registration-scene__submit"
              onClick={() => completeScene('registration')}
            >
              조사 시작
            </button>
          ) : (
            <button
              type="submit"
              className="cta cta--primary registration-scene__submit"
              disabled={!name.trim() || phase === 'issuing'}
            >
              조사원증 발급
            </button>
          )}
        </form>
      </StageLayout>
    </div>
  );
}
