import { artifactLogClassification } from './artifact-health-classification.mjs';
const browserHealth=[]; let qaPhase='before-navigation';
import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const root=process.env.COMBAT_QA_ROOT || 'D:/repos/.codex/worktrees/combat-expansion-runtime/AshenSpire';
const out=process.env.COMBAT_QA_OUTPUT || ('D:/repos/.codex/outputs/combat-card-stances/built-counter-visual-qa-'+process.env.COMBAT_QA_ORDINAL);
if(!process.env.COMBAT_QA_ORDINAL) throw Error('Require expected build ordinal before creating output');
mkdirSync(out,{recursive:true});
const artifactPath=process.env.COMBAT_QA_ARTIFACT_PATH || root+'/build/download/AshenSpire.html';
const artifact=readFileSync(artifactPath,'utf8');
const actualIdentity={ordinal:artifact.match(/const ORDINAL = '([^']+)'/)?.[1],source:artifact.match(/const SOURCE = '([^']+)'/)?.[1]};
if(!process.env.COMBAT_QA_ORDINAL||!process.env.COMBAT_QA_SOURCE||actualIdentity.ordinal!==process.env.COMBAT_QA_ORDINAL||actualIdentity.source!==process.env.COMBAT_QA_SOURCE)
 throw Error('Expected frozen COMBAT_QA_ORDINAL / COMBAT_QA_SOURCE before browser launch; actual '+JSON.stringify(actualIdentity));
const {serve}=await import(pathToFileURL(root+'/tools/serve.mjs'));
const {launchBrowser,resolveBrowser}=await import(pathToFileURL(root+'/tools/browser.mjs'));
const server={url:'http://127.0.0.1:8823/',server:{close:r=>r()}};
const browser=await launchBrowser({prefix:'v2qa-',headless:'--headless=new',args:['--disable-background-networking','--no-default-browser-check'],browser:resolveBrowser(['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'])});
const ws=new WebSocket(browser.wsUrl),pending=new Map(),errors=[],warnings=[],requests=new Map(); let serial=0;
ws.addEventListener('message', e=>{const m=JSON.parse(e.data);if(m.method==='Log.entryAdded'){const classification=artifactLogClassification(m.params.entry);browserHealth.push({...m.params.entry,qaClassification:classification,qaPhase});if(classification==='unexpected-fatal')errors.push('BrowserLog '+m.params.entry.text);}if(m.method==='Network.requestWillBeSent')requests.set(m.params.requestId,m.params.request.url);if(['Network.loadingFinished','Network.loadingFailed'].includes(m.method))requests.delete(m.params.requestId);if(m.method==='Network.loadingFailed')errors.push('Network '+m.params.errorText);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='warning'){const warning=m.params.args.map(x=>x.value||x.description).join(' ');warnings.push(warning);errors.push('ConsoleWarning '+warning);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(x=>x.value||x.description).join(' '));const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);});
await new Promise((r,j)=>{ws.addEventListener('open',r);ws.addEventListener('error',j)});
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;const timeout=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},method==='Page.navigate'?60000:method==='Runtime.evaluate'?120000:15000);pending.set(id,{resolve:r=>{clearTimeout(timeout);resolve(r)},reject:e=>{clearTimeout(timeout);reject(e)}});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const results=[{localBuildMetadataForComparison:JSON.parse(readFileSync(root+'/buildordinal.json','utf8')),compiledIdentity:{path:artifactPath,ordinal:artifact.match(/const ORDINAL = '([^']+)'/)?.[1],source:artifact.match(/const SOURCE = '([^']+)'/)?.[1]}}];
try{for(const shape of [{name:"desktop-normal",width:1365,height:1000,mobile:false,reduced:false},{name:"phone-normal",width:390,height:844,mobile:true,reduced:false},{name:"phone-compact",width:320,height:780,mobile:true,reduced:false},{name:"phone-reduced",width:390,height:844,mobile:true,reduced:true}].filter(shape=>!process.env.COMBAT_QA_SHAPES||process.env.COMBAT_QA_SHAPES.split(',').includes(shape.name))){
const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
await send('Page.enable',{},sessionId);await send('Runtime.enable',{},sessionId);await send('Log.enable',{},sessionId);await send('Network.enable',{},sessionId);
await send('Emulation.setDeviceMetricsOverride',{width:shape.width,height:shape.height,mobile:shape.mobile,deviceScaleFactor:1},sessionId);await send('Emulation.setTouchEmulationEnabled',{enabled:shape.mobile},sessionId);
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:shape.reduced?'reduce':'no-preference'}]},sessionId);
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const until=async expression=>{for(let i=0;i<100;i++){if(await ev(expression))return;if(i%40===0)console.log('WAIT',i,[...requests.values()].slice(-8));await wait(200);}throw Error('Timeout '+expression+' '+JSON.stringify(await ev('({url:location.href,ready:document.readyState,html:document.documentElement.outerHTML.slice(0,1000),body:document.body.innerText.slice(0,2000)})')));};
const click=async selector=>{const p=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});const b=e.getBoundingClientRect();for(const fy of [.3,.5,.1,.8])for(const fx of [.5,.15,.85]){const x=b.x+b.width*fx,y=b.y+b.height*fy;if(e.contains(document.elementFromPoint(x,y)))return{x,y};}throw Error('Unreachable '+${JSON.stringify(selector)}+' '+JSON.stringify({x:b.x,y:b.y,w:b.width,h:b.height}));})()`);if(shape.mobile){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]},sessionId);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]},sessionId);}else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1},sessionId);await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1},sessionId);}await wait(250);};
const capture=async name=>{const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);writeFileSync(out+'/'+shape.name+'-'+name+'.png',Buffer.from(s.data,'base64'));};
const baseUrl=process.env.COMBAT_QA_ARTIFACT_URL || server.url+'build/download/AshenSpire.html';
const inspectIdentity=async()=>{
 const id=await ev("(()=>{const text=Array.from(document.scripts,s=>s.textContent).join('\\n');return{ordinal:text.match(/const ORDINAL = '([^']+)'/)?.[1],source:text.match(/const SOURCE = '([^']+)'/)?.[1]};})()");
 if(id.ordinal!==process.env.COMBAT_QA_ORDINAL||id.source!==process.env.COMBAT_QA_SOURCE)throw Error('Rendered identity mismatch '+JSON.stringify(id));if(await ev('document.documentElement.dataset.displayAppearance')!=='classic')throw Error('Classic appearance was not applied');return id;
};
const settled=()=>until('!window.__fx || window.__fx.open===window.__fx.finished');
const observe=()=>ev(`(()=>{window.__counterVisualTrace=[];window.__counterVisualObserver?.disconnect();
 const state=()=>Array.from(document.querySelectorAll('.combatant.player')).map(e=>({owner:e.dataset.seat||e.dataset.eid||'player',group:e.dataset.actionGroup||e.querySelector('[data-action-group]')?.dataset.actionGroup||null,family:e.dataset.actionFamily||e.querySelector('[data-action-family]')?.dataset.actionFamily||null,motion:e.dataset.actionMotion||e.querySelector('[data-action-motion]')?.dataset.actionMotion||null,stages:Array.from(e.querySelectorAll('[data-pose],[data-rest]')).map(n=>({pose:n.dataset.pose||null,rest:n.dataset.rest||null,set:n.dataset.animationSet||null})),attackClass:e.classList.contains('act-attack')||!!e.querySelector('.act-attack')}));
 window.__counterVisualObserver=new MutationObserver(records=>{const changes=records.filter(r=>r.type==='attributes'&&['data-pose','data-rest','data-action-group','data-action-family','data-action-motion','class'].includes(r.attributeName)&&r.target.closest('.combatant.player')).map(r=>({owner:r.target.closest('.combatant.player').dataset.seat||'player',attribute:r.attributeName,oldValue:r.oldValue,value:r.target.getAttribute(r.attributeName)}));if(changes.length)window.__counterVisualTrace.push({at:performance.now(),changes,state:state()});});
 window.__counterVisualObserver.observe(document.body,{attributes:true,attributeOldValue:true,subtree:true,childList:true});window.__counterVisualTrace.push({at:performance.now(),state:state(),changes:[]});})()`);
const trace=()=>ev('window.__counterVisualTrace');
function checkTrace(rows,owner,kind){
 const changes=rows.flatMap(row=>row.changes||[]).filter(row=>row.owner===owner);
 const states=rows.flatMap(row=>row.state||[]).filter(row=>row.owner===owner);
 if(changes.some(row=>row.attribute==='data-action-group'&&[row.value,row.oldValue].includes('attack'))||states.some(row=>row.group==='attack'||row.attackClass))throw Error('Counter preparation entered an attack visual '+JSON.stringify(rows));
 if(changes.some(row=>row.attribute==='data-pose'&&/^(attack|shieldBash)/i.test(row.value||'')))throw Error('Counter swung an attack pose '+JSON.stringify(changes));
 if(owner==='player'&&!shape.reduced&&!states.some(row=>row.group===kind))throw Error('Missing actual solo '+kind+' visual plan');
 if(shape.reduced){
  const final=states.at(-1);
  const validRest=kind==='defend'?stage=>stage.rest==='shieldGuard'&&/^shieldGuard/.test(stage.pose||''):stage=>stage.rest==='idle'&&stage.set==='reaverSwordShield'&&stage.pose==='STANCE-READY';
  if(!final?.stages.some(validRest))throw Error('Reduced Counter did not settle correct '+owner+' '+kind+' rest/frame '+JSON.stringify(final));
 }
 if(kind==='defend'&&!states.some(row=>row.stages.some(stage=>stage.rest==='shieldGuard'||/^shieldGuard/.test(stage.pose||''))))throw Error('Missing actual '+owner+' shield guard pose/rest');
 if(kind==='cast'&&!shape.reduced&&!changes.some(row=>row.attribute==='data-pose'&&/^(cast|idle)/i.test(row.value||'')))throw Error('Spell Counter produced no recorded cast-stage change');
}
qaPhase=shape.name+':solo-boot';await send('Page.navigate',{url:baseUrl+'?shot=combat&shotExpansion=cards&shotSeed=COUNTERVISUAL&shotSettings='+encodeURIComponent(JSON.stringify({askToUpcastAfterTarget:false,classicAppearance:true}))},sessionId);
await until('!!window.__combat && !!window.__renderCombatForShot && !!document.querySelector(".hand .card")');
const identity=await inspectIdentity();
if(await ev('matchMedia("(prefers-reduced-motion: reduce)").matches')!==shape.reduced)throw Error('Actual reduced-motion media does not match requested shape');
await until('Array.from(document.querySelectorAll(".hand img,.combatant img")).filter(x=>!!x.src).every(x=>x.complete&&x.naturalWidth>0)');
const mounted=await ev(`(()=>{const c=window.__combat,run=window.__combatRunForShot;const inst=run.deck.find(x=>x.cardId==='shieldBash'&&x.grantedBy==='roundShield');if(!inst)throw Error('Mounted Shield Bash unavailable');const mounted=Object.values(c.piles).flat().find(x=>x.instanceId===inst.instanceId);if(!mounted)throw Error('Mounted card has no actual pile position');inst.abilityRank=mounted.abilityRank=1;for(const pile of Object.keys(c.piles))c.piles[pile]=c.piles[pile].filter(x=>x.instanceId!==inst.instanceId);const index=c.piles.hand.findIndex(x=>x.cardId==='shieldBash');if(index<0)throw Error('Missing explicit replacement slot');c.piles.hand[index]=mounted;const ids=Object.values(c.piles).flat().map(x=>x.instanceId);if(new Set(ids).size!==ids.length)throw Error('Duplicated fixture pile identity');window.__renderCombatForShot();return structuredClone(mounted);})()`);
const before=await ev('({enemyHp:window.__combat.enemies.map(x=>x.hp),sp:window.__combat.player.energy,mana:window.__combat.player.mana,hand:window.__combat.piles.hand,counter:window.__combat.player.combatCounter,rng:window.__combat.rng.getCounters()})');
const mountedSelector='[data-instance-id="'+mounted.instanceId+'"]';
const reachable=selector=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;const b=e.getBoundingClientRect();for(const fy of [.3,.5,.1,.8])for(const fx of [.5,.15,.85])if(e.contains(document.elementFromPoint(b.x+b.width*fx,b.y+b.height*fy)))return true;return false;})()`);
const pageCount=await ev('document.querySelectorAll(".hand .card").length');
const pager=[];
for(let step=0;step<=pageCount&&!await reachable(mountedSelector);step++){
 pager.push(await ev('({stepTarget:document.querySelector(".hand .gp-focus")?.dataset.instanceId,handScroll:document.querySelector(".hand").scrollLeft,nextHidden:document.querySelector(".hand-next")?.hidden,card:document.querySelector('+JSON.stringify(mountedSelector)+').getBoundingClientRect().toJSON()})'));
 if(step===pageCount)throw Error('Native hand pager never exposed mounted card '+JSON.stringify(pager));
 await click('.hand-next:not([hidden])');
}
results.push({shape:shape.name,nativePager:pager});
const afterPager=await ev('({enemyHp:window.__combat.enemies.map(x=>x.hp),sp:window.__combat.player.energy,mana:window.__combat.player.mana,hand:window.__combat.piles.hand,counter:window.__combat.player.combatCounter,rng:window.__combat.rng.getCounters()})');
if(JSON.stringify(afterPager)!==JSON.stringify(before))throw Error('Native paging altered combat state');
await click('[data-instance-id="'+mounted.instanceId+'"]');
await click('[data-instance-id="'+mounted.instanceId+'"] .card-upcast');
await until('!!document.querySelector(".card-upcast-rank:not([hidden])")');
await capture('native-tier-picker-open');results.push({shape:shape.name,pickerGeometry:await ev('Array.from(document.querySelectorAll(".card-upcast-controls,.card-upcast-rank:not([hidden])")).filter(n=>n.getBoundingClientRect().width).map(n=>({className:n.className,rect:n.getBoundingClientRect().toJSON(),viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,scrollX,focused:n===document.activeElement,hand:(()=>{const h=n.closest(".hand");if(!h)return null;const c=getComputedStyle(h);return{rect:h.getBoundingClientRect().toJSON(),clientWidth:h.clientWidth,scrollWidth:h.scrollWidth,scrollLeft:h.scrollLeft,overflowX:c.overflowX,position:c.position,wireframe:h.dataset.wireframeHand}})()}))')});
const chooserFits = await ev(`Array.from(document.querySelectorAll('.card-upcast-controls button,.card-upcast-controls select')).filter(n=>n.getBoundingClientRect().width).every(n=>{const r=n.getBoundingClientRect(),h=n.closest('.hand').getBoundingClientRect();return r.left>=Math.max(0,h.left)-1&&r.right<=Math.min(innerWidth,h.right)+1&&r.top>=0&&r.bottom<=Math.min(innerHeight,h.bottom)+1;})`);
if (!chooserFits) throw Error('Complete native Upcast controls must clear the hand/footer edge');
// Open and select the real native tier picker with keyboard events; do not
// assign its value or dispatch a synthetic change through the DOM.
await click('[data-instance-id="'+mounted.instanceId+'"] .card-upcast-rank');
for(const [key,code,vk] of [['Home','Home',36],['ArrowDown','ArrowDown',40],['ArrowDown','ArrowDown',40],['Enter','Enter',13]]) {
 await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk},sessionId);
 await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},sessionId);
}
await until('document.querySelector('+JSON.stringify('[data-instance-id="'+mounted.instanceId+'"] [data-card-binding=stamina]')+')?.textContent==="3"');
const badge=await ev(`(()=>{const c=document.querySelector('[data-instance-id="${mounted.instanceId}"]');return{sp:c.querySelector('[data-card-binding=stamina]')?.textContent,mana:c.querySelector('[data-card-binding=mana]')?.textContent};})()`);
if(badge.sp!=='3'||badge.mana!=='3')throw Error('Actual mounted Tier2 price '+JSON.stringify(badge));
const beforeCommit=await ev('({enemyHp:window.__combat.enemies.map(x=>x.hp),sp:window.__combat.player.energy,mana:window.__combat.player.mana,hand:window.__combat.piles.hand,counter:window.__combat.player.combatCounter,rng:window.__combat.rng.getCounters()})');if(JSON.stringify(beforeCommit)!==JSON.stringify(before))throw Error('Tier selection paid or changed combat state');
qaPhase=shape.name+':solo-shield-counter';await observe();await click('.combatant.player.armed');console.log('POST_COUNTER_CLICK',JSON.stringify(await ev('({hand:window.__combat.piles.hand.map(x=>x.instanceId),events:window.__combat.eventLog.slice(-10),body:document.body.innerText.slice(-1500)})')),JSON.stringify(warnings));await until('!window.__combat.piles.hand.some(x=>x.instanceId==='+JSON.stringify(mounted.instanceId)+')');await capture('mounted-shield-tier-two-action');await settled();await wait(500);
const shield=await ev('(()=>{const c=window.__combat;return{receipt:c.eventLog.filter(e=>e.type==="cardPlayed").at(-1),enemyHp:c.enemies.map(x=>x.hp),sp:c.player.energy,mana:c.player.mana,counter:c.player.combatCounter,stages:Array.from(document.querySelectorAll(".combatant.player [data-rest]")).map(n=>({rest:n.dataset.rest,pose:n.dataset.pose}))};})()');
if(shield.receipt.upcastTier!==2||JSON.stringify(shield.receipt.cardInstance)!==JSON.stringify(mounted))throw Error('Paid tier/permanent instance receipt mismatch');
if(JSON.stringify(shield.enemyHp)!==JSON.stringify(before.enemyHp)||shield.sp!==before.sp-3||shield.mana!==before.mana-3||shield.counter?.charges!==1)throw Error('Counter preparation/pay mismatch');
const shieldTrace=await trace();results.push({diagnosticShield:{shape:shape.name,before,beforeCommit,after:shield,trace:shieldTrace}});checkTrace(shieldTrace,'player','defend');await capture('mounted-shield-tier-two-guard');
results.push({shape:shape.name,identity,mode:shape.reduced?'reduced-motion':'normal-motion',soloMountedShield:{mounted,badge,before,after:shield,trace:shieldTrace}});
const spellId=await ev('window.__combat.piles.hand.find(x=>x.cardId==="barrageCounter").instanceId');
const spellBefore=await ev(`(()=>{const c=window.__combat,n=document.querySelector('[data-instance-id="${spellId}"]');return{instance:structuredClone(c.piles.hand.find(x=>x.instanceId==='${spellId}')),sp:c.player.energy,mana:c.player.mana,barrier:c.player.barrier,ward:structuredClone(c.player.persistentWard),price:{sp:Number(n.querySelector('[data-card-binding=stamina]')?.textContent),mana:Number(n.querySelector('[data-card-binding=mana]')?.textContent)}};})()`);
if(spellBefore.price.sp!==2||spellBefore.price.mana!==1)throw Error('Authored base Spell Counter badge mismatch');
qaPhase=shape.name+':solo-spell-counter';await settled();await observe();await click('[data-instance-id="'+spellId+'"]');await click('.combatant.player.armed');await capture('spell-counter-cast-action');await settled();await wait(400);
const spell=await ev('({receipt:window.__combat.eventLog.filter(e=>e.type==="cardPlayed").at(-1),enemyHp:window.__combat.enemies.map(x=>x.hp),sp:window.__combat.player.energy,mana:window.__combat.player.mana,barrier:window.__combat.player.barrier,ward:window.__combat.player.persistentWard,counter:window.__combat.player.combatCounter})');
if(JSON.stringify(spell.enemyHp)!==JSON.stringify(before.enemyHp))throw Error('Spell Counter preparation dealt immediate HP damage');
if(spell.receipt.cardId!=='barrageCounter'||spell.receipt.upcastTier!==0||JSON.stringify(spell.receipt.cardInstance)!==JSON.stringify(spellBefore.instance)||spell.sp!==spellBefore.sp-spellBefore.price.sp||spell.mana!==spellBefore.mana-spellBefore.price.mana||spell.receipt.energySpent!==spellBefore.price.sp||spell.receipt.manaSpent!==spellBefore.price.mana||spell.counter?.charges!==1||spell.counter?.carrier?.combatProfile?.camp!=='spell'||spell.barrier!==spellBefore.barrier+6||JSON.stringify(spell.ward)!==JSON.stringify(spellBefore.ward))throw Error('Spell Counter paid receipt/charge/protection mismatch '+JSON.stringify({before:spellBefore,after:spell}));
const spellTrace=await trace();results.push({diagnosticSpell:{shape:shape.name,after:spell,trace:spellTrace}});checkTrace(spellTrace,'player','cast');await capture('spell-counter-cast');results.push({shape:shape.name,spellCounter:{...spell,trace:spellTrace}});
await send('Target.closeTarget',{targetId});
const wire=JSON.parse(readFileSync(process.env.COMBAT_QA_WIRE || 'D:/repos/.codex/outputs/combat-card-stances/counter-visual-wire.json','utf8'));
for(const fixture of wire.cases){
 // Each canned scene enters the real compiled co-op renderer through the
 // existing shot socket. This is receipt-to-pose QA, not LAN transport QA.
 qaPhase=shape.name+':coop-'+fixture.convertedSeat+':boot';
 const {targetId:nextTarget}=await send('Target.createTarget',{url:baseUrl+'?shot=coop&shotSeats=2&shotSettings='+encodeURIComponent(JSON.stringify({classicAppearance:true}))});
 const {sessionId:nextSession}=await send('Target.attachToTarget',{targetId:nextTarget,flatten:true});
 const cev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},nextSession);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 await send('Page.enable',{},nextSession);await send('Runtime.enable',{},nextSession);await send('Log.enable',{},nextSession);await send('Network.enable',{},nextSession);
 await send('Emulation.setDeviceMetricsOverride',{width:shape.width,height:shape.height,mobile:shape.mobile,deviceScaleFactor:1},nextSession);await send('Emulation.setTouchEmulationEnabled',{enabled:shape.mobile},nextSession);await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:shape.reduced?'reduce':'no-preference'}]},nextSession);
 for(let i=0;i<100&&!await cev('!!window.__coopSnapshotForShot');i++)await wait(200);
 if(!await cev('!!window.__coopSnapshotForShot'))throw Error('Compiled co-op boot exceeded20s');
 const id=await cev("(()=>{const text=Array.from(document.scripts,s=>s.textContent).join('\\n');return{ordinal:text.match(/const ORDINAL = '([^']+)'/)?.[1],source:text.match(/const SOURCE = '([^']+)'/)?.[1]};})()");
 if(id.ordinal!==identity.ordinal||id.source!==identity.source)throw Error('Co-op artifact identity mismatch');if(await cev('document.documentElement.dataset.displayAppearance')!=='classic')throw Error('Co-op Classic appearance was not applied');
 qaPhase=shape.name+':coop-'+fixture.convertedSeat+':projected-receipt';
 await cev('(()=>{const s=structuredClone(window.__coopSnapshotForShot);s.party='+JSON.stringify(fixture.party)+';s.scene.players='+JSON.stringify(fixture.before)+';s.scene.enemies='+JSON.stringify(fixture.enemies)+';s.scene.combatExpansionVersion=2;s.scene.breakMeterVersion=2;s.scene.events=[];s.scene.receiptSeq=1;window.__receiveCoopSnapshotForShot(s);window.__counterVisualTrace=[];const state=()=>Array.from(document.querySelectorAll(".coop-seat")).map(e=>({owner:e.dataset.seat,stages:Array.from(e.querySelectorAll("[data-pose],[data-rest]")).map(n=>({pose:n.dataset.pose,rest:n.dataset.rest})),attackClass:e.classList.contains("act-attack")}));window.__counterVisualObserver=new MutationObserver(records=>{const changes=records.filter(r=>r.type==="attributes"&&["data-pose","data-rest","class"].includes(r.attributeName)&&r.target.closest(".coop-seat")).map(r=>({owner:r.target.closest(".coop-seat").dataset.seat,attribute:r.attributeName,oldValue:r.oldValue,value:r.target.getAttribute(r.attributeName)}));if(changes.length)window.__counterVisualTrace.push({at:performance.now(),changes,state:state()});});window.__counterVisualObserver.observe(document.body,{subtree:true,attributes:true,attributeOldValue:true,childList:true});const after=structuredClone(s);after.scene.players='+JSON.stringify(fixture.after)+';after.scene.events='+JSON.stringify(fixture.events)+';after.scene.receiptSeq=2;window.__receiveCoopSnapshotForShot(after);window.__counterVisualTrace.push({at:performance.now(),changes:[],state:state()});})()');
 await wait(700);const rows=await cev('window.__counterVisualTrace');checkTrace(rows,'p2','defend');
 if(rows.flatMap(row=>row.changes||[]).some(row=>row.owner==='p1'&&row.attribute==='data-pose'&&/^shieldGuard|^attack/.test(row.value||'')))throw Error('Paid p2 receipt animated unrelated p1');
 const state=await cev('({players:window.__coopSnapshot.scene.players.map(p=>({id:p.id,attributes:p.attributes,converted:p.ashenBlight?.thresholdOutcome,energy:p.energy,mana:p.mana})),poses:Array.from(document.querySelectorAll(".coop-seat")).map(e=>({id:e.dataset.seat,stages:Array.from(e.querySelectorAll("[data-rest]")).map(n=>({rest:n.dataset.rest,pose:n.dataset.pose}))}))})');
 const paidOwner=state.players.find(player=>player.id==='p2'),otherOwner=state.players.find(player=>player.id==='p1');
 const expectedOwner=fixture.after.find(player=>player.id==='p2');
 if(paidOwner.energy!==expectedOwner.energy||paidOwner.mana!==expectedOwner.mana)throw Error('Co-op receipt owner price/state mismatch');
 if((paidOwner.converted==='survived')!==fixture.expected.converted)throw Error('Co-op UI used wrong corruption owner');
 if(JSON.stringify(paidOwner.attributes)===JSON.stringify(otherOwner.attributes))throw Error('Co-op distinct owner-stat control missing');
 const p2Pose=state.poses.find(player=>player.id==='p2');
 if(!p2Pose.stages.some(stage=>stage.rest==='shieldGuard'))throw Error('Paid co-op Counter failed to retain guard rest');
 const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},nextSession);writeFileSync(out+'/'+shape.name+'-coop-p2-'+fixture.convertedSeat+'-blighted-guard.png',Buffer.from(screenshot.data,'base64'));
 results.push({shape:shape.name,boundary:wire.boundary,fixtureSources:wire.sources,convertedSeat:fixture.convertedSeat,paidReceipt:fixture.receipt,expected:fixture.expected,state,trace:rows});
 await send('Target.closeTarget',{targetId:nextTarget});
}

}if(errors.length)throw Error("Browser health errors "+JSON.stringify(errors));}catch(e){results.push({error:e.stack,requests:[...requests.values()].slice(-15)});process.exitCode=1;}finally{writeFileSync(out+'/browser-health.json',JSON.stringify({events:browserHealth},null,2));writeFileSync(out+"/results.json",JSON.stringify({results,errors,warnings},null,2));console.log(JSON.stringify({results,errors,warnings},null,2));ws.close();await browser.close();}
