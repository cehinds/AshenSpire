// Tactical defenses can change between hits. Preserve compact multiplication
// only when every predicted hit has the same amount.
export function variableIntentDamage(intent) {
  if (!intent || intent.hidden || intent.kind === 'unknown' || intent.moveId === null) return null;
  const hits = intent.hitDamages;
  if (!Array.isArray(hits) || hits.length < 2
    || hits.some(amount => !Number.isFinite(amount) || amount < 0)
    || hits.every(amount => amount === hits[0])) return null;
  return { text: hits.join(' + '), compactText: hits.join('+'),
    totalDamage: hits.reduce((sum, amount) => sum + amount, 0) };
}
