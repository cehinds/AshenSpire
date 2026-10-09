#!/usr/bin/env node
// tools/full-run-probe.mjs — one whole run, played in Chromium from the title
// (docs/FINISH.md §3 "A browser full run").
//
//   node tools/full-run-probe.mjs            the drive below, each stage timed; exit 0 green, 1 red, 2 harness
//   node tools/full-run-probe.mjs --check    the same drive, verdict lines only (CI)
//   node tools/full-run-probe.mjs --seed S   another fixed seed (default FULLRUN1)
//   node tools/full-run-probe.mjs --selftest the console verdict's known-bads, no browser (seconds)
//   FULL_RUN_PORT=<n>                        serve on another port (default: any free port)
//   CHROME=<path>                            the browser (tools/browser.mjs)
//
// THE DOOR. A normal boot of the SOURCE tree (no `?shot=`, so durable
// localStorage, the startup gate and the real title), served the way
// `node tools/launch.mjs` serves local play: tools/serve.mjs with its LAN layer
// on, so the title's /api/lan/info question is answered as on a player's
// machine. Every step is a trusted CDP pointer press on the control a player
// presses (a hold where the control owes one: End Turn, Continue):
//
//   TITLE      the startup gate, then the title's New Game door (slot 1).
//   CLASS      character creation walked step by step (Class, Character,
//              Starting equip, Review), the fixed seed typed into the Review's
//              own Seed field, Begin; the opening is skipped with its Skip.
//   MAP        the act map mounts; the save names the fixed seed.
//   COMBAT     the first fight is PLAYED: each turn the probe plays affordable
//              attacks followed by other cards, confirming friendly targets
//              through the player, then holds End Turn, until the
//              fight is won (cap COMBAT_TURNS turns). Its reward is left by
//              Continue.
//   WALK       the map is walked floor by floor to the boss: the probe picks a
//              lit node (NODE_ORDER: a lit boss first, then Monster, Treasure,
//              Rest, Shrine, Event, Merchant, Elite; unvisited before visited),
//              selects it, presses Enter and leaves the room by its own door
//              (Continue, a choice, Leave). A door the game mounts disabled
//              (an Event's Continue before a response, a reward's Continue
//              while a level waits) is pressed only once enabled; a pending
//              level is claimed by its Level up button and its chooser or
//              completion door, inside ROOM_MS. The act's boss node opens its legacy
//              dungeon, whose rooms are walked the same way to its boss. Fights after
//              the first are resolved through the debug handle
//              `window.__combat` (the enemies' hp set to 0, then End Turn
//              held — the same handle tools/reward-collect-drive.mjs uses):
//              the first fight already proved play, and the walk proves the
//              doors between floors.
//   BOSS       the boss fight, known by its splash (intro.js; counted by a
//              page-side recorder as it is drawn). The run ends in DEATH,
//              the way a player loses: the probe holds End Turn every turn and
//              plays nothing until the boss kills the character (cap
//              BOSS_TURNS). No hp is written. (Victory is the act-3 boss:
//              outside one probe's bound; tools/runsim.mjs reaches it headless.)
//   GAMEOVER   the death screen mounts; the profile's last result is a loss on
//              this seed and slot 1 is cleared; Return to title.
//   NEW RUN    the title again; New Game; creation walked again; Begin; a new
//              act map at floor 0 with full hp.
//
// THE VERDICT on console errors, taken over the WHOLE drive (CDP Runtime and
// Log domains): every `console.error` call, every uncaught exception, and every
// error entry the browser logs (a failed resource load included). The one set
// aside BY NAME, and counted and printed every run, is OPTIONAL_404: the
// optional SFX sample probe in src/ui/audio.js ("SFX ids first try
// assets/sfx/<id>.ogg"; the synth plays when none is there, by design), whose
// 404s the browser logs as errors. Any other error, of any kind, is red.
//
// Every CDP command is bounded (CDP_CALL_MS) and rejected the moment the
// browser connection closes or errors, so a crash is a red DRIVE, not a hang.
//
// BOUNDARY. One class (the first offered), one seed, one viewport (1440x900).
// It does not judge balance, art or the content of any screen; it proves the
// doors from title back to title and on into a new run, with no error logged.

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { seedFromString, seedToString } from '../src/engine/rng.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const SEED = argv.includes('--seed') ? argv[argv.indexOf('--seed') + 1] : 'FULLRUN1';
// The run stores the seed's canonical spelling (main.js newRun).
const CANON = seedToString(seedFromString(SEED));
const PORT = Number(process.env.FULL_RUN_PORT) || 0;
const VIEWPORT = { width: 1440, height: 900 };
const COMBAT_TURNS = 20; // the played first fight
const BOSS_TURNS = 40; // End Turn held until the boss kills the character
const MAX_STEPS = 80; // screens the walk may visit before it calls itself lost
const CDP_CALL_MS = 30000; // one CDP command (an in-page wait included) before it is a hang
const ROOM_MS = 90000; // one room's doors, its XP and refill animations included, before it is lost
const MOUNT_MS = 60000; // a document coming up from the source tree (see map-camera-persistence.mjs)
// Optional files the game asks for and is built to do without (see header).
const OPTIONAL_404 = [/\/assets\/sfx\/[A-Za-z0-9_%-]+\.ogg$/];
// The walk's preference among lit nodes: the boss the moment one is lit, then
// the cheapest rooms to leave. Visited nodes (a legacy dungeon keeps the room
// it stands in lit) come after every unvisited one.
const NODE_ORDER = ['boss', 'monster', 'treasure', 'rest', 'shrine', 'event', 'merchant', 'elite'];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (ok, name, detail) => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
};
const t0 = Date.now();
const timings = [];
let lastMark = t0;
const mark = (stage) => {
  const now = Date.now();
  timings.push({ stage, ms: now - lastMark });
  lastMark = now;
  if (!CHECK) console.log(`  [${((now - t0) / 1000).toFixed(1)} s] ${stage} (+${((timings.at(-1).ms) / 1000).toFixed(1)} s)`);
};
const say = (line) => { if (!CHECK) console.log(`  ${line}`); };

const errors = [];
const optional = [];
// One CDP event → 'error' (red), 'optional' (an OPTIONAL_404, counted) or null
// (not an error). Pure, so --selftest can plant known-bads through it.
function classify(m) {
  if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    return { kind: 'error', text: `uncaught: ${d.exception?.description || d.text}` };
  }
  if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'assert')) {
    return { kind: 'error', text: `console.${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ')}` };
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    const { text, url = '', source } = m.params.entry;
    if (source === 'network' && OPTIONAL_404.some((re) => re.test(url)) && /status of 404/.test(text)) return { kind: 'optional', text: url };
    return { kind: 'error', text: `log (${source}): ${text}${url ? ` ${url}` : ''}` };
  }
  return null;
}
function onEvent(m) {
  const c = classify(m);
  if (c) (c.kind === 'optional' ? optional : errors).push(c.text);
}

// The page-side recorder: the boss splash closes itself after 2.3 s, so it is
// counted as it is drawn rather than looked for by a poll.
const RECORDER = `window.__fullRunBossIntros = [];
new MutationObserver((records) => { for (const r of records) for (const n of r.addedNodes) {
  if (n.nodeType === 1 && n.classList.contains('boss-intro')) window.__fullRunBossIntros.push((n.querySelector('.bi-name') || n).textContent.trim());
} }).observe(document, { childList: true, subtree: true });`;

// CDP call bookkeeping, pure so --selftest can plant a call the browser never
// answers and a socket that drops under a pending call. Every call is bounded
// (CDP_CALL_MS) and every pending call is rejected when the connection closes
// or errors, so a browser crash fails the drive (and its cleanup runs) instead
// of hanging the probe until CI kills the job.
function cdpCalls(write, { timeoutMs = CDP_CALL_MS } = {}) {
  const pending = new Map();
  let id = 0;
  let dead = null;
  const settle = (call, fn, value) => { clearTimeout(call.timer); pending.delete(call.id); fn(value); };
  return {
    pending,
    call(method, params = {}, sessionId) {
      if (dead) return Promise.reject(new Error(`CDP ${method}: ${dead}`));
      return new Promise((resolve, reject) => {
        const call = { id: ++id, resolve, reject };
        call.timer = setTimeout(() => settle(call, reject, new Error(`CDP ${method} unanswered after ${timeoutMs} ms`)), timeoutMs);
        pending.set(call.id, call);
        try {
          write(JSON.stringify({ id: call.id, method, params, ...(sessionId ? { sessionId } : {}) }));
        } catch (e) {
          settle(call, reject, new Error(`CDP ${method}: ${e.message}`));
        }
      });
    },
    answer(m) {
      const call = pending.get(m.id);
      if (!call) return;
      m.error ? settle(call, call.reject, new Error(m.error.message)) : settle(call, call.resolve, m.result);
    },
    fail(reason) {
      dead = dead || reason;
      for (const call of [...pending.values()]) settle(call, call.reject, new Error(`CDP call ${call.id}: ${dead}`));
    },
  };
}

async function session(browser) {
  const ws = new WebSocket(browser.wsUrl);
  const calls = cdpCalls((data) => ws.send(data));
  ws.onmessage = (event) => {
    const m = JSON.parse(event.data);
    if (m.method) onEvent(m);
    calls.answer(m);
  };
  await new Promise((done, fail) => {
    const timer = setTimeout(() => fail(new Error(`the CDP socket did not open within ${CDP_CALL_MS} ms`)), CDP_CALL_MS);
    ws.onopen = () => { clearTimeout(timer); done(); };
    ws.onerror = () => { clearTimeout(timer); fail(new Error('the CDP socket failed to open')); };
  });
  ws.onclose = (e) => calls.fail(`the browser connection closed (code ${e.code})`);
  ws.onerror = () => calls.fail('the browser connection errored');
  const raw = calls.call;
  const { targetId } = await raw('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => raw(method, params, sessionId);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value;
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: RECORDER });
  return { ws, send, evaluate };
}

let S; // the page session
const ev = (x) => S.evaluate(x);
const SCREEN = `(() => ({
  app: [...document.querySelectorAll('#app > *')].map((e) => e.className).slice(0, 5).join(' | '),
  text: (document.querySelector('#app') || document.body).innerText.replace(/\\s+/g, ' ').slice(0, 220),
  top: [...document.querySelectorAll('.modal-veil button, [role=dialog] button')].filter((b) => b.offsetParent && !b.disabled)
    .map((b) => (b.id || b.className).slice(0, 40) + '=' + b.textContent.trim().slice(0, 20)).slice(0, 16),
}))()`;
async function until(expression, what, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await ev(expression);
    if (v) return v;
    await wait(100);
  }
  throw new Error(`timed out after ${ms} ms waiting for ${what}; screen ${JSON.stringify(await ev(SCREEN))}`);
}
const point = (selector) => ev(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const b = el.getBoundingClientRect();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, hold: Number(el.dataset.holdMs) || 0 };
})()`);
// A trusted press at the control's centre; `hold` true holds it for the
// control's own data-hold-ms (or `ms`) and a margin, as a player's hold.
async function press(selector, { hold = false, ms = 0 } = {}) {
  const at = await point(selector);
  if (!at) throw new Error(`missing ${selector}; screen ${JSON.stringify(await ev(SCREEN))}`);
  const { x, y } = at;
  await S.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await S.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  if (hold) await wait((ms || at.hold || 600) + 250);
  await S.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await wait(150);
}
const has = (selector) => ev(`!!document.querySelector(${JSON.stringify(selector)})`);
// A tutorial spotlight over the screen is dismissed by its own Skip.
async function skipTutorial() {
  for (let i = 0; i < 4 && await has('.tut-skip'); i++) { await press('.tut-skip'); await wait(250); }
}
const savedRun = () => ev(`(() => { try { const r = JSON.parse(localStorage.getItem('sote_run_v1') || 'null'); const g = r && (r.run || r.game || r); return g ? { seed: g.seedString, floor: g.floor, act: g.actNumber, hp: g.hp, maxHp: g.maxHp } : null; } catch { return null; } })()`);

// The visible ability fold owns its gate. Read its semantic selection state
// after each trusted press; never toggle a chosen ability or overfill a pool.
const STARTING_ABILITY_FOLD = '#cz-equipment-fold details[open] [data-equipment-section="startingAbilities"]';
const STARTING_ABILITY_SELECTION_LIMIT = 8;
function startingAbilityChoice({ continueBlocked, choices = [] }, selections = 0) {
  if (!continueBlocked) return null;
  if (selections >= STARTING_ABILITY_SELECTION_LIMIT) throw new Error('starting ability selection limit reached while Continue is blocked');
  const choice = choices.find(({ cardId, selected, disabled }) => cardId && !selected && !disabled);
  if (!choice) throw new Error('no legal starting ability while Continue is blocked');
  return choice.cardId;
}

// ---- TITLE → CLASS SELECT → BEGIN → the act map -----------------------------
async function newGameFromTitle(label) {
  await until(`!!document.querySelector('.title-menu .slot-new')`, `the title's New Game door (${label})`);
  await press('.title-menu .slot-new');
  await until(`!!document.querySelector('[data-title-action="modal-continue"]:not([disabled])')`, 'the new-slot modal');
  await press('[data-title-action="modal-continue"]');
  await until(`!!document.querySelector('[data-title-action="review-new"]:not([disabled])')`, 'the new-slot decision door');
  await press('[data-title-action="review-new"]');
  await until(`!!document.querySelector('#cz-classes .cz-class')`, 'the Class stage of character creation');
  const className = await ev(`document.querySelector('#cz-classes .cz-class').textContent.trim().replace(/^\\W+/, '').split(/(?=[A-Z][a-z]+ )/)[0]`);
  await press('#cz-classes .cz-class');
  await press('#cz-next');
  await until(`!!document.querySelector('#cz-statedit .cc-mode-select')`, 'the Character stage');
  const openFace = async (key) => {
    await until(`!!document.querySelector('[data-face="${key}"]')`, `the ${key} fold`);
    if (!(await ev(`document.querySelector('[data-face="${key}"]')?.closest('details')?.open === true`))) await press(`[data-face="${key}"]`);
  };
  await openFace('primary');
  // Standard's mode id is `lean` (see map-camera-persistence.mjs).
  const mode = await ev(`(() => { const s = document.querySelector('#cz-statedit .cc-mode-select'); s.value = 'lean'; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
  if (mode !== 'lean') throw new Error(`the stat mode select offers no Standard (lean); value=${JSON.stringify(mode)}`);
  await openFace('keepsake');
  await press('#cz-keepsakes [data-keepsake-id]');
  await press('#cz-next');
  await until(`document.querySelector('#cz-tab-equipment')?.getAttribute('aria-selected') === 'true'`, 'the Starting equip stage');
  await openFace('armour');
  await press('#cz-armours .equip-chip .equipment-poker-card');
  await press('#cz-armours .equip-chip .equipment-choose');
  let abilitySelections = 0;
  for (let i = 0; i < 8; i++) {
    if (await ev(`document.querySelector('#cz-tab-review')?.getAttribute('aria-selected') === 'true'`)) break;
    // Starting maneuvers/spells are required choices. Complete the open fold
    // through its real Choose controls before asking its Continue to advance.
    const abilityFold = STARTING_ABILITY_FOLD;
    if (await has(abilityFold)) {
      while (true) {
        const snapshot = await ev(`(() => ({
          continueBlocked: document.querySelector('#cz-next')?.getAttribute('aria-disabled') === 'true',
          choices: [...document.querySelectorAll(${JSON.stringify(abilityFold + ' .cc-ability-choose')})].map(button => ({
            cardId: button.closest('.cc-ability-choice')?.dataset.cardId,
            selected: button.getAttribute('aria-pressed') === 'true', disabled: button.disabled,
          })),
        }))()`);
        let cardId;
        try { cardId = startingAbilityChoice(snapshot, abilitySelections); }
        catch (error) { throw new Error(`${error.message}; screen ${JSON.stringify(await ev(SCREEN))}`); }
        if (cardId === null) break;
        const choice = `${abilityFold} .cc-ability-choice[data-card-id=${JSON.stringify(cardId)}] .cc-ability-choose`;
        await press(choice);
        abilitySelections++;
        await until(`document.querySelector(${JSON.stringify(choice)})?.getAttribute('aria-pressed') === 'true'`, `the starting ability ${cardId} to be chosen`);
      }
    }
    await press('#cz-next');
  }
  await until(`document.querySelector('#cz-tab-review')?.getAttribute('aria-selected') === 'true'`, 'the Review stage');
  // The seed goes in through the Review's own Seed field, typed.
  await press('#seed-input');
  await ev(`(() => { const i = document.querySelector('#seed-input'); i.select(); })()`);
  await S.send('Input.insertText', { text: SEED });
  await wait(150);
  const typed = await ev(`document.querySelector('#seed-input').value`);
  await until(`(() => { const b = document.querySelector('#cz-start'); return !!b && b.getAttribute('aria-disabled') !== 'true'; })()`, 'Begin to accept the character');
  await press('#cz-start');
  await until(`!!(document.querySelector('.prologue-screen') || document.querySelector('.class-mastery-node') || document.querySelector('.map-scroll .map-node'))`, 'the opening or the map', MOUNT_MS);
  if (await ev(`(() => { const s = [...document.querySelectorAll('.prologue-screen .prologue-controls button')].find((c) => !c.hidden && /skip/i.test(c.textContent)); if (!s) return false; s.dataset.fullRunSkip = '1'; return true; })()`)) {
    await press('[data-full-run-skip]');
  }
  const opened = await leaveRoom();
  if (opened !== 'map') throw new Error(`new run opened ${opened} instead of its map`);
  await until(`!!document.querySelector('.map-scroll .map-node.reachable')`, 'the act map with a lit node', MOUNT_MS);
  await skipTutorial();
  return { className, typed };
}

// ---- the map: one floor --------------------------------------------------------
const reachable = () => ev(`[...document.querySelectorAll('.map-scroll .map-node.reachable')].map((n) => ({ id: n.dataset.node, visited: n.classList.contains('visited') || n.classList.contains('current'), type: ${JSON.stringify(NODE_ORDER)}.find((t) => n.classList.contains(t)) || 'unknown' }))`);
async function enterNode(node) {
  await press(`.map-node[data-node="${node.id}"]`);
  // Select, then Enter once the tray has slid open (map.js W4b).
  await until(`document.querySelector('.map-tray')?.dataset.shown === 'true' && !document.querySelector('#map-enter')?.disabled`, `the tray's Enter for ${node.id}`, 5000);
  await wait(200);
  await press('#map-enter');
  // Entered: the map is gone, or a room (a treasure's spoils) is drawn over it.
  await until(`!document.querySelector('.map-scroll .map-node.reachable[data-node="${node.id}"]') || !!document.querySelector('.modal-veil')`, `${node.id} to be entered`, MOUNT_MS);
}

// ---- combat -------------------------------------------------------------------
const COMBAT_READY = `!!window.__combat && !!document.querySelector('.combat .end-turn') && !document.querySelector('.end-turn').disabled && window.__combat.phase === 'player'`;
const combatOver = `!document.querySelector('.combat') || !!document.querySelector('.reward-veil') || !!document.querySelector('#to-title')`;
// End Turn owes a hold (secondbeat.js). A hold that lands while a card is
// still selected for targeting is spent on the selection, so a turn that has
// not moved on after the hold is held again (at most END_TURN_HOLDS times).
const END_TURN_HOLDS = 3;
async function endTurn() {
  const turn = await ev('window.__combat.turn');
  const moved = `(${combatOver}) || window.__combat.turn > ${turn} || window.__combat.phase !== 'player'`;
  for (let i = 0; i < END_TURN_HOLDS; i++) {
    await press('.end-turn', { hold: true, ms: 1000 });
    if (await ev(`(async () => { const end = Date.now() + 4000; while (Date.now() < end) { if (${moved}) return true; await new Promise((r) => setTimeout(r, 100)); } return false; })()`)) break;
  }
  // The enemy turn can pause for an optional defensive reaction. Decline via
  // the player's Back control, preserving payment and enemy-turn continuation.
  const done=`(${combatOver}) || (window.__combat.turn > ${turn} && ${COMBAT_READY})`;
  const deadline=Date.now()+40000;
  while(Date.now()<deadline){
    if(await ev(done))return;
    const decline='.reaction-choice [data-control-role="exit"]';
    if(await has(decline))await press(decline);
    else await wait(100);
  }
  throw new Error(`timed out waiting for turn ${turn+1} or the fight's end; screen ${JSON.stringify(await ev(SCREEN))}`);
}
async function playFight() {
  let played = 0;
  for (let turn = 0; turn < COMBAT_TURNS; turn++) {
    if (await ev(combatOver)) return { played, turns: turn };
    await until(`(${combatOver}) || (${COMBAT_READY})`, 'the player turn', 30000);
    await skipTutorial();
    // Hand nodes are reused across turns. Attempts belong to this turn, not
    // to a persistent DOM marker that can silently exclude a later draw.
    const attempted = new Set();
    for (let tries = 0; tries < 12; tries++) {
      if (await ev(combatOver)) return { played, turns: turn };
      const card = await ev(`(() => { const tried = ${JSON.stringify([...attempted])}; const cards = [...document.querySelectorAll('.hand .card:not(.unaffordable)')].filter(c => c.dataset.instanceId && !tried.includes(c.dataset.instanceId)); const c = cards.find(c => c.classList.contains('type-attack')) || cards[0]; return c?.dataset.instanceId || null; })()`);
      if (!card) break;
      attempted.add(card);
      await press(`.hand .card[data-instance-id=${JSON.stringify(card)}]`);
      await wait(250);
      // Defensive and other self cards use the real friendly confirmation;
      // attacks still go through the enemy's ordinary target control.
      if (await has('.combatant.player.armed')) await press('.combatant.player.armed');
      else if (await has('.combatant.enemy:not(.dead)')) await press('.combatant.enemy:not(.dead)');
      // Draw-on-play can leave the hand's size unchanged. Follow this exact
      // instance instead of treating a smaller total as the play receipt.
      const left = await ev(`(async () => { const end = Date.now() + 2500; while (Date.now() < end) { if (!window.__combat || !window.__combat.piles.hand.some(c => c.instanceId === ${JSON.stringify(card)})) return true; await new Promise((r) => setTimeout(r, 100)); } return false; })()`);
      if (left) { played++; await wait(700); }
      else await S.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }).then(() => S.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }));
    }
    if (await ev(combatOver)) return { played, turns: turn + 1 };
    await endTurn();
  }
  return { played, turns: COMBAT_TURNS, unfinished: true };
}
// Fights after the first: resolved through the debug handle, then End Turn.
async function resolveFight() {
  await until(`(${combatOver}) || (${COMBAT_READY})`, 'the player turn', 30000);
  await skipTutorial();
  await ev(`(() => { for (const e of window.__combat.enemies) { e.hp = 0; e.alive = false; } return true; })()`);
  await press('.end-turn', { hold: true });
  await until(combatOver, 'the fight to end', 40000);
}

// ---- leaving the screen a node opened --------------------------------------
// The screen is read in one snapshot (each selector below, present or not) and
// the door is picked from it by pickDoor, which is pure so --selftest can plant
// screens: an Event whose Continue is still disabled, a reward holding Continue
// for a level claim, a level chooser, an XP bar still filling.
const DOORS = {
  map: `.map-scroll .map-node.reachable`,
  classMastery: `.class-mastery-node:not([disabled])`,
  veil: `.modal-veil`,
  gameover: `#to-title`,
  rewardVeil: `.reward-veil`,
  levelOffer: `.reward-menu .reward-level-offer`,
  levelContinue: `#reward-level-continue`,
  chooserConfirm: `#reward-card-confirm:not([disabled])`,
  chooserPick: `.reward-row .reward-pick`,
  levelUp: `.reward-level-up:not([disabled])`,
  rewardBack: `#reward-back`,
  rewardExpand: `#reward-expand:not([disabled])`,
  rewardContinue: `#reward-continue:not([disabled])`,
  dialogueResponse: `.dialogue-response:not([disabled])`,
  dialogueContinue: `#dialogue-continue:not([disabled])`,
  eventContinue: `#event-continue:not([disabled])`,
  choice: `#choices button:not([disabled])`,
  leaveShop: `#leave-shop`,
  shrineLeave: `#shrine-leave`,
  confirm: `.confirm-modal [data-confirm="yes"], .as-modal .primary`,
};
const SNAPSHOT = `(() => { const out = {}; for (const [k, sel] of Object.entries(${JSON.stringify(DOORS)})) out[k] = !!document.querySelector(sel); out.combat = ${COMBAT_READY}; return out; })()`;
// One snapshot → { done: 'map' | 'gameover' | 'combat' }, { press, hold?, ms? },
// or { wait: why } (an animation or refill the screen is still running).
function pickDoor(d) {
  if (d.map && !d.veil) return { done: 'map' };
  if (d.gameover) return { done: 'gameover' };
  if (d.classMastery) return { press: DOORS.classMastery };
  if (d.combat) return { done: 'combat' };
  if (d.rewardVeil) {
    // An open chooser (a level card or draft the walk opened from the menu):
    // its first offer, then Confirm.
    if (d.chooserConfirm) return { press: DOORS.chooserConfirm };
    if (d.chooserPick) return { press: DOORS.chooserPick };
    // A detail view (no chooser) goes back to the menu.
    if (d.rewardBack) return { press: DOORS.rewardBack };
    // A level waiting to be claimed holds Continue (reward.js): claim it.
    if (d.levelUp) return { press: DOORS.levelUp };
    // A claim opens its level popup (SPEC §13.4o): take each blue reward it
    // lists (or one still lifted in the list), then Continue refills the rest.
    if (d.levelOffer) return { press: DOORS.levelOffer };
    if (d.levelContinue) return { press: DOORS.levelContinue };
    // The victory card's Continue opens the spoils once its XP has counted;
    // the spoils' Continue (a hold) collects and leaves.
    if (d.rewardExpand) return { press: DOORS.rewardExpand };
    if (d.rewardContinue) return { press: DOORS.rewardContinue, hold: true };
    return { wait: 'the reward (XP count, refill, or a disabled Continue)' };
  }
  // A dialogue room (a legacy dungeon's rooms): the first response it offers
  // (held: a binding one owes a hold), then Continue.
  if (d.dialogueResponse) return { press: DOORS.dialogueResponse, hold: true, ms: 1000 };
  if (d.dialogueContinue) return { press: DOORS.dialogueContinue };
  // An Event's Continue is disabled until a response is taken (event.js).
  if (d.eventContinue) return { press: DOORS.eventContinue, hold: true };
  if (d.choice) return { press: DOORS.choice, hold: true };
  if (d.leaveShop) return { press: DOORS.leaveShop, hold: true };
  if (d.shrineLeave) return { press: DOORS.shrineLeave, hold: true };
  if (d.confirm) return { press: DOORS.confirm };
  return { wait: 'a door' };
}
async function leaveRoom() {
  const end = Date.now() + ROOM_MS;
  let last = null;
  while (Date.now() < end) {
    await wait(300);
    await skipTutorial();
    const door = pickDoor(await ev(SNAPSHOT));
    if (door.done) return door.done;
    last = door;
    if (door.press) await press(door.press, { hold: !!door.hold, ms: door.ms || 0 });
  }
  throw new Error(`no way out of this screen in ${ROOM_MS} ms (last: ${JSON.stringify(last)}): ${JSON.stringify(await ev(SCREEN))}`);
}

// --selftest: each plant is an event the real drive must turn red (or, for the
// one clean edge, must set aside). A change that weakens the listener or widens
// the 404 exception fails here, without a browser.
if (argv.includes('--selftest')) {
  const net = (url, text = 'Failed to load resource: the server responded with a status of 404 (Not Found)', source = 'network') =>
    ({ method: 'Log.entryAdded', params: { entry: { level: 'error', source, text, url } } });
  const plants = [
    ['console.error', 'error', { method: 'Runtime.consoleAPICalled', params: { type: 'error', args: [{ type: 'string', value: 'planted' }] } }],
    ['console.assert', 'error', { method: 'Runtime.consoleAPICalled', params: { type: 'assert', args: [{ type: 'string', value: 'planted' }] } }],
    ['uncaught exception', 'error', { method: 'Runtime.exceptionThrown', params: { exceptionDetails: { text: 'Uncaught', exception: { description: 'Error: planted' } } } }],
    ['non-sound 404 (an image)', 'error', net('http://localhost:1/assets/enemies/planted.png')],
    ['non-sound 404 (a script)', 'error', net('http://localhost:1/src/ui/planted.js')],
    ['an .ogg outside assets/sfx/', 'error', net('http://localhost:1/assets/music/planted.ogg')],
    ['an assets/sfx/ path that is not one .ogg', 'error', net('http://localhost:1/assets/sfx/sub/planted.ogg')],
    ['an assets/sfx/ sample answered 500', 'error', net('http://localhost:1/assets/sfx/hit.ogg', 'Failed to load resource: the server responded with a status of 500 (Internal Server Error)')],
    ['a javascript-source log error', 'error', net('', 'planted', 'javascript')],
    ['clean edge: an optional assets/sfx/<id>.ogg 404', 'optional', net('http://localhost:1/assets/sfx/hit.ogg')],
    ['clean edge: console.log', null, { method: 'Runtime.consoleAPICalled', params: { type: 'log', args: [{ type: 'string', value: 'fine' }] } }],
  ];
  // Door plants: the screen a room shows, and the door the walk must take.
  const D = (flags) => Object.fromEntries(Object.keys(DOORS).concat('combat').map((k) => [k, !!flags[k]]));
  const doorPlants = [
    ['an Event before a response: its disabled Continue is not a door', D({ choice: true }), DOORS.choice],
    ['an Event after a response: Continue', D({ eventContinue: true, choice: false }), DOORS.eventContinue],
    ['a reward holding Continue for a level: claim it', D({ rewardVeil: true, veil: true, levelUp: true }), DOORS.levelUp],
    ['a reward whose level button is still refilling: wait', D({ rewardVeil: true, veil: true }), 'wait'],
    ['the level chooser before a pick: the first offer', D({ rewardVeil: true, veil: true, chooserPick: true, rewardBack: true }), DOORS.chooserPick],
    ['the level chooser after a pick: Confirm, not Back', D({ rewardVeil: true, veil: true, chooserPick: true, chooserConfirm: true, rewardBack: true }), DOORS.chooserConfirm],
    ['a claimed level\'s reward waiting in the menu: open it', D({ rewardVeil: true, veil: true, levelOffer: true, rewardContinue: true }), DOORS.levelOffer],
    ['a level popup with its rewards taken: Continue', D({ rewardVeil: true, veil: true, levelContinue: true }), DOORS.levelContinue],
    ['the spoils with Continue enabled', D({ rewardVeil: true, veil: true, rewardContinue: true }), DOORS.rewardContinue],
    ['a mastery choice before the map exists', D({ classMastery: true }), DOORS.classMastery],
    ['a mastery choice over the map owns the next input', D({ classMastery: true, map: true, veil: true }), DOORS.classMastery],
    ['the map under no veil', D({ map: true }), 'map'],
  ];
  // Doors the game mounts DISABLED (event.js Continue until a response,
  // reward.js Continue while a level waits, the victory card's Continue while
  // XP counts, a chooser's Confirm before a pick) are only doors when enabled.
  for (const key of ['eventContinue', 'rewardContinue', 'rewardExpand', 'chooserConfirm', 'levelUp']) {
    plants.push([`door: ${key} is pressed only when enabled`, true, null, /:not\(\[disabled\]\)$/.test(DOORS[key])]);
  }
  for (const [name, snap, want] of doorPlants) {
    const door = pickDoor(snap);
    const got = door.done || door.press || (door.wait ? 'wait' : null);
    plants.push([`door: ${name}`, want, null, got]);
  }
  // Creation plants use the SAME choice planner as the actual DOM driver.
  // Simulate the UI gate opening at one or two distinct selected abilities.
  const creationChoices = (count) => {
    const choices = ['first', 'second', 'third'].map(cardId => ({ cardId, selected: false, disabled: false }));
    const picked = [];
    for (let step = 0; step < 4; step++) {
      const cardId = startingAbilityChoice({ continueBlocked: picked.length < count, choices });
      if (cardId === null) return picked.join(',') + ':ready';
      if (picked.includes(cardId)) return 'toggled a selected ability';
      picked.push(cardId);
      choices.find(choice => choice.cardId === cardId).selected = true;
    }
    return 'never completed';
  };
  plants.push(['creation: one required maneuver selects once then advances', 'first:ready', null, creationChoices(1)]);
  plants.push(['creation: two required spells select distinct unchosen abilities', 'first,second:ready', null, creationChoices(2)]);
  plants.push(['creation: selected and disabled abilities are skipped', 'legal', null, startingAbilityChoice({
    continueBlocked: true, choices: [
      { cardId: 'selected', selected: true, disabled: false },
      { cardId: 'disabled', selected: false, disabled: true },
      { cardId: 'legal', selected: false, disabled: false },
    ],
  })]);
  plants.push(['creation: enabled Continue never selects an extra ability', null, null, startingAbilityChoice({
    continueBlocked: false, choices: [{ cardId: 'extra', selected: false, disabled: false }],
  })]);
  let blockedCreation = 'accepted';
  try { startingAbilityChoice({ continueBlocked: true, choices: [
    { cardId: 'selected', selected: true, disabled: false },
    { cardId: 'disabled', selected: false, disabled: true },
  ] }); } catch (error) { blockedCreation = error.message; }
  plants.push(['creation: a blocked gate without a legal choice fails', 'no legal starting ability while Continue is blocked', null, blockedCreation]);
  let alternatingGate = 'accepted';
  const alternatingChoices = ['first', 'second'].map(cardId => ({ cardId, selected: false, disabled: false }));
  let alternatingSelections = 0;
  try {
    while (true) {
      const cardId = startingAbilityChoice({ continueBlocked: true, choices: alternatingChoices }, alternatingSelections);
      alternatingSelections++;
      for (const choice of alternatingChoices) choice.selected = choice.cardId === cardId;
    }
  } catch (error) { alternatingGate = `${error.message}; selections ${alternatingSelections}`; }
  plants.push(['creation: a blocked replacement pool stops at its selection bound',
    'starting ability selection limit reached while Continue is blocked; selections 8', null, alternatingGate]);
  plants.push(['creation: a ready gate at the selection limit still advances', null, null,
    startingAbilityChoice({ continueBlocked: false }, STARTING_ABILITY_SELECTION_LIMIT)]);
  // CDP plants: a call the browser never answers is rejected by its bound; a
  // call pending when the socket drops is rejected at once, as is any later.
  const quiet = cdpCalls(() => {}, { timeoutMs: 50 });
  const outcome = (p) => Promise.race([p.then(() => 'resolved', (e) => `rejected: ${e.message}`), wait(1000).then(() => 'hung')]);
  plants.push(['cdp: an unanswered call is rejected by its timeout', 'rejected', null, (await outcome(quiet.call('Runtime.evaluate'))).split(':')[0]]);
  const dropped = cdpCalls(() => {}, { timeoutMs: 60000 });
  const inFlight = outcome(dropped.call('Runtime.evaluate'));
  dropped.fail('the browser connection closed (planted)');
  plants.push(['cdp: a pending call is rejected when the socket closes', 'rejected', null, (await inFlight).split(':')[0]]);
  plants.push(['cdp: a call after the socket closed is rejected', 'rejected', null, (await outcome(dropped.call('Page.enable'))).split(':')[0]]);
  const answered = cdpCalls((data) => setTimeout(() => answered.answer({ id: JSON.parse(data).id, result: {} }), 5), { timeoutMs: 1000 });
  plants.push(['cdp: clean edge: an answered call resolves', 'resolved', null, await outcome(answered.call('Page.enable'))]);
  let bad = 0;
  for (const [name, want, m, planted] of plants) {
    const got = m ? classify(m)?.kind ?? null : planted;
    const ok = got === want;
    if (!ok) bad++;
    console.log(`${ok ? 'PASS' : 'FAIL'} selftest ${name} — ${m ? 'classified' : 'got'} ${got ?? 'clean'}, wants ${want ?? 'clean'}`);
  }
  console.log(`${plants.length - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}

// ---- the drive ------------------------------------------------------------------
const server = await serve({ root: ROOT, port: PORT, open: false, lan: true, quiet: CHECK });
const base = server.url;
let browser;
let harness = null;
try {
  browser = await launchBrowser({ prefix: 'fullrun-', headless: '--headless=new' });
} catch (e) {
  harness = `no browser: ${e.message}`;
}
if (!harness) {
  try {
    S = await session(browser);
    say(`seed ${SEED}, ${VIEWPORT.width}x${VIEWPORT.height}, ${base}`);
    await S.send('Page.navigate', { url: base });
    await until(`!!document.querySelector('.startup-gate')`, 'the startup gate', MOUNT_MS);
    await ev(`localStorage.clear()`);
    await S.send('Page.navigate', { url: base });
    await until(`!!document.querySelector('.startup-gate')`, 'the startup gate (fresh profile)', MOUNT_MS);
    mark('boot to the startup gate');
    await press('.startup-gate');
    const first = await newGameFromTitle('first run');
    mark('title → class select → map');
    const begun = await savedRun();
    check(first.typed === SEED && begun?.seed === CANON && begun.floor === 0, 'TITLE→CLASS→MAP',
      `${first.className}, seed typed ${JSON.stringify(first.typed)}, saved run seed ${JSON.stringify(begun?.seed)} (${SEED} canonical ${CANON}) at act ${begun?.act} floor ${begun?.floor}`);

    let fights = 0, rooms = [], firstFight = null, boss = null, steps = 0;
    while (steps++ < MAX_STEPS) {
      const nodes = await reachable();
      if (!nodes.length) throw new Error(`the map lights no node; screen ${JSON.stringify(await ev(SCREEN))}`);
      const pick = [false, true].flatMap((v) => NODE_ORDER.map((t) => nodes.find((n) => n.type === t && n.visited === v))).find(Boolean) || nodes[0];
      await enterNode(pick);
      rooms.push(pick.type);
      let where = await leaveRoom();
      while (where === 'combat') {
        fights++;
        // A boss fight is announced by its splash (intro.js), which the page
        // recorder below counts the moment it is drawn.
        if (await ev('window.__fullRunBossIntros.length') > 0) {
          if (!firstFight) throw new Error('the first fight is the boss');
          mark(`walk to the boss (${rooms.length} rooms: ${rooms.join(', ')})`);
          let turns = 0;
          for (; turns < BOSS_TURNS; turns++) {
            await until(`(${combatOver}) || (${COMBAT_READY})`, 'the boss turn', 30000);
            await skipTutorial();
            if (await ev(combatOver)) break;
            await endTurn();
          }
          boss = { turns, name: await ev('window.__fullRunBossIntros.join(", ")'), enemies: await ev(`window.__combat ? window.__combat.enemies.map((e) => e.enemyId).join(', ') : ''`) };
          break;
        }
        if (!firstFight) {
          const before = await ev(`({ enemies: window.__combat.enemies.map((e) => e.enemyId + ' ' + e.hp).join(', ') })`);
          firstFight = { ...before, ...(await playFight()) };
          mark(`first fight played (${firstFight.played} cards over ${firstFight.turns} turn(s))`);
          const rewarded = await ev(`!!document.querySelector('.reward-veil')`);
          const defeated = await has('#to-title');
          check(!firstFight.unfinished && rewarded, 'COMBAT',
            `vs ${before.enemies}: ${firstFight.played} card(s) played over ${firstFight.turns} turn(s); ${rewarded ? 'won, reward menu mounted' : defeated ? 'player defeated before rewards' : 'no reward menu; fight unfinished'}`);
        } else {
          await resolveFight();
        }
        where = await leaveRoom();
      }
      if (boss) break;
      if (where === 'gameover') throw new Error(`the run ended before the boss, after ${rooms.join(', ')}`);
    }
    if (!boss) throw new Error(`no boss after ${MAX_STEPS} map steps (${rooms.join(', ')})`);
    check(!!firstFight, 'MAP→BOSS', `${rooms.length} map node(s) walked (${rooms.join(', ')}; ${fights} fight(s), the last the boss)`);
    await until(`!!document.querySelector('#to-title')`, 'the death screen', 30000);
    mark(`boss ${boss.name} to death in ${boss.turns + 1} turn(s)`);
    const gameOver = await ev(`(document.querySelector('#app') || document.body).innerText.replace(/\\s+/g, ' ').slice(0, 80)`);
    // The death is read from storage: the profile's last result and the slot.
    const death = await ev(`(() => { const m = JSON.parse(localStorage.getItem('sote_meta_v1') || '{}'); const r = (m.results || []).at(-1) || null; return { result: r && { victory: r.victory, seed: r.seed, act: r.act, floor: r.floor, bosses: r.bosses }, slot: localStorage.getItem('sote_run_v1') }; })()`);
    check(!!death.result && death.result.victory === false && death.result.seed === CANON && death.slot === null, 'BOSS→DEATH',
      `${boss.name} (${boss.enemies}) killed the character after ${boss.turns + 1} End Turn(s), nothing played, no hp written; the profile records ${JSON.stringify(death.result)}, slot 1 ${death.slot === null ? 'cleared' : 'STILL HOLDS A RUN'}; the screen reads "${gameOver}"`);
    await press('#to-title', { hold: await ev(`!!document.querySelector('#to-title').dataset.holdMs`) });
    await until(`!!(document.querySelector('.title-menu .slot-new') || document.querySelector('.startup-gate'))`, 'the title after the run', MOUNT_MS);
    if (await has('.startup-gate')) await press('.startup-gate');
    await until(`!!document.querySelector('.title-menu .slot-new')`, 'the title menu after the run');
    mark('death screen → title');
    check(true, 'DEATH→TITLE', 'Return to title mounted the title menu and its New Game door');
    const second = await newGameFromTitle('second run');
    const again = await savedRun();
    mark('title → class select → new map');
    check(again?.seed === CANON && again.floor === 0 && again.hp === again.maxHp && await has('.map-scroll .map-node.reachable'), 'TITLE→NEW RUN',
      `${second.className}, a new run saved at act ${again?.act} floor ${again?.floor}, hp ${again?.hp}/${again?.maxHp}, the act map lit`);
    await wait(1500); // late errors (timers, sample probes) land inside the window
  } catch (e) {
    check(false, 'DRIVE', `the full run did not finish: ${e.message}`);
  } finally {
    S?.ws.close();
    await browser.close();
  }
  check(errors.length === 0, 'CONSOLE', errors.length
    ? `${errors.length} console error(s): ${errors.slice(0, 8).join(' | ')}`
    : `0 console errors over the drive (${optional.length} optional SFX sample 404(s) set aside by name: ${[...new Set(optional.map((u) => u.replace(/^.*\//, '')))].join(', ') || 'none'})`);
}
server.server.closeAllConnections?.();
await new Promise((done) => server.server.close(done));
if (harness) {
  console.log(`HARNESS ${harness}`);
  process.exit(2);
}
if (!CHECK) console.log(`  timings: ${timings.map((t) => `${t.stage} ${(t.ms / 1000).toFixed(1)} s`).join('; ')}; total ${((Date.now() - t0) / 1000).toFixed(1)} s`);
else console.log(`full-run: total ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const failed = results.filter((ok) => !ok).length;
console.log(`${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
