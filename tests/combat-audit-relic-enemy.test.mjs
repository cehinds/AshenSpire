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
      statuses: 69, statusesCovered: 69, enemies: 33, enemyMoves: 103, enemyMovesCovered: 103,
      enemyReactionMoves: 2, enemyReactionScenariosCovered: 4, encounters: 35, classes: 4, encounterClassScenarios: 140, encounterClassCovered: 140,
    });
    assert.equal(report.relics.missing.length, 0);
    assert.equal(report.relics.conditionalBranches, 33);
    assert.equal(report.relics.conditionalNegativeControls, 33);
    assert.equal(report.relics.gatedBranchesCovered, report.relics.gatedBranches);
    assert.equal(report.relics.relicCoverage.length, 73);
    assert.equal(report.statuses.applyAndDecayCovered, 69);
    assert.equal(report.statuses.missing.length, 0);
    assert.equal(report.enemies.reactionMoves, 2);
    assert.equal(report.enemies.reactionCovered, 4);
    assert.deepEqual(report.enemies.reactionRows.filter(row => row.caseId === 'chance-taken' || row.caseId === 'chance-declined').map(row => row.caseId).sort(), ['chance-declined', 'chance-taken']);
    assert.equal(report.enemies.missing.length, 0);
    assert.equal(report.encounters.missing.length, 0);
  });
}
