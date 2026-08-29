import { describe, it, expect } from 'vitest';
import { toHex, toAscii, hexdump } from '../src/format/hexdump.js';

describe('toHex', () => {
  it('renders lowercase space-separated hex', () => {
    expect(toHex(Buffer.from([0x00, 0xff, 0x0a]))).toBe('00 ff 0a');
  });

  it('returns empty string for empty buffer', () => {
    expect(toHex(Buffer.alloc(0))).toBe('');
  });
});

describe('toAscii', () => {
  it('maps printable bytes and dots otherwise', () => {
    expect(toAscii(Buffer.from('Hi!'))).toBe('Hi!');
    expect(toAscii(Buffer.from([0x41, 0x00, 0x1f, 0x42]))).toBe('A..B');
  });
});

describe('hexdump', () => {
  it('produces one 16-byte row with offset/hex/ascii', () => {
    const buf = Buffer.from('The quick brown fox jumps over the lazy dog');
    const lines = hexdump(buf, 16);
    expect(lines[0]!.offset).toBe('00000000');
    expect(lines[0]!.ascii).toBe('The quick brown ');
    expect(lines[0]!.hex.split(' ')[0]).toBe('54');
  });

  it('pads the final partial row', () => {
    const lines = hexdump(Buffer.from('abc'), 16);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.ascii).toBe('abc');
    expect(lines[0]!.hex).toContain('61 62 63');
  });

  it('splits across multiple rows', () => {
    const buf = Buffer.alloc(40, 0x41);
    expect(hexdump(buf, 16)).toHaveLength(3);
  });
});
