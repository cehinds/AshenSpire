// tools/watched-selftest.mjs — the known-bad corpus for tools/watched.mjs.
//
// Bjorn, 2026-08-08. *The instrument rule* (`commons/development.md`): a check
// whose failing case nobody has watched fail is `unknown`, not green. This audit
// exists because a board said `shipped` about a screen nobody had opened — so an
// audit that could not itself go red would be the same defect one level up, and
// it would be MY defect this time.
//
// Nine plants. Each mutates ONE thing — a probe, the ledger, the states — writes
// it to a temp dir, runs the REAL tool end-to-end against it, and requires the
// expected red. Nothing is faked in memory: the plants go through the same
// argument parsing, the same browser, the same verdict code as a real run.
//
//   1  not-there        a control that cannot be on the screen
//   2  unreachable      a screen whose door does not exist
//   3  unaccounted      a ledger row with no probe
//   4  stale            a probe for a row the ledger does not carry
//   5  there-but-wrong  a state expectation that must fail
//   6  source           a content pattern that cannot be found
//   7  FLOOR exit 2     a ledger with zero rows
//   8  FLOOR exit 2     a ledger whose rows are all in other states
//   9  FLOOR exit 2     a probe that names nobody in `by`
//
// Run: node tools/watched.mjs --selftest --ledger <path-to-asks.json>
// Exit: 0 all nine observed red · 1 any plant came back GREEN (the bad news)

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function runSelftest({ ROOT, LEDGER, PROBES }) {
  if (!LEDGER) { console.error('FLOOR: --selftest still needs --ledger — the plants mutate the real ledger, they do not invent one'); return 2; }
  const dir = mkdtempSync(join(tmpdir(), 'watched-selftest-'));
  const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
  const probes = JSON.parse(readFileSync(PROBES, 'utf8'));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const probeOf = (id) => probes.probes.find((p) => p.id === id);

  const write = (name, obj) => { const p = join(dir, name); writeFileSync(p, JSON.stringify(obj, null, 1)); return p; };
  const shotsDir = join(dir, 'shots'); mkdirSync(shotsDir, { recursive: true });

  // Each plant: { name, ledger?, probes?, only, want: /regex/, wantExit }
  const plants = [];

  // 1 — a control that cannot be there.
  {
    const pr = clone(probes);
    probeOf.call(null, 'S3');
    const p = pr.probes.find((x) => x.id === 'S3');
    p.expect.present = { 'a control that does not exist': '#no-such-control-anywhere' };
    delete p.expect.count; delete p.focus;
    plants.push({ name: '1 not-there', probes: pr, only: 'S3', want: /S3\s+not-there/, wantExit: 1 });
  }

  // 2 — a door that does not exist.
  {
    const pr = clone(probes);
    const p = pr.probes.find((x) => x.id === 'S3');
    p.reach = [{ op: 'goto', q: '' }, { op: 'click', sel: '#no-such-door' }];
    plants.push({ name: '2 unreachable', probes: pr, only: 'S3', want: /S3\s+unreachable/, wantExit: 1 });
  }

  // 3 — the ledger has a row and this instrument has no probe for it. THE plant
  // that matters most: it is the shape of the defect the whole audit is about.
  {
    const pr = clone(probes);
    pr.probes = pr.probes.filter((x) => x.id !== 'S3');
    plants.push({ name: '3 unaccounted', probes: pr, only: 'S3', want: /S3\s+unaccounted/, wantExit: 1 });
  }

  // 4 — drift the other way: a probe for a row the ledger dropped.
  {
    const pr = clone(probes);
    pr.probes.push({ id: 'ZZ9', by: 'Bjorn', read: 'a plant', screen: 'nowhere',
      reach: [{ op: 'goto', q: '' }], expect: { present: { title: '#settings' } } });
    plants.push({ name: '4 stale probe', probes: pr, only: 'S3', want: /STALE PROBES[\s\S]*ZZ9/, wantExit: 1 });
  }

  // 5 — on the screen, and not in the state he opens it in.
  {
    const pr = clone(probes);
    const p = pr.probes.find((x) => x.id === 'S3');
    p.expect.wrong = [{ js: 'true', why: 'PLANT: a state expectation that must fail' }];
    plants.push({ name: '5 there-but-wrong', probes: pr, only: 'S3', want: /S3\s+there-but-wrong/, wantExit: 1 });
  }

  // 6 — the content check. P3/P5 rest on this path, so it must be shown to fail
  // on a pattern that IS there as well as one that is not; here we plant a
  // pattern nobody could satisfy and require the red.
  {
    const pr = clone(probes);
    const p = pr.probes.find((x) => x.id === 'S3');
    p.expect.source = [{ in: 'src/content', pattern: 'status:\\s*\'a-status-nobody-wrote\'', min: 1, why: 'PLANT' }];
    plants.push({ name: '6 source min', probes: pr, only: 'S3', want: /S3\s+not-there[\s\S]*a-status-nobody-wrote/, wantExit: 1 });
  }

  // 7 — zero rows. An empty population is never a pass.
  plants.push({ name: '7 FLOOR zero rows', ledger: { ...clone(ledger), rows: [] }, only: 'S3', want: /FLOOR: the ledger carries 0 rows/, wantExit: 2 });

  // 8 — rows, but none in the states asked for. The subtler empty: the file
  // reads fine and the filter matches nothing.
  {
    const lg = clone(ledger);
    lg.rows = lg.rows.map((r) => ({ ...r, state: 'not-started' }));
    plants.push({ name: '8 FLOOR empty population', ledger: lg, only: 'S3', want: /FLOOR: 0 rows in states/, wantExit: 2 });
  }

  // 9 — an unsigned edge. A shape list and a tolerance are the same object.
  {
    const pr = clone(probes);
    delete pr.probes.find((x) => x.id === 'S3').by;
    plants.push({ name: '9 FLOOR unsigned probe', probes: pr, only: 'S3', want: /names nobody in `by`/, wantExit: 2 });
  }

  console.log(`watched --selftest — ${plants.length} plants, each run through the REAL tool\n`);
  let failed = 0;
  for (const pl of plants) {
    const lPath = pl.ledger ? write(`${pl.name.split(' ')[0]}-ledger.json`, pl.ledger) : LEDGER;
    const pPath = pl.probes ? write(`${pl.name.split(' ')[0]}-probes.json`, pl.probes) : PROBES;
    let out = ''; let code = 0;
    try {
      out = execFileSync(process.execPath, [join(ROOT, 'tools/watched.mjs'),
        '--ledger', lPath, '--probes', pPath, '--only', pl.only, '--out', shotsDir],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      code = e.status ?? -1; out = `${e.stdout || ''}${e.stderr || ''}`;
    }
    const sawRed = pl.want.test(out);
    const sawExit = code === pl.wantExit;
    const ok = sawRed && sawExit;
    if (!ok) failed++;
    console.log(`  ${ok ? 'RED ok' : 'GREEN  '}  ${pl.name.padEnd(26)} exit ${code} (wanted ${pl.wantExit})${sawRed ? '' : '  — THE EXPECTED RED DID NOT APPEAR'}`);
    if (!ok) console.log(`          last lines: ${out.trim().split('\n').slice(-4).join(' | ').slice(0, 300)}`);
  }
  console.log('');
  if (failed) {
    console.log(`${failed} of ${plants.length} plants came back GREEN. This instrument may NOT be cited as coverage.`);
    return 1;
  }
  console.log(`all ${plants.length} plants observed red. The verdicts this tool prints can go the other way, which is the only reason to believe one.`);
  const picsFailed = pictureSelftest({ ROOT, LEDGER, PROBES });
  if (picsFailed) {
    console.log(`\nThe COMMITTED PICTURES sub-check misbehaved. This instrument may NOT be cited for that half.`);
    return 1;
  }
  console.log('BOUNDARY: the plants prove the VERDICT MACHINE and the COMMITTED PICTURES sub-check can fail.');
  console.log('  They do not prove any individual probe points at the right control — that is what `read` and');
  console.log('  `by` in the probe file are for, and they are a person.');
  return 0;
}

// ---------------------------------------------------------------------------
// THE SUB-CHECK NOBODY HAD PLANTED — `committedPictures()`.
//
// Bjorn, 2026-08-15. The nine plants above prove the VERDICT MACHINE can fail.
// They say nothing about the other half of the same run: the audit of the
// pictures checked into `docs/preview/`, which is red on STALE and on NEVER
// PICTURED and had no known-bad at all. Two halves in one instrument, one of
// them watched — and citing the file as though the observation covered both is
// the borrowed-evidence shape Saga's tell was built for, wearing my own hat.
//
// THE DOOR IS A REAL GIT REPOSITORY. `committedPictures()` decides staleness by
// `git log -1 --date=short` on real paths, so a plant that hands it dates
// proves nothing about the git call — the exact downstream mistake the same-door
// clause exists for. Each tree below is a COPY OF THIS REPO with a REAL git
// history whose commit dates are authored by the plant, and the real tool is run
// inside it as a whole program.
//
// A CLEAN BASELINE FIRST, because the real tree is ALREADY red on this half (14
// stale pictures since July at 929b6ea). A plant scored against a tree that was
// already red would be the legal red — a mutation credited with a defect it did
// not cause. So the baseline commits src/ FIRST and the pictures SECOND: nothing
// stale, nothing unpictured, and only then is each plant applied to it.
// ---------------------------------------------------------------------------
function pictureSelftest({ ROOT, LEDGER, PROBES }) {
  const dir = mkdtempSync(join(tmpdir(), 'watched-pics-'));
  const NEEDED = ['src', 'styles', 'tools', 'content', 'dist', 'docs', 'index.html'];
  const git = (cwd, args, date) => execFileSync('git', args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date,
      GIT_AUTHOR_NAME: 'Plant', GIT_AUTHOR_EMAIL: 'plant@local',
      GIT_COMMITTER_NAME: 'Plant', GIT_COMMITTER_EMAIL: 'plant@local' },
  });

  // A tree whose pictures are NEWER than its code: the state this sub-check
  // calls clean. `mutate` runs after the code commit and before the picture one.
  const build = (name, { codeFirst = true, mutate = null } = {}) => {
    const t = join(dir, name);
    mkdirSync(t, { recursive: true });
    for (const p of NEEDED) cpSync(join(ROOT, p), join(t, p), { recursive: true });
    git(t, ['init', '-q'], '2026-01-01T00:00:00Z');
    const pics = join(t, 'docs/preview');
    const early = '2026-01-02T00:00:00Z'; const late = '2026-01-09T00:00:00Z';
    if (codeFirst) {
      git(t, ['add', 'src', 'styles', 'tools', 'content', 'dist', 'index.html'], early);
      git(t, ['commit', '-q', '-m', 'code'], early);
      if (mutate) mutate(t);
      git(t, ['add', '-A'], late);
      git(t, ['commit', '-q', '-m', 'pictures after code'], late);
    } else {
      // The defect: the pictures were committed and then the code moved on.
      git(t, ['add', 'docs'], early);
      git(t, ['commit', '-q', '-m', 'pictures'], early);
      git(t, ['add', '-A'], late);
      git(t, ['commit', '-q', '-m', 'code after pictures'], late);
    }
    return { t, pics };
  };

  const runIn = (t) => {
    let out = ''; let code = 0;
    try {
      out = execFileSync(process.execPath, [join(t, 'tools/watched.mjs'),
        '--ledger', LEDGER, '--probes', PROBES, '--only', 'S3', '--out', join(t, 'shots')],
      { cwd: t, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
    } catch (e) { code = e.status ?? -1; out = `${e.stdout || ''}${e.stderr || ''}`; }
    return { out, code };
  };

  const cases = [
    {
      // THE BASELINE IS CONSTRUCTED FOR STALENESS AND DELTA-SCORED FOR THE
      // OTHER HALF, and the difference is not tidiness. Commit order is mine to
      // author, so `none stale.` is a real clean baseline. The unpictured list
      // is NOT: this repo genuinely carries EIGHT states nobody has ever
      // photographed, and my first version of this case asserted the list was
      // empty — which failed against the tree's own standing debt and would
      // have made case C's red partly inherited. So C is scored on the arrival
      // of `plantstate` BY NAME, a string the real tree can never produce, and
      // the baseline asserts only that it is absent before the plant.
      name: 'A baseline — pictures newer than code',
      want: 'GREEN', check: (out) => /none stale\./.test(out) && !/plantstate/.test(out),
      tree: () => build('A', { codeFirst: true }),
      // Exit code deliberately NOT asserted: this run's ROW verdicts belong to
      // the other half of the tool and can be red for reasons that are not this
      // sub-check's. Saying so is the point; quietly asserting exit 0 here would
      // make the case pass or fail for somebody else's reason.
    },
    {
      name: 'B a picture of a build that is gone',
      want: 'RED', check: (out) => /STALE — a picture of a build that no longer exists: [1-9]/.test(out),
      tree: () => build('B', { codeFirst: false }),
    },
    {
      name: 'C a state nobody ever photographed',
      want: 'RED', check: (out) => /NEVER PICTURED[\s\S]*plantstate/.test(out),
      tree: () => build('C', {
        codeFirst: true,
        // A new ?shot= state in the app, with no picture carrying its name —
        // entering by main.js, which is where the denominator is derived from.
        mutate: (t) => {
          const f = join(t, 'src/main.js');
          const s = readFileSync(f, 'utf8');
          const out = s.replace(/(\n\s*)(if \(shotState === ')/, `$1if (shotState === 'plantstate') { /* PLANT */ }$1$2`);
          if (out === s) throw new Error('the plant edited nothing in src/main.js');
          writeFileSync(f, out);
        },
      }),
    },
  ];

  console.log('\nwatched --selftest, SUB-CHECK: committed pictures — 3 cases, each a COPY OF THE REPO with a');
  console.log('  REAL git history whose dates the plant authors, run through the real tool.\n');
  let failed = 0;
  for (const c of cases) {
    let out = ''; let code = 0;
    try { const { t } = c.tree(); ({ out, code } = runIn(t)); }
    catch (e) { console.log(`  BAD  ${c.want.padEnd(5)} ${c.name.padEnd(40)} the plant itself failed: ${e.message}`); failed++; continue; }
    const ok = c.check(out);
    if (!ok) failed++;
    console.log(`  ${ok ? 'ok  ' : 'BAD '} ${c.want.padEnd(5)} ${c.name.padEnd(40)} exit ${code}${ok ? '' : '  — the expected line did not appear'}`);
    if (!ok) {
      const sec = out.split('\n').filter((l) => /COMMITTED PICTURES|STALE|NEVER PICTURED|none stale/.test(l));
      console.log(`         saw: ${sec.join(' | ').slice(0, 260) || out.trim().split('\n').slice(-2).join(' | ').slice(0, 260)}`);
    }
  }
  rmSync(dir, { recursive: true, force: true });
  if (!failed) {
    console.log('\n  the pictures sub-check goes red on a stale picture and on an unpictured state, and stays');
    console.log('  green on a tree where the pictures are newer than the code.');
    console.log('  DOOR: real .png files and real src/ files in a real git repo, read through the same');
    console.log('  `git log -1 --date=short` and the same directory walk the real audit performs.');
    console.log('  NOT PASSED THROUGH: the picture-TAKING. Nothing here runs the capture harness, so a');
    console.log('  photograph that is fresh and WRONG is outside this door — the eyes own that.');
    console.log('  STANDING, NOT PLANTED: this repo carries eight ?shot= states nobody has ever');
    console.log('  photographed. The baseline does not pretend otherwise — case C is scored on');
    console.log('  `plantstate` arriving by name, never on the size of that list.');
  }
  return failed;
}
