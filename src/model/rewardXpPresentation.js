// Presentation only: never awards, spends or claims progression.
export function orderedXpRows(progress) {
  if (!progress) return [];
  const skills = progress.skills || [];
  return [
    ...skills.filter(row => row.kind === 'class'),
    ...(progress.character ? [progress.character] : []),
    ...skills.filter(row => row.kind !== 'class').sort((a, b) => b.level - a.level
      || a.label.localeCompare(b.label) || a.id.localeCompare(b.id)),
  ];
}

// Settings specify the time to fill a complete meter. Partial fills cover
// less distance in less time at the same speed, including successive refills.
export function xpFillDurations(entries, fullMeterMs) {
  const distances = entries.map(({ from, to }) => Math.max(0, Math.min(1, to) - Math.max(0, from)));
  const duration = Number.isFinite(fullMeterMs) ? Math.max(0, fullMeterMs) : 0;
  return distances.map(value => duration * value);
}

// The Core Victory receipt shows only the Character bar, the one labelled with
// the class name (owner, 2026-10-27: "for now disable all but class level").
// Presentation only: every track is still paid, banked and noticed elsewhere.
export const VICTORY_RECEIPT_XP_KINDS = Object.freeze(['character']);

export function scopeXpProgress(progress, kinds = VICTORY_RECEIPT_XP_KINDS) {
  if (!progress) return progress;
  return Object.freeze({
    character: kinds.includes('character') ? progress.character : null,
    skills: Object.freeze((progress.skills || []).filter(row => kinds.includes(row.kind))),
    hidden: 0,
  });
}
