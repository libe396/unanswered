import { useEffect, useRef } from 'react';
import { renderLightGraphic } from '../../lib/lightRenderer.js';
import { drawStrokes } from '../../lib/memorySketch';
import { MemoryRoom } from '../../components/MemoryRoom';
import type { RecordLayerDerived, ReportData, SceneId } from '../../types';
import './ReportEvidenceVisual.css';

type EvidenceMode = 'return' | 'hold' | 'converge';

interface ReportEvidenceVisualProps {
  sceneId: SceneId;
  record: RecordLayerDerived;
  report: ReportData;
  mode?: EvidenceMode;
  label?: string;
  /** Guide Voice tag shown below the frame — distinct from `label`, which is
   *  the System Voice scene tag shown inside it (see FinalRecordLayer.tsx's
   *  personalized evidence row). */
  caption?: string;
  className?: string;
}

const SCENE_LABEL: Partial<Record<SceneId, string>> = {
  lightArchive: 'LIGHT',
  soundClues: 'SOUND',
  sentenceClues: 'SENTENCE',
  memorySketch: 'MEMORY',
};

function soundBars(record: RecordLayerDerived) {
  const events = record.soundClues.events;
  const maxPlayedMs = Math.max(1, ...events.map((event) => event.totalPlayedMs));
  if (events.length === 0) {
    return <span className="report-evidence-visual__sound-bar" style={{ height: '38%' }} />;
  }
  return events.slice(0, 7).map((event) => (
    <span
      key={event.soundId}
      className={`report-evidence-visual__sound-bar${
        event.completedFully ? ' report-evidence-visual__sound-bar--full' : ''
      }${event.skipped ? ' report-evidence-visual__sound-bar--skipped' : ''}`}
      style={{ height: `${Math.max(14, (event.totalPlayedMs / maxPlayedMs) * 100)}%` }}
    />
  ));
}

export function evidenceCopy(sceneId: SceneId, mode: EvidenceMode = 'return'): string {
  if (mode === 'hold') {
    const copy: Partial<Record<SceneId, string>> = {
      lightArchive: '이 빛 앞에서\n조금 더 오래 머물렀습니다.',
      soundClues: '이 소리 앞에서\n조금 더 오래 멈췄습니다.',
      sentenceClues: '이 문장 앞에서\n조금 더 오래 머물렀습니다.',
      memorySketch: '마지막 방 앞에서\n조금 더 오래 머물렀습니다.',
    };
    return copy[sceneId] ?? '이 장면 앞에서\n조금 더 오래 머물렀습니다.';
  }

  const copy: Partial<Record<SceneId, string>> = {
    lightArchive: '이 빛을\n다시 보았습니다.',
    soundClues: '이 소리를\n한 번 더 들었습니다.',
    sentenceClues: '이 문장 조각을\n다시 살펴보았습니다.',
    memorySketch: '이 방의 흔적을\n다시 확인했습니다.',
  };
  return copy[sceneId] ?? '한 번 지나친 것을\n다시 확인했습니다.';
}

export function ReportEvidenceVisual({
  sceneId,
  record,
  report,
  mode = 'return',
  label,
  caption,
  className = '',
}: ReportEvidenceVisualProps) {
  const lightCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sketchCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!record.light || !lightCanvasRef.current) return;
    renderLightGraphic(lightCanvasRef.current, record.light.rules, record.light.variation);
  }, [record.light]);

  useEffect(() => {
    const canvas = sketchCanvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    drawStrokes(context, record.memorySketch.strokes, canvas.width, canvas.height);
  }, [record.memorySketch]);

  return (
    <div className={`report-evidence-visual report-evidence-visual--${mode} ${className}`}>
      <span className="report-evidence-visual__label">{label ?? SCENE_LABEL[sceneId] ?? 'TRACE'}</span>

      <div className="report-evidence-visual__frame">
        {sceneId === 'lightArchive' ? (
          <>
            <canvas ref={lightCanvasRef} width={800} height={800} className="report-evidence-visual__canvas" />
            {report.imagePath ? (
              <img src={report.imagePath} alt="" className="report-evidence-visual__source-image" />
            ) : null}
          </>
        ) : null}

        {sceneId === 'soundClues' ? (
          <div className="report-evidence-visual__sound">
            <span className="report-evidence-visual__sound-name">{report.selectedSoundLabel}</span>
            <span className="report-evidence-visual__sound-trace" aria-hidden="true">
              {soundBars(record)}
            </span>
          </div>
        ) : null}

        {sceneId === 'sentenceClues' ? (
          <p className="report-evidence-visual__sentence">
            {report.customSentence || report.selectedSentences.join(' ') || '기록된 문장 없음'}
          </p>
        ) : null}

        {sceneId === 'memorySketch' ? (
          <div className="report-evidence-visual__memory">
            <MemoryRoom
              selectedIds={record.memorySketch.selectedObjects}
              onSelectToggle={() => {}}
              onViewStart={() => {}}
              onViewEnd={() => {}}
              interactive={false}
            />
            <canvas ref={sketchCanvasRef} width={900} height={600} className="report-evidence-visual__sketch" />
          </div>
        ) : null}
      </div>

      {caption ? <span className="report-evidence-visual__caption">{caption}</span> : null}
    </div>
  );
}
