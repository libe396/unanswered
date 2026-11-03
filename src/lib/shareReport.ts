import { copyText } from './reportShare';

/** Native share where available; copy is the explicit fallback on desktop browsers. */
export async function shareReport(url: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (navigator.share) {
    try { await navigator.share({ title: 'UNANSWERED · 나의 조사 기록', url }); return 'shared'; }
    catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'; }
  }
  return await copyText(url) ? 'copied' : 'failed';
}
