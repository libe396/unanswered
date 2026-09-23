import type { ReactNode } from 'react';
import './StageLayout.css';

export interface StageStep {
  /** Two-digit index as shown: '01', '02', '03'. */
  index: string;
  label: string;
}

interface StageLayoutProps {
  /** The thing the Scene is about: a card, an image, a graphic. */
  object: ReactNode;
  /** Short Latin mark above the heading. */
  eyebrow: string;
  title: string;
  description?: ReactNode;
  /**
   * Only for Scenes that genuinely have ordered steps. A Scene with one
   * action does not get a one-item progress row.
   */
  steps?: StageStep[];
  /** Which of `steps` is current, by `index`. */
  activeStep?: string;
  /** Inputs, choices, and the Scene's CTA. */
  children?: ReactNode;
  /**
   * A soft violet light behind the object. One per screen, and this is the
   * only place in the project that draws one — see `.residue` in global.css.
   * Defaults to on, because every stage has exactly one object.
   */
  residue?: boolean;
  className?: string;
}

/**
 * The two-column stage: object on the left, what to read and do on the right.
 *
 * This replaces the one template every Zone had been using — a column of
 * centred text in the middle of an empty screen — which is most of why the
 * exhibition read as a wireframe no matter how the type was set. Content is
 * left-aligned here; centred text is now ZoneIntroCard's alone, which is what
 * makes the intro beat feel like a different kind of screen from the work.
 *
 * Measures live in tokens.css (--stage-*) so the Zones cannot drift apart:
 * 960 container, a 392px object column, 96px gutter, and a vertical band that
 * starts below the header and ends above the ArchiveHUD.
 */
export function StageLayout({
  object,
  eyebrow,
  title,
  description,
  steps,
  activeStep,
  children,
  residue = true,
  className,
}: StageLayoutProps) {
  return (
    <div className={`stage${className ? ` ${className}` : ''}`}>
      <div className="stage__inner">
        <div className="stage__object">
          {residue ? <span className="residue stage__residue" aria-hidden="true" /> : null}
          <div className="stage__object-body">{object}</div>
        </div>

        <div className="stage__content">
          <p className="stage__eyebrow">{eyebrow}</p>
          <h1 className="stage__title">{title}</h1>
          {description ? <p className="stage__description">{description}</p> : null}

          {steps && steps.length > 0 ? (
            <ol className="stage__steps">
              {steps.map((step) => (
                <li
                  key={step.index}
                  className={`stage__step${
                    step.index === activeStep ? ' stage__step--active' : ''
                  }`}
                >
                  <span className="stage__step-index">{step.index}</span>
                  <span className="stage__step-label">{step.label}</span>
                </li>
              ))}
            </ol>
          ) : null}

          {children ? <div className="stage__action">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
