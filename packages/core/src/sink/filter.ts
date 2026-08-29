import type { Direction, TrafficEvent } from '../event/events.js';

/** Parse a hex string (spaces and `0x` tolerated) into a Buffer. */
export function hexToBuffer(s: string): Buffer {
  const clean = s.replace(/0x/gi, '').replace(/[\s,]/g, '');
  if (clean.length % 2 !== 0) throw new Error(`hex string has odd length: "${s}"`);
  if (!/^[0-9a-f]*$/i.test(clean)) throw new Error(`invalid hex string: "${s}"`);
  const buf = Buffer.alloc(clean.length / 2);
  for (let i = 0; i < buf.length; i++) buf[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return buf;
}

export interface FilterOptions {
  /** Only pass events in this direction. */
  dir?: Direction;
  /** Byte-sequence match against the raw payload. */
  hex?: Buffer;
  /** Literal (UTF-8) substring match against the raw payload. */
  string?: Buffer;
  /** Regex matched against the UTF-8-decoded payload. */
  regex?: RegExp;
}

/**
 * Per-event predicate. All specified criteria must pass for an event to be
 * forwarded to sinks. Note this matches within a single event; stream-level
 * patterns that span event boundaries belong to the search/analysis layer.
 */
export class Matcher {
  constructor(private readonly opts: FilterOptions) {}

  matches(e: TrafficEvent): boolean {
    if (this.opts.dir && e.dir !== this.opts.dir) return false;
    if (this.opts.hex && !e.data.includes(this.opts.hex)) return false;
    if (this.opts.string && !e.data.includes(this.opts.string)) return false;
    if (this.opts.regex && !this.opts.regex.test(e.data.toString('utf8'))) return false;
    return true;
  }
}
