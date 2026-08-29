import type { TrafficEvent } from '../event/events.js';
import type { Sink } from './sink.js';

export interface TrafficStats {
  firstTs: number;
  lastTs: number;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
}

export interface TrafficSummary extends TrafficStats {
  durationMs: number;
  rxRate: number;
  txRate: number;
  totalRate: number;
}

/**
 * Accumulates byte/packet counters and rates. Attach alongside a renderer or
 * recorder; call {@link summarize} when the session ends.
 */
export class Analyzer implements Sink {
  private firstTs = 0;
  private lastTs = 0;
  private rxBytes = 0;
  private txBytes = 0;
  private rxPackets = 0;
  private txPackets = 0;

  onEvent(e: TrafficEvent): void {
    if (this.firstTs === 0) this.firstTs = e.ts;
    this.lastTs = e.ts;
    if (e.dir === 'rx') {
      this.rxBytes += e.data.length;
      this.rxPackets++;
    } else {
      this.txBytes += e.data.length;
      this.txPackets++;
    }
  }

  onClose(): void {}

  summarize(): TrafficSummary {
    const durationMs = Math.max(0, this.lastTs - this.firstTs);
    const secs = durationMs / 1000 || 1;
    return {
      firstTs: this.firstTs,
      lastTs: this.lastTs,
      rxBytes: this.rxBytes,
      txBytes: this.txBytes,
      rxPackets: this.rxPackets,
      txPackets: this.txPackets,
      durationMs,
      rxRate: this.rxBytes / secs,
      txRate: this.txBytes / secs,
      totalRate: (this.rxBytes + this.txBytes) / secs,
    };
  }
}
