import { mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const root=process.env.COMBAT_QA_ROOT || 'D:/repos/.codex/worktrees/combat-expansion-runtime/AshenSpire';
const out=process.env.COMBAT_QA_OUTPUT || ('D:/repos/.codex/outputs/combat-card-stances/built-target-qa-'+process.env.COMBAT_QA_ORDINAL);
if(!process.env.COMBAT_QA_ORDINAL) throw Error('Require expected build ordinal before creating output');
if(!['preliminary-compiled','final-compiled'].includes(process.env.COMBAT_QA_STAGE)) throw Error('Require explicit preliminary-compiled or final-compiled evidence stage');
mkdirSync(out,{recursive:true});
const artifactPath=process.env.COMBAT_QA_ARTIFACT_PATH || root+'/build/download/AshenSpire.html';
const artifact=readFileSync(artifactPath,'utf8');
const actualIdentity={ordinal:artifact.match(/const ORDINAL = '([^']+)'/)?.[1],source:artifact.match(/const SOURCE = '([^']+)'/)?.[1]};
if(!process.env.COMBAT_QA_ORDINAL||!process.env.COMBAT_QA_SOURCE||actualIdentity.ordinal!==process.env.COMBAT_QA_ORDINAL||actualIdentity.source!==process.env.COMBAT_QA_SOURCE)
 throw Error('Expected frozen COMBAT_QA_ORDINAL / COMBAT_QA_SOURCE before browser launch; actual '+JSON.stringify(actualIdentity));
const {launchBrowser,resolveBrowser}=await import(pathToFileURL(root+'/tools/browser.mjs'));

const browser=await launchBrowser({prefix:'v2qa-',headless:'--headless=new',args:['--disable-background-networking','--no-default-browser-check'],browser:resolveBrowser(['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'])});
const ws=new WebSocket(browser.wsUrl),pending=new Map(),errors=[],requests=new Map(); let serial=0;
ws.addEventListener('message', e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent')requests.set(m.params.requestId,m.params.request.url);if(['Network.loadingFinished','Network.loadingFailed'].includes(m.method))requests.delete(m.params.requestId);if(m.method==='Network.loadingFailed')errors.push('Network '+m.params.errorText);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(x=>x.value||x.description).join(' '));const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);});
await new Promise((r,j)=>{ws.addEventListener('open',r);ws.addEventListener('error',j)});
const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;const timeout=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},method==='Page.navigate'?60000:method==='Runtime.evaluate'?120000:15000);pending.set(id,{resolve:r=>{clearTimeout(timeout);resolve(r)},reject:e=>{clearTimeout(timeout);reject(e)}});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const results=[{localBuildMetadataForComparison:JSON.parse(readFileSync(root+'/buildordinal.json','utf8')),compiledIdentity:{path:artifactPath,ordinal:artifact.match(/const ORDINAL = '([^']+)'/)?.[1],source:artifact.match(/const SOURCE = '([^']+)'/)?.[1]}}];
try {
for(const shape of [{name:'desktop',width:1365,height:1000,mobile:false},{name:'phone',width:390,height:844,mobile:true}]) {
const {targetId}=await send('Target.createTarget',{url:'about:blank'}); const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
await send('Page.enable',{},sessionId); await send('Runtime.enable',{},sessionId); await send('Network.enable',{},sessionId);
await send('Emulation.setDeviceMetricsOverride',{width:shape.width,height:shape.height,mobile:shape.mobile,deviceScaleFactor:1},sessionId);
await send('Emulation.setTouchEmulationEnabled',{enabled:shape.mobile},sessionId);
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]},sessionId);
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const until=async expression=>{for(let i=0;i<100;i++){if(await ev(expression))return;await wait(200);}throw Error('20-second boot/interaction deadline '+expression);};
const capture=async name=>{const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);writeFileSync(out+'/'+shape.name+'-'+name+'.png',Buffer.from(s.data,'base64'));};
const click=async selector=>{const p=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control'); const b=e.getBoundingClientRect();for(const fy of [.5,.2,.8])for(const fx of [.5,.2,.8]){const x=b.x+b.width*fx,y=b.y+b.height*fy;const hit=document.elementFromPoint(x,y);if(e===hit||e.contains(hit))return{x,y};}throw Error('Unreachable control '+${JSON.stringify(selector)});})()`);if(shape.mobile){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]},sessionId);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]},sessionId);}else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1},sessionId);await send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1},sessionId);}await wait(300);};
await send('Page.navigate',{url:process.env.COMBAT_QA_ARTIFACT_URL+'?shot=combat&shotExpansion=cards&shotSeed=EXPANSIONQA&shotSettings='+encodeURIComponent(JSON.stringify({cardMotif:'accent'}))},sessionId);
await until('!!window.__combat && !!document.querySelector(".hand .card.corrupted-card")');
await until('Array.from(document.querySelectorAll(".hand img,.combatant img")).filter(x=>!!x.src).every(x=>x.complete && x.naturalWidth>0)');
const snapshot=()=>ev('JSON.stringify({p:window.__combat.player,piles:window.__combat.piles,rng:{seed:window.__combat.rng.seed,counters:window.__combat.rng.getCounters()}})');
const before=await snapshot();
await ev('(()=>{const c=document.querySelector(".hand .card.corrupted-card"); c.scrollIntoView({block:"center"});c.focus();})()');await wait(600);
const details=()=>ev('(()=>{const c=document.querySelector(".card-inspection-modal .card.corrupted-card")||document.querySelector(".hand .card.corrupted-card");const css=getComputedStyle(c,"::after");return{width:css.width,height:css.height,cardWidth:c.clientWidth,cardHeight:c.clientHeight,insets:[css.top,css.right,css.bottom,css.left],borderRadius:css.borderRadius,cardRadius:getComputedStyle(c).borderRadius,motif:document.documentElement.dataset.cardMotif,className:c.className,display:css.display,pointerEvents:css.pointerEvents,zIndex:css.zIndex,background:css.backgroundImage,mask:css.maskImage,label:c.querySelector(".corrupted-card-label")?.textContent,rules:c.querySelector("[data-card-binding=rules]")?.textContent,name:c.getAttribute("aria-label"),costs:Array.from(c.querySelectorAll("[data-card-binding]"),x=>({binding:x.dataset.cardBinding,text:x.textContent})),overflow:document.documentElement.scrollWidth>innerWidth};})()');
console.log('SHAPE',shape.name,'boot complete'); const baseline=await details();if(baseline.display!=='block')throw Error('Expected visible overlay in the verified compiled artifact');
await capture('compiled-hand-before');
const after=await details();if(after.display!=='block'||after.pointerEvents!=='none'||Math.abs(parseFloat(after.width)-after.cardWidth)>1||Math.abs(parseFloat(after.height)-after.cardHeight)>1||after.insets.some(n=>n!=='0px')||!after.background.includes('radial-gradient'))throw Error('Overlay not visible/pointer-transparent '+JSON.stringify(after));
await capture('compiled-hand');
await click('.card-info-button[aria-label="Information about Blighted Transmute"]');await until('!!document.querySelector(".card-inspection-modal .card.corrupted-card")');
const inspection=await details(); if(inspection.display!=='block'||inspection.pointerEvents!=='none'||inspection.overflow)throw Error('Inspection overlay or overflow '+JSON.stringify(inspection));
await capture('compiled-inspection');
const matrix=await ev(`(()=>{const c=document.querySelector('.card-inspection-modal .card.corrupted-card');const root=document.documentElement;const cls=c.className,motif=root.dataset.cardMotif;const results=[];
try { for(const m of ['off','wash','accent','band']) for(const illustrated of [true,false]) for(const rarity of ['common','uncommon','rare','special']) {
root.dataset.cardMotif=m;c.className=cls.replace(/rarity-(common|uncommon|rare|special)/g,'').replace(/\\billustrated-card\\b/g,'')+' rarity-'+rarity+(illustrated?' illustrated-card':'');
const css=getComputedStyle(c,'::after'); const row={motif:m,illustrated,rarity,display:css.display,width:parseFloat(css.width),height:parseFloat(css.height),cardWidth:c.clientWidth,cardHeight:c.clientHeight,insets:[css.top,css.right,css.bottom,css.left],radius:css.borderRadius,cardRadius:getComputedStyle(c).borderRadius,gradient:css.backgroundImage,pointerEvents:css.pointerEvents};
row.ok=row.display==='block'&&row.pointerEvents==='none'&&Math.abs(row.width-row.cardWidth)<=1&&Math.abs(row.height-row.cardHeight)<=1&&row.insets.every(n=>n==='0px')&&row.radius===row.cardRadius&&row.gradient.includes('radial-gradient')&&row.gradient.includes('linear-gradient'); results.push(row);
} } finally { c.className=cls;root.dataset.cardMotif=motif; } return results;})()`);
if(matrix.some(row=>!row.ok))throw Error('Full-card motif/rarity matrix failed '+JSON.stringify(matrix.filter(row=>!row.ok)));
await send('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'active'}]},sessionId);
const forced=await details();if(forced.display!=='none')throw Error('Forced colors failed to hide overlay');await capture('compiled-forced-colors');
const forcedMatrix=await ev(`(()=>{const c=document.querySelector('.card-inspection-modal .card.corrupted-card'),root=document.documentElement,cls=c.className,motif=root.dataset.cardMotif,out=[];try{for(const m of ['off','wash','accent','band'])for(const illustrated of [true,false])for(const rarity of ['common','uncommon','rare','special']){root.dataset.cardMotif=m;c.className=cls.replace(/rarity-(common|uncommon|rare|special)/g,'').replace(/\\billustrated-card\\b/g,'')+' rarity-'+rarity+(illustrated?' illustrated-card':'');out.push({motif:m,illustrated,rarity,display:getComputedStyle(c,'::after').display});}}finally{c.className=cls;root.dataset.cardMotif=motif;}return out;})()`);
if(forcedMatrix.some(row=>row.display!=='none'))throw Error('Forced-color matrix failed '+JSON.stringify(forcedMatrix));
await send('Emulation.setEmulatedMedia',{features:[{name:'forced-colors',value:'none'},{name:'prefers-reduced-motion',value:'reduce'}]},sessionId);
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},sessionId);await until('!document.querySelector(".card-inspection-modal")');
if(await snapshot()!==before)throw Error('Inspection changed resources/card/RNG state');
results.push({shape:shape.name,matrix,forcedMatrix,evidence:{artifact:actualIdentity,stage:process.env.COMBAT_QA_STAGE,cssInjection:false},baseline,after,inspection,forcedColorsHidden:forced.display==='none',realInformationClick:true,escapeAtomic:true});
await send('Target.closeTarget',{targetId});
}
if(errors.length)throw Error('Browser errors '+JSON.stringify(errors));
}catch(e){results.push({error:e.stack,requests:[...requests.values()].slice(-15)});process.exitCode=1;}
finally{writeFileSync(out+'/results.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors},null,2));ws.close();await browser.close();}
