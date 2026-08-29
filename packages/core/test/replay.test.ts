import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { replayFileToTransport, readEvents } from '../src/replay/replay.js';
import { encodeHeader, encodeEvent, SCHEMA_VERSION } from '../src/format/jsonl.js';
import type { Transport } from '../src/transport/transport.js';
import type { TrafficEvent } from '../src/event/events.js';

const meta = { kind: 'udp' as const, id: 'x', desc: 'udp:x' };

function writeRecording(events: TrafficEvent[]): string {
  const file = path.join(os.tmpdir(), `comm-scope-test-${Date.now()}-${Math.random()}.jsonl`);
  const header = encodeHeader({ version: SCHEMA_VERSION, kind: 'udp', id: 'x', desc: 'udp:x', started: 0 });
  const lines = [header, ...events.map((e) => encodeEvent(e))].join('\n') + '\n';
  fs.writeFileSync(file, lines);
  return file;
}

function fakeTransport(sent: Buffer[]): Transport {
  return {
    start: async () => {},
    stop: async () => {},
    send: async (data: Buffer) => {
      sent.push(data);
    },
    on: () => {},
    off: () => {},
  };
}

describe('replay', () => {
  it('readEvents decodes all events in order', async () => {
    const file = writeRecording([
      { ts: 100, dir: 'rx', data: Buffer.from('a'), transport: meta },
      { ts: 200, dir: 'rx', data: Buffer.from('bb'), transport: meta },
      { ts: 300, dir: 'tx', data: Buffer.from('ccc'), transport: meta },
    ]);
    const events = await readEvents(file);
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.data.toString())).toEqual(['a', 'bb', 'ccc']);
    fs.unlinkSync(file);
  });

  it('replayFileToTransport sends every event to the target', async () => {
    const file = writeRecording([
      { ts: 100, dir: 'rx', data: Buffer.from('one'), transport: meta },
      { ts: 200, dir: 'rx', data: Buffer.from('two'), transport: meta },
      { ts: 300, dir: 'tx', data: Buffer.from('three'), transport: meta },
    ]);
    const sent: Buffer[] = [];
    const n = await replayFileToTransport(file, fakeTransport(sent), { speed: 0 });
    expect(n).toBe(3);
    expect(sent.map((b) => b.toString())).toEqual(['one', 'two', 'three']);
    fs.unlinkSync(file);
  });

  it('replayFileToTransport respects a direction filter', async () => {
    const file = writeRecording([
      { ts: 100, dir: 'rx', data: Buffer.from('rx1'), transport: meta },
      { ts: 200, dir: 'tx', data: Buffer.from('tx1'), transport: meta },
    ]);
    const sent: Buffer[] = [];
    await replayFileToTransport(file, fakeTransport(sent), { speed: 0, dir: 'tx' });
    expect(sent.map((b) => b.toString())).toEqual(['tx1']);
    fs.unlinkSync(file);
  });
});
