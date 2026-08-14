// src/content/retiredNames.js — names this game has retired, and their heirs.
//
// DELIBERATELY NOT in attributes.js. The door this file guards is an OLD COPY
// of the attribute vocabulary coming back wholesale — row, presets and
// sourceStats together, a complete and self-consistent set that would validate
// green on its own (tests/engine.test.js 50b proves that case). A guard cannot
// live in the file whose revert it exists to refuse.
//
// 'constitution' held the HP seat for three days (d465cfc, 2026-08-11 →
// 2026-08-14). Constantine's stat line names Vigour (D17: "vigour shoudl be
// 1 hp point per"). Every run saved in that window spells the old name into
// sote_run_v1 — the allocation plus the derived-stat snapshot's hp and stamina
// sourceStat — so the load door heals those saves through this map
// (model/attributes.js, migrateRetiredAttributeNames). At boot, a retired name
// may never return as an attribute id, and every heir must be a live one
// (model/attributes.js, attributeContentProblems).
export const retiredAttributeNames = {
  constitution: 'vigour',
};
