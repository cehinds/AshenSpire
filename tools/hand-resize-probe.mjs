// Browser regression: observe real hand width changes without writing styles
// during ResizeObserver delivery. Window errors are captured before app handlers.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const server = await serve({ root, port: 0, open: false });
const url = 'http://localhost:' + server.server.address().port + '/';
const browser = await launchBrowser({ prefix: 'handresize-', headless: '--headless=new' });
const ws = new WebSocket(browser.wsUrl);
const pending = new Map(); let id = 0;
ws.onmessage = event => {
  const message = JSON.parse(event.data), call = pending.get(message.id);
  if (!call) return;
  pending.delete(message.id);
  message.error ? call.reject(new Error(message.error.message)) : call.resolve(message.result);
};
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const call = ++id; pending.set(call, { resolve, reject });
  ws.send(JSON.stringify({ id: call, method, params, ...(sessionId ? { sessionId } : {}) }));
});
try {
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send('Page.enable', {}, sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.handResizeProbe = { deliveries: 0, synchronousWrites: 0, errors: [] };
    addEventListener('error', event => handResizeProbe.errors.push(event.message), true);
    const NativeResizeObserver = ResizeObserver;
    window.ResizeObserver = class extends NativeResizeObserver {
      constructor(callback) { super((entries, observer) => {
        const styles = () => [...document.querySelectorAll('.hand .card')].map(e => e.getAttribute('style')).join('|');
        const before = styles();
        callback(entries, observer);
        handResizeProbe.deliveries++;
        if (before !== styles()) handResizeProbe.synchronousWrites++;
      }); }
    };
  ` }, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send('Page.navigate', { url: url + '?shot=combat&shotSeed=ART1&shotHand=7' }, sessionId);
  await evaluate(`new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      if (document.querySelectorAll('.hand .card').length === 7) { clearInterval(timer); resolve(true); }
      else if (++attempts > 100) { clearInterval(timer); reject(new Error('Combat failed to mount: '+document.body.innerText.slice(0,800))); }
    }, 100);
  })`);
  for (const [width, height] of [[1440,900], [390,844], [884,1326], [1200,730]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, sessionId);
    await evaluate(`(async () => {
      const pause = () => new Promise(r => setTimeout(r, 150));
      const hand = document.querySelector('.hand');
      for (const width of ['88%', '72%', '100%', '']) { hand.style.width = width; await pause(); }
      document.querySelector('.combat-potions').click(); await pause();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await pause();
    })()`);
  }
  const end = await evaluate("(() => { const r = document.querySelector('.end-turn').getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, turn: window.__combat.turn }; })()");
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: end.x, y: end.y, button: 'left', clickCount: 1 }, sessionId);
  await new Promise(resolve => setTimeout(resolve, 1200));
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: end.x, y: end.y, button: 'left', clickCount: 1 }, sessionId);
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate('window.__combat.turn > ' + end.turn)) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(await evaluate('window.__combat.turn > ' + end.turn), 'hand redraw must complete');
  const result = await evaluate('handResizeProbe');
  assert(result.deliveries > 8, 'the observer must actually deliver resize notifications');
  assert.equal(result.synchronousWrites, 0, 'hand styles changed inside ResizeObserver delivery');
  assert.deepEqual(result.errors, [], 'browser error events must stay empty');
  console.log(`${result.deliveries} real observer deliveries; resize, modal changes and hand redraw exercised`);
  console.log('hand-resize: OK — 4 checks passed');
} finally {
  ws.close(); await browser.close();
  server.server.closeAllConnections?.(); await new Promise(resolve => server.server.close(resolve));
}
