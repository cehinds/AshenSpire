// src/content/retiredNames.js — names this game has retired, and their heirs.
//
// DELIBERATELY NOT in attributes.js. The door this file guards is an OLD COPY
// of the attribute vocabulary coming back wholesale — row, presets and
// sourceStats together, a complete and self-consistent set that would validate
// green on its own (tests/engine.test.js 50b proves that case). A guard cannot
// live in the file whose revert it exists to refuse.
//
// 'vigour' briefly held the HP seat during the D17 implementation.
// Constitution is canonical again under D22. Every run saved in the Vigour
// window spells that name into sote_run_v1 — the allocation plus the
// derived-stat snapshot's hp and stamina sourceStat — so the load door heals
// those saves through this map
// (model/attributes.js, migrateRetiredAttributeNames). At boot, a retired name
// may never return as an attribute id, and every heir must be a live one
// (model/attributes.js, attributeContentProblems).
export const retiredAttributeNames = {
  vigour: 'constitution',
};
