#!/usr/bin/env node
// Focused contract for #189. CHANGELOG.md is authored; the generated browser
// module must be an exact structured projection of it. Normal mode checks the
// projection and the real About disclosure. --selftest plants malformed and
// duplicated receipts. --write performs the mechanical projection only.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OWNER = resolve(ROOT, 'CHANGELOG.md');
const GENERATED = resolve(ROOT, 'src/content/generated/changelog.js');
const REPO = 'https://github.com/cehinds/AshenSpire';

export function parseChangelog(markdown) {
  const entries = [];
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
    entries.push({
      id: `pr-${pullRequest}`,
      date,
      group,
      summary,
      detail: prose || `Merged as pull request #${pullRequest} in development build ${build}.`,
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

async function browserCheck(entries) {
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
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
    for (let i = 0; i < 100 && !(await evaluate('document.readyState === "complete" && document.styleSheets.length > 1')); i++) await new Promise((ok) => setTimeout(ok, 100));
    const initial = await evaluate(`(async () => {
      const { renderAboutSection } = await import('/src/ui/screens/about.js');
      const host = document.createElement('div'); document.body.replaceChildren(host);
      renderAboutSection(host, { runPath: 'source tree', locationLike: location });
      const all = [...host.querySelectorAll('details.about-change')];
      const summary = all[0].querySelector('summary'); summary.focus();
      const sourceLink = host.querySelector('.about-debug-version');
      return { count: all.length, initiallyClosed: all.every((item) => !item.open),
        minHeight: parseFloat(getComputedStyle(summary).minHeight),
        source: { href: sourceLink?.href, target: sourceLink?.target, rel: sourceLink?.rel } };
    })()`);
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
    const afterKeyboard = await evaluate(`(() => ({
      keyboardOpened: document.querySelector('details.about-change').open,
      focusedSummary: document.activeElement === document.querySelector('details.about-change summary')
    }))()`);
    const contexts = await evaluate(`(async () => {
      const { renderAboutSection } = await import('/src/ui/screens/about.js');
      const host = document.body.firstElementChild;
      renderAboutSection(host, { runPath: 'standalone file', locationLike: { protocol: 'https:', hostname: 'cehinds.github.io' } });
      const pages = !!host.querySelector('.about-debug-version');
      renderAboutSection(host, { runPath: 'standalone file', locationLike: { protocol: 'file:', hostname: '' } });
      return { pages, releaseHasLink: !!host.querySelector('.about-debug-version'), hasCopy: !!host.querySelector('.about-copy') };
    })()`);
    const failures = [];
    if (initial.count !== entries.length) failures.push(`rendered ${initial.count}/${entries.length} entries`);
    if (!initial.initiallyClosed) failures.push('an entry starts expanded');
    if (!afterKeyboard.keyboardOpened || !afterKeyboard.focusedSummary) failures.push(`summary keyboard activation failed (${JSON.stringify(afterKeyboard)})`);
    if (!Number.isFinite(initial.minHeight) || initial.minHeight < 44) failures.push(`mobile summary target is ${initial.minHeight}px`);
    if (initial.source.href?.replace(/\/$/, '') !== REPO || initial.source.target !== '_blank' || !initial.source.rel.includes('noopener')) failures.push('source debug link is missing or unsafe');
    if (!contexts.pages) failures.push('GitHub Pages dev standalone has no repository link');
    if (contexts.releaseHasLink) failures.push('release file silently gained repository link');
    if (!contexts.hasCopy) failures.push('existing About save action was lost');
    if (failures.length) throw new Error(failures.join('; '));
    socket.close();
  } finally {
    if (browser) await browser.close();
    await new Promise((ok) => server.close(ok));
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
  const total = parserPlants.length + modelPlants.length;
  if (caught !== total || !good.length) process.exitCode = 1;
  else if (!process.exitCode) console.log(`about-changelog selftest: ${caught} known-bads caught / 0 missed`);
}

if (process.argv.includes('--write')) {
  const entries = parseChangelog(readFileSync(OWNER, 'utf8'));
  writeFileSync(GENERATED, generatedText(entries));
  console.log(`wrote ${entries.length} receipts to ${GENERATED}`);
} else if (process.argv.includes('--selftest')) {
  await selftest();
} else {
  const entries = await checkProjection();
  await browserCheck(entries);
  console.log(`about-changelog: ${entries.length} receipts match CHANGELOG.md; browser contract PASS`);
}
