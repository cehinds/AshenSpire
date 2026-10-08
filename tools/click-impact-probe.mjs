// tools/click-impact-probe.mjs — how long from the click that plays a card
// to its first visible damage, protection or Poise/Ward impact? (docs/FINISH.md §5: "Click to impact
// ≤ 400 ms at Normal pacing", baseline 1.28 s.)
//
// A REAL CLICK, A REAL CLOCK. A headless Chromium boots the source tree on a
// fresh profile, takes Quick start (seed pinned), skips the opening and enters
// the first fight on the map. Every input is a CDP mouse click at the control's
// own coordinates. The page records, on its own clock (performance.now), every
// capturing `pointerup` and every `.float-num` element added to the document;
// a play's latency is the last pointerup before the card resolved to the first
// damage/protection float after it. Counter preparation counts its protection;
// a later return cannot count as an immediate hit. It plays up to PLAYS cards (ending the turn
// when no attack is affordable) and judges the median against BUDGET_MS.
//
//   node tools/click-impact-probe.mjs                 (judge the median)
//   node tools/click-impact-probe.mjs --plays 6 --seed 3
//   CHROME=/path/to/chrome node tools/click-impact-probe.mjs
//
// Exit 0 when the median is within budget, 1 when it is not or the drive
// fails, 2 when no browser or no play was measured (never a pass).

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { pointerTargetExpression } from './pointer-target.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BROWSERS = [
  process.env.CHROME,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// docs/FINISH.md §5: the acceptance number, not a game setting.
const BUDGET_MS = 400;
const args = process.argv.slice(2);
const argOf = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const PLAYS = Number(argOf('--plays') || 5);
const SEED = Number(argOf('--seed') || 1);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connectCdp(wsUrl, pageErrors = []) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
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

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

async function main() {
  if (!browserPath) { console.error('click-impact-probe: no Chrome/Chromium found — pass --browser PATH or set $CHROME'); process.exit(2); }
  const { server, port } = await serve({ root: ROOT, port: 8251, open: false });
  const base = `http://localhost:${port}/`;
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'clickimpact-', browser: browserPath,
    args: ['--window-size=1440,860', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'],
    timeoutMs: 12000,
  });
  const pageErrors = [];
  let lastPicked = null;
  const cdp = connectCdp(wsUrl, pageErrors);
  await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S);
  await cdp.send('Runtime.enable', {}, S);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, S);

  const evalIn = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page threw');
    return r.result.value;
  };
  const until = async (expr, label, timeoutMs = 20000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      if (await evalIn(expr)) return true;
      await wait(100);
    }
    throw new Error(`timeout: ${label}`);
  };
  const clickAt = async (x, y) => {
    for (const type of ['mousePressed', 'mouseReleased']) {
      await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, S);
    }
  };
  const click = async (sel, label, settle = true) => {
    const pt = await evalIn(`(() => {
      const e = document.querySelector(${JSON.stringify(sel)});
      if (!e) return null;
      const r = e.getBoundingClientRect();
      const { x, y } = e.matches('.combatant, .hand .card') ? ${pointerTargetExpression(sel)}
        : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      return { x, y, hit: document.elementFromPoint(x, y)?.outerHTML.slice(0, 180) };
    })()`);
    if (!pt) throw new Error(`no element for ${label} (${sel})`);
    if (args.includes('--debug')) console.log('    input', label, sel, JSON.stringify(pt));
    await clickAt(pt.x, pt.y);
    if (settle) await wait(300);
  };

  try {
    await cdp.send('Page.navigate', { url: base }, S);
    await until(`document.readyState === 'complete'`, 'the page');
    await evalIn(`(() => { localStorage.clear(); return true; })()`);
    await cdp.send('Page.navigate', { url: base }, S);
    await until(`!!(document.querySelector('.startup-gate') || document.querySelector('.title-menu [data-title-action="quick-start"]'))`, 'the startup gate or the title');
    if (await evalIn(`!!document.querySelector('.startup-gate')`)) {
      for (const type of ['keyDown', 'keyUp']) await cdp.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 }, S);
    }
    await until(`!!document.querySelector('.title-menu [data-title-action="quick-start"]:not([disabled])')`, 'Quick start');
    await wait(300);
    // Pin the seed exactly as tools/quick-start-inputs.mjs does.
    await evalIn(`(() => { const real = Math.random; Math.random = () => { Math.random = real; return (${SEED} + 0.5) / 0xffffffff; }; return true; })()`);
    await click('.title-menu [data-title-action="quick-start"]', 'Quick start');
    await until(`!!(document.querySelector('.prologue-screen') || document.querySelector('.class-mastery-node') || document.querySelector('.map-node.reachable'))`, 'the opening, class tree or map');
    if (await evalIn(`!!document.querySelector('.prologue-screen')`)) {
      await evalIn(`(() => { const b = [...document.querySelectorAll('.prologue-screen .prologue-controls button')].find((c) => !c.hidden && /skip/i.test(c.textContent)); if (b) b.dataset.ciSkip = 'true'; return !!b; })()`);
      await click('[data-ci-skip="true"]', 'Skip opening');
    }
    if (await evalIn(`!!document.querySelector('.class-mastery-node')`)) await click('.class-mastery-node', 'a tier 1 class-tree node');
    await until(`!!document.querySelector('.map-node.monster.reachable')`, 'a reachable fight');
    await click('.map-node.monster.reachable', 'a fight');
    for (let guard = 0; guard < 12 && !(await evalIn(`!!window.__combat && !!document.querySelector('.hand .card')`)); guard += 1) {
      const confirm = await evalIn(`(() => { const b = document.querySelector('.confirmation-modal .confirmation-confirm, .map-tray [data-map-action="enter"]:not([disabled]), .map-enter:not([disabled])'); if (!b) return false; b.dataset.ciConfirm = 'true'; return true; })()`);
      if (confirm) await click('[data-ci-confirm="true"]', 'confirm the fight');
      else await wait(500);
    }
    await until(`!!window.__combat && !!document.querySelector('.hand .card')`, 'the first fight');
    await wait(1500);

    // The page's own clock: pointer releases and visible damage/protection.
    // Dedicated Poise/Ward payloads can update a bar without a damage float.
    await evalIn(`(() => {
      const meters = () => JSON.stringify([...document.querySelectorAll('.combatant [data-res=poise], .combatant [data-res=ward]')].map(e => [e.closest('[data-eid]')?.dataset.eid, e.dataset.res, e.dataset.cur, e.dataset.max]));
      window.__impact = { ups: [], floats: [], meterState: meters(), measureMeters: false };
      addEventListener('pointerup', () => window.__impact.ups.push(performance.now()), { capture: true });
      new MutationObserver((list) => {
        const t = performance.now();
        for (const m of list) for (const n of m.addedNodes || []) {
          if (n.nodeType === 1 && n.classList.contains('float-num') && /\\bdmg\\b|\\bblk\\b/.test(n.className)) window.__impact.floats.push(t);
        }
        const nextMeters = meters();
        if (window.__impact.measureMeters && nextMeters !== window.__impact.meterState) window.__impact.floats.push(t);
        window.__impact.meterState = nextMeters;
      }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-cur', 'data-max'] });
      return true;
    })()`);

    const played = () => evalIn(`window.__combat?.player?.counters?.cardsPlayedThisCombat || 0`);
    const idle = `!!window.__combat && window.__combat.result == null && window.__combat.phase === 'player' && !!document.querySelector('.hand .card') && !document.querySelector('.combat .end-turn')?.disabled`;
    const samples = [];
    for (let guard = 0; samples.length < PLAYS && guard < PLAYS * 4; guard += 1) {
      if (await evalIn(`!window.__combat || window.__combat.result != null`)) break;
      await until(idle, 'an idle hand', 15000);
      await wait(400);
      const picked = await evalIn(`(async () => {
        const { resolveCombatCard } = await import('/src/engine/combatExpansion.js');
        const { hasImmediateCombatImpact } = await import('/tools/click-impact-card.mjs');
        const { immediateCardEffects } = await import('/src/model/cardTargets.js');
        const combat = window.__combat;
        const hand = [...document.querySelectorAll('.hand .card')];
        hand.forEach((c) => delete c.dataset.ciCard);
        const pick = hand.find(c => {
          if (c.classList.contains('unaffordable')) return false;
          const inst = combat.piles.hand.find(card => card.instanceId === c.dataset.instanceId);
          return inst && hasImmediateCombatImpact(resolveCombatCard(combat, inst));
        });
        if (!pick) return false;
        pick.dataset.ciCard = 'true';
        return { cardId: pick.dataset.cardId, instanceId: pick.dataset.instanceId,
          maneuver: pick.dataset.combatManeuver,
          meterImpact: immediateCardEffects(resolveCombatCard(combat, combat.piles.hand.find(card => card.instanceId === pick.dataset.instanceId))).some(effect => ['poiseDamage', 'wardDamage'].includes(effect.op)) };
      })()`);
      lastPicked = picked;
      if (args.includes('--debug')) console.log('    picked', JSON.stringify(picked));
      if (!picked) {
        // A selected card consumes the first End Turn hold by cancelling its
        // targeting state. Mirror full-run-probe's bounded retry instead of
        // burning every sampling attempt on that same unchanged hand.
        const turn = await evalIn(`window.__combat.turn`);
        for (let attempt = 0; attempt < 3 && await evalIn(`window.__combat?.turn === ${turn} && window.__combat?.phase === 'player'`); attempt += 1) {
          const pt = await evalIn(`(() => { const el = document.querySelector('.combat .end-turn'); const r = el?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, hold: Number(el.dataset.holdMs) || 600 } : null; })()`);
          if (!pt) throw new Error('no End Turn');
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y }, S);
          await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, S);
          await wait(pt.hold + 250);
          await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 }, S);
          const transitionEnd = Date.now() + 4000;
          while (Date.now() < transitionEnd) {
            if (await evalIn(`window.__combat?.result != null || window.__combat?.turn > ${turn} || window.__combat?.phase !== 'player'`)) break;
            await wait(100);
          }
        }
        await until(`window.__combat?.result != null || window.__combat?.turn > ${turn}`, `turn ${turn + 1} or the fight's end`, 10000);
        continue;
      }
      const before = await played();
      const mark = await evalIn(`(() => { window.__impact.measureMeters = ${!!picked.meterImpact}; return performance.now(); })()`);
      // Park the pointer off the hand so a hover lift or tooltip from the last
      // play does not cover the next card.
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700, y: 120 }, S);
      await wait(250);
      await click('[data-ci-card="true"]', 'an immediate-impact card', false);
      const t0 = Date.now();
      while (Date.now() - t0 < 3000 && (await played()) === before) {
        if (await evalIn(`!!document.querySelector('.enemy-target-picker:not([hidden]) .enemy-target-button:not([disabled])')`)) { await click('.enemy-target-picker:not([hidden]) .enemy-target-button:not([disabled])', 'its legal enemy target', false); break; }
        if (await evalIn(`!!document.querySelector('.combatant.enemy.targetable')`)) { await click('.combatant.enemy.targetable', 'its legal battlefield enemy', false); break; }
        if (await evalIn(`!!document.querySelector('.combatant.player.targetable, .combatant.player.armed')`)) { await click('.combatant.player.targetable, .combatant.player.armed', 'its legal source target', false); break; }
        await wait(30);
      }
      await until(`(window.__combat?.player?.counters?.cardsPlayedThisCombat || 0) > ${before}`, 'the card to resolve', 5000);
      await until(`window.__impact.floats.some((t) => t > ${mark})`, 'a visible damage, protection or Poise/Ward impact', 5000).catch(() => null);
      const sample = await evalIn(`(() => {
        const f = window.__impact.floats.find((t) => t > ${mark});
        if (f == null) return null;
        const up = window.__impact.ups.filter((t) => t > ${mark} && t < f).pop();
        return up == null ? null : Math.round(f - up);
      })()`);
      if (sample != null) { samples.push(sample); console.log(`    play ${samples.length}: ${sample} ms (${picked.cardId}${picked.maneuver === 'counter' ? ', Counter protection' : ''})`); }
    }
    // A median over fewer than three plays says too little to judge.
    if (samples.length < 3) { console.error(`click-impact-probe: only ${samples.length} play(s) measured; need 3`); process.exitCode = 2; return; }
    const m = median(samples);
    const okay = m <= BUDGET_MS;
    console.log(`  ${okay ? '✓' : '✗'} median click-to-impact ${m} ms over ${samples.length} plays (budget ${BUDGET_MS} ms; samples ${samples.join(', ')})`);
    console.log(`${okay ? 1 : 0} passed, ${okay ? 0 : 1} failed`);
    console.log('  boundary: real Chromium headless, 1440x900, Normal pacing, the Quick start class and seed, mouse clicks only.');
    console.log('  Not checked: touch input, slow or fast pacing, phone layouts, or classes other than the Quick start one.');
    process.exitCode = okay ? 0 : 1;
  } catch (e) {
    console.error(`click-impact-probe: ${e.message}`);
    console.error('last picked card:', JSON.stringify(lastPicked));
    if (pageErrors.length) console.error('page errors:', pageErrors.join('\n'));
    console.error('target state:', JSON.stringify(await evalIn(`({
      selected: document.querySelector('.hand .card.selected')?.dataset.cardId,
      armed: document.querySelector('.hand .card.armed')?.dataset.cardId,
      targetableEnemies: [...document.querySelectorAll('.enemy.targetable')].map(e => e.dataset.eid),
      targetablePlayer: !!document.querySelector('.player.targetable'),
      cardsPlayed: window.__combat?.player?.counters?.cardsPlayedThisCombat,
      phase: window.__combat?.phase, player: { energy: window.__combat?.player?.energy, stamina: window.__combat?.player?.stamina, mana: window.__combat?.player?.mana, statuses: window.__combat?.player?.statuses },
      modal: document.querySelector(".card-choice, .confirmation-modal")?.innerText,
      body: document.body.innerText.slice(-2500),
    })`).catch(() => null)));
    process.exitCode = 1;
  } finally {
    cdp.close();
    await dropBrowser();
    server.close();
  }
}

main();
