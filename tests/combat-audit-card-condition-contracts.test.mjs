import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCardConditionContracts, CONDITION_CARD_IDS } from '../tools/combat-audit/card-condition-contracts.mjs';

for (const mode of ['native', 'bundled']) test(`authored conditional outcomes and negative controls: ${mode}`, async () => {
  const report = await auditCardConditionContracts({ mode });
  assert.equal(report.failures.length, 0);
  assert.equal(report.contracts.length, 25);
  assert.equal(report.contracts.reduce((n, row) => n + row.branches.length, 0), 80);
  assert.equal(report.unconditionalFaces.length, 9, 'low grades and legacy Cinder Guard author no predicate');
  const expectedCounts = [4, 4, 5, 2, 5, 5];
  for (const [index, cardId] of CONDITION_CARD_IDS.entries()) {
    const rows = report.contracts.filter(row => row.cardId === cardId);
    assert.equal(rows.length, expectedCounts[index], `${cardId}: every class, grade and upgraded/legacy face`);
    for (const row of rows) {
      assert.ok(row.key.endsWith(`/effect:${row.effectIndex}`));
      assert.deepEqual(row.predicate, row.intended.if);
      assert.ok(row.branches.some(branch => branch.truth));
      assert.ok(row.branches.some(branch => !branch.truth));
      for (const branch of row.branches) {
        assert.equal(branch.paid.cardId, cardId);
        assert.equal(branch.paid.targetId, branch.selectedTargetId);
        assert.ok(branch.beforePlaySnapshot.player);
        assert.ok(branch.paid.staminaSpent > 0, 'branch really paid for a legal card');
      }
    }
    if (cardId.startsWith('progression-')) {
      assert.deepEqual(rows.filter(row => !row.instance.legacyAbility).map(row => row.instance.abilityRank).sort(), [2, 3, 4, 5]);
      assert.equal(rows.filter(row => row.instance.legacyAbility).length, cardId === 'progression-cinder-guard' ? 0 : 1);
    }
  }
  for (const row of report.contracts.filter(row => row.cardId === 'clearHead')) {
    const negative = row.branches.find(b => !b.truth), positive = row.branches.find(b => b.truth);
    assert.equal(positive.beforePlaySnapshot.player.statuses.dazed.stacks, 1);
    assert.equal(positive.after.dazed, 0);
    assert.equal(positive.after.roll.advantage, true);
    assert.equal(negative.after.roll, null);
  }
  for (const row of report.contracts.filter(row => row.cardId === 'progression-cinder-guard')) {
    const [negative, positive] = row.branches;
    assert.equal(positive.after.charges[row.intended.key].damage, row.intended.damage);
    assert.equal(negative.after.charges[row.intended.key], undefined);
    assert.equal(positive.followup.hpLost - negative.followup.hpLost, row.intended.damage);
    assert.equal(positive.afterFollowup.charges[row.intended.key], undefined);
  }
  for (const row of report.contracts.filter(row => row.predicate.p === 'any')) {
    assert.equal(row.branches.length, 4);
    assert.deepEqual(row.branches.map(b => b.truth), [false, true, true, false]);
    assert.deepEqual(row.branches.slice(1, 3).map(b => b.name), row.predicate.preds.map(p => p.status), 'each OR alternative proves its own positive branch');
    for (const branch of row.branches) if (row.op === 'buildup') {
      assert.equal(branch.selectedTargetId, 'e2', 'selected non-first enemy is audited');
      assert.equal(branch.receipts.length, branch.truth ? 1 : 0);
      if (branch.truth) assert.equal(branch.receipts[0].targetId, 'e2');
    }
  }
  for (const row of report.contracts.filter(row => row.cardId === 'progression-ossuary-cant')) {
    assert.equal(row.intended.amount, row.intended.funded);
    assert.equal(row.branches.at(-1).name, 'dead-only');
    for (const branch of row.branches) {
      assert.equal(branch.outcome, 'funded-neutral-after-payment');
      assert.equal(branch.after.energy, branch.before.energy - branch.paid.energySpent);
      assert.equal(branch.after.stamina, branch.before.stamina - branch.paid.staminaSpent);
      assert.equal(branch.receipts.length, branch.truth ? 1 : 0);
      if (branch.truth) assert.equal(branch.receipts[0].amount, 0);
    }
  }
  for (const row of report.contracts.filter(row => row.cardId === 'progression-requiem-brand')) {
    for (const branch of row.branches) {
      assert.equal(branch.after.statuses.weak?.stacks || 0, branch.truth ? 1 : 0,
        'Blight condition produces actual active Weak; negative gauge is unchanged');
    }
  }
  for (const row of report.contracts.filter(row => row.cardId === 'progression-wire-snare')) {
    for (const branch of row.branches) assert.equal(branch.after.statuses.bleeding?.stacks || 0,
      branch.truth ? 1 : 0, 'Weak or Vulnerable independently produces actual Bleeding');
  }
  for (const row of report.contracts.filter(row => row.cardId === 'blightBloom')) {
    const [negative, positive] = row.branches;
    assert.equal(positive.after.statuses.necroticBlight.stacks, 2, 'one active Necrotic Blight doubles to two');
    assert.equal(negative.after.statuses.necroticBlight, undefined);
  }
});
