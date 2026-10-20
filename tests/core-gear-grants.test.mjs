import test from 'node:test';
import assert from 'node:assert/strict';
import { compileGameProfiles } from '../tools/game-config.mjs';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { applyGameProfileToContent, bindGameProfileRegistries, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { equipPiece, stampDeck, reconcileGrantedCardsInCombat } from '../src/model/loadout.js';
import { moveToSideboard } from '../src/model/deckRules.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { createRng } from '../src/engine/rng.js';

const { catalog, authors } = compileGameProfiles();
const pack = catalog.bundles[authors.core.core].manifest.packs.find(row => row.id === 'ashen.core-content');
const meta = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
const surges = cards => cards.filter(card => card.cardId === 'core.manaSurge');
function fixture(classId, mutate) {
  const copy = structuredClone(catalog);
  mutate(copy.packs[`${pack.id}@${pack.version}`].content.gear);
  const profile = resolveGameAuthor(authors.core, copy);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ registries, classId, seed: 511, profileMeta: meta });
  return { registries, run };
}

for (const [classId, itemId, expected] of [['starseer', 'boneSceptre', 3], ['rogue', 'dagger', 6]]) {
  test(`Core ${classId} grants every authored copy across repeated rows and worn items exactly once`, () => {
    const { registries, run } = fixture(classId, gear => {
      gear.find(row => row.id === itemId).grantedCards = [
        { card: 'core.manaSurge', copies: 1 }, { card: 'core.manaSurge', copies: 2 },
      ];
    });
    const ids = Array.from({ length: expected }, (_, index) => `granted:${itemId}:core.manaSurge:${index}`);
    assert.deepEqual(surges(run.deck).map(card => card.instanceId), ids);
    stampDeck(registries, run); stampDeck(registries, run);
    assert.deepEqual(surges(run.deck).map(card => card.instanceId), ids);
    assert.equal(moveToSideboard(registries, run, ids[0]), true);
    stampDeck(registries, run);
    assert.equal(surges(run.deck).length, expected - 1);
    assert.deepEqual(surges(run.sideboard).map(card => card.instanceId), [ids[0]]);
    const combat = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
    const all = () => Object.values(combat.piles).flat();
    const before = surges(all()).map(card => card.instanceId).sort();
    reconcileGrantedCardsInCombat(registries, run, combat.piles);
    reconcileGrantedCardsInCombat(registries, run, combat.piles);
    assert.equal(before.length, expected - 1);
    assert.equal(new Set(before).size, expected - 1);
    assert.deepEqual(surges(all()).map(card => card.instanceId).sort(), before);
    run.loadout.sets.rightHand[0] = null;
    stampDeck(registries, run);
    assert.equal(surges(run.deck).length + surges(run.sideboard).length, classId === 'rogue' ? 3 : 0);
  });
}

test('Core armour grants resolve the authored source identity, class and owner', () => {
  const { registries, run } = fixture('reaver', gear => {
    gear.find(row => row.id === 'armor.wayfarerPlate').grantedCards = [{ card: 'core.manaSurge', copies: 1 }];
  });
  assert.equal(equipPiece(registries, run.loadout, 'armor', 0, 'wayfarerPlate', { has: () => true },
    { inCombat: false, classId: run.class, attributes: run.attributes }), true);
  stampDeck(registries, run);
  assert.equal(surges(run.deck).length, 1);
  assert.equal(surges(run.deck)[0].grantedBy, 'armor/reaver/wayfarerPlate');
  assert.equal(equipPiece(registries, run.loadout, 'armor', 0, null, { has: () => true },
    { inCombat: false, classId: run.class, attributes: run.attributes }), true);
  stampDeck(registries, run);
  assert.equal(surges(run.deck).length, 0);
});

test('Mana Surge projects for each supported enabled-resource combination', () => {
  for (const include of [['hp', 'sp', 'mp'], ['hp', 'sp'], ['hp', 'mp'], ['hp']]) {
    const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { resources: { include } } });
    const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
    const card = registries.cards.get('core.manaSurge');
    assert.equal(card.staminaCost, include.includes('sp') ? 1 : 0);
    assert.equal(card.manaCost, 0);
    assert.deepEqual(card.effects, [{ op: 'restoreMana', target: 'self', amount: 2 }]);
  }
});

test('Core reconciliation normalizes old duplicate grant ids across saved and combat zones', () => {
  const { registries, run } = fixture('starseer', gear => {
    gear.find(row => row.id === 'boneSceptre').grantedCards = [{ card: 'core.manaSurge', copies: 3 }];
  });
  const grants = surges(run.deck);
  run.sideboard = [structuredClone(grants[0]), structuredClone(grants[0])];
  run.deck.push(structuredClone(grants[1]));
  stampDeck(registries, run);
  assert.equal(run.sideboard.length, 1);
  assert.equal(surges(run.deck).length, 2);
  const piles = { hand: [structuredClone(grants[1])], draw: [structuredClone(grants[1])], discard: [], exhaust: [] };
  reconcileGrantedCardsInCombat(registries, run, piles);
  const live = surges(Object.values(piles).flat());
  assert.equal(live.length, 2);
  assert.equal(new Set(live.map(card => card.instanceId)).size, 2);
  assert.ok(!live.some(card => card.instanceId === grants[0].instanceId), 'held-aside grant stays out of combat');
});
