#!/usr/bin/env node
// Browser witness for Settings > Advanced configuration.

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
      { name: 'phone-placement', width: 390, height: 844, group: 'Interface', search: 'default', mobile: true },
    ]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: shape.width, height: shape.height, deviceScaleFactor: 1, mobile: shape.mobile,
      }, sessionId);
      const shotSettings = encodeURIComponent(JSON.stringify({ settingsAdvancedCategory: shape.group }));
      await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/?shot=settings&shotSettings=${shotSettings}` }, sessionId);
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
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    }, sessionId);
    const combatSettings = encodeURIComponent(JSON.stringify({
      'gameConfig.presentation.playerSpriteScale': 1.15,
      'gameConfig.presentation.enemySpriteScale': 0.8,
    }));
    await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/?shot=combat&shotSettings=${combatSettings}` }, sessionId);
    await until("!!document.querySelector('.combatant.player .sprite') && !!document.querySelector('.combatant.enemy .sprite')", 'combat figures');
    await wait(350);
    const presentation = await evaluate(`(() => ({
      playerScale: getComputedStyle(document.querySelector('.combatant.player .sprite')).scale,
      enemyScale: getComputedStyle(document.querySelector('.combatant.enemy .sprite')).scale,
      playerTranslate: getComputedStyle(document.querySelector('.combatant.player .sprite')).translate,
      enemyTranslate: getComputedStyle(document.querySelector('.combatant.enemy .sprite')).translate,
      playerRow: document.documentElement.dataset.playerSpawnRow,
      enemyRow: document.documentElement.dataset.enemySpawnRow,
      playerColumn: document.documentElement.dataset.playerSpawnColumn,
      enemyColumn: document.documentElement.dataset.enemySpawnColumn,
    }))()`);
    if (presentation.playerScale !== '1.15' || presentation.enemyScale !== '0.8'
      || presentation.playerTranslate !== '14% 12%' || presentation.enemyTranslate !== '-14% 12%'
      || presentation.playerRow !== 'C' || presentation.enemyRow !== 'C'
      || presentation.playerColumn !== '2' || presentation.enemyColumn !== '3') {
      throw new Error(`combat-presentation: ${JSON.stringify(presentation)}`);
    }
    console.log('PASS combat-presentation — sprite scales and default rows and columns applied');
    await capture('combat-presentation');
    for (const [name, width, height] of [['desktop-grid', 1440, 900], ['phone-grid', 390, 844]]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
      const settings = encodeURIComponent(JSON.stringify({ 'gameConfig.presentation.showFormationGrid': true }));
      await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/?shot=combat&shotSettings=${settings}` }, sessionId);
      await until("document.querySelectorAll('.formation-grid-cell').length === 12", 'formation grid');
      await wait(350);
      const grid = await evaluate(`(() => { const grid = document.querySelector('.formation-grid'); return { display: getComputedStyle(grid).display, pointer: getComputedStyle(grid).pointerEvents, labels: [...grid.children].map(el => el.textContent) }; })()`);
      if (grid.display !== 'grid' || grid.pointer !== 'none' || !grid.labels[0].startsWith('A1') || !grid.labels[11].startsWith('C4')) throw new Error(JSON.stringify(grid));
      await capture(name);
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
