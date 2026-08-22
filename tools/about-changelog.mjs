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
// about them. REMOVAL: deleted the day Settings → About renders Markdown itself,
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
  [/<[a-zA-Z/!?][^>]*>/, 'raw HTML'],
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
// BOUNDARY, and it is a real one: this is a SCANNER, NOT A PARSER. It does not know
// code spans, so `` `arr[0](x)` `` is refused even though GitHub renders it as code
// — an over-fire, in the safe direction, and it is printed in REFUSAL_SCOPE rather
// than left for the author to discover.
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
export function findBracketedRefusal(text) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] !== '[') continue;
    const label = matchingBracket(text, i, '[', ']');
    if (label < 0) continue;
    if (text[label + 1] === '(' && matchingBracket(text, label + 1, '(', ')') >= 0) {
      return text[i - 1] === '!' ? 'an image' : 'a link';
    }
    if (text[label + 1] === '[' && matchingBracket(text, label + 1, '[', ']') >= 0) {
      return 'a reference-style link';
    }
  }
  return null;
}
// WHAT THIS TOOL REFUSES, AND WHAT IT LETS THROUGH. Printed on every exit path, so
// no green from here can be read as wider than it is. Anything not on the refused
// list reaches src/content/changelog.generated.js verbatim and is rendered to the
// player as text by `esc()` in src/ui/screens/about.js.
export const REFUSAL_SCOPE = [
  'about-changelog REFUSES: image · inline link · full and collapsed reference link —',
  '  all three with an EMPTY destination or a NESTED-BRACKET label, at any depth ·',
  '  shortcut reference on a defined label · raw HTML, comment and processing',
  '  instruction (`<letter`, `</`, `<!`, `<?`).',
  'about-changelog FLATTENS: **bold** · __bold__ · *emphasis* · _emphasis_ · a code',
  '  span delimited by a backtick run of ANY length.',
  'A FORM ON NEITHER LIST SHIPS TO THE PLAYER VERBATIM. Open, measured, not fixed:',
  '  non-ASCII label case folding (`[SS]` vs `[ß]:`) · `~~strike~~` · HTML entities ·',
  '  backslash escapes · a bare URL GitHub autolinks. None is present in CHANGELOG.md today.',
  'IT SCANS, IT DOES NOT PARSE: a link or a `<tag`-shaped span inside a code span is',
  '  refused too, and `a <b and b> c` reads as raw HTML. Over-fire, in the safe direction.',
].join('\n');
export function printRefusalScope() { console.log(REFUSAL_SCOPE); }
// A link-reference definition: `[label]: https://…`, up to three spaces indented.
const LINK_DEFINITION = /^ {0,3}\[([^\]]+)\]:\s*\S/;
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
export function linkDefinitionLabels(markdown) {
  const labels = new Set();
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(LINK_DEFINITION);
    if (match) labels.add(normalizeLinkLabel(match[1]));
  }
  return labels;
}
export function flattenInline(text, where, labels = new Set()) {
  const bracketed = findBracketedRefusal(text);
  if (bracketed) {
    throw new Error(`${where}: prose contains ${bracketed}, which the in-game changelog cannot render — write it in words`);
  }
  for (const [pattern, what] of INLINE_REFUSED) {
    if (pattern.test(text)) {
      throw new Error(`${where}: prose contains ${what}, which the in-game changelog cannot render — write it in words`);
    }
  }
  if (labels.size) {
    for (const [, label] of text.matchAll(/\[([^\][]+)\]/g)) {
      if (labels.has(normalizeLinkLabel(label))) {
        throw new Error(`${where}: prose contains a shortcut reference link, which the in-game changelog cannot render — write it in words`);
      }
    }
  }
  return text
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(?<![\w*])\*(?=\S)([^*]*?\S)\*(?!\w)/g, '$1')
    .replace(/(?<![\w_])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1')
    // A CODE SPAN IS DELIMITED BY A BACKTICK STRING, AND ITS LENGTH IS PART OF THE
    // DELIMITER. CommonMark: a run of N backticks opens, and the span ends at the
    // next run of EXACTLY N. `` `([^`]+)` `` matched the INNER pair of ``` ``foo`` ```
    // and left the outer backticks standing, so a two-backtick span became a
    // ONE-backtick span in the projection — literal backticks reaching the player,
    // which is the defect this whole change exists to stop. Measured 2026-08-22 by
    // Codex and by Bjorn at the real door. The run length is now carried by a
    // backreference, and the lookarounds keep the run from being cut short at either
    // end. A backtick that is part of the span's CONTENT survives, as it must:
    // ``` ``a`b`` ``` is the text ``a`b`` on GitHub too.
    .replace(/(?<!`)(`+)(?!`)([\s\S]*?)(?<!`)\1(?!`)/g, '$2');
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
  const total = parserPlants.length + modelPlants.length;
  // Same door as the UI plants below: a real CHANGELOG.md in a copied tree, read
  // by a child process through `--probe-source`, so the refusal is exercised from
  // the file rather than from a string handed to the parser. All three of these
  // reached the projection at exit 0 before 2026-08-22.
  const treePlants = [
    {
      name: 'reference-style link in prose', file: 'CHANGELOG.md',
      find: '). Docs only.',
      replace: '). Docs only. See [the guide][docs] for the rest.\n\n[docs]: https://example.invalid/guide',
      expect: 'prose contains a reference-style link',
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
