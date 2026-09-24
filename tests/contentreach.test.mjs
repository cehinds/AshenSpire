// tests/contentreach.test.mjs — SPEC §9 M3 "every card/relic/event is
// reachable", run through tools/contentreach.mjs: the CLI on the shipped tree,
// and its planted --selftest corpus.
//
// THE TREE IS RED TODAY, AND THIS FILE SAYS SO EXACTLY. The first run of the
// tool found the orphans pinned below. They are findings, not fixes: content is
// not this change's to edit, and none has been ruled intentionally unobtainable
// by the owner, so none is on the tool's ALLOWED_UNREACHABLE list. The pin is a
// ratchet in BOTH directions — a new orphan fails here, and so does a pinned
// one that gains a route (delete its line in the same change, so the freed
// slack cannot hide the next one). When the list is empty, the tool exits 0
// and the assertion below flips to demand exactly that.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const run = (...args) => spawnSync(process.execPath, ['tools/contentreach.mjs', ...args], { cwd: ROOT, encoding: 'utf8' });

// kind:id — first seen by `node tools/contentreach.mjs` at dev = 7fb05c9a9.
const KNOWN_ORPHANS = [
  // Class cards authored with a rarity but in no class cardPool, no kit, no
  // shop shelf and no injector.
  'cards:rondelParry',
  'cards:sunderplate',
  'cards:astralInsight',
  'cards:blightwardLash',
  'cards:lastMercy',
  // Status cards with no injector: nothing does { op: 'addCard', card: <id> }.
  'cards:wound',
  'cards:slimed',
].sort();

test('contentreach: the shipped tree has exactly the pinned orphans, and no floor fired', () => {
  const r = run('--json');
  assert.notEqual(r.status, 2, `a floor fired or the harness died:\n${r.stdout}${r.stderr}`);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(out.floors, []);
  assert.deepEqual(out.stale, []);
  const orphans = Object.entries(out.kinds).flatMap(([kind, s]) => s.orphans.map((id) => `${kind}:${id}`)).sort();
  assert.deepEqual(orphans, KNOWN_ORPHANS,
    'the orphan set moved — a new orphan needs a route (or an owner-ruled allowlist row); a fixed one comes off KNOWN_ORPHANS');
  assert.equal(r.status, KNOWN_ORPHANS.length ? 1 : 0, 'any orphan must exit nonzero; none must exit 0');
  for (const kind of ['cards', 'relics', 'events', 'encounters', 'enemies']) {
    assert.ok(out.kinds[kind].total > 0 && out.kinds[kind].reached > 0, `${kind}: an empty population or an empty walk is not a result`);
  }
});

test('contentreach: the plain report prints a count per kind, every orphan, and what it did not check', () => {
  const r = run();
  for (const kind of ['cards', 'relics', 'events', 'encounters', 'enemies']) {
    assert.match(r.stdout, new RegExp(`^\\s+${kind}\\s+\\d+ of\\s+\\d+ reached`, 'm'));
  }
  for (const row of KNOWN_ORPHANS) assert.ok(r.stdout.includes(`RED   ${row} `), `${row} is named`);
  assert.match(r.stdout, /NOT CHECKED/);
});

test('contentreach --selftest: every planted orphan goes red, and the planted green holds', () => {
  const r = run('--selftest');
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /^contentreach --selftest: OK — \d+ checks passed\.$/m);
  for (const plant of ['G1', 'P1', 'P4', 'P6', 'P8']) assert.match(r.stdout, new RegExp(`^  ok    ${plant} `, 'm'));
});
