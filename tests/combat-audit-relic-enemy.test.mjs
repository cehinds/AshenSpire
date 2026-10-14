import test from 'node:test';
import assert from 'node:assert/strict';
import { runRelicEnemyAudit } from '../tools/combat-audit/relic-enemy.mjs';

for (const mode of ['native', 'bundled']) {
  test(`relic, status, enemy and encounter audit has explicit coverage under ${mode} loading`, async () => {
    const report = await runRelicEnemyAudit(mode);
    assert.deepEqual(report.counts, {
      relics: 73, relicPropertyCarriers: 62, relicRules: 68, relicBranchesCovered: 68,
      relicConditionalFalseControls: 33, relicGatedBranches: report.counts.relicGatedBranches,
      relicGatedBranchesCovered: report.counts.relicGatedBranches,
      relicPassives: 27, relicPassiveEffects: report.counts.relicPassiveEffects,
      relicPassiveEffectsCovered: report.counts.relicPassiveEffects,
      statusModifierOutcomes: report.counts.statusModifierDeclarations, statusModifierDeclarations: report.counts.statusModifierDeclarations,
      statusProcBranches: 3, statusProcBranchesCovered: 3,
      statusResistanceBranches: 3, statusResistanceBranchesCovered: 3, statusControlBranches: 4, statusControlBranchesCovered: 4,
      statusTaggedVulnerabilityBranches: 3, statusTaggedVulnerabilityCovered: 3,
      statuses: 69, statusesCovered: 69, enemies: 33, enemyMoves: 103, enemyMovesCovered: 103,
      enemyReactionMoves: 2, enemyReactionScenariosCovered: 4, encounters: 35, classes: 4, encounterClassScenarios: 140, encounterClassCovered: 140,
    });
    assert.equal(report.relics.missing.length, 0);
    assert.equal(report.relics.conditionalBranches, 33);
    assert.equal(report.relics.conditionalNegativeControls, 33);
    assert.equal(report.relics.gatedBranchesCovered, report.relics.gatedBranches);
    assert.equal(report.relics.relicCoverage.length, 73);
    assert.equal(report.relics.passiveIds, 27);
    assert.equal(report.relics.passiveMissing.length, 0);
    assert.equal(report.statuses.applyAndDecayCovered, 69);
    assert.equal(report.statuses.modifierOutcomesCovered, report.statuses.modifierDeclarations);
    assert.equal(report.statuses.procBranchesCovered, 3);
    assert.equal(report.statuses.resistanceBranchesCovered, 3);
    assert.equal(report.statusControls.covered, 4);
    assert.equal(report.taggedVulnerabilities.covered, 3);
    assert.equal(report.statuses.missing.length, 0);
    assert.equal(report.enemies.reactionMoves, 2);
    assert.equal(report.enemies.reactionCovered, 4);
    assert.deepEqual(report.enemies.reactionRows.filter(row => row.caseId === 'chance-taken' || row.caseId === 'chance-declined').map(row => row.caseId).sort(), ['chance-declined', 'chance-taken']);
    assert.equal(report.enemies.missing.length, 0);
    assert.equal(report.encounters.missing.length, 0);
  });
}
