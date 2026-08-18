#!/usr/bin/env node
// tools/about-changelog.mjs — the same-door About / Changelog browser probe.
//
// Normal mode opens the real title-screen Settings door, selects About, expands
// notes with pointer and keyboard input, checks the debug-only repository link,
// and writes the pixels it inspected. --selftest sends malformed changelog data
// through the same validator the production data passes at module import.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHANGELOG, PROJECT_REPOSITORY_URL, validateChangelog } from '../src/content/changelog.js';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const SHOT = resolve(ROOT, 'docs/preview/about-changelog.png');
const BROWSERS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

function selftest() {
  const good = validateChangelog(CHANGELOG);
  const plants = [
    { name: 'empty release list', value: [], wants: 'at least one release' },
    {
      name: 'empty detail',
      value: [{ version: '0.4.0', date: '2026-08-17', label: 'test', changes: [{ summary: 'Short', detail: '' }] }],
      wants: '.detail must be a non-empty string',
    },
    {
      name: 'multiline summary',
      value: [{ version: '0.4.0', date: '2026-08-17', label: 'test', changes: [{ summary: 'First\nSecond', detail: 'Receipt' }] }],
      wants: '.summary must stay on one authored line',
    },
    {
      name: 'duplicate version',
      value: [
        { version: '0.4.0', date: '2026-08-17', label: 'one', changes: [{ summary: 'One', detail: 'One detail' }] },
        { version: '0.4.0', date: '2026-08-18', label: 'two', changes: [{ summary: 'Two', detail: 'Two detail' }] },
      ],
      wants: "duplicates '0.4.0'",
    },
  ];
  const failures = [];
  if (good.length) failures.push(`clean CHANGELOG rejected: ${good.join(' | ')}`);
  for (const plant of plants) {
    const found = validateChangelog(plant.value);
    const caught = found.some((line) => line.includes(plant.wants));
    console.log(`  ${caught ? 'PASS' : 'FAIL'}  ${plant.name}${caught ? '' : ` — ${found.join(' | ') || 'NOT CAUGHT'}`}`);
    if (!caught) failures.push(plant.name);
  }
  console.log(`about-changelog selftest: clean=${good.length ? 'RED' : 'GREEN'} · plants=${plants.length - failures.length}/${plants.length} caught`);
  process.exitCode = failures.length ? 1 : 0;
}

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: done, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else done(message.result);
  });
  return {
    ready: new Promise((done, fail) => {
      ws.addEventListener('open', done);
      ws.addEventListener('error', fail);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((done, fail) => {
        pending.set(id, { resolve: done, reject: fail });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { ws.close(); },
  };
}

async function browserProbe() {
  const browser = BROWSERS.find((candidate) => existsSync(candidate));
  if (!browser) throw new Error('no Chrome or Edge found; set CHROME or install a supported browser');

  const served = await serve({ root: ROOT, port: 8519, open: false });
  const launched = await launchBrowser({
    prefix: 'about-changelog-',
    browser,
    args: ['--disable-background-timer-throttling'],
    timeoutMs: 12000,
  });
  const cdp = connectCdp(launched.wsUrl);
  try {
    await cdp.ready;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1200, height: 900, deviceScaleFactor: 1, mobile: false,
    }, sessionId);

    const evaluate = async (expression) => {
      const out = await cdp.send('Runtime.evaluate', {
        expression, awaitPromise: true, returnByValue: true,
      }, sessionId);
      if (out.exceptionDetails) throw new Error(out.exceptionDetails.exception?.description || 'page evaluation failed');
      return out.result.value;
    };

    const waitForPage = async (label, expression, timeoutMs = 6000) => {
      const deadline = Date.now() + timeoutMs;
      let last = null;
      while (Date.now() < deadline) {
        last = await evaluate(expression);
        if (last) return last;
        await wait(80);
      }
      throw new Error(`about-changelog: timed out waiting for ${label}${last ? ` (${JSON.stringify(last)})` : ''}`);
    };

    const openAbout = async () => {
      await waitForPage('the title Settings button', `!!document.querySelector('#settings')`);
      await evaluate(`document.querySelector('#settings').click()`);
      await waitForPage('the Settings About tab', `!!document.querySelector('.set-tab[data-member="About"]')`);
      await evaluate(`document.querySelector('.set-tab[data-member="About"]').click()`);
      return waitForPage('the selected About tab and mounted changelog', `(() => {
        const tab = document.querySelector('.set-tab[data-member="About"]');
        return !!(tab && tab.getAttribute('aria-selected') === 'true'
          && document.querySelector('[data-settings-host]')
          && document.querySelector('.about-ai .about-changelog'));
      })()`);
    };

    await cdp.send('Page.navigate', { url: served.url }, sessionId);
    await openAbout();

    const arrival = await evaluate(`(() => {
      const root = document.querySelector('.about-ai');
      const items = [...document.querySelectorAll('.about-change')];
      const link = document.querySelector('.about-version-link');
      return {
        preservedAcknowledgement: !!(root && root.querySelector('.about-lead') && root.querySelector('.about-copy')),
        releases: document.querySelectorAll('.about-release').length,
        changes: items.length,
        allClosed: items.every((item) => !item.open),
        summaries: items.map((item) => item.querySelector('summary')?.textContent.trim() || ''),
        debugLink: link && { href: link.href, target: link.target, rel: link.rel, label: link.getAttribute('aria-label') },
      };
    })()`);
    const expectedChanges = CHANGELOG.reduce((count, release) => count + release.changes.length, 0);
    const failures = [];
    if (!arrival.preservedAcknowledgement) failures.push('existing About acknowledgement/actions were not preserved');
    if (arrival.releases !== CHANGELOG.length) failures.push(`rendered ${arrival.releases}/${CHANGELOG.length} releases`);
    if (arrival.changes !== expectedChanges) failures.push(`rendered ${arrival.changes}/${expectedChanges} changes`);
    if (!arrival.allClosed) failures.push('a change was expanded on arrival');
    if (arrival.summaries.some((summary) => !summary)) failures.push('an empty summary reached the screen');
    if (!arrival.debugLink || arrival.debugLink.href.replace(/\/$/, '') !== PROJECT_REPOSITORY_URL) failures.push('debug build version does not link to the repository');
    if (arrival.debugLink && (arrival.debugLink.target !== '_blank' || !arrival.debugLink.rel.includes('noopener') || !arrival.debugLink.rel.includes('noreferrer'))) {
      failures.push('repository link does not use a safe external-link boundary');
    }

    const clicked = await evaluate(`(() => {
      const summary = document.querySelector('.about-change summary');
      summary.click();
      const details = summary.closest('details');
      return { open: details.open, detail: details.querySelector('p')?.textContent.trim() || '' };
    })()`);
    if (!clicked.open || !clicked.detail) failures.push('pointer activation did not reveal the first change detail');

    const focused = await evaluate(`(() => {
      const summary = document.querySelectorAll('.about-change summary')[1];
      summary.focus();
      return document.activeElement === summary;
    })()`);
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32,
    }, sessionId);
    await cdp.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32,
    }, sessionId);
    await wait(120);
    const keyboardOpen = await evaluate(`document.querySelectorAll('.about-change')[1].open`);
    if (!focused || !keyboardOpen) failures.push('keyboard Space did not expand the focused second change');

    const releaseEdge = await evaluate(`(async () => {
      const { renderAboutSection } = await import('/src/ui/screens/about.js');
      const host = document.createElement('div');
      renderAboutSection(host, { runPath: 'standalone file' });
      return { link: !!host.querySelector('.about-version-link'), line: host.querySelector('.about-ver')?.textContent.trim() || '' };
    })()`);
    if (releaseEdge.link || !releaseEdge.line.includes('standalone file')) {
      failures.push('standalone release edge exposed the debug repository link or lost its run-path label');
    }

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    }, sessionId);
    await cdp.send('Page.navigate', { url: served.url }, sessionId);
    await openAbout();
    const mobile = await evaluate(`(() => {
      const changelog = document.querySelector('.about-changelog');
      const summaries = [...document.querySelectorAll('.about-change summary')];
      const scroller = changelog?.closest('.modal, .overlay-body');
      return {
        present: !!changelog,
        horizontalOverflow: !!scroller && scroller.scrollWidth > scroller.clientWidth + 1,
        minSummaryHeight: summaries.length ? Math.min(...summaries.map((s) => s.getBoundingClientRect().height)) : 0,
      };
    })()`);
    if (!mobile.present || mobile.horizontalOverflow) failures.push('390x844 About changelog is missing or horizontally overflows');
    if (mobile.minSummaryHeight + 0.5 < 44) failures.push(`390x844 changelog summary tap floor is ${mobile.minSummaryHeight}px, under 44px`);

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1200, height: 900, deviceScaleFactor: 1, mobile: false,
    }, sessionId);
    await cdp.send('Page.navigate', { url: served.url }, sessionId);
    const plantBlankCapture = process.argv.includes('--plant-blank-capture');
    if (!plantBlankCapture) {
      await openAbout();
      await evaluate(`(() => {
        const summary = document.querySelector('.about-change summary');
        summary.click();
        summary.closest('details').scrollIntoView({ block: 'center' });
        return true;
      })()`);
    }

    const expectedDetail = JSON.stringify(CHANGELOG[0].changes[0].detail);
    const captureReady = `(() => {
      const host = document.querySelector('[data-settings-host]');
      const tab = document.querySelector('.set-tab[data-member="About"]');
      const changelog = document.querySelector('.about-ai .about-changelog');
      const details = changelog?.querySelector('.about-change');
      const detail = details?.querySelector('p');
      if (!(host && tab?.getAttribute('aria-selected') === 'true' && changelog
        && details?.open && detail?.textContent.trim() === ${expectedDetail})) return false;
      const rect = detail.getBoundingClientRect();
      const port = detail.closest('.modal, .overlay-body')?.getBoundingClientRect();
      return !!(port && rect.top >= Math.max(0, port.top) - 1
        && rect.bottom <= Math.min(innerHeight, port.bottom) + 1);
    })()`;
    await waitForPage('the photographed About changelog with its expected expanded detail visible', captureReady, 3500);
    await wait(120);
    const png = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
    await waitForPage('the About changelog state to remain present through capture', captureReady, 1000);
    mkdirSync(resolve(SHOT, '..'), { recursive: true });
    writeFileSync(SHOT, Buffer.from(png.data, 'base64'));

    console.log(`about-changelog: ${failures.length ? 'RED' : 'GREEN'}`);
    console.log(`  About acknowledgement preserved: ${arrival.preservedAcknowledgement}`);
    console.log(`  releases/changes: ${arrival.releases}/${arrival.changes}; closed on arrival: ${arrival.allClosed}`);
    console.log(`  pointer expansion: ${clicked.open}; keyboard expansion: ${keyboardOpen}`);
    console.log(`  debug repo link: ${arrival.debugLink?.href || 'missing'}; standalone link absent: ${!releaseEdge.link}`);
    console.log(`  390x844: overflow=${mobile.horizontalOverflow}; minimum summary tap=${mobile.minSummaryHeight}px`);
    console.log(`  screenshot: ${SHOT}`);
    if (failures.length) {
      for (const failure of failures) console.error(`  FAIL: ${failure}`);
      process.exitCode = 1;
    }
  } finally {
    cdp.close();
    launched.close();
    served.server.close();
  }
}

if (process.argv.includes('--selftest')) selftest();
else await browserProbe();
