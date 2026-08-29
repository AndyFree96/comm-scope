import type { TrafficEvent, SourceEventMap } from '../event/events.js';

/**
 * A stream of {@link TrafficEvent}s. Implemented by both live transports
 * (Serial/TCP/UDP) and offline sources (a recording file being played back),
 * so the presentation and sink layers never need to know which they have.
 */
export interface DataSource {
  /** Begin producing events. */
  start(): Promise<void>;
  /** Stop producing events and release resources. */
  stop(): Promise<void>;

  /** Subscribe to traffic. */
  on(event: 'data', fn: (e: TrafficEvent) => void): void;
  /** Subscribe to a lifecycle event. */
  on<K extends keyof SourceEventMap>(event: K, fn: (e: SourceEventMap[K]) => void): void;
  /** Unsubscribe a previously registered listener. */
  off(event: string, fn: (...args: any[]) => void): void;
}
