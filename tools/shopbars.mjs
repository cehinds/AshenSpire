#!/usr/bin/env node
// tools/shopbars.mjs — THE MERCHANT IS FIVE BARS, AND EACH ANSWERS IN WORDS.
// The rendered check on E2 (#247): shop.js's fold over the one mechanism
// (components/disclosure.js — tools/onefold.mjs counts that it stayed one).
//
// WHY IT EXISTS. Constantine, 2026-08-15: "the shop is really hard to see
// cards... relics cards and weapons/armaments, and a sell function should be
// horizontal buttons that expand and collapse." The screen that answers him
// is a fold whose every honest property is an ABSENCE somewhere: a bar shut
// on arrival draws nothing, a toggled-off SELL draws nothing, a re-render
// that forgets the open bar draws the WRONG something for one frame of the
// player's attention. tools/flaskbox.mjs's lesson stands: no grep finds an
// absence — it takes a photograph turned into a predicate.
//
// WHAT IT CHECKS, per shape (390x844 and 1200x730), through the real boot:
//   S1 BARS      exactly the declared bars are drawn, BY KEY, each face's
//                label AND value with rects on the glass. No stray bar.
//   S2 ARRIVAL   CARDS is the open bar — its shelf on the glass WITH AREA —
//                and every other bar's shelf has no painted box. Both edges.
//   S3 FOLD      tapping RELICS opens relics and closes cards; tapping it
//                again closes it. The player can always put the wall away.
//   S4 PLACE     buying a flask re-renders the screen; the FLASKS bar must
//                still be the open one and its face count must move 2 -> 1.
//                The fold that snaps back to CARDS on every purchase is the
//                defect this sentence exists to catch.
//   S5 SELL      the sell flow, driven whole through the second-beat control
//                the machinery draws: cinders rise by EXACTLY the table's
//                answer — floor(flaskCost[0] * sellFraction), both factors
//                READ from content/balance.js at run time, never typed here —
//                the row leaves the shelf, and the face says so.
//   S6 ABSENT    with his toggle off (?shotSettings={"shopSell":false} — the
//                harness's own settings door; shot boots use memory storage,
//                so localStorage is NOT a door here) the SELL bar does not
//                exist. Not disabled, not greyed: no [data-face="bar:sell"]
//                node at all. The recorded answer's exact word is ABSENT.
//
// BOUNDARY. This measures the shop's fold, not its economy: whether half the
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
        name: 'the toggled-off SELL bar comes back greyed instead of absent',
        edits: [{
          file: 'src/ui/screens/shop.js',
          find: '      ...(sellOn() ? [{ key: \'bar:sell\', label: \'SELL\', node: sellRow,',
          replace: '      ...(true ? [{ key: \'bar:sell\', label: \'SELL\', node: sellRow, // planted: discoverable over absent',
        }],
        expectRed: /BAD\s+S6 .*bar:sell/,
      },
      {
        // THE FOLD SNAPS BACK. render() runs on every purchase; drop the
        // open-bar carry and the player buying flask two is looking at cards.
        name: 'the re-render forgets the open bar',
        edits: [{
          file: 'src/ui/screens/shop.js',
          find: '    if (fold && fold.openKey) openBar = fold.openKey;',
          replace: '    // planted: every purchase snaps the shop back to the first bar',
        }],
        expectRed: /BAD\s+S4 .*open bar after the purchase/,
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
        // A BAR LEAVES THE ROSTER IN SILENCE — the census edge, S1's reason.
        name: 'the FLASKS bar quietly stops being declared',
        edits: [{
          file: 'src/ui/screens/shop.js',
          find: "      { key: 'bar:flasks', label: 'FLASKS', node: flasksRow,",
          replace: "      ...(false ? [] : []), { key: 'bar:flasksX', label: 'FLASKS', node: flasksRow, // planted: renamed off the roster",
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

// The roster, a CONTRACT like creationbrief's: a bar that stops folding is
// red by name, a bar that appears unnamed is red by name.
const BARS = ['bar:cards', 'bar:relics', 'bar:flasks', 'bar:remove', 'bar:sell'];

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

// One read of the bars: which faces exist, which is open, and per bar whether
// its shelf has PAINTED AREA (presence) or none (absence) — the same
// asymmetry creationbrief documents at its ON_GLASS.
const READ = `(() => {
  const area = (el) => !!el && [...el.getClientRects()].some((r) => r.width > 0 && r.height > 0);
  const faces = [...document.querySelectorAll('.shop-bars .disc-face')];
  const panel = document.querySelector('.shop-bars .disc-reveal');
  const shelfOf = { 'bar:cards': '#shop-cards', 'bar:relics': '#shop-relics',
    'bar:flasks': '#shop-flasks', 'bar:remove': '#shop-remove', 'bar:sell': '#shop-sell' };
  return {
    bars: faces.map((el) => ({
      key: el.dataset.face,
      labelOnGlass: area(el.querySelector('.disc-name')),
      valueOnGlass: area(el.querySelector('.disc-value')),
      value: ((el.querySelector('.disc-value') || {}).textContent || '').trim(),
    })),
    open: panel && !panel.hidden ? panel.dataset.revealFor : null,
    shelves: Object.fromEntries(Object.entries(shelfOf).map(([key, sel]) => {
      const el = document.querySelector(sel);
      return [key, { present: !!el, area: area(el) }];
    })),
    cinders: (() => { const m = document.body.textContent.match(/Cinders: (\\d+)/); return m ? +m[1] : null; })(),
  };
})()`;

async function main() {
  const { serve } = await import(join(ROOT, 'tools/serve.mjs'));
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
    await until(`!!document.querySelector('.shop-bars .disc-face')`, 'shop bars');
    await wait(600);
    const arrival = await ev(READ);

    // S1 — the roster, both directions, and every face speaks.
    const drawn = arrival.bars.map((b) => b.key);
    const missing = BARS.filter((k) => !drawn.includes(k));
    const stray = drawn.filter((k) => !BARS.includes(k));
    const mute = arrival.bars.filter((b) => !b.labelOnGlass || !b.valueOnGlass || b.value === '');
    if (missing.length || stray.length || mute.length) {
      bad('S1', shape, `the bars are not the roster — missing: [${missing.join(', ')}] stray: [${stray.join(', ')}]`
        + `${mute.length ? ` · face(s) with label or value off the glass: ${mute.map((b) => b.key).join(', ')}` : ''}`);
    } else {
      ok('S1', shape, `${BARS.length} bars by key, each label+value on the glass — ${arrival.bars.map((b) => `${b.key} '${b.value}'`).join(' · ')}`);
    }

    // S2 — arrival: cards open WITH AREA, every other shelf unpainted.
    const openWrong = arrival.open !== 'bar:cards';
    const cardsArea = arrival.shelves['bar:cards'] && arrival.shelves['bar:cards'].area;
    const leaking = Object.entries(arrival.shelves).filter(([k, v]) => k !== 'bar:cards' && k !== 'bar:sell' && v.area).map(([k]) => k);
    const sellLeak = arrival.shelves['bar:sell'] && arrival.shelves['bar:sell'].area;
    if (openWrong || !cardsArea || leaking.length || sellLeak) {
      bad('S2', shape, `arrival is not 'cards open, the rest away' — open=${arrival.open}, cards area=${!!cardsArea}`
        + `${leaking.length || sellLeak ? `, painted while shut: ${[...leaking, ...(sellLeak ? ['bar:sell'] : [])].join(', ')}` : ''}`);
    } else {
      ok('S2', shape, `CARDS is the open bar with its shelf painted; the other four are away`);
    }

    // S3 — the fold moves, both directions.
    await ev(`document.querySelector('[data-face="bar:relics"]').click(); true`);
    await wait(250);
    const afterOpen = await ev(READ);
    await ev(`document.querySelector('[data-face="bar:relics"]').click(); true`);
    await wait(250);
    const afterClose = await ev(READ);
    if (afterOpen.open === 'bar:relics' && afterOpen.shelves['bar:relics'].area && !afterOpen.shelves['bar:cards'].area
      && afterClose.open === null && !afterClose.shelves['bar:relics'].area) {
      ok('S3', shape, 'RELICS opens on a tap (cards leaves the glass) and a second tap folds it');
    } else {
      bad('S3', shape, `the fold did not move both ways — open tap: open=${afterOpen.open}, relics area=${afterOpen.shelves['bar:relics'].area}, `
        + `cards area=${afterOpen.shelves['bar:cards'].area}; close tap: open=${afterClose.open}, relics area=${afterClose.shelves['bar:relics'].area}`);
    }

    // S4 — the purchase keeps the player's place.
    await ev(`document.querySelector('[data-face="bar:flasks"]').click(); true`);
    await wait(250);
    const flasksBefore = await ev(`document.querySelectorAll('#shop-flasks .class-pick').length`);
    await ev(`(() => { const row = [...document.querySelectorAll('#shop-flasks .class-pick')].find((el) => !el.classList.contains('locked')); if (row) row.click(); return !!row; })()`);
    await wait(400);
    const afterBuy = await ev(READ);
    const flasksAfter = await ev(`document.querySelectorAll('#shop-flasks .class-pick').length`);
    const flaskFace = afterBuy.bars.find((b) => b.key === 'bar:flasks') || { value: '' };
    if (afterBuy.open === 'bar:flasks' && flasksAfter === flasksBefore - 1 && flaskFace.value.startsWith(String(flasksAfter))) {
      ok('S4', shape, `FLASKS is still the open bar after the purchase, shelf ${flasksBefore} -> ${flasksAfter}, face '${flaskFace.value}'`);
    } else {
      bad('S4', shape, `the purchase lost the open bar after the purchase or the count — open=${afterBuy.open}, `
        + `shelf ${flasksBefore} -> ${flasksAfter}, face '${flaskFace.value}'`);
    }

    // S5 — the sell flow, at the table's own price.
    await ev(`document.querySelector('[data-face="bar:sell"]').click(); true`);
    await wait(250);
    const preSell = await ev(READ);
    const sellRows = await ev(`document.querySelectorAll('#shop-sell .class-pick').length`);
    await ev(`(() => { const row = [...document.querySelectorAll('#shop-sell .class-pick')].at(-1); if (row) row.click(); return !!row; })()`);
    await wait(250);
    // The second beat the table derives for shopSell: press the control the
    // machinery drew. Driven, not bypassed — the beat is part of the surface.
    const pressed = await ev(`(() => {
      const btn = [...document.querySelectorAll('button, .class-pick')].find((el) => /SELL IT/i.test(el.textContent || ''));
      if (!btn) return false; btn.click(); return true; })()`);
    await wait(400);
    const postSell = await ev(READ);
    const sellRowsAfter = await ev(`document.querySelectorAll('#shop-sell .class-pick').length`);
    const delta = (postSell.cinders ?? 0) - (preSell.cinders ?? 0);
    if (sellRows > 0 && pressed && delta === expectSell && sellRowsAfter === sellRows - 1) {
      ok('S5', shape, `sold through the beat: cinders moved +${delta} — exactly floor(flaskCost[0] * sellFraction) = ${expectSell} read off the table — and the row left (${sellRows} -> ${sellRowsAfter})`);
    } else {
      bad('S5', shape, `the sell flow broke — rows ${sellRows} -> ${sellRowsAfter}, beat pressed=${pressed}, `
        + `cinders moved ${delta} against the table's ${expectSell}`);
    }

    // S6 — his toggle: ABSENT, not greyed. The harness settings door.
    await cdp.send('Page.navigate', { url: `${base}?shot=shop&shotSettings=${encodeURIComponent('{"shopSell":false}')}` }, S);
    await until(`!!document.querySelector('.shop-bars .disc-face')`, 'shop bars, toggle off');
    await wait(400);
    const off = await ev(READ);
    const offKeys = off.bars.map((b) => b.key);
    if (!offKeys.includes('bar:sell') && offKeys.length === BARS.length - 1) {
      ok('S6', shape, `with the toggle off the SELL bar is ABSENT — ${offKeys.join(', ')}`);
    } else {
      bad('S6', shape, `the toggled-off shop still carries bar:sell in some form — faces: ${offKeys.join(', ')}`);
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
