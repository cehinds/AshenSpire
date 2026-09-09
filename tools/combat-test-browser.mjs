import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
const out = resolve('artifacts/combat-test'); mkdirSync(out, { recursive: true });
const server = await serve({ root: resolve('.'), port: 8625, open: false });
const browser = await launchBrowser({ prefix: 'combat-foundations-', browser: resolveBrowser(['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']) });
const ws = new WebSocket(browser.wsUrl), pending = new Map(), errors = []; let serial = 0;
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    const message = msg.params.args.map((a) => a.value || a.description).join(' ');
    // The normal victory timeline deliberately renders an inert snapshot of
    // the killing card after the engine removes it from all piles.
    if (!message.startsWith('[combat] hand card not previewable (stale snapshot):')) errors.push(message);
    console.log('BROWSER', msg.params.type, message);
  }
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
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sessionId);
    const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const until = async (expression) => { for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await wait(100); } throw new Error(`Timed out: ${expression}; ${await evaluate('document.body.innerText')}`); };
    const click = async (selector) => {
      const point = await evaluate(`(async()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing '+${JSON.stringify(selector)});el.scrollIntoView({block:'center'});await new Promise(r=>requestAnimationFrame(r));const b=el.getBoundingClientRect();for(const fy of [.3,.15,.5,.7,.9])for(const fx of [.5,.1,.2,.3,.7,.9]){const x=b.x+b.width*fx,y=b.y+b.height*fy;if(el.contains(document.elementFromPoint(x,y)))return{x,y};}throw new Error('No reachable point '+${JSON.stringify(selector)});})()`);
      if (shape.mobile) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] }, sessionId); if (selector === '.end-turn') await wait(900); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, sessionId); }
      else { await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 }, sessionId); if (selector === '.end-turn') await wait(900); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 }, sessionId); }
      await wait(150);
    };
    const capture = async (name) => { const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId); writeFileSync(resolve(out, `${shape.name}-${name}.png`), Buffer.from(shot.data, 'base64')); };
    const page = process.argv.includes('--source') ? 'index.html' : 'AshenSpire.html';
    for (const build of ['heavy', 'bleed', 'caster']) {
      await send('Page.navigate', { url: `${server.url}${page}?shot=combat-test&build=${build}` }, sessionId);
      await until('!!document.querySelector("#combat-test-form")');
      check(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `${shape.name}/${build}: setup fits viewport`);
      if (build === 'heavy') await capture('setup');
      const storage = await evaluate('JSON.stringify({...localStorage})');
      await click('.test-start');
      await until('!!window.__combat?.foundation && document.querySelectorAll(".hand .card").length===5');
      check(await evaluate('!!document.querySelector(".enemy-row img")'), `${shape.name}/${build}: authored enemy sprite displayed`);
      const stance = build === 'caster' ? 'prototypeCasterStance' : 'prototypePhysicalStance';
      await click(`[data-card-id="${stance}"]`); await click('.combatant.player');
      await until('!!window.__combat.player.stanceId && !document.querySelector(".end-turn").disabled');
      await wait(600);
      check(await evaluate('!!document.querySelector(".combat-pose-aura")?.dataset.motif'), `${shape.name}/${build}: persistent stance aura`);
      await click('.end-turn'); await until('window.__combat.turn===2 && !document.querySelector(".end-turn").disabled');
      await wait(600);
      check(await evaluate('window.__combat.piles.hand.some(c=>c.cardId==="dodgeRoll") && !!window.__combat.player.stanceId'), `${shape.name}/${build}: Dodge retained and stance persists`);
      await click('[data-card-id="dodgeRoll"]'); await click('.combatant.player');
      await until('window.__combat.player.evade===1 && !document.querySelector(".end-turn").disabled'); await wait(500);
      check(await evaluate('!!document.querySelector(".foundation-evade")'), `${shape.name}/${build}: Evade visible in real HUD`);
      check(await evaluate('document.documentElement.scrollWidth<=innerWidth'), `${shape.name}/${build}: battlefield fits viewport`);
      await capture(build);
      await click('.end-turn'); await until('window.__combat.turn===3 && !document.querySelector(".end-turn").disabled');
      check(await evaluate('window.__combat.eventLog.some(e=>e.type==="attackEvaded")'), `${shape.name}/${build}: incoming hit consumes Evade`);
      check(await evaluate('JSON.stringify({...localStorage})') === storage, `${shape.name}/${build}: durable storage unchanged`);
      // Exercise actual victory/continuation controls with a near-death enemy
      // fixture. Combat and damage still commit through the normal hand input.
      if (build === 'heavy') {
        await evaluate('window.__combat.enemies[0].hp=1');
        const attack = await evaluate('window.__combat.piles.hand.find(c=>window.__combat.registries.cards.get(c.cardId).effects.some(e=>e.op==="damage"))?.cardId');
        if (!attack) throw new Error('Expected a drawn attack for continuation fixture');
        await click(`[data-card-id="${attack}"]`); await click('.combatant.enemy');
        await until('!!document.querySelector("#test-next")');
        const carry = await evaluate('({hp:window.__combat.player.hp,stamina:window.__combat.player.stamina,mana:window.__combat.player.mana})');
        await click('#test-next'); await until('!!document.querySelector(".combat") && window.__combat.enemies[0].enemyId==="prototype_armored"');
        check(await evaluate(`['hp','stamina','mana'].every(k=>window.__combat.player[k]===${JSON.stringify(carry)}[k])`), `${shape.name}: next real battlefield preserves all resource pools`);
      }
    }
    await send('Target.closeTarget', { targetId });
  }
  check(errors.length === 0, `no browser exceptions: ${errors.join('; ')}`);
} finally {
  await Promise.race([send('Browser.close').catch(() => {}), wait(1200)]); ws.close(); await browser.close();
  server.server.closeAllConnections?.(); await new Promise((done) => server.server.close(done));
}
console.log(`${checks} game test-build browser checks passed. Route continuation uses an explicit low-HP fixture; this is not a full-run balance test.`);
