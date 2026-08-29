import type { Transport } from './transport.js';
import { TcpClientTransport, TcpServerTransport } from './tcp.js';
import { UdpTransport, UdpListenTransport } from './udp.js';
import { SerialTransport, DEFAULT_BAUD } from './serial.js';

/**
 * Parsed form of a transport spec string such as `tcp-listen:9000`.
 * Reversible: {@link toDesc} regenerates the canonical spec.
 */
export type TransportSpec =
  | { kind: 'serial'; port: string; baud: number }
  | { kind: 'tcp-client'; host: string; port: number }
  | { kind: 'tcp-server'; host: string; port: number }
  | { kind: 'udp'; host: string; port: number }
  | { kind: 'udp-listen'; host: string; port: number };

function parsePort(s: string): number {
  if (!/^\d+$/.test(s)) throw new Error(`invalid port "${s}"`);
  const p = Number(s);
  if (p < 1 || p > 65535) throw new Error(`port out of range "${s}"`);
  return p;
}

function parseBaud(s: string): number {
  if (!/^\d+$/.test(s)) throw new Error(`invalid baud "${s}"`);
  const b = Number(s);
  if (b < 1) throw new Error(`invalid baud "${s}"`);
  return b;
}

/** Split `host:port`, accepting bracketed IPv6 `[::1]:9000`. */
function splitHostPort(s: string): { host: string; port: number } {
  let host: string;
  let portStr: string;
  if (s.startsWith('[')) {
    const close = s.indexOf(']');
    if (close < 0) throw new Error(`invalid host:port "${s}"`);
    host = s.slice(1, close);
    portStr = s.slice(close + 1);
    if (!portStr.startsWith(':')) throw new Error(`invalid host:port "${s}"`);
    portStr = portStr.slice(1);
  } else {
    const i = s.lastIndexOf(':');
    if (i < 0) throw new Error(`missing port in "${s}"`);
    host = s.slice(0, i);
    portStr = s.slice(i + 1);
  }
  return { host, port: parsePort(portStr) };
}

/** Split `port` or `host:port` for listener schemes (bind address optional). */
function splitListen(s: string): { host: string; port: number } {
  if (!s.includes(':')) return { host: '', port: parsePort(s) };
  return splitHostPort(s);
}

/** Split `path` or `path:baud` for serial. */
function splitSerial(s: string): { path: string; baud: number } {
  const parts = s.split(':');
  if (parts.length >= 2 && /^\d+$/.test(parts[1]!)) {
    return { path: parts[0]!, baud: parseBaud(parts[1]!) };
  }
  return { path: s, baud: DEFAULT_BAUD };
}

/** Parse a transport spec string into its structured form. */
export function parseSpec(spec: string): TransportSpec {
  const idx = spec.indexOf(':');
  if (idx < 0) throw new Error(`invalid transport spec "${spec}" (expected "scheme:...")`);
  const scheme = spec.slice(0, idx);
  const rest = spec.slice(idx + 1);

  switch (scheme) {
    case 'serial': {
      const { path, baud } = splitSerial(rest);
      return { kind: 'serial', port: path, baud };
    }
    case 'tcp': {
      const { host, port } = splitHostPort(rest);
      return { kind: 'tcp-client', host, port };
    }
    case 'tcp-listen': {
      const { host, port } = splitListen(rest);
      return { kind: 'tcp-server', host, port };
    }
    case 'udp': {
      const { host, port } = splitHostPort(rest);
      return { kind: 'udp', host, port };
    }
    case 'udp-listen': {
      const { host, port } = splitListen(rest);
      return { kind: 'udp-listen', host, port };
    }
    default:
      throw new Error(`unknown transport scheme "${scheme}"`);
  }
}

/** Canonical, reversible descriptor for a spec. */
export function toDesc(spec: TransportSpec): string {
  switch (spec.kind) {
    case 'serial':
      return `serial:${spec.port}:${spec.baud}`;
    case 'tcp-client':
      return `tcp:${spec.host}:${spec.port}`;
    case 'tcp-server':
      return `tcp-listen:${spec.host ? `${spec.host}:` : ''}${spec.port}`;
    case 'udp':
      return `udp:${spec.host}:${spec.port}`;
    case 'udp-listen':
      return `udp-listen:${spec.host ? `${spec.host}:` : ''}${spec.port}`;
  }
}

/** Construct the concrete {@link Transport} for a parsed spec. */
export function createTransport(spec: TransportSpec): Transport {
  switch (spec.kind) {
    case 'serial':
      return new SerialTransport(spec.port, spec.baud);
    case 'tcp-client':
      return new TcpClientTransport(spec.host, spec.port);
    case 'tcp-server':
      return new TcpServerTransport(spec.host, spec.port);
    case 'udp':
      return new UdpTransport(spec.host, spec.port);
    case 'udp-listen':
      return new UdpListenTransport(spec.host, spec.port);
  }
}
