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
    const contexts = artifact ? { pages: true, releaseHasLink: !!initial.source.href } : await evaluate(`(async () => {
      const { shouldLinkDebugVersion } = await import('/src/ui/screens/about.js');
      return {
        pages: shouldLinkDebugVersion({ runPath: 'standalone file', locationLike: { protocol: 'https:', hostname: 'cehinds.github.io' } }),
        releaseHasLink: shouldLinkDebugVersion({ runPath: 'standalone file', locationLike: { protocol: 'file:', hostname: '' } })
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
    if (!contexts.pages) failures.push('Pages development bundle has no repository link');
    if (contexts.releaseHasLink) failures.push('release file silently gained repository link');
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
  const total = parserPlants.length + modelPlants.length;
  const uiPlants = [
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
  ];
  for (const plant of uiPlants) {
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
      const child = spawnSync(process.execPath, [SCRIPT, '--root', tempRoot, '--probe-source'], {
        cwd: tempRoot, encoding: 'utf8', timeout: 60000,
      });
      const output = `${child.stdout || ''}\n${child.stderr || ''}`;
      if (child.status === 0 || !output.includes(plant.expect)) {
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
  const grandTotal = total + uiPlants.length;
  if (caught !== grandTotal || !good.length) process.exitCode = 1;
  else if (!process.exitCode) console.log(`about-changelog selftest: ${caught} known-bads caught / 0 missed`);
}

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
