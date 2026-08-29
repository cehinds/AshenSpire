// tools/artifact-provenance.mjs — WHICH TREE DID THIS MEASUREMENT ACTUALLY SEE?
//
// Vira's finding, and it is a defect in the instrument's own SCOPE rather than
// in any instrument's arithmetic. Eleven tools in this directory measure
// `dist/AshenSpire.html`. Every one of them names the file. **Naming the file
// is not naming its freshness.** `tools/settingsreach.mjs` measured a bundle
// two merges behind its source, printed OK, and that green was cited inside a
// signed commit — the tool was not wrong about anything it said, it was silent
// about the one thing that made its answer worthless.
//
// The two other doors onto this both miss it:
//   - a git-ancestor property on the bundle checks the REPO. Vira falsified her
//     own proposal against `ce4f171` and reported it rather than defending it:
//     recall 1 in 3 across seven refs. It catches "nobody rebuilt"; it cannot
//     catch "somebody rebuilt from a different tree."
//   - rebuild-and-compare checks the ARTIFACT, and costs a full build per run.
// Neither says anything to a reader of a tool's output about what that tool
// was looking at. This does, and it is the door with no owner.
//
// WHAT THIS PRINTS ARE FACTS, NEVER AN INFERENCE. The sha256 of the bytes that
// were read; the commit that last touched that path; the ref the tool was
// invoked at; whether the working tree is dirty. When the first two disagree it
// says so and counts the distance — that is still a fact, not a verdict, and
// the tool's own PASS/FAIL is untouched by it. Sten's clause 7 applied to the
// SUBJECT of a measurement rather than to its number: every count carries the
// ref it was counted at, and an artifact is a count.
//
// IT NEVER THROWS AND NEVER EXITS. A provenance line that can take an
// instrument down would be a worse defect than the silence it replaces — and a
// tarball with no `.git` is a legitimate place to run these, so "no git here"
// is a thing to say, not to fail on.
//
// Usage, one line per tool, right after ROOT is resolved:
//
//   import { printArtifactProvenance } from './artifact-provenance.mjs';
//   printArtifactProvenance(resolve(ROOT, 'dist/AshenSpire.html'), ROOT);

import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { relative, resolve } from 'node:path';

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/**
 * artifactProvenance(file, root) → the facts, or a `reason` why there are none.
 * Pure: reads, never writes, never throws.
 */
export function artifactProvenance(file, root) {
  const abs = resolve(file);
  if (!existsSync(abs)) return { file: abs, missing: true };
  const bytes = readFileSync(abs);
  const out = {
    file: abs,
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    mtime: statSync(abs).mtime.toISOString().replace('T', ' ').slice(0, 19),
  };
  const rel = relative(root, abs) || abs;
  const head = git(root, ['rev-parse', '--short', 'HEAD']);
  if (!head) { out.noGit = true; return out; }
  out.head = head;
  // Dirty is asked about THIS PATH, not the whole tree: a tool run beside an
  // unrelated edit is not measuring an unknown artifact, and crying wolf is how
  // a warning gets trained out of a reader.
  out.dirty = !!git(root, ['status', '--porcelain', '--', rel]);
  out.touchedAt = git(root, ['log', '-1', '--format=%h', '--', rel]) || null;
  out.touchedWhen = out.touchedAt ? git(root, ['log', '-1', '--format=%ad', '--date=short', '--', rel]) : null;
  if (out.touchedAt && !out.dirty) {
    const behind = git(root, ['rev-list', '--count', `${out.touchedAt}..HEAD`]);
    out.commitsSince = behind == null ? null : Number(behind);
  }
  return out;
}

/** The one line (or three) a tool prints. Returns the strings it printed. */
export function printArtifactProvenance(file, root, log = console.log) {
  const p = artifactProvenance(file, root);
  const lines = [];
  const name = relative(root, p.file) || p.file;
  if (p.missing) {
    lines.push(`  artifact       : ${name} — DOES NOT EXIST. Anything below measured something else or nothing.`);
  } else if (p.noGit) {
    lines.push(`  artifact       : ${name} sha256 ${p.sha256.slice(0, 12)} (${p.size} bytes, mtime ${p.mtime})`);
    lines.push(`  provenance     : no git here — which commit built this is UNKNOWN, not current.`);
  } else if (p.dirty) {
    lines.push(`  artifact       : ${name} sha256 ${p.sha256.slice(0, 12)} (${p.size} bytes)`);
    lines.push(`  provenance     : UNCOMMITTED at HEAD ${p.head} — these bytes are in no commit; nothing below is reproducible from a ref.`);
  } else {
    lines.push(`  artifact       : ${name} sha256 ${p.sha256.slice(0, 12)} (${p.size} bytes)`);
    const at = `${name}@${p.touchedAt}${p.touchedWhen ? ` ${p.touchedWhen}` : ''}`;
    if (p.touchedAt === p.head || p.commitsSince === 0) {
      lines.push(`  provenance     : measured ${at}, invoked at HEAD ${p.head} — same commit.`);
      // THE BLIND SPOT, PRINTED ON THE GREEN LINE, because that is the only
      // line where a reader might stop reading. Same-commit says the bundle was
      // WRITTEN here; it cannot say it was BUILT FROM here. A rebuild run
      // against a different tree and committed alongside the source lands
      // exactly on this line — observed, not reasoned: a tree whose ui.css
      // carries a rule the bundle beside it has never contained prints this
      // sentence unchanged. It is the same class Vira's git-ancestor proposal
      // missed at ce4f171, and it is the reason the sha256 above is printed at
      // all: two tools at one HEAD reporting two different digests is the one
      // signal that survives this hole. Closing it needs a rebuild-and-compare,
      // which is a different tool and does not exist yet.
      lines.push(`                   Same commit is not same SOURCE: a bundle built elsewhere and`);
      lines.push(`                   committed beside its source prints this exact line. Compare the`);
      lines.push(`                   sha256 above across tools — that is the half this cannot see.`);
    } else {
      lines.push(`  provenance     : measured ${at} while HEAD is ${p.head}`
        + `${p.commitsSince != null ? ` — ${p.commitsSince} commit(s) since this file was last written` : ''}.`);
      lines.push(`                   NOT A VERDICT AND NOT A FAILURE: those commits may not touch anything`);
      lines.push(`                   this artifact contains. It is the question a reader must answer before`);
      lines.push(`                   quoting the result below. Rebuild to remove the question.`);
    }
  }
  for (const l of lines) log(l);
  return lines;
}
