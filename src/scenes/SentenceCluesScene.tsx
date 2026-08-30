import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
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
import { TerminalCorners } from '../components/TerminalCorners';
import { ZoneIntroCard } from '../components/ZoneIntroCard';
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
   *  order now, `ending` fragments aside (see `orderedForReading`). */
  const [fragments, setFragments] = useState<string[]>([]);
  /*
    Held where it can be read back the instant it changes — a functional
    updater would double-record under StrictMode, and the rendered value lags
    a tick behind an operation and whatever reads it in the same handler.
  */
  const fragmentsRef = useRef<string[]>([]);

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
  const [responseText, setResponseText] = useState('');
  const [responseSkipped, setResponseSkipped] = useState(false);
  // Set only when findQuestionTarget found no candidate at all — a separate
  // fact from responseSkipped, which means the *visitor* declined to answer
  // a real question. See SentenceCluesData.noQuestionAvailable's doc.
  const [noQuestionAvailable, setNoQuestionAvailable] = useState(false);
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

        <button className="sentence-clues-scene__confirm" onClick={() => setPhase('explore')}>
          <TerminalCorners />
          탐색 시작
        </button>
      </div>
    );
  }

  /* ── explore: the archive wall ───────────────────────────────────────────── */

  if (phase === 'explore') {
    return (
      <div className="sentence-clues-scene sentence-clues-scene--explore">
        <p className="sentence-clues-scene__hint">그 사람에게 이후 어떤 일이 있었을까요?</p>
        <p className="sentence-clues-scene__subhint">가능하다고 생각되는 기록을 하나씩 꺼내 주세요.</p>
        <p className="sentence-clues-scene__count" aria-live="polite">
          {String(fragments.length).padStart(2, '0')} / {String(SENTENCE_MAX_FRAGMENTS).padStart(2, '0')}
        </p>

        <div className="sentence-clues-scene__wall">
          {SENTENCE_RECONSTRUCTION_FRAGMENTS.map((fragment) => {
            const drawn = fragments.includes(fragment.id);
            const locked = !drawn && isEndingLocked(fragment);
            return (
              <button
                key={fragment.id}
                type="button"
                className={`sentence-clues-scene__card${drawn ? ' sentence-clues-scene__card--drawn' : ''}`}
                onPointerEnter={() => tracking.viewStart(SENTENCE_GROUP, fragment.id)}
                onPointerLeave={() => tracking.viewEnd(SENTENCE_GROUP, fragment.id)}
                onFocus={() => tracking.viewStart(SENTENCE_GROUP, fragment.id)}
                onBlur={() => tracking.viewEnd(SENTENCE_GROUP, fragment.id)}
                onClick={() => toggleFragment(fragment)}
                disabled={!drawn && (isFull || locked)}
                aria-pressed={drawn}
                title={locked ? '조금 더 많은 기록이 필요합니다.' : undefined}
              >
                <span className="sentence-clues-scene__card-code" aria-hidden="true">
                  {archiveCodeOf(fragment.id)}
                </span>
                <span className="sentence-clues-scene__card-text">{fragment.text}</span>
                {locked ? (
                  <span className="sentence-clues-scene__card-hint">조금 더 많은 기록이 필요합니다.</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="sentence-clues-scene__tray" role="list" aria-label="수집한 기록">
          {Array.from({ length: SENTENCE_MAX_FRAGMENTS }).map((_, slotIndex) => {
            const fragmentId = fragments[slotIndex];
            return (
              <div key={slotIndex} className="sentence-clues-scene__tray-slot">
                <AnimatePresence>
                  {fragmentId ? (
                    <motion.button
                      key={fragmentId}
                      type="button"
                      role="listitem"
                      className="sentence-clues-scene__tray-card"
                      initial={{ opacity: 0, y: 14, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.94 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      onClick={() => returnFragment(fragmentId)}
                      aria-label={`${textOf(fragmentId)} · 되돌리기`}
                    >
                      <span className="sentence-clues-scene__tray-index">
                        {String(slotIndex + 1).padStart(2, '0')}
                      </span>
                      <span className="sentence-clues-scene__tray-text">{textOf(fragmentId)}</span>
                    </motion.button>
                  ) : (
                    <span className="sentence-clues-scene__tray-placeholder" aria-hidden="true">
                      {String(slotIndex + 1).padStart(2, '0')}
                    </span>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="sentence-clues-scene__submit">
          <span className="sentence-clues-scene__submit-note">
            {isValid ? '다음으로 이동할 수 있습니다.' : '세 개 이상의 기록을 꺼내주세요.'}
          </span>
          <button
            className="sentence-clues-scene__confirm"
            onClick={handleExploreNext}
            disabled={!isValid}
          >
            <TerminalCorners />
            다음으로
          </button>
        </div>
      </div>
    );
  }

  /* ── reconstruction: what was drawn, read as one account ─────────────────── */

  if (phase === 'reconstruction') {
    const ordered = orderedForReading(fragments);
    return (
      <div className="sentence-clues-scene">
        <p className="sentence-clues-scene__hint">선택한 기록으로 이후의 기록이 구성되었습니다.</p>

        <div className="sentence-clues-scene__account">
          {ordered.map((id, index) => (
            <p key={id} className="sentence-clues-scene__account-line">
              <span className="sentence-clues-scene__account-index">{String(index + 1).padStart(2, '0')}</span>
              {textOf(id)}
            </p>
          ))}
        </div>

        <button className="sentence-clues-scene__confirm" onClick={() => setPhase('discovering')}>
          <TerminalCorners />
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
      <div className="sentence-clues-scene sentence-clues-scene--question">
        {targetFragment ? (
          <p className="sentence-clues-scene__target-card">{targetFragment.text}</p>
        ) : null}
        <p className="sentence-clues-scene__question">{questionResult.question}</p>

        <div className="sentence-clues-scene__response-field">
          <input
            type="text"
            className="sentence-clues-scene__response-input"
            value={responseText}
            maxLength={RESPONSE_MAX_LENGTH}
            placeholder="짧게 남겨도 괜찮습니다."
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
          <button className="sentence-clues-scene__confirm" onClick={() => proceedFromQuestion(false)}>
            <TerminalCorners />
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
      <div className="sentence-clues-scene">
        <p className="sentence-clues-scene__hint">복원된 기록입니다.</p>

        <div className="sentence-clues-scene__account sentence-clues-scene__account--final">
          {ordered.map((id, index) => {
            const targetFragment = id === targetId ? FRAGMENT_BY_ID.get(id) : undefined;
            const line =
              targetFragment && !responseSkipped && responseText.trim()
                ? synthesizeRestoredLine(targetFragment, responseText)
                : textOf(id);
            return (
              <p key={id} className="sentence-clues-scene__account-line">
                <span className="sentence-clues-scene__account-index">{String(index + 1).padStart(2, '0')}</span>
                {line}
                {id === targetId && responseSkipped ? (
                  <span className="sentence-clues-scene__unanswered-mark">· 미응답</span>
                ) : null}
              </p>
            );
          })}
        </div>

        <button className="sentence-clues-scene__confirm" onClick={handleRestoredRecordNext}>
          <TerminalCorners />
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

      <button className="sentence-clues-scene__confirm" onClick={handleComplete}>
        <TerminalCorners />
        기록 확정
      </button>
    </div>
  );
}
