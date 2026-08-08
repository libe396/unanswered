import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useExperienceStore } from '../store/experienceStore';
import { ZONE_INFO } from '../data/zones';
import './ZoneLabel.css';

/**
 * Site-wide wayfinding label — always the same position/style, only the
 * zone number and name change per Scene. Rendered once from SceneController,
 * not from individual Scenes, so every Scene gets it automatically and
 * consistently.
 *
 * Landing is the one exception: it shows the full wordmark, so a second
 * "UNANSWERED" in the corner would just be the title printed twice.
 */
export function ZoneLabel() {
  const currentScene = useExperienceStore((s) => s.currentScene);
  const prefersReducedMotion = useReducedMotion();
  const info = ZONE_INFO[currentScene];

  if (currentScene === 'landing') return null;

  return (
    <div className="zone-label">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScene}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.5 }}
        >
          <span className="zone-label__zone">{info.zone}</span>
          <span className="zone-label__name">{info.label}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
