import { Command } from 'commander';
import { registerMonitor } from './commands/monitor.js';
import { registerListSerial } from './commands/list-serial.js';
import { registerRecord } from './commands/record.js';
import { registerView } from './commands/view.js';
import { registerSearch } from './commands/search.js';
import { registerReplay } from './commands/replay.js';

const program = new Command();

program
  .name('comm-scope')
  .description('Serial / TCP / UDP traffic monitor for developers')
  .version('0.1.0');

registerMonitor(program);
registerRecord(program);
registerView(program);
registerSearch(program);
registerReplay(program);
registerListSerial(program);

await program.parseAsync(process.argv);
