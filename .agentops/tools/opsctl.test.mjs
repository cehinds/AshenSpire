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

import { runValidate, runSelftest, renderGovernance, loadContracts, strictParse, validateSchema, ROOT, runWake, loadRuntime, computeCapsuleHash, runDrill, runCommand, runMigrate, parseIssueCommand, buildCapsule, computeDispatch, runReseal, runReseat, renderHud, renderHubSite } from './opsctl.mjs';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
  check('all sixteen contracts loaded', Object.keys(contracts).length === 16, Object.keys(contracts).join(','));
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
  check('an it-support seat wakes it-support, not maker', byTicket['AS-HD-057'] && byTicket['AS-HD-057'].wake === 'it-support', byTicket['AS-HD-057'] && byTicket['AS-HD-057'].wake);
  check('a qa seat wakes qa-independent', byTicket['AS-HD-055'] && byTicket['AS-HD-055'].wake === 'qa-independent', byTicket['AS-HD-055'] && byTicket['AS-HD-055'].wake);
  check('every unblocked seat wakes its own capsule owner',
    d.filter((e) => !e.escalation_class).every((e) => e.wake === rt.capsules[e.ticket].owner_actor),
    JSON.stringify(d.filter((e) => !e.escalation_class && e.wake !== rt.capsules[e.ticket].owner_actor)));
  // A dead lease is an ownership question, so it escalates rather than waking a
  // seat that would stop the moment it read its own capsule.
  const rtDead = loadRuntime();
  const victim = rtDead.capsules['AS-HD-057'];
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
    git('checkout', '-q', '--detach');
    const det = runReseat(agentops, 'AS-HD-050');
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

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
