import { primeAccuracyRolls } from './accuracyFixture.mjs';
// Owner ruling 2026-10-11: Ward absorbs at most wardAbsorbShare (default 0.5) of one action's magic
// damage after Barrier, and never more than it holds. Spells stay fairly reliable; Ward does not block all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { enqueueExpandedAction, previewExpandedActions } from '../src/engine/combatExpansionActions.js';
import { executeAction } from '../src/engine/actions.js';
import { stanceRulesFor } from '../src/model/stanceRules.js';
import { stanceRules } from '../src/content/stanceRules.js';

// Same shape as the damage-split fixture, but with a Ward pool that can hold the whole fight.
function fixture({ ward = 40, barrier = 0, share } = {}) {
  const registries = createRegistries(contentBundle);
  const combat = createCombat({ registries, rng: createRng(902), combatExpansionVersion: 2,
    enemyIds: ['wanderingSoldier'], player: { classId: 'starseer', maxHp: 100, hp: 100,
      maxMana: 10, mana: 10, maxStamina: 10, stamina: 10, energyMax: 10, drawPerTurn: 1, deck: [] } });
  const enemy = combat.enemies[0];
  enemy.block = 0; enemy.barrier = barrier;
  // Clear the enemy's own elemental tuning so a 5-damage Fire hit is exactly 5 magic.
  enemy.damageResistanceFlat = {}; enemy.damageWeaknessPercent = {};
  enemy.ratings = { ar: 0, dr: 0, pr: 0, poise: 0, ward };
  enemy.persistentWard = { max: ward, value: ward };
  delete enemy.combatCounter; delete enemy.combatEvade; delete enemy.combatStance;
  if (share !== undefined) combat.stanceRules = { wardAbsorbShare: share };
  primeAccuracyRolls(combat);
  return { combat, enemy };
}

// A pure magic Fire hit: all 5 is magic, so Barrier and Ward meet the whole hit.
const fireSpell = { tags: ['camp:spell', 'damage:fire'], skipRatingBonus: true,
  combatProfile: { camp: 'spell', damageType: 'fire', maneuver: 'casting', reach: 'near', targeting: 'single' } };

function action(combat, enemy, amount, carrier = fireSpell) {
  return { effect: { op: 'damage', target: 'enemy', amount }, source: combat.player, owner: combat.player,
    target: enemy, card: carrier, meta: {} };
}

// Commit one spell of `amount`; return its damage receipts, the preview total, and the HP it cost.
function cast(combat, enemy, amount, carrier = fireSpell) {
  const hpBefore = enemy.hp;
  const preview = previewExpandedActions(combat, [action(combat, enemy, amount, carrier)],
    { source: combat.player, target: enemy, carrier }).flat().reduce((sum, contact) => sum + contact.amount, 0);
  const events = [];
  const emit = combat.emit;
  combat.emit = (type, payload) => { events.push({ type, ...payload }); return emit(type, payload); };
  enqueueExpandedAction(combat, [action(combat, enemy, amount, carrier)], { source: combat.player, target: enemy, carrier });
  while (combat.queue.length) executeAction(combat, combat.queue.shift());
  combat.emit = emit;
  const damage = events.filter(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  return { events, damage, preview, committed: hpBefore - enemy.hp, hpLoss: hpBefore - enemy.hp };
}

test('(a) Ward 40 against one 5-magic spell takes floor(magic * 0.5) and the rest is HP', () => {
  const { combat, enemy } = fixture({ ward: 40 });
  const r = cast(combat, enemy, 5);
  assert.equal(r.damage.length, 1);
  const [d] = r.damage;
  assert.equal(d.magicAmount, 5, 'the whole hit is magic');
  assert.equal(d.wardAbsorbed, Math.floor(d.magicAmount * 0.5), 'Ward takes half, rounded down');
  assert.equal(d.wardRemaining, 40 - 2, 'Ward keeps what it did not take');
  assert.ok(r.hpLoss >= Math.ceil(d.magicAmount / 2), `HP loss ${r.hpLoss} is at least ceil(half)`);
});

test('(b) repeated spells drain Ward to 0: wardBroken fires once, then the next spell has no wardAbsorbed', () => {
  const { combat, enemy } = fixture({ ward: 4 });
  const casts = [1, 2, 3].map(() => cast(combat, enemy, 5));
  const breaks = casts.flatMap(r => r.events.filter(e => e.type === 'wardBroken'));
  assert.equal(breaks.length, 1, 'Ward breaks exactly once');
  assert.equal(casts[0].damage[0].wardAbsorbed, 2, 'first spell: half of 5');
  assert.equal(casts[1].damage[0].wardAbsorbed, 2, 'second spell spends the last 2 and breaks Ward');
  assert.equal(enemy.persistentWard.value, 0);
  assert.equal(casts[2].damage[0].wardAbsorbed ?? 0, 0, 'third spell meets no Ward');
  assert.equal(casts[2].damage[0].amount, 5, 'and all 5 goes through');
});

test('(c) preview damage equals committed damage under the half cap, with and without Barrier', () => {
  for (const setup of [{ ward: 40 }, { ward: 7, barrier: 3 }, { ward: 1 }, { ward: 40, barrier: 6 }]) {
    const { combat, enemy } = fixture(setup);
    const r = cast(combat, enemy, 11);
    assert.equal(r.preview, r.committed, JSON.stringify(setup));
  }
});

test('(d) share 0 means Ward absorbs nothing; share 1 gives the old behaviour (all but 1)', () => {
  const none = fixture({ ward: 40, share: 0 });
  const rNone = cast(none.combat, none.enemy, 5);
  assert.equal(rNone.damage[0].wardAbsorbed ?? 0, 0, 'share 0 absorbs nothing');
  assert.equal(none.enemy.persistentWard.value, 40, 'Ward untouched');
  assert.equal(rNone.committed, 5, 'all 5 goes through');

  const all = fixture({ ward: 40, share: 1 });
  const rAll = cast(all.combat, all.enemy, 5);
  assert.equal(rAll.damage[0].wardAbsorbed, 4, 'share 1: Ward takes all but 1');
  assert.equal(rAll.committed, 1, 'and 1 gets through');
});

test('(d2) an out-of-range share is clamped to [0, 1], and a non-number falls back to the default half', () => {
  const high = fixture({ ward: 40, share: 2 });
  assert.equal(cast(high.combat, high.enemy, 5).damage[0].wardAbsorbed, 4, 'above 1 clamps to 1');
  const low = fixture({ ward: 40, share: -3 });
  assert.equal(cast(low.combat, low.enemy, 5).damage[0].wardAbsorbed ?? 0, 0, 'below 0 clamps to 0');
  const bad = fixture({ ward: 40, share: Number.NaN });
  assert.equal(cast(bad.combat, bad.enemy, 5).damage[0].wardAbsorbed, 2, 'NaN falls back to the default 0.5');
});

test('(e) a rules snapshot without the key reads the default 0.5, and the shipped default is 0.5', () => {
  assert.equal(stanceRules.wardAbsorbShare, 0.5);
  assert.equal(stanceRulesFor({ stanceRules: { spellSmashWardShare: 0.3 } }).wardAbsorbShare, 0.5);
  assert.equal(stanceRulesFor({}).wardAbsorbShare, 0.5);
});
