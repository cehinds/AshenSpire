// Read-only screenshot maintenance. No source reconstruction or game mutation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from '../browser.mjs';

const base = 'https://cehinds.github.io/AshenSpire/release/';
const out = resolve('_release-gallery'); mkdirSync(out, { recursive: true });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { started: new Date().toISOString(), workflowCommit: process.env.GITHUB_SHA,
  purpose: 'Five posed README gallery states of the actual public numeric Release route; not an earned campaign or release acceptance proof.',
  captures: [], runtimeErrors: [], consoleErrors: [], networkFailures: [], passed: false };
let owner, browser;
const fetchMetadata = async url => {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, `public metadata: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length < 128 * 1024, 'metadata is bounded');
  return JSON.parse(bytes.toString('utf8'));
};
try {
  const latest = await fetchMetadata(new URL('latest/build.json', base));
  const expected = Number(process.env.EXPECTED_RELEASE_ORDINAL);
  assert.ok(Number.isInteger(expected) && expected > 0, 'explicit expected published ordinal required');
  assert.equal(latest.ordinal, expected, 'latest published Release still matches approved gallery build');
  assert.equal(latest.branch, 'release');
  assert.equal(latest.commit, 'd310c277fffaaec6ec7a58a87de846577f12312d', 'approved published Release commit');
  assert.equal(latest.digest, 'a5b5079cb1', 'approved published Release source');
  assert.equal(`${latest.version}.${latest.ordinal}`, '0.7.1.1517', 'approved published full version');
  assert.match(latest.commit, /^[a-f0-9]{40}$/);
  assert.match(latest.digest, /^[a-f0-9]{10}$/);
  const exactUrl = new URL(`${expected}/`, base).href;
  const exact = await fetchMetadata(new URL('build.json', exactUrl));
  for (const field of ['branch', 'ordinal', 'version', 'commit', 'digest']) assert.equal(exact[field], latest[field], `numeric/latest ${field}`);
  report.published = exact; report.exactUrl = exactUrl;
  const { chromium } = createRequire(import.meta.url)('playwright');
  owner = await launchBrowser({ prefix: 'rg-' }); browser = await chromium.connectOverCDP(owner.wsUrl);
  report.browserVersion = browser.version();
  const shots = [
    { name: 'creation', query: '?shot=customize', landmark: '.customize' },
    { name: 'map', query: '?shot=map&shotWalk=5', landmark: '.mapscreen' },
    { name: 'combat', query: '?shot=combat', landmark: '.combat' },
    { name: 'shop', query: '?shot=shop', landmark: '#shop-relics' },
    { name: 'combat-phone', query: '?shot=combat', landmark: '.combat', phone: true },
  ];
  for (const shot of shots) {
    const viewport = shot.phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 };
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: !!shot.phone });
    const page = await context.newPage();
    // The public game's ~15 MB response exceeds Chrome's default inspector
    // resource cache; retain those actual navigation bytes for the hash proof.
    const cdp = await context.newCDPSession(page);
    const completed = new Set(), failed = new Map();
    let documentRequestId;
    cdp.on('Network.responseReceived', event => {
      if (event.type === 'Document' && event.response.url === exactUrl + shot.query) documentRequestId = event.requestId;
    });
    cdp.on('Network.loadingFinished', event => completed.add(event.requestId));
    cdp.on('Network.loadingFailed', event => failed.set(event.requestId, event.errorText));
    await cdp.send('Network.enable', { maxResourceBufferSize: 64 * 1024 * 1024, maxTotalBufferSize: 128 * 1024 * 1024 });
    const row = { ...shot, viewport, deviceScaleFactor: 1, at: new Date().toISOString(), requestedUrl: exactUrl + shot.query };
    report.captures.push(row);
    page.on('pageerror', error => report.runtimeErrors.push({ shot: shot.name, message: error.message }));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ shot: shot.name, message: message.text() }); });
    page.on('response', response => { if (response.status() >= 400) report.networkFailures.push({ shot: shot.name, url: response.url(), status: response.status() }); });
    try {
      const response = await page.goto(row.requestedUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
      assert.equal(response.status(), 200, 'actual public game navigation succeeds');
      assert.equal(page.url(), row.requestedUrl, 'actual executed route remains the fixed published build');
      const bodyDeadline = Date.now() + 30000;
      while (!documentRequestId || !completed.has(documentRequestId)) {
        if (failed.has(documentRequestId)) throw Error(`navigation body failed: ${failed.get(documentRequestId)}`);
        assert.ok(Date.now() < bodyDeadline, 'actual navigation body finishes on the observed CDP session');
        await new Promise(done => setTimeout(done, 50));
      }
      const observed = await cdp.send('Network.getResponseBody', { requestId: documentRequestId });
      const bytes = Buffer.from(observed.body, observed.base64Encoded ? 'base64' : 'utf8');
      row.bodyTransport = { method: 'Network.getResponseBody', requestId: documentRequestId, sameBufferedSession: true };
      row.htmlSha256 = digest(bytes); row.htmlBytes = bytes.length;
      assert.match(exact.pageSha256, /^[a-f0-9]{64}$/, 'published pack provides its page hash');
      assert.equal(row.htmlSha256, exact.pageSha256, 'browser executes exact published page bytes');
      const html = bytes.toString('utf8');
      const stamp = name => html.match(new RegExp(`const ${name} = '([^']*)'`))?.[1];
      row.embedded = { source: stamp('SOURCE'), ordinal: Number(stamp('ORDINAL')), edition: stamp('EDITION'), runPath: stamp('RUN_PATH'), built: stamp('BUILT') };
      assert.equal(row.embedded.source, exact.digest, 'executed page source matches public metadata');
      assert.equal(row.embedded.ordinal, exact.ordinal, 'executed page ordinal matches public metadata');
      assert.equal(row.embedded.edition, exact.tier || (exact.edition === 'full' ? 'high' : exact.edition), 'executed page tier matches published edition');
      await page.locator(shot.landmark).waitFor({ state: 'visible', timeout: 90000 });
      await page.evaluate(async () => {
        await document.fonts.ready;
        const visible = element => { const b = element.getBoundingClientRect(), style = getComputedStyle(element);
          return b.width > 0 && b.height > 0 && b.bottom > 0 && b.right > 0 && b.top < innerHeight && b.left < innerWidth && style.visibility !== 'hidden' && style.display !== 'none'; };
        const images = [...document.images].filter(visible);
        await Promise.all(images.map(async img => { await img.decode(); if (!img.naturalWidth) throw Error(`visible image failed: ${img.currentSrc}`); }));
        const backgrounds = new Set();
        for (const element of document.querySelectorAll('*')) if (visible(element)) {
          for (const match of getComputedStyle(element).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) backgrounds.add(match[1]);
        }
        await Promise.all([...backgrounds].map(async url => { const image = new Image(); image.src = url; await image.decode(); }));
        for (const host of document.querySelectorAll('.alternative-card-stage')) if (visible(host) && host.__poseStage?.ready) await host.__poseStage.ready;
        await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      });
      if (shot.landmark === '.combat') {
        await page.waitForFunction(() => {
          const hosts = [...document.querySelectorAll('.combatant .sprite')];
          return hosts.length >= 2 && hosts.every(host => {
            const canvas = [...host.querySelectorAll('canvas')].find(c => c.width > 0 && c.height > 0);
            if (!canvas) return [...host.querySelectorAll('img')].some(img => img.complete && img.naturalWidth > 0);
            const sample = document.createElement('canvas'); sample.width = sample.height = 24;
            const ctx = sample.getContext('2d'); ctx.drawImage(canvas, 0, 0, 24, 24);
            return ctx.getImageData(0, 0, 24, 24).data.some((value, index) => index % 4 === 3 && value > 0);
          });
        }, null, { timeout: 45000 });
      }
      row.rendered = await page.evaluate(() => ({ title: document.title,
        bodyStamp: document.body.innerText.match(/0\.7\.1\.\d+/g) || [],
        landmarks: { customize: !!document.querySelector('.customize'), map: !!document.querySelector('.mapscreen'), combat: !!document.querySelector('.combat'), shop: !!document.querySelector('#shop-relics') },
        visibleImages: [...document.images].filter(image => { const b = image.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight; }).map(image => ({ width: image.naturalWidth, height: image.naturalHeight, complete: image.complete })),
        canvases: [...document.querySelectorAll('.combatant canvas')].map(canvas => ({ width: canvas.width, height: canvas.height })),
      }));
      row.executedUrl = page.url();
      await page.screenshot({ path: resolve(out, `${shot.name}.png`), fullPage: false });
      row.screenshotSha256 = digest(readFileSync(resolve(out, `${shot.name}.png`))); row.passed = true;
      console.log(`Captured ${shot.name}: ${row.executedUrl}`);
    } catch (error) { row.error = error.stack; throw error; }
    finally { await context.close(); }
  }
  assert.equal(report.runtimeErrors.length, 0, 'no public game runtime exceptions');
  assert.equal(report.networkFailures.filter(row => /\/(objects|packs)\/|asset-base\.json/.test(row.url)).length, 0, 'published art loads');
  report.passed = true;
} catch (error) { report.error = error.stack; process.exitCode = 1; }
finally {
  if (browser) await browser.close(); if (owner) await owner.close();
  report.finished = new Date().toISOString();
  writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
}
