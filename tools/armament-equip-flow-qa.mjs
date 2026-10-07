// Real Chromium pointer/touch checks of the production Armoury.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const output = resolve('docs/preview/armament-equip');
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'qa-host.html'), '<!doctype html><html lang="en"><head><base href="/"><meta charset="utf-8"><title>Armament equip QA host</title><link rel="icon" href="data:,"></head><body></body></html>');
const server = await serve({ root: process.cwd(), port: 0, open: false });
const browser = await launchBrowser({ prefix: 'armament-equip-', headless: '--headless=new' });
const ws = new WebSocket(browser.wsUrl);
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = ({ data }) => {
  const result = JSON.parse(data);
  if (result.method === 'Runtime.exceptionThrown') errors.push(result.params.exceptionDetails.exception?.description || result.params.exceptionDetails.text);
  if (result.method === 'Runtime.consoleAPICalled' && result.params.type === 'error') errors.push(result.params.args.map(arg => arg.value || arg.description || '').join(' '));
  if (result.method === 'Network.responseReceived' && result.params.response.status >= 400) errors.push(`${result.params.response.status} ${result.params.response.url}`);
  if (!pending.has(result.id)) return;
  const { yes, no } = pending.get(result.id); pending.delete(result.id);
  result.error ? no(new Error(result.error.message)) : yes(result.result);
};
await new Promise((yes, no) => { ws.onopen = yes; ws.onerror = no; });
const send = (method, params = {}, sessionId) => new Promise((yes, no) => {
  const next = ++id; pending.set(next, { yes, no }); ws.send(JSON.stringify({ id: next, method, params, ...(sessionId ? { sessionId } : {}) }));
});
let checks = 0;
const check = (ok, message) => { assert.ok(ok, message); checks++; console.log(`PASS ${message}`); };
const wait = ms => new Promise(yes => setTimeout(yes, ms));
try {
  for (const phone of process.argv.includes('--mobile-only') ? [true] : [false, true]) {
    const name = phone ? 'mobile' : 'desktop';
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const command = (method, params) => send(method, params, sessionId);
    await command('Runtime.enable'); await command('Page.enable'); await command('Network.enable');
    await command('Emulation.setDeviceMetricsOverride', { width: phone ? 390 : 1440, height: phone ? 844 : 1000, deviceScaleFactor: 1, mobile: phone });
    if (phone) await command('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await command('Page.navigate', { url: `${server.url}docs/preview/armament-equip/qa-host.html` });
    await wait(450);
    const ev = async expression => {
      const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await ev(`(async () => {
      document.head.innerHTML = '<base href="/"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,">' + ['base','ui','kit','responsive-type'].map(s=>'<link rel="stylesheet" href="/styles/'+s+'.css">').join('');
      document.body.innerHTML = '';
      await Promise.all([...document.querySelectorAll('link[rel="stylesheet"]')].map(l => new Promise(ok => {l.onload=ok;l.onerror=ok})));
      const { contentBundle } = await import('/src/content/index.js');
      const { createRegistries } = await import('/src/model/registries.js');
      const { createRunState } = await import('/src/model/state.js');
      const { mountEquipment, resetArmouryTraySession } = await import('/src/ui/screens/equipment.js');
      const registries = createRegistries(contentBundle);
      window.qaRegistries = registries;
      window.qaRun = createRunState({seed:7,classId:'reaver',registries});
      qaRun.loadout.storage.push('dagger','greatsword');
      Object.keys(qaRun.attributes).forEach(key=>qaRun.attributes[key]=25);
      window.qaMeta = {settings:{equipView:'rack',armouryArmamentView:'list',holdConfirmMs:400},unlocked:['rack2Right','rack2Left']};
      window.qaMount = (destination='equipment',combat=false,onEquip=null) => {
        window.qaEditor?.close(); resetArmouryTraySession();
        qaMeta.settings.equipView = destination === 'inventory' ? 'hybrid' : 'rack';
        return window.qaEditor = mountEquipment(document.body,{registries,run:qaRun,meta:qaMeta,destination:destination==='inventory'?'':destination,inCombat:combat,onEquip,onChange:()=>{},onClose:()=>{}});
      };
      qaMount(); return true;
    })()`);
    await wait(500);
    const click = async (selector, duration = 0) => {
      await ev(`new Promise(resolve => {document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'nearest',behavior:'instant'});requestAnimationFrame(()=>requestAnimationFrame(resolve));})`);
      const point = await ev(`(() => {
        const n=document.querySelector(${JSON.stringify(selector)}); if(!n) throw new Error('Missing control: '+${JSON.stringify(selector)});
        const r=n.getBoundingClientRect();
        let left=Math.max(0,r.left),right=Math.min(innerWidth,r.right),top=Math.max(0,r.top),bottom=Math.min(innerHeight,r.bottom);
        for(let a=n.parentElement;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowY)){top=Math.max(top,b.top);bottom=Math.min(bottom,b.bottom)}if(/auto|scroll|hidden|clip/.test(s.overflowX)){left=Math.max(left,b.left);right=Math.min(right,b.right)}}
        const p={x:(left+right)/2,y:(top+bottom)/2};
        if(right<=left||bottom<=top||!n.contains(document.elementFromPoint(p.x,p.y))) throw new Error('Control is obscured: '+${JSON.stringify(selector)});
        return p;
      })()`);
      if (phone) {
        await command('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        if (duration) await wait(duration);
        await command('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await command('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
        if (duration) await wait(duration);
        await command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
      }
      await wait(phone ? 350 : 80);
    };
    const shot = async suffix => {
      await command('Input.dispatchMouseEvent', {type:'mouseMoved',x:10,y:10});
      await wait(250);
      await ev(`Promise.race([Promise.all([...document.images].map(image => image.decode().catch(() => {}))), new Promise(resolve => setTimeout(resolve, 2000))])`);
      const result = await command('Page.captureScreenshot', { format: 'png' });
      writeFileSync(resolve(output, `${name}-${suffix}.png`), Buffer.from(result.data, 'base64'));
    };
    const original = await ev('JSON.stringify(qaRun.loadout)');
    await shot('armaments');
    check(await ev(`(() => {const empty=document.querySelector('[data-slot-position="rightHand:1"]'),locked=document.querySelector('[data-slot-position="rightHand:2"]');return empty.getBoundingClientRect().height<130&&locked.getBoundingClientRect().height<80&&!empty.textContent.includes('Select or drop')&&locked.textContent.includes('Win');})()`), name + ' empty and locked positions remain compact with visible unlock requirement');
    check(await ev(`(() => {const row=document.querySelector('[data-slot-position="rightHand:0"]');const thumb=row.querySelector('.armament-card-thumbnail');const card=thumb.querySelector('.equipment-poker-card');const a=thumb.getBoundingClientRect(),b=card.getBoundingClientRect();return row.querySelector('.armament-inspect')&&row.querySelector('.armament-position-name').textContent==='Straight Sword'&&Math.abs(a.width-b.width)<1&&Math.abs(a.height-b.height)<2;})()`), name + ' compact row uses complete scaled card thumbnail and explicit controls');
    await click('[data-slot-position="rightHand:0"] .armament-inspect');
    check(await ev(`document.querySelector('.armament-list-inspection .equipment-poker-card')?.dataset.item==='straightSword'`) && await ev('JSON.stringify(qaRun.loadout)')===original, name + ' Inspect opens complete selected equipment card without mutation');
    await shot('inspect');
    if(phone){check(await ev(`document.querySelector('.armament-inspection-back').getBoundingClientRect().height>=48`),name+' inspection Back meets touch floor');await click('.armament-inspection-back');check(await ev(`document.querySelector('[data-slot-position="rightHand:0"] .armament-inspect').getBoundingClientRect().height>=48`),name+' inspection Back returns to compact list');}
    await click('[data-slot-position="leftHand:1"] .armament-activate');
    check(await ev(`qaRun.loadout.active.leftHand === 1 && qaRun.loadout.sets.leftHand[1] === null`), name + ' an empty reserve can explicitly become active');
    await click('[data-slot-position="leftHand:0"] .armament-activate');
    await click('[data-slot-position="rightHand:1"] .armament-replace');
    check(await ev('JSON.stringify(qaRun.loadout)') === original, name + ' choosing an empty reserve does not activate or change it');
    await click('[data-face="armament:dagger"]');
    check(await ev('JSON.stringify(qaRun.loadout)') === original && await ev(`document.querySelector('[data-face="armament:dagger"]').getAttribute('aria-expanded') === 'true'`), name + ' first item tap opens inspection without equipping');
    await click('[data-face="armament:dagger"]', 700);
    check(await ev('JSON.stringify(qaRun.loadout)') === original, name + ' holding an item does not equip it');
    if (await ev(`!document.querySelector('.armoury-foot-action')`)) await click('[data-face="armament:dagger"]');
    check(await ev(`document.querySelector('.armoury-foot-action').textContent.includes('Main Hand · 2')`), name + ' explicit action names reserve destination');
    await shot('replace');
    await click('.armoury-foot-action');
    check(await ev(`qaRun.loadout.sets.rightHand[1] === 'dagger' && qaRun.loadout.active.rightHand === 0`), name + ' equipping reserve leaves active sword unchanged');
    await click('[data-slot-position="rightHand:1"] .armament-activate');
    check(await ev('qaRun.loadout.active.rightHand === 1'), name + ' separate Make active switches set');
    await click('[data-slot-position="rightHand:1"] .armament-unequip');
    check(await ev(`qaRun.loadout.sets.rightHand[1] === null && qaRun.loadout.storage.includes('dagger')`), name + ' direct Unequip returns item to inventory');
    await ev(`qaMount('inventory'); true`);
    await click('[data-face="armament:dagger"]');
    check(await ev(`!document.querySelector('.armoury-foot-action') && document.querySelector('[data-face="armament:dagger"]').getAttribute('aria-expanded') === 'true'`), name + ' first inventory tap opens destinations without silently choosing a hand');
    await shot('choose-destination');
    await click('.inventory-detail:not([hidden]) [data-destination-slot="leftHand"][data-destination-index="0"]');
    check(await ev(`qaRun.loadout.sets.leftHand[0] === 'roundShield'`), name + ' choosing destination alone preserves occupant');
    await click('.armoury-foot-action');
    check(await ev(`qaRun.loadout.sets.leftHand[0] === 'dagger' && qaRun.loadout.storage.includes('roundShield')`), name + ' explicit replacement stores previous shield');
    check(await ev(`document.querySelector('.armoury').textContent.includes('Dagger equipped in Off Hand')`), name + ' success names item and destination');
    await ev(`Object.keys(qaRun.attributes).forEach(key=>qaRun.attributes[key]=0); qaMount('inventory'); true`);
    await click('[data-face="armament:greatsword"]');
    await click('.inventory-detail:not([hidden]) [data-destination-slot="rightHand"][data-destination-index="1"]');
    check(await ev(`document.querySelector('.armoury-foot-action').disabled`), name + ' unmet equipment requirements disable action');
    check(await ev(`qaRun.loadout.sets.leftHand[0] === 'dagger'`), name + ' blocked action leaves opposite hand intact');
    await shot('blocked');
    const layout = await ev(`(() => ({ overflow:document.documentElement.scrollWidth > innerWidth, small:[...document.querySelectorAll('.armament-position-actions button,.armament-destination,.armoury-foot-action')].filter(n=>n.getClientRects().length).filter(n=>{const r=n.getBoundingClientRect();return r.width<${phone ? 47.5 : 43.5}||r.height<${phone ? 47.5 : 43.5}}).map(n=>n.textContent) }))()`);
    check(!layout.overflow, name + ' no horizontal page overflow');
    check(!layout.small.length, name + ' controls meet tap target floor: ' + JSON.stringify(layout.small));
    await ev(`Object.keys(qaRun.attributes).forEach(key=>qaRun.attributes[key]=25); qaMount('equipment'); true`);
    await ev(`qaRun.loadout.storage = qaRegistries.equipment.armaments.map(a=>a.id).filter(id=>!['straightSword','dagger'].includes(id)).slice(0,qaRegistries.balance.equipment.storageSlots); qaMount(); true`);
    check(await ev(`document.querySelector('[data-slot-position="rightHand:0"] .armament-unequip').disabled && !!document.querySelector('[data-slot-position="rightHand:0"] .armament-action-reason')?.textContent.trim()`), name + ' full storage disables Unequip with visible reason');
    await ev(`qaRun.loadout.storage=[]; window.qaCombatCalls=[]; qaMount('equipment',true,(...args)=>{qaCombatCalls.push(args);return 'Not enough actions.'}); true`);
    const combatBefore=await ev('JSON.stringify(qaRun.loadout)');
    await click('[data-slot-position="rightHand:0"] .armament-unequip');
    check(await ev(`qaCombatCalls.length===1 && document.querySelector('.armoury').textContent.includes('Not enough actions.')`) && await ev('JSON.stringify(qaRun.loadout)')===combatBefore, name + ' combat action routes to priced callback and preserves refused loadout');
    await ev(`qaMount(); document.documentElement.style.setProperty('--ui-zoom','.65'); true`);
    check(await ev(`[...document.querySelectorAll('.armament-position-actions button')].filter(n=>n.getClientRects().length).every(n=>n.getBoundingClientRect().height>=${phone?47.5:43.5})`), name + ' action targets retain physical floor at small zoom');
    await send('Target.closeTarget', { targetId });
  }
  // The authored illustration is an optional local review artifact, not a QA dependency.
  if (existsSync(resolve(output, 'armament-equip-flow.svg'))) {
    const { targetId: illustration } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: illustrationSession } = await send('Target.attachToTarget', { targetId: illustration, flatten: true });
    await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false }, illustrationSession);
    await send('Page.navigate', { url: `${server.url}docs/preview/armament-equip/armament-equip-flow.svg` }, illustrationSession);
    await wait(500);
    const illustrationImage = await send('Page.captureScreenshot', { format: 'png' }, illustrationSession);
    writeFileSync(resolve(output, 'armament-equip-flow.png'), Buffer.from(illustrationImage.data, 'base64'));
    await send('Target.closeTarget', { targetId: illustration });
  }
  writeFileSync(resolve(output, 'validation.json'), JSON.stringify({ behavioralChecks: checks, browserHealthPassed: errors.length === 0, errors, boundary: 'Production Armoury mounted with real content and a deterministic run; desktop mouse and emulated mobile touch. Not a full playthrough or physical device check.' }, null, 2));
  if (errors.length) console.error('Browser health errors:', JSON.stringify(errors));
  check(errors.length === 0, 'no browser exceptions or failed HTTP responses: ' + errors.join('; '));
  console.log(`${checks} checks passed`);
} finally { ws.close(); server.server.closeAllConnections(); await browser.close(); await new Promise(yes => server.server.close(yes)); }
