#!/usr/bin/env node
// tools/flask-menu-probe.mjs — every flask menu, opened in Chromium.
//
// WHY THIS FILE EXISTS (FINISH §11, from the #1447 review; D36). The flask
// action contract (tools/flask-action-contract.mjs) proved that combat, the map
// and the run HUD share one action plan partly by READING their source: regexes
// over the shipped spelling, which an equivalent spelling slips past and which
// say nothing about what a player is offered or what a choice does. This tool
// asks the screens instead, through the real game served from this tree.
//
// THREE PROBES (run all, or one with `--only <name>`):
//
//   persistence  `?shot=map` with "Use flasks outside combat" OFF. The map's
//                Potions list refuses Drink with the setting's reason; the
//                player turns the setting ON through the real Settings door
//                (Menu → Settings → search → the toggle) and closes it; the
//                list now offers Drink, and a destination selected before
//                the change is still selected with its tray open. Drinking calls the map's onChange: the
//                run is SAVED (the slot's flask ledger drops by one, the stored
//                setting is on) and the map REMOUNTS (a new Potions control,
//                the mini's count one lower). After that remount the setting
//                still holds — Drink is still offered — and a second Drink
//                saves and empties the flask, whose Drink is then refused with
//                the empty reason. Then `?shot=atlas`: the world atlas is a
//                map screen with no Potions control, so turning the setting on
//                there must leave it mounted with the destination the player
//                selected. It judges THAT the run is saved, not which
//                call saved it: dropping only the onChange's own onSave leaves
//                the run saved (observed: the remounted map commits through
//                onSave too), so that edit is not a known-bad here.
//   dispatch     the real Potions control (components/runPotions.js) mounted in
//                the page on a real run (real registries, a Crimson Flask and
//                two Blight Coatings carried) with the setting ON. Every row of
//                every mini's flask menu, and every row of the Potions list, is
//                chosen on a fresh run: the run must change by exactly what that
//                action means (Use a charge flask spends one of ITS charges;
//                Drop a carried potion removes one of IT; Inspect opens the
//                inspect modal and changes nothing; a refused row changes
//                nothing) and onChange rings exactly when the run changed. Each
//                mini's menu, carried potions included, must equal the shared
//                plan (this host draws every mini; the map's own tray folds
//                some into its overflow). The same list with the setting OFF
//                must refuse Drink.
//   plan         the offered actions against the shared flaskActionPlan
//                (src/model/flaskActions.js, imported in the page), for the
//                Crimson (hp) and Azure (mana) flasks and the carried potions
//                (the combat pose carries two; the map pages carry a Crimson
//                Flask and two Blight Coatings through `?shotCarried`):
//                  · combat (`?shot=combat`): every fold of the Potions list,
//                    every action the combat plan names (Use, and Inspect: the
//                    fold opening the potion's card) read AND exercised (Inspect
//                    inert, Use asking first and cancelled), before and after
//                    the Azure flask is drunk to empty;
//                  · the map Potions list and minis, setting OFF and ON, and ON
//                    after the Azure flask is drunk to empty;
//                  · the run HUD's room-rail icons, setting OFF and ON and after
//                    the Azure flask is drunk there. The rail is off by config
//                    (`hud.potions.roomRail`), so this probe serves the game's
//                    own config module with that one row turned on (CDP Fetch),
//                    exactly as a designer flipping it would.
//                A menu's rows must equal the plan's actions (id, label,
//                enabled, and the refusal reason where the surface states one);
//                a list's verb must be enabled exactly when the plan's is.
//
//   node tools/flask-menu-probe.mjs [--only persistence|dispatch|plan]
//   node tools/flask-menu-probe.mjs --selftest [--shard i/n]   plants each
//                       known-bad in a copy of the tree, requires red
//   FLASK_MENU_PORT=<n>   serve on another port (default 8597)
//   CHROME=<path>         the browser (tools/browser.mjs)
//
// Exit 0 green, 1 red, 2 harness (no browser, or a screen never mounted).
// It serves the SOURCE tree (no build, no LFS).
//
// BOUNDARY. It proves what the three surfaces OFFER and what a choice on the
// map DOES. It does not drive co-op's flask intent or the host's refusal (the
// contract's co-op half and tools/coop-hud-top.mjs do), nor combat's confirm
// beyond the one Azure drink it needs to reach an empty flask (every other Use
// it taps there is cancelled at the question).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchBrowser, resolveBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.FLASK_MENU_PORT) || 8597;
const PROBES = ['persistence', 'dispatch', 'plan'];
const SETTING = 'useRestorativeFlasksOutsideCombat';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

if (process.argv.includes('--selftest')) {
  // `--shard i/n` runs the plants at index i mod n (tools/doorplant.mjs SHARDS),
  // so ci.yml can spread the corpus over legs under the 20-minute job rule.
  const { doorSelftest, resolveShard, selectShard } = await import('./doorplant.mjs');
  const options = {
    shard: resolveShard(),
    tool: 'flask-menu-probe.mjs',
    timeoutMs: 240000,
    plants: [
      {
        name: 'the map stops redrawing when "Use flasks outside combat" changes (the bug this tool found)',
        file: 'src/main.js',
        find: "const FLASK_REMOUNT_KEYS = ['useRestorativeFlasksOutsideCombat'];",
        replace: 'const FLASK_REMOUNT_KEYS = [];',
        args: ['--only', 'persistence'],
        expectRed: /FAIL persistence: the setting turned on in Settings reaches the map Potions list/,
      },
      {
        name: 'the act map drops the selected destination when "Use flasks outside combat" changes',
        file: 'src/main.js',
        find: '  if (mapKey || flaskKey) showMap({ selectedId });',
        replace: '  if (mapKey || flaskKey) showMap();',
        args: ['--only', 'persistence'],
        expectRed: /FAIL persistence: the map keeps the selected destination, its tray open, across the setting's redraw/,
      },
      {
        name: 'the act map restores the selected node without its reading',
        file: 'src/ui/screens/map.js',
        find: '    if (reading) readings.set(selectedId, reading);',
        replace: '',
        args: ['--only', 'persistence'],
        expectRed: /FAIL persistence: the reopened tray names the destination as it did before the redraw/,
      },
      {
        name: 'a legacy dungeon drops the selected node when "Use flasks outside combat" changes',
        file: 'src/main.js',
        find: '  if (run.legacyDungeon) return showLegacyDungeon({ selectedId });',
        replace: '  if (run.legacyDungeon) return showLegacyDungeon();',
        args: ['--only', 'persistence'],
        expectRed: /FAIL persistence: legacy dungeon, the selected node, its tray open and named as before, survives/,
      },
      {
        name: 'the world atlas remounts when "Use flasks outside combat" changes, losing its selected destination',
        file: 'src/main.js',
        find: "const flaskKey = FLASK_REMOUNT_KEYS.some((k) => k in changed) && !!screen.querySelector('.map-potions, .hud-potions');",
        replace: 'const flaskKey = FLASK_REMOUNT_KEYS.some((k) => k in changed);',
        args: ['--only', 'persistence'],
        expectRed: /FAIL persistence: atlas, turning the setting on keeps the atlas and its selected destination/,
      },
      {
        name: 'the map stops remounting after a Potions action',
        file: 'src/ui/screens/map.js',
        find: 'onChange: () => { onSave?.(); remount(); }',
        replace: 'onChange: () => { onSave?.(); }',
        args: ['--only', 'persistence'],
        expectRed: /FAIL persistence: the first Drink remounts the map/,
      },
      {
        name: 'the map hands its Potions control a stand-in run instead of the live one',
        file: 'src/ui/screens/map.js',
        find: 'mountRunPotions(potionsHost, { registries, run, meta,',
        replace: 'mountRunPotions(potionsHost, { registries, run: structuredClone(run), meta,',
        args: ['--only', 'persistence'],
        expectRed: /FAIL persistence: the first Drink is saved/,
      },
      {
        name: 'the Potions list dispatches Use whatever its row offers',
        file: 'src/ui/components/runPotions.js',
        find: 'onAction(entry, verb.id);',
        replace: "onAction(entry, 'use');",
        args: ['--only', 'dispatch'],
        expectRed: /FAIL dispatch: list Drop Blight Coating/,
      },
      {
        name: 'a Potions mini dispatches Drop whatever row was chosen',
        file: 'src/ui/components/runPotions.js',
        find: 'onAction: (actionId) => act(entry, actionId),',
        replace: "onAction: () => act(entry, 'drop'),",
        args: ['--only', 'dispatch'],
        expectRed: /FAIL dispatch: mini charge:hp → use/,
      },
      {
        name: 'a carried Potions mini offers Use and refuses Drop (a charge flask\'s plan)',
        file: 'src/ui/components/runPotions.js',
        find: "def, plan: planFor(entry), charges: entry.category === 'charge' ? entry.count : null,",
        replace: "def, plan: entry.category === 'carried' ? runPotionPlan({ ...entry, category: 'charge' }, { drinkOutsideCombat: true }) : planFor(entry), charges: entry.category === 'charge' ? entry.count : null,",
        args: ['--only', 'dispatch'],
        expectRed: /FAIL dispatch: mini carried:crimsonFlask's flask menu offers the shared plan/,
      },
      {
        name: 'the map Potions control ignores the "Use flasks outside combat" setting',
        file: 'src/ui/components/runPotions.js',
        find: "const drinkOutsideCombat = settingOn(meta.settings, 'useRestorativeFlasksOutsideCombat');",
        replace: 'const drinkOutsideCombat = true;',
        args: ['--only', 'plan'],
        expectRed: /FAIL plan: map minis, setting off/,
      },
      {
        name: 'combat offers Use whatever the charges say',
        file: 'src/ui/components/combatActionRow.js',
        find: 'const canUse = !reason;',
        replace: 'const canUse = true;',
        args: ['--only', 'plan'],
        expectRed: /FAIL plan: combat, Azure drunk to empty/,
      },
      {
        name: 'combat refuses Use on every carried potion',
        file: 'src/ui/components/combatActionRow.js',
        find: 'const canUse = !reason;',
        replace: 'const canUse = !reason && chargeKind != null;',
        args: ['--only', 'plan'],
        expectRed: /FAIL plan: combat, opening hand, carried potions/,
      },
      {
        name: 'combat\'s Potions list loses Inspect (a fold opens no detail card)',
        file: 'src/ui/components/combatActionRow.js',
        find: '      fold.append(summary, detail);',
        replace: '      fold.append(summary);',
        args: ['--only', 'plan'],
        expectRed: /FAIL plan: combat, opening hand, hp flask: every action \(Use, Inspect\) matches the shared plan/,
      },
      {
        name: 'combat\'s Potions list breaks Inspect (a fold that does not open)',
        file: 'src/ui/components/combatActionRow.js',
        find: "      const fold = el('details', { class: 'armoury-card-row potion-fold' });",
        replace: "      const fold = el('div', { class: 'armoury-card-row potion-fold' });",
        args: ['--only', 'plan'],
        expectRed: /FAIL plan: combat, opening hand, carried potions: each one's every action matches the shared plan/,
      },
      {
        name: 'one run-HUD charge flask is always usable, ignoring the setting',
        file: 'src/ui/components/runHud.js',
        find: "const canUse = settingOn(meta.settings, 'useRestorativeFlasksOutsideCombat') && current > 0;",
        replace: 'const canUse = current > 0;',
        args: ['--only', 'plan'],
        expectRed: /FAIL plan: run HUD, setting off/,
      },
      {
        name: 'the run HUD drops the shared plan\'s Drop row',
        file: 'src/ui/components/runHud.js',
        find: '          def, plan, charges: current, onCancel: () => {},',
        replace: "          def, plan: { ...plan, actions: plan.actions.filter((a) => a.id !== 'drop') }, charges: current, onCancel: () => {},",
        args: ['--only', 'plan'],
        expectRed: /FAIL plan: run HUD, setting off/,
      },
      {
        name: 'a run-HUD carried potion offers Use outside combat',
        file: 'src/ui/components/runHud.js',
        find: "          canUse: false,\n          useReason: 'Flasks can only be used in combat',",
        replace: "          canUse: true,\n          useReason: 'Flasks can only be used in combat',",
        args: ['--only', 'plan'],
        expectRed: /FAIL plan: run HUD carried icons, setting off/,
      },
      {
        name: 'the run HUD drops a carried potion\'s Drop row',
        file: 'src/ui/components/runHud.js',
        find: '          def,\n          plan,\n          onCancel: () => {},',
        replace: "          def,\n          plan: { ...plan, actions: plan.actions.filter((a) => a.id !== 'drop') },\n          onCancel: () => {},",
        args: ['--only', 'plan'],
        expectRed: /FAIL plan: run HUD carried icons, setting off/,
      },
    ],
  };
  const code = await doorSelftest(options);
  if (code === 0) console.log(`flask-menu-probe --selftest: OK — ${selectShard(options.plants, options.shard).length} checks passed`);
  process.exit(code);
}

// A deadline per CDP command (#1474 review; tools/displayfirst.mjs has the same
// two safeguards). Without them a Chromium that exits, a socket that closes or a
// command the renderer drops leaves an awaited send() pending until the CI
// step's own limit, with no verdict printed. Both end in a HARNESS exit (2):
// nothing after them was measured. The longest in-page evaluate here (the
// dispatch probe's every-row walk) takes about 20 s, so it gets 120 s and every
// other command 30 s. They are deadlines, not performance budgets.
const CDP_TIMEOUT_MS = 30000;
const CDP_EVALUATE_TIMEOUT_MS = 120000;
const harnessError = (message) => Object.assign(new Error(message), { harness: true });

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  let dead = null;
  const killPending = (why) => {
    dead = dead || why;
    for (const [, p] of pending) { clearTimeout(p.timer); p.fail(harnessError(`${p.method}: ${why}`)); }
    pending.clear();
  };
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method) for (const fn of listeners) fn(msg);
    if (!msg.id || !pending.has(msg.id)) return;
    const { done, fail, timer } = pending.get(msg.id);
    pending.delete(msg.id);
    clearTimeout(timer);
    if (msg.error) fail(new Error(msg.error.message)); else done(msg.result);
  });
  ws.addEventListener('close', () => killPending('the DevTools socket closed with the command in flight (Chromium is gone)'));
  ws.addEventListener('error', (e) => killPending(`the DevTools socket errored with the command in flight (${e?.message || e?.error?.message || 'no detail'})`));
  return {
    ready: new Promise((done, fail) => {
      ws.addEventListener('open', done);
      ws.addEventListener('error', () => fail(harnessError('the DevTools socket failed to open')));
      ws.addEventListener('close', () => fail(harnessError('the DevTools socket closed before it opened')));
    }),
    send(method, params = {}, sessionId) {
      if (dead) return Promise.reject(harnessError(`${method} was not sent: ${dead}`));
      const id = nextId++;
      const ms = method === 'Runtime.evaluate' ? CDP_EVALUATE_TIMEOUT_MS : CDP_TIMEOUT_MS;
      return new Promise((done, fail) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          fail(harnessError(`CDP ${method} did not answer within ${ms} ms (a blocked renderer or a dropped command); nothing after it was measured`));
        }, ms);
        timer.unref?.();
        pending.set(id, { done, fail, timer, method });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    on: (fn) => listeners.add(fn),
    close: () => ws.close(),
  };
}

// In-page helpers, installed after every navigation. Each returns plain data.
const HELPERS = `(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, tries = 40) => { for (let i = 0; i < tries; i++) { const v = fn(); if (v) return v; await sleep(50); } return null; };
  const modalOf = (cls) => document.querySelector('.' + cls);
  const closeModal = async (cls) => {
    const m = modalOf(cls); if (!m) return;
    const root = m.closest('.modal-veil') || m;
    (root.querySelector('.modal-close') || m.querySelector('.modal-close'))?.click();
    await until(() => !modalOf(cls));
  };
  // A flask menu's rows as the player reads them.
  const menuRows = () => [...document.querySelectorAll('.flask-action-menu .flask-action')].map((b) => ({
    id: b.dataset.flaskAction, label: (b.querySelector('.r-label')?.textContent || b.textContent).trim(),
    enabled: b.getAttribute('aria-disabled') === 'false', reason: b.dataset.unavailableReason || '',
  }));
  const closeMenu = async () => {
    if (!document.querySelector('.flask-action-menu')) return;
    document.querySelector('.flask-action-menu').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await until(() => !document.querySelector('.flask-action-menu'));
  };
  // Open an icon's flask menu the way a player taps it: the first tap
  // explains, the second opens the menu. (A synthetic Enter is not used: the
  // map's own key handler can take it as "enter the selected room".)
  const openMenu = async (node) => {
    await closeMenu();
    for (let tap = 0; tap < 2 && !document.querySelector('.flask-action-menu'); tap++) {
      node.click();
      await sleep(60);
    }
    return !!(await until(() => document.querySelector('.flask-action-menu'), 20));
  };
  const count = (node) => Number(node?.querySelector('.stk')?.textContent);
  // The map Potions list's rows: name → { label, enabled, meta }.
  const mapList = async (scope = document) => {
    await closeModal('run-potion-menu');
    const control = await until(() => scope.querySelector('.run-potions-btn'));
    if (!control) throw new Error('no Potions control on screen: ' + (document.querySelector('#app')?.firstElementChild?.className || document.body.firstElementChild?.className));
    control.click();
    const menu = await until(() => modalOf('run-potion-menu'));
    if (!menu) return null;
    const rows = {};
    for (const card of menu.querySelectorAll('[data-potion-key]')) {
      const b = card.querySelector('.run-potion-act');
      rows[card.dataset.potionKey] = { label: b?.textContent.trim() || '', aria: b?.getAttribute('aria-label') || '', enabled: !!b && !b.disabled, text: card.textContent };
    }
    return rows;
  };
  const clickListVerb = async (key, scope = document) => {
    await mapList(scope);
    const b = modalOf('run-potion-menu')?.querySelector('[data-potion-key="' + key + '"] .run-potion-act');
    if (!b) return false;
    b.click();
    await sleep(250);
    await closeModal('run-potion-menu');
    return true;
  };
  window.__fm = { sleep, until, closeModal, menuRows, closeMenu, openMenu, count, mapList, clickListVerb };
  return true;
})()`;

async function openPage(cdp, base, query, { fetchOverride = null, ready: readySelector = null } = {}) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
  if (fetchOverride) {
    cdp.on((msg) => {
      if (msg.method !== 'Fetch.requestPaused' || msg.sessionId !== sessionId) return;
      cdp.send('Fetch.fulfillRequest', {
        requestId: msg.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'text/javascript; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store' }],
        body: Buffer.from(fetchOverride.body).toString('base64'),
      }, sessionId).catch(() => {});
    });
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: `*${fetchOverride.path}*`, requestStage: 'Request' }] }, sessionId);
  }
  const errors = [];
  cdp.on((msg) => {
    if (msg.sessionId === sessionId && msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || 'exception');
  });
  const ev = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (r.exceptionDetails) throw new Error(`page threw: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result?.value;
  };
  await cdp.send('Page.navigate', { url: `${base}index.html?${query}` }, sessionId);
  const ready = readySelector || (query.includes('shot=combat') ? '.combat-potions' : '.run-potions-btn');
  let mounted = false;
  for (let t = 0; t < 90 && !mounted; t++) { await wait(400); mounted = await ev(`!!document.querySelector('${ready}')`).catch(() => false); }
  if (!mounted) throw Object.assign(new Error(`?${query}: ${ready} never mounted${errors.length ? ` (${errors[0]})` : ''}`), { harness: true });
  await wait(600);
  await ev(HELPERS);
  return { ev, errors, close: () => cdp.send('Target.closeTarget', { targetId }) };
}

const settingsQuery = (on) => `shotSettings=${encodeURIComponent(JSON.stringify({ [SETTING]: on }))}`;
// What the shared plan says a surface must offer, computed IN THE PAGE from the
// imported model, so the comparison is against the game's own module.
const PLAN = `(async () => {
  const { flaskActionPlan } = await import('/src/model/flaskActions.js');
  const { t } = await import('/src/ui/strings.js');
  const rows = (plan) => plan.actions.map(({ id, label, enabled, reason }) => ({ id, label, enabled, reason }));
  window.__fmPlan = {
    // The map's Potions control: models/RunPotionModel.js's documented inputs.
    mapCharge: (on, count) => rows(flaskActionPlan({ context: 'run', canUse: on && count > 0,
      useReason: count <= 0 ? t('potions.run.empty') : t('potions.run.setting'), canDrop: false, dropReason: t('potions.run.keep') })),
    // The run HUD: the same availability; it words its own refusals.
    hudCharge: (on, count) => rows(flaskActionPlan({ context: 'run', canUse: on && count > 0, canDrop: false })),
    // A carried potion on the map: combat only, and it may be dropped here.
    mapCarried: () => rows(flaskActionPlan({ context: 'run', canUse: false, useReason: t('potions.run.combatOnly'), canDrop: true })),
    hudCarried: () => rows(flaskActionPlan({ context: 'run', canUse: false, canDrop: true })),
    combat: (count) => rows(flaskActionPlan({ context: 'combat', canUse: count > 0 })),
    t,
  };
  return true;
})()`;

// Select the map's first reachable node the way a tap does; report the tray.
const READ_SELECTION = `(async () => {
  const open = await __fm.until(() => document.querySelector('.map-tray')?.dataset.shown === 'true');
  const tray = [...document.querySelectorAll('.map-context .map-context-title, .map-context .map-context-line')].map((p) => p.textContent.trim());
  return { open: !!open, selected: document.querySelector('.map-node.selected')?.dataset.node || null, tray };
})()`;
const SELECT_AND_READ = `(async () => {
  await __fm.closeModal('run-potion-menu');
  const node = document.querySelector('.mapscreen .map-node.reachable');
  if (!node) return { why: 'no reachable node' };
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return { id: node.dataset.node, ...(await ${READ_SELECTION}) };
})()`;

// The real Settings door: the screen's Menu → Settings → search → the toggle →
// close. '' when the setting turned on, else what went wrong.
const TOGGLE_SETTING = (opener) => `(async () => {
  await __fm.closeModal('run-potion-menu');
  document.querySelector('${opener}').click();
  const tab = await __fm.until(() => document.querySelector('.qn-row[data-tab="settings"]'));
  if (tab) tab.click(); else if (!document.querySelector('.ov-tab')) return 'no Settings door';
  const search = await __fm.until(() => document.querySelector('[data-search-toggle]'));
  if (!search) return 'no Settings search';
  search.click();
  const input = document.querySelector('[data-advanced-search]');
  input.value = 'outside combat';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const toggle = await __fm.until(() => document.querySelector('[data-key="${SETTING}"]'));
  if (!toggle) return 'the "Use flasks outside combat" row did not appear';
  if (toggle.getAttribute('aria-checked') !== 'false') return 'the toggle did not start off';
  toggle.click();
  await __fm.sleep(300);
  const on = document.querySelector('[data-key="${SETTING}"]')?.getAttribute('aria-checked');
  document.querySelector('.modal-close[aria-label="Close menu"]')?.click();
  await __fm.sleep(400);
  return on === 'true' ? '' : 'the toggle did not turn on';
})()`;

// ---------------------------------------------------------------------------
async function persistenceProbe(cdp, base, check) {
  const page = await openPage(cdp, base, `shot=map&${settingsQuery(false)}`);
  const { ev } = page;
  try {
    await ev(PLAN);
    const before = await ev(`__fm.mapList()`);
    const refusal = await ev(`__fmPlan.t('potions.run.setting')`);
    check('persistence: with the setting off, the map Potions list refuses Drink with its reason',
      before && before['charge:hp'] && !before['charge:hp'].enabled && before['charge:hp'].text.includes(refusal),
      JSON.stringify(before?.['charge:hp']));
    // A destination selected before the change (the tray open on it) must
    // survive the flask-only redraw (#1474 review).
    const picked = await ev(`(async () => {
      await __fm.closeModal('run-potion-menu');
      const node = document.querySelector('.mapscreen .map-node.reachable');
      if (!node) return { why: 'no reachable node' };
      node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const open = await __fm.until(() => document.querySelector('.map-tray')?.dataset.shown === 'true');
      // What the tray says about it: the kind's name and its lines.
      const tray = [...document.querySelectorAll('.map-context .map-context-title, .map-context .map-context-line')].map((p) => p.textContent.trim());
      return { id: node.dataset.node, open: !!open, selected: document.querySelector('.map-node.selected')?.dataset.node, tray };
    })()`);
    check('persistence: a reachable node is selected and its tray opens',
      !picked.why && picked.open && picked.selected === picked.id, JSON.stringify(picked));
    const toggled = await ev(TOGGLE_SETTING('#open-menu'));
    check('persistence: the setting turns on through Menu → Settings', toggled === '', toggled);
    const keptPick = await ev(`(async () => {
      const open = await __fm.until(() => document.querySelector('.map-tray')?.dataset.shown === 'true');
      const tray = [...document.querySelectorAll('.map-context .map-context-title, .map-context .map-context-line')].map((p) => p.textContent.trim());
      return { open: !!open, selected: document.querySelector('.map-node.selected')?.dataset.node || null, tray };
    })()`);
    check('persistence: the map keeps the selected destination, its tray open, across the setting\'s redraw',
      keptPick.open && keptPick.selected === picked.id, JSON.stringify({ ...keptPick, want: picked.id }));
    check('persistence: the reopened tray names the destination as it did before the redraw (kind, blurb, reveal)',
      Array.isArray(picked.tray) && picked.tray.length > 1 && JSON.stringify(keptPick.tray) === JSON.stringify(picked.tray),
      JSON.stringify({ before: picked.tray, after: keptPick.tray }));
    const after = await ev(`__fm.mapList()`);
    check('persistence: the setting turned on in Settings reaches the map Potions list (Drink offered)',
      after && after['charge:hp']?.enabled === true, JSON.stringify(after?.['charge:hp']));
    const savedSetting = await ev(`window.__flasks().savedOutsideCombat`);
    check('persistence: the setting is saved to the profile', savedSetting === true, `saved ${savedSetting}`);
    // First Drink: the run changes, is saved, and the map remounts.
    const first = await ev(`(async () => {
      const before = window.__flasks();
      const old = document.querySelector('.run-potions-btn');
      const clicked = await __fm.clickListVerb('charge:hp');
      await __fm.sleep(300);
      const now = document.querySelector('.run-potions-btn');
      return { clicked, before, after: window.__flasks(), remounted: !old.isConnected && !!now && now !== old,
        mini: __fm.count(document.querySelector('.map-potions .potion-mini[data-potion-key="charge:hp"]')) };
    })()`);
    const want = first.before.charges.hp - 1;
    check('persistence: the first Drink is saved (the slot\'s Crimson charges drop by one)',
      first.clicked && first.after.charges.hp === want && first.after.savedCharges?.hp === want
        && first.after.savedCharges?.mana === first.before.charges.mana,
      JSON.stringify(first));
    check('persistence: the first Drink remounts the map (a new Potions control, the mini shows the new count)',
      first.remounted && first.mini === want, JSON.stringify({ remounted: first.remounted, mini: first.mini, want }));
    // After the remount the setting still holds, and a second Drink saves too.
    const again = await ev(`__fm.mapList()`);
    check('persistence: after the remount the setting still holds (Drink still offered)',
      again && again['charge:hp']?.enabled === (want > 0), JSON.stringify(again?.['charge:hp']));
    let left = want;
    for (let i = 0; i < want; i++) {
      const step = await ev(`(async () => { await __fm.clickListVerb('charge:hp'); await __fm.sleep(300); return window.__flasks(); })()`);
      left = step.savedCharges?.hp;
    }
    const empty = await ev(`__fm.mapList()`);
    const emptyReason = await ev(`__fmPlan.t('potions.run.empty')`);
    check('persistence: drinking to empty is saved, and the remounted list then refuses Drink with the empty reason',
      left === 0 && empty && empty['charge:hp']?.enabled === false && empty['charge:hp'].text.includes(emptyReason),
      JSON.stringify({ left, row: empty?.['charge:hp'] }));
    await ev(`__fm.closeModal('run-potion-menu')`);
    check('persistence: no page error', page.errors.length === 0, page.errors.join(' | '));
  } finally { await page.close(); }

  // A LEGACY DUNGEON is another mountMap surface with a Potions control
  // (showMap → showLegacyDungeon → mountLegacyDungeon): the same change keeps
  // its selected node, tray open and named as before (#1474 review).
  const dungeon = await openPage(cdp, base, `shot=map&shotDungeon=BS&${settingsQuery(false)}`);
  try {
    const before = await dungeon.ev(SELECT_AND_READ);
    check('persistence: legacy dungeon, a reachable node is selected and its tray opens',
      !before.why && before.open && before.selected === before.id && before.tray.length > 0, JSON.stringify(before));
    const toggled = await dungeon.ev(TOGGLE_SETTING('#open-menu'));
    check('persistence: legacy dungeon, the setting turns on through Menu → Settings', toggled === '', toggled);
    const after = await dungeon.ev(READ_SELECTION);
    const drink = await dungeon.ev(`(async () => { const l = await __fm.mapList(); await __fm.closeModal('run-potion-menu'); return l && l['charge:hp']; })()`);
    check('persistence: legacy dungeon, the setting reaches its Potions list (Drink offered)', drink?.enabled === true, JSON.stringify(drink));
    check('persistence: legacy dungeon, the selected node, its tray open and named as before, survives the setting\'s redraw',
      after.open && after.selected === before.id && JSON.stringify(after.tray) === JSON.stringify(before.tray),
      JSON.stringify({ before, after }));
    check('persistence: legacy dungeon, no page error', dungeon.errors.length === 0, dungeon.errors.join(' | '));
  } finally { await dungeon.close(); }

  // THE WORLD ATLAS is a `.mapscreen` too, with no Potions control. Turning the
  // setting on there must not remount it: the atlas keeps the player's selected
  // destination only in the mounted screen (#1474 review).
  const atlas = await openPage(cdp, base, `shot=atlas&${settingsQuery(false)}`, { ready: '.world-atlas-screen' });
  try {
    const picked = await atlas.ev(`(async () => {
      const current = document.querySelector('.atlas-node.current')?.dataset.atlasNode;
      const road = [...document.querySelectorAll('.atlas-road-list [data-atlas-node]')].find((b) => b.dataset.atlasNode !== current);
      if (!road) return { why: 'the atlas offers no road to select' };
      road.click();
      await __fm.sleep(200);
      window.__fmAtlas = document.querySelector('.world-atlas-screen');
      return { id: road.dataset.atlasNode, current, pressed: document.querySelector('.atlas-node[aria-pressed="true"]')?.dataset.atlasNode };
    })()`);
    check('persistence: atlas, a road other than the current place can be selected',
      !picked.why && picked.pressed === picked.id && picked.id !== picked.current, JSON.stringify(picked));
    const toggled = await atlas.ev(TOGGLE_SETTING('[data-atlas-menu]'));
    check('persistence: atlas, the setting turns on through its Menu → Settings', toggled === '', toggled);
    const kept = await atlas.ev(`({ same: !!window.__fmAtlas?.isConnected, pressed: document.querySelector('.atlas-node[aria-pressed="true"]')?.dataset.atlasNode })`);
    check('persistence: atlas, turning the setting on keeps the atlas and its selected destination (no remount)',
      kept.same && kept.pressed === picked.id, JSON.stringify({ ...kept, want: picked.id }));
    check('persistence: atlas, no page error', atlas.errors.length === 0, atlas.errors.join(' | '));
  } finally { await atlas.close(); }
}

// ---------------------------------------------------------------------------
// The real Potions control on a real run, mounted in the page. `case` picks one
// choice; each choice gets a fresh run so the diff is that choice's alone.
const DISPATCH = (on) => `(async () => {
  const { contentBundle } = await import('/src/content/index.js');
  const { createRegistries } = await import('/src/model/registries.js');
  const { createRunState } = await import('/src/model/state.js');
  const { mountRunPotions } = await import('/src/ui/components/runPotions.js');
  const registries = createRegistries(contentBundle);
  const meta = { settings: { ${SETTING}: ${on} } };
  const snap = (run) => ({ hp: run.flaskCharges.hpCurrent, mana: run.flaskCharges.manaCurrent, carried: run.flasks.map((f) => f.flaskId) });
  const fresh = () => {
    document.querySelector('.fm-dispatch')?.remove();
    const run = createRunState({ seed: 0x5eed, classId: 'reaver', registries });
    run.flaskCharges.hpCurrent = Math.max(2, run.flaskCharges.hpCurrent);
    run.flaskCharges.manaCurrent = Math.max(1, run.flaskCharges.manaCurrent);
    run.flasks = [{ flaskId: 'crimsonFlask' }, { flaskId: 'blightCoating' }, { flaskId: 'blightCoating' }];
    const screen = document.createElement('div');
    screen.className = 'mapscreen fm-dispatch';
    screen.style.cssText = 'position:fixed;inset:0;z-index:5000;background:#000';
    const host = document.createElement('div');
    host.className = 'map-potions';
    screen.appendChild(host);
    document.body.appendChild(screen);
    const ctx = { run, host, changes: 0 };
    const mount = () => mountRunPotions(host, { registries, run, meta, onChange: () => { ctx.changes++; mount(); } });
    mount();
    return ctx;
  };
  const out = [];
  // Every mini, every row of its menu.
  const keys = [...fresh().host.querySelectorAll('.potion-mini')].map((n) => n.dataset.potionKey);
  for (const key of keys) {
    const ctx0 = fresh();
    const opened = await __fm.openMenu(ctx0.host.querySelector('.potion-mini[data-potion-key="' + key + '"]'));
    const rows = opened ? __fm.menuRows() : [];
    await __fm.closeMenu();
    // The menu as offered, for the plan comparison (every mini, carried ones too).
    out.push({ via: 'menu', key, count: __fm.count(ctx0.host.querySelector('.potion-mini[data-potion-key="' + key + '"]')), rows: opened ? rows : null });
    for (const row of rows) {
      const ctx = fresh();
      const before = snap(ctx.run);
      await __fm.openMenu(ctx.host.querySelector('.potion-mini[data-potion-key="' + key + '"]'));
      document.querySelector('.flask-action-menu .flask-action[data-flask-action="' + row.id + '"]').click();
      await __fm.sleep(150);
      const inspect = !!document.querySelector('.flask-inspect-modal');
      await __fm.closeModal('flask-inspect-modal');
      await __fm.closeMenu();
      out.push({ via: 'mini', key, action: row.id, enabled: row.enabled, before, after: snap(ctx.run), changes: ctx.changes, inspect });
    }
    if (!rows.length) out.push({ via: 'mini', key, action: null });
  }
  // Every row of the Potions list: its one verb.
  for (const key of keys) {
    const ctx = fresh();
    const before = snap(ctx.run);
    const list = await __fm.mapList(ctx.host);
    const row = list && list[key];
    await __fm.clickListVerb(key, ctx.host);
    out.push({ via: 'list', key, action: row && /Drop/.test(row.label) ? 'drop' : 'use', label: row?.aria || '', enabled: !!row?.enabled, before, after: snap(ctx.run), changes: ctx.changes, inspect: false });
  }
  document.querySelector('.fm-dispatch')?.remove();
  return out;
})()`;

// What a choice must do to the run, from its entry key and action alone.
export function expectedAfter(before, key, action, enabled) {
  const after = { hp: before.hp, mana: before.mana, carried: [...before.carried] };
  if (!enabled) return after;
  const [category, id] = key.split(':');
  if (action === 'use' && category === 'charge') after[id] -= 1;
  if (action === 'drop' && category === 'carried') after.carried.splice(after.carried.indexOf(id), 1);
  return after;
}

async function dispatchProbe(cdp, base, check) {
  const page = await openPage(cdp, base, `shot=map&${settingsQuery(true)}`);
  try {
    await page.ev(PLAN);
    const all = await page.ev(DISPATCH(true));
    // Every mini's menu against the shared plan, carried potions included: this
    // host is wide enough to draw every mini, where the map's own tray folds
    // some into its overflow (#1474 review).
    const menus = all.filter((r) => r.via === 'menu');
    for (const m of menus) {
      const want = await page.ev(m.key.startsWith('charge:') ? `__fmPlan.mapCharge(true, ${m.count})` : `__fmPlan.mapCarried()`);
      check(`dispatch: mini ${m.key}'s flask menu offers the shared plan`, sameRows(m.rows, want), JSON.stringify({ got: m.rows, want }));
    }
    const on = all.filter((r) => r.via !== 'menu');
    const minis = on.filter((r) => r.via === 'mini');
    check('dispatch: every mini opens a flask menu with rows', minis.length > 0 && minis.every((r) => r.action),
      JSON.stringify(minis.filter((r) => !r.action)));
    const keys = new Set(on.map((r) => r.key));
    check('dispatch: the Potions control shows both charge flasks and both carried kinds',
      ['charge:hp', 'charge:mana', 'carried:crimsonFlask', 'carried:blightCoating'].every((k) => keys.has(k)), [...keys].join(','));
    for (const r of on.filter((x) => x.action)) {
      const want = expectedAfter(r.before, r.key, r.action, r.enabled);
      const changed = JSON.stringify(want) !== JSON.stringify(r.before);
      const label = r.via === 'list' ? `list ${r.label || r.key}` : `mini ${r.key} → ${r.action}${r.enabled ? '' : ' (refused)'}`;
      check(`dispatch: ${label} does exactly that`,
        JSON.stringify(r.after) === JSON.stringify(want) && r.changes === (changed ? 1 : 0)
          && r.inspect === (r.action === 'inspect' && r.via === 'mini'),
        JSON.stringify({ before: r.before, after: r.after, want, changes: r.changes, inspect: r.inspect }));
    }
    // The offered verbs themselves: Drink a charge flask, Drop a carried one.
    const verbs = on.filter((r) => r.via === 'list').map((r) => `${r.key}:${r.action}:${r.enabled}`).sort().join(',');
    check('dispatch: the list offers Drink for charge flasks and Drop for carried potions',
      verbs === 'carried:blightCoating:drop:true,carried:crimsonFlask:drop:true,charge:hp:use:true,charge:mana:use:true', verbs);
    const off = (await page.ev(DISPATCH(false))).filter((r) => r.via !== 'menu');
    const refused = off.filter((r) => r.via === 'list' && r.key.startsWith('charge:'));
    check('dispatch: with the setting off, choosing Drink in the list changes nothing',
      refused.length === 2 && refused.every((r) => !r.enabled && r.changes === 0 && JSON.stringify(r.after) === JSON.stringify(r.before)),
      JSON.stringify(refused));
    check('dispatch: no page error', page.errors.length === 0, page.errors.join(' | '));
  } finally { await page.close(); }
}

// ---------------------------------------------------------------------------
// The map pages carry potions (`?shotCarried`) so the carried minis and the
// run HUD's carried icons have menus to compare (#1474 review): a Crimson Flask
// and two Blight Coatings, two carried kinds.
const CARRIED = ['crimsonFlask', 'blightCoating', 'blightCoating'];
const CARRIED_KINDS = [...new Set(CARRIED)];
const carriedQuery = `shotCarried=${CARRIED.join(',')}`;

// Every entry the map draws, keyed by its WGH8 key (charge:hp, carried:<id>):
// each mini's flask menu, and the Potions list's row.
const MAP_SURFACES = `(async () => {
  const out = {};
  const keys = [...document.querySelectorAll('.map-potions .potion-mini[data-potion-key]')].map((n) => n.dataset.potionKey);
  for (const key of keys) {
    const node = document.querySelector('.map-potions .potion-mini[data-potion-key="' + key + '"]');
    const count = __fm.count(node);
    const opened = node ? await __fm.openMenu(node) : false;
    out[key] = { count, rows: opened ? __fm.menuRows() : null };
    await __fm.closeMenu();
  }
  const list = await __fm.mapList();
  await __fm.closeModal('run-potion-menu');
  for (const key of new Set([...keys, ...Object.keys(list || {})])) (out[key] ||= { count: null, rows: null }).list = list && list[key];
  return out;
})()`;

// Every icon the run HUD's room rail draws: the charge flasks by kind, the
// carried potions by flask id, under the same keys as the map.
const HUD_SURFACES = `(async () => {
  const out = {};
  const icons = [...document.querySelectorAll('.hud-potions .flask-charge[data-flask-kind]')].map((n) => ['charge:' + n.dataset.flaskKind, n])
    .concat([...document.querySelectorAll('.hud-potions .mh-flask[data-flask-id]')].map((n) => ['carried:' + n.dataset.flaskId, n]));
  for (const [key, node] of icons) {
    const count = __fm.count(node);
    const opened = await __fm.openMenu(node);
    out[key] = { count, rows: opened ? __fm.menuRows() : null };
    await __fm.closeMenu();
  }
  return out;
})()`;

// Combat's Potions list, every fold, with EVERY action it offers read and then
// exercised (#1474 review: judging Use alone let a lost Inspect pass). The
// combat plan is Use and Inspect (flaskActionPlan's combat context; SPEC: the
// combat potion menu's "selection and inspection are inert"). In this list Use
// is the fold's `.potion-use`, and Inspect is the fold itself: a <details>
// whose summary opens the potion's detail card. Any other control in a fold is
// read as a row of its own, so an action the plan lacks fails the comparison
// too. Each is exercised on a fresh list: Inspect must show the card named for
// the potion, ask nothing and spend nothing; an offered Use must ask before it
// spends and, cancelled, spend nothing; a refused Use must ask nothing. Every
// wait is for the screen to settle (until), not a fixed delay.
// Combat at rest: a drink's timeline has finished and the turn is the
// player's again (combat.js enables End Turn only then), so a Use refused here
// is refused by the plan, not by an animation still running.
const COMBAT_AT_REST = `(() => { const e = document.querySelector('.end-turn'); return !!e && !e.disabled && document.querySelector('.hand')?.getAttribute('aria-disabled') === 'false'; })`;
const COMBAT_SURFACE = `(async () => {
  if (!(await __fm.until(${COMBAT_AT_REST}, 200))) throw new Error('combat never came to rest (End Turn stayed disabled)');
  const asks = () => !!document.querySelector('.confirmation-modal');
  const openList = async () => {
    await __fm.closeModal('combat-potion-menu');
    await __fm.until(() => !asks());
    document.querySelector('.combat-potions').click();
    return __fm.until(() => document.querySelector('.combat-potion-menu'));
  };
  const keyOf = (fold) => fold.dataset.chargeKind ? 'charge:' + fold.dataset.chargeKind : 'slot:' + fold.dataset.potionSlot;
  const folds = () => [...document.querySelectorAll('.combat-potion-menu .potion-fold')];
  const foldBy = (key) => folds().find((f) => keyOf(f) === key);
  const counts = () => Object.fromEntries(folds().map((f) => [keyOf(f), Number(f.dataset.chargeKind ? f.dataset.charges : f.dataset.potionCount)]));
  const shown = (node) => !!node && node.isConnected && node.getClientRects().length > 0;
  await openList();
  const start = counts();
  const read = [];
  for (const key of Object.keys(start)) {
    // What the fold offers, as rows in the plan's vocabulary.
    let fold = foldBy(key);
    const use = fold.querySelector('.potion-use');
    const name = (use?.getAttribute('aria-label') || '').replace(/^Use /, '');
    const summary = fold.tagName === 'DETAILS' ? fold.querySelector(':scope > summary') : null;
    const card = fold.querySelector(':scope > .as-detailcard');
    // The card's lines: the count, then the refusal when Use is refused.
    const reason = [...(card?.querySelectorAll('.as-flavor') || [])].slice(1).map((n) => n.textContent.trim()).join(' ');
    // A label as the player reads it: holdconfirm's HOLD badge is not part of it.
    const labelOf = (node) => { const c = node.cloneNode(true); c.querySelectorAll('.hold-hint').forEach((h) => h.remove()); return c.textContent.trim(); };
    const rows = [];
    if (use) rows.push({ id: 'use', label: labelOf(use), enabled: !use.disabled, reason: use.disabled ? reason : '' });
    if (summary && card) rows.push({ id: 'inspect', label: 'Inspect', enabled: true, reason: '' });
    for (const b of fold.querySelectorAll('button')) if (b !== use) rows.push({ id: 'unplanned', label: labelOf(b), enabled: !b.disabled, reason: '' });
    // Inspect: open the fold the way a tap on its summary does.
    let inspect = null;
    if (summary) {
      summary.click();
      const detail = await __fm.until(() => fold.open && shown(fold.querySelector('.as-detailcard')) && fold.querySelector('.as-detailcard'));
      inspect = { opened: !!fold.open, card: !!detail, named: detail?.querySelector('.dc-name')?.textContent.trim() || '',
        asked: asks(), listOpen: !!document.querySelector('.combat-potion-menu') };
    }
    // Use, on a fresh list: offered, it asks and a cancel spends nothing;
    // refused, it asks nothing (a disabled control has no click to wait on).
    let tried = null;
    await openList();
    const b = foldBy(key)?.querySelector('.potion-use');
    if (b) {
      const refused = b.disabled;
      b.click();
      const asked = !!(await __fm.until(asks, refused ? 6 : 40));
      document.querySelector('.confirmation-modal .confirmation-cancel')?.click();
      tried = { refused, asked, settled: !!(await __fm.until(() => !asks())) };
    }
    await openList();
    read.push({ key, name, count: start[key], rows, inspect, use: tried, after: counts()[key] ?? null });
  }
  await __fm.closeModal('combat-potion-menu');
  const out = { carried: [] };
  for (const r of read) if (r.key.startsWith('charge:')) out[r.key.slice(7)] = r; else out.carried.push(r);
  return out;
})()`;

// One combat fold against the shared plan: its rows are the plan's actions,
// and each was exercised as the plan says (Inspect inert, Use asks first).
const combatFoldWrong = (row, want) => {
  if (!row) return 'not drawn';
  if (!sameRows(row.rows, want, { reasons: false })) return 'its actions are not the plan\'s';
  const i = row.inspect;
  if (!i || !i.opened || !i.card || i.named !== row.name + ' details' || i.asked || !i.listOpen) return 'Inspect did not open the potion\'s card inertly';
  const use = want.find((a) => a.id === 'use');
  if (!row.use || row.use.refused === use.enabled || row.use.asked !== use.enabled || !row.use.settled) return 'Use did not ask exactly when offered';
  if (row.after !== row.count) return 'exercising its actions spent a charge';
  return '';
};

const sameRows = (got, want, { reasons = true } = {}) => Array.isArray(got) && got.length === want.length
  && got.every((row, i) => row.id === want[i].id && row.label === want[i].label && row.enabled === want[i].enabled
    && (reasons ? row.reason === want[i].reason : (row.enabled || !!row.reason)));

async function planProbe(cdp, base, check) {
  // COMBAT.
  {
    const page = await openPage(cdp, base, 'shot=combat');
    try {
      await page.ev(PLAN);
      const judge = async (label) => {
        const got = await page.ev(COMBAT_SURFACE);
        for (const kind of ['hp', 'mana']) {
          const row = got[kind];
          const want = await page.ev(`__fmPlan.combat(${row?.count ?? 0})`);
          const why = combatFoldWrong(row, want);
          check(`plan: combat, ${label}, ${kind} flask: every action (${want.map((a) => a.label).join(', ')}) matches the shared plan`,
            !why, `${why} — ${JSON.stringify({ got: row, want })}`);
        }
        // The pose carries a Crimson Flask and a Blight Coating (main.js, shot=combat).
        const carried = got.carried || [];
        const wrong = [];
        for (const row of carried) {
          const want = await page.ev(`__fmPlan.combat(${row.count})`);
          const why = combatFoldWrong(row, want);
          if (why) wrong.push({ why, got: row, want });
        }
        check(`plan: combat, ${label}, carried potions: each one's every action matches the shared plan`,
          carried.length === 2 && wrong.length === 0,
          JSON.stringify({ carried: carried.map(({ name, count, rows }) => ({ name, count, rows: rows.map((r) => `${r.id}:${r.enabled}`) })), wrong }));
        return got;
      };
      await judge('opening hand');
      const drank = await page.ev(`(async () => {
        document.querySelector('.combat-potions').click();
        const use = await __fm.until(() => document.querySelector('.combat-potion-menu .potion-fold[data-charge-kind="mana"] .potion-use'));
        let n = Number(use?.closest('.potion-fold').dataset.charges || 0);
        await __fm.closeModal('combat-potion-menu');
        for (; n > 0; n--) {
          document.querySelector('.combat-potions').click();
          const b = await __fm.until(() => document.querySelector('.combat-potion-menu .potion-fold[data-charge-kind="mana"] .potion-use'));
          if (!b || b.disabled) return 'Use was refused with charges left';
          b.click();
          const yes = await __fm.until(() => document.querySelector('.confirmation-modal .confirmation-confirm'));
          if (!yes) return 'Use opened no confirmation';
          yes.click();
          await __fm.until(() => !document.querySelector('.combat-potion-menu'));
          if (!(await __fm.until(${COMBAT_AT_REST}, 200))) return 'the drink never came to rest (End Turn stayed disabled)';
        }
        return '';
      })()`);
      check('plan: combat, the Azure flask drinks to empty', drank === '', drank);
      const empty = await judge('Azure drunk to empty');
      const emptyUse = empty.mana?.rows?.find((r) => r.id === 'use');
      check('plan: combat, Azure drunk to empty: Use is refused with its reason, as the shared plan says',
        empty.mana && empty.mana.count === 0 && emptyUse?.enabled === false && /No charges/.test(emptyUse.reason),
        JSON.stringify(empty.mana && { count: empty.mana.count, use: emptyUse }));
      check('plan: combat, no page error', page.errors.length === 0, page.errors.join(' | '));
    } finally { await page.close(); }
  }
  // THE MAP: the Potions list and its minis.
  for (const on of [false, true]) {
    const page = await openPage(cdp, base, `shot=map&${carriedQuery}&${settingsQuery(on)}`);
    try {
      await page.ev(PLAN);
      const judge = async (label) => {
        const got = await page.ev(MAP_SURFACES);
        let ok = true;
        const detail = [];
        for (const kind of ['hp', 'mana']) {
          const entry = got['charge:' + kind] || { count: null, rows: null, list: null };
          const want = await page.ev(`__fmPlan.mapCharge(${on}, ${entry.count})`);
          const use = want.find((a) => a.id === 'use');
          const list = entry.list;
          const rowsOk = sameRows(entry.rows, want);
          const listOk = !!list && list.enabled === use.enabled && list.label === 'Drink' && (use.enabled || list.text.includes(use.reason));
          if (!rowsOk || !listOk) { ok = false; detail.push(JSON.stringify({ kind, got: entry, want })); }
        }
        check(`plan: map minis, ${label}: the flask menus and the Potions list match the shared plan`, ok, detail.join(' '));
        // The carried potions' minis and list rows (#1474 review).
        const want = await page.ev(`__fmPlan.mapCarried()`);
        const drop = want.find((a) => a.id === 'drop');
        const carriedKeys = Object.keys(got).filter((k) => k.startsWith('carried:'));
        const bad = [];
        for (const id of CARRIED_KINDS) {
          const entry = got['carried:' + id];
          const held = CARRIED.filter((x) => x === id).length;
          const list = entry?.list;
          // The map's tray folds what does not fit into its overflow (the list),
          // so a carried mini is judged where it is drawn; its list row always.
          const drawn = entry?.rows != null || entry?.count != null;
          if (!entry || (drawn && (entry.count !== held || !sameRows(entry.rows, want)))
            || !list || list.label !== 'Drop' || list.enabled !== drop.enabled) bad.push(JSON.stringify({ id, held, got: entry, want }));
        }
        check(`plan: map carried potions, ${label}: each one's list row, and its mini's flask menu where drawn, match the shared plan`,
          bad.length === 0 && carriedKeys.length === CARRIED_KINDS.length, bad.join(' ') || carriedKeys.join(','));
      };
      await judge(`setting ${on ? 'on' : 'off'}`);
      if (on) {
        const drank = await page.ev(`(async () => {
          for (let i = 0; i < 9 && __fm.count(document.querySelector('.map-potions .potion-mini[data-potion-key="charge:mana"]')) > 0; i++) {
            await __fm.clickListVerb('charge:mana'); await __fm.sleep(300);
          }
          return __fm.count(document.querySelector('.map-potions .potion-mini[data-potion-key="charge:mana"]'));
        })()`);
        check('plan: map, the Azure flask drinks to empty from the list', drank === 0, `left ${drank}`);
        await judge('setting on, Azure drunk to empty');
      }
      check(`plan: map, setting ${on ? 'on' : 'off'}, no page error`, page.errors.length === 0, page.errors.join(' | '));
    } finally { await page.close(); }
  }
  // THE RUN HUD's room rail, turned on through the config row it reads.
  const configPath = 'src/config/generated/ui.js';
  const configBody = readFileSync(resolve(ROOT, configPath), 'utf8');
  const roomRailOff = /("roomRail"\s*:\s*)false/;
  const roomRailOn = /"roomRail"\s*:\s*true/;
  const railOn = configBody.replace(roomRailOff, '$1true');
  if (railOn === configBody && !roomRailOn.test(configBody)) {
    check('plan: run HUD, the room-rail config row is where this probe turns it on', false, `${configPath} has no "roomRail" row`);
    return;
  }
  for (const on of [false, true]) {
    const page = await openPage(cdp, base, `shot=map&${carriedQuery}&${settingsQuery(on)}`, { fetchOverride: { path: `/${configPath}`, body: railOn } });
    try {
      await page.ev(PLAN);
      const judge = async (label) => {
        const got = await page.ev(HUD_SURFACES);
        let ok = true;
        const detail = [];
        for (const kind of ['hp', 'mana']) {
          const entry = got['charge:' + kind] || { count: null, rows: null };
          const want = await page.ev(`__fmPlan.hudCharge(${on}, ${entry.count})`);
          if (!sameRows(entry.rows, want, { reasons: false })) { ok = false; detail.push(JSON.stringify({ kind, got: entry, want })); }
        }
        check(`plan: run HUD, ${label}: the flask menus match the shared plan`, ok, detail.join(' '));
        // The carried potions' icons (#1474 review): runHud.js builds their
        // Use/Inspect/Drop plan itself.
        const want = await page.ev(`__fmPlan.hudCarried()`);
        const carriedKeys = Object.keys(got).filter((k) => k.startsWith('carried:'));
        const bad = [];
        for (const id of CARRIED_KINDS) {
          const entry = got['carried:' + id];
          const held = CARRIED.filter((x) => x === id).length;
          if (!entry || entry.count !== held || !sameRows(entry.rows, want, { reasons: false })) bad.push(JSON.stringify({ id, held, got: entry, want }));
        }
        check(`plan: run HUD carried icons, ${label}: each carried potion's flask menu matches the shared plan`,
          bad.length === 0 && carriedKeys.length === CARRIED_KINDS.length, bad.join(' ') || carriedKeys.join(','));
      };
      await judge(`setting ${on ? 'on' : 'off'}`);
      if (on) {
        const drank = await page.ev(`(async () => {
          for (let i = 0; i < 9; i++) {
            const node = document.querySelector('.hud-potions .flask-charge[data-flask-kind="mana"]');
            if (!node || __fm.count(node) <= 0) break;
            await __fm.openMenu(node);
            document.querySelector('.flask-action-menu .flask-action[data-flask-action="use"]')?.click();
            await __fm.sleep(300);
          }
          return __fm.count(document.querySelector('.hud-potions .flask-charge[data-flask-kind="mana"]'));
        })()`);
        check('plan: run HUD, the Azure flask drinks to empty from its menu', drank === 0, `left ${drank}`);
        await judge('setting on, Azure drunk to empty');
      }
      check(`plan: run HUD, setting ${on ? 'on' : 'off'}, no page error`, page.errors.length === 0, page.errors.join(' | '));
    } finally { await page.close(); }
  }
}

async function main(args) {
  const onlyAt = args.indexOf('--only');
  const only = onlyAt >= 0 ? args[onlyAt + 1] : null;
  if (only && !PROBES.includes(only)) { console.error(`flask-menu-probe HARNESS — --only takes ${PROBES.join(' | ')}`); return 2; }
  const browser = resolveBrowser(['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe']);
  if (!browser) { console.error('flask-menu-probe HARNESS — no Chrome/Chromium (set CHROME)'); return 2; }
  const served = await serve({ root: ROOT, port: PORT, open: false });
  const launched = await launchBrowser({ prefix: 'flaskmenu-', browser, timeoutMs: 20000 });
  const cdp = connectCdp(launched.wsUrl);
  const base = `http://localhost:${served.port}/`;
  let pass = 0;
  let fail = 0;
  const check = (name, ok, why = '') => {
    if (ok) { pass++; console.log(`PASS ${name}`); }
    else { fail++; console.error(`FAIL ${name}${why ? ` — ${why}` : ''}`); }
  };
  const probes = { persistence: persistenceProbe, dispatch: dispatchProbe, plan: planProbe };
  try {
    await cdp.ready;
    for (const name of PROBES) if (!only || only === name) await probes[name](cdp, base, check);
  } catch (error) {
    if (error.harness) { console.error(`flask-menu-probe HARNESS — ${error.message}`); return 2; }
    check(`the ${only || 'probe'} run finished`, false, error.message);
  } finally {
    cdp.close();
    await launched.close();
    served.server.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  return fail ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(`flask-menu-probe HARNESS — ${e.stack || e.message}`); process.exit(2); });
}
