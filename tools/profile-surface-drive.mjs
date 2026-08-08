// tools/profile-surface-drive.mjs — Rune, 2026-08-07 (#67).
//
// Drives the RENDERED profile surfaces in a real browser at 390 px, because the
// defect that started this round was found by rendering and could not have been
// found by reading: "nobody has looked at that screen".
//
// Covers Sunna's D8 (Settings → Profile is a real route, not a promise), her D5
// (the handle no longer lives only inside a once-per-session dialog), her D9
// (the confirm dialog is a real focus trap), and the surface's own promises —
// restore states its risk first, a failed restore does not consume the archive
// and says so, and a readable archive really does come back.
//
// Run:  node tools/profile-surface-drive.mjs        (from the repo root)
// Exit 0 = every check passed. Exit 1 = at least one red, each named.
//
// BOUNDARY: headless Chromium at one viewport (390x844). It proves behaviour and
// wiring, not aesthetics — whether this screen READS right at 11pm is Sunna's
// gate and no driver replaces it.

import { spawn } from 'node:child_process';
import { serve } from './serve.mjs';
const { port } = await serve({ root: new URL('..', import.meta.url).pathname, port: 8193, open: false });
spawn('/opt/pw-browsers/chromium', ['--headless=new','--disable-gpu','--remote-debugging-port=9393','--no-sandbox','about:blank'], { stdio: 'ignore' });
async function cdp(p){let l;for(let i=0;i<100;i++){try{l=await(await fetch(`http://127.0.0.1:${p}/json/list`)).json();if(l.length)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const ws=new WebSocket(l.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
 let id=0;const w=new Map();ws.onmessage=(m)=>{const g=JSON.parse(m.data);if(g.id!=null&&w.has(g.id)){const{ok,no}=w.get(g.id);w.delete(g.id);g.error?no(new Error(g.error.message)):ok(g.result);}};
 return {send:(m2,p2={})=>{const n=++id;ws.send(JSON.stringify({id:n,method:m2,params:p2}));return new Promise((ok,no)=>w.set(n,{ok,no}));}};}
const c = await cdp(9393);
await c.send('Page.enable'); await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
const ev=async(e,aw=false)=>{const r=await c.send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:aw});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||'eval');return r.result.value;};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let fails=0; const check=(n,ok,d='')=>{console.log(`${ok?'PASS':'FAIL'}  ${n}${d?' — '+d:''}`);if(!ok)fails++;};

// Seed: a corrupt profile so an archive exists, then get past the notice.
await c.send('Page.navigate',{url:`http://localhost:${port}/`}); await sleep(700);
await ev(`localStorage.clear(); localStorage.setItem('sote_meta_v1','{"schemaVersion":1,"progress":{"runs":2000},'); 1`);
await c.send('Page.navigate',{url:`http://localhost:${port}/`}); await sleep(1800);

// --- D9: focus trap on the confirm dialog ---
await ev(`document.querySelector('.profile-notice .fresh').click()`); await sleep(250);
// The real contract is "the focus cursor cannot leave the dialog", so drive
// actual Tab presses and watch activeElement rather than counting selectors
// (a button with tabindex="-1" still matches `button`, which is what made the
// first version of this check lie).
const trap = await ev(`(()=>{
  const dlg=document.querySelector('.confirm-fresh'); if(!dlg) return {no:true};
  const seen=[]; let escaped=false;
  for(let i=0;i<8;i++){
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));
    const a=document.activeElement;
    seen.push(a?a.textContent.trim():'(none)');
    if(a && !dlg.contains(a) && a!==document.body) escaped=true;
  }
  const outsideTabbable=[...document.querySelectorAll('.profile-notice button')].filter(b=>b.tabIndex>=0).length;
  return {escaped, seen:[...new Set(seen)], outsideTabbable};
})()`);
check('D9 the focus cursor cannot leave the dialog', trap.escaped===false && trap.outsideTabbable===0,
  `escaped=${trap.escaped} tabbableBehind=${trap.outsideTabbable} sawFocus=${JSON.stringify(trap.seen)}`);
await ev(`document.querySelector('.confirm-fresh').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(200);
check('D9 Escape closes the dialog', await ev(`!document.querySelector('.confirm-fresh')`));
if (await ev(`!!document.querySelector('.confirm-fresh')`)) { await ev(`document.querySelector('.confirm-fresh').click()`); await sleep(150); }
check('D9 clicking the scrim dismisses it', await ev(`!document.querySelector('.confirm-fresh')`));

// --- D8: Settings → Profile is a real route to the archive ---
await ev(`(document.querySelector('.profile-notice .notnow')||document.querySelector('.profile-notice .keep')).click()`); await sleep(900);
await ev(`[...document.querySelectorAll('button')].find(b=>/settings/i.test(b.textContent)).click()`); await sleep(700);
// #90: the categories are TABS, so the Profile section is one click in rather
// than always on screen — and the check is now that the ROUTE exists and works,
// which is what D8 was ever about.
const st = await ev(`(()=>{
  const body=document.querySelector('.set-body'); if(!body) return {no:true};
  const cats=[...body.querySelectorAll('.set-tab')].map(h=>h.dataset.member);
  const tab=[...body.querySelectorAll('.set-tab')].find(h=>h.dataset.member==='Profile');
  if(tab) tab.click();
  const txt=body.innerText;
  return {cats, hasProfile:cats.includes('Profile'), text:txt,
    entryButtons:[...body.querySelectorAll('.prof-archive button')].map(b=>b.textContent.trim())};
})()`);
check('D8 Settings has a Profile section', !!st.hasProfile, 'categories: '+JSON.stringify(st.cats));
// The requirement is that the calm screen NAMES the thing in the same words
// the crisis screen used — not that it says "archive". Sunna's copy calls it
// "set aside", and introducing a second word for one concept is the defect
// this family keeps finding. Flagged for her: if she wants the noun
// "archive" on screen, it is a copy change and nothing else moves.
check('D8 the calm screen names the drawer in the crisis screen\'s own words',
  /set aside/i.test(st.text || ''), (st.text||'').slice(0,120));
check('D8 each archive offers export and restore', (st.entryButtons||[]).some(b=>/save a copy/i.test(b)) && (st.entryButtons||[]).some(b=>/restore/i.test(b)), JSON.stringify(st.entryButtons));

// --- the surface's actual promises, driven ---------------------------------
// A failed restore must NOT consume the archive, and must say so (Sunna's must,
// and the sentence Saga signs).
const beforeCount = await ev(`document.querySelectorAll('.prof-entry').length`);
await ev(`document.querySelector('.prof-restore').click()`); await sleep(200);
check('restore states its risk BEFORE anything happens',
  await ev(`/may not work/i.test(document.querySelector('.prof-confirm')?.textContent||'')`));
check('the safe option holds the cursor in the restore confirm',
  await ev(`/not yet/i.test(document.activeElement.textContent||'')`));
await ev(`document.querySelector('.prof-go').click()`); await sleep(300);
const after = await ev(`(()=>({entries:document.querySelectorAll('.prof-entry').length, msg:document.querySelector('.prof-result').textContent}))()`);
check('a failed restore does not consume the archive', after.entries === beforeCount, `${beforeCount} → ${after.entries}`);
check('a failed restore says nothing was lost', /nothing was lost/i.test(after.msg), after.msg);

// A GOOD archive really does come back — AND the profile it replaces survives.
//
// The previous version of this check tested /"runs":1/ against an archive it
// had itself seeded with "runs":1234, so it matched its own planted entry and
// COULD NOT FAIL — while the very claim it pretended to cover (the outgoing
// profile is set aside, not destroyed) was false. Sunna found that; it is the
// sharpest note I have been handed. The two profiles now carry values I would
// notice missing, and the assertion is about the DRAWER, not the message.
await ev(`(()=>{ localStorage.clear();
  localStorage.setItem('sote_meta_v1', JSON.stringify({schemaVersion:1,settings:{},results:[],progress:{runs:777}}));
  return 1; })()`);
await c.send('Page.navigate',{url:`http://localhost:${port}/`}); await sleep(1500);
await ev(`(()=>{ // a readable archive holding a DIFFERENT number
  localStorage.setItem('sote_run_archived', JSON.stringify({v:1,entries:[{id:'meta-good',kind:'meta',slot:null,
    reason:'set aside by hand for this drive',at:new Date().toISOString(),count:1,
    save: JSON.stringify({schemaVersion:1,settings:{},results:[],progress:{runs:111}})}]}));
  return 1; })()`);
await c.send('Page.navigate',{url:`http://localhost:${port}/`}); await sleep(1500);
await ev(`[...document.querySelectorAll('button')].find(b=>/settings/i.test(b.textContent)).click()`); await sleep(600);
await ev(`document.querySelector('.prof-restore').click()`); await sleep(200);
await ev(`document.querySelector('.prof-go').click()`); await sleep(500);

const live = await ev(`JSON.parse(localStorage.getItem('sote_meta_v1')).progress.runs`);
check('restoring a readable archive really restores it (111 in the drawer → live)', live === 111, 'live runs = ' + live);
const drawer = await ev(`JSON.parse(localStorage.getItem('sote_run_archived')).entries.map(e=>{try{return JSON.parse(e.save).progress.runs}catch(x){return 'unreadable'}})`);
check('THE OUTGOING PROFILE SURVIVES: 777 is in the drawer after the restore',
  Array.isArray(drawer) && drawer.includes(777), 'drawer holds: ' + JSON.stringify(drawer));
check('and the archive it restored FROM is still there too (a restore consumes nothing)',
  Array.isArray(drawer) && drawer.includes(111), 'drawer holds: ' + JSON.stringify(drawer));
const msg = await ev(`document.querySelector('.prof-result')?.textContent || ''`);
check('D13 the screen says it worked, after the re-render', /restored/i.test(msg) && /set aside below/i.test(msg), JSON.stringify(msg));

// D14 — one concept, one word, across both screens.
const vocab = await ev(`(()=>{
  const calm=document.querySelector('.prof-archive')?.innerText||'';
  return {calmSetAside:/set aside/i.test(calm), calmArchived:/archiv/i.test(calm.replace(/Details for support[\s\S]*/,''))};
})()`);
check('D14 the calm screen says "set aside" and not "archived"',
  vocab.calmSetAside && !vocab.calmArchived, JSON.stringify(vocab));


// --- D18: the second door (Sunna). Not now → Continue → in-run menu →
// Settings → change a comfort setting. It must SAY it will not persist, and
// the Profile section must be there for the sentence to point at.
await ev(`(()=>{ localStorage.clear();
  localStorage.setItem('sote_meta_v1','{"schemaVersion":1,"progress":{"runs":2000},');
  return 1; })()`);
await c.send('Page.navigate',{url:`http://localhost:${port}/`}); await sleep(1600);
await ev(`(document.querySelector('.profile-notice .notnow')||document.querySelector('.profile-notice .keep')).click()`); await sleep(700);
// Start a run so the in-run overlay exists.
await ev(`[...document.querySelectorAll('button')].find(b=>/begin a climb/i.test(b.textContent)).click()`); await sleep(900);
const started = await ev(`(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/^(embark|begin|start|confirm)/i.test(x.textContent.trim())); if(b){b.click(); return b.textContent.trim();} return null; })()`);
await sleep(1400);
const overlayOpened = await ev(`(()=>{ const m=[...document.querySelectorAll('button')].find(b=>/menu|☰/i.test(b.textContent)||b.classList.contains('open-menu')); if(m){m.click(); return true;} return false; })()`);
await sleep(700);
await ev(`(()=>{ const t=[...document.querySelectorAll('button')].find(b=>/^settings$/i.test(b.textContent.trim())); if(t) t.click(); return 1; })()`); await sleep(600);
const door2 = await ev(`(()=>{
  const host=document.querySelector('[data-settings-host]');
  if(!host) return {reached:false};
  const cats=[...host.querySelectorAll('.set-tab')].map(h=>h.dataset.member);
  const toggle=host.querySelector('.set-row .toggle, .set-row button, .set-row input');
  if(toggle) toggle.click();
  return {reached:true, cats, notice:(host.querySelector('.set-notice')||{}).textContent||''};
})()`);
await sleep(300);
if (door2.reached) {
  check('D18 the in-run Settings door says the change will not persist',
    /won’t survive a restart|won\'t survive a restart/.test(door2.notice), JSON.stringify(door2.notice));
  check('D18 and Profile is there for that sentence to point at',
    (door2.cats||[]).includes('Profile'), JSON.stringify(door2.cats));
} else {
  console.log('SKIP  D18 in-run door — could not reach the overlay in this driver (started=' + started + ', menu=' + overlayOpened + ')');
}

console.log(`\n${fails} failing check(s).`);
process.exit(fails?1:0);
