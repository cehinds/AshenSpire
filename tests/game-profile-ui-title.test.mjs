import test from 'node:test';
import assert from 'node:assert/strict';
import { loadableTitleSlots, profileStarterCount } from '../src/ui/models/GameProfileTitleModel.js';

test('Continue selects latest eligible save and hides both save doors without one', () => {
  const old = { slot: 1, summary: { savedAt: '2026-10-01' } };
  const latest = { slot: 2, summary: { savedAt: '2026-10-15' } };
  const newer = { slot: 3, summary: { savedAt: '2026-10-16', newer: true } };
  assert.deepEqual(loadableTitleSlots([old, newer, latest]).map(row => row.slot), [2, 1]);
  assert.deepEqual(loadableTitleSlots([{ slot: 1, summary: null }, newer]), []);
  assert.deepEqual(loadableTitleSlots([{ slot: 1, summary: { loadable: false } }]), []);
});

test('new-game starter summary follows imported copy changes', () => {
  const starter = { shared: [{ card: 'strike', copies: 3 }, { card: 'defend', copies: 3 }], classSpecificCopies: 1 };
  assert.equal(profileStarterCount(starter), 7);
  assert.equal(profileStarterCount({ ...starter, classSpecificCopies: 2 }), 8);
  assert.equal(profileStarterCount(null), null);
});

test('configured editor definition keeps authored effects instead of adding legacy stance riders', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } = await import('../src/model/gameProfile.js');
  const { playingCardDefinition } = await import('../src/model/playingCard.js');
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const profile = resolveGameProfile('core');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const definition = playingCardDefinition(registries, { cardId: 'core.defend' }, { rules: { gameProfile: profile, combatExpansionVersion: 2 } });
  const lines = cardFaceLines(definition, null, registries).map(line => line.html).join(' ');
  assert.match(lines, /Block/);
  assert.doesNotMatch(lines, /Entry|Precision|Ward|Restore/);
});
