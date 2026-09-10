import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.env.COMBAT_QA_URL || 'http://localhost:8326/index.html';
const out = resolve(process.env.COMBAT_QA_OUT || 'outputs/combat-sprite-scale');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [], results = [];
try {
  for (const [width,height] of [[1440,900],[390,844],[320,640],[844,390]].filter(s=>!process.env.QA_WIDTH||s[0]===Number(process.env.QA_WIDTH))) {
    const page = await browser.newPage({ viewport:{width,height} });
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(60000);
    page.on('pageerror',e=>errors.push(e.message));
    for (const enemyId of ['courtDuelist','stitchedKing','ashheartDragon']) {
      await page.goto(base+'?shot=combat&shotScene=cinder-reach-4',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>window.__renderCombatForShot);
      await page.evaluate(async enemyId=>{
        const {contentBundle}=await import('./src/content/index.js');
        const {createRegistries}=await import('./src/model/registries.js');
        const {createCombat}=await import('./src/engine/combat.js');
        const {createRng}=await import('./src/engine/rng.js');
        const c=createCombat({registries:createRegistries(contentBundle),rng:createRng(231),player:{classId:'reaver',maxHp:10000,hp:10000,maxMana:0,mana:0,maxStamina:3,stamina:3,energyMax:3,drawPerTurn:0,deck:[],relicIds:[],flasks:[]},enemyIds:[enemyId]});
        window.__combat.enemies.splice(0,window.__combat.enemies.length,...c.enemies);
        window.__combat.player.hp=window.__combat.player.maxHp=10000;
        window.__renderCombatForShot();
      },enemyId);
      await page.waitForFunction(()=>[...document.querySelectorAll('.combatant .enemy-pose-idle, .combatant .painted-stage .pose-frame:not(.pose-previous)')].every(img=>img.complete&&img.naturalWidth));
      await page.waitForTimeout(1000);
      const geometry=await page.evaluate(()=>{
        const f=document.querySelector('.field').getBoundingClientRect();
        return {field:{top:f.top,bottom:f.bottom},overflow:document.documentElement.scrollWidth>innerWidth,
          actors:[...document.querySelectorAll('.combatant')].map(e=>{
            const s=e.querySelector('.sprite').getBoundingClientRect(),m=e.querySelector('.meters').getBoundingClientRect();
            return {id:e.dataset.eid,ratio:Number(e.dataset.spriteRatio),height:Number(e.dataset.spriteVisibleHeight),
              row:e.dataset.formationRow,feet:s.bottom,ground:f.top+f.height*Number(e.dataset.groundRatio),hpY:m.y,hpWidth:m.width,spriteTop:s.top};
          })};
      });
      const [player,enemy]=geometry.actors;
      if(geometry.overflow||geometry.actors.some(a=>Math.abs(a.feet-a.ground)>1||a.spriteTop<geometry.field.top-1)||Math.abs(player.hpY-enemy.hpY)>1||Math.abs(enemy.height/player.height-enemy.ratio)>.01)throw Error(JSON.stringify({width,enemyId,geometry}));
      const label=enemyId+'-'+width;
      await page.screenshot({path:resolve(out,label+'.png')});
      results.push({label,...geometry});
      console.log('PASS',label,JSON.stringify(geometry.actors));
      if(enemyId==='stitchedKing') {
        const first=page.locator('.hand .card').last();
        await first.click();
        if(!await page.locator('.card-info-button').count()) throw Error('card selection lost inspect control');
        await page.locator('.end-turn').hover(); await page.mouse.down(); await page.waitForTimeout(1600); await page.mouse.up();
        await page.waitForFunction(()=>document.querySelector('.combat').dataset.turn==='enemy',null,{timeout:7000});
        await page.waitForFunction(()=>document.querySelector('.combat').dataset.turn==='player',null,{timeout:30000});
        await page.waitForTimeout(300);
        const after=await page.locator('.combatant').evaluateAll(es=>es.map(e=>({height:Number(e.dataset.spriteVisibleHeight),feet:e.querySelector('.sprite').getBoundingClientRect().bottom})));
        if(after.some((a,i)=>Math.abs(a.height-geometry.actors[i].height)>1||Math.abs(a.feet-geometry.actors[i].feet)>1))throw Error('formation changed after turn');
      }
    }
    await page.close();
  }
  if(errors.length)throw Error(errors.join('\n'));
  writeFileSync(resolve(out,'checks.json'),JSON.stringify({base,results,errors},null,2));
}finally{await browser.close();}
