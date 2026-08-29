import net from 'node:net';
import type { TrafficEvent, TransportMeta } from '../event/events.js';
import { TrafficBus } from '../event/bus.js';
import type { Transport } from './transport.js';

/** Outbound TCP client: connects to `host:port` and monitors the stream. */
export class TcpClientTransport extends TrafficBus implements Transport {
  private socket: net.Socket | undefined;
  private readonly meta: TransportMeta;

  constructor(
    private readonly host: string,
    private readonly port: number,
  ) {
    super();
    this.meta = {
      kind: 'tcp-client',
      id: `${host}:${port}`,
      desc: `tcp:${host}:${port}`,
    };
  }

  async start(): Promise<void> {
    const socket = net.createConnection({ host: this.host, port: this.port });
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });
    socket.on('data', (data: Buffer) => this.onRx(data));
    socket.on('close', () => this.emit('close', { source: this, meta: this.meta }));
    socket.on('error', (err) => this.emit('error', { source: this, error: err }));
    this.emit('open', { source: this, meta: this.meta });
  }

  private onRx(data: Buffer): void {
    const e: TrafficEvent = { ts: Date.now(), dir: 'rx', data, transport: this.meta };
    this.emitData(e);
  }

  async send(data: Buffer): Promise<void> {
    const socket = this.socket;
    if (!socket) throw new Error('tcp-client: not connected');
    await new Promise<void>((resolve, reject) => {
      socket.write(data, (err) => (err ? reject(err) : resolve()));
    });
    const e: TrafficEvent = { ts: Date.now(), dir: 'tx', data, transport: this.meta };
    this.emitData(e);
  }

  async stop(): Promise<void> {
    this.socket?.destroy();
    this.socket = undefined;
  }
}

/** Inbound TCP server: listens and monitors every accepted client. */
export class TcpServerTransport extends TrafficBus implements Transport {
  private server: net.Server | undefined;
  private readonly sockets = new Map<string, net.Socket>();

  constructor(
    private readonly host: string,
    private readonly port: number,
  ) {
    super();
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const server = net.createServer((socket) => this.onConnection(socket));
      server.once('error', reject);
      server.listen(this.port, this.host || undefined, () => {
        server.off('error', reject);
        resolve();
      });
      this.server = server;
    });
    const meta: TransportMeta = {
      kind: 'tcp-server',
      id: `${this.host || '0.0.0.0'}:${this.port}`,
      desc: `tcp-listen:${this.host ? `${this.host}:` : ''}${this.port}`,
    };
    this.emit('open', { source: this, meta });
  }

  private onConnection(socket: net.Socket): void {
    const remote = `${socket.remoteAddress ?? '?'}:${socket.remotePort ?? '?'}`;
    const meta: TransportMeta = {
      kind: 'tcp-server',
      id: remote,
      desc: `tcp-listen:${this.port}#${remote}`,
    };
    this.sockets.set(remote, socket);
    socket.on('data', (data: Buffer) => {
      const e: TrafficEvent = { ts: Date.now(), dir: 'rx', data, transport: meta };
      this.emitData(e);
    });
    socket.on('close', () => this.sockets.delete(remote));
    socket.on('error', (err) => this.emit('error', { source: this, error: err }));
  }

  async send(data: Buffer): Promise<void> {
    const writes: Promise<void>[] = [];
    for (const socket of this.sockets.values()) {
      writes.push(
        new Promise<void>((resolve, reject) => {
          socket.write(data, (err) => (err ? reject(err) : resolve()));
        }),
      );
    }
    await Promise.all(writes);
  }

  async stop(): Promise<void> {
    for (const socket of this.sockets.values()) socket.destroy();
    this.sockets.clear();
    await new Promise<void>((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
    });
    this.server = undefined;
  }
}
