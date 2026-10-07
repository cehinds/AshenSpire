// tools/browser.mjs — THE ONE HOME FOR "START A BROWSER AND TAKE ITS PROFILE
// WITH YOU". Every tool that launches Chromium goes through here.
//
// WHY THIS FILE EXISTS (Law 0, and Law 1 clause 7 is its sharpest instance).
// Measured on this tree at b968e28: 37 tools under tools/ pass their own
// `--user-data-dir`, 36 of them mkdtemp it, and SIX MORE launch Chromium with
// no `--user-data-dir` at all. That is 43 homes for one act. The pile it made,
// measured 2026-08-17 with `/` at 89%: /tmp holding 22 GB across 3612 entries —
// 167 `creationbrief-*`, 23 `ttpersist-*`, and 2208 `/tmp/.org.chromium.Chromium.*`.
// Restarts killed two seats today. This is not tidiness; it is the thing that
// stops the next restart.
//
// THE TWO LEAKS ARE ONE LEAK, AND THAT IS A MEASUREMENT, NOT A JUDGEMENT.
// Probed at this ref, three runs, each in a private empty TMPDIR, counting what
// the run left behind by construction:
//
//   no --user-data-dir at all        -> 2 x /tmp/.org.chromium.Chromium.* stranded
//   --user-data-dir, TMPDIR default  -> profile removed, 1 x .org.chromium.* STRANDED
//   --user-data-dir, TMPDIR pinned
//     to the profile directory       -> NOTHING. Chrome's own scoped temp lands
//                                       INSIDE the profile and dies with it.
//
// So the 2208 directories are not a second lane. They are the same act missing
// the same home, and both halves close here: this launcher ALWAYS gives Chrome
// a private profile, and ALWAYS points the child's TMPDIR inside it.
//
// WHAT "REMOVED" MEANS HERE, AND WHY THE OLD ANSWER WAS NOT ONE.
//   * `child.kill()` is a signal, not a join. The previous best-in-tree cleanup
//     (creationbrief.mjs, patched 2026-08-17) waited on `exit` OR 3000 ms,
//     whichever came first, and on a loaded box the timer won: three of five
//     clean runs left a 1.1 MB PARTIAL still holding `SingletonLock`. Here the
//     join is real — SIGTERM, wait, SIGKILL, wait — and it has no short bound
//     that lets the removal start early.
//   * `try { rmSync(...) } catch { /* tmp */ }` is not a removal, it is a wish.
//     `rmSync` walks a tree Chrome may still be writing, the top-level rmdir
//     fails ENOTEMPTY, and the catch eats it. A PARTIAL REMOVAL REPORTS NOTHING.
//     Here the verdict is the POSTCONDITION — `existsSync(profile)` after the
//     call — never the absence of a throw, and a failure is printed BY NAME.
//   * Every early exit after the mkdtemp used to leak the whole ~11 MB profile:
//     no try/finally, no exit handler. Here the profile is registered before
//     the browser is spawned and swept by `exit`, SIGINT, SIGTERM, SIGHUP and
//     SIGQUIT. An interrupted run is the ORDINARY shape of the ones that made
//     the pile, not the exotic one.
//
// A JANITOR MAY NOT HOLD VERDICT POWER. A failed removal is printed loudly and
// does NOT change the caller's exit code — a screen check reports on the screen.
// Set `BROWSER_LEAK_STRICT=1` to make an unremoved profile exit 3; the selftest
// below runs that way, which is where this can go red.
//
// ATTRIBUTION: A SET DIFFERENCE OVER SHARED /tmp IS APPEARANCE, NOT ATTRIBUTION.
// Bjorn's finding, and it is why every number in this header came through a
// private TMPDIR: run two seats' tools in the same second and the diff reports
// the other seat's directory as yours. `mkdtemp` respects `os.tmpdir()`, so
// `TMPDIR=<short empty dir>` makes a leftover this run's BY CONSTRUCTION.
// Keep it SHORT — the profile holds `SingletonSocket`, a UNIX socket path is
// capped at 108 bytes, and an over-long TMPDIR means Chrome never comes up.
// `launchBrowser` refuses a profile path over PATH_BUDGET.
//
// AND THAT REFUSAL DOES NOT COVER THE BAND IT SAYS IT COVERS — measured by
// Bjorn gating this file, and the sentence is narrowed to the measurement
// rather than kept. It read "rather than handing you a browser that
// mysteriously does not start"; between 62 and 90 bytes it hands you exactly
// that. Ladder, `/opt/pw-browsers/chromium`, profile path built to an exact
// length, twice each, same door as every other number here:
//
//   pinTmp ON   58 / 60 / 61 -> LAUNCHED, wsUrl, removed
//   pinTmp ON   62 .. 90     -> Chrome dies SIGTRAP with no endpoint. LEGAL by
//                               the guard (<= 90), dead in fact, and the error
//                               names the BINARY, not the path.
//   pinTmp OFF  66 / 70      -> LAUNCHED. 80 / 90 -> SIGTRAP.
//
// So the real ceiling under the pin is 61, not 90, and the pin — the mechanism
// that closes the 2208 — is what costs the ~10 bytes: it puts Chrome's own
// scoped temp INSIDE the profile, and those paths are longer than
// `SingletonSocket`. With the longest prefix in tools/ (`arcane-exposure-visual-`,
// 23 bytes + 6 of mkdtemp + a slash) a WORKING TMPDIR is 31 bytes, not 83.
// `/home/user/AshenSpire-bjorn-g6` is 30. An ordinary seat setting TMPDIR to
// their own clone directory is one byte inside the cliff for that tool and over
// it for the next, and PATH_BUDGET is silent for all 29 bytes of the band.
// THE NUMBER IS THE PREDICATE AND THE PREDICATE IS VIRA'S — not narrowed here
// (MR-101), and no plant is left behind red on it. A card is owed: move the
// budget to the measured ceiling, or measure `SingletonSocket` and the pinned
// temp path separately and refuse on the longer one.
//
// SELFTEST: `node tools/browser.mjs --selftest` (needs CHROME). First S, the
// serve checks for `buildPageUrl`/`serveDir` (node only; `--serve-only` stops
// there and needs no browser). Then eight
// scenarios, each in its own private TMPDIR, each asserting the leftover SET.
// The control is a clean run leaving nothing; the plants are a throw after
// launch, SIGINT, SIGTERM, an early process.exit, a launch that never yields an
// endpoint, a removal made to fail, and — as the pair either side of the TMPDIR
// pin — one run with pinning ON (nothing left) and one with it OFF (a
// `.org.chromium.Chromium.*` left, named). A check born red is a check nobody
// keeps, so the removal was made whole first and the plants were watched after.
//
// WHAT THE EIGHT COULD NOT SEE, AND ONE OF THE TWO IS FIXED HERE (Bjorn):
//   * FIVE OF EIGHT PASSED AGAINST A LAUNCHER THAT LAUNCHED NOTHING. Watched:
//     `launchBrowser` replaced by a stub returning no profile and no child ->
//     5 PASS / 3 FAIL; the same five also passed when the import failed to
//     resolve at all. Every one of them asserted only `leftover: 'none'`, and an
//     empty directory is what you get either way. REPAIRED: each scenario that
//     expects a launch now asserts a receipt — a browser launched, with its
//     profile INSIDE that scenario's private TMPDIR, which is also what makes
//     the leftover count attributable. Re-watched, both edges: real launcher
//     8 PASS / 0 FAIL, the same stub 0 PASS / 8 FAIL where it used to be 5/3.
//   * THE GROUP KILL HAS NO PLANT — see signalGroup. Stripping it leaves the
//     suite green. Not repaired here: a plant for it would have to reproduce a
//     ~2.5%-per-run race, and a check that flakes is worse than a named gap.
//
// AND THE LAUNCHER CLOSES THE SOURCE IN THIS TREE ONLY — measured on this box
// while gating, 2026-08-17 07:21 UTC. Seven top-level Chromiums alive, all
// reparented to init: six hold PRE-MIGRATION profiles (`placement-*`,
// `creationbrief-*`, aged 3 h 09 m to 4 h 45 m, all older than this commit), and
// the seventh — pid 7245, no `--user-data-dir` at all, `--headless=new`,
// `--remote-debugging-port=9396` — is the OLD `profile-first-run.mjs` spawn line
// verbatim, from a checkout that has not taken this commit. Nothing in this tree
// can spawn that: every launch here passes `--user-data-dir` and `--no-first-run`.
// So the door is shut where it is installed and every unmigrated worktree on the
// box is still a source until it pulls. That is a fact about clones, not a defect
// in this file, and it is why the pile keeps growing after tonight.
//
// BOUNDARY. Linux, headless Chromium 141, one box. Nothing here is measured on
// Windows or macOS; `SIGKILL` and the socket budget are POSIX assumptions.
// This file owns the PROFILE, and, since step 8d of EXTERNAL-ASSETS-PLAN, the
// one helper that serves a built page (`buildPageUrl`, `serveDir`; see the
// block above the selftest). It does not own any other http server a caller
// starts, the CDP socket, or any sandbox tree a tool copies — those are the caller's,
// and this launcher is silent about them. It also does not own BROWSER
// RESOLUTION: `resolveBrowser()` is exported and is the single home available,
// but the tools' candidate lists genuinely differ (CHROME vs CHROME_PATH, four
// paths vs three), so migrating resolution is a second act and is not claimed.
//
// REMOVAL: deleted the day no family tool launches a browser, or the day the
// tools use a real browser-automation library that owns its own profile
// lifetime — at which point this is a second copy of that library's job.

import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// A UNIX socket path is capped at 108 bytes and Chrome puts `SingletonSocket`
// inside the profile. 90 leaves room for that name and for the mkdtemp suffix.
// MEASURED CEILING IS 61 WITH pinTmp ON, NOT 90 — see the header. This number
// is 29 bytes too generous and nothing watches either side of it; it is left as
// its author set it and named rather than moved.
export const PATH_BUDGET = 90;

// Automated browsers are invisible; their audio should be invisible too.
const DEFAULT_ARGS = ['--no-sandbox', '--disable-gpu', '--mute-audio', '--remote-debugging-port=0', '--no-first-run'];
const ENDPOINT = /DevTools listening on (ws:\/\/\S+)/;

// THE ENDPOINT WAIT HAS A FLOOR (FINISH §12, D35). About 30 tools pass
// `timeoutMs: 12000`, and on 2026-10-02 the 'map camera re-fit (real browser)'
// job of #1435 and #1436 failed twice with "no DevTools endpoint ... in
// 12000 ms" — that job's own `chrome --version` step took 7 s, so a cold Chrome
// start on a GitHub runner can exceed 12 s. The fix is here, once: the wait for
// the endpoint is max(caller's timeoutMs, floor). A slow cold start is waited
// out; a DEAD browser still fails fast, because the exit/error handlers below
// settle the wait the moment the process goes, whatever the budget. The floor
// is data, not a literal in each tool (D1): ASHEN_BROWSER_LAUNCH_MS overrides it
// (a non-negative integer in ms; 0 turns it off; anything else is ignored).
// A value above Node's timer ceiling (2^31-1 ms, about 24.8 days) is ignored
// too: setTimeout would clamp it to 1 ms and fail every slow launch at once.
export const LAUNCH_FLOOR_MS = 30000;
export const TIMER_MAX_MS = 2147483647;
export const LAUNCH_FLOOR_ENV = 'ASHEN_BROWSER_LAUNCH_MS';
export function launchFloorMs(env = process.env) {
  const raw = env[LAUNCH_FLOOR_ENV];
  if (raw === undefined || !/^\d+$/.test(String(raw).trim())) return LAUNCH_FLOOR_MS;
  const n = Number(String(raw).trim());
  return Number.isSafeInteger(n) && n <= TIMER_MAX_MS ? n : LAUNCH_FLOOR_MS;
}
export function effectiveLaunchMs(timeoutMs, env = process.env) {
  return Math.max(Number(timeoutMs) || 0, launchFloorMs(env));
}

// Every live profile this process owns. The sweep at exit reads this set, so a
// profile is registered BEFORE the browser is spawned — the window between
// mkdtemp and spawn is small and it is not zero.
const live = new Set();
let guardsInstalled = false;
let leaked = [];

/** Synchronous sleep. The exit sweep cannot await, and a busy loop burns a core. */
function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch { /* no SAB: spin-free fallback */ }
}

/** What is still inside a directory we failed to remove — the report, not a guess. */
function residue(dir) {
  try { return readdirSync(dir).slice(0, 8); } catch { return []; }
}

/**
 * Remove a tree and RETURN WHETHER IT IS GONE. The verdict is `existsSync`
 * after the fact, never "rmSync did not throw": a partial removal throws
 * ENOTEMPTY at the top-level rmdir and leaves the tree, and that is exactly the
 * case a swallowed catch reports as success.
 */
export function removeTree(dir, { attempts = 12, delayMs = 60, settleMs = 250 } = {}) {
  if (!dir) return { removed: true, attempts: 0 };
  let last = null;
  for (let i = 1; i <= attempts; i++) {
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); } catch (e) { last = e; }
    if (!existsSync(dir)) {
      // GONE IS NOT STAYED GONE. Measured: a surviving Chrome child recreated
      // `Default/` after a removal that had already verified the tree was
      // absent, and the old verdict — one `existsSync` at one instant — called
      // that a success and exited 0. Settle, look again, and if it came back,
      // remove it again and SAY SO. A silent partial is the whole defect.
      sleepSync(settleMs);
      if (!existsSync(dir)) return { removed: true, attempts: i };
      try { rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); } catch (e) { last = e; }
      if (!existsSync(dir)) return { removed: true, attempts: i, reappeared: true };
      last = last || new Error('PROFILE REAPPEARED after removal — a live browser child is still writing');
    }
    if (!last) last = new Error('ENOTEMPTY: rmSync returned and the directory is still there');
    sleepSync(delayMs);
  }
  return { removed: false, attempts, error: last, residue: residue(dir) };
}

/**
 * SIGNAL THE WHOLE PROCESS GROUP, NOT THE BROWSER PROCESS.
 *
 * THE WORD WAS "DETERMINISTIC" AND IT IS NARROWED, BY COUNTING (Bjorn, gating
 * this file — and I prescribed this mechanism before it was measured, so scoring
 * it is scoring my own prescription and the reader should weigh it that way).
 * Re-derived here: this launcher is 96/96 clean at 12-way concurrency (36 + 60,
 * private TMPDIR per run) and the selftest is 8/8 three times. But a 2x2 over
 * the two mechanisms this file credits — the group signal, and removeTree's
 * settle-and-recheck — cannot tell them apart, and cannot license the word:
 *
 *   both (as shipped)          60/60 clean
 *   group signal stripped      60/60 clean   <- and --selftest still 8 PASS / 0 FAIL
 *   settle/recheck stripped    60/60 clean
 *   NEITHER (~the first cut)   57/60 — three profiles left with close()
 *                              reporting removed=true and exit 0. The silent
 *                              partial, reproduced. Then 60/60 on the RE-RUN of
 *                              the same mutant.
 *
 * So: the defect is real and watched; the fix is right; and the population that
 * could contradict "deterministic" fails at ~3/120 with a re-run of ZERO. At
 * that rate 44 clean runs — the evidence this shipped on — would be expected
 * about a third of the time FROM THE BROKEN SHAPE. What is licensed is the
 * count, not the word, and NEITHER mechanism alone failed in 60 trials: which of
 * the two did the work is `unknown` and needs a denominator nobody has spent.
 * The 0/8 comparator is a different and larger claim — that shape had no exit
 * guard, no real join, a swallowed catch AND no TMPDIR pin, and the pin alone
 * strands a `.org.chromium.Chromium.*` on EVERY run (P7). 0/8 measures the pin.
 *
 * With `child.kill()` alone — the shape every tool in
 * this tree uses — ten concurrent runs left ONE profile behind, 16 KB holding a
 * fresh `Default/`, and `close()` reported SUCCESS and exited 0. `existsSync`
 * was false when it was asked: the tree really was gone, and then an ORPHANED
 * RENDERER RECREATED IT. Chrome's children are not `child`; killing the browser
 * leaves them writing. So the launcher spawns `detached: true` (the child
 * becomes a group leader) and signals `-pid`, which reaches every one of them.
 *
 * A consequence, stated because it changes behaviour: a detached child no
 * longer receives the terminal's Ctrl-C on its own. The SIGINT handler below
 * kills the group explicitly, so the coverage is the same and it is now
 * deterministic instead of incidental.
 */
function signalGroup(child, sig) {
  if (!child || !child.pid) return;
  try { process.kill(-child.pid, sig); return; } catch { /* no group, or already gone */ }
  try { child.kill(sig); } catch { /* already reaped */ }
}

async function endProcess(child, { termMs = 5000, killMs = 3000 } = {}) {
  if (!child) return 'none';
  const gone = () => child.exitCode !== null || child.signalCode !== null;
  const waitExit = (ms) => new Promise((res) => {
    if (gone()) { res(true); return; }
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; res(false); } }, ms);
    child.once('exit', () => { if (!done) { done = true; clearTimeout(t); res(true); } });
  });
  let how = 'already-exited';
  if (!gone()) {
    signalGroup(child, 'SIGTERM');
    how = (await waitExit(termMs)) ? 'sigterm' : null;
    if (how === null) { signalGroup(child, 'SIGKILL'); how = (await waitExit(killMs)) ? 'sigkill' : 'unreaped'; }
  }
  // The browser is reaped; its children may not be. SIGKILL the group again —
  // idempotent, and this is the sweep that stops the recreation above.
  signalGroup(child, 'SIGKILL');
  return how;
}

function report(entry, r) {
  leaked.push({ profile: entry.profile, ...r });
  console.error(`browser: PROFILE NOT REMOVED — ${entry.profile} — `
    + `${(r.error && r.error.message) || 'still present'} — after ${r.attempts} attempt(s), `
    + `${r.residue && r.residue.length ? `${r.residue.length}+ entr(ies) left: ${r.residue.join(', ')}` : 'empty but undeletable'}`);
  if (process.env.BROWSER_LEAK_STRICT === '1') process.exitCode = 3;
}

/** The synchronous last resort. Runs inside `exit` and inside a signal handler. */
function hardSweep(entry) {
  if (!live.has(entry)) return;
  live.delete(entry);
  signalGroup(entry.child, 'SIGKILL');
  // The kernel needs a moment to tear the group down before its files stop
  // moving. This is the one place a synchronous wait is the only option.
  if (entry.child) sleepSync(250);
  const r = removeTree(entry.profile);
  if (!r.removed) report(entry, r);
}

function installGuards() {
  if (guardsInstalled) return;
  guardsInstalled = true;
  const sweepAll = () => { for (const e of [...live]) hardSweep(e); };
  process.on('exit', sweepAll);
  // A default SIGINT/SIGTERM does NOT run `exit` handlers — the process dies
  // where it stands and the profile stays. That is the interrupted run, and it
  // is the ordinary shape of the ones in the pile.
  const codes = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129, SIGQUIT: 131 };
  for (const sig of Object.keys(codes)) {
    process.on(sig, () => { sweepAll(); process.exit(codes[sig]); });
  }
}

/** Profiles this process failed to remove. A caller or CI may assert on it. */
export function leaks() { return leaked.slice(); }

/**
 * The candidate list this house uses. Exported as the single home; NOT forced
 * on callers in this act — see the boundary in the header.
 */
export function resolveBrowser(extra = []) {
  const candidates = [process.env.CHROME, process.env.CHROME_PATH, ...extra,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
  return candidates.find((p) => { try { return existsSync(p) && statSync(p).isFile(); } catch { return false; } })
    || candidates.find((p) => existsSync(p)) || null;
}

/**
 * Launch Chromium on a private, self-removing profile.
 *
 *   const { child, wsUrl, profile, close } = await launchBrowser({ prefix: 'mapfit-', browser });
 *   try { ... } finally { await close(); }
 *
 * `close()` is idempotent and returns `{ removed, attempts, ... }`.
 * Whatever happens — a normal return, a thrown error, `process.exit`, SIGINT,
 * SIGTERM — the profile goes. That is the whole contract of this file.
 */
export async function launchBrowser({
  prefix = 'browser-',
  browser = null,
  args = [],
  headless = '--headless',
  timeoutMs = 15000,
  pinTmp = true,
  stdio = ['ignore', 'pipe', 'pipe'],
  // NOT EVERY BROWSER IN THIS TREE IS DRIVEN OVER A PRINTED ENDPOINT, and
  // pretending otherwise would have left those tools with their own copy of the
  // launch. Three real shapes need `awaitEndpoint: false`:
  //   * one-shot `--screenshot=` (screenshot.mjs) never prints an endpoint;
  //   * fixed-port drivers that poll `/json/list` instead of reading stderr;
  //   * shotguard-probe's SIMULATE mode, which deliberately runs a process that
  //     never announces a port so the probe's unavailable path can be watched.
  // With it off, `wsUrl` is null and everything else — the private profile, the
  // TMPDIR pin, the join, the removal, the guards — is identical.
  awaitEndpoint = true,
  // Extra arguments that must come AFTER the url/one-shot flags, for the
  // one-shot form where the url is the last positional argument.
  urlArg = null,
} = {}) {
  const bin = browser || resolveBrowser();
  if (!bin) throw new Error('browser: no Chrome/Chromium found — set CHROME=/path/to/chrome');

  installGuards();

  const profile = mkdtempSync(join(tmpdir(), prefix));
  const entry = { profile, child: null };
  live.add(entry);

  // Fail by NAME rather than handing back a browser that never comes up: over
  // the budget, Chrome cannot bind SingletonSocket and prints nothing useful.
  if (profile.length > PATH_BUDGET) {
    hardSweep(entry);
    throw new Error(`browser: TMPDIR is too long for a Chrome profile — `
      + `${profile.length} > ${PATH_BUDGET} bytes at ${profile}. A UNIX socket path caps at 108; `
      + `use a SHORT TMPDIR (e.g. TMPDIR=/tmp/v).`);
  }

  const base = awaitEndpoint ? DEFAULT_ARGS : DEFAULT_ARGS.filter((a) => a !== '--remote-debugging-port=0');
  const argv = [headless, ...base, `--user-data-dir=${profile}`, ...args];
  // Edge's Windows compatibility relaunch detaches the real browser from
  // these pipes and exits before reporting its debugging endpoint.
  if (process.platform === 'win32' && /(?:^|[\\/])msedge\.exe$/i.test(bin)) {
    argv.push('--edge-skip-compat-layer-relaunch');
  }
  if (urlArg) argv.push(urlArg);
  else if (!argv.some((a) => a === 'about:blank' || /^https?:/.test(a) || /^file:/.test(a))) argv.push('about:blank');

  // TMPDIR pinned INSIDE the profile: Chrome's own scoped temp
  // (`.org.chromium.Chromium.*`) then lands where the profile's removal reaches
  // it. Measured — see the header. This is the half that closes the 2208.
  const env = { ...process.env };
  if (pinTmp) { env.TMPDIR = profile; env.TMP = profile; env.TEMP = profile; }

  let child;
  try {
    // `detached: true` makes the child a PROCESS GROUP LEADER so `-pid` reaches
    // its renderers and zygote. See signalGroup — the mechanism is reasoned and
    // right; the claim that it is "the difference between 9-of-10 and 10-of-10"
    // is NOT what was measured, and the 2x2 in signalGroup's note says so:
    // stripping it left 60/60 clean and the selftest 8/8. Nothing here defends
    // it, so a hand that deletes it gets a green suite.
    child = spawn(bin, argv, { stdio, env, detached: true });
  } catch (e) {
    hardSweep(entry);
    throw e;
  }
  entry.child = child;

  let closed = false;
  const close = async () => {
    if (closed) return entry.result || { removed: true, attempts: 0 };
    closed = true;
    await endProcess(child);
    const r = removeTree(profile);
    entry.result = r;
    // DEREGISTER ONLY ONCE THE PROFILE IS ACTUALLY GONE. A caller may fire
    // `close()` without awaiting it — several do, from a synchronous teardown
    // arrow — and if the entry left `live` at the TOP of this function, a
    // `process.exit` racing the await would leave nothing to sweep. Late
    // deregistration makes the guard a backstop instead of a handoff.
    if (r.removed) live.delete(entry);
    else report(entry, r);
    return r;
  };

  if (!awaitEndpoint) return { child, wsUrl: null, profile, close };

  const waitMs = effectiveLaunchMs(timeoutMs);
  try {
    const wsUrl = await new Promise((res, rej) => {
      let buf = '';
      let settled = false;
      const on = (d) => {
        buf += d;
        const m = ENDPOINT.exec(buf);
        if (m && !settled) { settled = true; clearTimeout(timer); res(m[1]); }
      };
      if (child.stderr) child.stderr.on('data', on);
      if (child.stdout) child.stdout.on('data', on);
      child.on('error', (e) => { if (!settled) { settled = true; clearTimeout(timer); rej(e); } });
      child.on('exit', (code, sig) => {
        if (!settled) {
          settled = true; clearTimeout(timer);
          rej(new Error(`browser: ${bin} exited (code ${code}, signal ${sig}) before printing a DevTools endpoint:\n${buf.slice(-300)}`));
        }
      });
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          const why = waitMs === timeoutMs ? '' : ` (caller asked ${timeoutMs} ms; launch floor ${waitMs} ms, ${LAUNCH_FLOOR_ENV} to change)`;
          rej(new Error(`browser: no DevTools endpoint from ${bin} in ${waitMs} ms${why}:\n${buf.slice(-300)}`));
        }
      }, waitMs);
    });
    return { child, wsUrl, profile, close };
  } catch (e) {
    // THE LAUNCH THREW AND THE PROFILE STILL GOES. This is the path that leaked
    // ~11 MB every time `CHROME=/bin/true` was watched.
    await close();
    throw e;
  }
}

// ---------------------------------------------------------------------------
// OPENING A BUILT PAGE — `buildPageUrl()` and `serveDir()`
// (docs/EXTERNAL-ASSETS-PLAN.md section 6, the `--dist` row; step 8d).
//
// Every tool that drives a built page (`dist/AshenSpire.html`,
// `build/AshenSpire.html`, the root copy) asks here for the URL to open,
// instead of writing `pathToFileURL(file).href` itself.
//
//   * A SELF-CONTAINED single file (today's inline builds, and the light single
//     file the plan keeps) opens exactly as before: the answer IS
//     `pathToFileURL(file).href`, byte for byte. Nothing those tools measure
//     moves.
//   * A PACK-SHAPED build (the HTML carries a non-empty `ASSET_PACKS` pin,
//     written from step 3a on) is served over local http from the HTML's own folder, because its
//     indexes and objects arrive by `fetch`, which Chrome blocks under
//     `file://`. The `.js` twins of step 4 make `file://` play too, but a tool
//     measuring the game should see the loader's primary path.
//
// `ASHEN_BUILD_OVER=file|http|auto` (default `auto`) overrides the choice for a
// run: `file` keeps the double-click door under every tool, `http` serves even
// an inline file. The server is `unref()`ed, so it never keeps a tool alive,
// and it serves only files whose REAL path is under the folder it was given.
// The folder is served under `/<channel>/latest/`, the channel the same file
// reads by double-click (`unknown` for `dist/AshenSpire.html`), so the page's
// channel and debug state do not turn into the loopback host's `dev`.
//
// BOUNDARY. A static GET/HEAD server for local tools, bound to 127.0.0.1. It
// streams bodies, answers one byte range (`206`) for media, sends no body for
// HEAD, sends `no-cache`, and lists no directories. Under http a page still
// differs from `file://` where the game asks the protocol itself (the shipped
// score loads over http only; under `file://` the indexes come from their `.js`
// twins and the faces from the font sidecar, step 4): that is the reason to
// serve a pack build. It is not the dev server (`tools/serve.mjs` stamps the source
// tree and carries LAN play) and not the Pages service worker.

const SERVE_MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

// The pin tools/bundle.mjs stamps into a pack-shaped HTML (verify-external reads
// the same shape). A single file carries `const ASSET_PACKS = null;`.
const PACK_PIN = /const ASSET_PACKS = (\{.*?\});\n/;

/**
 * True when the HTML is pack-shaped: it carries a non-empty `ASSET_PACKS` pin.
 * The HTML says so itself, so a stale `packs/` folder beside an inline file
 * does not count, and a pinned build whose folder is missing still does (it is
 * served, and its loader fails the way a hosted page would).
 */
export function isPackShaped(htmlPath) {
  let text;
  try { text = readFileSync(resolve(htmlPath), 'utf8'); } catch { return false; }
  const m = PACK_PIN.exec(text);
  if (!m) return false;
  try {
    const pin = JSON.parse(m[1]);
    return !!(pin && pin.packs && typeof pin.packs === 'object' && Object.keys(pin.packs).length);
  } catch { return false; }
}

/**
 * Serve `dir` over http on 127.0.0.1 (an ephemeral port unless `port` is given).
 * Resolves `{ server, port, origin, url(rel), close() }`; `url('a/b.html')` is
 * the http URL of `dir/a/b.html`. With `prefix` (e.g. `unknown/latest`) every
 * file is served under `/<prefix>/` and nothing outside it answers. The server
 * is unref()ed.
 *
 * CONTAINMENT IS CHECKED ON REAL PATHS: the root and every candidate are
 * realpath()ed first, so a symlink inside the folder that points outside it is
 * refused (403), not followed. A body is streamed, never buffered whole: a
 * Range request reads only its interval, and HEAD sends headers only.
 */
export function serveDir(dir, { port = 0, host = '127.0.0.1', prefix = '' } = {}) {
  const mount = prefix ? `/${String(prefix).replace(/^\/+|\/+$/g, '')}` : '';
  // `.native`, like the async realpath() each candidate gets below: the JS
  // realpathSync keeps a Windows 8.3 name (the runner's TMP is
  // C:\Users\RUNNER~1\...) where the native one expands it, and a root in one
  // spelling never contains a file in the other — every real file was a 403.
  const rootReal = realpathSync.native(resolve(dir));
  const inside = (p) => p === rootReal || p.startsWith(rootReal.endsWith(sep) ? rootReal : rootReal + sep);
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
      let rel;
      try { rel = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname); } catch { res.writeHead(400); res.end(); return; }
      if (mount) {
        if (rel === mount) { res.writeHead(301, { Location: `${mount}/` }); res.end(); return; }
        if (!rel.startsWith(`${mount}/`)) { res.writeHead(404); res.end('Not found'); return; }
        rel = rel.slice(mount.length) || '/';
      }
      let file = resolve(rootReal, `.${rel}`);
      if (!inside(file)) { res.writeHead(403); res.end('Forbidden'); return; }
      let st = await stat(file).catch(() => null);
      if (st && st.isDirectory()) {
        // A folder named without its slash: send the browser to the slash, so
        // the page's relative URLs resolve inside it.
        if (!rel.endsWith('/')) {
          const q = (req.url || '').indexOf('?');
          res.writeHead(301, { Location: `${(q < 0 ? req.url : req.url.slice(0, q))}/${q < 0 ? '' : req.url.slice(q)}` }); res.end(); return;
        }
        file = join(file, 'index.html'); st = await stat(file).catch(() => null);
      }
      if (!st || !st.isFile()) { res.writeHead(404); res.end('Not found'); return; }
      const real = await realpath(file).catch(() => null);
      if (!real || !inside(real)) { res.writeHead(403); res.end('Forbidden'); return; }
      const size = st.size;
      const headers = { 'Content-Type': SERVE_MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };
      const send = (status, extra, from, to) => {
        res.writeHead(status, { ...headers, ...extra });
        if (req.method === 'HEAD' || to < from) { res.end(); return; }
        const stream = createReadStream(real, { start: from, end: to });
        stream.on('error', () => res.destroy());
        stream.pipe(res);
      };
      // One range. A syntactically invalid one (`bytes=5-3`) is ignored and the
      // whole body answers 200 (RFC 9110 14.2); one that starts past the end,
      // or an empty suffix, is unsatisfiable: 416.
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      const invalid = range && range[1] && range[2] && Number(range[2]) < Number(range[1]);
      if (range && (range[1] || range[2]) && !invalid) {
        const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
        const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
        if (start >= size || start > end || (!range[1] && Number(range[2]) === 0)) {
          res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` }); res.end(); return;
        }
        send(206, { 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 }, start, end);
        return;
      }
      send(200, { 'Content-Length': size }, 0, size - 1);
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  return new Promise((done, fail) => {
    server.once('error', fail);
    // Neither the server nor a kept-alive connection may hold a tool open.
    server.on('connection', (socket) => socket.unref());
    server.listen(port, host, () => {
      server.unref();
      const p = server.address().port;
      const origin = `http://${host}:${p}`;
      const url = (rel = '') => `${origin}${mount}/${String(rel).split(/[\\/]/).map(encodeURIComponent).join('/')}`;
      done({ server, port: p, origin, url, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

// One server per folder and channel per process: two pages of one build share it.
const served = new Map();

/**
 * The channel `src/ui/buildChannel.js` reads for this file opened by
 * double-click: `dev`/`test`/`release`/`main` from a download's name
 * (`AshenSpire-dev-0.7.1.449.html`), otherwise `unknown`.
 */
export async function fileChannel(htmlPath) {
  const { buildChannel } = await import('../src/ui/buildChannel.js');
  const u = pathToFileURL(resolve(htmlPath));
  return buildChannel({ pathname: u.pathname, hostname: u.hostname, protocol: u.protocol }, 'standalone file');
}

/**
 * The URL a tool opens for a built page at `htmlPath`. See the block above:
 * `file://` for a self-contained file (unchanged), local http for a pack-shaped
 * build. `over` (or `ASHEN_BUILD_OVER`) forces `file` or `http`.
 *
 * THE SERVED PAGE KEEPS THE FILE'S CHANNEL. A page on 127.0.0.1 would read as
 * `dev` (pageDebug on, dev-promoted settings), while the same file by
 * double-click reads `unknown`. So the folder is served under
 * `/<channel>/latest/`, the Pages path shape `buildChannel()` reads before the
 * host, and the tool measures the configuration the file would have.
 */
export async function buildPageUrl(htmlPath, { over = process.env.ASHEN_BUILD_OVER || 'auto' } = {}) {
  const file = resolve(htmlPath);
  if (!['auto', 'file', 'http'].includes(over)) throw new Error(`browser: ASHEN_BUILD_OVER must be auto, file or http (got ${over})`);
  const http = over === 'http' || (over === 'auto' && isPackShaped(file));
  if (!http) return pathToFileURL(file).href;
  const dir = dirname(file);
  const prefix = `${await fileChannel(file)}/latest`;
  const key = `${dir}\0${prefix}`;
  if (!served.has(key)) served.set(key, serveDir(dir, { prefix }));
  return (await served.get(key)).url(basename(file));
}

// ---------------------------------------------------------------------------
// THE SELFTEST — every scenario in its own private TMPDIR, so the leftover set
// is this run's BY CONSTRUCTION rather than by a set difference over shared /tmp.
// ---------------------------------------------------------------------------

const SCENARIOS = [
  {
    name: 'C  control: a clean run',
    expect: 'the private TMPDIR is EMPTY afterwards',
    body: `const b = await launchBrowser({ prefix: 'st-', browser: BIN }); await b.close();`,
    leftover: 'none',
  },
  {
    name: 'P1 a throw after launch, no try/finally in the caller',
    expect: 'the guard removes the profile anyway',
    body: `await launchBrowser({ prefix: 'st-', browser: BIN }); throw new Error('planted: the caller blew up');`,
    leftover: 'none',
  },
  {
    name: 'P2 SIGINT mid-run',
    expect: 'the signal handler removes the profile before exiting 130',
    body: `await launchBrowser({ prefix: 'st-', browser: BIN }); process.kill(process.pid, 'SIGINT'); await new Promise((r) => setTimeout(r, 4000));`,
    leftover: 'none',
  },
  {
    name: 'P3 SIGTERM mid-run',
    expect: 'the signal handler removes the profile before exiting 143',
    body: `await launchBrowser({ prefix: 'st-', browser: BIN }); process.kill(process.pid, 'SIGTERM'); await new Promise((r) => setTimeout(r, 4000));`,
    leftover: 'none',
  },
  {
    name: 'P4 an early process.exit(1) right after launch',
    expect: 'the exit sweep removes the profile',
    body: `await launchBrowser({ prefix: 'st-', browser: BIN }); process.exit(1);`,
    leftover: 'none',
  },
  {
    name: 'P5 the browser never prints an endpoint (CHROME=/bin/true)',
    expect: 'launchBrowser throws AND the profile it made is gone',
    body: `try { await launchBrowser({ prefix: 'st-', browser: '/bin/true', timeoutMs: 4000 }); } catch (e) { console.log('THREW ' + e.message.split('\\n')[0]); }`,
    leftover: 'none',
    // The one scenario where NO launch is expected to succeed: the profile is
    // made and the launch then throws, so the LAUNCHED receipt below never
    // prints and must not be required.
    launches: false,
    mustSay: /THREW browser: \/bin\/true exited/,
  },
  {
    // The plant has to survive being root, which a `chmod 0555` on the parent
    // does not — root unlinks straight through it, and the first version of
    // this scenario passed cleanly for exactly that wrong reason. `chattr +i`
    // is the faithful shape: rmSync walks the tree, one child refuses to go,
    // the top-level rmdir fails, and the old `catch { /* tmp */ }` ate it.
    name: 'P6 the removal itself is made to FAIL',
    expect: 'a partial removal is REPORTED BY NAME and exits 3 under BROWSER_LEAK_STRICT',
    body: `const b = await launchBrowser({ prefix: 'st-', browser: BIN });
      await new Promise((r) => setTimeout(r, 400));
      const stuck = join(b.profile, 'IMMUTABLE');
      writeFileSync(stuck, 'planted');
      const c = spawnSync('chattr', ['+i', stuck], { encoding: 'utf8' });
      if (c.status !== 0) { console.log('CANNOT PLANT: chattr +i failed — ' + ((c.stderr || '') + (c.error && c.error.message || '')).trim()); process.exit(9); }
      const r = await b.close();
      console.log('REMOVED=' + r.removed);
      spawnSync('chattr', ['-i', stuck]);`,
    // WHAT THIS SCENARIO MAY ASSERT, AND WHAT IT MAY NOT. It asserts the
    // REPORT: `close()` returns removed:false, the launcher names the path and
    // the errno on stderr, and BROWSER_LEAK_STRICT turns that into exit 3.
    // It may NOT assert that the directory is still standing afterwards, and
    // the first version did — it passed once and went red on the next run. The
    // child lifts the immutable flag before exiting (it has to, or the selftest
    // cannot clean up after itself), and the exit guard then legitimately
    // succeeds on the retry the flag was blocking. So a leftover-set assertion
    // here measures which of those two won a race, not whether the failure was
    // reported. The report is the claim; the residue is a coin toss.
    leftover: 'ignored',
    mustSay: /REMOVED=false/,
    mustSay2: /browser: PROFILE NOT REMOVED — .*st-.*ENOTDIR|browser: PROFILE NOT REMOVED — .*st-/,
    mustExit: 3,
    strict: true,
    unknownIf: /CANNOT PLANT/,
  },
  {
    name: 'P7 TMPDIR pinning OFF — the control for the control',
    expect: "Chrome's own .org.chromium.Chromium.* IS left behind, by name",
    body: `const b = await launchBrowser({ prefix: 'st-', browser: BIN, pinTmp: false }); await b.close();`,
    leftover: 'chromium-temp',
  },
];

// THE SERVE CHECKS — `buildPageUrl` and `serveDir`, in node alone (no browser).
// Each one is a property a flipped tool leans on, and the plants are the ways it
// would go wrong: an inline file that stopped opening as itself, a pack build
// left on `file://`, a path that escapes the folder, a wrong byte range.
async function serveChecks() {
  const { mkdtempSync: mk, writeFileSync, mkdirSync, rmSync: rm, symlinkSync } = await import('node:fs');
  const { request } = await import('node:http');
  const { buildChannel, debugEnabled } = await import('../src/ui/buildChannel.js');
  const td = mk(join(tmpdir(), 'vbsv-'));
  const results = [];
  const check = (ok, what) => { results.push([!!ok, what]); };
  // A raw request, because fetch() normalises `..` away before it is sent and
  // always reads a body; this one reports the status, headers and body length.
  const raw = (url, { method = 'GET', path = null, headers = {} } = {}) => new Promise((r) => {
    const u = new URL(url);
    const q = request({ host: u.hostname, port: u.port, path: path ?? u.pathname, method, headers }, (res) => {
      const chunks = []; res.on('data', (c) => chunks.push(c));
      res.on('end', () => r({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    q.on('error', () => r({ status: 0, headers: {}, body: Buffer.alloc(0) })); q.end();
  });
  const where = (href) => { const u = new URL(href); return { pathname: u.pathname, hostname: u.hostname, protocol: u.protocol }; };
  try {
    // The shapes tools/bundle.mjs writes: a single file carries a null pin, a
    // pack build a non-empty one.
    const PIN = 'const ASSET_PACKS = {"tier":"light","packs":{"light":{"id":"light-000000000000"}}};\n';
    const NULL_PIN = 'const ASSET_PACKS = null;\n';
    mkdirSync(join(td, 'inline'));
    mkdirSync(join(td, 'stale', 'packs'), { recursive: true });
    mkdirSync(join(td, 'orphan'));
    mkdirSync(join(td, 'pack', 'packs'), { recursive: true });
    mkdirSync(join(td, 'pack', 'objects', 'ab'), { recursive: true });
    mkdirSync(join(td, 'pack', 'sub'));
    mkdirSync(join(td, 'named', 'packs'), { recursive: true });
    writeFileSync(join(td, 'secret.txt'), 'outside');
    writeFileSync(join(td, 'inline', 'AshenSpire.html'), `<!doctype html><title>inline</title><script>${NULL_PIN}</script>`);
    // KNOWN-BAD: an inline file beside a stale packs/ folder, and a pinned
    // build whose packs/ folder is missing.
    writeFileSync(join(td, 'stale', 'AshenSpire.html'), `<!doctype html><title>stale</title><script>${NULL_PIN}</script>`);
    writeFileSync(join(td, 'orphan', 'AshenSpire.html'), `<!doctype html><title>orphan</title><script>${PIN}</script>`);
    writeFileSync(join(td, 'pack', 'AshenSpire.html'), `<!doctype html><title>pack</title><script>${PIN}</script>`);
    writeFileSync(join(td, 'pack', 'sub', 'index.html'), 'sub index');
    writeFileSync(join(td, 'named', 'AshenSpire-test-0.7.1.9.html'), `<!doctype html><title>named</title><script>${PIN}</script>`);
    writeFileSync(join(td, 'pack', 'packs', 'light-000000000000.json'), '{"ids":{}}\n');
    const big = Buffer.alloc(3 * 1024 * 1024);
    for (let i = 0; i < big.length; i++) big[i] = i % 251;
    writeFileSync(join(td, 'pack', 'objects', 'ab', 'ab01.mp3'), big);
    // KNOWN-BAD: a symlink inside the folder that points outside it.
    symlinkSync(join(td, 'secret.txt'), join(td, 'pack', 'escape.txt'));
    symlinkSync(td, join(td, 'pack', 'up'));
    const inline = join(td, 'inline', 'AshenSpire.html');
    const pack = join(td, 'pack', 'AshenSpire.html');
    const named = join(td, 'named', 'AshenSpire-test-0.7.1.9.html');

    check(await buildPageUrl(inline, { over: 'auto' }) === pathToFileURL(inline).href,
      'an inline single file opens as pathToFileURL(file), unchanged');
    check(!isPackShaped(inline) && isPackShaped(pack), 'a non-empty ASSET_PACKS pin in the HTML marks the pack shape');
    const stale = join(td, 'stale', 'AshenSpire.html');
    const orphan = join(td, 'orphan', 'AshenSpire.html');
    check(!isPackShaped(stale) && await buildPageUrl(stale) === pathToFileURL(stale).href, 'an inline file beside a stale packs/ folder stays on file://');
    check(isPackShaped(orphan) && /^http:/.test(await buildPageUrl(orphan)), 'a pinned build whose packs/ folder is missing is still served');
    check(await buildPageUrl(pack, { over: 'file' }) === pathToFileURL(pack).href, 'over=file keeps a pack build on file://');
    const u = await buildPageUrl(pack, { over: 'auto' });
    check(/^http:\/\/127\.0\.0\.1:\d+\/unknown\/latest\/AshenSpire\.html$/.test(u), `a pack build is served over http under its channel (${u})`);
    check(await buildPageUrl(pack) === u, 'a second page of the same build reuses the server');
    const httpInline = await buildPageUrl(inline, { over: 'http' });
    check(/^http:/.test(httpInline) && (await (await fetch(httpInline)).text()).includes('inline'), 'over=http serves even an inline file');
    let threw = false;
    try { await buildPageUrl(inline, { over: 'ftp' }); } catch { threw = true; }
    check(threw, 'an unknown over= value is refused by name');

    // THE CHANNEL AND DEBUG STATE ARE THE FILE'S, NOT 127.0.0.1's.
    const fileCh = buildChannel(where(pathToFileURL(pack).href), 'standalone file');
    const httpCh = buildChannel(where(u), 'standalone file');
    const bare = (await serveDir(dirname(pack))).url('AshenSpire.html');
    check(fileCh === 'unknown' && httpCh === fileCh, `the served page reads the file's channel (file ${fileCh}, served ${httpCh})`);
    check(buildChannel(where(bare), 'standalone file') === 'dev', 'control: the same folder served bare on 127.0.0.1 reads dev — the case this guards');
    check(debugEnabled(httpCh, { search: '', storage: null }) === debugEnabled(fileCh, { search: '', storage: null }) && !debugEnabled(httpCh, { search: '', storage: null }),
      'and its debug state matches the file (off by default)');
    check(buildChannel(where('file:///home/p/unknown/1/AshenSpire-test-0.7.1.9.html'), 'standalone file') === 'test'
      && buildChannel(where('https://cehinds.github.io/AshenSpire/unknown/1/'), 'standalone file') === 'main',
      'an /unknown/ path counts only on this machine: a saved file keeps its name, Pages keeps four channels');
    const namedUrl = await buildPageUrl(named, { over: 'http' });
    check(buildChannel(where(namedUrl), 'standalone file') === 'test' && buildChannel(where(pathToFileURL(named).href), 'standalone file') === 'test',
      `a download named for its channel keeps it served (${namedUrl})`);

    const base = u.replace(/AshenSpire\.html$/, '');
    const html = await fetch(u);
    check(html.status === 200 && /text\/html/.test(html.headers.get('content-type')) && (await html.text()).includes('pack'), 'the HTML comes back 200 text/html');
    const idx = await fetch(`${base}packs/light-000000000000.json`);
    check(idx.status === 200 && (await idx.text()) === '{"ids":{}}\n', 'a pack index beside it is fetchable, byte for byte');
    const obj = `${base}objects/ab/ab01.mp3`;
    const whole = await raw(obj);
    check(whole.status === 200 && whole.body.equals(big) && Number(whole.headers['content-length']) === big.length, 'a 3 MB object streams whole, byte for byte');
    const part = await raw(obj, { headers: { Range: 'bytes=1048576-1048585' } });
    check(part.status === 206 && part.body.equals(big.subarray(1048576, 1048586)) && part.headers['content-range'] === `bytes 1048576-1048585/${big.length}`,
      'a byte range answers 206 with exactly those bytes');
    const tail = await raw(obj, { headers: { Range: 'bytes=-3' } });
    check(tail.status === 206 && tail.body.equals(big.subarray(big.length - 3)), 'a suffix range answers the last bytes');
    const past = await raw(obj, { headers: { Range: `bytes=${big.length + 10}-` } });
    check(past.status === 416 && past.body.length === 0, 'a range past the end answers 416');
    const backwards = await raw(obj, { headers: { Range: 'bytes=5-3' } });
    check(backwards.status === 200 && backwards.body.equals(big), 'an invalid range (bytes=5-3) is ignored: the whole body, 200');
    const head = await raw(obj, { method: 'HEAD' });
    check(head.status === 200 && head.body.length === 0 && Number(head.headers['content-length']) === big.length, 'HEAD sends the length and no body');
    const headRange = await raw(obj, { method: 'HEAD', headers: { Range: 'bytes=0-9' } });
    check(headRange.status === 206 && headRange.body.length === 0 && Number(headRange.headers['content-length']) === 10, 'HEAD with a range sends the interval length and no body');

    const port = new URL(u).port;
    const at = (path) => raw(`http://127.0.0.1:${port}/`, { path });
    // `..` and `%2e%2e` are normalised inside the folder by the URL parser (404);
    // an encoded slash reaches the guard, which must answer 403.
    const esc = [await at('/unknown/latest/../secret.txt'), await at('/unknown/latest/..%2f..%2fsecret.txt'), await at('/unknown/latest/%2e%2e/secret.txt')].map((r) => r.status);
    check(esc.every((c) => c === 403 || c === 404) && esc[1] === 403, `a path outside the folder is never served (${esc.join(', ')})`);
    const link = await at('/unknown/latest/escape.txt');
    const linkDir = await at('/unknown/latest/up/secret.txt');
    check(link.status === 403 && linkDir.status === 403 && !link.body.toString().includes('outside'),
      `a symlink inside the folder that points outside it is refused (${link.status}, ${linkDir.status})`);
    const dirNoSlash = await at('/unknown/latest/sub?x=1');
    const dirSlash = await at('/unknown/latest/sub/');
    const mountNoSlash = await at('/unknown/latest');
    check(dirNoSlash.status === 301 && dirNoSlash.headers.location === '/unknown/latest/sub/?x=1' && dirSlash.status === 200 && dirSlash.body.toString() === 'sub index'
      && mountNoSlash.status === 301 && mountNoSlash.headers.location === '/unknown/latest/',
      `a folder named without its slash is sent to the slash (${dirNoSlash.status} ${dirNoSlash.headers.location}, ${mountNoSlash.status} ${mountNoSlash.headers.location})`);
    const unmounted = await at('/AshenSpire.html');
    check(unmounted.status === 404, 'nothing answers outside the channel mount');
    const miss = await fetch(`${base}packs/nope.json`);
    check(miss.status === 404, 'a missing file is 404');
  } catch (e) {
    check(false, `the serve checks threw: ${e.message}`);
  } finally {
    try { rm(td, { recursive: true, force: true }); } catch { /* tidying */ }
  }
  return results;
}

async function selftest() {
  const { mkdtempSync: mk, writeFileSync, rmSync: rm, mkdirSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
  const BIN = resolveBrowser();
  // The serve checks need no browser, so they run first and report on their own.
  const sv = await serveChecks();
  const svFail = sv.filter(([ok]) => !ok).length;
  console.log(`${svFail ? 'FAIL' : 'PASS'}  S  buildPageUrl / serveDir (${sv.length} checks, no browser)`);
  for (const [ok, what] of sv) console.log(`        ${ok ? 'ok  ' : 'RED '} ${what}`);
  if (process.argv.includes('--serve-only')) process.exit(svFail ? 1 : 0);
  if (!BIN) { console.error('browser --selftest: no Chrome/Chromium found — set CHROME'); process.exit(2); }
  console.log(`browser --selftest — ${BIN}\n`);

  // A SHORT root, deliberately: /tmp/vb-XXXXXX keeps every profile path far
  // under PATH_BUDGET, which is the condition the tools run under.
  mkdirSync('/tmp/vbst', { recursive: true });
  let pass = svFail ? 0 : 1; let fail = svFail ? 1 : 0; const unknown = [];

  for (const s of SCENARIOS) {
    const td = mk('/tmp/vbst/r');
    const script = join(td, 'run.mjs');
    // EVERY 'none' SCENARIO PRINTS A RECEIPT THAT A BROWSER WAS ACTUALLY
    // LAUNCHED, AND IT IS NOT DECORATION — see the note above SCENARIOS.
    // `writeSync(1, …)` and not `console.log`, because P4 calls `process.exit`
    // in the next statement and a piped `console.log` can be truncated by it:
    // the receipt has to be on disk before the exit, or the assertion goes red
    // for the wrong reason.
    writeFileSync(script, `import { launchBrowser as _launchBrowser } from ${JSON.stringify(join(HERE, 'browser.mjs'))};\n`
      + `import { chmodSync, writeFileSync, writeSync } from 'node:fs';\n`
      + `import { spawnSync } from 'node:child_process';\n`
      + `import { join } from 'node:path';\n`
      + `const launchBrowser = async (o) => { const b = await _launchBrowser(o); writeSync(1, 'LAUNCHED ' + b.profile + ' pid=' + (b.child && b.child.pid) + '\\n'); return b; };\n`
      + `const BIN = ${JSON.stringify(BIN)};\n`
      + `${s.body}\n`);
    const env = { ...process.env, TMPDIR: td, TMP: td, TEMP: td };
    if (s.strict) env.BROWSER_LEAK_STRICT = '1';
    const r = spawnSync(process.execPath, [script], { encoding: 'utf8', env, timeout: 90000 });
    const out = `${r.stdout || ''}${r.stderr || ''}`;

    // A PLANT THAT COULD NOT BE PLANTED IS `unknown`, NEVER GREEN. It has not
    // been distinguished from the plants that would have failed.
    if (s.unknownIf && s.unknownIf.test(out)) {
      unknown.push(s.name);
      console.log(`UNK   ${s.name}`);
      console.log(`      expect: ${s.expect}`);
      console.log(`        ?    the plant could not be laid on this machine — ${(out.match(/CANNOT PLANT.*/) || [''])[0]}`);
      console.log('        ?    this scenario is UNKNOWN, not passed: nothing has watched this path go red here.');
      try { spawnSync('chmod', ['-R', 'u+w', td]); rm(td, { recursive: true, force: true }); } catch { /* tidying */ }
      continue;
    }

    const left = existsSync(td) ? readdirSync(td).filter((n) => n !== 'run.mjs') : [];
    const profiles = left.filter((n) => n.startsWith('st-'));
    const chromiumTemp = left.filter((n) => n.startsWith('.org.chromium.Chromium.'));

    const checks = [];
    // AN EMPTY DIRECTORY IS NOT A PASS UNTIL SOMETHING PUT A PROFILE IN IT.
    // Measured 2026-08-17 by Bjorn while gating this file: replace
    // `launchBrowser` with a function that launches nothing, makes no profile
    // and removes nothing, and FIVE OF THE EIGHT SCENARIOS — C, P1, P2, P3, P4,
    // every one whose whole assertion is `leftover: 'none'` — still print PASS.
    // The same five pass when the import itself fails to resolve. `leftover 0`
    // was being satisfied by absence for the wrong reason, which is the exact
    // silent-partial shape this file exists to end, one level up in the
    // instrument. So each of them now also asserts the receipt: a browser was
    // launched, and its profile was INSIDE this scenario's private TMPDIR —
    // which is also what makes the leftover count attributable at all.
    if (s.launches !== false) {
      const m = /LAUNCHED (\S+) pid=(\S+)/.exec(out);
      checks.push([!!m, `a browser was actually launched (receipt: ${m ? `${m[1]} pid=${m[2]}` : 'NONE — nothing launched, so an empty TMPDIR proves nothing'})`]);
      if (m) checks.push([m[1].startsWith(`${td}/`), `and its profile was inside this scenario's private TMPDIR (${m[1]} under ${td})`]);
    }
    if (s.leftover === 'none') {
      checks.push([left.length === 0, `nothing left in the private TMPDIR (found ${left.length}: ${left.join(', ') || '-'})`]);
    } else if (s.leftover === 'some') {
      checks.push([profiles.length > 0, `the undeletable profile IS still there (${profiles.length})`]);
    } else if (s.leftover === 'chromium-temp') {
      checks.push([chromiumTemp.length > 0, `an unpinned run STRANDS Chrome's own temp (${chromiumTemp.length} .org.chromium.Chromium.*)`]);
      checks.push([profiles.length === 0, `and the profile itself still goes (${profiles.length} left)`]);
    }
    if (s.mustSay) checks.push([s.mustSay.test(out), `said it by name: ${s.mustSay}`]);
    if (s.mustSay2) checks.push([s.mustSay2.test(out), `said it by name: ${s.mustSay2}`]);
    if (s.mustExit !== undefined) checks.push([r.status === s.mustExit, `exit ${s.mustExit} (got ${r.status})`]);

    const ok = checks.every(([c]) => c);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${s.name}`);
    console.log(`      expect: ${s.expect}`);
    for (const [c, what] of checks) console.log(`        ${c ? 'ok  ' : 'RED '} ${what}`);
    if (!ok) { fail++; console.log(`      ---- output ----\n${out.split('\n').slice(0, 12).map((l) => `      | ${l}`).join('\n')}`); } else pass++;

    try { spawnSync('chattr', ['-R', '-i', td]); spawnSync('chmod', ['-R', 'u+w', td]); rm(td, { recursive: true, force: true }); } catch { /* the selftest's own tidying */ }
  }

  // AN EMPTY RESULT IS NOT A PASS. If no scenario ran, the denominator is zero
  // and a clean sweep with nothing in it is not evidence of anything.
  if (pass + fail + unknown.length === 0) { console.error('\nbrowser --selftest: NOTHING RAN — this is not a pass'); process.exit(2); }
  console.log(`\nbrowser --selftest: ${fail ? `${fail} FAIL` : 'held'} — ${pass} PASS / ${fail} FAIL`
    + `${unknown.length ? ` / ${unknown.length} UNKNOWN (${unknown.join('; ')})` : ''} over ${SCENARIOS.length + 1} scenario(s) (the browser ones and S)`);
  console.log('  BOUNDARY: Linux, headless Chromium, one box, one process per scenario, each in its own');
  console.log('  private TMPDIR so a leftover is that run\'s BY CONSTRUCTION. Silent on Windows and macOS,');
  console.log('  on SIGKILL of the node process (nothing can run then — the profile stays, by design of');
  console.log('  the signal), and on a machine so loaded the 5000 ms SIGTERM join expires: that path');
  console.log('  escalates to SIGKILL and is REASONED here, not watched.');
  process.exit(fail ? 1 : 0);
}

// ⚠ ONLY WHEN THIS FILE IS THE COMMAND, and the second clause is a bug fix
// found by an instrument that could not run — Vira, 2026-08-17.
//
// This line used to read `if (process.argv.includes('--selftest'))`, at module
// scope, in a file **24 other tools import**. Every one of them declares its own
// `--selftest`, and every one of them ends in `process.exit` from THIS
// function before its own bench is reached. Measured at dev `b83bda1`:
//
//     node tools/mapfog.mjs --selftest   ->  "browser --selftest: held — 8 PASS"
//                                            exit 0, and the fog ladder's nine
//                                            properties and nine mutants never
//                                            ran at all.
//
// **IT IS THE WORST SHAPE A GREEN CAN HAVE**: the documented command for an
// instrument printed somebody else's pass, under a different tool's name, and
// exited 0. Nothing was wrong with either tool — the import ran the wrong bench.
//
// WHAT THIS FIXES AND WHAT IT DOES NOT. It fixes the hijack. It does NOT
// discharge the 23 other benches this was hiding: each of them has now been
// unreachable by its own command for as long as it has imported this file, and
// **not one of them has been run in that state**. That is a finding for the
// table, not something this commit may claim as covered.
const ENTRY = process.argv[1] ? resolve(process.argv[1]) : '';
if (process.argv.includes('--selftest') && ENTRY.endsWith('browser.mjs')) await selftest();
