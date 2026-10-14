import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCardEffectContracts } from '../tools/combat-audit/card-effect-contracts.mjs';

for (const mode of ['native', 'bundled']) test(`focused authored card-effect contracts: ${mode}`, async () => {
  const report = await auditCardEffectContracts({ mode });
  assert.equal(report.inventory.cards, 304);
  assert.equal(report.inventory.classes, 4);
  assert.equal(report.failures.length, 0);
  for (const op of ['buildup', 'poiseDamage', 'enterStance', 'draw', 'applyStatus', 'gainBarrier', 'removeStatus', 'loseHp', 'gainEnergy', 'addCard', 'grantRollMode', 'restoreMana', 'gainWard', 'discard', 'grantCardCharge']) {
    assert.ok(report.contracts.some(row => row.op === op) || report.neutral.some(row => row.op === op), `${mode}: ${op} has a paid-play result`);
  }
  assert.ok(report.contracts.some(row => row.op === 'keyword:retain' && row.result === 'owner-turn-retained'));
  assert.ok(report.contracts.some(row => row.op === 'keyword:exhaust' && row.result === 'played-to-exhaust'));
  for (const op of ['shuffleDiscardIntoDraw', 'retain', 'exhaust']) {
    assert.equal(report.candidates[op].authoredCount, 0, `${mode}: no card authors the ${op} DSL opcode`);
    assert.equal(report.unsupported.find(row => row.op === op).status, 'no-authored-card-op');
  }
  assert.equal(report.neutral.filter(row => row.op === 'restoreMana').length, 2, `${mode}: both attune variants correctly report net-neutral recovery after payment`);
});
