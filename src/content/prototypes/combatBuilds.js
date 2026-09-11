// Explicit test content: never included in the normal content bundle/rewards.
import { contentBundle } from '../index.js';
import { combatRules } from '../combatRules.js';
import { createRegistries } from '../../model/registries.js';
import { createCombat } from '../../engine/combat.js';
import { createRng } from '../../engine/rng.js';
import { prototypeEquipment } from './combatEquipment.js';
import { computeTokenBindings } from '../../model/validate.js';

const card = (id, name, cost, effects, extra = {}) => ({ id, name, class: 'colorless', rarity: 'special', cost, type: 'attack', keywords: [], effects,
  textTemplate: `${name}. ${computeTokenBindings(effects).map((b) => `${b.token}: {${b.token}}`).join('; ')}`,
  ...(effects.some((e) => e.op === 'damage') ? { damageSchool: extra.attack?.source === 'spell' ? 'arcane' : 'physical', exposureBuildupPerHit: 0 } : {}), ...extra });
const hit = (amount, hits = 1) => ({ op: 'damage', target: 'enemy', amount, hits });
export const prototypeCards = [
  card('prototypeGuard', 'Guard', 1, [{ op: 'block', target: 'self', amount: 8 }], { type: 'skill' }),
  card('prototypeRecover', 'Catch Breath', 1, [{ op: 'restoreStamina', target: 'self', amount: 2 }], { type: 'skill' }),
  card('prototypeHeavy', 'Committed Strike', 1, [hit(10)], { attack: { source: 'weapon' } }),
  card('prototypeSmash', 'Breaking Blow', 1, [hit(17)], { staminaCost: 2, attack: { source: 'weapon', impactBonus: 3 } }),
  card('prototypeCleave', 'Broad Sweep', 2, [{ ...hit(11), target: 'allEnemies' }], { staminaCost: 1, attack: { source: 'weapon', impactFactor: 0.7 } }),
  card('prototypeFast', 'Twin Cuts', 1, [hit(4, 2)], { attack: { source: 'weapon' } }),
  card('prototypeSetup', 'Open Vein', 1, [hit(6)], { staminaCost: 1, attack: { source: 'weapon', buildup: [{ status: 'bleed', amount: 2 }] } }),
  card('prototypeFinish', 'Bloodletting Flurry', 1, [hit(5, 3)], { staminaCost: 2, attack: { source: 'weapon' } }),
  card('prototypeSpell', 'Astral Shard', 1, [hit(8)], { attack: { source: 'spell', damageType: 'arcane' } }),
  card('prototypeComet', 'Falling Comet', 1, [hit(22)], { manaCost: 1, attack: { source: 'spell', damageType: 'arcane' } }),
  card('prototypeNova', 'Nova', 2, [{ ...hit(30), target: 'allEnemies' }], { manaCost: 2, attack: { source: 'spell', damageType: 'arcane' } }),
  card('prototypePhysicalStance', 'Measured Guard', 1, [{ op: 'enterStance', stance: 'prototypeGuardStance' }], { type: 'skill', staminaCost: 2 }),
  card('prototypeCasterStance', 'Astral Focus', 1, [{ op: 'enterStance', stance: 'prototypeFocusStance' }], { type: 'skill', staminaCost: 2 }),
];

const descriptions = {
  prototypeGuard: 'Gain {block} Block.', prototypeRecover: 'Recover {restoreStamina} stamina.',
  prototypeHeavy: 'Deal {damage} damage in {hits} hit.', prototypeSmash: 'Deal {damage} damage in {hits} hit. Extra weapon impact.',
  prototypeCleave: 'Deal {damage} damage in {hits} hit to every enemy.', prototypeFast: 'Deal {damage} damage, {hits} times. Apply weapon Bleed on each landed hit.',
  prototypeSetup: 'Deal {damage} damage in {hits} hit. Apply extra Bleed on contact.', prototypeFinish: 'Deal {damage} damage, {hits} times.',
  prototypeSpell: 'Deal {damage} arcane damage in {hits} hit.', prototypeComet: 'Deal {damage} arcane damage in {hits} hit.', prototypeNova: 'Deal {damage} arcane damage in {hits} hit to every enemy.',
  prototypePhysicalStance: 'Enter Measured Guard. Gain Block now and each turn until replaced.', prototypeCasterStance: 'Enter Astral Focus. Gain Block now and each turn until replaced.',
};
for (const def of prototypeCards) def.textTemplate = descriptions[def.id];

export const prototypeBuilds = {
  heavy: { name: 'Heavy physical', classId: 'reaver', itemId: 'greatsword', family: 'blade', grip: 'twoHand', damageType: 'slashing', armorId: 'plate', maxStamina: 5, maxMana: 1,
    attributes: { strength: 18, constitution: 14, dexterity: 10, intelligence: 8, wisdom: 10 },
    cards: ['prototypeHeavy', 'prototypeHeavy', 'prototypeHeavy', 'prototypeSmash', 'prototypeCleave'], stance: 'prototypePhysicalStance' },
  bleed: { name: 'Fast Bleed', classId: 'rogue', itemId: 'dagger', family: 'blade', grip: 'oneHand', damageType: 'piercing', armorId: 'leather', maxStamina: 5, maxMana: 1,
    attributes: { strength: 10, constitution: 12, dexterity: 18, intelligence: 8, wisdom: 12 },
    bloodRune: true, cards: ['prototypeFast', 'prototypeFast', 'prototypeFast', 'prototypeSetup', 'prototypeFinish'], stance: 'prototypePhysicalStance' },
  caster: { name: 'Rare-mana caster', classId: 'starseer', itemId: 'ashStaff', family: 'focus', grip: 'twoHand', damageType: 'arcane', armorId: 'robes', maxStamina: 3, maxMana: 3,
    attributes: { strength: 8, constitution: 10, dexterity: 10, intelligence: 18, wisdom: 14 },
    cards: ['prototypeSpell', 'prototypeSpell', 'prototypeSpell', 'prototypeComet', 'prototypeNova'], stance: 'prototypeCasterStance' },
};

export const prototypeScenarios = {
  basic: { name: 'Unarmored foe', hp: 55, damage: 9, poise: 18, count: 1 },
  armored: { name: 'Armored sentinel', hp: 80, damage: 11, poise: 30, armor: 90, count: 1 },
  group: { name: 'Three attackers', hp: 30, damage: 5, poise: 12, count: 3 },
  resistant: { name: 'Bleed-resistant foe', hp: 65, damage: 10, poise: 22, resistBleed: true, count: 1 },
  boss: { name: 'Boss', hp: 150, damage: 14, poise: 35, armor: 25, count: 1 },
};

const registryCache = new Map();
export function prototypeBundle(pressure = 1) {
  if (!Number.isFinite(pressure) || pressure <= 0 || pressure > 10) throw new Error('Prototype pressure must be > 0 and <= 10');
  const enemy = (id, s) => ({ ...contentBundle.enemies[0], id: `prototype_${id}`, name: s.name, hp: [s.hp, s.hp], poiseMax: s.poise,
    moves: { strike: { intent: 'attack', damage: Math.round(s.damage * pressure), weight: 1 } }, phases: [], firstMove: 'strike' });
  return {
    ...contentBundle, cards: [...contentBundle.cards.map((c) => c.id === 'dodgeRoll' ? { ...c,
      keywords: [...new Set([...(c.keywords || []), 'retain'])],
      textTemplate: 'Retain. Evade the next incoming hit this turn. Once per turn. Stamina cost depends on equipment weight.' } : c), ...prototypeCards],
    equipment: { ...contentBundle.equipment, cardExposure: [...contentBundle.equipment.cardExposure,
      ...prototypeCards.filter((c) => c.damageSchool).map((c) => ({ cardId: c.id, damageSchool: c.damageSchool, exposureBuildupPerHit: c.exposureBuildupPerHit }))] },
    enemies: [...contentBundle.enemies, ...Object.entries(prototypeScenarios).map(([id, s]) => enemy(id, s))],
    statuses: [...contentBundle.statuses, { id: 'prototypeClotted', name: 'Bleed Resistance', stackMode: 'unique', decay: { duration: 99 }, resists: { status: 'bleed', percent: 50 } }],
    stances: [...contentBundle.stances,
      { id: 'prototypeGuardStance', name: 'Measured Guard', tooltip: 'Gain {onEnter.0.amount} Block when entering. Gain {hooks.0.do.0.amount} Block at the start of each of your turns.', onEnter: [{ op: 'block', target: 'self', amount: 3 }], hooks: [{ on: 'ownerTurnStart', do: [{ op: 'block', target: 'self', amount: 2 }] }] },
      { id: 'prototypeFocusStance', name: 'Astral Focus', tooltip: 'Gain {onEnter.0.amount} Block when entering. Gain {hooks.0.do.0.amount} Block at the start of each of your turns.', onEnter: [{ op: 'block', target: 'self', amount: 3 }], hooks: [{ on: 'ownerTurnStart', do: [{ op: 'block', target: 'self', amount: 2 }] }] }],
  };
}
export function prototypeRegistries(pressure = 1) {
  if (!registryCache.has(pressure)) registryCache.set(pressure, createRegistries(prototypeBundle(pressure)));
  return registryCache.get(pressure);
}

export function prototypeInput(buildId = 'heavy', scenarioId = 'basic', seed = 1, overrides = {}) {
  const build = prototypeBuilds[buildId], scenario = prototypeScenarios[scenarioId];
  if (!build || !scenario) throw new Error('Unknown prototype build/scenario');
  const regs = prototypeRegistries(overrides.pressure || 1);
  const { equipmentOptions = {}, ...playerOverrides } = overrides;
  const deck = ['dodgeRoll', 'prototypeGuard', 'prototypeGuard', 'prototypeRecover', build.stance, ...build.cards].map((cardId, i) => ({ instanceId: `prototype${i}`, cardId, upgraded: false }));
  const profiles = { player: prototypeEquipment(regs, build, equipmentOptions).profile };
  for (let i = 0; i < scenario.count; i++) profiles[`e${i + 1}`] = { armor: scenario.armor || 0,
    sources: { mainHand: { id: `enemy/${scenarioId}`, weight: 4, family: 'natural', grip: 'oneHand', damageType: 'blunt' } } };
  return { registries: regs, rng: createRng(seed), ruleset: combatRules, combatProfiles: profiles,
    player: { classId: build.classId, maxHp: 80, hp: 80, deck, attributes: build.attributes, relicIds: [], energyMax: 3, drawPerTurn: 5, maxStamina: build.maxStamina, stamina: build.maxStamina, maxMana: build.maxMana, mana: build.maxMana, ...playerOverrides },
    enemyIds: Array(scenario.count).fill(`prototype_${scenarioId}`),
    enemyStatuses: scenario.resistBleed ? [{ status: 'prototypeClotted', stacks: 1 }] : [],
  };
}

export function createPrototypeCombat(buildId, scenarioId, seed, overrides) {
  return createCombat(prototypeInput(buildId, scenarioId, seed, overrides));
}
