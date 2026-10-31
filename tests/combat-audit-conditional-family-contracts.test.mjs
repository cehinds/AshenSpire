import test from 'node:test';
import assert from 'node:assert/strict';
import { auditConditionalFamilyContracts } from '../tools/combat-audit/conditional-family-contracts.mjs';

const predicates = [
  { p: 'not', pred: { p: 'inStance', stance: 'bulwark' } },
  { p: 'not', pred: { p: 'hasStatus', of: 'target', status: 'staggered' } },
  { p: 'hasStatus', of: 'target', status: 'staggered' },
  { p: 'not', pred: { p: 'hasStatus', of: 'self', status: 'starstoneCharge' } },
  { p: 'not', pred: { p: 'hpBelowPct', of: 'self', pct: 50 } },
];
for (const mode of ['native', 'bundled']) test(`five remaining predicate families have exact paired state totals: ${mode}`, async () => {
  const report = await auditConditionalFamilyContracts({ mode });
  assert.equal(report.families.length, 5);
  assert.equal(report.plays.length, 8, 'Executioner paid pair proves both complementary families');
  assert.deepEqual(report.families.map(row => row.predicate), predicates);
  for (const family of report.families) {
    assert.equal(family.predicateJson, JSON.stringify(family.predicate));
    assert.deepEqual(family.branches.map(branch => branch.truth).sort(), [false, true]);
    for (const branch of family.branches) {
      const play = report.plays.find(play => play.key === branch.playKey);
      assert.ok(play); assert.equal(play.paid.cardId, family.cardId);
      assert.equal(play.expected.selectedEffectIndices.includes(family.effectIndex), branch.truth,
        'family positive selects that authored effect; negative selects the real complement');
      assert.equal(play.paid.targetId, play.selectedTargetId);
      assert.ok(play.paid.staminaSpent > 0);
      assert.equal(play.expected.ratingBonus, 0, 'canonical fixture preserves its authored carrier and absent ratings configuration');
      assert.equal(play.fixture.combatExpansionVersion, 2);
      assert.equal(play.fixture.reactionRulesVersion, 2);
      assert.deepEqual(play.fixture.modifiedRuleFlags, [], 'current rules remain intact');
    }
  }
  const paired = id => report.plays.filter(row => row.instance.cardId === id);
  const iron = paired('ironResolve');
  assert.deepEqual(iron.map(row => [row.after.player.block, row.after.player.barrier]), [[13, 5], [19, 5]],
    'Iron Resolve:5/9 selected Block +3entry +5restore, plus2Bulwarkskillhook only in Bulwark');
  assert.equal(iron[1].expected.contributions.find(c => c.kind === 'bulwark-skill-hook').block, 2);
  const executioner = paired('executioner');
  assert.deepEqual(executioner.map(row => row.before.target.hp - row.after.target.hp), [18, 67],
    'Executioner uses projected18/45, with floor45×1.5 only on the Staggered branch');
  assert.ok(executioner.every(row => row.selectedTargetId === 'e2'));
  assert.equal(executioner[1].after.target.statuses.staggered.stacks, 1);
  const ward = paired('umbralWard');
  assert.deepEqual(ward.map(row => [row.after.player.block, row.after.player.barrier]), [[19, 8], [27, 12]],
    'Counterstrike scales16/24→24/36, alteration splits70:30, entry adds2Block+1Barrier');
  assert.deepEqual(ward.map(row => row.after.player.statuses.starstoneCharge.stacks), [1, 1],
    'unique Starstone coeffect occurs after the branch and cannot double-select protection');
  const rite = paired('desperateRite');
  assert.ok(rite.every(row => row.instance.legacyAbility === true));
  assert.deepEqual(rite.map(row => row.before.target.hp - row.after.target.hp), [9, 16],
    'saved legacy face proves complement HP predicate with actual selected enemy HP');
  assert.ok(rite.every(row => row.selectedTargetId === 'e2'));
  assert.deepEqual(rite.map(row => row.after.target.gauges.necroticBlight.value), [4, 4],
    'legitimate coeffect keeps3authored+1Spell buildup in both branches');
  assert.equal(rite[0].before.player.hp, 5001); assert.equal(rite[1].before.player.hp, 4999);
});
