#!/usr/bin/env node
// Arcane Exposure visual truth: source/dist x solo/co-op x 320/390.
// The browser only asks the product for authored host-snapshot poses. It does
// not fabricate client DOM or mutate state after mount.

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const OUT = resolve(ROOT, arg('--out', 'audit-evidence/arcane-exposure-visual'));
const CHROME = process.env.CHROME;
const SHAPES = [{ tag: '320x640', width: 320, height: 640 }, { tag: '390x844', width: 390, height: 844 }];
const TREES = ['source', 'dist'];
const SURFACES = ['solo', 'coop'];
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
  const exe = [CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome']
    .filter(Boolean).find(existsSync);
  if (!exe) throw new Error('Chrome/Chromium absent; set CHROME to its exact path');
  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'arcane-exposure-visual-', browser: exe, headless: '--headless=new',
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
  return { cdp, sessionId, evaluate, until, close() { cdp.close(); return dropBrowser(); } };
}

const READER = `(() => {
  const enemies=[...document.querySelectorAll('.combatant.enemy')];
  const rows=enemies.map((enemy)=>{
    const meter=enemy.querySelector('.arcane-exposure-meter');
    const immune=enemy.querySelector('.arcane-exposure-immune');
    const host=meter||immune;
    const text=host?.textContent.replace(/\\s+/g,' ').trim()||'';
    const value=meter ? Number(/(\\d+)\\s*\\/\\s*(\\d+)/.exec(text)?.[1]) : null;
    const threshold=meter ? Number(/(\\d+)\\s*\\/\\s*(\\d+)/.exec(text)?.[2]) : null;
    const box=host?.getBoundingClientRect();
    const card=enemy.getBoundingClientRect();
    const zoom=Number.parseFloat(getComputedStyle(document.body).zoom)||1;
    return { id:enemy.dataset.eid||'', present:!!host, immune:!!immune, locked:!!meter?.classList.contains('locked'),
      value, threshold, text, aria:host?.getAttribute('aria-label')||'',
      localWidth:box?Math.round(box.width/zoom*100)/100:0,
      inside:!box||(box.left>=card.left-0.5&&box.right<=card.right+0.5&&box.left>=-0.5&&box.right<=innerWidth+0.5&&box.top>=-0.5&&box.bottom<=innerHeight+0.5) };
  });
  return { mounted:!!document.querySelector('.combat'), enemyCount:enemies.length,
    horizontalOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth), rows,
    configuredZero:rows.filter((x)=>x.present&&!x.immune&&!x.locked&&x.value===0).length,
    configuredNonzero:rows.filter((x)=>x.present&&!x.immune&&!x.locked&&x.value>0).length,
    absent:rows.filter((x)=>!x.present).length, immune:rows.filter((x)=>x.immune).length,
    lockedTruth:rows.filter((x)=>x.locked&&/25%/.test(x.text)&&/2 turns/.test(x.text)).length,
    refusal:rows.filter((x)=>/Refused/.test(x.text)&&/immune/.test(x.text)&&/magic 1/.test(x.text)).length,
    breaking:rows.filter((x)=>/Break/.test(x.text)&&/25%/.test(x.text)&&/2 turns/.test(x.text)).length,
    geometryOk:rows.filter((x)=>x.present).every((x)=>x.inside&&x.localWidth>=71.99),
    ariaOk:rows.filter((x)=>x.present).every((x)=>/Arcane Exposure/.test(x.aria)) };
})()`;

function contract(surface, reading) {
  const failures = [];
  const need = (condition, label) => { if (!condition) failures.push(`${surface}: ${label}`); };
  need(reading.mounted, 'combat surface mounted');
  need(reading.horizontalOverflow <= 1, 'no horizontal overflow');
  need(reading.geometryOk, 'each conditional meter stays in its enemy card and has a readable 72px local width');
  need(reading.ariaOk, 'every conditional meter carries Arcane Exposure semantics');
  if (surface === 'solo') {
    need(reading.configuredZero >= 1, 'configured 0 / threshold is visible');
    need(reading.configuredNonzero >= 1, 'configured nonzero buildup is visible');
    need(reading.absent >= 1, 'an absent config reserves no meter');
  } else {
    need(reading.lockedTruth >= 1, 'locked meter names Magic Vulnerable 25% for 2 turns');
    need(reading.immune >= 1, 'immune enemy uses a badge, not a fake meter');
    need(reading.absent >= 1, 'an absent config reserves no meter');
    need(reading.refusal >= 1, 'immune refusal receipt shows attempted magic buildup');
    need(reading.breaking >= 1, 'break receipt shows 25% and 2-turn duration');
  }
  return failures;
}

function proveMutants() {
  const solo = { mounted:true, horizontalOverflow:0, geometryOk:true, ariaOk:true, configuredZero:1, configuredNonzero:1, absent:1 };
  const coop = { mounted:true, horizontalOverflow:0, geometryOk:true, ariaOk:true, lockedTruth:1, immune:1, absent:1, refusal:1, breaking:1 };
  const plants = [
    ['zero hidden','solo',solo,(x)=>{x.configuredZero=0;}], ['nonzero hidden','solo',solo,(x)=>{x.configuredNonzero=0;}],
    ['absence gap','solo',solo,(x)=>{x.absent=0;}], ['locked truth conflates value and duration','coop',coop,(x)=>{x.lockedTruth=0;}],
    ['immunity faked as zero','coop',coop,(x)=>{x.immune=0;}], ['attempted missing','coop',coop,(x)=>{x.refusal=0;}],
    ['break receipt missing','coop',coop,(x)=>{x.breaking=0;}], ['geometry overlap','coop',coop,(x)=>{x.geometryOk=false;}],
    ['color only','coop',coop,(x)=>{x.ariaOk=false;}],
  ];
  for (const [name,surface,seed,mutate] of plants) {
    const copy=structuredClone(seed); mutate(copy);
    if (!contract(surface,copy).length) throw new Error(`dead contract mutant: ${name}`);
  }
  console.log(`arcane visual mutants: ${plants.length}/${plants.length} caught`);
}

async function main() {
  proveMutants();
  if (!existsSync(resolve(ROOT, 'dist/AshenSpire.html'))) throw new Error('dist/AshenSpire.html absent');
  mkdirSync(OUT, { recursive: true });
  const source = await serve({ root: ROOT, port: 8357, open: false });
  const bases = { source: source.url.replace(/\/$/, ''), dist: pathToFileURL(resolve(ROOT, 'dist/AshenSpire.html')).href };
  const b = await browser();
  const rows=[];
  try {
    for (const shape of SHAPES) {
      await b.cdp.send('Emulation.setDeviceMetricsOverride', { width:shape.width, height:shape.height, deviceScaleFactor:1, mobile:true }, b.sessionId);
      for (const tree of TREES) for (const surface of SURFACES) {
        const url = `${bases[tree]}?shot=${surface==='solo'?'combat':'coop'}&shotArcane=matrix`;
        await b.cdp.send('Page.navigate', { url }, b.sessionId);
        await b.until('document.querySelectorAll(".combatant.enemy").length>=1', `${surface} enemies`);
        await wait(180);
        const reading=await b.evaluate(READER);
        const failures=contract(surface,reading);
        const shot=resolve(OUT,`${tree}-${surface}-${shape.tag}.png`);
        const image=await b.cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true},b.sessionId);
        writeFileSync(shot,Buffer.from(image.data,'base64'));
        rows.push({tree,surface,shape:shape.tag,reading,failures,shot});
        console.log(`${failures.length?'RED ':'PASS'} ${tree.padEnd(6)} ${surface.padEnd(4)} ${shape.tag} -> ${shot}`);
        for(const failure of failures) console.log(`     ${failure}`);
      }
    }
  } finally { b.close(); source.server.close(); }
  for (const shape of SHAPES) for (const surface of SURFACES) {
    const a=rows.find((x)=>x.tree==='source'&&x.shape===shape.tag&&x.surface===surface);
    const d=rows.find((x)=>x.tree==='dist'&&x.shape===shape.tag&&x.surface===surface);
    if(JSON.stringify(a.reading)!==JSON.stringify(d.reading)) { a.failures.push(`${surface}: source/dist semantic drift`); d.failures.push(`${surface}: source/dist semantic drift`); }
  }
  writeFileSync(resolve(OUT,'arcane-exposure-visual.json'),JSON.stringify(rows,null,2));
  const red=rows.filter((x)=>x.failures.length);
  console.log(`\narcane-exposure-visual: ${rows.length-red.length}/8 green, ${red.length}/8 red; 8/8 screenshots written`);
  console.log('BOUNDARY: posed host snapshots and rendered read-only UI at two phone shapes; no capture-time client mutation.');
  process.exit(red.length?1:0);
}

main().catch((error)=>{console.error(`arcane-exposure-visual: ${error.message}`);process.exit(2);});
