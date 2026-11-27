// Small scenarios for W25 cost, reaction and protection contracts. Authored
// catalogs are checked separately; no prior content snapshot is substituted.
import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';
import { resolveGameProfile } from '../../src/model/gameProfile.js';
import { createCombat } from '../../src/engine/combat.js';
import { createRng } from '../../src/engine/rng.js';
import { gameDigest } from '../../engine/kernel/gameConfig.js';

const spell = (id, effects, extra = {}) => ({ id, name: id, class: 'colorless', rarity: 'common', type: 'attack',
  costRule: 'fixed', cost: 0, staminaCost: 0, manaCost: 1, effects, keywords: [], upgrade: {},
  damageSchool: 'magic', exposureBuildupPerHit: 0,
  tags: ['camp:spell', 'source:spell', 'maneuver:casting', 'classification.attack', 'cost.manaOnly'], ...extra });
export const w25Cards = [
  spell('fixture.fire', [{ op: 'damage', target: 'enemy', amount: 8 }], { tags: ['camp:spell', 'source:spell', 'maneuver:casting', 'classification.attack', 'cost.manaOnly', 'school:fire', 'damage:fire'] }),
  spell('fixture.archive', [{ op: 'draw', amount: 1 }, { op: 'restoreMana', target: 'self', amount: 2 }], { type: 'skill', manaCost: 2, keywords: ['exhaust'] }),
  spell('fixture.unmarked', [{ op: 'damage', target: 'enemy', amount: 8 }], { tags: ['camp:spell', 'source:spell', 'maneuver:casting', 'classification.attack'] }),
  spell('fixture.protection', [{ op: 'applyStatus', target: 'self', status: 'ward', stacks: 1 }, { op: 'gainBarrier', target: 'self', amount: 1 }], { type: 'skill' }),
  spell('fixture.barrier', [{ op: 'gainBarrier', target: 'self', amount: 1 }], { type: 'skill' }),
  { id: 'fixture.reaction', name: 'Fixture reaction', class: 'colorless', rarity: 'common', type: 'attack',
    costRule: 'fixed', cost: 1, staminaCost: 1, manaCost: 0, effects: [{ op: 'damage', target: 'enemy', amount: 8 }], keywords: [], upgrade: {},
    tags: ['camp:physical', 'maneuver:attack', 'classification.attack', 'trait:reaction'], damageSchool: 'physical', exposureBuildupPerHit: 0 },
];
const profile = structuredClone(resolveGameProfile('default'));
Object.assign(profile.modules.effects, { baseDamageMultiplier: 1, playerDamageMultiplier: 1, enemyDamageMultiplier: 1, physicalDamageMultiplier: 1,
  blockGainMultiplier: 1, spellPoiseDamageMultiplier: 1 });
delete profile.modules.gear.typeEffectsVersion;
profile.modules.stances.include = ['attack', 'defend', 'counter', 'prepared', 'smash', 'sweep', 'neutral'];
profile.modules.reactions.chainLimit = 16;
profile.content.cards = w25Cards;
profile.content.resourceVariants = {};
delete profile.hash; profile.hash = gameDigest(profile);

const base = createRegistries(contentBundle);
const cards = new Map(w25Cards.map(card => [card.id, card]));
const enemy = { id: 'fixture.enemy', name: 'Fixture attacker', hp: [500, 500], poiseMax: 0,
  attributes: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0 }, spPool: 1, firstMove: 'hit',
  moves: { hit: { id: 'hit', enemyId: 'fixture.enemy', intent: 'attack', damage: 12, sp: 1, weight: 1, tags: ['camp:physical', 'maneuver:attack', 'range:melee'] } } };
const focus = { id: 'fixture.focus', name: 'Fixture Focus', kind: 'staff', itemTypeTags: ['item:magic-focus'], mods: [] };
const statuses = new Map(['ward', 'barrier'].map(id => [id, { id, name: id, stackMode: 'add', decay: 'none' }]));
export const w25Registries = {
  ...base,
  balance: { ...base.balance, mana: { ...base.balance.mana, focusItemType: 'item:magic-focus', focusManaDiscount: 0 } },
  equipment: { ...base.equipment, armaments: [focus], armour: [] },
  cards: { ...base.cards, has: id => cards.has(id) || base.cards.has(id), get: id => cards.get(id) || base.cards.get(id) },
  enemies: { ...base.enemies, has: id => id === enemy.id || base.enemies.has(id), get: id => id === enemy.id ? enemy : base.enemies.get(id) },
  statuses: { ...base.statuses, has: id => statuses.has(id) || base.statuses.has(id), get: id => statuses.get(id) || base.statuses.get(id) },
};

export function w25Fight({ focus: useFocus = false, prepared = false } = {}) {
  const loadout = { sets: { rightHand: [useFocus ? focus.id : null], leftHand: [null], armor: [null] },
    active: { rightHand: 0, leftHand: 0, armor: 0 }, storage: [] };
  const combat = createCombat({ registries: w25Registries, rng: createRng(51), gameProfile: profile,
    player: { classId: 'reaver', hp: 100, maxHp: 100, mana: 50, maxMana: 50, stamina: 20, maxStamina: 20, energyMax: 20,
      drawPerTurn: 8, relicIds: [], flasks: [], loadout,
      attributes: { strength: 0, dexterity: 0, constitution: 0, wisdom: 0, intelligence: 0 },
      deck: [...w25Cards.map((card, n) => ({ cardId: card.id, instanceId: 'fixture:' + n, upgraded: false })),
        { cardId: 'fixture.fire', instanceId: 'fixture:fire2', upgraded: false },
        { cardId: 'fixture.fire', instanceId: 'fixture:fire3', upgraded: false }] },
    enemyIds: [enemy.id] });
  Object.assign(combat.fixCoreRules, {
    spellCosts: { version: 1, manaSurcharge: 1, staminaSurcharge: 1, cantripTag: 'rank.cantrip',
      manaOnlyTag: 'cost.manaOnly', preparedStaminaDiscount: 1, focusManaDiscount: 1 },
    elementFlux: { version: 1, multiplier: 1.25 },
    poise: { drain: 'prevented', breakRule: 'broken', brokenDamageMultiplier: 1, breakStatusStacks: 2,
      mitigationStances: ['counter', 'prepared', 'smash'], mitigationPoiseFraction: 0.5, mitigationDrainDamageFraction: 0.5, mitigationDrainFlat: 1 },
    ward: { enabled: false, routing: 'hpBuffer', hpPerStack: 5, decayPerTurn: 1 },
    stance: { ...combat.fixCoreRules.stance, effectivenessMultiplier: 1, discount: 0, minimumCost: 0, playerMinimumCost: 0 },
  });
  combat.fixCoreRules.accuracy.hitRoll = false;
  combat.core2ActionRulesVersion = 2;
  delete combat.fixCoreRules.stanceBenefits;
  delete combat.fixCoreRules.elements;
  combat.ratingsRules = { ...combat.ratingsRules, barrier: { poisePerStack: 5 } };
  for (const entity of [combat.player, ...combat.enemies]) {
    entity.statuses = {}; entity.block = 0; entity.wardHp = 0; entity.critRules = [];
    entity.ratings = { ar: 0, pr: 0, dr: 0, poise: 0, ward: 0 };
    entity.persistentPoise = { value: 0, max: 0 };
    delete entity.combatStance; delete entity.combatCounter; delete entity.weaknesses;
  }
  combat.player.energy = combat.player.stamina = 20;
  combat.player.mana = 50;
  if (prepared) combat.player.combatStance = { maneuver: 'prepared', camp: 'spell' };
  return { combat, enemy: combat.enemies[0] };
}
