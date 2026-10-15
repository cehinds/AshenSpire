// Read-only proof from the actual public Pages wrapper and its opaque game frame.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { launchBrowser } from '../browser.mjs';
import { sourceDigest } from '../buildversion.mjs';
import { freshBuild } from '../collect-feature-previews.mjs';
import { compiledRelease, isDirectInvocation } from './browser-combat.mjs';

export const HOSTED_URL = 'https://cehinds.github.io/AshenSpire/branches/feature/FullCombatAudit/latest/';
const SITE_URL = 'https://cehinds.github.io/AshenSpire/';
const BUILD_URL = new URL('build.txt', HOSTED_URL).href;
const sha256 = text => createHash('sha256').update(text).digest('hex');
const commitPattern = /^[0-9a-f]{40}$/;

export function publicPreviewIdentity(html, site) {
  const card = site.match(/<section class="card"><h3>feature\/FullCombatAudit<\/h3>([\s\S]*?)<\/section>/)?.[1];
  const commit = card?.match(/https:\/\/github\.com\/cehinds\/AshenSpire\/commit\/([0-9a-f]{40})/)?.[1];
  const source = html.match(/const SOURCE = '([0-9a-f]{10})'/)?.[1];
  const ordinal = html.match(/const ORDINAL = '(\d+)'/)?.[1];
  const release = compiledRelease(html);
  assert.ok(commitPattern.test(commit || ''), 'public branch listing identifies the preview source commit');
  assert.ok(source && ordinal && release, 'public build carries complete source/version identity');
  return { commit, source, ordinal: Number(ordinal), version: `${release}.${ordinal}`, htmlSha256: sha256(html) };
}
export async function assertCompatiblePublicBuild(identity, { expectedCommit, expectedSource, api }) {
  assert.ok(commitPattern.test(expectedCommit), 'expected checkout commit is a full SHA');
  assert.equal(identity.source, expectedSource, 'public build matches the checkout production source digest');
  assert.ok(await freshBuild(api, 'cehinds/AshenSpire', identity.commit, expectedCommit),
    'public build commit is current or differs only by documentation under the existing Pages eligibility rule');
}
async function main() {
  const out = resolve(process.env.HOSTED_PREVIEW_OUT || '_hosted-preview'); mkdirSync(out, { recursive: true });
  const expectedCommit = process.env.EXPECTED_COMMIT || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const expectedSource = sourceDigest(process.cwd()).digest;
  const report = { url: HOSTED_URL, expectedCommit, expectedSource, started: new Date().toISOString(),
    attempts: [], errors: [], checks: {}, passed: false };
  const requestedWait = Number(process.env.HOSTED_PREVIEW_WAIT_MS || 720000);
  assert.ok(Number.isFinite(requestedWait) && requestedWait >= 0 && requestedWait <= 720000, 'publication wait is bounded to twelve minutes');
  const deadline = Date.now() + requestedWait;
  const fetchText = async (url, authenticated = false) => {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000), headers: authenticated && process.env.GITHUB_TOKEN
      ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json' } : {} });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return response.text();
  };
  const api = async path => JSON.parse(await fetchText(`https://api.github.com/${path}`, true));
  let owner, browser, page;
  try {
    while (true) {
      try {
        const [html, site, wrapper] = await Promise.all([fetchText(BUILD_URL), fetchText(SITE_URL), fetchText(HOSTED_URL)]);
        assert.match(wrapper, /<iframe id="preview"/, 'public route is the actual trusted preview wrapper');
        const identity = publicPreviewIdentity(html, site);
        await assertCompatiblePublicBuild(identity, { expectedCommit, expectedSource, api });
        report.identity = identity; report.wrapperSha256 = sha256(wrapper); break;
      } catch (error) {
        report.attempts.push({ at: new Date().toISOString(), message: error.message });
        console.log(`Waiting for eligible public preview: ${error.message}`);
        if (Date.now() >= deadline) throw error;
        await new Promise(done => setTimeout(done, Math.min(30000, deadline - Date.now())));
      }
    }
    const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
    owner = await launchBrowser({ prefix: 'hp-' }); browser = await chromium.connectOverCDP(owner.wsUrl);
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
    const [fetchedBuild, response] = await Promise.all([
      page.waitForResponse(response => response.url() === BUILD_URL && response.ok(), { timeout: 45000 }),
      page.goto(HOSTED_URL, { waitUntil: 'domcontentloaded', timeout: 45000 }),
    ]);
    assert.ok(response.ok(), 'actual hosted Play route loads');
    assert.equal(sha256(await response.text()), report.wrapperSha256, 'actual Play route serves the identified public wrapper');
    assert.equal(page.url(), HOSTED_URL, 'proof remains on the fixed public Play route');
    const frameElement = page.locator('#preview'); await frameElement.waitFor();
    assert.equal(await frameElement.getAttribute('sandbox'), 'allow-scripts allow-pointer-lock allow-popups');
    const loadedBytes = await fetchedBuild.text();
    assert.equal(sha256(loadedBytes), report.identity.htmlSha256, 'the wrapper actually executes the identified public build bytes');
    const frame = page.frameLocator('#preview');
    await frame.locator('.startup-gate').waitFor({ timeout: 45000 });
    await frame.locator('.startup-gate').click();
    await frame.locator('.title-screen #quit-game').waitFor({ timeout: 30000 });
    await frame.locator('[data-component="title-wordmark"]').click();
    const stamp = await frame.locator('.build-stamp[data-place="title"]').innerText();
    assert.ok(stamp.includes(report.identity.source) && stamp.includes(report.identity.version), 'actual game stamp matches public source and full version');
    report.titleStamp = stamp;
    report.entries = await frame.locator('.title-menu > li > button').evaluateAll(buttons => buttons.map(button => ({ label: button.textContent.trim(), action: button.dataset.titleAction })));
    assert.equal(report.entries.at(-1)?.action, 'quit', 'Quit is the last primary menu entry');
    assert.ok(!report.entries.some(entry => entry.action === 'lan'), 'paused co-op entry is hidden');
    await frame.locator('#quit-game').scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(out, 'public-menu.png') });
    await frame.locator('#quit-game').click();
    await frame.locator('#farewell-status').filter({ hasText: 'browser kept this window open' }).waitFor();
    report.quitFallback = await frame.locator('#farewell-status').innerText();
    await page.screenshot({ path: resolve(out, 'public-quit.png') });
    await frame.locator('#farewell-back').click(); await frame.locator('.startup-gate').waitFor();
    await frame.locator('.startup-gate').click(); await frame.locator('.title-screen #quit-game').waitFor();
    await page.screenshot({ path: resolve(out, 'public-return-title.png') });
    assert.deepEqual(report.errors, [], 'public wrapper and actual game have zero runtime page errors');
    report.checks = { publicWrapper: true, sourceIdentity: true, quitLast: true, coopHidden: true, blockedCloseObservable: true, returnedToTitle: true };
    report.passed = true;
  } catch (error) {
    report.failure = { name: error.name, message: error.message }; throw error;
  } finally {
    report.finished = new Date().toISOString(); writeFileSync(resolve(out, 'public-proof.json'), JSON.stringify(report, null, 2) + '\n');
    if (page && !report.passed) await page.screenshot({ path: resolve(out, 'public-failure.png') }).catch(() => {});
    try { await browser?.close(); } finally { await owner?.close(); }
  }
  console.log(`Hosted preview proof passed: ${HOSTED_URL} · ${report.identity.version} · src ${report.identity.source}`);
}
if (isDirectInvocation(process.argv[1], import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
