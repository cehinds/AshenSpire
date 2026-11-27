// Small formula/index operands, independent of today's authored catalogs.
export function cardValueContract() {
  const config = () => ({ globalMultiplier: 1, actionCostMultiplier: 2, manaCostMultiplier: 3,
    staminaCostMultiplier: 5, statusEffectReductionMultiplier: 1, statusMultipliers: { poison: 2 }, cardBonuses: {} });
  return {
    balance: { damage: Object.fromEntries(['attackCards', 'defenseCards', 'potencyCards', 'poiseCards', 'wardCards'].map(key => [key, config()])) },
    statuses: [{ id: 'poison' }], tagging: [],
    equipment: { basicCardProfiles: [{ id: 'magic', baseCardId: 'strike', damageSchool: 'magic' }], armaments: [{}] },
    cards: [
      { id: 'strike', type: 'attack', cost: 1, manaCost: 0, effects: [{ op: 'damage', amount: 4 }],
        upgrade: { cost: 3, effects: [{ op: 'damage', amount: 7 }] } },
      { id: 'guard', type: 'skill', cost: 1, effects: [{ op: 'block', amount: 3 }] },
      { id: 'spell', type: 'attack', cost: 1, manaCost: 1, effects: [{ op: 'damage', amount: 6 }] },
    ],
  };
}
// Repeated edits to one object catch stale cross-call indexes.
export function* cardValueIndexCases() {
  const bundle = cardValueContract();
  yield ['controlled', bundle];
  bundle.tagging.push(null, { family: 'card', objectId: 'strike', tagId: 'magic' },
    { family: 'card', objectId: 'strike', tagId: 'magic' }, { family: 'card', objectId: 'strike', tagId: undefined });
  yield ['duplicate-magic-tags-and-null-row', bundle];
  bundle.tagging[1].objectId = 'guard'; bundle.tagging[2].tagId = 'physical';
  yield ['same-object-tag-edits', bundle];
  bundle.balance.damage.potencyCards.globalMultiplier = 5;
  bundle.balance.damage.defenseCards.cardBonuses.guard = 17;
  yield ['same-object-formula-edits', bundle];
  bundle.equipment.basicCardProfiles[0].damageSchool = 'physical';
  yield ['same-object-profile-edit', bundle];
  bundle.equipment.basicCardProfiles.push({ id: 'otherMagic', damageSchool: 'magic' });
  bundle.equipment.armaments[0].weaponCardPackage = { fillerAttackProfileId: 'otherMagic', priorityAttackRefs: ['strike', { cardId: 'spell', profileId: 'magic' }] };
  yield ['priority-card-profiles', bundle];
}
export function cardValueOracleOutput(method, result) {
  if (method === 'materializeCardValueBonuses') return result.balance?.damage;
  if (method === 'projectAttackCardDamageBundle') return result.cards;
  return result;
}
