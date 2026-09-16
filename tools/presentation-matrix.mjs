#!/usr/bin/env node
// Final phone presentation contract: source/dist x Grace/creation/Armoury x 320/390.
// Use --surface armoury for the dedicated-tab contract. The default keeps all
// three surfaces and captures failed cells so older fixture drift stays visible.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { META_KEY, META_SCHEMA_VERSION } from '../src/engine/save.js';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const OUT = resolve(ROOT, arg('--out', 'audit-evidence/presentation-matrix'));
const CHROME = process.env.CHROME;
const SHAPES = [
  { tag: '320x640', width: 320, height: 640 },
  { tag: '390x844', width: 390, height: 844 },
];
const TREES = ['source', 'dist'];
const ALL_SURFACES = ['grace', 'creation', 'armoury'];
const requestedSurface = arg('--surface', 'all');
if (requestedSurface !== 'all' && !ALL_SURFACES.includes(requestedSurface)) throw new Error(`Unknown surface: ${requestedSurface}`);
const SURFACES = requestedSurface === 'all' ? ALL_SURFACES : [requestedSurface];
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { ok, no } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) no(new Error(msg.error.message)); else ok(msg.result);
  });
  return {
    ready: new Promise((ok, no) => { ws.addEventListener('open', ok); ws.addEventListener('error', no); }),
    send(method, params = {}, sessionId) {
      const callId = ++id;
      return new Promise((ok, no) => {
        pending.set(callId, { ok, no });
        ws.send(JSON.stringify({ id: callId, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

async function browser() {
  const candidates = [CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean);
  const exe = candidates.find(existsSync);
  if (!exe) throw new Error('Chrome/Chromium absent; set CHROME to its exact path');
  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'presentation-matrix-', browser: exe, headless: '--headless=new',
    args: ['--allow-file-access-from-files'],
    timeoutMs: 15000,
  });
  const cdp = connect(wsUrl);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  const evaluate = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'page evaluation failed');
    return result.result.value;
  };
  const until = async (expression, label, timeout = 12000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await evaluate(expression).catch(() => false)) return;
      await wait(80);
    }
    throw new Error(`timed out waiting for ${label}`);
  };
  return {
    cdp, sessionId, evaluate, until,
    close() { cdp.close(); return dropBrowser(); },
  };
}

const allArmaments = (contentBundle.equipment?.armaments || []).map((row) => row.id);
const PROFILE = JSON.stringify({
  schemaVersion: META_SCHEMA_VERSION,
  settings: {}, results: [], found: allArmaments,
  discoveredArmaments: allArmaments, discoveryReceipts: [],
});

function contract(surface, reading) {
  const failures = [];
  const need = (condition, label) => { if (!condition) failures.push(label); };
  need(reading.mounted, `${surface}: landmark mounted`);
  need(reading.horizontalOverflow <= 1, `${surface}: no horizontal viewport overflow`);
  // Chromium may report an authored 44px box as 43.99997 after zoom. Keep the
  // tolerance far below one device pixel; the 43px mutant must still fail.
  need(reading.minControl >= 43.99, `${surface}: relevant controls are at least 44px`);
  need(reading.controlsOutside === 0, `${surface}: relevant controls remain inside the viewport`);
  if (surface === 'grace') {
    need(reading.title === 'Reallocate Flask Charges', 'grace: exact feature name');
    need(reading.capacity === 3, 'grace: fixed capacity 3 is visible');
    // E10 (2026-08-17). This used to freeze the OLD surface —
    // `['0/3','1/2','2/1','3/0']`, the `capacity + 1` split buttons he asked us
    // to remove — so it was an instrument asserting the defect. It now asserts
    // the shape he asked for: ONE step pair per charge kind, the counts summing
    // to capacity, and the total said ON THE SCREEN rather than promised.
    need(reading.steps.length === reading.counts.length * 2,
      'grace: exactly one minus and one plus per charge kind');
    need(reading.counts.length >= 2, 'grace: every charge kind has a row of its own');
    need(reading.counts.reduce((a, b) => a + b, 0) === reading.capacity,
      'grace: the counts on screen sum to the fixed capacity');
    need(reading.totalLine === `${reading.capacity} of ${reading.capacity} assigned`,
      'grace: the screen SAYS the total holds, it does not merely keep it');
    need(reading.fullMana === true, 'grace: baseline Mana is visibly full at 2/2');
  } else if (surface === 'creation') {
    need(reading.kitCount >= 2, 'creation: baseline and discovered alternate are visible');
    need(reading.chosenKit === 1, 'creation: exactly one kit is selected');
    need(reading.alternateSelected === true, 'creation: the discovered alternate can be selected');
    need((reading.derived || []).join('|') === 'HP|Mana|Stamina|Actions / turn|Draw / turn and opening hand',
      'creation: canonical five derived receipts render in order');
    need(reading.roleRows === 4, 'creation: 4/4/1/1 kit receipt exposes three equipment roles plus signature');
    need(reading.equipmentReceiptRows === 3 && reading.hasReceiptMath === true,
      'creation: three equipment roles show computed receipt math');
    need(reading.signatureRows === 1, 'creation: the fourth row is the fixed class signature');
    need(reading.rolesVisible === true, 'creation: all four role rows are visible in the detail evidence');
  } else if (surface === 'armoury') {
    need(reading.view === 'hybrid', 'armoury: Inventory tab is selected');
    need(reading.attributeCount === 5, 'armoury: Character contains all five primary attribute cards');
    need((reading.roles || []).join('|') === 'attack|guard|technique',
      'armoury: Attack, Guard and Technique share one equipment receipt panel');
    need(reading.hasReceiptMath === true, 'armoury: role receipts show base, tier, rarity and total');
    need(reading.cardsRegionOpen === true, 'armoury: Cards tab exposes a portrait card gallery');
    need(reading.cardCount > 0 && reading.cardCount === reading.expectedCardCount, 'armoury: Cards tab count matches the complete deck heading');
    need(reading.candidateOpen === true, 'armoury: an Inventory item disclosure is open');
    need(reading.candidateRoles >= 1, 'armoury: expanded inventory item exposes information');
    need(reading.hasModel && reading.hasAction,
      'armoury: expanded inventory item exposes its model and equipment action');
    need(reading.candidateProofVisible === true,
      'armoury: Inventory disclosure is reachable without horizontal clipping');
    need(reading.primaryProofVisible === true,
      'armoury: Character equipment role math is reachable without horizontal clipping');
  }
  return failures;
}

function proveMutants() {
  const grace = { mounted: true, horizontalOverflow: 0, minControl: 44, controlsOutside: 0,
    title: 'Reallocate Flask Charges', capacity: 3,
    steps: ['hp-o', 'hp+o', 'mana-o', 'mana+o'], counts: [2, 1], totalLine: '3 of 3 assigned', fullMana: true };
  const creation = { mounted: true, horizontalOverflow: 0, minControl: 44, controlsOutside: 0,
    kitCount: 2, chosenKit: 1, alternateSelected: true,
    derived: ['HP', 'Mana', 'Stamina', 'Actions / turn', 'Draw / turn and opening hand'], roleRows: 4,
    equipmentReceiptRows: 3, signatureRows: 1, hasReceiptMath: true, rolesVisible: true };
  const armoury = { mounted: true, horizontalOverflow: 0, minControl: 44, controlsOutside: 0,
    view: 'hybrid', attributeCount: 5, roles: ['attack', 'guard', 'technique'], hasReceiptMath: true,
    cardsRegionOpen: true, cardCount: 4, expectedCardCount: 4, candidateOpen: true, candidateRoles: 3,
    hasModel: true, hasAction: true,
    candidateProofVisible: true, primaryProofVisible: true };
  const plants = [
    ['missing landmark', 'grace', grace, (x) => { x.mounted = false; }],
    ['the counts stop summing to capacity', 'grace', grace, (x) => { x.counts[1] = 2; }],
    ['a charge kind loses one of its two steps', 'grace', grace, (x) => { x.steps.pop(); }],
    ['the total line stops matching the total', 'grace', grace, (x) => { x.totalLine = '2 of 3 assigned'; }],
    ['a charge kind loses its row entirely', 'grace', grace, (x) => { x.counts = [3]; x.steps = ['hp-o', 'hp+o']; }],
    ['Mana baseline drift', 'grace', grace, (x) => { x.fullMana = false; }],
    ['missing alternate', 'creation', creation, (x) => { x.kitCount = 1; }],
    ['missing role receipt', 'creation', creation, (x) => { x.roleRows = 3; }],
    ['signature mistaken for scaling math', 'creation', creation, (x) => { x.signatureRows = 0; x.equipmentReceiptRows = 4; }],
    ['role rows below crop', 'creation', creation, (x) => { x.rolesVisible = false; }],
    ['missing primary attribute', 'armoury', armoury, (x) => { x.attributeCount = 4; }],
    ['missing equipment role', 'armoury', armoury, (x) => { x.roles.pop(); }],
    ['false cards count', 'armoury', armoury, (x) => { x.cardCount = 0; }],
    ['hidden candidate receipt', 'armoury', armoury, (x) => { x.candidateOpen = false; }],
    ['candidate proof clipped', 'armoury', armoury, (x) => { x.candidateProofVisible = false; }],
    ['primary receipt proof clipped', 'armoury', armoury, (x) => { x.primaryProofVisible = false; }],
    ['undersized control', 'grace', grace, (x) => { x.minControl = 43; }],
    ['horizontal bleed', 'armoury', armoury, (x) => { x.horizontalOverflow = 2; }],
  ];
  for (const [name, surface, seed, mutate] of plants) {
    const copy = structuredClone(seed);
    mutate(copy);
    if (!contract(surface, copy).length) throw new Error(`dead contract mutant: ${name}`);
  }
  const a = JSON.stringify({ surface: 'grace', title: grace.title, capacity: grace.capacity, counts: grace.counts });
  const b = JSON.stringify({ surface: 'grace', title: grace.title, capacity: 4, counts: grace.counts });
  if (a === b) throw new Error('dead source/dist parity mutant');
  console.log(`contract mutants: ${plants.length + 1}/${plants.length + 1} caught`);
}

const READERS = {
  grace: `(() => {
    const n=(value)=>Math.round(value*100)/100;
    const root = document.querySelector('#flask-reallocate');
    const buttons = [...document.querySelectorAll('#flask-reallocate .flask-step')];
    const boxes = buttons.map((x) => x.getBoundingClientRect());
    const text = document.querySelector('#rest-opt p')?.textContent || '';
    return { mounted: !!root, horizontalOverflow: Math.max(0, document.documentElement.scrollWidth-innerWidth),
      minControl: boxes.length ? n(Math.min(...boxes.map((x) => Math.min(x.width,x.height)))) : 0,
      controlsOutside: boxes.filter((x) => x.left < 0 || x.right > innerWidth || x.top < 0 || x.bottom > innerHeight).length,
      title: root?.querySelector('h3')?.textContent.trim() || '', capacity: Number(/capacity\\D*(\\d+)/i.exec(root?.querySelector('p')?.textContent||'')?.[1]),
      steps: buttons.map((x) => x.dataset.kind + (Number(x.dataset.step) > 0 ? '+' : '-') + (x.getAttribute('aria-disabled') === 'true' ? 'x' : 'o')),
      counts: [...document.querySelectorAll('#flask-reallocate .flask-increment-count')].map((x) => Number(x.textContent.trim())),
      totalLine: (root?.querySelector('.flask-increment-total')?.textContent || '').trim(),
      fullMana: /Mana\\D*2\\D+2/.test(text) };
  })()`,
  creation: `(() => {
    const n=(value)=>Math.round(value*100)/100;
    const kitButtons=[...document.querySelectorAll('#cz-kits button')];
    const relevant=[...kitButtons, document.querySelector('.cz-stats summary')].filter(Boolean);
    const boxes=relevant.map((x)=>x.getBoundingClientRect());
    const derived=[...document.querySelectorAll('#cz-stat-projection .statproj-derived [data-stat] > b')].map((x)=>x.textContent.trim());
    const roleRows=[...document.querySelectorAll('.cz-kit li')];
    const equipmentRows=roleRows.filter((x)=>/=/.test(x.textContent));
    const signatureRows=roleRows.filter((x)=>/class signature/i.test(x.textContent));
    const roleBoxes=roleRows.map((x)=>x.getBoundingClientRect());
    return { mounted: !!document.querySelector('#cz-stat-projection'), horizontalOverflow: Math.max(0,document.documentElement.scrollWidth-innerWidth),
      minControl: boxes.length?n(Math.min(...boxes.map((x)=>Math.min(x.width,x.height)))):0,
      controlsOutside: boxes.filter((x)=>x.left<0||x.right>innerWidth||x.top<0||x.bottom>innerHeight).length,
      kitCount: kitButtons.length, chosenKit: kitButtons.filter((x)=>x.classList.contains('chosen')).length,
      alternateSelected: kitButtons.length>1 && kitButtons[1].classList.contains('chosen'), derived, roleRows: roleRows.length,
      equipmentReceiptRows:equipmentRows.length, signatureRows:signatureRows.length,
      hasReceiptMath: equipmentRows.length===3 && equipmentRows.every((x)=>/=/.test(x.textContent)),
      rolesVisible:roleBoxes.length===4&&roleBoxes.every((x)=>x.left>=0&&x.right<=innerWidth&&x.top>=0&&x.bottom<=innerHeight) };
  })()`,
  armoury: `(() => {
    const viewButtons=[...document.querySelectorAll('[data-surface="armouryView"] [data-member]')];
    const boxes=viewButtons.map(x=>x.getBoundingClientRect());
    const panel=document.querySelector('.armoury');
    const reveal=document.querySelector('.armoury-inventory .disc-reveal:not([hidden])');
    const rect=reveal?.getBoundingClientRect();
    return { ...window.__armouryEvidence,
      mounted:!!panel, horizontalOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth,panel.scrollWidth-panel.clientWidth),
      minControl:boxes.length?Math.round(Math.min(...boxes.map(x=>Math.min(x.width,x.height)))*100)/100:0,
      controlsOutside:boxes.filter(x=>x.left<0||x.right>innerWidth||x.top<0||x.bottom>innerHeight).length,
      view:panel.dataset.view,
      candidateOpen:!!reveal,candidateRoles:reveal?.querySelectorAll('.inventory-information').length||0,
      hasModel:!!reveal?.querySelector('.inventory-model'),hasAction:!!reveal?.querySelector('[data-act]'),
      candidateProofVisible:!!rect&&rect.width>0&&rect.left>=0&&rect.right<=innerWidth,
    };
  })()`,
};

async function seedProfile(b, base) {
  await b.cdp.send('Page.navigate', { url: base }, b.sessionId);
  await b.until('document.readyState === "complete"', 'base origin');
  await b.evaluate(`localStorage.clear(); localStorage.setItem(${JSON.stringify(META_KEY)}, ${JSON.stringify(PROFILE)}); true`);
}

async function openCreationFromProfile(b, base) {
  const evidenceBase = `${base}${base.includes('?') ? '&' : '?'}shotEvidence=creation`;
  await seedProfile(b, evidenceBase);
  // A shot boot intentionally swaps localStorage for an in-memory store. Enter
  // through the real title/new-slot flow so this contract observes the seeded
  // profile through the same save manager a player uses.
  await b.cdp.send('Page.navigate', { url: evidenceBase }, b.sessionId);
  await b.until(`!!document.querySelector('.slot-new[data-slot="1"]')`, 'new slot');
  await b.evaluate(`document.querySelector('.slot-new[data-slot="1"]').click(); true`);
}

async function pose(b, base, surface) {
  const query = surface === 'grace' ? '?shot=rest' : surface === 'creation' ? '?shot=customize' : '?shot=combat&shotEvidence=armoury';
  await seedProfile(b, base);
  await b.cdp.send('Page.navigate', { url: base + query }, b.sessionId);
  if (surface === 'grace') {
    await b.until('!!document.querySelector("#flask-reallocate")', 'Grace reallocation');
    await b.evaluate('document.querySelector("#flask-reallocate").scrollIntoView({block:"center"}); true');
  } else if (surface === 'creation') {
    await openCreationFromProfile(b, base);
    await b.until('!!document.querySelector("#cz-stat-projection")', 'creation projection');
    await b.evaluate(`(() => {
      const buttons=[...document.querySelectorAll('#cz-kits button')];
      if(buttons[1]) buttons[1].click();
      const stats=document.querySelector('.cz-stats'); if(stats) stats.open=true;
      const kit=document.querySelector('.cz-kit'); if(kit) kit.open=true;
      (stats||document.querySelector('#cz-stat-projection')).scrollIntoView({block:'center'});
      return true;
    })()`);
  } else {
    await b.until('!!document.querySelector("#combat-armoury")', 'combat Armoury button');
    await b.evaluate('document.querySelector("#combat-armoury").click(); true');
    await b.until('!!document.querySelector(".armoury")', 'Armoury');
    await b.evaluate(`(() => {
      const tab=id=>document.querySelector('[data-surface="armouryView"] [data-member="'+id+'"]').click();
      tab('grid');
      const attributeCount=document.querySelectorAll('.character-attributes .cc-attribute-card').length;
      const roles=[...document.querySelectorAll('.equip-role-receipts [data-role]')].map(x=>x.dataset.role);
      const receipts=[...document.querySelectorAll('.equip-role-receipts [data-role]')].map(x=>x.textContent);
      const receipt=document.querySelector('.equipmentReceiptsCard');
      if(receipt) receipt.open=true;
      window.__armouryEvidence={attributeCount,roles,
        hasReceiptMath:receipts.length===3&&receipts.every(x=>/base/i.test(x)&&/tier/i.test(x)&&/rarity/i.test(x)&&/=/.test(x))};
      tab('cards');
      const cards=[...document.querySelectorAll('.armoury-card-gallery > .card')];
      window.__armouryEvidence.cardCount=cards.length;
      window.__armouryEvidence.expectedCardCount=Number(document.querySelector('.armoury-strip .as-title')?.textContent.match(/\\d+/)?.[0]||document.querySelector('.armoury-strip')?.textContent.match(/Cards[^0-9]*(\\d+)/)?.[1]||0);
      window.__armouryEvidence.cardsRegionOpen=cards.length>0&&cards.every(x=>{const r=x.getBoundingClientRect();return r.width>0&&Math.abs(r.width/r.height-5/7)<0.03;});
      tab('hybrid');
      const face=document.querySelector('.armoury-inventory .disc-face');
      if(face){const r=face.getBoundingClientRect();for(const type of ['pointerdown','pointerup','click']) face.dispatchEvent(new (type==='click'?MouseEvent:PointerEvent)(type,{bubbles:true,cancelable:true,pointerId:779,pointerType:'mouse',button:0,detail:1,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));}
      document.querySelector('.armoury-inventory .disc-reveal:not([hidden])')?.scrollIntoView({block:'center'});
      return true;
    })()`);
    await b.until('!!document.querySelector(".armoury-inventory .disc-reveal:not([hidden])")', 'Inventory disclosure');
  }
  await wait(180);
}

async function main() {
  proveMutants();
  if (!existsSync(resolve(ROOT, 'dist/AshenSpire.html'))) throw new Error('dist/AshenSpire.html absent');
  mkdirSync(OUT, { recursive: true });
  const source = await serve({ root: ROOT, port: 8347, open: false });
  const bases = { source: source.url.replace(/\/$/, ''), dist: pathToFileURL(resolve(ROOT, 'dist/AshenSpire.html')).href };
  const b = await browser();
  const rows = [];
  try {
    for (const shape of SHAPES) {
      await b.cdp.send('Emulation.setDeviceMetricsOverride', {
        width: shape.width, height: shape.height, deviceScaleFactor: 1, mobile: true,
      }, b.sessionId);
      for (const tree of TREES) {
        for (const surface of SURFACES) {
          let reading = { mounted: false, horizontalOverflow: 999, minControl: 0, controlsOutside: 999 };
          let error = '';
          try {
            await pose(b, bases[tree], surface);
            reading = await b.evaluate(READERS[surface]);
          } catch (reason) { error = reason.message; }
          let detailShot = null;
          if (!error && (surface === 'creation' || surface === 'armoury')) {
            detailShot = resolve(OUT, `${tree}-${surface}-detail-${shape.tag}.png`);
            const detailImage = await b.cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, b.sessionId);
            writeFileSync(detailShot, Buffer.from(detailImage.data, 'base64'));
            if (surface === 'creation') {
              await b.evaluate(`document.querySelector('#cz-kits')?.scrollIntoView({block:'start'}); true`);
            } else {
              reading.primaryProofVisible = await b.evaluate(`(() => {
                document.querySelector('[data-surface="armouryView"] [data-member="grid"]').click();
                const receipt=document.querySelector('.equipmentReceiptsCard');
                if(receipt) receipt.open=true;
                const roles=receipt?.querySelector('.equip-role-receipts');
                roles?.scrollIntoView({block:'center'});
                const visible=x=>{const b=x?.getBoundingClientRect();return !!b&&b.width>0&&b.left>=0&&b.right<=innerWidth;};
                return !!roles&&[...roles.querySelectorAll('[data-role]')].every(visible);
              })()`);
            }
            await wait(100);
          }
          const shot = resolve(OUT, `${tree}-${surface}-${shape.tag}.png`);
          const image = await b.cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, b.sessionId);
          writeFileSync(shot, Buffer.from(image.data, 'base64'));
          const failures = [...(error ? [`drive: ${error}`] : []), ...contract(surface, reading)];
          rows.push({ tree, surface, shape: shape.tag, reading, failures, shot, ...(detailShot ? { detailShot } : {}) });
          console.log(`${failures.length ? 'RED ' : 'PASS'} ${tree.padEnd(6)} ${surface.padEnd(8)} ${shape.tag} -> ${shot}`);
          for (const failure of failures) console.log(`     ${failure}`);
          console.log(`     read ${JSON.stringify(reading)}`);
        }
      }
    }
  } finally {
    b.close();
    source.server.close();
  }

  // Semantic parity, not screenshot hashes: animation timing may alter pixels.
  for (const shape of SHAPES) for (const surface of SURFACES) {
    const sourceRow = rows.find((x) => x.tree === 'source' && x.shape === shape.tag && x.surface === surface);
    const distRow = rows.find((x) => x.tree === 'dist' && x.shape === shape.tag && x.surface === surface);
    if (JSON.stringify(sourceRow.reading) !== JSON.stringify(distRow.reading)) {
      sourceRow.failures.push(`${surface}: source/dist semantic reading drift`);
      distRow.failures.push(`${surface}: source/dist semantic reading drift`);
    }
  }
  const red = rows.filter((row) => row.failures.length);
  writeFileSync(resolve(OUT, 'presentation-matrix.json'), JSON.stringify(rows, null, 2));
  console.log(`\npresentation-matrix: ${rows.length - red.length}/${rows.length} green, ${red.length}/${rows.length} red; ${rows.length + rows.filter(row => row.detailShot).length} screenshots written`);
  console.log('BOUNDARY: headless Chrome stills at two phone shapes. This checks DOM truth, geometry, and source/dist parity; it does not certify touch feel, animation, or desktop.');
  process.exit(red.length ? 1 : 0);
}

main().catch((error) => { console.error(`presentation-matrix: ${error.message}`); process.exit(2); });
