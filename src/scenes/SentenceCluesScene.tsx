import { useRef, useState } from 'react';
import { MAX_SENTENCE_SELECTION, SENTENCE_OPTIONS } from '../data/content';
import { useExperienceStore } from '../store/experienceStore';
import { TerminalCorners } from '../components/TerminalCorners';
import { ZoneIntroCard } from '../components/ZoneIntroCard';
import './SentenceCluesScene.css';

const STOPWORDS = new Set([
  '나는', '내가', '나를', '나의', '아직', '정말', '어떤', '그리고', '하지만', '그때', '이것', '저것',
]);

// Longest-first so e.g. '으로' strips before the shorter '로' would misfire on it.
const TRAILING_PARTICLES = [
  '에서', '으로', '까지', '부터', '이랑', '하고', '이나',
  '은', '는', '이', '가', '을', '를', '의', '에', '로', '와', '과', '도', '만',
];

function stripTrailingParticle(token: string): string {
  for (const particle of TRAILING_PARTICLES) {
    if (token.length > particle.length + 1 && token.endsWith(particle)) {
      return token.slice(0, -particle.length);
    }
  }
  return token;
}

function extractRepeatedKeywords(texts: string[]): string[] {
  const counts = new Map<string, number>();
  texts.forEach((text) => {
    const tokens = text
      .split(/[\s,.!?~"'…·]+/)
      .map((token) => stripTrailingParticle(token))
      .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
    new Set(tokens).forEach((token) => {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    });
  });
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token);
}

export function SentenceCluesScene() {
  const setSentenceClues = useExperienceStore((s) => s.setSentenceClues);
  const completeScene = useExperienceStore((s) => s.completeScene);

  const [showIntro, setShowIntro] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customSentence, setCustomSentence] = useState('');
  const [dwellTimes, setDwellTimes] = useState<Record<string, number>>({});
  const hoverStartRef = useRef<Record<string, number | null>>({});

  const canConfirm = selectedIds.length === MAX_SENTENCE_SELECTION && customSentence.trim().length > 0;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SENTENCE_SELECTION) return prev;
      return [...prev, id];
    });
  }

  function handlePointerEnter(id: string) {
    hoverStartRef.current[id] = Date.now();
  }

  function handlePointerLeave(id: string) {
    const start = hoverStartRef.current[id];
    if (start == null) return;
    hoverStartRef.current[id] = null;
    const elapsed = Date.now() - start;
    setDwellTimes((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + elapsed }));
  }

  function handleConfirm() {
    if (!canConfirm) return;

    const now = Date.now();
    const finalDwell = { ...dwellTimes };
    Object.entries(hoverStartRef.current).forEach(([id, start]) => {
      if (start != null) finalDwell[id] = (finalDwell[id] ?? 0) + (now - start);
    });

    const selectedSentences = selectedIds.map(
      (id) => SENTENCE_OPTIONS.find((o) => o.id === id)?.text ?? '',
    );
    const repeatedKeywords = extractRepeatedKeywords([...selectedSentences, customSentence]);

    setSentenceClues({
      selectedSentenceIds: selectedIds,
      selectedSentences,
      customSentence: customSentence.trim(),
      dwellTimes: finalDwell,
      selectionOrder: selectedIds,
      repeatedKeywords,
    });
    completeScene('sentenceClues');
  }

  if (showIntro) {
    return (
      <ZoneIntroCard
        zone="ZONE 08"
        title="문장의 흔적"
        subtitle="사람의 기억은, 결국 글자로 남는 법."
        ctaLabel="조사 시작"
        onContinue={() => setShowIntro(false)}
      />
    );
  }

  return (
    <div className="sentence-clues-scene">
      <p className="sentence-clues-scene__hint">
        이름 없는 사람을 설명할 수 있을 것 같은 문장 {MAX_SENTENCE_SELECTION}개를 고르세요.
      </p>

      <div className="sentence-clues-scene__grid">
        {SENTENCE_OPTIONS.map((option) => {
          const order = selectedIds.indexOf(option.id);
          const isSelected = order !== -1;
          return (
            <button
              key={option.id}
              className={`sentence-clues-scene__card${
                isSelected ? ' sentence-clues-scene__card--selected' : ''
              }`}
              onClick={() => toggleSelect(option.id)}
              onPointerEnter={() => handlePointerEnter(option.id)}
              onPointerLeave={() => handlePointerLeave(option.id)}
            >
              {isSelected ? <span className="sentence-clues-scene__order">{order + 1}</span> : null}
              {option.text}
            </button>
          );
        })}
      </div>

      <textarea
        className="sentence-clues-scene__custom"
        placeholder="직접 문장을 적어보세요"
        value={customSentence}
        onChange={(event) => setCustomSentence(event.target.value)}
      />

      <p className="sentence-clues-scene__status">
        {selectedIds.length} / {MAX_SENTENCE_SELECTION} 선택됨
        {customSentence.trim() ? '' : ' · 직접 작성한 문장이 필요합니다'}
      </p>

      <button className="sentence-clues-scene__confirm" onClick={handleConfirm} disabled={!canConfirm}>
        <TerminalCorners />
        다음으로
      </button>
    </div>
  );
}
