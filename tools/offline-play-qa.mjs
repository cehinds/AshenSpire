import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { createRegistries } from '../src/model/registries.js';
import { contentBundle } from '../src/content/index.js';
import { createRunState } from '../src/model/state.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRng } from '../src/engine/rng.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { createSaveTransfer } from '../src/engine/saveTransfer.js';
const out = resolve('artifacts/offline-play'); mkdirSync(out, { recursive: true });
const offlineOnly = process.argv.includes('--offline-only');
const liveReleaseCheck = process.argv.includes('--live-release-check');
const downloadControlsCheck = process.argv.includes('--download-controls-check');
const downloads = resolve(out, `downloads-${Date.now()}`); mkdirSync(downloads);
const html = readFileSync('AshenSpire.html'), build = JSON.parse(readFileSync('buildordinal.json'));
const metadata = { branch: 'main', version: build.release, ordinal: build.ordinal, bytes: html.length };
const storage = createMemoryStorage(), registries = createRegistries(contentBundle), saves = createSaveManager(storage);
const fixtureRun = createRunState({ seed: 54321, classId: contentBundle.classes[0].id, registries });
Object.assign(fixtureRun, { customization: { name: 'Offline test', glyph: '⚔', tint: 'gold' },
  custom: { ascension: 0, mods: {}, deckMode: 'standard' },
  stats: { fightsWon: 0, damageDealt: 0, damageTaken: 0 }, path: [], seenEvents: [], lastEncounters: [] });
const fixtureRng = createRng(fixtureRun.seed);
fixtureRun.mapGraph = buildActMap(registries, fixtureRng, fixtureRun.actNumber, null, { history: fixtureRun.history });
saves.saveRun(fixtureRun, fixtureRng, 2);
const original = createSaveTransfer(storage, registries).createBackup();
const server = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const branch = req.url.split('/')[1];
  if (req.url !== '/AshenSpire.html' && !['main', 'release', 'test', 'dev'].includes(branch)) { res.writeHead(404); res.end(); return; }
  if (req.url.endsWith('build.json')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ...metadata, branch, ...(downloadControlsCheck ? { bytes: 1024 * 1024 } : {}) })); }
  else if (downloadControlsCheck && req.url !== '/AshenSpire.html') {
    res.setHeader('Content-Type', 'text/html'); res.setHeader('Content-Length', 1024 * 1024);
    let count = 0;
    const timer = setInterval(() => { res.write(Buffer.alloc(65536, 65)); if (++count === 16) { clearInterval(timer); res.end(); } }, 100);
    res.on('close', () => clearInterval(timer));
  }
  else { res.setHeader('Content-Type', 'text/html');
    // Only the hosted QA copy points its authored release feed at this fixture.
    // The downloaded numbered build is the unmodified shipping artifact.
    res.end(req.url !== '/AshenSpire.html' || liveReleaseCheck ? html : html.toString().replaceAll('https://cehinds.github.io/AshenSpire/', base + '/')); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await launchBrowser({ prefix: 'offline-qa-', browser: resolveBrowser(['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']) });
const ws = new WebSocket(browser.wsUrl), pending = new Map(), completed = [], downloadNames = new Map(), errors = [];
let serial = 0, checks = 0;
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++serial;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 60000);
  pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
ws.addEventListener('message', event => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Network.loadingFailed') console.log('NETWORK FAILURE', JSON.stringify(msg.params));
  if (msg.method === 'Browser.downloadWillBegin') { downloadNames.set(msg.params.guid, msg.params.suggestedFilename); console.log('DOWNLOAD START', msg.params.suggestedFilename); }
  if (msg.method === 'Browser.downloadProgress' && msg.params.state !== 'inProgress') console.log('DOWNLOAD RESULT', JSON.stringify(msg.params));
  if (msg.method === 'Browser.downloadProgress' && msg.params.state === 'completed') completed.push(downloadNames.get(msg.params.guid));
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  const pair = pending.get(msg.id); if (!pair) return; pending.delete(msg.id); clearTimeout(pair.timer);
  if (msg.error) pair.reject(new Error(msg.error.message)); else pair.resolve(msg.result);
});
await new Promise(done => ws.addEventListener('open', done));
const wait = ms => new Promise(done => setTimeout(done, ms));
const check = (ok, label) => { if (!ok) throw new Error(label); checks++; console.log(`PASS ${label}`); };
try {
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId); await send('Runtime.enable', {}, sessionId); await send('Network.enable', {}, sessionId);
  await send('Page.setInterceptFileChooserDialog', { enabled: true }, sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `if(location.protocol==='http:'){for(const [k,v] of Object.entries(${JSON.stringify(JSON.parse(original).entries)})){if(v!==null&&!localStorage.getItem(k))localStorage.setItem(k,v);}}` }, sessionId);
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const until = async expression => { for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await wait(100); } throw new Error(`Timeout: ${expression}; ${await evaluate('document.body.innerText')}`); };
  const click = async selector => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center',behavior:'instant'})`);
    await wait(700);
    const point = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing '+${JSON.stringify(selector)});const b=e.getBoundingClientRect();const x=b.x+b.width/2,y=b.y+b.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Obscured '+${JSON.stringify(selector)});return{x,y};})()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 }, sessionId);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 }, sessionId); await wait(200);
  };
  const capture = async name => { const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId); writeFileSync(resolve(out, name + '.png'), Buffer.from(shot.data, 'base64')); };
  const boot = async url => { await send('Page.navigate', { url }, sessionId); await until('!!document.querySelector(".startup-gate")'); await click('.startup-gate'); await until('!!document.querySelector("#download-game")'); };
  const waitDownload = async count => { for (let i = 0; i < 600 && completed.length < count; i++) { await wait(100); if(i%10===0 && await evaluate('document.querySelector(".offline-play-modal [role=status]")?.textContent.includes("Failed to fetch")')) break; } if(completed.length < count) console.error(await evaluate('document.body.innerText')); check(completed.length >= count, 'browser completes requested download'); return resolve(downloads, completed[count - 1]); };
  await send('Emulation.setDeviceMetricsOverride', { width: 1365, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
  if (downloadControlsCheck) {
    await boot(base + '/AshenSpire.html');
    // A controlled file handle checks picker timing, writes, cancel and failures.
    // This is not a claim that an OS dialog was exercised by headless automation.
    await evaluate(`window.pickerCalls=[]; window.savedBytes=0; window.fileClosed=false; window.fileAborted=false;
      window.showSaveFilePicker=async options=>{pickerCalls.push({name:options.suggestedName,active:navigator.userActivation.isActive});
        if(window.cancelPicker)throw new DOMException('Canceled','AbortError');
        return{createWritable:async()=>({write:async bytes=>{if(window.failWrite)throw new Error('Test disk full');savedBytes+=bytes.length},close:async()=>{fileClosed=true},abort:async()=>{fileAborted=true}})}}`);
    await click('#download-game'); await until('!document.querySelector("#offline-download").disabled');
    check(await evaluate('Array.from(document.querySelector("#offline-branch").options,o=>o.value).join(",")==="release,test,dev,main"'), 'all four branch choices are present');
    await evaluate('window.cancelPicker=true'); await click('#offline-download');
    check(await evaluate('document.querySelector(".offline-play-modal [role=status]").textContent.includes("canceled") && savedBytes===0'), 'canceling save location starts no file write');
    await evaluate('window.cancelPicker=false');
    for (const branch of ['release','test','dev','main']) {
      await evaluate(`savedBytes=0;fileClosed=false;document.querySelector('#offline-branch').value=${JSON.stringify(branch)};document.querySelector('#offline-branch').dispatchEvent(new Event('change'))`);
      await until('!document.querySelector("#offline-download").disabled');
      await click('#offline-download');
      await until('document.querySelector("#offline-progress").value > 0 && document.querySelector("#offline-progress").value < 100');
      check(await evaluate('document.querySelector("#offline-branch").disabled && document.querySelector("#offline-check").disabled'), `${branch} shows partial progress and locks build selection during transfer`);
      if (branch === 'release') await capture('download-progress-desktop');
      await until('window.fileClosed');
      check(await evaluate(`savedBytes===1048576 && pickerCalls.at(-1).active && pickerCalls.at(-1).name.includes('-${branch}-') && document.querySelector('#offline-progress').value===100`), `${branch} opens picker from click and writes every byte before success`);
    }
    await evaluate('window.failWrite=true'); await click('#offline-download');
    await until('window.fileAborted');
    check(await evaluate('document.querySelector(".offline-play-modal [role=status]").textContent.includes("Test disk full") && !document.querySelector("#offline-download").disabled'), 'disk error aborts writer and permits retry');
    await evaluate('window.failWrite=false');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
    await click('#offline-download');
    await until('document.querySelector("#offline-progress").value > 0 && document.querySelector("#offline-progress").value < 100');
    await capture('download-progress-phone');
    await until('!document.querySelector("#offline-download").disabled');
    await evaluate('window.showSaveFilePicker=undefined;const originalBlobURL=URL.createObjectURL;URL.createObjectURL=blob=>{window.fallbackBlob=blob;return originalBlobURL(blob)}');
    await click('#offline-download');
    await until('!!window.fallbackBlob');
    check(await evaluate('fallbackBlob.arrayBuffer().then(buffer=>buffer.byteLength===1048576 && new Uint8Array(buffer).every(byte=>byte===65))'), 'unsupported-picker fallback contains exact fixture bytes');
    check(downloadNames.size > 0, 'unsupported-picker fallback automatically requests a browser download');
    check(errors.length === 0, `no browser exceptions: ${errors.join('; ')}`);
  } else if (liveReleaseCheck) {
    await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.showSaveFilePicker=undefined' }, sessionId);
    await boot(base + '/AshenSpire.html'); await click('#download-game');
    await until('!document.querySelector("#offline-download").disabled');
    check(true, 'live release enables Download automatically without Check for updates');
    await capture('live-release-enabled');
    await click('#offline-download');
    await until('document.querySelector("#offline-download").textContent === "Save game file"');
    check(await evaluate('document.querySelector(".offline-play-modal").textContent.includes(" MB.")'), 'actual live release bytes are prepared and their size is displayed');
    await capture('live-release-prepared');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
    await wait(1200); await capture('live-release-phone');
    check(errors.length === 0, `no browser exceptions: ${errors.join('; ')}`);
  } else {
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.showSaveFilePicker=undefined' }, sessionId);
  let backupPath, gamePath;
  if (offlineOnly) {
    backupPath = resolve(downloads, 'fixture-saves.json'); writeFileSync(backupPath, original);
    gamePath = resolve('AshenSpire.html');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
  } else {
  await boot(base + '/AshenSpire.html');
  await click('#download-game'); await until('!!document.querySelector("#offline-export")');
  await click('#offline-export'); backupPath = await waitDownload(1);
  check(createSaveTransfer(createMemoryStorage(), registries).inspect(readFileSync(backupPath, 'utf8')).slots.filter(x => x.summary).length === 1, 'exported backup includes the saved run');
  await click('#offline-check'); await until('!document.querySelector("#offline-download").disabled');
  await capture('desktop-download');
  await click('#offline-download');
  await until('document.querySelector("#offline-download").textContent === "Save game file"');
  gamePath = await waitDownload(2);
  check(readFileSync(gamePath).equals(html), 'downloaded HTML is byte-identical to the packaged build');
  await click('.offline-play-modal .modal-close'); await click('#settings');
  await capture('desktop-settings');
  await until('!!document.querySelector("#settings-download")'); await click('#settings-download');
  await until('!!document.querySelector(".offline-play-modal")'); check(true, 'Settings opens the same download and saves panel');
  await click('.offline-play-modal .modal-close'); await click('#set-close');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
  await wait(1200);
  await click('#download-game'); await until('!!document.querySelector("#offline-export")');
  check(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'phone download panel fits viewport'); await capture('phone-download');
  }
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, sessionId);
  await boot(pathToFileURL(gamePath).href);
  check(await evaluate('location.protocol === "file:"'), 'downloaded game boots locally with network disabled');
  await click('#download-game');
  if (offlineOnly) {
    await capture('phone-download');
    await send('Emulation.setDeviceMetricsOverride', { width: 1365, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
    await wait(1200); await capture('desktop-download');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, sessionId);
    await wait(1200);
  }
  await send('DOM.enable', {}, sessionId); const doc = await send('DOM.getDocument', {}, sessionId);
  const { nodeId } = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '.offline-play-modal input[type=file]' }, sessionId);
  await click('#offline-import');
  await send('DOM.setFileInputFiles', { nodeId, files: [backupPath] }, sessionId);
  await until('!!document.querySelector(".confirmation-confirm")'); await capture('phone-import');
  await click('.confirmation-cancel'); await until('!document.querySelector(".confirmation-confirm")');
  check(await evaluate('!localStorage.getItem("sote_run_v1_s2")'), 'cancelled import does not create a local run');
  await click('#offline-import');
  await send('DOM.setFileInputFiles', { nodeId, files: [backupPath] }, sessionId);
  await until('!!document.querySelector(".confirmation-confirm")'); await click('.confirmation-confirm');
  await until('!!document.querySelector(".startup-gate")'); await click('.startup-gate'); await until('!!document.querySelector("#download-game")');
  check(await evaluate('!!localStorage.getItem("sote_run_v1_s2")'), 'imported save survives automatic file reload offline');
  check(await evaluate('!!localStorage.getItem("sote_transfer_backup_v1")'), 'previous local saves remain backed up');
  await click('.slot-continue'); await until('!!document.querySelector(".mapscreen")');
  await capture('phone-offline-resumed');
  check(true, 'imported run continues offline');
  await click('.map-node.reachable');
  await until('!!document.querySelector(".combat")');
  if (await evaluate('!!document.querySelector(".tut-skip")')) await click('.tut-skip');
  await capture('phone-offline-combat');
  check(true, 'offline map entry opens playable combat');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window,'localStorage',{get(){throw new Error('Browser storage blocked')}})` }, sessionId);
  await boot(pathToFileURL(gamePath).href);
  await click('#download-game'); await click('#offline-import');
  check(await evaluate('document.querySelector(".offline-play-modal [role=status]").textContent.includes("not keeping saves")'), 'blocked storage refuses import before changing saves');
  check(errors.length === 0, `no browser exceptions: ${errors.join('; ')}`);
  }
} finally {
  await Promise.race([send('Browser.close').catch(() => {}), wait(1000)]); ws.close(); await browser.close();
  server.closeAllConnections(); await new Promise(done => server.close(done));
}
console.log(`${checks} ${downloadControlsCheck ? 'download controls' : liveReleaseCheck ? 'live release preparation' : offlineOnly ? 'offline-only' : 'download and offline'} browser checks passed. ${downloadControlsCheck ? 'Throttled 1 MB fixture and controlled picker handle; native OS dialog not tested.' : liveReleaseCheck ? 'Real published metadata and HTML fetched; final file save not tested.' : offlineOnly ? 'Download skipped; local generated HTML and a save fixture were used.' : 'Release metadata is a local fixture; downloaded bytes are the real generated build.'}`);
