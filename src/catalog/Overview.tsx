import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion';
import { CatalogImage, imageUrl, type OpenImage } from './CatalogImage';
import { FinalViewer } from './shared';
import { overviewChapters } from './editorialContent';
import wordmark from '../assets/wordmark.svg';
import { exhibitionHref, isVenueMode } from '../lib/venueMode';

const spaces = [
  { title: '빛의 흔적', code: 'LIGHT', src: 'latest/space-light.webp', line: '마음이 가는 이미지에서 빛을 모읍니다.' },
  { title: '소리의 흔적', code: 'SOUND', src: 'latest/space-sound.webp', line: '오래 머물고 싶은 소리를 고릅니다.' },
  { title: '기억의 흔적', code: 'MEMORY', src: 'latest/space-memory.webp', line: '기억이 남은 자리에 선을 더합니다.' },
  { title: '문장의 흔적', code: 'SENTENCE', src: 'latest/space-sentence.webp', line: '끊어진 이후의 기록을 이어 봅니다.' },
];
const records = [
  { title: '보고서', src: 'latest/record-report.webp' },
  { title: '조사원증', src: 'latest/record-badge.webp' },
  { title: '편지와 봉투', src: 'latest/record-letter.webp' },
];
const stepNames = ['초안', '규칙', '실험', '변환'];
/**
 * The requests actually sent for each comparison image, from the BLUR-01 Firework Bokeh
 * record (04 AI Image Reconstruction, G2 / G3 Full Prompt). The original is a photograph.
 */
const originPrompts = [
  { note: '프롬프트 없음 · 직접 촬영한 원본 사진입니다.', prompt: '' },
  { note: '흐릿함과 부드러움, 모호함을 유지하고 선명한 장면으로 만들지 않도록 요청했습니다.', prompt: 'Create a vertical image in a 4:5 aspect ratio. Create a nighttime image that preserves the ambiguity, softness, and blur of the uploaded image. Keep all lights out of focus. Do not turn the image into a fully clear or sharply defined scene. Avoid making the firework, city, or street elements distinct. Use only soft glowing orbs, hazy light clusters, dark negative space, and indistinct low-light atmosphere. The image should remain dreamy, uncertain, and unresolved.' },
  { note: '흐릿한 빛을 선명하고 현실적인 장면으로 다시 만들도록 요청했습니다.', prompt: 'Create a vertical image in a 4:5 aspect ratio. Create a realistic nighttime photo showing what the uploaded blurry image most likely represents if it were perfectly clear and sharply focused. Turn the soft glowing burst into a recognizable firework in the night sky. Clarify the distant lower lights as city or street lights. Make the scene realistic, crisp, detailed, and in focus while preserving the original vertical composition and nighttime atmosphere.' },
];

/** Types the request back in when the visitor changes it. */
function PromptText({ note, prompt, reduced }: { note: string; prompt: string; reduced: boolean }) {
  return <div className="origin-prompt-body" key={note}>
    <p className="origin-prompt-note">{note}</p>
    {prompt ? (reduced
      ? <p className="origin-prompt-text">{prompt}</p>
      : <p className="origin-prompt-text">{[...prompt].map((letter, i) => <motion.span key={`${i}-${letter}`} initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: .3, delay: Math.min(i * .004, 1.4) }}>{letter === ' ' ? '\u00a0' : letter}</motion.span>)}</p>) : null}
  </div>;
}

/** The earlier catalogue's dwell-time response, kept in memory for this page only. */
function useReadingRecord(active: number, visible: boolean) {
  const totals = useRef([0, 0, 0, 0, 0]);
  const [record, setRecord] = useState({ index: 0, seconds: 0 });
  useEffect(() => {
    if (!visible) return;
    let started: number | null = document.visibilityState === 'visible' ? performance.now() : null;
    const stop = () => {
      if (started !== null) totals.current[active] += performance.now() - started;
      started = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') started = performance.now();
      else stop();
    };
    if (active === 4) {
      const index = totals.current.indexOf(Math.max(...totals.current));
      setRecord({ index, seconds: Math.round(totals.current[index] / 1000) });
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [active, visible]);
  return record;
}

function ReadingRecord({ active, visible, reduced }: { active: number; visible: boolean; reduced: boolean }) {
  const record = useReadingRecord(active, visible);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (active !== 4 || !visible) return;
    if (reduced) { setShown(record.seconds); return; }
    const control = animate(0, record.seconds, { duration: 1.2, ease: 'easeOut', onUpdate: (value) => setShown(Math.round(value)) });
    return () => control.stop();
  }, [active, visible, reduced, record.seconds]);
  return <div className="reading-record"><span>이 페이지에서 가장 오래 머문 곳</span><p>{overviewChapters[record.index].title}<span>{shown}<small>초</small></span></p></div>;
}

export function Overview({ panelRef, active, visible, onChapter, onResearch, onResult, onOpen }: {
  panelRef: RefObject<HTMLDivElement | null>; active: number; visible: boolean; onChapter: (index: number) => void;
  onResearch: (no?: string) => void; onResult: () => void; onOpen: OpenImage;
}) {
  const reduced = useReducedMotion() ?? false;
  const [origin, setOrigin] = useState(0);
  const [space, setSpace] = useState(0);
  const [step, setStep] = useState(3);
  const [record, setRecord] = useState(0);
  const picture = (src: string, alt: string, ratio = '16 / 10') => <CatalogImage image={{ src, alt, ratio }} onOpen={onOpen} />;
  const title = (index: number, lines: string[]) => <h2 id={`overview-0${index + 1}-title`} className="motion-title">{lines.map((line, i) => <span className="motion-title-line" key={line}><motion.span initial={false} animate={{ y: active === index && visible ? 0 : reduced ? 0 : '105%', opacity: active === index && visible ? 1 : reduced ? 1 : 0 }} transition={{ duration: reduced ? 0 : .75, delay: reduced ? 0 : .12 + i * .1, ease: [.22, 1, .36, 1] }}>{line}</motion.span></span>)}</h2>;
  const originTitles = ['직접 촬영한 원본', '모호함 유지 요청', '선명화 요청'];
  const heading = (index: number, lines: string[], body: string, label: string, action: () => void) => <div className="quiet-heading">{title(index, lines)}<div className="chapter-intro glass-panel"><p>{body}</p><button className="editorial-text-button" onClick={action}>{label} ↗</button></div></div>;

  return <>
    <div ref={panelRef} className="editorial-overview overview-immersive" id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" tabIndex={0}>
      {overviewChapters.map((chapter, index) => <section key={chapter.id} id={chapter.id} className={`overview-chapter overview-chapter--${chapter.no}${active === index && visible ? ' is-current' : ''}`} aria-labelledby={`${chapter.id}-title`}>
        <div className="chapter-inner">
          <div className="chapter-body">
          <header className="chapter-header"><span>{chapter.no} / {chapter.label}</span></header>
          <motion.div className="chapter-experience" initial={false} animate={{ opacity: active === index && visible || reduced ? 1 : .2 }} transition={{ duration: reduced ? 0 : .65 }}>
            {index === 0 ? <div className="overview-cover">
              <motion.div className="cover-backdrop" aria-hidden="true" initial={false} animate={{ opacity: active === 0 && visible ? 1 : .45, filter: active === 0 && visible || reduced ? 'blur(2px)' : 'blur(8px)' }} transition={{ duration: reduced ? 0 : 1.4 }}><img src={imageUrl('latest/hero.webp')} alt="" /></motion.div>
              <div className="cover-lead"><p className="editorial-eyebrow">OVERVIEW</p><motion.h1 id={`${chapter.id}-title`} initial={false} animate={{ opacity: active === 0 && visible ? 1 : .2 }} transition={{ duration: reduced ? 0 : 1.2 }}><img className="hero-wordmark" src={wordmark} alt="UNANSWERED" /></motion.h1>
              <p className="cover-statement">‘모르겠어요’는 빈칸이 아니라,<br />아직 정리되지 않은 단서일 수 있다.</p>
              <p className="cover-body"><span>자신을 선뜻 설명하지 못하는 순간에도 취향과 감정의 흔적은 남는다.</span><span>〈미응답 UNANSWERED〉는 그 망설임을 자신을 이해하는 단서로 바라보는 데서 출발한다.</span></p>
              <a className="editorial-link" href={exhibitionHref(isVenueMode())}>전시 입장 <span aria-hidden="true">↗</span></a></div>
            </div> : null}
            {index === 1 ? <div className="origin-experience">
              {heading(1, ['흐릿함에서,', '사람의 응답으로'], ['같은 이미지에서 연구를 시작했습니다. 사람과 AI가 남긴 서로 다른 해석을 비교합니다.', '흐릿함을 남겨 달라고 요청했습니다. AI가 모호함을 유지하는 방식을 살펴봅니다.', '선명한 장면으로 바꿔 달라고 요청했습니다. 원본과 재구성 이미지의 차이를 비교합니다.'][origin], '연구 과정', () => onResearch('01'))}
              <div className="origin-workbench glass-panel"><div className="origin-comparison" role="group" aria-label="원본과 AI 해석 비교">{originTitles.map((label, i) => <button key={label} aria-pressed={origin === i} onClick={() => setOrigin(i)} onPointerEnter={() => setOrigin(i)} onFocus={() => setOrigin(i)}><img src={imageUrl(`archive/blur-${i + 1}.webp`)} alt={label} loading="lazy" /><span><small>{['ORIGINAL', 'G2', 'G3'][i]}</small>{label}</span></button>)}</div>
              <div className="origin-caption"><div className="origin-prompt"><span className="editorial-eyebrow">PROMPT</span><PromptText note={originPrompts[origin].note} prompt={originPrompts[origin].prompt} reduced={reduced} /></div><button className="editorial-text-button" onClick={() => onOpen(imageUrl(`archive/blur-${origin + 1}.webp`), originTitles[origin])}>선택한 이미지 확대 ↗</button></div></div>
            </div> : null}
            {index === 2 ? <div className="space-experience">
              {heading(2, ['감각을 따라,', '단서를 모읍니다'], `${spaces[space].line} 다른 공간을 눌러 다음 단서를 살펴보세요.`, '공간과 동선', () => onResearch('04'))}
              <div className="space-workbench glass-panel"><div className="space-stage"><AnimatePresence initial={false}><motion.div key={space} className="space-layer" initial={{ opacity: 0, scale: reduced ? 1 : 1.035 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .7 }}>{picture(spaces[space].src, spaces[space].title, '16 / 9')}</motion.div></AnimatePresence></div>
              <div className="space-controls" role="group" aria-label="감각 공간 선택">{spaces.map((item, i) => <button key={item.code} aria-pressed={space === i} onClick={() => setSpace(i)}>{item.title}</button>)}</div>
              </div>
            </div> : null}
            {index === 3 ? <div className="process-experience">
              {heading(3, step === 3 ? ['단어가 바뀌면,', '빛도 달라집니다'] : [['직접 그린 빛에서', '규칙을 찾았습니다'], ['원과 선, 교차점을', '규칙으로 정했습니다'], ['과한 빛을 덜고', '다시 만들었습니다']][step], ['직접 그린 원과 선, 광점에서 빛 그래픽의 기준을 찾았습니다.', '원형 레이어와 흐린 선, 교차점과 질감을 실행 가능한 규칙으로 정리했습니다.', '입자와 광원이 과한 1차 결과를 검토하고 표현을 다듬었습니다.', '감정 단어를 고르면 같은 사진에서 빛의 색과 번짐이 달라집니다.'][step], '제작 과정', () => onResearch('05'))}
              <div className="process-workbench glass-panel"><div className="process-step-controls" role="group" aria-label="제작 단계">{stepNames.map((name, i) => <button key={name} aria-pressed={step === i} onClick={() => setStep(i)}>{name}</button>)}</div>
              <div className="process-demo"><AnimatePresence mode="wait" initial={false}><motion.div key={step} className="process-demo-panel" initial={{ opacity: 0, x: reduced ? 0 : 32 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : -24 }} transition={{ duration: reduced ? 0 : .35 }}>
                {step === 3 ? <FinalViewer onOpen={onOpen} /> : <div className="process-study">{picture(['latest/draft.webp', 'latest/sad.webp', 'latest/experiment-1.webp'][step], stepNames[step], '1 / 1')}<p>{['원과 선, 광점으로 그린 초안.', '원형 레이어 · 흐린 선 · 교차점 · 질감', '입자와 광원이 과했던 1차 결과.'][step]}</p></div>}
              </motion.div></AnimatePresence></div></div>
            </div> : null}
            {index === 4 ? <div className="record-experience">
              {heading(4, ['고르는 동안,', '기록은 쌓입니다'], '선택과 재확인, 머문 시간을 모아 이번 조사의 기록으로 돌려드립니다.', 'Result · 웹도록', onResult)}
              <div className="record-workbench glass-panel"><div className="record-finish"><div className="record-object"><div className="record-stack" role="group" aria-label="남겨지는 기록">{records.map((item, i) => <button key={item.title} className={record === i ? 'is-front' : ''} style={{ '--record-order': i, '--record-slot': (i - record + records.length) % records.length } as CSSProperties} aria-pressed={record === i} onClick={() => setRecord(i)}><img src={imageUrl(item.src)} alt={item.title} loading="lazy" /><span>{item.title}</span></button>)}</div><div className="record-choices" role="group" aria-label="기록 선택">{records.map((item, i) => <button key={item.title} aria-label={`${item.title} 선택`} aria-pressed={record === i} onClick={() => setRecord(i)}>{item.title}</button>)}</div></div><ReadingRecord active={active} visible={visible} reduced={reduced} /></div>
              <div className="overview-closing"><span>대답하지 못한 것도 기록됩니다.</span><button className="editorial-text-button" onClick={() => onOpen(imageUrl(records[record].src), records[record].title)}>선택한 기록 확대 ↗</button></div></div>
            </div> : null}
          </motion.div>
          </div>
          <footer className="chapter-footer"><span>{index === 4 ? 'LEE SEOYEON · AI DESIGN STUDIO' : ''}</span><button onClick={() => onChapter(index === 4 ? 0 : index + 1)}>{index === 4 ? '처음으로 ↑' : '다음 챕터 ↓'}<span>{chapter.no} / 05</span></button></footer>
        </div>
      </section>)}
    </div>
    <nav className="editorial-progress" aria-label="소개 챕터">{overviewChapters.map((chapter, i) => <button key={chapter.id} aria-label={`${chapter.no} ${chapter.title}`} aria-current={active === i ? 'step' : undefined} onClick={() => onChapter(i)}><span>{chapter.no}</span><span className="progress-name">{chapter.title}</span></button>)}</nav>
  </>;
}
