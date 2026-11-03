/**
 * The mobile report link — a visit, compressed into a URL hash.
 *
 * Nothing is stored anywhere: the whole record a phone needs to redraw the
 * receipt travels inside `#/r/<payload>`, so GitHub Pages serves the same
 * index.html and the server never sees it (a hash is not sent with the
 * request). Clue ids, numbers and interpretation template context go in; the phone looks the words back up in
 * src/data/content.ts and redraws the light from src/data/lightRulesCache.json.
 *
 * The visitor's authored sentence is included at their request (2026-11-01).
 * Camera data and raw behaviour/replay logs remain outside the URL.
 */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { readFindingCopy, type PersonalFinding } from './personalFindingInterpretation';
import { EMOTION_KEYWORDS } from '../data/content';
import { buildActionEvidence, type ActionEvidenceKind, type ActionEvidenceScene, type BehaviorRecords } from './reportActionEvidence';
import type { FinalReportPresentation } from './finalReportPresentation';
import type { RecordLayerDerived } from '../types';

export const PUBLIC_REPORT_URL: string =
  import.meta.env.VITE_PUBLIC_REPORT_URL || 'https://libe396.github.io/unanswered/';
export const REPORT_HASH_PREFIX = '#/r/';
const NAME_MAX = 12;

// Wire v2 dictionaries are append-only; UI/content ordering may change independently.
const OBJECT_IDS = ['window', 'lamp', 'book', 'photo', 'cup', 'chair', 'pillow', 'duvet', 'bedsidePlant', 'bag', 'bedside'];
const SENTENCE_IDS = ['RECON_A_LEFT_CALM', 'RECON_A_HESITATED', 'RECON_A_RETURNED_FOR', 'RECON_A_WAITED', 'RECON_B_LEFT_BEHIND', 'RECON_B_PUT_DOWN_AGAIN', 'RECON_B_LEFT_ON_PURPOSE', 'RECON_B_DISPLACED', 'RECON_C_UNSPOKEN', 'RECON_C_UNDONE_ACTION', 'RECON_C_UNWRITTEN_RECORD', 'RECON_C_UNDECIDED', 'RECON_D_REVISITED', 'RECON_D_UNCHANGED', 'RECON_D_VANISHED_LATER', 'RECON_D_DOOR_LEFT_OPEN', 'RECON_E_NEVER_RETURNED', 'RECON_E_RECORD_ENDS', 'RECON_E_CONTINUES_ELSEWHERE', 'RECON_E_LAST_RECORD_HERE'];
const SOUND_IDS = ['SOUND_01', 'SOUND_02', 'SOUND_03', 'SOUND_04', 'SOUND_05', 'SOUND_06', 'SOUND_07'];

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
  findings: Array<{ id: string; context: Record<string, string> }>;
  response: string;
  responseAvailable: boolean;
  skipped: boolean;
}

/* Wire form: short codes, empty fields omitted. */
const KINDS: ActionEvidenceKind[] = ['dwell', 'removed', 'replay', 'selection'];
const SCENES: ActionEvidenceScene[] = ['soundClues', 'memorySketch', 'sentenceClues'];
type WireEvidence = [number, number, number] | [number, number, number, number];

const round2 = (value: number) => Math.round(value * 100) / 100;

export function buildSharedReport(
  record: RecordLayerDerived,
  behavior: BehaviorRecords,
  presentation: FinalReportPresentation,
  findings: readonly PersonalFinding[] = [],
): SharedReport {
  const position = record.soundClues.memoryPosition;
  const keywords = record.light?.rules.emotionKeywords ?? [];
  return {
    v: 1,
    response: record.sentenceClues.responseText ?? '',
    responseAvailable: true,
    skipped: record.sentenceClues.responseSkipped,
    findings: findings.slice(0, 3).map(({ id, context }) => ({ id, context: Object.fromEntries(Object.entries(context).filter(([key]) => ['fragmentAct', 'how', 'single', 'spread', 'topLabel', 'zone', 'zones'].includes(key))) })),
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
  const wire: Record<string, unknown> = { v: 2, id: report.id };
  if (report.response) wire.r = report.response;
  if (report.skipped) wire.b = 1;
  if (report.t !== null) wire.t = report.t;
  if (report.n) wire.n = report.n;
  if (report.img) wire.img = report.img;
  if (report.var !== 1) wire.var = report.var;
  if (report.kw.length) wire.kw = report.kw;
  if (report.snd) wire.snd = SOUND_IDS.indexOf(report.snd);
  if (report.pos) wire.pos = report.pos;
  if (report.obj.length) wire.obj = report.obj.map(id => OBJECT_IDS.indexOf(id));
  if (report.sen.length) wire.sen = report.sen.map(id => SENTENCE_IDS.indexOf(id));
  if (report.ev.length) {
    wire.ev = report.ev.map((item): WireEvidence => {
      const head: [number, number, number] = [KINDS.indexOf(item.kind), SCENES.indexOf(item.sceneId), item.sceneId === 'soundClues' ? SOUND_IDS.indexOf(item.targetId) : item.sceneId === 'memorySketch' ? OBJECT_IDS.indexOf(item.targetId) : SENTENCE_IDS.indexOf(item.targetId)];
      return item.tenths === undefined ? head : [...head, item.tenths];
    });
  }
  if (report.findings.length) wire.fi = report.findings.map(item => [item.id, item.context]);
  return compressToEncodedURIComponent(JSON.stringify(wire));
}

export function buildReportUrl(payload: string): string {
  return `${PUBLIC_REPORT_URL}${REPORT_HASH_PREFIX}${payload}`;
}

/**
 * Compact indexed payload. Old v1 links still decode; no selected clues are dropped.
 */
export function encodeReport(
  record: RecordLayerDerived,
  behavior: BehaviorRecords,
  presentation: FinalReportPresentation,
  findings: readonly PersonalFinding[] = [],
): string {
  // Preserve every chosen object and evidence item. Do not silently shorten the visitor's record.
  return compress(buildSharedReport(record, behavior, presentation, findings));
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
    if ((w.v !== 1 && w.v !== 2) || !isString(w.id)) return null;
    if (w.v === 2) {
      if (w.snd !== undefined) { if (!isInt(w.snd) || !SOUND_IDS[w.snd]) return null; w.snd = SOUND_IDS[w.snd]; }
      for (const [field, options] of [['obj', OBJECT_IDS], ['sen', SENTENCE_IDS]] as const) {
        const values = w[field];
        if (values !== undefined) {
          if (!Array.isArray(values) || !values.every(value => isInt(value) && options[value])) return null;
          w[field] = values.map(value => options[value]);
        }
      }
      if (w.ev !== undefined) {
        if (!Array.isArray(w.ev)) return null;
        const expanded = [];
        for (const item of w.ev) {
          if (!Array.isArray(item) || !isInt(item[1]) || !isInt(item[2])) return null;
          const options = item[1] === 0 ? SOUND_IDS : item[1] === 1 ? OBJECT_IDS : item[1] === 2 ? SENTENCE_IDS : null;
          if (!options?.[item[2]]) return null;
          expanded.push([item[0], item[1], options[item[2]], ...item.slice(3)]);
        }
        w.ev = expanded;
      }
    }
    if (w.r !== undefined && (!isString(w.r) || w.r.length > 1000)) return null;
    if (w.b !== undefined && w.b !== 1) return null;

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

    const findings: SharedReport['findings'] = [];
    if (w.fi !== undefined) {
      if (!Array.isArray(w.fi) || w.fi.length > 3) return null;
      for (const item of w.fi) {
        if (!Array.isArray(item) || item.length !== 2 || !isString(item[0])) return null;
        const context = item[1];
        if (!context || typeof context !== 'object' || Array.isArray(context) || !Object.values(context).every(isString)) return null;
        if (!readFindingCopy(item[0], context)) return null;
        findings.push({ id: item[0], context });
      }
    }
    return {
      findings,
      response: (w.r as string | undefined) ?? '',
      responseAvailable: w.v === 2,
      skipped: w.b === 1,
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
