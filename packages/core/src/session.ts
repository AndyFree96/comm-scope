import type { DataSource } from './source/source.js';
import type { Sink } from './sink/sink.js';
import type { Matcher } from './sink/filter.js';
import type { TrafficEvent } from './event/events.js';

export interface SessionOptions {
  filter?: Matcher;
  sinks?: Sink[];
}

/**
 * Wires a {@link DataSource} to a set of sinks, applying an optional filter.
 * This is the shared glue behind `monitor`, `view` and `replay`: the source is
 * swapped (live transport vs recording file), the sink graph stays the same.
 */
export class Session {
  private readonly sinks: Sink[];
  private finished = false;

  constructor(
    private readonly source: DataSource,
    private readonly opts: SessionOptions = {},
  ) {
    this.sinks = opts.sinks ?? [];
  }

  async run(): Promise<void> {
    this.source.on('data', (e) => this.dispatch(e));
    this.source.on('close', () => this.finish());
    await this.source.start();
  }

  private dispatch(e: TrafficEvent): void {
    if (this.opts.filter && !this.opts.filter.matches(e)) return;
    for (const sink of this.sinks) sink.onEvent(e);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    for (const sink of this.sinks) sink.onClose();
  }

  async stop(): Promise<void> {
    await this.source.stop();
    this.finish();
  }
}
