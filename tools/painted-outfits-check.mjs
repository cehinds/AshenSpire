// Browser integration check. Start tools/serve.mjs on port 4277 first.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4277';
const out = 'art/painted-combat-2026-09-07/inspection';
mkdirSync(out, { recursive: true });
try {
  await page.goto(base + '/?shot=customize&shotClass=reaver');
  await page.locator('.cc-class-art .painted-presentation').waitFor();
  const report = await page.evaluate(async () => {
    const { PAINTED_OUTFITS } = await import('/src/content/paintedOutfits.js');
    const { createPaintedStage, paintedPresentation } = await import('/src/ui/paintedOutfits.js');
    const { playerSprite } = await import('/src/ui/assets.js');
    const assert = (value, message) => { if (!value) throw Error(message); };
    let decoded = 0;
    for (const id of Object.keys(PAINTED_OUTFITS)) {
      const [cls, armour = 'default'] = id.split('-');
      const host = playerSprite({ spriteStyle: 'animated' }, cls, armour);
      assert(host.querySelector('.painted-stage')?.dataset.poseClass === id, id + ' equipped routing');
      const stage = createPaintedStage(cls, armour);
      for (const pose of stage.poses) {
        assert(stage.setPose(pose), id + '/' + pose);
        await stage.el.querySelector('img').decode(); decoded++;
      }
      for (const pose of ['stand', 'detail', 'portrait']) {
        await paintedPresentation(cls, armour, pose).decode(); decoded++;
      }
      stage.settle();
      assert(stage.pose === 'idle', id + ' settle');
    }
    const stage = createPaintedStage('reaver', 'oathsworn');
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    stage.play('attack', 1000);
    assert(stage.pose === 'attack1', 'attack starts with low advance');
    await sleep(350); assert(stage.pose === 'attack2', 'overhead phase');
    await sleep(280); assert(stage.pose === 'attack3', 'cleave phase');
    await sleep(250); assert(stage.pose === 'attack4', 'recovery phase');
    await sleep(180); assert(stage.pose === 'idle', 'attack returns idle');
    stage.play('guard', 100); assert(!stage.play('missing'), 'unknown pose rejected');
    await sleep(150); assert(stage.pose === 'idle', 'invalid pose preserves settle');
    stage.play('attack', 1000); stage.play('hit', 80);
    await sleep(400); assert(stage.pose === 'idle', 'hit cancels outstanding attack timers');
    document.body.classList.add('reduced-motion');
    assert(!stage.play('attack') && stage.pose === 'idle', 'reduced motion');
    document.body.classList.remove('reduced-motion');
    assert(!playerSprite({ spriteStyle: 'classic' }, 'reaver').querySelector('.painted-stage'), 'classic retained');
    assert(!playerSprite({ spriteStyle: 'glyph' }, 'reaver').querySelector('.painted-stage'), 'sigil retained');
    return { outfits: Object.keys(PAINTED_OUTFITS).length, imagesDecoded: decoded, playback: 'passed' };
  });
  for (const cls of ['reaver', 'rogue', 'starseer', 'herald']) {
    await page.locator(`.class-pick[data-class="${cls}"]`).click();
    await page.locator('.cc-class-art img').evaluate(img => img.decode());
    const src = await page.locator('.cc-class-art img').getAttribute('src');
    if (!src.includes(`/painted-outfits/${cls}/portrait.webp`)) throw Error(cls + ' selection portrait');
  }
  await page.locator('.class-pick[data-class="reaver"]').click();
  await page.screenshot({ path: `${out}/game-customize.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${out}/game-customize-phone.png` });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('creation phone overflow');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/?shot=combat');
  await page.locator('.painted-stage').waitFor();
  await page.screenshot({ path: `${out}/game-combat.png` });
  await page.getByRole('button', { name: 'Armoury', exact: true }).click();
  await page.locator('.painted-armoury img').evaluate(img => img.decode());
  const contained = await page.locator('.painted-armoury').evaluate(el => {
    const box = el.closest('.armoury-sprite-pane').getBoundingClientRect();
    const figure = el.getBoundingClientRect();
    return figure.top >= box.top && figure.bottom <= box.bottom && figure.left >= box.left && figure.right <= box.right;
  });
  if (!contained) throw Error('armory figure escapes its preview');
  await page.screenshot({ path: `${out}/game-armory.png` });
  await page.goto(base + '/AshenSpire.html?shot=customize&shotClass=reaver');
  await page.locator('.cc-class-art img').waitFor();
  await page.locator('.cc-class-art img').evaluate(img => img.decode());
  if (!(await page.locator('.cc-class-art img').getAttribute('src')).startsWith('data:image/webp')) throw Error('standalone portrait not embedded');
  if (errors.length) throw Error(errors.join('\n'));
  writeFileSync(`${out}/game-checks.json`, JSON.stringify({ ...report, standalonePortrait: 'decoded', pageErrors: errors }, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
