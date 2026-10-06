// Live map history layout and destination-inspection regression probe.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'docs/qa/map-route-history');
mkdirSync(output, { recursive: true });
const served = await serve({ root, port: 0, open: false });
const browser = await launchBrowser({ prefix: 'route-', browser: resolveBrowser([
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]) });
const socket = new WebSocket(browser.wsUrl);
const pending = new Map();
const errors = [];
const badRequests = [];
let sequence = 0;
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) badRequests.push(message.params.response.url);
  if (!pending.has(message.id)) return;
  const { resolve: done, reject } = pending.get(message.id); pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message)); else done(message.result);
});
await new Promise((done, reject) => { socket.addEventListener('open', done); socket.addEventListener('error', reject); });
const send = (method, params = {}, sessionId) => new Promise((done, reject) => {
  const id = ++sequence; pending.set(id, { resolve: done, reject });
  socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const results = [];
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = (method, params) => send(method, params, sessionId);
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression) => {
    const limit = Date.now() + 60000;
    while (Date.now() < limit) { if (await evaluate(expression)) return; await new Promise((done) => setTimeout(done, 150)); }
    console.error('Browser diagnostics:', JSON.stringify({ errors, badRequests }));
    console.error(await evaluate('document.body.innerText.slice(0, 1400)'));
    throw new Error(`Map did not settle: ${expression}`);
  };
  for (const [name, width, height, walk] of [['entrance', 1600, 900, 0], ['desktop', 1600, 900, 3], ['phone', 390, 844, 3], ['small-phone', 320, 640, 3]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    console.log(`Checking ${name}…`);
    await call('Page.navigate', { url: new URL(`/index.html?shot=map&shotSeed=SHOWCASE${walk ? `&shotWalk=${walk}` : ''}`, served.url).href });
    await waitFor(`document.querySelectorAll('.map-route-node').length > 0 && document.querySelector('.map-canvas')`);
    await evaluate('document.fonts.ready');
    await new Promise((done) => setTimeout(done, 1000));
    const state = await evaluate(`(() => {
      const strip = document.querySelector('.act-route-strip');
      const rect = e => { const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2}; };
      const slots=[...strip.querySelectorAll('.map-route-node')];
      return {title:rect(strip.querySelector('.as-title-s')),rail:rect(strip.querySelector('.map-orientation-rail')),strip:rect(strip),
        slots:slots.map(rect),filled:slots.filter(e=>e.classList.contains('is-visited')).length,
        emptyGlyphs:slots.filter(e=>!e.classList.contains('is-visited')&&e.textContent.trim()).length,
        current:strip.querySelectorAll('.is-current').length,overflow:document.documentElement.scrollWidth>innerWidth};
    })()`);
    assert.equal(state.filled, walk, `${name}: history`);
    assert.equal(state.emptyGlyphs, 0, `${name}: future kinds hidden`);
    assert.equal(state.current, walk ? 1 : 0, `${name}: current position`);
    assert.equal(state.overflow, false, `${name}: document overflow`);
    const deltas = state.slots.slice(1).map((r, i) => r.cx - state.slots[i].cx);
    assert.ok(Math.max(...deltas) - Math.min(...deltas) < 1, `${name}: equal spacing`);
    assert.ok(state.slots.every(r => Math.abs(r.cy - state.rail.cy) < 1 && r.w > 4 && r.x >= state.strip.x && r.x+r.w <= state.strip.x+state.strip.w), `${name}: aligned and contained circles`);
    if (width > 700) assert.ok(Math.abs(state.title.cy - state.rail.cy) < 1, `${name}: one row`);
    const screenshot = await call('Page.captureScreenshot', { format: 'png' });
    writeFileSync(resolve(output, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
    if (name === 'desktop') {
      const point = await evaluate(`(() => { const e=document.querySelector('.map-node.reachable'); if(!e)return null; const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
      assert.ok(point, 'reachable encounter exists');
      await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
      await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
      await waitFor(`document.querySelector('.map-tray')?.dataset.open === 'true'`);
      assert.equal(await evaluate(`document.querySelectorAll('.map-route-node.is-visited').length`), walk, 'previewing a destination does not record travel');
    }
    results.push({ name, width, height, ...state });
    console.log(`PASS ${name}: ${state.filled}/${state.slots.length} visited, evenly spaced and contained`);
  }
  assert.deepEqual(errors, [], 'no browser exceptions');
  assert.deepEqual(badRequests, [], 'no failed HTTP responses');
  writeFileSync(resolve(output, 'results.json'), JSON.stringify({ results, errors, badRequests }, null, 2) + '\n');
} finally {
  socket.close(); await browser.close(); await new Promise((done) => served.server.close(done));
}
