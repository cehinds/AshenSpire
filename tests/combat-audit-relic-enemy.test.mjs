import test from 'node:test';
import assert from 'node:assert/strict';
import { runRelicEnemyAudit } from '../tools/combat-audit/relic-enemy.mjs';
import { loadAuditRuntime } from '../tools/combat-audit/runtime.mjs';

for (const mode of ['native', 'bundled']) {
  test(`relic, status, enemy and encounter audit has explicit coverage under ${mode} loading`, async () => {
    const { registries } = await loadAuditRuntime(mode);
    const statusCount = registries.statuses.all().length;
    const report = await runRelicEnemyAudit(mode);
    assert.match(report.sourceRevision, /^[0-9a-f]{40}$/);
    assert.equal(report.loader, mode);
    assert.deepEqual(report.counts, {
      relics: 73, relicPropertyCarriers: 62, relicRules: 68, relicBranchesCovered: 68,
      relicConditionalFalseControls: 33, relicGatedBranches: report.counts.relicGatedBranches,
      relicGatedBranchesCovered: report.counts.relicGatedBranches,
      relicPassives: 27, relicPassiveDeclarations: 31, relicPassiveEffects: 19, relicPassiveNoOpDeclarations: 12,
      relicPassiveEffectsCovered: report.counts.relicPassiveEffects,
      statusModifierOutcomes: report.counts.statusModifierDeclarations, statusModifierDeclarations: report.counts.statusModifierDeclarations,
      statusProcBranches: 3, statusProcBranchesCovered: 3,
      statusSilencedConsumerPathsCovered: 3,
      statusModifierConsumerDeclarations: 20, statusModifierConsumerOutcomesCovered: 20,
      statusResistanceBranches: 3, statusResistanceBranchesCovered: 3, statusControlBranches: 4, statusControlBranchesCovered: 4,
      statusTaggedVulnerabilityBranches: 3, statusTaggedVulnerabilityCovered: 3,
      statuses: statusCount, statusesCovered: statusCount, enemies: 33, enemyMoves: 103, enemyMovesCovered: 103,
      enemyReactionMoves: 2, enemyReactionScenariosCovered: 4, encounters: 35, classes: 4, encounterClassScenarios: 140, encounterClassCovered: 140,
    });
    assert.equal(report.relics.missing.length, 0);
    assert.equal(report.relics.conditionalBranches, 33);
    assert.equal(report.relics.conditionalNegativeControls, 33);
    assert.equal(report.relics.gatedBranchesCovered, report.relics.gatedBranches);
    assert.equal(report.relics.relicCoverage.length, 73);
    assert.equal(report.relics.passiveIds, 27);
    assert.equal(report.relics.passiveMissing.length, 0);
    assert.equal(report.relics.passiveEffects, 19);
    assert.equal(report.relics.passiveNoOpDeclarations, 12);
    assert.equal(report.relics.passiveDeclarations, 31);
    assert.deepEqual(report.relics.passiveEffectRows.map(row => `${row.relicId}:${row.key}`).sort(), [
      'ancestralHorn:powerCostReduction', 'cinderPouch:runeGainMult', 'crackedTear:flaskPowerMult', 'curedHide:poiseThresholdAdd',
      'emberFragment:restHealMult', 'feralEye:eliteExtraCardReward', 'forsakenMedallion:modifiers', 'paupersDiadem:powerCostReduction',
      'paupersDiadem:runeGainMult', 'prismaticThorn:exposureBuildupMult', 'prismaticThorn:flaskPowerMult', 'restlessClasp:flaskPowerMult',
      'restlessClasp:restHealMult', 'saltedRelic:runeGainMult', 'sealstoneKey:revealUnknown', 'starstoneShard:modifiers',
      'wayfarersKnot:restHealMult', 'wayfarersKnot:runeGainMult', 'wyrmHeart:restDenied',
    ]);
    assert.ok(report.relics.passiveEffectRows.every(row => row.result === 'covered' && row.observed !== null));
    assert.deepEqual(report.relics.passiveNoOpRows.map(row => `${row.relicId}:${row.key}`).sort(), [
      'cutpursesCoin:modifiers', 'goldFigurine:modifiers', 'progression-cinderbound-crown:modifiers',
      'progression-cracked-war-anvil:modifiers', 'progression-ember-alms-bowl:modifiers', 'progression-emberjaw-token:modifiers',
      'progression-fragment-of-the-third-sky:modifiers', 'progression-moonwell-lens:modifiers', 'progression-nightglass-rosary:modifiers',
      'progression-ossuary-prayer-wheel:modifiers', 'progression-purse-of-borrowed-shadows:modifiers', 'progression-whisperglass-die:modifiers',
    ]);
    assert.ok(report.relics.passiveNoOpRows.every(row => row.result === 'no-op-declaration'));
    assert.deepEqual(report.relics.passiveEffectRows.filter(row => row.key !== 'modifiers').map(row => row.key).sort(), [
      'eliteExtraCardReward', 'exposureBuildupMult', 'flaskPowerMult', 'flaskPowerMult', 'flaskPowerMult',
      'poiseThresholdAdd', 'powerCostReduction', 'powerCostReduction', 'restDenied', 'restHealMult', 'restHealMult',
      'restHealMult', 'revealUnknown', 'runeGainMult', 'runeGainMult', 'runeGainMult', 'runeGainMult',
    ]);
    assert.equal(report.statuses.applyAndDecayCovered, statusCount);
    assert.equal(report.statuses.modifierOutcomesCovered, report.statuses.modifierDeclarations);
    assert.equal(report.statuses.procBranchesCovered, 3);
    assert.equal(report.statuses.resistanceBranchesCovered, 3);
    assert.equal(report.silencedConsumerPaths.rows.length, 3);
    assert.equal(report.silencedConsumerPaths.covered, 3);
    assert.ok(report.silencedConsumerPaths.normativeContract.includes('combatExpansionVersion 2'));
    assert.equal(report.statusModifierConsumers.declarations, 20);
    assert.equal(report.statusModifierConsumers.covered, 20);
    const meterGrowth = report.statusModifierConsumers.rows.find(row => row.statusId === 'goreblood' && row.key === 'meterMaxGrowthDisabled');
    assert.deepEqual({ baseline: meterGrowth.baseline, observed: meterGrowth.observed, expected: meterGrowth.expected }, { baseline: 13, observed: 10, expected: 10 });
    assert.deepEqual(report.statusModifierConsumers.rows.map(row => `${row.statusId}:${row.key}`).sort(), [
      'confused:damageDealtMult', 'dexterity:blockAdd', 'entombed:damageTakenMult', 'entombed:skipTurn',
      'frail:blockGainedMult', 'glassCannon:damageDealtMult', 'glassCannon:damageTakenMult', 'goreblood:meterMaxGrowthDisabled',
      'silenced:spellDamageDealtMult', 'slowed:blockGainedMult', 'slowed:damageDealtMult', 'staggered:damageTakenMult',
      'stoneskin:retainBlock', 'strength:attackDamageAdd', 'unbreakable:blockCap', 'unbreakable:retainBlock',
      'unbreakableUp:blockCap', 'unbreakableUp:retainBlock', 'vulnerable:damageTakenMult', 'weak:damageDealtMult',
    ]);
    assert.equal(report.statusControls.covered, 4);
    assert.equal(report.taggedVulnerabilities.covered, 3);
    assert.equal(report.statuses.missing.length, 0);
    assert.equal(report.enemies.reactionMoves, 2);
    assert.equal(report.enemies.reactionCovered, 4);
    assert.deepEqual(report.enemies.reactionRows.filter(row => row.caseId === 'chance-taken' || row.caseId === 'chance-declined').map(row => row.caseId).sort(), ['chance-declined', 'chance-taken']);
    assert.ok(report.enemies.rows.every(row => row.effectRows?.length && row.effectRows.every(effect => effect.observed)));
    assert.ok(report.enemies.reactionRows.filter(row => row.moveId === 'bindingRiposte').every(row => row.chanceRollDraws === 1 && row.settled && row.observed === row.expected));
    assert.ok(report.enemies.reactionRows.filter(row => row.moveId === 'bindingRiposte').every(row => row.reactionDamageTargetIds.every(id => id === 'player')));
    assert.equal(report.enemies.missing.length, 0);
    assert.equal(report.encounters.missing.length, 0);
    assert.ok(report.encounters.rows.every(row => row.result === 'covered' && row.victory === 'victory' && row.victorySettled
      && row.targetProbes.length === row.enemyCount && row.targetProbes.every(probe => probe.cardId === 'crawlingShot' && probe.targetPlan
        && probe.paid && probe.energyPaid > 0 && probe.staminaPaid > 0 && probe.hitRange === 'reach' && probe.damage > 0
        && probe.hpAfter < probe.hpBefore && probe.died)));
  });
}
