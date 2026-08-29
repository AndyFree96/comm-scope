import type { DataSource } from '../source/source.js';

/**
 * A live transport: a {@link DataSource} that additionally allows writing
 * bytes to the peer (used by the online-replay path to re-send recorded data).
 */
export interface Transport extends DataSource {
  /** Write bytes to the peer. Resolves once handed to the underlying channel. */
  send(data: Buffer): Promise<void>;
}
