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
import { resolveDamageComponents, taggedBonusFloor } from '../src/model/combatRules.js';
import { combatRules as foundationRules } from '../src/content/combatRules.js';
import { prototypeInput, prototypeBundle } from '../src/content/prototypes/combatBuilds.js';

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

// Owner, 2026-10-12 (#12): the exposure bonus rounds UP. Under floor a
// base-3 card gained nothing (3 × 1.25 = 3.75 -> 3); rounded up it gains 1.
// Regular Vulnerable keeps its floor.
const lowBase = [
  ['starbladePhalanx', 'starstone', 'frostExposed'],
  ['ashenMote', 'ritual', 'insanityExposed'],
  ['blightTouch', 'ritual', 'insanityExposed'],
];
for (const [cardId, tag, status] of lowBase) {
  test(`exposure bonus rounds up: base-3 ${cardId} (${tag}) gains damage vs ${status}, preview == hit, solo == co-op`, () => {
    assert.ok(cardTags(shipped, cardId).includes(tag), `${cardId} carries '${tag}'`);
    const base = shipped.cards.get(cardId).effects.find((e) => e.op === 'damage').amount;
    assert.equal(base, 3, `${cardId} is a base-3 hit`);
    const clean = solo(shipped, cardId, null);
    const exposed = solo(shipped, cardId, status);
    assert.equal(clean.hits[0], 3);
    assert.equal(exposed.hits[0], 4, `ceil(3 × 0.25) = 1 bonus (${clean.hits[0]} -> ${exposed.hits[0]})`);
    assert.equal(exposed.preview, exposed.hits[0], 'preview states the rounded-up hit');
    assert.deepEqual(coop(shipped, cardId, status).hits, exposed.hits, 'co-op parity');
  });
}

test('foundation damage resolver rounds the tagged bonus up too, and never below the old all-floor result', () => {
  assert.deepEqual(resolveDamageComponents(foundationRules, { components: [{ type: 'arcane', amount: 3 }], taggedBonus: 1.25 }),
    [{ type: 'arcane', amount: 4 }]);
  assert.deepEqual(resolveDamageComponents(foundationRules, { components: [{ type: 'arcane', amount: 3 }] }),
    [{ type: 'arcane', amount: 3 }]);
  for (let x = 0; x <= 40; x += 0.1) {
    assert.ok(taggedBonusFloor(x, 1.25) >= Math.floor(x * 1.25), `x=${x}`);
    assert.equal(taggedBonusFloor(x, 1), Math.floor(x));
  }
});

test('a multi-component hit rounds its exposure bonus up once per hit, not once per component', () => {
  // 2 slashing + 2 fire at ×1.25: plain 4, bonus ceil(4 × 0.25) = 1 → 5, not 6.
  const split = resolveDamageComponents(foundationRules, { components: [{ type: 'slashing', amount: 2 }, { type: 'fire', amount: 2 }], taggedBonus: 1.25 });
  assert.equal(split.reduce((sum, c) => sum + c.amount, 0), 5);
  assert.deepEqual(split.map((c) => c.type), ['slashing', 'fire']);
  // One component is unchanged: plain floor plus the rounded-up bonus.
  for (let x = 0; x <= 20; x += 0.5) {
    assert.equal(resolveDamageComponents(foundationRules, { components: [{ type: 'arcane', amount: x }], taggedBonus: 1.25 })[0].amount, taggedBonusFloor(x, 1.25), `x=${x}`);
  }
  // Never below the old all-floor total; an immune component takes no share.
  const halves = resolveDamageComponents(foundationRules, { components: [{ type: 'slashing', amount: 1.9 }, { type: 'fire', amount: 1.9 }], taggedBonus: 1.1 });
  assert.ok(halves.reduce((sum, c) => sum + c.amount, 0) >= 2 * Math.floor(1.9 * 1.1));
  assert.deepEqual(resolveDamageComponents(foundationRules, { components: [{ type: 'slashing', amount: 2 }, { type: 'fire', amount: 2 }], taggedBonus: 1.25, immunities: ['fire'] }),
    [{ type: 'slashing', amount: 3 }, { type: 'fire', amount: 0 }]);
});

test('a two-component tagged card hit: preview == hit, bonus rounded once', () => {
  const input = prototypeInput('heavy', 'basic', 1);
  input.combatProfiles.e1 = { ...input.combatProfiles.e1, armor: 0 };
  const bundle = prototypeBundle();
  bundle.cards = bundle.cards.map((c) => c.id === 'prototypeHeavy' ? { ...c, attack: { source: 'weapon', components: [{ type: 'slashing', weight: 1 }, { type: 'fire', weight: 1 }] } } : c);
  bundle.tagging = [...bundle.tagging, { family: 'card', scope: '', objectId: 'prototypeHeavy', tagId: 'starstone' }];
  input.registries = createRegistries(bundle);
  const hit = (exposed) => {
    const c = createCombat(input);
    const enemy = c.enemies[0];
    if (exposed) applyStatus(c, enemy, 'frostExposed', 1);
    let card;
    for (const pile of ['hand', 'draw', 'discard']) {
      const index = c.piles[pile].findIndex((x) => x.cardId === 'prototypeHeavy');
      if (index >= 0) { [card] = c.piles[pile].splice(index, 1); c.piles.hand.push(card); break; }
    }
    const preview = previewCard(c, card.instanceId, enemy.id).values.find((v) => v.op === 'damage').value;
    const dealt = dispatch(c, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id }).events.find((e) => e.type === 'damageDealt');
    return { preview, amount: dealt.amount };
  };
  const clean = hit(false), exposed = hit(true);
  assert.deepEqual(clean, { preview: 10, amount: 10 }, '5 slashing + 5 fire');
  // 10 × 1.25 = 12.5: plain 10 + ceil(2.5) = 13 (per component it was 7 + 7 = 14).
  assert.deepEqual(exposed, { preview: 13, amount: 13 });
});

test('regular Vulnerable still floors: base-3 starbladePhalanx vs Vulnerable deals 4 (3 × 1.5 = 4.5)', () => {
  assert.deepEqual(solo(shipped, 'starbladePhalanx', 'vulnerable').hits, [4]);
});
