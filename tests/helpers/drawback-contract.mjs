// Compact mechanics operands; current card catalogs and balance remain independently authored.
import assert from 'node:assert/strict';
import { contentBundle } from '../../src/content/index.js';
import { createRegistries } from '../../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../../src/model/gameProfile.js';
import { createRunState } from '../../src/model/state.js';
import { createRng } from '../../src/engine/rng.js';
import { createRunCombat } from '../../src/engine/runCombat.js';
import { gameDigest } from '../../engine/kernel/gameConfig.js';
import { scoringContract } from './scoring-contract.mjs';
import { GetActiveScoring, HasCustomScoring, SetCustomScoring, ClearCustomScoring } from '../../src/model/activeScoring.js';

const base = (id, effects, extra = {}) => ({ id: `fixture.drawback.${id}`, name: id, class: 'colorless', rarity: 'common', type: 'skill',
  cost: 1, staminaCost: 1, manaCost: 0, damageSchool: 'physical', exposureBuildupPerHit: 0, costRule: 'fixed', keywords: [], tags: ['camp:physical', 'maneuver:casting', 'classification.skill'], effects,
  textTemplate: 'Gain {block} Block.', ...extra });
const block = amount => ({ op: 'block', target: 'self', amount });
const attack = { type: 'attack', tags: ['camp:physical', 'maneuver:attack', 'classification.attack'], textTemplate: 'Deal {damage} damage.' };
const hit = { op: 'damage', target: 'enemy', amount: 5 };
export const cards = {
  plain: base('plain', [hit], attack),
  rising: base('rising', [hit], { ...attack, costGrowth: { stamina: 1, mana: 0, perUse: 1, max: 3 }, textTemplate: 'Deal {damage} damage. Costs 1 more Stamina each play (up to +3).' }),
  hold: base('hold', [block(6)], { costGrowth: { stamina: 1, mana: 0, perUse: 1, max: 2 },
    textTemplate: 'Gain {block} Block. Costs 1 more Stamina each play (up to +2).',
    faceTemplate: ['Gain {block} Block.', '+1 Stamina each play.'], upgrade: { costGrowth: { stamina: 0, mana: 0 }, textTemplate: 'Gain {block} Block.' } }),
  ethereal: base('ethereal', [block(10)], { keywords: ['ethereal'], textTemplate: 'Gain {block} Block. Ethereal.', faceTemplate: ['Gain {block} Block.', 'Ethereal.'] }),
  exhaust: base('exhaust', [block(1)], { keywords: ['ethereal', 'exhaust'], textTemplate: 'Gain {block} Block. Ethereal. Exhaust.' }),
  grade: base('grade', [block(1)], { kindIds: ['classification.skill'], keywords: ['exhaust'], abilityKind: 'maneuver', abilityFamily: 'fixture.drawback.grade', abilityRank: 0,
    textTemplate: 'Gain {block} Block. Exhaust.',
    gradeProfiles: [0, 1, 2, 3].map(rank => ({ rank, actionCost: 1, manaCost: 0, effects: [block(rank + 1)], textTemplate: 'Gain {block} Block. Exhaust.', traits: { costRule: 'fixed' } })) }),
  hp: base('hp', [{ op: 'loseHp', target: 'self', amount: 2, nonlethal: true }, hit], { ...attack,
    textTemplate: 'Lose {loseHp} HP. Deal {damage} damage.', upgrade: { effects: [hit], textTemplate: 'Deal {damage} damage.' } }),
  allyBuff: base('ally-buff', [{ op: 'applyStatus', target: 'ally', status: 'strength', stacks: 3 }], { textTemplate: 'Give an ally {strength} Strength; with no allies this does nothing.' }),
  allyDrain: base('ally-drain', [{ op: 'loseHp', target: 'allAllies', amount: 2 }, { op: 'restoreMana', target: 'self', amount: 2 }], { textTemplate: 'All allies lose {loseHp} HP; with no allies no HP is paid. Restore {restoreMana} Mana.' }),
  allyGuard: base('ally-guard', [{ op: 'block', target: 'allAllies', amount: 4 }], { textTemplate: 'Give all allies {block} Block; with no allies this does nothing.' }),
  allySelf: base('ally-self', [{ op: 'applyStatus', target: 'ally', status: 'strength', stacks: 3 }, { op: 'applyStatus', target: 'self', status: 'strength', stacks: 1 }], { textTemplate: 'Give allies Strength; with no allies only your own {strength.2} Strength applies.' }),
};
export const allyIds = [cards.allyBuff.id, cards.allyDrain.id, cards.allyGuard.id, cards.allySelf.id];
export const profile = structuredClone(resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: { effects: {
  physicalDamageMultiplier: 1, playerDamageMultiplier: 1, enemyDamageMultiplier: 1, blockGainMultiplier: 1,
  baseDamageMultiplier: 1, strengthDamageWeight: 0, dexterityBlockWeight: 0, magicStatWeight: 0,
} } }));
profile.content.cards.push(...Object.values(cards).filter(card => card.id !== cards.grade.id));
profile.content.starterDeck.classDecks.reaver = [{ card: cards.plain.id, copies: 8 }, { card: cards.hold.id, copies: 2 }];
profile.hash = gameDigest(Object.fromEntries(Object.entries(profile).filter(([key]) => key !== 'hash')));
export const registries = bindGameProfileRegistries(createRegistries(applyGameProfileToContent({ ...contentBundle, cards: [...contentBundle.cards, cards.grade] }, profile)), profile);
export const fresh = () => createRunState({ registries, classId: 'reaver', seed: 511 });
export function fight(hand) {
  const run = fresh();
  run.relics = [];
  run.loadout = { sets: { rightHand: [null], leftHand: [null], armor: [null] }, active: { rightHand: 0, leftHand: 0, armor: 0 } };
  const enemy = { id: 'fixture.drawback.target', name: 'Fixture target', hp: [1000, 1000], poiseMax: 0, spPool: 1,
    levelProfile: { min: 1, max: 1 }, attributes: { strength: 0, dexterity: 0, constitution: 0, wisdom: 0, intelligence: 0 },
    moves: { wait: { id: 'wait', enemyId: 'fixture.drawback.target', intent: 'block', block: 0, sp: 1, weight: 1 } }, firstMove: 'wait' };
  const reg = { ...registries, enemies: { ...registries.enemies, get: id => id === enemy.id ? enemy : registries.enemies.get(id), has: id => id === enemy.id || registries.enemies.has(id) } };
  const combat = createRunCombat({ registries: reg, run, rng: createRng(511), enemyIds: [enemy.id] });
  for (const pile of Object.values(combat.piles)) pile.length = 0;
  combat.piles.hand.push(...hand);
  for (let i = 0; i < 8; i++) combat.piles.draw.push({ instanceId: `f${i}`, cardId: cards.plain.id, upgraded: false });
  Object.assign(combat.player, { stamina: 100, maxStamina: 100, energy: 100, mana: 100, maxMana: 100 });
  combat.fixCoreRules.stance = { ...combat.fixCoreRules.stance, discount: 0 };
  delete combat.fixCoreRules.spellCosts;
  combat.fixCoreRules.accuracy = { ...combat.fixCoreRules.accuracy, hitRoll: false };
  combat.player.critRules = [];
  return combat;
}

// The upgrade mechanics must not become unaffordable when authored scoring changes.
// All operands fit one generous rank; this is a CP eligibility fixture, not game policy.
const scoring = scoringContract();
scoring.rank = { unrankedMax: 0, width: 1000, maxRank: 5, maxCp: 5000 };
scoring.costs = { sp: { weight: 0 }, mp: { weight: 0 } };
scoring.tierUnlocks = { enabled: false };
export function withScoring(callback) {
  const before = HasCustomScoring() ? GetActiveScoring() : null;
  const restore = () => before ? SetCustomScoring(before) : ClearCustomScoring();
  assert.deepEqual(SetCustomScoring(scoring), { ok: true, errors: [] });
  let result;
  try { result = callback(); } catch (error) { restore(); throw error; }
  if (result && typeof result.then === 'function') return result.finally(restore);
  restore();
  return result;
}
