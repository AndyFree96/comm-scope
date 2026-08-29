/**
 * Flush pending stdout/stderr writes. Needed before `process.exit()` because
 * exit does not flush piped streams, so a summary written just before exit
 * would otherwise be lost.
 */
export function flushStdio(): Promise<void> {
  return new Promise((resolve) => {
    let pending = 2;
    const done = () => {
      if (--pending <= 0) resolve();
    };
    process.stdout.write('', done);
    process.stderr.write('', done);
  });
}
