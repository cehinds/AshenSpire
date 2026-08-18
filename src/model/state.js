// src/model/state.js â€” run/combat state factories + (de)serialization (SPEC Â§3.3, Â§3.12)
//
// State stores INSTANCE data referencing definitions by id only:
//   deck card  = { instanceId, cardId, upgraded }
//   enemy      = { instanceIdâ†’id, enemyId, hp, block, statuses{}, poiseMeter, movesHistory[] }
//   player     = { â€¦poolsâ€¦, poiseMeter? â€” max from the equipment threshold
//                  receipt, value 0 with NO writer (see createPlayerCombatEntity) }
// Saves serialize instances + RNG counters, never definitions.
//
// Headless: no document/window/localStorage/timers.

import { createLoadout, runMods, stampDeck, startingDeckRefs, createEquipmentProfileRuleSnapshot, restoreEquipmentProfileRuleSnapshot, equipmentRequirementReceipt } from './loadout.js';
import { chargeKindForFlask, createFlaskCharges, flaskCapacity } from './gracerefill.js';
import { syncFlaskGrowth } from './flaskgrowth.js';
import { classAttributePreset, defaultCreationModeId, normalizeRunAttributes } from './attributes.js';
import {
  createDerivedStatRuleSnapshot,
  restoreDerivedStatRuleSnapshot,
  resolveDerivedStatRules,
  deriveStat,
} from './derivedStats.js';
import { resolveStartingKit, startingKitSnapshot } from './startingKits.js';
import { DAMAGE_SCHOOLS } from './schemas.js';
import { resolveRelicModifiers } from './relicModifiers.js';
// The run door's witness. Recording only; nothing here changes a number.
// One home for the mechanic: src/model/healLedger.js.
import { openLedger, closeLedger, note } from './healLedger.js';

// v3 (2026-08-14): flaskCharges carries its capacity ledger â€” base, grown,
// granted â€” and capacity must derive from the three (validateRunShape). v2
// saves lack the ledger and are attributed once at the load door
// (initializeRunFlaskCharges); v1 additionally predates starting kits.
export const RUN_SCHEMA_VERSION = 4;

/** Deterministic instance-id generator ('p1', 'p2', ... for prefix 'p'). */
export function createIdGen(prefix = 'i') {
  let n = 0;
  return () => `${prefix}${++n}`;
}

export function createCardInstance(cardId, upgraded = false, idGen) {
  return { instanceId: idGen ? idGen() : `c_${cardId}_${Math.floor(Math.random() * 1e9)}`, cardId, upgraded: !!upgraded };
}

/** Build a deck of card instances from an array of card ids. */
export function createDeck(cardIds, idGen = createIdGen('d')) {
  return cardIds.map((cardId) => createCardInstance(cardId, false, idGen));
}

// ---------------------------------------------------------------------------
// Run state (SPEC Â§3.12 save shape)
// ---------------------------------------------------------------------------

/**
 * createRunState({ seed, classId, registries }) â†’ new run at floor 0, act 1.
 * Starting deck/relic/HP come from the class def; cinders from
 * balance.startingCinders (default 0).
 */
export function createRunState({
  seed,
  classId,
  registries,
  attributeMode = undefined,
  attributes: requestedAttributes = undefined,
  derivedStatOptions = {},
  derivedStatRuleSnapshot = undefined,
  startingKitId = undefined,
  profileMeta = {},
}) {
  const classDef = registries.classes.get(classId);
  const selectedAttributeMode = attributeMode === undefined
    ? defaultCreationModeId(registries)
    : attributeMode;
  const attributes = requestedAttributes === undefined
    ? classAttributePreset(registries, classId, selectedAttributeMode)
    : normalizeRunAttributes({ class: classId, attributeMode: selectedAttributeMode, attributes: requestedAttributes }, registries).attributes;
  const idGen = createIdGen('rc');
  const startingKit = resolveStartingKit(registries, classId, startingKitId, profileMeta);
  const loadout = createLoadout(registries, classId, startingKit);
  for (const [slotId, itemId] of Object.entries({ rightHand: startingKit.rightHand, leftHand: startingKit.leftHand })) {
    if (!itemId) continue;
    const piece = (registries.equipment.armaments || []).find((row) => row.id === itemId);
    const receipt = equipmentRequirementReceipt(registries, piece, attributes);
    if (!receipt.ok) {
      const failed = receipt.failures[0];
      throw new Error(`${startingKit.id}.${slotId}: ${itemId} requires ${failed.attributeId} ${failed.required} (got ${failed.actual})`);
    }
  }
  // Armour can carry `self.maxHp`, so the pool it sets has to be known before
  // hp is filled â€” the run starts at full, in whatever it starts wearing.
  const oldMaxHp = classDef.maxHp + runMods(registries, loadout, classId).maxHp;
  const run = {
    schemaVersion: RUN_SCHEMA_VERSION,
    contentVersion: registries.contentVersion,
    seed: seed >>> 0,
    streamCounters: {},
    class: classId,
    startingKitId: startingKit.id,
    startingKitSnapshot: startingKitSnapshot(startingKit),
    attributeMode: selectedAttributeMode,
    attributes,
    // LEVELS BOUGHT AT SHRINES, per run â€” Constantine: "players should have the
    // option to level up their character (per run) by trading cinders". It is a
    // COUNT and not a copy of anything: the points themselves live in
    // `attributes` (where every reader already looks, so a level is worth
    // exactly what the derived-stat table says a point is worth), and this
    // number is what the COST RAMP indexes on. `model/levelup.js`.
    levelUps: 0,
    // THE POINTS THOSE LEVELS GRANTED, and not a copy of the count above: the
    // two are one number only while the level value is one number. Constantine
    // made it a dial on 2026-08-17 ("leave the level up value configurable"),
    // so six levels at 1 point and three at 2 are the same nine points and a
    // different number of purchases. The ramp indexes on purchases, the load
    // door checks points, and neither derives from the other once the dial has
    // moved mid-run. This is what makes a dial change unable to refuse a save.
    levelPoints: 0,
    floor: 0,
    actNumber: 1,
    mapNodeId: null,
    hp: oldMaxHp,
    maxHp: oldMaxHp,
    maxHpAdjustment: 0,
    cinders: registries.balance.startingCinders || 0,
    deck: startingDeckRefs(registries, loadout, classId).map((ref) => ({ ...createCardInstance(ref.cardId, false, idGen), ...ref })),
    loadout,
    relics: [classDef.startingRelic],
    damageBySchoolAdd: Object.fromEntries(DAMAGE_SCHOOLS.map((school) => [school, 0])),
    flasks: [], // [{ flaskId }] â€” max slots from balance.flaskSlots
    flaskCharges: createFlaskCharges(registries.balance, classDef.startingFlaskAllocation),
    seedString: null, // set by the orchestrator right after creation (display/replay)
    mapGraph: null,
    combatEntered: null,
    history: [],
    modifiers: [], // ascension-style seam (SPEC Â§10); always empty in v1
  };
  // THE DOOR OPENS HERE. Everything below this line writes to a run that
  // already exists, and until today none of it said so. `hp`/`maxHp` above are
  // the FIRST of three writers; initializeRunDerivedStats is the second and
  // reconcileRunLoadoutHp (via stampDeck) is the third and last. Sten's planted
  // double-count was swallowed by that last writer and his instrument went
  // green on it. Now each writer states what it computed and what it replaced.
  openLedger(run, 'createRunState', RUN_SCHEMA_VERSION);
  note(run, {
    kind: 'write',
    site: 'state.js:createRunState',
    field: 'maxHp',
    was: undefined,
    now: oldMaxHp,
    why: 'classDef.maxHp + runMods equipment bonus, set before the derived rules are resolved â€” the first of three writers',
  });
  // "and each character should start with those" â€” Constantine, 2026-08-08, the
  // FOURTH clause of the flask parenthesis, and it is here because it was very
  // nearly lost. His sentence was quoted to me tonight with this clause missing
  // from the quote; the ledger (`commons/decisions/directions.md` D10) has it.
  //
  // The table remains authoritative at both doors. Each class starts with its
  // class-authored HP/Mana split within the fixed three-charge capacity.
  // Crimson/Azure start full in that allocation. Utility
  // consumables remain in run.flasks and are never synthesized here.
  // Stamp the starting deck with whatever the loadout says. Bare-handed this
  // is a no-op; in an armour set with `defend.block=+2` it is already true of
  // the very first Defend you draw.
  initializeRunDerivedStats(run, registries, {
    snapshot: derivedStatRuleSnapshot,
    derivedStatOptions,
    preserveDeficits: false,
  });
  stampDeck(registries, run);
  // The growth chain binds from birth: a starting relic carrying a
  // balance.flaskGrowth row grows the maximum before the first node.
  syncFlaskGrowth(registries, run);
  closeLedger(run);
  return run;
}

function derivedOptions(registries, extra = {}) {
  const statLayer = (layer) => {
    if (!layer || typeof layer !== 'object') return layer;
    const { equipmentProfiles, ...stats } = layer;
    return stats;
  };
  return {
    ...extra,
    modeModifiers: statLayer(extra.modeModifiers),
    runModifiers: Array.isArray(extra.runModifiers) ? extra.runModifiers.map(statLayer) : statLayer(extra.runModifiers),
    explicitOverride: statLayer(extra.explicitOverride),
    authority: 'host',
    attributeIds: registries.attributes.ids(),
    classFields: ['maxHp', 'maxMana', 'hpPerConTier'],
    damageSchools: DAMAGE_SCHOOLS,
  };
}

/**
 * Resolve the host-owned rule snapshot into the run's authoritative outputs.
 * Existing current pools preserve their deficit during the one legacy
 * migration. Once a snapshot exists, restores validate and trust the persisted
 * outputs so a later content edit cannot rewrite a climb in progress.
 */
export function initializeRunDerivedStats(run, registries, {
  snapshot = undefined,
  derivedStatOptions = {},
  preserveDeficits = true,
} = {}) {
  const existing = snapshot || run.derivedStatRuleSnapshot;
  const classDef = registries.classes.get(run.class);
  const hpEquipmentBonus = run.loadout ? runMods(registries, run.loadout, run.class).maxHp : 0;
  run.equipmentProfileRuleSnapshot = run.equipmentProfileRuleSnapshot
    ? restoreEquipmentProfileRuleSnapshot(run.equipmentProfileRuleSnapshot, registries)
    : createEquipmentProfileRuleSnapshot(registries, derivedStatOptions);
  const currentRuleset = registries.derivedStatRules.rulesetVersion;
  const existingIsCurrent = existing && existing.rulesetVersion === currentRuleset;
  let restoredExisting = null;
  if (existing) restoredExisting = restoreDerivedStatRuleSnapshot(existing, derivedOptions(registries));

  // Schema v3 and older had no explanation for permanent max-HP reductions.
  // Infer the exact residual once from the old authoritative rule plus current
  // equipment. This preserves event curses instead of healing them away when
  // D22 changes the base formula.
  if (run.maxHpAdjustment === undefined) {
    if (restoredExisting && Number.isFinite(run.maxHp)) {
      const oldDerivedHp = deriveStat(restoredExisting.rules, 'hp', { attributes: run.attributes, classDef }).value;
      run.maxHpAdjustment = run.maxHp - (oldDerivedHp + hpEquipmentBonus);
    } else run.maxHpAdjustment = 0;
    note(run, {
      kind: 'heal',
      site: 'state.js:initializeRunDerivedStats',
      field: 'maxHpAdjustment',
      was: undefined,
      now: run.maxHpAdjustment,
      why: restoredExisting
        ? 'absent in the save: the permanent max-HP residual was INFERRED once from the old rule plus current equipment, so an event curse survives a formula change'
        : 'absent in the save and no old rule to infer from: assumed 0, i.e. this run is treated as never having been cursed',
    });
  }
  if (!Number.isInteger(run.maxHpAdjustment)) {
    throw new Error(`Persisted maxHpAdjustment must be an integer (got ${JSON.stringify(run.maxHpAdjustment)})`);
  }

  if (existingIsCurrent && run.derivedStatRuleSnapshot) {
    const restored = restoredExisting;
    const expectedByKey = [
      ['maxMana', 'mana'],
      ['maxStamina', 'stamina'],
      ['energyMax', 'energy'],
      ['drawPerTurn', 'draw'],
    ];
    for (const [key, statId] of expectedByKey) {
      const value = run[key];
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`Persisted ${key} must be a non-negative integer under its derived-stat snapshot`);
      }
      const expected = deriveStat(restored.rules, statId, { attributes: run.attributes, classDef }).value;
      if (value !== expected) throw new Error(`Persisted ${key} ${value} contradicts derived-stat snapshot value ${expected}`);
    }
    // MAX-HP HOME 1 of 3 (the validating one). Same formula as home 2 below and
    // home 3 in loadout.js:reconcileRunLoadoutHp. Deliberately NOT collapsed
    // this act â€” the ruling is visibility first, because you cannot safely
    // collapse what you cannot watch drift. It states its number so a tool can
    // compare the three instead of trusting that they agree.
    const expectedMaxHp = Math.max(1,
      deriveStat(restored.rules, 'hp', { attributes: run.attributes, classDef }).value
      + hpEquipmentBonus + run.maxHpAdjustment);
    note(run, {
      kind: 'compute',
      site: 'state.js:initializeRunDerivedStats(validate)',
      field: 'maxHp',
      was: run.maxHp,
      now: expectedMaxHp,
      why: 'max-HP home 1 of 3 â€” derived + equipment + adjustment, checked against the persisted value',
    });
    if (run.maxHp !== expectedMaxHp) {
      throw new Error(`Persisted maxHp ${run.maxHp} contradicts derived-stat snapshot/equipment/adjustment value ${expectedMaxHp}`);
    }
    const stampedDamage = restored.relicModifiers && restored.relicModifiers.damageBySchoolAdd
      || Object.fromEntries(DAMAGE_SCHOOLS.map((school) => [school, 0]));
    if (run.damageBySchoolAdd === undefined) run.damageBySchoolAdd = structuredClone(stampedDamage);
    for (const school of DAMAGE_SCHOOLS) {
      if (run.damageBySchoolAdd[school] !== (stampedDamage[school] || 0)) {
        throw new Error(`Persisted damageBySchoolAdd.${school} contradicts host relic snapshot`);
      }
    }
  }
  if (existingIsCurrent && run.derivedStatRuleSnapshot
    && run.maxHp !== undefined && run.hp !== undefined
    && run.maxMana !== undefined && run.mana !== undefined
    && run.maxStamina !== undefined && run.stamina !== undefined
    && run.energyMax !== undefined && run.drawPerTurn !== undefined) {
    return run;
  }

  // v1 carried class-authored 40/60/80 Mana pools. It is readable so its
  // current/max ratio can be migrated, but it is never retained as authority.
  // THE HOST'S RESOLVED TIER SIZE, HANDED TO THE RECEIPT THAT HAS TO FOLD INTO
  // IT. A relic `resource.attributeTier` row that states no `pointsPerTier`
  // inherits ßÝ9¶‰žËkºwµçM¥¹¥Ñ”¡ÉÕ¸¹µ…á!À¤€˜˜ÉÕ¸¹µ…á!À€ðô€À¤ì4(€€€ÁÉ½‰±•µÌ¹ÁÕÍ  µ…á!ÀµÕÍÐ‰”€ø€Àœ¤ì4(€ô4(€¥˜€¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡ÉÕ¸¹¡À¤€˜˜9Õµ‰•È¹¥Í¥¹¥Ñ”¡ÉÕ¸¹µ…á!À¤€˜˜€¡ÉÕ¸¹¡À€ð€ÀñðÉÕ¸¹¡À€øÉÕ¸¹µ…á!À¤¤ì4(€€€ÁÉ½‰±•µÌ¹ÁÕÍ  ¡ÀµÕÍÐ‰”‰•ÑÝ••¸€À…¹µ…á!Àœ¤ì4(€ô4(€¥˜€¡ÉÕ¸¹µ…á!Á‘©ÕÍÑµ•¹Ð€„ôôÕ¹‘•™¥¹•€˜˜€…9Õµ‰•È¹¥Í%¹Ñ••È¡ÉÕ¸¹µ…á!Á‘©ÕÍÑµ•¹Ð¤¤ì4(€€€ÁÉ½‰±•µÌ¹ÁÕÍ  µ…á!Á‘©ÕÍÑµ•¹ÐµÕÍÐ‰”…¸¥¹Ñ••Èœ¤ì4(€ô4(€¥˜€¡ÉÕ¸¹‘…µ…•	åM¡½½±‘€„ôôÕ¹‘•™¥¹•¤ì4(€€€™½È€¡½¹ÍÐÍ¡½½°½˜5}M!==1L¤ì4(€€€€€¥˜€ …9Õµ‰•È¹¥Í%¹Ñ••È¡ÉÕ¸¹‘…µ…•	åM¡½½±‘‘mÍ¡½½±t¤ñðÉÕ¸¹‘…µ…•	åM¡½½±‘‘mÍ¡½½±t€ð€À¤ì4(€€€€€€€ÁÉ½‰±•µÌ¹ÁÕÍ ¡‘…µ…•	åM¡½½±‘¸‘íÍ¡½½±ôµÕÍÐ‰”„¹½¸µ¹•…Ñ¥Ù”¥¹Ñ••É€¤ì4(€€€€€ô4(€€€ô4(€€€™½È€¡½¹ÍÐÍ¡½½°½˜=‰©•Ð¹­•åÌ¡ÉÕ¸¹‘…µ…•	åM¡½½±‘¤¤ì4(€€€€€¥˜€ …5}M!==1L¹¥¹±Õ‘•Ì¡Í¡½½°¤¤ÁÉ½‰±•µÌ¹ÁÕÍ ¡‘…µ…•	åM¡½½±‘¸‘íÍ¡½½±ô¥Ì¹½Ð„±•…°‘…µ…”Í¡½½±€¤ì4(€€€ô4(€ô4(€¥˜€¡ÉÕ¸¹µ…á5…¹„€„ôôÕ¹‘•™¥¹•€˜˜€ …9Õµ‰•È¹¥Í¥¹¥Ñ”¡ÉÕ¸¹µ…á5…¹„¤ñðÉÕ¸¹µ…á5…¹„€ðô€À¤¤ì4(€€€ÁÉ½‰±•µÌ¹ÁÕÍ  µ…á5…¹„µÕÍÐ‰”€ø€Àœ¤ì4(€ô4(€¥˜€¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡ÉÕ¸¹µ…¹„¤€˜˜9Õµ‰•È¹¥Í¥¹¥Ñ”¡ÉÕ¸¹µ…á5…¹„¤€˜˜€¡ÉÕ¸¹µ…¹„€ð€ÀñðÉÕ¸¹µ…¹„€øÉÕ¸¹µ…á5…¹„¤¤ì4(€€€ÁÉ½‰±•µÌ¹ÁÕÍ  µ…¹„µÕÍÐ‰”‰•ÑÝ••¸€À…¹µ…á5…¹„œ¤ì4(€ô4(€½¹ÍÐÍÑ…µ¥¹…‰Í•¹Ð€ôÉÕ¸¹ÍÑ…µ¥¹„€ôôôÕ¹‘•™¥¹•ì4(€½¹ÍÐµ…áMÑ…µ¥¹…‰Í•¹Ð€ôÉÕ¸¹µ…áMÑ…µ¥¹„€ôôôÕ¹‘•™¥¹•ì4(€¥˜€¡ÍÑ…µ¥¹…‰Í•¹Ð€„ôôµ…áMÑ…µ¥¹…‰Í•¹Ð¤ÁÉ½‰±•µÌ¹ÁÕÍ  ÍÑ…µ¥¹„…¹µ…áMÑ…µ¥¹„µÕÍÐ‰½Ñ ‰”ÁÉ•Í•¹Ð½È‰½Ñ ‰”…‰Í•¹Ðœ¤ì4(€¥˜€¡ÉÕ¸¹µ…áMÑ…µ¥¹„€„ôôÕ¹‘•™¥¹•€˜˜€ …9Õµ‰•È¹¥Í¥¹¥Ñ”¡ÉÕ¸¹µ…áMÑ…µ¥¹„¤ñðÉÕ¸¹µ…áMÑ…µ¥¹„€ð€À¤¤ÁÉ½‰±•µÌ¹ÁÕÍ  µ…áMÑ…µ¥¹„µÕÍÐ‰”€øô€Àœ¤ì4(€¥˜€¡9Õµ‰•È¹¥Í¥¹¥Ñ”¡ÉÕ¸¹ÍÑ…µ¥¹„¤€˜˜9Õµ‰•È¹¥Í¥¹¥Ñ”¡ÉÕ¸¹µ…áMÑ…µ¥¹„¤€˜˜€¡ÉÕ¸¹ÍÑ…µ¥¹„€ð€ÀñðÉÕ¸¹ÍÑ…µ¥¹„€øÉÕ¸¹µ…áMÑ…µ¥¹„¤¤ì4(€€€ÁÉ½‰±•µÌ¹ÁÕÍ  ÍÑ…µ¥¹„µÕÍÐ‰”‰•ÑÝ••¸€À…¹µ…áMÑ…µ¥¹„œ¤ì4(€ô4(€¥˜€¡ÉÕ¸¹™±…Í­¡…É•Ì€„ôôÕ¹‘•™¥¹•¤ì4(€€€½¹ÍÐ˜€ôÉÕ¸¹™±…Í­¡…É•Ìì4(€€€¥˜€ …˜ñð€…9Õµ‰•È¹¥Í%¹Ñ••È¡˜¹…Á…¥Ñä¤ñð˜¹…Á…¥Ñä€ðô€À4(€€€€€ñð€…9Õµ‰•È¹¥Í%¹Ñ••È¡˜¹¡À¤ñð˜¹¡À€ð€Àñð€…9Õµ‰•È¹¥Í%¹Ñ••È¡˜¹µ…¹„¤ñð˜¹µ…¹„€ð€À4(€€€€€ñð˜¹¡À€¬˜¹µ…¹„€„ôô˜¹…Á…¥Ñä4(€€€€€ñð€…9Õµ‰•È¹¥Í%¹Ñ••È¡˜¹¡ÁÕÉÉ•¹Ð¤ñð˜¹¡ÁÕÉÉ•¹Ð€ð€Àñð˜¹¡ÁÕÉÉ•¹Ð€ø˜¹¡À4(€€€€€ñð€…9Õµ‰•È¹¥Í%¹Ñ••È¡˜¹µ…¹…ÕÉÉ•¹Ð¤ñð˜¹µ…¹…ÕÉÉ•¹Ð€ð€Àñð˜¹µ…¹…ÕÉÉ•¹Ð€ø˜¹µ…¹„¤ì4(€€€€€ÁÉ½‰±•µÌ¹ÁÕÍ  ™±…Í­¡…É•ÌµÕÍÐÍ…Ñ¥Í™ä¡À€¬µ…¹„€ô…Á…¥ÑäÝ¥Ñ ‰½Õ¹‘•ÕÉÉ•¹Ð½Õ¹ÑÌœ¤ì4(€€€ô4(€€€€¼¼É½Ý¹€ƒŠPÝ¡…ÐÑ¡”É½ÝÑ ¡…¥¸ÕÉÉ•¹Ñ±ä½¹ÑÉ¥‰ÕÑ•Ì€¡µ½‘•°½™±…Í­É½ÝÑ ¹©Ì¤¸4(€€€€¼¼=ÁÑ¥½¹…°½¸ÁÉ”µ±•‘•ÈÍ…Ù•Ì½¹±äìÍå¹±…Í­É½ÝÑ ÑÉ•…ÑÌ…‰Í•¹Ð…Ìé•É¼¸4(€€€½¹ÍÐÉ½Ý¹M½Õ¹€ô˜€˜˜˜¹É½Ý¸€˜˜ÑåÁ•½˜˜¹É½Ý¸€ôôô€½‰©•Ðœ4(€€€€€€˜˜9Õµ‰•È¹¥Í%¹Ñ••È¡˜¹É½Ý¸¹¡À¤€˜˜˜¹É½Ý¸¹¡À€øô€À4(€€€€€€˜˜9Õµ‰•È¹¥Í%¹Ñ••È¡˜¹É½Ý¸¹µ…¹„¤€˜˜˜¹É½Ý¸¹µ…¹„€øô€Àì4(€€€¥˜€¡˜€˜˜˜¹É½Ý¸€„ôôÕ¹‘•™¥¹•€˜˜€…É½Ý¹M½Õ¹¤ì4(€€€€€ÁÉ½‰±•µÌ¹ÁÕÍ  ™±…Í­¡…É•Ì¹É½Ý¸µÕÍÐ‰”ì¡À°µ…¹„ô¹½¸µ¹•…Ñ¥Ù”¥¹Ñ••ÉÌÝ¡•¸ÁÉ•Í•¹Ðœ¤ì4(€€€ô4(€€€€¼¼Q!A%Qd1HƒŠP…Á…¥Ñä¥Ì½¹”ÍÑ½É•¹Õµ‰•È™•‰äÑÝ¼‘½½ÉÌ4(€€€€¼¼€¡µ½‘•°½™±…Í­É½ÝÑ ¹©Ì°Q!==IL¤°…¹Ñ¡¥Ì¥ÌÑ¡”¡•¬Ñ¡…Ð¥ÐÍÑ…åÌ4(€€€€¼¼…½Õ¹Ñ…‰±”è‰…Í”€¡‰½É¸°É•…Ñ•±…Í­¡…É•Ì¤€¬É½Ý¸€¡Á½ÍÍ•ÍÍ¥½¸‘½½È¤4(€€€€¼¼€¬É…¹Ñ•€¡µ½µ•¹Ð‘½½È¤µÕÍÐ•ÅÕ…°Ý¡…Ð¥ÌÍÑ½É•¸…Á…¥Ñä¹¼±•‘•È4(€€€€¼¼…¸•áÁ±…¥¸¥ÌÉ•™ÕÍ•	d95ƒŠPÑ¡…ÐÉ•¥ÌÑ¡”µ…¡¥¹”™½É´½˜Ñ¡”4(€€€€¼¼ÑÝ¼µ‘½½ÉÌÝ…É¹¥¹œÑ¡…ÐÕÍ•Ñ¼±¥Ù”½¹±ä¥¸ÁÉ½Í”€¡MAƒ
œÔ¸Ô¸È¤è„4(€€€€¼¼€‰±•…¹ÕÀˆÑ¡…ÐÉ”µ‘•É¥Ù•Ì…Á…¥Ñä™É½´Ñ¡”¡…¥¸…±½¹”¹½Ü™…¥±ÌÑ¡”4(€€€€¼¼™¥ÉÍÐÍ…Ù”¥ÐÑ½Õ¡•Ì¥¹ÍÑ•…½˜Í¥±•¹Ñ±ä‘•±•Ñ¥¹œ•Ù•Éä­••ÁÍ…­”¡…É”¸4(€€€€¼¼AÉ”µ±•‘•ÈÍ…Ù•Ì€¡ØÄ½ØÈ¤…ÉÉä¹¼‰…Í”½É…¹Ñ•ìÑ¡•ä…É”…‘µ¥ÑÑ•½¹±ä4(€€€€¼¼Ñ¡É½Õ Ñ¡”µ¥É…Ñ¥½¸‘½½È€¡ÁÉ•1•‘•È¤°Ý¡•É”¥¹¥Ñ¥…±¥é•IÕ¹±…Í­¡…É•Ì4(€€€€¼¼…ÑÑÉ¥‰ÕÑ•ÌÑ¡•´½¹”°‰äÑ¡”ÍÑ…Ñ•ÉÕ±”°‰•™½É”Ñ¡”ÉÕ¸¥Ì•Ù•ÈÉ”µÍ…Ù•¸4(€€€¥˜€¡˜€˜˜˜¹‰…Í”€ôôôÕ¹‘•™¥¹•€˜˜˜¹É…¹Ñ•€ôôôÕ¹‘•™¥¹•¤ì4(€€€€€¥˜€ …ÁÉ•1•‘•È¤ÁÉ½‰±•µÌ¹ÁÕÍ  ™±…Í­¡…É•Ì¥Ìµ¥ÍÍ¥¹œ¥ÑÌ…Á…¥Ñä±•‘•È€¡‰…Í”°É…¹Ñ•¤ƒŠPÉ•ÅÕ¥É•…ÐÑ¡¥ÌÍ¡•µ„Ù•ÉÍ¥½¸œ¤ì4(€€€ô•±Í”¥˜€¡˜¤ì4(€€€€€½¹ÍÐ‰…Í•M½Õ¹€ô9Õµ‰•È¹¥Í%¹Ñ••È¡˜¹‰…Í”¤€˜˜˜¹‰…Í”€ø€Àì4(€€€€€½¹ÍÐÉ…¹Ñ•‘M½Õ¹€ô9Õµ‰•È¹¥Í%¹Ñ••È¡˜¹É…¹Ñ•¤€˜˜˜¹É…¹Ñ•€øô€Àì4(€€€€€¥˜€ …‰…Í•M½Õ¹¤ÁÉ½‰±•µÌ¹ÁÕÍ  ™±…Í­¡…É•Ì¹‰…Í”µÕÍÐ‰”„Á½Í¥Ñ¥Ù”¥¹Ñ••Èœ¤ì4(€€€€€¥˜€ …É…¹Ñ•‘M½Õ¹¤ÁÉ½‰±•µÌ¹ÁÕÍ  ™±…Í­¡…É•Ì¹É…¹Ñ•µÕÍÐ‰”„¹½¸µ¹•…Ñ¥Ù”¥¹Ñ••Èœ¤ì4(€€€€€¥˜€ …É½Ý¹M½Õ¹¤ì4(€€€€€€€ÁÉ½‰±•µÌ¹ÁÕÍ  ™±…Í­¡…É•Ì¹É½Ý¸µÕÍÐ‰”ÁÉ•Í•¹Ð‰•Í¥‘”Ñ¡”…Á…¥Ñä±•‘•Èœ¤ì4(€€€€€ô•±Í”¥˜€¡‰…Í•M½Õ¹€˜˜É…¹Ñ•‘M½Õ¹€˜˜9Õµ‰•È¹¥Í%¹Ñ••È¡˜¹…Á…¥Ñä¤4(€€€€€€€€˜˜˜¹…Á…¥Ñä€„ôô˜¹‰…Í”€¬˜¹É½Ý¸¹¡À€¬˜¹É½Ý¸¹µ…¹„€¬˜¹É…¹Ñ•¤ì4(€€€€€€€ÁÉ½‰±•µÌ¹ÁÕÍ ¡™±…Í­¡…É•Ì¹…Á…¥Ñä€‘í˜¹…Á…¥Ñåô¥Ì¹½Ð…½Õ¹Ñ•™½È‰ä¥ÑÌÁ…ÉÑÌƒŠP€4(€€€€€€€€€€¬‰…Í”€‘í˜¹‰…Í•ô€¬É½Ý¸€‘í˜¹É½Ý¸¹¡À€¬˜¹É½Ý¸¹µ…¹…ô€¬É…¹Ñ•€‘í˜¹É…¹Ñ•‘ô€4(€€€€€€€€€€¬€ô€‘í˜¹‰…Í”€¬˜¹É½Ý¸¹¡À€¬˜¹É½Ý¸¹µ…¹„€¬˜¹É…¹Ñ•‘õ€¤ì4(€€€€€ô4(€€€ô4(€ô4(€¥˜€¡ÉÕ¸¹•¹•Éå5…à€„ôôÕ¹‘•™¥¹•€˜˜€ …9Õµ‰•È¹¥Í%¹Ñ••È¡ÉÕ¸¹•¹•Éå5…à¤ñðÉÕ¸¹•¹•Éå5…à€ð€À¤¤ÁÉ½‰±•µÌ¹ÁÕÍ  •¹•Éå5…àµÕÍÐ‰”„¹½¸µ¹•…Ñ¥Ù”¥¹Ñ••Èœ¤ì4(€¥˜€¡ÉÕ¸¹‘É…ÝA•ÉQÕÉ¸€„ôôÕ¹‘•™¥¹•€˜˜€ …9Õµ‰•È¹¥Í%¹Ñ••È¡ÉÕ¸¹‘É…ÝA•ÉQÕÉ¸¤ñðÉÕ¸¹‘É…ÝA•ÉQÕÉ¸€ð€À¤¤ÁÉ½‰±•µÌ¹ÁÕÍ  ‘É…ÝA•ÉQÕÉ¸µÕÍÐ‰”„¹½¸µ¹•…Ñ¥Ù”¥¹Ñ••Èœ¤ì4(€É•ÑÕÉ¸ÁÉ½‰±•µÌì4)ô4(4)•áÁ½ÉÐ™Õ¹Ñ¥½¸Í•É¥…±¥é•IÕ¸¡ÉÕ¸¤ì4(€É•ÑÕÉ¸)M=8¹ÍÑÉ¥¹¥™ä¡ÉÕ¸¤ì4)ô4(4)•áÁ½ÉÐ™Õ¹Ñ¥½¸¥¹¥Ñ¥…±¥é•IÕ¹±…Í­¡…É•Ì¡ÉÕ¸°É•¥ÍÑÉ¥•Ì¤ì4(€¥˜€ …ÉÕ¸¹™±…Í­¡…É•Ì¤ì4(€€€½¹ÍÐÝ…Í±…Í­Ì€ôÍÑÉÕÑÕÉ•‘±½¹”¡ÉÕ¸¹™±…Í­Ìñðmt¤ì4(€€€½¹ÍÐ…±±½…Ñ¥½¸€ôÉ•¥ÍÑÉ¥•Ì¹±…ÍÍ•Ì¹•Ð¡ÉÕ¸¹±…ÍÌ¤¹ÍÑ…ÉÑ¥¹±…Í­±±½…Ñ¥½¸ì4(€€€ÉÕ¸¹™±…Í­¡…É•Ì€ôÉ•…Ñ•±…Í­¡…É•Ì¡É•¥ÍÑÉ¥•Ì¹‰…±…¹”°…±±½…Ñ¥½¸¤ì4(€€€½¹ÍÐ±•…ä€ôÉÕ¸¹™±…Í­Ìñðmtì4(€€€ÉÕ¸¹™±…Í­¡…É•Ì¹¡ÁÕÉÉ•¹Ð€ô5…Ñ ¹µ¥¸¡ÉÕ¸¹™±…Í­¡…É•Ì¹¡À°±•…ä¹™¥±Ñ•È ¡˜¤€ôø˜€˜˜¡…É•-¥¹‘½É±…Í¬¡É•¥ÍÑÉ¥•Ì°˜¹™±…Í­%¤€ôôô€¡Àœ¤¹±•¹Ñ ¤ì4(€€€ÉÕ¸¹™±…Í­¡…É•Ì¹µ…¹…ÕÉÉ•¹Ð€ô5…Ñ ¹µ¥¸¡ÉÕ¸¹™±…Í­¡…É•Ì¹µ…¹„°±•…ä¹™¥±Ñ•È ¡˜¤€ôø˜€˜˜¡…É•-¥¹‘½É±…Í¬¡É•¥ÍÑÉ¥•Ì°˜¹™±…Í­%¤€ôôô€µ…¹„œ¤¹±•¹Ñ ¤ì4(€€€ÉÕ¸¹™±…Í­Ì€ô€¡ÉÕ¸¹™±…Í­Ìñðmt¤¹™¥±Ñ•È ¡˜¤€ôø˜€˜˜¡…É•-¥¹‘½É±…Í¬¡É•¥ÍÑÉ¥•Ì°˜¹™±…Í­%¤€ôô¹Õ±°¤ì4(€€€€¼¼=9=Q!Q!IU9Q!1L¸™±…Í­¡…É•Í€¥Ì½ÁÑ¥½¹…°¥¸IU9}M!A4(€€€€¼¼Ý¥Ñ ¹¼Í¡•µ…Y•ÉÍ¥½¸…Ñ”°Í¼Ñ¡¥Ì™¥É•Ì½¸„UII9PµÍ¡•µ„Í…Ù”Ñ¡…Ð4(€€€€¼¼¡…Ì±½ÍÐÑ¡”™¥•±°¹½Ð½¹±ä½¸Ñ¡”ÁÉ”µ±•‘•ÈÍ…Ù”¥ÐÝ…ÌÝÉ¥ÑÑ•¸™½ÈƒŠP4(€€€€¼¼…¹•Ù•ÉäÍÁ•¹Ð¡…É”½µ•Ì‰…¬¸%Ð¥Ì…±±½Ý•Ñ¼ì¥Ðµ…ä¹½Ð‰”ÅÕ¥•Ð4(€€€€¼¼…‰½ÕÐ¥Ð¸4(€€€¹½Ñ”¡ÉÕ¸°ì4(€€€€€­¥¹è€¡•…°œ°4(€€€€€Í¥Ñ”è€ÍÑ…Ñ”¹©Ìé¥¹¥Ñ¥…±¥é•IÕ¹±…Í­¡…É•Ìœ°4(€€€€€™¥•±è€™±…Í­¡…É•Ìœ°4(€€€€€Ý…ÌèÕ¹‘•™¥¹•°4(€€€€€¹½Üèì¡ÀèÉÕ¸¹™±…Í­¡…É•Ì¹¡À°µ…¹„èÉÕ¸¹™±…Í­¡…É•Ì¹µ…¹„°¡ÁÕÉÉ•¹ÐèÉÕ¸¹™±…Í­¡…É•Ì¹¡ÁÕÉÉ•¹Ð°µ…¹…ÕÉÉ•¹ÐèÉÕ¸¹™±…Í­¡…É•Ì¹µ…¹…ÕÉÉ•¹Ðô°4(€€€€€Ý¡äè…‰Í•¹Ð¥¸Ñ¡”Í…Ù”èÉ•‰Õ¥±Ð™É½´Ñ¡”±…ÍÌ…±±½…Ñ¥½¸°ÕÉÉ•¹ÑÌÉ•½¹ÍÑÉÕÑ•™É½´€‘íÝ…Í±…Í­Ì¹±•¹Ñ¡ô±•…äÉÕ¸¹™±…Í­Ì•¹ÑÈ¡¥•Ì¥€°4(€€€ô¤ì4(€ô4(€€¼¼ƒŠVCŠVCŠV@Q!=9µQ%5QQI%	UQ%=8ƒŠPÁÉ”µ±•‘•ÈÍ…Ù•Ì€¡ØÄ½ØÈ¤°ÍÑ…Ñ•°¹½Ð4(€€¼¼Í¥±•¹Ð¸ØÈÍ…Ù”ÍÑ½É•Ì…Á…¥ÑäÝ¥Ñ ¹¼±•‘•Èè¡…¥¸É½ÝÑ …±Ý…åÌ4(€€¼¼ÝÉ½Ñ”É½Ý¹€°‰ÕÐÑ¡”µ½µ•¹Ð‘½½È€¡½À…‘‘±…Í­…Á…¥ÑäƒŠP­••ÁÍ…­•Ì°4(€€¼¼•Ù•¹Ð•™™•ÑÌ¤É•½É‘•¹½Ñ¡¥¹œ¸Q¡”ÉÕ±”°¥¸™Õ±°è4(€€¼¼€€‰…Í”€€€€ôÑ¡”ÕÉÉ•¹Ð…ÕÑ¡½É•‰…±…¹”¹™±…Í­…Á…¥Ñä°±…µÁ•Ñ¼4(€€¼¼€€€€€€€€€€€€…Á…¥ÑäƒŠ"HÉ½Ý¹Q½Ñ…°ƒŠPÑ¡”‰•ÍÐÝ¥Ñ¹•ÍÌ…Ù…¥±…‰±”™½ÈÝ¡…Ð4(€€¼¼€€€€€€€€€€€€Ñ¡”Ù•ÍÍ•°Ý…Ì‰½É¸¡½±‘¥¹œ°¹•Ù•È…±±½Ý•Ñ¼¥¹Ù•¹Ð¡…É•Ì¸4(€€¼¼€€É…¹Ñ•€ô…Á…¥ÑäƒŠ"HÉ½Ý¹Q½Ñ…°ƒŠ"H‰…Í”ƒŠP•Ù•Éä¡…É”Ñ¡…Ð‰…Í”…¹Ñ¡”4(€€¼¼€€€€€€€€€€€€¡…¥¸Ì½Ý¸±•‘•È…¹¹½Ð…½Õ¹Ð™½È¥Ì…ÑÑÉ¥‰ÕÑ•Ñ¼Ñ¡”4(€€¼¼€€€€€€€€€€€€µ½µ•¹Ð‘½½È°‰•…ÕÍ”Ñ¡”µ½µ•¹Ð‘½½ÈÝ…ÌÑ¡”Õ¹ÑÉ…­•½¹”¸4(€€¼¼!½¹•ÍÐ‘•™…Õ±ÑÌ½˜Ñ¡”±…µÀè„‰…±…¹”É•ÑÕ¹•U@Í¥¹”Ñ¡”Í…Ù”å¥•±‘Ì4(€€¼¼‰…Í”€ô…Á…¥ÑäƒŠ"HÉ½Ý¹Q½Ñ…°…¹É…¹Ñ•€À€¡Ñ¡”Í…Ù”­••ÁÌ¥ÑÌ…Á…¥Ñä°4(€€¼¼¹½Ñ¡¥¹œ¥Ì¥¹Ù•¹Ñ•¤ì„­••ÁÍ…­”ÍÕÉÁ±ÕÌ±…¹‘Ì¥¸É…¹Ñ•°Ý¡¥ ¥ÌÝ¡•É”4(€€¼¼¥Ð…µ”™É½´¸IÕ¹Ì½¹”Á•ÈÍ…Ù”°‰•™½É”Ñ¡”ÉÕ¸…¸‰”É”µÍ•É¥…±¥é•ì4(€€¼¼™É½´Ñ¡•¸½¸Ù…±¥‘…Ñ•IÕ¹M¡…Á”•¹™½É•Ì…Á…¥Ñä€ôôô‰…Í”€¬É½Ý¸€¬É…¹Ñ•¸4(€ì4(€€€½¹ÍÐ˜€ôÉÕ¸¹™±…Í­¡…É•Ìì4(€€€¥˜€¡˜¹‰…Í”€ôôôÕ¹‘•™¥¹•€˜˜˜¹É…¹Ñ•€ôôôÕ¹‘•™¥¹•¤ì4(€€€€€½¹ÍÐÉ½Ý¹Q½Ñ…°€ô˜¹É½Ý¸€˜˜9Õµ‰•È¹¥Í%¹Ñ••È¡˜¹É½Ý¸¹¡À¤€˜˜9Õµ‰•È¹¥Í%¹Ñ••È¡˜¹É½Ý¸¹µ…¹„¤4(€€€€€€€€ü˜¹É½Ý¸¹¡À€¬˜¹É½Ý¸¹µ…¹„4(€€€€€€€€è€Àì4(€€€€€¥˜€¡É½Ý¹Q½Ñ…°€øô˜¹…Á…¥Ñä¤ì4(€€€€€€€€¼¼Q¡”¡…¥¸Ì½Ý¸±•‘•È…¹¹½Ð™¥ÐÕ¹‘•ÈÑ¡”ÍÑ½É•…Á…¥ÑäƒŠPÑ¡…Ð¥Ì4(€€€€€€€€¼¼½ÉÉÕÁÑ¥½¸½˜•á…Ñ±äÑ¡”±…ÍÌÑ¡¥Ì±•‘•ÈÁ½±¥•Ì°¹½Ð„µ¥É…Ñ¥½¸¸4(€€€€€€€Ñ¡É½Ü¹•ÜÉÉ½È¡™±…Í­¡…É•Ì¹É½Ý¸Ñ½Ñ…°€‘íÉ½Ý¹Q½Ñ…±ôµ••ÑÌ½È•á••‘Ì…Á…¥Ñä€‘í˜¹…Á…¥ÑåôƒŠPÁÉ”µ±•‘•ÈÍ…Ù”¥ÌÕ¹…½Õ¹Ñ…‰±•€¤ì4(€€€€€ô4(€€€€€˜¹‰…Í”€ô5…Ñ ¹µ¥¸¡™±…Í­…Á…¥Ñä¡É•¥ÍÑÉ¥•Ì¹‰…±…¹”¤°˜¹…Á…¥Ñä€´É½Ý¹Q½Ñ…°¤ì4(€€€€€˜¹É…¹Ñ•€ô˜¹…Á…¥Ñä€´É½Ý¹Q½Ñ…°€´˜¹‰…Í”ì4(€€€€€¹½Ñ”¡ÉÕ¸°ì4(€€€€€€€­¥¹è€¡•…°œ°4(€€€€€€€Í¥Ñ”è€ÍÑ…Ñ”¹©Ìé¥¹¥Ñ¥…±¥é•IÕ¹±…Í­¡…É•Ì¡…ÑÑÉ¥‰ÕÑ¥½¸¤œ°4(€€€€€€€™¥•±è€™±…Í­¡…É•Ì¹‰…Í”½É…¹Ñ•œ°4(€€€€€€€Ý…ÌèÕ¹‘•™¥¹•°4(€€€€€€€¹½Üèì‰…Í”è˜¹‰…Í”°É…¹Ñ•è˜¹É…¹Ñ•°É½Ý¹Q½Ñ…°°…Á…¥Ñäè˜¹…Á…¥Ñäô°4(€€€€€€€Ý¡äè€ÁÉ”µ±•‘•ÈÍ…Ù”è…Á…¥ÑäÝ…Ì…ÑÑÉ¥‰ÕÑ•½¹”ƒŠP‰…Í”™É½´Ñ¡”ÕÉÉ•¹Ð…ÕÑ¡½É•‰…±…¹”°Ñ¡”Õ¹…½Õ¹Ñ•É•µ…¥¹‘•ÈÑ¼Ñ¡”µ½µ•¹Ð‘½½Èœ°4(€€€€€ô¤ì4(€€€ô4(€ô4(€€¼¼1½…‘•ÉÕ¹ÌÉ”µ‘•É¥Ù”Ñ¡”¡…¥¸¡•É”ƒŠPÑ¡”±½…‘½½È¸Í…Ù”…ÉÉå¥¹œ„4(€€¼¼É•±¥ŒÝ¡½Í”É½ÝÑ É½ÜÝ…Ì…ÕÑ¡½É•…™Ñ•È¥ÐÝ…ÌÝÉ¥ÑÑ•¸É½ÝÌ½¸±½…ì4(€€¼¼„Í…Ù”Ý¡½Í”É½ÝÑ Í½ÕÉ”¹¼±½¹•È•á¥ÍÑÌÍ¡É¥¹­Ì‰…¬°ÕÉÉ•¹ÑÌ‰½Õ¹‘•¸4(€Íå¹±…Í­É½ÝÑ ¡É•¥ÍÑÉ¥•Ì°ÉÕ¸¤ì4(€É•ÑÕÉ¸ÉÕ¸¹™±…Í­¡…É•Ìì4)ô4(4(¼¨¨4(€¨‘•Í•É¥…±¥é•IÕ¸¡©Í½¸¤ƒŠHÉÕ¸½‰©•Ð¸Q¡É½ÝÌ½¸Á…ÉÍ”™…¥±ÕÉ”°Õ¹­¹½Ý¸4(€¨Í¡•µ…Y•ÉÍ¥½¸°½È„ÉÕ¸Ñ¡…Ð‘½•Í¸Ðµ…Ñ IU9}M!A€¡Í…Ù”¹©ÌÑÕÉ¹Ì…¹ä4(€¨Ñ¡É½Ü¡•É”¥¹Ñ¼…¸…É¡¥Ù”µ…¹µÉ•™ÕÍ”°Í¼„‰…Í…Ù”¥Ì¹•Ù•ÈÍ¥±•¹Ñ±ä±½ÍÐ¤¸4(€¨¼4)•áÁ½ÉÐ™Õ¹Ñ¥½¸µ¥É…Ñ•IÕ¹M¡•µ„¡ÉÕ¸¤ì4(€¥˜€ …ÉÕ¸ñðÑåÁ•½˜ÉÕ¸€„ôô€½‰©•Ðœ¤Ñ¡É½Ü¹•ÜÉÉ½È ½ÉÉÕÁÐÉÕ¸Í…Ù”œ¤ì4(€½¹ÍÐ½É¥¥¹…±Y•ÉÍ¥½¸€ôÉÕ¸¹Í¡•µ…Y•ÉÍ¥½¸ì4(€½¹ÍÐ±•…ä€ôÉÕ¸¹Í¡•µ…Y•ÉÍ¥½¸€ôôô€Äì4(€½¹ÍÐÁÉ•1•‘•È€ô±•…äñðÉÕ¸¹Í¡•µ…Y•ÉÍ¥½¸€ôôô€Èì€¼¼ØÈè¹¼™±…Í­¡…É•Ì…Á…¥Ñä±•‘•Èå•Ð4(€½¹ÍÐÁÉ•!Á1•‘•È€ôlÄ°€È°€Ít¹¥¹±Õ‘•Ì¡ÉÕ¸¹Í¡•µ…Y•ÉÍ¥½¸¤ì4(€¥˜€ …lÄ°€È°€Ì°IU9}M!5}YIM%=9t¹¥¹±Õ‘•Ì¡ÉÕ¸¹Í¡•µ…Y•ÉÍ¥½¸¤¤ì4(€€€Ñ¡É½Ü¹•ÜÉÉ½È¡U¹­¹½Ý¸ÉÕ¸Í¡•µ…Y•ÉÍ¥½¸€‘íÉÕ¸¹Í¡•µ…Y•ÉÍ¥½¹ô€¡ÍÕÁÁ½ÉÑ•è€Ä°€È°€Ì°€‘íIU9}M!5}YIM%=9ô¥€¤ì4(€ô4(€½¹ÍÐÁÉ½‰±•µÌ€ôÙ…±¥‘…Ñ•IÕ¹M¡…Á”¡ÉÕ¸°ì±•…ä°ÁÉ•1•‘•È°ÁÉ•!Á1•‘•Èô¤ì4(€¥˜€¡ÁÉ½‰±•µÌ¹±•¹Ñ ¤Ñ¡É½Ü¹•ÜÉÉ½È¡5…±™½Éµ•ÉÕ¸Í…Ù”è€‘íÁÉ½‰±•µÌ¹©½¥¸ œì€œ¥õ€¤ì4(€¥˜€¡½É¥¥¹…±Y•ÉÍ¥½¸€„ôôIU9}M!5}YIM%=8¤ì4(€€€ÉÕ¸¹µ¥É…Ñ•‘É½µIÕ¹M¡•µ…Y•ÉÍ¥½¸€ô½É¥¥¹…±Y•ÉÍ¥½¸ì4(€€€ÉÕ¸¹Í¡•µ…Y•ÉÍ¥½¸€ôIU9}M!5}YIM%=8ì4(€ô4(€É•ÑÕÉ¸ÉÕ¸ì4)ô4(4)•áÁ½ÉÐ™Õ¹Ñ¥½¸‘•Í•É¥…±¥é•IÕ¸¡©Í½¸¤ì4(€É•ÑÕÉ¸µ¥É…Ñ•IÕ¹M¡•µ„¡)M=8¹Á…ÉÍ”¡©Í½¸¤¤ì4)ô4(4(¼¼€´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´4(¼¼½µ‰…Ð•¹Ñ¥Ñ¥•Ì€¡¥¹ÍÑ…¹•ÌÉ•™•É•¹”‘•™Ì‰ä¥ƒŠPMAƒ
œÌ¸Ì¤4(¼¼€´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´´4(4(¼¨¨4(€¨A±…å•È½µ‰…Ð•¹Ñ¥Ñä¸ÍÑ…ÑÕÍ•ÌèìmÍÑ…ÑÕÍ%‘tèìÍÑ…­Ì°‘ÕÉ…Ñ¥½¸ü°µ•Ñ•Èüôô¸4(€¨4(€¨Á½¥Í•5…á€€¡½ÁÑ¥½¹…°¤ÍÑ…µÁÌÑ¡”Á±…å•ÈÌA½¥Í”Ù•ÍÍ•°ƒŠPÑ¡”I0µ	UPµ5AQd4(€¨Í•…Ðèµ…à¥ÌÑ¡”•ÅÕ¥Áµ•¹Ð½É•±¥ŒÍÑ…•ÈÑ¡É•Í¡½±€¡É•…Ñ•½µ‰…Ð‘•É¥Ù•Ì¥Ð4(€¨™É½´Á±…å•ÉA½¥Í•Q¡É•Í¡½±‘I••¥ÁÐ¤°Ù…±Õ”¥Ì€À…¹!L9<]I%QHƒŠPÑ¡”•¹¥¹”4(€¨‘•…±ÌA½¥Í”‘…µ…”Ñ¼•¹•µ¥•Ì½¹±ä€¡…Ñ¥½¹Ì¹©Ì‘•…±A½¥Í•…µ…”…Ñ•Ì½¸4(€¨­¥¹¤¸Q¡”Ù•ÍÍ•°•á¥ÍÑÌÍ¼Ñ¡”!U…¸Ñ•±°Ñ¡”ÑÉÕÑ ¡”…Í­•Ñ¼Í•”4(€¨€ ‰Á½¥Í”€¡Ù•ÉäÍ­¥¹¹ä‰…È¤Õ¹‘•ÈÑ¡”¡•…±Ñ ‰…Èˆ°ÄÀ¸Ðì€‰Í¡½Õ±…±Í¼•™™•Ð4(€¨Á±…å•ÈÑ½¼ˆ°ÄÜÄÔ¤ìÑ¡”µ•¡…¹¥ÌÑ¡…ÐÝ¥±°½¹”‘…äµ½Ù”Ñ¡”Ù…±Õ”ƒŠP4(€¨ÍÑ…•È°É•Í¥ÍÑ…¹”°Á½¥Í”‘…µ…”……¥¹ÍÐÁ±…å•ÉÌƒŠP…É”½µ‰…Ð‘•Í¥¸‘•…±Ð4(€¨•±Í•Ý¡•É”…¹‘•±¥‰•É…Ñ•±ä9=P¥¹ÑÉ½‘Õ•‰äÑ¡¥ÌÍ•…Ð¸€ÀÍÑ…µÁÌ9<µ•Ñ•Èè4(€¨„é•É¼µÑ¡É•Í¡½±Á±…å•È¡…Ì¹¼Ù•ÍÍ•°°…¹Ñ¡”!UÌÉ•™ÕÍ…°Á…Ñ É•¹‘•ÉÌ4(€¨¥Ð	M9PÉ…Ñ¡•ÈÑ¡…¸…Ì…¸•µÁÑäÑÉ½Õ ¸4(€¨¼4)•áÁ½ÉÐ™Õ¹Ñ¥½¸É•…Ñ•A±…å•É½µ‰…Ñ¹Ñ¥Ñä¡ì±…ÍÍ%°µ…á!À°¡À°µ…á5…¹„°µ…¹„°µ…áMÑ…µ¥¹„€ô€À°ÍÑ…µ¥¹„°É•±¥%‘Ì€ômt°™±…Í­Ì€ômt°™±…Í­¡…É•Ì€ô¹Õ±°°•¹•Éå5…à°‘É…ÝA•ÉQÕÉ¸°Á½¥Í•5…à€ô€À°‘…µ…•	åM¡½½±‘€ôíôô¤ì4(€¥˜€ …9Õµ‰•È¹¥Í%¹Ñ••È¡•¹•Éå5…à¤ñð•¹•Éå5…à€ð€À¤Ñ¡É½Ü¹•ÜÉÉ½È A±…å•È½µ‰…Ð•¹Ñ¥ÑäÉ•ÅÕ¥É•ÌÍÑ…µÁ•¹½¸µ¹•…Ñ¥Ù”¥¹Ñ••È•¹•Éå5…àœ¤ì4(€¥˜€ …9Õµ‰•È¹¥Í%¹Ñ••È¡‘É…ÝA•ÉQÕÉ¸¤ñð‘É…ÝA•ÉQÕÉ¸€ð€À¤Ñ¡É½Ü¹•ÜÉÉ½È A±…å•È½µ‰…Ð•¹Ñ¥ÑäÉ•ÅÕ¥É•ÌÍÑ…µÁ•¹½¸µ¹•…Ñ¥Ù”¥¹Ñ••È‘É…ÝA•ÉQÕÉ¸œ¤ì4(€½¹ÍÐ•¹Ñ¥Ñä€ôì4(€€€¥è€Á±…å•Èœ°4(€€€­¥¹è€Á±…å•Èœ°4(€€€±…ÍÍ%°4(€€€¡Àè¡À€„ô¹Õ±°€ü¡À€èµ…á!À°4(€€€µ…á!À°4(€€€µ…¹„èµ…¹„€„ô¹Õ±°€üµ…¹„€èµ…á5…¹„°4(€€€µ…á5…¹„°4(€€€ÍÑ…µ¥¹„èÍÑ…µ¥¹„€„ô¹Õ±°€üÍÑ…µ¥¹„€èµ…áMÑ…µ¥¹„°4(€€€µ…áMÑ…µ¥¹„°4(€€€‰±½¬è€À°4(€€€•¹•Éäè€À°4(€€€•¹•Éå5…à°4(€€€‘É…ÝA•ÉQÕÉ¸°4(€€€ÍÑ…ÑÕÍ•Ìèíô°4(€€€ÍÑ…¹•%è¹Õ±°°4(€€€É•±¥%‘Ìèl¸¸¹É•±¥%‘Ít°4(€€€‘…µ…•	åM¡½½±‘è=‰©•Ð¹™É½µ¹ÑÉ¥•Ì¡5}M!==1L¹µ…À ¡Í¡½½°¤€ôømÍ¡½½°°‘…µ…•	åM¡½½±‘‘mÍ¡½½±tñð€Át¤¤°4(€€€™±…Í­Ìè™±…Í­Ì¹µ…À ¡˜¤€ôø€¡ì€¸¸¹˜ô¤¤°4(€€€™±…Í­¡…É•Ìè™±…Í­¡…É•Ì€üì€¸¸¹™±…Í­¡…É•Ìô€è¹Õ±°°4(€€€½Õ¹Ñ•ÉÌèì4(€€€€€…É‘ÍA±…å•‘Q¡¥ÍQÕÉ¸è€À°4(€€€€€…É‘ÍA±…å•‘Q¡¥Í½µ‰…Ðè€À°4(€€€€€…ÑÑ…­ÍA±…å•‘Q¡¥Í½µ‰…Ðè€À°4(€€€ô°4(€€€…±¥Ù”èÑÉÕ”°4(€ôì4(€ÍÑ…µÁA±…å•ÉA½¥Í•5…à¡•¹Ñ¥Ñä°Á½¥Í•5…à¤ì4(€É•ÑÕÉ¸•¹Ñ¥Ñäì4)ô4(4(¼¨¨4(€¨ÍÑ…µÁA±…å•ÉA½¥Í•5…à¡•¹Ñ¥Ñä°µ…à¤ƒŠPÑ¡”=9Ý…äÑ¡”Á±…å•ÈÌA½¥Í”Ù•ÍÍ•°¥Ì4(€¨€¡É”¥Í¥é•°…Ð•¹Ñ¥ÑäÉ•…Ñ¥½¸…¹…ÐÑ¡”Í¥¹±”µ¥µ™¥¡Ð‘½½È•ÅÕ¥Áµ•¹Ð4(€¨µ½Ù•ÌÑ¡É½Õ €¡‘½MÝ…ÁÉµ…µ•¹Ð¤¸5…à½¹±äèÑ¡”…ÕµÕ±…Ñ•Ù…±Õ”É¥‘•ÌƒŠP4(€¨Ñ½‘…ä¥Ð¥Ì…±Ý…åÌ€À‰•…ÕÍ”¹½Ñ¡¥¹œÝÉ¥Ñ•Ì¥Ð°…¹Ñ¡¥Ì¡•±Á•ÈµÕÍÐ­••À4(€¨‰•¥¹œÙ…±Õ”µÁÉ•Í•ÉÙ¥¹œÍ¼Ñ¡”™ÕÑÕÉ”ÝÉ¥Ñ•ÈÌ‰Õ¥±µÕÀÍÕÉÙ¥Ù•Ì„ÍÝ…À¸4(€¨¹½¸µÁ½Í¥Ñ¥Ù”µ…àI5=YLÑ¡”µ•Ñ•Èè¹¼Ù•ÍÍ•°°Ñ¡”!UÉ•™ÕÍ…°É•¹‘•ÉÌ4(€¨	M9P€¡¹•Ù•È…¸•µÁÑäÑÉ½Õ ¤¸4(€¨¼4)•áÁ½ÉÐ™Õ¹Ñ¥½¸ÍÑ…µÁA±…å•ÉA½¥Í•5…à¡•¹Ñ¥Ñä°µ…à¤ì4(€¥˜€¡9Õµ‰•È¹¥Í%¹Ñ••È¡µ…à¤€˜˜µ…à€ø€À¤ì4(€€€½¹ÍÐÙ…±Õ”€ô•¹Ñ¥Ñä¹Á½¥Í•5•Ñ•È€ü5…Ñ ¹µ…à À°5…Ñ ¹µ¥¸¡•¹Ñ¥Ñä¹Á½¥Í•5•Ñ•È¹Ù…±Õ”°µ…à¤¤€è€Àì4(€€€•¹Ñ¥Ñä¹Á½¥Í•5•Ñ•È€ôìÙ…±Õ”°µ…àôì4(€ô•±Í”ì4(€€€‘•±•Ñ”•¹Ñ¥Ñä¹Á½¥Í•5•Ñ•Èì4(€ô4)ô4(4(¼¨¨4(€¨¹•µä½µ‰…Ð•¹Ñ¥Ñä¸Á½¥Í•5•Ñ•É€¥ÌÑ¡”•¹¥¹”µ±•Ù•°‰Õ¥±µÕÀµ•Ñ•È™•‰ä4(€¨Ñ¡”Á½¥Í•…µ…”½Á½‘”€¡MAƒ
œÌ¸Ü°ƒ
œÐ¸Ð¤ì•Ù•ÉåÑ¡¥¹œ•±Í”…‰½ÕÐMÑ…•È¥Ì4(€¨½¹Ñ•¹Ð‘…Ñ„¸4(€¨¼4)•áÁ½ÉÐ™Õ¹Ñ¥½¸É•…Ñ•¹•µå½µ‰…Ñ¹Ñ¥Ñä¡ì¥¹ÍÑ…¹•%°•¹•µå%°¡À°Á½¥Í•5…à°…É…¹•áÁ½ÍÕÉ”°‘…µ…•I•Í¥ÍÑ…¹•	åM¡½½°ô¤ì4(€½¹ÍÐ•¹Ñ¥Ñä€ôì4(€€€¥è¥¹ÍÑ…¹•%°4(€€€­¥¹è€•¹•µäœ°4(€€€•¹•µå%°4(€€€¡À°4(€€€µ…á!Àè¡À°4(€€€‰±½¬è€À°4(€€€ÍÑ…ÑÕÍ•Ìèíô°4(€€€Á½¥Í•5•Ñ•ÈèìÙ…±Õ”è€À°µ…àèÁ½¥Í•5…àô°4(€€€µ½Ù•Í!¥ÍÑ½Éäèmt°4(€€€¥¹Ñ•¹Ðè¹Õ±°°4(€€€Á•¹‘¥¹5½Ù”è¹Õ±°°€¼¼‘•±…å•µµ½Ù”½µµ¥Ñµ•¹Ðèìµ½Ù•%°É•Í½±Ù•=¹QÕÉ¸ô4(€€€Í­¥Á9•áÑQÕÉ¸è™…±Í”°€¼¼Í•Ð‰ä„Á½¥Í”µµ•Ñ•È™¥±°ì½¹ÍÕµ•‰äÑ¡”•¹•µäÑÕÉ¸4(€€€Õ¹±½­•‘5½Ù•Ìèmt°4(€€€…±¥Ù”èÑÉÕ”°4(€ôì4(€¥˜€¡…É…¹•áÁ½ÍÕÉ”¤•¹Ñ¥Ñä¹…É…¹•áÁ½ÍÕÉ”€ô…É…¹•áÁ½ÍÕÉ”¹µ½‘”€ôôô€½¹™¥ÕÉ•œ4(€€€€üì€¸¸¹ÍÑÉÕÑÕÉ•‘±½¹”¡…É…¹•áÁ½ÍÕÉ”¤°Ù…±Õ”è€Àô4(€€€€èìµ½‘”è€¥µµÕ¹”œôì4(€¥˜€¡‘…µ…•I•Í¥ÍÑ…¹•	åM¡½½°¤•¹Ñ¥Ñä¹‘…µ…•I•Í¥ÍÑ…¹•	åM¡½½°€ôì€¸¸¹‘…µ…•I•Í¥ÍÑ…¹•	åM¡½½°ôì4(€É•ÑÕÉ¸•¹Ñ¥Ñäì4)ô4(