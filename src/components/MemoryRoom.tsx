import { useState } from 'react';
import { MEMORY_ROOM_OBJECTS, SKETCH_COLORS } from '../data/content';
import roomIllustrationUrl from '../assets/memory/room-illustration.png';
import './MemoryRoom.css';

interface MemoryRoomProps {
  selectedIds: readonly string[];
  onSelectToggle: (id: string) => void;
  onViewStart: (id: string) => void;
  onViewEnd: (id: string) => void;
  /**
   * False once the Room's own question is behind the visitor — the optional
   * Drawing step shows the same Room, with the same objects still washed in
   * color, as the surface it draws on, but selection is already committed by
   * then and nothing should still be answering `object` events. The
   * interaction layer is simply not rendered in that case, so the art keeps
   * showing exactly as it did without offering a control that would fire
   * tracking calls after `commit('object')` already ran. Defaults to true.
   */
  interactive?: boolean;
}

/** Intrinsic pixel size of room-illustration.png — the coordinate space
 *  OBJECT_BOXES and OBJECT_GLOW_BOXES below are both measured against. Only
 *  used to keep that measurement legible; every box is stored and applied
 *  as a 0–1 fraction, so layout never depends on these numbers at render
 *  time. */
const ROOM_IMAGE_WIDTH = 1536;
const ROOM_IMAGE_HEIGHT = 1024;

/**
 * Where each object's hit-area sits in the reference illustration, as a
 * fraction (0–1) of its width/height rather than intrinsic pixels — so a
 * hit-area keeps sitting on top of its object no matter how the room image
 * is resized by the browser. The room's aspect ratio is locked (see
 * MemoryRoom.css), so a uniform percentage scale is all resizing ever does
 * to it.
 *
 * This is the *only* coordinate table interaction code ever reads — see
 * OBJECT_GLOW_BOXES below for the separate, purely visual table that decides
 * where color appears. Unchanged by that table's shape or values.
 *
 * Measured directly against src/assets/memory/room-illustration.png
 * (1536×1024) by eye by overlaying a pixel grid. Every id here still means
 * the same thing it always has (see MEMORY_ROOM_OBJECTS).
 */
const OBJECT_BOXES: Record<string, { x: number; y: number; width: number; height: number }> = {
  window: { x: 585 / ROOM_IMAGE_WIDTH, y: 210 / ROOM_IMAGE_HEIGHT, width: 250 / ROOM_IMAGE_WIDTH, height: 358 / ROOM_IMAGE_HEIGHT },
  lamp: { x: 422 / ROOM_IMAGE_WIDTH, y: 388 / ROOM_IMAGE_HEIGHT, width: 102 / ROOM_IMAGE_WIDTH, height: 398 / ROOM_IMAGE_HEIGHT },
  book: { x: 728 / ROOM_IMAGE_WIDTH, y: 572 / ROOM_IMAGE_HEIGHT, width: 184 / ROOM_IMAGE_WIDTH, height: 54 / ROOM_IMAGE_HEIGHT },
  photo: { x: 170 / ROOM_IMAGE_WIDTH, y: 264 / ROOM_IMAGE_HEIGHT, width: 140 / ROOM_IMAGE_WIDTH, height: 226 / ROOM_IMAGE_HEIGHT },
  cup: { x: 855 / ROOM_IMAGE_WIDTH, y: 562 / ROOM_IMAGE_HEIGHT, width: 60 / ROOM_IMAGE_WIDTH, height: 53 / ROOM_IMAGE_HEIGHT },
  chair: { x: 140 / ROOM_IMAGE_WIDTH, y: 546 / ROOM_IMAGE_HEIGHT, width: 284 / ROOM_IMAGE_WIDTH, height: 424 / ROOM_IMAGE_HEIGHT },
  bag: { x: 1122 / ROOM_IMAGE_WIDTH, y: 720 / ROOM_IMAGE_HEIGHT, width: 246 / ROOM_IMAGE_WIDTH, height: 255 / ROOM_IMAGE_HEIGHT },
  bedside: { x: 800 / ROOM_IMAGE_WIDTH, y: 648 / ROOM_IMAGE_HEIGHT, width: 110 / ROOM_IMAGE_WIDTH, height: 158 / ROOM_IMAGE_HEIGHT },
};

interface GlowBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Blur radius in CSS px at the room's natural render width (~1000px).
   *  Larger, coarser objects (chair, bag, window) get more; small ones
   *  (cup, photo, book, bedside) get less, so the blur softens the
   *  gradient's edge without diluting the glow to nothing. */
  blur: number;
  /** Multiplies the opacity classes in MemoryRoom.css. A glow box this
   *  small still has to read at a glance next to a chair-sized one at the
   *  same base opacity, so the smallest objects get a modest boost rather
   *  than a separate opacity scale of their own. */
  opacityMultiplier: number;
}

/**
 * Where a selected/hovered object's color trace appears — a purely visual
 * table, never read by interaction or tracking code. This replaces two
 * earlier approaches in turn: a wash box sized to the hit-area (read as a
 * colored rectangle) and, after that, hand-traced polygon/ellipse
 * silhouettes (accurate, but a few misaligned pixels on a chair leg or a
 * bag strap read as *more* wrong than a soft approximation would have,
 * since precision itself was the visible promise).
 *
 * The shape this table draws is deliberately not the object's outline. It
 * is one soft ellipse per object, centered on the part of the drawing that
 * reads as "that object" — the backrest-and-seat of a chair, not its
 * splayed legs; the body of a bag, not its floor shadow — sized to sit
 * inside or a little past that area. A gradient that fades to fully
 * transparent well inside its own box (see MemoryRoom.css) means the box's
 * own edges are never what a visitor sees; only roughly where the color is
 * centered and how far it reaches matters here, not a tight fit.
 *
 * Same 0–1 fraction convention as OBJECT_BOXES, same source image, but a
 * completely independent set of numbers — this table is free to be smaller,
 * larger, or offset from OBJECT_BOXES as the drawing calls for.
 */
const OBJECT_GLOW_BOXES: Record<string, GlowBox> = {
  // Centered on the glass, spanning both panes — wider than tall, since a
  // window's own light reads as a horizontal wash, not a tall column.
  window: { x: 600 / ROOM_IMAGE_WIDTH, y: 270 / ROOM_IMAGE_HEIGHT, width: 220 / ROOM_IMAGE_WIDTH, height: 170 / ROOM_IMAGE_HEIGHT, blur: 7, opacityMultiplier: 1 },
  // A tall, narrow ellipse over the shade-and-stem, not the lamp's full
  // standing height — light left near the lamp, not a column painted down
  // its pole.
  lamp: { x: 418 / ROOM_IMAGE_WIDTH, y: 340 / ROOM_IMAGE_HEIGHT, width: 90 / ROOM_IMAGE_WIDTH, height: 280 / ROOM_IMAGE_HEIGHT, blur: 6, opacityMultiplier: 1 },
  book: { x: 746 / ROOM_IMAGE_WIDTH, y: 578 / ROOM_IMAGE_HEIGHT, width: 140 / ROOM_IMAGE_WIDTH, height: 55 / ROOM_IMAGE_HEIGHT, blur: 4, opacityMultiplier: 1.15 },
  photo: { x: 175 / ROOM_IMAGE_WIDTH, y: 301 / ROOM_IMAGE_HEIGHT, width: 110 / ROOM_IMAGE_WIDTH, height: 130 / ROOM_IMAGE_HEIGHT, blur: 4, opacityMultiplier: 1.15 },
  cup: { x: 860 / ROOM_IMAGE_WIDTH, y: 556 / ROOM_IMAGE_HEIGHT, width: 70 / ROOM_IMAGE_WIDTH, height: 65 / ROOM_IMAGE_HEIGHT, blur: 4, opacityMultiplier: 1.2 },
  // One large vertical ellipse over the backrest-and-seat — the chair's
  // center of mass as a visitor would point to it, not its four legs.
  chair: { x: 120 / ROOM_IMAGE_WIDTH, y: 490 / ROOM_IMAGE_HEIGHT, width: 280 / ROOM_IMAGE_WIDTH, height: 320 / ROOM_IMAGE_HEIGHT, blur: 7, opacityMultiplier: 1 },
  // Wide ellipse over the body — the handle is left to the natural falloff
  // rather than chased separately.
  bag: { x: 1100 / ROOM_IMAGE_WIDTH, y: 760 / ROOM_IMAGE_HEIGHT, width: 280 / ROOM_IMAGE_WIDTH, height: 180 / ROOM_IMAGE_HEIGHT, blur: 6, opacityMultiplier: 1 },
  bedside: { x: 790 / ROOM_IMAGE_WIDTH, y: 721 / ROOM_IMAGE_HEIGHT, width: 110 / ROOM_IMAGE_WIDTH, height: 90 / ROOM_IMAGE_HEIGHT, blur: 4, opacityMultiplier: 1.15 },
};

/** One wash color per object, cycling the same restrained palette Free
 *  Drawing uses — the trace and the mark left over it read as one language
 *  rather than two competing color systems. */
function washColorFor(index: number): string {
  return SKETCH_COLORS[index % SKETCH_COLORS.length];
}

function boxStyle(box: { x: number; y: number; width: number; height: number }) {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`,
  };
}

/**
 * The Reconstructed Room.
 *
 * Three plain layers, in DOM order:
 *  1. the reference illustration itself — a fine-pen, one-point-perspective
 *     room drawing, the only thing that actually draws the space. It is
 *     decorative (`alt=""`) and never the interaction target.
 *  2. a glow layer — one soft, blurred radial gradient per object
 *     (OBJECT_GLOW_BOXES), opacity 0 until that object is hovered or
 *     selected. Never intercepts pointer events; only Layer 3 does.
 *  3. — only while `interactive` — a layer of transparent, unstyled
 *     `<button>`s, one per object (OBJECT_BOXES), sized to stay clickable
 *     out to each object's full drawn extent — completely independent of
 *     Layer 2's glow boxes, which are free to be smaller, larger or offset.
 *     This is the only layer anything is ever clicked, tapped or tabbed to;
 *     neither the image nor the glow layer handles input.
 *
 * The eight ids, the box lookup keyed by them, and the pointer/keyboard
 * handlers below are the same shape MEMORY has always used — only the art
 * a box now sits on top of changed.
 */
export function MemoryRoom({
  selectedIds,
  onSelectToggle,
  onViewStart,
  onViewEnd,
  interactive = true,
}: MemoryRoomProps) {
  // Local only — which object the pointer/focus is currently over, purely to
  // drive the glow layer's `--hover` class. Never read by tracking; the
  // existing onViewStart/onViewEnd calls below are still MEMORY's only
  // source for `view` events.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  function clearHover(id: string) {
    setHoveredId((current) => (current === id ? null : current));
  }

  return (
    <div className={`memory-room${interactive ? ' memory-room--interactive' : ''}`}>
      <img
        src={roomIllustrationUrl}
        alt=""
        className="memory-room__illustration"
        draggable={false}
      />

      <div className="memory-room__glow-layer" aria-hidden="true">
        {MEMORY_ROOM_OBJECTS.map((object, index) => {
          const selected = selectedIds.includes(object.id);
          const hovered = interactive && hoveredId === object.id;
          const glow = OBJECT_GLOW_BOXES[object.id];
          const style = {
            ...boxStyle(glow),
            ['--memory-room-glow' as string]: washColorFor(index),
            ['--memory-room-glow-blur' as string]: `${glow.blur}px`,
            ['--memory-room-glow-opacity-mult' as string]: glow.opacityMultiplier,
          };
          return (
            <div
              key={object.id}
              className={`memory-room__glow${selected ? ' memory-room__glow--selected' : ''}${
                hovered ? ' memory-room__glow--hover' : ''
              }`}
              style={style}
            />
          );
        })}
      </div>

      {interactive ? (
        <div className="memory-room__interaction-layer">
          {MEMORY_ROOM_OBJECTS.map((object) => {
            const selected = selectedIds.includes(object.id);
            return (
              <button
                key={object.id}
                type="button"
                className="memory-room__hitarea"
                style={boxStyle(OBJECT_BOXES[object.id])}
                aria-label={object.label}
                aria-pressed={selected}
                onPointerEnter={() => {
                  setHoveredId(object.id);
                  onViewStart(object.id);
                }}
                onPointerLeave={() => {
                  clearHover(object.id);
                  onViewEnd(object.id);
                }}
                onFocus={() => {
                  setHoveredId(object.id);
                  onViewStart(object.id);
                }}
                onBlur={() => {
                  clearHover(object.id);
                  onViewEnd(object.id);
                }}
                onClick={() => onSelectToggle(object.id)}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
