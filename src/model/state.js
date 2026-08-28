// src/model/state.js — run/combat state factories + (de)serialization (SPEC §3.3, §3.12)
//
// State stores INSTANCE data referencing definitions by id only:
//   deck card  = { instanceId, cardId, upgraded }
//   enemy      = { instanceId→id, enemyId, hp, block, statuses{}, poiseMeter, movesHistory[] }
//   player     = { …pools…, poiseMeter? — max from the equipment threshold
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
import { resolveStartingKit, startingKitSnapshot, resolveStartingArmour } from './startingKits.js';
import { DAMAGE_SCHOOLS } from './schemas.js';
import { resolveRelicModifiers } from './relicModifiers.js';
// The run door's witness. Recording only; nothing here changes a number.
// One home for the mechanic: src/model/healLedger.js.
import { openLedger, closeLedger, note } from './healLedger.js';

// v3 (2026-08-14): flaskCharges carries its capacity ledger — base, grown,
// granted — and capacity must derive from the three (validateRunShape). v2
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
// Run state (SPEC §3.12 save shape)
// ---------------------------------------------------------------------------

/**
 * createRunState({ seed, classId, registries }) → new run at floor 0, act 1.
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
  startingArmourId = undefined,
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
  // E5 (#250): the set the run begins wearing. Resolved against the same
  // profile meta the kit above is — absent, the class's free set, which is
  // what createLoadout always chose. The loadout row is the persisted home;
  // no new run field, because run.loadout.sets.armor[0] already IS the record.
  const startingArmour = resolveStartingArmour(registries, classId, startingArmourId, profileMeta);
  const loadout = createLoadout(registries, classId, startingKit, startingArmour);
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
  // hp is filled — the run starts at full, in whatever it starts wearing.
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
    // LEVELS BOUGHT AT SHRINES, per run — Constantine: "players should have the
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
    flasks: [], // [{ flaskId }] — max slots from balance.flaskSlots
    flaskCharges: createFlaskCharges(registries.balance, classDef.startingFlaskAllocation),
    seedString: null, // set by the orchestrator right after creation (display/replay)
    mapGraph: null,
    combatEntered: null,
    history: [],
    modifiers: [], // ascension-style seam (SPEC §10); always empty in v1
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
    why: 'classDef.maxHp + runMods equipment bonus, set before the derived rules are resolved — the first of three writers',
  });
  // "and each character should start with those" — Constantine, 2026-08-08, the
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
    // this act — the ruling is visibility first, because you cannot safely
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
      why: 'max-HP home 1 of 3 — derived + equipment + adjustment, checked against the persisted value',
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
  // inherits the rule it folds into, and this is where "the rule" is known: the
  // authored table plus whatever override layer this run is being born with
  // (Constantine's Settings → Advanced tier dial). Resolved twice — once here
  // for the granularity, once inside the snapshot for the numbers — because a
  // receipt computed at one granularity and folded at another is the silent
  // wrong answer Law 0 clause 5 is about.
  const hostRules = resolveDerivedStatRules(
    registries.derivedStatRules,
    derivedOptions(registries, derivedStatOptions),
  );
  const tierSizes = Object.fromEntries(
    Object.entries(hostRules.rules).map(([id, r]) => [id, r.pointsPerTier]),
  );
  const relicModifierReceipt = resolveRelicModifiers(registries, run.relics, {
    attributes: run.attributes,
    tierSizes,
  });
  const receipt = existingIsCurrent
    ? restoredExisting
    : createDerivedStatRuleSnapshot(registries.derivedStatRules, {
      ...derivedOptions(registries, derivedStatOptions),
      classDef,
      relicModifierReceipt,
    });
  const rules = receipt.rules;
  const hp = deriveStat(rules, 'hp', { attributes: run.attributes, classDef });
  const mana = deriveStat(rules, 'mana', { attributes: run.attributes, classDef });
  const stamina = deriveStat(rules, 'stamina', { attributes: run.attributes, classDef });
  const energy = deriveStat(rules, 'energy', { attributes: run.attributes, classDef });
  const draw = deriveStat(rules, 'draw', { attributes: run.attributes, classDef });

  const oldHpMax = run.maxHp;
  const oldHp = run.hp;
  const oldManaMax = run.maxMana;
  const oldMana = run.mana;
  run.derivedStatRuleSnapshot = structuredClone(receipt);
  // MAX-HP HOME 2 of 3 (the deriving one), and the SECOND writer at run
  // creation — it replaces the classDef+equipment value createRunState set two
  // dozen lines up, with nothing but call order deciding which wins.
  const derivedMaxHp = Math.max(1, hp.value + hpEquipmentBonus + run.maxHpAdjustment);
  note(run, {
    kind: 'overwrite',
    site: 'state.js:initializeRunDerivedStats(derive)',
    field: 'maxHp',
    was: oldHpMax,
    now: derivedMaxHp,
    why: 'max-HP home 2 of 3 — the host derived-stat rules replace whatever was in the field, at birth and at the load door alike',
  });
  run.maxHp = derivedMaxHp;
  run.maxMana = mana.value;
  run.maxStamina = stamina.value;
  run.energyMax = energy.value;
  run.drawPerTurn = draw.value;
  run.damageBySchoolAdd = structuredClone(
    receipt.relicModifiers && receipt.relicModifiers.damageBySchoolAdd
      || Object.fromEntries(DAMAGE_SCHOOLS.map((school) => [school, 0])),
  );
  if (preserveDeficits && Number.isFinite(oldHpMax) && Number.isFinite(oldHp)) {
    run.hp = Math.max(0, run.maxHp - Math.max(0, oldHpMax - oldHp));
    note(run, {
      kind: 'overwrite',
      site: 'state.js:initializeRunDerivedStats(pools)',
      field: 'hp',
      was: oldHp,
      now: run.hp,
      why: `the vessel moved ${oldHpMax} -> ${run.maxHp}; the ABSOLUTE deficit (${Math.max(0, oldHpMax - oldHp)}) is the player's and was carried`,
    });
  } else {
    note(run, {
      kind: preserveDeficits ? 'write' : 'overwrite',
      site: 'state.js:initializeRunDerivedStats(pools)',
      field: 'hp',
      was: oldHp,
      now: run.maxHp,
      why: preserveDeficits
        ? 'no prior pool to carry a deficit from — filled to the new maximum'
        : 'preserveDeficits=false (a run being BORN, not restored): filled to the maximum. On a restore this would be healing a wound away, which is the friendliest way to lose a climb',
    });
    run.hp = run.maxHp;
  }
  if (preserveDeficits && Number.isFinite(oldManaMax) && oldManaMax > 0 && Number.isFinite(oldMana)) {
    const legacyRatio = Math.max(0, Math.min(1, oldMana / oldManaMax));
    run.mana = Math.max(0, Math.min(run.maxMana, Math.round(legacyRatio * run.maxMana)));
  } else run.mana = run.maxMana;
  run.stamina = run.maxStamina;
  return run;
}

/**
 * The persisted run shape, declared once (SPEC §3.12). Keeps the save contract
 * data-driven instead of implied by whatever createRunState happens to set, and
 * gives deserializeRun something to check so a parseable-but-malformed save is
 * refused at load (→ save.js archives it) rather than crashing mid-run.
 *
 * `nullable` fields are legitimately null before their first use. Unlisted keys
 * are allowed through untouched — this is a floor, not a whitelist.
 */
export const RUN_SHAPE = [
  { key: 'contentVersion', type: 'string' },
  { key: 'seed', type: 'number' },
  { key: 'streamCounters', type: 'object' },
  { key: 'class', type: 'string' },
  { key: 'startingKitId', type: 'string' },
  { key: 'startingKitSnapshot', type: 'object' },
  // Optional as a pair only so pre-attribute saves can migrate as one block.
  { key: 'attributeMode', type: 'string', optional: true },
  { key: 'attributes', type: 'object', optional: true },
  // Optional so a run saved before shrine levelling existed still loads: absent
  // reads as zero levels bought, which is what such a run is. `levelPoints` is
  // additionally absent from e05be89's saves, where it is exactly `levelUps` —
  // that build had one possible level value (attributes.js).
  { key: 'levelUps', type: 'number', optional: true },
  { key: 'levelPoints', type: 'number', optional: true },
  // Optional only for the one pre-derived migration at the load door.
  { key: 'derivedStatRuleSnapshot', type: 'object', optional: true },
  { key: 'equipmentProfileRuleSnapshot', type: 'object', optional: true },
  { key: 'floor', type: 'number' },
  { key: 'actNumber', type: 'number' },
  { key: 'hp', type: 'number' },
  { key: 'maxHp', type: 'number' },
  { key: 'maxHpAdjustment', type: 'number' },
  // Optional only for save compatibility. save.js migrates a pre-mana run to
  // its class-authored full pool before handing it to the game.
  { key: 'mana', type: 'number', optional: true },
  { key: 'maxMana', type: 'number', optional: true },
  { key: 'stamina', type: 'number', optional: true },
  { key: 'maxStamina', type: 'number', optional: true },
  { key: 'energyMax', type: 'number', optional: true },
  { key: 'drawPerTurn', type: 'number', optional: true },
  { key: 'cinders', type: 'number' },
  { key: 'deck', type: 'array' },
  { key: 'relics', type: 'array' },
  { key: 'damageBySchoolAdd', type: 'object' },
  { key: 'flasks', type: 'array' },
  { key: 'history', type: 'array' },
  { key: 'modifiers', type: 'array' },
  // Optional so a run saved before equipment existed still loads; save.js
  // heals it with a fresh loadout rather than refusing the save.
  { key: 'loadout', type: 'object', optional: true },
  { key: 'seedString', type: 'string', nullable: true },
  { key: 'mapNodeId', type: 'string', nullable: true },
  { key: 'mapGraph', type: 'object', nullable: true },
  // Optional, backward-compatible presentation state. It is owned by the run
  // rather than Settings because the ladder and pan are live choices for this
  // climb; Settings only supplies the default when this field is absent.
  { key: 'mapView', type: 'object', optional: true, nullable: true },
  { key: 'combatEntered', type: 'object', nullable: true },
];

function typeOk(value, type) {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  return typeof value === type; // 'string' | 'number'
}

/** validateRunShape(run) → [] when sound, else a list of human-readable problems.
 *  `legacy` admits v1 saves (pre-starting-kit); `preLedger` admits v1/v2 saves
 *  (pre-capacity-ledger). deserializeRun derives both from schemaVersion. */
export function validateRunShape(run, { legacy = false, preLedger = legacy, preHpLedger = preLedger } = {}) {
  const problems = [];
  for (const f of RUN_SHAPE) {
    if (legacy && (f.key === 'startingKitId' || f.key === 'startingKitSnapshot')) continue;
    if (preHpLedger && (f.key === 'maxHpAdjustment' || f.key === 'damageBySchoolAdd')) continue;
    const v = run[f.key];
    if (v === undefined) {
      if (!f.optional) problems.push(`missing '${f.key}'`);
      continue;
    }
    if (v === null) {
      if (!f.nullable) problems.push(`'${f.key}' is null`);
      continue;
    }
    if (!typeOk(v, f.type)) problems.push(`'${f.key}' should be ${f.type}`);
  }
  const modeAbsent = run.attributeMode === undefined;
  const attributesAbsent = run.attributes === undefined;
  if (modeAbsent !== attributesAbsent) problems.push('attributeMode and attributes must both be present or both be absent');
  if (!attributesAbsent && typeOk(run.attributes, 'object')) {
    for (const [id, value] of Object.entries(run.attributes)) {
      if (!Number.isInteger(value)) problems.push(`attributes.${id} must be an integer`);
    }
  }
  if (run.mapView !== undefined && run.mapView !== null && typeOk(run.mapView, 'object')) {
    const v = run.mapView;
    if (!Number.isInteger(v.actNumber) || v.actNumber < 1) problems.push('mapView.actNumber must be a positive integer');
    if (v.nodeId !== null && (typeof v.nodeId !== 'string' || !v.nodeId)) problems.push('mapView.nodeId must be null or a non-empty string');
    if (typeof v.setting !== 'string' || !v.setting) problems.push('mapView.setting must be a non-empty string');
    if (!Number.isFinite(v.zoom) || v.zoom <= 0) problems.push('mapView.zoom must be a positive finite number');
    if (!['fit', 'saved', 'manual'].includes(v.framing)) problems.push("mapView.framing must be 'fit', 'saved', or 'manual'");
    for (const key of ['scrollLeft', 'scrollTop']) {
      if (!Number.isFinite(v[key]) || v[key] < 0) problems.push(`mapView.${key} must be a non-negative finite number`);
    }
    if (!Number.isFinite(v.aimX)) problems.push('mapView.aimX must be a finite number');
    for (const key of ['viewportWidth', 'viewportHeight']) {
      if (v[key] !== undefined && (!Number.isFinite(v[key]) || v[key] < 0)) {
        problems.push(`mapView.${key} must be a non-negative finite number when present`);
      }
    }
  }
  // A level count is a whole number of purchases and can never be negative. The
  // ALLOCATION check that reads it lives at the load door
  // (attributes.js:grantedAttributePoints); this is the shape check, and a
  // fractional or negative value would silently shift the expected total there.
  for (const key of ['levelUps', 'levelPoints']) {
    if (run[key] !== undefined && (!Number.isInteger(run[key]) || run[key] < 0)) {
      problems.push(`${key} must be a non-negative integer`);
    }
  }
  // Deck entries are the ids the run is rebuilt from — the one nested shape
  // worth checking, since a bad entry breaks combat rather than the load.
  if (Array.isArray(run.deck)) {
    const bad = run.deck.findIndex((c) => !c || typeof c.cardId !== 'string' || typeof c.instanceId !== 'string');
    if (bad !== -1) problems.push(`deck[${bad}] is not { instanceId, cardId }`);
    for (let i = 0; i < run.deck.length; i++) {
      const card = run.deck[i];
      if (!card) continue;
      const schoolAbsent = card.damageSchool === undefined;
      const buildupAbsent = card.exposureBuildupPerHit === undefined;
      if (schoolAbsent !== buildupAbsent) problems.push(`deck[${i}] damageSchool and exposureBuildupPerHit must both be present or both be absent`);
      if (!schoolAbsent && !DAMAGE_SCHOOLS.includes(card.damageSchool)) problems.push(`deck[${i}].damageSchool '${card.damageSchool}' is unknown`);
      if (!buildupAbsent && (!Number.isInteger(card.exposureBuildupPerHit) || card.exposureBuildupPerHit < 0)) problems.push(`deck[${i}].exposureBuildupPerHit must be a non-negative integer`);
    }
  }
  if (Number.isFinite(run.hp) && Number.isFinite(run.maxHp) && run.maxHp <= 0) {
    problems.push('maxHp must be > 0');
  }
  if (Number.isFinite(run.hp) && Number.isFinite(run.maxHp) && (run.hp < 0 || run.hp > run.maxHp)) {
    problems.push('hp must be between 0 and maxHp');
  }
  if (run.maxHpAdjustment !== undefined && !Number.isInteger(run.maxHpAdjustment)) {
    problems.push('maxHpAdjustment must be an integer');
  }
  if (run.damageBySchoolAdd !== undefined) {
    for (const school of DAMAGE_SCHOOLS) {
      if (!Number.isInteger(run.damageBySchoolAdd[school]) || run.damageBySchoolAdd[school] < 0) {
        problems.push(`damageBySchoolAdd.${school} must be a non-negative integer`);
      }
    }
    for (const school of Object.keys(run.damageBySchoolAdd)) {
      if (!DAMAGE_SCHOOLS.includes(school)) problems.push(`damageBySchoolAdd.${school} is not a legal damage school`);
    }
  }
  if (run.maxMana !== undefined && (!Number.isFinite(run.maxMana) || run.maxMana <= 0)) {
    problems.push('maxMana must be > 0');
  }
  if (Number.isFinite(run.mana) && Number.isFinite(run.maxMana) && (run.mana < 0 || run.mana > run.maxMana)) {
    problems.push('mana must be between 0 and maxMana');
  }
  const staminaAbsent = run.stamina === undefined;
  const maxStaminaAbsent = run.maxStamina === undefined;
  if (staminaAbsent !== maxStaminaAbsent) problems.push('stamina and maxStamina must both be present or both be absent');
  if (run.maxStamina !== undefined && (!Number.isFinite(run.maxStamina) || run.maxStamina < 0)) problems.push('maxStamina must be >= 0');
  if (Number.isFinite(run.stamina) && Number.isFinite(run.maxStamina) && (run.stamina < 0 || run.stamina > run.maxStamina)) {
    problems.push('stamina must be between 0 and maxStamina');
  }
  if (run.flaskCharges !== undefined) {
    const f = run.flaskCharges;
    if (!f || !Number.isInteger(f.capacity) || f.capacity <= 0
      || !Number.isInteger(f.hp) || f.hp < 0 || !Number.isInteger(f.mana) || f.mana < 0
      || f.hp + f.mana !== f.capacity
      || !Number.isInteger(f.hpCurrent) || f.hpCurrent < 0 || f.hpCurrent > f.hp
      || !Number.isInteger(f.manaCurrent) || f.manaCurrent < 0 || f.manaCurrent > f.mana) {
      problems.push('flaskCharges must satisfy hp + mana = capacity with bounded current counts');
    }
    // `grown` — what the growth chain currently contributes (model/flaskgrowth.js).
    // Optional on pre-ledger saves only; syncFlaskGrowth treats absent as zero.
    const grownSound = f && f.grown && typeof f.grown === 'object'
      && Number.isInteger(f.grown.hp) && f.grown.hp >= 0
      && Number.isInteger(f.grown.mana) && f.grown.mana >= 0;
    if (f && f.grown !== undefined && !grownSound) {
      problems.push('flaskCharges.grown must be { hp, mana } non-negative integers when present');
    }
    // THE CAPACITY LEDGER — capacity is one stored number fed by two doors
    // (model/flaskgrowth.js, THE DOORS), and this is the check that it stays
    // accountable: base (born, createFlaskCharges) + grown (possession door)
    // + granted (moment door) must equal what is stored. A capacity no ledger
    // can explain is refused BY NAME — that red is the machine form of the
    // two-doors warning that used to live only in prose (SPEC §5.5.2): a
    // "cleanup" that re-derives capacity from the chain alone now fails the
    // first save it touches instead of silently deleting every keepsake charge.
    // Pre-ledger saves (v1/v2) carry no base/granted; they are admitted only
    // through the migration door (preLedger), where initializeRunFlaskCharges
    // attributes them once, by the stated rule, before the run is ever re-saved.
    if (f && f.base === undefined && f.granted === undefined) {
      if (!preLedger) problems.push('flaskCharges is missing its capacity ledger (base, granted) — required at this schema version');
    } else if (f) {
      const baseSound = Number.isInteger(f.base) && f.base > 0;
      const grantedSound = Number.isInteger(f.granted) && f.granted >= 0;
      if (!baseSound) problems.push('flaskCharges.base must be a positive integer');
      if (!grantedSound) problems.push('flaskCharges.granted must be a non-negative integer');
      if (!grownSound) {
        problems.push('flaskCharges.grown must be present beside the capacity ledger');
      } else if (baseSound && grantedSound && Number.isInteger(f.capacity)
        && f.capacity !== f.base + f.grown.hp + f.grown.mana + f.granted) {
        problems.push(`flaskCharges.capacity ${f.capacity} is not accounted for by its parts — `
          + `base ${f.base} + grown ${f.grown.hp + f.grown.mana} + granted ${f.granted} `
          + `= ${f.base + f.grown.hp + f.grown.mana + f.granted}`);
      }
    }
  }
  if (run.energyMax !== undefined && (!Number.isInteger(run.energyMax) || run.energyMax < 0)) problems.push('energyMax must be a non-negative integer');
  if (run.drawPerTurn !== undefined && (!Number.isInteger(run.drawPerTurn) || run.drawPerTurn < 0)) problems.push('drawPerTurn must be a non-negative integer');
  return problems;
}

export function serializeRun(run) {
  return JSON.stringify(run);
}

export function initializeRunFlaskCharges(run, registries) {
  if (!run.flaskCharges) {
    const wasFlasks = structuredClone(run.flasks || []);
    const allocation = registries.classes.get(run.class).startingFlaskAllocation;
    run.flaskCharges = createFlaskCharges(registries.balance, allocation);
    const legacy = run.flasks || [];
    run.flaskCharges.hpCurrent = Math.min(run.flaskCharges.hp, legacy.filter((f) => f && chargeKindForFlask(registries, f.flaskId) === 'hp').length);
    run.flaskCharges.manaCurrent = Math.min(run.flaskCharges.mana, legacy.filter((f) => f && chargeKindForFlask(registries, f.flaskId) === 'mana').length);
    run.flasks = (run.flasks || []).filter((f) => f && chargeKindForFlask(registries, f.flaskId) == null);
    // ONE OF THE THREE UNGATED HEALS. `flaskCharges` is optional in RUN_SHAPE
    // with no schemaVersion gate, so this fires on a CURRENT-schema save that
    // has lost the field, not only on the pre-ledger save it was written for —
    // and every spent charge comes back. It is allowed to; it may not be quiet
    // about it.
    note(run, {
      kind: 'heal',
      site: 'state.js:initializeRunFlaskCharges',
      field: 'flaskCharges',
      was: undefined,
      now: { hp: run.flaskCharges.hp, mana: run.flaskCharges.mana, hpCurrent: run.flaskCharges.hpCurrent, manaCurrent: run.flaskCharges.manaCurrent },
      why: `absent in the save: rebuilt from the class allocation, currents reconstructed from ${wasFlasks.length} legacy run.flasks entr(ies)`,
    });
  }
  // ═══ THE ONE-TIME ATTRIBUTION — pre-ledger saves (v1/v2), stated, not
  // silent. A v2 save stores capacity with no ledger: chain growth always
  // wrote `grown`, but the moment door (op addFlaskCapacity — keepsakes,
  // event effects) recorded nothing. The rule, in full:
  //   base    = the current authored balance.flaskCapacity, clamped to
  //             capacity − grownTotal — the best witness available for what
  //             the vessel was born holding, never allowed to invent charges.
  //   granted = capacity − grownTotal − base — every charge that base and the
  //             chain's own ledger cannot account for is attributed to the
  //             moment door, because the moment door was the untracked one.
  // Honest defaults of the clamp: a balance retuned UP since the save yields
  // base = capacity − grownTotal and granted 0 (the save keeps its capacity,
  // nothing is invented); a keepsake surplus lands in granted, which is where
  // it came from. Runs once per save, before the run can be re-serialized;
  // from then on validateRunShape enforces capacity === base + grown + granted.
  {
    const f = run.flaskCharges;
    if (f.base === undefined && f.granted === undefined) {
      const grownTotal = f.grown && Number.isInteger(f.grown.hp) && Number.isInteger(f.grown.mana)
        ? f.grown.hp + f.grown.mana
        : 0;
      if (grownTotal >= f.capacity) {
        // The chain's own ledger cannot fit under the stored capacity — that is
        // corruption of exactly the class this ledger polices, not a migration.
        throw new Error(`flaskCharges.grown total ${grownTotal} meets or exceeds capacity ${f.capacity} — pre-ledger save is unaccountable`);
      }
      f.base = Math.min(flaskCapacity(registries.balance), f.capacity - grownTotal);
      f.granted = f.capacity - grownTotal - f.base;
      note(run, {
        kind: 'heal',
        site: 'state.js:initializeRunFlaskCharges(attribution)',
        field: 'flaskCharges.base/granted',
        was: undefined,
        now: { base: f.base, granted: f.granted, grownTotal, capacity: f.capacity },
        why: 'pre-ledger save: capacity was attributed once — base from the current authored balance, the unaccounted remainder to the moment door',
      });
    }
  }
  // Loaded runs re-derive the chain here — the load door. A save carrying a
  // relic whose growth row was authored after it was written grows on load;
  // a save whose growth source no longer exists shrinks back, currents bounded.
  syncFlaskGrowth(registries, run);
  return run.flaskCharges;
}

/**
 * deserializeRun(json) → run object. Throws on parse failure, unknown
 * schemaVersion, or a run that doesn't match RUN_SHAPE (save.js turns any
 * throw here into an archive-and-refuse, so a bad save is never silently lost).
 */
export function migrateRunSchema(run) {
  if (!run || typeof run !== 'object') throw new Error('Corrupt run save');
  const originalVersion = run.schemaVersion;
  const legacy = run.schemaVersion === 1;
  const preLedger = legacy || run.schemaVersion === 2; // v2: no flaskCharges capacity ledger yet
  const preHpLedger = [1, 2, 3].includes(run.schemaVersion);
  if (![1, 2, 3, RUN_SCHEMA_VERSION].includes(run.schemaVersion)) {
    throw new Error(`Unknown run schemaVersion ${run.schemaVersion} (supported: 1, 2, 3, ${RUN_SCHEMA_VERSION})`);
  }
  const problems = validateRunShape(run, { legacy, preLedger, preHpLedger });
  if (problems.length) throw new Error(`Malformed run save: ${problems.join('; ')}`);
  if (originalVersion !== RUN_SCHEMA_VERSION) {
    run.migratedFromRunSchemaVersion = originalVersion;
    run.schemaVersion = RUN_SCHEMA_VERSION;
  }
  return run;
}

export function deserializeRun(json) {
  return migrateRunSchema(JSON.parse(json));
}

// ---------------------------------------------------------------------------
// Combat entities (instances reference defs by id — SPEC §3.3)
// ---------------------------------------------------------------------------

/**
 * Player combat entity. statuses: { [statusId]: { stacks, duration?, meter? } }.
 *
 * `poiseMax` (optional) stamps the player's Poise vessel — the REAL-BUT-EMPTY
 * seat: max is the equipment/relic stagger threshold (createCombat derives it
 * from playerPoiseThresholdReceipt), value is 0 and HAS NO WRITER — the engine
 * deals Poise damage to enemies only (actions.js dealPoiseDamage gates on
 * kind). The vessel exists so the HUD can tell the truth he asked to see
 * ("poise (very skinny bar) under the health bar", D10.4; "should also effect
 * player too", D17 q5); the mechanics that will one day move the value —
 * stagger, resistance, poise damage against players — are combat design dealt
 * elsewhere and deliberately NOT introduced by this seat. 0 stamps NO meter:
 * a zero-threshold player has no vessel, and the HUD's refusal path renders
 * it ABSENT rather than as an empty trough.
 */
export function createPlayerCombatEntity({ classId, maxHp, hp, maxMana, mana, maxStamina = 0, stamina, relicIds = [], flasks = [], flaskCharges = null, energyMax, drawPerTurn, poiseMax = 0, damageBySchoolAdd = {} }) {
  if (!Number.isInteger(energyMax) || energyMax < 0) throw new Error('Player combat entity requires stamped non-negative integer energyMax');
  if (!Number.isInteger(drawPerTurn) || drawPerTurn < 0) throw new Error('Player combat entity requires stamped non-negative integer drawPerTurn');
  const entity = {
    id: 'player',
    kind: 'player',
    classId,
    hp: hp != null ? hp : maxHp,
    maxHp,
    mana: mana != null ? mana : maxMana,
    maxMana,
    stamina: stamina != null ? stamina : maxStamina,
    maxStamina,
    block: 0,
    energy: 0,
    energyMax,
    drawPerTurn,
    statuses: {},
    stanceId: null,
    relicIds: [...relicIds],
    damageBySchoolAdd: Object.fromEntries(DAMAGE_SCHOOLS.map((school) => [school, damageBySchoolAdd[school] || 0])),
    flasks: flasks.map((f) => ({ ...f })),
    flaskCharges: flaskCharges ? { ...flaskCharges } : null,
    counters: {
      cardsPlayedThisTurn: 0,
      cardsPlayedThisCombat: 0,
      attacksPlayedThisCombat: 0,
    },
    alive: true,
  };
  stampPlayerPoiseMax(entity, poiseMax);
  return entity;
}

/**
 * stampPlayerPoiseMax(entity, max) — the ONE way the player's Poise vessel is
 * (re)sized, at entity creation and at the single mid-fight door equipment
 * moves through (doSwapArmament). Max only: the accumulated value rides —
 * today it is always 0 because nothing writes it, and this helper must keep
 * being value-preserving so the future writer's build-up survives a swap.
 * A non-positive max REMOVES the meter: no vessel, the HUD refusal renders
 * ABSENT (never an empty trough).
 */
export function stampPlayerPoiseMax(entity, max) {
  if (Number.isInteger(max) && max > 0) {
    const value = entity.poiseMeter ? Math.max(0, Math.min(entity.poiseMeter.value, max)) : 0;
    entity.poiseMeter = { value, max };
  } else {
    delete entity.poiseMeter;
  }
}

/**
 * Enemy combat entity. `poiseMeter` is the engine-level build-up meter fed by
 * the poiseDamage opcode (SPEC §3.7, §4.4); everything else about Stagger is
 * content data.
 */
export function createEnemyCombatEntity({ instanceId, enemyId, hp, poiseMax, arcaneExposure, damageResistanceBySchool }) {
  const entity = {
    id: instanceId,
    kind: 'enemy',
    enemyId,
    hp,
    maxHp: hp,
    block: 0,
    statuses: {},
    poiseMeter: { value: 0, max: poiseMax },
    movesHistory: [],
    intent: null,
    pendingMove: null, // delayed-move commitment: { moveId, resolveOnTurn }
    skipNextTurn: false, // set by a poise-meter fill; consumed by the enemy turn
    unlockedMoves: [],
    alive: true,
  };
  if (arcaneExposure) entity.arcaneExposure = arcaneExposure.mode === 'configured'
    ? { ...structuredClone(arcaneExposure), value: 0 }
    : { mode: 'immune' };
  if (damageResistanceBySchool) entity.damageResistanceBySchool = { ...damageResistanceBySchool };
  return entity;
}
