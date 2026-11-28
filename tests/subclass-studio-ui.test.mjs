import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectCardMechanicalValues } from '../src/model/cardMechanicalProjection.js';
import { CardDefinitionToScoreFace } from '../src/model/cardUpgradeCp.js';
import { ScoreCard, CombatPower, RankOf } from '../src/model/combatPower.js';
import { scoring } from '../src/content/generated/scoring.js';
import { GenerateSubclassCatalog } from '../src/model/subclassCardGenerator.js';
import { ValidateSubclassCatalog } from '../src/model/subclassCatalogExport.js';
import { buildStudioBundle, parseStudioBundle } from '../tools/score-studio/customDecks.js';
import { cleanSubclassCard, currentSubclassCatalog, mergeSubclassCatalog, subclassListsForState, upgradeNames } from '../tools/score-studio/subclassCatalog.js';

const catalog = () => GenerateSubclassCatalog({ subclassIds: ['bloodletter'], seed: 'studio-contract' });
const empty = () => ({ cards: [{ id: 'core.authored', name: 'Keep me' }], customDecks: [], subclassCatalog: null });

test('subclass lists add cards without replacing authored content and preserve upgrade choices', () => {
  const source = catalog(), before = empty();
  const next = mergeSubclassCatalog(before, source);
  assert.deepEqual(before, empty());
  assert.equal(next.cards.length, 16);
  assert.equal(next.cards.at(-1).id, 'core.authored');
  assert.equal(next.customDecks[0].cardIds.length, 15);
  assert.equal(next.cards[0]._autoName, false);
  assert.deepEqual(currentSubclassCatalog(next).cards[0].upgradeMenu, source.cards[0].upgradeMenu);
  assert.deepEqual(ValidateSubclassCatalog(currentSubclassCatalog(next)), []);
});

test('catalog export reads the edited definition and removes Studio-only bookkeeping', () => {
  const state = mergeSubclassCatalog(empty(), catalog());
  state.cards[0].name = 'My edited wound attack';
  state.cards[0].effects[0].amount = 4;
  state.cards[0]._edited = true;
  state.cards[0].face = { previewOnly: true };
  state.cards[0].scoringOverride = { rank: 5 };
  state.cards[0].kindIds = ['classification.attack'];
  const exported = currentSubclassCatalog(state);
  assert.equal(exported.cards[0].name, 'My edited wound attack');
  assert.equal(exported.cards[0].effects[0].amount, 4);
  assert.equal('_edited' in exported.cards[0], false);
  assert.equal('face' in exported.cards[0], false);
  assert.equal('scoringOverride' in exported.cards[0], false);
  assert.equal('kindIds' in exported.cards[0], false);
});

test('catalog export accepts the derived kindIds added by Studio normalization', () => {
  const state = mergeSubclassCatalog(empty(), catalog(), { normalize: card => ({ ...card, kindIds: [`classification.${card.type}`] }) });
  assert.ok(state.cards[0].kindIds);
  const exported = currentSubclassCatalog(state);
  assert.equal(exported.cards.some(card => 'kindIds' in card), false);
  assert.deepEqual(ValidateSubclassCatalog(exported), []);
});

test('reloaded runtime rating projections are removed from both base and authored upgrade', () => {
  const source = catalog();
  const projected = structuredClone(source.cards[0]);
  projected.kindIds = ['classification.attack'];
  projected.cardRatingValues = { damage: 20 };
  projected.upgrade.cardRatingValues = { damage: 21 };
  projected.upgrade.kindIds = ['classification.attack'];
  const clean = cleanSubclassCard(projected);
  assert.equal('cardRatingValues' in clean, false);
  assert.equal('cardRatingValues' in clean.upgrade, false);
  assert.equal('kindIds' in clean.upgrade, false);
  assert.deepEqual(clean.effects, source.cards[0].effects);
  assert.deepEqual(clean.upgrade.effects, source.cards[0].upgrade.effects);
  source.cards[0] = clean;
  assert.deepEqual(ValidateSubclassCatalog(source), []);
  const state = mergeSubclassCatalog(empty(), source);
  Object.assign(state.cards[0], projected);
  assert.deepEqual(ValidateSubclassCatalog(currentSubclassCatalog(state)), []);
});

test('edited subclass cards export a rebased signature upgrade without replacing custom base text', () => {
  const state = mergeSubclassCatalog(empty(), catalog());
  const edited = state.cards[0];
  edited.name = 'My Serrated Cut';
  edited.cost = edited.staminaCost = 2;
  edited.effects[0].amount += 3;
  edited.textTemplate = 'My custom wording: deal {damage} damage and apply {bleed} bleed.';
  const staleUpgradeDamage = edited.upgrade.effects[0].amount;
  const exported = currentSubclassCatalog(state).cards[0];
  assert.equal(exported.textTemplate, edited.textTemplate);
  assert.ok(exported.upgrade);
  assert.equal(exported.upgrade.name, 'My Serrated Cut+');
  assert.ok(exported.upgrade.effects[0].amount >= edited.effects[0].amount);
  assert.ok(exported.upgrade.effects[0].amount > staleUpgradeDamage);
  assert.equal(exported.staminaCost, 2);
});

test('regeneration requires explicit replacement and cannot overwrite an unrelated collision', () => {
  const source = catalog(), first = mergeSubclassCatalog(empty(), source);
  assert.throws(() => mergeSubclassCatalog(first, source), /Replace cards already/);
  assert.equal(mergeSubclassCatalog(first, source, { replace: true }).cards.length, 16);
  const collision = { ...empty(), cards: [{ id: source.cards[0].id, class: 'rogue', name: 'Unrelated authored card' }] };
  assert.throws(() => mergeSubclassCatalog(collision, source, { replace: true }), /outside these subclass lists/);
});

test('missing list cards block export instead of silently exporting an incomplete list', () => {
  const state = mergeSubclassCatalog(empty(), catalog());
  state.cards.splice(0, 1);
  assert.throws(() => currentSubclassCatalog(state), /List cards are missing/);
});

test('subclass lists survive the existing full Studio bundle export and import', () => {
  const state = mergeSubclassCatalog(empty(), catalog());
  const bundle = parseStudioBundle(JSON.stringify(buildStudioBundle({ cards: state.cards, customDecks: state.customDecks })));
  const restored = { cards: bundle.cards, customDecks: bundle.customDecks, subclassCatalog: null };
  assert.equal(subclassListsForState(restored).length, 1);
  assert.deepEqual(currentSubclassCatalog(restored).lists, catalog().lists);
  assert.deepEqual(currentSubclassCatalog(restored).cards, catalog().cards);
  assert.deepEqual(currentSubclassCatalog(restored).metadata, currentSubclassCatalog(state).metadata);
});

test('selective export includes only selected lists and keeps other generated lists', () => {
  const first = mergeSubclassCatalog(empty(), catalog());
  const second = mergeSubclassCatalog(first, GenerateSubclassCatalog({ subclassIds: ['saint'], seed: 'other' }));
  assert.equal(subclassListsForState(second).length, 2);
  const exported = currentSubclassCatalog(second, ['saint']);
  assert.equal(exported.cards.length, 15);
  assert.equal(exported.lists[0].id, 'saint');
  assert.ok(exported.cards.every(card => card.class === 'herald'));
});

test('malformed imports are rejected before any state changes', () => {
  const state = empty(), source = catalog();
  source.cards[0].effects[0].op = 'imaginaryMechanic';
  assert.throws(() => mergeSubclassCatalog(state, source));
  assert.deepEqual(state, empty());
});

test('exported game cards reconstruct their subclass lists after a fresh page load', () => {
  const source = catalog();
  const state = { cards: source.cards, customDecks: [], subclassCatalog: null };
  assert.deepEqual(currentSubclassCatalog(state).lists, source.lists);
  assert.deepEqual(currentSubclassCatalog(state).cards, source.cards);
});

test('upgrade labels expose existing upgrade families rather than unrelated new mechanics', () => {
  assert.deepEqual(upgradeNames({ upgradeMenu: ['dmg', 'fx:heal', 'fx:cleanse', 'fx:unexhaust', 'fx:block'] }),
    ['Damage', 'Purified: healing', 'Purified: cleanse', 'Refined: remove Exhaust', 'Tempered: Block']);
});


test('current catalog metadata uses rendered mechanics and refreshes raw, CP, rank and authored-upgrade scores', () => {
  const state = { ...mergeSubclassCatalog(empty(), catalog()), scoring };
  const card = state.cards.find(card => card.name === 'Serrated Cut');
  const capture = amount => {
    card.effects[0].amount = amount;
    const current = currentSubclassCatalog(state), definition = current.cards.find(row => row.id === card.id), meta = current.metadata.find(row => row.cardId === card.id);
    const raw = ScoreCard(CardDefinitionToScoreFace(definition, { scoring }), scoring).raw;
    assert.equal(meta.projectedRaw, raw); assert.equal(meta.projectedCp, CombatPower(raw, definition.rarity, scoring)); assert.equal(meta.projectedRank, RankOf(meta.projectedCp, scoring));
    if (definition.upgrade) {
      const upgraded = { ...definition, ...definition.upgrade }, upgradedRaw = ScoreCard(CardDefinitionToScoreFace(upgraded, { scoring }), scoring).raw;
      assert.equal(meta.signatureUpgrade.projectedRaw, upgradedRaw); assert.equal(meta.signatureUpgrade.projectedCp, CombatPower(upgradedRaw, upgraded.rarity, scoring));
    }
    return { damage: ProjectCardMechanicalValues(definition).tokens.damage, cp: meta.projectedCp, cost: definition.staminaCost, rarity: definition.rarity, status: definition.effects[1] };
  };
  const eight = capture(8), seven = capture(7), sixteen = capture(16);
  // The reference Reaver's 1 Strength (owner, 2026-11-28) adds one point to each displayed hit.
  assert.equal(eight.damage, 2); assert.equal(seven.damage, 2); assert.equal(sixteen.damage, 4);
  assert.equal(eight.cp, seven.cp); assert.notEqual(eight.cp, sixteen.cp);
  assert.equal(eight.cost, sixteen.cost); assert.equal(eight.rarity, sixteen.rarity); assert.deepEqual(eight.status, sixteen.status);
});


test('all 180 under-target and exact-target signatures survive bare-game and full Studio bundle reloads unchanged', () => {
  const source = GenerateSubclassCatalog({ seed: 'studio-contract' });
  assert.equal(source.cards.length, 180); assert.ok(source.metadata.some(row => row.projectedRank < row.requestedRank));
  const bare = { cards: structuredClone(source.cards), customDecks: [], subclassCatalog: null, scoring };
  const before = structuredClone(bare);
  assert.deepEqual(currentSubclassCatalog(bare).cards, source.cards); assert.deepEqual(bare, before);
  const state = { ...mergeSubclassCatalog(empty(), source), scoring };
  const bundle = parseStudioBundle(JSON.stringify(buildStudioBundle({ cards: state.cards, customDecks: state.customDecks })));
  const restored = { cards: bundle.cards, customDecks: bundle.customDecks, subclassCatalog: null, scoring };
  assert.deepEqual(currentSubclassCatalog(restored).cards, source.cards);
  const originalMetadata = new Map(source.metadata.map(row => [row.cardId, row]));
  for (const meta of currentSubclassCatalog(restored).metadata) assert.equal(meta.requestedRank, originalMetadata.get(meta.cardId).requestedRank);
});


test('bare reload ignores JSON object key order while preserving all 180 authored signatures and ordered menus', () => {
  const source = GenerateSubclassCatalog({ seed: 'studio-contract' });
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, reorder(value[key])])) : value;
  const cards = source.cards.map(card => ({ ...card, upgrade: reorder(card.upgrade) }));
  const state = { cards, customDecks: [], subclassCatalog: null, scoring }, before = structuredClone(state);
  const exported = currentSubclassCatalog(state);
  assert.equal(exported.cards.length, 180);
  assert.deepEqual(exported.cards, source.cards);
  assert.deepEqual(state, before, 'normalizing comparison keys never mutates the imported payload');
  for (let i = 0; i < source.cards.length; i++) assert.deepEqual(exported.cards[i].upgradeMenu, source.cards[i].upgradeMenu, source.cards[i].id);
});
