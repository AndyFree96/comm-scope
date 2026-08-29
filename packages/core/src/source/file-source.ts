import fs from 'node:fs';
import readline from 'node:readline';
import type { Direction, TransportMeta } from '../event/events.js';
import { TrafficBus } from '../event/bus.js';
import type { DataSource } from './source.js';
import { decodeEvent, decodeHeader } from '../format/jsonl.js';
import type { SessionHeader } from '../format/jsonl.js';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface FileSourceOptions {
  /** Replay speed multiplier. 1 = real-time, 0 = as fast as possible. */
  speed?: number;
  /** Optional direction filter applied while reading. */
  dir?: Direction;
}

/**
 * Offline data source: reads a recording and re-emits its events at the
 * original timing (scaled by `speed`). Swappable for any live transport, which
 * is what makes `view` behave identically to `monitor`.
 */
export class FileSource extends TrafficBus implements DataSource {
  private stopped = false;
  private rl: readline.Interface | undefined;
  private readonly meta: TransportMeta;

  constructor(
    private readonly file: string,
    private readonly opts: FileSourceOptions = {},
  ) {
    super();
    // Placeholder meta; replaced by the header's metadata once read.
    this.meta = { kind: 'serial', id: file, desc: file };
  }

  async start(): Promise<void> {
    this.stopped = false;
    const rl = readline.createInterface({
      input: fs.createReadStream(this.file),
      crlfDelay: Infinity,
    });
    this.rl = rl;

    const speed = this.opts.speed ?? 1;
    let prevT: number | undefined;
    let header: SessionHeader | undefined;

    try {
      for await (const line of rl) {
        if (this.stopped) break;
        if (header === undefined) {
          header = decodeHeader(line);
          this.emit('open', { source: this, meta: this.headerMeta(header) });
          continue;
        }
        const e = decodeEvent(line);
        if (this.opts.dir && e.dir !== this.opts.dir) continue;
        if (prevT !== undefined && speed > 0) {
          const wait = (e.ts - prevT) / speed;
          if (wait > 0) await sleep(wait);
        }
        prevT = e.ts;
        this.emitData(e);
      }
    } finally {
      if (!this.stopped) {
        this.emit('close', { source: this, meta: this.meta });
      }
    }
  }

  private headerMeta(h: SessionHeader): TransportMeta {
    return { kind: h.kind, id: h.id, desc: h.desc };
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.rl?.close();
  }
}
