import chalk from 'chalk';
import type { Command } from 'commander';
import { FileSource, Session } from '@anthonyfree96/core';
import type { Direction, Sink } from '@anthonyfree96/core';
import { StreamRenderer } from '../render/stream.js';
import { TuiRenderer } from '../render/tui.js';
import { flushStdio } from '../stdio.js';

export function registerView(program: Command): void {
  program
    .command('view')
    .argument('<file>', 'recording file (JSON Lines)')
    .option('--speed <n>', 'replay speed multiplier (0 = as fast as possible)', '1')
    .option('--format <mode>', 'hex | ascii | raw', 'hex')
    .option('--no-timestamp', 'omit timestamps')
    .option('--no-color', 'disable ANSI colors')
    .option('--dir <dir>', 'only show rx or tx')
    .option('--tui', 'interactive dashboard')
    .action(async (file: string, opts: Record<string, unknown>) => {
      const dir = opts.dir as Direction | undefined;
      if (dir && dir !== 'rx' && dir !== 'tx') {
        process.stderr.write(chalk.red(`error: --dir must be "rx" or "tx", got "${dir}"\n`));
        process.exit(1);
      }
      const speed = Number(opts.speed);
      if (Number.isNaN(speed) || speed < 0) {
        process.stderr.write(chalk.red(`error: invalid --speed "${opts.speed}"\n`));
        process.exit(1);
      }

      const source = new FileSource(file, { speed, dir });

      let tui: TuiRenderer | undefined;
      let renderer: Sink;
      if (opts.tui) {
        tui = new TuiRenderer({ desc: `file: ${file}`, onExit: () => void shutdown() });
        renderer = tui;
      } else {
        renderer = new StreamRenderer({
          mode: opts.format as 'hex' | 'ascii' | 'raw',
          timestamp: Boolean(opts.timestamp),
          color: Boolean(opts.color),
        });
      }

      const session = new Session(source, { sinks: [renderer] });

      source.on('open', ({ meta }) => {
        if (tui) tui.logLine(`replaying ${meta.desc}`);
        else process.stderr.write(chalk.dim(`# replaying ${meta.desc}\n`));
      });
      source.on('error', ({ error }) => {
        if (tui) tui.logLine(`error: ${error.message}`);
        else process.stderr.write(chalk.red(`error: ${error.message}\n`));
      });

      async function shutdown(): Promise<void> {
        await session.stop();
        await flushStdio();
        process.exit(0);
      }
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
