export const LANDING_BGM_VOLUME = 0.24;
export const ARCHIVE_AMBIENCE_VOLUME = 0.08;
export const ARCHIVE_AMBIENCE_DUCK_VOLUME = 0.015;
export const SOUND_CLUES_AMBIENCE_VOLUME = 0.012;
export const SOUND_CLUES_AMBIENCE_DUCK_VOLUME = 0;
export const FINAL_REPORT_BGM_VOLUME = 0.2;
export const CLUE_SIGNATURE_VOLUME = 0.23;
export const UI_BUTTON_CLICK_VOLUME = 0.035;
export const LANDING_BGM_FADE_IN_MS = 1200;
export const LANDING_BGM_FADE_OUT_MS = 1100;
export const ARCHIVE_FINAL_FADE_MS = 900;
export const FINAL_REPORT_BGM_FADE_IN_MS = 1400;
export const FINAL_REPORT_BGM_FADE_OUT_MS = 900;
export const ZONE_BGM_FADE_IN_MS = 1200;
export const ZONE_BGM_FADE_OUT_MS = 900;
export const ZONE_BGM_GAP_MS = 180;
export const ARCHIVE_DUCK_FADE_MS = 240;
export const ARCHIVE_RESTORE_FADE_MS = 850;

export const ARCHIVE_AMBIENCE_DUCK_EVENT = 'unanswered:archive-ambience-duck';
export const CLUE_SIGNATURE_EVENT = 'unanswered:clue-recorded-signature';
export const FINAL_REPORT_BGM_START_EVENT = 'unanswered:final-report-bgm-start';

export interface ArchiveAmbienceDuckDetail {
  ducked: boolean;
}

export function setArchiveAmbienceDucked(ducked: boolean) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ArchiveAmbienceDuckDetail>(ARCHIVE_AMBIENCE_DUCK_EVENT, {
      detail: { ducked },
    }),
  );
}

export function playClueRecordedSignature(delayMs = 0) {
  if (typeof window === 'undefined') return;

  const dispatch = () => {
    window.dispatchEvent(new CustomEvent(CLUE_SIGNATURE_EVENT));
  };

  if (delayMs > 0) {
    window.setTimeout(dispatch, delayMs);
    return;
  }

  dispatch();
}

export function startFinalReportBgmLayer() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FINAL_REPORT_BGM_START_EVENT));
}
