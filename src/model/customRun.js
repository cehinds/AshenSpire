// src/model/customRun.js — whether a run carries a non-default rule, so the
// history flags it and the win-rate telemetry leaves it out. Core ships one
// climb; a dealt (Sealed or Draft) deck or a pinned first seat qualifies
// (SPEC §13.4). A save started under the retired Custom Climb keeps its
// ascension, mods or map shape, so those still mark it custom.
export function isCustomRun(custom) {
  if (!custom) return false;
  if (custom.deckMode && custom.deckMode !== 'standard') return true;
  if (custom.firstSeat) return true;
  if (custom.ascension > 0) return true;
  if (custom.mapShape && Object.keys(custom.mapShape).length) return true;
  return !!(custom.mods && Object.values(custom.mods).some(Boolean));
}
