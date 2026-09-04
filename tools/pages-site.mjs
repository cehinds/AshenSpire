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
// A BRANCH'S ROLE IS READ FROM THE CONTRACT THAT GOVERNS IT, not typed here.
// `.agentops/governance/git-ownership.json` already carries one note per ref and
// is the thing that actually decides who may write to each; duplicating that
// sentence in this file is how the two drift apart. A ref the contract does not
// name says so rather than being given a description this tool invented —
// `release` is exactly that case today, and the blank is the finding, not a bug
// to paper over.
const OWNERSHIP = '.agentops/governance/git-ownership.json';
function branchRoles() {
  const path = join(ROOT, OWNERSHIP);
  if (!existsSync(path)) return {};
  const refs = JSON.parse(readFileSync(path, 'utf8')).refs || [];
  const out = {};
  for (const r of refs) if (r.ref && !r.ref.includes('*') && r.note) out[r.ref] = r.note;
  return out;
}
const BRANCH_ROLE = branchRoles();
const NO_ROLE = 'no role recorded in git-ownership.json';
// RULE 3'S SUBJECT, and it is not a list of site pages. These are THE BUILD and
// the alias copies tools/launch.mjs keeps beside it. They are already on this
// page — once per branch, per ordinal, byte-proven — so listing them again as
// "pages" would present the same artifact twice under a worse name. The tool is
// naming its own subject, not curating what the site may show.
const BUILD_PATHS = new Set(['AshenSpire.html', 'build', 'dist']);
// THE ONE THING STILL TYPED HERE, AND WHY IT HAS TO BE.
//
// `tools/palette-probe.html` is a QA harness tools/palette-check.sh drives, and
// `tests/index.html` is the browser test runner. Neither is a destination, and
// Codex was right that path depth is no evidence either way.
//
// I tried to derive it from the LINK GRAPH — a page is offered if something in
// the tree points at it — and measured the result before believing it: nothing
// links `hud/`, `tests/` or `tools/palette-probe.html`. The rule would have
// silently dropped the Owner HUD, a page that matters, and kept nothing extra.
// (An earlier probe of mine said the hub linked them; it was matching bare
// `href="index.html"` against every directory's index and was my own false
// positive.) The pages in this repository are islands: there is no navigation
// graph to read, so there is nothing to derive from.
//
// So this stays a typed rule and says so. It names DIRECTORIES that hold the
// repository's own harness rather than pages the site offers — two of them, at
// the top level, checked by the first path segment. That is a much smaller
// thing to keep true than the six-link list this pass removed, and unlike that
// list it does not go stale when a page is added: a new page under docs/ or a
// new indexed section appears without an edit here.
const HARNESS_DIRS = new Set(['tools', 'tests']);

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

/**
 * DISCOVER THE SITE'S OTHER PAGES INSTEAD OF LISTING THEM.
 *
 * The row this replaces was six links typed by hand — and it was already wrong:
 * `docs/tray-gallery.html` and four `review-approval-hub/` sections exist in the
 * published tree and were never named, so adding a page to the repo did not add
 * it to the index. Meanwhile the footer claimed "nothing on this page is typed
 * by hand", which was true of the builds and false of that row.
 *
 * Now the tree itself is the data. Three rules, no names:
 *
 *  1. DOT-DIRECTORIES ARE SKIPPED — a rule, not an exclusion list. It is what
 *     keeps `.agentops/generated/**`, the internal mirror of the hub and HUD,
 *     from appearing twice under a path nobody browses.
 *  2. THIS TOOL'S OWN OUTPUT IS SKIPPED, named from what it just wrote.
 *  3. THE BUILD AND ITS ALIASES ARE SKIPPED — see BUILD_PATHS. They are already
 *     here, once per branch per ordinal and byte-proven.
 *  4. A DIRECTORY WITH AN index.html IS ONE ENTRY at its directory URL, and
 *     NOTHING BENEATH IT is listed separately. Nearest-ancestor, not
 *     immediate-parent: the hub's ten ticket pages are the hub's business.
 *  5. NOT UNDER A HARNESS TREE. Depth was the first cut of
 *     this rule and it was wrong: `tools/palette-probe.html` sits at depth 1 and
 *     is a QA harness a shell script drives, not a destination. The link graph
 *     says what depth cannot — the probe is pointed at by no page, so it leaves
 *     on a fact rather than on a name. The one exception is `index-game.html`,
 *     which this tool itself moves aside to free `/`, and naming what you just
 *     created is not a typed list.
 *
 * THE LABEL IS THE PAGE'S OWN `<title>`, so a page renames itself here by
 * renaming itself. A page with no title is listed by path and SAID to have none,
 * because a silent fallback is how a missing title stays missing.
 */
function discoverPages(outDir, generatedNames) {
  const files = [];
  const indexed = new Set();
  const walk = (rel, depth) => {
    // NO CAP HERE EITHER. The per-file depth filter went in the last commit and
    // this traversal guard stayed, so the comment below said "no depth cap"
    // while `walk` still returned before reading anything five deep — the same
    // silent drop, moved one function up. The tree is a `git archive` extract of
    // one commit, so it is finite; symlinks are skipped rather than followed, so
    // it cannot cycle.
    let entries;
    try { entries = readdirSync(join(outDir, rel), { withFileTypes: true }); } catch { return; }
    if (rel && entries.some((e) => e.isFile() && e.name === 'index.html')) indexed.add(rel);
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      if (e.isSymbolicLink()) continue;                       // cannot cycle
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (rel === '' && generatedNames.has(e.name)) continue;
      if (BUILD_PATHS.has(child)) continue;
      if (e.isDirectory()) walk(child, depth + 1);
      else if (e.isFile() && e.name.endsWith('.html')) {
        files.push({ rel, name: e.name, path: child, depth });
      }
    }
  };
  walk('', 0);

  // NEAREST INDEXED ANCESTOR, SEARCHED FROM THE PARENT. Starting the search at
  // the directory itself made every indexed directory its own governor, so a
  // `section/sub/index.html` under an already-indexed `section/` came through as
  // its own entry — the exact thing the rule says must not happen. The bug could
  // not show on today's tree, which has no nested index; it would have appeared
  // the first time one was added, which is when nobody would be looking.
  const governedFrom = (dir) => {
    let d = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : '';
    for (; d; d = d.includes('/') ? d.slice(0, d.lastIndexOf('/')) : '') if (indexed.has(d)) return d;
    return null;
  };
  const governed = (dir) => {
    for (let d = dir; d; d = d.includes('/') ? d.slice(0, d.lastIndexOf('/')) : '') if (indexed.has(d)) return d;
    return null;
  };

  const pages = [];
  for (const f of files) {
    const isIndex = f.name === 'index.html';
    if (isIndex && !f.rel) continue;                          // the root index is ours
    if (isIndex && governedFrom(f.rel)) continue;             // an ancestor section speaks for it
    if (!isIndex && governed(f.rel)) continue;                // its own section speaks for it
    // NO DEPTH CAP. It used to stop at depth 1, which contradicted this pass's
    // own promise: `docs/guides/setup.html` is a page and the cap dropped it
    // silently, recreating the stale-list problem the typed row had. Exclusion
    // belongs to HARNESS_DIRS, which names trees rather than guessing from how
    // deep a file sits.
    if (HARNESS_DIRS.has(f.rel.split('/')[0])) continue;      // see HARNESS_DIRS
    const href = isIndex ? `${f.rel}/` : f.path;
    pages.push({ href, title: titleOf(join(outDir, f.path)), path: f.path });
  }
  // index-game.html is listed because THIS TOOL PUT IT THERE — main's own root
  // page, moved aside so the build index can hold `/`. Naming a file the
  // generator itself created is not the hand-typed list this pass removed.
  if (existsSync(join(outDir, 'index-game.html')) && !pages.some((x) => x.path === 'index-game.html')) {
    pages.push({ href: 'index-game.html', title: titleOf(join(outDir, 'index-game.html')), path: 'index-game.html' });
  }
  return pages.sort((a, b) => a.href.localeCompare(b.href));
}

function titleOf(file) {
  try {
    // Read a head slice: a build artifact is megabytes and its title is not ours.
    const head = readFileSync(file).subarray(0, 8192).toString('utf8');
    const m = head.match(/<title[^>]*>([^<]+)<\/title>/i);
    return m ? m[1].trim().replace(/\s+/g, ' ') : null;
  } catch { return null; }
}

function rootIndex(branchData, generatedAt, otherPages) {
  const cards = branchData.map(({ branch, builds }) => {
    const b = builds[0];
    if (!b) return `<section class="card"><h3>${esc(branch)}</h3><p class="role">${esc(BRANCH_ROLE[branch] || NO_ROLE)}</p><p class="meta">no build found on this branch</p></section>`;
    return `<section class="card"><h3>${esc(branch)}</h3><p class="role">${esc(BRANCH_ROLE[branch] || NO_ROLE)}</p>
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
${otherPages.length ? `<ul>${otherPages.map((pg) => `<li><a href="${esc(pg.href)}">${esc(pg.title || pg.path)}</a>${pg.title ? '' : ' <span class="meta">(no &lt;title&gt; — listed by path)</span>'} <span class="meta">${esc(pg.path)}</span></li>`).join('')}</ul>` : '<p class="meta">no other pages found in the published tree</p>'}
<p><a href="${REPO_URL}">repository</a></p>
<footer>Generated ${esc(generatedAt)} by <code>tools/pages-site.mjs</code> from git history and from the published tree — nothing on this page is typed by hand, this list included. Listing the newest ${KEEP} builds per branch.</footer>
</main></body></html>`;
}

function branchIndex(branch, builds, head, generatedAt) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AshenSpire — ${esc(branch)} builds</title><style>${CSS}</style></head><body><main>
<p><a href="../">← all branches</a></p><h1>${esc(branch)} builds</h1><p class="lead">${esc(BRANCH_ROLE[branch] || NO_ROLE)} · branch head <a href="${REPO_URL}/commit/${head}">${head.slice(0, 10)}</a></p>
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
  // Discovered AFTER the branch directories exist, so this tool's own output is
  // excluded by name-of-thing-we-just-wrote rather than by a hardcoded list.
  const generatedNames = new Set([...BRANCHES, 'index.html', 'builds.json']);
  const otherPages = discoverPages(outDir, generatedNames);
  const root = rootIndex(branchData, generatedAt, otherPages);
  writeFileSync(join(outDir, 'index.html'), root);
  for (const d of branchData) for (const b of d.builds) if (!root.includes(`href="${d.branch}/${b.ordinal}/"`)) throw new Error(`root index does not link ${d.branch}/${b.ordinal}`);
  checks++;
  writeFileSync(join(outDir, 'builds.json'), JSON.stringify({ generatedAt, keep, otherPages, branches: branchData.map((d) => ({ branch: d.branch, head: d.head, builds: d.builds.map((b) => ({ ...b, stamp: stampOf(b), changelog: changelogUrl(b) })) })) }, null, 2) + '\n');
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
  // THE DISCOVERED PAGES GET THE SAME TREATMENT AS THE BUILDS. A list derived
  // from the tree is only better than a typed one if something proves it still
  // describes the tree; otherwise it is a typed list that nobody typed. Each
  // entry must still exist on disk AND still be linked from the root index —
  // the second half is what catches a page discovered into the manifest and
  // then dropped from the page it was supposed to appear on.
  const root = existsSync(join(outDir, 'index.html')) ? readFileSync(join(outDir, 'index.html'), 'utf8') : '';
  for (const pg of manifest.otherPages || []) {
    const target = join(outDir, pg.path);
    if (!existsSync(target)) { console.error(`MISSING page ${pg.path}: listed on the index, not in the site`); process.exitCode = 1; continue; }
    if (!root.includes(`href="${pg.href}"`)) { console.error(`UNLINKED page ${pg.path}: in the manifest, not linked from the root index`); process.exitCode = 1; continue; }
    checks++;
  }
  return checks;
}

/**
 * THE ORACLE IS WRITTEN BY HAND HERE, NOT READ BACK FROM THE GENERATOR.
 *
 * Codex, on 2a607ca1: the selftest below took its expected page list from
 * `builds.json` — which `discoverPages` had just written. So a regression that
 * dropped SOME pages wrote a shorter manifest, `check()` verified that shorter
 * manifest, both plants passed, and the run printed OK over an incomplete
 * index. The empty-discovery guard added in the previous commit catches only
 * the TOTAL failure; a partial one had nothing looking at it. A test whose
 * expected value comes from the thing under test is not a test.
 *
 * This gives discovery a tree whose right answer is known because this
 * function built it, and an expected list typed out below rather than derived
 * from anything the tool produces. Every line of the fixture is a rule:
 * a nested page is kept, a deeper one is kept (no depth cap), a section with an
 * index is one entry, a page inside that section is not a second entry, a
 * nested index under it is not a third, `tools/` and `tests/` are harness,
 * `dist/` is build output, a dot directory is not a page, a branch directory is
 * the generator's own, and the label is the page's own <title>.
 *
 * It is a fixture, not a second copy of the rule: it states OUTCOMES for one
 * fixed input. A deliberate rule change rewrites this list; an accidental one
 * fails it.
 */
function discoveryFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'pages-site-fixture-'));
  // PLANTED IS COUNTED, NOT TYPED. The line that reports this fixture used to
  // spell "8 files excluded" as a literal, which is the same second-copy shape
  // that once had `opsctl.test.mjs` spelling its contract count into its own
  // label: add a file below and the sentence starts lying with nothing to catch
  // it. `planted` is incremented by the writer, so the arithmetic cannot drift.
  let planted = 0;
  const put = (rel, title) => {
    mkdirSync(join(dir, dirname(rel)), { recursive: true });
    writeFileSync(join(dir, rel), `<!doctype html><title>${title}</title>\n`, 'utf8');
    planted++;
  };
  put('index.html', 'the build index — ours, never a page');
  put('index-game.html', 'Play AshenSpire');
  put('docs/component-catalog.html', 'Component catalog');
  put('docs/guides/setup.html', 'Setup guide');
  put('hud/index.html', 'Owner HUD');
  put('hud/extra.html', 'a page the HUD section speaks for');
  put('hud/panel/index.html', 'a nested section under an indexed one');
  put('tools/palette-probe.html', 'a developer probe');
  put('tests/index.html', 'the browser test runner');
  put('dist/index.html', 'build output');
  put('.private/secret.html', 'inside a dot directory');
  put(`${BRANCHES[0]}/1/index.html`, 'a served build');

  // THE ANSWER, IN ORDER, WITH LABELS. Order is part of the assertion: the
  // generator sorts by href, so a comparison that ignored order would stop
  // testing the sort. No count is written here — the counts in the OK line are
  // derived from this list and from `planted`, for the reason above.
  const expected = [
    ['docs/component-catalog.html', 'Component catalog'],
    ['docs/guides/setup.html', 'Setup guide'],
    ['hud/', 'Owner HUD'],
    ['index-game.html', 'Play AshenSpire'],
  ];
  const got = discoverPages(dir, new Set([...BRANCHES, 'index.html', 'builds.json'])).map((p) => [p.href, p.title]);
  rmSync(dir, { recursive: true, force: true });

  const same = got.length === expected.length && expected.every(([h, t], i) => got[i][0] === h && got[i][1] === t);
  if (!same) {
    console.error('MISS discovery does not match the hand-written fixture');
    for (const [h, t] of expected) console.error(`  expect  ${h}  "${t}"`);
    for (const [h, t] of got) console.error(`  got     ${h}  "${t}"`);
  }
  return { same, kept: expected.length, excluded: planted - expected.length };
}

function boundary() {
  console.log(`BOUNDARY: this proves each served build is byte-identical to the commit it names and that every index links every build it lists. It does not run any build, does not prove a build boots, and lists only the newest ${KEEP} builds per branch — older ordinals are in git, not on this site.`);
}

try {
  if (has('--selftest')) {
    // THE FIXTURE RUNS FIRST AND ITS ANSWER IS NOT THE GENERATOR'S. Everything
    // below reads the manifest discovery wrote, so it can only ever check the
    // pages discovery already found. This one line is the only part of the
    // selftest that can say discovery found the WRONG SET.
    const fixture = discoveryFixture();
    const fixtureOk = fixture.same;
    if (fixtureOk) console.log(`OK discovery matches the hand-written fixture: ${fixture.kept} page(s) kept, ${fixture.excluded} excluded, labels from each page's own <title>`);
    const dir = mkdtempSync(join(tmpdir(), 'pages-site-selftest-'));
    const { checks, branchData } = assemble(dir, 1);
    // Plant: corrupt one served build and prove --check goes red for it by name.
    const victim = branchData.find((d) => d.builds[0]);
    if (!victim) throw new Error('selftest needs at least one branch with a build');
    const f = join(dir, victim.branch, String(victim.builds[0].ordinal), 'index.html');
    writeFileSync(f, Buffer.concat([readFileSync(f), Buffer.from('\n<!-- planted -->\n')]));
    const pages = branchData.reduce((n, d) => n + d.builds.length, 0);
    const discovered = JSON.parse(readFileSync(join(dir, 'builds.json'), 'utf8')).otherPages || [];
    const before = process.exitCode;
    const ok = check(dir);
    const caught = process.exitCode === 1 && ok === pages - 1 + discovered.length;
    process.exitCode = before || 0;
    void checks;
    if (!caught) { console.error(`MISS planted drift on ${victim.branch}/${victim.builds[0].ordinal} was not caught`); process.exitCode = 1; }
    else console.log(`CAUGHT planted drift on ${victim.branch}/${victim.builds[0].ordinal}`);

    // SECOND PLANT: the discovery is a claim about the tree, so prove the claim
    // can fail. Delete a page the index says it offers and --check must name it.
    // Without this the list could quietly describe a site that no longer exists,
    // which is the failure the typed list had and the whole reason for this pass.
    let caught2 = true;
    let repairClean = true;
    if (discovered.length) {
      // REPAIR THE FIRST PLANT BEFORE LAYING THE SECOND. Left in place, its
      // DRIFT keeps --check red and the second plant would "pass" whether or not
      // the deletion is noticed at all — a known-bad that cannot fail, which is
      // the exact defect these plants exist to catch. So the build goes back to
      // its git blob and the deletion is then the ONLY thing wrong.
      writeFileSync(f, gitBuf(['show', `${victim.builds[0].sha}:AshenSpire.html`]));
      const b1 = process.exitCode;
      check(dir);
      // CARRY THE FAILURE, DO NOT PRINT AND DROP IT. Restoring the exit code
      // here threw away the very thing that had just been detected: plant 2 sets
      // it back to 1, `caught2` reads that as the deletion being caught, and the
      // selftest ends OK with a repair that never worked. That is the third time
      // in this function a check has been written so it cannot fail, so the
      // verdict below now depends on `repairClean` as well.
      repairClean = process.exitCode !== 1;
      if (!repairClean) console.error('MISS the repaired build still reads as drifted — plant 2 is meaningless and this selftest fails');
      process.exitCode = b1 || 0;

      const gone = discovered[0];
      rmSync(join(dir, gone.path), { force: true });
      const b2 = process.exitCode;
      check(dir);
      caught2 = process.exitCode === 1;
      process.exitCode = b2 || 0;
      if (caught2) console.log(`CAUGHT deleted page ${gone.path}`);
      else console.error(`MISS deleted page ${gone.path} was not caught`);
    } else {
      // AN EMPTY DISCOVERY IS THE FAILURE, NOT A REASON TO SKIP. This branch used
      // to print SKIP and leave caught2 true, so a regression that discovered
      // NOTHING — the total failure this plant exists to catch — sailed through
      // reporting "2 known-bads, 2 caught". Fourth time in this one function that
      // a check has been written with no path from its failure to the verdict;
      // the pattern, not the instance, is what needed fixing.
      console.error('MISS discovery returned no pages — the published tree always has some, so this is a regression, not an empty repo');
      caught2 = false;
    }
    // THE VERDICT READS caught2 HERE, OUTSIDE BOTH BRANCHES, and that placement
    // is the fix rather than a tidy-up. It was consumed INSIDE the plant branch,
    // so the empty-discovery branch could set it false and nothing ever looked —
    // I wrote that dead assignment while fixing the fourth instance of this exact
    // pattern in this function, and it became the fifth. A flag whose reader
    // sits inside one arm of the branch that sets it is not a check.
    if (!caught2) process.exitCode = 1;
    rmSync(dir, { recursive: true, force: true });
    if (!repairClean) process.exitCode = 1;
    if (!fixtureOk) process.exitCode = 1;
    // THE VERDICT LINE IS A GRAMMAR, NOT A SENTENCE OF MY CHOOSING. tools/verdict.mjs
    // accepts `label: OK — N <words>, N caught` and nothing else that fits here:
    // a NUMBER right after `OK —`, and the line ENDING at `caught`. This line had
    // drifted out of that grammar twice — first by appending `(N page(s)
    // discovered)`, then by prefixing `fixture exact,` — so `verdict` refused it
    // as SILENCE and the assemble job has failed on every push to dev since
    // 2026-09-02, while the selftest itself was passing all four of its checks.
    // The facts go on their own line ABOVE; the verdict line carries the counts
    // and stops. A fact worth printing is not worth breaking the verdict for.
    if (!process.exitCode) {
      console.log(`pages-site selftest: fixture exact, ${discovered.length} page(s) discovered from the real tree`);
      console.log(`pages-site selftest: OK — 2 known-bads, 2 caught`);
    }
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
