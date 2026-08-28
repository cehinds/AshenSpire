import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconcileContinuityRoot, runContinuitySelfTest } from '../tools/continuity-reconcile.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function runContinuityReconcileContract() {
  const current = reconcileContinuityRoot(resolve(ROOT, 'ops/continuity'));
  const corpus = runContinuitySelfTest();
  const ok = current.ok && corpus.ok;
  return {
    ok,
    detail: ok
      ? `current revision ${current.revision} reconciled with ${current.integrityLinks} integrity links, ${current.featureChannels} feature channel(s), ${current.escalationItems} escalation item(s), and ${current.canonicalFiles} canonical manifest file(s); cold-start and refusal corpus ${corpus.passed}/${corpus.cases.length}`
      : `current findings: ${current.findings.join('; ') || 'none'}; corpus failures: ${corpus.cases.filter((entry) => !entry.passed).map((entry) => entry.name).join(', ') || 'none'}`,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const result = runContinuityReconcileContract();
  console.log(`${result.ok ? 'PASS' : 'FAIL'} continuity reconcile contract — ${result.detail}`);
  process.exit(result.ok ? 0 : 1);
}
