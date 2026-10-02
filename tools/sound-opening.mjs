// Browser regression (review of #1472): a FRESH fight sounds its opening draw
// and the first turn's stinger; mounting a fight without `opening` (what a
// restored save does) replays none of its history. A fresh BOSS fight holds
// those cues while its name splash covers the board and sounds them, once, as
// the splash closes (main.js showBossIntro onClose).
// node tools/sound-opening.mjs   (CHROME picks the browser, tools/browser.mjs)
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const server = await serve({ root, port: 0, open: false });
const url = 'http://localhost:' + server.server.address().port + '/';
const browser = await launchBrowser({ prefix: 'soundopening-', headless: '--headless=new' });
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
let checks = 0;
const check = (held, label) => { checks++; assert.ok(held, label); console.log('PASS ' + label); };
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send('Page.navigate', { url: url + '?shot=combat&shotSeed=SOUND1' }, sessionId);
  await evaluate(`new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(() => {
      if (window.__combat && document.querySelector('.hand .card')) { clearInterval(timer); resolve(true); }
      else if (++attempts > 600) { clearInterval(timer); reject(new Error('Combat failed to mount: ' + document.body.innerText.slice(0, 800))); }
    }, 100);
  })`);
  const fresh = await evaluate(`(async () => (await import('/src/ui/sfx.js')).sfx.recent.slice())()`);
  check(fresh.includes('cardDraw'), `a fresh fight sounds its opening draw (${fresh.join(', ')})`);
  check(fresh.filter((s) => s === 'turnStinger').length === 1, 'a fresh fight stings its first turn once');
  const restored = await evaluate(`(async () => {
    const { sfx } = await import('/src/ui/sfx.js');
    const { mountCombat } = await import('/src/ui/screens/combat.js');
    const { createRunState } = await import('/src/model/state.js');
    const c = window.__combat, r = c.registries;
    const run = createRunState({ seed: 671, classId: 'reaver', registries: r });
    sfx.recent.length = 0;
    mountCombat(document.querySelector('#app'), { registries: r, run, combat: c, meta: { settings: { animationSpeed: 'instant', holdConfirm: 'off' } }, onEnd() {} });
    await new Promise((resolve) => setTimeout(resolve, 300));
    return sfx.recent.slice();
  })()`);
  check(!restored.includes('cardDraw') && !restored.includes('turnStinger'), `a remounted (restored) fight replays no opening cues (${restored.join(', ') || 'silent'})`);
  // A fresh boss fight: silent under the splash, the opening once it lifts.
  await send('Page.navigate', { url: url + '?shot=boss&shotBossHold=0&shotSeed=SOUND1' }, sessionId);
  const underSplash = await evaluate(`new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(async () => {
      if (window.__combat && document.querySelector('.hand .card') && document.querySelector('.boss-intro')) {
        clearInterval(timer);
        resolve((await import('/src/ui/sfx.js')).sfx.recent.slice());
      } else if (++attempts > 600) { clearInterval(timer); reject(new Error('Boss fight + splash never stood together: ' + document.body.innerText.slice(0, 800))); }
    }, 25);
  })`);
  check(!underSplash.includes('cardDraw') && !underSplash.includes('turnStinger'), `the boss splash holds the opening cues (${underSplash.join(', ') || 'silent'})`);
  const afterSplash = await evaluate(`(async () => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await new Promise((resolve) => setTimeout(resolve, 700));
    return { gone: !document.querySelector('.boss-intro'), cues: (await import('/src/ui/sfx.js')).sfx.recent.slice() };
  })()`);
  check(afterSplash.gone, 'the boss splash closes on a key');
  check(afterSplash.cues.includes('cardDraw'), `the opening draw sounds as the splash closes (${afterSplash.cues.join(', ')})`);
  check(afterSplash.cues.filter((s) => s === 'turnStinger').length === 1, 'the boss fight stings its first turn once');
  console.log(`sound-opening: OK — ${checks} checks passed`);
} finally {
  ws.close(); await browser.close();
  server.server.closeAllConnections?.(); await new Promise(resolve => server.server.close(resolve));
}
