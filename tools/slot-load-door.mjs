#!/usr/bin/env node
// The in-run Load door, driven in the real page (SPEC §3.12, §9 M2).
//
// These claims run through src/main.js's own door — the Quick Menu's Load row
// → loadActiveSlot → confirmSlotLoad → resumeRun — never a copy of it:
//
//   NEWER   Loading a slot a newer build wrote, mid-run, is refused up front:
//           the newer-save notice opens and the live run is still standing.
//           It used to close the menu and call resumeRun, whose loadRun is
//           null for a newer slot, so the climb in hand was dropped and the
//           player landed on the title. The confirm press refuses too: a
//           newer build in another tab can rewrite the slot while the
//           confirmation is open (NEWER-AT-CONFIRM).
//   REFUSED A slot the picker can read but loadRun refuses (content
//           validation, migration, a slot another tab cleared) passes both
//           newer checks, so the refusal is only known after the confirm.
//           resumeRun swaps the live run only after a successful load, so
//           the climb in hand stands and a notice says the slot could not
//           open (REFUSED-KEEPS-RUN). `?shotRefusedSlot=3` plants it.
//   RESTART Abandoning a legacy fight mid-combat and loading the slot
//           restarts that fight from its entry receipt: turn 1, the same HP,
//           the same opening hand, RNG seed/counters, an unchanged deck. tests/midcombat-reload
//           proves the same legacy property against a hand-copied mirror of
//           enterCombat; this is the production load door itself.
//   SNAPSHOT Expanded combat retains explicit Save Game checkpoints. Its
//           default-version fixture first reloads its opening checkpoint
//           after an ordinary turn. It then saves a later turn, advances an
//           unsaved turn, and loads the exact checkpoint: resources, piles,
//           enemies, RNG seed and random-stream counters.
//   OVERLAY-FOCUS  The same refused load, launched from the in-run
//           overlay's quick navigation instead of the combat ☰ menu: the
//           overlay stays open until resumeRun knows the outcome, so "Keep
//           playing" returns focus to the launcher (#ov-quicknav / #ov-switch)
//           rather than <body> (#1355). tests/slot-load-focus pins the order
//           in source; this is the focus a player actually lands on.
//
// The boot is `?shot=combat` — newRun and the first monster node entered the
// way the map enters it, so the entry receipt is written by enterCombat's own
// persist. `?shotNewerSlot=2` puts slot 1's bytes into slot 2 with the schema
// one ahead. Both run on the shot boot's memory storage.

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pointerTargetExpression } from './pointer-target.mjs';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
// Local source-file I/O may need a longer cold-document boot allowance.
// CI keeps its existing limit; interactive actions keep their own limit.
const bootTimeout = Number(process.env.SLOT_LOAD_BOOT_TIMEOUT_MS || 20000);
if (!Number.isFinite(bootTimeout) || bootTimeout < 20000 || bootTimeout > 300000) {
  throw new Error('SLOT_LOAD_BOOT_TIMEOUT_MS must be between 20000 and 300000');
}
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
        // The press-time recheck still keeps the run; what goes is the
        // up-front refusal — the player is asked to load a slot that can't.
        expectRed: /RED SLOT-LOAD-NEWER-NOTICE/,
      },
      {
        name: 'the confirm press stops naming a newer slot as newer',
        file: 'src/main.js',
        find: "        onRefused: () => (saves.runStatus().state === 'newer'",
        replace: "        onRefused: () => (false // slot-load-door selftest plant",
        expectRed: /RED SLOT-LOAD-NEWER-AT-CONFIRM/,
      },
      {
        name: 'resumeRun swaps the live run before the load succeeds',
        file: 'src/main.js',
        find: '  let loaded = saves.loadRun(authoredRegistries, slot);',
        replace: '  let loaded = run = saves.loadRun(authoredRegistries, slot); // slot-load-door selftest plant',
        expectRed: /RED SLOT-LOAD-REFUSED-KEEPS-RUN/,
      },
      {
        name: 'the load confirmation closes the overlay before the load outcome',
        file: 'src/main.js',
        find: '        onLoaded: closeOverlay,',
        replace: '        onLoaded: closeOverlay, ...(closeOverlay(), {}), // slot-load-door selftest plant',
        // The #1355 regression: the launcher inside the overlay is gone before
        // the refusal, so "Keep playing" has nowhere to return focus.
        expectRed: /RED SLOT-LOAD-OVERLAY-FOCUS/,
      },
      {
        name: 'combat entry stops writing its receipt',
        // The original deletion is now protected by the v2 durable opening
        // checkpoint. Omit BOTH saves to plant the same missing-entry defect;
        // the old deletion alone no longer produces an observed regression.
        edits: [
          { file: 'src/main.js', find: '  if (!resuming) persist();',
            replace: '  // slot-load-door selftest plant' },
          { file: 'src/main.js', find: '      durable(combat);',
            replace: '      // slot-load-door selftest plant: omit the v2 entry checkpoint too' },
        ],
        expectRed: /RED SLOT-LOAD-MIDCOMBAT-RESTART/,
      },
      {
        name: 'expanded combat entry stops writing its opening checkpoint',
        file: 'src/main.js',
        find: '      durable(combat);',
        replace: '      // slot-load-door selftest plant: omit the expanded entry checkpoint',
        expectRed: /RED SLOT-LOAD-EXPANDED-ENTRY/,
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
  if (code === 0) console.log('slot-load-door --selftest: OK — 7/7 known-bads observed red');
  process.exit(code);
}

function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  const exceptions = [];
  const loading = new Map();
  const networkFailures = [];
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') {
      const detail = message.params?.exceptionDetails;
      exceptions.push(detail?.exception?.description || detail?.text || 'unknown page exception');
    }
    if (message.method === 'Network.requestWillBeSent') loading.set(message.params.requestId, message.params.request.url);
    if (message.method === 'Network.loadingFinished') loading.delete(message.params.requestId);
    if (message.method === 'Network.loadingFailed') {
      networkFailures.push({ url: loading.get(message.params.requestId), error: message.params.errorText });
      loading.delete(message.params.requestId);
    }
    if (message.id == null || !pending.has(message.id)) return;
    const { yes, no } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? no(new Error(message.error.message)) : yes(message.result);
  };
  return {
    exceptions,
    loading,
    networkFailures,
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
  const sourceUrl = `http://127.0.0.1:${server.address().port}/`;
  const launched = await launchBrowser({ prefix: 'slot-load-door-', browser: browserPath, headless: '--headless=new', timeoutMs: 20000 });
  closeBrowser = launched.close;
  cdp = connectCdp(launched.wsUrl);
  await cdp.ready;

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 730, deviceScaleFactor: 1, mobile: false }, sessionId);
  await cdp.send('Page.bringToFront', {}, sessionId);

  const ev = async (expression) => {
    const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluation failed');
    return result.result.value;
  };
  const until = async (expression, waitingFor, timeout = 20000, onWait = null) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await ev(expression).catch(() => false)) return true;
      await onWait?.();
      await wait(70);
    }
    const pageState = await ev(`({ url: location.href, ready: document.readyState, combat: !!window.__combat, text: document.body?.innerText?.slice(0, 800) })`).catch((error) => ({ unavailable: error.message }));
    throw new Error(`timeout waiting for ${waitingFor}; page=${JSON.stringify(pageState)}; exceptions=${JSON.stringify(cdp.exceptions)}; loading=${JSON.stringify([...cdp.loading.values()].slice(0, 12))}; networkFailures=${JSON.stringify(cdp.networkFailures.slice(-12))}`);
  };
  const click = async (selector) => {
    const point = await ev(pointerTargetExpression(selector));
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
      rng: { seed: c.rng.seed, counters: c.rng.getCounters() },
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
    // The row may already have opened its door through the supported hold
    // shortcut if delivery of the pointer release was delayed. Only a row
    // that still owns input needs the second selection tap. The callers below
    // still require the exact notice or confirmation and the preserved run.
    if (await ev(`!!document.querySelector('[data-slot-pick="${slot}"]')`)) {
      await click(`[data-slot-pick="${slot}"]`);
    }
    // The confirmation's input shield (CONFIRMATION_INPUT_SHIELD_MS).
    await wait(750);
  };
  const confirmIfAsked = async () => {
    if (await ev(`(() => { const b=document.querySelector('.confirmation-confirm'); return !!b && !b.hidden; })()`)) {
      await click('.confirmation-confirm');
      await wait(300);
    }
  };
  const advanceTurn = async () => {
    const turn = await ev('window.__combat.turn');
    await click('.end-turn');
    await wait(750);
    await confirmIfAsked();
    await until(`window.__combat.turn > ${turn} && window.__combat.phase === 'player'`, 'the next player turn', 20000, async () => {
      // Knowledge-enabled fights offer defensive reactions during the enemy
      // turn. Decline through the real Back control so this save/load probe
      // advances normally without spending a reaction or bypassing its rules.
      const decline = '.reaction-choice [data-control-role="exit"]';
      if (await ev(`!!document.querySelector(${JSON.stringify(decline)})`)) await click(decline);
    });
    await until(`!window.__fx || window.__fx.open === window.__fx.finished`, 'combat timeline settlement');
  };

  await cdp.send('Page.navigate', { url: `${sourceUrl}?shot=combat&shotCombatVersion=1&shotNewerSlot=2&shotRefusedSlot=3` }, sessionId);
  await until(`!!window.__combat && !!document.querySelector('.end-turn') && window.__combat.phase === 'player'`, 'combat boot', bootTimeout);
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

  // ---- REFUSED: a slot the picker can read but loadRun refuses -----------
  // Not newer, so both up-front checks pass and the player confirms. The
  // load itself is refused (content validation archives it); the live run
  // must still be standing, with a notice saying the slot could not open.
  try {
    await until(`!document.querySelector('.modal-veil, .quick-nav-veil, .confirmation-veil')`, 'a clear board');
    await openLoadSlot(3);
    const asked = await ev(`(() => { const b=document.querySelector('.confirmation-confirm'); return !!b && !b.hidden; })()`);
    if (!asked) throw new Error('slot 3 opened no load confirmation');
    await click('.confirmation-confirm');
    await wait(300);
    const notice = await ev(`document.querySelector('#confirmation-modal-title')?.textContent || ''`);
    const after = await ev(`({
      board: !!document.querySelector('.end-turn'),
      title: !!document.querySelector('.title-menu, [data-title-action="load"]'),
      liveDeck: window.__spoils().liveDeck || [],
    })`);
    const keptDeck = JSON.stringify(after.liveDeck) === JSON.stringify(opening.liveDeck) && after.liveDeck.length > 0;
    check(keptDeck && after.board && !after.title && /could not be loaded/i.test(notice), 'SLOT-LOAD-REFUSED-KEEPS-RUN',
      `a slot loadRun refuses leaves the live run and its fight standing, and says so (${JSON.stringify({ notice, ...after, liveDeck: after.liveDeck.length, keptDeck })})`);
  } catch (error) {
    check(false, 'SLOT-LOAD-REFUSED-KEEPS-RUN', error.message);
  }
  if (!(await ev(`!!window.__combat && !!document.querySelector('.end-turn')`))) {
    throw new Error('the fight did not survive the refused-slot load; RESTART cannot run');
  }
  await ev(`document.querySelector('.confirmation-cancel')?.click()`);
  await until(`!document.querySelector('.confirmation-veil')`, 'the refused notice to close');

  // ---- RESTART: abandon mid-combat, load slot 1 ---------------------------
  try {
    const veils = await ev(`[...document.querySelectorAll('.modal-veil, .quick-nav-veil')].map((v) => v.className)`);
    if (veils.length) throw new Error(`a veil is still over the board after the notice closed: ${JSON.stringify(veils)}`);
    // Play an attack on the first living enemy before ending the turn, so
    // enemy HP and the piles differ at the abandon point: the enemies and
    // cards checks below then catch a reload that skipped the reset, the way
    // the HP and hand checks already do.
    let played = null;
    // An expanded opener can contain only guards and deferred Counters. Read
    // effective effects (equipment instances can change the base card), then
    // draw naturally through the real End Turn door until an attack is in hand.
    // The entry receipt remains untouched, so the reload must still reproduce
    // the original opening hand, HP, enemies and deck exactly.
    for (let draw = 0; draw < 3 && !played; draw += 1) {
      const attacks = await ev(`(async () => {
        const { resolveCombatCard } = await import('/src/engine/combatExpansion.js');
        const { immediateCardEffects } = await import('/src/model/cardTargets.js');
        return window.__combat.piles.hand.filter(card => {
          const el = document.querySelector('.hand .card[data-instance-id="' + CSS.escape(card.instanceId) + '"]');
          return el && !el.classList.contains('unaffordable') && immediateCardEffects(resolveCombatCard(window.__combat, card))
            .some(effect => effect.op === 'damage' && ['enemy', 'allEnemies', 'randomEnemy'].includes(effect.target));
        }).map(card => card.instanceId);
      })()`);
      for (const instanceId of attacks) {
        const beforeAttack = await ev(`({ hp: window.__combat.enemies.map(e => e.hp), played: window.__combat.player.counters.cardsPlayedThisCombat || 0 })`);
        await click(`.hand .card[data-instance-id=${JSON.stringify(instanceId)}]`);
        const target = await ev(`(() => {
          if (document.querySelector('.enemy-target-picker:not([hidden]) .enemy-target-button:not([disabled])'))
            return '.enemy-target-picker:not([hidden]) .enemy-target-button:not([disabled])';
          return document.querySelector('.enemy.targetable:not(.dead)') ? '.enemy.targetable:not(.dead)' : null;
        })()`);
        if (target) await click(target);
        await until(`!window.__fx || window.__fx.open === window.__fx.finished`, 'the attack to settle');
        await wait(300);
        const afterAttack = await ev(`({ hp: window.__combat.enemies.map(e => e.hp), played: window.__combat.player.counters.cardsPlayedThisCombat || 0 })`);
        if (afterAttack.played > beforeAttack.played && afterAttack.hp.some((hp, i) => hp < beforeAttack.hp[i])) { played = instanceId; break; }
        if (afterAttack.played === beforeAttack.played) {
          // A targetless attempt must not leave an aim armed for End Turn.
          for (const type of ['keyDown', 'keyUp']) await cdp.send('Input.dispatchKeyEvent', {
            type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27,
          }, sessionId);
        }
      }
      if (!played && draw < 2) await advanceTurn();
    }
    if (!played) throw new Error('no affordable immediate attack struck an enemy within three natural hands');
    await advanceTurn();
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
    // A wrong seed can restore identical current geometry from a snapshot,
    // while changing the next random draw. Compare the full RNG receipt now.
    if (reloaded.rng.seed !== opening.rng.seed) problems.push(`RNG seed ${reloaded.rng.seed} vs ${opening.rng.seed}`);
    if (!same(reloaded.rng.counters, opening.rng.counters)) problems.push(`RNG counters ${JSON.stringify(reloaded.rng.counters)} vs ${JSON.stringify(opening.rng.counters)}`);
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

  // ---- OVERLAY-FOCUS: a refused load from the in-run overlay (#1355) -----
  // The steps above load through the combat ☰ menu with the overlay closed.
  // Opened from the overlay's own quick navigation, confirmSlotLoad's
  // returnFocusElement is the launcher inside the overlay, so the overlay must
  // stay open until resumeRun knows the outcome: closed first, the launcher is
  // disconnected and "Keep playing" leaves focus on <body>. A fresh boot, since
  // the REFUSED step's refusal archived slot 3.
  try {
    // This navigate starts from a live combat page, which already passes the
    // combat-ready check below. Mark the old document and wait for the new
    // one, or the step can read the old deck and click the old page.
    await ev('window.__staleDoc = 1');
    await cdp.send('Page.navigate', { url: `${sourceUrl}?shot=combat&shotRefusedSlot=3` }, sessionId);
    await until(`!window.__staleDoc && location.search.includes('shotRefusedSlot=3') && !location.search.includes('shotNewerSlot')`, 'the second document');
    await until(`!!window.__combat && !!document.querySelector('.end-turn') && window.__combat.phase === 'player'`, 'the second combat boot', bootTimeout);
    const openingDeck = await ev('window.__spoils().liveDeck || []');
    // Combat ☰ → the Settings row opens the in-run overlay.
    await click('#combat-menu');
    await until(`!!document.querySelector('.qn-row[data-act="tab"][data-tab="settings"]')`, 'the Quick Menu Settings row');
    await click('.qn-row[data-act="tab"][data-tab="settings"]');
    await until(`!!document.querySelector('#ov-quicknav:not([hidden]), #ov-switch:not([hidden])')`, 'the overlay quick-nav launcher');
    const launcher = await ev(`document.querySelector('#ov-quicknav:not([hidden]), #ov-switch:not([hidden])').id`);
    await ev(`window.__slotLoadLauncher = document.querySelector('#${launcher}')`);
    // The overlay's quick navigation → Load → slot 3 (select, then open).
    await click(`#${launcher}`);
    await until(`!!document.querySelector('.qn-row[data-act="load"]')`, 'the overlay quick-nav Load row');
    await click('.qn-row[data-act="load"]');
    await until(`!!document.querySelector('[data-slot-pick="3"].is-filled')`, 'occupied slot 3');
    await click('[data-slot-pick="3"]');
    await click('[data-slot-pick="3"]');
    await until(`(() => { const b=document.querySelector('.confirmation-confirm'); return !!b && !b.hidden; })()`, 'the load confirmation for slot 3 from the overlay');
    await click('.confirmation-confirm');
    await until(`/could not be loaded/i.test(document.querySelector('#confirmation-modal-title')?.textContent || '')`, 'the refused notice');
    // "Keep playing": the notice's only way on, pressed as a player would.
    await click('.confirmation-cancel');
    await until(`!document.querySelector('.confirmation-veil')`, 'the refused notice to close');
    await wait(200);
    const after = await ev(`(() => {
      const a = document.activeElement;
      return {
        active: a ? (a.id ? '#' + a.id : a.tagName.toLowerCase()) : null,
        same: a === window.__slotLoadLauncher,
        connected: !!window.__slotLoadLauncher?.isConnected,
        overlay: !!document.querySelector('#ov-close'),
        board: !!document.querySelector('.end-turn'),
        liveDeck: window.__spoils().liveDeck || [],
      };
    })()`);
    const keptDeck = JSON.stringify(after.liveDeck) === JSON.stringify(openingDeck) && after.liveDeck.length > 0;
    check(after.same && after.connected && after.overlay && after.board && keptDeck, 'SLOT-LOAD-OVERLAY-FOCUS',
      `a refused load from the overlay's quick navigation keeps the overlay and the run, and "Keep playing" returns focus to #${launcher} (${JSON.stringify({ ...after, liveDeck: after.liveDeck.length, keptDeck })})`);
  } catch (error) {
    check(false, 'SLOT-LOAD-OVERLAY-FOCUS', error.message);
  }
  // Expanded combat without knowledge preserves its explicit Save Game
  // checkpoint after later unsaved actions. Keep the two versions independent.
  try {
    await ev('window.__staleDoc = 1');
    await cdp.send('Page.navigate', { url: `${sourceUrl}?shot=combat&shotKnowledgeVersion=0` }, sessionId);
    await until(`!window.__staleDoc && location.search.includes('shotKnowledgeVersion=0') && !!window.__combat && !!document.querySelector('.end-turn') && window.__combat.phase === 'player'`, 'a fresh expanded combat without knowledge', bootTimeout);
    if (!(await ev('window.__combat.combatExpansionVersion === 2'))) throw new Error('the default fixture is not expanded combat');
    if (await ev('!!window.__combat.enemyKnowledge')) throw new Error('the checkpoint fixture unexpectedly enables knowledge');
    const snapshotWithRng = () => ev(`(async () => {
      const { serializeCombatSnapshot } = await import('/src/engine/combatSnapshot.js');
      return JSON.stringify({ snapshot: serializeCombatSnapshot(window.__combat), rng: { seed: window.__combat.rng.seed, counters: window.__combat.rng.getCounters() } });
    })()`);
    const entry = await snapshotWithRng();
    const entryPose = await pose();
    await advanceTurn();
    await ev('window.__combat.__slotLoadProbe = true');
    await openLoadSlot(1);
    await confirmIfAsked();
    await until(`!!window.__combat && !window.__combat.__slotLoadProbe && !!document.querySelector('.end-turn') && window.__combat.phase === 'player'`, 'the restored expanded entry');
    const restoredEntry = await snapshotWithRng();
    check(entryPose.turn === 1 && restoredEntry === entry, 'SLOT-LOAD-EXPANDED-ENTRY',
      restoredEntry === entry ? 'ordinary unsaved combat restores the exact opening snapshot, RNG seed and counters' : 'ordinary combat replaced or changed its opening checkpoint');
    // Loading installs the new combat before the confirmation input shield
    // finishes closing. Wait for its actual removal before the next action.
    await until(`!document.querySelector('.modal-veil, .quick-nav-veil, .confirmation-veil')`, 'the restored entry input shield to close');
    await advanceTurn();
    await advanceTurn();
    await click('#combat-menu');
    await until(`!!document.querySelector('.qn-row[data-act="save"]')`, 'the Quick Menu Save Game row');
    await click('.qn-row[data-act="save"]');
    await until(`document.querySelector('.qn-row[data-act="save"] .qn-label')?.textContent === 'Saved · Slot 1'`, 'the successful Save Game checkpoint');
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId);
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, sessionId);
    await until(`!document.querySelector('.quick-nav-veil')`, 'the saved Quick Menu to close');
    const saved = await snapshotWithRng();
    const savedPose = await pose();
    if (savedPose.turn <= 1) throw new Error('Save Game did not capture a later turn');
    await advanceTurn();
    const unsavedPose = await pose();
    check(unsavedPose.turn > savedPose.turn && (await snapshotWithRng()) !== saved, 'SLOT-LOAD-EXPANDED-UNSAVED',
      `the live fight advances from saved turn ${savedPose.turn} to distinct unsaved turn ${unsavedPose.turn}`);
    await ev('window.__combat.__slotLoadProbe = true');
    await openLoadSlot(1);
    await confirmIfAsked();
    await until(`!!window.__combat && !window.__combat.__slotLoadProbe && !!document.querySelector('.end-turn') && window.__combat.phase === 'player'`, 'the restored expanded snapshot');
    const restored = await snapshotWithRng();
    check(restored === saved, 'SLOT-LOAD-EXPANDED-SNAPSHOT',
      restored === saved ? `the new combat restores exact saved turn ${savedPose.turn}, resources, piles, enemies, RNG seed and counters` : 'the restored combat differs from its explicit Save Game checkpoint');
  } catch (error) {
    check(false, 'SLOT-LOAD-EXPANDED-SNAPSHOT', error.message);
  }
  // Default knowledge-enabled combat durably commits each accepted action,
  // including its reads and RNG. Load must restore the latest accepted turn.
  try {
    await ev('window.__staleDoc = 1');
    await cdp.send('Page.navigate', { url: `${sourceUrl}?shot=combat` }, sessionId);
    await until(`!window.__staleDoc && !location.search.includes('shotKnowledgeVersion') && !!window.__combat && !!document.querySelector('.end-turn') && window.__combat.phase === 'player'`, 'fresh default knowledge-enabled combat', bootTimeout);
    if (!(await ev('window.__combat.combatExpansionVersion === 2 && window.__combat.enemyKnowledge?.version === 1'))) throw new Error('the default fixture lacks independent knowledge rules');
    await advanceTurn();
    await advanceTurn();
    const snapshotWithRng = () => ev(`(async () => {
      const { serializeCombatSnapshot } = await import('/src/engine/combatSnapshot.js');
      return JSON.stringify({ snapshot: serializeCombatSnapshot(window.__combat), rng: { seed: window.__combat.rng.seed, counters: window.__combat.rng.getCounters() } });
    })()`);
    const committed = await snapshotWithRng();
    const committedPose = await pose();
    await ev('window.__combat.__slotLoadProbe = true');
    await openLoadSlot(1);
    await confirmIfAsked();
    await until(`!!window.__combat && !window.__combat.__slotLoadProbe && window.__combat.phase === 'player'`, 'the restored knowledge-enabled snapshot');
    const restored = await snapshotWithRng();
    check(committedPose.turn > 1 && restored === committed, 'SLOT-LOAD-KNOWLEDGE-SNAPSHOT',
      restored === committed ? `knowledge combat restores exact accepted turn ${committedPose.turn}, reads, learning, resources, piles, enemies and RNG` : 'knowledge combat differs from its latest accepted snapshot');
  } catch (error) {
    check(false, 'SLOT-LOAD-KNOWLEDGE-SNAPSHOT', error.message);
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

if (process.exitCode === 2 || checks === 0) {
  console.error('slot-load-door: UNKNOWN — no complete verdict was measured');
  process.exit(2);
}
if (failures) {
  console.error(`slot-load-door: FAIL — ${failures} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`slot-load-door: OK — ${checks} checks passed`);
process.exit(0);
