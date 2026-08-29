import fs from 'node:fs';
import { JsonlRecorder, toDesc, SCHEMA_VERSION } from '@anthonyfree96/core';
import type { TransportSpec } from '@anthonyfree96/core';

/** Build a recorder wired to `outFile`, with a header derived from the spec. */
export function makeRecorder(spec: TransportSpec, outFile: string): JsonlRecorder {
  const desc = toDesc(spec);
  return new JsonlRecorder(fs.createWriteStream(outFile), {
    version: SCHEMA_VERSION,
    kind: spec.kind,
    id: desc,
    desc,
    started: Date.now(),
  });
}
