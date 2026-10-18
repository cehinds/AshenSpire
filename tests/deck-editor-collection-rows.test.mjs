import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { deckEditorModel, openDeckEdit } from '../src/ui/models/DeckEditorModel.js';
import { deckEditorCollectionRows } from '../src/ui/models/deckEditorCollectionRows.js';
const fixture = id => {
  const profile = resolveGameProfile(id);
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const run = createRunState({ seed: 7, classId: 'reaver', registries });
  const rows = () => deckEditorCollectionRows({ registries, run, collection: deckEditorModel({ registries, run }).collection });
  return { registries, run, rows };
};
test('equivalent mint and equipped copies share one row with their combined deck count', () => {
  const { run, rows } = fixture('current');
  const before = structuredClone(run);
  const strikes = rows().filter(row => row.name === 'Slashing Strike');
  assert.equal(strikes.length, 1);
  assert.equal(strikes[0].inDeck, 2);
  assert.equal(strikes[0].owned, Infinity);
  assert.equal(strikes[0].memberKeys.length, 2);
  assert.deepEqual(run, before, 'grouping is a read-only presentation');
});
test('a grouped row removes an actual member and restores its ownership before minting', () => {
  const { registries, run, rows } = fixture('current');
  const before = structuredClone(run);
  const session = openDeckEdit(registries, run);
  let strike = rows().find(row => row.name === 'Slashing Strike');
  const removed = run.deck.find(card => card.instanceId === strike.removeInstanceId);
  assert.ok(removed, 'the group selects an actual deck instance');
  assert.equal(session.remove(strike.removeInstanceId).ok, true);
  session.undo();
  const grant = run.deck.find(card => card.instanceId === 'kit:straightSword:attack');
  assert.equal(session.remove(grant.instanceId).ok, true);
  strike = rows().find(row => row.name === 'Slashing Strike');
  assert.equal(strike.inDeck, 1);
  assert.notEqual(strike.addKey, strike.key, 'available owned member is restored before minting');
  assert.equal(session.add(strike.addKey).ok, true);
  assert.ok(run.deck.some(card => card.instanceId === grant.instanceId));
  assert.equal(rows().find(row => row.name === 'Slashing Strike').inDeck, 2);
  session.cancel();
  assert.deepEqual(run, before);
});
test('different effects, upgrades and ranks stay separate even when their names match', () => {
  const { run, rows } = fixture('current');
  const grant = run.deck.find(card => card.instanceId === 'kit:straightSword:attack');
  for (const patch of [{ mods: ['damage=99'] }, { upgraded: true }, { rank: 2 }]) {
    const saved = structuredClone(grant);
    Object.assign(grant, patch);
    assert.equal(rows().filter(row => row.name === 'Slashing Strike').length, 2, JSON.stringify(patch));
    for (const key of Object.keys(grant)) delete grant[key];
    Object.assign(grant, saved);
  }
});
test('the ten-card core starter retains owned counts and exposes trained basics', () => {
  const { run, rows } = fixture('core');
  assert.equal(run.deck.length, 10);
  assert.deepEqual(rows().filter(row => row.inDeck > 0).map(row => row.cardId).sort(), [...new Set(run.deck.map(card => card.cardId))].sort());
  assert.equal(rows().reduce((sum, row) => sum + row.inDeck, 0), 10);
  assert.equal(rows().find(row => row.cardId === 'core.strike').owned, Infinity);
  assert.equal(rows().find(row => row.cardId === 'core.evade').inDeck, 0);
  assert.equal(rows().find(row => row.cardId === 'core.evade').owned, Infinity);
  assert.equal(rows().find(row => row.cardId === 'base.draw').owned, 1);
});
