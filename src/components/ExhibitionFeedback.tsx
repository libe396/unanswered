import { useEffect, useRef, useState } from 'react';
import { FEEDBACK_RETENTION_MONTHS, storedReportRef, submitExhibitionFeedback } from '../lib/exhibitionFeedback';
import { hasReportStorage } from '../lib/reportTransfer';
import './ExhibitionFeedback.css';

export function ExhibitionFeedback({ reportLink, standalone = false }: { reportLink?: string; standalone?: boolean }) {
  const [open, setOpen] = useState(standalone);
  const [meaning, setMeaning] = useState('');
  const [help, setHelp] = useState<number | null>(null);
  const [friction, setFriction] = useState('');
  const [consent, setConsent] = useState(false);
  const [recordConsent, setRecordConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submissionId = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const reportRef = storedReportRef(reportLink);
  const hasAnswer = Boolean(meaning.trim() || help !== null || friction.trim());
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (sending || sent || !consent || !hasAnswer) return;
    const controller = new AbortController();
    request.current = controller;
    submissionId.current ??= crypto.randomUUID();
    setSending(true); setError('');
    const timer = window.setTimeout(() => controller.abort(), 20000);
    try {
      await submitExhibitionFeedback({ id: submissionId.current, meaning, replayHelp: help, friction, feedbackConsent: consent, recordConsent: Boolean(reportRef && recordConsent), reportRef }, controller.signal);
      setSent(true);
    } catch (cause) {
      setError(controller.signal.aborted ? '연결이 지연되고 있습니다. 적어 둔 내용은 그대로 있습니다. 다시 시도해 주세요.' : cause instanceof Error ? cause.message : '후기를 보내지 못했습니다. 다시 시도해 주세요.');
    } finally { window.clearTimeout(timer); setSending(false); }
  }
  return <section className="exhibition-feedback" aria-label="전시 후기">
    <h2>이 전시가 당신에게 어떻게 다가왔나요?</h2>
    <p>짧은 후기를 남겨주세요. 다음 전시를 위한 소중한 자료가 됩니다.</p>
    {sent ? <p role="status">후기를 남겨 주셔서 감사합니다.</p> : <>
      <button type="button" className="exhibition-feedback__open" aria-expanded={open} onClick={() => setOpen(value => !value)}>약 1분 · {open ? '후기 접기' : '후기 남기기'}</button>
      {open && <form onSubmit={send}>
        <label>Q1. 이 전시는 무엇에 관한 경험이라고 느꼈나요?<textarea value={meaning} onChange={event => setMeaning(event.target.value)} maxLength={600} rows={3} /></label>
        <fieldset><legend>Q2. 자신의 선택 과정을 다시 보는 장면이 전시를 이해하는 데 도움이 되었나요?</legend>
          <div className="exhibition-feedback__ratings">{[1, 2, 3, 4, 5].map(value => <label key={value}><input type="radio" name="replay-help" value={value} checked={help === value} onChange={() => setHelp(value)} />{value}</label>)}</div>
          <p className="exhibition-feedback__hint">1 전혀 그렇지 않다 · 5 매우 그렇다</p>
        </fieldset>
        <label>Q3. 이해하기 어렵거나 조작하기 불편했던 순간이 있었나요?<textarea value={friction} onChange={event => setFriction(event.target.value)} maxLength={600} rows={3} /></label>
        <p className="exhibition-feedback__hint">떠오르는 질문에만 답해 주세요. 이름·연락처는 묻지 않습니다. 답변에도 개인 정보를 적지 말아 주세요.</p>
        <p className="exhibition-feedback__hint">후기 응답과 연구 활용 연결 정보는 전시 운영자의 비공개 보관소에 {FEEDBACK_RETENTION_MONTHS}개월간 보관한 뒤 삭제합니다. QR 보고서 열람용 기록은 별도로 보관됩니다.</p>
        <label className="exhibition-feedback__check"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />후기 응답을 전시 개선 연구(UT)에 활용하는 데 동의합니다. (후기를 보낼 때 필요)</label>
        {!standalone && <label className="exhibition-feedback__check"><input type="checkbox" disabled={!reportRef} checked={Boolean(reportRef && recordConsent)} onChange={event => setRecordConsent(event.target.checked)} />이번 관람의 선택 화면·움직임과 작성 기록도 후기와 연결해 연구에 활용하는 데 동의합니다. (선택)</label>}
        {!standalone && !reportRef && <p className="exhibition-feedback__hint">보고서 연결이 완료되면 선택 과정의 연구 활용도 선택할 수 있습니다. 후기만 보내도 괜찮습니다.</p>}
        <p className="exhibition-feedback__hint">참여하지 않아도 보고서 열람·저장·공유에 영향이 없습니다. 카메라 영상과 마이크는 수집하지 않습니다.</p>
        {error && <p role="alert">{error}</p>}
        <button className="exhibition-feedback__send" type="submit" disabled={!hasReportStorage || !hasAnswer || !consent || sending}>{sending ? '보내는 중…' : '후기 보내기'}</button>
      </form>}
    </>}
  </section>;
}
