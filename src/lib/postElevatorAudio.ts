export const ARCHIVE_AMBIENCE_VOLUME = 0.14;
export const ARCHIVE_AMBIENCE_DUCK_VOLUME = 0.02;
export const FINAL_REPORT_BGM_VOLUME = 0.2;
export const CLUE_SIGNATURE_VOLUME = 0.23;
export const ARCHIVE_FINAL_FADE_MS = 900;
export const FINAL_REPORT_BGM_FADE_IN_MS = 1400;
export const FINAL_REPORT_BGM_FADE_OUT_MS = 900;
export const ARCHIVE_DUCK_FADE_MS = 240;
export const ARCHIVE_RESTORE_FADE_MS = 850;

export const ARCHIVE_AMBIENCE_DUCK_EVENT = 'unanswered:archive-ambience-duck';
export const CLUE_SIGNATURE_EVENT = 'unanswered:clue-recorded-signature';

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
