// Verify real rendered header geometry and health after an authored enemy turn.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.env.COMBAT_QA_OUT || '.codex/combat-header';
mkdirSync(out, { recursive: true });
const results = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const [width, height] of [[288, 513], [320, 568], [390, 844], [844, 390], [1280, 800]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
    const row = { width, height, errors: [] }; results.push(row);
    page.on('pageerror', error => row.errors.push(error.message));
    const save = () => writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
    const geometry = () => page.evaluate(() => {
      const hud = document.querySelector('.combat > .shared-hud');
      const hp = hud.querySelector('.resunit[data-res="hp"]');
      const rect = node => node.getBoundingClientRect().toJSON();
      const track = hp.querySelector('.m-track');
      const buttons = [...hud.querySelectorAll('.hud-actions button')].map(node => {
        const r = rect(node), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { rect: r, ownsCenter: top === node || node.contains(top), label: node.getAttribute('aria-label') };
      });
      return { track: rect(track), fill: rect(hp.querySelector('.m-fill')), plate: rect(hp.querySelector('.m-plate')),
        heart: rect(hp.querySelector('.engraved-icon')), value: hp.querySelector('.m-value').textContent,
        current: Number(track.dataset.cur), max: Number(track.dataset.max), buttons,
        relics: hud.querySelector('.hud-relics')?.children.length || 0 };
    });
    const check = g => {
      assert(g.heart.width >= 17 && g.heart.height >= 17, 'heart stays visible');
      assert.equal(g.value, `${g.current}/${g.max}`);
      assert(g.track.top >= g.plate.bottom - .5, 'trough sits below health text');
      assert(g.track.height >= 2.5 && g.track.height <= 3.5, 'thin physical trough');
      const armoury = g.buttons[0].rect;
      assert(armoury.left - g.track.right >= 8 && armoury.left - g.track.right <= 18, 'trough reaches Armoury with clear padding');
      assert(Math.abs(g.fill.width / g.track.width - g.current / g.max) < .002, 'fill represents actual hp/max');
      assert(g.buttons.length === 2 && g.buttons.every(button => button.ownsCenter), 'Armoury and menu retain exposed centers');
      assert(g.relics > 0, 'utility icon rail remains present');
    };
    try {
      await page.goto(process.env.COMBAT_QA_URL || 'http://localhost:8338/?shot=combat&preview=rear-player', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.locator('.hand .card').first().waitFor({ timeout: 120000 }); await page.waitForTimeout(1200);
      row.url = page.url(); row.initial = await geometry(); check(row.initial);
      await page.screenshot({ path: `${out}/${width}-header.png` });
      if (width === 390) {
        const turn = await page.evaluate(() => window.__combat.turn);
        await page.locator('.end-turn').tap();
        const deadline = Date.now() + 25000;
        while (Date.now() < deadline) {
          const confirm = page.locator('.confirmation-confirm');
          if (await confirm.isVisible()) await confirm.tap();
          const back = page.locator('.reaction-choice').getByRole('button', { name: 'Back', exact: true }).last();
          if (await back.isVisible()) await back.tap();
          if (await page.evaluate(turn => window.__combat.turn > turn && window.__combat.phase === 'player', turn)) break;
          await page.waitForTimeout(200);
        }
        await page.waitForTimeout(700);
        row.damaged = await geometry(); check(row.damaged);
        assert(row.damaged.current < row.damaged.max, 'authored enemy turn gives a partially filled real health bar');
        await page.screenshot({ path: `${out}/${width}-damaged.png` });
      }
      assert.deepEqual(row.errors, []); row.pass = true; save();
    } catch (error) {
      row.error = error.stack; row.last = await geometry(); save();
      await page.screenshot({ path: `${out}/${width}-failure.png` }); throw error;
    } finally { await page.close(); }
  }
  console.log('PASS header geometry at five shapes and real damaged HP percentage');
} finally { await browser.close(); }
