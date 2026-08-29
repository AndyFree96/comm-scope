import type { TrafficEvent } from '../event/events.js';

/**
 * A consumer of the traffic stream. Sinks are composable: a single session can
 * feed a live renderer, a recorder and an analyzer simultaneously, and future
 * GUI frontends become just another sink implementation.
 */
export interface Sink {
  /** Called for every event that passes any upstream filter. */
  onEvent(e: TrafficEvent): void;
  /** Called once when the source stops or the session ends. */
  onClose(): void;
}
