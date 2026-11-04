/**
 * Exhibition-floor mode: the venue PC opens the site with `?venue=1`.
 * Hides the print button, shows the large QR with the card guidance, and
 * returns the last screen to Landing after VENUE_IDLE_RESET_MS without input.
 */
export const VENUE_IDLE_RESET_MS = 120_000;

export function isVenueMode(): boolean {
  return new URLSearchParams(window.location.search).get('venue') === '1';
}

/** Venue only, every scene but Landing and the Final Report: no input for this
 *  long asks "계속 조사하시겠습니까?", and VENUE_IDLE_CONFIRM_MS more resets —
 *  two minutes in all (2026-11-03, booth request). */
export const VENUE_IDLE_PROMPT_MS = 105_000;
export const VENUE_IDLE_CONFIRM_MS = 15_000;

/** The booth reaches the web catalogue and comes back through `?venue=1`, so a
 *  visit to 전시 소개 never drops the venue PC out of venue mode
 *  (2026-11-04, booth request). */
export function catalogHref(venue: boolean): string {
  return `${import.meta.env.BASE_URL}catalog/${venue ? '?venue=1' : ''}`;
}

export function exhibitionHref(venue: boolean): string {
  return `${import.meta.env.BASE_URL}${venue ? '?venue=1' : ''}`;
}
