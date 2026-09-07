#!/usr/bin/env node
// Trusted desktop/phone HUD menu checks. Source or --standalone; controlled
// combat fixture. Checks reach, inert selection, pile tabs and lawful art access.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.env.ASHENSPIRE_HUD_OUT || join(ROOT, 'outputs', 'combat-hud-menus'));
const STANDALONE = process.argv.includes('--standalone');
const APP_PATH = STANDALONE ? '/AshenSpire.html' : '/';
const DOOR = STANDALONE ? 'standalone' : 'source';
const SHAPES = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];
const browserPath = resolveBrowser([
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]);

if (!browserPath) {
  console.error('combat-hud-menus: no Chrome/Edge found; set CHROME');
  process.exit(2);
}

const diagnostics = [];
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') diagnostics.push(message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled') {
      const text = (message.params.args || []).map(arg=>arg.value || arg.description || '').join(' ');
      if (/dispatch rejected|render failed|watchdog forced/i.test(text)) diagnostics.push(text);
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
  if (condition) console.log(`PASS ${message}${detail ? ` (${JSON.stringify(detail)})` : ''}`);
  else {
    failures += 1;
    console.log(`FAIL ${message}${detail ? ` (${JSON.stringify(detail)})` : ''}`);
  }
}

const server = await serve({ root: ROOT, port: 8594, open: false });
const browser = await launchBrowser({ prefix: 'combat-hud-menus-', browser: browserPath, args: ['--disable-background-networking', '--disable-component-update'], timeoutMs: 20000 });
const cdp = connectCdp(browser.wsUrl);
await cdp.ready;
mkdirSync(OUT, { recursive: true });

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

async function screenshot(page, shape, selector, name) {
  await page.evaluate(`(async () => {
    const target=document.querySelector(${JSON.stringify(selector)});
    target?.scrollIntoView({behavior:'instant',block:'center',inline:'center'});
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  })()`);
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: false,
  }, page.sessionId);
  const path = join(OUT, `${name}-${shape.name}-${DOOR}.png`);
  writeFileSync(path, Buffer.from(shot.data, 'base64'));
  console.log(`SHOT ${path}`);
}


try {
for(const shape of SHAPES) {
 const page=await openTarget(shape);
 await cdp.send('Page.navigate',{url:server.url+(STANDALONE?'AshenSpire.html':'')+'?shot=combat'},page.sessionId);
 await page.until('!!window.__combat && !!document.querySelector(".combat-potions")','combat');
 const geom=await page.evaluate(`[...document.querySelectorAll('.combat-action-row > button')].map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent,width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom};})`);
 check(geom.length===5 && geom.every(r=>r.width>=43.5&&r.height>=43.5&&r.left>=0&&r.right<=shape.width&&r.bottom<=shape.height&&Math.abs(r.top-geom[0].top)<2),shape.name+': five reachable 44px action buttons',geom);
 check(await page.evaluate('document.querySelector(".combat-action-row").lastElementChild.matches(".combat-potions")'),shape.name+': potions far right');
 await screenshot(page,shape,'.combat-action-row','hud');
 await trustedClick(page,shape,'.pile.spent');
 check(await page.evaluate('document.querySelector(".spent-pile-modal [role=tab][aria-selected=true]").dataset.modalTab==="discard"'),shape.name+': starts in discard');
 await trustedClick(page,shape,'.spent-pile-modal [data-modal-tab=exhaust]');
 check(await page.evaluate('document.querySelector(".spent-pile-modal [role=tab][aria-selected=true]").dataset.modalTab==="exhaust"'),shape.name+': exhaust separate');
 await screenshot(page,shape,'.spent-pile-modal','piles');
 await trustedClick(page,shape,'.spent-pile-modal .modal-close');
 check(await page.evaluate('document.activeElement===document.querySelector(".pile.spent")'),shape.name+': pile focus returns');
 const before=await page.evaluate('JSON.stringify({charges:window.__combat.player.flaskCharges,flasks:window.__combat.player.flasks})');
 await trustedClick(page,shape,'.combat-potions');
 check(await page.evaluate('document.querySelectorAll(".combat-potion-menu .as-option").length>=2'),shape.name+': health and mana entries');
 await screenshot(page,shape,'.combat-potion-menu','potions');
 await trustedClick(page,shape,'.combat-potion-menu .as-option');
 check(await page.evaluate('!!document.querySelector(".flask-action-menu")'),shape.name+': selection opens actions');
 check((await page.evaluate('JSON.stringify({charges:window.__combat.player.flaskCharges,flasks:window.__combat.player.flasks})'))===before,shape.name+': selection spends nothing');
 await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},page.sessionId);
 await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},page.sessionId);
 // Shortcut opens an action menu, never consumes a charge.
 await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'f',code:'KeyF',windowsVirtualKeyCode:70},page.sessionId);
 await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'f',code:'KeyF',windowsVirtualKeyCode:70},page.sessionId);
 check(await page.evaluate('!!document.querySelector(".flask-action-menu")'),shape.name+': health shortcut opens actions');
 check((await page.evaluate('JSON.stringify({charges:window.__combat.player.flaskCharges,flasks:window.__combat.player.flasks})'))===before,shape.name+': shortcut spends nothing');
 await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},page.sessionId);
 await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},page.sessionId);
 await page.evaluate('window.__combat.player.flasks=[{flaskId:"blightCoating"}];window.__renderCombatForShot()');
 await trustedClick(page,shape,'.combat-potions');
 await trustedClick(page,shape,'.combat-potion-menu .as-option:last-child');
 await trustedClick(page,shape,'[data-flask-action=use]');
 // Targeted Use enters aim; it cannot spend until a target is confirmed.
 if (await page.evaluate('!!document.querySelector(".confirmation-modal .primary")')) await trustedClick(page,shape,'.confirmation-modal .primary');
 await wait(800);
 check(await page.evaluate('window.__combat.player.flasks.length===1'),shape.name+': targeting has not consumed potion');
 await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},page.sessionId);
 await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},page.sessionId);
 check(await page.evaluate('window.__combat.player.flasks.length===1 && !document.querySelector(".combatant.aiming")'),shape.name+': cancel potion targeting without spending');
 // Health and mana consumption use the real confirmation/action path.
 for (const [kind,index] of [['hp',1],['mana',2]]) {
   await page.evaluate(`(() => {const p=window.__combat.player;p.hp=10;p.maxMana=20;p.mana=0;p.flaskCharges.${kind}Current=2;window.__hudUseBefore={hp:p.hp,mana:p.mana,events:window.__combat.eventLog.length};window.__renderCombatForShot();})()`);
   await trustedClick(page,shape,'.combat-potions');
   await trustedClick(page,shape,'.combat-potion-menu .as-option:nth-child('+index+')');
   await trustedClick(page,shape,'[data-flask-action=use]');
   if(await page.evaluate('!!document.querySelector(".confirmation-modal .primary")')) await trustedClick(page,shape,'.confirmation-modal .primary');
 await wait(800);
   await wait(1800);
   const used=await page.evaluate(`({hp:window.__combat.player.hp,mana:window.__combat.player.mana,charges:window.__combat.player.flaskCharges.${kind}Current,before:window.__hudUseBefore,events:window.__combat.eventLog.slice(window.__hudUseBefore.events).filter(e=>e.type==='flaskUsed').length})`);
   check(used.charges===1&&used.events===1&&(kind==='hp'?used.hp>used.before.hp:used.mana>used.before.mana),shape.name+': '+kind+' restores pool and spends one charge',used);
 }
 await page.evaluate('window.__combat.player.flaskCharges.hpCurrent=0;window.__renderCombatForShot()');
 await trustedClick(page,shape,'.combat-potions');
 await trustedClick(page,shape,'.combat-potion-menu .as-option:first-child');
 check(await page.evaluate('document.querySelector("[data-flask-action=use]").getAttribute("aria-disabled")==="true"'),shape.name+': zero charge Use disabled');
 await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},page.sessionId);
 await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},page.sessionId);
 await page.evaluate(`(() => {const run=window.__combatRunForShot,c=window.__combat;const art={instanceId:'qa-art',cardId:'quickCut',equipmentRole:'weaponArt',upgraded:false};run.deck.push(art,{...art,instanceId:'qa-art-draw'});c.piles.hand.push({...art});c.piles.draw.push({...art,instanceId:'qa-art-draw'});c.player.energy=20;c.player.mana=20;c.player.stamina=20;window.__renderCombatForShot();})()`);
 await trustedClick(page,shape,'.combat-arts');
 check(await page.evaluate('!!document.querySelector(".combat-art-menu")'),shape.name+': arts menu');
 await screenshot(page,shape,'.combat-art-menu','arts');
 check(await page.evaluate('![...document.querySelectorAll(".choose-weapon-art:not([disabled])")].some(el=>!window.__combat.piles.hand.some(card=>card.instanceId===el.dataset.instanceId))'),shape.name+': only hand arts selectable');
 const art=await page.evaluate('document.querySelector(".choose-weapon-art[data-instance-id=qa-art]:not([disabled])")?.dataset.instanceId || null');
 check(!!art,shape.name+': fixture contains a weaponArt role in hand');
 const plays=await page.evaluate('window.__combat.eventLog.filter(e=>e.type==="cardPlayed").length');
 if(art) {
   await trustedClick(page,shape,'.choose-weapon-art[data-instance-id=qa-art]:not([disabled])');
   check(await page.evaluate('!document.querySelector(".combat-art-menu")'),shape.name+': art uses existing hand selection');
   // Synthetic selection arms self cards. Cancel must leave card and costs alone.
   await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},page.sessionId);
   await cdp.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},page.sessionId);
   check((await page.evaluate('window.__combat.eventLog.filter(e=>e.type==="cardPlayed").length'))===plays,shape.name+': cancel art targeting spends nothing');
 } else await trustedClick(page,shape,'.combat-art-menu .modal-close');
 await trustedClick(page,shape,'.combat-arts');
 check(await page.evaluate('document.querySelector(".choose-weapon-art[data-instance-id=qa-art-draw]").disabled'),shape.name+': undrawn weaponArt remains unavailable');
 await trustedClick(page,shape,'.choose-weapon-art[data-instance-id=qa-art]:not([disabled])');
 if(await page.evaluate('window.__combat.piles.hand.some(c=>c.instanceId==="qa-art")')) await trustedClick(page,shape,'.combatant.enemy');
 await wait(2200);
 check(await page.evaluate('window.__combat.eventLog.filter(e=>e.type==="cardPlayed"&&e.cardInstanceId==="qa-art").length===1 && !window.__combat.piles.hand.some(c=>c.instanceId==="qa-art")'),shape.name+': weaponArt commits once through hand targeting');
 check(diagnostics.length===0,shape.name+': no runtime or dispatch failures',diagnostics);
 await cdp.send('Target.closeTarget',{targetId:page.targetId});
}
} catch(error) {check(false,error.stack);}
finally {await Promise.race([cdp.send('Browser.close').catch(() => {}), new Promise(done => setTimeout(done, 1200))]); cdp.close();await browser.close();server.server.closeAllConnections?.();await new Promise(done=>server.server.close(done));}
console.log('combat-hud-menus: '+(checks-failures)+' passed, '+failures+' failed');process.exitCode=failures?1:0;
