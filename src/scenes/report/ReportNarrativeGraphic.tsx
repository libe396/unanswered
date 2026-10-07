import { useId } from 'react';

/** A narrative motif, deliberately not a count or measurement of this visitor. */
export function ReportNarrativeGraphic({ variant, phase }: { variant: 'method' | 'closing'; phase: number }) {
  const id = useId().replace(/:/g, '');
  const closing = variant === 'closing';
  return <svg className={`report-narrative-graphic report-narrative-graphic--${variant}`} viewBox="0 0 560 260" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-pane`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#d7caff" stopOpacity=".16" />
        <stop offset=".5" stopColor="#a58aca" stopOpacity=".02" />
        <stop offset="1" stopColor="#9980d0" stopOpacity=".12" />
      </linearGradient>
      <radialGradient id={`${id}-glow`}>
        <stop stopColor="#e9dfff" stopOpacity=".6" />
        <stop offset=".2" stopColor="#bfa3ff" stopOpacity=".18" />
        <stop offset="1" stopColor="#a084e0" stopOpacity="0" />
      </radialGradient>
    </defs>
    <g className="finding-record__layer">
      <ellipse cx="280" cy="221" rx="160" ry="25" fill={`url(#${id}-glow)`} opacity=".3" />
      {[0, 1, 2].map(i => <path key={i} d={`M 110 ${110 + i * 25} L 280 ${52 + i * 25} L 450 ${110 + i * 25} L 280 ${168 + i * 25} Z`} fill={`url(#${id}-pane)`} stroke="#b6a1e6" strokeWidth=".7" strokeOpacity=".24" />)}
      {closing ? <>
        <path d="M 218 132 L 280 110 L 342 132 L 280 154 Z" fill="#0a090e" fillOpacity=".75" stroke="#bba4ee" strokeOpacity=".45" strokeWidth=".8" />
        <circle cx="198" cy="151" r="25" fill={`url(#${id}-glow)`} />
        <circle cx="198" cy="151" r="2.5" fill="#dfd2ff" />
        <circle cx="366" cy="127" r="25" fill={`url(#${id}-glow)`} />
        <circle cx="366" cy="127" r="2.5" fill="#dfd2ff" />
      </> : <>
        <path d="M 182 119 C 234 94 242 154 280 135 S 334 112 378 141" fill="none" stroke="#c4acef" strokeOpacity=".45" strokeWidth=".8" />
        {[{ x: 182, y: 119 }, { x: 280, y: 135 }, { x: 378, y: 141 }].map((point, i) => <g key={i} opacity={phase === 0 && i !== 1 ? .3 : 1}>
          <circle cx={point.x} cy={point.y} r="28" fill={`url(#${id}-glow)`} />
          <circle cx={point.x} cy={point.y} r="2.7" fill="#e8dcff" />
        </g>)}
      </>}
    </g>
  </svg>;
}
