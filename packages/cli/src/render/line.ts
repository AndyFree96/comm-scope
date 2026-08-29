import chalk from 'chalk';
import { toHex } from '@comm-scope/core';
import type { TrafficEvent } from '@comm-scope/core';

export type StreamMode = 'hex' | 'ascii' | 'raw';

export interface LineOptions {
  mode: StreamMode;
  timestamp: boolean;
  color: boolean;
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

export function fmtAscii(buf: Buffer): string {
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i]!;
    if (b === 0x0a) out += '\\n';
    else if (b === 0x0d) out += '\\r';
    else if (b === 0x09) out += '\\t';
    else if (b >= 0x20 && b <= 0x7e) out += String.fromCharCode(b);
    else out += '.';
  }
  return out;
}

function dir(dir: 'rx' | 'tx'): string {
  return dir === 'rx' ? chalk.green('rx') : chalk.yellow('tx');
}

function peer(e: TrafficEvent): string {
  if (e.transport.kind === 'tcp-server' || e.transport.kind === 'udp-listen') {
    return chalk.dim(`[${e.transport.id}] `);
  }
  return '';
}

/** Render a single event as one line (hex or ascii). */
export function formatEventLine(e: TrafficEvent, opts: LineOptions): string {
  const ts = opts.timestamp ? chalk.gray(fmtTime(e.ts)) + ' ' : '';
  const body =
    opts.mode === 'hex'
      ? chalk.white(toHex(e.data)) + chalk.gray(' | ') + chalk.dim(fmtAscii(e.data)) + chalk.gray(' |')
      : chalk.white(fmtAscii(e.data));
  return `${ts}${dir(e.dir)} ${peer(e)}${body}`;
}
