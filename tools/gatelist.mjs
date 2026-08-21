#!/usr/bin/env node
// tools/gatelist.mjs — WHICH INSTRUMENTS DOES A GATE ACTUALLY RUN, AND DOES IT
// LISTEN TO THE ANSWER?
//
// Bjorn Falk, 2026-08-21. The generator SOP 14 §5a has been waiting for.
//
// WHY IT EXISTS, and the reason is a measurement of us, not a theory.
//
// §5a reads "until a generator exists, the derivation is mechanical and stated
// in the verdict" — every exact-head PASS this house issues rests on a gate
// command set derived BY HAND. On 2026-08-21 two experienced hands derived that
// set wrongly, in opposite directions, inside one hour, neither knowing about
// the other: a grep for a tool name cannot tell `run:` from `echo`, so it counts
// coverage that does not exist; and my own first parse of this question returned
// FIVE browser instruments where the truth is TWO, because the boundary job's
// `run: |` payload is full of `echo` lines that NAME tools and I counted a
// string inside an echo as an execution. I built the exact defect this file is
// about, inside the fix for it, and needed two passes to see it.
//
// THE DEFECT THIS ANSWERS is #295's, one layer up: PR #224 passed exact-head
// review while `tools/hintstrip.mjs` — red for four days — sat in nobody's list.
// The instrument existed. The list was the defect.
//
// ⚠ AND THE SECOND HALF, WHICH IS VIRA'S FINDING AND NOT MINE. Being IN a list
// is not enough. I claimed at #301 that hintstrip's two steps were "a redundant
// pair", having planted `|| true` on step 1 and watched the job stay red. She
// derived from doorplant.mjs:181-186 that **the selftest's clean edge IS step 1
// re-run** — so the job stayed red because THE SAME CHECK FAILED TWICE, and the
// day the tree goes green a `|| true` on step 1 silences the gate completely.
// The redundancy evaporates at exactly the moment it would start to matter,
// because a green tree is the only state in which a regression can be
// introduced. **I observed a behaviour honestly and inferred a property it does
// not have** — my own failure mode, at the level of time rather than depth.
// G4 below is the close, and it is why this file asks a second question.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE SPECIFICATION — what counts as an INVOCATION. This is the deliverable.
// ─────────────────────────────────────────────────────────────────────────────
//
// A tool is INVOKED when its path appears in COMMAND POSITION in something a
// list executes. Everything else is PROSE, however much it looks like coverage.
//
//  (1) SHELL LISTS (`.github/workflows/ci.yml`). A step's `run:` payload is a
//      shell script, not a string. It is comment-stripped (a `#` at a word
//      boundary outside quotes begins a comment), split into COMMANDS on
//      newlines and on `;` `&&` `||` `|` `&`, and each command tokenized with
//      quotes respected. The FIRST token is command position; leading
//      `VAR=value` assignments and the delegating wrappers `env` `time` `exec`
//      `sudo` are stepped over. If it is `node` (bare or any path ending
//      `/node`), the first following non-flag token matching `tools/<name>` is
//      an invocation. Reached any other way — inside `echo`'s arguments, inside
//      a quoted string, after a `#` — it is NOT. A heredoc body is DATA and is
//      skipped; there are none in this repo today, and the rule is here so the
//      first one does not silently become "coverage".
//
//  (2) JS LISTS (`tests/run-node.mjs`). Comments are stripped first — this suite
//      names `tools/zoomplace.mjs` and `tools/release-shots.mjs` in comments and
//      in its printed boundary, and runs neither. An invocation is then a
//      `tools/<name>` string literal inside the ARGV ARRAY of an `execFileSync` /
//      `spawnSync` / `execSync` call. Any other position is prose.
//
//  (3) EXECUTED OUTPUT is the third thing, and collapsing it into either of the
//      above is how both of tonight's wrong counts happened. A `tools/<name>`
//      inside an `echo` payload or a `console.log` IS RUN — it reaches a reader
//      — but it EXECUTES NOTHING. So it is held to one rule (G1): such a line
//      either belongs to a tool the same list invokes, or it must SAY WHAT GOES
//      UNWATCHED. There is no marker to find and no job id typed here; the test
//      is on the line itself, so it travels to any list that prints a boundary.
//      A SOURCE COMMENT is not executed output and is not held to this at all —
//      documentation is allowed to name a tool.
//
// THE FOUR STATES, first match wins, and the precedence is stated because a tool
// can satisfy more than one:
//
//   listed                  invoked in command position by some gate list
//   excluded-with-a-reason  named in executed output WITH a stated cost
//   linked-but-never-run    reached by linkcheck's module walk, run by nothing
//   unlisted                not reached by anything
//
// ⚠ THE THIRD STATE IS THE DEFAULT CELL, NOT THE RARE ONE, AND I CHECKED THAT
// RATHER THAN ASSUMED IT. `tools/linkcheck.mjs`'s ROOTS are ['src','tools',
// 'tests'] and it reports "279/279 module graphs link … The walk covers every
// in-tree module regardless of who imports it." So run-node's cases 45-46 LINK
// every tool here and EXECUTE NOT ONE MODULE BODY, and the suite says so itself.
// The precedent is in 45-46's own comment: #88 renamed an export and left
// `release-shots.mjs` standing, the release floor cited it as green, and it
// exited 1 before a browser launched — NOT A FAILED CHECK, A FAILED LOAD.
// A green from a suite that LINKED an instrument is not a green from it.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS ASSERTED, AND WHAT IS ONLY REPORTED
// ─────────────────────────────────────────────────────────────────────────────
//
// ASSERTED (this tool goes red):
//   G1 NO PROSE WEARING COVERAGE — a tool named in EXECUTED OUTPUT is invoked by
//      THE STEP THAT NAMES IT, or its line states a cost. Source comments are
//      exempt. ⚠ THE SCOPE IS THE STEP, NOT THE LIST, and that is not a detail:
//      a list-scoped test exempts a step emptied into an `echo` whenever a
//      SIBLING step keeps the tool-level listing alive, which is #295's defect
//      one degree finer — not "a tool in no list" but "a tool in a list that has
//      stopped running it HERE". Site-local, so it needs no baseline.
//      ⚠ WHAT REMAINS UNSEEN, and it is smaller but real: a step DELETED
//      OUTRIGHT, naming nothing, while another invocation of the same tool
//      survives. Nothing names it, so nothing fires. Closing that needs a
//      per-site baseline — a frozen number in a second home — and I would rather
//      state the gap than plant a rotting number. NAMED HERE AND IN THE OUTPUT,
//      not only here, because a boundary that lives only in a comment is how the
//      previous version of this clause shipped over its own residue.
//   G2 AN EXCLUSION NAMES ITS COST — D78: the reason must say WHICH DEFECT CLASS
//      goes unwatched, not merely that the check is expensive. The live models
//      are already in the tree — `tutorial-reach` and `release-shots`, each named
//      in a boundary that says what is not being watched. Practice generalized,
//      not teeth invented.
//   G3 EVERY DECLARED HOME WAS READ — a home that vanishes, or a workflow whose
//      shape the reader does not recognise, is exit 2 (`unknown`, which blocks),
//      never a quietly smaller census.
//   G4 AN INVOCATION'S EXIT STATUS IS NOT SWALLOWED — IN A SHELL GATE LIST ONLY.
//      Vira's close, and the one check here about a GREEN tree. `node
//      tools/x.mjs || true` is still an invocation by (1) — the parser sees it,
//      the tool is `listed`, every census is happy — and it is SILENT. So an
//      invocation may not sit on the left of `||`, be followed by `; true`, run
//      under `set +e`, or sit in a step marked `continue-on-error: true`.
//      ⚠ THE VENUE IS NARROW AND THE NARROWING IS THE HONEST PART. JAVASCRIPT
//      gate lists are NOT audited: an ignored `spawnSync` result or a
//      `try { execFileSync(...) } catch {}` stays `listed` and this tool says
//      nothing. AND ITS OWN HOME IS ONE OF THEM — this file is run from
//      tests/run-node.mjs, so the check built to ask "does this list listen?"
//      is deaf in its own venue. The first version of G4 did not say so and
//      counted JS invocations in its own denominator, which made the claim
//      general while the coverage was not (reviewer P2 at 11ec9ab).
//      Closing it honestly needs dataflow, not a heuristic — the suite's own
//      pattern is try/catch -> `{ code }` -> an accumulator -> process.exit() —
//      and a near-enough rule would be this file committing the defect it
//      exists to name. So it is REFUSED BY NAME, in the tool's own output,
//      every run. The red arrives the day someone builds it.
//      Also not detected, in either venue: a pipeline that masks status
//      (`cmd | tee`) and a wrapper script that exits 0 on its own.
//
// REPORTED, NOT ASSERTED — and it carries its removal condition on its face,
// because an excuse that outlives its defect is how a suite goes green over a
// bug (Law 5's own lesson, learned on `axisfit`):
//   THE CENSUS — how many tools sit in each state. WHETHER a tool ought to be
//   wired is a design call with real costs; D78 rules the default disposition is
//   `excluded-with-a-reason`, and that a wiring spree buys the APPEARANCE of
//   coverage with a browser budget. That call is not this file's.
//   ⚠ IT BECOMES AN ASSERTION the day those dispositions are filed — then every
//   tool has a state by somebody's hand, `unlisted` is a defect, and whoever
//   files the last one DELETES this paragraph rather than softening it.
//
// KNOWN-BAD FIRST (development.md, *The instrument rule*). `--selftest` plants
// its known-bads as FILE BYTES in a copied real tree (tools/doorplant.mjs) and
// runs this tool whole from the copy. Two of the plants are ones I personally
// owe: an invocation moved into an `echo` (the mistake I made), and `|| true` on
// a real step (the property I claimed and did not have).
//
// Usage:
//   node tools/gatelist.mjs              the verdict, with the census
//   node tools/gatelist.mjs --raw        every tool, one row per line
//   node tools/gatelist.mjs --browser    only the launchBrowser callers
//   node tools/gatelist.mjs --selftest   the same-door known-bad corpus
// Exit: 0 assertions hold · 1 a finding · 2 a home could not be read (unknown)
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day SOP 14 §5a is cut —
// §5a is scaffolding for a missing generator and this is the generator, so they
// die together. Also WRONG, AND REWRITTEN, the first time this reports `listed`
// for a tool a gate does not actually execute: then command position was never
// the thing that knew.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── the source of bytes: the working tree, or ANY REF ────────────────────────
// REF-CAPABLE FROM THE FIRST VERSION, DELIBERATELY, AND THE REASON IS A
// MEASUREMENT. The unlisted set is a RATE, not a backlog: `origin/dev` has 62
// launchBrowser callers and PR #290's head `f0cebb6` has 65 — one PR in flight
// adds THREE browser instruments and wires none of them. A hand-written
// disposition column is stale the week it lands, so the useful question is never
// "how many are unlisted today" but "did THIS REF add an instrument nobody
// runs", and that is a question about a diff. Retrofitting ref-awareness is the
// expensive half; building the gate on top of it is cheap and is NOT done here.
const REF = (() => {
  const i = process.argv.indexOf('--ref');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function readSource(path, ref) {
  if (!ref) return existsSync(join(ROOT, path)) ? readFileSync(join(ROOT, path), 'utf8') : null;
  try { return git(['show', `${ref}:${path}`]); } catch { return null; }
}

function listTools(ref) {
  if (!ref) {
    return readdirSync(join(ROOT, 'tools')).filter((f) => /\.(mjs|sh|py)$/.test(f)).map((f) => `tools/${f}`).sort();
  }
  return git(['ls-tree', '--name-only', `${ref}:tools`]).split('\n')
    .filter((f) => /\.(mjs|sh|py)$/.test(f)).map((f) => `tools/${f}`).sort();
}

const SINCE = (() => { const i = process.argv.indexOf('--since'); return i >= 0 ? process.argv[i + 1] : null; })();

// THE DECLARED HOMES. A list not here is not consulted; a home here that cannot
// be read is exit 2, never a smaller census reported as a verdict.
const GATE_LISTS = [
  { path: '.github/workflows/ci.yml', kind: 'workflow' },
  { path: 'tests/run-node.mjs', kind: 'js' },
];

// `.sh` and `.py` are in the population because the boundary block already names
// `tools/palette-check.sh`; a category that silently drops a file kind is the
// defect this file is about.
const TOOL_RE = 'tools/[A-Za-z0-9._-]+\\.(?:mjs|sh|py)';
const TOOL_REF = new RegExp(TOOL_RE, 'g');

// A cost must be words, not a bare name. Four is the floor: "and NO job here
// runs it" is four.
const MIN_COST_WORDS = 4;

// ── shell reading ───────────────────────────────────────────────────────────
function stripShellComments(src) {
  const out = [];
  for (const line of src.split('\n')) {
    let q = null, cut = -1;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === q && line[i - 1] !== '\\') q = null; continue; }
      if (c === "'" || c === '"') { q = c; continue; }
      if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) { cut = i; break; }
    }
    out.push(cut >= 0 ? line.slice(0, cut) : line);
  }
  return out.join('\n');
}

// Split into commands, remembering the separator that FOLLOWED each one — G4
// needs to know an invocation was on the left of `||`.
function shellCommands(src) {
  const script = stripShellComments(src);
  const cmds = [];
  let cur = '', q = null, skipHeredoc = null;
  const push = (after) => { if (cur.trim()) cmds.push({ cmd: cur.trim(), after }); cur = ''; };
  for (const line of script.split('\n')) {
    if (skipHeredoc !== null) { if (line.trim() === skipHeredoc) skipHeredoc = null; continue; }
    const hd = line.match(/<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/);
    if (hd) { cur += line.slice(0, hd.index); push('\n'); skipHeredoc = hd[1]; continue; }
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { cur += c; if (c === q && line[i - 1] !== '\\') q = null; continue; }
      if (c === "'" || c === '"') { q = c; cur += c; continue; }
      if (c === ';' || c === '|' || c === '&') {
        const dbl = line[i + 1] === c;
        push(dbl ? c + c : c);
        if (dbl) i++;
        continue;
      }
      cur += c;
    }
    push('\n');
  }
  push('\n');
  return cmds;
}

function tokenize(cmd) {
  const toks = [];
  let cur = '', q = null, quoted = false;
  const push = () => { if (cur !== '' || quoted) toks.push({ t: cur, quoted }); cur = ''; quoted = false; };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) { if (c === q && cmd[i - 1] !== '\\') { q = null; continue; } cur += c; continue; }
    if (c === "'" || c === '"') { q = c; quoted = true; continue; }
    if (/\s/.test(c)) { push(); continue; }
    cur += c;
  }
  push();
  return toks;
}

const WRAPPERS = new Set(['env', 'time', 'exec', 'sudo']);
const TOOL_ARG = new RegExp(`^(?:\\./)?(${TOOL_RE})$`);

// The heart of the specification.
function invocationsIn(cmd) {
  const toks = tokenize(cmd);
  let k = 0;
  while (k < toks.length && !toks[k].quoted
    && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(toks[k].t) || WRAPPERS.has(toks[k].t))) k++;
  if (k >= toks.length) return [];
  const head = toks[k];
  if (head.quoted) return [];                          // `"node" …` is data
  if (!(head.t === 'node' || /\/node$/.test(head.t))) return [];
  for (const tok of toks.slice(k + 1)) {
    if (tok.t.startsWith('-')) continue;               // node's own flags
    const m = tok.t.match(TOOL_ARG);
    return m ? [m[1]] : [];                            // the script argument, or nothing
  }
  return [];
}

// Tools named by a command that only PRINTS. Returns [{ tool, said }].
function printedRefs(cmd) {
  const toks = tokenize(cmd);
  if (!toks.length || toks[0].quoted || toks[0].t !== 'echo') return [];
  const said = toks.slice(1).map((t) => t.t).join(' ');
  return (said.match(TOOL_REF) || []).map((tool) => ({ tool, said, commandForm: isCommandForm(said, tool) }));
}

// COMMAND FORM: the printed text spells `node <tool>`. THIS IS THE DECIDABLE
// TEST VIRA'S RULING TURNS ON, and it judges FORM, never English. A boundary
// line names its tool BARE — "tools/tutorial-reach.mjs drives 8 viewports and NO
// job here runs it" — which is the convention in every one of ci.yml's boundary
// lines. Spelling `node tools/x.mjs` is a different speech act: it is the
// command a reader would type, printed by a list, and it reads as "this list
// runs this". So a command-form reference gets NO cost escape: the list that
// prints it must invoke it. Derived from the house's own convention, not
// invented — measured at origin/dev, 15 of 16 printed command-form references
// are to tools their list actually invokes.
function isCommandForm(said, tool) {
  return new RegExp(`node\\s+${tool.replace(/[.]/g, '\\.')}`).test(said);
}

// ── the workflow reader ─────────────────────────────────────────────────────
// STRUCTURAL, not general YAML: it walks `run:` scalars, plain or block, and
// carries each step's `continue-on-error` for G4. BOUNDARY, stated rather than
// discovered later: it understands the step shapes THIS repo writes. Anchors,
// composite actions or `uses:`-with-args would read as "no run payloads", which
// G3 turns into exit 2, not a green.
function readWorkflow(text) {
  const lines = text.split('\n');
  const payloads = [];
  // a step begins at `- name:` / `- uses:` / `- run:`; scan its block for
  // continue-on-error so a swallowed status at the YAML level is visible too.
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)(- )?run:\s*(.*)$/);
    if (!m) continue;
    const indent = m[1].length + (m[2] ? 2 : 0);
    const rest = m[3].trim();
    // walk backwards/forwards over the step's own block for continue-on-error
    let coe = false;
    for (let j = i - 1; j >= 0 && lines[j].search(/\S/) >= indent; j--) {
      if (/^\s*continue-on-error:\s*true/.test(lines[j])) coe = true;
      if (/^\s*- /.test(lines[j])) break;
    }
    let body;
    if (rest && !/^[|>][-+]?$/.test(rest)) body = rest;
    else {
      const acc = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() === '') { acc.push(''); continue; }
        if (lines[j].search(/\S/) <= indent) break;
        acc.push(lines[j]);
        i = j;
      }
      body = acc.join('\n');
    }
    for (let j = i + 1; j < lines.length && lines[j].search(/\S/) >= indent; j++) {
      if (/^\s*continue-on-error:\s*true/.test(lines[j])) coe = true;
      if (/^\s*- /.test(lines[j])) break;
    }
    payloads.push({ body, continueOnError: coe });
  }
  return payloads;
}

// ── the JS reader ───────────────────────────────────────────────────────────
function stripJsComments(src) {
  let out = '', q = null, i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (q) { out += c; if (c === q && src[i - 1] !== '\\') q = null; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    out += c; i++;
  }
  return out;
}

function jsInvocations(clean) {
  const found = new Set();
  for (const m of clean.matchAll(/\b(?:execFileSync|spawnSync|execSync|execFile|spawn)\s*\(/g)) {
    let depth = 0, j = m.index + m[0].length - 1, end = j;
    for (; j < clean.length; j++) {
      if (clean[j] === '(') depth++;
      else if (clean[j] === ')') { depth--; if (depth === 0) { end = j; break; } }
    }
    const arr = clean.slice(m.index, end + 1).match(/\[[\s\S]*?\]/);
    if (!arr) continue;
    for (const s of arr[0].match(new RegExp(`['"\`](${TOOL_RE})['"\`]`, 'g')) || []) found.add(s.slice(1, -1));
  }
  return found;
}

// Executed output in a JS list: a tool named inside a string that reaches a
// console call. Comments already stripped, so documentation is exempt.
function jsPrintedRefs(clean) {
  const out = [];
  for (const m of clean.matchAll(/console\.(?:log|error|warn)\s*\(/g)) {
    let depth = 0, j = m.index + m[0].length - 1, end = j;
    for (; j < clean.length; j++) {
      if (clean[j] === '(') depth++;
      else if (clean[j] === ')') { depth--; if (depth === 0) { end = j; break; } }
    }
    const said = clean.slice(m.index, end + 1);
    for (const tool of said.match(TOOL_REF) || []) {
      const flat = said.replace(/\s+/g, ' ');
      out.push({ tool, said: flat, commandForm: isCommandForm(flat, tool) });
    }
  }
  return out;
}

const words = (s) => s.replace(TOOL_REF, ' ').replace(/[^A-Za-z]+/g, ' ').trim().split(/\s+/).filter(Boolean);

// ── the derivation, AS A FUNCTION OF THE REF ────────────────────────────────
// One function, called once per ref. `--since` calls it twice, which is the
// whole reason it is a function: the useful question is about a DIFF.
function census(ref) {
  const population = listTools(ref);

  // PARSED, NOT GREPPED — and this line is here because the grep version bit me
  // on its first run. `readFileSync(p).includes('launchBrowser')` reported 63
  // callers where the truth is 62: THIS FILE names `launchBrowser` in its own
  // header prose and counted itself. That is precisely the defect this tool
  // exists to name, committed inside the tool's own population derivation, and
  // it is the third time in one night that a string match told me a number I
  // then believed. So: comments stripped first, then a real IMPORT of
  // browser.mjs plus a real CALL. Prose about the function is not a use of it.
  const browserCallers = new Set(population.filter((t) => {
    if (!t.endsWith('.mjs') || t === 'tools/browser.mjs') return false;
    const src = readSource(t, ref);
    if (src === null) return false;
    const clean = stripJsComments(src);
    return /import\s*\{[^}]*\blaunchBrowser\b[^}]*\}\s*from\s*['"][^'"]*browser\.mjs['"]/.test(clean)
      && /\blaunchBrowser\s*\(/.test(clean);
  }));

  const invoked = new Map();
  const printed = new Map();
  const swallowed = [];
  const orphanSites = [];   // a STEP that names a tool it does not invoke, with no cost stated
  const sites = new Map();  // `tool\u0000list` -> how many invocation sites
  const problems = [];
  const note = (map, k, v) => { if (!map.has(k)) map.set(k, []); map.get(k).push(v); };

  for (const { path, kind } of GATE_LISTS) {
    const text = readSource(path, ref);
    if (text === null) { problems.push(`declared gate list ${path} could not be read${ref ? ` at ${ref}` : ''} — the census cannot be taken`); continue; }
    if (kind === 'workflow') {
      const payloads = readWorkflow(text);
      if (!payloads.length) { problems.push(`${path}: no \`run:\` payloads were read — the workflow reader did not recognise this file's shape, so absence here is UNKNOWN and not zero`); continue; }
      for (const { body, continueOnError } of payloads) {
        const setPlusE = /^\s*set\s+\+e\b/m.test(stripShellComments(body));
        const cmds = shellCommands(body);
        // ⚠ THE SCOPE IS THE STEP, NOT THE LIST, AND THAT IS THE WHOLE FIX.
        // Judging a printed name against "is this tool invoked ANYWHERE in this
        // file" exempts a step that has quietly stopped running its tool while a
        // sibling step keeps the tool-level listing alive. That is #295's defect
        // one degree finer — not "a tool in no list" but "a tool in a list that
        // has stopped running it HERE — and the difference between `listed` and
        // `run where it is supposed to be run` is the distinction this whole
        // card exists on. Site-local, so it needs NO baseline and no frozen
        // count: a step that names a tool it does not invoke either states a
        // cost or is a finding.
        const stepInvoked = new Set();
        const stepPrinted = [];
        for (const [idx, { cmd, after }] of cmds.entries()) {
          for (const t of invocationsIn(cmd)) {
            note(invoked, t, path);
            stepInvoked.add(t);
            sites.set(`${t}\u0000${path}`, (sites.get(`${t}\u0000${path}`) || 0) + 1);
            const next = cmds[idx + 1];
            const why = after === '||' ? 'it sits on the left of `||`, so a failure is discarded'
              : (after === ';' && next && /^true\b/.test(next.cmd)) ? 'it is followed by `; true`, which discards the failure'
              : setPlusE ? 'the payload runs under `set +e`, so a failure does not stop the step'
              : continueOnError ? 'the step is marked `continue-on-error: true`, so a failure does not fail the job'
              : null;
            if (why) swallowed.push({ tool: t, list: path, why });
          }
          for (const r of printedRefs(cmd)) stepPrinted.push(r);
        }
        for (const r of stepPrinted) {
          note(printed, r.tool, { list: path, said: r.said });
          const excused = !r.commandForm && words(r.said).length >= MIN_COST_WORDS;
          if (!stepInvoked.has(r.tool) && !excused) {
            orphanSites.push({ tool: r.tool, list: path, said: r.said.slice(0, 70),
              why: r.commandForm ? 'printed in COMMAND FORM (`node <tool>`) by a step that does not run it' : 'named with no cost stated' });
          }
        }
      }
    } else {
      // THE JS ANALOGUE OF A STEP IS THE FILE. A JS gate list has no `run:`
      // payloads to scope by, so the orphan test runs at file scope: a tool this
      // list PRINTS, does not INVOKE anywhere in the file, and states no cost.
      // ⚠ THIS BRANCH WAS SILENT FOR ONE COMMIT. Step-scoping G1 moved its
      // finding source to `orphanSites`, which only the shell reader filled, so
      // JS printed names stopped being checked at all — a check narrowed in one
      // venue and switched OFF in the other. Caught by plant 5 going NOT CAUGHT.
      const clean = stripJsComments(text);
      const fileInvoked = jsInvocations(clean);
      for (const t of fileInvoked) note(invoked, t, path);
      for (const r of jsPrintedRefs(clean)) {
        note(printed, r.tool, { list: path, said: r.said });
        const excused = !r.commandForm && words(r.said).length >= MIN_COST_WORDS;
        if (!fileInvoked.has(r.tool) && !excused) {
          orphanSites.push({ tool: r.tool, list: path, said: r.said.slice(0, 70),
            why: r.commandForm ? 'printed in COMMAND FORM (`node <tool>`) by a list that does not run it' : 'named with no cost stated' });
        }
      }
    }
  }

  let linkRoots = null;
  {
    const lc = readSource('tools/linkcheck.mjs', ref);
    const m = lc && lc.match(/const ROOTS = \[([^\]]*)\]/);
    if (m) linkRoots = m[1].split(',').map((x) => x.trim().replace(/['"]/g, '')).filter(Boolean);
  }
  if (!linkRoots) problems.push('tools/linkcheck.mjs: could not read its ROOTS — the `linked-but-never-run` floor is underived, and an underived floor is not a floor');
  const linksTools = !!linkRoots && linkRoots.includes('tools');

  const bestSaid = (tool) => (printed.get(tool) || []).map((x) => x.said)
    .sort((a, b) => words(b).length - words(a).length)[0] || '';
  const stateOf = (tool) => {
    if (invoked.has(tool)) return 'listed';
    if (printed.has(tool) && words(bestSaid(tool)).length >= MIN_COST_WORDS) return 'excluded-with-a-reason';
    if (linksTools && tool.endsWith('.mjs')) return 'linked-but-never-run';
    return 'unlisted';
  };

  const rows = population.map((t) => ({
    tool: t, state: stateOf(t), by: (invoked.get(t) || []).join(' + '),
    reason: bestSaid(t), browser: browserCallers.has(t),
    printedIn: (printed.get(t) || []).map((x) => x.list),
  }));

  return { rows, invoked, printed, swallowed, orphanSites, sites, problems, linkRoots, browserCallers };
}

// ── verdict ─────────────────────────────────────────────────────────────────
const { rows, invoked, swallowed, orphanSites, sites, problems, linkRoots, browserCallers } = census(REF);

const findings = [];
let checks = 0;
const ok = (id, msg) => { checks++; console.log(`  ok   ${id} — ${msg}`); };
const bad = (id, msg) => { checks++; findings.push(id); console.log(`  BAD  ${id} — ${msg}`); };

const args = process.argv.slice(2);
const RAW = args.includes('--raw');
const ONLY_BROWSER = args.includes('--browser');

if (args.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const PLANTS = [
      {
        // ⚠ PLANT 1 — THE ONE I PERSONALLY OWE. A real invocation moved into an
        // `echo`. This is the mistake I made tonight, made re-runnable: the
        // tool must STOP reading `listed` and must say so by name.
        // ⚠ THE FIRST VERSION OF THIS PLANT WAS NOT CAUGHT, AND THE HARNESS WAS
        // RIGHT. It moved ONE of shotguard-probe's three invocations into an
        // echo — and the tool is still invoked by the other two, so `listed` is
        // the correct answer and G1 correctly said nothing. A plant that fails
        // because it was badly aimed teaches nothing about the check; this one
        // takes EVERY invocation of a tool out of command position, which is the
        // defect I actually mean. THE RESIDUE IS REAL AND IS NAMED IN THE
        // BOUNDARY: nothing here can see one STEP losing its invocation while
        // the tool stays listed elsewhere.
        name: 'every invocation of a tool is moved into an echo, so it is prose wearing coverage',
        edits: [{
          file: '.github/workflows/ci.yml',
          find: '        run: node tools/buildstamp-shot.mjs',
          all: true,
          replace: '        run: echo node tools/buildstamp-shot.mjs',
        }],
        expectRed: /BAD\s+G1 /,
      },
      {
        // ⚠ PLANT 2 — THE SECOND ONE I OWE, AND IT IS VIRA'S. `|| true` on a
        // real step. The tool is STILL `listed` — every census stays happy —
        // and the gate is silent. This is the property I claimed at #301 and
        // did not have. It must be red on a GREEN tree, which is the whole
        // point: it is the only state in which a regression can be introduced.
        name: 'a listed invocation has its exit status swallowed by `|| true`',
        edits: [{
          file: '.github/workflows/ci.yml',
          find: '        run: node tools/buildstamp-shot.mjs --selftest',
          replace: '        run: node tools/buildstamp-shot.mjs --selftest || true',
        }],
        expectRed: /BAD\s+G4 /,
      },
      {
        // PLANT 3 — the same silence at the YAML level rather than the shell's.
        name: 'a listed invocation is silenced by continue-on-error instead of by the shell',
        edits: [{
          file: '.github/workflows/ci.yml',
          find: '      - name: Storage gate holds, and a normal boot still saves',
          replace: '      - name: Storage gate holds, and a normal boot still saves\n        continue-on-error: true',
        }],
        expectRed: /BAD\s+G4 /,
      },
      {
        // PLANT 4 — an exclusion that names a tool and no cost. D78's clause.
        name: 'an exclusion declaration keeps the tool name and drops the cost',
        edits: [{
          file: '.github/workflows/ci.yml',
          find: 'echo "    tools/tutorial-reach.mjs drives 8 viewports (zoom 0.62–1.70) and NO job"',
          replace: 'echo "    tools/tutorial-reach.mjs"',
        }],
        expectRed: /BAD\s+G1 |BAD\s+G2 /,
      },
      {
        // PLANT 5 — the JS list's own door. ⚠ THE FIRST VERSION OF THIS PLANT WAS
        // ALSO NOT CAUGHT, and that failure is the most useful thing the corpus
        // produced. It redirected `surfaces`' real invocation and the tool
        // stayed GREEN — because run-node also PRINTS "`node tools/surfaces.mjs`
        // for the sets, `--selftest` for the reds", which clears a four-word
        // cost floor while saying nothing about what goes unwatched. So the word
        // floor cannot tell a boundary statement from a run-it-yourself pointer.
        // I could not close that with a rule I trust — it is a judgement about
        // English — so it is NAMED in the boundary rather than papered over, and
        // this plant now aims at what the JS reader genuinely catches: a printed
        // name for a tool the list does not run and says no cost for.
        // ⚠ RESTORED TO THE VERSION THAT ESCAPED. This plant drops `surfaces`'
        // real invocation and leaves the printed hint "`node tools/surfaces.mjs`
        // for the sets" standing. At b60503d it came back GREEN and I boundaried
        // it as "a judgement about English". Vira ruled that wrong — right about
        // the English, wrong that it was the gap — and she was correct: the
        // decidable test is FORM, not meaning. A command-form reference gets no
        // cost escape, so this is red now, and the boundary paragraph that
        // excused it is deleted rather than softened.
        name: 'a JS list drops an invocation while its printed command-form hint survives',
        edits: [{
          file: 'tests/run-node.mjs',
          find: "['tools/surfaces.mjs', ...args]",
          replace: "['tools/verify-shipped.mjs', ...args]",
        }],
        expectRed: /BAD\s+G1 /,
      },
      {
        // ⚠ PLANT 6 — THE REVIEWER'S OWN, AND THE THIRD I OWE. Only hintstrip's
        // MAIN step is emptied into an echo; its `--selftest` step survives, so
        // the tool stays `listed` and G4 has a live invocation to bless. The
        // list-scoped G1 this file shipped at b60503d could not discriminate
        // this — it needed EVERY invocation of a tool removed. The step-scoped
        // G1 fires on the one site. This is the residue I named in my own
        // boundary and shipped behind it: a stated boundary is not a discharged
        // one (Vira's law, in her words).
        name: 'ONE step is emptied into an echo while a sibling step keeps the tool listed',
        edits: [{
          file: '.github/workflows/ci.yml',
          find: '        run: node tools/hintstrip.mjs\n',
          replace: '        run: echo node tools/hintstrip.mjs\n',
        }],
        expectRed: /BAD\s+G1 /,
      },
      {
        // PLANT 7 — a declared home stops being readable. Not a smaller census:
        // exit 2, `unknown`, which blocks.
        name: 'a declared gate list stops being recognisable and the census may not shrink quietly',
        edits: [{
          file: '.github/workflows/ci.yml',
          find: '        run: ',
          all: true,
          replace: '        x-run-removed-by-plant: ',
        }],
        expectRed: /BAD\s+G3 |no `run:` payloads/,
      },
  ];
  const code = await doorSelftest({ tool: 'gatelist.mjs', timeoutMs: 120000, extraCopy: ['.github', 'tests'], plants: PLANTS });
  // The corpus's own verdict, in the shape tests/run-node.mjs quotes. The plant
  // count is READ OFF THE ARRAY, never typed — a corpus that silently shrinks
  // would otherwise keep printing the number it used to be. (Without this line
  // the suite reads exit 0 and NO RESULT, which it correctly calls a FAIL: the
  // harness could not read the tool. It caught me on the first wiring.)
  console.log(`\nRESULT: known-bad recall ${code === 0 ? `${PLANTS.length}/${PLANTS.length}` : 'INCOMPLETE'} `
    + `— ${PLANTS.length} plants + 1 clean baseline, each entering as file bytes in a copied real tree, `
    + `tool run whole from that copy.`);
  process.exit(code);
}

console.log('gatelist — which instruments does a gate actually RUN, and does it listen?');
console.log('DOOR: the declared gate lists are PARSED, never grepped. A shell `run:` payload is');
console.log('      comment-stripped, split into commands and tokenized; a tool counts only in');
console.log('      COMMAND POSITION after `node`. A JS list is comment-stripped and a tool counts');
console.log('      only inside a spawning call\'s argv array. A name reached any other way is');
console.log('      PROSE — and if it is PRINTED prose it must state what goes unwatched.');
console.log(`      Homes: ${GATE_LISTS.map((g) => g.path).join(' · ')}`);
console.log('');

if (problems.length) {
  for (const p of problems) bad('G3', p);
  console.log('');
  console.log(`RESULT: UNKNOWN — ${problems.length} declared home(s) could not be read, so no census was taken.`);
  console.log('BOUNDARY: exit 2 is `unknown`, which blocks. It is NOT a verdict about coverage —');
  console.log('          nothing here says any tool is, or is not, in a list.');
  process.exit(2);
}
ok('G3', `all ${GATE_LISTS.length} declared homes read and recognised; linkcheck ROOTS = [${linkRoots.join(', ')}]`);

// G1 IS JUDGED PER STEP, NOT PER LIST. `orphanSites` holds every step that
// names a tool it does not itself invoke without stating a cost — which catches
// a step emptied into an `echo` while a SIBLING step keeps the tool-level
// listing alive. The old list-scoped test could not see that, and said so only
// in prose. (Reviewer P3 at b60503d; the residue was one I had named myself and
// shipped behind a boundary — a stated boundary is not a discharged one.)
if (orphanSites.length) {
  bad('G1', `${orphanSites.length} step(s) NAME a tool in executed output that the SAME step does not invoke, `
    + `and state no cost — a step that has quietly stopped running its tool while the list still lists it: `
    + orphanSites.map((o) => `${o.tool} in ${o.list} — ${o.why} ("${o.said}")`).join(' · '));
} else {
  const printedCount = rows.filter((r) => r.printedIn.length).length;
  ok('G1', `every step that names a tool in executed output either invokes it in that same step or states what `
    + `goes unwatched (${printedCount} tool(s) named across the lists, ${rows.filter((r) => r.state === 'listed').length} invoked)`);
}

const excludedRows = rows.filter((r) => r.state === 'excluded-with-a-reason');
const shrugs = excludedRows.filter((r) => words(r.reason).length < MIN_COST_WORDS);
if (shrugs.length) {
  bad('G2', `${shrugs.length} exclusion(s) name a tool and no cost: ${shrugs.map((r) => `${r.tool} ("${r.reason.slice(0, 40)}")`).join(' · ')}`);
} else {
  ok('G2', `all ${excludedRows.length} exclusion declaration(s) state a cost beyond the tool's own name `
    + `(floor: ${MIN_COST_WORDS} words; the live models are tutorial-reach and release-shots)`);
}

// G4's VENUE IS DERIVED, NOT TYPED — the audited set is exactly the shell lists,
// read off GATE_LISTS, so adding a list of either kind cannot leave this claim
// silently wrong.
const SHELL_LISTS = GATE_LISTS.filter((g) => g.kind === 'workflow').map((g) => g.path);
const JS_LISTS = GATE_LISTS.filter((g) => g.kind !== 'workflow').map((g) => g.path);
const shellInvocations = [...invoked.entries()].filter(([, ls]) => ls.some((l) => SHELL_LISTS.includes(l))).length;

if (swallowed.length) {
  bad('G4', `${swallowed.length} invocation(s) in a SHELL gate list run with their exit status DISCARDED — `
    + `listed, and silent: ${swallowed.map((s) => `${s.tool} in ${s.list} (${s.why})`).join(' · ')}`);
} else {
  ok('G4', `every one of the ${shellInvocations} invocation(s) in ${SHELL_LISTS.join(', ')} can fail the job that runs it `
    + '(no `|| true`, no `; true`, no `set +e`, no `continue-on-error: true`) — SHELL LISTS ONLY, see the refusal below');
}

// ⚠ WHAT G4 REFUSES TO CLAIM, BY NAME, EVERY RUN — AND ITS OWN HOME IS ON THE LIST.
// Printed unconditionally, green or red, because a narrowed claim that is only
// narrow in a comment is a general claim in practice.
if (JS_LISTS.length) {
  const jsInvoked = [...invoked.entries()].filter(([, ls]) => ls.some((l) => JS_LISTS.includes(l))).length;
  console.log('');
  console.log(`⚠ G4 IS NOT AUDITED IN JAVASCRIPT GATE LISTS: ${JS_LISTS.join(', ')} — ${jsInvoked} invocation(s) there`);
  console.log('  are marked `listed` and their status propagation is UNCHECKED. An ignored `spawnSync`');
  console.log('  result, or `try { execFileSync(...) } catch {}`, is silent and this tool will not say so.');
  console.log('  ⚠ AND THIS TOOL RUNS INSIDE ONE OF THEM (tests/run-node.mjs, 62/63), so the check built to');
  console.log('  ask "does this list listen?" IS DEAF IN ITS OWN VENUE and would report it clean.');
  console.log('  NOT CLOSED BY A HEURISTIC, DELIBERATELY. Proving it needs real dataflow — the pattern in');
  console.log('  that suite is try/catch -> a `{ code }` object -> an accumulator -> process.exit() — and');
  console.log('  a near-enough rule here would be this file claiming a property it does not have, which is');
  console.log('  the exact defect it exists to name. Stated instead, so the red arrives the day someone');
  console.log('  builds it rather than the day someone trusts it. (Reviewer P2 at 11ec9ab; the analysis is');
  console.log('  owed as a card and I did not file one — this act was one act.)');
}

const shown = ONLY_BROWSER ? rows.filter((r) => r.browser) : rows;
const count = (s) => shown.filter((r) => r.state === s).length;
const STATES = ['listed', 'excluded-with-a-reason', 'linked-but-never-run', 'unlisted'];

console.log('');
if (RAW) {
  for (const r of shown) {
    // SITE COUNTS, reported: `listed` says a tool is run SOMEWHERE; the count
    // says in how many places. That is the difference between "this tool is
    // listed" and "this tool is run where it is supposed to be run", and it is
    // the distinction #295 exists on. Reported and NOT asserted — asserting a
    // count needs a baseline, a baseline is a frozen number in a second home,
    // and the step-scoped G1 above catches the real defect without one.
    // ⚠ THE COUNT IS PRINTED ONLY WHERE IT WAS MEASURED. Sites are counted in
    // the shell reader; the JS reader collects a SET and has no per-site count.
    // The first version printed `×1` for JS rows from a `|| 1` fallback — a
    // number I had not measured, displayed as if I had, in the very tool whose
    // subject is that mistake. JS rows now carry no multiplier at all.
    const siteNote = (invoked.get(r.tool) || [])
      .filter((l, i, a) => a.indexOf(l) === i)
      .map((l) => {
        const n = sites.get(`${r.tool}\u0000${l}`);
        return n === undefined ? l : `${l}\u00d7${n}`;
      }).join(' + ');
    console.log(`  ${r.state.padEnd(22)} ${r.browser ? '[browser] ' : '          '}${r.tool}`
      + (siteNote ? `  <- ${siteNote}` : '') + (r.reason ? `  :: ${r.reason.slice(0, 56)}` : ''));
  }
  console.log('');
}
console.log(`⚠ REPORTED, NOT ASSERTED — the disposition census over ${shown.length} tool(s)`
  + `${ONLY_BROWSER ? ' (launchBrowser callers only)' : ''}:`);
for (const s of STATES) console.log(`    ${String(count(s)).padStart(4)}  ${s}`);
console.log(`  Of the ${browserCallers.size} launchBrowser callers, ${rows.filter((r) => r.browser && r.state === 'listed').length} are executed by a declared gate list.`);

// SAGA'S EDGE, MEASURED. The workflow carries a job literally named "what this
// green does NOT cover", and it honestly names several uncovered browser tools.
// IT IS A HAND-MAINTAINED LIST TOO. So a browser instrument can be not merely
// uncovered but UNDISCLOSED — missed by the very mechanism built to disclose
// gaps. That is the same defect one surface over, and this line is the only
// place it is counted.
{
  const undisclosed = rows.filter((r) => r.browser && r.state !== 'listed' && !r.printedIn.length);
  const disclosed = rows.filter((r) => r.browser && r.state === 'excluded-with-a-reason');
  console.log(`  Disclosure: ${disclosed.length} of the ${browserCallers.size} are NAMED in a boundary block; `
    + `${undisclosed.length} are UNDISCLOSED — uncovered, and missed by the mechanism built to disclose gaps.`);
  if (undisclosed.length) {
    console.log(`    first five: ${undisclosed.slice(0, 5).map((r) => r.tool).join(', ')}${undisclosed.length > 5 ? ' …' : ''}`);
  }
}

// THE DELTA — the question that is actually about a diff. The unlisted set is a
// RATE, not a backlog: dev has 62 browser callers and PR #290's head has 65.
// This is REPORTED, and the gate that would REFUSE such a ref is deliberately
// NOT built here (D78 rules dispositions first).
if (SINCE) {
  const base = census(SINCE);
  if (base.problems.length) {
    console.log(`  --since ${SINCE}: UNKNOWN — the base ref's homes could not be read, so no delta was taken.`);
  } else {
    const was = new Set(base.rows.map((r) => r.tool));
    const added = rows.filter((r) => !was.has(r.tool));
    const addedUnlisted = added.filter((r) => r.state !== 'listed' && r.state !== 'excluded-with-a-reason');
    console.log('');
    console.log(`⚠ DELTA against ${SINCE} — ${added.length} tool(s) added, `
      + `${added.filter((r) => r.browser).length} of them browser instruments:`);
    for (const r of added) console.log(`    ${r.state.padEnd(22)} ${r.browser ? '[browser] ' : '          '}${r.tool}`);
    console.log(`  ${addedUnlisted.length} added tool(s) join no list and state no cost. THIS IS THE FORWARD QUESTION —`);
    console.log('  #295 was one instrument that fell out of every list; a ref that ADDS one is the same');
    console.log('  defect arriving. Reported here, never refused: the gate that would refuse it needs');
    console.log("  D78's dispositions filed first, and it is not built in this act.");
  }
}
console.log('  WHETHER a tool ought to be wired is a design call with real costs (D78: the default');
console.log('  disposition is `excluded-with-a-reason`, and a wiring spree buys the APPEARANCE of');
console.log('  coverage with a browser budget). This file does not make that call and does not');
console.log('  score it. BECOMES AN ASSERTION the day those dispositions are filed — then every');
console.log('  tool has a state by somebody\'s hand, `unlisted` is a defect, and this paragraph is');
console.log('  DELETED rather than softened.');
console.log('');

const tail = () => {
  console.log('BOUNDARY: this reads what the declared lists EXECUTE and whether they listen. It is');
  console.log('          silent on whether a listed tool PASSES, on instruments a person starts at a');
  console.log('          terminal, and on any list not declared above — a gate that lives only in a');
  console.log('          PR body is invisible here, which is the hole SOP 14 §5a exists to name.');
  console.log('          G1 IS STEP-SCOPED and catches a step emptied into an `echo`. It does NOT see a');
  console.log('          step DELETED OUTRIGHT while another invocation of the same tool survives —');
  console.log('          nothing names it, so nothing fires. That needs a per-site baseline, which is a');
  console.log('          frozen number in a second home; stated rather than planted.');
  console.log('          G4 covers SHELL lists only — JavaScript gate lists are refused by name above,');
  console.log('          including the one this tool runs inside. It also does not see a masked pipeline');
  console.log('          (`cmd | tee`) or a wrapper that exits 0 on its own.');
  console.log('          THE COST ESCAPE DOES NOT APPLY TO A COMMAND-FORM REFERENCE. A line that spells');
  console.log('          `node <tool>` is the command a reader would type, and reads as "this list runs');
  console.log('          this", so the list that prints it must invoke it. Judged by FORM, never by');
  console.log('          English — a boundary line names its tool BARE, which is the convention in every');
  console.log("          one of ci.yml's boundary lines. This retired a boundary I had shipped over a");
  console.log('          decidable defect (Vira at 11ec9ab).');
};
if (findings.length) {
  console.log(`RESULT: ${findings.length} finding(s) over ${checks} check(s) — ${findings.join(', ')}.`);
  tail();
  process.exit(1);
}
console.log(`RESULT: OK — ${checks} check(s), 0 findings; ${count('listed')} of ${shown.length} tool(s) executed by a declared gate list.`);
tail();
process.exit(0);
