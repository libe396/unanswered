import { useState } from 'react';
import { CTA_LABEL, process } from './content.js';
import { BASE, CatalogImage, type OpenImage } from './CatalogImage';

export function CtaLink(props: { 'data-cover-cta'?: boolean }) {
  return (
    <a className="catalog-cta" href={BASE} {...props}>
      {CTA_LABEL} <span aria-hidden="true">→</span>
    </a>
  );
}

export function Notes({ title, notes }: { title: string; notes: string[] }) {
  return (
    <figcaption className="catalog-notes">
      <p className="catalog-notes__title">{title}</p>
      <ul>
        {notes.map((note) => <li key={note}>{note}</li>)}
      </ul>
    </figcaption>
  );
}

/**
 * 05 · 04 최종 그래픽 — the source photo, one large result and three word
 * chips. A chip crossfades the result and swaps its notes. Defaults to the
 * last result (슬픔+불안). Screen only; print shows the four-image row.
 */
export function FinalViewer({ onOpen, eager = false }: { onOpen: OpenImage; eager?: boolean }) {
  const loading = eager ? 'eager' : 'lazy';
  const final = process.steps[3];
  const results = final.results!;
  const [active, setActive] = useState(results.length - 1);
  const current = results[active];

  return (
    <div className="final-viewer">
      <figure className="final-viewer__source">
        <CatalogImage image={final.source!.image} onOpen={onOpen} loading={loading} />
        <Notes title={final.source!.title} notes={final.source!.notes} />
      </figure>
      <span className="final-viewer__arrow" aria-hidden="true" />
      <div className="final-viewer__result">
        <div className="final-viewer__stack">
          {results.map((result, i) => (
            <div
              key={result.title}
              className={`final-viewer__layer${i === active ? ' is-active' : ''}`}
              aria-hidden={i === active ? undefined : true}
            >
              <CatalogImage image={result.image} onOpen={i === active ? onOpen : undefined} loading={loading} />
            </div>
          ))}
        </div>
        <div className="final-viewer__chips" role="group" aria-label={final.title}>
          {results.map((result, i) => (
            <button
              key={result.title}
              type="button"
              className={`final-viewer__chip${i === active ? ' is-active' : ''}`}
              aria-pressed={i === active}
              onClick={() => setActive(i)}
            >
              {result.title}
            </button>
          ))}
        </div>
        <ul key={current.title} className="final-viewer__notes" aria-live="polite">
          {current.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      </div>
    </div>
  );
}
