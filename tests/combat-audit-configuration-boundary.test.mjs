import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { auditCards, auditRefusals, auditConditionalCards, auditCounterLifecycle, auditDeferredConditions,
  parseCardAuditArgs, cardAuditHelp } from '../tools/combat-audit/cards.mjs';

const configuration = 'configured-defaults';
const cli = fileURLToPath(new URL('../tools/combat-audit/cards.mjs', import.meta.url));

for (const mode of ['native', 'bundled']) {
  test(`${mode}: configured card APIs reject unvalidated modes and unknown options before execution`, async () => {
    for (const audit of [auditConditionalCards, auditCounterLifecycle, auditDeferredConditions]) {
      await assert.rejects(audit({ mode, configuration }), /Configured defaults support only/);
    }
    for (const options of [{}, { allVariants: false }, { allVariants: true, allEnemies: true }]) {
      await assert.rejects(auditCards({ mode, configuration, ...options }), /Configured defaults support only/);
    }
    await assert.rejects(auditCards({ mode, configuration, allVariants: true, typo: true }), /Unknown configured card-audit options: typo/);
    await assert.rejects(auditRefusals({ mode, configuration, allEnemies: true }), /Unknown configured card-audit options: allEnemies/);
    // Invalid loader errors would win if unsupported combinations reached the
    // loader. This establishes that rejection precedes either engine's setup.
    await assert.rejects(auditCounterLifecycle({ mode: 'invalid', configuration }), /Configured defaults support only/);
  });

  test(`${mode}: configured CLI routes only full variants and refusals without dropping settings`, () => {
    const loader = mode === 'bundled' ? ['--bundled'] : [];
    assert.deepEqual(parseCardAuditArgs(['--all-variants', '--configured-defaults', ...loader]), {
      help: false, audit: 'cards', options: { mode, configuration, allVariants: true, allEnemies: false },
    });
    assert.deepEqual(parseCardAuditArgs(['--refusals', '--configured-defaults', ...loader]), {
      help: false, audit: 'refusals', options: { mode, configuration },
    });
    for (const flags of [[], ['--conditions'], ['--counter-lifecycle'], ['--deferred-conditions'],
      ['--all-variants', '--all-enemies']]) {
      const result = spawnSync(process.execPath, [cli, '--configured-defaults', ...flags, ...loader], { encoding: 'utf8' });
      assert.equal(result.status, 2, flags.join(' '));
      assert.match(result.stderr, /Configured defaults support only/);
      assert.equal(result.stdout, '', 'unsupported invocation emits no audit report or fallback result');
    }
  });
}

test('supported configured exported APIs pass the scope guard and reach the selected loader', async () => {
  await assert.rejects(auditCards({ mode: 'invalid', configuration, allVariants: true }), /Unknown audit loader/);
  await assert.rejects(auditRefusals({ mode: 'invalid', configuration }), /Unknown audit loader/);
});

test('CLI rejects conflicting and ignored mode flags and unknown configured options', () => {
  for (const args of [
    ['--configured-defaults', '--all-variants', '--refusals'],
    ['--configured-defaults', '--conditions', '--counter-lifecycle'],
    ['--configured-defaults', '--refusals', '--all-enemies'],
    ['--configured-defaults', '--all-variants', '--unknown-option'],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /apply only|Conflicting card-audit modes|Unknown card-audit option/);
    assert.equal(result.stdout, '');
  }
});

test('raw CLI selections retain their authored scope and help runs no audit', () => {
  assert.deepEqual(parseCardAuditArgs([]), { help: false, audit: 'cards',
    options: { mode: 'native', configuration: 'raw-authored', allVariants: false, allEnemies: false } });
  assert.deepEqual(parseCardAuditArgs(['--all-variants', '--all-enemies', '--bundled']), { help: false, audit: 'cards',
    options: { mode: 'bundled', configuration: 'raw-authored', allVariants: true, allEnemies: true } });
  for (const audit of ['conditions', 'refusals', 'counter-lifecycle', 'deferred-conditions']) {
    assert.deepEqual(parseCardAuditArgs([`--${audit}`]), { help: false, audit,
      options: { mode: 'native', configuration: 'raw-authored' } });
  }
  const result = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout.trim(), cardAuditHelp);
  assert.match(result.stdout, /--all-variants --configured-defaults/);
  assert.match(result.stdout, /--refusals --configured-defaults/);
  assert.match(result.stdout, /Counter-lifecycle and deferred-condition audits are unsupported/);
});
