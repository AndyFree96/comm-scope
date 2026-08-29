import fs from 'node:fs';
import readline from 'node:readline';
import type { Direction, TrafficEvent } from '../event/events.js';
import type { Transport } from '../transport/transport.js';
import { decodeHeader, decodeEvent } from '../format/jsonl.js';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Read a recording's events into memory, optionally filtering by direction. */
export async function readEvents(file: string, dir?: Direction): Promise<TrafficEvent[]> {
  const events: TrafficEvent[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  let headerSeen = false;
  for await (const line of rl) {
    if (!headerSeen) {
      decodeHeader(line);
      headerSeen = true;
      continue;
    }
    const e = decodeEvent(line);
    if (dir && e.dir !== dir) continue;
    events.push(e);
  }
  return events;
}

export interface ReplayOptions {
  /** Replay speed multiplier. 1 = real-time, 0 = as fast as possible. */
  speed?: number;
  /** Only replay events in this direction. Defaults to all. */
  dir?: Direction;
  /** Re-send continuously until interrupted. */
  loop?: boolean;
  /** Progress callback, fired once per event sent. */
  onProgress?: (sent: number, total: number) => void;
}

/**
 * Re-send a recording's bytes to a live transport at the original timing.
 * Resolves once finished (never, when `loop` is set — interrupt externally).
 */
export async function replayFileToTransport(
  file: string,
  target: Transport,
  opts: ReplayOptions = {},
): Promise<number> {
  const events = await readEvents(file, opts.dir);
  const speed = opts.speed ?? 1;
  const total = events.length;
  let sent = 0;

  for (;;) {
    let prevT: number | undefined;
    for (const e of events) {
      if (prevT !== undefined && speed > 0) {
        const wait = (e.ts - prevT) / speed;
        if (wait > 0) await sleep(wait);
      }
      prevT = e.ts;
      await target.send(e.data);
      sent++;
      opts.onProgress?.(sent, total);
    }
    if (!opts.loop) break;
  }

  return sent;
}
