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
//   S1  the set declares at least one member — ZERO IS NOT FULL COVERAGE, it is
//       a home the reader can no longer read (Bjorn's `views = []` red)
//   S2  every member is a name, and no name is declared twice
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
