#!/usr/bin/env node
// Focused contract for #189. CHANGELOG.md is authored; the generated browser
// module must be an exact structured projection of it. Normal mode checks the
// projection and the real About disclosure. --selftest plants malformed and
// duplicated receipts. --write performs the mechanical projection only.

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const SCRIPT = fileURLToPath(import.meta.url);
const SCRIPT_ROOT = resolve(dirname(SCRIPT), '..');
const rootAt = process.argv.indexOf('--root');
const ROOT = resolve(rootAt >= 0 && process.argv[rootAt + 1] ? process.argv[rootAt + 1] : SCRIPT_ROOT);
const OWNER = resolve(ROOT, 'CHANGELOG.md');
const GENERATED = resolve(ROOT, 'src/content/changelog.generated.js');
const BUILD = resolve(ROOT, 'build/AshenSpire.html');
const REPO = 'https://github.com/cehinds/AshenSpire';
const PHONE = Object.freeze({ tag: 'phone-390x844', width: 390, height: 844, mobile: true });
const DESKTOP = Object.freeze({ tag: 'desktop-1200x730', width: 1200, height: 730, mobile: false });

// The prose has ONE home — CHANGELOG.md — and TWO readers: GitHub, which renders
// Markdown, and Settings → About, which escapes every character as plain text
// (`about.js`, `esc(entry.detail)`). Copying prose verbatim therefore shipped the
// SYNTAX to the player: #290's `**Settings → Advanced → Reward collection**` with
// its asterisks, and #186's backticks before it, in every artifact.
//
// The projection FLATTENS the inline subset the file actually uses, so the author
// keeps writing Markdown and each reader is handed what it can read — Law 0 c.1,
// the machinery derives. It REFUSES what it cannot flatten without losing the
// information (a link loses its href, an image loses everything), so a future
// author is told by name instead of shipping a mangled receipt — Law 0 c.5: a
// missing field that fails loud is cheap; a plausible wrong one is invisible.
//
// BOUNDARY: a flattener, not a Markdown parser. It knows emphasis and code spans;
// it does not know tables, block constructs or nested emphasis and claims nothing
// about them. AND IT CLAIMS NOTHING ABSOLUTE ABOUT THE ONES IT DOES KNOW: four
// heads running, each closed the form it was blocked on and left the CLAIM
// absolute, and the claim went false again on the next spelling — the fourth time
// on a form the third fix had just created. REFUSAL_SCOPE now names a SUBSET and
// says forms outside it reach the player. That sentence is true after the next
// finding instead of false after each one, and it is the fix. REMOVAL: deleted the day Settings → About renders Markdown itself,
// at which point this is a second copy of that renderer's job.
//
// THE REFUSAL DOES NOT COVER EVERY FORM, AND THIS COMMENT SAID IT DID.
//
// It read "THE REFUSAL COVERS EVERY LINK FORM THIS FILE CAN CARRY" and that was
// FALSE when written. Sunna measured four forms walking past it on 2026-08-22, each
// at `--write` exit 0 and each reaching the projection: `[details]()`, an HTML
// comment, `<?php ?>`, and `[SS]` against a `[ß]: url` definition. She checked the
// ink: `esc()` renders them as visible text, so THE HTML COMMENT GITHUB HIDES IS
// SHOWN TO THE PLAYER IN FULL. And the sharpest of it — `[x]()` was never a sixth
// spelling, it was a HOLE IN THE FIRST ONE: the inline pattern required a non-empty
// destination, so even "recognises `[text](url)`" was not quite true.
//
// A false completeness sentence is worse than a missing one. A reader who trusts it
// stops looking; a missing boundary at least leaves them uninformed rather than
// confidently wrong. THE LIST BELOW IS THE CLAIM NOW, and it is printed at runtime
// (REFUSAL_SCOPE) rather than living only here, because a boundary in a `//` comment
// is invisible to everyone reading the tool's green — Law 0 clause 4, and Vira's
// "the door named is the extent of the green".
//
// The shortcut form cannot be seen in one line of prose — `[docs]` is a link only
// if a definition for it exists — so `parseChangelog` collects the file's defined
// labels and hands them down. With no definitions in the file the check is inert,
// which is why it cannot fire on ordinary bracketed prose.
//
// NOT A WHITELIST, deliberately, and this is measured rather than preferred:
// CHANGELOG.md legitimately carries non-ASCII on 14 lines — em-dashes and arrows.
// A plain-text whitelist reds the corpus on day one, and one tuned until it stops
// is a blacklist with a better name.
const INLINE_REFUSED = [
  // `!` and `?` alongside the letters: an HTML comment and a processing instruction
  // are hidden by GitHub and PRINTED BY `esc()`, which is the worse direction.
  // Refuse the opener immediately: comments and tags can close on a later line,
  // while receipt prose is projected one authored line at a time.
  [/<[a-zA-Z/!?]/, 'raw HTML'],
];
// THE BRACKETED FORMS ARE COUNTED, NOT PATTERN-MATCHED, AND THAT IS THE WHOLE POINT.
//
// CommonMark allows brackets inside LINK TEXT "if they appear as a matched pair of
// brackets", to ANY depth: `[the [advanced] guide](/guide)` is a valid link and
// GitHub renders it. `\[[^\]]+\]\([^)]*\)` stops at the INNER `]` and let it
// through — measured 2026-08-22 by Codex and by Bjorn at the real door, `--write`
// exit 0, the syntax in `changelog.generated.js` and on the glass.
//
// That was the THIRD hole in one pattern (`[x]()` was the second), and a third hole
// in one line is a shape, not a bug: WIDENING THE CHARACTER CLASS BUYS ONE LEVEL OF
// NESTING AND RE-OPENS ON TWO. So the depth is counted. Backslash-escaped brackets
// and parens are skipped, per CommonMark; the destination's own parens nest too
// (`[a](/x(y))`).
//
// BOUNDARY, and it is a real one: this is a SCANNER, NOT A PARSER. What it does
// about that is MASK CODE SPANS BEFORE EVERY REFUSAL SCAN, because "it does not
// know code spans" had TWO directions and only one of them was printed.
//
// The printed one was the over-fire: `` `arr[0](x)` `` refused though GitHub renders
// it as code. Harmless — the author is told, and rewrites.
//
// THE ONE THAT WAS NOT PRINTED IS THE ONE THAT MATTERED. The same blindness makes
// a `]` inside a code span close a link label EARLY, so ``[the `]` guide](/guide)``
// — a valid CommonMark link — was not refused, and the flattener then removed the
// backticks and shipped `See [the ] guide](/guide)`. NOT A LEAK, A CORRUPTION: every
// other form this PR found shipped the author's own words; this one rewrote the
// sentence into words nobody wrote. Measured by Sten 2026-08-22 at the file door,
// `--write` exit 0. A declared limit that names only the safe direction is worse
// than an undeclared one: it tells the reader which way not to look.
//
// So one mask closes both directions at once, and it DELIBERATELY reads the same
// span scanner the flattener uses — 1b's lesson, one home: two transforms meant to
// agree and written twice will disagree. The mask is length-preserving, so every
// index the refusal scanners compute still points at the real character.
function backslashRunLength(text, index) {
  let count = 0;
  for (let i = index - 1; i >= 0 && text[i] === '\\'; i--) count++;
  return count;
}
function insideLinkDestination(text, index) {
  for (let i = 0; i < index; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] !== '[') continue;
    const labelEnd = matchingBracket(text, i, '[', ']');
    if (labelEnd < 0 || text[labelEnd + 1] !== '(') continue;
    const destinationOpen = labelEnd + 1;
    const angleEnd = angleDestinationEnd(text, destinationOpen);
    if (destinationOpen < index && angleEnd >= index) return true;
    const destinationEnd = matchingBracket(text, destinationOpen, '(', ')');
    if (destinationOpen < index && destinationEnd >= index) return true;
  }
  return false;
}
function codeSpanRanges(text) {
  const spans = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '`' || backslashRunLength(text, i) % 2 === 1
      || insideLinkDestination(text, i)) continue;
    let openerEnd = i + 1;
    while (text[openerEnd] === '`') openerEnd++;
    const length = openerEnd - i;
    let closerStart = -1;
    let closerEnd = -1;
    for (let j = openerEnd; j < text.length;) {
      if (text[j] !== '`') {
        j++;
        continue;
      }
      let end = j + 1;
      while (text[end] === '`') end++;
      if (end - j === length) {
        closerStart = j;
        closerEnd = end;
        break;
      }
      j = end;
    }
    if (closerStart < 0) {
      i = openerEnd - 1;
      continue;
    }
    spans.push({ start: i, contentStart: openerEnd, contentEnd: closerStart, end: closerEnd });
    i = closerEnd - 1;
  }
  return spans;
}
export function maskCodeSpans(text) {
  let masked = '';
  let cursor = 0;
  for (const span of codeSpanRanges(text)) {
    masked += text.slice(cursor, span.start);
    masked += 'x'.repeat(span.end - span.start);
    cursor = span.end;
  }
  return masked + text.slice(cursor);
}
function flattenEscapedBackticks(text) {
  let flattened = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '\\') {
      flattened += text[i];
      continue;
    }
    const start = i;
    while (text[i + 1] === '\\') i++;
    const length = i - start + 1;
    if (text[i + 1] !== '`') {
      flattened += '\\'.repeat(length);
      continue;
    }
    flattened += '\\'.repeat(Math.floor(length / 2));
    flattened += '`';
    i++;
  }
  return flattened;
}
function flattenCodeSpans(text) {
  let flattened = '';
  let cursor = 0;
  for (const span of codeSpanRanges(text)) {
    flattened += flattenEscapedBackticks(text.slice(cursor, span.start));
    flattened += text.slice(span.contentStart, span.contentEnd);
    cursor = span.end;
  }
  return flattened + flattenEscapedBackticks(text.slice(cursor));
}
// A DESTINATION IN ANGLE BRACKETS IS NOT PAREN-BALANCED, AND THAT IS THE WHOLE
// SPELLING. CommonMark lets `[a](<...>)` hold unbalanced parens because the `<>`
// delimits instead — `[link](<#foo(and(bar)>)` is a link and GitHub renders it,
// while `matchingBracket` on the parens returns -1 and the link rule never fired.
//
// The report that opened this quoted `[link](<foo(and(bar)>)`, which exits 1 — BY
// THE RAW-HTML RULE, not this one, because `<f` is `<[a-zA-Z…`. Move the first
// character out of that class (`<#`, `<(`) and it shipped. THE RULE CREDITED WITH
// THE CATCH WAS NOT THE RULE THAT CAUGHT IT, and checking that is what found this.
//
// Recognised by the opening `<` and a closing `>`, backslash escapes skipped, no
// unescaped `<` between: narrower than CommonMark (which also bars line endings we
// cannot see, a receipt being one line) and it OVER-FIRES on `](<` that opens no
// link. Refusal is the safe direction and the clean corpus is measured for it.
function angleDestinationEnd(text, open) {
  if (text[open + 1] !== '<') return -1;
  for (let i = open + 2; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === '<' || text[i] === '\n') return -1;
    if (text[i] === '>') return i;
  }
  return -1;
}
function angleDestination(text, open) {
  return angleDestinationEnd(text, open) >= 0;
}
function matchingBracket(text, start, open, close) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const character = text[i];
    if (character === '\\') { i++; continue; }
    if (character === open) depth++;
    else if (character === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}
// A REFERENCE LINK IS ONLY A LINK IF ITS LABEL IS DEFINED, AND THIS BRANCH USED TO
// SKIP THAT QUESTION. `Supports [keyboard][gamepad] input` — no definition anywhere
// in the file — renders LITERALLY on GitHub and reads fine in About, and the tool
// REFUSED it. That is not a leak and no scope line excuses it: it is a false RED
// that stops a receipt author writing correct English. YOU CANNOT DECLARE YOUR WAY
// OUT OF REFUSING HONEST INPUT.
//
// Codex's finding, and the fix is the machinery the SHORTCUT path has had since
// 1caf887 — consult the collected definition labels — so nothing new is parsed.
// The full form `[text][label]` is looked up on `label`; the COLLAPSED form
// `[text][]` on the link text, which is what CommonMark does.
//
// The lookup reads the label out of the AUTHORED text, never the mask. That is the
// :246 lesson from an hour earlier: the definitions are collected from the authored
// line, so comparing a masked use against an authored definition silently misses.
// The mask is length-preserving, so the same indices address both.
export function findBracketedRefusal(raw, labels = new Set()) {
  const text = maskCodeSpans(raw);
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] !== '[') continue;
    const label = matchingBracket(text, i, '[', ']');
    if (label < 0) continue;
    if (text[label + 1] === '('
      && (matchingBracket(text, label + 1, '(', ')') >= 0 || angleDestination(text, label + 1))) {
      return text[i - 1] === '!' ? 'an image' : 'a link';
    }
    if (text[label + 1] === '[') {
      const close = matchingBracket(text, label + 1, '[', ']');
      if (close >= 0) {
        const reference = raw.slice(label + 2, close) || raw.slice(i + 1, label);
        if (labels.has(normalizeLinkLabel(reference))) return 'a reference-style link';
      }
    }
  }
  return null;
}
// WHAT THIS TOOL REFUSES, AND WHAT IT LETS THROUGH. Printed on every exit path, so
// no green from here can be read as wider than it is. Anything not on the refused
// list reaches src/content/changelog.generated.js verbatim and is rendered to the
// player as text by `esc()` in src/ui/screens/about.js.
export const REFUSAL_SCOPE = [
  'about-changelog RECOGNISES A NAMED SUBSET AND REFUSES IT. IT IS NOT A MARKDOWN',
  '  PARSER AND MAKES NO ABSOLUTE CLAIM ABOUT ANY CommonMark CONSTRUCT.',
  'THE SUBSET IT RECOGNISES: an unescaped `[` outside a code span, whose matching',
  '  `]` is found by COUNTING depth (any depth, backslash escapes skipped), followed',
  '  IMMEDIATELY by `](` + a destination that is paren-balanced or angle-delimited',
  '  `<…>`, EMPTY included — image, inline link — or by `][label]` — full and',
  '  collapsed reference link — BUT ONLY WHERE THE REFERENCE LABEL MATCHES A',
  '  link-reference DEFINITION IN THE FILE, because `[a][b]` with nothing defined',
  '  is ordinary prose and GitHub renders it literally. Also refused, not',
  '  bracket-counted: a shortcut reference on a DEFINITION FOUND ON ONE LINE',
  '  OUTSIDE A TOP-LEVEL FENCED CODE BLOCK ·',
  '  raw HTML, comment and processing instruction (`<letter`, `</`, `<!`, `<?`).',
  'ANY FORM OUTSIDE THAT SUBSET REACHES THE PLAYER — verbatim if it is not',
  '  recognised, or imperfectly flattened if it is. THAT INCLUDES FURTHER CommonMark',
  '  LINK AND CODE-SPAN SPELLINGS THIS TOOL HAS NOT BEEN SHOWN. The list below is',
  '  what has been MEASURED outside the subset. IT IS NOT A COMPLETENESS CLAIM AND',
  '  MUST NOT BE READ AS ONE — FIVE of its entries were found on the day it was',
  '  written: one in the fix that was closing the entry above it, and one MINUTES',
  '  AFTER this sentence stopped claiming a construct. That is the evidence for',
  '  the sentence, not against it.',
  'about-changelog FLATTENS: **bold** · __bold__ · *emphasis* · _emphasis_ · a code',
  '  span delimited by a backtick run of ANY length · a backslash-escaped emphasis',
  '  marker or backtick into the literal marker CommonMark shows.',
  'OPEN, MEASURED, NOT FIXED — each reaches the player:',
  '  · emphasis INSIDE a code span is stripped: `` `**b**` `` ships as `b`, where',
  '    GitHub shows the asterisks.',
  '  · a PADDED code span keeps its padding: `` ` foo ` `` ships as `  foo  `,',
  '    where CommonMark strips one leading and one trailing space. The in-game text',
  '    silently differs from the rendered Markdown.',
  '  · a link-reference DEFINITION whose destination sits on the line after the',
  '    colon is never collected, so the shortcut that uses it is not refused and',
  '    ships as literal brackets.',
  '  · a QUOTED TITLE holding an unbalanced paren defeats the destination scan:',
  '    `[guide](/docs \"why ( now\")` ships whole, while the same link with a',
  '    BALANCED title paren is refused. The subset above says "paren-balanced",',
  '    and this is what falls outside it — found minutes after that line was',
  '    written, which is the line\'s own point, not a hole in it.',
  '  · non-ASCII label case folding (`[SS]` vs `[ß]:`) · `~~strike~~` · HTML',
  '    entities · backslash escapes other than the measured delimiter forms above ·',
  '    a bare URL GitHub autolinks.',
  '  None of them is present in CHANGELOG.md today.',
  'IT SCANS, IT DOES NOT PARSE, AND THAT CUTS BOTH WAYS — the half this line used to',
  '  leave out. OVER-FIRES, harmless, the author is told and rewrites: `a <b and b>',
  '  c` reads as raw HTML · `](<` is taken as an angle destination whether or not a',
  '  link follows · a defined label inside a code span is refused.',
  'UNDER-FIRES, AND THEY ARE NOT HARMLESS: an unrecognised form reaches the player,',
  '  and where the flatten then removes a delimiter the RESULT IS A CORRUPTION —',
  '  words the author did not write, not the author\'s words with syntax attached.',
  '  ``[the `]` guide](/guide)`` did exactly that before the code-span mask, and the',
  '  mask itself opened a second one for an hour. Neither direction is bounded by',
  '  this tool, and this line is the only place that says so.',
].join('\n');
export function printRefusalScope() { console.log(REFUSAL_SCOPE); }
// A link-reference definition: `[label]: https://…`, up to three spaces indented.
// The label is bracket-scanned because an escaped `]` is content, not its end.
// CommonMark §link-reference-definitions, "matching link labels": two labels match
// when their NORMALIZED forms are equal — case folded, outer whitespace stripped,
// and CONSECUTIVE INTERNAL spaces, tabs and line endings COLLAPSED TO ONE SPACE.
//
// That last clause is the one this file got wrong. The first version of the check
// compared `trim().toLowerCase()` on each side, so `[the   guide]: …` defining and
// `See [the guide]` using were two different labels HERE and one label on GitHub:
// the page rendered a link, the lookup missed, `--write` exited 0, and About showed
// the brackets. Measured both directions on 2026-08-22 — spaced definition against
// tight use, tight definition against spaced use, and a tab inside the definition.
//
// ONE normalizer, called at BOTH comparison sites, is the whole fix. Two transforms
// that are meant to agree and are written twice will disagree, which is how the gap
// was opened by the commit that closed the previous one.
//
// BOUNDARY: `toLowerCase()` is not Unicode case folding — it is the practical
// approximation, and it differs on a handful of scripts (ß, ﬁ, dotted/dotless i).
// Every label in CHANGELOG.md today is ASCII, and there are none. Labels spanning
// a line break are also out of reach: definitions are matched line by line, and a
// receipt is one line, so a multi-line label cannot occur in either position.
export function normalizeLinkLabel(label) {
  return label.replace(/[ \t\r\n]+/g, ' ').trim().toLowerCase();
}
function fencedCodeDelimiter(line) {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  if (!match) return null;
  return { marker: match[1][0], length: match[1].length, tail: match[2] };
}
export function linkDefinitionLabels(markdown) {
  const labels = new Set();
  let fence = null;
  for (const line of markdown.split(/\r?\n/)) {
    // This collector only accepts physical definitions indented 0–3 spaces, so
    // top-level fences are the matching block context it must exclude. A closer
    // uses the same marker and at least the opener's run length; a backtick info
    // string cannot itself contain a backtick. Those are the CommonMark fence
    // facts needed to keep examples from becoming definitions here.
    const delimiter = fencedCodeDelimiter(line);
    if (fence) {
      if (delimiter
        && delimiter.marker === fence.marker
        && delimiter.length >= fence.length
        && /^[ \t]*$/.test(delimiter.tail)) fence = null;
      continue;
    }
    if (delimiter && !(delimiter.marker === '`' && delimiter.tail.includes('`'))) {
      fence = delimiter;
      continue;
    }
    const start = line.search(/^ {0,3}\[/);
    if (start < 0) continue;
    const open = line.indexOf('[', start);
    const close = matchingBracket(line, open, '[', ']');
    if (close < 0 || line[close + 1] !== ':' || !/^\s*\S/.test(line.slice(close + 2))) continue;
    labels.add(normalizeLinkLabel(line.slice(open + 1, close)));
  }
  return labels;
}
function bracketLabels(text) {
  const labels = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] !== '[') continue;
    const close = matchingBracket(text, i, '[', ']');
    if (close < 0) continue;
    labels.push(text.slice(i + 1, close));
  }
  return labels;
}
const UNICODE_WHITESPACE = /\p{White_Space}/u;
const UNICODE_PUNCTUATION = /[\p{P}\p{S}]/u;
function delimiterFlanking(text, index, length) {
  const before = Array.from(text.slice(0, index)).at(-1);
  const after = Array.from(text.slice(index + length))[0];
  const beforeSpace = before === undefined || UNICODE_WHITESPACE.test(before);
  const afterSpace = after === undefined || UNICODE_WHITESPACE.test(after);
  const beforePunctuation = before !== undefined && UNICODE_PUNCTUATION.test(before);
  const afterPunctuation = after !== undefined && UNICODE_PUNCTUATION.test(after);
  return {
    left: !afterSpace && (!afterPunctuation || beforeSpace || beforePunctuation),
    right: !beforeSpace && (!beforePunctuation || afterSpace || afterPunctuation),
    beforePunctuation,
    afterPunctuation,
  };
}
function breaksRuleOfThree(opener, closer) {
  return (opener.canClose || closer.canOpen)
    && (opener.remaining + closer.remaining) % 3 === 0
    && (opener.remaining % 3 !== 0 || closer.remaining % 3 !== 0);
}
function consumeRun(run, count, fromEnd, removed) {
  const step = fromEnd ? -1 : 1;
  let i = fromEnd ? run.start + run.length - 1 : run.start;
  for (let consumed = 0; consumed < count; i += step) {
    if (removed.has(i)) continue;
    removed.add(i);
    consumed++;
  }
  run.remaining -= count;
}
function flattenEmphasis(text) {
  const removed = new Set();
  const escaped = new Set();
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '*' && text[i] !== '_') continue;
    // CommonMark consumes the active escape and renders the marker literally.
    // Leaving the slash in the projection would expose syntax; treating the marker
    // as a delimiter would delete the character the author meant the player to see.
    const backslashes = backslashRunLength(text, i);
    if (backslashes) {
      // Each pair renders as one literal slash; an odd final slash escapes the
      // marker. Remove the consumed half now so later delimiter matching sees
      // the same literal-vs-active marker boundary CommonMark does.
      for (let offset = 0; offset < Math.ceil(backslashes / 2); offset++) {
        removed.add(i - backslashes + offset);
      }
      if (backslashes % 2 === 1) escaped.add(i);
    }
  }
  const runs = [];
  for (let i = 0; i < text.length; i++) {
    if ((text[i] !== '*' && text[i] !== '_') || escaped.has(i)) continue;
    const marker = text[i];
    const start = i;
    while (text[i + 1] === marker && !escaped.has(i + 1)) i++;
    const length = i - start + 1;
    const { left, right, beforePunctuation, afterPunctuation } = delimiterFlanking(text, start, length);
    const canOpen = marker === '_'
      ? left && (!right || beforePunctuation)
      : left;
    const canClose = marker === '_'
      ? right && (!left || afterPunctuation)
      : right;
    runs.push({ marker, start, length, remaining: length, canOpen, canClose });
  }
  const openers = [];
  for (const closer of runs) {
    if (closer.canClose) {
      while (closer.remaining) {
        let openerIndex = -1;
        for (let i = openers.length - 1; i >= 0; i--) {
          if (openers[i].marker === closer.marker
            && openers[i].remaining && !breaksRuleOfThree(openers[i], closer)) {
            openerIndex = i;
            break;
          }
        }
        if (openerIndex < 0) break;
        const opener = openers[openerIndex];
        const count = opener.remaining >= 2 && closer.remaining >= 2 ? 2 : 1;
        consumeRun(opener, count, true, removed);
        consumeRun(closer, count, false, removed);
        // A delimiter opened inside the emphasis that just closed cannot later
        // pair across that closing boundary. Keeping it would turn crossing
        // `*`/`_` runs into nested emphasis that CommonMark never rendered.
        openers.splice(openerIndex + 1);
        if (!opener.remaining) openers.splice(openerIndex, 1);
      }
    }
    if (closer.canOpen && closer.remaining) openers.push(closer);
  }
  let flattened = '';
  for (let i = 0; i < text.length; i++) if (!removed.has(i)) flattened += text[i];
  return flattened;
}
export function flattenInline(text, where, labels = new Set()) {
  const bracketed = findBracketedRefusal(text, labels);
  if (bracketed) {
    throw new Error(`${where}: prose contains ${bracketed}, which the in-game changelog cannot render — write it in words`);
  }
  // The mask runs before the bracket scan and the raw-HTML scan. IT DOES NOT RUN
  // BEFORE THE SHORTCUT SCAN, AND THAT IS A REVERT OF MY OWN ONE-WORD CHANGE.
  //
  // I widened it there at a356320 on the argument that "inside a code span" is one
  // fact about the text. It introduced a CORRUPTION within the hour: the defined
  // labels are collected from the AUTHORED line, the use was being read off the
  // MASKED line, so `[the `guide`]` against `[the `guide`]: /docs` compared
  // "the `guide`" to "the xxxxxxx", missed, shipped, and the flattener then emitted
  // `[the guide]` — brackets in Settings → About that the author did not write.
  //
  // Measured both sides: refused at 5bb82f2, shipped at a356320. MY REGRESSION, and
  // reverted rather than declared, because the alternative was to declare a hole I
  // had opened myself in the same head that closed one. What comes back with it is
  // the pre-existing OVER-fire — a defined label inside a code span is refused — and
  // that is the safe direction and was already the standing state.
  const masked = maskCodeSpans(text);
  for (const [pattern, what] of INLINE_REFUSED) {
    if (pattern.test(masked)) {
      throw new Error(`${where}: prose contains ${what}, which the in-game changelog cannot render — write it in words`);
    }
  }
  if (labels.size) {
    for (const label of bracketLabels(text)) {
      if (labels.has(normalizeLinkLabel(label))) {
        throw new Error(`${where}: prose contains a shortcut reference link, which the in-game changelog cannot render — write it in words`);
      }
    }
  }
  // Underscore uses the same Unicode flanking facts with its stricter intraword
  // open/close rule; this keeps letters, marks and format characters literal
  // without maintaining an inevitably incomplete list of "word" categories.
  // A code span opens and closes with a run of exactly the same length. The shared
  // scanner carries that length without cutting a longer run short; escaped opening
  // backticks stay literal, while backslashes inside an opened span remain content.
  return flattenCodeSpans(flattenEmphasis(text));
}

export function parseChangelog(markdown) {
  const entries = [];
  const labels = linkDefinitionLabels(markdown);
  let group = '';
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith('## ')) { group = line.slice(3).trim(); continue; }
    if (!line.startsWith('- ')) continue;
    const match = line.match(/^- \*\*(.+?)\*\* \(\[#(\d+)\]\((https:\/\/github\.com\/cehinds\/AshenSpire\/pull\/(\d+))\), `([^`]+)`\)\.(?: (.+))?$/);
    if (!match) throw new Error(`unparseable changelog receipt: ${line}`);
    const [, summary, prText, url, urlPr, build, prose = ''] = match;
    if (prText !== urlPr) throw new Error(`pull-request label and URL disagree: ${line}`);
    const date = group.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (!date) throw new Error(`receipt has no dated group: ${line}`);
    const pullRequest = Number(prText);
    const where = `receipt #${pullRequest}`;
    entries.push({
      id: `pr-${pullRequest}`,
      date,
      group,
      summary: flattenInline(summary, where, labels),
      detail: flattenInline(prose, where, labels) || `Merged as pull request #${pullRequest} in development build ${build}.`,
      build,
      pullRequest,
      url,
    });
  }
  if (!entries.length) throw new Error('no changelog receipts found');
  const ids = entries.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error('duplicate stable changelog id');
  return entries;
}
function generatedText(entries) {
  return `// GENERATED from /CHANGELOG.md by tools/about-changelog.mjs --write.\n// Do not edit: the focused check refuses any drift from the authoritative Markdown.\n\nexport const GENERATED_CHANGELOG = Object.freeze(${JSON.stringify(entries, null, 2)});\n`;
}

async function generatedEntries() {
  return (await import(`${pathToFileURL(GENERATED).href}?t=${Date.now()}`)).GENERATED_CHANGELOG;
}

async function checkProjection() {
  const expected = parseChangelog(readFileSync(OWNER, 'utf8'));
  const got = await generatedEntries();
  if (JSON.stringify(got) !== JSON.stringify(expected)) throw new Error('generated changelog drifted from CHANGELOG.md; run --write');
  return expected;
}

async function browserRoute(entries, {
  artifact = false,
  shape = PHONE,
  screenshotDir = null,
} = {}) {
  const { server, port } = await serve({ root: ROOT, port: 8239, open: false });
  const browserPath = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
    .find((candidate) => candidate && existsSync(candidate));
  if (!browserPath) { server.close(); throw new Error('UNKNOWN: no Chrome/Edge found for real-browser check'); }
  let browser;
  try {
    browser = await launchBrowser({ prefix: 'about-change-', browser: browserPath, headless: '--headless=new', timeoutMs: 20000 });
    const portCdp = Number(new URL(browser.wsUrl.replace(/^ws:/, 'http:')).port);
    let tabs;
    for (let i = 0; i < 100; i++) {
      try { tabs = await (await fetch(`http://127.0.0.1:${portCdp}/json/list`)).json(); if (tabs.length) break; } catch { /* retry */ }
      await new Promise((ok) => setTimeout(ok, 100));
    }
    const socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise((ok, no) => { socket.onopen = ok; socket.onerror = no; });
    let id = 0; const waiting = new Map();
    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.id != null && waiting.has(data.id)) {
        const pair = waiting.get(data.id); waiting.delete(data.id);
        data.error ? pair.no(new Error(data.error.message)) : pair.ok(data.result);
      }
    };
    const send = (method, params = {}) => new Promise((ok, no) => {
      const next = ++id; waiting.set(next, { ok, no }); socket.send(JSON.stringify({ id: next, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'browser evaluation failed');
      return result.result.value;
    };
    const until = async (expression, label) => {
      for (let i = 0; i < 120; i++) {
        if (await evaluate(expression)) return;
        await new Promise((ok) => setTimeout(ok, 100));
      }
      const body = await evaluate('document.body?.innerText?.slice(0, 800) || "<empty body>"');
      throw new Error(`${label}; body=${JSON.stringify(body)}`);
    };
    await send('Page.enable'); await send('Runtime.enable'); await send('Accessibility.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: shape.width, height: shape.height, deviceScaleFactor: 1, mobile: shape.mobile,
    });
    const entry = artifact ? '/build/AshenSpire.html' : '/';
    await send('Page.navigate', { url: `http://127.0.0.1:${port}${entry}` });
    await until('document.readyState === "complete" && !!document.querySelector("#settings")', 'title Settings control is unreachable');
    const title = await evaluate(`(() => ({
      settingsCount: document.querySelectorAll('.title-menu #settings').length,
      changelogTopLevel: [...document.querySelectorAll('.title-menu button')].some((button) => /changelog/i.test(button.textContent)),
      titleText: document.querySelector('.title-big')?.textContent?.trim()
    }))()`);
    if (title.settingsCount !== 1 || title.changelogTopLevel || title.titleText !== 'ASHEN SPIRE') {
      throw new Error(`title route changed (${JSON.stringify(title)})`);
    }
    await evaluate('document.querySelector("#settings").click()');
    await until('!!document.querySelector(".settings-modal .set-tab[data-member=\\"About\\"]")', 'Settings modal or About tab is unreachable');
    await evaluate('document.querySelector(".settings-modal .set-tab[data-member=\\"About\\"]").click()');
    await until('!!document.querySelector(".settings-modal .about-changelog details.about-change summary")', 'About did not mount the changelog');
    const initial = await evaluate(`(() => {
      const host = document.querySelector('.settings-modal');
      const all = [...host.querySelectorAll('details.about-change')];
      const summary = all[0]?.querySelector('summary');
      if (summary) summary.focus();
      const sourceLink = host.querySelector('.about-debug-version');
      return {
        count: all.length,
        initiallyClosed: all.every((item) => !item.open),
        minHeight: summary ? parseFloat(getComputedStyle(summary).minHeight) : null,
        summaryName: summary?.textContent?.trim().replace(/\\s+/g, ' ') || '',
        summaryTabIndex: summary?.tabIndex,
        disclosureBlocks: host.querySelectorAll('.about-block').length,
        hasCopy: !!host.querySelector('.about-copy'),
        hasDone: !!host.querySelector('#set-close'),
        changeLinks: [...host.querySelectorAll('a.about-change-pr')].map((link) => ({ href: link.href, target: link.target, rel: link.rel })),
        changeInert: host.querySelectorAll('span.about-change-pr').length,
        source: { href: sourceLink?.href, target: sourceLink?.target, rel: sourceLink?.rel }
      };
    })()`);
    if (!initial.summaryName || initial.summaryTabIndex !== 0) throw new Error(`changelog summary is not keyboard reachable (${JSON.stringify(initial)})`);
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    const afterKeyboard = await evaluate(`(() => ({
      keyboardOpened: document.querySelector('details.about-change').open,
      focusedSummary: document.activeElement === document.querySelector('details.about-change summary')
    }))()`);
    const summaryObject = await send('Runtime.evaluate', {
      expression: 'document.querySelector("details.about-change summary")', returnByValue: false,
    });
    const ax = await send('Accessibility.getPartialAXTree', {
      objectId: summaryObject.result.objectId, fetchRelatives: false,
    });
    const axNode = ax.nodes?.[0];
    const axExpanded = axNode?.properties?.find((property) => property.name === 'expanded')?.value?.value;
    const axFocused = axNode?.properties?.find((property) => property.name === 'focused')?.value?.value;
    const contexts = artifact ? {
      pages: true,
      releaseHasLink: !!initial.source.href,
      releaseChangelogHasLink: initial.changeLinks.length > 0,
    } : await evaluate(`(async () => {
      const { shouldLinkDebugVersion, shouldLinkChangelog } = await import('/src/ui/screens/about.js');
      return {
        pages: shouldLinkDebugVersion({ runPath: 'standalone file', locationLike: { protocol: 'https:', hostname: 'cehinds.github.io' } }),
        releaseHasLink: shouldLinkDebugVersion({ runPath: 'standalone file', locationLike: { protocol: 'file:', hostname: '' } }),
        releaseChangelogHasLink: shouldLinkChangelog({ runPath: 'standalone file', locationLike: { protocol: 'file:', hostname: '' } })
      };
    })()`);
    const failures = [];
    if (initial.count !== entries.length) failures.push(`rendered ${initial.count}/${entries.length} entries`);
    if (!initial.initiallyClosed) failures.push('an entry starts expanded');
    if (!afterKeyboard.keyboardOpened || !afterKeyboard.focusedSummary) failures.push(`summary keyboard activation failed (${JSON.stringify(afterKeyboard)})`);
    if (!Number.isFinite(initial.minHeight) || initial.minHeight < 44) failures.push(`mobile summary target is ${initial.minHeight}px`);
    if (!axNode?.name?.value || axExpanded !== true || axFocused !== true) failures.push(`summary accessibility state failed (${JSON.stringify({ role: axNode?.role?.value, name: axNode?.name?.value, expanded: axExpanded, focused: axFocused })})`);
    if (!initial.disclosureBlocks || !initial.hasCopy || !initial.hasDone) failures.push('existing About content or Done navigation was lost');
    if (!artifact && (initial.source.href?.replace(/\/$/, '') !== REPO || initial.source.target !== '_blank' || !initial.source.rel.includes('noopener'))) failures.push('source debug link is missing or unsafe');
    if (artifact && initial.source.href) failures.push('release standalone gained repository link');
    if (!artifact && (initial.changeLinks.length !== entries.length || initial.changeInert !== 0
      || initial.changeLinks.some((link) => !link.href.startsWith(`${REPO}/pull/`) || link.target !== '_blank' || !link.rel.includes('noopener')))) {
      failures.push('development changelog links are missing or unsafe');
    }
    if (artifact && (initial.changeLinks.length !== 0 || initial.changeInert !== entries.length)) failures.push('release standalone changelog gained navigable anchor');
    if (!contexts.pages) failures.push('Pages development bundle has no repository link');
    if (contexts.releaseHasLink) failures.push('release file silently gained repository link');
    if (contexts.releaseChangelogHasLink) failures.push('release standalone changelog gained navigable anchor');
    if (failures.length) throw new Error(failures.join('; '));
    if (screenshotDir) {
      await evaluate(`(() => {
        document.querySelector('details.about-change summary').scrollIntoView({ block: 'center' });
        const label = document.createElement('div');
        label.id = 'about-evidence-label';
        label.textContent = ${JSON.stringify(`ISSUE #189 · ${shape.tag.toUpperCase()} · SOURCE`)};
        label.style.cssText = 'position:fixed;right:8px;top:8px;z-index:2147483647;padding:7px 10px;background:#070806;color:#ead79d;border:1px solid #ad9151;font:700 12px/1.2 system-ui;letter-spacing:.08em';
        document.body.appendChild(label);
      })()`);
      await new Promise((ok) => setTimeout(ok, 150));
      const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      writeFileSync(resolve(screenshotDir, `about-changelog-${shape.tag}.png`), Buffer.from(shot.data, 'base64'));
      await evaluate('document.querySelector("#about-evidence-label")?.remove()');
    }
    await evaluate('document.querySelector("#set-close").click()');
    await until('!document.querySelector(".settings-modal") && !!document.querySelector(".title-screen #settings")', 'Done did not return to title');
    socket.close();
  } finally {
    if (browser) await browser.close();
    await new Promise((ok) => server.close(ok));
  }
}

async function browserCheck(entries, { sourceOnly = false, screenshotDir = null } = {}) {
  await browserRoute(entries, { shape: PHONE, screenshotDir });
  if (screenshotDir) await browserRoute(entries, { shape: DESKTOP, screenshotDir });
  if (!sourceOnly) {
    if (!existsSync(BUILD)) throw new Error('selected standalone root is missing: build/AshenSpire.html');
    await browserRoute(entries, { artifact: true, shape: PHONE });
  }
}

async function selftest() {
  const good = parseChangelog(readFileSync(OWNER, 'utf8'));
  const parserPlants = [
    ['malformed receipt', '- **No metadata**'],
    ['mismatched PR', '- **Mismatch** ([#1](https://github.com/cehinds/AshenSpire/pull/2), `0.4.0.1`).'],
    ['duplicate ID', '- **A** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.4.0.1`).\n- **B** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.4.0.2`).'],
  ];
  let caught = 0;
  for (const [name, body] of parserPlants) {
    try { parseChangelog(`# Test\n\n## 2026-08-20\n\n${body}\n`); console.error(`MISS ${name}`); }
    catch { caught++; console.log(`CAUGHT ${name}`); }
  }
  const { validateChangelog } = await import('../src/content/changelog.js');
  const modelPlants = [
    ['unsafe URL', [{ ...good[0], url: 'https://example.test/not-the-repository' }]],
    ['duplicate model ID', [good[0], { ...good[1], id: good[0].id }]],
  ];
  for (const [name, entries] of modelPlants) {
    try { validateChangelog(entries); console.error(`MISS ${name}`); }
    catch { caught++; console.log(`CAUGHT ${name}`); }
  }
  // Build numbers are deliberately not identities: docs/evidence batches may
  // share one, while their PR-derived stable entry IDs remain distinct.
  try { validateChangelog([good[0], { ...good[1], build: good[0].build }]); console.log('PASS duplicate build accepted with distinct stable IDs'); }
  catch (error) { console.error(`FAIL duplicate build rejected: ${error.message}`); process.exitCode = 1; }
  // A refusal that over-fires on ordinary prose is its own defect. Bracketed words
  // with NO link definition in the file are not a link, and must survive untouched.
  try {
    const [plain] = parseChangelog('# T\n\n## 2026-08-20\n\n- **S** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.4.0.1`). The row reads [no reward] and stops there.\n');
    if (plain.detail !== 'The row reads [no reward] and stops there.') throw new Error(`rewrote it to: ${plain.detail}`);
    console.log('PASS bracketed prose with no link definition is accepted unchanged');
  } catch (error) { console.error(`FAIL bracketed prose refused or altered: ${error.message}`); process.exitCode = 1; }
  // …and the normalizer must not invent a match either: internal spacing is only
  // collapsed for COMPARISON, never in the prose the player reads.
  try {
    const [spaced] = parseChangelog('# T\n\n## 2026-08-20\n\n- **S** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.4.0.1`). It reads [the   guide] and stops.\n');
    if (spaced.detail !== 'It reads [the   guide] and stops.') throw new Error(`rewrote it to: ${spaced.detail}`);
    console.log('PASS internal spacing is normalized for comparison only, never in the prose');
  } catch (error) { console.error(`FAIL spaced bracketed prose refused or altered: ${error.message}`); process.exitCode = 1; }
  // The widened raw-HTML class must not swallow ordinary prose: `<` followed by a
  // space is arithmetic, not markup. (The preamble's own `0.4.0.<ordinal>` WOULD
  // match, and is unreachable by construction — only `- ` and `## ` lines are read.)
  try {
    const [cmp] = parseChangelog('# T\n\n## 2026-08-20\n\n- **S** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.4.0.1`). Costs 3 < 5 and 9 > 2, both fine.\n');
    if (cmp.detail !== 'Costs 3 < 5 and 9 > 2, both fine.') throw new Error(`rewrote it to: ${cmp.detail}`);
    console.log('PASS bare comparison signs are not read as markup');
  } catch (error) { console.error(`FAIL comparison prose refused or altered: ${error.message}`); process.exitCode = 1; }
  // The bracket SCANNER's own over-fire edge. CommonMark requires `](` to be
  // adjacent: a bracketed phrase followed by a SPACE and a parenthesis is ordinary
  // prose on GitHub, and counting depth must not turn it into a link here.
  try {
    const [gap] = parseChangelog('# T\n\n## 2026-08-20\n\n- **S** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.4.0.1`). The row reads [no reward] (and stops).\n');
    if (gap.detail !== 'The row reads [no reward] (and stops).') throw new Error(`rewrote it to: ${gap.detail}`);
    console.log('PASS a bracketed phrase and a separated parenthesis is not read as a link');
  } catch (error) { console.error(`FAIL separated bracket and parenthesis refused or altered: ${error.message}`); process.exitCode = 1; }
  // A reference-style SHAPE with NO definition behind it is ordinary English and
  // GitHub renders it literally. This is the positive that guards the narrowing —
  // the three reference PLANTS all supply a definition, so they would still be
  // caught by a branch that refused unconditionally, and only this can tell.
  try {
    const [full] = parseChangelog('# T\n\n## 2026-08-20\n\n- **S** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.4.0.1`). Supports [keyboard][gamepad] input.\n');
    if (full.detail !== 'Supports [keyboard][gamepad] input.') throw new Error(`rewrote it to: ${full.detail}`);
    const [collapsed] = parseChangelog('# T\n\n## 2026-08-20\n\n- **S** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.4.0.1`). Supports [keyboard][] input.\n');
    if (collapsed.detail !== 'Supports [keyboard][] input.') throw new Error(`rewrote the collapsed form to: ${collapsed.detail}`);
    const [escapedLabel] = parseChangelog('# T\n\n## 2026-08-20\n\n- **S** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.4.0.1`). Supports [guide][foo\\]bar] input.\n');
    if (escapedLabel.detail !== 'Supports [guide][foo\\]bar] input.') throw new Error(`rewrote the escaped-label form to: ${escapedLabel.detail}`);
    console.log('PASS a reference-style shape with NO definition is prose, not a link');
  } catch (error) { console.error(`FAIL undefined reference shape refused or altered: ${error.message}`); process.exitCode = 1; }
  // Underscores have stricter delimiter rules than asterisks: intraword runs
  // are literal, including around non-ASCII letters, while standalone pairs
  // still mean emphasis or strong emphasis.
  try {
    const [underscores] = parseChangelog('# T\n\n## 2026-08-20\n\n- **S** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.4.0.1`). Keeps foo__bar__baz and café_mode_écran, but flattens __bold__ and _emphasis_.\n');
    if (underscores.detail !== 'Keeps foo__bar__baz and café_mode_écran, but flattens bold and emphasis.') throw new Error(`rewrote it to: ${underscores.detail}`);
    console.log('PASS intraword underscores stay literal while standalone emphasis flattens');
  } catch (error) { console.error(`FAIL underscore flanking: ${error.message}`); process.exitCode = 1; }
  try {
    const [marks] = parseChangelog('# T\n\n## 2026-08-20\n\n- **S** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.4.0.1`). Keeps e\u0301_mode\u0301_ and a\u200d_mode\u200d_ as decomposed identifiers.\n');
    if (marks.detail !== 'Keeps e\u0301_mode\u0301_ and a\u200d_mode\u200d_ as decomposed identifiers.') throw new Error(`rewrote it to: ${marks.detail}`);
    console.log('PASS non-punctuation Unicode neighbours keep intraword underscores literal');
  } catch (error) { console.error(`FAIL combining-mark underscore flanking: ${error.message}`); process.exitCode = 1; }
  // Asterisks may delimit intraword emphasis, but punctuation edges still have
  // to be left- or right-flanking for both ordinary and strong emphasis.
  try {
    const [asterisks] = parseChangelog('# T\n\n## 2026-08-20\n\n- **S** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.4.0.1`). Flattens foo*bar*baz and foo**strong**baz; keeps a*"quoted"* and a**"strong"**.\n');
    if (asterisks.detail !== 'Flattens foobarbaz and foostrongbaz; keeps a*"quoted"* and a**"strong"**.') throw new Error(`rewrote it to: ${asterisks.detail}`);
    console.log('PASS intraword asterisk emphasis flattens and non-flanking edges stay literal');
  } catch (error) { console.error(`FAIL asterisk flanking: ${error.message}`); process.exitCode = 1; }
  try {
    const [crossing] = parseChangelog('# T\n\n## 2026-08-20\n\n- **S** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.4.0.1`). Reads *foo _bar* baz_ exactly.\n');
    if (crossing.detail !== 'Reads foo _bar baz_ exactly.') throw new Error(`rewrote it to: ${crossing.detail}`);
    console.log('PASS emphasis markers cannot pair across another marker boundary');
  } catch (error) { console.error(`FAIL crossing emphasis: ${error.message}`); process.exitCode = 1; }
  try {
    const [escaped] = parseChangelog('# T\n\n## 2026-08-20\n\n- **S** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.4.0.1`). Keeps \\*literal\\* and flattens \\**adjacent** plus \\__under__ correctly.\n');
    if (escaped.detail !== 'Keeps *literal* and flattens *adjacent* plus _under_ correctly.') throw new Error(`rewrote it to: ${escaped.detail}`);
    const parity = flattenInline('\\\\**bold**', 'backslash parity positive');
    if (parity !== '\\bold') throw new Error(`even escape parity rewrote to: ${JSON.stringify(parity)}`);
    console.log('PASS escaped markers stay literal while adjacent run characters still delimit');
  } catch (error) { console.error(`FAIL escaped asterisks: ${error.message}`); process.exitCode = 1; }
  try {
    const [ticks] = parseChangelog('# T\n\n## 2026-08-20\n\n- **S** ([#1](https://github.com/cehinds/AshenSpire/pull/1), `0.4.0.1`). Keeps \\`literal\\` backticks.\n');
    if (ticks.detail !== 'Keeps `literal` backticks.') throw new Error(`rewrote it to: ${ticks.detail}`);
    console.log('PASS escaped backticks stay literal instead of opening a code span');
  } catch (error) { console.error(`FAIL escaped backticks: ${error.message}`); process.exitCode = 1; }
  const total = parserPlants.length + modelPlants.length;
  // Same door as the UI plants below: a real CHANGELOG.md in a copied tree, read
  // by a child process through `--probe-source`, so the refusal is exercised from
  // the file rather than from a string handed to the parser. All three of these
  // reached the projection at exit 0 before 2026-08-22.
  const treePlants = [
    {
      name: 'crossing emphasis delimiters preserve the unmatched marker pair', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. It reads *foo _bar* baz_ here.',
      write: { detail: 'Docs only. It reads foo _bar baz_ here.' },
    },
    {
      name: 'backslash-escaped asterisks survive as literal characters', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. It reads \\*literal\\* here.',
      write: { detail: 'Docs only. It reads *literal* here.' },
    },
    {
      name: 'only the escaped star is withheld from an adjacent delimiter run', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. It reads \\**literal** here.',
      write: { detail: 'Docs only. It reads *literal* here.' },
    },
    {
      name: 'only the escaped underscore is withheld from an adjacent delimiter run', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. It reads \\__literal__ here.',
      write: { detail: 'Docs only. It reads _literal_ here.' },
    },
    {
      name: 'backslash pairs collapse before an active emphasis delimiter', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. It reads \\\\**bold** here.',
      write: { detail: 'Docs only. It reads \\bold here.' },
    },
    {
      name: 'backslash-escaped backticks survive as literal characters', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. It reads \\`literal\\` here.',
      write: { detail: 'Docs only. It reads `literal` here.' },
    },
    {
      name: 'reference-style link in prose', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [the guide][docs] for the rest.\n\n[docs]: https://example.invalid/guide',
      expect: 'prose contains a reference-style link',
    },
    {
      name: 'reference definition with an escaped closing bracket', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [guide][foo\\]bar] for the rest.\n\n[foo\\]bar]: /docs',
      expect: 'prose contains a reference-style link',
    },
    {
      name: 'shortcut definition with an escaped closing bracket', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [foo\\]bar] for the rest.\n\n[foo\\]bar]: /docs',
      expect: 'prose contains a shortcut reference link',
    },
    {
      name: 'defined shortcut nested inside literal outer brackets', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [outer [docs]] for the rest.\n\n[docs]: /guide',
      expect: 'prose contains a shortcut reference link',
    },
    {
      name: 'collapsed reference link in prose', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [docs][] for the rest.\n\n[docs]: https://example.invalid/guide',
      expect: 'prose contains a reference-style link',
    },
    {
      name: 'shortcut reference link in prose', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [docs] for the rest.\n\n[docs]: https://example.invalid/guide',
      expect: 'prose contains a shortcut reference link',
    },
    // The label normalizer's own neighbourhood, one cell either side of it, both
    // through the file. CommonMark collapses consecutive internal whitespace when
    // matching labels; comparing raw `trim().toLowerCase()` on each side missed
    // both of these while GitHub rendered a link. Delete the collapse from
    // normalizeLinkLabel and these two are the plants that go MISS.
    {
      name: 'shortcut link, spaced definition against tight use', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [the guide] for the rest.\n\n[the   guide]: https://example.invalid/guide',
      expect: 'prose contains a shortcut reference link',
    },
    {
      name: 'shortcut link, tight definition against spaced use', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [the   guide] for the rest.\n\n[the guide]: https://example.invalid/guide',
      expect: 'prose contains a shortcut reference link',
    },
    // Sunna's four, 2026-08-22. Three are closed and planted here; the fourth
    // (non-ASCII case folding) is DECLARED OPEN in REFUSAL_SCOPE and has no plant,
    // because a plant for a form the tool does not refuse would have to assert the
    // leak — and the honest home for that is the printed scope, not a green.
    {
      name: 'inline link with an EMPTY destination', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [details]() for the rest.',
      expect: 'prose contains a link',
    },
    {
      name: 'HTML comment in prose — hidden by GitHub, PRINTED to the player', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. Note.<!-- maintainer note -->',
      expect: 'prose contains raw HTML',
    },
    {
      name: 'HTML comment opener whose close is on the following line', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. Note.<!-- maintainer note\n-->',
      expect: 'prose contains raw HTML',
    },
    {
      name: 'processing instruction in prose', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. Note.<?php ?>',
      expect: 'prose contains raw HTML',
    },
    {
      name: 'shortcut link, TAB inside the definition label', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [the guide] for the rest.\n\n[the\tguide]: https://example.invalid/guide',
      expect: 'prose contains a shortcut reference link',
    },
    // Codex `3836350414` and Bjorn's BLOCK, 2026-08-22, at `a7f1424`. A nested-bracket
    // label is valid CommonMark link text and GitHub renders it; the old character
    // class stopped at the inner `]`. Counting depth closes the FORM rather than one
    // more level of it, so a plant two deep is planted beside the plant one deep.
    // Stop the label scan at the first `]` and exactly these four go MISS.
    {
      name: 'inline link with a NESTED-BRACKET label', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [the [advanced] guide](/guide) for the rest.',
      expect: 'prose contains a link',
    },
    {
      name: 'inline link with a label nested TWO deep', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [the [very [advanced]] guide](/guide) for the rest.',
      expect: 'prose contains a link',
    },
    {
      name: 'reference-style link with a NESTED-BRACKET label', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [the [advanced] guide][docs] for the rest.\n\n[docs]: https://example.invalid/guide',
      expect: 'prose contains a reference-style link',
    },
    {
      name: 'image with a NESTED-BRACKET alt text', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See ![the [wide] shot](/i.png) for the rest.',
      expect: 'prose contains an image',
    },
    // Codex `3836350419`, same head. NOT a refusal — a FLATTEN, so the plant reads
    // what reached the projection instead of reading an error. `` `([^`]+)` ``
    // matched the inner pair and left the outer backticks standing: a two-backtick
    // span became a ONE-backtick span in `changelog.generated.js`, which is literal
    // backticks reaching the player. Revert the run-length backreference and exactly
    // these two go MISS.
    {
      name: 'two-backtick code span, flattened whole', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. It reads ``foo`` here.',
      write: { detail: 'Docs only. It reads foo here.' },
    },
    {
      name: 'three-backtick code span, flattened whole', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. It reads ```bar``` here.',
      write: { detail: 'Docs only. It reads bar here.' },
    },
    // Sten's BLOCK at `5bb82f2`, 2026-08-22. `REFUSAL_SCOPE` said `inline link`
    // unqualified and TWO valid CommonMark inline links walked past it. The first
    // is the only form this PR ever found that CORRUPTS rather than leaks: the
    // scanner stopped the label at the `]` inside a code span, refused nothing, and
    // the flattener then took the backticks off — `See [the ] guide](/guide)`, words
    // nobody wrote. Blank out `maskCodeSpans` and exactly these two go MISS, one by
    // exit code and one by the projection, because removing the mask restores the
    // OVER-fire in the same stroke as the under-fire and only a write plant sees it.
    {
      name: 'code-span `]` closing a link label EARLY — a corruption, not a leak', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [the `]` guide](/guide) for the rest.',
      expect: 'prose contains a link',
    },
    {
      name: 'a link-shaped code span is code, not a refusal', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. It reads `arr[0](x)` here.',
      write: { detail: 'Docs only. It reads arr[0](x) here.' },
    },
    {
      name: 'a code span cannot open inside a bare link destination', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [x](foo`)` for the rest.',
      expect: 'prose contains a link',
    },
    {
      name: 'a code span cannot cross an angle-bracket link destination', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [x](<#foo(`>)` for the rest.',
      expect: 'prose contains a link',
    },
    {
      name: 'a link definition inside a fenced code block is only an example', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. Keeps [docs] literal.\n\n   ```text\n[docs]: /guide\n````',
      write: { detail: 'Docs only. Keeps [docs] literal.' },
    },
    {
      name: 'a definition inside a tilde fence is only an example', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. Keeps [more] literal.\n\n~~~text\n[more]: /more\n~~~~',
      write: { detail: 'Docs only. Keeps [more] literal.' },
    },
    {
      name: 'a real definition after a closed fence is still collected', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [docs].\n\n```text\n[example]: /example\n```\n\n[docs]: /guide',
      expect: 'prose contains a shortcut reference link',
    },
    // Same block, second form. A destination in `<…>` need not balance its parens,
    // so `matchingBracket` returned -1 and the link rule never ran. The report that
    // opened it quoted `[link](<foo(and(bar)>)`, which exits 1 BY THE RAW-HTML RULE
    // — `<f` is a letter — so the finding reads as unreproduced until you check
    // WHICH rule caught it. Both plants below start the destination with a character
    // outside `[a-zA-Z/!?]`, so raw HTML cannot fire and only the link rule can.
    // Make `angleDestination` return false and exactly these two go MISS.
    {
      name: 'angle-bracket destination with unbalanced parens', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [link](<#foo(and(bar)>) for the rest.',
      expect: 'prose contains a link',
    },
    {
      name: 'angle-bracket destination, no letter to trip the raw-HTML rule', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [link](<(a>) for the rest.',
      expect: 'prose contains a link',
    },
    // MY OWN REGRESSION, PLANTED SO IT CANNOT COME BACK QUIETLY. I widened the
    // code-span mask onto the shortcut scan at a356320 and it shipped `[the guide]`
    // — brackets the author did not write — within the hour. Reverted; this is the
    // plant the revert did not have. Read `masked` instead of `text` in the shortcut
    // loop and exactly this one goes MISS.
    {
      name: 'shortcut link whose DEFINED LABEL contains a code span', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [the `guide`] for the rest.\n\n[the `guide`]: https://example.invalid/guide',
      expect: 'prose contains a shortcut reference link',
    },
    {
      name: 'missing title Settings route', file: 'src/ui/screens/title.js',
      find: 'id="settings"', replace: 'id="settings-missing"', expect: 'title Settings control is unreachable',
    },
    {
      name: 'missing About mount', file: 'src/ui/screens/settings.js',
      find: "About: { mount: 'set-about-mount'", replace: "About: { mount: 'set-about-missing'", expect: 'About did not mount the changelog',
    },
    {
      name: 'broken Done navigation', file: 'src/ui/screens/settings.js',
      find: "veil.querySelector('#set-close').addEventListener('click', close);",
      replace: "veil.querySelector('#set-close').addEventListener('click', () => {});",
      expect: 'Done did not return to title',
    },
    {
      name: 'non-keyboard changelog row', file: 'src/ui/screens/about.js',
      find: '<summary class="region-fold">', replace: '<div class="region-fold">', expect: 'About did not mount the changelog',
    },
    {
      name: 'missing Pages development link', file: 'src/ui/screens/about.js',
      find: "locationLike?.hostname === 'cehinds.github.io'", replace: "locationLike?.hostname === 'example.invalid'", expect: 'Pages development bundle has no repository link',
    },
    {
      name: 'release standalone link leak', file: 'src/ui/screens/about.js',
      find: "return runPath === 'standalone file'\n    && locationLike?.protocol === 'https:'\n    && locationLike?.hostname === 'cehinds.github.io';",
      replace: "return runPath === 'standalone file';", expect: 'release file silently gained repository link',
    },
    {
      name: 'release standalone changelog anchor leak', file: 'src/ui/screens/about.js',
      find: 'export function shouldLinkChangelog(options = {}) {\n  return shouldLinkDebugVersion(options);\n}',
      replace: 'export function shouldLinkChangelog() {\n  return true; // planted: release artifact can navigate externally\n}',
      expect: 'release standalone changelog gained navigable anchor',
    },
  ];
  for (const plant of treePlants) {
    const tempParent = mkdtempSync(join(tmpdir(), 'about-changelog-plant-'));
    const tempRoot = join(tempParent, 'repo');
    try {
      cpSync(ROOT, tempRoot, {
        recursive: true,
        filter: (source) => {
          const rel = relative(ROOT, source).replace(/\\/g, '/');
          return rel !== '.git' && rel !== 'build' && !rel.startsWith('build/')
            && rel !== 'dist' && !rel.startsWith('dist/') && rel !== 'AshenSpire.html'
            && rel !== 'docs' && !rel.startsWith('docs/');
        },
      });
      const target = resolve(tempRoot, plant.file);
      const before = readFileSync(target, 'utf8');
      if (!before.includes(plant.find)) throw new Error(`${plant.name}: plant site drifted`);
      writeFileSync(target, before.replace(plant.find, plant.replace));
      // A REFUSAL plant reads the error; a FLATTEN plant reads the projection. The
      // second kind cannot be checked by an exit code — the tool is SUPPOSED to
      // accept the prose — so it goes through `--write` in the copied tree and the
      // written module is read back. That is the same door and the same child.
      const mode = plant.write ? '--write' : '--probe-source';
      const child = spawnSync(process.execPath, [SCRIPT, '--root', tempRoot, mode], {
        cwd: tempRoot, encoding: 'utf8', timeout: 60000,
      });
      const output = `${child.stdout || ''}\n${child.stderr || ''}`;
      if (plant.write) {
        const projected = child.status === 0
          ? readFileSync(resolve(tempRoot, 'src/content/changelog.generated.js'), 'utf8')
          : '';
        if (child.status !== 0 || !projected.includes(JSON.stringify(plant.write.detail).slice(1, -1))) {
          console.error(`MISS ${plant.name}: exit=${child.status}; expected detail ${JSON.stringify(plant.write.detail)}; output=${output.slice(-600)}`);
          process.exitCode = 1;
        } else {
          caught++;
          console.log(`CAUGHT ${plant.name}`);
        }
      } else if (child.status === 0 || !output.includes(plant.expect)) {
        console.error(`MISS ${plant.name}: exit=${child.status}; expected ${plant.expect}; output=${output.slice(-1200)}`);
        process.exitCode = 1;
      } else {
        caught++;
        console.log(`CAUGHT ${plant.name}`);
      }
    } finally {
      rmSync(tempParent, { recursive: true, force: true });
    }
  }
  const grandTotal = total + treePlants.length;
  if (caught !== grandTotal || !good.length) process.exitCode = 1;
  else if (!process.exitCode) console.log(`about-changelog selftest: ${caught} known-bads caught / 0 missed`);
}

// EVERY exit path names the scope — the greens by printing it after their verdict,
// the reds by printing it before the error goes up. A verdict a reader can see and
// a boundary they cannot is how a narrow check gets cited as a wide one.
try {
  if (process.argv.includes('--write')) {
    const entries = parseChangelog(readFileSync(OWNER, 'utf8'));
    writeFileSync(GENERATED, generatedText(entries));
    console.log(`wrote ${entries.length} receipts to ${GENERATED}`);
  } else if (process.argv.includes('--selftest')) {
    await selftest();
  } else if (process.argv.includes('--probe-source')) {
    const entries = await checkProjection();
    await browserCheck(entries, { sourceOnly: true });
    console.log(`about-changelog source probe: ${entries.length} receipts; real Settings route PASS`);
  } else {
    const entries = await checkProjection();
    const shotsAt = process.argv.indexOf('--shots');
    const screenshotDir = shotsAt >= 0 && process.argv[shotsAt + 1] ? resolve(ROOT, process.argv[shotsAt + 1]) : null;
    await browserCheck(entries, { screenshotDir });
    console.log(`about-changelog: ${entries.length} receipts match CHANGELOG.md; source + selected standalone Settings routes PASS`);
  }
  printRefusalScope();
} catch (error) {
  printRefusalScope();
  throw error;
}
