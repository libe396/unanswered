import type { PersonalFinding } from '../personalFindingInterpretation';
import type { ZoneKey } from '../personalFindings';
import type { ChoiceReplay } from './choiceReplay';

/** A short continuous excerpt around an actual choice, at its original speed. */
function excerpt(record: ChoiceReplay) {
  const clicks = record.inputs.filter(input => input.kind === 'click');
  const choice = clicks.at(-2) ?? clicks.at(-1);
  const start = Math.max(0, Math.min(record.duration - 6000, (choice?.t ?? 2500) - 2500));
  return { record, start, duration: Math.min(6000, record.duration - start) };
}
const SCENES: Record<ZoneKey, ChoiceReplay['scene']> = {
  LIGHT: 'lightArchive', SOUND: 'soundClues', MEMORY: 'memorySketch', SENTENCE: 'sentenceClues',
};

export function buildReplaySummary(finding: PersonalFinding, records: ChoiceReplay[]) {
  // One chronological step per space; multiple facts must not replay the same clip twice.
  return (Object.keys(SCENES) as ZoneKey[]).flatMap(zone => {
    const facts = finding.evidence.filter(evidence => evidence.zone === zone);
    if (!facts.length) return [];
    const evidence = { ...facts[0], description: [...new Set(facts.map(fact => fact.description))].slice(0, 2).join('\n'),
      metrics: [...new Set(facts.flatMap(fact => fact.metrics))] };
    // A skipped drawing/blank response must not be illustrated as object/sentence selection.
    const wanted = new Set(facts.flatMap(fact => {
      if (zone === 'MEMORY') return [/그리기 단계를 열지/.test(fact.description) ? 'drawingChoice' : /그리|그렸|그림|드로잉|캔버스|비워|마지막 선/.test(fact.description) ? 'drawing' : 'room'];
      if (zone === 'SENTENCE') return [/빈칸|응답|덧붙|작성|미응답|질문|답하지|비워/.test(fact.description) ? 'question' : 'explore'];
      if (zone === 'SOUND') return [/거리|선명|위치|좌표|놓은 자리|옮김/.test(fact.description) ? 'positioning' : 'browse'];
      return /단어|느낌/.test(fact.description) ? ['feeling'] : ['browse', 'feeling'];
    }));
    const matching = records.filter(record => record.scene === SCENES[evidence.zone] && wanted.has(record.phase));
    // Use the actual latest visit; retain both photo and word choices for LIGHT.
    const phases = [...new Set(matching.map(record => record.phase))];
    const clips = phases.flatMap(phase => {
      const record = matching.filter(item => item.phase === phase).at(-1);
      return record ? [excerpt(record)] : [];
    });
    return [{ evidence, clips, duration: Math.max(4500, clips.reduce((sum, clip) => sum + clip.duration, 0)) }];
  });
}
