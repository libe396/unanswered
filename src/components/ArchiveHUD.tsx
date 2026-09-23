import { useExperienceStore } from '../store/experienceStore';
import { ZONE_INFO } from '../data/zones';
import type { SceneId } from '../types';
import './ArchiveHUD.css';

/** The visitor-facing run of Zones, 01–08 (see data/zones.ts). */
const ZONE_COUNT = 8;

/** First and last Zone that carries the HUD. */
const HUD_FIRST_ZONE = 2; // Registration — nothing is issued before it
const HUD_LAST_ZONE = 7; // Record Layer — the Report has its own nav

/**
 * The Zone number a Scene belongs to, read off the one table that already
 * decides visitor-facing numbering. Returns null for Scenes outside the
 * numbered run (Landing's 'UNANSWERED', the retired 'ZONE —').
 */
function zoneNumberOf(scene: SceneId): number | null {
  const match = /^ZONE\s+(\d+)$/.exec(ZONE_INFO[scene]?.zone ?? '');
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function formatIssueTime(timestamp: number | undefined): string | null {
  if (!timestamp) return null;
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * The archive's status strip: where the visitor is in the run of Zones, and
 * which record the visit is being filed under.
 *
 * It reads, and only reads, what the exhibition already stores — the Zone
 * index from ZONE_INFO and the investigator the Registration Scene issued.
 * Nothing here is new state, and nothing here is clickable: it is a readout
 * that gives the Scenes a common floor, not navigation.
 *
 * Rendered once from SceneController, the same way ZoneLabel and BackButton
 * are, so every Scene gets it on the same terms.
 *
 * `scene` is the Scene that is actually on screen, not the store's
 * `currentScene`. The two are the same except during a transition: the store
 * changes the moment a Scene completes, while AnimatePresence holds the
 * outgoing Scene for its full exit. Reading the store directly moved the
 * violet tick forward while the previous Zone was still fading out, so the
 * strip announced the next Zone over the last one's final frame.
 */
export function ArchiveHUD({ scene }: { scene: SceneId }) {
  const investigator = useExperienceStore((s) => s.investigator);
  const currentScene = scene;

  const zone = zoneNumberOf(currentScene);
  if (zone === null || zone < HUD_FIRST_ZONE || zone > HUD_LAST_ZONE) return null;

  const issuedAt = formatIssueTime(investigator?.entryTime);
  const reportId = investigator?.reportId ?? null;

  /*
    The investigator's name appears here only on the Record Layer, which used
    to print it in its own top-left block — that block sat under BackButton
    and said the same thing this strip already says. Merged rather than
    duplicated; every other Zone shows the id alone.
  */
  const showsName = currentScene === 'recordLayerSecondVisit';

  /* Split so the Korean name is not set in the mono face the rest of the
     strip uses — see `.archive-hud__name`. */
  const name = showsName ? investigator?.investigatorName : null;
  const record = [reportId ?? 'RPT-·····', issuedAt].filter(Boolean).join(' · ');

  return (
    <div className="archive-hud" aria-hidden="true">
      <span className="archive-hud__mark">UNANSWERED ARCHIVE</span>

      <span className="archive-hud__ticks">
        {Array.from({ length: ZONE_COUNT }, (_, index) => {
          const n = index + 1;
          const state = n < zone ? 'past' : n === zone ? 'current' : 'future';
          return <span key={n} className={`archive-hud__tick archive-hud__tick--${state}`} />;
        })}
      </span>

      <span className="archive-hud__record">
        {name ? (
          <>
            <span className="archive-hud__name">{name}</span>
            <span aria-hidden="true"> · </span>
          </>
        ) : null}
        {record}
      </span>
    </div>
  );
}
