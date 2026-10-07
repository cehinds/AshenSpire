// Modules install definitions and unlock metadata together. Replacing a module
// never requires duplicating its identities in classes.js or a CSV pool.
export function composeProgressionContent(bundle, modules, { rules, unlocks = [], knownModules = modules } = {}) {
  const ownership = bundle.progressionModuleOwnership;
  if (ownership !== undefined && (!ownership || typeof ownership !== 'object' || Array.isArray(ownership)
    || Object.entries(ownership).some(([family, ids]) => !['card', 'feat', 'relic'].includes(family) || !Array.isArray(ids)
      || ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length))) {
    throw new Error('progressionModuleOwnership must contain unique registered card, feat or relic identity arrays');
  }
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
  // Ownership is explicit and retained when composing a subset of installed
  // modules. Only associations of those registered definitions may disappear;
  // an unrelated mistyped reference must still reach content validation.
  const registrations = { card: 'progressionCards', feat: 'progressionFeats', relic: 'progressionRelics' };
  const progressionModuleOwnership = Object.fromEntries(Object.entries(registrations).map(([family, field]) => [family,
    [...new Set([...(bundle.progressionModuleOwnership?.[family] || []), ...knownModules.flatMap(module => (module[field] || []).map(row => row.id))])],
  ]));
  const present = { card: new Set(cards.map(row => row.id)), feat: new Set(feats.map(row => row.id)), relic: new Set(relics.map(row => row.id)) };
  const absent = Object.fromEntries(Object.entries(progressionModuleOwnership).map(([family, ids]) => [family, new Set(ids.filter(id => !present[family].has(id)))]));
  const tagging = bundle.tagging?.filter(row => !absent[row.family]?.has(row.objectId));
  const classMastery = rows;
  const classes = bundle.classes.map(cls => ({ ...cls, cardPool: [...new Set([...cls.cardPool,
    ...classMastery.filter(row => row.classId === cls.id && row.kind === 'cards').map(row => row.ref)])] }));
  const legacyProgression = bundle.legacyProgression || { cards:bundle.cards, relics:bundle.relics, classes:bundle.classes, classSkillFeats:bundle.classSkillFeats, classMastery:bundle.classMastery, equipment:bundle.equipment };
  return { ...bundle, legacyProgression, progressionModuleOwnership, tagging, cards, relics, classes, classSkillFeats: feats, classMastery,
    equipment: {...bundle.equipment,
      cardExposure: bundle.equipment.cardExposure?.filter(row => !absent.card.has(row.cardId)),
      cardEquipmentExceptions:(bundle.equipment.cardEquipmentExceptions || []).filter(row => !absent.card.has(row.cardId) && !['quickstep','backstep','stomp'].includes(row.cardId))},
    balance: { ...bundle.balance, progression: rules } };
}
