// Real-browser check of the intent amount and the hit-% badge (owner 2026-10-18), phone and desktop:
//   - each enemy's intent amount sits left of its icon, vertically centred with it, at about 2x (22px titleM);
//   - the badge is centred on the target's painted body, white, outlined, 2x, and takes no tap.
// Run: node tests/intent-badge-ui.browser.mjs   (PLAYWRIGHT_MODULE / BASE_URL / CHROME override the defaults)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { serve } from '../tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.BASE_URL ? null : await serve({ root: process.cwd(), port: 0, open: false, quiet: true });
const base = `${(process.env.BASE_URL || server.url).replace(/\/$/, '')}/`;
const browser = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}), args: ['--no-sandbox'] });
const settings = encodeURIComponent(JSON.stringify({ oneTapPlay: false }));
const errors = [];
try {
  for (const [width, height] of [[390, 844], [1440, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 500 });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}index.html?shot=combat&gameProfile=core&shotSettings=${settings}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__combat);
    await page.waitForTimeout(800);
    console.log(`intent + badge: ${width}x${height}`);
    // 1. The amount is left of the icon on the same row.
    const rows = await page.locator('.combatant.enemy .intent-action').evaluateAll((nodes) => nodes.map((node) => {
      const value = node.querySelector('.intent-action-value')?.getBoundingClientRect(), icon = node.querySelector('.intent-icon')?.getBoundingClientRect();
      return value && icon ? { vRight: value.right, iLeft: icon.left, vMid: (value.top + value.bottom) / 2, iMid: (icon.top + icon.bottom) / 2,
        font: parseFloat(getComputedStyle(node.querySelector('.intent-action-value')).fontSize), zoom: node.getBoundingClientRect().width / node.offsetWidth || 1 } : null;
    }).filter(Boolean));
    assert.ok(rows.length >= 1, 'an enemy shows an intent amount');
    for (const row of rows) {
      assert.ok(row.vRight <= row.iLeft + 1, `amount ends left of the icon: ${JSON.stringify(row)}`);
      assert.ok(Math.abs(row.vMid - row.iMid) <= 4, `amount is centred with the icon: ${JSON.stringify(row)}`);
      assert.ok(row.font >= 18, `amount is about 2x the old 11px: ${row.font}`);
    }
    // The amounts never cross a neighbour's.
    const boxes = await page.locator('.combatant.enemy .intent').evaluateAll((nodes) => nodes.map((n) => { const b = n.getBoundingClientRect(); return [b.left, b.right]; }).sort((a, b) => a[0] - b[0]));
    for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i][0] >= boxes[i - 1][1] - 1, 'neighbouring intents do not overlap');
    // 2. Select an attack: the badge sits on the body's centre.
    const card = page.locator('.hand .card', { hasText: 'Strike' }).first();
    const lane = await card.locator('.hand-hit-lane').boundingBox();
    await page.mouse.click(lane.x + lane.width / 2, lane.y + lane.height * 0.42);
    await page.waitForSelector('.combatant.enemy .combat-hit-chance');
    await page.waitForTimeout(500);
    const badges = await page.locator('.combatant.enemy').evaluateAll(async (frames) => {
      const { currentSpriteBodyBounds } = await import('/src/ui/components/combatSpriteGeometry.js');
      return frames.map((frame) => {
        const badge = frame.querySelector(':scope > .combat-hit-chance');
        if (!badge) return null;
        const body = currentSpriteBodyBounds(frame.querySelector('.sprite')), box = badge.getBoundingClientRect(), style = getComputedStyle(badge);
        const top = Number.isFinite(body.headY) ? body.headY : body.top, bottom = Number.isFinite(body.feetY) ? body.feetY : body.bottom;
        return { dx: (box.left + box.right) / 2 - (body.left + body.right) / 2, dy: (box.top + box.bottom) / 2 - (top + bottom) / 2,
          color: style.color, shadow: style.textShadow, pointer: style.pointerEvents, font: parseFloat(style.fontSize), position: style.position };
      }).filter(Boolean);
    });
    assert.ok(badges.length >= 1, 'a valid target shows the badge');
    for (const badge of badges) {
      assert.ok(Math.abs(badge.dx) <= 4, `badge is horizontally centred on the body: ${badge.dx}`);
      assert.ok(Math.abs(badge.dy) <= 6, `badge is vertically centred on the body: ${badge.dy}`);
      assert.equal(badge.color, 'rgb(255, 255, 255)');
      assert.match(badge.shadow, /rgb\(0, 0, 0\)/, 'black outline');
      assert.equal(badge.pointer, 'none');
      assert.equal(badge.position, 'absolute');
      assert.ok(badge.font >= 20, `badge is about 2x: ${badge.font}`);
    }
    // A tap through the badge reaches the enemy underneath it.
    const centre = await page.locator('.combatant.enemy .combat-hit-chance').first().boundingBox();
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.combat-hit-chance') != null, { x: centre.x + centre.width / 2, y: centre.y + centre.height / 2 });
    assert.equal(hit, false, 'elementFromPoint skips the badge');
    await page.close();
  }
  // Classic appearance with Reduced motion: the first selection's badge is centred on the body, not the frame.
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
    page.on('pageerror', (error) => errors.push(error.message));
    const classic = encodeURIComponent(JSON.stringify({ oneTapPlay: false, classicAppearance: true }));
    await page.goto(`${base}index.html?shot=combat&gameProfile=core&shotSettings=${classic}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__combat);
    await page.waitForTimeout(800);
    const lane = await page.locator('.hand .card', { hasText: 'Strike' }).first().locator('.hand-hit-lane').boundingBox();
    await page.mouse.click(lane.x + lane.width / 2, lane.y + lane.height * 0.42);
    await page.waitForSelector('.combatant.enemy .combat-hit-chance');
    await page.waitForTimeout(300);
    const off = await page.locator('.combatant.enemy').evaluateAll((frames) => frames.map((frame) => {
      const badge = frame.querySelector(':scope > .combat-hit-chance');
      return badge ? { set: frame.style.getPropertyValue('--combat-body-center-y') !== '' } : null;
    }).filter(Boolean));
    assert.ok(off.length >= 1 && off.every((row) => row.set), 'classic + reduced motion: badge has its body centre at once');
    await page.close();
  }
  assert.deepEqual(errors, [], 'no page errors');
  console.log('intent + badge: ok');
} finally { await browser.close(); server?.close?.(); }
process.exit(0);
