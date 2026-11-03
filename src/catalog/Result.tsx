import { useEffect, useRef, useState } from 'react';
import { imageUrl, type OpenImage } from './CatalogImage';
import { resultCollections } from './editorialContent';

export function Result({ onOpen, visible }: { onOpen: OpenImage; visible: boolean }) {
  const [collection, setCollection] = useState<'web' | 'print'>('web');
  const [position, setPosition] = useState(0);
  const [spread, setSpread] = useState(true);
  const [requested, setRequested] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fullSize, setFullSize] = useState(false);
  const webRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (visible && collection === 'web') setRequested(true); }, [visible, collection]);
  const book = resultCollections.print;
  const shown = book.pages.slice(position, position + (spread ? 2 : 1));
  const source = imageUrl(resultCollections.web.file);
  return <div className="result-original-shell" id="panel-result" role="tabpanel" aria-labelledby="tab-result">
    <div className="result-original-toolbar">
      <div role="group" aria-label="도록 종류"><button aria-pressed={collection === 'web'} onClick={() => setCollection('web')}>웹도록</button><button aria-pressed={collection === 'print'} onClick={() => setCollection('print')}>인쇄도록</button></div>
      {collection === 'web' ? <div><button aria-pressed={fullSize} onClick={() => setFullSize(!fullSize)}>{fullSize ? '화면 너비로 보기' : '원본 크기로 보기'}</button><a href={source} download="UNANSWERED-web-catalogue.png">원본 내려받기 ↙</a></div> : <div role="group" aria-label="인쇄도록 보기 방식"><button aria-pressed={!spread} onClick={() => setSpread(false)}>한 면</button><button aria-pressed={spread} onClick={() => { setSpread(true); setPosition(position - position % 2); }}>펼침면</button></div>}
    </div>
    <div ref={webRef} className={`result-original-scroll${fullSize ? ' is-full-size' : ''}`} hidden={collection !== 'web'} tabIndex={0} aria-label="웹도록 원본" aria-busy={requested && !loaded && !failed}>
      {requested ? <>
        {!loaded && !failed ? <p className="original-loading" role="status">웹도록을 불러오고 있습니다.</p> : null}
        {failed ? <p className="original-loading" role="alert">웹도록을 불러오지 못했습니다. <a href={resultCollections.web.source} target="_blank" rel="noreferrer">Figma 원본 보기 ↗</a></p> : null}
        <img className="original-catalogue" src={source} alt="UNANSWERED 웹도록 원본 전체" width={resultCollections.web.width} height={resultCollections.web.height} decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      </> : null}
    </div>
    <div ref={printRef} className="result-print-scroll editorial-scroll" hidden={collection !== 'print'} tabIndex={0} aria-label="인쇄도록 내지">
      <div className="editorial-container">
        <div className="result-reader result-reader--print">
          <figure className="result-page"><div className={spread ? `result-spread${shown.length === 1 ? ' result-spread--single' : ''}` : undefined}>{shown.map((item) => <button key={item.src} className="result-page-image" onClick={() => onOpen(imageUrl(item.src), `인쇄도록 · ${item.title}`)} aria-label={`인쇄도록 ${item.title} 확대`}><img src={imageUrl(item.src)} alt={`인쇄도록 · ${item.title}`} width={item.width} height={item.height} decoding="async" /></button>)}</div><figcaption><span>인쇄도록 내지</span><span>각 면을 눌러 확대</span></figcaption></figure>
          <nav className="result-contents" aria-label="인쇄도록 목차"><ol>{book.pages.map((item, i) => <li key={item.src}><button aria-current={position === i ? 'page' : undefined} onClick={() => setPosition(i)}><img src={imageUrl(item.src.replace('.webp', '-thumb.webp'))} alt="" loading="lazy" width={72} height={48} /><span><small>{String(i + 1).padStart(2, '0')}</small>{item.title}</span></button></li>)}</ol></nav>
        </div>
        <div className="result-pagination"><button disabled={position === 0} onClick={() => setPosition(Math.max(0, position - (spread ? 2 : 1)))}>← 이전</button><p aria-live="polite"><span>{String(position + 1).padStart(2, '0')}{shown.length > 1 ? `–${String(position + shown.length).padStart(2, '0')}` : ''}</span> / 03</p><button disabled={position + (spread ? 2 : 1) >= book.pages.length} onClick={() => setPosition(position + (spread ? 2 : 1))}>다음 →</button></div>
      </div>
    </div>
  </div>;
}
