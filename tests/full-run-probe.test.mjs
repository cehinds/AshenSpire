// tests/full-run-probe.test.mjs — the browser full run's console verdict can
// still go red: tools/full-run-probe.mjs --selftest plants a console.error, an
// uncaught exception and non-sound 404s (and one optional SFX 404 that must be
// set aside) through the same classifier the real drive uses. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROBE = fileURLToPath(new URL('../tools/full-run-probe.mjs', import.meta.url));

test('full-run-probe --selftest: every planted console error is red, the optional SFX 404 is set aside', () => {
  const r = spawnSync(process.execPath, [PROBE, '--selftest'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /PASS selftest console\.error/);
  assert.match(r.stdout, /PASS selftest non-sound 404 \(an image\)/);
  assert.match(r.stdout, /PASS selftest clean edge: an optional assets\/sfx\/<id>\.ogg 404/);
  assert.match(r.stdout, /\b0 failed\b/);
});
