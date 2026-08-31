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

import { runValidate, runSelftest, renderGovernance, viewCoverageErrors, probeStrengthErrors, loadContracts, strictParse, validateSchema, ROOT, runWake, loadRuntime, computeCapsuleHash, runDrill, runCommand, runMigrate, parseIssueCommand, buildCapsule, computeDispatch, runReseal, runReseat, renderHud, renderHubSite, OWNER_PAGE_LAYOUT_ID, subcommandDocErrors, opsctlHeader, renderHelpDeskTemplate, globCovers, renderResultConsumerErrors } from './opsctl.mjs';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

let failures = 0;
function check(name, cond, detail = '') {
  const ok = !!cond;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' — ' + detail}`);
  if (!ok) failures++;
}

// The GitHub trigger is an authority boundary, so keep its replay/provenance
// contract executable even though the workflow itself is not run by this suite.
{
  const workflow = readFileSync(resolve(ROOT, '..', '.github/workflows/owner-command.yml'), 'utf8');
  check('AT-01 owner-created event is the only executable trigger', workflow.includes('types: [opened]'));
  check('AT-02 non-owner association is rejected', workflow.includes("github.event.issue.author_association == 'OWNER'"));
  check('AT-03 edited event cannot replay a command', workflow.includes('types: [opened]') && !workflow.includes('types: [opened, edited]'));
  check('AT-04 editor/sender mismatch cannot impersonate Constantine', workflow.includes("github.event.issue.user.login == 'cehinds'") && workflow.includes("github.event.sender.login == 'cehinds'"));
  check('AT-05 issue body cannot supply the actor identity', workflow.includes('--actor owner') && workflow.includes('env:\n          ISSUE_BODY:'));
  check('AT-06 workflow performs dry-run before apply', workflow.includes('command --dry-run') && workflow.includes('command --apply'));
}

// 1. The real, on-disk corpus parses, schema-validates, and is cross-consistent.
{
  const { contracts, errors } = runValidate();
  check('real corpus validates with zero errors', errors.length === 0, errors.join(' | '));
  check('all nineteen contracts loaded', Object.keys(contracts).length === 19, Object.keys(contracts).join(','));
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

    // Drift only proves the committed file matches what render emits. It says
    // nothing about a contract render emits nothing for — which is how five
    // contracts stayed out of the human view while `verify` reported OK.
    const missed = viewCoverageErrors(contracts, expected);
    check('every contract reaches the generated view', missed.length === 0, missed.join(' | '));

    // Coverage is only as good as the probes. Two contracts sharing a probe
    // value means one can mask the other; that is how `roles` first passed
    // while its whole section was deleted.
    const weak = probeStrengthErrors(contracts, expected);
    check('no two contracts share a view probe', weak.length === 0, weak.join(' | '));

    // No contract may opt out. An unprobed contract is the same silent gap.
    const unprobed = viewCoverageErrors({ ...contracts, 'ghost-contract': { principle: 'x' } }, expected);
    check('an unprobed contract fails rather than skipping',
      unprobed.some((e) => e.includes('declares no view probe')), unprobed.join(' | '));

    // Per-contract coverage is not enough: a contract that renders several
    // blocks can be probed by one value living in the earliest of them, leaving
    // the rest deletable. Sweep every rendered section that carries a body.
    {
      const lines = expected.split('\n');
      const heads = [];
      lines.forEach((l, i) => { if (/^#{2,3} /.test(l)) heads.push(i); });
      const uncovered = [];
      for (let k = 0; k < heads.length; k++) {
        const a = heads[k];
        const b = k + 1 < heads.length ? heads[k + 1] : lines.length;
        if (!lines.slice(a + 1, b).some((x) => x.trim())) continue;
        const blinded = lines.slice(0, a).concat(lines.slice(b)).join('\n');
        if (viewCoverageErrors(contracts, blinded).length === 0) uncovered.push(lines[a]);
      }
      check('deleting any rendered section fails the coverage gate', uncovered.length === 0, uncovered.join(' | '));
    }

    // A gate is only as good as its callers. `verify` and the drill's own
    // `verifyErrors` each dropped runRender()'s `errors` and read only `drift`,
    // so a tree failing the coverage gate could still drill clean.
    {
      const src = readFileSync(resolve(ROOT, 'tools/opsctl.mjs'), 'utf8');
      const consumers = renderResultConsumerErrors(src);
      check('every runRender() call site checks .errors', consumers.length === 0, consumers.join(' | '));
    }

    // ...and the check itself must be able to fail, or it proves nothing.
    const blinded = expected.split('\n').filter((l) => !l.includes(contracts.migration.principle)).join('\n');
    check('coverage check fails when a contract is unprojected',
      viewCoverageErrors(contracts, blinded).some((e) => e.includes("'migration'")));
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

    // A decision that answers an owner-decision blocker must clear it, or the
    // capsule reports itself blocked forever after the answer arrived.
    const blocked = readCap();
    blocked.blocker = { kind: 'owner-decision', escalation_class: 'owner-exclusive-now', summary: 'awaiting the owner' };
    blocked.current_hash = computeCapsuleHash(blocked);
    writeFileSync(capPath, JSON.stringify(blocked, null, 2) + '\n');
    const bh = computeCapsuleHash(loadRuntime(box).capsules['AS-1001']);
    const resolved = runCommand(box, { schema: 'agentops/owner-command-request/v1', action: 'approve', actor: 'owner', target: 'AS-1001', expected_current_hash: bh, candidate_oid: 'abc123', reason: 'answered.' }, { dryRun: false });
    check('a resolving decision is applied', resolved.ok, (resolved.errors || []).join(' | '));
    check('a resolving decision clears the blocker', readCap().blocker === null, JSON.stringify(readCap().blocker));
    check('clearing the blocker keeps the capsule sealed and valid', readCap().current_hash === computeCapsuleHash(readCap()) && runValidate(box).errors.length === 0);

    // A deferral must NOT clear a blocker: it postpones, it does not answer.
    const reblocked = readCap();
    reblocked.blocker = { kind: 'owner-decision', wake: 'constantine', summary: 'still awaiting' };
    reblocked.current_hash = computeCapsuleHash(reblocked);
    writeFileSync(capPath, JSON.stringify(reblocked, null, 2) + '\n');
    runCommand(box, { schema: 'agentops/owner-command-request/v1', action: 'defer', actor: 'owner', target: 'AS-1001', reason: 'not yet' }, { dryRun: false });
    check('a deferral does not clear the blocker', readCap().blocker !== null);

    // Restore the valid seed before exercising a second ticket; command entry
    // refuses the entire runtime when any capsule is schema-invalid.
    const restored = readCap();
    restored.blocker = null;
    restored.current_hash = computeCapsuleHash(restored);
    writeFileSync(capPath, JSON.stringify(restored, null, 2) + '\n');

    // A capsule authority grant is a first-class owner-only action. It may add
    // only the dev-via-PR capability already held by the target role, and it
    // replaces the legacy bundled denial with explicit protected boundaries.
    const deliveryPath = resolve(box, 'work/AS-HD-029/CURRENT.json');
    const readDeliveryCap = () => strictParse(readFileSync(deliveryPath, 'utf8'));
    const deliverySeed = readDeliveryCap();
    deliverySeed.authority.may = deliverySeed.authority.may.filter((item) => item !== 'integrate-to-dev-via-pr');
    deliverySeed.authority.must_not = deliverySeed.authority.must_not
      .filter((item) => !['direct-push-to-dev', 'mutate-main-or-release', 'tag-publish-deploy-or-change-pages-source'].includes(item));
    if (!deliverySeed.authority.must_not.includes('push-pr-merge-deploy-or-release')) deliverySeed.authority.must_not.unshift('push-pr-merge-deploy-or-release');
    deliverySeed.current_hash = computeCapsuleHash(deliverySeed);
    writeFileSync(deliveryPath, JSON.stringify(deliverySeed, null, 2) + '\n');
    const beforeDelivery = readDeliveryCap();
    const deliveryHash = computeCapsuleHash(beforeDelivery);
    const grant = {
      schema: 'agentops/owner-command-request/v1',
      action: 'grant-dev-delivery-authority',
      actor: 'owner',
      target: 'AS-HD-029',
      expected_current_hash: deliveryHash,
      reason: 'Owner grant from #470; dev via normal PR only.'
    };
    check('dev-delivery grant remains owner-exclusive', runCommand(box, { ...grant, actor: 'it-manager-iii' }, { dryRun: true }).ok === false);
    check('dev-delivery grant refuses a non-ITM3 capsule', runCommand(box, { ...grant, target: 'AS-1001', expected_current_hash: computeCapsuleHash(readCap()) }, { dryRun: true }).ok === false);
    const granted = runCommand(box, grant, { dryRun: false });
    check('owner may grant the ITM3 capsule dev-via-PR authority', granted.ok, (granted.errors || []).join(' | '));
    const afterDelivery = readDeliveryCap();
    check('grant adds only integrate-to-dev-via-pr and removes the bundled denial',
      afterDelivery.authority.may.filter((item) => !beforeDelivery.authority.may.includes(item)).join(',') === 'integrate-to-dev-via-pr'
        && !afterDelivery.authority.must_not.includes('push-pr-merge-deploy-or-release'));
    check('grant preserves direct-dev, deploy, main/release, tag, publication, and Pages prohibitions',
      ['direct-push-to-dev', 'mutate-main-or-release', 'tag-publish-deploy-or-change-pages-source']
        .every((item) => afterDelivery.authority.must_not.includes(item)));
    check('granted capsule remains sealed and the complete corpus validates',
      afterDelivery.current_hash === computeCapsuleHash(afterDelivery) && runValidate(box).errors.length === 0);

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
  // The HUD's "Needs you now" and the executor's owner-decision issues must be
  // the same set. Reading blocker.wake made them silently diverge: after the
  // blocker migration dropped that field, the HUD showed nothing at all.
  {
    const rtOwned = loadRuntime();
    rtOwned.capsules['AS-HD-050'].blocker = { kind: 'test', escalation_class: 'owner-exclusive-now', summary: 'owner must decide' };
    const html = renderHud(loadContracts().contracts, rtOwned);
    check('HUD lists a ticket whose escalation class reaches the owner', html.includes('AS-HD-050') && !/No owner decisions are pending/.test(html));
    check('HUD gives the reason the ticket reached the owner', html.includes('owner must decide'));
  }
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

// 2g. Ref existence is advisory but must not lie. It is answered against the
// root the caller selected (not the module's own checkout, which would make a
// clean-room clone report the host's branches), and only a real BRANCH counts —
// an unqualified `git rev-parse` would resolve a same-named TAG and tell a seat
// its working branch already exists.
{
  const { contracts } = loadContracts();
  const rt = loadRuntime();
  const ref = rt.capsules['AS-1001'].ref;
  const repo = resolve(tmpdir(), `agentops-reftest-${process.pid}-${Date.now()}`);
  const git = (...a) => execFileSync('git', a, { cwd: repo, stdio: ['ignore', 'pipe', 'ignore'] });
  const note = () => {
    const c = buildCapsule(contracts, rt, 'AS-1001', { frozen: false, head: null, root: repo });
    const line = (c.text || '').split('\n').find((l) => l.startsWith('REPO/REF'));
    return line || '';
  };
  try {
    mkdirSync(repo, { recursive: true });
    git('init', '-q');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'test');
    git('commit', '-q', '--allow-empty', '-m', 'base');
    check('ref existence uses the caller-selected root, not the module checkout', note().includes('NOT CREATED YET'), note());
    git('tag', ref);
    check('a same-named TAG is not mistaken for the working branch', note().includes('NOT CREATED YET'), note());
    git('branch', ref);
    check('a real branch at the selected root reports as existing', note().includes('(exists)'), note());
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

// 2h. Dispatch: who is due and who reaches the Owner, derived from contracts.
// The point of the executor is that policy lives in governance JSON, so these
// assert the derivation — not a hardcoded roster.
{
  const { contracts } = loadContracts();
  const rt = loadRuntime();
  const d = computeDispatch(contracts, rt);
  check('dispatch returns an entry for every non-terminal capsule', d.length > 0, String(d.length));
  check('every dispatch entry names a wake target', d.every((e) => !!e.wake), JSON.stringify(d.filter((e) => !e.wake)));
  check('a blocked capsule routes by its escalation class, not its own say-so',
    d.filter((e) => e.escalation_class).every((e) => {
      const cls = contracts.escalation.classes.find((c) => c.id === e.escalation_class);
      return cls && e.wake === cls.wake;
    }));
  // The bug that froze six of seven seat-holding roles: dispatch woke `maker`
  // for every seat because no other role was permitted to leave 'assigned'.
  const byTicket = Object.fromEntries(d.map((e) => [e.ticket, e]));
  const rtSupport = loadRuntime();
  rtSupport.capsules['AS-HD-057'].blocker = null;
  const support = computeDispatch(contracts, rtSupport).find((e) => e.ticket === 'AS-HD-057');
  check('an unblocked it-support seat wakes it-support, not maker', support && support.wake === 'it-support', support && support.wake);
  check('a qa seat wakes qa-independent', byTicket['AS-HD-055'] && byTicket['AS-HD-055'].wake === 'qa-independent', byTicket['AS-HD-055'] && byTicket['AS-HD-055'].wake);
  check('every unblocked seat wakes its own capsule owner',
    d.filter((e) => !e.escalation_class).every((e) => e.wake === rt.capsules[e.ticket].owner_actor),
    JSON.stringify(d.filter((e) => !e.escalation_class && e.wake !== rt.capsules[e.ticket].owner_actor)));
  // A dead lease is an ownership question, so it escalates rather than waking a
  // seat that would stop the moment it read its own capsule.
  const rtDead = loadRuntime();
  const victim = rtDead.capsules['AS-HD-057'];
  victim.blocker = null;
  rtDead.leases.find((l) => l.id === victim.writer_lease).revoked = true;
  const dead = computeDispatch(contracts, rtDead).find((e) => e.ticket === 'AS-HD-057');
  check('a revoked lease escalates instead of waking the seat', !!dead && dead.escalation_class === 'technical-blocker' && /revoked/.test(dead.reason), JSON.stringify(dead));
  // Terminal work wakes nobody — an executor that re-files finished tickets is
  // noise that trains its readers to ignore it.
  const rtDone = loadRuntime();
  rtDone.capsules['AS-HD-057'].lifecycle_state = 'released';
  check('a released capsule wakes nobody', !computeDispatch(contracts, rtDone).some((e) => e.ticket === 'AS-HD-057'));
}

// 2i. Reseal: the compare-and-swap chain survives a legitimate content change.
{
  const r = runReseal(ROOT, 'AS-1001', { reason: 'test', actor: 'maker' });
  check('reseal refuses to mint a link when nothing changed', r.ok && r.unchanged === true, JSON.stringify(r));
  const missing = runReseal(ROOT, 'AS-1001', { actor: 'maker' });
  check('reseal refuses without a reason', !missing.ok && /--reason/.test(missing.errors.join(' ')));
  const ghost = runReseal(ROOT, 'AS-0000', { reason: 'x' });
  check('reseal refuses an unknown ticket', !ghost.ok);
}

// 2j. Reseat: a stale base is why every woken seat stopped on arrival. Only
// unstarted seats follow the branch; a seat with work standing on its base is
// never silently rebased; and a detached HEAD is refused outright.
//
// The positive path MUTATES capsules, so it runs against a throwaway copy in a
// scratch git repo — never the real corpus. An earlier version of this test
// reseated the live tree, which passed locally (HEAD already matched) and in CI
// pinned every capsule to the synthetic PR merge commit.
{
  const started = runReseat(ROOT, 'AS-1001');
  check('an in-progress seat refuses to reseat', !started.ok && /not unstarted/.test(started.errors.join(' ')), JSON.stringify(started));
  check('reseat refuses an unknown ticket', !runReseat(ROOT, 'AS-0000').ok);

  const sandbox = resolve(tmpdir(), `agentops-reseat-${process.pid}-${Date.now()}`);
  const agentops = resolve(sandbox, '.agentops');
  const git = (...a) => execFileSync('git', a, { cwd: sandbox, stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    mkdirSync(sandbox, { recursive: true });
    cpSync(ROOT, agentops, { recursive: true });
    git('init', '-q');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'test');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');

    const before = JSON.parse(readFileSync(resolve(agentops, 'work/AS-HD-057/CURRENT.json'), 'utf8'));
    const r = runReseat(agentops, 'AS-HD-057');
    check('an unstarted seat reseats onto the branch HEAD', r.ok && !r.unchanged && r.base !== before.base_oid, JSON.stringify(r));
    check('reseating bumps the revision and records an event', r.ok && r.revision === (before.revision || 0) + 1 && !!r.event, JSON.stringify(r));
    const after = JSON.parse(readFileSync(resolve(agentops, 'work/AS-HD-057/CURRENT.json'), 'utf8'));
    check('the reseated capsule links to the seal it succeeded', after.parent_hash === before.current_hash, `${after.parent_hash} vs ${before.current_hash}`);
    check('reseating twice is a no-op', (() => { const again = runReseat(agentops, 'AS-HD-057'); return again.ok && again.unchanged === true; })());

    // The CI shape: a pull request is checked out as a detached merge commit.
    // AS-HD-054 is a still-unstarted capsule on a stale base, so the refusal
    // exercised here is the detached HEAD, not an already-started state.
    git('checkout', '-q', '--detach');
    const det = runReseat(agentops, 'AS-HD-054');
    check('reseat refuses a detached HEAD', !det.ok && /detached/.test(det.errors.join(' ')), JSON.stringify(det));
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

// 2k. The Review & Approval Hub. It replaces a committed Next.js export whose
// source existed nowhere: unbuildable, uneditable, and already drifted from the
// control plane it claimed to show. Every page is now a projection, so the
// drift gate that protects GOVERNANCE.md protects the site too.
{
  const { contracts } = loadContracts();
  const rt = loadRuntime();
  const pages = renderHubSite(contracts, rt);
  const rels = pages.map((p) => p.rel);
  check('hub generates a page per ticket plus the four fixed pages',
    rels.length === Object.keys(rt.capsules).length + 4, String(rels.length));
  for (const fixed of ['index', 'decisions', 'seats', 'help-desk']) {
    check(`hub has ${fixed}.html`, rels.includes(`generated/hub/${fixed}.html`));
  }
  const byRel = Object.fromEntries(pages.map((p) => [p.rel, p.text]));
  // The old Hub drifted because it was a snapshot. These assert the pages read
  // live state, not a frozen copy of it.
  const home = byRel['generated/hub/index.html'];
  check('hub overview lists every ticket', Object.keys(rt.capsules).every((t) => home.includes(t)));
  check('hub overview names the seat that each ticket wakes',
    computeDispatch(contracts, rt).every((e) => home.includes(e.wake)));
  check('hub restores the owner-facing editorial shell',
    home.includes('class="hero"') && home.includes('class="truth-panel"') && home.includes('Review &amp; Approval Hub'));
  check('hub ticket queue uses keyboard-native expandable cards',
    home.includes('<details class="section-fold"') && home.includes('<details class="ticket-card">') && home.includes('<summary class="ticket-summary">'));
  check('hub overview metrics are derived from current runtime state',
    home.includes(`<strong>${Object.keys(rt.capsules).length}</strong><span>Tracked tickets</span>`)
      && home.includes(`<span>Writer seats</span><small>active leases</small>`));
  check('every current and future Hub route uses the versioned owner-page default',
    pages.every((page) => page.text.includes(`data-owner-layout="${OWNER_PAGE_LAYOUT_ID}"`)
      && page.text.includes(`<meta name="ashenspire-owner-layout" content="${OWNER_PAGE_LAYOUT_ID}">`)
      && page.text.includes('<header class="hero">')),
    pages.filter((page) => !page.text.includes(`data-owner-layout="${OWNER_PAGE_LAYOUT_ID}"`)).map((page) => page.rel).join(','));
  const ticketPage = byRel['generated/hub/tickets/AS-HD-057.html'];
  check('a ticket page carries its live seal', ticketPage.includes(rt.capsules['AS-HD-057'].current_hash.slice(0, 23)));
  check('a ticket page replays its event chain',
    (rt.events['AS-HD-057'] || []).every((ev) => ticketPage.includes(ev.id)));
  // A published page must not become an exfiltration route for repository state
  // the owner did not choose to publish.
  check('hub carries no credential material', !pages.some((p) => /ghp_|github_pat_|BEGIN [A-Z ]*PRIVATE KEY|Authorization:/i.test(p.text)));
  check('hub escapes generated content', !pages.some((p) => /<script/i.test(p.text)));
  // Absent in .agentops-only checkouts (the reconstruction clone), where this
  // simply does not run — same rule as the HUD mirror.
  let mirrored = null;
  try { mirrored = readFileSync(resolve(ROOT, '../review-approval-hub/index.html'), 'utf8'); } catch { /* not present */ }
  if (mirrored !== null) {
    check('published review-approval-hub/ mirror is in sync with the generated hub',
      mirrored === home,
      'refresh review-approval-hub/ from .agentops/generated/hub/ after `opsctl render`');
  }
}

// 2l. The team charter, now a contract. It lived as prose in
// docs/governance/TEAM-CHARTERS.md, where nothing stopped a capsule
// contradicting it. These assert the parts that were only ever assertions.
{
  const { contracts } = loadContracts();
  const tm = contracts.teams;
  check('teams contract loads', !!tm && tm.schema === 'agentops/teams/v1');
  check('the four standing coordination roles are declared', tm.standing_roles.length === 4, String(tm.standing_roles.length));
  check('every standing role is a real role with a hierarchy node',
    tm.standing_roles.every((r) => contracts.roles.roles.some((x) => x.role === r.id) && contracts.hierarchy.nodes.some((n) => n.actor_id === r.id)));
  check('the nine capability pools are declared', tm.capability_pools.length === 9, String(tm.capability_pools.length));
  // The charter's load-bearing sentence.
  check('a pool is not standing and owns no backlog or path',
    tm.pool_rules.standing === false && tm.pool_rules.owns_backlog === false && tm.pool_rules.owns_source_paths === false);
  check('no pool is also a declared role',
    !tm.capability_pools.some((p) => contracts.roles.roles.some((x) => x.role === p.id)));
  // The rule that would have made losing a session survivable.
  check('a pod chat is never an authority source', tm.pods.chat_is_authority_source === false);
  // The exception the owner authorised: two standing roles, jointly, after
  // exhausting what the charter already lets them settle.
  const ce = tm.charter_exception;
  check('a charter exception needs two standing roles to concur',
    ce.requires_concurrence.length >= 2 && ce.requires_concurrence.every((r) => tm.standing_roles.some((s) => s.id === r)));
  check('a charter exception must exhaust charter-level resolution first', ce.exhaust_charter_first === true);
  check('a charter exception reaches the owner',
    contracts.escalation.classes.find((x) => x.id === ce.escalation_class).wake === contracts['owner-intent'].owner.actor_id);
  // No live seat may be held by a pool.
  const rt = loadRuntime();
  const pools = new Set(tm.capability_pools.map((p) => p.id));
  check('no live capsule is held by a capability pool', !Object.values(rt.capsules).some((c) => pools.has(c.owner_actor)));
  check('no live lease is held by a capability pool', !rt.leases.some((l) => !l.revoked && pools.has(l.actor)));
  // The contract must not silently diverge from the prose it was built from.
  // Each entry names its own charter heading, so this is an exact check rather
  // than a guess at how an id maps to a title.
  let charter = null;
  try { charter = readFileSync(resolve(ROOT, '../docs/governance/TEAM-CHARTERS.md'), 'utf8'); } catch { /* not present in an .agentops-only checkout */ }
  if (charter !== null) {
    const missing = [...tm.standing_roles, ...tm.capability_pools].filter((e) => !charter.includes(e.charter_heading));
    check('every contract entry names a heading that exists in the charter prose',
      missing.length === 0, missing.map((e) => e.charter_heading).join(' | '));
  }
}

// 2m. D6 and D8 from the continuity audit (issue #392).
{
  // D6: the drill printed "zero evidence loss" for a fleet where every seat's
  // own wake said `re-seat before mutating`. The goldens stay frozen; staleness
  // is reported alongside them instead, non-fatally.
  const d = runDrill(ROOT);
  check('drill reports how many capsules are pinned behind live HEAD', Array.isArray(d.stale) && typeof d.total === 'number', JSON.stringify({ stale: d.stale && d.stale.length, total: d.total }));
  check('drill counts every capsule, not just the stale ones', d.total === Object.keys(loadRuntime().capsules).length, `${d.total}`);
  check('a stale capsule is named with its ticket, base and state',
    d.stale.every((x) => x.ticket && x.base && x.state), JSON.stringify(d.stale));
  check('staleness does not fail the drill (it is not evidence loss)', d.ok === true);
  // An in-progress seat is never auto-reseated, so it is the one that legitimately
  // stays behind — and the drill must still say so rather than hide it.
  const started = Object.entries(loadRuntime().capsules).filter(([, c]) => c.lifecycle_state === 'in-progress').map(([t]) => t);
  check('an in-progress capsule left behind HEAD is still reported',
    started.every((t) => d.stale.some((x) => x.ticket === t) || loadRuntime().capsules[t].base_oid === d.head),
    `in-progress: ${started.join(', ')}`);

  // D8: the header had drifted to 5 of 8 subcommands, omitting `wake` — the one
  // a cold-start seat depends on. It is now checked against dispatch itself.
  const src = readFileSync(resolve(ROOT, 'tools/opsctl.mjs'), 'utf8');
  check('opsctl header documents every dispatched subcommand', subcommandDocErrors(opsctlHeader(src), src).length === 0, subcommandDocErrors(opsctlHeader(src), src).join(' | '));
  check('the header check reads only the comment block, not the code', !opsctlHeader(src).includes('export function'));
  const gutted = opsctlHeader(src).split('\n').filter((l) => !/^\/\/   drill /.test(l)).join('\n');
  check('removing a subcommand from the header is caught', subcommandDocErrors(gutted, src).some((e) => e.includes("'drill'")));
}

// 2n. The Help Desk intake form, generated (the rest of D9). Its team dropdown
// was the only place the thirteen team names existed, and it had already
// diverged from the charter it was supposed to route into.
{
  const { contracts } = loadContracts();
  const tm = contracts.teams;
  const yml = renderHelpDeskTemplate(contracts);
  check('intake form is generated and marked as such', yml.startsWith('# GENERATED by'));
  check('intake form keeps the routing escape hatch', yml.includes('- unsure / route it'));
  // Legacy names stay selectable — open tickets and muscle memory both use them.
  check('every legacy team name is still offered', tm.legacy_aliases.every((a) => yml.includes(`        - ${a.legacy}`)),
    tm.legacy_aliases.filter((a) => !yml.includes(`        - ${a.legacy}`)).map((a) => a.legacy).join(', '));
  // ...and every one of them resolves to something that can actually hold work.
  const roster = new Set([...tm.standing_roles.map((r) => r.id), ...tm.capability_pools.map((p) => p.id)]);
  check('every legacy name routes to a current role or pool', tm.legacy_aliases.every((a) => roster.has(a.routes_to)),
    tm.legacy_aliases.filter((a) => !roster.has(a.routes_to)).map((a) => `${a.legacy}->${a.routes_to}`).join(', '));
  check('no legacy name is declared twice', new Set(tm.legacy_aliases.map((a) => a.legacy)).size === tm.legacy_aliases.length);
  // Scoped to the team dropdown itself: counting options file-wide would also
  // sweep up the kind and urgency lists and pass for the wrong reason.
  const teamBlock = yml.slice(yml.indexOf('    id: team')).split('    validations:')[0];
  const teamOptions = (teamBlock.match(/^        - .+$/gm) || []).map((l) => l.replace('        - ', ''));
  check('the team dropdown offers exactly the aliases plus the escape hatch',
    teamOptions.length === tm.legacy_aliases.length + 1, `${teamOptions.length} vs ${tm.legacy_aliases.length + 1}`);
  check('no team option is absent from the roster or the alias map',
    teamOptions.filter((o) => o !== 'unsure / route it').every((o) => tm.legacy_aliases.some((a) => a.legacy === o)),
    teamOptions.join(', '));
  // The generated form must match what GitHub actually serves. Absent in an
  // .agentops-only checkout, same rule as the other published mirrors.
  let live = null;
  try { live = readFileSync(resolve(ROOT, '../.github/ISSUE_TEMPLATE/help-desk-ticket.yml'), 'utf8'); } catch { /* not present */ }
  if (live !== null) {
    check('the published intake form is in sync with the generated one', live === yml + '\n',
      'run `opsctl render`');
  }
  // A capsule may name a team; if it does, the name must resolve.
  const rt = loadRuntime();
  const named = Object.entries(rt.capsules).filter(([, c]) => c.team != null);
  const aliases = new Set(tm.legacy_aliases.map((a) => a.legacy));
  check('every capsule that names a team names a resolvable one',
    named.every(([, c]) => roster.has(c.team) || aliases.has(c.team)),
    named.map(([t, c]) => `${t}:${c.team}`).join(', ') || '(none name a team)');
}

// 2o. Promotion Gates A-F (decision 0009), now a contract. They defined who may
// act, what evidence each gate needs, and — the part that matters most — what
// each explicitly does NOT grant. None of it was encoded, so a transition guard
// could paraphrase a gate wrongly and nothing would notice.
{
  const { contracts } = loadContracts();
  const pg = contracts['promotion-gates'];
  check('promotion-gates contract loads', !!pg && pg.schema === 'agentops/promotion-gates/v1');
  check('all six gates A-F are declared', pg.gates.map((g) => g.id).join('') === 'ABCDEF', pg.gates.map((g) => g.id).join(''));
  const roles = new Set(contracts.roles.roles.map((r) => r.role));
  check('every gate names a declared actor role', pg.gates.every((g) => roles.has(g.actor_role)),
    pg.gates.filter((g) => !roles.has(g.actor_role)).map((g) => `${g.id}:${g.actor_role}`).join(', '));
  // The invariant the decision repeats most: authority for one action implies
  // none of the others.
  const ownerReserved = ['main', 'release', 'tag', 'publication', 'Pages'];
  check('no gate grants owner-reserved authority', pg.gates.every((g) => (g.grants || []).length === 0),
    pg.gates.filter((g) => (g.grants || []).length).map((g) => g.id).join(', '));
  check('Gate F is the only gate with per-action authority',
    pg.gates.find((g) => g.id === 'F').authority_is_per_action === true
      && !pg.gates.filter((g) => g.id !== 'F').some((g) => g.authority_is_per_action));
  check('Gates E and F are the owner\'s', ['E', 'F'].every((id) => pg.gates.find((g) => g.id === id).actor_role === 'owner'));
  check('Gate C records what it does not grant', (pg.gates.find((g) => g.id === 'C').explicitly_not_granted || []).includes('release'));
  check('Gate B cannot be satisfied by a merge alone', (pg.gates.find((g) => g.id === 'B').not_satisfied_by || []).some((x) => /merge/.test(x)));
  check('a correction returns to Gate A', pg.gates.find((g) => g.id === 'E').returns_to_gate_on_correction === 'A');
  // Every protected promotion move is gated — the check that found `pushed ->
  // pr-open` sitting protected and ungated.
  const gated = new Set(pg.gates.flatMap((g) => (g.guards_transitions || []).map((t) => `${t.from}->${t.to}`)));
  const ungated = contracts.transitions.transitions.filter((m) => m.protected && !gated.has(`${m.from}->${m.to}`));
  check('every protected transition is guarded by a gate', ungated.length === 0, ungated.map((m) => `${m.from}->${m.to}`).join(', '));
  // A seat standing at a gated state must be told which gate is in front of it.
  const rt = loadRuntime();
  // No live capsule has reached a gated state yet, so this drives one there in
  // memory rather than leaving the line untested until the first promotion.
  const gatedStates = [...new Set(pg.gates.flatMap((g) => (g.guards_transitions || []).map((t) => t.from)))];
  for (const state of gatedStates) {
    const rtAt = loadRuntime();
    rtAt.capsules['AS-1001'].lifecycle_state = state;
    const w = buildCapsule(contracts, rtAt, 'AS-1001', { frozen: true });
    const line = (w.text || '').split('\n').find((l) => l.startsWith('GATE'));
    const expected = pg.gates.find((g) => (g.guards_transitions || []).some((t) => t.from === state));
    check(`wake names the gate standing before '${state}'`, !!line && line.includes(`: ${expected.id} (`), line || 'no GATE line');
    check(`the '${state}' gate line names who may act`, !!line && line.includes(expected.actor_role), line || 'no GATE line');
  }
  // An ungated state must not gain a spurious gate line.
  const rtUngated = loadRuntime();
  rtUngated.capsules['AS-1001'].lifecycle_state = 'assigned';
  check('an ungated state gets no gate line',
    !(buildCapsule(contracts, rtUngated, 'AS-1001', { frozen: true }).text || '').includes('GATE       :'));
}

// 2p. Adaptive model and effort selection (decision 0006). Its load-bearing
// sentence — selecting a model grants nothing, and a stronger model does not
// outrank a weaker one — was policy nobody could enforce.
{
  const { contracts } = loadContracts();
  const me = contracts['model-effort'];
  check('model-effort contract loads', !!me && me.schema === 'agentops/model-effort/v1');
  check('the four risk-and-station tiers are declared', me.tiers.length === 4, String(me.tiers.length));
  check('model selection grants nothing', me.grants.length === 0, me.grants.join(', '));
  check('no tier is named after a role',
    !me.tiers.some((t) => contracts.roles.roles.some((r) => r.role === t.id)));
  // The escape hatch stays an escape hatch.
  const maxTiers = me.tiers.filter((t) => t.allowed_efforts.includes('max'));
  check('max effort exists and always demands an exceptional reason',
    maxTiers.length > 0 && maxTiers.every((t) => t.requires_exceptional_reason === true));
  check('the assignment record keeps all four fields',
    ['model', 'effort', 'why', 'escalate_when'].every((f) => me.assignment_record.required_fields.includes(f)));
  check('a reassignment records the pairing too', me.assignment_record.recorded_on.includes('reassignment'));
  check('independence is not a model choice', /non-maker/.test(me.rules.independence_is_not_a_model));
  // A capsule may declare its pairing; if it does, the effort must be one a
  // declared tier allows.
  const rt = loadRuntime();
  const efforts = new Set(me.tiers.flatMap((t) => t.allowed_efforts));
  const declared = Object.entries(rt.capsules).filter(([, c]) => c.model_effort);
  check('every capsule that declares a pairing uses a declared effort',
    declared.every(([, c]) => efforts.has(c.model_effort.effort)),
    declared.map(([t, c]) => `${t}:${c.model_effort.effort}`).join(', ') || '(none declare one)');
}

// 2q. Dev delivery, promotion readiness and the Pages source (decision 0005).
// The Pages half is the part with teeth. Earlier in this repository's life a
// Pages deployment replaced a live site with no recorded prior state to
// restore; the decision already forbade that, and nothing enforced it.
{
  const { contracts } = loadContracts();
  const d = contracts.delivery;
  check('delivery contract loads', !!d && d.schema === 'agentops/delivery/v1');
  check('delivery to dev is a discretion, not a duty', d.dev_delivery.is_a_duty === false);
  check('delivery never authorizes a direct push to dev', d.dev_delivery.authorizes_direct_push === false);
  check('all eight independence conditions are carried', d.dev_delivery.all_must_pass_at_one_exact_head.length === 8,
    String(d.dev_delivery.all_must_pass_at_one_exact_head.length));
  check('FAIL and UNKNOWN both force WAIT',
    ['FAIL', 'UNKNOWN'].every((v) => d.dev_delivery.wait_required_on.includes(v)));
  check('waiting does not authorize a speculative patch',
    d.dev_delivery.waiting_does_not_authorize.some((x) => /speculative/.test(x)));
  // Readiness is a claim about a packet, never about the product.
  check('declaring a packet ready grants nothing', d.promotion_readiness.grants.length === 0);
  check('promotion actions are owner-exclusive and per action',
    d.promotion_readiness.authority_is_per_action === true && d.promotion_readiness.owner_exclusive_actions.length >= 5);
  check('all ten promotion packet fields are carried', d.promotion_packet.required_fields.length === 10,
    String(d.promotion_packet.required_fields.length));
  check('UNKNOWN blocks', d.promotion_packet.unknown_blocks === true);
  // Pages.
  check('the desired Pages source is main', d.pages.desired_source === 'main');
  const ref = contracts['git-ownership'].refs.find((r) => r.ref === d.pages.desired_source);
  check('the desired Pages source is a protected declared ref', !!ref && ref.mutation === 'protected', ref ? ref.mutation : 'not declared');
  check('a Pages switch is not authorized by the decision itself', d.pages.switch_authorized_by_this_decision === false);
  check('a Pages switch escalates to the owner',
    contracts.escalation.classes.find((x) => x.id === d.pages.switch_requires.escalation_class).wake === contracts['owner-intent'].owner.actor_id);
  check('a Pages switch needs a change window and a candidate already on main',
    d.pages.switch_requires.change_window === true && d.pages.switch_requires.candidate_must_have_reached === 'main');
  // The one that matters: rollback is recorded before the switch, not after it
  // goes wrong.
  check('the Pages switch packet records a rollback',
    d.pages.switch_packet_records.some((x) => /rollback/i.test(x)));
  check('a switch is incomplete until deployment AND hosted verification pass',
    d.pages.complete_only_when.length === 2);
  check('a failed deployment authorizes no different source',
    /no different source/i.test(d.pages.on_failure));
}

// 2r. The last two decision records with checkable content: 0002's legacy
// lifecycle mapping and 0004's one-canonical-path rule.
{
  const { contracts } = loadContracts();
  const t = contracts.transitions;
  check('every legacy lifecycle value has a canonical treatment',
    t.legacy_values.length >= 5 && t.legacy_values.every((v) => v.legacy && v.canonical_treatment),
    String(t.legacy_values.length));
  // The compatibility token the charter says still routes to IT Manager III.
  check('READY FOR MAIN is carried as a legacy value', t.legacy_values.some((v) => v.legacy === 'READY FOR MAIN'));
  // CLOSED was the ambiguous one: the decision insists it is resolved into a
  // real terminal state rather than kept as a synonym.
  check('CLOSED must be resolved rather than kept as a synonym',
    /RESOLVED and CANCELLED/.test(t.legacy_values.find((v) => v.legacy === 'CLOSED').canonical_treatment));
  check('old evidence is never rewritten', /never rewritten|do not rewrite/i.test(t.legacy_rule));

  // 0004: one canonical live path, and never two.
  const docs = contracts['information-access'].canonical_documents;
  check('canonical documents are declared', docs.length >= 1);
  check('every canonical document exists',
    docs.every((d) => existsSync(resolve(ROOT, '..', d.path))),
    docs.filter((d) => !existsSync(resolve(ROOT, '..', d.path))).map((d) => d.path).join(', '));
  check('no superseded copy is still live',
    docs.every((d) => d.superseded_paths.every((p) => !existsSync(resolve(ROOT, '..', p)))),
    docs.flatMap((d) => d.superseded_paths.filter((p) => existsSync(resolve(ROOT, '..', p)))).join(', '));
  check('the art policy sits at its post-0004 canonical path',
    docs.some((d) => d.path === 'docs/governance/RUNBOOKS/art.md'));
  check('every canonical document cites the decision that placed it',
    docs.every((d) => d.decision.startsWith('docs/governance/DECISIONS/')));
}

// 2s. Path-glob coverage. A declared root-level path has no directory prefix,
// and every string starts with '' — so the prefix form let the first root-level
// declaration claim ownership of every lease glob in the repository, silently
// disabling the grant check that D5 exists to enforce. Adding a writer for the
// generated build output is what exposed it.
{
  // Root never covers a subtree, nor the reverse.
  check('a root file does not cover a subtree', !globCovers('buildordinal.json', 'src/**'));
  check('a root wildcard does not cover a subtree', !globCovers('*.html', 'src/**'));
  check('a subtree does not cover a root file', !globCovers('src/**', 'buildordinal.json'));
  // Root-level matching is by name, not by "starts with nothing".
  check('a root wildcard covers a matching root file', globCovers('*.html', 'index.html'));
  check('a root wildcard does not cover a different extension', !globCovers('*.html', 'buildordinal.json'));
  check('an exact root file covers itself', globCovers('buildordinal.json', 'buildordinal.json'));
  // Subtree matching still works the way the one-writer rule depends on.
  check('a subtree covers a path inside it', globCovers('.agentops/**', '.agentops/work/**'));
  check('a subtree does not cover its sibling', !globCovers('src/**', 'assets/**'));

  // The live corpus: every generated output the tool writes must have a
  // declared writer, or two seats could claim it and verify would stay green.
  const { contracts } = loadContracts();
  const decls = contracts['git-ownership'].paths;
  for (const out of ['hud/**', 'review-approval-hub/**', 'buildordinal.json', '*.html']) {
    check(`generated output '${out}' has a declared writer`, decls.some((d) => d.glob === out),
      decls.map((d) => d.glob).join(', '));
  }
}

// 2t. Recovered Hub evidence. The Review & Approval Hub was committed build
// output with no source, and issue #392 recorded its rendered snapshot as the
// only surviving source for the team census — while noting it could not be
// located. It was in PR #378's branch. The prose is extracted here before that
// build output is retired, so retiring it loses nothing.
{
  const dir = resolve(ROOT, '../docs/reconstruction/hub-snapshot');
  if (existsSync(dir)) {
    const pages = readdirSync(dir).filter((f) => f.endsWith('.md'));
    check('recovered hub snapshot is present', pages.length >= 10, String(pages.length));
    const census = resolve(dir, 'reviews__as-hd-20260826-043-current-team-census.md');
    check('the team census #392 could not locate is preserved', existsSync(census));
    if (existsSync(census)) {
      const t = readFileSync(census, 'utf8');
      // Guards against the file surviving as an empty stub.
      check('the census carries its roster figures', /13 functional teams/.test(t) && /20 canonical homes/.test(t), String(t.length));
      check('the census records where it came from', /PR #378|AS-HD-20260826-053-event0002/.test(t));
    }
    const rotation = resolve(dir, 'reviews__as-hd-20260826-053-context-rotation.md');
    check('the 52-seat rotation readback is preserved', existsSync(rotation));
    if (existsSync(rotation)) {
      check('the rotation readback carries its seat denominator', /52 seats|of 52 seats/.test(readFileSync(rotation, 'utf8')));
    }
  }
}

// 2u. Per-team evidence recovered from the census, and the two-context P rule.
{
  const { contracts } = loadContracts();
  const at = contracts.hierarchy.authority_tiers;
  check('the authority ladder uses the owner-specified P namespace', at.namespace === 'P');
  check('all five tiers P0-P4 are declared', at.levels.map((l) => l.p).join('') === '01234', at.levels.map((l) => l.p).join(''));
  // A shared letter is safe only while the separating rule is explicit.
  check('the two P contexts are separated by subject', /subject/i.test(at.disambiguation.rule));
  check('no subject is readable as both authority and priority',
    !at.disambiguation.authority_subjects.some((a) => at.disambiguation.priority_subjects.some((b) => b.toLowerCase() === a.toLowerCase())));
  check('the historical ambiguous rows are called out', /census|2026-08-28/.test(at.disambiguation.known_ambiguous_artifact));

  const dir = resolve(ROOT, '../docs/reconstruction/team-evidence');
  if (existsSync(dir)) {
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    check('per-team evidence was split out of the census', files.length >= 10, String(files.length));
    // These are evidence, not assignments. If that framing is lost, a seat
    // could read a 2026-08-28 status row as a live objective.
    const sample = readFileSync(resolve(dir, files[0]), 'utf8');
    check('team evidence states it is not a backlog or an objective', /not\*\* a current backlog|not a current backlog/.test(sample));
    check('team evidence creates no assignment', /creates no assignment/.test(sample));
    check('team evidence cites its capture date', /2026-08-28/.test(sample));
    check('team evidence distinguishes its row priority from an authority tier',
      /not an authority tier/.test(sample));
  }
}

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
