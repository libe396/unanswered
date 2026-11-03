import { useEffect, useState } from 'react';
import { imageUrl } from './CatalogImage';
import { resultCollections } from './editorialContent';

export function Result({ visible }: { visible: boolean }) {
  const [requested, setRequested] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [fullSize, setFullSize] = useState(false);
  // The web catalogue is the untouched original (~48MB), so a phone asks first.
  const [narrow] = useState(() => window.matchMedia('(max-width: 760px)').matches);
  useEffect(() => { if (visible && !narrow) setRequested(true); }, [visible, narrow]);
  const source = imageUrl(resultCollections.web.file);
  return <div className="result-original-shell" id="panel-result" role="tabpanel" aria-labelledby="tab-result">
    <div className="result-original-toolbar">
      <button aria-pressed={fullSize} onClick={() => setFullSize(!fullSize)}>{fullSize ? '화면 너비로 보기' : '원본 크기로 보기'}</button>
      <a href={source} download="UNANSWERED-web-catalogue.png">원본 내려받기 ↙</a>
    </div>
    <div className={`result-original-scroll${fullSize ? ' is-full-size' : ''}`} tabIndex={0} aria-label="웹도록 원본" aria-busy={requested && !loaded && !failed}>
      {requested ? <>
        {!loaded && !failed ? <p className="original-loading" role="status">웹도록을 불러오고 있습니다.</p> : null}
        {failed ? <p className="original-loading" role="alert">웹도록을 불러오지 못했습니다. <a href={resultCollections.web.source} target="_blank" rel="noreferrer">Figma 원본 보기 ↗</a></p> : null}
        <img className="original-catalogue" src={source} alt="UNANSWERED 웹도록 원본 전체" width={resultCollections.web.width} height={resultCollections.web.height} decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />
      </> : <p className="original-loading">웹도록 원본은 한 장짜리 이미지로 약 48MB입니다. <button className="editorial-text-button" onClick={() => setRequested(true)}>원본 불러오기 ↓</button></p>}
    </div>
  </div>;
}
