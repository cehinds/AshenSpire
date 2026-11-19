// Owner, 2026-11-18 (gear pass A): the gear vocabulary is data (equipMods.csv + equipmentTypes.json) and each effect has an engine consumer. Preview equals play.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileGameProfiles } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { equipPiece, validateEquipment, runMods } from '../src/model/loadout.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { resolveCombatCard } from '../src/engine/combatExpansion.js';
import { applyStatus } from '../src/engine/statuses.js';
import { ThornsReturn } from '../src/engine/actions.js';
import { ItemIncomingPercent } from '../src/engine/itemPropertyHooks.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';
import { GEAR_TYPES } from '../src/content/gearTypes.js';
import { ParseGearMod, GearPieceMods, GearSummary, ApplyGearCardRules, GearHitRiders, GearHitAdds, GearModText, GearRuleTriggered } from '../src/model/gearEffects.js';

const { catalog, authors } = compileGameProfiles();
const profile = resolveGameAuthor(authors.core, catalog);
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const META = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const owned = { has: () => true };

function build({ right, left, armor, classId = 'reaver', player } = {}) {
  const run = createRunState({ registries, classId, seed: 31, profileMeta: META });
  const equip = (slot, id) => id && equipPiece(registries, run.loadout, slot, 0, id, owned, { inCombat: false, classId: run.class, attributes: run.attributes });
  equip('rightHand', right); equip('leftHand', left); equip('armor', armor);
  const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'], ...(player ? { player } : {}) });
  dispatch(combat, { type: 'setReactions', enabled: false });
  primeAccuracyRolls(combat, { count: 3 });
  const enemy = combat.enemies[0];
  Object.assign(enemy, { hp: 900, maxHp: 900, block: 0, statuses: {}, persistentPoise: { value: 0, max: 0 } });
  return { run, combat, enemy };
}
let serial = 0;
function addCard({ combat }, cardId) { const instanceId = `g${++serial}`; combat.piles.hand.push({ instanceId, cardId }); return instanceId; }
/** The quote for a card, then the play of it: returns both HP totals. */
function quoteAndPlay(world, cardId) {
  const id = addCard(world, cardId), { combat, enemy } = world;
  const quote = previewCard(combat, id, enemy.id).values.find(row => row.op === 'damage')?.totalDamage;
  const before = enemy.hp;
  dispatch(combat, { type: 'playCard', cardInstanceId: id, targetId: enemy.id });
  return { quote, dealt: before - enemy.hp };
}
const strikeAmount = world => resolveCombatCard(world.combat, { instanceId: addCard(world, 'core.strike'), cardId: 'core.strike' }).effects.find(e => e.op === 'damage').amount;

test('the shipped vocabulary, the type table and every piece validate clean', () => {
  assert.deepEqual(validateEquipment(registries), []);
});

test('mod strings parse selectors, conditions and values; unknown ones are not parseable', () => {
  const mod = ParseGearMod('anyAttack@target:retreating.cardAddDex=+1');
  assert.deepEqual([mod.selector, mod.conds, mod.field, mod.value], ['anyAttack', [{ name: 'target', arg: 'retreating' }], 'cardAddDex', 1]);
  assert.equal(ParseGearMod('nonsense'), null);
  assert.ok(ParseGearMod('self.thorns=+1'));
});

test('a type base and a piece signature add together; an armour group base carries its Thorns', () => {
  const sword = registries.equipment.armaments.find(piece => piece.id === 'straightSword');
  assert.deepEqual(GearPieceMods(sword), ['attack.cardDamage=+1', 'sweep.cardDamage=+1', ...sword.mods]);
  const plate = registries.equipment.armour.find(piece => piece.classId === 'reaver' && piece.id === 'default');
  assert.ok(GearPieceMods(plate).includes('self.thorns=+1'), 'the heavy body piece carries Thorns 1');
});

test('the Sword base adds +1 to a physical attack, on the face and in the hit (preview equals play)', () => {
  const sword = build({ right: 'straightSword' });
  assert.equal(strikeAmount(sword), 7, 'core.strike prints 6; the Sword adds 1');
  const { quote, dealt } = quoteAndPlay(sword, 'core.strike');
  assert.ok(dealt > 0);
  assert.equal(quote, dealt);
});

test('Katana adds DEX to an attack as STR is added; the quote equals the hit', () => {
  const plain = build({ right: 'straightSword' }), katana = build({ right: 'katana' });
  const a = quoteAndPlay(plain, 'core.strike'), b = quoteAndPlay(katana, 'core.strike');
  assert.equal(b.quote, b.dealt);
  const receipt = katana.combat.eventLog.findLast(e => e.type === 'damageDealt')?.damageReceipt?.hits?.[0];
  assert.ok(receipt, 'the hit has a receipt');
  assert.ok(katana.combat.player.itemProps.cardRules.some(rule => rule.stat === 'addDex'));
  assert.ok(a.dealt >= 0);
});

test('Greatsword adds STR a second time to a Smash: the quote and the hit both rise with it', () => {
  const great = build({ right: 'greatsword' }), without = build({ right: 'greatsword' });
  without.combat.player.itemProps.cardRules = without.combat.player.itemProps.cardRules.filter(rule => rule.stat !== 'addStr');
  assert.ok(great.combat.player.itemProps.cardRules.some(rule => rule.stat === 'addStr' && rule.selector === 'smash'));
  const g = quoteAndPlay(great, 'core.smash'), w = quoteAndPlay(without, 'core.smash');
  assert.ok(g.quote > w.quote, 'the quote carries the second STR');
  assert.ok(g.dealt > w.dealt, 'and so does the hit');
  assert.equal(great.combat.eventLog.findLast(e => e.type === 'damageDealt').damageReceipt.hits[0].incoming, g.dealt);
});

test('Multi-hit stacks repeat an attack once more each; the quote counts them', () => {
  const world = build({ right: 'straightSword' });
  applyStatus(world.combat, world.combat.player, 'multiHit', 1, world.combat.player);
  const def = resolveCombatCard(world.combat, { instanceId: addCard(world, 'core.strike'), cardId: 'core.strike' });
  assert.equal(def.effects.find(e => e.op === 'damage').hits, 2);
  const id = addCard(world, 'core.strike');
  const quote = previewCard(world.combat, id, world.enemy.id).values.find(row => row.op === 'damage');
  assert.equal(quote.hits, 2);
  const start = world.combat.eventLog.length;
  dispatch(world.combat, { type: 'playCard', cardInstanceId: id, targetId: world.enemy.id });
  assert.equal(world.combat.eventLog.slice(start).filter(e => e.type === 'damageDealt').length, 2);
});

test('Reach is a stack with normal decay: it gives physical attacks Reach and expires at the end of the owner\'s turn', () => {
  const world = build({ right: 'straightSword' });
  const rangeOf = () => resolveCombatCard(world.combat, { instanceId: addCard(world, 'core.strike'), cardId: 'core.strike' }).range;
  assert.notEqual(rangeOf(), 'reach');
  applyStatus(world.combat, world.combat.player, 'reach', 1, world.combat.player);
  assert.equal(rangeOf(), 'reach');
  assert.equal(registries.statuses.get('reach').decay, 'perTurnEnd');
});

test('Thorns: an attacker that lands a hit takes the holder\'s Thorns stacks, constant and without decay', () => {
  const { combat, enemy } = build({ right: 'straightSword' });
  const holder = combat.player;
  holder.statuses = {};
  applyStatus(combat, holder, 'thorns', 3, holder);
  assert.equal(registries.statuses.get('thorns').decay, 'none');
  const before = enemy.hp;
  assert.equal(ThornsReturn(combat, enemy, holder, {}, { blocked: 0 }), 3);
  assert.equal(before - enemy.hp, 3);
  assert.equal(ThornsReturn(combat, enemy, holder, { reflectedHit: true }, { blocked: 0 }), 0, 'a reflected hit is not an attacker landing a hit');
  assert.equal(holder.statuses.thorns.stacks, 3, 'it does not decay');
});

test('Fire Thorns (the Lantern) answers only a hit that met Block', () => {
  const { combat, enemy } = build({ right: 'straightSword' });
  combat.player.statuses = {};
  applyStatus(combat, combat.player, 'thornsFire', 1, combat.player);
  assert.equal(ThornsReturn(combat, enemy, combat.player, {}, { blocked: 0 }), 0);
  assert.equal(ThornsReturn(combat, enemy, combat.player, {}, { blocked: 4 }), 1);
});

test('hit rules apply a status or remove Retreat from a matching target', () => {
  const rules = [{ selector: 'smash', arg: null, conds: [], status: 'bleed', stacks: 1 }, { selector: 'anyAttack', arg: null, conds: [], remove: 'retreat', stacks: 1 },
    { selector: 'anyAttack', arg: null, conds: [{ name: 'target', arg: 'backRow' }], status: 'vulnerable', stacks: 1 }];
  const smash = { tags: ['camp:physical', 'maneuver:smash', 'classification.attack'] }, strike = { tags: ['camp:physical', 'maneuver:attack', 'classification.attack'] };
  assert.deepEqual(GearHitRiders(rules, smash, { row: 'front' }).applies, [{ status: 'bleed', stacks: 1 }]);
  assert.deepEqual(GearHitRiders(rules, strike, { row: 'front' }).applies, []);
  assert.deepEqual(GearHitRiders(rules, strike, { row: 'back' }).applies, [{ status: 'vulnerable', stacks: 1 }]);
  assert.deepEqual(GearHitRiders(rules, strike, { row: 'front' }).removes, [{ status: 'retreat', stacks: 1 }]);
});

test('a rule that reads the target (Retreat-stacked, front row) rides the hit, not the card', () => {
  const rules = [{ selector: 'anyAttack', arg: null, conds: [{ name: 'target', arg: 'retreating' }], stat: 'addDex', amount: 1 }, { selector: 'anyAttack', arg: null, conds: [{ name: 'target', arg: 'frontRow' }], stat: 'damage', amount: 1 }];
  const strike = { tags: ['camp:physical', 'maneuver:attack', 'classification.attack'] };
  assert.deepEqual(GearHitAdds(rules, strike, { statuses: { retreat: { stacks: 1 } }, row: 'back' }), { damage: 0, addDex: 1, triggered: true });
  assert.deepEqual(GearHitAdds(rules, strike, { statuses: {}, row: 'front' }), { damage: 1, addDex: 0, triggered: true });
  const def = { tags: strike.tags, effects: [{ op: 'damage', target: 'enemy', amount: 6 }], cost: 1 };
  assert.equal(ApplyGearCardRules(rules, def, {}), def, 'target rules leave the definition alone');
});

test('a stance condition changes a card only in that stance (magic focus: -1 MP in Prepared)', () => {
  const rules = [{ selector: 'spell', arg: null, conds: [{ name: 'stance', arg: 'prepared' }], stat: 'manaCost', amount: -1, mode: 'add', source: 'staff' }];
  const spell = { tags: ['camp:spell', 'maneuver:casting', 'classification.attack'], effects: [{ op: 'damage', target: 'enemy', amount: 10 }], cost: 1, staminaCost: 1, manaCost: 2 };
  assert.equal(ApplyGearCardRules(rules, spell, { stance: 'prepared' }).manaCost, 1);
  assert.equal(ApplyGearCardRules(rules, spell, { stance: 'attack' }).manaCost, 2);
  assert.equal(ApplyGearCardRules(rules, { ...spell, manaCost: 0 }, { stance: 'prepared' }).manaCost, 0, 'never below 0');
  assert.ok(GearRuleTriggered(rules[0]));
});

test('card rules cover Poise damage, Block, Pierce, Ignore Block, Retain, Escalating and 0-cost Multi-hit', () => {
  const attack = { tags: ['camp:physical', 'maneuver:attack', 'classification.attack'], effects: [{ op: 'damage', target: 'enemy', amount: 6 }], cost: 0, staminaCost: 0 };
  const defend = { tags: ['camp:physical', 'maneuver:defend', 'classification.skill'], effects: [{ op: 'block', target: 'self', amount: 10 }], cost: 1 };
  const rule = (selector, stat, amount) => ({ selector, arg: null, conds: [], stat, amount, mode: 'add' });
  const out = ApplyGearCardRules([rule('zeroCost', 'multiHit', 1), rule('anyAttack', 'poiseDamage', 2), rule('anyAttack', 'pierce', 2), rule('anyAttack', 'ignoreBlock', 1), rule('anyAttack', 'escalate', 1)], attack, {});
  assert.equal(out.effects[0].hits, 2);
  assert.deepEqual(out.effects[1], { op: 'poiseDamage', target: 'enemy', amount: 2 });
  assert.deepEqual([out.gear.pierce, out.gear.ignoreBlock], [2, 1]);
  assert.ok(out.costGrowth);
  assert.equal(ApplyGearCardRules([rule('blockCard', 'block', 3)], defend, {}).effects[0].amount, 13);
  assert.ok(ApplyGearCardRules([rule('defend', 'retain', 1)], defend, {}).keywords.includes('retain'));
  assert.equal(ApplyGearCardRules([rule('zeroCost', 'multiHit', 1)], { ...attack, cost: 1, staminaCost: 1 }, {}).effects[0].hits, undefined, '0-cost only');
});

test('Pierce +N passes N Block per hit and Ignore N Block passes N regardless of Stone Skin', () => {
  const { combat, enemy } = build({ right: 'straightSword' });
  enemy.block = 50;
  const hit = gear => profileReceipt(combat, enemy, gear);
  assert.equal(hit({ pierce: 2 }).pierceBypassed, 2);
  assert.equal(hit({ ignoreBlock: 3 }).pierceBypassed, 3);
  applyStatus(combat, enemy, 'stoneHide', 1, enemy);
  assert.equal(hit({ pierce: 2 }).pierceBypassed, 1, 'Stone Skin cuts Pierce by 1');
  assert.equal(hit({ ignoreBlock: 3 }).pierceBypassed, 3, 'but not Ignore Block');
});
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';
function profileReceipt(combat, enemy, gear) {
  return profileDamageReceipt(combat, combat.player, enemy, 20, { tags: ['camp:physical', 'maneuver:attack', 'classification.attack'], gear });
}

test('Resist takes 25% less damage of its element; Fire Vulnerable adds 5% per stack', () => {
  const { combat, enemy } = build({ right: 'straightSword' });
  const wearer = { kind: 'player', itemProps: { gearResist: { fire: 25 } } };
  assert.equal(ItemIncomingPercent(wearer, 'fire'), -25);
  assert.equal(ItemIncomingPercent(wearer, 'physical', 'fire'), -25);
  assert.equal(ItemIncomingPercent(wearer, 'frost'), 0);
  const fireHit = { tags: ['camp:spell', 'school:fire', 'classification.attack'] };
  const cold = profileDamageReceipt(combat, combat.player, enemy, 40, fireHit).hpLoss + profileDamageReceipt(combat, combat.player, enemy, 40, fireHit).blocked;
  applyStatus(combat, enemy, 'fireVulnerable', 4, enemy);
  const hot = profileDamageReceipt(combat, combat.player, enemy, 40, fireHit).hpLoss;
  assert.ok(hot > cold, 'four stacks of Fire Vulnerable raise a Fire hit');
});

test('Encumbered takes 1 SP on the first turn only; the summary carries the flag from a mod', () => {
  const base = build(), burdened = build({ player: { itemProps: { firstTurnSp: -1 } } });
  assert.equal(burdened.combat.player.energy, base.combat.player.energy - 1);
  assert.deepEqual(registries.equipment.modFields.firstTurnSp.apply, 'flag');
});

test('turn grants: a Shield gives 2 Block at the end of the turn', () => {
  const world = build({ left: 'roundShield' });
  assert.ok(world.combat.player.itemProps.turnGrants.some(grant => grant.phase === 'end' && grant.grant === 'block' && grant.amount === 2));
  const start = world.combat.eventLog.length;
  dispatch(world.combat, { type: 'endTurn' });
  assert.ok(world.combat.eventLog.slice(start).some(e => e.type === 'blockGained' && e.targetId === world.combat.player.id && e.amount === 2));
});

test('the gear summary reads types, groups and signatures from data for every worn piece', () => {
  const run = createRunState({ registries, classId: 'rogue', seed: 3, profileMeta: META });
  const summary = GearSummary(registries, run.loadout, run.class);
  assert.ok(summary.statPoints.dexterity >= 1, 'a light armour group adds DEX');
  assert.ok(summary.cardRules.some(rule => rule.stat === 'block'), 'and Block-card bonuses');
  assert.equal(GearModText(registries, 'sweep.cardDamage=+1'), 'Sweeps: +1 Damage');
  assert.equal(GearModText(registries, 'anyAttack@target:retreating.cardAddDex=+1'), 'Physical attacks against a Retreat-stacked target: +1 DEX to damage');
});

test('staves and sceptres grant 1 Ward and tomes 2 at the start of each turn, by the path a talisman uses', () => {
  const wardGrant = (type, amount) => assert.ok(GEAR_TYPES.weaponTypes[type].mods.includes(`start.turnWard=+${amount}`), `${type} carries start-of-turn Ward +${amount}`);
  wardGrant('staff', 1); wardGrant('sceptre', 1); wardGrant('talisman', 1); wardGrant('tome', 2);
  assert.ok(GEAR_TYPES.weaponTypes.tome.mods.includes('spell@first:turn.playDraw=+1'), 'the tome keeps its first-spell draw');
  for (const right of ['ashStaff', 'boneSceptre']) {
    const world = build({ right, classId: 'starseer' });
    assert.ok(world.combat.player.itemProps.turnGrants.some(grant => grant.phase === 'start' && grant.status === 'ward' && grant.amount === 1), `${right} grants Ward at the start of each turn`);
  }
  const world = build({ right: 'ashStaff', classId: 'starseer' });
  const before = world.combat.player.statuses.ward?.stacks || 0;
  dispatch(world.combat, { type: 'endTurn' });
  assert.ok((world.combat.player.statuses.ward?.stacks || 0) >= 1, `the next turn start applied Ward (had ${before})`);
});

// Owner, 2026-11-18 (ruling 15): always-on gear is part of the baseline face (black); a triggered effect that changes a number turns it green.
import { cardFaceLines } from '../src/model/cardFaceText.js';
const faceClasses = (world, cardId) => {
  const id = addCard(world, cardId);
  const preview = previewCard(world.combat, id, world.enemy.id);
  const line = cardFaceLines(registries.cards.get(cardId), preview, registries, null).find(row => row.kind === 'damage');
  return [...line.html.matchAll(/<span class="(val[^"]*)">(\d+)<\/span>/g)].map(match => `${match[1].replace('val', '').trim() || 'black'}:${match[2]}`);
};
test('the face baseline holds always-on gear only; a first-attack trigger turns the number green', () => {
  const world = build({ right: 'dagger' });
  const rules = world.combat.player.itemProps.cardRules;
  rules.push({ selector: 'anyAttack', arg: null, conds: [{ name: 'first', arg: 'fight' }], stat: 'damage', amount: 8, mode: 'add', source: 'handCrossbow' });
  const faceRules = previewCard(world.combat, addCard(world, 'core.strike'), world.enemy.id).faceRules;
  assert.ok(faceRules.gearRules.length && faceRules.gearRules.every(rule => !GearRuleTriggered(rule)), 'triggered rules are not in the baseline');
  assert.ok(!faceRules.gearRules.some(rule => rule.source === 'handCrossbow'));
  const lit = faceClasses(world, 'core.strike');
  assert.ok(lit.some(entry => entry.startsWith('up')), `a first-attack bonus is a triggered effect: ${lit}`);
  const calm = build({ right: 'dagger' });
  assert.ok(faceClasses(calm, 'core.sweep').every(entry => entry.startsWith('black')), 'with nothing triggered the face is black');
});

// Owner, 2026-11-19: a Hammer Smash sends the target back with 1 Retreat stack only when the hit breaks its Poise.
function hammerSmash(poise) {
  const world = build({ right: 'warhammer' });
  const { combat, enemy } = world;
  assert.ok(combat.player.itemProps.hitRules.some(rule => rule.selector === 'smash' && rule.push === 1 && rule.conds.some(c => c.name === 'breaks')), 'the Hammer type carries the push on a break');
  assert.equal(enemy.row, 'front', 'fixture: the soldier opens in the front row');
  enemy.persistentPoise = { value: poise, max: poise };
  const id = addCard(world, 'core.smash');
  dispatch(combat, { type: 'playCard', cardInstanceId: id, targetId: enemy.id });
  return world;
}

test('a Hammer Smash that breaks Poise sends the enemy back with 1 Retreat stack', () => {
  const { enemy, combat } = hammerSmash(1);
  assert.ok(combat.eventLog.some(e => e.type === 'poiseBroken' && e.targetId === enemy.id), 'fixture: the Smash broke Poise');
  assert.equal(enemy.statuses.retreat?.stacks, 1, 'one Retreat stack');
  assert.equal(enemy.row, 'back', 'in the back row');
});

test('a Hammer Smash that leaves Poise standing sends nothing back', () => {
  const { enemy, combat } = hammerSmash(900);
  assert.ok(!combat.eventLog.some(e => e.type === 'poiseBroken' && e.targetId === enemy.id), 'fixture: no break');
  assert.equal(enemy.statuses.retreat?.stacks || 0, 0, 'no Retreat stack');
  assert.equal(enemy.row, 'front', 'still in the front row');
});

// Owner, 2026-11-18: Medium and Light armour. Every Counter (or Evade) gain gives +1 more stack; ending your turn in Counter (or Defend) stance while
// holding at least 1 of them gives +1. Holding none gives nothing from the end-of-turn part.
const counterGains = (world, from) => world.combat.eventLog.slice(from).filter(e => e.type === 'counterStacksChanged' && e.targetId === world.combat.player.id).map(e => e.amount);
const evadeGains = (world, from) => world.combat.eventLog.slice(from).filter(e => e.type === 'statusApplied' && e.status === 'evade' && e.targetId === world.combat.player.id);

test('Medium mail: 3 Counter, ending the turn in Counter stance, gives 1 more', () => {
  const world = build({ armor: 'vigil' });
  assert.ok(world.combat.player.itemProps.turnGrants.some(grant => grant.phase === 'end' && grant.grant === 'counter'));
  world.combat.player.counterStacks = 3;
  world.combat.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  const from = world.combat.eventLog.length;
  dispatch(world.combat, { type: 'endTurn' });
  assert.deepEqual(counterGains(world, from).slice(0, 1), [1], 'exactly +1, the end grant takes no gain bonus');
});

test('Medium mail: a card granting 2 Counter gives 3', () => {
  const world = build({ armor: 'vigil' });
  const { combat } = world;
  combat.player.counterStacks = 0;
  combat.enqueue({ effect: { op: 'gainCounterStacks', target: 'self', amount: 2 }, source: combat.player, owner: combat.player, target: combat.player });
  dispatch(combat, { type: 'playCard', cardInstanceId: addCard(world, 'core.defend'), targetId: undefined });
  assert.equal(combat.player.counterStacks, 3);
});

test('Medium mail: holding no Counter gives nothing at the end of the turn', () => {
  const world = build({ armor: 'vigil' });
  world.combat.player.counterStacks = 0;
  world.combat.player.combatStance = { maneuver: 'counter', camp: 'physical', range: 'melee' };
  const from = world.combat.eventLog.length;
  dispatch(world.combat, { type: 'endTurn' });
  assert.deepEqual(counterGains(world, from).slice(0, 1).filter(amount => amount > 0), []);
});

test('Light leathers: 2 Evade, ending the turn in Defend stance, gives 1 more; with none held, nothing', () => {
  const world = build({ classId: 'rogue', armor: 'nightveil' });
  assert.ok(world.combat.player.itemProps.gainBonus.evade === 1);
  applyStatus(world.combat, world.combat.player, 'evade', 2, world.combat.player);
  world.combat.player.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
  const from = world.combat.eventLog.length;
  dispatch(world.combat, { type: 'endTurn' });
  const gains = evadeGains(world, from);
  assert.ok(gains.length >= 1 && gains[0].stacks === 1, `exactly +1: ${JSON.stringify(gains.map(e => e.stacks))}`);
  const none = build({ classId: 'rogue', armor: 'nightveil' });
  none.combat.player.statuses = {};
  none.combat.player.combatStance = { maneuver: 'defend', camp: 'physical', range: 'melee' };
  const start = none.combat.eventLog.length;
  dispatch(none.combat, { type: 'endTurn' });
  assert.equal(evadeGains(none, start).length, 0);
});

test('Light leathers: a card granting 2 Evade gives 3', () => {
  const world = build({ classId: 'rogue', armor: 'nightveil' });
  world.combat.player.statuses = {};
  world.combat.enqueue({ effect: { op: 'applyStatus', target: 'self', status: 'evade', stacks: 2 }, source: world.combat.player, owner: world.combat.player, target: world.combat.player });
  dispatch(world.combat, { type: 'playCard', cardInstanceId: addCard(world, 'core.defend'), targetId: undefined });
  assert.equal(world.combat.player.statuses.evade.stacks, 3);
});

test('Stone Skin is spent hit by hit: Pierce 1, three hits, Stone Skin 2 leaves the third hit piercing for 1', () => {
  const world = build({ right: 'halberd' });
  const { combat, enemy } = world;
  applyStatus(combat, combat.player, 'multiHit', 2, combat.player);
  enemy.block = 30;
  applyStatus(combat, enemy, 'stoneHide', 2, enemy);
  const id = addCard(world, 'core.strike');
  const start = combat.eventLog.length;
  dispatch(combat, { type: 'playCard', cardInstanceId: id, targetId: enemy.id });
  const hits = combat.eventLog.slice(start).filter(e => e.type === 'damageDealt' && e.targetId === enemy.id);
  assert.equal(hits.length, 3);
  assert.deepEqual(hits.map(hit => hit.pierced || 0), [0, 0, 1], 'only the third hit passes Block');
  assert.equal(enemy.statuses.stoneHide?.stacks || 0, 0);
});

test('the Axe STR arrives after the card resolves: the second Strike quotes what it deals', () => {
  const world = build({ right: 'battleaxe' });
  const first = quoteAndPlay(world, 'core.strike');
  assert.equal(first.quote, first.dealt);
  const second = quoteAndPlay(world, 'core.strike');
  assert.equal(second.quote, second.dealt, 'preview equals play on the second Strike');
  assert.ok(second.dealt >= first.dealt, 'the first Strike STR is in the second');
});

test('Escalating raises the card cost by 1 SP each time it is played', () => {
  const world = build({ right: 'straightSword' });
  world.combat.player.itemProps.cardRules.push({ selector: 'attack', arg: null, conds: [], stat: 'escalate', amount: 1, mode: 'add', source: 'test' });
  const costOf = () => resolveCombatCard(world.combat, { instanceId: 'esc', cardId: 'core.strike' }).staminaCost;
  const before = costOf();
  world.combat.player.energy = 9;
  const id = addCard(world, 'core.strike');
  dispatch(world.combat, { type: 'playCard', cardInstanceId: id, targetId: world.enemy.id });
  const played = world.combat.piles.discard.find(card => card.instanceId === id);
  assert.ok(played);
  assert.equal(resolveCombatCard(world.combat, played).staminaCost, before + 1);
});

test('a Bow Reach stack is granted at the start of the turn, so it is live for the attack that follows', () => {
  const world = build({ right: 'shortbow' });
  assert.ok(world.combat.player.itemProps.turnGrants.some(grant => grant.phase === 'start' && grant.status === 'reach'));
  assert.equal(world.combat.player.statuses.reach?.stacks, 1, 'the stack is there at turn 1');
});

test('the unarmoured type gives +1 max MP and a specific robe adds its own on top, uncapped', () => {
  assert.ok(GEAR_TYPES.armourGroups.unarmoured.mods.includes('self.maxMana=+1'));
  const plain = build({ classId: 'starseer' }).run;
  assert.equal(runMods(registries, plain.loadout, plain.class).maxMana, 1, 'a plain robe: the type base');
  const nightweave = build({ classId: 'starseer', armor: 'nightweave' }).run;
  assert.equal(runMods(registries, nightweave.loadout, nightweave.class).maxMana, 2, 'Nightweave: the type base plus its own +1');
});

// Owner, 2026-11-19: the Bow's end-of-turn Retreat is a floor of 1 stack, and only while in Defend stance.
function bowEnd({ stacks, stance }) {
  const world = build({ right: 'shortbow' });
  const { combat } = world;
  assert.ok(combat.player.itemProps.turnGrants.some(grant => grant.phase === 'end' && grant.grant === 'retreat' && grant.conds.some(c => c.name === 'stance' && c.arg === 'defend')), 'the Bow grant is Defend-gated');
  if (stacks) combat.player.statuses.retreat = { stacks };
  combat.player.combatStance = { maneuver: stance, camp: 'physical', range: 'melee' };
  dispatch(combat, { type: 'endTurn' });
  return combat.player.statuses.retreat?.stacks || 0;
}
test('Bow end of turn in Defend: 0 Retreat stacks becomes 1', () => assert.equal(bowEnd({ stacks: 0, stance: 'defend' }), 1));
test('Bow end of turn in Defend: 1 Retreat stack stays 1, no extra stack', () => assert.equal(bowEnd({ stacks: 1, stance: 'defend' }), 1));
test('Bow end of turn in Defend: 2 Retreat stacks stay 2', () => assert.equal(bowEnd({ stacks: 2, stance: 'defend' }), 2));
test('Bow end of turn outside Defend gives no Retreat stack', () => assert.equal(bowEnd({ stacks: 0, stance: 'counter' }), 0));

for (const intent of ['swapArmament', 'changeEquipment']) {
  test(`${intent} refreshes gear effects, removes the old type, and survives a snapshot`, () => {
    const { combat } = build({ right: 'greatsword' });
    combat.registries = { ...registries, balance: { ...registries.balance, equipment: { ...registries.balance.equipment, swapCostKind: 'allowance', allowChangesInCombat: true, swapEndsTurn: false } }, equipment: { ...registries.equipment, slots: registries.equipment.slots.map(row => row.id === 'rightHand' ? { ...row, sets: 2 } : row) } };
    combat.swapsLeft = 10;
    combat.loadout.sets.rightHand[1] = 'shortbow';
    combat.loadout.storage.push('shortbow');
    combat.player.itemProps.testRelic = 7;
    combat.player.counters.spellsPlayedThisTurn = 2;
    assert.ok(combat.player.itemProps.cardRules.some(row => row.stat === 'addStr'));
    dispatch(combat, intent === 'swapArmament'
      ? { type: intent, slotId: 'rightHand', setIndex: 1 }
      : { type: intent, slotId: 'rightHand', setIndex: 0, pieceId: 'shortbow' });
    assert.equal(combat.player.itemProps.mainWeaponType, 'bow');
    assert.ok(!combat.player.itemProps.cardRules.some(row => row.stat === 'addStr'));
    assert.ok(combat.player.itemProps.cardRules.some(row => row.stat === 'reach'));
    assert.ok(combat.player.itemProps.turnGrants.some(row => row.grant === 'retreat'));
    assert.equal(combat.player.itemProps.testRelic, 7);
    assert.equal(combat.player.counters.spellsPlayedThisTurn, 2);
    const restored = restoreCombatSnapshot({ registries: combat.registries, snapshot: serializeCombatSnapshot(combat), rng: createRng(31), expectedGameProfile: combat.gameProfile });
    assert.deepEqual(restored.player.itemProps, combat.player.itemProps);
  });
}

test('a gear Reach grant preserves a root range:ranged tag or combat profile', () => {
  const rules = [{ selector: 'anyAttack', arg: null, conds: [], stat: 'reach', amount: 1, mode: 'add' }];
  for (const extra of [{ tags: ['camp:physical', 'maneuver:attack', 'classification.attack', 'range:ranged'] }, { combatProfile: { range: 'ranged' } }]) {
    const card = { tags: ['camp:physical', 'maneuver:attack', 'classification.attack'], effects: [{ op: 'damage', target: 'enemy', amount: 3 }], ...extra };
    const projected = ApplyGearCardRules(rules, card);
    assert.equal(projected.range, 'ranged');
    assert.equal(projected.combatProfile.range, 'ranged');
  }
});

test('current Light armour Evade gain is included once in the pure preview and the live grant', () => {
  const { combat } = build({ classId: 'rogue', right: 'dagger' });
  assert.equal(combat.player.itemProps.gainBonus.evade, 1);
  const id = 'gear-light-shadowstep';
  combat.piles.hand.push({ instanceId: id, cardId: 'shadowstep' });
  combat.player.stamina = 20;
  const before = combat.player.statuses.evade?.stacks || 0, counters = combat.rng.getCounters();
  const shown = previewCard(combat, id).values.find(row => row.status === 'evade').value;
  assert.equal(shown, 3, 'Shadowstep base 2 plus the worn Light armour bonus');
  assert.equal(combat.player.statuses.evade?.stacks || 0, before);
  assert.deepEqual(combat.rng.getCounters(), counters);
  dispatch(combat, { type: 'playCard', cardInstanceId: id });
  assert.equal((combat.player.statuses.evade?.stacks || 0) - before, shown);
});
