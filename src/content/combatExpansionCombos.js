// Version-2 combination cards. Conditional riders and hook budgets use the
// shared interpreter; no card ids are selected by the combat engine.
const has = (status, of = 'self') => ({ p: 'hasStatus', of, status });
const row = (id, name, cost, type, tags, effects, textTemplate, extra = {}) => ({
  id, name, class: 'colorless', rarity: 'uncommon', cost, manaCost: 0, type,
  keywords: [], tags, effects, textTemplate, minCombatExpansionVersion: 2, ...extra,
});
const spell = school => ['camp:spell', `school:${school}`, 'reach:contact', 'targeting:single'];
const locks = ['sleep', 'paralysis', 'dazed'];

export const combatExpansionCombos = [
  row('dreamHarvest', 'Dream Harvest', 1, 'skill', spell('illusion'),
    [{ op: 'draw', amount: 1, if: has('sleep', 'allEnemies'), oncePerTurn: 'dream-harvest' }],
    'While an enemy is asleep, draw {draw} card. Once per turn; does not wake it.'),
  row('lucidRecovery', 'Lucid Recovery', 2, 'skill', spell('illusion'),
    [{ op: 'removeStatus', target: 'self', status: 'sleep', amount: 1 },
      { op: 'gainBarrier', target: 'self', amount: 2, if: { ...has('sleep'), snapshot: 'beforePlay' } }],
    'Break {removeStatus} Sleep. If asleep when played, gain {gainBarrier} Barrier.', { usableWhile: locks }),
  row('groundedResolve', 'Grounded Resolve', 3, 'skill', spell('alteration'),
    [{ op: 'removeStatus', target: 'self', status: 'paralysis', amount: 1 },
      { op: 'applyStatus', target: 'self', status: 'grounded', stacks: 1, if: { ...has('paralysis'), snapshot: 'beforePlay' } }],
    'Break {removeStatus} Paralysis. If paralyzed when played, gain {grounded} Grounded.', { usableWhile: locks }),
  row('clearHead', 'Clear Head', 1, 'skill', ['camp:physical', 'reach:contact', 'targeting:single'],
    [{ op: 'removeStatus', target: 'self', status: 'dazed', amount: 1 },
      { op: 'grantRollMode', target: 'self', roll: 'evade', advantage: true, oncePerTurn: 'clear-head', if: { ...has('dazed'), snapshot: 'beforePlay' } }],
    'Clear {removeStatus} Dazed. If Dazed when played, your next Evade has Advantage. Once per turn.', { usableWhile: locks }),
  row('lowGuardRiposte', 'Low Guard Riposte', 1, 'skill',
    ['camp:physical', 'maneuver:counter', 'counter:melee', 'reach:contact', 'targeting:single'],
    [{ op: 'block', target: 'self', amount: 5 }],
    'Gain {block} Block. Counter Contact attacks for 3 Poise; +2 Poise while Prone.',
    { counterCoverage: { camps: ['physical'], reaches: ['contact'], targeting: ['single'], effects: ['damage'], maneuvers: ['attack', 'smash'] },
      counterPayload: { hp: 0, poise: 3, ward: 0 }, pronePoiseBonus: 2 }),
  row('crawlingShot', 'Crawling Shot', 1, 'attack',
    ['camp:physical', 'maneuver:ranged', 'damage:piercing', 'reach:near', 'targeting:single'],
    [{ op: 'damage', target: 'enemy', amount: 4 }],
    'Deal {damage} damage at Near range. While Prone, prepare one Evade with Advantage.',
    { damageSchool: 'physical', exposureBuildupPerHit: 0, attack: { source: 'weapon', damageType: 'piercing' }, reach: 'near', targeting: 'single', projectile: true,
      evade: { charges: 1, bonus: 0, advantage: true, whileStatus: 'prone' } }),
  row('emberCovenant', 'Ember Covenant', 1, 'power', spell('fire'), [],
    'Your first Corrupted card each turn grants 3 Barrier. Blight still accumulates.',
    { keywords: ['exhaust'], comboHook: { on: 'ashenBlightPaid', oncePerTurn: 'ember-covenant', effects: [{ op: 'gainBarrier', target: 'self', amount: 3 }] } }),
  row('shatterOpportunity', 'Shatter Opportunity', 1, 'power', spell('frost'), [],
    'Once per turn, thawing or shattering an enemy draws 1 card and Retains 1 card.',
    { keywords: ['exhaust'], comboHook: { on: 'statusRemoved', statuses: ['frozen', 'chilled'], reasons: ['thawed', 'shattered'], targetKind: 'enemy',
      oncePerTurn: 'shatter-opportunity', effects: [{ op: 'draw', amount: 1 }, { op: 'retain', amount: 1 }] } }),
];
