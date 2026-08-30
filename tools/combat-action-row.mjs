#!/usr/bin/env node
// tools/combat-action-row.mjs — #21's single-owner combat action-row gate.
//
// The real ?shot=combat door supplies the hand, settings, input wiring, and
// rendered controls. This instrument measures one five-cell DOM/CSS grid:
// Armaments, Actions, End Turn, Draw, and Discard. Exhaust remains a nested
// summary and a two-surface Discard picker, never a sixth rail cell. The same
// run opens the real Armaments control and hit-tests its five radial positions.
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
      find: '<div class="combat-action-row" ${uiComponentAttrs(UI.combatActionRail)} role="group" aria-label="Combat actions">',
      replace: '<div class="combat-action-split" role="group" aria-label="Combat actions">',
      expectRed: /combat-action-row: RED/,
    },
    {
      name: 'the Energy hit target becomes a rounded visual instead of its full cell',
      file: 'styles/combat.css',
      find: 'grid-area: energy; position: relative; left: auto; bottom: auto; isolation: isolate;',
      replace: 'grid-area: energy; position: static; left: auto; bottom: auto; isolation: isolate;',
      expectRed: /combat-action-row: RED/,
    },
    {
      name: 'the narrow five-cell row stacks every trailing destination into End Turn',
      file: 'styles/combat.css',
      find: '    grid-template-areas: "armaments energy end draw discard";',
      replace: '    grid-template-areas: "armaments end end end end";',
      expectRed: /combat-action-row: RED/,
    },
    {
      name: 'pile targets shrink below the device tap floor',
      file: 'styles/combat.css',
      find: 'width: 100%; height: max(4.2rem, var(--tap-floor)); font-size: 1.1rem;',
      replace: 'width: 100%; height: 3.6rem; min-height: 0; font-size: 1.1rem;',
      expectRed: /combat-action-row: RED/,
    },
    {
      name: 'the grid exists visually but its children cannot receive hits',
      file: 'styles/combat.css',
      find: '.combat-action-row > * { pointer-events: auto; }',
      replace: '.combat-action-row > * { pointer-events: none; }',
      expectRed: /combat-action-row: RED/,
    },
    {
      name: 'Exhaust leaves the Discard cell and loses its nested summary',
      file: 'src/ui/screens/combat.js',
      find: 'ex.hidden = !combat.piles.exhaust.length;',
      replace: 'ex.hidden = true;',
      expectRed: /combat-action-row: RED/,
    },
    {
      name: 'Discard no longer offers the Exhaust pile surface',
      file: 'src/ui/screens/combat.js',
      find: "[['Discard pile', combat.piles.discard], ['Exhaust pile', combat.piles.exhaust]]",
      replace: "[['Discard pile', combat.piles.discard]]",
      expectRed: /combat-action-row: RED/,
    },
    {
      name: 'the Armaments radial loses its full destination',
      file: 'src/ui/screens/combat.js',
      find: "radialItems.push({ target: 'full', label: 'Full Armaments', detail: 'Open' });",
      replace: '// planted: full Armaments destination removed',
      expectRed: /combat-action-row: RED/,
    },
    {
      name: 'radial mode hides map flask controls outside combat',
      file: 'styles/combat.css',
      find: ":root[data-armaments-presentation='radial'] .combat .hud-charge-flasks,",
      replace: ":root[data-armaments-presentation='radial'] .hud-charge-flasks,",
      expectRed: /FAIL (radial flask hiding is scoped to combat|radial mode leaves map flask controls visible and focusable)/,
    },
    {
      name: 'hand labels regress to sprite identities',
      file: 'src/ui/screens/combat.js',
      find: "detail: leftPiece?.name || 'Empty'",
      replace: "detail: figureSpec(registries, run.loadout, run.class).leftId || 'Empty'",
      expectRed: /FAIL radial hand labels use equipped player-facing names/,
    },
    {
      name: 'the pile-surface chooser loses its Escape lifecycle',
      file: 'src/ui/screens/combat.js',
      find: "window.addEventListener('keydown', onPickerCancel);",
      replace: '// planted: pile chooser has no keyboard Cancel owner',
      expectRed: /FAIL (the pile-surface chooser owns Escape and restores Discard focus|Escape closes the pile-surface chooser and restores Discard focus)/,
    },
    {
      name: 'fixed-mode held presses are swallowed',
      file: 'src/ui/components/armamentRadial.js',
      find: 'openedByHold = openMenu();',
      replace: 'openedByHold = true; openMenu();',
      expectRed: /FAIL (fixed mode suppresses a click only after a radial really opened|fixed mode held presses still open Armoury)/,
    },
    {
      name: 'off-anchor pointer gestures keep their hold timer',
      file: 'src/ui/components/armamentRadial.js',
      find: "anchor.addEventListener('pointerleave', cancelHold);",
      replace: '// planted: leaving the anchor does not cancel hold',
      expectRed: /FAIL (pointer leave cancels the Armaments hold timer|pointer leave cancels a pending Armaments hold)/,
    },
    {
      name: 'utility picker can exceed the phone viewport',
      file: 'styles/combat.css',
      find: "    position: fixed; left: .5rem; right: .5rem;\n    bottom: calc(var(--action-row-drop) + var(--tap-floor) + .75rem);\n    transform: none; inline-size: auto;",
      replace: "    position: absolute; left: 50%; right: auto;\n    bottom: calc(var(--action-row-drop) + var(--tap-floor) + .75rem);\n    transform: translateX(-50%); inline-size: max-content;",
      expectRed: /FAIL utility picker is clamped to the phone viewport/,
    },
    {
      name: 'phone radial destinations overlap in the center cell',
      file: 'styles/combat.css',
      find: "  .armament-radial-target[data-radial-target='left'] { grid-row: 2; grid-column: 1; }",
      replace: "  .armament-radial-target[data-radial-target='left'] { grid-row: 2; grid-column: 2; }",
      expectRed: /FAIL radial controls have zero pairwise hit-box intersections/,
    },
    {
      name: 'Energy placement leaks out of the solo action-row owner into co-op',
      file: 'styles/combat.css',
      find: '.combat-action-row > .energy-orb {',
      replace: '.energy-orb {',
      expectRed: /combat-action-row: RED/,
    },
    {
      name: 'the co-op narrow hand loses its explicit hand/orb/end rows',
      file: 'styles/combat.css',
      find: ':root[data-layout=\'narrow\'] .combat.coop .hand-area {',
      replace: ':root[data-layout=\'narrow\'] .combat.coop .hand-area-plant {',
      expectRed: /combat-action-row: RED/,
    },
  ];
  const coopPlants = sourcePlants.splice(-2);
  const widePlants = [{
    name: 'wide radial contracts back onto player-facing hand names',
    file: 'styles/combat.css',
    find: 'width: min(32rem, calc(100vw - 3.2rem)); aspect-ratio: 1.35;',
    replace: 'width: min(24rem, 46vw); aspect-ratio: 1.35;',
    expectRed: /FAIL radial controls have zero pairwise hit-box intersections/,
  }];
  let code = await doorSelftest({
    tool: 'combat-action-row.mjs',
    args: ['--solo-only', '--only', '390x844', '--text', 'XL', '--hand', '8'],
    timeoutMs: 600000,
    plants: sourcePlants,
  });
  if (code) process.exit(code);
  code = await doorSelftest({
    tool: 'combat-action-row.mjs',
    args: ['--coop-only'],
    timeoutMs: 600000,
    plants: coopPlants,
  });
  if (code) process.exit(code);
  code = await doorSelftest({
    tool: 'combat-action-row.mjs',
    args: ['--solo-only', '--only', '1200x730', '--text', 'XL', '--hand', '8'],
    timeoutMs: 600000,
    plants: widePlants,
  });
  if (code) process.exit(code);
  if (args.includes('--selftest-source')) process.exit(0);
  const artifactPlants = (plants) => plants.map((plant, index) => ({
    ...plant,
    name: index === 0
      ? `standalone root is stale: ${plant.name}`
      : `selected-root twin: ${plant.name}`,
    file: 'AshenSpire.html',
  }));
  code = await doorSelftest({
    tool: 'combat-action-row.mjs',
    args: ['--standalone', '--solo-only', '--only', '390x844', '--text', 'XL', '--hand', '8'],
    timeoutMs: 600000,
    extraCopy: ['AshenSpire.html'],
    plants: artifactPlants(sourcePlants),
  });
  if (code) process.exit(code);
  code = await doorSelftest({
    tool: 'combat-action-row.mjs',
    args: ['--standalone', '--solo-only', '--only', '1200x730', '--text', 'XL', '--hand', '8'],
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
const CONTROL_SELECTORS = ['.armaments-command', '.energy-orb', '.end-turn', '.pile.draw', '.pile.discard'];

async function main() {
  const served = standalone ? null : await serve({ root: ROOT, port: 8321, open: false });
  const base = standalone
    ? pathToFileURL(resolve(ROOT, 'AshenSpire.html')).href
    : `http://localhost:${served.port}/index.html`;
  const browser = await launchBrowser({ prefix: 'action-row-', browser: browserPath, timeoutMs: 15000 });
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
    const radialSource = readFileSync(resolve(ROOT, 'src/ui/components/armamentRadial.js'), 'utf8');
    const combatCss = readFileSync(resolve(ROOT, 'styles/combat.css'), 'utf8');
    check(combatCss.includes(":root[data-armaments-presentation='radial'] .combat .hud-charge-flasks,")
      && !combatCss.includes(":root[data-armaments-presentation='radial'] .hud-charge-flasks,"),
    'radial flask hiding is scoped to combat');
    check(combatSource.includes("detail: leftPiece?.name || 'Empty'")
      && combatSource.includes("detail: rightPiece?.name || 'Empty'"),
    'radial hand labels use equipped player-facing names');
    check(combatSource.includes("window.addEventListener('keydown', onPickerCancel);")
      && combatSource.includes("closePicker({ restoreFocus: true });"),
    'the pile-surface chooser owns Escape and restores Discard focus');
    check(radialSource.includes('openedByHold = openMenu();'),
      'fixed mode suppresses a click only after a radial really opened');
    check(radialSource.includes("anchor.addEventListener('pointerleave', cancelHold);"),
      'pointer leave cancels the Armaments hold timer');
    check(combatCss.includes('max-inline-size: calc(100vw - 1rem);') && combatCss.includes('flex-wrap: wrap;'),
      'utility picker is clamped to the phone viewport');
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
    const waitFor = async (expression, label) => {
      const deadline = Date.now() + 15000;
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
      const owner=document.querySelector('.combat-action-row');
      const selectors=${JSON.stringify(CONTROL_SELECTORS)};
      const controls=selectors.map((selector) => {
        const node=document.querySelector(selector);
        if (!node || !visible(node)) return {selector,visible:false};
        const r=rect(node), hits=[];
        for(let row=0;row<9;row++) for(let col=0;col<5;col++) {
          const x=r.left+r.width*((col+0.5)/5), y=r.top+r.height*((row+0.5)/9);
          const hit=document.elementFromPoint(x,y);
          hits.push(!!(hit&&(hit===node||node.contains(hit))));
        }
        const centre=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
        return {selector,visible:true,...r,hitCount:hits.filter(Boolean).length,centreHit:!!(centre&&(centre===node||node.contains(centre))),centreNode:centre?(centre.tagName.toLowerCase()+'.'+(centre.className||'')):null,position:getComputedStyle(node).position,parent:node.parentElement?.className||''};
      });
      const shown=controls.filter((control)=>control.visible);
      const pairs=[];
      for(let i=0;i<shown.length;i++) for(let j=i+1;j<shown.length;j++) if(intersects(shown[i],shown[j])) pairs.push([shown[i].selector,shown[j].selector]);
      const cards=[...document.querySelectorAll('.hand .card')].filter(visible).map(rect);
      const pages=[...document.querySelectorAll('.hand-page')].filter(visible).map(rect);
      const foreign=shown.flatMap((control)=>[
        ...cards.filter((item)=>intersects(control,item)).map(()=>[control.selector,'card']),
        ...pages.filter((item)=>intersects(control,item)).map(()=>[control.selector,'pager']),
      ]);
      const grid=owner?getComputedStyle(owner):null;
      const discard=owner?.querySelector('.pile.discard');
      const exhaustSummary=discard?.querySelector('.exhaust-summary');
      return {
        layout:document.documentElement.dataset.layout||null,
        composition:document.documentElement.dataset.composition||null,
        state:document.documentElement.dataset.actionRowProbe||'rest',
        owner:{exists:!!owner,display:grid?.display||null,columns:grid?.gridTemplateColumns||null},
        owned:!!owner&&selectors.every((selector)=>owner.contains(document.querySelector(selector))),
        discard:{
          exists:!!discard,
          role:discard?.getAttribute('role')||discard?.tagName?.toLowerCase()||null,
          aria:discard?.getAttribute('aria-label')||'',
          summaryExists:!!exhaustSummary,
          summaryVisible:visible(exhaustSummary),
          summaryText:exhaustSummary?.textContent||'',
        },
        controls,pairs,foreign,
        onGlass:shown.every((r)=>r.left>=-0.25&&r.top>=-0.25&&r.right<=innerWidth+0.25&&r.bottom<=innerHeight+0.25),
        minTap:shown.length?Math.min(...shown.map((r)=>Math.min(r.width,r.height))):0,
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
            const now = state === 'exhaust' ? await settledReading('post-Exhaust action-row') : await reading();
            soloRan++;
            const tag = `${shape.width}x${shape.height} Text ${text}, hand ${hand}, ${state}, ${standalone ? 'root' : 'source'}`;
            console.log(`\n  ${tag}`);
            check(now.owner.exists && now.owner.display === 'grid' && now.owned,
              'one semantic grid owns Armaments, Actions, End Turn, Draw, and Discard', JSON.stringify(now.owner));
            check((now.owner.columns?.match(/px/g)||[]).length===5,
              'the action rail resolves to exactly five grid tracks', JSON.stringify(now.owner));
            check(now.pairs.length === 0, 'action controls have zero pairwise hit-box intersections', JSON.stringify(now.pairs));
            check(now.foreign.length === 0, 'action controls intersect no card or pager', JSON.stringify(now.foreign));
            check(now.onGlass && now.minTap >= 43.99,
              'every visible action control is on glass and at least 44px', JSON.stringify({onGlass:now.onGlass,minTap:now.minTap}));
            check(now.controls.filter((control)=>control.visible).every((control)=>control.hitCount===45&&control.centreHit),
              'every visible action control is 45/45 and center-hittable', JSON.stringify(now.controls));
            check(now.controls.filter((control)=>control.visible).every((control)=>control.position!=='absolute'),
              'grid children do not escape through absolute positioning', JSON.stringify(now.controls.map((c)=>[c.selector,c.position])));

            if (state === 'exhaust') {
              const baselineControls = Object.fromEntries(exhaustBaseline.controls.filter((c)=>c.visible).map((c)=>[c.selector,c]));
              const moved = now.controls.filter((c)=>c.visible).filter((c)=>{
                const was=baselineControls[c.selector];
                return !was || Math.max(
                  Math.abs(c.left-was.left),
                  Math.abs(c.top-was.top),
                  Math.abs(c.width-was.width),
                  Math.abs(c.height-was.height),
                )>0.5;
              }).map((c)=>c.selector);
              check(moved.length===0, 'showing the nested Exhaust summary preserves every standing action cell', JSON.stringify(moved));
              check(now.discard.summaryExists && now.discard.summaryVisible && /1 Exhaust/.test(now.discard.summaryText)
                && /Exhaust pile, 1/.test(now.discard.aria),
              'Discard carries the visible Exhaust summary and accessible count', JSON.stringify(now.discard));

              const opened = await click('.pile.discard');
              if (opened) await new Promise((pass) => setTimeout(pass, 80));
              const pileSurface = await evaluate(`(() => {
                const modal=document.querySelector('.pile-surface-picker');
                const buttons=[...(modal?.querySelectorAll('button')||[])];
                const rect=(node)=>{const r=node.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
                return {
                  exists:!!modal,
                  labels:buttons.map((button)=>button.textContent.trim()),
                  focused:buttons.indexOf(document.activeElement),
                  onGlass:buttons.every((button)=>{const r=rect(button);return r.left>=-.25&&r.top>=-.25&&r.right<=innerWidth+.25&&r.bottom<=innerHeight+.25}),
                  minTap:buttons.length?Math.min(...buttons.map((button)=>{const r=rect(button);return Math.min(r.width,r.height)})):0,
                };
              })()`);
              check(opened && pileSurface.exists && pileSurface.labels.length===2
                && pileSurface.labels.some((label)=>label.startsWith('Discard pile'))
                && pileSurface.labels.some((label)=>label.startsWith('Exhaust pile')),
              'Discard opens the two real pile surfaces', JSON.stringify(pileSurface));
              check(pileSurface.focused===0 && pileSurface.onGlass && pileSurface.minTap>=43.99,
                'the pile-surface picker focuses first and keeps 44px controls on glass', JSON.stringify(pileSurface));
              await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape' }, sessionId);
              await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }, sessionId);
              await new Promise((pass) => setTimeout(pass, 80));
              const pileCancelled = await evaluate(`!document.querySelector('.pile-surface-picker') && document.activeElement?.matches('.pile.discard')`);
              check(pileCancelled, 'Escape closes the pile-surface chooser and restores Discard focus');

              const radialOpened = await click('.armaments-command');
              if (radialOpened) await new Promise((pass) => setTimeout(pass, 80));
              const radial = await evaluate(`(() => {
                const root=document.querySelector('.armament-radial');
                const anchor=document.querySelector('.armaments-command');
                const buttons=[...(root?.querySelectorAll('.armament-radial-target')||[])];
                const rect=(node)=>{const r=node.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
                const intersects=(a,b)=>a.left<b.right-.25&&a.right>b.left+.25&&a.top<b.bottom-.25&&a.bottom>b.top+.25;
                const rows=buttons.map((button)=>({target:button.dataset.radialTarget,label:button.getAttribute('aria-label')||'',detail:button.querySelector('small')?.textContent||'',...rect(button)}));
                const pairs=[];for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)if(intersects(rows[i],rows[j]))pairs.push([i,j]);
                const hits=buttons.map((button)=>{const r=rect(button),node=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);return !!(node&&(node===button||button.contains(node)))});
                return {
                  exists:!!root,hidden:root?.hidden??true,role:root?.getAttribute('role')||'',expanded:anchor?.getAttribute('aria-expanded')||'',
                  count:rows.length,targetKinds:[...new Set(rows.map((row)=>row.target))].sort(),named:rows.every((row)=>!!row.label),
                  handDetails:rows.filter((row)=>row.target==='left'||row.target==='right').map((row)=>row.detail),pairs,hits,
                  onGlass:rows.every((r)=>r.left>=-.25&&r.top>=-.25&&r.right<=innerWidth+.25&&r.bottom<=innerHeight+.25),
                  minTap:rows.length?Math.min(...rows.map((r)=>Math.min(r.width,r.height))):0,
                };
              })()`);
              check(radialOpened && radial.exists && !radial.hidden && radial.role==='menu' && radial.expanded==='true',
                'Armaments opens its real menu and reports expanded state', JSON.stringify(radial));
              check(radial.count>=5 && JSON.stringify(radial.targetKinds)===JSON.stringify(['bottom','full','left','right','top'])
                && radial.named,
              'the radial exposes all five named placement targets', JSON.stringify(radial));
              check(radial.handDetails.length===2 && radial.handDetails.every((detail)=>/^[A-Z]/.test(detail)),
                'radial hand labels use equipped player-facing names', JSON.stringify(radial.handDetails));
              check(radial.pairs.length===0,
                'radial controls have zero pairwise hit-box intersections', JSON.stringify(radial.pairs));
              check(radial.hits.every(Boolean) && radial.onGlass && radial.minTap>=43.99,
                'radial controls remain center-hittable, on glass, and at least 44px', JSON.stringify(radial));

              const behaviorCell = (shape.width===320 && shape.height===640 && text==='M' && hand===1)
                || (shapes.length===1 && texts.length===1 && hands.length===1);
              if (behaviorCell) {
                const mapFlasksVisible = await evaluate(`(() => {
                  const map=document.createElement('div');map.className='mapscreen';
                  map.innerHTML='<div class="hud-charge-flasks"><button>HP</button><button>MP</button></div><div class="hud-potions"><button>Utility</button></div>';
                  document.body.appendChild(map);const controls=[...map.querySelectorAll('button')];
                  const visible=controls.every((button)=>{const r=button.getBoundingClientRect();return getComputedStyle(button.parentElement).display!=='none'&&r.width>0&&r.height>0&&!button.disabled;});
                  map.remove();return visible;
                })()`);
                check(mapFlasksVisible, 'radial mode leaves map flask controls visible and focusable');
                await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape' }, sessionId);
                await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }, sessionId);
                await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'f', code: 'KeyF' }, sessionId);
                await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'f', code: 'KeyF' }, sessionId);
                await new Promise((pass) => setTimeout(pass, 100));
                const hotkeyMenu = await evaluate(`(() => {
                  const menu=document.querySelector('.flask-action-menu'), root=document.querySelector('.armament-radial');
                  if(!menu) return {exists:false}; const r=menu.getBoundingClientRect();
                  return {exists:true,radialHidden:root?.hidden===true,onGlass:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,inspect:!!menu.querySelector('[data-flask-action="inspect"]')};
                })()`);
                check(hotkeyMenu.exists && hotkeyMenu.radialHidden && hotkeyMenu.onGlass && hotkeyMenu.inspect,
                  'Flask 1 routes through a visible radial anchor before opening actions', JSON.stringify(hotkeyMenu));
                await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape' }, sessionId);
                await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }, sessionId);

                await evaluate(`(() => { window.__combat.player.flaskCharges.hpCurrent=0; window.__renderCombatForShot(); return true; })()`);
                await click('.armaments-command');
                const hpEnabled = await evaluate(`!document.querySelector('.armament-radial-target[data-flask-hotkey-slot="0"]')?.disabled`);
                await click('.armament-radial-target[data-flask-hotkey-slot="0"]');
                const depletedPlan = await evaluate(`(() => ({
                  radialHidden:document.querySelector('.armament-radial')?.hidden===true,
                  useDisabled:document.querySelector('[data-flask-action="use"]')?.getAttribute('aria-disabled')==='true',
                  inspectEnabled:document.querySelector('[data-flask-action="inspect"]')?.getAttribute('aria-disabled')==='false',
                }))()`);
                check(hpEnabled && depletedPlan.radialHidden && depletedPlan.useDisabled && depletedPlan.inspectEnabled,
                  'depleted radial flasks remain openable for Inspect while Use stays disabled', JSON.stringify(depletedPlan));
                await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape' }, sessionId);
                await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }, sessionId);

                await click('.armaments-command');
                await click('.armament-radial-target[data-radial-target="left"]');
                const armouryTransition = await evaluate(`({armoury:!!document.querySelector('.armoury-overlay'),radialHidden:document.querySelector('.armament-radial')?.hidden===true})`);
                check(armouryTransition.armoury && armouryTransition.radialHidden,
                  'hand targets close the radial before opening Armoury', JSON.stringify(armouryTransition));
                await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape' }, sessionId);
                await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }, sessionId);

                if (shape.width <= 900) {
                  const hasUtility = await evaluate(`(() => {
                    const list=window.__combat.player.flasks;if(!list.length)return false;
                    const one=list[0];window.__combat.player.flasks=[one,{...one},{...one}];window.__renderCombatForShot();return true;
                  })()`);
                  if (hasUtility) {
                    await click('.armaments-command');
                    await click('.armament-radial-target[data-radial-target="bottom"]');
                    const pickerFit = await evaluate(`(() => {
                      const picker=document.querySelector('.armament-radial-picker');if(!picker)return {exists:false};
                      const r=picker.getBoundingClientRect(),buttons=[...picker.querySelectorAll('button')];
                      return {exists:true,count:buttons.length,onGlass:r.left>=-.25&&r.right<=innerWidth+.25,scrollBound:picker.scrollWidth<=picker.clientWidth+1};
                    })()`);
                    check(pickerFit.exists && pickerFit.count===3 && pickerFit.onGlass && pickerFit.scrollBound,
                      'utility picker is clamped to the phone viewport', JSON.stringify(pickerFit));
                    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape' }, sessionId);
                    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }, sessionId);
                  }
                }

                const fixedHold = await evaluate(`(async () => {
                  document.documentElement.dataset.armamentsPresentation='fixed';
                  await new Promise((pass)=>setTimeout(pass,40));
                  const anchor=document.querySelector('.armaments-command');
                  anchor.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
                  await new Promise((pass)=>setTimeout(pass,390));
                  anchor.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
                  anchor.click();
                  await new Promise((pass)=>setTimeout(pass,40));
                  return {armoury:!!document.querySelector('.armoury-overlay'),mode:anchor.dataset.armamentsMode};
                })()`);
                check(fixedHold.armoury && fixedHold.mode==='fixed',
                  'fixed mode held presses still open Armoury', JSON.stringify(fixedHold));
                await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape' }, sessionId);
                await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' }, sessionId);

                const cancelledHold = await evaluate(`(async () => {
                  document.documentElement.dataset.armamentsPresentation='radial';
                  await new Promise((pass)=>setTimeout(pass,40));
                  const anchor=document.querySelector('.armaments-command'),root=document.querySelector('.armament-radial');
                  anchor.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
                  anchor.dispatchEvent(new PointerEvent('pointerleave',{bubbles:true}));
                  await new Promise((pass)=>setTimeout(pass,390));
                  anchor.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
                  return {hidden:root.hidden,expanded:anchor.getAttribute('aria-expanded')};
                })()`);
                check(cancelledHold.hidden && cancelledHold.expanded==='false',
                  'pointer leave cancels a pending Armaments hold', JSON.stringify(cancelledHold));
              }
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
          const coop = await evaluate(`(() => {
            const area=document.querySelector('.combat.coop .hand-area');
            const hand=area?.querySelector(':scope > .hand');
            const energy=area?.querySelector(':scope > .energy-orb');
            const end=area?.querySelector(':scope > .end-turn');
            const rect=(node)=>{const r=node.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
            const intersects=(a,b)=>a.left<b.right-0.25&&a.right>b.left+0.25&&a.top<b.bottom-0.25&&a.bottom>b.top+0.25;
            const hit=(node)=>{const r=rect(node),hits=[];for(let row=0;row<9;row++)for(let col=0;col<5;col++){const x=r.left+r.width*((col+.5)/5),y=r.top+r.height*((row+.5)/9),n=document.elementFromPoint(x,y);hits.push(!!(n&&(n===node||node.contains(n))))}return hits.filter(Boolean).length};
            const cards=[...hand.querySelectorAll('.card')].map(rect);
            const ar=rect(area),hr=rect(hand),er=rect(energy),tr=rect(end);
            const acs=getComputedStyle(area),es=getComputedStyle(energy),ts=getComputedStyle(end);
            const pad=parseFloat(acs.paddingLeft)+parseFloat(acs.paddingRight);
            return {
              layout:document.documentElement.dataset.layout||null,
              direct:energy.parentElement===area&&hand.parentElement===area&&end.parentElement===area,
              ownerAbsent:!document.querySelector('.combat.coop .combat-action-row'),
              areas:acs.gridTemplateAreas,
              columns:acs.gridTemplateColumns,
              area:ar,hand:hr,energy:er,end:tr,
              energyPosition:es.position,endPosition:ts.position,
              energyArea:es.gridArea,endArea:ts.gridArea,
              fullHand:(document.documentElement.dataset.layout==='narrow')
                ? hr.width>=ar.width-pad-1
                : hr.width>=500&&Math.abs(((hr.left+hr.right)/2)-((ar.left+ar.right)/2))<=1,
              pairClear:!intersects(er,tr),
              cardsClear:cards.every((card)=>!intersects(card,er)&&!intersects(card,tr)),
              onGlass:[er,tr].every((r)=>r.left>=-.25&&r.top>=-.25&&r.right<=innerWidth+.25&&r.bottom<=innerHeight+.25),
              hitCounts:[hit(energy),hit(end)],
            };
          })()`);
          coopRan++;
          const narrow = coop.layout === 'narrow';
          const tag = `${shape.width}x${shape.height} Text ${text}, co-op, ${standalone ? 'root' : 'source'}`;
          console.log(`\n  ${tag}`);
          check(coop.direct && coop.ownerAbsent, 'co-op controls remain direct children outside the solo owner', JSON.stringify({direct:coop.direct,ownerAbsent:coop.ownerAbsent}));
          check(coop.fullHand, 'co-op hand keeps the full available row width', JSON.stringify({area:coop.area.width,hand:coop.hand.width}));
          check(coop.pairClear && coop.cardsClear, 'co-op controls neither overlap each other nor cover cards', JSON.stringify({pairClear:coop.pairClear,cardsClear:coop.cardsClear}));
          check(coop.onGlass && Math.min(coop.energy.width,coop.energy.height)>=43.99 && coop.hitCounts[1]===45,
            'co-op Energy keeps visible 44px geometry and End Turn is 45/45 hittable', JSON.stringify({onGlass:coop.onGlass,energy:coop.energy,hits:coop.hitCounts}));
          check(narrow
            ? coop.areas.includes('"hand hand"') && coop.areas.includes('"orb end"') && coop.energyPosition==='static' && coop.endPosition==='static' && coop.energyArea==='orb' && coop.endArea==='end'
            : coop.energyPosition==='absolute' && coop.endPosition==='absolute',
          'co-op placement follows its own wide/narrow contract', JSON.stringify({layout:coop.layout,areas:coop.areas,columns:coop.columns,energyPosition:coop.energyPosition,endPosition:coop.endPosition,energyArea:coop.energyArea,endArea:coop.endArea}));

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
    cdp.close();
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
