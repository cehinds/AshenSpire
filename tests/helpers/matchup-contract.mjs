import { contentBundle } from '../../src/content/index.js';

// These deliberately small operands define matchup arithmetic, not game balance.
export const matchupRules = () => ({
  counter: { incomingMultiplier: 0.5, retaliationMultiplier: 1.5, retaliationFlat: 5,
    poiseMultiplier: 1.5, guard: 4, ward: 2, defaultDamage: 6,
    meleeBypassDamageTypes: ['force', 'piercing'], meleeIncomingManeuvers: ['attack', 'smash'] },
  smash: { guardedMultiplier: 1.5, guardBreakPoiseBonus: 3 },
  attack: { preparedPoiseMultiplier: 1.5 },
  damageRiders: {
    blunt: { poise: 2 }, piercing: { guardBypass: 2 }, force: { wardDrain: 2 },
    ...Object.fromEntries(Object.entries({ slashing: 'bleed', cold: 'frost', fire: 'burn', lightning: 'weak',
      necrotic: 'crimsonBlight', poison: 'venom', psychic: 'confused', earth: 'slowed' })
      .map(([type, status]) => [type, { status, stacks: 1, requiresHpLoss: true }])),
    holy: { cleanse: 1, requiresHpLoss: true },
  },
  damageAliases: { frost: 'cold', arcane: 'force', sacred: 'holy', decay: 'necrotic', pierce: 'piercing', bludgeoning: 'blunt' },
  tagRiders: { precision: { guardBypass: 4 }, gorefire: { status: 'burn', stacks: 1, requiresHpLoss: true } },
  cleanseStatuses: ['weak', 'frail', 'vulnerable', 'crimsonBlight', 'burn'],
});

const hit = amount => ({ op: 'damage', target: 'enemy', amount });
const status = (id, stacks, extra = {}) => ({ op: 'applyStatus', target: 'enemy', status: id, stacks, ...extra });
const card = (id, effects, tags, extra = {}) => ({
  id, name: id, class: 'colorless', rarity: 'common', type: 'attack', costRule: 'fixed', cost: 1, manaCost: 0,
  damageSchool: 'physical', exposureBuildupPerHit: 0, effects, keywords: [], upgrade: {}, ...extra,
  fixtureTags: ['source:weapon', 'delivery:melee', ...tags],
});
const physical = ['camp:physical', 'maneuver:attack'];
const cards = [
  card('riposte', [hit(4)], ['camp:physical', 'maneuver:counter', 'counter:melee', 'damage:piercing'], { cardRatingValues: { poise: 1 } }),
  card('strike', [hit(6)], physical, { cardRatingValues: { poise: 1 } }),
  card('kilnCleave', [hit(10), status('burn', 4), { op: 'poiseDamage', target: 'enemy', amount: 3 }], ['camp:physical', 'maneuver:smash', 'damage:slashing']),
  card('rimeThrust', [hit(5), status('frost', 3)], [...physical, 'damage:piercing']),
  card('starSpark', [hit(5), status('weak', 1, { if: { p: 'hasStatus', of: 'self', status: 'starstoneCharge' } })],
    ['camp:spell', 'maneuver:casting', 'damage:lightning'], { damageSchool: 'magic' }),
  card('spikedReprisal', [{ op: 'block', target: 'self', amount: 4 }, hit(4), status('bleed', 2)],
    ['camp:physical', 'maneuver:counter', 'counter:melee', 'damage:piercing']),
  card('twinbladeFlurry', [{ ...hit(3), hits: 3 }], [...physical, 'damage:slashing'], { cardRatingValues: { poise: 1 } }),
  card('sacredHarvest', [hit(6)], ['camp:spell', 'maneuver:casting', 'damage:sacred'], { damageSchool: 'arcane' }),
  card('deathblow', [hit(24), { ...hit(10), if: { p: 'hasStatus', of: 'target', status: 'bleed' } },
    { ...hit(10), if: { p: 'hasStatus', of: 'target', status: 'venom' } }], [...physical, 'damage:slashing']),
];
const enemies = [
  { id: 'wanderingSoldier', name: 'Fixture attacker', hp: [100, 100], poiseMax: 20, firstMove: 'slash' },
  { id: 'gildedKnight', name: 'Fixture defender', hp: [100, 100], poiseMax: 20, firstMove: 'parry' },
];
const enemyMoves = [
  { enemyId: 'wanderingSoldier', id: 'slash', intent: 'attack', damage: 8, weight: 1 },
  { enemyId: 'gildedKnight', id: 'parry', intent: 'block', counterDamage: 6, block: 9, weight: 1 },
];
const tagging = [
  ...cards.flatMap(row => ['classification.attack', ...row.fixtureTags].map(tagId => ({ family: 'card', scope: '', objectId: row.id, tagId }))),
  ...enemies.map(row => ({ family: 'enemy', scope: '', objectId: row.id, tagId: 'classification.enemy' })),
  ...enemyMoves.flatMap(row => ['classification.enemyMove', 'camp:physical', 'source:weapon', 'delivery:melee',
    ...(row.id === 'parry' ? ['maneuver:counter', 'counter:melee', 'damage:piercing'] : ['maneuver:attack', 'damage:slashing'])]
    .map(tagId => ({ family: 'enemyMove', scope: row.enemyId, objectId: row.id, tagId }))),
];
const statuses = [
  { id: 'weak', name: 'Weak', stackMode: 'add', decay: 'perTurnEnd', modifiers: { damageDealtMult: 0.75 } },
  { id: 'vulnerable', name: 'Vulnerable', stackMode: 'add', decay: 'perTurnEnd', modifiers: { damageTakenMult: 1.25 } },
  { id: 'frostExposed', name: 'Exposed', stackMode: 'refresh', decay: { duration: 2 },
    taggedVulnerability: { tags: ['starstone'], mult: 1.25, stacking: 'multiplicative' } },
  ...['bleed', 'burn', 'venom', 'frost'].map(id => ({ id, name: id, stackMode: 'add', decay: 'none' })),
  { id: 'starstoneCharge', name: 'Charged', stackMode: 'unique', decay: 'perTurnEnd' },
];

// Unrelated vocabulary stays available, while every operand exercised below is explicit.
export const matchupContent = {
  ...contentBundle,
  cards: cards.map(({ fixtureTags, ...row }) => row),
  enemies: enemies.map(enemy => ({ ...enemy, moves: Object.fromEntries(enemyMoves.filter(move => move.enemyId === enemy.id).map(move => [move.id, move])) })), enemyMoves,
  tagging: [...contentBundle.tagging.filter(row => !['card', 'enemy', 'enemyMove'].includes(row.family)), ...tagging],
  statuses: [...contentBundle.statuses.filter(row => !statuses.some(fixed => fixed.id === row.id)), ...statuses],
  balance: { ...contentBundle.balance, combatMatchups: matchupRules() },
};
