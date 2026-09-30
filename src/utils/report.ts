import { SENTENCE_RECONSTRUCTION_FRAGMENTS, SOUND_CLUES } from '../data/content';
import type { RecordLayerDerived, ReportData } from '../types';

function buildObservationText(record: RecordLayerDerived): string {
  const parts: string[] = [];
  if (record.light) parts.push('관객이 고른 사진에서 빛의 기록을 만들었습니다.');
  if (record.soundClues.selectedSoundId) parts.push('선택한 소리를 기록에 남겼습니다.');
  if (record.memorySketch.selectedObjects.length) parts.push('공간에서 선택한 물건을 기록에 남겼습니다.');
  if (record.sentenceClues.selectedSentenceIds.length) parts.push('이어졌을 법한 이야기의 문장을 골랐습니다.');
  return parts.length ? parts.join(' ') : '확인할 수 있는 선택 기록이 없습니다.';
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
