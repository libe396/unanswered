/**
 * Shared read model for the Final Report's two output surfaces —
 * `FinalReportSummaryReceipt` (screen) and `PrintableFullReport` (print).
 *
 * Both surfaces render the same visit. Neither reads `RecordLayerDerived` or
 * `ReportData` directly for its numbers: everything either shows comes from
 * this one function, so the receipt and the printed report can never drift
 * into disagreeing about what actually happened during the visit. Nothing
 * here is invented per visit — every field is either copied straight from
 * `record`/`report`, or a deterministic reading of real values already on
 * them (a hue bucketed into a name, a ratio turned into a bar width). A
 * session with nothing recorded for a section gets an honest empty/"기록되지
 * 않음" reading here, never a placeholder standing in for real data.
 */
import type { RecordLayerDerived, ReportData } from '../types';

export interface FinalReportColorPresentation {
  dominantHex: string | null;
  centerLightHex: string | null;
  residueHex: string | null;
  temperatureLabel: string;
  paletteSwatches: string[];
  description: string;
}

export interface FinalReportSoundPresentation {
  hasSound: boolean;
  label: string;
  dwellSeconds: number | null;
  sensation: string;
  waveform: number[];
  progress: number;
}

export interface FinalReportSentencePresentation {
  selectedSentences: string[];
  /**
   * The visitor's own typed answer to SENTENCE's generated question — the
   * one line of text this Zone can produce that is genuinely separate from
   * the drawn fragments. Empty when the question was skipped, unanswered,
   * or never existed (`SentenceCluesData.responseSkipped`/`responseText`).
   *
   * Deliberately not `ReportData.customSentence`: per SentenceCluesData's
   * own doc, that field is just `selectedSentences.join(' ')` restated —
   * showing it next to the individual fragments repeated the same words
   * twice on every visit, never a genuinely distinct third line.
   */
  authoredResponse: string;
  repeatedKeywords: string[];
}

export interface FinalReportMemoryPresentation {
  formLabel: string;
  formRatio: number;
  temperatureLabel: string;
  temperatureRatio: number;
  strokeCount: number;
  selectedObjectCount: number;
  markedPointsSummary: string;
}

export type FinalReportClueTag = 'SOUND' | 'SENTENCE' | 'MEMORY';

export interface FinalReportClueLine {
  text: string;
  tag: FinalReportClueTag;
}

export interface FinalReportPresentation {
  reportId: string;
  issuedAtLabel: string;
  recordStatus: 'COMPLETE' | 'IN PROGRESS';
  ownerLabel: string;
  color: FinalReportColorPresentation;
  sound: FinalReportSoundPresentation;
  sentence: FinalReportSentencePresentation;
  memory: FinalReportMemoryPresentation;
  clueLines: FinalReportClueLine[];
  observationText: string;
}

/* ── Color math — plain hex/HSL, no dependency ──────────────────────────── */

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexToHsl(hex: string): Hsl | null {
  const clean = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

const HUE_NAMES: Array<[number, number, string]> = [
  [0, 15, '레드'],
  [15, 40, '코랄'],
  [40, 65, '앰버'],
  [65, 100, '라임'],
  [100, 140, '그린'],
  [140, 170, '민트'],
  [170, 200, '시안'],
  [200, 230, '블루'],
  [230, 255, '인디고'],
  [255, 285, '바이올렛'],
  [285, 325, '퍼플'],
  [325, 345, '핑크'],
  [345, 360, '레드'],
];

function hueName(h: number): string {
  return HUE_NAMES.find(([start, end]) => h >= start && h < end)?.[2] ?? '뉴트럴';
}

function warmthWord(h: number): string {
  if (h < 70 || h >= 330) return '따뜻한';
  if (h >= 150 && h < 290) return '차가운';
  return '중립적인';
}

function warmthNoun(h: number): string {
  if (h < 70 || h >= 330) return '따뜻함';
  if (h >= 150 && h < 290) return '차가움';
  return '중립';
}

/** 1 at the warmest hue (orange, ~30°), 0 at the coolest (blue, ~210°) — a
 *  continuous bar-fill reading of the same hue `warmthWord`/`warmthNoun`
 *  bucket into words. */
function warmthRatio(h: number): number {
  const rad = ((h - 30) * Math.PI) / 180;
  return (Math.cos(rad) + 1) / 2;
}

function describeColor(hex: string | null): string {
  const hsl = hex ? hexToHsl(hex) : null;
  if (!hsl) return '기록되지 않음';
  if (hsl.s < 0.08) {
    const word = hsl.l > 0.62 ? '밝은' : hsl.l < 0.32 ? '어두운' : '무채색의';
    return `${word} 회색`;
  }
  return `${warmthWord(hsl.h)} ${hueName(hsl.h)}`;
}

/** Circular mean of every real (non-achromatic) hue in `hexes`, or null when
 *  none of them carry enough saturation to mean anything. */
function averageHue(hexes: readonly string[]): number | null {
  const hues = hexes
    .map((hex) => hexToHsl(hex))
    .filter((hsl): hsl is Hsl => hsl !== null && hsl.s >= 0.08)
    .map((hsl) => hsl.h);
  if (hues.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const h of hues) {
    const rad = (h * Math.PI) / 180;
    x += Math.cos(rad);
    y += Math.sin(rad);
  }
  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  return angle < 0 ? angle + 360 : angle;
}

/* ── Waveform — deterministic per sound id, never random per render ────── */

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

/** A stable bar-height sequence seeded from the sound's own id, so the same
 *  clue always draws the same shape rather than a fresh random one per
 *  render. Decorative — no per-clip amplitude data exists to read instead —
 *  but fixed and reproducible, not re-rolled. */
export function buildSoundWaveform(soundId: string, barCount = 56): number[] {
  let seed = hashString(soundId) || 1;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const bars: number[] = [];
  let level = 0.5;
  for (let i = 0; i < barCount; i += 1) {
    level = Math.min(1, Math.max(0.1, level + (next() - 0.5) * 0.55));
    bars.push(level);
  }
  return bars;
}

/* ── Section builders ───────────────────────────────────────────────────── */

function buildColorPresentation(record: RecordLayerDerived): FinalReportColorPresentation {
  const rules = record.light?.rules ?? null;
  const palette = rules?.palette ?? [];
  const weights = rules && rules.paletteWeights.length === palette.length ? rules.paletteWeights : palette.map(() => 1);
  const ranked = palette.map((hex, i) => ({ hex, weight: weights[i] ?? 0 })).sort((a, b) => b.weight - a.weight);

  const dominantHex = ranked[0]?.hex ?? null;
  const residueHex = ranked[1]?.hex ?? dominantHex;
  const centerLightHex = rules?.brightRegions[0]?.color ?? dominantHex;
  const temperatureLabel = describeColor(dominantHex);

  const brightnessWord =
    rules === null ? null : rules.averageBrightness > 0.55 ? '밝은' : rules.averageBrightness < 0.35 ? '어두운' : '차분한';
  const description =
    brightnessWord === null
      ? '기록된 빛의 흔적이 없습니다.'
      : `${brightnessWord} 화면 위로 ${temperatureLabel} 색이 가장 오래 남았습니다.`;

  return { dominantHex, centerLightHex, residueHex, temperatureLabel, paletteSwatches: palette, description };
}

function buildSoundPresentation(record: RecordLayerDerived, report: ReportData): FinalReportSoundPresentation {
  const selectedId = record.soundClues.selectedSoundId;
  const events = record.soundClues.events;
  const event = events.find((e) => e.soundId === selectedId) ?? null;
  const maxPlayedMs = Math.max(1, ...events.map((e) => e.totalPlayedMs));

  const sensation = !event
    ? '기록된 청취 반응이 없습니다.'
    : event.skipped
      ? '끝까지 듣지 않고 지나쳤습니다.'
      : event.replayCount > 0
        ? '다시 들으며 머물렀습니다.'
        : event.completedFully
          ? '끝까지 들었습니다.'
          : '짧게 머물렀습니다.';

  return {
    hasSound: Boolean(selectedId),
    label: report.selectedSoundLabel,
    dwellSeconds: event ? Math.round(event.totalPlayedMs / 100) / 10 : null,
    sensation,
    waveform: selectedId ? buildSoundWaveform(selectedId) : [],
    progress: event ? Math.min(1, event.totalPlayedMs / maxPlayedMs) : 0,
  };
}

function buildMemoryPresentation(record: RecordLayerDerived): FinalReportMemoryPresentation {
  const sketch = record.memorySketch;
  const strokeCount = sketch.strokes.length;
  const selectedObjectCount = sketch.selectedObjects.length;
  const coverage = strokeCount > 0 ? 1 - sketch.emptyAreaRatio : 0;

  let formLabel: string;
  let formRatio: number;
  if (strokeCount === 0 && selectedObjectCount === 0) {
    formLabel = '흔적 없음';
    formRatio = 0;
  } else if (strokeCount === 0) {
    formLabel = '물건으로만 남음';
    formRatio = Math.min(1, selectedObjectCount / 5);
  } else if (coverage < 0.12) {
    formLabel = '색감만 남음';
    formRatio = Math.max(0.08, coverage);
  } else {
    formLabel = '형태로 남음';
    formRatio = coverage;
  }

  const avgHue = averageHue(sketch.selectedColors);
  const temperatureLabel = avgHue === null ? '기록되지 않음' : warmthNoun(avgHue);
  const temperatureRatio = avgHue === null ? 0.5 : warmthRatio(avgHue);

  const markedPointsSummary =
    selectedObjectCount > 0
      ? `기억 스케치에서 단서라고 느껴지는 지점 ${selectedObjectCount}곳을 표시했습니다.`
      : strokeCount > 0
        ? `기억 스케치 위에 ${strokeCount}번의 손짓으로 흔적을 남겼습니다.`
        : '기억 스케치에 표시된 지점이 없습니다.';

  return { formLabel, formRatio, temperatureLabel, temperatureRatio, strokeCount, selectedObjectCount, markedPointsSummary };
}

function buildClueLines(
  report: ReportData,
  sentence: FinalReportSentencePresentation,
  sound: FinalReportSoundPresentation,
  memory: FinalReportMemoryPresentation,
): FinalReportClueLine[] {
  const lines: FinalReportClueLine[] = [];
  if (sound.hasSound) lines.push({ text: sound.label, tag: 'SOUND' });
  for (const text of report.selectedSentences.slice(0, 2)) lines.push({ text, tag: 'SENTENCE' });
  if (sentence.authoredResponse) lines.push({ text: sentence.authoredResponse, tag: 'SENTENCE' });
  if (memory.formLabel !== '흔적 없음') lines.push({ text: memory.formLabel, tag: 'MEMORY' });
  if (memory.temperatureLabel !== '기록되지 않음') lines.push({ text: memory.temperatureLabel, tag: 'MEMORY' });
  return lines.slice(0, 6);
}

function formatIssuedAt(timestamp: number | null): string {
  if (timestamp === null) return '-';
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Builds the one presentation model both `FinalReportSummaryReceipt` and
 * `PrintableFullReport` read from.
 *
 * `generatedAt` is the visit's own `finalReport.generatedAt` (set once, by
 * `markFinalReportGenerated`, when the Final Report first mounts) — never
 * `Date.now()` read again here, so the two surfaces printed minutes apart
 * still show the same issue time.
 */
export function buildFinalReportPresentation(
  record: RecordLayerDerived,
  report: ReportData,
  generatedAt: number | null,
): FinalReportPresentation {
  const color = buildColorPresentation(record);
  const sound = buildSoundPresentation(record, report);
  const memory = buildMemoryPresentation(record);
  const sentence: FinalReportSentencePresentation = {
    selectedSentences: report.selectedSentences,
    authoredResponse: record.sentenceClues.responseSkipped ? '' : record.sentenceClues.responseText.trim(),
    repeatedKeywords: report.repeatedKeywords,
  };

  return {
    reportId: report.reportId,
    issuedAtLabel: formatIssuedAt(generatedAt ?? record.investigator?.entryTime ?? null),
    recordStatus: record.completedCount >= record.totalCount ? 'COMPLETE' : 'IN PROGRESS',
    ownerLabel: '당신',
    color,
    sound,
    sentence,
    memory,
    clueLines: buildClueLines(report, sentence, sound, memory),
    observationText: report.observationText,
  };
}
