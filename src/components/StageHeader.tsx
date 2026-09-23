import type { ReactNode } from 'react';
import './StageHeader.css';

interface StageHeaderProps {
  /** Short Latin mark. Mono, violet — one of a screen's three violet marks. */
  eyebrow: string;
  title: string;
  description?: ReactNode;
  className?: string;
}

/**
 * The heading block every Zone opens with: eyebrow, question, one line of
 * instruction, left-aligned on the 960 measure.
 *
 * It exists because the instruction line used to float centred at y≈50,
 * wedged between BackButton and ZoneLabel, on a different vertical position
 * in every Scene — so moving between two sub-screens of the *same* Zone
 * moved the heading. Anything that reads as a heading now starts at the same
 * y (--stage-top) whether it is a shelf screen, a stage, or a card grid.
 *
 * StageLayout renders this too, so the two-column Scenes and the full-width
 * ones cannot drift apart.
 */
export function StageHeader({ eyebrow, title, description, className }: StageHeaderProps) {
  return (
    <header className={`stage-head${className ? ` ${className}` : ''}`}>
      <p className="stage-head__eyebrow">{eyebrow}</p>
      <h1 className="stage-head__title">{title}</h1>
      {description ? <p className="stage-head__description">{description}</p> : null}
    </header>
  );
}

interface StageActionsProps {
  /** Left side: a counter or a short instruction. Usually a `.metric`. */
  info?: ReactNode;
  /** Right side: the screen's one Primary. */
  children: ReactNode;
  className?: string;
}

/**
 * The row a Scene ends on. Same measure as the header above it, so the CTA's
 * right edge and the heading's left edge frame the screen.
 *
 * Its bottom clearance is --stage-hud-clear, which is the ArchiveHUD's rule
 * plus 40px — the row and the strip must never read as one band.
 */
export function StageActions({ info, children, className }: StageActionsProps) {
  return (
    <div className={`stage-actions${className ? ` ${className}` : ''}`}>
      <div className="stage-actions__info">{info}</div>
      <div className="stage-actions__cta">{children}</div>
    </div>
  );
}
