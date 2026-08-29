import type { Writable } from 'node:stream';
import type { TrafficEvent } from '../event/events.js';
import type { Sink } from './sink.js';
import { encodeEvent, encodeHeader } from '../format/jsonl.js';
import type { SessionHeader } from '../format/jsonl.js';

/**
 * Writes traffic as JSON Lines. Owns the target stream: it writes the header
 * immediately and ends the stream when the session closes.
 */
export class JsonlRecorder implements Sink {
  private readonly header: SessionHeader;

  constructor(
    private readonly stream: Writable,
    header: SessionHeader,
  ) {
    this.header = header;
    this.stream.write(encodeHeader(header) + '\n');
  }

  onEvent(e: TrafficEvent): void {
    this.stream.write(encodeEvent(e) + '\n');
  }

  onClose(): void {
    this.stream.end();
  }
}
