// Capture real event, speaker, and combat-card screens after their art loads.
// Usage: node tools/art-runtime-check.mjs --out D:/repos/.codex/temp/art-runtime
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const outIndex = process.argv.indexOf('--out');
if (outIndex >= 0 && !process.argv[outIndex + 1]) throw new Error('--out needs a directory');
const out = resolve(outIndex >= 0 ? process.argv[outIndex + 1] : 'D:/repos/.codex/temp/art-runtime');
const browser = [process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((path) => path && existsSync(path));
if (!browser) throw new Error('Chrome or Edge is required for rendered art checks');
mkdirSync(out, { recursive: true });

const { server, port } = await serve({ root: resolve(root, 'build'), port: 8327, open: false });
const { wsUrl, close } = await launchBrowser({ prefix: 'art-check-', browser, headless: '--headless=new', timeoutMs: 30000 });
try {
  const cdpPort = Number(new URL(wsUrl.replace(/^ws:/, 'http:')).port);
  let pages;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { pages = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json(); if (pages.length) break; } catch { /* launching */ }
    await new Promise((done) => setTimeout(done, 100));
  }
  const socket = new WebSocket(pages.find((page) => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
  let id = 0;
  const waiting = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (!waiting.has(message.id)) return;
    const { done, fail } = waiting.get(message.id);
    waiting.delete(message.id);
    message.error ? fail(new Error(message.error.message)) : done(message.result);
  };
  const send = (method, params = {}) => new Promise((done, fail) => {
    const requestId = ++id;
    waiting.set(requestId, { done, fail });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'browser evaluation failed');
    return result.result.value;
  };
  await send('Page.enable');
  await send('Runtime.enable');
  for (const [width, height] of [[1280, 800], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    for (const [screen, eventId, selector] of [
      ['event', 'weepingPilgrim', '.event-screen .as-artwell img'],
      ['speaker', 'lastLantern', '.dialogue-screen .speaker-portrait-image'],
      ['card', null, '.combat .hand .playing-card-art'],
    ]) {
      const query = eventId ? `shot=event&shotEvent=${eventId}` : 'shot=combat';
      await send('Page.navigate', { url: `http://127.0.0.1:${port}/AshenSpire.html?${query}&art-check=${width}` });
      let ready = false;
      for (let attempt = 0; attempt < 300 && !ready; attempt++) {
        ready = await evaluate(`document.readyState === 'complete' && !!document.querySelector(${JSON.stringify(selector)})`).catch(() => false);
        if (!ready) await new Promise((done) => setTimeout(done, 100));
      }
      if (!ready) throw new Error(`${screen} did not mount at ${width}x${height}`);
      const facts = await evaluate(`(async () => {
        await document.fonts?.ready;
        const image = document.querySelector(${JSON.stringify(selector)});
        if (!image) throw new Error('art image missing from ${screen}');
        await image.decode();
        // Choice rows enter with a stagger; wait for the final row before capture.
        await new Promise((done) => setTimeout(done, 550));
        const rect = image.getBoundingClientRect();
        return { src: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight,
          renderedWidth: rect.width, renderedHeight: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
      })()`);
      if (!facts.width || !facts.height || !facts.renderedWidth || !facts.renderedHeight) {
        throw new Error(`${screen} ${width}x${height}: artwork failed to render: ${JSON.stringify(facts)}`);
      }
      const screenshot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(resolve(out, `${screen}-${width}x${height}.png`), Buffer.from(screenshot.data, 'base64'));
      console.log(`${screen} ${width}x${height}: ${JSON.stringify(facts)}`);
    }
  }
  socket.close();
} finally {
  await close();
  server.close();
}
