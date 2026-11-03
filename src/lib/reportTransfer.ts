import type { PersonalFinding } from './personalFindingInterpretation';
import type { SharedReport } from './reportShare';
import { PUBLIC_REPORT_URL, REPORT_HASH_PREFIX } from './reportShare';
import type { ChoiceReplay } from './replay/choiceReplay';
import { EMOTION_KEYWORDS } from '../data/content';
import type { LightAnalysisRules, Stroke } from '../types';

/** Optional project-owned storage. No upload or external service is used without configuration. */
export const REPORT_STORAGE_ENDPOINT = (import.meta.env.VITE_REPORT_STORAGE_ENDPOINT ?? '').replace(/\/$/, '');
const ANON_KEY = import.meta.env.VITE_REPORT_STORAGE_ANON_KEY ?? '';
export const reportStorageHeaders = (): Record<string, string> => ANON_KEY ? { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } : {};
export const hasReportStorage = Boolean(REPORT_STORAGE_ENDPOINT);
export interface TransferReport {
  v: 1;
  report: SharedReport;
  findings: PersonalFinding[];
  replays: ChoiceReplay[];
  strokes: Stroke[];
  light?: { rules: LightAnalysisRules; variation: number; imageId: string } | null;
}
const ID = /^[A-Za-z0-9_-]{8,96}$/;
export const isStoredReport = (payload: string) => payload.startsWith('@');

export async function storeReport(bundle: TransferReport, signal: AbortSignal): Promise<string> {
  if (!REPORT_STORAGE_ENDPOINT) throw new Error('보고서 보관소가 연결되지 않았습니다.');
  const body = JSON.stringify(bundle);
  if (new Blob([body]).size > 25 * 1024 * 1024) throw new Error('화면 기록이 커서 휴대폰 보고서를 준비하지 못했습니다. PC에서 전체 기록을 저장해 주세요.');
  const response = await fetch(REPORT_STORAGE_ENDPOINT, { method: 'POST', headers: { ...reportStorageHeaders(), 'Content-Type': 'application/json' }, body, signal, credentials: 'omit' });
  if (!response.ok) throw new Error('휴대폰 보고서를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  const value: unknown = await response.json();
  const id = value && typeof value === 'object' && 'id' in value ? value.id : null;
  if (typeof id !== 'string' || !ID.test(id)) throw new Error('보고서 주소를 확인하지 못했습니다.');
  return `${PUBLIC_REPORT_URL}${REPORT_HASH_PREFIX}@${id}`;
}

export async function loadStoredReport(payload: string, signal: AbortSignal): Promise<TransferReport> {
  const id = payload.slice(1);
  if (!REPORT_STORAGE_ENDPOINT || !ID.test(id)) throw new Error('보고서 보관소에 연결할 수 없습니다.');
  const response = await fetch(`${REPORT_STORAGE_ENDPOINT}/${encodeURIComponent(id)}`, { signal, credentials: 'omit', headers: reportStorageHeaders() });
  if (response.status === 404 || response.status === 410) throw new Error('이 기록의 보관 기간이 끝났거나 링크를 찾을 수 없습니다.');
  if (!response.ok) throw new Error('기록을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.');
  const text = await response.text();
  if (text.length > 25 * 1024 * 1024) throw new Error('불러올 기록이 너무 큽니다.');
  const data = JSON.parse(text) as TransferReport;
  if (!data || data.v !== 1 || !data.report || data.report.v !== 1 || typeof data.report.id !== 'string' || !Array.isArray(data.report.findings) || !Array.isArray(data.report.kw) || !Array.isArray(data.report.obj) || !Array.isArray(data.report.sen) || !Array.isArray(data.report.ev) || !Array.isArray(data.findings) || !Array.isArray(data.replays) || !Array.isArray(data.strokes)) throw new Error('기록의 형식을 확인하지 못했습니다.');
  const report = data.report;
  if (typeof report.n !== 'string' || (report.img !== null && typeof report.img !== 'string') || !Number.isFinite(report.var) || !report.kw.every(index => Number.isInteger(index) && index >= 0 && index < EMOTION_KEYWORDS.length) || !report.obj.every(id => typeof id === 'string') || !report.sen.every(id => typeof id === 'string') || (report.response !== undefined && typeof report.response !== 'string') || report.findings.some(item => typeof item.id !== 'string' || !item.context || typeof item.context !== 'object' || Array.isArray(item.context) || !Object.values(item.context).every(value => typeof value === 'string')) || data.findings.length > 3) throw new Error('보고서 내용을 읽을 수 없습니다.');
  if (report.ev.some(item => !item || !['dwell', 'removed', 'replay', 'selection'].includes(item.kind) || !['soundClues', 'memorySketch', 'sentenceClues'].includes(item.sceneId) || typeof item.targetId !== 'string' || (item.tenths !== undefined && !Number.isFinite(item.tenths)))) throw new Error('선택 기록을 읽을 수 없습니다.');
  if (report.pos !== null && (!Array.isArray(report.pos) || report.pos.length !== 2 || !report.pos.every(value => Number.isFinite(value) && value >= 0 && value <= 1))) throw new Error('소리 위치를 읽을 수 없습니다.');
  if (data.light && (data.light.imageId !== report.img || !Number.isFinite(data.light.variation) || !Array.isArray(data.light.rules?.palette) || !data.light.rules.palette.every(color => typeof color === 'string') || !Number.isFinite(data.light.rules.averageBrightness) || !Number.isFinite(data.light.rules.lightOrigin?.x) || !Number.isFinite(data.light.rules.lightOrigin?.y))) throw new Error('빛의 기록을 읽을 수 없습니다.');
  for (const stroke of data.strokes) {
    if (!stroke || typeof stroke.color !== 'string' || !Number.isFinite(stroke.width) || stroke.width <= 0 || !Array.isArray(stroke.points) || stroke.points.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new Error('그림 기록을 읽을 수 없습니다.');
  }
  for (const finding of data.findings) {
    if (!finding || typeof finding.id !== 'string' || typeof finding.headline !== 'string' || typeof finding.interpretation !== 'string' || typeof finding.reflection !== 'string' || typeof finding.pattern !== 'string' || !Array.isArray(finding.evidence) || finding.evidence.some(item => typeof item.scene !== 'string' || typeof item.description !== 'string' || !Array.isArray(item.metrics) || item.metrics.some(metric => typeof metric !== 'string'))) throw new Error('기록의 해석을 읽을 수 없습니다.');
  }
  for (const record of data.replays) {
    if (!record || !['lightArchive', 'soundClues', 'memorySketch', 'sentenceClues'].includes(record.scene) || !Number.isFinite(record.duration) || record.duration < 0 || !Array.isArray(record.frames) || !Array.isArray(record.inputs) || !Array.isArray(record.styles) || record.styles.some(style => typeof style !== 'string') || record.frames.some(frame => !Number.isFinite(frame.t) || frame.t < 0 || typeof frame.html !== 'string' || !(frame.width > 0 && frame.width <= 16384 && frame.height > 0 && frame.height <= 16384) || !Array.isArray(frame.scroll) || frame.scroll.some(item => !Array.isArray(item) || item.length !== 3 || !item.every(Number.isFinite))) || record.inputs.some(input => !input || !Number.isFinite(input.t) || typeof input.target !== 'string' || !['move', 'enter', 'leave', 'down', 'up', 'click', 'focus', 'blur'].includes(input.kind))) throw new Error('선택 화면 기록을 읽을 수 없습니다.');
  }
  return data;
}
