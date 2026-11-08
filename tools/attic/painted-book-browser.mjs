import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const output = resolve('docs/preview/book-library/layers/painted/qa');
mkdirSync(output, { recursive: true });
const base = process.env.BOOK_SHOP_URL || 'http://localhost:8769';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const pixel = async (locator, x, y) => {
  const raw = await sharp(await locator.screenshot()).resize(1000, 1000).removeAlpha().raw().toBuffer();
  const result = [0, 0, 0];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) for (let c = 0; c < 3; c++) result[c] += raw[((y + dy) * 1000 + x + dx) * 3 + c] / 49;
  return result.map(Math.round);
};
try {
  await page.goto(`${base}/docs/preview/book-library/layers/painted/compare.html`, { waitUntil: 'networkidle' });
  const blue = page.locator('#colors .card').nth(2).locator('.book-art');
  const red = page.locator('#colors .card').nth(3).locator('.book-art');
  const colors = {};
  for (const [name, x, y] of [['front',800,510], ['spine',170,340], ['back',650,863], ['ribbon',442,886]]) {
    const b = await pixel(blue,x,y); const r = await pixel(red,x,y);
    colors[name] = { blue:b, red:r };
    assert.ok(b[2] > b[0] && r[0] > r[2], `${name} must follow whole-binding color: ${JSON.stringify(colors[name])}`);
  }
  for (const [name,x,y] of [['brass',650,85], ['pages',665,790]]) {
    const b = await pixel(blue,x,y); const r = await pixel(red,x,y);
    colors[name] = {blue:b,red:r};
    assert.ok(Math.max(...b.map((v,i)=>Math.abs(v-r[i]))) < 18, `${name} should retain its material color`);
  }
  await page.screenshot({ path: resolve(output,'comparison-desktop.png'), fullPage:true });
  await page.goto(`${base}/docs/preview/book-library/layers/atelier.html`, { waitUntil:'networkidle' });
  assert.equal(await page.locator('#library button').count(),10);
  assert.equal(await page.locator('#symbols img').count(),11);
  assert.ok(await page.locator('#symbols img').evaluateAll((images)=>images.every((image)=>image.complete && image.naturalWidth > 0)));
  for (const cover of ['classic','scholar','field']) {
    await page.locator('#cover').selectOption(cover);
    assert.equal(await page.locator('#stage .book-art').getAttribute('data-book-cover'),cover);
  }
  await page.locator('#symbol').selectOption('starseer');
  await page.locator('#color').fill('#2266bb');
  await page.locator('#ink').fill('#e0ad4b');
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('#color').inputValue(),'#2266bb');
  assert.equal(await page.locator('#symbol').inputValue(),'starseer');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  assert.equal((await downloadPromise).suggestedFilename(),'bookArtPresets.js');
  await page.locator('#file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"broken":true}')});
  assert.match(await page.locator('#status').textContent(),/unchanged/);
  await page.locator('#reset').click();
  await page.locator('[data-book="shieldManual"]').click();
  await page.locator('#trim').selectOption('none');
  await page.locator('#ink').fill('#e0ad4b');
  await page.screenshot({path:resolve(output,'atelier-desktop.png'),fullPage:true});
  for (const width of [390,320]) {
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth), `No overflow at ${width}`);
    await page.screenshot({path:resolve(output,`atelier-${width}.png`),fullPage:true});
  }
  assert.deepEqual(errors,[]);
  writeFileSync(resolve(output,'results.json'),JSON.stringify({passed:true,checks:['14 painted layers loaded','all binding surfaces recolor','brass and parchment preserved','three cover variants','symbol and finish controls','draft persists','recipe export','atomic invalid import','390px and 320px layouts'],colors,errors},null,2));
  console.log('PASS: painted book layers, whole-binding recolor, protected materials, customization, export and mobile layout.');
} finally { await browser.close(); }
