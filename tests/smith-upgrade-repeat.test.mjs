import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { smithingPlan, commitSmithing } from '../src/model/smithing.js';
import { smithSelectionModel } from '../src/ui/models/SmithSelectionModel.js';

const registries = createRegistries(contentBundle);

test('a repeat upgrade session refreshes the purse and candidates after each commit', () => {
  const run = createRunState({ seed: 211, classId: 'reaver', registries });
  run.smithingStones = 3;
  for (let remaining = 3; remaining > 0; remaining--) {
    const plan = smithingPlan(registries, run);
    const candidate = plan.candidates.find(item => item.affordable);
    assert.ok(candidate);
    const model = smithSelectionModel(registries, plan, candidate.itemRef, { repeatUpgrades: true });
    assert.equal(model.properties.canConfirm, true);
    assert.equal(model.properties.staysAtShrine, remaining > candidate.cost);
    assert.match(model.properties.purseLabel, new RegExp(`^${remaining} Smithing Stone`));
    const receipt = commitSmithing(registries, run, candidate.itemRef);
    assert.equal(run.smithingStones, remaining - receipt.cost);
    const next = smithSelectionModel(registries, smithingPlan(registries, run), null, { repeatUpgrades: true });
    assert.equal(next.properties.selected, null);
    assert.equal(next.properties.canConfirm, false);
    const updated = next.properties.candidates.find(item => item.itemRef === candidate.itemRef);
    if (updated) assert.equal(updated.currentLevel, receipt.afterLevel);
  }
  assert.equal(run.smithingStones, 0);
});

test('multi-use sites keep the visit after the last stone; one-shot callers keep their existing exit', () => {
  const run = createRunState({ seed: 212, classId: 'reaver', registries });
  run.smithingStones = 3;
  const plan = smithingPlan(registries, run);
  const selected = plan.candidates.find(item => item.affordable).itemRef;
  assert.equal(smithSelectionModel(registries, plan, selected).properties.staysAtShrine, false);
  run.smithingStones = 1;
  const last = smithingPlan(registries, run);
  assert.equal(smithSelectionModel(registries, last, selected, { repeatUpgrades: true, multiUse: true }).properties.staysAtShrine, true);
  assert.equal(smithSelectionModel(registries, last, selected, { repeatUpgrades: true }).properties.staysAtShrine, false);
});
