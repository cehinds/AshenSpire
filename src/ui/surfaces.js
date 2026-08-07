// src/ui/surfaces.js — every navigable set, and the join to its handler.
//
// EldenSpire#78. Bjorn found the same defect three times in shipped code:
// VOCABULARY IN DATA, HANDLER IN CODE, NOTHING CHECKING THEY AGREE. A new
// armoury view rendered as hybrid; a new overlay tab showed an empty panel; a
// new settings category was a lone heading. Not one of them errored — the author
// did the data-driven thing correctly and got a broken screen (Law 0 clause 5).
//
// THIS FILE HOLDS NO MEMBERS. That is the whole design. Each row below points at
// the one home its set already has and asks it, at call time, so this table can
// never be a second copy of anything — the failure mode Marina named when she
// refused to split #78: *a new home nobody validates is a second copy waiting
// for its first disagreement.* What lives here is the pair no single file could
// hold: WHAT IS DECLARED and WHAT WILL HANDLE IT.
//
// Two of the three receipts needed no join in the end, and that is the better
// half of the answer:
//
//   armoury views      the handler DISSOLVED. A view row now says what it is
//                      (figure? slots flanking or listed?) and both the screen
//                      and the stylesheet read those. Nothing anywhere knows the
//                      word "grid". `resolve` here only checks the row is
//                      written in the vocabulary the screen actually has.
//   settings categories the DECLARATION dissolved. A category exists because a
//                      row is filed under it. What is still authored is the
//                      order — and an ordered name nothing files under is what
//                      fails below.
//   overlay tabs       neither dissolves, honestly: a panel is code and there is
//                      no vocabulary in which "the deck grid" is a row. So the
//                      tab's id IS the key into PANELS, one name not two, and a
//                      row without its function fails HERE, at boot, by name.
//
// WHAT THIS CANNOT DO, said out loud: it cannot see a fifth navigable set that
// nobody adds a row for. Nothing in a source tree can. That hole is answered on
// the rendered page instead — every set marks its host `data-surface="<id>"` and
// each control `data-member="<member>"`, so an instrument enumerates what the
// game actually drew rather than what it was told to expect.

import { MENU_TABS, MENU } from './uiContent.js';
import { panelFor } from './components/overlay.js';
import { settingsCategories, categoryHandler } from './screens/settings.js';
import { viewIds, viewLayout } from './screens/equipment.js';

// The acts a MENU row may name. A launcher row is dropped when the CONTEXT does
// not offer its act (map has no draw pile — correct), and that drop is why an
// act nobody implements anywhere is invisible: same silence, one file over.
// Membership here is the difference between "not on this screen" and "not a
// word": the first is a design decision, the second is a defect.
export const MENU_ACTS = ['tab', 'armoury', 'legend', 'draw', 'discard', 'save', 'quit', 'close'];

export const SURFACES = [
  {
    id: 'overlayTab',
    of: 'the in-run menu tabs',
    home: 'MENU_TABS in src/ui/uiContent.js',
    members: () => MENU_TABS.map((t) => t.id),
    resolve: (id) => panelFor(id),
    fix: (id) => `add ${JSON.stringify(id)} to PANELS in src/ui/components/overlay.js`,
  },
  {
    id: 'settingsCategory',
    of: 'the settings categories',
    home: 'CATEGORY_ORDER + the rows in src/ui/screens/settings.js',
    members: () => settingsCategories(),
    resolve: (cat) => categoryHandler(cat),
    fix: (cat) => `file something under ${JSON.stringify(cat)} — a row with cat: ${JSON.stringify(cat)},`
      + ' or a SECTIONS entry — or take it out of CATEGORY_ORDER (src/ui/screens/settings.js)',
  },
  {
    id: 'armouryView',
    of: 'the armoury layout views',
    home: 'balance.equipment.views in src/content/balance.js',
    members: () => viewIds(),
    resolve: (id) => viewLayout(id),
    fix: (id) => `give ${JSON.stringify(id)} a layout its row can say:`
      + ' figure: true|false and slots: \'flank\'|\'list\' (src/content/balance.js)',
  },
  {
    id: 'menuAct',
    of: 'the quick-menu launcher acts',
    home: 'the MENU table in src/ui/uiContent.js',
    members: () => [...new Set(Object.values(MENU).flat().map((r) => r.act))],
    resolve: (act) => (MENU_ACTS.includes(act) ? act : null),
    fix: (act) => `${JSON.stringify(act)} is not a launcher act — add it to MENU_ACTS in`
      + ' src/ui/surfaces.js and give every context that offers it a handler,'
      + ' or fix the typo in the MENU row',
  },
];

/**
 * surfaceReport() → one row per navigable set: { id, of, home, members, missing }.
 *
 * Pure, no throwing, so a tool can print the whole picture instead of the first
 * complaint. `missing` is the members with no handler, each with its own fix.
 */
export function surfaceReport() {
  return SURFACES.map((s) => {
    const members = s.members();
    const bad = [];
    // BOTH EDGES. Zero members is not full coverage — it is a home the reader
    // can no longer read, and it is the edge that passes silently in every
    // coverage tool ever written (Bjorn's `views = []` red is the precedent).
    if (!Array.isArray(members) || members.length === 0) {
      bad.push({ member: null, why: 'declares ZERO members', fix: `check ${s.home}` });
    } else {
      const seen = new Set();
      for (const m of members) {
        if (typeof m !== 'string' || !m) {
          bad.push({ member: String(m), why: 'is not a name', fix: `check ${s.home}` });
          continue;
        }
        if (seen.has(m)) {
          bad.push({ member: m, why: 'is declared twice', fix: `check ${s.home}` });
          continue;
        }
        seen.add(m);
        if (!s.resolve(m)) bad.push({ member: m, why: 'has no handler', fix: s.fix(m) });
      }
    }
    return { id: s.id, of: s.of, home: s.home, members, missing: bad };
  });
}

/**
 * assertSurfaces() — throws if any declared surface member has no handler.
 *
 * Called at boot (src/main.js) and by tools/surfaces.mjs. It throws rather than
 * warns because the alternative is what #78 is about: a screen that renders
 * something plausible for a member nobody implemented. A blank screen with a
 * name on it is cheap; a hybrid layout wearing a stranger's id is not.
 */
export function assertSurfaces() {
  const found = surfaceReport().filter((r) => r.missing.length);
  if (!found.length) return;
  const lines = found.flatMap((r) => r.missing.map((m) => `  ${r.id}${m.member ? ` · ${m.member}` : ''}`
    + ` ${m.why} — ${m.fix}`));
  throw new Error(`[surfaces] a navigable surface is declared with no handler (#78):\n${lines.join('\n')}`);
}
