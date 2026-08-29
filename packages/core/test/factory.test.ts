import { describe, it, expect } from 'vitest';
import { parseSpec, toDesc, createTransport } from '../src/transport/factory.js';

describe('parseSpec', () => {
  it('parses tcp client', () => {
    expect(parseSpec('tcp:127.0.0.1:9000')).toEqual({
      kind: 'tcp-client',
      host: '127.0.0.1',
      port: 9000,
    });
  });

  it('parses tcp listener with and without bind host', () => {
    expect(parseSpec('tcp-listen:9000')).toEqual({ kind: 'tcp-server', host: '', port: 9000 });
    expect(parseSpec('tcp-listen:0.0.0.0:9000')).toEqual({
      kind: 'tcp-server',
      host: '0.0.0.0',
      port: 9000,
    });
  });

  it('parses udp and udp-listen', () => {
    expect(parseSpec('udp:10.0.0.1:5000')).toEqual({ kind: 'udp', host: '10.0.0.1', port: 5000 });
    expect(parseSpec('udp-listen:5000')).toEqual({ kind: 'udp-listen', host: '', port: 5000 });
  });

  it('parses serial with explicit and default baud', () => {
    expect(parseSpec('serial:COM3:9600')).toEqual({ kind: 'serial', port: 'COM3', baud: 9600 });
    expect(parseSpec('serial:COM3')).toEqual({ kind: 'serial', port: 'COM3', baud: 115200 });
  });

  it('parses bracketed IPv6 host', () => {
    expect(parseSpec('tcp:[::1]:9000')).toEqual({ kind: 'tcp-client', host: '::1', port: 9000 });
  });

  it('rejects unknown schemes and bad ports', () => {
    expect(() => parseSpec('ftp:1:2')).toThrow(/unknown transport scheme/);
    expect(() => parseSpec('tcp:host:notaport')).toThrow(/invalid port/);
    expect(() => parseSpec('tcp:host:99999')).toThrow(/out of range/);
    expect(() => parseSpec('nonsense')).toThrow(/invalid transport spec/);
  });
});

describe('toDesc', () => {
  it('round-trips through parseSpec', () => {
    for (const s of [
      'serial:COM3:115200',
      'tcp:example.com:8080',
      'tcp-listen:9000',
      'udp:1.2.3.4:9999',
      'udp-listen:9999',
    ]) {
      expect(toDesc(parseSpec(s))).toBe(s);
    }
  });
});

describe('createTransport', () => {
  it('builds the right transport class per spec', () => {
    expect(createTransport(parseSpec('tcp:127.0.0.1:1')).constructor.name).toBe(
      'TcpClientTransport',
    );
    expect(createTransport(parseSpec('tcp-listen:1')).constructor.name).toBe('TcpServerTransport');
    expect(createTransport(parseSpec('udp:127.0.0.1:1')).constructor.name).toBe('UdpTransport');
    expect(createTransport(parseSpec('udp-listen:1')).constructor.name).toBe('UdpListenTransport');
  });
});
