// Owner, 2026-11-17 (playtest theme D, items 22-23): character levels and
// min-slot relics lower the deck editor's minimum in Core.
import test from 'node:test';
import assert from 'node:assert/strict';
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

test('the reduction levels are data and rise', () => {
  assert.deepEqual([...deckRules.minimumReductionLevels], [4, 8, 12]);
});

test('a Core run loses one minimum slot at each reduction level', () => {
  assert.equal(LevelMinDeckDelta(make(1)), 0);
  assert.equal(LevelMinDeckDelta(make(3)), 0);
  assert.equal(LevelMinDeckDelta(make(4)), 1);
  assert.equal(LevelMinDeckDelta(make(7)), 1);
  assert.equal(LevelMinDeckDelta(make(8)), 2);
  assert.equal(LevelMinDeckDelta(make(12)), 3);
  assert.equal(LevelMinDeckDelta(make(20)), 3);
  const run = make(12);
  assert.equal(deckEditBounds({}, DeckMinDelta(run)).min, deckRules.defaults.deckMinSize - 3);
});

test('the deck editor counter reads the lowered minimum', () => {
  const model = deckEditorModel({ registries, run: make(4) });
  assert.equal(model.counter.min, deckRules.defaults.deckMinSize - 1);
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
  assert.deepEqual(AuthoredPropertyIds('relic/goldenSprout'), []);
  assert.deepEqual(AuthoredPropertyIds('armament/greatsword'), []);
  const { validateContent } = await import('../src/model/validate.js');
  const bundle = { ...contentBundle, relics: [...contentBundle.relics, { id: 'badRelic', name: 'Bad', rarity: 'common', textTemplate: 'x', properties: ['nope'] }] };
  const problems = validateContent(bundle).errors.map(e => `${e.path}: ${e.msg}`).join('\n');
  assert.match(problems, /relics\.badRelic\.properties\[0\]/);
});

test('Basic Training, Graduate and the three min-slot relics do what their text says', async () => {
  const { unlimitedCardIds } = await import('../src/model/deckRules.js');
  const { ItemMinDeckDelta } = await import('../src/model/itemProperties.js');
  const { gameContent } = await import('../src/model/gameProfile.js');
  const holding = (...ids) => { const run = make(1); run.relics = [...ids]; return run; };
  assert.ok(unlimitedCardIds(holding('basicTraining')).includes('core.strike'), 'Basic Training opens unlimited Basic martial cards');
  assert.ok(!unlimitedCardIds(holding('basicTraining')).includes('core.cantrip'));
  assert.ok(!unlimitedCardIds(holding('graduate')).includes('core.cantrip'), 'an uncollected cantrip stays closed');
  const graduate = holding('graduate');
  graduate.collectedCardIds = [...graduate.collectedCardIds, 'core.cantrip'];
  assert.ok(unlimitedCardIds(graduate).includes('core.cantrip'), 'Graduate opens a collected cantrip');
  assert.ok(!unlimitedCardIds(holding('graduate')).includes('core.strike'));
  assert.equal(ItemMinDeckDelta(holding('threadbareSatchel')), 1);
  assert.equal(ItemMinDeckDelta(holding('threadbareSatchel', 'asceticsCord', 'pruningHook')), 3);
  const run = holding('threadbareSatchel');
  run.level.level = 12;
  assert.equal(deckEditBounds({}, DeckMinDelta(run)).min, deckRules.defaults.deckMinSize - 4, 'levels (3 at level 12) and relics stack');
  const pool = gameContent(make(1), 'rewards').eligibility?.relics?.allow || [];
  for (const id of ['basicTraining', 'graduate', 'threadbareSatchel', 'asceticsCord', 'pruningHook']) {
    assert.ok(registries.relics.has(id), `${id} is a relic`);
    assert.ok(pool.includes(id), `${id} is in the Core relic pool`);
  }
});

// Review of #2815 (high): Basic Training and Graduate open only collected, own-class or colorless cards of a
// training rarity — never an uncollected rare, another class's card or an enemy move (SPEC §14.1).
test('a Starseer with Basic Training cannot add Skullsplitter or an enemy move; collected basics only', async () => {
  const { unlimitedCardIds, commitDeckEditDraft } = await import('../src/model/deckRules.js');
  const { ItemUnlimitedCardIds, configuredDeckCopyLimit } = await import('../src/model/deckCopyLimit.js');
  const { executeRunEffects } = await import('../src/engine/actions.js');
  const { createRng } = await import('../src/engine/rng.js');
  const meta = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
  const run = createRunState({ seed: 11, classId: 'starseer', registries, runId: 'bt-starseer', profileMeta: meta });
  run.relics = [...(run.relics || []), 'basicTraining'];
  // Owner ruling 2026-11-21: the Starseer's ten-card starter is all spells, so no martial Basic is collected at the start; collect two.
  run.collectedCardIds.push('core.strike', 'core.defend');
  const ids = ItemUnlimitedCardIds(run);
  assert.ok(ids.length > 0 && ids.length < 20, `a short list, got ${ids.length}`);
  for (const forbidden of ['core.skullsplitter', 'wanderingSoldier.slash', 'blightHound.bite']) {
    assert.ok(!unlimitedCardIds(run).includes(forbidden), forbidden);
    assert.notEqual(configuredDeckCopyLimit(run, forbidden), Infinity, forbidden);
  }
  assert.ok(ids.every((id) => run.collectedCardIds.includes(id)), 'only collected definitions');
  // Even collected, another class's rare stays limited.
  executeRunEffects({ run, registries, rng: createRng(1) }, [{ op: 'addCardToDeck', card: 'core.skullsplitter' }]);
  assert.ok(!ItemUnlimitedCardIds(run).includes('core.skullsplitter'));
  // A mint of an enemy move is refused at the commit door.
  const edited = { deck: [...run.deck, { instanceId: 'edit:999', cardId: 'wanderingSoldier.slash', upgraded: false }], sideboard: run.sideboard, collectedCardIds: run.collectedCardIds };
  assert.throws(() => commitDeckEditDraft(registries, run, edited), /invent|copy limit|equipment/);
});

test('Graduate opens collected cantrips only', async () => {
  const { ItemUnlimitedCardIds } = await import('../src/model/deckCopyLimit.js');
  const meta = { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } };
  const run = createRunState({ seed: 11, classId: 'starseer', registries, runId: 'grad-starseer', profileMeta: meta });
  run.relics = [...(run.relics || []), 'graduate'];
  const ids = ItemUnlimitedCardIds(run);
  assert.ok(ids.includes('core.cantrip'), 'the starting cantrip');
  assert.ok(ids.every((id) => run.collectedCardIds.includes(id)));
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
  run.deck = run.deck.slice(0, 11);
  assert.equal(loadoutLeaveRefusal(registries, run, { settings: { deckMinSize: 10 } }), '');
  assert.match(loadoutLeaveRefusal(registries, run, { settings: { deckMinSize: 14 } }), /floor is 13/);
  const row = characterLadder(registries, make(1), undefined, { deckMinSize: 14 }).rows.find((r) => r.level === 4);
  assert.equal(row.grants.find((g) => g.kind === 'deckMinimumDown').amount, 13);
});

test('the ladder shows a deck minimum grant only if the minimum actually falls', async () => {
  const { characterLadder } = await import('../src/ui/models/CharacterSheetModel.js');
  const deckMinimumGrants = (settings) => characterLadder(registries, make(), undefined, settings).rows
    .flatMap(({ level, grants }) => grants.filter(({ kind }) => kind === 'deckMinimumDown').map(({ amount }) => [level, amount]));
  assert.deepEqual(deckMinimumGrants({ deckMinUnlimited: true }), []);
  assert.deepEqual(deckMinimumGrants({ deckMinSize: 2 }), [[4, 1]]);
});

// Owner, 2026-11-17 (decision on #2815): relics and levels may take the minimum below 8; only the hard safety
// floor of 1 holds, so a deck is never empty. A player's own lower setting is kept as set.
test('relics and levels may go below 8; the safety floor of 1 keeps a deck from ever being empty', async () => {
  const { deckMinimum } = await import('../src/model/loadout.js');
  const run = make(12);
  run.relics = ['threadbareSatchel', 'asceticsCord', 'pruningHook'];
  const delta = DeckMinDelta(run);
  assert.equal(deckRules.minimumReductionSafetyFloor, 1);
  assert.equal(deckEditBounds({}, delta).min, deckRules.defaults.deckMinSize - delta, 'below 8 is allowed');
  assert.ok(deckEditBounds({}, delta).min < 8);
  assert.equal(deckMinimum(registries, run), deckRules.defaults.deckMinSize - delta);
  assert.equal(deckEditBounds({ deckMinSize: 3 }, delta).min, 1, 'reductions stop at the safety floor');
  assert.equal(deckEditBounds({ deckMinUnlimited: true }, delta).min, 0, 'the player chose no minimum; nothing raises it');
});
