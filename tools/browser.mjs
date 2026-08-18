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
// SELFTEST: `node tools/browser.mjs --selftest` (needs CHROME). Eight
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
// This file owns the PROFILE. It does not own the http server a caller starts,
// the CDP socket, or any sandbox tree a tool copies — those are the caller's,
// and this launcher is silent about them. It also does not own BROWSER
// RESOLUTION: `resolveBrowser()` is exported and is the single home available,
// but the tools' candidate lists genuinely differ (CHROME vs CHROME_PATH, four
// paths vs three), so migrating resolution is a second act and is not claimed.
//
// REMOVAL: deleted the day no family tool launches a browser, or the day the
// tools use a real browser-automation library that owns its own profile
// lifetime — at which point this is a second copy of that library's job.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// A UNIX socket path is capped at 108 bytes and Chrome puts `SingletonSocket`
// inside the profile. 90 leaves room for that name and for the mkdtemp suffix.
// MEASURED CEILING IS 61 WITH pinTmp ON, NOT 90 — see the header. This number
// is 29 bytes too generous and nothing watches either side of it; it is left as
// its author set it and named rather than moved.
export const PATH_BUDGET = 90;

const DEFAULT_ARGS = ['--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', '--no-first-run'];
const ENDPOINT = /DevTools listening on (ws:\/\/\S+)/;

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
        if (!settled) { settled = true; rej(new Error(`browser: no DevTools endpoint from ${bin} in ${timeoutMs} ms:\n${buf.slice(-300)}`)); }
      }, timeoutMs);
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

async function selftest() {
  const { mkdtempSync: mk, writeFileSync, rmSync: rm, mkdirSync } = await import('node:fs');
  const { spawnSync } = await import('node:child_process');
  const HERE = resolve(fileURLToPath(new URL('.', import.meta.url)));
  const BIN = resolveBrowser();
  if (!BIN) { console.error('browser --selftest: no Chrome/Chromium found — set CHROME'); process.exit(2); }
  console.log(`browser --selftest — ${BIN}\n`);

  // A SHORT root, deliberately: /tmp/vb-XXXXXX keeps every profile path far
  // under PATH_BUDGET, which is the condition the tools run under.
  mkdirSync('/tmp/vbst', { recursive: true });
  let pass = 0; let fail = 0; const unknown = [];

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
    + `${unknown.length ? ` / ${unknown.length} UNKNOWN (${unknown.join('; ')})` : ''} over ${SCENARIOS.length} scenario(s)`);
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
