import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {combatPlayerInfoRect,combatPlayerActionRect,combatTargetHudFootprints,visibleCombatPanelRect} from '../src/ui/components/battlefieldStage.js';
import {playerDetailsPlacement} from '../src/ui/models/PlayerDetailsPlacementModel.js';

test('current HUD tracking and footer reads reserve the incoming independent Info and sibling toolbar across a fade',()=>{
  const source=readFileSync(new URL('../src/ui/components/battlefieldStage.js',import.meta.url),'utf8');
  const begin=source.indexOf('  function placePlayerHud('),end=source.indexOf('  function trackPlayerHud()',begin);
  const obstacleBegin=source.indexOf('    const readFooterObstacles = () => {'),obstacleEnd=source.indexOf('    const footerSize =',obstacleBegin);
  assert.ok(begin>=0&&end>begin&&obstacleBegin>=0&&obstacleEnd>obstacleBegin);
  const previousStyle=globalThis.getComputedStyle,zoom=.738;
  let delta=0,visible=false,options;
  const fieldRect=()=>({left:0,top:81+delta});
  const viewport=()=>({left:0,top:delta,right:390,bottom:650+delta});
  const combat={style:{opacity:'0'},parentElement:null,getBoundingClientRect:viewport};
  const tools={style:{},parentElement:combat,getBoundingClientRect:()=>({left:164,right:384,top:356+delta,bottom:400+delta,width:220,height:44})};
  const field={style:{},parentElement:combat,getBoundingClientRect:fieldRect,closest:()=>combat};
  const leading={style:{},parentElement:field,getBoundingClientRect:()=>({left:parseFloat(leading.style.left)*zoom||134,
    top:parseFloat(leading.style.top)*zoom||246+delta,width:112,height:55}),querySelector:selector=>selector.includes('combatant-info')?info:selector==='.player-action-intent'?null:{}};
  const info={style:{},parentElement:leading,getBoundingClientRect:()=>visible?{width:44,height:44,
    left:leading.getBoundingClientRect().left+(parseFloat(info.style.left)||0)*zoom,
    top:leading.getBoundingClientRect().top+(parseFloat(info.style.top)||0)*zoom}:{width:0,height:0}};
  const sprite={},player={classList:{contains:()=>false},dataset:{},querySelector:selector=>selector==='.sprite'?sprite:
    selector==='.combatant-leading'?leading:{getBoundingClientRect:()=>({left:0,top:0})}};
  combat.querySelector=selector=>selector==='.combat-tools'?tools:selector==='.combat-hud'?{getBoundingClientRect:()=>({bottom:80+delta})}:null;
  combat.querySelectorAll=()=>[]; // The hidden reading door has no painted DOM rectangle.
  field.querySelectorAll=selector=>selector==='.combatant.player'?[player]:[];
  const settledTargets=[{id:'e1',x:264,y:200,width:88},{id:'e3',x:264,y:154,width:88}];
  const context={field,settledTargets,settledFooterSize:44,playerInfoRects:[],combatTargetHudFootprints,
    combatPlayerInfoRect,combatPlayerActionRect,visibleCombatPanelRect,uiZoom:()=>zoom,
    currentSpriteArtBounds:()=>({left:50,right:130,top:230+delta,bottom:300+delta}),readRestingHand:()=>({clearanceTop:404+delta}),
    playerDetailsPlacement:input=>{options=input;return playerDetailsPlacement(input);},
    anchorLocalBox:(host,rect,{zoom})=>({left:(rect.left-host.left)/zoom,top:(rect.top-host.top)/zoom}),
    combat};
  globalThis.getComputedStyle=node=>({display:'block',visibility:'visible',opacity:'1',
    width:String(44/zoom),minWidth:String(44/zoom),...node.style});
  const tracking=runInNewContext(source.slice(begin,end)+'\nplacePlayerHud',context);
  const obstacles=runInNewContext(source.slice(obstacleBegin,obstacleEnd)+'\nreadFooterObstacles',context);
  const clear=(a,b)=>a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom;
  try{
    for(let frame=0;frame<60;frame++){
      visible=frame>=20;delta=frame>=40?8:0;tracking();
      const expected=combatPlayerInfoRect(info,{left:50,right:130,top:230+delta},viewport(),zoom);
      assert.equal(options.gap,4);assert.equal(options.handTop,356+delta,'incoming tools ceiling precedes the later hand clearance');
      assert.ok(options.obstacles.some(box=>box.left===tools.getBoundingClientRect().left&&box.top===356+delta),
        'the sibling toolbar is reserved even at the common fade boundary');
      assert.ok(options.obstacles.some(box=>box.left===expected.left&&box.top===expected.top&&box.width===44));
      const panel=leading.getBoundingClientRect(),actual={left:panel.left,right:panel.left+112,top:panel.top,bottom:panel.top+55};
      assert.ok(clear(actual,expected));assert.ok(combatTargetHudFootprints(settledTargets,fieldRect(),44).every(box=>clear(actual,box)));
      assert.ok(Math.abs(panel.left+(parseFloat(info.style.left)||0)*zoom-expected.left)<1e-9);
      assert.ok(Math.abs(panel.top+(parseFloat(info.style.top)||0)*zoom-expected.top)<1e-9,
        'the positioned Info matches its reserved box at every visibility/translation state');
      const packed=obstacles();
      assert.ok(packed.some(box=>box.left===expected.left-8&&box.right===expected.right+8
        &&box.top===expected.top-8&&box.bottom===expected.bottom+8),
        'the actual footer-obstacle reader reserves the hidden/future Info independently from the HUD');
    }
  }finally{if(previousStyle===undefined)delete globalThis.getComputedStyle;else globalThis.getComputedStyle=previousStyle;}
});

test('the first co-op panel reserves every later independently anchored Info before placement',()=>{
  const source=readFileSync(new URL('../src/ui/components/battlefieldStage.js',import.meta.url),'utf8');
  const begin=source.indexOf('  function placePlayerHud('),end=source.indexOf('  function trackPlayerHud()',begin);
  const calls=[],viewport={left:0,top:0,right:600,bottom:650};
  const combat={getBoundingClientRect:()=>viewport,querySelector:()=>null};
  const infos=[{width:44,height:44,left:60,right:104,top:176,bottom:220},
    {width:44,height:44,left:340,right:384,top:176,bottom:220}];
  const players=infos.map((infoRect,index)=>{
    const sprite={index},inspect={style:{},infoRect};
    const leading={style:{},getBoundingClientRect:()=>({left:130+index*280,top:230,width:100,height:55}),
      querySelector:selector=>selector==='.combatant-info'?inspect:selector==='.player-action-intent'?null:{}};
    return {classList:{contains:()=>true},dataset:{},querySelector:selector=>selector==='.sprite'?sprite:
      selector==='.combatant-leading'?leading:{getBoundingClientRect:()=>({left:0,top:0})}};
  });
  const field={closest:()=>combat,getBoundingClientRect:()=>({left:0,top:80}),
    querySelectorAll:selector=>selector==='.combatant.player'?players:[]};
  const tracking=runInNewContext(source.slice(begin,end)+'\nplacePlayerHud',{
    field,uiZoom:()=>1,visibleCombatPanelRect:()=>null,settledTargets:[],settledFooterSize:44,
    readRestingHand:()=>null,currentSpriteArtBounds:sprite=>({left:60+sprite.index*280,right:104+sprite.index*280,top:224,bottom:300}),
    combatPlayerInfoRect:node=>node.infoRect,combatPlayerActionRect,combatTargetHudFootprints,playerInfoRects:[],
    playerDetailsPlacement:options=>{calls.push([...options.obstacles]);return {left:130+calls.length*10,top:230};},
    anchorLocalBox:(host,rect)=>({left:rect.left-host.left,top:rect.top-host.top}),
  });
  tracking();
  assert.equal(calls.length,2);
  for(const obstacles of calls)for(const info of infos)assert.ok(obstacles.includes(info),
    'a later hidden door cannot be omitted from an earlier co-op panel candidate');
});
