import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SENTENCE_MAX_FRAGMENTS,
  SENTENCE_MIN_FRAGMENTS,
  SENTENCE_RECONSTRUCTION_FRAGMENTS,
  SENTENCE_SLOTS,
  SENTENCE_SLOT_LABELS,
} from '../data/content';
import type { SentenceReconstructionFragment, SentenceSlot } from '../data/content';
import { useExperienceStore } from '../store/experienceStore';
import { logSceneTracking, useSceneTracking } from '../hooks/useSceneTracking';
import { detectSentencePatterns } from '../lib/sentencePatterns';
import { playClueRecordedSignature } from '../lib/postElevatorAudio';
import {
  SENTENCE_GROUP,
  SENTENCE_TRACKING_GROUPS,
  summarizeSentence,
} from '../lib/sentenceTracking';
import { SENTENCE_THRESHOLDS } from '../lib/sentenceThresholds';
import { buildSentenceNarrativeContext } from '../lib/sentenceNarrative';
import { TerminalCorners } from '../components/TerminalCorners';
import { ZoneIntroCard } from '../components/ZoneIntroCard';
import type { SceneBehaviorRecord } from '../types';
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

const FRAGMENT_BY_ID = new Map(SENTENCE_RECONSTRUCTION_FRAGMENTS.map((f) => [f.id, f]));
const textOf = (id: string) => FRAGMENT_BY_ID.get(id)?.text ?? '';
const slotOf = (id: string) => FRAGMENT_BY_ID.get(id)?.slot;
const candidatesForSlot = (slot: SentenceSlot) =>
  SENTENCE_RECONSTRUCTION_FRAGMENTS.filter((f) => f.slot === slot);

/**
 * A short archive-style code for a candidate — "A-1", "B-3" — on the same
 * visual footing as this exhibition's other catalogue marks (LIGHT's "RULE
 * 01", SOUND's "SOUND 01"). Purely presentational: it exists so a candidate
 * reads as one numbered line pulled from a record rather than an option in a
 * form, and nothing downstream (tracking, the store) ever sees it — the
 * fragment's real id is still what every event and every saved answer names.
 */
const SLOT_LETTER: Record<SentenceSlot, string> = { 1: 'A', 2: 'B', 3: 'C' };

function codeOf(id: string): string {
  const fragment = FRAGMENT_BY_ID.get(id);
  if (!fragment) return '';
  const index = candidatesForSlot(fragment.slot).findIndex((f) => f.id === id);
  return `${SLOT_LETTER[fragment.slot]}-${index + 1}`;
}

/**
 * How the Zone reads its own record back, in development.
 *
 * Named values rather than raw events, as in the other three Zones. Fragment
 * ids are shown as they are recorded rather than as words: what is being
 * checked is the log, and the log speaks in ids. `finalSentence` here reads
 * in *insertion* order — the log's own order — which is not necessarily the
 * slot order (01 · 변화 → 02 · 흔적 → 03 · 결과) the stored answer uses; see
 * handleConfirm, which reorders by slot before writing to the store.
 */
function readSentenceTracking(record: SceneBehaviorRecord) {
  const summary = summarizeSentence(record);
  return {
    events: record.events,

    dwellMsByFragment: summary.dwellMsByFragment,
    viewCountByFragment: summary.viewCountByFragment,
    revisitCountByFragment: summary.revisitCountByFragment,
    viewPath: summary.viewPath,
    firstViewedFragment: summary.firstViewedFragment,
    longestViewedFragment: summary.longestViewedFragment,
    viewedButUnusedFragments: summary.viewedButUnusedFragments,
    hasViewData: summary.hasViewData,

    operations: summary.operations,
    finalFragments: summary.finalFragments,
    finalSentence: summary.finalFragments.map(textOf).join(' '),
    addPath: summary.addPath,
    removePath: summary.removePath,
    reorders: summary.operations.filter((op) => op.kind === 'reorder'),
    addCount: summary.addCount,
    removeCount: summary.removeCount,
    reorderCount: summary.reorderCount,
    rewriteCount: summary.rewriteCount,
    constructionChangeCount: summary.constructionChangeCount,

    returnedFragments: summary.returnedFragments,
    removedThenReturnedFragments: summary.removedThenReturnedFragments,
    fragmentReturnCount: summary.fragmentReturnCount,

    msToFirstFragment: summary.msToFirstFragment,
    msToFirstAdd: summary.msToFirstAdd,
    constructionTime: summary.constructionTime,
    msToFirstValidSentence: summary.msToFirstValidSentence,
    msFromLastEditToCommit: summary.msFromLastEditToCommit,

    firstValidAt: summary.firstValidAt,
    editsAfterFirstValidSentence: summary.editsAfterFirstValidSentence,
    becameValidCount: summary.becameValidCount,

    patterns: detectSentencePatterns(summary),
    thresholds: SENTENCE_THRESHOLDS,
    summary,
  };
}

type Phase = 'zoneIntro' | 'context' | 'reconstruct';

export function SentenceCluesScene() {
  const lightArchive = useExperienceStore((s) => s.lightArchive);
  const soundClues = useExperienceStore((s) => s.soundClues);
  const memorySketch = useExperienceStore((s) => s.memorySketch);
  const setSentenceClues = useExperienceStore((s) => s.setSentenceClues);
  const completeScene = useExperienceStore((s) => s.completeScene);
  const tracking = useSceneTracking('sentenceClues', SENTENCE_TRACKING_GROUPS, {
    debugView: readSentenceTracking,
  });

  /*
    LIGHT/SOUND/MEMORY's final answers only — never a raw event or a Scene
    Summary. See src/lib/sentenceNarrative.ts's module doc for why that
    boundary is load-bearing here, not just tidy: Cross-Scene reads this
    Zone's *behaviour* through summarizeSentence/detectSentencePatterns
    exactly as before, entirely unaware this content layer exists.
  */
  const narrative = useMemo(
    () => buildSentenceNarrativeContext(lightArchive, soundClues, memorySketch),
    [lightArchive, soundClues, memorySketch],
  );

  const [phase, setPhase] = useState<Phase>('zoneIntro');
  /** The reconstruction, as fragment ids in whatever order they were chosen —
   *  not necessarily slot order. See handleConfirm for where that matters. */
  const [fragments, setFragments] = useState<string[]>([]);
  /*
    Held where it can be read back the instant it changes — see the original
    note this preserves: a functional updater would double-record under
    StrictMode, and the rendered value lags a tick behind two operations run
    in the same handler (swapping a slot's choice is exactly that: a remove
    immediately followed by an add).
  */
  const fragmentsRef = useRef<string[]>([]);

  function setSentence(next: string[]) {
    fragmentsRef.current = next;
    setFragments(next);
  }

  const isValid = fragments.length >= SENTENCE_MIN_FRAGMENTS;

  useEffect(() => {
    // Recovered Context is a reading step and records nothing — see the
    // module doc on tracking boundaries. The group opens only once the
    // Reconstruction step itself is in front of the visitor, exactly the
    // moment `msToFirstFragment` and friends are supposed to measure from.
    if (phase !== 'reconstruct') return;
    tracking.openGroup(SENTENCE_GROUP);
  }, [phase, tracking]);

  // Recorded the first time the record could be submitted. What the wait before
  // submitting is measured from — without it, a visitor who spent a minute on a
  // two-fragment sentence would read as having hesitated over a decision the
  // Zone had not yet let them make.
  useEffect(() => {
    if (isValid) tracking.advanceReady();
  }, [isValid, tracking]);

  useEffect(
    () => () => {
      tracking.save();
    },
    [tracking],
  );

  /* ── Building the reconstruction ────────────────────────────────────────── */

  function addFragment(fragmentId: string) {
    const current = fragmentsRef.current;
    // One scrap, one piece: a fragment already chosen cannot be added again.
    if (current.includes(fragmentId)) return;
    if (current.length >= SENTENCE_MAX_FRAGMENTS) return;
    const index = current.length;
    setSentence([...current, fragmentId]);
    tracking.fragmentAdd(SENTENCE_GROUP, fragmentId, index);
  }

  function removeFragment(fragmentId: string) {
    const current = fragmentsRef.current;
    const index = current.indexOf(fragmentId);
    if (index === -1) return;
    setSentence(current.filter((id) => id !== fragmentId));
    tracking.fragmentRemove(SENTENCE_GROUP, fragmentId, index);
  }

  /**
   * Choosing a candidate for a slot.
   *
   * A slot holds one fragment at a time, so picking a second candidate for a
   * slot that already has one is a swap: the fragment there is removed, then
   * the new one is added. Both are ordinary fragmentRemove/fragmentAdd
   * operations, in the same log every other Zone-pattern already reads — a
   * swap is simply a remove immediately followed by an add, which is exactly
   * what REPEATED_REWRITE and FRAGMENT_RETURN already know how to see.
   */
  function selectCandidate(fragment: SentenceReconstructionFragment) {
    const current = fragmentsRef.current;
    if (current.includes(fragment.id)) return;
    const occupied = current.find((id) => slotOf(id) === fragment.slot);
    if (occupied) removeFragment(occupied);
    addFragment(fragment.id);
  }

  /* ── Leaving ────────────────────────────────────────────────────────────── */

  function handleConfirm() {
    if (!isValid) return;
    tracking.commit(SENTENCE_GROUP);

    const summary = summarizeSentence(tracking.snapshot());
    // Slot order (01 → 02 → 03), not the order the fragments happened to be
    // chosen in — a candidate picked for slot 3 before slot 1 must still
    // read as slot 1's line first. The tracked operation log keeps pick
    // order, exactly as it always has; only the stored, readable sentence is
    // reordered here.
    const orderedIds = SENTENCE_SLOTS.map((slot) =>
      fragments.find((id) => slotOf(id) === slot),
    ).filter((id): id is string => Boolean(id));
    const fragmentTexts = orderedIds.map(textOf);
    /*
      The older shape the Final Report reads, filled from what the Zone now
      asks. The assembled sentence goes in as the visitor's own sentence, which
      is what it is; the fragment texts go in as its parts. Both are derived
      here rather than accumulated as the visitor went, so the answer and the
      behavioural record come from one source.
    */
    setSentenceClues({
      selectedSentenceIds: orderedIds,
      selectedSentences: fragmentTexts,
      customSentence: fragmentTexts.join(' '),
      dwellTimes: summary.dwellMsByFragment,
      selectionOrder: orderedIds,
      repeatedKeywords: extractRepeatedKeywords(fragmentTexts),
    });
    tracking.save();
    logSceneTracking('sentenceClues', tracking, readSentenceTracking);
    playClueRecordedSignature();
    completeScene('sentenceClues');
  }

  if (phase === 'zoneIntro') {
    return (
      <ZoneIntroCard
        zone="ZONE 08"
        title="문장의 흔적"
        subtitle="사람의 기억은, 결국 글자로 남는 법."
        ctaLabel="조사 시작"
        onContinue={() => setPhase('context')}
      />
    );
  }

  if (phase === 'context') {
    return (
      <div className="sentence-clues-scene sentence-clues-scene--context">
        <p className="sentence-clues-scene__kicker">복원된 기록</p>
        <div className="sentence-clues-scene__context-paragraphs">
          {narrative.paragraphs.map((paragraph, index) => (
            <p
              key={index}
              className="sentence-clues-scene__context-p"
              style={{ animationDelay: `${index * 0.4}s` }}
            >
              {paragraph}
            </p>
          ))}
        </div>

        <div className="sentence-clues-scene__missing">
          <span className="sentence-clues-scene__missing-mark" aria-hidden="true" />
          <p className="sentence-clues-scene__missing-text">{narrative.missingSegmentText}</p>
        </div>

        <p className="sentence-clues-scene__prompt">{narrative.promptText}</p>
        <p className="sentence-clues-scene__instruction">{narrative.instructionText}</p>

        <button
          className="sentence-clues-scene__confirm"
          onClick={() => setPhase('reconstruct')}
        >
          <TerminalCorners />
          복원 시작
        </button>
      </div>
    );
  }

  return (
    <div className="sentence-clues-scene">
      <p className="sentence-clues-scene__hint">
        기록이 끊긴 이후를, 세 개의 조각으로 복원하세요.
      </p>

      <div className="sentence-clues-scene__workspace">
        <section className="sentence-clues-scene__panel sentence-clues-scene__panel--result">
          <p className="sentence-clues-scene__panel-label">복원 중인 기록</p>
          <div className="sentence-clues-scene__restore" role="list" aria-label="복원 중인 기록">
            {SENTENCE_SLOTS.map((slot) => {
              const chosenId = fragments.find((id) => slotOf(id) === slot);
              return (
                <div key={slot} className="sentence-clues-scene__slot-line" role="listitem">
                  <span className="sentence-clues-scene__slot-index">{String(slot).padStart(2, '0')}</span>
                  {chosenId ? (
                    <span className="sentence-clues-scene__slot-chip">
                      <span className="sentence-clues-scene__slot-chip-mark" aria-hidden="true">
                        {codeOf(chosenId)}
                      </span>
                      <span className="sentence-clues-scene__slot-chip-text">{textOf(chosenId)}</span>
                      <button
                        type="button"
                        className="sentence-clues-scene__chip-drop"
                        aria-label={`${textOf(chosenId)} 제거`}
                        onClick={() => removeFragment(chosenId)}
                      >
                        ×
                      </button>
                    </span>
                  ) : (
                    <span className="sentence-clues-scene__slot-placeholder" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="sentence-clues-scene__panel sentence-clues-scene__panel--fragments">
          <p className="sentence-clues-scene__panel-label">선택 가능한 조각</p>
          <div className="sentence-clues-scene__slots">
            {SENTENCE_SLOTS.map((slot) => (
              <div key={slot} className="sentence-clues-scene__slot-group">
                <p className="sentence-clues-scene__slot-label">
                  {String(slot).padStart(2, '0')} · {SENTENCE_SLOT_LABELS[slot]}
                </p>
                <div className="sentence-clues-scene__archive">
                  {candidatesForSlot(slot).map((fragment) => {
                    const used = fragments.includes(fragment.id);
                    return (
                      <button
                        key={fragment.id}
                        type="button"
                        className={`sentence-clues-scene__fragment${
                          used ? ' sentence-clues-scene__fragment--used' : ''
                        }`}
                        /*
                          Looking and taking are separate acts, and every candidate
                          in a slot is on screen at once — so what counts as reading
                          one is the pointer resting on it, never it being visible.
                          Focus is bound the same way so a keyboard visitor is
                          recorded on the same terms as a pointer one.
                        */
                        onPointerEnter={() => tracking.viewStart(SENTENCE_GROUP, fragment.id)}
                        onPointerLeave={() => tracking.viewEnd(SENTENCE_GROUP, fragment.id)}
                        onFocus={() => tracking.viewStart(SENTENCE_GROUP, fragment.id)}
                        onBlur={() => tracking.viewEnd(SENTENCE_GROUP, fragment.id)}
                        onClick={() => selectCandidate(fragment)}
                        disabled={used}
                      >
                        <span className="sentence-clues-scene__fragment-mark" aria-hidden="true">
                          {codeOf(fragment.id)}
                        </span>
                        <span className="sentence-clues-scene__fragment-text">{fragment.text}</span>
                        {used ? (
                          <span className="sentence-clues-scene__fragment-status">채택됨</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="sentence-clues-scene__submit">
        {isValid ? (
          <>
            <span className="sentence-clues-scene__submit-note">문장이 완성되었습니다.</span>
            <button className="sentence-clues-scene__confirm" onClick={handleConfirm}>
              <TerminalCorners />
              기록 확정
            </button>
          </>
        ) : (
          <span className="sentence-clues-scene__submit-note">세 개의 조각을 선택하세요.</span>
        )}
      </div>
    </div>
  );
}
