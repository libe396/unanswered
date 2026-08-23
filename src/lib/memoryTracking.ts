/**
 * MEMORY's derived layer.
 *
 * The other two Zones ask a visitor to pick something that is already there.
 * This one gives them an empty rectangle, so there is no choice to record and
 * no right answer to be near or far from — what there is instead is a process:
 * when they started, where they put things, what they took back, and how long
 * they sat with it before saying it was finished.
 *
 * Everything below is arithmetic on coordinates and timestamps. None of it is
 * an attempt to see what was drawn. A bounding box is not a subject, a centroid
 * is not a composition, and coverage is not confidence — the Zone is called
 * "기억은 항상 완전하지 않다" and a system that announced what the incomplete
 * thing was would have finished the sentence on the visitor's behalf.
 *
 * Coordinates arrive normalized to the canvas, 0–1 on each axis, so nothing
 * here depends on the size of the drawing surface or the screen it was made on.
 *
 * Pure, like its LIGHT and SOUND counterparts.
 */
import { summarizeScene } from './behaviorTracking';
import type { GroupSummary } from './behaviorTracking';
import { MEMORY_THRESHOLDS } from './memoryThresholds';
import { MEMORY_MIN_OBJECT_SELECTION } from '../data/content';
import type {
  BehaviorSelectionMode,
  SceneBehaviorRecord,
  SceneId,
  StrokeEndReason,
  StrokeRemoveReason,
  TrackedStrokePoint,
} from '../types';

/**
 * The two things this Zone asks for, v2, named so the scene and the summary
 * agree.
 *
 * 'object' is multi — the Room's answer is a set of traces recognised, not
 * one of them — and always asked. 'sketch' stays single, on the same
 * reasoning as v1: there is one answer, the canvas, but now it is optional,
 * and a visit that skipped it has a 'sketch' group with no `openedAt` rather
 * than no group at all — see `commit`'s call sites in MemorySketchScene.tsx.
 */
export const MEMORY_TRACKING_GROUPS: Record<string, BehaviorSelectionMode> = {
  object: 'multi',
  sketch: 'single',
};

export const OBJECT_GROUP = 'object';
export const SKETCH_GROUP = 'sketch';

/**
 * Which Room background a visit uses.
 *
 * Always 'default' in this MVP — real-time generation from LIGHT/SOUND is
 * explicitly out of scope, and so is inventing what a given image or sound
 * should mean for the Room (no "chose rain, so the window shows rain").
 * Kept as its own function, rather than a bare constant inlined at the call
 * site, so that building real variation later is contained to this one
 * place: it would read LightArchiveData / SoundCluesData and return a
 * different id, and nothing downstream — the store, MemoryRoom, the debug
 * summary — would need to change, since all of it already carries whatever
 * string this returns rather than assuming 'default'.
 */
export const DEFAULT_ROOM_VARIANT = 'default';

export function selectRoomVariant(): string {
  return DEFAULT_ROOM_VARIANT;
}

/** An object let go of and later chosen again — OBJECT_RETURN's
 *  selection-side evidence, read the same way as SENTENCE's FragmentReturn. */
export interface ObjectReturn {
  objectId: string;
  deselectedAt: number;
  reselectedAt: number;
  timeGapMs: number;
}

const EMPTY_OBJECT_GROUP: Pick<
  GroupSummary,
  | 'viewPath'
  | 'dwellMsByTarget'
  | 'viewCountByTarget'
  | 'revisitCountByTarget'
  | 'longestViewedTargetId'
  | 'firstSelectedId'
  | 'finalSelectedIds'
  | 'selectionPath'
  | 'selectionChangeCount'
> = {
  viewPath: [],
  dwellMsByTarget: {},
  viewCountByTarget: {},
  revisitCountByTarget: {},
  longestViewedTargetId: null,
  firstSelectedId: null,
  finalSelectedIds: [],
  selectionPath: [],
  selectionChangeCount: 0,
};

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface MemoryStroke {
  id: string;
  /** Position among the marks that reached the canvas, in the order drawn. */
  index: number;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  tool: string;
  color: string;
  pointerType: string;
  points: TrackedStrokePoint[];
  rawPointCount: number;
  /** Never reached the canvas — a press with no line, or a Zone left mid-mark. */
  discarded: boolean;
  endReason: StrokeEndReason;
  /** Total path length, in normalized canvas units. */
  length: number;
  bounds: Box;
  centroid: Point;
  /** On the canvas, but too short to be treated as something drawn on purpose. */
  trivial: boolean;
  /** When it was taken back, if it was. */
  removedAt: number | null;
  removedBy: StrokeRemoveReason | null;
}

export interface MemoryPause {
  /** The gap sits after this mark, counting from the first at 0. */
  afterStrokeIndex: number;
  fromAt: number;
  toAt: number;
  durationMs: number;
  /**
   * Undos, clears and brush changes that happened inside the gap.
   *
   * A pause spent taking things back is not the same as a pause spent looking
   * at the canvas, and the gap alone cannot tell them apart.
   */
  actionsDuring: number;
}

export interface EraseReturn {
  removedStrokeId: string;
  removedBy: StrokeRemoveReason;
  removedAt: number;
  newStrokeId: string;
  newStrokeStartedAt: number;
  timeGapMs: number;
  /** Distance between the two marks' centres, in normalized canvas units. */
  distance: number;
  /** Shared area over the smaller of the two padded boxes, 0–1. */
  overlap: number;
  removedCentroid: Point;
  newCentroid: Point;
}

export interface MemoryBehaviorSummary {
  sceneId: SceneId;
  sceneEnteredAt: number;

  /** Every mark, including the ones taken back and the ones that never landed. */
  strokes: MemoryStroke[];
  /** Marks still on the canvas when it was submitted. */
  survivingStrokes: MemoryStroke[];

  /* ── Timing ────────────────────────────────────────────────────────────── */
  /** When the canvas appeared. Everything about waiting is measured from here. */
  canvasOpenedAt: number | null;
  /** Canvas appearing → the first mark that landed on it. */
  msToFirstStroke: number | null;
  /**
   * …and to the first contact of any kind, including a press that left nothing.
   *
   * Reaching for the canvas and pulling back is not the same as not having
   * reached at all, and the first figure cannot see the difference.
   */
  msToFirstCanvasTouch: number | null;
  /** First mark begun → last mark ended. */
  totalDrawingMs: number | null;
  /** Time with the pointer actually down, summed. */
  activeDrawingMs: number;
  pauses: MemoryPause[];
  totalPauseMs: number;
  longestPauseMs: number;
  /** Last mark ended → submitted. */
  msFromLastStrokeToCommit: number | null;
  /**
   * Last thing done of any kind → submitted, and not before NEXT was possible.
   *
   * Undoing is doing something. A visitor who drew, then spent a minute taking
   * it all back, then submitted was not sitting still for that minute.
   */
  postDrawingMs: number | null;
  /**
   * Canvas appearing → the last thing done on it.
   *
   * What the wait before submitting is weighed against: a minute of stillness
   * after ten seconds of drawing is a different act from the same minute after
   * five patient ones.
   */
  drawingSpanMs: number | null;
  /** The last thing done of any kind — a mark, an undo, a change of brush. */
  lastActionAt: number | null;
  committedAt: number | null;
  advanceReadyAt: number | null;

  /* ── Drawing ───────────────────────────────────────────────────────────── */
  /** Marks that landed on the canvas, whether or not they survived. */
  strokeCount: number;
  survivingStrokeCount: number;
  /** Presses that left nothing behind. */
  discardedStrokeCount: number;
  /** Marks that landed but were too short to be treated as deliberate. */
  trivialStrokeCount: number;
  /** Points kept by the sampler. */
  totalPointCount: number;
  /** Points reported by the pointer. Describes the device, not the visitor. */
  totalRawPointCount: number;
  /** Path length drawn, in normalized canvas units. Device-independent. */
  totalStrokeLength: number;
  undoCount: number;
  clearCount: number;
  eraseCount: number;
  toolChangeCount: number;
  colorChangeCount: number;
  colorsUsed: string[];
  pointerTypes: string[];

  /* ── Space, over what was left on the canvas ───────────────────────────── */
  boundingBox: Box | null;
  /** Area of that box, 0–1. */
  boundingBoxAreaRatio: number;
  /**
   * How much of the canvas was actually reached.
   *
   * Grid occupancy rather than box area: a box says how far apart the furthest
   * marks were, which two dots in opposite corners can max out while covering
   * nothing.
   */
  canvasCoverageRatio: number;
  centerOfDrawing: Point | null;
  quadrantDistribution: { topLeft: number; topRight: number; bottomLeft: number; bottomRight: number };
  edgeVsCenterDistribution: { edge: number; center: number };

  /* ── Revision ──────────────────────────────────────────────────────────── */
  removedStrokeCount: number;
  eraseReturns: EraseReturn[];
  eraseReturnCount: number;
  /** Distinct new marks that landed on ground something had been removed from. */
  redrawnAreaCount: number;
  /** Marks drawn after the canvas was last wiped. Not counted as returns. */
  strokesAfterClearCount: number;
  revisionCount: number;

  submittedEmpty: boolean;

  /* ── Object exploration (v2) — read on LIGHT's own terms ──────────────────
     The Room's objects are looked at the same way LIGHT's images are: a
     pointer resting on one, or one holding keyboard focus. Everything below
     is the 'object' group's summary read out under the names this Zone
     calls them, exactly the relationship SENTENCE's dwellMsByFragment etc.
     have to LIGHT's dwellMsByTarget. */
  /** False on a touchscreen, where there is no pointer to rest and so no
   *  looking to record. A `false` OBJECT_ATTENTION_GAP verdict means nothing
   *  when this is false — see SENTENCE's identical hasViewData. */
  hasObjectViewData: boolean;
  objectViewPath: string[];
  dwellByObject: Record<string, number>;
  viewCountByObject: Record<string, number>;
  /** Looks after the first, per object. Zero means seen once and not returned to. */
  revisitCountByObject: Record<string, number>;
  firstViewedObject: string | null;
  /** Longest total dwell, not most looks — the same reading as LIGHT's longestViewedTargetId. */
  mostViewedObject: string | null;

  /* ── Object selection (v2) ────────────────────────────────────────────── */
  firstSelectedObject: string | null;
  finalSelectedObjects: string[];
  /** Every choice made, in order, repeats included — where the selection moved. */
  objectSelectionPath: string[];
  objectSelectionChangeCount: number;
  deselectionCount: number;
  /** Objects deselected and later chosen again. OBJECT_RETURN's selection-side evidence. */
  objectReturns: ObjectReturn[];
  returnedObjects: string[];
  objectReturnCount: number;
  /**
   * The selected set exactly as it first stood the moment
   * MEMORY_MIN_OBJECT_SELECTION was reached. Null if that point was never
   * reached this visit. OBJECT_REVISION's "before" — see memoryPatterns.ts.
   */
  firstValidObjectSet: string[] | null;
  objectGroupOpenedAt: number | null;
  objectGroupCommittedAt: number | null;

  /* ── Drawing, v2 status ────────────────────────────────────────────────── */
  /** The optional Drawing step was opened this visit — see the note on
   *  MEMORY_TRACKING_GROUPS['sketch'] above. False on a Zone left after the
   *  Room without ever seeing the canvas, distinct from having seen it and
   *  drawn nothing (`drawingEntered && !drawingUsed`). */
  drawingEntered: boolean;
  /** At least one stroke survived to be recorded. */
  drawingUsed: boolean;

  eventCount: number;
}

/* ── Geometry ────────────────────────────────────────────────────────────── */

function boundsOf(points: readonly Point[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function centroidOf(points: readonly Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

function padded(box: Box, pad: number): Box {
  return {
    minX: box.minX - pad,
    minY: box.minY - pad,
    maxX: box.maxX + pad,
    maxY: box.maxY + pad,
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  };
}

/**
 * Shared area over the smaller box.
 *
 * Over the *smaller* rather than over the union, so a small mark drawn inside
 * the area a large one used to occupy still reads as covering the same ground —
 * which, for a visitor redrawing something they took back, it does.
 */
function overlapRatio(a: Box, b: Box): number {
  const w = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const h = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  if (w <= 0 || h <= 0) return 0;
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller > 0 ? Math.min(1, (w * h) / smaller) : 0;
}

/**
 * Cells of a grid over the canvas that any mark passes through.
 *
 * Segments are walked rather than sampled at their ends, so a single long
 * straight line is credited with everywhere it crosses instead of only the two
 * places the sampler happened to keep.
 */
function occupiedCells(strokes: readonly MemoryStroke[], gridSize: number): Set<number> {
  const cells = new Set<number>();
  const cell = (x: number, y: number) => {
    const cx = Math.min(gridSize - 1, Math.max(0, Math.floor(x * gridSize)));
    const cy = Math.min(gridSize - 1, Math.max(0, Math.floor(y * gridSize)));
    cells.add(cy * gridSize + cx);
  };
  const step = 1 / (gridSize * 2);

  for (const stroke of strokes) {
    const points = stroke.points;
    if (points.length === 0) continue;
    cell(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
      for (let k = 1; k <= steps; k += 1) {
        cell(a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps);
      }
    }
  }
  return cells;
}

/* ── Summary ─────────────────────────────────────────────────────────────── */

export function summarizeMemory(record: SceneBehaviorRecord): MemoryBehaviorSummary {
  const scene = summarizeScene(record);
  const sketchGroup = scene.groups[SKETCH_GROUP];
  const canvasOpenedAt = sketchGroup?.openedAt ?? null;
  const committedAt = sketchGroup?.committedAt ?? null;

  /*
    The 'object' group's exploration and selection figures come free from
    summarizeScene — a look and a choice among the Room's objects are the
    same acts LIGHT's image question already knows how to read, recorded by
    the same events. Only what is specific to *this* Zone's question —
    coming back to an object after letting it go, and what the selected set
    first looked like — needs its own replay below, on the same principle
    SENTENCE replays fragmentAdd/fragmentRemove beyond what the generic
    group summary gives it.
  */
  const object = scene.groups[OBJECT_GROUP] ?? EMPTY_OBJECT_GROUP;

  const objectRemovedAt = new Map<string, number>();
  const objectReturns: ObjectReturn[] = [];
  let deselectionCount = 0;
  const heldObjects = new Set<string>();
  let firstValidObjectSet: string[] | null = null;

  for (const event of record.events) {
    if (event.type !== 'select' && event.type !== 'deselect') continue;
    if (event.group !== OBJECT_GROUP) continue;
    if (event.type === 'select') {
      heldObjects.add(event.targetId);
      const removedAt = objectRemovedAt.get(event.targetId);
      if (removedAt !== undefined) {
        objectRemovedAt.delete(event.targetId);
        objectReturns.push({
          objectId: event.targetId,
          deselectedAt: removedAt,
          reselectedAt: event.at,
          timeGapMs: event.at - removedAt,
        });
      }
      if (firstValidObjectSet === null && heldObjects.size >= MEMORY_MIN_OBJECT_SELECTION) {
        firstValidObjectSet = [...heldObjects];
      }
      continue;
    }
    if (event.type === 'deselect') {
      heldObjects.delete(event.targetId);
      objectRemovedAt.set(event.targetId, event.at);
      deselectionCount += 1;
    }
  }

  const strokes: MemoryStroke[] = [];
  const byId = new Map<string, MemoryStroke>();
  let landedCount = 0;

  let undoCount = 0;
  let clearCount = 0;
  let eraseCount = 0;
  let toolChangeCount = 0;
  let colorChangeCount = 0;
  let lastClearAt: number | null = null;
  let lastRemovalAt: number | null = null;
  let lastToolChangeAt: number | null = null;

  const removals: Array<{ stroke: MemoryStroke; at: number; reason: StrokeRemoveReason }> = [];
  const colorsUsed: string[] = [];
  const pointerTypes: string[] = [];
  // Brush state is replayed rather than diffed at the call site, so that a
  // change is only counted when something actually changed.
  let currentTool: string | null = null;
  let currentColor: string | null = null;

  for (const event of record.events) {
    if (event.type === 'stroke') {
      const points = event.points;
      const stroke: MemoryStroke = {
        id: event.strokeId,
        index: event.discarded ? -1 : landedCount,
        startedAt: event.startedAt,
        endedAt: event.at,
        durationMs: event.at - event.startedAt,
        tool: event.tool,
        color: event.color,
        pointerType: event.pointerType,
        points,
        rawPointCount: event.rawPointCount,
        discarded: event.discarded,
        endReason: event.endReason,
        length: pathLength(points),
        bounds: boundsOf(points),
        centroid: centroidOf(points),
        trivial: false,
        removedAt: null,
        removedBy: null,
      };
      stroke.trivial = stroke.length < MEMORY_THRESHOLDS.trivialStrokeMaxLength;
      if (!event.discarded) landedCount += 1;
      strokes.push(stroke);
      byId.set(stroke.id, stroke);
      if (!colorsUsed.includes(event.color)) colorsUsed.push(event.color);
      if (!pointerTypes.includes(event.pointerType)) pointerTypes.push(event.pointerType);
      // A mark carries the brush it was made with, so the first one settles the
      // starting state without the scene having to announce it.
      if (currentTool === null) currentTool = event.tool;
      if (currentColor === null) currentColor = event.color;
      continue;
    }

    if (event.type === 'strokeRemove') {
      if (event.reason === 'undo') undoCount += 1;
      else if (event.reason === 'clear') clearCount += 1;
      else eraseCount += 1;
      if (event.reason === 'clear') lastClearAt = event.at;
      lastRemovalAt = event.at;
      for (const id of event.strokeIds) {
        const stroke = byId.get(id);
        if (!stroke || stroke.removedAt !== null) continue;
        stroke.removedAt = event.at;
        stroke.removedBy = event.reason;
        removals.push({ stroke, at: event.at, reason: event.reason });
      }
      continue;
    }

    if (event.type === 'toolChange') {
      if (currentTool !== null && event.tool !== currentTool) toolChangeCount += 1;
      if (currentColor !== null && event.color !== currentColor) colorChangeCount += 1;
      currentTool = event.tool;
      currentColor = event.color;
      lastToolChangeAt = event.at;
      if (!colorsUsed.includes(event.color)) colorsUsed.push(event.color);
    }
  }

  const landed = strokes.filter((s) => !s.discarded);
  const surviving = landed.filter((s) => s.removedAt === null);
  const meaningful = landed.filter((s) => !s.trivial);

  /* ── Timing ─────────────────────────────────────────────────────────────── */

  const firstLanded = landed[0] ?? null;
  const firstTouch = strokes[0] ?? null;
  const lastLanded = landed[landed.length - 1] ?? null;

  const msToFirstStroke =
    canvasOpenedAt !== null && firstLanded ? firstLanded.startedAt - canvasOpenedAt : null;
  const msToFirstCanvasTouch =
    canvasOpenedAt !== null && firstTouch ? firstTouch.startedAt - canvasOpenedAt : null;
  const totalDrawingMs =
    firstLanded && lastLanded ? lastLanded.endedAt - firstLanded.startedAt : null;
  const activeDrawingMs = landed.reduce((total, s) => total + s.durationMs, 0);

  /*
    Pauses are measured between one mark ending and the next beginning, which is
    the gap a visitor would recognise as having stopped. Undos and brush changes
    inside a gap do not split it — they are noted on it instead, because a gap
    spent taking things back reads differently from a gap spent looking.
  */
  const pauses: MemoryPause[] = [];
  for (let i = 1; i < landed.length; i += 1) {
    const fromAt = landed[i - 1].endedAt;
    const toAt = landed[i].startedAt;
    const durationMs = toAt - fromAt;
    if (durationMs < MEMORY_THRESHOLDS.pauseMinMs) continue;
    const actionsDuring = record.events.filter(
      (event) =>
        (event.type === 'strokeRemove' || event.type === 'toolChange') &&
        event.at > fromAt &&
        event.at < toAt,
    ).length;
    pauses.push({ afterStrokeIndex: i - 1, fromAt, toAt, durationMs, actionsDuring });
  }

  const totalPauseMs = pauses.reduce((total, p) => total + p.durationMs, 0);
  const longestPauseMs = pauses.reduce((max, p) => Math.max(max, p.durationMs), 0);

  const msFromLastStrokeToCommit =
    committedAt !== null && lastLanded ? committedAt - lastLanded.endedAt : null;

  // The last thing done of any kind, ignoring marks too short to be deliberate.
  const lastMeaningful = meaningful[meaningful.length - 1] ?? null;
  const lastActionAt = Math.max(
    lastMeaningful?.endedAt ?? Number.NEGATIVE_INFINITY,
    lastRemovalAt ?? Number.NEGATIVE_INFINITY,
    lastToolChangeAt ?? Number.NEGATIVE_INFINITY,
  );
  const hesitationStart = Math.max(
    scene.advanceReadyAt ?? Number.NEGATIVE_INFINITY,
    lastActionAt,
  );
  const postDrawingMs =
    committedAt !== null && Number.isFinite(hesitationStart)
      ? Math.max(0, committedAt - hesitationStart)
      : null;

  /* ── Space ──────────────────────────────────────────────────────────────── */

  const survivingPoints = surviving.flatMap((s) => s.points);
  const boundingBox = survivingPoints.length > 0 ? boundsOf(survivingPoints) : null;
  const boundingBoxAreaRatio = boundingBox ? boundingBox.width * boundingBox.height : 0;
  const grid = MEMORY_THRESHOLDS.coverageGridSize;
  const canvasCoverageRatio =
    surviving.length > 0 ? occupiedCells(surviving, grid).size / (grid * grid) : 0;
  const centerOfDrawing = survivingPoints.length > 0 ? centroidOf(survivingPoints) : null;

  const quadrants = { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
  const band = MEMORY_THRESHOLDS.edgeBandRatio;
  let edgePoints = 0;
  for (const p of survivingPoints) {
    if (p.y < 0.5) {
      if (p.x < 0.5) quadrants.topLeft += 1;
      else quadrants.topRight += 1;
    } else if (p.x < 0.5) quadrants.bottomLeft += 1;
    else quadrants.bottomRight += 1;

    if (p.x < band || p.x > 1 - band || p.y < band || p.y > 1 - band) edgePoints += 1;
  }
  const pointTotal = survivingPoints.length;
  const share = (n: number) => (pointTotal > 0 ? n / pointTotal : 0);
  const quadrantDistribution = {
    topLeft: share(quadrants.topLeft),
    topRight: share(quadrants.topRight),
    bottomLeft: share(quadrants.bottomLeft),
    bottomRight: share(quadrants.bottomRight),
  };
  const edgeVsCenterDistribution = {
    edge: share(edgePoints),
    center: share(pointTotal - edgePoints),
  };

  /* ── Coming back to an erased place ─────────────────────────────────────── */

  /*
    Only undos and erases are candidates. A clear removes everywhere, so every
    later mark would land on ground something used to be on, and the pattern
    would fire on the mere fact of starting over — which is a different act, and
    counted separately as strokesAfterClearCount.

    One return per removed mark: the first later mark that qualifies. Anything
    after that is drawing in that area, not returning to it.
  */
  const pad = MEMORY_THRESHOLDS.eraseReturnBoxPadding;
  const eraseReturns: EraseReturn[] = [];
  for (const removal of removals) {
    if (removal.reason === 'clear') continue;
    const removedBox = padded(removal.stroke.bounds, pad);

    for (const candidate of landed) {
      if (candidate.trivial) continue;
      if (candidate.startedAt < removal.at) continue;
      const timeGapMs = candidate.startedAt - removal.at;
      if (timeGapMs > MEMORY_THRESHOLDS.eraseReturnMaxTimeGapMs) break;

      const distance = Math.hypot(
        candidate.centroid.x - removal.stroke.centroid.x,
        candidate.centroid.y - removal.stroke.centroid.y,
      );
      if (distance > MEMORY_THRESHOLDS.eraseReturnMaxDistance) continue;

      const overlap = overlapRatio(removedBox, padded(candidate.bounds, pad));
      if (overlap < MEMORY_THRESHOLDS.eraseReturnMinOverlap) continue;

      eraseReturns.push({
        removedStrokeId: removal.stroke.id,
        removedBy: removal.reason,
        removedAt: removal.at,
        newStrokeId: candidate.id,
        newStrokeStartedAt: candidate.startedAt,
        timeGapMs,
        distance,
        overlap,
        removedCentroid: removal.stroke.centroid,
        newCentroid: candidate.centroid,
      });
      break;
    }
  }

  const strokesAfterClearCount =
    lastClearAt === null ? 0 : landed.filter((s) => s.startedAt > lastClearAt).length;

  return {
    sceneId: record.sceneId,
    sceneEnteredAt: record.sceneEnteredAt,
    strokes,
    survivingStrokes: surviving,

    canvasOpenedAt,
    msToFirstStroke,
    msToFirstCanvasTouch,
    totalDrawingMs,
    activeDrawingMs,
    pauses,
    totalPauseMs,
    longestPauseMs,
    msFromLastStrokeToCommit,
    postDrawingMs,
    drawingSpanMs:
      canvasOpenedAt !== null && Number.isFinite(lastActionAt)
        ? Math.max(0, lastActionAt - canvasOpenedAt)
        : null,
    lastActionAt: Number.isFinite(lastActionAt) ? lastActionAt : null,
    committedAt,
    advanceReadyAt: scene.advanceReadyAt,

    strokeCount: landed.length,
    survivingStrokeCount: surviving.length,
    discardedStrokeCount: strokes.length - landed.length,
    trivialStrokeCount: landed.filter((s) => s.trivial).length,
    totalPointCount: landed.reduce((total, s) => total + s.points.length, 0),
    totalRawPointCount: landed.reduce((total, s) => total + s.rawPointCount, 0),
    totalStrokeLength: landed.reduce((total, s) => total + s.length, 0),
    undoCount,
    clearCount,
    eraseCount,
    toolChangeCount,
    colorChangeCount,
    colorsUsed,
    pointerTypes,

    boundingBox,
    boundingBoxAreaRatio,
    canvasCoverageRatio,
    centerOfDrawing,
    quadrantDistribution,
    edgeVsCenterDistribution,

    removedStrokeCount: removals.length,
    eraseReturns,
    eraseReturnCount: eraseReturns.length,
    redrawnAreaCount: new Set(eraseReturns.map((r) => r.newStrokeId)).size,
    strokesAfterClearCount,
    revisionCount: undoCount + clearCount + eraseCount,

    submittedEmpty: committedAt !== null && surviving.length === 0,

    hasObjectViewData: object.viewPath.length > 0,
    objectViewPath: object.viewPath,
    dwellByObject: object.dwellMsByTarget,
    viewCountByObject: object.viewCountByTarget,
    revisitCountByObject: object.revisitCountByTarget,
    firstViewedObject: object.viewPath[0] ?? null,
    mostViewedObject: object.longestViewedTargetId,

    firstSelectedObject: object.firstSelectedId,
    finalSelectedObjects: object.finalSelectedIds,
    objectSelectionPath: object.selectionPath,
    objectSelectionChangeCount: object.selectionChangeCount,
    deselectionCount,
    objectReturns,
    returnedObjects: [...new Set(objectReturns.map((r) => r.objectId))],
    objectReturnCount: objectReturns.length,
    firstValidObjectSet,
    objectGroupOpenedAt: scene.groups[OBJECT_GROUP]?.openedAt ?? null,
    objectGroupCommittedAt: scene.groups[OBJECT_GROUP]?.committedAt ?? null,

    drawingEntered: canvasOpenedAt !== null,
    drawingUsed: surviving.length > 0,

    eventCount: record.events.length,
  };
}
