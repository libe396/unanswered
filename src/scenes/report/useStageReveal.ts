import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * True once a stage's own reveal choreography has settled — the signal each
 * Report stage uses to show its `ReportStageNav` control.
 *
 * Under `prefers-reduced-motion`, every stage's information is already
 * rendered in its final state on mount (no reveal animation to wait for), so
 * this resolves almost immediately rather than waiting out `delayMs`.
 *
 * One hook shared by every stage rather than each stage owning its own
 * `setTimeout` — the single place that clears its timer on unmount, so
 * switching stages quickly can never leave a stale timer firing into an
 * unmounted stage.
 */
export function useStageReveal(delayMs: number): boolean {
  const prefersReducedMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
    const ms = prefersReducedMotion ? Math.min(200, delayMs) : delayMs;
    const timer = window.setTimeout(() => setRevealed(true), ms);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs, prefersReducedMotion]);

  return revealed;
}
