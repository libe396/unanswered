import { useId } from 'react';
import type { PersonalFinding } from '../../lib/personalFindingInterpretation';

/** One glass layer and light per recorded evidence item; symbolic, not a chart. */
export function FindingRecordGraphic({ finding }: { finding: PersonalFinding }) {
  const id = useId().replace(/:/g, '');
  const count = finding.evidence.length;
  return <svg className="finding-record" viewBox="0 0 560 320" role="img" aria-label={`${count}개의 근거 기록을 빛으로 표현한 유리 기록물`}>
    <defs>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#d5ccff" stopOpacity=".17" />
        <stop offset=".5" stopColor="#9586cc" stopOpacity=".025" />
        <stop offset="1" stopColor="#8270bf" stopOpacity=".11" />
      </linearGradient>
      <radialGradient id={`${id}-light`}>
        <stop stopColor="#e9e1ff" stopOpacity=".6" />
        <stop offset=".25" stopColor="#baa3ff" stopOpacity=".2" />
        <stop offset="1" stopColor="#9e81eb" stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse cx="280" cy="281" rx="165" ry="24" fill={`url(#${id}-light)`} opacity=".35" />
    {finding.evidence.map((item, index) => {
      const y = 112 + index * Math.min(36, 112 / Math.max(1, count - 1));
      // Stable positions identify different records without implying a measured axis.
      const seed = Array.from(`${item.zone}:${item.description}`).reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const x = 220 + seed % 121;
      const lightY = y + (seed % 27) - 13;
      return <g key={`${item.zone}-${index}`} className="finding-record__layer" style={{ animationDelay: `${index * 110}ms` }}>
        <path d={`M 104 ${y} L 280 ${y - 62} L 456 ${y} L 280 ${y + 62} Z`} fill={`url(#${id}-glass)`} stroke="#b9a5ee" strokeOpacity=".28" strokeWidth=".7" />
        <path d={`M 104 ${y} L 104 ${y + 3} L 280 ${y + 65} L 456 ${y + 3} L 456 ${y}`} fill="none" stroke="#b9a5ee" strokeOpacity=".12" strokeWidth=".7" />
        <circle cx={x} cy={lightY} r="30" fill={`url(#${id}-light)`} />
        <circle cx={x} cy={lightY} r="3" fill="#e6dcff" />
        <circle cx={x} cy={lightY} r="6.5" fill="none" stroke="#c9b4ff" strokeOpacity=".3" strokeWidth=".6" />
      </g>;
    })}
  </svg>;
}
