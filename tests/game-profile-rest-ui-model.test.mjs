import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { beginGameProfileRest, commitGameProfileRest, restHealedAny, restCompletionKey, restIntroKey } from '../src/model/gameProfileRest.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { smithingPlan } from '../src/model/smithing.js';
import { gameProfileRestModel, gameProfileSmithModel } from '../src/ui/models/GameProfileRestModel.js';
const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fixture() {
  const run = createRunState({ seed: 73, classId: 'reaver', registries, runId: 'rest-ui-test' });
  run.mapGraph = buildActMap(registries, createRng(73), run.seatOrder[0], 1);
  run.mapNodeId = 'n3_0';
  const visit = beginGameProfileRest(run, '1:n3_0');
  run.hp = 1; run.mana = 0; run.stamina = 0; run.smithingStones = 0;
  run.flaskCharges.hpCurrent = 0; run.flaskCharges.manaCurrent = 0;
  return { run, visit };
}

test('configured Rest uses exact non-mutating previews and preserves the two service identities (D10: Strategize is gone)', () => {
  const { run, visit } = fixture();
  const before = structuredClone(run);
  const model = gameProfileRestModel(registries, run, visit);
  assert.deepEqual(model.services.map(row => row.id), ['smith', 'levelUp']);
  assert.equal(model.services.find(row => row.id === 'levelUp').available, false);
  assert.ok(model.services.find(row => row.id === 'levelUp').reason);
  const preview = model.services.find(row => row.id === 'smith').preview;
  assert.equal(preview.hp, preview.maxHp);
  assert.equal(preview.flaskCharges.hpCurrent, preview.flaskCharges.hp);
  assert.deepEqual(run, before, 'opening or cancelling a review has no transaction to undo');
});

test('a free Smith quote and shared review agree with the configured commit at zero stones', () => {
  const { run, visit } = fixture();
  const before = structuredClone(run);
  const model = gameProfileRestModel(registries, run, visit);
  const candidate = model.smith.candidates.find(row => model.smithPreviews.get(row.itemRef).available);
  assert.ok(candidate);
  assert.equal(candidate.cost, 0); assert.equal(candidate.shortfall, 0); assert.equal(candidate.affordable, true);
  const review = gameProfileSmithModel(registries, model.smith, model.smithPreviews, candidate.itemRef, after => `HP ${after.hp}`);
  assert.equal(review.properties.canConfirm, true);
  assert.equal(review.properties.selected.cost, 0);
  assert.match(review.properties.servicePreviewHtml, /HP/);
  assert.deepEqual(run, before);
  const expected = model.smithPreviews.get(candidate.itemRef).preview;
  commitGameProfileRest(registries, run, 'smith', { itemRef: candidate.itemRef });
  assert.deepEqual(run, expected);
  assert.equal(run.smithingStones, 0);
  // D10: Smith being used leaves Level Up usable in the same visit (not exclusive).
  const spent = gameProfileRestModel(registries, run, run.gameProfileRestVisits[visit.id]);
  assert.equal(spent.services.find(row => row.id === 'smith').available, false);
  assert.ok(spent.services.find(row => row.id === 'smith').reason);
});

test('earned Constitution selection previews its new maximum and exactly matches confirmation', () => {
  const { run, visit } = fixture(); run.level.unspentPoints = 1;
  const before = structuredClone(run);
  const model = gameProfileRestModel(registries, run, visit);
  const con = model.attributes.find(row => row.id === 'constitution');
  assert.equal(con.available, true);
  assert.equal(con.preview.maxHp, run.maxHp + 10);
  assert.equal(con.preview.hp, con.preview.maxHp);
  assert.deepEqual(run, before);
  commitGameProfileRest(registries, run, 'levelUp', { attributeId: 'constitution' });
  assert.deepEqual(run, con.preview);
});

test('normal Smithing quotes keep their authored cost and affordability', () => {
  const { run } = fixture();
  const ordinary = smithingPlan(registries, run);
  const free = smithingPlan(registries, run, undefined, { free: true });
  assert.deepEqual(ordinary.candidates.map(row => row.itemRef), free.candidates.map(row => row.itemRef));
  assert.ok(ordinary.candidates.some(row => row.cost > 0 && !row.affordable));
  assert.ok(free.candidates.every(row => row.cost === 0 && row.affordable));
});

test('the deck editor exposes only authored basics and rejects the legacy attack mint before mutation', async () => {
  const { deckEditorModel, openDeckEdit, deckVariantKey } = await import('../src/ui/models/DeckEditorModel.js');
  const { createGameProfileRestDraft } = await import('../src/model/gameProfileRest.js');
  const { run } = fixture();
  const draft = createGameProfileRestDraft(run);
  const session = openDeckEdit(registries, draft);
  const before = structuredClone(draft);
  const editor = deckEditorModel({ registries, run: draft });
  const allowed = ['core.strike', 'core.defend', 'core.counter', 'core.smash', 'core.sweep', 'core.evade'];
  const mints = editor.collection.filter(tile => tile.unlimited);
  assert.deepEqual(mints.map(tile => tile.cardId).sort(), [...allowed].sort());
  assert.equal(editor.collection.some(tile => tile.key === 'basic:attack' || tile.key === 'basic:guard'), false);
  assert.throws(() => session.add('basic:attack'), /not an unlimited card id/);
  assert.deepEqual(draft, before, 'the formerly enabled legacy tile cannot alter a configured draft');
  const removed = draft.deck.find(card => card.cardId === 'base.draw');
  assert.equal(session.remove(removed.instanceId).ok, true);
  assert.equal(draft.deck.length, run.deck.length - 1);
  assert.equal(draft.sideboard.some(card => card.instanceId === removed.instanceId), true);
  assert.equal(session.add(`card:${deckVariantKey(removed)}`).ok, true);
  assert.equal(draft.deck.at(-1).instanceId, removed.instanceId);
  assert.equal(session.confirm().ok, true);
  assert.throws(() => commitGameProfileRest(registries, run, 'strategize', { draft }), /Unknown rest service/, 'D10: deck editing is not a rest service');
});

test('the editor follows an explicit nonempty configured basic policy without legacy equipment slots', async () => {
  const { deckEditorModel, openDeckEdit } = await import('../src/ui/models/DeckEditorModel.js');
  const { run } = fixture();
  // With training disabled, the explicit editor policy remains the fallback.
  run.gameProfile = { ...run.gameProfile, modules: { ...run.gameProfile.modules, 'deck-training': false }, content: { ...run.gameProfile.content,
    editor: { unlimitedBasicCards: ['core.strike'] },
  } };
  const model = deckEditorModel({ registries, run });
  assert.deepEqual(model.collection.filter(tile => tile.unlimited).map(tile => tile.key), ['basic:core.strike']);
  const slots = run.equipmentAttackSlotCount;
  const session = openDeckEdit(registries, run);
  assert.equal(session.add('basic:core.strike').ok, true);
  assert.equal(run.deck.at(-1).cardId, 'core.strike');
  assert.equal(run.deck.at(-1).equipmentRole, undefined);
  assert.equal(run.equipmentAttackSlotCount, slots);
  session.cancel();
});

test('arriving with full pools but a spent flask records the flask refill (review finding)', () => {
  const run = createRunState({ seed: 74, classId: 'reaver', registries, runId: 'rest-flask-heal' });
  run.mapGraph = buildActMap(registries, createRng(74), run.seatOrder[0], 1);
  run.mapNodeId = 'n3_0';
  run.hp = run.maxHp; run.mana = run.maxMana; run.stamina = run.maxStamina;
  run.flaskCharges.hpCurrent = 0;
  const visit = beginGameProfileRest(run, '1:n3_0');
  assert.equal(visit.healed.hp + visit.healed.mana + visit.healed.stamina, 0);
  assert.ok(visit.healed.flaskHp > 0);
  assert.equal(restHealedAny(visit.healed), true);
  assert.equal(restHealedAny({ hp: 0, mana: 0, stamina: 0 }), false, 'older saves count missing flask fields as 0');
});

test('the rest completion copy follows what is actually still open (review finding)', () => {
  const rows = (smith, level) => [{ id: 'smith', available: smith }, { id: 'levelUp', available: level }];
  const used = ids => id => ids.includes(id);
  assert.equal(restCompletionKey(rows(true, true), used([])), 'chooseAll');
  assert.equal(restCompletionKey(rows(false, true), used(['smith'])), 'completeAll');
  assert.equal(restCompletionKey(rows(false, false), used(['smith'])), 'completeDoneAll', 'no earned point left');
  assert.equal(restCompletionKey(rows(false, false), used(['smith', 'levelUp'])), 'completeDoneAll');
});

test('the all-services intro names Smith and Level Up only when those are exactly the services', () => {
  const ids = (...list) => list.map(id => ({ id }));
  assert.equal(restIntroKey(ids('smith', 'levelUp')), 'chooseAll');
  assert.equal(restIntroKey(ids('levelUp', 'smith')), 'chooseAll');
  assert.equal(restIntroKey(ids('strategize')), 'chooseAllAny');
  assert.equal(restIntroKey(ids('strategize', 'smith', 'levelUp')), 'chooseAllAny');
  assert.equal(restIntroKey(ids('smith')), 'chooseAllAny');
});
