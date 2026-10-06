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
