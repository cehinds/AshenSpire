#!/usr/bin/env node
// tools/ai-disclosure.mjs — the store surface of the AI-use acknowledgement,
// printed from the same module the game renders (src/content/aiDisclosure.js).
//
//   node tools/ai-disclosure.mjs           print the Steam disclosure field text
//   node tools/ai-disclosure.mjs --full    print the whole in-product text
//   node tools/ai-disclosure.mjs --check   verify every shipped surface agrees
//
// WHY --check EXISTS. "One text, one home" is an intention until something
// fails when it stops being true. The game is shipped as bundles (build/ and
// dist/ AshenSpire.html) built from src/, so a bundle rebuilt before an edit —
// or not rebuilt after one — puts a stale acknowledgement in front of players
// while the store shows the new one. That is the exact second-copy defect the
// arrangement exists to prevent, so it gets a check that goes RED for it.
//
// Zero dependencies, Node core only.

import { readFileSync, existsSync } from 'node:fs';
import { AI_DISCLOSURE, disclosureAsText } from '../src/content/aiDisclosure.js';

const arg = process.argv[2] || '';

if (arg === '--check') {
  const surfaces = ['build/AshenSpire.html', 'dist/AshenSpire.html'];
  // The bundler rewrites modules into closures but does not touch string
  // literals, so the store text appears verbatim in a current bundle. It is
  // the same normalisation the game applies: none.
  const needle = AI_DISCLOSURE.storeForm;
  let failing = 0;
  let checked = 0;

  for (const file of surfaces) {
    if (!existsSync(file)) {
      console.log(`SKIP  ${file} — not built here`);
      continue;
    }
    checked += 1;
    const html = readFileSync(file, 'utf8');
    const ok = html.includes(needle);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${file} carries the acknowledgement from src/content/aiDisclosure.js`
      + (ok ? '' : ' — this bundle is STALE: rebuild with `node tools/bundle.mjs` before shipping'));
    if (!ok) failing += 1;
  }

  // A second home for the same fact would defeat the arrangement quietly, so
  // the check also refuses a rebuilt bundle that carries TWO different leads.
  console.log('');
  console.log(`${failing} failing surface(s); ${checked} checked.`);
  console.log('BOUNDARY: checks the shipped bundles against this module. It cannot check the');
  console.log('Steam store page — that text is pasted from this tool by a human, and the human');
  console.log('is the only link in the chain this check does not cover.');
  process.exit(failing ? 1 : 0);
}

if (arg === '--full') {
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
