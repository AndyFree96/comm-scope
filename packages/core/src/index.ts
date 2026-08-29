export type { Direction, TransportKind, TransportMeta, TrafficEvent, SourceEventMap } from './event/events.js';
export { TrafficBus } from './event/bus.js';
export type { DataSource } from './source/source.js';
export type { Transport } from './transport/transport.js';
export type { Sink } from './sink/sink.js';
export { toHex, toAscii, hexdump } from './format/hexdump.js';
export type { HexDumpLine } from './format/hexdump.js';
export { parseSpec, toDesc, createTransport } from './transport/factory.js';
export type { TransportSpec } from './transport/factory.js';
export { listSerialPorts, DEFAULT_BAUD } from './transport/serial.js';
export { Matcher, hexToBuffer } from './sink/filter.js';
export type { FilterOptions } from './sink/filter.js';
export { Session } from './session.js';
export type { SessionOptions } from './session.js';
export {
  encodeHeader,
  decodeHeader,
  encodeEvent,
  decodeEvent,
  SCHEMA_VERSION,
  MAGIC_KEY,
} from './format/jsonl.js';
export type { SessionHeader } from './format/jsonl.js';
export { JsonlRecorder } from './sink/recorder.js';
export { FileSource } from './source/file-source.js';
export type { FileSourceOptions } from './source/file-source.js';
export { Analyzer } from './sink/analyzer.js';
export type { TrafficStats, TrafficSummary } from './sink/analyzer.js';
export { replayFileToTransport, readEvents } from './replay/replay.js';
export type { ReplayOptions } from './replay/replay.js';
