// src/model/customRun.js — whether a run carries a non-default rule, so the
// history flags it and the win-rate telemetry leaves it out. Core ships one
// climb; only a dealt (Sealed or Draft) deck or a pinned first seat still
// qualifies (SPEC §13.4).
export function isCustomRun(custom) {
  if (!custom) return false;
  if (custom.deckMode && custom.deckMode !== 'standard') return true;
  return !!custom.firstSeat;
}
