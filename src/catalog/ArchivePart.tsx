import { Fragment, useEffect, useRef, useState } from 'react';
import { archiveIntro, cardLabels, chapters as rawChapters, timelineAppliedLabel } from './archive.js';

/**
 * PROCESS ARCHIVE — the part under the six print-catalogue sections. Each
 * chapter is a collapsed <details>; the contents list and `#archive-NN`
 * hashes open one and scroll to it. All copy and image paths: archive.js.
 */

const BASE = import.meta.env.BASE_URL;
const archiveUrl = (file: string) => `${BASE}catalog/archive/${file}`;

type OpenImage = (url: string, alt: string) => void;

interface ArchiveImageData {
  src: string;
  alt: string;
  ratio: string;
  caption?: string;
  fit?: 'cover' | 'contain';
}

type ListItem = string | { label?: string; text?: string; items?: ListItem[] };

interface Card {
  no: string;
  title: string;
  tools: string;
  asked: string;
  proposal: string;
  judgment: string;
  reasked?: string;
  applied: string;
}

interface PairRow {
  cells: string[];
  before: string;
  after: string[];
  afterNotes?: string[];
}

type Block =
  | { type: 'h'; text: string; period?: string }
  | { type: 'p' | 'lead' | 'quote' | 'note'; text: string }
  | { type: 'list'; title?: string; items: ListItem[] }
  | { type: 'table'; title?: string; head: string[]; rows: string[][] }
  | { type: 'flow'; items: string[] }
  | { type: 'cards'; cards: Card[] }
  | { type: 'timeline'; items: { date: string; tag?: string; notes: string[]; applied: string }[] }
  | { type: 'examples'; items: string[][] }
  | { type: 'images'; images: ArchiveImageData[] }
  | { type: 'pairs'; head: string[]; captions: { before: string; after: string }; rows: PairRow[] };

interface Chapter {
  no: string;
  title: string;
  period: string;
  summary: string;
  blocks: Block[];
}

const chapters = rawChapters as unknown as Chapter[];

const chapterId = (no: string) => `archive-${no}`;

/* ── Images: optional — a slot whose file is missing disappears ────────── */

/** A row of optional images. Each one that fails to load is dropped; when
 *  none load, the whole row (and its captions) renders nothing. */
function ImageRow({ images, onOpen, className = '' }: { images: ArchiveImageData[]; onOpen: OpenImage; className?: string }) {
  const [failed, setFailed] = useState<ReadonlySet<number>>(new Set());
  if (failed.size === images.length) return null;
  return (
    <div className={`archive-images ${className}`} style={{ ['--archive-cols' as string]: Math.min(images.length, 4) }}>
      {images.map((image, i) =>
        failed.has(i) ? null : (
          <figure key={image.src} className="archive-figure">
            <button
              type="button"
              className={`catalog-image catalog-image--zoom archive-image${image.fit === 'contain' ? ' archive-image--contain' : ''}`}
              style={{ aspectRatio: image.ratio }}
              onClick={() => onOpen(archiveUrl(image.src), image.alt)}
            >
              <img
                src={archiveUrl(image.src)}
                alt={image.alt}
                loading="lazy"
                decoding="async"
                onError={() => setFailed((prev) => new Set(prev).add(i))}
              />
            </button>
            {image.caption ? <figcaption className="archive-caption">{image.caption}</figcaption> : null}
          </figure>
        ),
      )}
    </div>
  );
}

/* ── Blocks ───────────────────────────────────────────────────────────── */

function List({ items, nested = false }: { items: ListItem[]; nested?: boolean }) {
  return (
    <ul className={`archive-list${nested ? ' archive-list--nested' : ''}`}>
      {items.map((item, i) => {
        if (typeof item === 'string') return <li key={i}>{item}</li>;
        return (
          <li key={i} className={item.label ? 'archive-list__field' : undefined}>
            {item.label ? <span className="archive-field-label">{item.label}</span> : null}
            {item.text ? <span className="archive-list__text">{item.text}</span> : null}
            {item.items ? <List items={item.items} nested /> : null}
          </li>
        );
      })}
    </ul>
  );
}

function Table({ title, head, rows }: { title?: string; head: string[]; rows: string[][] }) {
  const stack = head.length === 2;
  return (
    <figure className="archive-table-block">
      {title ? <figcaption className="archive-block-title">{title}</figcaption> : null}
      {/* Wide tables scroll inside this box, never the page; two-column tables stack instead. */}
      <div className={`archive-table-wrap${stack ? ' archive-table-wrap--stack' : ''}`} tabIndex={stack ? undefined : 0} role={stack ? undefined : 'region'} aria-label={stack ? undefined : title ?? head.join(' · ')}>
        <table className={`archive-table${stack ? ' archive-table--stack' : ''}`}>
          <thead>
            <tr>
              {head.map((h) => (
                <th key={h} scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} data-label={head[c]}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function Flow({ items }: { items: string[] }) {
  return (
    <ol className={`archive-flow${items.length > 5 ? ' archive-flow--long' : ''}`} style={{ ['--archive-steps' as string]: items.length }}>
      {items.map((item, i) => (
        <li key={item} className="archive-flow__step">
          <span className="archive-flow__text">{item}</span>
          {i < items.length - 1 ? <span className="archive-flow__arrow" aria-hidden="true" /> : null}
        </li>
      ))}
    </ol>
  );
}

function Cards({ cards }: { cards: Card[] }) {
  return (
    <ol className="archive-cards">
      {cards.map((card) => (
        <li key={card.no} className="archive-card">
          <header className="archive-card__head">
            <span className="catalog-badge">{card.no}</span>
            <div>
              <p className="archive-card__title">{card.title}</p>
              <p className="archive-card__tools">{card.tools}</p>
            </div>
          </header>
          <div className="archive-card__asked">
            <span className="archive-card-label">{cardLabels.asked}</span>
            <p>{card.asked}</p>
          </div>
          <div className="archive-card__steps">
            <div className="archive-card__step">
              <span className="archive-card-label">{cardLabels.proposal}</span>
              <p>{card.proposal}</p>
            </div>
            <div className="archive-card__step">
              <span className="archive-card-label">{cardLabels.judgment}</span>
              <p>{card.judgment}</p>
              {card.reasked ? (
                <>
                  <span className="archive-card-label archive-card-label--follow">{cardLabels.reasked}</span>
                  <p>{card.reasked}</p>
                </>
              ) : null}
            </div>
            <div className="archive-card__step">
              <span className="archive-card-label">{cardLabels.applied}</span>
              <p>{card.applied}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Timeline({ items }: { items: { date: string; tag?: string; notes: string[]; applied: string }[] }) {
  return (
    <ol className="archive-timeline">
      {items.map((item) => (
        <li key={item.date} className="archive-timeline__item">
          <p className="archive-timeline__date">
            {item.date}
            {item.tag ? <span className="archive-timeline__tag"> · {item.tag}</span> : null}
          </p>
          {item.notes.map((note) => (
            <p key={note} className="archive-timeline__note">{note}</p>
          ))}
          <p className="archive-timeline__applied">
            <span className="archive-field-label">{timelineAppliedLabel}</span>
            <span>{item.applied}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}

function Pairs({ head, captions, rows, onOpen }: { head: string[]; captions: { before: string; after: string }; rows: PairRow[]; onOpen: OpenImage }) {
  return (
    <ol className="archive-pairs">
      {rows.map((row) => {
        const name = row.cells[0];
        const images: ArchiveImageData[] = [
          { src: row.before, alt: `${name} ${captions.before}`, ratio: '4 / 3', caption: captions.before },
          ...row.after.map((src, i) => {
            const note = row.afterNotes?.[i];
            const caption = note ? `${captions.after} · ${note}` : captions.after;
            return { src, alt: `${name} ${caption}`, ratio: '4 / 3', caption };
          }),
        ];
        return (
          <li key={name} className="archive-pair">
            <dl className="archive-pair__text">
              {row.cells.map((cell, c) => (
                <div key={c} className={c === 0 ? 'archive-pair__name' : undefined}>
                  <dt className="archive-field-label">{head[c]}</dt>
                  <dd>{cell}</dd>
                </div>
              ))}
            </dl>
            <ImageRow images={images} onOpen={onOpen} className="archive-images--pair" />
          </li>
        );
      })}
    </ol>
  );
}

function renderBlock(block: Block, key: number, onOpen: OpenImage) {
  switch (block.type) {
    case 'h':
      return (
        <h4 key={key} className="archive-h">
          {block.text}
          {block.period ? <span className="archive-h__period">{block.period}</span> : null}
        </h4>
      );
    case 'p':
      return <p key={key} className="archive-p">{block.text}</p>;
    case 'lead':
      return <p key={key} className="archive-p archive-p--lead">{block.text}</p>;
    case 'quote':
      return <blockquote key={key} className="archive-quote">{block.text}</blockquote>;
    case 'note':
      return <p key={key} className="archive-note">{block.text}</p>;
    case 'list':
      return (
        <div key={key} className="archive-list-block">
          {block.title ? <p className="archive-block-title">{block.title}</p> : null}
          <List items={block.items} />
        </div>
      );
    case 'table':
      return <Table key={key} title={block.title} head={block.head} rows={block.rows} />;
    case 'flow':
      return <Flow key={key} items={block.items} />;
    case 'cards':
      return <Cards key={key} cards={block.cards} />;
    case 'timeline':
      return <Timeline key={key} items={block.items} />;
    case 'examples':
      return (
        <div key={key} className="archive-examples">
          {block.items.map((lines, i) => (
            <blockquote key={i} className="archive-quote archive-quote--example">
              {lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </blockquote>
          ))}
        </div>
      );
    case 'images':
      return <ImageRow key={key} images={block.images} onOpen={onOpen} />;
    case 'pairs':
      return <Pairs key={key} head={block.head} captions={block.captions} rows={block.rows} onOpen={onOpen} />;
  }
}

/* ── Part ─────────────────────────────────────────────────────────────── */

/** Opens the chapter a `#archive-NN` hash names and brings it into view. */
function openFromHash(scroll: boolean) {
  const match = /^#(archive-\d{2})$/.exec(window.location.hash);
  if (!match) return;
  const details = document.getElementById(match[1]);
  if (!(details instanceof HTMLDetailsElement)) return;
  details.open = true;
  if (scroll) details.scrollIntoView({ block: 'start' });
}

export function Archive({ onOpen }: { onOpen: OpenImage }) {
  const partRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // The browser's own jump to the hash runs before this part exists.
    openFromHash(true);
    const onHash = () => openFromHash(true);
    window.addEventListener('hashchange', onHash);

    // Print every chapter open, then put the reader's state back.
    let closed: HTMLDetailsElement[] = [];
    const beforePrint = () => {
      closed = Array.from(partRef.current?.querySelectorAll<HTMLDetailsElement>('details:not([open])') ?? []);
      closed.forEach((d) => (d.open = true));
    };
    const afterPrint = () => {
      closed.forEach((d) => (d.open = false));
      closed = [];
    };
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, []);

  return (
    <section id="archive" ref={partRef} className="catalog-section archive" aria-labelledby="archive-title">
      <div className="catalog-prose" data-reveal>
        <p className="catalog-label">{archiveIntro.label}</p>
        <h2 id="archive-title" className="catalog-heading">{archiveIntro.title}</h2>
        <p className="catalog-sub">{archiveIntro.description}</p>
      </div>

      <nav className="catalog-wide archive-toc" aria-labelledby="archive-title">
        <ol>
          {chapters.map((chapter) => (
            <li key={chapter.no}>
              <a
                href={`#${chapterId(chapter.no)}`}
                onClick={() => {
                  // Open before the jump so the browser lands on the expanded chapter.
                  const details = document.getElementById(chapterId(chapter.no));
                  if (details instanceof HTMLDetailsElement) details.open = true;
                }}
              >
                <span className="archive-toc__no">{chapter.no}</span>
                <span>{chapter.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="catalog-wide archive-chapters">
        {chapters.map((chapter) => (
          <details key={chapter.no} id={chapterId(chapter.no)} className="archive-chapter">
            <summary className="archive-chapter__summary">
              <span className="archive-chapter__no">{chapter.no}</span>
              <span className="archive-chapter__head">
                <span className="archive-chapter__title">{chapter.title}</span>
                <span className="archive-chapter__line">{chapter.summary}</span>
              </span>
              <span className="archive-chapter__period">{chapter.period}</span>
              <span className="archive-chapter__toggle" aria-hidden="true" />
            </summary>
            <div className="archive-chapter__body">
              {chapter.blocks.map((block, i) => (
                <Fragment key={i}>{renderBlock(block, i, onOpen)}</Fragment>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
