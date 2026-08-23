import { SENTENCE_RECONSTRUCTION_FRAGMENTS, SOUND_CLUES } from '../data/content';
import type { RecordLayerDerived, ReportData } from '../types';

function buildObservationText(record: RecordLayerDerived): string {
  const dominantKeyword =
    record.light?.rules.emotionKeywords[0] ?? record.soundClues.selectedKeyword ?? '미응답';
  const structureType = record.light?.rules.structure?.compositionType ?? 'abstract / unclear';
  const repeated = record.sentenceClues.repeatedKeywords[0];
  const repeatedLine = repeated
    ? `'${repeated}'라는 단어가 반복해서 나타났다.`
    : '뚜렷하게 반복되는 단어는 나타나지 않았다.';

  /*
    Gated per the Data / Finding Audit: this line used to close every
    observation unconditionally, regardless of whether the session's data
    actually failed to resolve to anything. `structureType` is the one
    already-computed signal available here (LIGHT's own deterministic
    composition read — src/lib/imageAnalysis.js's compositionTypeLabel) that
    means roughly the same thing: the image itself did not resolve to one
    clear subject. Everywhere else this line would need behavioural data
    (e.g. SENTENCE's viewedButUnusedFragments) that this function, reading
    only the final answers in `record`, does not have.
  */
  const unresolvedLine =
    structureType === 'abstract / unclear' ? ' 그러나 이 모든 단서는 하나의 문장으로 정리되지 않는다.' : '';

  return `이 기록의 대상은 ${dominantKeyword}에 오래 머물렀고, ${structureType} 구조의 빛에 반응했다. ${repeatedLine}${unresolvedLine}`;
}

function buildSoundPattern(record: RecordLayerDerived): string {
  const events = record.soundClues.events;
  if (events.length === 0) return '기록된 청취 패턴이 없다.';
  const completed = events.filter((e) => e.completedFully).length;
  const replayed = events.filter((e) => e.replayCount > 0).length;
  const skipped = events.filter((e) => e.skipped).length;
  return `${completed}개를 끝까지 들었고, ${replayed}개를 다시 들었으며, ${skipped}개를 그냥 지나쳤다.`;
}

function buildMemorySketchSummary(record: RecordLayerDerived): string {
  const strokeCount = record.memorySketch.strokes.length;
  const emptyPercent = Math.round(record.memorySketch.emptyAreaRatio * 100);
  if (strokeCount === 0) return '아무 흔적도 남기지 않았다.';
  return `${strokeCount}개의 흔적을 남겼고, ${emptyPercent}%는 비워두었다.`;
}

function buildDwellSummary(record: RecordLayerDerived): string {
  const dwellEntries = Object.entries(record.sentenceClues.dwellTimes);
  if (dwellEntries.length === 0) return '머문 시간이 기록되지 않았다.';
  const [longestId, longestMs] = dwellEntries.sort((a, b) => b[1] - a[1])[0];
  const sentence = SENTENCE_RECONSTRUCTION_FRAGMENTS.find((f) => f.id === longestId)?.text;
  const seconds = (longestMs / 1000).toFixed(1);
  return sentence ? `'${sentence}' 앞에서 가장 오래 머물렀다 (${seconds}초).` : '머문 시간이 기록되지 않았다.';
}

export function buildReport(record: RecordLayerDerived): ReportData {
  const soundLabel =
    SOUND_CLUES.find((s) => s.id === record.soundClues.selectedSoundId)?.label ?? '기록되지 않음';

  return {
    reportId: record.investigator?.reportId ?? '-',
    investigatorName: record.investigator?.investigatorName ?? '이름 없음',
    entryTime: record.investigator?.entryTime ?? Date.now(),
    imageId: record.light?.imageId ?? '-',
    imagePath: record.light?.imagePath ?? '',
    palette: record.light?.rules.palette ?? [],
    emotionKeywords: record.light?.rules.emotionKeywords ?? [],
    selectedSoundLabel: soundLabel,
    soundPattern: buildSoundPattern(record),
    memorySketchSummary: buildMemorySketchSummary(record),
    selectedSentences: record.sentenceClues.selectedSentences,
    customSentence: record.sentenceClues.customSentence,
    repeatedKeywords: record.sentenceClues.repeatedKeywords,
    dwellSummary: buildDwellSummary(record),
    observationText: buildObservationText(record),
    targetIdentity: record.investigator?.investigatorName ?? '이름 없음',
  };
}
