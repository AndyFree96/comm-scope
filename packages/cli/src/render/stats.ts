import type { TrafficSummary } from '@comm-scope/core';

/** Plain-text summary of a captured session. */
export function formatSummary(s: TrafficSummary): string {
  const totalPackets = s.rxPackets + s.txPackets;
  const totalBytes = s.rxBytes + s.txBytes;
  return [
    `duration: ${s.durationMs} ms`,
    `rx: ${s.rxPackets} packets, ${s.rxBytes} bytes (${s.rxRate.toFixed(1)} B/s)`,
    `tx: ${s.txPackets} packets, ${s.txBytes} bytes (${s.txRate.toFixed(1)} B/s)`,
    `total: ${totalPackets} packets, ${totalBytes} bytes`,
  ].join('\n');
}
