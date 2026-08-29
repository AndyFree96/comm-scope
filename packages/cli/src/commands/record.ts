import chalk from 'chalk';
import type { Command } from 'commander';
import { parseSpec, createTransport, Session, Analyzer } from '@anthonyfree96/core';
import type { Direction, Sink } from '@anthonyfree96/core';
import { buildMatcher } from '../args.js';
import { makeRecorder } from '../recording.js';
import { formatSummary } from '../render/stats.js';
import { flushStdio } from '../stdio.js';

export function registerRecord(program: Command): void {
  program
    .command('record')
    .argument('<spec>', 'transport spec: serial:PORT[:BAUD] | tcp:HOST:PORT | tcp-listen:PORT | udp:HOST:PORT | udp-listen:PORT')
    .requiredOption('--out <file>', 'recording output file')
    .option('--string <s>', 'only record events containing this UTF-8 substring')
    .option('--hex <h>', 'only record events containing this hex byte sequence')
    .option('--regex <re>', 'only record events whose UTF-8 text matches this regex')
    .option('--dir <dir>', 'only record rx or tx')
    .option('--stats', 'print traffic statistics on exit')
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
      const recorder = makeRecorder(specParsed, opts.out as string);

      let count = 0;
      const counter: Sink = {
        onEvent: () => {
          count++;
        },
        onClose: () => {},
      };

      const analyzer = opts.stats ? new Analyzer() : undefined;
      const sinks: Sink[] = [recorder, counter];
      if (analyzer) sinks.push(analyzer);
      const session = new Session(transport, { filter, sinks });

      transport.on('open', ({ meta }) =>
        process.stderr.write(chalk.dim(`# recording ${meta.desc} -> ${opts.out}\n`)),
      );
      transport.on('error', ({ error }) =>
        process.stderr.write(chalk.red(`error: ${error.message}\n`)),
      );

      let shuttingDown = false;
      const shutdown = async () => {
        if (shuttingDown) return;
        shuttingDown = true;
        await session.stop();
        process.stderr.write(chalk.dim(`# recorded ${count} events to ${opts.out}\n`));
        if (analyzer) process.stderr.write(chalk.dim(formatSummary(analyzer.summarize()) + '\n'));
        await flushStdio();
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      try {
        await session.run();
      } catch (err) {
        process.stderr.write(chalk.red(`error: ${(err as Error).message}\n`));
        process.exit(1);
      }
    });
}
