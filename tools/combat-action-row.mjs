#!/usr/bin/env node
// tools/combat-action-row.mjs — #21's single-owner combat action-row gate.
//
// The real ?shot=combat door supplies the hand, settings, input wiring, and
// rendered controls. This instrument measures the WGC6 footer: five persistent
// controls in one grid, (Actions) [Draw] [End Turn] [Discard] (Potions),
// packed as ONE centred group sized by packCombatFooter()
// (src/ui/models/CombatLayout.js) — two circles of one diameter, two piles of
// one width, End Turn between them, one model gap. On a short landscape host
// (#1043) allocateCombatBands() folds the same five controls into rails beside
// the hand: (Actions)[Draw] | hand | End Turn over [Discard](Potions). Every
// size is read back from the custom properties the layout adapter wrote, so
// the page is held to the model's plan, not to a number typed here. It also
// proves the Quick Access group remains visible and that the W1h pile viewer
// shows Discard and Exhaust separately and closes by its one Close.
//
// Usage:
//   node tools/combat-action-row.mjs
//   node tools/combat-action-row.mjs --only 884x1326 --text XL --hand 8
//   node tools/combat-action-row.mjs --standalone
//   node tools/combat-action-row.mjs --coop-only
//   node tools/combat-action-row.mjs --shots docs/preview --label before
//   node tools/combat-action-row.mjs --selftest
//
// Exit 0 = every measured cell held; 1 = product finding; 2 = no cell/browser.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const argOf = (flag) => { const at = args.indexOf(flag); return at >= 0 ? args[at + 1] : null; };
const standalone = args.includes('--standalone');
const only = argOf('--only');
const onlyText = argOf('--text');
const onlyHand = argOf('--hand');
const shots = argOf('--shots');
const evidenceLabel = argOf('--label') || 'evidence';
const coopOnly = args.includes('--coop-only');
const soloOnly = args.includes('--solo-only');
if (coopOnly && soloOnly) throw new Error('--coop-only and --solo-only are mutually exclusive');

if (args.includes('--selftest') || args.includes('--selftest-source')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const sourcePlants = [
    {
      name: 'the five controls lose their one semantic owner',
      file: 'src/ui/screens/combat.js',
      find: '<div class="combat-action-row as-btnrow" data-size="fill" ${uiComponentAttrs(UI.combatActionRail)} role="group" aria-label="Combat actions">',
      replace: '<div class="combat-action-split as-btnrow" data-size="fill" ${uiComponentAttrs(UI.combatActionRail)} role="group" aria-label="Combat actions">',
      expectRed: /combat-action-row: RED/,
    },
    // THE WGC6 PLANTS (2026-09-13). The three plants these replace moved the
    // kit ButtonRow's stretch, span and base gap; the WGC6 rules in
    // styles/kit.css now set every one of those for the footer, so those
    // plants patched text the footer no longer reads and could not go red.
    // Each plant below breaks one clause of the packed-footer contract.
    {
      name: 'the two circles stop taking the planned diameter',
      file: 'styles/kit.css',
      find: '  --combat-control-size: var(--footer-circle) !important;',
      replace: '  --combat-control-size: calc(var(--footer-circle) * 0.8) !important;',
      expectRed: /FAIL circles share the model diameter/,
    },
    {
      // WIDE-HOST PLANT. On a phone the packed group fills the whole row
      // (End Turn takes all the room that is left), so left-aligning it moves
      // nothing: measured at 390x844 Text XL, where this plant stayed green.
      // Centring is only observable where End Turn is capped by its envelope,
      // so this plant runs on 1200x730 (see the selftest passes below).
      wide: true,
      name: 'the packed group is no longer centred in the footer',
      file: 'styles/kit.css',
      find: '  justify-content: center; align-items: center; gap: var(--footer-gap);',
      replace: '  justify-content: start; align-items: center; gap: var(--footer-gap);',
      expectRed: /FAIL the five controls pack as one centred group/,
    },
    {
      name: 'the controls spread apart instead of sharing the model gap',
      file: 'styles/kit.css',
      find: '  justify-content: center; align-items: center; gap: var(--footer-gap);',
      replace: '  justify-content: center; align-items: center; gap: calc(var(--footer-gap) * 6);',
      expectRed: /FAIL the five controls pack as one centred group/,
    },
    {
      name: 'End Turn and Draw trade tracks',
      file: 'styles/kit.css',
      find: '  grid-template-columns: var(--footer-circle) var(--footer-pile-width) var(--footer-end-width) var(--footer-pile-width) var(--footer-circle);',
      replace: '  grid-template-columns: var(--footer-circle) var(--footer-end-width) var(--footer-pile-width) var(--footer-pile-width) var(--footer-circle);',
      expectRed: /combat-action-row: RED/,
    },
    {
      // !important because the WGC6 pile rule outranks a plain append.
      name: 'pile targets shrink below the device tap floor',
      file: 'styles/combat.css',
      append: '.combat-action-row > .pile { height: 2rem !important; min-height: 0 !important; }',
      expectRed: /FAIL every visible action control is on glass and at least 44px/,
    },
    {
      name: 'the grid exists visually but its children cannot receive hits',
      file: 'styles/combat.css',
      find: '.combat-action-row > * { pointer-events: auto; }',
      replace: '.combat-action-row > * { pointer-events: none; }',
      expectRed: /combat-action-row: RED/,
    },
    {
      name: 'Exhaust is hidden until it has content',
      file: 'styles/combat.css',
      // !important because `:root .combat:not(.coop) .combat-action-row .spent
      // { display: flex }` outranks a plain append; without it the plant never
      // armed (measured: the tool stayed green).
      append: '.combat-action-row > .pile.spent { display: none !important; }',
      expectRed: /combat-action-row: RED/,
    },
    // The co-op board wraps its two controls in their own rail inside the
    // hand area (src/ui/screens/coop.js); the two plants below break that
    // rail's two clauses. (The old narrow `.hand-area > .energy-orb` rows have
    // no subject since the rail took the controls out of the hand area.)
    {
      // !important because the co-op rail's `position: static` outranks it.
      name: 'co-op Actions leaves the rail flow',
      file: 'styles/combat.css',
      append: '.combat-action-row > .energy-orb { position: absolute !important; }',
      expectRed: /FAIL co-op rail sits under the hand/,
    },
    {
      // Not the rail's `justify-content`: formation's `> * { width: 100% }`
      // lets End Turn take all the rail's free space, so centring the rail
      // moves nothing (measured: that plant stayed green). Swapping the two
      // controls' sides is the defect that breaks the edge clause.
      name: 'the co-op rail swaps its two controls onto the wrong edges',
      file: 'styles/combat.css',
      append: '.combat.coop .combat-action-row { flex-direction: row-reverse !important; }',
      expectRed: /FAIL co-op rail sits under the hand/,
    },
  ];
  const coopPlants = sourcePlants.splice(-2);
  const narrowPlants = sourcePlants.filter((plant) => !plant.wide);
  const widePlants = sourcePlants.filter((plant) => plant.wide);
  const NARROW_ARGS = ['--solo-only', '--only', '390x844', '--text', 'XL', '--hand', '8'];
  const WIDE_ARGS = ['--solo-only', '--only', '1200x730', '--text', 'M', '--hand', '7'];
  let code = await doorSelftest({
    tool: 'combat-action-row.mjs',
    args: NARROW_ARGS,
    timeoutMs: 600000,
    plants: narrowPlants,
  });
  if (code) process.exit(code);
  code = await doorSelftest({
    tool: 'combat-action-row.mjs',
    args: WIDE_ARGS,
    timeoutMs: 600000,
    plants: widePlants,
  });
  if (code) process.exit(code);
  code = await doorSelftest({
    tool: 'combat-action-row.mjs',
    args: ['--coop-only'],
    timeoutMs: 600000,
    plants: coopPlants,
  });
  if (code) process.exit(code);
  if (args.includes('--selftest-source')) process.exit(0);
  const artifactPlants = (plants) => plants.map((plant, index) => ({
    ...plant,
    name: index === 0
      ? `standalone root is stale: ${plant.name}`
      : `selected-root twin: ${plant.name}`,
    file: 'AshenSpire.html',
    // The standalone is an HTML document: authored CSS must enter through a
    // style element, or it is inert text after </html> and the plant is
    // unarmed (the same rule tools/scroll-cue-bleed.mjs applies).
    ...(plant.append != null ? { append: `<style>${plant.append}</style>` } : {}),
  }));
  code = await doorSelftest({
    tool: 'combat-action-row.mjs',
    args: ['--standalone', ...NARROW_ARGS],
    timeoutMs: 600000,
    extraCopy: ['AshenSpire.html'],
    plants: artifactPlants(narrowPlants),
  });
  if (code) process.exit(code);
  code = await doorSelftest({
    tool: 'combat-action-row.mjs',
    args: ['--standalone', ...WIDE_ARGS],
    timeoutMs: 600000,
    extraCopy: ['AshenSpire.html'],
    plants: artifactPlants(widePlants),
  });
  if (code) process.exit(code);
  process.exit(await doorSelftest({
    tool: 'combat-action-row.mjs',
    args: ['--standalone', '--coop-only'],
    timeoutMs: 600000,
    extraCopy: ['AshenSpire.html'],
    plants: artifactPlants(coopPlants),
  }));
}

if (onlyText && !['M', 'XL'].includes(onlyText)) throw new Error(`--text must be M or XL (got ${onlyText})`);
if (onlyHand && ![1, 7, 8].includes(Number(onlyHand))) throw new Error(`--hand must be 1, 7, or 8 (got ${onlyHand})`);

const browserCandidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const browserPath = argOf('--browser') || browserCandidates.find((candidate) => existsSync(candidate));
if (!browserPath) {
  console.error('combat-action-row: no Chrome/Edge found; pass --browser or set CHROME');
  process.exit(2);
}

const shapes = [
  { width: 320, height: 640 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 884, height: 1326 },
  { width: 844, height: 390 },
  { width: 1200, height: 730 },
].filter((cell) => !only || `${cell.width}x${cell.height}` === only);
const texts = ['M', 'XL'].filter((text) => !onlyText || text === onlyText);
const hands = [1, 7, 8].filter((hand) => !onlyHand || hand === Number(onlyHand));
if (!shapes.length || !texts.length || !hands.length) {
  console.error('combat-action-row: requested filters selected no cell');
  process.exit(2);
}

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: pass, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else pass(message.result);
  });
  return {
    ready: new Promise((pass, reject) => {
      ws.addEventListener('open', pass);
      ws.addEventListener('error', reject);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((pass, reject) => {
        pending.set(id, { resolve: pass, reject });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

const STATES = ['rest', 'armed', 'exhaust'];
// WGC6 order: (Actions) [Draw] [End Turn] [Discard] (Potions).
const CONTROL_SELECTORS = ['.energy-orb', '.pile.draw', '.end-turn', '.pile.spent', '.combat-potions'];
// The tap floor is 44 device px. Chromium lays boxes out in 1/64 px units, so
// under the body zoom a control the model sizes at exactly 44 device px lands
// a few 64ths short (43.953 measured at 320x640); 0.1 px absorbs that
// rounding and nothing a player could feel.
const TAP_FLOOR_PX = 44 - 0.1;
// Rendered geometry must match the model's plan to within one visual px.
const PLAN_TOLERANCE_PX = 1;

async function main() {
  const served = standalone ? null : await serve({ root: ROOT, port: 8321, open: false });
  const base = standalone
    ? pathToFileURL(resolve(ROOT, 'AshenSpire.html')).href
    : `http://localhost:${served.port}/index.html`;
  const browser = await launchBrowser({ prefix: 'action-row-', browser: browserPath, args: ['--disable-background-networking', '--disable-component-update'], timeoutMs: 15000 });
  const cdp = connectCdp(browser.wsUrl);
  await cdp.ready;
  if (shots) mkdirSync(resolve(ROOT, shots), { recursive: true });

  let sessionId;
  let failures = 0;
  let soloRan = 0;
  let coopRan = 0;
  const check = (value, label, detail = '') => {
    console.log(`    ${value ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
    if (!value) failures++;
  };
  if (!standalone) {
    const combatSource = readFileSync(resolve(ROOT, 'src/ui/screens/combat.js'), 'utf8');
    const combatCss = readFileSync(resolve(ROOT, 'styles/combat.css'), 'utf8');
    check(!combatSource.includes('mountArmamentRadial') && !combatSource.includes('armaments-command'),
      'combat no longer mounts an Armaments rail control');
    check(!combatCss.includes("data-armaments-presentation='radial'] .combat .hud-charge-flasks")
      && !combatCss.includes("data-armaments-presentation='radial'] .combat .hud-potions"),
    'Quick Access flasks are not hidden by the Armaments presentation setting');
    check(combatSource.includes('openSpentPileModal(registries, combat.piles') && combatSource.includes("className: 'combat-potions tall'"),
    'Combined pile surface and bottom potion control are mounted');
  }

  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    ({ sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }));
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);

    const evaluate = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'page evaluation failed');
      return result.result.value;
    };
    // A cold ?shot=combat boot on a loaded Windows host has run past 15 s
    // (2026-09-13); a 15 s deadline reported the machine, not the footer.
    const waitFor = async (expression, label) => {
      const deadline = Date.now() + 45000;
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return;
        await new Promise((pass) => setTimeout(pass, 50));
      }
      throw new Error(`timed out waiting for ${label}`);
    };
    const click = async (selector) => {
      const point = await evaluate(`(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return null;
        const r=node.getBoundingClientRect(), x=(r.left+r.right)/2, y=(r.top+r.bottom)/2;
        const hit=document.elementFromPoint(x,y);
        return {x,y,clear:!!(hit&&(hit===node||node.contains(hit)))};
      })()`);
      if (!point || !point.clear) return false;
      await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 }, sessionId);
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 }, sessionId);
      await new Promise((pass) => setTimeout(pass, 140));
      return true;
    };
    const reading = () => evaluate(`(() => {
      const visible = (node) => {
        if (!node) return false;
        const style=getComputedStyle(node), r=node.getBoundingClientRect();
        return style.display!=='none' && style.visibility!=='hidden' && r.width>0 && r.height>0;
      };
      const rect = (node) => { const r=node.getBoundingClientRect(); return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
      const intersects = (a,b) => a.left < b.right-0.25 && a.right > b.left+0.25 && a.top < b.bottom-0.25 && a.bottom > b.top+0.25;
      const combat=document.querySelector('.combat:not(.coop)');
      const owner=document.querySelector('.combat-action-row');
      // The plan's custom properties are local (pre-zoom) px; rects are visual
      // px. The zoom is read the way the layout adapter reads it
      // (src/ui/components/combatLayout.js).
      const zoom=combat&&combat.clientWidth ? combat.getBoundingClientRect().width/combat.clientWidth : 1;
      const planVar=(name)=>owner?parseFloat(owner.style.getPropertyValue(name))*zoom:NaN;
      const plan={gap:planVar('--footer-gap'),circle:planVar('--footer-circle'),pileWidth:planVar('--footer-pile-width'),pileHeight:planVar('--footer-pile-height'),endWidth:planVar('--footer-end-width')};
      const selectors=${JSON.stringify(CONTROL_SELECTORS)};
      const controls=selectors.map((selector) => {
        const node=document.querySelector(selector);
        if (!node || !visible(node)) return {selector,visible:false};
        const r=rect(node), style=getComputedStyle(node);
        // Chromium hit-tests a rounded box by its rounded shape, so a circle's
        // bounding-box corners are not part of the control. A round control is
        // sampled inside its inscribed ellipse (inset for the anti-aliased
        // rim); a rectangle keeps the full 5 x 9 grid.
        const radius=style.borderTopLeftRadius;
        const round=radius.endsWith('%') ? parseFloat(radius)>=50 : parseFloat(radius)>=Math.min(r.width,r.height)/2-0.5;
        let samples=0, hitCount=0;
        for(let row=0;row<9;row++) for(let col=0;col<5;col++) {
          const fx=(col+0.5)/5, fy=(row+0.5)/9;
          if (round && ((fx-0.5)**2+(fy-0.5)**2)/0.25>0.8) continue;
          samples++;
          const hit=document.elementFromPoint(r.left+r.width*fx, r.top+r.height*fy);
          if (hit&&(hit===node||node.contains(hit))) hitCount++;
        }
        const centre=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
        return {selector,visible:true,...r,round,samples,hitCount,centreHit:!!(centre&&(centre===node||node.contains(centre))),centreNode:centre?(centre.tagName.toLowerCase()+'.'+((centre.getAttribute&&centre.getAttribute('class'))||'')):null,position:style.position,parent:node.parentElement?.className||''};
      });
      const shown=controls.filter((control)=>control.visible);
      const pairs=[];
      for(let i=0;i<shown.length;i++) for(let j=i+1;j<shown.length;j++) if(intersects(shown[i],shown[j])) pairs.push([shown[i].selector,shown[j].selector]);
      // A card's PAINTED box: its layout box clipped by every ancestor that
      // clips. The hand is an overflow-x scrollport; on a short-landscape
      // rail host an 8-card hand lays its last card out under End Turn and
      // Discard while the hand's port clips it at the lane's edge (measured
      // 2026-09-13 at 844x390: layout box to x=736, painted to 671.5, End
      // Turn from 723.6). Only what is painted can cover a control.
      const painted=(node)=>{
        const r=rect(node);
        for(let p=node.parentElement;p&&p!==document.body;p=p.parentElement){
          const cs=getComputedStyle(p), pr=p.getBoundingClientRect();
          if(cs.overflowX!=='visible'){r.left=Math.max(r.left,pr.left);r.right=Math.min(r.right,pr.right);}
          if(cs.overflowY!=='visible'){r.top=Math.max(r.top,pr.top);r.bottom=Math.min(r.bottom,pr.bottom);}
        }
        r.width=r.right-r.left; r.height=r.bottom-r.top;
        return r;
      };
      const cards=[...document.querySelectorAll('.hand .card')].filter(visible).map(painted).filter((r)=>r.width>0.5&&r.height>0.5);
      const pages=[...document.querySelectorAll('.hand-page')].filter(visible).map(painted).filter((r)=>r.width>0.5&&r.height>0.5);
      const foreign=shown.flatMap((control)=>[
        ...cards.filter((item)=>intersects(control,item)).map(()=>[control.selector,'card']),
        ...pages.filter((item)=>intersects(control,item)).map(()=>[control.selector,'pager']),
      ]);
      const grid=owner?getComputedStyle(owner):null;
      const by=Object.fromEntries(shown.map((control)=>[control.selector,control]));
      const energy=by['.energy-orb'], draw=by['.pile.draw'], end=by['.end-turn'];
      const discard=by['.pile.spent'], potions=by['.combat-potions'];
      const all=!!(energy&&draw&&end&&discard&&potions);
      const tol=${PLAN_TOLERANCE_PX};
      const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol;
      const cy=(r)=>(r.top+r.bottom)/2;
      const arrangement=combat?.dataset.combatArrangement||null;
      const rails=arrangement==='rails';
      // The hand's own lane: the rails wrap it, the packed row sits under it.
      const laneNode=document.querySelector('.combat:not(.coop) .hand-overlay')||document.querySelector('.combat:not(.coop) .hand');
      const lane=laneNode&&visible(laneNode)?rect(laneNode):null;
      const ownerBox=owner?rect(owner):null;
      const gaps=all&&!rails?[draw.left-energy.right,end.left-draw.right,discard.left-end.right,potions.left-discard.right]:null;
      const quickAccess=[document.querySelector('#combat-armoury'),document.querySelector('#combat-menu')];
      return {
        layout:document.documentElement.dataset.layout||null,
        composition:document.documentElement.dataset.composition||null,
        state:document.documentElement.dataset.actionRowProbe||'rest',
        arrangement,
        owner:{exists:!!owner,display:grid?.display||null,columns:grid?.gridTemplateColumns||null,geometry:owner?.dataset.footerGeometry||null},
        owned:!!owner&&selectors.every((selector)=>owner.contains(document.querySelector(selector))),
        controls,pairs,foreign,plan,zoom:+zoom.toFixed(4),
        onGlass:shown.every((r)=>r.left>=-0.25&&r.top>=-0.25&&r.right<=innerWidth+0.25&&r.bottom<=innerHeight+0.25),
        minTap:shown.length?Math.min(...shown.map((r)=>Math.min(r.width,r.height))):0,
        order:{
          persistent:all,
          // Packed: one row, left to right. Rails: the lower row keeps the
          // footer's order and End Turn stands over the trailing pair.
          ordered:all&&(rails
            ? energy.left<draw.left&&draw.left<discard.left&&discard.left<potions.left&&end.left>draw.right
            : energy.left<draw.left&&draw.left<end.left&&end.left<discard.left&&discard.left<potions.left),
        },
        packed:rails||!all?null:{
          gaps:gaps.map((g)=>+g.toFixed(2)),
          oneRow:[draw,end,discard,potions].every((c)=>near(cy(c),cy(energy))),
          gapsMatch:gaps.every((g)=>near(g,plan.gap)),
          centreDelta:ownerBox?+Math.abs((energy.left+potions.right)/2-(ownerBox.left+ownerBox.right)/2).toFixed(2):null,
        },
        rails:!rails||!all?null:{
          lane,
          leading:!!lane&&energy.right<=draw.left+0.25&&draw.right<=lane.left+0.5,
          trailing:!!lane&&end.left>=lane.right-0.5&&discard.left>=lane.right-0.5,
          endOver:end.bottom<=Math.min(discard.top,potions.top)+0.5&&near(end.left,discard.left)&&near(end.right,potions.right),
          baseline:[draw,discard,potions].every((c)=>near(cy(c),cy(energy))),
        },
        sizes:!all?null:{
          circles:near(energy.width,plan.circle)&&near(energy.height,plan.circle)&&near(potions.width,plan.circle)&&near(potions.height,plan.circle),
          endTurn:near(end.height,plan.circle)&&near(end.width,plan.endWidth),
          piles:near(draw.width,plan.pileWidth)&&near(discard.width,plan.pileWidth)&&near(draw.height,plan.pileHeight)&&near(discard.height,plan.pileHeight),
        },
        quickAccess:{
          count:quickAccess.filter(visible).length,
          allVisible:quickAccess.length===2&&quickAccess.every(visible),
          armamentsAbsent:!document.querySelector('.armaments-command, .armament-radial'),
        },
      };
    })()`);
    const settledReading = async (label) => {
      const deadline = Date.now() + 3000;
      let previous = await reading();
      let steady = 0;
      while (Date.now() < deadline) {
        await new Promise((pass) => setTimeout(pass, 100));
        const next = await reading();
        const before = Object.fromEntries(previous.controls.filter((c)=>c.visible).map((c)=>[c.selector,c]));
        const moved = next.controls.filter((c)=>c.visible).some((c)=>{
          const was = before[c.selector];
          return !was || Math.max(Math.abs(c.left-was.left),Math.abs(c.top-was.top),Math.abs(c.width-was.width),Math.abs(c.height-was.height))>0.25;
        });
        steady = moved ? 0 : steady + 1;
        previous = next;
        if (steady >= 2) return next;
      }
      throw new Error(`timed out waiting for stable ${label} geometry`);
    };

    for (const shape of shapes) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: shape.width,
        height: shape.height,
        deviceScaleFactor: 1,
        mobile: false,
      }, sessionId);
      for (const text of texts) {
        if (!coopOnly) {
        for (const hand of hands) {
          const settings = encodeURIComponent(JSON.stringify({ textSize: text, holdConfirm: 'off' }));
          const url = `${base}?shot=combat&shotHand=${hand}&shotSettings=${settings}`;
          await cdp.send('Page.navigate', { url }, sessionId);
          await waitFor(`document.querySelectorAll('.combat .hand .card').length===${hand}`, `${hand}-card combat`);
          await new Promise((pass) => setTimeout(pass, 240));
          let exhaustBaseline = null;

          for (const state of STATES) {
            if (state === 'armed') {
              if (hand < 7) continue;
              const attackIndex = await evaluate(`[...document.querySelectorAll('.hand .card')].findIndex((card)=>card.querySelector('.ctype')?.textContent.includes('ATTACK'))`);
              let armed = false;
              if (attackIndex >= 0 && attackIndex < 9) {
                const key = String(attackIndex + 1);
                await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code: `Digit${key}` }, sessionId);
                await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: `Digit${key}` }, sessionId);
                await new Promise((pass) => setTimeout(pass, 140));
                armed = await evaluate(`!!document.querySelector('.hand .card.selected')`);
              }
              if (!armed) {
                failures++;
                console.log(`\n  ${shape.width}x${shape.height} Text ${text}, hand ${hand}, armed`);
                console.log('    FAIL real card could not be armed at its centre');
                continue;
              }
            }
            if (state === 'exhaust') {
              await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape' }, sessionId);
              await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }, sessionId);
              await new Promise((pass) => setTimeout(pass, 80));
              // Keyboard arming may scroll its focused card. Compare the two
              // renders from one viewport origin so scroll anchoring cannot
              // masquerade as all five persistent cells moving together.
              await evaluate(`document.activeElement?.blur(); scrollTo(0,0); true`);
              const beforeExhaust = await settledReading('pre-Exhaust action-row');
              exhaustBaseline = beforeExhaust;
              await evaluate(`(() => {
                const combat=window.__combat;
                const source=combat?.piles?.discard?.[0] || combat?.piles?.draw?.[0] || combat?.piles?.hand?.[0];
                if (!combat || !source || typeof window.__renderCombatForShot!=='function') return false;
                if (!combat.piles.exhaust.length) combat.piles.exhaust.push({...source,instanceId:'action-row-probe-exhaust'});
                window.__renderCombatForShot();
                document.documentElement.dataset.actionRowProbe='exhaust';
                scrollTo(0,0);
                return true;
              })()`);
            } else {
              await evaluate(`document.documentElement.dataset.actionRowProbe=${JSON.stringify(state)}; true`);
            }
            await new Promise((pass) => setTimeout(pass, 120));
            const now = await settledReading(`${state} action-row`);
            soloRan++;
            const tag = `${shape.width}x${shape.height} Text ${text}, hand ${hand}, ${state}, ${standalone ? 'root' : 'source'}`;
            console.log(`\n  ${tag}`);
            console.log(`    arrangement ${now.arrangement || '(none)'} · footer plan ${now.owner.geometry || '(none)'} · zoom ${now.zoom}`);
            check(now.owner.exists && now.owner.display === 'grid' && now.owned && now.owner.geometry === 'supported',
              'one WGC6 grid owns Actions, Draw, End Turn, Discard, and Potions on a supported packCombatFooter plan', JSON.stringify(now.owner));
            // WGC6 (#1043's CombatLayout.js): five tracks, circle / pile / End
            // Turn / pile / circle, not the kit ButtonRow's six equal tracks.
            check((now.owner.columns?.match(/px/g)||[]).length===5,
              'the footer resolves to five tracks: (Actions) [Draw] [End Turn] [Discard] (Potions)', JSON.stringify(now.owner));
            check(now.pairs.length === 0, 'action controls have zero pairwise hit-box intersections', JSON.stringify(now.pairs));
            check(now.foreign.length === 0, 'action controls intersect no card or pager', JSON.stringify(now.foreign));
            check(now.onGlass && now.minTap >= TAP_FLOOR_PX,
              'every visible action control is on glass and at least 44px', JSON.stringify({onGlass:now.onGlass,minTap:now.minTap}));
            check(now.controls.filter((control)=>control.visible).every((control)=>control.samples>0&&control.hitCount===control.samples&&control.centreHit),
              'every visible action control answers every sample inside its own shape and at its centre', JSON.stringify(now.controls.map((c)=>[c.selector,c.round,`${c.hitCount}/${c.samples}`,c.centreNode])));
            check(now.controls.filter((control)=>control.visible).every((control)=>control.position!=='absolute'),
              'grid children do not escape through absolute positioning', JSON.stringify(now.controls.map((c)=>[c.selector,c.position])));
            check(now.order.persistent && now.order.ordered,
              'Actions, Draw, End Turn, Discard, and Potions stay present and in WGC6 order', JSON.stringify(now.order));
            if (now.arrangement === 'rails') {
              check(!!now.rails && now.rails.leading && now.rails.trailing && now.rails.endOver && now.rails.baseline,
                'short-landscape rails wrap the hand: (Actions)[Draw] lead, End Turn stands over [Discard](Potions)', JSON.stringify(now.rails));
            } else {
              check(!!now.packed && now.packed.oneRow && now.packed.gapsMatch && now.packed.centreDelta != null && now.packed.centreDelta <= PLAN_TOLERANCE_PX,
                'the five controls pack as one centred group separated by the model gap', JSON.stringify({plan:now.plan.gap,...now.packed}));
            }
            check(!!now.sizes && now.sizes.circles && now.sizes.endTurn && now.sizes.piles,
              'circles share the model diameter; End Turn and the piles take their packCombatFooter sizes', JSON.stringify({plan:now.plan,sizes:now.sizes,rendered:now.controls.map((c)=>[c.selector,+(c.width||0).toFixed(2),+(c.height||0).toFixed(2)])}));
            check(now.quickAccess.allVisible && now.quickAccess.armamentsAbsent,
              'Armoury and Menu remain visible above the bottom inventory controls', JSON.stringify(now.quickAccess));

            if (state === 'exhaust') {
              const baselineControls = Object.fromEntries(exhaustBaseline.controls.filter((c)=>c.visible).map((c)=>[c.selector,c]));
              const moved = now.controls.filter((c)=>c.visible).filter((c)=>{
                const was=baselineControls[c.selector];
                return !was || Math.max(
                  Math.abs(c.left-was.left), Math.abs(c.top-was.top),
                  Math.abs(c.width-was.width), Math.abs(c.height-was.height),
                )>0.5;
              }).map((c)=>c.selector);
              check(moved.length===0, 'changing the Exhausted count preserves every standing action cell', JSON.stringify(moved));
              const exhaustControl=now.controls.find((control)=>control.selector==='.pile.spent');
              check(exhaustControl?.visible, 'Exhausted remains visible when the pile is empty or populated', JSON.stringify(exhaustControl));
              // W1h: the pile viewer puts Discard and Exhaust on the W1 rail
              // (items keep role=tab, aria-selected and data-modal-tab) and a
              // single Close ends it. The scrim still dismisses only a real
              // pointer press that begins on it (modalShell.js), so a DOM
              // .click() on the veil never was that door; Close is.
              const closeViewer = async () => {
                const pressed = await click('.spent-pile-modal .pile-done');
                const gone = await waitFor(`!document.querySelector('.spent-pile-modal')`, 'the pile viewer to close').then(() => true, () => false);
                return pressed && gone;
              };
              const opened=await click('.pile.spent');
              await waitFor(`!!document.querySelector('.spent-pile-modal [data-modal-tab=exhaust]')`, 'the pile viewer rail').catch(() => {});
              // W1 category navigation (#1087): a host too narrow for the rail
              // folds the piles into one selector above the pane (never a
              // horizontal strip), so Exhaust is reached the way a player
              // reaches it there — open the selector, then press the item. A
              // host wide enough for the rail presses the item directly.
              const folded = await evaluate(`!!document.querySelector('.spent-pile-modal .as-catnav-toggle')?.getClientRects().length`);
              if (folded) {
                await click('.spent-pile-modal .as-catnav-toggle');
                await waitFor(`document.querySelector('.spent-pile-modal .as-catnav-toggle')?.getAttribute('aria-expanded')==='true'`, 'the pile selector to open').catch(() => {});
                console.log('    NOTE the piles are folded into the compact selector; it was opened before pressing Exhaust');
              }
              await new Promise((pass) => setTimeout(pass, 120));
              await click('.spent-pile-modal [data-modal-tab=exhaust]');
              const exhaustModal=await evaluate(`(() => ({
                title:document.querySelector('.spent-pile-modal [data-modal-tab=exhaust][aria-selected=true]')?.textContent||'',
                modalCount:document.querySelectorAll('.modal-veil .modal').length,
              }))()`);
              check(opened && exhaustModal.modalCount===1 && /^Exhaust \(1\)$/.test(exhaustModal.title),
                'the Exhaust rail item displays the separate pile', JSON.stringify(exhaustModal));
              check(await closeViewer(), "the pile viewer's single Close ends it after Exhaust");

              const discardOpened = await click('.pile.spent');
              const discardModal = await evaluate(`(() => ({
                title:document.querySelector('.spent-pile-modal [data-modal-tab=discard][aria-selected=true]')?.textContent||'',
                modalCount:document.querySelectorAll('.modal-veil .modal').length,
                chooserAbsent:!document.querySelector('.pile-surface-picker'),
              }))()`);
              check(discardOpened && discardModal.modalCount===1 && discardModal.chooserAbsent
                && /^Discard \(\d+\)$/.test(discardModal.title),
              'Discard opens on its own rail item', JSON.stringify(discardModal));
              check(await closeViewer(), "the pile viewer's single Close ends it after Discard");
            }

            const capture = shots && (only || ((shape.width===390&&shape.height===844&&text==='XL'&&hand===8&&state==='rest')
              || (shape.width===884&&shape.height===1326&&text==='XL'&&hand===8&&state==='exhaust')
              || (shape.width===1200&&shape.height===730&&text==='M'&&hand===7&&state==='rest')));
            if (capture) {
              await evaluate(`(() => {
                document.querySelector('.evidence-caption')?.remove();
                const n=document.createElement('div'); n.className='evidence-caption';
                n.style.cssText='position:fixed;left:8px;top:8px;z-index:99999;padding:6px 9px;background:#090806ee;border:1px solid #c9a85c;color:#f4e6bd;font:12px/1.3 monospace';
                n.textContent=${JSON.stringify(`#21 ${evidenceLabel.toUpperCase()} · ${standalone ? 'SELECTED ROOT' : 'SOURCE'} · ${shape.width}x${shape.height} · Text ${text} · hand ${hand} · ${state}`)};
                document.body.appendChild(n); return true;
              })()`);
              const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
              const file = `action-row-${evidenceLabel}-${standalone?'root':'source'}-${shape.width}x${shape.height}-text-${text.toLowerCase()}-hand-${hand}-${state}.png`;
              writeFileSync(resolve(ROOT, shots, file), Buffer.from(data, 'base64'));
            }
          }
        }
        }

        const representativeCoop = (shape.width === 390 && shape.height === 844 && text === 'XL')
          || (shape.width === 1200 && shape.height === 730 && text === 'M');
        if (!soloOnly && representativeCoop) {
          const settings = encodeURIComponent(JSON.stringify({ textSize: text, holdConfirm: 'off' }));
          await cdp.send('Page.navigate', { url: `${base}?shot=coop&shotSettings=${settings}` }, sessionId);
          await waitFor(`document.querySelectorAll('.combat.coop .hand .card').length===5`, 'five-card co-op combat');
          await new Promise((pass) => setTimeout(pass, 240));
          // THE CO-OP RAIL: coop.js lifts Actions and End Turn out of the
          // hand area's flow into their own `.combat-action-row` rail, appended
          // under the hand; the co-op formation rule lays it out as a flex row
          // with space-between (styles/combat.css). It is not the solo WGC6
          // footer and carries no piles or potions.
          const coop = await evaluate(`(() => {
            const area=document.querySelector('.combat.coop .hand-area');
            const hand=area?.querySelector(':scope > .hand');
            const rail=area?.querySelector(':scope > .combat-action-row');
            const energy=rail?.querySelector(':scope > .energy-orb');
            const end=rail?.querySelector(':scope > .end-turn');
            if (!area||!hand||!rail||!energy||!end) return {missing:{area:!!area,hand:!!hand,rail:!!rail,energy:!!energy,end:!!end}};
            const rect=(node)=>{const r=node.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
            const intersects=(a,b)=>a.left<b.right-0.25&&a.right>b.left+0.25&&a.top<b.bottom-0.25&&a.bottom>b.top+0.25;
            const hit=(node)=>{const r=rect(node),hits=[];for(let row=0;row<9;row++)for(let col=0;col<5;col++){const x=r.left+r.width*((col+.5)/5),y=r.top+r.height*((row+.5)/9),n=document.elementFromPoint(x,y);hits.push(!!(n&&(n===node||node.contains(n))))}return hits.filter(Boolean).length};
            const cards=[...hand.querySelectorAll('.card')].map(rect);
            const ar=rect(area),hr=rect(hand),rr=rect(rail),er=rect(energy),tr=rect(end);
            const acs=getComputedStyle(area),rcs=getComputedStyle(rail),es=getComputedStyle(energy),ts=getComputedStyle(end);
            const zoom=area.clientWidth?ar.width/area.clientWidth:1;
            const pad=(parseFloat(acs.paddingLeft)+parseFloat(acs.paddingRight))*zoom;
            const innerLeft=rr.left+parseFloat(rcs.paddingLeft)*zoom, innerRight=rr.right-parseFloat(rcs.paddingRight)*zoom;
            return {
              layout:document.documentElement.dataset.layout||null,
              railChildren:[...rail.children].map((node)=>node.className),
              soloAbsent:!rail.querySelector('.pile, .combat-potions'),
              area:ar,hand:hr,rail:rr,energy:er,end:tr,
              energyPosition:es.position,endPosition:ts.position,
              fullHand:hr.width>=ar.width-pad-1,
              below:rr.top>=hr.bottom-0.5,
              edges:Math.abs(er.left-innerLeft)<=0.5&&Math.abs(innerRight-tr.right)<=0.5,
              pairClear:!intersects(er,tr),
              cardsClear:cards.every((card)=>!intersects(card,er)&&!intersects(card,tr)),
              onGlass:[er,tr].every((r)=>r.left>=-.25&&r.top>=-.25&&r.right<=innerWidth+.25&&r.bottom<=innerHeight+.25),
              hitCounts:[hit(energy),hit(end)],
            };
          })()`);
          coopRan++;
          const tag = `${shape.width}x${shape.height} Text ${text}, co-op, ${standalone ? 'root' : 'source'}`;
          console.log(`\n  ${tag}`);
          if (coop.missing) {
            check(false, 'co-op hand area, hand, rail, Actions and End Turn are all present', JSON.stringify(coop.missing));
          } else {
            check(coop.railChildren.length === 2 && coop.soloAbsent,
              'co-op Actions and End Turn share one co-op rail inside the hand area, apart from the solo footer', JSON.stringify(coop.railChildren));
            check(coop.fullHand, 'co-op hand keeps the full available row width', JSON.stringify({area:coop.area.width,hand:coop.hand.width}));
            check(coop.pairClear && coop.cardsClear, 'co-op controls neither overlap each other nor cover cards', JSON.stringify({pairClear:coop.pairClear,cardsClear:coop.cardsClear}));
            // The co-op Actions orb is round, so its box corners are not its
            // hit region; End Turn is a rectangle and keeps the 45/45 grid.
            check(coop.onGlass && Math.min(coop.energy.width,coop.energy.height)>=TAP_FLOOR_PX && coop.hitCounts[1]===45,
              'co-op Energy keeps visible 44px geometry and End Turn is 45/45 hittable', JSON.stringify({onGlass:coop.onGlass,energy:coop.energy,hits:coop.hitCounts}));
            check(coop.below && coop.edges && coop.energyPosition==='static' && coop.endPosition==='static',
              'co-op rail sits under the hand, holds Actions and End Turn in flow, and anchors them to opposite edges',
              JSON.stringify({layout:coop.layout,below:coop.below,edges:coop.edges,rail:coop.rail,hand:coop.hand,energyPosition:coop.energyPosition,endPosition:coop.endPosition}));
          }

          if (shots) {
            await evaluate(`(() => {
              document.querySelector('.evidence-caption')?.remove();
              const n=document.createElement('div'); n.className='evidence-caption';
              n.style.cssText='position:fixed;left:8px;top:8px;z-index:99999;padding:6px 9px;background:#090806ee;border:1px solid #c9a85c;color:#f4e6bd;font:12px/1.3 monospace';
              n.textContent=${JSON.stringify(`#21 ${evidenceLabel.toUpperCase()} · ${standalone ? 'SELECTED ROOT' : 'SOURCE'} · CO-OP · ${shape.width}x${shape.height} · Text ${text}`)};
              document.body.appendChild(n); return true;
            })()`);
            const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, sessionId);
            const file = `action-row-${evidenceLabel}-${standalone?'root':'source'}-coop-${shape.width}x${shape.height}-text-${text.toLowerCase()}.png`;
            writeFileSync(resolve(ROOT, shots, file), Buffer.from(data, 'base64'));
          }
        }
      }
    }
  } finally {
    await Promise.race([cdp.send('Browser.close').catch(() => {}), new Promise(done => setTimeout(done, 1200))]); cdp.close();
    await browser.close();
    if (served) await new Promise((pass) => served.server.close(pass));
  }

  if (!soloRan && !coopRan) {
    console.error('combat-action-row: no acceptance cell ran');
    return 2;
  }
  console.log(`\ncombat-action-row: ${failures ? `RED — ${failures} finding(s)` : `GREEN — solo ${soloRan}, co-op ${coopRan}`}`);
  return failures ? 1 : 0;
}

process.exit(await main());
