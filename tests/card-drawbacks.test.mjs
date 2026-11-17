// Playtest 2026-11-17, theme C: every card that grants Evade carries a drawback, and its upgrades may ease it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { gameProfileRewardPools, gameProfileWeaponArtIds } from '../src/model/gameProfileRewards.js';

const unlocked = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const CLASSES = ['reaver', 'starseer', 'rogue', 'herald'];

/** Every card a Core run can meet: offered as a reward, sold as a weapon art, or dealt in a starter deck. */
export function coreReachableCardIds() {
  const ids = new Set();
  for (const classId of CLASSES) {
    const run = createRunState({ registries, classId, seed: 1, profileMeta: unlocked });
    run.maxMana = 20;
    for (const id of gameProfileRewardPools(registries, run).combatCards) ids.add(id);
    for (const id of gameProfileWeaponArtIds(registries, run)) ids.add(id);
    for (const card of run.deck) ids.add(card.cardId ?? card.id ?? card);
  }
  return [...ids].filter((id) => registries.cards.has(id));
}

const grantsEvade = (card) => (card.effects || []).some((e) => e.op === 'applyStatus' && e.target === 'self' && /(^|\.)evade$/.test(e.status));
const stamina = (card) => (Number.isInteger(card.staminaCost) ? card.staminaCost : Number.isInteger(card.cost) ? card.cost : 0);

/** The drawbacks the owner listed: 2 or more Stamina, a Mana cost, Exhaust or Ethereal, a rising cost, or damage to yourself. */
export function drawbacksOf(card) {
  const keywords = card.keywords || [];
  const found = [];
  if (stamina(card) >= 2) found.push('stamina');
  if ((card.manaCost || 0) > 0) found.push('mana');
  if (keywords.includes('exhaust')) found.push('exhaust');
  if (keywords.includes('ethereal')) found.push('ethereal');
  if ((card.costGrowth?.stamina || 0) > 0 || (card.costGrowth?.mana || 0) > 0) found.push('risingCost');
  if ((card.effects || []).some((e) => e.op === 'loseHp' && e.target === 'self')) found.push('selfDamage');
  return found;
}

test('every Core card that grants Evade carries a drawback', () => {
  const evaders = coreReachableCardIds().map((id) => registries.cards.get(id)).filter(grantsEvade);
  assert.ok(evaders.some((card) => card.id === 'core.backstep'), 'Backstep is reachable and grants Evade');
  for (const card of evaders) assert.ok(drawbacksOf(card).length, `${card.id} grants Evade with no drawback`);
});

test('the 1-Stamina Evade cards Exhaust, and Sidestep does too', () => {
  for (const id of ['core.backstep', 'quickstep', 'base.evade']) assert.ok(registries.cards.get(id).keywords.includes('exhaust'), id);
});

test('Hold Block costs 1 more Stamina each play, up to +2, and its authored upgrade holds the cost', () => {
  const hold = registries.cards.get('base.retain-block');
  assert.deepEqual(drawbacksOf(hold), ['risingCost']);
  assert.deepEqual({ stamina: hold.costGrowth.stamina, max: hold.costGrowth.max }, { stamina: 1, max: 2 });
  assert.equal(hold.upgrade.costGrowth.stamina, 0, 'the upgrade stops the rising cost');
  assert.ok(registries.cards.get('base.retain-block').effects.some((e) => e.op === 'block' && e.amount === 6), 'still 6 Block');
});

test("Star Seer's Ethereal starter keeps 10 Block and is offered Reaction, dropping Ethereal, or more Block", async () => {
  const { nextUpgradeOptions } = await import('../src/model/cardUpgradeLimits.js');
  const { applyUpgradeSteps } = await import('../src/model/cardUpgrade.js');
  const ethereal = registries.cards.get('base.ethereal');
  assert.ok(ethereal.effects.some((e) => e.op === 'block' && e.amount === 10));
  assert.ok(ethereal.keywords.includes('ethereal'));
  for (const seed of [1, 2, 3, 4, 5]) {
    const offered = nextUpgradeOptions({ seed, gameProfile: registries.gameProfile, rangePolicy: {} }, { instanceId: `e${seed}`, cardId: ethereal.id, upgraded: false }, ethereal, registries, 3);
    const kinds = offered.map((s) => (s.k === 'fx' ? `fx:${s.fx}` : s.k)).sort();
    assert.deepEqual(kinds, ['blk', 'fx:reaction', 'fx:unethereal'], `seed ${seed}: ${JSON.stringify(offered)}`);
  }
  const kept = applyUpgradeSteps(ethereal, [{ k: 'fx', fx: 'unethereal' }]);
  assert.ok(!kept.keywords.includes('ethereal'));
  assert.ok((applyUpgradeSteps(ethereal, [{ k: 'fx', fx: 'reaction' }]).tags || []).includes('trait:reaction'));
});

test('Pebble Throw is a Reach attack', async () => {
  const { combatCardRange } = await import('../src/model/combatCardProfile.js');
  const pebble = registries.cards.get('core.pebbleThrow');
  assert.ok((pebble.cardTags ?? pebble.tags).includes('range:reach'));
  assert.equal(combatCardRange(pebble), 'reach');
  assert.equal(combatCardRange(registries.cards.get('core.flick')), 'melee', 'Flick, its zero-cost sibling, stays Melee');
});

test('cards that buff a team member are kept out of every Core reward and shop pool, but stay defined', () => {
  const buffsAlly = (card) => (card.effects || []).some((e) => e.op === 'applyStatus' && ['ally', 'allAllies'].includes(e.target));
  assert.ok(registries.cards.has('base.buff-ally'), 'Ally Empowerment stays defined for saved decks');
  for (const classId of CLASSES) {
    const run = createRunState({ registries, classId, seed: 1, profileMeta: unlocked });
    run.maxMana = 20;
    const offered = gameProfileRewardPools(registries, run).combatCards.filter((id) => buffsAlly(registries.cards.get(id)));
    assert.deepEqual(offered, [], classId);
  }
});

// Item 14: an unupgraded card that deals at least OVERTUNED times Strike's damage for each Stamina and Mana it costs pays a penalty.
const OVERTUNED = 2.5;
const PENALTIES = ['exhaust', 'ethereal', 'risingCost', 'selfDamage'];
async function damagePerPoint(cardId, upgraded = false) {
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { dispatch } = await import('../src/engine/combat.js');
  const run = createRunState({ registries, classId: 'starseer', seed: 511, profileMeta: unlocked });
  const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  for (const pile of Object.values(combat.piles)) pile.length = 0;
  combat.piles.hand.push({ instanceId: 'x', cardId, upgraded });
  for (let i = 0; i < 8; i += 1) combat.piles.draw.push({ instanceId: `f${i}`, cardId: 'core.defend', upgraded: false });
  for (const enemy of combat.enemies) Object.assign(enemy, { hp: 5000, maxHp: 5000, block: 0 });
  combat.player.stamina = combat.player.maxStamina = 20;
  combat.player.mana = combat.player.maxMana = 20;
  const enemy = combat.enemies[0];
  const before = { hp: enemy.hp, stamina: combat.player.stamina, mana: combat.player.mana };
  try { dispatch(combat, { type: 'playCard', cardInstanceId: 'x', targetId: enemy.id }); } catch { return null; }
  const paid = before.stamina - combat.player.stamina + before.mana - combat.player.mana;
  return (before.hp - enemy.hp) / Math.max(1, paid);
}

test('every overtuned unupgraded damage card pays a penalty', async () => {
  const strike = await damagePerPoint('core.strike');
  assert.ok(strike > 0);
  const overtuned = [];
  for (const id of coreReachableCardIds()) {
    const card = registries.cards.get(id);
    if (!(card.effects || []).some((e) => e.op === 'damage')) continue;
    const perPoint = await damagePerPoint(id);
    if (perPoint == null || perPoint < OVERTUNED * strike) continue;
    overtuned.push(id);
    assert.ok(drawbacksOf(card).some((kind) => PENALTIES.includes(kind)), `${id} deals ${perPoint} per point (Strike ${strike}) with no penalty`);
  }
  // Damage numbers move with other balance passes; the rule is what is pinned, plus one card that must stay in it.
  assert.ok(overtuned.includes('core.pyreLash'), JSON.stringify(overtuned));
});

test('the overtuned cards pay their penalty in HP, and their upgrade drops it', async () => {
  const { upgradedDefinition } = await import('../src/model/cardUpgrade.js');
  for (const id of ['core.pyreLash', 'core.forkedBolt', 'core.batteringGale', 'core.witherDraught', 'core.glacialSpike', 'core.radiantVerdict', 'core.meteor', 'colossusSmash']) {
    const card = registries.cards.get(id);
    assert.ok(drawbacksOf(card).includes('selfDamage'), id);
    assert.ok(!drawbacksOf(upgradedDefinition(card)).includes('selfDamage'), `${id}+ keeps no self-damage`);
  }
});

test('the Core content with these card changes validates (faces, upgrade faces and tokens)', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { validateContent } = await import('../src/model/validate.js');
  const { resolveGameProfile, applyGameProfileToContent } = await import('../src/model/gameProfile.js');
  const core = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
  const cards = (errors) => errors.filter((row) => row.path.startsWith('cards.'));
  assert.deepEqual(cards(validateContent(applyGameProfileToContent(contentBundle, core)).errors), []);
});
