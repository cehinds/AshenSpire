#!/usr/bin/env node
// tools/markhome.mjs — card text marks may not be keyed to one of their two
// drawing sites.
//
// THE DEFECT THIS EXISTS FOR. fillTemplate() (src/ui/components/card.js) is ONE
// function emitting the marks a player reads to understand a card — `.kw`,
// `.st-bleed`, `.val`, `.val.up`, `.val.down` — and its output is drawn in TWO
// containers: the card face (`.card`) and the Smith/coop upgrade preview inside
// `#tooltip`. Every rule styling those marks used to be keyed `.card .ctext …`,
// so the preview computed exactly which numbers an upgrade moves and then drew
// them like ordinary prose. Constantine: "I've never seen the upgrade preview
// before." Fixed at 60935d9 by re-keying five rules to `.ctext`.
//
// WHY A CHECK AND NOT A MEMO. A SIXTH rule styling the same span did not follow,
// because it carried a hardcoded hex and the selector was the only place that
// hex could live: `body.cb-safe .card .ctext .st-bleed { color: #cc79a7 }`.
// Every rule keyed to a TOKEN came through for free — `--green` resolves to
// #009e73 under Colorblind-friendly and nobody did anything. The one keyed to a
// LITERAL did not, and in that palette the same word read reddish-purple on a
// card face and vermillion — that palette's danger hue — in the preview. One
// rule surviving a re-key is an instance; a rule that can survive a re-key is a
// CLASS, and a class needs a machine.
//
// THE RULE, in its closed form — so a third party gets the same answer:
//
//   A selector that targets a card-text MARK class may not require a `.card`
//   ANCESTOR. A compound on the card element itself (`.card.tag-boost .ctext
//   .val.up`) is legal: that rule is a statement about the CARD'S STATE, which
//   is a property the tooltip genuinely does not have. `.card .ctext .st-bleed`
//   is not: it is a statement about a WORD, keyed to one of the two places the
//   word is drawn.
//
// Closed, not a trigger list, deliberately (Vira's bar): it does not enumerate
// which properties or which palettes are suspicious. Colour, weight, size, a
// palette nobody has written yet — the shape is the same and the check does not
// need updating to see it.
//
// WHAT IT CANNOT SEE, and this is the boundary that matters: it reads
// SELECTORS, not RENDERED PIXELS. A mark that reads differently in the two
// containers for any other reason — an inline style, a rule reaching only one
// container by some route other than `.card`, specificity — is invisible here.
// Only a render comparison closes that, and this repo has no browser harness in
// its suite. Until it does, this is the cheap half and it says so out loud.
//
// Usage:
//   node tools/markhome.mjs              scan styles/ — exit 1 on a finding
//   node tools/markhome.mjs --selftest   run the known-bad / known-good corpus
//   node tools/markhome.mjs --raw        findings only, no ledger

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The classes fillTemplate() emits. If that function learns a new one, add it
// here — and the day this list and card.js disagree is the day this check goes
// quiet, so it is named in the RESULT line rather than hidden in the source.
const MARK_CLASSES = ['kw', 'st-bleed', 'val', 'up', 'down'];

/**
 * Blank out /* … *\/ comments (CSS has no // form). NEWLINES ARE PRESERVED and
 * every other byte becomes a space, so an index into the result is the same
 * index into the file — the reported line number is the real one. The first
 * draft returned a single space per comment and reported base.css:18 for a rule
 * that lives at base.css:74, which is a check telling you the wrong place to
 * look, i.e. most of the way to no check at all.
 */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/**
 * Split a selector into combinator-separated COMPOUNDS in source order.
 * `body.cb-safe .card .ctext .st-bleed` → ['body.cb-safe', '.card', '.ctext', '.st-bleed']
 * Descendant, child, sibling — all of them separate compounds, because all of
 * them mean "an ancestor/relative must be a card" for our purposes.
 */
function compounds(sel) {
  return sel.replace(/\s*[>+~]\s*/g, ' ').trim().split(/\s+/).filter(Boolean);
}

const classesOf = (compound) => (compound.match(/\.[-\w]+/g) || []).map((c) => c.slice(1));

/** Every rule in a stylesheet, as { selector, line }. */
function rules(text) {
  const out = [];
  const clean = stripComments(text); // same length as `text`, so indices agree
  // Blocks only; at-rules keep their inner blocks, which this walk enters
  // naturally because it splits on '{' and takes the text before it.
  for (const m of clean.matchAll(/([^{}]+)\{/g)) {
    const sel = m[1].trim();
    if (!sel || sel.startsWith('@')) continue;
    for (const one of sel.split(',')) {
      if (!one.trim()) continue;
      // The line of THIS selector, not of the rule's first one — a grouped
      // selector spanning lines otherwise all reports as the first.
      const at = m.index + m[1].indexOf(one);
      out.push({ selector: one.trim(), line: clean.slice(0, at).split('\n').length });
    }
  }
  return out;
}

/** The verdict for one selector. Returns null when legal. */
function judge(selector) {
  const parts = compounds(selector);
  const markAt = parts.findIndex((p) => classesOf(p).some((c) => MARK_CLASSES.includes(c)));
  if (markAt < 0) return null;
  for (let i = 0; i < markAt; i++) {
    const cls = classesOf(parts[i]);
    if (!cls.includes('card')) continue;
    // `.card` ALONE as an ancestor compound → the mark is keyed to the card face.
    // `.card.something` → keyed to a card STATE, which the tooltip does not have.
    if (cls.length === 1) {
      return `mark class \`.${classesOf(parts[markAt]).filter((c) => MARK_CLASSES.includes(c))[0]}\``
        + ` is keyed to a \`.card\` ANCESTOR, so it reaches the card face and not the preview`;
    }
  }
  return null;
}

function scan(dir) {
  const findings = [];
  let files = 0, selectors = 0, markSelectors = 0;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.css')).sort()) {
    const text = readFileSync(join(dir, f), 'utf8');
    files++;
    for (const r of rules(text)) {
      selectors++;
      const parts = compounds(r.selector);
      if (parts.some((p) => classesOf(p).some((c) => MARK_CLASSES.includes(c)))) markSelectors++;
      const why = judge(r.selector);
      if (why) findings.push({ file: f, line: r.line, selector: r.selector, why });
    }
  }
  return { findings, files, selectors, markSelectors };
}

const CORPUS = {
  bad: [
    // The rule that actually shipped, and the reason this file exists.
    'body.cb-safe .card .ctext .st-bleed { color: #cc79a7; }',
    // The five as they were before 60935d9.
    '.card .ctext .val.up { color: var(--green); }',
    // A child combinator is the same claim in different punctuation.
    '.card > .ctext > .kw { color: gold; }',
  ],
  good: [
    // The card's own text BLOCK — layout, genuinely the card's, and no mark class.
    '.card .ctext { font-size: 1.1rem; }',
    // A card STATE the tooltip does not have. Legal, and named so in the rule.
    '.card.tag-boost .ctext .val.up { color: var(--boost-tint); }',
    // The re-keyed form.
    '.ctext .st-bleed { color: var(--bleed); font-weight: 600; }',
    // Hand-scoped geometry on the block, still no mark class.
    ":root[data-layout='narrow'] .hand .card .ctext { font-size: 1rem; }",
  ],
};

function selftest() {
  console.log('markhome --selftest');
  let badHit = 0, goodHit = 0;
  for (const css of CORPUS.bad) {
    const sel = css.slice(0, css.indexOf('{')).trim();
    const why = judge(sel);
    console.log(`  ${why ? 'caught ' : 'ESCAPED'}  ${sel}`);
    if (why) badHit++;
  }
  for (const css of CORPUS.good) {
    const sel = css.slice(0, css.indexOf('{')).trim();
    const why = judge(sel);
    console.log(`  ${why ? 'FALSE+ ' : 'cleared'}  ${sel}`);
    if (!why) goodHit++;
  }
  const ok = badHit === CORPUS.bad.length && goodHit === CORPUS.good.length;
  console.log(ok
    ? `RESULT: corpus held — known-bad recall ${badHit}/${CORPUS.bad.length}, known-good cleared ${goodHit}/${CORPUS.good.length}; mark vocabulary ${MARK_CLASSES.join(' ')}.`
    : `RESULT: corpus escaped — known-bad recall ${badHit}/${CORPUS.bad.length}, known-good cleared ${goodHit}/${CORPUS.good.length}; the check is decoration until both are full.`);
  return ok ? 0 : 1;
}

function main(argv) {
  if (argv.includes('--selftest')) return selftest();
  const { findings, files, selectors, markSelectors } = scan(resolve(ROOT, 'styles'));
  if (!argv.includes('--raw')) {
    console.log(`markhome — ${files} stylesheet(s), ${selectors} selectors, ${markSelectors} touching a card-text mark class`);
  }
  for (const f of findings) console.log(`  ${f.file}:${f.line}  ${f.selector}\n      ${f.why}`);
  // THE DENOMINATOR IS THE VERDICT, not the findings list. Zero findings over
  // zero mark selectors is a check that ruled on nothing — the same shape as a
  // green suite whose main() never ran — so it reports RED, not clean.
  if (markSelectors === 0) {
    console.log('RESULT: NOTHING TO RULE ON — 0 selectors mention a card-text mark class,'
      + ` so this run is unknown, not clean. Either styles/ moved or the vocabulary`
      + ` (${MARK_CLASSES.join(' ')}) has drifted from card.js.`);
    return 1;
  }
  console.log(findings.length
    ? `RESULT: ${findings.length} of ${markSelectors} card-text mark selector(s) are keyed to a \`.card\` ancestor, so they reach the card face and not the preview.`
    : `RESULT: clean — all ${markSelectors} card-text mark selector(s) reach both drawing sites; SELECTORS ONLY, no pixel was compared.`);
  return findings.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exit(main(process.argv.slice(2)));
export { judge, scan, main };
