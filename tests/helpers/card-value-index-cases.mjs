import { contentBundle } from '../../src/content/index.js';
const clone = (source) => ({ ...source, ...Object.fromEntries(['balance', 'cards', 'tagging', 'equipment', 'statuses'].map(key => [key, structuredClone(source[key])])) });
// Yield repeated edits to the same live bundle to catch cross-call stale indexes.
export function* cardValueIndexCases() {
  const bundle = clone(contentBundle);
  yield ['real-content', bundle];
  bundle.tagging.push(null, { family: 'card', objectId: 'strike', tagId: 'magic' },
    { family: 'card', objectId: 'strike', tagId: 'magic' }, { family: 'card', objectId: 'strike', tagId: undefined });
  yield ['duplicate-magic-tags-and-null-row', bundle];
  bundle.tagging[bundle.tagging.length - 2].tagId = 'physical';
  bundle.tagging[bundle.tagging.length - 3].objectId = 'guard';
  yield ['same-object-tag-edits', bundle];
  bundle.balance.damage.potencyCards.globalMultiplier = 5;
  bundle.balance.damage.defenseCards.cardBonuses.guard = 17;
  yield ['same-object-formula-edits', bundle];
  const profile = bundle.equipment.basicCardProfiles.find(row => row.damageSchool && row.damageSchool !== 'physical');
  profile.damageSchool = 'physical';
  yield ['same-object-profile-edit', bundle];
  bundle.equipment.armaments[0].weaponCardPackage = {
    fillerAttackProfileId: bundle.equipment.basicCardProfiles.find(row => row.damageSchool !== 'physical')?.id,
    priorityAttackRefs: ['guard', { cardId: 'strike', profileId: profile.id }],
  };
  yield ['priority-card-profiles', bundle];
  bundle.cards.push({ id: 'formula-only-index-case', type: 'attack', cost: 1, manaCost: 0,
    effects: [{ op: 'damage', amount: { f: 'add', args: [1, 2] } }],
    upgrade: { effects: [{ op: 'damage', amount: { f: 'add', args: [4, 5] } }] } });
  yield ['formula-only-and-upgraded-face', bundle];
  bundle.cards.push({ id: 'undefined-tag-index-case', type: 'attack', cost: 1, effects: [{ op: 'damage', amount: 2 }],
    upgrade: { cost: 2, effects: [{ op: 'damage', amount: 7 }] } });
  bundle.tagging.push({ family: 'card', objectId: 'undefined-tag-index-case', tagId: undefined });
  yield ['undefined-authored-tag', bundle];
  for (const value of [null, [], 3, 'bad']) {
    const broken = clone(bundle);
    broken.balance.damage.attackCards.cardBonuses = value;
    broken.balance.damage.defenseCards.statusMultipliers = value;
    yield [`malformed-value-containers-${JSON.stringify(value)}`, broken];
  }
  yield ['missing-tagging', { ...bundle, tagging: null }];
  yield ['malformed-tagging', { ...bundle, tagging: {} }];
  yield ['malformed-profile-container', { ...bundle, equipment: { ...bundle.equipment, basicCardProfiles: {} } }];
  yield ['malformed-profile-row', { ...bundle, equipment: { ...bundle.equipment, basicCardProfiles: [null] } }];
  yield ['empty-cards-with-malformed-tagging', { ...bundle, cards: [], tagging: {} }];
  yield ['both-malformed-profile-and-tagging', { ...bundle, tagging: {}, equipment: { ...bundle.equipment, basicCardProfiles: [null] } }];
  yield ['missing-config', { ...bundle, balance: { ...bundle.balance, damage: null } }];
}

// Pin affected outputs, allowing unrelated relic/event/art content to evolve.
export function cardValueOracleOutput(method, result) {
  if (method === 'materializeCardValueBonuses') return result.balance?.damage;
  if (method === 'projectAttackCardDamageBundle') return result.cards;
  return result;
}
