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
//      the code (Marina, MR-287). SCOPE — WIDENED 2026-08-17 (MR-301) FROM ONE
//      ROW TO EVERY FACE ON THE SCREEN, and the conditional it replaces is
//      gone rather than amended. Marina scoped this to `FOLDED` because the
//      rest of the screen INHERITED the defect from 334fd02 and a lane that
//      inherits a defect is not the lane that owes it — right when written,
//      and its premise DIED at 50ebb39, where Sunna anchored both brief hosts
//      and took the ungated count to 0/13 at both shapes. A conditional whose
//      premise has died is an excuse outliving its defect, and this one cost
//      exactly what that always costs: Bjorn reverted ONE line of
//      `src/ui/components/disclosure.js` — `insertBefore` -> `appendChild`,
//      the literal pre-fix placement — and the screen went 8/13 and 11/13
//      adrift while this tool printed PASS and EXIT 0. The gated row survived
//      because `.cz-fields` holds ONE face and one face cannot wrap. SO THE
//      GATE IS NOW THE WHOLE SCREEN: every `.disc-face` of every `.cz-disc`,
//      which today is `.cz-fields`' fold row plus `#cz-brief-stats` and
//      `#cz-brief-armaments`, the two hosts Sunna fixed. It is a set, not a
//      list of hosts: a fourth `.cz-disc` is gated the day it mounts. Still no
//      baseline constant and still none typed — the reference length is the
//      layout's own row-gap, read per host. The plant is P17 (Bjorn's revert)
//      and it is red at both shapes; P15 and P16 carry the two edges of the
//      set, first row and last, on both arms of the predicate.
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
          // THE HOST IS CARRIED SINCE MR-301, because the gate now covers every
          // host on this screen and a bare key does not say which one it came
          // from. \`#cz-brief-stats\` and \`#cz-brief-armaments\` are the two
          // Sunna fixed; \`.cz-fields\` is the fold's. A host with no id reports
          // its class rather than going anonymous — an unnamed row in a red is
          // a row nobody can find.
          host: host.id ? '#' + host.id
            : ((host.parentElement && host.parentElement.className
              ? '.' + host.parentElement.className.trim().split(/\\s+/).join('.') + ' > ' : '')
              + '.' + (host.className || 'cz-disc').trim().split(/\\s+/).join('.')),
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
    expect: "EVERY panel on the screen is measured against the layout's OWN row-gap and found adrift below its face — 14 of 14, THE FIRST ROW AND THE LAST",
    // RE-AIMED 2026-08-17 (MR-301) with the widening. The sentence this plant
    // reddens changed name, so the regex had to move or it would have matched
    // nothing and called it a pass — the corpus's own version of a plant with
    // no referent. It now also carries THE TWO EDGES OF THE GATED SET: this
    // plant is on `.disc-reveal`, which every host has, so it reddens the
    // FIRST row of the screen (`pick:tint`, the fold) and the LAST
    // (`relic:forsakenMedallion`) in the same run, by name. P17 below cannot
    // redden either of those, by construction, and says so.
    mustRed: (out) => /FAIL every panel on this screen opens UNDER ITS OWN FACE — 14\/14 adrift:/.test(out)
      && /pick:tint: panel opens 113\.39 px below its face/.test(out)
      && /relic:forsakenMedallion: panel opens 113\.39 px below its face/.test(out),
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
    expect: 'every panel is measured ABOVE its own face (a negative gap) and goes red — the other arm of the predicate, at both edges of the set',
    // RE-AIMED 2026-08-17 (MR-301), same reason as P15, and it carries the two
    // edges of the set on the OTHER arm of the predicate.
    //
    // THE NEGATIVE GAP IS A 390x844 READING AND THE REGEX BELOW SAYS SO BY
    // BEING SHAPE-SHAPED — `runSelfAt` runs this corpus at 390x844 only.
    // Observed by hand at 1200x730 through the same door: the plant is still
    // 14/14 adrift and still red, `pick:tint` at -119.5 px, but the LAST row
    // reads +74 px — a bottom-sheet panel that happens to land BELOW the last
    // face of a taller viewport, adrift by distance rather than by sign. Named
    // rather than generalised: this plant's arm at the last row is the
    // negative one at 390x844 and the far-below one at 1200x730.
    mustRed: (out) => /FAIL every panel on this screen opens UNDER ITS OWN FACE — 14\/14 adrift:/.test(out)
      && /pick:tint: panel opens -\d+(\.\d+)? px below its face/.test(out)
      && /relic:forsakenMedallion: panel opens -\d+(\.\d+)? px below its face/.test(out),
    // AND THE PART THIS PLANT IS EVIDENCE OF: a bottom-sheet panel passes
    // EVERY other sentence in this tool. The greens below are the finding.
    mustStay: (out) => /PASS each folded row names what is currently chosen, ON THE GLASS/.test(out)
      && /PASS a tap opens the folded picker/.test(out)
      && /PASS a second tap folds it again/.test(out)
      && /PASS horizontal travel is ZERO/.test(out),
  },
  // --- MR-301, added 2026-08-17 with the widening above. THIS IS THE PLANT
  // THE GATE WAS WIDENED FOR, and it is Bjorn's, not mine: he found the gap by
  // reverting one line rather than by reasoning about it, and the revert he
  // chose is the honest one.
  //
  // WHY THIS LINE AND NOT A NO-OP. Sunna's first plant replaced the body of
  // `placeUnderRow` with nothing, which reads like coverage and is not: a no-op
  // leaves the panel as `.disc-faces`' FIRST child, so it opens ABOVE the faces
  // on every host including the fold, 13/13 adrift, and the gated row craters
  // with the rest. It reddens a gate that can already see one row. The
  // one-line revert `insertBefore(panel, next || null)` -> `appendChild(panel)`
  // is literally the pre-fix placement — the panel goes last, under the whole
  // wrapped row instead of under the tapped face — and it is exactly the edit a
  // future hand makes by accident while tidying. THAT is the regression this
  // gate exists to catch, and before the widening it printed EXIT 0.
  //
  // ITS TWO SILENCES, NAMED RATHER THAN LEFT FOR A READER TO FIND. This plant
  // CANNOT redden the first row of the screen or the last, and neither is a
  // gap in the gate:
  //   `pick:tint` (first)  the fold host holds ONE face, and one face cannot
  //     wrap, so `next` is undefined and `insertBefore(panel, null)` and
  //     `appendChild(panel)` are the same call. This is precisely why the old
  //     one-row gate could not see the defect.
  //   `relic:forsakenMedallion` (last)  appending puts the panel directly after
  //     the last face, which IS under it — the pre-fix code was right about the
  //     bottom row and wrong about every row above it.
  // Both edges of the set are watched by P15 and P16, which are on
  // `.disc-reveal` and reach every host. Three plants, one measurement.
  //
  // OBSERVED AT BOTH SHAPES, through the real door, before this entry was
  // written: 8/14 adrift at 390x844 and 11/14 at 1200x730, exit 1 — Bjorn's
  // 8/13 and 11/13 with the anchored fold row added to the denominator. The
  // selftest below runs 390x844 only (`runSelfAt`), so the 1200x730 arm of this
  // plant is a hand observation recorded in the boundary, not a corpus row.
  {
    name: 'P17 the panel goes back under the whole row',
    file: 'src/ui/components/disclosure.js',
    from: '    faceBox.insertBefore(panel, next || null);',
    to: '    faceBox.appendChild(panel); // planted: the pre-fix placement — the panel goes last, under the whole wrapped row',
    what: "the one-line revert of Sunna's fix at 50ebb39 — the panel is appended after every face instead of after the tapped face's line, which is the defect Constantine reported on the build",
    expect: '8 of 14 faces at 390x844 are measured adrift, naming the wrapped rows they opened past — the exact pre-fix reading',
    mustRed: (out) => /FAIL every panel on this screen opens UNDER ITS OWN FACE — 8\/14 adrift:/.test(out)
      && /#cz-brief-stats attribute:strength: panel opens 54\.78 px below its face/.test(out)
      && /#cz-brief-armaments armament:rightHand:straightSword: panel opens 153\.56 px below its face/.test(out),
    // THE WHOLE POINT OF THIS PLANT IS WHAT STAYS GREEN. Every other sentence
    // in this tool passes on a screen whose panels open under the wrong face —
    // that is why the anchor had to be added, and why widening it was not
    // optional. The fold's own row is green here too, which is the gap Bjorn
    // proved: it is in `mustStay` deliberately, so a future edit that reddens
    // the fold under this plant tells us the plant stopped being the pre-fix
    // placement.
    // RE-AIMED 2026-08-17 by Bjorn, gating this commit. The negation read
    // `!/\.cz-fields > \.cz-disc pick:tint: panel opens/` — it embedded the
    // HOST LABEL, and that label is DERIVED at runtime from the fold host's
    // parent className. It is the same rot P15 and P16 were just re-aimed for,
    // in the one position where it fails the other way: a mustRed that stops
    // matching gives a LOUD false red, a mustStay negation that stops matching
    // gives a SILENT false green, forever. Measured, same door: one extra
    // class on `.cz-fields` (`class="cz-fields cz-stack"`) with P17 planted —
    // the string `.cz-fields > .cz-disc` appears ZERO times in the output, the
    // run is otherwise identical at 8/14, and this assertion is vacuously true
    // from then on. It now keys on `pick:tint`, which is the entry's own key
    // out of the content table, not on a class name a tidy-up can change.
    mustStay: (out) => /PASS each folded row names what is currently chosen, ON THE GLASS/.test(out)
      && /PASS a tap opens the folded picker/.test(out)
      && /PASS every face and armament tile clears the/.test(out)
      && /PASS horizontal travel is ZERO/.test(out)
      && !/pick:tint: panel opens/.test(out),
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
  console.log('  P15 AND P16 WERE RE-AIMED AGAIN AT MR-301 (2026-08-17, Vira) — SAME SITES, SAME');
  console.log('  NUMBERS, NEW SENTENCE. Widening the gate renamed the assertion they redden, and a');
  console.log('  mustRed matching a sentence that no longer exists matches nothing and calls it a');
  console.log('  pass: the corpus\'s own version of a plant with no referent. Both now also assert');
  console.log('  THE TWO EDGES OF THE GATED SET by name — the first row of the screen (pick:tint)');
  console.log('  and the last (relic:forsakenMedallion) — because they sit on `.disc-reveal`, which');
  console.log('  every host has, and take all 14 faces down together.');
  console.log('  P17 IS THE PLANT THE WIDENING WAS FOR, and it is Bjorn\'s revert, not a fixture:');
  console.log('  one line of src/ui/components/disclosure.js, insertBefore -> appendChild, the');
  console.log('  literal pre-fix placement and exactly the edit a future hand makes while tidying.');
  console.log('  Before 2026-08-17 it printed EXIT 0 on a screen 8/13 adrift. Its mustStay is where');
  console.log('  the finding lives: every other sentence in this tool stays green under it, and so');
  console.log('  does the FOLD row — asserted, so that a future edit which reddens the fold under');
  console.log('  this plant tells us the plant has stopped being the pre-fix placement. Sunna\'s');
  console.log('  earlier no-op of placeUnderRow is NOT in the corpus and that is deliberate: it goes');
  console.log('  13/13 including the gated row, so it reddens a gate that could already see one row');
  console.log('  and proves nothing about the widening (Bjorn\'s correction, 2026-08-16).');
  console.log('  P17\'s mustStay NEGATION WAS RE-AIMED 2026-08-17 (Bjorn) off the derived host label');
  console.log('  onto the entry key. A negation that stops matching does not go red — it goes green');
  console.log('  and stays green. One extra class on `.cz-fields` deleted its referent entirely,');
  console.log('  measured through the same door. Read every `!` in this corpus that way.');
  console.log('  THE TWO DENOMINATOR FLOORS ADDED AT MR-301, and what has actually been watched:');
  console.log('  the FOLD-ROSTER floor goes red in this corpus already — P8 removes the fold and the');
  console.log('  anchor sentence prints `NO REFERENT: 0/1 named fold row(s) measured`. The');
  console.log('  NO-FACE-AT-ALL floor carries NO corpus row; watched red by hand 2026-08-17 (Bjorn),');
  console.log('  same door, file bytes in a disposable copy — `.disc-reveal` renamed so no host');
  console.log('  carries a panel: `0/0 anchored across 0 host(s): nothing · NO REFERENT: no face on');
  console.log('  this screen was measured`, exit 1. It is not a corpus row because that edit craters');
  console.log('  six sentences at once, which is the shape this corpus refuses. NEITHER FLOOR SEES A');
  console.log('  PARTIAL LOSS — one host leaving the set is exit 0; see the boundary of a full run.');
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
    // pass had touched. It therefore reads the screen AS THIS RUN LEFT IT.
    //
    // CORRECTED 2026-08-17 (Bjorn, gating MR-301). This comment claimed the
    // brief hosts carry the expander's extra face here and that the face is
    // therefore inside the gate. MEASURED AND FALSE: section 3 opens the
    // expander, section 6 PICKS a tint, and a pick calls renderPortrait(),
    // which re-runs mountDisclosure() on both brief hosts — a remount that
    // shuts the expander. At this line aria-expanded is FALSE, the stats host
    // holds its 9 face-tier faces, and `derived:stamina` is not measured by
    // this pass at all. 14 is the ARRIVAL composition, 9 + 4 + 1. Under P8 —
    // no fold, so no pick, so no remount — the same line reads 10 + 4 + 0,
    // which is also 14, which is why two different screens have been reading
    // as one number. THE EXPANDED STATE IS UNGATED; see the boundary.
    // `.cz-fields` is untouched by the expander either way.
    const anchors = await ev(ANCHOR_READ);
    const foldKeys = new Set(FOLDED.map((row) => row.key));
    const foldAnchors = anchors.filter((row) => foldKeys.has(row.key));
    // WIDENED 2026-08-17 (MR-301) — EVERY face on this screen, not one row.
    // The set is `anchors`, which is every `.disc-face` of every `.cz-disc`:
    // `.cz-fields` (the fold), `#cz-brief-stats` and `#cz-brief-armaments`.
    // It is deliberately NOT a list of hosts — a fourth `.cz-disc` appearing
    // on this screen is gated the day it is mounted, with nothing to edit
    // here.
    //
    // CORRECTED 2026-08-17 (Bjorn, gating MR-301). This comment claimed a host
    // that DISAPPEARS shows up in the denominator floor below rather than as a
    // quietly smaller green. MEASURED AND FALSE: `.cz-disc` is a selector, and
    // a host that stops matching it — or loses its `.disc-reveal` — is
    // `continue`d in ANCHOR_READ and never reaches the denominator.
    // `#cz-brief-armaments` reclassed to `.cz-group`, one CSS rule followed,
    // layout unchanged: PASS, 10/10 across 2 hosts, exit 0. The floors below
    // are TOTAL loss and the FOLD ROSTER. The PARTIAL loss has no floor, and
    // giving it one means deriving the denominator from the content door
    // (`want`), which is a predicate change and is not made here.
    const adrift = anchors.filter((row) => !row.anchored);
    const hosts = [...new Set(anchors.map((row) => row.host))];
    const perHost = hosts.map((h) => {
      const rows = anchors.filter((row) => row.host === h);
      return `${h} ${rows.filter((row) => row.anchored).length}/${rows.length}`;
    }).join(' · ');
    const say = (row) => `${row.host} ${row.key}: ${row.open ? `panel opens ${row.gap} px below its face (one row-gap is ${row.tol} px)` : 'the panel did not open at all'}`
      + (row.between.length ? `, past ${row.between.length} other face(s): ${row.between.join(', ')}` : '');
    // THREE THINGS, AND THE LAST TWO ARE DENOMINATOR FLOORS. An empty result
    // is never a zero (my own failure mode 5, identity card): a screen that
    // mounted no disclosure at all, or a roster row that stopped being drawn,
    // would otherwise satisfy `no face is adrift` by having no faces.
    ok(adrift.length === 0 && anchors.length > 0 && foldAnchors.length === FOLDED.length,
      `every panel on this screen opens UNDER ITS OWN FACE — `
      + `${adrift.length ? `${adrift.length}/${anchors.length} adrift: ${adrift.map(say).join(' · ')}`
        : `${anchors.length}/${anchors.length} anchored across ${hosts.length} host(s): ${perHost || 'nothing'}`}`
      + `${anchors.length ? '' : ' · NO REFERENT: no face on this screen was measured'}`
      + `${foldAnchors.length === FOLDED.length ? '' : ` · NO REFERENT: ${foldAnchors.length}/${FOLDED.length} named fold row(s) measured`}`);

    await cdp.send('Target.closeTarget', { targetId }, S).catch(() => {});
  }

  try { cdp.close(); } catch { /* closing */ }
  try { child.kill(); } catch { /* closing */ }
  try { s.server.close(); } catch { /* closing */ }
  // THE PROFILE DIRECTORY IS THE RUN'S, AND A RUN THAT REACHES THIS LINE TAKES
  // IT WITH IT — which is the whole extent of it. The boundary below says what
  // that leaves out; it is measured, not reasoned. Every
  // invocation mkdtemp'd a ~10 MB Chrome profile above and left it in /tmp,
  // and --selftest invokes this whole tool once per plant: one selftest is
  // seventeen of them. Measured 2026-08-16, mid-merge, with the disk at 87%:
  // 216 abandoned `creationbrief-*` directories, 2.0 GB. The sandbox trees
  // were always cleaned and the profile never was — the same defect this file
  // is full of, one home tidied and its twelve-lines-away twin missed.
  // `kill()` is a signal, not a join, so the run waits for the process to go
  // before deleting the directory it is using. THIS WAIT WAS NOT OBSERVED TO
  // BE NECESSARY — instrumented at this ref, the child had already exited with
  // code 0 by the time this line ran — and it is kept as a bounded guard, not
  // as a fix for anything watched. Said plainly because the first version of
  // this comment claimed a race I had not seen: see below.
  await new Promise((res) => {
    if (child.exitCode !== null || child.signalCode !== null) { res(); return; }
    child.once('exit', res);
    setTimeout(res, 3000);
  });
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* tmp */ }
  // HOW THIS WAS MEASURED, AND WHY IT IS NOT A COUNT. I first checked the fix
  // by counting `/tmp/creationbrief-*` before and after: 216, then 217, and I
  // wrote down that the removal had raced Chrome and lost. It had not. ANOTHER
  // SEAT WAS RUNNING THIS SAME TOOL AT THE SAME TIME on the same machine, and
  // a count over a directory a second writer is using is not a measurement of
  // your own run. The honest form is a SET DIFFERENCE — list the directories,
  // run, list them again, and name the ones that appeared — which reports this
  // run leaving nothing behind and is re-runnable by anyone, concurrently.
  //
  // WHAT THIS REMOVAL COVERS, MEASURED AT THE GATE (Bjorn, 2026-08-17). The
  // heading above read `so the run takes it with it`, unqualified. Narrowed to
  // the predicate, which is A RUN THAT REACHES THIS LINE:
  //   · one clean run, five times: before this commit, one FULL ~11 MB profile
  //     every time. After: nothing on two runs and a 1.1 MB PARTIAL on three.
  //     IT IS NOT DETERMINISTIC ON THE PATH IT COVERS — see the guard, below.
  //   · `--selftest`: 17 dirs / 157 MB before, 6 dirs / 6.4 MB after, and
  //     52 PASS / 0 FAIL either side — it changes no assertion, as claimed.
  //   · Chrome hands over no DevTools endpoint (`CHROME=/bin/true`): the launch
  //     above throws, nothing below runs, THE PROFILE STAYS.
  //   · SIGINT mid-run: an 8.8 MB profile stays.
  // There is no try/finally and no exit handler here, so EVERY early exit after
  // the mkdtemp leaks — and an interrupted or crashed run is the ordinary shape
  // of the ones that made the pile. Adding one is a PREDICATE change and is not
  // this gate's to write.
  //
  // AND THE 3000 ms GUARD IS NOT A JOIN. The paragraph above says the wait was
  // never observed to be necessary; on an idle machine, one invocation, that is
  // true. On a box with other seats live it is not, and it is not rare — three
  // of five clean runs. Every leftover is the same 1.1 MB PARTIAL,
  // still holding `SingletonLock` and `Default/.org.chromium.Chromium.*`:
  // rmSync walked a tree a browser had not finished with, the top-level rmdir
  // failed, and `catch { /* tmp */ }` swallowed it. Necessary AND insufficient
  // — and A PARTIAL REMOVAL REPORTS NOTHING.
  //
  // NOTHING GOES RED IF THIS REMOVAL IS DELETED. No assertion in this file, in
  // `--selftest`, or anywhere in tools/ or tests/ reads a leftover directory —
  // grepped at this ref. The evidence for the fix is a hand measurement, which
  // is `unknown` the day after it was taken (*The instrument rule*). A check
  // belongs here and would be RED TODAY on the six partials, so it waits on the
  // removal being made whole — a separate act, and this file's owner's.
  //
  // AND A SET DIFFERENCE OVER SHARED /tmp IS APPEARANCE, NOT ATTRIBUTION. Run
  // here 2026-08-17 it reported TWO new directories for ONE invocation, because
  // a second seat was running this tool in the same second — the exact
  // confounder it was written to defeat. The door that does defeat it is a
  // private tmpdir: `TMPDIR=<empty dir> CHROME=… node tools/creationbrief.mjs`,
  // where the mkdtemp above lands where no other writer can reach, so what is
  // left over is this run's BY CONSTRUCTION. Every number here came through it.

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
  console.log('  THE ANCHOR (MR-287) IS ONE MEASUREMENT OVER THE WHOLE SCREEN. A panel is UNDER ITS');
  console.log('  OWN FACE when the space between them is no more than ONE ROW-GAP of that host\'s own');
  console.log('  `.disc-faces` — the reference length is READ off the layout (6 px here), never');
  console.log('  typed, plus 1 px for subpixel rounding, and read PER HOST rather than once.');
  console.log('  Anchored measures 5.39 px at 390x844 and 6 px at 1200x730; adrift measures 55, 104');
  console.log('  and 154. IT GOES RED FOR EVERY FACE OF EVERY `.cz-disc` — today the fold row in');
  console.log('  `.cz-fields` plus `#cz-brief-stats` and `#cz-brief-armaments`, 14 faces at both');
  console.log('  shapes. The set is read off the screen, not listed, so a fourth host is gated the');
  console.log('  day it mounts.');
  // -------------------------------------------------------------------
  // CORRECTED 2026-08-17 by Bjorn, gating MR-301. What stood here said: "a
  // host that VANISHES is caught by the denominator floor beside the
  // predicate, never by a quietly smaller green." MEASURED, and it is false.
  // The claim is deleted rather than softened.
  // -------------------------------------------------------------------
  console.log('  A HOST THAT LEAVES THE SET IS A QUIETLY SMALLER GREEN, AND THE FLOORS BELOW DO NOT');
  console.log('  CATCH IT. `.cz-disc` is a SELECTOR: a host that stops matching it, or that loses');
  console.log('  its `.disc-reveal`, is skipped and never reaches the denominator. Measured');
  console.log('  2026-08-17 (Bjorn), same door, file bytes in a disposable copy: `#cz-brief-armaments`');
  console.log('  reclassed `.cz-disc` -> `.cz-group` with the one CSS rule followed so the layout is');
  console.log('  unchanged — this sentence printed PASS, 10/10 anchored across 2 host(s), EXIT 0,');
  console.log('  every other sentence green, and four faces of a host Sunna fixed left the gate in');
  console.log('  silence. The two floors below are the TOTAL loss and the FOLD ROSTER; the PARTIAL');
  console.log('  loss has no floor. Closing it needs a denominator derived from the content door');
  console.log('  (want.faces + want.behind + want.armaments + FOLDED) rather than a typed count, and');
  console.log('  that is a predicate change, not a boundary — it is not made here.');
  // ---------------------------------------------------------------------
  // WIDENED 2026-08-17 by Vira (MR-301). What stood here until this commit was
  // Marina's conditional — RED ONLY FOR THE ROWS IN `FOLDED` — and, below it,
  // Bjorn's paragraph saying that conditional's premise had expired. Both are
  // DELETED rather than amended: the conditional because the thing it excused
  // is now gated, and Bjorn's note because an excuse and the notice that the
  // excuse expired are two copies of one dead fact. What his measurement bought
  // is kept below, as the plant's own numbers, which is where it is checkable.
  // ---------------------------------------------------------------------
  console.log('  WHY IT IS THE WHOLE SCREEN, in one line, because the history is the evidence: the');
  console.log('  gate was ONE ROW until 2026-08-17, scoped there because the rest of the screen');
  console.log('  INHERITED this defect from 334fd02 — true when written, and dead at 50ebb39, where');
  console.log('  Sunna anchored both brief hosts and took that count to 0/13. Bjorn then PROVED the');
  console.log('  gap rather than arguing it: one line reverted in src/ui/components/disclosure.js');
  console.log('  (insertBefore -> appendChild, the literal pre-fix placement), 8/13 and 11/13 adrift');
  console.log('  on the glass, and this tool printed PASS AT EXIT 0. The whole pre-fix tree at');
  console.log('  a05d071 did the same. The gated row survived both because `.cz-fields` holds ONE');
  console.log('  face and one face cannot wrap.');
  console.log('  WATCHED RED at this ref, three roads and both arms: margin-top:12rem on .disc-reveal');
  console.log('  (P15, in flow, EVERY host, first row and last), position:fixed;bottom:0 (P16, the');
  console.log('  panel above its face, EVERY host, first row and last), and Bjorn\'s one-line revert');
  console.log('  (P17, src/ui/components/disclosure.js) — 8/14 adrift at 390x844 and 11/14 at');
  console.log('  1200x730, exit 1, the exact pre-fix reading. A fourth road, watched by hand and not');
  console.log('  in the corpus: .cz-disc{flex-direction:column-reverse}, the same arm as P16.');
  console.log('  P17 CANNOT REDDEN THE FIRST ROW OR THE LAST, and that is arithmetic, not a gap:');
  console.log('  appending puts the panel directly after the last face, which IS under it, and the');
  console.log('  one-face fold host makes appendChild and insertBefore the same call. Those two');
  console.log('  edges are carried by P15 and P16, which reach every host.');
  console.log('  IT IS SILENT on the panel\'s HEIGHT, on whether either is in the viewport, and on');
  console.log('  SCROLL: a panel correctly anchored to a face 900 px down the page is still a panel a');
  console.log('  player has to scroll to find. It is measured LAST, on the screen this run left.');
  // -------------------------------------------------------------------
  // CORRECTED 2026-08-17 by Bjorn, gating MR-301. What stood here said the
  // brief hosts carry the expander's extra face by section 7 and that the
  // face is therefore inside the gate. MEASURED, and it is false: the
  // expander is SHUT again by then. The claim is deleted, and the gap it was
  // hiding is named instead.
  // -------------------------------------------------------------------
  console.log('  AND THE EXPANDED STATE IS NOT IN THE GATE. Section 3 opens the expander, but');
  console.log('  section 6 PICKS a tint, and a pick calls renderPortrait(), which re-runs');
  console.log('  mountDisclosure() on both brief hosts (customize.js) — a full remount that shuts');
  console.log('  the expander. Measured 2026-08-17 (Bjorn): at section 7 aria-expanded is FALSE and');
  console.log('  `#cz-brief-stats` holds its 9 face-tier faces, so `derived:stamina` — a face a');
  console.log('  player reaches — is NEVER anchor-measured on a clean run. 14 is the ARRIVAL');
  console.log('  composition (9 + 4 + 1), not the screen this run left. The corpus already says so');
  console.log('  and nobody read it: under P8 the fold is gone, so no pick lands, so no remount, and');
  console.log('  the same line reads `#cz-brief-stats 10/10` — a DIFFERENT 14. The expander is also');
  console.log('  the state that RE-WRAPS the host, which is the state a placement regression shows');
  console.log('  in worst. UNGATED, and named rather than assumed. `.cz-fields` is untouched by the');
  console.log('  expander either way.');
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
