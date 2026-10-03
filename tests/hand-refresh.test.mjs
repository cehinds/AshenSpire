import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createCoopCombat, endTurn } from '../src/engine/coopCombat.js';
import { createRunState } from '../src/model/state.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { handStatRows } from '../src/model/statRows.js';
import { resolveHandRules, handDrawCount, handRulesProblems } from '../src/model/handRules.js';
import { drawCards } from '../src/engine/actions.js';

const registries = createRegistries(contentBundle);
const card = (id, cardId = 'strike', upgraded = false) => ({ instanceId: id, cardId, upgraded });
const ids = cards => cards.map(c => c.instanceId);
const rules = () => resolveHandRules({}, handStatRows(registries, null));
function fight(options = {}) {
  return createCombat({ registries, rng: createRng(2309), handRules: rules(),
    player: { classId: 'reaver', maxHp: 10000, hp: 10000, maxMana: 10, mana: 10,
      maxStamina: 10, stamina: 10, energyMax: 3, drawPerTurn: 4, attributes: { intelligence: 4 },
      deck: Array.from({ length: 30 }, (_, i) => card(`c${i}`)), relicIds: [] },
    enemyIds: ['wanderingSoldier'], ...options,
  });
}

for (const [retained, draw, actual] of [[0,4,4],[2,4,4],[6,4,4],[12,4,3],[8,6,6],[15,6,0]]) {
  test(`${retained} retained + draw ${draw} draws ${actual} within the absolute cap`, () => {
    const c = fight();
    c.handRules.rows.draw.base = draw;
    c.piles.draw.push(...c.piles.hand);
    c.piles.hand = Array.from({ length: retained }, (_, i) => card(`r${i}`, 'urgentHeal'));
    const counters = c.rng.getCounters().shuffle;
    dispatch(c, { type: 'endTurn' });
    assert.equal(c.piles.hand.length, retained + actual);
    for (let i = 0; i < retained; i++) assert(ids(c.piles.hand).includes(`r${i}`));
    assert.equal(c.rng.getCounters().shuffle, counters, 'an all-Retain hand does not shuffle');
    assert.equal(c.piles.discard.length, 0);
  });
}

test('refresh shuffles ordinary unplayed cards, keeps Retain, exhausts Ethereal, and leaves played discards alone', () => {
  const c = fight();
  c.piles.draw.push(...c.piles.hand);
  c.piles.hand = [card('ordinary'), card('prepared', 'urgentHeal'), card('ethereal', 'lastStand')];
  c.piles.discard = [card('played')];
  const before = c.rng.getCounters().shuffle;
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.piles.hand.length, 5);
  assert(ids(c.piles.hand).includes('prepared'));
  assert(ids([...c.piles.draw, ...c.piles.hand]).includes('ordinary'));
  assert.deepEqual(ids(c.piles.discard), ['played']);
  assert.deepEqual(ids(c.piles.exhaust), ['ethereal']);
  assert(c.rng.getCounters().shuffle > before);
  const all = ids(Object.values(c.piles).flat());
  assert.equal(new Set(all).size, all.length, 'no card duplicates across zones');
});

test('every added Retain keyword survives upgrades; playing a retained spell still leaves the hand', () => {
  const spells = contentBundle.cards.filter(c => ['herald','starseer'].includes(c.class) && c.keywords.includes('retain'));
  assert.equal(spells.length, 31);
  for (const spell of spells) for (const upgraded of [false, true]) {
    const def = resolveCard(registries, card('spell', spell.id, upgraded));
    assert.equal(registries.framework.endTurnFate(def), 'keep', `${spell.id} upgraded=${upgraded}`);
  }
  const c = fight();
  c.piles.hand = [card('heal', 'urgentHeal'), card('phoenix', 'phoenixChart')];
  dispatch(c, { type: 'playCard', cardInstanceId: 'heal' });
  assert(ids(c.piles.discard).includes('heal'));
  dispatch(c, { type: 'playCard', cardInstanceId: 'phoenix' });
  assert(ids(c.piles.exhaust).includes('phoenix'));
});

test('draw scaling is unchanged and the absolute capacity does not scale', () => {
  for (const [intelligence, expected] of [[1,4],[4,4],[8,4],[9,5],[14,6],[99,10]]) {
    const r = rules();
    for (const opening of [false, true]) {
      const draw = handDrawCount(r, { intelligence }, { opening });
      assert.equal(draw.value, expected);
      assert.equal(draw.capacity, 15);
    }
  }
  const c = fight();
  c.piles.hand = Array.from({ length: 15 }, (_, i) => card(`r${i}`, 'urgentHeal'));
  const before = structuredClone(c.piles.draw);
  drawCards(c, 20);
  assert.equal(c.piles.hand.length, 15);
  assert.deepEqual(c.piles.draw, before, 'bonus draw cannot consume cards past the cap');
});

test('new shuffle mode round-trips with the run RNG; old snapshots keep discard behaviour', () => {
  const c = fight();
  const snapshot = serializeCombatSnapshot(c);
  const restored = restoreCombatSnapshot({ registries, rng: createRng(c.rng.seed, c.rng.getCounters()), snapshot });
  for (let turn = 0; turn < 3; turn++) {
    dispatch(c, { type: 'endTurn' });
    dispatch(restored, { type: 'endTurn' });
    assert.deepEqual(restored.piles, c.piles);
    assert.deepEqual(restored.rng.getCounters(), c.rng.getCounters());
  }
  delete snapshot.handRules.shuffleHand;
  const old = restoreCombatSnapshot({ registries, rng: createRng(2309), snapshot });
  const unplayed = ids(old.piles.hand);
  dispatch(old, { type: 'endTurn' });
  assert.deepEqual(ids(old.piles.discard), unplayed);
  snapshot.handRules.shuffleHand = 'yes';
  assert(handRulesProblems(snapshot.handRules).some(p => p.includes('shuffleHand')));
});

test('Play in deck order returns ordinary cards without consuming shuffle RNG', () => {
  const c = fight({ orderedDraw: true });
  const unplayed = ids(c.piles.hand);
  const before = c.rng.getCounters().shuffle;
  dispatch(c, { type: 'endTurn' });
  assert.equal(c.rng.getCounters().shuffle, before);
  assert.deepEqual(ids(c.piles.draw).slice(-unplayed.length), unplayed);
});

test('forced overflow discards stay discarded during a shuffle refresh', () => {
  const c = fight();
  c.piles.hand = Array.from({ length: 16 }, (_, i) => card(`r${i}`, 'urgentHeal'));
  assert.throws(() => dispatch(c, { type: 'endTurn' }));
  dispatch(c, { type: 'endTurn', discardIds: ['r15'] });
  assert.equal(c.piles.hand.length, 15);
  assert.deepEqual(ids(c.piles.discard), ['r15']);
});

test('an exhausted draw supply deals only available cards without duplicating Retain', () => {
  const c = fight();
  c.piles.hand = [card('kept', 'urgentHeal'), card('ordinary')];
  c.piles.draw = [];
  c.piles.discard = [];
  dispatch(c, { type: 'endTurn' });
  assert.deepEqual(ids(c.piles.hand).sort(), ['kept', 'ordinary']);
  assert.equal(c.piles.draw.length, 0);
});

test('each co-op seat refreshes its own cards and respects the 15-card cap', () => {
  const players = ['reaver','herald'].map((classId, i) => {
    const run = createRunState({ seed: 5, classId, registries });
    return { ...run, id: `p${i}`, classId, hp: 10000, maxHp: 10000,
      deck: Array.from({ length: 25 }, (_, n) => card(`p${i}c${n}`)), relicIds: [], flasks: [] };
  });
  const c = createCoopCombat({ registries, rng: createRng(5), players, enemyIds: ['wanderingSoldier'] });
  for (const [id, p] of c.players) {
    p.piles.draw.push(...p.piles.hand);
    const retained = id === 'p0' ? 2 : 16;
    p.piles.hand = [...Array.from({ length: retained }, (_, i) => card(`${id}r${i}`, 'urgentHeal')), card(`${id}ordinary`)];
  }
  endTurn(c, 'p0');
  endTurn(c, 'p1');
  for (const [id, p] of c.players) {
    assert.equal(p.piles.hand.length, id === 'p0' ? 6 : 15);
    assert.equal(p.piles.discard.length, id === 'p0' ? 0 : 1);
    if (id === 'p1') assert.deepEqual(ids(p.piles.discard), ['p1r15']);
    assert(ids(Object.values(p.piles).flat()).every(cid => cid.startsWith(id)), 'no cross-seat cards');
  }
});
