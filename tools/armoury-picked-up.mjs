#!/usr/bin/env node
// tools/armoury-picked-up.mjs — the Armoury tells the truth about what you are
// carrying, and every item is a card you press.
//
// Constantine, 2026-08-21, three asks in one message and one correction after:
//   1. "it should only show armory you actually picked up mid run"
//   2. "each item should be folded panes that can expand"
//   3. "clicking on the armory item pane should auto expand it with a button to
//      equip (un equip in red if it's already equipped)"
//   correction: "the sub button under the folded weapon army item pane should
//      NOT exist. it should be part of the card and is revealed pressing the
//      card instead"
//
// THREE PROPERTIES, ONE PER ASK, AND A3 CARRIES THE CORRECTION AS A NEGATIVE.
//
//   A1  THE SHELF IS THE RUN'S, NOT THE PROFILE'S. Every piece the picker
//       offers is one this RUN carries (or one tagged basic — his own earlier
//       ask, A7, and the one exception this property allows by name). Measured
//       at the MODEL door, `ownership()` in src/model/loadout.js, because that
//       is the single predicate `eligible()` in the screen calls; a page count
//       is carried beside it as the surface witness.
//   A2  EVERY ITEM ARRIVES FOLDED. Each candidate is a face with
//       aria-expanded="false" and nothing revealed under it at open.
//   A3  THE CARD IS THE CONTROL. Pressing a face opens exactly that face,
//       reveals one equip control, and that control says Unequip — carrying the
//       danger class, which is what "in red" is in this stylesheet — when the
//       piece is the one already in the set. AND THE NEGATIVE, which is his
//       correction stated as a check: NO pressable control exists in the
//       candidate list that is not a face or inside the revealed panel. A sub
//       button relabelled is still a sub button, and this is what catches it.
//
// DOOR. The source tree, served by the repo's own tools/serve.mjs, driven in
// real Chromium through tools/browser.mjs's CDP path — the same road every
// other driven tool here takes, and the road tools/screenshot.mjs does NOT take
// (it prints an 87 px white band and exits 0 under Chromium 141; a green from
// it means nothing). `--selftest` plants each known-bad as BYTES in the file the
// real defect would ship in and re-runs this whole tool against the copy.
//
// Usage:  node tools/armoury-picked-up.mjs
//         node tools/armoury-picked-up.mjs --selftest
// Exit:   0 all green · 1 any finding · 2 the harness could not run
//
// BOUNDARY, and it is the extent of the green. One Linux container, one
// headless Chromium, ONE SHAPE (1200x730), and ONE BOARD — `?shot=combat`,
// which is the IN-COMBAT mount (inCombat: true). The map's Armoury is a second
// mount with a different `meta` and a live onChange, and NOTHING HERE SPEAKS
// FOR IT. A1's model half is shape-free and covers both; A2 and A3 are the
// combat mount only.
//
// REMOVAL CONDITION: deleted the day the Armoury stops being the shelf — if the
// picker ever moves off `ownership()`, A1 is measuring a predicate nobody reads.

if (process.argv.includes('--selftest')) {
  const { doorSelftest } = await import('./doorplant.mjs');
  process.exit(await doorSelftest({
    tool: 'armoury-picked-up.mjs',
    timeoutMs: 900000,
    plants: [
      {
        // A1's known-bad, and it is THE DEFECT AT dev: the shelf reads the
        // profile as well as the run, so a piece found in an earlier climb is
        // offered in this one. One word in a content table, which is the point.
        name: 'the shelf goes back to profile-wide (persistence: both)',
        edits: [{ file: 'src/content/balance.js',
          find: "    persistence: 'perRun',",
          replace: "    persistence: 'both'," }],
        expectRed: /FAIL A1 the picker offers \d+ piece\(s\) this run never picked up/,
      },
      {
        // THE OTHER DIRECTION OF THE SAME COLLAPSE, and it is the one my own
        // Charter row names as the worse silence: not "the shelf is too wide"
        // but "the shelf invented a state nobody built". `unlocked` is a legal
        // value of this closed set that makes the run's own pickups invisible —
        // a player collects a sword and the Armoury does not offer it.
        name: 'the shelf stops counting the run at all (persistence: unlocked)',
        edits: [{ file: 'src/content/balance.js',
          find: "    persistence: 'perRun',",
          replace: "    persistence: 'unlocked'," }],
        // BOUND TO ITS OWN DIRECTION, and this is a correction to my first
        // draft rather than caution. `expectRed: /FAIL A1/` passed here — but
        // it passed on the OTHER sub-check's line, the same "offers too much"
        // sentence the plant above produces. A plant whose name says
        // "the run's pickups go invisible" and whose evidence says
        // "the shelf is too wide" has caught something and measured nothing
        // (SOP 14 §3: failing for the wrong reason is not red). The emptiness
        // direction is the one my own Charter row names as the worse silence,
        // so it gets the assertion that can only be satisfied by it.
        expectRed: /FAIL A1 a piece the run picked up \([a-zA-Z]+\) is not offered/,
      },
      {
        // A2's known-bad: the panes arrive already open. This is the state the
        // screen was in at dev — every candidate's comparison rendered inline,
        // permanently — so the plant restores the shipped defect rather than
        // inventing one.
        name: 'the candidate panes open unfolded',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: '    mountDisclosure(list, entries, { moreLabel: \'more\' });',
          replace: '    const planted = mountDisclosure(list, entries, { moreLabel: \'more\' });\n'
            + '    if (entries.length) planted.open(entries[0].key); // planted: arrives open' }],
        expectRed: /FAIL A2/,
      },
      {
        // A3's known-bad, and it is HIS CORRECTION planted: a second control
        // hung under the pane instead of living inside the card. It equips
        // correctly and reads plausibly, which is exactly why the negative
        // check has to exist rather than being argued.
        name: 'a sub button returns under the pane',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: '    return box;\n  }\n\n  /** The rewrites, live:',
          replace: '    const sub = document.createElement(\'button\');\n'
            + '    sub.type = \'button\'; sub.className = \'ep-sub\'; sub.textContent = \'Stats\';\n'
            + '    list.appendChild(sub); // planted: the sub button he removed\n'
            + '    return box;\n  }\n\n  /** The rewrites, live:' }],
        expectRed: /FAIL A3/,
      },
      {
        // The RED half of "un equip in red". A plant that repaints the control
        // without changing its word: it still says Unequip, still equips
        // nothing, and only the danger class is gone. If the check is really
        // reading the colour channel this goes red; if it was only reading the
        // word, this passes and the check was half of what it claimed.
        name: 'the unequip control loses its danger class (word unchanged)',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: "      btn.className = equipped ? 'ep-equip danger' : 'ep-equip';",
          replace: "      btn.className = 'ep-equip';" }],
        expectRed: /FAIL A3/,
      },
    ],
  }));
}

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BROWSERS = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browserPath = BROWSERS.find((p) => p && existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SHAPE = [1200, 730];

let fails = 0; let checks = 0;
const ok = (cond, what) => { checks++; if (cond) console.log(`    PASS ${what}`); else { fails++; console.log(`    ${what}`); } };

function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map();
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result); } });
  return { ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) { const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }); },
    close: () => ws.close() };
}

// ---------------------------------------------------------------------------
// A1 — the model door. `ownership()` is the one predicate the picker calls, so
// the known-bad enters where the real input enters: the content table it reads.
// ---------------------------------------------------------------------------
async function a1Model() {
  console.log('\n  A1 · the shelf is the run\'s, not the profile\'s  (model door: ownership())');
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { ownership, carriedIds } = await import('../src/model/loadout.js');
  const reg = createRegistries(contentBundle);
  const cfg = reg.balance.equipment;
  const basicTag = cfg.basicTag;
  const pieces = [...(reg.equipment.armaments || [])];
  const isBasic = (p) => !!basicTag && (p.tags || []).includes(basicTag);

  // A run that has picked up NOTHING beyond its starting kit, and a profile
  // that has found a great deal. These are the two edges of the same axis and
  // the gap between them is exactly what he asked to be closed.
  const fresh = { storage: [], sets: {} };
  const carried = new Set(carriedIds(fresh));
  const profileFound = pieces.map((p) => p.id); // the widest possible profile
  const own = ownership(reg, { meta: { found: profileFound }, loadout: fresh });

  const offered = pieces.filter((p) => own.has(p));
  const notCarried = offered.filter((p) => !carried.has(p.id) && !isBasic(p));
  console.log(`      persistence = ${JSON.stringify(cfg.persistence)} · basicTag = ${JSON.stringify(basicTag)}`);
  console.log(`      armaments authored ${pieces.length} · profile found ${profileFound.length} · run carries ${carried.size}`);
  console.log(`      picker would offer ${offered.length}; of those ${notCarried.length} are neither carried this run nor basic`);
  ok(notCarried.length === 0,
    notCarried.length === 0
      ? `A1 every offered piece is carried this run or basic (offered ${offered.length}, basic ${offered.filter(isBasic).length})`
      : `FAIL A1 the picker offers ${notCarried.length} piece(s) this run never picked up`
        + ` — e.g. ${notCarried.slice(0, 4).map((p) => p.id).join(', ')}`);

  // BOTH EDGES OF THE SAME PROPERTY, so a green cannot be vacuous: a piece the
  // run DOES carry must still be offered. A shelf that offers nothing would
  // satisfy the sentence above and be the worse defect.
  const some = pieces.find((p) => !isBasic(p));
  if (some) {
    const withOne = { storage: [some.id], sets: {} };
    const own2 = ownership(reg, { meta: { found: [] }, loadout: withOne });
    ok(own2.has(some), own2.has(some)
      ? `A1 a piece the run picked up IS offered (${some.id}) — the property is not vacuous`
      : `FAIL A1 a piece the run picked up (${some.id}) is not offered — the shelf is empty, not narrow`);
  }
}

async function main() {
  if (!browserPath) { console.error('armoury-picked-up: no Chrome/Chromium — set $CHROME'); process.exit(2); }
  console.log(`armoury-picked-up — source tree, real browser, ${SHAPE[0]}x${SHAPE[1]}, ?shot=combat`);

  await a1Model();

  const s = await serve({ root: ROOT, port: 8479, open: false });
  const base = `http://localhost:${s.port}/`;
  const { wsUrl, close: dropBrowser } = await launchBrowser({
    prefix: 'armpick-', browser: browserPath, args: ['--allow-file-access-from-files'], timeoutMs: 20000,
  });
  const cdp = connectCdp(wsUrl); await cdp.ready;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: SHAPE[0], height: SHAPE[1], deviceScaleFactor: 1, mobile: false }, S);
  const ev = async (e) => {
    const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw');
    return r.result.value;
  };
  const until = async (x, w, ms = 25000) => { const t = Date.now();
    while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(60); } throw new Error('timeout ' + w); };

  try {
    await cdp.send('Page.navigate', { url: `${base}?shot=combat` }, S);
    await until("!!document.querySelector('.combat .hand .card')", 'combat');
    await wait(600);
    await ev("document.querySelector('#combat-armoury').click()");
    await until("!!document.querySelector('.armoury-overlay')", 'armoury', 8000);
    await wait(400);

    // Open a slot's picker — the surface all three asks are about. The slot is
    // READ off the page, never typed: a hardcoded id stops measuring the day
    // equipSlots.csv moves, which is the same defect this file is checking for.
    const slotOpened = await ev(`(() => {
      const b = document.querySelector('.armoury-overlay .equip-slot .es-cell:not(.locked)')
             || document.querySelector('.armoury-overlay .equip-slot .es-cell');
      if (!b) return false; b.click(); return true; })()`);
    if (!slotOpened) { console.log('    SKIP no slot cell to open — NOT a pass'); fails++; checks++; }
    else {
      await until("!!document.querySelector('.equip-picker .ep-list')", 'picker', 8000);
      await wait(350);

      // ---- A2 ----------------------------------------------------------
      console.log('\n  A2 · every item arrives folded  (page door)');
      const snap = JSON.parse(await ev(`JSON.stringify((() => {
        const list = document.querySelector('.equip-picker .ep-list');
        const faces = [...list.querySelectorAll('.disc-face')];
        return {
          faces: faces.length,
          expandedAtOpen: faces.filter((f) => f.getAttribute('aria-expanded') === 'true').length,
          revealShown: [...list.querySelectorAll('.disc-reveal')].filter((p) => !p.hidden).length,
          chipsFlat: list.querySelectorAll(':scope > .equip-candidate-row').length,
        }; })())`));
      console.log(`      faces ${snap.faces} · expanded at open ${snap.expandedAtOpen} · reveal panels showing ${snap.revealShown} · flat rows ${snap.chipsFlat}`);
      ok(snap.faces > 0, snap.faces > 0 ? `A2 the picker draws ${snap.faces} item faces`
        : 'FAIL A2 the picker draws no item faces at all — nothing to fold');
      ok(snap.faces > 0 && snap.expandedAtOpen === 0 && snap.revealShown === 0,
        (snap.faces > 0 && snap.expandedAtOpen === 0 && snap.revealShown === 0)
          ? 'A2 every item arrives folded — 0 expanded, 0 panels showing'
          : `FAIL A2 items do not arrive folded — ${snap.expandedAtOpen} face(s) expanded, ${snap.revealShown} panel(s) showing`);

      // ---- A3 ----------------------------------------------------------
      console.log('\n  A3 · the card is the control  (page door)');
      // THE NEGATIVE FIRST, because it is his correction: nothing pressable in
      // the list may sit outside a face or the revealed panel.
      const strays = JSON.parse(await ev(`JSON.stringify((() => {
        const list = document.querySelector('.equip-picker .ep-list');
        const all = [...list.querySelectorAll('button')];
        const stray = all.filter((b) => !b.classList.contains('disc-face') && !b.closest('.disc-reveal'));
        return { total: all.length, stray: stray.length, names: stray.slice(0, 4).map((b) => b.className || b.textContent.trim().slice(0, 20)) };
      })())`));
      ok(strays.stray === 0, strays.stray === 0
        ? `A3 no control outside the card — ${strays.total} button(s), all faces or inside the reveal`
        : `FAIL A3 ${strays.stray} sub button(s) hang outside the card: ${strays.names.join(' · ')}`);

      // Press the card. One gesture, and it must open THAT card and only it.
      const pressed = JSON.parse(await ev(`JSON.stringify((() => {
        const list = document.querySelector('.equip-picker .ep-list');
        const faces = [...list.querySelectorAll('.disc-face')];
        const f = faces[0]; if (!f) return null;
        f.click();
        const open = [...list.querySelectorAll('.disc-face')].filter((x) => x.getAttribute('aria-expanded') === 'true');
        const panel = list.querySelector('.disc-reveal');
        const btn = panel && !panel.hidden ? panel.querySelector('.ep-equip') : null;
        return { openCount: open.length, openedIsPressed: open[0] === f, panelShown: !!(panel && !panel.hidden),
          btn: btn ? { text: btn.textContent.trim(), cls: btn.className, act: btn.dataset.act || '' } : null };
      })())`));
      await wait(200);
      if (!pressed) { console.log('    FAIL A3 no face to press'); fails++; checks++; }
      else {
        console.log(`      after press: ${pressed.openCount} open · panel shown ${pressed.panelShown} · control ${JSON.stringify(pressed.btn)}`);
        ok(pressed.openCount === 1 && pressed.openedIsPressed && pressed.panelShown,
          (pressed.openCount === 1 && pressed.openedIsPressed && pressed.panelShown)
            ? 'A3 pressing the card reveals exactly that card'
            : `FAIL A3 pressing the card did not reveal it — ${pressed.openCount} open, panel shown ${pressed.panelShown}`);
        ok(!!pressed.btn, pressed.btn ? `A3 the revealed card carries one equip control ("${pressed.btn.text}")`
          : 'FAIL A3 the revealed card carries no equip control');
      }

      // The RED half. Find the face for the piece already in the set and press
      // it: its control must say Unequip AND carry the danger class. Two
      // independent channels, because a word without the colour, or a colour
      // without the word, each satisfies half his sentence.
      const un = JSON.parse(await ev(`JSON.stringify((() => {
        const list = document.querySelector('.equip-picker .ep-list');
        const faces = [...list.querySelectorAll('.disc-face')];
        const cur = faces.find((f) => f.dataset.equipped === '1');
        if (!cur) return { none: true, faces: faces.map((f) => f.dataset.face) };
        // PRESS ONLY IF SHUT. The face toggles, so a probe that clicks
        // unconditionally closes the pane the previous check opened and then
        // reports "no control" — which is the instrument failing, wearing the
        // product's clothes. It cost this file one red for the wrong reason.
        if (cur.getAttribute('aria-expanded') !== 'true') cur.click();
        const panel = list.querySelector('.disc-reveal');
        const btn = panel && !panel.hidden ? panel.querySelector('.ep-equip') : null;
        return { none: false, text: btn ? btn.textContent.trim() : null, cls: btn ? btn.className : null,
          act: btn ? (btn.dataset.act || '') : null };
      })())`));
      if (un.none) {
        console.log(`    FAIL A3 no face is marked as the equipped piece (faces: ${(un.faces || []).slice(0, 5).join(', ')}) — the red state is unreachable, so it is unmeasured`);
        fails++; checks++;
      } else {
        console.log(`      equipped card's control: ${JSON.stringify(un)}`);
        ok(/unequip/i.test(un.text || ''), /unequip/i.test(un.text || '')
          ? `A3 the equipped card's control says "${un.text}"`
          : `FAIL A3 the equipped card's control says "${un.text}", not Unequip`);
        ok(/\bdanger\b/.test(un.cls || ''), /\bdanger\b/.test(un.cls || '')
          ? 'A3 the unequip control is red (carries .danger)'
          : `FAIL A3 the unequip control is not red — class "${un.cls}"`);
      }
    }
  } catch (e) {
    console.error(`    HARNESS could not run: ${e.message}`);
    cdp.close(); await dropBrowser(); if (s.server) s.server.close();
    process.exit(2);
  }

  cdp.close(); await dropBrowser(); if (s.server) s.server.close();
  console.log(`\n  ${checks} checks, ${fails} finding(s)`);
  console.log('  BOUNDARY: one container, one headless Chromium, ONE shape (1200x730), ONE board (?shot=combat,');
  console.log('  the in-combat mount). The map Armoury is a second mount and is NOT covered by A2/A3.');
  process.exit(fails ? 1 : 0);
}

await main();
