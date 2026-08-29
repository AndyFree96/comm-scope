import dgram from 'node:dgram';
import type { TrafficEvent, TransportMeta } from '../event/events.js';
import { TrafficBus } from '../event/bus.js';
import type { Transport } from './transport.js';

type UdpType = 'udp4' | 'udp6';

function udpTypeFor(host: string): UdpType {
  return host.includes(':') ? 'udp6' : 'udp4';
}

/** Point-to-point UDP: sends to `host:port`, receives replies from it only. */
export class UdpTransport extends TrafficBus implements Transport {
  private socket: dgram.Socket | undefined;
  private readonly meta: TransportMeta;

  constructor(
    private readonly host: string,
    private readonly port: number,
  ) {
    super();
    this.meta = { kind: 'udp', id: `${host}:${port}`, desc: `udp:${host}:${port}` };
  }

  async start(): Promise<void> {
    const socket = dgram.createSocket(udpTypeFor(this.host));
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      socket.once('error', reject);
      socket.bind(0, () => {
        socket.off('error', reject);
        resolve();
      });
    });
    socket.on('message', (msg: Buffer, rinfo) => {
      // Only accept datagrams from the configured peer.
      if (rinfo.address !== this.host || rinfo.port !== this.port) return;
      const e: TrafficEvent = { ts: Date.now(), dir: 'rx', data: msg, transport: this.meta };
      this.emitData(e);
    });
    socket.on('error', (err) => this.emit('error', { source: this, error: err }));
    this.emit('open', { source: this, meta: this.meta });
  }

  async send(data: Buffer): Promise<void> {
    const socket = this.socket;
    if (!socket) throw new Error('udp: not bound');
    await new Promise<void>((resolve, reject) => {
      socket.send(data, this.port, this.host, (err) => (err ? reject(err) : resolve()));
    });
    const e: TrafficEvent = { ts: Date.now(), dir: 'tx', data, transport: this.meta };
    this.emitData(e);
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (!this.socket) return resolve();
      this.socket.close(() => resolve());
    });
    this.socket = undefined;
  }
}

/** Passive UDP listener: binds a local port and monitors datagrams from anyone. */
export class UdpListenTransport extends TrafficBus implements Transport {
  private socket: dgram.Socket | undefined;
  private lastPeer: { address: string; port: number } | undefined;
  private readonly meta: TransportMeta;

  constructor(
    private readonly host: string,
    private readonly port: number,
  ) {
    super();
    const label = `${this.host || '0.0.0.0'}:${this.port}`;
    this.meta = { kind: 'udp-listen', id: label, desc: `udp-listen:${label}` };
  }

  async start(): Promise<void> {
    const socket = dgram.createSocket(udpTypeFor(this.host));
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      socket.once('error', reject);
      socket.bind(this.port, this.host || undefined, () => {
        socket.off('error', reject);
        resolve();
      });
    });
    socket.on('message', (msg: Buffer, rinfo) => {
      this.lastPeer = { address: rinfo.address, port: rinfo.port };
      const meta: TransportMeta = {
        kind: 'udp-listen',
        id: `${rinfo.address}:${rinfo.port}`,
        desc: this.meta.desc,
      };
      const e: TrafficEvent = { ts: Date.now(), dir: 'rx', data: msg, transport: meta };
      this.emitData(e);
    });
    socket.on('error', (err) => this.emit('error', { source: this, error: err }));
    this.emit('open', { source: this, meta: this.meta });
  }

  async send(data: Buffer): Promise<void> {
    const socket = this.socket;
    const peer = this.lastPeer;
    if (!socket) throw new Error('udp-listen: not bound');
    if (!peer) throw new Error('udp-listen: no peer has sent yet');
    await new Promise<void>((resolve, reject) => {
      socket.send(data, peer.port, peer.address, (err) => (err ? reject(err) : resolve()));
    });
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (!this.socket) return resolve();
      this.socket.close(() => resolve());
    });
    this.socket = undefined;
  }
}
