import chalk from 'chalk';
import type { Command } from 'commander';
import { listSerialPorts } from '@comm-scope/core';

export function registerListSerial(program: Command): void {
  program
    .command('list-serial')
    .description('list attached serial ports')
    .action(async () => {
      try {
        const ports = await listSerialPorts();
        if (ports.length === 0) {
          process.stdout.write('no serial ports found\n');
          return;
        }
        for (const p of ports) {
          process.stdout.write(`${p.path}${p.manufacturer ? `\t${p.manufacturer}` : ''}\n`);
        }
      } catch (err) {
        process.stderr.write(chalk.red(`error: ${(err as Error).message}\n`));
        process.exit(1);
      }
    });
}
