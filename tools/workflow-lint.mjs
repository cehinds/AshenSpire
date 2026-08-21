#!/usr/bin/env node
// tools/workflow-lint.mjs — THE DOOR CANNOT SEE THE WIRING ABOVE ITSELF.
//
// tools/verdict.mjs makes a tool's silence audible, but it only speaks when the
// step RUNS. A step with no command, or a step whose command was overwritten by
// a duplicate YAML key, never reaches the door at all — it is silence one level
// up, and it is invisible to every check inside the process.
//
// THIS IS NOT HYPOTHETICAL. The first cut of the PR that added the door shipped
// exactly that defect: `- name: Engine suite` with NO `run:`, and the following
// step carrying TWO `run:` keys. The suite would have silently not run, or the
// door's own self-test would have been overwritten. Two reviewers caught it on
// the pushed head; my local YAML check passed it, because `yaml.safe_load`
// resolves duplicate keys last-wins WITHOUT COMPLAINING — my validation was
// itself a silent green, which is the card's defect class a third time.
//
// So this reads the workflow AS TEXT, where the duplicate is visible, rather
// than through a parser that has already thrown the evidence away.
//
// Usage
//   node tools/workflow-lint.mjs                 lint .github/workflows/*.yml
//   node tools/workflow-lint.mjs --selftest      the known-bads, each a file
//
// Exit codes
//   0  every step in every workflow carries exactly one command
//   1  a finding (named, with file and line)
//   2  usage / nothing to lint — never a pass

import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Findings for one workflow's text. A "step" is a `- ` list item under a
 * `steps:` key; its own keys are the lines at the item's key indent. Text, not
 * a parse tree, because the defect being hunted is invisible after parsing.
 */
/**
 * A line with its trailing YAML comment removed, for STRUCTURAL matching only.
 *
 * Every key pattern in this file anchored INDENTATION and stayed COMMENT-BLIND,
 * so `build: # Linux job` was not a job header (the next bare `steps:` was
 * consumed as one and the job never examined) and `steps: # checks` made the
 * whole list invisible — the lint reporting success while the exact last-wins
 * defect it gates sailed through. Two symptoms, one class, so this is one
 * helper used at EVERY key match rather than two patched patterns.
 *
 * Quote-aware, because `run: echo "# not a comment"` must keep its value; a
 * `#` counts only at line start or after whitespace, outside quotes. Block
 * scalar bodies never reach here — they are skipped as payload upstream.
 */
export function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).trimEnd();
  }
  return line;
}

/**
 * ONE RECOGNIZER FOR "IS THIS A KEY, AND WHICH ONE" — used at every key match
 * in this file. Third variation on one axis arrived before this existed: I
 * generalized over INDENTATION (the matrix axis), then over COMMENTS
 * (`build: # Linux job`), and a QUOTED key (`"build":`) walked past both. The
 * shapes were different; the class never was. A YAML key may be quoted or
 * bare, may carry a trailing comment, and sits at a known indent — so that is
 * one function, not three patched patterns.
 *
 * Returns `{ indent, item, name, rest, keyIndent }` or null. `item` marks a
 * `- ` list entry; `keyIndent` is where the entry's OWN keys sit.
 */
export function readKey(code) {
  const m = code.match(/^(\s*)(?:(-)\s+)?(?:"([^"]*)"|'([^']*)'|([\w.\-]+))\s*:(.*)$/);
  if (!m) return null;
  const name = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[5]);
  return { indent: m[1].length, item: !!m[2], name, rest: m[6], keyIndent: m[1].length + (m[2] ? 2 : 0) };
}

/**
 * WHAT FORMS MAY A YAML LIST ITEM TAKE — asked once, here, instead of being
 * discovered one variation at a time. This is the fourth pass over the same
 * axis: indentation, then comments, then quoting, and now the SEQUENCE
 * INDICATOR ITSELF, which need not share a line with its content:
 *
 *     - name: Build          the dash carries the first key
 *     - "name": Build        …which may be quoted
 *     -                      the dash stands ALONE and the keys follow,
 *       name: Build          indented under it, at any deeper column
 *     - run: |               …and the first key may open a block scalar
 *
 * `readItem` answers "does this line START a list entry, and does it carry its
 * first key". A dash-only entry is real and was worth zero findings before:
 * no step object was created at all, so a duplicate `run:` inside it — or no
 * command whatsoever — reported nothing, which is the exact silence this lint
 * exists to break, in the lint.
 */
/** Split a flow mapping's body on top-level commas (quote and bracket aware). */
export function splitFlow(body) {
  const parts = [];
  let depth = 0, q = null, cur = '';
  for (const c of body) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '{' || c === '[') depth++;
    if (c === '}' || c === ']') depth--;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

export function readItem(code) {
  const bare = code.match(/^(\s*)-\s*$/);
  if (bare) return { indent: bare[1].length, key: null };
  const k = readKey(code);
  if (k && k.item) return { indent: k.indent, key: k };
  return null;
}

// A BLOCK HEADER MAY CARRY AN INDENTATION INDICATOR AS WELL AS A CHOMPING ONE,
// in either order: `|`, `|-`, `|+`, `|2`, `|2-`, `|-2`, and the `>` folded
// forms. Recognising only chomping made `run: |2` not-a-block, so the scalar's
// payload was parsed as structure and repeated `key:` lines inside a heredoc
// were reported as duplicate keys — a VALID workflow, red forever.
const isBlockScalar = (k) => !!k && /^\s*[|>](?:\d+[-+]?|[-+]\d*)?\s*$/.test(k.rest);

export function lintWorkflowText(text, file = '<text>') {
  const findings = [];
  let checks = 0;
  const lines = String(text).split(/\r\n|\r|\n/);
  const indentOf = (l) => l.match(/^\s*/)[0].length;

  // ---------------------------------------------------------------------
  // ONE MECHANISM, EVERY LEVEL. Last-wins is a property of YAML MAPPINGS,
  // not of any particular key, so it is asserted once here for whatever
  // mapping the walk is standing in — the document root, the `jobs:`
  // mapping (job IDs), a job's own keys, a step's keys, and anything
  // deeper (`with:`, `env:`) for free.
  //
  // I checked four of those levels one at a time, each after being shown
  // it: duplicate `run:` in a step, duplicate `steps:` in a job, duplicate
  // job IDs, duplicate top-level `jobs:`. Four symptoms, one defect — the
  // parser could not name the level it was in, so every level needed its
  // own hand-written check and the next one was always missing.
  //
  // A CONTEXT is a mapping at one indent. A list entry always opens a
  // FRESH context, so two steps may both carry `name:` while one step may
  // not carry `run:` twice.
  // ---------------------------------------------------------------------
  const stack = [{ indent: -1, seen: new Map(), label: 'the document root', isStep: false, line: 0, name: null }];
  const top = () => stack[stack.length - 1];
  const pathOf = () => stack.map((c) => c.label).filter(Boolean).slice(1).join(' → ') || 'the document root';

  const closeContext = (ctx) => {
    if (!ctx.isStep) return;
    const cmds = (ctx.seen.has('run') ? 1 : 0) + (ctx.seen.has('uses') ? 1 : 0);
    checks += 1;
    if (cmds === 0) {
      findings.push(`${file}:${ctx.line}: step ${JSON.stringify(ctx.name || '(unnamed)')} carries NO \`run:\` and NO \`uses:\` — it can never execute, and a step that never runs never reaches the verdict door (#12).`);
    }
  };
  const popTo = (indent) => { while (stack.length > 1 && top().indent >= indent) closeContext(stack.pop()); };
  const popDeeper = (indent) => { while (stack.length > 1 && top().indent > indent) closeContext(stack.pop()); };

  const record = (name, indent, line, label) => {
    checks += 1;
    const ctx = top();
    if (ctx.seen.has(name)) {
      findings.push(`${file}:${line}: duplicate key ${JSON.stringify(name)} in ${ctx.label} (first at line ${ctx.seen.get(name)}) — YAML resolves duplicates last-wins SILENTLY, so everything under the earlier one is discarded without a word.`);
    } else {
      ctx.seen.set(name, line);
    }
    return ctx;
  };

  let jobsIndent = -1;      // indent of the `jobs:` key
  let jobIndent = -1;       // indent of a job ID under it
  let jobKeyIndent = -1;    // indent of a job's own keys
  let pendingItem = null;   // a dash-only entry waiting for its first key
  let skipDeeperThan = -1;  // inside a block scalar: payload, not structure

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\t/g, '  ');
    if (skipDeeperThan >= 0) {
      if (!line.trim() || indentOf(line) > skipDeeperThan) continue;
      skipDeeperThan = -1;
    }
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const code = stripComment(line);
    if (!code.trim()) continue;
    const indent = indentOf(code);

    // A MULTI-DOCUMENT STREAM RESTARTS EVERY MAPPING. Without this, keys in
    // the second document collide with the first and every one reads as a
    // duplicate — and `---` was previously just an unclassified line.
    if (/^(?:---|\.\.\.)(\s|$)/.test(code.trim())) {
      popTo(-1);
      stack.length = 1;
      stack[0].seen = new Map();
      jobsIndent = -1; jobIndent = -1; jobKeyIndent = -1; pendingItem = null;
      continue;
    }

    // A FLOW-STYLE ENTRY IS STILL AN ENTRY: `- { name: X, run: a, run: b }`.
    // Neither bare nor readKey-shaped, so no step context was created at all
    // and a duplicate command sailed through as NO FINDINGS.
    const flow = code.match(/^(\s*)-\s*\{(.*)\}\s*$/);
    if (flow) {
      popTo(flow[1].length);
      const parent = top();
      const isStep = parent.pendingLabel === 'steps' && parent.pendingStepsList === true;
      const ctx = { indent: flow[1].length + 2, seen: new Map(), label: isStep ? 'a step' : 'a list entry', isStep, line: i + 1, name: null };
      stack.push(ctx);
      // NESTED FLOW COLLECTIONS RECURSE. `with: { node-version: 22,
      // node-version: 24 }` inside a flow step recorded only the TOP-LEVEL
      // pairs, so a duplicate one level in was invisible — while this file
      // now CLAIMS duplicates at every mapping level. A tool that claims a
      // property it does not have is worse than one that admits the gap, so
      // either it recurses or it refuses; recursion here is six lines.
      const walkFlow = (body, label, depth) => {
        if (depth > 8) {
          findings.push(`${file}:${i + 1}: flow mapping nested deeper than this linter walks — refused BY NAME rather than read as "nothing here".`);
          return;
        }
        for (const pair of splitFlow(body)) {
          const kv = readKey(pair.trim());
          if (!kv) continue;
          if (kv.name === 'name' && !ctx.name && depth === 0) ctx.name = kv.rest.trim();
          record(kv.name, ctx.indent, i + 1);
          const nested = kv.rest.trim().match(/^\{(.*)\}$/);
          if (nested) {
            const child = { indent: ctx.indent + 1, seen: new Map(), label: kv.name, isStep: false, line: i + 1, name: null };
            stack.push(child);
            walkFlow(nested[1], kv.name, depth + 1);
            stack.pop();
          }
        }
      };
      walkFlow(flow[2], ctx.label, 0);
      closeContext(stack.pop());
      continue;
    }

    const item = readItem(code);
    if (item) {
      // A list entry ends the previous entry and opens a fresh mapping.
      popTo(item.indent);
      const parent = top();
      // A SEQUENCE IS NOT A MAPPING, so `steps:` opens no context of its own —
      // its items hang off the JOB's mapping. The step-ness of an entry is
      // therefore carried by the key that last opened a block in the parent.
      const isStep = parent.pendingLabel === 'steps' && parent.pendingStepsList === true;
      if (item.key) {
        const ctx = { indent: item.key.keyIndent, seen: new Map(), label: isStep ? 'a step' : 'a list entry', isStep, line: i + 1, name: null };
        stack.push(ctx);
        if (item.key.name === 'name') ctx.name = item.key.rest.trim();
        record(item.key.name, item.key.keyIndent, i + 1);
        if (isBlockScalar(item.key)) skipDeeperThan = item.key.keyIndent - 1;
      } else {
        // Dash alone: the first key below fixes the column.
        pendingItem = { indent: item.indent, isStep, line: i + 1 };
      }
      continue;
    }

    const k = readKey(code);
    if (!k) {
      // THE ASYMMETRY THIS CLOSES, and it is the defect behind five of this
      // card's findings. verdict.mjs holds a CLOSED grammar where unknown
      // grammar reads as SILENCE, loudly, naming the tool — the safe
      // direction. This file held an OPEN-ENDED GUESS where unknown structure
      // read as ABSENCE, silently: every YAML form it did not know was a
      // silent pass (flow mappings) or a false red (indentation indicators),
      // waiting to be found by someone enumerating faster than I generalise.
      //
      // Two shapes are legitimately not mapping keys and are accepted rather
      // than refused: a bare sequence scalar (`- one`, a matrix axis value)
      // and a plain multi-line scalar's continuation (a more-indented line
      // carrying no colon).
      // ANCHORS, ALIASES AND TAGS ARE STRUCTURE I DO NOT FOLLOW, and `- &a` is
      // textually indistinguishable from the scalar `- one`. An alias can
      // expand into a mapping whose keys I would never see, so these are
      // refused BY NAME rather than guessed at — the same call the door makes
      // about a grammar it does not speak.
      const yamlMeta = /^\s*-?\s*[&*!]/.test(code);
      const scalarItem = !yamlMeta && /^\s*-\s+\S/.test(code) && !code.includes(':');
      const scalarBody = !yamlMeta && indent > top().indent && !code.includes(':') && !/^\s*-/.test(code);
      if (scalarItem || scalarBody) continue;
      checks += 1;
      findings.push(`${file}:${i + 1}: unrecognised YAML form — ${JSON.stringify(code.trim().slice(0, 60))}. This linter reads a CLOSED set of forms; anything else is refused BY NAME rather than read as "nothing here", because an unknown form silently skipped is how a duplicate key gets through a duplicate-key checker (#12). Teach this file the form, or say why it is not structure.`);
      continue;
    }

    if (pendingItem && indent > pendingItem.indent) {
      const ctx = { indent, seen: new Map(), label: pendingItem.isStep ? 'a step' : 'a list entry', isStep: pendingItem.isStep, line: pendingItem.line, name: null };
      stack.push(ctx);
      pendingItem = null;
    } else if (pendingItem) {
      pendingItem = null;
    }

    popDeeper(indent);
    if (top().indent < indent) {
      // The sentinel sits at -1 and the document's own top-level keys sit at
      // 0, so the FIRST context pushed IS the document root — labelling it
      // 'a mapping' is what kept `jobs:` from ever being recognised there.
      const parent = top();
      stack.push({
        indent,
        seen: new Map(),
        label: stack.length === 1 ? 'the document root' : (parent.pendingLabel || 'a mapping'),
        isStep: false,
        line: i + 1,
        name: null,
        stepsList: parent.pendingStepsList === true,
      });
    }

    const ctx = record(k.name, indent, i + 1);
    if (ctx.isStep && k.name === 'name' && !ctx.name) ctx.name = k.rest.trim();

    // Track where we are, so `steps:` can be recognised at JOB level only —
    // a matrix axis named `steps` is a mapping key like any other.
    if (k.name === 'jobs' && !k.rest.trim() && ctx.label === 'the document root') { jobsIndent = indent; jobIndent = -1; jobKeyIndent = -1; }
    if (jobsIndent >= 0 && indent > jobsIndent && !k.rest.trim() && ctx.indent === (jobIndent === -1 ? indent : jobIndent) && ctx.label !== 'a step') {
      if (jobIndent === -1) jobIndent = indent;
      if (indent === jobIndent) jobKeyIndent = -1;
    }
    if (jobIndent >= 0 && indent > jobIndent && (jobKeyIndent === -1 || indent < jobKeyIndent)) jobKeyIndent = indent;

    // The context this key OPENS (if a block follows) inherits a label.
    ctx.pendingLabel = k.name;
    ctx.pendingStepsList = k.name === 'steps' && indent === jobKeyIndent;

    if (isBlockScalar(k)) skipDeeperThan = indent;
  }
  popTo(-1);
  closeContext(stack[0]);
  return Object.assign(findings, { findings, checks });
}

const SELFTEST = [
  {
    name: 'THE DEFECT THIS PR SHIPPED: a step with no run, and the next with two',
    yml: `on: push\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n      - name: Engine suite\n      - name: The door\n        run: node tools/verdict.mjs --selftest\n        run: node tests/run-node.mjs\n`,
    want: 2,
  },
  { name: 'a step with no command at all', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Ghost\n' },
  { name: 'a step with two run keys', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Twice\n        run: echo one\n        run: echo two\n' },
  // (2) THE HEREDOC CASE — a valid `run: |` block whose payload contains a line
  // that looks like a step. This repo's own boundary job is full of multi-line
  // run blocks; reading payload as structure made a valid workflow red forever
  // from a lint that gates every CI run.
  { name: 'a run: | block carrying a step-shaped line is PAYLOAD, not a step', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Boundary\n        run: |\n          cat <<EOF\n          - name: data\n          EOF\n' },
  { name: 'and a real command-less step AFTER a heredoc is still caught', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Boundary\n        run: |\n          echo "- name: data"\n      - name: Ghost\n' },
  // (3) THE LINTER'S OWN DEFECT CLASS, ONE LEVEL UP: two `steps:` in one job.
  { name: 'two steps: keys in one job — last-wins discards an ENTIRE list', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Real suite\n        run: node tests/run-node.mjs\n    steps:\n      - name: Shadow\n        run: echo nothing\n' },
  { name: 'two jobs each with their own steps: is fine', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: One\n        run: echo 1\n  b:\n    steps:\n      - name: Two\n        run: echo 2\n' },
  { name: 'nested list data under a step key is not a step', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Matrix\n        with:\n          args:\n            - name: inner\n        run: echo ok\n' },
  // THE ESCAPE A REVIEWER FOUND: a matrix axis literally named `steps`. The
  // general fix is anchoring, not a `matrix` special case — so the plant keeps
  // the axis AND a real job-level steps list, and expects silence.
  { name: 'a matrix axis named `steps` is not the job\'s steps list', want: 0,
    yml: 'on: push\njobs:\n  a:\n    strategy:\n      matrix:\n        steps:\n          - one\n          - two\n    steps:\n      - name: Real\n        run: echo ok\n' },
  { name: 'and a REAL duplicate steps: is still caught beside a matrix axis', want: 1,
    yml: 'on: push\njobs:\n  a:\n    strategy:\n      matrix:\n        steps:\n          - one\n    steps:\n      - name: Real\n        run: echo ok\n    steps:\n      - name: Shadow\n        run: echo no\n' },
  // COMMENT-BLINDNESS, both symptoms of the one class, plus the guard that
  // keeps the general fix from eating a legitimate value.
  { name: 'a job header with a trailing comment is still a job header', want: 1,
    yml: 'on: push\njobs:\n  build: # Linux job\n    steps:\n      - name: Twice\n        run: echo one\n        run: echo two\n' },
  { name: 'a steps: key with a trailing comment still opens the list', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps: # checks\n      - name: Ghost\n' },
  { name: 'a quoted # inside a run value is NOT a comment', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Hash\n        run: echo "# not a comment"\n' },
  { name: 'a commented duplicate steps: is still a duplicate', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps: # real\n      - name: One\n        run: echo 1\n    steps: # shadow\n      - name: Two\n        run: echo 2\n' },
  // THE KEY-RECOGNITION CLASS, ALL THREE FORMS, because the general rule has
  // to prove it swallows each: quoted, commented, and quoted-AND-commented.
  { name: 'a QUOTED job key is still a job header', want: 1,
    yml: 'on: push\njobs:\n  "build":\n    steps:\n      - name: Twice\n        run: echo one\n        run: echo two\n' },
  { name: 'a QUOTED + COMMENTED job key is still a job header', want: 1,
    yml: 'on: push\njobs:\n  "build": # Linux job\n    steps:\n      - name: Twice\n        run: echo one\n        run: echo two\n' },
  { name: 'a single-quoted steps: key still opens the list', want: 1,
    yml: "on: push\njobs:\n  a:\n    'steps':\n      - name: Ghost\n" },
  { name: 'a quoted step key counts as a command', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Quoted\n        "run": echo ok\n' },
  { name: 'and a quoted DUPLICATE run: is still caught', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Twice\n        "run": echo one\n        run: echo two\n' },
  // THE SEQUENCE-INDICATOR FORMS. A dash may stand alone, and its keys follow
  // at any deeper column — worth ZERO findings before, because no step object
  // was ever created.
  { name: 'a dash-only item with a duplicate run: is caught', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      -\n        name: Twice\n        run: echo one\n        run: echo two\n' },
  { name: 'a dash-only item with NO command is caught', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      -\n        name: Ghost\n' },
  { name: 'a healthy dash-only item is silent', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      -\n        name: Fine\n        run: echo ok\n' },
  { name: 'a dash-only item at a deeper key column still works', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      -\n          name: Deep\n          run: echo one\n          run: echo two\n' },
  { name: 'a dash-only item carrying a block scalar is not misread', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      -\n        name: Block\n        run: |\n          echo "- name: data"\n' },
  { name: 'mixed dash-only and inline items in one list', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Inline\n        run: echo ok\n      -\n        name: Ghost\n' },
  // LAST-WINS AT EVERY MAPPING LEVEL — the class, planted level by level so
  // the ONE mechanism has to prove it covers each. Four of these were found
  // one at a time, each after being shown; the fifth (with:) is here because
  // the mechanism gives it for free and nobody has had to report it.
  { name: 'level: duplicate top-level `jobs:` mappings', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Real\n        run: echo 1\njobs:\n  b:\n    steps:\n      - name: Shadow\n        run: echo 2\n' },
  { name: 'level: duplicate JOB IDs — the real suite vanishes', want: 1,
    yml: 'on: push\njobs:\n  test:\n    steps:\n      - name: Real\n        run: node tests/run-node.mjs\n  test:\n    steps:\n      - name: Shadow\n        run: echo nothing\n' },
  { name: 'level: duplicate job-level keys (steps:)', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: One\n        run: echo 1\n    steps:\n      - name: Two\n        run: echo 2\n' },
  { name: 'level: duplicate step-level keys (run:)', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Twice\n        run: echo one\n        run: echo two\n' },
  { name: 'level: duplicate keys inside a step\'s with: block, for free', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Setup\n        uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          node-version: 24\n' },
  { name: 'and two SIBLING steps may both carry name: and run:', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: One\n        run: echo 1\n      - name: Two\n        run: echo 2\n' },
  { name: 'and two sibling JOBS may both carry runs-on: and steps:', want: 0,
    yml: 'on: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - name: One\n        run: echo 1\n  b:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Two\n        run: echo 2\n' },
  // FLOW STYLE IS STILL A STEP (false green before).
  { name: 'form: a flow-mapping step with a duplicate run: is caught', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - { name: Twice, run: echo one, run: echo two }\n' },
  { name: 'form: a healthy flow-mapping step is silent', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - { name: Fine, run: echo ok }\n' },
  { name: 'form: a flow-mapping step with NO command is caught', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - { name: Ghost }\n' },
  // INDENTATION INDICATORS ARE BLOCK HEADERS (false red before).
  { name: 'form: run: |2 is a block scalar, its payload is not structure', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Indented\n        run: |2\n          key: one\n          key: two\n' },
  { name: 'form: run: |2- and run: >-2 are block scalars too', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: A\n        run: |2-\n          key: one\n          key: two\n      - name: B\n        run: >-\n          key: one\n          key: two\n' },
  // MULTI-DOCUMENT STREAMS RESTART EVERY MAPPING.
  { name: 'form: a second document does not collide with the first', want: 0,
    yml: '---\non: push\njobs:\n  a:\n    steps:\n      - name: One\n        run: echo 1\n---\non: push\njobs:\n  a:\n    steps:\n      - name: Two\n        run: echo 2\n' },
  // AND THE DURABLE FIX: AN UNKNOWN FORM IS REFUSED BY NAME, NOT SKIPPED.
  { name: 'form: an unrecognised YAML form is REFUSED by name, never silent', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Anchored\n        run: echo ok\n      - &alias\n' },
  { name: 'form: a bare sequence scalar (a matrix value) is accepted, not refused', want: 0,
    yml: 'on: push\njobs:\n  a:\n    strategy:\n      matrix:\n        os:\n          - ubuntu-latest\n          - windows-latest\n    steps:\n      - name: One\n        run: echo 1\n' },
  { name: 'form: a plain multi-line scalar body is accepted, not refused', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Plain\n        run: echo ok\n        continue-on-error: false\n' },
  { name: 'form: a duplicate inside a NESTED flow mapping is caught', want: 1,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - { name: Setup, uses: actions/setup-node@v4, with: { node-version: 22, node-version: 24 } }\n' },
  { name: 'form: a healthy nested flow mapping is silent', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - { name: Setup, uses: actions/setup-node@v4, with: { node-version: 22, cache: npm } }\n' },
  { name: 'a healthy workflow is silent', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n      - name: Fine\n        run: echo ok\n' },
  { name: 'a step whose command is `uses` is a command too', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n' },
  { name: 'multi-line run blocks are one command', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Block\n        run: |\n          echo one\n          run: not-a-key\n' },
  { name: 'keys after a step (env, with) are not commands and not duplicates', want: 0,
    yml: 'on: push\njobs:\n  a:\n    steps:\n      - name: Env\n        env:\n          A: 1\n        run: echo ok\n' },
];

// MAIN-MODULE GUARD, spelled with the platform API rather than by string
// concatenation — that exact hand-rolled comparison is #12's instance 1 and
// #13's whole subject. Without it, importing this module to reuse
// `lintWorkflowText` RUNS the CLI and exits the caller: I hit that within a
// minute of writing the file.
const IS_MAIN = import.meta.url === pathToFileURL(process.argv[1] || '').href;

if (IS_MAIN && process.argv.includes('--selftest')) {
  const dir = mkdtempSync(resolve(tmpdir(), 'workflow-lint-'));
  let bad = 0;
  console.log('workflow-lint --selftest — each plant is a FILE, read the way the real lint reads\n');
  try {
    for (const p of SELFTEST) {
      const f = resolve(dir, `plant-${SELFTEST.indexOf(p)}.yml`);
      writeFileSync(f, p.yml);
      const found = lintWorkflowText(readFileSync(f, 'utf8'), f);
      const ok = found.length === p.want;
      if (!ok) bad++;
      console.log(`  ${ok ? 'CAUGHT ' : 'MISSED '} ${found.length} finding(s), want ${p.want}  ${p.name}`);
      if (!ok) found.forEach((x) => console.log(`      ${x}`));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  console.log('');
  if (bad) { console.error(`workflow-lint --selftest: RED — ${bad} plant(s) not caught.`); process.exit(1); }
  console.log(`workflow-lint --selftest: OK — ${SELFTEST.length} checks passed.`);
  process.exit(0);
}

if (!IS_MAIN) { /* imported for lintWorkflowText — the CLI below is not ours to run */ }
else {
const dir = resolve(ROOT, '.github/workflows');
if (!existsSync(dir)) { console.error('workflow-lint: no .github/workflows — nothing to lint, and that is not a pass.'); process.exit(2); }
const files = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
if (!files.length) { console.error('workflow-lint: no workflow files found — nothing measured.'); process.exit(2); }
const findings = [];
// ONE PARSER, ONE ANSWER. This counter used to run its own narrower regex
// over the same file, so the two readers disagreed the moment readItem()
// learned dash-only entries: a workflow whose steps all use that form found
// no defects and printed "OK — 0 checks passed", and the verdict door then
// refused it — A VALID WORKFLOW MADE PERMANENTLY RED by this tool arguing
// with itself. Every other finding tonight was a false green; that one was a
// FALSE RED, manufactured by a second copy of the question inside one PR.
// The count is now what the parse actually asserted.
let checks = 0;
for (const f of files) {
  const text = readFileSync(join(dir, f), 'utf8');
  const result = lintWorkflowText(text, `.github/workflows/${f}`);
  checks += result.checks;
  findings.push(...result);
}
if (findings.length) {
  console.error(`\nworkflow-lint: FAILED ${findings.length} finding(s) over ${files.length} workflow(s).`);
  findings.forEach((x) => console.error(`  · ${x}`));
  process.exit(1);
}
// One terminated verdict line carrying a count (#12's contract), so this tool
// walks through the same door it protects.
console.log(`\nworkflow-lint: OK — ${checks} checks passed.`);
process.exit(0);
}
