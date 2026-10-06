import { useEffect, useState, type MouseEvent } from 'react';
import { nav } from './content.js';
import { isVenueMode } from '../lib/venueMode';
import logoUrl from '../../Logo.svg';

/**
 * Fixed top bar for /catalog/. Transparent over the cover, a translucent
 * --bg-base once the page scrolls. Tabs scroll to their section and mark the
 * one in view; on the venue PC the links that leave the catalogue are hidden.
 */

const BASE = import.meta.env.BASE_URL;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function scrollToId(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  history.pushState(null, '', `#${id}`);
}

function scrollToTop(event: MouseEvent) {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  history.pushState(null, '', window.location.pathname + window.location.search);
}

/** The tab whose section is under the bar. IntersectionObserver over a band
 *  just below the bar; the first section in document order inside it wins. */
export function useActiveSection(ids: string[], key?: string) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        });
        setActive(ids.find((id) => visible.has(id)) ?? null);
      },
      // A band from just under the bar down to 45% of the viewport.
      { rootMargin: '-120px 0px -55% 0px', threshold: 0 },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
    // `key` changes when the sections remount (layout mode switch).
  }, [ids, key]);
  return active;
}

const TAB_IDS = nav.tabs.map((tab) => tab.id);

/** True while the cover's "온라인 전시 체험하기" is on screen, so the bar does
 *  not show the same link twice. */
function useCoverCtaVisible(key: string) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const cta = document.querySelector('[data-cover-cta]');
    if (!cta) {
      setVisible(false);
      return;
    }
    // Under the bar (96px tall on mobile) counts as out of view.
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: '-96px 0px 0px 0px',
      threshold: 0,
    });
    observer.observe(cta);
    return () => observer.disconnect();
  }, [key]);
  return visible;
}

export function CatalogNav({ mode }: { mode: string }) {
  const [venue] = useState(isVenueMode);
  const [scrolled, setScrolled] = useState(false);
  const active = useActiveSection(TAB_IDS, mode);
  const coverCtaVisible = useCoverCtaVisible(mode);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Keep the active tab visible in the mobile tab strip.
  useEffect(() => {
    const strip = document.querySelector<HTMLElement>('.catalog-nav__tabs');
    const tab = document.querySelector<HTMLElement>(`.catalog-nav__tab[data-id="${active}"]`);
    if (!strip || !tab || strip.scrollWidth <= strip.clientWidth) return;
    // Horizontal only — scrollIntoView could also nudge the page.
    strip.scrollLeft = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2;
  }, [active]);

  return (
    <nav className={`catalog-nav${scrolled ? ' catalog-nav--solid' : ''}`} aria-label={nav.label}>
      <div className="catalog-nav__inner">
        <div className="catalog-nav__brand">
          {!venue ? (
            <a className="catalog-nav__logo" href={BASE}>
              <img src={logoUrl} alt={nav.logoAlt} width={96} height={19} />
            </a>
          ) : null}
          <a className="catalog-nav__home" href="#" onClick={scrollToTop}>
            {nav.home}
          </a>
        </div>

        <ul className="catalog-nav__tabs">
          {nav.tabs.map((tab) => (
            <li key={tab.id}>
              <a
                className={`catalog-nav__tab${active === tab.id ? ' is-active' : ''}`}
                data-id={tab.id}
                href={`#${tab.id}`}
                aria-current={active === tab.id ? 'location' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  scrollToId(tab.id);
                }}
              >
                {tab.label}
              </a>
            </li>
          ))}
        </ul>

        {!venue ? (
          <a className={`catalog-nav__cta${coverCtaVisible ? ' is-hidden' : ''}`} href={BASE}>
            {nav.cta} <span aria-hidden="true">→</span>
          </a>
        ) : null}
      </div>
    </nav>
  );
}

/** Small fixed "맨 위로", shown once the reader is in the archive part. */
export function BackToTop() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const archive = document.getElementById('archive');
    if (!archive) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShown(entry.isIntersecting || entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(archive);
    return () => observer.disconnect();
  }, []);

  return (
    <a
      className={`catalog-top${shown ? ' is-shown' : ''}`}
      href="#"
      onClick={scrollToTop}
      tabIndex={shown ? undefined : -1}
      aria-hidden={shown ? undefined : true}
    >
      {nav.toTop} <span aria-hidden="true">↑</span>
    </a>
  );
}
