import blessed from 'neo-blessed';
import type { BlessedScreen, BlessedWidget } from 'neo-blessed';
import { toHex } from '@comm-scope/core';
import type { Sink, TrafficEvent } from '@comm-scope/core';
import { fmtTime, fmtAscii } from './line.js';

export interface TuiOptions {
  desc: string;
  onExit: () => void;
}

/**
 * Interactive full-screen dashboard built on neo-blessed: a scrolling traffic
 * log plus a live stats strip. Press `q` or `Ctrl-C` to quit (handled here,
 * since blessed takes over the terminal).
 */
export class TuiRenderer implements Sink {
  private readonly screen: BlessedScreen;
  private readonly log: BlessedWidget;
  private readonly stats: BlessedWidget;

  private rxBytes = 0;
  private txBytes = 0;
  private rxPackets = 0;
  private txPackets = 0;
  private startTs = 0;

  constructor(private readonly opts: TuiOptions) {
    this.screen = blessed.screen({ smartCSR: true, title: 'comm-scope', fullUnicode: true });

    blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: ` comm-scope — ${opts.desc} (q to quit)`,
      style: { bg: 'blue', fg: 'white' },
    });

    this.stats = blessed.box({
      parent: this.screen,
      top: 1,
      left: 0,
      width: '100%',
      height: 3,
      content: this.statsText(),
      border: { type: 'line' },
      style: { fg: 'cyan' },
    });

    this.log = blessed.log({
      parent: this.screen,
      top: 4,
      left: 0,
      width: '100%',
      height: '100%-4',
      border: { type: 'line' },
      scrollback: 10000,
      mouse: true,
      keys: true,
      vi: true,
    });

    this.screen.key(['q', 'C-c'], () => {
      this.screen.destroy();
      this.opts.onExit();
    });

    this.screen.render();
  }

  onEvent(e: TrafficEvent): void {
    if (this.startTs === 0) this.startTs = e.ts;
    if (e.dir === 'rx') {
      this.rxBytes += e.data.length;
      this.rxPackets++;
    } else {
      this.txBytes += e.data.length;
      this.txPackets++;
    }
    const peer =
      e.transport.kind === 'tcp-server' || e.transport.kind === 'udp-listen'
        ? `[${e.transport.id}] `
        : '';
    this.log.log(
      `${fmtTime(e.ts)} ${e.dir} ${peer}${toHex(e.data)} | ${fmtAscii(e.data)}`,
    );
    this.stats.setContent(this.statsText());
    this.screen.render();
  }

  /** Append a status/error line to the log. */
  logLine(msg: string): void {
    this.log.log(msg);
    this.screen.render();
  }

  onClose(): void {}

  private statsText(): string {
    const durationMs = this.startTs === 0 ? 0 : Date.now() - this.startTs;
    const secs = durationMs / 1000 || 1;
    const rxRate = this.rxBytes / secs;
    const txRate = this.txBytes / secs;
    return (
      ` rx ${this.rxPackets} pkts / ${this.rxBytes} B (${rxRate.toFixed(0)} B/s)   ` +
      `tx ${this.txPackets} pkts / ${this.txBytes} B (${txRate.toFixed(0)} B/s)`
    );
  }
}
