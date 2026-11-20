// Stat-buff cards exhaust (owner, 2026-11-19; SPEC §4.8b "Stat-buff cards exhaust"). Every player card that grants Strength or
// Dexterity carries Exhaust on its base face, and its upgrade removes Exhaust while keeping whatever the upgrade already did.
// Profiles are pinned: the dev profile saved before this change (71c50c95) keeps its original card definitions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, projectGameCard, validateGameProfileSnapshot } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch } from '../src/engine/combat.js';

const registriesFor = profile => bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const current = resolveGameProfile('default');
const registries = registriesFor(current);

export const STAT_BUFF_CARDS = Object.freeze({
  steelResolve: 'reaver', ironHide: 'reaver', zealousFervor: 'herald', keenEdge: 'rogue', innerOrbit: 'starseer',
  'base.stat-buff': 'reaver', 'base.buff-ally': 'reaver', 'core.stormBlessing': 'starseer',
});
const STATS = new Set(['strength', 'dexterity']);
const upgraded = cardId => ({ instanceId: `u-${cardId}`, cardId, upgraded: true });

/** Every effect of a card, nested branches included. */
function effectsOf(node, out = []) {
  if (Array.isArray(node)) { for (const item of node) effectsOf(item, out); return out; }
  if (!node || typeof node !== 'object') return out;
  if (node.op) out.push(node);
  for (const [key, value] of Object.entries(node)) if (key !== 'upgrade' && typeof value === 'object') effectsOf(value, out);
  return out;
}
const grantsStat = def => effectsOf(def.effects).some(effect => effect.op === 'applyStatus' && STATS.has(effect.status)
  && ['self', 'ally', 'player', undefined].includes(effect.target));

test('the stat-buff list is exactly the player cards in the Core profile that grant Strength or Dexterity', () => {
  const enemyCardIds = new Set((current.content.enemyCards || []).map(card => card.id));
  const found = current.content.cards.filter(def => !enemyCardIds.has(def.id) && grantsStat(def)).map(def => def.id).sort();
  assert.deepEqual(found, Object.keys(STAT_BUFF_CARDS).sort());
});

test('each stat-buff card exhausts at base, and its upgrade removes Exhaust and keeps the rest of the upgrade', () => {
  for (const cardId of Object.keys(STAT_BUFF_CARDS)) {
    const base = projectGameCard(registries, cardId);
    const plus = projectGameCard(registries, upgraded(cardId));
    assert.ok(base.keywords.includes('exhaust'), `${cardId} exhausts at base`);
    assert.match(base.textTemplate, /Exhaust\.$/, `${cardId} base text says Exhaust`);
    assert.ok(!plus.keywords.includes('exhaust'), `${cardId}+ does not exhaust`);
    assert.doesNotMatch(plus.textTemplate, /Exhaust/, `${cardId}+ text drops Exhaust`);
  }
  // The upgrades' earlier benefits stay.
  assert.equal(projectGameCard(registries, upgraded('steelResolve')).staminaCost, 1);
  assert.equal(projectGameCard(registries, upgraded('ironHide')).staminaCost, 0);
  assert.equal(projectGameCard(registries, upgraded('innerOrbit')).manaCost, 1);
  assert.equal(effectsOf(projectGameCard(registries, upgraded('core.stormBlessing')).effects).find(e => e.status === 'dexterity').stacks, 2);
  for (const cardId of ['zealousFervor', 'keenEdge']) {
    assert.ok(projectGameCard(registries, cardId).keywords.includes('ethereal'));
    assert.deepEqual(projectGameCard(registries, upgraded(cardId)).keywords, []);
  }
});

function fight(reg, classId) {
  const run = createRunState({ registries: reg, classId, seed: 433, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  const combat = createRunCombat({ registries: reg, run, rng: createRng(433), enemyIds: ['wanderingSoldier'] });
  delete combat.reactionRules.contactPolicy;
  Object.assign(combat.player, { hp: 999, maxHp: 999, energy: 99, stamina: 99, maxStamina: 99, mana: 99, maxMana: 99, statuses: {} });
  dispatch(combat, { type: 'setReactions', enabled: false });
  return combat;
}
const pileOf = (combat, instanceId) => Object.entries(combat.piles).find(([, pile]) => Array.isArray(pile) && pile.some(card => card.instanceId === instanceId))?.[0];
function playFromHand(combat, card) {
  combat.piles.hand.push(card);
  dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId });
  return pileOf(combat, card.instanceId);
}

test('played in a Core fight, a base stat-buff card goes to the exhaust pile and its upgrade goes to discard', () => {
  for (const [cardId, classId] of Object.entries(STAT_BUFF_CARDS)) {
    if (cardId === 'base.buff-ally') continue; // needs an ally to be playable; covered by the definition test above
    const base = fight(registries, classId);
    assert.equal(playFromHand(base, { instanceId: `b-${cardId}`, cardId }), 'exhaust', `${cardId} exhausts when played`);
    const plus = fight(registries, classId);
    assert.equal(playFromHand(plus, upgraded(cardId)), 'discard', `${cardId}+ is discarded, not exhausted`);
  }
});

test('the dev profile saved before this change keeps its original stat-buff definitions', () => {
  const archived = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/dev-profile-71c50c95.json.gz', import.meta.url))));
  const archivedBefore = structuredClone(archived);
  const saved = validateGameProfileSnapshot(archived);
  assert.equal(saved.hash, 'sha256:71c50c95263d9fc671863a691fb6ffb7e4f621531e73eb4d98b0c1866a426bdf');
  assert.notEqual(current.hash, saved.hash, 'the change is a new profile');
  const reg = registriesFor(saved);
  // Before the change only Steel Resolve and Inner Orbit exhausted, and both kept Exhaust when upgraded.
  const exhaustedBefore = new Set(['steelResolve', 'innerOrbit']);
  for (const cardId of Object.keys(STAT_BUFF_CARDS)) {
    const base = projectGameCard(reg, cardId), plus = projectGameCard(reg, upgraded(cardId));
    assert.equal(base.keywords.includes('exhaust'), exhaustedBefore.has(cardId), `saved ${cardId} base Exhaust unchanged`);
    assert.equal(plus.keywords.includes('exhaust'), exhaustedBefore.has(cardId), `saved ${cardId}+ Exhaust unchanged`);
  }
  const combat = fight(reg, 'reaver');
  assert.equal(playFromHand(combat, { instanceId: 'saved-ironHide', cardId: 'ironHide' }), 'discard', 'a saved Iron Hide is still discarded');
  assert.deepEqual(archived, archivedBefore, 'loading leaves the archived profile untouched');
});
