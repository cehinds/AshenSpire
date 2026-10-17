import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
// These source-slice fixtures exercise the retained Classic/co-op HUD path.
// Alternative native body-head placement has its own real-pose browser tests.
// HUD layout geometry tokens unset (getComputedStyle → {}): every offset is 0.
import {hudGeometry,offsetPlacement} from '../src/ui/models/HudLayoutOffsetModel.js';
import {combatPlayerInfoRect,combatPlayerActionRect,combatFrameTarget,combatTargetHudFootprints} from '../src/ui/components/battlefieldStage.js';
import {COMBAT_TARGET_HIT_PX,combatTargetPackSize} from '../src/ui/models/CombatOverheadModel.js';

const source=readFileSync(new URL('../src/ui/components/battlefieldStage.js',import.meta.url),'utf8');

test('compact selected and idle panels reserve all seats actual22px Info and24px action doors before placement',()=>{
  const oldStyle=globalThis.getComputedStyle,zoom=.75;
  globalThis.getComputedStyle=node=>({width:String(node.size/zoom),minWidth:'0'});
  try{
    const viewport={left:0,top:0,right:320,bottom:650,width:320,height:650},options=[],doors=[];
    const players=[true,false].map((selected,index)=>{
      const sprite={index},art={left:40+index*160,right:100+index*160,top:190,bottom:300};
      const inspect={size:22,style:{},dataset:{},getBoundingClientRect:()=>({width:0,height:0})};
      const action={size:24,style:{},getBoundingClientRect:()=>({width:24,height:24})};
      const infoRect=combatPlayerInfoRect(inspect,art,viewport,zoom);
      doors.push(infoRect,combatPlayerActionRect(action,infoRect,art,zoom));
      const leading={style:{},getBoundingClientRect:()=>({left:110,top:230,width:128,height:26}),
        querySelector:selector=>selector==='.combatant-info'?inspect:selector==='.player-action-intent'?action:{}};
      return {dataset:{},classList:{contains:()=>selected},querySelector:selector=>selector==='.sprite'?sprite:
        selector==='.combatant-leading'?leading:{getBoundingClientRect:()=>({left:0,top:0})}};
    });
    const combat={dataset:{targetHud:'false'},getBoundingClientRect:()=>viewport,querySelector:()=>null};
    const field={closest:()=>combat,getBoundingClientRect:()=>({left:0,top:80}),querySelectorAll:s=>s==='.combatant.player'?players:[]};
    const begin=source.indexOf('  function placePlayerHud('),end=source.indexOf('  function trackPlayerHud()',begin);
    const sync=runInNewContext(source.slice(begin,end)+'\nplacePlayerHud',{hudGeometry,offsetPlacement,classicAppearance:()=>true,getComputedStyle:()=>({}),
      field,uiZoom:()=>zoom,visibleCombatPanelRect:()=>null,settledTargets:[],settledFooterSize:44,playerInfoRects:[],
      readRestingHand:()=>({clearanceTop:340}),currentSpriteArtBounds:s=>({left:40+s.index*160,right:100+s.index*160,top:190,bottom:300}),
      combatPlayerInfoRect,combatPlayerActionRect,placePlayerIntentGlyph:()=>null,combatTargetHudFootprints,
      playerDetailsPlacement:input=>{options.push(input);return {left:110,top:230};},
      anchorLocalBox:(host,rect)=>({left:rect.left-host.left,top:rect.top-host.top}),
    });
    sync(true);
    assert.deepEqual(options.map(o=>o.gap),[3,4],'incoming compact selected/idle gaps survive');
    assert.equal(options[0].art.top,274,'selected preferred panel remains at artwork bottom');
    assert.equal(options[1].art.top,287,'idle preferred panel remains below the art before obstacle search');
    for(const input of options)for(const door of doors)assert.ok(input.obstacles.some(o=>o.left===door.left&&o.top===door.top&&o.width===door.width),
      'even the later hidden Info and action are precollected');
  }finally{if(oldStyle===undefined)delete globalThis.getComputedStyle;else globalThis.getComputedStyle=oldStyle;}
});

test('the actual footer pack keeps an unselected armed player and every enemy physical44 target',()=>{
  const begin=source.indexOf('    const footerSize ='),end=source.indexOf('    settledTargetCores = targetCores;',begin);
  const fieldRect={left:0,top:90,width:1440,height:417.28125};
  const boxes=[{hostRect:{left:484.54684,width:100,bottom:779.2808},frameRect:{},footerWidth:0,footerHeight:7,controls:[]},
    {hostRect:{left:600,width:100,bottom:400},frameRect:{},footerWidth:104,footerHeight:24,controls:[]}];
  const placed=boxes.map((box,index)=>({sprite:{art:{left:box.hostRect.left,right:box.hostRect.left+box.hostRect.width,top:box.hostRect.bottom-120,bottom:box.hostRect.bottom}},frame:{dataset:{eid:index?'enemy':'player'},classList:{contains:role=>role===(index?'enemy':'player')||role==='context-selected'&&!!index}}}));
  let packInput;
  runInNewContext(source.slice(begin,end),{fieldRect,boxes,placed,combatFrameTarget,COMBAT_TARGET_HIT_PX,combatTargetPackSize,
    combat:{dataset:{targetHud:'false'},getBoundingClientRect:()=>({bottom:900})},currentSpriteArtBounds:sprite=>sprite.art,refresh:()=>{},readFooterObstacles:()=>[],placePlayerHud:()=>{},
    combatTargetAnchors:input=>{packInput=input;return input.targets;},packCombatTargetsWithHud:input=>input.pack()});
  assert.equal(packInput.obstacles.length,2,'the pack reserves each painted combatant artwork box');
  assert.deepEqual(Array.from(packInput.obstacles,o=>o.ownerId),['player','enemy'],'painted reservations retain owner identity');
  for(let i=0;i<placed.length;i++){
    assert.equal(packInput.obstacles[i].left,placed[i].sprite.art.left-fieldRect.left);
    assert.equal(packInput.obstacles[i].top,placed[i].sprite.art.top-fieldRect.top);
  }
  assert.equal(packInput.size,44,'compact24px painting cannot shrink the physical proxy');
  assert.equal(packInput.targets.length,2,'an armed but unselected player must not bypass packing');
  assert.equal(packInput.targets[0].y,fieldRect.height-22);assert.equal(packInput.targets[0].minY,22);
  assert.equal(packInput.targets[1].minY,400-90+22,'enemy body-bottom floor stays authoritative');
  assert.equal(packInput.targets[1].width,104,'the full selected enemy footer remains reserved');
});

test('native target HUD delegates to its body-head owner before legacy panel placement',()=>{
  const begin=source.indexOf('  function placePlayerHud('),end=source.indexOf('  function trackPlayerHud()',begin);
  let calls=0;
  const sync=runInNewContext(source.slice(begin,end)+'\nplacePlayerHud',{
    field:{closest:()=>({dataset:{targetHud:'true'}})},centerTargetOverheads:()=>calls++,
  });
  sync();
  assert.equal(calls,1);
});
