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
          find: '    const categories = shopCategories({ sellOn: sellOn() });',
          replace: '    const categories = shopCategories({ sellOn: true }); // planted: discoverable over absent',
        }],
        expectRed: /BAD\s+S6 .*sell/,
      },
      {
        // THE SHOP SNAPS BACK. render() runs on every purchase; drop the
        // category carry and the player buying flask two is looking at cards.
        name: 'the re-render forgets the selected category',
        edits: [{
          file: 'src/ui/screens/shop.js',
          find: "    if (!categories.includes(activeCategory)) activeCategory = 'cards';",
          replace: "    activeCategory = 'cards'; // planted: every purchase snaps the shop back to the first shelf",
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

const SHAPES = [
  { tag: '390x844', w: 390, h: 844, d: 2, mobile: true },
  { tag: '1200x730', w: 1200, h: 730, d: 1, mobile: false },
];

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

    await cdp.send('Page.navigate', { url: `${base}?shot=shop` }, S);
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
    const stray = drawn.filter((k) => !CATEGORIES.includes(k));
    const mute = arrival.bars.filter((b) => !b.labelOnGlass || !b.valueOnGlass || b.value === '' || b.label === '');
    if (missing.length || stray.length || mute.length) {
      bad('S1', shape, `the rail is not the roster — missing: [${missing.join(', ')}] stray: [${stray.join(', ')}]`
        + `${mute.length ? ` · item(s) with label or status off the glass: ${mute.map((b) => b.key).join(', ')}` : ''}`);
    } else {
      ok('S1', shape, `${CATEGORIES.length} categories by key, each label+status on the glass — ${arrival.bars.map((b) => `${b.key} '${b.value}'`).join(' · ')}`);
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
    await cdp.send('Page.navigate', { url: `${base}?shot=shop&shotSettings=${encodeURIComponent('{"shopSell":false}')}` }, S);
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

  await cdp.close(); await dropBrowser(); s.close?.();
  if (findings.length) {
    console.log(`\nshopbars: ${findings.length} BAD of ${checks} — ${findings.join(', ')}`);
    process.exit(1);
  }
  console.log(`\nshopbars: all green — ${checks} check(s)`);
  process.exit(0);
}

await main();
