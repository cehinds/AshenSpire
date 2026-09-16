#!/usr/bin/env node
// Real browser Dodge regression gate. Debug fixtures control only initial hand,
// resources and the misc die; trusted input uses the actual dispatch and FX path.
// Run both source and --standalone to detect bundled-module initialization bugs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const shotIndex = args.indexOf('--shots');
const OUT = args[shotIndex + 1] && shotIndex >= 0 ? resolve(args[shotIndex + 1]) : (process.env.ASHENSPIRE_DODGE_OUT ? resolve(process.env.ASHENSPIRE_DODGE_OUT) : null);
const STANDALONE = args.includes('--standalone');
const DOOR = STANDALONE ? 'standalone' : 'source';
const diagnostics = [];
const browserPath = resolveBrowser(['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']);
if (!browserPath) { console.error('UNAVAILABLE dodge-outcome: no Chrome/Edge; set CHROME'); process.exit(2); }
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

const server = await serve({ root: ROOT, port: 8588, open: false });
let browser;
try { browser = await launchBrowser({ prefix: 'dodge-outcome-', browser: browserPath, timeoutMs: 20000 }); }
catch (error) {
  server.server.closeAllConnections?.();
  await new Promise(done => server.server.close(done));
  console.error('UNAVAILABLE dodge-outcome: browser launch failed: ' + error.message);
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
for (const width of [1440,390]) for (const reduced of [false,true]) for (const success of [false,true]) {
  const shape = {width,height:width===1440?900:844,mobile:width<500,name:width+' '+(reduced?'reduced':'normal')+' '+(success?'success':'failure')};
  let page;
  diagnostics.length=0;
  try {
    page=await openTarget(shape);
    await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]},page.sessionId);
    await cdp.send('Page.navigate',{url:server.url+(STANDALONE?'AshenSpire.html':'')+'?shot=combat'},page.sessionId);
    await page.until('!!window.__combat && !!window.__renderCombatForShot','combat fixture');
    await page.evaluate(`(() => {
      const c=window.__combat;
      c.piles.hand=[{instanceId:'qa-dodge',cardId:'dodgeRoll',upgraded:false}];
      c.player.energy=3;c.player.maxStamina=10;c.player.stamina=10;
      const int=c.rng.int.bind(c.rng);
      c.rng.int=(stream,min,max)=>stream==='misc'?${success?20:1}:int(stream,min,max);
      window.__dodgeBefore={stamina:c.player.stamina,energy:c.player.energy,mana:c.player.mana,eventCount:c.eventLog.length,discard:c.piles.discard.length};
      window.__renderCombatForShot();
    })()`);
    const card='.hand [data-card-id="dodgeRoll"]';
    await trustedClick(page,shape,card);
    if (await page.evaluate('!document.querySelector(".dodge-receipt") && !!document.querySelector(".hand [data-card-id=dodgeRoll]")')) await trustedClick(page,shape,card);
    await page.until('!!document.querySelector(".dodge-receipt")','Dodge receipt',8000);
    await wait(1500);
    const state=await page.evaluate(`(() => {
      const c=window.__combat,b=window.__dodgeBefore,events=c.eventLog.slice(b.eventCount);
      return {label:document.querySelector('.dodge-receipt').textContent,rolls:events.filter(e=>e.type==='dodgeRolled'),
        plays:events.filter(e=>e.type==='cardPlayed' && e.cardInstanceId==='qa-dodge'),
        spent:events.filter(e=>e.type==='staminaSpent'),stamina:b.stamina-c.player.stamina,energy:b.energy-c.player.energy,mana:b.mana-c.player.mana,
        discarded:c.piles.discard.filter(c=>c.instanceId==='qa-dodge').length,discardDelta:c.piles.discard.length-b.discard,
        hand:c.piles.hand.some(c=>c.instanceId==='qa-dodge'),announcement:document.querySelector('.dodge-announcement')?.textContent};
    })()`);
    check(state.rolls.length===1 && state.rolls[0].success===success,shape.name+': exactly one expected roll',state.rolls);
    check(state.plays.length===1 && state.spent.length===1 && state.stamina===state.plays[0].staminaSpent && state.energy===state.plays[0].energySpent && state.mana===state.plays[0].manaSpent,shape.name+': resources paid exactly once',state);
    check(state.discarded===1 && state.discardDelta===1 && !state.hand,shape.name+': played card enters discard once');
    check(state.label===(success?'Dodge succeeded':'Dodge failed') && /difficulty/.test(state.announcement),shape.name+': persistent outcome and live announcement');
    await trustedClick(page,shape,'.dodge-receipt');
    await page.until('!!document.querySelector("[role=dialog]")','result dialog');
    const dialog=await page.evaluate(`(() => { const el=document.querySelector('[role=dialog]');return {text:el.innerText,named:!!document.getElementById(el.getAttribute('aria-labelledby')),focused:el.contains(document.activeElement),modal:el.getAttribute('aria-modal')};})()`);
    check(dialog.named && dialog.focused && dialog.modal==='true' && /difficulty/.test(dialog.text) && /base guard/.test(dialog.text),shape.name+': accessible detailed result',dialog);
    if (OUT) { const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},page.sessionId);writeFileSync(join(OUT,'dodge-'+shape.name.replaceAll(' ','-')+'-'+DOOR+'.png'),Buffer.from(shot.data,'base64')); }
    await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},page.sessionId);
    await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},page.sessionId);
    check(await page.evaluate('!document.querySelector("[role=dialog]") && document.activeElement===document.querySelector(".dodge-receipt")'),shape.name+': Escape restores receipt focus');
    check(diagnostics.length===0,shape.name+': no runtime or dispatch failures',diagnostics);
  } catch(error) { check(false,shape.name+': '+error.message,diagnostics); }
  finally { if(page) await cdp.send('Target.closeTarget',{targetId:page.targetId}); }
}
} finally {
  cdp.close();await browser.close();server.server.closeAllConnections?.();await new Promise(done=>server.server.close(done));
}
console.log('BOUNDARY: controlled Dodge fixtures at desktop/phone and OS motion preferences; not a full run or balance test.');
console.log('dodge-outcome: '+(checks-failures)+' passed, '+failures+' failed ('+DOOR+')');
process.exitCode=failures?1:0;
