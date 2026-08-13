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
//
// Mana and Stamina are persisted derived pools. Their formulas and ruleset
// version remain authoritative in derivedStats; this table only describes how
// their current/max values are projected into resource surfaces.

export const resources = [
  {
    id: 'stamina',
    name: 'STAMINA',
    glyph: '▲',
    tint: '#4f9b62',
    weight: 'normal',
    order: 30,
    surfaces: ['main'],
    source: 'stamina',
  },
  {
    id: 'mana',
    name: 'MANA',
    glyph: '◆',
    tint: '#3f73c9',
    weight: 'normal',
    order: 20,
    surfaces: ['main'],
    source: 'mana',
  },
  {
    id: 'hp',
    name: 'HEALTH',
    glyph: '❤',
    tint: 'var(--blood)',
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
