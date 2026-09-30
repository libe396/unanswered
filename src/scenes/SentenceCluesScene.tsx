import { useInteractionClock } from '../hooks/useInteractionClock';
import { useEffect, useRef, useState } from 'react';
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
import {
  NO_TARGET_MESSAGE,
  findQuestionTarget,
  generateFragmentQuestion,
  type SentenceQuestionResult,
} from '../lib/sentenceQuestionService';
import { TerminalCorners } from '../components/TerminalCorners';
import { StageActions, StageHeader } from '../components/StageHeader';
import { ZONE_INFO } from '../data/zones';
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

/**
 * The ENDING gate (records 17–20 stay shut until two other records are drawn),
 * off.
 *
 * Off means the wall is twenty equal records from the first frame: no LOCKED
 * mark, no card in a third state, and no line of the instruction explaining a
 * rule the visitor never meets. It is a flag rather than a deletion because
 * the rule itself is a narrative decision, not a layout one —
 * `isEndingLocked`, `SENTENCE_MIN_NON_ENDING_BEFORE_ENDING` and the sentence
 * that announces the unlock are all still here, and flipping this back to
 * `true` restores every one of them.
 *
 * It does not touch what gets recorded: SENTENCE_MIN_FRAGMENTS/
 * SENTENCE_MAX_FRAGMENTS (3–5) and every tracking call are unchanged.
 */
const ENDING_LOCK_ENABLED = false;

/**
 * The four phases that are one screen.
 *
 * Reconstruction, Discovering, Question and Restored Record are not four
 * Scenes — they are one sheet of paper being filled in, and the sheet has to
 * stay in the same place on the screen the whole time or the Zone reads as a
 * form with three pages. Discovering is in the list for exactly that reason:
 * on its own it was a lone line on an empty screen, so the sheet vanished
 * between step 1 and step 2 and came back somewhere slightly different.
 *
 * The phase machine itself is untouched — only where these phases draw.
 */
const RECORD_PHASES: readonly Phase[] = ['reconstruction', 'discovering', 'question', 'restoredRecord'];

/** 기록 확인 / 빈칸 채우기 / 기록 완료 — the three marks in the step rail. */
const RECORD_STEPS = ['기록 확인', '빈칸 채우기', '기록 완료'] as const;

/**
 * Hangul Compatibility Jamo — a single ㄱ-ㅎ / ㅏ-ㅣ, i.e. a syllable that was
 * never finished. One of these at the very end of an answer is what is left
 * when a visitor commits out of a half-typed character, so it is dropped on
 * the way into the record. Exactly one, and only at the end: everything the
 * visitor actually wrote is kept as written.
 */
const TRAILING_LONE_JAMO = /[\u3131-\u318E]$/;

function dropTrailingLoneJamo(value: string): string {
  return TRAILING_LONE_JAMO.test(value) ? value.slice(0, -1).trimEnd() : value;
}

const RESPONSE_MIN_HEIGHT = 112;
const RESPONSE_MAX_HEIGHT = 224;

const RESPONSE_MAX_LENGTH = 100;
const DISCOVERING_MIN_MS = 900;
const DEFAULT_DISCOVERING_TEXT = '아직 확인되지 않은 부분이 있습니다.';

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
  | 'context'
  | 'explore'
  | 'reconstruction'
  | 'discovering'
  | 'question'
  | 'restoredRecord';

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

  const [phase, setPhase] = useState<Phase>('context');
  const interactionNow = useInteractionClock();
  const enteredAtRef = useRef(interactionNow());

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
    if (!ENDING_LOCK_ENABLED) return false;
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
  const responseInputRef = useRef<HTMLTextAreaElement>(null);
  /*
    True between compositionstart and compositionend — i.e. while a Hangul
    syllable is still being assembled out of jamo. React's onChange does fire
    mid-composition, but the value it carries is the half-built syllable, and
    a commit taken from state at that moment either drops the last letter or
    keeps a stray one ("...것이다.ㅇ"). Every commit therefore reads the
    textarea's own value instead; this flag is what tells the handlers a
    composition is in flight.
  */
  const isComposingRef = useRef(false);

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

  // The field grows with the answer instead of scrolling inside itself. Run
  // on phase too, so it is sized correctly the frame it first appears.
  useEffect(() => {
    const field = responseInputRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${Math.min(Math.max(field.scrollHeight, RESPONSE_MIN_HEIGHT), RESPONSE_MAX_HEIGHT)}px`;
  }, [responseText, phase]);

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

  /**
   * Force a Hangul syllable that is still being assembled to be finished.
   *
   * Blurring makes the IME commit whatever it is holding, which fires
   * compositionend and settles the textarea's value — before the click that
   * follows this mousedown reaches either button. Without it a visitor who
   * clicks straight out of a half-typed syllable commits a value that is one
   * keystroke behind what they can see.
   */
  function commitComposition() {
    if (!isComposingRef.current) return;
    responseInputRef.current?.blur();
  }

  /**
   * Commit the answer, or decline to give one.
   *
   * The value is read off the textarea rather than out of `responseText`: a
   * visitor who clicks straight from an unfinished Hangul syllable is still
   * mid-composition, and state is one jamo behind the DOM at that moment.
   *
   * Two things happen to the text and nothing else: surrounding whitespace is
   * trimmed, and a single trailing lone jamo — the leftover of that unfinished
   * syllable — is dropped. Punctuation, spelling and wording are stored exactly
   * as typed. See dropTrailingLoneJamo.
   */
  function proceedFromQuestion(skip: boolean) {
    isComposingRef.current = false;
    const live = responseInputRef.current?.value ?? responseText;
    const trimmed = dropTrailingLoneJamo(live.trim());
    const skipped = skip || trimmed.length === 0;
    setResponseSkipped(skipped);
    if (skipped) setResponseText('');
    else setResponseText(trimmed);
    responseLengthRef.current = skipped ? 0 : trimmed.length;
    setPhase('restoredRecord');
  }

  /* ── Restored Record → Behavioral Trace ─────────────────────────────────── */

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
      behavioralTrace: deriveSentenceBehavioralTrace(summary),
      sceneDurationMs: interactionNow() - enteredAtRef.current,
    });
    tracking.save();
    logSceneTracking('sentenceClues', tracking, readSentenceTracking);
    playClueRecordedSignature();
    completeScene('sentenceClues');
  }

  /* ── zoneIntro / context ─────────────────────────────────────────────────── */


  if (phase === 'context') {
    const selectedSound = SOUND_CLUES.find(sound => sound.id === soundClues.selectedSoundId);
    const selectedObjects = memorySketch.selectedObjects.map(id => MEMORY_ROOM_OBJECTS.find(object => object.id === id)?.label ?? id);
    return (
      <div className="sentence-clues-scene sentence-clues-scene--context">
        <div className="sentence-clues-scene__intro">
          <p className="sentence-clues-scene__intro-label">문장의 흔적</p>
          <h1>그 사람에게 이후 어떤 일이 있었을까요?</h1>
          <p className="sentence-clues-scene__intro-guide">수집한 단서를 떠올리며, 이어졌을 법한 문장을 {SENTENCE_MIN_FRAGMENTS}~{SENTENCE_MAX_FRAGMENTS}개 골라 주세요.</p>
          <dl className="sentence-clues-scene__clue-strip" aria-label="수집한 단서 요약">
            <div><dt>색</dt><dd>{lightArchive?.rules.palette.length ? <div className="sentence-clues-scene__swatches">{lightArchive.rules.palette.map((color, index) => <span key={index} style={{ backgroundColor: color }} role="img" aria-label={color} />)}</div> : '수집한 색 없음'}</dd></div>
            <div><dt>소리</dt><dd>{selectedSound?.label ?? '선택한 소리 없음'}</dd></div>
            <div><dt>사물</dt><dd>{selectedObjects.length ? selectedObjects.join(' · ') : '선택한 사물 없음'}</dd></div>
          </dl>
          <button className="cta cta--primary" onClick={() => setPhase('explore')}>문장 고르기</button>
        </div>
      </div>
    );
  }

  /* ── explore: the archive wall ─────────────────────────────────────────────
     One screen: heading, the entire comparison grid, and a compact footer.
     Unsupported viewports offer a larger-screen notice without losing state. */

  if (phase === 'explore') {
    return (
      <div className="sentence-clues-scene sentence-clues-scene--explore"><div className="sentence-clues-scene__size-notice" role="status"><h1>전체 기록을 한눈에 비교할 수 있는 화면이 필요합니다.</h1><p>가로 화면이나 더 큰 창으로 열어 주세요.<br />최소 가로 1100 × 세로 650 크기의 화면을 권장합니다.</p><p>선택한 기록과 작성 중인 문장은 그대로 유지됩니다.</p></div>
        {/* No description line here. Twenty records, four rows and the slot
            row have to land inside one 800px screen without a scroller, and
            the instruction is the one block that can be said somewhere else —
            the action row's label below carries the 3–5 range instead. */}
        <StageHeader eyebrow="문장의 흔적" title="그 사람에게 이후 어떤 일이 있었을까요?" />

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
                  {locked ? <span className="sentence-clues-scene__card-lock">선택 대기</span> : null}
                </span>
                <span className="sentence-clues-scene__card-text">{fragment.text}</span>
              </button>
            );
          })}
        </div>

        <div className="sentence-clues-scene__foot">
          <div className="sentence-clues-scene__selection-numbers" aria-label="선택한 기록 번호">
            {Array.from({ length: SENTENCE_MAX_FRAGMENTS }, (_, i) => fragments[i] ? <button key={fragments[i]} onClick={() => returnFragment(fragments[i])} aria-label={`${archiveCodeOf(fragments[i])}번 기록 선택 해제`}>{archiveCodeOf(fragments[i])}<span aria-hidden="true"> ×</span></button> : <span key={i}>—</span>)}
          </div>
          <StageActions
            info={
              <p className="metric sentence-clues-scene__count" role="status">
                <span className="metric__value">
                  {String(fragments.length).padStart(2, '0')} / {String(SENTENCE_MAX_FRAGMENTS).padStart(2, '0')}
                </span>
                <span className="metric__label">
                  {ENDING_LOCK_ENABLED && nonEndingDrawnCount < SENTENCE_MIN_NON_ENDING_BEFORE_ENDING
                    ? '17–20번은 다른 기록 2개를 고르면 열립니다.'
                    : isFull
                      ? '다른 문장을 고르려면 선택한 기록을 해제하세요.'
                      : isValid
                        ? '선택한 문장을 다시 누르면 해제됩니다.'
                        : `가능하다고 생각되는 기록을 ${SENTENCE_MIN_FRAGMENTS}–${SENTENCE_MAX_FRAGMENTS}개 골라 주세요.`}
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

  /* ── The record sheet: one page, read through three steps ─────────────────
     Reconstruction, Discovering, Question and Restored Record all render from
     here so the sheet on the left is literally the same element throughout —
     only its contents and its emphasis change, and the right-hand column
     swaps. See RECORD_PHASES. */

  if (RECORD_PHASES.includes(phase)) {
    const ordered = orderedForReading(fragments);
    const targetId = questionResult?.fragmentId ?? null;
    const targetFragment = targetId ? (FRAGMENT_BY_ID.get(targetId) ?? null) : null;
    const trimmedResponse = responseText.trim();

    // Asking (or about to ask) is the only state that dims the other records.
    const isAsking = phase === 'question' && !!targetFragment;
    // What the visitor is typing right now, not yet part of the record.
    const draftAddition = isAsking ? responseText : '';
    // Committed: past the Question step, with something actually written.
    const hasAddition = phase === 'restoredRecord' && !responseSkipped && trimmedResponse.length > 0;
    const leftBlank = phase === 'restoredRecord' && responseSkipped && !noQuestionAvailable;
    const canSubmit = responseText.trim().length > 0;

    const stepIndex = phase === 'reconstruction' ? 0 : phase === 'restoredRecord' ? 2 : 1;

    const sheetState = phase === 'restoredRecord' ? (hasAddition ? '복원 완료' : '미응답') : '복원 중';
    const fragmentCount = `기록 ${ordered.length}개`;
    const blankMark =
      phase !== 'restoredRecord'
        ? '빈칸 1개'
        : noQuestionAvailable
          ? '빈칸 없음'
          : hasAddition
            ? '복원 1개'
            : '미응답 1개';

    return (
      <div className="sentence-clues-scene sentence-clues-scene--record"><div className="sentence-clues-scene__size-notice" role="status"><h1>전체 기록을 한눈에 비교할 수 있는 화면이 필요합니다.</h1><p>가로 화면이나 더 큰 창으로 열어 주세요.<br />최소 가로 1100 × 세로 650 크기의 화면을 권장합니다.</p><p>선택한 기록과 작성 중인 문장은 그대로 유지됩니다.</p></div>
        <div className="sentence-clues-scene__record-grid">
          {/* ── The sheet ─────────────────────────────────────────────────── */}
          <section
            className={`sentence-clues-scene__sheet sentence-clues-scene__sheet--${phase}`}
            aria-labelledby="sentence-sheet-title"
          >
            <TerminalCorners />

            <header className="sentence-clues-scene__sheet-top">
              {/* "ZONE 06" → "06": the sheet is RECORD 06, and the Zone is
                  already named in the corner above it. */}
              <span className="sentence-clues-scene__sheet-mark">
                기록 {ZONE_INFO.sentenceClues.zone.replace(/^ZONE\s*/, '')}
              </span>
              <span
                className={`sentence-clues-scene__sheet-state${
                  phase === 'restoredRecord' ? ' sentence-clues-scene__sheet-state--done' : ''
                }`}
              >
                {sheetState}
              </span>
            </header>

            <h2 id="sentence-sheet-title" className="sentence-clues-scene__sheet-title">
              그날, 이 방에서 있었던 일 — 복원 중인 기록
            </h2>

            <div className="sentence-clues-scene__sheet-lines scroll-quiet">
              {ordered.map((id) => {
                const isTarget = id === targetId;
                const dimmed = isAsking && !isTarget;
                return (
                  <article
                    key={id}
                    className={`sentence-clues-scene__record-line${
                      isTarget && isAsking ? ' sentence-clues-scene__record-line--focus' : ''
                    }${dimmed ? ' sentence-clues-scene__record-line--dim' : ''}`}
                  >
                    <span className="sentence-clues-scene__record-no" aria-hidden="true">
                      {archiveCodeOf(id)}
                    </span>
                    <div className="sentence-clues-scene__record-body">
                      {/* The record as it was written. Never rewritten to fold
                          an answer into it — the answer is its own block. */}
                      <p className="sentence-clues-scene__record-text">{textOf(id)}</p>

                      {/* Rendered from the moment the question is asked, empty
                          or not, so the sheet does not resize under the first
                          keystroke. Dashed and secondary: this is a preview,
                          not something the record has kept yet. */}
                      {isTarget && isAsking ? (
                        <p className="sentence-clues-scene__addition sentence-clues-scene__addition--draft">
                          <span className="sentence-clues-scene__addition-label">덧붙이는 중</span>
                          <span className="sentence-clues-scene__addition-text">{draftAddition}</span>
                        </p>
                      ) : null}

                      {isTarget && hasAddition ? (
                        <p className="sentence-clues-scene__addition">
                          <span className="sentence-clues-scene__addition-label">덧붙인 기록</span>
                          <span className="sentence-clues-scene__addition-text">{responseText}</span>
                        </p>
                      ) : null}

                      {isTarget && leftBlank ? (
                        <p className="sentence-clues-scene__addition sentence-clues-scene__addition--blank">
                          <span className="sentence-clues-scene__addition-label">미응답</span>
                        </p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            <footer className="sentence-clues-scene__sheet-foot">
              <span>
                {fragmentCount} · {blankMark}
              </span>
            </footer>
          </section>

          {/* ── The column that changes ───────────────────────────────────── */}
          <div className="sentence-clues-scene__panel">
            <ol className="sentence-clues-scene__steps" aria-label="진행 단계">
              {RECORD_STEPS.map((label, index) => (
                <li
                  key={label}
                  className={`sentence-clues-scene__step${
                    index === stepIndex ? ' sentence-clues-scene__step--on' : ''
                  }`}
                  aria-current={index === stepIndex ? 'step' : undefined}
                >
                  <span className="sentence-clues-scene__step-no" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  {label}
                </li>
              ))}
            </ol>

            {phase === 'reconstruction' ? (
              <>
                <p className="sentence-clues-scene__panel-eyebrow">선택한 기록</p>
                <h1 className="sentence-clues-scene__panel-title">선택한 기록이 한 장으로 모였습니다.</h1>
                <p className="sentence-clues-scene__panel-desc">
                  기록 사이에 아직 채워지지 않은 빈칸이 있습니다.
                </p>
                <div className="sentence-clues-scene__panel-actions">
                  <button className="cta cta--primary" onClick={() => setPhase('discovering')}>
                    빈칸 확인하기
                  </button>
                </div>
              </>
            ) : null}

            {phase === 'discovering' ? (
              <>
                <p className="sentence-clues-scene__panel-eyebrow">빈칸 살펴보기</p>
                <p className="sentence-clues-scene__discovering-text" key={discoveringMessage} role="status">
                  {discoveringMessage}
                </p>
              </>
            ) : null}

            {phase === 'question' && targetFragment ? (
              <>
                <p className="sentence-clues-scene__panel-eyebrow">
                  빈칸 · {archiveCodeOf(targetFragment.id)}
                </p>
                <h1 className="sentence-clues-scene__panel-title">{questionResult?.question}</h1>

                <div className="sentence-clues-scene__response-field">
                  <label className="sentence-clues-scene__response-label" htmlFor="sentence-response">
                    덧붙일 기록
                  </label>
                  <textarea
                    id="sentence-response"
                    ref={responseInputRef}
                    className="sentence-clues-scene__response-input"
                    value={responseText}
                    maxLength={RESPONSE_MAX_LENGTH}
                    placeholder="떠오르는 문장을 적어주세요."
                    aria-describedby="sentence-response-count sentence-response-hint"
                    onChange={(event) => handleResponseChange(event.target.value)}
                    onCompositionStart={() => {
                      isComposingRef.current = true;
                    }}
                    onCompositionEnd={(event) => {
                      // The syllable is finished: take the settled value, so
                      // state and the DOM agree before anything reads either.
                      isComposingRef.current = false;
                      handleResponseChange(event.currentTarget.value);
                    }}
                  />
                  <span
                    id="sentence-response-count"
                    className="sentence-clues-scene__response-count"
                    aria-live="polite"
                  >
                    {responseText.length} / {RESPONSE_MAX_LENGTH}자
                  </span>
                </div>

                <p id="sentence-response-hint" className="sentence-clues-scene__panel-hint">
                  떠오르는 말이 없다면 빈칸으로 남겨도 괜찮습니다.
                </p>

                <div className="sentence-clues-scene__panel-actions">
                  <button
                    type="button"
                    className="cta cta--secondary"
                    onMouseDown={commitComposition}
                    onClick={() => proceedFromQuestion(true)}
                  >
                    빈칸으로 남기기
                  </button>
                  <button
                    className="cta cta--primary"
                    onMouseDown={commitComposition}
                    onClick={() => proceedFromQuestion(false)}
                    disabled={!canSubmit}
                  >
                    기록에 남기기
                  </button>
                </div>
              </>
            ) : null}

            {phase === 'restoredRecord' ? (
              <>
                <p className="sentence-clues-scene__panel-eyebrow">복원된 기록</p>
                <h1 className="sentence-clues-scene__panel-title">
                  {hasAddition
                    ? '기록에 문장이 더해졌습니다.'
                    : noQuestionAvailable
                      ? '기록이 그대로 복원되었습니다.'
                      : '빈칸이 그대로 남았습니다.'}
                </h1>
                <p className="sentence-clues-scene__panel-desc">
                  {hasAddition
                    ? '왼쪽 표시된 문장은 당신이 덧붙인 기록입니다.'
                    : noQuestionAvailable
                      ? '더 채울 빈칸이 남아 있지 않았습니다.'
                      : '대답하지 않은 것도 하나의 기록으로 남습니다.'}
                </p>
                <div className="sentence-clues-scene__panel-actions">
                  <button className="cta cta--primary" onClick={handleComplete}>
                    다음으로
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
