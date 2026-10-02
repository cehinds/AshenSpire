// The two greedy bots make the same fight decisions (PR #1473 review).
//
// tools/measure-classes.mjs copies runsim's bot so it can count what runsim
// does. Its --check used to compare win counts only, so the copy could stop
// drinking an Azure charge where runsim drinks one and still print PASSED.
// The turn-end decision now lives in tools/simbot.mjs (outOfPlaysAction) and
// both bots call it; --check compares every fight's actions, in order, on
// every fight the two bots opened on the same state.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { cardPlayCosts } from '../src/engine/combat.js';
import { createRunState } from '../src/model/state.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { outOfPlaysAction, affordableCards } from '../tools/simbot.mjs';

const registries = createRegistries(contentBundle);
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const measure = (...args) => spawnSync(process.execPath, ['tools/measure-classes.mjs', ...args], {
  cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 300000,
});

function manaShortFight() {
  for (const classId of registries.classes.all().map((c) => c.id)) {
    for (let seed = 1; seed < 40; seed++) {
      const run = createRunState({ seed, classId, registries });
      const combat = createRunCombat({ registries, rng: createRng(seed), run, enemyIds: ['wanderingSoldier'] });
      const p = combat.player;
      const card = combat.piles.hand.find((h) => {
        const c = cardPlayCosts(combat, h.instanceId);
        return c.mana > 0 && c.mana <= p.maxMana && c.energy <= p.energy && c.stamina <= p.stamina;
      });
      if (card) return { combat, card };
    }
  }
  return null;
}

test('a hand blocked only by Mana drinks an Azure charge; no charge, no drink', () => {
  const found = manaShortFight();
  assert.ok(found, 'some opening hand holds a card that costs Mana');
  const { combat, card } = found;
  const p = combat.player;
  const need = cardPlayCosts(combat, card.instanceId).mana;
  // Every other card is set aside, so the Mana card is the only candidate.
  const refused = new Set(combat.piles.hand.filter((h) => h.instanceId !== card.instanceId).map((h) => h.instanceId));
  p.mana = need - 1;
  p.flaskCharges = { ...(p.flaskCharges || {}), manaCurrent: 1 };
  assert.equal(affordableCards(registries, combat, refused).length, 0, 'nothing is affordable');
  assert.deepEqual(outOfPlaysAction(registries, combat, refused), { type: 'useFlask', chargeKind: 'mana' });
  p.flaskCharges.manaCurrent = 0;
  assert.equal(outOfPlaysAction(registries, combat, refused), null, 'no charge left: the turn ends');
  p.flaskCharges.manaCurrent = 1;
  p.energy = 0;
  assert.equal(outOfPlaysAction(registries, combat, refused), null, 'short on Actions too: a charge would not pay');
});

test('runsim and measure-classes take the turn-end decision from the one shared function', () => {
  for (const path of ['tools/runsim.mjs', 'tools/measure-classes.mjs']) {
    const text = source(path);
    assert.match(text, /import \{[^}]*\boutOfPlaysAction\b[^}]*\} from '\.\/simbot\.mjs'/, `${path} imports outOfPlaysAction`);
    assert.match(text, /outOfPlaysAction\(REG, combat, refused\)/, `${path} calls it in its fight loop`);
    assert.doesNotMatch(text, /function manaChargeWouldPay/, `${path} keeps no private copy of the decision`);
  }
});

test('measure-classes --check compares fight decisions with runsim on fixed seeds', () => {
  const r = measure('5', '--check');
  assert.equal(r.status, 0, `--check exited ${r.status}\n${r.stdout}\n${r.stderr}`);
  for (const cls of registries.classes.all()) {
    const m = new RegExp(`^  ${cls.id}: decisions MATCH — (\\d+) fights opened on the same state, 0 decided differently`, 'm').exec(r.stdout);
    assert.ok(m, `no decisions MATCH line for ${cls.id}\n${r.stdout}`);
    assert.ok(Number(m[1]) > 0, `${cls.id}: no fight was compared`);
  }
});

test('a copy that skips the Azure charge is caught on decisions, not left to the win count', () => {
  const r = measure('5', '--check', '--mutate=manaFlask');
  assert.equal(r.status, 1, `the planted drift must fail --check\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /decisions DRIFT — \d+ fights opened on the same state, [1-9]\d* decided differently/);
});

test('the runsim baseline is read with a buffer sized for the --digest output', () => {
  // The default `--check` is n=500, about 2 MB of digest lines; spawnSync's
  // 1 MiB default buffer failed it with ENOBUFS before any comparison. The
  // 500-run check is too slow for this suite; it was run by hand (PR #1473).
  const text = source('tools/measure-classes.mjs');
  assert.match(text, /spawnSync\(process\.execPath, \[RUNSIM, String\(n\), '--digest'\], \{ encoding: 'utf8', maxBuffer \}\)/);
  const bytes = spawnSync(process.execPath, ['tools/runsim.mjs', '5', '--digest'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }).stdout.length;
  // 16 KB per class-run of headroom, the rule the tool sizes its buffer by.
  assert.ok(bytes < 5 * registries.classes.all().length * 16 * 1024, `5 runs printed ${bytes} bytes, past the per-run headroom`);
});
