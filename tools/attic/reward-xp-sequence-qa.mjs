// Real-browser reward presentation probe using the production mount and styles.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { serve } from './serve.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = resolve(process.env.REWARD_XP_QA_OUT || process.env.TEMP || '.', 'xp-sequence');
mkdirSync(output, { recursive: true });
const server = await serve({ root: process.cwd(), port: 0, open: false });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
const results = [];
try {
  for (const phone of [false, true]) {
    const context = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, hasTouch: phone, isMobile: phone });
    const page = await context.newPage();
    const errors = [], failures = [], expectedAudioFallbacks = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => failures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
    page.on('response', response => {
      if (response.status() < 400) return;
      const detail = `${response.status()} ${response.url()}`;
      // Source mode probes for optional recordings then uses authored synth
      // recipes. Record these existing 404s explicitly; other errors fail QA.
      if (response.status() === 404 && /\/assets\/sfx\/(rewardTake_levelChoice|victory)\.ogg$/.test(response.url())) expectedAudioFallbacks.push(detail);
      else failures.push(detail);
    });
    await page.goto(`http://localhost:${server.server.address().port}/index.html?shot=reward`);
    await page.locator('.reward-kind[data-kind="card"]').waitFor();
    await page.evaluate(async () => {
      const { mountRewards } = await import('/src/ui/screens/reward.js');
      const { contentBundle } = await import('/src/content/index.js');
      const { createRegistries } = await import('/src/model/registries.js');
      const { claimBankedLevel } = await import('/src/model/levelup.js');
      const { claimBankedSkillLevel } = await import('/src/model/skills.js');
      const { balance } = contentBundle;
      const curve = xp => ({ ...xp, base: 100, growth: 1.75 });
      const registries = createRegistries({ ...contentBundle, balance: { ...balance, level: { ...balance.level, xp: curve(balance.level.xp) }, skill: { ...balance.skill, xp: curve(balance.skill.xp), class: { ...balance.skill.class, xp: curve(balance.skill.class.xp) } } } });
      const run = { class: 'reaver', cinders: 0, deck: [], flasks: [], relics: [], coreTags: [], loadout: { storage: [] }, level: { level: 1, xp: 355, unspentPoints: 0 },
        skills: { 'class:reaver': { level: 0, xp: 355, pendingDrafts: 0 }, 'item:blade': { level: 2, xp: 380, pendingDrafts: 0 }, 'armour:heavy': { level: 1, xp: 70, pendingDrafts: 0 }, 'item:shield': { level: 9, xp: 50, pendingDrafts: 0 } } };
      const rewards = { title: 'XP SEQUENCE', xpGains: { level: 355, tracks: { 'class:reaver': 355, 'item:blade': 100, 'armour:heavy': 60 } },
        xpBefore: { character: { level: 1, xp: 0 }, tracks: { 'class:reaver': { level: 0, xp: 0 }, 'item:blade': { level: 2, xp: 280 }, 'armour:heavy': { level: 1, xp: 10 } } },
        levelChoices: [{ ordinal: 0, requiredLevel: 2, options: [{ kind: 'feat', id: 'fieldStudy' }, { kind: 'feat', id: 'weaponDrill' }] }] };
      const checkpoint = { rewards, states: {}, expanded: true };
      const settings = { victoryXpSeconds: .5, levelUpRefillSeconds: .08, levelUpRefillPauseMs: 0, optionDecision: { rewardContinue: 'instant' } };
      const options = { registries, run, rewards, checkpoint, saves: { loadMeta: () => ({ settings }) }, onDone() { window.rewardXpQA.done++; }, onPersist() { window.rewardXpQA.saved = JSON.stringify({ run, checkpoint }); }, onClaimLevel: () => claimBankedLevel(registries, run), onClaimSkill: id => claimBankedSkillLevel(registries, run, id) };
      window.rewardXpQA = { run, rewards, checkpoint, settings, options, done: 0, mount: mountRewards };
      mountRewards(document.querySelector('#app'), options);
    });
    check(await page.locator('#reward-continue').isDisabled(), 'Continue waits for all fills');
    check(await page.locator('.reward-level-up').count() === 0, 'no early claim buttons');
    check(JSON.stringify(await page.locator('.reward-progress-row').evaluateAll(rows => rows.map(row => row.dataset.track))) === JSON.stringify(['class:reaver', 'character', 'item:blade', 'armour:heavy']), 'gained-only Class/Character/current-skill order');
    await page.waitForFunction(() => document.querySelector('.rp-layered-bar[data-track="class:reaver"]').classList.contains('rp-bar-ready'));
    check(await page.locator('.reward-level-up').count() === 0, 'full first bar remains informational');
    await page.screenshot({ path: resolve(output, `${phone ? 'phone' : 'desktop'}-filling.png`) });
    await page.waitForFunction(() => !document.querySelector('#reward-continue').disabled);
    check(await page.locator('.reward-level-up').count() === 3, 'all ready buttons appear together');
    check(await page.locator('#reward-continue').getAttribute('data-confirm-ready') === 'true', 'Continue has ready green styling');
    await page.waitForTimeout(550); // Let the shared ready-color transition settle.
    check(await page.locator('#reward-continue').evaluate(button => getComputedStyle(button).backgroundColor === getComputedStyle(document.documentElement).getPropertyValue('--control-positive-fill').trim()
      || getComputedStyle(button).backgroundColor === 'rgb(37, 92, 57)'), 'Continue is visibly green after fills');
    await page.screenshot({ path: resolve(output, `${phone ? 'phone' : 'desktop'}-ready.png`) });
    const speeds = await page.locator('.rp-layered-bar').evaluateAll(bars => bars.map(bar => ({ id: bar.dataset.track, from: +bar.dataset.old, to: +bar.dataset.target })));
    // Claim a later row first, then confirm it did not spend another track.
    await page.locator('.reward-level-up[data-track="item:blade"]').click();
    check(await page.evaluate(() => window.rewardXpQA.run.level.xp === 355 && window.rewardXpQA.run.skills['class:reaver'].xp === 355), 'later skill claims only its own ledger');
    await page.locator('#reward-level-continue').click();
    await page.waitForFunction(() => !document.querySelector('#reward-continue').disabled);
    await page.locator('.reward-level-up[data-track="character"]').click();
    await page.locator('.reward-kind[data-key="levelChoice:0"]').click();
    await page.locator('.reward-row .reward-pick').first().click();
    await page.locator('#reward-back').click();
    check(await page.locator('#reward-level-continue').count() === 1, 'chooser Back returns to the claim popup');
    await page.locator('.reward-kind[data-key="levelChoice:0"]').click();
    await page.locator('#reward-card-confirm').click();
    check(await page.evaluate(() => window.rewardXpQA.run.feats?.length === 1), 'confirmation collects one choice');
    await page.locator('#reward-level-continue').click();
    await page.waitForFunction(() => !document.querySelector('#reward-continue').disabled);
    check(await page.evaluate(() => window.rewardXpQA.run.level.xp === 255), 'surplus survives first claim and chooser');
    await page.locator('.reward-level-up[data-track="character"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('#reward-level-continue').waitFor();
    await page.locator('#reward-level-continue').click();
    await page.waitForFunction(() => !document.querySelector('#reward-continue').disabled);
    check(await page.evaluate(() => window.rewardXpQA.run.level.xp === 75 && window.rewardXpQA.run.level.level === 3), 'keyboard repeat claim spends exactly its threshold');
    await page.evaluate(() => {
      const q = window.rewardXpQA;
      document.body.classList.add('reduced-motion');
      const saved = JSON.parse(q.saved);
      q.options.run = q.run = saved.run;
      q.options.checkpoint = q.checkpoint = saved.checkpoint;
      q.options.rewards = q.rewards = saved.checkpoint.rewards;
      q.mount(document.querySelector('#app'), q.options);
    });
    check(await page.locator('#reward-continue').isEnabled(), 'reload with reduced motion settles immediately');
    check(await page.evaluate(() => window.rewardXpQA.run.level.xp === 75), 'remount does not re-award XP');
    await page.screenshot({ path: resolve(output, `${phone ? 'phone' : 'desktop'}-residual.png`) });
    check(errors.length === 0, `no page errors: ${errors.join('; ')}`);
    check(failures.length === 0, `no failed requests: ${failures.join('; ')}`);
    results.push({ viewport: phone ? 'phone' : 'desktop', checks, speeds, errors, failedRequests: failures, expectedAudioFallbacks });
    await context.close();
  }
  writeFileSync(resolve(output, 'result.json'), JSON.stringify({ checks, results }, null, 2));
  console.log(`PASS ${checks} XP sequence browser checks; screenshots: ${output}`);
} finally { await browser.close(); server.server.close(); }
