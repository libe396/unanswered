import { motion, useReducedMotion } from 'framer-motion';
import { TerminalCorners } from './TerminalCorners';
import './ZoneIntroCard.css';

interface ZoneIntroCardProps {
  zone: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  onContinue: () => void;
}

/**
 * Shared "entering a zone" beat — ZONE label, one-line title, one-line
 * subtitle, terminal-style CTA. Used as the first phase of every experience
 * Scene so the whole exhibition shares the same rhythm: Record Layer → Zone
 * Intro → Experience. Purely presentational; each caller decides what
 * `onContinue` does (advance a local phase, or complete the Scene).
 */
export function ZoneIntroCard({ zone, title, subtitle, ctaLabel, onContinue }: ZoneIntroCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const d = (full: number) => (prefersReducedMotion ? full * 0.3 : full);

  return (
    <div className="zone-intro-card">
      <motion.span
        className="zone-intro-card__zone"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: d(0.8) }}
      >
        {zone}
      </motion.span>
      <motion.h1
        className="zone-intro-card__title"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: d(0.9), delay: d(0.5) }}
      >
        {title}
      </motion.h1>
      <motion.p
        className="zone-intro-card__subtitle"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: d(0.9), delay: d(1.0) }}
      >
        {subtitle}
      </motion.p>
      <motion.button
        className="zone-intro-card__cta"
        onClick={onContinue}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: d(1), delay: d(1.6) }}
      >
        <TerminalCorners />
        {ctaLabel}
      </motion.button>
    </div>
  );
}
