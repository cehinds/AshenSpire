// Version-2 combination cards. Conditional riders and hook budgets use the
// shared interpreter; no card ids are selected by the combat engine.
import { DEFAULT_BARRIER_POISE_PER_STACK } from './barrierPoise.js';
const has = (status, of = 'self') => ({ p: 'hasStatus', of, status });
const row = (id, name, cost, type, tags, effects, textTemplate, extra = {}) => ({
  id, name, class: 'colorless', rarity: 'uncommon', cost, manaCost: 0, type,
  keywords: [], tags, effects, textTemplate, minCombatExpansionVersion: 2, ...extra,
});
const spell = school => ['camp:spell', `school:${school}`, 'range:melee', 'targeting:single'];
const locks = ['sleep', 'paralysis', 'dazed'];
// Ember Covenant grants Barrier stacks; its text names the Poise they are worth (stacks x `barrier.poisePerStack`), never a typed number.
const EMBER_COVENANT_STACKS = 3;
const emberCovenantPoise = EMBER_COVENANT_STACKS * DEFAULT_BARRIER_POISE_PER_STACK;

export const combatExpansionCombos = [
  row('dreamHarvest', 'Dream Harvest', 1, 'skill', spell('illusion'),
    [{ op: 'draw', amount: 1, if: has('sleep', 'allEnemies'), oncePerTurn: 'dream-harvest' }],
    'While an enemy is asleep, draw {draw} card. Once per turn; does not wake it.',
    { faceTemplate: ['Enemy asleep: draw {draw}.', 'Once per turn.'] }),
  row('lucidRecovery', 'Lucid Recovery', 2, 'skill', spell('illusion'),
    [{ op: 'removeStatus', target: 'self', status: 'sleep', amount: 1 },
      { op: 'gainBarrier', target: 'self', amount: 2, if: { ...has('sleep'), snapshot: 'beforePlay' } }],
    'Break {removeStatus} Sleep. If asleep when played, gain {gainBarrier} Poise.', { usableWhile: locks }),
  row('groundedResolve', 'Grounded Resolve', 3, 'skill', spell('alteration'),
    [{ op: 'removeStatus', target: 'self', status: 'paralysis', amount: 1 },
      { op: 'applyStatus', target: 'self', status: 'grounded', stacks: 1, if: { ...has('paralysis'), snapshot: 'beforePlay' } }],
    'Break {removeStatus} Paralysis. If paralyzed when played, gain {grounded} Grounded.', { usableWhile: locks }),
  row('clearHead', 'Clear Head', 1, 'skill', ['camp:physical', 'range:melee', 'targeting:single'],
    [{ op: 'removeStatus', target: 'self', status: 'dazed', amount: 1 },
      { op: 'grantRollMode', target: 'self', roll: 'evade', advantage: true, oncePerTurn: 'clear-head', if: { ...has('dazed'), snapshot: 'beforePlay' } }],
    'Clear {removeStatus} Dazed. If Dazed when played, your next Evade has Advantage. Once per turn.', { usableWhile: locks }),
  row('lowGuardRiposte', 'Low Guard Riposte', 1, 'skill',
    ['camp:physical', 'maneuver:counter', 'counter:melee', 'range:melee', 'targeting:single'],
    [{ op: 'block', target: 'self', amount: 5 }],
    'Gain {block} Block. Counter Melee attacks for 3 Poise; +2 Poise while Prone.',
    { counterCoverage: { camps: ['physical'], ranges: ['melee'], targeting: ['single'], effects: ['damage'], maneuvers: ['attack', 'smash'] },
      counterPayload: { hp: 0, poise: 3, ward: 0 }, pronePoiseBonus: 2 }),
  row('crawlingShot', 'Crawling Shot', 1, 'attack',
    ['camp:physical', 'maneuver:ranged', 'damage:piercing', 'range:reach', 'targeting:single'],
    [{ op: 'damage', target: 'enemy', amount: 4 },
      { op: 'applyStatus', target: 'self', status: 'evade', stacks: { f: 'metric', metric: 'evadeStackGain', of: 'self' } },
      { op: 'moveEngagement', target: 'self', bands: 1 }],
    'Deal {damage} damage at Reach range. Gain {evade} Evade. Retreat.',
    { damageSchool: 'physical', exposureBuildupPerHit: 0, attack: { source: 'weapon', damageType: 'piercing' }, range: 'reach', targeting: 'single', projectile: true }),
  row('emberCovenant', 'Ember Covenant', 1, 'power', spell('fire'), [],
    `Your first Corrupted card each turn grants ${emberCovenantPoise} Poise. Blight still accumulates.`,
    { keywords: ['exhaust'], faceTemplate: [`First Corrupted card: ${emberCovenantPoise} Poise.`, 'Once per turn.'], comboHook: { on: 'ashenBlightPaid', oncePerTurn: 'ember-covenant', effects: [{ op: 'gainBarrier', target: 'self', amount: EMBER_COVENANT_STACKS }] } }),
  row('shatterOpportunity', 'Shatter Opportunity', 1, 'power', spell('frost'), [],
    'Once per turn, thawing or shattering an enemy draws 1 card and Retains 1 card.',
    { keywords: ['exhaust'], faceTemplate: ['Shatter: draw 1, Retain 1.', 'Once per turn.'], comboHook: { on: 'statusRemoved', statuses: ['frozen', 'chilled'], reasons: ['thawed', 'shattered'], targetKind: 'enemy',
      oncePerTurn: 'shatter-opportunity', effects: [{ op: 'draw', amount: 1 }, { op: 'retain', amount: 1 }] } }),
];
