#!/usr/bin/env node
// tools/shopbars.mjs — THE MERCHANT IS A CATEGORY RAIL, AND EACH ITEM ANSWERS
// IN WORDS. (Filename kept from the bars it used to check.)
// The rendered check on W1d / W1v (2026-09-13): shop.js's category rail and
// the one active pane beside (or above) it. Before that the merchant was a
// fold of seven bars (E2 / #247); FRONTEND-WIREFRAMES.md rule 11 retired the
// accordion as a menu shell, so the bars became rail items and the fold's
// "tap again to shut" became "the pane always shows one shelf".
//
// WHY IT EXISTS. Constantine, 2026-08-15: "the shop is really hard to see
// cards... relics cards and weapons/armaments, and a sell function". The
// screen that answers him has properties that are ABSENCES somewhere: a shelf
// not selected draws nothing, a toggled-off SELL draws nothing, a re-render
// that forgets the category draws the WRONG shelf for one frame of the
// player's attention. tools/flaskbox.mjs's lesson stands: no grep finds an
// absence — it takes a photograph turned into a predicate.
//
// WHAT IT CHECKS, per shape (390x844 and 1200x730), through the real boot:
//   S1 RAIL      exactly the declared categories are drawn, BY KEY, each
//                item's label AND status with rects on the glass. No stray.
//   S2 ARRIVAL   CARDS is the selected category — its shelf on the glass WITH
//                AREA — and every other shelf has no painted box.
//   S3 SWITCH    tapping RELICS shows relics and hides cards; tapping it
//                again keeps it. The rail never folds the pane away.
//   S4 PLACE     buying a flask (select the tile, then the footer's Buy and
//                its review beat) re-renders the screen; FLASKS must still be
//                the selected category and its status count must move 2 -> 1.
//                The shop that snaps back to CARDS on every purchase is the
//                defect this sentence exists to catch.
//   S5 SELL      the sell flow, driven whole through the second-beat control
//                the machinery draws on the footer: cinders rise by EXACTLY
//                the table's answer — floor(flaskCost[0] * sellFraction), both
//                factors READ from content/balance.js at run time, never typed
//                here — the row leaves the shelf, and the status says so.
//   S6 ABSENT    with his toggle off (?shotSettings={"shopSell":false} — the
//                harness's own settings door; shot boots use memory storage,
//                so localStorage is NOT a door here) the SELL category does
//                not exist. Not disabled, not greyed: no #shop-cat-sell and no
//                #shop-sell node at all. The recorded answer's word is ABSENT.
//
// THE BLACKSMITH (SPEC §14.4, §14.6 step 6) is the same W1d workspace on its
// own screen, so it gets its own shapes (390x844 and 1200x730, every offering
// forced out through ?shotSettings) and its own four checks:
//   B1 RAIL      exactly the blacksmith's offerings are drawn, BY KEY, in
//                content/shops.js order, each label AND status on the glass.
//   B2 ARRIVAL   the first offering's shelf is on the glass with area; every
//                other shelf has no painted box.
//   B3 SWITCH    tapping REFINE shows its shelf and hides the first one.
//   B4 PLACE     refining through the shelf's own action re-renders the
//                screen: REFINE is still the selected category, and the purse
//                in the header shows one more refined stone.
//
// THE WISE MASTER (SPEC §14.5, §14.6 step 7) is the same workspace again, with
// its own shapes (every offering forced out) and four checks:
//   M1 RAIL      exactly the master's offerings, BY KEY, in content/shops.js
//                order, then SELL (the shopSell toggle's pane), each label AND
//                status on the glass.
//   M2 ARRIVAL   the first offering's shelf is on the glass with area; every
//                other shelf has no painted box.
//   M3 SWITCH    tapping TRAINING shows its shelf and hides the first one.
//   M4 PLACE     training through the shelf's own action re-renders the
//                screen: TRAINING is still the selected category, and the
//                purse shows one session fewer.
//
// BOUNDARY. This measures the shop's rail, not its economy: whether half the
// low-end price is a GOOD price is Constantine's and the balance seat's
// question, and the number's one home (balance.shop.sellFraction) says so.
// Selling a RELIC (growth-chain unbind via syncFlaskGrowth) is exercised by
// the flow only when the posed run holds a sellable relic — the showcase run
// holds a starter relic, which is deliberately unpriced — so the relic arm of
// sell is code-shared with the flask arm here, not separately driven. Named,
// not hidden.
//
//   node tools/shopbars.mjs
//   node tools/shopbars.mjs --selftest      (same-door known-bads, doorplant.mjs)

import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { launchBrowser } from './browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'shopbars.mjs',
    plants: [
      {
        // THE RECORDED ANSWER'S EXACT WORD IS "ABSENT". A toggled-off feature
        // that still greys at the player is a nag, and it is exactly the edit
        // a well-meaning hand ships ("keep it discoverable").
        name: 'the toggled-off SELL category comes back greyed instead of absent',
        edits: [{
          file: 'src/ui/screens/shop.js',
          find: '    const categories = shopCategories({ sellOn: sellOn(), offered, services: removeOffered || smithOffered });',
          replace: '    const categories = shopCategories({ sellOn: true, offered, services: removeOffered || smithOffered }); // planted: discoverable over absent',
        }],
        expectRed: /BAD\s+S6 .*sell/,
      },
      {
        // THE SHOP SNAPS BACK. render() runs on every purchase; drop the
        // category carry and the player buying flask two is looking at cards.
        name: 'the re-render forgets the selected category',
        edits: [{
          file: 'src/ui/screens/shop.js',
          find: '    if (!categories.includes(activeCategory)) activeCategory = categories[0];',
          replace: "    activeCategory = categories[0]; // planted: every purchase snaps the shop back to the first shelf",
        }],
        expectRed: /BAD\s+S4 .*category after the purchase/,
      },
      {
        // THE PRICE LEAVES THE TABLE. The whole point of sellFraction having
        // one home is that a second copy of the arithmetic drifts; this is
        // that drift (high end instead of low), and S5 measures the CINDERS,
        // so it reds on the player's actual money, not on source text.
        name: 'the sell price quietly reads the high end of the cost table',
        edits: [{
          file: 'src/ui/screens/shop.js',
          find: '  return Math.floor(shop.flaskCost[0] * fraction);',
          replace: '  return Math.floor(shop.flaskCost[1] * fraction); // planted: the generous drift',
        }],
        expectRed: /BAD\s+S5 .*cinders moved/,
      },
      {
        // A CATEGORY LEAVES THE RAIL IN SILENCE — the census edge, S1's reason.
        name: 'the FLASKS rail item quietly stops being drawn',
        edits: [{
          file: 'src/ui/screens/shop.js',
          find: '    const railItems = categories.map((key) => {',
          replace: "    const railItems = categories.filter((key) => key !== 'flasks').map((key) => { // planted: FLASKS leaves the rail",
        }],
        expectRed: /BAD\s+S1 /,
      },
    ],
  }));
}

// The market additions (SPEC §14.3) come up by their own chances, so a visit
// may or may not draw them; each is named, so one is never a stray, and the
// roster above is still required whole. THE ONE LIST is model/marketStock.js
// MARKET_ADDITIONS, read through the same module the game reads, never a copy.
const { MARKET_ADDITIONS: ADDITIONS } = await import(pathToFileURL(join(ROOT, 'src/model/marketStock.js')).href);
// The additions shape forces every addition out through the harness's own
// settings door (?shotSettings, the Advanced → Shops rows), so S1 must find
// each of them on the rail, laid in after the flasks and before services.
const ADDITIONS_OUT = Object.fromEntries(ADDITIONS.map((id) => [`gameConfig.shops.market.${id}.chance`, 100]));

const SHAPES = [
  { tag: '390x844', w: 390, h: 844, d: 2, mobile: true },
  { tag: '1200x730', w: 1200, h: 730, d: 1, mobile: false },
  // Every market addition out (SPEC §14.3): chance 100 for each, through ?shotSettings.
  { tag: '1200x730+additions', w: 1200, h: 730, d: 1, mobile: false, settings: ADDITIONS_OUT },
  // …and on a phone, where step 5b's four shelves (skill books, revive
  // tokens, the quest event, companions) push the rail to twelve items and
  // the compact selector must still reach every one.
  { tag: '390x844+additions', w: 390, h: 844, d: 2, mobile: true, settings: ADDITIONS_OUT },
];
const settingsQuery = (settings) => (settings ? `&shotSettings=${encodeURIComponent(JSON.stringify(settings))}` : '');

// The blacksmith's roster is its offerings as content/shops.js writes them,
// read through the module the game reads — never a copy.
const { shops: SHOPS } = await import(pathToFileURL(join(ROOT, 'src/content/shops.js')).href);
const SMITH_OFFERINGS = SHOPS.blacksmith.offerings.map((row) => row.id);
const SMITH_ALL_OUT = Object.fromEntries(SMITH_OFFERINGS.map((id) => [`gameConfig.shops.blacksmith.${id}.chance`, 100]));
const SMITH_SHAPES = [
  { tag: '390x844+blacksmith', w: 390, h: 844, d: 2, mobile: true, settings: SMITH_ALL_OUT },
  { tag: '1200x730+blacksmith', w: 1200, h: 730, d: 1, mobile: false, settings: SMITH_ALL_OUT },
];
const MASTER_OFFERINGS = SHOPS.master.offerings.map((row) => row.id);
const MASTER_ALL_OUT = Object.fromEntries(MASTER_OFFERINGS.map((id) => [`gameConfig.shops.master.${id}.chance`, 100]));
const MASTER_SHAPES = [
  { tag: '390x844+master', w: 390, h: 844, d: 2, mobile: true, settings: MASTER_ALL_OUT },
  { tag: '1200x730+master', w: 1200, h: 730, d: 1, mobile: false, settings: MASTER_ALL_OUT },
];
const SMITH_READ = `(() => {
  const area = (el) => !!el && [...el.getClientRects()].some((r) => r.width > 0 && r.height > 0);
  const items = [...document.querySelectorAll('.blacksmith-workspace .shop-rail [data-shop-category]')];
  const selected = items.find((el) => el.getAttribute('aria-selected') === 'true');
  return {
    bars: items.map((el) => ({
      key: el.dataset.shopCategory,
      label: ((el.childNodes[0] || {}).textContent || '').trim(),
      labelOnGlass: area(el),
      valueOnGlass: area(el.querySelector('.as-status')),
      value: ((el.querySelector('.as-status') || {}).textContent || '').trim(),
    })),
    open: selected ? selected.dataset.shopCategory : null,
    shelves: Object.fromEntries([...document.querySelectorAll('.blacksmith-workspace [data-shop-shelf]')].map((el) => [el.dataset.shopShelf, area(el)])),
    purse: ((document.querySelector('.blacksmith-workspace .modal-head-status') || {}).textContent || '').trim(),
  };
})()`;

// The roster, a CONTRACT like creationbrief's: a category that stops being
// drawn is red by name, a category that appears unnamed is red by name. The
// Smith's services live on SERVICES, so no rail item is a roll any more.
const CATEGORIES = ['cards', 'armaments', 'weaponArts', 'relics', 'flasks', 'services', 'sell'];

const findings = [];
let checks = 0;
const ok = (id, shape, msg) => { checks++; console.log(`  ok   ${id} ${shape} — ${msg}`); };
const bad = (id, shape, msg) => { checks++; findings.push(`${id} ${shape}`); console.log(`  BAD  ${id} ${shape} — ${msg}`); };

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result); } });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) { const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); },
    close: () => ws.close() };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// One read of the rail: which items exist, which is selected, and per
// category whether its shelf has PAINTED AREA (presence) or none (absence) —
// the same asymmetry creationbrief documents at its ON_GLASS.
const READ = `(() => {
  const area = (el) => !!el && [...el.getClientRects()].some((r) => r.width > 0 && r.height > 0);
  const items = [...document.querySelectorAll('.shop-rail [data-shop-category]')];
  const shelfOf = { cards: '#shop-cards', armaments: '#shop-armaments', weaponArts: '#shop-weapon-arts',
    relics: '#shop-relics', flasks: '#shop-flasks', services: '[data-shop-shelf="services"]', sell: '#shop-sell' };
  const selected = items.find((el) => el.getAttribute('aria-selected') === 'true');
  return {
    bars: items.map((el) => ({
      key: el.dataset.shopCategory,
      label: ((el.childNodes[0] || {}).textContent || '').trim(),
      labelOnGlass: area(el),
      valueOnGlass: area(el.querySelector('.as-status')),
      value: ((el.querySelector('.as-status') || {}).textContent || '').trim(),
    })),
    open: selected ? selected.dataset.shopCategory : null,
    shelves: Object.fromEntries(Object.entries(shelfOf).map(([key, sel]) => {
      const el = document.querySelector(sel);
      return [key, { present: !!el, area: area(el) }];
    })),
    sellNodes: document.querySelectorAll('#shop-cat-sell, #shop-sell').length,
    // THE PURSE IS THE BAND'S (runHud.js, 2026-09-11): the screen's own
    // 'Cinders N' line is gone; the run HUD's chip is the one home.
    cinders: (() => { const el = document.querySelector('.hud-cinders .cv'); const m = el && el.textContent.match(/(\\d+)/); return m ? +m[1] : null; })(),
  };
})()`;

// Select a tile on the active shelf, press the footer's action, and press the
// second beat the machinery drew — driven, never bypassed.
const BUY_THROUGH_FOOTER = (tileSelector, confirmWord) => `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tile = ${tileSelector};
  if (!tile) return 'no tile';
  tile.click(); await sleep(200);
  const primary = document.querySelector('#shop-primary');
  if (!primary || primary.disabled) return 'no enabled footer action';
  primary.click(); await sleep(300);
  const btn = [...document.querySelectorAll('.confirmation-modal button')].find((el) => new RegExp(${JSON.stringify(confirmWord)}, 'i').test(el.textContent || ''));
  if (!btn) return 'no beat';
  btn.click(); return 'pressed';
})()`;

async function main() {
  // A file URL, not a bare path: on Windows `D:\…` is not an ESM URL scheme.
  const { serve } = await import(pathToFileURL(join(ROOT, 'tools/serve.mjs')).href);
  const s = await serve({ root: ROOT, port: 8304, open: false });
  const base = `http://localhost:${s.port}/`;
  // The table's own answer for S5, read through the same module the game
  // reads — never a copy of the arithmetic's inputs typed here.
  const { balance } = await import(pathToFileURL(resolve(ROOT, 'src/content/balance.js')).href);
  const expectSell = Math.floor(balance.shop.flaskCost[0] * balance.shop.sellFraction);
  console.log(`shopbars — ${base} (root ${ROOT})`);
  console.log('DOOR: real boot over http in headless Chromium; presence is AREA, absence is the lack');
  console.log('      of any painted box; the sell price is READ off content/balance.js at run time.');
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'shopbars-', browser: process.env.CHROME || '/usr/bin/chromium', timeoutMs: 15000,
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;

  for (const vp of SHAPES) {
    const shape = vp.tag;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw'); return r.result.value; };
    const until = async (x, w, ms = 20000) => { const t = Date.now();
      while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); } throw new Error('timeout ' + w); };
    console.log(`\n  ${shape}`);

    await cdp.send('Page.navigate', { url: `${base}?shot=shop${settingsQuery(vp.settings)}` }, S);
    // The first mount of the unbundled module route can pass 20 s on a
    // loaded machine (measured 21.4 s, 2026-09-14), so it gets a minute.
    await until(`!!document.querySelector('.shop-rail [data-shop-category]')`, 'shop rail', 60000);
    await wait(600);
    // W1 rule 11: a compact frame draws the kit's one [Category ▾] selector
    // above the pane and keeps the rail closed under it (kit/categoryNav.js).
    // S1 asks for every item ON THE GLASS, so it opens the list the way a
    // finger does, reads, and closes it again before S2 onward.
    const compact = await ev(`(() => { const t = document.querySelector('.shop-workspace .as-catnav-toggle');
      if (!t || !t.getClientRects().length) return false; t.click(); return true; })()`);
    if (compact) await wait(250);
    const arrival = await ev(READ);
    if (compact) { await ev(`document.querySelector('.shop-workspace .as-catnav-toggle').click(); true`); await wait(200); }

    // S1 — the roster, both directions, and every item speaks.
    const drawn = arrival.bars.map((b) => b.key);
    const missing = CATEGORIES.filter((k) => !drawn.includes(k));
    const stray = drawn.filter((k) => !CATEGORIES.includes(k) && !ADDITIONS.includes(k));
    const mute = arrival.bars.filter((b) => !b.labelOnGlass || !b.valueOnGlass || b.value === '' || b.label === '');
    // With every addition forced out, each must be drawn, in the rail's order:
    // the shelves, then the additions, then services and sell.
    if (vp.settings) {
      for (const k of ADDITIONS) if (!drawn.includes(k)) missing.push(k);
    }
    const expectedOrder = vp.settings ? [...CATEGORIES.slice(0, 5), ...ADDITIONS, ...CATEGORIES.slice(5)] : null;
    const misordered = expectedOrder && !missing.length && drawn.join() !== expectedOrder.join();
    if (misordered) stray.push(`order ${drawn.join('>')} (want ${expectedOrder.join('>')})`);
    if (missing.length || stray.length || mute.length) {
      bad('S1', shape, `the rail is not the roster — missing: [${missing.join(', ')}] stray: [${stray.join(', ')}]`
        + `${mute.length ? ` · item(s) with label or status off the glass: ${mute.map((b) => b.key).join(', ')}` : ''}`);
    } else {
      ok('S1', shape, `${drawn.length} categories by key${vp.settings ? ' (every addition out, in rail order)' : ''}, each label+status on the glass — ${arrival.bars.map((b) => `${b.key} '${b.value}'`).join(' · ')}`);
    }

    // S2 — arrival: cards selected WITH AREA, every other shelf unpainted.
    const openWrong = arrival.open !== 'cards';
    const cardsArea = arrival.shelves.cards && arrival.shelves.cards.area;
    const leaking = Object.entries(arrival.shelves).filter(([k, v]) => k !== 'cards' && v.area).map(([k]) => k);
    if (openWrong || !cardsArea || leaking.length) {
      bad('S2', shape, `arrival is not 'cards shown, the rest away' — selected=${arrival.open}, cards area=${!!cardsArea}`
        + `${leaking.length ? `, painted while not selected: ${leaking.join(', ')}` : ''}`);
    } else {
      ok('S2', shape, 'CARDS is the selected category with its shelf painted; every other shelf is away');
    }

    // S3 — the rail switches, and never folds the pane away.
    await ev(`document.querySelector('#shop-cat-relics').click(); true`);
    await wait(250);
    const afterOpen = await ev(READ);
    await ev(`document.querySelector('#shop-cat-relics').click(); true`);
    await wait(250);
    const afterAgain = await ev(READ);
    if (afterOpen.open === 'relics' && afterOpen.shelves.relics.area && !afterOpen.shelves.cards.area
      && afterAgain.open === 'relics' && afterAgain.shelves.relics.area) {
      ok('S3', shape, 'RELICS shows on a tap (cards leaves the glass) and a second tap keeps it shown');
    } else {
      bad('S3', shape, `the rail did not switch and hold — first tap: selected=${afterOpen.open}, relics area=${afterOpen.shelves.relics.area}, `
        + `cards area=${afterOpen.shelves.cards.area}; second tap: selected=${afterAgain.open}, relics area=${afterAgain.shelves.relics.area}`);
    }

    // S4 — the purchase keeps the player's place.
    await ev(`document.querySelector('#shop-cat-flasks').click(); true`);
    await wait(250);
    const flasksBefore = await ev(`document.querySelectorAll('#shop-flasks .class-pick').length`);
    // A PURCHASE IS A DECISION (shop.js arm(primary, 'shopBuy')): the footer's
    // Buy opens the review modal and the second beat is its BUY IT.
    const bought = await ev(BUY_THROUGH_FOOTER(`[...document.querySelectorAll('#shop-flasks .class-pick')].find((el) => !el.classList.contains('locked'))`, 'BUY IT'));
    await wait(400);
    const afterBuy = await ev(READ);
    const flasksAfter = await ev(`document.querySelectorAll('#shop-flasks .class-pick').length`);
    const flaskItem = afterBuy.bars.find((b) => b.key === 'flasks') || { value: '' };
    const flaskStatusOk = flasksAfter ? flaskItem.value.startsWith(String(flasksAfter)) : /sold out/i.test(flaskItem.value);
    if (bought === 'pressed' && afterBuy.open === 'flasks' && flasksAfter === flasksBefore - 1 && flaskStatusOk) {
      ok('S4', shape, `FLASKS is still the selected category after the purchase, shelf ${flasksBefore} -> ${flasksAfter}, status '${flaskItem.value}'`);
    } else {
      bad('S4', shape, `the purchase lost the category after the purchase or the count — ${bought}, selected=${afterBuy.open}, `
        + `shelf ${flasksBefore} -> ${flasksAfter}, status '${flaskItem.value}'`);
    }

    // S5 — the sell flow, at the table's own price.
    await ev(`document.querySelector('#shop-cat-sell').click(); true`);
    await wait(250);
    const preSell = await ev(READ);
    const sellRows = await ev(`document.querySelectorAll('#shop-sell .class-pick').length`);
    // The second beat the table derives for shopSell: press the control the
    // machinery drew. Driven, not bypassed — the beat is part of the surface.
    const sold = await ev(BUY_THROUGH_FOOTER(`[...document.querySelectorAll('#shop-sell .class-pick')].at(-1)`, 'SELL IT'));
    await wait(400);
    const postSell = await ev(READ);
    const sellRowsAfter = await ev(`document.querySelectorAll('#shop-sell .class-pick').length`);
    const delta = (postSell.cinders ?? 0) - (preSell.cinders ?? 0);
    if (sellRows > 0 && sold === 'pressed' && delta === expectSell && sellRowsAfter === sellRows - 1) {
      ok('S5', shape, `sold through the beat: cinders moved +${delta} — exactly floor(flaskCost[0] * sellFraction) = ${expectSell} read off the table — and the row left (${sellRows} -> ${sellRowsAfter})`);
    } else {
      bad('S5', shape, `the sell flow broke — rows ${sellRows} -> ${sellRowsAfter}, beat ${sold}, `
        + `cinders moved ${delta} against the table's ${expectSell}`);
    }

    // S6 — his toggle: ABSENT, not greyed. The harness settings door.
    await cdp.send('Page.navigate', { url: `${base}?shot=shop${settingsQuery({ ...(vp.settings || {}), shopSell: false })}` }, S);
    await until(`!!document.querySelector('.shop-rail [data-shop-category]')`, 'shop rail, toggle off', 60000);
    await wait(400);
    const off = await ev(READ);
    const offKeys = off.bars.map((b) => b.key);
    if (!offKeys.includes('sell') && off.sellNodes === 0 && offKeys.join() === drawn.filter((k) => k !== 'sell').join()) {
      ok('S6', shape, `with the toggle off the SELL category is ABSENT — ${offKeys.join(', ')}`);
    } else {
      bad('S6', shape, `the toggled-off shop still carries sell in some form — items: ${offKeys.join(', ')}, sell nodes: ${off.sellNodes}`);
    }

    await cdp.send('Target.closeTarget', { targetId }, S).catch(() => {});
  }

  for (const vp of SMITH_SHAPES) {
    const shape = vp.tag;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw'); return r.result.value; };
    const until = async (x, w, ms = 20000) => { const t = Date.now();
      while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); } throw new Error('timeout ' + w); };
    console.log(`\n  ${shape}`);
    await cdp.send('Page.navigate', { url: `${base}?shot=blacksmith${settingsQuery(vp.settings)}` }, S);
    await until(`!!document.querySelector('.blacksmith-workspace .shop-rail [data-shop-category]')`, 'blacksmith rail', 60000);
    await wait(600);
    const compact = await ev(`(() => { const t = document.querySelector('.blacksmith-workspace .as-catnav-toggle');
      if (!t || !t.getClientRects().length) return false; t.click(); return true; })()`);
    if (compact) await wait(250);
    const arrival = await ev(SMITH_READ);
    if (compact) { await ev(`document.querySelector('.blacksmith-workspace .as-catnav-toggle').click(); true`); await wait(200); }

    // B1 — the roster, in content order, and every item speaks.
    const drawn = arrival.bars.map((b) => b.key);
    const mute = arrival.bars.filter((b) => !b.labelOnGlass || !b.valueOnGlass || b.value === '' || b.label === '');
    if (drawn.join() !== SMITH_OFFERINGS.join() || mute.length) {
      bad('B1', shape, `the blacksmith rail is not its offerings — drawn ${drawn.join('>')} (want ${SMITH_OFFERINGS.join('>')})`
        + `${mute.length ? ` · off the glass: ${mute.map((b) => b.key).join(', ')}` : ''}`);
    } else {
      ok('B1', shape, `${drawn.length} offerings by key in content order, each label+status on the glass — ${arrival.bars.map((b) => `${b.key} '${b.value}'`).join(' · ')}`);
    }

    // B2 — arrival: the first offering shown, the rest away.
    const first = SMITH_OFFERINGS[0];
    const leaking = Object.entries(arrival.shelves).filter(([k, v]) => k !== first && v).map(([k]) => k);
    if (arrival.open !== first || !arrival.shelves[first] || leaking.length) {
      bad('B2', shape, `arrival is not '${first} shown, the rest away' — selected=${arrival.open}, area=${arrival.shelves[first]}${leaking.length ? `, painted: ${leaking.join(', ')}` : ''}`);
    } else {
      ok('B2', shape, `${first.toUpperCase()} is selected with its shelf painted; every other shelf is away`);
    }

    // B3 — the rail switches.
    await ev(`document.querySelector('#shop-cat-refineStones').click(); true`);
    await wait(250);
    const switched = await ev(SMITH_READ);
    if (switched.open === 'refineStones' && switched.shelves.refineStones && !switched.shelves[first]) {
      ok('B3', shape, 'REFINE shows on a tap and the first shelf leaves the glass');
    } else {
      bad('B3', shape, `the rail did not switch — selected=${switched.open}, refine area=${switched.shelves.refineStones}, ${first} area=${switched.shelves[first]}`);
    }

    // B4 — an action keeps the player's place, and the purse moves.
    const refinedOf = (purse) => { const m = purse.match(/(\d+) refined/); return m ? +m[1] : null; };
    const before = refinedOf(switched.purse);
    const pressed = await ev(`(() => { const b = document.querySelector('#blacksmith-refine'); if (!b || b.disabled) return false; b.click(); return true; })()`);
    await wait(400);
    const after = await ev(SMITH_READ);
    if (pressed && after.open === 'refineStones' && before !== null && refinedOf(after.purse) === before + 1) {
      ok('B4', shape, `refined through the shelf: REFINE still selected, purse '${switched.purse}' -> '${after.purse}'`);
    } else {
      bad('B4', shape, `the refine action lost the place or the purse — pressed=${pressed}, selected=${after.open}, purse '${switched.purse}' -> '${after.purse}'`);
    }
    await cdp.send('Target.closeTarget', { targetId }, S).catch(() => {});
  }

  for (const vp of MASTER_SHAPES) {
    const shape = vp.tag;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: vp.w, height: vp.h, deviceScaleFactor: vp.d, mobile: vp.mobile }, S);
    const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw'); return r.result.value; };
    const until = async (x, w, ms = 20000) => { const t = Date.now();
      while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); } throw new Error('timeout ' + w); };
    const READ = SMITH_READ.replaceAll('.blacksmith-workspace', '.master-workspace');
    console.log(`\n  ${shape}`);
    await cdp.send('Page.navigate', { url: `${base}?shot=master${settingsQuery(vp.settings)}` }, S);
    await until(`!!document.querySelector('.master-workspace .shop-rail [data-shop-category]')`, 'master rail', 60000);
    await wait(600);
    const compact = await ev(`(() => { const t = document.querySelector('.master-workspace .as-catnav-toggle');
      if (!t || !t.getClientRects().length) return false; t.click(); return true; })()`);
    if (compact) await wait(250);
    const arrival = await ev(READ);
    if (compact) { await ev(`document.querySelector('.master-workspace .as-catnav-toggle').click(); true`); await wait(200); }

    // M1 — the roster, in content order, then SELL, and every item speaks.
    const want = [...MASTER_OFFERINGS, 'sell'];
    const drawn = arrival.bars.map((b) => b.key);
    const mute = arrival.bars.filter((b) => !b.labelOnGlass || !b.valueOnGlass || b.value === '' || b.label === '');
    if (drawn.join() !== want.join() || mute.length) {
      bad('M1', shape, `the master rail is not its offerings then sell — drawn ${drawn.join('>')} (want ${want.join('>')})`
        + `${mute.length ? ` · off the glass: ${mute.map((b) => b.key).join(', ')}` : ''}`);
    } else {
      ok('M1', shape, `${drawn.length} rail items by key in content order, each label+status on the glass — ${arrival.bars.map((b) => `${b.key} '${b.value}'`).join(' · ')}`);
    }

    // M2 — arrival: the first offering shown, the rest away.
    const first = MASTER_OFFERINGS[0];
    const leaking = Object.entries(arrival.shelves).filter(([k, v]) => k !== first && v).map(([k]) => k);
    if (arrival.open !== first || !arrival.shelves[first] || leaking.length) {
      bad('M2', shape, `arrival is not '${first} shown, the rest away' — selected=${arrival.open}, area=${arrival.shelves[first]}${leaking.length ? `, painted: ${leaking.join(', ')}` : ''}`);
    } else {
      ok('M2', shape, `${first.toUpperCase()} is selected with its shelf painted; every other shelf is away`);
    }

    // M3 — the rail switches.
    await ev(`document.querySelector('#shop-cat-training').click(); true`);
    await wait(250);
    const switched = await ev(READ);
    if (switched.open === 'training' && switched.shelves.training && !switched.shelves[first]) {
      ok('M3', shape, 'TRAINING shows on a tap and the first shelf leaves the glass');
    } else {
      bad('M3', shape, `the rail did not switch — selected=${switched.open}, training area=${switched.shelves.training}, ${first} area=${switched.shelves[first]}`);
    }

    // M4 — an action keeps the player's place, and the purse moves.
    const leftOf = (purse) => { const m = purse.match(/(\d+) session/); return m ? +m[1] : null; };
    const before = leftOf(switched.purse);
    const pressed = await ev(`(() => { const b = [...document.querySelectorAll('[id^="master-train-"]')].find((x) => !x.disabled); if (!b) return false; b.click(); return true; })()`);
    await wait(400);
    const after = await ev(READ);
    if (pressed && after.open === 'training' && before !== null && leftOf(after.purse) === before - 1) {
      ok('M4', shape, `trained through the shelf: TRAINING still selected, purse '${switched.purse}' -> '${after.purse}'`);
    } else {
      bad('M4', shape, `the training action lost the place or the purse — pressed=${pressed}, selected=${after.open}, purse '${switched.purse}' -> '${after.purse}'`);
    }
    await cdp.send('Target.closeTarget', { targetId }, S).catch(() => {});
  }

  await cdp.close(); await dropBrowser(); s.close?.();
  if (findings.length) {
    console.log(`\nshopbars: ${findings.length} BAD of ${checks} — ${findings.join(', ')}`);
    process.exit(1);
  }
  console.log(`\nshopbars: all green — ${checks} check(s)`);
  process.exit(0);
}

await main();
