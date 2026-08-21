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
//       correction stated as a check: no pressable control exists in the
//       candidate list that is not a face, inside the revealed panel, OR THE
//       ONE GRIP A6 RULES ON. A sub button relabelled is still a sub button,
//       and this is what catches it.
//
//       THE EXCEPTION IS HIM OVERRIDING HIMSELF AND IT IS NOT SMOOTHED HERE.
//       On 2026-08-21 he corrected item 3 to *"the sub button ... should NOT
//       exist"*; on the same day he ruled TWO ELEMENTS, which puts a control
//       back outside the card. Both sentences are his, the second is later, and
//       the check follows the later one — but only for a control that is
//       exactly `.ep-hold`, exactly one per face, immediately after its own
//       face. Anything else outside a card is still A3.stray.
//
//   A6  TWO ELEMENTS, ONE GESTURE EACH (his ruling, 2026-08-21). The grip holds
//       the hold and nothing else: a real pointer press, held past the player's
//       own dial, equips — and an EARLY RELEASE does nothing at all, neither
//       equipping (rule 1) nor leaking a click into the card's unfold path.
//       The card keeps its click, the in-card button keeps its click, and
//       NEITHER of the other two is armed. Driven with REAL CDP INPUT — mouse
//       and touch — not DOM `.click()`, because a hold is a pointer press by
//       nature and a wired handler is not a finger.
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
// headless Chromium, and — for A1/A2/A3 — ONE SHAPE (1200x730) and ONE BOARD:
// `?shot=combat`,
// which is the IN-COMBAT mount (inCombat: true). The map's Armoury is a second
// mount with a different `meta` and a live onChange, and NOTHING HERE SPEAKS
// FOR IT. A1's model half is shape-free and covers both; A2 and A3 are the
// combat mount only.
//
// REMOVAL CONDITION: deleted the day the Armoury stops being the shelf — if the
// picker ever moves off `ownership()`, A1 is measuring a predicate nobody reads.
//
// -----------------------------------------------------------------------------
// FINDING CODES — one closed set, read by BOTH the emitter and the plant, so the
// second copy never exists. Added 2026-08-21 after Saga's WITHHOLD at ea2cf89.
//
// WHAT BIT US, and it was my own rule from both ends. I wrote that an
// `expectRed` matching a check ID instead of a sentence is not a plant but a
// hope — /FAIL A1/ is satisfied by whichever of A1's three sub-checks happens to
// fire, so it catches something and measures nothing. That correction was right
// and it is kept. What it did NOT survive is the inverse: an `expectRed` bound
// to a SENTENCE dies silently the day the sentence is reworded. Both of A1's
// plants asserted prose this file no longer printed; the checks discriminated
// correctly in both directions and the corpus reported NOT CAUGHT anyway.
//
// THE ANCHOR, and why it cannot rot either way:
//   · A code names ONE ASSERTION IN ONE DIRECTION — `A1.wide` (the shelf offers
//     what the run never picked up) and `A1.step` (a pickup does not move the
//     shelf) are different codes, so a plant bound to one CANNOT be satisfied by
//     the other. That is the discrimination the sentence was bought for.
//   · The prose stays free. Reword any FAIL line and every plant still holds:
//     the code and the sentence are printed by ONE call, so they cannot drift
//     into two copies of the same fact.
//   · A plant naming a code this file cannot emit THROWS AT LOAD (`redRe`
//     below), so a rename is a hard red on the next run, never a silent green.
//     doorplant already gives the plant's FIND-STRING that guarantee; this gives
//     it to the assertion side, which is the half that was missing.
//
// REMOVAL CONDITION for the codes: deleted the day a plant is bound to something
// stronger than an output match — a structured findings array the harness reads.
// Then the string is the second copy and this block is the thing to cut.
const CODES = new Set([
  'A1.wide',   // the shelf offers a piece neither in the kit nor picked up
  'A1.floor',  // the shelf is empty rather than narrow
  'A1.step',   // picking a piece up does not move the shelf by exactly one
  'A2.faces',  // the picker draws no item faces at all
  'A2.folded', // the items do not arrive folded
  'A3.stray',  // a pressable control sits outside the card
  'A3.press',  // pressing the card does not reveal exactly that card
  'A3.control',// the revealed card carries no equip control
  'A3.marked', // no face is marked as the equipped piece
  'A3.word',   // the equipped card's control does not say Unequip
  'A3.danger', // the unequip control does not carry .danger
  'A4.nocard', // no card on the map mount to press
  'A4.acted',  // a short click equipped or unequipped
  'A4.unfold', // a short click did not unfold the card
  'A5.refold', // clicking again did not refold
  'A5.pose',   // could not pose an open card with somewhere outside it
  'A5.offcard',// clicking off the card left it open
  // A6 — HIS TWO-ELEMENT RULING (2026-08-21). The grip carries the hold; the
  // card keeps its click; the in-card button keeps its click. Every code below
  // names ONE assertion in ONE direction, so a plant bound to one can never be
  // satisfied by another (the anchor rule, above).
  'A6.nogrip',      // a card has no grip immediately after it
  'A6.unreachable', // the grip has no box while the list is folded
  'A6.unarmed',     // the grip publishes no armed hold while the dial is on
  'A6.thumb',       // the grip is shorter than the tap floor
  'A6.face',        // the card face itself carries an armed hold
  'A6.finger',      // no real pointer press could be landed on the grip
  'A6.leak',        // an aborted hold unfolded the card
  'A6.acted',       // an aborted hold equipped or unequipped
  'A6.equips',      // a completed hold did not equip
  'A6.tail',        // the lift after a completed hold activated something else
  'A6.button',      // the in-card equip button no longer equips on a plain click
]);
const known = (code) => { if (!CODES.has(code)) throw new Error(`armoury-picked-up: unknown finding code "${code}" — the codes are a closed set; add it above or fix the caller.`); return code; };
/** The one emitter: the code and its sentence are born in the same call. */
const red = (code, text) => `FAIL [${known(code)}] ${text}`;
/** The one anchor a plant may use. Unknown code = throw, not a quiet miss. */
const redRe = (code) => new RegExp(`FAIL \\[${known(code).replace('.', '\\.')}\\]`);

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
        // BOUND TO ITS OWN DIRECTION BY CODE, not by prose. `both` widens the
        // shelf past the run, so A1.wide is the sentence this defect owns.
        expectRed: redRe('A1.wide'),
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
        //
        // THAT REASONING STANDS; ITS ANCHOR DID NOT. The tightening above was
        // written against a sentence this file has since reworded, so the plant
        // asserted prose nobody prints and reported NOT CAUGHT while the check
        // discriminated perfectly. A1.step is the same direction stated as a
        // code: `both` does not fire it, `unlocked` does.
        expectRed: redRe('A1.step'),
        // BOUNDARY, measured not assumed: an empty shelf also draws no cards on
        // the map mount, so this plant additionally kills the A4/A5 stage with
        // `timeout picker`. The catch above is the MODEL-DOOR red, which prints
        // before any browser boots — not the crash.
      },
      {
        // A2's known-bad: the panes arrive already open. This is the state the
        // screen was in at dev — every candidate's comparison rendered inline,
        // permanently — so the plant restores the shipped defect rather than
        // inventing one.
        name: 'the candidate panes open unfolded',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: '    const fold = mountDisclosure(list, entries, { moreLabel: \'more\' });',
          replace: '    const fold = mountDisclosure(list, entries, { moreLabel: \'more\' });\n'
            + '    if (entries.length) fold.open(entries[0].key); // planted: arrives open' }],
        // A2 has two directions too — "no faces at all" is a different defect
        // from "the faces arrive open". This plant owns the second.
        expectRed: redRe('A2.folded'),
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
        expectRed: redRe('A3.stray'),
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
        // The colour channel ONLY. A3.word is the other half of his sentence and
        // this plant leaves the word alone on purpose, so binding to A3.word
        // would be the "caught something, measured nothing" failure again.
        expectRed: redRe('A3.danger'),
      },
      // ---- A6, HIS TWO-ELEMENT RULING ---------------------------------
      // ALL SIX BELOW WERE HAND-PLANTED IN THE REAL TREE FIRST and reverted;
      // this door is the repeatable copy of that, not the evidence for it.
      {
        // THE ONE THE RULING WAS BOUGHT WITH. Two elements exist so that no
        // control carries both gestures — so the aborted hold's click must have
        // NO path to the fold. This wires one by hand, in front of armHold's
        // own swallow so it runs first, which is exactly the "second door"
        // rule 1 forbids. Hand-planted red on BOTH mouse and touch.
        name: 'the grip also unfolds the card (rule 1 leaks a second door)',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: '      heldGrips.push(armHold(grip,',
          replace: "      grip.addEventListener('click', () => fold.open(entry.key)); // planted: the second door\n"
            + '      heldGrips.push(armHold(grip,' }],
        expectRed: redRe('A6.leak'),
      },
      {
        // THE CARD CLAIMS THE HOLD. Bound to the PUBLISHED attribute, and that
        // is a deliberate narrowing rather than caution. The behavioural
        // known-bad — actually `armHold(face, …)` — was hand-planted too and it
        // reds A4.acted + A4.unfold FIRST (a DOM click on an armed control is
        // `detail === 0`, so it commits instead of folding) and then empties the
        // shelf, taking the whole A6 stage with it: exit 2, A6.face never
        // reached. Binding this plant to A6.face would then have been a plant
        // that catches something and measures nothing — my own named failure.
        // So the plant states the direction the CHECK can actually own: a face
        // that publishes an armed hold, which is a lying page whether or not a
        // hold is behind it (holdbeat.js and main.js both read that attribute).
        name: 'a card face publishes an armed hold',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: '      heldGrips.push(armHold(grip,',
          replace: '      face.dataset.holdMs = String(gripMs); // planted: the face claims a hold\n'
            + '      heldGrips.push(armHold(grip,' }],
        expectRed: redRe('A6.face'),
      },
      {
        // THE ARRANGEMENT THIS ONE WAS CHOSEN OVER, planted so the choice is
        // the tool's finding and not this file's prose. A grip inside the
        // revealed pane is in the DOM and measures 0x0 while the list is
        // folded: no pointer can reach it, so the hold can only be performed
        // after the click it exists to save.
        name: 'the grip moves inside the revealed pane (the arrangement this one was chosen over)',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: "      face.insertAdjacentElement('afterend', grip);",
          replace: '      entry.reveal.node.appendChild(grip); // planted: the grip lives in the pane' }],
        expectRed: redRe('A6.unreachable'),
      },
      {
        // WHAT A THUMB GETS. This plant caught the CHECK, not the product: the
        // first draft read the floor off `getComputedStyle('.ep-hold').minHeight`
        // — the resolved value of the rule it was guarding — so deleting the
        // rule deleted the check and the tool EXITED 0 on a 19 px hold target.
        // The floor now comes from `--tap-floor`, the datum balance.ui.tapSize
        // writes for the whole app, measured through a probe box.
        name: 'the grip loses its tap floor (what a thumb gets)',
        edits: [{ file: 'styles/ui.css',
          find: '  min-height: var(--tap-floor);\n  width: 100%;',
          replace: '  width: 100%;' }],
        expectRed: redRe('A6.thumb'),
      },
      {
        // THE LIFT AFTER THE COMMIT, and it is TOUCH-ONLY by nature: a mouse
        // release over a removed element generates no click at all, a finger
        // does. Hand-planted red at 1200x730 with the release landing on
        // `BUTTON.es-cell` — a picker the player never asked for.
        name: 'the lift after a completed hold is not swallowed (the redraw eats the finger)',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: 'onConfirm: () => { eatTheLift(); act(); }',
          replace: 'onConfirm: act /* planted: no lift swallow */' }],
        expectRed: redRe('A6.tail'),
      },
      {
        // HIS OWN GUARDRAIL ON HIS OWN RULING: the grip must not become the
        // only road. Anyone who cannot perform a hold — on any input — still
        // has the control inside the opened card.
        name: 'the in-card control stops equipping (the hold becomes the only road)',
        edits: [{ file: 'src/ui/screens/equipment.js',
          find: "      if (seal.ok) btn.addEventListener('click', act);",
          replace: "      if (seal.ok && false) btn.addEventListener('click', act); // planted: the hold is the only road" }],
        expectRed: redRe('A6.button'),
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
  console.log('\n  A1 · the shelf is KIT ∪ WHAT THIS RUN PICKED UP  (model door: ownership())');
  const { contentBundle } = await import('../src/content/index.js');
  const { createRegistries } = await import('../src/model/registries.js');
  const { createRunState } = await import('../src/model/state.js');
  const { ownership, carriedIds } = await import('../src/model/loadout.js');
  const reg = createRegistries(contentBundle);
  const cfg = reg.balance.equipment;
  const pieces = [...(reg.equipment.armaments || [])];
  console.log(`      persistence = ${JSON.stringify(cfg.persistence)} · basicTag = ${JSON.stringify(cfg.basicTag)}`);

  // THE WIDEST POSSIBLE PROFILE, on purpose. If anything outside the run can
  // reach the shelf, this is the corpus that finds it: every armament the game
  // has, marked found in an earlier climb. His sentence says none of it counts.
  const everything = pieces.map((p) => p.id);
  let wideFail = 0; let floorFail = 0; const seen = [];
  for (const cls of reg.classes.all()) {
    const run = createRunState({ seed: 1, classId: cls.id, registries: reg, profileMeta: { found: everything } });
    const carried = new Set(carriedIds(run.loadout));
    const own = ownership(reg, { meta: { found: everything }, loadout: run.loadout });
    const offered = pieces.filter((p) => own.has(p)).map((p) => p.id);
    const strangers = offered.filter((id) => !carried.has(id));
    seen.push(`${cls.id}: ${offered.join(', ') || '(none)'}`);
    if (strangers.length) {
      wideFail++;
      console.log(`    ${red('A1.wide', `${cls.id} is offered ${strangers.length} piece(s) neither in its kit nor picked up`
        + ` — ${strangers.slice(0, 5).join(', ')}`)}`);
    }
    // THE FLOOR, and it is the half his "unless" clause protects: a run that has
    // picked up nothing still shows the kit it is WEARING. A shelf of zero would
    // satisfy "nothing you did not pick up" and be the worse screen.
    if (!offered.length) {
      floorFail++;
      console.log(`    ${red('A1.floor', `${cls.id} is offered NOTHING — the shelf is empty, not narrow`)}`);
    }
  }
  for (const line of seen) console.log(`      ${line}`);
  checks += 2;
  if (!wideFail) console.log(`    PASS A1 no class is offered anything outside its kit, against a MAXIMAL profile (${reg.classes.all().length} classes)`);
  else fails++;
  if (!floorFail) console.log('    PASS A1 every class still sees the kit it is wearing — the floor holds');
  else fails++;

  // AND A PICKUP IS STILL A PICKUP. Without this the two checks above are both
  // satisfied by a shelf frozen at the kit forever, which is not his rule.
  const cls0 = reg.classes.all()[0];
  const run0 = createRunState({ seed: 1, classId: cls0.id, registries: reg, profileMeta: {} });
  const before = pieces.filter((p) => ownership(reg, { meta: {}, loadout: run0.loadout }).has(p)).length;
  const pickup = pieces.find((p) => !carriedIds(run0.loadout).includes(p.id));
  run0.loadout.storage = [...(run0.loadout.storage || []), pickup.id];
  const after = pieces.filter((p) => ownership(reg, { meta: {}, loadout: run0.loadout }).has(p)).length;
  ok(after === before + 1,
    after === before + 1
      ? `A1 picking one piece up adds exactly one to the shelf (${before} → ${after}, ${pickup.id})`
      : red('A1.step', `picking up ${pickup.id} moved the shelf ${before} → ${after}, not by one`));
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
        : red('A2.faces', 'the picker draws no item faces at all — nothing to fold'));
      ok(snap.faces > 0 && snap.expandedAtOpen === 0 && snap.revealShown === 0,
        (snap.faces > 0 && snap.expandedAtOpen === 0 && snap.revealShown === 0)
          ? 'A2 every item arrives folded — 0 expanded, 0 panels showing'
          : red('A2.folded', `items do not arrive folded — ${snap.expandedAtOpen} face(s) expanded, ${snap.revealShown} panel(s) showing`));

      // ---- A3 ----------------------------------------------------------
      console.log('\n  A3 · the card is the control  (page door)');
      // THE NEGATIVE FIRST, because it is his correction: nothing pressable in
      // the list may sit outside a face or the revealed panel.
      const strays = JSON.parse(await ev(`JSON.stringify((() => {
        const list = document.querySelector('.equip-picker .ep-list');
        const all = [...list.querySelectorAll('button')];
        const outside = all.filter((b) => !b.classList.contains('disc-face') && !b.closest('.disc-reveal'));
        // THE ONE NAMED EXCEPTION, and it is checked rather than waved through:
        // a control outside the card is legal ONLY if it is the ruled grip AND
        // it is the immediate next sibling of a face. Anything else is a stray.
        const grip = (b) => b.classList.contains('ep-hold')
          && b.previousElementSibling && b.previousElementSibling.classList.contains('disc-face');
        const stray = outside.filter((b) => !grip(b));
        return { total: all.length, outside: outside.length, grips: outside.length - stray.length,
          stray: stray.length, names: stray.slice(0, 4).map((b) => b.className || b.textContent.trim().slice(0, 20)) };
      })())`));
      ok(strays.stray === 0, strays.stray === 0
        ? `A3 no control outside the card but the ruled grip — ${strays.total} button(s), ${strays.grips} grip(s)`
        : red('A3.stray', `${strays.stray} sub button(s) hang outside the card and are not the ruled grip: ${strays.names.join(' · ')}`));

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
      if (!pressed) { console.log(`    ${red('A3.press', 'no face to press')}`); fails++; checks++; }
      else {
        console.log(`      after press: ${pressed.openCount} open · panel shown ${pressed.panelShown} · control ${JSON.stringify(pressed.btn)}`);
        ok(pressed.openCount === 1 && pressed.openedIsPressed && pressed.panelShown,
          (pressed.openCount === 1 && pressed.openedIsPressed && pressed.panelShown)
            ? 'A3 pressing the card reveals exactly that card'
            : red('A3.press', `pressing the card did not reveal it — ${pressed.openCount} open, panel shown ${pressed.panelShown}`));
        ok(!!pressed.btn, pressed.btn ? `A3 the revealed card carries one equip control ("${pressed.btn.text}")`
          : red('A3.control', 'the revealed card carries no equip control'));
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
        console.log(`    ${red('A3.marked', `no face is marked as the equipped piece (faces: ${(un.faces || []).slice(0, 5).join(', ')}) — the red state is unreachable, so it is unmeasured`)}`);
        fails++; checks++;
      } else {
        console.log(`      equipped card's control: ${JSON.stringify(un)}`);
        ok(/unequip/i.test(un.text || ''), /unequip/i.test(un.text || '')
          ? `A3 the equipped card's control says "${un.text}"`
          : red('A3.word', `the equipped card's control says "${un.text}", not Unequip`));
        ok(/\bdanger\b/.test(un.cls || ''), /\bdanger\b/.test(un.cls || '')
          ? 'A3 the unequip control is red (carries .danger)'
          : red('A3.danger', `the unequip control is not red — class "${un.cls}"`));
      }
    }

    // ---- A4 / A5 · THE MAP MOUNT, where equipping is not sealed ---------
    //
    // WHY A SECOND BOARD, AND IT IS NOT THOROUGHNESS. `?shot=combat` mounts the
    // Armoury with inCombat: true, so `canEquip` SEALS every act — no hold is
    // armed at all there, and a check for "the hold equips" would have been
    // vacuous on the only board this file used to drive. His hold rules are
    // only measurable where equipping is legal, which is the map. This also
    // closes half the boundary this tool used to print.
    console.log('\n  A4/A5 · click folds, and does NOT act  (map mount, ?shot=map)');
    await cdp.send('Page.navigate', { url: `${base}?shot=map` }, S);
    await until("!!document.querySelector('#open-armoury')", 'map');
    await wait(700);
    await ev("document.querySelector('#open-armoury').click()");
    await until("!!document.querySelector('.armoury-overlay')", 'armoury', 8000);
    await wait(450);
    await ev(`(() => { const b = document.querySelector('.armoury-overlay .equip-slot .es-cell:not(.locked)')
      || document.querySelector('.armoury-overlay .equip-slot .es-cell'); if (b) b.click(); return !!b; })()`);
    // NO CARD HERE IS A FINDING, NOT A CRASH — and it is the ONE timeout on this
    // stage that is. An empty shelf used to kill the run with an unhandled
    // `timeout picker` and exit 1, the code line 41 reserves for A FINDING; the
    // tool was reporting a harness death in a finding's clothes. Found by
    // hand-planting `persistence: 'unlocked'` in the real tree (Saga's WITHHOLD,
    // ea2cf89). No new concept: `A4.nocard` below is already the sentence for
    // "no card to press", so catching into a boolean lets that emitter reach it.
    // The two `until` calls just above are NOT this — a map that never mounts is
    // a harness death, and they now reach the exit-2 catch at the end of main().
    const mapHasCard = await until("!!document.querySelector('.equip-picker .ep-list .disc-face')", 'picker', 8000)
      .then(() => true, () => false);
    await wait(350);

    const faceBox = async () => JSON.parse(await ev(`JSON.stringify((() => {
      const f = document.querySelector('.equip-picker .ep-list .disc-face');
      if (!f) return null; const r = f.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2,
        holdMs: Number(f.dataset.holdMs || 0), equipped: f.dataset.equipped === '1',
        expanded: f.getAttribute('aria-expanded') === 'true' }; })())`));

    // THE CLICKS BELOW ARE DOM CLICKS, NOT SYNTHETIC POINTER EVENTS, AND THE
    // DIFFERENCE IS NAMED RATHER THAN GLOSSED. This app scales itself with
    // `body.style.zoom`, so `getBoundingClientRect()` px and CDP's input px are
    // NOT the same coordinate space — fx.js's `viewportLocalBox` exists for
    // exactly that conversion. A CDP press at rect coordinates landed nowhere
    // and printed three reds that were mine, not the screen's.
    // WHAT THIS COSTS, said plainly: these checks prove the HANDLER WIRING —
    // click folds, click again unfolds, click elsewhere closes — and say
    // NOTHING about whether a real finger at those pixels hits the card. That
    // is a geometry question and it wants the zoom conversion, not this road.
    const b0 = mapHasCard ? await faceBox() : null;
    if (!b0) { console.log(`    ${red('A4.nocard', 'no card on the map mount to press')}`); fails++; checks++; }
    else {
      // THE LENGTH IS READ OFF THE CONTROL, never typed here. `armHold` publishes
      // the dial it actually armed with; a number in this file would stop
      // measuring the moment a player moves the Hold-to-confirm setting, and
      // would also silently pass if the hold stopped being armed at all.
      console.log(`      the card publishes data-hold-ms=${b0.holdMs} (the player's dial, derived — not a number this tool chose)`);
      // NOT A CHECK, AND DELIBERATELY NOT ONE. His press-and-hold is BLOCKED on
      // a ruling (see equipment.js: armHold's rule 1 kills the short click that
      // his fold rule needs). Asserting it here would print a red for a thing
      // nobody has agreed to build; asserting the opposite would quietly bless
      // its absence. It is reported, and it is `unknown`.
      console.log(`      UNBUILT: no hold armed (data-hold-ms=${b0.holdMs || 0}). His press-and-hold is blocked on a`);
      console.log('      ruling — armHold rule 1 swallows the short click his fold rule needs. NOT counted either way.');

      // 1 · A SHORT CLICK MUST NOT EQUIP. It unfolds, and nothing else.
      const wasEquipped = b0.equipped;
      await ev(`document.querySelector('.equip-picker .ep-list .disc-face').click()`);
      await wait(400);
      const afterClick = await faceBox();
      ok(afterClick && afterClick.equipped === wasEquipped,
        (afterClick && afterClick.equipped === wasEquipped)
          ? `A4 a short click did NOT change what is equipped (still ${wasEquipped ? 'equipped' : 'empty'})`
          : red('A4.acted', 'a short click equipped/unequipped — click is supposed to fold, not act'));
      ok(afterClick && afterClick.expanded,
        (afterClick && afterClick.expanded)
          ? 'A4 a short click unfolded the card'
          : red('A4.unfold', 'a short click did not unfold the card'));

      // 2 · CLICK AGAIN REFOLDS.
      const b1 = await faceBox();
      await ev(`document.querySelector('.equip-picker .ep-list .disc-face').click()`);
      await wait(350);
      const b2 = await faceBox();
      ok(b2 && !b2.expanded, (b2 && !b2.expanded)
        ? 'A5 clicking the card again refolded it'
        : red('A5.refold', 'clicking again did not refold the card'));

      // 3 · CLICK OFF THE CARD REFOLDS. Open it, then press the picker header.
      await ev(`document.querySelector('.equip-picker .ep-list .disc-face').click()`);
      await wait(300);
      const openNow = await faceBox();
      const off = JSON.parse(await ev(`JSON.stringify((() => {
        const h = document.querySelector('.equip-picker h4'); if (!h) return null;
        const r = h.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })())`));
      if (!openNow || !openNow.expanded || !off) {
        console.log(`    ${red('A5.pose', 'could not pose an open card with somewhere outside it to press — NOT a pass')}`);
        fails++; checks++;
      } else {
        await ev(`document.querySelector('.equip-picker h4').click()`);
        await wait(350);
        const b3 = await faceBox();
        ok(b3 && !b3.expanded, (b3 && !b3.expanded)
          ? 'A5 clicking OFF the card refolded it'
          : red('A5.offcard', 'clicking off the card left it open'));
      }

    }

    // ---- A6 · TWO ELEMENTS, ONE GESTURE EACH ---------------------------
    //
    // REAL POINTER INPUT, and that is the whole reason this stage exists as a
    // separate one. A4/A5 above are DOM `.click()` calls: they prove handler
    // wiring and say nothing about a finger. A HOLD IS A PRESS BY NATURE —
    // there is no `.click()` that can express "down, wait 600 ms, up" — so it
    // is driven with `Input.dispatchMouseEvent` and `Input.dispatchTouchEvent`
    // at real coordinates, twice: once as a mouse, once as a THUMB.
    //
    // #304 said the conversion was the obstacle: this app scales with a zoom,
    // so `getBoundingClientRect()` px might not be CDP input px. MEASURED HERE
    // AND IT IS NOT: at 390x844 `--ui-zoom` is 0.9, a press at the RAW rect
    // centre lands on the grip and a press at rect x zoom lands on the wrong
    // control. So no conversion is applied — and the tool does not trust that
    // sentence either. Every press is preceded by an `elementFromPoint` at the
    // same coordinates and followed by a recorded `pointerdown`; if the finger
    // did not land, A6.finger is a red, not a silent pass on a press that
    // missed. THAT is what #304 actually hit: the picker opens below the fold
    // in this region, so the press landed on the heading painted over it.
    for (const touch of [false, true]) {
      const way = touch ? 'touch' : 'mouse';
      console.log(`\n  A6 · the grip holds the hold, and only the hold  (map mount, REAL ${way} input)`);
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: 5 }, S);
      // A FRESH BOARD PER PASS, AND AGAIN BEFORE THE BUTTON. The completed hold
      // below CHANGES THE LOADOUT, which is the point of it — and unequipping a
      // kit piece empties the shelf, because `ownership()` is kit-you-are-
      // WEARING union what you picked up. A second measurement on the same
      // board would be measuring the wreckage of the first, and it did: the
      // first draft of this stage reported "no in-card control" as a product
      // finding when the instrument had eaten its own corpus.
      const openBoard = async () => {
        await cdp.send('Page.navigate', { url: `${base}?shot=map` }, S);
        await until("!!document.querySelector('#open-armoury')", 'map');
        await wait(700);
        await ev("document.querySelector('#open-armoury').click()");
        await until("!!document.querySelector('.armoury-overlay')", 'armoury', 8000);
        await wait(450);
        await ev(`(() => { const b = document.querySelector('.armoury-overlay .equip-slot .es-cell:not(.locked)')
          || document.querySelector('.armoury-overlay .equip-slot .es-cell'); if (b) b.click(); return !!b; })()`);
        return until("!!document.querySelector('.equip-picker .ep-list .ep-hold')", 'grip', 8000)
          .then(() => true, () => false);
      };
      const hasGrip = await openBoard();
      if (!hasGrip) {
        console.log(`    ${red('A6.nogrip', `${way}: the folded list draws no grip at all`)}`);
        fails++; checks++; continue;
      }
      await wait(300);

      // THE FOLDED LIST, READ AS THE PLAYER MEETS IT. Every number below is off
      // the laid-out page, not off the source: the grip's own box, the tap
      // floor the stylesheet resolved, and whether the CARD is armed too.
      const shelf = JSON.parse(await ev(`JSON.stringify((() => {
        const list = document.querySelector('.equip-picker .ep-list');
        const faces = [...list.querySelectorAll('.disc-face')];
        const grips = [...list.querySelectorAll('.ep-hold')];
        // THE FLOOR IS THE HOUSE'S, NOT THE CONTROL'S, and this line is a repair.
        // It read \`getComputedStyle('.ep-hold').minHeight\` — the resolved value of
        // the very rule the check exists to guard. Hand-planting the removal of
        // that rule made the floor 0 and the tool EXITED 0: the check and the
        // defect were reading one source, so deleting the source deleted the
        // check. \`--tap-floor\` is the datum \`balance.ui.tapSize\` writes for the
        // whole app; it is a calc(), so it is resolved by measuring a probe box
        // rather than parsed out of a string.
        const probe = document.createElement('div');
        probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:var(--tap-floor)';
        document.body.appendChild(probe);
        const floor = probe.getBoundingClientRect().height;
        probe.remove();
        const paired = faces.filter((f) => f.nextElementSibling && f.nextElementSibling.classList.contains('ep-hold'));
        const boxed = grips.filter((g) => { const r = g.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
        const short = boxed.filter((g) => g.getBoundingClientRect().height + 0.5 < floor);
        const armedFaces = faces.filter((f) => Number(f.dataset.holdMs || 0) > 0);
        const g0 = grips[0] ? grips[0].getBoundingClientRect() : null;
        return { faces: faces.length, grips: grips.length, paired: paired.length, boxed: boxed.length,
          floor, short: short.length, armedFaces: armedFaces.length,
          holdMs: grips[0] ? Number(grips[0].dataset.holdMs || 0) : 0,
          g0: g0 ? { w: Math.round(g0.width), h: Math.round(g0.height) } : null,
          listH: Math.round(list.getBoundingClientRect().height),
          pickerH: Math.round(document.querySelector('.equip-picker').getBoundingClientRect().height),
          portH: document.querySelector('.armoury-right').clientHeight,
          portScroll: document.querySelector('.armoury-right').scrollHeight,
        }; })())`));
      console.log(`      ${shelf.faces} card(s) · ${shelf.grips} grip(s) · grip ${shelf.g0 ? shelf.g0.w + 'x' + shelf.g0.h : '(none)'}`
        + ` · tap floor ${shelf.floor} · data-hold-ms ${shelf.holdMs}`);
      console.log(`      INK, the cost of his ruling, off the laid-out page: card list ${shelf.listH} px,`
        + ` picker ${shelf.pickerH} px, and the box it opens in shows ${shelf.portH} of ${shelf.portScroll} px.`);

      ok(shelf.faces > 0 && shelf.paired === shelf.faces,
        (shelf.faces > 0 && shelf.paired === shelf.faces)
          ? `A6 every card has its own grip immediately after it (${shelf.paired}/${shelf.faces})`
          : red('A6.nogrip', `${shelf.faces - shelf.paired} card(s) of ${shelf.faces} have no grip immediately after them`));
      // THE V2 DIRECTION, AND IT IS THE ARRANGEMENT THIS ONE WAS CHOSEN OVER.
      // A grip parked inside the revealed pane exists in the DOM and measures
      // 0x0 while the list is folded — no pointer can reach it, so the hold is
      // only performable AFTER the click it exists to save. Its own code.
      ok(shelf.grips > 0 && shelf.boxed === shelf.grips,
        (shelf.grips > 0 && shelf.boxed === shelf.grips)
          ? `A6 every grip has a box while the list is folded (${shelf.boxed}/${shelf.grips})`
          : red('A6.unreachable', `${shelf.grips - shelf.boxed} grip(s) of ${shelf.grips} have no box while folded`
            + ' — the hold is unreachable until the card is already open'));
      ok(shelf.holdMs > 0, shelf.holdMs > 0
        ? `A6 the grip publishes an armed hold (data-hold-ms=${shelf.holdMs}, the player's own dial)`
        : red('A6.unarmed', `the grip publishes data-hold-ms=${shelf.holdMs} — nothing is armed on it`));
      ok(shelf.short === 0, shelf.short === 0
        ? `A6 every grip meets the tap floor (${shelf.floor} px)`
        : red('A6.thumb', `${shelf.short} grip(s) are shorter than the tap floor (${shelf.floor} px)`
          + ' — a hold target a thumb misses is a control that does not exist'));
      // HIS WHOLE RULING IN ONE ASSERTION: the card is NOT the hold element.
      ok(shelf.armedFaces === 0, shelf.armedFaces === 0
        ? 'A6 no card face is armed — the two gestures do not share an element'
        : red('A6.face', `${shelf.armedFaces} card face(s) carry an armed hold — one element, both gestures, which is what rule 1 forbids`));

      // ---- THE FINGER ------------------------------------------------
      const aim = async () => JSON.parse(await ev(`JSON.stringify((() => {
        const g = document.querySelector('.equip-picker .ep-list .ep-hold');
        if (!g) return null;
        g.scrollIntoView({ block: 'center' });
        const r = g.getBoundingClientRect();
        const x = r.x + r.width / 2; const y = r.y + r.height / 2;
        const e = document.elementFromPoint(x, y);
        return { x, y, onTop: !!(e && e.closest && e.closest('.ep-hold')),
          top: e ? e.tagName : null }; })())`));
      // WHAT IS IN THE SLOT, the product-level signal, read off the page. The
      // completed hold rebuilds this whole subtree, so a probe that watched a
      // face's own dataset would be reading a node that no longer exists.
      const slotSay = async () => ev(`(() => { const c = document.querySelector('.armoury-overlay .equip-slot .es-cell:not(.locked)')
        || document.querySelector('.armoury-overlay .equip-slot .es-cell'); return c ? c.textContent.trim() : '(no slot)'; })()`);
      const down = async (x, y) => (touch
        ? cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(x), y: Math.round(y) }] }, S)
        : cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, buttons: 1 }, S));
      const up = async (x, y) => (touch
        ? cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }, S)
        : cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1, buttons: 0 }, S));
      const watch = async () => ev(`(() => { window.__a6 = [];
        for (const t of ['pointerdown', 'click']) document.addEventListener(t, (e) => window.__a6.push({ t,
          grip: !!(e.target.closest && e.target.closest('.ep-hold')),
          ctrl: !!(e.target.closest && e.target.closest('button')),
          tag: (e.target.tagName || '') + '.' + (typeof e.target.className === 'string' ? e.target.className.slice(0, 34) : 'svg') }), true);
        return 'ok'; })()`);

      await wait(250);
      let a = await aim();
      await watch();
      if (!a || !a.onTop) {
        console.log(`    ${red('A6.finger', `${way}: the grip is not the topmost element at its own centre`
          + ` (found ${a ? a.top : 'nothing'}) — no press can be aimed at it, so nothing below is measured`)}`);
        fails++; checks++; continue;
      }

      // 1 · THE EARLY RELEASE IS THE ABORT. Press, lift well inside the dial.
      const before = await slotSay();
      const foldedBefore = await ev(`document.querySelector('.equip-picker .disc-face').getAttribute('aria-expanded')`);
      await down(a.x, a.y); await wait(150); await up(a.x, a.y); await wait(450);
      const abort = JSON.parse(await ev(`JSON.stringify({ hits: window.__a6,
        expanded: (document.querySelector('.equip-picker .disc-face') || {}).getAttribute
          ? document.querySelector('.equip-picker .disc-face').getAttribute('aria-expanded') : null })`));
      const landed = abort.hits.some((h) => h.t === 'pointerdown' && h.grip);
      console.log(`      abort (${way}, 150 ms of a ${shelf.holdMs} ms dial): landed on grip ${landed}`
        + ` · slot "${before}" → "${await slotSay()}" · card expanded ${foldedBefore} → ${abort.expanded}`);
      ok(landed, landed ? `A6 the ${way} press landed on the grip (pointerdown recorded on it)`
        : red('A6.finger', `${way}: the press at the grip's own centre did not reach it`));
      ok((await slotSay()) === before, (await slotSay()) === before
        ? `A6 an aborted ${way} hold changed nothing in the slot ("${before}")`
        : red('A6.acted', `an aborted ${way} hold changed the slot: "${before}" → "${await slotSay()}"`));
      // RULE 1, MEASURED RATHER THAN CONSTRUCTED. The early release generates a
      // click; that click must die on the grip and must NOT reach the card's
      // unfold path. A grip that also unfolds is exactly the second door.
      ok(abort.expanded === foldedBefore, abort.expanded === foldedBefore
        ? `A6 an aborted ${way} hold did NOT unfold the card — rule 1's click died on the grip`
        : red('A6.leak', `an aborted ${way} hold unfolded the card (aria-expanded ${foldedBefore} → ${abort.expanded})`
          + ' — the abort became a second door'));

      // 2 · THE COMPLETED HOLD EQUIPS, and the lift afterwards does nothing.
      await ev('window.__a6 = []');
      a = await aim(); await wait(200);
      const was = await slotSay();
      await down(a.x, a.y);
      await wait(shelf.holdMs + 300);
      const atFull = await slotSay();
      await ev('window.__a6 = []');
      await up(a.x, a.y); await wait(400);
      const tail = JSON.parse(await ev('JSON.stringify(window.__a6)'));
      console.log(`      hold (${way}, ${shelf.holdMs + 300} ms): slot "${was}" → "${atFull}" at full · after the lift ${JSON.stringify(tail)}`);
      ok(atFull !== was, atFull !== was
        ? `A6 a completed ${way} hold changed the slot at full: "${was}" → "${atFull}"`
        : red('A6.equips', `a completed ${way} hold left the slot at "${was}" — the hold did not equip`));
      // THE LIFT AFTER THE COMMIT. armHold fires AT FULL and the screen redraws
      // under the finger, so the click the lift generates lands on whatever now
      // occupies that pixel — rule 1's own swallow lives on an element that no
      // longer exists. Measured at 1200x730 touch before the fix: the release
      // hit `BUTTON.es-cell` and re-opened a picker nobody asked for.
      const woke = tail.filter((h) => h.t === 'click' && h.ctrl);
      ok(woke.length === 0, woke.length === 0
        ? `A6 the ${way} lift after a completed hold activated nothing else`
        : red('A6.tail', `the ${way} lift after a completed hold activated ${woke.length} other control(s): `
          + woke.map((h) => h.tag).join(' · ')));

      // 3 · THE IN-CARD BUTTON IS STILL A DOOR. His ruling must not make the
      // hold the only road: a plain click on the revealed control still equips.
      // A DOM click on purpose — this is the keyboard/pad/assistive road, and
      // the question here is whether the ACT still happens, not whether a
      // finger can reach it (A2/A3 already own the geometry of the card).
      if (!await openBoard()) {
        console.log(`    ${red('A6.button', `${way}: the board would not re-open for the in-card control check`)}`);
        fails++; checks++; continue;
      }
      await wait(300);
      const btnRow = JSON.parse(await ev(`JSON.stringify((() => {
        const f = document.querySelector('.equip-picker .ep-list .disc-face');
        if (!f) return { none: true };
        if (f.getAttribute('aria-expanded') !== 'true') f.click();
        const b = document.querySelector('.equip-picker .disc-reveal .ep-equip');
        return { none: !b, text: b ? b.textContent.trim() : null, locked: b ? b.classList.contains('locked') : null }; })())`));
      await wait(300);
      if (btnRow.none) {
        console.log(`    ${red('A6.button', `${way}: no in-card equip control to press — the grip would be the only road`)}`);
        fails++; checks++;
      } else {
        const b4 = await slotSay();
        await ev(`document.querySelector('.equip-picker .disc-reveal .ep-equip').click()`);
        await wait(450);
        const b5 = await slotSay();
        console.log(`      in-card control "${btnRow.text}" (locked ${btnRow.locked}): slot "${b4}" → "${b5}"`);
        ok(b5 !== b4, b5 !== b4
          ? `A6 the in-card control still equips on a plain click ("${b4}" → "${b5}") — the hold is not the only road`
          : red('A6.button', `the in-card control "${btnRow.text}" left the slot at "${b4}" — the hold is the ONLY road to equipping`));
      }
    }
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 }, S);

  // ONE HARNESS-DEATH HANDLER FOR THE WHOLE DRIVEN RUN, and this catch used to
  // sit two hundred lines up. Saga measured the half I left open (ea2cf89 →
  // 4d18b23): I named the structural cause and closed ONE of three `until`
  // calls. The other two — waiting for the map, waiting for its overlay — still
  // threw into the void and exited 1, the code line 41 reserves for A FINDING.
  // The fix is not three fixes: A SECOND REGION WITH A DIFFERENT EXIT CONTRACT
  // WAS THE DEFECT. There is now one, so no `until` added below can be born
  // outside it. The one timeout that IS a finding says so at its own call site
  // (`mapHasCard`, which catches into a boolean and reaches `A4.nocard`).
  } catch (e) {
    console.error(`    HARNESS could not run: ${e.message}`);
    cdp.close(); await dropBrowser(); if (s.server) s.server.close();
    process.exit(2);
  }

  cdp.close(); await dropBrowser(); if (s.server) s.server.close();
  console.log(`\n  ${checks} checks, ${fails} finding(s)`);
  console.log('  BOUNDARY: one container, one headless Chromium, ONE shape (1200x730). A1 is a model-door');
  console.log('  check and is shape- and mount-free. A2/A3 drive ?shot=combat (the IN-COMBAT mount, where');
  console.log('  canEquip seals every act); A4/A5 drive ?shot=map (where it does not). The fold checks are');
  console.log('  DOM clicks, not synthetic pointer presses, and they prove the handler wiring only. A6 is');
  console.log('  the opposite road and the reason it exists: REAL CDP input, mouse AND touch, aimed at the');
  console.log('  grip\'s own centre with an elementFromPoint and a recorded pointerdown either side of it,');
  console.log('  so a press that misses is A6.finger and never a quiet pass. Still ONE shape (1200x730):');
  console.log('  the phone shape 390x844 was driven by hand during the build (--ui-zoom 0.9, raw rect px');
  console.log('  land, rect x zoom do NOT) and is not in this run. Keyboard and pad are NOT driven here —');
  console.log('  armPress serves them (ui/gesture.js, S7), tools/holdconfirm.mjs is where that is watched.');
  process.exit(fails ? 1 : 0);
}

await main();
