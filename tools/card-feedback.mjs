#!/usr/bin/env node
// Real browser card feedback gate. Debug fixtures control only initial hand,
// resources; trusted input uses the actual dispatch, targeting, and FX path.
// Run both source and --standalone to detect bundled-module initialization bugs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const shotIndex = args.indexOf('--shots');
const OUT = args[shotIndex + 1] && shotIndex >= 0 ? resolve(args[shotIndex + 1]) : (process.env.ASHENSPIRE_CARD_FEEDBACK_OUT ? resolve(process.env.ASHENSPIRE_CARD_FEEDBACK_OUT) : null);
const STANDALONE = args.includes('--standalone');
const DOOR = STANDALONE ? 'standalone' : 'source';
const diagnostics = [];
const browserPath = resolveBrowser(['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']);
if (!browserPath) { console.error('UNAVAILABLE card-feedback: no Chrome/Edge; set CHROME'); process.exit(2); }
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') diagnostics.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled') {
      const text = (message.params.args || []).map(arg => arg.value || arg.description || '').join(' ');
      if (/dispatch rejected|post-dispatch render failed|watchdog forced/i.test(text)) diagnostics.push(text);
    }
    if (!message.id || !pending.has(message.id)) return;
    const pair = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) pair.reject(new Error(message.error.message));
    else pair.resolve(message.result);
  });
  return {
    ready: new Promise((done, fail) => {
      ws.addEventListener('open', done);
      ws.addEventListener('error', fail);
    }),
    send(method, params = {}, sessionId = null) {
      const id = nextId++;
      return new Promise((done, fail) => {
        pending.set(id, { resolve: done, reject: fail });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() { ws.close(); },
  };
}

let checks = 0;
let failures = 0;
function check(condition, message, detail = null) {
  checks += 1;
  if (condition) console.log(`PASS ${message}`);
  else {
    failures += 1;
    console.log(`FAIL ${message}${detail ? ` (${JSON.stringify(detail)})` : ''}`);
  }
}

const server = await serve({ root: ROOT, port: 8596, open: false });
let browser;
try { browser = await launchBrowser({ prefix: 'card-feedback-', browser: browserPath, timeoutMs: 20000, args: ['--disable-background-networking', '--disable-component-update'] }); }
catch (error) {
  server.server.closeAllConnections?.();
  await new Promise(done => server.server.close(done));
  console.error('UNAVAILABLE card-feedback: browser launch failed: ' + error.message);
  process.exit(2);
}
const cdp = connectCdp(browser.wsUrl);
await cdp.ready;
if (OUT) mkdirSync(OUT, { recursive: true });

async function openTarget(shape) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: shape.width, height: shape.height, deviceScaleFactor: 1, mobile: shape.mobile,
  }, sessionId);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: shape.mobile, maxTouchPoints: 5 }, sessionId);
  const evaluate = async (expression) => {
    const reply = await cdp.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    }, sessionId);
    if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text || 'evaluation failed');
    return reply.result.value;
  };
  const until = async (expression, label, timeout = 30000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression).catch(() => false)) return;
      await wait(100);
    }
    throw new Error(`timeout waiting for ${label}`);
  };
  return { targetId, sessionId, evaluate, until };
}

async function trustedClick(page, shape, selector) {
  const point = await page.evaluate(`(async () => {
    const target=document.querySelector(${JSON.stringify(selector)});
    if (!target) return null;
    target.scrollIntoView({behavior:'instant',block:'center',inline:'center'});
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    window.__uniformFoldoutPress=null;
    target.addEventListener('pointerdown', (event) => {
      window.__uniformFoldoutPress={trusted:event.isTrusted,pointerType:event.pointerType};
    }, {once:true,capture:true});
    const rect=target.getBoundingClientRect();
    for (const yf of [0.5,0.25,0.75]) for (const xf of [0.5,0.25,0.75,0.1,0.9]) {
      const x=rect.left+rect.width*xf, y=rect.top+rect.height*yf;
      if (x<0 || y<0 || x>innerWidth || y>innerHeight) continue;
      const hit=document.elementFromPoint(x,y);
      if (hit && (hit===target || target.contains(hit))) return {x,y};
    }
    return {covered:true,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height}};
  })()`);
  if (!point) throw new Error(`missing click target ${selector}`);
  if (point.covered) throw new Error(`no exposed point for ${selector}: ${JSON.stringify(point.rect)}`);
  if (shape.mobile) {
    const touch = { x: point.x, y: point.y, id: 1, radiusX: 8, radiusY: 8, force: 1 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touch] }, page.sessionId);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, page.sessionId);
  } else {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1,
    }, page.sessionId);
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1,
    }, page.sessionId);
  }
  await wait(180);
  const receipt = await page.evaluate('window.__uniformFoldoutPress');
  check(receipt?.trusted === true, `${shape.name}: ${selector} receives trusted ${shape.mobile ? 'touch' : 'mouse'} input`, receipt);
}

try {
for (const width of [1440,390]) for (const mode of ['normal','os','app']) {
  const shape={width,height:width===1440?900:844,mobile:width<500,name:width+' '+mode};
  let page; diagnostics.length=0;
  try {
    page=await openTarget(shape);
    await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:mode==='os'?'reduce':'no-preference'}]},page.sessionId);
    await cdp.send('Page.navigate',{url:server.url+(STANDALONE?'AshenSpire.html':'')+'?shot=combat'},page.sessionId);
    await page.until('!!window.__combat && !!window.__renderCombatForShot','combat fixture');
    if (OUT && mode === 'normal') {
      await wait(1600);
      check(await page.evaluate("[...document.querySelectorAll('.hand .card')].every(card=>card.classList.contains('playing-poker-card'))"),shape.name+': shared playing-card motif');
      const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},page.sessionId);
      writeFileSync(join(OUT,'playing-hand-'+shape.width+'-'+DOOR+'.png'),Buffer.from(shot.data,'base64'));
    }
    const entry=await page.evaluate(`(() => {
      document.body.classList.toggle('reduced-motion', ${mode==='app'});
      const c=window.__combat;
      c.piles.hand=[{instanceId:'qa-feedback',cardId:'dodgeRoll',upgraded:false}];
      c.player.energy=3;c.player.maxStamina=10;c.player.stamina=10;
      window.__flights=[];
      new MutationObserver(records=>{ for(const record of records) for(const el of record.addedNodes) {
        if(el.nodeType===1 && el.matches('.card-ghost')) window.__flights.push({hidden:el.getAttribute('aria-hidden'),inert:el.hasAttribute('inert'),ids:el.querySelectorAll('[id]').length});
      }}).observe(document.body,{childList:true});
      window.__renderCombatForShot();
      const first=!!document.querySelector('.hand .card.card-drawn');
      window.__renderCombatForShot();
      return {first,repeat:!!document.querySelector('.hand .card.card-drawn')};
    })()`);
    check(entry.first===(mode==='normal') && !entry.repeat,shape.name+': draw cue only for new instance and only with motion',entry);
    if (!STANDALONE) {
      const shared = await page.evaluate(`(async () => {
        const {mountHand}=await import('/src/ui/components/hand.js');
        const {animateEvents}=await import('/src/ui/fx.js');
        const registries=window.__combat.registries;
        const host=document.createElement('div');host.className='hand';document.body.append(host);
        const cards=[{inst:{instanceId:'qa-remount',cardId:'dodgeRoll'},affordable:false}];
        let strip=mountHand(host,{registries});strip.render({cards});
        const first=!!host.querySelector('.card-drawn');strip.teardown();
        strip=mountHand(host,{registries});strip.render({cards});
        const remount=!!host.querySelector('.card-drawn');strip.teardown();
        strip=mountHand(host,{registries,animateArrival:true});strip.render({cards});
        const opted=!!host.querySelector('.card-drawn');strip.render({cards});
        const repeat=!!host.querySelector('.card-drawn');strip.teardown();host.remove();
        const layer=document.createElement('div'),anchor=document.createElement('div'),board=document.createElement('div');
        document.body.append(layer,anchor,board);
        const noShake=document.body.classList.contains('no-shake');document.body.classList.remove('no-shake');
        await new Promise(done=>animateEvents([{type:'damageDealt',targetId:'player',amount:20,blocked:0}],{layer,combatEl:board,anchorFor:()=>anchor},done));
        const shake=board.classList.contains('shake');
        document.body.classList.toggle('no-shake',noShake);layer.remove();anchor.remove();board.remove();
        return {first,remount,opted,repeat,shake};
      })()`);
      check(!shared.first&&!shared.remount&&!shared.repeat&&shared.opted===(mode==='normal'),shape.name+': snapshot remount never replays arrival; persistent solo opts in',shared);
      check(shared.shake===(mode==='normal'),shape.name+': heavy-hit shake honors OS and app reduced motion',shared);
    }
    await trustedClick(page,shape,'.hand [data-card-id=dodgeRoll]');
    if(await page.evaluate('!document.querySelector(".dodge-receipt")')) await trustedClick(page,shape,'.hand [data-card-id=dodgeRoll]');
    if(mode==='normal') await trustedClick(page,shape,'.combat .field');
    await page.until('document.querySelector(".pile.spent")?.dataset.cardOutcome==="discard"','discard feedback after play/skip',8000);
    await wait(1300);
    const accepted=await page.evaluate(`({flights:window.__flights,ghosts:document.querySelectorAll('.card-ghost').length,plays:window.__combat.eventLog.filter(e=>e.type==='cardPlayed'&&e.cardInstanceId==='qa-feedback').length,description:document.querySelector('.pile.spent').getAttribute('aria-description'),drawMoving:!!document.querySelector('.card-drawn')})`);
    check(accepted.plays===1,shape.name+': accepted input commits once',accepted);
    check(accepted.flights.length===(mode==='normal'?1:0) && accepted.flights.every(f=>f.hidden==='true'&&f.inert&&f.ids===0),shape.name+': accepted play has one inert ghost, reduced motion has none',accepted);
    check(accepted.ghosts===0 && !accepted.drawMoving && /1 discarded/.test(accepted.description),shape.name+': skip/finish removes motion and retains resolved discard receipt',accepted);
    await page.evaluate(`(() => {const c=window.__combat;c.piles.hand=[{instanceId:'qa-refused',cardId:'dodgeRoll',upgraded:false}];c.player.stamina=0;window.__flights=[];window.__renderCombatForShot();})()`);
    await trustedClick(page,shape,'.hand [data-card-id=dodgeRoll]');
    await trustedClick(page,shape,'.hand [data-card-id=dodgeRoll]');
    const refused=await page.evaluate(`({flights:window.__flights.length,plays:window.__combat.eventLog.filter(e=>e.type==='cardPlayed'&&e.cardInstanceId==='qa-refused').length,hand:window.__combat.piles.hand.some(c=>c.instanceId==='qa-refused')})`);
    check(refused.flights===0&&refused.plays===0&&refused.hand,shape.name+': refused input has no ghost or state change',refused);
    await page.evaluate(`(() => {const c=window.__combat;c.piles.hand=[{instanceId:'qa-exhaust',cardId:'warSurgeon',upgraded:false}];c.player.energy=3;window.__renderCombatForShot();})()`);
    await trustedClick(page,shape,'.hand [data-card-id=warSurgeon]');
    if(await page.evaluate('!window.__combat.eventLog.some(e=>e.type==="cardPlayed"&&e.cardInstanceId==="qa-exhaust")')) await trustedClick(page,shape,'.hand [data-card-id=warSurgeon]');
    if(mode==='normal') await trustedClick(page,shape,'.combat .field');
    await page.until('document.querySelector(".pile.spent")?.dataset.cardOutcome==="exhaust"','exhaust feedback',8000);
    check(await page.evaluate('window.__combat.piles.exhaust.filter(c=>c.instanceId==="qa-exhaust").length===1 && /1 exhausted/.test(document.querySelector(".pile.spent").getAttribute("aria-description"))'),shape.name+': real exhaust outcome remains after skip');
    check(diagnostics.length===0,shape.name+': no runtime, dispatch or watchdog failures',diagnostics);
    if(OUT){const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},page.sessionId);writeFileSync(join(OUT,'feedback-'+shape.name.replaceAll(' ','-')+'-'+DOOR+'.png'),Buffer.from(shot.data,'base64'));}
  } catch(error){check(false,shape.name+': '+error.message,diagnostics);}
  finally {if(page) await cdp.send('Target.closeTarget',{targetId:page.targetId});}
}
} finally {
  await Promise.race([cdp.send('Browser.close').catch(()=>{}),wait(1200)]);
  cdp.close();await browser.close();server.server.closeAllConnections?.();await new Promise(done=>server.server.close(done));
}
console.log('BOUNDARY: actual hand input and card outcome feedback; controlled fixtures, not a full run.');
console.log('card-feedback: '+(checks-failures)+' passed, '+failures+' failed ('+DOOR+')');
process.exitCode=failures?1:0;
