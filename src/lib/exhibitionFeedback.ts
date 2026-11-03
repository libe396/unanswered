import { reportStorageHeaders, REPORT_STORAGE_ENDPOINT } from './reportTransfer';

export const FEEDBACK_RETENTION_MONTHS = 6;
/*
  Bumped when the questions change, so answers to one wording are never mixed
  with answers to another: v1 asked "이 전시는 무엇에 관한 경험이라고
  느꼈나요?" and rated the replay 1–5 with no way to say it was never opened;
  v2 asks what stayed and accepts 0 for "보지 않았다". The storage function
  accepts both, and every row carries the version it was answered under.
*/
export const FEEDBACK_CONSENT_VERSION = 'ut-2026-11-03-v2';
export interface ExhibitionFeedbackInput {
  id: string;
  meaning: string;
  replayHelp: number | null;
  friction: string;
  feedbackConsent: boolean;
  recordConsent: boolean;
  reportRef?: string | null;
}
export function storedReportRef(value: string | undefined): string | null {
  const match = value?.match(/(?:#\/r\/)?@([a-f0-9]{48})$/);
  return match?.[1] ?? null;
}
export async function submitExhibitionFeedback(input: ExhibitionFeedbackInput, signal: AbortSignal) {
  if (!REPORT_STORAGE_ENDPOINT) throw new Error('후기 연결을 준비하고 있습니다. 잠시 후 다시 열어 주세요.');
  if (!input.feedbackConsent || (!input.meaning.trim() && input.replayHelp === null && !input.friction.trim())) throw new Error('응답과 후기 활용 동의를 확인해 주세요.');
  if (input.recordConsent && !input.reportRef) throw new Error('관람 기록 연결이 끝난 뒤 다시 시도해 주세요.');
  const response = await fetch(`${REPORT_STORAGE_ENDPOINT}/feedback`, {
    method: 'POST', credentials: 'omit', signal,
    headers: { ...reportStorageHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, meaning: input.meaning.trim(), friction: input.friction.trim(), reportRef: input.recordConsent ? input.reportRef : null, consentVersion: FEEDBACK_CONSENT_VERSION }),
  });
  if (response.status === 429) throw new Error('잠시 쉬었다가 다시 보내 주세요.');
  if (!response.ok) throw new Error('후기를 보내지 못했습니다. 적어 둔 내용은 그대로 있습니다. 다시 시도해 주세요.');
}
