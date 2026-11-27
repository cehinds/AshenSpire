// Owner, 2026-11-17 (playtest theme D, items 22-23): character levels and
// min-slot relics lower the deck editor's minimum in Core.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { deckRules } from '../src/content/deckRules.js';
import { deckEditBounds, DeckMinDelta, LevelMinDeckDelta } from '../src/model/deckRules.js';
import { deckEditorModel } from '../src/ui/models/DeckEditorModel.js';

const core = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, core)), core);
const make = (level = 1) => {
  const run = createRunState({ seed: 11, classId: 'reaver', registries, runId: 'deck-min' });
  run.level.level = level;
  return run;
};

test('the configured reduction levels are ordered positive integers', () => {
  const levels = [...deckRules.minimumReductionLevels];
  assert.ok(levels.every((level, index) => Number.isInteger(level) && level > 0 && (!index || level > levels[index - 1])));
});

test('each authored reduction level lowers the Core minimum once and the editor reads it', () => {
  const levels = [...deckRules.minimumReductionLevels];
  for (const level of new Set([1, ...levels.flatMap(at => [at - 1, at, at + 1]), (levels.at(-1) || 1) + 10])) {
    const expected = levels.filter(at => level >= at).length;
    const run = make(level);
    assert.equal(LevelMinDeckDelta(run), expected, `level ${level}`);
    const minimum = Math.max(Math.min(deckRules.defaults.deckMinSize, deckRules.minimumReductionSafetyFloor), deckRules.defaults.deckMinSize - DeckMinDelta(run));
    assert.equal(deckEditBounds({}, DeckMinDelta(run)).min, minimum);
    assert.equal(deckEditorModel({ registries, run }).counter.min, minimum);
  }
});

test('a legacy run keeps the settings minimum whatever its level', () => {
  const legacy = createRunState({ seed: 11, classId: 'reaver', registries: createRegistries(contentBundle) });
  legacy.level = { level: 12, xp: 0, unspentPoints: 0 };
  assert.equal(LevelMinDeckDelta(legacy), 0);
});

test('an unlimited-kind item property lifts the Core copy limit, so a minted Basic can be committed', async () => {
  const { openDeckEdit } = await import('../src/ui/models/DeckEditorModel.js');
  const { commitDeckEditDraft, unlimitedCardIds } = await import('../src/model/deckRules.js');
  const { configuredDeckCopyLimit } = await import('../src/model/deckCopyLimit.js');
  const run = make(1);
  run.relics = [...(run.relics || []), 'goldenSprout'];
  run.itemProps = { 'relic/goldenSprout': ['unlimitedBasics'] };
  assert.ok(unlimitedCardIds(run).includes('core.strike'));
  assert.equal(configuredDeckCopyLimit(run, 'core.strike'), Infinity);
  const draft = structuredClone(run);
  draft.gameProfile = run.gameProfile;
  const session = openDeckEdit(registries, draft);
  const before = draft.deck.filter(card => card.cardId === 'core.strike').length;
  assert.equal(session.add('basic:core.strike').ok, true);
  assert.equal(draft.deck.filter(card => card.cardId === 'core.strike').length, before + 1);
  assert.doesNotThrow(() => commitDeckEditDraft(registries, run, { deck: draft.deck, sideboard: draft.sideboard, editMintCounter: draft.editMintCounter, collectedCardIds: draft.collectedCardIds }));
  assert.equal(run.deck.filter(card => card.cardId === 'core.strike').length, before + 1);
});

test('a relic row may author item properties; they must name real rows', async () => {
  const { AuthoredPropertyIds } = await import('../src/model/itemPicks.js');
  const relics = JSON.parse(readFileSync(new URL('../content/source/relics.json', import.meta.url)));
  for (const row of relics) assert.deepEqual(AuthoredPropertyIds(`relic/${row.id}`), row.properties || [], row.id);
  assert.deepEqual(AuthoredPropertyIds('armament/greatsword'), []);
  const { validateContent } = await import('../src/model/validate.js');
  const bundle = { ...contentBundle, relics: [...contentBundle.relics, { id: 'badRelic', name: 'Bad', rarity: 'common', textTemplate: 'x', properties: ['nope'] }] };
  const problems = validateContent(bundle).errors.map(e => `${e.path}: ${e.msg}`).join('\n');
  assert.match(problems, /relics\.badRelic\.properties\[0\]/);
});

test('authored relic deck-size properties reach the runtime and stack with level reductions', async () => {
  const { ItemMinDeckDelta } = await import('../src/model/itemProperties.js');
  const relics = JSON.parse(readFileSync(new URL('../content/source/relics.json', import.meta.url)));
  const properties = JSON.parse(readFileSync(new URL('../content/source/itemProperties.json', import.meta.url))).properties;
  const contribution = row => (row.properties || []).reduce((sum, id) => sum + (properties.find(prop => prop.id === id)?.fx?.minDeckDelta || 0), 0);
  const lowering = relics.filter(row => contribution(row) > 0);
  const run = make((deckRules.minimumReductionLevels.at(-1) || 1) + 1);
  run.relics = [];
  const base = ItemMinDeckDelta(run);
  for (const row of lowering) {
    run.relics.push(row.id);
    assert.equal(ItemMinDeckDelta(run), base + lowering.filter(item => run.relics.includes(item.id)).reduce((sum, item) => sum + contribution(item), 0));
    assert.equal(DeckMinDelta(run), ItemMinDeckDelta(run) + LevelMinDeckDelta(run));
  }
});

// Small explicit card definitions isolate the training contract from class recipes,
// rarity tuning, and which relics currently happen to grant each property.
test('unlimited item properties distinguish Basic and Cantrip and enforce ownership, class, rarity and enemy exclusions', async () => {
  const { ItemUnlimitedCardIds, configuredDeckCopyLimit } = await import('../src/model/deckCopyLimit.js');
  const properties = JSON.parse(readFileSync(new URL('../content/source/itemProperties.json', import.meta.url))).properties;
  const basic = { id: 'fixture.basic', class: 'colorless', type: 'attack', rarity: 'common', tags: ['camp:physical'], effects: [] };
  const cantrip = { id: 'fixture.cantrip', class: 'starseer', type: 'skill', rarity: 'common', tags: ['camp:spell', 'rank.cantrip'], effects: [] };
  const cards = [basic, cantrip, { ...basic, id: 'fixture.uncollected' }, { ...basic, id: 'fixture.foreign', class: 'rogue' },
    { ...basic, id: 'fixture.rare', rarity: 'rare' }, { ...basic, id: 'fixture.enemy' }, { ...basic, id: 'fixture.power', type: 'power' },
    { ...basic, id: 'fixture.ranked', rank: 2 }, { ...cantrip, id: 'fixture.ordinary-spell', tags: ['camp:spell'] }];
  for (const [kind, expected] of [['Basic', basic.id], ['Cantrip', cantrip.id]]) {
    const property = properties.find(row => row.fx?.unlimited === kind);
    assert.ok(property, `${kind} training property exists`);
    const run = make(1);
    run.class = 'starseer';
    run.gameProfile = { ...core, content: { ...core.content, cards, enemyCards: [cards.find(card => card.id === 'fixture.enemy')], classes: [], cardPools: {} } };
    run.relics = ['fixture.carrier'];
    run.itemProps = { 'relic/fixture.carrier': [property.id] };
    run.collectedCardIds = cards.filter(card => card.id !== 'fixture.uncollected').map(card => card.id);
    assert.deepEqual(ItemUnlimitedCardIds(run), [expected]);
    assert.equal(configuredDeckCopyLimit(run, expected), Infinity);
    run.collectedCardIds = run.collectedCardIds.filter(id => id !== expected);
    assert.deepEqual(ItemUnlimitedCardIds(run), [], 'removing collection eligibility invalidates the offer');
    assert.notEqual(configuredDeckCopyLimit(run, expected), Infinity);
    const { commitDeckEditDraft } = await import('../src/model/deckRules.js');
    const forged = { deck: [...run.deck, { instanceId: 'edit:forged', cardId: 'fixture.enemy', upgraded: false }], sideboard: run.sideboard, collectedCardIds: run.collectedCardIds };
    const fixtureRegistries = { ...registries, cards: { ...registries.cards, has: id => id === 'fixture.enemy' || registries.cards.has(id), get: id => id === 'fixture.enemy' ? cards.find(card => card.id === id) : registries.cards.get(id) } };
    const before = structuredClone(run.deck);
    assert.throws(() => commitDeckEditDraft(fixtureRegistries, run, forged), /invent|copy limit|equipment/, 'a defined enemy move cannot be minted through draft commit');
    assert.deepEqual(run.deck, before, 'the refused edit is atomic');
  }
});

// Review of #2815 (low): Core has ONE minimum. The Armoury floor and the character ladder read the player's
// deck-size settings exactly as the deck editor does.
test('the Armoury floor and the ladder follow the deck-size settings the editor follows', async () => {
  const { deckMinimum, loadoutLeaveRefusal } = await import('../src/model/loadout.js');
  const { characterLadder } = await import('../src/ui/models/CharacterSheetModel.js');
  const run = make(4);
  for (const settings of [{}, { deckMinSize: 14 }, { deckMinSize: 12, deckMinUnlimited: true }]) {
    assert.equal(deckMinimum(registries, run, settings), deckEditBounds(settings, DeckMinDelta(run)).min, JSON.stringify(settings));
  }
  const length = run.deck.length;
  assert.equal(loadoutLeaveRefusal(registries, run, { settings: { deckMinSize: length } }), '');
  const requested = length + DeckMinDelta(run) + 1;
  const minimum = deckEditBounds({ deckMinSize: requested }, DeckMinDelta(run)).min;
  assert.match(loadoutLeaveRefusal(registries, run, { settings: { deckMinSize: requested } }), new RegExp(`floor is ${minimum}`));
  const at = deckRules.minimumReductionLevels[0];
  const firstRow = characterLadder(registries, make(1), undefined, { deckMinSize: 14 }).rows.find(row => row.level === at);
  assert.equal(firstRow.grants.find(g => g.kind === 'deckMinimumDown').amount, deckEditBounds({ deckMinSize: 14 }, LevelMinDeckDelta(make(at))).min);
});

test('the ladder shows a deck minimum grant only if the minimum actually falls', async () => {
  const { characterLadder } = await import('../src/ui/models/CharacterSheetModel.js');
  const deckMinimumGrants = (settings) => characterLadder(registries, make(), undefined, settings).rows
    .flatMap(({ level, grants }) => grants.filter(({ kind }) => kind === 'deckMinimumDown').map(({ amount }) => [level, amount]));
  assert.deepEqual(deckMinimumGrants({ deckMinUnlimited: true }), []);
  const expected = deckRules.minimumReductionLevels.length ? [[deckRules.minimumReductionLevels[0], Math.max(deckRules.minimumReductionSafetyFloor, 1)]] : [];
  assert.deepEqual(deckMinimumGrants({ deckMinSize: 2 }), expected);
});

test('reductions stop at the configured safety floor and keep an explicit unlimited minimum', async () => {
  const { deckMinimum } = await import('../src/model/loadout.js');
  const run = make((deckRules.minimumReductionLevels.at(-1) || 1) + 1);
  const delta = DeckMinDelta(run);
  const expected = Math.max(Math.min(deckRules.defaults.deckMinSize, deckRules.minimumReductionSafetyFloor), deckRules.defaults.deckMinSize - delta);
  assert.equal(deckEditBounds({}, delta).min, expected);
  assert.equal(deckMinimum(registries, run), expected);
  assert.equal(deckEditBounds({ deckMinSize: 3 }, 99).min, Math.min(3, deckRules.minimumReductionSafetyFloor));
  assert.equal(deckEditBounds({ deckMinUnlimited: true }, delta).min, 0);
});
