/** Direction of a piece of traffic relative to the monitored peer. */
export type Direction = 'rx' | 'tx';

/** The concrete kind of transport a session is bound to. */
export type TransportKind =
  | 'serial'
  | 'tcp-client'
  | 'tcp-server'
  | 'udp'
  | 'udp-listen';

/** Static metadata describing the endpoint a session is attached to. */
export interface TransportMeta {
  kind: TransportKind;
  /** Stable identifier for this endpoint within a session (e.g. a peer address). */
  id: string;
  /** Human-readable, reversible descriptor (e.g. `serial:COM3@115200`). */
  desc: string;
}

/**
 * A single unit of traffic observed (or replayed) by a {@link DataSource}.
 * This is the lingua franca between every source and every sink.
 */
export interface TrafficEvent {
  /** Epoch milliseconds. */
  ts: number;
  dir: Direction;
  data: Buffer;
  transport: TransportMeta;
}

/** Lifecycle events emitted by a {@link DataSource}. */
export interface SourceEventMap {
  open: { source: unknown; meta: TransportMeta };
  close: { source: unknown; meta: TransportMeta };
  error: { source: unknown; error: Error };
}
