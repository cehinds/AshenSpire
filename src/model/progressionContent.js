// Modules install definitions and unlock metadata together. Replacing a module
// never requires duplicating its identities in classes.js or a CSV pool.
export function composeProgressionContent(bundle, modules, { rules, unlocks = [] } = {}) {
  const cards = [...bundle.cards], relics = [...bundle.relics], feats = [...bundle.classSkillFeats];
  const rows = [...unlocks];
  for (const module of modules) {
    cards.push(...(module.progressionCards || []));
    relics.push(...(module.progressionRelics || []));
    feats.push(...(module.progressionFeats || []));
    rows.push(...(module.progressionCardUnlocks || []), ...(module.progressionFeatUnlocks || []), ...(module.progressionRelicUnlocks || []));
    for (const update of module.abilityCardUpdates || []) {
      const at = cards.findIndex(card => card.id === update.id);
      if (at < 0) throw new Error(`Ability update names unknown card '${update.id}'`);
      cards[at] = { ...cards[at], ...update };
    }
  }
  const unique = new Map(rows.map(row => [`${row.classId}:${row.level}:${row.kind}:${row.ref}`, row]));
  const classMastery = [...unique.values()];
  const classes = bundle.classes.map(cls => ({ ...cls, cardPool: [...new Set([...cls.cardPool,
    ...classMastery.filter(row => row.classId === cls.id && row.kind === 'cards').map(row => row.ref)])] }));
  const legacyProgression = bundle.legacyProgression || { cards:bundle.cards, relics:bundle.relics, classes:bundle.classes, classSkillFeats:bundle.classSkillFeats, classMastery:bundle.classMastery, equipment:bundle.equipment };
  return { ...bundle, legacyProgression, cards, relics, classes, classSkillFeats: feats, classMastery,
    equipment: {...bundle.equipment,cardEquipmentExceptions:(bundle.equipment.cardEquipmentExceptions || []).filter(row => !['quickstep','backstep','stomp'].includes(row.cardId))},
    balance: { ...bundle.balance, progression: rules } };
}
