import { describe, it, expect, afterEach } from 'vitest';
import dgram from 'node:dgram';
import { UdpListenTransport } from '../src/transport/udp.js';
import type { TrafficEvent } from '../src/event/events.js';

const transports: UdpListenTransport[] = [];

afterEach(async () => {
  await Promise.all(transports.splice(0).map((t) => t.stop()));
});

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = dgram.createSocket('udp4');
    s.bind(0, () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
    s.once('error', reject);
  });
}

describe('UdpListenTransport', () => {
  it('emits rx events for incoming datagrams', async () => {
    const port = await freePort();
    const transport = new UdpListenTransport('127.0.0.1', port);
    transports.push(transport);

    const received = new Promise<TrafficEvent>((resolve) => {
      transport.on('data', resolve);
    });

    await transport.start();

    const client = dgram.createSocket('udp4');
    await new Promise<void>((resolve) => {
      client.send(Buffer.from('ping'), port, '127.0.0.1', () => {
        client.close(() => resolve());
      });
    });

    const e = await received;
    expect(e.dir).toBe('rx');
    expect(e.data.toString()).toBe('ping');
    expect(e.transport.kind).toBe('udp-listen');
    expect(e.transport.id).toContain('127.0.0.1');
  });
});
