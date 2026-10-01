import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.COMBAT_QA_URL || 'http://localhost:8326/index.html';
const out = resolve(process.env.COMBAT_QA_OUT || 'outputs/combat-size');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];
try {
  for (const tier of ['full', 'light']) for (const [width, height] of [[1876, 900], [390, 844], [390, 650], [844, 390]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);
    console.log('Checking', tier, width, height);
    const errors = [];
    page.on('console', message => { if (message.type() === 'error') { errors.push(message.text()); console.error(message.text()); } });
    page.on('requestfailed', request => {
      const error = `Request failed: ${request.url()} ${request.failure()?.errorText}`;
      errors.push(error); console.error(error);
    });
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
    if (tier === 'light') await page.route('**/assets/**/*.webp', route => route.continue({ url: route.request().url().replace('/assets/', '/assets-mobile/') }));
    await page.goto(base + '?shot=combat', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__renderCombatForShot).catch(async error => {
      await page.screenshot({ path: resolve(out, 'boot-error.png') });
      console.error((await page.locator('body').innerText()).slice(0, 2000));
      throw error;
    });
    await page.evaluate(async () => {
      const { contentBundle } = await import('./src/content/index.js');
      const { createRegistries } = await import('./src/model/registries.js');
      const { createCombat } = await import('./src/engine/combat.js');
      const { createRng } = await import('./src/engine/rng.js');
      const c = createCombat({ registries: createRegistries(contentBundle), rng: createRng(231),
        player: { classId: 'reaver', maxHp: 100, hp: 100, maxMana: 0, mana: 0, maxStamina: 3, stamina: 3, energyMax: 3, drawPerTurn: 0, deck: [], relicIds: [], flasks: [] },
        enemyIds: ['wanderingSoldier', 'wanderingSoldier'] });
      window.__combat.enemies.splice(0, window.__combat.enemies.length, ...c.enemies);
      window.__renderCombatForShot();
    });
    await page.waitForFunction(() => [...document.querySelectorAll('.enemy-pose-idle')].every(img => img.complete && img.naturalWidth));
    await page.waitForTimeout(1000);
    const geometry = await page.evaluate(() => {
      const field = document.querySelector('.field').getBoundingClientRect();
      const actors = [...document.querySelectorAll('.combatant')].map(frame => {
        const card = frame.querySelector('.combatant-card').getBoundingClientRect();
        const intent = frame.querySelector('.intent')?.getBoundingClientRect();
        const img = frame.querySelector('.enemy-pose-idle');
        let inkHeight = null;
        if (img) {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let top = canvas.height, bottom = -1;
          for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (data[(y * canvas.width + x) * 4 + 3] >= 40) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
          inkHeight = (bottom - top + 1) / canvas.height * img.getBoundingClientRect().height;
        }
        return { id: frame.dataset.eid, height: Number(frame.dataset.spriteVisibleHeight), inkHeight,
          gap: intent ? card.top - intent.bottom : null, intentTop: intent?.top,
          cardTop: card.top, naturalHeight: img?.naturalHeight };
      });
      const card = document.querySelector('.hand .card');
      return { fieldTop: field.top, actors, cardWidth: parseFloat(card.style.getPropertyValue('--hand-card-width')) * (document.querySelector('.hand').getBoundingClientRect().width / document.querySelector('.hand').clientWidth),
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    const name = `${tier}-${width}x${height}`;
    await page.screenshot({ path: resolve(out, name + '.png') });
    results.push({ name, ...geometry, errors });
    console.log(name, JSON.stringify(geometry));
    const player = geometry.actors[0];
    for (const enemy of geometry.actors.slice(1)) {
      if (enemy.inkHeight < player.height - 1) throw Error(`${name}: enemy ink is smaller than player: ${JSON.stringify(enemy)}`);
      if (Math.abs(enemy.gap - 14) > 1) throw Error(`${name}: action is not 14px above its card`);
      if (enemy.intentTop < geometry.fieldTop - 1) throw Error(`${name}: action rises above battlefield`);
    }
    if (geometry.overflow || errors.length) throw Error(`${name}: overflow or browser errors`);
    if (width === 1876 && geometry.cardWidth < 165) throw Error(`${name}: desktop cards still too small`);
    await page.evaluate(async () => {
      const { selectCombatantInfo } = await import('./src/ui/components/combatantOverhead.js');
      selectCombatantInfo(document.querySelector('.field'), document.querySelector('.enemy').dataset.eid);
    });
    await page.waitForTimeout(400);
    const selected = await page.locator('.enemy.context-selected').evaluate(frame => ({
      gap: frame.querySelector('.combatant-card').getBoundingClientRect().top - frame.querySelector('.intent').getBoundingClientRect().bottom,
      top: frame.querySelector('.combatant-leading').getBoundingClientRect().top,
    }));
    if (Math.abs(selected.gap - 14) > 1 || selected.top < geometry.fieldTop - 1) throw Error(`${name}: selection moved action gap or escaped field: ${JSON.stringify(selected)}`);
    await page.close();
  }
  writeFileSync(resolve(out, 'checks.json'), JSON.stringify(results, null, 2));
} finally { await browser.close(); }
