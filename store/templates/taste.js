// store/templates/taste.js — the store set's open calls, one home.
//
// Sunna signed the set at the floor level (legibility, contrast, thumbnail
// read) and passed four questions on to Constantine as TASTE calls, which are
// his. This file exists so each of his answers is ONE EDIT, not a rebuild:
// every flag below is a named value, every value is already authored and
// renders, and changing one token here plus `node tools/store-assets.mjs`
// re-renders the whole set.
//
// The defaults are exactly what shipped at feature/store-assets 408e20c —
// nothing here changes the set until he says so.
//
// One home, two readers: the templates import it in the browser, and
// tools/store-assets.mjs imports the same file in node (so the tool's report
// can never disagree with what rendered). Do not copy a value out of here.

export const TASTE = {
  // ── 1 ─ THE PLUME ───────────────────────────────────────────────────────
  // Sunna: "reads as a pale cloud-mass at every shelf size, never clearly
  // smoke-from-spire." That is true, and it is a question about intent, not a
  // defect: the mass is the act-1 plate's own sky, seated low.
  //   'cloud' — SHIPPED. The plate rides as ambient weather. Honest about
  //             what it is: atmosphere, not a story beat.
  //   'smoke' — an authored plume rising from the spire's apex: the mass gets
  //             a source, and the silhouette starts telling you the spire
  //             burns. Costs the plate (they fight for the same sky).
  //   'off'   — no raster at all. Pure vector: field, spire, constellation.
  //             The crispest and the emptiest.
  plume: 'cloud',

  // ── 2 ─ THE DESCRIPTOR LINE ─────────────────────────────────────────────
  // Sunna: "smudges below ~200px capsule width, droppable at small."
  // Not a per-file switch: Steam GENERATES the small sizes (462x174 also ships
  // as 184x69 and 120x45 — primary source, /doc/store/assets/standard), so the
  // real rule is about the narrowest width an asset is ever DISPLAYED at. Each
  // asset in tools/store-assets.mjs carries that number; this is the floor it
  // is compared against.
  //   'wide-only' — SHIPPED. Drawn only where the asset is never shown
  //                 narrower than `subtitleMinWidth`.
  //   'always'    — drawn on every capsule (see the RULE note below first).
  //   'never'     — logotype alone, everywhere. The safest reading of Steam's
  //                 content rule, and the quietest composition.
  //
  // RULE, not taste — bring this to him with the flag: Steam limits capsule
  // content to "game artwork, the game name, and any official subtitle" and
  // forbids "other miscellaneous text" (/doc/store/assets/rules, in force
  // since 2022-09-01). "A ROGUELIKE DECKBUILDER" is a genre descriptor, not an
  // official subtitle, unless Constantine declares it part of the title. If he
  // doesn't, the compliant answer is 'never' — on every capsule, not just the
  // small one.
  subtitle: 'wide-only',
  subtitleMinWidth: 200,
  subtitleText: 'A ROGUELIKE DECKBUILDER',

  // ── 3 ─ LIBRARY HEADER ART ──────────────────────────────────────────────
  // Sunna: header-capsule and library-header are byte-identical.
  // Confirmed legitimate at the primary source: "If not set, then the Store
  // Asset Header Capsule is used" (/doc/store/assets/libraryassets) — Steam
  // treats them as the same picture by default, so shipping one twice costs
  // nothing and hides nothing.
  //   'same-as-store' — SHIPPED. One picture, two uploads.
  //   'distinct'      — the branding-forward cut Steam's own guidance
  //                     describes for the library header: wordmark larger and
  //                     seated, constellation off, spire low and quiet. It is
  //                     authored (kind=library-header) — this token is the
  //                     only thing standing between it and the shelf.
  libraryHeader: 'same-as-store',

  // ── 4 ─ THE WORDMARK'S FACE ─────────────────────────────────────────────
  // Sunna: the set ships in the SERIF FALLBACK because this box has no Cinzel.
  // The templates use the game's own --font-display stack, so the store art
  // renders in whatever face the GENERATING machine has — which means the
  // fallback is silent unless something checks. It now checks.
  //   'game'            — SHIPPED. Whatever the stack resolves to, reported by
  //                       name in the tool's output every run.
  //   'cinzel-required' — the tool FAILS (exit 1) if Cinzel is not the face
  //                       that actually rendered. Set this the day Cinzel is
  //                       the intent, and the set can never ship in fallback
  //                       by accident again.
  // Either way the wordmark itself needs re-gating after a face change —
  // Sunna's composition verdicts carry, her wordmark verdict does not.
  displayFont: 'game',

  // ── THE PALETTE ─ a decision, and here is the reasoning ──────────────────
  // Sunna's open question: does the atmospheric palette matter for store art
  // at all, since the capsules ship one palette — decision or accident?
  // DECISION. A capsule is a flat image on someone else's shelf: there is no
  // player, no settings screen, no second state to switch into. The one
  // palette it can carry should be the one first boot shows, and highContrast
  // defaults TRUE (src/settings.js) — so the shelf and the first screen agree.
  // The #45 lesson rides here as a constraint, not a palette: what fails at
  // shelf size is DISTINCTION CARRIED BY COLOUR ALONE, so the store motif says
  // everything with geometry (rings on roads, the climb) and uses colour only
  // to seat it. Switching this to 'atmospheric' is a legal experiment — the
  // dimmer sibling, and it is dimmer by design (map structure 3.77 vs 4.15,
  // measured) — never a fix for anything.
  palette: 'hi-contrast', // 'hi-contrast' | 'atmospheric'
};

// Browser templates load this as a module; expose it for the classic-script
// motif.js neighbours and for anything poking at a rendered page.
if (typeof window !== 'undefined') window.TASTE = TASTE;
