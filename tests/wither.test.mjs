// Wither N (SPEC §4.3): each copy exhausts on its Nth play this fight; the count resets each fight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { botCardTargetId } from '../tools/simbot.mjs';
import { cardFaceLines, WitherFaceCount } from '../src/model/cardFaceText.js';
import { destinationAfterPlay } from '../src/framework/lifecycle.js';

function fixture(definition = {}) {
  const base = createRegistries(contentBundle);
  const card = { ...base.cards.get('defend'), gradeProfiles: undefined, abilityRank: undefined, legacyFace: undefined, name: 'Wither fixture', costRule: 'fixed', cost: 0, manaCost: 0, effects: [{ op: 'block', target: 'self', amount: 1 }], upgrade: {}, wither: 3, ...definition };
  const registries = { ...base, cards: { ...base.cards, get: id => id === 'defend' ? card : base.cards.get(id) } };
  const player = { id: 'p1', classId: 'herald', maxHp: 80, hp: 80, maxMana: 20, mana: 20, maxStamina: 20, stamina: 20, energyMax: 20, drawPerTurn: 2, relicIds: [], deck: [0, 1, 2, 3].map(i => ({ instanceId: `w${i}`, cardId: 'defend', upgraded: false })) };
  const combat = createCombat({ registries, rng: createRng(4), player, enemyIds: ['wanderingSoldier'] });
  for (const enemy of combat.enemies) { enemy.hp = enemy.maxHp = 1000; }
  return { combat, registries, player };
}
// Plays the copy `id`, pulling it back into hand first from wherever it went.
function playCopy(combat, id) {
  for (const pile of Object.values(combat.piles)) {
    if (pile === combat.piles.hand || !Array.isArray(pile)) continue;
    const at = pile.findIndex(c => c.instanceId === id);
    if (at >= 0) combat.piles.hand.unshift(pile.splice(at, 1)[0]);
  }
  const inst = combat.piles.hand.find(c => c.instanceId === id);
  dispatch(combat, { type: 'playCard', cardInstanceId: id, targetId: botCardTargetId(combat.registries, combat, inst, combat.enemies[0].id) });
}
const inExhaust = (combat, id) => combat.piles.exhaust.some(c => c.instanceId === id);

test('Wither 3 exhausts a copy on its third play, not before, with reason withered', () => {
  const { combat } = fixture();
  const id = combat.piles.hand[0].instanceId;
  playCopy(combat, id); assert.equal(inExhaust(combat, id), false);
  playCopy(combat, id); assert.equal(inExhaust(combat, id), false);
  playCopy(combat, id); assert.equal(inExhaust(combat, id), true);
  assert.ok(combat.eventLog.some(e => e.type === 'cardExhausted' && e.cardInstanceId === id && e.reason === 'withered'));
});

test('two copies count their own plays', () => {
  const { combat } = fixture();
  const [a, b] = combat.piles.hand.slice(0, 2).map(c => c.instanceId);
  playCopy(combat, a); playCopy(combat, a); playCopy(combat, b);
  assert.equal(inExhaust(combat, a), false); assert.equal(inExhaust(combat, b), false);
  playCopy(combat, a);
  assert.equal(inExhaust(combat, a), true); assert.equal(inExhaust(combat, b), false);
});

test('Wither resets next fight', () => {
  const { combat, registries, player } = fixture({ wither: 1 });
  const id = combat.piles.hand[0].instanceId;
  playCopy(combat, id); assert.equal(inExhaust(combat, id), true);
  const next = createCombat({ registries, rng: createRng(5), player, enemyIds: ['wanderingSoldier'] });
  assert.equal(next.player.abilityRiders?.instanceUsesCombat?.[id] || 0, 0);
  assert.equal(next.piles.exhaust.length, 0);
});

test('Exhaust keeps precedence over Wither', () => {
  const { combat } = fixture({ keywords: ['exhaust'] });
  const id = combat.piles.hand[0].instanceId;
  playCopy(combat, id);
  assert.ok(combat.eventLog.some(e => e.type === 'cardExhausted' && e.cardInstanceId === id && e.reason === 'played'));
});

test('framework lifecycle sends a withered card to the Exhaust pile', () => {
  const view = { id: 'x', properties: [] };
  assert.equal(destinationAfterPlay(view, { cancelled: false, legal: true }), 'DISCARD_PILE');
  assert.equal(destinationAfterPlay(view, { cancelled: false, legal: true }, { withered: true }), 'EXHAUST_PILE');
});

test('the face shows Wither with the remaining plays in combat, else the authored count', () => {
  const { combat, registries } = fixture();
  const def = registries.cards.get('defend');
  const id = combat.piles.hand[0].instanceId;
  assert.equal(WitherFaceCount(def), 3);
  playCopy(combat, id);
  assert.equal(WitherFaceCount(def, combat, id), 2);
  const text = (cardFaceLines(def, null, registries, combat, { instanceId: id }) || []).map(l => l.html).join(' ');
  assert.match(text.replace(/<[^>]+>/g, ''), /Wither 2/);
  assert.equal(WitherFaceCount({ ...def, wither: undefined }), null);
});
