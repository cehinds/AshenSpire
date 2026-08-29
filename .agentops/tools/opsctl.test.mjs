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

import { runValidate, runSelftest, renderGovernance, loadContracts, strictParse, validateSchema, ROOT, runWake, loadRuntime, computeCapsuleHash, runDrill, runCommand, runMigrate, parseIssueCommand } from './opsctl.mjs';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
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
  check('owner-command dry-run performs no mutation', readFileSync(resolve(ROOT, 'work/AS-1001/CURRENT.json'), 'utf8').includes(hash.replace('sha256:', '')));
}

// 2d-bis. Owner-command LIVE executor (`--apply`), exercised in a throwaway copy
// so the real corpus is never mutated. Proves: an undeclared/unpermitted
// lifecycle move is refused, a legal one is applied append-only under CAS, the
// applied corpus still validates, and a replay of the same command is stale.
{
  const box = resolve(tmpdir(), `agentops-apply-${process.pid}-${Date.now()}`);
  try {
    mkdirSync(box, { recursive: true });
    cpSync(ROOT, box, { recursive: true });
    const capPath = resolve(box, 'work/AS-1001/CURRENT.json');
    const readCap = () => strictParse(readFileSync(capPath, 'utf8'));

    // The seed capsule is in-progress: authorize-integration has no declared
    // transition from there, so it must be refused with nothing written.
    const before = loadRuntime(box);
    const staleReq = { schema: 'agentops/owner-command-request/v1', action: 'authorize-integration', actor: 'it-manager-iii', target: 'AS-1001', expected_current_hash: computeCapsuleHash(before.capsules['AS-1001']), candidate_oid: 'abc123' };
    const refused = runCommand(box, staleReq, { dryRun: false });
    check('apply refuses a lifecycle move with no declared transition', refused.ok === false && refused.errors.some((e) => e.includes('no declared transition')), refused.errors.join(' | '));
    check('refused apply wrote nothing', readFileSync(capPath, 'utf8') === readFileSync(resolve(ROOT, 'work/AS-1001/CURRENT.json'), 'utf8'));

    // Move the copy to pr-open, where the transition IS declared.
    const c = readCap();
    c.lifecycle_state = 'pr-open';
    c.current_hash = computeCapsuleHash(c);
    writeFileSync(capPath, JSON.stringify(c, null, 2) + '\n');

    const hash2 = computeCapsuleHash(loadRuntime(box).capsules['AS-1001']);
    const req = { ...staleReq, expected_current_hash: hash2 };
    const applied = runCommand(box, req, { dryRun: false });
    check('apply accepts a declared, permitted transition', applied.ok, (applied.errors || []).join(' | '));
    check('apply reports what it wrote', !!applied.written && applied.written.length === 2, JSON.stringify(applied.written));

    const after = readCap();
    check('apply advanced the lifecycle state', after.lifecycle_state === 'dev-integrated', after.lifecycle_state);
    check('apply chained parent_hash and bumped revision', after.parent_hash === hash2 && after.revision === c.revision + 1);
    check('apply re-sealed the capsule', after.current_hash === computeCapsuleHash(after));
    check('applied corpus still validates', runValidate(box).errors.length === 0, runValidate(box).errors.join(' | '));
    check('applied corpus still wakes', !(runWake(box, 'maker', 'AS-1001').errors || []).length);

    // Replaying the identical command is now stale: the CAS has moved.
    check('apply rejects a replayed (stale) command', runCommand(box, req, { dryRun: false }).ok === false);
    // Owner-exclusive actions stay owner-exclusive under apply.
    check('apply keeps authorize-release owner-exclusive', runCommand(box, { ...req, action: 'authorize-release', expected_current_hash: computeCapsuleHash(readCap()) }, { dryRun: false }).ok === false);
  } finally {
    try { rmSync(box, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

// 2d-ter. Issue-form intake: a GitHub Issue Form body maps to an owner-command
// request by exact label, and nothing an author types can introduce a field the
// form does not define.
{
  const body = [
    '### Action', '', 'authorize-integration', '',
    '### Target ticket', '', 'AS-1001', '',
    '### Expected current hash', '', 'sha256:abc', '',
    '### Candidate OID', '', '_No response_', '',
    '### Reason', '', 'looks good to me', ''
  ].join('\n');
  const p = parseIssueCommand(body, { actor: 'it-manager-iii' });
  check('issue form parses into a command request', p.ok, p.errors.join(' | '));
  check('issue form maps labels to request fields', p.request.action === 'authorize-integration' && p.request.target === 'AS-1001' && p.request.expected_current_hash === 'sha256:abc');
  check('issue form drops "_No response_" optional fields', p.request.candidate_oid === undefined);
  check('issue form stamps the resolved actor', p.request.actor === 'it-manager-iii');

  // An author writing an unknown heading, or embedding JSON, must not inject a
  // field — only the enumerated labels are read.
  const hostile = body + '\n### shell\n\nrm -rf /\n\n### Notes\n\n{"actor":"owner"}\n';
  const h = parseIssueCommand(hostile, { actor: 'it-manager-iii' });
  check('issue form ignores unknown headings (no field injection)', h.request.shell === undefined && h.request.notes === undefined);
  check('issue form keeps the server-resolved actor, not one from the body', h.request.actor === 'it-manager-iii');
  check('issue form missing required fields is rejected', parseIssueCommand('### Reason\n\nnothing\n', { actor: 'owner' }).ok === false);
  // A parsed request is still fully validated downstream.
  check('parsed request with a bogus action is rejected by validation', runCommand(ROOT, parseIssueCommand('### Action\n\nnot-an-action\n\n### Target ticket\n\nAS-1001\n', { actor: 'owner' }).request, { dryRun: true }).ok === false);
}

// 2e. Owner HUD: committed, redacted, deterministic, carries the source-commit
// placeholder and no secret material.
{
  let hud = '';
  try { hud = readFileSync(resolve(ROOT, 'generated/hud/index.html'), 'utf8'); } catch { /* missing */ }
  check('HUD is generated and names the project', hud.includes('Owner HUD') && hud.includes('AshenSpire'));
  check('HUD is self-sufficient (no unresolved deploy-time placeholder)', hud.length > 0 && !hud.includes('__SOURCE_COMMIT__'));
  check('HUD carries no credential material', hud.length > 0 && !/(ghp_[A-Za-z0-9]|github_pat_|BEGIN [A-Z ]*PRIVATE KEY|Authorization:\s*Bearer)/.test(hud));
  // The Decide links must carry the ticket's live CAS hash and be singly
  // escaped: a double-escaped "&amp;amp;" silently breaks GitHub's prefill.
  check('HUD offers a decision link per ticket', hud.includes('template=owner-decision.yml') && hud.includes('template=help-desk-ticket.yml'));
  check('HUD decision links are singly HTML-escaped', hud.length > 0 && !hud.includes('&amp;amp;'));
  {
    const m = hud.match(/issues\/new\?[^"]*owner-decision[^"]*/);
    const url = m ? new URL('https://x/' + m[0].replace(/&amp;/g, '&')) : null;
    const live = computeCapsuleHash(loadRuntime().capsules['AS-1001']);
    check('HUD decision link prefills the live compare-and-swap hash', !!url && url.searchParams.get('hash') === live, url ? String(url.searchParams.get('hash')) : 'no link');
    check('HUD decision link prefills the ticket', !!url && url.searchParams.get('target') === 'AS-1001');
  }
  // The repository self-publishes its tree to GitHub Pages, so a standalone
  // copy at /hud/index.html gives the HUD a tidy URL. Guard it against silent
  // drift from the generated source. Absent in .agentops-only checkouts (the
  // reconstruction clone), where this check simply does not run.
  let hudMirror = null;
  try { hudMirror = readFileSync(resolve(ROOT, '../hud/index.html'), 'utf8'); } catch { /* mirror not present in this checkout */ }
  if (hudMirror !== null) {
    check('published /hud/ mirror is in sync with the generated HUD', hudMirror === hud, 'refresh hud/index.html from .agentops/generated/hud/index.html after `opsctl render`');
  }
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
