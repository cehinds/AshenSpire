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

test('configured Counter face describes Block and its deferred return', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, projectGameCard } = await import('../src/model/gameProfile.js');
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const profile = resolveGameProfile('core');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const lines = cardFaceLines(projectGameCard(profile, 'core.counter'), null, registries).map(row => row.html).join(' ');
  assert.match(lines, /Block/);
  assert.match(lines, /^Gain <span class="val">5<\/span> Block Counter <span class="val">4<\/span>/);
  assert.doesNotMatch(lines, /Prepare|Melee|return|damage/);
  assert.doesNotMatch(lines, /Inflict/);
});

test('concise Counter retains live Block and return amounts and change marks', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries, projectGameCard } = await import('../src/model/gameProfile.js');
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const profile = resolveGameProfile('core');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const def = projectGameCard(profile, 'core.counter');
  const values = def.effects.map(effect => ({ op: effect.op, value: effect.op === 'damage' ? 7 : 9, hits: 1 }));
  const lines = cardFaceLines(def, { values, counterReturn: { hp: 7, poise: 3, ward: 0 } }, registries, null, { stanceEntry: false });
  assert.deepEqual(lines.map(row => row.html.replace(/<[^>]+>/g, '')), ['Gain 9 Block', 'Counter 7']);
  assert.ok(lines.every(row => row.html.includes('class="val up"')));
});

test('configured long damage faces retain type, damage and Poise in compact wording', async () => {
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } = await import('../src/model/gameProfile.js');
  const { applyCombatExpansionCard } = await import('../src/content/combatExpansionCards.js');
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const profile = resolveGameProfile('core');
  const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
  const def = applyCombatExpansionCard(registries.cards.get('sunderingChop'));
  const lines = cardFaceLines(def, null, registries, null, { stanceEntry: false });
  const text = lines.map(row => row.html.replace(/<[^>]+>/g, ''));
  assert.equal(text[0], '9 Blunt damage, 7 Poise');
  assert.doesNotMatch(text[0], /Inflict|Poise damage/);
});
