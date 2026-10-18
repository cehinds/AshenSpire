#!/usr/bin/env node
// Real keyboard regression checks for shared modal tabs and nested focus.

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] || join(process.env.TEMP || '/tmp', 'ashenspire-modal-keyboard'));
const browserCandidates = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const browserPath = browserCandidates.find(existsSync);
if (!browserPath) {
  console.error('modal-keyboard-check: no Chrome/Edge found; set CHROME');
  process.exit(2);
}

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const handlers = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const pair = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) pair.reject(new Error(message.error.message)); else pair.resolve(message.result);
    } else if (message.method && handlers.has(message.method)) handlers.get(message.method)(message.params, message.sessionId);
  });
  return {
    ready: new Promise((resolveReady, rejectReady) => {
      ws.addEventListener('open', resolveReady);
      ws.addEventListener('error', rejectReady);
    }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((resolveSend, rejectSend) => {
        pending.set(id, { resolve: resolveSend, reject: rejectSend });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    on(method, handler) { handlers.set(method, handler); },
    close() { ws.close(); },
  };
}

const server = await serve({ root: ROOT, port: 8402, open: false });
const browser = await launchBrowser({ prefix: 'modal-keyboard-', browser: browserPath, timeoutMs: 45000 });
const cdp = connectCdp(browser.wsUrl);
await cdp.ready;
mkdirSync(OUT, { recursive: true });


try {
 const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
 const send=(method,params={})=>cdp.send(method,params,sessionId);
 await send('Page.enable');await send('Runtime.enable');
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await send('Page.navigate',{url:'http://localhost:8402/index.html?shot=combat'});for(let i=0;i<150;i++){if(await ev('!!document.querySelector("#combat-menu")'))break;await wait(100);}
 await ev('(async()=>{const {openModal}=await import("/src/ui/components/modalShell.js");window.baseDialog=openModal({tabs:[{id:"settings",label:"Settings",selected:true},{id:"controls",label:"Controls"}],showMenuButton:false,onTab:id=>window.chosenTab=id,body:el=>el.textContent="Modal keyboard regression"});})()');await wait(300);
 const key=async(key,code,modifiers=0)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers});};
 const results=[];
 await ev('document.querySelector(".modal-tab").focus()');
 await key('ArrowRight','ArrowRight');
 results.push({name:'arrow activates next tab',pass:await ev('document.activeElement?.textContent.trim()==="Controls" && document.activeElement.getAttribute("aria-selected")==="true"')});
 await ev('(async()=>{const {openModal}=await import("/src/ui/components/modalShell.js");window.polishDialog=openModal({title:"Keyboard check",body:el=>{el.innerHTML="<button id=first>First</button><button disabled>Disabled</button><button hidden>Hidden</button><button id=last>Last</button>"}});})()');
 await ev('document.querySelector("#last").focus()');await key('Tab','Tab');
 results.push({name:'Tab wraps to close',pass:await ev('document.activeElement===window.polishDialog.panel.querySelector(".modal-close")')});
 await key('Tab','Tab',8);results.push({name:'Shift Tab wraps to last visible control',pass:await ev('document.activeElement.id==="last"')});
 await key('Escape','Escape');results.push({name:'Escape closes only top dialog and restores opener',pass:await ev('!window.polishDialog.panel.isConnected && !!document.querySelector(".modal") && document.activeElement.textContent.trim()==="Controls"')});
 console.log(JSON.stringify(results));writeFileSync(join(OUT,'keyboard.json'),JSON.stringify(results,null,2));
 if(results.some(r=>!r.pass))process.exitCode=1;
 await send('Target.closeTarget',{targetId});
}finally{cdp.close();await browser.close();await new Promise(r=>server.server.close(r));}
