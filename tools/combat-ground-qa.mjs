import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.env.COMBAT_QA_URL || 'http://localhost:8210/AshenSpire.html';
const out = resolve(process.env.COMBAT_QA_OUT || 'docs/preview/combat-ground');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [], results = [], shots = [];
const regions = ['ashen-crown', 'hollow-weald', 'pale-marches', 'cinder-reach', 'drowned-coast'];
async function settle(page) {
  await page.waitForFunction(() => {
    const field = document.querySelector('.field');
    return Number(field?.dataset.groundY) > 0 && [...document.querySelectorAll('.enemy-pose-idle,.painted-stage .pose-frame:not(.pose-previous)')].every(i => i.complete && i.naturalWidth);
  });
  await page.waitForTimeout(500);
  await page.waitForFunction(() => {
    const field = document.querySelector('.field')?.getBoundingClientRect();
    const art = document.querySelector('.environment-backdrop')?.getBoundingClientRect();
    const feet = [...document.querySelectorAll('.combatant[data-formation-row="0"] .sprite')].map(s => s.getBoundingClientRect().bottom);
    return field && art && feet.length && Math.abs(field.height - art.height) < 1 && Math.max(...feet) - Math.min(...feet) < 1;
  }, null, { timeout: 8000 });
}
async function check(page) {
  const result = await page.evaluate(() => {
    const field = document.querySelector('.field').getBoundingClientRect();
    const backdrop = document.querySelector('.environment-backdrop');
    const art = backdrop.getBoundingClientRect();
    const floorSvg = backdrop.querySelector('.environment-floor');
    const box = floorSvg.viewBox.baseVal, matrix = floorSvg.getScreenCTM();
    // SVG getBoundingClientRect includes its unclipped atlas image. Project
    // the actual viewport's corners instead of measuring that hidden overflow.
    const top = new DOMPoint(box.x, box.y).matrixTransform(matrix).y;
    const bottom = new DOMPoint(box.x, box.y + box.height).matrixTransform(matrix).y;
    const floor = { top, bottom, height: bottom - top };
    const sprites = [...document.querySelectorAll('.combatant .sprite')];
    const feet = sprites.filter(s => s.closest('.combatant').dataset.formationRow === '0').map(s => s.getBoundingClientRect().bottom);
    const images = [...document.querySelectorAll('.enemy-pose-idle,.painted-stage .pose-frame')].filter(i => getComputedStyle(i).display !== 'none' && i.closest('.combatant').dataset.formationRow === '0');
    const anchors = images.map(i => {
      const r = i.getBoundingClientRect();
      return r.top + r.height * (i.classList.contains('enemy-pose-idle') ? 364 / 384 : 600 / 640);
    });
    const groundFront = backdrop.querySelector('.environment-ground-front');
    const groundBox = groundFront.viewBox.baseVal;
    const paintedGroundY = new DOMPoint(groundBox.x, groundBox.y).matrixTransform(groundFront.getScreenCTM()).y;
    return {
      scene: backdrop.dataset.scene, viewport: `${innerWidth}x${innerHeight}`,
      floorRatio: floor.height / art.height,
      feetSpread: Math.max(...feet) - Math.min(...feet),
      anchorSpread: Math.max(...anchors) - Math.min(...anchors),
      paintedGroundError: Math.max(...feet.map(y => Math.abs(y - paintedGroundY))),
      feetOnGround: feet.every(y => y >= floor.top && y <= floor.bottom),
      topClear: sprites.every(s => s.getBoundingClientRect().top >= field.top - 1),
      metersClear: [...document.querySelectorAll('.combatant .meters')].every(m => m.getBoundingClientRect().bottom <= field.bottom + 1),
      outlined: images.every(i => getComputedStyle(i).filter.includes('drop-shadow')),
      artFits: Math.abs(art.width - field.width) < 1 && Math.abs(art.height - field.height) < 1,
      noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth,
      embedded: [...backdrop.querySelectorAll('image')].every(i => i.getAttribute('href').startsWith('data:')),
    };
  });
  if (Math.abs(result.floorRatio - .6) > .002 || result.feetSpread > 1 || result.anchorSpread > 2 || result.paintedGroundError > 1 ||
    !result.feetOnGround || !result.topClear || !result.metersClear || !result.outlined || !result.artFits || !result.noHorizontalOverflow ||
    (base.includes('AshenSpire.html') && !result.embedded)) throw Error(JSON.stringify(result));
  results.push(result);
}
async function scene(page, region, floor) {
  // Select the painting at combat mount, where normal encounters select it.
  await page.goto(`${base}?shot=combat&shotScene=${region}-${floor + 1}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.locator('.enemy-pose-idle').first().waitFor();
  await settle(page);
  const actual = await page.locator('.environment-backdrop').getAttribute('data-scene');
  if (actual !== `${region}-${floor + 1}`) throw Error(`Wrong preview scene: ${actual}`);
}
async function shot(page, name, fieldOnly = false) {
  const file = `${name}.png`;
  await (fieldOnly ? page.locator('.field') : page).screenshot({ path: resolve(out, file) });
  shots.push(file);
}
try {
  const runs = await Promise.allSettled([{ width: 1440, height: 1080 }, { width: 794, height: 893 }, { width: 390, height: 844 }, { width: 844, height: 390 }].map(async size => {
    const page = await browser.newPage({ viewport: size });
    page.setDefaultTimeout(60000);
    page.on('pageerror', e => errors.push(e.message));
    for (const region of regions) for (let floor = 0; floor < 4; floor++) {
      await scene(page, region, floor);
      await check(page);
      const id = `${region}-${floor + 1}`;
      if (size.width === 1440) await shot(page, id, true);
      if (id === 'cinder-reach-4' || (size.width === 390 && id === 'pale-marches-4')) await shot(page, `${id}-${size.width}`);
    }
    console.log(`PASS: 20 distinct scenes at ${size.width}x${size.height}`);
    if (size.width === 794) {
      await scene(page, 'cinder-reach', 0);
      for (let turn = 0; turn < 2; turn++) {
        const before = await page.evaluate(() => window.__combat.turn);
        const button = page.locator('.end-turn');
        await button.hover();
        await page.mouse.down();
        await page.waitForTimeout(1800);
        await page.mouse.up();
        await page.waitForFunction(before => window.__combat.turn > before, before);
        await page.waitForTimeout(7000);
        await settle(page);
        await check(page);
      }
      await shot(page, 'basalt-after-enemy-turns');
    }
    if (size.width === 844) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 390, height: 844 });
      await settle(page);
      await check(page);
    }
    await page.close();
  }));
  for (const run of runs) if (run.status === 'rejected') throw run.reason;
  if (errors.length) throw Error(errors.join('\n'));
  if (new Set(results.map(r => r.scene)).size !== 20) throw Error('Did not visit all twenty scenes');
  writeFileSync(resolve(out, 'checks.json'), JSON.stringify({ base, results, errors }, null, 2));
  writeFileSync(resolve(out, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Combat ground review</title><style>body{background:#17130f;color:#e7d7b5;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}img{width:100%;height:auto}figure{margin:0}a{color:#e7c269}</style><h1>Combat ground review</h1><p>20 paintings, 60% clear ground, shared foot anchors and contrasting silhouette edges. Screenshots from the actual combat renderer in memory-isolated preview runs.</p><main>${shots.map(s => `<figure><a href="${s}"><img src="${s}" loading="lazy"></a><figcaption>${s.replace('.png', '')}</figcaption></figure>`).join('')}</main>`);
  console.log(`PASS: ${results.length} scene/layout checks; ${shots.length} screenshots; no page errors.`);
} finally { await browser.close(); }
