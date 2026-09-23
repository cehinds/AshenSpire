import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, stampPlayerPoiseMax } from '../src/model/state.js';
import { playerPoiseThresholdReceipt } from '../src/model/statProjection.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { dealPoiseDamage, executeAction } from '../src/engine/actions.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';

const registries = createRegistries(contentBundle);
function fight() {
  const run = createRunState({ seed: 4242, classId: 'reaver', registries });
  run.loadout.sets.rightHand = ['straightSword', 'boneSceptre', null];
  const receipt = playerPoiseThresholdReceipt(registries, run);
  // A BASE OF 13, COUNTED IN POINTS RATHER THAN IN POISE. The creation mode
  // carries a conversion scale, so one Constitution point is worth however many
  // tiers of the Poise row the run was born with — read it off the run's own
  // snapshot instead of assuming a point is a point.
  const poiseRow = run.derivedStatRuleSnapshot.rules.rules.poise;
  const perPoint = Math.round(poiseRow.gainPerTier / poiseRow.pointsPerTier) || 1;
  run.attributes.constitution += Math.round((13 - receipt.value) / perPoint);
  return createCombat({ registries, rng: createRng(99), player: {
    classId: 'reaver', attributes: run.attributes, maxHp: run.maxHp, hp: run.hp,
    // The rule the run was born with, exactly as main.js hands it to combat:
    // without it the fight prices the vessel on the authored tier instead.
    derivedStatRuleSnapshot: run.derivedStatRuleSnapshot,
    maxMana: run.maxMana, mana: run.mana, energyMax: run.energyMax,
    drawPerTurn: run.drawPerTurn, deck: run.deck, relicIds: [], loadout: run.loadout,
  }, enemyIds: ['wanderingSoldier'] });
}

test('Poise replays each rounded fill through a hand swap and save/restore', () => {
  const combat = fight();
  assert.equal(combat.player.poiseMeter.max, 13);
  dealPoiseDamage(combat, combat.player, 13);
  assert.equal(combat.player.poiseMeter.max, 17);
  dealPoiseDamage(combat, combat.player, 17);
  assert.equal(combat.player.poiseMeter.max, 22);
  dealPoiseDamage(combat, combat.player, 3);
  combat.player.energy = 99;
  dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
  assert.equal(combat.loadout.active.rightHand, 1);
  assert.equal(combat.player.poiseMeter.max, 22);
  assert.equal(combat.player.poiseMeter.value, 3);
  const saved = serializeCombatSnapshot(combat);
  const restored = restoreCombatSnapshot({ registries, rng: createRng(99), snapshot: saved });
  assert.deepEqual(restored.player.poiseMeter, combat.player.poiseMeter);
  stampPlayerPoiseMax(restored.player, 14);
  assert.equal(restored.player.poiseMeter.max, 23, 'new base: ceil(ceil(14 × 1.25) × 1.25)');
  assert.equal(restored.player.poiseMeter.value, 3);
  stampPlayerPoiseMax(restored.player, 13);
  assert.equal(restored.player.poiseMeter.max, 22);
});

test('legacy combined growth remains a prefix for new rounded fills', () => {
  const combat = fight();
  const saved = serializeCombatSnapshot(combat);
  saved.player.poiseMeter = { value: 2, max: 17, growth: 1.25 };
  const restored = restoreCombatSnapshot({ registries, rng: createRng(99), snapshot: saved });
  assert.equal(restored.player.poiseMeter.max, 17);
  dealPoiseDamage(restored, restored.player, 15);
  assert.equal(restored.player.poiseMeter.max, 22);
  stampPlayerPoiseMax(restored.player, 13);
  assert.equal(restored.player.poiseMeter.max, 22);
  const roundTrip = restoreCombatSnapshot({ registries, rng: createRng(99), snapshot: serializeCombatSnapshot(restored) });
  assert.deepEqual(roundTrip.player.poiseMeter, restored.player.poiseMeter);
});

test('paced player Poise follows each shipped impact, including fill overflow and growth', () => {
  const combat = fight();
  stampPlayerPoiseMax(combat.player, 3);
  const disp = { ents: { player: structuredClone(combat.player) } };
  // Exercise the screen's actual beat reducer without mounting its DOM.
  const screen = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const start = screen.indexOf('  function applyBeatToDisp(beat) {');
  const end = screen.indexOf('  // ---------- rendering ----------', start);
  const applyBeat = new Function('disp', 'combat', 'getEntity', `${screen.slice(start, end)}; return applyBeatToDisp;`)(disp, combat, (c, id) => id === 'player' ? c.player : c.enemies.find(e => e.id === id));
  function hit() {
    const before = combat.eventLog.length;
    executeAction(combat, { effect: { op: 'damage', target: 'player', amount: 1 }, source: combat.enemies[0], owner: combat.enemies[0], target: combat.player, meta: {} });
    const events = combat.eventLog.slice(before);
    const impact = events.find(e => e.type === 'impactDealt');
    assert.ok(impact);
    applyBeat({ events });
    assert.equal(disp.ents.player.poiseMeter.value, combat.player.poiseMeter.value);
    assert.equal(disp.ents.player.poiseMeter.max, combat.player.poiseMeter.max);
    return impact;
  }
  const first = hit();
  assert.equal(disp.ents.player.poiseMeter.value, 2, 'first enemy beat visibly fills the bar');
  const second = hit();
  assert.deepEqual(second.poiseMeter, { value: 1, max: 4 }, 'fill carries overflow and grown max');
  assert.deepEqual(first.poiseMeter, { value: 2, max: 3 }, 'earlier receipt remains immutable');
});
