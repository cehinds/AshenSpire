import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { combatRules } from '../src/content/combatRules.js';
import { createFoundation } from '../src/engine/combatRules.js';
const out = resolve('artifacts/combat-foundations'); mkdirSync(out, { recursive: true });
const server = await serve({ root: resolve('.'), port: 8618, open: false });
const browser = await launchBrowser({ prefix: 'combat-foundations-', browser: resolveBrowser(['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']) });
const ws = new WebSocket(browser.wsUrl), pending = new Map(), errors = []; let serial = 0;
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) console.log('BROWSER', msg.params.type, msg.params.args.map((a) => a.value || a.description).join(' '));
  const pair = pending.get(msg.id); if (!pair) return;
  pending.delete(msg.id); if (msg.error) pair.reject(new Error(msg.error.message)); else pair.resolve(msg.result);
});
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
let checks = 0;
const check = (ok, text) => { if (!ok) throw new Error(text); checks++; console.log(`PASS ${text}`); };
try {
  for (const shape of [{ name: 'desktop', width: 1365, height: 1000, mobile: false }, { name: 'phone', width: 390, height: 844, mobile: true }]) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId); await send('Runtime.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width: shape.width, height: shape.height, mobile: shape.mobile, deviceScaleFactor: 1 }, sessionId);
    await send('Emulation.setTouchEmulationEnabled', { enabled: shape.mobile }, sessionId);
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: shape.mobile ? 'reduce' : 'no-preference' }] }, sessionId);
    const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
    const click = async (selector) => {
      const point = await evaluate(`(async()=>{const el=document.querySelector(${JSON.stringify(selector)});el.scrollIntoView({block:'center'});await new Promise(r=>requestAnimationFrame(r));const b=el.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};})()`);
      if (shape.mobile) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] }, sessionId); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId); }
      else { await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 }, sessionId); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 }, sessionId); }
      await wait(100);
    };
    await send('Page.navigate', { url: `${server.url}tests/combat-prototypes.html` }, sessionId);
    for (let i = 0; i < 150 && !(await evaluate('document.querySelectorAll(".card").length===5')); i++) await wait(100);
    check(await evaluate('document.querySelectorAll(".card").length===5'), `${shape.name}: real hand loads`);
    check(await evaluate('[...document.images].every(i=>i.complete&&i.naturalWidth>0)'), `${shape.name}: original class sprite loads`);
    await click('[data-card-id="prototypePhysicalStance"]');
    check(await evaluate('!!document.querySelector(".actor.active")'), `${shape.name}: stance pose and persistent glow activate`);
    check(await evaluate('document.querySelector(".actor img").src.includes("guard")'), `${shape.name}: stance uses an authored guard pose`);
    await click('#end');
    check(await evaluate('!!document.querySelector("[data-card-id=dodgeRoll]")'), `${shape.name}: Dodge retains through end turn`);
    check(await evaluate('!!document.querySelector(".actor.active")'), `${shape.name}: stance persists into next turn`);
    await click('[data-card-id="dodgeRoll"]');
    check(await evaluate('document.querySelector(".stats").textContent.includes("Evade 1")'), `${shape.name}: pointer input activates deterministic Evade`);
    await click('#end');
    check(await evaluate('document.querySelector("#receipt").textContent.includes("evaded")'), `${shape.name}: enemy hit consumes Evade`);
    check(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `${shape.name}: no horizontal overflow`);
    check(await evaluate('!document.querySelector("#error").textContent'), `${shape.name}: no action errors`);
    check(await evaluate('![...document.querySelectorAll(".card")].some(c=>/\{[^}]+\}/.test(c.textContent))'), `${shape.name}: all card values resolve`);
    await evaluate('scrollTo(0,0)');
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
    writeFileSync(resolve(out, `${shape.name}.png`), Buffer.from(shot.data, 'base64'));
    // The same boot/play path for both remaining build presets.
    for (const build of ['bleed', 'caster']) {
      await evaluate(`document.querySelector('#build').value=${JSON.stringify(build)}`);
      await click('#setup button'); await click('#suggest');
      check(await evaluate('!document.querySelector("#error").textContent && document.querySelector("#receipt").textContent!=="Choose an enemy, then play a card."'), `${shape.name}: ${build} preset plays through real dispatch`);
    }
    // Exercise the bundled adapter too: source ESM can hide CommonJS cycle bugs.
    await send('Page.navigate', { url: `${server.url}AshenSpire.html?shot=combat` }, sessionId);
    for (let i = 0; i < 300 && !(await evaluate('!!window.__combat && !!window.__renderCombatForShot')); i++) await wait(100);
    check(await evaluate('!!window.__combat && !!window.__renderCombatForShot'), `${shape.name}: standalone combat boots`);
    const foundation = createFoundation(combatRules, { player: { weightClass: 'light' } });
    await evaluate(`(()=>{const c=window.__combat;c.foundation=${JSON.stringify(foundation)};c.piles.hand=[{instanceId:'foundation-dodge',cardId:'dodgeRoll',upgraded:false}];c.player.stamina=10;c.player.maxStamina=10;c.player.energy=3;window.__renderCombatForShot();})()`);
    await wait(500);
    // Current card input selects first, then confirms a double tap.
    for (let i = 0; i < 3 && !(await evaluate('window.__combat.player.evade===1')); i++) await click('.hand [data-card-id="dodgeRoll"]');
    for (let i = 0; i < 50 && !(await evaluate('window.__combat.player.evade===1')); i++) await wait(100);
    const receipt = await evaluate('({evade:window.__combat.player.evade, stamina:window.__combat.player.stamina, energy:window.__combat.player.energy, hand:window.__combat.piles.hand, events:window.__combat.eventLog.slice(-8),errors:document.querySelector(".toast")?.textContent})');
    check(receipt.evade === 1 && receipt.stamina === 9 && receipt.energy === 3, `${shape.name}: bundled new-rules Dodge executes atomically through real input: ${JSON.stringify(receipt)}`);
    await send('Target.closeTarget', { targetId });
  }
  check(errors.length === 0, `no browser exceptions: ${errors.join('; ')}`);
} finally {
  await Promise.race([send('Browser.close').catch(() => {}), wait(1200)]);
  ws.close(); await browser.close(); server.server.closeAllConnections?.(); await new Promise((done) => server.server.close(done));
}
console.log(`${checks} browser checks passed. Controlled workshop, not a production run.`);
