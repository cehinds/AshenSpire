import { legacyGearRegistries } from './helpers/legacy-gear.mjs';
// Owner, 2026-11-14 content decisions for Core (W25-B): Backstep cost, Jab as a reaction, spell damage, Ward and Barrier.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
const card = id => cards.find(row => row.id === id);

// W25-EvadeCards (2026-11-15): Backstep costs 1 Stamina again (SPEC 5.1: Evade 1, Retreat, Prepared 1).
test('Backstep costs 1 Stamina, in the pack and under every resource profile', () => {
  const backstep = card('core.backstep');
  assert.equal(backstep.staminaCost, 1);
  assert.equal(backstep.cost, 1);
  const variants = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/resourceVariants.json', import.meta.url), 'utf8'))['core.backstep'];
  assert.equal(variants.sp.staminaCost, 1);
  assert.equal(variants['sp,mp'].staminaCost, 1);
});

import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from './withoutWeaknesses.mjs';
import { dispatch } from '../src/engine/combat.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function live(classId = 'reaver', seed = 511, registries = reg) {
  const run = createRunState({ registries, classId, seed, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries, run, rng: createRng(seed), enemyIds: ['wanderingSoldier'] });
  return { run, combat };
}

test('Jab is a reaction card: it is offered against an incoming melee attack when held and affordable', () => {
  assert.ok(card('core.jab').tags.includes('trait:reaction'));
  const { combat } = live();
  combat.piles.hand.length = 0;
  combat.piles.hand.push({ cardId: 'core.jab', instanceId: 'jab1', upgraded: false });
  for (const enemy of combat.enemies) enemy.intentRevealed = false;
  dispatch(combat, { type: 'endTurn' });
  const offer = combat.pendingReaction;
  assert.ok(offer, 'the enemy attack opens a reaction window');
  const option = offer.options.find(row => row.cardId === 'core.jab');
  assert.ok(option, 'Jab is among the options');
  assert.equal(option.staminaCost, 1);
});

test('played as a reaction, Jab pays 1 Stamina and strikes the attacker before the hit lands', () => {
  const { combat } = live();
  const enemy = combat.enemies[0];
  combat.piles.hand.length = 0;
  combat.piles.hand.push({ cardId: 'core.jab', instanceId: 'jab1', upgraded: false });
  const hpBefore = enemy.hp;
  dispatch(combat, { type: 'endTurn' });
  const out = dispatch(combat, { type: 'chooseReaction', offerId: combat.pendingReaction.id,
    optionId: combat.pendingReaction.options.find(row => row.cardId === 'core.jab').id });
  const types = out.events.map(event => event.type);
  assert.ok(types.includes('cardPlayed'));
  assert.ok(types.indexOf('cardPlayed') < types.indexOf('attackHit'), 'the reaction resolves before the incoming hit');
  assert.ok(enemy.hp < hpBefore, 'the Jab landed on the attacker');
  assert.equal(out.events.find(event => event.type === 'cardPlayed').staminaSpent, 1);
});

// Owner, 2026-11-14: spells deal double base damage. Pre-change damage per spell card, [base, upgraded] (the
// authored `damage` effects only; poiseDamage, Block and statuses did not change).
// Venom Spray's upgraded damage was raised 3 -> 4 (6 -> 8 doubled) by the no-op upgrade pass (w25-upgrade-no-ops: Venom is capped at 3, so the upgrade
// had to change something else); the entry below is the value that pass left, so the doubling check still holds for it.
// Owner ruling 2026-11-21 (starter budget): Arcane Spark prints 3 (was 6) so the starter cantrips stay Unranked.
const SPELL_DAMAGE_BEFORE = {"starseerSpecial":[[9],[]],"cantrip":[[3],[]],"cinderDart":[[3],[4]],"galePush":[[3],[5]],"galePull":[[3],[5]],"starfall":[[8],[11]],"cometLance":[[12],[16]],"searingRay":[[9],[13]],"meteor":[[30],[38]],"judgment":[[10],[13]],"arcaneSiphon":[[7],[10]],"emberWave":[[3],[5]],"eclipse":[[6],[9]],"astralBolt":[[7],[10]],"censure":[[5],[7]],"smite":[[8],[10]],"manaLash":[[6],[8]],"frostNip":[[3],[4]],"spark":[[3],[4]],"emberFlick":[[2],[3]],"dazzleFlare":[[2],[3]],"palmFlame":[[4],[5]],"rimeBite":[[2],[3]],"brittleTouch":[[1],[2]],"dawnFlame":[[4],[6]],"venomSpray":[[2],[4]],"graveToll":[[3],[4]],"rendingHex":[[2],[3]],"acidSplash":[[3],[4]],"jolt":[[4],[6]],"shockingGrasp":[[3],[4]],"stormLash":[[3],[5]]};

// Owner, 2026-11-15: "Halve cantrip damage": a `rank.cantrip` card is back at its pre-doubling damage (floor, at least 1); every other spell keeps the doubling.
test('retained legacy Spell damage keeps its doubling and cantrip baseline while tradition rebalances are explicit', () => {
  const damages = effects => (effects || []).filter(effect => effect.op === 'damage').map(effect => effect.amount);
  // The nine cost.manaOnly spells are new in batch 4 and authored at their final damage: neither doubled nor halved.
  const spells = cards.filter(row => row.tags.includes('camp:spell') && !row.tags.includes('cost.manaOnly') && (damages(row.effects).length || damages(row.upgrade?.effects).length));
  const repurposed = ['censure', 'graveToll', 'rendingHex', 'acidSplash'];
  const added = { glimpse: [[4], [6]], mindLance: [[12], [16]] };
  assert.equal(spells.length, Object.keys(SPELL_DAMAGE_BEFORE).length - repurposed.length + Object.keys(added).length);
  for (const id of repurposed) {
    const row = card(`core.${id}`);
    assert.deepEqual(damages(row.effects), [], `${id}: Divine support replaces its former damage`);
    assert.deepEqual(damages(row.upgrade.effects), [], `${id}: upgraded support stays non-damaging`);
  }
  for (const row of spells) {
    const id = row.id.replace('core.', '');
    if (added[id]) {
      assert.deepEqual([damages(row.effects), damages(row.upgrade.effects)], added[id], `${id}: authored Arcane offense`);
      continue;
    }
    const [base, upgraded] = SPELL_DAMAGE_BEFORE[id];
    const scale = row.tags.includes('rank.cantrip') ? 1 : 2;
    assert.deepEqual(damages(row.effects), base.map(n => Math.max(1, n * scale)), row.id);
    assert.deepEqual(damages(row.upgrade?.effects), upgraded.map(n => Math.max(1, n * scale)), `${row.id} upgraded`);
  }
});

test('a physical card keeps its damage', () => {
  assert.equal(card('core.jab').effects[0].amount, 4);
  assert.equal(card('core.strike').effects.find(effect => effect.op === 'damage').amount, 6);
});

test('a cast cantrip deals its halved damage, and the hit meets Poise before HP', () => {
  const { combat } = live('starseer');
  const target = combat.enemies[0];
  target.hp = target.maxHp = 500; target.block = 0;
  assert.ok(target.poiseMeter.max > 0, 'the target has Poise');
  combat.piles.hand.push({ cardId: 'core.cantrip', instanceId: 'c1', upgraded: false });
  const out = dispatch(combat, { type: 'playCard', cardInstanceId: 'c1', targetId: target.id });
  const dealt = out.events.find(event => event.type === 'damageDealt');
  const hit = dealt.damageReceipt.hits[0];
  assert.equal(hit.sources.find(row => row.id === 'base').amount, 3 + 1, 'Cantrip authored 3 (owner 2026-11-21 starter budget), plus the current Sceptre magic damage 1');
  assert.ok(dealt.poiseAbsorbed > 0, 'Poise took its share first');
  assert.equal(hit.hpLoss, hit.incoming - hit.poiseReduced, 'HP only took what Poise left');
  assert.equal(500 - target.hp, dealt.hpLoss);
});

// Owner, 2026-11-14: Ward and Barrier are Poise effects. Each stack raises the holder's Poise and its maximum while it lasts, and a hit
// meets Poise before HP. Ward is not a separate pool (ward.enabled stays false); `ward.poisePerStack` is the new rule key.
import { applyStatus } from '../src/engine/statuses.js';
const poiseOf = combat => ({ ...combat.player.persistentPoise });
const enemyHit = combat => {
  combat.enemies[0].intentRevealed = false;
  const hp = combat.player.hp;
  const out = dispatch(combat, { type: 'endTurn' });
  return { out, lost: hp - combat.player.hp, dealt: out.events.find(event => event.type === 'damageDealt' && event.targetId === 'player') };
};

test('the shipped rules give Ward 5 Poise a stack and keep the Ward pool off', () => {
  const { combat } = live('starseer');
  assert.equal(combat.fixCoreRules.ward.enabled, false);
  assert.equal(combat.fixCoreRules.ward.poisePerStack, 5);
  assert.equal(combat.player.persistentWard?.max || 0, 0, 'no Ward pool');
});

test('Barrier raises current and maximum Poise by 5 a stack, and Ward does the same', () => {
  for (const status of ['barrier', 'ward']) {
    const { combat } = live('starseer');
    const before = poiseOf(combat);
    applyStatus(combat, combat.player, status, 2, null);
    const after = poiseOf(combat);
    assert.equal(after.max, before.max + 10, `${status} max`);
    assert.equal(after.value, before.value + 10, `${status} current`);
  }
});

test('Mote Shield (Ward 1 and Barrier 1) raises Poise by 10 and Hallowed Ward (1 Barrier) by 5', () => {
  const play = id => {
    const { combat } = live('starseer');
    const before = poiseOf(combat);
    combat.piles.hand.push({ cardId: id, instanceId: 'g1', upgraded: false });
    dispatch(combat, { type: 'playCard', cardInstanceId: 'g1' });
    return { before, after: poiseOf(combat) };
  };
  const mote = play('core.moteShield'), hallowed = play('core.hallowedWard');
  assert.equal(mote.after.max - mote.before.max, 10);
  assert.equal(mote.after.value - mote.before.value, 10);
  assert.equal(hallowed.after.max - hallowed.before.max, 5);
});

test('while the holder has Ward or Barrier, a hit meets Poise before HP', () => {
  for (const status of ['barrier', 'ward']) {
    const { combat } = live('starseer');
    combat.player.block = 0;
    applyStatus(combat, combat.player, status, 3, null);
    const poise = poiseOf(combat).value;
    const { dealt, lost } = enemyHit(combat);
    assert.ok(dealt.poiseAbsorbed > 0, `${status}: Poise took the first of the hit`);
    assert.equal(dealt.hpLoss, lost);
    assert.ok(dealt.damageReceipt.hits[0].poiseReduced <= poise);
    assert.ok(lost < dealt.damageReceipt.hits[0].incoming, `${status}: HP lost less than the hit`);
  }
});

test('a fight saved before the ruling (its rules lack ward.poisePerStack) gives Ward no Poise', () => {
  const { combat } = live('starseer', 511, legacyGearRegistries(reg));
  delete combat.fixCoreRules.ward.poisePerStack;
  const before = poiseOf(combat);
  applyStatus(combat, combat.player, 'ward', 2, null);
  assert.deepEqual(poiseOf(combat), before);
  applyStatus(combat, combat.player, 'barrier', 1, null);
  assert.equal(poiseOf(combat).max, before.max + 5, 'Barrier is unchanged');
});
