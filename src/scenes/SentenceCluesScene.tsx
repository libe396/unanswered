import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MEMORY_ROOM_OBJECTS,
  SOUND_CLUES,
  SENTENCE_MAX_FRAGMENTS,
  SENTENCE_MIN_FRAGMENTS,
  SENTENCE_MIN_NON_ENDING_BEFORE_ENDING,
  SENTENCE_RECONSTRUCTION_FRAGMENTS,
} from '../data/content';
import type { SentenceReconstructionFragment } from '../data/content';
import { useExperienceStore } from '../store/experienceStore';
import { logSceneTracking, useSceneTracking } from '../hooks/useSceneTracking';
import { detectSentencePatterns } from '../lib/sentencePatterns';
import { playClueRecordedSignature, startFinalReportBgmLayer } from '../lib/postElevatorAudio';
import {
  SENTENCE_GROUP,
  SENTENCE_TRACKING_GROUPS,
  deriveSentenceBehavioralTrace,
  summarizeSentence,
} from '../lib/sentenceTracking';
import { SENTENCE_THRESHOLDS } from '../lib/sentenceThresholds';
import { buildSentenceNarrativeContext } from '../lib/sentenceNarrative';
import {
  NO_TARGET_MESSAGE,
  findQuestionTarget,
  generateFragmentQuestion,
  synthesizeRestoredLine,
  type SentenceQuestionResult,
} from '../lib/sentenceQuestionService';
import { ZoneIntroCard } from '../components/ZoneIntroCard';
import { StageActions, StageHeader } from '../components/StageHeader';
import { ZONE_INFO } from '../data/zones';
import type { SceneBehaviorRecord, SentenceBehavioralTrace } from '../types';
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
const roleOf = (id: string) => FRAGMENT_BY_ID.get(id)?.narrativeRole;

/** A short archive-style code — "01".."20" — on the same visual footing as
 *  this exhibition's other catalogue marks (LIGHT's "RULE 01", SOUND's
 *  "SOUND 01"). Purely presentational: nothing downstream (tracking, the
 *  store) ever sees it. */
function archiveCodeOf(fragmentId: string): string {
  const index = SENTENCE_RECONSTRUCTION_FRAGMENTS.findIndex((f) => f.id === fragmentId);
  return String(index + 1).padStart(2, '0');
}

/** Non-`ending` fragments first, in draw order, `ending` fragments last, in
 *  their own draw order — the one reordering this Zone still does, applied
 *  only where the visitor actually reads the account (Reconstruction,
 *  Restored Record), never to the live tray while still drawing. */
function orderedForReading(drawnIds: readonly string[]): string[] {
  const nonEnding = drawnIds.filter((id) => roleOf(id) !== 'ending');
  const ending = drawnIds.filter((id) => roleOf(id) === 'ending');
  return [...nonEnding, ...ending];
}

const RESPONSE_MAX_LENGTH = 100;
const DISCOVERING_MIN_MS = 900;
const DEFAULT_DISCOVERING_TEXT = '아직 확인되지 않은 부분이 있습니다.';

function traceMessage(trace: SentenceBehavioralTrace): string {
  switch (trace.type) {
    case 'long_unselected_dwell': {
      const seconds = (trace.dwellMs / 1000).toFixed(1);
      return `선택하지 않은 기록 하나에 ${seconds}초 동안 머물렀습니다.`;
    }
    case 'selected_then_removed':
      return '한 번 꺼낸 기록을 다시 돌려놓았습니다.';
    case 'removed_then_reselected':
      return '한 번 돌려놓은 기록을 다시 꺼냈습니다.';
    case 'repeat_hover':
      return `같은 기록을 ${trace.revisitCount + 1}번 다시 확인했습니다.`;
    case 'long_selected_dwell':
      return '이 기록 앞에서 조금 더 오래 머물렀습니다.';
    default:
      return '';
  }
}

/**
 * How the Zone reads its own record back, in development.
 *
 * Named values rather than raw events, as in the other three Zones. Fragment
 * ids are shown as they are recorded rather than as words: what is being
 * checked is the log, and the log speaks in ids.
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
    addCount: summary.addCount,
    removeCount: summary.removeCount,
    rewriteCount: summary.rewriteCount,
    constructionChangeCount: summary.constructionChangeCount,

    returnedFragments: summary.returnedFragments,
    removedThenReturnedFragments: summary.removedThenReturnedFragments,
    fragmentReturnCount: summary.fragmentReturnCount,
    addedButDroppedFragments: summary.addedButDroppedFragments,

    msToFirstFragment: summary.msToFirstFragment,
    msToFirstAdd: summary.msToFirstAdd,
    constructionTime: summary.constructionTime,
    msToFirstValidSentence: summary.msToFirstValidSentence,
    msFromLastEditToCommit: summary.msFromLastEditToCommit,

    firstValidAt: summary.firstValidAt,
    editsAfterFirstValidSentence: summary.editsAfterFirstValidSentence,
    becameValidCount: summary.becameValidCount,

    behavioralTrace: deriveSentenceBehavioralTrace(summary),

    patterns: detectSentencePatterns(summary),
    thresholds: SENTENCE_THRESHOLDS,
    summary,
  };
}

type Phase =
  | 'zoneIntro'
  | 'context'
  | 'explore'
  | 'reconstruction'
  | 'discovering'
  | 'question'
  | 'restoredRecord'
  | 'behavioralTrace';

export function SentenceCluesScene() {
  const lightArchive = useExperienceStore((s) => s.lightArchive);
  const soundClues = useExperienceStore((s) => s.soundClues);
  const memorySketch = useExperienceStore((s) => s.memorySketch);
  const storedSentenceClues = useExperienceStore((s) => s.sentenceClues);
  const setSentenceClues = useExperienceStore((s) => s.setSentenceClues);
  const completeScene = useExperienceStore((s) => s.completeScene);
  const tracking = useSceneTracking('sentenceClues', SENTENCE_TRACKING_GROUPS, {
    debugView: readSentenceTracking,
  });

  /*
    LIGHT/SOUND/MEMORY's final answers only — never a raw event or a Scene
    Summary. See src/lib/sentenceNarrative.ts's module doc for why that
    boundary is load-bearing here, not just tidy.
  */
  const narrative = useMemo(
    () => buildSentenceNarrativeContext(lightArchive, soundClues, memorySketch),
    [lightArchive, soundClues, memorySketch],
  );

  const [phase, setPhase] = useState<Phase>('zoneIntro');
  const enteredAtRef = useRef(Date.now());

  /** The visitor's drawn cards, in draw order — this *is* the account's
   *  order now, `ending` fragments aside (see `orderedForReading`). Seeded
   *  from any answer this visit already saved — handleComplete() below
   *  always writes whatever this holds, so without this, Back navigation
   *  and forward again would silently overwrite a real earlier answer with
   *  an empty one. A first-ever visit has no prior `sentenceClues`, so this
   *  falls back to empty exactly as before. */
  const [fragments, setFragments] = useState<string[]>(() => storedSentenceClues.selectedSentenceIds);
  /*
    Held where it can be read back the instant it changes — a functional
    updater would double-record under StrictMode, and the rendered value lags
    a tick behind an operation and whatever reads it in the same handler.
  */
  const fragmentsRef = useRef<string[]>(storedSentenceClues.selectedSentenceIds);

  function setDrawn(next: string[]) {
    fragmentsRef.current = next;
    setFragments(next);
  }

  const isValid = fragments.length >= SENTENCE_MIN_FRAGMENTS;
  const isFull = fragments.length >= SENTENCE_MAX_FRAGMENTS;
  const nonEndingDrawnCount = fragments.filter((id) => roleOf(id) !== 'ending').length;

  function isEndingLocked(fragment: SentenceReconstructionFragment): boolean {
    return fragment.narrativeRole === 'ending' && nonEndingDrawnCount < SENTENCE_MIN_NON_ENDING_BEFORE_ENDING;
  }

  /* ── The question and the response ──────────────────────────────────────── */
  const [questionResult, setQuestionResult] = useState<SentenceQuestionResult | null>(null);
  const [responseText, setResponseText] = useState(() => storedSentenceClues.responseText);
  const [responseSkipped, setResponseSkipped] = useState(() => storedSentenceClues.responseSkipped);
  // Set only when findQuestionTarget found no candidate at all — a separate
  // fact from responseSkipped, which means the *visitor* declined to answer
  // a real question. See SentenceCluesData.noQuestionAvailable's doc.
  const [noQuestionAvailable, setNoQuestionAvailable] = useState(() => storedSentenceClues.noQuestionAvailable);
  const [discoveringMessage, setDiscoveringMessage] = useState(DEFAULT_DISCOVERING_TEXT);
  const responseEditCountRef = useRef(0);
  const responseDeleteCountRef = useRef(0);
  const responseLengthRef = useRef(0);
  const [behavioralTrace, setBehavioralTrace] = useState<SentenceBehavioralTrace | null>(null);

  useEffect(() => {
    // Recovered Context is a reading step and records nothing. The group
    // opens once Explore itself is in front of the visitor, exactly the
    // moment `msToFirstFragment` and friends are supposed to measure from.
    if (phase !== 'explore') return;
    tracking.openGroup(SENTENCE_GROUP);
  }, [phase, tracking]);

  // Recorded the first time the collection could move on. What the wait
  // before submitting is measured from — without it, a visitor who spent a
  // minute on a two-fragment collection would read as having hesitated over
  // a decision the Zone had not yet let them make.
  useEffect(() => {
    if (isValid) tracking.advanceReady();
  }, [isValid, tracking]);

  useEffect(
    () => () => {
      tracking.save();
    },
    [tracking],
  );

  /* ── Explore: drawing cards from the archive ────────────────────────────── */

  function drawFragment(fragmentId: string) {
    const current = fragmentsRef.current;
    if (current.includes(fragmentId)) return;
    if (current.length >= SENTENCE_MAX_FRAGMENTS) return;
    const index = current.length;
    setDrawn([...current, fragmentId]);
    tracking.fragmentAdd(SENTENCE_GROUP, fragmentId, index);
  }

  function returnFragment(fragmentId: string) {
    const current = fragmentsRef.current;
    const index = current.indexOf(fragmentId);
    if (index === -1) return;
    setDrawn(current.filter((id) => id !== fragmentId));
    tracking.fragmentRemove(SENTENCE_GROUP, fragmentId, index);
  }

  /** A card in the archive is a plain toggle — drawn, or returned. */
  function toggleFragment(fragment: SentenceReconstructionFragment) {
    if (fragmentsRef.current.includes(fragment.id)) {
      returnFragment(fragment.id);
    } else {
      drawFragment(fragment.id);
    }
  }

  function handleExploreNext() {
    if (!isValid) return;
    // Collecting ends here — every fragmentAdd/fragmentRemove up to this
    // moment is one closed question, and everything POST_SENTENCE_HESITATION
    // and msFromLastEditToCommit read is measured against this commit. No
    // step after this one changes which fragments were drawn.
    tracking.commit(SENTENCE_GROUP);
    startFinalReportBgmLayer();
    setPhase('reconstruction');
  }

  /* ── Discovering: finding the one thing left to ask about ───────────────── */

  useEffect(() => {
    if (phase !== 'discovering') return;
    let cancelled = false;
    setDiscoveringMessage(DEFAULT_DISCOVERING_TEXT);
    const target = findQuestionTarget(fragmentsRef.current, FRAGMENT_BY_ID);
    const minDelay = new Promise<void>((resolve) => {
      window.setTimeout(resolve, DISCOVERING_MIN_MS);
    });

    if (!target) {
      // Shown in place of the default line for the same minimum stretch —
      // never an abrupt cut straight to Restored Record. Not the visitor's
      // skip: `responseSkipped` stays exactly what it already was.
      setDiscoveringMessage(NO_TARGET_MESSAGE);
      minDelay.then(() => {
        if (cancelled) return;
        setQuestionResult({ fragmentId: null, openSlot: null, question: NO_TARGET_MESSAGE, source: null });
        setNoQuestionAvailable(true);
        setPhase('restoredRecord');
      });
      return () => {
        cancelled = true;
      };
    }

    Promise.all([generateFragmentQuestion(target), minDelay]).then(([result]) => {
      if (cancelled) return;
      setQuestionResult(result);
      setPhase('question');
    });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  /* ── Question: a short response, or none ────────────────────────────────── */

  function handleResponseChange(value: string) {
    const prevLength = responseLengthRef.current;
    if (value.length > prevLength) responseEditCountRef.current += 1;
    else if (value.length < prevLength) responseDeleteCountRef.current += 1;
    responseLengthRef.current = value.length;
    setResponseText(value);
  }

  function proceedFromQuestion(skip: boolean) {
    const trimmed = responseText.trim();
    const skipped = skip || trimmed.length === 0;
    setResponseSkipped(skipped);
    if (skipped) setResponseText('');
    else setResponseText(trimmed);
    setPhase('restoredRecord');
  }

  /* ── Restored Record → Behavioral Trace ─────────────────────────────────── */

  function handleRestoredRecordNext() {
    const trace = deriveSentenceBehavioralTrace(summarizeSentence(tracking.snapshot()));
    setBehavioralTrace(trace);
    setPhase('behavioralTrace');
  }

  function handleComplete() {
    const record = tracking.snapshot();
    const summary = summarizeSentence(record);
    const orderedIds = fragmentsRef.current;
    const fragmentTexts = orderedIds.map(textOf);

    setSentenceClues({
      selectedSentenceIds: orderedIds,
      selectedSentences: fragmentTexts,
      customSentence: fragmentTexts.join(' '),
      dwellTimes: summary.dwellMsByFragment,
      selectionOrder: orderedIds,
      repeatedKeywords: extractRepeatedKeywords(fragmentTexts),
      questionTargetFragmentId: questionResult?.fragmentId ?? null,
      questionOpenSlot: questionResult?.openSlot ?? null,
      generatedQuestion: questionResult?.fragmentId ? questionResult.question : '',
      questionSource: questionResult?.source ?? null,
      responseText: responseSkipped ? '' : responseText,
      responseSkipped,
      noQuestionAvailable,
      responseEditCount: responseEditCountRef.current,
      responseDeleteCount: responseDeleteCountRef.current,
      behavioralTrace,
      sceneDurationMs: Date.now() - enteredAtRef.current,
    });
    tracking.save();
    logSceneTracking('sentenceClues', tracking, readSentenceTracking);
    playClueRecordedSignature();
    completeScene('sentenceClues');
  }

  /* ── zoneIntro / context ─────────────────────────────────────────────────── */

  if (phase === 'zoneIntro') {
    return (
      <ZoneIntroCard
        zone={ZONE_INFO.sentenceClues.zone}
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
        <aside className="sentence-clues-scene__clue-summary" aria-labelledby="collected-clues-title">
          <h2 id="collected-clues-title">이전 공간에서 수집한 단서</h2>
          <dl>
            <dt>색의 흔적</dt>
            <dd>{lightArchive ? <div className="sentence-clues-scene__swatches">{lightArchive.rules.palette.map((color, index) => <span key={`${color}-${index}`} style={{ backgroundColor: color }} role="img" aria-label={color} title={color} />)}</div> : '남겨진 색이 없습니다.'}</dd>
            <dt>소리의 흔적</dt>
            <dd>{SOUND_CLUES.find((sound) => sound.id === soundClues.selectedSoundId)?.label ?? soundClues.selectedSoundId ?? '선택한 소리가 없습니다.'}</dd>
            <dt>사물의 흔적</dt>
            <dd>{memorySketch.selectedObjects.length ? <ul>{memorySketch.selectedObjects.map((id) => <li key={id}>{MEMORY_ROOM_OBJECTS.find((object) => object.id === id)?.label ?? id}</li>)}</ul> : '선택한 사물이 없습니다.'}</dd>
          </dl>
        </aside>
        <div className="sentence-clues-scene__context-reading">
        <p className="sentence-clues-scene__reading-eyebrow">RESTORED RECORD</p>

        {/* Numbered, so the gap below reads as a missing line of a record
            rather than as a paragraph break. */}
        <div className="sentence-clues-scene__context-paragraphs glass scroll-quiet">
          {narrative.paragraphs.map((paragraph, index) => (
            <p
              key={index}
              className="sentence-clues-scene__context-p"
              style={{ animationDelay: `${index * 0.4}s` }}
            >
              <span className="sentence-clues-scene__context-index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="sentence-clues-scene__context-body">{paragraph}</span>
            </p>
          ))}
        </div>

        {/* One break in the record: two dashed rules and the line itself. The
            old interrupted solid rule sat inside this block as well, which read
            as two different dividers stacked. */}
        <div className="sentence-clues-scene__missing">
          <p className="sentence-clues-scene__missing-text">{narrative.missingSegmentText}</p>
        </div>

        <h2 className="sentence-clues-scene__prompt">{narrative.promptText}</h2>
        <p className="sentence-clues-scene__instruction">{narrative.instructionText}</p>

        <button className="cta cta--primary sentence-clues-scene__confirm" onClick={() => setPhase('explore')}>
          탐색 시작
        </button>
        </div>
      </div>
    );
  }

  /* ── explore: the archive wall ─────────────────────────────────────────────
     One screen, three bands: the heading, the card grid, and the fixed foot
     (slot row + action row). Only the grid scrolls — the heading can never
     slide under BackButton/ZoneLabel, and the CTA can never drift into the
     ArchiveHUD. */

  if (phase === 'explore') {
    return (
      <div className="sentence-clues-scene sentence-clues-scene--explore">
        <StageHeader
          eyebrow="SENTENCE CLUES"
          title="그 사람에게 이후 어떤 일이 있었을까요?"
          description={`전체 기록을 살펴보고, 가능하다고 생각되는 문장을 ${SENTENCE_MIN_FRAGMENTS}–${SENTENCE_MAX_FRAGMENTS}개 골라 주세요.`}
        />

        <div className="sentence-clues-scene__wall scroll-quiet" aria-label="전체 문장 기록">
          {SENTENCE_RECONSTRUCTION_FRAGMENTS.map((fragment) => {
            const drawn = fragments.includes(fragment.id);
            const locked = !drawn && isEndingLocked(fragment);
            return (
              <button
                key={fragment.id}
                type="button"
                className={`sentence-clues-scene__card${drawn ? ' sentence-clues-scene__card--drawn' : ''}${
                  locked ? ' sentence-clues-scene__card--locked' : ''
                }`}
                onPointerEnter={() => tracking.viewStart(SENTENCE_GROUP, fragment.id)}
                onPointerLeave={() => tracking.viewEnd(SENTENCE_GROUP, fragment.id)}
                onFocus={() => tracking.viewStart(SENTENCE_GROUP, fragment.id)}
                onBlur={() => tracking.viewEnd(SENTENCE_GROUP, fragment.id)}
                onClick={() => toggleFragment(fragment)}
                disabled={!drawn && (isFull || locked)}
                aria-pressed={drawn}
                title={locked ? '다른 기록을 2개 고르면 선택할 수 있습니다.' : undefined}
              >
                <span className="sentence-clues-scene__card-code" aria-hidden="true">
                  {archiveCodeOf(fragment.id)}
                  {locked ? <span className="sentence-clues-scene__card-lock">LOCKED</span> : null}
                </span>
                <span className="sentence-clues-scene__card-text">{fragment.text}</span>
              </button>
            );
          })}
        </div>

        <div className="sentence-clues-scene__foot">
          {/* The slot row *is* the selection order — which is why a drawn card
              leaves only a dashed gap in the grid and carries no "✓ 1" badge. */}
          <div className="sentence-clues-scene__slots glass" aria-label="선택한 기록">
            {Array.from({ length: SENTENCE_MAX_FRAGMENTS }, (_, index) => {
              const id = fragments[index];
              if (!id) {
                return (
                  <div
                    key={`slot-${index}`}
                    className="sentence-clues-scene__slot sentence-clues-scene__slot--empty"
                  >
                    <span className="sentence-clues-scene__slot-num" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                );
              }
              return (
                <div key={id} className="sentence-clues-scene__slot sentence-clues-scene__slot--filled">
                  <span className="sentence-clues-scene__slot-num" aria-hidden="true">
                    {archiveCodeOf(id)}
                  </span>
                  <span className="sentence-clues-scene__slot-text">{textOf(id)}</span>
                  <button
                    type="button"
                    className="sentence-clues-scene__slot-clear"
                    onClick={() => returnFragment(id)}
                    aria-label={`${index + 1}번째 기록: ${textOf(id)} · 선택 해제`}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              );
            })}
          </div>

          <StageActions
            info={
              <p className="metric sentence-clues-scene__count" role="status">
                <span className="metric__value">
                  {String(fragments.length).padStart(2, '0')} / {String(SENTENCE_MAX_FRAGMENTS).padStart(2, '0')}
                </span>
                <span className="metric__label">
                  {nonEndingDrawnCount < SENTENCE_MIN_NON_ENDING_BEFORE_ENDING
                    ? '17–20번은 다른 기록 2개를 고르면 열립니다.'
                    : isFull
                      ? '다른 문장을 고르려면 선택한 기록을 해제하세요.'
                      : isValid
                        ? '선택한 문장을 다시 누르면 해제됩니다.'
                        : '세 개 이상 꺼내주세요.'}
                </span>
              </p>
            }
          >
            <button className="cta cta--primary" onClick={handleExploreNext} disabled={!isValid}>
              다음으로
            </button>
          </StageActions>
        </div>
      </div>
    );
  }

  /* ── reconstruction: what was drawn, read as one account ─────────────────── */

  if (phase === 'reconstruction') {
    const ordered = orderedForReading(fragments);
    return (
      <div className="sentence-clues-scene sentence-clues-scene--reading">
        <h1 className="sentence-clues-scene__reading-title">선택한 기록</h1>

        <div className="sentence-clues-scene__account scroll-quiet">
          {ordered.map((id) => (
            <p key={id} className="sentence-clues-scene__account-line">
              <span className="sentence-clues-scene__account-index">{archiveCodeOf(id)}</span>
              <span>{textOf(id)}</span>
            </p>
          ))}
        </div>

        <button className="cta cta--primary sentence-clues-scene__confirm" onClick={() => setPhase('discovering')}>
          다음으로
        </button>
      </div>
    );
  }

  /* ── discovering ──────────────────────────────────────────────────────────── */

  if (phase === 'discovering') {
    return (
      <div className="sentence-clues-scene sentence-clues-scene--discovering">
        <p className="sentence-clues-scene__discovering-text" key={discoveringMessage}>
          {discoveringMessage}
        </p>
      </div>
    );
  }

  /* ── question: the one fragment with something left to ask ─────────────── */

  if (phase === 'question' && questionResult?.fragmentId) {
    const targetFragment = FRAGMENT_BY_ID.get(questionResult.fragmentId);
    return (
      <div className="sentence-clues-scene sentence-clues-scene--reading sentence-clues-scene--question">
        <h1 className="sentence-clues-scene__reading-title">이 기록에 남은 빈칸</h1>
        {targetFragment ? (
          <p className="sentence-clues-scene__account-line"><span className="sentence-clues-scene__account-index">{archiveCodeOf(targetFragment.id)}</span><span>{targetFragment.text}</span></p>
        ) : null}
        <h2 className="sentence-clues-scene__question">{questionResult.question}</h2>

        <div className="sentence-clues-scene__response-field">
          <textarea
            rows={3}
            className="sentence-clues-scene__response-input"
            value={responseText}
            maxLength={RESPONSE_MAX_LENGTH}
            placeholder="떠오르는 말이 있다면 짧게 남겨 주세요."
            onChange={(event) => handleResponseChange(event.target.value)}
            aria-label={questionResult.question}
          />
          <span className="sentence-clues-scene__response-count">
            {responseText.length} / {RESPONSE_MAX_LENGTH}
          </span>
        </div>

        <div className="sentence-clues-scene__submit">
          <button
            type="button"
            className="sentence-clues-scene__edit"
            onClick={() => proceedFromQuestion(true)}
          >
            기록하지 않는다
          </button>
          <button className="cta cta--primary sentence-clues-scene__confirm" onClick={() => proceedFromQuestion(false)}>
            다음으로
          </button>
        </div>
      </div>
    );
  }

  /* ── restoredRecord ───────────────────────────────────────────────────────── */

  if (phase === 'restoredRecord') {
    const ordered = orderedForReading(fragments);
    const targetId = questionResult?.fragmentId ?? null;
    return (
      <div className="sentence-clues-scene sentence-clues-scene--reading">
        <h1 className="sentence-clues-scene__reading-title">복원된 기록</h1>

        <div className="sentence-clues-scene__account sentence-clues-scene__account--final scroll-quiet">
          {ordered.map((id) => {
            const targetFragment = id === targetId ? FRAGMENT_BY_ID.get(id) : undefined;
            const line =
              targetFragment && !responseSkipped && responseText.trim()
                ? synthesizeRestoredLine(targetFragment, responseText)
                : textOf(id);
            return (
              <p key={id} className="sentence-clues-scene__account-line">
                <span className="sentence-clues-scene__account-index">{archiveCodeOf(id)}</span>
                <span>{line}
                {id === targetId && responseSkipped ? (
                  <span className="sentence-clues-scene__unanswered-mark">· 미응답</span>
                ) : null}</span>
              </p>
            );
          })}
        </div>

        <button className="cta cta--primary sentence-clues-scene__confirm" onClick={handleRestoredRecordNext}>
          다음으로
        </button>
      </div>
    );
  }

  /* ── behavioralTrace ──────────────────────────────────────────────────────── */

  return (
    <div className="sentence-clues-scene">
      <p className="sentence-clues-scene__hint">기록을 남기는 동안, 이런 흔적이 남았습니다.</p>

      <div className="sentence-clues-scene__trace">
        {behavioralTrace ? (
          <>
            <p className="sentence-clues-scene__trace-message">{traceMessage(behavioralTrace)}</p>
            <p className="sentence-clues-scene__trace-fragment">{textOf(behavioralTrace.fragmentId)}</p>
          </>
        ) : (
          <p className="sentence-clues-scene__trace-message">
            이번 기록에서는 특별히 남은 행동 흔적이 없습니다.
          </p>
        )}
      </div>

      <button className="cta cta--primary sentence-clues-scene__confirm" onClick={handleComplete}>
        기록 확정
      </button>
    </div>
  );
}
