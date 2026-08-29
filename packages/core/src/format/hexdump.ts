/**
 * Formatting helpers shared by the CLI renderers (and reusable by a future GUI).
 * Everything here is pure: `Buffer` in, string out.
 */

const HEX = '0123456789abcdef';

function hexByte(b: number): string {
  return HEX[(b >> 4) & 0xf]! + HEX[b & 0xf]!;
}

/** Lowercase hex of every byte, space-separated. */
export function toHex(buf: Buffer): string {
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    if (i > 0) out += ' ';
    out += hexByte(buf[i]!);
  }
  return out;
}

/** Printable ASCII where possible, `.` otherwise. */
export function toAscii(buf: Buffer): string {
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i]!;
    out += c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : '.';
  }
  return out;
}

export interface HexDumpLine {
  /** 8-digit zero-padded hex offset. */
  offset: string;
  hex: string;
  ascii: string;
}

/**
 * Classic `xxd`-style dump, grouped 8 bytes / 16 bytes per row, with an
 * ASCII gutter. Returns one object per row.
 */
export function hexdump(buf: Buffer, bytesPerRow = 16): HexDumpLine[] {
  const lines: HexDumpLine[] = [];
  for (let base = 0; base < buf.length; base += bytesPerRow) {
    const row = buf.subarray(base, base + bytesPerRow);
    const hexParts: string[] = [];
    let ascii = '';
    for (let i = 0; i < row.length; i++) {
      hexParts.push(hexByte(row[i]!));
      if (i === 7) hexParts.push(' '); // visual gap after byte 7
      ascii += toAscii(row.subarray(i, i + 1));
    }
    // Pad the hex column so every row lines up.
    const targetHex = bytesPerRow * 2 + Math.floor(bytesPerRow / 8);
    const hex = hexParts.join(' ').padEnd(targetHex, ' ');
    lines.push({
      offset: base.toString(16).padStart(8, '0'),
      hex,
      ascii,
    });
  }
  return lines;
}
