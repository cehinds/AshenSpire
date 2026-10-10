import test from 'node:test';
import assert from 'node:assert/strict';
import { handLayout, handGeometryKey, restingHandEnvelope } from '../src/ui/models/HandLayout.js';
import { playerDetailsPlacement } from '../src/ui/models/PlayerDetailsPlacementModel.js';
import { visibleCombatPanelRect, combatControlWidth, combatPlayerInfoRect, packCombatTargetsWithHud, combatTargetHudFootprints } from '../src/ui/components/battlefieldStage.js';
import { combatTargetAnchors } from '../src/ui/models/CombatOverheadModel.js';

test('actual 1203 phone XL blocked feet obtain a full clear footer pack after one HUD retry', () => {
  // Passive packaged capture: field top74.734375, HUD128x79.9375, hidden
  // physical44px Info door, full104px enemy footers and the resting hand.
  const fieldTop = 74.734375, fieldHeight = 275.203125, handTop = 354.4850323884865;
  const door = 43.98876382978723;
  const targets = [
    { id:'player', x:91.65625, y:477.3125-fieldTop+22, width:48 },
    { id:'e1', x:165.7421875, y:303.15625-fieldTop+22, width:104 },
    { id:'e2', x:263.2421875, y:303.15625-fieldTop+22, width:104 },
    { id:'e3', x:165.734375, y:259.109375-fieldTop+22, width:104 },
  ];
  const intents = [
    {left:113.25,right:209.25,top:195.453125,bottom:249.84375},
    {left:215.25,right:311.25,top:195.453125,bottom:249.84375},
    {left:117.75,right:213.75,top:129.953125,bottom:184.34375},
  ];
  const fixed = [
    {left:0,right:390,top:0,bottom:fieldTop},
    {left:92.8125,right:297.1875,top:fieldTop,bottom:97.078125},
    {left:241.96875,right:378,top:458.09375,bottom:550.09375},
    {left:78.625,right:142.640625,top:557.984375,bottom:650},
    {left:145.828125,right:244.171875,top:566.265625,bottom:641.71875},
    {left:247.359375,right:311.375,top:557.984375,bottom:650},
    {left:314.5625,right:390.015625,top:566.265625,bottom:641.71875},
    {left:0,right:241.953125,top:handTop,bottom:557.984375}, ...intents,
  ];
  const placement = {art:{right:153.359375,top:346.3804572610294},width:128,height:79.9375,
    viewport:{left:0,top:0,right:390,bottom:650},handTop,hudBottom:fieldTop,leftOverhang:door};
  const originalInputs = structuredClone({targets,fixed,placement});
  let hud = {left:163.359375,top:264.5625}, packCount = 0, hudCount = 0;
  const obstacles = () => [...fixed, {left:hud.left-door-8,right:hud.left+128+8,
    top:hud.top-8,bottom:hud.top+79.9375+8}]
    .map(r=>({...r,top:r.top-fieldTop,bottom:r.bottom-fieldTop}));
  const pack = () => { packCount++;
    return combatTargetAnchors({width:390,height:650-fieldTop-60,size:44,
      lockX:true,maxShiftX:44,targets,obstacles:obstacles()}); };
  const before = pack(); packCount = 0;
  assert.deepEqual(before.filter(t=>t.obstructed).map(t=>t.id).sort(),['e1','e3'],
    'the actual panel footprint reproduces the packaged native failure');
  const targetCores = targets.map(t=>({id:t.id,left:t.x-22,right:t.x+22,
    top:fieldTop+t.y-22,bottom:fieldTop+t.y+22}));
  const fit = () => packCombatTargetsWithHud({pack,targetCores,placeHud:cores=>{
    hudCount++;
    assert.deepEqual(cores.map(c=>c.id).sort(),['e1','e3'],'only blocked original physical cores constrain the retry');
    hud = playerDetailsPlacement({...placement,obstacles:[...intents,...cores]});
  }});
  const after = fit();
  assert.equal(packCount,2,'one initial pack and one bounded retry');
  assert.equal(hudCount,1);
  assert.ok(hud.left>230,'the panel uses the clear right-side slot');
  assert.ok(hud.left-door>=10&&hud.left+128<=380,'the complete Info/panel footprint remains visible');
  assert.ok(hud.top+79.9375<=handTop-10,'the panel keeps the authored hand clearance');
  const rect = t=>({left:t.x-t.width/2,right:t.x+t.width/2,top:t.y-22,bottom:t.y+22});
  const clear = (a,b)=>a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom;
  for(const target of after){
    assert.equal(target.obstructed,false,target.id+' is fully clear');
    const source=targets.find(t=>t.id===target.id), box=rect(target);
    assert.ok(Math.abs(target.x-source.x)<=44,target.id+' stays within the existing horizontal limit');
    assert.ok(box.left>=0&&box.right<=390&&box.top>=0&&box.bottom<=650-fieldTop-60);
    assert.ok(obstacles().every(o=>clear(box,o)),target.id+' reserves its complete visible footer, HUD, hand and controls');
    assert.ok(after.filter(t=>t.id!==target.id).every(t=>clear(box,rect(t))),target.id+' clears every other complete footer');
    if(target.id!=='player')assert.ok(Math.abs(target.y-Math.min(source.y,fieldHeight-22))<=88,
      target.id+' preserves the native owner-cue limit');
  }
  const settledHud=playerDetailsPlacement({...placement,obstacles:[...intents,
    ...after.filter(t=>t.id!=='player').map(t=>{const box=rect(t);
      return {...box,top:box.top+fieldTop,bottom:box.bottom+fieldTop};})]});
  assert.deepEqual(settledHud,hud,'the subsequent HUD tracking pass keeps the same slot beside the complete settled footers');
  // A load/pose callback may see the old or replacing name/HP children. The
  // packed footer receipt, rather than those DOM children, is its reservation.
  const oldTracking=playerDetailsPlacement({...placement,obstacles:intents});
  const footprints=combatTargetHudFootprints(after,{left:0,top:fieldTop},44);
  const tracked=playerDetailsPlacement({...placement,previous:hud,obstacles:[...intents,...footprints]});
  const hudRect=p=>({left:p.left-door,right:p.left+128,top:p.top,bottom:p.top+79.9375});
  assert.ok(footprints.some(foot=>!clear(hudRect(oldTracking),foot)),
    'tracking only current readable children can overwrite a successfully packed target');
  assert.deepEqual(tracked,hud,'tracking retains a clear accepted panel beside all settled full-width plates');
  for(let frame=0;frame<60;frame++)assert.deepEqual(playerDetailsPlacement({...placement,
    previous:tracked,obstacles:[...intents,...footprints]}),tracked,'repeated tracking cannot undo the target pack');
  assert.deepEqual({targets,fixed,placement},originalInputs,'artwork anchors, panel inputs and existing obstacles never mutate');
  assert.deepEqual(fit(),after,'settled retry is idempotent');
  assert.equal(hudCount,1,'an already-clear pack does not move the HUD again');
});

test('clear target layouts return their exact original anchors without a HUD retry', () => {
  const original=combatTargetAnchors({width:390,height:300,size:44,lockX:true,maxShiftX:44,
    targets:[{id:'player',x:80,y:140,width:48},{id:'enemy',x:290,y:220,width:104}]});
  const result=packCombatTargetsWithHud({pack:()=>original,targetCores:[],
    placeHud:()=>assert.fail('ordinary clear layouts must retain the exact first placement')});
  assert.equal(result,original);
});

test('an infeasible target retry restores the HUD and preserves explicit obstruction', () => {
  const pack=()=>combatTargetAnchors({width:120,height:60,size:44,lockX:true,maxShiftX:44,
    targets:[{id:'enemy',x:60,y:30,width:104}],obstacles:[{left:0,right:120,top:0,bottom:60}]});
  const reservations=[];
  const result=packCombatTargetsWithHud({pack,placeHud:cores=>reservations.push(cores),
    targetCores:[{id:'enemy',left:38,right:82,top:8,bottom:52}]});
  assert.equal(result[0].obstructed,true,'no-room evidence remains explicit');
  assert.equal(reservations.length,2,'one retry then restoration, never a refresh loop');
  assert.deepEqual(reservations[1],[],'restore the original HUD reservation after no improvement');
});

test('the resting fan floor is the union of rotated authored corners at every text and phone scale', () => {
  for (const count of [0, 1, 5, 8, 15]) for (const zoom of [.67, .738, 1, 1.5]) {
    const plan = handLayout({ width: 296 / zoom, height: 234 / zoom, count, rem: 16 / zoom, zoom, controlsHeight: 100 / zoom });
    const tops = plan.cards.map(card => {
      const angle = Math.abs(card.angle) * Math.PI / 180;
      const cornerHeight = (Math.sin(angle) * plan.cardWidth + Math.cos(angle) * plan.cardHeight) / 2;
      return plan.top + card.y + plan.cardHeight / 2 - cornerHeight;
    });
    assert.equal(plan.restTop, tops.length ? Math.min(...tops) : 0);
    assert.ok(Number.isFinite(plan.restTop));
    assert.ok(plan.restTop >= 0, 'authored resting faces remain inside the clipped hand');
    if (count === 1) assert.ok(Math.abs(plan.restTop - plan.top) < 1e-9, 'an unrotated single face has no extra corner extent');
  }
});

function receipt() {
  const rect = { left: 50, top: 420, width: 296, height: 234 };
  const input = { rect, clientWidth: 400, clientHeight: 234 / .74, fontSize: '21.6px' };
  const plan = handLayout({ width: input.clientWidth, height: input.clientHeight, count: 8, rem: 16 / .74, zoom: .74, controlsHeight: 100 / .74 });
  return { ...input, restLeft: plan.restLeft, restTop: plan.restTop, clearanceTop: plan.clearanceTop,
    geometry: handGeometryKey({ width: input.clientWidth, height: input.clientHeight, zoom: .74, fontSize: input.fontSize, left: rect.left }) };
}

test('HUD hand clearance uses validated layout geometry and survives selection, pan, and equivalent remounts', () => {
  const input = receipt(); const copy = structuredClone(input);
  const envelope = restingHandEnvelope(input);
  assert.equal(envelope.validated, true);
  assert.equal(envelope.top, input.rect.top + input.restTop * .74);
  assert.equal(envelope.left, input.rect.left + input.restLeft * .74);
  // These are real presentation-only changes the hand can carry. None is a
  // source for the resting fan receipt or player details placement.
  const transformed = { ...input, selectedCardTop: 100, scrollLeft: 180, hoverLift: 30 };
  assert.equal(restingHandEnvelope(transformed, envelope), envelope);
  assert.equal(restingHandEnvelope(structuredClone(input), envelope), envelope);
  const shifted = restingHandEnvelope({ ...input, rect: { ...input.rect, top: 440 } }, envelope);
  assert.equal(shifted.top, envelope.top + 20, 'a genuine viewport movement must update the screen floor');
  assert.notEqual(shifted, envelope);
  assert.deepEqual(input, copy);
});

test('stale or absent fan receipts use a finite viewport fallback rather than previous transformed geometry', () => {
  const input = receipt(); const previous = restingHandEnvelope(input);
  for (const changed of [{ geometry: 'stale' }, { fontSize: '24px' }, { restTop: NaN }, { clientWidth: 390 }]) {
    const next = restingHandEnvelope({ ...input, ...changed }, previous);
    assert.equal(next.validated, false);
    assert.deepEqual([next.left, next.top], [input.rect.left, input.rect.top]);
  }
  assert.equal(restingHandEnvelope({ ...input, clientWidth: 0 }, previous), null);
});

test('clearance is authored before a hover, selection, wrapped chooser rise, or changed hand count', () => {
  for (const count of [0, 1, 8, 15]) for (const zoom of [.67, .738, 1, 1.5]) for (const controlsHeight of [0, 52 / zoom, 100 / zoom]) {
    const plan = handLayout({ width: 296 / zoom, height: 234 / zoom, count, rem: 16 / zoom, zoom, controlsHeight });
    assert.ok(plan.clearanceTop <= plan.restTop + 1e-9);
    for (const card of plan.cards) {
      const selectedTop = plan.top + card.y - plan.lift;
      assert.ok(plan.clearanceTop <= selectedTop + 1e-9, 'full selected faces cannot rise above the reserved HUD floor');
      if (controlsHeight > 0) assert.equal(plan.clearanceTop, 0, 'Upcast correction can admit its owner at the clipping edge');
    }
  }
});

test('beside-art player details honor the resting hand floor and visible enemy panels without moving their actor', () => {
  const input = receipt(); const envelope = restingHandEnvelope(input);
  const art = Object.freeze({ left: 70, right: 130, top: 340, bottom: 450 });
  const viewport = Object.freeze({ left: 0, right: 390, top: 0, bottom: 650 });
  const enemyPanel = Object.freeze({ left: 260, right: 364, top: 250, bottom: 320 });
  const options = { art, viewport, width: 128, height: 100, handTop: envelope.clearanceTop, hudBottom: 150, obstacles: [enemyPanel] };
  const placement = playerDetailsPlacement(options);
  assert.ok(placement.left >= viewport.left + 10 && placement.left + 128 <= viewport.right - 10);
  assert.ok(placement.top + 100 <= envelope.clearanceTop - 10, 'all resources clear every bounded raised selected face');
  assert.ok(placement.left + 128 + 10 <= enemyPanel.left || placement.left >= enemyPanel.right + 10
    || placement.top + 100 + 10 <= enemyPanel.top || placement.top >= enemyPanel.bottom + 10);
  assert.deepEqual(playerDetailsPlacement({ ...options, handTop: restingHandEnvelope({ ...input, selectedCardTop: 60 }, envelope).clearanceTop }), placement);
  assert.deepEqual(art, { left: 70, right: 130, top: 340, bottom: 450 });
});

test('hidden enemy and HUD ancestors never reserve ghost rectangles, while visible 104px footers remain complete', () => {
  const original = globalThis.getComputedStyle;
  const field = { style: {}, parentElement: null };
  const leading = { style: {}, parentElement: field };
  const rect = { left: 200, top: 280, width: 104, height: 44, right: 304, bottom: 324 };
  let reads = 0;
  const panel = { style: {}, parentElement: leading, getBoundingClientRect() { reads++; return rect; } };
  globalThis.getComputedStyle = node => ({ display: 'block', visibility: 'visible', opacity: '1', ...node.style });
  try {
    assert.equal(visibleCombatPanelRect(panel, field), rect);
    const before = reads;
    for (const hidden of [{ display: 'none' }, { visibility: 'hidden' }, { visibility: 'collapse' }, { opacity: '0' }]) {
      leading.style = hidden;
      assert.equal(visibleCombatPanelRect(panel, field), null);
    }
    assert.equal(reads, before, 'hidden layout boxes are not even measured');
    leading.style = {}; panel.hidden = true;
    assert.equal(visibleCombatPanelRect(panel, field), null);
    panel.hidden = false; field.style = { display: 'none' };
    assert.equal(visibleCombatPanelRect(panel, field), null);
    field.style = {};
    assert.equal(visibleCombatPanelRect(panel, field).width, 104);
    field.style = {opacity:'0'};
    assert.equal(visibleCombatPanelRect(panel, field).width,104,
      'a common screen fade must reserve the full panel that paints when it finishes');
    panel.style = {opacity:'0'};
    assert.equal(visibleCombatPanelRect(panel, field),null,'an individually transparent panel is still excluded');
    panel.style = {}; leading.style = {opacity:'0'};
    assert.equal(visibleCombatPanelRect(panel, field),null,'an intermediate transparent leading is still excluded');
    leading.style = {};
    for(const hidden of [{display:'none'},{visibility:'hidden'},{visibility:'collapse'}]){
      field.style={opacity:'0',...hidden};
      assert.equal(visibleCombatPanelRect(panel,field),null,'a hidden common boundary is still excluded');
    }
    field.style={opacity:'0'};field.hidden=true;
    assert.equal(visibleCombatPanelRect(panel,field),null);
  } finally {
    if (original === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = original;
  }
});

test('the display-none Info door reserves its authored physical width before context selection', () => {
  const original = globalThis.getComputedStyle;
  const node = { rect: { width: 0 }, getBoundingClientRect() { return this.rect; } };
  globalThis.getComputedStyle = () => ({ display: 'none', boxSizing: 'border-box', width: '59.621px', minWidth: '59.621px' });
  try {
    const reserved = combatControlWidth(node, .738);
    assert.ok(Math.abs(reserved - 44) < .001);
    node.rect = { width: reserved };
    assert.equal(combatControlWidth(node, .738), reserved, 'making the Info door visible keeps the same reserved footprint');
    assert.equal(combatControlWidth(null, .738), 0);
  } finally {
    if (original === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = original;
  }
});

test('sibling tools reserve their full top band during a common combat fade without accepting hidden descendants',()=>{
  const original=globalThis.getComputedStyle;
  const combat={style:{opacity:'0'},parentElement:null};
  const field={style:{},parentElement:combat};
  const rect={left:164,right:384,top:356,bottom:400,width:220,height:44};
  const tools={style:{},parentElement:combat,getBoundingClientRect:()=>rect};
  globalThis.getComputedStyle=node=>({display:'block',visibility:'visible',opacity:'1',...node.style});
  try{
    assert.equal(visibleCombatPanelRect(tools,field),null,'the sibling field is not the common boundary');
    assert.equal(visibleCombatPanelRect(tools,combat),rect,'use the actual shared combat boundary');
    tools.style={opacity:'0'};assert.equal(visibleCombatPanelRect(tools,combat),null);
    tools.style={};combat.style={opacity:'0',visibility:'hidden'};
    assert.equal(visibleCombatPanelRect(tools,combat),null);
  }finally{if(original===undefined)delete globalThis.getComputedStyle;else globalThis.getComputedStyle=original;}
});

test('the independent art-centered Info footprint stays identical when hidden, visible or translated',()=>{
  const original=globalThis.getComputedStyle,zoom=.738;
  let visible=false;
  const node={getBoundingClientRect:()=>({width:visible?44:0,height:visible?44:0})};
  const art={left:50,right:130,top:230},viewport={top:0};
  globalThis.getComputedStyle=()=>({width:String(44/zoom),minWidth:String(44/zoom)});
  try{
    const hidden=combatPlayerInfoRect(node,art,viewport,zoom);
    assert.deepEqual(hidden,{left:68,top:182,right:112,bottom:226,width:44,height:44});
    visible=true;assert.deepEqual(combatPlayerInfoRect(node,art,viewport,zoom),hidden);
    assert.deepEqual(combatPlayerInfoRect(node,{left:art.left+8,right:art.right+8,top:art.top+8},{top:8},zoom),
      {...hidden,left:76,right:120,top:190,bottom:234});
    assert.equal(combatPlayerInfoRect(node,{...art,top:20},viewport,zoom).top,0,'keep incoming viewport-top clamp');
    assert.equal(combatPlayerInfoRect(null,art,viewport,zoom),null);
    assert.deepEqual(combatPlayerInfoRect(node,art,viewport,zoom,400),hidden,'a door already above the hand keeps its place');
    assert.equal(combatPlayerInfoRect(node,{...art,top:520},viewport,zoom,390).bottom,386,
      'low waist-overlap art cannot carry the door under the resting hand');
  }finally{if(original===undefined)delete globalThis.getComputedStyle;else globalThis.getComputedStyle=original;}
});
