/** The one owner-scoped gate for an explicit, targeted proposal read. */
export function proposalIntentRevealUntil(enemy, ownerId, turn, { legacySolo = false } = {}) {
  if (!Number.isFinite(turn) || typeof ownerId !== 'string' || !ownerId) return null;
  const scoped = Number(enemy?.proposalIntentRevealedUntilByOwner?.[ownerId]);
  if (Number.isFinite(scoped) && scoped > turn) return scoped;
  // Older solo snapshots used one global deadline. Never apply that fallback
  // in co-op, where it would disclose one observer's read to every seat.
  if (legacySolo && !enemy?.proposalIntentRevealedUntilByOwner) {
    const legacy = Number(enemy?.proposalIntentRevealedUntil);
    if (Number.isFinite(legacy) && legacy > turn) return legacy;
  }
  return null;
}
