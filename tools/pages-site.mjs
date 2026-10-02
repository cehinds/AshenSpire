#!/usr/bin/env node
// tools/pages-site.mjs — assemble the GitHub Pages site that lists EVERY branch's
// builds and serves each one at its own address.
//
//   https://cehinds.github.io/AshenSpire/                 the build index (all branches)
//   https://cehinds.github.io/AshenSpire/dev/             that branch's build list, newest first
//   https://cehinds.github.io/AshenSpire/main/1688/       the main build with ordinal 1688, playable
//   https://cehinds.github.io/AshenSpire/dev/latest/      alias for the newest dev build
//   … and the same for test/, release/, main/.
//
// WHAT IT READS. Nothing is typed here. Every build comes out of git: for each
// branch, the first-parent commits that touched buildordinal.json name the
// builds; each commit's buildordinal.json gives ordinal, digest and date; that
// commit's AshenSpire.html IS the build, copied byte-for-byte (the check below
// proves it). A build commit that no longer carries its HTML (dev since #1332)
// is rebuilt from that commit's source under --build-missing; see BUILD_MISSING. The version triple is read out of the copied bundle itself
// (`version: '…'` in src/content/index.js), so a bump shows up here without an
// edit. The changelog link points at CHANGELOG.md AT THAT COMMIT, not at a
// moving branch head, so a build's changelog stays the one it shipped with.
//
// WHAT ELSE IS SERVED. `main`'s tree is copied first, so every page the site
// serves from it (/index-game.html, /docs/component-catalog.html,
// /docs/preview/…, /pose-studio/, /items-preview.html) keeps working — less the media and authoring roots and the committed build HTML
// (BASE_TREE_PATHSPECS, docs/EXTERNAL-ASSETS-PLAN.md step 6a). The stable Play
// links and the score and tiles they read beside themselves are written back
// explicitly as that build's payload. The one deliberate replacement is the
// root index.html: it is the build index now; main's own root page is kept at
// /index-game.html.
//
// USAGE
//   node tools/pages-site.mjs --out _site [--keep 12] [--branches dev,test,release,main] [--remote origin]
//                             [--main-build <dir>] [--build-missing <workdir>]
//   node tools/pages-site.mjs --check _site        re-verify an assembled site against git
//   node tools/pages-site.mjs --selftest           generate into a temp dir with --keep 1 and verify
//
// VERDICT (tools/verdict.mjs form): "pages-site: OK — N checks passed", where a
// check is one build page proven byte-identical to its git blob (or, for a build
// no longer committed, to the rebuild made from its commit), plus one per
// index page proven to link every build it lists.
import { readGitArtifact } from './git-artifact.mjs';
import { OG_IMAGE } from './og-image.mjs';
import { folderZipBytes, zipFolderName } from '../src/model/offlineDownload.js';
import { ASSET_BASE_FILE, packPinOf, packPages, publishPack, serviceWorkerFindings, storeFindings, writeServiceWorker } from './pages-store.mjs';
import { SW_FILE, SW_KILL, SW_VERSION, serviceWorkerSource } from './pages-sw.mjs';
import { objectPath } from './asset-pack.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync, readdirSync, statSync, mkdtempSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_URL = 'https://github.com/cehinds/AshenSpire';
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt; };
const has = (name) => argv.includes(name);

const REMOTE = flag('--remote', 'origin');
const BRANCHES = flag('--branches', 'dev,test,release,main').split(',').map((s) => s.trim()).filter(Boolean);
// Clamped: each listed build that is no longer committed costs a rebuild, so a
// dispatch typo must not turn one run into hundreds of them.
const KEEP_MAX = 25;
const KEEP = Math.min(KEEP_MAX, Math.max(1, Number(flag('--keep', '10')) || 10));
// A directory holding AshenSpire.html and AshenSpire-mobile.html built by CI from
// main's source. Needed once main no longer commits its build (the Git LFS budget
// ran out, 2026-09-26): without it the stable Play links at the site root 404.
const MAIN_BUILD = flag('--main-build', null);
// THE SERVICE WORKER'S KILL-SWITCH (tools/pages-sw.mjs SW_KILL, committed).
// `--sw-kill` writes it for one run, for a local test; the published switch is
// the committed constant, because every push to dev republishes the site.
const SW_KILL_RUN = SW_KILL || has('--sw-kill');
// THE PACK SHAPE (docs/EXTERNAL-ASSETS-PLAN.md §4, step 6b). A build whose
// tree carries a pack-shaped web edition (bundle.mjs --external-art, step 3a
// on) is published as that edition: its HTML at /<branch>/<ordinal>/, its
// indexes and objects in the one store at the site root (/packs/, /objects/),
// an asset-base.json beside it, and its light single file whole at
// /<branch>/<ordinal>/download/AshenSpire.html, which every Download link and
// offlineDownload.js name. Older builds (inline single files, the mobile/
// folder) keep their shape until they age out of --keep.
const WEB_DIR = 'web';
const DOWNLOAD_PATH = 'download/AshenSpire.html';
// BUILDS THAT ARE NO LONGER COMMITTED ARE REBUILT FROM THEIR COMMIT'S SOURCE.
//
// Since 2026-09-26 (#1332) dev commits no built HTML; test, release and main
// follow as they are promoted. A build commit still writes buildordinal.json,
// so git still NAMES every build — it just no longer holds the file. With
// `--build-missing <workdir>`, each such build newer than the branch's last
// committed one is rebuilt here: one reusable sparse worktree (art/ left out;
// the bundle never reads it), `node tools/launch.mjs --build-only` at that
// commit, in the art tier CI gives the branch (light on dev/test, --full-art on
// release/main, as dev-preview.yml does). A rebuild that leaves the worktree
// dirty moved the committed box: it is not the build that commit names, so it
// is skipped and said to be, never published.
//
// Why rebuild rather than download each commit's dev-preview artifact: it
// needs no Actions token, cannot race the dev-preview run of the same push,
// and does not expire after 14 days. It costs about 20 s per light build.
let BUILD_MISSING = flag('--build-missing', null);
// THE HEAD'S OWN BUILD MUST SERVE on these branches (review of #1360). A skipped
// OLDER build is a named warning; a head build that fails to rebuild would
// leave the branch with no /latest/ while the run stays green, and Pages
// replaces the whole site, so the published alias would silently vanish.
// test is listed with dev: both rebuild on the same light path (Codex, #1360).
// release/main are not listed: their --full-art rebuilds wait on the art fetch
// (docs/ART-REPO-PLAN.md step 4), and a failure there must not take down dev's
// publication.
const HEAD_REQUIRED = new Set(flag('--require-head', 'dev,test').split(',').map((x) => x.trim()).filter(Boolean));
const FULL_ART_BRANCHES = new Set(['release', 'main']);
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
const BUILD_PATHS = new Set(['AshenSpire.html', 'AshenSpire-mobile.html', 'build', 'dist']);
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
// MAIN'S BASE TREE LEAVES OUT ITS MEDIA AND AUTHORING ROOTS AND ITS COMMITTED
// BUILD HTML (docs/EXTERNAL-ASSETS-PLAN.md, section 4 "Main's base tree, and the
// site's size", step 6a), except assets/ (owner, 2026-10-02: kept). Measured on
// origin/main, art/ and the build copies were about 770 MB of a site already
// far over the documented 1 GB Pages limit, and no build page reads them, or
// the other excluded roots, from the root:
//   - every build at /<branch>/<ordinal>/ is one inline file that reads only the
//     map-detail/ and music/ written beside it below;
//   - the stable Play links (/AshenSpire.html, /build/, /dist/, -mobile) are the
//     same inline file: every image under assets/ is in its ASSET_MAP, and the
//     only folders it fetches beside itself are map-detail/ and music/. Those
//     two are written back from main's tree as that build's payload
//     (STABLE_PAYLOAD_DIRS), so the stable links serve what they served before.
// assets/ STAYS (owner, 2026-10-02): /index-game.html (main's source page),
// docs/component-catalog.html, items-preview.html, docs/low-poly-fighters/ and
// pose-studio/ load their images from it. art/ GOES: its seven review sections
// leave the site and, because discovery reads the assembled tree, the index
// with them. Plain links into art/ now 404: docs/component-catalog.html,
// pose-studio/, and docs/low-poly-fighters/index.html:38 (`../../art/poses/`).
// docs/preview stays (owner answer 7).
// Pathspecs are from the repository root: `map-detail` is the top-level folder.
const BASE_TREE_EXCLUDED_DIRS = Object.freeze(['art', 'assets-mobile', 'map-detail', 'music']);
// Kept on purpose, and checked by the selftest so a later edit cannot drop it unseen.
const BASE_TREE_KEPT_DIRS = Object.freeze(['assets', 'docs/preview']);
const BASE_TREE_EXCLUDED_HTML = Object.freeze(['AshenSpire*.html', 'build/**/*.html', 'dist/**/*.html']);
const BASE_TREE_PATHSPECS = Object.freeze(['.',
  ...BASE_TREE_EXCLUDED_DIRS.map((d) => `:(exclude)${d}`),
  ...BASE_TREE_EXCLUDED_HTML.map((g) => `:(exclude,glob)${g}`)]);
// The stable build's own payload: the folders it fetches from beside itself
// (mapDetail.js resolves map-detail/ against document.baseURI; content/music.js
// SHIPPED_MUSIC_FOLDER is music/). Written from main's tree, as before.
const STABLE_PAYLOAD_DIRS = Object.freeze(['map-detail', 'music']);
// The stable Play links and their build/ and dist/ aliases.
const STABLE_LINKS = Object.freeze(['AshenSpire.html', 'AshenSpire-mobile.html']);
const STABLE_ALIASES = Object.freeze(['build', 'dist']);

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
}
// `git show <rev>:<path>` for a file the commit may not have. Only a missing
// path is expected (main's 84895c14 deleted buildordinal.json, and older
// commits predate it); any other git failure is re-thrown, not swallowed.
function showIfPresent(rev, path) {
  try { return git(['show', `${rev}:${path}`], { stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (error) {
    if (/exists on disk, but not in|does not exist in/.test(String(error.stderr || ''))) return null;
    throw error;
  }
}
function gitBuf(args) {
  return execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 28 });
}
function refFor(branch) {
  // Prefer the remote-tracking ref (CI fetches all four); fall back to a local branch.
  for (const r of [`${REMOTE}/${branch}`, branch]) {
    try { git(['rev-parse', '--verify', '--quiet', `${r}^{commit}`]); return r; } catch { /* next */ }
  }
  return null;
}

// A BRANCH THAT IS NOT THERE IS A FACT TO REPORT, NOT A CRASH — and not a
// silence either. `refFor` used to throw, so one deleted branch took the whole
// site down (2026-09-04: `test` was auto-deleted as the merged head of the
// test → release promotion, and this job then failed on dev, release and main).
// Now the branch is skipped, its name is collected here, and the summary line
// prints it. Publishing three of four branches while saying so is a service;
// publishing three and claiming four is the defect this file is built against.
const missingBranches = [];
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/** Every distinct build on a branch, newest first: [{ordinal, digest, built, sha, date, version}] */
function buildsOf(branch, keep) {
  const ref = refFor(branch);
  if (!ref) { if (!missingBranches.includes(branch)) missingBranches.push(branch); return { head: null, builds: [] }; }
  const log = git(['log', '--first-parent', '--format=%H%x09%cI', ref, '--', 'buildordinal.json']).trim();
  const seen = new Set();
  const out = [];
  let committedSeen = false;
  for (const line of log ? log.split('\n') : []) {
    const [sha, date] = line.split('\t');
    let meta;
    // `git log -- buildordinal.json` also lists the commit that DELETED it
    // (main's 84895c14); showIfPresent returns null for it.
    const raw = showIfPresent(sha, 'buildordinal.json');
    if (raw === null) continue;
    try { meta = JSON.parse(raw); } catch { continue; }
    const ordinal = Number(meta.ordinal);
    if (!Number.isInteger(ordinal) || seen.has(ordinal)) continue;
    // A committed build is the artifact at that commit. A commit with no
    // artifact is a build only when it is NEWER than the branch's last
    // committed one (the branch stopped committing its build) and this run
    // may rebuild it; older gaps are commits that never shipped a build.
    let committed = true;
    try { git(['cat-file', '-e', `${sha}:AshenSpire.html`], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { committed = false; }
    if (!committed && (committedSeen || !BUILD_MISSING)) continue;
    if (committed) committedSeen = true;
    seen.add(ordinal);
    out.push({ branch, ordinal, digest: String(meta.digest || ''), built: String(meta.built || date.slice(0, 10)), sha, date, source: committed ? 'git' : 'rebuild' });
    if (out.length >= keep) break;
  }
  // SINCE 2026-09-26 dev DOES NOT COMMIT ITS BUILD (the Git LFS budget ran out),
  // so its newest builds are not in git and cannot be listed from it. A branch
  // whose head tracks no AshenSpire.html says so on every page rather than
  // presenting its last committed build as its latest.
  let headTracksBuild = true;
  try { git(['cat-file', '-e', `${ref}:AshenSpire.html`], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { headTracksBuild = false; }
  let headOrdinal = null;
  const headBox = showIfPresent(ref, 'buildordinal.json');
  try { if (headBox !== null) headOrdinal = Number(JSON.parse(headBox).ordinal); } catch { /* unreadable box at head */ }
  return { ref, head: git(['rev-parse', ref]).trim(), builds: out, headTracksBuild, headOrdinal };
}

// Builds skipped this run, each with its reason — printed above the verdict and
// on the branch's page, so a gap in the list is explained rather than silent.
const skippedBuilds = [];
function skip(b, reason) {
  skippedBuilds.push({ branch: b.branch, ordinal: b.ordinal, sha: b.sha, reason });
  if (process.env.GITHUB_ACTIONS) console.log(`::warning title=pages-site skipped ${b.branch}/${b.ordinal}::${reason}`);
}

/**
 * A committed artifact, or null when its bytes can no longer be fetched (the
 * LFS objects of old builds are due to be purged — docs/ART-REPO-PLAN.md step
 * 7). A pointer whose content does not match is still fatal: that is
 * corruption, not absence.
 */
// Selftest only: every listed committed build reads as purged (a 404), the
// state docs/ART-REPO-PLAN.md step 7 leaves behind.
let SIMULATE_PURGE = false;
function committedArtifact(sha, path) {
  if (SIMULATE_PURGE) return purgedOrThrow(Object.assign(new Error('simulated purge'), { stderr: 'Object does not exist on the server: [404] Object does not exist on the server' }));
  try { return readGitArtifact(ROOT, sha, path); } catch (error) {
    return purgedOrThrow(error);
  }
}
/**
 * ONLY A GENUINE "NOT ON THE SERVER" COUNTS AS PURGED (review of #1360). A
 * missing git-lfs binary, a 401/403, a timeout or a hash mismatch is a broken
 * run, not a purged object, and it throws.
 */
function purgedOrThrow(error) {
  const text = `${error.message || ''}\n${error.stderr || ''}`;
  if (/Object does not exist|\[404\]|404 Not Found/i.test(text) && !/does not match|Malformed/.test(text)) return null;
  throw error;
}

const rebuilt = new Map();   // `${sha}:${tier}` → { dir } | { error }
let buildTree = null;
/** Rebuild one commit's standalone from source; returns { dir } or { error }. */
function rebuildAt(sha, fullArt) {
  const key = `${sha}:${fullArt ? 'full' : 'light'}`;
  if (rebuilt.has(key)) return rebuilt.get(key);
  const env = { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' };
  const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, env, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
  let result;
  try {
    if (!buildTree) {
      buildTree = join(resolve(BUILD_MISSING), 'tree');
      rmSync(buildTree, { recursive: true, force: true });
      try { run('git', ['worktree', 'prune'], ROOT); } catch { /* nothing to prune */ }
      run('git', ['worktree', 'add', '--no-checkout', '--detach', buildTree, sha], ROOT);
      run('git', ['sparse-checkout', 'set', '--no-cone', '/*', '!/art/'], buildTree);
    }
    run('git', ['checkout', '--force', '--detach', sha], buildTree);
    run('git', ['clean', '-ffdxq'], buildTree);
    const t0 = Date.now();
    run(process.execPath, ['tools/launch.mjs', '--build-only', ...(fullArt ? ['--full-art'] : [])], buildTree);
    // The same gate every build workflow applies: a rebuild that rewrote the
    // committed box is not the build this commit names.
    const dirty = run('git', ['status', '--porcelain'], buildTree).trim();
    if (dirty) throw new Error(`the rebuild changed committed files (${dirty.split('\n').slice(0, 3).join('; ')}) — not the build this commit names`);
    const dir = join(resolve(BUILD_MISSING), 'out', key.replace(':', '-'));
    mkdirSync(dir, { recursive: true });
    for (const artifact of ['AshenSpire.html', MOBILE_ARTIFACT]) {
      if (existsSync(join(buildTree, artifact))) cpSync(join(buildTree, artifact), join(dir, artifact));
    }
    // THE PACK-SHAPED WEB EDITION, where this commit builds one: its HTML and
    // packs/ beside the single files, and its objects merged into one staging
    // store every rebuild of this run shares (content-addressed, so a file
    // twenty builds use is copied once).
    const web = join(buildTree, 'build', 'web');
    if (existsSync(join(web, 'AshenSpire.html')) && packPinOf(readFileSync(join(web, 'AshenSpire.html')))) {
      mkdirSync(join(dir, WEB_DIR), { recursive: true });
      cpSync(join(web, 'AshenSpire.html'), join(dir, WEB_DIR, 'AshenSpire.html'));
      if (existsSync(join(web, 'packs'))) cpSync(join(web, 'packs'), join(dir, WEB_DIR, 'packs'), { recursive: true });
      mergeObjects(join(web, 'objects'), join(stagingStore(), 'objects'));
    }
    console.log(`  rebuilt ${sha.slice(0, 10)} (${fullArt ? 'full' : 'light'} art requested${!fullArt && existsSync(join(dir, MOBILE_ARTIFACT)) ? '; this commit predates the light tier and built full art with its mobile twin' : ''}) in ${Math.round((Date.now() - t0) / 1000)}s`);
    result = { dir };
  } catch (error) {
    const detail = String(error.stderr || error.message || error).trim().split('\n').slice(-2).join(' ');
    result = { error: `rebuild failed: ${detail}` };
  }
  rebuilt.set(key, result);
  return result;
}

/** The objects every rebuild of this run stages, under --build-missing. */
function stagingStore() { return join(resolve(BUILD_MISSING), 'store'); }
/** The pack-shaped web edition of the main build handed in, or null. */
function stableWebEdition() {
  return MAIN_BUILD ? webEditionIn(resolve(MAIN_BUILD)) : null;
}
/** Copy each object under `from` into `to` unless it is already there (the name is the content). */
function mergeObjects(from, to) {
  if (!existsSync(from)) return;
  for (const sub of readdirSync(from, { withFileTypes: true })) {
    if (!sub.isDirectory()) continue;
    mkdirSync(join(to, sub.name), { recursive: true });
    for (const f of readdirSync(join(from, sub.name))) {
      if (!existsSync(join(to, sub.name, f))) cpSync(join(from, sub.name, f), join(to, sub.name, f));
    }
  }
}

/**
 * The pack-shaped web edition in a build folder (a rebuild's out dir, or the
 * --main-build folder, which holds build/web as `web/`), or null: { html, from }
 * where `from` is what publishPack copies the store from.
 */
function webEditionIn(dir, objectsRoot) {
  const file = join(dir, WEB_DIR, 'AshenSpire.html');
  if (!existsSync(file)) return null;
  const html = readFileSync(file);
  if (!packPinOf(html)) return null;
  return { html, from: { packs: join(dir, WEB_DIR), objects: objectsRoot || join(dir, WEB_DIR) } };
}

function dropBuildTree() {
  if (!buildTree) return;
  try { execFileSync('git', ['worktree', 'remove', '--force', buildTree], { cwd: ROOT, stdio: 'ignore' }); } catch { /* left for the runner to discard */ }
  rmSync(buildTree, { recursive: true, force: true });
  buildTree = null;
}

/** The HTML (and mobile HTML, or null) a listed build serves, or { error }. */
function artifactsOf(b) {
  if (b.source === 'git') {
    const html = committedArtifact(b.sha, 'AshenSpire.html');
    if (!html) return { error: 'its committed HTML can no longer be fetched (LFS object unavailable)' };
    // Committed builds predate the light tier (#1332 stopped committing the
    // same day light arrived), so a committed file is the full edition.
    let hasMobile = true;
    try { git(['cat-file', '-e', `${b.sha}:${MOBILE_ARTIFACT}`], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { hasMobile = false; }
    return committedEditions(html, hasMobile, () => committedArtifact(b.sha, MOBILE_ARTIFACT));
  }
  const fullArt = FULL_ART_BRANCHES.has(b.branch);
  const seeded = MAIN_BUILD && b.branch === 'main' && b.sha === mainHeadSha ? { dir: resolve(MAIN_BUILD) } : null;
  const r = seeded || rebuildAt(b.sha, fullArt);
  if (r.error) return r;
  const html = readFileSync(join(r.dir, 'AshenSpire.html'));
  // THE REBUILD MUST CARRY THE SOURCE DIGEST ITS COMMIT'S BOX NAMES — the
  // bundle stamps it into the title screen, so a file built from other source
  // cannot pass.
  if (b.digest && !html.includes(b.digest)) return { error: `the rebuilt HTML does not carry src digest ${b.digest}` };
  const mobilePath = join(r.dir, MOBILE_ARTIFACT);
  const mobile = existsSync(mobilePath) ? readFileSync(mobilePath) : null;
  const edition = rebuiltEdition(fullArt, Boolean(mobile));
  const web = webEditionIn(r.dir, seeded ? null : stagingStore());
  if (!web) return { html, mobile, edition };
  // A PACK-SHAPED BUILD: the page is the web edition, and the download is the
  // build's LIGHT single file, kept whole (owner answer 3): AshenSpire.html on
  // a light build, the light-art mobile file on a full-art one (until step 8e
  // builds the light single file under that name).
  if (b.digest && !web.html.includes(b.digest)) return { error: `the rebuilt web edition does not carry src digest ${b.digest}` };
  const single = edition === 'light' ? html : mobile;
  if (!single) return { error: 'a full-art pack build with no light-art single file to publish at download/' };
  return { html: web.html, web, download: single, edition };
}
/**
 * ONLY "THE COMMIT HAS NO MOBILE FILE" MEANS "PREDATES THE EDITION". A commit
 * that tracks the mobile file whose object cannot be fetched is a build this
 * run cannot serve whole: it is skipped and named, never published with its
 * mobile link quietly missing (Codex, #1360). A pointer that fails its SHA-256
 * is corruption and committedArtifact throws it.
 */
function committedEditions(html, hasMobile, fetchMobile) {
  if (!hasMobile) return { html, mobile: null };
  const mobile = fetchMobile();
  if (!mobile) return { error: `its committed ${MOBILE_ARTIFACT} can no longer be fetched (LFS object unavailable)` };
  return { html, mobile };
}
/**
 * THE EDITION IS WHAT THE REBUILD PRODUCED, NOT WHAT WAS ASKED FOR. A commit
 * older than the light tier (test/554, d03ef7db) ignores the light default and
 * writes the full file plus its mobile twin; calling that "light" hid the
 * mobile link the root index then required, and the first run on dev failed
 * ("root index does not offer a mobile download for test/554"). A mobile file
 * means the full edition; only a light request with no mobile file is light.
 */
function rebuiltEdition(fullArt, hasMobile) {
  return fullArt || hasMobile ? 'full' : 'light';
}
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * The exact size of the in-game folder copy (step 7) of a pack build whose
 * page is `html`, from the store under `outDir` (src/model/offlineDownload.js
 * folderZipBytes: the same layout assembleZip writes), or null when a pinned
 * file is missing (that build is already red by its own row).
 */
function zipBytesFor(outDir, b, html) {
  try {
    return folderZipBytes({ html, folder: zipFolderName(b.branch, `${b.version}.${b.ordinal}`), read: (rel) => readFileSync(join(outDir, rel)) });
  } catch { return null; }
}
let mainHeadSha = null;

/** Throws when a branch that must serve its head lost the head's own build. */
function enforceHead(branch, headTracksBuild, headOrdinal, skipped) {
  if (!HEAD_REQUIRED.has(branch)) return;
  const lost = skipped.find((x) => x.branch === branch && x.ordinal === headOrdinal);
  if (lost) throw new Error(`${branch}'s head build ${headOrdinal} (${lost.sha.slice(0, 10)}) cannot be served — ${lost.reason}; publishing would drop /${branch}/latest/`);
}

/** The note a branch that no longer commits its build carries, or ''. */
function uncommittedNote(branch, current, headTracksBuild = false) {
  if (current) return '';
  // A head that still COMMITS its build but whose object could not be fetched
  // is a different case from a head that commits none; say which (Codex, #1360).
  const why = headTracksBuild
    ? "its committed build's LFS object could not be fetched (see the skipped builds below)"
    : 'it is not committed and was not rebuilt here';
  return `<p class="meta"><strong>This branch's newest build is not on this site</strong> — ${why}. Each commit's build is the <code>${esc(branch)}-standalone-&lt;commit&gt;</code> artifact of the <a href="${REPO_URL}/actions/workflows/dev-preview.yml?query=branch%3A${encodeURIComponent(branch)}">dev preview workflow</a>. The builds listed here are older.</p>`;
}
/**
 * Whether the newest SERVED build IS the branch head's build, so /latest/ may
 * alias it. Decided by ordinal for committed heads too: a head whose committed
 * build was skipped (its LFS object gone) must not hand /latest/ to an older
 * one (Codex, #1360). Only a head with no buildordinal.json at all falls back
 * to "the head tracks its build".
 */
function isCurrent(d) {
  const b = d.builds[0];
  // No served build means nothing is current, whatever the head tracks: a
  // branch whose every object 404s must still explain itself (Codex, #1360).
  if (!b) return false;
  if (d.headOrdinal == null || !Number.isInteger(d.headOrdinal)) return d.headTracksBuild !== false;
  return b.ordinal === d.headOrdinal;
}
function skippedNote(branch) {
  const mine = skippedBuilds.filter((s) => s.branch === branch);
  if (!mine.length) return '';
  return `<p class="meta"><strong>Not served:</strong> ${mine.map((s) => `${esc(branch)}/${s.ordinal} (<a href="${REPO_URL}/commit/${s.sha}">${s.sha.slice(0, 10)}</a>) — ${esc(s.reason)}`).join('; ')}</p>`;
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
a{color:var(--acc)}a.play.dl{background:var(--acc);color:var(--card)}a.play{display:inline-block;margin:.6rem .6rem 0 0;padding:.45rem .9rem;border:1px solid var(--acc);border-radius:8px;text-decoration:none;font-weight:600}
table{width:100%;border-collapse:collapse;margin:.5rem 0 1rem}th,td{text-align:left;padding:.45rem .5rem;border-bottom:1px solid var(--line);font-size:.92rem;vertical-align:top}
th{color:var(--mut);font-weight:600}td.mono,th.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}footer{color:var(--mut);font-size:.85rem;margin-top:3rem}
.note{border-left:3px solid var(--acc);padding:.4rem .8rem;color:var(--mut);font-size:.9rem;margin:1rem 0}
`;

function stampOf(b) { return b.version ? `BUILD ${b.version}.${b.ordinal} · src ${b.digest}` : `BUILD ·${b.ordinal} · src ${b.digest}`; }
function changelogUrl(b) { return `${REPO_URL}/blob/${b.sha}/CHANGELOG.md`; }
function commitUrl(b) { return `${REPO_URL}/commit/${b.sha}`; }

// DOWNLOAD IS A PLAIN LINK, AND THAT IS THE WHOLE POINT.
//
// The in-game "download the game" button fetches the build with `fetch`, holds
// it in a Blob and then clicks a synthetic anchor. On mobile that path is the
// one that fails: a multi-megabyte Blob in a memory-tight browser tab, a save
// that has to happen inside a user-activation window the network wait already
// spent, and no File System Access API to fall back on. The build is a static
// same-origin file on this very site, so an `<a download>` pointed straight at
// it needs none of that — the browser downloads it itself, resumable, with no
// script running and nothing buffered in the page.
//
// The href is the build's own `index.html` (the byte-identical blob written
// above), not the directory URL, because a directory URL renders the game
// instead of naming a file to save.
//
// TWO DOWNLOADS PER BUILD SINCE 2026-09-20 (owner's ask): the FULL single file,
// and the MOBILE one — the same build with its art shrunk under
// tools/mobileart-policy.mjs and held under 30 MB. The full file had reached
// 253 MB, which on a phone is the whole cost of starting. The mobile file is
// served at `/<branch>/<ordinal>/mobile/` and is offered wherever the full one
// is; a build that predates the mobile edition simply has no second link,
// which is said rather than faked.
const MOBILE_ARTIFACT = 'AshenSpire-mobile.html';
const EDITIONS = Object.freeze({
  full: { artifact: 'AshenSpire.html', sub: '', prefix: '', label: 'full' },
  mobile: { artifact: MOBILE_ARTIFACT, sub: 'mobile/', prefix: 'mobile-', label: 'mobile' },
});
function mb(bytes) { return `${(bytes / 1e6).toFixed(1)} MB`; }
function downloadName(b, edition = 'full') { return `AshenSpire-${EDITIONS[edition].prefix}${b.branch}-${b.version ? `${b.version}.${b.ordinal}` : b.ordinal}.html`; }
// A PACK-SHAPED BUILD'S DOWNLOAD IS ITS LIGHT SINGLE FILE at download/ (step
// 6b): the page itself is a 9.5 MB HTML whose art lives in the site's store,
// which saved alone would play with placeholders.
function downloadHref(rel, b, edition = 'full') {
  if (b.shape === 'pack' && edition === 'full') return `${rel}${b.branch}/${b.ordinal}/${DOWNLOAD_PATH}`;
  return `${rel}${b.branch}/${b.ordinal}/${EDITIONS[edition].sub}index.html`;
}
/** The size of what a download link saves. */
function downloadBytes(b, edition = 'full') {
  if (edition === 'mobile') return b.mobileBytes;
  return b.shape === 'pack' ? b.download.bytes : b.bytes;
}
function downloadLink(rel, b, label = 'Download', edition = 'full') {
  return `<a class="play dl" href="${downloadHref(rel, b, edition)}" download="${esc(downloadName(b, edition))}">${esc(label)}</a>`;
}
/** Both download buttons for one build, sized; the mobile one only when the build has it. */
function downloadButtons(rel, b, suffix) {
  // A LIGHT BUILD (dev/test since 2026-09-26) is one file with phone-sized art
  // and no mobile twin; calling it "full" would promise art it does not carry.
  if (b.shape === 'pack') return downloadLink(rel, b, `Download${suffix} — light art single file (${mb(downloadBytes(b))})`, 'full');
  if (b.edition === 'light' && !b.mobileBytes) return downloadLink(rel, b, `Download${suffix} — light art, phone-sized (${mb(b.bytes)})`, 'full');
  const full = downloadLink(rel, b, `Download full${suffix} (${mb(b.bytes)})`, 'full');
  const mobile = b.mobileBytes ? ` ${downloadLink(rel, b, `Download mobile${suffix} (${mb(b.mobileBytes)})`, 'mobile')}` : '';
  return full + mobile;
}
function tableDownload(rel, b, edition) {
  if (edition === 'mobile' && b.shape === 'pack') return '<span class="meta">— (web edition: its download is the light single file)</span>';
  if (edition === 'mobile' && b.edition === 'light' && !b.mobileBytes) return '<span class="meta">— (light build: the one file is already phone-sized)</span>';
  if (edition === 'mobile' && !b.mobileBytes) return '<span class="meta">— (predates the mobile edition)</span>';
  return `<a href="${downloadHref(rel, b, edition)}" download="${esc(downloadName(b, edition))}">${esc(downloadName(b, edition))}</a> <span class="meta">${mb(downloadBytes(b, edition))}${b.shape === 'pack' ? ' · light art single file' : ''}</span>`;
}

/**
 * `latest` is the set of builds that ARE their branch's current build (see
 * isCurrent). Only those carry "(latest)": a branch whose head build was
 * skipped must not label an older build latest in its table (Codex, #1360).
 */
function rowsTable(builds, rel, latest = new Set()) {
  return `<table><thead><tr><th>Build</th><th class="mono">Stamp</th><th>Built</th><th>Download</th><th>Mobile download</th><th>Commit</th><th>Changelog</th></tr></thead><tbody>${
    builds.map((b) => `<tr><td><a href="${rel}${b.branch}/${b.ordinal}/">${b.branch}/${b.ordinal}</a>${latest.has(b) ? ' <em>(latest)</em>' : ''}${b.source === 'rebuild' ? ' <span class="meta">rebuilt from source</span>' : ''}${b.shape === 'pack' ? ` <span class="meta">web edition · ${esc(b.tier || 'light')} art</span>` : (b.edition === 'light' ? ' <span class="meta">light art</span>' : '')}</td><td class="mono">${esc(stampOf(b))}</td><td>${esc(b.built)}</td><td>${tableDownload(rel, b, 'full')}</td><td>${tableDownload(rel, b, 'mobile')}</td><td class="mono"><a href="${commitUrl(b)}">${b.sha.slice(0, 10)}</a></td><td><a href="${changelogUrl(b)}">CHANGELOG at this build</a></td></tr>`).join('')
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
  const cards = branchData.map((d) => {
    const { branch, builds } = d;
    const b = builds[0];
    if (!b) return `<section class="card"><h3>${esc(branch)}</h3><p class="role">${esc(BRANCH_ROLE[branch] || NO_ROLE)}</p><p class="meta">no build found on this branch</p>${uncommittedNote(branch, isCurrent(d), d.headTracksBuild)}</section>`;
    return `<section class="card"><h3>${esc(branch)}</h3><p class="role">${esc(BRANCH_ROLE[branch] || NO_ROLE)}</p>${uncommittedNote(branch, isCurrent(d), d.headTracksBuild)}
<p class="stamp">${esc(stampOf(b))}</p><p class="meta">built ${esc(b.built)} · commit <a href="${commitUrl(b)}">${b.sha.slice(0, 10)}</a> · <a href="${changelogUrl(b)}">changelog</a></p>
<a class="play" href="${branch}/${b.ordinal}/">Play ${esc(branch)} ${b.ordinal}</a>${b.mobileBytes ? ` <a class="play" href="${branch}/${b.ordinal}/mobile/">Play mobile</a>` : ''} ${downloadButtons('', b, '')} <a href="${branch}/">all ${esc(branch)} builds (${builds.length})</a></section>`;
  }).join('\n');
  const all = branchData.flatMap((d) => d.builds).sort((a, b) => b.ordinal - a.ordinal);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AshenSpire — builds</title><style>${CSS}</style></head><body><main>
<h1>AshenSpire — every build, by branch</h1>
<p class="lead">Each build is the game that commit shipped — the committed file byte for byte, or, for a commit that no longer commits its build, rebuilt here from that commit's source and checked against the source digest its <code>buildordinal.json</code> names — served at <code>/&lt;branch&gt;/&lt;build&gt;/</code>. A newer build is the <strong>web edition</strong>: the page loads its art from this site's shared store, and its <em>Download</em> is the light-art single file at <code>/&lt;branch&gt;/&lt;build&gt;/download/</code>. An older full-art build also has its mobile edition <code>AshenSpire-mobile.html</code> at <code>/&lt;branch&gt;/&lt;build&gt;/mobile/</code>. The stamp here is the one the game shows on its title screen.</p>
<div class="grid">${cards}</div>
<div class="note"><strong>Web edition builds</strong> play here with their art fetched as needed; in the game, <em>Download &amp; saves</em> → <em>Make available offline</em> keeps one in this browser for offline play. Their <em>Download</em> saves the light-art single file: one self-contained <code>.html</code> that plays by double-click.</div>
<div class="note"><strong>Light builds</strong> (dev and test) are one file whose art is already phone-sized, so they have no separate mobile download. <strong>Two downloads, one game</strong> for the others: <em>Full</em> is the whole game with its art as painted. <em>Mobile</em> is the same build with every image shrunk to under a third of its size and recompressed, held under 30 MB — the one to take on a phone or a slow connection; it plays the same, looks softer. Both are single self-contained <code>.html</code> files: the link saves the file straight from this site (the path that works on phones, where the in-game downloader cannot hold the whole file in memory), and the saved file plays offline in any browser. Use <em>Export saves</em> in the game to carry saves across; saves are compatible between the two editions.</div>
<div class="note">Saves live in this site's browser storage and are shared between builds; a build that cannot read a save archives it by name instead of losing it. <strong>main</strong> is the stable line; <strong>dev</strong> is unreviewed integration work.</div>
<h2>All listed builds</h2>${rowsTable(all, '', new Set(branchData.filter((d) => d.builds[0] && isCurrent(d)).map((d) => d.builds[0])))}
<h2>Other pages on this site</h2>
${otherPages.length ? `<ul>${otherPages.map((pg) => `<li><a href="${esc(pg.href)}">${esc(pg.title || pg.path)}</a>${pg.title ? '' : ' <span class="meta">(no &lt;title&gt; — listed by path)</span>'} <span class="meta">${esc(pg.path)}</span></li>`).join('')}</ul>` : '<p class="meta">no other pages found in the published tree</p>'}
<p><a href="${REPO_URL}">repository</a></p>
<footer>Generated ${esc(generatedAt)} by <code>tools/pages-site.mjs</code> from git history and from the published tree — nothing on this page is typed by hand, this list included. Listing the newest ${KEEP} builds per branch.</footer>
</main></body></html>`;
}

function branchIndex(branch, builds, head, generatedAt, current = true, headTracksBuild = false) {
  // NO HEAD MEANS THE BRANCH IS GONE, and the page says exactly that rather
  // than linking a commit that does not exist. `head` is null only on that
  // path — buildsOf returns it for a branch with no ref.
  const headLine = head
    ? `branch head <a href="${REPO_URL}/commit/${head}">${head.slice(0, 10)}</a>`
    : '<b>this branch does not exist on the remote</b> — nothing to publish for it';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AshenSpire — ${esc(branch)} builds</title><style>${CSS}</style></head><body><main>
<p><a href="../">← all branches</a></p><h1>${esc(branch)} builds</h1><p class="lead">${esc(BRANCH_ROLE[branch] || NO_ROLE)} · ${headLine}</p>
${uncommittedNote(branch, current, headTracksBuild)}
${skippedNote(branch)}
${builds.length && !current ? `<p><a class="play" href="${builds[0].ordinal}/">Play newest listed (${builds[0].ordinal})</a>${builds[0].mobileBytes ? ` <a class="play" href="${builds[0].ordinal}/mobile/">Play newest listed mobile</a>` : ''}</p>` : ''}
${builds.length && current ? `<p><a class="play" href="${builds[0].ordinal}/">Play latest (${builds[0].ordinal})</a>${builds[0].mobileBytes ? ` <a class="play" href="${builds[0].ordinal}/mobile/">Play latest mobile</a>` : ''} ${downloadButtons('../', builds[0], ` latest (${builds[0].ordinal})`)} <a class="play" href="latest/">/latest/ alias</a>${builds[0].mobileBytes ? ` <a class="play" href="latest/mobile/">/latest/mobile/ alias</a>` : ''}</p>
<p class="meta">${builds[0].shape === 'pack' ? 'This is the web edition: Play loads its art from this site. A download is the light-art single file, one self-contained HTML file.' : builds[0].edition === 'light' ? 'A download is one self-contained HTML file. This is a light build: its art is the phone-sized set, so there is no separate mobile file.' : 'A download is one self-contained HTML file: <em>full</em> carries the art as painted, <em>mobile</em> the same build with its art shrunk under 30 MB.'} On a phone or tablet, download from here rather than from inside the game.</p>` : (builds.length ? '' : '<p class="meta">no build on this branch</p>')}
${rowsTable(builds, '../', new Set(current && builds[0] ? [builds[0]] : []))}
<footer>Generated ${esc(generatedAt)} by <code>tools/pages-site.mjs</code>.</footer></main></body></html>`;
}

/** `git archive <ref> -- <pathspecs>` extracted into `outDir`. */
function extractTree(ref, pathspecs, outDir) {
  const tmp = mkdtempSync(join(tmpdir(), 'pages-site-main-'));
  const archive = join(tmp, 'source.tar');
  try {
    execFileSync('git', ['-C', ROOT, 'archive', '--format=tar', '--output', archive, ref, '--', ...pathspecs]);
    execFileSync('tar', ['-xf', archive, '-C', outDir]);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}
/** Whether `path` (file or folder) is in `ref`'s tree. */
function inTree(ref, path) {
  try { git(['cat-file', '-e', `${ref}:${path}`], { stdio: ['ignore', 'pipe', 'ignore'] }); return true; } catch { return false; }
}
/**
 * THE SHARE IMAGE every build's og:image names (OG_IMAGE in tools/og-image.mjs),
 * written at the site root from the art in main's tree, or from the first other
 * published branch that has it while main predates it. Absent everywhere, the
 * run says so and --check goes red: a link preview with no picture is a defect,
 * not a reason to withhold the site.
 */
function writeOgImage(outDir, mainRef) {
  const ref = ogImageSource(mainRef);
  if (!ref) {
    const why = `no published branch carries ${OG_IMAGE.source}; /${OG_IMAGE.sitePath} (every build's og:image) is not served`;
    console.log(`  NO OG IMAGE ${why}`);
    if (process.env.GITHUB_ACTIONS) console.log(`::warning title=pages-site has no og:image::${why}`);
    return;
  }
  writeFileSync(join(outDir, OG_IMAGE.sitePath), readGitArtifact(ROOT, ref, OG_IMAGE.source));
}
/**
 * THE ONE ANSWER TO "WHICH BRANCH SUPPLIES THE SHARE IMAGE": main's tree, else
 * the first other published branch that carries OG_IMAGE.source, else null.
 * writeOgImage() and the selftest both ask it, so the selftest compares the
 * served file with the branch that really supplied it (Codex, #1442). `others`
 * and `has` are parameters only so the fallback can be proved without a repo
 * in that state.
 */
function ogImageSource(mainRef, others = BRANCHES.filter((b) => b !== 'main').map(refFor), has = (r) => inTree(r, OG_IMAGE.source)) {
  return [mainRef, ...others].find((r) => r && has(r)) || null;
}
const isWebp = (buf) => buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
/** Total bytes and files under `dir`, and the bytes per top-level entry. Symlinks are not followed. */
function siteSize(dir) {
  const roots = new Map();
  let bytes = 0; let files = 0;
  const walk = (abs, top) => {
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const p = join(abs, e.name);
      const root = top ?? e.name;
      if (e.isDirectory()) walk(p, root);
      else if (e.isFile()) { const n = statSync(p).size; bytes += n; files++; roots.set(root, (roots.get(root) || 0) + n); }
    }
  };
  walk(dir, null);
  return { bytes, files, roots: [...roots].sort((a, b) => b[1] - a[1]) };
}
function sizeLine(dir) {
  const { bytes, files, roots } = siteSize(dir);
  return `site size: ${mb(bytes)} in ${files} files; largest: ${roots.slice(0, 6).map(([r, n]) => `${r} ${mb(n)}`).join(', ')}`;
}

/**
 * Write one served build at /<branch>/<ordinal>/ and prove what was written is
 * its source, byte for byte. `a` is what artifactsOf returned. Returns the
 * number of byte-proofs made. Sets on `b` the facts every page and builds.json
 * read: edition, shape, version, bytes, sha256, mobile*, download.
 */
function publishBuild(outDir, b, a) {
  let checks = 0;
  const { html, mobile: mobileHtml, edition } = a;
  b.edition = edition || 'full';
  b.version = versionIn(html.toString('latin1'));
  b.bytes = html.length;
  b.sha256 = sha256(html);
  const rel = `${b.branch}/${b.ordinal}`;
  const dir = join(outDir, rel);
  mkdirSync(dir, { recursive: true });
  if (a.web) {
    // THE PACK SHAPE: the web edition's HTML, its asset-base.json, and its
    // packs and objects merged into the site's one store.
    b.shape = 'pack';
    const { pin } = publishPack(outDir, rel, html, a.web.from);
    b.tier = pin.tier || null;
    // THE DOWNLOAD, KEPT WHOLE: the light single file, beside the page.
    const target = join(dir, DOWNLOAD_PATH);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, a.download);
    if (Buffer.compare(readFileSync(target), a.download) !== 0) throw new Error(`${rel}: written download differs from its source`);
    b.download = { path: DOWNLOAD_PATH, bytes: a.download.length, sha256: sha256(a.download) };
    checks++;
  } else {
    b.shape = 'single';
    writeFileSync(join(dir, 'index.html'), html);
  }
  // THE MOBILE EDITION, WHERE AN OLDER BUILD HAS ONE: a committed mobile file,
  // or the one a --full-art rebuild of an inline build writes (a light build
  // has none — it IS the phone-sized file — and a pack-shaped build's light
  // art is its download/). `mobileBytes` is the fact every page reads to
  // decide whether to offer the second link.
  const hasMobile = Boolean(mobileHtml) && !a.web;
  if (hasMobile) {
    mkdirSync(join(dir, 'mobile'), { recursive: true });
    writeFileSync(join(dir, 'mobile', 'index.html'), mobileHtml);
    if (Buffer.compare(readFileSync(join(dir, 'mobile', 'index.html')), mobileHtml) !== 0) throw new Error(`${rel}: written mobile build differs from its source`);
    b.mobileBytes = mobileHtml.length;
    b.mobileSha256 = sha256(mobileHtml);
    checks++;
  }
  // Detail belongs to this exact build, not main's potentially older art.
  // The tiles are resolved against the page's own URL (mapDetail.js reads
  // document.baseURI), so the mobile page at mobile/ needs its own copy
  // beside it or every tile 404s and the hosted mobile build falls back
  // to the low-detail map while the full one beside it shows detail. A
  // pack-shaped build reads them the same way until step 3c moves the
  // tiles and the score into the common index (their objects are already in
  // the store; the page does not ask for them there yet).
  const detailFiles = gitBuf(['ls-tree', '-r', '--name-only', b.sha, '--', 'map-detail']).toString('utf8').trim().split('\n').filter(Boolean);
  for (const file of detailFiles) {
    const tile = gitBuf(['show', `${b.sha}:${file}`]);
    for (const base of hasMobile ? [dir, join(dir, 'mobile')] : [dir]) {
      const destination = join(base, file);
      mkdirSync(dirname(destination), {recursive:true});
      writeFileSync(destination, tile);
    }
  }
  // The shipped score belongs to this exact build too, read the same way:
  // a served page with the music-folder setting blank fetches music/ from
  // beside itself (content/music.js SHIPPED_MUSIC_FOLDER), so the mobile
  // page needs its own copy for the same reason as the detail tiles.
  const musicFiles = gitBuf(['ls-tree', '-r', '--name-only', b.sha, '--', 'music']).toString('utf8').trim().split('\n').filter(Boolean);
  for (const file of musicFiles) {
    const blob = gitBuf(['show', `${b.sha}:${file}`]);
    for (const base of hasMobile ? [dir, join(dir, 'mobile')] : [dir]) {
      const destination = join(base, file);
      mkdirSync(dirname(destination), {recursive:true});
      writeFileSync(destination, blob);
    }
  }
  // build.json IS WHAT THE IN-GAME DOWNLOADER READS (src/model/offlineDownload.js,
  // from <branch>/latest/build.json). A pack-shaped build names its download in
  // `download`, and its top-level `bytes` is null: a copy of the game from
  // before step 6b reads only `bytes` and `../<ordinal>/index.html`, and for a
  // pack build that page is a 9.5 MB HTML with no art. null is a size it
  // refuses ("Download information is not ready yet"), so an old copy says it
  // cannot download rather than saving a game with no art. The page's own size
  // is `pageBytes`. For the in-game folder copy (step 7) a pack build also
  // records the page's sha256, which the zip checks the page against, and
  // `zipBytes`, the exact size of the zip the game assembles from it (read
  // from the store just published), which the screen shows before anything
  // is fetched.
  const top = b.shape === 'pack'
    ? { bytes: null, pageBytes: html.length, pageSha256: sha256(html), zipBytes: zipBytesFor(outDir, b, html) }
    : { bytes: html.length };
  writeFileSync(join(dir, 'build.json'), JSON.stringify({ branch: b.branch, ordinal: b.ordinal, version: b.version, ...top, mobileBytes: b.mobileBytes ?? null, edition: b.edition, shape: b.shape, tier: b.tier ?? null, download: b.download ?? null, digest: b.digest, built: b.built, commit: b.sha, source: b.source, changelog: changelogUrl(b), stamp: stampOf(b) }, null, 2) + '\n');
  // The proof: what was written is the blob (or the rebuild), byte for byte.
  if (Buffer.compare(readFileSync(join(dir, 'index.html')), html) !== 0) throw new Error(`${rel}: written build differs from its source`);
  checks++;
  return checks;
}

function assemble(outDir, keep) {
  const generatedAt = new Date().toISOString();
  skippedBuilds.length = 0;
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  // 1. main's tree is the base so every existing URL keeps resolving.
  // `main` is the site's BASE TREE, not one branch among four — without it
  // there is no site to publish, so this one absence is still fatal. That is
  // the difference the skip below turns on: a missing publish TARGET costs its
  // own section; a missing FOUNDATION costs the run, and says which it was.
  const mainRef = refFor('main');
  if (!mainRef) throw new Error("no ref for 'main' — it is the site's base tree, so nothing can be assembled without it");
  extractTree(mainRef, BASE_TREE_PATHSPECS, outDir);
  // THE STABLE BUILD'S PAYLOAD, written back from main's tree: the excluded
  // map-detail/ and music/ are what /AshenSpire.html fetches beside itself.
  const payload = STABLE_PAYLOAD_DIRS.filter((d) => inTree(mainRef, d));
  if (payload.length) extractTree(mainRef, payload, outDir);
  // The committed build HTML is left out of the archive and written here, only
  // at the stable paths, hydrated from LFS where it is a pointer.
  for (const name of STABLE_LINKS) for (const artifact of [name, `build/${name}`, `dist/${name}`]) {
    if (!inTree(mainRef, artifact)) continue;
    mkdirSync(dirname(join(outDir, artifact)), { recursive: true });
    writeFileSync(join(outDir, artifact), readGitArtifact(ROOT, mainRef, artifact));
  }
  mainHeadSha = git(['rev-parse', mainRef]).trim();
  writeOgImage(outDir, mainRef);
  // THE STABLE PLAY LINKS (README: /AshenSpire.html, /AshenSpire-mobile.html).
  // A main tree that no longer tracks its build gets main's CI build instead;
  // with no build handed in, the run fails rather than publishing a site whose
  // primary link is a 404.
  //
  // A main tree that DOES track AshenSpire.html but predates the mobile edition
  // (0.6.0, 2026-09-13 — the edition arrived on 2026-09-20) has no mobile file
  // to serve and never had one; demanding it failed every run from 2026-09-26
  // ("main's tree carries no AshenSpire-mobile.html"). That link is absent
  // until main is promoted past the edition, and the run says so.
  const mainTracksBuild = inTree(mainRef, 'AshenSpire.html');
  // A main build handed in that carries a pack-shaped web edition (MAIN_BUILD/web,
  // pages-builds.yml copies build/web there) serves it at the stable Play link:
  // the 9.5 MB page, an asset-base.json beside each location, the store at the
  // root (step 6b). The mobile link keeps its file until step 8e redirects it.
  const mainPack = !mainTracksBuild && MAIN_BUILD ? stableWebEdition() : null;
  const stableWrite = (dir, artifact) => {
    if (artifact === 'AshenSpire.html' && mainPack) { publishPack(outDir, dir, mainPack.html, mainPack.from, { name: artifact }); return; }
    mkdirSync(join(outDir, dir), { recursive: true });
    cpSync(resolve(MAIN_BUILD, artifact), join(outDir, dir, artifact));
  };
  for (const artifact of STABLE_LINKS) {
    if (existsSync(join(outDir, artifact))) continue;
    if (mainTracksBuild) { console.log(`  note: main's committed build predates ${artifact}; /${artifact} is not served until main is promoted past it`); continue; }
    if (!MAIN_BUILD) throw new Error(`main's tree carries no ${artifact} — pass --main-build <dir> holding a build of main's source, or the stable Play link at /${artifact} 404s`);
    stableWrite('', artifact);
  }
  // THE build/ AND dist/ ALIASES TOO (Codex, #1360): the hydration loop above
  // serves them when main tracks its build, and tools/launch.mjs writes the
  // same file there, so a seeded main must not 404 at /build/ or /dist/.
  if (!mainTracksBuild && MAIN_BUILD) {
    for (const artifact of STABLE_LINKS) {
      if (!existsSync(resolve(MAIN_BUILD, artifact))) continue;
      for (const alias of STABLE_ALIASES) stableWrite(alias, artifact);
    }
  }
  if (existsSync(join(outDir, 'index.html'))) cpSync(join(outDir, 'index.html'), join(outDir, 'index-game.html'));
  // The build/ and dist/ aliases fetch the shipped score AND the map tiles from
  // beside themselves (content/music.js SHIPPED_MUSIC_FOLDER; mapDetail.js
  // resolves map-detail/ against document.baseURI); git carries them only at
  // the root, so every stable location gets its own copy of the payload.
  for (const alias of STABLE_ALIASES) {
    if (!STABLE_LINKS.some((name) => existsSync(join(outDir, alias, name)))) continue;
    for (const d of STABLE_PAYLOAD_DIRS) {
      if (existsSync(join(outDir, d)) && !existsSync(join(outDir, alias, d))) cpSync(join(outDir, d), join(outDir, alias, d), { recursive: true });
    }
  }
  writeFileSync(join(outDir, '.nojekyll'), '');

  let checks = 0;
  const branchData = [];
  for (const branch of BRANCHES) {
    const { head, builds: listed, headTracksBuild, headOrdinal } = buildsOf(branch, keep);
    // Fetch or rebuild every listed build FIRST, so one that cannot be served
    // leaves the list (named in skippedBuilds) before any page links it.
    const served = new Map();
    for (const b of listed) {
      const a = artifactsOf(b);
      if (a.error) skip(b, a.error); else served.set(b, a);
    }
    // A build the store refuses (a name another build already published with
    // other bytes, or a pin or index naming a file outside packs/ and
    // objects/) is skipped and named like any other unservable build; the
    // rest of the publication goes ahead (review of #1456).
    const builds = [];
    for (const b of listed) {
      if (!served.has(b)) continue;
      try { checks += publishBuild(outDir, b, served.get(b)); builds.push(b); }
      catch (error) {
        if (!error.refused) throw error;
        rmSync(join(outDir, branch, String(b.ordinal)), { recursive: true, force: true });
        skip(b, error.message);
      }
    }
    enforceHead(branch, headTracksBuild, headOrdinal, skippedBuilds);
    // /latest/ ONLY WHEN THE NEWEST LISTED BUILD IS THE HEAD'S BUILD — committed,
    // or rebuilt from the head's source. Otherwise the newest listed build is
    // an older one, and an alias called latest would launch an ever-staler
    // game; the page says where newer builds are instead.
    const current = isCurrent({ builds, headTracksBuild, headOrdinal });
    if (builds[0] && !current) {
      const why = `${branch}/latest/ not published: the head's build ${headOrdinal ?? '(unnamed)'} is not served; the newest served build is ${builds[0].ordinal}`;
      console.log(`  NO LATEST ${why}`);
      if (process.env.GITHUB_ACTIONS) console.log(`::warning title=pages-site ${branch} has no /latest/::${why}`);
    }
    if (builds[0] && current) {
      const latest = join(outDir, branch, 'latest');
      mkdirSync(latest, { recursive: true });
      cpSync(join(outDir, branch, String(builds[0].ordinal), 'index.html'), join(latest, 'index.html'));
      cpSync(join(outDir, branch, String(builds[0].ordinal), 'build.json'), join(latest, 'build.json'));
      // A pack-shaped build's base (same depth, so the same text) and its download.
      for (const extra of [ASSET_BASE_FILE, 'download']) {
        const from = join(outDir, branch, String(builds[0].ordinal), extra);
        if (existsSync(from)) cpSync(from, join(latest, extra), { recursive: true });
      }
      const detail = join(outDir, branch, String(builds[0].ordinal), 'map-detail');
      if (existsSync(detail)) cpSync(detail, join(latest, 'map-detail'), {recursive:true});
      const score = join(outDir, branch, String(builds[0].ordinal), 'music');
      if (existsSync(score)) cpSync(score, join(latest, 'music'), {recursive:true});
      const mobile = join(outDir, branch, String(builds[0].ordinal), 'mobile');
      if (existsSync(mobile)) cpSync(mobile, join(latest, 'mobile'), { recursive: true });
    }
    mkdirSync(join(outDir, branch), { recursive: true });
    const idx = branchIndex(branch, builds, head, generatedAt, current, headTracksBuild);
    writeFileSync(join(outDir, branch, 'index.html'), idx);
    for (const b of builds) if (!idx.includes(`href="../${branch}/${b.ordinal}/"`)) throw new Error(`${branch} index does not link build ${b.ordinal}`);
    checks++;
    branchData.push({ branch, head, builds, headTracksBuild, headOrdinal });
  }
  // Discovered AFTER the branch directories exist, so this tool's own output is
  // excluded by name-of-thing-we-just-wrote rather than by a hardcoded list.
  const generatedNames = new Set([...BRANCHES, 'index.html', 'builds.json', 'objects', 'packs', SW_FILE]);
  const otherPages = discoverPages(outDir, generatedNames);
  const root = rootIndex(branchData, generatedAt, otherPages);
  writeFileSync(join(outDir, 'index.html'), root);
  for (const d of branchData) for (const b of d.builds) if (!root.includes(`href="${d.branch}/${b.ordinal}/"`)) throw new Error(`root index does not link ${d.branch}/${b.ordinal}`);
  checks++;
  // THE DOWNLOAD LINK IS PROVEN LIKE THE PLAY LINK IS. A download offered by
  // this page and not present in the tree is worse than no download at all:
  // it is the mobile failure this pass exists to remove, moved one layer out.
  for (const d of branchData) for (const b of d.builds) {
    for (const edition of b.mobileBytes ? ['full', 'mobile'] : ['full']) {
      const href = downloadHref('', b, edition);
      if (!root.includes(`href="${href}" download="`)) throw new Error(`root index does not offer a ${edition} download for ${d.branch}/${b.ordinal}`);
      if (!existsSync(join(outDir, href))) throw new Error(`${edition} download target missing on disk: ${href}`);
      checks++;
    }
  }
  // THE SERVICE WORKER, at the site root, always: the kill-switch must be
  // publishable whatever the site holds (tools/pages-sw.mjs).
  const serviceWorker = { ...writeServiceWorker(outDir, { kill: SW_KILL_RUN }), version: SW_VERSION };
  dropBuildTree();
  writeFileSync(join(outDir, 'builds.json'), JSON.stringify({ generatedAt, keep, otherPages, skipped: skippedBuilds, serviceWorker, branches: branchData.map((d) => ({ branch: d.branch, head: d.head, builds: d.builds.map((b) => ({ ...b, stamp: stampOf(b), changelog: changelogUrl(b) })) })) }, null, 2) + '\n');
  return { checks, branchData };
}

// Every red check() raised in its last run, by text, so a selftest plant can
// prove it was caught BY NAME rather than by whatever else turned the run red.
const lastReds = [];
function red(message) {
  console.error(message);
  lastReds.push(message);
  process.exitCode = 1;
}

function check(outDir) {
  lastReds.length = 0;
  const manifest = JSON.parse(readFileSync(join(outDir, 'builds.json'), 'utf8'));
  let checks = 0;
  for (const d of manifest.branches) for (const b of d.builds) {
    // A committed build is proven against its git blob; a rebuilt one against
    // the SHA-256 recorded when it was built and the digest its commit names.
    const rebuiltBuild = b.source === 'rebuild';
    const bdir = join(outDir, d.branch, String(b.ordinal));
    const expectedFile = (path, hash) => {
      const onDisk = readFileSync(path);
      if (!rebuiltBuild) return null;
      return sha256(onDisk) === hash && (!b.digest || onDisk.includes(b.digest)) ? onDisk : Buffer.from('');
    };
    const blob = rebuiltBuild ? expectedFile(join(bdir, 'index.html'), b.sha256) : readGitArtifact(ROOT, b.sha, 'AshenSpire.html');
    const onDisk = readFileSync(join(bdir, 'index.html'));
    const download = JSON.parse(readFileSync(join(bdir, 'build.json'), 'utf8'));
    const pageBytes = b.shape === 'pack' ? download.pageBytes : download.bytes;
    // zipBytes is judged only when the store lets it be measured: a missing
    // pinned file is red by its own row (MISSING INDEX), not twice.
    const zipNow = b.shape === 'pack' ? zipBytesFor(outDir, b, onDisk) : null;
    if (pageBytes !== onDisk.length || download.ordinal !== b.ordinal || download.version !== b.version
      || (b.shape === 'pack' && (download.pageSha256 !== sha256(onDisk) || (zipNow !== null && download.zipBytes !== zipNow)))) {
      red(`DOWNLOAD DRIFT ${d.branch}/${b.ordinal}: metadata differs from the downloadable file`);
    } else checks++;
    if (Buffer.compare(blob, onDisk) !== 0) red(`DRIFT ${d.branch}/${b.ordinal}: site file differs from ${rebuiltBuild ? 'the recorded rebuild of' : 'git blob'} ${b.sha.slice(0, 10)}`);
    else checks++;
    if (b.shape === 'pack') {
      // THE DOWNLOAD, KEPT WHOLE: the light single file the build list and
      // offlineDownload.js name, present with the bytes recorded for it.
      const file = join(bdir, b.download?.path || DOWNLOAD_PATH);
      if (!b.download || !existsSync(file)) red(`MISSING ${d.branch}/${b.ordinal}/${DOWNLOAD_PATH}: the build's Download names it and the site has no such file`);
      else {
        const bytes = readFileSync(file);
        const meta = download.download || {};
        if (bytes.length !== b.download.bytes || sha256(bytes) !== b.download.sha256 || meta.bytes !== bytes.length || meta.sha256 !== b.download.sha256 || meta.path !== b.download.path || (b.digest && !bytes.includes(b.digest))) {
          red(`DOWNLOAD DRIFT ${d.branch}/${b.ordinal}/${DOWNLOAD_PATH}: the file differs from the light single file recorded for it`);
        } else checks++;
      }
    }
    if (b.mobileBytes) {
      const mobileBlob = rebuiltBuild ? expectedFile(join(bdir, 'mobile', 'index.html'), b.mobileSha256) : readGitArtifact(ROOT, b.sha, MOBILE_ARTIFACT);
      const mobileOnDisk = readFileSync(join(bdir, 'mobile', 'index.html'));
      if (download.mobileBytes !== mobileOnDisk.length) red(`DOWNLOAD DRIFT ${d.branch}/${b.ordinal}/mobile: metadata differs from the downloadable file`);
      else checks++;
      if (Buffer.compare(mobileBlob, mobileOnDisk) !== 0) red(`DRIFT ${d.branch}/${b.ordinal}/mobile: site file differs from ${rebuiltBuild ? 'the recorded rebuild of' : 'git blob'} ${b.sha.slice(0, 10)}`);
      else checks++;
    }
  }
  // THE STORE (step 6b): every pack-shaped page — each build, each /latest/,
  // the stable links — has an asset-base.json that resolves its pinned
  // indexes; every object a served index lists is there with its hash; nothing
  // in the store is unreferenced. And the service worker is this tool's text.
  const pages = packPages(outDir, manifest.branches.map((d) => d.branch));
  for (const [text, ok] of [...storeFindings(outDir, pages), ...serviceWorkerFindings(outDir, manifest.serviceWorker)]) {
    if (ok) checks++;
    else red(text);
  }
  // Every download link a build list offers is a file on the site.
  for (const page of ['index.html', ...manifest.branches.map((d) => `${d.branch}/index.html`)]) {
    const abs = join(outDir, page);
    if (!existsSync(abs)) continue;
    const html = readFileSync(abs, 'utf8');
    const base = dirname(page);
    let offered = 0;
    for (const m of html.matchAll(/href="([^"]+)" download="/g)) {
      offered++;
      const target = join(outDir, base, m[1]);
      if (!existsSync(target)) red(`DEAD DOWNLOAD on /${page}: ${m[1]} is not on the site`);
    }
    if (offered) checks++;
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
    if (!existsSync(target)) { red(`MISSING page ${pg.path}: listed on the index, not in the site`); continue; }
    if (!root.includes(`href="${pg.href}"`)) { red(`UNLINKED page ${pg.path}: in the manifest, not linked from the root index`); continue; }
    checks++;
  }
  // THE SHARE IMAGE every build's og:image names (OG_IMAGE.url) is served.
  const og = join(outDir, OG_IMAGE.sitePath);
  if (!existsSync(og) || !isWebp(readFileSync(og))) red(`MISSING ${OG_IMAGE.sitePath}: every build's og:image (${OG_IMAGE.url}) names it, and the site has no WebP there`);
  else checks++;
  // THE SITE'S SIZE, printed so its growth is seen (Pages documents a 1 GB limit).
  console.log(`  ${sizeLine(outDir)}`);
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

/**
 * A VICTIM THE DRIFT PLANT CAN ALWAYS HAVE (Codex, #1360). Once the LFS purge
 * lands every committed build is skipped, and a selftest run without rebuilds
 * serves none — so the plant used to throw and Pages could never assemble
 * again. When nothing was served, a synthetic rebuilt entry is written into the
 * assembled site and its manifest, and check() proves it like any other.
 */
function syntheticVictim(dir) {
  const branch = BRANCHES[0];
  const bytes = Buffer.from(`<!doctype html><title>synthetic build</title>\n<!-- src synthetic-digest -->\n`);
  const b = { branch, ordinal: 0, digest: 'synthetic-digest', built: '1970-01-01', sha: git(['rev-parse', 'HEAD']).trim(), source: 'rebuild', edition: 'light', version: null, bytes: bytes.length, sha256: sha256(bytes) };
  const bdir = join(dir, branch, '0');
  mkdirSync(bdir, { recursive: true });
  writeFileSync(join(bdir, 'index.html'), bytes);
  writeFileSync(join(bdir, 'build.json'), JSON.stringify({ branch, ordinal: 0, version: null, bytes: bytes.length, mobileBytes: null }) + '\n');
  const manifestPath = join(dir, 'builds.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let entry = manifest.branches.find((d) => d.branch === branch);
  if (!entry) { entry = { branch, head: null, builds: [] }; manifest.branches.push(entry); }
  entry.builds.push(b);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return { branch, builds: [b], bytes };
}

/**
 * STEP 6a ON THE REAL ASSEMBLY, each against main's own tree rather than
 * against what assemble() says it did: the excluded roots are absent, docs/
 * preview is kept, the stable links are main's committed bytes (or the build
 * handed in), and the stable build's payload is main's map-detail/ and music/.
 */
function baseTreeFindings(dir) {
  const mainRef = refFor('main');
  const out = [];
  const leaked = BASE_TREE_EXCLUDED_DIRS.filter((d) => !STABLE_PAYLOAD_DIRS.includes(d) && existsSync(join(dir, d)));
  out.push([`main's base tree leaves out ${BASE_TREE_EXCLUDED_DIRS.filter((d) => !STABLE_PAYLOAD_DIRS.includes(d)).join(', ')}${leaked.length ? ` (present: ${leaked.join(', ')})` : ''}`, leaked.length === 0]);
  const strayHtml = [];
  for (const sub of ['', 'build', 'dist']) {
    const abs = join(dir, sub);
    if (!existsSync(abs)) continue;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const rel = sub ? `${sub}/${e.name}` : e.name;
      if (e.isFile() && e.name.endsWith('.html') && (sub || e.name.startsWith('AshenSpire')) && !STABLE_LINKS.includes(e.name)) strayHtml.push(rel);
    }
  }
  out.push([`no committed build HTML but the stable links${strayHtml.length ? ` (found: ${strayHtml.join(', ')})` : ''}`, strayHtml.length === 0]);
  // The share image is the supplying branch's art, byte for byte: main's
  // while main carries it, else the fallback writeOgImage() used.
  const og = join(dir, OG_IMAGE.sitePath);
  const ogRef = ogImageSource(mainRef);
  if (ogRef) out.push([`/${OG_IMAGE.sitePath} is ${ogRef}'s ${OG_IMAGE.source}, byte for byte`, existsSync(og) && Buffer.compare(readFileSync(og), readGitArtifact(ROOT, ogRef, OG_IMAGE.source)) === 0]);
  else out.push([`no published branch carries ${OG_IMAGE.source}, and /${OG_IMAGE.sitePath} is said to be missing rather than invented`, !existsSync(og)]);
  for (const d of BASE_TREE_KEPT_DIRS) if (inTree(mainRef, d)) out.push([`${d}/ is kept (${d === 'assets' ? 'owner, 2026-10-02' : 'owner answer 7'})`, existsSync(join(dir, d))]);
  // The index links nothing under an excluded root (the art review sections).
  const index = existsSync(join(dir, 'index.html')) ? readFileSync(join(dir, 'index.html'), 'utf8') : '';
  const listed = (JSON.parse(readFileSync(join(dir, 'builds.json'), 'utf8')).otherPages || []).filter((pg) => BASE_TREE_EXCLUDED_DIRS.includes(pg.path.split('/')[0]));
  const linked = BASE_TREE_EXCLUDED_DIRS.filter((d) => index.includes(`href="${d}/`));
  out.push([`the site index lists and links no page under ${BASE_TREE_EXCLUDED_DIRS.join(', ')}${listed.length || linked.length ? ` (found: ${[...listed.map((pg) => pg.path), ...linked].join(', ')})` : ''}`, listed.length === 0 && linked.length === 0]);
  for (const name of STABLE_LINKS) for (const artifact of [name, `build/${name}`, `dist/${name}`]) {
    const fromMain = inTree(mainRef, artifact);
    const fromBuild = !inTree(mainRef, 'AshenSpire.html') && MAIN_BUILD && existsSync(resolve(MAIN_BUILD, name));
    if (!fromMain && !fromBuild) continue;
    const web = !fromMain && name === 'AshenSpire.html' ? stableWebEdition() : null;
    const want = fromMain ? readGitArtifact(ROOT, mainRef, artifact) : web ? web.html : readFileSync(resolve(MAIN_BUILD, name));
    const at = join(dir, artifact);
    out.push([`stable link /${artifact} is ${fromMain ? "main's committed build" : web ? "the main build's web edition" : 'the main build handed in'}, byte for byte`, existsSync(at) && Buffer.compare(readFileSync(at), want) === 0]);
  }
  for (const d of STABLE_PAYLOAD_DIRS) {
    if (!inTree(mainRef, d)) continue;
    const files = git(['ls-tree', '-r', '--name-only', mainRef, '--', d]).trim().split('\n').filter(Boolean);
    const missing = files.filter((f) => !existsSync(join(dir, f)) || Buffer.compare(readFileSync(join(dir, f)), gitBuf(['show', `${mainRef}:${f}`])) !== 0);
    out.push([`the stable build's ${d}/ is main's (${files.length} files${missing.length ? `, ${missing.length} wrong, e.g. ${missing[0]}` : ''})`, missing.length === 0]);
    // Beside every stable location, not only the root (Copilot, #1442).
    for (const alias of STABLE_ALIASES) {
      if (!STABLE_LINKS.some((name) => existsSync(join(dir, alias, name)))) continue;
      const absent = files.filter((f) => !existsSync(join(dir, alias, f)) || Buffer.compare(readFileSync(join(dir, alias, f)), readFileSync(join(dir, f))) !== 0);
      out.push([`/${alias}/ carries the stable build's ${d}/ beside itself${absent.length ? ` (${absent.length} missing or wrong, e.g. ${alias}/${absent[0]})` : ''}`, absent.length === 0]);
    }
  }
  return out;
}

/** --check is red with no share image, and green once a WebP is there. */
function ogImagePlant() {
  const dir = mkdtempSync(join(tmpdir(), 'pages-site-og-'));
  try {
    writeFileSync(join(dir, 'builds.json'), JSON.stringify({ branches: [], otherPages: [] }));
    const saved = process.exitCode;
    process.exitCode = 0;
    const n0 = check(dir);
    const redWithout = process.exitCode === 1 && lastReds.length === 1 && lastReds[0].startsWith(`MISSING ${OG_IMAGE.sitePath}`);
    process.exitCode = 0;
    writeFileSync(join(dir, OG_IMAGE.sitePath), Buffer.from('RIFF\0\0\0\0WEBPVP8 '));
    const n = check(dir);
    const greenWith = process.exitCode !== 1 && n === n0 + 1;
    process.exitCode = saved || 0;
    // The fallback, on hand-written refs: main without the art defers to the
    // first other branch that has it, a missing branch is skipped, and none
    // at all is null — the case writeOgImage() reports instead of throwing.
    const holders = new Set(['origin/test', 'origin/dev']);
    const has = (r) => holders.has(r);
    return [
      ['the share image comes from main when main carries it', ogImageSource('origin/main', ['origin/dev'], () => true) === 'origin/main'],
      ['the share image falls back to the first other branch that carries it', ogImageSource('origin/main', [null, 'origin/release', 'origin/test', 'origin/dev'], has) === 'origin/test'],
      ['no branch carrying the share image is null, not a throw', ogImageSource('origin/main', ['origin/release'], has) === null],
      [`--check is red when /${OG_IMAGE.sitePath} is missing`, redWithout],
      [`--check passes /${OG_IMAGE.sitePath} once it is a WebP`, greenWith],
    ];
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/**
 * THE STORE'S KNOWN-BADS (step 6b), on a real pack-shaped build: dev's head,
 * rebuilt by the selftest above. It is published into a fixture site the way
 * assemble() publishes every build (publishBuild, the store, the worker, a
 * builds.json), --check must pass it whole, and then each plant, laid alone
 * and repaired before the next, must turn --check red BY ITS OWN NAME.
 */
const PACK_PLANTS = Object.freeze([
  ['a missing object', 'MISSING OBJECT', (dir, b) => {
    const index = JSON.parse(readFileSync(join(dir, packPinOf(readFileSync(join(dir, b.branch, String(b.ordinal), 'index.html'))).packs.light.index), 'utf8'));
    const [id, row] = Object.entries(index)[0];
    return [join(dir, objectPath(row[0], id))];
  }, 'remove'],
  ['a missing pack index', 'MISSING INDEX', (dir, b) => [join(dir, packPinOf(readFileSync(join(dir, b.branch, String(b.ordinal), 'index.html'))).packs.light.index)], 'remove'],
  ['a stale sw.js', 'STALE sw.js', (dir) => [join(dir, SW_FILE)], (file) => writeFileSync(file, serviceWorkerSource({ kill: false }).replace(/const VERSION = \d+;/, 'const VERSION = 0;'))],
  ['a missing download/ file', /^MISSING dev\/\d+\/download\/AshenSpire\.html:/, (dir, b) => [join(dir, b.branch, String(b.ordinal), DOWNLOAD_PATH)], 'remove'],
  ['a missing asset-base.json', /^MISSING dev\/\d+\/asset-base\.json:/, (dir, b) => [join(dir, b.branch, String(b.ordinal), ASSET_BASE_FILE)], 'remove'],
  // The in-game folder copy reads these two (step 7): a page hash or zip size
  // build.json records that the page and store do not give is red by name.
  ['a build.json pageSha256 that is not the page\'s', /^DOWNLOAD DRIFT dev\/\d+: /, (dir, b) => [join(dir, b.branch, String(b.ordinal), 'build.json')],
    (file) => { const j = JSON.parse(readFileSync(file, 'utf8')); j.pageSha256 = '0'.repeat(64); writeFileSync(file, JSON.stringify(j)); }],
  ['a build.json zipBytes that is not the zip\'s', /^DOWNLOAD DRIFT dev\/\d+: /, (dir, b) => [join(dir, b.branch, String(b.ordinal), 'build.json')],
    (file) => { const j = JSON.parse(readFileSync(file, 'utf8')); j.zipBytes += 1; writeFileSync(file, JSON.stringify(j)); }],
  ['an unreferenced object', 'UNREFERENCED', (dir) => [join(dir, 'objects', '00', `${'0'.repeat(64)}.webp`)], (file) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, 'stray'); }],
]);
function packStorePlants(probe, box, good) {
  const rows = [];
  if (good.error || !good.web) {
    rows.push([`dev's head rebuilds as a pack-shaped web edition, so the store plants can arm${good.error ? ` (${good.error})` : ''}`, false]);
    return rows;
  }
  const dir = mkdtempSync(join(tmpdir(), 'pages-site-store-'));
  try {
    const b = { branch: 'dev', ordinal: probe.ordinal, sha: probe.sha, digest: String(box.digest), built: String(box.built || ''), source: 'rebuild' };
    publishBuild(dir, b, good);
    writeFileSync(join(dir, OG_IMAGE.sitePath), Buffer.from('RIFF\0\0\0\0WEBPVP8 '));
    const serviceWorker = { ...writeServiceWorker(dir, { kill: false }), version: SW_VERSION };
    writeFileSync(join(dir, 'builds.json'), JSON.stringify({ otherPages: [], serviceWorker, branches: [{ branch: 'dev', builds: [b] }] }));
    const saved = process.exitCode;
    process.exitCode = 0;
    const clean = check(dir);
    const greenClean = process.exitCode !== 1;
    rows.push([`a pack-shaped dev/${b.ordinal} published into the store passes --check whole (${clean} checks${greenClean ? '' : `; red: ${lastReds.join(' | ')}`})`, greenClean && b.shape === 'pack' && existsSync(join(dir, 'objects')) && existsSync(join(dir, b.branch, String(b.ordinal), DOWNLOAD_PATH))]);
    for (const [name, want, targets, act] of PACK_PLANTS) {
      const files = targets(dir, b);
      const kept = files.map((f) => (existsSync(f) ? readFileSync(f) : null));
      for (const f of files) {
        if (act === 'remove') rmSync(f, { force: true });
        else act(f);
      }
      process.exitCode = 0;
      check(dir);
      const named = (r) => (want instanceof RegExp ? want.test(r) : r.startsWith(want));
      const caught = process.exitCode === 1 && lastReds.length > 0 && lastReds.every(named);
      rows.push([`--check is red by name for ${name} (${want})${caught ? '' : `; got: ${lastReds.join(' | ') || 'green'}`}`, caught]);
      files.forEach((f, i) => { if (kept[i]) writeFileSync(f, kept[i]); else rmSync(f, { force: true }); });
    }
    process.exitCode = 0;
    check(dir);
    rows.push(['the repaired store passes --check again', process.exitCode !== 1]);
    process.exitCode = saved || 0;
  } finally { rmSync(dir, { recursive: true, force: true }); }
  return rows;
}

function boundary() {
  console.log(`BOUNDARY: this proves each committed build served is byte-identical to its git blob, each rebuilt one carries the source digest its commit's buildordinal.json names and left the committed box unmoved, and every index links every build it lists. It does not prove a build boots, and lists only the newest ${KEEP} builds per branch — older ordinals are in git, not on this site.`);
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
    // Any served build will do; with none served (every committed build
    // purged, nothing rebuilt) a synthetic one stands in, said by name.
    let victim = branchData.find((d) => d.builds[0]);
    const synthetic = victim ? null : syntheticVictim(dir);
    if (synthetic) { victim = synthetic; console.log(`  note: no build served — the drift plant uses a synthetic ${synthetic.branch}/0`); }
    const f = join(dir, victim.branch, String(victim.builds[0].ordinal), 'index.html');
    const original = readFileSync(f);
    writeFileSync(f, Buffer.concat([original, Buffer.from('\n<!-- planted -->\n')]));
    // Two checks per served edition: metadata, then bytes. The planted drift
    // takes the victim's two FULL checks and leaves its mobile pair standing.
    const pages = branchData.reduce((n, d) => n + d.builds.reduce((m, b) => m + 2 + (b.mobileBytes ? 2 : 0), 0), 0) + (synthetic ? 2 : 0);
    const discovered = JSON.parse(readFileSync(join(dir, 'builds.json'), 'utf8')).otherPages || [];
    // The og:image row: always one check. A missing image is not discounted
    // here; baseTreeFindings names it and check() turns red.
    const ogRow = 1;
    const baseTree = baseTreeFindings(dir);
    const before = process.exitCode;
    const ok = check(dir);
    // Caught BY NAME: the victim's drift is red, and every red is the
    // victim's (its bytes, and the metadata that no longer matches them). The
    // count is the rest of the proof: every other check still passed.
    const victimName = `${victim.branch}/${victim.builds[0].ordinal}`;
    const caught = process.exitCode === 1 && lastReds.some((r) => r.startsWith(`DRIFT ${victimName}:`))
      && lastReds.every((r) => r.startsWith(`DRIFT ${victimName}:`) || r.startsWith(`DOWNLOAD DRIFT ${victimName}:`))
      && ok >= pages - 2 + discovered.length + ogRow;
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
      writeFileSync(f, original);
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
    // THE TWO RULES CODEX CAUGHT ON #1360, each checked against a hand-written
    // answer: an unfetchable mobile object is an error, not "predates"; and a
    // head whose committed build was skipped gets no /latest/.
    const rules = [
      ...baseTree,
      ...ogImagePlant(),
      ['a tracked mobile file that cannot be fetched skips the build', Boolean(committedEditions(Buffer.from('x'), true, () => null).error)],
      ['a commit with no mobile file serves the full one alone', committedEditions(Buffer.from('x'), false, () => { throw new Error('probed'); }).mobile === null],
      ['a committed head whose build was skipped gets no /latest/', isCurrent({ builds: [{ ordinal: 5 }], headTracksBuild: true, headOrdinal: 6 }) === false],
      ['a committed head whose build is served gets /latest/', isCurrent({ builds: [{ ordinal: 6 }], headTracksBuild: true, headOrdinal: 6 }) === true],
      ['a rebuilt head gets /latest/', isCurrent({ builds: [{ ordinal: 7 }], headTracksBuild: false, headOrdinal: 7 }) === true],
      ['dev and test must serve their head build; release and main need not', HEAD_REQUIRED.has('dev') && HEAD_REQUIRED.has('test') && !HEAD_REQUIRED.has('release') && !HEAD_REQUIRED.has('main')],
    ];
    {
      const row = { branch: 'test', ordinal: 5, sha: 'f'.repeat(40), digest: 'd', built: '2026-09-27', version: '0.7.1', bytes: 1, source: 'rebuild', edition: 'light' };
      rules.push(['a table whose branch is not current marks no build latest', !rowsTable([row], '', new Set()).includes('(latest)')]);
      rules.push(['a table whose branch is current marks its newest build latest', rowsTable([row], '', new Set([row])).includes('(latest)')]);
      rules.push(['a branch with no served build is never current', isCurrent({ builds: [], headTracksBuild: true, headOrdinal: 3 }) === false && isCurrent({ builds: [], headTracksBuild: true, headOrdinal: null }) === false]);
      rules.push(['a committed head whose object is unavailable is not called uncommitted', uncommittedNote('release', false, true).includes('could not be fetched') && !uncommittedNote('release', false, true).includes('not committed')]);
      rules.push(['a head with no committed build is called uncommitted', uncommittedNote('dev', false, false).includes('not committed')]);
      rules.push(['a rebuild that wrote a mobile twin is the full edition, whatever tier was asked', rebuiltEdition(false, true) === 'full' && rebuiltEdition(false, false) === 'light' && rebuiltEdition(true, false) === 'full']);
      {
        // A light CURRENT build on a non-dev branch, through the real root index
        // and its own download assertions: no mobile link offered, none required.
        const lightTest = { ...row, branch: 'test', mobileBytes: undefined };
        const fullOld = { ...row, branch: 'test', ordinal: 4, edition: 'full', mobileBytes: 2 };
        const html = rootIndex([{ branch: 'test', builds: [lightTest, fullOld], headTracksBuild: false, headOrdinal: 5 }], 'now', []);
        const offersMobileForFull = html.includes(`href="${downloadHref('', fullOld, 'mobile')}" download="`);
        const offersMobileForLight = html.includes(`href="${downloadHref('', lightTest, 'mobile')}"`);
        rules.push(['a light current build on test needs no mobile link, and a full one still offers it', offersMobileForFull && !offersMobileForLight && html.includes('(latest)')]);
      }
      rules.push(['a light build is not labelled full, nor as predating mobile', !downloadButtons('', row, '').includes('full') && !rowsTable([row], '').includes('predates')]);
    }
    // AFTER THE PURGE (Codex, #1360): every committed build reads as a 404.
    // Assembly must still pass, name each build it skipped, and the drift
    // plant must still find a victim (the synthetic one) and catch it.
    {
      const pdir = mkdtempSync(join(tmpdir(), 'pages-site-purged-'));
      SIMULATE_PURGE = true;
      let assembled = false; let allSkipped = false; let plantCaught = false;
      try {
        const r = assemble(pdir, 1);
        assembled = true;
        allSkipped = r.branchData.every((d) => d.builds.length === 0) && skippedBuilds.length > 0 && skippedBuilds.every((x) => /LFS object unavailable/.test(x.reason));
        const v = syntheticVictim(pdir);
        const vf = join(pdir, v.branch, '0', 'index.html');
        writeFileSync(vf, Buffer.concat([v.bytes, Buffer.from('<!-- planted -->')]));
        const saved = process.exitCode;
        check(pdir);
        plantCaught = process.exitCode === 1;
        process.exitCode = saved || 0;
      } catch (error) {
        console.error(`  purge simulation threw: ${error.message}`);
      } finally {
        SIMULATE_PURGE = false;
        rmSync(pdir, { recursive: true, force: true });
      }
      rules.push(['with every committed build purged, the site still assembles', assembled]);
      rules.push(['with every committed build purged, each is skipped by name', allSkipped]);
      rules.push(['with every committed build purged, the drift plant still catches a synthetic victim', plantCaught]);
    }
    // THE REBUILD PATH'S OWN KNOWN-BADS (review of #1360), on one real light
    // rebuild of dev's head (~20 s): the good rebuild serves; the same bytes
    // against a digest their commit does not name are refused; a rebuild that
    // cannot run is an error; and that error on dev's head build turns the run
    // red while the same error on an older build does not. dev's head, not
    // HEAD: this runs on pushes to main too, whose old tree is not dev's shape.
    let packPlants = [];
    const rbDir = mkdtempSync(join(tmpdir(), 'pages-site-rebuild-'));
    const savedBuildMissing = BUILD_MISSING;
    BUILD_MISSING = rbDir;
    try {
      const devRef = refFor('dev') || 'HEAD';
      const headSha = git(['rev-parse', devRef]).trim();
      const box = JSON.parse(git(['show', `${headSha}:buildordinal.json`]));
      const probe = { branch: 'dev', ordinal: Number(box.ordinal), sha: headSha, source: 'rebuild' };
      const good = artifactsOf({ ...probe, digest: String(box.digest) });
      rules.push([`a rebuild of dev's head ${headSha.slice(0, 10)} serves${good.error ? ` (${good.error})` : ''}`, !good.error && good.html.includes(String(box.digest))]);
      packPlants = packStorePlants(probe, box, good);
      const wrong = artifactsOf({ ...probe, digest: `not-a-digest-${process.pid}-planted` });
      rules.push(['a rebuild that lacks its commit\'s source digest is refused', /does not carry src digest/.test(wrong.error || '')]);
      const broken = rebuildAt('0'.repeat(40), false);
      rules.push(['a rebuild that cannot run is an error', Boolean(broken.error)]);
      let headRed = false;
      try { enforceHead('dev', false, probe.ordinal, [{ branch: 'dev', ordinal: probe.ordinal, sha: headSha, reason: broken.error }]); } catch { headRed = true; }
      rules.push(['a failed rebuild of dev\'s head build turns the run red', headRed]);
      let olderRed = false;
      try { enforceHead('dev', false, probe.ordinal, [{ branch: 'dev', ordinal: probe.ordinal - 1, sha: headSha, reason: broken.error }]); } catch { olderRed = true; }
      rules.push(['a failed rebuild of an older dev build stays a warning', !olderRed]);
    } finally {
      dropBuildTree();
      rmSync(rbDir, { recursive: true, force: true });
      BUILD_MISSING = savedBuildMissing;
    }
    rules.push(...packPlants);
    for (const [name, ok] of rules) {
      if (ok) console.log(`OK ${name}`);
      else { console.error(`MISS ${name}`); process.exitCode = 1; }
    }
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
      const known = 2 + PACK_PLANTS.length;
      console.log(`pages-site selftest: OK — ${known} known-bads, ${known} caught`);
    }
  } else if (has('--check')) {
    const n = check(flag('--check', '_site'));
    if (!process.exitCode) console.log(`pages-site --check: OK — ${n} checks passed`);
  } else {
    const outDir = resolve(ROOT, flag('--out', '_site'));
    const { checks, branchData } = assemble(outDir, KEEP);
    for (const d of branchData) console.log(`  ${d.branch}: ${d.builds.length} build(s), latest ${d.builds[0] ? stampOf(d.builds[0]) : 'none'}`);
    // Named on its own line, above the verdict, so it cannot hide inside a green.
    if (missingBranches.length) console.log(`  MISSING: ${missingBranches.join(', ')} — no such branch on ${REMOTE}; assembled without it`);
    for (const s of skippedBuilds) console.log(`  SKIPPED ${s.branch}/${s.ordinal} (${s.sha.slice(0, 10)}): ${s.reason}`);
    console.log(`  ${sizeLine(outDir)}`);
    console.log(`pages-site: OK — ${checks} checks passed`);
  }
  boundary();
} catch (error) {
  boundary();
  console.error(`pages-site: FAILED — ${error.message}`);
  process.exitCode = 1;
}
