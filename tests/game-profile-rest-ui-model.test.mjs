import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { beginGameProfileRest, commitGameProfileRest } from '../src/model/gameProfileRest.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { smithingPlan } from '../src/model/smithing.js';
import { gameProfileRestModel, gameProfileSmithModel } from '../src/ui/models/GameProfileRestModel.js';
const profile = resolveGameProfile('core');
const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
function fixture() {
  const run = createRunState({ seed: 73, classId: 'reaver', registries, runId: 'rest-ui-test' });
  run.mapGraph = buildActMap(registries, createRng(73), run.seatOrder[0], 1);
  run.mapNodeId = 'n2_0';
  const visit = beginGameProfileRest(run, '1:n2_0');
  run.hp = 1; run.mana = 0; run.stamina = 0; run.smithingStones = 0;
  run.flaskCharges.hpCurrent = 0; run.flaskCharges.manaCurrent = 0;
  return { run, visit };
}

test('configured Rest uses exact non-mutating previews and preserves three service identities', () => {
  const { run, visit } = fixture();
  const before = structuredClone(run);
  const model = gameProfileRestModel(registries, run, visit);
  assert.deepEqual(model.services.map(row => row.id), ['strategize', 'smith', 'levelUp']);
  assert.equal(model.services.find(row => row.id === 'levelUp').available, false);
  assert.ok(model.services.find(row => row.id === 'levelUp').reason);
  const preview = model.services.find(row => row.id === 'strategize').preview;
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
  const spent = gameProfileRestModel(registries, run, run.gameProfileRestVisits[visit.id]);
  assert.ok(spent.services.every(row => !row.available && row.reason));
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
