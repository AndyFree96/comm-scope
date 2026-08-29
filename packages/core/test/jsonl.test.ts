import { describe, it, expect } from 'vitest';
import {
  encodeHeader,
  decodeHeader,
  encodeEvent,
  decodeEvent,
  SCHEMA_VERSION,
} from '../src/format/jsonl.js';
import type { SessionHeader } from '../src/format/jsonl.js';
import type { TrafficEvent } from '../src/event/events.js';

const header: SessionHeader = {
  version: SCHEMA_VERSION,
  kind: 'udp-listen',
  id: '0.0.0.0:19999',
  desc: 'udp-listen:0.0.0.0:19999',
  started: 1693300000000,
};

const event: TrafficEvent = {
  ts: 1693300000123,
  dir: 'rx',
  data: Buffer.from([0x00, 0xff, 0x0a, 0x41]),
  transport: { kind: 'udp-listen', id: '127.0.0.1:61548', desc: 'udp-listen:0.0.0.0:19999' },
};

describe('jsonl header', () => {
  it('round-trips', () => {
    expect(decodeHeader(encodeHeader(header))).toEqual(header);
  });

  it('rejects a non-recording line', () => {
    expect(() => decodeHeader('{"foo":1}')).toThrow(/not a comm-scope recording/);
  });
});

describe('jsonl event', () => {
  it('round-trips binary payloads losslessly', () => {
    const e = decodeEvent(encodeEvent(event));
    expect(e.ts).toBe(event.ts);
    expect(e.dir).toBe(event.dir);
    expect(e.data.equals(event.data)).toBe(true);
    expect(e.transport).toEqual(event.transport);
  });

  it('rejects unknown encodings', () => {
    expect(() => decodeEvent('{"enc":"base64","data":"AA=="}')).toThrow(/unsupported payload encoding/);
  });
});
