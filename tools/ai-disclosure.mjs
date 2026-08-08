#!/usr/bin/env node
// tools/ai-disclosure.mjs — the store surface of the AI-use acknowledgement and
// the falsifier for its load-bearing claim, both driven from the one home
// (src/content/aiDisclosure.js).
//
//   node tools/ai-disclosure.mjs             print the Steam disclosure field text
//   node tools/ai-disclosure.mjs --full      print the whole in-product text
//   node tools/ai-disclosure.mjs --evidence  print the verbatim commands a sceptic runs
//   node tools/ai-disclosure.mjs --check     run everything: all seven texts × every
//                                            shipped bundle, the runtime claim, and
//                                            whether `approved` still names THIS wording
//   node tools/ai-disclosure.mjs --fingerprint
//                                            print the digest to record in
//                                            `approvedWording` after an approved edit
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
import { createHash } from 'node:crypto';
import { AI_DISCLOSURE, DISCLOSURE_PARTS, disclosureAsText } from '../src/content/aiDisclosure.js';

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

/**
 * wordingFingerprint(d) → `sha256:…` over every text in `allTexts()` order.
 *
 * WHAT IT IS FOR. `approved` records that Constantine signed off on a wording.
 * The module says, beside it, that any edit to the text returns the flag to
 * false — and until this function existed that was a promise kept by memory.
 * `--check` below is the only thing that can catch it being forgotten, and a
 * forgotten flag does not look broken: the About screen still renders, the
 * bundles still match the module, every existing check stays green, and the
 * record quietly claims he approved words he has never read.
 *
 * It hashes exactly what allTexts() returns, which is what the bundle check
 * already binds — one list, two uses, so a text that escapes the fingerprint
 * escapes the bundle check too and is caught there.
 *
 * NOT A SECOND COPY of the text. A second copy drifts in silence; this exists
 * in order to disagree out loud, and it holds no words of its own.
 */
export function wordingFingerprint(d = AI_DISCLOSURE) {
  const blob = allTexts(d).map(({ name, text }) => `${name}\n${text}`).join('\n\n');
  return `sha256:${createHash('sha256').update(blob, 'utf8').digest('hex')}`;
}

if (process.argv[2] === '--fingerprint') {
  console.log(wordingFingerprint());
  console.log('');
  console.log('Paste this into `approvedWording` in src/content/aiDisclosure.js ONLY when the');
  console.log('current wording is the wording that was approved. Changing it is the act of');
  console.log('saying out loud that the text moved — it is not a build step.');
  process.exit(0);
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

  // (3) THE APPROVAL AND THE WORDING IT APPROVES. Saga found this hole from the
  // other side: `--check` did not cover `approved`, so dist/ shipped a stale
  // `false` and nothing in the tree could see it. This is the same hole facing
  // forward — edit a section body, forget the flag, and `approved: true` claims
  // he signed off on words he has never read, with every other check green.
  // Three states, and the middle one is the one that used to be invisible.
  const fp = wordingFingerprint();
  if (!AI_DISCLOSURE.approved) {
    console.log(`PASS  approved=false — no wording is claimed as approved, so nothing to bind`);
  } else if (!AI_DISCLOSURE.approvedWording) {
    failing += 1;
    console.log(`FAIL  approved=true but approvedWording is missing — the flag names no wording,`);
    console.log(`      so it records nothing. Set approvedWording to ${fp}`);
    console.log(`      only if the text below it is the text that was approved.`);
  } else if (AI_DISCLOSURE.approvedWording !== fp) {
    failing += 1;
    console.log(`FAIL  THE WORDING CHANGED AFTER IT WAS APPROVED — approved=true is now a claim`);
    console.log(`      about text nobody signed off on.`);
    console.log(`      approved: ${AI_DISCLOSURE.approvedWording}`);
    console.log(`      current:  ${fp}`);
    console.log(`      Either restore the wording, or set approved:false and ask again — and if`);
    console.log(`      the edit IS approved, \`node tools/ai-disclosure.mjs --fingerprint\` prints`);
    console.log(`      the value to record.`);
  } else {
    console.log(`PASS  approved=true binds THIS wording (${fp.slice(0, 23)}…)`);
  }

  console.log('');
  console.log(`${failing} failing check(s). ${texts.length} texts × ${bundlesChecked} bundle(s), plus ${EVIDENCE.length} runtime commands`);
  console.log(`and the approval-to-wording binding.`);
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
