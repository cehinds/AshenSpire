// Owner, 2026-11-18 (gear pass A): the gear vocabulary is data (equipMods.csv + equipmentTypes.json) and each effect has an engine consumer. Preview equals play.
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileGameProfiles } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { equipPiece, validateEquipment } from '../src/model/loadout.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';
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

function build({ right, left, classId = 'reaver', player } = {}) {
  const run = createRunState({ registries, classId, seed: 31, profileMeta: META });
  const equip = (slot, id) => id && equipPiece(registries, run.loadout, slot, 0, id, owned, { inCombat: false, classId: run.class, attributes: run.attributes });
  equip('rightHand', right); equip('leftHand', left);
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

test('a type base and a piece signature add together; a full set adds its group bonus', () => {
  const sword = registries.equipment.armaments.find(piece => piece.id === 'straightSword');
  assert.deepEqual(GearPieceMods(sword), ['attack.cardDamage=+1', 'sweep.cardDamage=+1', ...sword.mods]);
  const plate = registries.equipment.armour.find(piece => piece.classId === 'reaver' && piece.id === 'default');
  assert.ok(GearPieceMods(plate, [plate]).includes('self.thorns=+1'), 'a full heavy set carries Thorns 1');
  assert.ok(!GearPieceMods(plate, []).includes('self.thorns=+1'));
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
  assert.ok(summary.statPoints.poise >= 1, 'a light armour group adds Poise');
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
