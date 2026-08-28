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
//              main HUD = health, then mana, then stamina. Poise is NOT in the
//              top HUD; in combat it remains on the player character card.
//              under the character models = "really just health and poise"
//   source     WHICH RESOURCE, from the closed set in model/resources.js.
//              A source with no reader is refused at boot, by name.
//   domainMax  OPTIONAL override of the derived ceiling (Law 0 clause 3).
//              Omit it and the ceiling is derived from the content itself.
//              HP, Mana and Stamina set it from HUD_REFERENCE_MAX below —
//              his 200/50, one home. Poise omits it and stays derived.
//   band       OPTIONAL for other surfaces/content. The canonical main HUD does
//              not use it: HP, MP and SP each own a vertical row, in that order.
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
/**
 * THE REFERENCE SCALE — HIS RULING, 2026-08-22, AND IT LIVES HERE ALONE.
 *
 * Constantine: **200 HP / 50 MP / 50 SP**. A bar's
 * TROUGH is `scale(max) / scale(reference)` of its track, so these two numbers
 * are the whole of what a full bar looks like. Change them here and nowhere
 * else: the rows below point at them, `resourceDomains()` reads the row, and no
 * render path types a ceiling.
 *
 * REMOVAL CONDITION (SOP 1's corollary): deleted the day the trough stops
 * encoding a maximum, or the day max-HP progression reaches this band and the
 * reference becomes the derived ceiling again (drop `domainMax` from the rows
 * and `resourceDomains()` derives from content, which is what it does today for
 * poise).
 */
export const HUD_REFERENCE_MAX = Object.freeze({
  /** Health's upper reference. His number. */
  hp: 200,
  /** Every pool's upper reference — Mana and Stamina share it. His number. */
  pool: 50,
});

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
    domainMax: HUD_REFERENCE_MAX.pool,
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
    domainMax: HUD_REFERENCE_MAX.pool,
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
    domainMax: HUD_REFERENCE_MAX.hp,
  },
  {
    id: 'poise',
    name: 'POISE',
    glyph: '◈',
    tint: 'var(--gold)',
    weight: 'skinny',
    // Combat-only dynamic meter on the player character card; never top HUD.
    order: 90,
    surfaces: ['model'],
    source: 'poise',
  },
];
