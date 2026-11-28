// Owner ruling 2026-10-23: a Smash against a defensive stance (one the Smash beats: Defend or Prepared) deals
// 1.5 x normal damage against Defend, 1.25 x against Prepared; Poise loses floor(0.5 x that total) (capped at the Poise
// it holds) instead of the 25% absorption. Owner, 2026-11-20: the old bonus of a quarter of the target's Block is gone
// (a Smash card breaks a flat amount of Block instead, tests/smash-break.test.mjs); a saved `blockFraction` is ignored.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat as createRunCombatWithBenefits } from './withoutWeaknesses.mjs';
import { withoutStanceBenefits } from './legacyStanceRules.mjs';
// These numbers pin the pre-Wave-2.5 arithmetic, so the fight plays the rules of one created before the stance benefits (tests/stance-benefits.test.mjs owns those).
const createRunCombat = (...args) => withoutStanceBenefits(createRunCombatWithBenefits(...args));
import { applyAttackDamage } from '../src/engine/actions.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
import { previewDamageHits } from '../src/engine/combatDamagePreview.js';
import { fixCoreMechanics as shipped } from '../src/content/generated/fixCoreMechanics.js';
import { validateFixCoreRules, fixCoreSmashVsDefensiveRules, normalizeFixCoreRules } from '../src/model/fixCoreMechanics.js';
import { combatLogEntries } from '../src/model/combatLog.js';
import { damageReceiptLines } from '../src/ui/components/damageReceipt.js';
import { projectCombatIntent } from '../src/ui/models/CombatIntentProjectionModel.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { POISE_ON_MODULES } from './helpers/poise-on.mjs';
// Pins this file's SPEC worked examples (a Counter, Poise or Smash rule, not damage scale): the Core 0.5 base-damage scale is off here.
const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { ...POISE_ON_MODULES, effects: { baseDamageMultiplier: 1, physicalDamageMultiplier: 1, playerDamageMultiplier: 1, enemyDamageMultiplier: 1, blockGainMultiplier: 1 } } });
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const smash = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'smash', range: 'melee' } };
const attack = { skipRatingBonus: true, combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee' } };
function live({ stance = 'defend', block = 10, poise = 20, vulnerable = 0 } = {}) {
  const run = createRunState({ registries: reg, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  // These tests cover the Staggered rule a fight saved before Wave 3 keeps (no `poise.breakRule`); tests/poise-broken.test.mjs covers the shipped Broken rule.
  combat.fixCoreRules = { ...(combat.fixCoreRules || combat.gameProfile.fixCoreRules), poise: { drain: 'prevented' } };
  const target = combat.enemies[0];
  Object.assign(target, { hp: 500, maxHp: 500, block, barrier: 0, statuses: vulnerable ? { vulnerable: { stacks: vulnerable } } : {}, persistentPoise: { value: poise, max: 20 }, attributes: { dexterity: 0 }, ratings: { ar: 0, dr: 0, pr: 0, ward: 0, poise: 20 } });
  delete target.combatCounter;
  if (stance) target.combatStance = { maneuver: stance, camp: 'physical', range: 'melee' }; else delete target.combatStance;
  return { combat, target };
}
const hit = (combat, target, amount, carrier = smash) => { primeAccuracyRolls(combat); applyAttackDamage(combat, combat.player, target, amount, [], carrier); return combat.eventLog.filter(row => row.type === 'damageDealt').at(-1); };

test('shipped Defend override is separate from the historical shared Smash default', () => {
  assert.deepEqual(shipped.smashVsDefensive, { damageMultiplier: 1.25, defendDamageMultiplier: 1.5, poiseFraction: 0.5 });
  assert.deepEqual(fixCoreSmashVsDefensiveRules({}), { damageMultiplier: 1.25, poiseFraction: 0.5 }, 'old saves keep the historical shared default');
  assert.doesNotThrow(() => validateFixCoreRules({ ...shipped, smashVsDefensive: { ...shipped.smashVsDefensive, blockFraction: 0.25 } }), 'a saved blockFraction still loads');
  assert.throws(() => validateFixCoreRules({ ...shipped, smashVsDefensive: { ...shipped.smashVsDefensive, damageMultiplier: 0.5 } }), /smashVsDefensive/);
  assert.throws(() => validateFixCoreRules({ ...shipped, smashVsDefensive: { ...shipped.smashVsDefensive, extra: 1 } }), /smashVsDefensive/);
  for (const field of ['damageMultiplier', 'defendDamageMultiplier', 'blockFraction', 'poiseFraction'])
    for (const bad of [null, '0.25', '2', true, NaN, Infinity])
      assert.throws(() => validateFixCoreRules({ ...shipped, smashVsDefensive: { ...shipped.smashVsDefensive, [field]: bad } }), /smashVsDefensive/, `${field}=${String(bad)}`);
});

test('Defend worked example: Smash 12 becomes 18, Block takes 10, HP loses 8 and Poise loses 9', () => {
  const { combat, target } = live();
  const event = hit(combat, target, 12);
  assert.equal(event.amount, 18, '1.5 x 12, no Block bonus');
  assert.equal(event.blocked, 10);
  assert.equal(500 - target.hp, 8, 'the 25% Poise absorption does not apply to this hit');
  assert.equal(target.block, 0);
  assert.equal(20 - target.persistentPoise.value, 9);
  // Poise is damage rather than absorption, so the HP receipt and the log keep the same routing.
  assert.equal(event.poiseAbsorbed, 0);
  assert.equal(event.poiseMitigated, 0);
  assert.equal(event.poiseDamage, 9);
  assert.equal(event.damageReceipt.hits[0].poiseReduced, 0);
  assert.equal(event.damageReceipt.hits[0].poiseDamage, 9);
  const line = combatLogEntries([event], { registries: reg, players: [combat.player], enemies: combat.enemies }).map(row => row.text).join(' ');
  assert.match(line, /Poise damage 9 \(20 → 11\)/);
  assert.doesNotMatch(line, /Poise absorbed/);
  assert.match(line, /Block absorbed 10/);
  assert.match(line, /8 HP dealt/);
  const receiptText = damageReceiptLines(event.damageReceipt).join('\n');
  assert.match(receiptText, /Poise damage 9/);
  assert.doesNotMatch(receiptText, /Poise absorbed/);
});

test('the preview matches live resolution (same function)', () => {
  const { combat, target } = live();
  const preview = previewDamageHits(combat, combat.player, target, 12, [], smash, 1);
  const receipt = preview.damageReceipt.hits[0];
  assert.equal(receipt.incoming, 18);
  assert.equal(receipt.blocked, 10);
  assert.equal(preview.hpLoss, 8);
  const event = hit(combat, target, 12);
  assert.equal(500 - target.hp, preview.hpLoss);
  assert.equal(event.blocked, receipt.blocked);
});

test('Prepared is a defensive stance for Smash too; Attack and neutral stances are not', () => {
  const prepared = live({ stance: 'prepared' }); hit(prepared.combat, prepared.target, 12);
  assert.equal(20 - prepared.target.persistentPoise.value, 7, 'floor(0.5 x 15)');
  const plain = live({ stance: 'attack' }); hit(plain.combat, plain.target, 12);
  assert.notEqual(20 - plain.target.persistentPoise.value, 7, 'normal Poise absorption path');
  const none = live({ stance: null }); hit(none.combat, none.target, 12);
  assert.equal(none.target.block, 0);
  assert.ok(500 - none.target.hp <= 12, 'no defensive-stance bonus without a defensive stance');
});

test('only Smash gets the bonus: an Attack into a defending target is unchanged', () => {
  const { combat, target } = live(); const event = hit(combat, target, 12, attack);
  assert.ok(event.amount <= 12, `no defensive-stance bonus and no Block bonus (got ${event.amount})`);
  assert.ok(20 - target.persistentPoise.value < 5, 'Poise takes only the 25% absorption');
});

test('Vulnerable stays before the Defend bonus: 12 x 1.25 x 1.5, floored = 22', () => {
  const { combat, target } = live({ vulnerable: 1 }); const event = hit(combat, target, 12);
  assert.equal(event.amount, 22);
  assert.equal(20 - target.persistentPoise.value, 11, 'floor(0.5 x 22)');
});

test('Poise loss is capped at the Poise held; a break staggers once', () => {
  const { combat, target } = live({ poise: 5 }); hit(combat, target, 12);
  assert.equal(target.persistentPoise.value, 0);
  assert.equal(target.combatStance.maneuver, 'staggered');
  assert.equal(combat.eventLog.filter(row => row.type === 'poiseBroken').length, 1);
});

test('Smash 12 vs Defend with 0 Block = 18', () => {
  const { combat, target } = live({ block: 0 }); const event = hit(combat, target, 12);
  assert.equal(event.amount, 18);
  assert.equal(500 - target.hp, 18);
  assert.equal(20 - target.persistentPoise.value, 9);
});

// The soldier's slash re-authored as a Smash (tags decide the maneuver), so the projection sees a Smash move.
const smashTags = ['camp:physical', 'maneuver:smash', 'damage:bludgeoning', 'source:weapon', 'delivery:melee'];
const smashEnemies = { get: id => { const row = reg.enemies.get(id); return id === 'wanderingSoldier' ? { ...row, moves: { ...row.moves, slash: { ...row.moves.slash, tags: smashTags } } } : row; }, has: id => reg.enemies.has(id) };

test('multi-hit Smash loses the Defend bonus after the first hit breaks Poise: 6, then 5 and 5 with Vulnerable', () => {
  const { combat } = live({ block: 0, poise: 5 });
  combat.registries = { ...combat.registries, enemies: smashEnemies };
  Object.assign(combat.enemies[0], { statuses: {}, attributes: { dexterity: 0 }, ratings: { ar: 0, dr: 0, pr: 0, ward: 0, poise: 20 } });
  Object.assign(combat.player, { hp: 100, maxHp: 100, block: 0, barrier: 0, statuses: {}, persistentPoise: { value: 3, max: 20 }, combatStance: { maneuver: 'defend', camp: 'physical', range: 'melee' } });
  delete combat.player.combatCounter;
  const enemy = combat.enemies[0];
  enemy.intent = { kind: 'attack', moveId: 'slash', damage: 4, hits: 3, combatProfile: { camp: 'physical', maneuver: 'smash', range: 'melee', damageType: 'bludgeoning' } };
  enemy.intentRevealed = true; enemy.proposalIntentRevealedUntil = 99;
  const shown = projectCombatIntent(combat, enemy.id).projectedDamage;
  assert.equal(shown.max, 16);
  const preview = previewDamageHits(combat, enemy, combat.player, 4, smashTags, enemy.intent, 3);
  assert.equal(preview.hpLoss, shown.max);
  // The first hit drains all 3 Poise and changes Defend to Staggered before the later contacts are priced.
  assert.deepEqual(preview.damageReceipt.hits.map(hit => hit.poiseDamage ?? 0), [3, 0, 0], 'first-hit Smash Poise damage, then no defensive-stance bonus');
  for (let i = 0; i < 3; i++) { primeAccuracyRolls(combat); applyAttackDamage(combat, enemy, combat.player, 4, smashTags, enemy.intent); }
  assert.equal(100 - combat.player.hp, shown.max);
});

test('missing saved-rule block and absent Defend override keep historical shared tuning intact', () => {
  for (const savedMultiplier of [undefined, 1.6, 2]) {
    const rules = structuredClone(shipped);
    if (savedMultiplier === undefined) delete rules.smashVsDefensive;
    else { delete rules.smashVsDefensive.defendDamageMultiplier; rules.smashVsDefensive.damageMultiplier = savedMultiplier; }
    const before = structuredClone(rules);
    assert.equal(normalizeFixCoreRules(rules), rules);
    const { combat, target } = live();
    combat.fixCoreRules = rules;
    const preview = previewDamageHits(combat, combat.player, target, 12, [], smash);
    const event = hit(combat, target, 12);
    assert.equal(event.amount, Math.floor(12 * (savedMultiplier ?? 1.25)));
    assert.equal(500 - target.hp, preview.hpLoss);
    assert.deepEqual(rules, before, 'loading and resolving do not rewrite saved tuning');
  }
});

test('the optional Defend override accepts finite values at least one with no maximum', () => {
  for (const value of [1, 1.6, 2, Number.MAX_VALUE]) {
    assert.doesNotThrow(() => validateFixCoreRules({ ...shipped, smashVsDefensive: { ...shipped.smashVsDefensive, defendDamageMultiplier: value } }));
  }
  for (const value of [0, 0.99, -1, null, '1.5', true, NaN, Infinity]) {
    assert.throws(() => validateFixCoreRules({ ...shipped, smashVsDefensive: { ...shipped.smashVsDefensive, defendDamageMultiplier: value } }), /smashVsDefensive/);
  }
});

test('a saved Defend override wins over shared custom tuning without changing Prepared', () => {
  for (const shared of [1.6, 2]) {
    for (const stance of ['defend', 'prepared']) {
      const { combat, target } = live({ stance });
      combat.fixCoreRules = { ...combat.fixCoreRules, smashVsDefensive: { ...shipped.smashVsDefensive, damageMultiplier: shared } };
      const multiplier = stance === 'defend' ? 1.5 : shared;
      const quote = profileDamageReceipt(combat, combat.player, target, 12, smash);
      assert.equal(quote.rawHit, Math.floor(12 * multiplier), `${shared}/${stance}: raw hit`);
      const preview = previewDamageHits(combat, combat.player, target, 12, [], smash);
      const event = hit(combat, target, 12);
      assert.equal(event.amount, Math.floor(12 * multiplier), `${shared}/${stance}: total`);
      assert.equal(500 - target.hp, preview.hpLoss, `${shared}/${stance}: quote equals HP lost`);
    }
  }
});

test('Prepared melee weakness and the shared Smash matchup never multiply each other', () => {
  const { combat, target } = live({ stance: 'prepared' });
  combat.fixCoreRules = { ...combat.fixCoreRules, stanceBenefits: { version: 1, prepared: { meleeDamageTakenMultiplier: 1.25 } } };
  const quote = profileDamageReceipt(combat, combat.player, target, 12, smash);
  assert.equal(quote.rawHit, 15);
  assert.equal(quote.amount, 15);
  const preview = previewDamageHits(combat, combat.player, target, 12, [], smash);
  hit(combat, target, 12);
  assert.equal(500 - target.hp, preview.hpLoss);
  assert.equal(preview.hpLoss, 5);
});

test('Counter still reduces Smash exactly once while rawHit stays before defensive mitigation', () => {
  const { combat, target } = live({ stance: 'counter', block: 0, poise: 0 });
  const quote = profileDamageReceipt(combat, combat.player, target, 20, smash);
  assert.equal(quote.rawHit, 20);
  assert.equal(quote.hpLoss, 15);
  assert.equal(quote.stanceMitigation, 0.25);
  assert.equal(quote.smashVsDefensive, undefined);
  assert.deepEqual(quote.damageReceipt.hits[0].sources.filter(row => row.id === 'stance-defense').map(row => row.multiplier), [0.75]);
  const preview = previewDamageHits(combat, combat.player, target, 20, [], smash);
  const event = hit(combat, target, 20);
  assert.equal(event.damageReceipt.hits[0].incoming, 15);
  assert.equal(500 - target.hp, preview.hpLoss);
  assert.equal(preview.hpLoss, 15);
});

test('the existing active Smash matchup gates the override, including reordered and custom tables', () => {
  for (const matchups of [[], ['prepared'], ['prepared', 'defend'], ['attack']]) {
    const { combat, target } = live({ stance: matchups.includes('attack') ? 'attack' : 'defend', block: 0, poise: 0 });
    combat.gameProfile = structuredClone(combat.gameProfile);
    combat.gameProfile.modules.stances.matchups.smash = matchups;
    combat.gameProfile.modules.stances.matchups.attack = [];
    const quote = profileDamageReceipt(combat, combat.player, target, 12, smash);
    const expected = matchups.includes('attack') ? 15 : matchups.includes('defend') ? 18 : 12;
    assert.equal(quote.rawHit, expected, JSON.stringify(matchups));
    const preview = previewDamageHits(combat, combat.player, target, 12, [], smash);
    hit(combat, target, 12);
    assert.equal(500 - target.hp, preview.hpLoss, JSON.stringify(matchups));
  }
  const { combat, target } = live({ block: 0, poise: 0 });
  combat.gameProfile = structuredClone(combat.gameProfile);
  combat.gameProfile.modules.stances = false;
  const quote = profileDamageReceipt(combat, combat.player, target, 12, smash);
  assert.equal(quote.rawHit, 12);
  assert.equal(quote.smashVsDefensive, undefined);
});
