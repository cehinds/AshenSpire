// tools/coop-shoot.mjs — LIVE multi-client co-op screenshots (no canned data).
//
// Drives TWO real browser clients through the actual Forsaken Together flow —
// host a fire, join it, ready up, start, fork-vote, fight the shared battle —
// against a real in-process LAN server, and photographs both screens.
//
// Zero dependencies: headless Chrome is driven over the DevTools Protocol
// (CDP) using Node's built-in WebSocket; the server is tools/serve.mjs
// imported in-process. Output → docs/preview/coop-live-*.png:
//   coop-live-lobby.png  guest's room view (roster + ready)
//   coop-live-vote.png   guest's map with the host's held vote (VOTES 1/2)
//   coop-live-host.png   host mid-fight after playing a card
//   coop-live-guest.png  guest's view of the SAME fight (sync proof)
//
//   node tools/coop-shoot.mjs

import { spawn } from 'node:child_process';
import { launchBrowser } from './browser.mjs';
import { existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/preview');
const BROWSERS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const fails = [];
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) fails.push(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- minimal CDP client over Node's global WebSocket ------------------------
function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(`${msg.error.message} (${msg.error.code})`));
      else res(msg.result);
    }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => {
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close: () => ws.close(),
  };
}

// Launch headless Chrome with a CDP endpoint; resolve the browser ws URL.

async function main() {
  const browser = BROWSERS.find((p) => existsSync(p));
  if (!browser) throw new Error('no Chrome/Edge found');
  mkdirSync(OUT, { recursive: true });

  const { server, port } = await serve({ root: ROOT, port: 8230, open: false, lan: true });
  const base = `http://localhost:${port}/`;
  // ONE HOME for launching a browser: tools/browser.mjs owns the profile, pins
  // Chrome's own TMPDIR inside it, and removes it whatever happens.
  const { child, wsUrl, profile, close: dropBrowser } = await launchBrowser({
    prefix: 'coopshoot-', browser: browser,
    headless: '--headless=new',
    args: ['--window-size=1440,860', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'],
    timeoutMs: 12000,
  });
  const cdp = connectCdp(wsUrl);
  await cdp.ready;

  // Two real client tabs.
  async function makeTab() {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    return sessionId;
  }
  const hostTab = await makeTab();
  const guestTab = await makeTab();

  const evalIn = async (sess, expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sess);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  // Poll a page-side expression until truthy (the co-op UI is server-pushed).
  const until = async (sess, expr, label, timeoutMs = 12000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await evalIn(sess, expr)) return true;
      await wait(160);
    }
    throw new Error(`timeout: ${label}`);
  };
  const shoot = async (sess, name) => {
    await cdp.send('Page.bringToFront', {}, sess); // foreground → animations run to rest
    await wait(500); // let the 300ms screen-fade finish
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' }, sess);
    const out = resolve(OUT, name);
    writeFileSync(out, Buffer.from(data, 'base64'));
    console.log(`  📷 ${name}`);
  };
  const click = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()`;

  // ---- the real flow --------------------------------------------------------
  // Host: title → lobby → light the fire.
  await cdp.send('Page.navigate', { url: base }, hostTab);
  await until(hostTab, `!!document.querySelector('#lan-play') && !document.querySelector('#lan-play').hidden`, 'host sees LAN button');
  await evalIn(hostTab, click('#lan-play'));
  await until(hostTab, `!!document.querySelector('#lb-name')`, 'host lobby');
  await evalIn(hostTab, `(() => { const n = document.querySelector('#lb-name'); n.value = 'Wren'; n.dispatchEvent(new Event('input')); return true; })()`);
  await evalIn(hostTab, click('#lb-host'));
  await until(hostTab, `/at the fire/i.test(document.querySelector('.lobby-room .as-title-m')?.textContent || '')`, 'host at the fire');
  ok(true, 'host lit a fire');
  // Couch party: the host adds a LOCAL seat on its screen.
  await evalIn(hostTab, click('#lb-addlocal'));
  await until(hostTab, `[...document.querySelectorAll('#lb-roster .as-pill')].some((s) => /local seat/i.test(s.textContent))`, 'local seat in roster');
  ok(true, 'host added a local (couch) player');

  // Guest: opens the HOST's advertised URL directly, sees the local fire, joins.
  await cdp.send('Page.navigate', { url: base }, guestTab);
  await until(guestTab, `!!document.querySelector('#lan-play') && !document.querySelector('#lan-play').hidden`, 'guest sees LAN button');
  await evalIn(guestTab, click('#lan-play'));
  await until(guestTab, `!!document.querySelector('#lb-name')`, 'guest lobby');
  await evalIn(guestTab, `(() => { const n = document.querySelector('#lb-name'); n.value = 'Fenn'; n.dispatchEvent(new Event('input')); return true; })()`);
  await until(guestTab, `!!document.querySelector('.lb-join')`, 'guest sees the fire');
  await evalIn(guestTab, click('.lb-join'));
  await until(guestTab, `!!document.querySelector('#lb-ready')`, 'guest in the room');
  await evalIn(guestTab, `(() => { const v = [...document.querySelectorAll('.cr-class')].find((p) => /reaver/i.test(p.textContent)); if (v) v.click(); return true; })()`);
  await wait(200);
  // Fenn picks the Hoarfrost accent — the shots must show gold vs blue.
  // The accent swatch names its colour by aria-label (the kit's Swatch; a
  // `title=` attribute is the one tooltip form the house forbids).
  await evalIn(guestTab, `(() => { const d = [...document.querySelectorAll('.tint-dot')].find((x) => /frost/i.test(x.getAttribute('aria-label') || '')); if (d) d.click(); return !!d; })()`);
  await until(hostTab, `[...document.querySelectorAll('#lb-roster .slot span[style*="color"]')].length > 0`, 'host sees tinted roster');
  await wait(200);
  await evalIn(guestTab, click('#lb-ready'));
  await until(guestTab, `/READY —/.test(document.querySelector('#lb-ready')?.textContent || '')`, 'guest readied');
  ok(true, 'guest joined via the host URL and readied up');
  await until(hostTab, `!document.querySelector('#lb-start')?.disabled`, 'host sees all ready');
  await shoot(guestTab, 'coop-live-lobby.png');

  // Start → both land on the shared SVG map.
  await evalIn(hostTab, click('#lb-start'));
  await until(hostTab, `!!document.querySelector('.mapscreen')`, 'host on shared map');
  await until(guestTab, `!!document.querySelector('.mapscreen')`, 'guest on shared map');
  ok(true, 'server-authoritative run started for both clients');
  const mapQuickSettings = await evalIn(guestTab, `({
    place: document.querySelector('[data-hud-quick-settings]')?.dataset.place,
    controls: document.querySelectorAll('[data-hud-quick-action]').length,
    visible: (() => { const r = document.querySelector('[data-hud-quick-settings]')?.getBoundingClientRect(); return !!r && r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight; })(),
  })`);
  ok(mapQuickSettings.place === 'map' && mapQuickSettings.controls === 2 && mapQuickSettings.visible,
    'LAN map visibly mounts the shared Fullscreen and Music controls');
  await until(hostTab, `document.querySelectorAll('.coop-seat-tabs .seat-tab').length === 2`, 'host shows two seat tabs');
  ok(true, "host's screen shows seat tabs for its two couch seats");

  // Fork vote: host votes first — guest sees the held vote, then completes it.
  await evalIn(hostTab, click('.map-node.reachable'));
  await until(guestTab, `/VOTES 1\\/3/i.test(document.querySelector('.coop-voteline')?.textContent || '')`, 'guest sees VOTES 1/3');
  ok(true, "host's vote is visible on the guest's map");
  // Scroll the map to the reachable start row so the vote pip is in frame.
  await evalIn(guestTab, `(() => { const s = document.querySelector('.map-scroll'); if (s) s.scrollTop = s.scrollHeight; return true; })()`);
  await shoot(guestTab, 'coop-live-vote.png');
  // The host's second (couch) seat votes: switch seat tab, click the node.
  await evalIn(hostTab, `(() => { const b = document.querySelectorAll('.coop-seat-tabs .seat-tab')[1]; if (b) b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return !!b; })()`);
  await wait(250);
  await evalIn(hostTab, click('.map-node.reachable'));
  await until(guestTab, `/VOTES 2\\/3/i.test(document.querySelector('.coop-voteline')?.textContent || '')`, 'guest sees VOTES 2/3');
  ok(true, "the couch seat's vote (cast via seat tabs) reached everyone");
  await evalIn(guestTab, click('.map-node.reachable'));
  await until(hostTab, `!!document.querySelector('.combat.coop')`, 'host in shared combat');
  await until(guestTab, `!!document.querySelector('.combat.coop')`, 'guest in shared combat');
  ok(true, 'vote resolved into one shared fight');
  const combatQuickSettings = await evalIn(guestTab, `({
    place: document.querySelector('[data-hud-quick-settings]')?.dataset.place,
    controls: document.querySelectorAll('[data-hud-quick-action]').length,
    visible: (() => { const r = document.querySelector('[data-hud-quick-settings]')?.getBoundingClientRect(); return !!r && r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight; })(),
  })`);
  ok(combatQuickSettings.place === 'combat' && combatQuickSettings.controls === 2 && combatQuickSettings.visible,
    'LAN combat visibly mounts the shared Fullscreen and Music controls');
  // Accents differentiate players: the host's board shows 2+ distinct tints
  // across its seats (gold host + the local seat's own accent, etc.).
  const tints = await evalIn(hostTab, `[...new Set([...document.querySelectorAll('.coop-seat-name span[style*="--"]')].map((s) => (s.getAttribute('style').match(/--\\w+/) || [''])[0]))]`);
  ok(Array.isArray(tints) && tints.length >= 2, `board shows multiple distinct accents (${tints.join(',')})`);

  // Host plays a card into the shared fight; both screens must render the
  // identical battle state (enemy HP row + every seat's energy).
  const battleState = `[...document.querySelectorAll('.enemy-row .hpbar .label')].map((l) => l.textContent).join('|')
    + ' ⚡' + [...document.querySelectorAll('.coop-seat-name')].map((n) => (n.textContent.match(/⚡\\d+\\/\\d+/) || [''])[0]).join(',')`;
  const before = await evalIn(guestTab, battleState);
  // Play as the host's FIRST seat again.
  await evalIn(hostTab, `(() => { const b = document.querySelectorAll('.coop-seat-tabs .seat-tab')[0]; if (b) b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()`);
  await wait(200);
  await evalIn(hostTab, click('.combatant.enemy:not(.dead)'));
  await wait(200);
  const played = await evalIn(hostTab, `(() => {
    const card = [...document.querySelectorAll('.hand .card')].find((c) => !c.classList.contains('unaffordable'));
    if (card) card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return !!card;
  })()`);
  ok(played, 'host played a card into the shared fight');
  await until(guestTab, `(${battleState}) !== ${JSON.stringify(before)}`, "guest's screen reflects the host's play");
  // Snapshot-diff FX: the guest derives floats/recoil from the state change.
  const fx = await evalIn(guestTab, `({ floats: document.querySelectorAll('.fx-layer .float-num').length, flash: document.querySelectorAll('.sprite.hitflash').length })`);
  ok(fx.floats > 0 || fx.flash > 0, `guest shows combat FX from the host's play (floats=${fx.floats} recoil=${fx.flash})`);
  const viewHost = await evalIn(hostTab, battleState);
  const viewGuest = await evalIn(guestTab, battleState);
  ok(viewHost === viewGuest, `both clients render the identical shared fight (${viewGuest})`);
  await shoot(guestTab, 'coop-live-guest.png');
  await shoot(hostTab, 'coop-live-host.png');

  // Enemy-phase pacing: both end their turns → the guest holds the old board,
  // shows the ENEMY TURN banner + paced lunges, then the new turn lands.
  await evalIn(hostTab, click('#coop-endturn'));
  await evalIn(hostTab, `(() => { const b = document.querySelectorAll('.coop-seat-tabs .seat-tab')[1]; if (b) b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()`);
  await wait(250);
  await evalIn(hostTab, click('#coop-endturn'));
  await evalIn(guestTab, click('#coop-endturn'));
  let sawBanner = false;
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 6000 && !sawBanner) {
      sawBanner = await evalIn(guestTab, `!!document.querySelector('.coop-turn-banner')`);
      if (!sawBanner) await wait(80);
    }
  }
  ok(sawBanner, 'guest sees the ENEMY TURN banner when the phase resolves');
  await until(guestTab, `(() => { const es = [...document.querySelectorAll('.coop-seat-name')].map((n) => (n.textContent.match(/⚡(\\d+)\\/(\\d+)/) || [])); return es.length >= 3 && es.every((m) => m[1] === m[2]); })()`, 'new player turn landed (all seats refilled) after the paced phase');
  ok(true, 'paced enemy phase resolved into the next turn');

  // ---- teardown -------------------------------------------------------------
  cdp.close();
  await dropBrowser();
  server.close();
  await wait(150);
  for (const p of [join(ROOT, '.coop-session.json')]) { try { rmSync(p); } catch { /* none */ } }
}

main().then(() => {
  console.log(fails.length ? `\nCOOP SHOOT FAILED (${fails.length})` : '\nLive multi-client shoot OK');
  process.exit(fails.length ? 1 : 0);
}).catch((e) => {
  console.error(`\nCOOP SHOOT CRASHED: ${e.message}`);
  process.exit(1);
});
