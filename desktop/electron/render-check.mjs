// Does the PACKAGED app actually render? Bjorn showed the package exposes CDP;
// this re-establishes the runtime half at the rebased SHA and distinguishes
// "hung with no window" from "running fine", which an exit code cannot.
// Launched with NO spike env and NO --disable-gpu: the plain player launch.
import { spawn } from 'node:child_process';
const BIN = process.argv[2];
const PORT = Number(process.env.PKG_PORT || 9741);
const proc = spawn('xvfb-run', ['-a', BIN, '--no-sandbox', `--remote-debugging-port=${PORT}`], { stdio: 'ignore', env: { ...process.env, SPIKE_T0: '', SPIKE_MODE: '', SPIKE_USERDATA: '' } });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let targets = null;
const t0 = Date.now();
for (let i = 0; i < 60; i++) {
  await sleep(1000);
  try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (j.length) { targets = j; break; } } catch {}
}
if (!targets) { console.log('NO TARGET — the packaged app never exposed a page (this is the hang)'); proc.kill('SIGKILL'); process.exit(1); }
// GUARD: a stray HeadlessChrome answered this port once and my "PASS" was a
// measurement of somebody else's browser — the exact failure this round is
// about, in my own hands. Assert we are attached to THE PACKAGED APP: its page
// must be the file:// URL inside the package, and the browser must be Electron.
const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
const page = targets.find(t => t.type === 'page');
const isOurs = /Electron/i.test(ver['User-Agent'] || '') && /^file:\/\//.test(page.url) && /AshenSpire/.test(page.url);
if (!isOurs) {
  console.log(`WRONG TARGET — refusing to measure. browser=${(ver['User-Agent']||'').slice(0,60)} url=${page.url.slice(0,70)}`);
  proc.kill('SIGKILL'); process.exit(2);
}
console.log(`target confirmed: Electron, ${page.url.slice(-38)}`);
console.log(`attached in ${((Date.now()-t0)/1000).toFixed(1)}s · ${targets.length} target(s) · url=${targets[0].url.slice(0,60)}`);
const ws = new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
let id=0; const w=new Map();
ws.onmessage=(m)=>{const g=JSON.parse(m.data); if(g.id!=null&&w.has(g.id)){const{ok}=w.get(g.id);w.delete(g.id);ok(g.result);}};
const send=(m2,p2={})=>{const n=++id;ws.send(JSON.stringify({id:n,method:m2,params:p2}));return new Promise(ok=>w.set(n,{ok}));};
await send('Runtime.enable');
const ev = async (e) => (await send('Runtime.evaluate',{expression:e,returnByValue:true})).result.value;
await sleep(2500);
const seen = await ev(`({ title: document.title, buttons: [...document.querySelectorAll('button')].map(b=>b.textContent.trim()).slice(0,3), textLen: document.body.innerText.length })`);
console.log('RENDERED:', JSON.stringify(seen));
const ok = seen && seen.textLen > 0 && seen.buttons.some(b => /climb|continue|new/i.test(b));
console.log(ok ? 'PASS — the packaged app boots and paints its title screen on a PLAIN launch' : 'FAIL — attached but nothing playable painted');
proc.kill('SIGKILL');
process.exit(ok ? 0 : 1);
