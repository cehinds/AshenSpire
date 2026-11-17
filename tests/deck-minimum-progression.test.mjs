// Owner, 2026-11-17 (playtest theme D, items 22-23): character levels and
// min-slot relics lower the deck editor's minimum in Core.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { deckRules } from '../src/content/deckRules.js';
import { deckEditBounds, deckMinDelta, levelMinDeckDelta } from '../src/model/deckRules.js';
import { deckEditorModel } from '../src/ui/models/DeckEditorModel.js';

const core = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, core)), core);
const make = (level = 1) => {
  const run = createRunState({ seed: 11, classId: 'reaver', registries, runId: 'deck-min' });
  run.level.level = level;
  return run;
};

test('the reduction levels are data and rise', () => {
  assert.deepEqual([...deckRules.minimumReductionLevels], [6, 12]);
});

test('a Core run loses one minimum slot at each reduction level', () => {
  assert.equal(levelMinDeckDelta(make(1)), 0);
  assert.equal(levelMinDeckDelta(make(5)), 0);
  assert.equal(levelMinDeckDelta(make(6)), 1);
  assert.equal(levelMinDeckDelta(make(12)), 2);
  assert.equal(levelMinDeckDelta(make(20)), 2);
  const run = make(12);
  assert.equal(deckEditBounds({}, deckMinDelta(run)).min, deckRules.defaults.deckMinSize - 2);
});

test('the deck editor counter reads the lowered minimum', () => {
  const model = deckEditorModel({ registries, run: make(6) });
  assert.equal(model.counter.min, deckRules.defaults.deckMinSize - 1);
});

test('a legacy run keeps the settings minimum whatever its level', () => {
  const legacy = createRunState({ seed: 11, classId: 'reaver', registries: createRegistries(contentBundle) });
  legacy.level = { level: 12, xp: 0, unspentPoints: 0 };
  assert.equal(levelMinDeckDelta(legacy), 0);
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
  assert.ok(unlimitedCardIds(holding('graduate')).includes('core.cantrip'), 'Graduate opens unlimited cantrips');
  assert.ok(!unlimitedCardIds(holding('graduate')).includes('core.strike'));
  assert.equal(ItemMinDeckDelta(holding('threadbareSatchel')), 1);
  assert.equal(ItemMinDeckDelta(holding('threadbareSatchel', 'asceticsCord', 'pruningHook')), 3);
  const run = holding('threadbareSatchel');
  run.level.level = 12;
  assert.equal(deckEditBounds({}, deckMinDelta(run)).min, deckRules.defaults.deckMinSize - 3, 'levels and relics stack');
  const pool = gameContent(make(1), 'rewards').eligibility?.relics?.allow || [];
  for (const id of ['basicTraining', 'graduate', 'threadbareSatchel', 'asceticsCord', 'pruningHook']) {
    assert.ok(registries.relics.has(id), `${id} is a relic`);
    assert.ok(pool.includes(id), `${id} is in the Core relic pool`);
  }
});
