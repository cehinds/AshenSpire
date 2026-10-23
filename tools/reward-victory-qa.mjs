// Production reward renderers with a deterministic mixed offer and paid XP fixture.
// Boots the actual configured reward route before mounting the fixtures.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { serve } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
const { chromium } = createRequire(import.meta.url)(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright`);
const output = process.env.REWARD_VICTORY_OUT || '/tmp/reward-victory';
mkdirSync(output, { recursive: true });
const serving = await serve({ root: process.cwd(), port: 0, open: false, quiet: true, host: '127.0.0.1' });
const launched = await launchBrowser({ browser: process.env.CHROME || '/usr/bin/chromium', prefix: 'reward-victory-' });
const records = [];
let browser;
try {
  browser = await chromium.connectOverCDP(launched.wsUrl);
  for (const [width, height] of [[390, 844], [1440, 900], [1920, 1080], [768, 1024]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.goto(`http://127.0.0.1:${serving.port}/index.html?shot=reward&shotReward=configured`);
    await page.locator('.reward-choice-option').first().waitFor({ timeout: 90000 });
    await page.evaluate(async () => {
      const [{ mountGameProfileOffers }, { contentBundle }, { createRegistries }, profileModel, { createRunState }] = await Promise.all([
        import('/src/ui/components/gameProfileOffers.js'), import('/src/content/index.js'), import('/src/model/registries.js'),
        import('/src/model/gameProfile.js'), import('/src/model/state.js'),
      ]);
      const profile = profileModel.resolveGameProfile('core');
      const registries = profileModel.bindGameProfileRegistries(createRegistries(profileModel.applyGameProfileToContent(contentBundle, profile)), profile);
      const run = createRunState({ registries, classId: 'reaver', seed: 3 });
      window.rewardFixture = { registries, run, continued: 0 };
      mountGameProfileOffers(document.querySelector('#app'), { registries, run,
        offer: { id: 'mixed', options: [{ kind: 'combatCards', id: 'core.evade' }, { kind: 'combatCards', id: 'core.sweep' }, { kind: 'potions', id: 'crimsonFlask' }], taken: [], claimed: null, takeCount: 1 },
        title: 'Victory rewards', onTake() {}, onContinue() {},
      });
    });
    await page.waitForTimeout(500);
    const geometry = await page.locator('.reward-choice-option').evaluateAll(nodes => nodes.map(node => ({
      face: node.firstElementChild.getBoundingClientRect().toJSON(), button: node.lastElementChild.getBoundingClientRect().toJSON(),
      frame: node.querySelector('.epc-frame')?.getBoundingClientRect().toJSON(),
      labelFits: node.lastElementChild.scrollHeight <= node.lastElementChild.clientHeight + 1,
    })));
    for (const item of geometry) {
      assert.ok(Math.abs(item.face.width - geometry[0].face.width) < 1);
      assert.ok(Math.abs(item.face.height - geometry[0].face.height) < 1);
      assert.ok(Math.abs(item.button.height - geometry[0].button.height) < 1);
      assert.ok(item.labelFits);
      if (item.frame) assert.ok(Math.abs(item.frame.height - item.face.height) < 1);
    }
    await page.screenshot({ path: `${output}/${width}-offers.png`, fullPage: true });
    await page.evaluate(async () => {
      const { mountRewards } = await import('/src/ui/screens/reward.js');
      const { registries, run } = window.rewardFixture;
      run.skills = { 'class:reaver': { level: 0, xp: 3 }, 'item:blade': { level: 0, xp: 2 } };
      mountRewards(document.querySelector('#app'), { registries, run, receiptOnly: true,
        rewards: { title: 'Victory', xpGains: { level: 0, tracks: { 'class:reaver': 3, 'item:blade': 2 } }, xpBefore: { tracks: { 'class:reaver': { level: 0, xp: 0 }, 'item:blade': { level: 0, xp: 0 } } } },
        onDone() { window.rewardFixture.continued++; },
      });
    });
    await page.waitForFunction(() => !document.querySelector('#reward-continue').disabled);
    const continueButton = page.locator('#reward-continue');
    assert.equal(await continueButton.getAttribute('data-beat-action'), 'rewardContinue');
    assert.equal(await continueButton.getAttribute('data-hold-ms'), '600');
    assert.equal(await page.locator('.reward-progress-row').count(), 2);
    assert.equal(await page.locator('[data-track="character"]').count(), 0);
    await page.screenshot({ path: `${output}/${width}-victory.png`, fullPage: true });
    await continueButton.click();
    await page.locator('.confirmation-confirm').waitFor();
    assert.equal(await page.evaluate(() => window.rewardFixture.continued), 0, 'short press reviews');
    if (width === 390) {
      await page.locator('.confirmation-cancel').click();
      const box = await continueButton.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(700);
      await page.mouse.up();
    } else await page.locator('.confirmation-confirm').click();
    assert.equal(await page.evaluate(() => window.rewardFixture.continued), 1);
    await continueButton.click();
    await page.locator('.confirmation-confirm').click();
    assert.equal(await page.evaluate(() => window.rewardFixture.continued), 1, 'repeat confirmation cannot advance twice');
    records.push({ width, height, geometry, fixture: 'production renderers, staged paid receipt; not a completed fight' });
    await page.close();
  }
  writeFileSync(`${output}/results.json`, JSON.stringify(records, null, 2));
  console.log(`Reward dimensions and Victory Continue passed ${records.length} viewports; ${output}`);
} finally {
  await browser?.close();
  await launched.close();
  await new Promise(resolve => serving.server.close(resolve));
}
