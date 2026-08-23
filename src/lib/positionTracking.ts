/**
 * The memory field's derived layer.
 *
 * SOUND used to ask, after the listening, which feeling the sound carried, and
 * offered ten words to choose from. It now asks where the sound has stayed —
 * how clearly, and how near — and offers a blank rectangle with a meaning on
 * each side. The difference is not cosmetic: a word is chosen from a list
 * somebody else wrote, and a place is not.
 *
 * What that costs is a harder record to read, because there is no list to
 * compare against. What it buys is that the *route* to the answer is now part
 * of the answer: a point put down and left alone, a point dragged once, and a
 * point that wandered and came back are three different acts that a row of
 * words could never have told apart.
 *
 * Everything here is arithmetic on those routes. Where the point ended is
 * reported; what it means about the person is not, and no distance below is
 * ever turned into a temperament.
 *
 * Pure, like every other summarizer here.
 */
import { POSITION_THRESHOLDS } from './positionThresholds';
import type {
  MemoryPosition,
  PositionGesture,
  SceneBehaviorRecord,
  StrokeEndReason,
  TrackedPositionPoint,
} from '../types';

export const POSITION_GROUP = 'position';

/** One uninterrupted gesture: a placement, a drag, or a keyboard step. */
export interface PositionGestureRecord {
  index: number;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  gesture: PositionGesture;
  from: MemoryPosition | null;
  to: MemoryPosition;
  path: TrackedPositionPoint[];
  rawPointCount: number;
  pointerType: string;
  endReason: StrokeEndReason;
  /** Distance the point actually travelled during this gesture. */
  travelled: number;
  /** Straight-line distance from where it started this gesture to where it ended. */
  displacement: number;
  /** Moved far enough to have been meant. */
  meaningful: boolean;
}

export interface PositionPause {
  /** The gap sits after this gesture, counting from the first at 0. */
  afterGestureIndex: number;
  fromAt: number;
  toAt: number;
  durationMs: number;
}

export interface PositioningSummary {
  /** When the field became available. */
  openedAt: number | null;
  gestures: PositionGestureRecord[];
  /** Every sampled position the point held, in time order. */
  positionPath: Array<{ x: number; y: number; at: number }>;

  firstPosition: MemoryPosition | null;
  finalPosition: MemoryPosition | null;
  /** Field appearing → the point first being put down. */
  msToFirstPlacement: number | null;
  /** First placement → the last time the point moved. */
  positioningTime: number | null;
  /** The point settling → NEXT. */
  msFromFinalPositionToCommit: number | null;

  totalDragDistance: number;
  directionChangeCount: number;
  /** Gestures after the placement that moved the point a meaningful distance. */
  positionRevisionCount: number;
  pauses: PositionPause[];
  longestPositionPauseMs: number;
  distanceBetweenFirstAndFinal: number | null;
  /** The furthest the point ever got from where it was first put down. */
  maxDistanceFromFirst: number;

  placedAt: number | null;
  lastMovedAt: number | null;
  placed: boolean;
}

const EMPTY: PositioningSummary = {
  openedAt: null,
  gestures: [],
  positionPath: [],
  firstPosition: null,
  finalPosition: null,
  msToFirstPlacement: null,
  positioningTime: null,
  msFromFinalPositionToCommit: null,
  totalDragDistance: 0,
  directionChangeCount: 0,
  positionRevisionCount: 0,
  pauses: [],
  longestPositionPauseMs: 0,
  distanceBetweenFirstAndFinal: null,
  maxDistanceFromFirst: 0,
  placedAt: null,
  lastMovedAt: null,
  placed: false,
};

const distance = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.hypot(b.x - a.x, b.y - a.y);

function pathLength(points: readonly { x: number; y: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distance(points[i - 1], points[i]);
  return total;
}

/**
 * Counts the turns in a route.
 *
 * The path is first walked in steps of at least `directionChangeMinSegment`,
 * because direction taken between two samples a hundredth of a field apart is
 * noise — it would turn one smooth drag into a long list of decisions. Only
 * once the route has been reduced to segments long enough to have a direction
 * is the angle between consecutive ones worth asking about.
 */
export function countDirectionChanges(points: readonly { x: number; y: number }[]): number {
  const minSegment = POSITION_THRESHOLDS.directionChangeMinSegment;
  const anchors: Array<{ x: number; y: number }> = [];
  for (const point of points) {
    if (anchors.length === 0) {
      anchors.push(point);
      continue;
    }
    if (distance(anchors[anchors.length - 1], point) >= minSegment) anchors.push(point);
  }
  if (anchors.length < 3) return 0;

  const limit = (POSITION_THRESHOLDS.directionChangeAngle * Math.PI) / 180;
  let changes = 0;
  for (let i = 2; i < anchors.length; i += 1) {
    const a = anchors[i - 2];
    const b = anchors[i - 1];
    const c = anchors[i];
    const angle1 = Math.atan2(b.y - a.y, b.x - a.x);
    const angle2 = Math.atan2(c.y - b.y, c.x - b.x);
    // Wrapped into (-π, π] so that a turn across the ±π boundary is small, not
    // nearly a full circle.
    let turn = Math.abs(angle2 - angle1);
    if (turn > Math.PI) turn = 2 * Math.PI - turn;
    if (turn >= limit) changes += 1;
  }
  return changes;
}

export function summarizePositioning(
  record: SceneBehaviorRecord,
  group: string = POSITION_GROUP,
  openedAt: number | null = null,
  committedAt: number | null = null,
): PositioningSummary {
  const gestures: PositionGestureRecord[] = [];
  for (const event of record.events) {
    if (event.type !== 'position' || event.group !== group) continue;
    const travelled = pathLength(event.path);
    const displacement = event.from ? distance(event.from, event.to) : 0;
    gestures.push({
      index: gestures.length,
      startedAt: event.startedAt,
      endedAt: event.at,
      durationMs: event.at - event.startedAt,
      gesture: event.gesture,
      from: event.from,
      to: event.to,
      path: event.path,
      rawPointCount: event.rawPointCount,
      pointerType: event.pointerType,
      endReason: event.endReason,
      travelled,
      displacement,
      meaningful: displacement >= POSITION_THRESHOLDS.meaningfulMoveDistance,
    });
  }

  if (gestures.length === 0) return { ...EMPTY, openedAt };

  const placement = gestures[0];
  const last = gestures[gestures.length - 1];
  const firstPosition = placement.to;
  const finalPosition = last.to;

  /*
    One path, in time order, across every gesture. Between gestures the point
    does not move, so stitching them together describes exactly where the point
    was at each moment and nothing else — which is what both the travelled
    distance and the direction count need to be read from.
  */
  const positionPath: Array<{ x: number; y: number; at: number }> = [];
  for (const gesture of gestures) {
    for (const point of gesture.path) {
      positionPath.push({ x: point.x, y: point.y, at: gesture.startedAt + point.t });
    }
  }

  const pauses: PositionPause[] = [];
  for (let i = 1; i < gestures.length; i += 1) {
    const fromAt = gestures[i - 1].endedAt;
    const toAt = gestures[i].startedAt;
    const durationMs = toAt - fromAt;
    if (durationMs < POSITION_THRESHOLDS.positionPauseMinMs) continue;
    pauses.push({ afterGestureIndex: i - 1, fromAt, toAt, durationMs });
  }

  let maxDistanceFromFirst = 0;
  for (const point of positionPath) {
    const d = distance(firstPosition, point);
    if (d > maxDistanceFromFirst) maxDistanceFromFirst = d;
  }

  return {
    openedAt,
    gestures,
    positionPath,
    firstPosition,
    finalPosition,
    msToFirstPlacement: openedAt === null ? null : placement.startedAt - openedAt,
    positioningTime: last.endedAt - placement.startedAt,
    msFromFinalPositionToCommit: committedAt === null ? null : committedAt - last.endedAt,
    totalDragDistance: gestures.reduce((total, g) => total + g.travelled, 0),
    directionChangeCount: countDirectionChanges(positionPath),
    // The placing gesture is not a revision: there was nothing to revise.
    positionRevisionCount: gestures.slice(1).filter((g) => g.meaningful).length,
    pauses,
    longestPositionPauseMs: pauses.reduce((max, p) => Math.max(max, p.durationMs), 0),
    distanceBetweenFirstAndFinal: distance(firstPosition, finalPosition),
    maxDistanceFromFirst,
    placedAt: placement.endedAt,
    lastMovedAt: last.endedAt,
    placed: true,
  };
}
