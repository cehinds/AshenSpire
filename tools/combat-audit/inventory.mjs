// Browser-safe inventory. IDs, upgrades, grades and profiles come from registries.
export function auditInventory(registries) {
  const classes = registries.classes.all().map(c => c.id);
  const cards = registries.cards.all();
  const profiles = registries.equipment.basicCardProfiles || [];
  const variants = [];
  for (const classId of classes) for (const card of cards) {
    if (card.class && card.class !== 'colorless' && card.class !== classId) continue;
    const grades = Array.isArray(card.gradeProfiles) ? card.gradeProfiles.map(p => p.rank) : [null];
    const matchedProfiles = profiles.filter(p => p.baseCardId === card.id);
    for (const upgraded of card.upgrade ? [false, true] : [false]) for (const abilityRank of grades) {
      for (const profile of [null, ...matchedProfiles]) {
        const upcasts = [null, ...(card.upcast?.unlockedTiers || [])];
        for (const upcastTier of upcasts) {
          const instance = { cardId: card.id, upgraded, ...(abilityRank !== null ? { abilityRank } : {}), ...(profile ? { profileId: profile.id } : {}) };
          variants.push({ key: [classId, card.id, upgraded ? 'upgraded' : 'base', abilityRank ?? 'legacy', profile?.id || 'authored', upcastTier ?? 'base'].join('/'),
            classId, instance, ...(upcastTier !== null ? { upcastTier } : {}), effects: [...new Set((card.effects || []).map(e => e.op))] });
        }
      }
    }
  }
  const conditions = new Map(), effectOps = new Set();
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (value.op) effectOps.add(value.op);
    if (value.if) conditions.set(JSON.stringify(value.if), value.if);
    Object.values(value).forEach(walk);
  };
  cards.forEach(walk);
  return { classes, cardIds: cards.map(c => c.id), enemyIds: registries.enemies.all().map(e => e.id),
    relicIds: registries.relics.all().map(r => r.id), statusIds: registries.statuses.all().map(s => s.id),
    legacyStanceIds: registries.stances.all().map(s => s.id), profileIds: profiles.map(p => p.id),
    effectOps: [...effectOps].sort(), conditions: [...conditions.values()], variants };
}
