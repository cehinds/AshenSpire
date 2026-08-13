#!/usr/bin/env node
// Final phone presentation contract: source/dist x Grace/creation/Armoury x 320/390.
// This is deliberately an observed-red tool on the Viki-only branch: Grace is
// present, while starting-kit and equipment-role receipts arrive with Rune's
// union. It captures every cell even when assertions fail so the red is visible.

import { spawn } from 'node:child_process';
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
const SURFACES = ['grace', 'creation', 'armoury'];
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
  const profile = mkdtempSync(join(tmpdir(), 'presentation-matrix-'));
  const child = spawn(exe, ['--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--allow-file-access-from-files', '--no-first-run', 'about:blank'],
  { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  const wsUrl = await new Promise((ok, no) => {
    const read = (chunk) => {
      log += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(log);
      if (match) ok(match[1]);
    };
    child.stdout.on('data', read);
    child.stderr.on('data', read);
    child.on('error', no);
    setTimeout(() => no(new Error(`Chrome did not expose CDP: ${log.slice(-300)}`)), 15000);
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
    close() {
      cdp.close();
      child.kill();
      try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
    },
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
    need(JSON.stringify(reading.allocations) === JSON.stringify(['0/3', '1/2', '2/1', '3/0']),
      'grace: every fixed-capacity allocation is visible in order');
    need(reading.fullMana === true, 'grace: baseline Mana is visibly full at 2/2');
  } else if (surface === 'creation') {
    need(reading.kitCount >= 2, 'creation: baseline and discovered alternate are visible');
    need(reading.chosenKit === 1, 'creation: exactly one kit is selected');
    need(reading.alternateSelected === true, 'creation: the discovered alternate can be selected');
    need(reading.derived.join('|') === 'HP|Mana|Stamina|Energy / turn|Draw / turn and opening hand',
      'creation: canonical five derived receipts render in order');
    need(reading.roleRows === 4, 'creation: 4/4/1/1 kit receipt exposes three equipment roles plus signature');
    need(reading.hasReceiptMath === true, 'creation: kit rows show computed receipt math');
  } else if (surface === 'armoury') {
    need(reading.view === 'hybrid', 'armoury: Hybrid view is selected');
    need(reading.derived.join('|') === 'HP|Mana|Stamina|Energy / turn|Draw / turn and opening hand',
      'armoury: canonical five derived receipts render in order');
    need(reading.roles.join('|') === 'attack|guard|technique',
      'armoury: Attack, Guard and Technique share one equipment receipt panel');
    need(reading.hasReceiptMath === true, 'armoury: role receipts show base, tier, rarity and total');
  }
  return failures;
}

function proveMutants() {
  const grace = { mounted: true, horizontalOverflow: 0, minControl: 44, controlsOutside: 0,
    title: 'Reallocate Flask Charges', capacity: 3, allocations: ['0/3', '1/2', '2/1', '3/0'], fullMana: true };
  const creation = { mounted: true, horizontalOverflow: 0, minControl: 44, controlsOutside: 0,
    kitCount: 2, chosenKit: 1, alternateSelected: true,
    derived: ['HP', 'Mana', 'Stamina', 'Energy / turn', 'Draw / turn and opening hand'], roleRows: 4, hasReceiptMath: true };
  const armoury = { mounted: true, horizontalOverflow: 0, minControl: 44, controlsOutside: 0,
    view: 'hybrid', derived: [...creation.derived], roles: ['attack', 'guard', 'technique'], hasReceiptMath: true };
  const plants = [
    ['missing landmark', 'grace', grace, (x) => { x.mounted = false; }],
    ['allocation drift', 'grace', grace, (x) => { x.allocations[2] = '2/2'; }],
    ['Mana baseline drift', 'grace', grace, (x) => { x.fullMana = false; }],
    ['missing alternate', 'creation', creation, (x) => { x.kitCount = 1; }],
    ['missing role receipt', 'creation', creation, (x) => { x.roleRows = 3; }],
    ['duplicate derived math', 'armoury', armoury, (x) => { x.derived[3] = 'Energy'; }],
    ['missing equipment role', 'armoury', armoury, (x) => { x.roles.pop(); }],
    ['undersized control', 'grace', grace, (x) => { x.minControl = 43; }],
    ['horizontal bleed', 'armoury', armoury, (x) => { x.horizontalOverflow = 2; }],
  ];
  for (const [name, surface, seed, mutate] of plants) {
    const copy = structuredClone(seed);
    mutate(copy);
    if (!contract(surface, copy).length) throw new Error(`dead contract mutant: ${name}`);
  }
  const a = JSON.stringify({ surface: 'grace', title: grace.title, capacity: grace.capacity, allocations: grace.allocations });
  const b = JSON.stringify({ surface: 'grace', title: grace.title, capacity: 4, allocations: grace.allocations });
  if (a === b) throw new Error('dead source/dist parity mutant');
  console.log(`contract mutants: ${plants.length + 1}/10 caught`);
}

const READERS = {
  grace: `(() => {
    const n=(value)=>Math.round(value*100)/100;
    const root = document.querySelector('#flask-reallocate');
    const buttons = [...document.querySelectorAll('#flask-reallocate [data-hp]')];
    const boxes = buttons.map((x) => x.getBoundingClientRect());
    const text = document.querySelector('#rest-opt p')?.textContent || '';
    return { mounted: !!root, horizontalOverflow: Math.max(0, document.documentElement.scrollWidth-innerWidth),
      minControl: boxes.length ? n(Math.min(...boxes.map((x) => Math.min(x.width,x.height)))) : 0,
      controlsOutside: boxes.filter((x) => x.left < 0 || x.right > innerWidth || x.top < 0 || x.bottom > innerHeight).length,
      title: root?.querySelector('h3')?.textContent.trim() || '', capacity: Number(/capacity\\D*(\\d+)/i.exec(root?.querySelector('p')?.textContent||'')?.[1]),
      allocations: buttons.map((x) => x.textContent.trim()), fullMana: /Mana\\D*2\\D+2/.test(text) };
  })()`,
  creation: `(() => {
    const n=(value)=>Math.round(value*100)/100;
    const kitButtons=[...document.querySelectorAll('#cz-kits button')];
    const relevant=[...kitButtons, document.querySelector('.cz-stats summary')].filter(Boolean);
    const boxes=relevant.map((x)=>x.getBoundingClientRect());
    const derived=[...document.querySelectorAll('#cz-stat-projection > div > b')].map((x)=>x.textContent.trim());
    const roleRows=[...document.querySelectorAll('.cz-kit li')];
    return { mounted: !!document.querySelector('#cz-stat-projection'), horizontalOverflow: Math.max(0,document.documentElement.scrollWidth-innerWidth),
      minControl: boxes.length?n(Math.min(...boxes.map((x)=>Math.min(x.width,x.height)))):0,
      controlsOutside: boxes.filter((x)=>x.left<0||x.right>innerWidth||x.top<0||x.bottom>innerHeight).length,
      kitCount: kitButtons.length, chosenKit: kitButtons.filter((x)=>x.classList.contains('chosen')).length,
      alternateSelected: kitButtons.length>1 && kitButtons[1].classList.contains('chosen'), derived, roleRows: roleRows.length,
      hasReceiptMath: roleRows.length>0 && roleRows.every((x)=>/=/.test(x.textContent)) };
  })()`,
  armoury: `(() => {
    const n=(value)=>Math.round(value*100)/100;
    const viewButtons=[...document.querySelectorAll('[data-surface="armouryView"] [data-member]')];
    const boxes=viewButtons.map((x)=>x.getBoundingClientRect());
    const derived=[...document.querySelectorAll('.armoury-derived [data-stat] > b')].map((x)=>x.textContent.trim());
    const roles=[...document.querySelectorAll('.equip-role-receipts [data-role]')].map((x)=>x.dataset.role);
    const receiptText=[...document.querySelectorAll('.equip-role-receipts [data-role]')].map((x)=>x.textContent);
    return { mounted: !!document.querySelector('.armoury-stats'), horizontalOverflow: Math.max(0,document.documentElement.scrollWidth-innerWidth),
      minControl: boxes.length?n(Math.min(...boxes.map((x)=>Math.min(x.width,x.height)))):0,
      controlsOutside: boxes.filter((x)=>x.left<0||x.right>innerWidth||x.top<0||x.bottom>innerHeight).length,
      view: document.querySelector('.armoury')?.dataset.view || '', derived, roles,
      hasReceiptMath: receiptText.length===3 && receiptText.every((x)=>/base/i.test(x)&&/tier/i.test(x)&&/rarity/i.test(x)&&/=/.test(x)) };
  })()`,
};

async function seedProfile(b, base) {
  await b.cdp.send('Page.navigate', { url: base }, b.sessionId);
  await b.until('document.readyState === "complete"', 'base origin');
  await b.evaluate(`localStorage.clear(); localStorage.setItem(${JSON.stringify(META_KEY)}, ${JSON.stringify(PROFILE)}); true`);
}

async function pose(b, base, surface) {
  const query = surface === 'grace' ? '?shot=rest' : surface === 'creation' ? '?shot=customize' : '?shot=combat';
  await seedProfile(b, base);
  await b.cdp.send('Page.navigate', { url: base + query }, b.sessionId);
  if (surface === 'grace') {
    await b.until('!!document.querySelector("#flask-reallocate")', 'Grace reallocation');
    await b.evaluate('document.querySelector("#flask-reallocate").scrollIntoView({block:"center"}); true');
  } else if (surface === 'creation') {
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
      const button=document.querySelector('[data-surface="armouryView"] [data-member="hybrid"]'); if(button) button.click();
      const stats=document.querySelector('.armoury-stats'); if(stats) stats.scrollIntoView({block:'center'});
      return true;
    })()`);
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
          const shot = resolve(OUT, `${tree}-${surface}-${shape.tag}.png`);
          const image = await b.cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true }, b.sessionId);
          writeFileSync(shot, Buffer.from(image.data, 'base64'));
          const failures = [...(error ? [`drive: ${error}`] : []), ...contract(surface, reading)];
          rows.push({ tree, surface, shape: shape.tag, reading, failures, shot });
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
  console.log(`\npresentation-matrix: ${rows.length - red.length}/12 green, ${red.length}/12 red; 12/12 screenshots written`);
  console.log('BOUNDARY: headless Chrome stills at two phone shapes. This checks DOM truth, geometry, and source/dist parity; it does not certify touch feel, animation, or desktop.');
  process.exit(red.length ? 1 : 0);
}

main().catch((error) => { console.error(`presentation-matrix: ${error.message}`); process.exit(2); });
