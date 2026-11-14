// tools/enemy-turn-probe.mjs — how long the enemies' turn takes, in a real browser.
//
// From the End Turn release to the hand being playable again: the time a player waits while the enemies act. A seeded
// fight is booted (`?shot=combat&shotSeed=<seed>`), nothing is played, End Turn is held and released each turn, any reaction
// prompt is answered at once through its exit button (the time it stayed open is taken off), and the turn's enemy actions
// are read from the engine's event log (enemyMoveStarted). Seeds are tried in order until each group has enough turns.
//
//   MEASURE enemyTurn actions=1 median=<s> max=<s> n=<turns>      a lone enemy's damaging action
//   MEASURE enemyTurn twoAttacks median=<s> max=<s> n=<turns>     two actions that both hurt (two enemies, or one twice)
//   MEASURE enemyTurn twoMixed median=<s> max=<s> n=<turns>       two actions, one of which deals no damage
//   MEASURE enemyTurn three median=<s> max=<s> n=<turns>          three or more actions (reported, no budget)
//   MEASURE enemyTurn guard median=<s> max=<s> n=<turns>          one action that deals no damage (Guard, Warcry, ...)
//
// It exits 1 when a group is over its budget (BUDGET below) or has fewer than MIN_TURNS samples, 2 when the harness
// could not run. No setting is changed and no animation is forced: the timings are the game's own at the default speed.
//
// With --stages the slow kind's timeline stage marks (window.__fx.trace) are printed per turn: when each stage began, in
// seconds after the End Turn release (the final line is the hand being playable).
//
//   node tools/enemy-turn-probe.mjs [--viewport 1280x800|390x844] [--budgets none] [--turns 6] [--stages]
//   node tools/verdict.mjs -- node tools/enemy-turn-probe.mjs

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BROWSERS = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
// Seeds whose fight opens on a lone enemy, on two enemies, and on an enemy that opens with a non-damaging move.
const SEEDS = ['5', 'W2B', '23', '12', '8', '20', '24', '6', '1', '2', '3', '4', '7', '9', '10', '11', '13', '14', '15', '16'];
// Budgets in seconds: { median, max } per group (Wave 2 targets: one action 2.2 s / 3.0 s, two attacks 3.2 s / 3.95 s, two actions with one that deals no damage 2.8 s / 3.5 s, a non-damaging action 1.2 s / 1.6 s).
const BUDGET = { one: { median: 2.2, max: 3.0 }, twoAttacks: { median: 3.2, max: 3.95 }, twoMixed: { median: 2.8, max: 3.5 }, guard: { median: 1.2, max: 1.6 } };
const args = process.argv.slice(2);
const argOf = (flag, fallback) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : fallback; };
const MIN_TURNS = Number(argOf('--turns', 8));
const STAGES = args.includes('--stages');
const OPTIONAL = new Set(['three']);
const [W, H] = argOf('--viewport', '1280x800').split('x').map(Number);
const mobile = W < 600;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(`${msg.error.message} (${msg.error.code})`)); else res(msg.result);
    }
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => { const timer = setTimeout(() => { pending.delete(id); rej(new Error(`no answer to ${method}`)); }, 90000); pending.set(id, { res: (v) => { clearTimeout(timer); res(v); }, rej: (e) => { clearTimeout(timer); rej(e); } }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
    },
    close: () => ws.close(),
  };
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

async function main() {
  const browserPath = argOf('--browser', null) || BROWSERS.find((p) => existsSync(p));
  if (!browserPath) { console.error('enemy-turn-probe: no Chrome/Chromium found; pass --browser PATH or set $CHROME'); process.exit(2); }
  const hosted = await serve({ root: ROOT, port: Number(argOf('--port', 0)), open: false, quiet: true });
  const base = `http://localhost:${hosted.port}/index.html`;
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'enemyturn-', browser: browserPath, timeoutMs: 20000,
    args: ['--disable-dev-shm-usage', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'],
  });
  const cdp = connectCdp(wsUrl);
  await cdp.ready;
  const groups = { one: [], twoAttacks: [], twoMixed: [], guard: [], three: [] };
  const required = () => Object.entries(groups).filter(([k]) => !OPTIONAL.has(k)).map(([, g]) => g);
  try {
    {
      const queue = argOf('--seeds', '') ? argOf('--seeds').split(',') : [...SEEDS], retried = new Set();
      for (let at = 0; at < queue.length; at += 1) {
        const seed = queue[at];
        if (required().every((g) => g.length >= MIN_TURNS)) break;
        let targetId = null;
        try {
          ({ targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' }));
          const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
          await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
          await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile }, S);
          if (mobile) await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true }, S);
          const ev = async (expression) => {
            const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
            if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
            return r.result.value;
          };
          const until = async (expr, label, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(expr)) return; await wait(40); } throw new Error(`timeout: ${label}`); };
          await cdp.send('Page.navigate', { url: `${base}?shot=combat&shotSeed=${encodeURIComponent(seed)}` }, S);
          await until(`!!window.__combat && !!document.querySelector('.end-turn')`, 'the fight', 90000);
          await wait(1500);
          // The time a reaction prompt stays in the page (from added to removed), read from the page's own clock.
          await ev(`window.__prompt = { open: null, ms: 0 }; new MutationObserver(() => {
            const here = !!document.querySelector('.reaction-choice'), p = window.__prompt;
            if (here && p.open == null) p.open = performance.now(); else if (!here && p.open != null) { p.ms += performance.now() - p.open; p.open = null; }
          }).observe(document.body, { childList: true, subtree: true }); true`);
          await ev(`addEventListener('pointerup', e => { if (e.target.closest?.('.end-turn')) window.__upAt = performance.now(); }, true)`);
          const ready = `window.__combat.phase === 'player' && document.querySelector('.combat')?.dataset.turn === 'player' && !document.querySelector('.end-turn')?.disabled && !document.querySelector('.hand')?.inert && !document.querySelector('.reaction-choice')`;
          let stop = false, fullStreak = 0;
          for (let turn = 0; turn < 12 && !required().every((g) => g.length >= MIN_TURNS); turn += 1) {
            if (stop || await ev(`window.__combat.result != null`)) break;
            await until(`${ready} || window.__combat.result != null`, 'a playable hand', 60000);
            if (await ev(`window.__combat.result != null`)) break;
            await ev(`window.__prevTurn = window.__combat.turn; window.__ev0 = window.__combat.eventLog.length; window.__upAt = null; window.__prompt.ms = 0; window.__fx.trace = []; true`);
            const pt = await ev(`(() => { const r = document.querySelector('.end-turn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
            await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y }, S);
            await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, S);
            await wait(900);
            await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, S);
            let over = false;
            for (let guard = 0; guard < 4000; guard += 1) {
              const s = await ev(`({ over: !document.querySelector('.combat') || window.__combat.result != null, react: !!document.querySelector('.reaction-choice'),
                ready: ${ready} && window.__combat.turn > window.__prevTurn, now: performance.now() })`).catch(() => ({ over: true }));
              if (s.over) { over = true; break; }
              if (s.react) {
                await wait(150);
                const pr = await ev(`(() => { const b = document.querySelector('.reaction-choice [data-control-role="exit"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
                if (pr) for (const type of ['mousePressed', 'mouseReleased']) await cdp.send('Input.dispatchMouseEvent', { type, x: pr.x, y: pr.y, button: 'left', clickCount: 1 }, S);
                await wait(250);
                continue;
              }
              if (s.ready) {
                const r = await ev(`({ up: window.__upAt, now: performance.now(), prompt: window.__prompt.ms, moves: window.__combat.eventLog.slice(window.__ev0).filter(e => e.type === 'enemyMoveStarted').map(e => e.kind),
                  hurts: window.__combat.eventLog.slice(window.__ev0).some(e => ['damageDealt', 'attackHit', 'attackMissed', 'attackEvaded', 'hpLost'].includes(e.type)),
                  hurtMoves: window.__combat.eventLog.slice(window.__ev0).filter(e => e.type === 'enemyMoveStarted').map(e => e.kind === 'attack' || window.__combat.eventLog.slice(window.__ev0).some(x => x.sourceId === e.sourceId && ['damageDealt', 'attackHit', 'attackMissed', 'attackEvaded'].includes(x.type))),
                  trace: (window.__fx.trace || []).map(([t, step, who]) => [Math.round(t - window.__upAt - window.__prompt.ms), step, who]) })`);
                const seconds = (r.now - r.up - r.prompt) / 1000;
                const key = r.moves.length >= 3 ? 'three' : r.moves.length === 2 ? (r.hurtMoves.every(Boolean) ? 'twoAttacks' : 'twoMixed') : r.moves.length === 1 && r.hurts ? 'one' : r.moves.length === 1 ? 'guard' : null;
                if (key && groups[key].length < MIN_TURNS + 2) groups[key].push(seconds);
                if (STAGES && key && key !== 'one' && key !== 'guard') console.error(`    stages ${key} ${seconds.toFixed(2)} s: ${r.trace.filter(([ms]) => ms > -200).map(([ms, step, who]) => `${(ms / 1000).toFixed(2)} ${step}${who ? '/' + who : ''}`).join(' | ')}`);
                fullStreak = key && !OPTIONAL.has(key) && groups[key].length >= MIN_TURNS ? fullStreak + 1 : 0;
                if (fullStreak >= 2) stop = true;
                console.error(`  seed ${seed} turn ${turn + 1}: ${r.moves.length} action(s) ${key || 'none'} ${seconds.toFixed(2)} s`);
                break;
              }
              await wait(20);
            }
            if (over) break;
          }
        } catch (error) {
          console.error(`  seed ${seed} skipped: ${error.message}`);
          if (!retried.has(seed)) { retried.add(seed); queue.push(seed); }
        }
        console.error(`  seed ${seed} done: ${Object.entries(groups).map(([k, g]) => `${k}=${g.length}`).join(' ')}`);
        if (targetId) await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
      }
    }
  } finally { cdp.close(); await dropBrowser(); hosted.server.close(); }

  const fmt = (n) => n.toFixed(2);
  const rows = [['one', 'actions=1'], ['twoAttacks', 'twoAttacks'], ['twoMixed', 'twoMixed'], ['guard', 'guard'], ['three', 'three']];
  const skipBudget = argOf('--budgets', '') === 'none';
  let red = 0;
  for (const [key, label] of rows) {
    const xs = groups[key];
    if (OPTIONAL.has(key) && xs.length === 0) { console.log(`MEASURE enemyTurn ${label} n=0 (no turn with three actions in these seeds)`); continue; }
    if (xs.length < (OPTIONAL.has(key) ? 1 : MIN_TURNS)) { console.log(`FAIL enemyTurn ${label}: ${xs.length} of ${MIN_TURNS} turns measured`); red += 1; continue; }
    const med = median(xs), max = Math.max(...xs);
    console.log(`MEASURE enemyTurn ${label} median=${fmt(med)} max=${fmt(max)} n=${xs.length}`);
    if (!skipBudget && !OPTIONAL.has(key) && (med > BUDGET[key].median || max > BUDGET[key].max)) { console.log(`FAIL enemyTurn ${label}: over budget median<=${BUDGET[key].median} max<=${BUDGET[key].max}`); red += 1; }
  }
  console.log(red ? `enemy-turn-probe: ${red} group(s) RED` : `enemy-turn-probe: OK — ${rows.length} checks passed.`);
  process.exit(red ? 1 : 0);
}
main().catch((error) => { console.error(`enemy-turn-probe: ${error.stack || error.message}`); process.exit(2); });
