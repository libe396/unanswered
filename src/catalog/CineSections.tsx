import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  interpolate,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { cover, intro, process, reportFlow, route, scenes } from './content.js';
import { CatalogImage, imageUrl, type CatalogImageData, type OpenImage } from './CatalogImage';
import { CoverDetails } from './StaticSections';
import { FinalViewer } from './shared';

/**
 * The scroll-driven layout of the six body sections (desktop, motion allowed).
 * Native scroll only: pinned stages are `position: sticky`, and every effect
 * is a transform / opacity / filter read off a Framer `useScroll` progress.
 * Nothing intercepts the wheel or sets scroll position.
 */

const NAV = 56;

/**
 * useTransform's array form lets Framer hand opacity/filter to a native
 * ScrollTimeline, which drops back to the unanimated value outside the
 * timeline's range (the cover card vanished at the end of its pin). The
 * function form keeps every value computed here and clamped at both ends.
 */
function useRamp<T extends number | string>(
  progress: MotionValue<number>,
  input: number[],
  output: T[],
  options?: { ease?: (t: number) => number },
) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const map = useMemo(() => interpolate(input, output, { clamp: true, ...options }), [JSON.stringify(input), JSON.stringify(output)]);
  return useTransform(progress, (v) => map(v));
} // --catalog-nav-h above 720px — the only width this layout runs at

/** Opacity (and optionally a small rise) tied to a slice of a scroll progress. */
function ScrollFade({
  progress,
  range,
  from = 0,
  rise = 0,
  className,
  children,
}: {
  progress: MotionValue<number>;
  range: [number, number];
  from?: number;
  rise?: number;
  className?: string;
  children: ReactNode;
}) {
  const opacity = useRamp(progress, range, [from, 1]);
  const y = useRamp(progress, range, [rise, 0]);
  return (
    <motion.div className={className} style={{ opacity, y }}>
      {children}
    </motion.div>
  );
}

/* ── 01 · Cover: from blur to a record card ───────────────────────────── */

/*
  Timeline over the pinned stretch (progress 0 → 1):
    0    – 0.35  title shrinks back to the left
    0.15 – 0.5   the full-bleed blurred photo fades away
    0.18 – 0.55  the card fades in on the right, shrinks and comes into focus
    0.58 – 0.68  caption under the card
    0.68 – 1     hold: sharp card + caption, before the next section
*/
export function CineCover() {
  const track = useRef<HTMLElement>(null);
  const [loaded, setLoaded] = useState(false);

  const { scrollYProgress: p } = useScroll({ target: track, offset: ['start start', 'end end'] });
  // Full-bleed layer: what a fresh load shows before any scroll.
  const bgOpacity = useRamp(p, [0.15, 0.5], [1, 0]);
  // The card.
  const cardOpacity = useRamp(p, [0.18, 0.4], [0, 1]);
  const cardScale = useRamp(p, [0.18, 0.55], [1.3, 1], { ease: easeOut });
  const cardBlurPx = useRamp(p, [0.18, 0.55], [24, 0]);
  const cardFilter = useMotionTemplate`blur(${cardBlurPx}px)`;
  const captionOpacity = useRamp(p, [0.58, 0.68], [0, 1]);
  const titleScale = useRamp(p, [0, 0.35], [1, 0.5], { ease: easeOut });
  const titleY = useTransform(p, (v) => -0.14 * window.innerHeight * (1 - easeOut(clamp01(v / 0.35))));

  return (
    <header id="cover" ref={track} className={`cine-cover${loaded ? ' cine-cover--has-image' : ''}`}>
      <div className="cine-cover__stage">
        <motion.div className="cine-cover__bg" style={{ opacity: bgOpacity }} aria-hidden="true">
          <CatalogImage
            image={cover.image}
            hideIfMissing
            loading="eager"
            priority
            onLoad={() => setLoaded(true)}
            style={{ aspectRatio: 'auto' }}
          />
        </motion.div>
        <div className="cine-cover__shade" aria-hidden="true" />
        <div className="cine-cover__grain" aria-hidden="true" />

        <div className="cine-cover__slot">
          <motion.div className="cine-cover__card" style={{ opacity: cardOpacity, scale: cardScale, filter: cardFilter }}>
            <CatalogImage image={cover.image} hideIfMissing loading="eager" style={{ aspectRatio: 'auto' }} />
          </motion.div>
          {loaded ? (
            <motion.p className="cine-cover__caption" style={{ opacity: captionOpacity }}>
              <span>{cover.caption[0]}</span>
              <span>{cover.caption[1]}</span>
            </motion.p>
          ) : null}
        </div>

        <div className="cine-cover__text">
          <div className="cine-cover__details">
            <motion.h1
              className="catalog-cover__title cine-cover__title"
              style={{ scale: titleScale, y: titleY, originX: 0, originY: 1 }}
            >
              {cover.title}
            </motion.h1>
            <CoverDetails />
          </div>
        </div>
      </div>
    </header>
  );
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/* ── 02 · Intro: words light up as they are read ─────────────────────── */

function Word({ progress, range, text }: { progress: MotionValue<number>; range: [number, number]; text: string }) {
  const opacity = useRamp(progress, range, [0.16, 1]);
  return <motion.span style={{ opacity }}>{text}</motion.span>;
}

export function CineIntro() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.55'] });
  const paragraphs = useMemo(() => intro.map((p) => p.split(' ')), []);
  const total = paragraphs.reduce((n, words) => n + words.length, 0);
  let index = 0;

  return (
    <section id="intro" className="catalog-section" aria-label={cover.title}>
      <div ref={ref} className="catalog-prose cine-intro">
        {paragraphs.map((words, p) => (
          <p key={p}>
            {words.map((word, w) => {
              const i = index++;
              // Each word brightens over a short overlapping window, in order.
              const start = i / total;
              const end = Math.min(1, start + 4 / total);
              return (
                <span key={w}>
                  <Word progress={scrollYProgress} range={[start, end]} text={word} />
                  {w < words.length - 1 ? ' ' : null}
                </span>
              );
            })}
          </p>
        ))}
      </div>
    </section>
  );
}

/* ── 03 · Route: sticky plans, the zone at the centre lights up ──────── */

export function CineRoute({ onOpen }: { onOpen: OpenImage }) {
  const listRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start center', 'end center'] });

  useEffect(() => {
    const items = listRef.current?.querySelectorAll<HTMLElement>('[data-zone]');
    if (!items) return;
    // A line across the middle of the viewport: whichever zone is on it is current.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.zone));
        });
      },
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 },
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  const activeFloor = route.zones[active].floor;
  const ambienceAt = 3; // shown beside zone 04

  return (
    <section id="route" className="catalog-section" aria-labelledby="catalog-route">
      <div className="catalog-prose" data-reveal>
        <h2 id="catalog-route" className="catalog-label">{route.label}</h2>
        <p>{route.description}</p>
      </div>

      <div className="catalog-wide cine-route">
        <div className="cine-route__aside">
          {route.plans.map((plan) => (
            <figure key={plan.floor} className={`catalog-plan cine-route__plan${plan.floor === activeFloor ? ' is-lit' : ''}`}>
              <figcaption>
                <span className="catalog-plan__floor">{plan.floor}</span>
                <span>{plan.title}</span>
              </figcaption>
              <CatalogImage image={plan.image} onOpen={onOpen} />
            </figure>
          ))}
          <div className="cine-route__progress" aria-hidden="true">
            <span className="cine-route__track" />
            <motion.span className="cine-route__fill" style={{ scaleX: scrollYProgress }} />
            <ol>
              {route.zones.map((zone, i) => (
                <li key={zone.no} className={i <= active ? 'is-on' : undefined}>
                  <span className="cine-route__dot" />
                  <span className="cine-route__no">{zone.no}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <ol ref={listRef} className="cine-route__zones">
          {route.zones.map((zone, i) => (
            <li
              key={zone.no}
              data-zone={i}
              className={`cine-zone${i === active ? ' is-active' : ''}${i < active ? ' is-past' : ''}`}
            >
              <span className="catalog-badge cine-zone__badge">{zone.no}</span>
              <div className="cine-zone__text">
                <p className="catalog-zone__name">
                  {zone.name} <span className="catalog-zone__en">{zone.en}</span>
                </p>
                <p className="catalog-zone__line">{zone.line}</p>
              </div>
              {i === ambienceAt ? (
                <aside className={`cine-zone__ambience${active >= ambienceAt ? ' is-shown' : ''}`}>
                  <h3 className="catalog-label">{route.ambience.label}</h3>
                  <p>{route.ambience.body}</p>
                </aside>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── 04 · Report flow: three steps, one at a time ─────────────────────── */

function Arrow({ progress, range }: { progress: MotionValue<number>; range: [number, number] }) {
  const scaleX = useRamp(progress, range, [0, 1]);
  const head = useRamp(progress, [range[1] - 0.02, range[1]], [0, 1]);
  return (
    <span className="cine-flow__arrow" aria-hidden="true">
      <motion.span className="cine-flow__line" style={{ scaleX }} />
      <motion.span className="cine-flow__head" style={{ opacity: head }} />
    </span>
  );
}

export function CineReportFlow() {
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({ target: track, offset: [`start ${NAV}px`, 'end end'] });
  const [input, processing, output] = reportFlow.steps;
  const chips = input.body.split(', ');
  // The quote's two sentences, one per line.
  const lines = reportFlow.quote.split('. ').map((s, i, all) => (i < all.length - 1 ? `${s}.` : s));

  const stepHead = (step: typeof input) => (
    <>
      <span className="catalog-flow__no">{step.no}</span>
      <p className="catalog-flow__title">{step.title}</p>
    </>
  );

  return (
    <section id="report-flow" className="catalog-section" aria-labelledby="catalog-flow">
      <div ref={track} className="cine-flow">
        <div className="cine-flow__stage">
          <div className="catalog-wide">
            <h2 id="catalog-flow" className="catalog-label">{reportFlow.label}</h2>
            <div className="cine-flow__steps">
              <ScrollFade progress={p} range={[0, 0.05]} from={0.35} className="cine-flow__step">
                {stepHead(input)}
                <ul className="cine-flow__chips">
                  {chips.map((chip, i) => (
                    <li key={chip}>
                      <ScrollFade progress={p} range={[0.06 + i * 0.04, 0.1 + i * 0.04]} rise={10}>
                        <span className="cine-flow__chip">{chip}</span>
                      </ScrollFade>
                    </li>
                  ))}
                </ul>
              </ScrollFade>
              <Arrow progress={p} range={[0.26, 0.34]} />
              <ScrollFade progress={p} range={[0.34, 0.42]} from={0.35} className="cine-flow__step">
                {stepHead(processing)}
                <p className="catalog-flow__body">{processing.body}</p>
              </ScrollFade>
              <Arrow progress={p} range={[0.44, 0.52]} />
              <ScrollFade progress={p} range={[0.52, 0.6]} from={0.35} className="cine-flow__step">
                {stepHead(output)}
                <p className="catalog-flow__body">{output.body}</p>
              </ScrollFade>
            </div>
            <blockquote className="cine-flow__quote">
              {lines.map((line, i) => (
                <ScrollFade key={line} progress={p} range={i === 0 ? [0.64, 0.72] : [0.74, 0.82]} rise={24}>
                  {line}
                </ScrollFade>
              ))}
            </blockquote>
          </div>
        </div>
      </div>
      <div className="catalog-prose cine-flow__body" data-reveal>
        <p>{reportFlow.body}</p>
      </div>
    </section>
  );
}

/* ── 05 · Process: four panels, vertical scroll moves them sideways ──── */

// Each panel holds for a stretch so its own reveal can play.
const PANEL_STOPS = [0, 0.08, 0.26, 0.4, 0.58, 0.7, 0.88, 1];
const PANEL_X = ['0%', '0%', '-25%', '-25%', '-50%', '-50%', '-75%', '-75%'];

function UnusedMark({ progress, range, label }: { progress: MotionValue<number>; range: [number, number]; label: string }) {
  const scaleX = useRamp(progress, range, [0, 1]);
  const opacity = useRamp(progress, [range[1] - 0.01, range[1] + 0.01], [0, 1]);
  return (
    <span className="cine-unused" aria-hidden="true">
      <motion.span className="cine-unused__line" style={{ scaleX, rotate: -45, originX: 0 }} />
      <motion.span className="cine-unused__label" style={{ opacity }}>{label}</motion.span>
    </span>
  );
}

/** Every image in the four panels, so they can be fetched before the
 *  sideways stretch starts (lazy loading would wait until each slid in). */
const PROCESS_FILES = process.steps.flatMap((step) => [
  ...(step.images ?? []).map((image) => image.src),
  ...(step.rules ?? []).flatMap((r) => r.icon.src),
  ...(step.source ? [step.source.image.src] : []),
  ...(step.results ?? []).map((r) => r.image.src),
]);

/** Holds an image back until the section is near: until then an empty box
 *  of the same ratio, after that the image itself, loaded eagerly. */
function NearImage({ near, ...props }: { near: boolean } & Parameters<typeof CatalogImage>[0]) {
  if (!near) return <div className={`catalog-image ${props.className ?? ''}`} style={{ aspectRatio: props.image.ratio }} />;
  return <CatalogImage {...props} loading="eager" />;
}

export function CineProcess({ onOpen }: { onOpen: OpenImage }) {
  const track = useRef<HTMLDivElement>(null);
  // Within ~1.5 screens of the viewport: start fetching every panel image.
  const near = useInView(track, { once: true, margin: '0px 0px 150% 0px' });
  useEffect(() => {
    if (!near) return;
    PROCESS_FILES.forEach((file) => {
      const img = new Image();
      img.src = imageUrl(file);
    });
  }, [near]);
  // The "사용하지 않음" marks only go on images that have actually loaded.
  const [gen1Loaded, setGen1Loaded] = useState<ReadonlySet<number>>(new Set());
  const { scrollYProgress: p } = useScroll({ target: track, offset: [`start ${NAV}px`, 'end end'] });
  const x = useRamp(p, PANEL_STOPS, PANEL_X);
  const [panel, setPanel] = useState(0);
  useMotionValueEvent(p, 'change', (v) => setPanel(v < 0.17 ? 0 : v < 0.49 ? 1 : v < 0.79 ? 2 : 3));
  const fill = useRamp(p, [0, 1], [0, 1]);
  const [draft, rules, gen1, final] = process.steps;

  const text = (step: typeof draft) => (
    <div className="catalog-step__text">
      <span className="catalog-step__no">{step.no}</span>
      <h3 className="catalog-step__title">{step.title}</h3>
      <p className="catalog-step__body">{step.body}</p>
    </div>
  );

  return (
    <section id="process" className="catalog-section" aria-labelledby="catalog-process">
      <div ref={track} className="cine-process">
        <div className="cine-process__stage">
          <div className="catalog-wide cine-process__head">
            <div>
              <p className="catalog-label">{process.label}</p>
              <h2 id="catalog-process" className="catalog-heading">{process.title}</h2>
              <p className="catalog-sub">{process.subtitle}</p>
            </div>
            <div className="cine-process__progress" aria-hidden="true">
              <ol>
                {process.steps.map((step, i) => (
                  <li key={step.no} className={i === panel ? 'is-current' : i < panel ? 'is-past' : undefined}>
                    {step.no}
                  </li>
                ))}
              </ol>
              <span className="cine-process__bar">
                <motion.span style={{ scaleX: fill }} />
              </span>
            </div>
          </div>

          <div className="cine-process__viewport">
            <motion.div className="cine-process__track" style={{ x }}>
              <article className="cine-panel" aria-current={panel === 0 ? 'step' : undefined}>
                {text(draft)}
                <div className="catalog-thumbs">
                  {draft.images!.map((image) => <NearImage near={near} key={image.src} image={image} onOpen={onOpen} />)}
                </div>
              </article>

              <article className="cine-panel" aria-current={panel === 1 ? 'step' : undefined}>
                {text(rules)}
                <ul className="catalog-rules">
                  {rules.rules!.map((r, i) => (
                    <li key={r.en}>
                      <ScrollFade progress={p} range={[0.2 + i * 0.03, 0.24 + i * 0.03]} from={0.12} className="catalog-rule">
                        <NearImage near={near} image={r.icon} className="catalog-rule__icon" />
                        <div>
                          <p className="catalog-rule__name">{r.name}</p>
                          <p className="catalog-rule__en">{r.en}</p>
                          <p className="catalog-rule__line">{r.line}</p>
                        </div>
                      </ScrollFade>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="cine-panel" aria-current={panel === 2 ? 'step' : undefined}>
                {text(gen1)}
                <div className="catalog-thumbs">
                  {gen1.images!.map((image, i) => (
                    <div key={image.src} className="cine-unused-wrap">
                      <NearImage
                        near={near}
                        image={image}
                        onOpen={onOpen}
                        onLoad={() => setGen1Loaded((prev) => new Set(prev).add(i))}
                      />
                      {gen1Loaded.has(i) ? (
                        <UnusedMark progress={p} range={[0.6 + i * 0.025, 0.64 + i * 0.025]} label={process.unusedLabel} />
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>

              <article className="cine-panel" aria-current={panel === 3 ? 'step' : undefined}>
                {text(final)}
                {near ? <FinalViewer onOpen={onOpen} eager /> : <div className="final-viewer" />}
              </article>
            </motion.div>
          </div>
        </div>
      </div>
      <p className="catalog-wide catalog-tools">{process.tools}</p>
    </section>
  );
}

/* ── 06 · Scenes: each cut pins, the next one rises over it ──────────── */

type Scene = (typeof scenes)[number];

function parseRatio(ratio: string) {
  const [w, h] = ratio.split('/').map((n) => Number(n.trim()));
  return w / h;
}

function CutFrame({ scene, progress, onOpen }: { scene: Scene; progress: MotionValue<number>; onOpen: OpenImage }) {
  // Frames take the photo's own ratio, so nothing is cropped to a grid.
  const [ratio, setRatio] = useState(() => parseRatio(scene.image.ratio));
  const y = useRamp(progress, [0, 1], ['-5%', '5%']);
  return (
    <div className="cine-cut__frame" style={{ ['--r' as string]: ratio }}>
      <motion.div className="cine-cut__media" style={{ y }}>
        <CatalogImage
          image={scene.image as CatalogImageData}
          onOpen={onOpen}
          style={{ aspectRatio: 'auto' }}
          onLoad={(img) => img.naturalHeight && setRatio(img.naturalWidth / img.naturalHeight)}
        />
      </motion.div>
    </div>
  );
}

function Cut({ items, last, onOpen }: { items: Scene[]; last: boolean; onOpen: OpenImage }) {
  const ref = useRef<HTMLDivElement>(null);
  // While the next cut rises over this one.
  const { scrollYProgress: covered } = useScroll({ target: ref, offset: [`start ${NAV}px`, `end ${NAV}px`] });
  // While this cut rises into place.
  const { scrollYProgress: entering } = useScroll({ target: ref, offset: ['start end', `start ${NAV}px`] });
  // Its whole pass through the viewport, for the parallax.
  const { scrollYProgress: through } = useScroll({ target: ref, offset: ['start end', 'end start'] });

  const scale = useRamp(covered, [0, 1], [1, last ? 1 : 0.92]);
  const shade = useRamp(covered, [0, 1], [0, last ? 0 : 0.65]);
  const captionOpacity = useRamp(entering, [0.82, 1], [0, 1]);
  const captionX = useRamp(entering, [0.82, 1], [-16, 0]);

  return (
    <div ref={ref} className={`cine-cut${items.length > 1 ? ' cine-cut--pair' : ''}`}>
      <motion.div className="cine-cut__inner" style={{ scale }}>
        {items.map((scene) => (
          <figure key={scene.title} className="cine-cut__figure">
            <CutFrame scene={scene} progress={through} onOpen={onOpen} />
            <motion.figcaption className="catalog-scene__caption cine-cut__caption" style={{ opacity: captionOpacity, x: captionX }}>
              <p className="catalog-scene__title">{scene.title}</p>
              <p className="catalog-scene__line">{scene.line}</p>
            </motion.figcaption>
          </figure>
        ))}
        <motion.span className="cine-cut__shade" style={{ opacity: shade }} aria-hidden="true" />
      </motion.div>
    </div>
  );
}

export function CineScenes({ onOpen }: { onOpen: OpenImage }) {
  // The two portrait cuts (badge, online) share one screen.
  const cuts = useMemo(() => {
    const out: Scene[][] = [];
    scenes.forEach((scene) => {
      const portrait = parseRatio(scene.image.ratio) < 1;
      const prev = out[out.length - 1];
      if (portrait && prev && prev.length === 1 && parseRatio(prev[0].image.ratio) < 1) prev.push(scene);
      else out.push([scene]);
    });
    return out;
  }, []);

  return (
    <section id="scenes" className="catalog-section cine-scenes" aria-label={scenes.map((s) => s.title).join(', ')}>
      <div className="cine-cuts">
        {cuts.map((items, i) => (
          <Cut key={items[0].title} items={items} last={i === cuts.length - 1} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}
