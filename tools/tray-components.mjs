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
        const model = trayModel({ id:'test-' + edge, name:edge.toUpperCase() + ' TRAY', count:3, itemType:'card', edge, expanded:states[edge], sortable:true, minExpandedSize:96, items:[item] });
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
      const style = getComputedStyle(tray);
      return [edge, { text:fold.innerText.trim().replace(/\\s+/g, ' '), expanded:fold.getAttribute('aria-expanded'), controls:fold.getAttribute('aria-controls'), hidden:content.hidden, width:rect.width, height:rect.height, marginTop:parseFloat(style.marginTop), marginLeft:parseFloat(style.marginLeft), marginRight:parseFloat(style.marginRight) }];
    })))()`);
    const closed = { top:'v', right:'<', bottom:'^', left:'>' };
    for (const edge of Object.keys(closed)) {
      check(before[edge].text.startsWith(closed[edge]), `${edge} closed arrow points inward (${closed[edge]})`);
      check(before[edge].expanded === 'false' && before[edge].hidden, `${edge} closed ARIA and hidden state agree`);
      check(before[edge].controls === `tray-content-test-${edge}`, `${edge} fold owns its content`);
    }
    check(await evaluate(`[...document.querySelectorAll('.tray-content')].every((node) => node.dataset.childCount === '1')`), 'renderer receives each Tray Content child model');
    check(before.right.height > before.right.width * 2 && before.left.height > before.left.width * 2, 'closed side trays are full-height rails');
    check(before.left.marginTop > 0 && before.left.marginLeft > 0 && before.right.marginTop > 0 && before.right.marginRight > 0, 'side trays share a positive vertical and anchored-edge margin');
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
    const resize = await evaluate(`(async () => {
      const tray = document.querySelector('[data-tray-edge="right"]');
      const handle = tray.querySelector('.tray-resize-handle');
      const hit = handle.getBoundingClientRect();
      const start = tray.getBoundingClientRect().width;
      const pointerId = 41;
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, pointerId, pointerType:'touch', button:0, clientX:hit.left + 22, clientY:hit.top + 22 }));
      await new Promise((done) => setTimeout(done, 210));
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles:true, pointerId, pointerType:'touch', clientX:hit.left + 82, clientY:hit.top + 22 }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, pointerId, pointerType:'touch', clientX:hit.left + 82, clientY:hit.top + 22 }));
      const resized = tray.getBoundingClientRect().width;
      tray.querySelector('.tray-fold').click();
      const folded = document.querySelector('[data-tray-edge="right"]').getBoundingClientRect().width;
      document.querySelector('[data-tray-edge="right"] .tray-fold').click();
      const restoredTray = document.querySelector('[data-tray-edge="right"]');
      return { start, resized, folded, restored:restoredTray.getBoundingClientRect().width, handleWidth:restoredTray.querySelector('.tray-resize-handle').getBoundingClientRect().width };
    })()`);
    check(resize.resized < resize.start - 40, 'touch hold and drag resizes an expanded side tray');
    check(resize.folded < resize.resized / 2, 'folding returns a resized side tray to its compact rail');
    check(Math.abs(resize.restored - resize.resized) < 2, 'reopening restores the tray’s last expanded size');
    check(resize.handleWidth >= 44, 'side resize handle exposes at least a 44px touch surface');
    const verticalResize = await evaluate(`(() => {
      document.querySelector('[data-tray-edge="top"] .tray-fold').click();
      const tray = document.querySelector('[data-tray-edge="top"]');
      tray.style.height = '140px';
      const handle = tray.querySelector('.tray-resize-handle');
      const hit = handle.getBoundingClientRect();
      const start = tray.getBoundingClientRect().height;
      const pointerId = 42;
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, pointerId, pointerType:'mouse', button:0, clientX:hit.left + 22, clientY:hit.top + 22 }));
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles:true, pointerId, pointerType:'mouse', clientX:hit.left + 22, clientY:hit.top - 34 }));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, pointerId, pointerType:'mouse', clientX:hit.left + 22, clientY:hit.top - 34 }));
      const resized = tray.getBoundingClientRect().height;
      tray.querySelector('.tray-fold').click();
      document.querySelector('[data-tray-edge="top"] .tray-fold').click();
      const restoredTray = document.querySelector('[data-tray-edge="top"]');
      return { start, resized, restored:restoredTray.getBoundingClientRect().height, handleHeight:restoredTray.querySelector('.tray-resize-handle').getBoundingClientRect().height };
    })()`);
    check(verticalResize.resized < verticalResize.start - 35, `mouse drag resizes an expanded top tray vertically (${verticalResize.start} → ${verticalResize.resized})`);
    check(Math.abs(verticalResize.restored - verticalResize.resized) < 2, 'top tray restores its last expanded height');
    check(verticalResize.handleHeight >= 44, 'top resize handle exposes at least a 44px touch surface');
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
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1250, deviceScaleFactor: 1, mobile: false }, sessionId);
    await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/docs/tray-gallery.html` }, sessionId);
    await until("document.querySelectorAll('.tray-gallery-card').length === 8", 'eight-state tray gallery');
    const gallery = await evaluate(`(() => ({
      cards:document.querySelectorAll('.tray-gallery-card').length,
      edges:Object.fromEntries(['top','right','bottom','left'].map((edge)=>[edge,[...document.querySelectorAll('.tray-gallery-cell[data-edge="' + edge + '"] .folding-tray')].map((tray)=>tray.dataset.collapsed).sort()])),
      rightOpen:[...document.querySelectorAll('.tray-gallery-cell[data-edge="right"] .folding-tray')].find((tray)=>tray.dataset.collapsed==='0')?.querySelector('.tray-fold').innerText.trim().replace(/\\s+/g,' '),
      bottomOpen:(() => { const cell=[...document.querySelectorAll('.tray-gallery-cell[data-edge="bottom"]')].find((node)=>node.querySelector('.folding-tray[data-collapsed="0"]')); const tray=cell.querySelector('.folding-tray[data-collapsed="0"]'); const c=cell.getBoundingClientRect(); const t=tray.getBoundingClientRect(); return { aligned:Math.abs(c.bottom-t.bottom)<1, compact:t.height<c.height-20 }; })(),
      sortSquares:[...document.querySelectorAll('.tray-sort')].map((button)=>{ const rect=button.getBoundingClientRect(); return { width:rect.width, height:rect.height }; }),
    }))()`);
    check(gallery.cards === 8, 'gallery renders all eight folded/unfolded specimens');
    check(Object.values(gallery.edges).every((states) => states.join(',') === '0,1'), 'each edge has one folded and one unfolded specimen');
    check(gallery.rightOpen.startsWith('> RIGHT TRAY'), 'gallery preserves the open Right Tray “>” contract');
    check(gallery.bottomOpen.aligned && gallery.bottomOpen.compact, 'unfolded Bottom Tray is compact and anchored to the bottom edge');
    check(gallery.sortSquares.length === 4 && gallery.sortSquares.every(({ width, height }) => Math.abs(width-height)<0.5 && width>=44 && width<=45), `every tray sort control is a 44px square (${JSON.stringify(gallery.sortSquares)})`);
    if (SHOTS) {
      const galleryShot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true }, sessionId);
      writeFileSync(resolve(SHOT_DIR, 'eight-state-trays.png'), Buffer.from(galleryShot.data, 'base64'));
      console.log(`    SHOT ${resolve(SHOT_DIR, 'eight-state-trays.png')}`);
    }
    await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/docs/component-catalog.html` }, sessionId);
    await until("!!document.querySelector('[data-component=\"folding-tray\"]')", 'catalog Folding Tray card');
    await evaluate(`document.querySelector('[data-component="folding-tray"]').click(); true`);
    await wait(250);
    const drawer = await evaluate(`(() => ({
      open:document.querySelector('#detail-drawer').getAttribute('aria-hidden')==='false',
      id:document.querySelector('#detail-id').textContent,
      icon:!!document.querySelector('#detail-visual .tray-icon'),
      gallery:document.querySelector('#detail-actions a')?.getAttribute('href'),
    }))()`);
    check(drawer.open && drawer.id === 'folding-tray', 'clicking a catalog card opens its component detail drawer');
    check(drawer.icon, 'Folding Tray detail uses the four-edge component icon');
    check(drawer.gallery === 'tray-gallery.html', 'Folding Tray detail links to the eight-state gallery');
    if (SHOTS) {
      const drawerShot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false }, sessionId);
      writeFileSync(resolve(SHOT_DIR, 'catalog-drawer.png'), Buffer.from(drawerShot.data, 'base64'));
      console.log(`    SHOT ${resolve(SHOT_DIR, 'catalog-drawer.png')}`);
    }
    await evaluate(`document.querySelector('#detail-close').click(); true`);
    check(await evaluate(`document.querySelector('#detail-drawer').getAttribute('aria-hidden')==='true'`), 'detail drawer closes and returns to the catalog');
    await evaluate(`document.querySelector('[data-component="combatant-frame"]').click(); true`);
    check(await evaluate(`document.querySelector('#detail-id').textContent==='combatant-frame'`), 'the same drawer resolves a second component card');
    await evaluate(`document.querySelector('#detail-close').click(); true`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false }, sessionId);
    await cdp.send('Page.navigate', { url: `http://localhost:${server.port}/docs/component-catalog.html` }, sessionId);
    await until("!!document.querySelector('[data-component=\"quick-menu-panel\"]')", 'mobile catalog');
    await evaluate(`document.querySelector('[data-component="quick-menu-panel"]').click(); true`);
    await wait(250);
    const mobileDrawer = await evaluate(`(() => { const rect=document.querySelector('#detail-drawer').getBoundingClientRect(); return { left:rect.left, right:rect.right, width:rect.width, viewport:innerWidth }; })()`);
    check(mobileDrawer.left >= 0 && mobileDrawer.right <= mobileDrawer.viewport + 0.5, 'component detail drawer fits the 390px phone viewport');
  } finally {
    cdp.close();
    await browser.close();
    await new Promise((done) => server.server.close(done));
  }
  console.log(`\n  ${checks - failures} passed, ${failures} failed`);
  if (failures) process.exitCode = 1;
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
