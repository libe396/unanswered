import { useEffect, useRef, useState } from 'react';
import { animate, useInView } from 'framer-motion';
import { nav, record } from './content.js';
import { CtaLink } from './shared';
import { scrollToId, useActiveSection } from './CatalogNav';

/* ── 07 · RECORD — how long this visit stayed on each section ─────────── */

interface Result {
  longest: { label: string; seconds: number };
  fastest: string | null;
}

/**
 * Times each of the six body sections while it sits across the middle of
 * the viewport (and the tab is visible). Memory only: nothing is stored,
 * sent or kept past this page view.
 */
function useSectionDwell(mode: string) {
  const totals = useRef(new Map<string, number>());
  const current = useRef<{ id: string; since: number } | null>(null);

  useEffect(() => {
    const stop = () => {
      const c = current.current;
      if (!c) return;
      totals.current.set(c.id, (totals.current.get(c.id) ?? 0) + performance.now() - c.since);
      current.current = null;
    };
    const start = (id: string) => {
      stop();
      if (document.visibilityState === 'visible') current.current = { id, since: performance.now() };
    };
    let onLine: string | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onLine = entry.target.id;
            start(entry.target.id);
          } else if (onLine === entry.target.id) {
            onLine = null;
            stop();
          }
        });
      },
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 },
    );
    record.sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    const onVisibility = () => (document.visibilityState === 'visible' && onLine ? start(onLine) : stop());
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [mode]); // the sections remount when the layout mode changes

  return (): Result => {
    const now = performance.now();
    const time = (id: string) =>
      (totals.current.get(id) ?? 0) + (current.current?.id === id ? now - current.current.since : 0);
    const timed = record.sections.map((s) => ({ ...s, ms: time(s.id) }));
    const byTime = [...timed].sort((a, b) => b.ms - a.ms);
    const longest = byTime[0];
    const fastest = byTime.length > 1 ? byTime[byTime.length - 1] : null;
    return {
      longest: { label: longest.label, seconds: Math.round(longest.ms / 1000) },
      fastest: fastest ? fastest.label : null,
    };
  };
}

export function RecordBlock({ mode, reduced }: { mode: string; reduced: boolean }) {
  const read = useSectionDwell(mode);
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const [result, setResult] = useState<Result | null>(null);
  const [shown, setShown] = useState(0);

  // Read the record each time the block comes into view.
  useEffect(() => {
    if (!inView) return;
    const next = read();
    setResult(next);
    if (reduced) {
      setShown(next.longest.seconds);
      return;
    }
    const controls = animate(0, next.longest.seconds, {
      duration: 1.2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  return (
    <section ref={ref} className={`catalog-section catalog-record${result ? ' is-read' : ''}`} aria-labelledby="catalog-record">
      <div className="catalog-record__body">
        <p className="catalog-label">{record.label}</p>
        <h2 id="catalog-record" className="catalog-record__title">{record.title}</h2>
        <p className="catalog-record__value" aria-live="polite">
          {result ? (
            <>
              {result.longest.label} · <span className="catalog-record__num">{shown}</span>
              {record.unit}
            </>
          ) : (
            ' '
          )}
        </p>
        {/* Always present, so reading the record never shifts the page below. */}
        <p className="catalog-record__fastest">
          {result?.fastest ? `${record.fastest} ${result.fastest}` : '\u00a0'}
        </p>
        <p className="catalog-record__closing">{record.closing}</p>
        <div className="catalog-record__cta">
          <CtaLink />
        </div>
      </div>
    </section>
  );
}

/* ── Side progress — desktop only, the same sections as the top tabs ──── */

const TAB_IDS = nav.tabs.map((tab) => tab.id);

export function SideProgress({ mode }: { mode: string }) {
  const active = useActiveSection(TAB_IDS, mode);
  // Mouse shortcut only: the top bar's tabs are the keyboard/AT route.
  return (
    <div className="catalog-side" aria-hidden="true">
      <span className="catalog-side__line" />
      <ol>
        {nav.tabs.map((tab, i) => (
          <li key={tab.id}>
            <a
              href={`#${tab.id}`}
              tabIndex={-1}
              className={active === tab.id ? 'is-active' : undefined}
              title={tab.label}
              onClick={(event) => {
                event.preventDefault();
                scrollToId(tab.id);
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
