#!/usr/bin/env node
// tools/surfaces.mjs — is every navigable surface DECLARED IN DATA also HANDLED?
//
// EldenSpire#78. Bjorn found the same defect three times in shipped code while
// looking for something else: vocabulary in data, handler in code, nothing
// checking they agree. A new armoury view rendered as hybrid. A new overlay tab
// showed an empty panel. A new settings category was a lone heading. None of the
// three errored, and that is the whole finding — the author did the data-driven
// thing correctly and got a broken screen in silence (Law 0 clause 5).
//
// WHAT IT ASSERTS, over every row of src/ui/surfaces.js:
//   S0  EVERY HOME CAN BE READ AT ALL — the read is attempted, never trusted, and
//       a home that throws or hands back something that is not a list is a
//       FINDING NAMING THAT HOME, not an exception. S1 counts members; a home
//       that cannot be read never produces one, and on the boot path that was a
//       blank page in the shipped bundle (Vira's P12)
//   S1  EVERY HOME OF THE SET declares at least one member — ZERO IS NOT FULL
//       COVERAGE, it is a home the reader can no longer read (Bjorn's
//       `views = []` red). Per home, not per set: a set with two homes and one
//       guard can lose a whole home and still report coverage (Vira's P8)
//   S2  every member is a name, and no name is declared twice WITHIN ONE HOME —
//       across homes a repeat is the two homes agreeing, which is the point
//   S3  every member RESOLVES to a handler, and the failure names the member
//       and the file to fix
//
// It opens no browser and needs none: this is a join between two lists in the
// source, and the point of the join is that it happens BEFORE anything renders.
// What it therefore cannot tell you is whether the handler it found draws
// anything — that is Bjorn's release-shots, downstream, and both are wanted.
//
// KNOWN-BAD FIRST (development.md SOP 3). `--selftest` plants each breakage in
// memory and prints what went red. A detector that has never been red is not
// evidence. The corpus also carries the breakages this check does NOT yet catch,
// marked OPEN below, so the gap is a failing line rather than a paragraph in a
// review — a finding with no red is a sentence. `--selftest` is therefore RED
// while any of them stands, which is the honest state of the check.
//
// VIKI, folding the gate of 5c49fed: THE TWO OPEN PLANTS NOW GO RED, and the
// plants themselves are byte-identical to Vira's — same expected set, same
// expected member, not one character moved to fit the fix (`git diff f7aab95
// HEAD -- tools/surfaces.mjs` is comments only). 7/7, exit 0. They STAY in the
// corpus, exactly as plants 1–5 did after the defects they name were closed: a
// red that has fired once is the only thing standing between a property and its
// next regression. What her removal condition retires is the OPEN framing above,
// not the lines — and that call is hers to confirm, so I have left her comment
// blocks and her commit whole rather than tidying them into my own words.
//
// VIKI AGAIN, folding her RE-GATE: P8 NOW GOES RED TOO — 8/8. Same discipline,
// and it matters more the second time: her plant block below is untouched, her
// commit is underneath mine with her name on it, and the plants array in this
// file has not changed by one character in either fold. What did change here is
// mine and only mine: the S1/S2 lines above, this paragraph, and the printer,
// which now shows EACH HOME'S OWN COUNT under any set that has more than one.
// That last is not decoration — her breadcrumb is *"watch for a member count
// that goes DOWN while the verdict stays OK"*, and a per-set total is precisely
// the number that cannot show it. Her P8 comment still says the plant MISSes on
// purpose. It no longer does; the sentence is hers to retire, not mine to edit.
//
// Usage:  node tools/surfaces.mjs [--selftest] [--raw]
// Exit:   0 all green · 1 any finding · 2 the harness could not run
//
// REMOVAL CONDITION: delete this file the day navigable sub-surfaces stop being
// declared in data — then there is no declaration to join and nothing to check.

const RAW = process.argv.includes('--raw');
const SELFTEST = process.argv.includes('--selftest');

let mod;
try {
  mod = await import('../src/ui/surfaces.js');
} catch (e) {
  console.log(`RESULT: the surface check could not run — ${e && e.message}.`);
  process.exit(2);
}
const { surfaceReport } = mod;

function findings() {
  return surfaceReport().filter((r) => r.missing.length);
}

function printReport(label) {
  const rows = surfaceReport();
  const total = rows.reduce((n, r) => n + (Array.isArray(r.members) ? r.members.length : 0), 0);
  if (!RAW) {
    console.log(label);
    for (const r of rows) {
      const n = Array.isArray(r.members) ? r.members.length : 0;
      console.log(`  ${r.missing.length ? 'MISS' : ' OK '}  ${r.id} — ${n} member${n === 1 ? '' : 's'} · ${r.home}`);
      // PER-HOME COUNTS, for a set that has more than one home. A total cannot
      // show a home emptying — the union covers for it — which is the whole of
      // Vira's P8. The machine check is S1-per-home in surfaces.js; this is the
      // same fact where a human reading the output can see it move.
      if (r.homes.length > 1) {
        for (const h of r.homes) {
          const k = h.members.length;
          console.log(`          ${k} · ${h.what} — ${h.declares}`);
        }
      }
      for (const m of r.missing) {
        console.log(`        ${m.member ? `${m.member} ` : ''}${m.why} — ${m.fix}`);
      }
    }
  }
  return { rows, total };
}

// ---- the known-bad corpus ---------------------------------------------------
// Each plant mutates ONE home in memory, exactly the way an author would by
// hand, and the check must go red naming that member. The mutations are undone
// after each, so the last thing this file prints is a verdict on the real tree.
async function selftest() {
  const { MENU_TABS } = await import('../src/ui/uiContent.js');
  const { CATEGORY_ORDER } = await import('../src/ui/screens/settings.js');
  const { balance } = await import('../src/content/balance.js');
  const views = balance.equipment.views;
  let savedMenu = null; // P9's stash — see the note at that plant for why it is here

  const plants = [
    ['a 7th row in MENU_TABS (journal) with no panel', 'overlayTab', 'journal',
      () => { MENU_TABS.push({ id: 'journal', label: 'Journal', icon: '✒', tip: 'x' }); },
      () => { MENU_TABS.pop(); }],
    ['a 7th settings category (Lore) with nothing filed under it', 'settingsCategory', 'Lore',
      () => { CATEGORY_ORDER.push('Lore'); },
      () => { CATEGORY_ORDER.pop(); }],
    ['an armoury view written in a word the screen does not have (slots: ring)', 'armouryView', 'grid',
      () => { views[0].slots = 'ring'; },
      () => { views[0].slots = 'flank'; }],
    ['balance.equipment.views emptied — the ZERO-member edge', 'armouryView', null,
      () => { views.__saved = views.splice(0, views.length); },
      () => { views.push(...views.__saved); delete views.__saved; }],
    ['a MENU row naming an act nobody implements', 'menuAct', 'journal',
      async () => { const { MENU } = await import('../src/ui/uiContent.js'); MENU.map.push({ act: 'journal', band: 'body' }); },
      async () => { const { MENU } = await import('../src/ui/uiContent.js'); MENU.map.pop(); }],

    // ---- OPEN, and these two go MISS on purpose (Vira, gate of #78) ---------
    // Both are ONE ROW of data, written entirely in vocabulary this branch
    // declares closed, and both render a broken screen with nothing said. They
    // are here rather than in a report because a finding with no red is a
    // sentence, and the five above are the reason this file is trusted.
    // Delete a line the day its defect is closed — never the day it is argued.
    //
    // P6. The two characteristics are declared closed SEPARATELY, so their
    // PRODUCT is open: figure × slots is four cells and only three exist.
    // `{ figure: false, slots: 'flank' }` passes viewLayout (both values are in
    // VIEW_VOCAB), takes the flank branch — which appends the figure without
    // ever consulting L.figure — and is then hidden entirely by ui.css:784
    // `[data-figure='0'] .armoury-left { display: none }`, whose real predicate
    // is `figure:false AND slots:'list'` and not `figure:false`. Nine of the ten
    // id-naming rules on dev map onto one characteristic; that one maps onto
    // two. Observed at 1200x730, headless chromium: three slot blocks in the DOM
    // and ZERO visible, figure in the DOM and not visible, bodyInk 0 — an empty
    // armoury, no console error, no boot banner. Worse than the defect on dev,
    // where a fourth id at least rendered as hybrid.
    // Closes when the row either draws its slots or fails by NAME at boot.
    ['a view row using only DECLARED words in a combination nothing draws'
      + ' — { figure: false, slots: \'flank\' }', 'armouryView', 'ghost',
      () => { views.push({ id: 'ghost', figure: false, slots: 'flank' }); },
      () => { views.pop(); }],

    // P7. The sixth kind, in the table the fourth kind was found in and one
    // field over. `members()` maps `r.act` and never `r.tab`, so a typo in the
    // tab reference is joined to nothing: menuRows() resolves it to
    // { icon: '', label: '', tip: '' }, quicknav KEEPS the row because act
    // 'tab' is implemented, and the player gets an unlabelled button that opens
    // a tab with no panel. The paper names a fifth kind and argues it out
    // because a context key is authored in CODE; this one is authored in DATA,
    // in the row an author was already editing.
    // Closes when a MENU row's `tab:` is joined to MENU_TABS.
    ['a MENU row whose `tab:` names a tab nobody declares', 'overlayTab', 'jornal',
      async () => { const { MENU } = await import('../src/ui/uiContent.js'); MENU.map.push({ act: 'tab', tab: 'jornal', band: 'body' }); },
      async () => { const { MENU } = await import('../src/ui/uiContent.js'); MENU.map.pop(); }],

    // ---- OPEN, and it goes MISS on purpose (Vira, re-gate of 918a9a8) -------
    //
    // P8. THE EMPTY EDGE WENT OUT WITH THE FIX FOR P7, and it is the same
    // species as the defect that fix closed. `overlayTab.members()` is now the
    // UNION of two homes — MENU_TABS (which DECLARES the strip) and
    // menuTabRefs() (which NAVIGATES to it). That union is right and it is what
    // catches `tab: 'jornal'`. But S1 guards the union, so the set can lose an
    // entire home and still report coverage: empty MENU_TABS and members() is
    // still the five tabs the MENU rows point at, every one of them resolving
    // through PANELS. `RESULT: … 0 declared with no handler`, exit 0, suite 50
    // passed — while the overlay strip declares NOTHING, the folded switcher has
    // nothing, and Law 3's bumper ring has nothing to cycle. The member count
    // drops 6 → 5 and the verdict stays OK: a shrinking denominator with a green
    // verdict, which is the finding this whole card came from.
    //
    // Observed as a REGRESSION, not a standing gap: the identical plant against
    // this branch's own parent 08f1037 prints `declares ZERO members`.
    //
    // The guard's own docstring above still says *"Zero members is not full
    // coverage — it is a home the reader can no longer read (Bjorn's
    // `views = []` red is the precedent)"*. With two homes and one union that
    // sentence is no longer true of this set, and a comment promising a guard
    // the code does not give is how the next reader trusts it.
    //
    // The property, and it is Marina's own mirrored: A GUARD PROVEN OVER ONE
    // HOME MUST BE RE-PROVEN WHEN THE SET GAINS A SECOND. Closes when emptying
    // either home of a multi-home set fails by name — S1 per home rather than
    // per union. I have not written that; the shape of it is `members()`
    // becoming a list of homes, and the choice is the file owner's.
    ['MENU_TABS emptied — the strip declares nothing and the union hides it',
      'overlayTab', null,
      async () => { const { MENU_TABS } = await import('../src/ui/uiContent.js'); MENU_TABS.__saved = MENU_TABS.splice(0, MENU_TABS.length); },
      async () => { const { MENU_TABS } = await import('../src/ui/uiContent.js'); MENU_TABS.push(...MENU_TABS.__saved); delete MENU_TABS.__saved; }],

    // ---- VIKI, folding her re-gate: THE CLASS, NOT THE TAB STRIP ------------
    //
    // Her discharge was *"emptying EITHER home of a multi-home set fails by
    // name"*, and she wrote down in the same breath that `overlayTab` is the
    // first instance of a class rather than a one-off. P8 above proves one home
    // of one set. These three are the rest of that sentence, because the fix I
    // wrote claims all of it and a claim with no red is a sentence.
    //
    // P9. THE OTHER HOME OF THE SAME SET. Delete every `act: 'tab'` row from
    // every context and the quick menu offers no way into any tab at all —
    // while MENU_TABS still declares six and the union is still six. Her plant
    // empties the DECLARING home; this one empties the NAVIGATING home, and
    // "either" is a word a check earns by going red both ways.
    ['every MENU row\'s `tab:` removed — the launcher offers no tab and the union hides it',
      'overlayTab', null,
      async () => {
        const { MENU } = await import('../src/ui/uiContent.js');
        // Stashed in a local, NOT on MENU: `menuAct.members()` maps every value
        // of that object, so a stash hung there becomes a member called
        // `undefined` and the plant would go red for its own bookkeeping.
        savedMenu = {};
        for (const k of Object.keys(MENU)) {
          savedMenu[k] = MENU[k].slice();
          MENU[k] = MENU[k].filter((r) => r.act !== 'tab');
        }
      },
      async () => {
        const { MENU } = await import('../src/ui/uiContent.js');
        for (const k of Object.keys(savedMenu)) MENU[k] = savedMenu[k];
        savedMenu = null;
      }],

    // P10. THE SECOND SET — Vira's seam, and the reason the fix is per home for
    // every row rather than a special case for the tab strip. She swept this one
    // because it cost a command and did not plant it: empty CATEGORY_ORDER, and
    // settingsCategory is STILL SIX MEMBERS AND STILL GREEN, because the
    // categories are derived from the rows and only the ORDER is authored. So
    // the one design decision that screen carries stops existing in silence and
    // Profile drifts behind Advanced. Milder than the tab strip and exactly the
    // same defect — which is how we know it is a class.
    ['CATEGORY_ORDER emptied — the only authored fact about settings, gone quietly',
      'settingsCategory', null,
      () => { CATEGORY_ORDER.__saved = CATEGORY_ORDER.splice(0, CATEGORY_ORDER.length); },
      () => { CATEGORY_ORDER.push(...CATEGORY_ORDER.__saved); delete CATEGORY_ORDER.__saved; }],

    // P11. THE SAME UNION HID A DUPLICATE, and I found this one while writing
    // the fix rather than being handed it. `members()` used to dedupe ACROSS the
    // homes with one `new Set`, which is right — a tab that is declared and also
    // navigated to is the two homes agreeing. But the same Set also deduped
    // WITHIN a home, so S2 ("no name is declared twice") could not fire on this
    // set at all: two `deck` rows in MENU_TABS drew two identical buttons onto
    // one panel and every check was green. Duplicates are now per home for the
    // mirror-image reason that zero members is.
    ['MENU_TABS declaring `deck` twice — two buttons, one panel, and S2 could not see it',
      'overlayTab', 'deck',
      () => { MENU_TABS.push({ id: 'deck', label: 'Deck', icon: '🂠', tip: 'x' }); },
      () => { MENU_TABS.pop(); }],

    // P12. THE READ PATH — Vira again, at the re-gate of 3010a72, and it is her
    // own P8 one keystroke further with a strictly worse outcome. S1 counts
    // members; a home that cannot be READ never produces a member, because the
    // reader dies first. `export const MENU_TABS = null;` threw straight through
    // `main.js:93` and the shipped bundle booted to an EMPTY PAGE — no banner, no
    // message, no game — eleven lines under a comment explaining that this check
    // does not throw on the boot path because *"a throw is the blank screen #77
    // was about."* The intent was right and it was implemented for the findings
    // path only.
    //
    // Her plant is a SOURCE edit (`= null` on a const export). This one is the
    // same defect reachable in memory, and it is an authoring act of the same
    // size: null out one context of the MENU table, the way someone does while
    // commenting a screen's rows out. Two sets read that table, so TWO go red —
    // `overlayTab`'s navigating home and `menuAct`'s only home — which is right,
    // and is the per-home report saying exactly which reads broke.
    ['MENU.map nulled — a home that cannot be READ, which used to blank the page',
      'overlayTab', null,
      async () => {
        const { MENU } = await import('../src/ui/uiContent.js');
        savedMenu = { map: MENU.map };
        MENU.map = null;
      },
      async () => {
        const { MENU } = await import('../src/ui/uiContent.js');
        MENU.map = savedMenu.map;
        savedMenu = null;
      }],
  ];

  let reds = 0;
  console.log('SELFTEST — each plant is one hand edit an author could make:');
  for (const [what, setId, member, plant, undo] of plants) {
    await plant();
    const found = findings();
    const hit = found.find((r) => r.id === setId
      && r.missing.some((m) => (member === null ? m.member === null : m.member === member)));
    console.log(`  ${hit ? 'RED ' : 'MISS'}  ${what}`);
    if (hit) {
      const m = hit.missing.find((x) => (member === null ? x.member === null : x.member === member));
      console.log(`        ${setId}${m.member ? ` · ${m.member}` : ''} ${m.why} — ${m.fix}`);
      reds++;
    }
    await undo();
  }
  const clean = findings();
  console.log(`  ${clean.length ? 'DIRTY' : 'CLEAN'}  the tree after every plant was undone`);
  const ok = reds === plants.length && clean.length === 0;
  console.log(`RESULT: ${reds}/${plants.length} planted breakages went red and the tree came back clean${ok ? '' : ' — IT DID NOT'}.`);
  process.exit(ok ? 0 : 1);
}

if (SELFTEST) await selftest();

const { rows, total } = printReport('SURFACES — every navigable set declared in data:');
const bad = rows.filter((r) => r.missing.length);
const n = bad.reduce((k, r) => k + r.missing.length, 0);
console.log(`RESULT: ${rows.length} navigable sets, ${total} members, ${n} declared with no handler.`);
process.exit(bad.length ? 1 : 0);
