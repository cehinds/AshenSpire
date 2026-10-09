import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { serve } from '../../../tools/serve.mjs';
import { launchBrowser } from '../../../tools/browser.mjs';
import { createSession } from '../../../tools/session.mjs';
import { contentBundle } from '../../../src/content/index.js';
import { createRegistries } from '../../../src/model/registries.js';
import { initialClassTreeChoices } from '../../../src/model/classTree.js';
import { registriesForClassMastery } from '../../../src/model/classMasteryRun.js';
const root = resolve(fileURLToPath(new URL('../../../',import.meta.url)));
if(!process.argv[2])throw Error('Provide a dedicated QA output directory');
const out=resolve(process.argv[2]);mkdirSync(out,{recursive:true});process.env.REACTION_QA_OUTPUT=out;
const helpersUrl=new URL('./measurements.mjs',import.meta.url).href;
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const box = JSON.parse(readFileSync(root+'/buildordinal.json','utf8'));
const registries = createRegistries(contentBundle);
const savePath = root+'/dist/.coop-session.json';
if (existsSync(savePath)) throw Error('Refusing to overwrite an existing packaged QA room');
const fixture = createSession({ registries, seedString: 'GUARD2', knowledgeAuthority: { roomId: 'reaction-packaged-qa', privateSeed: 0x24681357 } });
for (const id of ['p1','p2']) fixture.addMember({ id, name: id === 'p1' ? 'QA Host' : 'QA Guest', classId: 'reaver' });
fixture.start();
for (const member of fixture.session.members.values()) while (member.run.classMasteryState?.initialTreeTiers.length) {
  const choices = initialClassTreeChoices(registriesForClassMastery(registries,member.run),member.run);
  if (!fixture.chooseMasteryNode(member.id,choices[0]).ok) throw Error('Fixture mastery refused');
}
for (const id of ['p1','p2']) if (!fixture.chooseNode(id,fixture.session.mapGraph.startIds[0]).ok) throw Error('Fixture node refused');
if (fixture.scene.kind !== 'combat') throw Error('GUARD2 no longer opens combat');
for (const P of fixture.live.combat.players.values()) {
  P.piles.draw.push(...P.piles.hand);
  P.piles.hand = ['guardCounter','sweepingBlow','strike'].map((cardId,i)=>({cardId,instanceId:`qa:${P.id}:${i}`,upgraded:false}));
  P.entity.energy = 8; P.entity.energyMax = 8; P.entity.mana = P.entity.maxMana = 8; P.entity.block = 100;
}
for (const enemy of fixture.live.combat.enemies) {
  enemy.hp = enemy.maxHp = 100;
  const def = registries.enemies.get(enemy.enemyId);
  const entry = Object.entries(def.moves).find(([,move])=>move.intent === 'attack' && !move.delay && move.damage);
  if (entry) enemy.intent = {kind:'attack',moveId:entry[0],damage:entry[1].damage,hits:entry[1].hits||1};
}
fixture.combatSetReactions('p1',true);
writeFileSync(savePath,JSON.stringify(fixture.serialize()));
writeFileSync(out+'/packaged-lan-fixture.json',JSON.stringify({build:box,mode:'Authored saved combat, real LAN transport and production commands; not a full playthrough',enemyIds:fixture.live.combat.enemies.map(e=>e.enemyId)},null,2));
const {server,url} = await serve({root:root+'/dist',port:0,open:false,lan:true,quiet:true});
const errors=[],failures=[];
const watch = p => { p.setDefaultTimeout(10000); p.on('pageerror',e=>{errors.push({url:p.url(),message:e.message});console.log('PAGEERROR',e.message)});p.on('response',r=>{if(r.status()>=400)failures.push({status:r.status(),url:r.url()})});p.on('requestfailed',r=>failures.push({url:r.url(),failure:r.failure()?.errorText})); };
const launched = await launchBrowser({browser:process.env.BROWSER_BIN,prefix:'reaction-packaged-',args:['--headless=new','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const browser = await chromium.connectOverCDP(launched.wsUrl);
const context = await browser.newContext({viewport:{width:1440,height:900}});
const touchContext = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const hostPage = await context.newPage(), guestPage = await touchContext.newPage(), page = await context.newPage(), nativePage = await touchContext.newPage();
for (const p of [hostPage,guestPage,page,nativePage]) watch(p);
const shot = async (p,name) => { await p.screenshot({path:out+'/'+name+'.png',fullPage:false});console.log('SHOT',name) };
try {
  await Promise.all([hostPage,guestPage].map(p=>p.goto(url+'AshenSpire.html',{waitUntil:'commit',timeout:120000})));
  await Promise.all([page,nativePage].map(p=>p.goto(url+'AshenSpire.html?shot=combat&class=reaver&shotReaction=counter&shotReactionVersion=1&shotKnowledgeVersion=0',{waitUntil:'commit',timeout:120000})));
  console.log('BUILD',JSON.stringify(box),'URL',url,'READY FOR COMMANDS');
  for await (const line of createInterface({input:process.stdin,terminal:false})) {
    if (line === 'CLOSE') break;
    try { console.log('RESULT',await eval(`(async()=>{${line}})()`)) } catch(e){ console.log('COMMAND ERROR',e.stack) }
    console.log('READY FOR COMMANDS');
  }
} finally { await fetch(url+'api/lan/unhost',{method:'POST'}).catch(()=>{});await browser.close(); await launched.close(); server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
