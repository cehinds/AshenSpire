#!/usr/bin/env node
// tools/pages-site.mjs — assemble the GitHub Pages site that lists EVERY branch's
// builds and serves each one at its own address.
//
//   https://cehinds.github.io/AshenSpire/                 the build index (all branches)
//   https://cehinds.github.io/AshenSpire/dev/             that branch's build list, newest first
//   https://cehinds.github.io/AshenSpire/dev/1908/        the dev build with ordinal 1908, playable
//   https://cehinds.github.io/AshenSpire/dev/latest/      alias for the newest dev build
//   … and the same for test/, release/, main/.
//
// WHAT IT READS. Nothing is typed here. Every build comes out of git: for each
// branch, the first-parent commits that touched buildordinal.json name the
// builds; each commit's buildordinal.json gives ordinal, digest and date; that
// commit's AshenSpire.html IS the build, copied byte-for-byte (the check below
// proves it). The version triple is read out of the copied bundle itself
// (`version: '…'` in src/content/index.js), so a bump shows up here without an
// edit. The changelog link points at CHANGELOG.md AT THAT COMMIT, not at a
// moving branch head, so a build's changelog stays the one it shipped with.
//
// WHAT ELSE IS SERVED. The whole `main` tree is copied first, so every URL the
// site serves today (/AshenSpire.html, /hud/, /review-approval-hub/, /docs/…)
// keeps working. The one deliberate replacement is the root index.html: it is
// the build index now; main's own root page is kept at /index-game.html.
//
// USAGE
//   node tools/pages-site.mjs --out _site [--keep 12] [--branches dev,test,release,main] [--remote origin]
//   node tools/pages-site.mjs --check _site        re-verify an assembled site against git
//   node tools/pages-site.mjs --selftest           generate into a temp dir with --keep 1 and verify
//
// VERDICT (tools/verdict.mjs form): "pages-site: OK — N checks passed", where a
// check is one build page proven byte-identical to its git blob, plus one per
// index page proven to link every build it lists.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync, readdirSync, statSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_URL = 'https://github.com/cehinds/AshenSpire';
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt; };
const has = (name) => argv.includes(name);

const REMOTE = flag('--remote', 'origin');
const BRANCHES = flag('--branches', 'dev,test,release,main').split(',').map((s) => s.trim()).filter(Boolean);
const KEEP = Math.max(1, Number(flag('--keep', '10')) || 10);
const BRANCH_ROLE = {
  dev: 'integration branch — where merged work lands first; not a release',
  test: 'QA branch — the dev→test promotion under independent test',
  release: 'release-candidate branch — awaiting the owner’s release cut',
  main: 'stable — what the classic Play link has always served',
};

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
}
function gitBuf(args) {
  return execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 28 });
}
function refFor(branch) {
  // Prefer the remote-tracking ref (CI fetches all four); fall back to a local branch.
  for (const r of [`${REMOTE}/${branch}`, branch]) {
    try { git(['rev-parse', '--verify', '--quiet', `${r}^{commit}`]); return r; } catch { /* next */ }
  }
  throw new Error(`no ref for branch '${branch}' (tried ${REMOTE}/${branch}, ${branch})`);
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/** Every distinct build on a branch, newest first: [{ordinal, digest, built, sha, date, version}] */
function buildsOf(branch, keep) {
  const ref = refFor(branch);
  const log = git(['log', '--first-parent', '--format=%H%x09%cI', ref, '--', 'buildordinal.json']).trim();
  const seen = new Set();
  const out = [];
  for (const line of log ? log.split('\n') : []) {
    const [sha, date] = line.split('\t');
    let meta;
    try { meta = JSON.parse(git(['show', `${sha}:buildordinal.json`])); } catch { continue; }
    const ordinal = Number(meta.ordinal);
    if (!Number.isInteger(ordinal) || seen.has(ordinal)) continue;
    // A build is only a build if its artifact is at that commit.
    try { git(['cat-file', '-e', `${sha}:AshenSpire.html`]); } catch { continue; }
    seen.add(ordinal);
    out.push({ branch, ordinal, digest: String(meta.digest || ''), built: String(meta.built || date.slice(0, 10)), sha, date });
    if (out.length >= keep) break;
  }
  return { ref, head: git(['rev-parse', ref]).trim(), builds: out };
}

function versionIn(html) {
  // The bundle inlines src/content/index.js; its `version: '…'` is the one home of the triple.
  // The bundle names the module more than once (asset map, then the module body);
  // the body is the last mention, and the triple sits near its top.
  const re = /version:\s*'([0-9][0-9A-Za-z.+-]*)'/;
  const at = html.lastIndexOf('"src/content/index.js"');
  const near = at >= 0 ? html.slice(at, at + 20000).match(re) : null;
  const m = near || html.match(re);
  return m ? m[1] : null;
}

const CSS = `
:root{color-scheme:light dark;--fg:#1c1a17;--bg:#f6f2ea;--mut:#6b655c;--line:#d9d2c4;--acc:#8a4b1f;--card:#fffdf8}
@media (prefers-color-scheme:dark){:root{--fg:#ece6da;--bg:#17150f;--mut:#a39c8f;--line:#3a352b;--acc:#e0a56a;--card:#1f1c15}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,Segoe UI,Roboto,sans-serif}
main{max-width:64rem;margin:0 auto;padding:2rem 1.25rem 4rem}h1{font-size:1.9rem;margin:.2rem 0}h2{font-size:1.25rem;margin:2rem 0 .5rem}
p.lead{color:var(--mut);margin:.25rem 0 1.5rem}.grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(18rem,1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:1rem 1.1rem}.card h3{margin:0 0 .25rem;font-size:1.15rem}
.role{color:var(--mut);font-size:.9rem;margin:0 0 .75rem}.stamp{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:1.05rem;margin:.25rem 0}
.meta{color:var(--mut);font-size:.85rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}
a{color:var(--acc)}a.play{display:inline-block;margin:.6rem .6rem 0 0;padding:.45rem .9rem;border:1px solid var(--acc);border-radius:8px;text-decoration:none;font-weight:600}
table{width:100%;border-collapse:collapse;margin:.5rem 0 1rem}th,td{text-align:left;padding:.45rem .5rem;border-bottom:1px solid var(--line);font-size:.92rem;vertical-align:top}
th{color:var(--mut);font-weight:600}td.mono,th.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}footer{color:var(--mut);font-size:.85rem;margin-top:3rem}
.note{border-left:3px solid var(--acc);padding:.4rem .8rem;color:var(--mut);font-size:.9rem;margin:1rem 0}
`;

function stampOf(b) { return b.version ? `BUILD ${b.version}.${b.ordinal} · src ${b.digest}` : `BUILD ·${b.ordinal} · src ${b.digest}`; }
function changelogUrl(b) { return `${REPO_URL}/blob/${b.sha}/CHANGELOG.md`; }
function commitUrl(b) { return `${REPO_URL}/commit/${b.sha}`; }

function rowsTable(builds, rel) {
  return `<table><thead><tr><th>Build</th><th class="mono">Stamp</th><th>Built</th><th>Commit</th><th>Changelog</th></tr></thead><tbody>${
    builds.map((b, i) => `<tr><td><a href="${rel}${b.branch}/${b.ordinal}/">${b.branch}/${b.ordinal}</a>${i === 0 ? ' <em>(latest)</em>' : ''}</td><td class="mono">${esc(stampOf(b))}</td><td>${esc(b.built)}</td><td class="mono"><a href="${commitUrl(b)}">${b.sha.slice(0, 10)}</a></td><td><a href="${changelogUrl(b)}">CHANGELOG at this build</a></td></tr>`).join('')
  }</tbody></table>`;
}

function rootIndex(branchData, generatedAt) {
  const cards = branchData.map(({ branch, builds }) => {
    const b = builds[0];
    if (!b) return `<section class="card"><h3>${esc(branch)}</h3><p class="role">${esc(BRANCH_ROLE[branch] || '')}</p><p class="meta">no build found on this branch</p></section>`;
    return `<section class="card"><h3>${esc(branch)}</h3><p class="role">${esc(BRANCH_ROLE[branch] || '')}</p>
<p class="stamp">${esc(stampOf(b))}</p><p class="meta">built ${esc(b.built)} · commit <a href="${commitUrl(b)}">${b.sha.slice(0, 10)}</a> · <a href="${changelogUrl(b)}">changelog</a></p>
<a class="play" href="${branch}/${b.ordinal}/">Play ${esc(branch)} ${b.ordinal}</a> <a href="${branch}/">all ${esc(branch)} builds (${builds.length})</a></section>`;
  }).join('\n');
  const all = branchData.flatMap((d) => d.builds).sort((a, b) => b.ordinal - a.ordinal);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AshenSpire — builds</title><style>${CSS}</style></head><body><main>
<h1>AshenSpire — every build, by branch</h1>
<p class="lead">Each build is the exact <code>AshenSpire.html</code> that commit shipped, served at <code>/&lt;branch&gt;/&lt;build&gt;/</code>. The stamp here is the one the game shows on its title screen.</p>
<div class="grid">${cards}</div>
<div class="note">Saves live in this site's browser storage and are shared between builds; a build that cannot read a save archives it by name instead of losing it. <strong>main</strong> is the stable line; <strong>dev</strong> is unreviewed integration work.</div>
<h2>All listed builds</h2>${rowsTable(all, '')}
<h2>Other pages on this site</h2>
<p><a href="AshenSpire.html">Stable standalone (main)</a> · <a href="index-game.html">main's source-module page</a> · <a href="hud/">Owner HUD</a> · <a href="review-approval-hub/">Review &amp; Approval Hub</a> · <a href="docs/component-catalog.html">UI component catalog</a> · <a href="${REPO_URL}">repository</a></p>
<footer>Generated ${esc(generatedAt)} by <code>tools/pages-site.mjs</code> from git history — nothing on this page is typed by hand. Listing the newest ${KEEP} builds per branch.</footer>
</main></body></html>`;
}

function branchIndex(branch, builds, head, generatedAt) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AshenSpire — ${esc(branch)} builds</title><style>${CSS}</style></head><body><main>
<p><a href="../">← all branches</a></p><h1>${esc(branch)} builds</h1><p class="lead">${esc(BRANCH_ROLE[branch] || '')} · branch head <a href="${REPO_URL}/commit/${head}">${head.slice(0, 10)}</a></p>
${builds.length ? `<p><a class="play" href="${builds[0].ordinal}/">Play latest (${builds[0].ordinal})</a> <a class="play" href="latest/">/latest/ alias</a></p>` : '<p class="meta">no build on this branch</p>'}
${rowsTable(builds, '../')}
<footer>Generated ${esc(generatedAt)} by <code>tools/pages-site.mjs</code>.</footer></main></body></html>`;
}

function assemble(outDir, keep) {
  const generatedAt = new Date().toISOString();
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  // 1. main's tree is the base so every existing URL keeps resolving.
  const mainRef = refFor('main');
  const tmp = mkdtempSync(join(tmpdir(), 'pages-site-main-'));
  execFileSync('sh', ['-c', `git -C "${ROOT}" archive --format=tar "${mainRef}" | tar -x -C "${tmp}"`]);
  cpSync(tmp, outDir, { recursive: true });
  rmSync(tmp, { recursive: true, force: true });
  if (existsSync(join(outDir, 'index.html'))) cpSync(join(outDir, 'index.html'), join(outDir, 'index-game.html'));
  writeFileSync(join(outDir, '.nojekyll'), '');

  let checks = 0;
  const branchData = [];
  for (const branch of BRANCHES) {
    const { head, builds } = buildsOf(branch, keep);
    for (const b of builds) {
      const html = gitBuf(['show', `${b.sha}:AshenSpire.html`]);
      b.version = versionIn(html.toString('latin1'));
      const dir = join(outDir, branch, String(b.ordinal));
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'index.html'), html);
      writeFileSync(join(dir, 'build.json'), JSON.stringify({ branch, ordinal: b.ordinal, version: b.version, digest: b.digest, built: b.built, commit: b.sha, changelog: changelogUrl(b), stamp: stampOf(b) }, null, 2) + '\n');
      // The proof: what was written is the blob, byte for byte.
      if (Buffer.compare(readFileSync(join(dir, 'index.html')), html) !== 0) throw new Error(`${branch}/${b.ordinal}: written build differs from git blob`);
      checks++;
    }
    if (builds[0]) {
      const latest = join(outDir, branch, 'latest');
      mkdirSync(latest, { recursive: true });
      cpSync(join(outDir, branch, String(builds[0].ordinal), 'index.html'), join(latest, 'index.html'));
      cpSync(join(outDir, branch, String(builds[0].ordinal), 'build.json'), join(latest, 'build.json'));
    }
    mkdirSync(join(outDir, branch), { recursive: true });
    const idx = branchIndex(branch, builds, head, generatedAt);
    writeFileSync(join(outDir, branch, 'index.html'), idx);
    for (const b of builds) if (!idx.includes(`href="../${branch}/${b.ordinal}/"`)) throw new Error(`${branch} index does not link build ${b.ordinal}`);
    checks++;
    branchData.push({ branch, head, builds });
  }
  const root = rootIndex(branchData, generatedAt);
  writeFileSync(join(outDir, 'index.html'), root);
  for (const d of branchData) for (const b of d.builds) if (!root.includes(`href="${d.branch}/${b.ordinal}/"`)) throw new Error(`root index does not link ${d.branch}/${b.ordinal}`);
  checks++;
  writeFileSync(join(outDir, 'builds.json'), JSON.stringify({ generatedAt, keep, branches: branchData.map((d) => ({ branch: d.branch, head: d.head, builds: d.builds.map((b) => ({ ...b, stamp: stampOf(b), changelog: changelogUrl(b) })) })) }, null, 2) + '\n');
  return { checks, branchData };
}

function check(outDir) {
  const manifest = JSON.parse(readFileSync(join(outDir, 'builds.json'), 'utf8'));
  let checks = 0;
  for (const d of manifest.branches) for (const b of d.builds) {
    const blob = gitBuf(['show', `${b.sha}:AshenSpire.html`]);
    const onDisk = readFileSync(join(outDir, d.branch, String(b.ordinal), 'index.html'));
    if (Buffer.compare(blob, onDisk) !== 0) { console.error(`DRIFT ${d.branch}/${b.ordinal}: site file differs from git blob ${b.sha.slice(0, 10)}`); process.exitCode = 1; }
    else checks++;
  }
  return checks;
}

function boundary() {
  console.log(`BOUNDARY: this proves each served build is byte-identical to the commit it names and that every index links every build it lists. It does not run any build, does not prove a build boots, and lists only the newest ${KEEP} builds per branch — older ordinals are in git, not on this site.`);
}

try {
  if (has('--selftest')) {
    const dir = mkdtempSync(join(tmpdir(), 'pages-site-selftest-'));
    const { checks, branchData } = assemble(dir, 1);
    // Plant: corrupt one served build and prove --check goes red for it by name.
    const victim = branchData.find((d) => d.builds[0]);
    if (!victim) throw new Error('selftest needs at least one branch with a build');
    const f = join(dir, victim.branch, String(victim.builds[0].ordinal), 'index.html');
    writeFileSync(f, Buffer.concat([readFileSync(f), Buffer.from('\n<!-- planted -->\n')]));
    const pages = branchData.reduce((n, d) => n + d.builds.length, 0);
    const before = process.exitCode;
    const ok = check(dir);
    const caught = process.exitCode === 1 && ok === pages - 1; // every build page but the planted one still matches
    process.exitCode = before || 0;
    void checks;
    rmSync(dir, { recursive: true, force: true });
    if (!caught) { console.error(`MISS planted drift on ${victim.branch}/${victim.builds[0].ordinal} was not caught`); process.exitCode = 1; }
    else console.log(`CAUGHT planted drift on ${victim.branch}/${victim.builds[0].ordinal}`);
    if (!process.exitCode) console.log(`pages-site selftest: OK — 1 known-bads, 1 caught`);
  } else if (has('--check')) {
    const n = check(flag('--check', '_site'));
    if (!process.exitCode) console.log(`pages-site --check: OK — ${n} checks passed`);
  } else {
    const outDir = resolve(ROOT, flag('--out', '_site'));
    const { checks, branchData } = assemble(outDir, KEEP);
    for (const d of branchData) console.log(`  ${d.branch}: ${d.builds.length} build(s), latest ${d.builds[0] ? stampOf(d.builds[0]) : 'none'}`);
    console.log(`pages-site: OK — ${checks} checks passed`);
  }
  boundary();
} catch (error) {
  boundary();
  console.error(`pages-site: FAILED — ${error.message}`);
  process.exitCode = 1;
}
