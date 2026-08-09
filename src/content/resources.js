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
//   order      top-to-bottom within a surface; health first, his row order
//   surfaces   ['main'] | ['model'] | both — HIS two-HUD split, as data:
//              main HUD = health, then stamina/mana under it, then poise;
//              under the character models = "really just health and poise"
//   source     WHICH RESOURCE, from the closed set in model/resources.js.
//              A source with no reader is refused at boot, by name.
//   domainMax  OPTIONAL override of the derived ceiling (Law 0 clause 3).
//              Omit it and the ceiling is derived from the content itself.
//
// WHY THERE IS NO stamina OR mana ROW HERE
// He asked for both. Neither exists: `stamina` matches 0 times in src/, and all
// 9 matches for `mana` are the word "manager". There is no stat system to derive
// them from either (constitution 0, charisma 0). Writing the rows anyway would
// put two troughs on his screen that read 0/0 for the rest of the project, which
// is worse than an absent bar because it looks finished. The rows below are the
// resources the game actually has; the machinery is built so that the day
// stamina exists on the combat entity it is one reader + one row, and the
// screenshot of what that looks like is in the report rather than in the tree.

export const resources = [
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
