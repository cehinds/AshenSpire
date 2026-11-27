import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { contentBundle } from '../src/content/index.js';
import { gameProfileCatalog } from '../src/content/generated/gameProfiles.js';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
import { createRegistries } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { applyGameProfileToContent, bindGameProfileRegistries, projectGameCard, resolveGameProfile } from '../src/model/gameProfile.js';
import { createRunState, deserializeRun, serializeRun } from '../src/model/state.js';
import { reconcileGrantedCards } from '../src/model/loadout.js';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const bundle = read('content/source/studioDecks.json');
const active = bundle.customDecks.find(row => row.id === 'deck_starseeruncommonlist');
const authored = active.cardIds.map(id => bundle.cards.find(card => card.id === id));
const cards = read('games/ashenspire/packs/core/cards.json');
const recipes = read('games/ashenspire/packs/core/starterDeck.json');
const recipe = recipes.classDecks.starseer;
const expectedCounts = Object.fromEntries(recipe.map(row => [row.card, row.copies]));
const counts = deck => Object.fromEntries([...new Set(deck.map(card => card.cardId))].sort().map(id => [id, deck.filter(card => card.cardId === id).length]));
const clean = value => Array.isArray(value) ? value.map(clean) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('_') && key !== 'kindIds').map(([key, child]) => [key, clean(child)]))
  : value;
// Canonical templates bind to effect tokens; the untouched Studio export keeps its
// original prose. Every other authored field must reach the game unchanged.
const withoutTemplates = value => Array.isArray(value) ? value.map(withoutTemplates) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'textTemplate').map(([key, child]) => [key, withoutTemplates(child)]))
  : value;
const registriesFor = profile => bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const start = (profile, registries = registriesFor(profile)) => createRunState({
  registries, classId: 'starseer', seed: 113,
  profileMeta: { gameProfileUnlocks: { [profile.id]: { completedRunIds: ['first-run'] } } },
});

test('Starseer sources install the active authored cards and current base recipe', () => {
  assert.ok(authored.length > 0, 'the active authored list is nonempty');
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
  for (const exported of authored) {
    const installed = cards.find(card => card.id === exported.id);
    assert.deepEqual(installed, clean(installed), `${exported.id} has no Studio-only metadata`);
    assert.deepEqual(withoutTemplates(installed), withoutTemplates(clean(exported)), exported.id);
  }
  assert.deepEqual(recipes.classDecks.starseer, recipe);
  assert.deepEqual(read('games/ashenspire/packs/core/characters.json').find(row => row.id === 'starseer').defaultDeck, recipe);
  assert.equal(cards.some(card => card.id === 'custom.card_mwx49ejs'), false, 'the colorless placeholder stays in authoring only');

});

test('the authored Starseer profile passes the same content validation used at boot', () => {
  const validation = validateContent(applyGameProfileToContent(contentBundle, resolveGameProfile('core')));
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.ok, true);
});

test('Core resource projections preserve the authored prices with either pool enabled or disabled', () => {
  for (const include of [['sp', 'mp'], ['sp'], ['mp'], []]) {
    const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { resources: { include } } });
    for (const exported of authored) {
      const card = projectGameCard(profile, exported.id);
      assert.ok(card, exported.id);
      assert.deepEqual([card.cost, card.staminaCost, card.manaCost], [
        include.includes('sp') ? exported.staminaCost : 0,
        include.includes('sp') ? exported.staminaCost : 0,
        include.includes('mp') ? exported.manaCost : 0,
      ], `${exported.id}: ${include.join(',') || 'none'}`);
      assert.deepEqual(card.effects, exported.effects, exported.id);
      if (exported.upgrade) {
        const upgraded = projectGameCard(profile, { cardId: exported.id, upgraded: true });
        assert.deepEqual(upgraded.effects, exported.upgrade.effects || exported.effects, `${exported.id}+`);
      }
    }
  }
});

test('actual Starseer run creation supplies the authored base cards and equipment grants without duplicating grants', () => {
  const profile = resolveGameProfile('core');
  const registries = registriesFor(profile);
  const run = start(profile, registries);
  const ordinary = run.deck.filter(card => !card.grantedBy && !card.equipmentRole);
  assert.equal(ordinary.length, recipe.reduce((sum, row) => sum + row.copies, 0));
  assert.deepEqual(counts(ordinary), expectedCounts);
  const arts = run.deck.filter(card => card.equipmentRole === 'weaponArt');
  const character = read('games/ashenspire/packs/core/characters.json').find(row => row.id === 'starseer');
  const packages = read('content/source/weaponCardPackages.json');
  const expectedArts = [...new Set(character.defaultGear.flatMap(item => packages.find(row => row.weaponId === item.id)?.package.weaponArtDefaults || []))];
  assert.deepEqual(arts.map(card => card.cardId).sort(), expectedArts.sort());
  const expectedTotal = ordinary.length + expectedArts.length;
  assert.equal(run.deck.length, expectedTotal);
  for (const id of Object.keys(expectedCounts)) assert.ok(run.collectedCardIds.includes(id), id);
  reconcileGrantedCards(registries, run);
  assert.equal(run.deck.length, expectedTotal);
  assert.deepEqual(counts(run.deck.filter(card => !card.grantedBy && !card.equipmentRole)), expectedCounts);
  for (const source of authored) {
    const projected = projectGameCard(profile, source.id);
    assert.deepEqual(registries.cards.get(source.id).effects, projected.effects, source.id);
  }
});

test('a prior Starseer profile keeps its own deck and card numbers when current content changes', () => {
  // A resolved old content snapshot uses the same runtime ABI. Its historical
  // nine-card base and Astral Bolt are deliberately different from today's data.
  const priorCatalog = structuredClone(gameProfileCatalog);
  const corePack = Object.values(priorCatalog.packs).find(pack => pack.manifest.id === 'ashen.core-content');
  const oldRecipe = [
    { card: 'core.cantrip', copies: 4 },
    ...['core.arcaneWard', 'core.glimmerVeil', 'core.stoneSigil', 'core.ashenShell', 'core.starseerSpecial'].map(card => ({ card, copies: 1 })),
  ];
  corePack.content.starterDeck.classDecks.starseer = oldRecipe;
  const oldBolt = corePack.content.cards.find(card => card.id === 'core.astralBolt');
  Object.assign(oldBolt, { name: 'Astral Bolt', rarity: 'uncommon', manaCost: 1, effects: [{ op: 'damage', target: 'enemy', amount: 14 }, { op: 'draw', amount: 1 }] });
  corePack.content.resourceVariants['core.astralBolt']['sp,mp'] = { cost: 1, staminaCost: 1, manaCost: 1 };
  const prior = resolveGameAuthor({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} }, priorCatalog);
  const oldRegistries = registriesFor(prior);
  const oldRun = start(prior, oldRegistries);
  const before = structuredClone({ deck: oldRun.deck, profile: oldRun.gameProfile });
  const current = resolveGameProfile('core');
  assert.notEqual(current.hash, prior.hash);
  assert.equal(current.lock.runtimeHash, prior.lock.runtimeHash);
  const restored = deserializeRun(serializeRun(oldRun, { inline: true }));
  assert.deepEqual(restored.deck, before.deck);
  assert.deepEqual(restored.gameProfile, before.profile);
  const restoredRegistries = registriesFor(restored.gameProfile);
  reconcileGrantedCards(restoredRegistries, restored);
  assert.deepEqual(counts(restored.deck.filter(card => !card.grantedBy && !card.equipmentRole)), Object.fromEntries(oldRecipe.map(row => [row.card, row.copies])));
  assert.equal(restoredRegistries.cards.get('core.astralBolt').effects[0].amount, 14);
  assert.deepEqual(projectGameCard(current, 'core.astralBolt').effects, cards.find(card => card.id === 'core.astralBolt').effects);
});
