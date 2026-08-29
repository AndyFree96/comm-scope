import chalk from 'chalk';
import type { Sink, TrafficEvent } from '@anthonyfree96/core';
import { formatEventLine } from './line.js';
import type { LineOptions, StreamMode } from './line.js';

export type { StreamMode } from './line.js';

export interface StreamOptions {
  mode: StreamMode;
  timestamp: boolean;
  color: boolean;
}

/**
 * Streaming, line-oriented renderer. Writes one line per event to `out`
 * (stdout), leaving stderr free for banners/status so output stays pipeable.
 */
export class StreamRenderer implements Sink {
  private readonly opts: LineOptions;

  constructor(
    opts: StreamOptions,
    private readonly out: NodeJS.WriteStream = process.stdout,
  ) {
    this.opts = opts;
    if (!opts.color) chalk.level = 0;
  }

  onEvent(e: TrafficEvent): void {
    if (this.opts.mode === 'raw') {
      this.out.write(e.data);
      return;
    }
    this.out.write(formatEventLine(e, this.opts) + '\n');
  }

  onClose(): void {}
}
