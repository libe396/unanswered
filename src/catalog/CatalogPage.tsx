import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Archive } from './ArchivePart';
import { BackToTop, CatalogNav } from './CatalogNav';
import type { OpenImage } from './CatalogImage';
import { useCatalogMode } from './useCatalogMode';
import {
  StaticCover,
  StaticIntro,
  StaticProcess,
  StaticReportFlow,
  StaticRoute,
  StaticScenes,
} from './StaticSections';
import { CineCover, CineIntro, CineProcess, CineReportFlow, CineRoute, CineScenes } from './CineSections';
import { RecordBlock, SideProgress } from './Extras';
import './catalog.css';
import './cinematic.css';

/**
 * 웹도록 — a standalone, single-scroll document for a reviewer who opens
 * /catalog/ without going through the exhibition. Its own HTML entry
 * (catalog/index.html), so none of the exhibition's Scenes, store, sounds or
 * cursor effects load here. All copy and image paths come from content.js.
 *
 * Two layouts for the six body sections (see useCatalogMode): 'cine' on
 * desktop with motion allowed — pinned, scroll-driven — and 'static' at
 * ≤720px, under reduced motion, and in print.
 */

/** Slow fade on first entry into view. Reduced motion and print skip it in CSS. */
function useReveal(key: string) {
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('.catalog [data-reveal]');
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((n) => n.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
    // Re-run when the layout mode swaps the section markup.
  }, [key]);
}

function Lightbox({ image, onClose }: { image: { url: string; alt: string } | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (image && !dialog.open) dialog.showModal();
    if (!image && dialog.open) dialog.close();
  }, [image]);

  return (
    <dialog
      ref={ref}
      className="catalog-lightbox"
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {image ? (
        <>
          <img src={image.url} alt={image.alt} />
          <button type="button" className="catalog-lightbox__close" aria-label="닫기" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </button>
        </>
      ) : null}
    </dialog>
  );
}

export function CatalogPage() {
  const [zoomed, setZoomed] = useState<{ url: string; alt: string } | null>(null);
  const open: OpenImage = (url, alt) => setZoomed({ url, alt });
  const mode = useCatalogMode();
  const reduced = useReducedMotion() ?? false;
  const cine = mode === 'cine';
  useReveal(mode);

  return (
    <main className={`catalog catalog--${mode}`}>
      <CatalogNav mode={mode} />
      {cine ? <SideProgress mode={mode} /> : null}

      {cine ? <CineCover /> : <StaticCover />}
      {cine ? <CineIntro /> : <StaticIntro />}
      {cine ? <CineRoute onOpen={open} /> : <StaticRoute onOpen={open} />}
      {cine ? <CineReportFlow /> : <StaticReportFlow />}
      {cine ? <CineProcess onOpen={open} /> : <StaticProcess onOpen={open} />}
      {cine ? <CineScenes onOpen={open} /> : <StaticScenes onOpen={open} />}

      {/* 07 · RECORD — this visit's own dwell times */}
      <RecordBlock mode={mode} reduced={reduced} />

      {/* PROCESS ARCHIVE — research and process left out of the print catalogue */}
      <Archive onOpen={open} />
      <BackToTop />

      <Lightbox image={zoomed} onClose={() => setZoomed(null)} />
    </main>
  );
}
