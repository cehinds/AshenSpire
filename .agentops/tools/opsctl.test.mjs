// .agentops/tools/opsctl.test.mjs — tests for the control-plane validator.
// Run: `node .agentops/tools/opsctl.test.mjs`. One line per test; exit 1 on any
// failure.
//
// The negative plants live in opsctl.runSelftest() and enter through the SAME
// functions the live `validate`/`verify` run uses (strictParse, validateSchema,
// semanticChecks) — no plant is handed to a predicate downstream of the check it
// is written to exercise. This test asserts (a) the real on-disk corpus is
// valid, (b) every plant is caught, and (c) the committed generated view has no
// drift from its JSON sources.

import { runValidate, runSelftest, renderGovernance, loadContracts, strictParse, validateSchema, ROOT, runWake, loadRuntime, computeCapsuleHash, runDrill, runCommand, runMigrate } from './opsctl.mjs';
import { readFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

let failures = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
  if (!ok) failures++;
}

// 1. The real, on-disk corpus parses, schema-validates, and is cross-consistent.
{
  const { contracts, errors } = runValidate();
  check('real corpus validates with zero errors', errors.length === 0, errors.join(' | '));
  check('all fifteen contracts loaded', Object.keys(contracts).length === 15, Object.keys(contracts).join(','));
}

// 2. Every negative plant is caught through the live entry points.
{
  const s = runSelftest();
  check('selftest ok (all plants caught)', s.ok, s.detail.join(' | '));
  check('selftest exercises >= 47 plants', s.results.length >= 47, String(s.results.length));
}

// 2b. Runtime: the seed ticket loads, its capsule is sealed, and the wake
// compiler emits a bounded capsule under the startup token budget.
{
  const rt = loadRuntime();
  check('runtime loads with zero errors', rt.errors.length === 0, rt.errors.join(' | '));
  check('seed ticket AS-1001 capsule present', !!rt.capsules['AS-1001']);
  if (rt.capsules['AS-1001']) {
    const cap = rt.capsules['AS-1001'];
    check('AS-1001 capsule seal matches its content', cap.current_hash === computeCapsuleHash(cap));
  }
  const w = runWake(ROOT, 'maker', 'AS-1001');
  check('wake succeeds for maker/AS-1001', (!w.errors || w.errors.length === 0), (w.errors || []).join(' | '));
  check('wake capsule under startup token hard limit (1500)', w.tokens !== undefined && w.tokens <= 1500, String(w.tokens));
  check('wake capsule within startup target (1200)', w.tokens !== undefined && w.tokens <= 1200, String(w.tokens));
  check('wake capsule names the ticket and IDENTITY', !!w.text && w.text.includes('AS-1001') && w.text.includes('IDENTITY'));
  const wrongActor = runWake(ROOT, 'data-architecture-lead', 'AS-1001');
  check('wake refuses an actor that does not own the capsule', wrongActor.errors && wrongActor.errors.length > 0);
}

// 2c. Reconstruction (clean-clone / context-wipe drills): the drill passes, frozen
// wake is byte-deterministic and git-independent, and a clean-room clone with a
// tampered/lost capsule is REJECTED (evidence loss is caught, not silently lost).
{
  const d = runDrill();
  check('reconstruction drill passes', d.ok, d.steps.filter((s) => !s.ok).map((s) => s.name).join(' | '));

  const f1 = runWake(ROOT, null, 'AS-1001', { frozen: true });
  const f2 = runWake(ROOT, null, 'AS-1001', { frozen: true });
  check('frozen wake is deterministic (two runs identical)', f1.text === f2.text);
  check('frozen wake is git-independent (as-recorded freshness)', !!f1.text && f1.text.includes('as-recorded'));

  // Clean-room clone: reconstruction depends only on committed files.
  const clone = resolve(tmpdir(), `agentops-test-${process.pid}-${Date.now()}`);
  try {
    mkdirSync(clone, { recursive: true });
    cpSync(ROOT, clone, { recursive: true });
    check('clean clone re-validates from committed files only', runValidate(clone).errors.length === 0);
    check('clean clone reproduces byte-identical frozen capsule', runWake(clone, null, 'AS-1001', { frozen: true }).text === f1.text);
    // Evidence-loss plant: delete the capsule in the clone while its lease and
    // event chain remain. Both `verify` (orphan guard) and `wake` must fail —
    // the loss is never silently dropped from the inventory.
    rmSync(resolve(clone, 'work/AS-1001/CURRENT.json'), { force: true });
    const lostValidate = runValidate(clone);
    check('evidence loss (deleted capsule) fails verify via orphan guard', lostValidate.errors.some((e) => e.includes('no work capsule')), lostValidate.errors.join(' | '));
    const lost = runWake(clone, null, 'AS-1001', { frozen: true });
    check('evidence loss (deleted capsule) also blocks wake', lost.errors && lost.errors.length > 0);
  } finally {
    try { rmSync(clone, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

// 3. The committed generated view has no drift from validated JSON.
{
  const { contracts, errors } = runValidate();
  if (errors.length) {
    check('generated view matches sources', false, 'corpus invalid');
  } else {
    const expected = renderGovernance(contracts) + '\n';
    let actual = '';
    try { actual = readFileSync(resolve(ROOT, 'generated/GOVERNANCE.md'), 'utf8'); } catch { /* missing */ }
    check('committed generated view is not drifted', actual === expected,
      actual === '' ? 'view missing' : 'view differs from render output');
  }
}

// 4. Focused unit assertions on the two primitives, for a legible failure signal.
{
  let dup = false; try { strictParse('{"k":1,"k":2}'); } catch { dup = true; }
  check('strictParse rejects duplicate keys', dup);
  let trail = false; try { strictParse('{} x'); } catch { trail = true; }
  check('strictParse rejects trailing content', trail);
  let frac = false; try { strictParse('1.'); } catch { frac = true; }
  check('strictParse rejects a fraction with no digits (1.)', frac);
  let exp = false; try { strictParse('1e'); } catch { exp = true; }
  check('strictParse rejects an exponent with no digits (1e)', exp);
  check('strictParse still accepts a well-formed number', strictParse('-12.5e+3') === -12500);
  check('validateSchema flags type mismatch', validateSchema(5, { type: 'string' }).length === 1);
  check('validateSchema accepts integer for number', validateSchema(5, { type: 'number' }).length === 0);
  check('validateSchema honours pattern', validateSchema('1.2', { type: 'string', pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$' }).length === 1);
}

// 5. Sanity: loadContracts surfaces a parse error for malformed input without throwing.
{
  const { contracts } = loadContracts();
  check('loadContracts returns owner-intent with owner id "constantine"',
    contracts['owner-intent'] && contracts['owner-intent'].owner.actor_id === 'constantine');
}

// 2d. Owner-command dry-run: valid command accepted with a decision event and no
// mutation; arbitrary/unauthorized/live commands rejected.
{
  const rt = loadRuntime();
  const hash = computeCapsuleHash(rt.capsules['AS-1001']);
  const valid = { schema: 'agentops/owner-command-request/v1', action: 'authorize-integration', actor: 'it-manager-iii', target: 'AS-1001', expected_current_hash: hash, candidate_oid: 'abc123' };
  const okRes = runCommand(ROOT, valid, { dryRun: true });
  check('owner-command dry-run accepts a valid authenticated command', okRes.ok, (okRes.errors || []).join(' | '));
  check('owner-command dry-run emits a DRY-RUN decision (no mutation)', !!okRes.decision && okRes.decision.result.includes('DRY-RUN'));
  const extra = { ...valid, shell: 'rm -rf /' };
  check('owner-command rejects arbitrary extra fields (no shell)', runCommand(ROOT, extra, { dryRun: true }).ok === false);
  const releaseByDeputy = { schema: 'agentops/owner-command-request/v1', action: 'authorize-release', actor: 'it-manager-iii', target: 'AS-1001', expected_current_hash: hash, candidate_oid: 'x' };
  check('owner-command rejects owner-exclusive release by deputy', runCommand(ROOT, releaseByDeputy, { dryRun: true }).ok === false);
  check('owner-command refuses live execution in this stage', runCommand(ROOT, valid, { dryRun: false }).ok === false);
}

// 2e. Owner HUD: committed, redacted, deterministic, carries the source-commit
// placeholder and no secret material.
{
  let hud = '';
  try { hud = readFileSync(resolve(ROOT, 'generated/hud/index.html'), 'utf8'); } catch { /* missing */ }
  check('HUD is generated and names the project', hud.includes('Owner HUD') && hud.includes('AshenSpire'));
  check('HUD carries the source-commit placeholder (injected at deploy)', hud.includes('__SOURCE_COMMIT__'));
  check('HUD carries no credential material', hud.length > 0 && !/(ghp_[A-Za-z0-9]|github_pat_|BEGIN [A-Z ]*PRIVATE KEY|Authorization:\s*Bearer)/.test(hud));
}

// 2f. Migration tooling: read-only inventory validates, classifies legacy
// sources, finds them present, and proposes genesis stubs without mutation.
{
  const inv = runMigrate(ROOT, { plan: false });
  check('migrate inventory succeeds', inv.ok, (inv.errors || []).join(' | '));
  check('migrate finds all declared legacy sources present', inv.ok && inv.missing.length === 0, (inv.missing || []).join(', '));
  const planned = runMigrate(ROOT, { plan: true });
  check('migrate --plan proposes >= 1 genesis stub', planned.ok && planned.stubs.length >= 1, String(planned.stubs && planned.stubs.length));
  check('proposed genesis stub is schema-shaped (work-capsule/v1)', planned.ok && planned.stubs.every((st) => st.schema === 'agentops/work-capsule/v1'));
}

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
