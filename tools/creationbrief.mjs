#!/usr/bin/env node
// tools/creationbrief.mjs — D26's short form, observed on glass.
//
// Constantine, 2026-08-15: "the statte descriptions kind of suck. perhaps have
// a simplifed verison with just the starting stats, starting armaments
// selection , and then have the ability to expand by clicking, with tool tips.
// for character creation I mean"
//
// WHAT THIS ASKS, and it is one question in seven parts (seven since
// 2026-08-16, when Constantine found on the shipped build the thing none of
// the other six ask — see 7):
//   1. IS THE ARRIVAL SHORT — every entry the CONTENT TABLES call face-tier is
//      drawn, every entry they call reveal-tier is NOT, no reveal is open, and
//      no face carries prose (a face's text must be exactly its own label and
//      its own number — anything else is the paragraph coming back).
//   2. DOES A TAP EXPAND — clicking a face opens ITS reveal, the reveal says
//      that entry's authored sentence, and tapping again closes it.
//   3. IS THE KNOB LIVE — the expander shows exactly the entries the table put
//      behind it, and its count is the table's count. THIS IS THE ONE THAT
//      MATTERS: a screen with a hard-coded list of "simple" stats passes 1 and
//      2 and fails here, which is why the first plant below is exactly that.
//   4. CAN A THUMB HIT IT — every face and every armament tile at or above the
//      44 device px floor, measured on the rendered rect (Law 4 clause 4).
//   5. DOES IT SCROLL SIDEWAYS — horizontal travel per SCROLL CONTAINER on the
//      creation screen is ZERO at 390x844 (Law 5 clause 1, measured per
//      container because a document-level reading is 0 by construction here).
//   6. IS THE PICKER FOLDED, AND DOES IT STILL SAY WHAT IS CHOSEN — added
//      2026-08-16 (Sunna) for MR-151, Constantine's "go ahead and allow the
//      fold", narrowed to three rows the same day by MR-171 (KEEPSAKE came back
//      out) and to ONE — TINT — by MR-189 (SIGIL and SPRITE came out after it;
//      see the roster below). That row folds by the SAME affordance: on arrival
//      it is a face and nothing else, its panel shut and its options
//      OFF THE GLASS (counted as CLIENT RECTS, not as an attribute — a
//      predicate about the DOM is not a claim about ink, which is Vira's
//      2026-08-15 finding against an instrument of mine); the face carries THE
//      CURRENT CHOICE IN PLAYER WORDS — ITS LABEL AND ITS VALUE, each a rect
//      WITH AREA, on arrival, and the value again AFTER THE PICK. Every clause
//      of that sentence has now been caught lying, in three findings one commit
//      apart in one file. MR-237: the value was read as `textContent` alone, so
//      a stylesheet could delete the only name of the chosen colour from the
//      screen and this tool still printed it. MR-260, twelve lines below the
//      line that fixed it: the post-pick half kept the `textContent` read after
//      the arrival half moved, and the fixed arrival half counted BOXES, so
//      `font-size: 0` — a box of no size — printed PASS on a blank face. MR-260
//      again, one plant later and mine to have found: the LABEL was never
//      measured at all, and a face reading `Goldbough gold` with no word for
//      what it is OF passed everything here. A RECT IS NOT INK EITHER; the run's
//      own BOUNDARY says what this measure still cannot see, and that paragraph
//      is now written from the predicate rather than around it. A tap opens the
//      row, its options land ON THE GLASS WITH AREA, and picking inside it
//      MOVES THE FACE'S VALUE. Both edges: the named row folds, and NO OTHER
//      row of `.cz-fields` does — folding CLASS, STARTING KIT or KEEPSAKE would
//      hide the choosing behind a choice, and folding SIGIL or SPRITE would buy
//      nothing in words at the price of a tap. Both are red here.
//   7. DOES THE PANEL OPEN UNDER THE FACE THAT WAS TAPPED — added 2026-08-16
//      (MR-287) for the defect CONSTANTINE FOUND HIMSELF, on the build, at
//      334fd02: "in character creation, I would slect an item and instead of
//      expanding under the ubtton it shows up at hte bottom for all of them as
//      if I expanded the bottom button". NOT A FALSE GREEN — AN UNASKED
//      QUESTION, and that is the whole reason it is written down. Every other
//      measure in this file is a y-coordinate or a client rect and NOT ONE of
//      them asks WHERE the panel opened: shut on arrival, the face names the
//      value, the options come on the glass with area — a panel that opens at
//      the bottom of the screen satisfies every one of them. THE CODE IS ALSO
//      CORRECT: disclosure.js builds `.disc-faces` and ONE `.disc-reveal` as
//      its next sibling, and ui.css says "ONE panel, under the row" three
//      lines above `.disc-faces { flex-wrap: wrap }`, so a face on the first
//      of two wrapped rows gets its panel below BOTH. It is a specification
//      the player disagrees with, and nobody would have found it by reading
//      the code (Marina, MR-287). SCOPE — her conditional, and she calls it
//      that rather than a cap: THIS FAILS ONLY FOR THE ROWS IN `FOLDED`. The
//      rest of the screen is measured by the same predicate and REPORTED
//      beside it, ungated, because it carried this at 334fd02 before the fold
//      existed and a lane that inherits a defect is not the lane that owes it.
//      No baseline constant is needed for that conditional and none is typed:
//      the fold's entire contribution to this screen IS the FOLDED roster, so
//      *no folded row is adrift* is exactly *the fold made this no worse*.
//
// DOOR — stated here and printed in the run's own output (the instrument
// rule's same-door clause, commons/development.md). THE EXPECTATION and THE
// OBSERVATION enter by two different real roads and are compared:
//   expectation  the content tables under --root are IMPORTED the way the game
//                imports them (src/content/index.js -> createRegistries ->
//                createRunState -> creationBrief). A bad row is refused here by
//                the real content door, by name, exactly as at boot.
//   observation  the app is SERVED over http and booted in headless Chromium
//                at ?shot=customize — the real index.html, the real module
//                graph, the real stylesheet, the real mount — and the faces are
//                CLICKED, not simulated. Nothing is handed to a function.
// --selftest plants each known-bad as FILE BYTES in a disposable copy of this
// tree and re-runs this whole tool at --root COPY, so every plant travels both
// roads.
//
// Usage
//   node tools/creationbrief.mjs                 the whole sweep
//   node tools/creationbrief.mjs --selftest      the re-runnable known-bad
//   node tools/creationbrief.mjs --root DIR      another checkout (planted)
//   node tools/creationbrief.mjs --only 390x844
// Exit: 0 green · 1 a finding · 2 usage / no browser / NOTHING RAN
//
// BOUNDARY, printed on every run including the clean ones: headless Chromium on
// Linux, the SOURCE tree over http (not the dist bundle), the shapes listed
// below, Text size and UI size at their defaults, one class per shape. It says
// nothing about a real finger, about Windows, about the receipts panel below
// the short form, or about whether the sentences are GOOD — only that they are
// short, they are the table's own, and they are one tap away.
//
// REMOVAL CONDITION (SOP 1's corollary): deleted the day the creation screen
// stops having two tiers of disclosure.

import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TOOLS = resolve(fileURLToPath(new URL('.', import.meta.url)));
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const ROOT = resolve(argOf('--root') || resolve(TOOLS, '..'));
const only = argOf('--only');
const SHAPES = [[390, 844], [1200, 730]];
const BROWSERS = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const browserPath = argOf('--browser') || BROWSERS.find((p) => existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// THE FOLDED ROSTER (MR-151, narrowed to three by MR-171 and to ONE by MR-189).
// This is a CONTRACT, so it is written down rather than derived: Constantine
// allowed the fold, Marina scoped it, and a roster read off the screen would
// move with the screen and assert nothing. It is checked in BOTH directions — a
// named row that stopped folding is red, and a row that started folding without
// being named is red.
//
// FIVE ROWS ARE DELIBERATELY ABSENT AND THAT ABSENCE IS ENFORCED, for two
// different reasons, and the reasons are the point (Marina, MR-189: *a roster is
// not a decision, it is four decisions wearing one name* — a count of options is
// not a count of legibility):
//   CLASS, STARTING KIT, KEEPSAKE  they are what the arrival screen is FOR.
//     KEEPSAKE was on this list for one commit and MR-170 found the roster wider
//     than its own stated reason: it is the only one of the four that changes the
//     run, and folding it took the only place on the screen where the game says
//     what a keepsake DOES.
//   SIGIL, SPRITE  their faces buy NOTHING IN WORDS. SIGIL's face value is
//     `state.glyph` — the emoji again, on the one row a player picks by look.
//     SPRITE's three chips already read Rendered / Classic / Sigil, so the face
//     repeats one of them and takes more vertical than it saves.
//
// TINT IS THE ONE THAT STAYS, and it is not the leftover — it is the only row
// whose face says something its options cannot. Five unlabelled swatches; the
// only thing that ever named one is `attachTooltip`, which answers hover and
// pad-focus and never a thumb (customize.js, on the swatch itself). Unfolded,
// TINT on a phone is five untitled colour blobs; folded, the row arrives reading
// `TINT Goldbough gold`, in words, on the glass.
//
// THIS ARRAY IS THE SECOND HALF OF THE REFOLD, and it is what makes his veto
// cheap: put any `pick:*` back in customize.js without putting it back here and
// the row below goes red BY NAME, in both directions.
// ---------------------------------------------------------------------------
const FOLDED = [
  { key: 'pick:tint', label: 'TINT', options: '.cz-opt' },
];

// ONE HOME FOR THE MEASURE (MR-260). This string is interpolated into BOTH
// in-page reads below — the arrival read and the post-pick probe — because the
// defect it repairs was two homes: the arrival half was moved to rects on
// 2026-08-16 and the post-pick half, twelve lines away, kept reading
// `textContent`, so one sentence's two halves disagreed about what "on the
// glass" meant while both printed PASS.
//
// A BOX IS NOT AN AREA, and this is the correction Vira's plants forced.
// `getClientRects().length > 0` counts BOXES: an inline span at `font-size: 0`,
// an element at `transform: scale(0)`, and `position:absolute; width:0;
// height:0; overflow:hidden` all still HAVE a box — three ordinary stylesheet
// edits that take the name of the chosen colour off the screen and printed
// `PASS ... ON THE GLASS` at 5fc7a17, watched by hand through the CSS door.
// So the measure asks the rects for their SIZE, which is the thing they carry
// and the thing the old predicate threw away. It is not a wider claim than
// rects support — see the boundary, which still names what ink this cannot see.
const ON_GLASS = `const onGlass = (el) => !!el
      && [...el.getClientRects()].some((r) => r.width > 0 && r.height > 0);`;

// THE ANCHOR (MR-287) — ONE MEASUREMENT, and it is the one nobody asked.
// Constantine found this on the build at 334fd02 himself; the header's part 7
// says why it was invisible to every other line in this file and why the code
// is correct. This is the predicate.
//
// A PANEL IS UNDER ITS OWN FACE IF THE SPACE BETWEEN THEM IS NO MORE THAN THE
// SPACE THIS LAYOUT PUTS BETWEEN TWO OF ITS OWN ROWS. That reference length is
// READ — `getComputedStyle(.disc-faces).rowGap`, the stylesheet's own number,
// plus ONE PIXEL for subpixel rounding (the anchored gap measures 5.39 px
// against a 6 px row-gap at 390x844). A typed tolerance here would be the
// second copy this house exists to catch, and one read off the layout moves
// when the layout moves. The separation is not marginal: anchored reads 5-6 px
// at both shapes, adrift reads 55, 104 and 154 px.
//
// WHY NOT "no other face lies between them", which is the sentence a player
// would say: because it is silent on a one-face host. `.cz-fields` holds
// exactly one folded row, so a stylesheet that pinned the panel to the bottom
// of the viewport would have no face to put between and would pass. The gap
// against the layout's own row-gap catches that, the wrapped-row case, and a
// panel that opens ABOVE its face. The intervening faces are still NAMED in
// the output, because that is the sentence that tells a reader what went
// wrong; they are not what the predicate turns on.
//
// WHAT PASSING LICENSES, stated before it ships (identity card): the panel
// BEGINS within one row-gap below the face that was tapped. It licenses
// nothing about the panel's height, nothing about whether either is in the
// viewport, and nothing about scroll — a panel correctly anchored to a face
// 900 px down the page is still a panel a player must scroll to find, and that
// is MR-172's debt, not this measure's claim.
const ANCHOR_READ = `(() => {
    const out = [];
    for (const host of document.querySelectorAll('.cz-disc')) {
      const box = host.querySelector('.disc-faces');
      const panel = host.querySelector('.disc-reveal');
      if (!box || !panel) continue;
      // \`.disc-more\` is excluded and it is not a convenience: it is not an
      // entry, it has no panel, and clicking it toggles the expander — which
      // would leave the screen in a different state than the run measured.
      const faces = [...box.children].filter((el) => el.classList.contains('disc-face')
        && !el.classList.contains('disc-more'));
      const tol = parseFloat(getComputedStyle(box).rowGap) || 0;
      for (const face of faces) {
        face.click();
        const open = !panel.hidden && panel.getClientRects().length > 0;
        const f = face.getBoundingClientRect();
        const p = panel.getBoundingClientRect();
        const gap = p.top - f.bottom;
        const between = open ? faces.filter((el) => el !== face).filter((el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > f.bottom + 0.5 && r.top < p.top - 0.5;
        }).map((el) => el.dataset.face) : [];
        out.push({
          key: face.dataset.face || '(unkeyed)',
          open,
          gap: Math.round(gap * 100) / 100,
          tol,
          anchored: open && gap >= -0.5 && gap <= tol + 1,
          between,
        });
        face.click(); // put the screen back the way this pass found it
      }
    }
    return out;
  })()`;

// THE ARRIVAL READ for that row. It is a constant so it can be run
// BEFORE any click lands on this screen — "on arrival" is the whole claim, and
// a reading taken after three taps is a reading of something else.
const FOLD_READ = `(() => {
    const roster = ${JSON.stringify(FOLDED)};
    ${ON_GLASS}
    const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const fields = document.querySelector('.cz-fields');
    const all = [...fields.querySelectorAll('.disc-face')].map((el) => el.dataset.face);
    return {
      drawn: all,
      rows: roster.map((row) => {
        const face = fields.querySelector('[data-face=' + JSON.stringify(row.key) + ']');
        if (!face) return { key: row.key, missing: true };
        const host = face.closest('.cz-disc');
        const panel = host && host.querySelector('.disc-reveal');
        const opts = panel ? [...panel.querySelectorAll(row.options)] : [];
        const chosen = opts.find((el) => el.classList.contains('chosen'));
        const r = face.getBoundingClientRect();
        const valueEl = face.querySelector('.disc-value');
        return {
          key: row.key,
          label: norm(face.querySelector('.disc-name') && face.querySelector('.disc-name').textContent),
          value: norm(valueEl && valueEl.textContent),
          // THE FACE VALUE MEASURED AS INK, not as DOM (MR-237, Vira's finding
          // 2026-08-16). The face value is the entire purchase of the fold and
          // was read with textContent and nothing else, so a stylesheet could
          // take the only name of the chosen colour off the screen and this row
          // still printed TINT Goldbough gold. Measured with SIZE since MR-260,
          // by the shared predicate above. (No backticks in this block: it
          // lives inside a template literal that is evaluated in the page.)
          valueOnGlass: onGlass(valueEl),
          // AND THE LABEL, by the same measure and for the same reason. The
          // comment on the assertion below has said "a face is a label AND a
          // value" since the fold landed, and only the value was ever measured
          // as ink. Found by my own hand at MR-260, one plant after the one I
          // was sent to fix: font-size:0 on .disc-name takes the word TINT off
          // every face on this screen and the whole sweep printed exit 0.
          labelOnGlass: onGlass(face.querySelector('.disc-name')),
          expanded: face.getAttribute('aria-expanded'),
          hiddenPanel: !!(panel && panel.hidden),
          options: opts.length,
          // PRESENCE IS AREA, ABSENCE IS BOXES, and the asymmetry is deliberate
          // (MR-260). The count here feeds SHUT-on-arrival, which asserts the
          // options are NOT on the screen: counting BOXES is the stronger test
          // of that, because a zero-area option still raises the count and still
          // goes red. The same count measured as area would quietly forgive an
          // open panel whose options had been scaled to nothing. Where the
          // sentence asserts something IS on the screen — the face value here,
          // the options after the tap below — the measure is area.
          onGlass: opts.filter((el) => el.getClientRects().length > 0).length,
          chosenText: chosen ? norm((chosen.title || '') + ' ' + chosen.textContent) : '',
          w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100,
        };
      }),
    };
  })()`;

// ---------------------------------------------------------------------------
// THE EXPECTATION — the content tables, through the real content door.
// ---------------------------------------------------------------------------
async function expectation(root) {
  const url = (rel) => pathToFileURL(resolve(root, rel)).href;
  const { contentBundle } = await import(url('src/content/index.js'));
  const { createRegistries } = await import(url('src/model/registries.js'));
  const { createRunState } = await import(url('src/model/state.js'));
  const { creationBrief } = await import(url('src/model/creationBrief.js'));
  const registries = createRegistries(contentBundle);
  // The screen arrives on its first class with the baseline kit — the same
  // state ?shot=customize mounts.
  const run = createRunState({ seed: 0, classId: registries.classes.all()[0].id, registries });
  const brief = creationBrief(registries, run);
  // The floor is READ, never typed: balance.ui.tapSize.def is the one home of
  // the number (styles/base.css deliberately carries no fallback copy of it),
  // and a 44 typed here would be the second copy this house exists to catch.
  const floor = registries.balance.ui.tapSize.def;
  const text = (entry) => `${entry.face.label}${entry.face.value === '' || entry.face.value == null ? '' : entry.face.value}`;
  return {
    floor,
    classId: brief.classId,
    faces: brief.faces.map((entry) => ({ key: entry.key, text: text(entry), sense: entry.reveal.sense })),
    behind: brief.reveals.map((entry) => ({ key: entry.key, text: text(entry), sense: entry.reveal.sense })),
    armaments: brief.armaments.map((entry) => ({ key: entry.key, text: text(entry), sense: entry.reveal.sense })),
    relicName: (brief.armaments.find((entry) => entry.kind === 'relic') || { face: {} }).face.value || '',
  };
}

// ---------------------------------------------------------------------------
// CDP plumbing (same shape as tools/inspecthold.mjs — one ws, no dependencies).
// ---------------------------------------------------------------------------
function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl); let nextId = 1; const pending = new Map(); const handlers = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      if (m.error) rej(new Error(m.error.message)); else res(m.result);
    } else if (m.method && handlers.has(m.method)) handlers.get(m.method)(m.params, m.sessionId);
  });
  return {
    ready: new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); }),
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => { pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
    },
    on(method, fn) { handlers.set(method, fn); },
    close: () => ws.close(),
  };
}

function launchChrome(browser, dir) {
  return new Promise((res, rej) => {
    const child = spawn(browser, ['--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
      `--user-data-dir=${dir}`, '--no-first-run', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    const on = (d) => { err += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(err); if (m) res({ child, wsUrl: m[1] }); };
    child.stderr.on('data', on); child.stdout.on('data', on); child.on('error', rej);
    setTimeout(() => rej(new Error(`no DevTools endpoint:\n${err.slice(-300)}`)), 12000);
  });
}

// ---------------------------------------------------------------------------
// THE KNOWN-BAD CORPUS. Every plant is a REAL DEFECT of the class this check
// exists to catch, written as the tree spells the line today.
// ---------------------------------------------------------------------------
const PLANTS = [
  {
    name: 'P1 the knob ignored',
    file: 'src/ui/components/disclosure.js',
    from: "  const faces = rows.filter((entry) => entry.disclosure === 'face');",
    to: '  const faces = rows.slice(); // planted: the screen stops reading the tier and draws everything',
    what: "the screen draws every entry regardless of the table's `disclosure`",
    expect: 'a reveal-tier entry is on the arrival screen — the short form is not short',
    mustRed: (out) => /FAIL the arrival screen holds no reveal-tier entry/.test(out),
    mustStay: (out) => /PASS every face-tier entry is drawn/.test(out),
  },
  {
    name: 'P2 an illegal tier in the content table',
    file: 'src/content/attributes.js',
    from: "{ id: 'strength', label: 'Strength', shortLabel: 'STR', order: 1, disclosure: 'face'",
    to: "{ id: 'strength', label: 'Strength', shortLabel: 'STR', order: 1, disclosure: 'faec'",
    what: 'one attribute row is authored into a tier that does not exist',
    expect: 'the content door refuses it BY NAME, with the typo in the message',
    mustRed: (out) => /faec/.test(out) && /content door refused/.test(out),
    mustStay: () => true,
  },
  {
    name: 'P3 the tap floor removed',
    file: 'styles/ui.css',
    from: '  min-height: var(--tap-floor); min-width: var(--tap-floor); height: auto;\n  width: auto; max-width: 100%;',
    to: '  min-height: 0; min-width: 0; height: auto;\n  width: auto; max-width: 100%; /* planted: no floor */',
    what: 'the faces lose their 44 px floor and shrink to their glyphs',
    expect: 'a face measures under the floor on glass',
    mustRed: (out) => /FAIL every face and armament tile clears the/.test(out),
    mustStay: (out) => /PASS a tap opens that entry's reveal/.test(out),
  },
  {
    name: 'P4 the row stops wrapping',
    file: 'styles/ui.css',
    from: '.disc-faces { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: stretch; }',
    to: '.disc-faces { display: flex; flex-wrap: nowrap; gap: 0.6rem; align-items: stretch; overflow-x: auto; } /* planted: a phone that scrolls sideways */',
    what: 'the faces run off the side of a 390 px phone instead of wrapping',
    expect: 'horizontal travel on a scroll container is not zero (Law 5)',
    mustRed: (out) => /FAIL horizontal travel is ZERO/.test(out),
    mustStay: (out) => /PASS every face-tier entry is drawn/.test(out),
  },
  {
    name: 'P5 the tap does nothing',
    file: 'src/ui/components/disclosure.js',
    from: '      if (openKey === entry.key) close(); else open(entry.key);',
    to: '      /* planted: the tap is swallowed — the tips are hover-only again */',
    what: 'clicking a face no longer opens its reveal (the hover-only disease)',
    expect: 'a finger gets nothing at 390',
    mustRed: (out) => /FAIL a tap opens that entry's reveal/.test(out),
    mustStay: (out) => /PASS the arrival screen holds no reveal-tier entry/.test(out),
  },
  // --- MR-151's four, added 2026-08-16 with the fold itself. Each is a way
  // the fold can be shipped WRONG rather than absent, which is the class this
  // house keeps missing: a screen that renders, passes every old check, and
  // answers the wrong question.
  {
    name: 'P6 the fold defaults OPEN',
    file: 'src/ui/components/disclosure.js',
    // RE-AIMED 2026-08-16 (Sunna, MR-287) — and the re-aim is the whole of the
    // edit: the contract line moved when the panel became a ROW of
    // `.disc-faces` instead of its next sibling, so the old `from` string no
    // longer existed in the file. The selftest called it — HARD RED, P6 found
    // no home — which is that clause doing exactly its job on the first source
    // change after it was written. Same plant, same `hidden` removed, same
    // sentence red; only the line it is aimed at is new.
    from: '  host.innerHTML = `<div class="disc-faces"><div class="disc-reveal" hidden></div></div>`;',
    to: '  host.innerHTML = `<div class="disc-faces"><div class="disc-reveal"></div></div>`; // planted: available, not applied',
    what: 'the panel is built without `hidden`, so every picker arrives unfolded',
    expect: 'the arrival screen is as long as the one he called bad — the reading Marina killed',
    mustRed: (out) => /FAIL every folded picker is SHUT on arrival/.test(out),
    mustStay: (out) => /PASS every picker MR-151 named is folded/.test(out),
  },
  {
    name: 'P7 the folded row stops naming the choice',
    file: 'src/ui/screens/customize.js',
    from: '      face: { label: row.label, value: row.value() },',
    to: '      face: { label: row.label, value: \'\' }, // planted: a face with no value',
    what: 'the folded face carries its label and nothing else',
    expect: 'a folded picker no longer says what is currently chosen — on TINT that is the whole reason it folds',
    mustRed: (out) => /FAIL each folded row names what is currently chosen/.test(out),
    mustStay: (out) => /PASS every folded picker is SHUT on arrival/.test(out),
  },
  {
    name: 'P8 the named picker never folded',
    file: 'src/ui/screens/customize.js',
    from: `    { key: 'pick:tint', label: 'TINT', box: tintBox, tip: 'Tap to change your colour.',
      value: () => (PORTRAIT_TINTS.find((t) => t.id === state.tint) || {}).name || '—' },`,
    to: '    // planted: the extension missed the only one',
    what: 'TINT keeps its old open row — five untitled colour blobs and no name on the glass',
    expect: 'the roster MR-189 named is not the roster on the glass, BY NAME',
    mustRed: (out) => /FAIL every picker MR-151 named is folded.*pick:tint/.test(out),
    mustStay: (out) => /PASS no other row of \.cz-fields is folded/.test(out),
  },
  {
    name: 'P9 a picker folded that must not be',
    file: 'src/ui/screens/customize.js',
    from: '  const FOLDED = [\n    { key: \'pick:tint\'',
    to: '  const FOLDED = [\n    { key: \'pick:class\', label: \'CLASS\', box: classes, tip: \'x\', value: () => state.classId }, // planted: the choosing hidden behind a choice\n    { key: \'pick:tint\'',
    what: 'CLASS folds too — the one row the arrival screen exists for',
    expect: 'a row folded that MR-151 did not name, BY NAME',
    mustRed: (out) => /FAIL no other row of \.cz-fields is folded.*pick:class/.test(out),
    mustStay: (out) => /PASS every picker MR-151 named is folded/.test(out),
  },
  // --- MR-237, added 2026-08-16 with the ink fix above. THE CSS DOOR. Every
  // plant before this one enters through JS — a content table, a screen
  // component, a stylesheet rule that changes GEOMETRY (P3, P4). This is the
  // first that leaves every line of JavaScript exactly as it is and takes the
  // face value off the screen from the stylesheet alone, which is the door the
  // old predicate was blind to: `textContent` is unchanged by any of it.
  {
    name: 'P10 the face value styled off the glass',
    file: 'styles/ui.css',
    from: '.disc-face .disc-value { color: var(--parchment); font-size: 1.25rem; }',
    to: '.disc-face .disc-value { color: var(--parchment); font-size: 1.25rem; display: none; } /* planted: the name is in the DOM and nowhere on the screen */',
    what: 'the stylesheet removes the face value from layout — the DOM still says `Goldbough gold`, the screen says it nowhere',
    expect: "the folded row's value is measured as INK and found off the glass — the fold's only purchase, gone",
    mustRed: (out) => /FAIL each folded row names what is currently chosen, ON THE GLASS.*OFF THE GLASS/.test(out),
    // The geometry checks must survive: a CSS plant that also craters the tap
    // floor would make this red for a second reason and prove nothing about ink.
    mustStay: (out) => /PASS every face and armament tile clears the/.test(out)
      && /PASS every folded picker is SHUT on arrival/.test(out),
  },
  // --- MR-260, added 2026-08-16 with the area fix above. THE CSS DOOR AGAIN,
  // and these three are the corpus Vira planted against P10's own boundary
  // paragraph rather than against the check: the paragraph named a caught-list,
  // she planted the caught-list, and three of five entries were green. They are
  // in the corpus now because a boundary sentence nobody plants is exactly the
  // thing this house has never gated (Marina, MR-260) — and because the one
  // that fails is not always the one you wrote last.
  {
    name: 'P11 the face value at font-size 0',
    file: 'styles/ui.css',
    from: '.disc-face .disc-value { color: var(--parchment); font-size: 1.25rem; }',
    to: '.disc-face .disc-value { color: var(--parchment); font-size: 0; } /* planted: a box of no size, and the name is gone */',
    what: 'the value keeps a client rect and loses all of its size — the plainest of the three zero-area edits (transform:scale(0) and width:0;height:0;overflow:hidden are the same predicate by another road, watched red by hand at this ref)',
    expect: 'the value is OFF THE GLASS for want of AREA — the case the old boundary claimed under "a zero box" and the old predicate passed, exit 0',
    mustRed: (out) => /FAIL each folded row names what is currently chosen, ON THE GLASS.*OFF THE GLASS/.test(out),
    mustStay: (out) => /PASS every face and armament tile clears the/.test(out)
      && /PASS every folded picker is SHUT on arrival/.test(out),
  },
  {
    name: 'P12 the value hidden only while the row is OPEN',
    file: 'styles/ui.css',
    from: '.disc-face[data-reveal=\'open\'] { border-color: var(--gold); }',
    to: '.disc-face[data-reveal=\'open\'] { border-color: var(--gold); }\n.disc-face[data-reveal=\'open\'] .disc-value { display: none; } /* planted: the name goes out exactly when the player is choosing */',
    what: 'the stylesheet hides the face value while the panel is open, on the selector this stylesheet already uses for the open state',
    expect: 'the ARRIVAL sentence stays green and the POST-PICK one goes red — the twelve-line gap, in one plant',
    mustRed: (out) => /FAIL picking inside the fold MOVES the face, ON THE GLASS.*OFF THE GLASS/.test(out),
    // THE OTHER EDGE IS THE POINT OF THIS PLANT: the arrival half must stay
    // GREEN. A plant that reddened both would prove nothing about the half that
    // was still reading textContent twelve lines below the half that was fixed.
    mustStay: (out) => /PASS each folded row names what is currently chosen, ON THE GLASS/.test(out)
      && /PASS a tap opens the folded picker/.test(out),
  },
  {
    name: 'P13 the options open at scale 0',
    file: 'styles/ui.css',
    from: '.disc-reveal .cz-opts { flex-wrap: wrap; row-gap: 0.8rem; }',
    to: '.disc-reveal .cz-opts { flex-wrap: wrap; row-gap: 0.8rem; }\n.disc-reveal .cz-opt { transform: scale(0); } /* planted: the tap opens five swatches of no size */',
    what: 'the tap opens the panel and every swatch inside it has a box and no area — a player taps and sees nothing appear',
    expect: 'the tap sentence goes red at 0/5 on the glass, and SHUT on arrival — which counts BOXES on purpose — stays green',
    mustRed: (out) => /FAIL a tap opens the folded picker.*0\/5 option/.test(out),
    mustStay: (out) => /PASS every folded picker is SHUT on arrival/.test(out)
      && /PASS each folded row names what is currently chosen, ON THE GLASS/.test(out),
  },
  {
    name: 'P14 the face LABEL at font-size 0',
    file: 'styles/ui.css',
    from: '.disc-face .disc-name { color: var(--muted); font-size: 1.05rem; }',
    to: '.disc-face .disc-name { color: var(--muted); font-size: 0; } /* planted: the value says Goldbough gold and nothing says TINT */',
    what: 'every face label on the creation screen loses its size — the folded row reads `Goldbough gold` with no word for what it is OF',
    expect: 'the fold row goes red on its LABEL, by the same measure as its value',
    mustRed: (out) => /FAIL each folded row names what is currently chosen, ON THE GLASS.*label 'TINT' is OFF THE GLASS/.test(out),
    // AND THE PART THIS PLANT IS ALSO EVIDENCE OF, kept as a mustStay rather
    // than smuggled into a fix: the NINE arrival faces lose their labels in the
    // same plant and every arrival sentence stays green, because that lane is
    // still measured as DOM text. Those sentences are not mine (MR-260's scope)
    // and the green below is the finding, not an oversight.
    mustStay: (out) => /PASS every face-tier entry is drawn/.test(out)
      && /PASS no face carries prose/.test(out)
      && /PASS every face and armament tile clears the/.test(out),
  },
  // --- MR-287, added 2026-08-16 with the anchor above. TWO PLANTS FOR ONE
  // MEASUREMENT, because the predicate has TWO EDGES and this house checks
  // both: the panel may drift too far BELOW its face (P15) or land ABOVE it
  // (P16). One plant would have watched one arm and left the other `unknown`.
  //
  // AND A THIRD ROAD, WATCHED BY HAND AT THIS REF AND NOT IN THE CORPUS:
  // `.cz-disc { display: flex; flex-direction: column-reverse }` puts the panel
  // above the face at -96.37 px and goes red by name. It is the same arm as
  // P16 by another road, so it earns a sentence, not a minute of runtime.
  //
  // A NOTE ON P15's SITE, because it cost me a green: the first place I aimed
  // it was a new `.disc-reveal { margin-top: 12rem }` rule appended after
  // `.disc-more`. It landed in the file, the file parsed, and the run came
  // back EXIT 0 GREEN with the gap unchanged at 5.39 px — the ORIGINAL
  // `.disc-reveal` block is 4 lines FURTHER DOWN the stylesheet, equal
  // specificity, and later wins. A plant that lands and does nothing looks
  // exactly like a check that caught nothing to catch. It is edited into the
  // existing declaration now, and the gap it produces is printed, so the
  // plant's own referent is visible in the output rather than assumed.
  //
  // RE-AIMED 2026-08-16 (Bjorn, gating this commit onto dev at 50ebb39) — SAME
  // SITE, NEW TEXT, AND THE SITE IS THE POINT. Sunna's fix DELETED
  // `margin-top: 0.6rem` from this declaration deliberately: the separation is
  // now the container's own `row-gap`, and a margin here would be a second copy
  // of that number (her comment above the rule says so). So P15's `from` string
  // stopped existing and --selftest called it — HARD RED, exit 2, `P15 found NO
  // home in styles/ui.css`. That is Vira's clause doing its job on the first
  // source change after it was written, twice in two commits now (P6 first).
  // The plant still edits the DECLARATION ITSELF, which is the half of Vira's
  // note that must not be lost to a re-aim.
  //
  // AND THE NUMBER MOVED WITH THE SITE: 108 px -> 113.39 px. It is not a
  // re-typed tolerance, it is arithmetic that changed shape. Before, the 12rem
  // REPLACED a 0.6rem margin, so the whole gap was the margin. Now the panel is
  // a row of the wrap, so the gap is the container's `row-gap` (5.39 px) PLUS
  // the planted margin (108 px). Observed, not predicted; had I kept 108 the
  // plant would still have gone red and `mustRed` would have failed it, which
  // is the corpus refusing a number nobody watched.
  {
    name: 'P15 the panel drifts away from its face',
    file: 'styles/ui.css',
    from: '  flex: 1 1 100%; width: 100%; padding: 0.8rem 1rem;',
    to: '  flex: 1 1 100%; width: 100%; margin-top: 12rem; padding: 0.8rem 1rem; /* planted: the panel opens a long way under the face that was tapped */',
    what: 'the panel keeps its place in the flow and opens 113.39 px below its face instead of 5.39 — THE SAME ARM AS THE DEFECT CONSTANTINE FOUND, whose wrapped-row gaps read 55, 104 and 154 px against a 6 px row-gap',
    expect: "the fold's panel is measured against the layout's OWN row-gap and found adrift below its face",
    mustRed: (out) => /FAIL the fold's panel opens UNDER ITS OWN FACE.*pick:tint: panel opens 113\.39 px below its face/.test(out),
    // The fold's own sentences must survive: a plant that also blanked the
    // value or craters the tap floor would make this red twice over and prove
    // nothing about WHERE the panel went.
    mustStay: (out) => /PASS each folded row names what is currently chosen, ON THE GLASS/.test(out)
      && /PASS a tap opens the folded picker/.test(out)
      && /PASS every folded picker is SHUT on arrival/.test(out)
      && /PASS every face and armament tile clears the/.test(out),
  },
  {
    name: 'P16 the panel pinned to the bottom of the screen',
    file: 'styles/ui.css',
    from: '.disc-more { border-style: dashed; }',
    to: '.disc-more { border-style: dashed; }\n.disc-reveal { position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; } /* planted: the bottom sheet — his words, as a stylesheet */',
    what: "the panel leaves the flow and sits at the bottom of the viewport — literally 'it shows up at hte bottom', as a plausible mis-fix rather than as prose",
    expect: 'the panel is measured ABOVE its own face (a negative gap) and goes red — the other arm of the predicate',
    mustRed: (out) => /FAIL the fold's panel opens UNDER ITS OWN FACE.*pick:tint: panel opens -\d+(\.\d+)? px below its face/.test(out),
    // AND THE PART THIS PLANT IS EVIDENCE OF: a bottom-sheet panel passes
    // EVERY other sentence in this tool. The greens below are the finding.
    mustStay: (out) => /PASS each folded row names what is currently chosen, ON THE GLASS/.test(out)
      && /PASS a tap opens the folded picker/.test(out)
      && /PASS a second tap folds it again/.test(out)
      && /PASS horizontal travel is ZERO/.test(out),
  },
];

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'creationbrief-kb-'));
  for (const d of ['src', 'styles', 'content', 'assets', 'tools']) {
    if (existsSync(resolve(ROOT, d))) {
      cpSync(resolve(ROOT, d), resolve(dir, d), {
        recursive: true,
        filter: (src) => !/tools[\\/](results|shots)([\\/]|$)/.test(src) && !/\.(png|py|mp3|ogg)$/.test(src),
      });
    }
  }
  cpSync(resolve(ROOT, 'index.html'), resolve(dir, 'index.html'));
  return dir;
}

function plantInto(dir, p) {
  const path = resolve(dir, p.file);
  const src = readFileSync(path, 'utf8');
  const first = src.indexOf(p.from);
  if (first < 0 || src.indexOf(p.from, first + 1) >= 0) {
    console.error(`creationbrief --selftest: ${p.name} found ${first < 0 ? 'NO' : 'MORE THAN ONE'} home in ${p.file}`);
    console.error('  A plant whose site drifted is a HARD RED, never a skip: a corpus that quietly');
    console.error('  stops matching is the eleven-instruments shape. Re-aim it at the line that');
    console.error('  carries the contract now.');
    process.exit(2);
  }
  writeFileSync(path, src.slice(0, first) + p.to + src.slice(first + p.from.length), 'utf8');
}

function runSelfAt(root) {
  return new Promise((res) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--root', root, '--only', '390x844'],
      { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...(browserPath ? { CHROME: browserPath } : {}) } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => res({ code, out }));
  });
}

async function selftest() {
  console.log('creationbrief --selftest — the re-runnable known-bad');
  console.log('  DOOR: every plant below is a FILE EDIT to a disposable copy of this tree');
  console.log(`  (root ${ROOT}) — content table, screen component, or stylesheet — judged by`);
  console.log('  re-running this whole tool at --root COPY: the tables imported through the real');
  console.log('  content door, the app served over http, booted in headless Chromium at');
  console.log('  ?shot=customize, and the faces CLICKED. Nothing is handed to a function.\n');
  let fails = 0;
  const ok = (b, what) => { if (b) console.log(`  PASS ${what}`); else { fails++; console.log(`  FAIL ${what}`); } };

  const cleanDir = sandbox();
  console.log('  control: untouched copy of this tree (no plant)');
  const clean = await runSelfAt(cleanDir);
  ok(clean.code === 0, `control: the copied tree is GREEN (exit ${clean.code}) — the plants are the only difference`);
  if (clean.code !== 0) for (const line of clean.out.split('\n').filter((l) => /FAIL|refused/.test(l))) console.log(`    control |${line}`);
  try { rmSync(cleanDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }

  for (const p of PLANTS) {
    console.log(`\n  ${p.name}: ${p.what}`);
    console.log(`    plant: ${p.file} — expect ${p.expect}`);
    const dir = sandbox();
    plantInto(dir, p);
    const r = await runSelfAt(dir);
    ok(r.code === 1, `${p.name}: the planted tree goes RED (exit ${r.code}, want 1)`);
    ok(p.mustRed(r.out), `${p.name}: red BY NAME — ${p.expect}`);
    ok(p.mustStay(r.out), `${p.name}: the untouched checks stay green (red for the RIGHT reason, not a crater)`);
    for (const line of r.out.split('\n').filter((l) => /\s*(FAIL|content door refused)/.test(l))) {
      console.log(`    red |${line.replace(/^\s+/, ' ')}`);
    }
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }
  }

  console.log(fails
    ? `\ncreationbrief --selftest: ${fails} FAIL — this instrument's red is NOT re-observed; treat its greens as unknown`
    : `\ncreationbrief --selftest: held — clean copy green, ${PLANTS.length} defects red by name, through the doors real content and real fingers use`);
  console.log('  BOUNDARY: the plants cover the tier filter, the content door, the tap floor, the');
  console.log('  wrap and the tap itself; and, since 2026-08-16, the four MR-151 ways the FOLD can');
  console.log('  ship wrong rather than absent — defaulting open, a face that stops naming the');
  console.log('  choice, the named picker never folding, and a picker folded that must not be —');
  console.log('  plus P10 (MR-237), THE CSS DOOR: the face value taken off the glass by the');
  console.log('  stylesheet alone, with every line of JS untouched. P7 and P10 are the same');
  console.log('  sentence entered by two different doors, and before P10 existed the JS door was');
  console.log('  the whole extent of that green (MR-101) — through CSS it went green on a screen');
  console.log('  that named the tint nowhere.');
  console.log('  P11-P13 (MR-260) ARE PLANTED AGAINST THE BOUNDARY, not against the check, and');
  console.log('  that is the point of them: P10\'s boundary paragraph listed a caught-list, the');
  console.log('  caught-list was planted, and three of five entries came back GREEN. P11 is the');
  console.log('  zero-area box the words "a zero box" claimed and the box-count predicate missed;');
  console.log('  P12 hides the value only while the row is OPEN, so the arrival half stays green');
  console.log('  and the post-pick half — twelve lines below it and still on textContent — goes');
  console.log('  red; P13 opens the panel onto five swatches at scale(0); P14 takes the face LABEL');
  console.log('  off the glass and is ALSO the evidence for the sentence below it. What is STILL');
  console.log('  unplanted');
  console.log('  is named in the run\'s own boundary: color:transparent, opacity:0,');
  console.log('  visibility:hidden, paint-over, and an ancestor that hides a value keeping its own');
  console.log('  box. Those are silences this measure cannot turn into a red, not gaps in the');
  console.log('  corpus — a plant for them would be a known-bad this predicate can never fail on.');
  console.log('  The roster those last two are aimed at is MR-189\'s (TINT alone); a roster edit moves');
  console.log('  every plant\'s coordinate, so they were re-aimed and re-run, not inherited.');
  console.log('  P8 IS ALSO THE REFERENT GUARD\'S KNOWN-BAD (SOP 2\'s ⚙ clause). At a ONE-row roster it');
  console.log('  empties the set the fold assertions quantify over, and an empty ∀ is TRUE: before');
  console.log('  2026-08-16 it printed `0 options off the glass` and `TINT undefined` as PASS, then');
  console.log('  threw and took the tap floor and Law 5 down with it. Six named FAILs now, no crash.');
  console.log('  P15-P16 (MR-287) ARE THE TWO EDGES OF ONE MEASUREMENT — the anchor. The panel may');
  console.log('  drift too far BELOW its face (P15, in flow, the same arm as the defect Constantine');
  console.log('  found on the build) or land ABOVE it (P16, the bottom sheet, his own words as a');
  console.log('  stylesheet). One plant would have watched one arm and left the other unknown.');
  console.log('  BOTH ARE ALSO EVIDENCE FOR THE SENTENCE THEY WERE WRITTEN FOR: under P16 every');
  console.log('  other check in this tool prints PASS on a panel sitting at the bottom of the');
  console.log('  screen, which is why this measurement had to be added rather than derived from a');
  console.log('  green. P15\'s first site was appended AFTER `.disc-more` and was overridden by the');
  console.log('  `.disc-reveal` block four lines further down — it landed, parsed, and printed EXIT');
  console.log('  0 GREEN with the gap unchanged. A plant with no referent and a check with nothing');
  console.log('  to catch print the same thing. It is aimed at the declaration itself now.');
  console.log('  P15 WAS RE-AIMED at 50ebb39 (Bjorn) — SAME SITE, NEW TEXT. Sunna deleted the');
  console.log('  `margin-top` this plant edited, so the `from` string stopped existing and this');
  console.log('  selftest refused the whole run: HARD RED, exit 2, P15 found NO home. Second time');
  console.log('  in two commits that clause has caught a drifted site (P6 was the first), and both');
  console.log('  times it was a real source change, not a typo. The gap it produces moved with it,');
  console.log('  108 -> 113.39 px, because the margin now ADDS to the container row-gap instead of');
  console.log('  replacing a margin — observed, and printed, rather than carried over.');
  console.log('  The tooltip path (hover/gamepad focus) is ASSERTED every run and has never been');
  console.log('  watched to fail — it carries no plant here.');
  process.exit(fails ? 1 : 0);
}

// ---------------------------------------------------------------------------
async function main() {
  if (args.includes('--selftest')) return selftest();
  if (!browserPath) { console.error('creationbrief: no Chrome found — pass --browser or set $CHROME'); process.exit(2); }

  console.log('creationbrief — D26\'s short form, observed');
  console.log(`  DOOR: expectation = the content tables at ${ROOT} imported through src/content/index.js`);
  console.log('        -> createRegistries -> createRunState -> creationBrief (the real content door,');
  console.log('        which refuses a bad row by name exactly as boot does).');
  console.log('        observation = index.html served over http, booted in headless Chromium at');
  console.log('        ?shot=customize, faces CLICKED with real input. Two roads, compared.');

  let want;
  try {
    want = await expectation(ROOT);
  } catch (e) {
    // A refusal here IS a result, and it is the loud one: the content door
    // named the row. Print it whole — a boot failure that prints a stack with
    // the row's name buried is the blank screen Law 1 clause 5 is about.
    console.error(`\ncreationbrief: content door refused the tables — ${e && e.message}`);
    process.exit(1);
  }
  const floor = want.floor;
  console.log(`  expectation: ${want.faces.length} face-tier entr(ies), ${want.behind.length} behind the expander, `
    + `${want.armaments.length} armament row(s), relic '${want.relicName}', floor ${floor} px\n`);

  const { serve } = await import(join(TOOLS, 'serve.mjs'));
  const s = await serve({ root: ROOT, port: 8291, open: false });
  const base = `http://localhost:${s.port}/`;
  const profile = mkdtempSync(join(tmpdir(), 'creationbrief-'));
  const { child, wsUrl } = await launchChrome(browserPath, profile);
  const cdp = connectCdp(wsUrl); await cdp.ready;

  let fails = 0; let ran = 0; let measured = 0;

  for (const [W, H] of SHAPES) {
    const shape = `${W}x${H}`;
    if (only && only !== shape) continue;
    ran++;
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId: S } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, S); await cdp.send('Runtime.enable', {}, S);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 700 }, S);
    const errors = [];
    cdp.on('Runtime.exceptionThrown', (p) => {
      const d = p && p.exceptionDetails;
      errors.push((d && (d.exception && d.exception.description || d.text)) || 'threw');
    });
    const ev = async (e) => {
      const r = await cdp.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }, S);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'threw');
      return r.result.value;
    };
    const until = async (x, w, ms = 20000) => {
      const t = Date.now();
      while (Date.now() - t < ms) { if (await ev(x).catch(() => false)) return 1; await wait(150); }
      throw new Error(`timeout ${w}`);
    };
    const ok = (b, what) => { if (b) console.log(`    PASS ${what}`); else { fails++; console.log(`    FAIL ${what}`); } };

    console.log(`  ${shape}`);
    await cdp.send('Page.navigate', { url: `${base}?shot=customize` }, S);
    try {
      await until(`!!document.querySelector('.cz-brief .disc-faces .disc-face')`, 'the short form', 15000);
    } catch (e) {
      fails++;
      console.log(`    FAIL the creation screen drew its short form — ${e.message}`);
      for (const line of errors.slice(0, 4)) console.log(`      page | ${String(line).split('\n')[0]}`);
      continue;
    }
    await wait(250);

    // ---- 1. the arrival ---------------------------------------------------
    const read = await ev(`(() => {
      const norm = (s) => (s || '').replace(/\\s+/g, '');
      const faces = [...document.querySelectorAll('.cz-brief .disc-face')].filter((el) => !el.classList.contains('disc-more'));
      const box = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 }; };
      const more = document.querySelector('.cz-brief .disc-more');
      return {
        faces: faces.map((el) => ({ key: el.dataset.face, tier: el.dataset.disclosure, text: norm(el.textContent), ...box(el) })),
        moreCount: more ? Number(more.dataset.more) : 0,
        openReveals: document.querySelectorAll('.cz-brief .disc-reveal[data-reveal-for]').length,
        briefText: norm(document.querySelector('.cz-brief').textContent),
        // The SAME panel with its spaces intact — 'Straight Sword' is two words
        // and only reads as camelCase once whitespace is stripped, so the
        // engine-language probe gets its own honest reading rather than a
        // squashed one.
        // innerText, not textContent: textContent runs two boxes' words
        // together ('Straight Sword' + 'Right Hand' -> 'SwordRight'), which
        // reads as camelCase that no player ever sees. innerText is what is on
        // the screen.
        briefWords: (document.querySelector('.cz-brief').innerText || '').replace(/\s+/g, ' '),
        kits: [...document.querySelectorAll('#cz-kits button')].map((el) => box(el)),
        screenText: (document.querySelector('.screen.customize').textContent || '').replace(/\\s+/g, ' '),
      };
    })()`);
    measured += read.faces.length;
    // MR-151's arrival state, READ HERE and asserted at section 6 below — before
    // section 2's tap and section 3's expander touch anything on this screen.
    const foldsAtArrival = await ev(FOLD_READ);

    const drawn = new Map(read.faces.map((row) => [row.key, row]));
    const missing = want.faces.filter((row) => !drawn.has(row.key)).map((row) => row.key);
    ok(missing.length === 0, `every face-tier entry is drawn — ${want.faces.length - missing.length}/${want.faces.length}${missing.length ? ` · missing ${missing.join(', ')}` : ''}`);
    const leaked = read.faces.filter((row) => row.tier !== 'face').map((row) => row.key);
    ok(leaked.length === 0, `the arrival screen holds no reveal-tier entry — ${leaked.length ? `drawn anyway: ${leaked.join(', ')}` : `${want.behind.length} kept behind the expander`}`);
    ok(read.moreCount === want.behind.length, `the expander counts what the table put behind it — ${read.moreCount}, want ${want.behind.length}`);
    ok(read.openReveals === 0, `nothing is expanded on arrival — ${read.openReveals} open reveal(s)`);
    // A FACE CARRIES NO PROSE: its text must be exactly its own label and its
    // own number, whitespace ignored. This is the check that catches the
    // paragraph coming back one sentence at a time.
    const wordy = [...want.faces, ...want.armaments]
      .filter((row) => drawn.has(row.key) && drawn.get(row.key).text !== row.text.replace(/\s+/g, ''))
      .map((row) => `${row.key}: '${drawn.get(row.key).text}' != '${row.text.replace(/\s+/g, '')}'`);
    ok(wordy.length === 0, `no face carries prose — ${wordy.length ? wordy.join(' · ') : `${want.faces.length + want.armaments.length} faces are label + number only`}`);
    // Bjorn's finding: the screen never named the starting relic while the
    // panel one row below itemized relics.
    ok(want.relicName !== '' && read.screenText.includes(want.relicName),
      `the starting relic is named on the screen — '${want.relicName}'`);
    // Vira's finding: engine language on a player's first screen. camelCase is
    // the tell — an id that escaped as a label.
    const camel = (read.briefWords.match(/[a-z]{2,}[A-Z][a-z]+/g) || []);
    ok(camel.length === 0, `no engine language in the short form — ${camel.length ? camel.slice(0, 4).join(', ') : 'no camelCase token in the panel'}`);

    // ---- 2. the tap -------------------------------------------------------
    const probe = want.faces[0];
    const tapped = await ev(`(() => {
      const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
      const el = document.querySelector('.cz-brief [data-face=${JSON.stringify(probe.key)}]');
      el.click();
      const panel = document.querySelector('.cz-brief .disc-reveal[data-reveal-for]');
      const opened = { for: panel ? panel.dataset.revealFor : null, text: panel ? norm(panel.textContent) : '',
        expanded: el.getAttribute('aria-expanded'), mark: el.dataset.reveal };
      el.click();
      const after = document.querySelector('.cz-brief .disc-reveal[data-reveal-for]');
      return { ...opened, closedAgain: !after };
    })()`);
    ok(tapped.for === probe.key && tapped.expanded === 'true' && tapped.mark === 'open',
      `a tap opens that entry's reveal — ${probe.key} → ${tapped.for || 'nothing'}`);
    ok(probe.sense !== '' && tapped.text.includes(probe.sense),
      `the reveal says the entry's OWN authored sentence — ${JSON.stringify((probe.sense || '').slice(0, 42))}`);
    ok(tapped.closedAgain, 'a second tap closes it again — the short form stays short');

    // ---- 3. the expander --------------------------------------------------
    if (want.behind.length) {
      const opened = await ev(`(() => {
        const more = document.querySelector('.cz-brief .disc-more');
        more.click();
        return { keys: [...document.querySelectorAll('.cz-brief .disc-face')].filter((el) => el.dataset.disclosure === 'reveal').map((el) => el.dataset.face),
          expanded: more.getAttribute('aria-expanded') };
      })()`);
      const wantKeys = want.behind.map((row) => row.key).sort().join(',');
      ok(opened.keys.slice().sort().join(',') === wantKeys && opened.expanded === 'true',
        `the expander reveals exactly the table's reveal-tier entries — ${opened.keys.join(', ') || 'none'}, want ${wantKeys}`);
    } else {
      ok(read.moreCount === 0, 'no expander is drawn when the table puts nothing behind one');
    }

    // ---- 6. the folded pickers (MR-151) -----------------------------------
    // `foldsAtArrival` was READ ABOVE, before any click landed anywhere on this
    // screen, because "on arrival" is the whole claim; the assertions print
    // here, after 1-3, which is why the numbering in this output runs 1 2 3 6
    // 4 5. The tap floor below needs these rects, so 6 cannot print last.
    const folds = foldsAtArrival;
    const unfolded = folds.rows.filter((row) => row.missing).map((row) => row.key);
    ok(unfolded.length === 0, `every picker MR-151 named is folded — ${FOLDED.length - unfolded.length}/${FOLDED.length}`
      + `${unfolded.length ? ` · never folded: ${unfolded.join(', ')}` : ''}`);
    const stray = folds.drawn.filter((key) => !FOLDED.some((row) => row.key === key));
    ok(stray.length === 0, `no other row of .cz-fields is folded — ${stray.length ? `folded anyway: ${stray.join(', ')}` : 'CLASS, STARTING KIT, KEEPSAKE, SIGIL and SPRITE are open, as they arrive'}`);
    // ⚙ PROVE THE QUERY HAD A REFERENT (SOP 2, commons/development.md). Every
    // assertion below this line is quantified over the rows that were FOUND, so
    // a roster row that never folded leaves them ranging over the empty set —
    // and an empty ∀ is TRUE. Found 2026-08-16 by planting P8 against a
    // one-row roster: `0 options off the glass behind 1 face(s)` and
    // `TINT undefined` both printed PASS, against a row that was not on the
    // screen at all. With three rows the absent one was diluted by two real
    // ones; with one row the green was made entirely of nothing. So the
    // referent is asserted IN EACH SENTENCE, not once above them: `unfolded`
    // going red must not leave three greens standing under it.
    const present = folds.rows.filter((row) => !row.missing);
    const haveAll = present.length === FOLDED.length;
    const noReferent = ` · NO REFERENT: ${present.length}/${FOLDED.length} named row(s) on the screen`;
    const ajar = present.filter((row) => row.onGlass > 0 || !row.hiddenPanel || row.expanded !== 'false');
    ok(haveAll && ajar.length === 0, `every folded picker is SHUT on arrival — ${ajar.length ? ajar.map((row) => `${row.key}: ${row.onGlass} option(s) on the glass`).join(' · ') : `${present.reduce((n, row) => n + (row.options || 0), 0)} options off the glass behind ${present.length} face(s)`}${haveAll ? '' : noReferent}`);
    // A FOLD THAT HIDES THE CURRENT CHOICE IS NOT THE MECHANISM HE APPROVED.
    // A face is a label AND a value. On TINT this is not a side condition — it
    // is the whole purchase: the swatches carry no text, so the face is the only
    // place on this screen where a touch player reads the colour's NAME.
    //
    // ON THE GLASS, NOT IN THE DOM (MR-237). Until 2026-08-16 this sentence was
    // built entirely out of `textContent`, while the options it is paired with
    // were measured with `getClientRects` — half of the DOM-versus-ink clause
    // applied, on the half that matters least. Vira planted
    // `.disc-face .disc-value { display: none }` through styles/ui.css into a
    // copy of this tree and got EXIT 0, GREEN, `TINT Goldbough gold`, on a
    // screen where the name of the chosen colour appeared NOWHERE: the fold's
    // sole purchase gone, and the instrument reciting the words it could not
    // see. The value now carries the same measure as the options.
    const mute = present.filter((row) => row.value === '' || !row.valueOnGlass || !row.labelOnGlass
      || row.label !== FOLDED.find((f) => f.key === row.key).label
      || (row.chosenText && !row.chosenText.includes(row.value)));
    const why = (row) => (row.value === '' ? 'no value in the face'
      : !row.valueOnGlass ? `value '${row.value}' is OFF THE GLASS (no box with area)`
        : !row.labelOnGlass ? `label '${row.label}' is OFF THE GLASS (no box with area) — the value says what, and nothing says what OF`
          : `'${row.label}' / '${row.value}' vs chosen '${row.chosenText.slice(0, 30)}'`);
    ok(haveAll && mute.length === 0, `each folded row names what is currently chosen, ON THE GLASS — `
      + `${mute.length ? mute.map((row) => `${row.key}: ${why(row)}`).join(' · ')
        : present.map((row) => `${row.label} ${row.value}`).join(' · ') || 'nothing'}${haveAll ? '' : noReferent}`);
    // The tap, and then the pick — a face frozen at mount passes everything
    // above and fails here, which is why the second half exists.
    //
    // THE HALF THAT WAS STILL DOM (MR-260, Vira's second finding). Everything
    // above this line moved to ink on 2026-08-16; this block, twelve lines
    // below it, kept reading the post-pick value as `textContent` alone — so
    // the sentence *the folded face value is measured as boxes* was true on
    // arrival and false the moment a player picked. `setValue` re-renders the
    // face, which is exactly when a stylesheet keyed on the OPEN state
    // (`.disc-face[data-reveal='open']`, a selector this stylesheet already
    // uses) takes the name off the screen while the arrival read stays green.
    // Both reads now share ONE predicate, interpolated from ON_GLASS above.
    const probeRow = FOLDED[FOLDED.length - 1];
    const worked = await ev(`(() => {
      ${ON_GLASS}
      const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
      const face = document.querySelector('.cz-fields [data-face=${JSON.stringify(probeRow.key)}]');
      // A MISSING FACE IS A FINDING, NOT A CRASH. It used to throw here and take
      // the rest of the sweep — the tap floor and Law 5 — down with it, so a
      // roster defect hid two unrelated checks behind a stack trace.
      if (!face) return { absent: true, total: 0, onGlass: 0, expanded: null, wanted: '', value: '', valueOnGlass: false, shut: 0 };
      face.click();
      const host = face.closest('.cz-disc');
      const opts = [...host.querySelectorAll('.disc-reveal ${probeRow.options}')];
      // AREA, because this sentence asserts the options ARE on the screen after
      // the tap. Counted as boxes it passed on a panel whose five swatches were
      // at transform: scale(0) — a tap that opens nothing a player can see.
      const opened = { onGlass: opts.filter(onGlass).length,
        expanded: face.getAttribute('aria-expanded'), total: opts.length };
      const other = opts.find((el) => !el.classList.contains('chosen'));
      const wanted = norm((other && other.title) || (other && other.textContent) || '');
      if (other) other.click();
      // Re-queried off the FACE, not the host: setValue replaces the button's
      // innerHTML, so the element read on arrival is stale by now, and the open
      // panel is inside the host too.
      const valueEl = face.querySelector('.disc-value');
      const value = norm(valueEl && valueEl.textContent);
      const valueOnGlass = onGlass(valueEl);
      face.click();
      // BOXES, because this one asserts the options are gone again.
      const shut = [...host.querySelectorAll('.disc-reveal ${probeRow.options}')].filter((el) => el.getClientRects().length > 0).length;
      return { ...opened, wanted, value, valueOnGlass, shut };
    })()`);
    const gone = worked.absent ? ` · NO REFERENT: ${probeRow.key} is not on the screen` : '';
    ok(!worked.absent && worked.total > 0 && worked.onGlass === worked.total && worked.expanded === 'true',
      `a tap opens the folded picker — ${probeRow.key} → ${worked.onGlass}/${worked.total} option(s) on the glass${gone}`);
    ok(!worked.absent && worked.wanted !== '' && worked.value === worked.wanted && worked.valueOnGlass,
      `picking inside the fold MOVES the face, ON THE GLASS — chose '${worked.wanted}', face now `
      + `'${worked.value}'${worked.value === worked.wanted && !worked.valueOnGlass
        ? ' — and that name is OFF THE GLASS (no box with area) after the pick' : ''}${gone}`);
    ok(!worked.absent && worked.shut === 0, `a second tap folds it again — ${worked.shut} option(s) still on the glass${gone}`);

    // ---- 4. the tap floor -------------------------------------------------
    const tiles = [...read.faces, ...read.kits, ...folds.rows.filter((row) => !row.missing)];
    const short = tiles.filter((row) => row.w + 0.5 < floor || row.h + 0.5 < floor);
    ok(tiles.length > 0 && short.length === 0,
      `every face and armament tile clears the ${floor} px floor — ${tiles.length} measured, smallest `
      + `${tiles.length ? Math.min(...tiles.map((row) => Math.min(row.w, row.h))) : 0} px`);

    // ---- 5. Law 5, per scroll container -----------------------------------
    const axis = await ev(`(() => {
      const out = [];
      const root = document.querySelector('.screen.customize');
      for (const el of [root, ...root.querySelectorAll('*')]) {
        const over = getComputedStyle(el).overflowX;
        const travel = el.scrollWidth - el.clientWidth;
        if (travel > 1 && (over === 'auto' || over === 'scroll')) out.push({ sel: el.className || el.tagName, travel });
      }
      return { scrollers: out, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    })()`);
    ok(axis.scrollers.length === 0,
      `horizontal travel is ZERO on every scroll container of the creation screen — `
      + `${axis.scrollers.length ? axis.scrollers.map((row) => `${row.sel} ${row.travel}px`).join(' · ') : 'none scroll sideways'}`
      + ` (document ${axis.doc} px)`);

    // ---- 7. the anchor (MR-287) -------------------------------------------
    // LAST ON PURPOSE. This pass CLICKS every face on the screen and clicks it
    // shut again; running it earlier would hand sections 1-6 a screen this
    // pass had touched. It therefore reads the screen AS THIS RUN LEFT IT —
    // section 3 has opened the expander, so the brief lane carries one more
    // face here than it does on arrival. That matters only to the ungated
    // half: `.cz-fields` is untouched by the expander, so the FOLD's reading
    // is the same either way.
    const anchors = await ev(ANCHOR_READ);
    const foldKeys = new Set(FOLDED.map((row) => row.key));
    const foldAnchors = anchors.filter((row) => foldKeys.has(row.key));
    const adrift = foldAnchors.filter((row) => !row.anchored);
    // Everything that is NOT a folded row, counted together rather than by
    // host: a third `.cz-disc` appearing on this screen must show up in this
    // number, not fall through a `.cz-brief` test into silence.
    const rest = anchors.filter((row) => !foldKeys.has(row.key));
    const restAdrift = rest.filter((row) => !row.anchored);
    const say = (row) => `${row.key}: ${row.open ? `panel opens ${row.gap} px below its face (one row-gap is ${row.tol} px)` : 'the panel did not open at all'}`
      + (row.between.length ? `, past ${row.between.length} other face(s): ${row.between.join(', ')}` : '');
    ok(foldAnchors.length === FOLDED.length && adrift.length === 0,
      `the fold's panel opens UNDER ITS OWN FACE — `
      + `${adrift.length ? adrift.map(say).join(' · ')
        : foldAnchors.map((row) => `${row.key} gap ${row.gap} px, row-gap ${row.tol} px`).join(' · ') || 'nothing'}`
      + `${foldAnchors.length === FOLDED.length ? '' : ` · NO REFERENT: ${foldAnchors.length}/${FOLDED.length} named row(s) measured`}`
      + ` · MR-287, MEASURED AND NOT GATED HERE: ${restAdrift.length}/${rest.length} other face(s) on this`
      + ` screen open a panel that is not under them${restAdrift.length ? ` — ${restAdrift.map((row) => row.key).join(', ')}` : ''}`
      + `; inherited from 334fd02, not this lane's to owe`);

    await cdp.send('Target.closeTarget', { targetId }, S).catch(() => {});
  }

  try { cdp.close(); } catch { /* closing */ }
  try { child.kill(); } catch { /* closing */ }
  try { s.server.close(); } catch { /* closing */ }

  // AN EMPTY RESULT IS NEVER A PASS. The floor is on the denominator: a run
  // that measured no shape, or a shape that found no face, is exit 2 — not a
  // clean sweep with nothing in it.
  if (!ran || measured === 0) {
    console.error(`\ncreationbrief: NOTHING RAN (${ran} shape(s), ${measured} face(s) measured) — this is not a pass`);
    process.exit(2);
  }
  console.log(`\ncreationbrief: ${fails ? `${fails} FAIL` : 'green'} — ${ran} shape(s), ${measured} face(s) measured`);
  console.log('  BOUNDARY: headless Chromium on Linux, the SOURCE tree over http (not dist/), '
    + `${SHAPES.map(([w, h]) => `${w}x${h}`).join(' + ')}, default Text size and UI size, the first class only.`);
  console.log('  Silent on: a real finger, Windows, the receipts panel under the short form, whether');
  console.log('  the sentences are GOOD — only that they are short, the table\'s own, and one tap away.');
  console.log('  ON THE GLASS MEANS A CLIENT RECT WITH AREA, and that is the extent of it (MR-101,');
  console.log('  narrowed and corrected at MR-260). Where a fold sentence says something IS on the');
  console.log('  screen — the face LABEL and value on arrival, the value after the pick, the options');
  console.log('  after the tap — the element must have at least one box of NON-ZERO width and height.');
  console.log('  WATCHED RED at this ref, all four through the stylesheet: display:none (P10), and');
  console.log('  the three ordinary edits that leave a box of NO SIZE — font-size:0 (P11),');
  console.log('  transform:scale(0), and width:0;height:0;overflow:hidden. Until MR-260 this');
  console.log('  paragraph claimed those three under the words "a zero box" and caught NONE of them:');
  console.log('  getClientRects().length counts BOXES, not AREA, and all three still have a box.');
  console.log('  A subtree detached from the document is the same zero-rect result and is REASONED,');
  console.log('  not watched — no plant reaches it through a stylesheet, and it is named as reasoning.');
  console.log('  Where a fold sentence says something is NOT on the screen — the options behind a');
  console.log('  shut face, the options after the second tap — the measure is BOXES, deliberately:');
  console.log('  the stronger test of absence, since a zero-area option still raises that count.');
  console.log('  IT IS STILL SILENT on ink painted invisible in place: color:transparent, opacity:0,');
  console.log('  visibility:hidden, or the value in the panel\'s own colour. Those keep a box WITH');
  console.log('  area and this tool will call them on the glass. It is silent, too, on an ANCESTOR');
  console.log('  that hides the value while the value keeps its own box — rects are the element\'s');
  console.log('  own geometry, not a visibility walk up the tree. Widening the measure to real ink');
  console.log('  is not free and is not claimed here; the sentence is written to what rects carry.');
  console.log('  Watched at this ref: height:0;overflow:hidden on .cz-disc clips the whole picker');
  console.log('  row away and every sentence in this run, this one included, prints PASS at exit 0.');
  console.log('  WHAT IS MEASURED AS INK HERE IS THE FOLD, AND ONLY THE FOLD. Every other sentence');
  console.log('  in this run — every face-tier entry is drawn, no face carries prose, the starting');
  console.log('  relic is named on the screen, the reveal says the entry\'s own sentence — reads DOM');
  console.log('  TEXT. Watched at this ref: font-size:0 on .disc-name takes the label off all 13');
  console.log('  faces and only the fold row goes red; and under P10 (the value display:none) the');
  console.log('  relic sentence prints PASS while the relic name is nowhere on the screen. Those');
  console.log('  sentences are named here because a boundary owes the reader the gaps it knows,');
  console.log('  and they are not repaired here because they are not this lane\'s to write.');
  console.log('  THE ANCHOR (MR-287) IS ONE MEASUREMENT WITH TWO SCOPES, and the split is Marina\'s');
  console.log('  conditional, not a cap. A panel is UNDER ITS OWN FACE when the space between them');
  console.log('  is no more than ONE ROW-GAP of that host\'s own `.disc-faces` — the reference length');
  console.log('  is READ off the layout (6 px here), never typed, plus 1 px for subpixel rounding.');
  console.log('  Anchored measures 5.39 px at 390x844 and 6 px at 1200x730; adrift measures 55, 104');
  // Worded to avoid the token this tool greps its own output for: --selftest
  // prints every line matching /FAIL/ as a plant's red, and a boundary sentence
  // that says FAILS lands in that list looking like a finding. Found by reading
  // the selftest's own output rather than the source.
  console.log('  and 154. IT GOES RED ONLY FOR THE ROWS IN `FOLDED`. Every other face on this screen');
  console.log('  is');
  console.log('  measured by the same predicate and printed in the same sentence UNGATED, because it');
  console.log('  carried this defect at 334fd02 before the fold existed — measured there by hand,');
  console.log('  2026-08-16: the same 8 of 14 faces at 390x844 and 11 of 15 at 1200x730, the fold row');
  console.log('  being the only difference and the only one anchored. The conditional needs no');
  console.log('  baseline constant and none is typed: the fold\'s whole contribution to this screen IS');
  console.log('  the roster, so NO FOLDED ROW ADRIFT is exactly THE FOLD MADE THIS NO WORSE.');
  console.log('  WATCHED RED at this ref, all three through the stylesheet: margin-top:12rem on');
  console.log('  .disc-reveal (P15, the in-flow arm — the same arm as the real defect),');
  console.log('  position:fixed;bottom:0 (P16, the panel above its face), and');
  console.log('  .cz-disc{flex-direction:column-reverse} (the same arm as P16 by another road).');
  console.log('  IT IS SILENT on the panel\'s HEIGHT, on whether either is in the viewport, and on');
  console.log('  SCROLL: a panel correctly anchored to a face 900 px down the page is still a panel a');
  console.log('  player has to scroll to find. It is measured LAST, on the screen this run left —');
  console.log('  section 3 has opened the expander by then, so the ungated count carries one more');
  console.log('  face than arrival does. `.cz-fields` is untouched by that, so the GATED half reads');
  console.log('  the same either way.');
  // ---------------------------------------------------------------------
  // Added 2026-08-16 by Bjorn, gating this measurement onto dev at 50ebb39.
  // It changes no predicate and no number. It states, in the run's own output,
  // the one thing a reader of the line above will otherwise get wrong.
  // ---------------------------------------------------------------------
  console.log('  THE UNGATED COUNT IS NOT A GATE, AND ITS OWN EXCUSE HAS EXPIRED. The sentence');
  console.log('  above says the rest of the screen is left ungated because it INHERITED the defect');
  console.log('  from 334fd02. That premise died at 50ebb39: Sunna anchored both hosts and this');
  console.log('  count now reads 0/13 at both shapes. So the number printed here is a REPORT with');
  console.log('  nothing behind it — measured by Bjorn at 50ebb39, one line reverted in');
  console.log('  components/disclosure.js (insertBefore -> appendChild, the pre-fix placement):');
  console.log('  8/13 and 11/13 adrift, the exact pre-fix numbers, and THIS TOOL PRINTS PASS AND');
  console.log('  EXITS 0. Whole pre-fix tree at a05d071, same door, same result: exit 0. The fold');
  console.log('  row survives both because one face cannot wrap, which is why the gate does not');
  console.log('  see it. WHAT IS GATED HERE IS `FOLDED` — one row — AND NOTHING ELSE. Widening the');
  console.log('  conditional is Marina\'s call and Vira\'s file; it was not done by the seat that');
  console.log('  found this, who would then have gated his own edit.');
  console.log('  AND `UNDER` IS ONE AXIS. The predicate is `panel.top - face.bottom`; it never');
  console.log('  reads x. Planted at 50ebb39 and watched GREEN at exit 0 (Bjorn):');
  console.log('  `.disc-reveal { position: relative; left: 320px }` — a full-width panel shoved');
  console.log('  almost entirely off a 390 px screen, vertically anchored at 5.39 px, PASS. The');
  console.log('  shipped `flex: 1 1 100%` makes that unreachable today; the SENTENCE, not the');
  console.log('  layout, is what is narrowed here.');
  console.log('  On the FOLD it is silent about THE ONE THING THAT NOW MATTERS MOST (MR-172, primary');
  console.log('  debt): whether a player ever FINDS the face. TOUCH IS NEVER TOLD THE ROW OPENS — the');
  console.log('  only teacher is attachTooltip, which answers pointerenter/gpfocus and never a thumb,');
  console.log('  and at 390x844 the chips that teach the affordance are BELOW THE FOLD. TINT is now');
  console.log('  the ONLY fold on this screen, so the whole teaching problem rests on one row a touch');
  console.log('  player is never told is openable. A picture is not a playtest. Also silent on every');
  console.log('  text/UI size but the defaults.');
  process.exit(fails ? 1 : 0);
}

await main();
