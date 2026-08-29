import { describe, it, expect } from 'vitest';
import { Analyzer } from '../src/sink/analyzer.js';
import type { TrafficEvent } from '../src/event/events.js';

const meta = { kind: 'udp' as const, id: 'x', desc: 'udp:x' };

function ev(ts: number, dir: 'rx' | 'tx', len: number): TrafficEvent {
  return { ts, dir, data: Buffer.alloc(len), transport: meta };
}

describe('Analyzer', () => {
  it('accumulates per-direction bytes and packets', () => {
    const a = new Analyzer();
    a.onEvent(ev(1000, 'rx', 10));
    a.onEvent(ev(1010, 'rx', 20));
    a.onEvent(ev(1020, 'tx', 5));
    const s = a.summarize();
    expect(s.rxPackets).toBe(2);
    expect(s.rxBytes).toBe(30);
    expect(s.txPackets).toBe(1);
    expect(s.txBytes).toBe(5);
    expect(s.durationMs).toBe(20);
  });

  it('computes rates as bytes per second', () => {
    const a = new Analyzer();
    a.onEvent(ev(0, 'rx', 1000));
    a.onEvent(ev(1000, 'rx', 1000));
    const s = a.summarize();
    // 2000 bytes over 1 second
    expect(s.rxRate).toBeCloseTo(2000, 0);
  });

  it('reports zero duration safely for a single event', () => {
    const a = new Analyzer();
    a.onEvent(ev(500, 'rx', 8));
    const s = a.summarize();
    expect(s.durationMs).toBe(0);
    expect(s.rxRate).toBe(8); // secs falls back to 1
  });
});
