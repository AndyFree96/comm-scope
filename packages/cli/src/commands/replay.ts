import chalk from 'chalk';
import type { Command } from 'commander';
import { parseSpec, createTransport, replayFileToTransport } from '@anthonyfree96/core';
import type { Direction } from '@anthonyfree96/core';
import { flushStdio } from '../stdio.js';

export function registerReplay(program: Command): void {
  program
    .command('replay')
    .argument('<file>', 'recording file (JSON Lines)')
    .requiredOption('--to <spec>', 'target transport spec to send to')
    .option('--speed <n>', 'replay speed multiplier (0 = as fast as possible)', '1')
    .option('--loop', 're-send continuously until interrupted')
    .option('--dir <dir>', 'only replay rx or tx (default: all, chronological)')
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

      let specParsed;
      try {
        specParsed = parseSpec(opts.to as string);
      } catch (err) {
        process.stderr.write(chalk.red(`error: ${(err as Error).message}\n`));
        process.exit(1);
      }

      const target = createTransport(specParsed);
      target.on('open', ({ meta }) =>
        process.stderr.write(chalk.dim(`# replaying ${file} -> ${meta.desc}\n`)),
      );
      target.on('error', ({ error }) =>
        process.stderr.write(chalk.red(`error: ${error.message}\n`)),
      );

      let stopping = false;
      const stop = async () => {
        if (stopping) return;
        stopping = true;
        await target.stop();
        await flushStdio();
        process.exit(0);
      };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);

      try {
        await target.start();
        const sent = await replayFileToTransport(file, target, {
          speed,
          loop: Boolean(opts.loop),
          dir,
        });
        process.stderr.write(chalk.dim(`# replayed ${sent} events\n`));
        await stop();
      } catch (err) {
        process.stderr.write(chalk.red(`error: ${(err as Error).message}\n`));
        await flushStdio();
        process.exit(1);
      }
    });
}
