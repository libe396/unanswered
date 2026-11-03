import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ReportStageNav } from './ReportStageNav';
import './ReportStageIntent.css';

interface Props {
  index: number;
  total: number;
  locked: boolean;
  onAdvance: () => void;
}

/**
 * ARTIST NOTE — the wall text at the exit, after the closing and before the
 * record is issued.
 *
 * Why it exists: user testing asked for it in as many words ("마지막 최종
 * 보고서에 작가의 의도에 대한 충분한 설명이 필요함"), and the same visit
 * explained why — a visitor who read the whole thing as a guessing game
 * reaches the end without ever being told that guessing was never the point
 * ("추리를 하고 있었는데 누구인지는 안 나오고"). The premise was only ever
 * written down outside the work, in the catalogue.
 *
 * So the copy here is the catalogue's, not new writing: PARAGRAPHS 1–3 are
 * src/catalog/content.js's `intro` and the "일반적인 자기이해 서비스와의
 * 차이" table in src/catalog/archive.js, broken into reading beats. It
 * explains the premise and declines to name the subject; it never explains
 * this particular visit, which is what the Findings before it are for.
 */
const PARAGRAPHS = [
  '“너는 어떤 사람이야?”라는 질문 앞에서\n우리는 종종 머뭇거립니다.\n좋아하는 것을 고를 수는 있어도,\n왜 좋아하는지 설명하기는 쉽지 않습니다.',
  '이 조사는 그 머뭇거림을 빈칸으로 두지 않습니다.\n고른 것과 함께 망설인 것, 취소한 것,\n끝내 비워 둔 것을 같은 무게로 적었습니다.',
  '그래서 이 보고서는 답을 주지 않습니다.\n당신을 어떤 유형으로 분류하지도 않습니다.\n분류하지 않은 관찰 기록을,\n답하지 못한 지점을 단서로 되돌려줍니다.',
];

const CLOSING_TITLE = '당신이 찾던 사람의 이름은\n끝까지 적히지 않았습니다.';
const CLOSING_BODY =
  '이름을 맞히는 일은 이 조사의 목적이 아니었습니다.\n누구를 떠올렸든, 그 사람을 해석하는 동안\n남은 것은 당신의 방식이었습니다.';
const SIGNATURE = '미응답 UNANSWERED · 이서연';

export function ReportStageIntent({ index, total, locked, onAdvance }: Props) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const last = PARAGRAPHS.length;

  function advanceReading() {
    if (locked) return;
    if (phase >= last) onAdvance();
    else setPhase((current) => current + 1);
  }

  const fade = { duration: reduced ? 0.15 : 0.9 };

  return (
    <div className="report-stage report-intent">
      <p className="report-stage__eyebrow">
        <span className="report-stage__eyebrow-code">REPORT {String(index).padStart(2, '0')}</span>
        <span className="report-stage__eyebrow-sep" aria-hidden="true">·</span>
        <span className="report-stage__eyebrow-title">조사를 만든 이유</span>
      </p>

      <div className="report-stage__body report-intent__body" aria-live="polite">
        <AnimatePresence mode="wait">
          {phase < last ? (
            <motion.p
              key={phase}
              className="report-intent__line"
              initial={{ opacity: 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -6 }}
              transition={fade}
            >
              {PARAGRAPHS[phase]}
            </motion.p>
          ) : (
            <motion.div
              key="closing"
              className="report-intent__closing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0.15 : 1.2 }}
            >
              <p className="report-intent__closing-title">{CLOSING_TITLE}</p>
              <p className="report-intent__line">{CLOSING_BODY}</p>
              <p className="report-intent__signature">{SIGNATURE}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ReportStageNav
        label={phase < last ? '계속 읽기' : '최종 기록으로'}
        index={index}
        total={total}
        visible
        onAdvance={advanceReading}
        disabled={locked}
      />
    </div>
  );
}
