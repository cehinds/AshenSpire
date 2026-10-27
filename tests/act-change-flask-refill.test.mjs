// Owner 2026-10-27: "Refull potions between acts" (potions = the HP and MP flasks). advanceAct() refills both pools
// for a configured run, regardless of routes.startNodeRefills; a legacy run keeps its old behaviour (no refill).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { refillFlasksAtActChange } from '../src/model/nodeRefill.js';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const start = main.indexOf('function advanceAct(');
const advanceSource = main.slice(start, main.indexOf('\n}', start) + 2);

function advance({ configured, scarce = false }) {
  const run = {
    actNumber: 1, hp: 5, maxHp: 20, custom: scarce ? {} : null,
    gameProfile: configured ? { foundation: { mode: 'configured' } } : { foundation: { mode: 'legacy' } },
    flaskCharges: { capacity: 3, hp: 2, mana: 1, hpCurrent: 0, manaCurrent: 0 }, history: [],
  };
  const context = vm.createContext({
    run, registries: { balance: { customMods: { lessHealingMult: 0.5 } } }, rng: {},
    activeMods: () => ({ lessHealing: scarce }), buildActMap: () => ({ nodes: {} }), currentSeat: () => 'weald',
    contentAct: () => run.actNumber, runMapShape: () => null, persistOrWarn() {}, showMap() {}, refillFlasksAtActChange,
  });
  vm.runInContext(advanceSource + '\nadvanceAct();', context);
  return run;
}

test('advanceAct refills both flask pools for a configured run', () => {
  const run = advance({ configured: true });
  assert.equal(run.actNumber, 2);
  assert.equal(run.flaskCharges.hpCurrent, 2);
  assert.equal(run.flaskCharges.manaCurrent, 1);
  assert.equal(run.hp, 20);
});
test('the act-change refill is independent of the heal mod (Scarce Embers still refills flasks)', () => {
  const run = advance({ configured: true, scarce: true });
  assert.equal(run.hp, 5 + Math.floor(15 * 0.5));
  assert.equal(run.flaskCharges.hpCurrent, 2);
  assert.equal(run.flaskCharges.manaCurrent, 1);
});
test('a legacy run keeps its behaviour: no flask refill at the act change', () => {
  const run = advance({ configured: false });
  assert.equal(run.flaskCharges.hpCurrent, 0);
  assert.equal(run.flaskCharges.manaCurrent, 0);
});
test('refillFlasksAtActChange tolerates a run with no flask pools', () => {
  assert.equal(refillFlasksAtActChange({ gameProfile: { foundation: { mode: 'configured' } } }), false);
});
