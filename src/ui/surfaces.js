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
//                      written in the vocabulary the screen actually has — and
//                      THAT VOCABULARY IS THE COMBINATION, not each field.
//                      Declaring two characteristics closed separately left a
//                      cell of their product legal and undrawn, which rendered
//                      an EMPTY armoury in silence (Vira, gate of 5c49fed).
//                      A closed set must stay closed under whatever
//                      factorisation replaces it — Marina, and it is house-wide.
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
// game actually drew rather than what it was told to expect. ALL FOUR SETS MARK
// THEMSELVES NOW; `menuAct` did not, and it was the one set whose worst edge —
// an act declared here that no context implements — is ONLY visible on the page.
// The attributes are a CONVENTION, not a derivation: a set nobody registers is a
// set nobody marks, and nothing checks the two agree. Saying so is the point.
//
// ---- A SET IS A LIST OF HOMES (Vira, re-gate of #78) ------------------------
//
// The first pass gave each row ONE `members()` and one prose `home`. When
// `overlayTab` grew a second home — MENU_TABS DECLARES the strip, a MENU row's
// `tab:` NAVIGATES to it — `members()` quietly became a union of the two and the
// zero-member guard was left counting the union. So an entire home could go
// empty and the check still reported full coverage: `MENU_TABS = []` and the tab
// strip declares nothing, the folded switcher has nothing, Law 3's bumper ring
// has nothing to cycle, and the member count drops 6 → 5 with the verdict `OK`.
// A SHRINKING DENOMINATOR WITH A GREEN VERDICT. Vira's property, and it is
// Marina's own one turn on:
//
//     A GUARD PROVEN OVER ONE HOME MUST BE RE-PROVEN WHEN THE SET GAINS A SECOND.
//
// So a row no longer says where its members come from in prose beside a function
// that goes and gets them. IT LISTS ITS HOMES, each with its own `members()`,
// and BOTH the member list and the `home` sentence are DERIVED from that list.
// The guard runs per home. This is written for the class rather than for the tab
// strip — `armouryView` and `menuAct` have one home each today and are the same
// shape, so the day either of them is widened the guard widens with it and
// nobody has to remember. A one-home set behaves exactly as it did.
//
// The line it draws is Law 0 clause 2 in miniature: THE HOMES ARE THE
// VOCABULARY AND THE MEMBERS ARE THE DATA. Emptying a home is a data edit and
// must fail by name; removing a home is a code edit here, reviewed like any
// other word. That is why "every declared home declares at least one member" is
// not too strict — the alternative is a home that exists in this file and
// nowhere else, which is the second copy this table was built to refuse.

import {
  MENU_TABS, MENU, MENU_ACTS, menuTabRefs,
} from './uiContent.js';
import { panelFor } from './components/overlay.js';
import { filedCategories, CATEGORY_ORDER, categoryHandler } from './screens/settings.js';
import { viewIds, viewLayout, viewCellsSay } from './screens/equipment.js';

export const SURFACES = [
  {
    id: 'overlayTab',
    // A MEMBER IS A TAB THE GAME CAN BE PUT INTO, not a row of MENU_TABS —
    // Vira's sixth kind, and the second half of the day's lesson. `MENU_TABS`
    // DECLARES the strip; a MENU row saying `tab: 'jornal'` NAVIGATES to one,
    // and members() read only the first home. A one-character typo there
    // resolved to { icon:'', label:'', tip:'' }, was KEPT by quicknav's filter
    // because `act:'tab'` is implemented, and gave the player an unlabelled
    // button onto a tab with no panel. Where a declaration lives in two homes,
    // the member list is the union of both — and `fix` below tells them apart,
    // because naming the wrong entry is worse than naming none (Law 1 cl. 5).
    of: 'the in-run menu tabs — declared by MENU_TABS, navigated to by MENU rows',
    from: [
      {
        what: 'MENU_TABS',
        file: 'src/ui/uiContent.js',
        declares: 'the tab strip, the folded switcher and the bumper ring',
        members: () => MENU_TABS.map((t) => t.id),
      },
      {
        what: 'every MENU row\'s tab:',
        file: 'src/ui/uiContent.js',
        declares: 'the quick-menu rows that navigate to a tab',
        members: () => menuTabRefs(),
      },
    ],
    resolve: (id) => panelFor(id),
    fix: (id) => (MENU_TABS.some((t) => t.id === id)
      ? `add ${JSON.stringify(id)} to PANELS in src/ui/components/overlay.js`
      : `no MENU_TABS row declares ${JSON.stringify(id)} — a MENU row's \`tab:\` names it.`
        + ` Fix that row, or declare the tab: MENU_TABS has ${MENU_TABS.map((t) => t.id).join(', ')}`
        + ' (src/ui/uiContent.js)'),
  },
  {
    id: 'settingsCategory',
    of: 'the settings categories',
    // Two homes, and only one of them is authored by a human — which is exactly
    // why the union hid it. Emptying CATEGORY_ORDER left all six categories
    // present (they are DERIVED from the rows), the verdict green, and the one
    // design decision this screen carries silently gone, with Profile drifting
    // behind Advanced. Milder than the tab strip and the same defect, which is
    // how we know the per-home guard is the class and not a patch.
    from: [
      {
        what: 'CATEGORY_ORDER',
        file: 'src/ui/screens/settings.js',
        declares: 'the order the headings are drawn in — the authored half',
        members: () => CATEGORY_ORDER,
      },
      {
        what: 'the rows',
        file: 'src/ui/screens/settings.js',
        declares: 'a heading exists because something is filed under it',
        members: () => filedCategories(),
      },
    ],
    resolve: (cat) => categoryHandler(cat),
    fix: (cat) => `file something under ${JSON.stringify(cat)} — a row with cat: ${JSON.stringify(cat)},`
      + ' or a SECTIONS entry — or take it out of CATEGORY_ORDER (src/ui/screens/settings.js)',
  },
  {
    id: 'armouryView',
    of: 'the armoury layout views',
    from: [
      {
        what: 'balance.equipment.views',
        file: 'src/content/balance.js',
        declares: 'every view the armoury header offers',
        members: () => viewIds(),
      },
    ],
    resolve: (id) => viewLayout(id),
    // The fix ENUMERATES THE CELLS, never the factors. Saying "figure:
    // true|false and slots: 'flank'|'list'" is what promised a product of two
    // closed sets and delivered three of its four cells.
    fix: (id) => `give ${JSON.stringify(id)} a combination the screen has —`
      + ` ${viewCellsSay()} — in src/content/balance.js.`
      + ' A new combination is a new LAYOUT (a key in LAYOUTS + its rule in'
      + ' styles/ui.css), not a new row.',
  },
  {
    id: 'menuAct',
    of: 'the quick-menu launcher acts',
    from: [
      {
        what: 'the MENU table',
        file: 'src/ui/uiContent.js',
        declares: 'every act a launcher row names, in every context',
        // Deduped INSIDE the home: `act: 'tab'` is meant to appear on many rows,
        // so a repeat here is the table working. Across homes the duplicate
        // check is off for the same reason; within a home it is on.
        members: () => [...new Set(Object.values(MENU).flat().map((r) => r.act))],
      },
    ],
    // MENU_ACTS now lives with the MENU table it governs, not here. This file's
    // header promises it holds no members and this row held eight of them —
    // *the fix for label drift carrying label drift* (Marina). The list is still
    // hand-kept, and what that does and does not catch is stated at its new home.
    resolve: (act) => (MENU_ACTS.includes(act) ? act : null),
    fix: (act) => `${JSON.stringify(act)} is not a launcher act — add it to MENU_ACTS in`
      + ' src/ui/uiContent.js and give every context that offers it a handler,'
      + ' or fix the typo in the MENU row',
  },
];

/** One home, named the way a person would say it: `MENU_TABS in src/ui/…`. */
function homeOf(h) {
  return `${h.what} in ${h.file}`;
}

/**
 * attempt(fn) → { ok: true, value } | { ok: false, why } — every call this join
 * makes into somebody else's file, made so that it cannot kill the reader.
 *
 * THIS IS THE READ PATH, and it is the half the first fold left out (Vira,
 * re-gate of 3010a72). `surfaceReport()` is called bare on the boot path, and
 * `main.js` says eleven lines above that call why it does not throw there:
 * *"on the boot path a throw is the blank screen #77 was about."* That intent
 * was implemented for the FINDINGS path only. A home that cannot be READ never
 * reaches a finding, because the reader dies first — so
 * `export const MENU_TABS = null;` produced no banner, no message, and an empty
 * page in the artifact a player downloads. Law 1 clause 5, in its own words:
 * a failure that dies before the validator runs is still this clause's.
 *
 * WHY IT IS HERE AND NOT SIX GUARDS. `viewIds()` guards its own read and the
 * other five homes do not, which is the inconsistency that let this through.
 * The cure is not to copy that guard five times — five copies of one guard is
 * the defect this table exists to refuse, and `(x || [])` only answers `null`
 * anyway, not a getter that throws or a table that is a string. **A home that
 * cannot be read is a FACT ABOUT THE HOME**, so it belongs where every other
 * fact about a home now lives: in the per-home report, named, alongside
 * *declares ZERO members*. One guard, at the one place that reads homes,
 * covering every shape of unreadable rather than the one shape someone guessed.
 *
 * And it wraps `resolve` and `fix` for the same reason, unasked: the finding was
 * about `members()`, but the join makes three calls into other files per member
 * and all three are on the boot path. Fixing the instance and leaving the class
 * is the move that has cost this branch two gates already.
 */
function attempt(fn) {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    return { ok: false, why: (e && e.message) || String(e) };
  }
}

/**
 * The set's `home` sentence, DERIVED from its homes — never typed beside them.
 *
 * It used to be a string on the row, which is how `overlayTab` came to carry a
 * hand-written "MENU_TABS + every MENU row's tab:" that nothing kept in step
 * with the function that actually read them. The four sentences this produces
 * are byte-identical to the four that were typed, which is the point: the fact
 * did not change, its second copy went away.
 */
function homeLine(from) {
  const files = [...new Set(from.map((h) => h.file))];
  if (files.length === 1) return `${from.map((h) => h.what).join(' + ')} in ${files[0]}`;
  return from.map(homeOf).join(' + ');
}

/**
 * surfaceReport() → one row per navigable set:
 * { id, of, home, homes, members, missing }.
 *
 * Pure, no throwing, so a tool can print the whole picture instead of the first
 * complaint. `homes` is the per-home breakdown with each home's own member list;
 * `members` is the union across them, in authored order, deduped. `missing` is
 * every finding, each with its own fix.
 *
 * BOTH EDGES, AND THE ZERO EDGE IS PER HOME. Zero members is not full coverage —
 * it is a home the reader can no longer read (Bjorn's `views = []` red is the
 * precedent), and once a set has two homes, "the set has members" stops being
 * that check. A union is a NEW SET, and every property proved about the old one
 * is `unknown` until re-observed (Vira, re-gate of #78, who caught this file
 * promising the guard in a docstring it no longer gave).
 *
 * DUPLICATES ARE PER HOME TOO, and for the mirror-image reason: the same tab
 * appearing in MENU_TABS *and* in a MENU row's `tab:` is the two homes agreeing,
 * which is correct and common. The same name twice INSIDE one home is a defect —
 * and the old union deduped it away before anything could look.
 *
 * "PURE, NO THROWING" IS NOW TRUE RATHER THAN INTENDED. Every call out of this
 * function goes through `attempt()`; see its note. A home has three honest
 * outcomes and each is a finding that names the home:
 *
 *   could not be read      the read threw    — `MENU_TABS = null`
 *   did not return a list  the read is not an array — `CATEGORY_ORDER = 'Display'`
 *   declares ZERO members  the read is empty — `MENU_TABS = []`
 *
 * They are three sentences and not one because they are three different edits,
 * and *naming the wrong entry is worse than naming none* (Law 1 clause 5) reads
 * on the failure mode as much as on the member.
 */
export function surfaceReport() {
  return SURFACES.map((s) => {
    const bad = [];
    const members = [];
    const union = new Set();
    const homes = s.from.map((h) => {
      const got = attempt(h.members);
      if (!got.ok) {
        bad.push({
          member: null,
          why: `could not be read in ${h.what} — ${got.why}`,
          fix: `check ${homeOf(h)}`,
        });
        return { ...h, members: [] };
      }
      if (!Array.isArray(got.value)) {
        bad.push({
          member: null,
          why: `did not return a list of members in ${h.what} — got ${got.value === null ? 'null' : typeof got.value}`,
          fix: `check ${homeOf(h)}`,
        });
        return { ...h, members: [] };
      }
      const list = got.value;
      if (list.length === 0) {
        bad.push({
          member: null,
          why: `declares ZERO members in ${h.what}`,
          fix: `check ${homeOf(h)}`,
        });
        return { ...h, members: [] };
      }
      const here = new Set();
      for (const m of list) {
        if (typeof m !== 'string' || !m) {
          bad.push({ member: String(m), why: 'is not a name', fix: `check ${homeOf(h)}` });
          continue;
        }
        if (here.has(m)) {
          bad.push({ member: m, why: `is declared twice in ${h.what}`, fix: `check ${homeOf(h)}` });
          continue;
        }
        here.add(m);
        if (!union.has(m)) { union.add(m); members.push(m); }
      }
      return { ...h, members: list };
    });
    // The handler join is over the UNION: a tab declared in one home and
    // navigated to from the other needs exactly one panel, not two.
    //
    // `resolve` and `fix` are on the boot path exactly as `members` is, so they
    // get the same treatment. A `fix` message that throws must never be able to
    // swallow the finding it was describing — the finding survives, in plainer
    // words, and says that it did.
    for (const m of members) {
      const got = attempt(() => s.resolve(m));
      if (!got.ok) {
        bad.push({ member: m, why: `could not be resolved — ${got.why}`, fix: `check ${homeLine(s.from)}` });
        continue;
      }
      if (got.value) continue;
      const say = attempt(() => s.fix(m));
      bad.push({
        member: m,
        why: 'has no handler',
        fix: say.ok ? say.value : `check ${homeLine(s.from)} — and its fix message threw: ${say.why}`,
      });
    }
    return { id: s.id, of: s.of, home: homeLine(s.from), homes, members, missing: bad };
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
