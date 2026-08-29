import { EventEmitter } from 'node:events';
import type { TrafficEvent, SourceEventMap } from './events.js';

/**
 * Typed event dispatcher that satisfies the `on`/`off` surface required by
 * {@link DataSource}. Live transports extend this and simply `emit('data', e)`
 * when bytes arrive.
 */
export class TrafficBus {
  private readonly emitter = new EventEmitter();

  on(event: 'data', fn: (e: TrafficEvent) => void): void;
  on<K extends keyof SourceEventMap>(event: K, fn: (e: SourceEventMap[K]) => void): void;
  on(event: string, fn: (...args: any[]) => void): void {
    this.emitter.on(event, fn);
  }

  off(event: string, fn: (...args: any[]) => void): void {
    this.emitter.off(event, fn);
  }

  protected emitData(e: TrafficEvent): void {
    this.emitter.emit('data', e);
  }

  protected emit<K extends keyof SourceEventMap>(
    event: K,
    payload: SourceEventMap[K],
  ): void {
    this.emitter.emit(event, payload);
  }
}
