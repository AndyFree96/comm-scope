import { Matcher, hexToBuffer } from '@anthonyfree96/core';
import type { Direction } from '@anthonyfree96/core';

/** Filter flags shared by `monitor` and `search`. */
export interface FilterFlags {
  string?: string;
  hex?: string;
  regex?: string;
  dir?: Direction;
}

/** Build a {@link Matcher} from parsed flags, or undefined if no filter given. */
export function buildMatcher(f: FilterFlags): Matcher | undefined {
  if (f.dir && f.dir !== 'rx' && f.dir !== 'tx') {
    throw new Error(`--dir must be "rx" or "tx", got "${f.dir}"`);
  }
  if (!f.string && !f.hex && !f.regex && !f.dir) return undefined;
  return new Matcher({
    dir: f.dir,
    hex: f.hex ? hexToBuffer(f.hex) : undefined,
    string: f.string ? Buffer.from(f.string, 'utf8') : undefined,
    regex: f.regex ? new RegExp(f.regex) : undefined,
  });
}
