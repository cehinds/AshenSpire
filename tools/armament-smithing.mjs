#!/usr/bin/env node
// Issue #211 — deterministic, non-writing acceptance gate for run-owned
// armament Smithing. This tool exercises the real content/model/save/session
// modules from the selected tree. It writes only to in-memory save storage.
//
//   node tools/armament-smithing.mjs
//   node tools/armament-smithing.mjs --root <checkout>


import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  if (!process.argv[index + 1] || process.argv[index + 1].startsWith('--')) {
    console.error(`armament-smithing: ${flag} requires a path`);
    process.exit(2);
  }
  return process.argv[index + 1];
}

const ROOT = resolve(valueAfter('--root') || resolve(HERE, '..'));
const required = [
  'src/content/index.js',
  'src/model/registries.js',
  'src/model/validate.js',
  'src/model/smithingRules.js',
  'src/model/state.js',
  'src/model/loadout.js',
  'src/model/smithing.js',
  'src/engine/combat.js',
  'src/engine/combatSnapshot.js',
  'src/engine/actions.js',
  'src/engine/save.js',
  'src/engine/rng.js',
  'tools/session.mjs',
];

let checks = 0;
let failures = 0;

function check(ok, code, detail) {
  checks += 1;
  if (ok) console.log(`  PASS ${code} - ${detail}`);
  else {
    failures += 1;
    console.error(`  RED  ${code} - ${detail}`);
  }
}

function thrown(fn, pattern = undefined) {
  try {
    fn();
    return null;
  } catch (error) {
    if (pattern && !pattern.test(error?.message || '')) return null;
    return error;
  }
}

function amount(receipt, op) {
  const row = (receipt?.changes || []).find((change) => change.op === op);
  return row ? [row.before, row.after] : null;
}

function cardAmount(resolveCard, registries, instance, op) {
  const effect = (resolveCard(registries, instance).effects || []).find((row) => row.op === op);
  return effect?.amount ?? effect?.stacks ?? null;
}

// A complete-kit Strike or Guard is `equipmentRole: 'granted'` with its basic
// role in `kitRole` (SPEC, Complete armament kits); a filler basic carries the
// role in `equipmentRole`. Both are the source armament's, at its Smithing tier.
function basicRole(card) {
  return card?.kitRole || card?.equipmentRole;
}

const BASIC_ROLES = ['attack', 'guard', 'technique'];

function sourcedBasics(cards, pieceId) {
  return cards.filter((card) => card.sourceArmamentId === pieceId && BASIC_ROLES.includes(basicRole(card)));
}

async function fromRoot(relative) {
  return import(pathToFileURL(join(ROOT, relative)).href);
}

async function main() {
  const missing = required.filter((relative) => !existsSync(join(ROOT, relative)));
  if (missing.length) throw new Error(`selected root is missing: ${missing.join(', ')}`);

  const [{ contentBundle }, registriesModule, validateModule, stateModule, loadoutModule,
    smithingModule, statProjectionModule, combatModule, combatSnapshotModule, actionsModule, saveModule, rngModule, sessionModule, cardRemovalModule] = await Promise.all([
    fromRoot('src/content/index.js'),
    fromRoot('src/model/registries.js'),
    fromRoot('src/model/validate.js'),
    fromRoot('src/model/state.js'),
    fromRoot('src/model/loadout.js'),
    fromRoot('src/model/smithing.js'),
    fromRoot('src/model/statProjection.js'),
    fromRoot('src/engine/combat.js'),
    fromRoot('src/engine/combatSnapshot.js'),
    fromRoot('src/engine/actions.js'),
    fromRoot('src/engine/save.js'),
    fromRoot('src/engine/rng.js'),
    fromRoot('tools/session.mjs'),
    fromRoot('src/model/cardRemoval.js').catch(() => ({})),
  ]);

  const { createRegistries, resolveCard, passiveSum } = registriesModule;
  const { validateContent } = validateModule;
  const { createRunState } = stateModule;
  const { stampDeck, equipmentRequirementReceipt } = loadoutModule;
  const {
    smithingPlan,
    commitSmithing,
    grantSmithingReward,
    initializeRunSmithing,
  } = smithingModule;
  const { playerPoiseThresholdReceipt } = statProjectionModule;
  const { createCombat, dispatch } = combatModule;
  const { commitCombatSnapshot, restoreCombatSnapshot } = combatSnapshotModule;
  const { executeRunEffects } = actionsModule;
  const { createSaveManager, createMemoryStorage, RUN_KEY } = saveModule;
  const { createRng } = rngModule;
  // An older --root has no isPoolDeckMode; no run context is then passed.
  const runPoolDeck = (run) => cardRemovalModule.isPoolDeckMode?.(run);
  const { createSession, restoreSession } = sessionModule;

  const registries = createRegistries(contentBundle);
  const contentVerdict = validateContent(contentBundle);
  check(contentVerdict.ok, 'SMITH-CONTENT-DOOR', 'the shipped economy passes the ordinary boot-time content validator');
  const equipmentItems = [...registries.equipment.armaments, ...registries.equipment.armour];
  // 28 armaments + 35 armour since the content expansion (#1187) added the
  // Last Lantern gear; the pin stays literal so a dropped item still goes red.
  check(equipmentItems.length === 63 && equipmentItems.every((item) => item.entityTags?.length && item.itemTypeTags?.length && item.itemTypes?.length),
    'SMITH-ITEM-TYPE-TAGS', 'all 63 equipment entities carry authored item:* type tags and normalized display records');
  const parryingDagger = registries.equipment.armaments.find((item) => item.id === 'parryDagger');
  check(parryingDagger?.itemTypeTags.join('|') === 'item:blade|item:shield'
      && parryingDagger.itemTypes.map((type) => type.label).join('|') === 'Blade|Shield',
    'SMITH-MULTI-ITEM-TYPE', 'a multi-type item retains authored Blade + Shield order without deriving either from kind');
  const malformedEconomy = validateContent({
    ...contentBundle,
    balance: {
      ...contentBundle.balance,
      smithing: {
        ...contentBundle.balance.smithing,
        rewardByPool: { normal: 0, elite: 1, boss: -1, treasure: 0 },
      },
    },
  });
  check(!malformedEconomy.ok && malformedEconomy.errors.some((row) => row.path === 'balance.smithing' && /boss/.test(row.msg)),
    'SMITH-CONTENT-REFUSAL', 'the boot-time content door rejects a malformed negative boss faucet by name');

  // One synthetic content package proves tags, not universal code, own each
  // item/tier result. These rows exercise all three card-cost resources without
  // changing production balance or relying on a presentation-only receipt.
  const authoredRows = contentBundle.equipment.itemUpgradeChanges;
  const syntheticRows = [
    ...authoredRows.filter((row) => !['armament/straightSword', 'armament/roundShield'].includes(row.itemRef)),
    { itemRef: 'armament/straightSword', nextTier: 1, tag: 'upgrade:cost:smithing-stone', value: 2 },
    { itemRef: 'armament/straightSword', nextTier: 1, tag: 'card:attack:effect:damage', value: 1 },
    { itemRef: 'armament/straightSword', nextTier: 1, tag: 'card:attack:cost:action', value: 1 },
    { itemRef: 'armament/straightSword', nextTier: 1, tag: 'card:technique:cost:mana', value: 2 },
    { itemRef: 'armament/straightSword', nextTier: 1, tag: 'requirement:strength', value: -2 },
    { itemRef: 'armament/roundShield', nextTier: 1, tag: 'upgrade:cost:smithing-stone', value: 1 },
    { itemRef: 'armament/roundShield', nextTier: 1, tag: 'card:guard:effect:block', value: 4 },
    { itemRef: 'armament/roundShield', nextTier: 1, tag: 'card:guard:cost:stamina', value: 1 },
  ];
  const syntheticBundle = {
    ...contentBundle,
    equipment: { ...contentBundle.equipment, itemUpgradeChanges: syntheticRows },
  };
  const syntheticVerdict = validateContent(syntheticBundle);
  const syntheticRegistries = createRegistries(syntheticBundle);
  const syntheticRun = createRunState({ seed: 212, classId: 'reaver', registries: syntheticRegistries });
  const syntheticPlan = smithingPlan(syntheticRegistries, syntheticRun);
  const syntheticSword = syntheticPlan.candidates.find((row) => row.armamentId === 'straightSword');
  const syntheticShield = syntheticPlan.candidates.find((row) => row.armamentId === 'roundShield');
  const syntheticAttack = syntheticSword?.affectedCards.find((row) => row.role === 'attack');
  const syntheticTechnique = syntheticSword?.affectedCards.find((row) => row.role === 'technique');
  const syntheticGuard = syntheticShield?.affectedCards.find((row) => row.role === 'guard');
  // Armed decks carry no live Technique since complete kits (#904; SPEC: "New
  // armed starting decks omit the redundant global technique grant"), so the
  // Technique row is the authored role preview. Tier-0 values come from the
  // engine; each synthetic row must move exactly its own value by its delta.
  const syntheticTechniquePreview = syntheticTechnique
    || syntheticSword?.previewCards.find((row) => row.role === 'technique');
  const syntheticAttackBase = syntheticAttack ? cardAmount(resolveCard, syntheticRegistries, syntheticAttack.reference, 'damage') : null;
  const syntheticGuardBase = syntheticGuard ? cardAmount(resolveCard, syntheticRegistries, syntheticGuard.reference, 'block') : null;
  const syntheticSwordStr = (contentBundle.equipment.equipmentRequirements || [])
    .find((row) => row.itemId === 'straightSword' && row.attributeId === 'strength')?.minimum;
  check(syntheticVerdict.ok && syntheticSword?.cost === 2
      && Number.isInteger(syntheticAttackBase) && amount(syntheticAttack, 'damage')?.join('|') === `${syntheticAttackBase}|${syntheticAttackBase + 1}`
      && amount(syntheticAttack, 'cost:action')?.join('|') === '1|2'
      && amount(syntheticTechniquePreview, 'cost:mana')?.join('|') === '0|2'
      && Number.isInteger(syntheticGuardBase) && amount(syntheticGuard, 'block')?.join('|') === `${syntheticGuardBase}|${syntheticGuardBase + 4}`
      && amount(syntheticGuard, 'cost:stamina')?.join('|') === '0|1'
      && Number.isInteger(syntheticSwordStr)
      && syntheticSword.requirements[0]?.currentRequired === syntheticSwordStr
      && syntheticSword.requirements[0]?.nextRequired === Math.max(0, syntheticSwordStr - 2),
    'SMITH-TAGGED-ITEM-TIER-DELTAS', 'exact item/tier tags independently own Stone cost, AR, Guard, Action, Mana, Stamina, and requirement changes');
  const unknownTagVerdict = validateContent({
    ...contentBundle,
    equipment: {
      ...contentBundle.equipment,
      itemUpgradeChanges: authoredRows.map((row, index) => index === 0 ? { ...row, tag: 'card:attack:cost:souls' } : row),
    },
  });
  check(!unknownTagVerdict.ok && unknownTagVerdict.errors.some((row) => /unknown upgrade tag/.test(row.msg)),
    'SMITH-TAG-REFUSAL', 'the boot door rejects an unknown upgrade tag instead of inferring a resource');
  const wrongKindVerdict = validateContent({
    ...contentBundle,
    equipment: {
      ...contentBundle.equipment,
      itemUpgradeChanges: authoredRows.map((row) => row.itemRef === 'armor/reaver/default' && row.tag === 'equipment:poise-threshold'
        ? { ...row, tag: 'card:attack:effect:damage' }
        : row),
    },
  });
  const authoredRefs = new Set(authoredRows.map((row) => row.itemRef));
  check(!wrongKindVerdict.ok && wrongKindVerdict.errors.some((row) => /invalid for item kind 'armor'/.test(row.msg))
      // 16 class outfits + Bastion, Rimeweave and Waywatcher from #1187.
      && [...authoredRefs].filter((itemRef) => itemRef.startsWith('armor/')).length === 19
      && [...authoredRefs].filter((itemRef) => itemRef.startsWith('relic/')).sort().join('|') === 'relic/ancestralHorn|relic/curedHide',
    'SMITH-KIND-CLOSED-CONTENT', 'the boot door rejects cross-kind tags and ships exactly 19 armour plus two explicit relic packages');
  const newReaver = (seed = 211) => createRunState({ seed, classId: 'reaver', registries });
  const combatPlayer = (candidate) => ({
    classId: candidate.class,
    attributes: candidate.attributes,
    maxHp: candidate.maxHp,
    hp: candidate.hp,
    maxMana: candidate.maxMana,
    mana: candidate.mana,
    maxStamina: candidate.maxStamina,
    stamina: candidate.stamina,
    energyMax: candidate.energyMax,
    drawPerTurn: candidate.drawPerTurn,
    deck: candidate.deck,
    relicIds: candidate.relics,
    flasks: candidate.flasks,
    flaskCharges: candidate.flaskCharges,
    loadout: candidate.loadout,
    itemUpgradeLevels: candidate.itemUpgradeLevels,
    equipmentProfileRuleSnapshot: candidate.equipmentProfileRuleSnapshot,
  });
  const combatCards = (combat, predicate) => ['draw', 'hand', 'discard', 'exhaust']
    .flatMap((pile) => combat.piles[pile]).filter(predicate);

  console.log(`armament-smithing — issue #211 source/model gate\n  root: ${ROOT}\n`);

  // Zero purse, stable armament identities, exact affected-card partition, and
  // actual engine-resolved preview values.
  const run = newReaver();
  const zero = smithingPlan(registries, run);
  const sword = zero.candidates.find((row) => row.armamentId === 'straightSword');
  const shield = zero.candidates.find((row) => row.armamentId === 'roundShield');
  check(zero.stones === 0 && run.smithingStones === 0,
    'SMITH-PURSE-ZERO', 'a new run starts with zero Smithing Stones');
  check(zero.candidates.filter((row) => row.itemKind === 'armament').length === 2
      && new Set(zero.candidates.filter((row) => row.itemKind === 'armament').map((row) => row.armamentId)).size === 2,
    'SMITH-DISTINCT-ARMAMENTS', 'four attacks plus Technique collapse to one sword choice; four Guards to one shield choice');
  check(zero.candidates.every((row) => row.inventoryCount === 1),
    'SMITH-INVENTORY-COUNT', 'each Smithing candidate reports its exact single owned inventory instance');
  // OWNED IS CARRIED, NOT COMPOSED: an armament held in Inventory supplies no
  // deck cards and used to be invisible to the Smith. It is offered with its
  // authored role previews as the change receipt (no live cards affected).
  const storedRun = newReaver();
  storedRun.loadout.storage.push('greatsword');
  const storedPlan = smithingPlan(registries, storedRun);
  const storedSword = storedPlan.candidates.find((row) => row.armamentId === 'greatsword');
  check(!!storedSword && storedSword.affectedCards.length === 0 && storedSword.changes.length > 0
      && storedSword.changes.some((row) => row.before !== row.after),
    'SMITH-STORED-ARMAMENT', `a Greatsword in Inventory is a Smithing candidate previewed through its authored roles (offered=${!!storedSword}, affected=${storedSword?.affectedCards.length}, changes=${storedSword?.changes.length})`);
  const armour = zero.candidates.find((row) => row.itemRef === 'armor/reaver/default');
  check(armour?.itemKind === 'armor' && armour.changes.length === 1
      && armour.changes[0].before === 8 && armour.changes[0].after === 9,
    'SMITH-EQUIPPED-ARMOUR', 'the exact equipped armour is eligible and previews its authored Poise 8→9 change');
  const genericRun = newReaver(2112);
  genericRun.relics.push('curedHide', 'ancestralHorn', 'starstoneShard');
  const genericPlan = smithingPlan(registries, genericRun);
  check(genericPlan.candidates.some((row) => row.itemRef === 'relic/curedHide')
      && genericPlan.candidates.some((row) => row.itemRef === 'relic/ancestralHorn')
      && !genericPlan.candidates.some((row) => row.itemRef === 'relic/starstoneShard'),
    'SMITH-EXPLICIT-RELICS', 'only owned relics with exact authored packages are eligible');
  genericRun.smithingStones = 3;
  const poiseBefore = playerPoiseThresholdReceipt(registries, genericRun).value;
  const armourReceipt = commitSmithing(registries, genericRun, 'armor/reaver/default');
  const curedReceipt = commitSmithing(registries, genericRun, 'relic/curedHide');
  const hornReceipt = commitSmithing(registries, genericRun, 'relic/ancestralHorn');
  check(armourReceipt.itemKind === 'armor' && curedReceipt.itemKind === 'relic' && hornReceipt.itemKind === 'relic'
      && genericRun.itemUpgradeLevels['armor/reaver/default'] === 1
      && genericRun.itemUpgradeLevels['relic/curedHide'] === 1
      && genericRun.itemUpgradeLevels['relic/ancestralHorn'] === 1
      && playerPoiseThresholdReceipt(registries, genericRun).value === poiseBefore + 2
      && passiveSum(registries, genericRun.relics, 'powerCostReduction', genericRun.itemUpgradeLevels) === 2,
    'SMITH-GENERIC-CONSUMERS', 'armour and the two explicit relic packages persist and move their exact model consumers');
  const powerRun = newReaver(2113);
  powerRun.relics.push('ancestralHorn');
  powerRun.smithingStones = 1;
  commitSmithing(registries, powerRun, 'relic/ancestralHorn');
  const powerPlayer = combatPlayer(powerRun);
  powerPlayer.deck = [
    { instanceId: 'power-1', cardId: 'unbreakable', upgraded: false },
    ...Array.from({ length: 4 }, (_, index) => ({ instanceId: `power-filler-${index}`, cardId: 'strike', upgraded: false })),
  ];
  const powerCombat = createCombat({ registries, rng: createRng(2113), player: powerPlayer, enemyIds: ['fellWarden'] });
  const powerCard = powerCombat.piles.hand.find((card) => card.cardId === 'unbreakable');
  dispatch(powerCombat, { type: 'playCard', cardInstanceId: powerCard.instanceId });
  check(powerCombat.player.energy === powerRun.energyMax,
    'SMITH-RELIC-COMBAT-CONSUMER', 'the upgraded Horn moves the real Power-card spend from one Energy to zero');
  // SPEC, Complete armament kits: each hand armament lends one Strike and one
  // Guard (`kit:<item>:attack|guard`); in a shield/non-shield pair the sword
  // keeps the filler Attack quota and the filler Guards stay the shield's.
  // Armed starting decks carry no global Technique.
  const swordBasics = sourcedBasics(run.deck, 'straightSword');
  const shieldBasics = sourcedBasics(run.deck, 'roundShield');
  const fillerAttacks = run.deck.filter((card) => card.equipmentRole === 'attack');
  const fillerGuards = run.deck.filter((card) => card.equipmentRole === 'guard');
  const ids = (rows, key = 'instanceId') => rows.map((row) => row[key]).sort().join('|');
  check(swordBasics.some((card) => card.instanceId === 'kit:straightSword:attack' && card.kitRole === 'attack')
      && swordBasics.some((card) => card.instanceId === 'kit:straightSword:guard' && card.kitRole === 'guard')
      && fillerAttacks.length > 0 && fillerAttacks.every((card) => card.sourceArmamentId === 'straightSword')
      && swordBasics.length === 2 + fillerAttacks.length
      && !run.deck.some((card) => basicRole(card) === 'technique')
      && ids(sword?.affectedCards || []) === ids(swordBasics),
    'SMITH-SWORD-PARTITION', `Straight Sword owns its kit Strike and Guard plus the ${fillerAttacks.length} filler Attack basic(s), no Technique, and the plan lists exactly those`);
  check(shieldBasics.some((card) => card.instanceId === 'kit:roundShield:attack' && card.kitRole === 'attack')
      && shieldBasics.some((card) => card.instanceId === 'kit:roundShield:guard' && card.kitRole === 'guard')
      && fillerGuards.length > 0 && fillerGuards.every((card) => card.sourceArmamentId === 'roundShield')
      && shieldBasics.length === 2 + fillerGuards.length
      && !shieldBasics.some((card) => card.equipmentRole === 'attack')
      && ids(shield?.affectedCards || []) === ids(shieldBasics),
    'SMITH-SHIELD-PARTITION', `Round Shield owns its kit Strike and Guard plus all ${fillerGuards.length} filler Guard basic(s), no filler Attack, and the plan lists exactly those`);
  const swordAttackCopies = swordBasics.filter((card) => basicRole(card) === 'attack').length;
  const shieldGuardCopies = shieldBasics.filter((card) => basicRole(card) === 'guard').length;
  check(sword?.previewCards.some((row) => row.role === 'attack' && row.used === true && row.activeCopies === swordAttackCopies)
      && sword.previewCards.some((row) => row.role === 'guard' && row.used === true && row.activeCopies === 1)
      && sword.previewCards.some((row) => row.role === 'technique' && row.used === false && row.activeCopies === 0)
      && shield?.previewCards.some((row) => row.role === 'attack' && row.used === true && row.activeCopies === 1)
      && shield.previewCards.some((row) => row.role === 'guard' && row.used === true && row.activeCopies === shieldGuardCopies)
      && shield.previewCards.some((row) => row.role === 'technique' && row.used === false && row.activeCopies === 0),
    'SMITH-ROLE-PREVIEWS', 'every armament previews basic Strike, Defend, and Technique; kit roles are live and the absent Technique stays explicitly unused');

  // Engine-resolved: the preview's before is the live card at tier 0 and its
  // after is that value moved by the item's own authored tier-1 row.
  const tierRow = (pieceId, tag) => authoredRows.find((row) => row.itemRef === `armament/${pieceId}` && row.nextTier === 1 && row.tag === tag)?.value;
  const swordDamageStep = tierRow('straightSword', 'card:attack:effect:damage');
  const swordGuardStep = tierRow('straightSword', 'card:guard:effect:block');
  const swordTechniqueStep = tierRow('straightSword', 'card:technique:effect:block');
  const shieldGuardStep = tierRow('roundShield', 'card:guard:effect:block');
  const strikePreview = sword?.affectedCards.find((row) => row.role === 'attack');
  const swordGuardPreview = sword?.affectedCards.find((row) => row.role === 'guard');
  const techniquePreview = sword?.previewCards.find((row) => row.role === 'technique');
  const guardPreview = shield?.affectedCards.find((row) => row.role === 'guard');
  const strikeBase = cardAmount(resolveCard, registries, run.deck.find((card) => card.instanceId === 'kit:straightSword:attack'), 'damage');
  const swordGuardBase = cardAmount(resolveCard, registries, run.deck.find((card) => card.instanceId === 'kit:straightSword:guard'), 'block');
  const techniqueBase = techniquePreview ? cardAmount(resolveCard, registries, techniquePreview.reference, 'block') : null;
  const shieldGuardBase = cardAmount(resolveCard, registries, run.deck.find((card) => card.instanceId === 'kit:roundShield:guard'), 'block');
  const pair = (base, step) => JSON.stringify([base, base + step]);
  check([swordDamageStep, swordGuardStep, swordTechniqueStep, shieldGuardStep].every((step) => Number.isInteger(step) && step > 0)
      && JSON.stringify(amount(strikePreview, 'damage')) === pair(strikeBase, swordDamageStep)
      && JSON.stringify(amount(swordGuardPreview, 'block')) === pair(swordGuardBase, swordGuardStep)
      && JSON.stringify(amount(techniquePreview, 'block')) === pair(techniqueBase, swordTechniqueStep)
      && JSON.stringify(amount(guardPreview, 'block')) === pair(shieldGuardBase, shieldGuardStep),
    'SMITH-REAL-DELTAS', `preview is engine-resolved: Strike ${strikeBase}→${strikeBase + swordDamageStep}, sword Guard ${swordGuardBase}→${swordGuardBase + swordGuardStep}, Technique Block ${techniqueBase}→${techniqueBase + swordTechniqueStep}, shield Guard ${shieldGuardBase}→${shieldGuardBase + shieldGuardStep}`);
  // #1246 replaced attribute-tier scaling with direct source ratings: a
  // preview names the rating its authored profile reads (the run's snapshot
  // first), and the live carrier holds the run's current rating value.
  const strikeProfile = run.equipmentProfileRuleSnapshot?.profiles?.[strikePreview?.reference?.profileId]
    || registries.equipment.basicCardProfiles.find((row) => row.id === strikePreview?.reference?.profileId);
  const strikeCarrier = run.deck.find((card) => card.instanceId === strikePreview?.instanceId);
  check(!!strikeProfile?.ratingId
      && strikePreview.rating?.id === strikeProfile.ratingId
      && strikePreview.rating.label === strikeProfile.ratingId.toUpperCase()
      && strikeCarrier?.ratingId === strikeProfile.ratingId
      && Number.isInteger(strikeCarrier?.ratingValue),
    'SMITH-SCALING-PREVIEW', `preview carries the authored profile rating (${strikePreview?.rating?.label}) and the run current value (${strikeCarrier?.ratingValue})`);
  // The lean scale (SPEC §13.4m) restated equipment minima onto 1-4; the
  // authored row and the authored tier-one delta decide both numbers.
  const swordStrBase = (contentBundle.equipment.equipmentRequirements || [])
    .find((row) => row.itemId === 'straightSword' && row.attributeId === 'strength')?.minimum;
  const swordStrStep = tierRow('straightSword', 'requirement:strength');
  check(Number.isInteger(swordStrBase) && Number.isInteger(swordStrStep) && swordStrStep < 0
      && swordStrBase + swordStrStep >= 0
      && sword?.requirements.length === 1
      && sword.requirements[0].attributeId === 'strength'
      && sword.requirements[0].currentRequired === swordStrBase
      && sword.requirements[0].nextRequired === swordStrBase + swordStrStep,
    'SMITH-REQUIREMENT-PREVIEW', `Straight Sword publishes its authored STR ${swordStrBase} minimum and tier-one reduction to STR ${swordStrBase + swordStrStep}`);
  check(sword?.cost === 1 && sword?.shortfall === 1 && sword?.affordable === false
      && shield?.cost === 1 && shield?.shortfall === 1 && shield?.affordable === false,
    'SMITH-UNAFFORDABLE', 'both choices name cost 1 and shortfall 1 without hiding the picker');
  check(!!thrown(() => commitSmithing(registries, run, 'straightSword'), /Insufficient Smithing Stones/)
      && run.smithingStones === 0 && Object.keys(run.itemUpgradeLevels).length === 0,
    'SMITH-REFUSE-NO-STONE', 'an unaffordable commit changes neither purse nor armament tiers');

  // Paid transaction, whole-source propagation, cap, free promotion, future
  // copy inheritance, and swap-away/back restoration.
  const shieldValuesBefore = new Map(shieldBasics.map((card) => [card.instanceId,
    [cardAmount(resolveCard, registries, card, 'damage'), cardAmount(resolveCard, registries, card, 'block')].join('|')]));
  const swordAttackAfter = strikeBase + swordDamageStep;
  const swordGuardAfter = swordGuardBase + swordGuardStep;
  // Every sword-owned basic at tier 1: attacks at the smithed Strike value,
  // the kit Guard at the smithed Guard value, no per-copy upgrade flag.
  const swordAtTierOne = (cards) => cards.length === swordBasics.length
    && cards.every((card) => card.smithingLevel === 1 && card.upgraded === false)
    && cards.filter((card) => basicRole(card) === 'attack')
      .every((card) => cardAmount(resolveCard, registries, card, 'damage') === swordAttackAfter)
    && cards.filter((card) => basicRole(card) === 'guard')
      .every((card) => cardAmount(resolveCard, registries, card, 'block') === swordGuardAfter);
  run.smithingStones = 1;
  const paid = commitSmithing(registries, run, 'straightSword');
  const swordCards = sourcedBasics(run.deck, 'straightSword');
  const shieldCards = sourcedBasics(run.deck, 'roundShield');
  check(paid.cost === 1 && paid.stoneBalanceBefore === 1 && paid.stoneBalanceAfter === 0
      && run.smithingStones === 0 && run.itemUpgradeLevels['armament/straightSword'] === 1,
    'SMITH-SPEND-EXACT', 'paid Smithing spends exactly one Stone and promotes only the source tier');
  const swordPiece = registries.equipment.armaments.find((piece) => piece.id === 'straightSword');
  const reducedRequirement = equipmentRequirementReceipt(registries, swordPiece, run.attributes, { itemUpgradeLevels: run.itemUpgradeLevels });
  // One point under the authored minimum: refused unsmithed, held at tier 1.
  const boundaryStrength = swordStrBase + swordStrStep;
  const boundaryBefore = equipmentRequirementReceipt(registries, swordPiece, { ...run.attributes, strength: boundaryStrength });
  const boundaryAfter = equipmentRequirementReceipt(registries, swordPiece, { ...run.attributes, strength: boundaryStrength }, { itemUpgradeLevels: run.itemUpgradeLevels });
  check(reducedRequirement.requirements[0]?.baseRequired === swordStrBase
      && reducedRequirement.requirements[0]?.required === swordStrBase + swordStrStep
      && reducedRequirement.requirements[0]?.reduction === -swordStrStep
      && boundaryBefore.ok === false && boundaryAfter.ok === true,
    'SMITH-REQUIREMENT-ENFORCEMENT', 'the shared equipment gate enforces the promoted armament requirement reduction');
  check(swordAtTierOne(swordCards)
      && ids(paid.affectedCards || []) === ids(swordCards),
    'SMITH-WHOLE-SOURCE', `all ${swordBasics.length} sword-owned basics (kit Strike and Guard included) resolve at tier 1 with no per-copy upgrade authority, and the receipt names each`);
  check(shieldCards.length === shieldBasics.length && shieldCards.every((card) => card.smithingLevel === 0)
      && shieldCards.every((card) => shieldValuesBefore.get(card.instanceId)
        === [cardAmount(resolveCard, registries, card, 'damage'), cardAmount(resolveCard, registries, card, 'block')].join('|')),
    'SMITH-OTHER-SOURCE-STABLE', 'Smithing the sword leaves every shield-owned basic (its kit Strike and every Guard) unchanged');
  const stonesAtCap = run.smithingStones;
  check(!smithingPlan(registries, run).candidates.some((row) => row.armamentId === 'straightSword')
      && !!thrown(() => commitSmithing(registries, run, 'straightSword'), /not an eligible Smithing candidate/)
      && run.smithingStones === stonesAtCap && run.itemUpgradeLevels['armament/straightSword'] === 1,
    'SMITH-CAP', 'the level-1 cap refuses a second promotion without spending');

  const freeRun = newReaver(212);
  const free = commitSmithing(registries, freeRun, 'straightSword', undefined, { free: true });
  check(free.free === true && free.cost === 0 && freeRun.smithingStones === 0
      && freeRun.itemUpgradeLevels['armament/straightSword'] === 1,
    'SMITH-FREE-GRANT', 'a free upgrade promotes the source armament and spends zero Stones');

  const keepsakeRun = newReaver(2111);
  const whetstone = registries.characterCreation.keepsakes.find((row) => row.id === 'whetstoneMemory');
  executeRunEffects({ run: keepsakeRun, registries, rng: createRng(11) }, whetstone.effects);
  const keepsakeSword = sourcedBasics(keepsakeRun.deck, 'straightSword');
  check(keepsakeRun.itemUpgradeLevels['armament/straightSword'] === 1
      && swordAtTierOne(keepsakeSword),
    'SMITH-WHETSTONE-ROUTE', 'Whetstone Memory promotes the whole Straight Sword source while the retired per-copy flag stays clear');

  const originalAttack = run.deck.find((card) => card.equipmentRole === 'attack');
  const futureAttack = { ...structuredClone(originalAttack), instanceId: 'future-attack', smithingLevel: 0 };
  delete futureAttack.sourceArmamentId;
  stampDeck(registries, run, [futureAttack], { adoptEquipmentBonuses: false, reconcileEquipmentPools: false });
  check(futureAttack.sourceArmamentId === 'straightSword' && futureAttack.smithingLevel === 1
      && futureAttack.upgraded === false
      && cardAmount(resolveCard, registries, futureAttack, 'damage') === swordAttackAfter,
    'SMITH-FUTURE-COPY', 'a recreated sourced basic inherits the current armament tier when stamped');

  run.loadout.sets.rightHand[1] = 'dagger';
  run.loadout.active.rightHand = 1;
  stampDeck(registries, run);
  // The dagger lends its own kit and takes the filler Attack quota, all unsmithed.
  const daggerProbe = createRunState({ seed: 211, classId: 'reaver', registries });
  daggerProbe.loadout.sets.rightHand[1] = 'dagger';
  daggerProbe.loadout.active.rightHand = 1;
  stampDeck(registries, daggerProbe);
  const daggerStrike = cardAmount(resolveCard, registries, daggerProbe.deck.find((card) => card.instanceId === 'kit:dagger:attack'), 'damage');
  const daggerState = sourcedBasics(run.deck, 'dagger');
  const awayOk = sourcedBasics(run.deck, 'straightSword').length === 0
    && daggerState.length === swordBasics.length
    && daggerState.some((card) => card.instanceId === 'kit:dagger:attack')
    && daggerState.every((card) => card.smithingLevel === 0)
    && Number.isInteger(daggerStrike)
    && daggerState.filter((card) => basicRole(card) === 'attack')
      .every((card) => cardAmount(resolveCard, registries, card, 'damage') === daggerStrike);
  run.loadout.active.rightHand = 0;
  stampDeck(registries, run);
  const restoredSword = sourcedBasics(run.deck, 'straightSword');
  check(awayOk && sourcedBasics(run.deck, 'dagger').length === 0
      && ids(restoredSword) === ids(swordBasics)
      && swordAtTierOne(restoredSword),
    'SMITH-SWAP-RESTORE', 'switching to an unsmithed weapon removes the tier; switching back restores it');

  // The real combat intent door must recompose all live piles using the
  // run-owned tier, and an active-combat save must carry that authority through
  // the ordinary save/load and snapshot restoration doors.
  const liveRun = newReaver(218);
  liveRun.smithingStones = 1;
  commitSmithing(registries, liveRun, 'straightSword');
  liveRun.loadout.sets.rightHand[1] = 'dagger';
  liveRun.loadout.active.rightHand = 1;
  stampDeck(registries, liveRun);
  const liveCombat = createCombat({
    registries,
    rng: createRng(218),
    player: combatPlayer(liveRun),
    enemyIds: ['fellWarden'],
  });
  const swapEvents = dispatch(liveCombat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 0 }).events;
  const liveSwordCards = combatCards(liveCombat, (card) => card.sourceArmamentId === 'straightSword' && BASIC_ROLES.includes(basicRole(card)));
  check(liveCombat.loadout.active.rightHand === 0
      && swapEvents.filter((event) => event.type === 'armamentSwapped').length === 1
      && combatCards(liveCombat, (card) => card.sourceArmamentId === 'dagger').length === 0
      && swordAtTierOne(liveSwordCards),
    'SMITH-COMBAT-SWAP', 'the real combat swap intent restores the smithed sword tier across every live attack pile');

  commitCombatSnapshot({ run: liveRun, combat: liveCombat, nodeId: 'gate-node', encounterId: 'fellWarden' });
  const combatStorage = createMemoryStorage();
  const combatSaves = createSaveManager(combatStorage);
  combatSaves.saveRun(liveRun, createRng(liveRun.seed, liveRun.streamCounters));
  const loadedCombatRun = combatSaves.loadRun(registries);
  const restoredCombat = loadedCombatRun?.combatEntered?.snapshot
    ? restoreCombatSnapshot({
      registries,
      rng: createRng(loadedCombatRun.seed, loadedCombatRun.streamCounters),
      snapshot: loadedCombatRun.combatEntered.snapshot,
      fallbackPoolDeck: runPoolDeck(loadedCombatRun),
    })
    : null;
  const restoredCombatCards = restoredCombat
    ? combatCards(restoredCombat, (card) => card.sourceArmamentId === 'straightSword' && BASIC_ROLES.includes(basicRole(card)))
    : [];
  check(loadedCombatRun?.itemUpgradeLevels?.['armament/straightSword'] === 1
      && loadedCombatRun?.combatEntered?.snapshot?.itemUpgradeLevels?.['armament/straightSword'] === 1
      && restoredCombat?.itemUpgradeLevels?.['armament/straightSword'] === 1
      && swordAtTierOne(restoredCombatCards),
    'SMITH-COMBAT-SNAPSHOT-ROUNDTRIP', `active-combat save/load and snapshot restore retain tier authority and resolved ${swordAttackAfter}-damage attacks`);

  // Current save round-trip and one-time legacy per-copy migration.
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  saves.saveRun(run, createRng(run.seed, run.streamCounters));
  const loaded = saves.loadRun(registries);
  check(loaded?.smithingStones === 0 && loaded?.itemUpgradeLevels?.['armament/straightSword'] === 1
      && loaded.deck.filter((card) => card.sourceArmamentId === 'straightSword')
        .every((card) => card.smithingLevel === 1)
      && saves.runStatus().state === 'ok',
    'SMITH-SAVE-ROUNDTRIP', 'current save/load preserves purse, tier map, and stamped card carriers without healing');

  const legacyStorage = createMemoryStorage();
  const legacySaves = createSaveManager(legacyStorage);
  const legacy = newReaver(213);
  delete legacy.smithingStones;
  delete legacy.itemUpgradeLevels;
  delete legacy.smithingRewardClaims;
  legacy.deck.find((card) => card.equipmentRole === 'attack').upgraded = true;
  const ordinary = legacy.deck.find((card) => !card.equipmentRole);
  ordinary.upgraded = true;
  legacyStorage.setItem(RUN_KEY, JSON.stringify(legacy));
  const migrated = legacySaves.loadRun(registries);
  check(migrated?.smithingStones === 0 && migrated?.itemUpgradeLevels?.['armament/straightSword'] === 1
      && Array.isArray(migrated?.smithingRewardClaims)
      && migrated.deck.filter((card) => card.sourceArmamentId === 'straightSword')
        .every((card) => card.upgraded === false && card.smithingLevel === 1)
      && migrated.deck.find((card) => card.instanceId === ordinary.instanceId)?.upgraded === true,
    'SMITH-LEGACY-MIGRATION', 'legacy equipment flag promotes once to its armament while an ordinary card upgrade survives');
  check(legacySaves.runStatus().state === 'healed'
      && legacySaves.runStatus().ledger?.entries?.some((entry) => entry.site === 'smithing.js:initializeRunSmithing'),
    'SMITH-MIGRATION-RECEIPT', 'the save door reports the legacy Smithing initialization in its heal ledger');

  const legacyCombatStorage = createMemoryStorage();
  const legacyCombatSaves = createSaveManager(legacyCombatStorage);
  const legacyCombatRun = newReaver(220);
  const legacyCombat = createCombat({
    registries,
    rng: createRng(220),
    player: combatPlayer(legacyCombatRun),
    enemyIds: ['fellWarden'],
  });
  commitCombatSnapshot({
    run: legacyCombatRun,
    combat: legacyCombat,
    nodeId: 'legacy-gate-node',
    encounterId: 'fellWarden',
  });
  delete legacyCombatRun.smithingStones;
  delete legacyCombatRun.itemUpgradeLevels;
  delete legacyCombatRun.smithingRewardClaims;
  delete legacyCombatRun.combatEntered.snapshot.itemUpgradeLevels;
  legacyCombatRun.deck.find((card) => card.equipmentRole === 'attack').upgraded = true;
  legacyCombatStorage.setItem(RUN_KEY, JSON.stringify(legacyCombatRun));
  const migratedLegacyCombatRun = legacyCombatSaves.loadRun(registries);
  const migratedLegacyCombatCards = migratedLegacyCombatRun
    ? ['draw', 'hand', 'discard', 'exhaust'].flatMap((pile) => migratedLegacyCombatRun.combatEntered.snapshot.piles[pile])
      .filter((card) => card.sourceArmamentId === 'straightSword' && BASIC_ROLES.includes(basicRole(card)))
    : [];
  const restoredLegacyCombat = migratedLegacyCombatRun
    ? restoreCombatSnapshot({
      registries,
      rng: createRng(migratedLegacyCombatRun.seed, migratedLegacyCombatRun.streamCounters),
      snapshot: migratedLegacyCombatRun.combatEntered.snapshot,
      fallbackPoolDeck: runPoolDeck(migratedLegacyCombatRun),
    })
    : null;
  check(migratedLegacyCombatRun?.itemUpgradeLevels?.['armament/straightSword'] === 1
      && migratedLegacyCombatRun?.combatEntered?.snapshot?.itemUpgradeLevels?.['armament/straightSword'] === 1
      && swordAtTierOne(migratedLegacyCombatCards)
      && restoredLegacyCombat?.itemUpgradeLevels?.['armament/straightSword'] === 1,
    'SMITH-LEGACY-COMBAT-MIGRATION', 'legacy active-combat load promotes before restamping and restores every saved sword basic at tier 1');

  // Malformed persisted numbers fail closed.
  const malformedPurse = newReaver(214);
  malformedPurse.smithingStones = -1;
  const malformedFraction = newReaver(215);
  malformedFraction.smithingStones = 0.5;
  const malformedLevel = newReaver(216);
  malformedLevel.itemUpgradeLevels = { 'armament/straightSword': 0.5 };
  const conflict = newReaver(2161);
  conflict.itemUpgradeLevels = { 'armament/straightSword': 1 };
  conflict.armamentLevels = { straightSword: 0 };
  check(!!thrown(() => smithingPlan(registries, malformedPurse), /integer >= 0/)
      && !!thrown(() => smithingPlan(registries, malformedFraction), /integer >= 0/)
      && !!thrown(() => smithingPlan(registries, malformedLevel), /integer >= 0/)
      && !!thrown(() => initializeRunSmithing(registries, conflict), /level conflict/),
    'SMITH-MALFORMED-NUMBERS', 'negative/fractional purses and fractional tiers are rejected, never rounded or clamped');
  const legacyMap = newReaver(2162);
  delete legacyMap.itemUpgradeLevels;
  legacyMap.armamentLevels = { straightSword: 1 };
  initializeRunSmithing(registries, legacyMap);
  check(legacyMap.itemUpgradeLevels['armament/straightSword'] === 1 && legacyMap.armamentLevels === undefined,
    'SMITH-ONE-WAY-LEVEL-MIGRATION', 'the legacy bare armament map migrates once to namespaced authority and is removed');

  // Content-owned faucets and idempotent reward claims.
  const rewardRun = newReaver(217);
  const normal = grantSmithingReward(registries, rewardRun, 'normal', 'normal:1');
  const treasure = grantSmithingReward(registries, rewardRun, 'treasure', 'treasure:1');
  const elite = grantSmithingReward(registries, rewardRun, 'elite', 'elite:1');
  const eliteAgain = grantSmithingReward(registries, rewardRun, 'elite', 'elite:1');
  const boss = grantSmithingReward(registries, rewardRun, 'boss', 'boss:1');
  check(normal.amount === 0 && treasure.amount === 0 && elite.amount === 1 && boss.amount === 1
      && rewardRun.smithingStones === 2,
    'SMITH-REWARD-TABLE', 'normal/treasure award 0; elite/boss award 1 from the balance table');
  check(eliteAgain.duplicate === true && eliteAgain.amount === 0
      && rewardRun.smithingRewardClaims.length === 4 && rewardRun.smithingStones === 2,
    'SMITH-REWARD-IDEMPOTENT', 'replaying one reward id is a zero-award duplicate and cannot mint another Stone');

  const faucetStorage = createMemoryStorage();
  const faucetSaves = createSaveManager(faucetStorage);
  const faucetRun = newReaver(219);
  const firstFaucet = grantSmithingReward(registries, faucetRun, 'elite', 'elite:persisted');
  faucetSaves.saveRun(faucetRun, createRng(faucetRun.seed, faucetRun.streamCounters));
  const loadedFaucetRun = faucetSaves.loadRun(registries);
  const replayedFaucet = grantSmithingReward(registries, loadedFaucetRun, 'elite', 'elite:persisted');
  check(firstFaucet.amount === 1 && loadedFaucetRun?.smithingStones === 1
      && loadedFaucetRun?.smithingRewardClaims?.filter((id) => id === 'elite:persisted').length === 1
      && replayedFaucet.duplicate === true && replayedFaucet.amount === 0
      && loadedFaucetRun.smithingStones === 1,
    'SMITH-REWARD-SAVE-REPLAY', 'save/load between an elite claim and replay preserves the claim and refuses a second Stone');

  const pendingStorage = createMemoryStorage();
  const pendingSaves = createSaveManager(pendingStorage);
  const pendingRun = newReaver(221);
  const pendingStone = grantSmithingReward(registries, pendingRun, 'elite', 'elite:pending');
  pendingRun.pendingReward = {
    schemaVersion: 1,
    source: 'elite',
    after: 'map',
    rewards: {
      title: 'ELITE VANQUISHED',
      cinders: 32,
      cardIds: ['crimsonCleave', 'shieldBash', 'quickstep'],
      smithingStoneReceipt: pendingStone,
    },
    states: { smithingStone: 'taken' },
    chosenCardId: null,
  };
  pendingSaves.saveRun(pendingRun, createRng(pendingRun.seed, pendingRun.streamCounters));
  const resumedPending = pendingSaves.loadRun(registries);
  resumedPending.cinders += 32;
  resumedPending.pendingReward.states.cinders = 'taken';
  pendingSaves.saveRun(resumedPending, createRng(resumedPending.seed, resumedPending.streamCounters));
  const resumedPartial = pendingSaves.loadRun(registries);
  check(resumedPartial?.smithingStones === 1
      && resumedPartial?.smithingRewardClaims?.includes('elite:pending')
      && resumedPartial?.pendingReward?.states?.smithingStone === 'taken'
      && resumedPartial?.pendingReward?.states?.cinders === 'taken'
      && resumedPartial?.cinders === pendingRun.cinders + 32,
    'SMITH-PENDING-REWARD-ROUNDTRIP', 'interruption and partial collection preserve the Stone, claim, exact offer, and Taken states');

  const badPendingStorage = createMemoryStorage();
  const badPendingSaves = createSaveManager(badPendingStorage);
  const badPendingRun = structuredClone(pendingRun);
  badPendingRun.pendingReward.rewards.cardIds = ['notARealCard'];
  badPendingStorage.setItem(RUN_KEY, JSON.stringify(badPendingRun));
  check(badPendingSaves.loadRun(registries) === null
      && /Malformed pending reward references/.test(badPendingSaves.runStatus().reason || ''),
    'SMITH-PENDING-REWARD-REFUSAL', 'a saved pending offer with an unknown content id archives by name instead of crashing on resume');

  // Co-op clients send intent only. A forged client-authored affordable view
  // is ignored; the host reconstructs and revalidates the real plan, then its
  // receipt and run-owned state survive host serialization/restoration.
  const coop = createSession({ registries, seedString: 'GOLDBOUGH' });
  const host = coop.addMember({ id: 'host', name: 'Host', classId: 'reaver' });
  coop.addMember({ id: 'guest', name: 'Guest', classId: 'reaver' });
  coop.start();
  const anchor = Object.values(coop.session.mapGraph.nodes)
    .find((node) => Array.isArray(node.next) && node.next.length) || Object.values(coop.session.mapGraph.nodes)[0];
  coop.session.cursorId = anchor.id;
  coop.session.scene = {
    kind: 'shrine',
    done: {},
    smithing: {
      host: { stones: 0, candidates: [{ armamentId: 'straightSword', cost: 0, affordable: true }] },
      guest: smithingPlan(registries, coop.livingMembers().find((member) => member.id === 'guest').run),
    },
    receipts: {},
  };
  const forged = coop.shrineChoice('host', 'smith', 'straightSword');
  check(forged.ok === false && /Insufficient Smithing Stones/.test(forged.error || '')
      && host.run.smithingStones === 0 && !host.run.itemUpgradeLevels['armament/straightSword']
      && !coop.session.scene.receipts.host,
    'SMITH-COOP-HOST-REFUSAL', 'host ignores a forged affordable client view and refuses the zero-purse intent without mutation');

  host.run.smithingStones = 1;
  coop.session.scene.smithing.host = smithingPlan(registries, host.run);
  const accepted = coop.shrineChoice('host', 'smith', 'straightSword');
  const coopView = coop.snapshot();
  const hostView = coopView.party.find((member) => member.id === 'host');
  check(accepted.ok === true && host.run.smithingStones === 0 && host.run.itemUpgradeLevels['armament/straightSword'] === 1
      && coopView.scene.receipts.host?.armamentId === 'straightSword'
      && hostView?.smithingStones === 0 && hostView?.itemUpgradeLevels?.['armament/straightSword'] === 1,
    'SMITH-COOP-HOST-COMMIT', 'host revalidates, spends, promotes, and broadcasts one durable armament receipt');

  const serialized = coop.serialize();
  const restored = restoreSession(registries, structuredClone(serialized));
  const restoredView = restored.snapshot();
  const restoredHost = restoredView.party.find((member) => member.id === 'host');
  check(!!serialized && restoredHost?.smithingStones === 0
      && restoredHost?.itemUpgradeLevels?.['armament/straightSword'] === 1
      && restoredHost.deck.filter((card) => card.sourceArmamentId === 'straightSword')
        .every((card) => card.smithingLevel === 1 && card.upgraded === false)
      && restoredView.scene.receipts.host?.afterLevel === 1,
    'SMITH-COOP-RESTORE', 'host serialization/restoration preserves purse, tier, source carriers, and the visible Smith receipt');

  console.log('\n  Boundary: headless source/model/save/session semantics only; no DOM, browser pixels, screenshots, generated bundles, network, or repository writes were checked.');
  if (failures) console.log(`armament-smithing: ${checks - failures} passed, ${failures} failed`);
  else console.log(`armament-smithing: OK — ${checks} checks passed`);
  return failures ? 1 : 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`armament-smithing: HARNESS COULD NOT RUN - ${error?.stack || error}`);
  process.exitCode = 2;
}
