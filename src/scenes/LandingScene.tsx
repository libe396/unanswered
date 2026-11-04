import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useExperienceStore } from '../store/experienceStore';
import { MemoryField } from '../components/MemoryField';
import { LandingRecordCard } from '../components/LandingRecordCard';
import wordmarkUrl from '../assets/wordmark.svg';
import { activateFilmSound } from '../hooks/useFilmSound';
import { catalogHref, isVenueMode } from '../lib/venueMode';
import './LandingScene.css';

// Keep the entry available as soon as the short reveal finishes.
const ENTRY_ARMED_AFTER_MS = 600;
const FIGURE_PROXIMITY_PX = 320;

const SENTENCE = '한 사람의 기록이\n발견되었습니다.';
/** A line break is a breath, not a keystroke. */
const LINE_PAUSE_MS = 420;
const TYPE_START_MS = 600;
const SUB_DELAY_MS = 500;
/** Anything further than this from the press is a drag, not an entry. */
const DRAG_SLOP_PX = 6;

export function LandingScene() {
  const completeScene = useExperienceStore((s) => s.completeScene);
  const updateLanding = useExperienceStore((s) => s.updateLanding);
  const prefersReducedMotion = useReducedMotion();

  const [entryArmed, setEntryArmed] = useState(false);
  const [fieldActive, setFieldActive] = useState(false);
  const [entryFocused, setEntryFocused] = useState(false);
  const [entering, setEntering] = useState(false);
  const [typed, setTyped] = useState('');
  const [subVisible, setSubVisible] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  // The booth shows 전시 소개 too; its link keeps `?venue=1` so the way back
  // returns to venue mode (2026-11-04, booth request).
  const [venue] = useState(isVenueMode);
  // A phone or tablet, by input capability rather than by screen width.
  const [touchOnly] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches,
  );
  const startEntryRef = useRef<(() => void) | null>(null);
  const figureWrapRef = useRef<HTMLDivElement>(null);
  const linkTextRef = useRef<HTMLSpanElement>(null);
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const mountedAtRef = useRef(0);
  const dwellRef = useRef(0);
  const travelRef = useRef(0);
  const advancedRef = useRef(false);

  // Trace recording. Deliberately separate from MemoryField's own loop: the
  // field owns how it *looks*, this owns what the visit *left behind*.
  useEffect(() => {
    mountedAtRef.current = Date.now();
    // Landing is re-entered on every reload, so only the first arrival counts
    // as "when did this person show up" — later passes must not overwrite it.
    if (!useExperienceStore.getState().landing.enteredAt) {
      updateLanding({ enteredAt: mountedAtRef.current });
    }
    const armTimer = window.setTimeout(
      () => setEntryArmed(true),
      prefersReducedMotion ? ENTRY_ARMED_AFTER_MS * 0.3 : ENTRY_ARMED_AFTER_MS,
    );

    let lastPoint: { x: number; y: number } | null = null;
    let lastSampleAt = performance.now();

    function handleMove(event: MouseEvent) {
      const now = performance.now();
      if (lastPoint) {
        travelRef.current += Math.hypot(event.clientX - lastPoint.x, event.clientY - lastPoint.y);
      }
      lastPoint = { x: event.clientX, y: event.clientY };

      const wrap = figureWrapRef.current;
      if (wrap) {
        const rect = wrap.getBoundingClientRect();
        const distance = Math.hypot(
          event.clientX - (rect.left + rect.width / 2),
          event.clientY - (rect.top + rect.height / 2),
        );
        // Time spent close to the record — how long they stayed with it.
        if (distance < FIGURE_PROXIMITY_PX) {
          dwellRef.current += Math.min(now - lastSampleAt, 200);
        }
      }
      lastSampleAt = now;
    }

    function handleBeforeUnload() {
      if (advancedRef.current) return;
      updateLanding({
        bounced: true,
        figureDwellMs: Math.round(dwellRef.current),
        cursorTravelPx: Math.round(travelRef.current),
      });
    }

    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.clearTimeout(armTimer);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The sentence is found a letter at a time, the way the record is. */
  useEffect(() => {
    if (prefersReducedMotion) {
      setTyped(SENTENCE);
      setSubVisible(true);
      return;
    }
    let timer = 0;
    let i = 0;
    const next = () => {
      i += 1;
      setTyped(SENTENCE.slice(0, i));
      if (i < SENTENCE.length) {
        const c = SENTENCE[i - 1];
        timer = window.setTimeout(next, c === '\n' ? LINE_PAUSE_MS : 85 + Math.random() * 70);
      } else {
        timer = window.setTimeout(() => setSubVisible(true), SUB_DELAY_MS);
      }
    };
    timer = window.setTimeout(next, TYPE_START_MS);
    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion]);

  /** Keep the existing entry timing and recorded traces after the card dissolves. */
  function handleEnter() {
    if (advancedRef.current) return;
    advancedRef.current = true;
    updateLanding({
      timeToEnterMs: Date.now() - mountedAtRef.current,
      figureDwellMs: Math.round(dwellRef.current),
      cursorTravelPx: Math.round(travelRef.current),
      bounced: false,
    });
    completeScene('landing');
    if (import.meta.env.DEV) {
      console.info(`[entry] scene-change:${useExperienceStore.getState().currentScene}`);
    }
  }

  function handleCollapseStart() {
    activateFilmSound();
    setFieldActive(false);
    setEntering(true);
  }

  function startEntry() {
    if (!entryArmed || entering) return;
    startEntryRef.current?.();
  }

  /** Anywhere on the screen is the way in — except the catalogue link, and
   *  except a drag, which is someone looking rather than deciding. */
  function handleSceneClick(event: React.MouseEvent<HTMLDivElement>) {
    if (touchOnly) return;
    if ((event.target as HTMLElement).closest('.landing-scene__catalog')) return;
    const press = pressRef.current;
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > DRAG_SLOP_PX) return;
    startEntry();
  }

  useEffect(() => {
    if (touchOnly) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key !== 'Enter') return;
      // A focused link or button answers for itself.
      if ((event.target as HTMLElement | null)?.closest('a, button')) return;
      startEntry();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touchOnly, entryArmed, entering]);

  /** If the clipboard is refused, put the address where it can be copied by hand. */
  useEffect(() => {
    if (copyState !== 'manual' || !linkTextRef.current) return;
    const range = document.createRange();
    range.selectNodeContents(linkTextRef.current);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [copyState]);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('copied');
    } catch {
      setCopyState('manual');
    }
  }

  const sceneClass = [
    'landing-scene',
    fieldActive || entryFocused ? 'landing-scene--field-active' : '',
    entering ? 'landing-scene--entering' : '',
    touchOnly ? 'landing-scene--touch' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={sceneClass}
      onPointerDown={(event) => { pressRef.current = { x: event.clientX, y: event.clientY }; }}
      onClick={handleSceneClick}
    >
      <div className="landing-scene__room" />

      <div className="landing-scene__top" inert={entering}>
        <img className="landing-scene__wordmark" src={wordmarkUrl} alt="UNANSWERED" />
        <a className="landing-scene__catalog" href={catalogHref(venue)}>
          전시 소개 <span aria-hidden="true">↗</span>
        </a>
      </div>

      <LandingRecordCard entering={entering} cardRef={figureWrapRef} />

      {/* The hidden field preserves the existing entry timing and callbacks. */}
      <div className="landing-scene__visual">
        <div className="landing-scene__figure">
          <MemoryField
            startEntryRef={startEntryRef}
            onEnter={handleEnter}
            onCollapseStart={handleCollapseStart}
            onHoverChange={setFieldActive}
            interactive={entryArmed}
          />
        </div>
      </div>

      <div className="landing-scene__say" inert={entering}>
        <h1 className="landing-scene__headline">
          <span>{typed}</span>
          <i className="landing-scene__cursor" aria-hidden="true" />
        </h1>
        <p className={`landing-scene__description${subVisible ? ' is-visible' : ''}`}>
          남겨진 단서로 그 사람을 떠올려 보세요.
        </p>

        {/* Half of this exhibition is sound, and visitors kept starting without
            the headphones in front of them (2026-11-04, booth observation). */}
        {!touchOnly && (
          <p className={`landing-scene__sound-note${subVisible ? ' is-visible' : ''}`}>
            소리가 있는 전시입니다. 헤드폰을 착용해 주세요.
          </p>
        )}

        {touchOnly ? (
          <div className="landing-scene__touch-note">
            <p>이 전시는 PC에서 관람하도록 만들어졌습니다. 마우스와 헤드폰이 있는 환경을 권장합니다.</p>
            <button type="button" className="landing-scene__copy" onClick={handleCopyLink}>
              {copyState === 'copied' ? '링크를 복사했습니다' : '링크 복사'}
            </button>
            {copyState === 'manual' && (
              <span className="landing-scene__link-text" ref={linkTextRef}>
                {window.location.href}
              </span>
            )}
            <button type="button" className="landing-scene__continue" onClick={startEntry}>
              그래도 계속 보기
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="landing-scene__prompt"
            disabled={!entryArmed || entering}
            onClick={(event) => { event.stopPropagation(); startEntry(); }}
            onPointerEnter={() => setEntryFocused(true)}
            onPointerLeave={() => setEntryFocused(false)}
            onFocus={() => setEntryFocused(true)}
            onBlur={() => setEntryFocused(false)}
          >
            <strong>CLICK ANYWHERE TO BEGIN</strong>
            <span>클릭하면 조사가 시작됩니다 · 약 5분</span>
          </button>
        )}

      </div>
    </div>
  );
}
