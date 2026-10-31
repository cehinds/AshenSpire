import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, projectGameCard } from '../src/model/gameProfile.js';
import { stanceStaminaCost } from '../src/model/stanceRules.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { playingCardModel } from '../src/model/playingCard.js';
import { upgradeBasic } from '../src/model/cardUpgradeLimits.js';
import { validateRunShape } from '../src/model/state.js';
import { loadAuditRuntime } from '../tools/combat-audit/runtime.mjs';
import { makeAuditCombat } from '../tools/combat-audit/fixtures.mjs';

const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const api = { ...await loadAuditRuntime('native'), registries };
const classId = registries.classes.all()[0].id;
const cards = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8'));
const NEW = ['core.flick', 'core.pebbleThrow', 'core.brace', 'core.quickGuard', 'core.whetstoneNick', 'core.temperedEdge'];

/** Play `plays` copies of one card in a row and report what the card itself dealt or gave each time. */
function play(cardId, { upgraded = false, playsEver = 0, plays = 2 } = {}) {
  const make = i => ({ cardId, instanceId: `ramp:${i}`, upgraded, ...(playsEver ? { playsEver } : {}) });
  const { combat } = makeAuditCombat(api, { classId, enemyIds: ['wanderingSoldier'], relicIds: [], instance: make(0),
    cardInstances: Array.from({ length: plays - 1 }, (_, i) => make(i + 1)),
    profileMeta: { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['a', 'b', 'c'] } } } });
  const rows = [];
  for (let i = 0; i < plays; i++) {
    const instance = combat.piles.hand.find(card => card.cardId === cardId);
    const def = projectGameCard(combat, instance);
    const costs = api.cardPlayCosts(combat, instance.instanceId);
    const enemy = combat.enemies[0];
    const block = combat.player.block, from = combat.eventLog.length;
    api.dispatch(combat, { type: 'playCard', cardInstanceId: instance.instanceId, targetId: def.type === 'attack' ? enemy.id : combat.player.id });
    const hit = combat.eventLog.slice(from).find(event => event.type === 'damageDealt');
    rows.push({ name: def.name, tags: def.cardTags || def.tags, costs, base: hit ? hit.damageReceipt.hits[0].sources[0].amount : null, block: combat.player.block - block });
  }
  return { rows, combat };
}

test('every zero-cost Core card is fixed-price, uncommon or rare, and neither a cantrip nor a Basic', () => {
  const zero = cards.filter(card => card.staminaCost === 0 && card.manaCost === 0 && card.cost === 0 && card.rarity !== 'starter');
  assert.deepEqual(zero.map(card => card.id).sort(), [...NEW].sort());
  for (const card of cards.filter(row => row.ramp || row.upgrade?.ramp || row.cost === 0 && row.rarity !== 'starter')) assert.equal(card.costRule, 'fixed', card.id);
  for (const card of zero) {
    assert.ok(['uncommon', 'rare'].includes(card.rarity), card.id);
    assert.equal(card.tags.includes('rank.cantrip'), false, card.id);
    assert.equal(upgradeBasic(card), false, `${card.id} is not Basic`);
  }
});

test('the same-stance SP bonus never touches a zero-cost card, in any stance', () => {
  const { combat } = play('core.flick', { plays: 1 });
  for (const maneuver of ['attack', 'defend', 'counter', 'smash', 'sweep']) {
    const entity = { ...combat.player, combatStance: { maneuver, camp: 'physical', range: 'melee' } };
    for (const id of NEW) {
      const carrier = { ...projectGameCard(combat, id), combatStance: entity.combatStance };
      assert.equal(stanceStaminaCost(0, entity, carrier, combat), 0, `${id} in ${maneuver}`);
    }
  }
  for (const id of NEW) for (const upgraded of [false, true]) {
    const { rows } = play(id, { upgraded, plays: 2 });
    for (const row of rows) assert.deepEqual([row.costs.stamina, row.costs.mana], [0, 0], `${id}${upgraded ? '+' : ''}`);
  }
});

test('Momentum: an upgraded Flick adds 1 per earlier play this fight, and the tag arrives with the upgrade', () => {
  const base = play('core.flick').rows;
  assert.deepEqual(base.map(row => row.base), [3, 3], 'the plain Flick does not ramp');
  assert.equal((base[0].tags || []).includes('ramp.momentum'), false);
  const up = play('core.flick', { upgraded: true, plays: 3 }).rows;
  assert.deepEqual(up.map(row => row.base), [3, 4, 5]);
  assert.ok(up[0].tags.includes('ramp.momentum'));
  assert.equal(up[0].name, 'Flick+');
});

test('Momentum: Brace+ ramps Block by 1 per play', () => {
  const brace = play('core.brace', { upgraded: true, plays: 3 }).rows.map(row => row.block);
  assert.equal(brace[1] - brace[0] >= 1, true);
  const flat = play('core.brace', { plays: 3 }).rows.map(row => row.block);
  assert.ok(brace[2] - brace[0] > flat[2] - flat[0], 'the upgraded Brace out-grows the plain one');
});

test('Honed: playsEver 3 adds 3 on the first play of a fight and 1 more on the second', () => {
  const nick = play('core.whetstoneNick', { playsEver: 3 }).rows;
  assert.deepEqual(nick.map(row => row.base), [5, 6]);
  assert.ok(nick[0].tags.includes('ramp.honed'));
  assert.deepEqual(play('core.whetstoneNick', { playsEver: 0 }).rows.map(row => row.base), [2, 3], 'a fresh copy starts at its base');
  assert.deepEqual(play('core.whetstoneNick', { upgraded: true, playsEver: 3 }).rows.map(row => row.base), [6, 7]);
  const edge = play('core.temperedEdge', { upgraded: true, playsEver: 3 }).rows;
  assert.deepEqual(edge.map(row => row.base), [7, 9], 'per 2: 1 + 3x2, then +2');
  assert.ok(edge[0].tags.includes('ramp.honed'), 'the upgrade that adds the ramp adds the tag');
  assert.deepEqual(play('core.temperedEdge', { playsEver: 3 }).rows.map(row => row.base), [1, 1], 'the plain Tempered Edge never ramps');
});

test('plain upgrades raise the numbers: Pebble Throw 2 to 4, Quick Guard 3 to 5, Whetstone Nick 2 to 3', () => {
  const amount = (id, upgraded, op) => projectGameCard({ ...registries, gameProfile: profile }, { cardId: id, instanceId: 'x', upgraded }).effects.find(effect => effect.op === op).amount;
  assert.equal(amount('core.pebbleThrow', false, 'damage'), 2);
  assert.equal(amount('core.pebbleThrow', true, 'damage'), 4);
  assert.equal(amount('core.quickGuard', false, 'block'), 3);
  assert.equal(amount('core.quickGuard', true, 'block'), 5);
  assert.equal(projectGameCard({ ...registries, gameProfile: profile }, { cardId: 'core.whetstoneNick', instanceId: 'x', upgraded: false }).effects[0].amount.args[0], 2);
  assert.equal(projectGameCard({ ...registries, gameProfile: profile }, { cardId: 'core.whetstoneNick', instanceId: 'x', upgraded: true }).effects[0].amount.args[0], 3);
});

test('a card face reads the ramp as plain words', () => {
  const subject = { ...registries, gameProfile: profile };
  const html = ref => (cardFaceLines(projectGameCard(subject, ref), null, registries) || []).map(line => line.html.replace(/<[^>]+>/g, '')).join(' | ');
  assert.match(html({ cardId: 'core.flick', instanceId: 'x', upgraded: true }), /^3 damage.*\+1 damage per play this combat$/);
  assert.match(html({ cardId: 'core.brace', instanceId: 'x', upgraded: true }), /Gain 2 Block \| \+1 Block per play this combat$/);
  assert.match(html({ cardId: 'core.whetstoneNick', instanceId: 'x', playsEver: 3 }), /^5 damage.*\+1 damage per play this run$/);
  assert.doesNotMatch(html({ cardId: 'core.flick', instanceId: 'x' }), /per play/);
});

test('the tag rail names Momentum and Honed once and adds no classification words', () => {
  const labels = ref => playingCardModel(registries, { instanceId: 'x', ...ref }).tags.map(tag => tag.label);
  assert.deepEqual(labels({ cardId: 'core.whetstoneNick', playsEver: 3 }), ['Physical', 'Attack', 'exhaust', 'Honed']);
  assert.deepEqual(labels({ cardId: 'core.brace', upgraded: true }), ['Physical', 'Defend', 'Momentum']);
  assert.deepEqual(labels({ cardId: 'core.brace' }), ['Physical', 'Defend']);
});

test('playsEver is a saved, validated deck field', () => {
  const { run } = makeAuditCombat(api, { classId, enemyIds: ['wanderingSoldier'], relicIds: [] });
  run.deck[0].playsEver = 4;
  assert.equal(validateRunShape(run).filter(problem => /playsEver/.test(problem)).length, 0);
  const restored = JSON.parse(JSON.stringify(run));
  assert.equal(restored.deck[0].playsEver, 4, 'survives a save round trip');
  run.deck[0].playsEver = -1;
  assert.ok(validateRunShape(run).some(problem => /playsEver/.test(problem)));
});
