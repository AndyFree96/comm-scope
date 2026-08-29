import type { Direction, TrafficEvent, TransportKind } from '../event/events.js';

/**
 * JSON Lines recording format.
 *
 * First line is a header carrying a magic key (`comm-scope`) plus the schema
 * version and session metadata. Every following line is a single traffic
 * event, payload encoded as lowercase hex so binary data round-trips cleanly
 * through JSON without escaping concerns.
 */

export const SCHEMA_VERSION = 1;
export const MAGIC_KEY = 'comm-scope';

export interface SessionHeader {
  version: number;
  kind: TransportKind;
  id: string;
  desc: string;
  started: number;
}

export function encodeHeader(h: SessionHeader): string {
  return JSON.stringify({
    [MAGIC_KEY]: h.version,
    kind: h.kind,
    id: h.id,
    desc: h.desc,
    started: h.started,
  });
}

export function decodeHeader(line: string): SessionHeader {
  const o = JSON.parse(line) as Record<string, unknown>;
  const version = o[MAGIC_KEY];
  if (typeof version !== 'number') {
    throw new Error('not a comm-scope recording (missing header)');
  }
  if (version !== SCHEMA_VERSION) {
    throw new Error(`unsupported recording schema version ${version}`);
  }
  return {
    version,
    kind: o.kind as TransportKind,
    id: String(o.id ?? ''),
    desc: String(o.desc ?? ''),
    started: Number(o.started ?? 0),
  };
}

export function encodeEvent(e: TrafficEvent): string {
  return JSON.stringify({
    t: e.ts,
    dir: e.dir,
    kind: e.transport.kind,
    id: e.transport.id,
    desc: e.transport.desc,
    enc: 'hex',
    data: e.data.toString('hex'),
  });
}

export function decodeEvent(line: string): TrafficEvent {
  const o = JSON.parse(line) as Record<string, unknown>;
  if (o.enc !== 'hex') throw new Error(`unsupported payload encoding "${String(o.enc)}"`);
  const dir = o.dir as Direction;
  if (dir !== 'rx' && dir !== 'tx') throw new Error(`invalid direction "${String(o.dir)}"`);
  return {
    ts: Number(o.t),
    dir,
    data: Buffer.from(String(o.data), 'hex'),
    transport: {
      kind: o.kind as TransportKind,
      id: String(o.id ?? ''),
      desc: String(o.desc ?? ''),
    },
  };
}
