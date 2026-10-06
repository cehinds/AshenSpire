import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { progressionCards, progressionCardUnlocks, abilityCardUpdates } from '../src/content/progression/cards.js';
import { nodes } from '../src/content/generated/nodes.js';
import { tagging } from '../src/content/generated/tagging.js';

// Content remains independently authorable; integration can exercise these
// same recipes against the assembled core and DSL without copying test data.
const engineRoot = process.env.PROGRESSION_ENGINE_ROOT;
const engineModule = path => import(engineRoot ? pathToFileURL(resolve(engineRoot, path)).href : new URL(`../${path}`, import.meta.url).href);
const [{ contentBundle }, { createRegistries }, { createCombat }, { executeAction }, { createRng }, { getStacks }] = await Promise.all([
  engineModule('src/content/index.js'), engineModule('src/model/registries.js'), engineModule('src/engine/combat.js'), engineModule('src/engine/actions.js'), engineModule('src/engine/rng.js'), engineModule('src/framework/statusSemantics.js'),
]);

const registries = createRegistries({ ...contentBundle, cards: [...contentBundle.cards.filter(c => !progressionCards.some(n => n.id === c.id)), ...progressionCards] });
const byName = name => progressionCards.find(c => c.name === name);
const fixture = () => {
  const player = { id: 'p1', classId: 'reaver', maxHp: 100, hp: 50, maxMana: 100, maxStamina: 100, energyMax: 100, drawPerTurn: 1, relicIds: [], deck: Array.from({ length: 20 }, (_, i) => ({ instanceId: `d${i}`, cardId: 'strike' })) };
  const combat = createCombat({ registries, rng: createRng(13), player, enemyIds: ['wanderingSoldier', 'wanderingSoldier'] });
  for (const enemy of combat.enemies) { enemy.hp = enemy.maxHp = 1000; enemy.block = 0; }
  return combat;
};
function resolveRecipe(combat, card, rank) {
  const source = combat.player;
  const target = combat.enemies[0];
  const profile = card.gradeProfiles[rank];
  const ref = { ...card, type: card.type, tags: [card.abilityKind === 'spell' ? 'source:spell' : 'source:weapon'] };
  for (const effect of profile.effects) executeAction(combat, { effect, source, owner: source, target, card: ref, meta: { ordinalThisTurn: 1 } });
}

test('forty families author every grade and the complete ten-unlock class ladders', () => {
  assert.equal(progressionCards.length, 40);
  assert.equal(new Set(progressionCards.map(c => c.id)).size, 40);
  for (const classId of ['reaver', 'starseer', 'rogue', 'herald']) {
    assert.deepEqual(progressionCardUnlocks.filter(c => c.classId === classId).map(c => c.level), [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
    assert.equal(progressionCards.filter(c => c.class === classId).length, 10);
  }
  for (const card of [...progressionCards, ...abilityCardUpdates]) {
    assert.deepEqual(card.gradeProfiles.map(p => p.rank), [0, 1, 2, 3, 4, 5], card.id);
    for (const p of card.gradeProfiles) {
      assert.equal(p.manaCost, p.rank, card.id);
      assert(p.actionCost >= 1 && p.actionCost <= (p.rank === 0 ? 3 : p.rank), `${card.id}/${p.rank}`);
      assert(!('staminaCost' in p), 'Actions and Stamina have one authored price');
    }
  }
});

test('every new family reserves the complete conditional direct-effect budget', () => {
  for (const card of progressionCards) for (const p of card.gradeProfiles) {
    const direct = p.effects.filter(e => ['damage', 'block'].includes(e.op)).reduce((sum, e) => sum + e.amount * (e.hits || 1), 0);
    assert(direct <= [6, 9, 13, 18, 24, 30][p.rank], `${card.id}/${p.rank}: ${direct}`);
    assert(p.effects.every(e => e.amount == null || e.amount >= 0), card.id);
  }
});

test('all eighty focused grade-zero/one recipes execute in the real interpreter', () => {
  for (const card of progressionCards) for (const rank of [0, 1]) {
    const combat = fixture();
    const profile = card.gradeProfiles[rank];
    const effect = profile.effects[0];
    const before = { hp: combat.enemies[0].hp, block: combat.player.block };
    resolveRecipe(combat, card, rank);
    if (effect.op === 'damage') assert.equal(before.hp - combat.enemies[0].hp, effect.amount * (effect.hits || 1), `${card.id}/${rank}`);
    else assert.equal(combat.player.block - before.block, effect.amount, `${card.id}/${rank}`);
    assert(!profile.effects.some(e => ['loseHp', 'grantCardCharge'].includes(e.op)), 'advanced rider inactive');
    assert.equal(combat.enemies[1].hp, 1000, 'low grade stays focused');
  }
});

test('authored status riders resolve after damage, with the right buildup identity', () => {
  for (const [name, id, stacks] of [['Ember Hew', 'bleed', 2], ['Comet Needle', 'vulnerable', 1], ['Needle Feint', 'weak', 1], ['Blight Litany', 'crimsonBlight', 3]]) {
    const combat = fixture();
    resolveRecipe(combat, byName(name), 2);
    assert.equal(getStacks(combat.enemies[0], id), stacks, name);
    const events = combat.eventLog.filter(e => ['damageDealt', 'statusApplied'].includes(e.type));
    assert.equal(events[0].type, 'damageDealt', `${name} hits before its status rider`);
    assert.equal(events.at(-1).status, id);
  }
});

test('Bleed conditional draw is earned only against a bleeding target', () => {
  const cold = fixture();
  const coldHand = cold.piles.hand.length;
  resolveRecipe(cold, byName('Bloodstep'), 2);
  assert.equal(cold.piles.hand.length, coldHand);
  const warm = fixture();
  executeAction(warm, { effect: { op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 1 }, source: warm.player, target: warm.enemies[0] });
  const warmHand = warm.piles.hand.length;
  resolveRecipe(warm, byName('Bloodstep'), 2);
  assert.equal(warm.piles.hand.length, warmHand + 1);
});

test('Frost defense, capped healing, Break and two-hit recipes have separate outcomes', () => {
  const frost = fixture(); resolveRecipe(frost, byName('Rime Mirror'), 2);
  assert.equal(getStacks(frost.enemies[0], 'frost'), 3);
  assert.equal(frost.player.block, byName('Rime Mirror').gradeProfiles[2].effects[0].amount);
  const heal = fixture(); heal.player.hp = 99; resolveRecipe(heal, byName('Ash Benediction'), 2);
  assert.equal(heal.player.hp, 100);
  const breaker = fixture(); resolveRecipe(breaker, byName('Breaker’s Toll'), 2);
  assert.equal(breaker.enemies[0].poiseMeter.value, 4, 'Break buildup is separate from HP damage');
  assert.equal(breaker.enemies[0].hp, 1000 - byName('Breaker’s Toll').gradeProfiles[2].effects[0].amount);
  const twin = fixture(); resolveRecipe(twin, byName('Twinshade'), 2);
  assert.equal(twin.eventLog.filter(e => e.type === 'damageDealt').length, 2);
  assert.equal(twin.enemies[1].hp, 1000);
});

test('area form begins at grade three and acts on every living enemy', () => {
  const card = byName('Ashen Cleaver');
  assert.equal(card.gradeProfiles[2].effects[0].target, 'enemy');
  const combat = fixture(); resolveRecipe(combat, card, 3);
  for (const enemy of combat.enemies) {
    assert.equal(enemy.hp, 1000 - card.gradeProfiles[3].effects[0].amount);
    assert.equal(getStacks(enemy, 'weak'), 1);
  }
});

test('fifty ability nodes and normalized card associations retain catalog identities', () => {
  assert.equal(nodes.filter(n => n.id.startsWith('ability:')).length, 50);
  for (const c of progressionCards) {
    assert(tagging.some(t => t.family === 'card' && t.objectId === c.id && t.tagId.startsWith('ability:')), c.id);
    assert(tagging.some(t => t.family === 'card' && t.objectId === c.id && t.tagId === `classification.${c.type}`));
    assert(!('tags' in c), 'tag associations have only the normalized CSV home');
  }
  for (const id of ['quickstep', 'backstep', 'stomp']) {
    const sources = tagging.filter(t => t.family === 'card' && t.objectId === id && t.tagId.startsWith('source:')).map(t => t.tagId);
    assert.deepEqual(sources, ['source:unarmed']);
  }
});

test('offering grades remain nonlethal and preserve the payment at every advanced grade', () => {
  for (const name of ['Blood Censer', 'Ember Tithe', 'Crown of Scars']) {
    const card = byName(name);
    for (const p of card.gradeProfiles) {
      if (p.rank < 2) assert(!p.effects.some(e => e.op === 'loseHp'));
      else assert.deepEqual({ ...p.effects[0] }, { op: 'loseHp', target: 'self', amount: name === 'Blood Censer' ? 2 : 3, nonlethal: true, offering: true });
    }
  }
});

test('shared utility lessons retain utility without invented attack primaries', () => {
  assert.equal(abilityCardUpdates.length, 42);
  for (const id of ['scholarsInsight', 'readTheAsh', 'gravityWell', 'gildedOath', 'reclamation', 'warcry', 'feint', 'perfectHeist']) {
    const card = abilityCardUpdates.find(c => c.id === id);
    assert(card);
    for (const p of card.gradeProfiles) assert(!p.effects.some(e => e.op === 'damage'), id);
  }
});

test('legacy existing faces keep their prior cost and effect recipes for explicit migration', () => {
  for (const c of abilityCardUpdates) {
    assert(c.legacyFace.effects.length > 0, c.id);
    assert.equal(typeof c.legacyFace.textTemplate, 'string');
  }
  assert.equal(abilityCardUpdates.find(c => c.id === 'kickOff').legacyFace.cost, 0);
  assert.equal(abilityCardUpdates.find(c => c.id === 'kickOff').manaCost, 1);
  assert.equal(abilityCardUpdates.find(c => c.id === 'starShower').legacyFace.manaCost, 0);
  assert.equal(abilityCardUpdates.find(c => c.id === 'starShower').manaCost, 2);
});
