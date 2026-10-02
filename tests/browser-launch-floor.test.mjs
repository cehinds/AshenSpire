// tests/browser-launch-floor.test.mjs — the DevTools-endpoint wait in
// tools/browser.mjs has a floor, so a cold Chrome start on a CI runner is waited
// out instead of failing a caller that asked for 12000 ms (FINISH §12; seen on
// #1435 and #1436, 2026-10-02: "no DevTools endpoint ... in 12000 ms").
//   node --test tests/browser-launch-floor.test.mjs
//
// No real browser: a tiny shell script stands in for Chrome and prints the
// DevTools line after a delay, so the test runs anywhere a POSIX sh exists.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchBrowser, LAUNCH_FLOOR_MS, LAUNCH_FLOOR_ENV, launchFloorMs, effectiveLaunchMs } from '../tools/browser.mjs';

const POSIX = process.platform !== 'win32';

const withEnv = async (value, fn) => {
  const had = Object.prototype.hasOwnProperty.call(process.env, LAUNCH_FLOOR_ENV);
  const old = process.env[LAUNCH_FLOOR_ENV];
  if (value === undefined) delete process.env[LAUNCH_FLOOR_ENV];
  else process.env[LAUNCH_FLOOR_ENV] = value;
  try { return await fn(); } finally {
    if (had) process.env[LAUNCH_FLOOR_ENV] = old;
    else delete process.env[LAUNCH_FLOOR_ENV];
  }
};

// A stand-in browser that is slow to announce its endpoint, then stays up.
const slowBrowser = (delayS) => {
  const dir = mkdtempSync(join(tmpdir(), 'blf-'));
  const bin = join(dir, 'slow-chrome.sh');
  writeFileSync(bin, `#!/bin/sh\nsleep ${delayS}\necho "DevTools listening on ws://127.0.0.1:9/devtools/browser/fake" >&2\nexec sleep 30\n`);
  chmodSync(bin, 0o755);
  return { bin, done: () => rmSync(dir, { recursive: true, force: true }) };
};

test('the floor is a named constant, overridable by env, never above a caller who asks for more', async () => {
  assert.equal(LAUNCH_FLOOR_ENV, 'ASHEN_BROWSER_LAUNCH_MS');
  assert.ok(Number.isInteger(LAUNCH_FLOOR_MS) && LAUNCH_FLOOR_MS > 12000, `floor ${LAUNCH_FLOOR_MS} must exceed the 12000 ms the tools pass`);
  await withEnv(undefined, () => {
    assert.equal(launchFloorMs(), LAUNCH_FLOOR_MS);
    assert.equal(effectiveLaunchMs(12000), LAUNCH_FLOOR_MS, 'a caller passing 12000 is lifted to the floor');
    assert.equal(effectiveLaunchMs(LAUNCH_FLOOR_MS + 5000), LAUNCH_FLOOR_MS + 5000, 'a longer caller budget is kept');
  });
  await withEnv('45000', () => assert.equal(effectiveLaunchMs(12000), 45000));
  await withEnv('0', () => assert.equal(effectiveLaunchMs(12000), 12000, 'a floor of 0 leaves the caller value'));
  await withEnv('2147483647', () => assert.equal(launchFloorMs(), 2147483647, 'the timer ceiling itself is accepted'));
  for (const bad of ['', 'abc', '-5', '1.5e', 'Infinity', '2147483648', '30000000000', '9'.repeat(400)]) {
    await withEnv(bad, () => assert.equal(launchFloorMs(), LAUNCH_FLOOR_MS, `bad override ${JSON.stringify(bad)} falls back to the default`));
  }
});

test('a slow endpoint is waited out under the floor, and times out without it', { skip: !POSIX && 'needs a POSIX sh' }, async () => {
  const fake = slowBrowser(1.5);
  try {
    // Caller asks for 300 ms; the env floor of 6000 ms lets the 1.5 s start through.
    await withEnv('6000', async () => {
      const b = await launchBrowser({ prefix: 'blf-', browser: fake.bin, timeoutMs: 300, pinTmp: false });
      try { assert.match(b.wsUrl, /^ws:\/\/127\.0\.0\.1:9\//); } finally { await b.close(); }
    });
    // The same caller with the floor off still fails at its own 300 ms — the
    // red edge, proving the floor (and nothing else) is what made it pass.
    await withEnv('0', async () => {
      await assert.rejects(
        launchBrowser({ prefix: 'blf-', browser: fake.bin, timeoutMs: 300, pinTmp: false }),
        /no DevTools endpoint from .* in 300 ms/,
      );
    });
  } finally { fake.done(); }
});

// The dead browser is node itself: it refuses Chrome's first flag (`--headless`)
// and exits at once, on every OS. `/bin/true` was the first choice and is not
// one — macOS keeps it at /usr/bin/true (spawn ENOENT), Windows has neither.
test('a dead browser still fails fast under the default floor', async () => {
  await withEnv(undefined, async () => {
    const t0 = Date.now();
    await assert.rejects(
      launchBrowser({ prefix: 'blf-', browser: process.execPath, timeoutMs: 12000, pinTmp: false }),
      /exited \(code [1-9]\d*, signal null\) before printing a DevTools endpoint/,
    );
    assert.ok(Date.now() - t0 < 5000, `took ${Date.now() - t0} ms; the exit handler, not the floor, must end it`);
  });
});
