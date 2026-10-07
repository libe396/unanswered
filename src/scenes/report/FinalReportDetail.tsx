import { useEffect, useRef, useState } from 'react';
import type { FinalReportPresentation } from '../../lib/finalReportPresentation';
import type { PersonalFinding } from '../../lib/personalFindingInterpretation';
import type { RecordLayerDerived } from '../../types';
import { useExperienceStore } from '../../store/experienceStore';
import { buildActionEvidence, PROCESS_GUIDE, RECORD_MEANING } from '../../lib/reportActionEvidence';
import { renderLightGraphic } from '../../lib/lightRenderer.js';
import { MEMORY_ROOM_OBJECTS } from '../../data/content';
import { MemoryRoom } from '../../components/MemoryRoom';
import { drawStrokes } from '../../lib/memorySketch';
import { ROOM_WIDTH, ROOM_HEIGHT } from '../../data/memoryRoomGeometry';
import { copyText } from '../../lib/reportShare';
import { SpecimenGlyph } from '../../components/SoundSpecimenGlyph';
import { soundPositionMeaning } from '../../lib/soundPositionMeaning';
import { SOUND_CLUES } from '../../data/content';
import { FindingRecordGraphic } from './FindingRecordGraphic';
import { ReportQr } from './ReportQr';
import './FinalReportDetail.css';

interface Props {
  record: RecordLayerDerived;
  presentation: FinalReportPresentation;
  findings: readonly PersonalFinding[];
  reportUrl: string;
  venue: boolean;
  onIssueFullReport: () => void;
}

export function FinalReportDetail({ record, presentation, findings, reportUrl, venue, onIssueFullReport }: Props) {
  const light = useRef<HTMLCanvasElement>(null);
  const sketch = useRef<HTMLCanvasElement>(null);
  const behavior = useExperienceStore(s => s.behavior);
  const evidence = buildActionEvidence(record, behavior);
  const [copied, setCopied] = useState(false);
  const { color, sound, sentence } = presentation;
  const chosenSound = SOUND_CLUES.find(item => item.id === record.soundClues.selectedSoundId);
  const positionMeaning = soundPositionMeaning(record.soundClues.memoryPosition);
  useEffect(() => {
    if (record.light && light.current) renderLightGraphic(light.current, record.light.rules, record.light.variation);
    const ctx = sketch.current?.getContext('2d');
    if (ctx && sketch.current) {
      ctx.clearRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);
      drawStrokes(ctx, record.memorySketch.strokes, ROOM_WIDTH, ROOM_HEIGHT, ROOM_WIDTH / 1200);
    }
  }, [record.light, record.memorySketch]);
  async function copyLink() {
    if (await copyText(reportUrl)) { setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  }
  return <article className="report-detail" aria-label="상세 최종보고서">
    <header className="report-detail__header">
      <p className="report-detail__masthead"><span>UNANSWERED ARCHIVE</span><span>INVESTIGATION RECORD</span></p>
      <div className="report-detail__cover"><div><p className="report-detail__code">FINAL REPORT</p><h1>최종보고서</h1></div><dl className="report-detail__metadata"><div><dt>기록 번호</dt><dd>{presentation.reportId}</dd></div><div><dt>발행 일시</dt><dd>{presentation.issuedAtLabel}</dd></div><div><dt>흔적을 남긴 관객</dt><dd>{presentation.ownerLabel}</dd></div></dl></div>
      <p className="report-detail__intro">{RECORD_MEANING}</p>

    </header>
    <section className="report-detail__analysis" aria-labelledby="report-analysis-title">
      <p className="report-detail__code">01 · 이번 기록의 해석</p>
      <h2 id="report-analysis-title">선택의 순간에 남은 흔적</h2>
      <p className="report-detail__analysis-guide">{PROCESS_GUIDE}</p>
      {findings.length ? findings.map((finding, index) => <article key={finding.id} className="report-detail__insight">
        <div className="report-detail__insight-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
        <div>
          <p className="report-detail__code">{finding.evidence.map(item => item.scene).filter((scene, i, scenes) => scenes.indexOf(scene) === i).join(' · ')}</p>
          <h3>{finding.headline}</h3>
          <p className="report-detail__interpretation">{finding.interpretation}</p>
          <p className="report-detail__question">{finding.reflection}</p>
          {finding.id === 'no-convergence' && <p className="report-detail__date">이번 방문의 움직임은 하나의 반복된 방식으로 묶이지 않았습니다.</p>}
          <details><summary>이 해석의 근거 살펴보기</summary>
            <p>{finding.pattern}</p>
            <ul>{finding.evidence.map((item,i)=><li key={`${item.zone}-${i}`}><strong>{item.scene}</strong><p>{item.description}</p><p className="report-detail__date">{item.metrics.join(' · ')}</p></li>)}</ul>
            <p className="report-detail__date">머문 시간에는 읽기와 조작 시간이 포함되며, 그 이유까지 알 수는 없습니다.</p>
          </details>
        </div>
        <div className="report-detail__insight-art"><FindingRecordGraphic finding={finding} /></div>
      </article>) : <p className="report-detail__interpretation">남겨진 선택은 기록했지만, 선택들 사이의 관계를 해석할 근거는 충분하지 않았습니다.</p>}
      <details><summary>실제 행동 기록 살펴보기</summary>{evidence.length ? evidence.map(item=><p key={item.text}>{item.text}</p>) : <p>확인할 수 있는 선택 기록이 없습니다.</p>}</details>
    </section>
    <section className="report-detail__light">
      <figure className="report-detail__light-art">
        {record.light ? <canvas ref={light} width={1000} height={1000} aria-label="고른 사진에서 이어진 빛 그래픽" role="img" /> : <p>기록된 빛의 흔적이 없습니다.</p>}
        <figcaption>FIG. 01 · 고른 사진에서 이어진 빛</figcaption>
      </figure>
      <div>
        <p className="report-detail__code">02 · 빛의 흔적</p>
        <h2>단서가 남긴 빛</h2>
        <p>{color.description}</p>
        {color.dominantHex && <p className="report-detail__date">{color.dominantHex.toUpperCase()} · {color.temperatureLabel}</p>}
        <details className="report-detail__photo-details"><summary>사진과 색 기록 살펴보기</summary>
          <div className="report-detail__photo-content" tabIndex={0} role="region" aria-label="사진과 색 상세 기록">
          {record.light?.imagePath && <img className="report-detail__source" src={record.light.imagePath} alt="선택한 원본 사진" />}
          <ul className="report-detail__palette">{color.paletteSwatches.map((hex,i)=><li key={`${hex}-${i}`}><span style={{background:hex}} />{hex.toUpperCase()}</li>)}</ul>
          <p>중심 빛 {color.centerLightHex?.toUpperCase() ?? '기록 없음'} · 배경 잔상 {color.residueHex?.toUpperCase() ?? '기록 없음'}</p>
          </div>
        </details>
      </div>
    </section>
    <div className="report-detail__clues">
      <section>
        <p className="report-detail__code">03 · 소리의 흔적</p>
        <h2>{sound.hasSound ? sound.label : '기록된 소리가 없습니다'}</h2>
        {chosenSound && <div className="report-detail__sound-object" aria-hidden="true"><div className="report-detail__sound-shell"><SpecimenGlyph clue={chosenSound} /></div><span /></div>}
        <p>{sound.sensation}</p>
        {positionMeaning && <><p className="report-detail__question">{positionMeaning}</p><p className="report-detail__date">같은 소리라도 누군가에게는 가까이, 누군가에게는 멀리 남을 수 있습니다. 이 위치는 당신이 떠올린 기억의 모습입니다.</p></>}
        {sound.dwellSeconds !== null && <p className="report-detail__date">머문 시간 {sound.dwellSeconds}초</p>}
      </section>
      <section>
        <p className="report-detail__code">04 · 기억의 흔적</p>
        <h2>기억 속에서 고른 물건</h2>
        <div className="report-detail__memory">
          <MemoryRoom selectedIds={record.memorySketch.selectedObjects} onSelectToggle={()=>{}} onViewStart={()=>{}} onViewEnd={()=>{}} interactive={false} />
          <canvas ref={sketch} width={ROOM_WIDTH} height={ROOM_HEIGHT} aria-hidden="true" />
        </div>
        <p>{record.memorySketch.selectedObjects.map(id=>MEMORY_ROOM_OBJECTS.find(item=>item.id===id)?.label).filter(Boolean).join(' · ') || '선택한 물건이 없습니다.'}</p>
        {record.memorySketch.strokes.length === 0 && <p className="report-detail__date">그림은 남기지 않았습니다.</p>}
      </section>
    </div>
    <section className="report-detail__section">
      <p className="report-detail__code">05 · 문장의 흔적</p>
      <h2>그날, 이 방에서 있었던 일</h2>
      <div className="report-detail__story report-detail__story--cards">{sentence.selectedSentences.length ? sentence.selectedSentences.map((line,i)=><p key={i}><span className="report-detail__card-number">{String(i + 1).padStart(2, '0')}</span>{line}</p>) : <p>기록된 문장이 없습니다.</p>}</div>
      <div className="report-detail__response"><p className="report-detail__code">덧붙인 기록</p><p>{sentence.authoredResponse || (record.sentenceClues.responseSkipped ? '빈칸으로 남겼습니다.' : '덧붙인 문장이 없습니다.')}</p></div>
    </section>
    {!venue && <footer className="report-detail__take">
      <div><h2>이 기록을 가져가세요</h2><p>QR을 찍으면 휴대폰에서 요약본을 확인할 수 있습니다.</p>
        <button className="cta cta--text" onClick={copyLink}>{copied ? '복사했습니다' : '요약본 링크 복사'}</button>
        <button className="cta cta--text" onClick={onIssueFullReport}>전체 조사 기록 발급하기</button>
      </div><ReportQr url={reportUrl} size={260} />
    </footer>}
  </article>;
}
