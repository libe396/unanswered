import { useId, useState, useRef, useLayoutEffect } from 'react';
import { MEMORY_ROOM_OBJECTS } from '../data/content';
import { ROOM_HEIGHT, ROOM_OBJECT_GEOMETRY, ROOM_WIDTH } from '../data/memoryRoomGeometry';
import roomIllustrationUrl from '../assets/memory/room-final.png';
import './MemoryRoom.css';

interface MemoryRoomProps {
  selectedIds: readonly string[];
  onSelectToggle: (id: string) => void;
  onViewStart: (id: string) => void;
  onViewEnd: (id: string) => void;
  interactive?: boolean;
  showSelectionMarkers?: boolean;
  /** Only the selection scene advertises unselected objects in warm grey.
   * Reports keep the original dark room and show committed selections. */
  showAvailableObjects?: boolean;
  highlightIds?: readonly string[];
  highlightsVisible?: boolean;
}

export function MemoryRoom({
  selectedIds, onSelectToggle, onViewStart, onViewEnd,
  interactive = true, showSelectionMarkers = false, showAvailableObjects = false,
  highlightIds = [], highlightsVisible = false,
}: MemoryRoomProps) {
  const instanceId = useId().replace(/:/g, '');
  const artRef = useRef<SVGSVGElement>(null);
  const [labelScale, setLabelScale] = useState(1);
  useLayoutEffect(() => {
    const svg = artRef.current;
    if (!svg) return;
    const measure = () => {
      const matrix = svg.getScreenCTM();
      if (matrix) setLabelScale(1 / Math.max(0.01, Math.hypot(matrix.a, matrix.b)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(svg); measure();
    return () => observer.disconnect();
  }, []);

  const [pointerId, setPointerId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const activeId = interactive ? pointerId ?? focusId : null;
  const paintedObjects = ROOM_OBJECT_GEOMETRY.filter(({ id }) => showAvailableObjects || selectedIds.includes(id));
  const activeObject = ROOM_OBJECT_GEOMETRY.find(({ id }) => id === activeId);
  const labelFor = (id: string) => MEMORY_ROOM_OBJECTS.find((object) => object.id === id)?.label ?? id;

  return (
    <div className={`memory-room${interactive ? ' memory-room--interactive' : ''}`}>
      <svg ref={artRef} className="memory-room__art" viewBox={`0 0 ${ROOM_WIDTH} ${ROOM_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet" role="group" aria-label="기억 속 방">
        <defs>
          <clipPath id={`${instanceId}-paint`}>
            {paintedObjects.map(({ id, path }) => <path key={id} d={path} clipRule={id === 'cup' || id === 'window' ? 'evenodd' : 'nonzero'} />)}
          </clipPath>
          {/* Extract ONLY the original bright pencil lines into a dark alpha
              overlay. The source image below is unfiltered and unmodified.
              This retains interior detail on opaque warm grey/lavender surfaces. */}
          <filter id={`${instanceId}-ink`} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
            <feColorMatrix type="matrix" values="0 0 0 0 0.10  0 0 0 0 0.09  0 0 0 0 0.13  0.85 0.85 0.85 0 -0.34" />
          </filter>
        </defs>
        <image href={roomIllustrationUrl} width={ROOM_WIDTH} height={ROOM_HEIGHT} aria-hidden="true" />
        <g className="memory-room__paint" aria-hidden="true">
          {paintedObjects.map(({ id, path }) => (
            <path key={id} d={path} fillRule={id === 'cup' || id === 'window' ? 'evenodd' : 'nonzero'}
              className={`memory-room__fill${selectedIds.includes(id) ? ' memory-room__fill--selected' : activeId === id ? ' memory-room__fill--hover' : ''}`} />
          ))}
        </g>
        <g className={`memory-room__unselected${highlightsVisible ? ' memory-room__unselected--visible' : ''}`} aria-hidden="true">
          {ROOM_OBJECT_GEOMETRY.filter(({ id }) => highlightIds.includes(id) && !selectedIds.includes(id)).map(({ id, path }) => <path key={id} data-object-id={id} d={path} fillRule={id === 'cup' || id === 'window' ? 'evenodd' : 'nonzero'} />)}
        </g>
        <g clipPath={`url(#${instanceId}-paint)`} className="memory-room__ink" aria-hidden="true">
          <image href={roomIllustrationUrl} width={ROOM_WIDTH} height={ROOM_HEIGHT} filter={`url(#${instanceId}-ink)`} />
        </g>
        {interactive ? <g>
          {ROOM_OBJECT_GEOMETRY.map(({ id, path }) => (
            <path key={id} d={path} fillRule={id === 'cup' || id === 'window' ? 'evenodd' : 'nonzero'} className="memory-room__target"
              role="button" tabIndex={0} aria-label={labelFor(id)} aria-pressed={selectedIds.includes(id)}
              onPointerEnter={(event) => {
                if (event.pointerType === 'touch') return;
                setPointerId(id);
                if (focusId !== id) onViewStart(id);
              }}
              onPointerLeave={() => {
                setPointerId((current) => current === id ? null : current);
                if (focusId !== id) onViewEnd(id);
              }}
              onFocus={(event) => {
                // Pointer focus must not leave a hover colour behind after exit.
                if (!event.currentTarget.matches(':focus-visible')) return;
                setFocusId(id);
                if (pointerId !== id) onViewStart(id);
              }}
              onBlur={() => {
                setFocusId((current) => current === id ? null : current);
                if (pointerId !== id) onViewEnd(id);
              }}
              onClick={() => onSelectToggle(id)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                if (!event.repeat) onSelectToggle(id);
              }} />
          ))}
        </g> : null}
        {showSelectionMarkers ? <g className="memory-room__annotations" aria-hidden="true">
          {selectedIds.map((id, index) => {
            const object = ROOM_OBJECT_GEOMETRY.find((item) => item.id === id);
            if (!object) return null;
            return <g key={id} transform={`translate(${object.marker.join(' ')}) scale(${labelScale})`}>
              <rect x="-23" y="-23" width="46" height="38" rx="4" />
              <text y="5" textAnchor="middle">{String(index + 1).padStart(2, '0')}</text>
            </g>;
          })}
        </g> : null}
        {activeObject ? <g className="memory-room__annotations memory-room__label" aria-hidden="true"
          transform={`translate(${activeObject.marker[0]} ${activeObject.marker[1] + 45 * labelScale}) scale(${labelScale})`}>
          <rect x={-Math.max(112, labelFor(activeObject.id).length * 18 + 24) / 2}
            y="-21" width={Math.max(112, labelFor(activeObject.id).length * 18 + 24)} height="40" rx="4" />
          <text y="7" textAnchor="middle">{labelFor(activeObject.id)}</text>
        </g> : null}
      </svg>
    </div>
  );
}
