// tools/offline-play-qa.mjs — the Download & saves screen and the game it saves,
// played offline under file:// in a real Chromium.
//
//   node tools/offline-play-qa.mjs                       download the single file, then play it offline
//   node tools/offline-play-qa.mjs --offline-only        play the local AshenSpire.html offline
//   node tools/offline-play-qa.mjs --download-controls-check   picker timing, progress, cancel, disk errors
//   node tools/offline-play-qa.mjs --live-release-check  the real published feed
//   node tools/offline-play-qa.mjs --zip [--web build/web]
//       THE FOLDER COPY (docs/EXTERNAL-ASSETS-PLAN.md §5 B, step 7): publishes
//       build/web (node tools/launch.mjs --build-only) into a local copy of the
//       Pages shape (tools/pages-store.mjs publishPack, the light single file at
//       download/, a build.json as tools/pages-site.mjs writes it), boots the
//       hosted page, has the game assemble its zip, unzips it, checks every
//       entry against the pin and the indexes, stops the server, and plays the
//       unzipped folder offline under file:// (light art and the lore faces
//       loaded from the folder, then the shared import → map → combat pass).
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, resolveBrowser, serveDir } from './browser.mjs';
import { packPinOf, publishPack } from './pages-store.mjs';
import { objectPath } from './asset-pack.mjs';
import { extractZip } from './zip.mjs';
import { folderZipBytes, zipFolderName } from '../src/model/offlineDownload.js';
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
const zipCheck = process.argv.includes('--zip');
let zipSite = null, zipUnzipped = null;
const webDir = resolve(process.argv.includes('--web') ? process.argv[process.argv.indexOf('--web') + 1] : 'build/web');
const downloads = resolve(out, `downloads-${Date.now()}`); mkdirSync(downloads);
const html = readFileSync('AshenSpire.html'), build = JSON.parse(readFileSync('buildordinal.json'));
const metadata = { branch: 'main', version: build.release, ordinal: build.ordinal, bytes: html.length };
const storage = createMemoryStorage(), registries = createRegistries(contentBundle), saves = createSaveManager(storage);
const fixtureRun = createRunState({ seed: 54321, classId: contentBundle.classes[0].id, registries });
Object.assign(fixtureRun, { customization: { name: 'Offline test', glyph: '⚔', tint: 'gold' },
  custom: { ascension: 0, mods: {}, deckMode: 'standard' },
  stats: { fightsWon: 0, damageDealt: 0, damageTaken: 0 }, path: [], seenEvents: [], lastEncounters: [] });
const fixtureRng = createRng(fixtureRun.seed);
fixtureRun.mapGraph = buildActMap(registries, fixtureRng, fixtureRun.seatOrder[fixtureRun.actNumber - 1], fixtureRun.actNumber, null, { history: fixtureRun.history });
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
  let backupPath, gamePath, zipFolder = null, zipPin = null;
  if (zipCheck) {
    // The Pages shape, served under /AshenSpire/ as the site is.
    const webHtml = join(webDir, 'AshenSpire.html');
    if (!existsSync(webHtml) || !packPinOf(readFileSync(webHtml))) throw new Error(`${webHtml} is not a pack-shaped build — run node tools/launch.mjs --build-only first`);
    zipSite = mkdtempSync(join(tmpdir(), 'offline-zip-site-'));
    const site = await serveDir(zipSite, { prefix: 'AshenSpire' });
    try {
      const origin = `${site.origin}/AshenSpire/`;
      // Only the hosted QA copy points its release feed at this fixture; the
      // zip carries that same page, byte for byte, which is what is checked.
      const page = Buffer.from(readFileSync(webHtml, 'utf8').replaceAll('https://cehinds.github.io/AshenSpire/', origin));
      zipPin = packPinOf(page);
      const rel = `main/${build.ordinal}`;
      publishPack(zipSite, rel, page, webDir);
      mkdirSync(join(zipSite, rel, 'download'), { recursive: true });
      writeFileSync(join(zipSite, rel, 'download', 'AshenSpire.html'), html);
      const sha = (b) => createHash('sha256').update(b).digest('hex');
      const info = { branch: 'main', ordinal: build.ordinal, version: build.release, bytes: null, pageBytes: page.length, pageSha256: sha(page),
        zipBytes: folderZipBytes({ html: page, folder: zipFolderName('main', `${build.release}.${build.ordinal}`), read: (r) => readFileSync(join(zipSite, r)) }), shape: 'pack', tier: zipPin.tier,
        download: { path: 'download/AshenSpire.html', bytes: html.length, sha256: sha(html) } };
      for (const dir of [rel, 'main/latest']) { mkdirSync(join(zipSite, dir), { recursive: true }); writeFileSync(join(zipSite, dir, 'build.json'), JSON.stringify(info, null, 2)); }
      await boot(`${origin}${rel}/`);
      check(await evaluate('document.documentElement.dataset.builtInArt') === (zipPin.tier || 'light'), 'the hosted web edition loads its pinned art from the site store');
      await click('#download-game');
      await until('document.querySelector("#offline-zip")?.disabled === false && document.querySelector("#offline-zip-box")?.hidden === false');
      check(await evaluate('/MB and saves as AshenSpire-main-/.test(document.querySelector(".offline-zip-steps").textContent)'), 'the folder copy is offered with its size and file name');
      check(await evaluate('document.querySelector("#offline-zip-none").hidden'), 'a pack-shaped build does not say it has no folder copy');
      await capture('zip-offered');
      const before = completed.length;
      await click('#offline-zip');
      for (let i = 0; i < 3000 && completed.length <= before; i++) { await wait(100); if (i % 20 === 0 && await evaluate('/could not|did not match|not published/.test(document.querySelector("#offline-zip-status").textContent)')) break; }
      const said = await evaluate('document.querySelector("#offline-zip-status").textContent');
      check(completed.length > before, `the browser saves the folder copy ("${said}")`);
      check(/^Folder copy sent to your browser/.test(said) && await evaluate('document.querySelector("#offline-zip").textContent') === 'Save zip file', 'the screen says the zip was sent and offers Save zip file to retry');
      await capture('zip-saved');
      const zipPath = resolve(downloads, completed.at(-1));
      check(readFileSync(zipPath).length === info.zipBytes, `the zip is exactly the size build.json's zipBytes announced (${info.zipBytes} bytes)`);
      check(/^AshenSpire-main-\d+\.\d+\.\d+\.\d+\.zip$/.test(completed.at(-1)), `the zip keeps the download's name (${completed.at(-1)})`);
      // Unzip and prove every entry.
      const unzipped = zipUnzipped = mkdtempSync(join(tmpdir(), 'offline-zip-unzipped-'));
      const names = extractZip(zipPath, unzipped);
      zipFolder = join(unzipped, `AshenSpire-main-${build.release}.${build.ordinal}`);
      gamePath = join(zipFolder, `AshenSpire-main-${build.release}.${build.ordinal}.html`);
      check(existsSync(gamePath) && readFileSync(gamePath).equals(page), 'the unzipped game file is the hosted page, byte for byte');
      const wantObjects = new Set();
      for (const pack of ['light', 'common']) {
        const index = JSON.parse(readFileSync(join(zipFolder, zipPin.packs[pack].index), 'utf8'));
        check(sha(readFileSync(join(zipFolder, zipPin.packs[pack].index))) === zipPin.packs[pack].sha256, `the ${pack} index is in the folder and hashes to the pin`);
        check(existsSync(join(zipFolder, zipPin.packs[pack].index.replace(/\.json$/, '.js'))), `the ${pack} index's .js twin is in the folder`);
        for (const [id, row] of Object.entries(index)) wantObjects.add(objectPath(row[0], id));
      }
      if (zipPin.fonts) check(existsSync(join(zipFolder, zipPin.fonts.file)), 'the font sidecar is in the folder');
      if (zipPin.packs.high) check(!existsSync(join(zipFolder, zipPin.packs.high.index)), 'the high index is not packed (the loader falls back to light)');
      const bad = [...wantObjects].filter((p) => !existsSync(join(zipFolder, p)) || sha(readFileSync(join(zipFolder, p))) !== /([0-9a-f]{64})/.exec(p)[1]);
      const objectCount = readdirSync(join(zipFolder, 'objects')).reduce((n, d) => n + readdirSync(join(zipFolder, 'objects', d)).length, 0);
      check(bad.length === 0 && objectCount === wantObjects.size, `every light and common object is in the folder with its hash, and nothing else (${objectCount} of ${wantObjects.size}${bad.length ? `; bad: ${bad.slice(0, 3).join(', ')}` : ''})`);
      check(names.length === wantObjects.size + 2 + 2 * 2 + (zipPin.fonts ? 1 : 0), `the zip holds the page, asset-base.json, two indexes, their twins, the sidecar and the objects (${names.length} entries)`);
      // The save-picker path: the same zip streamed into a chosen file, in coalesced writes.
      await evaluate(`window.zipWrites = []; window.zipClosed = false; window.showSaveFilePicker = async (options) => { window.zipPicked = options.suggestedName;
        return { createWritable: async () => ({ write: async (b) => { zipWrites.push(new Uint8Array(b)); }, close: async () => { zipClosed = true; }, abort: async () => {} }) }; }`);
      await click('#offline-check');
      await until('document.querySelector("#offline-zip")?.disabled === false && document.querySelector("#offline-zip").textContent === "Download game folder (zip)"');
      await click('#offline-zip');
      for (let i = 0; i < 3000 && !(await evaluate('window.zipClosed && /^Folder copy saved/.test(document.querySelector("#offline-zip-status").textContent)')); i++) await wait(100);
      const streamed = await evaluate(`(async () => { const all = new Blob(zipWrites); const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await all.arrayBuffer())), (x) => x.toString(16).padStart(2, '0')).join('');
        return { sha, bytes: all.size, writes: zipWrites.length, name: zipPicked }; })()`);
      check(streamed.sha === sha(readFileSync(zipPath)) && streamed.name === completed.at(-1), `the save-picker path streams the same zip, byte for byte, in ${streamed.writes} coalesced writes (${streamed.bytes} bytes)`);
      writeFileSync(resolve(out, 'zip-status.txt'), await evaluate('document.querySelector("#offline-zip-status").textContent'));
    } finally { site.server.closeAllConnections?.(); await site.close(); }
    backupPath = resolve(downloads, 'fixture-saves.json'); writeFileSync(backupPath, original);
    await click('.offline-play-modal .modal-close');
  } else if (offlineOnly) {
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
  if (zipCheck) {
    check(await evaluate('document.documentElement.dataset.builtInArt') === 'light', 'the unzipped folder loads its light art from its own packs under file://');
    const faces = await evaluate('[...document.fonts].filter(f => f.status === "loaded").length');
    check(faces >= (zipPin.fonts?.faces || 0), `the lore faces load from the folder's font sidecar (${faces})`);
    // The title's backdrop is an ASSET_CSS rule filled with an object path; it must name the folder's objects and load.
    const backdrop = await evaluate(`(async () => { const url = [...document.querySelectorAll('*')].map(e => getComputedStyle(e).backgroundImage).join(' ').match(/url\\("?(file:[^")]*\\/objects\\/[^")]+)"?\\)/)?.[1];
      if (!url) return null; const img = new Image(); img.src = url; await img.decode().catch(() => {}); return { url, width: img.naturalWidth }; })()`);
    check(backdrop && backdrop.url.startsWith(pathToFileURL(zipFolder).href) && backdrop.width > 0, `a title backdrop is drawn from the folder's objects (${backdrop ? `${backdrop.url.slice(-30)}, ${backdrop.width}px` : 'none'})`);
    await capture('zip-offline-title');
  }
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
  await click('#map-enter');
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
  // The fixture site and the unzipped folder are temporary; the zip itself stays in artifacts/ with the screenshots.
  for (const dir of [zipSite, zipUnzipped]) if (dir) rmSync(dir, { recursive: true, force: true });
  server.closeAllConnections(); await new Promise(done => server.close(done));
}
console.log(`${checks} ${downloadControlsCheck ? 'download controls' : liveReleaseCheck ? 'live release preparation' : zipCheck ? 'folder copy (zip) and offline' : offlineOnly ? 'offline-only' : 'download and offline'} browser checks passed. ${zipCheck ? 'The web edition was served in the Pages shape on 127.0.0.1 with a fixture build.json; the zip was assembled by the game twice (the Blob path, and a stubbed save-picker handle: no OS dialog), unzipped and played under file:// with the network off.' : downloadControlsCheck ? 'Throttled 1 MB fixture and controlled picker handle; native OS dialog not tested.' : liveReleaseCheck ? 'Real published metadata and HTML fetched; final file save not tested.' : offlineOnly ? 'Download skipped; local generated HTML and a save fixture were used.' : 'Release metadata is a local fixture; downloaded bytes are the real generated build.'}`);
