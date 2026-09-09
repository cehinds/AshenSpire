import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardDragConfig, cardDragVelocity, cardDragPlan } from '../src/ui/models/CardDragModel.js';
import { balance } from '../src/content/balance.js';
import { trackGesture } from '../src/ui/gesture.js';
import { armHold, holdMs, HOLD_POINTER_SLOP } from '../src/ui/components/holdconfirm.js';
import { rewardDom } from './helpers/reward-dom.mjs';

export function runCardDragTests() {
  let checks = 0;
  const check = (value, expected, why) => { assert.deepEqual(value, expected, why); checks++; };
  const config = cardDragConfig({}, balance.ui.cardDrag);
  const start = { x: 200, y: 650 };
  const enemies = [{ id: 'left', x: 100, y: 250 }, { id: 'right', x: 300, y: 250 }];
  const plan = (overrides = {}) => cardDragPlan({ start, point: { x: 200, y: 602 }, config, mode: 'none', ...overrides });
  check(config.distance, 48, 'default displacement');
  for (const [key, distance] of Object.entries(balance.ui.cardDrag.distances)) check(cardDragConfig({cardDragDistance:key}, balance.ui.cardDrag).distance, distance, `setting ${key}`);
  check(cardDragConfig({cardDragDistance:'invalid',cardFlick:'false'}, balance.ui.cardDrag), config, 'invalid saved settings use defaults');
  check(plan().legal, true, '48 px slow pull plays without target overlap');
  check(plan({point:{x:200,y:602.01}}).legal, false, 'below distance cancels');
  check(plan({point:{x:200,y:626},velocity:0.3}).legal, true, '24 px fast flick');
  check(plan({point:{x:200,y:626.01},velocity:2}).legal, false, 'fast jitter cannot play');
  check(plan({point:{x:200,y:626},velocity:0.299}).legal, false, 'velocity lower edge');
  check(plan({point:{x:200,y:626},velocity:2,config:cardDragConfig({cardFlick:false},balance.ui.cardDrag)}).legal,false,'flick disabled');
  check(plan({point:{x:260,y:640},velocity:2}).legal,false,'horizontal hand scrolling');
  check(plan({point:{x:200,y:700},velocity:2}).legal,false,'downward gesture');
  check(plan({peakUp:70}).legal,false,'return toward hand disarms');
  check(plan({blocked:true,directTarget:'self'}).legal,false,'overlay or busy state wins');
  check(plan({point:{x:200,y:649},directTarget:'self'}).legal,true,'direct self drop retained');
  check(plan({mode:'single',enemies}).legal,false,'equidistant directional targets cancel');
  check(plan({mode:'single',enemies,point:{x:184,y:586}}).targetIds,['left'],'ray targets left');
  check(plan({mode:'single',enemies,point:{x:216,y:586}}).targetIds,['right'],'ray targets right');
  check(plan({mode:'single',enemies:[enemies[0]]}).targetIds,['left'],'one enemy needs no precise aim');
  check(plan({mode:'single',enemies:[]}).legal,false,'no living target');
  check(plan({mode:'single',enemies,directTarget:'right'}).targetIds,['right'],'direct hit overrides ray');
  check(plan({mode:'all',enemies}).targetIds,['left','right'],'all targets previewed');
  check(cardDragVelocity([{x:0,y:100,time:0}],{x:0,y:70,time:100},100),0.3,'velocity boundary');
  check(cardDragVelocity([{x:0,y:100,time:0}],{x:0,y:70,time:101},100),0,'stale velocity cannot fling');
  check(cardDragVelocity([{x:0,y:100,time:10}],{x:0,y:70,time:10},100),0,'zero-time event cannot fling');

  // Execute the production wiring with a deterministic event/geometry fixture.
  // The host closure is injected; trackGesture and armHold are the real modules.
  // No browser rendering, hardware input or responsive geometry is claimed.
  const combatSource = readFileSync(new URL('../src/ui/screens/combat.js', import.meta.url), 'utf8');
  const from = combatSource.indexOf('  function wireCardInput(');
  const to = combatSource.indexOf("\n  combatEl.addEventListener('click'", from);
  assert.ok(from >= 0 && to > from, 'production card wiring boundary');
  const dom = rewardDom();
  const saved = Object.fromEntries(Object.keys(dom).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, dom);
  try {
    for (const holdConfirm of ['normal', 'off']) for (const pointerType of ['touch', 'mouse', 'pen']) {
      const app = document.createElement('div'); document.body.append(app);
      const combatEl = document.createElement('div'); app.append(combatEl);
      const card = document.createElement('div'); card.className = 'card'; combatEl.append(card);
      card.box = {left:180,top:600,width:140,height:196}; card.offsetWidth=140; card.offsetHeight=196;
      const enemy = document.createElement('div'); enemy.className='enemy'; enemy.dataset.eid='enemy-1'; enemy.box={left:80,top:100,width:100,height:150}; combatEl.append(enemy);
      document.elementFromPoint = () => card; // release never overlaps a target
      let liveSettings = {holdConfirm};
      const meta={settings:liveSettings}, plays=[], previews=[];
      const bind = {
        app, combatEl, meta, combat:{player:{id:'player',alive:true},enemies:[{id:'enemy-1',alive:true}]},
        registries:{balance}, cardDragConfig,cardDragVelocity,cardDragPlan, getSettings:()=>liveSettings,
        resolveCard:()=>({}),friendlyTargetPlan:()=>({legalIds:[]}),friendlyTargetMode:()=> 'none',
        trackGesture,armHold,holdMs,HOLD_POINTER_SLOP,
        hideTooltip(){}, clearAim(){}, clearTargetSilhouettes(){},
        setAim(node){previews.push(node.dataset.eid);},
        anchorLocalBox:(origin,node)=>node.box || node,
        viewportLocalBox:()=>({left:0,top:0,width:390,height:844}),
        clampBox:box=>box, VIEWPORT_ORIGIN:'viewport',
        getComputedStyle:()=>({zoom:1}),
        playCard:(...args)=>plays.push(args), syncCardSelection(){}, focusTargeting(){}, showTooltipFor(){},
        $:selector=>app.querySelector(selector),isUnplayable:()=>false,
      };
      const factory = new Function(...Object.keys(bind), `let busy=false, selected='other-card', selfArm=null, selectedFlask=null;\n${combatSource.slice(from,to)}\nreturn wireCardInput;`);
      const wire = factory(...Object.values(bind));
      wire(card,{instanceId:'dragged-card',cardId:'test-card'},{values:[],needsTarget:true,cost:1,manaCost:0,staminaCost:0},true);
      const pointer = (type,x,y,time,pointerId=1) => new dom.Event(type,{clientX:x,clientY:y,timeStamp:time,pointerType,pointerId,button:0,bubbles:true});
      const begin = time => card.dispatchEvent(pointer('pointerdown',200,650,time));
      const move = (y,time,id=1) => window.dispatchEvent(pointer('pointermove',200,y,time,id));
      const end = (type,y,time,id=1) => window.dispatchEvent(pointer(type,200,y,time,id));
      begin(0); move(626,50);
      check(combatEl.dataset.dropState,'legal',`${pointerType}/${holdConfirm}: first flick move previews target`);
      check(plays.length,0,'crossing threshold never commits before release');
      end('pointerup',626,60);
      card.click();
      check(plays,[['dragged-card','enemy-1']],`${pointerType}/${holdConfirm}: short flick plays dragged identity once`);
      begin(200); move(602,400); end('pointercancel',602,410); end('pointerup',602,420);
      check(plays.length,1,'cancel and stray release cannot play');
      begin(500); move(580,550,2); end('pointerup',580,560,2);
      check(plays.length,1,'foreign pointer cannot own gesture');
      move(600,700); move(638,710); end('pointerup',638,720);
      check(plays.length,1,'return-to-hand cancels');
      liveSettings = {...liveSettings,cardFlick:false};
      begin(800); move(626,830); end('pointerup',626,840);
      check(plays.length,1,'replacement profile settings are read at next press');
      begin(1000); move(602,1200); end('pointerup',602,1210);
      check(plays.length,2,'slow drag still works with flick disabled');
      begin(1300); move(600,1500); window.dispatchEvent(new dom.Event('blur'));
      end('pointerup',600,1510);
      check(plays.length,2,'window blur cancels pending play');
      begin(1600); move(600,1800); card.dispatchEvent(pointer('lostpointercapture',200,600,1810));
      end('pointerup',600,1820);
      check(plays.length,2,'lost pointer capture cancels pending play');
      check(document.querySelectorAll('.card-drag-ghost').length,0,'end removes ghost');
      app.remove();
    }
  } finally { for (const [key,value] of Object.entries(saved)) { if(value===undefined) delete globalThis[key]; else globalThis[key]=value; } }
  return checks;
}
if (process.argv[1]?.endsWith('card-drag.test.mjs')) console.log(`card-drag: OK — ${runCardDragTests()} checks passed`);
