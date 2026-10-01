/**
 * Exhibition-floor mode: the venue PC opens the site with `?venue=1`.
 * Hides the print button, shows the large QR with the card guidance, and
 * returns the last screen to Landing after VENUE_IDLE_RESET_MS without input.
 */
export const VENUE_IDLE_RESET_MS = 90_000;

export function isVenueMode(): boolean {
  return new URLSearchParams(window.location.search).get('venue') === '1';
}

/** Venue only, every scene but Landing and the Final Report: no input for this
 *  long asks "계속 조사하시겠습니까?", and VENUE_IDLE_CONFIRM_MS more resets. */
export const VENUE_IDLE_PROMPT_MS = 180_000;
export const VENUE_IDLE_CONFIRM_MS = 15_000;
