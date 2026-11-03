import { useLayoutEffect, useRef, useState } from 'react';
import { chapters } from './archive.js';
import { ArchiveDocument } from './ArchivePart';
import { CatalogImage, type OpenImage } from './CatalogImage';
import { researchGroups, researchGuides } from './editorialContent';

export function Research({ selected, onSelect, onOpen }: { selected: string | null; onSelect: (no: string | null) => void; onOpen: OpenImage }) {
  const [group, setGroup] = useState('전체');
  const detailRef = useRef<HTMLDivElement>(null);
  const returnRef = useRef<HTMLButtonElement | null>(null);
  const chapter = chapters.find((item) => item.no === selected);
  const visible = group === '전체' ? chapters : chapters.filter((item) => researchGroups.find((g) => g.name === group)?.chapters.includes(item.no));
  useLayoutEffect(() => { if (selected) { detailRef.current?.scrollTo(0, 0); detailRef.current?.focus({ preventScroll: true }); } }, [selected]);
  const back = () => { onSelect(null); requestAnimationFrame(() => returnRef.current?.focus({ preventScroll: true })); };
  return <div className="research-shell" id="panel-research" role="tabpanel" aria-labelledby="tab-research">
    <div className="research-list editorial-scroll" hidden={!!chapter} tabIndex={0}>
      <div className="editorial-container">
        <header className="editorial-page-heading"><p className="editorial-eyebrow">RESEARCH ARCHIVE / 2026.04 — 10</p><h1>결정이 남은 자리.</h1><p>리서치와 실험, 버린 안과 다시 고친 과정을 모았습니다.<br />궁금한 기록을 골라 읽어 보세요.</p></header>
        <nav className="research-filters" aria-label="연구 주제">{['전체', ...researchGroups.map((g) => g.name)].map((name) => <button key={name} aria-pressed={group === name} onClick={() => setGroup(name)}>{name}<span>{name === '전체' ? '11' : researchGroups.find((g) => g.name === name)?.chapters.length}</span></button>)}</nav>
        <div className="research-list-heading"><span>기록 / {String(visible.length).padStart(2, '0')}</span><span>PERIOD</span></div>
        <ol className="research-entries">{visible.map((item) => <li key={item.no}><button onClick={(event) => { returnRef.current = event.currentTarget; onSelect(item.no); }}><span className="research-entry-no">{item.no}</span><span className="research-entry-copy"><span className="editorial-eyebrow">{researchGroups.find((g) => g.chapters.includes(item.no))?.name}</span><strong>{item.title}</strong><span>{item.summary}</span></span><span className="research-entry-period">{item.period}</span><span className="research-entry-arrow" aria-hidden="true">↗</span></button></li>)}</ol>
        <p className="editorial-note">과거 기획과 수정안은 당시의 기록입니다. 현재 전시의 동선과 구현은 실제 관람 화면을 따릅니다.</p>
      </div>
    </div>
    <div ref={detailRef} className="research-detail editorial-scroll" hidden={!chapter} tabIndex={0}>
      {chapter ? <article key={chapter.no} className="editorial-container research-article">
        <button className="editorial-text-button research-back" onClick={back}>← 연구 목록으로</button>
        <header className="editorial-page-heading"><p className="editorial-eyebrow">RESEARCH {chapter.no} / {chapter.period}</p><h1>{chapter.title}</h1><p>{chapter.summary}</p></header>
        <ol className="research-guide">{researchGuides[chapter.no].map((text, i) => <li key={i}><span><small>0{i + 1}</small>{['질문', '실험', '관찰', '판단', '반영'][i]}</span><p>{text}</p></li>)}</ol>
        <details className="research-original"><summary>원본 자료와 상세 과정 펼쳐 보기 <span aria-hidden="true">＋</span></summary>
          {chapter.no === '01' ? <div className="research-evidence">
            <p className="editorial-eyebrow">BLUR-01 / 원본과 AI 재구성</p>
            <div>{['직접 촬영한 원본', '모호함 유지 요청', '선명화 요청'].map((alt, i) => <figure key={alt}><CatalogImage image={{ src: `archive/blur-${i + 1}.webp`, alt, ratio: '4 / 5' }} onOpen={onOpen} /><figcaption>{alt}</figcaption></figure>)}</div>
            <p className="editorial-eyebrow">사이의 상태 / 시각 언어 실험</p>
            <div>{['빛의 물성', '반투명 레이어', '번짐과 스며듦', '잔상과 움직임'].map((alt, i) => <figure key={alt}><CatalogImage image={{ src: `archive/between-${i + 1}.webp`, alt, ratio: '1 / 1' }} onOpen={onOpen} /><figcaption>{alt}</figcaption></figure>)}</div>
          </div> : null}
          <ArchiveDocument no={chapter.no} onOpen={onOpen} />
        </details>
        <footer className="research-reader-footer"><button className="editorial-text-button" onClick={back}>← 연구 목록으로</button>{Number(chapter.no) < 11 ? <button className="editorial-text-button" onClick={() => onSelect(String(Number(chapter.no) + 1).padStart(2, '0'))}>다음 기록 →</button> : null}</footer>
      </article> : null}
    </div>
  </div>;
}
