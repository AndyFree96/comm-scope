import fs from 'node:fs';
import readline from 'node:readline';
import chalk from 'chalk';
import type { Command } from 'commander';
import { decodeHeader, decodeEvent } from '@comm-scope/core';
import type { Direction, TrafficEvent } from '@comm-scope/core';
import { buildMatcher } from '../args.js';
import { formatEventLine } from '../render/line.js';
import type { LineOptions } from '../render/line.js';

interface IndexedEvent {
  line: number;
  e: TrafficEvent;
}

export function registerSearch(program: Command): void {
  program
    .command('search')
    .argument('<file>', 'recording file (JSON Lines)')
    .option('--string <s>', 'match events containing this UTF-8 substring')
    .option('--hex <h>', 'match events containing this hex byte sequence')
    .option('--regex <re>', 'match events whose UTF-8 text matches this regex')
    .option('--dir <dir>', 'only match rx or tx')
    .option('-C, --context <n>', 'context events to show around each match', '2')
    .option('--no-color', 'disable ANSI colors')
    .option('--no-timestamp', 'omit timestamps')
    .action(async (file: string, opts: Record<string, unknown>) => {
      const matcher = buildMatcher({
        string: opts.string as string | undefined,
        hex: opts.hex as string | undefined,
        regex: opts.regex as string | undefined,
        dir: opts.dir as Direction | undefined,
      });
      if (!matcher) {
        process.stderr.write(
          chalk.red('error: provide a filter: --string, --hex, --regex or --dir\n'),
        );
        process.exit(1);
      }

      const events: IndexedEvent[] = [];
      const rl = readline.createInterface({
        input: fs.createReadStream(file),
        crlfDelay: Infinity,
      });
      let headerSeen = false;
      let lineNo = 0;
      for await (const line of rl) {
        lineNo++;
        if (!headerSeen) {
          decodeHeader(line);
          headerSeen = true;
          continue;
        }
        events.push({ line: lineNo, e: decodeEvent(line) });
      }

      const matchIdx = new Set<number>();
      events.forEach((item, i) => {
        if (matcher.matches(item.e)) matchIdx.add(i);
      });
      if (matchIdx.size === 0) {
        process.stdout.write('no matches\n');
        return;
      }

      const ctx = Math.max(0, Number(opts.context) || 0);
      const color = Boolean(opts.color);
      chalk.level = color ? 1 : 0;
      const lineOpts: LineOptions = {
        mode: 'hex',
        timestamp: Boolean(opts.timestamp),
        color,
      };

      const inWindow = new Array<boolean>(events.length).fill(false);
      for (const m of matchIdx) {
        const from = Math.max(0, m - ctx);
        const to = Math.min(events.length - 1, m + ctx);
        for (let i = from; i <= to; i++) inWindow[i] = true;
      }

      process.stderr.write(chalk.dim(`# ${matchIdx.size} matches\n`));

      let prev = -1;
      for (let i = 0; i < events.length; i++) {
        if (!inWindow[i]) continue;
        if (prev !== -1 && i > prev + 1) process.stdout.write(chalk.dim('--\n'));
        const item = events[i]!;
        const isMatch = matchIdx.has(i);
        const marker = isMatch ? chalk.cyan('* ') : '  ';
        const lineNum = chalk.gray(String(item.line).padStart(5)) + ' ';
        process.stdout.write(marker + lineNum + formatEventLine(item.e, lineOpts) + '\n');
        prev = i;
      }
    });
}
