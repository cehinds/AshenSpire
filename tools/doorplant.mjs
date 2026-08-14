// tools/doorplant.mjs — the same-door selftest harness: plant a known-bad in a
// COPY OF THE REAL TREE, run the tool whole from that copy, watch it go red.
//
// WHY. Vira's doors audit (docs/TOOL-DOORS-AUDIT.md, vira/the-doors-audited,
// 2026-08-14) classified 37 asserting tools with no re-runnable red and named
// the recurring defect: a plant handed to the acceptance predicate downstream
// of the readFileSync / import / serve road the real input travels. The
// instrument rule's same-door clause (commons/development.md, family repo):
// the known-bad must enter where the real input enters, and the check states
// its door in its own output. This harness is the one home of that mechanic
// for the tools that read THIS TREE — closedsets.mjs proved the pattern
// (plants written into a copied real tree on disk, read back through the same
// collect()); this generalizes it to a whole-tool subprocess run.
//
// WHAT IT DOES, per plant:
//   1. copies the real tree (src/, content/, styles/, tools/*.mjs, index.html)
//      to a scratch dir — the copy IS a runnable checkout;
//   2. edits the named file in the copy — the plant enters as FILE BYTES in
//      the same file the real defect would live in;
//   3. runs `node tools/<tool>` with cwd = the copy, so every stage the real
//      run performs (readFileSync, import graph, serve.mjs, the browser boot
//      for browser tools) runs against the planted bytes;
//   4. requires a non-zero exit AND an output line matching the plant's
//      expected red — a red for the wrong reason is NOT a catch;
//   5. restores the pristine bytes (the revert is discarding the edit; the
//      real tree was never touched), and finally re-runs CLEAN, which must be
//      green — both edges, every time.
//
// A plant whose find-string no longer exists is a HARD RED (`plant site
// drifted`), never a skip — a corpus that silently stops running is the
// eleven-instruments shape (gracerefill's legacy corpus, the same audit).
//
// HARNESS, not a check: this file asserts nothing about the game. Its callers
// do. It is exercised — observed red — every time a tool's selftest runs,
// because a NOT-CAUGHT plant exits 1 by this file's own hand.
//
// REMOVAL CONDITION: deleted the day the suite runner grows a per-test door
// harness that subsumes it, or the last tool selftest importing it is deleted.

import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REAL_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const COPY_SET = ['src', 'content', 'styles', 'index.html', 'tools'];

function copyTree() {
  const dir = mkdtempSync(join(tmpdir(), 'doorplant-'));
  for (const entry of COPY_SET) {
    const from = join(REAL_ROOT, entry);
    if (!existsSync(from)) continue;
    cpSync(from, join(dir, entry), {
      recursive: true,
      filter: (src) => !/tools[\\/](results|shots)([\\/]|$)/.test(src) && !/\.(png|py)$/.test(src),
    });
  }
  return dir;
}

function runTool(root, tool, args, timeoutMs, env) {
  const r = spawnSync(process.execPath, [join('tools', tool), ...args], {
    cwd: root, timeout: timeoutMs, encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { code: r.status, out: `${r.stdout || ''}\n${r.stderr || ''}`, signal: r.signal };
}

/**
 * plants: [{ name, file, find, replace }] or [{ name, file, append }]
 *   file    — repo-relative path the real input lives in
 *   find    — exact substring that MUST exist in the copy (else hard red)
 *   replace — its replacement (the defect)
 *   append  — text appended to the file instead (the defect arrives at EOF)
 *   expectRed — RegExp the failing run's output must match
 * args: extra argv for every tool run (e.g. ['--only', '390x844'])
 * Returns an exit code: 0 all plants caught + clean green, 1 otherwise.
 */
export async function doorSelftest({ tool, plants, args = [], timeoutMs = 300000, env = {} }) {
  console.log(`${tool} --selftest — same-door known-bad corpus (${plants.length} plant(s))`);
  console.log(`DOOR: each plant enters as FILE BYTES in a copied real tree at the file named below —`);
  console.log(`      the same file the real defect would ship in. The tool then runs WHOLE from that`);
  console.log(`      copy (cwd = copy root): readFileSync, the import graph, serve.mjs and any browser`);
  console.log(`      boot all read the planted bytes. Nothing is handed to an inner function directly.`);
  console.log(`      Revert = the copy is discarded; the real tree is never edited.`);
  const root = copyTree();
  let failed = 0;
  try {
    for (const p of plants) {
      const target = join(root, p.file);
      const pristine = readFileSync(target, 'utf8');
      let planted;
      if (p.append != null) planted = pristine + '\n' + p.append + '\n';
      else {
        if (!pristine.includes(p.find)) {
          console.error(`RED  plant "${p.name}": PLANT SITE DRIFTED — ${p.file} no longer contains the find-string. A corpus that silently stops running is the defect; rewrite the plant.`);
          failed++;
          continue;
        }
        planted = pristine.replace(p.find, p.replace);
      }
      writeFileSync(target, planted);
      const r = runTool(root, tool, args, timeoutMs, env);
      writeFileSync(target, pristine);
      const matched = p.expectRed.test(r.out);
      if (r.code !== 0 && matched) {
        const line = r.out.split('\n').find((l) => p.expectRed.test(l)) || '';
        console.log(`  CAUGHT  "${p.name}" -> ${p.file} — exit ${r.code}; red named: ${line.trim().slice(0, 140)}`);
      } else {
        failed++;
        console.error(`  NOT CAUGHT  "${p.name}" -> ${p.file} — exit ${r.code}${r.signal ? ` (signal ${r.signal})` : ''}, expected-red ${matched ? 'matched but exit 0' : 'NOT in output'}. The known-bad was armed by the real door and this tool stayed green — decoration, not evidence.`);
        console.error(`    tail: ${r.out.trim().split('\n').slice(-6).join('\n    ')}`);
      }
    }
    const clean = runTool(root, tool, args, timeoutMs, env);
    if (clean.code === 0) console.log(`  CLEAN  unplanted copy runs green (exit 0) — the reds above were the plants, not the harness.`);
    else {
      failed++;
      console.error(`  RED  clean copy exited ${clean.code} — the baseline is not green, so no plant above proves anything.`);
      console.error(`    tail: ${clean.out.trim().split('\n').slice(-8).join('\n    ')}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log(failed ? `SELFTEST RED — ${failed} plant(s)/edge(s) failed` : `SELFTEST GREEN — every plant went red by the same door the real input enters, and the clean copy is green`);
  return failed ? 1 : 0;
}
