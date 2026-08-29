import { SerialPort } from 'serialport';
import type { TrafficEvent, TransportMeta } from '../event/events.js';
import { TrafficBus } from '../event/bus.js';
import type { Transport } from './transport.js';

export const DEFAULT_BAUD = 115200;

/** Serial transport backed by the `serialport` native binding. */
export class SerialTransport extends TrafficBus implements Transport {
  private port: SerialPort | undefined;
  private readonly meta: TransportMeta;

  constructor(
    private readonly path: string,
    private readonly baud: number,
  ) {
    super();
    this.meta = { kind: 'serial', id: path, desc: `serial:${path}:${baud}` };
  }

  async start(): Promise<void> {
    const port = new SerialPort({ path: this.path, baudRate: this.baud });
    this.port = port;
    await new Promise<void>((resolve, reject) => {
      port.once('open', resolve);
      port.once('error', reject);
    });
    port.on('data', (data: Buffer) => {
      const e: TrafficEvent = { ts: Date.now(), dir: 'rx', data, transport: this.meta };
      this.emitData(e);
    });
    port.on('close', () => this.emit('close', { source: this, meta: this.meta }));
    port.on('error', (err) => this.emit('error', { source: this, error: err }));
    this.emit('open', { source: this, meta: this.meta });
  }

  async send(data: Buffer): Promise<void> {
    if (!this.port) throw new Error('serial: not open');
    await new Promise<void>((resolve, reject) => {
      this.port!.write(data, (err) => (err ? reject(err) : resolve()));
    });
    const e: TrafficEvent = { ts: Date.now(), dir: 'tx', data, transport: this.meta };
    this.emitData(e);
  }

  async stop(): Promise<void> {
    if (!this.port) return;
    const port = this.port;
    this.port = undefined;
    await new Promise<void>((resolve) => port.close(() => resolve()));
  }
}

/** Enumerate attached serial ports. */
export async function listSerialPorts(): Promise<{ path: string; manufacturer?: string }[]> {
  const ports = await SerialPort.list();
  return ports.map((p) => ({ path: p.path, manufacturer: p.manufacturer }));
}
