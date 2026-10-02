#!/usr/bin/env node
// tools/escape-back.mjs — Escape and pad B back out of every screen, measured
// in Chromium (docs/FINISH.md §9, "Escape or pad B backs out of every screen").
//
// WHAT IT JUDGES. For every row of SCREENS below it boots the source tree on
// the row's `?shot=` state (plus an optional opening click), then presses ONE
// Escape (a real CDP key event) and, on a fresh load, ONE pad B (button 1 of a
// stubbed standard gamepad, read by src/ui/input.js's own poller). Each row
// says what that one press must do:
//   back  the screen's existing Back control ran EXACTLY ONCE (a click counter
//         on the control) and the page ends where a mouse click on that Back
//         ends (the same signature on a third, clicked load), so a second
//         listener answering the same press is red;
//   peel  exactly one dialog (`[aria-modal="true"]`) closed and the screen
//         under it is unchanged;
//   leave the press took the screen's own keyboard Back (no control to count:
//         the title folds back to the startup gate) and nothing else moved;
//   none  the screen has no Back, and the press changed nothing (for combat:
//         the turn did not end).
//   popover a native popover is open over the screen: the press closed it,
//         the screen's Back (`back`) ran zero times and nothing else moved.
//   layer a layer that is NOT a dialog is mounted over the screen by `mount`
//         (the real flask menu, a real armed hold-to-confirm, the map legend
//         over the node tray): the press closed or dropped it, the screen's
//         Back ran zero times and the screen (and the map tray) did not move
//         (review of #1463: pad B's key was not cancelable, so the layer's
//         preventDefault was lost and Back ran too; the legend stayed open
//         while the tray closed under it).
// `open` is one control or a list clicked in order; `needs` is a selector
// that must match before the press (the state the row is about), so a row
// whose state never came up is red rather than vacuously green.
// An open tooltip is dismissed before each press (it is a layer of its own,
// and Escape peels it first by design: src/ui/components/tooltip.js).
//
// THE INVENTORY IS THE TABLE. A screen that is not a row here is listed in
// NOT_DRIVEN with the test that covers it instead, so the count is honest.
//
//   node tools/escape-back.mjs            run every row, print the verdicts
//   node tools/escape-back.mjs --check    the same; exit 1 on any red row
//   node tools/escape-back.mjs history    run only the rows whose id matches
//
// CHROME picks the browser (tools/browser.mjs); this sandbox has
// /opt/pw-browsers/chromium.

import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

// id · shot · expect · (back) the Back control · (open) a control clicked first
// · why (for `none`, the reason the screen has no Back).
export const SCREENS = [
  { id: 'startup', shot: 'startup', expect: 'none', why: 'the folded title is the first screen; there is nothing behind it' },
  { id: 'title', shot: 'title', expect: 'leave', to: '.startup-gate', why: 'Back folds the expanded title to the startup gate (title.js onCollapse)' },
  { id: 'settings', shot: 'settings', expect: 'peel' },
  { id: 'about', shot: 'about', expect: 'peel' },
  { id: 'profile', shot: 'profile', expect: 'peel' },
  { id: 'history', shot: 'history', expect: 'back', back: '#hx-back' },
  { id: 'compendium', shot: 'compendium', expect: 'back', back: '#cp-back' },
  { id: 'customrun', shot: 'customrun', expect: 'back', back: '#cr-back' },
  { id: 'customize', shot: 'customize', expect: 'back', back: '#cz-back' },
  { id: 'customize-menu', shot: 'customize', open: '.cz-menu-button', expect: 'popover', back: '#cz-back' },
  // Review of #1463 (Codex): the Equipment stage paints its card-info button
  // in the top layer as popover="manual"; that is not a layer, so Back runs.
  { id: 'customize-info', shot: 'customize', open: ['#cz-tab-equipment', '#cz-equipment-fold summary', '#cz-armours .card-inspection-target'], needs: '.creation-info-popover:popover-open', expect: 'back', back: '#cz-back' },
  { id: 'lobby', shot: 'lobby', expect: 'back', back: '#lb-back' },
  { id: 'atlas', shot: 'atlas', expect: 'none', why: 'the world atlas is the run itself; its exits (Save & quit) end the session' },
  { id: 'armoury', shot: 'atlas', open: '[data-atlas-armoury]', expect: 'peel' },
  { id: 'map', shot: 'map', expect: 'none', why: 'the act map is the run itself; its exits (Save & quit) end the session' },
  { id: 'map-tray', shot: 'map', open: '.map-node.reachable', expect: 'back', back: '#map-back' },
  { id: 'map-legend', shot: 'map', open: ['.map-node.reachable', '#map-legend'], mount: 'legend', expect: 'layer', back: '#map-back' },
  { id: 'combat', shot: 'combat', expect: 'none', why: 'a fight has no Back; Escape only cancels a selection and never ends the turn' },
  { id: 'smith', shot: 'smith', expect: 'peel' },
  { id: 'shop', shot: 'shop', expect: 'none', why: 'Leave ends the visit and discards the stock (D41): a commitment, not a Back' },
  { id: 'master', shot: 'master', expect: 'none', why: 'Leave ends the visit and discards the stock (D41)' },
  { id: 'blacksmith', shot: 'blacksmith', expect: 'none', why: 'Leave ends the visit and discards the stock (D41)' },
  { id: 'rest', shot: 'rest', expect: 'none', why: 'leaving the Shrine forfeits the rest (D41)' },
  { id: 'reward', shot: 'reward', expect: 'none', why: 'leaving the rewards forfeits them (D41); their detail panes Back (tests/escape-back.test.mjs)' },
  { id: 'event', shot: 'event', expect: 'none', why: 'an event has only its choices; the dialogue Back is disabled on the opening line' },
  { id: 'death', shot: 'death', expect: 'none', why: 'the run is over; Return to title is the way on, not a Back' },
  { id: 'victory', shot: 'victory', expect: 'none', why: 'the run is over; Return to title is the way on, not a Back' },
  { id: 'prologue', shot: 'prologue', expect: 'none', why: 'the opening plays forward; Skip is its exit and is not a Back' },
  { id: 'farewell', shot: 'title', open: '#quit-game', expect: 'back', back: '#farewell-back' },
  { id: 'flask-menu', shot: 'history', mount: 'flask', expect: 'layer', back: '#hx-back' },
  { id: 'hold', shot: 'history', mount: 'hold', expect: 'layer', back: '#hx-back' },
];

// The landmark each `?shot=` state must show before a row is judged (Copilot
// on #1463): "some screen mounted" is not "the named screen mounted", and a
// `none` row on a blank or fallen-back page would otherwise pass. A row whose
// shot has no landmark here is red.
export const READY = {
  startup: '.startup-gate',
  title: '.title-screen',
  settings: '.settings-modal',
  about: '.settings-modal',
  profile: '.profile-archive-modal',
  history: '.history-screen',
  compendium: '.screen.compendium',
  customrun: '.screen.customrun',
  customize: '.screen.customize',
  lobby: '.screen.lobby',
  atlas: '.world-atlas-screen',
  map: '.mapscreen.map-fog',
  combat: '.combat',
  smith: '.smith-modal-veil',
  shop: '.shop-workspace:not(.master-workspace):not(.blacksmith-workspace)',
  master: '.master-workspace',
  blacksmith: '.blacksmith-workspace',
  rest: '.rest-screen',
  reward: '.reward-door',
  event: '.dialogue-screen',
  death: '.screen.gameover',
  victory: '.screen.gameover',
  prologue: '.prologue-screen',
};

// `mount` rows: page-side code that opens the layer through the production
// module (the same module instance the page runs) and leaves `__layerOpen()`.
const MOUNTS = {
  // The legend was opened by the row's `open` (its own ? button).
  legend: `(() => {
    const pop = document.querySelector('.map-legend-pop');
    window.__layerOpen = () => !!pop && !pop.hidden;
    return window.__layerOpen() && document.querySelector('.map-tray')?.dataset.open === 'true';
  })()`,
  flask: `(async () => {
    const { mountFlaskActionMenu } = await import('/src/ui/components/flask.js');
    const anchor = document.createElement('button');
    anchor.textContent = 'flask';
    document.getElementById('app').firstElementChild.appendChild(anchor);
    mountFlaskActionMenu(anchor, { def: { id: 'escape-back-flask', name: 'Test Flask' }, plan: { actions: [{ id: 'use', label: 'Use', enabled: true }] }, onAction() {}, onCancel() {} });
    window.__layerOpen = () => !!document.querySelector('.flask-action-menu');
    return window.__layerOpen();
  })()`,
  hold: `(async () => {
    const { armHold } = await import('/src/ui/components/holdconfirm.js');
    const { PRESS_EVENT } = await import('/src/ui/gesture.js');
    const btn = document.createElement('button');
    btn.textContent = 'hold';
    document.getElementById('app').firstElementChild.appendChild(btn);
    window.__holdConfirms = 0;
    armHold(btn, { ms: 600000, onConfirm() { window.__holdConfirms += 1; } });
    btn.dispatchEvent(new CustomEvent(PRESS_EVENT, { cancelable: true, detail: { source: 'pad' } }));
    window.__layerOpen = () => btn.dataset.hold === 'holding' && window.__holdConfirms === 0;
    return window.__layerOpen();
  })()`,
};

// Surfaces reached by no `?shot=` state, and the test that covers each instead.
export const NOT_DRIVEN = [
  ['deck editor', 'tests/deck-editor.test.mjs — Escape and pad B cancel the whole edit'],
  ['quest board', 'tests/escape-back.test.mjs — Escape and pad B press Leave (back to the place) once'],
  ['Armoury or flask menu over the quest board', 'tests/escape-back.test.mjs — the real flask menu and a layer that closes itself take the press alone; the flask-menu row here drives it over History'],
  ['dialogue Back (after the first line)', 'tests/escape-back.test.mjs — the [data-back] rule; a dropped hold over it is the hold row here'],
  ['reward detail and chooser Back', 'tests/escape-back.test.mjs — the [data-back] rule'],
  ['menu overlay, quick nav, confirmation, tutorial', 'their own window-capture Escape (overlay.js, quicknav.js, confirmationModal.js, tutorial.js); tools/confirmation-modal.mjs drives pad B'],
  ['co-op board and LAN room', 'no Back by design: Leave ends the co-op session (D41)'],
];

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) rej(new Error(`${msg.error.message} (${msg.error.code})`)); else res(msg.result);
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
    },
    close: () => ws.close(),
  };
}

const PAD_STUB = `(() => {
  const state = { connected: false, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const pad = { id: 'escape-back-pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: state.buttons };
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => (state.connected ? [pad] : []) });
  window.__escapePad = {
    connect() { state.connected = true; const e = new Event('gamepadconnected'); Object.defineProperty(e, 'gamepad', { value: pad }); dispatchEvent(e); },
    set(i, on) { state.buttons[i] = { pressed: on, value: on ? 1 : 0 }; pad.timestamp += 1; },
  };
})();`;

// What "nothing else moved" compares: the screen, the dialogs, the fight.
const SIGNATURE = `(() => {
  const app = document.getElementById('app');
  const screen = (app?.firstElementChild?.className || '') + ' ' + [...(app?.querySelectorAll('.screen, .combat, .mapscreen, .dialogue-screen, .prologue-screen') || [])].map((n) => n.className.split(' ')[0]).join(',');
  const modals = document.querySelectorAll('[aria-modal="true"]').length;
  const fight = window.__combat ? [window.__combat.turn, window.__combat.phase, document.querySelector('.combat')?.dataset.turn].join('/') : '';
  const pane = document.querySelector('.cz-cat.on, [aria-current="step"], .dialogue-caption-text')?.textContent?.slice(0, 40) || '';
  const tray = document.querySelector('.map-tray')?.dataset.open || '';
  const popover = document.querySelectorAll('[popover]:popover-open').length;
  return JSON.stringify({ screen, modals, fight, pane, tray, popover });
})()`;

async function main() {
  const filter = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const rows = SCREENS.filter((row) => !filter.length || filter.some((f) => row.id.includes(f)));
  const { server, port } = await serve({ root: ROOT, port: 8397, open: false });
  const launched = await launchBrowser({ prefix: 'escape-back-', headless: '--headless=new', timeoutMs: 30000, args: ['--disable-background-timer-throttling'] });
  const cdp = connectCdp(launched.wsUrl);
  await cdp.ready;

  async function page(row) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PAD_STUB }, sessionId);
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html?shot=${row.shot}` }, sessionId);
    const ev = async (expression) => {
      const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    let booted = false;
    for (let i = 0; i < 80 && !booted; i += 1) { await wait(250); booted = await ev("!!document.getElementById('app')?.firstElementChild"); }
    if (!booted) throw new Error(`?shot=${row.shot} never mounted a screen`);
    const landmark = READY[row.shot];
    if (!landmark) throw new Error(`?shot=${row.shot} has no READY landmark`);
    let ready = false;
    for (let i = 0; i < 40 && !ready; i += 1) { ready = await ev(`!!document.querySelector(${JSON.stringify(landmark)})`); if (!ready) await wait(250); }
    if (!ready) throw new Error(`?shot=${row.shot} did not show ${landmark}`);
    await wait(2500);
    for (const control of [row.open || []].flat()) {
      // A dispatched click, not .click(): an SVG map node has no click().
      const opened = await ev(`(() => { const b = document.querySelector(${JSON.stringify(control)}); if (!b) return false; b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; })()`);
      if (!opened) throw new Error(`opening control ${control} not found`);
      await wait(1500);
    }
    const settle = async () => {
      // A tooltip is a layer of its own; Escape peels it first by design.
      await ev("document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); 0");
      await wait(150);
    };
    return { ev, settle, close: () => cdp.send('Target.closeTarget', { targetId }), sessionId };
  }

  const press = {
    async key(p) {
      for (const type of ['keyDown', 'keyUp']) await cdp.send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }, p.sessionId);
    },
    async pad(p) {
      await p.ev('__escapePad.connect(); 0');
      await wait(120);
      await p.ev('__escapePad.set(1, true); 0');
      await wait(120);
      await p.ev('__escapePad.set(1, false); 0');
    },
  };

  let red = 0;
  for (const row of rows) {
    let clicked = null;
    if (row.expect === 'back') {
      let p;
      try {
        p = await page(row);
        await p.settle();
        const found = await p.ev(`(() => { const b = document.querySelector(${JSON.stringify(row.back)}); if (!b) return false; b.click(); return true; })()`);
        await wait(1200);
        clicked = found ? await p.ev(SIGNATURE) : null;
      } catch (error) {
        console.log(`    ${row.id}: the clicked load failed: ${error.message}`);
      } finally {
        await p?.close();
      }
    }
    for (const input of ['key', 'pad']) {
      const label = `${row.id.padEnd(11)} ${input === 'key' ? 'Escape' : 'pad B '}`;
      let p;
      try {
        p = await page(row);
        await p.settle();
        if (row.mount && !(await p.ev(MOUNTS[row.mount]))) throw new Error(`layer ${row.mount} did not open`);
        if (row.needs && !(await p.ev(`!!document.querySelector(${JSON.stringify(row.needs)})`))) throw new Error(`${row.needs} is not showing`);
        const before = JSON.parse(await p.ev(SIGNATURE));
        if (row.expect === 'back' || row.expect === 'popover' || row.expect === 'layer') {
          await p.ev(`(() => { window.__backRuns = 0; document.querySelector(${JSON.stringify(row.back)})?.addEventListener('click', () => { window.__backRuns += 1; }, true); })()`);
        }
        await press[input](p);
        await wait(1200);
        const after = JSON.parse(await p.ev(SIGNATURE));
        let ok = false;
        let note = '';
        if (row.expect === 'back') {
          const runs = await p.ev('window.__backRuns ?? -1');
          ok = runs === 1 && clicked !== null && JSON.stringify(after) === clicked;
          note = `Back ran ${runs}x; ${JSON.stringify(after) === clicked ? 'same page as a click' : `page ${JSON.stringify(after)} vs click ${clicked}`}`;
        } else if (row.expect === 'peel') {
          ok = before.modals >= 1 && after.modals === before.modals - 1 && after.screen === before.screen && after.fight === before.fight;
          note = `dialogs ${before.modals} -> ${after.modals}; screen ${after.screen === before.screen ? 'unchanged' : 'CHANGED'}`;
        } else if (row.expect === 'popover') {
          const runs = await p.ev('window.__backRuns ?? -1');
          ok = before.popover >= 1 && after.popover === before.popover - 1 && runs === 0 && after.screen === before.screen && after.pane === before.pane;
          note = `popovers ${before.popover} -> ${after.popover}; Back ran ${runs}x; screen ${after.screen === before.screen ? 'unchanged' : 'CHANGED'}`;
        } else if (row.expect === 'layer') {
          const runs = await p.ev('window.__backRuns ?? -1');
          const open = await p.ev('window.__layerOpen()');
          ok = !open && runs === 0 && after.screen === before.screen && after.modals === before.modals && after.tray === before.tray;
          note = `${row.mount} ${open ? 'STILL OPEN' : 'closed'}; Back ran ${runs}x; screen ${after.screen === before.screen ? 'unchanged' : 'CHANGED'}`;
        } else if (row.expect === 'leave') {
          const there = await p.ev(`!!document.querySelector(${JSON.stringify(row.to)})`);
          ok = there && after.modals === before.modals;
          note = there ? `reached ${row.to}` : `did not reach ${row.to}: ${JSON.stringify(after)}`;
        } else {
          ok = JSON.stringify(after) === JSON.stringify(before);
          note = ok ? `no Back — ${row.why}` : `MOVED ${JSON.stringify(before)} -> ${JSON.stringify(after)}`;
        }
        if (!ok) red += 1;
        console.log(`${ok ? 'OK ' : 'RED'} ${label} ${row.expect.padEnd(5)} ${note}`);
      } catch (error) {
        red += 1;
        console.log(`RED ${label} ${row.expect.padEnd(5)} ${error.message}`);
      } finally {
        await p?.close();
      }
    }
  }
  console.log(`\n${rows.length} screens x 2 inputs, ${red} red. Not driven here: ${NOT_DRIVEN.map(([name]) => name).join('; ')}.`);
  cdp.close();
  await launched.close();
  server.close();
  return red;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const red = await main();
  process.exit(process.argv.includes('--check') && red ? 1 : 0);
}
