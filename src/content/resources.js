// src/content/resources.js — THE HUD RESOURCE TABLE.
//
// One row per bar. This file is the whole authoring surface for the HUD's
// meters: add a row and a bar appears, in both HUDs or one, at the length its
// max earns. No UI code is touched, ever. (Law 0's falsifier for this feature;
// tools/hudbars.mjs --falsifier runs it against a real row.)
//
// FIELDS
//   id         unique
//   name       the label the player reads
//   glyph      the mark that survives when the bar is too short for words
//   tint       the fill colour (a var(), so accent themes still own the palette)
//   weight     'normal' | 'skinny'  — "poise (very skinny bar)", his words
//   order      top-to-bottom within a surface; HP, Mana, Stamina, then Poise
//   surfaces   ['main'] | ['model'] | both — HIS two-HUD split, as data:
//              main HUD = health, then mana/stamina under it, then poise;
//              under the character models = "really just health and poise"
//   source     WHICH RESOURCE, from the closed set in model/resources.js.
//              A source with no reader is refused at boot, by name.
//   domainMax  OPTIONAL override of the derived ceiling (Law 0 clause 3).
//              Omit it and the ceiling is derived from the content itself.
//   band       OPTIONAL. Rows that share a band render SIDE BY SIDE on one
//              line of the HUD; a row with no band gets a line of its own.
//              The approved hybrid (2026-08-13) puts Mana and Stamina beside
//              each other under Health — that layout is this one word, so a
//              future pool joins their line by writing `band: 'pools'`, not
//              by editing CSS. Grouping is per surface, after the surface
//              filter, in `order` order.
//
// Mana and Stamina are persisted derived pools. Their formulas and ruleset
// version remain authoritative in derivedStats; this table only describes how
// their current/max values are projected into resource surfaces.

// NAMES AND TINTS FOLLOW THE APPROVED HYBRID (claude-family falk-family branch,
// hybrid-confirmation/output/selection-record.json + owners/*.png, approved
// 2026-08-13): the owner pixels label the pools "HP 86/86" / "MP 2/2" /
// "SP 2/2" and paint them #a43c35 / #315c9b / #4d7a45. Mana and Stamina take
// the sampled owner hexes directly — they were already raw hexes here, outside
// the accent-theme swap. Health wears var(--res-hp) — its OWN token, minted
// 2026-08-14 to close the conflict this comment used to carry (owner hex
// #a43c35 vs var(--blood) #8a1a1a): the default IS the owner pixel, and the
// colourblind palette still owns the swap (base.css, cb-safe → vermillion).
// SEAM, stated not hidden: MP and SP are still raw hexes with NO cb-safe
// swap of their own — whether #315c9b / #4d7a45 hold under deuteranopia is
// a call for the Player-experience seat, not silently mine.
export const resources = [
  {
    id: 'stamina',
    name: 'SP',
    glyph: '▲',
    tint: '#4d7a45',
    weight: 'normal',
    order: 30,
    surfaces: ['main'],
    source: 'stamina',
    band: 'pools',
  },
  {
    id: 'mana',
    name: 'MP',
    glyph: '◆',
    tint: '#315c9b',
    weight: 'normal',
    order: 20,
    surfaces: ['main'],
    source: 'mana',
    band: 'pools',
  },
  {
    id: 'hp',
    name: 'HP',
    glyph: '❤',
    tint: 'var(--res-hp)',
    weight: 'normal',
    order: 10,
    surfaces: ['main', 'model'],
    source: 'hp',
  },
  {
    id: 'poise',
    name: 'POISE',
    glyph: '◈',
    tint: 'var(--gold)',
    weight: 'skinny',
    // Last of the stack on the main HUD — under health, and under stamina and
    // mana whenever those arrive, because their `order` will sit between.
    order: 90,
    surfaces: ['main', 'model'],
    source: 'poise',
  },
];
