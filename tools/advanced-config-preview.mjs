#!/usr/bin/env node
// Browser witness for Settings > Advanced configuration.

import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT = resolve(ROOT, 'scratch', 'advanced-config-preview');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

function connect(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });
  return {
    ready: new Promise((ok, fail) => { socket.addEventListener('open', ok); socket.addEventListener('error', fail); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((ok, fail) => {
        pending.set(id, { resolve: ok, reject: fail });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => socket.close(),
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = await serve({ root: ROOT, port: 8547, open: false });
  const previewURL = process.argv.includes('--standalone') ? pathToFileURL(resolve(ROOT, 'AshenSpire.html')).href : `http://localhost:${server.port}/`;
  const browser = await launchBrowser({ prefix: 'advconfig-', timeoutMs: 20000 });
  const cdp = connect(browser.wsUrl);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  const evaluate = async (expression) => {
    const reply = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text);
    return reply.result.value;
  };
  const until = async (expression, label) => {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await wait(80);
    }
    throw new Error(`Timed out waiting for ${label}`);
  };
  const capture = async (name) => {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, sessionId);
    writeFileSync(resolve(OUT, `${name}.png`), Buffer.from(shot.data, 'base64'));
  };
  try {
    for (const shape of [
      { name: 'desktop-progression', width: 1440, height: 900, group: 'Progression', mobile: false },
      { name: 'desktop-classes', width: 1440, height: 900, group: 'Classes', mobile: false },
      { name: 'desktop-interface', width: 1440, height: 900, group: 'Interface', mobile: false },
      { name: 'desktop-placement', width: 1440, height: 900, group: 'Interface', search: 'default', mobile: false },
      { name: 'desktop-export', width: 1440, height: 900, group: 'Export', mobile: false },
      { name: 'phone-progression', width: 390, height: 844, group: 'Progression', mobile: true },
      { name: 'phone-interface', width: 390, height: 844, group: 'Interface', mobile: true },
      { name: 'phone-export', width: 390, height: 844, group: 'Export', mobile: true },
      { name: 'phone-placement', width: 390, height: 844, group: 'Interface', search: 'default', mobile: true },
    ].filter(shape => !process.argv.includes('--combat-only') && (!process.argv.includes('--settings-files-only') || shape.group === 'Export'))) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: shape.width, height: shape.height, deviceScaleFactor: 1, mobile: shape.mobile,
      }, sessionId);
      const shotSettings = encodeURIComponent(JSON.stringify({ settingsAdvancedCategory: shape.group }));
      await cdp.send('Page.navigate', { url: `${previewURL}?shot=settings&shotSettings=${shotSettings}` }, sessionId);
      await until("!!document.querySelector('.settings-modal [data-advanced-search]')", 'advanced settings');
      await wait(250);
      if (shape.search) {
        await evaluate(`(() => {
          const input = document.querySelector('[data-advanced-search]');
          input.value = ${JSON.stringify(shape.search)};
          input.dispatchEvent(new Event('input', { bubbles: true }));
        })()`);
      }
      if (shape.group === 'Export') {
        await evaluate(`(() => {
          window.showSaveFilePicker = async () => ({ createWritable: async () => ({ write: async () => {}, close: async () => {} }) });
          document.querySelector('[data-btn="gameConfigExport"]').click();
        })()`);
        await until("document.querySelector('[data-btn=gameConfigExport]')?.textContent === 'Saved'", 'Save As completion');
        await evaluate(`(() => {
          const input = document.querySelector('[data-config-import]');
          const transfer = new DataTransfer();
          transfer.items.add(new File([JSON.stringify({game:'Ashen Spire',schemaVersion:1,overrides:{'gameConfig.presentation.rowAScale':1.4}})], 'settings.json', {type:'application/json'}));
          input.files = transfer.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        })()`);
        await until("JSON.parse(document.documentElement.dataset.formationSettings).rowAScale === 1.4", 'settings file applied');
        await evaluate(`(() => {
          const input = document.querySelector('[data-config-import]');
          const transfer = new DataTransfer();
          transfer.items.add(new File(['not JSON'], 'invalid.json'));
          input.files = transfer.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        })()`);
        await until("document.body.textContent.includes('Import failed:')", 'invalid file notice');
        if (await evaluate("JSON.parse(document.documentElement.dataset.formationSettings).rowAScale") !== 1.4) throw new Error('Invalid import changed settings');
      }
      const state = await evaluate(`(() => {
        const modal = document.querySelector('.settings-modal');
        const body = modal.querySelector('.set-body');
        const pane = modal.querySelector('.set-panel');
        const active = modal.querySelector('.set-advanced-group:not([hidden])');
        const scrollable = [body, pane].filter((el) => el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== 'hidden');
        return {
          group: active?.dataset.advancedPanel,
          rows: active?.querySelectorAll('.set-row:not([hidden])').length || 0,
          placementLabels: [...(active?.querySelectorAll('.set-row:not([hidden]) .ls-label') || [])].map((node) => node.textContent),
          viewport: [innerWidth, innerHeight],
          modal: [Math.round(modal.getBoundingClientRect().width), Math.round(modal.getBoundingClientRect().height)],
          verticalScrollOwners: scrollable.map((el) => el.className),
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      })()`);
      if (state.group !== shape.group || state.rows < 1 || state.verticalScrollOwners.length > 1 || state.overflowX > 1) {
        throw new Error(`${shape.name}: ${JSON.stringify(state)}`);
      }
      if (shape.search && !['Player default row (A–C)', 'Enemy default row (A–C)', 'Player default column (1–2)', 'Enemy default column (3–4)']
        .every((label) => state.placementLabels.includes(label))) {
        throw new Error(`${shape.name}: placement controls missing: ${JSON.stringify(state)}`);
      }
      console.log(`PASS ${shape.name} — ${state.rows} rows, one vertical scroll owner, modal ${state.modal.join('×')}`);
      await capture(shape.name);
    }
    if (process.argv.includes('--settings-files-only')) return;
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    }, sessionId);
    const combatSettings = encodeURIComponent(JSON.stringify({
      quickNav: 'off', settingsCategory: 'Advanced', settingsAdvancedCategory: 'Interface',
      'gameConfig.presentation.playerSpriteScale': 1.15,
      'gameConfig.presentation.enemySpriteScale': 0.8,
    }));
    await cdp.send('Page.navigate', { url: `${previewURL}?shot=combat&shotSettings=${combatSettings}` }, sessionId);
    await until("!!document.querySelector('.combatant.player .sprite') && !!document.querySelector('.combatant.enemy .sprite')", 'combat figures');
    await wait(350);
    const presentation = await evaluate(`(() => ({
      playerScale: document.querySelector('.combatant.player').dataset.presentationScale,
      enemyScale: document.querySelector('.combatant.enemy').dataset.presentationScale,
      playerCell: document.querySelector('.combatant.player').dataset.formationCell,
      enemyCell: document.querySelector('.combatant.enemy').dataset.formationCell,
      playerTranslate: getComputedStyle(document.querySelector('.combatant.player .sprite')).translate,
      enemyTranslate: getComputedStyle(document.querySelector('.combatant.enemy .sprite')).translate,
      playerRow: document.documentElement.dataset.playerSpawnRow,
      enemyRow: document.documentElement.dataset.enemySpawnRow,
      playerColumn: document.documentElement.dataset.playerSpawnColumn,
      enemyColumn: document.documentElement.dataset.enemySpawnColumn,
    }))()`);
    if (presentation.playerScale !== '1.15' || presentation.enemyScale !== '0.8'
      || presentation.playerTranslate !== 'none' || presentation.enemyTranslate !== 'none'
      || presentation.playerCell !== 'C2' || presentation.enemyCell !== 'C3'
      || presentation.playerRow !== 'C' || presentation.enemyRow !== 'C'
      || presentation.playerColumn !== '2' || presentation.enemyColumn !== '3') {
      throw new Error(`combat-presentation: ${JSON.stringify(presentation)}`);
    }
    console.log('PASS combat-presentation — sprite scales and default rows and columns applied');
    await capture('combat-presentation');
    // Exercise the real settings handlers while the battle remains mounted.
    await evaluate("document.querySelector('#combat-menu').click()");
    await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Settings'); if (button) button.click(); })()`);
    await until("!!document.querySelector('[data-member=Advanced]')", 'live settings');
    await evaluate("document.querySelector('[data-member=Advanced]').click()");
    await until("!!document.querySelector('[data-key=\"gameConfig.presentation.playerSpawnRow\"]')", 'formation controls');
    const setChoice = (key, value) => evaluate(`document.querySelector('[data-key="gameConfig.presentation.${key}"][data-val="${value}"]').click()`);
    const setInput = (key, value, event = 'change') => evaluate(`(() => { const input = document.querySelector('input[data-key="gameConfig.presentation.${key}"]'); input.value = ${JSON.stringify(String(value))}; input.dispatchEvent(new Event('${event}', { bubbles: true })); })()`);
    await setChoice('playerSpawnRow', 'A');
    await setChoice('playerSpawnColumn', '1');
    await setChoice('enemySpawnRow', 'B');
    await setChoice('enemySpawnColumn', '4');
    await until("document.querySelector('.combatant.player').dataset.formationCell === 'A1' && document.querySelector('.combatant.enemy').dataset.formationCell === 'B4'", 'live preferred slots');
    const beforeOffset = await evaluate(`(() => { const tile = document.querySelector('[data-cell="A1"]'); return Number(tile.dataset.anchorY); })()`);
    await setInput('rowAScale', 1.5);
    await setInput('frontOffsetX', 25);
    await setInput('backOffsetY', -15);
    await setInput('backLayer', 350);
    await setInput('rowALayer', 20);
    await setInput('playerGridColor', '#00ff88', 'input');
    await setChoice('gridLayer', 'above');
    for (const shape of ['square', 'rectangle', 'rhombus', 'wide-rhombus', 'circle', 'ellipse']) {
      await setChoice('gridShape', shape);
      await until(`document.querySelector('.formation-grid').dataset.shape === '${shape}'`, 'live shape ' + shape);
    }
    await until("Math.abs(Number(document.querySelector('.combatant.player').dataset.presentationScale) - 1.725) < .001", 'row multiplier');
    const live = await evaluate(`(() => { const actor = document.querySelector('.combatant.player'); const grid = document.querySelector('.formation-grid'); return { cell: actor.dataset.formationCell, layer: actor.style.zIndex, color: grid.style.getPropertyValue('--player-grid-color'), gridLayer: grid.style.zIndex }; })()`);
    if (live.layer !== '370' || live.color !== '#00ff88' || live.gridLayer !== '2000') throw new Error('live settings: ' + JSON.stringify(live));
    const afterOffset = await evaluate("Number(document.querySelector('[data-cell=\"A1\"]').dataset.anchorY)");
    if (Math.abs(afterOffset - beforeOffset + 15) > 1) throw new Error('Back column offset did not move actual anchor');
    await evaluate(`(() => { const toggle = document.querySelector('[data-key="gameConfig.presentation.showFormationGrid"]'); if (toggle?.getAttribute('aria-checked') !== 'true') toggle?.click(); document.querySelector('#ov-close').click(); })()`);
    await until("!document.querySelector('#ov-close') && getComputedStyle(document.querySelector('.formation-grid')).display === 'grid'", 'customized battle');
    await capture('customized-formation');
    console.log('PASS live settings — actual slots, row scale, offsets, layers, colors, all six shapes');
    for (const [name, width, height] of [['desktop-grid', 1440, 900], ['phone-grid', 390, 844]]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
      const settings = encodeURIComponent(JSON.stringify({ 'gameConfig.presentation.showFormationGrid': true }));
      await cdp.send('Page.navigate', { url: `${previewURL}?shot=combat&shotSettings=${settings}` }, sessionId);
      await until("document.querySelectorAll('.formation-grid-cell').length === 12", 'formation grid');
      await wait(350);
      const grid = await evaluate(`(() => { const grid = document.querySelector('.formation-grid'); return { display: getComputedStyle(grid).display, pointer: getComputedStyle(grid).pointerEvents, labels: [...grid.children].map(el => el.textContent) }; })()`);
      if (grid.display !== 'grid' || grid.pointer !== 'none' || !grid.labels[0].startsWith('A1') || !grid.labels[11].startsWith('C4')) throw new Error(JSON.stringify(grid));
      await capture(name);
      const alignment = await evaluate(`(() => {
        const field = document.querySelector('.field');
        const rect = field.getBoundingClientRect();
        return [...field.querySelectorAll('.combatant[data-formation-cell]')].map(actor => {
          const tile = field.querySelector('[data-cell="' + actor.dataset.formationCell + '"]');
          const box = tile.getBoundingClientRect();
          const sprite = actor.querySelector('.sprite').getBoundingClientRect();
          const frame = actor.getBoundingClientRect();
          return { cell: actor.dataset.formationCell, occupied: tile.dataset.occupied,
            feet: sprite.bottom - (box.top + box.bottom) / 2,
            fieldTop: rect.top, gridTop: tile.parentElement.getBoundingClientRect().top, tileTop: box.top, tileHeight: box.height, css: tile.style.cssText, ground: actor.dataset.groundY, zoom: getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom'),
            y: (box.top + box.bottom) / 2 - rect.top - Number(actor.dataset.groundRatio) * rect.height,
            x: (box.left + box.right) / 2 - (frame.left + frame.right) / 2 };
        });
      })()`);
      if (!alignment.length || alignment.some(a => a.occupied !== 'true' || Math.abs(a.x) > 1 || Math.abs(a.y) > 1 || Math.abs(a.feet) > 1)) throw new Error(name + ': grid differs from actual formation anchors ' + JSON.stringify(alignment));
      await evaluate("document.documentElement.dataset.formationGrid = 'false'");
      if (await evaluate("getComputedStyle(document.querySelector('.formation-grid')).display") !== 'none') throw new Error('Grid did not hide');
      console.log(`PASS ${name}: 12 labeled cells, pointer passthrough, toggle off`);
    }
  } finally {
    cdp.close();
    await browser.close();
    server.server.closeAllConnections?.();
    await new Promise((done) => server.server.close(done));
  }
  console.log(`Screenshots: ${OUT}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
