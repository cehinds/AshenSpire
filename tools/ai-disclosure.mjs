#!/usr/bin/env node
// tools/ai-disclosure.mjs — the store surface of the AI-use acknowledgement and
// the falsifier for its load-bearing claim, both driven from the one home
// (src/content/aiDisclosure.js).
//
//   node tools/ai-disclosure.mjs             print the Steam disclosure field text
//   node tools/ai-disclosure.mjs --full      print the whole in-product text
//   node tools/ai-disclosure.mjs --evidence  print the verbatim commands a sceptic runs
//   node tools/ai-disclosure.mjs --check     run everything: all seven texts × every
//                                            shipped bundle, plus the runtime claim
//
// WHY THE SEARCH PATTERNS LIVE HERE AND NOT BESIDE THE CLAIM. The disclosure
// module names the AI vendor it discloses, so a pattern stored there matches its
// own text: our own falsifier came back red on a clean tree, twice, in the one
// document where credibility is the product (Sunna's D-S1 — she blocked the
// branch for it and she was right). This file is outside src/, so nothing it
// searches contains it.
//
// Zero dependencies, Node core only.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { AI_DISCLOSURE, DISCLOSURE_PARTS, disclosureAsText } from '../src/content/aiDisclosure.js';
// WHICH BYTES DID THIS CHECK? This tool already says STALE when a text is
// missing — but a bundle two merges behind that happens to still carry all
// seven passes silently, and the whole product here is credibility. One home:
// tools/artifact-provenance.mjs. Facts only; it never fails a run.
import { printArtifactProvenance } from './artifact-provenance.mjs';

const SURFACES = ['build/AshenSpire.html', 'dist/AshenSpire.html'];

// The falsifier, in the exact form a sceptic pastes into a terminal. Command 1
// excludes the disclosure module for the reason above; an exclusion is a hole,
// so command 2 closes it by showing that file is inert data — it imports
// nothing and can call nothing, so a violation cannot hide in the file skipped.
const EVIDENCE = [
  {
    label: 'no AI service is referenced anywhere the game runs',
    argv: ['-rniE', 'anthropic|openai|claude|gpt-|llm|api[_-]?key|completions|/v1/messages', 'src/', '--exclude=aiDisclosure.js'],
  },
  {
    label: 'and the one excluded file is inert — it imports nothing and calls nothing',
    argv: ['-nE', '^\\s*import |fetch\\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|eval\\(', 'src/content/aiDisclosure.js'],
  },
];

const shellForm = (e) => `grep ${e.argv.map((a) => (/[\s|]/.test(a) ? `'${a}'` : a)).join(' ')}`;

/**
 * Every text that must survive into the bundles, as the ATOMS they are written
 * as. `storeForm` is assembled from two of them, so binding the assembled
 * string would look for text the bundle never contains — the parts are what the
 * bundler carries, and binding the parts binds the whole.
 *
 * The runtime claim is in this list deliberately: it is `runtimeCheck.claim`,
 * the sentence `--evidence` prints as the thing the falsifier proves. It used
 * to be a second, differently-worded copy that nothing rendered and nothing
 * bound — the one sentence in the file with no reader (Bjorn's find).
 */
function allTexts(d = AI_DISCLOSURE) {
  return [
    ...DISCLOSURE_PARTS.map((p) => ({ name: p.name, text: p.text })),
    ...d.sections.map((s) => ({ name: `section: ${s.heading}`, text: s.body })),
  ];
}

if (process.argv[2] === '--evidence') {
  console.log(`CLAIM: ${AI_DISCLOSURE.runtimeCheck.claim}`);
  console.log('');
  for (const e of EVIDENCE) {
    console.log(`# ${e.label}`);
    console.log(`${shellForm(e)}`);
    console.log('# expect: no matches (grep exits 1)');
    console.log('');
  }
  console.log(AI_DISCLOSURE.runtimeCheck.networkNote);
  process.exit(0);
}

if (process.argv[2] === '--check') {
  let failing = 0;
  const texts = allTexts();

  // (1) Every text, in every shipped bundle. The bundler preserves source
  // literals as written, which is why each of these is one unbroken literal in
  // the module — a concatenation would fail this for the wrong reason.
  let bundlesChecked = 0;
  for (const file of SURFACES) {
    if (!existsSync(file)) { console.log(`SKIP  ${file} — not built here`); continue; }
    bundlesChecked += 1;
    printArtifactProvenance(file, process.cwd());
    const html = readFileSync(file, 'utf8');
    for (const { name, text } of texts) {
      const ok = html.includes(text);
      if (!ok) failing += 1;
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${file} carries ${name}`
        + (ok ? '' : ' — STALE or edited: rebuild with `node tools/bundle.mjs` before shipping'));
    }
  }

  // (2) The runtime claim, executed rather than asserted.
  for (const e of EVIDENCE) {
    let matches = '';
    try {
      matches = execFileSync('grep', e.argv, { encoding: 'utf8' });
    } catch (err) {
      if (err.status === 1) matches = '';          // grep: no matches — what we want
      else { console.log(`ERROR ${shellForm(e)} — ${err.message}`); failing += 1; continue; }
    }
    const ok = matches.trim() === '';
    if (!ok) failing += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${e.label}`);
    if (!ok) {
      console.log(`      the sceptic's own command returns matches, so the claim does not reproduce:`);
      for (const line of matches.trim().split('\n').slice(0, 6)) console.log(`      ${line.slice(0, 120)}`);
      console.log(`      command: ${shellForm(e)}`);
    }
  }

  console.log('');
  console.log(`${failing} failing check(s). ${texts.length} texts × ${bundlesChecked} bundle(s), plus ${EVIDENCE.length} runtime commands.`);
  console.log('BOUNDARY: this covers every text the game renders and the runtime claim, on this');
  console.log('tree. It does NOT check the Steam store page — that text is pasted from this tool');
  console.log('by a human, and the human is the one link in the chain no check here covers. It');
  console.log('also does not render anything: that the About screen is legible is Sunna\'s floor,');
  console.log('and that it renders at all in the release build is Bjorn\'s.');
  process.exit(failing ? 1 : 0);
}

if (process.argv[2] === '--full') {
  console.log(disclosureAsText());
  process.exit(0);
}

console.log(AI_DISCLOSURE.storeForm);
if (!AI_DISCLOSURE.approved) {
  console.error('');
  console.error('NOTE: approved=false in src/content/aiDisclosure.js — this wording has not been');
  console.error('approved for release yet. Constantine approves the final text; edit the module,');
  console.error('set approved: true, rebuild the bundles, and both surfaces move together.');
}
