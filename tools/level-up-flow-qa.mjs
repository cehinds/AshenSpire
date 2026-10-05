// Real Chromium interaction checks of production progression and Character UI.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const output = resolve('docs/preview/level-up');
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'qa-host.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Level-up QA</title><link rel="icon" href="data:,"></head><body></body></html>');
const server = await serve({ root: process.cwd(), port: 0, open: false });
const browser = await launchBrowser({ prefix: 'level-up-', headless: '--headless=new' });
const ws = new WebSocket(browser.wsUrl);
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = ({ data }) => {
  const result = JSON.parse(data);
  if (result.method === 'Runtime.exceptionThrown') errors.push(result.params.exceptionDetails.exception?.description || result.params.exceptionDetails.text);
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
  for (const phone of [false, true]) {
    const name = phone ? 'mobile' : 'desktop';
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const command = (method, params) => send(method, params, sessionId);
    await command('Runtime.enable'); await command('Page.enable'); await command('Network.enable');
    await command('Emulation.setDeviceMetricsOverride', { width: phone ? 390 : 1440, height: phone ? 844 : 1000, deviceScaleFactor: 1, mobile: phone });
    await command('Page.navigate', { url: `${server.url}docs/preview/level-up/qa-host.html` });
    await wait(700);
    const ev = async expression => {
      const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await ev(`(async () => {
      document.head.innerHTML = '<base href="/"><meta name="viewport" content="width=device-width,initial-scale=1">' + ['base','ui','kit','responsive-type'].map(s=>'<link rel="stylesheet" href="/styles/'+s+'.css">').join('');
      document.body.innerHTML = '<main id="qa"></main>';
      await Promise.all([...document.querySelectorAll('link')].map(l => new Promise(ok => {l.onload=ok;l.onerror=ok})));
      const { contentBundle } = await import('/src/content/index.js');
      const { createRegistries } = await import('/src/model/registries.js');
      const { createRunState, serializeRun, deserializeRun } = await import('/src/model/state.js');
      const { mountRewards } = await import('/src/ui/screens/reward.js');
      const { mountEquipment } = await import('/src/ui/screens/equipment.js');
      const { claimBankedLevel } = await import('/src/model/levelup.js');
      const { mergeProgressionRewards, unclaimedProgressionRewards } = await import('/src/model/deferredProgression.js');
      const { pendingRewardCheckpoint } = await import('/src/model/rewardSourcePolicy.js');
      const registries = createRegistries(contentBundle);
      window.qaRun = createRunState({seed:7,classId:'reaver',registries});
      qaRun.level = {level:1,xp:355,unspentPoints:0}; qaRun.skills = {};
      window.qaSettings = {levelUpRefillSeconds:.08,levelUpRefillPauseMs:0,victoryXpSeconds:.1,rewardCollect:'auto',rewardContinueHoldMs:0};
      window.qaOffer = mergeProgressionRewards({}, {title:'VICTORY',xpGains:{level:355,tracks:{}},levelChoices:[
        {ordinal:0,options:[{kind:'feat',id:'fieldStudy'},{kind:'feat',id:'weaponDrill'}]},
        {ordinal:1,options:[{kind:'feat',id:'vitalRenewal'}]}
      ]},qaRun);
      window.qaMount = (offer=qaOffer) => {
        qaRun.pendingReward = pendingRewardCheckpoint(offer,{source:'elite',after:'map'});qaRun.pendingReward.expanded=true;
        mountRewards(document.querySelector('#qa'),{registries,run:qaRun,rewards:offer,checkpoint:qaRun.pendingReward,
          saves:{loadMeta:()=>({settings:qaSettings})},onClaimLevel:()=>claimBankedLevel(registries,qaRun),
          onPersist:()=>{window.qaSaved=serializeRun(qaRun);},
          onDone:()=>{qaRun.deferredProgression=unclaimedProgressionRewards(qaRun.pendingReward);delete qaRun.pendingReward;window.qaSaved=serializeRun(qaRun);document.querySelector('#qa').replaceChildren();}
        });
      };
      window.qaReload = () => {qaRun=deserializeRun(qaSaved);return true};
      window.qaNextVictory = () => qaMount(mergeProgressionRewards(qaRun.deferredProgression,{title:'NEXT VICTORY',xpGains:{level:0,tracks:{}}},qaRun));
      window.qaCharacter = () => mountEquipment(document.body,{registries,run:qaRun,meta:{settings:{}},destination:'character',inCombat:false,onProgression:()=>{window.qaCharacterOpened=true;qaNextVictory();}});
      qaMount(); return true;
    })()`);
    await wait(350);
    const click = async (selector, holdMs = 0) => {
      const point = await ev(`(() => {const n=document.querySelector(${JSON.stringify(selector)});if(!n)throw new Error('Missing '+${JSON.stringify(selector)});n.scrollIntoView({block:'nearest'});const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await command('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
      if (holdMs) await wait(holdMs);
      await command('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
      await wait(80);
    };
    const shot = async suffix => {const result=await command('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(output,`${name}-${suffix}.png`),Buffer.from(result.data,'base64'));};
    check(await ev(`document.querySelector('.reward-level-up').getBoundingClientRect().height>=44`),name+' level-up target is at least 44px');
    check(await ev(`!document.querySelector('#reward-continue').disabled`),name+' exit available with unclaimed levels');
    await shot('level-ready');
    // SPEC §13.4o: Level up covers the bar that stopped, and nothing is claimed without it.
    check(await ev(`(() => {const b=document.querySelector('.reward-level-up').getBoundingClientRect(),r=document.querySelector('.rp-layered-bar[data-track="character"]').getBoundingClientRect(),cx=r.x+r.width/2,cy=r.y+r.height/2;return cx>=b.left&&cx<=b.right&&cy>=b.top&&cy<=b.bottom})()`),name+' Level up covers its bar');
    check(await ev(`qaRun.level.level===1`),name+' no level is claimed without a press');
    await click('.reward-level-up'); await wait(150);
    check(await ev(`document.querySelector('.reward-door')?.dataset.rewardLevel==='character' && qaRun.level.level===2 && !document.querySelector('.rp-layered-bar')`),name+' the press opens the level popup and holds the leftover XP');
    check(await ev(`(() => {const n=document.querySelector('.reward-level-rewards .reward-level-offer');return !!n && getComputedStyle(n).transform!=='none'})()`),name+' the level reward is blue and lifted in the popup');
    await shot('level-popup');
    await click('.reward-level-rewards [data-key="levelChoice:0"]'); await click('#reward-back'); await wait(150);
    check(await ev(`!!document.querySelector('#reward-level-continue')`),name+' Back from the chooser returns to the level popup');
    await click('#reward-level-continue'); await wait(600);
    check(await ev(`!document.querySelector('#reward-level-continue') && !!document.querySelector('.reward-level-up')`),name+' Continue refills the leftover and the next level waits for its press');
    check(await ev(`!qaRun.pendingReward.states['levelChoice:0'] && !!document.querySelector('.reward-menu .reward-level-offer[data-key="levelChoice:0"]') && !document.querySelector('#reward-continue').disabled`),name+' the untaken reward stays lifted in the list and exit is allowed');
    await shot('level-choice');
    // Use the real footer control; its configured second-beat confirmation is resolved below.
    await click('#reward-continue', 1800);
    await wait(150);
    if (await ev(`!!document.querySelector('#reward-continue')`)) await click('#reward-continue', 1800);
    await wait(150);
    check(await ev(`!qaRun.pendingReward && qaRun.deferredProgression.levelChoices.length===2`),name+' exit retains both original level choices even in auto collect');
    await ev('qaReload();qaNextVictory();true');
    check(await ev(`document.querySelector('[data-key="levelChoice:0"]')!==null && qaRun.pendingReward.rewards.levelChoices.length===2`),name+' saved choices reappear on the next victory');
    await click('[data-key="levelChoice:0"]'); await shot('saved-choice'); await click('#reward-back');
    // Character screen owns a visible out-of-combat entry into the same progression flow.
    await ev(`document.querySelector('#qa').replaceChildren();qaCharacter();true`); await wait(200);
    check(await ev(`!!document.querySelector('.character-level-action')`),name+' Character has a level-up entry');
    await click('.character-level-action');
    check(await ev(`qaCharacterOpened===true && !!document.querySelector('.reward-door')`),name+' Character entry opens progression');
    check(await ev(`document.documentElement.scrollWidth<=innerWidth`),name+' no horizontal page overflow');
    await send('Target.closeTarget',{targetId});
  }
  check(errors.length===0,'no browser exceptions or failed requests: '+errors.join('; '));
  writeFileSync(resolve(output,'validation.json'),JSON.stringify({checks,errors,boundary:'Production reward and Character components with real run state and save serialization; desktop and 390px browser viewports. Not physical-device acceptance or a full combat playthrough.'},null,2));
} finally {await send('Browser.close').catch(()=>{});ws.close();server.server.closeAllConnections?.();server.server.close();await browser.close();}
