import { useState, type ReactNode } from 'react';
import { cover, intro, process, reportFlow, route, scenes } from './content.js';
import { archiveLinkLabel } from './archive.js';
import { CatalogImage, type OpenImage } from './CatalogImage';
import { CtaLink, FinalViewer, Notes } from './shared';

/**
 * The plain vertical layout of the six body sections — used at ≤720px, under
 * prefers-reduced-motion, and for print (see useCatalogMode). This is the
 * pre-scroll-direction layout, kept as-is so print matches it.
 */

export function StaticCover() {
  // The cover caption and its gradient only exist once light-main.jpg loads.
  const [coverLoaded, setCoverLoaded] = useState(false);
  return (
    <header id="cover" className={`catalog-cover${coverLoaded ? ' catalog-cover--has-image' : ''}`}>
      <div className="catalog-cover__media">
        <CatalogImage image={cover.image} className="catalog-cover__image" hideIfMissing onLoad={() => setCoverLoaded(true)} />
      </div>
      {coverLoaded ? (
        <p className="catalog-cover__caption">
          <span>{cover.caption[0]}</span>
          <span>{cover.caption[1]}</span>
        </p>
      ) : null}
      <div className="catalog-cover__text" data-reveal>
        <h1 className="catalog-cover__title">{cover.title}</h1>
        <CoverDetails />
      </div>
    </header>
  );
}

/** Subtitle, meta line and the two links — shared by both cover layouts. */
export function CoverDetails() {
  return (
    <>
      <p className="catalog-cover__subtitle">{cover.subtitle}</p>
      <p className="catalog-cover__meta">
        {cover.meta.map((item, i) => (
          <span key={item}>
            {i > 0 ? <span className="catalog-cover__dot" aria-hidden="true">·</span> : null}
            {item}
          </span>
        ))}
      </p>
      <div className="catalog-cover__actions">
        <CtaLink data-cover-cta />
        <a className="catalog-textlink" href="#archive">{archiveLinkLabel}</a>
      </div>
    </>
  );
}

export function StaticIntro() {
  return (
    <section id="intro" className="catalog-section" aria-label={cover.title}>
      <div className="catalog-prose" data-reveal>
        {intro.map((paragraph) => (
          <p key={paragraph.slice(0, 12)}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

export function StaticRoute({ onOpen }: { onOpen: OpenImage }) {
  return (
    <section id="route" className="catalog-section" aria-labelledby="catalog-route">
      <div className="catalog-prose" data-reveal>
        <h2 id="catalog-route" className="catalog-label">{route.label}</h2>
        <p>{route.description}</p>
      </div>
      <div className="catalog-wide catalog-plans" data-reveal>
        {route.plans.map((plan) => (
          <figure key={plan.floor} className="catalog-plan">
            <figcaption>
              <span className="catalog-plan__floor">{plan.floor}</span>
              <span>{plan.title}</span>
            </figcaption>
            <CatalogImage image={plan.image} onOpen={onOpen} />
          </figure>
        ))}
      </div>
      <ol className="catalog-wide catalog-zones" data-reveal>
        {route.zones.map((zone) => (
          <li key={zone.no} className="catalog-zone">
            <span className="catalog-badge">{zone.no}</span>
            <div>
              <p className="catalog-zone__name">
                {zone.name} <span className="catalog-zone__en">{zone.en}</span>
              </p>
              <p className="catalog-zone__line">{zone.line}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="catalog-prose catalog-ambience" data-reveal>
        <h3 className="catalog-label">{route.ambience.label}</h3>
        <p>{route.ambience.body}</p>
      </div>
    </section>
  );
}

export function StaticReportFlow() {
  return (
    <section id="report-flow" className="catalog-section" aria-labelledby="catalog-flow">
      <div className="catalog-prose" data-reveal>
        <h2 id="catalog-flow" className="catalog-label">{reportFlow.label}</h2>
      </div>
      <ol className="catalog-wide catalog-flow" data-reveal>
        {reportFlow.steps.map((step, i) => (
          <li key={step.no} className="catalog-flow__step">
            <span className="catalog-flow__no">{step.no}</span>
            <p className="catalog-flow__title">{step.title}</p>
            <p className="catalog-flow__body">{step.body}</p>
            {i < reportFlow.steps.length - 1 ? <span className="catalog-flow__arrow" aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
      <div className="catalog-prose catalog-flow__note" data-reveal>
        <blockquote>{reportFlow.quote}</blockquote>
        <p>{reportFlow.body}</p>
      </div>
    </section>
  );
}

type Step = (typeof process.steps)[number];

function ProcessStep({ step, children }: { step: Step; children: ReactNode }) {
  return (
    <article className="catalog-step" data-reveal>
      <div className="catalog-step__text">
        <span className="catalog-step__no">{step.no}</span>
        <h3 className="catalog-step__title">{step.title}</h3>
        <p className="catalog-step__body">{step.body}</p>
      </div>
      <div className="catalog-step__media">{children}</div>
    </article>
  );
}

export function StaticProcess({ onOpen }: { onOpen: OpenImage }) {
  const [draft, rules, gen1, final] = process.steps;
  return (
    <section id="process" className="catalog-section" aria-labelledby="catalog-process">
      <div className="catalog-prose" data-reveal>
        <p className="catalog-label">{process.label}</p>
        <h2 id="catalog-process" className="catalog-heading">{process.title}</h2>
        <p className="catalog-sub">{process.subtitle}</p>
      </div>

      <div className="catalog-wide catalog-steps">
        <ProcessStep step={draft}>
          <div className="catalog-thumbs">
            {draft.images!.map((image) => <CatalogImage key={image.src} image={image} onOpen={onOpen} />)}
          </div>
        </ProcessStep>

        <ProcessStep step={rules}>
          <ul className="catalog-rules">
            {rules.rules!.map((r) => (
              <li key={r.en} className="catalog-rule">
                <CatalogImage image={r.icon} className="catalog-rule__icon" />
                <div>
                  <p className="catalog-rule__name">{r.name}</p>
                  <p className="catalog-rule__en">{r.en}</p>
                  <p className="catalog-rule__line">{r.line}</p>
                </div>
              </li>
            ))}
          </ul>
        </ProcessStep>

        <ProcessStep step={gen1}>
          <div className="catalog-thumbs">
            {gen1.images!.map((image) => <CatalogImage key={image.src} image={image} onOpen={onOpen} />)}
          </div>
        </ProcessStep>

        <ProcessStep step={final}>
          {/* On screen: the word chips. In print: all four images, as before. */}
          <FinalViewer onOpen={onOpen} />
          <div className="catalog-final catalog-final--print">
            <figure className="catalog-final__item catalog-final__source">
              <CatalogImage image={final.source!.image} />
              <Notes title={final.source!.title} notes={final.source!.notes} />
            </figure>
            <span className="catalog-final__arrow" aria-hidden="true" />
            <div className="catalog-final__results">
              {final.results!.map((result) => (
                <figure key={result.title} className="catalog-final__item">
                  <CatalogImage image={result.image} />
                  <Notes title={result.title} notes={result.notes} />
                </figure>
              ))}
            </div>
          </div>
        </ProcessStep>
      </div>

      <p className="catalog-wide catalog-tools">{process.tools}</p>
    </section>
  );
}

export function StaticScenes({ onOpen }: { onOpen: OpenImage }) {
  return (
    <section id="scenes" className="catalog-section catalog-section--scenes" aria-label={scenes.map((s) => s.title).join(', ')}>
      <ul className="catalog-wide catalog-scenes">
        {scenes.map((scene) => (
          <li key={scene.title} className={`catalog-scene${scene.wide ? ' catalog-scene--wide' : ''}`} data-reveal>
            <CatalogImage image={scene.image} onOpen={onOpen} />
            <div className="catalog-scene__caption">
              <p className="catalog-scene__title">{scene.title}</p>
              <p className="catalog-scene__line">{scene.line}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
