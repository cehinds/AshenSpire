// Frost-Exposed / Unraveled (SPEC §4.4, #61) raise only the damage of hits
// whose card carries a matching tag. The tag comes from content/source/
// tagging.csv alone, the exposure row declares `taggedVulnerability`, and the
// generic damage resolver reads it: no per-status engine code. These checks
// play SHIPPED cards on the SHIPPED registry (not the legacy fixture bundle),
// solo and co-op, so a break anywhere along card tag -> hit tags -> resolver
// shows here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createCoopCombat, playCard } from '../src/engine/coopCombat.js';
import { createRng } from '../src/engine/rng.js';
import { applyStatus } from '../src/engine/statuses.js';

const shipped = createRegistries(contentBundle);
// Every shipped blight card is also ritual, so the blight arm re-tags one
// ritual card as blight only. The tag lives in a tagging row, nowhere else.
const blightOnly = createRegistries({ ...contentBundle,
  tagging: contentBundle.tagging.map((row) => row.family === 'card' && row.objectId === 'cinderLance' && row.tagId === 'ritual'
    ? { ...row, tagId: 'blight' } : row),
});

const cardTags = (registries, id) => registries.cards.get(id).tags || [];
const player = (cardId) => ({ classId: 'reaver', maxHp: 200, hp: 200, maxMana: 99, mana: 99,
  energyMax: 10, drawPerTurn: 1, deck: [{ instanceId: 'card1', cardId }], relicIds: [] });
const hitsOn = (combat, enemyId) => combat.eventLog
  .filter((e) => e.type === 'damageDealt' && e.targetId === enemyId && e.sourceId !== enemyId)
  .map((e) => e.amount);

function solo(registries, cardId, status) {
  const c = createCombat({ registries, rng: createRng(50), player: player(cardId), enemyIds: ['wanderingSoldier'] });
  const enemy = c.enemies[0];
  if (status) applyStatus(c, enemy, status, 1);
  const preview = previewCard(c, 'card1', enemy.id).values.find((v) => v.op === 'damage').value;
  dispatch(c, { type: 'playCard', cardInstanceId: 'card1', targetId: enemy.id });
  return { preview, hits: hitsOn(c, enemy.id) };
}

function coop(registries, cardId, status) {
  const c = createCoopCombat({ registries, rng: createRng(50), players: [{ id: 'p1', ...player(cardId) }],
    enemyIds: ['wanderingSoldier'], ratingsRules: null });
  const enemy = c.enemies[0];
  if (status) applyStatus(c, enemy, status, 1);
  playCard(c, 'p1', 'card1', enemy.id);
  return { hits: hitsOn(c, enemy.id) };
}

// [label, registries, card, tag the card must carry (null = must carry none of
// the exposure tags), exposure status]
const cases = [
  ['starstone vs Frost-Exposed', shipped, 'starlance', 'starstone', 'frostExposed'],
  ['ritual vs Unraveled', shipped, 'cinderLance', 'ritual', 'insanityExposed'],
  ['blight vs Unraveled', blightOnly, 'cinderLance', 'blight', 'insanityExposed'],
];

for (const [label, registries, cardId, tag, status] of cases) {
  test(`${label}: ${cardId} hits harder, in preview, solo and co-op`, () => {
    assert.ok(cardTags(registries, cardId).includes(tag), `${cardId} carries '${tag}' from tagging.csv`);
    if (tag === 'blight') assert.ok(!cardTags(registries, cardId).includes('ritual'), 'blight arm is blight alone');
    const clean = solo(registries, cardId, null);
    const exposed = solo(registries, cardId, status);
    assert.equal(clean.hits.length, 1);
    assert.equal(exposed.hits.length, 1);
    assert.ok(exposed.hits[0] > clean.hits[0], `${status} raises ${tag} damage (${clean.hits[0]} -> ${exposed.hits[0]})`);
    assert.equal(exposed.preview, exposed.hits[0], 'preview states the boosted hit');
    assert.equal(clean.preview, clean.hits[0], 'preview states the clean hit');
    assert.deepEqual(coop(registries, cardId, null).hits, clean.hits, 'co-op parity, clean');
    assert.deepEqual(coop(registries, cardId, status).hits, exposed.hits, 'co-op parity, exposed');
  });
}

test('untagged Strike deals the same to Frost-Exposed, Unraveled and clean targets', () => {
  const tags = cardTags(shipped, 'strike');
  for (const t of ['starstone', 'ritual', 'blight']) assert.ok(!tags.includes(t), `strike carries no '${t}'`);
  const clean = solo(shipped, 'strike', null).hits;
  assert.ok(clean[0] > 0);
  assert.deepEqual(solo(shipped, 'strike', 'frostExposed').hits, clean);
  assert.deepEqual(solo(shipped, 'strike', 'insanityExposed').hits, clean);
  assert.deepEqual(coop(shipped, 'strike', 'frostExposed').hits, clean);
});

test('each exposure answers only its own tags', () => {
  // Starstone ignores Unraveled; ritual ignores Frost-Exposed.
  assert.deepEqual(solo(shipped, 'starlance', 'insanityExposed').hits, solo(shipped, 'starlance', null).hits);
  assert.deepEqual(solo(shipped, 'cinderLance', 'frostExposed').hits, solo(shipped, 'cinderLance', null).hits);
});
