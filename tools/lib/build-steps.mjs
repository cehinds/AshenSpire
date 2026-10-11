// tools/lib/build-steps.mjs — run builders to completion from a CLI, each in its own process group
// (tools/lib/process-tree.mjs), so that stopping the CLI stops what its builders started too.
//
// The CLI holds the shared build lock (holdForCli, tools/lib/build-lock.mjs) and releases it on process
// exit. A builder left running after that would write under a free lock, so a stop waits for the group.
import { spawnGroup } from './process-tree.mjs';

/**
 * A runner for one CLI's steps. run(script, args, opts) resolves { code, signal, error, output } once the
 * step's group is empty; output is inherited, or collected when opts.capture is set. stop() stops the
 * step that is running, if any, and resolves once its group is empty.
 */
export function createStepRunner({ graceMs: defaultGraceMs } = {}) {
  let active = null;
  return {
    async run(script, args = [], { capture = false, cwd, env, graceMs = defaultGraceMs } = {}) {
      const group = spawnGroup(process.execPath, [script, ...args], {
        stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
        ...(cwd ? { cwd } : {}),
        ...(env ? { env } : {}),
        ...(graceMs !== undefined ? { graceMs } : {}),
        windowsHide: true,
      });
      active = group;
      let output = '';
      if (capture) {
        const add = (d) => { output += d.toString(); };
        group.child.stdout.on('data', add);
        group.child.stderr.on('data', add);
      }
      try {
        const result = await group.done;
        return { ...result, output };
      } finally {
        if (active === group) active = null;
      }
    },
    stop(graceMs) {
      return active ? active.stop(graceMs) : Promise.resolve();
    },
  };
}

/**
 * Stop the runner's running step on SIGINT, SIGTERM or SIGHUP, then exit with the conventional
 * 128 + signal number. Call it from a CLI's main after it takes the build lock.
 */
export function stopStepsOnSignal(runner, { exit = (code) => process.exit(code), signals = ['SIGINT', 'SIGTERM', 'SIGHUP'], numbers = { SIGINT: 2, SIGTERM: 15, SIGHUP: 1 } } = {}) {
  for (const signal of signals) {
    process.on(signal, () => {
      Promise.resolve(runner.stop()).finally(() => exit(128 + numbers[signal]));
    });
  }
}
