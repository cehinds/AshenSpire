#!/usr/bin/env node
// The in-run Load door, driven in the real page (SPEC §3.12, §9 M2).
//
// Two claims, both through src/main.js's own door — the Quick Menu's Load row
// → loadActiveSlot → confirmSlotLoad → resumeRun — never a copy of it:
//
//   NEWER   Loading a slot a newer build wrote, mid-run, is refused up front:
//           the newer-save notice opens and the live run is still standing.
//           It used to close the menu and call resumeRun, whose loadRun is
//           null for a newer slot, so the climb in hand was dropped and the
//           player landed on the title. The confirm press checks again: a
//           newer build in another tab can rewrite the slot while the
//           confirmation is open (NEWER-AT-CONFIRM).
//   RESTART Abandoning a fight mid-combat (no Save Game) and loading the slot
//           restarts that fight from its entry receipt: turn 1, the same HP,
//           the same opening hand, an unchanged deck. tests/midcombat-reload
//           proves the same property against a hand-copied mirror of
//           enterCombat; this is the production load door itself.
//
// The boot is `?shot=combat` — newRun and the first monster node entered the
// way the map enters it, so the entry receipt is written by enterCombat's own
// persist. `?shotNewerSlot=2` puts slot 1's bytes into slot 2 with the schema
// one ahead. Both run on the shot boot's memory storage.

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
const browserPath = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((candidate) => candidate && existsSync(candidate));

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  const code = await doorSelftest({
    tool: 'slot-load-door.mjs',
    timeoutMs: 120000,
    plants: [
      {
        name: 'the in-run Load door stops refusing a newer slot up front',
        file: 'src/main.js',
        find: '  if (saves.slotSummary(slot)?.newer) return openNewerSaveNotice({ slot, returnFocusElement });',
        replace: '  // slot-load-door selftest plant',
        expectRed: /RED SLOT-LOAD-NEWER-KEEPS-RUN/,
      },
      {
        name: 'the confirm press stops rechecking for a newer slot',
        file: 'src/main.js',
        find: '      if (saves.slotSummary(slot)?.newer) return openNewerSaveNotice({ slot, returnFocusElement });',
        replace: '      // slot-load-door selftest plant',
        expectRed: /RED SLOT-LOAD-NEWER-AT-CONFIRM/,
      },
      {
        name: 'combat entry stops writing its receipt',
        file: 'src/main.js',
        find: '  if (!resuming) persist();',
        replace: '  // slot-load-door selftest plant',
        expectRed: /RED SLOT-LOAD-MIDCOMBAT-RESTART/,
      },
      {
        name: 'resume restarts the fight from a fresh draw',
        file: 'src/main.js',
        find: '  rng = createRng(run.seed, run.streamCounters);',
        replace: '  rng = createRng(run.seed ^ 1, run.streamCounters); // slot-load-door selftest plant',
        expectRed: /RED SLOT-LOAD-MIDCOMBAT-RESTART/,
      },
    ],
  });
  process.exit(code);
}

function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id == null || !pending.has(message.id)) return;
    const { yes, no } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? no(new Error(message.error.message)) : yes(message.result);
  };
  return {
    ready: new Promise((yes, no) => { socket.onopen = yes; socket.onerror = no; }),
    send(method, params = {}, sessionId) {
      const id = ++nextId;
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      return new Promise((yes, no) => pending.set(id, { yes, no }));
    },
    close() { socket.close(); },
  };
}

let failures = 0;
let checks = 0;
function check(ok, code, detail) {
  checks += 1;
  if (ok) console.log(`PASS ${code} - ${detail}`);
  else { failures += 1; console.error(`RED ${code} - ${detail}`); }
}

// A missing instrument measures nothing: exit 2 (unknown), never 1 (a check
// ran and failed) — .github/actions/which-browser and tools/verdict.mjs.
if (!browserPath) {
  console.error('UNKNOWN slot-load-door - no supported Chrome or Edge binary found; set CHROME.');
  process.exit(2);
}

let server;
let cdp;
let closeBrowser = async () => {};
// Until the fight has booted nothing has been measured, so a harness death
// before then (serve, launch, the combat boot) is unknown, not red.
let measuring = false;
try {
  // Port 0: the OS picks a free one, so this never collides with another tool.
  const served = await serve({ root: ROOT, port: 0, open: false });
  server = served.server;
  const port = server.address().port;
  const launched = await launchBrowser({ prefix: 'slot-load-door-', browser: browserPath, headless: '--headless=new', timeoutMs: 20000 });
  closeBrowser = launched.close;
  cdp = connectCdp(launched.wsUrl);
  await cdp.ready;

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 730, deviceScaleFactor: 1, mobile: false }, sessionId);

  const ev = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluation failed');
    return result.result.value;
  };
  const until = async (expression, waitingFor, timeout = 20000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await ev(expression).catch(() => false)) return true;
      await wait(70);
    }
    throw new Error(`timeout waiting for ${waitingFor}`);
  };
  const click = async (selector) => {
    const point = await ev(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e)return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
    if (!point) throw new Error(`missing ${selector}`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 }, sessionId);
    await wait(180);
  };
  // The combat as the page holds it, plus the run's deck live and in the slot.
  const pose = () => ev(`(() => {
    const c = window.__combat;
    const ids = (pile) => (c.piles[pile] || []).map((card) => card.instanceId);
    const spoils = window.__spoils();
    return {
      turn: c.turn, phase: c.phase, playerHp: c.player.hp,
      hand: ids('hand'),
      cards: ['draw', 'hand', 'discard', 'exhaust'].flatMap(ids).sort(),
      enemies: c.enemies.map((e) => ({ id: e.enemyId, hp: e.hp })),
      liveDeck: spoils.liveDeck, savedDeck: spoils.savedDeck,
    };
  })()`);
  // Quick Menu → Load → the slot (two taps: select, then open).
  const openLoadSlot = async (slot) => {
    await click('#combat-menu');
    await until(`!!document.querySelector('.qn-row[data-act="load"]')`, 'the Quick Menu Load row');
    await click('.qn-row[data-act="load"]');
    await until(`!!document.querySelector('[data-slot-pick="${slot}"].is-filled')`, `occupied slot ${slot}`);
    await click(`[data-slot-pick="${slot}"]`);
    await click(`[data-slot-pick="${slot}"]`);
    // The confirmation's input shield (CONFIRMATION_INPUT_SHIELD_MS).
    await wait(750);
  };
  const confirmIfAsked = async () => {
    if (await ev(`(() => { const b=document.querySelector('.confirmation-confirm'); return !!b && !b.hidden; })()`)) {
      await click('.confirmation-confirm');
      await wait(300);
    }
  };

  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/?shot=combat&shotNewerSlot=2` }, sessionId);
  await until(`!!window.__combat && !!document.querySelector('.end-turn') && window.__combat.phase === 'player'`, 'combat boot');
  measuring = true;
  const opening = await pose();
  check(opening.turn === 1 && opening.hand.length > 0, 'SLOT-LOAD-OPENING',
    `the fight opens on turn ${opening.turn} with ${opening.hand.length} cards at HP ${opening.playerHp}`);

  // ---- NEWER: refused up front, the run survives -------------------------
  // Marks this fight's combat object, so RESTART can wait for a new one.
  await ev('window.__combat.__slotLoadProbe = true');
  try {
    await openLoadSlot(2);
    const notice = await ev(`document.querySelector('#confirmation-modal-title')?.textContent || ''`);
    // The player's next move on whatever opened: press its way forward if it has one.
    await confirmIfAsked();
    // The live run itself: __spoils reads main.js's `run`, which is null
    // (an empty deck here) once resumeRun has dropped it. window.__combat
    // outlives that drop, so it is no witness on its own.
    const after = await ev(`({
      board: !!document.querySelector('.end-turn'),
      title: !!document.querySelector('.title-menu, [data-title-action="load"]'),
      liveDeck: window.__spoils().liveDeck || [],
    })`);
    const keptDeck = JSON.stringify(after.liveDeck) === JSON.stringify(opening.liveDeck) && after.liveDeck.length > 0;
    check(/newer version/i.test(notice), 'SLOT-LOAD-NEWER-NOTICE', `the newer-save notice opens (${JSON.stringify(notice)})`);
    check(keptDeck && after.board && !after.title, 'SLOT-LOAD-NEWER-KEEPS-RUN',
      `the live run and its fight are still standing and the title never mounted (${JSON.stringify({ ...after, liveDeck: after.liveDeck.length, keptDeck })})`);
  } catch (error) {
    check(false, 'SLOT-LOAD-NEWER-KEEPS-RUN', error.message);
  }
  if (!(await ev(`!!window.__combat && !!document.querySelector('.end-turn')`))) {
    throw new Error('the fight did not survive the newer-slot load; RESTART cannot run');
  }
  await ev(`document.querySelector('.confirmation-cancel')?.click()`);
  await until(`!document.querySelector('.confirmation-veil')`, 'the notice to close');

  // ---- RESTART: abandon mid-combat, load slot 1 ---------------------------
  try {
    const veils = await ev(`[...document.querySelectorAll('.modal-veil, .quick-nav-veil')].map((v) => v.className)`);
    if (veils.length) throw new Error(`a veil is still over the board after the notice closed: ${JSON.stringify(veils)}`);
    // Play an attack on the first living enemy before ending the turn, so
    // enemy HP and the piles differ at the abandon point: the enemies and
    // cards checks below then catch a reload that skipped the reset, the way
    // the HP and hand checks already do.
    const struck = await ev(`window.__combat.enemies.map((e) => e.hp)`);
    const hand = await ev(`window.__combat.piles.hand.map((card) => card.instanceId)`);
    let played = null;
    for (const instanceId of hand) {
      await click(`.hand .card[data-instance-id=${JSON.stringify(instanceId)}]`);
      const target = await ev(`(() => { const e=document.querySelector('.enemy.targetable:not(.dead)'); return !!e; })()`);
      if (!target) { await ev(`document.querySelector('.hand .card.selected')?.click()`); await wait(180); continue; }
      await click('.enemy.targetable:not(.dead)');
      await until(`!window.__fx || window.__fx.open === window.__fx.finished`, 'the attack to settle');
      await wait(300);
      if (JSON.stringify(await ev(`window.__combat.enemies.map((e) => e.hp)`)) !== JSON.stringify(struck)) { played = instanceId; break; }
    }
    if (!played) throw new Error(`no card in the opening hand [${hand}] struck an enemy`);
    await click('.end-turn');
    // End Turn is a held beat; a tap asks first. Answer the way forward.
    await wait(750);
    await confirmIfAsked();
    await until(`window.__combat.turn > 1 && window.__combat.phase === 'player'`, 'the next player turn')
      .catch(async (error) => { throw new Error(`${error.message} (${JSON.stringify(await ev(`({ turn: window.__combat.turn, phase: window.__combat.phase, endTurn: document.querySelector('.end-turn')?.outerHTML.slice(0, 200), active: document.activeElement?.className, top: (() => { const r=document.querySelector('.end-turn').getBoundingClientRect(); return document.elementFromPoint(r.left+r.width/2, r.top+r.height/2)?.className; })() })`))})`); });
    await until(`!window.__fx || window.__fx.open === window.__fx.finished`, 'combat timeline settlement');
    await until(`!document.querySelector('.modal-veil, .quick-nav-veil')`, 'a clear board');
    await wait(300);
    const abandoned = await pose();
    const moved = abandoned.turn > 1 && JSON.stringify(abandoned.enemies) !== JSON.stringify(opening.enemies);
    check(moved, 'SLOT-LOAD-MIDCOMBAT-POSE',
      `the fight moved on to turn ${abandoned.turn} after ${played} struck (enemies ${JSON.stringify(opening.enemies.map((e) => e.hp))} -> ${JSON.stringify(abandoned.enemies.map((e) => e.hp))}, hand ${abandoned.hand.join(',')})`);
    await openLoadSlot(1);
    await confirmIfAsked();
    await until(`!!window.__combat && !window.__combat.__slotLoadProbe && !!document.querySelector('.end-turn') && window.__combat.phase === 'player'`, 'the reloaded fight');
    const reloaded = await pose();
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const problems = [];
    if (reloaded.turn !== 1) problems.push(`turn ${reloaded.turn}`);
    if (reloaded.playerHp !== opening.playerHp) problems.push(`HP ${reloaded.playerHp} vs ${opening.playerHp}`);
    if (!same(reloaded.hand, opening.hand)) problems.push(`hand [${reloaded.hand}] vs [${opening.hand}]`);
    if (!same(reloaded.cards, opening.cards)) problems.push('the fight holds different cards');
    if (!same(reloaded.enemies, opening.enemies)) problems.push(`enemies ${JSON.stringify(reloaded.enemies)} vs ${JSON.stringify(opening.enemies)}`);
    if (!same(reloaded.liveDeck, opening.liveDeck) || !same(reloaded.savedDeck, opening.savedDeck)) problems.push('the deck changed');
    check(problems.length === 0, 'SLOT-LOAD-MIDCOMBAT-RESTART',
      problems.length ? problems.join('; ') : `turn 1, HP ${reloaded.playerHp}, the same ${reloaded.hand.length}-card opening hand, deck of ${reloaded.liveDeck.length} unchanged`);
  } catch (error) {
    check(false, 'SLOT-LOAD-MIDCOMBAT-RESTART', error.message);
  }

  // ---- RACE: the slot turns newer while the confirmation is open ---------
  // Run saves share localStorage across tabs, and the confirmation can stay
  // open indefinitely: a newer build in another tab can rewrite the slot
  // after the up-front check passed. The confirm press must check again.
  try {
    await until(`!document.querySelector('.modal-veil, .quick-nav-veil, .confirmation-veil')`, 'a clear board');
    await openLoadSlot(1);
    const asked = await ev(`(() => { const b=document.querySelector('.confirmation-confirm'); return !!b && !b.hidden; })()`);
    if (!asked) throw new Error('slot 1 opened no load confirmation');
    await ev('window.__shotAgeSlot(1)');
    await click('.confirmation-confirm');
    await wait(300);
    const notice = await ev(`document.querySelector('#confirmation-modal-title')?.textContent || ''`);
    const after = await ev(`({
      board: !!document.querySelector('.end-turn'),
      title: !!document.querySelector('.title-menu, [data-title-action="load"]'),
      liveDeck: window.__spoils().liveDeck || [],
    })`);
    const kept = after.liveDeck.length > 0 && after.board && !after.title;
    check(/newer version/i.test(notice) && kept, 'SLOT-LOAD-NEWER-AT-CONFIRM',
      `a slot aged behind the open confirmation is refused at the press and the run stands (${JSON.stringify({ notice, ...after, liveDeck: after.liveDeck.length })})`);
  } catch (error) {
    check(false, 'SLOT-LOAD-NEWER-AT-CONFIRM', error.message);
  }
  await cdp.send('Target.closeTarget', { targetId });
} catch (error) {
  if (measuring) {
    failures += 1;
    console.error(`RED SLOT-LOAD-DOOR - ${error.stack || error.message}`);
  } else {
    console.error(`UNKNOWN slot-load-door - the harness died before anything was measured: ${error.stack || error.message}`);
    process.exitCode = 2;
  }
} finally {
  try { cdp?.close(); } catch { /* best effort socket close */ }
  try { await closeBrowser(); } catch (error) { console.error(`BROWSER CLEANUP WARNING ${error.message}`); }
  if (server) await new Promise((done) => server.close(done));
}

console.log(`slot-load-door: ${checks - failures}/${checks} checks passed; ${failures} failed`);
process.exit(process.exitCode === 2 ? 2 : failures ? 1 : 0);
