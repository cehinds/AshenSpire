// tests/engine.test.js — headless engine/model/content tests (SPEC §8)
//
// Runs identically in Node (tests/run-node.mjs) and the browser
// (tests/index.html). No DOM access. Tests 12–13 (map gen, save) are M2 and
// reported as skipped placeholders.

import { contentBundle } from '../src/content/index.js';
import { MAP_SHAPE_LIMITS } from '../src/content/mapconfig.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { tagService } from '../src/model/tagService.js';
import { importLegacyContent } from '../src/framework/importer.js';
import { attackTagsFor } from '../src/engine/actions.js';
import { tagContentProblems, itemTypeLabelFrom, tagIdsAllowedFor, tagIdsInDomain } from '../src/model/tags.js';
import { boundGrantCardIds, boundGrantProblems, isItemOwned, pieceItemRef, reconcileGrantedCardsInCombat, itemMountInstances } from '../src/model/loadout.js';
import { extractionPlan, commitExtraction, installPlan, commitInstall, smithServicesAt, mountRows } from '../src/model/cardExtraction.js';
import { ownerItemRef, mountKey as mountKeyOf } from '../src/model/cardMounts.js';
import { itemTypeLabel } from '../src/content/equipment.js';
import {
  validateContent,
  extractTemplateTokens,
  computeTokenBindings,
} from '../src/model/validate.js';
import { resolveFloorPlan, applyRunShape, minViableFloors, MAP_SHAPE_KEYS } from '../src/model/floorplan.js';
import { rewardPlan, resolveContinue, unseenIds, REWARD_KIND_ORDER } from '../src/model/rewardplan.js';
import { beatFor } from '../src/model/secondbeat.js';
import { createRng, seedFromString, seedToString, seedProblem, SEED_MAX_LEN, sweepSeed } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard, previewIntent, getEntity, playerWeightClass } from '../src/engine/combat.js';
import { commitCombatSnapshot, serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { computeAttackDamage, applyLoseHp } from '../src/engine/actions.js';
import * as S from '../src/engine/statuses.js';
import { generateActMap, sampleActShape } from '../src/engine/mapgen.js';
import { createSaveManager, createMemoryStorage, RUN_KEY, RUN_ARCHIVE_KEY, META_KEY, META_BACKUP_KEY, META_SCHEMA_VERSION } from '../src/engine/save.js';
import { createRunState, RUN_SCHEMA_VERSION, validateRunShape, serializeRun, deserializeRun } from '../src/model/state.js';
import { attributeCardModels } from '../src/model/creationBrief.js';
import { resourceBarPlan, resourceDomains } from '../src/model/resources.js';
import { reallocateFlaskCharges } from '../src/model/gracerefill.js';
import { HUD_REFERENCE_MAX } from '../src/content/resources.js';
import { executeRunEffects } from '../src/engine/actions.js';
import {
  rollEncounter,
  rollRuneReward,
  rollCardRewardIds,
  rollFlaskDrop,
  rollRelicReward,
  buildShopStock,
  resolveUnknownNode,
  shrineHealAmount,
  rollArmamentDrop,
} from '../src/engine/encounters.js';
import {
  endlessActInfo, activeMods, isCustomRun, ENDLESS_HP_PER_LOOP, ENDLESS_STR_PER_LOOP,
} from '../src/content/customMods.js';
import { createCoopCombat, playCard as playCoopCard } from '../src/engine/coopCombat.js';
import { playerPoiseThresholdReceipt, statProjection } from '../src/model/statProjection.js';
import { startingArmourViews, resolveStartingArmour, validateRunStartingKit } from '../src/model/startingKits.js';
import { attributeAllocationProblems, classAttributePreset, allocationTotal, defaultCreationModeId } from '../src/model/attributes.js';
import { deriveStat, resolveDerivedStatRules } from '../src/model/derivedStats.js';
import { outfits } from '../src/content/generated/outfits.js';
import { unlocks } from '../src/content/generated/unlocks.js';
import { TAGS, TAG_DOMAINS, TAG_FAMILIES, TAG_FAMILY_DOMAINS, TAGGING, tagsFor, tagIdsFor, cardsWithTag, tagIdsOf, objectTagIds, tagsInDomain, domainsFor } from '../src/content/tags.js';
import { SFX_RECIPES, resolveRecipe } from '../src/content/sfx.js';
import { weapons } from '../src/content/generated/weapons.js';
import { KEEPSAKES } from '../src/content/keepsakes.js';
import {
  validateEquipment, equipPiece, stampDeck, runMods, loadoutTags, addToStorage, carriedIds,
  figureSpec, fitsSlot, slotHand, pieceHand,
  ownership, fromDropPool, OWNERSHIP_GATES, slotRungs, openedSets, visibleSets, rungFor, setCellState,
  SLOT_RUNG_KIND, createLoadout, cycleSet, canSwap, canEquip, startingDeckWarnings, isEquipmentComposedInstance, startingDeckPlan, WeaponCardPackageModel,
  swapCostFor, resolveSwapCostRule, SWAP_COST_BASES, RUN_MOD_APPLIES, equipmentRoleSource, equipTransitionReceipt,
  previewCompatibleHands, startingHandsRequirementFailure,
} from '../src/model/loadout.js';
import { armamentIntrinsicReceipt, equipmentSurfaceReceipt } from '../src/model/equipmentPresentation.js';
import { inventoryRows, inventoryItemCount } from '../src/model/inventoryPresentation.js';
import {
  UNLOCK_CONDITIONS, REVEAL_MODES, PRESENT_STATES, emptyProgress, recordProgress, evaluateUnlocks,
  unlockView, revealState, pieceReveal,
} from '../src/model/unlocks.js';
import { ENGINE_KEYWORDS } from '../src/model/schemas.js';
import { armouryUiProblems, equippedTagColor } from '../src/model/equipmentUi.js';
import {
  equipmentPositionCardState, inventorySelectionAction, normalizeArmouryLayout,
  orderArmouryPositions, orderArmourySlots, trayPresentationState,
} from '../src/model/armouryLayout.js';
import { inventoryItemCardModel, inventoryDetailCardModel } from '../src/ui/models/ArmouryModels.js';
import { hudQuickSettingsModel, musicQuickSettingsPlan } from '../src/ui/models/HudQuickSettingsModel.js';
import { battlefieldStageModel } from '../src/ui/models/BattlefieldStageModel.js';
import { tooltipPlacementModel } from '../src/ui/models/TooltipPlacementModel.js';
import {
  hudQuickSettingsHtml, refreshHudQuickSettings, updateHudQuickSettingsBinding,
} from '../src/ui/components/hudQuickSettings.js';
import {
  characterCreationProblems, creationArmourChoices, creationHandChoices,
  creationRelicChoices, creationModeViews, creationEquipmentSectionViews,
  selectStartingHand, resolveCreationHands,
} from '../src/model/characterCreation.js';
// The shrine lane and the level: both of Constantine's 2026-08-16 shrine asks
// that a headless suite can reach. `mapknowledge.js` is pure by design (its own
// header says so) and `levelup.js` touches no DOM, so the "no DOM access" rule
// at the top of this file still holds.
import { nearestShrine, shrineLane, litNodes } from '../src/model/mapknowledge.js';
import { levelUpPlan, applyLevelUp, levelCost, levelsAffordable } from '../src/model/levelup.js';
// The one UI import in this suite, and it is deliberate: `settingOn` is where a
// default now lives, so a default is testable headlessly. settings.js reaches no
// DOM at module scope (verified — it imports cleanly under plain Node), so the
// "no DOM access" rule at the top of this file still holds.
import { settingOn, resolveTapSize, resolveLevelUpValue, resolveStatTierSize, derivedStatDialOptions, settingsRow, categoryHandler, fullscreenCapability } from '../src/ui/screens/settings.js';
// The second UI import, and the same deliberateness: LOCK_COPY is the words for
// a closed set the MODEL declares, so "every route has a sentence" is a join
// this suite can check. uiContent.js is data and touches no DOM at module scope.
import { LOCK_COPY, PARCHMENT_ACTS, PARCHMENT_EXT, BACKDROP_ACTS, MENU_TABS, MENU, parchmentAsset, backdropClass, actPlate } from '../src/ui/uiContent.js';

// ---------------------------------------------------------------------------
// Test-only content (registered alongside the real bundle; never shipped)
// ---------------------------------------------------------------------------

const TEST_STATUSES = [
  {
    // Test 17: throwaway status exercising meter + modifier + hook with ZERO
    // engine changes (design law §3.1(2) proof).
    id: 'testCharge', name: 'Test Charge', stackMode: 'add', decay: 'none',
    meter: { max: 5, growthMult: 2, onFill: [{ op: 'block', target: 'self', amount: 7 }] },
    modifiers: { attackDamageAdd: 1 },
    hooks: [{ on: 'ownerTurnStart', do: [{ op: 'draw', amount: 1 }] }],
  },
  {
    // #61 tests: an ADDITIVE-stacking tagged vulnerability, to prove the
    // declared-stacking enum drives composition (the shipped rows are all
    // multiplicative).
    id: 'tAddVuln', name: 'T Add Vuln', stackMode: 'add', decay: 'none',
    taggedVulnerability: { tags: ['starstone'], mult: 1.5, stacking: 'additive' },
  },
];

const TEST_CARDS = [
  { id: 'tBigDraw', name: 'T Big Draw', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: ['innate'], effects: [{ op: 'draw', amount: 10 }], textTemplate: 'Draw {draw} cards.' },
  { id: 'tKeep', name: 'T Keep', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: ['retain'], effects: [], textTemplate: 'Retain.' },
  { id: 'tPoise', name: 'T Poise', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: [], effects: [{ op: 'poiseDamage', target: 'enemy', amount: 10 }], textTemplate: '{poiseDamage} Poise damage.' },
  { id: 'tCharge', name: 'T Charge', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: ['innate'], effects: [{ op: 'applyStatus', target: 'self', status: 'testCharge', stacks: 3 }], textTemplate: 'Gain {testCharge} Charge.' },
  // #61 fixtures: proc appliers + a tagged hit for the vulnerability lane.
  { id: 'tFrost10', name: 'T Frost', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: [], effects: [{ op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 10 }], textTemplate: 'Apply {frost} Frost.' },
  { id: 'tInsanity14', name: 'T Insanity', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: [], effects: [{ op: 'applyStatus', target: 'enemy', status: 'insanity', stacks: 14 }], textTemplate: 'Apply {insanity} Insanity.' },
  { id: 'tStarHit', name: 'T Star Hit', class: 'colorless', rarity: 'special', cost: 0, type: 'attack', keywords: [], effects: [{ op: 'damage', target: 'enemy', amount: 10, tags: ['starstone'] }], textTemplate: 'Deal {damage} damage.' },
  { id: 'tPlainHit', name: 'T Plain Hit', class: 'colorless', rarity: 'special', cost: 0, type: 'attack', keywords: [], effects: [{ op: 'damage', target: 'enemy', amount: 10 }], textTemplate: 'Deal {damage} damage.' },
  // 7g collision fixture (Vira's drive, made display-conformant: tokens bind
  // both applications — her probe card's bare 'Collide.' was the one
  // non-conformance her gate note named).
  { id: 'tCollide', name: 'T Collide', class: 'colorless', rarity: 'special', cost: 1, type: 'skill', keywords: [], effects: [{ op: 'applyStatus', target: 'enemy', status: 'bleed', stacks: 12 }, { op: 'applyStatus', target: 'enemy', status: 'frost', stacks: 10 }], textTemplate: 'Apply {bleed} Bleed and {frost} Frost.' },
];

const TEST_ENEMIES = [
  { id: 'tDummy', name: 'T Dummy', hp: [30, 30], poiseMax: 99, moves: { wait: { intent: 'unknown', weight: 1 } } },
  // #61: tagged twin of tDummy — the resistance gate's positive arm.
  { id: 'tBeast', name: 'T Beast', hp: [30, 30], poiseMax: 99, moves: { wait: { intent: 'unknown', weight: 1 } } },
  { id: 'tGiant', name: 'T Giant', hp: [400, 400], poiseMax: 99, moves: { wait: { intent: 'unknown', weight: 1 } } },
  { id: 'tHitter', name: 'T Hitter', hp: [50, 50], poiseMax: 99, moves: { hit: { intent: 'attack', damage: 10, weight: 1 } } },
  { id: 'tRegen', name: 'T Regen', hp: [50, 50], poiseMax: 99, moves: { regen: { intent: 'buff', weight: 1, effects: [{ op: 'heal', target: 'self', amount: 4 }] } } },
  { id: 'tAi', name: 'T AI', hp: [999, 999], poiseMax: 999, moves: { a: { intent: 'unknown', weight: 9999, maxConsecutive: 1 }, b: { intent: 'unknown', weight: 1 } } },
  {
    id: 'tDelayer', name: 'T Delayer', hp: [60, 60], poiseMax: 5, firstMove: 'held',
    moves: { held: { intent: 'attack', damage: 16, weight: 1, delay: { turns: 1, whileCharging: { block: 8 } } } },
  },
];

// Test fixtures are tagged the way shipped content is: junction rows, never a
// field on the def. model/tags.js refuses a def that carries its own `tags`.
const TEST_TAGGING = [
  { family: 'enemy', scope: '', objectId: 'tBeast', tagId: 'beast' },
];

function testBundle() {
  return {
    ...contentBundle,
    tagging: [...contentBundle.tagging, ...TEST_TAGGING],
    cards: [...contentBundle.cards, ...TEST_CARDS],
    statuses: [...contentBundle.statuses, ...TEST_STATUSES],
    enemies: [...contentBundle.enemies, ...TEST_ENEMIES],
  };
}

const REG = createRegistries(testBundle());

// #90 — equipPiece now gates on OWNERSHIP as well as fit, and the argument is
// required so a stale call site fails closed rather than skipping the check.
// The blocks below that predate #90 are about the FIT gate, so they hand it an
// owner that has everything: the ownership gate has its own block (41) and
// mixing the two would make either failure look like the other.
const OWNS_EVERYTHING = { has: () => true };

// #95 — the same shape one argument later. equipPiece also gates on WHETHER A
// FIGHT IS ON, and that context is required for the same reason: a default of
// "not in combat" fails OPEN, so every call site written after today would
// re-arm mid-fight by saying nothing. Blocks that predate #95 are about the fit
// and ownership gates, so they declare the context they were always assuming.
const REQUIREMENT_TEST_ATTRIBUTES = { strength: 15, dexterity: 15, constitution: 15, wisdom: 15, intelligence: 15 };
const AT_CAMP = { inCombat: false, attributes: REQUIREMENT_TEST_ATTRIBUTES };
const MID_FIGHT = { inCombat: true, attributes: REQUIREMENT_TEST_ATTRIBUTES };
const TEST_ARMAMENT_INTRINSICS = Object.freeze({
  attackRating: 0,
  defenseRating: 0,
  weight: 0,
  poiseThreshold: 0,
  weaponArtManaCost: 0,
  uniqueSkillStaminaCost: 0,
});

// #104 — THE WIDE, SEALED SLOT, WOKEN ONCE. `talisman` is the only row in
// equipSlots.csv that is BOTH multi-set (`sets=3`) and `swap=outOfCombat`, so it
// is the only cell where the swap seal and the set ladder can be told apart —
// every other multi-set slot is combat-swappable, which is exactly why a whole
// gate could go unenforced with the suite green. It is empty in shipped content,
// so two checks have to wake it: 31b's too-few-rungs fuse and 31e's mid-fight
// seal. **Waking it twice would be the second copy**, and the dormancy is one
// CSV row deep either way (Law 1 clause 1) — so it is authored here, once, as
// test-only content that is never shipped.
const TEST_CHARM = {
  id: 'testCharm', name: 'Charm', kind: 'talisman', hand: '',
  rarity: 'common', mods: [], unlock: '', ...TEST_ARMAMENT_INTRINSICS,
};
const REG_CHARM = {
  ...REG,
  equipment: { ...REG.equipment, armaments: [...REG.equipment.armaments, TEST_CHARM] },
};

// deck: array of cardId strings or { id, up: true }
function makeCombat({ seed = 0xc0ffee, deck = ['strike'], enemies = ['tDummy'], hp = 78, maxHp = 78, mana = 2, maxMana = 2, relicIds = [], flasks = [] } = {}) {
  const rng = createRng(seed >>> 0);
  const instances = deck.map((d, i) => {
    const isObj = typeof d === 'object';
    return { instanceId: `c${i + 1}`, cardId: isObj ? d.id : d, upgraded: isObj ? !!d.up : false };
  });
  return createCombat({
    registries: REG,
    rng,
    player: { classId: 'reaver', maxHp, hp, mana, maxMana, energyMax: 3, drawPerTurn: 5, deck: instances, relicIds, flasks },
    enemyIds: enemies,
  });
}

function playFromHand(combat, cardId, targetId = 'e1') {
  const inst = combat.piles.hand.find((c) => c.cardId === cardId);
  if (!inst) throw new Error(`'${cardId}' not in hand: [${combat.piles.hand.map((c) => c.cardId).join(', ')}]`);
  return dispatch(combat, { type: 'playCard', cardInstanceId: inst.instanceId, targetId });
}

function logOf(combat, type) {
  return combat.eventLog.filter((e) => e.type === type);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export async function runTests({ artManifest = null, assetExists = null, legacyRunSave = null, preE6RunSave = null } = {}) {
  const results = [];
  const test = (name, fn) => {
    try {
      const out = fn();
      // An async test body would resolve AFTER this returns, so every throw
      // inside it would be swallowed and the test would report green forever.
      // Refuse it rather than quietly lie — the same rule as every other
      // fallback here: if it can fail silently, make it fail loudly instead.
      if (out && typeof out.then === 'function') {
        throw new Error('test body returned a promise; this harness is synchronous — pass data in via runTests({...}) instead');
      }
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, detail: e && e.message ? e.message : String(e) });
    }
  };
  const skip = (name, why) => results.push({ name, ok: true, skipped: true, detail: why });
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };
  const eq = (a, b, msg) => assert(a === b, `${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

  // ---- 1. Damage order (SPEC §4.2) ----------------------------------------
  test('1. damage order: (6+2 Str) ×0.75 Weak ×1.5 Vuln = 9, floor once, min 0', () => {
    const c = makeCombat({ deck: ['strike', 'strike', 'strike', 'strike', 'strike'] });
    S.applyStatus(c, c.player, 'strength', 2);
    S.applyStatus(c, c.player, 'weak', 1);
    S.applyStatus(c, getEntity(c, 'e1'), 'vulnerable', 1);
    playFromHand(c, 'strike');
    const hit = logOf(c, 'damageDealt').pop();
    eq(hit.amount, 9, 'final damage');
    eq(computeAttackDamage(c, c.player, getEntity(c, 'e1'), -20), 0, 'negative damage clamps to 0');
    eq(computeAttackDamage(c, c.player, null, 7), Math.floor((7 + 2) * 0.75), 'attacker-only math (single floor)');
  });

  // ---- 2. Block absorb / expiry / Unbreakable cap ---------------------------
  test('2. block absorbs first, expires at player turn start; Unbreakable retains with cap', () => {
    const c = makeCombat({ deck: ['defend', 'defend', 'defend', 'defend', 'defend'], enemies: ['tHitter'] });
    playFromHand(c, 'defend');
    eq(c.player.block, 5, 'block gained');
    dispatch(c, { type: 'endTurn' });
    const hit = logOf(c, 'damageDealt').filter((e) => e.targetId === 'player').pop();
    eq(hit.amount, 10, 'enemy hit');
    eq(hit.blocked, 5, 'block absorbed first');
    eq(c.player.block, 0, 'block expired at player turn start');

    const u = makeCombat({ deck: ['unbreakable', 'defend', 'defend', 'defend', 'defend'] });
    playFromHand(u, 'unbreakable');
    playFromHand(u, 'defend');
    eq(u.player.block, 5, 'block before retain');
    dispatch(u, { type: 'endTurn' });
    eq(u.player.block, 5, 'Unbreakable retains block');
    // Accumulate past the cap.
    for (const cardId of u.piles.hand.filter((x) => x.cardId === 'defend').slice(0, 3).map((x) => x.cardId)) {
      playFromHand(u, cardId);
    }
    dispatch(u, { type: 'endTurn' });
    while (u.player.block < 30) {
      const d = u.piles.hand.find((x) => x.cardId === 'defend');
      if (!d || u.player.energy < 1) {
        dispatch(u, { type: 'endTurn' });
        continue;
      }
      dispatch(u, { type: 'playCard', cardInstanceId: d.instanceId });
    }
    eq(u.player.block, 30, 'blockCap 30 honored');
  });

  // ---- 3. Frail + Dexterity block math --------------------------------------
  test('3. block = floor((5 + 2 Dex) × 0.75 Frail) = 5', () => {
    const c = makeCombat({ deck: ['defend', 'defend', 'defend', 'defend', 'defend'] });
    S.applyStatus(c, c.player, 'dexterity', 2);
    S.applyStatus(c, c.player, 'frail', 1);
    playFromHand(c, 'defend');
    eq(logOf(c, 'blockGained').filter((e) => e.targetId === 'player').pop().amount, 5, 'frail+dex block');
  });

  // ---- 4. Deterministic seeded reshuffle -------------------------------------
  test('4. fixed seed → identical draw order across runs, reshuffle included', () => {
    const draws = () => {
      const c = makeCombat({ deck: Array(8).fill('strike'), seed: 0xdead });
      dispatch(c, { type: 'endTurn' });
      dispatch(c, { type: 'endTurn' });
      assert(logOf(c, 'deckShuffled').length >= 2, 'reshuffle happened');
      return logOf(c, 'cardDrawn').map((e) => e.cardInstanceId).join(',');
    };
    eq(draws(), draws(), 'deterministic draws');
  });

  // ---- 5. Hand limit overflow → discard ---------------------------------------
  test('5. draws past 10-card hand go to discard (handFull)', () => {
    const c = makeCombat({ deck: ['tBigDraw', ...Array(11).fill('strike')] });
    playFromHand(c, 'tBigDraw');
    eq(c.piles.hand.length, 10, 'hand capped at 10');
    assert(logOf(c, 'cardDiscarded').some((e) => e.reason === 'handFull'), 'handFull discard emitted');
  });

  // ---- 6. Keywords + X-cost -----------------------------------------------------
  test('6. Exhaust / Ethereal / Retain / Innate / X-cost / upgrade removes Exhaust', () => {
    const c = makeCombat({ deck: ['kickOff', 'lastStand', 'tKeep', 'strike', 'strike'] });
    playFromHand(c, 'kickOff');
    assert(c.piles.exhaust.some((x) => x.cardId === 'kickOff'), 'Exhaust card exhausted on play');
    dispatch(c, { type: 'endTurn' });
    assert(c.piles.exhaust.some((x) => x.cardId === 'lastStand'), 'Ethereal exhausted at turn end');
    assert(c.piles.hand.some((x) => x.cardId === 'tKeep'), 'Retain kept in hand');

    const inn = makeCombat({ deck: ['warriorsVow', ...Array(9).fill('strike')], seed: 0xbeef });
    assert(inn.piles.hand.some((x) => x.cardId === 'warriorsVow'), 'Innate in opening hand');

    const x = makeCombat({ deck: ['stitchedArms', 'strike', 'strike', 'strike', 'strike'] });
    playFromHand(x, 'stitchedArms');
    eq(x.player.energy, 0, 'X-cost consumed all energy');
    eq(logOf(x, 'damageDealt').filter((e) => e.sourceId === 'player').length, 3, '3 energy → 3 hits');

    // X = 0 whiffs entirely (StS): playable, but zero hits.
    const x0 = makeCombat({ deck: ['stitchedArms', 'defend', 'defend', 'defend', 'strike'] });
    playFromHand(x0, 'defend');
    playFromHand(x0, 'defend');
    playFromHand(x0, 'defend');
    eq(x0.player.energy, 0, 'energy spent on defends');
    playFromHand(x0, 'stitchedArms');
    eq(logOf(x0, 'damageDealt').filter((e) => e.sourceId === 'player').length, 0, 'X=0 → 0 hits');

    const up = resolveCard(REG, { cardId: 'kickOff', upgraded: true });
    assert(!up.keywords.includes('exhaust'), 'Kick Off+ upgrade removed Exhaust');
    eq(resolveCard(REG, { cardId: 'hemorrhage', upgraded: true }).keywords.length, 0, 'Hemorrhage+ removed Exhaust');
  });

  // ---- 7. Bleed threshold-proc (#61): accumulate / own-proc burst / clamp /
  // reset-to-zero / constant threshold / per-proc poise ------------------------
  // Pins Constantine's direction (2026-08-06): burst at the threshold as ITS
  // OWN PROC, build-up resets to zero (overflow dropped), threshold constant.
  // The pre-#61 contract this replaces: overflow carried, threshold ×1.5.
  test('7. Bleed procs at its table threshold for clamp(15% maxHp, 8, 35) as its own event; resets to zero; threshold constant; +3 poise per proc', () => {
    // Threshold-DERIVED, not pinned: the knob is PROVISIONAL and his to move
    // (Constantine, "let rune pick the threshold against the sim") — the
    // contract under test is the mechanism, not the current pick.
    const T = REG.statuses.get('bleed').proc.threshold;
    const c = makeCombat({ deck: Array(6).fill('gorefireSlash') });
    const e1 = getEntity(c, 'e1');
    S.applyStatus(c, e1, 'bleed', T - 3); // sub-threshold build-up
    eq(S.getStacks(e1, 'bleed'), T - 3, 'bleed accumulated, no decay');
    dispatch(c, { type: 'endTurn' });
    eq(S.getStacks(e1, 'bleed'), T - 3, 'bleed persists through turns');
    const poiseBefore = e1.poiseMeter.value;
    playFromHand(c, 'gorefireSlash'); // +3 → T exactly → proc
    // The own-proc invariant: the burst is its own damage-record entry —
    // a procBurst event plus its own hpLost — never folded into the
    // triggering hit's damageDealt.
    const proc = logOf(c, 'procBurst').filter((e) => e.targetId === 'e1').pop();
    assert(proc, 'procBurst emitted as its own event');
    eq(proc.amount, 8, '15% of 30 = 4.5 → min-clamped to 8');
    const hit = logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1' && e.isAttack).pop();
    eq(hit.amount, 5, "triggering hit's damageDealt stays the card's own 5 — burst not folded in");
    const burst = logOf(c, 'hpLost').filter((e) => e.targetId === 'e1' && e.cause === 'proc:bleed').pop();
    assert(burst, "burst hpLost carries cause 'proc:bleed' — attributable in the damage record");
    eq(burst.amount, 8, 'burst hpLost is its own entry');
    eq(e1.statuses.bleed.meter.value, 0, 'build-up RESET TO ZERO after proc');
    eq(e1.statuses.bleed.meter.max, T, 'threshold CONSTANT — no ×1.5 (pre-#61 behavior gone)');
    eq(e1.poiseMeter.value, poiseBefore + 3, 'fixed 3 poise damage per proc (PROVISIONAL knob)');

    const g = makeCombat({ deck: Array(8).fill('gorefireSlash'), enemies: ['tGiant'] });
    S.applyStatus(g, getEntity(g, 'e1'), 'bleed', T - 3);
    playFromHand(g, 'gorefireSlash'); // → T → proc on the giant
    const gb = logOf(g, 'procBurst').filter((e) => e.targetId === 'e1').pop();
    eq(gb.amount, 35, '15% of 400 = 60 → max-clamped to 35');

    // Overflow is DROPPED at proc (reset-to-zero, his words) — (T-1) + 3
    // procs once and leaves 0, not 2. This is the anti-stranding delta the
    // #61 falsifier measures.
    const o = makeCombat({ deck: Array(6).fill('gorefireSlash') });
    S.applyStatus(o, getEntity(o, 'e1'), 'bleed', T - 1);
    playFromHand(o, 'gorefireSlash'); // T-1+3 = T+2 ≥ T → proc
    eq(logOf(o, 'procBurst').filter((e) => e.targetId === 'e1').length, 1, 'single proc');
    eq(getEntity(o, 'e1').statuses.bleed.meter.value, 0, 'overflow dropped, not carried');
  });

  // ---- 7b. Frost proc (#61): smaller percent, leaves Weak + Frost-Exposed ----
  test('7b. Frost procs at 10 for clamp(8% maxHp, 4, 20); leaves Weak and Frost-Exposed; no poise, no stagger', () => {
    const c = makeCombat({ deck: ['tFrost10', 'tPlainHit'] });
    const e1 = getEntity(c, 'e1');
    const poiseBefore = e1.poiseMeter.value;
    playFromHand(c, 'tFrost10'); // 10 ≥ threshold 10 → proc
    const proc = logOf(c, 'procBurst').filter((e) => e.targetId === 'e1' && e.status === 'frost').pop();
    assert(proc, 'frost procBurst emitted');
    eq(proc.amount, 4, '8% of 30 = 2.4 → min-clamped to 4');
    eq(e1.statuses.frost.meter.value, 0, 'frost build-up reset to zero');
    eq(S.getStacks(e1, 'weak'), 1, 'proc left Weak (the damage debuff)');
    eq(S.getStacks(e1, 'frostExposed'), 1, 'proc left Frost-Exposed');
    eq(e1.poiseMeter.value, poiseBefore, 'frost has no poiseDamage knob set');
    assert(!e1.skipNextTurn, 'frost does not stagger');
  });

  // ---- 7c. Insanity proc (#61): highest percent, poise, guaranteed stagger ---
  test('7c. Insanity procs at 14 for clamp(18% maxHp, 10, 40); +8 poise; direct stagger bypasses the bar', () => {
    const c = makeCombat({ deck: ['tInsanity14'] });
    const e1 = getEntity(c, 'e1');
    const poiseBefore = e1.poiseMeter.value;
    playFromHand(c, 'tInsanity14'); // 14 ≥ threshold 14 → proc
    const proc = logOf(c, 'procBurst').filter((e) => e.status === 'insanity').pop();
    assert(proc, 'insanity procBurst emitted');
    eq(proc.amount, 10, '18% of 30 = 5.4 → min-clamped to 10');
    eq(e1.poiseMeter.value, poiseBefore + 8, '+8 poise per proc (PROVISIONAL, highest of the three)');
    assert(e1.skipNextTurn, 'staggered DIRECTLY — poiseMax 99 bar nowhere near full');
    assert(logOf(c, 'enemyStaggered').some((e) => e.targetId === 'e1'), 'enemyStaggered emitted');
    eq(e1.intent.kind, 'staggered', 'intent shows the break');
    eq(S.getStacks(e1, 'insanityExposed'), 1, 'proc left Unraveled (tag-scoped vulnerability)');
  });

  // ---- 7d. Post-proc resistance (#61): tag-gated, halves points, expires -----
  test('7d. Bleed resistance: beast-tagged target gains Clotted after proc, points halve with a procResisted receipt, resist expires', () => {
    // Positive arm: tagged enemy → resist applied on proc. The proc fires
    // inside a dispatch (card play) so the enqueued resistance drains.
    // Threshold-derived like test 7 — the knob is provisional.
    const T = REG.statuses.get('bleed').proc.threshold;
    const c = makeCombat({ deck: Array(6).fill('gorefireSlash'), enemies: ['tBeast'] });
    const e1 = getEntity(c, 'e1');
    S.applyStatus(c, e1, 'bleed', T - 3);
    playFromHand(c, 'gorefireSlash'); // +3 → T → proc
    eq(S.getStacks(e1, 'bleedResist'), 1, 'Clotted applied — beast tag matched the gate');
    // Resistance halves the NEXT application, defender-favored rounding:
    // 3 points → blocked ceil(1.5)=2, applied 1 — with a visible receipt.
    S.applyStatus(c, e1, 'bleed', 3);
    const receipt = logOf(c, 'procResisted').filter((e) => e.targetId === 'e1').pop();
    assert(receipt, 'procResisted receipt emitted — refusal is visible, never silent');
    eq(receipt.blocked, 2, 'blocked ceil(3×50%)=2');
    eq(e1.statuses.bleed.meter.value, 1, 'only 1 of 3 points landed');
    // Expiry: duration 2 decays at the owner's turn end ×2 → resist gone,
    // full points land again.
    dispatch(c, { type: 'endTurn' });
    dispatch(c, { type: 'endTurn' });
    eq(S.getStacks(e1, 'bleedResist'), 0, 'Clotted expired after its duration');
    S.applyStatus(c, e1, 'bleed', 3);
    eq(e1.statuses.bleed.meter.value, 1 + 3, 'post-expiry application lands in full');

    // Negative arm: untagged enemy → gate closed, no resist ever.
    const u = makeCombat({ deck: ['strike'] }); // tDummy, no tags
    const ue = getEntity(u, 'e1');
    S.applyStatus(u, ue, 'bleed', T);
    eq(S.getStacks(ue, 'bleedResist'), 0, 'untagged target gains no resistance');
    // Zero-bleed empty edge: applying 0 is a no-op, no proc, no crash.
    S.applyStatus(u, ue, 'bleed', 0);
    eq(logOf(u, 'procBurst').filter((e) => e.status === 'bleed').length, 1, 'zero application cannot proc');
  });

  // ---- 7e. Tag-scoped vulnerability (#61): declared stacking + the ceiling ---
  test('7e. Frost-Exposed boosts only tagged hits; declared stacking composes; the ceiling is stack-invariant', () => {
    const c = makeCombat({ deck: ['tStarHit', 'tPlainHit', 'tStarHit', 'tPlainHit', 'tStarHit'], enemies: ['tGiant'] });
    const e1 = getEntity(c, 'e1');
    S.applyStatus(c, e1, 'frostExposed', 1);
    playFromHand(c, 'tPlainHit');
    let last = logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop();
    eq(last.amount, 10, 'untagged hit unaffected by Frost-Exposed');
    playFromHand(c, 'tStarHit');
    last = logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop();
    eq(last.amount, 12, 'starstone hit ×1.25 (multiplicative row)');
    // Composes with regular Vulnerable multiplicatively: 10 × 1.5 × 1.25 = 18.75 → 18.
    S.applyStatus(c, e1, 'vulnerable', 1);
    playFromHand(c, 'tStarHit');
    last = logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop();
    eq(last.amount, 18, 'stacks WITH Vulnerable: floor(10 × 1.5 × 1.25)');
    // THE CEILING (known-bad probe answered): every vulnerability lane is
    // flat-per-status and stack-count-invariant, so max compose is the
    // closed-form product of DISTINCT table mults — stacks cannot raise it.
    S.applyStatus(c, e1, 'frostExposed', 99);
    S.applyStatus(c, e1, 'vulnerable', 99);
    if (c.player.energy === 0) dispatch(c, { type: 'endTurn' });
    playFromHand(c, 'tStarHit');
    last = logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop();
    eq(last.amount, 18, '99 stacks of both: SAME 18 — the ceiling is the table, not the stacks');
    // Additive lane: declared 'additive' pools (mult−1). tAddVuln 1.5-additive
    // + frostExposed 1.25-mult on the same tagged hit:
    // 10 × 1.25 × (1 + 0.5) = 18.75 → 18.
    const a = makeCombat({ deck: ['tStarHit'], enemies: ['tGiant'] });
    const ae = getEntity(a, 'e1');
    S.applyStatus(a, ae, 'frostExposed', 1);
    S.applyStatus(a, ae, 'tAddVuln', 1);
    playFromHand(a, 'tStarHit');
    const al = logOf(a, 'damageDealt').filter((e) => e.targetId === 'e1').pop();
    eq(al.amount, 18, 'additive lane pools once, multiplicative lane per source');
  });

  // These two falsifiers use SHIPPED cards whose tags exist only in the
  // generated tagging.csv index. Neither damage effect carries a copied
  // `tags` field, so green here proves the real card door derives the hit's
  // identity rather than preserving the old test-only tagged-effect fixture.
  test('7e2. Frost-Exposed changes a real Starstone hit through tagging.csv', () => {
    const c = makeCombat({ deck: ['starstonePebble'], enemies: ['tGiant'] });
    const e1 = getEntity(c, 'e1');
    const def = REG.cards.get('starstonePebble');
    assert(def.effects.filter((eff) => eff.op === 'damage').every((eff) => eff.tags === undefined), 'Starstone Pebble damage does not hand-copy CSV tags');
    assert(tagIdsFor('starstonePebble').includes('starstone'), 'CSV index names Starstone Pebble as starstone');
    S.applyStatus(c, e1, 'frostExposed', 1);
    const pv = previewCard(c, c.piles.hand[0].instanceId, 'e1');
    eq(pv.values.find((v) => v.op === 'damage').value, 7, 'preview derives starstone: floor(6 × 1.25)');
    playFromHand(c, 'starstonePebble');
    eq(logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop().amount, 7, 'execution derives the same starstone hit');
  });

  test('7e3. Unraveled changes a real Blight hit through tagging.csv', () => {
    const c = makeCombat({ deck: ['blightTouch'], enemies: ['tGiant'] });
    const e1 = getEntity(c, 'e1');
    const def = REG.cards.get('blightTouch');
    assert(def.effects.filter((eff) => eff.op === 'damage').every((eff) => eff.tags === undefined), 'Blight Touch damage does not hand-copy CSV tags');
    assert(tagIdsFor('blightTouch').includes('blight'), 'CSV index names Blight Touch as blight');
    S.applyStatus(c, e1, 'insanityExposed', 1);
    const pv = previewCard(c, c.piles.hand[0].instanceId, 'e1');
    eq(pv.values.find((v) => v.op === 'damage').value, 6, 'preview derives blight: floor(5 × 1.3)');
    playFromHand(c, 'blightTouch');
    eq(logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop().amount, 6, 'execution derives the same blight hit');
  });

  // ---- 7f. Known-bads through the REAL bundle (#61): each red names its row --
  test('7f. proc vocabulary known-bads: bad threshold, bad percent, unknown tag, bad duration, bad stacking — red, naming rows', () => {
    const withStatus = (row) => ({ ...contentBundle, statuses: [...contentBundle.statuses, row] });
    const base = { name: 'ZZ', stackMode: 'add', decay: 'none' };
    const expectRed = (bundle, rowPath, needle, label) => {
      const v = validateContent(bundle);
      assert(!v.ok, `${label}: bundle must fail`);
      assert(
        v.errors.some((e) => e.path.startsWith(rowPath) && e.msg.includes(needle)),
        `${label}: red names ${rowPath} (got: ${v.errors.map((e) => `${e.path}: ${e.msg}`).join(' | ')})`
      );
    };
    expectRed(
      withStatus({ ...base, id: 'zzProc1', proc: { threshold: 0, burstPercent: 15, burstMin: 8, burstMax: 35 } }),
      'statuses.zzProc1.proc.threshold', 'integer > 0', 'threshold 0'
    );
    expectRed(
      withStatus({ ...base, id: 'zzProc2', proc: { threshold: 12, burstPercent: 150, burstMin: 8, burstMax: 35 } }),
      'statuses.zzProc2.proc.burstPercent', '(0, 100]', 'percent 150'
    );
    expectRed(
      withStatus({ ...base, id: 'zzProc3', proc: { threshold: 12, burstPercent: 15, burstMin: 8, burstMax: 35, resistance: { status: 'bleedResist', tags: ['dragon'] } } }),
      'statuses.zzProc3.proc.resistance.tags', "unknown creature tag 'dragon' (legal:", 'unknown creature tag — message lists the legal set'
    );
    expectRed(
      withStatus({ ...base, id: 'zzProc4', decay: 'none', resists: { status: 'bleed', percent: 50 } }),
      'statuses.zzProc4.decay', 'duration', 'resist row without a duration'
    );
    expectRed(
      withStatus({ ...base, id: 'zzProc5', taggedVulnerability: { tags: ['starstone'], mult: 1.25, stacking: 'banana' } }),
      'statuses.zzProc5', 'banana', 'stacking outside the closed enum'
    );
    expectRed(
      withStatus({ ...base, id: 'zzProc6', taggedVulnerability: { tags: ['dragonfire'], mult: 1.25, stacking: 'additive' } }),
      'statuses.zzProc6.taggedVulnerability.tags', "unknown effect tag 'dragonfire' (legal:", 'unknown effect tag — message lists the legal set'
    );
    expectRed(
      withStatus({ ...base, id: 'zzProc7', proc: { threshold: 12, burstPercent: 15, burstMin: 40, burstMax: 35 } }),
      'statuses.zzProc7.proc', 'burstMin 40 exceeds burstMax 35', 'min > max'
    );
    // Vira's gate, finding 1 — the recurring finite class, closed by ONE
    // shared helper (finitePositive in validate.js), not a fourth patch.
    // Both were OBSERVED GREEN at ab33e41 before the helper landed.
    expectRed(
      withStatus({ ...base, id: 'zzProc8', taggedVulnerability: { tags: ['starstone'], mult: Infinity, stacking: 'multiplicative' } }),
      'statuses.zzProc8.taggedVulnerability.mult', 'finite', 'mult Infinity (damage *= Infinity at play)'
    );
    expectRed(
      withStatus({ ...base, id: 'zzProc9', proc: { threshold: 12, burstPercent: 15, burstMin: -10, burstMax: -5 } }),
      'statuses.zzProc9.proc.burstMin', '≥ 0', 'negative burst band (a proc that fires and silently no-ops)'
    );
    // Finding 2 — reverse-direction: a resist row naming a non-proc status is
    // consulted by nobody.
    expectRed(
      withStatus({ ...base, id: 'zzProc10', decay: { duration: 2 }, stackMode: 'refresh', resists: { status: 'weak', percent: 50 } }),
      'statuses.zzProc10.resists.status', 'never be consulted', 'resist row pointing at a non-proc status'
    );
    // Finding 3 — empty resistance.tags held to the same red as empty
    // taggedVulnerability.tags: one screen, one rule.
    expectRed(
      withStatus({ ...base, id: 'zzProc11', proc: { threshold: 12, burstPercent: 15, burstMin: 8, burstMax: 35, resistance: { status: 'bleedResist', tags: [] } } }),
      'statuses.zzProc11.proc.resistance.tags', 'non-empty', 'empty resistance tag gate (a resistance no creature can trigger)'
    );
    // Both shipped edges stay green: the real bundle validates.
    assert(validateContent(contentBundle).ok, 'shipped bundle stays green');
  });

  // ---- 7g. The collision drive (#61, Marina's rider — Vira drove it at the
  // gate, this is her drive as a fixture): two procs, one card play, one
  // beast-tagged target. Everything must hold at once: both bursts attributed,
  // both resets exact, both resistances granted. -------------------------------
  test('7g. bleed 12 + frost 10 in one play on a beast: both proc, 8+4 attributed, both reset, both resistances land', () => {
    const c = makeCombat({ deck: ['tCollide'], enemies: ['tBeast'] });
    const e1 = getEntity(c, 'e1');
    playFromHand(c, 'tCollide');
    const procs = logOf(c, 'procBurst').filter((e) => e.targetId === 'e1');
    eq(procs.length, 2, 'both procs fired from one card play');
    eq(procs.filter((e) => e.status === 'bleed')[0].amount, 8, 'bleed burst min-clamped to 8');
    eq(procs.filter((e) => e.status === 'frost')[0].amount, 4, 'frost burst min-clamped to 4');
    // Attribution: each burst is its own hpLost with its own cause — 8+4,
    // never a merged 12 (the own-proc invariant under collision).
    const losses = logOf(c, 'hpLost').filter((e) => e.targetId === 'e1');
    eq(losses.filter((e) => e.cause === 'proc:bleed').reduce((s, e) => s + e.amount, 0), 8, 'bleed loss attributed proc:bleed');
    eq(losses.filter((e) => e.cause === 'proc:frost').reduce((s, e) => s + e.amount, 0), 4, 'frost loss attributed proc:frost');
    eq(e1.hp, 30 - 12, 'total 12 landed, as two entries');
    eq(e1.statuses.bleed.meter.value, 0, 'bleed build-up reset exactly to zero');
    eq(e1.statuses.frost.meter.value, 0, 'frost build-up reset exactly to zero');
    eq(S.getStacks(e1, 'bleedResist'), 1, 'Clotted granted — beast matched bleed\'s gate');
    eq(S.getStacks(e1, 'frostResist'), 1, 'Weathered granted — beast matched frost\'s gate');
    eq(S.getStacks(e1, 'weak'), 1, 'frost\'s Weak landed through the collision');
    eq(S.getStacks(e1, 'frostExposed'), 1, 'frost\'s exposure landed through the collision');
  });

  // ---- 8. Crimson Blight: tick / expire after 3 / refresh ---------------------------
  test('8. Blight ticks at enemy turn start, expires entirely after 3 turns, re-apply refreshes', () => {
    const c = makeCombat({ deck: Array(5).fill('defend') });
    const e1 = getEntity(c, 'e1');
    S.applyStatus(c, e1, 'crimsonBlight', 4);
    dispatch(c, { type: 'endTurn' }); // enemy turn 1
    let ticks = logOf(c, 'hpLost').filter((e) => e.targetId === 'e1');
    eq(ticks.length, 1, 'one tick');
    eq(ticks[0].amount, 4, 'tick = stacks');
    S.applyStatus(c, e1, 'crimsonBlight', 2); // 6 stacks, duration refreshed to 3
    dispatch(c, { type: 'endTurn' }); // tick 6 (duration 3→2)
    dispatch(c, { type: 'endTurn' }); // tick 6 (2→1)
    dispatch(c, { type: 'endTurn' }); // tick 6 (1→0 → expired)
    ticks = logOf(c, 'hpLost').filter((e) => e.targetId === 'e1');
    eq(ticks.map((t) => t.amount).join(','), '4,6,6,6', 'tick sequence');
    assert(!e1.statuses.crimsonBlight, 'blight expired entirely');
    assert(logOf(c, 'statusExpired').some((e) => e.status === 'crimsonBlight' && e.reason === 'expired'), 'expired event');
  });

  // ---- 9. Poise: fill → Stagger (skip + 1.5× window + growth + cancel delayed) ----
  test('9. Poise fill Staggers: skips turn, +50% window, poiseMax ×1.25, cancels Held Blade', () => {
    const c = makeCombat({ deck: ['tPoise', 'strike', 'strike', 'strike', 'strike'], enemies: ['tDelayer'] });
    const e1 = getEntity(c, 'e1');
    assert(c.eventLog.length > 0, 'combat created');
    eq(previewIntent(c, 'e1').delayed, true, 'Held Blade telegraphs as delayed');
    dispatch(c, { type: 'endTurn' }); // enemy commits: +8 block, pendingMove
    eq(e1.block, 8, 'whileCharging block');
    assert(e1.pendingMove, 'move committed');
    playFromHand(c, 'tPoise'); // 10 poise vs max 5 → Stagger
    const st = logOf(c, 'enemyStaggered').pop();
    assert(st, 'staggered');
    eq(st.cancelledMove, 'held', 'Held Blade cancelled by Stagger');
    assert(!e1.pendingMove, 'pending cleared');
    eq(e1.poiseMeter.max, 7, 'poiseMax grew ceil(5×1.25)=7');
    eq(S.getStacks(e1, 'staggered'), 2, 'staggered status applied (2-turn window)');
    playFromHand(c, 'strike');
    eq(logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop().amount, 9, 'staggered takes 6×1.5=9');
    const hpBefore = c.player.hp;
    dispatch(c, { type: 'endTurn' }); // enemy turn skipped
    eq(c.player.hp, hpBefore, 'staggered enemy dealt no damage');
    eq(S.getStacks(e1, 'staggered'), 1, 'staggered decayed at enemy turn end');
    playFromHand(c, 'strike');
    eq(logOf(c, 'damageDealt').filter((e) => e.targetId === 'e1').pop().amount, 9, 'window still open on player\'s next turn');
  });

  // ---- 10b. Same-stance re-entry is a no-op (StS) -------------------------------
  test('10b. re-entering the current stance is a no-op (no onEnter re-trigger)', () => {
    const c = makeCombat({ deck: ['enterGorefire', 'enterGorefire', 'strike', 'strike', 'strike'] });
    playFromHand(c, 'enterGorefire');
    eq(c.player.hp, 76, 'first entry costs 2 HP');
    playFromHand(c, 'enterGorefire');
    eq(c.player.hp, 76, 'second entry did NOT re-trigger the 2 HP onEnter');
    eq(logOf(c, 'stanceEntered').length, 1, 'only one stanceEntered event');
    eq(c.player.stanceId, 'gorefire', 'still in the stance');
  });

  // ---- 10. Stances -------------------------------------------------------------
  test('10. stance exclusivity; Gorefire per-hit Bleed; Bulwark on-Skill block', () => {
    const c = makeCombat({ deck: ['enterGorefire', 'twinbladeFlurry', 'enterBulwark', 'defend', 'strike'] });
    playFromHand(c, 'enterGorefire');
    eq(c.player.stanceId, 'gorefire', 'entered gorefire');
    eq(c.player.hp, 76, 'entering Gorefire cost 2 HP (ignores block)');
    playFromHand(c, 'twinbladeFlurry');
    eq(S.getStacks(getEntity(c, 'e1'), 'bleed'), 6, '3 hits × 2 Bleed per hit');
    playFromHand(c, 'enterBulwark');
    eq(c.player.stanceId, 'bulwark', 'stance switched (exclusive)');
    assert(logOf(c, 'stanceExited').some((e) => e.stance === 'gorefire'), 'exited event');
    eq(c.player.block, 3, 'Bulwark onEnter +3 (its own play does not double-trigger)');
    dispatch(c, { type: 'endTurn' });
    const d = c.piles.hand.find((x) => x.cardId === 'defend' || x.cardId === 'enterGorefire');
    const before = c.player.block;
    const skill = c.piles.hand.find((x) => resolveCard(REG, x).type === 'skill' && resolveCard(REG, x).cardId !== undefined) || d;
    const defend = c.piles.hand.find((x) => x.cardId === 'defend');
    if (defend) {
      dispatch(c, { type: 'playCard', cardInstanceId: defend.instanceId });
      eq(c.player.block - before, 7, 'Skill in Bulwark: 5 block + 2 stance');
    } else {
      // Deck order variance: play any skill and expect the +2 rider.
      assert(skill, 'a skill is in hand');
      const b0 = c.player.block;
      dispatch(c, { type: 'playCard', cardInstanceId: skill.instanceId });
      assert(c.player.block >= b0 + 2, 'Bulwark added 2 block on Skill play');
    }
  });

  // ---- 11. maxConsecutive over many rolls -----------------------------------------
  test('11. maxConsecutive never violated over 200 rolls (weight 9999:1)', () => {
    const c = makeCombat({ deck: Array(5).fill('defend'), enemies: ['tAi'], seed: 0xabcd });
    for (let i = 0; i < 200 && !c.result; i++) dispatch(c, { type: 'endTurn' });
    const hist = getEntity(c, 'e1').movesHistory;
    assert(hist.length >= 200, 'history recorded');
    for (let i = 1; i < hist.length; i++) {
      assert(!(hist[i] === 'a' && hist[i - 1] === 'a'), `maxConsecutive violated at ${i}`);
    }
    assert(hist.includes('b'), 'fallback move was forced in');
  });

  // ---- 12. Map generation (SPEC §6, §8.12) -------------------------------------------
  test('12. map gen: fixed-seed snapshot; constraints over 200 seeds', () => {
    const config = contentBundle.mapConfigs[1];
    // READ THE RESOLVED PLAN, never the raw rules. This test used to hardcode
    // "floor 9 all treasure, floor 15 shrine" and read
    // `config.floorRules.noEliteOrShrineBefore` as a number — a second decider
    // for what a rule means, which drifts from the generator the moment the
    // vocabulary changes. It also encoded `15: 'shrine'`, a rule that had never
    // fired. One resolution, every reader (model/floorplan.js).
    const { plan } = resolveFloorPlan(config);
    assert(plan != null, 'act 1 floor rules resolve');
    const gen = (seed) => generateActMap({ config, rng: createRng(seed) });

    // Fixed seed → identical graph (determinism snapshot).
    eq(JSON.stringify(gen(0x715e)), JSON.stringify(gen(0x715e)), 'same seed, same map');

    for (let s = 1; s <= 200; s++) {
      const map = gen(s * 2654435761);
      const nodes = Object.values(map.nodes);

      // Every fixed rank the plan resolved, whatever it resolved to.
      for (const n of nodes) {
        const fixedType = plan.fixed[n.floor];
        if (fixedType) eq(n.type, fixedType, `seed ${s}: fixed ${fixedType} node ${n.id} on floor ${n.floor}`);
        // No early elites/shrines; none on the barred floor (SPEC §6). TWO
        // gates since E13's split — a rest may open below the floor an Elite
        // may, which is what lets a rest be promised BELOW the first Elite.
        if (n.floor < plan.eliteFrom && !plan.fixed[n.floor]) {
          assert(n.type !== 'elite', `seed ${s}: early elite on floor ${n.floor}`);
        }
        if (n.floor < plan.shrineFrom && !plan.fixed[n.floor]) {
          assert(n.type !== 'shrine', `seed ${s}: early shrine on floor ${n.floor}`);
        }
        if (n.floor === plan.noShrineOn) {
          assert(n.type !== 'shrine', `seed ${s}: shrine on the barred floor ${plan.noShrineOn}`);
        }
      }
      // The plan's fixed ranks are not a formality — each must actually land.
      for (const [floor, type] of Object.entries(plan.fixed)) {
        assert(nodes.some((n) => n.floor === Number(floor) && n.type === type),
          `seed ${s}: no ${type} on its fixed floor ${floor}`);
      }
      // `columns` travels with the graph, so the map screen can size its SVG.
      eq(map.columns, config.columns, `seed ${s}: graph carries its column count`);
      eq(map.nodes[map.shrineId].type, 'shrine', `seed ${s}: pre-boss shrine`);
      eq(map.nodes[map.bossId].type, 'boss', `seed ${s}: boss node`);

      // E13: A REST BEFORE THE ELITES. His words were "so eletes, maybe shop,
      // and definitely before a boss"; the boss half was always kept (the top
      // floor is the lone Shrine) and this is the half that was not. Asserted
      // on the GRAPH, which is exactly what the rule promises — the per-path
      // number is measured and printed by tools/mapplan.mjs, never promised.
      if (plan.restBeforeElite) {
        const eliteFloors = nodes.filter((n) => n.type === 'elite').map((n) => n.floor);
        if (eliteFloors.length) {
          const firstElite = Math.min(...eliteFloors);
          const rests = nodes.filter((n) => n.type === 'shrine' && n.floor < firstElite);
          assert(rests.length > 0,
            `seed ${s}: elite on floor ${firstElite} with no shrine on any earlier floor`);
        }
      }

      // Minimum counts (hard promise even via the relax path).
      // NOTE THE NAMES. These were `minReachableElites` / `minReachableMerchants`
      // and this test asserted a COUNT while the name promised REACHABILITY —
      // two different claims, and the graph-wide count is the one that was ever
      // true. Freja measured the gap: 6 of 102 starts reach no Elite at 15x7.
      assert(nodes.filter((n) => n.type === 'elite').length >= plan.minElites, `seed ${s}: elites`);
      assert(nodes.filter((n) => n.type === 'merchant').length >= plan.minMerchants, `seed ${s}: merchant`);

      // No crossing edges within the path floors.
      for (let floor = 1; floor < config.floors - 1; floor++) {
        const es = [];
        for (const n of nodes.filter((x) => x.floor === floor)) {
          for (const toId of n.next) {
            const to = map.nodes[toId];
            if (to.floor === floor + 1) es.push([n.col, to.col]);
          }
        }
        for (let i = 0; i < es.length; i++) {
          for (let j = i + 1; j < es.length; j++) {
            const [a1, a2] = es[i];
            const [b1, b2] = es[j];
            assert(!((a1 < b1 && a2 > b2) || (a1 > b1 && a2 < b2)), `seed ${s}: crossing edges on floor ${floor}`);
          }
        }
      }

      // Boss reachable from EVERY floor-1 start (BFS).
      for (const startId of map.startIds) {
        const seen = new Set([startId]);
        const queue = [startId];
        while (queue.length) {
          for (const nx of map.nodes[queue.shift()].next) {
            if (!seen.has(nx)) {
              seen.add(nx);
              queue.push(nx);
            }
          }
        }
        assert(seen.has(map.bossId), `seed ${s}: boss unreachable from ${startId}`);
      }
    }
  });

  // ---- 13. Save round-trip + versioning (SPEC §3.12, §8.13) ----------------------------
  test('13. save round-trip; unknown schemaVersion and dangling ids refused + archived', () => {
    const storage = createMemoryStorage();
    const saves = createSaveManager(storage);
    const rng = createRng(0xfeed);
    rng.float('shuffle');
    rng.float('cardRewards');
    const run = createRunState({ seed: 0xfeed, classId: 'reaver', registries: REG });
    run.cinders = 123;
    run.floor = 4;
    saves.saveRun(run, rng);

    const loaded = saves.loadRun(REG);
    eq(JSON.stringify(loaded), JSON.stringify(run), 'round-trip identical');
    eq(loaded.streamCounters.shuffle, 1, 'rng counters persisted');

    // Unknown schemaVersion → refused, archived, save slot cleared.
    const tampered = { ...run, schemaVersion: RUN_SCHEMA_VERSION + 99 };
    storage.setItem(RUN_KEY, JSON.stringify(tampered));
    eq(saves.loadRun(REG), null, 'unknown schemaVersion refused');
    assert(storage.getItem(RUN_ARCHIVE_KEY) != null, 'refused save was archived');
    eq(storage.getItem(RUN_KEY), null, 'save slot cleared after archive');

    // contentVersion mismatch + dangling card id → refused and archived.
    const ghost = { ...run, contentVersion: 'other', deck: [{ instanceId: 'g1', cardId: 'ghostCard', upgraded: false }] };
    storage.setItem(RUN_KEY, JSON.stringify(ghost));
    eq(saves.loadRun(REG), null, 'dangling id after content change refused');

    // contentVersion mismatch but all ids resolve → run survives the patch.
    const fine = { ...run, contentVersion: 'other' };
    storage.setItem(RUN_KEY, JSON.stringify(fine));
    const migrated = saves.loadRun(REG);
    assert(migrated != null, 'compatible save survives content patch');
    eq(migrated.contentVersion, REG.contentVersion, 'contentVersion re-stamped');

    const customized = createRunState({
      seed: 0xc315, classId: 'reaver', registries: REG,
      startingHands: { leftHand: 'greatsword', rightHand: 'roundShield' },
      startingArmourId: 'vigil',
    });
    customized.contentVersion = 'before-roster-update';
    const updatedBundle = {
      ...contentBundle,
      version: 'after-roster-update',
      characterCreation: structuredClone(contentBundle.characterCreation),
    };
    updatedBundle.characterCreation.classes.reaver.handIds = updatedBundle.characterCreation.classes.reaver.handIds
      .filter((id) => id !== 'greatsword');
    updatedBundle.characterCreation.classes.reaver.armourIds = updatedBundle.characterCreation.classes.reaver.armourIds
      .filter((id) => id !== 'vigil');
    const updatedRegistries = createRegistries(updatedBundle);
    storage.setItem(RUN_KEY, serializeRun(customized));
    const rosterMigrated = saves.loadRun(updatedRegistries);
    assert(rosterMigrated != null && rosterMigrated.startingKitSnapshot.leftHand === 'greatsword',
      'a customized saved hand survives removal from the current creation roster when the equipment still exists');
    assert(ownership(updatedRegistries, { meta: {}, loadout: rosterMigrated.loadout })
      .has(updatedRegistries.equipment.armour.find((piece) => piece.classId === 'reaver' && piece.id === 'vigil')),
    'a persisted creation armour grant survives removal from the current creation roster when the equipment still exists');
    eq(rosterMigrated.contentVersion, updatedRegistries.contentVersion,
      'the compatible customized save reaches the content-version re-stamp');

    // The old contract allowed one owned armament id in several hand sets and
    // in storage at once. The shared Inventory contract migrates that shape at
    // the real load door: keep the active occurrence, clear the rest, and never
    // leave an equipped object duplicated in Inventory.
    const duplicateStorage = createMemoryStorage();
    const duplicateRun = createRunState({ seed: 0xd315, classId: 'reaver', registries: REG });
    duplicateRun.loadout.sets.leftHand[1] = 'straightSword';
    duplicateRun.loadout.storage.push('straightSword');
    duplicateStorage.setItem(RUN_KEY, serializeRun(duplicateRun));
    const duplicateSaves = createSaveManager(duplicateStorage);
    const normalized = duplicateSaves.loadRun(REG);
    assert(normalized != null, 'a legacy duplicate armament is normalized rather than archived');
    eq(Object.values(normalized.loadout.sets).flat().filter((id) => id === 'straightSword').length, 1,
      'the normalized save keeps exactly one equipped Straight Sword');
    eq(normalized.loadout.sets.rightHand[0], 'straightSword', 'the active equipped occurrence survives normalization');
    eq(normalized.loadout.storage.includes('straightSword'), false, 'the equipped survivor is removed from shared Inventory');
    assert((duplicateSaves.runStatus().ledger.entries || [])
      .some((entry) => entry.field === 'loadout.armamentLocations'), 'the load ledger names the normalization');

    // Parseable but malformed body (right schemaVersion, broken shape) → refused
    // and archived, instead of loading and exploding later mid-run.
    for (const [label, bad] of [
      ['missing hp', (() => { const r = { ...run }; delete r.hp; return r; })()],
      ['deck not an array', { ...run, deck: 'nope' }],
      ['deck entry missing cardId', { ...run, deck: [{ instanceId: 'x1' }] }],
      ['null class', { ...run, class: null }],
    ]) {
      storage.removeItem(RUN_ARCHIVE_KEY);
      storage.setItem(RUN_KEY, JSON.stringify(bad));
      eq(saves.loadRun(REG), null, `malformed save refused (${label})`);
      assert(storage.getItem(RUN_ARCHIVE_KEY) != null, `malformed save archived (${label})`);
    }

    // A sound save still declares its shape (no drift): seedString is part of it.
    assert(validateRunShape(run).length === 0, 'a freshly created run satisfies RUN_SHAPE');
    assert('seedString' in run, 'seedString is declared by createRunState, not bolted on later');

    // Meta history capped at 20.
    storage.setItem(RUN_KEY, JSON.stringify(run));
    for (let i = 0; i < 25; i++) saves.recordResult({ victory: i % 2 === 0, seed: i });
    eq(saves.loadMeta().results.length, 20, 'history capped at 20');
  });

  // ---- 13b. Profile durability (#67) — the five properties --------------------
  // A 2000-run profile is somebody's history. Each assertion below was observed
  // RED at dev e444d77 before the fix; the standalone instrument with the full
  // corpus is tools/profile-durability-probe.mjs (Sten's probe, extended).
  test('13b. profile: stamped and read, newer refused AND preserved, archives keyed, never silently empty, evidence survives the next write, drawer has a handle', () => {
    // P1 — the stamp is written AND something branches on it.
    const s1 = createMemoryStorage();
    const m1 = createSaveManager(s1);
    m1.saveMeta({ settings: {}, results: [], progress: { runs: 2000 } });
    eq(JSON.parse(s1.getItem(META_KEY)).schemaVersion, META_SCHEMA_VERSION, 'profile is stamped on write');

    // P1 — NEWER: refused and PRESERVED (an old build must not eat a new profile).
    const s2 = createMemoryStorage();
    const m2 = createSaveManager(s2);
    const newerBytes = JSON.stringify({ schemaVersion: META_SCHEMA_VERSION + 6, profile: { runs: 2000 } });
    s2.setItem(META_KEY, newerBytes);
    m2.loadMeta();
    eq(m2.profileStatus().state, 'newer', 'a newer profile is refused by name');
    eq(s2.getItem(META_KEY), newerBytes, 'newer profile bytes are preserved untouched');
    eq(m2.saveMeta({ settings: { uiScale: 1.1 } }).ok, false, 'writes are refused while quarantined');
    eq(s2.getItem(META_KEY), newerBytes, 'and the bytes are STILL untouched after that write');

    // P1 — OLDER: migrated when we have a migration, refused BY NAME when we don't.
    const s3 = createMemoryStorage();
    const m3 = createSaveManager(s3);
    s3.setItem(META_KEY, JSON.stringify({ schemaVersion: 0, results: [], progress: { runs: 7 } }));
    eq(m3.loadMeta().progress.runs, 7, 'a v0 profile is migrated, not discarded');
    eq(m3.profileStatus().state, 'migrated', 'and the migration is named');
    const s4 = createMemoryStorage();
    const m4 = createSaveManager(s4);
    s4.setItem(META_KEY, JSON.stringify({ schemaVersion: -3, progress: { runs: 9 } }));
    m4.loadMeta();
    assert(/schemaVersion -3/.test(m4.profileStatus().reason || ''), 'an un-migratable older profile is refused BY NAME');

    // P2 — archives are keyed and appended: the second loss keeps the first.
    const s5 = createMemoryStorage();
    const m5 = createSaveManager(s5);
    s5.setItem(META_KEY, '{"schemaVersion":1,"progress":{"runs":111},');
    m5.loadMeta();
    m5.startNewProfile();
    m5.saveMeta({ settings: {}, results: [], progress: { runs: 222 } });
    s5.setItem(META_KEY, '{"schemaVersion":1,"progress":{"runs":222},');
    m5.loadMeta();
    const metaArchives = m5.listArchives().filter((a) => a.kind === 'meta');
    eq(metaArchives.length, 2, 'two losses produce two archives');
    assert(/111/.test(m5.getArchive(metaArchives[0].id).save), 'the first loss was not overwritten by the second');
    // …and repeated reads of one bad profile do not fill the drawer with copies.
    m5.loadMeta(); m5.loadMeta(); m5.loadMeta();
    eq(m5.listArchives().filter((a) => a.kind === 'meta').length, 2, 'repeat loads de-duplicate by content');
    // Run archives are keyed by SLOT — slot 2 no longer lands on slot 1.
    const s6 = createMemoryStorage();
    const m6 = createSaveManager(s6);
    s6.setItem(RUN_KEY, '{"schemaVersion":1,broken');
    s6.setItem(`${RUN_KEY}_s2`, '{"schemaVersion":1,alsobroken');
    m6.loadRun(REG, 1);
    m6.loadRun(REG, 2);
    const runArchives = m6.listArchives().filter((a) => a.kind === 'run');
    eq(runArchives.length, 2, 'both slots archived separately');
    assert(runArchives.some((a) => a.slot === 1) && runArchives.some((a) => a.slot === 2), 'archives carry their slot');

    // P3 + P4 — never silently empty, and the next write cannot destroy the evidence.
    const s7 = createMemoryStorage();
    const m7 = createSaveManager(s7);
    m7.saveMeta({ settings: {}, results: [], progress: { runs: 2000 } });
    s7.setItem(META_KEY, 'not json at all');
    s7.setItem(META_BACKUP_KEY, 'the mirror is gone too');
    const loaded = m7.loadMeta();
    const st7 = m7.profileStatus();
    assert(st7.ok === false && st7.state === 'corrupt' && !!st7.reason, 'a failed load is a named state');
    assert(loaded.progress === undefined && st7.quarantined, 'empty is returned, but the state says why');
    const evidence = s7.getItem(META_KEY);
    m7.saveMeta({ settings: { uiScale: 1.1 } });
    m7.recordResult({ victory: false });
    eq(s7.getItem(META_KEY), evidence, 'the original bytes survive the next write AND recordResult');
    // A first boot is 'empty', not loss — the two must never look alike.
    const m8 = createSaveManager(createMemoryStorage());
    m8.loadMeta();
    assert(m8.profileStatus().state === 'empty' && m8.profileStatus().ok, 'a first-ever boot is not a loss');

    // P5 — the drawer has a handle, and a readable mirror means it is never opened.
    const s9 = createMemoryStorage();
    const m9 = createSaveManager(s9);
    m9.saveMeta({ settings: {}, results: [], progress: { runs: 1234 }, unlocked: ['weaponMoonveil'] });
    const goodBytes = s9.getItem(META_KEY);
    s9.setItem(META_KEY, goodBytes.slice(0, goodBytes.length - 9));
    m9.loadMeta();
    eq(m9.profileStatus().state, 'recovered', 'the last-known-good mirror recovers the profile');
    eq(JSON.parse(s9.getItem(META_KEY)).progress.runs, 1234, 'and the primary is put back');
    const archived = m9.listArchives().find((a) => a.kind === 'meta');
    assert(archived && archived.at && archived.reason, 'the corrupt bytes are still archived, with when and why');
    assert(/weaponMoonveil/.test(m9.exportArchive(archived.id) || ''), 'an archive exports to something a player can keep');
    assert(m9.restoreProfile(archived.id).ok === false, 'restoring genuinely-bad bytes fails plainly, not silently');

    // ---- the PRODUCT of state × consent action (Vira's gate, D1) -----------
    // The corpus above walks each state and each action but never their
    // product, and the hole was exactly there: consenting to a new profile
    // destroyed an unarchived one. The invariant, asserted for EVERY state:
    // no path may replace the primary without the old bytes being recoverable.
    const build = {
      ok: (st) => { const m = createSaveManager(st); m.saveMeta({ settings: {}, results: [], progress: { runs: 2000 } }); return m; },
      corrupt: (st) => { const m = createSaveManager(st); m.saveMeta({ results: [], progress: { runs: 2000 } }); st.setItem(META_KEY, '{"schemaVersion":1,"progress":{"runs":2000}'); st.setItem(META_BACKUP_KEY, 'gone'); m.loadMeta(); return m; },
      newer: (st) => { const m = createSaveManager(st); st.setItem(META_KEY, JSON.stringify({ schemaVersion: META_SCHEMA_VERSION + 6, profile: { runs: 2000 } })); m.loadMeta(); return m; },
      older: (st) => { const m = createSaveManager(st); st.setItem(META_KEY, JSON.stringify({ schemaVersion: -3, progress: { runs: 2000 } })); m.loadMeta(); return m; },
    };
    // EVERY path that replaces the primary, not the one that was tested. The
    // rule held twice and its COVERAGE was per-function twice: startNewProfile
    // (Vira D1), then restoreProfile (Sunna D12), which destroyed the outgoing
    // profile while its dialog promised to set it aside.
    const seedArchive = (st, runs) => {
      const other = JSON.stringify({ schemaVersion: META_SCHEMA_VERSION, settings: {}, results: [], progress: { runs } });
      const idx = JSON.parse(st.getItem(RUN_ARCHIVE_KEY) || '{"v":1,"entries":[]}');
      idx.entries.push({ id: 'meta-seeded', kind: 'meta', slot: null, reason: 'seeded', at: new Date().toISOString(), count: 1, save: other });
      st.setItem(RUN_ARCHIVE_KEY, JSON.stringify(idx));
    };
    const replacers = {
      startNewProfile: (mgr) => mgr.startNewProfile(),
      restoreProfile: (mgr, st) => { seedArchive(st, 111); return mgr.restoreProfile('meta-seeded'); },
    };
    for (const [name, make] of Object.entries(build)) {
      for (const [action, run] of Object.entries(replacers)) {
        const st = createMemoryStorage();
        const mgr = make(st);
        const before = st.getItem(META_KEY);
        run(mgr, st);
        const recoverable = mgr.listArchives().some((a) => (mgr.getArchive(a.id) || {}).save === before);
        assert(!before || recoverable, `${name} × ${action}: the replaced bytes are still recoverable`);
      }
    }

    // The named case, with values worth noticing: 777 out, 111 in, and BOTH
    // must be in the drawer afterwards — a restore consumes nothing.
    const stR = createMemoryStorage();
    const mR = createSaveManager(stR);
    mR.saveMeta({ settings: {}, results: [], progress: { runs: 777 } });
    seedArchive(stR, 111);
    eq(mR.restoreProfile('meta-seeded').ok, true, 'a readable archive restores');
    eq(mR.loadMeta().progress.runs, 111, 'the restored profile is live');
    const inDrawer = mR.listArchives()
      .map((a) => { try { return JSON.parse(mR.getArchive(a.id).save).progress.runs; } catch (e) { return null; } });
    assert(inDrawer.includes(777), 'the profile that was replaced is set aside, not destroyed');
    assert(inDrawer.includes(111), 'the archive it restored from is still there');

    // newer × export: the bytes are intact and deliberately unarchived, so the
    // export must read the LIVE profile — and must never offer an unrelated
    // archive as "your profile" (Vira, D2).
    const stN = createMemoryStorage();
    stN.setItem(RUN_ARCHIVE_KEY, JSON.stringify({ reason: 'an old run', save: '{"unrelated":"run bytes"}' }));
    const mN = build.newer(stN);
    eq(mN.profileStatus().archiveId, null, 'the newer state points at no archive — it archived nothing');
    const exported = mN.exportProfile();
    eq(JSON.parse(exported).profile, stN.getItem(META_KEY), 'export carries the live profile bytes verbatim');
    assert(!/unrelated/.test(exported), 'export never hands back somebody else\'s archive');

    // THE DRAWER'S PROMISE (Saga's gate): "never deleted to make room for
    // anything else" must be true. A profile is not evicted by later run
    // losses, and is not aged out either — same promise, two routes.
    const stD = createMemoryStorage();
    const mD = createSaveManager(stD);
    mD.saveMeta({ settings: {}, results: [], progress: { runs: 2000 } });
    stD.setItem(META_KEY, '{"schemaVersion":1,"progress":{"runs":2000},');
    mD.loadMeta();
    const profileId = mD.profileStatus().archiveId;
    for (let i = 0; i < 20; i++) {
      stD.setItem(`${RUN_KEY}_s${(i % 2) + 2}`, '{"schemaVersion":1,broken' + i);
      mD.loadRun(REG, (i % 2) + 2);
    }
    assert(mD.getArchive(profileId), 'a set-aside profile survives twenty later run losses');
    assert(typeof mD.exportArchive(profileId) === 'string', 'and it is still exportable afterwards');
    const idxD = JSON.parse(stD.getItem(RUN_ARCHIVE_KEY));
    idxD.entries.forEach((e) => { e.at = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString(); });
    stD.setItem(RUN_ARCHIVE_KEY, JSON.stringify(idxD));
    stD.setItem(RUN_KEY, '{"schemaVersion":1,broken');
    mD.loadRun(REG, 1);
    assert(mD.getArchive(profileId), 'a set-aside profile is not aged out of the drawer either');

    // A corrupt archive INDEX must not silently discard the drawer (Vira, D4).
    const stI = createMemoryStorage();
    const mI = createSaveManager(stI);
    stI.setItem(RUN_ARCHIVE_KEY, 'the index itself is garbage');
    mI.saveMeta({ results: [], progress: { runs: 5 } });
    stI.setItem(META_KEY, 'broken');
    mI.loadMeta();
    assert(Object.keys(stI).length >= 0, 'index salvage does not throw');
    assert(mI.listArchives().length >= 1, 'a fresh index is started so the game keeps working');
  });

  // ---- 13c. The profile exists BEFORE the first run (M7) ----------------------
  // His ask: "profile should be able to be created before first run, not after".
  // Bjorn's walk on the shipped bundle at cd3da94: cleared storage, picked a
  // class, typed a name, pressed BEGIN THE CLIMB — `sote_run_v1` written,
  // `sote_meta_v1` absent, and Title → Profile printing his own sentence back
  // at him. Every assertion below was observed RED at dev cd3da94 by running
  // this file against that tree; the screen half — the same walk in a real
  // browser, on the shipped bundle — is tools/profile-first-run.mjs.
  test('13c. a profile exists before the run does, is written first, survives an abandon, and never overwrites one that is there', () => {
    // A storage that REMEMBERS THE ORDER of writes. "Before" is the whole ask,
    // and a test that only checks both keys exist at the end cannot tell the
    // ask from its opposite.
    const logged = () => {
      const inner = createMemoryStorage();
      const writes = [];
      return {
        writes,
        getItem: (k) => inner.getItem(k),
        setItem: (k, v) => { writes.push(k); return inner.setItem(k, v); },
        removeItem: (k) => inner.removeItem(k),
      };
    };
    const aRun = () => {
      const r = createRunState({ seed: 0xc1a55, classId: 'reaver', registries: REG });
      r.floor = 1;
      return r;
    };

    // 1 — the class-pick commit. main.js calls ensureProfile() one line above
    // createRunState, so this is that call, and the run write follows it.
    const s1 = logged();
    const m1 = createSaveManager(s1);
    eq(s1.getItem(META_KEY), null, 'a cleared browser starts with no profile');
    const made = m1.ensureProfile();
    assert(made.created && made.ok, 'ensureProfile creates one when there is none');
    assert(s1.getItem(META_KEY) != null, 'and it is REAL BYTES, not an object a reader synthesized');
    eq(m1.profileStatus().state, 'ok', 'the named state says a profile is there');
    eq(JSON.parse(s1.getItem(META_KEY)).schemaVersion, META_SCHEMA_VERSION, 'stamped like any other profile');
    m1.saveRun(aRun(), null, 1);
    assert(s1.writes.indexOf(META_KEY) < s1.writes.indexOf(RUN_KEY), 'the profile is written BEFORE the run, not after');

    // 2 — the structural half, on its own: a start path that forgets to ask.
    // A STORED RUN IMPLIES A STORED PROFILE.
    const s2 = logged();
    const m2 = createSaveManager(s2);
    m2.saveRun(aRun(), null, 1);
    assert(s2.getItem(META_KEY) != null, 'saveRun alone still leaves a profile behind');
    assert(s2.writes.indexOf(META_KEY) < s2.writes.indexOf(RUN_KEY), 'and still in that order');

    // 3 — THE EDGE BJORN COULD NOT REACH: a player who already has runs and no
    // profile. That is everybody who started a climb on a build before this one.
    const s3 = createMemoryStorage();
    const m3 = createSaveManager(s3);
    s3.setItem(RUN_KEY, JSON.stringify(aRun()));
    eq(s3.getItem(META_KEY), null, 'the shipped population: a run, no profile');
    const resumed = m3.loadRun(REG, 1);
    assert(resumed != null, 'their run still loads');
    assert(s3.getItem(META_KEY) != null, 'and their profile appears with it — no migration to run');
    eq(m3.profileStatus().state, 'ok', 'Settings would no longer tell them they have no profile');

    // …and a run that FAILS to load is not a player arriving.
    const s3b = createMemoryStorage();
    const m3b = createSaveManager(s3b);
    s3b.setItem(RUN_KEY, '{"schemaVersion":1,broken');
    eq(m3b.loadRun(REG, 1), null, 'a corrupt run is still refused');
    eq(s3b.getItem(META_KEY), null, 'and creates no profile out of nothing');

    // 4 — ABANDON BEFORE THE FIRST FIGHT. Begin a climb, then delete the save
    // from the title screen (onDelete → clearRun). The character is gone; the
    // player is not.
    const s4 = createMemoryStorage();
    const m4 = createSaveManager(s4);
    m4.ensureProfile();
    m4.saveRun(aRun(), null, 1);
    m4.clearRun(1);
    eq(s4.getItem(RUN_KEY), null, 'the abandoned run is gone');
    assert(s4.getItem(META_KEY) != null, 'the profile it created is not');

    // 5 — IDEMPOTENT, and it never touches a profile that is already there.
    // This is the edge that would turn a fix into a data loss.
    const s5 = createMemoryStorage();
    const m5 = createSaveManager(s5);
    m5.saveMeta({ settings: { textSize: 'xl' }, results: [], progress: { runs: 2000 } });
    const before = s5.getItem(META_KEY);
    const again = m5.ensureProfile();
    eq(again.created, false, 'a second call creates nothing');
    eq(s5.getItem(META_KEY), before, 'and the 2000-run profile is byte-identical afterwards');
    m5.saveRun(aRun(), null, 1);
    m5.loadRun(REG, 1);
    eq(s5.getItem(META_KEY), before, 'neither does saving or loading a run');
    eq(m5.listArchives().length, 0, 'nothing was set aside, because nothing was replaced');

    // 6 — QUARANTINE WINS. The bytes of an unreadable profile are the evidence
    // (property 4), so the new writer refuses exactly as saveMeta does.
    const s6 = createMemoryStorage();
    const m6 = createSaveManager(s6);
    s6.setItem(META_KEY, JSON.stringify({ schemaVersion: META_SCHEMA_VERSION + 6, progress: { runs: 2000 } }));
    m6.loadMeta();
    assert(m6.profileStatus().quarantined, 'a newer profile quarantines this build');
    const futureBytes = s6.getItem(META_KEY);
    m6.saveRun(aRun(), null, 1);
    eq(s6.getItem(META_KEY), futureBytes, 'starting a run does not write over a profile from the future');
    eq(m6.ensureProfile().created, false, 'and ensureProfile says no rather than pretending');

    // 7 — the sentence's own condition, both edges. 'empty' must still be
    // reachable (someone who has never begun a climb) and must no longer be the
    // state a player is left in after starting a new profile — which is where
    // "No profile yet — one is created when you finish your first run" was the
    // second lie, printed over bytes that existed.
    const m7a = createSaveManager(createMemoryStorage());
    m7a.loadMeta();
    eq(m7a.profileStatus().state, 'empty', 'a browser that has never played still reads empty');
    const s7b = createMemoryStorage();
    const m7b = createSaveManager(s7b);
    m7b.saveMeta({ settings: {}, results: [], progress: { runs: 9 } });
    m7b.startNewProfile();
    assert(s7b.getItem(META_KEY) != null, 'starting a new profile writes one');
    eq(m7b.profileStatus().state, 'ok', 'so the state is ok, not empty');
  });

  // ---- 14. Scripted bot completes a boss combat -------------------------------------
  test('14. bot (leftmost affordable, end turn) finishes a seeded boss fight without throwing', () => {
    const fresh = createRunState({ seed: 1, classId: 'reaver', registries: REG });
    const deck = fresh.deck;
    const c = createCombat({
      registries: REG,
      rng: createRng(0x51deb00b),
      player: { classId: 'reaver', attributes: fresh.attributes, maxHp: 78, hp: 78, mana: 2, maxMana: 2, energyMax: fresh.energyMax, drawPerTurn: fresh.drawPerTurn, deck, loadout: fresh.loadout, relicIds: ['forsakenMedallion'] },
      enemyIds: ['fellWarden'],
    });
    let guard = 0;
    while (!c.result) {
      if (++guard > 2000) throw new Error('bot did not finish in 2000 actions');
      const target = c.enemies.find((e) => e.alive);
      const playable = c.piles.hand.find((inst) => {
        const def = resolveCard(REG, inst);
        if ((def.keywords || []).includes('unplayable')) return false;
        const cost = def.cost === 'X' ? 0 : def.cost;
        return c.player.energy >= cost && c.player.mana >= (def.manaCost || 0);
      });
      if (playable && target) {
        dispatch(c, { type: 'playCard', cardInstanceId: playable.instanceId, targetId: target.id });
      } else {
        dispatch(c, { type: 'endTurn' });
      }
    }
    assert(c.result === 'victory' || c.result === 'defeat', 'combat concluded');
    assert(logOf(c, 'relicTriggered').some((e) => e.relicId === 'forsakenMedallion'), 'starter relic fired');
  });

  // ---- 15. Content validation ---------------------------------------------------------
  test('15. shipped content validates; closed sets enforced; scripts budget < 5%', () => {
    const r = validateContent(contentBundle);
    assert(r.ok, `content invalid: ${r.errors.slice(0, 5).map((e) => `${e.path}: ${e.msg}`).join(' | ')}`);
    assert(r.scriptReport.pct < 5, 'scripts budget');

    const bad1 = validateContent({ ...contentBundle, cards: [...contentBundle.cards, { id: 'zz', name: 'zz', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: [], effects: [{ op: 'notAnOp', amount: 1 }], textTemplate: '' }] });
    assert(!bad1.ok && bad1.errors.some((e) => e.msg.includes("Unknown opcode 'notAnOp'")), 'unknown opcode caught');

    const bad2 = validateContent({ ...contentBundle, cards: [...contentBundle.cards, { id: 'zz2', name: 'zz', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: [], effects: [{ op: 'applyStatus', status: 'noSuchStatus', stacks: { f: 'add', args: [1] } }], textTemplate: '' }] });
    assert(!bad2.ok && bad2.errors.some((e) => e.msg.includes('noSuchStatus')), 'dangling status id caught');

    const bad3 = validateContent({ ...contentBundle, cards: [...contentBundle.cards, { id: 'zz3', name: 'zz', class: 'colorless', rarity: 'special', cost: 0, type: 'skill', keywords: [], effects: [], textTemplate: 'Deal {damage} damage.' }] });
    assert(!bad3.ok && bad3.errors.some((e) => e.msg.includes('does not bind')), 'unbound template token caught');
  });

  // ---- 16. Text templating + shared preview math ----------------------------------------
  test('16. every token binds (base + upgrade); Strike previews 9 with +3 Str; Strike+ shows 6 under Weak', () => {
    for (const card of contentBundle.cards) {
      const check = (tpl, effs, label) => {
        const bound = new Set(computeTokenBindings(effs).map((b) => b.token));
        for (const tok of extractTemplateTokens(tpl)) {
          assert(bound.has(tok), `${label}: token {${tok}} unbound`);
        }
      };
      check(card.textTemplate, card.effects, card.id);
      if (card.upgrade) {
        check(card.upgrade.textTemplate ?? card.textTemplate, card.upgrade.effects ?? card.effects, `${card.id}+`);
      }
    }
    const c = makeCombat({ deck: Array(5).fill('strike') });
    S.applyStatus(c, c.player, 'strength', 3);
    eq(previewCard(c, c.piles.hand[0].instanceId, 'e1').tokens.damage, 9, 'Strike previews 6+3=9');

    const w = makeCombat({ deck: Array(5).fill({ id: 'strike', up: true }) });
    S.applyStatus(w, w.player, 'weak', 1);
    eq(previewCard(w, w.piles.hand[0].instanceId, 'e1').tokens.damage, 6, 'Strike+ (9) under Weak previews 6');

    // Intent numbers recompute live through the same math (SPEC §4.6).
    const i = makeCombat({ deck: Array(5).fill('defend'), enemies: ['tHitter'] });
    S.applyStatus(i, i.player, 'vulnerable', 1);
    eq(previewIntent(i, 'e1').damage, 15, 'intent shows 10×1.5=15 with player Vulnerable');
  });

  // ---- 17. Status-model generality (zero engine changes) ----------------------------------
  test('17. throwaway status (meter + hook + modifier) works with zero engine changes', () => {
    // 7-card deck (tCharge is Innate → both in the opening hand) so the
    // ownerTurnStart bonus draw has cards left to actually draw.
    const c = makeCombat({ deck: ['tCharge', 'tCharge', 'strike', 'strike', 'strike', 'strike', 'strike'] });
    playFromHand(c, 'tCharge'); // 3
    playFromHand(c, 'tCharge'); // 6 ≥ 5 → fill: +7 block, max ×2 → 10, value 1
    eq(c.player.block, 7, 'meter onFill granted block');
    eq(c.player.statuses.testCharge.meter.max, 10, 'growthMult ×2 applied');
    eq(S.getStacks(c.player, 'testCharge'), 1, 'overflow carried');
    playFromHand(c, 'strike');
    eq(logOf(c, 'damageDealt').pop().amount, 7, 'attackDamageAdd modifier: 6+1');
    const drawnBefore = logOf(c, 'cardDrawn').length;
    dispatch(c, { type: 'endTurn' });
    assert(logOf(c, 'cardDrawn').length >= drawnBefore + 6, 'ownerTurnStart hook drew an extra card');
  });

  // ---- 18. M2 run systems ---------------------------------------------------------------
  test('18. run systems: deterministic rewards, flask pity, relic passives, event opcodes, Physick', () => {
    eq(REG.balance.flaskCapacity, 4, 'Crimson/Azure share the approved global capacity of four');
    eq(REG.balance.flaskSlots, 3, 'utility flask inventory remains an independent three-slot system');
    eq(
      ['reaver', 'starseer', 'rogue', 'herald'].map((id) => {
        const a = REG.classes.get(id).startingFlaskAllocation;
        return `${a.hp}/${a.mana}`;
      }).join('|'),
      '3/1|2/2|3/1|3/1',
      'all four class allocations consume all four charges exactly as approved',
    );
    const freeAllocation = createRunState({ seed: 0xf1a5, classId: 'reaver', registries: REG });
    reallocateFlaskCharges(freeAllocation.flaskCharges, { hp: 0, mana: 4 });
    eq(`${freeAllocation.flaskCharges.hp}/${freeAllocation.flaskCharges.mana}/${freeAllocation.flaskCharges.capacity}`, '0/4/4', 'all four charges may be freely reallocated');
    const flaskStore = createMemoryStorage();
    freeAllocation.seedString = 'FLASK4';
    createSaveManager(flaskStore).saveRun(freeAllocation);
    const flaskBack = createSaveManager(flaskStore).loadRun(REG);
    assert(flaskBack !== null, 'a freely allocated four-charge run survives the real save door');
    eq(`${flaskBack.flaskCharges.hp}/${flaskBack.flaskCharges.mana}/${flaskBack.flaskCharges.base}`, '0/4/4', 'save keeps allocation and the capacity ledger');
    const oldCapacityRun = structuredClone(freeAllocation);
    oldCapacityRun.flaskCharges = {
      capacity: 3, base: 3, hp: 2, mana: 1, hpCurrent: 2, manaCurrent: 1,
      grown: { hp: 0, mana: 0 }, granted: 0,
    };
    createSaveManager(flaskStore).saveRun(oldCapacityRun);
    const oldCapacityBack = createSaveManager(flaskStore).loadRun(REG);
    assert(oldCapacityBack !== null, 'an existing three-charge save remains valid after the live default becomes four');
    eq(`${oldCapacityBack.flaskCharges.capacity}/${oldCapacityBack.flaskCharges.base}`, '3/3', 'old capacity ledger remains authoritative');
    // Same seed → identical roll bundle (SPEC §3.11 stream promise).
    const rollAll = () => {
      const r = createRng(0xaa11);
      const rn = createRunState({ seed: 0xaa11, classId: 'reaver', registries: REG });
      return JSON.stringify([
        rollEncounter(REG, r, { pool: 'normal' }),
        rollRuneReward(REG, r, 'normal', []),
        rollCardRewardIds(REG, r, { classId: 'reaver', pool: 'normal' }),
        rollFlaskDrop(REG, r, rn),
        rollRelicReward(REG, r, ['forsakenMedallion']),
        buildShopStock(REG, r, rn),
        resolveUnknownNode(REG, r, { act: 1 }),
      ]);
    };
    eq(rollAll(), rollAll(), 'reward/shop/unknown rolls deterministic');

    // runeGainMult passive (Cinder Pouch ×1.25, floored).
    const base = rollRuneReward(REG, createRng(7), 'normal', []);
    eq(rollRuneReward(REG, createRng(7), 'normal', ['cinderPouch']), Math.floor(base * 1.25), 'Cinder Pouch');

    // Feral Eye: elites offer +1 card choice.
    eq(rollCardRewardIds(REG, createRng(9), { classId: 'reaver', pool: 'elite', relicIds: ['feralEye'] }).length, 4, 'Feral Eye extra choice');

    // Flask pity: −step on drop, +step on miss.
    const rn2 = createRunState({ seed: 1, classId: 'reaver', registries: REG });
    rn2.flaskChancePct = 100;
    assert(rollFlaskDrop(REG, createRng(3), rn2) != null, 'guaranteed drop at 100%');
    eq(rn2.flaskChancePct, 90, 'chance decayed after drop');
    rn2.flaskChancePct = 0;
    eq(rollFlaskDrop(REG, createRng(3), rn2), null, 'no drop at 0%');
    eq(rn2.flaskChancePct, 10, 'chance grew after miss');

    // Cracked Tear: Flask of Stone 15 Block × 1.5 → ceil 23.
    const c = makeCombat({ deck: Array(5).fill('strike'), relicIds: ['crackedTear'], flasks: [{ flaskId: 'flaskOfStone' }] });
    dispatch(c, { type: 'useFlask', slot: 0 });
    eq(c.player.block, 23, 'flaskPowerMult 1.5 rounded up');

    // Wondrous Draught: the one budgeted script — two random flask payloads.
    const w = makeCombat({ deck: Array(5).fill('strike'), flasks: [{ flaskId: 'wondrousDraught' }] });
    const out = dispatch(w, { type: 'useFlask', slot: 0 });
    assert(out.events.some((e) => e.type === 'flaskUsed'), 'physick used');
    assert(
      out.events.some((e) => ['blockGained', 'healed', 'energyGained', 'statusApplied'].includes(e.type)),
      'physick produced flask effects'
    );

    // Ancestral Horn: Powers cost 1 less (preview AND execution).
    const h = makeCombat({ deck: ['unbreakable', 'strike', 'strike', 'strike', 'strike'], relicIds: ['ancestralHorn'] });
    const inst = h.piles.hand.find((x) => x.cardId === 'unbreakable');
    eq(previewCard(h, inst.instanceId).cost, 1, 'preview shows reduced cost');
    dispatch(h, { type: 'playCard', cardInstanceId: inst.instanceId });
    eq(h.player.energy, 2, 'paid 1 instead of 2');

    // Run-level event opcodes: addCardToDeck + startCombat + shrine math.
    const rn3 = createRunState({ seed: 2, classId: 'reaver', registries: REG });
    executeRunEffects({ run: rn3, registries: REG, rng: createRng(5) }, [
      { op: 'addCardToDeck', card: 'guilt' },
      { op: 'startCombat', encounterId: 'loneSoldier' },
    ]);
    assert(rn3.deck.some((x) => x.cardId === 'guilt'), 'curse added to deck');
    eq(rn3.combatEntered, 'loneSoldier', 'startCombat handed off');

    const rn4 = createRunState({ seed: 4, classId: 'reaver', registries: REG });
    rn4.hp = 10;
    eq(shrineHealAmount(REG, rn4), Math.floor((rn4.maxHp * 35) / 100), 'shrine heal 35%');
    rn4.relics.push('emberFragment');
    eq(shrineHealAmount(REG, rn4), Math.floor((rn4.maxHp * 35 * 1.15) / 100), 'Ember Fragment ×1.15');
  });

  // ---- 19. Keepsakes (character creation boons) -------------------------------------------
  test('19. keepsakes: effect lists validate and apply as run effects', () => {
    // Every keepsake's effects must pass the same closed-set validation as events.
    const probe = { ...contentBundle, events: [...contentBundle.events, ...KEEPSAKES.map((k) => ({
      id: `ks_${k.id}`, name: k.name, text: 'probe',
      choices: [{ label: 'x', effects: k.effects, resultText: 'x' }],
    }))] };
    const v = validateContent(probe);
    assert(v.ok, `keepsake effects invalid: ${v.errors.map((e) => e.path + ': ' + e.msg).join(' | ')}`);

    const rn = createRunState({ seed: 11, classId: 'reaver', registries: REG });
    executeRunEffects({ run: rn, registries: REG, rng: createRng(11) }, KEEPSAKES.find((k) => k.id === 'oldCinder').effects);
    eq(rn.cinders, 50, 'Old Cinder grants 50 cinders');
    executeRunEffects({ run: rn, registries: REG, rng: createRng(11) }, KEEPSAKES.find((k) => k.id === 'travelersFlask').effects);
    eq(rn.flaskCharges.capacity, 5, "Traveler's Flask raises fixed charge capacity");
    eq(rn.flaskCharges.hp, 4, "Traveler's Flask allocates the added charge to Crimson");
    executeRunEffects({ run: rn, registries: REG, rng: createRng(11) }, KEEPSAKES.find((k) => k.id === 'whetstoneMemory').effects);
    eq(rn.itemUpgradeLevels['armament/straightSword'], 1, 'Whetstone Memory promotes the sourced Straight Sword package');
    assert(rn.deck.filter((c) => c.cardId === 'strike').every((c) => c.smithingLevel === 1 && !c.upgraded),
      'Whetstone Memory upgrades every sourced Strike through equipment authority, not per-copy flags');
  });

  // ---- 20. M3 phase 1: Starseer + Herald class mechanics ---------------------------------
  test('20. Starstone combos, Starstone Shard, blood economy, Gold Figurine — all pure data', () => {
    eq(REG.classes.size, 4, 'four playable classes registered');
    eq(REG.classes.ids().join(','), 'reaver,starseer,rogue,herald', 'the four registered classes include Rogue in authored order');

    // Starstone: 1st spell plain, 2nd spell empowered, charge fades at turn end.
    const a = makeCombat({ deck: Array(5).fill('starstonePebble'), enemies: ['tGiant'], mana: 3, maxMana: 3 });
    playFromHand(a, 'starstonePebble');
    let hits = logOf(a, 'damageDealt').map((e) => e.amount);
    eq(hits.join(','), '6', 'first spell: no bonus');
    playFromHand(a, 'starstonePebble');
    hits = logOf(a, 'damageDealt').map((e) => e.amount);
    eq(hits.join(','), '6,6,3', 'second spell: Starstone bonus fired');
    dispatch(a, { type: 'endTurn' });
    eq(S.getStacks(a.player, 'starstoneCharge'), 0, 'charge fades at turn end');
    playFromHand(a, 'starstonePebble');
    eq(logOf(a, 'damageDealt').map((e) => e.amount).join(','), '6,6,3,6', 'new turn: no bonus again');

    // The starting relic's structured school modifier is host-stamped once and
    // feeds the same attack math used by preview, solo execution, and co-op.
    const starRun = createRunState({ seed: 0x57a2, classId: 'starseer', registries: REG });
    const spellDeck = Array.from({ length: 5 }, (_, i) => ({ instanceId: `sm${i}`, cardId: 'starstonePebble', upgraded: false }));
    const soloMagic = createCombat({
      registries: REG, rng: createRng(0x57a2),
      player: { classId: 'starseer', maxHp: starRun.maxHp, hp: starRun.hp, maxMana: starRun.maxMana, mana: 0,
        energyMax: starRun.energyMax, drawPerTurn: starRun.drawPerTurn, deck: spellDeck,
        relicIds: starRun.relics, damageBySchoolAdd: starRun.damageBySchoolAdd },
      enemyIds: ['tGiant'],
    });
    eq(soloMagic.player.mana, 1, 'Starstone combatStart recovery restores one Mana through its trigger row');
    const soloSpell = soloMagic.piles.hand.find((card) => card.cardId === 'starstonePebble');
    const soloPreview = previewCard(soloMagic, soloSpell.instanceId, 'e1').values.find((value) => value.op === 'damage');
    eq(soloPreview.value, 7, 'solo preview includes the stamped +1 magic damage');
    dispatch(soloMagic, { type: 'playCard', cardInstanceId: soloSpell.instanceId, targetId: 'e1' });
    eq(logOf(soloMagic, 'damageDealt')[0].amount, 7, 'solo live primary damage matches preview');

    const coopMagic = createCoopCombat({
      registries: REG, rng: createRng(0xc002),
      players: [
        { id: 'p1', classId: 'starseer', maxHp: starRun.maxHp, hp: starRun.hp, maxMana: starRun.maxMana, mana: 0,
          energyMax: starRun.energyMax, drawPerTurn: starRun.drawPerTurn, deck: spellDeck,
          relicIds: starRun.relics, damageBySchoolAdd: starRun.damageBySchoolAdd },
        { id: 'p2', classId: 'reaver', maxHp: 96, hp: 96, maxMana: 2, mana: 2, energyMax: 3, drawPerTurn: 5,
          deck: Array.from({ length: 5 }, (_, i) => ({ instanceId: `rm${i}`, cardId: 'strike', upgraded: false })), relicIds: [] },
      ],
      enemyIds: ['tGiant'],
    });
    eq(coopMagic.players.get('p1').entity.mana, 1, 'co-op combatStart uses the same Mana recovery row');
    const coopSpell = coopMagic.players.get('p1').piles.hand.find((card) => card.cardId === 'starstonePebble');
    const coopEvents = playCoopCard(coopMagic, 'p1', coopSpell.instanceId, 'e1').events;
    eq(coopEvents.filter((event) => event.type === 'damageDealt')[0].amount, 7,
      'co-op live magic damage uses the same host-stamped +1');

    // Starstone Shard: combat starts pre-charged → the FIRST spell combos.
    const s = makeCombat({ deck: Array(5).fill('starstonePebble'), enemies: ['tGiant'], relicIds: ['starstoneShard'] });
    playFromHand(s, 'starstonePebble');
    eq(logOf(s, 'damageDealt').map((e) => e.amount).join(','), '6,3', 'Shard pre-charges the opener');

    // Herald blood economy: Blood Pact pays HP for energy + draw.
    const p = makeCombat({ deck: ['bloodPact', 'strike', 'strike', 'strike', 'strike', 'strike'] });
    const hpBefore = p.player.hp;
    const handBefore = p.piles.hand.length;
    playFromHand(p, 'bloodPact');
    eq(p.player.hp, hpBefore - 2, 'paid 2 HP (ignores block)');
    eq(p.player.energy, 4, '0-cost + gain 1 → energy 4');
    eq(p.piles.hand.length, handBefore, 'drew 1 (played 1, drew 1)');

    // Gold Figurine: your heals armor you (even at full HP); enemy heals do not.
    const g = makeCombat({ deck: ['urgentHeal', 'strike', 'strike', 'strike', 'strike'], relicIds: ['goldFigurine'], enemies: ['tRegen'] });
    playFromHand(g, 'urgentHeal'); // at full HP → 0 healed, still armors
    eq(g.player.block, 2, 'overheal converted to Block');
    dispatch(g, { type: 'endTurn' }); // tRegen heals itself
    assert(logOf(g, 'healed').some((e) => e.targetId === 'e1'), 'enemy healed itself');
    eq(g.player.block, 0, "enemy heals did NOT trigger the Figurine (eventTargetIsOwner)");

    // A bot finishes an elite fight with each new class's starting deck.
    for (const classId of ['starseer', 'herald']) {
      const cls = REG.classes.get(classId);
      const fresh = createRunState({ seed: 1, classId, registries: REG });
      const deck = fresh.deck;
      const c = createCombat({
        registries: REG,
        rng: createRng(0xabc0 + classId.length),
        // fresh.maxHp, NOT cls.maxHp. HP is DERIVED (E6: 50 + floor(CON/5) +
        // every tagged bonus); `cls.maxHp` is a class field the HP rule no
        // longer reads at all. This fixture took energyMax and drawPerTurn from
        // `fresh` on this same line and then fought at 72/78 instead of 82/90 —
        // a bot fixture entering below the derivation it was meant to exercise.
        // Found by Sunna's sweep, 2026-08-15. The assertion below (concludes,
        // does not stall) could never have caught it, which is why the eq()
        // above it now exists.
        player: { classId, attributes: fresh.attributes, maxHp: fresh.maxHp, hp: fresh.maxHp, mana: 2, maxMana: 2, energyMax: fresh.energyMax, drawPerTurn: fresh.drawPerTurn, deck, loadout: fresh.loadout, relicIds: [cls.startingRelic] },
        enemyIds: ['wyrmAspirant'],
      });
      // THE FALSIFIER, and it fails for the right reason: the entity fights at
      // the DERIVED total, not the class base. Re-hardcode cls.maxHp here and
      // this goes red by name; the "fight concluded" assertion below would not.
      // `!==`, NOT `>`: the old comparison read `> cls.maxHp` and was true only
      // because a CON tier used to be worth 4/5/6. Under E6 a tier is worth 1,
      // so the gap between the derived total and the class field is now small
      // enough that the DIRECTION was never the property — being a different
      // number from the field is. Same falsifier, same red, one fewer accident.
      assert(c.player.maxHp === fresh.maxHp && c.player.maxHp !== cls.maxHp,
        `${classId} bot fights at its derived maxHp (${fresh.maxHp}), not the class base (${cls.maxHp})`);
      let guard = 0;
      while (!c.result) {
        if (++guard > 2000) throw new Error(`${classId} bot did not finish`);
        const target = c.enemies.find((e) => e.alive);
        const playable = c.piles.hand.find((inst) => {
          const def = resolveCard(REG, inst);
          if ((def.keywords || []).includes('unplayable')) return false;
          // AFFORDABLE MEANS EVERY POOL THE ENGINE CHARGES. Stamina joined the
          // three when the dodge landed (#523), and the empty-hand rule (#554)
          // put a stamina-priced card in a starting deck for the first time —
          // so a bot filtering on energy and mana alone asked for a card
          // playCard refuses, and this fixture died on the throw. The pools are
          // read from the same cost authority the engine spends from.
          const pools = REG.framework.costProfile(def, { weightClass: playerWeightClass(c).weightClass });
          return c.player.energy >= (def.cost === 'X' ? 0 : def.cost)
            && c.player.mana >= (pools.mana || 0)
            && c.player.stamina >= (pools.stamina || 0);
        });
        if (playable && target) dispatch(c, { type: 'playCard', cardInstanceId: playable.instanceId, targetId: target.id });
        else dispatch(c, { type: 'endTurn' });
      }
      assert(c.result === 'victory' || c.result === 'defeat', `${classId} elite fight concluded (${c.result})`);
    }
  });

  test('20b. Mana is real state: validated maxima, spend/refuse/restore, save migration, and zero/max HUD plans', () => {
    const fresh = createRunState({ seed: 0x6d616e61, classId: 'reaver', registries: REG });
    eq(fresh.mana, 1, 'run starts at its WIS-derived mana maximum');
    eq(fresh.maxMana, 1, 'Reaver maximum follows the tuned WIS preset');
    assert(validateRunShape(fresh).length === 0, 'the new run shape accepts a sound mana pool');
    assert(validateRunShape({ ...fresh, mana: 3 }).some((s) => s.includes('between 0 and maxMana')), 'overflow mana is refused by name');

    const badMax = validateContent({
      ...contentBundle,
      classes: contentBundle.classes.map((c) => c.id === 'reaver' ? { ...c, maxMana: 0 } : c),
    });
    assert(!badMax.ok && badMax.errors.some((e) => e.path === 'classes.reaver.maxMana'), 'class maxMana authority is refused at the content door');
    const badCost = validateContent({
      ...contentBundle,
      cards: contentBundle.cards.map((c) => c.id === 'gorefireSlash' ? { ...c, manaCost: -1 } : c),
    });
    assert(!badCost.ok && badCost.errors.some((e) => e.path === 'cards.gorefireSlash.manaCost'), 'negative manaCost cannot mint mana');

    const spend = makeCombat({ deck: Array(5).fill('gorefireSlash'), enemies: ['tGiant'], mana: 2, maxMana: 2 });
    const sig = spend.piles.hand[0];
    const pv = previewCard(spend, sig.instanceId);
    eq(pv.manaCost, 1, 'preview exposes the same mana cost execution charges');
    dispatch(spend, { type: 'playCard', cardInstanceId: sig.instanceId, targetId: 'e1' });
    eq(spend.player.mana, 1, 'signature starter spends 1 mana');
    assert(logOf(spend, 'manaSpent').some((e) => e.amount === 1), 'mana spend emits a receipt');

    const empty = makeCombat({ deck: Array(5).fill('gorefireSlash'), enemies: ['tGiant'], mana: 0, maxMana: 2 });
    empty.player.mana = 0;
    const beforeHand = empty.piles.hand.length;
    let refused = '';
    try { dispatch(empty, { type: 'playCard', cardInstanceId: empty.piles.hand[0].instanceId, targetId: 'e1' }); }
    catch (e) { refused = e.message; }
    assert(refused.includes('Not enough mana'), 'under-cost play is refused by name');
    eq(empty.player.mana, 0, 'refusal spends no mana');
    eq(empty.piles.hand.length, beforeHand, 'refusal moves no card');

    const flask = makeCombat({ deck: Array(5).fill('strike'), flasks: [{ flaskId: 'azureFlask' }], mana: 0, maxMana: 2 });
    flask.player.mana = 0;
    dispatch(flask, { type: 'useFlask', slot: 0 });
    eq(flask.player.mana, 1, 'Azure Flask restores one small Mana unit');
    assert(logOf(flask, 'manaRestored').some((e) => e.amount === 1), 'restoration receipt reports the amount actually gained');

    const storage = createMemoryStorage();
    const saves = createSaveManager(storage);
    const old = { ...fresh };
    old.schemaVersion = 3;
    delete old.mana;
    delete old.maxMana;
    delete old.maxHpAdjustment;
    delete old.damageBySchoolAdd;
    delete old.derivedStatRuleSnapshot;
    storage.setItem(RUN_KEY, JSON.stringify(old));
    const migrated = saves.loadRun(REG);
    eq(migrated.mana, 1, 'pre-mana save migrates to full derived mana');
    eq(migrated.maxMana, 1, 'pre-mana save derives from its tuned WIS allocation');

    const domains = resourceDomains(REG);
    const zero = { ...empty.player, mana: 0 };
    const atZero = resourceBarPlan(REG, 'main', zero, zero, domains).find((b) => b.id === 'mana');
    eq(atZero.cur, 0, 'zero edge is a real empty mana plan');
    eq(atZero.pct, 0, 'zero edge has zero fill');
    // THE TROUGH IS MEASURED AGAINST HIS REFERENCE, NOT AGAINST THE POPULATION.
    // E9 / #254: Constantine ruled 200 HP / 20 MP / 20 SP, and the row carries
    // it as `domainMax` (Law 0 clause 3 — an override is data). Before that
    // ruling this pair asserted `lengthPct === 100` at the largest WIS-derived
    // maxMana, which was a claim about the DERIVED ceiling and is now false by
    // his word rather than by a defect. Both numbers below are DERIVED FROM THE
    // CONSTANT, never typed, so moving the reference moves the test with it.
    eq(domains.main.mana, HUD_REFERENCE_MAX.mana, 'the mana ceiling is his reference, not the derived population');
    const star = { maxHp: 82, hp: 82, maxMana: 4, mana: 4 };
    const atMax = resourceBarPlan(REG, 'main', star, star, domains).find((b) => b.id === 'mana');
    eq(atMax.pct, 100, 'max edge fills the mana trough');
    eq(atMax.lengthPct, (4 / HUD_REFERENCE_MAX.mana) * 100,
      'the largest WIS-derived maxMana takes its share of the reference, not the whole track');
    // AND THE OTHER SIDE OF THE SAME LINE: a pool standing AT the reference
    // fills the track whole. Without this cell the assertion above is one
    // number with nothing on the far side of it and could not tell a wrong
    // reference from a right one.
    const atRef = { maxHp: 82, hp: 82, maxMana: HUD_REFERENCE_MAX.mana, mana: HUD_REFERENCE_MAX.mana };
    const full = resourceBarPlan(REG, 'main', atRef, atRef, domains).find((b) => b.id === 'mana');
    eq(full.lengthPct, 100, 'a pool AT the reference fills its track');
  });

  // ---- 21. M3 phase 2: Acts II–III mechanics ------------------------------------------------
  test('21. act-scoped encounters; Blighted Valkyrie heal-on-hit; player-side Bleed; Stitched King phase', () => {
    // Encounter rolls are act-scoped.
    for (let i = 0; i < 20; i++) {
      const r = createRng(i * 7919);
      assert(rollEncounter(REG, r, { pool: 'normal', act: 2 }).startsWith('a2_'), 'act 2 pool only');
      assert(rollEncounter(REG, r, { pool: 'normal', act: 3 }).startsWith('a3_'), 'act 3 pool only');
      assert(!rollEncounter(REG, r, { pool: 'normal', act: 1 }).startsWith('a2_'), 'act 1 pool untouched');
    }
    eq(rollEncounter(REG, createRng(1), { pool: 'boss', act: 3 }), 'a3_bossRotValkyrie', 'act 3 boss');

    // Blighted Valkyrie: heals 2 whenever SHE lands a hit (persistent phase trigger);
    // her thrust also Bleeds the PLAYER (entity-agnostic status model).
    const v = makeCombat({ deck: Array(5).fill('defend'), enemies: ['blightedValkyrie'] });
    const e1 = getEntity(v, 'e1');
    applyLoseHp(v, e1, 30); // give her something to heal back
    dispatch(v, { type: 'endTurn' }); // firstMove spiralThrust: 12 dmg + 2 player Bleed
    const heals = logOf(v, 'healed').filter((e) => e.targetId === 'e1');
    assert(heals.length >= 1 && heals[0].amount === 2, 'healed 2 off her own hit');
    eq(S.getStacks(v.player, 'bleed'), 2, 'her blade Bleeds the player');

    // Player-side Bleed meter bursts exactly like an enemy's (SPEC §10 seam).
    S.applyStatus(v, v.player, 'bleed', 10); // 2 + 10 = 12 → fill (effects enqueued)
    dispatch(v, { type: 'endTurn' }); // drains the queue
    const burst = logOf(v, 'hpLost').filter((e) => e.targetId === 'player' && e.cause === 'proc:bleed').pop();
    assert(burst, 'player bleed burst (attributed proc:bleed in the record)');
    eq(burst.amount, Math.floor((78 * 15) / 100), 'burst = 15% of player max HP (11)');

    // Stitched King: ≤50% HP grafts new limbs — unlocks thousandHands, buffs, Frails you.
    const k = makeCombat({ deck: Array(5).fill('defend'), enemies: ['stitchedKing'] });
    const king = getEntity(k, 'e1');
    applyLoseHp(k, king, 115); // 220 → 105 (<50%): checkPhases fires in afterHpChange
    dispatch(k, { type: 'endTurn' }); // drain phase effects
    assert(king.unlockedMoves.includes('thousandHands'), 'phase 2 move unlocked');
    assert(S.getStacks(king, 'strength') >= 2, 'phase buffed his Strength');
    assert(S.getStacks(k.player, 'frail') >= 1 || logOf(k, 'statusApplied').some((e) => e.status === 'frail'), 'player Frailed by the phase');

    // Full-fight bot: an upgraded Reaver deck concludes the final boss fight.
    const cls = REG.classes.get('reaver');
    const fresh = createRunState({ seed: 1, classId: 'reaver', registries: REG });
    const deck = [...fresh.deck.map((c) => ({ ...c, upgraded: true })), ...['stomp', 'executioner', 'crimsonCleave'].map((cardId, i) => ({ instanceId: `f${i}`, cardId, upgraded: true }))];
    const f = createCombat({
      registries: REG,
      rng: createRng(0xf17e),
      player: { classId: 'reaver', attributes: fresh.attributes, maxHp: 78, hp: 78, energyMax: fresh.energyMax, drawPerTurn: fresh.drawPerTurn, deck, loadout: fresh.loadout, relicIds: ['forsakenMedallion'] },
      enemyIds: ['blightedValkyrie'],
    });
    let guard = 0;
    while (!f.result) {
      if (++guard > 3000) throw new Error('final boss bot did not finish');
      const target = f.enemies.find((e) => e.alive);
      const playable = f.piles.hand.find((inst) => {
        const def = resolveCard(REG, inst);
        if ((def.keywords || []).includes('unplayable')) return false;
        return f.player.energy >= (def.cost === 'X' ? 0 : def.cost) && f.player.mana >= (def.manaCost || 0);
      });
      if (playable && target) dispatch(f, { type: 'playCard', cardInstanceId: playable.instanceId, targetId: target.id });
      else dispatch(f, { type: 'endTurn' });
    }
    assert(f.result === 'victory' || f.result === 'defeat', `final boss fight concluded (${f.result})`);
  });

  // ---- 22. Endless Spire (Custom Climb chaos rule) --------------------------
  test('22. Endless Spire: act loop math, per-cycle scaling, mod wiring', () => {
    // Acts 1-3 are the first pass (loop 0); 4-6 replay acts 1-3 as cycle 2; etc.
    for (const [act, want] of [[1, [1, 0]], [3, [3, 0]], [4, [1, 1]], [6, [3, 1]], [7, [1, 2]], [12, [3, 3]]]) {
      const { contentAct, loop } = endlessActInfo(act);
      eq(contentAct, want[0], `act ${act} content act`);
      eq(loop, want[1], `act ${act} loop count`);
    }
    // Every looped content act must resolve to real content (no unknown-act throw).
    for (let act = 4; act <= 12; act++) {
      const ca = endlessActInfo(act).contentAct;
      assert(REG.mapConfig(ca), `mapConfig exists for looped act ${act} → ${ca}`);
      assert(rollEncounter(REG, createRng(act), { pool: 'boss', act: ca }), `boss encounter rolls for looped act ${act}`);
    }
    // Cycle scaling applies in combat: +35% HP and +1 Strength per loop.
    const base = createCombat({
      registries: REG, rng: createRng(7), player: { classId: 'reaver', maxHp: 84, hp: 84, energyMax: 3, drawPerTurn: 5, deck: [{ instanceId: 'x1', cardId: 'strike', upgraded: false }] },
      enemyIds: ['blightHound'],
    });
    const loop2 = createCombat({
      registries: REG, rng: createRng(7), player: { classId: 'reaver', maxHp: 84, hp: 84, energyMax: 3, drawPerTurn: 5, deck: [{ instanceId: 'x2', cardId: 'strike', upgraded: false }] },
      enemyIds: ['blightHound'],
      hpMult: 1 + ENDLESS_HP_PER_LOOP * 2,
      enemyStatuses: [{ status: 'strength', stacks: ENDLESS_STR_PER_LOOP * 2 }],
    });
    eq(getEntity(loop2, 'e1').maxHp, Math.round(getEntity(base, 'e1').maxHp * 1.7), 'loop-2 enemy HP = base ×1.7');
    eq(S.getStacks(getEntity(loop2, 'e1'), 'strength'), 2, 'loop-2 enemy has +2 Strength');
    // The chaos toggle flags the run as custom (kept out of win-rate telemetry).
    assert(activeMods({ mods: { endless: true } }).endless, 'endless resolves as an active mod');
    assert(isCustomRun({ mods: { endless: true } }), 'endless runs are flagged custom');
  });

  // ---- 23. 'ally' target (co-op cards, solo-valid) ---------------------------
  test("23. 'ally' target falls back to self in solo; co-op cards validate", () => {
    // Solo: no teammate exists, so Rallying Banner's ally-block lands on the player.
    const c = makeCombat({ deck: ['rallyingBanner', 'strike', 'strike', 'strike', 'strike'] });
    playFromHand(c, 'rallyingBanner');
    eq(c.player.block, 10, "ally-targeted Block resolves to the player when there's no ally");
    // The co-op set is registered, special-rarity (kept out of pools/shops).
    for (const id of ['rallyingBanner', 'sharedFlame', 'ashOath']) {
      assert(REG.cards.has(id), `co-op card '${id}' registered`);
      eq(REG.cards.get(id).rarity, 'special', `'${id}' is special rarity (never in solo pools)`);
    }
    for (const cls of REG.classes.all()) {
      assert(!cls.cardPool.includes('rallyingBanner'), `no class pool contains a co-op card (${cls.id})`);
    }
  });

  // ---- 24. co-op: once/limitPerTurn gates are per-seat, not party-wide -------
  test('24. a once-per-combat relic held by two co-op players fires for each', () => {
    // Goldleaf Charm: { on:'playerTurnStart', once:true, block 4 to owner }.
    // Co-op runs every seat through ONE ctx and all player entities share the id
    // 'player', so before per-seat scoping the first seat's fire consumed the
    // gate and the second seat silently got nothing.
    const deck = (tag) => Array.from({ length: 5 }, (_, i) => ({ instanceId: `${tag}${i}`, cardId: 'strike', upgraded: false }));
    const C = createCoopCombat({
      registries: REG,
      rng: createRng(11),
      players: [
        { id: 'p1', classId: 'reaver', maxHp: 80, hp: 80, energyMax: 3, drawPerTurn: 5, deck: deck('a'), relicIds: ['goldleafCharm'], flasks: [] },
        { id: 'p2', classId: 'reaver', maxHp: 80, hp: 80, energyMax: 3, drawPerTurn: 5, deck: deck('b'), relicIds: ['goldleafCharm'], flasks: [] },
      ],
      enemyIds: ['blightHound'],
    });
    eq(C.players.get('p1').entity.block, 4, 'seat 1 got its own Goldleaf Charm block');
    eq(C.players.get('p2').entity.block, 4, 'seat 2 got its own Goldleaf Charm block (gate is per-seat)');

    // The gate still holds WITHIN a seat: the relic must not re-fire next turn.
    const before = C.players.get('p1').entity.block;
    C.emit('playerTurnStart', { turn: C.turn, playerId: 'p1' });
    eq(C.players.get('p1').entity.block, before, "once:true still gates repeat fires for the same seat");

    // Enemy-owned gates stay shared (enemies are one set, not per-seat).
    assert(C.enemies.length === 1, 'shared enemy set is unaffected by seat scoping');
  });

  // ---- 25. authored content (CSV -> generated modules) ----------------------
  test('25. outfits + unlocks compile and cross-reference correctly', () => {
    // Authoring is CSV; tools/content-build.mjs compiles it into the generated
    // modules imported here. These checks are what stops a spreadsheet typo
    // from reaching the game as a silently broken reference.
    const CONDITIONS = ['winAsClass', 'beatBoss', 'reachAct', 'winRuns'];
    const REVEALS = ['teased', 'hidden', 'listed'];
    const classIds = REG.classes.all().map((c) => c.id);
    const unlockIds = unlocks.map((u) => u.id);
    const outfitIds = outfits.map((o) => o.id);

    assert(outfits.length > 0 && unlocks.length > 0, 'CSV sources compiled to rows');

    for (const o of outfits) {
      assert(classIds.includes(o.classId), `outfit '${o.id}' targets a real class (${o.classId})`);
      assert(/^[0-9A-Fa-f]{6}$/.test(o.plate), `outfit '${o.id}' plate is a 6-digit hex`);
      assert(/^[0-9A-Fa-f]{6}$/.test(o.plateLt), `outfit '${o.id}' plateLt is a 6-digit hex`);
      if (o.unlock !== '') {
        assert(unlockIds.includes(o.unlock), `outfit '${o.id}' unlock '${o.unlock}' exists`);
      }
    }
    // Every class must have a starting outfit, or customization has nothing to show.
    for (const id of classIds) {
      assert(outfits.some((o) => o.classId === id && o.unlock === ''), `class '${id}' has an unlocked outfit`);
    }
    for (const u of unlocks) {
      assert(CONDITIONS.includes(u.condition), `unlock '${u.id}' uses a known condition (${u.condition})`);
      assert(REVEALS.includes(u.reveal), `unlock '${u.id}' uses a known reveal mode (${u.reveal})`);
      if (u.kind === 'outfit') {
        assert(outfitIds.includes(u.ref), `unlock '${u.id}' points at a real outfit (${u.ref})`);
      }
      if (u.condition === 'winAsClass') {
        assert(classIds.includes(u.param), `unlock '${u.id}' names a real class (${u.param})`);
      }
      if (u.condition === 'beatBoss') {
        assert(REG.enemies.has(u.param), `unlock '${u.id}' names a real enemy (${u.param})`);
      }
      // A 'teased' unlock promises the player a hint; a 'hidden' one must not.
      if (u.reveal === 'teased') assert(String(u.hint).length > 0, `teased unlock '${u.id}' has a hint`);
      if (u.reveal === 'hidden') eq(u.hint, '', `hidden unlock '${u.id}' shows no hint`);
    }
    eq(unlockIds.length, new Set(unlockIds).size, 'unlock ids are unique');
  });

  // ---- 26. the tag system (CSV-authored, one registry, 3NF) ---------------
  test('26. tags resolve, stay distinct from engine keywords, and index', () => {
    // Subtypes live under the frozen attack/skill/power type. Tagging is a CSV
    // row, so these checks are what stops a spreadsheet typo from silently
    // dropping a chip or pointing at a card that does not exist.
    const tagIds = TAGS.map((t) => t.id);
    const domainIds = TAG_DOMAINS.map((d) => d.id);
    eq(tagIds.length, new Set(tagIds).size, 'tag ids are unique');
    eq(domainIds.length, new Set(domainIds).size, 'domain ids are unique');
    for (const t of TAGS) {
      assert(/^[0-9A-Fa-f]{6}$/.test(t.color), `tag '${t.id}' colour is a 6-digit hex`);
      assert(String(t.label).length > 0 && String(t.glyph).length > 0, `tag '${t.id}' has a label + glyph`);
      assert(domainIds.includes(t.domain), `tag '${t.id}' names a registered domain ('${t.domain}')`);
      // Tags are CONTENT; keywords are a frozen engine set. Overlapping names
      // would make 'exhaust' ambiguous between flavour and mechanics.
      assert(!ENGINE_KEYWORDS.includes(t.id), `tag '${t.id}' does not collide with an engine keyword`);
    }
    const cardRows = TAGGING.filter((row) => row.family === 'card');
    for (const row of cardRows) {
      assert(REG.cards.has(row.objectId), `tagged card '${row.objectId}' exists`);
      assert(tagIds.includes(row.tagId), `card '${row.objectId}' uses a registered tag ('${row.tagId}')`);
      assert(row.scope === '', `card rows carry no scope ('${row.objectId}')`);
    }
    // The lookups the UI and any future synergy predicate depend on.
    eq(tagsFor('gorefireSlash').length, 3, 'gorefireSlash carries three tags');
    eq(tagsFor('strike')[0].label, 'Blade', 'strike resolves to the Blade tag');
    eq(tagsFor('nonexistentCard').length, 0, 'an untagged card resolves to no tags');
    assert(Array.isArray(tagIdsFor('strike')), 'tag ids always come back as an array');
    assert(cardsWithTag('blade').includes('strike'), 'reverse lookup finds Blade cards');
    assert(cardsWithTag('nope').length === 0, 'reverse lookup on an unknown tag is empty');
  });

  // ---- 26b. ONE vocabulary, many carriers, third normal form --------------
  test('26b. the tag schema is normalised and every family carries from it', () => {
    // The point of the tag system is that a card school, a creature kind and a
    // weapon's identity are all rows in ONE vocabulary, kept apart by domain
    // rather than by a second hard-coded array — and that there is exactly one
    // place any of it is authored. These checks are what stop either from
    // quietly coming undone.
    const byId = new Map(TAGS.map((t) => [t.id, t]));
    const domainIds = new Set(TAG_DOMAINS.map((d) => d.id));
    const families = new Map(TAG_FAMILIES.map((f) => [f.family, f]));
    eq(families.size, TAG_FAMILIES.length, 'each family is declared once');

    // 1NF: no cell anywhere in the tag schema holds a list.
    for (const row of TAGGING) {
      for (const cell of [row.family, row.scope, row.objectId, row.tagId]) {
        assert(!Array.isArray(cell), `tagging cells are atomic (${row.family}/${row.objectId})`);
      }
    }
    for (const row of TAG_FAMILY_DOMAINS) {
      assert(!Array.isArray(row.domain), `family/domain pairs are atomic ('${row.family}')`);
      assert(families.has(row.family), `pair names a declared family ('${row.family}')`);
      assert(domainIds.has(row.domain), `pair names a registered domain ('${row.domain}')`);
    }
    for (const f of TAG_FAMILIES) {
      assert(!Array.isArray(f.source), `family '${f.family}' names one source`);
      assert(domainsFor(f.family).length > 0, `family '${f.family}' may carry at least one domain`);
    }
    // Every domain is carried by someone, and every tag names a live domain.
    const carried = new Set(TAG_FAMILY_DOMAINS.map((r) => r.domain));
    for (const id of domainIds) assert(carried.has(id), `some family carries domain '${id}'`);

    // No duplicate junction rows: the composite key is the whole key.
    const seen = new Set();
    for (const row of TAGGING) {
      const k = [row.family, row.scope, row.objectId, row.tagId].join('|');
      assert(!seen.has(k), `no duplicate tagging row (${k})`);
      seen.add(k);
      const tag = byId.get(row.tagId);
      assert(tag, `tagging row uses a registered tag ('${row.tagId}')`);
      assert(domainsFor(row.family).includes(tag.domain),
        `'${row.family}' may carry ${row.tagId} (a ${tag.domain} tag)`);
    }

    // Creature kinds are the registry's creature domain now, not a frozen
    // array in schemas.js, and not a field on the enemy either.
    const creature = tagsInDomain('creature').map((t) => t.id);
    assert(creature.length >= 5, 'the creature domain holds the shipped kinds');
    for (const enemy of REG.enemies.all()) {
      assert(Array.isArray(enemy.tags), `enemy '${enemy.id}' carries a tags array`);
      for (const id of enemy.tags) assert(creature.includes(id), `enemy '${enemy.id}' uses a creature tag ('${id}')`);
    }

    // Registries resolve the join onto the object, so a mechanic reads
    // obj.tags whatever table the row was authored in.
    eq(REG.classes.get('reaver').tags.join('|'), 'blade|guard|blood', 'the Reaver carries its class tags');
    eq(REG.cards.get('strike').tags.join('|'), 'blade', 'a card carries its tags on the def');
    eq(objectTagIds('class', 'starseer').join('|'), 'starstone|ranged', 'the table resolves by family and id');
    eq(tagIdsOf('card', { id: 'strike' }).join('|'), 'blade', 'tagIdsOf resolves an unscoped family');
    eq(tagIdsOf('armament', REG.equipment.armaments.find((a) => a.id === 'straightSword')).join('|'),
      'item:blade|blade|basic', 'tagIdsOf resolves an armament, item type included');
    eq(tagIdsOf('class', { id: 'nobody' }).length, 0, 'an untagged object resolves to no tags');

    // SCOPE: outfit ids repeat per class, so the parent key is (classId, id).
    // Four rows share the id 'default' and must not share tags.
    const defaults = REG.equipment.armour.filter((o) => o.id === 'default');
    eq(defaults.length, 4, 'four classes ship an outfit called default');
    eq(defaults.map((o) => o.tags.join('+')).join(' '), 'guard starstone ritual flourish',
      'each default outfit keeps its own gameplay tags, keyed by class');
    eq(defaults.map((o) => o.itemTypeTags.join('+')).join(' '), 'item:armor item:armor item:armor item:armor',
      'and its item type, which registries splits out of the same rows');
    eq(objectTagIds('armour', 'default', 'reaver').join('|'), 'item:armor|guard',
      'the scope half of the key selects one');
    eq(objectTagIds('armour', 'default').length, 0, 'a scoped family does not resolve on the id alone');

    // Every carrier the families table names hands back an array.
    for (const kit of REG.equipment.startingKits) assert(Array.isArray(kit.tags), `kit '${kit.id}' carries a tags array`);
    for (const slot of REG.equipment.slots) assert(Array.isArray(slot.tags), `slot '${slot.id}' carries a tags array`);
    for (const unlock of REG.unlocks || []) assert(Array.isArray(unlock.tags), `unlock '${unlock.id}' carries a tags array`);
    for (const relic of REG.relics.all()) assert(Array.isArray(relic.tags), `relic '${relic.id}' carries a tags array`);
  });

  // ---- 26c. the query door -----------------------------------------------
  test('26c. tagService answers every tag question from the junction', () => {
    // One door for asking. `obj.tags` stays the resolved join a hot path reads;
    // this is what answers the questions that field cannot — what a family is
    // ALLOWED to carry, which objects wear a tag, and whether code just named
    // one that does not exist.
    const svc = tagService(REG);
    eq(svc, tagService(REG), 'the service is memoised per registries');

    eq(svc.idsOf('card', { id: 'strike' }).join('|'), 'blade', 'ids by family and id');
    eq(svc.tagsOf('card', { id: 'strike' })[0].label, 'Blade', 'resolved to registry rows');
    assert(svc.has('card', { id: 'strike' }, 'blade'), 'has() is true for a carried tag');
    assert(!svc.has('card', { id: 'strike' }, 'venom'), 'has() is false for one it does not carry');
    eq(svc.idsOf('card', null).length, 0, 'a missing object resolves to no tags');

    // Scoped families need the whole parent key, and the service supplies it.
    const armour = REG.equipment.armour.find((o) => o.id === 'default' && o.classId === 'starseer');
    eq(svc.idsOf('armour', armour).join('|'), 'item:armor|starstone', 'a scoped object resolves by (classId, id)');

    // The junction is the authority: a doctored copy cannot answer for content.
    eq(svc.idsOf('card', { id: 'strike', tags: ['venom'] }).join('|'), 'blade',
      'a hand-edited tags field does not override the rows');

    // Reverse lookup hands back objects, not ids.
    eq(svc.inDomain('itemType').map((t) => t.id).join('|'), 'item:blade|item:shield|item:magic-focus|item:armor',
      'the itemType domain holds the four authored types');
    // The registry label must equal what content/equipment.js derives from the
    // id prefix, or the Armoury and the chip strip would disagree by one word.
    for (const tag of svc.inDomain('itemType')) {
      eq(tag.label, itemTypeLabel(tag.id), `item type '${tag.id}' label matches itemTypeLabel()`);
    }
    const heavy = svc.withTag('armament', 'heavy');
    assert(heavy.length >= 4, 'withTag finds the heavy armaments');
    assert(heavy.every((row) => row && row.id), 'withTag returns objects');
    assert(heavy.some((row) => row.id === 'greatsword'), 'the greatsword is among them');
    eq(svc.withTag('armament', 'nosuchtag').length, 0, 'withTag on an unknown tag is empty');
    eq(svc.withTag('nosuchfamily', 'blade').length, 0, 'withTag on an unknown family is empty');

    // Vocabulary questions.
    eq(svc.inDomain('creature').map((t) => t.id).join('|'), 'beast|humanoid|undead|construct|spirit',
      'inDomain lists one domain');
    eq(svc.domainsFor('armament').join('|'), 'card|item|itemType', 'a family may carry several domains');
    assert(svc.allowedFor('enemy').every((t) => t.domain === 'creature'), 'allowedFor is domain-filtered');
    assert(svc.allowedFor('enemy').length > 0, 'allowedFor is non-empty for a live family');
    eq(svc.tag('blade').label, 'Blade', 'tag() resolves one row');
    eq(svc.tag('nope'), null, 'tag() on an unknown id is null');
    eq(svc.resolve(['blade', 'nope', 'guard']).map((t) => t.id).join('|'), 'blade|guard',
      'resolve drops unregistered ids');

    // assertLegal is the code-time twin of the boot door: it names the offence
    // and prints the legal set rather than failing quietly.
    const throws = (fn, needle, why) => {
      let said = '';
      try { fn(); } catch (e) { said = e.message; }
      assert(said.includes(needle), `${why} — said ${JSON.stringify(said)}`);
    };
    eq(svc.assertLegal('card', 'blade').id, 'blade', 'a legal tag passes through');
    throws(() => svc.assertLegal('card', 'nosuchtag'), "unknown tag 'nosuchtag'", 'an unregistered tag throws by name');
    throws(() => svc.assertLegal('card', 'beast'), 'is a creature tag', 'a wrong-domain tag throws by name');
    throws(() => svc.assertLegal('card', 'beast'), 'legal:', 'the throw prints the legal set');
  });

  // ---- 26d. the review's three findings, each with its own red ------------
  test('26d. composed quota survives restamping, item types keep their prefix, grants key by identity', () => {
    // P1. strikeBias is the composed deck's headline knob and every value but
    // the default died: state.js composed N attacks, then stampDeck rebuilt the
    // attack plan from the LEGACY roleCopies.attack and refused the mismatch.
    // The quota now defaults to the composed plan wherever it is live.
    for (const [bias, wantAttack, wantGuard] of [[0.5, 4, 4], [0.75, 6, 2], [0.25, 2, 6], [1, 8, 0], [0, 0, 8]]) {
      const balance = JSON.parse(JSON.stringify(contentBundle.balance));
      balance.equipment.startingDeck.classes.reaver.strikeBias = bias;
      const reg = createRegistries({ ...testBundle(), balance });
      const run = createRunState({ seed: 1, classId: 'reaver', registries: reg });
      eq(run.deck.length, 10, `bias ${bias} still starts a 10-card deck`);
      eq(run.deck.filter((c) => c.equipmentRole === 'attack').length, wantAttack, `bias ${bias} deals ${wantAttack} attacks`);
      eq(run.deck.filter((c) => c.equipmentRole === 'guard').length, wantGuard, `bias ${bias} deals ${wantGuard} guards`);
    }

    // P2a. Two classifiers rule on item types — this pass by domain, the
    // runtime by the `item:` prefix. An itemType id without the prefix would
    // pass here and be stamped as an ordinary tag, silently stripping every
    // piece's type, so the prefix is a checked rule.
    const renamed = JSON.parse(JSON.stringify(contentBundle));
    for (const t of renamed.tags) if (t.id === 'item:armor') t.id = 'armor';
    for (const r of renamed.tagging) if (r.tagId === 'item:armor') r.tagId = 'armor';
    const said = tagContentProblems(renamed, contentBundle.keywords.map((k) => k.id))
      .map((row) => `${row.path}: ${row.message}`).join(' | ');
    assert(/must be 'item:' followed by at least one word/.test(said), `a prefix-less itemType id is refused by name — said ${JSON.stringify(said.slice(0, 120))}`);

    // P2b. Outfit ids repeat per class, so a grant keyed on the bare id names
    // four different outfits at once. The key is (family, scope, sourceId).
    const armour = REG.equipment.armour.map((o) => (o.id === 'default' ? { ...o, tags: [...o.tags, 'bound'] } : o));
    const scoped = {
      ...REG,
      equipment: {
        ...REG.equipment,
        armour,
        equipmentGrants: [
          { family: 'armour', scope: 'reaver', sourceId: 'default', cards: ['strike'] },
          { family: 'armour', scope: 'starseer', sourceId: 'default', cards: ['defend'] },
        ],
      },
    };
    const outfit = (classId) => armour.find((o) => o.id === 'default' && o.classId === classId);
    eq(boundGrantCardIds(scoped, outfit('reaver'), 'armour').join('|'), 'strike', "the reaver's default outfit grants its own card");
    eq(boundGrantCardIds(scoped, outfit('starseer'), 'armour').join('|'), 'defend', "the starseer's default outfit grants a different one");
    eq(boundGrantCardIds(scoped, outfit('herald'), 'armour').length, 0, 'an untagged-for outfit of the same id grants nothing');
    // Two rows sharing an id are no longer a duplicate; two sharing the whole key are.
    const dupe = { ...scoped, equipment: { ...scoped.equipment, equipmentGrants: [
      { family: 'armour', scope: 'reaver', sourceId: 'default', cards: ['strike'] },
      { family: 'armour', scope: 'reaver', sourceId: 'default', cards: ['defend'] },
    ] } };
    assert(boundGrantProblems(dupe).some((row) => /duplicate row for armour\/reaver\/default/.test(row)),
      'a second row for the same (family, scope, id) is refused by name');
  });

  // ---- 26e. the second review round's four findings -----------------------
  test('26e. bias default, per-kit budget, one source per family, and item types that name something', () => {
    const kw = contentBundle.keywords.map((k) => k.id);
    const tagSaid = (bundle) => tagContentProblems(bundle, kw).map((r) => `${r.path}: ${r.message}`).join(' | ');

    // The default bias is what a class with no override falls back to, so it is
    // held to the same rule. Malformed, it reached the plan as NaN and killed
    // run creation with nothing said at the door.
    const balance = JSON.parse(JSON.stringify(contentBundle.balance));
    balance.equipment.startingDeck.defaultStrikeBias = 'oops';
    delete balance.equipment.startingDeck.classes.reaver;
    const said = validateEquipment(createRegistries({ ...contentBundle, balance })).join(' | ');
    assert(/defaultStrikeBias must be between 0 and 1/.test(said), `a malformed default bias is refused by name — said ${JSON.stringify(said.slice(0, 120))}`);

    // The budget is checked against every kit a player can pick, not only the
    // baseline: an alternate carries its own grants and is equally selectable.
    const kits = REG.equipment.startingKits.filter((k) => k.classId === 'reaver');
    assert(kits.length > 1 && kits.some((k) => k.baseline !== true), 'the reaver ships a selectable alternate to check');
    // REPOINTED, NOT DROPPED. This proved the enumeration reaches every kit, by
    // asserting a budget refusal — and the cap rule (owner, 2026-09-03) removed
    // refusals entirely: bound cards are never capped, the cap only decides how
    // many base cards are minted. The enumeration survives serving the warning
    // that a kit deals no base cards at all, so the coverage this round bought
    // is asserted through what replaced it.
    const greedy = JSON.parse(JSON.stringify(contentBundle));
    greedy.tagging.push({ family: 'armament', scope: '', objectId: 'straightSword', tagId: 'bound' });
    greedy.equipment = {
      ...greedy.equipment,
      equipmentGrants: [{ family: 'armament', scope: '', sourceId: 'straightSword', cards: Array(10).fill('defend') }],
    };
    const greedyReg = createRegistries(greedy);
    eq(validateEquipment(greedyReg).length, 0, 'gear that fills the cap is not an error');
    const budget = startingDeckWarnings(greedyReg).join(' | ');
    assert(/kit '/.test(budget), `the zero-filler warning names the kit it was planned for — said ${JSON.stringify(budget.slice(0, 160))}`);
    assert(/no base strikes or defends/.test(budget), 'and says what the player actually gets');

    // Materialisation keys on the source, so a second family naming one
    // collection replaces the first rather than merging — every object in it
    // silently losing the tags the first family gave it.
    const dupeSource = JSON.parse(JSON.stringify(contentBundle));
    dupeSource.tagFamilies.push({ family: 'card2', source: 'cards', scopeField: '', label: 'C2', blurb: '' });
    dupeSource.tagFamilyDomains.push({ family: 'card2', domain: 'card' });
    assert(/already claimed by family 'card'/.test(tagSaid(dupeSource)), 'two families claiming one source is refused by name');

    // The prefix alone is not enough: an id that derives an EMPTY label is
    // stamped as an ordinary tag, so the piece loses its type just the same.
    for (const id of ['item:', 'item:-']) {
      const c = JSON.parse(JSON.stringify(contentBundle));
      for (const t of c.tags) if (t.id === 'item:armor') t.id = id;
      for (const r of c.tagging) if (r.tagId === 'item:armor') r.tagId = id;
      assert(/at least one word/.test(tagSaid(c)), `an itemType id of '${id}' yields no label and is refused`);
      eq(itemTypeLabel(id), '', `and the runtime agrees '${id}' names nothing`);
    }
  });

  // ---- 26f. the third review round's two findings -------------------------
  test('26f. the budget spans kit x armour, and the fit index follows the bundle', () => {
    // Character creation picks a kit AND an armour, independently. Checking one
    // axis leaves the other free to blow the budget: an unlockable outfit that
    // grants cards passed validation while eating the promised minFiller.
    const greedy = JSON.parse(JSON.stringify(contentBundle));
    greedy.tagging.push({ family: 'armour', scope: 'reaver', objectId: 'vigil', tagId: 'bound' });
    greedy.equipment = {
      ...greedy.equipment,
      equipmentGrants: [{ family: 'armour', scope: 'reaver', sourceId: 'vigil', cards: Array(10).fill('defend') }],
    };
    // Repointed at the warning for the same reason as 26e: what this round
    // proved is that the enumeration crosses kit WITH armour, and it still does.
    const said = startingDeckWarnings(createRegistries(greedy)).join(' | ');
    assert(/armour 'vigil'/.test(said), `the armour axis is still enumerated — said ${JSON.stringify(said.slice(0, 160))}`);
    assert(/kit 'reaverBaseline'/.test(said), 'and the kit it was paired with');
    // The armour is behind an unlock, so it is only reachable later — which is
    // exactly why enumerating just the free one was not enough.
    const vigil = REG.equipment.armour.find((o) => o.classId === 'reaver' && o.id === 'vigil');
    assert(vigil && vigil.unlock, 'vigil is an unlockable outfit, not the free one');

    // equipment.cardTagging is what the fit check reads. Folded from the
    // module-global rows it would answer a different question than card.tags
    // does the moment a caller hands createRegistries an extended bundle.
    const extended = JSON.parse(JSON.stringify(contentBundle));
    extended.tagging.push({ family: 'card', scope: '', objectId: 'starstonePebble', tagId: 'blade' });
    const reg = createRegistries(extended);
    const stamped = reg.cards.get('starstonePebble').tags;
    const indexed = (reg.equipment.cardTagging || []).find((row) => row.cardId === 'starstonePebble');
    assert(indexed, 'the supplied row reaches the fit index at all');
    eq(indexed.tags.join('|'), stamped.join('|'), 'the fit index and the stamped card agree, row for row');
    assert(stamped.includes('blade'), 'and both carry the tag the bundle supplied');
  });

  // ---- 26g. the fourth review round: three root causes --------------------
  test('26g. the quota is the run\'s, the legacy sum is dormant, and creation decides what is selectable', () => {
    // A composed deck's attack count is decided ONCE, at birth, from the grants
    // the run started with. Recomputing it from the current loadout meant
    // swapping between pieces with different grant counts threw mid-run.
    const granting = JSON.parse(JSON.stringify(contentBundle));
    granting.tagging.push({ family: 'armament', scope: '', objectId: 'straightSword', tagId: 'bound' });
    granting.equipment = {
      ...granting.equipment,
      equipmentGrants: [{ family: 'armament', scope: '', sourceId: 'straightSword', cards: ['strike', 'defend'] }],
    };
    const reg = createRegistries({ ...granting, cards: contentBundle.cards, statuses: contentBundle.statuses });
    const run = createRunState({ seed: 1, classId: 'reaver', registries: reg });
    const born = run.deck.filter((c) => c.equipmentRole === 'attack').length;
    eq(born, 3, 'two granted cards shift the composed attack quota to three');
    run.loadout.sets.rightHand[0] = 'dagger';
    stampDeck(reg, run);
    eq(run.deck.filter((c) => c.equipmentRole === 'attack').length, born, 'a swap re-skins the attacks, it does not re-count them');
    // REPOINTED. This said "and the deck stays the size it was born" — ten —
    // and it was true only because bound-table cards were minted as run-owned
    // refs nothing ever swept. The owner ruled (2026-09-03): if the item is not
    // equipped, its cards are gone. The sword took its two with it; 26v owns
    // the full statement of that rule.
    eq(run.deck.length, 8, 'and the unequipped sword took its two bound cards with it — the deck floats, by ruling');

    // roleCopies is the legacy distribution. Its hand-kept sum is exactly the
    // coupling the composed deck removes, so it is a rule only while it is the
    // one being read — otherwise a valid twelve-card plan is rejected for
    // summing to ten.
    const bigger = JSON.parse(JSON.stringify(contentBundle));
    bigger.balance.startingDeckSize = 12;
    eq(validateEquipment(createRegistries(bigger)).length, 0, 'raising startingDeckSize alone is now a legal edit');
    const legacy = JSON.parse(JSON.stringify(contentBundle));
    legacy.balance.equipment.startingDeck.enabled = false;
    legacy.balance.startingDeckSize = 12;
    assert(validateEquipment(createRegistries(legacy)).some((p) => /roleCopies sum/.test(p)),
      'and with the composed path off the legacy sum is still enforced');

    // Character creation decides what is selectable — not the kit table. Two
    // grant-bearing pieces that share no authored kit can still be picked
    // together, which three rounds of axis-by-axis enumeration kept missing.
    const pair = JSON.parse(JSON.stringify(contentBundle));
    for (const id of ['greatsword', 'buckler']) pair.tagging.push({ family: 'armament', scope: '', objectId: id, tagId: 'bound' });
    pair.equipment = {
      ...pair.equipment,
      equipmentGrants: ['greatsword', 'buckler'].map((id) => ({ family: 'armament', scope: '', sourceId: id, cards: Array(5).fill('defend') })),
    };
    // Five each: either hand alone leaves room, the PAIR does not. Repointed at
    // the warning, so what this round proved — creation decides selectability,
    // not the kit table — is still what fails if the enumeration narrows.
    const said = startingDeckWarnings(createRegistries(pair)).join(' | ');
    assert(/hands greatsword\/buckler/.test(said), `the hand pair is still enumerated — said ${JSON.stringify(said.slice(0, 160))}`);
    const kits = REG.equipment.startingKits.filter((k) => k.classId === 'reaver');
    assert(!kits.some((k) => k.rightHand === 'greatsword' && k.leftHand === 'buckler'),
      'and that pair is in no authored kit, which is why the kit table could not have found it');
  });

  // ---- 26h. the fifth round: both threads closed, not narrowed -------------
  test('26h. every restamp path reads one quota, and the engine reads the active registries', () => {
    // Round four fixed the FULL restamp by reading the count off the deck, and
    // left the subset path recomputing. Combat calls stampDeck once per pile,
    // so the pile holding attack:3 threw mid-swap. The whole deck is on the run
    // in BOTH cases, so both read the same number from the same place.
    const granting = JSON.parse(JSON.stringify(contentBundle));
    granting.tagging.push({ family: 'armament', scope: '', objectId: 'dagger', tagId: 'bound' });
    granting.equipment = {
      ...granting.equipment,
      equipmentGrants: [{ family: 'armament', scope: '', sourceId: 'dagger', cards: ['strike', 'defend'] }],
    };
    const reg = createRegistries(granting);
    const run = createRunState({ seed: 1, classId: 'reaver', registries: reg });
    const born = run.deck.filter((c) => c.equipmentRole === 'attack').length;
    eq(born, 4, 'the straight sword grants nothing, so the run is born with four attacks');
    run.loadout.sets.rightHand[0] = 'dagger'; // bound: two grants, so a replan would say three
    stampDeck(reg, run, run.deck.filter((c) => c.equipmentRole === 'attack'));
    eq(run.deck.filter((c) => c.equipmentRole === 'attack').length, born, 'a per-pile restamp keeps the birth quota');
    stampDeck(reg, run);
    eq(run.deck.filter((c) => c.equipmentRole === 'attack').length, born, 'and so does the whole-deck one');

    // Round three routed the equipment fit index through the supplied bundle
    // and left a second consumer of the module-global fold: the action engine's
    // own tag read, which feeds tag-scoped vulnerabilities.
    const extended = JSON.parse(JSON.stringify(contentBundle));
    extended.tagging.push({ family: 'card', scope: '', objectId: 'strike', tagId: 'venom' });
    const extReg = createRegistries(extended);
    const action = { card: { cardId: 'strike' } };
    eq(attackTagsFor(action, {}, extReg).join('|'), extReg.cards.get('strike').tags.join('|'),
      'the engine answers from the registries it was given');
    assert(attackTagsFor(action, {}, extReg).includes('venom'), 'including a tag only the supplied bundle carries');
    // NO LONGER the shipped fold: round seven removed the module-global fallback
    // from this path entirely (see 26j). A caller with no registries and no
    // effect tags handed us nothing, and gets nothing back.
    eq(attackTagsFor(action, {}).length, 0, 'and with no registries and no effect tags there is no answer to give');
    eq(attackTagsFor(action, { tags: ['blade'] }).join('|'), 'blade', 'while an effect still speaks for itself');
    // An instance carrying its own tags still wins — equipment-generated cards.
    eq(attackTagsFor({ card: { cardId: 'strike', tags: ['guard'] } }, {}, extReg).join('|'), 'guard',
      'a stamped instance still answers for itself');
  });

  // ---- 26i. the sixth round: an empty answer is an answer -----------------
  test('26i. emptiness is content, and an item type is named once', () => {
    // Round five stopped the module-global fold answering over a supplied
    // bundle — but only when the bundle's answer was non-empty, which is the
    // one case where the global's answer is guaranteed to be the stale one. An
    // override that STRIPS a card read as "nothing here, ask the next source",
    // and the next source handed back the shipped tags just removed.
    const stripped = JSON.parse(JSON.stringify(contentBundle));
    stripped.tagging = stripped.tagging.filter((r) => !(r.family === 'card' && r.objectId === 'strike'));
    const strippedReg = createRegistries(stripped);
    eq(strippedReg.cards.get('strike').tags.length, 0, 'the bundle removed every tag from Strike');
    eq(attackTagsFor({ card: { cardId: 'strike' } }, {}, strippedReg).length, 0,
      'and the engine honours that instead of restoring the shipped fold');
    // The effect is not the global: it came out of the same bundle, so it still
    // speaks for a card the active content gives no rows of its own. That is
    // what keeps isolated fixtures (7e) working through the same door.
    eq(attackTagsFor({ card: { cardId: 'strike' } }, { tags: ['venom'] }, strippedReg).join('|'), 'venom',
      'an effect in the same bundle may still answer for an untagged card');
    // Same rule one branch up: an equipment profile granting no tags is a
    // profile that says so, not a profile to look past.
    eq(attackTagsFor({ card: { cardId: 'strike', tags: [] } }, {}, REG).length, 0,
      'an instance stamped with no tags answers for itself');
    // The miss that keeps that branch honest: an ordinary card carries no
    // `cardTags` at all, and absent is the only thing that falls through.
    eq(attackTagsFor({ card: { cardId: 'strike' } }, {}, REG).join('|'), REG.cards.get('strike').tags.join('|'),
      'a card with no instance tags still reads the registry');

    // An itemType tag is the only tag NAMED TWICE: by the author in tags.csv,
    // and by registries.js, which derives the label from the id when it stamps
    // a piece. The suite pinned the shipped rows; nothing stopped an edit — or
    // a mod bundle — from disagreeing, and the same tag then read two ways.
    const kw = contentBundle.keywords.map((k) => k.id);
    const renamed = JSON.parse(JSON.stringify(contentBundle));
    for (const t of renamed.tags) if (t.id === 'item:armor') t.label = 'Plate';
    const said = tagContentProblems(renamed, kw).map((r) => `${r.path}: ${r.message}`).join(' | ');
    assert(/disagrees with the label the runtime derives/.test(said),
      `a relabelled item type is refused by name — said ${JSON.stringify(said.slice(0, 160))}`);
    const piece = (createRegistries(renamed).equipment.armour || [])
      .find((p) => (p.itemTypes || []).some((t) => t.tag === 'item:armor'));
    eq(piece.itemTypes.find((t) => t.tag === 'item:armor').label, 'Armor',
      'and the stamp is what it was refused for disagreeing with');
    // Two derivations of one label, held to each other directly rather than
    // through the rows that happen to be shipped.
    for (const id of ['item:blade', 'item:magic-focus', 'item:armor', 'item:', 'not-an-item']) {
      eq(itemTypeLabelFrom(id), itemTypeLabel(id) || '', `both derivations agree on '${id}'`);
    }

    // A GUARANTEE THAT NEARLY LAPSED IN THE MOVE. `tags` was a required COLUMN
    // on basicCardProfiles, so the schema alone guaranteed a profile had an
    // identity — and a profile's tags are what the equipment card carries as
    // `cardTags`, what its damage effect inherits, and what the fit check
    // reads. Taking the column into tagging.csv took the guarantee with it and
    // put nothing back; a profile stripped of its rows validated clean and
    // shipped a card the engine could not recognise. Found because the tool
    // that watched the old rule (tools/class-loadouts.mjs) crashed on the
    // missing column rather than failing, quietly dropping 28 of its checks.
    const untagged = JSON.parse(JSON.stringify(contentBundle));
    untagged.tagging = untagged.tagging
      .filter((r) => !(r.family === 'basicCardProfile' && r.objectId === 'staffMagicAttack'));
    const profileSaid = tagContentProblems(untagged, kw).map((r) => `${r.path}: ${r.message}`).join(' | ');
    assert(/basicCardProfiles\.staffMagicAttack: carries no tag/.test(profileSaid),
      `a profile with no tag rows is refused by name — said ${JSON.stringify(profileSaid.slice(0, 160))}`);
    eq(tagContentProblems(contentBundle, kw).length, 0, 'and every shipped profile satisfies it');
  });

  // ---- 26j. the seventh round: one source, one question -------------------
  test('26j. the global fold is gone from the runtime, and eligibility is asked not re-listed', () => {
    const kw = contentBundle.keywords.map((k) => k.id);

    // THE DESIGN CHANGE. Five rounds found one defect at five addresses: a
    // reader preferring the active content but falling back to the shipped fold
    // whenever the active answer looked uninteresting — absent, then empty, then
    // falsy. Each fix narrowed the condition; the condition was never the bug.
    // Two runtime readers held the global, and neither does now, so the class of
    // defect is unwritable rather than newly guarded.
    const swapped = JSON.parse(JSON.stringify(contentBundle));
    swapped.tagging = swapped.tagging.map((r) => (r.family === 'card' && r.objectId === 'strike'
      ? { ...r, tagId: 'venom' } : r));
    const swapReg = createRegistries(swapped);
    // The engine's reader: answers from the supplied bundle, with nothing behind it.
    eq(attackTagsFor({ card: { cardId: 'strike' } }, {}, swapReg).join('|'), 'venom',
      'the engine reads the bundle it was given');
    assert(tagIdsFor('strike').includes('blade'), 'while the shipped fold still says blade — two different answers');
    // The card component's reader, exercised through the same door it now uses,
    // so the chip strip cannot disagree with what combat just did.
    eq(tagService(swapReg).tagsOf('card', swapReg.cards.get('strike')).map((t) => t.id).join('|'), 'venom',
      'and the chip strip resolves through the active registries too');

    // ZERO IS A COUNT. A deck born with no attacks said "recompute from the
    // current loadout", and the next swap replanned a positive quota against a
    // deck that had none. What separates "nothing to say" from "zero" is whether
    // there is a deck at all, not whether the number is truthy.
    const zeroed = JSON.parse(JSON.stringify(contentBundle));
    zeroed.balance.equipment.startingDeck.minFiller = 0;
    zeroed.tagging.push({ family: 'armament', scope: '', objectId: 'straightSword', tagId: 'bound' });
    zeroed.equipment = {
      ...zeroed.equipment,
      equipmentGrants: [{ family: 'armament', scope: '', sourceId: 'straightSword', cards: Array(9).fill('defend') }],
    };
    const zReg = createRegistries(zeroed);
    const zRun = createRunState({ seed: 5, classId: 'reaver', registries: zReg });
    eq(zRun.deck.filter((c) => c.equipmentRole === 'attack').length, 0,
      'the bound piece supplies the whole budget, so the run is born with no attacks at all');
    zRun.loadout.sets.rightHand[0] = 'dagger'; // unbound: a replan would say four
    stampDeck(zReg, zRun);
    eq(zRun.deck.filter((c) => c.equipmentRole === 'attack').length, 0,
      'and the swap keeps that quota — zero is the number it was born with, not the absence of one');

    // ELIGIBILITY IS ASKED, NOT RE-LISTED. `armourIds` is one of three ways an
    // outfit becomes startable; free and earned-by-unlock are the others, and
    // three rounds each caught one axis later. The budget check now asks the
    // same predicate run creation asks, so a set reachable only by unlock is in
    // the enumeration without anyone having remembered it.
    const unlockOnly = JSON.parse(JSON.stringify(contentBundle));
    const oathsworn = unlockOnly.equipment.armour.find((a) => a.classId === 'reaver' && a.id === 'oathsworn');
    assert(oathsworn && oathsworn.unlock, 'oathsworn is reached by unlock, not by the creation list');
    const listed = unlockOnly.characterCreation.classes.reaver;
    assert(!((listed && listed.armourIds) || []).includes('oathsworn'),
      'and it is NOT in armourIds — which is exactly why re-listing that axis missed it');
    unlockOnly.tagging.push({ family: 'armour', scope: 'reaver', objectId: 'oathsworn', tagId: 'bound' });
    unlockOnly.equipment = {
      ...unlockOnly.equipment,
      equipmentGrants: [{ family: 'armour', scope: 'reaver', sourceId: 'oathsworn', cards: Array(10).fill('defend') }],
    };
    // Repointed at the warning like 26e/f/g: the budget refusal is gone, the
    // enumeration that finds an unlock-only outfit is not, and that is what
    // this round was about.
    const said = startingDeckWarnings(createRegistries(unlockOnly)).join(' | ');
    assert(/oathsworn/.test(said), `an unlock-only outfit is still enumerated — said ${JSON.stringify(said.slice(0, 200))}`);

    // AN EMPTY VOCABULARY IS NOT A REASON TO STOP ASKING. Guarding the per-piece
    // rule on `itemTypeIds.size` made deleting every itemType row the one edit
    // that turned the rule OFF rather than failing it.
    const noVocab = JSON.parse(JSON.stringify(contentBundle));
    noVocab.tags = noVocab.tags.filter((t) => t.domain !== 'itemType');
    noVocab.tagging = noVocab.tagging.filter((r) => !String(r.tagId).startsWith('item:'));
    const vocabSaid = tagContentProblems(noVocab, kw).map((r) => `${r.path}: ${r.message}`).join(' | ');
    assert(/no itemType tag is registered at all/.test(vocabSaid),
      `an empty item-type vocabulary is refused, not skipped — said ${JSON.stringify(vocabSaid.slice(0, 200))}`);
  });

  // ---- 26k. the eighth round: the quota is written down, not derived ------
  test('26k. a real in-combat swap keeps the birth quota, and the item prefix is reserved', () => {
    // THE PATH FOUR ROUNDS OF QUOTA FIXES NEVER TOUCHED. Rounds four to seven
    // each derived the birth quota somewhere new — from the plan, the loadout,
    // `list`, then `run.deck` — and every one of them was INERT here, because
    // combat's swap builds a synthetic run with `deck: []` and calls stampDeck
    // once per pile. There was never a deck to count. 26h passed because it
    // handed stampDeck a real run; production does not. So the number is
    // written down at birth and carried, and this drives the actual dispatch.
    const granting = JSON.parse(JSON.stringify(contentBundle));
    granting.tagging.push({ family: 'armament', scope: '', objectId: 'dagger', tagId: 'bound' });
    granting.equipment = {
      ...granting.equipment,
      equipmentGrants: [{ family: 'armament', scope: '', sourceId: 'dagger', cards: ['strike', 'defend'] }],
    };
    const reg = createRegistries(granting);
    const run = createRunState({ seed: 7, classId: 'reaver', registries: reg });
    const born = run.deck.filter((c) => c.equipmentRole === 'attack').length;
    eq(run.equipmentAttackSlotCount, born, 'the run records the quota it was born with');
    eq(born, 4, 'the unbound straight sword grants nothing, so four attacks');
    run.loadout.sets.rightHand[1] = 'dagger'; // bound: a replan would say three

    const combat = createCombat({
      registries: reg,
      rng: createRng(7),
      enemyIds: [contentBundle.enemies[0].id],
      player: {
        classId: run.class, attributes: run.attributes, maxHp: run.maxHp, hp: run.hp,
        maxMana: run.maxMana, mana: run.mana, maxStamina: run.maxStamina, stamina: run.stamina,
        energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, damageBySchoolAdd: run.damageBySchoolAdd,
        equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot,
        equipmentAttackSlotCount: run.equipmentAttackSlotCount,
        equipmentPoolDeficits: run.equipmentPoolDeficits, itemUpgradeLevels: run.itemUpgradeLevels,
        deck: run.deck, relicIds: run.relics, flasks: run.flasks, flaskCharges: run.flaskCharges,
        loadout: run.loadout,
      },
    });
    eq(combat.equipmentAttackSlotCount, born, 'and combat carries it, like the profile snapshot beside it');
    // Without the carried quota this throws "unknown equipmentAttackSlotId
    // 'attack:3'" — the pile holding the slot the replan dropped.
    dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
    const attacksAfter = [combat.piles.hand, combat.piles.draw, combat.piles.discard, combat.piles.exhaust]
      .flat().filter((c) => c && c.equipmentRole === 'attack').length;
    eq(attacksAfter, born, 'the swap re-skins the attacks across every pile, it does not re-count them');

    // THE PREFIX, CHECKED FROM BOTH SIDES. stampTags classifies by prefix while
    // the validator classifies by domain, so a NON-itemType id wearing `item:`
    // is filed as a type and dropped from the piece's gameplay tags — the fit
    // check then says noMatch for a pairing the author wrote on purpose.
    const kw = contentBundle.keywords.map((k) => k.id);
    const reserved = JSON.parse(JSON.stringify(contentBundle));
    reserved.tags.push({ id: 'item:venomous', domain: 'card', label: 'Venomous', color: '#888', glyph: '*', blurb: '' });
    const reservedSaid = tagContentProblems(reserved, kw).map((r) => `${r.path}: ${r.message}`).join(' | ');
    assert(/reserved for the itemType domain/.test(reservedSaid),
      `a card-domain '${'item:'}' id is refused by name — said ${JSON.stringify(reservedSaid.slice(0, 180))}`);
  });

  // ---- 26m. the ninth round: the budget counts every card that lands ------
  test('26m. deck size is an integer, and the package layer is in the budget', () => {
    // A HOLE I OPENED. The legacy roleCopies sum used to IMPLY that
    // startingDeckSize was an integer — a fraction can never equal a sum of
    // integer copies — and round four gated that check on the composed path
    // being off. Nothing replaced the implication, so 10.5 validated clean and
    // planned guardCount 4.5, which the copy loop turned into five guards.
    const fractional = JSON.parse(JSON.stringify(contentBundle));
    fractional.balance.startingDeckSize = 10.5;
    const fracReg = createRegistries(fractional);
    const fracSaid = validateEquipment(fracReg).join(' | ');
    assert(/startingDeckSize must be a non-negative integer/.test(fracSaid),
      `a fractional deck size is refused by name — said ${JSON.stringify(fracSaid.slice(0, 160))}`);
    eq(createRunState({ seed: 1, classId: 'reaver', registries: fracReg }).deck.length, 11,
      'and 11 is what it silently produced, which is why the door had to say so');

    // THE PACKAGE LAYER ADDS REAL CARDS. `grantedCards` is a live-but-dormant
    // seam: nothing ships one, the mechanism validates and composes, and
    // reconcileGrantedCards installs the instances at run creation. The budget
    // counted only bound-table grants, so a package granting three Defends
    // reported a size-10 plan and then built a 13-card deck. It is counted from
    // the SAME function that mints them, not a second list beside it.
    const packaged = (count) => {
      const b = JSON.parse(JSON.stringify(contentBundle));
      const sword = b.equipment.armaments.find((p) => p.id === 'straightSword');
      sword.weaponCardPackage = {
        compatibility: 'attack-v1',
        fillerAttackProfileId: sword.attackProfile,
        grantedCards: [{ cardId: 'defend', count }],
      };
      return createRegistries(b);
    };
    // SETTLED BY THE OWNER, AND THE HISTORY IS THE POINT. This round made package
    // grants count against the budget; round sixteen showed that counting them
    // is what made the deck SHRINK when the weapon left; I gated the
    // combination rather than pick a side. The ruling picked one: the cap
    // governs how many BASE cards are minted, nothing is refused, and the deck
    // floats with gear after creation. So this round's arithmetic was right —
    // package grants count at creation — and the shrink is simply what happens.
    const fits = packaged(3);
    eq(validateEquipment(fits).length, 0, 'package grants are legal under the cap rule');
    eq(createRunState({ seed: 1, classId: 'reaver', registries: fits }).deck.length,
      contentBundle.balance.startingDeckSize,
      'and creation lands on the cap, because the base cards made room for them');

    // Past the cap there is no error either — just no base cards left to mint.
    const bustReg = packaged(12);
    eq(validateEquipment(bustReg).length, 0, 'gear past the cap is a balance question, not a refusal');
    assert(/no base strikes or defends/.test(startingDeckWarnings(bustReg).join(' | ')),
      'and the shape is stated so an author can see it without starting a run');

    // AND THE DISCREPANCY THIS ROUND ONLY WARNED ABOUT IS GONE. Starseer and
    // herald shipped at 11 against an authored 10 — red in class-loadouts since
    // before this work, and something I refused to decide. The ruling decides
    // it: a weapon art is a card the weapon brings, so it counts against the cap
    // like any other, and the base cards make room. Both begin at the cap now.
    eq(validateEquipment(REG).length, 0, 'the shipped bundle still boots');
    eq(startingDeckWarnings(REG).length, 0, 'with nothing left to warn about');
    for (const classId of ['starseer', 'herald']) {
      eq(createRunState({ seed: 3, classId, registries: REG }).deck.length, contentBundle.balance.startingDeckSize,
        `${classId} begins at the cap, its weapon art counted like any other bound card`);
    }
  });

  // ---- 26n. the tenth round: what stored state obliges ---------------------
  test('26n. a generated slot is not removable, and the quota survives save and load', () => {
    // THE COST OF STORING A FACT is that everything which could contradict it
    // now has to be reconciled with it. Both findings here are consequences of
    // round eight persisting the birth quota, and both are fair.

    // The merchant's burn and the removeCardFromDeck opcode already refused
    // package outputs, in both cases for the SAME stated reason: "the next
    // authoritative reconcile would recreate the same deterministic id, so a
    // removal here could never persist". A generated attack slot has exactly
    // that property and was never excluded — burning one re-minted it, so the
    // merchant charged cinders for nothing. Persisting the quota turned that
    // silent no-op into a throw, which is how it was noticed at all.
    const run = createRunState({ seed: 1, classId: 'reaver', registries: REG });
    const composed = run.deck.filter(isEquipmentComposedInstance);
    assert(composed.length === 4 && composed.every((c) => c.equipmentAttackSlotId),
      'the four attack slots are equipment-composed, and the predicate says so');
    eq(run.equipmentAttackSlotCount, 4, 'and the run recorded that as its quota');

    const before = run.deck.length;
    executeRunEffects({ run, registries: REG, rng: { float: () => 0 } },
      [{ op: 'removeCardFromDeck', card: 'strike' }]);
    eq(run.deck.length, before, 'the opcode does not remove a card the next restamp would re-mint');
    eq(run.deck.filter((c) => c.equipmentRole === 'attack').length, 4, 'the slots are intact');
    stampDeck(REG, run); // threw "attack instance count 3 does not match authored 4" before
    eq(run.deck.filter((c) => c.equipmentRole === 'attack').length, 4, 'and the restamp agrees with the quota');

    // A random removal still has real candidates — this closes a door on cards
    // equipment owns, it does not close the mechanic.
    const candidates = run.deck.filter((c) => !isEquipmentComposedInstance(c));
    assert(candidates.length >= 5, `ordinary cards remain removable (${candidates.length} of ${run.deck.length})`);

    // AND THE NUMBER SURVIVES THE ROUND TRIP. A stored fact that does not
    // persist is worse than a derived one: the run loads, disagrees with
    // itself, and is archived for a mismatch it did not have when saved.
    const storage = createMemoryStorage();
    const saves = createSaveManager(storage);
    const rng = createRng(0xfeed);
    const saved = createRunState({ seed: 0xfeed, classId: 'reaver', registries: REG });
    saves.saveRun(saved, rng);
    const loaded = saves.loadRun(REG);
    assert(loaded != null, 'the run loads');
    eq(loaded.equipmentAttackSlotCount, saved.equipmentAttackSlotCount,
      'and carries the quota it was born with across save and load');
    stampDeck(REG, loaded);
    eq(loaded.deck.filter((c) => c.equipmentRole === 'attack').length, saved.equipmentAttackSlotCount,
      'so a restamp after loading still plans the born quota');
  });

  // ---- 26p. the eleventh round: the junction has other readers ------------
  test('26p. the importer resolves the junction, the join is the authority, and a Power is not grantable', () => {
    // THE THIRD CONSUMER OF THE OLD INLINE COLUMN. The framework importer reads
    // the RAW bundle — the one registries never touched — so `piece.tags` was
    // silently undefined and a cutover would have carried entities with no tag
    // identity at all. It resolves the junction from THAT bundle, never from
    // the module-global fold: an importer answering for the shipped rows while
    // importing a supplied bundle is the defect of five earlier rounds again.
    const imported = importLegacyContent(contentBundle);
    const sword = imported.entities.find((e) => e.legacyId === 'straightSword' || String(e.id).includes('straightSword'));
    assert(sword, 'the straight sword imports');
    eq((sword.explicitOverrides.tags || []).join('|'), REG.equipment.armaments.find((p) => p.id === 'straightSword').tags.join('|'),
      'and its imported tags equal the live stamped gameplay set, item types split off exactly as registries splits them');
    assert(!(sword.explicitOverrides.tags || []).some((t) => String(t).startsWith('item:')),
      'the item type is not smuggled into the gameplay set');

    // THE JOIN IS THE AUTHORITY, OR THE TABLE IS DECORATION. tagFamilyDomains
    // declares which domains the `effect` family may carry; the validator had
    // the answer hard-coded, so editing that row changed the table and nothing
    // else. Today the row says `card` and the derived answer is identical —
    // which is the point: same behaviour, actually derived.
    const kw = contentBundle.keywords.map((k) => k.id);
    eq(tagIdsAllowedFor(contentBundle, 'effect').join('|'), tagIdsInDomain(contentBundle, 'card').join('|'),
      'the derived effect vocabulary matches the card domain the row names');
    const repaired = JSON.parse(JSON.stringify(contentBundle));
    repaired.tagFamilyDomains = repaired.tagFamilyDomains
      .map((r) => (r.family === 'effect' ? { ...r, domain: 'item' } : r));
    const effectSaid = validateContent(repaired).errors.map((e) => `${e.path}: ${e.msg}`).join(' | ');
    assert(/unknown effect tag 'blight'/.test(effectSaid),
      `re-pairing the effect family now actually re-scopes effect tags — said ${JSON.stringify(effectSaid.slice(0, 200))}`);
    eq(tagContentProblems(repaired, kw).length, 0, 'and the re-paired row is itself legal — this is a scope change, not a broken bundle');

    // A CARD THE RECONCILE CANNOT FIND AGAIN IS NOT GRANTABLE. Reconciliation
    // is a SCAN of the four piles, so an instance in none of them reads as a
    // missing grant and is re-pushed under the same deterministic id. A Power
    // is REMOVED FROM PLAY when played — it sits in no pile — so the next swap
    // would hand it back, replayable, stacking its effect every time.
    const power = contentBundle.cards.find((c) => c.type === 'power');
    assert(power && REG.framework.afterPlayDestination(REG.cards.get(power.id)) === 'REMOVED_FROM_PLAY',
      'a shipped Power leaves play rather than landing in a pile');
    const granting = JSON.parse(JSON.stringify(contentBundle));
    const piece = granting.equipment.armaments.find((p) => p.id === 'straightSword');
    piece.weaponCardPackage = {
      compatibility: 'attack-v1',
      fillerAttackProfileId: piece.attackProfile,
      grantedCards: [{ cardId: power.id, count: 1 }],
    };
    const powerSaid = validateEquipment(createRegistries(granting)).join(' | ');
    assert(/removed from play when played/.test(powerSaid),
      `granting a Power is refused by name — said ${JSON.stringify(powerSaid.slice(0, 200))}`);
    // A skill grant is refused for a DIFFERENT reason (26u: the composed deck
    // cannot yet carry package grants at all), so the lifecycle rule is checked
    // where it is the only rule in play — at the model door, which knows nothing
    // about the composed deck.
    const ordinary = JSON.parse(JSON.stringify(contentBundle));
    const ordinaryPiece = ordinary.equipment.armaments.find((p) => p.id === 'straightSword');
    ordinaryPiece.weaponCardPackage = {
      compatibility: 'attack-v1',
      fillerAttackProfileId: ordinaryPiece.attackProfile,
      grantedCards: [{ cardId: 'defend', count: 1 }],
    };
    const ordinaryReg = createRegistries(ordinary);
    const ordinarySaid = validateEquipment(ordinaryReg).join(' | ');
    assert(!/removed from play when played/.test(ordinarySaid),
      'an ordinary skill grant is not refused for its lifecycle');
    assert(WeaponCardPackageModel.fromPiece(ordinaryReg, ordinaryReg.equipment.armaments
      .find((p) => p.id === 'straightSword')).grantedCards.length === 1,
      'and the package model accepts it — the lifecycle rule closes one card type, not the seam');
  });

  // ---- 26q. the twelfth round: depth, and the panel telling the truth ----
  test('26q. a deep source materialises where it was declared, and the Armoury reports the deck it has', () => {
    // `source` IS A PATH, and stampTags resolves it to any depth — but writing
    // the result back assumed depth two, so a family at
    // `equipment.extras.charms` had its rows dropped onto `equipment.extras`,
    // REPLACING the object that held `charms`. The bundle validated, the rows
    // stamped, and every reader that walked the declared path found nothing.
    const deep = JSON.parse(JSON.stringify(contentBundle));
    deep.equipment.extras = { charms: [{ id: 'luckCharm', name: 'Luck Charm' }], note: 'a sibling' };
    deep.tagFamilies.push({ family: 'charm', source: 'equipment.extras.charms', scopeField: '', label: 'Charm', blurb: '' });
    deep.tagFamilyDomains.push({ family: 'charm', domain: 'item' });
    deep.tagging.push({ family: 'charm', scope: '', objectId: 'luckCharm', tagId: 'bound' });
    const deepReg = createRegistries(deep);
    eq(deepReg.equipment.extras.note, 'a sibling', 'the sibling key survives — the parent is not replaced');
    eq((deepReg.equipment.extras.charms || []).length, 1, 'and the rows land at the leaf the family declared');
    eq(deepReg.equipment.extras.charms[0].tags.join('|'), 'bound', 'stamped, as any other family');
    eq(tagService(deepReg).withTag('charm', 'bound').map((r) => r.id).join('|'), 'luckCharm',
      'so a reader that walks the declared path finds them');

    // THE PANEL RENDERS `x{copies}`, AND THEY WERE THE LEGACY NUMBERS. Under a
    // composed deck the authored roleCopies table is no longer what the deck
    // holds: bias 0.75 builds six attacks and two guards while that table still
    // reads 4/4, so the Armoury told the player something the deck contradicted.
    const biased = JSON.parse(JSON.stringify(contentBundle));
    biased.balance.equipment.startingDeck.classes.reaver = { strikeBias: 0.75 };
    const biasedReg = createRegistries(biased);
    const run = createRunState({ seed: 2, classId: 'reaver', registries: biasedReg });
    const actual = { attack: 0, guard: 0 };
    for (const card of run.deck) if (actual[card.equipmentRole] !== undefined) actual[card.equipmentRole] += 1;
    eq(actual.attack, 6, 'the deck really is six attacks at this bias');
    eq(actual.guard, 2, 'and two guards');
    const roles = equipmentSurfaceReceipt(biasedReg, run).roles;
    const shown = Object.fromEntries(roles.map((r) => [r.role, r.copies]));
    eq(shown.attack, actual.attack, 'the panel reports the attacks the run has');
    eq(shown.guard, actual.guard, 'and the guards');
    // Legacy path untouched: with the composed deck off, the authored table is
    // still the answer, because then it is the one the deck was built from.
    const legacy = JSON.parse(JSON.stringify(contentBundle));
    legacy.balance.equipment.startingDeck.enabled = false;
    const legacyReg = createRegistries(legacy);
    const legacyRun = createRunState({ seed: 2, classId: 'reaver', registries: legacyReg });
    const legacyShown = Object.fromEntries(equipmentSurfaceReceipt(legacyReg, legacyRun).roles.map((r) => [r.role, r.copies]));
    eq(legacyShown.attack, legacy.balance.equipment.roleCopies.attack, 'the legacy path still reads the authored table');
    eq(legacyShown.guard, legacy.balance.equipment.roleCopies.guard, 'for both roles');
  });

  // ---- 26r. the thirteenth round: count the deck, and never throw at a door
  test('26r. the panel counts every role off the deck, and a malformed sourceOrder is named', () => {
    // THE SAME MISTAKE ONE FIELD OVER, found the round after I made it. Round
    // twelve anchored ATTACK to the run and left guard on a fresh plan — but a
    // restamp PRESERVES the instances the run was born with and only re-skins
    // them, so after a grant-bearing swap the plan and the deck disagree for
    // guard exactly as they did for attack. Counting roles off the deck has no
    // per-role list to be incomplete: a role added later is counted the day it
    // exists, without anyone remembering to add it here.
    const granting = JSON.parse(JSON.stringify(contentBundle));
    granting.tagging.push({ family: 'armament', scope: '', objectId: 'straightSword', tagId: 'bound' });
    granting.equipment = {
      ...granting.equipment,
      equipmentGrants: [{ family: 'armament', scope: '', sourceId: 'straightSword', cards: ['strike', 'defend'] }],
    };
    const reg = createRegistries(granting);
    const run = createRunState({ seed: 4, classId: 'reaver', registries: reg });
    const roleCount = (deck) => {
      const out = {};
      for (const card of deck) if (card && card.equipmentRole) out[card.equipmentRole] = (out[card.equipmentRole] || 0) + 1;
      return out;
    };
    const born = roleCount(run.deck);
    eq(born.guard, 3, 'two grants shift the composed guard count to three');
    assert(born.guard !== contentBundle.balance.equipment.roleCopies.guard,
      'and that differs from the authored table, which is what makes this checkable');

    run.loadout.sets.rightHand[0] = 'dagger'; // unbound: a fresh plan would say four
    stampDeck(reg, run);
    const after = roleCount(run.deck);
    eq(after.guard, born.guard, 'the swap re-skins the guards, it does not re-count them');
    const shown = Object.fromEntries(equipmentSurfaceReceipt(reg, run).roles.map((r) => [r.role, r.copies]));
    eq(shown.guard, after.guard, 'and the panel reports the guards the run has, not the ones a replan would give');
    eq(shown.attack, after.attack, 'attack too, from the same count rather than a separate anchor');

    // A VALIDATION DOOR MAY NOT THROW. `sourceOrder` (named `dropOrder` when
    // this round found it, before the cap ruling left nothing to drop) is a
    // list, and a plausible typo — the bare string instead of a one-item list —
    // reached `.join` and crashed validateEquipment instead of being answered.
    const typo = JSON.parse(JSON.stringify(contentBundle));
    typo.balance.equipment.startingDeck.sourceOrder = 'from:global';
    const said = validateEquipment(createRegistries(typo)).join(' | ');
    assert(/sourceOrder must be an array of grant-source tags/.test(said),
      `a non-array sourceOrder is a named problem, not a crash — said ${JSON.stringify(said.slice(0, 160))}`);
    // The vocabulary is closed AND it is the tag registry, not a list in code:
    // a misspelling is caught because no such row exists, and adding a sixth
    // source is a row in tags.csv rather than an edit to loadout.js.
    const unknown = JSON.parse(JSON.stringify(contentBundle));
    unknown.balance.equipment.startingDeck.sourceOrder = ['from:global', 'from:armour'];
    assert(/unknown grant source 'from:armour'/.test(validateEquipment(createRegistries(unknown)).join(' | ')),
      "the 'armor'/'armour' spelling trap is named rather than silently ignored");
    const registered = contentBundle.tags.filter((t) => t.domain === 'grantSource').map((t) => t.id);
    assert(registered.length === 5 && registered.every((id) => id.startsWith('from:')),
      `the grant sources are tag rows, not a constant (${registered.join(', ')})`);
    assert(contentBundle.balance.equipment.startingDeck.sourceOrder.every((id) => registered.includes(id)),
      'and the shipped order names only registered ones');

    // ROUND TWENTY: the vocabulary was data, but the ids the ENGINE stamped
    // were still typed at the minting seams. So a rename — the tag row and its
    // sourceOrder entry moved together, exactly the edit the paragraph above
    // promises is safe — validated clean and then dealt that source's cards
    // LAST, because sortBySourceOrder no longer recognised what the seam
    // stamped. Starseer opened with its class card ahead of its weapon cards.
    // Two claims, because the fix has two halves: the rename works when the
    // binding moves with it, and it is REFUSED when it does not.
    const renamed = (moveBinding) => {
      const b = JSON.parse(JSON.stringify(contentBundle));
      for (const t of b.tags) if (t.id === 'from:weapon') t.id = 'from:armament';
      const deck = b.balance.equipment.startingDeck;
      deck.sourceOrder = deck.sourceOrder.map((id) => (id === 'from:weapon' ? 'from:armament' : id));
      if (moveBinding) deck.sources.weapon = 'from:armament';
      return createRegistries(b);
    };
    const halfDone = validateEquipment(renamed(false)).join(' | ');
    assert(/sources\.weapon names unknown grant source 'from:weapon'/.test(halfDone),
      `a rename that leaves the binding behind is named, not silently mis-ordered — said ${JSON.stringify(halfDone.slice(0, 200))}`);
    const whole = renamed(true);
    eq(validateEquipment(whole).length, 0, 'and a rename that moves the binding with it is clean');
    const stamped = createRunState({ seed: 3, classId: 'starseer', registries: whole })
      .deck.map((c) => c.grantSource || null).filter((id) => id !== null);
    assert(stamped.every((id) => id !== 'from:weapon'),
      `no seam stamps the old id after the rename — ${JSON.stringify(stamped)}`);
    const stampedRanks = stamped.map((id) => whole.balance.equipment.startingDeck.sourceOrder.indexOf(id));
    assert(stampedRanks.every((r, i) => r >= 0 && (i === 0 || r >= stampedRanks[i - 1])),
      `and the renamed source is still ranked where it was — ${JSON.stringify(stamped)}`);

    // The seam set is closed in both directions: a seam left unbound would
    // stamp nothing, and a binding for a seam the engine does not have would
    // never be read. Both are authoring mistakes with no visible symptom.
    const unbound = JSON.parse(JSON.stringify(contentBundle));
    delete unbound.balance.equipment.startingDeck.sources.class;
    assert(/sources\.class must name a grant-source tag/.test(validateEquipment(createRegistries(unbound)).join(' | ')),
      'an unbound minting seam is named');
    const invented = JSON.parse(JSON.stringify(contentBundle));
    invented.balance.equipment.startingDeck.sources.relic = 'from:relic';
    assert(/unknown seam 'relic'/.test(validateEquipment(createRegistries(invented)).join(' | ')),
      "a binding for a seam that mints nothing is named — it would never be stamped");
  });

  // ---- 26s. the fourteenth round: a door that cannot throw ----------------
  test('26s. malformed content is answered, never thrown at — named first, floored always', () => {
    const clone = () => JSON.parse(JSON.stringify(contentBundle));

    // FOUR ROUNDS FOUND ONE SHAPE at four addresses: a pass whose whole job is
    // to ANSWER questions about content, crashing on content instead. Each got
    // a named rule; the fifth address is how you learn that was not the fix.
    // Malformed content is infinite and this pass reads hundreds of fields, so
    // the guarantee cannot rest on having guarded each one. Named rules first —
    // they say the useful thing — and a floor underneath so the door is
    // STRUCTURALLY unable to throw.

    // The three this round named, each formerly a crash:
    const badSource = clone();
    badSource.tagFamilies.push({ family: 'oops', source: 7, scopeField: '', label: 'X', blurb: '' });
    badSource.tagFamilyDomains.push({ family: 'oops', domain: 'card' });
    const sourceSaid = validateContent(badSource).errors.map((e) => `${e.path}: ${e.msg}`).join(' | ');
    assert(/tagFamilies\.oops\.source: source must be a dotted path string/.test(sourceSaid),
      `a non-string source is named — said ${JSON.stringify(sourceSaid.slice(0, 160))}`);
    createRegistries(badSource); // and boot no longer throws before the validator can speak

    const badKeywords = clone();
    badKeywords.keywords = { a: 1 };
    const kwResult = validateContent(badKeywords);
    assert(!kwResult.ok, 'a non-array keywords registry fails');
    assert(kwResult.errors.some((e) => e.path === 'keywords' && /must be an array/.test(e.msg)),
      'and is named by path rather than reported as a crash');

    const badGrants = clone();
    badGrants.balance.equipment.startingDeck.global = { grants: {} };
    const badGrantsReg = createRegistries(badGrants);
    assert(validateEquipment(badGrantsReg).some((p) => /global\.grants must be an array/.test(p)),
      'a non-array global.grants is named');
    // And the PLANNER reads the shape it needs rather than trusting the door:
    // tools and fixtures build configs by hand and never pass through it.
    startingDeckPlan(badGrantsReg, createLoadout(badGrantsReg, 'reaver'), 'reaver');

    // THE FLOOR ITSELF, and the point is that it does not depend on my having
    // thought of the field. `enemies` as a bare number reaches an unguarded
    // `for…of` no rule covers — I found it by REMOVING the floor and looking for
    // something that still threw, which is the only honest way to test a
    // backstop. With the floor it is a reported problem; without it, a stack.
    const unforeseen = clone();
    unforeseen.enemies = 3;
    const floored = validateContent(unforeseen); // must not throw
    assert(!floored.ok && floored.errors.length, 'an unforeseen malformation is a problem, not an exception');
    assert(floored.errors.some((e) => e.path === '<bundle>' || e.path === 'enemies'),
      'and it is attributed — to the field if a rule names it, to the floor if none does');

    // AND THE FLOOR ADDS RATHER THAN REPLACES. The first version created its
    // result array in the catch, so a throw partway through DISCARDED every
    // field-addressed problem found before it: content that correctly reported
    // `grantedCards[0] must name cardId` came back saying only "cannot read
    // properties of null". A backstop that erases the answers it stands behind
    // is worse than none, so the accumulator is created outside the try and the
    // floor message is appended to it.
    const partial = clone();
    const pkgPiece = partial.equipment.armaments.find((p) => p.id === 'straightSword');
    pkgPiece.weaponCardPackage = {
      compatibility: 'attack-v1',
      fillerAttackProfileId: pkgPiece.attackProfile,
      grantedCards: [null],
    };
    const partialSaid = validateEquipment(createRegistries(partial));
    assert(partialSaid.some((p) => /grantedCards\[0\] must name cardId/.test(p)),
      `the field-addressed problem survives — said ${JSON.stringify(partialSaid.slice(0, 2))}`);
    assert(!partialSaid.some((p) => /could not finish reading/.test(p)),
      'and this particular one no longer reaches the floor at all, because the diagnostic that threw was made safe');

    // The additive property itself, on a bundle that DOES still reach the floor:
    // a named rule fires early, an unguarded read throws late, and the result
    // must carry both. This is the assertion that would have caught the erasing
    // floor; the case above only proves one diagnostic stopped throwing.
    const bothKinds = clone();
    bothKinds.tagFamilies.push({ family: 'oops', source: 7, scopeField: '', label: 'X', blurb: '' });
    bothKinds.tagFamilyDomains.push({ family: 'oops', domain: 'card' });
    bothKinds.enemies = 3; // throws late, in a sweep no rule covers
    const both = validateContent(bothKinds);
    assert(both.errors.some((e) => e.path === 'tagFamilies.oops.source'),
      'the named rule that fired before the throw is kept');
    assert(both.errors.some((e) => e.path === '<bundle>'),
      'and the floor is appended rather than substituted');
    assert(both.errors.length > 2, `both kinds survive together (${both.errors.length} problems)`);

    // The floor never fires on sound content — it is underneath the rules, not
    // in front of them.
    assert(validateContent(contentBundle).ok, 'the shipped bundle still validates clean');
    assert(!validateContent(contentBundle).errors.some((e) => e.path === '<bundle>'),
      'and never reports the floor');
    eq(validateEquipment(REG).length, 0, 'equipment likewise');
  });

  // ---- 26t. the fifteenth round: absent is not zero, a fourth time --------
  test('26t. a legacy save recovers its birth quota, and an absent role counts zero', () => {
    // I MADE THIS MISTAKE INSIDE THE FIX THAT CLOSED IT. Rounds six and seven
    // were both "a legitimate empty/zero read as absence, so the next source
    // answered over the author". Round thirteen replaced the Armoury's role
    // counts with a count of the deck — and merged that count over the legacy
    // table, so a role the deck does NOT contain fell through to the authored
    // number. Bias 1 builds eight attacks and no guards; the panel said four.
    const biased = JSON.parse(JSON.stringify(contentBundle));
    biased.balance.equipment.startingDeck.classes.reaver = { strikeBias: 1 };
    const biasedReg = createRegistries(biased);
    const run = createRunState({ seed: 9, classId: 'reaver', registries: biasedReg });
    eq(run.deck.filter((c) => c.equipmentRole === 'guard').length, 0, 'this deck really has no guards');
    const shown = Object.fromEntries(equipmentSurfaceReceipt(biasedReg, run).roles.map((r) => [r.role, r.copies]));
    eq(shown.guard, 0, 'and the panel says zero rather than the authored four');
    eq(shown.attack, 8, 'while the attacks it does have are counted');
    // The deck is the COMPLETE answer when there is one — no merge to fall
    // through, which is what makes the mistake unwritable here rather than
    // guarded against.

    // THE LEGACY SAVE. Every reader that falls back to counting a deck did so
    // into a LOCAL, so a run saved before the field existed stayed `undefined`
    // on the run itself — and createCombat then carried undefined onto the
    // synthetic run, where the first mid-fight swap replans. The run's own deck
    // is the record; the load door repairs it ONCE rather than every reader
    // re-deriving it, which is the mistake four earlier rounds were about.
    const storage = createMemoryStorage();
    const saves = createSaveManager(storage);
    const fresh = createRunState({ seed: 21, classId: 'reaver', registries: REG });
    const bornWith = fresh.equipmentAttackSlotCount;
    assert(Number.isFinite(bornWith) && bornWith > 0, 'a new run records its quota');
    delete fresh.equipmentAttackSlotCount; // exactly what a pre-field save holds
    saves.saveRun(fresh, createRng(21));
    const loaded = saves.loadRun(REG);
    assert(loaded != null, 'the legacy-shaped save still loads');
    eq(loaded.equipmentAttackSlotCount, bornWith, 'and its quota is recovered from its own deck');
    eq(loaded.equipmentAttackSlotCount, loaded.deck.filter((c) => c.equipmentRole === 'attack').length,
      'which is exactly what the deck holds');
    // AND THE SNAPSHOT, NOT ONLY THE RUN. A pre-field save with a fight in
    // progress healed its run and resumed a combat still holding `undefined`:
    // restoreCombatSnapshot reads `saved.equipmentAttackSlotCount`, and the
    // migration used the recovered number for its restamp and then dropped it.
    // Healing the door and leaving the consumer is the half-fix this work keeps
    // making, so the resolved value is written where the resume looks.
    const midFight = createRunState({ seed: 31, classId: 'reaver', registries: REG });
    const midBorn = midFight.equipmentAttackSlotCount;
    const fight = createCombat({
      registries: REG,
      rng: createRng(31),
      enemyIds: [contentBundle.enemies[0].id],
      player: {
        classId: midFight.class, attributes: midFight.attributes, maxHp: midFight.maxHp, hp: midFight.hp,
        maxMana: midFight.maxMana, mana: midFight.mana, maxStamina: midFight.maxStamina, stamina: midFight.stamina,
        energyMax: midFight.energyMax, drawPerTurn: midFight.drawPerTurn,
        damageBySchoolAdd: midFight.damageBySchoolAdd,
        equipmentProfileRuleSnapshot: midFight.equipmentProfileRuleSnapshot,
        equipmentAttackSlotCount: midFight.equipmentAttackSlotCount,
        equipmentPoolDeficits: midFight.equipmentPoolDeficits, itemUpgradeLevels: midFight.itemUpgradeLevels,
        deck: midFight.deck, relicIds: midFight.relics, flasks: midFight.flasks,
        flaskCharges: midFight.flaskCharges, loadout: midFight.loadout,
      },
    });
    commitCombatSnapshot({ run: midFight, combat: fight, nodeId: 'n1', encounterId: contentBundle.encounters[0].id });
    delete midFight.combatEntered.snapshot.equipmentAttackSlotCount; // pre-field shape
    delete midFight.equipmentAttackSlotCount;
    const fightSaves = createSaveManager(createMemoryStorage());
    fightSaves.saveRun(midFight, createRng(31));
    const resumed = fightSaves.loadRun(REG);
    assert(resumed != null, 'the mid-fight legacy save loads');
    eq(resumed.equipmentAttackSlotCount, midBorn, 'the run is healed');
    // The RESUME is what matters, and it reads the run's number when the
    // snapshot has none. Healing the snapshot itself would make migration
    // rewrite a snapshot it already understands — tools/weapon-card-packages
    // asserts against exactly that, and caught the first version of this fix.
    eq(resumed.combatEntered.snapshot.equipmentAttackSlotCount, undefined,
      'the stored snapshot is left byte-identical, not rewritten by the load');
    const restored = restoreCombatSnapshot({
      registries: REG,
      rng: createRng(31),
      snapshot: resumed.combatEntered.snapshot,
      fallbackAttackSlotCount: resumed.equipmentAttackSlotCount,
    });
    eq(restored.equipmentAttackSlotCount, midBorn,
      'and the resumed combat still gets the birth quota, from the run that is its authority');

    // Repaired at the door means every downstream reader gets it for free —
    // combat, the snapshot, and the panel — with no second derivation.
    stampDeck(REG, loaded);
    eq(loaded.deck.filter((c) => c.equipmentRole === 'attack').length, bornWith,
      'so a restamp after loading plans the recovered quota');
  });

  // ---- 26u. the ruling: the cap is a creation rule, and only that ---------
  test('26u. the cap governs base cards at creation, and the deck floats with gear after', () => {
    // THE QUESTION I REFUSED, ANSWERED BY ITS OWNER (2026-09-03). Round nine
    // said package grants must count against startingDeckSize or birth overruns
    // it. Round sixteen said counting them is what makes the deck shrink when
    // the weapon leaves. Both were right about the code; what was missing was a
    // decision, and the decision is: the cap applies at CHARACTER CREATION and
    // nowhere else. It governs how many BASE strikes and defends are minted.
    // Bound cards are dealt first and are never capped, dropped or refused.
    const packaged = JSON.parse(JSON.stringify(contentBundle));
    const piece = packaged.equipment.armaments.find((p) => p.id === 'straightSword');
    piece.weaponCardPackage = {
      compatibility: 'attack-v1',
      fillerAttackProfileId: piece.attackProfile,
      grantedCards: [{ cardId: 'defend', count: 3 }],
    };
    const reg = createRegistries(packaged);
    eq(validateEquipment(reg).length, 0, 'the combination is legal — there is nothing left to gate');

    const cap = contentBundle.balance.startingDeckSize;
    const run = createRunState({ seed: 1, classId: 'reaver', registries: reg });
    eq(run.deck.length, cap, 'creation lands on the cap');
    const bound = run.deck.filter((c) => c.equipmentRole === 'granted' || c.equipmentRole === 'weaponArt').length;
    const base = run.deck.filter((c) => c.equipmentRole === 'attack' || c.equipmentRole === 'guard').length;
    assert(bound > 0 && base > 0, `the deck is bound cards plus base cards (${bound} + ${base})`);

    // AND THE FLOAT IS THE RULE, NOT A DEFECT. Swapping to gear that lends
    // fewer cards leaves a smaller deck. This is the exact behaviour round
    // sixteen reported as a bug and I gated the seam over; it is now what the
    // game is specified to do, so it is asserted rather than prevented.
    run.loadout.sets.rightHand[0] = 'dagger';
    stampDeck(reg, run);
    assert(run.deck.length < cap,
      `swapping to gear that lends nothing leaves ${run.deck.length}, below the ${cap}-card creation cap — by design`);
    eq(run.deck.filter((c) => c.equipmentRole === 'granted').length, 0, 'the sword took its cards with it');
    eq(run.deck.filter((c) => c.equipmentRole === 'attack').length, run.equipmentAttackSlotCount,
      'while the attack count the run was born with is untouched — the other half of the SPEC sentence still holds');

    // BOUND CARDS ARE DEALT FIRST, IN THE AUTHORED ORDER. SPEC says so; the code
    // did the opposite until this was written — startingDeckRefs emits base
    // cards before it consumes the grants, and reconcileGrantedCards appends
    // package grants and arts after that again, so starseer opened with four
    // strikes and three defends and its equipment cards trailed behind. The
    // spec I wrote and the code I wrote disagreed, and the spec is the ruling.
    const ordered = createRunState({ seed: 3, classId: 'starseer', registries: REG });
    const provenance = ordered.deck.map((c) => c.grantSource || null);
    const firstBase = provenance.indexOf(null);
    assert(firstBase > 0, 'the deck opens with bound cards, not base cards');
    assert(provenance.slice(firstBase).every((p) => p === null),
      `and every base card follows them — ${JSON.stringify(provenance)}`);
    const boundOrder = provenance.slice(0, firstBase);
    const authored = contentBundle.balance.equipment.startingDeck.sourceOrder;
    const ranks = boundOrder.map((p) => authored.indexOf(p));
    assert(ranks.every((r, i) => i === 0 || r >= ranks[i - 1]),
      `bound cards follow sourceOrder — ${JSON.stringify(boundOrder)} against ${JSON.stringify(authored)}`);
    assert(boundOrder.includes('from:weapon') && boundOrder.includes('from:class'),
      'with more than one source present, so the ordering is actually exercised');
    // Base cards keep their RELATIVE order: the legacy attack-slot migration
    // binds attack:0..N-1 by deck position, so reshuffling them would rebind.
    const baseRoles = ordered.deck.slice(firstBase).map((c) => c.equipmentRole);
    eq(baseRoles.join(' '), [...baseRoles].sort((a, b) => (a === 'attack' ? -1 : 1) - (b === 'attack' ? -1 : 1)).join(' '),
      'attacks still precede guards among the base cards');

    // The odd-split winner is authored, not a rounding accident.
    const guardWins = JSON.parse(JSON.stringify(contentBundle));
    guardWins.balance.equipment.startingDeck.oddFillerGoesTo = 'guard';
    guardWins.balance.equipment.startingDeck.classes.starseer = { strikeBias: 0.5 };
    const starseerDefault = startingDeckPlan(REG, createLoadout(REG, 'starseer'), 'starseer');
    const guardReg = createRegistries(guardWins);
    const starseerGuard = startingDeckPlan(guardReg, createLoadout(guardReg, 'starseer'), 'starseer');
    eq(starseerDefault.filler % 2, 1, 'starseer has an odd number of base cards to split');
    eq(starseerDefault.attackCount, starseerGuard.attackCount + 1,
      'the remainder goes to attack by default and to guard when the field says so');
    assert(!['attack', 'guard'].includes('either'), 'the field is a closed pair');
    const badOdd = JSON.parse(JSON.stringify(contentBundle));
    badOdd.balance.equipment.startingDeck.oddFillerGoesTo = 'either';
    assert(/oddFillerGoesTo must be 'attack' or 'guard'/.test(validateEquipment(createRegistries(badOdd)).join(' | ')),
      'and anything else is refused by name');
  });

  // ---- 26v. the owner's second ruling: bound cards ride with their item ----
  test('26v. an item-owned card arrives with its item, leaves with it, and returns identical — armour included, in combat too', () => {
    // ONE OWNER MODEL. A weapon package's grants and arts already rode with the
    // weapon; the `bound` table's cards did not — they were minted as plain
    // run-owned refs at creation and never looked at again, so they outlived
    // the piece that promised them and a bound piece picked up mid-run brought
    // nothing (round nineteen's finding). The owner ruled: if the item is not
    // equipped, its cards are gone. So all three sources now mint item-owned
    // instances through one door and one reconcile sweeps them.
    const b = JSON.parse(JSON.stringify(contentBundle));
    b.tagging.push({ family: 'armament', scope: '', objectId: 'straightSword', tagId: 'bound' });
    b.tagging.push({ family: 'armament', scope: '', objectId: 'dagger', tagId: 'bound' });
    b.tagging.push({ family: 'armour', scope: 'reaver', objectId: 'vigil', tagId: 'bound' });
    b.equipment = {
      ...b.equipment,
      equipmentGrants: [
        { family: 'armament', scope: '', sourceId: 'straightSword', cards: ['strike', 'strike'] },
        { family: 'armament', scope: '', sourceId: 'dagger', cards: ['defend'] },
        { family: 'armour', scope: 'reaver', sourceId: 'vigil', cards: ['defend', 'strike'] },
      ],
    };
    const reg = createRegistries(b);
    const run = createRunState({ seed: 11, classId: 'reaver', registries: reg });
    const owned = () => run.deck.filter(isItemOwned).map((c) => c.instanceId).sort();
    const sword = pieceItemRef(reg.equipment.armaments.find((a) => a.id === 'straightSword'));
    eq(sword, 'armament/straightSword', 'an owner is written as the namespaced item ref the rest of the model keys on');

    // BORN WITH THEM, numbered, owned, and counted against the cap.
    const bornOwned = owned();
    eq(bornOwned.filter((id) => id.startsWith(`bound:${sword}:`)).join('|'),
      `bound:${sword}:strike:0|bound:${sword}:strike:1`,
      'two copies of one card are two numbered instances, so the ids are deterministic');
    assert(run.deck.filter((c) => c.grantedBy === sword).every((c) => c.equipmentRole === 'granted' && c.grantSource === 'from:weapon'),
      'a bound-table card is a granted instance with its provenance stamped');
    eq(run.deck.length, contentBundle.balance.startingDeckSize, 'and it counts against the cap like any other bound card');

    // UNEQUIP: gone. Not "still there with a stale sourceId" — gone.
    run.loadout.sets.rightHand[0] = null;
    stampDeck(reg, run);
    eq(owned().filter((id) => id.startsWith(`bound:${sword}:`)).length, 0, "the sword's cards leave with the sword");
    assert(!run.deck.some((c) => c.cardId === 'strike' && c.grantedBy === sword), 'nothing of it lingers under another role');

    // A BOUND PIECE PICKED UP MID-RUN brings its cards — which never happened
    // before, because only creation read the table.
    run.loadout.sets.rightHand[0] = 'dagger';
    stampDeck(reg, run);
    eq(owned().filter((id) => id.startsWith('bound:armament/dagger:')).join('|'), 'bound:armament/dagger:defend:0',
      'equipping a bound piece mid-run deals its cards');

    // RE-EQUIP: back, identical ids, and the sweep is idempotent.
    run.loadout.sets.rightHand[0] = 'straightSword';
    stampDeck(reg, run);
    eq(owned().join('|'), bornOwned.join('|'), 're-equipping restores exactly the instances the run was born with');
    const again = owned().join('|');
    stampDeck(reg, run);
    eq(owned().join('|'), again, 'and a second restamp changes nothing');

    // ARMOUR TOO. The tag is the gate and it does not care what wears it; the
    // owner ref carries the class, because outfit ids repeat per class.
    const vigil = reg.equipment.armour.find((o) => o.id === 'vigil' && o.classId === 'reaver');
    run.loadout.sets.armor[0] = 'vigil';
    stampDeck(reg, run);
    eq(owned().filter((id) => id.startsWith(`bound:${pieceItemRef(vigil)}:`)).join('|'),
      'bound:armor/reaver/vigil:defend:0|bound:armor/reaver/vigil:strike:0',
      'an outfit lends its cards under a class-scoped owner');
    assert(run.deck.filter((c) => c.grantedBy === pieceItemRef(vigil)).every((c) => c.grantSource === 'from:armor'),
      'stamped from the armour seam');
    run.loadout.sets.armor[0] = 'default';
    stampDeck(reg, run);
    eq(owned().filter((id) => id.startsWith('bound:armor/')).length, 0, 'and taking it off takes them back');

    // IN COMBAT the deck is the piles, and the same sweep runs on them: a
    // stale bound card in HAND leaves, a wanted one already in DRAW stays put,
    // the missing one lands in the discard pile like any mid-fight addition.
    const piles = {
      hand: [{ instanceId: 'bound:armament/dagger:defend:0', cardId: 'defend', equipmentRole: 'granted', grantedBy: 'armament/dagger' }],
      draw: [{ instanceId: 'x', cardId: 'strike' }, { instanceId: `bound:${sword}:strike:0`, cardId: 'strike', equipmentRole: 'granted', grantedBy: sword }],
      discard: [], exhaust: [],
    };
    reconcileGrantedCardsInCombat(reg, run, piles);
    eq(piles.hand.length, 0, 'the unequipped dagger takes its card out of the hand');
    eq(piles.draw.map((c) => c.instanceId).join('|'), `x|bound:${sword}:strike:0`, 'a present wanted card stays where it is');
    assert(piles.discard.some((c) => c.instanceId === `bound:${sword}:strike:1`), 'the missing copy lands in the discard pile');

    // THE PLAN COUNTS THEM THROUGH THE SAME DOOR, so they are neither dealt
    // twice nor counted twice: `grants` is the deal-out list, `packageCards`
    // is what the reconcile mints.
    const plan = startingDeckPlan(reg, createLoadout(reg, 'reaver'), 'reaver');
    assert(!plan.grants.some((g) => g.grantSource === undefined && g.sourceId), 'no bound-table ref rides in the deal-out list');
    assert(plan.packageCards >= 2, `the sword's two cards are counted where the package cards are (${plan.packageCards})`);
  });

  // ---- 26w. the owner's third ruling: a smith moves cards between an item and the run ----
  test('26w. extract lifts a card out of a mount and the mount shows its fallback; install seats one back — priced, saved, and never a strike', () => {
    // A MOUNT is where an item's card sits. What a smith did to it is
    // `run.itemMounts`; the composer reads that through one door, so an
    // extracted art is gone from the sword on every restamp and the mount
    // shows the Dodge Roll (the owner's fallback) until something is seated.
    const fixture = (tweak = () => {}) => {
      const b = JSON.parse(JSON.stringify(contentBundle));
      b.equipment.armaments = b.equipment.armaments.map((piece) => (piece.id === 'straightSword'
        ? { ...piece, weaponCardPackage: { compatibility: 'attack-v1', fillerAttackProfileId: 'bladeAttack', grantedCards: [{ cardId: 'quickstep', count: 1 }], weaponArtDefaults: ['crimsonCleave'] } }
        : piece));
      b.tagging.push({ family: 'card', scope: '', objectId: 'crimsonCleave', tagId: 'extractable' });
      b.tagging.push({ family: 'card', scope: '', objectId: 'quickstep', tagId: 'extractable' });
      b.scripts = contentBundle.scripts; // functions do not survive JSON, and the door checks script references
      tweak(b);
      return b;
    };
    const reg = createRegistries(fixture());
    const run = createRunState({ seed: 21, classId: 'reaver', registries: reg });
    const sword = 'armament/straightSword';
    const artKey = mountKeyOf.weaponArt('straightSword', 'crimsonCleave');
    const grantKey = mountKeyOf.granted('straightSword', 'quickstep', 0);
    const byId = (id) => run.deck.find((c) => c.instanceId === id) || null;
    const dodge = reg.equipment.basicCardProfiles.find((p) => p.id === contentBundle.balance.equipment.unarmedProfiles.technique).baseCardId;

    // THE PLAN NAMES EXACTLY THE EXTRACTABLE MOUNTS. Two on the sword — its art
    // and its granted Quickstep, both tagged — and none of the run's strikes,
    // which carry no such tag today. That tag is the whole rule.
    const plan = extractionPlan(reg, run);
    eq(plan.candidates.map((c) => c.itemRef).join('|'), sword, 'only the sword lends anything extractable');
    eq(plan.candidates[0].mounts.map((m) => m.mountKey).sort().join('|'), [artKey, grantKey].sort().join('|'),
      'both of its tagged mounts, and nothing else');
    eq(plan.cost, 0, 'free, by the owner\'s word — and configurable, see below');
    assert(!run.deck.some((c) => c.equipmentRole === 'attack' && reg.cards.get(c.cardId).tags.includes('extractable')),
      'no strike carries the tag, so no strike is on offer');

    // EXTRACT THE ART. The item-owned instance leaves; a run-owned copy
    // arrives; the mount keeps its KEY and shows the Dodge Roll.
    const receipt = commitExtraction(reg, run, sword, artKey);
    eq(receipt.service, 'extract');
    eq(receipt.cardId, 'crimsonCleave');
    eq(receipt.fallbackCardId, dodge, 'the receipt says what the emptied mount now shows');
    const extracted = byId(receipt.instanceId);
    assert(extracted && !isItemOwned(extracted) && extracted.cardId === 'crimsonCleave', 'the run owns a Crimson Cleave now');
    eq(ownerItemRef(extracted), null, 'and no item owns it');
    const mountNow = byId(artKey);
    assert(mountNow && mountNow.cardId === dodge && isItemOwned(mountNow), `the art mount shows the fallback under the same key (${mountNow && mountNow.cardId})`);
    eq(run.deck.filter((c) => c.cardId === dodge).length, 1, 'one Dodge Roll, not one per hand');
    eq(run.itemMounts[sword][artKey].card, null, 'the run records the mount as emptied');
    eq(run.itemMounts[sword][artKey].extractions, 1, 'and counts the extraction');

    // UNEQUIP: the fallback leaves with the sword; the extracted card stays.
    run.loadout.sets.rightHand[0] = null;
    stampDeck(reg, run);
    eq(byId(artKey), null, 'the emptied mount leaves with its item');
    assert(byId(receipt.instanceId), 'what was extracted is the run\'s and stays');
    // The carried sword is still on the plan — a smith works on what you
    // carry, not only what you wear (the Smith upgrade grid learned this in #528).
    run.loadout.storage = [...(run.loadout.storage || []), 'straightSword'];
    const carried = extractionPlan(reg, run).candidates.find((c) => c.itemRef === sword);
    assert(carried && carried.equipped === false && carried.mounts.some((m) => m.mountKey === grantKey),
      'a carried, unequipped sword still offers its granted Quickstep');
    run.loadout.storage = run.loadout.storage.filter((id) => id !== 'straightSword');
    run.loadout.sets.rightHand[0] = 'straightSword';
    stampDeck(reg, run);
    assert(byId(artKey) && byId(artKey).cardId === dodge, 're-equipping brings the fallback back');

    // INSTALL IT BACK. The run-owned instance leaves the deck; the mount
    // holds Crimson Cleave again under the same key.
    const open = installPlan(reg, run);
    const target = open.candidates.find((c) => c.itemRef === sword);
    assert(target && target.mounts.some((m) => m.mountKey === artKey && m.state === 'fallback'), 'the emptied mount is open for install');
    assert(target.mounts.find((m) => m.mountKey === artKey).cards.some((c) => c.instanceId === receipt.instanceId),
      'and the extracted Crimson Cleave is a card it would take');
    const seated = commitInstall(reg, run, sword, artKey, receipt.instanceId);
    eq(seated.service, 'install');
    eq(seated.replacedFallbackCardId, dodge, 'the receipt names the fallback it displaced');
    eq(byId(receipt.instanceId), null, 'the run-owned copy is gone');
    assert(byId(artKey) && byId(artKey).cardId === 'crimsonCleave' && isItemOwned(byId(artKey)), 'the sword owns its art again');
    eq(run.itemMounts[sword][artKey].card, 'crimsonCleave');

    // A DIFFERENT CARD IN THE SAME MOUNT: extract the art, extract the
    // Quickstep, seat the Quickstep where the art was.
    commitExtraction(reg, run, sword, artKey);
    const quick = commitExtraction(reg, run, sword, grantKey);
    commitInstall(reg, run, sword, artKey, quick.instanceId);
    assert(byId(artKey) && byId(artKey).cardId === 'quickstep', 'the art mount now holds a Quickstep');
    eq(byId(grantKey), null, 'the granted mount is empty and shows nothing — its kind has no fallback');
    eq(mountRows(reg, run, { itemRef: sword, piece: reg.equipment.armaments.find((a) => a.id === 'straightSword') })
      .find((m) => m.mountKey === grantKey).state, 'empty');

    // SAVED AND LOADED, whole. The mounts, the counter, the receipt.
    const loaded = deserializeRun(serializeRun(run));
    eq(validateRunShape(loaded).length, 0, 'the run shape validates with mounts recorded');
    eq(JSON.stringify(loaded.itemMounts), JSON.stringify(run.itemMounts), 'mounts survive a save');
    eq(loaded.mountTransactions, run.mountTransactions);
    stampDeck(reg, loaded);
    eq(loaded.deck.map((c) => `${c.instanceId}=${c.cardId}`).sort().join('|'), run.deck.map((c) => `${c.instanceId}=${c.cardId}`).sort().join('|'),
      'and a restamp after load composes the same deck');

    // PRICED, when balance says so. Three Stones, purse empty: refused by
    // name; `free` (an event granting the service) goes through.
    const pricedReg = createRegistries(fixture((b) => { b.balance.smithing.services.extract.cost = 3; }));
    const poor = createRunState({ seed: 21, classId: 'reaver', registries: pricedReg });
    const pricedPlan = extractionPlan(pricedReg, poor);
    eq(pricedPlan.cost, 3);
    assert(pricedPlan.candidates[0].affordable === false && pricedPlan.candidates[0].shortfall === 3, 'the plan says what is short');
    let said = '';
    try { commitExtraction(pricedReg, poor, sword, artKey); } catch (e) { said = e.message; }
    assert(/Insufficient Smithing Stones \(shortfall 3\)/.test(said), `refused by name — ${said}`);
    poor.smithingStones = 3;
    const paid = commitExtraction(pricedReg, poor, sword, artKey);
    eq(paid.spent, 3);
    eq(poor.smithingStones, 0, 'the purse paid');

    // EXTRA MOUNTS behind the flag (the rune seam). Off: no open mount. On:
    // one open mount per item, seated and emptied under a `mount:` key.
    assert(!installPlan(reg, run).candidates.some((c) => c.mounts.some((m) => m.state === 'open')), 'the flag is off, so nothing is open');
    const runeReg = createRegistries(fixture((b) => { b.balance.equipment.cardMounts.extraMounts = { enabled: true, perItem: 1, kind: 'granted' }; }));
    const runeRun = createRunState({ seed: 21, classId: 'reaver', registries: runeReg });
    const lifted = commitExtraction(runeReg, runeRun, sword, grantKey);
    const extraKey = mountKeyOf.extra(sword, 0);
    const openMount = installPlan(runeReg, runeRun).candidates.find((c) => c.itemRef === sword).mounts.find((m) => m.mountKey === extraKey);
    assert(openMount && openMount.state === 'open' && openMount.extra, 'the flag opens one extra mount on the sword');
    commitInstall(runeReg, runeRun, sword, extraKey, lifted.instanceId);
    const extraInst = runeRun.deck.find((c) => c.instanceId === extraKey);
    assert(extraInst && extraInst.cardId === 'quickstep' && extraInst.equipmentRole === 'granted' && ownerItemRef(extraInst) === sword,
      'the extra mount is an item-owned granted instance');
    assert(!installPlan(runeReg, runeRun).candidates.some((c) => c.itemRef === sword && c.mounts.some((m) => m.mountKey === extraKey)),
      'and with perItem 1 there is no second one');
    commitExtraction(runeReg, runeRun, sword, extraKey);
    assert(!(runeRun.itemMounts[sword] || {})[extraKey], 'emptying an extra mount deletes it, which is what makes it open again');

    // WHO OFFERS WHAT is a table. The Shrine promises (no roll consumed); the
    // merchant rolls on the smith's own stream; an unnamed kind offers nothing.
    const draws = [];
    const rng = { chance: (stream, pct) => { draws.push(`${stream}:${pct}`); return true; } };
    eq(smithServicesAt(reg, 'shrine', rng).services.join('|'), 'upgrade|extract|install');
    eq(draws.length, 0, 'a promise consumes no roll');
    const merchant = smithServicesAt(reg, 'merchant', rng);
    eq(draws.join('|'), 'smith:25', 'the merchant rolls once, on the smith stream, at the authored chance');
    assert(merchant.offered && merchant.rolled, 'and this visit keeps a smith');
    eq(smithServicesAt(reg, 'monster', rng).offered, false);

    // THE DOOR REFUSES BY NAME: an extractable tag nobody registered, a
    // fallback profile balance does not author, a chance over 100, a service
    // the smith does not do.
    const refused = (tweak) => { const v = validateContent(fixture(tweak)); return v.ok ? '' : v.errors.map((e) => `${e.path}: ${e.msg}`).join(' | '); };
    assert(/cardMounts\.extractableTag: names unknown tag 'liftable'/.test(refused((b) => { b.balance.equipment.cardMounts.extractableTag = 'liftable'; })), 'unknown extractable tag');
    assert(/kinds\.weaponArt\.fallback: names unarmed profile role 'stance'/.test(refused((b) => { b.balance.equipment.cardMounts.kinds.weaponArt.fallback = { unarmedProfile: 'stance' }; })), 'unauthored fallback profile');
    assert(/offeredAt\.merchant\.chance must be 0\.\.100/.test(refused((b) => { b.balance.smithing.services.offeredAt.merchant.chance = 150; })), 'chance over 100');
    assert(/names unknown service 'reforge'/.test(refused((b) => { b.balance.smithing.services.offeredAt.shrine.services.push('reforge'); })), 'unknown service');
    eq(refused(), '', 'and the fixture itself is clean');
  });

  // ---- 26x. the mounts travel: through the swap door and the save door ----
  test('26x. an extracted art stays extracted through a mid-fight swap and a saved fight', () => {
    // Both doors build a synthetic run with no deck; both used to build it
    // with no mounts. Driven end to end here — the real dispatch, the real
    // save manager — rather than by calling the reconcile with a hand-made
    // run, because that is exactly the kind of proof that let the birth
    // quota go undelivered for four rounds.
    const b = JSON.parse(JSON.stringify(contentBundle));
    b.equipment.armaments = b.equipment.armaments.map((piece) => (piece.id === 'straightSword'
      ? { ...piece, weaponCardPackage: { compatibility: 'attack-v1', fillerAttackProfileId: 'bladeAttack', weaponArtDefaults: ['crimsonCleave'] } }
      : piece));
    b.tagging.push({ family: 'card', scope: '', objectId: 'crimsonCleave', tagId: 'extractable' });
    b.scripts = contentBundle.scripts;
    const reg = createRegistries(b);
    const run = createRunState({ seed: 23, classId: 'reaver', registries: reg });
    const sword = 'armament/straightSword';
    const artKey = mountKeyOf.weaponArt('straightSword', 'crimsonCleave');
    const dodge = reg.equipment.basicCardProfiles.find((p) => p.id === contentBundle.balance.equipment.unarmedProfiles.technique).baseCardId;
    run.loadout.sets.rightHand[1] = 'dagger'; // a second set to swap to, mid-fight
    stampDeck(reg, run);
    const lifted = commitExtraction(reg, run, sword, artKey);
    const cleaves = (cards) => cards.filter((c) => c && c.cardId === 'crimsonCleave');
    const allPiles = (combat) => [combat.piles.hand, combat.piles.draw, combat.piles.discard, combat.piles.exhaust].flat();

    const player = () => ({
      classId: run.class, attributes: run.attributes, maxHp: run.maxHp, hp: run.hp,
      maxMana: run.maxMana, mana: run.mana, maxStamina: run.maxStamina, stamina: run.stamina,
      energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, damageBySchoolAdd: run.damageBySchoolAdd,
      equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot,
      equipmentAttackSlotCount: run.equipmentAttackSlotCount,
      equipmentPoolDeficits: run.equipmentPoolDeficits, itemUpgradeLevels: run.itemUpgradeLevels,
      itemMounts: run.itemMounts,
      deck: run.deck, relicIds: run.relics, flasks: run.flasks, flaskCharges: run.flaskCharges,
      loadout: run.loadout,
    });
    const combat = createCombat({ registries: reg, rng: createRng(23), enemyIds: [contentBundle.enemies[0].id], player: player() });
    eq(JSON.stringify(combat.itemMounts), JSON.stringify(run.itemMounts), 'combat carries the mounts, like the quota beside them');
    eq(cleaves(allPiles(combat)).length, 1, 'the fight opens with one Crimson Cleave — the run\'s own');

    // SWAP TO THE DAGGER AND BACK. The sword's art mount comes back as the
    // Dodge Roll, not as a second Crimson Cleave.
    dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
    eq(cleaves(allPiles(combat)).length, 1, 'swapping the sword out leaves the extracted card where it is');
    assert(!allPiles(combat).some((c) => c.instanceId === artKey), 'and the sword\'s mount left with the sword');
    combat.player.energy = combat.player.energyMax; // the swap is priced; pay for the second one
    dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 0 });
    const mountBack = allPiles(combat).find((c) => c.instanceId === artKey);
    assert(mountBack && mountBack.cardId === dodge, `swapping the sword back seats the fallback in its mount, not the extracted art (${mountBack && mountBack.cardId})`);
    eq(cleaves(allPiles(combat)).length, 1, 'still exactly one Crimson Cleave, and it is the run\'s');
    eq(cleaves(allPiles(combat))[0].instanceId, lifted.instanceId);

    // SAVE THE FIGHT, LOAD IT. The migration door rebuilds its own synthetic
    // run; with the mounts on the snapshot the loaded piles say the same.
    run.combatEntered = { nodeId: 'n1', encounterId: 'e1', snapshot: serializeCombatSnapshot(combat) };
    assert(run.combatEntered.snapshot.itemMounts && run.combatEntered.snapshot.itemMounts[sword], 'the snapshot carries the mounts');
    const storage = createMemoryStorage();
    const saves = createSaveManager(storage);
    storage.setItem(RUN_KEY, serializeRun(run));
    const loaded = saves.loadRun(reg);
    assert(loaded, `the save loads — ${saves.runStatus().reason || ''}`);
    const loadedPiles = ['hand', 'draw', 'discard', 'exhaust'].flatMap((p) => loaded.combatEntered.snapshot.piles[p]);
    eq(cleaves(loadedPiles).length, 1, 'one Crimson Cleave after the load');
    const loadedMount = loadedPiles.find((c) => c.instanceId === artKey);
    assert(loadedMount && loadedMount.cardId === dodge, 'the mount still shows the Dodge Roll in the resumed fight');
    eq(JSON.stringify(loaded.itemMounts), JSON.stringify(run.itemMounts), 'and the run\'s record of the mounts came through whole');

    // A FIGHT SAVED BEFORE MOUNTS EXISTED reads the run's record at the door,
    // and the door does not write it back into the stored snapshot.
    const legacy = JSON.parse(serializeRun(run));
    delete legacy.combatEntered.snapshot.itemMounts;
    const storage2 = createMemoryStorage();
    const saves2 = createSaveManager(storage2);
    storage2.setItem(RUN_KEY, JSON.stringify(legacy));
    const loaded2 = saves2.loadRun(reg);
    assert(loaded2, `the legacy fight loads — ${saves2.runStatus().reason || ''}`);
    const legacyPiles = ['hand', 'draw', 'discard', 'exhaust'].flatMap((p) => loaded2.combatEntered.snapshot.piles[p]);
    assert(legacyPiles.find((c) => c.instanceId === artKey)?.cardId === dodge, 'the run\'s mounts stand in for the snapshot\'s');
    eq(loaded2.combatEntered.snapshot.itemMounts, undefined, 'and the snapshot is not rewritten to carry them');
  });

  // ---- 27. armaments + armour sets (CSV-authored) --------------------------
  test('27. weapons and armour sets validate against the tag registry', () => {
    const tagIds = TAGS.map((t) => t.id);
    const classIds = REG.classes.all().map((c) => c.id);
    const KINDS = ['weapon', 'shield', 'staff'];
    const HANDS = ['right', 'left', 'either'];
    const RARITY = ['common', 'uncommon', 'rare'];
    // Modifier ops are a closed vocabulary — a typo like 'strike.dmg' would
    // otherwise sit in the CSV doing nothing until someone noticed in play.
    const TARGETS = ['strike', 'defend', 'power', 'self'];

    const ids = weapons.map((w) => w.id);
    eq(ids.length, new Set(ids).size, 'armament ids are unique');
    eq(weapons.filter((w) => w.kind === 'weapon').length, 9, 'nine weapons');
    eq(weapons.filter((w) => w.kind === 'shield').length, 8, 'eight shields/offhands');
    eq(weapons.filter((w) => w.kind === 'staff').length, 8, 'eight staves');

    const checkMods = (mods, where) => {
      if (mods === '') return;
      for (const m of (Array.isArray(mods) ? mods : [mods])) {
        const [lhs] = String(m).split('=');
        const [target, field] = lhs.split('.');
        assert(TARGETS.includes(target), `${where}: '${m}' targets a known card (${target})`);
        assert(field && field.length > 0, `${where}: '${m}' names a field`);
      }
    };
    const checkTags = (tags, where) => {
      for (const t of (tags === '' ? [] : Array.isArray(tags) ? tags : [tags])) {
        assert(tagIds.includes(t), `${where}: tag '${t}' is registered`);
      }
    };
    const checkItemTypes = (tags, where) => {
      const values = (tags === '' ? [] : Array.isArray(tags) ? tags : [tags]);
      const itemTypes = values.filter((tag) => tag.startsWith('item:'));
      assert(itemTypes.length > 0, `${where}: at least one authored item:* type tag`);
      checkTags(values.filter((tag) => !tag.startsWith('item:')), where);
    };

    for (const w of weapons) {
      assert(KINDS.includes(w.kind), `${w.id}: known kind`);
      assert(HANDS.includes(w.hand), `${w.id}: known hand (${w.hand})`);
      assert(RARITY.includes(w.rarity), `${w.id}: known rarity (${w.rarity})`);
      assert(/^[0-9A-Fa-f]{6}$/.test(w.metal), `${w.id}: metal is a 6-digit hex`);
      assert(/^[0-9A-Fa-f]{6}$/.test(w.accent), `${w.id}: accent is a 6-digit hex`);
      assert(String(w.geom).length > 0, `${w.id}: names a geometry archetype`);
      checkItemTypes(tagIdsOf('armament', w), w.id);
      checkMods(w.mods, w.id);
      eq(w.hand, 'either', `${w.id}: every armament is side-neutral; its slot records the equipped hand`);
    }

    // Armour: four sets per class, exactly one of them unlocked from the start.
    for (const id of classIds) {
      const mine = outfits.filter((o) => o.classId === id);
      eq(mine.length, 4, `class '${id}' has four armour sets`);
      eq(mine.filter((o) => o.unlock === '').length, 1, `class '${id}' has exactly one starting set`);
    }
    for (const o of outfits) {
      checkItemTypes(tagIdsOf('armour', o), `${o.classId}/${o.id}`);
      checkMods(o.mods, o.id);
    }
  });

  // ---- 28. equipment: pieces rewrite the cards you already have ------------
  test('28. armaments rewrite Strike/Defend, cost energy to swap, and survive a save', () => {
    // The load-bearing claim of the whole system: equipment adds no cards and
    // no engine code. It changes numbers on the starters, through one closed
    // vocabulary (equipMods.csv) that a typo cannot slip past.
    eq(validateEquipment(REG).join('; '), '', 'every authored piece parses against the vocabulary');

    const intrinsicReceipts = REG.equipment.armaments.map(armamentIntrinsicReceipt);
    eq(intrinsicReceipts.length, 25, 'all 25 armaments expose an intrinsic stat receipt');
    assert(intrinsicReceipts.every((row) => ['attackRating', 'defenseRating', 'weight', 'weaponArtManaCost', 'uniqueSkillStaminaCost']
      .every((field) => Number.isInteger(row[field]) && row[field] >= 0)),
    'each intrinsic receipt exposes five explicit non-negative integer facts');
    assert(REG.equipment.armaments.every((piece) => piece.weight === piece.poiseThreshold),
      'presentation weight is the already-authored Poise threshold and adds no balance behavior');
    assert(REG.equipment.armaments.every((piece) => piece.weaponArtManaCost === (
      piece.itemTypeTags.includes('item:magic-focus') && piece.techniqueProfile === 'staffTechnique' ? 1 : 0
    )), 'only magic-focus staff-technique armaments author one Weapon Art Mana');
    assert(REG.equipment.armaments.every((piece) => piece.uniqueSkillStaminaCost === 0),
      'Unique Skill Stamina remains explicit zero until a priority or unique-skill consumer exists');
    eq(JSON.stringify(armamentIntrinsicReceipt(REG.equipment.armaments.find((piece) => piece.id === 'greatsword'))),
      JSON.stringify({ itemId: 'greatsword', attackRating: 9, defenseRating: 2, weight: 8, weaponArtManaCost: 0, uniqueSkillStaminaCost: 0 }),
      'the Greatsword receipt is intrinsic and does not include generated-card or Smithing deltas');

    const missingIntrinsicBundle = {
      ...contentBundle,
      equipment: {
        ...contentBundle.equipment,
        armaments: contentBundle.equipment.armaments.map((piece) => ({ ...piece })),
      },
    };
    delete missingIntrinsicBundle.equipment.armaments[0].attackRating;
    assert(validateContent(missingIntrinsicBundle).errors.some((error) => error.path.endsWith('.attackRating')),
      'boot validation fails closed when an intrinsic armament field is absent');
    const mismatchedIntrinsicRegistries = {
      ...REG,
      equipment: {
        ...REG.equipment,
        armaments: REG.equipment.armaments.map((piece) => (
          piece.id === 'straightSword' ? { ...piece, weaponArtManaCost: 1 } : piece
        )),
      },
    };
    assert(validateEquipment(mismatchedIntrinsicRegistries).some((problem) => /straightSword: weaponArtManaCost/.test(problem)),
      'registry validation rejects a Weapon Art cost that contradicts the authored type/profile contract');

    const bal = REG.balance.equipment;
    const strikeOf = (mods) => resolveCard(REG, { cardId: 'strike', mods });
    const dmgOf = (def) => (def.effects.find((e) => e.op === 'damage') || {}).amount;

    eq(dmgOf(strikeOf([])), 6, 'a bare Strike is still 6');

    // A dagger trades weight for repetition; a greatsword does the reverse.
    const dagger = strikeOf(['damage=3', 'hits=2']);
    eq(dmgOf(dagger), 3, 'dagger: Strike drops to 3');
    eq(dagger.effects.find((e) => e.op === 'damage').hits, 2, 'dagger: Strike lands twice');
    assert(dagger.textTemplate.includes('{hits}'), 'dagger: the rules text learns to mention hits');

    const great = strikeOf(['damage=+4', 'cost=+1', 'poise=+3']);
    eq(dmgOf(great), 10, 'greatsword: Strike climbs to 10');
    eq(great.cost, 2, 'greatsword: Strike costs more');
    eq((great.effects.find((e) => e.op === 'poiseDamage') || {}).amount, 3, 'greatsword: Poise damage appended');
    assert(great.textTemplate.includes('{poiseDamage}'), 'greatsword: the new Poise line is spoken');

    // Order matters and is slot order: a later '=N' replaces, it does not stack.
    eq(dmgOf(strikeOf(['damage=+4', 'damage=3'])), 3, 'a set value overrides an earlier adjustment');
    // Floors hold, so no piece can author a card into nonsense.
    eq(dmgOf(strikeOf(['damage=-99'])), bal.limits.minDamage, 'damage cannot go below its floor');
    eq(strikeOf(['cost=-99']).cost, bal.limits.minCost, 'cost cannot go below its floor');
    eq(strikeOf(['hits=+99']).effects[0].hits, bal.limits.maxHits, 'hits are capped');

    // Mods layer ON TOP of an upgrade rather than fighting with it.
    eq(dmgOf(resolveCard(REG, { cardId: 'strike', upgraded: true })), 9, 'Strike+ is 9 bare-handed');
    eq(dmgOf(resolveCard(REG, { cardId: 'strike', upgraded: true, mods: ['damage=+4'] })), 13, 'Strike+ with a greatsword is 13');

    // A run starts stamped by whatever it starts wearing, and `self.*` mods
    // reach the run rather than a card.
    const run = createRunState({ seed: 7, classId: 'reaver', registries: REG });
    assert(run.loadout && run.loadout.sets.rightHand.length === 3, 'the right hand carries three sets');
    eq(run.loadout.sets.armor[0], 'default', 'the reaver starts in its one unlocked set');

    equipPiece(REG, run.loadout, 'rightHand', 0, 'dagger', OWNS_EVERYTHING, AT_CAMP);
    equipPiece(REG, run.loadout, 'rightHand', 1, 'greatsword', OWNS_EVERYTHING, AT_CAMP);
    equipPiece(REG, run.loadout, 'armor', 0, 'oathsworn', OWNS_EVERYTHING, AT_CAMP);
    stampDeck(REG, run);
    const aStrike = run.deck.find((c) => c.cardId === 'strike');
    eq(dmgOf(resolveCard(REG, aStrike)), 7, 'the deck itself is stamped with the tuned STR strike receipt');
    eq(runMods(REG, run.loadout, 'reaver').startStatuses[0].status, 'strength', 'the Oathsworn set grants Strength');
    assert(loadoutTags(REG, run.loadout, 'reaver').includes('blade'), 'worn pieces contribute their tags');

    // Swapping mid-fight: the price is paid, and the hand is re-armed.
    const rng = createRng(11);
    const combat = createCombat({
      registries: REG,
      rng,
      player: { classId: 'reaver', attributes: run.attributes, maxHp: run.maxHp, hp: run.hp, energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, deck: run.deck, relicIds: [], loadout: run.loadout },
      enemyIds: ['fellWarden'],
    });
    const energyBefore = combat.player.energy;
    dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
    eq(combat.player.energy, energyBefore - bal.swapCost, 'the swap costs what the config says');
    const inHand = combat.piles.hand.concat(combat.piles.draw).find((c) => c.cardId === 'strike');
    eq(dmgOf(resolveCard(REG, inHand)), 12, 'every Strike now carries the greatsword profile, rarity, tier, and explicit mod');

    // Re-arming a position in combat uses the same priced action economy, but
    // it can replace/move/unequip the item rather than only select a prepared
    // set. The engine owns the mutation and immediately re-stamps live piles.
    combat.player.energy = combat.player.energyMax;
    const rearmed = dispatch(combat, {
      type: 'changeEquipment', slotId: 'rightHand', setIndex: 1, pieceId: 'dagger',
    });
    eq(combat.player.energy, combat.player.energyMax - bal.swapCost,
      'changing an equipped item pays the configured combat equipment cost');
    eq(combat.loadout.sets.rightHand[1], 'dagger', 'the active combat position now holds the chosen item');
    eq(combat.loadout.sets.rightHand[0], null, 'moving the dagger clears its previous position');
    assert(combat.loadout.storage.includes('greatsword'), 'the replaced greatsword returns to carried storage');
    const daggerStrike = combat.piles.hand.concat(combat.piles.draw).find((c) => c.cardId === 'strike');
    eq(dmgOf(resolveCard(REG, daggerStrike)), 5, 'live Strikes immediately use the newly equipped dagger profile');
    assert(rearmed.events.some((event) => event.type === 'equipmentRearmed' && event.pieceId === 'dagger'),
      'the combat receipt names the item that was equipped');

    combat.player.energy = combat.player.energyMax;
    const poiseBeforeArmour = combat.player.poiseMeter.max;
    const armourChanged = dispatch(combat, {
      type: 'changeEquipment', slotId: 'armor', setIndex: 0, pieceId: 'default',
    });
    eq(combat.loadout.sets.armor[0], 'default', 'armour can also be changed during the player turn');
    eq(combat.player.poiseMeter.max, playerPoiseThresholdReceipt(REG, {
      loadout: combat.loadout, relics: combat.player.relicIds, class: combat.player.classId,
      itemUpgradeLevels: combat.itemUpgradeLevels,
    }).value, 'changing armour immediately stamps the exact live Poise threshold');
    assert(combat.player.poiseMeter.max !== poiseBeforeArmour,
      'changing from Oathsworn armour to Wayfarer Plate visibly changes the Poise vessel');
    assert(armourChanged.events.some((event) => event.type === 'equipmentChanged'),
      'the armour mutation emits the canonical equipment-change receipt');

    combat.player.energy = combat.player.energyMax;
    const unequipped = dispatch(combat, {
      type: 'changeEquipment', slotId: 'rightHand', setIndex: 1, pieceId: null,
    });
    eq(combat.player.energy, combat.player.energyMax - bal.swapCost,
      'unequipping an active combat item pays the same configured action price');
    eq(combat.loadout.sets.rightHand[1], null, 'the requested combat position is empty after unequip');
    assert(combat.loadout.storage.includes('dagger'), 'the unequipped dagger returns to carried storage');
    const bareStrike = combat.piles.hand.concat(combat.piles.draw).find((c) => c.cardId === 'strike');
    eq(dmgOf(resolveCard(REG, bareStrike)), 4,
      'live Strikes are re-stamped to the run\'s tuned unarmed profile after unequip');
    assert(unequipped.events.some((event) => event.type === 'equipmentChanged'
      && event.changedPositions.some((position) => position.slotId === 'rightHand'
        && position.setIndex === 1 && position.beforeItemId === 'dagger' && position.afterItemId === null)),
    'the canonical receipt identifies the paid active-position unequip');
    assert(unequipped.events.some((event) => event.type === 'equipmentRearmed'
      && event.slotId === 'rightHand' && event.setIndex === 1 && event.pieceId === null),
    'the combat receipt preserves null as the explicit unequip target');

    combat.player.energy = 0;
    const beforeUnpaid = JSON.stringify(combat.loadout);
    let unpaid = '';
    try {
      dispatch(combat, { type: 'changeEquipment', slotId: 'rightHand', setIndex: 1, pieceId: 'straightSword' });
    } catch (error) {
      unpaid = error.message;
    }
    assert(/costs \d+ Energy/.test(unpaid), `an unpaid combat equipment change names its Energy price — got: ${unpaid}`);
    eq(JSON.stringify(combat.loadout), beforeUnpaid, 'an unpaid combat equipment change leaves the loadout atomic');
    eq(combat.player.energy, 0, 'an unpaid combat equipment change spends nothing');
    combat.player.energy = combat.player.energyMax;

    // Armour items can change, but armour has no prepared-set cycle in combat.
    let refused = '';
    try {
      dispatch(combat, { type: 'swapArmament', slotId: 'armor', setIndex: 0 });
    } catch (e) {
      refused = e.message;
    }
    // ASSERTED AGAINST THE VERDICT, NOT AGAINST THE PROSE (Sunna, #98; the
    // identity is Vira's, #104). This line read
    // `refused.includes('outside combat')` — a substring of canSwap's reason,
    // typed here. So the player-facing wording had a second home in a test that
    // does not care about wording, and rewording the refusal turned this red
    // while the rule it names was untouched. A test that fails when a sentence
    // improves is a test that argues for bad sentences.
    //
    // MY FIRST REPLACEMENT WAS TWO INDEPENDENT FACTS AND VIRA MEASURED THE GAP.
    // `assert(refused)` plus `canSwap(...).ok === false` never established the
    // LINK between them: `doSwapArmament` throws for five other reasons (phase,
    // equipment disabled, no loadout, no swaps/energy left, no such set), and any
    // of them makes both true. She planted `'No swaps left this turn'` ABOVE the
    // canSwap gate — so the rule never runs — and my pair passed 58/0 while the
    // old prose substring caught it 57/1. A counted refusal is not a located one.
    //
    // THE IDENTITY IS THE LINK: the message the dispatch threw IS the string the
    // model returns, compared against the model's own return rather than a
    // literal typed here. The string keeps its single home in `canSwap`, so the
    // wording stays free to improve, and no other throw site can wear this
    // refusal's name. Under her plant: 57/1, caught. Reworded `fastened` →
    // `buckled down`: 58/0.
    eq(refused, canSwap(REG, 'armor', { inCombat: true }).reason,
      'armour is refused mid-fight, in the words the model itself refuses in');
    // AND THE FLOOR UNDER IT, which the identity alone does not carry: if canSwap
    // ever stopped refusing, `reason` would be '' and the dispatch would not
    // throw, so `'' === ''` would pass over a rule that had been deleted. An
    // empty result is not a pass — this is the denominator, and it is measured,
    // not argued. Planted the rule out of `canSwap` AND the price gate out of
    // `doSwapArmament`, so the armour swap actually succeeds: with this line,
    // 56/2 and 28 names it; without it, 28 PASSES on '' === '' and only 31d goes
    // red. The deletion does not escape the SUITE — it escapes the one test whose
    // whole subject is that armour is refused mid-fight, which is the same defect
    // Vira just caught in my pair, reporting on something it never observed.
    eq(canSwap(REG, 'armor', { inCombat: true }).ok, false,
      '…and the refusal exists at all, so the identity is not two empty strings');

    // Combat works on COPIES of the deck instances, so the orchestrator
    // re-stamps the run's own copies when the fight ends (main.js onCombatEnd).
    stampDeck(REG, run);

    // The instance carries the numbers, so the save carries them too.
    const storage = createMemoryStorage();
    const saves = createSaveManager(storage);
    saves.saveRun(run, rng);
    const loaded = saves.loadRun(REG);
    eq(loaded.loadout.sets.rightHand[1], null, 'the combat unequip round-trips');
    assert(loaded.loadout.storage.includes('dagger'), 'the unequipped item round-trips in carried storage');
    eq(dmgOf(resolveCard(REG, loaded.deck.find((c) => c.cardId === 'strike'))), 4,
      'the saved deck round-trips with the live unarmed profile');

    // And a run saved before equipment existed is healed, not refused.
    const legacy = JSON.parse(JSON.stringify(run));
    delete legacy.loadout;
    for (const c of legacy.deck) delete c.mods;
    storage.setItem(RUN_KEY, JSON.stringify(legacy));
    const healed = saves.loadRun(REG);
    assert(healed && healed.loadout, 'a pre-equipment save loads with a fresh loadout');
    eq(healed.loadout.sets.rightHand[0], 'straightSword', 'the healed loadout restores the class-authored starting weapon');
  });

  test('28s. equipment authors HP, Mana, and Stamina pools without healing saves or swaps', () => {
    for (const [id, mod] of [
      ['towerShield', 'self.maxHp=+10'],
      ['blightRod', 'self.maxMana=+1'],
      ['twinblade', 'self.maxStamina=+1'],
    ]) {
      assert(REG.equipment.armaments.find((piece) => piece.id === id)?.mods.includes(mod), `${id} authors ${mod} in generated content`);
    }
    const poolFields = {
      ...REG.equipment.modFields,
      maxMana: { field: 'maxMana', scope: 'run', apply: 'maxMana', label: 'Max Mana' },
      maxStamina: { field: 'maxStamina', scope: 'run', apply: 'maxStamina', label: 'Max Stamina' },
    };
    const probe = {
      id: 'poolProbe', name: 'Pool Probe', kind: 'weapon', hand: 'right', rarity: 'rare',
      mods: ['self.maxHp=+10', 'self.maxMana=+1', 'self.maxStamina=+1'], unlock: '', dropWeight: 1,
      ...TEST_ARMAMENT_INTRINSICS,
    };
    const POOL_REG = {
      ...REG,
      equipment: {
        ...REG.equipment,
        modFields: poolFields,
        armaments: [...REG.equipment.armaments, probe],
      },
    };
    eq(validateEquipment(POOL_REG).join('; '), '', 'all three pool applies are accepted by the closed vocabulary');

    const run = createRunState({ seed: 0x281, classId: 'reaver', registries: POOL_REG });
    const base = { hp: run.maxHp, mana: run.maxMana, stamina: run.maxStamina };
    run.hp -= 7;
    run.mana = Math.max(0, run.mana - 1);
    run.stamina = Math.max(0, run.stamina - 1);
    run.loadout.sets.rightHand[1] = probe.id;
    assert(cycleSet(POOL_REG, run.loadout, 'rightHand', 1, { meta: {}, inCombat: false }), 'the probe set becomes active');
    stampDeck(POOL_REG, run);
    eq(JSON.stringify(runMods(POOL_REG, run.loadout, run.class)), JSON.stringify({
      maxHp: 10, maxMana: 1, maxStamina: 1, swapCostDelta: 0, startStatuses: [],
    }), 'runMods exposes every authored pool bonus');
    eq(run.maxHp, base.hp + 10, 'camp equip adds 10 maximum HP');
    eq(run.maxHp - run.hp, 7, 'camp equip carries the absolute HP deficit');
    eq(run.maxMana, base.mana + 1, 'camp equip adds 1 maximum Mana');
    eq(run.maxMana - run.mana, 1, 'camp equip carries the absolute Mana deficit');
    eq(run.maxStamina, base.stamina + 1, 'camp equip adds 1 maximum Stamina');
    eq(run.maxStamina - run.stamina, 1, 'camp equip carries the absolute Stamina deficit');

    const shown = equipmentSurfaceReceipt(POOL_REG, run, {
      candidate: { slotId: 'rightHand', setIndex: 0, pieceId: 'straightSword' },
    }).candidate.resourceChanges;
    for (const [id, amount] of [['maxHp', 10], ['maxMana', 1], ['maxStamina', 1]]) {
      const row = shown.find((entry) => entry.id === id);
      assert(row && row.after === row.before - amount, `${id} candidate receipt reports its exact delta`);
    }

    cycleSet(POOL_REG, run.loadout, 'rightHand', 0, { meta: {}, inCombat: false });
    stampDeck(POOL_REG, run);
    const combat = createCombat({
      registries: POOL_REG, rng: createRng(0x282),
      player: {
        classId: run.class, attributes: run.attributes,
        maxHp: run.maxHp, hp: run.maxHp - 7,
        maxMana: run.maxMana, mana: Math.max(0, run.maxMana - 1),
        maxStamina: run.maxStamina, stamina: Math.max(0, run.maxStamina - 1),
        energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, deck: run.deck,
        relicIds: [], loadout: run.loadout, equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot,
        equipmentPoolDeficits: run.equipmentPoolDeficits,
      },
      enemyIds: ['fellWarden'],
    });
    dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
    eq(combat.player.maxHp, base.hp + 10, 'combat swap moves maximum HP');
    eq(combat.player.maxHp - combat.player.hp, 7, 'combat swap carries HP deficit');
    eq(combat.player.maxMana, base.mana + 1, 'combat swap moves maximum Mana');
    eq(combat.player.maxMana - combat.player.mana, 1, 'combat swap carries Mana deficit');
    eq(combat.player.maxStamina, base.stamina + 1, 'combat swap moves maximum Stamina');
    eq(combat.player.maxStamina - combat.player.stamina, 1, 'combat swap carries Stamina deficit');
    combat.player.mana = 0;
    combat.player.energy = REG.balance.equipment.swapCost;
    dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 0 });
    eq(combat.player.maxMana, base.mana, 'swapping away removes the Mana bonus');
    eq(combat.player.mana, 0, 'swapping away carries spent Mana beyond the smaller vessel');
    combat.player.energy = REG.balance.equipment.swapCost;
    dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
    eq(combat.player.mana, 0, 'swapping back cannot refill spent Mana');

    const deficitBeforeUnequip = {
      hp: combat.player.maxHp - combat.player.hp,
      mana: combat.player.maxMana - combat.player.mana,
      stamina: combat.player.maxStamina - combat.player.stamina,
    };
    combat.player.energy = REG.balance.equipment.swapCost;
    const poolUnequipped = dispatch(combat, {
      type: 'changeEquipment', slotId: 'rightHand', setIndex: 1, pieceId: null,
    });
    eq(combat.player.energy, 0, 'the direct pool-item unequip charges its exact combat price');
    eq(combat.loadout.sets.rightHand[1], null, 'the pool probe leaves its active position');
    assert(combat.loadout.storage.includes(probe.id), 'the unequipped pool probe remains carried in storage');
    eq(combat.player.maxHp, base.hp, 'direct combat unequip removes the maximum HP bonus');
    eq(combat.player.maxHp - combat.player.hp, deficitBeforeUnequip.hp,
      'direct combat unequip preserves the absolute HP deficit');
    eq(combat.player.maxMana, base.mana, 'direct combat unequip removes the maximum Mana bonus');
    eq(combat.player.mana, Math.max(0, base.mana - deficitBeforeUnequip.mana),
      'direct combat unequip preserves spent Mana beyond the smaller vessel');
    eq(combat.player.maxStamina, base.stamina, 'direct combat unequip removes the maximum Stamina bonus');
    eq(combat.player.stamina, Math.max(0, base.stamina - deficitBeforeUnequip.stamina),
      'direct combat unequip preserves the absolute Stamina deficit');
    eq(JSON.stringify(combat.equipmentPoolDeficits), JSON.stringify(deficitBeforeUnequip),
      'the carried equipment deficits remain the single source for later re-equips');
    assert(poolUnequipped.events.some((event) => event.type === 'equipmentChanged'),
      'the pool unequip emits the canonical mutation receipt');
    assert(poolUnequipped.events.some((event) => event.type === 'equipmentRearmed'
      && event.pieceId === null && event.cost === REG.balance.equipment.swapCost),
    'the pool unequip emits a priced null-target combat receipt');

    const OLD_REG = {
      ...REG,
      equipment: {
        ...REG.equipment,
        armaments: [...REG.equipment.armaments, { ...probe, mods: [] }],
      },
    };
    const old = createRunState({ seed: 0x283, classId: 'reaver', registries: OLD_REG });
    old.loadout.sets.rightHand[0] = probe.id;
    stampDeck(OLD_REG, old);
    const oldNumbers = { maxHp: old.maxHp, hp: old.maxHp - 9, maxMana: old.maxMana, mana: 0, maxStamina: old.maxStamina, stamina: 0 };
    Object.assign(old, oldNumbers, { schemaVersion: 4 });
    delete old.equipmentPoolBonuses;
    delete old.equipmentPoolDeficits;
    const changed = POOL_REG;
    const storage = createMemoryStorage();
    storage.setItem(RUN_KEY, JSON.stringify(old));
    const loaded = createSaveManager(storage).loadRun(changed);
    assert(loaded, 'a schema-v4 equipped save survives the new live bonus');
    for (const [key, value] of Object.entries(oldNumbers)) eq(loaded[key], value, `${key} keeps its old-save number`);
    eq(JSON.stringify(loaded.equipmentPoolBonuses), JSON.stringify({ maxHp: 0, maxMana: 0, maxStamina: 0 }),
      'migration records the old equipment bonuses, not the changed CSV');
    loaded.loadout.sets.rightHand[0] = 'straightSword';
    stampDeck(changed, loaded);
    loaded.loadout.sets.rightHand[0] = probe.id;
    stampDeck(changed, loaded);
    eq(loaded.maxHp, oldNumbers.maxHp + 10, 'the next real equip mutation adopts the live bonus');
    eq(loaded.maxMana, oldNumbers.maxMana + 1, 'the next real equip mutation adopts live Mana');
    eq(loaded.maxStamina, oldNumbers.maxStamina + 1, 'the next real equip mutation adopts live Stamina');
  });

  // ---- 28p. the swap PRICE: three rules, three measured numbers -----------
  test('28p. his three swap prices are data, and they really are three different prices', () => {
    // Constantine, 2026-08-08: *"switching sets should cost actions. perhaps
    // this action costs more or less depending on Talisman or starting relic…
    // let's default to costing 2 actions. alternatively, or by a setting,
    // different weapon categories have weapon swap costs. THAT WAY I CAN TRY
    // EACH."*
    //
    // THE SUBJECT OF THIS TEST IS THE WORD "DIFFERENT". A settings key nothing
    // can be observed to change is not a knob, it is a comment, and "I can try
    // each" is a comparison — so this measures the same swap, on the same
    // loadout, under each rule, and asserts the numbers are not all equal.
    // Every price below is READ BACK OFF THE PLAYER'S ENERGY after a real
    // dispatch, never off the derivation that produced it.
    const rules = REG.balance.equipment.swapCostRules;
    const byId = (id) => rules.find((r) => r.id === id);
    eq(rules.map((r) => r.id).join(','), 'flat,gear,category', 'his three options are the authored rows');

    // A hand that is heavy in one set and quick in the other, so 'category' has
    // something to say and the two directions are both reachable.
    const armed = () => {
      const run = createRunState({ seed: 5, classId: 'reaver', registries: REG });
      run.loadout.sets.rightHand[0] = 'straightSword'; // no category tag → the default
      run.loadout.sets.rightHand[1] = 'greatsword';    // heavy   → 3
      run.loadout.sets.rightHand[2] = 'twinblade';     // flourish → 1
      return run;
    };

    /** Swap to `setIndex` under `rule` and report what the player actually paid. */
    const paid = (rule, setIndex, { relicIds = [] } = {}) => {
      const run = armed();
      const combat = createCombat({
        registries: REG,
        rng: createRng(11),
        player: { classId: 'reaver', attributes: run.attributes, maxHp: run.maxHp, hp: run.hp, energyMax: run.energyMax, drawPerTurn: run.drawPerTurn, deck: run.deck, relicIds, loadout: run.loadout },
        enemyIds: ['fellWarden'],
        swapCostRule: rule,
      });
      const before = combat.player.energy;
      const { events } = dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex });
      const swapped = events.find((e) => e.type === 'armamentSwapped');
      const spent = before - combat.player.energy;
      // The event must AGREE with the wallet, or one of the two is decoration.
      eq(swapped.cost, spent, `the event's cost is what the player actually paid (${swapped.cost} vs ${spent})`);
      return spent;
    };

    // ---- 1. THE MEASUREMENT, and the table it prints -----------------------
    //   rule       → greatsword (heavy)   twinblade (flourish)
    //   flat       → 2                    2
    //   category   → 3                    1
    const table = {
      'flat/heavy': paid(byId('flat'), 1),
      'flat/flourish': paid(byId('flat'), 2),
      'category/heavy': paid(byId('category'), 1),
      'category/flourish': paid(byId('category'), 2),
    };
    eq(table['flat/heavy'], 2, 'flat charges the balance default for a greatsword');
    eq(table['flat/flourish'], 2, '…and the same for a twinblade — that is what flat means');
    eq(table['category/heavy'], 3, 'category charges the heavy row for a greatsword');
    eq(table['category/flourish'], 1, '…and the flourish row for a twinblade');
    assert(new Set(Object.values(table)).size > 1,
      `the rules produce DIFFERENT prices, not one price wearing three names — ${JSON.stringify(table)}`);

    // A piece whose tags match no category row falls through to the default,
    // which is deliberate and is the third cell of the category rule.
    const straightUnder = swapCostFor(REG, {
      rule: byId('category'), loadout: armed().loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 0, relicDelta: 0,
    });
    eq(straightUnder.cost, REG.balance.equipment.swapCost, 'an uncategorised weapon falls through to the default');
    eq(straightUnder.categoryTag, null, '…and says so rather than inventing a category');

    // ---- 2. THE GEAR RUNG — the talisman half, with a piece it authors -----
    // The talisman slot ships with zero rows, so waiting for content would mean
    // shipping a rung nobody has watched work. This adds one armament carrying
    // `self.swapCost=+2` — a CSV row's worth of data, no code — and equips it.
    const withCharm = {
      ...REG,
      equipment: {
        ...REG.equipment,
        armaments: [...REG.equipment.armaments,
          { id: 'testCharm', name: 'Heavy Charm', kind: 'weapon', hand: 'right', rarity: 'common',
            mods: ['self.swapCost=+2'], unlock: '', ...TEST_ARMAMENT_INTRINSICS }],
      },
    };
    const charmRun = createRunState({ seed: 5, classId: 'reaver', registries: REG });
    charmRun.loadout.sets.rightHand[0] = 'testCharm';
    charmRun.loadout.sets.rightHand[1] = 'greatsword';
    eq(runMods(withCharm, charmRun.loadout, 'reaver').swapCostDelta, 2,
      'a worn piece contributes its swap-cost delta through the same self.* door every other run mod uses');
    const gearOn = swapCostFor(withCharm, { rule: byId('gear'), loadout: charmRun.loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1, relicDelta: 0 });
    const gearOff = swapCostFor(withCharm, { rule: byId('flat'), loadout: charmRun.loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1, relicDelta: 0 });
    eq(gearOn.cost, 4, 'the gear rule charges default 2 + the charm’s 2');
    eq(gearOff.cost, 2, '…and the flat rule charges 2, because gear is off for it');
    // THE IGNORED DELTA IS REPORTED, NOT SWALLOWED. A talisman doing nothing
    // under a gear-off rule is correct; a talisman doing nothing SILENTLY is
    // the graceful fallback my own card warns about.
    eq(gearOff.gearIgnored, 2, 'a rule that declines the gear rung says what it declined');
    eq(gearOn.gearIgnored, 0, '…and a rule that takes it has nothing left over');

    // The relic half is the same rung, summed by the engine (module boundary).
    const relicOn = swapCostFor(REG, { rule: byId('gear'), loadout: armed().loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1, relicDelta: -1 });
    eq(relicOn.cost, 1, 'a relic passive of -1 makes the swap cheaper — "more OR LESS", his words');
    const floored = swapCostFor(REG, { rule: byId('gear'), loadout: armed().loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1, relicDelta: -9 });
    eq(floored.cost, 0, 'the total floors at 0 rather than paying the player Energy');
    eq(floored.floored, true, '…and the clamp is visible, not quiet');

    // ---- 3. FAIL CLOSED — a missing relicDelta is named, never guessed -----
    const hush = console.error;
    const heard = [];
    console.error = (...a) => { heard.push(a.join(' ')); };
    let quiet;
    try {
      quiet = swapCostFor(REG, { rule: byId('gear'), loadout: armed().loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1 });
    } finally { console.error = hush; }
    eq(quiet.cost, 2, 'a caller that forgets the relic sum still gets a price…');
    eq(heard.length, 1, '…and is named for it rather than silently charged as "no relics"');
    assert(heard[0].includes('relicDelta') && heard[0].includes('rightHand'),
      `the complaint names what was missing and where — got: ${heard[0] || '(nothing)'}`);
  });

  // ---- 28q. a fourth rule is a ROW — Law 0's falsifier, on a rule ---------
  test('28q. a swap-cost rule this build has never seen works with zero code', () => {
    // Law 0's falsifier is *one fictional entry of a brand-new kind, plus its
    // asset, ZERO code commits — it appears and works.* Applied to A8: the two
    // fields of a rule row are closed, so their product is FOUR cells and only
    // three ship. This is the fourth, added the way he would add it — one row
    // in balance.js — and nothing else.
    //
    // AND IT IS THE #78 LESSON PAID BACK. I once declared two characteristics
    // closed separately and shipped three ids for a four-cell product; the
    // fourth cell was legal data that drew an empty screen and every check I
    // owned said green. So this test is not a nicety, it is the check that
    // would have caught me: the product is TOTAL or this goes red.
    const fourth = { id: 'both', label: 'Category + gear', base: 'category', gear: true };
    const REG4 = {
      ...REG,
      balance: {
        ...REG.balance,
        equipment: { ...REG.balance.equipment, swapCostRules: [...REG.balance.equipment.swapCostRules, fourth] },
      },
    };
    eq(validateEquipment(REG4).length, 0, 'the new row validates — it used only words the schema already had');

    const run = createRunState({ seed: 5, classId: 'reaver', registries: REG });
    run.loadout.sets.rightHand[0] = 'straightSword';
    run.loadout.sets.rightHand[1] = 'greatsword'; // heavy → base 3
    const price = swapCostFor(REG4, {
      rule: resolveSwapCostRule(REG4, { settings: { swapCostRule: 'both' } }),
      loadout: run.loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1, relicDelta: -1,
    });
    eq(price.ruleId, 'both', 'the settings value selects the row that was never in a build before');
    eq(price.base, 'category', '…it takes the category base…');
    eq(price.cost, 2, '…and the gear rung on top: heavy 3, relic −1, paid 2');

    // EVERY cell of the product computes a real number. Four ids, four prices,
    // no unrepresentable corner and no empty screen.
    const cells = [['default', false], ['default', true], ['category', false], ['category', true]]
      .map(([base, gear]) => swapCostFor(REG4, {
        rule: { id: `${base}/${gear}`, base, gear },
        loadout: run.loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1, relicDelta: 1,
      }).cost);
    eq(cells.join(','), '2,3,3,4', 'all four cells of the product price a swap: default/gear × off/on');

    // An unknown rule id is the SHIPPING DEFAULT, never a crash and never a
    // free swap — the same rule resolveMapMode uses for a hand-edited save.
    eq(resolveSwapCostRule(REG, { settings: { swapCostRule: 'nonsense' } }).id,
      REG.balance.equipment.swapCostRule, 'an unreadable saved rule falls back to the shipped default');
  });

  // ---- 28r. bad data fails loud and names the row -------------------------
  test('28r. every way to author combat equipment tuning wrong is refused BY NAME', () => {
    // Law 1 clause 5. Each of these is a plausible edit that would otherwise be
    // SILENT — the game keeps charging 2 and nobody can tell a setting that is
    // off from one that is broken. Observed red here before being cited:
    // `validateEquipment(REG)` is 0 on the real tree (asserted first), so every
    // count below is caused by the plant and nothing else.
    eq(validateEquipment(REG).length, 0, 'the shipped tree is clean, so a count of 1 below means the plant');

    const bend = (equipment) => ({ ...REG, balance: { ...REG.balance, equipment: { ...REG.balance.equipment, ...equipment } } });
    const oneProblem = (reg, needle, what) => {
      const found = validateEquipment(reg);
      eq(found.length, 1, `${what}: exactly one complaint (got ${found.length}: ${found.join(' | ')})`);
      assert(found[0].includes(needle), `${what}: the complaint names '${needle}' — got: ${found[0]}`);
    };

    oneProblem(bend({ swapCost: -1 }), 'swapCost', 'a negative default');
    oneProblem(bend({ swapCost: 1.5 }), 'swapCost', 'a fractional default');
    oneProblem(bend({ swapCostByCategory: [{ tag: 'heavy', cost: -2 }] }), 'heavy', 'a negative category cost');
    oneProblem(bend({ swapCostByCategory: [{ tag: 'chunky', cost: 3 }] }), 'chunky', 'a category no armament carries');
    oneProblem(bend({ swapCostRule: 'fastest' }), 'fastest', 'a live rule that is not a row');
    oneProblem(bend({ swapCostRules: [{ id: 'flat', base: 'vibes', gear: false }], swapCostRule: 'flat' }),
      'vibes', 'a rule whose base is outside the closed set');
    oneProblem(bend({ swapCostRules: [{ id: 'flat', base: 'default', gear: 'yes' }], swapCostRule: 'flat' }),
      'gear', 'a rule whose gear rung is not a boolean');
    oneProblem(bend({ allowChangesInCombat: 'yes' }), 'allowChangesInCombat',
      'a combat equipment permission that is not a boolean');

    // ---- the shelf's own three, same standard (A7) -------------------------
    oneProblem(bend({ basicTag: 'starter' }), 'starter', 'a basicTag no armament carries');
    // `bend({ basicTag: 'basic' })`, not `bend({})`, since 2026-08-21: the
    // shipped tag is now '' (he killed the universal shelf), so a registry bent
    // with the shipped value has NO everybody's-rows and this refusal has
    // nothing to refuse. THE VALIDATOR IS UNCHANGED AND STILL RIGHT — what
    // moved is the config, so the test turns the concept back on to exercise
    // it. A check that quietly passed on an empty population would be the
    // vacuous green this file exists to refuse.
    const withEarnedBasic = {
      ...bend({ basicTag: 'basic' }),
      equipment: {
        ...REG.equipment,
        armaments: REG.equipment.armaments.map((a) => (a.id === 'straightSword' ? { ...a, unlock: 'winAsReaver' } : a)),
      },
    };
    oneProblem(withEarnedBasic, 'straightSword', 'a row that is both everybody\'s and earned');
    // Same reason as `withEarnedBasic` above: the shipped tag is '' since his
    // 2026-08-21 kill, so the concept has to be turned on for its own refusal
    // to have anything to refuse.
    const basicArmour = {
      ...bend({ basicTag: 'basic' }),
      equipment: {
        ...REG.equipment,
        armour: REG.equipment.armour.map((o) => (o.id === 'default' && o.classId === 'reaver'
          ? { ...o, tags: [...(o.tags || []), 'basic'] } : o)),
      },
    };
    oneProblem(basicArmour, 'never drops', 'a basic tag on a kind that never drops');

    // ---- the `apply` vocabulary, which nothing checked before A8 -----------
    // A row reading `apply=swapcost` used to validate clean, be collected by
    // nobody and change nothing, forever.
    const typoApply = {
      ...bend({}),
      equipment: {
        ...REG.equipment,
        modFields: { ...REG.equipment.modFields, maxHp: { ...REG.equipment.modFields.maxHp, apply: 'maxhp' } },
      },
    };
    oneProblem(typoApply, 'maxhp', 'an apply value no consumer handles');

    // ---- DECLARED AND HANDLED, both directions ----------------------------
    // The validator above proves nothing outside the list gets in. This proves
    // nothing INSIDE the list is inert — which is the direction that rots,
    // because adding a word to a closed set and forgetting the consumer reads
    // exactly like adding a word and remembering. Every member changes an
    // observable field of runMods' return, or it is decoration.
    const probeRun = (apply) => {
      const reg = {
        ...REG,
        equipment: {
          ...REG.equipment,
          modFields: { ...REG.equipment.modFields, probe: { field: 'probe', scope: 'run', apply, status: 'strength' } },
          armaments: [...REG.equipment.armaments,
            { id: 'probePiece', name: 'Probe', kind: 'weapon', hand: 'right', rarity: 'common', mods: ['self.probe=+3'], unlock: '', ...TEST_ARMAMENT_INTRINSICS }],
        },
      };
      const lo = createLoadout(reg, 'reaver');
      lo.sets.rightHand[0] = 'probePiece';
      return JSON.stringify(runMods(reg, lo, 'reaver'));
    };
    const inert = probeRun('__nothing__');
    for (const apply of RUN_MOD_APPLIES) {
      assert(probeRun(apply) !== inert, `RUN_MOD_APPLIES member '${apply}' actually changes runMods' answer`);
    }

    // Same join on the other closed set: every base a rule row may name has to
    // price a swap, or it is a legal word with no meaning.
    const priceRun = createRunState({ seed: 5, classId: 'reaver', registries: REG });
    priceRun.loadout.sets.rightHand[1] = 'greatsword';
    for (const base of SWAP_COST_BASES) {
      const p = swapCostFor(REG, {
        rule: { id: `probe-${base}`, base, gear: false },
        loadout: priceRun.loadout, classId: 'reaver', slotId: 'rightHand', setIndex: 1, relicDelta: 0,
      });
      assert(Number.isInteger(p.cost) && p.cost >= 0, `SWAP_COST_BASES member '${base}' prices a swap (got ${p.cost})`);
      eq(p.base, base, `…and reports the base it used, so '${base}' cannot silently become 'default'`);
    }
  });

  // ---- 28b. hands: the SLOT decides where, the PIECE only asks ------------
  test("28b. which hand a piece is in is the slot's fact, not the piece's", () => {
    // Bjorn's photograph on `dev`, 2026-08-07: Straight Sword in the LEFT hand,
    // Greatsword in the RIGHT, and the figure holds ONE blade — the straight
    // sword, on the right-hand layer. figureSpec() read `hand` off the PIECE, so
    // both landed on spec.rightId and the second write won. Two weapons in, one
    // weapon out, wrong hand, no error. One fact with two homes (Law 0 c4).
    const run = createRunState({ seed: 3, classId: 'reaver', registries: REG });

    // Written straight into the loadout, the way a SAVE arrives — this is a
    // claim about where a piece is DRAWN, with the equip gate out of the way.
    run.loadout.sets.leftHand[0] = 'straightSword';
    run.loadout.sets.rightHand[0] = 'greatsword';
    const both = figureSpec(REG, run.loadout, 'reaver');
    eq(both.leftId, 'straightSword', 'the piece in the left slot is drawn in the left hand');
    eq(both.rightId, 'greatsword', 'the piece in the right slot is drawn in the right hand');

    // The full-frame weapon art was authored with blades on the default sword
    // socket and shields on the default off-hand socket.  A slot swap must
    // correct that baked position per layer, or the figure still follows the
    // weapon category even though the loadout facts are right.
    eq(both.leftMirror, true, 'a blade moved to the left slot is mirrored onto that socket');
    eq(both.rightMirror, false, 'a blade in the right slot keeps its authored socket');

    run.loadout.sets.leftHand[0] = 'straightSword';
    run.loadout.sets.rightHand[0] = 'roundShield';
    const swapped = figureSpec(REG, run.loadout, 'reaver');
    eq(swapped.leftId, 'straightSword', 'the swapped sword remains in the left slot');
    eq(swapped.rightId, 'roundShield', 'the swapped shield remains in the right slot');
    eq(swapped.leftMirror, true, 'the swapped sword is mirrored onto the left socket');
    eq(swapped.rightMirror, true, 'the swapped shield is mirrored onto the right socket');

    // 'either' is still a real word: the dagger goes in either hand and is drawn
    // in the one it is in, not in the one its row prefers.
    run.loadout.sets.leftHand[0] = 'dagger';
    eq(figureSpec(REG, run.loadout, 'reaver').leftId, 'dagger', "an 'either' piece in the left hand is drawn there");
    run.loadout.sets.leftHand[0] = null;
    run.loadout.sets.rightHand[0] = 'dagger';
    eq(figureSpec(REG, run.loadout, 'reaver').rightId, 'dagger', '…and in the right hand when it is there');
    eq(figureSpec(REG, run.loadout, 'reaver').leftId, null, 'and it is not in both at once');

    // The two vocabularies read out of their own homes and no other.
    eq(slotHand(REG.equipment.slots.find((s) => s.id === 'leftHand')), 'left', 'the left slot knows it is the left hand');
    eq(slotHand(REG.equipment.slots.find((s) => s.id === 'armor')), null, 'armour is worn, not held');
    eq(pieceHand(REG.equipment.armaments.find((a) => a.id === 'dagger')), null, "'either' constrains nothing");
    eq(pieceHand(REG.equipment.armaments.find((a) => a.id === 'greatsword')), null, 'a greatsword is side-neutral');
    assert(REG.equipment.armaments.every((piece) => pieceHand(piece) === null), 'every shipped armament may be held in either hand');
    const rightHandSlot = REG.equipment.slots.find((slot) => slot.id === 'rightHand');
    const leftHandSlot = REG.equipment.slots.find((slot) => slot.id === 'leftHand');
    let eitherHandChecks = 0;
    for (const armament of REG.equipment.armaments) {
      assert(fitsSlot(rightHandSlot, armament), `${armament.id}: fits the right hand`);
      assert(fitsSlot(leftHandSlot, armament), `${armament.id}: fits the left hand`);
      eitherHandChecks += 2;
    }
    eq(eitherHandChecks, REG.equipment.armaments.length * 2, 'every shipped armament was checked against both hands');

    // The other edge of the same defect, on a slot the real table does not have
    // yet: a slot that is NOT a hand is not a hand. A carried talisman used to
    // arrive as a weapon layer in the right hand and overwrite the weapon.
    const carried = {
      equipment: {
        slots: [
          { id: 'rightHand', label: 'R', kinds: ['weapon'], hand: 'right', sets: 1, swap: 'combat' },
          { id: 'charm', label: 'C', kinds: ['talisman'], hand: '', sets: 1, swap: 'outOfCombat' },
        ],
        armaments: [
          { id: 'w', kind: 'weapon', hand: 'right', tags: [], mods: [] },
          { id: 't', kind: 'talisman', hand: '', tags: [], mods: [] },
        ],
        armour: [],
      },
    };
    const worn = { sets: { rightHand: ['w'], charm: ['t'] }, active: {}, storage: [] };
    const drawn = figureSpec(carried, worn, 'reaver');
    eq(drawn.rightId, 'w', 'the weapon keeps the right hand');
    eq(drawn.leftId, null, 'and the talisman is drawn in no hand at all');

    // ---- the gate is on the mutation, not on the screen -------------------
    eq(equippedTagColor(REG.equipment.armouryUi), '#7FD47F', 'the authored equipped tag uses its custom green');
    eq(equippedTagColor({ equippedTag: { useCustomColor: false, customColor: '#7FD47F' } }), null,
      'turning custom colour off delegates the equipped tag to the motif');
    assert(armouryUiProblems({ equippedTag: { useCustomColor: true, customColor: 'green' } })
      .some((problem) => problem.path.endsWith('customColor')), 'an invalid JSON colour fails by field name');

    const fresh = createRunState({ seed: 4, classId: 'reaver', registries: REG });
    assert(equipPiece(REG, fresh.loadout, 'leftHand', 0, 'straightSword', OWNS_EVERYTHING, AT_CAMP),
      'the starting sword moves freely into the left hand');
    eq(fresh.loadout.sets.rightHand[0], null, 'moving the sword clears its old right-hand location');
    eq(fresh.loadout.sets.leftHand[0], 'straightSword', 'and places it in the left hand');
    eq(fresh.loadout.storage.filter((id) => id === 'roundShield').length, 1, 'the displaced shield returns to inventory once');
    assert(equipPiece(REG, fresh.loadout, 'rightHand', 0, 'roundShield', OWNS_EVERYTHING, AT_CAMP),
      'the shield can move freely into the right hand');
    eq(fresh.loadout.sets.rightHand[0], 'roundShield', 'the right hand now holds the shield');
    eq(fresh.loadout.sets.leftHand[0], 'straightSword', 'the sword remains in the left hand');
    eq(fresh.loadout.storage.includes('roundShield'), false, 'an equipped shield is no longer duplicated in storage');
    eq(equipmentRoleSource(REG, fresh.loadout, fresh.class, 'guard').piece.id, 'straightSword',
      'the left-hand sword supplies the Defend profile');

    const staffRun = createRunState({ seed: 5, classId: 'herald', registries: REG });
    assert(equipPiece(REG, staffRun.loadout, 'leftHand', 0, 'boneSceptre', OWNS_EVERYTHING, AT_CAMP),
      'a staff moves from right to left');
    eq(equipmentRoleSource(REG, staffRun.loadout, staffRun.class, 'guard').piece.id, 'boneSceptre',
      'the left-hand staff supplies the Defend profile');

    const shieldRun = createRunState({ seed: 6, classId: 'reaver', registries: REG });
    assert(equipPiece(REG, shieldRun.loadout, 'leftHand', 0, null, OWNS_EVERYTHING, AT_CAMP), 'the starting shield returns to Inventory');
    assert(equipPiece(REG, shieldRun.loadout, 'rightHand', 0, 'roundShield', OWNS_EVERYTHING, AT_CAMP), 'the shield equips in the right hand');
    eq(equipmentRoleSource(REG, shieldRun.loadout, shieldRun.class, 'guard').piece.id, 'roundShield',
      'a right-hand shield still supplies its guard profile when the left hand is bare');

    const previewRun = createRunState({ seed: 7, classId: 'reaver', registries: REG });
    const preview = equipmentSurfaceReceipt(REG, previewRun, {
      candidate: { slotId: 'leftHand', setIndex: 0, pieceId: 'straightSword' },
    }).candidate;
    const actualRun = structuredClone(previewRun);
    assert(equipPiece(REG, actualRun.loadout, 'leftHand', 0, 'straightSword', OWNS_EVERYTHING, AT_CAMP),
      'the previewed cross-hand move can be committed');
    const actualRoles = equipmentSurfaceReceipt(REG, actualRun).roles;
    eq(JSON.stringify(preview.roles.map((row) => [row.role, row.afterName, row.afterValue])),
      JSON.stringify(actualRoles.map((row) => [row.role, row.profile.displayName, row.receipt.value])),
      'cross-hand comparison after-values match the actual one-object transition');

    const armourRun = createRunState({ seed: 8, classId: 'reaver', registries: REG });
    const alternateArmour = REG.equipment.armour.find((piece) => piece.classId === 'reaver' && piece.id !== armourRun.loadout.sets.armor[0]);
    const armourStorageBefore = JSON.stringify(armourRun.loadout.storage);
    assert(equipPiece(REG, armourRun.loadout, 'armor', 0, alternateArmour.id, OWNS_EVERYTHING, AT_CAMP), 'armour can still be changed');
    eq(JSON.stringify(armourRun.loadout.storage), armourStorageBefore, 'changing armour never writes to armament Inventory');

    const cap = REG.balance.equipment.storageSlots;
    const fullRun = createRunState({ seed: 9, classId: 'reaver', registries: REG });
    fullRun.loadout.storage = REG.equipment.armaments
      .map((piece) => piece.id)
      .filter((id) => !['straightSword', 'roundShield'].includes(id))
      .slice(0, cap);
    const fullBefore = JSON.stringify(fullRun.loadout);
    const fullUnequip = equipTransitionReceipt(REG, fullRun.loadout, 'rightHand', 0, null);
    eq(fullUnequip.ok, false, 'the capacity receipt refuses the full-Inventory unequip before mutation');
    assert(fullUnequip.reason.includes(`Inventory is full (${cap}/${cap})`), 'the capacity receipt gives the UI its exact full-Inventory reason');
    assert(!equipPiece(REG, fullRun.loadout, 'rightHand', 0, null, OWNS_EVERYTHING, AT_CAMP),
      'unequip refuses atomically when shared Inventory is full');
    eq(JSON.stringify(fullRun.loadout), fullBefore, 'a refused full-Inventory unequip changes nothing');
    assert(!equipPiece(REG, fullRun.loadout, 'leftHand', 0, 'straightSword', OWNS_EVERYTHING, AT_CAMP),
      'a cross-hand move refuses when its displaced item cannot return to Inventory');
    eq(JSON.stringify(fullRun.loadout), fullBefore, 'a refused full-Inventory move changes nothing');

    assert(equipPiece(REG, fresh.loadout, 'leftHand', 1, 'dagger', OWNS_EVERYTHING, AT_CAMP), 'a dagger goes in a left-hand rack set');
    assert(equipPiece(REG, fresh.loadout, 'rightHand', 1, 'dagger', OWNS_EVERYTHING, AT_CAMP), 'the same dagger moves to a right-hand rack set');
    eq(fresh.loadout.sets.leftHand[1], null, 'moving the dagger clears its old rack location');
    eq(Object.values(fresh.loadout.sets).flat().filter((id) => id === 'dagger').length, 1,
      'one carried armament is equipped in exactly one location');

    assert(equipPiece(REG, fresh.loadout, 'leftHand', 0, null, OWNS_EVERYTHING, AT_CAMP), 'clearing a slot is always allowed');
    eq(fresh.loadout.sets.leftHand[0], null, 'and it clears');
    eq(fresh.loadout.storage.filter((id) => id === 'straightSword').length, 1, 'unequipping returns the old left-hand piece to storage once');
    assert(ownership(REG, { meta: {}, loadout: fresh.loadout }).has(REG.equipment.armaments.find((p) => p.id === 'straightSword')),
      'the unequipped left-hand piece remains owned');
    assert(equipPiece(REG, fresh.loadout, 'leftHand', 0, 'straightSword', OWNS_EVERYTHING, AT_CAMP), 'the returned left-hand piece can be equipped again');
    assert(equipPiece(REG, fresh.loadout, 'leftHand', 0, null, OWNS_EVERYTHING, AT_CAMP), 'the repeated unequip still succeeds');
    eq(fresh.loadout.storage.filter((id) => id === 'straightSword').length, 1, 'repeated unequip does not duplicate storage');

    // The picker offers exactly what the mutation accepts. Not a claim about
    // the screen — a claim that the two questions have ONE answer, which is
    // what stops a slot from taking a click and then doing nothing.
    const allPieces = [...REG.equipment.armaments, ...REG.equipment.armour];
    let checked = 0; let offered = 0;
    for (const slot of REG.equipment.slots) {
      for (const piece of allPieces) {
        const fits = fitsSlot(slot, piece);
        const probe = { sets: { [slot.id]: [null] }, active: {}, storage: [] };
        eq(equipPiece(REG, probe, slot.id, 0, piece.id, OWNS_EVERYTHING, AT_CAMP), fits, `${slot.id} ← ${piece.id}: offer and mutation agree`);
        checked += 1;
        if (fits) offered += 1;
      }
    }
    // An empty result set is never a pass, and neither is an all-false one: a
    // predicate that refused everything would satisfy the loop above.
    eq(checked, REG.equipment.slots.length * allPieces.length, 'every slot × piece pair was actually checked');
    assert(offered > 0 && offered < checked, `the gate both admits and refuses (${offered} of ${checked})`);

    // ---- the validator, watched going red, by name ------------------------
    // THE WHOLE equipment TABLE, not a hand-picked list of its sub-tables.
    // The old six-key list was a second copy of the table's shape: when the
    // validator grew reads on `unarmedProfiles` and `basicCardProfiles`, the
    // control arm below reported a sound tree as broken — for the missing
    // keys, not for anything the mutations planted.
    const clone = () => JSON.parse(JSON.stringify(REG.equipment));
    const check = (mut) => {
      const equipment = clone();
      mut(equipment);
      // THE REAL REGISTRIES, WITH ONLY `equipment` SWAPPED FOR THE MUTATED
      // CLONE. This was a hand-built { equipment, classes, statuses } object,
      // and it went stale the day validateEquipment widened to read
      // `registries.attributes.has(...)` and `registries.cards.has(...)`
      // (the attribute-requirement receipts) — from then on the CONTROL ARM
      // errored with "Cannot read properties of undefined (reading 'has')",
      // so the five known-bad mutations below never ran: a dead battery
      // reporting through a red control arm. A caller that re-lists the
      // validator's inputs is a second copy of its signature; spreading REG
      // means the next widened read is already here.
      return validateEquipment({ ...REG, equipment }).join('; ');
    };
    const slotRow = (e, id) => e.slots.find((s) => s.id === id);
    const armRow = (e, id) => e.armaments.find((a) => a.id === id);

    eq(check(() => {}), '', 'the control arm: an untouched copy of the real tables is sound');
    assert(check((e) => { slotRow(e, 'leftHand').hand = ''; }).includes("slot 'leftHand' accepts"),
      'a hand slot that names no hand fails, naming the slot and a piece it would swallow');
    assert(check((e) => { slotRow(e, 'leftHand').hand = 'sideways'; }).includes('is not one of left|right'),
      'a hand outside the closed set fails and prints the legal values');
    assert(check((e) => { armRow(e, 'ashStaff').kind = 'wand'; }).includes("no slot can hold 'ashStaff'"),
      'a piece no slot can hold fails by its own id');
    assert(check((e) => {
      slotRow(e, 'leftHand').kinds = ['staff'];
      e.armaments.filter((piece) => piece.kind === 'staff').forEach((piece) => { piece.hand = 'right'; });
    }).includes("slot 'leftHand' can hold nothing"),
      'a slot whose every matching piece names the other hand fails as an empty result set');
  });

  // ---- 30. unlocks are earned, remembered, and never taken back -------------
  test('30. unlock conditions evaluate against durable progress, not recent history', () => {
    // The conditions are a closed set, so an unregistered one is caught here
    // rather than sitting in the CSV never firing.
    for (const u of REG.unlocks) {
      assert(UNLOCK_CONDITIONS[u.condition], `unlock '${u.id}' uses a registered condition (${u.condition})`);
      assert(REVEAL_MODES.includes(u.reveal), `unlock '${u.id}' uses a known reveal mode (${u.reveal})`);
    }

    const meta = { unlocked: [], progress: emptyProgress() };
    const play = (result) => {
      meta.progress = recordProgress(meta.progress, result);
      const fresh = evaluateUnlocks(REG.unlocks, meta);
      meta.unlocked = [...meta.unlocked, ...fresh];
      return fresh;
    };

    eq(evaluateUnlocks(REG.unlocks, meta).join(','), '', 'a fresh profile has earned nothing');

    // Dying in act 2 still counts as having REACHED act 2.
    const r1 = play({ victory: false, class: 'reaver', act: 2, bosses: [] });
    assert(r1.includes('reachStitchedCourt'), 'reaching act 2 earns the Pilgrim Wrap');
    assert(!r1.includes('winAsReaver'), 'a loss is not a win');

    // Felling a boss counts even in a run that ends badly.
    const r2 = play({ victory: false, class: 'herald', act: 2, bosses: ['fellWarden'] });
    assert(r2.includes('beatFellWarden'), 'the Fell Warden falling earns Starlit Silks');
    eq(play({ victory: false, class: 'herald', act: 1, bosses: ['fellWarden'] }).join(','), '',
      'the same boss again earns nothing new');

    // Progress only ever grows — an act-1 death cannot undo having seen act 2.
    eq(meta.progress.maxAct, 2, 'max act reached is a high-water mark');

    const r3 = play({ victory: true, class: 'reaver', act: 3, bosses: ['stitchedKing'] });
    assert(r3.includes('winAsReaver'), 'winning as the Reaver earns the Oathsworn set');
    assert(r3.includes('beatStitchedKing'), 'and the King falling earns the Ashen Vigil');
    assert(r3.includes('reachAshenCrown'), 'and act 3 earns the Warden Mail');

    // winRuns counts TOTAL wins, which is the reason progress exists at all:
    // meta.results is capped, so counting from it would silently become
    // "wins, recently".
    assert(!meta.unlocked.includes('winTwice'), 'one win is not two');
    const r4 = play({ victory: true, class: 'starseer', act: 3, bosses: [] });
    assert(r4.includes('winTwice'), 'the second win earns the Astral Vestment');
    assert(!r4.includes('graveWardenUnlock'), 'three wins still pending at two');
    assert(play({ victory: true, class: 'herald', act: 3, bosses: [] }).includes('graveWardenUnlock'),
      'the third win earns the Grave Warden');

    // Earned things stay earned even if the tally were somehow rebuilt.
    eq(evaluateUnlocks(REG.unlocks, meta).join(','), '', 'nothing is earned twice');

    // Reveal modes: a hidden unlock is invisible until it is earned.
    const blind = { unlocked: [], progress: emptyProgress() };
    const shown = unlockView(REG.unlocks, blind).map((u) => u.id);
    assert(!shown.includes('ashChildUnlock'), 'a hidden unlock is not listed while unearned');
    assert(shown.includes('graveWardenUnlock'), 'a teased unlock is listed, with its hint');
    eq(unlockView(REG.unlocks, blind).find((u) => u.id === 'graveWardenUnlock').hint, 'Win three runs.',
      'the teased hint tells you what to do');
    const seen = unlockView(REG.unlocks, { unlocked: ['ashChildUnlock'] }).map((u) => u.id);
    assert(seen.includes('ashChildUnlock'), 'once earned, the secret appears');

    // Every armour set an unlock points at must exist, or the wardrobe gates a
    // door onto nothing.
    for (const u of REG.unlocks) {
      if (u.kind !== 'outfit') continue;
      assert(REG.equipment.armour.some((o) => o.id === u.ref), `unlock '${u.id}' points at a real armour set`);
    }
  });

  // ---- 31. armament drops: the run arms you, and the profile remembers -----
  test('31. armament drops are seeded, prefer the unheld, and run dry rather than repeat', () => {
    const drops = REG.balance.equipment.drops;
    const roll = (seed, source, opts = {}) =>
      rollArmamentDrop(REG, createRng(seed), { source, ...opts });

    // Same seed, same drop — a run replays exactly, drops included.
    eq(roll(42, 'boss'), roll(42, 'boss'), 'the same seed drops the same armament');

    // A boss always gives something; treasure is a coin toss, so over many
    // seeds it must both hit and miss.
    const bossOut = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => roll(s, 'boss'));
    assert(bossOut.every(Boolean), 'a boss always drops (chance 100)');
    const treasureOut = Array.from({ length: 40 }, (_, i) => roll(i + 1, 'treasure'));
    assert(treasureOut.some(Boolean), 'treasure sometimes drops');
    assert(treasureOut.some((x) => x === null), 'and sometimes does not');

    // Everything that drops is a real, slottable armament.
    const armIds = REG.equipment.armaments.map((a) => a.id);
    for (const id of bossOut) assert(armIds.includes(id), `dropped '${id}' is a real armament`);

    // A piece already held is never handed to you again.
    const held = armIds.filter((id) => id !== 'towerShield');
    const only = roll(9, 'boss', { found: held });
    eq(only, 'towerShield', 'with one left unheld, that is what drops');
    eq(roll(9, 'boss', { found: armIds }), null, 'holding everything, a boss drops nothing');
    eq(roll(9, 'boss', { found: held.slice(0, 5), carried: held.slice(5) }), 'towerShield',
      'carried counts as held, same as found');

    // Boss odds lean rare; treasure odds lean common. Checked over many seeds
    // rather than asserting one roll, since the point is the distribution.
    const rarityOf = (id) => REG.equipment.armaments.find((a) => a.id === id).rarity;
    const bossRares = Array.from({ length: 120 }, (_, i) => roll(i + 100, 'boss'))
      .filter(Boolean).filter((id) => rarityOf(id) === 'rare').length;
    const treasureRares = Array.from({ length: 120 }, (_, i) => roll(i + 100, 'treasure'))
      .filter(Boolean).filter((id) => rarityOf(id) === 'rare').length;
    assert(bossRares > treasureRares, `bosses drop rares more often (${bossRares} vs ${treasureRares})`);

    // Ordinary fights are not a source: with no 'normal' key the roll is a
    // no-op rather than a hidden 0%.
    eq(drops.chance.normal, undefined, "there is no 'normal' drop chance");
    eq(roll(3, 'normal'), null, 'an ordinary fight drops no armament');

    // Storage: what you find is carried, capped, and never duplicated.
    const run = createRunState({ seed: 5, classId: 'reaver', registries: REG });
    assert(addToStorage(run.loadout, 'katana', 8), 'a find goes into storage');
    assert(!addToStorage(run.loadout, 'katana', 8), 'the same piece does not stack');
    assert(!addToStorage(run.loadout, 'dagger', 1), 'storage respects its cap');
    assert(carriedIds(run.loadout).includes('katana'), 'carried counts what is in storage');
    equipPiece(REG, run.loadout, 'rightHand', 0, 'greatsword', OWNS_EVERYTHING, AT_CAMP);
    assert(carriedIds(run.loadout).includes('greatsword'), 'and what is slotted');
  });

  // ---- 31b. the armoury is an INVENTORY, and the ladder is arithmetic ------
  //
  // EldenSpire#90, Constantine: *"the armory is more like an empty inventory,
  // but starts with slots locked (but only shows the next locked thing) … as for
  // weapons, I should only see an inventory of the weapons I've collected."*
  //
  // Two properties, and both are about things NOT being offered, which is the
  // hard direction to test: an absence looks the same as a bug. So every count
  // below is checked against a denominator that is also asserted, and each
  // property is watched going the other way.
  test('31b. the picker offers only what the profile owns, and the slot ladder shows exactly one step ahead', () => {
    const eq_ = REG.equipment;
    const rightHand = eq_.slots.find((s) => s.id === 'rightHand');
    const armorSlot = eq_.slots.find((s) => s.id === 'armor');
    const fits = (slot, pool) => pool.filter((p) => fitsSlot(slot, p));

    // ---- the denominator, so "0 offered" cannot pass by being empty --------
    const rightPool = fits(rightHand, eq_.armaments);
    assert(rightPool.length > 1, `the right hand has a pool to filter (${rightPool.length})`);

    // ---- 1. a fresh profile owns nothing droppable EXCEPT THE BASICS -------
    // AMENDED BY HIM, NOT BY US (A7, Viki). This line read `0 of 16 — an
    // inventory, not a catalogue`, and it was the right assertion for the
    // sentence it was written from (*"I should only see an inventory of the
    // weapons I've collected"*, #90). On 2026-08-08 he added the other half:
    // *"everything else is profile specific but maybe A FEW BASIC WEAPONS
    // BECOME AVAILABLE FOR ALL."* So the number is no longer 0 — and the claim
    // this test defends is unchanged and is the one that matters: what a fresh
    // profile is offered is EXACTLY a named, derivable set and nothing else.
    // A catalogue would still fail here.
    const fresh = createLoadout(REG, 'reaver');
    const none = ownership(REG, { meta: {}, loadout: fresh });
    // KILLED BY HIM, 2026-08-21 — the THIRD instruction this sub-check has
    // served, and all three are kept above and here rather than overwritten:
    //   "kill 3 basic weapons on self unless it's a starting kit armory weapon
    //    shown on character creation."
    // `basicTag` now ships as '' and the universal shelf is off. The exemption
    // he wanted is THE STARTING KIT, and it needs no rule — the kit is WORN, so
    // `carriedIds(loadout)` already holds it. That is what this line now proves.
    const basicTag = REG.balance.equipment.basicTag;
    // The shelf's floor, DERIVED from the model rather than typed: what a fresh
    // profile with nothing found is offered — i.e. the kit it is wearing.
    const kitRight = rightPool.filter((p) => none.has(p)).map((p) => p.id);
    eq(basicTag, '', 'the universal-shelf tag ships OFF — his 2026-08-21 kill');
    eq(kitRight.join(','), 'straightSword,roundShield',
      'the unified hand inventory offers exactly both equipped starting armaments — kit, not category');

    // ---- 1b. …and the TAG is still the mechanism, observed both ways -------
    // A knob read but never watched to change the outcome has not been built —
    // and that is as true of a knob turned OFF as of one turned on. The
    // direction is simply reversed now: putting 'basic' back must WIDEN the
    // shelf past the kit, which is exactly what he asked to stop happening.
    const withBasics = { ...REG, balance: { ...REG.balance, equipment: { ...REG.balance.equipment, basicTag: 'basic' } } };
    const widened = rightPool.filter((p) => ownership(withBasics, { meta: {}, loadout: fresh }).has(p)).map((p) => p.id);
    assert(widened.length > 1 && widened.includes('straightSword'),
      `restoring basicTag widens the shelf past the kit (${widened.join(', ')}) — the tag, not a hard-coded list`);

    // ---- 2. …and what it finds, it is offered, and ONLY that --------------
    //
    // RE-SCOPED BY HIM, NOT BY US (Viki, 2026-08-21) — AND THE TWO INSTRUCTIONS
    // THIS TEST NOW SITS BETWEEN ARE BOTH KEPT HERE, because a test that quietly
    // changed sides would hide the only thing a reader needs to know:
    //
    //   2026-08-08  "everything else is PROFILE SPECIFIC but maybe a few basic
    //                weapons become available for all."
    //   2026-08-21  "it should only show armory you actually PICKED UP MID RUN."
    //
    // Those are opposite ends of ONE dial — `balance.equipment.persistence` —
    // and the later, explicit one is what ships: 'perRun'. THE CLAIM THIS
    // SUB-CHECK DEFENDS IS UNCHANGED (what you found is offered, and ONLY that);
    // what moved is WHERE "found" lives, from the profile to the run. So the
    // dagger arrives the way a player actually gets one now — in the loadout,
    // picked up this climb — instead of in `meta.found`.
    //
    // FLAGGED, NOT SETTLED: this is a design reversal and it is his to confirm
    // or reverse in one line. If he wants the profile shelf back, `persistence`
    // goes to 'both' and THIS SUB-CHECK IS THE ONE THAT MUST BE PUT BACK — which
    // is why the old form is written above rather than deleted from history.
    const picked = { ...fresh, storage: [...(fresh.storage || []), 'dagger'] };
    const two = ownership(REG, { meta: {}, loadout: picked });
    const offered = rightPool.filter((p) => two.has(p)).map((p) => p.id);
    eq(offered.join(','), [...kitRight, 'dagger'].sort((a, b) => rightPool.findIndex((p) => p.id === a) - rightPool.findIndex((p) => p.id === b)).join(','),
      'one weapon PICKED UP THIS RUN is one option ADDED to the basics — his "starting weapon and a scimitar" case, plus the few that are everybody\'s');

    // ---- 2b. …and the profile no longer widens the shelf on its own -------
    // The direction the re-scope CREATES, and it is the half a flipped dial
    // would otherwise change in silence: a piece found in an earlier climb, with
    // nothing carried this run, is NOT offered. Without this line, moving
    // `persistence` back to 'both' passes every check in this file.
    const profileOnly = ownership(REG, { meta: { found: ['dagger'] }, loadout: fresh });
    eq(rightPool.filter((p) => profileOnly.has(p)).map((p) => p.id).join(','), kitRight.join(','),
      'a piece found in an EARLIER run is not offered in this one — the shelf is the run\'s (persistence: perRun)');

    // ---- 3. the OTHER direction: the sandbox still opens everything --------
    // requireFound did not change meaning; turning it off still means everything
    // is owned. Proving that keeps this from being "the filter always says no".
    const sandboxReg = { ...REG, balance: { ...REG.balance, equipment: { ...REG.balance.equipment, drops: { ...REG.balance.equipment.drops, requireFound: false } } } };
    const all = ownership(sandboxReg, { meta: {}, loadout: fresh });
    eq(rightPool.filter((p) => all.has(p)).length, rightPool.length,
      'with requireFound off every armament is owned — the documented sandbox survives');

    // ---- 4. armour answers to the OTHER route, and it is not a kind test ---
    const armourPool = fits(armorSlot, eq_.armour.filter((o) => o.classId === 'reaver'));
    assert(armourPool.length > 1, `the reaver has an armour pool (${armourPool.length})`);
    eq(armourPool.filter((p) => none.has(p)).map((p) => p.id).join(','), 'default',
      'a fresh profile is offered exactly its one starting set');
    const earned = ownership(REG, { meta: { unlocked: ['winAsReaver'] }, loadout: fresh });
    eq(armourPool.filter((p) => earned.has(p)).length, 2, 'earning one unlock adds exactly one set');
    assert(!fromDropPool(armourPool[0]) && fromDropPool(rightPool[0]),
      'the pool question is asked of the piece, not spelled as an if on its kind');

    // ---- 5. the gate is on the MUTATION, not the view ---------------------
    // The measured defect at 77a02b9: this returned true for an unowned piece,
    // because the only ownership check in the tree was the picker declining to
    // attach a click handler.
    const probe = createLoadout(REG, 'reaver');
    assert(!equipPiece(REG, probe, 'rightHand', 0, 'greatsword', none, AT_CAMP),
      'an unowned armament cannot be equipped even when it fits');
    eq(probe.sets.rightHand[0], 'straightSword', 'and the refusal left the authored starting weapon alone');
    assert(equipPiece(REG, probe, 'rightHand', 0, 'dagger', two, AT_CAMP), 'an owned one goes in');

    // ---- 6. the ladder: three states from two integers --------------------
    const rungs = slotRungs(REG, 'rightHand');
    assert(rungs.length >= 2, `the right hand has rungs to climb (${rungs.length})`);
    eq(rungs.every((u) => u.kind === SLOT_RUNG_KIND && u.ref === 'rightHand'), true, 'and they name it');

    const ladder = (meta, loadout = createLoadout(REG, 'reaver')) => {
      const opened = openedSets(REG, rightHand, { meta, loadout });
      const visible = visibleSets(REG, rightHand, { meta, loadout });
      return Array.from({ length: rightHand.sets }, (_, i) => setCellState(i, opened, visible)).join(',');
    };
    eq(ladder({}), 'open,next,hidden',
      'turn one: one open, the next locked and visible, and nothing beyond it');
    eq(ladder({ unlocked: [rungs[0].id] }), 'open,open,next',
      'earning the first rung opens it and reveals exactly one more');
    eq(ladder({ unlocked: rungs.map((u) => u.id) }), 'open,open,open',
      'with every rung earned there is nothing left to reveal');

    // ---- 7. the state a per-cell field would have allowed is unreachable ---
    // Two locked steps, a hidden cell before an open one, a slot with no open
    // cell: not invalid — UNREPRESENTABLE, because nothing is written per cell.
    for (const meta of [{}, { unlocked: [rungs[0].id] }, { unlocked: rungs.map((u) => u.id) }, { unlocked: ['nonsense'] }]) {
      const seq = ladder(meta).split(',');
      eq(seq.filter((s) => s === 'next').length <= 1, true, 'never two locked steps');
      eq(seq[0], 'open', 'the first cell is always usable');
      eq(seq.join(','), [...seq].sort((a, b) => ['open', 'next', 'hidden'].indexOf(a) - ['open', 'next', 'hidden'].indexOf(b)).join(','),
        'and the three states are always in that order');
    }

    // ---- 8. THE EDGE MY CHANGE INVENTS: a legacy save with a stranded piece -
    // Every loadout written before #90 had all its sets reachable. Without the
    // loadout floor in openedSets, a weapon parked in set 3 sits in a cell the
    // player cannot see while still stamping their deck.
    const legacy = createLoadout(REG, 'reaver');
    legacy.sets.rightHand[2] = 'katana';
    eq(ladder({}, legacy), 'open,open,open', 'what you are already holding is by definition open');
    assert(carriedIds(legacy).includes('katana'), 'and it is still carried, in a cell you can now reach');

    // ---- 9. a rung with no slot fails LOUD and by name --------------------
    const bad = { ...REG, unlocks: [...REG.unlocks, { id: 'ghostRung', kind: SLOT_RUNG_KIND, ref: 'rihgtHand', name: 'x', condition: 'winRuns', param: 1, reveal: 'listed', hint: 'x' }] };
    const said = validateEquipment(bad).join(' | ');
    assert(said.includes('ghostRung') && said.includes('rihgtHand'),
      `a dangling rung names its own row and its bad ref — got: ${said || '(nothing)'}`);
    eq(validateEquipment(REG).join(' | '), '', 'and the shipped content is clean');

    // ---- 9b. …and the OTHER direction of the same join (Vira, at gate) ----
    // Too MANY rungs was checked; too FEW is the silent one. `talisman` declares
    // 3 sets, authors 0 rungs, derives 1 forever, and nothing goes red because
    // nothing goes wrong — the screen simply never draws them. Law 0 clause 5.
    // It is dormant only because talismans are unauthored, so the fixture gives
    // one a piece and watches the fuse blow. THE FIXTURE IS NO LONGER BUILT HERE
    // (#104): `REG_CHARM` at the top of this file is the one home for the woken
    // talisman, because 31e needs the identical row and two copies of a fixture
    // drift exactly like two copies of anything else.
    const talisman = eq_.slots.find((s) => s.id === 'talisman');
    assert(talisman && talisman.sets > 1, 'the fixture needs a wide, rung-less slot');
    eq(slotRungs(REG, 'talisman').length, 0, 'talisman authors no rungs today');
    eq(validateEquipment(REG).join(' | '), '', '…and is silent while nothing fits it');
    const withCharm = REG_CHARM;
    const fuse = validateEquipment(withCharm).join(' | ');
    assert(fuse.includes("'talisman'") && fuse.includes('3 sets') && fuse.includes('only 1 can ever open'),
      `the day a talisman exists, the unreachable sets are named — got: ${fuse || '(nothing)'}`);

    // ABSENT IS NOT ZERO. A registry with no unlocks table cannot answer this,
    // and a check that cannot know must say nothing rather than something false.
    const blind = { ...withCharm };
    delete blind.unlocks;
    eq(validateEquipment(blind).join(' | ').includes('can ever open'), false,
      'with no unlocks table the too-few check stays silent instead of condemning every slot');

    // ---- 10. no rung authored → no locked cell, so no reasonless refusal ---
    // refuses() errors on an empty reason, and the reason IS the rung's hint.
    // A slot with nothing to earn must therefore show no locked cell at all.
    const noRungs = { ...REG, unlocks: REG.unlocks.filter((u) => u.kind !== SLOT_RUNG_KIND) };
    const openedN = openedSets(noRungs, rightHand, { meta: {}, loadout: fresh });
    const visibleN = visibleSets(noRungs, rightHand, { meta: {}, loadout: fresh });
    eq(Array.from({ length: rightHand.sets }, (_, i) => setCellState(i, openedN, visibleN)).join(','),
      'open,hidden,hidden', 'with nothing to earn there is nothing to lock');
    eq(rungFor(REG, rightHand, 1).id, rungs[0].id, 'and the visible lock always has a rung to name');
  });

  test('31c. cycleSet refuses a set the ladder has not opened, and never strands a held one', () => {
    const rightHand = REG.equipment.slots.find((s) => s.id === 'rightHand');
    const rungs = slotRungs(REG, 'rightHand');
    assert(rungs.length >= 2, `the right hand has rungs (${rungs.length})`);

    // THE CAMP CONTEXT IS NOW DECLARED, NOT ASSUMED (#104). This block is about
    // the LADDER, and it always was at camp; `inCombat` became required on
    // cycleSet for the same reason it is required on equipPiece, so the blocks
    // that predate it say the thing they were silently relying on. The seal
    // itself is 31e's subject, on the one slot where asking is not vacuous —
    // `rightHand` is `swap=combat`, so nothing here could ever have caught it.
    // EDGE 1 — fresh profile. The defect: openedSets said 1, cycleSet took 3.
    const meta = { unlocked: [] };
    const fresh = createLoadout(REG, 'reaver');
    eq(openedSets(REG, rightHand, { meta, loadout: fresh }), 1, 'one set open on a fresh profile');
    const accepts = (m, lo) => [0, 1, 2].filter((i) => cycleSet(REG, structuredClone(lo), 'rightHand', i, { meta: m, ...AT_CAMP })).length;
    eq(accepts(meta, fresh), 1, 'and the mutation accepts exactly one — not the raw array width');

    // …and it is a GATE, not a blanket refusal: earning rungs opens indices.
    eq(accepts({ unlocked: [rungs[0].id] }, fresh), 2, 'one rung earned opens the second');
    eq(accepts({ unlocked: rungs.map((u) => u.id) }, fresh), 3, 'every rung earned opens them all');

    // EDGE 2 — HER edge, and the one that makes this not "just add a bound".
    // A save from before #90 has sets full-width with a piece already in the
    // last cell and no rungs earned. Over-tight strands that weapon behind a
    // lock that did not exist when the player put it there.
    const legacy = createLoadout(REG, 'reaver');
    legacy.sets.rightHand[2] = 'katana';
    const last = legacy.sets.rightHand.length - 1;
    eq(openedSets(REG, rightHand, { meta, loadout: legacy }), 3, 'a held piece raises the floor');
    assert(cycleSet(REG, legacy, 'rightHand', last, { meta, ...AT_CAMP }), 'and the mutation lets the player reach it');
    eq(legacy.active.rightHand, last, 'and it actually switched');

    // ONE TRUTH FUNCTION, TWO CONSUMERS — the whole point of the fix. Whatever
    // the screen would draw as `open`, the mutation accepts, and nothing else.
    for (const m of [{ unlocked: [] }, { unlocked: [rungs[0].id] }, { unlocked: rungs.map((u) => u.id) }]) {
      for (const lo of [fresh, legacy]) {
        const open = openedSets(REG, rightHand, { meta: m, loadout: lo });
        const drawn = [0, 1, 2].filter((i) => setCellState(i, open, open) === 'open').length;
        eq(accepts(m, lo), drawn, 'the cells drawn open and the indices accepted are the same set');
      }
    }

    // A stale call site fails CLOSED rather than skipping the check: the old
    // first argument was a loadout, so the slot cannot resolve.
    assert(!cycleSet(fresh, 'rightHand', 0, { meta, ...AT_CAMP }), 'the pre-#90 signature cycles nothing');
  });

  // ---- 31e. the swap rule is asked by the MUTATION, not only by its callers --
  test('31e. cycleSet asks the slot’s own swap rule, on the slot where asking is not vacuous', () => {
    // THE DEFECT THIS REPLACES WAS A VACUOUS TEST, NOT A MISSING ONE. `cycleSet`
    // had no `inCombat` in its signature at all, so `canSwap` was enforced by
    // both of its callers and by neither of them structurally — a second copy
    // fails by divergence, an unenforced gate fails by BYPASS, and only the
    // second was here. Every existing test of the function used `rightHand`,
    // which is `swap=combat`, where the missing gate cannot fail. Green over an
    // absent rule (`31c` above, and test 28's swap block) — the house shorthand
    // is *green wasn't clearance*, and this is that with a slot name on it.
    const slots = REG_CHARM.equipment.slots;
    const talisman = slots.find((s) => s.id === 'talisman');

    // ---- 0. the fixture IS the finding — state it before leaning on it -----
    assert(talisman && talisman.sets > 1 && talisman.swap !== 'combat',
      `the fixture needs a wide, SEALED slot — got sets=${talisman && talisman.sets}, swap=${talisman && talisman.swap}`);
    eq(slots.filter((s) => s.sets > 1 && s.swap !== 'combat').map((s) => s.id).join(','), 'talisman',
      'and it is the only one in the table, which is why one vacuous choice hid a whole gate');
    eq(slotRungs(REG_CHARM, 'talisman').length, 0, 'it authors no rungs, so the ladder alone opens exactly one cell');

    // A carried charm raises the ladder floor to 2 — `openedSets`' legacy path,
    // and the second way this test could have been vacuous: unless index 1 is
    // LADDER-OPEN, a refusal proves only that the ladder still works.
    const carried = createLoadout(REG_CHARM, 'reaver');
    carried.sets.talisman[1] = TEST_CHARM.id;
    eq(openedSets(REG_CHARM, talisman, { meta: {}, loadout: carried }), 2,
      'the carried charm opens the second cell, so the ladder is not what refuses below');

    // ---- 1. THE CONTROL, FIRST — a counted refusal is not a located one ----
    // The same call, the same index, the same loadout: accepted at camp. So
    // when it is refused mid-fight the only thing that changed is the fight.
    const atCamp = structuredClone(carried);
    assert(cycleSet(REG_CHARM, atCamp, 'talisman', 1, { meta: {}, ...AT_CAMP }),
      'at camp the carried charm can be made active');
    eq(atCamp.active.talisman, 1, 'and it actually moved');

    // ---- 2. THE DEFECT. Measured true at c392e13: this returned true --------
    const midFight = structuredClone(carried);
    eq(cycleSet(REG_CHARM, midFight, 'talisman', 1, { meta: {}, ...MID_FIGHT }), false,
      'a slot its own row seals may not be cycled mid-fight');
    eq(midFight.active.talisman, 0, 'and the refusal left the active set exactly as it was');

    // ---- 3. THE CAPABILITY THAT MUST SURVIVE -------------------------------
    // Sealing every slot would satisfy line 2 and delete a shipped, PRICED
    // mechanic (balance.equipment.swapCost, test 28). The cheap pass is refuse
    // everything, so the cheap pass is what this line makes red.
    const hands = createLoadout(REG_CHARM, 'reaver');
    hands.sets.rightHand[1] = 'greatsword';
    assert(cycleSet(REG_CHARM, hands, 'rightHand', 1, { meta: {}, ...MID_FIGHT }),
      'a slot its row calls combat-swappable still cycles mid-fight');
    eq(hands.active.rightHand, 1, 'and that one really moves');

    // ---- 4. THE INVARIANT, over every slot and both edges of the fight ------
    // Identity against `canSwap`'s own answer, never against a rule typed here:
    // the mutation accepts exactly what the truth function permits. A second
    // copy of `slot.swap !== 'combat'` written inside cycleSet would pass 1–3
    // and go wrong only once the two drifted; this is the line that makes that
    // unrepresentable, and it contains no sentence a player reads.
    let permitted = 0;
    for (const slot of slots) {
      for (const fight of [AT_CAMP, MID_FIGHT]) {
        const lo = createLoadout(REG_CHARM, 'reaver');   // index 0 is always ladder-open
        const allowed = canSwap(REG_CHARM, slot.id, fight).ok;
        eq(cycleSet(REG_CHARM, lo, slot.id, 0, { meta: {}, ...fight }), allowed,
          `${slot.id} @ inCombat=${fight.inCombat}: the mutation and canSwap agree`);
        if (allowed) permitted += 1;
      }
    }
    // THE POPULATION FLOOR, not just the findings floor: if the sweep ever saw
    // one answer repeated, the identity above would hold while proving nothing.
    assert(permitted > 0 && permitted < slots.length * 2,
      `the sweep saw BOTH answers, not one repeated (${permitted} permitted of ${slots.length * 2})`);

    // ---- 5. FAIL CLOSED — silence is not permission ------------------------
    // The reason `inCombat` is required rather than defaulted, and it is the
    // same reason equipPiece's is: a default of "not in combat" means every
    // call site written after today swaps a sealed slot by saying nothing.
    // The check is on the VALUE — `{ inCombat: undefined }` is what a caller
    // produces by forwarding a variable that was never set.
    const hush = console.error;
    const heard = [];
    console.error = (...a) => { heard.push(a.join(' ')); };
    let took = [];
    try {
      for (const ctx of [undefined, {}, { meta: {} }, { meta: {}, inCombat: undefined }, { meta: {}, inCombat: 'yes' }]) {
        const lo = structuredClone(carried);
        took.push(cycleSet(REG_CHARM, lo, 'talisman', 1, ctx));
        took.push(lo.active.talisman);
      }
    } finally { console.error = hush; }
    eq(took.join(','), 'false,0,false,0,false,0,false,0,false,0',
      'every under-specified context refuses AND mutates nothing');
    eq(heard.length, 5, 'and each one is named rather than swallowed');
    assert(heard.every((s) => s.includes('inCombat') && s.includes('talisman')),
      `…naming the slot and what it wanted — got: ${heard[0] || '(nothing)'}`);

    // ---- 6. THE BOUNDARY, asserted so it cannot be read as more than it is --
    // This closes the SEAL, not the PRICE. `swapCost` is charged in
    // doSwapArmament, outside this function, so a caller reaching cycleSet
    // directly still moves a combat-swappable slot for free. That is the next
    // act; line 3 above is the same call, and it is deliberately still true.
    eq(REG_CHARM.balance.equipment.swapCostKind, 'energy', 'the price is live and is energy');
    assert(REG_CHARM.balance.equipment.swapCost > 0,
      `…and it is a real number (${REG_CHARM.balance.equipment.swapCost}), which is what makes the remaining bypass worth an act`);
  });

  // ---- 31d. the inventory and its equipment actions stay live in combat ----
  test('31d. a fight permits item changes while active-set cycling keeps its slot rule', () => {
    // The latest owner ruling supersedes the old sealed-slot rule: carried
    // equipment may now move in, out, or between positions during combat. Set
    // cycling remains a separate per-slot capability governed by canSwap.
    const slots = (REG.equipment.slots || []);
    assert(slots.length > 0, 'the fixture has slots to examine');

    // ---- 1. both edges, over every slot, with the denominator asserted -----
    let changeable = 0;
    let cyclable = 0;
    for (const slot of slots) {
      eq(canEquip(REG, slot.id, { inCombat: false }).ok, true, `${slot.id}: at camp a set may be re-armed`);
      const combatChange = canEquip(REG, slot.id, { inCombat: true });
      eq(combatChange.ok, true, `${slot.id}: the authored combat rule permits item changes`);
      if (combatChange.ok) changeable += 1;
      if (canSwap(REG, slot.id, { inCombat: true }).ok) cyclable += 1;
    }
    eq(changeable, slots.length, 'every slot in the table was examined, not a lucky subset');
    // THE CAPABILITY THAT MUST SURVIVE, asserted as a floor rather than assumed:
    // if this ever reaches zero the priced swap has been deleted and test 28 is
    // passing over a mechanic no slot can use.
    assert(cyclable > 0, `at least one slot still cycles mid-fight (${cyclable} of ${slots.length})`);

    // ---- 2. the permission is on the mutation, not only on the screen ------
    const held = createLoadout(REG, 'reaver');
    assert(equipPiece(REG, held, 'rightHand', 0, 'dagger', OWNS_EVERYTHING, AT_CAMP), 'it goes in at camp');
    assert(equipPiece(REG, held, 'rightHand', 0, 'greatsword', OWNS_EVERYTHING, MID_FIGHT),
      'a piece you own and that fits can be equipped mid-fight');
    eq(held.sets.rightHand[0], 'greatsword', 'and the combat mutation reaches the selected position');

    // ---- 3. unequip is the same permitted combat action --------------------
    assert(equipPiece(REG, held, 'rightHand', 0, null, OWNS_EVERYTHING, MID_FIGHT),
      'a slot can be emptied mid-fight too');
    eq(held.sets.rightHand[0], null, 'the unequip leaves the selected position empty');

    // ---- 4. a call site that says nothing fails CLOSED --------------------
    // The reason the context is required rather than defaulted: a default of
    // "not in combat" makes silence mean permission.
    const quiet = console.error;
    let said = '';
    console.error = (...a) => { said = a.join(' '); };
    let took;
    try {
      took = equipPiece(REG, held, 'rightHand', 0, 'dagger', OWNS_EVERYTHING);
    } finally { console.error = quiet; }
    eq(took, false, 'no combat context → it equips nothing');
    assert(said.includes('inCombat') && said.includes('rightHand'),
      `…and says so, naming the slot and what it wanted — got: ${said || '(nothing)'}`);
    eq(held.sets.rightHand[0], null, 'and the loadout is untouched');

    // ---- 5. a slot the registries do not have is named, not guessed -------
    const ghost = canEquip(REG, 'rihgtHand', { inCombat: true });
    eq(ghost.ok, false, 'an unknown slot refuses');
    assert(ghost.reason.includes('rihgtHand'), `and prints the id it was given — got: ${ghost.reason}`);

    // ---- 5b. MAX EDGE: every owned, fitting piece remains actionable -------
    const pool = (REG.equipment.armaments || []).filter((p) => fitsSlot(REG.equipment.slots.find((s) => s.id === 'rightHand'), p));
    assert(pool.length > 1, `the right hand has a pool to sweep (${pool.length})`);
    let acceptedAll = 0;
    for (const piece of pool) {
      const combatProbe = createLoadout(REG, 'reaver');
      if (equipPiece(REG, combatProbe, 'rightHand', 0, piece.id, OWNS_EVERYTHING, MID_FIGHT)) acceptedAll += 1;
    }
    // The same sweep at camp is the control group. Requirements still apply,
    // so the property is parity between contexts rather than accepting every
    // fitting item regardless of the character's attributes.
    let tookAll = 0;
    for (const piece of pool) {
      const campProbe = createLoadout(REG, 'reaver');
      if (equipPiece(REG, campProbe, 'rightHand', 0, piece.id, OWNS_EVERYTHING, AT_CAMP)) tookAll += 1;
    }
    assert(tookAll > 0,
      `the requirement gate admits real pieces (${tookAll} of ${pool.length})`);
    eq(acceptedAll, tookAll,
      `combat admits the same ${tookAll} owned, fitting, requirement-valid pieces as camp`);

    // ---- 6. the data switch still closes the mutation when disabled --------
    const disabled = {
      ...REG,
      balance: { ...REG.balance, equipment: { ...REG.balance.equipment, allowChangesInCombat: false } },
    };
    eq(canEquip(disabled, 'rightHand', { inCombat: true }).ok, false,
      'the authored off value disables combat equipment changes');
    const disabledLoadout = createLoadout(disabled, 'reaver');
    assert(!equipPiece(disabled, disabledLoadout, 'rightHand', 0, 'dagger', OWNS_EVERYTHING, MID_FIGHT),
      'the mutation itself enforces the authored off value');

    // ---- 7. no context is permission --------------------------------------
    // The old signature defaulted inCombat to false, so a caller that said
    // nothing was told it may re-arm. Silence meaning permission is the whole
    // defect the required argument exists to close, and it was still sitting in
    // the truth function's own default.
    const hush = console.error;
    let heard = '';
    console.error = (...a) => { heard = a.join(' '); };
    let blind;
    let nulled;
    try {
      blind = canEquip(REG, 'rightHand');
      nulled = canEquip(REG, 'rightHand', { inCombat: null });
    } finally { console.error = hush; }
    eq(blind.ok, false, 'no context at all → refused');
    eq(nulled.ok, false, 'a null flag is not a false one → refused');
    assert(heard.includes('inCombat'), `and it names what it wanted — got: ${heard || '(nothing)'}`);

    // ---- 8. the VALUE is checked, not the key -----------------------------
    // `'inCombat' in ctx` answered whether the key was TYPED, so a forwarded
    // variable that was never set walked through. Both shapes below are what a
    // caller actually produces by accident.
    const hush2 = console.error;
    console.error = () => {};
    const shapes = [{}, { inCombat: undefined }, { inCombat: null }, { inCombat: 'yes' }, { inCombat: 0 }, null];
    let refusedShapes = 0;
    const shapeProbe = createLoadout(REG, 'reaver');
    try {
      for (const bad of shapes) {
        if (!equipPiece(REG, shapeProbe, 'rightHand', 0, 'dagger', OWNS_EVERYTHING, bad)) refusedShapes += 1;
      }
    } finally { console.error = hush2; }
    eq(refusedShapes, shapes.length, `every one of ${shapes.length} non-boolean contexts is refused`);
    eq(shapeProbe.sets.rightHand[0], 'straightSword', 'and none of them moved the authored starting piece');

    // WHICH LAYER REFUSED, and this assertion exists because the plant for it
    // stayed GREEN. `canEquip` also refuses a non-boolean, so with only the
    // count above, reverting equipPiece's check to `'inCombat' in ctx` changes
    // nothing a test can see — defence in depth hiding the removal of one of
    // its own layers. So the layer is named: equipPiece must refuse `undefined`
    // ITSELF, before it ever asks canEquip.
    const hush3 = console.error;
    let byWhom = '';
    console.error = (...a) => { byWhom = a.join(' '); };
    try {
      equipPiece(REG, shapeProbe, 'rightHand', 0, 'dagger', OWNS_EVERYTHING, { inCombat: undefined });
    } finally { console.error = hush3; }
    assert(byWhom.startsWith('equipPiece('),
      `the mutation refuses a typed-but-unset flag on its own, not by way of canEquip — got: ${byWhom || '(nothing)'}`);
    // The control group: the two REAL shapes still work, so the check above is
    // not green because everything refuses.
    assert(equipPiece(REG, shapeProbe, 'rightHand', 0, 'dagger', OWNS_EVERYTHING, { inCombat: false, attributes: REQUIREMENT_TEST_ATTRIBUTES }), 'a real false still equips');
    assert(equipPiece(REG, shapeProbe, 'rightHand', 1, 'dagger', OWNS_EVERYTHING, { inCombat: true, attributes: REQUIREMENT_TEST_ATTRIBUTES }), 'a real true equips when the authored combat rule is on');
  });

  // ---- 31c. the ladder gates the MUTATION, not just the screen ------------
  //
  // VIRA'S GATE OF #90, and her property in her words:
  //
  //     a set index the player may ACTIVATE must be one openedSets() calls open.
  //
  // It lands here rather than in tools/probes/ because she asked for exactly
  // that: *"whoever fixes it deletes this file in the same act, because a
  // property that lives beside the code that satisfies it is the second copy."*
  // Her probe found 6 of 13 pairs at c43c908; both of its edges are below, and
  // the third case (a rung actually earned) is mine — a bound that refuses
  // everything would have satisfied her edge 1 on its own.

  // ---- 32. no dead armaments (property, not a snapshot) --------------------
  test('32. no armament is strictly dominated by one of equal or lower rarity', () => {
    // Found by Vira, who read the shipped CSVs from the neighbouring worktree
    // and caught what every grammar test here missed: tests 27 and 28 check that
    // each mod PARSES and RESOLVES, and nothing checked whether an item was
    // worth picking up. A common battleaxe strictly beat an uncommon halberd at
    // identical cost — rarity lying to the player.
    //
    // Written as a PROPERTY over the relationship between items rather than an
    // assertion about any one of them, so it keeps working after every future
    // rebalance and catches the next dead item authored without noticing.
    //
    // The trap Vira hit and corrected before reporting: `cost` inverts. Paying
    // more is worse, and comparing it naively invents dominance that isn't there.
    const LOWER_IS_BETTER = new Set(['cost']);
    const RARITY = { common: 0, uncommon: 1, rare: 2 };

    const vec = (piece) => {
      const out = {};
      for (const raw of piece.mods) {
        const m = /^(\w+)\.(\w+)=([+-]?\d+)$/.exec(raw);
        if (!m) continue;
        const key = `${m[1]}.${m[2]}`;
        const n = Number(m[3]);
        out[key] = (out[key] || 0) + (LOWER_IS_BETTER.has(m[2]) ? -n : n);
      }
      return out;
    };

    const arms = REG.equipment.armaments;
    const dominated = [];
    for (const a of arms) {
      for (const b of arms) {
        if (a === b || a.kind !== b.kind) continue;
        // Profiles are mechanics, not flavour: a dagger's multi-hit carrier and
        // a bow's ranged carrier are not comparable to a plain blade by mods
        // alone. The old hand split accidentally kept those pairs apart; now
        // that every armament is side-neutral, the real mechanical boundary is
        // the three card profiles the piece selects.
        if (a.attackProfile !== b.attackProfile
          || a.guardProfile !== b.guardProfile
          || a.techniqueProfile !== b.techniqueProfile) continue;
        if (RARITY[b.rarity] > RARITY[a.rarity]) continue; // b must be as cheap or cheaper
        // NO tag exemption. I first wrote one — "a tag `a` carries that `b`
        // lacks is a reason to keep `a`" — reasoning that it should tighten the
        // day tags become mechanical. Vira argued the reverse and was right:
        //
        //   An invariant should be as strict as the current semantics allow,
        //   and loosened by evidence.
        //
        // Tags are read by two UI files and nothing else. An exemption granted
        // in anticipation of a feature nobody has built can only produce false
        // negatives — it spares items that nothing actually distinguishes, and
        // it fails by staying quiet, which is the same shape as every graceful
        // fallback that hid a defect here for months. Add the exemption back
        // the day a tag gates a mechanic, with a test proving that it does.
        const va = vec(a);
        const vb = vec(b);
        const keys = new Set([...Object.keys(va), ...Object.keys(vb)]);
        let better = false;
        let worseAnywhere = false;
        for (const k of keys) {
          const x = va[k] || 0;
          const y = vb[k] || 0;
          if (y > x) better = true;
          if (y < x) worseAnywhere = true;
        }
        if (better && !worseAnywhere) dominated.push(`${a.id} (${a.rarity}) < ${b.id} (${b.rarity})`);
      }
    }
    eq(dominated.join('; '), '', 'no armament is strictly dominated');

    // Guard on the premise, not the conclusion: this rule is strict BECAUSE
    // tags are cosmetic. If that stops being true, this assertion is where the
    // reasoning gets revisited rather than silently outliving its basis.
    const tagConsumers = ['src/ui/components/card.js', 'src/ui/screens/equipment.js'];
    eq(tagConsumers.length, 2, 'tags are still read by exactly the two UI files — if that changed, revisit the strictness above');
  });

  // ---- 33. rendered art cannot drift from the rows that produced it --------
  test('33. every armament and armour set has art rendered from its CURRENT row', () => {
    // Bjorn's gap, named from a codebase he'd never seen: a derived artifact
    // drifting from its source with nothing asserting between them. Add a
    // weapon, forget to re-render, and the game shows a stale image forever.
    // Same defect as a frame constant pointing at the wrong sprite for months.
    //
    // His pattern was "hash the source, stamp the hash into the artifact." One
    // change: the RENDERER records the fields it actually read, and this test
    // does the comparing. Stamping a hash in Blender would put the same hash
    // function in Python and in JS with nothing checking they agree — the very
    // defect being closed, in a smaller costume.
    //
    // Checks BOTH directions, which is the half that's easy to forget: a stale
    // render and an orphaned image are different bugs and only one of them is
    // visible in game.
    const manifest = artManifest;
    if (!manifest) {
      // Browser test page has no filesystem. Skipping loudly beats a green tick
      // that means nothing — the counter beside the quiet fallback.
      assert(true, 'SKIPPED (no filesystem): art provenance is checked in Node');
      return;
    }

    // '1.00' from the CSV cell and 1 from the compiler are the same value. But
    // a colour like '0E0A08' must never be coerced, so only compare as numbers
    // when BOTH sides parse cleanly.
    const same = (x, y) => {
      const a = Number(x);
      const b = Number(y);
      const numeric = String(x).trim() !== '' && String(y).trim() !== ''
        && Number.isFinite(a) && Number.isFinite(b)
        && /^-?\d*\.?\d+$/.test(String(x).trim()) && /^-?\d*\.?\d+$/.test(String(y).trim());
      return numeric ? a === b : String(x) === String(y);
    };
    const stale = [];
    const orphaned = [];

    for (const a of REG.equipment.armaments) {
      const entry = manifest.armaments[a.artKey || a.id];
      if (!entry) {
        stale.push(`${a.id}: no art rendered`);
        continue;
      }
      // Whatever the renderer recorded is what gets checked — add a field to
      // tools/equipment-blender.py and this widens on its own. Restating the
      // list here would put the same fact in Python and in JS with nothing
      // checking they agree: the defect this very test exists to catch.
      for (const f of Object.keys(entry.fields)) {
        // CSV coercion turns '1.00' into 1; compare as strings on both sides.
        if (!same(entry.fields[f], a[f])) {
          stale.push(`${a.id}.${f}: art has '${entry.fields[f]}', CSV says '${a[f]}'`);
        }
      }
    }
    for (const id of Object.keys(manifest.armaments)) {
      if (!REG.equipment.armaments.some((a) => a.id === id)) orphaned.push(`weapon_${id}`);
    }

    for (const o of REG.equipment.armour) {
      const key = `${o.classId}/${o.id}`;
      const entry = manifest.armour[key];
      if (!entry) {
        stale.push(`${key}: no art rendered`);
        continue;
      }
      for (const f of Object.keys(entry.fields)) {
        if (!same(entry.fields[f], o[f])) {
          stale.push(`${key}.${f}: art has '${entry.fields[f]}', CSV says '${o[f]}'`);
        }
      }
    }
    for (const key of Object.keys(manifest.armour)) {
      const [classId, id] = key.split('/');
      if (!REG.equipment.armour.some((o) => o.classId === classId && o.id === id)) {
        orphaned.push(`body_${classId}_${id}`);
      }
    }

    eq(stale.join('; '), '', 'no rendered art is stale — re-run tools/equipment-blender.py');
    eq(orphaned.join('; '), '', 'no rendered art is orphaned by a deleted row');

    // The manifest must also actually cover the content, or an empty file would
    // pass every assertion above by having nothing to disagree with.
    const authoredArtKeys = new Set(REG.equipment.armaments.map((a) => a.artKey || a.id));
    eq(Object.keys(manifest.armaments).length, authoredArtKeys.size, 'every distinct armament art key is covered');
    eq(Object.keys(manifest.armour).length, REG.equipment.armour.length, 'every armour set is covered');
  });

  // ---- 34. armour sets must be visibly distinct in the RENDER --------------
  test('34. armour sets of a class are perceptibly separated in the rendered image', () => {
    // Test 33 stayed green while EIGHT of twelve sets rendered pixel-identical.
    // It proved the renderer READ the palette values; it could not prove they
    // were applied. Bjorn's name for that shape is a hollow citation — a
    // reference asserting authority that points at nothing.
    //
    // So this asserts a property of the OUTPUT: Oklab distance measured from
    // rendered pixels by tools/palette-audit.py, in the same run that produced
    // them. Within a class the geometry is identical (one builder, N repaints),
    // so colour is the entire signal.
    if (!artManifest) {
      assert(true, 'SKIPPED (no filesystem): render distinctness is checked in Node');
      return;
    }
    const audit = artManifest.audit;
    assert(audit && audit.withinClassMin, 'the manifest carries a render audit — re-run tools/equipment-blender.py');

    // KNOWN LIMITATION, recorded rather than quietly carried: this measures the
    // mean of every opaque pixel, and all of a class's sets share unpainted
    // surfaces — the reaver's always-gold cape above all. That drags all four
    // means toward gold and washes out the surfaces actually under test. At
    // source, reaver default (hue 132.6deg) and warden (250.4deg) are 118deg
    // apart; this metric reports 1.6deg. The correct instrument is a masked
    // render showing only the repainted materials. Until then the number below
    // is a floor on a DILUTED quantity, which makes it conservative rather than
    // wrong — it can miss a real collision, it cannot invent one.
    //
    // Bjorn judged the pairs at in-game size and found hue, not total distance,
    // decides whether two sets read as two suits: dE 0.0381 at 1.8deg hue read
    // as one suit, while dE 0.0418 with a wide hue gap read as two. A scalar
    // floor is therefore gameable by darkening. His bracketed hue floor is
    // (5.9deg, 11.7deg], suggested 12deg, from two observations — not enough to
    // assert on, and not to be promoted into a check on this evidence.

    // THERE IS NO PERCEPTUAL THRESHOLD HERE, DELIBERATELY. This asserted an
    // Oklab floor of 0.02 until Bjorn retracted the evidence under it — and the
    // history is the useful part:
    //
    //   1. He judged three pairs by eye and bracketed a hue floor at (5.9, 11.7]
    //      degrees, suggesting 12.
    //   2. Vira warned hue is unstable at low chroma.
    //   3. He re-measured with controls. His own numbers did not reproduce: dE
    //      ~1.5x higher and the ORDERING INVERTED. He could not regenerate his
    //      published figures because he had not recorded his method.
    //
    // What survived is the QUANTITY, and it survived harder: re-measured, the
    // pair with the LARGEST dE (reaver default|oathsworn, 0.0665) is the one he
    // read as a single suit under two lights. Not a 10% gap with opposite
    // verdicts — a full inversion. So dE does not measure what we care about,
    // and hue is unstable exactly where our palettes live (starseer's default
    // sits at chroma 0.0241, below Vira's ~0.03 instability threshold, and is
    // the pair whose hue swung most between his two measurements).
    //
    // Asserting 0.02 now would encode a number whose evidence was withdrawn.
    // "A number without its method is an opinion with decimal places" (Bjorn).
    //
    // So this asserts only what is actually known: the ORIGINAL DEFECT, which
    // was eight sets rendering PIXEL-IDENTICAL. That is not a perceptual claim
    // and is not dressed as one.
    const IDENTICAL = 0.005; // not a JND — a "these are literally the same image" guard
    const identical = Object.entries(audit.withinClassMin)
      .filter(([, d]) => d < IDENTICAL)
      .map(([cls, d]) => `${cls}: ${d.toFixed(4)}`);
    eq(identical.join('; '), '', 'no class renders two of its armour sets as effectively the same image');

    // Coverage, or an empty audit passes by having nothing to disagree with —
    // which is exactly how the original defect survived.
    const classIds = [...new Set(REG.equipment.armour.map((o) => o.classId))];
    eq(Object.keys(audit.withinClassMin).length, classIds.length, 'every class was measured');

    // The ratio `tightestWithin / closestBetween` is NOT recorded here, and the
    // reason is worth keeping: Vira proposed it, I declined to assert it as an
    // unvalidated bar, and she then solved for its ceiling and found there
    // isn't one. An optimiser maximises it by painting all three classes the
    // same colour — driving the denominator to zero — then spreading each
    // class's sets freely. Unbounded, and satisfied by destroying the thing the
    // game needs.
    //
    // The flaw is the RATIO FORM, not the statistic: same-class and cross-class
    // pairs are discriminated through different channels (colour vs
    // silhouette), so they don't constrain each other, and putting them in a
    // ratio invents a relationship the optimiser then exploits. Cross-class
    // pair distance degenerates identically to centroid distance.
    //
    // Not even tracked. A number in the manifest is an invitation to assert it
    // later, and this one is malformed for every k.
  });

  test('35. accessibility defaults resolve from ONE home, and high contrast is on', () => {
    // Why a default deserves a test: this value lived in two places with
    // opposite spellings. `settings.js` declared `def: false`; `main.js` asked
    // `settings.highContrast === true`. Both meant "off", so they agreed — and
    // agreement is not synchronization. Flipping either one alone yields a game
    // whose Settings switch and whose actual palette disagree, and nothing here
    // would notice, because the disagreement is invisible until a human looks at
    // a screen and a switch at the same time.
    //
    // So this asserts the property rather than the value in one file: resolving
    // a default goes through `settingOn`, and `settingOn` against an EMPTY store
    // — exactly what a first-boot player has in sote_meta_v1 — answers true.
    eq(typeof settingOn, 'function', 'settingOn is exported for main.js to ask');
    eq(settingOn({}, 'highContrast'), true, 'first boot gets high contrast');
    eq(settingOn({ highContrast: false }, 'highContrast'), false, 'a player can turn it off');
    eq(settingOn({ highContrast: true }, 'highContrast'), true, 'and back on');

    // Both edges of the sparse store, and for a def:false row too — otherwise
    // this only proves the one polarity it was written for.
    eq(settingOn({}, 'colorblindSafe'), false, 'a def:false row still defaults off');
    eq(settingOn({ colorblindSafe: true }, 'colorblindSafe'), true, 'and can be turned on');

    // An unknown key must throw, not answer false: a silent false is how a
    // renamed setting becomes a quietly-disabled feature.
    let threw = false;
    try { settingOn({}, 'noSuchSetting'); } catch { threw = true; }
    eq(threw, true, 'an unknown settings key throws instead of defaulting');

    // What this does NOT check, said out loud: that main.js actually calls
    // settingOn (no DOM here, so applyDisplaySettings is unreachable from this
    // suite), and that the resulting palette clears WCAG. The second is measured
    // from rendered pixels by `node tools/contrast-audit.mjs --gate`.
  });

  // ---- 35a. Minimum tap size: one home, both edges, and bad data is loud ----
  //
  // Numbered 35a because it is the same subject as 35 — a default that must
  // resolve from ONE home — for the setting that gives the 44 in `--tap-floor`
  // a home at all. The headless half: the closed set, the sparse store, and
  // the refusal. The RENDERED half is `node tools/tapsize.mjs`, which is the
  // only thing that can say a control actually measured 24 device px, and this
  // test cannot and does not claim it.
  test('35a. the tap floor is one home, defaults to 44, and a bad stored value is refused by name', () => {
    const spec = REG.balance.ui.tapSize;

    // ONE HOME. The four sizes and the default are content, not code: the row
    // derives `choices` and `def` from here. If someone re-types them in
    // settings.js this test still passes — what it can prove is that the
    // content home exists, is the closed set the resolver enforces, and holds
    // the default the resolver returns.
    assert(Array.isArray(spec.sizes) && spec.sizes.length >= 2, 'balance.ui.tapSize.sizes is the closed set');
    eq(spec.def, 44, 'the default is 44 — today, to the pixel');
    eq(spec.sizes[0], Math.max(...spec.sizes), 'sizes are listed largest first (the order the chips draw)');
    eq(spec.def, Math.max(...spec.sizes), 'the default is the largest size — nobody who never opens it sees a pixel move');
    for (const s of spec.sizes) eq(Number.isFinite(s) && s > 0, true, `size ${s} is a positive number`);

    // EDGE 1 — the player who never touches it. An empty store is exactly what
    // a first-boot player has in sote_meta_v1.
    eq(resolveTapSize({}).px, 44, 'first boot gets 44');
    eq(resolveTapSize({}).bad, false, 'an absent key is not bad data — a sparse store is the normal state');
    eq(resolveTapSize(undefined).px, 44, 'no settings object at all still resolves');

    // EDGE 2 — every value in the closed set applies, including the smallest.
    for (const s of spec.sizes) {
      const r = resolveTapSize({ tapFloor: String(s) });
      eq(r.px, s, `chosen ${s} applies as ${s}`);
      eq(r.bad, false, `${s} is in the closed set`);
    }
    eq(resolveTapSize({ tapFloor: '24' }).px, 24, 'the bottom of the dial is a real value, not a clamp back to 44');

    // BAD DATA IS LOUD (Law 1 clause 5). A hand-edited save, an older build, a
    // restored profile from a tree with a different set. It renders the
    // default because it must render something — and it must NOT do that
    // silently, which is what `bad` exists to carry to both callers.
    for (const junk of ['32', '0', '-24', '44px', 'large', 'S', {}, [], true, NaN]) {
      const r = resolveTapSize({ tapFloor: junk });
      eq(r.px, 44, `junk ${JSON.stringify(junk)} still renders something`);
      eq(r.bad, true, `junk ${JSON.stringify(junk)} is reported as bad, not silently defaulted`);
    }
    // A NUMBER IS NOT JUNK, and I got that wrong on the first pass: I asserted
    // numeric 44 would be refused, and it is accepted, because the resolver
    // normalises with String() before testing membership. Accepting it is the
    // right behaviour and the comment was the defect — the chips write strings
    // into the store, but an older build or a hand-edited save can hold a
    // number, and 24 typed as a number is an unambiguous ask. Bad data is a
    // value OUTSIDE the set, never a value spelled in a different type.
    for (const s of spec.sizes) {
      const r = resolveTapSize({ tapFloor: s });
      eq(r.px, s, `numeric ${s} normalises to ${s}`);
      eq(r.bad, false, `numeric ${s} is not bad data`);
    }

    // THE PERCENTAGES ARE ONLY WHERE RESEARCH IS. WCAG 2.1 AAA (2.5.5) is
    // 44x44 and WCAG 2.2 AA (2.5.8) is 24x24; the sizes between them have no
    // measurement, and an interpolated statistic is a fabricated one.
    const rated = Object.keys(spec.missRate).map(Number).sort((a, b) => b - a);
    eq(rated.join(','), '44,24', 'exactly the two sizes with research carry a rate');
    for (const s of rated) assert(spec.sizes.includes(s), `a rate is only attached to a real size (${s})`);

    // What this does NOT check, said out loud: that main.js writes
    // `--tap-target` (no DOM here), that the stylesheet reads it, or that any
    // control rendered at any height. All three are `node tools/tapsize.mjs`.
  });

  // ---- 35b. SFX recipes are data, and a malformed recipe names itself (#46) -
  // Numbered 35b, not 36: run-node.mjs already prints 36–38, and a duplicated
  // test number is the two-homes defect its own comment warns about.
  test('35b. SFX recipes are content; a malformed recipe fails naming its id (#46)', () => {
    // The table itself: shipped, non-empty, carries the engine's fallback.
    const sfx = contentBundle.sfx;
    assert(sfx && typeof sfx === 'object', 'bundle carries sfx recipes');
    assert(Array.isArray(sfx.default) && sfx.default.length > 0, "the audible 'default' fallback exists");
    assert(Object.keys(sfx).length >= 17, `16 hook recipes + default expected, got ${Object.keys(sfx).length}`);

    // Green on the shipped table (also covered by 15; asserted here so this
    // test is readable alone).
    assert(validateContent(contentBundle).ok, 'shipped sfx table validates');

    // The known-bad corpus — each observed red at authoring time (2026-08-03)
    // before being seeded here (the instrument rule). Every failure must NAME
    // THE RECIPE in its path (Law 1 clause 5): a red that doesn't say which
    // entry broke hands Constantine a treasure hunt, not an error.
    const cases = [
      ['unknown layer kind', { hit: [{ kind: 'chirp', dur: 0.1 }] }, 'sfx.hit', "Unknown layer kind 'chirp'"],
      ['wave type outside the closed set', { buy: [{ kind: 'tone', type: 'pulse', freq: 700, dur: 0.16 }] }, 'sfx.buy', 'Expected one of'],
      ['non-number peak', { hit: [{ kind: 'noise', dur: 0.16, peak: 'loud' }] }, 'sfx.hit', 'Expected number'],
      ['undeclared field', { hit: [{ kind: 'noise', dur: 0.16, wobble: 3 }] }, 'sfx.hit', "Unknown field 'wobble'"],
      ['zero dur (ramp would throw)', { uiClick: [{ kind: 'tone', freq: 420, dur: 0 }] }, 'sfx.uiClick', 'finite number > 0'],
      ['negative peak', { heal: [{ kind: 'tone', freq: 480, dur: 0.4, peak: -0.3 }] }, 'sfx.heal', 'finite number > 0'],
      ['negative t0', { victory: [{ kind: 'tone', freq: 392, dur: 0.5, t0: -0.1 }] }, 'sfx.victory', "'t0' must be a finite number >= 0"],
      ['missing required freq', { shrine: [{ kind: 'tone', dur: 0.6 }] }, 'sfx.shrine', 'Missing required field'],
      ['empty recipe', { relic: [] }, 'sfx.relic', 'non-empty array'],
      ['recipe not an array', { flask: { kind: 'tone' } }, 'sfx.flask', 'non-empty array'],
      // Vira's gate finding: Infinity is typeof 'number' and Infinity > 0 is
      // true, so the first meaning layer passed it — inside the exact class
      // its comment claimed to reject. Finite is now part of the check.
      ['Infinity freq', { hit: [{ kind: 'tone', freq: Infinity, dur: 0.14 }] }, 'sfx.hit', 'finite'],
      ['Infinity dur', { buy: [{ kind: 'tone', freq: 700, dur: Infinity }] }, 'sfx.buy', 'finite'],
      ['Infinity t0', { heal: [{ kind: 'tone', freq: 480, dur: 0.4, t0: Infinity }] }, 'sfx.heal', 'finite'],
      ['-Infinity peak', { relic: [{ kind: 'tone', freq: 880, dur: 0.25, peak: -Infinity }] }, 'sfx.relic', 'finite'],
      ['NaN freq', { shrine: [{ kind: 'tone', freq: NaN, dur: 0.6 }] }, 'sfx.shrine', 'got NaN'],
    ];
    for (const [name, patch, wantPath, wantMsg] of cases) {
      const r = validateContent({ ...contentBundle, sfx: { ...sfx, ...patch } });
      assert(!r.ok, `known-bad '${name}' passed validation`);
      const hit = r.errors.find((e) => e.path.startsWith(wantPath) && e.msg.includes(wantMsg));
      assert(hit, `known-bad '${name}': no error at '${wantPath}*' mentioning '${wantMsg}' — got ${r.errors.slice(0, 3).map((e) => `${e.path}: ${e.msg}`).join(' | ')}`);
    }
    const noDefault = validateContent({ ...contentBundle, sfx: Object.fromEntries(Object.entries(sfx).filter(([k]) => k !== 'default')) });
    assert(!noDefault.ok && noDefault.errors.some((e) => e.path === 'sfx.default'), "removing 'default' is caught by name");

    // The tuning path this issue exists for: a value edit in the TABLE alone
    // reaches what the engine plays — no code path filters or copies it. The
    // engine spreads the layer into tone()/noise() (ui/audio.js synthSfx), so
    // data-side identity is the headless half of that claim.
    eq(sfx.hit.find((l) => l.kind === 'noise').peak, 0.5, "hit's peak lives in the table (was engine code at 70d35e2)");

    // Boundary, said out loud: no WebAudio here — nothing in this suite HEARS
    // a sound or proves synthSfx ran a layer. The runtime half is main.js's
    // boot banner (validation) plus an ear. Whether each cue still SERVES the
    // player at minute forty is Sunna's read, not this file's.
  });

  // ---- 35c. The silence word: deliberate quiet is typed, mistakes are named -
  // Word 3, under Sunna's lift condition: quiet must be a word a human typed
  // on purpose ('silence' as a context's whole bed value), and every
  // quiet-SHAPED mistake — null, [], {}, zero gain, wrong or miscased word,
  // empty variants — is a distinct error naming its entry. 35c beside 35b for
  // the same reason 35b sits beside 35: run-node.mjs owns 36–38.
  // ---- 35d. every id the game can COMPOSE resolves to a real sound (#66/D16)
  // Sunna's finding: #65 started playing `procBurst_${status}` and no recipe
  // answered, so bleed, frost AND insanity played the 440 Hz fallback blip
  // through a release candidate while the settings screen named sounds the
  // build did not make. This test is the composed half of the missing check —
  // driven off the CONTENT (every status with a proc block), so a fourth proc
  // status added by table alone is covered the day it is authored, not the day
  // someone remembers to extend this list.
  test('35d. composed sfx ids resolve to a real recipe; the family row covers unauthored statuses (#66)', () => {
    const procStatuses = contentBundle.statuses.filter((s) => s.proc).map((s) => s.id);
    assert(procStatuses.length >= 3, `expected the proc statuses to exist, got [${procStatuses.join(', ')}]`);

    // THE DEFECT ITSELF: every composed id ui/fx.js can emit must land on a
    // real row, never on `default`. Red on the pre-fix tree for all three.
    for (const id of procStatuses) {
      const r = resolveRecipe(`procBurst_${id}`);
      assert(!r.fellBack, `procBurst_${id} fell back to the default blip — no recipe answers it (matched '${r.matched}')`);
    }

    // The family row is what makes a new proc status safe by table alone
    // (Law 1 clause 3): an UNAUTHORED status still sounds like a burst.
    const novel = resolveRecipe('procBurst_noSuchStatusYet');
    assert(!novel.fellBack && novel.matched === 'procBurst', `an unauthored proc status must fall to the 'procBurst' family row, got '${novel.matched}'`);

    // Both edges of the resolver, so the scheme itself is pinned:
    eq(resolveRecipe('hit').matched, 'hit', 'a plain id matches its own row');
    eq(resolveRecipe('procBurst_frost').matched, 'procBurst_frost', 'an authored specific row wins over its family');
    assert(resolveRecipe('noSuchId').fellBack, 'a genuinely unknown id still reaches the audible default');
    assert(resolveRecipe('toString').fellBack, 'an inherited key is a missing entry, not a function');
    assert(resolveRecipe('_leading').fellBack, "a leading underscore names no family (indexOf('_') === 0)");

    // ORPHANS — the other direction of the same defect (D10). The table must
    // not promise a sound nothing plays: `bleedBurst` lost its caller when #65
    // renamed the event, `uiClick` never had one.
    for (const dead of ['bleedBurst', 'uiClick']) {
      assert(!Object.prototype.hasOwnProperty.call(SFX_RECIPES, dead), `'${dead}' is an orphan row — no call site fires it, so the settings screen promises a sound the build never makes`);
    }

    // Boundary, said out loud: this checks the ids the CONTENT can compose. A
    // static scan of every literal sfx.play('…') in src/ against this table —
    // the general "ids-played == ids-in-table, both directions" check — is the
    // follow-up card, and nothing here covers it.
  });

  test('35c. music beds validate; \'silence\' is the one word for deliberate quiet; quiet-shaped mistakes fail by name', () => {
    const m = contentBundle.music;
    assert(m && typeof m.beds === 'object' && !Array.isArray(m.beds) && typeof m.scales === 'object', 'bundle carries music { beds, scales }');
    assert(validateContent(contentBundle).ok, 'shipped music validates');

    // The word itself is legal at context level — a human typing
    // `credits: 'silence'` has made a decision, not a mistake.
    const silent = validateContent({ ...contentBundle, music: { scales: m.scales, beds: { ...m.beds, credits: 'silence' } } });
    assert(silent.ok, `explicit 'silence' must validate: ${silent.errors.slice(0, 2).map((e) => `${e.path}: ${e.msg}`).join(' | ')}`);

    // The known-bad corpus — each observed red at authoring time (2026-08-06)
    // before being seeded here (the instrument rule). Every red names its
    // entry, and the quiet-shaped ones point at the word.
    const cases = [
      ['null bed', { rest: null }, 'music.beds.rest', 'null is not silence'],
      ['wrong word', { rest: 'quiet' }, 'music.beds.rest', "The only word for deliberate quiet is 'silence'"],
      ['miscased word', { rest: 'Silence' }, 'music.beds.rest', "The only word for deliberate quiet is 'silence'"],
      ['empty array bed', { rest: [] }, 'music.beds.rest', 'not a bed and not silence'],
      ['empty object bed', { rest: {} }, 'music.beds.rest', 'Missing required field'],
      ['empty variants', { rest: { gain: 0.3, variants: [] } }, 'music.beds.rest', 'silence by accident'],
      ['zero gain', { rest: { gain: 0, variants: [{ root: 130, scale: 'calm', cadence: 3000 }] } }, 'music.beds.rest', 'silence spelled as a number'],
      ['dangling scale', { rest: { gain: 0.3, variants: [{ root: 130, scale: 'noSuchScale', cadence: 3000 }] } }, 'music.beds.rest', "unknown scale 'noSuchScale'"],
      ['Infinity root', { rest: { gain: 0.3, variants: [{ root: Infinity, scale: 'calm', cadence: 3000 }] } }, 'music.beds.rest', 'finite'],
      ['unknown bed field', { rest: { gain: 0.3, volume: 9, variants: [{ root: 130, scale: 'calm', cadence: 3000 }] } }, 'music.beds.rest', "Unknown field 'volume'"],
      // Vira's gate finding: 'lift' was missing from the sweep — a
      // validator-green lift: Infinity NaN'd the oscillator frequency at note
      // 1, lift: -3 read scale[-1] from step 1 (63/73 scheduled frequencies
      // non-finite, driven through the real engine). Her two fixtures, plus
      // the adjacent edges of the same class: a fractional stride reads
      // scale[4.5] (same NaN, friendlier number), and lift: 0 is falsy so the
      // engine would silently play stride 3 — a zero that means three is a
      // lie, not a value.
      ['Infinity lift', { rest: { gain: 0.3, variants: [{ root: 130, scale: 'calm', cadence: 3000, lift: Infinity }] } }, 'music.beds.rest', 'positive integer'],
      ['negative lift', { rest: { gain: 0.3, variants: [{ root: 130, scale: 'calm', cadence: 3000, lift: -3 }] } }, 'music.beds.rest', 'positive integer'],
      ['fractional lift', { rest: { gain: 0.3, variants: [{ root: 130, scale: 'calm', cadence: 3000, lift: 2.5 }] } }, 'music.beds.rest', 'positive integer'],
      ['zero lift', { rest: { gain: 0.3, variants: [{ root: 130, scale: 'calm', cadence: 3000, lift: 0 }] } }, 'music.beds.rest', 'positive integer'],
    ];
    for (const [name, patch, wantPath, wantMsg] of cases) {
      const r = validateContent({ ...contentBundle, music: { scales: m.scales, beds: { ...m.beds, ...patch } } });
      assert(!r.ok, `known-bad '${name}' passed validation`);
      const hit = r.errors.find((e) => e.path.startsWith(wantPath) && e.msg.includes(wantMsg));
      assert(hit, `known-bad '${name}': no error at '${wantPath}*' mentioning '${wantMsg}' — got ${r.errors.slice(0, 3).map((e) => `${e.path}: ${e.msg}`).join(' | ')}`);
    }
    const noScales = validateContent({ ...contentBundle, music: { beds: m.beds } });
    assert(!noScales.ok && noScales.errors.some((e) => e.path === 'music.scales'), 'a missing scales table is caught by name');

    // Boundary, said out loud: whether the engine actually STOPS the bed and
    // schedules nothing for a 'silence' context — and warns on an unknown one
    // — is runtime behaviour with WebAudio in it: tools/music-silence-probe.mjs
    // is the half that has run it, and nothing in this suite hears anything.
  });

  // 47, NOT 41 (Viki, resolving the merge). This branch was numbered 41 at
  // 77a02b9 and the harness has since grown a 41 of its own — the screen census.
  // Two lines printed `41.` with 60 green underneath, which is one id written
  // twice with nothing checking they agree, one level up from the code. 45 and
  // 46 are left for #102, which published them before this branch merges.
  // THE REAL DEFECT IS THAT THESE NUMBERS ARE AUTHORED AT ALL — engine.test.js
  // and run-node.mjs each type their own and nothing joins them. Named, not
  // fixed: a derived index is a tool change and this is a merge resolution.
  test('47. the Compendium withholds by ONE rule, and a planted row tells the rule from the table', () => {
    // Freja, the Compendium. The screen is a picture and this suite has never
    // seen one; what is testable here is the DECISION the picture obeys, and
    // that decision has one home — src/model/unlocks.js. The rendered half is
    // tools/release-shots.mjs (compendium-empty / compendium-held).
    // `owned` is the REAL ownership() handle, not a hand-built set. That is the
    // whole of Viki's merge ruling: possession has one home and this screen is a
    // reader of it. Building the sets here would re-create the second definition
    // the resolution removed, inside the test meant to prove it is gone.
    const ctx = (over = {}) => {
      const drops = { requireFound: true, reveal: 'teased', ...(over.drops || {}) };
      const reg = {
        balance: { equipment: { drops, persistence: over.persistence || 'both' } },
      };
      const meta = { unlocked: over.unlocked || [], found: over.available || [] };
      return {
        owned: ownership(reg, { meta, loadout: over.loadout || null }),
        unlockById: new Map((REG.unlocks || []).map((u) => [u.id, u])),
        drops,
      };
    };
    const dagger = REG.equipment.armaments.find((a) => a.id === 'dagger');
    assert(dagger, 'the dagger is still in the table');

    // BOTH EDGES OF THE SCREEN'S SUBJECT.
    // Empty: nothing found, so every armament is a shape and no name shows.
    const emptyStates = (REG.equipment.armaments || [])
      .map((a) => pieceReveal(a, ctx()).state);
    eq(emptyStates.filter((s) => s === 'held').length, 0, 'a fresh profile holds nothing');
    assert(emptyStates.every((s) => s === 'teased'),
      `a fresh profile shows only silhouettes — got ${[...new Set(emptyStates)].join(',')}`);
    // Full: everything found, so nothing is withheld and the grid is all lit.
    const allIds = (REG.equipment.armaments || []).map((a) => a.id);
    const fullStates = (REG.equipment.armaments || [])
      .map((a) => pieceReveal(a, ctx({ available: allIds })).state);
    assert(fullStates.every((s) => s === 'held'), 'with everything found nothing is withheld');
    // And the found gate is the ONLY thing between them.
    eq(pieceReveal(dagger, ctx({ drops: { requireFound: false } })).state, 'held',
      'requireFound:false is the sandbox — every armament is yours');

    // THE PLANTED ROWS. Not one armament in the shipped table carries an
    // `unlock`, so every condition branch below is unexercised by the data and
    // a rule that only ever sees found-gating is indistinguishable from
    // `return 'teased'`. Four rows in words the tables already have:
    const plant = [
      { id: 'p_hidden', kind: 'weapon', rarity: 'rare', unlock: 'ashChildUnlock' }, // reveal: hidden
      { id: 'p_listed', kind: 'weapon', rarity: 'common', unlock: 'winTwice' }, // reveal: listed
      { id: 'p_teased', kind: 'weapon', rarity: 'common', unlock: 'graveWardenUnlock' }, // reveal: teased
      { id: 'p_armour', kind: 'armor', rarity: 'common', unlock: '' }, // armour skips the found gate
    ];
    const st = (row, over) => pieceReveal(row, ctx(over)).state;
    eq(st(plant[0]), 'hidden', "a 'hidden' unlock is absent — a secret must not advertise its own hole");
    eq(st(plant[1]), 'listed', "a 'listed' unlock shows its name and why");
    eq(st(plant[2]), 'teased', "a 'teased' unlock shows the shape only");
    eq(st(plant[3]), 'held', 'armour is condition-gated, never found-gated');
    // Earned beats every reveal mode, including hidden.
    eq(st(plant[0], { unlocked: ['ashChildUnlock'], available: ['p_hidden'] }), 'held',
      'once earned, the secret is simply yours');
    // The unlock gate outranks the found gate: an unearned piece you somehow
    // hold is still not offered. Order matters and this is the case that shows it.
    eq(st(plant[1], { available: ['p_listed'] }), 'listed',
      'an unearned unlock wins over having found it');
    // The hint comes from the TABLE, never from this file.
    eq(pieceReveal(plant[1], ctx()).hint, 'Win two runs.', 'the hint is the unlock row\'s own words');
    eq(pieceReveal(dagger, ctx()).gate, 'unfound', 'the gate names why, so a screen picks its own sentence');

    // LAW 1 CLAUSE 5 — `reveal` has no schema, so a typo reaches the screen as a
    // live value. It must fail LOUD and degrade to the safe wrong answer:
    // 'listed' would publish a name that may be a secret, 'hidden' would delete
    // an entry in silence. 'teased' shows the shape and no identity.
    const errs = [];
    const realError = console.error;
    console.error = (...a) => errs.push(a.join(' '));
    let bad;
    try {
      bad = pieceReveal(dagger, ctx({ drops: { reveal: 'teasd' } })).state;
    } finally { console.error = realError; }
    eq(bad, 'teased', 'a bad reveal draws the shape, never the name and never nothing');
    assert(errs.some((e) => e.includes('teasd') && e.includes('balance.equipment.drops.reveal')),
      `the bad value and its home are both named — got ${JSON.stringify(errs)}`);
    assert(REVEAL_MODES.every((m) => PRESENT_STATES.includes(m)) && PRESENT_STATES.includes('held'),
      'the drawable states are the reveal modes plus held, and nothing else');

    // ONE HOME, and this is the assertion that keeps it one: `unlockView` and
    // the Compendium both route "hidden means absent" through revealState.
    // If a second copy is ever reintroduced, this and unlockView disagree first.
    eq(revealState('hidden', false), 'hidden', 'unearned obeys its mode');
    eq(revealState('hidden', true), 'held', 'earned outranks the mode');

    // ---- TWO AXES, ONE HOME EACH (Viki, resolving the #90 merge) ------------
    //
    // POSSESSION. `pieceReveal` must agree with `ownership().has` on every piece
    // and every persistence, because it no longer has its own opinion. This is
    // the assertion that goes red if the second definition ever comes back — and
    // 'perRun' is the value that made the old code and the model DISAGREE, not a
    // hypothetical: the branch read `meta.found` directly and the model does not.
    for (const persistence of ['both', 'unlocked', 'perRun']) {
      const c = ctx({ available: ['dagger'], persistence });
      for (const a of REG.equipment.armaments || []) {
        eq(pieceReveal(a, c).state === 'held', c.owned.has(a),
          `${a.id} at persistence '${persistence}': the screen and the model agree on what is yours`);
      }
    }
    // And they genuinely differ across that value, so the loop above is not
    // vacuously true for three copies of one case.
    eq(ctx({ available: ['dagger'], persistence: 'both' }).owned.has(dagger), true,
      "'both' counts the profile's found list");
    eq(ctx({ available: ['dagger'], persistence: 'perRun' }).owned.has(dagger), false,
      "'perRun' does not — the case the old Compendium got wrong");
    // FREJA'S NUMBER, PINNED. I called the divergence live; she measured that it
    // is TOTAL, not marginal — on a profile holding everything, at 'perRun', the
    // model says 0 of 24 held where the old screen drew 24. A difference of one
    // would still be a defect and would also be easy to argue away; this is the
    // whole screen, and the assertion says which.
    const allFound = (REG.equipment.armaments || []).map((a) => a.id);
    const heldAt = (persistence) => (REG.equipment.armaments || [])
      .filter((a) => pieceReveal(a, ctx({ available: allFound, persistence })).state === 'held').length;
    eq(heldAt('both'), (REG.equipment.armaments || []).length,
      'everything found, everything held — the denominator is the whole table');
    eq(heldAt('perRun'), 0,
      "at 'perRun' nothing off-run is yours — 0 of 24 against 24, total and not marginal");

    // DISCLOSURE. The join owns no condition of its own, so `gate` is exactly
    // what the model returned — never re-derived from `piece.kind`.
    for (const [row, want] of [[dagger, 'unfound'], [plant[1], 'unearned'], [plant[3], null]]) {
      eq(pieceReveal(row, ctx()).gate, ctx().owned.why(row),
        `${row.id}: the reason is READ from ownership(), not re-derived`);
      eq(pieceReveal(row, ctx()).gate, want, `${row.id} is withheld by ${want}`);
    }

    // DECLARED AND HANDLED. Every route the model can return has words. A route
    // with no sentence renders an empty reason — the quiet graceful failure.
    eq([...OWNERSHIP_GATES].sort().join(','), Object.keys(LOCK_COPY).sort().join(','),
      'every ownership gate has a sentence, and no sentence is orphaned');
    for (const g of OWNERSHIP_GATES) assert(LOCK_COPY[g] && LOCK_COPY[g].trim(), `${g} says something`);

    // BOUNDARY: this is the decision, not the drawing. Nothing here proves a
    // silhouette is visible against the panel, that the count reads as a promise
    // rather than a verdict, or that the screen fits a phone — Sunna gates the
    // read and Bjorn confirms the render. It also does not exercise the picker:
    // that both withheld states still show a REASON there (not a silhouette) is
    // a rendered fact, photographed, not asserted here.
  });

  test('48. a typed seed is refused by name, and the sentence cannot disagree with the alphabet', () => {
    // The defect: SEED_ALPHABET has no hyphen, seedFromString threw, and
    // main.js caught the throw and substituted Math.random() — so the tooltip
    // printed on the field ("the same seed gives the same map") was broken by
    // the line that hid the mistake. Six boots of one URL, six different maps.
    //
    // What is testable HERE is the vocabulary and the sentence. That the
    // refusal RENDERS, on three screens, is tools/seedrefuses.mjs, and a green
    // here is silent about it.

    // ONE PASS, TWO CALLERS. seedProblem() and seedFromString() are the same
    // scan, so the sentence a player reads at the field and the error the
    // engine throws are one string. Asserted exhaustively over ASCII plus the
    // shapes Marina measured, because "they agree today" is not the claim —
    // "they cannot disagree" is.
    let bothWays = 0;
    const sample = [];
    for (let c = 32; c <= 126; c++) sample.push(String.fromCharCode(c));
    sample.push('é', 'Å', 'ß', 'ö', '—', ' ');
    for (const ch of sample) {
      const why = seedProblem(ch);
      let threw = null;
      try { seedFromString(ch); } catch (e) { threw = e.message; }
      eq(threw, why, `${JSON.stringify(ch)}: the throw and the field's sentence are one string`);
      bothWays++;
    }
    assert(bothWays >= 100, `the join ran over a real sample (${bothWays})`);

    // MARINA'S MEASURED SET — every one of these silently rerolled at 346f4fa.
    for (const bad of ['MY-SEED', 'MY SEED', 'A_B', 'café', 'ELDEN!', '2026/08/08', 'ÅSA']) {
      const why = seedProblem(bad);
      assert(!!why, `${bad} is refused`);
      // Law 1 clause 5 — it NAMES the entry. The offending character is in the
      // sentence, quoted, not merely "invalid input".
      const offender = [...bad.toUpperCase()].find((ch) => why.includes(`“${ch}”`));
      assert(offender, `${bad}: the refusal names the character — got ${JSON.stringify(why)}`);
    }
    for (const good of ['ELDEN', 'elden', 'OO', 'GOLDBOUGH', 'SHOWCASE', '0', '']) {
      eq(seedProblem(good), null, `${JSON.stringify(good)} is a seed and is not refused`);
    }

    // THE SENTENCE IS DERIVED FROM THE ALPHABET, and this holds it to that.
    // Read the vocabulary the refusal CLAIMS, then check the code obeys its own
    // claim: every character in a claimed range is accepted, and every letter
    // the sentence says is folded actually folds. A prose copy of a closed set
    // is the second copy this refuses to become (Law 1 clause 2).
    const say = seedProblem('-');
    const ranges = [...say.matchAll(/([0-9A-Z])–([0-9A-Z])/g)];
    assert(ranges.length === 2, `the refusal states its ranges — got ${JSON.stringify(say)}`);
    let claimed = 0;
    for (const [, lo, hi] of ranges) {
      for (let c = lo.charCodeAt(0); c <= hi.charCodeAt(0); c++) {
        const ch = String.fromCharCode(c);
        eq(seedProblem(ch), null, `the sentence claims ${lo}–${hi}, so ${ch} must be accepted`);
        claimed++;
      }
    }
    eq(claimed, 36, 'the two claimed ranges cover 0–9 and A–Z');
    for (const [, typed, meant] of say.matchAll(/([0-9A-Z]) reads as ([0-9A-Z])/g)) {
      eq(seedFromString(typed), seedFromString(meant), `the sentence says ${typed} reads as ${meant}, and it does`);
    }

    // THE PROMISE, at the level this suite can see it: one seed, one number,
    // every time — and the header's round-trip lands back on the same map.
    for (const s of ['ELDEN', 'GOLDBOUGH', 'SHOWCASE']) {
      const n = seedFromString(s);
      eq(seedFromString(s), n, `${s} is one number every time`);
      eq(seedFromString(seedToString(n)), n, `${s} → header "${seedToString(n)}" → the same map`);
    }
    // …and BOTH EDGES of the vocabulary itself.
    eq(seedFromString(''), 0, 'empty edge: the empty string is zero, not a reroll');
    eq(seedToString(0), '0', '…and zero prints');
    const widest = 'ZZZZZZZZZZ'.slice(0, SEED_MAX_LEN);
    eq(seedFromString(widest), seedFromString(widest), `max edge: ${SEED_MAX_LEN} characters is deterministic`);
    assert(SEED_MAX_LEN > 0, 'the field bound has a home in rng.js, not in three markup strings');

    // BOUNDARY. This is the vocabulary and the sentence. It does NOT prove the
    // note renders, that BEGIN THE CLIMB refuses, that the refusal lets go
    // again, or that anything at all happens on the co-op wire — those are
    // tools/seedrefuses.mjs (rendered, three screens) and tools/lan.mjs's own
    // boundary check. It is also silent on `ß`, which upper-cases to `SS` and
    // is therefore accepted as two S's exactly as it always has been.
  });

  // ---- 49. every per-act plate the code can NAME is a file that exists ------
  test('49. every act plate the code names exists on disk, for every act it can reach', () => {
    // THE DEFECT THIS IS THE CLASS OF, and it lived for weeks:
    // `assets/map/parchment_act1.webp` never existed. Not a broken image, not a
    // console error, not a red check — a 404 that the fog renders as a flat wash,
    // on a screen that is almost entirely ground. Constantine asked for Elden
    // Ring's undiscovered map and got a dark rectangle, and every instrument in
    // this tree stayed green through it.
    //
    // WHY NOTHING CAUGHT IT, precisely, because the answer is the design of this
    // test. tools/bundle.mjs DOES refuse on a dangling asset path — but only a
    // LITERAL one, and its own comment says so: "Runtime-CONSTRUCTED paths
    // (`assets/equipment/weapon_${id}.webp`) can't be verified statically." The
    // plate path is built from `actPlate(actNumber, PARCHMENT_ACTS)`, so it is
    // exactly the shape that check cannot see. The gap was not an oversight in
    // the bundler; it was the bundler's stated boundary, unpaid.
    //
    // SO THE CHECK IS THE OTHER HALF: not "is this string in the source" but
    // "CALL the function and see if the file is there." Anything with a per-act
    // family and a count belongs in the table below, and adding a fourth act
    // plate stays a number in `balance.ui` — the loop reads the count, never a
    // list (Law 0 clause 1: the entry describes, the machinery derives).
    if (!assetExists) {
      // Browser test page has no filesystem — loud skip, same rule as test 33.
      assert(true, 'SKIPPED (no filesystem): act plates are checked in Node');
      return;
    }
    // ONE ROW PER FAMILY. `path` is the SHIPPED resolver, called — never a
    // second copy of its template, which would agree with itself while the game
    // looked somewhere else.
    const families = [
      { name: 'map parchment', plates: PARCHMENT_ACTS, path: (act) => parchmentAsset(act) },
      // The backdrop is bound through a CSS class rather than a path, so its
      // file name is reconstructed here — and that reconstruction is itself the
      // thing worth watching: if `.backdrop.act-N`'s url() ever stops being
      // `assets/bg/bg_actN.webp`, this row goes red and says which act.
      { name: 'combat backdrop', plates: BACKDROP_ACTS, path: (act) => `assets/bg/bg_act${actPlate(act, BACKDROP_ACTS)}.webp` },
    ];
    const missing = [];
    let checked = 0;
    for (const f of families) {
      assert(Number.isInteger(f.plates) && f.plates > 0, `${f.name}: its plate count is a positive integer (it is data, and data can be wrong)`);
      // BOTH EDGES OF THE CYCLE, not just acts 1..N. Endless Spire runs past act
      // 3 and `actPlate` wraps, so act N+1 must resolve to a real file too — the
      // wrap is the half a "check the three files" test would miss.
      for (let act = 1; act <= f.plates + 1; act++) {
        const p = f.path(act);
        checked++;
        if (!assetExists(p)) missing.push(`${f.name}, act ${act} → ${p}`);
      }
    }
    assert(checked > 0, 'the table is not empty — a loop over nothing is not a pass (SOP 2, the silence guard)');
    // Law 1 clause 5: it NAMES the entry. "some art is missing" would have been
    // as useless as the 404 was.
    eq(missing.join(' | '), '', `every named plate exists — missing: ${missing.join(' | ')}`);
    // And the extension has ONE home, so a hand-edit here cannot quietly fork it.
    assert(parchmentAsset(1).endsWith(PARCHMENT_EXT), `the plate path uses PARCHMENT_EXT (${PARCHMENT_EXT}) and not a second literal`);
    assert(typeof backdropClass(1) === 'string' && backdropClass(1).includes('act-'), 'the backdrop still binds by act class');

    // BOUNDARY. This proves the FILE IS THERE and nothing else: not that it
    // decodes, not that it is the right size, not that it looks like paper, and
    // not that the single-file build carries it — tools/bundle.mjs sweeps
    // assets/ wholesale for that, and `node tools/parchment.mjs --check` is what
    // says the plates are still what the generator makes.
  });

  test('49b. the run-shape knobs cap the act, move the roll, and refuse bad values by name', () => {
    // Constantine: "I only have the patience for 30 min runs. perhaps add an
    // advanced debug feature to limit the amount of max columns, rows, and or
    // columns with percent chance of certain nodes being more likely."
    //
    // THE ONE THING THIS TEST EXISTS FOR is the third knob. A weighting table
    // that is read and never changes what the generator produces would pass
    // every structural check in this file, so the assertion below is on the
    // POPULATION over a seed sweep, not on the table.
    const base = contentBundle.mapConfigs[1];

    // ---- the sweep's own referent. A sweep whose seeds collapse to one value
    // prints a flawless distribution of a single graph — it happened to
    // mapplan's first run (24 seeds, range 52-52). Prove the seeds differ
    // before believing anything measured with them.
    const seeds = new Set(Array.from({ length: 60 }, (_, i) => sweepSeed(i)));
    eq(seeds.size, 60, '60 sweep indices give 60 distinct seeds');
    assert(!seeds.has(sweepSeed(0) + 1) || sweepSeed(0) !== 0, 'index 0 is not seed 0');

    // ---- the caps SHORTEN, and the shortened act still resolves its own rules
    //
    // THE LENGTH IS ASKED FOR, NOT TYPED, and this line used to type it: a
    // literal `floors: 6` that was true only while the act's own rules happened
    // to resolve at 6. E13's rest-before-Elite promise moved the shortest
    // viable act from 4 to 7 — floors 3 and 4 are where a 12-floor act's
    // promised rest lands, and a 6-floor act has no floor free to hold one — so
    // the literal went red for a reason that was not a defect. Asking
    // `minViableFloors` keeps this a test of THE CAP BINDING, which is its
    // subject, and the boundary itself stays gated three lines below.
    const shortest = minViableFloors(base).floors;
    const capped = applyRunShape(base, { floors: shortest, columns: 4 }, MAP_SHAPE_LIMITS);
    eq(capped.errors.length, 0, `floors=${shortest} columns=4 resolves — ${JSON.stringify(capped.errors)}`);
    eq(capped.config.floors, shortest, 'the floors cap binds');
    eq(capped.config.columns, 4, 'the columns cap binds');
    // AND THE NUMBER ITSELF IS PINNED, because it is a COST the debug short-run
    // feature pays for the promise and it must not move again in silence.
    eq(shortest, 7, 'the shortest act these rules describe (was 4 before restBeforeElite)');
    const wide = sampleActShape(base, 60);
    const short = sampleActShape(capped.config, 60);
    assert(short.nodes.max < wide.nodes.min,
      `every capped act is smaller than every default act — ${short.nodes.min}-${short.nodes.max} vs ${wide.nodes.min}-${wide.nodes.max}`);

    // ---- BOTH EDGES of the caps. The low edge is DERIVED, so ask for it.
    const mv = minViableFloors(base);
    assert(mv.floors >= 2, `this act has a viable minimum length — ${JSON.stringify(mv)}`);
    eq(applyRunShape(base, { floors: mv.floors }, MAP_SHAPE_LIMITS).errors.length, 0,
      `${mv.floors} floors is accepted (it is the derived minimum)`);
    assert(applyRunShape(base, { floors: mv.floors - 1 }, MAP_SHAPE_LIMITS).errors.length > 0,
      `${mv.floors - 1} floors is refused (one below the derived minimum)`);
    // The high edge: a cap above the act is slack, not an error — and it says so.
    const slack = applyRunShape(base, { floors: base.floors + 5 }, MAP_SHAPE_LIMITS);
    eq(slack.errors.length, 0, 'a cap above the act is not an error');
    eq(slack.changed, false, '…and changes nothing');
    assert(slack.readout.some((l) => l.includes('NOT BINDING')), '…and the readout SAYS it did nothing');

    // ---- THE WEIGHTING KNOB ACTUALLY MOVES THE DISTRIBUTION.
    // Floors and columns held at the act's own values, so nothing but the
    // weight can be what moved the share. Both directions, on one sweep.
    const shareOf = (cfg, type) => {
      const s = sampleActShape(cfg, 60);
      const total = Object.values(s.byType).reduce((a, b) => a + b, 0);
      return (s.byType[type] || 0) / total;
    };
    const type = 'elite';
    const authored = base.typeWeights[type];
    const up = applyRunShape(base, { typeWeights: { [type]: MAP_SHAPE_LIMITS.maxWeight } }, MAP_SHAPE_LIMITS);
    const down = applyRunShape(base, { typeWeights: { [type]: 0 } }, MAP_SHAPE_LIMITS);
    eq(up.errors.length, 0, 'a maxed weight is accepted');
    eq(down.errors.length, 0, 'a zeroed weight is accepted');
    const sBase = shareOf(base, type);
    const sUp = shareOf(up.config, type);
    const sDown = shareOf(down.config, type);
    assert(sUp > sBase * 1.5,
      `${type} at weight ${MAP_SHAPE_LIMITS.maxWeight} is markedly more common than at ${authored} — ${(sBase * 100).toFixed(1)}% → ${(sUp * 100).toFixed(1)}%`);
    assert(sDown < sBase,
      `${type} at weight 0 is rarer than at ${authored} — ${(sBase * 100).toFixed(1)}% → ${(sDown * 100).toFixed(1)}%`);

    // …AND A WEIGHT OF ZERO THAT DOES NOT REACH ZERO SAYS SO. This assertion is
    // here because the first version of this test claimed `sDown === 0` and was
    // WRONG: `minElites: 2` is a hard promise mapgen keeps by force-placing, so
    // Elite at weight 0 still lands two a map. Correct behaviour that looks
    // exactly like an ignored knob — Law 0 clause 5 — so the resolver names it.
    assert(sDown > 0, `${type} is force-placed by minElites even at weight 0 — ${(sDown * 100).toFixed(1)}%`);
    // Asserted on `notes`, not on `readout`: notes are the subset the SCREEN
    // prints, so this holds the caveat to reaching a player and not merely to
    // existing in a tool's output.
    assert(down.notes.some((l) => l.toLowerCase().includes(type) && l.includes('force-placed')),
      `…and the note the screen prints says so — got ${JSON.stringify(down.notes)}`);

    // A type nothing forces DOES reach zero, which is what makes the sentence
    // above a real distinction rather than an excuse for a knob that half works.
    const free = 'event';
    const zeroed = applyRunShape(base, { typeWeights: { [free]: 0 } }, MAP_SHAPE_LIMITS);
    eq(zeroed.errors.length, 0, `${free} at 0 is accepted`);
    eq(shareOf(zeroed.config, free), 0, `${free} at weight 0 never appears — nothing forces it`);
    assert(shareOf(base, free) > 0, `…and it is common at its authored weight ${base.typeWeights[free]}`);

    // ---- BAD DATA FAILS LOUD AND NAMES THE ENTRY (Law 1 clause 5).
    const named = (entry, needle) => {
      const r = applyRunShape(base, entry, MAP_SHAPE_LIMITS);
      assert(r.errors.length > 0, `${JSON.stringify(entry)} is refused`);
      const text = r.errors.map((e) => `${e.key}: ${e.msg}`).join(' · ');
      assert(text.toLowerCase().includes(needle.toLowerCase()),
        `…and the refusal says ${JSON.stringify(needle)} — got ${JSON.stringify(text)}`);
      // A refused shape never half-applies: the act comes back untouched.
      eq(r.config, base, `…and ${JSON.stringify(entry)} left the act unchanged`);
    };
    named({ columns: 1 }, 'corridor');
    named({ columns: MAP_SHAPE_LIMITS.minColumns - 1 }, 'is below');
    named({ floors: 0 }, 'is below');
    named({ floors: 8.5 }, 'whole number');
    named({ typeWeights: Object.fromEntries(Object.keys(base.typeWeights).map((k) => [k, 0])) }, 'every weight is zero');
    named({ typeWeights: { notAType: 10 } }, 'is not a node type');
    named({ typeWeights: { [type]: -1 } }, 'weight of 0 or more');
    named({ typeWeights: { [type]: MAP_SHAPE_LIMITS.maxWeight + 1 } }, 'is above the');
    named({ rows: 8 }, 'is not a run-shape knob');
    named('eight floors', 'must be an object');

    // ---- THE KNOBS ARE DERIVED FROM CONTENT, not typed on the screen.
    // The screen builds one weight slider per key of `typeWeights`; this is the
    // property that makes that true, and it is Law 0's falsifier for this
    // feature: add a node type to the act and a knob appears with no UI edit.
    for (const key of Object.keys(base.typeWeights)) {
      eq(applyRunShape(base, { typeWeights: { [key]: 30 } }, MAP_SHAPE_LIMITS).errors.length, 0,
        `'${key}' is a knob because the act rolls it`);
    }
    eq(MAP_SHAPE_KEYS.length, 3, 'three knobs, and the set is closed');

    // ---- A HOSTILE SHAPE KEEPS BOTH PROMISES AT ONCE. Codex's repro on #562,
    // and it went red before the fix: the shortest act with Event at 100 and
    // every other weight 0 fills the one rest floor with Events, so a rest
    // force-place that only ate Monsters could not run — and the code then
    // returned without placing Elites, shipping a map with ZERO against an act
    // promising 2, which applyRunShape PRINTS to the player as force-placed.
    // Neither promise may break the other quietly, so both are asserted here.
    const hostile = applyRunShape(
      base,
      { floors: shortest, typeWeights: { monster: 0, event: 100, shrine: 0, elite: 0, merchant: 0 } },
      MAP_SHAPE_LIMITS,
    );
    eq(hostile.errors.length, 0, `the hostile shape is accepted — ${JSON.stringify(hostile.errors)}`);
    const hostilePlan = resolveFloorPlan(hostile.config).plan;
    for (let s2 = 0; s2 < 12; s2++) {
      const g = generateActMap({ config: hostile.config, rng: createRng(sweepSeed(s2)) });
      const all = Object.values(g.nodes);
      const elites = all.filter((n) => n.type === 'elite');
      assert(elites.length >= hostilePlan.minElites,
        `hostile shape seed ${s2}: ${elites.length} elites against a promised ${hostilePlan.minElites}`);
      const first = Math.min(...elites.map((n) => n.floor));
      assert(all.some((n) => n.type === 'shrine' && n.floor < first),
        `hostile shape seed ${s2}: elite on floor ${first} with no rest below it`);
    }

    // ---- AN ELITE THAT NEVER TOUCHES THE RELAX PATH STILL GETS ITS REST.
    // The promise was enforced inside relaxPlace, which runs only when the
    // rolls left the act short of minElites — so a FIXED Elite rank (typeOnce
    // assigns it before any rule runs) that satisfies the count on its own
    // meant the rest was never forced. Measured at 10 of 40 maps breaking the
    // promise before the fix, 0 of 40 after, which is why the guarantee is now
    // a final step on every exit rather than one branch of the generator.
    const fixedElite = { ...base, floorRules: { ...base.floorRules, minElites: 1,
      fixed: [{ at: 'first', type: 'monster' }, { at: 'floor', index: 6, type: 'elite' }] } };
    const fePlan = resolveFloorPlan(fixedElite);
    eq(fePlan.errors.length, 0, `a fixed Elite with rest floors beneath it resolves — ${JSON.stringify(fePlan.errors)}`);
    for (let s2 = 0; s2 < 40; s2++) {
      const all = Object.values(generateActMap({ config: fixedElite, rng: createRng(sweepSeed(s2)) }).nodes);
      const firstElite = Math.min(...all.filter((n) => n.type === 'elite').map((n) => n.floor));
      assert(all.some((n) => n.type === 'shrine' && n.floor < firstElite),
        `fixed-elite act seed ${s2}: elite on floor ${firstElite} with no rest below it`);
    }
    // AND THE ONE ARRANGEMENT THE GENERATOR CANNOT FIX IS REFUSED BY NAME: a
    // fixed Elite with no floor beneath it able to hold a rest.
    const feBad = resolveFloorPlan({ ...base, floorRules: { ...base.floorRules,
      fixed: [{ at: 'first', type: 'elite' }, { at: 'fraction', of: 0.64, type: 'treasure' }] } });
    assert(feBad.errors.some((e) => e.key === 'floorRules.fixed' && /restBeforeElite/.test(e.msg)),
      `a fixed Elite on floor 1 is refused and named — got ${JSON.stringify(feBad.errors)}`);

    // ---- THE REST IS NOT PAID FOR OUT OF ANOTHER PROMISE. Codex's P2 on #566.
    // ensureRestBeforeElite runs AFTER both relaxPlace calls, so a node it eats
    // is never counted again — and the first cut ate any node on the rest
    // floors, the act's last Merchant included. This act's rest floors can hold
    // no Monster (two non-Monster types alternate under the no-repeat ban, so
    // the Monster fallback never fires there), which forces that branch on
    // every seed. Both minima must survive it.
    // minMerchants 2, not 1: at 1 the victim is only ever the act's LAST
    // Merchant on a narrow conjunction and the case hides — this test passed
    // against the unfixed code until the config was corrected. At 2 the
    // pre-fix branch breaks the count in 19 of these 40 maps.
    const restVictim = { ...base, pathCount: 1, columns: 2, floors: 8,
      typeWeights: { monster: 0, event: 40, shrine: 0, elite: 0, merchant: 60 },
      floorRules: { minElites: 1, minMerchants: 2, restBeforeElite: true,
        noShrineBefore: { at: 'floor', index: 3 }, noEliteBefore: { at: 'floor', index: 4 },
        noShrineOn: { at: 'last' },
        fixed: [{ at: 'first', type: 'monster' }, { at: 'floor', index: 5, type: 'elite' }] } };
    const rvPlan = resolveFloorPlan(restVictim).plan;
    assert(rvPlan != null, 'the rest-victim act resolves');
    for (let s2 = 0; s2 < 30; s2++) {
      const all = Object.values(generateActMap({ config: restVictim, rng: createRng(sweepSeed(s2)) }).nodes);
      assert(all.filter((n) => n.type === 'merchant').length >= rvPlan.minMerchants,
        `rest-victim seed ${s2}: the forced rest ate the act's last Merchant`);
      assert(all.filter((n) => n.type === 'elite').length >= rvPlan.minElites,
        `rest-victim seed ${s2}: elites below the promised minimum`);
      const elites = all.filter((n) => n.type === 'elite').map((n) => n.floor);
      assert(all.some((n) => n.type === 'shrine' && n.floor < Math.min(...elites)),
        `rest-victim seed ${s2}: no rest below the first elite`);
    }

    // ---- AND IT DOES NOT BREAK A MINIMUM THAT WOULD OTHERWISE HOLD. Codex's
    // second P2. The differential is the assertion: the SAME act with the rule
    // off keeps its Merchants, so any shortfall with it on is caused by the
    // rest. This act has no Monster anywhere — every node is Event or Merchant
    // under the no-repeat ban — so `relaxPlace` has nothing to convert and the
    // restore has to find a donor. Before the donor fallback: seeds 1, 2, 4, 7
    // and 9 lost a Merchant here.
    const noMonster = (restBeforeElite) => ({ ...base, pathCount: 1, columns: 2, floors: 7,
      typeWeights: { monster: 0, event: 20, shrine: 0, elite: 0, merchant: 80 },
      floorRules: { minElites: 1, minMerchants: 2, restBeforeElite,
        noShrineBefore: { at: 'floor', index: 3 }, noEliteBefore: { at: 'floor', index: 4 },
        noShrineOn: { at: 'last' },
        fixed: [{ at: 'first', type: 'merchant' }, { at: 'floor', index: 5, type: 'elite' }] } });
    const nmOn = noMonster(true), nmOff = noMonster(false);
    assert(resolveFloorPlan(nmOn).errors.length === 0, 'the no-monster act resolves');
    for (let s2 = 0; s2 < 12; s2++) {
      const count = (cfg) => Object.values(generateActMap({ config: cfg, rng: createRng(sweepSeed(s2)) }).nodes)
        .filter((n) => n.type === 'merchant').length;
      const off = count(nmOff);
      if (off < 2) continue; // the act could not hold two either way — not this rule's doing
      assert(count(nmOn) >= 2,
        `no-monster act seed ${s2}: the forced rest cost a Merchant the same act keeps without it (off ${off})`);
    }

    // ---- A SURPLUS SHRINE IS A LEGITIMATE DONOR. Codex's third P2. Excluding
    // every Shrine from the donor pool took the deliberate short while a safe
    // one sat on the map: seed 67 here came out 3 Merchants + 3 Shrines against
    // 4 Merchants with the rule off, and the third Shrine was surplus to both
    // the rest and the pre-boss promise. The differential is the assertion —
    // the same act without the rule keeps its Merchants, so a shortfall here
    // can only be this rule's doing.
    const surplus = (restBeforeElite) => ({ ...base, pathCount: 1, columns: 2, floors: 8,
      typeWeights: { monster: 0, event: 0, shrine: 40, elite: 0, merchant: 80 },
      floorRules: { minElites: 1, minMerchants: 4, restBeforeElite,
        noShrineBefore: { at: 'floor', index: 2 }, noEliteBefore: { at: 'floor', index: 3 },
        noShrineOn: { at: 'last' },
        fixed: [{ at: 'first', type: 'event' }, { at: 'floor', index: 3, type: 'elite' }] } });
    assert(resolveFloorPlan(surplus(true)).errors.length === 0, 'the surplus-shrine act resolves');
    for (const s2 of [67, 3, 11, 24]) {
      const count = (cfg) => Object.values(generateActMap({ config: cfg, rng: createRng(sweepSeed(s2)) }).nodes)
        .filter((n) => n.type === 'merchant').length;
      const off = count(surplus(false));
      if (off < 4) continue; // the act could not hold four either way
      eq(count(surplus(true)), off,
        `surplus-shrine act seed ${s2}: the rest cost a Merchant a spare Shrine could have paid for`);
    }

    // ---- IT REACHES THE GAME. The one act-boot path applies it, an absent
    // shape leaves every existing seed byte-for-byte identical, and a shaped
    // run is flagged out of win-rate telemetry.
    const reg = createRegistries(contentBundle);
    const graphOf = (shape) => JSON.stringify(buildActMap(reg, createRng(0x715e), 1, shape));
    eq(graphOf(null), graphOf(undefined), 'no shape and an absent shape are the same run');
    // `shortest`, not a literal, for the same reason as above: this call really
    // does build a map, so it must name a length this act's own rules resolve.
    assert(graphOf(null) !== graphOf({ floors: shortest }), 'a shape reaches the generator through buildActMap');
    let threw = null;
    try { buildActMap(reg, createRng(1), 1, { columns: 1 }); } catch (e) { threw = e.message; }
    assert(threw && threw.includes('corridor'), `a bad shape throws at act boot and names the knob — got ${threw}`);
    assert(isCustomRun({ mapShape: { floors: 6 } }), 'a shaped run is kept out of win-rate stats');
    assert(!isCustomRun({ ascension: 0, mods: {}, deckMode: 'standard' }), '…and an unshaped one is not');

    // IT SURVIVES A SAVE. The shape rides on `run.custom`, so a resumed short
    // run stays short and act 2 is generated at the shape act 1 was — the claim
    // buildActMap's header makes, asserted rather than assumed.
    const saved = createRunState({ seed: 1, classId: 'reaver', registries: reg });
    saved.custom = { ascension: 0, mods: {}, deckMode: 'standard', mapShape: { floors: 6, columns: 4 } };
    const revived = JSON.parse(serializeRun(saved));
    eq(JSON.stringify(revived.custom.mapShape), JSON.stringify({ floors: 6, columns: 4 }),
      'the run shape round-trips through the save');

    // BOUNDARY. This is the generator and the resolver. It proves NOTHING about
    // the screen: that the panel opens, that the sliders reach 44 device px,
    // that the live readout prints the same number this sampler returns, or
    // that a phone can scroll it in one axis. Those are rendered facts —
    // tools/tapsize.mjs, tools/axisfit.mjs and a photograph, not this file.
    // It is also silent on MINUTES: node count is the driver of run length and
    // nothing in this tree can measure a clock.
  });

  // ---- 50. Phase 1 attributes are authored data, not engine defaults --------
  test('50. five-stat creation vocabulary and class presets come from one complete content product', () => {
    assert(Array.isArray(contentBundle.attributes), 'attribute definitions are a content table');
    assert(Array.isArray(contentBundle.creationModes), 'creation modes are a content table');
    assert(contentBundle.attributeRules && typeof contentBundle.attributeRules === 'object', 'attribute creation rules are content');
    const attrs = contentBundle.attributes.slice().sort((a, b) => a.order - b.order);
    const modes = contentBundle.creationModes;
    const classes = contentBundle.classes;
    eq(attrs.map((a) => a.id).join(','), 'strength,dexterity,constitution,wisdom,intelligence', 'the five stable ids ship in authored order');
    eq(attrs.map((a) => a.shortLabel).join(','), 'STR,DEX,CON,WIS,INT', 'all five short labels ship from the same rows');
    const standard = contentBundle.creationModes.find((m) => m.id === contentBundle.attributeRules.defaultMode);
    assert(!!standard, 'the default mode resolves');
    eq(standard.id, 'tuned', 'new runs select the save-safe tuned mode');
    eq(`${standard.baseline}/${standard.bonusPool}/${standard.minimum}/${standard.maximum}`, '10/3/8/15', 'tuned creation bounds author the fixed total of 53');
    eq(classes.length, 4, 'four playable classes participate in the creation product');
    eq(classes.map((c) => c.id).join(','), 'reaver,starseer,rogue,herald', 'the creation product includes Rogue in authored order');
    eq(
      classes.map((c) => attrs.map((a) => contentBundle.attributeRules.presets.standard[c.id][a.id]).join('/')).join('|'),
      '13/10/12/10/10|10/11/10/10/14|10/15/10/10/10|10/10/12/13/10',
      'all four standard class presets are exact in the authored attribute order'
    );
    eq(
      classes.map((c) => attrs.map((a) => contentBundle.attributeRules.presets.tuned[c.id][a.id]).join('/')).join('|'),
      '13/11/11/8/10|11/11/8/13/10|11/13/10/9/10|12/11/8/12/10',
      'all four tuned class presets are exact in the authored attribute order'
    );

    // The product is derived from its three axes. This is not a fixed-class
    // snapshot: every mode/class/stat cell in whatever content ships is walked.
    let cells = 0;
    for (const mode of modes) {
      const expectedTotal = mode.baseline * attrs.length + mode.bonusPool;
      for (const cls of classes) {
        const preset = contentBundle.attributeRules.presets[mode.id][cls.id];
        eq(Object.keys(preset).sort().join(','), attrs.map((a) => a.id).sort().join(','), `${mode.id}/${cls.id} has exactly the authored stat vocabulary`);
        eq(attrs.reduce((sum, a) => sum + preset[a.id], 0), expectedTotal, `${mode.id}/${cls.id} total derives from baseline × count + pool`);
        for (const attr of attrs) {
          assert(Number.isInteger(preset[attr.id]) && preset[attr.id] >= mode.minimum && preset[attr.id] <= mode.maximum, `${mode.id}/${cls.id}/${attr.id} is an in-range integer`);
          cells++;
        }
      }
    }
    eq(cells, modes.length * classes.length * attrs.length, 'the complete mode × class × stat product was checked');

    const clone = () => ({
      ...contentBundle,
      attributes: structuredClone(contentBundle.attributes),
      creationModes: structuredClone(contentBundle.creationModes),
      attributeRules: structuredClone(contentBundle.attributeRules),
    });
    const rejected = (mutate, path, label) => {
      const b = clone(); mutate(b);
      const v = validateContent(b);
      assert(!v.ok && v.errors.some((e) => e.path.includes(path)), `${label} is refused and names ${path}`);
    };
    rejected((b) => { delete b.attributes[0].id; }, 'attributes', 'missing attribute id');
    rejected((b) => { b.attributes[1].id = b.attributes[0].id; }, 'attributes', 'duplicate attribute id');
    rejected((b) => { delete b.attributes[0].order; }, 'attributes', 'missing order');
    rejected((b) => { b.attributes[1].order = b.attributes[0].order; }, 'order', 'duplicate order');
    rejected((b) => { b.attributes[0].order = 1.5; }, 'order', 'fractional order');
    rejected((b) => { b.attributes[0].order = -1; }, 'order', 'negative order');
    rejected((b) => { b.attributes[0].order = Number.NaN; }, 'order', 'NaN order');
    rejected((b) => { b.attributes[0].unknown = true; }, 'unknown', 'unknown attribute field');
    rejected((b) => { b.creationModes.push({ ...b.creationModes[0] }); }, 'creationModes', 'duplicate creation mode id');
    rejected((b) => { b.creationModes[0].unknown = true; }, 'unknown', 'unknown creation mode field');
    rejected((b) => { b.creationModes[0].minimum = b.creationModes[0].baseline + 1; }, 'creationModes', 'minimum above baseline');
    rejected((b) => { b.creationModes[0].maximum = b.creationModes[0].baseline - 1; }, 'creationModes', 'baseline above maximum');
    rejected((b) => { b.creationModes[0].bonusPool = -1; }, 'bonusPool', 'negative bonus pool');
    rejected((b) => { b.creationModes[0].equipmentProfiles.ghost = { baseValue: -6 }; }, 'ghost', 'unknown tuned equipment profile');
    rejected((b) => { b.creationModes[0].equipmentProfiles.unarmedAttack.pointsPerTier = 0; }, 'pointsPerTier', 'non-positive tuned equipment tier');
    rejected((b) => { b.attributeRules.defaultMode = 'missing'; }, 'defaultMode', 'dangling default mode');
    rejected((b) => { delete b.attributeRules.presets.standard.reaver.strength; }, 'strength', 'missing stat product cell');
    rejected((b) => { b.attributeRules.presets.standard.reaver.luck = 10; }, 'luck', 'extra stat cell');
    rejected((b) => { b.attributeRules.presets.standard.ghost = { ...b.attributeRules.presets.standard.reaver }; }, 'ghost', 'unknown class cell');
    rejected((b) => { b.attributeRules.presets.ghost = {}; }, 'ghost', 'unknown mode cell');
    rejected((b) => { b.attributeRules.presets.standard.reaver.strength = 10.5; }, 'strength', 'fractional preset value');
    rejected((b) => { b.attributeRules.presets.standard.reaver.strength = standard.maximum + 1; }, 'strength', 'out-of-range preset value');
    rejected((b) => { b.attributeRules.presets.standard.reaver.strength -= 1; }, 'reaver', 'wrong fixed total');

    const fresh = createRunState({ seed: 50, classId: 'herald', registries: REG });
    eq(fresh.attributeMode, contentBundle.attributeRules.defaultMode, 'new run selects the authored default mode');
    eq(JSON.stringify(fresh.attributes), JSON.stringify(contentBundle.attributeRules.presets[fresh.attributeMode].herald), 'new run copies the authored Herald preset');
    eq(JSON.stringify(fresh.attributeModeSnapshot), JSON.stringify(standard), 'new run owns the creation-mode rules that admitted its allocation');
    eq(`${fresh.maxHp}/${fresh.energyMax}/${fresh.drawPerTurn}`, '46/3/5', 'tuned HP/actions/hand formulas reach the run');
    eq(`${REG.balance.levelUp.firstCost}/${REG.balance.levelUp.costStep}`, '20/4', 'the measured ramp (E13: 14.8 level-ups per full run for a greedy bot) — five purchases cost 140');
    eq(`${HUD_REFERENCE_MAX.hp}/${HUD_REFERENCE_MAX.mana}/${HUD_REFERENCE_MAX.stamina}`, '200/20/20', 'HUD references are authored as 200/20/20');
    const tunedProfiles = fresh.equipmentProfileRuleSnapshot.profiles;
    eq(`${tunedProfiles.unarmedAttack.baseValue}/${tunedProfiles.unarmedAttack.scalingStat}/${tunedProfiles.unarmedAttack.pointsPerTier}`, '-6/strength/1', 'physical Strike is -6 + STR');
    eq(`${tunedProfiles.staffMagicAttack.baseValue}/${tunedProfiles.staffMagicAttack.scalingStat}/${tunedProfiles.staffMagicAttack.pointsPerTier}`, '-6/wisdom/1', 'magic Strike is -6 + WIS');
    eq(`${tunedProfiles.unarmedGuard.baseValue}/${tunedProfiles.unarmedGuard.scalingStat}/${tunedProfiles.unarmedGuard.pointsPerTier}`, '-6/dexterity/1', 'Defend is -6 + DEX');
    eq([0, 1, 2, 3, 4].reduce((sum, i) => sum + levelCost(REG, i), 0), 140, 'five purchases cost 140 on the measured 20 + 4 ramp and end at displayed level 6');
    const rogue = createRunState({ seed: 50, classId: 'rogue', registries: REG });
    eq(JSON.stringify(rogue.attributes), JSON.stringify({ strength: 11, dexterity: 13, constitution: 10, wisdom: 9, intelligence: 10 }), 'Rogue copies the exact approved tuned preset');
    eq(`${rogue.attributeMode}/${rogue.maxHp}/${rogue.energyMax}/${rogue.drawPerTurn}`, 'tuned/50/3/5', 'Rogue tuned stats reach the HP, action, and hand formulas');
    eq(rogue.startingKitId, 'rogueBaseline', 'Rogue starts through its authored baseline equipment profile');
    const rogueAttack = rogue.deck.find((card) => card.equipmentRole === 'attack');
    const rogueGuard = rogue.deck.find((card) => card.equipmentRole === 'guard');
    eq(`${rogueAttack.profileId}/${rogueAttack.profileReceipt.base}/${rogueAttack.profileReceipt.sourceStat}/${rogueAttack.profileReceipt.points}/${rogueAttack.profileReceipt.value}`, 'daggerPierceAttack/-6/strength/11/5', 'Rogue dagger Strike is stamped from the tuned physical profile');
    eq(`${rogueGuard.profileId}/${rogueGuard.profileReceipt.base}/${rogueGuard.profileReceipt.sourceStat}/${rogueGuard.profileReceipt.points}/${rogueGuard.profileReceipt.value}`, 'shieldGuard/-6/dexterity/13/7', 'Rogue buckler Defend is stamped from the tuned defense profile');
    const star = createRunState({ seed: 50, classId: 'starseer', registries: REG });
    eq(star.attributes.intelligence, 10, 'the approved Starseer preset keeps INT 10');
    eq(star.startingKitId, 'starseerBaseline', 'its baseline ash staff is grandfathered at initial creation');
    let alternateRefusal = '';
    try {
      createRunState({
        seed: 50, classId: 'reaver', registries: REG, startingKitId: 'reaverGreatsword',
        profileMeta: { discoveredArmaments: ['greatsword'] },
        attributes: { strength: 8, dexterity: 15, constitution: 12, wisdom: 8, intelligence: 10 },
      });
    } catch (error) { alternateRefusal = error.message; }
    assert(/requires strength 12 \(got 8\)/.test(alternateRefusal), 'an alternate kit still passes the manual equipment requirement gate');

    const driftedBundle = {
      ...contentBundle,
      creationModes: structuredClone(contentBundle.creationModes),
      attributeRules: structuredClone(contentBundle.attributeRules),
    };
    const driftedMode = driftedBundle.creationModes.find((mode) => mode.id === 'tuned');
    driftedMode.baseline = 9; driftedMode.bonusPool = 9;
    const drifted = createRegistries(driftedBundle);
    const driftStore = createMemoryStorage();
    createSaveManager(driftStore).saveRun(fresh);
    const afterDrift = createSaveManager(driftStore).loadRun(drifted);
    assert(afterDrift !== null, 'a later live mode edit cannot refuse an allocation admitted by its saved snapshot');
    eq(afterDrift.attributeModeSnapshot.baseline, 10, 'the run keeps the creation rules it was born under');
    for (const mode of modes) {
      const selected = createRunState({ seed: 50, classId: 'reaver', registries: REG, attributeMode: mode.id });
      eq(selected.attributeMode, mode.id, `creation accepts authored mode '${mode.id}'`);
    }
    const allocated = { ...contentBundle.attributeRules.presets.standard.reaver, strength: 12, dexterity: 11 };
    const custom = createRunState({ seed: 50, classId: 'reaver', registries: REG, attributeMode: 'standard', attributes: allocated });
    eq(JSON.stringify(custom.attributes), JSON.stringify(allocated), 'creation accepts a valid player allocation through the shared validator');

    // Whole-block legacy migration is allowed; any half-block is corruption.
    const storage = createMemoryStorage();
    const saves = createSaveManager(storage);
    const legacy = { ...fresh };
    delete legacy.attributeMode;
    delete legacy.attributes;
    delete legacy.attributeModeSnapshot;
    storage.setItem(RUN_KEY, JSON.stringify(legacy));
    const migrated = saves.loadRun(REG);
    eq(JSON.stringify(migrated.attributes), JSON.stringify(contentBundle.attributeRules.presets[migrated.attributeMode].herald), 'legacy run migrates to its content-selected class preset as one whole block');
    for (const malformed of [
      { ...fresh, attributeMode: undefined },
      { ...fresh, attributes: undefined },
      { ...fresh, attributes: { ...fresh.attributes, luck: 10 } },
      { ...fresh, attributes: { ...fresh.attributes, wisdom: undefined } },
      { ...fresh, attributeMode: 'ghost' },
      { ...fresh, attributes: { ...fresh.attributes, wisdom: 10.5 } },
      { ...fresh, attributes: { ...fresh.attributes, wisdom: standard.maximum + 1 } },
      { ...fresh, attributes: { ...fresh.attributes, wisdom: fresh.attributes.wisdom + 1 } },
    ]) {
      storage.setItem(RUN_KEY, JSON.stringify(malformed));
      eq(saves.loadRun(REG), null, 'partial/unknown attribute save fails closed');
    }

    // A synthetic second mode changes order, every numeric rule, defaultMode,
    // and a class preset. Readers must follow it without a system default.
    const mutant = clone();
    mutant.attributes = mutant.attributes.map((a, i) => ({ ...a, order: mutant.attributes.length - i }));
    const testMode = { id: 'testMode', label: 'Test Mode', baseline: 7, bonusPool: 3, minimum: 7, maximum: 10, belowBaseline: 'forbid', redistribution: 'fixedTotal' };
    mutant.creationModes.push(testMode);
    mutant.attributeRules.defaultMode = testMode.id;
    mutant.attributeRules.presets.testMode = {
      reaver: { strength: 10, dexterity: 7, constitution: 7, wisdom: 7, intelligence: 7 },
      starseer: { strength: 7, dexterity: 8, constitution: 7, wisdom: 7, intelligence: 9 },
      rogue: { strength: 7, dexterity: 10, constitution: 7, wisdom: 7, intelligence: 7 },
      herald: { strength: 7, dexterity: 7, constitution: 8, wisdom: 9, intelligence: 7 },
    };
    assert(validateContent(mutant).ok, 'mutant content remains valid after every derived input changes');
    const MR = createRegistries(mutant);
    const mr = createRunState({ seed: 51, classId: 'reaver', registries: MR });
    eq(mr.attributeMode, 'testMode', 'creation follows mutated default mode');
    eq(Object.keys(mr.attributes).join(','), mutant.attributes.slice().sort((a, b) => a.order - b.order).map((a) => a.id).join(','), 'run allocation key order follows mutated authored order');
    eq(Object.values(mr.attributes).reduce((a, b) => a + b, 0), testMode.baseline * mutant.attributes.length + testMode.bonusPool, 'run total follows mutated baseline/count/pool');
    const mutantAllocation = { ...mutant.attributeRules.presets.testMode.reaver, strength: 9, dexterity: 8 };
    const ma = createRunState({ seed: 52, classId: 'reaver', registries: MR, attributeMode: testMode.id, attributes: mutantAllocation });
    eq(JSON.stringify(ma.attributes), JSON.stringify(Object.fromEntries(mutant.attributes.slice().sort((a, b) => a.order - b.order).map((a) => [a.id, mutantAllocation[a.id]]))), 'creation input follows mutated vocabulary/order/rules');
    const mutantLegacy = { ...ma }; delete mutantLegacy.attributeMode; delete mutantLegacy.attributes; delete mutantLegacy.attributeModeSnapshot;
    const mutantStorage = createMemoryStorage();
    mutantStorage.setItem(RUN_KEY, JSON.stringify(mutantLegacy));
    const mutantMigrated = createSaveManager(mutantStorage).loadRun(MR);
    eq(mutantMigrated.attributeMode, mutant.attributeRules.defaultMode, 'legacy migration follows the mutated default mode');
    const expectedMutantPreset = Object.fromEntries(mutant.attributes.slice().sort((a, b) => a.order - b.order).map((a) => [a.id, mutant.attributeRules.presets[mutantMigrated.attributeMode].reaver[a.id]]));
    eq(JSON.stringify(mutantMigrated.attributes), JSON.stringify(expectedMutantPreset), 'legacy migration follows the mutated class preset and authored order');
  });

  // ---- 50b. the retired vocabulary cannot creep back ------------------------
  test('50b. a retired attribute name is refused at the boot door, by name', () => {
    // THE DOOR THIS GUARDS: 'constitution' held the HP seat for three days
    // (d465cfc 2026-08-11 → 2026-08-14) and every save written in that window
    // spells it. His named stat is Vigour (D17: "vigour shoudl be 1 hp point
    // per"). The rename is content, so nothing stops a later content edit —
    // or an old copy of attributes.js — from re-adding the dead row, at which
    // point old saves stop migrating and two names hold one seat. This is the
    // same door as any content refusal: validateContent, the exact call
    // main.js:71 makes at boot.
    const retired = contentBundle.attributeRules.retired;
    assert(retired && typeof retired === 'object' && Object.keys(retired).length > 0,
      'the retired-name map ships as content (attributeRules.retired)');
    eq(retired.vigour, 'constitution', "'vigour' is retired in favour of 'constitution'");
    assert(validateContent(contentBundle).ok, 'the shipped bundle boots clean under its own retired map');

    const clone = () => ({
      ...contentBundle,
      attributes: structuredClone(contentBundle.attributes),
      attributeRules: structuredClone(contentBundle.attributeRules),
      derivedStatRules: structuredClone(contentBundle.derivedStatRules),
    });
    const refusedNaming = (mutate, needle, label) => {
      const b = clone(); mutate(b);
      const v = validateContent(b);
      assert(!v.ok, `${label} is refused`);
      assert(v.errors.some((e) => (e.path + ' ' + e.msg).includes(needle)),
        `${label} refusal names '${needle}' — got: ${v.errors.map((e) => `${e.path}: ${e.msg}`).join('; ')}`);
    };
    // The dead row itself — the creep-back this test exists for.
    refusedNaming((b) => { b.attributes.push({ id: 'vigour', label: 'Vigour', shortLabel: 'VIG', order: 6 }); },
      'retired', 'a re-added vigour attribute row');
    refusedNaming((b) => { b.attributes.push({ id: 'vigour', label: 'Vigour', shortLabel: 'VIG', order: 6 }); },
      'vigour', 'a re-added vigour attribute row');
    // The dead name as a preset cell — the second content home it had.
    refusedNaming((b) => {
      const p = b.attributeRules.presets.standard.reaver;
      p.vigour = p.constitution; delete p.constitution;
    }, 'vigour', 'a preset cell keyed by the dead name');
    // The dead name as a derived-stat source — the third content home it had.
    refusedNaming((b) => { b.derivedStatRules.rules.hp.sourceStat = 'vigour'; },
      'vigour', 'a derived-stat rule sourcing the dead name');
    // The map's own hygiene: a retired name may not point at a ghost.
    refusedNaming((b) => { b.attributeRules.retired = { vigour: 'ghostStat' }; },
      'ghostStat', 'a retired name whose heir is not a live attribute');
    // THE LOAD-BEARING CASE — the old vocabulary coming back WHOLESALE, as a
    // complete self-consistent copy (row, presets, sourceStats — exactly what
    // reverting attributes.js + derivedStats.js to d465cfc would produce).
    // Without the retired map this validates green: five rows, complete
    // presets, every sourceStat resolving. That is why the map lives in its
    // own file and why this case exists.
    refusedNaming((b) => {
      b.attributes = b.attributes.map((a) => (a.id === 'constitution'
        ? { ...a, id: 'vigour', label: 'Vigour', shortLabel: 'VIG' } : a));
      for (const byClass of Object.values(b.attributeRules.presets)) {
        for (const preset of Object.values(byClass)) {
          preset.vigour = preset.constitution; delete preset.constitution;
        }
      }
      b.derivedStatRules.rules.hp.sourceStat = 'vigour';
      b.derivedStatRules.rules.stamina.sourceStat = 'vigour';
    }, 'retired', 'the complete old vocabulary reverted wholesale');
  });

  // ---- 50c. the three-day window's saves come through the door healed -------
  test('50c. a save written under the retired name loads through the real door, healed, and saves clean', () => {
    // The fixture is NOT hand-typed: it is the exact bytes
    // createSaveManager.saveRun wrote at dev = acb8ffe (reaver, seed 7),
    // frozen at tests/fixtures/run-save-constitution-acb8ffe.json. It spells
    // 'constitution' three times — attributes, and the snapshot's hp and
    // stamina sourceStat — which is every persisted home the name had.
    // Same door as the game: storage → loadRun → deserializeRun →
    // normalizeRunAttributes → initializeRunDerivedStats.
    if (!legacyRunSave) {
      assert(true, 'SKIPPED (no fixture handed in): the browser harness has no fs; run tests/run-node.mjs');
      return;
    }
    const legacyVigourSave = legacyRunSave.replaceAll('"constitution"', '"vigour"');
    assert(legacyVigourSave.includes('"vigour"'), 'the fixture really carries the retired name (probe has a referent)');

    const storage = createMemoryStorage();
    storage.setItem(RUN_KEY, legacyVigourSave);
    const saves = createSaveManager(storage);
    const run = saves.loadRun(REG);
    assert(run !== null, 'the three-day-window save LOADS — it is not archived for wearing the old vocabulary');
    eq(run.attributes.constitution, 12, "the vigour points arrive as constitution, value intact");
    assert(!Object.hasOwn(run.attributes, 'vigour'), 'the retired key does not survive the load');
    eq(Object.keys(run.attributes).join(','), 'strength,dexterity,constitution,wisdom,intelligence',
      'the healed allocation carries exactly the live vocabulary in authored order');
    const rules = run.derivedStatRuleSnapshot.rules.rules;
    eq(rules.hp.sourceStat, 'constitution', "the snapshot's hp rule now sources constitution");
    eq(rules.stamina.sourceStat, 'constitution', "the snapshot's stamina rule now sources constitution");
    // Healing must not move a number: same points, same seat, same outputs.
    const old = JSON.parse(legacyVigourSave);
    // 90, not 96, since E6 (2026-08-16). THIS SAVE CARRIES rulesetVersion 2 —
    // it has NO current-ruleset snapshot, so the load door resolves the CURRENT
    // host rules for it, by the design this test's own name calls migration.
    // That door already re-derived it (86 → 96) before E6 and now re-derives it
    // to 84 class + 2 relic flat + 2 tiers × (1 + 1 relic per-tier). A run carrying a
    // CURRENT snapshot is NOT touched — test 50e is that edge, and the pair is
    // the whole save story of the formula change.
    eq(run.maxHp, 64, 'legacy maxHp is re-derived through the current CON/flat-bonus authority');
    eq(run.hp, 64, 'a legacy full-HP save remains full after current-rule migration');
    eq(run.energyMax, old.energyMax, 'energyMax is untouched by the rename');
    eq(run.drawPerTurn, old.drawPerTurn, 'drawPerTurn is untouched by the rename');
    // Forward hygiene: the next save writes zero dead bytes.
    assert(!serializeRun(run).includes('"vigour"'), 'a re-serialized healed run spells the retired name zero times');

    // The ambiguous edge fails CLOSED (Law 0 clause 5): a save carrying BOTH
    // names in one allocation is not guessed at — it archives.
    const both = JSON.parse(legacyVigourSave);
    both.attributes.constitution = 12; // vigour still present
    storage.setItem(RUN_KEY, JSON.stringify(both));
    eq(saves.loadRun(REG), null, 'a save carrying both vigour and constitution is refused, never guessed');
  });

  test('50d. tuned HP is 30 + 2 × CON + flat bonuses at every legal edge', () => {
    for (const [classId, con, flat] of [['reaver', 11, 10], ['starseer', 8, 0], ['rogue', 10, 0], ['herald', 8, 0]]) {
      const run = createRunState({ seed: 0xf1, classId, registries: REG });
      const hp = statProjection(REG, run).derived.find((row) => row.id === 'hp');
      eq(run.attributes.constitution, con, `${classId} uses the approved tuned CON preset`);
      eq(`${hp.base}/${hp.pointsPerTier}/${hp.gainPerTier}`, `${30 + flat}/1/2`, `${classId} receipt exposes the configured formula and flat bonus`);
      eq(run.maxHp, 30 + 2 * con + flat, `${classId} max HP is 30 + 2 × CON + flat bonuses`);
      assert(hp.formula.endsWith(`= ${run.maxHp}`), `${classId} printed receipt lands on the real pool`);
    }
    const at = (con) => {
      const strength = con === 8 ? 15 : 24 - con;
      const dexterity = con === 8 ? 12 : 11;
      return createRunState({
        seed: 0xf2, classId: 'reaver', registries: REG,
        attributes: { strength, dexterity, constitution: con, wisdom: 8, intelligence: 10 },
      });
    };
    eq(at(8).maxHp, 56, 'CON floor 8 gives 30 + 16 + 10 flat');
    eq(at(15).maxHp, 70, 'CON ceiling 15 gives 30 + 30 + 10 flat');
    eq(at(15).maxHp - at(14).maxHp, 2, 'one adjacent CON point is exactly two HP');
    for (const outside of [7, 16]) {
      let refused = false;
      try { at(outside); } catch (error) { refused = /between 8 and 15/.test(error.message); }
      assert(refused, `CON ${outside} is refused by the tuned creation bounds`);
    }
  });

  // ---- 50e. an existing climb keeps the HP it was written with -------------
  test('50e. a run saved before E6 loads with its own HP, unchanged and unhealed', () => {
    // THE SAVE-VISIBLE HALF OF E6. The fixture is NOT hand-typed: it is the
    // exact bytes createSaveManager.saveRun wrote at dev = 5597166 — reaver,
    // seed 7, maxHp 96 under the OLD class-based formula — frozen at
    // tests/fixtures/run-save-hp-5597166.json. Same door as the game:
    // storage → loadRun → deserializeRun → initializeRunDerivedStats.
    if (!preE6RunSave) {
      assert(true, 'SKIPPED (no fixture handed in): the browser harness has no fs; run tests/run-node.mjs');
      return;
    }
    const before = JSON.parse(preE6RunSave);
    eq(before.maxHp, 96, 'the fixture really carries the old number (probe has a referent)');
    assert(before.derivedStatRuleSnapshot.rulesetVersion < REG.derivedStatRules.rulesetVersion,
      'the fixture carries an older host snapshot, so this test distinguishes preservation from live re-resolution');
    const storage = createMemoryStorage();
    storage.setItem(RUN_KEY, preE6RunSave);
    const run = createSaveManager(storage).loadRun(REG);
    assert(run !== null, 'the pre-E6 climb loads — a formula change does not archive a run');
    eq(run.maxHp, 96, 'its max HP is the one it was written with: NOBODY RE-STATTED THIS RUN');
    eq(run.hp, 96, 'and its current HP is untouched');
    eq(run.derivedStatRuleSnapshot.rules.rules.hp.base, before.derivedStatRuleSnapshot.rules.rules.hp.base,
      'the snapshot the run owns is the authority, not the authored table');
    // THE FALSIFIER FOR THIS CELL, and it is the whole reason the pair exists:
    // a run created NOW, from the same class and the same CON, gets the new
    // number. If both came out 96 this test would be measuring nothing.
    const fresh = createRunState({
      seed: 7, classId: before.class, registries: REG,
      attributeMode: before.attributeMode, attributes: before.attributes,
    });
    eq(fresh.attributes.constitution, before.attributes.constitution, 'same class, same CON');
    eq(fresh.maxHp, 64, 'a NEW run with the same class and CON gets 30 + 2 × CON + 10 flat, so preservation is not a coincidence');
  });

  // ---- 58. the nearest shrine: one computation, two asks -------------------
  test('58. nearestShrine answers the same question the unfog and the glow both ask', () => {
    // A HAND-BUILT GRAPH, on purpose: a generated act is a distribution, and
    // this test is about the ARITHMETIC of the walk. The generated acts are
    // swept by `tools/mapfog.mjs --selftest`, which is where a property over a
    // distribution belongs. Shape (edges run upward):
    //
    //        s3          f3, a shrine
    //       /  \
    //     s1    s2       f2, s2 a shrine, s1 not
    //       \  /
    //        a           f1, the entrance
    const g = {
      startIds: ['a'],
      bossId: 's3',
      nodes: {
        a: { id: 'a', floor: 1, col: 1, type: 'monster', next: ['s1', 's2'] },
        s1: { id: 's1', floor: 2, col: 0, type: 'monster', next: ['s3'] },
        s2: { id: 's2', floor: 2, col: 2, type: 'shrine', next: ['s3'] },
        s3: { id: 's3', floor: 3, col: 1, type: 'shrine', next: [] },
      },
    };
    const at = (from) => nearestShrine({ graph: g, from });
    eq(at('a').id, 's2', 'from the entrance the nearest shrine is one step away');
    eq(at('a').path.join('>'), 'a>s2', 'and the walk to it is the walk the glow draws');
    eq(at('a').distance, 1, 'distance is counted in steps');
    // STANDING ON A SHRINE, THE NEAREST SHRINE IS THE NEXT ONE. This is the
    // clause both asks turn on, and the one an `includeSource` option would
    // have got wrong: "unfog the NEXT nearest" is meaningless if the answer is
    // your own feet.
    eq(at('s2').id, 's3', 'from a shrine, the answer is the next shrine and never itself');
    eq(at('s3'), null, 'the last shrine of the act has nothing ahead of it — the empty edge');
    eq(at('nosuch'), null, 'a node that is not in the graph answers null rather than throwing');
    eq(nearestShrine({ graph: g, from: [] }), null, 'no sources is no answer');
    eq(at('s1').id, 's3', 'forward only: `next` is one-way and so is the climb');

    // DETERMINISM AT A TIE, and it is not decoration: two shrines equidistant
    // is the ordinary shape of a seven-column act, and a lane that re-picks on
    // a re-mount is a lane the player cannot follow.
    const tie = {
      startIds: ['a'],
      bossId: 'z',
      nodes: {
        a: { id: 'a', floor: 1, col: 1, type: 'monster', next: ['m', 'b'] },
        b: { id: 'b', floor: 2, col: 0, type: 'shrine', next: [] },
        m: { id: 'm', floor: 2, col: 2, type: 'shrine', next: [] },
        z: { id: 'z', floor: 3, col: 1, type: 'boss', next: [] },
      },
    };
    eq(nearestShrine({ graph: tie, from: 'a' }).id, 'b', 'a tie is settled by the smaller node id');
    const reordered = { ...tie, nodes: { m: tie.nodes.m, b: tie.nodes.b, a: tie.nodes.a, z: tie.nodes.z } };
    eq(nearestShrine({ graph: reordered, from: 'a' }).id, 'b',
      'and re-ordering the graph object does not move the answer');
    // THE PROBE HAS A REFERENT: the edge order really is m-then-b, so 'b' is
    // NOT what a first-found walk would have returned. Without this line the
    // two cells above would pass under the rule they exist to exclude.
    eq(tie.nodes.a.next.find((id) => tie.nodes[id].type === 'shrine'), 'm',
      'first-found would have answered m — the sorted answer is not the free one');

    // THE LANE the board glows.
    eq(shrineLane({ graph: g, run: { mapNodeId: null, path: [] } }).join('>'), 'a>s2',
      'at the entrance the lane is aimed from the doors');
    eq(shrineLane({ graph: g, run: { mapNodeId: 's2', path: ['a', 's2'] } }).join('>'), 's2>s3',
      'standing on a shrine the lane re-aims at the next one — "as new paths open"');
    eq(shrineLane({ graph: g, run: { mapNodeId: 's3', path: ['a', 's2', 's3'] } }).length, 0,
      'with no shrine ahead there is no lane, and no lane is not an empty glow');
  });

  // ---- 59. resting unfogs the next nearest shrine ---------------------------
  test('59. a shrine you have stood on lights the next shrine, and nothing else', () => {
    // The graph carries one node the light must NOT reach, so a fog that simply
    // lit more would be caught here rather than congratulated.
    const g = {
      startIds: ['a'],
      bossId: 'top',
      nodes: {
        a: { id: 'a', floor: 1, col: 1, type: 'monster', next: ['s1', 'x'] },
        s1: { id: 's1', floor: 2, col: 0, type: 'shrine', next: ['mid'] },
        x: { id: 'x', floor: 2, col: 2, type: 'monster', next: ['mid'] },
        mid: { id: 'mid', floor: 3, col: 1, type: 'monster', next: ['far'] },
        // `far` IS THE NODE THAT MAKES THIS TEST MEAN ANYTHING, and it is here
        // because the first draft of it was wrong. I asserted that the node
        // between the shrine and the next shrine stays dark, and used `mid` —
        // which is the shrine's OWN SPLIT and has been lit since the fog
        // shipped. The assertion went red for the right reason and the reason
        // was my graph. Two steps up is the nearest node the unfog could leak
        // to that nothing else already lights.
        far: { id: 'far', floor: 4, col: 1, type: 'monster', next: ['s2'] },
        s2: { id: 's2', floor: 5, col: 1, type: 'shrine', next: ['top'] },
        top: { id: 'top', floor: 6, col: 1, type: 'boss', next: [] },
      },
    };
    const litAt = (run) => litNodes({ graph: g, run });

    // BEFORE any shrine is reached: doors, boss, the trail and the split. `s2`
    // is three steps up and nothing has earned it.
    const before = litAt({ path: ['a'], mapNodeId: 'a' });
    assert(!before.has('s2'), 'the far shrine is fogged before any shrine is reached');
    assert(before.has('top'), 'the boss is lit from the first frame (unchanged)');

    // STANDING ON `s1`: the next shrine ahead of it lights.
    const after = litAt({ path: ['a', 's1'], mapNodeId: 's1' });
    assert(after.has('s2'), 'reaching a shrine unfogs the next nearest shrine — his sentence');
    // …AND ONLY THE NODE. Lighting the walk to it would hand over the shape of
    // an act nobody has climbed, which is the one way this could leak. `mid` is
    // NOT the cell that proves it — the shrine's own split has been lit since
    // the fog shipped — so the probe is two steps up.
    assert(after.has('mid'), 'the shrine\'s own split is lit, as it always was (not this feature)');
    assert(!after.has('far'), 'the walk to that shrine stays dark — the NODE is unfogged, not the route');

    // MONOTONE: everything lit before is still lit. FOG_TRAIL_CLAUSE is a
    // promise printed on the settings screen, and it survives a fifth source.
    for (const id of before) assert(after.has(id), `${id} was lit and stayed lit`);

    // ⚠ THE CELL A PLANT FOUND MISSING, and it is the half of this feature the
    // rest of the test could not see. Every cell above stands ON the shrine, and
    // `litNodes` lights the current node's next shrine through a SECOND call —
    // the belt-and-braces one for a posed `?shotAt` position. So deleting the
    // unfog from the trail loop entirely left this test GREEN. The load-bearing
    // half is a shrine the player has walked PAST: its light must not go out.
    const past = litAt({ path: ['a', 's1', 'mid'], mapNodeId: 'mid' });
    assert(past.has('s2'), 'a shrine BEHIND you still lights the next one — the trail keeps its unfog');
    for (const id of after) assert(past.has(id), `${id} stayed lit after stepping past the shrine`);

    // THE EMPTY EDGE: standing on the LAST shrine lights no further shrine and
    // does not throw.
    const last = litAt({ path: ['a', 's1', 'mid', 'far', 's2'], mapNodeId: 's2' });
    assert(last.has('top'), 'the last shrine still lights its own split');

    // THE PLANT, and it is the reason the green above is worth anything: with
    // nothing in the trail typed `shrine`, s2 must go dark. Watched red before
    // this test was trusted — without it, `after.has('s2')` could be the boss,
    // the split or an over-wide light and would read identically.
    const noShrine = { ...g, nodes: { ...g.nodes, s1: { ...g.nodes.s1, type: 'monster' } } };
    const plant = litNodes({ graph: noShrine, run: { path: ['a', 's1'], mapNodeId: 's1' } });
    assert(!plant.has('s2'), 'PLANT: no shrine in the trail, s2 dark — so the green above IS the unfog');

    // NEVER A SECOND COPY OF THE TRAIL: nothing is stored, so the same path is
    // the same light.
    const twice = litAt({ path: ['a', 's1'], mapNodeId: 's1' });
    eq([...twice].sort().join(','), [...after].sort().join(','), 'the light is a pure function of the path');
  });

  // ---- 60. levelling at a shrine -------------------------------------------
  test('60. a level is one attribute point bought with cinders, and the pools follow', () => {
    const run = createRunState({ seed: 0x1e7e1, classId: 'reaver', registries: REG });
    const startCon = run.attributes.constitution;
    const startHp = run.maxHp;
    const plan = levelUpPlan(REG, run);
    eq(plan.levelsTaken, 0, 'a fresh run has taken no levels');
    eq(plan.cost, REG.balance.levelUp.firstCost, 'the first level costs the authored first price');
    eq(plan.attributes.length, REG.attributes.all().length,
      'every authored attribute is offered — the shrine names no stat itself (the Law 0 falsifier)');

    // THE EMPTY EDGE: no cinders, no offer, and both refusals are BY NAME.
    run.cinders = 0;
    assert(!levelUpPlan(REG, run).offerable, 'with an empty purse the shrine offers nothing');
    let refused = '';
    try { applyLevelUp(REG, run, 'constitution'); } catch (e) { refused = e.message; }
    assert(/cinders needed/.test(refused), `an unaffordable level is refused by name (got: ${refused})`);
    let badId = '';
    try { applyLevelUp(REG, run, 'charisma'); } catch (e) { badId = e.message; }
    assert(/not an attribute id/.test(badId), `a stat that does not exist is refused by name (got: ${badId})`);

    // THE PURCHASE.
    run.cinders = 10000;
    const purse = run.cinders;
    const manaBefore = run.maxMana;
    const got = applyLevelUp(REG, run, 'constitution');
    eq(run.attributes.constitution, startCon + 1, 'the point lands on the stat that was bought');
    eq(run.cinders, purse - plan.cost, 'the cinders are gone, exactly the priced amount');
    eq(run.levelUps, 1, 'the purchase is recorded — this is the number the load door reads');
    eq(got.level, 1, 'the receipt names the level bought');
    eq(run.maxMana, manaBefore, 'the pool CON does not feed did not move');

    eq(run.maxHp, startHp + 2, 'one CON point adds the configured two HP immediately');
    const conAt = run.attributes.constitution;
    applyLevelUp(REG, run, 'constitution');
    eq(run.maxHp, startHp + 4, `CON ${conAt + 1} adds a second two-HP step`);
    applyLevelUp(REG, run, 'constitution');
    eq(run.maxHp, startHp + 6, `CON ${conAt + 2} adds a third two-HP step`);
    eq(run.levelUps, 3, 'three levels bought and three points spent');

    // A LEVEL IS NOT A REST: the pool grows and the deficit is carried. The
    // shrine sells the heal at the next panel; a level that healed would make
    // that panel pointless at the same counter.
    const hurt = createRunState({ seed: 0x4c4e, classId: 'reaver', registries: REG });
    hurt.cinders = 5000;
    hurt.hp = hurt.maxHp - 10;
    const hurtMax = hurt.maxHp;
    applyLevelUp(REG, hurt, 'constitution');
    eq(hurt.maxHp - hurt.hp, 10, 'the 10-HP deficit is carried across the levels — levelling does not heal');
    assert(hurt.maxHp > hurtMax, 'and the ceiling still rose (the probe has a referent)');

    // THE RAMP, and the only half of his acceptance test this suite can hold.
    eq(levelCost(REG, 1) - levelCost(REG, 0), REG.balance.levelUp.costStep, 'each level costs one step more');
    eq(levelsAffordable(REG, 140), 5, '140 cinders buys five levels and reaches displayed level 6');
    eq([0, 1, 2, 3, 4].reduce((sum, i) => sum + levelCost(REG, i), 0), 140, 'the measured 20 + 4 ramp totals 140 for five purchases');
    eq(levelsAffordable(REG, 0), 0, 'the empty edge: no cinders, no levels');
  });

  // ---- 60b. a levelled run comes back through the real save door ------------
  test('60b. a levelled run round-trips the load door instead of being archived', () => {
    // THE SCARY ONE, AND IT IS WHY LEVELLING IS A MODEL FILE. `save.js` calls
    // normalizeRunAttributes inside the try whose catch ARCHIVES THE SAVE, and
    // the creation rules it enforces are snapshotted fixed-total bounds. A
    // level-up that only incremented `run.attributes` would look
    // perfect on screen and destroy the player's run at the next load.
    const run = createRunState({ seed: 0x5a7ed, classId: 'reaver', registries: REG });
    run.cinders = 10000;
    run.seedString = 'LEVELS';
    for (let i = 0; i < 6; i++) applyLevelUp(REG, run, 'constitution');
    eq(run.levelUps, 6, 'six levels bought');
    assert(run.attributes.constitution > 15, 'and the stat is past the creation ceiling of 15');

    const storage = createMemoryStorage();
    createSaveManager(storage).saveRun(run);
    const back = createSaveManager(storage).loadRun(REG);
    assert(back !== null, 'THE LEVELLED RUN LOADS — it is not archived by the creation rules');
    eq(back.attributes.constitution, run.attributes.constitution, 'the levelled points survive the door');
    eq(back.levelUps, 6, 'and so does the count that makes them legal');
    eq(back.maxHp, run.maxHp, 'the derived pool the levels moved is accepted, not re-derived away');

    // THE e05be89 SAVE SHAPE, AND IT MUST LOAD. That build recorded `levelUps`
    // and no `levelPoints`, and it had exactly one possible level value, so for
    // those saves the count IS the points. This cell is the migration; it is
    // not a plant, and it is the reason the fallback is exact rather than a
    // guess at today's dial.
    const raw = JSON.parse(storage.getItem(RUN_KEY));
    const legacy = JSON.parse(JSON.stringify(raw));
    delete legacy.levelPoints;
    eq(legacy.levelUps, 6, 'the legacy shape really carries the count (the probe has a referent)');
    storage.setItem(RUN_KEY, JSON.stringify(legacy));
    const migrated = createSaveManager(storage).loadRun(REG);
    assert(migrated !== null, 'a run saved by e05be89 — levelUps, no levelPoints — still loads');
    eq(migrated.attributes.constitution, run.attributes.constitution, 'and keeps every point it bought');

    // THE PLANT — the failure this feature would have shipped, watched. Strip
    // BOTH records and keep the points: a 61-point allocation with nothing
    // saying they were bought is exactly a hand-edited save.
    const forged = JSON.parse(JSON.stringify(raw));
    delete forged.levelPoints;
    delete forged.levelUps;
    storage.setItem(RUN_KEY, JSON.stringify(forged));
    eq(createSaveManager(storage).loadRun(REG), null,
      'PLANT: the same points with no record of buying them are REFUSED — the green above is the record doing work');

    // THE MIRROR PLANT, so this is not "levelPoints makes anything legal": six
    // points claimed and none spent is refused too.
    const inflated = JSON.parse(JSON.stringify(raw));
    inflated.levelPoints = 6;
    inflated.attributes.constitution = 12;
    storage.setItem(RUN_KEY, JSON.stringify(inflated));
    eq(createSaveManager(storage).loadRun(REG), null,
      'PLANT: six points claimed and none spent is refused — the total is checked in both directions');

    // AND A RUN WITH NO LEVELS IS JUDGED BY EXACTLY THE OLD RULES.
    const plain = createRunState({ seed: 7, classId: 'reaver', registries: REG });
    plain.seedString = 'PLAIN';
    const s2 = createSaveManager(createMemoryStorage());
    s2.saveRun(plain);
    assert(s2.loadRun(REG) !== null, 'an unlevelled run loads exactly as it always did');
  });

  // ---- 60c. his two dials actually move the game ---------------------------
  test('60c. the level value and the tier size each change what a level does', () => {
    // Constantine, 2026-08-17: "leave the level up value configurable. also,
    // let's make the increment of 5 points for reasonable change be confurable
    // as well. that way I can test each." THAT WAY I CAN TEST EACH is the
    // requirement, so each dial is tested at both edges — the value that makes
    // a level visible and the value that does not.

    // ---- DIAL 1: the level value ------------------------------------------
    const one = createRunState({ seed: 0xd1a1, classId: 'reaver', registries: REG });
    one.cinders = 5000;
    applyLevelUp(REG, one, 'constitution', { pointsPerLevel: 1 });
    eq(one.attributes.constitution - 11, 1, 'at 1, a level grants one point');
    eq(one.levelPoints, 1, 'and records one point granted');

    const three = createRunState({ seed: 0xd1a1, classId: 'reaver', registries: REG });
    three.cinders = 5000;
    const hpBefore = three.maxHp;
    applyLevelUp(REG, three, 'constitution', { pointsPerLevel: 3 });
    eq(three.attributes.constitution - 11, 3, 'at 3, one level grants three points');
    eq(three.levelPoints, 3, 'and records three');
    eq(three.levelUps, 1, 'while still being ONE purchase — the ramp indexes on purchases');
    eq(three.cinders, one.cinders, 'and costs the same: the value is what a level GRANTS, not what it costs');
    // Both values are visible under the per-CON HP formula.
    assert(three.maxHp > hpBefore, 'at 3, ONE level moves max HP — the dial answers the dead-level finding');
    eq(one.maxHp, hpBefore + 2, 'at 1, the same one level adds exactly two HP');

    // MIXED VALUES IN ONE RUN, which is what "I can test each" produces the
    // moment he turns the dial mid-climb — and the case where the count and
    // the points stop being the same number.
    applyLevelUp(REG, three, 'wisdom', { pointsPerLevel: 1 });
    eq(three.levelUps, 2, 'two purchases');
    eq(three.levelPoints, 4, 'four points — the two numbers have diverged, as they must');
    const mixedStore = createMemoryStorage();
    three.seedString = 'MIXED';
    createSaveManager(mixedStore).saveRun(three);
    assert(createSaveManager(mixedStore).loadRun(REG) !== null,
      'AND A MIXED-VALUE RUN STILL LOADS — turning the dial mid-climb cannot archive a save');

    // ---- DIAL 2: the tier size --------------------------------------------
    // Through the REAL door a new run is born with: the settings resolver, then
    // createRunState's derivedStatOptions. Nothing here hand-builds an override
    // layer, or the test would be measuring a shape the game cannot reach.
    eq(JSON.stringify(derivedStatDialOptions({})), '{}',
      'at the shipping value the dial adds NO override layer at all');
    eq(resolveStatTierSize({}), 5, 'and the resolver reads the shipping tier size from its one home');
    eq(resolveLevelUpValue({}), 1, "and the level value's default is his own number");
    // ⚠ THIS CELL CHANGED WHEN THE CONTROL DID, and the old expectation is the
    // record of it: while the tier size was a 1-2-3-5 LADDER, 99 was "a value
    // the row does not offer" and resolved to the DEFAULT. It is a typed field
    // now, so 99 is in the wrong PLACE rather than off the list, and the honest
    // answer is the domain's ceiling. Constantine's purpose clause is why the
    // control moved: a ladder cannot express 4 or 7.
    // THE CONTROL ITSELF, ASSERTED — and this line exists because a plant found
    // it missing. `resolveNumberRow` is TYPE-BLIND: it reads min/max off the row
    // and clamps, so reverting this row to a chip ladder left every value cell
    // below GREEN while the screen went back to four buttons. The resolver is not
    // the control, and only one of them is what he asked to change.
    const tierRow = settingsRow('statTierSize');
    eq(tierRow.type, 'number', 'the tier size is a TYPED FIELD — a ladder cannot express 4 or 7');
    eq(tierRow.min, REG.balance.levelUp.tierSizeMin, 'its floor is authored');
    eq(tierRow.max, REG.balance.levelUp.tierSizeMax, 'and so is its ceiling');
    assert(!tierRow.choices, 'and it offers no chip list at all — the domain replaced the ladder');
    eq(resolveStatTierSize({ statTierSize: 99 }), 20, 'a value past the ceiling CLAMPS to it — it is a field, not a list');
    eq(resolveStatTierSize({ statTierSize: 4 }), 4, 'and 4 — which no ladder here ever offered — is simply legal');
    eq(resolveStatTierSize({ statTierSize: 7 }), 7, 'as is 7, which is the pair his sentence needed');
    eq(resolveStatTierSize({ statTierSize: 0 }), 1, 'ZERO CLAMPS UP: floor(points / 0) is not a tier, it is a division by zero');
    eq(resolveStatTierSize({ statTierSize: 'lots' }), 5, 'unreadable is unset — the shipping default');
    eq(resolveLevelUpValue({ levelUpValue: 'lots' }), 1, 'and so is a value that is not a number at all');
    const dialled = derivedStatDialOptions({ statTierSize: 2 });
    const born = (opts) => createRunState({ seed: 0xd1a2, classId: 'reaver', registries: REG, derivedStatOptions: opts });
    const at5 = born(derivedStatDialOptions({}));
    const at1 = born(dialled);
    eq(at5.derivedStatRuleSnapshot.rules.rules.hp.pointsPerTier, 1, 'a default run stamps the configured per-CON HP formula');
    eq(at1.derivedStatRuleSnapshot.rules.rules.hp.pointsPerTier, 2, 'and the dialled run stamps its explicit 2-point tier');
    // ⚠ HP IS THE CELL THAT MATTERS AND IT IS WHY THE RESTATEMENT HAD TO GO.
    // `hp` used to author `pointsPerTier: 5` on its own row, and a row beats
    // the defaults it is merged over — so this assertion is the one that would
    // have caught the dial silently skipping the stat it exists for.
    for (const id of ['hp', 'mana', 'energy', 'draw', 'stamina']) {
      eq(at1.derivedStatRuleSnapshot.rules.rules[id].pointsPerTier, 2,
        `${id} answers the tier dial — every derived stat, not just the ones that inherited`);
    }
    assert(at1.maxHp < at5.maxHp, 'at a 2-point tier the same CON is worth less HP — the dial reaches the game');

    // ⚠ THE OTHER DOOR, and it is here because a plant proved my own comment
    // wrong. `hp` used to author `pointsPerTier: 5` on its own row, restating
    // `defaults.pointsPerTier`. I claimed that copy would make HIS DIAL skip
    // HP; it would not — a dial arrives as an override LAYER, and a layer's
    // `defaults` is assigned over every row, so it reaches HP either way.
    // Restoring the line leaves every other cell in this suite green.
    //
    // WHAT THE COPY ACTUALLY BREAKS is the door a designer uses when they edit
    // the content file directly: a row's own value beats the defaults it is
    // merged over, so editing `defaults` there moves four stats and silently
    // leaves HP behind. One intent, two doors, two answers. This cell is that
    // door, and it is the only thing in the tree that can fail on the copy.
    const edited = { ...REG.derivedStatRules, defaults: { ...REG.derivedStatRules.defaults, pointsPerTier: 1 } };
    const byHand = resolveDerivedStatRules(edited, {
      attributeIds: REG.attributes.ids(), classFields: ['maxHp', 'maxMana'],
    });
    eq(byHand.rules.hp.pointsPerTier, 1, 'HP keeps its authored per-CON formula when only the fallback default changes');
    eq(byHand.rules.energy.pointsPerTier, 10, 'Actions keep their authored DEX/10 formula');
    eq(byHand.rules.draw.pointsPerTier, 10, 'Hand keeps its authored INT/10 formula');
    eq(byHand.rules.mana.pointsPerTier, 1, 'Mana inherits the edited fallback default');
    eq(byHand.rules.stamina.pointsPerTier, 1, 'Stamina inherits the edited fallback default');

    // AND ONE LEVEL IS NOW VISIBLE, which is the sentence his ask is made of.
    at1.cinders = 5000;
    const at1Hp = at1.maxHp;
    applyLevelUp(REG, at1, 'constitution', { pointsPerLevel: 1 });
    assert(at1.maxHp > at1Hp, 'at a 2-point tier, CON 11 to 12 crosses the boundary and moves max HP');
    at5.cinders = 5000;
    const at5Hp = at5.maxHp;
    applyLevelUp(REG, at5, 'constitution', { pointsPerLevel: 1 });
    eq(at5.maxHp, at5Hp + 2, 'under the shipping per-CON formula one point adds two HP');

    // A RUN IN PROGRESS KEEPS THE RULES IT WAS BORN UNDER. This is what the
    // settings row's note promises a player, and it is the behaviour that makes
    // the dial safe rather than a defect.
    const store = createMemoryStorage();
    at1.seedString = 'TIER1';
    createSaveManager(store).saveRun(at1);
    const reloaded = createSaveManager(store).loadRun(REG);
    assert(reloaded !== null, 'a dialled run loads');
    eq(reloaded.derivedStatRuleSnapshot.rules.rules.hp.pointsPerTier, 2,
      'and still carries ITS OWN tier size, whatever the setting says today');
    eq(reloaded.maxHp, at1.maxHp, 'so its HP is not re-stated behind the player');
  });

  // ---- 60d. the typed level value, and every door a field opens ------------
  test('60d. a typed level value resolves to an integer in domain, whatever is stored', () => {
    // Constantine, 2026-08-17: "i don't want a dial for hte level up, I want to
    // be able to enter the value myself and maybe a slider with it that is
    // synced with the value." A ladder could only ever hold four legal values;
    // a FIELD can hold anything, so these are the edges that did not exist
    // before the control changed.
    const row = settingsRow('levelUpValue');
    eq(row.type, 'number', 'the level value is a typed field, not a chip ladder');
    eq(row.min, REG.balance.levelUp.pointsPerLevelMin, 'its floor is the authored one');
    eq(row.max, REG.balance.levelUp.pointsPerLevelMax, 'and so is its ceiling — no number is typed in the UI');
    // ONE DOMAIN, TWO CONTROLS: the field and the slider are rendered from this
    // row, so there is nothing for them to disagree about.

    const cases = [
      [undefined, 1, 'unset is the default'],
      ['', 1, 'an empty field is the default and NOT a zero'],
      [null, 1, 'null is the default'],
      ['lots', 1, 'a word is the default — unreadable is unset'],
      [NaN, 1, 'NaN is the default'],
      [Infinity, 1, 'Infinity is the default'],
      [0, 1, 'zero clamps up: a level that grants nothing is a purchase that does nothing'],
      [-3, 1, 'a negative clamps up — levelling can never take a point away'],
      [1, 1, 'the floor itself is legal'],
      [7, 7, 'an arbitrary value in domain is kept, which is the whole ask'],
      ['  7  ', 7, 'whitespace is trimmed, because a field lets him type it'],
      ['7', 7, 'a string of digits is a number — this is what an input element gives us'],
      [2.7, 2, 'a fraction FLOORS: attributes are integers and floor is this tree\'s rounding'],
      [20, 20, 'the ceiling itself is legal'],
      [21, 20, 'one past the ceiling clamps down'],
      [1e9, 20, 'and so does absurdity'],
    ];
    for (const [stored, want, why] of cases) {
      eq(resolveLevelUpValue({ levelUpValue: stored }), want, `${JSON.stringify(stored)} → ${want}: ${why}`);
    }

    // THE PROPERTY UNDER ALL OF THAT, stated once: whatever is in the profile,
    // what the model receives is an integer inside the domain. A hand-edited
    // profile is the same door as a typed field.
    for (const [stored] of cases) {
      const v = resolveLevelUpValue({ levelUpValue: stored });
      assert(Number.isInteger(v) && v >= row.min && v <= row.max,
        `${JSON.stringify(stored)} resolved to ${v}, which is in domain and whole`);
    }

    // AND IT REACHES THE GAME. A value he types mid-run applies to the NEXT
    // level bought — no new run, nothing snapshotted — which is the promise the
    // row's own note makes to him.
    const run = createRunState({ seed: 0x7ed, classId: 'reaver', registries: REG });
    run.cinders = 5000;
    const typed = resolveLevelUpValue({ levelUpValue: '7' });
    applyLevelUp(REG, run, 'constitution', { pointsPerLevel: typed });
    eq(run.attributes.constitution - 11, 7, 'a level bought at a typed 7 grants seven points');
    eq(run.levelPoints, 7, 'and records seven granted');
    eq(run.levelUps, 1, 'as ONE purchase');
    // …mid-run, he changes his mind. The next level answers the new number and
    // the run stays loadable, which is the pair of facts that made levelPoints a
    // separate field in the first place.
    applyLevelUp(REG, run, 'wisdom', { pointsPerLevel: resolveLevelUpValue({ levelUpValue: '2' }) });
    eq(run.levelPoints, 9, 'nine points over two purchases at two different typed values');
    run.seedString = 'TYPED';
    const store = createMemoryStorage();
    createSaveManager(store).saveRun(run);
    assert(createSaveManager(store).loadRun(REG) !== null,
      'and the run still loads — typing a new value mid-climb cannot archive a save');

    // THE PLANT'S TARGET, named so the next reader can find it: with the clamp
    // removed, `0` reaches the model and a level grants nothing while charging
    // for it. Watched red (see the commit message).
    const zero = resolveLevelUpValue({ levelUpValue: 0 });
    assert(zero >= 1, 'the floor is what stops a paid level from granting nothing');
  });

  // ---- 60e. the affordability predicate the fold reads ---------------------
  test('60e. one derivation answers "can he afford a level", with a reason', () => {
    // Constantine: "make the flask and the level up collapsible (with level up
    // being grayed out or not visible when there isn't enough cinders)". The
    // fold and the grey-out belong to the player-experience seat; THE PREDICATE
    // is this, and it is asserted here so she can consume it without inventing
    // an affordability rule of her own.
    const run = createRunState({ seed: 0xa77, classId: 'reaver', registries: REG });
    const first = REG.balance.levelUp.firstCost;

    run.cinders = 0;
    let p = levelUpPlan(REG, run);
    eq(p.affordable, false, 'an empty purse cannot afford a level');
    eq(p.short, first, 'and `short` is the whole price, not a difference the caller computes');
    eq(p.blockedBy, 'cinders', 'the reason is a TOKEN, so a label switches on a word and never on two numbers');
    eq(p.offerable, false, 'so it is not offerable');

    // THE THRESHOLD'S OWN NEIGHBOURHOOD: one cinder either side of the price,
    // adjacent, so moving the boundary one unit of its own flips a verdict.
    run.cinders = first - 1;
    p = levelUpPlan(REG, run);
    eq(p.affordable, false, `one cinder short of ${first} is short`);
    eq(p.short, 1, 'and short says exactly one');
    run.cinders = first;
    p = levelUpPlan(REG, run);
    eq(p.affordable, true, 'the exact price is affordable — the boundary is inclusive');
    eq(p.short, 0, 'nothing is missing');
    eq(p.blockedBy, null, 'and there is no reason, because there is no block');

    // IT MOVES WITH THE RAMP, WHICH IS WHY A FOLD MUST RE-READ IT AND NOT CACHE
    // IT: the same purse that afforded level 1 may not afford level 2.
    run.cinders = 5000;
    applyLevelUp(REG, run, 'constitution');
    const after = levelUpPlan(REG, run);
    assert(after.cost > first, 'the next level costs more than the first');

    // ⚠ AND IT IS INDIFFERENT TO THE TYPED LEVEL VALUE. The dispatch that asked
    // for this predicate said the price now depends on the dial. IT DOES NOT:
    // `levelCost` is firstCost + costStep × levelsTaken and takes no third
    // argument. The dial decides what a level GRANTS, never what it COSTS.
    const poor = createRunState({ seed: 0xa78, classId: 'reaver', registries: REG });
    poor.cinders = first - 1;
    for (const value of [1, 2, 7, 20]) {
      const q = levelUpPlan(REG, poor, { pointsPerLevel: value });
      eq(q.cost, first, `at a typed ${value} the price is unchanged`);
      eq(q.short, 1, `and so is how short he is`);
      eq(q.blockedBy, 'cinders', 'affordability does not move with the dial');
    }

    // A CAP IS A DIFFERENT SENTENCE TO A PLAYER, so it is a different token —
    // and it outranks the purse, because being told to earn cinders you cannot
    // spend is worse than being told nothing.
    const capped = { ...REG, balance: { ...REG.balance, levelUp: { ...REG.balance.levelUp, maxLevels: 0 } } };
    const c = levelUpPlan(capped, poor);
    eq(c.capped, true, 'a cap of zero caps a fresh run');
    eq(c.blockedBy, 'cap', 'and the cap is the reason, not the empty purse');
    eq(c.offerable, false, 'either block closes the offer');
  });

  test('61. Fullscreen and Music share one canonical state across Settings, Quick Menu, and HUD', () => {
    const display = categoryHandler('Display').rows;
    const audio = categoryHandler('Audio').rows;
    eq(display[0].key, 'fullscreen', 'Fullscreen remains the first Display row in the canonical table');
    eq(display.filter((r) => r.key === 'fullscreen').length, 1,
      'Fullscreen moved to the first seat without being duplicated');
    assert(display.findIndex((r) => r.key === 'animSpeed') > 0,
      'Combat pacing remains available behind Fullscreen');
    eq(display.some((r) => r.key === 'fullscreen'), true,
      'Settings exposes the browser-owned Fullscreen state');
    eq(audio.some((r) => r.key === 'musicEnabled'), true,
      'Settings exposes the canonical Music preference');
    eq(audio.some((r) => r.key === 'muteMusic'), false,
      'Settings does not introduce a second Music preference');

    const presentation = REG.balance.ui.hudQuickSettings;
    eq(presentation.places.join(','), 'title,map,combat',
      'one data row places the shared controls on all three requested surfaces');
    eq(`${presentation.edgeGapPx}/${presentation.stackGapPx}`, '4/0',
      'the shared utility rail is right-edge close and has no authored inter-control gap');
    eq(`${presentation.cardSizePx}/${presentation.glyphSizePx}/${presentation.stateDotPx}/${presentation.activeTintPct}`, '40/28/6/14',
      'the shared face, 70%-scale glyph, state dot, and active tint are data-owned');
    eq(presentation.showCardBackground, true,
      'the quick utilities default to one consistent compact card on every device');
    eq(presentation.showLabels, false,
      'visible words yield to the larger universal icons while accessible names remain');
    const model = hudQuickSettingsModel({ place: 'combat', presentation, settings: {} });
    eq(model.children.length, 2, 'the shared component owns exactly Fullscreen and Music');
    const html = hudQuickSettingsHtml(model);
    assert(/aria-label="Enter fullscreen"/.test(html), 'Fullscreen keeps an accessible label');
    assert(/aria-label="Turn music off"/.test(html), 'Music keeps an accessible stateful label');
    // THE KIT SWEEP (2026-09-04): the two controls are kit IconButtons, the
    // same box as Armoury, the menu and every door's close — one class, one
    // size, one inset — so the compact-card tokens the old renderer inlined
    // (`--hud-quick-card-size` and friends) no longer reach the DOM.
    assert((html.match(/class="as-iconbtn modal-iconbtn hud-quick-setting/g) || []).length === 2,
      'Fullscreen and Music are two kit IconButtons');
    assert(/data-hud-quick-action="fullscreen"[^>]*>⛶</.test(html),
      'Fullscreen renders the kit fullscreen glyph');
    assert(/data-hud-quick-action="music"[^>]*>♫</.test(html),
      'Music renders the kit music glyph');

    const audibleMusic = musicQuickSettingsPlan({});
    eq(audibleMusic.active, true, 'Music is enabled by default');
    eq(audibleMusic.change.musicEnabled, false, 'the active quick control disables Music alone');
    const musicMuted = musicQuickSettingsPlan({ muteMusic: true });
    eq(musicMuted.active, false, 'the quick control migrates an explicit legacy Music mute');
    eq(musicMuted.change.musicEnabled, true, 'the quick control writes the canonical preference when re-enabled');
    const audioMuted = musicQuickSettingsPlan({ muteAudio: true, muteMusic: false });
    eq(audioMuted.active, true, 'master Audio mute stays distinct from the Music preference');
    eq(audioMuted.stateLabel, 'On · Audio muted', 'master mute is named without rewriting Music state');
    eq(audioMuted.change.musicEnabled, false, 'the Music control changes only the canonical preference');
    eq('muteAudio' in audioMuted.change, false, 'the Music control never releases global Audio mute');

    const restoredSettings = { muteMusic: true };
    const binding = { settings: {} };
    eq(updateHudQuickSettingsBinding(binding, restoredSettings), restoredSettings,
      'a restored profile replaces the settings object owned by the mounted HUD');
    let refreshEvent = null;
    eq(refreshHudQuickSettings({ querySelector: () => ({ dispatchEvent: (event) => { refreshEvent = event; } }) }, restoredSettings), true,
      'the title can refresh its mounted HUD without remounting the Profile dialog');
    eq(refreshEvent?.detail?.settings, restoredSettings,
      'the refresh carries the restored profile settings object');

    const quick = display.find((r) => r.key === 'quickNav');
    eq(quick.def, 'mirror', 'fresh Quick Menu state promotes Mirror while preserving explicit legacy choices');
    eq(quick.choices.join(','), 'off,mirror,switcher', 'Quick menu exposes legacy Off plus Mirror and Switcher');
    eq(display.some((r) => r.key === 'quickNavFixedEnds'), false,
      'the internal row order is not exposed as a redundant second setting');

    const unsupported = fullscreenCapability({ documentElement: {}, exitFullscreen: null });
    eq(unsupported.supported, false, 'iPhone-like documents do not receive a dead fullscreen toggle');
    const supported = fullscreenCapability({
      documentElement: { requestFullscreen() {} },
      exitFullscreen() {},
    });
    eq(supported.supported, true, 'documents with both enter and exit APIs expose fullscreen');
  });

  test('61a. Armoury is the one equipment route, and fullscreen reports browser support', () => {
    assert(!MENU_TABS.some((tab) => tab.id === 'relics'),
      'the run menu does not duplicate Armoury with a Relics & Flasks tab');
    for (const [context, rows] of Object.entries(MENU)) {
      assert(!rows.some((row) => row.tab === 'relics'),
        `${context} quick navigation has no duplicate relic/equipment route`);
      const armouryRows = rows.filter((row) => row.act === 'armoury');
      for (const row of armouryRows) eq(row.label, 'Armoury', `${context} names the canonical equipment route Armoury`);
    }

    const unsupported = { documentElement: {}, fullscreenEnabled: false };
    eq(fullscreenCapability(unsupported).supported, false,
      'a browser without the document fullscreen API is reported unsupported');
    const supported = {
      documentElement: { requestFullscreen() {} },
      exitFullscreen() {},
      fullscreenEnabled: true,
    };
    eq(fullscreenCapability(supported).supported, true,
      'a browser with request and exit support is reported supported');
    const webkit = {
      documentElement: { webkitRequestFullscreen() {} },
      webkitExitFullscreen() {},
      webkitFullscreenEnabled: true,
    };
    eq(fullscreenCapability(webkit).supported, true,
      'the prefixed fullscreen API remains a supported route');

    eq(MENU_TABS.map((tab) => tab.id).join(','), 'settings,controls',
      'the in-run overlay keeps only Settings and Controls');
    assert(!MENU_TABS.some((tab) => ['deck', 'stats', 'save'].includes(tab.id)),
      'Deck, Stats, and Save are not duplicated as overlay tabs');
  });

  test('61b. the combatant stage owns one validated safe-corridor model', () => {
    const presentation = REG.balance.ui.combatantStage;
    eq(`${presentation.hudClearanceViewportPct}/${presentation.actionClearanceViewportPct}`, '3/3',
      'the HUD and hand each reserve three percent of viewport height');
    eq(`${presentation.intentGapPx}/${presentation.centerPct}`, '6/50',
      'intent attachment and battlefield center are data-owned');
    const model = battlefieldStageModel(presentation);
    eq(model.component, 'battlefield-stage', 'the shared battlefield component owns the model');
    eq(`${model.tokens.hudClearanceViewportPct}/${model.tokens.actionClearanceViewportPct}/${model.tokens.intentGapPx}/${model.tokens.centerPct}`,
      '3/3/6/50', 'all four authored tokens reach the immutable Component Model');
    eq(battlefieldStageModel({ centerPct: 25 }).tokens.centerHeightRatio, 0.5,
      'an upper-quarter stage center only exposes the symmetric half-height corridor');
    eq(battlefieldStageModel({ centerPct: 75 }).tokens.centerHeightRatio, 0.5,
      'a lower-quarter stage center receives the same collision-safe height limit');
    eq(battlefieldStageModel({ centerPct: 50 }).tokens.centerHeightRatio, 1,
      'the default midpoint can use the full protected corridor');

    const malformed = {
      ...contentBundle,
      balance: {
        ...contentBundle.balance,
        ui: {
          ...contentBundle.balance.ui,
          combatantStage: { ...contentBundle.balance.ui.combatantStage, hudClearanceViewportPct: Infinity },
        },
      },
    };
    const validation = validateContent(malformed);
    assert(!validation.ok && validation.errors.some((error) => error.path === 'balance.ui.combatantStage.hudClearanceViewportPct'),
      'an unreadable safe clearance fails the real boot validator by name');

    const tooltipPresentation = REG.balance.ui.tooltipPlacement;
    eq(`${tooltipPresentation.hoverDelayMs}/${tooltipPresentation.autoFadeMs}`, '500/5000',
      'enemy context delay and auto-fade are authored in milliseconds');
    const tooltipModel = tooltipPlacementModel(tooltipPresentation);
    eq(`${tooltipModel.tokens.hoverDelayMs}/${tooltipModel.tokens.autoFadeMs}`, '500/5000',
      'tooltip timing reaches the immutable Component Model');
    const malformedTooltip = {
      ...contentBundle,
      balance: {
        ...contentBundle.balance,
        ui: { ...contentBundle.balance.ui, tooltipPlacement: { ...tooltipPresentation, autoFadeMs: Infinity } },
      },
    };
    const tooltipValidation = validateContent(malformedTooltip);
    assert(!tooltipValidation.ok && tooltipValidation.errors.some((error) => error.path === 'balance.ui.tooltipPlacement.autoFadeMs'),
      'a non-finite auto-fade fails the real boot validator by name');
  });

  test('62. rewards are a MENU derived from the offer, and Continue always has a meaning (E11)', () => {
    // Constantine, 2026-08-15: "the reward should start with an initial menu of
    // reward types (card, potion, armament)". His answer on the page: Continue
    // is ALWAYS pressable and a setting decides what it means — auto-collect ON
    // takes everything, picking at random where there is a choice; OFF gives
    // only what was chosen, no nagging.
    //
    // THE ROWS ARE DERIVED FROM THE OFFER (Law 0: the entry describes, the
    // machinery derives) — a kind absent from the rewards object has no row,
    // and a new reward field is one ORDER entry, not a screen redesign.

    // EDGE 1 — THE EMPTY OFFER: no rows, and Continue still resolves.
    let plan = rewardPlan({}, { flaskSlotsFree: 1 });
    eq(plan.rows.length, 0, 'an empty offer derives an empty menu');
    let res = resolveContinue(plan, {}, 'auto', () => 0);
    eq(res.take.length, 0, 'auto-collect over nothing takes nothing');

    // EDGE 2 — EVERY KIND AT ONCE (the boss shape plus a flask): five rows,
    // in the declared order, each naming its kind.
    const offer = {
      cinders: 32,
      cardIds: ['stomp', 'executioner', 'crimsonCleave'],
      flaskId: 'crimsonFlask',
      relicId: 'forsakenMedallion',
      armamentId: 'greatsword',
    };
    const continueBeat = beatFor('rewardContinue');
    eq(continueBeat.form, 'hold', 'reward Continue is registered in the shared second-beat table as a hold');
    eq(continueBeat.surface, 'reward', 'the census can route the registered action to the reward surface');
    plan = rewardPlan(offer, { flaskSlotsFree: 1, armamentSlotsFree: 1 });
    eq(plan.rows.length, 5, 'five reward kinds derive five rows');
    eq(plan.rows.map((r) => r.kind).join(','), REWARD_KIND_ORDER.filter((k) => plan.rows.some((r) => r.kind === k)).join(','),
      'rows come out in the one declared order');
    const cardRow = plan.rows.find((r) => r.kind === 'card');
    eq(cardRow.choice, true, 'a multi-card offer is a CHOICE row — it opens, it does not just apply');

    // THE FLASK BLOCK IS DERIVED, NOT DISCOVERED AT APPLY TIME: zero free
    // slots make the row blocked with a TOKEN reason (the levelUpPlan
    // precedent — a label switches on a word, never on two numbers).
    const full = rewardPlan(offer, { flaskSlotsFree: 0, armamentSlotsFree: 1 });
    eq(full.rows.find((r) => r.kind === 'flask').blockedBy, 'slots', 'a full belt blocks the flask row by name');
    eq(plan.rows.find((r) => r.kind === 'flask').blockedBy, null, 'a free slot does not');

    // THE BAG'S CAP IS DERIVED THE SAME WAY (the b6b7df0 review's P1: the
    // ninth piece against an 8-slot cap rendered takeable and poisoned
    // meta.found). Adjacent cells — one free slot leaves the row takeable,
    // zero blocks it by name — and auto refuses it the way it refuses a
    // full belt.
    const bagFull = rewardPlan(offer, { flaskSlotsFree: 1, armamentSlotsFree: 0 });
    eq(bagFull.rows.find((r) => r.kind === 'armament').blockedBy, 'storage', 'a full bag blocks the armament row by name');
    eq(plan.rows.find((r) => r.kind === 'armament').blockedBy, null, 'a free slot does not');
    res = resolveContinue(bagFull, {}, 'auto', () => 0);
    eq(res.take.some((t) => t.kind === 'armament'), false, 'auto does not force a piece into a full bag');
    eq(res.leave.find((l) => l.kind === 'armament').blockedBy, 'storage', 'the leave list carries the reason');
    // An UNSTATED fact reads as no room — conservative, so a caller that
    // forgets the fact gets a visible block, never a silent over-grant.
    eq(rewardPlan(offer, { flaskSlotsFree: 1 }).rows.find((r) => r.kind === 'armament').blockedBy, 'storage',
      'an unstated bag fact blocks rather than silently over-granting');

    // AUTO takes everything not explicitly skipped — and picks the card by the
    // SEEDED rng handed in, never its own randomness.
    res = resolveContinue(plan, {}, 'auto', (n) => 2 % n);
    eq(res.take.length, 5, 'auto over five pending rows takes five');
    eq(res.take.find((t) => t.kind === 'card').cardId, 'crimsonCleave', 'the choice is made by the injected pick');

    // A SKIP IS RESPECTED BY AUTO — his deck-discipline affordance survives
    // the setting: skip the card, Continue, and the deck gains nothing.
    res = resolveContinue(plan, { card: 'skipped' }, 'auto', () => 0);
    eq(res.take.some((t) => t.kind === 'card'), false, 'auto never overrides an explicit skip');
    eq(res.take.length, 4, 'the other four still come');

    // MANUAL takes only what was taken: everything pending is LEFT, and that
    // is the no-nagging contract — Continue works, it just means "done".
    res = resolveContinue(plan, { cinders: 'taken' }, 'manual', () => 0);
    eq(res.take.length, 0, 'manual adds nothing at Continue — taken rows were applied when tapped');
    eq(res.leave.length, 4, 'and what was never chosen is left, named');

    // A BLOCKED ROW IS NEVER TAKEN, whatever the mode — auto-collect refusing
    // a full belt is the same sentence at the same seam as the tap refusing.
    res = resolveContinue(full, {}, 'auto', () => 0);
    eq(res.take.some((t) => t.kind === 'flask'), false, 'auto does not force a flask into a full belt');
    eq(res.leave.find((l) => l.kind === 'flask').blockedBy, 'slots', 'the leave list carries the reason');

    // THE SINGLE-CARD OFFER IS NOT A CHOICE — one card auto-takes as itself.
    const one = rewardPlan({ cardIds: ['stomp'] }, { flaskSlotsFree: 1 });
    res = resolveContinue(one, {}, 'auto', () => 0);
    eq(res.take.find((t) => t.kind === 'card').cardId, 'stomp', 'a one-card row needs no pick');

    // 'NEW' IS DERIVED FROM WHAT THE PROFILE HAS HELD, with the possessions
    // handed in — the marker never invents a store it was not given.
    const seen = { cards: new Set(['stomp']), relics: new Set(), flasks: new Set(['crimsonFlask']), armaments: new Set() };
    const marks = unseenIds(offer, seen);
    eq(marks.cards.includes('stomp'), false, 'a held card is not new');
    eq(marks.cards.includes('executioner'), true, 'an unheld card is');
    eq(marks.relics.includes('forsakenMedallion'), true, 'an unheld relic is new');
    eq(marks.flasks.length, 0, 'a held flask kind is not');
  });

  test('66. E5: stat points and starting armour at creation — his numbers, both edges', () => {
    // Constantine, from the card (#250): "10 points, configurable; points come
    // back out when a stat is dropped; floor 8, ceiling 15 at creation, both
    // customizable; the floor is the reclaim limit; 15 caps CREATION, not the
    // character." Read from the mode row, never retyped elsewhere.
    const mode = REG.creationModes.all().find((m) => m.id === 'pointbuy');
    assert(mode, 'the pointbuy creation mode exists');
    eq(mode.bonusPool, 10, 'ten points');
    eq(mode.minimum, 8, 'floor 8 — the reclaim limit');
    eq(mode.maximum, 15, 'ceiling 15 at creation');
    eq(mode.belowBaseline, 'allow', 'a stat may be dropped below baseline — that is the reclaim');
    // standard is UNTOUCHED: its fixedTotal is what every existing save is
    // validated against at the load door, and save.js archives what fails there.
    const std = REG.creationModes.all().find((m) => m.id === 'standard');
    eq(std.bonusPool, 5, 'standard pool unchanged');
    eq(std.minimum, 10, 'standard floor unchanged');
    eq(allocationTotal(REG, 'pointbuy'), 60, 'pointbuy fixed total = 5x10 baseline + the 10-point pool');

    // The allocation gate, both edges at every boundary his sentence names.
    const legal = { strength: 15, dexterity: 8, constitution: 15, wisdom: 12, intelligence: 10 };
    eq(attributeAllocationProblems(REG, 'reaver', 'pointbuy', legal).length, 0,
      'floor 8 and ceiling 15 are both LEGAL cells, and dropped points respend elsewhere');
    const belowFloor = { ...legal, dexterity: 7, wisdom: 13 };
    assert(attributeAllocationProblems(REG, 'reaver', 'pointbuy', belowFloor).length > 0, '7 is below the reclaim limit');
    const overCeil = { ...legal, strength: 16, wisdom: 11 };
    assert(attributeAllocationProblems(REG, 'reaver', 'pointbuy', overCeil).length > 0, '16 is over the creation cap');
    const unspent = { ...legal, wisdom: 11 };
    assert(attributeAllocationProblems(REG, 'reaver', 'pointbuy', unspent).length > 0, 'an unspent point refuses — fixedTotal');
    // "15 caps CREATION, not the character": with levelled points granted, the
    // same machinery raises the ceiling — the clause shipped before this mode.
    eq(attributeAllocationProblems(REG, 'reaver', 'pointbuy', { ...legal, strength: 16 }, 'attributes', 1).length, 0,
      'one levelled point lifts the ceiling to 16 and pays for itself in the total');
    // Presets are complete and legal for the new mode (the content gate).
    for (const classId of REG.classes.ids()) {
      eq(attributeAllocationProblems(REG, classId, 'pointbuy', classAttributePreset(REG, classId, 'pointbuy')).length, 0,
        `pointbuy preset for '${classId}' is a legal allocation`);
    }
    // And a run actually carries a pointbuy allocation through creation.
    const run = createRunState({ seed: 1, classId: 'reaver', registries: REG, attributeMode: 'pointbuy', attributes: legal });
    eq(run.attributeMode, 'pointbuy', 'the run records the mode');
    eq(run.attributes.strength, 15, 'and the allocation, not the preset');

    // STARTING ARMOUR. The JSON creation roster ships two immediately; earned
    // sets may widen that list without becoming a second UI-only roster.
    const fresh = startingArmourViews(REG, 'reaver', {});
    eq(fresh.length, 2, 'a fresh profile starts with both JSON-authored choices');
    eq(fresh[0].free, true, 'and it is the free one');
    assert(fresh.some((v) => v.id === 'vigil'), 'the alternate authored starting set is available by name');
    const oathUnlock = outfits.find((o) => o.id === 'oathsworn' && o.classId === 'reaver').unlock;
    const veteran = { unlocked: [oathUnlock] };
    const views = startingArmourViews(REG, 'reaver', veteran);
    eq(views.length, 3, 'an earned prize becomes an additional starting choice');
    assert(views.some((v) => v.id === 'oathsworn'), 'and it is the earned set by name');
    // Resolution, both edges: the earned set resolves; the unearned refuses BY
    // NAME; a foreign class refuses; absent falls to the free set (yesterday's
    // behaviour for every caller that never heard of the parameter).
    eq(resolveStartingArmour(REG, 'reaver', 'vigil', {}).id, 'vigil', 'JSON-authored alternate resolves without progression');
    let threw = null;
    try { resolveStartingArmour(REG, 'reaver', 'warden', {}); } catch (e) { threw = String(e.message); }
    assert(threw && threw.includes('warden'), `unconfigured and unearned set refuses BY NAME — got ${threw}`);
    threw = null;
    try { resolveStartingArmour(REG, 'starseer', 'vigil', veteran); } catch (e) { threw = String(e.message); }
    assert(threw && threw.includes('starseer'), `another class's set refuses and names the class — got ${threw}`);
    eq(resolveStartingArmour(REG, 'reaver', undefined, {}).id, 'default', 'absent means the free set');
    // And the run WEARS the choice: the loadout row is the persisted home.
    const worn = createRunState({ seed: 1, classId: 'reaver', registries: REG, startingArmourId: 'vigil', profileMeta: veteran });
    eq(worn.loadout.sets.armor[0], 'vigil', 'the run begins in the chosen set');
    const vigil = REG.equipment.armour.find((piece) => piece.classId === 'reaver' && piece.id === 'vigil');
    const defaultArmour = REG.equipment.armour.find((piece) => piece.classId === 'reaver' && piece.id === 'default');
    assert(equipPiece(REG, worn.loadout, 'armor', 0, defaultArmour.id,
      ownership(REG, { meta: {}, loadout: worn.loadout }), AT_CAMP), 'the creation armour can be switched away from');
    assert(ownership(REG, { meta: {}, loadout: worn.loadout }).has(vigil),
      'a JSON-authored creation armour remains owned after switching away');
    assert(equipPiece(REG, worn.loadout, 'armor', 0, vigil.id,
      ownership(REG, { meta: {}, loadout: worn.loadout }), AT_CAMP), 'the granted creation armour can be equipped again');
    const wornRestored = deserializeRun(serializeRun(worn));
    validateRunStartingKit(wornRestored, REG, {});
    assert(ownership(REG, { meta: {}, loadout: wornRestored.loadout }).has(vigil),
      'the creation armour grant remains owned across the save boundary');
    const plain = createRunState({ seed: 1, classId: 'reaver', registries: REG });
    eq(plain.loadout.sets.armor[0], 'default', 'and without a choice, in the free set — unchanged');
  });

  test('70. unified Inventory derives equipment, relics, potion stacks, and equipped tags', () => {
    const run = createRunState({ seed: 0x315, classId: 'reaver', registries: REG });
    run.flasks = [
      { flaskId: 'crimsonFlask' },
      { flaskId: 'crimsonFlask' },
      { flaskId: 'azureFlask' },
    ];
    const rows = inventoryRows(REG, run, {});

    eq(rows.some((row) => row.category === 'Armour'), true, 'the current armour is present');
    eq(rows.some((row) => row.category === 'Weapon'), true, 'weapons are present');
    eq(rows.some((row) => row.category === 'Shield'), true, 'shields are present');
    eq(rows.some((row) => row.category === 'Relic'), true, 'relics are present');
    eq(rows.some((row) => row.category === 'Potion'), true, 'potions are present');

    const sword = rows.find((row) => row.id === 'straightSword');
    const shield = rows.find((row) => row.id === 'roundShield');
    const armour = rows.find((row) => row.category === 'Armour');
    // THE LABEL IS CONTENT, and this row asserts the value content currently
    // holds: equipSlots.csv renamed Right/Left Hand to Main/Off Hand, so these
    // strings moved with it. What did NOT move is what the assertion is really
    // about — that the slot, not the armament, records which hand holds it
    // (test 1944: every armament is side-neutral).
    assert(sword.equippedLabels.includes('Main Hand'), 'the sword reports its equipped hand');
    assert(shield.equippedLabels.includes('Off Hand'), 'the shield reports its equipped hand');
    assert(armour.equippedLabels.includes('Armour'), 'the worn set reports its equipped slot');
    assert(rows.find((row) => row.category === 'Relic').equippedLabels.includes('Equipped'), 'held relics are active equipment');

    const crimson = rows.find((row) => row.id === 'crimsonFlask');
    eq(crimson.count, 2, 'duplicate potions collapse into one row with a count');
    eq(crimson.equippedLabels.length, 0, 'carried potions do not claim to be equipped');
    eq(inventoryItemCount(rows), rows.reduce((sum, row) => sum + row.count, 0), 'the Inventory header count is the summed quantity');
    eq(inventoryItemCount([]), 0, 'the empty Inventory count is zero');
  });

  test('71. character creation choices are validated data and Begin consumes the selected loadout', () => {
    eq(characterCreationProblems(REG).length, 0, 'the shipped character-creation configuration validates');
    eq(defaultCreationModeId(REG), 'tuned', 'the internal creation default remains tuned for legacy and non-screen callers');
    eq(creationModeViews(REG).map((row) => row.id).join(','), 'standard,pointbuy',
      'the player-visible creation modes are the authored Standard and Assign Points pair');
    eq(REG.characterCreation.spritePreviewSide, 'right', 'sprite side is read from JSON configuration');
    eq(REG.characterCreation.layout.classPreviewPercent, 30, 'the wide class preview split is read from JSON configuration');
    eq(REG.characterCreation.layout.classChoiceView, 'list', 'the class selector defaults to the configured list view');
    eq(REG.characterCreation.layout.equipmentChoiceView, 'list', 'equipment selectors default to the configured list view');
    eq(REG.characterCreation.layout.equipmentAutoAdvance, true, 'equipment auto-advance is configured rather than hard-coded');
    eq(REG.characterCreation.equipmentSections.map((row) => row.id).join(','), 'armour,rightHand,leftHand,equipSlot,relic',
      'the equipment subcard order is authored in character-creation content');
    const projectedSections = creationEquipmentSectionViews(REG, 'reaver');
    eq(projectedSections.map((row) => row.id).join(','), 'armour,rightHand,leftHand,relic',
      'only equipment sections with resolved legal choices are visible');
    eq(projectedSections.map((row) => row.nextId || '').join(','), 'rightHand,leftHand,relic,',
      'auto-advance and focus follow the filtered authored section order');
    assert(!projectedSections.some((row) => row.id === 'equipSlot'),
      'the empty authored equip slot is absent rather than rendered as a placeholder');
    for (const classId of REG.classes.ids()) {
      assert(creationArmourChoices(REG, classId).length >= 2, `${classId} ships at least two armour choices`);
      assert(creationHandChoices(REG, classId).length >= 2, `${classId} ships at least two side-neutral hand choices`);
      assert(creationRelicChoices(REG, classId).length >= 2, `${classId} ships at least two relic choices`);
    }

    const withAuthoredSlot = { ...contentBundle, characterCreation: structuredClone(contentBundle.characterCreation), equipment: structuredClone(contentBundle.equipment) };
    withAuthoredSlot.equipment.armaments.push({
      ...withAuthoredSlot.equipment.armaments[0], id: 'testCharm', name: 'Test Charm', kind: 'talisman', hand: '',
    });
    withAuthoredSlot.characterCreation.classes.reaver.equipSlotIds = ['testCharm'];
    const authoredSlotViews = creationEquipmentSectionViews(createRegistries(withAuthoredSlot), 'reaver');
    eq(authoredSlotViews.map((row) => row.id).join(','), 'armour,rightHand,leftHand,equipSlot,relic',
      'a future valid authored option makes its section appear without a screen-code edit');
    eq(authoredSlotViews.find((row) => row.id === 'equipSlot').choices[0].id, 'testCharm',
      'the future section carries the resolved authored option');

    const danglingSlot = { ...contentBundle, characterCreation: structuredClone(contentBundle.characterCreation) };
    danglingSlot.characterCreation.classes.reaver.equipSlotIds = ['missingCharm'];
    let danglingSlotError = '';
    try { creationEquipmentSectionViews(createRegistries(danglingSlot), 'reaver'); } catch (error) { danglingSlotError = error.message; }
    assert(/equipSlotIds.*missingCharm.*does not resolve/.test(danglingSlotError),
      'a missing authored equipment option fails closed by its configuration path');

    const incompatibleSlot = { ...contentBundle, characterCreation: structuredClone(contentBundle.characterCreation) };
    incompatibleSlot.characterCreation.classes.reaver.equipSlotIds = ['straightSword'];
    let incompatibleSlotError = '';
    try { creationEquipmentSectionViews(createRegistries(incompatibleSlot), 'reaver'); } catch (error) { incompatibleSlotError = error.message; }
    assert(/equipSlotIds.*straightSword.*does not fit.*talisman/.test(incompatibleSlotError),
      'an incompatible authored equipment option fails closed instead of disappearing or rendering');

    const moved = selectStartingHand({ leftHand: 'roundShield', rightHand: 'straightSword' }, 'leftHand', 'straightSword');
    eq(moved.leftHand, 'straightSword', 'selecting an occupied armament places it in the requested hand');
    eq(moved.rightHand, null, 'and clears the other hand instead of duplicating it');
    eq(Object.values(moved).filter((id) => id === 'straightSword').length, 1, 'one armament occupies exactly one starting hand');

    const sideSpecific = createRegistries({
      ...contentBundle,
      equipment: {
        ...contentBundle.equipment,
        armaments: contentBundle.equipment.armaments.map((piece) => (
          piece.id === 'buckler' ? { ...piece, hand: 'left' } : piece
        )),
      },
    });
    assert(creationHandChoices(sideSpecific, 'reaver', 'leftHand').some((piece) => piece.id === 'buckler'),
      'a side-specific armament is offered for its eligible creation hand');
    assert(!creationHandChoices(sideSpecific, 'reaver', 'rightHand').some((piece) => piece.id === 'buckler'),
      'a side-specific armament is not offered for an incompatible creation hand');
    eq(resolveCreationHands(sideSpecific, 'reaver', { leftHand: 'buckler', rightHand: null }, {}).leftHand, 'buckler',
      'creation hand resolution accepts a side-specific armament in its eligible slot');
    let wrongHandError = '';
    try { resolveCreationHands(sideSpecific, 'reaver', { leftHand: null, rightHand: 'buckler' }, {}); }
    catch (error) { wrongHandError = error.message; }
    assert(/rightHand.*buckler.*does not fit/.test(wrongHandError),
      'creation hand resolution rejects a side-specific armament in the wrong slot');

    const lowStrength = { strength: 11, dexterity: 15, constitution: 14, wisdom: 10, intelligence: 10 };
    eq(attributeAllocationProblems(REG, 'reaver', 'pointbuy', lowStrength).length, 0,
      'the incompatible preview fixture is still a valid point-buy allocation');
    const requestedHands = { leftHand: 'roundShield', rightHand: 'greatsword' };
    const previewHands = previewCompatibleHands(REG, requestedHands, lowStrength);
    eq(previewHands.leftHand, 'roundShield', 'preview keeps a compatible selected hand');
    eq(previewHands.rightHand, null, 'preview omits an incompatible selected hand instead of throwing');
    eq(requestedHands.rightHand, 'greatsword', 'preview compatibility never mutates the player selection used by the refusal');
    const correctedHands = previewCompatibleHands(REG, requestedHands, { ...lowStrength, strength: 12, dexterity: 14 });
    eq(correctedHands.rightHand, 'greatsword', 'preview restores the selected hand when the allocation meets its requirement');
    const previewRun = createRunState({
      seed: 71, classId: 'reaver', registries: REG,
      attributeMode: 'pointbuy', attributes: lowStrength,
      startingHands: previewHands,
    });
    eq(previewRun.attributes.strength, 11, 'a valid-but-incompatible selection still produces a live stat preview');

    const standardMismatch = { ...contentBundle, characterCreation: structuredClone(contentBundle.characterCreation) };
    standardMismatch.characterCreation.classes.herald.handIds.push('dagger');
    const standardRosterValidation = validateContent(standardMismatch);
    assert(standardRosterValidation.ok, 'a valid roster may expose an armament above the Standard preset');
    const standardMismatchRegistries = createRegistries(standardMismatch);
    const heraldStandard = classAttributePreset(standardMismatchRegistries, 'herald', 'standard');
    const standardFailure = startingHandsRequirementFailure(standardMismatchRegistries, { leftHand: 'dagger' }, heraldStandard);
    assert(standardFailure && standardFailure.piece.id === 'dagger'
      && standardFailure.failure.attributeId === 'dexterity'
      && standardFailure.failure.required === 11 && standardFailure.failure.actual === 10,
    'Standard mode reports a selected hand requirement before Begin can throw');

    const selected = createRunState({
      seed: 69, classId: 'reaver', registries: REG,
      startingHands: { leftHand: 'straightSword', rightHand: 'roundShield' },
      startingArmourId: 'vigil', startingRelicId: 'goldenSprout',
    });
    eq(selected.loadout.sets.leftHand[0], 'straightSword', 'Begin consumes the selected left hand');
    eq(selected.loadout.sets.rightHand[0], 'roundShield', 'Begin consumes the selected right hand');
    eq(selected.loadout.sets.armor[0], 'vigil', 'Begin consumes the selected armour');
    eq(selected.relics[0], 'goldenSprout', 'Begin consumes the selected relic');
    assert(selected.startingKitSnapshot.customized === true, 'the customized starting hands persist explicitly');
    const restored = deserializeRun(serializeRun(selected));
    validateRunStartingKit(restored, REG, {});
    eq(restored.startingKitSnapshot.leftHand, 'straightSword', 'customized hands survive the save boundary');

    const malformed = { ...contentBundle, characterCreation: structuredClone(contentBundle.characterCreation) };
    malformed.characterCreation.spritePreviewSide = 'above';
    malformed.characterCreation.classes.reaver.handIds = ['missingArmament'];
    const validation = validateContent(malformed);
    assert(!validation.ok && validation.errors.some((e) => e.path.includes('characterCreation.spritePreviewSide')),
      'an invalid sprite side fails by its JSON path');
    assert(validation.errors.some((e) => e.path.includes('characterCreation.classes.reaver.handIds')),
      'a short/dangling hand roster fails by its JSON path');

    const malformedLayout = { ...contentBundle, characterCreation: structuredClone(contentBundle.characterCreation) };
    malformedLayout.characterCreation.layout.classPreviewPercent = 90;
    malformedLayout.characterCreation.layout.classChoiceView = 'carousel';
    malformedLayout.characterCreation.layout.equipmentAutoAdvance = 'yes';
    malformedLayout.characterCreation.equipmentSections = [
      { id: 'armour', label: 'Armour', kind: 'armour' },
      { id: 'armour', label: '', kind: 'hand', slot: 'middleHand' },
    ];
    const layoutValidation = validateContent(malformedLayout);
    for (const path of ['layout.classPreviewPercent', 'layout.classChoiceView', 'layout.equipmentAutoAdvance', 'equipmentSections']) {
      assert(!layoutValidation.ok && layoutValidation.errors.some((e) => e.path.includes(`characterCreation.${path}`)),
        `invalid configurable creation ${path} reports its JSON path`);
    }

    const duplicateSections = { ...contentBundle, characterCreation: structuredClone(contentBundle.characterCreation) };
    duplicateSections.characterCreation.equipmentSections.push(
      { id: 'armourAgain', label: 'Armour Again', kind: 'armour' },
      { id: 'leftAgain', label: 'Left Again', kind: 'hand', slot: 'leftHand' },
      { id: 'relicAgain', label: 'Relic Again', kind: 'relic' },
    );
    const duplicateSectionProblems = characterCreationProblems(duplicateSections);
    for (const role of ['armour', 'leftHand', 'relic']) {
      assert(duplicateSectionProblems.some((problem) => problem.includes(`duplicate ${role} section`)),
        `a duplicate ${role} role is rejected before rendering singleton equipment disclosures`);
    }

    const malformedKeepsakes = { ...contentBundle, characterCreation: structuredClone(contentBundle.characterCreation) };
    malformedKeepsakes.characterCreation.keepsakes = {};
    const keepsakeValidation = validateContent(malformedKeepsakes);
    assert(!keepsakeValidation.ok && keepsakeValidation.errors.some((e) => e.path.includes('characterCreation.keepsakes')),
      'a non-array keepsake roster reports its JSON path instead of throwing');

    const malformedClass = { ...contentBundle, characterCreation: structuredClone(contentBundle.characterCreation) };
    malformedClass.characterCreation.classes.reaver = null;
    const classValidation = validateContent(malformedClass);
    assert(!classValidation.ok && classValidation.errors.some((e) => e.path.includes('characterCreation.classes.reaver')),
      'a null class roster reports its JSON path instead of throwing');

    const malformedChoices = { ...contentBundle, characterCreation: structuredClone(contentBundle.characterCreation) };
    for (const field of ['armourIds', 'handIds', 'relicIds']) malformedChoices.characterCreation.classes.reaver[field] = {};
    const choiceValidation = validateContent(malformedChoices);
    for (const field of ['armourIds', 'handIds', 'relicIds']) {
      assert(!choiceValidation.ok && choiceValidation.errors.some((e) => e.path.includes(`characterCreation.classes.reaver.${field}`)),
        `a non-array ${field} roster reports its JSON path instead of throwing`);
    }

    const malformedKeepsakeRows = { ...contentBundle, characterCreation: structuredClone(contentBundle.characterCreation) };
    malformedKeepsakeRows.characterCreation.keepsakes[0] = null;
    malformedKeepsakeRows.characterCreation.keepsakes[1].effects = {};
    const keepsakeRowValidation = validateContent(malformedKeepsakeRows);
    assert(!keepsakeRowValidation.ok && keepsakeRowValidation.errors.some((e) => e.path.includes('characterCreation.keepsakes')),
      'null and malformed keepsake rows report their JSON paths instead of throwing during effect validation');

    for (const [label, mutate] of [
      ['class', (bundle) => { bundle.classes[0] = null; }],
      ['armament', (bundle) => { bundle.equipment.armaments[0] = null; }],
    ]) {
      const malformedDependency = {
        ...contentBundle,
        classes: [...contentBundle.classes],
        equipment: { ...contentBundle.equipment, armaments: [...contentBundle.equipment.armaments] },
      };
      mutate(malformedDependency);
      const dependencyValidation = validateContent(malformedDependency);
      assert(!dependencyValidation.ok,
        `a null ${label} dependency row returns validation errors instead of throwing`);
    }

    for (const field of ['armaments', 'armour']) {
      const malformedTable = {
        ...contentBundle,
        equipment: { ...contentBundle.equipment, [field]: {} },
      };
      const tableValidation = validateContent(malformedTable);
      assert(!tableValidation.ok && tableValidation.errors.some((error) => error.path.includes(`equipment.${field}`)),
        `a non-array ${field} dependency table returns its schema error instead of throwing`);
    }

    const missingBaselineHands = { ...contentBundle, characterCreation: structuredClone(contentBundle.characterCreation) };
    missingBaselineHands.characterCreation.classes.reaver.handIds = ['greatsword', 'buckler'];
    const baselineHandValidation = validateContent(missingBaselineHands);
    assert(!baselineHandValidation.ok && baselineHandValidation.errors.some((e) =>
      e.path.includes('characterCreation.classes.reaver.handIds') && /roundShield|straightSword/.test(e.msg)),
    'a hand roster that omits the baseline kit is refused by armament id before customization boots');
  });

  test('71b. attribute cards derive their summaries, benefits, and gates from model data', () => {
    const run = createRunState({ seed: 0x71b, classId: 'reaver', registries: REG });
    const cards = attributeCardModels(REG, run.attributes, {
      projection: statProjection(REG, run),
      equipmentProfiles: run.equipmentProfileRuleSnapshot.profiles,
    });
    eq(cards.length, REG.attributes.ids().length, 'one card is projected for every authored attribute');
    eq(cards.map((card) => card.key).join(','), REG.attributes.ids().map((id) => `attribute:${id}`).join(','),
      'stable attribute ids drive every card key');
    const constitution = cards.find((card) => card.id === 'constitution');
    // THE FACE SAYS WHAT A POINT BUYS (Constantine, 2026-09-04: "stats show
    // flavor text instead of useful information"). Still derived, never copied
    // prose — from `derivedStatRules`, the run's own derivation — and each
    // fact carries its own cadence because they differ. The authored sentence
    // is still there, as the fold's flavour.
    eq(constitution.face.summary, '+2 HP per pt · +1 Stamina per 5 pts',
      'the face summary is derived from the rules that read the attribute');
    eq(constitution.reveal.flavour, 'What your body takes before the climb ends.',
      'the authored description is still derived, as the fold\'s flavour');
    assert(constitution.reveal.lines.some((line) => /^HP \+2 every 1 point$/.test(line))
      && constitution.reveal.lines.some((line) => /^Stamina \+1 every 5 points$/.test(line)),
    'multiple mechanical benefits are projected as separate bullets');
    assert(cards.find((card) => card.id === 'strength').reveal.lines.includes('Physical attacks +1 every 1 point'),
      'the active run profile projects Strength attack scaling without copied UI prose');

    const changed = {
      ...contentBundle,
      derivedStatRules: structuredClone(contentBundle.derivedStatRules),
      equipment: {
        ...contentBundle.equipment,
        armaments: structuredClone(contentBundle.equipment.armaments),
      },
    };
    changed.derivedStatRules.rules.hp.gainPerTier = 7;
    changed.equipment.armaments.find((piece) => piece.id === 'greatsword').requirements.attributes.strength = 14;
    const changedRegistries = createRegistries(changed);
    const changedRun = createRunState({ seed: 0x71b, classId: 'reaver', registries: changedRegistries });
    const changedCards = attributeCardModels(changedRegistries, changedRun.attributes, {
      projection: statProjection(changedRegistries, changedRun),
      equipmentProfiles: changedRun.equipmentProfileRuleSnapshot.profiles,
    });
    assert(changedCards.find((card) => card.id === 'constitution').reveal.lines.includes('HP +7 every 1 point'),
      'changing the HP rule changes the Constitution bullet without UI prose edits');
    assert(changedCards.find((card) => card.id === 'strength').reveal.lines.includes('Greatsword asks 14'),
      'changing an equipment gate changes the Strength bullet without UI prose edits');
  });

  test('72. Armoury layout is authored, stable, and responsive', () => {
    assert(contentBundle.equipment.armouryUi.layout.trays,
      'the generated content bundle carries the authored tray contract rather than recreating it from model defaults');
    const layout = normalizeArmouryLayout(contentBundle.equipment.armouryUi.layout);
    eq(layout.shell.characterRatio, 0.4, 'character pane owns the authored 40% desktop share');
    eq(layout.shell.equipmentRatio, 0.6, 'equipment pane owns the authored 60% desktop share');
    eq(layout.character.spriteRatio, 0.38, 'sprite owns the authored 38% character height');
    eq(layout.character.statsRatio, 0.62, 'stats own the authored 62% character height');
    eq(layout.character.statsPaneRatio, 0.6, 'Character gives the right column 60% of the full-width character pane');
  eq(layout.cards.defaultView, 'list', 'Cards defaults to the authored vertical list');
  eq(layout.cards.gridColumns, 4, 'Cards grid columns are authored as four');
    eq(layout.responsive.phone.cardsGridColumns, 2, 'Phone Cards grid columns are authored as two');
    eq(layout.equipment.defaultView, 'list', 'Armaments defaults to the authored detailed list');
    eq(layout.equipment.gridColumns, 3, 'Armaments grid columns are authored as three');
    eq(layout.responsive.phone.armamentGridColumns, 2, 'Phone Armaments grid columns are authored as two');
    eq(layout.equipment.slotOrder.join(','), 'armor,rightHand,leftHand', 'equipment order is authored armor then right and left hand');
    eq(layout.combatPower.cards.map((card) => card.id).join(','), 'strike,potency,defense', 'Combat Power cards are authored in vertical display order');
    eq(layout.combatPower.cards[1].label, 'Magic', 'the primary technique-facing combat value is presented as Magic');
    eq(layout.combatPower.cards[1].fullLabel, 'Magic Power', 'the expanded primary value is presented as Magic Power, not Potency');
    eq(layout.viewModes.grid.label, 'Character', 'the character view has a player-facing authored label');
    eq(layout.viewModes.rack.label, 'Inventory', 'the inventory view has a player-facing authored label');
    eq(layout.viewModes.grid.pane, 'character', 'Character promotes the character pane to the full surface');
    eq(layout.viewModes.rack.pane, 'inventory', 'Inventory pairs the armaments and inventory panes');
    eq(layout.viewModes.rack.armaments, 'expanded', 'Inventory exposes the authored Armaments position list');
    eq(layout.viewModes.hybrid.pane, 'both', 'Hybrid keeps the two panes split');
    eq(layout.viewModes.hybrid.armaments, 'expanded', 'Hybrid preserves its currently approved visible Armaments pane');
    eq(layout.inventorySplit.snapRatios.join(','), '0.4,0.5,0.6,0.7', 'Inventory pane widths snap to authored ratios');
    eq(layout.inventorySplit.foldSubcardsBelowPx, 420, 'narrow armament subcards fold at an authored pane width');
    eq(layout.trays.defaultHeightRatio, 0.45, 'a supporting tray opens at the authored 45vh play-session default');
    eq(layout.trays.minimumHeightRatio, 0.3, 'tray resize keeps the authored 30vh minimum visible');
    eq(layout.trays.maximumHeightRatio, 0.9, 'a tray can scale to the authored near-full-panel maximum');
    eq(layout.trays.multipleExpandedMinimumRatio, 0.3, 'each additional expanded tray retains at least 30vh');
    eq(layout.trays.snapRatios.join(','), '0.3,0.4,0.5,0.6,0.7,0.8,0.9', 'independent tray heights snap every 10vh from 30 through 90');
    eq(layout.trays.contentGapRem, 0.35, 'Inventory tray content keeps one authored row gap across resolutions');
    assert(layout.cardClasses.inventoryItem.holdAction === true,
      'the Inventory item card class explicitly opts into the shared hold action on both folded and unfolded faces');
    assert(normalizeArmouryLayout({}).cardClasses.inventoryItem.holdAction === false,
      'card classes do not acquire a destructive hold action unless their authored model toggles it true');
    let invalidHoldClass = '';
    try { normalizeArmouryLayout({ cardClasses: { inventoryItem: { holdAction: 'true' } } }); } catch (error) { invalidHoldClass = error.message; }
    assert(invalidHoldClass.includes('holdAction must be true or false'),
      'the card class hold capability rejects truthy strings instead of silently arming them');
    eq(layout.comparison.presentation, 'tooltip', 'equipment comparison presentation is authored as tooltip or inline data');
    eq(layout.comparison.holdPreviewDelayMs, 160, 'equipment comparison sustained-hold preview delay is authored in milliseconds');
    eq(layout.comparison.tooltipWidthRem, 52, 'equipment comparison tooltip width is authored rather than buried in CSS');
    eq(layout.comparison.tooltipMaxHeightRatio, 0.8, 'equipment comparison tooltip viewport cap is authored');
    let invalidComparison = '';
    try { normalizeArmouryLayout({ comparison: { presentation: 'drawer' } }); } catch (error) { invalidComparison = error.message; }
    assert(invalidComparison.includes('comparison.presentation must be tooltip or inline'),
      'unknown equipment comparison presentations are refused by name');
    let invalidComparisonDelay = '';
    try { normalizeArmouryLayout({ comparison: { holdPreviewDelayMs: -1 } }); } catch (error) { invalidComparisonDelay = error.message; }
    assert(invalidComparisonDelay.includes('comparison.holdPreviewDelayMs'),
      'negative equipment comparison hold preview delays are refused by name');
    const sharedInventoryRow = {
      key: 'weapon:straightSword', id: 'straightSword', name: 'Straight Sword', category: 'Weapon',
      count: 1, equippedLabels: [], item: { name: 'Straight Sword', tags: [] },
    };
    assert(inventoryItemCardModel(sharedInventoryRow, { classModel: layout.cardClasses.inventoryItem }).properties.holdAction === true,
      'the shared folded Inventory card model projects the opted-in class hold capability');
    assert(inventoryItemCardModel(sharedInventoryRow).properties.holdAction === false,
      'the shared folded Inventory card model remains hold-safe without an opted-in class');
    assert(inventoryDetailCardModel({
      row: sharedInventoryRow, art: { kind: 'icon', value: '†' }, description: '', mods: [],
      classModel: layout.cardClasses.inventoryItem,
    }).properties.holdAction === true,
    'the shared unfolded Inventory card model projects the same opted-in class hold capability');
    assert(inventoryDetailCardModel({
      row: sharedInventoryRow, art: { kind: 'icon', value: '†' }, description: '', mods: [],
    }).properties.holdAction === false,
    'the shared unfolded Inventory card model remains hold-safe without an opted-in class');
    eq(contentBundle.balance.ui.holdConfirm.def, 'normal',
      'the universal hold setting defaults normal so state-changing options expose click-review and hold-direct from first run');
    eq(contentBundle.balance.ui.titleLoadHold.ms, 600,
      'the title quick-load hold duration is authored as 600 ms');
    const malformedTitleLoadHold = {
      ...contentBundle,
      balance: {
        ...contentBundle.balance,
        ui: { ...contentBundle.balance.ui, titleLoadHold: { ms: 0 } },
      },
    };
    const titleLoadHoldValidation = validateContent(malformedTitleLoadHold);
    assert(!titleLoadHoldValidation.ok
      && titleLoadHoldValidation.errors.some((error) => error.path === 'balance.ui.titleLoadHold.ms'),
    'a non-positive title quick-load duration is refused by its authored path');
    const expandedTray = trayPresentationState({
      collapsed: false,
      savedHeightRatio: 0.7,
      defaultHeightRatio: layout.trays.defaultHeightRatio,
    });
    eq(expandedTray.heightRatio, 0.7, 'an unfolded tray restores its independently saved expanded height');
    assert(expandedTray.resizable, 'an unfolded tray exposes its resize edge');
    const foldedTray = trayPresentationState({
      collapsed: true,
      savedHeightRatio: 0.7,
      defaultHeightRatio: layout.trays.defaultHeightRatio,
    });
    eq(foldedTray.heightRatio, null, 'a folded tray ignores the saved expanded height and uses its intrinsic header height');
    assert(!foldedTray.resizable, 'a folded tray cannot retain or expose its resize edge');
    eq(foldedTray.savedHeightRatio, 0.7, 'folding preserves the expanded height for the next unfold');
    const selectedMove = inventorySelectionAction({
      itemId: 'straightSword',
      selectedSlotId: 'rightHand',
      selectedSetIndex: 0,
      selectedItemId: 'roundShield',
      equippedPositions: [{ slotId: 'leftHand', setIndex: 0, itemId: 'straightSword' }],
    });
    eq(`${selectedMove.kind}:${selectedMove.slotId}:${selectedMove.setIndex}:${selectedMove.pieceId}`,
      'move:rightHand:0:straightSword',
      'a selected compatible position takes precedence over the hand that currently owns the item');
    const selectedUnequip = inventorySelectionAction({
      itemId: 'straightSword',
      selectedSlotId: 'rightHand',
      selectedSetIndex: 0,
      selectedItemId: 'straightSword',
      equippedPositions: [{ slotId: 'rightHand', setIndex: 0, itemId: 'straightSword' }],
    });
    eq(`${selectedUnequip.kind}:${selectedUnequip.pieceId}`,
      'unequip:null',
      'the selected position turns its currently equipped Inventory item into Unequip');
    for (const badTrays of [
      { ...layout.trays, defaultHeightRatio: 0.95 },
      { ...layout.trays, multipleExpandedMinimumRatio: 0.2 },
      { ...layout.trays, snapRatios: [0.3, 0.5, 0.95] },
      { ...layout.trays, snapRatios: [0.3, 0.5, 0.5] },
      { ...layout.trays, contentGapRem: 0 },
    ]) {
      let named = '';
      try { normalizeArmouryLayout({ ...contentBundle.equipment.armouryUi.layout, trays: badTrays }); }
      catch (error) { named = error.message; }
      assert(named.includes('armouryUi.layout.trays'), 'an impossible tray default or snap stop is refused by the tray config name');
    }
    eq(orderArmourySlots([
      { id: 'leftFoot', order: 50 }, { id: 'back', order: 40 }, { id: 'rightHand', order: 20 }, { id: 'armor', order: 10 },
    ], layout).map((slot) => slot.id).join(','), 'armor,rightHand,back,leftFoot', 'arbitrary equipment groups iterate by authored order without named-slot branches');
    eq(orderArmouryPositions([
      { index: 0, state: 'empty' }, { index: 1, state: 'occupied' },
      { index: 2, state: 'locked' }, { index: 3, state: 'empty' },
    ]).map((position) => `${position.index}:${position.state}`).join(','),
    '1:occupied,2:locked,0:empty,3:empty',
    'empty equipment positions move to the bottom while every state keeps its authored order');
    const occupiedPosition = equipmentPositionCardState({
      slot: { id: 'backHand', label: 'Back Hand', positionLabel: 'Back Hand Slot {n}', positionCode: 'BH{n}', sets: 3 },
      index: 1,
      modelState: 'open',
      item: { id: 'wardWand', name: 'Ward Wand' },
      activeIndex: 0,
    });
    eq(occupiedPosition.label, 'Back Hand Slot 2', 'an arbitrary equipment position formats its authored label');
    eq(occupiedPosition.code, 'BH2', 'an arbitrary equipment position formats its authored short code');
    eq(occupiedPosition.state, 'occupied', 'an unlocked item position is a first-class occupied card');
    eq(occupiedPosition.action, 'equip', 'an inactive occupied position exposes Equip');
    eq(equipmentPositionCardState({
      slot: { id: 'leftFoot', label: 'Left Foot', positionLabel: 'Left Foot Slot {n}', positionCode: 'LF{n}', sets: 4 },
      index: 2, modelState: 'next', item: null, activeIndex: 0,
    }).state, 'locked', 'the next authored rung is a first-class locked card');
    eq(equipmentPositionCardState({
      slot: { id: 'leftFoot', label: 'Left Foot', positionLabel: 'Left Foot Slot {n}', positionCode: 'LF{n}', sets: 4 },
      index: 1, modelState: 'open', item: null, activeIndex: 0,
    }).state, 'empty', 'an unlocked unfilled position is a first-class empty card');
    eq(layout.responsive.phone.minWidth, '0', 'phone layout keeps a visible character pane at every width');
    assert(layout.responsive.breakpoint >= 640, 'responsive breakpoint is a named, usable content value');
  });

  test('75. an explicit save resumes the exact committed combat state and RNG continuation', () => {
    const seed = 0x7503;
    const original = makeCombat({
      seed,
      deck: ['strike', 'defend', 'strike', 'defend', 'strike', 'defend', 'strike', 'defend'],
      enemies: ['tHitter'],
      hp: 61,
      maxHp: 78,
    });
    playFromHand(original, 'strike');

    const counters = original.rng.getCounters();
    const stored = JSON.parse(JSON.stringify(serializeCombatSnapshot(original)));
    const restored = restoreCombatSnapshot({
      registries: REG,
      rng: createRng(seed, counters),
      snapshot: stored,
    });

    eq(JSON.stringify(serializeCombatSnapshot(restored)), JSON.stringify(stored),
      'storage round-trip restores the exact committed turn, entities, intents, piles, and event receipts');
    assert(restored.triggerState instanceof Map, 'trigger receipts restore to their runtime Map shape');
    assert(typeof restored.emit === 'function' && typeof restored.enqueue === 'function' && typeof restored.nextInstanceId === 'function',
      'runtime-only combat methods are reattached');

    dispatch(original, { type: 'endTurn' });
    dispatch(restored, { type: 'endTurn' });
    eq(JSON.stringify(serializeCombatSnapshot(restored)), JSON.stringify(serializeCombatSnapshot(original)),
      'the next turn resolves identically instead of replaying combat setup');
    eq(JSON.stringify(restored.rng.getCounters()), JSON.stringify(original.rng.getCounters()),
      'restored combat consumes the same named RNG streams');

    const runProjection = {};
    commitCombatSnapshot({ run: runProjection, combat: restored, nodeId: 'node-75', encounterId: 'encounter-75' });
    eq(runProjection.hp, restored.player.hp, 'slot-summary HP projects the exact combat state');
    eq(runProjection.flaskCharges?.hpCurrent, restored.player.flaskCharges?.hpCurrent,
      'slot-summary flask charges project the exact combat state');
    eq(JSON.stringify(runProjection.combatEntered.snapshot), JSON.stringify(serializeCombatSnapshot(restored)),
      'one committed snapshot owns both the resume record and run-level summary projection');

    restored.queue.push({ planted: true });
    let resolvingReason = '';
    try { serializeCombatSnapshot(restored); } catch (error) { resolvingReason = error.message; }
    restored.queue.pop();
    assert(/still resolving/.test(resolvingReason), 'a live action queue must refuse a torn combat save');

    const malformed = structuredClone(stored);
    malformed.phase = 'refunded-restart';
    let malformedReason = '';
    try {
      restoreCombatSnapshot({
        registries: REG,
        rng: createRng(seed, counters),
        snapshot: malformed,
      });
    } catch (error) {
      malformedReason = error.message;
    }
    assert(/phase/.test(malformedReason),
      `a malformed exact snapshot must be refused by its field, got ${JSON.stringify(malformedReason)}`);

    const malformedRun = createRunState({ seed, classId: 'reaver', registries: REG });
    malformedRun.combatEntered = { nodeId: 'node-75', encounterId: 'encounter-75', snapshot: malformed };
    const storage = createMemoryStorage();
    storage.setItem(RUN_KEY, serializeRun(malformedRun));
    const saves = createSaveManager(storage);
    eq(saves.loadRun(REG), null, 'the real load door refuses a malformed exact snapshot');
    assert(/phase/.test(saves.runStatus().reason || ''), 'the archived refusal names the malformed snapshot phase');
    assert(storage.getItem(RUN_ARCHIVE_KEY)?.includes('refunded-restart'), 'the original malformed bytes remain recoverable in the archive');

    const dangling = structuredClone(stored);
    dangling.piles.hand[0].cardId = 'removedByContentPatch';
    const danglingRun = createRunState({ seed, classId: 'reaver', registries: REG });
    danglingRun.combatEntered = { nodeId: 'node-75', encounterId: 'encounter-75', snapshot: dangling };
    const danglingStorage = createMemoryStorage();
    danglingStorage.setItem(RUN_KEY, serializeRun(danglingRun));
    const danglingSaves = createSaveManager(danglingStorage);
    eq(danglingSaves.loadRun(REG), null, 'the real load door refuses dangling exact-snapshot content');
    assert(/piles\.hand\.cardId/.test(danglingSaves.runStatus().reason || ''),
      'the dangling exact-snapshot refusal names the affected card pile');

    const checkpointRun = createRunState({ seed, classId: 'reaver', registries: REG });
    checkpointRun.combatEntered = { nodeId: 'node-75', encounterId: REG.encounters.ids()[0] };
    const checkpointStorage = createMemoryStorage();
    checkpointStorage.setItem(RUN_KEY, serializeRun(checkpointRun));
    assert(createSaveManager(checkpointStorage).loadRun(REG)?.combatEntered?.snapshot === undefined,
      'older encounter-only checkpoints remain loadable and explicitly lack an exact snapshot');
  });

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  return { passed, failed, results };
}
