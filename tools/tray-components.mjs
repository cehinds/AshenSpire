#!/usr/bin/env node
// Focused browser gate for the shared four-edge Folding Tray component.

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const SHOTS = process.argv.includes('--shots');
const SHOT_DIR = resolve(ROOT, 'scratch', 'tray-components');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
let checks = 0;
let failures = 0;

function check(ok, label) {
  checks += 1;
  console.log(`    ${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failures += 1;
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let id = 0;
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });
  return {
    ready: new Promise((done, fail) => {
      ws.addEventListener('open', done);
      ws.addEventListener('error', fail);
    }),
    send(method, params = {}, sessionId) {
      const callId = ++id;
      return new Promise((done, fail) => {
        pending.set(callId, { resolve: done, reject: fail });
        ws.send(JSON.stringify({ id: callId, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

async function main() {
  console.log('tray-components — shared top/right/bottom/left disclosure contract');
  const server = await serve({ root: ROOT, port: 8543, open: false });
  const browser = await launchBrowser({ prefix: 'trays-', timeoutMs: 20000 });
  const cdp = connect(browser.wsUrl);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  const evaluate = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'page evaluation failed');
    return result.result.value;
  };
  const until = async (expression, label) => {
    const end = Date.now() + 8000;
    while (Date.now() < end) {
      if (await evaluate(expression)) return;
      await wait(50);
    }
    throw new Error(`timed out waiting for ${label}`);
  };
  try {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 730, deviceScaleFactor: 1, mobile: false }, sessionId);
    await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/?shot=map` }, sessionId);
    await until("document.readyState === 'complete'", 'page');
    await evaluate(`(async () => {
      const { trayModel } = await import('/src/ui/models/TrayModels.js');
      const { renderTray } = await import('/src/ui/components/trayComponents.js');
      const { componentModel } = await import('/src/ui/models/ComponentModel.js');
      const { UI_COMPONENTS } = await import('/src/ui/models/UiComponentId.js');
      const host = document.createElement('main');
      host.id = 'tray-test-harness';
      host.style.cssText = 'position:fixed;inset:2rem;z-index:9999;background:#100d09;padding:2rem;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:2rem;color:#eadfca';
      document.body.appendChild(host);
      const states = { top:false, right:false, bottom:false, left:false };
      const mount = (edge) => {
        let cell = host.querySelector('[data-cell="' + edge + '"]');
        if (!cell) {
          cell = document.createElement('div');
          cell.dataset.cell = edge;
          cell.style.cssText = 'display:flex;min-width:0;min-height:0;border:1px dashed #5c4c2a;overflow:hidden';
          host.appendChild(cell);
        }
        cell.style.flexDirection = (edge === 'left' || edge === 'right') ? 'row' : 'column';
        cell.replaceChildren();
        const item = componentModel(UI_COMPONENTS.armouryInventory);
        const model = trayModel({ id:'test-' + edge, name:edge.toUpperCase() + ' TRAY', count:3, itemType:'card', edge, expanded:states[edge], sortable:true, items:[item] });
        const rendered = renderTray(model, {
          onToggle: () => { states[edge] = !states[edge]; mount(edge); },
          onSort: () => {},
          renderContent: (content, children) => { content.dataset.childCount = String(children.length); content.innerHTML = '<div style="padding:1rem">[ tray item component ]</div>'; },
        });
        cell.appendChild(rendered.element);
      };
      ['top','right','bottom','left'].forEach(mount);
      window.__trayStates = states;
      return true;
    })()`);
    const before = await evaluate(`(() => Object.fromEntries([...document.querySelectorAll('.folding-tray')].map((tray) => {
      const edge = tray.dataset.trayEdge;
      const fold = tray.querySelector('.tray-fold');
      const content = tray.querySelector('.tray-content');
      const rect = tray.getBoundingClientRect();
      return [edge, { text:fold.innerText.trim().replace(/\\s+/g, ' '), expanded:fold.getAttribute('aria-expanded'), controls:fold.getAttribute('aria-controls'), hidden:content.hidden, width:rect.width, height:rect.height }];
    })))()`);
    const closed = { top:'v', right:'<', bottom:'^', left:'>' };
    for (const edge of Object.keys(closed)) {
      check(before[edge].text.startsWith(closed[edge]), `${edge} closed arrow points inward (${closed[edge]})`);
      check(before[edge].expanded === 'false' && before[edge].hidden, `${edge} closed ARIA and hidden state agree`);
      check(before[edge].controls === `tray-content-test-${edge}`, `${edge} fold owns its content`);
    }
    check(await evaluate(`[...document.querySelectorAll('.tray-content')].every((node) => node.dataset.childCount === '1')`), 'renderer receives each Tray Content child model');
    check(before.right.height > before.right.width * 2 && before.left.height > before.left.width * 2, 'closed side trays are full-height rails');
    await evaluate(`document.querySelector('[data-tray-edge="right"] .tray-fold').click(); document.querySelector('[data-tray-edge="left"] .tray-fold').click(); true`);
    const opened = await evaluate(`(() => Object.fromEntries(['right','left'].map((edge) => {
      const tray = document.querySelector('[data-tray-edge="' + edge + '"]');
      const fold = tray.querySelector('.tray-fold');
      return [edge, { text:fold.innerText.trim().replace(/\\s+/g, ' '), expanded:fold.getAttribute('aria-expanded'), hidden:tray.querySelector('.tray-content').hidden, width:tray.getBoundingClientRect().width }];
    })))()`);
    check(opened.right.text.startsWith('> RIGHT TRAY'), 'right open header is exactly “> RIGHT TRAY”');
    check(opened.left.text.startsWith('< LEFT TRAY'), 'left open header is exactly “< LEFT TRAY”');
    check(opened.right.expanded === 'true' && !opened.right.hidden, 'right open ARIA and content state agree');
    check(opened.left.expanded === 'true' && !opened.left.hidden, 'left open ARIA and content state agree');
    check(opened.right.width > before.right.width * 2 && opened.left.width > before.left.width * 2, 'open side trays span their section width');
    const composition = await evaluate(`(async () => {
      const { armouryPanelModel } = await import('/src/ui/models/ArmouryModels.js');
      const ids = ['slots','inventory','cards','stats'];
      const regions = ids.map((id) => ({ id, label:id, count:1, unit:'item', edge:'bottom', expanded:false }));
      return ids.map((subject) => {
        const panel = armouryPanelModel({ view:'grid', views:['grid'], layout:{ figure:true, slots:'flank' }, subject, regions });
        return { subject, trays:panel.children.filter((child) => child.component === 'folding-tray').length,
          direct:panel.children.some((child) => child.component === ({ slots:'armoury-body', inventory:'armoury-inventory', cards:'armoury-card-strip', stats:'armoury-stats-panel' })[subject]) };
      });
    })()`);
    check(composition.every((row) => row.trays === 3 && row.direct), 'every configured Armoury subject remains direct while the other three become trays');
    if (SHOTS) {
      mkdirSync(SHOT_DIR, { recursive: true });
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, sessionId);
      writeFileSync(resolve(SHOT_DIR, 'four-edge-trays.png'), Buffer.from(shot.data, 'base64'));
      console.log(`    SHOT ${resolve(SHOT_DIR, 'four-edge-trays.png')}`);
    }
  } finally {
    cdp.close();
    await browser.close();
    await new Promise((done) => server.server.close(done));
  }
  console.log(`\n  ${checks - failures} passed, ${failures} failed`);
  if (failures) process.exitCode = 1;
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
