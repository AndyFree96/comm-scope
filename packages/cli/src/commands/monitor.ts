import chalk from 'chalk';
import type { Command } from 'commander';
import { parseSpec, createTransport, Session, Analyzer, toDesc } from '@anthonyfree96/core';
import type { Direction, Sink } from '@anthonyfree96/core';
import { StreamRenderer } from '../render/stream.js';
import { TuiRenderer } from '../render/tui.js';
import { buildMatcher } from '../args.js';
import { makeRecorder } from '../recording.js';
import { formatSummary } from '../render/stats.js';
import { flushStdio } from '../stdio.js';

export function registerMonitor(program: Command): void {
  program
    .command('monitor')
    .argument(
      '<spec>',
      'transport spec: serial:PORT[:BAUD] | tcp:HOST:PORT | tcp-listen:PORT | udp:HOST:PORT | udp-listen:PORT',
    )
    .option('--format <mode>', 'hex | ascii | raw', 'hex')
    .option('--no-timestamp', 'omit timestamps')
    .option('--no-color', 'disable ANSI colors')
    .option('--string <s>', 'only show events containing this UTF-8 substring')
    .option('--hex <h>', 'only show events containing this hex byte sequence')
    .option('--regex <re>', 'only show events whose UTF-8 text matches this regex')
    .option('--dir <dir>', 'only show rx or tx')
    .option('--record <file>', 'also record traffic to file')
    .option('--stats', 'print traffic statistics on exit')
    .option('--timeout <s>', 'stop after N seconds')
    .option('--tui', 'interactive dashboard')
    .action(async (spec: string, opts: Record<string, unknown>) => {
      let specParsed;
      try {
        specParsed = parseSpec(spec);
      } catch (err) {
        process.stderr.write(chalk.red(`error: ${(err as Error).message}\n`));
        process.exit(1);
      }

      let filter;
      try {
        filter = buildMatcher({
          string: opts.string as string | undefined,
          hex: opts.hex as string | undefined,
          regex: opts.regex as string | undefined,
          dir: opts.dir as Direction | undefined,
        });
      } catch (err) {
        process.stderr.write(chalk.red(`error: ${(err as Error).message}\n`));
        process.exit(1);
      }

      const transport = createTransport(specParsed);
      const analyzer = opts.stats ? new Analyzer() : undefined;

      let tui: TuiRenderer | undefined;
      let renderer: Sink;
      if (opts.tui) {
        tui = new TuiRenderer({ desc: toDesc(specParsed), onExit: () => void shutdown() });
        renderer = tui;
      } else {
        renderer = new StreamRenderer({
          mode: opts.format as 'hex' | 'ascii' | 'raw',
          timestamp: Boolean(opts.timestamp),
          color: Boolean(opts.color),
        });
      }

      const sinks: Sink[] = [renderer];
      if (opts.record) sinks.push(makeRecorder(specParsed, opts.record as string));
      if (analyzer) sinks.push(analyzer);
      const session = new Session(transport, { filter, sinks });

      transport.on('open', ({ meta }) => {
        if (tui) tui.logLine(`monitoring ${meta.desc}`);
        else process.stderr.write(chalk.dim(`# monitoring ${meta.desc}\n`));
      });
      transport.on('error', ({ error }) => {
        if (tui) tui.logLine(`error: ${error.message}`);
        else process.stderr.write(chalk.red(`error: ${error.message}\n`));
      });

      let shuttingDown = false;
      transport.on('close', () => {
        if (shuttingDown) return;
        if (tui) tui.logLine('closed');
        else process.stderr.write(chalk.dim('# closed\n'));
        process.exit(0);
      });

      async function shutdown(): Promise<void> {
        if (shuttingDown) return;
        shuttingDown = true;
        await session.stop();
        if (analyzer) {
          const summary = formatSummary(analyzer.summarize());
          if (tui) tui.logLine(summary);
          else process.stderr.write(chalk.dim(summary + '\n'));
        }
        await flushStdio();
        process.exit(0);
      }
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      if (opts.timeout) {
        const secs = Number(opts.timeout);
        if (!Number.isFinite(secs) || secs <= 0) {
          process.stderr.write(chalk.red(`error: invalid --timeout "${opts.timeout}"\n`));
          process.exit(1);
        }
        setTimeout(shutdown, secs * 1000);
      }

      try {
        await session.run();
      } catch (err) {
        process.stderr.write(chalk.red(`error: ${(err as Error).message}\n`));
        process.exit(1);
      }
    });
}
