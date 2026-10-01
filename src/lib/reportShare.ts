/**
 * The mobile report link — a visit, compressed into a URL hash.
 *
 * Nothing is stored anywhere: the whole record a phone needs to redraw the
 * receipt travels inside `#/r/<payload>`, so GitHub Pages serves the same
 * index.html and the server never sees it (a hash is not sent with the
 * request). Only ids and numbers go in; the phone looks the words back up in
 * src/data/content.ts and redraws the light from src/data/lightRulesCache.json.
 *
 * Deliberately left out: SENTENCE's free-typed `responseText` (personal
 * writing), anything from the camera, and the raw behaviour log.
 */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { EMOTION_KEYWORDS } from '../data/content';
import { buildActionEvidence, type ActionEvidenceKind, type ActionEvidenceScene, type BehaviorRecords } from './reportActionEvidence';
import type { FinalReportPresentation } from './finalReportPresentation';
import type { RecordLayerDerived } from '../types';

export const PUBLIC_REPORT_URL: string =
  import.meta.env.VITE_PUBLIC_REPORT_URL || 'https://libe396.github.io/unanswered/';
export const REPORT_HASH_PREFIX = '#/r/';
export const MAX_REPORT_URL_LENGTH = 600;
const NAME_MAX = 12;

export interface SharedEvidence {
  kind: ActionEvidenceKind;
  sceneId: ActionEvidenceScene;
  targetId: string;
  tenths?: number;
}

/** Schema v1. Every field is always present after decoding. */
export interface SharedReport {
  v: 1;
  id: string;
  /** Issue time, unix minutes. */
  t: number | null;
  n: string;
  img: string | null;
  var: number;
  /** Indices into EMOTION_KEYWORDS, in the order they were picked. */
  kw: number[];
  snd: string | null;
  pos: [number, number] | null;
  obj: string[];
  sen: string[];
  ev: SharedEvidence[];
}

/* Wire form: short codes, empty fields omitted. */
const KINDS: ActionEvidenceKind[] = ['dwell', 'removed', 'replay', 'selection'];
const SCENES: ActionEvidenceScene[] = ['soundClues', 'memorySketch', 'sentenceClues'];
type WireEvidence = [number, number, string] | [number, number, string, number];

const round2 = (value: number) => Math.round(value * 100) / 100;

export function buildSharedReport(
  record: RecordLayerDerived,
  behavior: BehaviorRecords,
  presentation: FinalReportPresentation,
): SharedReport {
  const position = record.soundClues.memoryPosition;
  const keywords = record.light?.rules.emotionKeywords ?? [];
  return {
    v: 1,
    id: presentation.reportId,
    t: presentation.issuedAt === null ? null : Math.floor(presentation.issuedAt / 60_000),
    n: Array.from(record.investigator?.investigatorName.trim() ?? '').slice(0, NAME_MAX).join(''),
    img: record.light?.imageId ?? null,
    var: record.light?.variation ?? 1,
    kw: keywords.map((word) => EMOTION_KEYWORDS.findIndex((item) => item.ko === word)).filter((index) => index >= 0),
    snd: record.soundClues.selectedSoundId,
    pos: position ? [round2(position.x), round2(position.y)] : null,
    obj: [...record.memorySketch.selectedObjects],
    sen: [...record.sentenceClues.selectedSentenceIds],
    ev: buildActionEvidence(record, behavior).map(({ kind, sceneId, targetId, tenths }) =>
      tenths === undefined ? { kind, sceneId, targetId } : { kind, sceneId, targetId, tenths },
    ),
  };
}

function compress(report: SharedReport): string {
  const wire: Record<string, unknown> = { v: report.v, id: report.id };
  if (report.t !== null) wire.t = report.t;
  if (report.n) wire.n = report.n;
  if (report.img) wire.img = report.img;
  if (report.var !== 1) wire.var = report.var;
  if (report.kw.length) wire.kw = report.kw;
  if (report.snd) wire.snd = report.snd;
  if (report.pos) wire.pos = report.pos;
  if (report.obj.length) wire.obj = report.obj;
  if (report.sen.length) wire.sen = report.sen;
  if (report.ev.length) {
    wire.ev = report.ev.map((item): WireEvidence => {
      const head: [number, number, string] = [KINDS.indexOf(item.kind), SCENES.indexOf(item.sceneId), item.targetId];
      return item.tenths === undefined ? head : [...head, item.tenths];
    });
  }
  return compressToEncodedURIComponent(JSON.stringify(wire));
}

export function buildReportUrl(payload: string): string {
  return `${PUBLIC_REPORT_URL}${REPORT_HASH_PREFIX}${payload}`;
}

/**
 * Compressed payload for this visit. If the full link would pass
 * MAX_REPORT_URL_LENGTH, `ev` goes first, then `obj` — the receipt still
 * reads without either.
 */
export function encodeReport(
  record: RecordLayerDerived,
  behavior: BehaviorRecords,
  presentation: FinalReportPresentation,
): string {
  let report = buildSharedReport(record, behavior, presentation);
  let payload = compress(report);
  if (buildReportUrl(payload).length > MAX_REPORT_URL_LENGTH) {
    report = { ...report, ev: [] };
    payload = compress(report);
  }
  if (buildReportUrl(payload).length > MAX_REPORT_URL_LENGTH) {
    report = { ...report, obj: [] };
    payload = compress(report);
  }
  return payload;
}

/* ── Decoding: anything malformed is null, never a half-read record ─────── */

const isString = (value: unknown): value is string => typeof value === 'string';
const isInt = (value: unknown): value is number => Number.isInteger(value);
const isUnit = (value: unknown): value is number => typeof value === 'number' && value >= 0 && value <= 1;

function stringList(value: unknown): string[] | null {
  if (value === undefined) return [];
  return Array.isArray(value) && value.every(isString) ? value : null;
}

export function decodeReport(payload: string): SharedReport | null {
  try {
    const json = decompressFromEncodedURIComponent(payload);
    if (!json) return null;
    const wire: unknown = JSON.parse(json);
    if (!wire || typeof wire !== 'object' || Array.isArray(wire)) return null;
    const w = wire as Record<string, unknown>;
    if (w.v !== 1 || !isString(w.id)) return null;

    const kw = w.kw === undefined ? [] : w.kw;
    if (!Array.isArray(kw) || !kw.every((i) => isInt(i) && i >= 0 && i < EMOTION_KEYWORDS.length)) return null;
    const pos = w.pos === undefined ? null : w.pos;
    if (pos !== null && !(Array.isArray(pos) && pos.length === 2 && pos.every(isUnit))) return null;
    const obj = stringList(w.obj);
    const sen = stringList(w.sen);
    if (!obj || !sen) return null;

    const evWire = w.ev === undefined ? [] : w.ev;
    if (!Array.isArray(evWire)) return null;
    const ev: SharedEvidence[] = [];
    for (const item of evWire) {
      if (!Array.isArray(item) || item.length < 3 || item.length > 4) return null;
      const [k, s, targetId, tenths] = item as unknown[];
      if (!isInt(k) || !KINDS[k] || !isInt(s) || !SCENES[s] || !isString(targetId)) return null;
      if (item.length === 4 && !(isInt(tenths) && tenths >= 0)) return null;
      ev.push(item.length === 4
        ? { kind: KINDS[k], sceneId: SCENES[s], targetId, tenths: tenths as number }
        : { kind: KINDS[k], sceneId: SCENES[s], targetId });
    }

    if (w.t !== undefined && !isInt(w.t)) return null;
    if (w.n !== undefined && !isString(w.n)) return null;
    if (w.img !== undefined && !isString(w.img)) return null;
    if (w.var !== undefined && typeof w.var !== 'number') return null;
    if (w.snd !== undefined && !isString(w.snd)) return null;

    return {
      v: 1,
      id: w.id,
      t: (w.t as number | undefined) ?? null,
      n: Array.from((w.n as string | undefined) ?? '').slice(0, NAME_MAX).join(''),
      img: (w.img as string | undefined) ?? null,
      var: (w.var as number | undefined) ?? 1,
      kw: kw as number[],
      snd: (w.snd as string | undefined) ?? null,
      pos: pos as [number, number] | null,
      obj,
      sen,
      ev,
    };
  } catch {
    return null;
  }
}

/** The payload in the current location, or null when this is not a report link. */
export function readReportPayload(hash: string): string | null {
  return hash.startsWith(REPORT_HASH_PREFIX) ? hash.slice(REPORT_HASH_PREFIX.length) : null;
}

/** Clipboard API where allowed, a hidden textarea otherwise (older in-app browsers). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    return ok;
  }
}
