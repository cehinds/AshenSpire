// tools/restore-settings-drive.mjs — Rune, 2026-08-07 (#68 D22).
//
// After a restore, does the SCREEN match the profile that was restored? Sunna's
// scenario, on BOTH doors: a live profile with high contrast OFF / reduced
// motion ON / text L, an archived profile with high contrast ON / reduced
// motion OFF / text S — restore it and read the body classes and root
// font-size, not the stored values.
//
// Run:  node tools/restore-settings-drive.mjs     (from the repo root)
// Exit 0 = both doors dress the screen in the restored profile.
//
// BOUNDARY: headless Chromium at 390x844. It proves the settings are APPLIED,
// not that the result is legible — that is Sunna's gate and no driver replaces it.

// D22: after a restore, does the SCREEN match the restored profile's settings?
// Both doors. Sunna's scenario: stored highContrast true / screen off, stored
// reducedMotion false / screen on, root font-size unchanged.
// DOOR, and why --selftest exists (Rune, 2026-08-15). The real input is the
// SCREEN after a restore: this drive reads body classes and the root font-size,
// deliberately not the stored values — the whole point is that "it was saved"
// and "it is on the screen" are two claims. Right door; no re-runnable
// known-bad, which is what Vira's audit (2026-08-14) rated NO-KNOWN-BAD.
// `--selftest` plants the exact defect this tool was built after — a restore
// that writes the settings and never dresses the screen in them — into a copy
// of the real main.js, and re-runs this whole drive against it.
if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'restore-settings-drive.mjs',
    timeoutMs: 900000,
    plants: [
      {
        name: 'a restore stores the settings but never applies them to the screen',
        file: 'src/main.js',
        find: "  document.body.classList.toggle('hi-contrast', settingOn(settings, 'highContrast'));",
        replace: '  /* planted: the restored profile is stored and the screen keeps the old dress */',
        expectRed: /FAIL\s+DOOR \d.*high contrast is ON SCREEN after restore/,
      },
    ],
  }));
}

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
const { port } = await serve({ root: fileURLToPath(new URL('..', import.meta.url)), port: 8201, open: false });
// ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
// Chrome's own TMPDIR inside it, and removes it whatever happens. This driver
// passed no `--user-data-dir` and never killed the browser at all, so every run
// stranded both. `awaitEndpoint` is off: it polls /json/list on a fixed port.
const browser = resolveBrowser(['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe']);
if (!browser) throw new Error('restore-settings-drive: no Chromium-family browser found');
await launchBrowser({
  prefix: 'restore-settings-', browser, headless: '--headless=new',
  awaitEndpoint: false, args: ['--remote-debugging-port=9401'], stdio: 'ignore',
});
async function cdp(p){let l;for(let i=0;i<100;i++){try{l=await(await fetch(`http://127.0.0.1:${p}/json/list`)).json();if(l.length)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const ws=new WebSocket(l.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
 let id=0;const w=new Map();ws.onmessage=(m)=>{const g=JSON.parse(m.data);if(g.id!=null&&w.has(g.id)){const{ok,no}=w.get(g.id);w.delete(g.id);g.error?no(new Error(g.error.message)):ok(g.result);}};
 return {send:(m2,p2={})=>{const n=++id;ws.send(JSON.stringify({id:n,method:m2,params:p2}));return new Promise((ok,no)=>w.set(n,{ok,no}));}};}
const c = await cdp(9401);
await c.send('Page.enable'); await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
const ev=async(e,aw=false)=>{const r=await c.send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:aw});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||'eval');return r.result.value;};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let fails=0; const check=(n,ok,d='')=>{console.log(`${ok?'PASS':'FAIL'}  ${n}${!ok&&d?' — '+d:''}`);if(!ok)fails++;};

// LIVE profile: high contrast OFF, reduced motion ON, text L.
// ARCHIVED profile (the one we restore): high contrast ON, reduced motion OFF, text S.
const seed = `
  localStorage.clear();
  const archived = JSON.stringify({schemaVersion:1,results:[],progress:{runs:2000},
    settings:{highContrast:true, reducedMotion:false, textSize:'S', musicEnabled:false, musicVolume:35}});
  localStorage.setItem('sote_meta_v1', JSON.stringify({schemaVersion:1,results:[],progress:{runs:5},
    settings:{highContrast:false, reducedMotion:true, textSize:'L', musicEnabled:true, musicVolume:35}}));
  localStorage.setItem('sote_run_archived', JSON.stringify({v:1,entries:[
    {id:'meta-good',kind:'meta',slot:null,reason:'set aside by hand',at:new Date().toISOString(),count:1,save:archived}]}));
`;
const readScreen = `(()=>({
  hiContrastClass: document.body.classList.contains('hi-contrast'),
  reducedMotionClass: document.body.classList.contains('reduced-motion'),
  rootFont: getComputedStyle(document.documentElement).fontSize,
  storedHi: JSON.parse(localStorage.getItem('sote_meta_v1')).settings.highContrast,
  storedRM: JSON.parse(localStorage.getItem('sote_meta_v1')).settings.reducedMotion,
  storedText: JSON.parse(localStorage.getItem('sote_meta_v1')).settings.textSize,
  storedMusic: JSON.parse(localStorage.getItem('sote_meta_v1')).settings.musicEnabled,
}))()`;

async function door(name, openSettings) {
  await c.send('Page.navigate',{url:`http://localhost:${port}/`}); await sleep(600);
  await ev(seed + '1');
  await c.send('Page.navigate',{url:`http://localhost:${port}/`}); await sleep(1700);
  const before = await ev(readScreen);
  await openSettings();
  await sleep(600);
  // #90: the categories are tabs, so Profile is one click in. Click the tab if
  // it is there; the restore button is unreachable without it.
  await ev(`(()=>{const t=[...document.querySelectorAll('.set-tab')].find(e=>e.dataset.member==='Profile'); if(t){t.click(); return true;} return false;})()`);
  await sleep(300);
  const found = await ev(`(()=>{const b=document.querySelector('.prof-restore'); if(b){b.click(); return true;} return false;})()`);
  if (!found) {
    check(`${name}: restore button reached`, false, 'Profile restore control was absent');
    return;
  }
  await sleep(250);
  await ev(`document.querySelector('.prof-go').click()`); await sleep(700);
  const after = await ev(readScreen);
  check(`${name}: restored profile's settings are STORED`,
    after.storedHi === true && after.storedRM === false && after.storedText === 'S', JSON.stringify(after));
  check(`${name}: high contrast is ON SCREEN after restore`, after.hiContrastClass === true,
    `stored=${after.storedHi} screen=${after.hiContrastClass} (was ${before.hiContrastClass})`);
  check(`${name}: reduced motion is OFF SCREEN after restore`, after.reducedMotionClass === false,
    `stored=${after.storedRM} screen=${after.reducedMotionClass} (was ${before.reducedMotionClass})`);
  check(`${name}: root font-size followed the restored text size`, after.rootFont !== before.rootFont,
    `unchanged at ${after.rootFont}`);
  const audioTab = await ev(`(()=>{const t=[...document.querySelectorAll('.set-tab')].find(e=>e.dataset.member==='Audio'); if(t)t.click(); return !!t;})()`);
  await sleep(150);
  const musicChecked = audioTab && await ev(`document.querySelector('.toggle[data-key="musicEnabled"]')?.getAttribute('aria-checked')`);
  check(`${name}: restored Music preference is stored and reflected by Settings`,
    after.storedMusic === false && musicChecked === 'false', `stored=${after.storedMusic} aria=${musicChecked}`);
}

await door('DOOR 1 (title Settings)', async () => {
  await ev(`[...document.querySelectorAll('button')].find(b=>/settings/i.test(b.textContent)).click()`);
});
await door('DOOR 2 (in-run overlay Settings)', async () => {
  await ev(`[...document.querySelectorAll('button')].find(b=>/begin a climb/i.test(b.textContent)).click()`); await sleep(800);
  const started = await ev(`(()=>{const b=document.querySelector('#cz-start'); if(!b || b.disabled)return false; b.click(); return true;})()`);
  check('DOOR 2 (in-run overlay Settings): character start control reached', started);
  await sleep(1400);
  const menuOpened = await ev(`(()=>{const m=document.querySelector('#open-menu, #combat-menu'); if(!m)return false; m.click(); return true;})()`);
  check('DOOR 2 (in-run overlay Settings): in-run menu control reached', menuOpened);
  await sleep(600);
  const settingsOpened = await ev(`(()=>{const t=document.querySelector('.qn-row[data-tab="settings"]') || [...document.querySelectorAll('button')].find(b=>/^settings$/i.test(b.textContent.trim())); if(!t)return false; t.click(); return true;})()`);
  check('DOOR 2 (in-run overlay Settings): Settings destination reached', settingsOpened);
});
console.log(`\n${fails} failing check(s).`);
process.exit(fails?1:0);
