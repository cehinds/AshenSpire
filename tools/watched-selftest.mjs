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
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
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
  console.log('BOUNDARY: the plants prove the VERDICT MACHINE can fail. They do not prove any individual probe');
  console.log('  points at the right control — that is what `read` and `by` in the probe file are for, and they are a person.');
  return 0;
}
