// src/model/validate.js — content validation (SPEC §3.14)
//
// Runs at boot in dev mode and from the test page. Checks, across ALL content:
//   1. Schema conformance (fields, types, enums; unknown fields fail loudly).
//   2. Every id cross-reference resolves (no dangling ids).
//   3. Every opcode, formula op, trigger event, and predicate is in the
//      closed sets of SPEC §3.4–§3.6.
//   4. Every text-template token binds, and every player-visible literal
//      numeric effect has a token (SPEC §3.13) — enforced for cards + relics.
//   5. scripts.js budget report: script-using content stays < 5% of content.
//
// Headless: no document/window/localStorage/timers.

import { resolveFloorPlan } from './floorplan.js';
import { assertTableSane } from './secondbeat.js';
import { viewRefusals, geometryRefusals } from './mapview.js';
import { graceRefillRefusals } from './gracerefill.js';
import { flaskGrowthRefusals } from './flaskgrowth.js';
import {
  SCHEMAS,
  OPCODES,
  EFFECT_SPECS,
  TARGETS,
  TRIGGER_EVENTS,
  PREDICATES,
  CARD_TYPES,
  PILES,
  PILE_POSITIONS,
  REGISTRY_TYPES,
  SFX_LAYER_KINDS,
  SFX_LAYER_SCHEMAS,
  MUSIC_SILENCE_WORD,
  MUSIC_BED_SCHEMA,
  DAMAGE_SCHOOLS,
  RELIC_MODIFIER_TAGS,
  CREATURE_TAGS,
} from './schemas.js';
import { RESOURCE_SOURCE_IDS } from './resources.js';
import { FORMULA_OPS, FORMULA_OF, isFormula } from './formulas.js';
import { attributeContentProblems } from './attributes.js';
import { derivedStatPresentationProblems, derivedStatRuleProblems, relicAttributeTierFoldProblems } from './derivedStats.js';
import { startingKitProblems } from './startingKits.js';
import { armouryUiProblems } from './equipmentUi.js';
import { characterCreationProblems } from './characterCreation.js';

// Ops whose value binds to a text-template token; token name = op name,
// except applyStatus which binds under its status id (SPEC §3.13).
export const TOKENIZABLE_OPS = Object.freeze([
  'damage',
  'block',
  'heal',
  'loseHp',
  'applyStatus',
  'poiseDamage',
  'draw',
  'gainEnergy',
  'restoreMana',
  'addCinders',
  'loseMaxHpPct',
]);

// Ops whose LITERAL numeric value MUST have a bound token in the template
// (a player-visible number with no token is a validation error).
export const REQUIRED_TOKEN_OPS = Object.freeze([
  'damage',
  'block',
  'heal',
  'loseHp',
  'applyStatus',
  'poiseDamage',
  'draw',
  'gainEnergy',
  'restoreMana',
]);

const KNOWN_BUNDLE_KEYS = new Set([
  ...REGISTRY_TYPES,
  'version',
  'contentVersion',
  'balance',
  'mapConfigs',
  'scripts',
  'equipment',
  'unlocks',
  'sfx',
  'music',
  'tags', // card/effect tag registry — one vocabulary, two carriers (#61)
  'attributeRules',
  'derivedStatRules',
  'characterCreation',
]);

/**
 * computeTokenBindings(effects) → [{ token, index, field, op, literal }]
 *
 * Deterministic binding of template tokens to opcode values, in effect order.
 * The first occurrence of a token base binds as `{base}`, repeats as
 * `{base.2}`, `{base.3}` ... (SPEC §3.13). `hits` on a damage op binds as
 * `{hits}` (then `{hits.2}` ...). Shared by validation, previewCard, and the UI.
 */
/**
 * relicTokens(def) → { token: number }
 *
 * A relic's template says `{block}` and its data says `do: [{ op: 'block',
 * amount: 2 }]`. The token IS the opcode and the value is the field the opcode
 * carries, so the number a player reads is DERIVED from the entry that produces
 * it — never a second copy typed into the prose (Law 1 clause 2, which calls a
 * restatement a defect "even in tooltip prose").
 *
 * EldenSpire#38. Three call sites rendered relic text as
 * `textTemplate.replace(/[{}]/g, '')` — strip the braces, ship the key. Sunna
 * caught it on the ugliest one, "also deals poiseDamage Poise damage", and it
 * turned out to be 51 tokens across 46 token-carrying relics of 54: "gain block Block", "heal heal
 * HP", "draw draw extra card". The camelCase one was visible; the rest read as
 * clumsy English and hid in plain sight. EVERY relic number in the game was
 * invisible to the player.
 *
 * WHAT 51/51 IS AND IS NOT (Vira, #41): it is a fact about today's 54 entries,
 * not about this function. `starstoneShard` already ships
 * `stacks: { f: 'add', args: [1] }` — a formula, not a number — and any template
 * binding it renders `{token}` unresolved. That is the honest degrade and not a
 * silent one, but "every relic number resolves" is a census, and a census is not
 * an invariant. The invariant belongs with validateRelicTemplate, which is the
 * other decider of this same fact and should own it.
 *
 * Numbers only, and deliberately: a token bound to a non-number would render
 * "[object Object]", so an unresolved token is left as `{token}` for the caller
 * to decide about rather than papered over. Bad data stays visible (clause 5).
 */
/**
 * The template-token grammar, in ONE place. `{block}`, `{bleed}`, `{damage.2}`.
 *
 * EldenSpire#41, Bjorn's deletability review: this regex had FOUR copies —
 * validate.js:150, loadout.js:258 (already named TOKEN_RE), and twice in
 * card.js. A factory rather than a shared instance on purpose: a `g` regex
 * carries `lastIndex`, so one exported object shared across modules is a
 * cross-module mutable, and loadout.js was already resetting it defensively at
 * three call sites. Each caller gets its own.
 */
export const TOKEN_PATTERN = '\\{([A-Za-z][\\w.]*)\\}';
export const tokenRe = () => new RegExp(TOKEN_PATTERN, 'g');

function relicModifierTokenBindings(def) {
  const counts = {};
  const out = [];
  const add = (base, value, tag) => {
    counts[base] = (counts[base] || 0) + 1;
    const token = counts[base] === 1 ? base : `${base}.${counts[base]}`;
    out.push({ token, value, literal: typeof value === 'number', op: tag, required: true });
  };
  for (const row of (def.passives && Array.isArray(def.passives.modifiers) ? def.passives.modifiers : [])) {
    if (!row || typeof row !== 'object') continue;
    if (row.tag === 'resource.flat') add(`${row.resource}Flat`, row.amount, row.tag);
    else if (row.tag === 'resource.attributeTier') add(`${row.resource}PerTier`, row.amountPerTier, row.tag);
    else if (row.tag === 'damage.school.flat') add(`${row.school}DamageFlat`, row.amount, row.tag);
  }
  return out;
}

export function relicTokens(def) {
  // DELEGATES. It used to carry its own grammar — a `['amount','stacks','value',
  // 'n']` scan plus status/id keying — and Bjorn's review found 3 of 4 synthetic
  // relics built from DECLARED vocabulary rendering a raw token, with a green
  // control. computeTokenBindings twelve lines up already owns this rule and
  // owns it better: TOKENIZABLE_OPS gates it, `applyStatus` keys on the status
  // and reads `stacks`, `loseMaxHpPct` reads `pct`, `damage` also binds `hits`,
  // and a repeated op disambiguates to `{block.2}`. My version had none of that.
  //
  // What this function is FOR is the other half: a card carries a flat
  // `effects` array and a relic carries ops spread across `triggers[].do`. So
  // this flattens, and the grammar stays where it already lived.
  const ops = [];
  for (const t of def.triggers || []) for (const op of t.do || []) ops.push(op);
  for (const op of def.effects || []) ops.push(op);
  for (const op of def.do || []) ops.push(op);
  const tokens = {};
  for (const b of computeTokenBindings(ops)) {
    const v = (ops[b.index] || {})[b.field];
    if (typeof v === 'number') tokens[b.token] = v;
  }
  for (const binding of relicModifierTokenBindings(def)) {
    if (typeof binding.value === 'number') tokens[binding.token] = binding.value;
  }
  return tokens;
}

export function computeTokenBindings(effects) {
  const counts = {};
  const out = [];
  const push = (base, index, field, op, literal) => {
    counts[base] = (counts[base] || 0) + 1;
    const token = counts[base] === 1 ? base : `${base}.${counts[base]}`;
    out.push({ token, index, field, op, literal });
  };
  (effects || []).forEach((eff, i) => {
    if (!eff || typeof eff !== 'object' || typeof eff.op !== 'string') return;
    if (!TOKENIZABLE_OPS.includes(eff.op)) return;
    const field = eff.op === 'applyStatus' ? 'stacks' : eff.op === 'loseMaxHpPct' ? 'pct' : 'amount';
    const base = eff.op === 'applyStatus' ? eff.status : eff.op;
    if (typeof base !== 'string') return; // malformed; schema pass reports it
    push(base, i, field, eff.op, typeof eff[field] === 'number');
    if (eff.op === 'damage' && eff.hits != null) {
      push('hits', i, 'hits', eff.op, typeof eff.hits === 'number');
    }
  });
  return out;
}

export function extractTemplateTokens(template) {
  const tokens = [];
  const re = tokenRe();
  let m;
  while ((m = re.exec(template)) !== null) tokens.push(m[1]);
  return tokens;
}

/**
 * validateContent(bundle) → { ok, errors: [{ path, msg }], scriptReport }.
 * `bundle` is the raw content bundle (same shape createRegistries takes).
 */
export function validateContent(bundle) {
  const errors = [];
  const err = (path, msg) => errors.push({ path, msg });
  const b = bundle || {};

  const schoolBuildup = b.balance && b.balance.arcaneExposure && b.balance.arcaneExposure.schoolBuildupMultipliers;
  if (!schoolBuildup || typeof schoolBuildup !== 'object' || Array.isArray(schoolBuildup)) {
    err('balance.arcaneExposure.schoolBuildupMultipliers', 'must be an explicit school map');
  } else {
    for (const [school, multiplier] of Object.entries(schoolBuildup)) {
      if (!DAMAGE_SCHOOLS.includes(school)) err(`balance.arcaneExposure.schoolBuildupMultipliers.${school}`, `unknown damage school '${school}'`);
      if (!Number.isFinite(multiplier) || multiplier < 0) err(`balance.arcaneExposure.schoolBuildupMultipliers.${school}`, 'must be finite and non-negative');
    }
  }

  for (const key of Object.keys(b)) {
    if (!KNOWN_BUNDLE_KEYS.has(key)) err(key, `Unknown content bundle key '${key}'`);
  }

  // ---- collect id sets for cross-reference checks -------------------------
  const ids = { scripts: new Set(Object.keys(b.scripts || {})) };
  for (const type of REGISTRY_TYPES) {
    ids[type] = new Set();
    const defs = b[type] || [];
    if (!Array.isArray(defs)) {
      err(type, `Bundle key '${type}' must be an array of defs`);
      continue;
    }
    defs.forEach((def, i) => {
      if (!def || typeof def.id !== 'string') err(`${type}[${i}]`, 'Def missing string id');
      else if (ids[type].has(def.id)) err(`${type}.${def.id}`, `Duplicate id '${def.id}'`);
      else ids[type].add(def.id);
    });
  }

  // Mana costs are semantic bounds, not merely integer shapes. A negative
  // cost would mint Mana when a card is played. Mana maxima are derived from
  // the rules table; classes deliberately own no second maximum.
  for (const card of Array.isArray(b.cards) ? b.cards : []) {
    if (card && card.manaCost != null && Number.isInteger(card.manaCost) && card.manaCost < 0) {
      err(`cards.${card.id || '?'}.manaCost`, 'must be >= 0');
    }
  }
  const flaskCapacity = b.balance && b.balance.flaskCapacity;
  if (!Number.isInteger(flaskCapacity) || flaskCapacity <= 0) err('balance.flaskCapacity', 'must be a positive integer');
  for (const cls of Array.isArray(b.classes) ? b.classes : []) {
    const a = cls && cls.startingFlaskAllocation;
    if (!a || !Number.isInteger(a.hp) || a.hp < 0 || !Number.isInteger(a.mana) || a.mana < 0
      || a.hp + a.mana !== flaskCapacity) {
      err(`classes.${cls && cls.id || '?'}.startingFlaskAllocation`, `must satisfy hp + mana = flaskCapacity ${flaskCapacity}`);
    }
  }

  // Effect-tag vocabulary: the card-tag registry rides the bundle so effect
  // `tags` and taggedVulnerability lists validate against ONE home (#61).
  const tagIds = new Set((Array.isArray(b.tags) ? b.tags : []).map((t) => t && t.id).filter(Boolean));
  const vctx = { ids, err, tagIds };

  // Equipment profiles are nested tables, but receive the same strict central
  // schema walk as top-level registries. Absence is not an empty valid table.
  const equipment = b.equipment;
  if (!equipment || typeof equipment !== 'object' || Array.isArray(equipment)) {
    err('equipment', 'must be an object containing basicCardProfiles');
  } else if (!Array.isArray(equipment.basicCardProfiles)) {
    err('equipment.basicCardProfiles', 'Missing required basicCardProfiles array');
  } else {
    for (const problem of armouryUiProblems(equipment.armouryUi)) {
      err(problem.path, problem.message);
    }
    // Player Poise is authored on every equipment row even though it has no
    // combat consumer yet. Missing data must not silently normalize to zero:
    // the receipt is truthful only when every worn source says its number.
    for (const [table, rows] of [['armaments', equipment.armaments], ['armour', equipment.armour]]) {
      if (!Array.isArray(rows)) {
        err(`equipment.${table}`, 'must be an array');
        continue;
      }
      for (const row of rows) {
        const id = row && row.id || '?';
        const value = row && row.poiseThreshold;
        if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
          err(`equipment.${table}.${id}.poiseThreshold`, `must be a finite non-negative integer, got ${JSON.stringify(value)}`);
        }
      }
    }

    const seenProfiles = new Set();
    for (const profile of equipment.basicCardProfiles) {
      const id = profile && profile.id || '?';
      walkSchema(profile, SCHEMAS.basicCardProfile, `equipment.basicCardProfiles.${id}`, vctx);
      if (seenProfiles.has(id)) err(`equipment.basicCardProfiles.${id}`, `Duplicate profile id '${id}'`);
      seenProfiles.add(id);
      if (profile && Number.isFinite(profile.baseValue) && profile.baseValue < 0) err(`equipment.basicCardProfiles.${id}.baseValue`, 'must be non-negative');
      if (profile && Number.isFinite(profile.pointsPerTier) && profile.pointsPerTier <= 0) err(`equipment.basicCardProfiles.${id}.pointsPerTier`, 'must be > 0');
      if (profile && Number.isFinite(profile.cap) && profile.cap < 0) err(`equipment.basicCardProfiles.${id}.cap`, 'must be non-negative');
      if (!Number.isInteger(profile && profile.exposureBuildupPerHit) || profile.exposureBuildupPerHit < 0) err(`equipment.basicCardProfiles.${id}.exposureBuildupPerHit`, 'must be a non-negative integer');
      if (profile && profile.cap !== '' && profile.cap != null && !Number.isFinite(profile.cap)) err(`equipment.basicCardProfiles.${id}.cap`, 'must be blank or finite');
      if (profile && profile.compatibility !== `${profile.role}-v1`) err(`equipment.basicCardProfiles.${id}.compatibility`, `must match role '${profile.role}-v1'`);
      for (const tag of (profile && profile.tags) || []) if (!tagIds.has(tag)) err(`equipment.basicCardProfiles.${id}.tags`, `unknown tag '${tag}'`);
    }

    // Validate the raw authored carrier rows before their map is joined onto
    // cards. This keeps duplicate/missing rows visible at the production boot
    // door rather than allowing Map normalization to hide them.
    if (!Array.isArray(equipment.cardExposure)) {
      err('equipment.cardExposure', 'Missing required generated cardExposure array');
    } else {
      const seen = new Set();
      for (const row of equipment.cardExposure) {
        const cardId = row && row.cardId;
        const path = `equipment.cardExposure.${cardId || '?'}`;
        for (const key of Object.keys(row || {})) if (!['cardId', 'damageSchool', 'exposureBuildupPerHit'].includes(key)) err(`${path}.${key}`, 'Unknown field');
        if (typeof cardId !== 'string' || !ids.cards.has(cardId)) err(`${path}.cardId`, `unknown card '${cardId}'`);
        if (!DAMAGE_SCHOOLS.includes(row && row.damageSchool)) err(`${path}.damageSchool`, `unknown damage school '${row && row.damageSchool}'`);
        if (!Number.isInteger(row && row.exposureBuildupPerHit) || row.exposureBuildupPerHit < 0) err(`${path}.exposureBuildupPerHit`, 'must be a non-negative integer');
        if (seen.has(cardId)) err(path, `Duplicate card exposure row '${cardId}'`);
        seen.add(cardId);
      }
      const damages = (Array.isArray(b.cards) ? b.cards : []).filter((card) => [...(card.effects || []), ...((card.upgrade && card.upgrade.effects) || [])].some((effect) => effect && effect.op === 'damage'));
      for (const card of damages) {
        const path = `cards.${card.id}`;
        const row = equipment.cardExposure.find((candidate) => candidate.cardId === card.id);
        if (!row) err(`${path}.exposureBuildupPerHit`, 'Missing required explicit damage carrier row');
        if (typeof card.damageSchool !== 'string') err(`${path}.damageSchool`, 'Missing required explicit damage school');
        if (!Number.isInteger(card.exposureBuildupPerHit) || card.exposureBuildupPerHit < 0) err(`${path}.exposureBuildupPerHit`, 'Missing required non-negative per-hit buildup');
        if (row && (card.damageSchool !== row.damageSchool || card.exposureBuildupPerHit !== row.exposureBuildupPerHit)) err(path, 'Resolved card carrier disagrees with authored row');
      }
    }
  }

  // Equipment eligibility tables are boot-critical raw authoring. Validate
  // them before the equipment normalizer can join rows into pieces and thereby
  // hide a duplicate item/stat pair. This is the same validateContent door the
  // production boot uses, not a tool-only validator.
  if (equipment && typeof equipment === 'object' && !Array.isArray(equipment)) {
    const pieces = [...(Array.isArray(equipment.armaments) ? equipment.armaments : []), ...(Array.isArray(equipment.armour) ? equipment.armour : [])];
    const pieceIds = new Set(pieces.map((row) => row && row.id).filter(Boolean));
    const armamentIds = new Set((Array.isArray(equipment.armaments) ? equipment.armaments : []).map((row) => row && row.id).filter(Boolean));
    if (!Array.isArray(equipment.equipmentRequirements)) {
      err('equipment.equipmentRequirements', 'Missing required generated equipmentRequirements array');
    } else {
      const seen = new Set();
      for (const row of equipment.equipmentRequirements) {
        const itemId = row && row.itemId;
        const attributeId = row && row.attributeId;
        const path = `equipment.equipmentRequirements.${itemId || '?'}:${attributeId || '?'}`;
        for (const key of Object.keys(row || {})) if (!['itemId', 'attributeId', 'minimum'].includes(key)) err(`${path}.${key}`, 'Unknown field');
        if (typeof itemId !== 'string' || !itemId) err(`${path}.itemId`, 'must be a non-empty item id');
        else if (!pieceIds.has(itemId)) err(`${path}.itemId`, `unknown item '${itemId}'`);
        if (typeof attributeId !== 'string' || !attributeId) err(`${path}.attributeId`, 'must be a non-empty attribute id');
        else if (!ids.attributes.has(attributeId)) err(`${path}.attributeId`, `unknown attribute '${attributeId}'`);
        if (!row || !Object.prototype.hasOwnProperty.call(row, 'minimum') || !Number.isFinite(row.minimum) || !Number.isInteger(row.minimum) || row.minimum < 0) {
          err(`${path}.minimum`, 'must be a finite non-negative integer');
        }
        const key = `${itemId}:${attributeId}`;
        if (seen.has(key)) err(path, `Duplicate item/stat requirement '${key}'`);
        seen.add(key);
      }
    }
    if (!Array.isArray(equipment.cardEquipmentExceptions)) {
      err('equipment.cardEquipmentExceptions', 'Missing required generated cardEquipmentExceptions array');
    } else {
      const seen = new Set();
      for (const row of equipment.cardEquipmentExceptions) {
        const cardId = row && row.cardId;
        const weaponId = row && row.weaponId;
        const path = `equipment.cardEquipmentExceptions.${cardId || '?'}:${weaponId || '?'}`;
        for (const key of Object.keys(row || {})) if (!['cardId', 'weaponId'].includes(key)) err(`${path}.${key}`, 'Unknown field');
        if (typeof cardId !== 'string' || !ids.cards.has(cardId)) err(`${path}.cardId`, `unknown card '${cardId}'`);
        if (typeof weaponId !== 'string' || !armamentIds.has(weaponId)) err(`${path}.weaponId`, `unknown weapon '${weaponId}'`);
        const key = `${cardId}:${weaponId}`;
        if (seen.has(key)) err(path, `Duplicate exact card/weapon pair '${key}'`);
        seen.add(key);
      }
    }
    if (!Array.isArray(equipment.cardTagging)) err('equipment.cardTagging', 'Missing required registered cardTagging array');
  }

  // Starting kits are a nested generated table whose validity spans classes,
  // hand slots, armament discovery weights, and the no-spoiler policy.
  try {
    const kitRegistries = {
      classes: { ids: () => [...ids.classes], has: (id) => ids.classes.has(id), get: (id) => (b.classes || []).find((row) => row.id === id) },
      equipment: b.equipment || {},
      balance: b.balance || {},
    };
    for (const problem of startingKitProblems(kitRegistries)) err('equipment.startingKits', problem);
  } catch (error) {
    err('equipment.startingKits', error && error.message ? error.message : 'starting-kit validation failed');
  }

  const dependencySafeBundle = {
    ...b,
    equipment: {
      ...(equipment && typeof equipment === 'object' && !Array.isArray(equipment) ? equipment : {}),
      armaments: Array.isArray(equipment && equipment.armaments) ? equipment.armaments : [],
      armour: Array.isArray(equipment && equipment.armour) ? equipment.armour : [],
    },
  };
  for (const problem of characterCreationProblems(dependencySafeBundle)) {
    const split = problem.indexOf(':');
    err(split >= 0 ? problem.slice(0, split) : 'characterCreation', split >= 0 ? problem.slice(split + 1).trim() : problem);
  }
  const creationKeepsakes = b.characterCreation && b.characterCreation.keepsakes;
  for (const keepsake of Array.isArray(creationKeepsakes) ? creationKeepsakes : []) {
    if (!keepsake || typeof keepsake !== 'object' || Array.isArray(keepsake) || !Array.isArray(keepsake.effects)) continue;
    validateEffects(keepsake.effects, `characterCreation.keepsakes.${keepsake.id || '?'}.effects`, vctx);
  }

  // ---- schema walks --------------------------------------------------------
  const typeToSchema = {
    attributes: SCHEMAS.attribute,
    creationModes: SCHEMAS.creationMode,
    cards: SCHEMAS.card,
    resources: SCHEMAS.resource,
    relics: SCHEMAS.relic,
    statuses: SCHEMAS.status,
    stances: SCHEMAS.stance,
    keywords: SCHEMAS.keyword,
    enemies: SCHEMAS.enemy,
    encounters: SCHEMAS.encounter,
    events: SCHEMAS.event,
    flasks: SCHEMAS.flask,
    classes: SCHEMAS.class,
  };
  for (const type of REGISTRY_TYPES) {
    const defs = Array.isArray(b[type]) ? b[type] : [];
    defs.forEach((def) => {
      const path = `${type}.${(def && def.id) || '?'}`;
      walkSchema(def, typeToSchema[type], path, vctx);
    });
  }
  for (const enemy of Array.isArray(b.enemies) ? b.enemies : []) {
    const base = `enemies.${enemy && enemy.id || '?'}`;
    const cfg = enemy && enemy.arcaneExposure;
    if (cfg && cfg.mode === 'configured') {
      for (const field of ['threshold', 'buildupMultiplier', 'resetMode', 'overflowPolicy', 'lockPolicy', 'onBreak']) {
        if (cfg[field] === undefined) err(`${base}.arcaneExposure.${field}`, `Missing required configured field '${field}'`);
      }
      if (!Number.isInteger(cfg.threshold) || cfg.threshold <= 0) err(`${base}.arcaneExposure.threshold`, 'must be a positive integer');
      if (!Number.isFinite(cfg.buildupMultiplier) || cfg.buildupMultiplier <= 0) err(`${base}.arcaneExposure.buildupMultiplier`, 'must be finite and > 0');
      if (cfg.onBreak && (!Number.isFinite(cfg.onBreak.value) || cfg.onBreak.value <= 0)) err(`${base}.arcaneExposure.onBreak.value`, 'must be finite and > 0');
      if (cfg.onBreak && (!Number.isInteger(cfg.onBreak.duration) || cfg.onBreak.duration <= 0)) err(`${base}.arcaneExposure.onBreak.duration`, 'must be a positive integer');
    } else if (cfg && cfg.mode === 'immune') {
      for (const field of Object.keys(cfg)) if (field !== 'mode') err(`${base}.arcaneExposure.${field}`, `immune policy may not author '${field}'`);
    }
    for (const [school, percent] of Object.entries((enemy && enemy.damageResistanceBySchool) || {})) {
      if (!DAMAGE_SCHOOLS.includes(school)) err(`${base}.damageResistanceBySchool.${school}`, `unknown damage school '${school}'`);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) err(`${base}.damageResistanceBySchool.${school}`, 'must be a finite percent from 0 to 100');
    }
  }
  walkSchema(b.attributeRules, SCHEMAS.attributeRules, 'attributeRules', vctx);
  for (const problem of attributeContentProblems(b)) err(problem.path, problem.msg);
  const equipmentProfileIds = new Set((((b.equipment || {}).basicCardProfiles) || []).map((row) => row && row.id));
  for (const mode of b.creationModes || []) {
    for (const [profileId, patch] of Object.entries((mode && mode.equipmentProfiles) || {})) {
      const path = `creationModes.${mode.id}.equipmentProfiles.${profileId}`;
      if (!equipmentProfileIds.has(profileId)) err(path, `unknown equipment profile '${profileId}'`);
      if (patch.baseValue !== undefined && !Number.isFinite(patch.baseValue)) err(`${path}.baseValue`, 'must be finite');
      if (patch.pointsPerTier !== undefined && (!Number.isFinite(patch.pointsPerTier) || patch.pointsPerTier <= 0)) err(`${path}.pointsPerTier`, 'must be finite and > 0');
      if (patch.gainPerTier !== undefined && !Number.isFinite(patch.gainPerTier)) err(`${path}.gainPerTier`, 'must be finite');
      if (patch.cap !== undefined && patch.cap !== null && (!Number.isFinite(patch.cap) || patch.cap < 0)) err(`${path}.cap`, 'must be null or finite and >= 0');
    }
  }
  for (const problem of derivedStatRuleProblems(b.derivedStatRules, {
    attributeIds: (b.attributes || []).map((row) => row.id),
    classFields: ['maxHp', 'hpPerConTier'],
  })) err(problem.path, problem.msg);
  // D26's short form: every derived stat carries how it READS, beside the rule
  // it describes. Content-door only — a save's restored snapshot has rules and
  // no prose, and asking it for prose it never stored would refuse a legal save.
  for (const problem of derivedStatPresentationProblems(b.derivedStatRules)) err(problem.path, problem.msg);

  // Relic modifier tags are a compact passive DSL. The tag is the behavior;
  // every other word is data. Validate the exact row here so a typo never
  // becomes a plausible-looking inert bonus.
  const attributeIds = new Set((b.attributes || []).map((row) => row && row.id));
  const resourceIds = new Set(['hp', 'mana', 'stamina']);
  const starterRelicIds = new Set((b.classes || []).map((row) => row && row.startingRelic));
  for (const relic of b.relics || []) {
    const rows = relic && relic.passives && relic.passives.modifiers;
    if (rows === undefined) continue;
    const base = `relics.${relic.id}.passives.modifiers`;
    if (!Array.isArray(rows)) {
      err(base, 'must be an array');
      continue;
    }
    if (rows.length && (relic.rarity !== 'starter' || !starterRelicIds.has(relic.id))) {
      err(base, 'resource/damage modifier tags are restricted to class starting relics');
    }
    rows.forEach((row, index) => {
      const path = `${base}[${index}]`;
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        err(path, 'must be an object');
        return;
      }
      if (!RELIC_MODIFIER_TAGS.includes(row.tag)) {
        err(`${path}.tag`, `'${row.tag}' is unknown (legal: ${RELIC_MODIFIER_TAGS.join(', ')})`);
        return;
      }
      const fields = row.tag === 'resource.flat'
        ? ['tag', 'resource', 'amount']
        : row.tag === 'resource.attributeTier'
          ? ['tag', 'resource', 'sourceStat', 'pointsPerTier', 'amountPerTier']
          : ['tag', 'school', 'amount'];
      // `pointsPerTier` is ALLOWED and no longer REQUIRED on an attributeTier
      // row: omitted, it inherits the derived rule it folds into
      // (model/relicModifiers.js). It stayed required while the tier size was a
      // constant; the day Constantine asked for that size to be a dial, a row
      // restating it became a copy that made a reaver unable to start a run.
      const optional = row.tag === 'resource.attributeTier' ? ['pointsPerTier'] : [];
      for (const key of Object.keys(row)) if (!fields.includes(key)) err(`${path}.${key}`, `unknown field '${key}' for '${row.tag}'`);
      for (const key of fields) if (row[key] === undefined && !optional.includes(key)) err(`${path}.${key}`, `missing required field '${key}'`);
      if (row.resource !== undefined && !resourceIds.has(row.resource)) err(`${path}.resource`, `unknown resource '${row.resource}'`);
      if (row.sourceStat !== undefined && !attributeIds.has(row.sourceStat)) err(`${path}.sourceStat`, `unknown attribute '${row.sourceStat}'`);
      if (row.school !== undefined && !DAMAGE_SCHOOLS.includes(row.school)) err(`${path}.school`, `unknown damage school '${row.school}'`);
      for (const key of ['amount', 'amountPerTier']) {
        if (row[key] !== undefined && (!Number.isInteger(row[key]) || row[key] <= 0)) err(`${path}.${key}`, 'must be a positive integer');
      }
      if (row.pointsPerTier !== undefined && (!Number.isInteger(row.pointsPerTier) || row.pointsPerTier <= 0)) {
        err(`${path}.pointsPerTier`, 'must be a positive integer');
      }
      if (row.tag === 'resource.attributeTier') {
        const authoredRule = b.derivedStatRules && b.derivedStatRules.rules && b.derivedStatRules.rules[row.resource];
        const defaults = b.derivedStatRules && b.derivedStatRules.defaults || {};
        const resolvedRule = authoredRule && { ...defaults, ...authoredRule };
        if (resolvedRule) {
          for (const foldProblem of relicAttributeTierFoldProblems(row, resolvedRule)) {
            err(foldProblem.field ? `${path}.${foldProblem.field}` : path,
              `${foldProblem.msg} so the ${row.resource} modifier can fold at content boot`);
          }
        }
      }
    });
  }

  for (const cls of b.classes || []) {
    if (cls && (!Number.isInteger(cls.hpPerConTier) || cls.hpPerConTier <= 0)) {
      err(`classes.${cls.id}.hpPerConTier`, 'must be a positive integer');
    }
  }

  // ---- HUD resource rows: MEANING, not shape (Law 1 clause 5) --------------
  // The shape walk above already rejects a missing `source`. This rejects a
  // source the engine cannot READ — the defect that would otherwise ship a
  // trough reading 0/0 forever on Constantine's HUD, looking finished.
  //
  // A new row whose resource has no engine reader dies HERE at boot, naming the
  // row and legal sources instead of drawing a 0/0 trough that looks finished.
  for (const row of (Array.isArray(b.resources) ? b.resources : [])) {
    if (!row || typeof row.source !== 'string') continue; // shape walk owns this
    if (!RESOURCE_SOURCE_IDS.includes(row.source)) {
      err(`resources.${row.id || '?'}`, `source ${JSON.stringify(row.source)} has no reader — `
        + `the engine cannot get a value for it, so this bar would render an empty trough forever. `
        + `Readable sources are: ${RESOURCE_SOURCE_IDS.join(', ')}. `
        + `Adding one is an engine change (a reader in model/resources.js), not a row.`);
    }
    if (row.domainMax != null && !(Number.isFinite(row.domainMax) && row.domainMax > 0)) {
      err(`resources.${row.id || '?'}.domainMax`, `must be a positive number when present — got ${JSON.stringify(row.domainMax)}. `
        + `It is the bar's full-row ceiling; a zero or negative one divides the length by nothing.`);
    }
    if (Array.isArray(row.surfaces) && row.surfaces.length === 0) {
      err(`resources.${row.id || '?'}.surfaces`, 'names no surface, so this row can never draw — omit the row or give it a surface.');
    }
  }

  if (b.balance != null && (typeof b.balance !== 'object' || Array.isArray(b.balance))) {
    err('balance', 'balance must be a plain object of constants');
  }
  // balance.ui.holdConfirm — THE DIAL THAT DISABLES A SAFETY FEATURE WHEN IT IS
  // WRONG, so it is the last thing that may fail quiet. Vira's finding: it
  // validated against NOTHING. `steps: { normal: 'abc' }` reaches
  // `Number('abc') || 0` in ui/components/holdconfirm.js, resolves to 0 ms, and
  // the hold silently does not exist — while `validateContent` returns ok:true
  // with zero errors naming it. Law 1 clause 5 failing quiet, on the one control
  // whose failure is invisible by construction: nothing on the screen looks
  // different, the bars just commit on a tap again.
  //
  // Meaning, not shape, which is why it is here and not in SCHEMAS: whether
  // `def` names a step that EXISTS needs two fields to ask.
  if (b.balance && b.balance.ui && b.balance.ui.holdConfirm != null) {
    const hc = b.balance.ui.holdConfirm;
    if (typeof hc !== 'object' || Array.isArray(hc)) {
      err('balance.ui.holdConfirm', 'must be an object { def, steps }');
    } else {
      const steps = hc.steps;
      if (typeof steps !== 'object' || steps == null || Array.isArray(steps)) {
        err('balance.ui.holdConfirm.steps', 'must be an object of name -> milliseconds');
      } else {
        const names = Object.keys(steps);
        if (!names.length) err('balance.ui.holdConfirm.steps', 'must offer at least one position');
        for (const k of names) {
          const v = steps[k];
          if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
            err(`balance.ui.holdConfirm.steps.${k}`, `must be a non-negative number of milliseconds — got ${JSON.stringify(v)}. `
              + `A value the code cannot read resolves to 0 ms, which silently turns the confirm step OFF.`);
          }
        }
        if (!Object.hasOwn(steps, hc.def)) {
          err('balance.ui.holdConfirm.def', `${JSON.stringify(hc.def)} is not one of the steps offered (${names.join(', ')}) — `
            + `the default position must exist, or every player starts on a setting the row cannot show.`);
        }
      }
    }
  }
  // balance.ui.holdBeat — THE SAME FAILURE SHAPE AS holdConfirm, one control
  // over. The beat is the only feedback a held control has once a thumb is on
  // top of the fill, and every way this row can be wrong is SILENT: a fraction
  // of 1.4 never arrives, a NaN compares false against every progress value, a
  // descending list fires the late tick first and then never again, and a
  // duplicate fires two ticks in one frame that a player hears as one. In all
  // four the screen is unchanged and the sound simply is not there — which is
  // the exact state the beat exists to distinguish from a tap that missed.
  //
  // An EMPTY array is legal and means "no ticks, commit only": turning the
  // train off is a tuning decision, and refusing it here would make the row a
  // lie about what one edit can do.
  if (b.balance && b.balance.ui && b.balance.ui.holdBeat != null) {
    const hb = b.balance.ui.holdBeat;
    if (typeof hb !== 'object' || Array.isArray(hb)) {
      err('balance.ui.holdBeat', 'must be an object { at: [fractions] }');
    } else if (!Array.isArray(hb.at)) {
      err('balance.ui.holdBeat.at', `must be an array of fractions of the fill (0 <= f < 1) — got ${JSON.stringify(hb.at)}. `
        + `A value the beat cannot read fires no ticks, and a hold with no ticks is the defect this row exists for.`);
    } else {
      let prev = -1;
      hb.at.forEach((f, i) => {
        if (typeof f !== 'number' || !Number.isFinite(f) || f < 0 || f >= 1) {
          err(`balance.ui.holdBeat.at[${i}]`, `must be a number in [0, 1) — got ${JSON.stringify(f)}. `
            + `1.0 is not a tick: the arrival is the 'holdCommit' recipe, and putting it here would give the landing two homes.`);
        } else if (f <= prev) {
          err(`balance.ui.holdBeat.at[${i}]`, `must be strictly greater than at[${i - 1}] (${prev}) — got ${f}. `
            + `The fill only ever runs forward, so an out-of-order or duplicated fraction is a tick that fires twice in one frame or never fires at all.`);
        } else {
          prev = f;
        }
      });
    }
  }
  // balance.ui.inspectHold — the reading hold on the hand. The consumer is
  // `Number(...) || 0` shaped like holdConfirm's, so a typo'd row would resolve
  // to 0 and silently REMOVE the gesture: nothing on screen looks different, a
  // held card simply never expands — the same silent-plausible failure as the
  // rows above (Law 0 clause 5). `ms: 0` on purpose is legal and means off; a
  // row that cannot be READ is not a zero, it is a mistake, and it fails here
  // by name.
  if (b.balance && b.balance.ui && b.balance.ui.inspectHold != null) {
    const ih = b.balance.ui.inspectHold;
    if (typeof ih !== 'object' || Array.isArray(ih)) {
      err('balance.ui.inspectHold', 'must be an object { ms }');
    } else if (typeof ih.ms !== 'number' || !Number.isFinite(ih.ms) || ih.ms < 0) {
      err('balance.ui.inspectHold.ms', `must be a non-negative number of milliseconds — got ${JSON.stringify(ih.ms)}. `
        + `The consumer resolves an unreadable value to 0, which takes the inspect gesture off every card with nothing on the screen looking different.`);
    }
  }
  // balance.ui.handLayout — the hand-layout word (C2: overlap AND paging, one
  // knob). The consumer guards a stored player setting against the modes list
  // and falls back to THIS row — so if this row itself is garbage, the
  // fallback is garbage and the narrow hand silently renders in whatever the
  // CSS default happens to be, with nothing on screen saying a mode was ever
  // chosen (Law 0 clause 5, again). Loud, by name, at boot.
  if (b.balance && b.balance.ui && (b.balance.ui.handLayout != null || b.balance.ui.handLayoutModes != null)) {
    const modes = b.balance.ui.handLayoutModes;
    if (!Array.isArray(modes) || modes.length === 0 || modes.some((m) => typeof m !== 'string' || !m)) {
      err('balance.ui.handLayoutModes', `must be a non-empty array of mode names — got ${JSON.stringify(modes)}. `
        + `It is the closed set the settings guard checks a stored value against; unreadable, every stored choice would land on the default without the player ever being told why.`);
    } else if (typeof b.balance.ui.handLayout !== 'string' || !modes.includes(b.balance.ui.handLayout)) {
      err('balance.ui.handLayout', `must be one of ${modes.join(' | ')} — got ${JSON.stringify(b.balance.ui.handLayout)}. `
        + `This row is the fallback every garbage stored setting lands on; a fallback outside the closed set leaves the hand with no layout word at all.`);
    }
  }
  // OVERLAP DOES NOT FLATTEN WITHOUT ITS READER (Sunna's ruling, 2026-08-14).
  // Two rows, each defensible alone: 'overlap' is a legal layout mode, and
  // inspectHold.ms 0 is the inspect gesture's legal off position. TOGETHER
  // they author a hand nobody can read — ten cards flattened to ~27-30
  // viewport px exposed slivers (measured, tools/handlayout.mjs, 390x844),
  // under the tap floor, with the one compensating reader turned off — from a
  // table edit that never fails a shape check, because each row's own shape is
  // fine (Law 1 clause 5: the failure a content edit can cause, not just the
  // rows it can malform). Ruled a REFUSAL, not a warning ("a warning that
  // boots is the fourth silent state") and not accept-in-writing.
  //
  // It binds the OFFERED set, not the default: offering 'overlap' at all puts
  // the sliver hand one legal settings write away, so the default being
  // 'paging' discharges nothing. Paging-only with ms 0 stays legal — the
  // strip needs no reader, and turning the gesture off is a tuning row this
  // check must not eat. The reader is resolved exactly as its consumer
  // resolves it (combat.js: `Number((ui.inspectHold || {}).ms) || 0`), so an
  // ABSENT inspectHold row is the same off position as ms: 0 and refuses too
  // — guarding on the entry would let deleting the entry silence the check
  // that watches it (the tapSize precedent below). A MALFORMED ms is not
  // handled here: it is already red by name in the inspectHold block above,
  // and a second error calling garbage "0" would misname the defect.
  // Corpus: tools/overlapreader.mjs — known-bads enter as content rows
  // through a real boot; observed red at b277ec2 before this block existed.
  if (b.balance && b.balance.ui) {
    const ui = b.balance.ui;
    const hp = ui.hudPresentation;
    if (!hp || typeof hp !== 'object' || Array.isArray(hp)) {
      err('balance.ui.hudPresentation', 'must be an object with componentBackgroundOpacityPct, metadataFontPx, beltItemGapPx, portraitScale, primaryRowGapPx, controlGapPx, resourceRowGapPx, cindersMaxWidthPct, metadataMaxWidthPct, and metadataShowTotals');
    } else {
      for (const [key, min, max] of [
        ['componentBackgroundOpacityPct', 0, 100],
        ['metadataFontPx', 8, 24],
        ['beltItemGapPx', 0, 12],
        ['portraitScale', 0.5, 1],
        ['primaryRowGapPx', 0, 24],
        ['controlGapPx', 0, 12],
        ['resourceRowGapPx', 0, 12],
        ['cindersMaxWidthPct', 20, 40],
        ['metadataMaxWidthPct', 20, 40],
      ]) {
        const value = hp[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
          err(`balance.ui.hudPresentation.${key}`, `must be a finite number in [${min}, ${max}] — got ${JSON.stringify(value)}`);
        }
      }
      if (typeof hp.metadataShowTotals !== 'boolean') {
        err('balance.ui.hudPresentation.metadataShowTotals', `must be boolean — got ${JSON.stringify(hp.metadataShowTotals)}`);
      }
    }
    const shrinePresentation = ui.shrinePresentation;
    if (!shrinePresentation || typeof shrinePresentation !== 'object' || Array.isArray(shrinePresentation)) {
      err('balance.ui.shrinePresentation', 'must be an object with optionLayout');
    } else if (!['list', 'grid'].includes(shrinePresentation.optionLayout)) {
      err('balance.ui.shrinePresentation.optionLayout', `must be 'list' or 'grid' — got ${JSON.stringify(shrinePresentation.optionLayout)}`);
    }
    const quickSettings = ui.hudQuickSettings;
    const quickPlaces = ['title', 'map', 'combat'];
    if (!quickSettings || typeof quickSettings !== 'object' || Array.isArray(quickSettings)) {
      err('balance.ui.hudQuickSettings', 'must be an object with places, edgeGapPx, stackGapPx, and showLabels');
    } else {
      if (!Array.isArray(quickSettings.places)
        || quickSettings.places.some((place) => !quickPlaces.includes(place))
        || new Set(quickSettings.places).size !== quickSettings.places.length) {
        err('balance.ui.hudQuickSettings.places', `must contain unique values from ${quickPlaces.join(', ')} — got ${JSON.stringify(quickSettings.places)}`);
      }
      for (const key of ['edgeGapPx', 'stackGapPx']) {
        const value = quickSettings[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 24) {
          err(`balance.ui.hudQuickSettings.${key}`, `must be a finite number in [0, 24] — got ${JSON.stringify(value)}`);
        }
      }
      if (typeof quickSettings.showLabels !== 'boolean') {
        err('balance.ui.hudQuickSettings.showLabels', `must be boolean — got ${JSON.stringify(quickSettings.showLabels)}`);
      }
    }
    const offersOverlap = Array.isArray(ui.handLayoutModes) && ui.handLayoutModes.includes('overlap');
    const ih = ui.inspectHold;
    const wellFormedMs = ih != null && typeof ih === 'object' && !Array.isArray(ih)
      && typeof ih.ms === 'number' && Number.isFinite(ih.ms) && ih.ms >= 0;
    const readerOff = ih == null ? true : (wellFormedMs && ih.ms === 0);
    if (offersOverlap && readerOff) {
      const floor = ui.tapSize && typeof ui.tapSize.def === 'number' ? `the ${ui.tapSize.def} px tap floor` : 'the tap floor (balance.ui.tapSize.def)';
      err('balance.ui.handLayoutModes + balance.ui.inspectHold.ms',
        `'overlap' is offered while the inspect hold is off (${ih == null ? 'the inspectHold row is ABSENT, which the hand resolves to ms 0' : 'ms: 0'}) — refused. `
        + `Overlap flattens a full hand into ~27-30 px exposed slivers, under ${floor}, and hold-to-inspect is the one reader that makes a sliver legible; ms 0 turns that reader off. `
        + `These two entries conflict: drop 'overlap' from balance.ui.handLayoutModes, or give balance.ui.inspectHold.ms a non-zero hold. `
        + `Paging-only with ms 0 stays legal — the strip needs no reader.`);
    }
  }
  // THE SECOND-BEAT TABLE, checked at the same boot and for the same reason as
  // the dial above. It is CODE, not content, so it can never be a row a
  // designer breaks — but it is a table, and a table whose row is malformed
  // resolves to a plausible 'none' and takes a safety step off a button with
  // nothing on the screen looking different. That is Law 0 clause 5 exactly:
  // the dangerous failure is the silent plausible derivation, so the derivation
  // is asked to prove itself out loud on every boot that validates anything.
  for (const complaint of assertTableSane()) err('secondBeat', complaint);

  // THE MAP'S VERTICAL MARGIN, and it belongs here because it has exactly one
  // data input. `balance.ui.tapSize.def` is what the map node's radius is SOLVED
  // FROM (model/mapview.js), so raising it grows the target and eats the space
  // BETWEEN two adjacent targets in the same stroke — at 08e184a, 44.09 px of
  // node against a 47.0 px row pitch at 390x844, under 3 px of air between taps
  // both start a fight nobody can undo (Sunna, 2026-08-08). Nothing was watching
  // that number; a refusal that prints a verdict and not a margin cannot be.
  // THE MAP'S COLLISION MARGIN, and it belongs here because it has exactly one
  // data input. `balance.ui.tapSize.def` is what EVERY map circle's radius is
  // SOLVED FROM (model/mapview.js), so raising it grows every circle while the
  // pitches they are measured against do not move — targets grow, the space
  // between them does not. Sunna's sentence, written about the event screen's
  // choice bars weeks ago and true here too: nothing in this game read a gap.
  // A refusal that prints a verdict and not a margin cannot be watched.
  //
  // It rules on the pairs a content edit is answerable for. The boss/shrine pair
  // is RED at the shipped default — rendered, every act, since #107 — and is
  // deliberately NOT gated here, because a boot banner the player cannot act on
  // is a worse failure than the overlap. That exemption carries a latch:
  // `mapplan --selftest` asserts the pair is still red, so the excuse cannot
  // outlive its reason. `node tools/mapplan.mjs --margins` is where it is red.
  //
  // Asked ONCE of the bundle rather than per act: it does not vary with
  // mapConfigs, and three identical errors would be three copies of one fact.
  // The corpus it has to turn red is `node tools/mapplan.mjs --selftest` — the
  // same corpus the mapConfigs block below points at, and its rows for this
  // refusal are in it, so neither pointer dangles.
  // Guarded on `balance` and NOT on `balance.ui.tapSize`, deliberately: guarding
  // on the entry means deleting the entry silences the check that watches it.
  if (b.balance != null && typeof b.balance === 'object' && !Array.isArray(b.balance)) {
    for (const e of geometryRefusals(b.balance)) err(e.key, e.msg);
  }
  // balance.graceRefill — what a grace hands back (Constantine, 2026-08-08).
  //
  // TAKES THE WHOLE BUNDLE, not `b.balance`, and that is the point: three of its
  // eight refusals can only be asked with the flask ENTRIES in hand (does this
  // kind have a member, does this override resolve, is the override of the kind
  // the row claims). A refusal that could only see `balance` would be checking
  // the half that was never in doubt.
  //
  // Its corpus is `node tools/gracerefill.mjs --selftest`, which plants each
  // refusal into the real bundle and watches this call go red.
  for (const e of graceRefillRefusals(b)) err(e.key, e.msg);

  // The growth chain (balance.flaskGrowth) — same refusal shape, same door.
  // Its corpus is `node tools/flaskgrowth.mjs --selftest`, which plants each
  // refusal into the real bundle and watches this call go red.
  for (const e of flaskGrowthRefusals(dependencySafeBundle)) err(e.key, e.msg);

  // balance.poise is engine-consulted data: { growthMult?, onFill? } (see ENGINE-API.md)
  if (b.balance && b.balance.poise) {
    const p = b.balance.poise;
    if (p.growthMult != null && typeof p.growthMult !== 'number') err('balance.poise.growthMult', 'must be a number');
    if (p.onFill != null) validateEffects(p.onFill, 'balance.poise.onFill', vctx);
  }

  if (b.mapConfigs != null) {
    if (typeof b.mapConfigs !== 'object' || Array.isArray(b.mapConfigs)) {
      err('mapConfigs', 'mapConfigs must be an object keyed by act number');
    } else {
      for (const act of Object.keys(b.mapConfigs)) {
        const cfg = b.mapConfigs[act];
        walkSchema(cfg, SCHEMAS.mapConfig, `mapConfigs.${act}`, vctx);
        // THE SECOND LAYER — meaning, not shape. The schema cannot know whether
        // floor 9 exists in THIS act; that needs `floors`, so it is asked here.
        // This is the boot-time half of Law 1 clause 5: bad data fails loud and
        // NAMES THE ENTRY, rather than being clamped, defaulted, or ignored.
        // The corpus it has to turn red is in tools/mapplan.mjs --selftest.
        if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
          for (const e of resolveFloorPlan(cfg).errors) {
            err(`mapConfigs.${act}.${e.key}`, e.msg);
          }
          // AND THE SAME LAYER FOR THE KNOBS WHOSE FAILURE IS A VIEW FAILURE.
          // `floors: 2` already refused by name; `columns: 10` did not, and it
          // makes Constantine's "the current node and its connecting nodes fit"
          // unsatisfiable at every zoom the ladder has — a knob that hands him a
          // broken climb instead of a reason (Law 1 clause 5).
          //
          // AND EVERY ONE OF THESE NOW CARRIES ITS MARGIN, not just its verdict.
          // `columns: 9` was accepted at 1.02x with zero spare columns and the
          // word "accepted" was the whole answer (Vira, 2026-08-08).
          for (const e of viewRefusals(cfg)) {
            err(`mapConfigs.${act}.${e.key}`, e.msg);
          }
        }
      }
    }
  }

  if (b.sfx != null) validateSfxRecipes(b.sfx, 'sfx', vctx);
  if (b.music != null) validateMusicBeds(b.music, 'music', vctx);

  // ---- entity-specific cross checks ----------------------------------------
  for (const card of b.cards || []) {
    const path = `cards.${card.id}`;
    if (typeof card.class === 'string' && card.class !== 'colorless' && !ids.classes.has(card.class)) {
      err(`${path}.class`, `class '${card.class}' is neither a class id nor 'colorless'`);
    }
    validateCardTemplates(card, path, err);
  }

  for (const relic of b.relics || []) {
    validateRelicTemplate(relic, `relics.${relic.id}`, err);
    const poiseAdd = relic && relic.passives && relic.passives.poiseThresholdAdd;
    if (poiseAdd != null && (!Number.isFinite(poiseAdd) || !Number.isInteger(poiseAdd) || poiseAdd < 0)) {
      err(`relics.${relic.id}.passives.poiseThresholdAdd`, `must be a finite non-negative integer, got ${JSON.stringify(poiseAdd)}`);
    }
  }

  // ---- threshold-proc second layer (#61): meaning, not shape ---------------
  // Every red names its row and, for tag errors, lists the legal tags — a
  // wrong tag teaches the vocabulary instead of just refusing (silence-word
  // standard).
  //
  // finitePositive is the SHARED gate for every numeric knob in this layer
  // (Vira's gate finding 1 — the recurring class: `typeof x === 'number' &&
  // x > 0` waves Infinity through, and Infinity validates green then
  // multiplies damage at play). One helper, every site, instead of a fourth
  // hand-written patch.
  const finitePositive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  const finitePositiveInt = (v) => Number.isInteger(v) && v > 0; // isInteger already rejects ±Infinity/NaN
  const finitePercent = (v) => finitePositive(v) && v <= 100;
  for (const st of b.statuses || []) {
    const path = `statuses.${st.id}`;
    if (st.proc) {
      const p = st.proc;
      if (!finitePositiveInt(p.threshold)) {
        err(`${path}.proc.threshold`, `threshold must be a finite integer > 0, got ${JSON.stringify(p.threshold)}`);
      }
      if (!finitePercent(p.burstPercent)) {
        err(`${path}.proc.burstPercent`, `burstPercent must be a finite number in (0, 100], got ${JSON.stringify(p.burstPercent)}`);
      }
      // The burst band is a damage floor/ceiling: negatives validate a proc
      // that fires and silently no-ops (loseHp clamps at 0) — a dead row in
      // burst clothing (Vira's finding 1, second half).
      if (!(Number.isInteger(p.burstMin) && p.burstMin >= 0)) {
        err(`${path}.proc.burstMin`, `burstMin must be a finite integer ≥ 0, got ${JSON.stringify(p.burstMin)}`);
      }
      if (!finitePositiveInt(p.burstMax)) {
        err(`${path}.proc.burstMax`, `burstMax must be a finite integer > 0 — a 0-or-negative cap is a proc that silently no-ops, got ${JSON.stringify(p.burstMax)}`);
      }
      if (Number.isInteger(p.burstMin) && Number.isInteger(p.burstMax) && p.burstMin > p.burstMax) {
        err(`${path}.proc`, `burstMin ${p.burstMin} exceeds burstMax ${p.burstMax}`);
      }
      if (p.poiseDamage != null && !(Number.isInteger(p.poiseDamage) && p.poiseDamage >= 0)) {
        err(`${path}.proc.poiseDamage`, `poiseDamage must be an integer ≥ 0, got ${JSON.stringify(p.poiseDamage)}`);
      }
      if (p.resistance) {
        for (const tag of p.resistance.tags || []) {
          if (!CREATURE_TAGS.includes(tag)) {
            err(`${path}.proc.resistance.tags`, `unknown creature tag '${tag}' (legal: ${CREATURE_TAGS.join(', ')})`);
          }
        }
        // Empty tag list = a resistance the proc can never grant — same dead
        // shape as an empty taggedVulnerability list, held to the same red
        // (Vira's finding 3: one screen, one rule).
        if (!(p.resistance.tags || []).length) {
          err(`${path}.proc.resistance.tags`, 'tag list must be non-empty — a resistance no creature tag can trigger is a dead row; omit resistance instead');
        }
        const resistDef = (b.statuses || []).find((s) => s && s.id === p.resistance.status);
        if (resistDef && !resistDef.resists) {
          err(`${path}.proc.resistance.status`, `'${p.resistance.status}' has no resists block — a proc's resistance status must declare what it resists`);
        }
      }
    }
    if (st.resists) {
      if (!finitePercent(st.resists.percent)) {
        err(`${path}.resists.percent`, `resist percent must be a finite number in (0, 100], got ${JSON.stringify(st.resists.percent)}`);
      }
      // Reverse-direction check (Vira's finding 2): a resist row naming a
      // status that never procs is consulted by nobody — dead, silently.
      const resisted = (b.statuses || []).find((s) => s && s.id === st.resists.status);
      if (resisted && !resisted.proc) {
        err(`${path}.resists.status`, `'${st.resists.status}' is not a threshold-proc status — this resist row would never be consulted`);
      }
      if (!(st.decay && typeof st.decay === 'object' && Number.isInteger(st.decay.duration) && st.decay.duration > 0)) {
        err(`${path}.decay`, `a resist row needs decay {duration: int > 0} — its duration is a table knob, got ${JSON.stringify(st.decay)}`);
      }
    }
    if (st.taggedVulnerability) {
      const tv = st.taggedVulnerability;
      for (const tag of tv.tags || []) {
        if (!tagIds.has(tag)) {
          err(`${path}.taggedVulnerability.tags`, `unknown effect tag '${tag}' (legal: ${[...tagIds].join(', ')})`);
        }
      }
      if (!finitePositive(tv.mult)) {
        err(`${path}.taggedVulnerability.mult`, `mult must be a finite number > 0, got ${JSON.stringify(tv.mult)}`);
      }
      if (!(tv.tags || []).length) {
        err(`${path}.taggedVulnerability.tags`, 'tag list must be non-empty — an unscoped extra vulnerability is plain Vulnerable, use modifiers instead');
      }
    }
  }

  for (const enemy of b.enemies || []) {
    const path = `enemies.${enemy.id}`;
    for (const tag of enemy.tags || []) {
      if (!CREATURE_TAGS.includes(tag)) {
        err(`${path}.tags`, `unknown creature tag '${tag}' (legal: ${CREATURE_TAGS.join(', ')})`);
      }
    }
    const moveIds = new Set(Object.keys(enemy.moves || {}));
    if (enemy.firstMove != null && !moveIds.has(enemy.firstMove)) {
      err(`${path}.firstMove`, `firstMove '${enemy.firstMove}' is not one of this enemy's moves`);
    }
    for (const [pi, phase] of (enemy.phases || []).entries()) {
      for (const mv of phase.unlockMoves || []) {
        if (!moveIds.has(mv)) err(`${path}.phases[${pi}].unlockMoves`, `unlockMoves '${mv}' is not one of this enemy's moves`);
      }
      if (phase.on === 'hpBelowPct' && typeof phase.pct !== 'number') {
        err(`${path}.phases[${pi}]`, "phases with on:'hpBelowPct' require a numeric pct");
      }
    }
  }

  // ---- scripts budget (SPEC §3.1(6), §3.14(5)) -----------------------------
  const scriptUsers = [];
  let totalObjects = 0;
  for (const type of REGISTRY_TYPES) {
    for (const def of b[type] || []) {
      totalObjects++;
      if (usesScript(def)) scriptUsers.push(`${type}.${def.id}`);
    }
  }
  const scriptPct = totalObjects === 0 ? 0 : (scriptUsers.length / totalObjects) * 100;
  if (scriptPct >= 5) {
    err('scripts', `scripts budget exceeded: ${scriptUsers.length}/${totalObjects} content objects (${scriptPct.toFixed(1)}%) use scripts (must stay < 5%). Users: ${scriptUsers.join(', ')}`);
  }
  const scriptReport = {
    count: scriptUsers.length,
    total: totalObjects,
    pct: scriptPct,
    users: scriptUsers,
  };

  return { ok: errors.length === 0, errors, scriptReport };
}

// ---------------------------------------------------------------------------
// SFX recipes (#46) — shape via the layer schemas, meaning via the ramp checks
// ---------------------------------------------------------------------------

/**
 * A recipe is a non-empty array of layers; a layer is discriminated on `kind`
 * FIRST so an error names the field that is wrong, not "matched no variant".
 * The second layer here is meaning, not shape: WebAudio's exponential ramps
 * throw on a target of 0 or below, so a freq/peak/dur a schema would accept
 * as "a number" can still be a sound that dies at play time. Both layers
 * report through `err`, so bad data fails loud and NAMES THE RECIPE
 * (Law 1 clause 5) — at boot via main.js's banner, and in tests.
 */
function validateSfxRecipes(sfx, path, vctx) {
  const { err } = vctx;
  if (!isPlainObject(sfx)) {
    err(path, `Expected an object map of recipe ids, got ${describe(sfx)}`);
    return;
  }
  if (sfx.default === undefined) {
    err(`${path}.default`, "Missing 'default' recipe — the audible fallback for an id with no entry");
  }
  for (const id of Object.keys(sfx)) {
    const p = `${path}.${id}`;
    const layers = sfx[id];
    if (!Array.isArray(layers) || layers.length === 0) {
      err(p, `Recipe must be a non-empty array of layers, got ${Array.isArray(layers) ? 'empty array' : describe(layers)}`);
      continue;
    }
    layers.forEach((layer, i) => {
      const lp = `${p}[${i}]`;
      if (!isPlainObject(layer)) {
        err(lp, `Layer must be an object, got ${describe(layer)}`);
        return;
      }
      if (!SFX_LAYER_KINDS.includes(layer.kind)) {
        err(`${lp}.kind`, `Unknown layer kind '${layer.kind}' (closed set: ${SFX_LAYER_KINDS.join(', ')})`);
        return;
      }
      walkSchema(layer, SFX_LAYER_SCHEMAS[layer.kind], lp, vctx);
      // Meaning: values the engine's ramps would throw on or render as
      // silence. Finite is part of the claim, not a nicety — Infinity is
      // typeof 'number', slides past the schema, and is exactly the class
      // this comment promises to reject (Vira's gate finding on #46: the
      // first version checked > 0 only, and Infinity > 0 is true).
      for (const f of ['freq', 'to', 'dur', 'peak', 'hp', 'lp']) {
        if (typeof layer[f] === 'number' && !(Number.isFinite(layer[f]) && layer[f] > 0)) {
          err(`${lp}.${f}`, `'${f}' must be a finite number > 0, got ${layer[f]} (WebAudio's exponential ramps throw on 0 and on non-finite targets)`);
        }
      }
      if (typeof layer.t0 === 'number' && !(Number.isFinite(layer.t0) && layer.t0 >= 0)) {
        err(`${lp}.t0`, `'t0' must be a finite number >= 0, got ${layer.t0}`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Music beds + the silence word (word 3; Sunna's lift condition)
// ---------------------------------------------------------------------------

/**
 * A context's bed value is either a bed object or the exact word 'silence'
 * (MUSIC_SILENCE_WORD) — deliberate quiet a human typed on purpose. Everything
 * that LOOKS like quiet but wasn't typed as the word is a distinct, named
 * error: null, [], {}, a wrong or miscased word, a zero gain. That is the
 * whole point of the word — quiet-by-intent is never confusable with
 * quiet-by-bug, at boot (main.js banner) and in tests.
 */
function validateMusicBeds(music, path, vctx) {
  const { err } = vctx;
  if (!isPlainObject(music)) {
    err(path, `Expected { scales, beds }, got ${describe(music)}`);
    return;
  }
  for (const key of Object.keys(music)) {
    if (key !== 'scales' && key !== 'beds') err(`${path}.${key}`, `Unknown field '${key}'`);
  }
  const scales = music.scales;
  const scaleIds = new Set();
  if (!isPlainObject(scales)) {
    err(`${path}.scales`, `Expected an object map of scales, got ${describe(scales)}`);
  } else {
    for (const id of Object.keys(scales)) {
      const s = scales[id];
      if (!Array.isArray(s) || s.length === 0) {
        err(`${path}.scales.${id}`, `Scale must be a non-empty array of semitone offsets, got ${Array.isArray(s) ? 'empty array' : describe(s)}`);
        continue;
      }
      scaleIds.add(id);
      s.forEach((v, i) => {
        if (typeof v !== 'number' || !Number.isFinite(v)) err(`${path}.scales.${id}[${i}]`, `Expected finite number, got ${describe(v)}`);
      });
    }
  }
  const beds = music.beds;
  if (!isPlainObject(beds)) {
    err(`${path}.beds`, `Expected an object map of context beds, got ${describe(beds)}`);
    return;
  }
  for (const context of Object.keys(beds)) {
    const p = `${path}.beds.${context}`;
    const bed = beds[context];
    if (bed === MUSIC_SILENCE_WORD) continue; // deliberate quiet, spelled on purpose
    if (bed === null) {
      err(p, `null is not silence — deliberate quiet is spelled '${MUSIC_SILENCE_WORD}'; a null bed is a mistake, not a decision`);
      continue;
    }
    if (typeof bed === 'string') {
      err(p, `The only word for deliberate quiet is '${MUSIC_SILENCE_WORD}' (exact, lowercase), got '${bed}'`);
      continue;
    }
    if (Array.isArray(bed)) {
      err(p, `An array is not a bed and not silence — a bed is an object, deliberate quiet is '${MUSIC_SILENCE_WORD}'`);
      continue;
    }
    walkSchema(bed, MUSIC_BED_SCHEMA, p, vctx);
    if (!isPlainObject(bed)) continue;
    // Meaning: quiet spelled as numbers, and refs the schema cannot see.
    if (typeof bed.gain === 'number' && !(Number.isFinite(bed.gain) && bed.gain > 0)) {
      err(`${p}.gain`, `'gain' must be a finite number > 0, got ${bed.gain} — a zero gain is silence spelled as a number; deliberate quiet is the word '${MUSIC_SILENCE_WORD}'`);
    }
    if (Array.isArray(bed.variants)) {
      if (bed.variants.length === 0) err(`${p}.variants`, `'variants' must be non-empty — a bed with nothing to play is silence by accident; deliberate quiet is '${MUSIC_SILENCE_WORD}'`);
      bed.variants.forEach((v, i) => {
        if (!isPlainObject(v)) return; // schema pass reported it
        for (const f of ['root', 'cadence']) {
          if (typeof v[f] === 'number' && !(Number.isFinite(v[f]) && v[f] > 0)) {
            err(`${p}.variants[${i}].${f}`, `'${f}' must be a finite number > 0, got ${v[f]}`);
          }
        }
        // Vira's gate finding on word 3: 'lift' was missing from this sweep,
        // and a validator-green `lift: Infinity` or `lift: -3` crashed the
        // music loop per note (NaN / negative scale index → non-finite
        // oscillator frequency). Integer, not just finite-positive: the
        // stride INDEXES the scale, and a fractional stride reads
        // scale[4.5] — the same NaN wearing a friendlier number.
        if (typeof v.lift === 'number' && !(Number.isInteger(v.lift) && v.lift > 0)) {
          err(`${p}.variants[${i}].lift`, `'lift' must be a positive integer, got ${v.lift} — the melodic stride indexes the scale, and a negative, fractional, or non-finite stride reads notes that do not exist`);
        }
        if (typeof v.scale === 'string' && !scaleIds.has(v.scale)) {
          err(`${p}.variants[${i}].scale`, `Dangling reference: unknown scale '${v.scale}'`);
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Schema walker
// ---------------------------------------------------------------------------

function walkSchema(value, node, path, vctx) {
  const { err } = vctx;
  if (!node) {
    err(path, 'Internal: missing schema node');
    return;
  }
  switch (node.k) {
    case 'any':
      return;
    case 'str':
      if (typeof value !== 'string') err(path, `Expected string, got ${describe(value)}`);
      return;
    case 'num':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        err(path, `Expected number, got ${describe(value)}`);
      } else if (node.int && !Number.isInteger(value)) {
        err(path, `Expected integer, got ${value}`);
      }
      return;
    case 'bool':
      if (typeof value !== 'boolean') err(path, `Expected boolean, got ${describe(value)}`);
      return;
    case 'enum':
      if (!node.values.includes(value)) {
        err(path, `Expected one of [${node.values.join(', ')}], got ${describe(value)}`);
      }
      return;
    case 'arr':
      if (!Array.isArray(value)) {
        err(path, `Expected array, got ${describe(value)}`);
        return;
      }
      if (node.len != null && value.length !== node.len) {
        err(path, `Expected array of length ${node.len}, got ${value.length}`);
      }
      value.forEach((v, i) => walkSchema(v, node.of, `${path}[${i}]`, vctx));
      return;
    case 'map':
      if (!isPlainObject(value)) {
        err(path, `Expected object map, got ${describe(value)}`);
        return;
      }
      for (const key of Object.keys(value)) walkSchema(value[key], node.of, `${path}.${key}`, vctx);
      return;
    case 'obj': {
      if (!isPlainObject(value)) {
        err(path, `Expected object, got ${describe(value)}`);
        return;
      }
      for (const key of Object.keys(value)) {
        if (!(key in node.fields)) err(`${path}.${key}`, `Unknown field '${key}'`);
      }
      for (const [key, fieldNode] of Object.entries(node.fields)) {
        if (value[key] === undefined) {
          if (!fieldNode.opt) err(`${path}.${key}`, `Missing required field '${key}'`);
          continue;
        }
        walkSchema(value[key], fieldNode, `${path}.${key}`, vctx);
      }
      return;
    }
    case 'union': {
      // Accept if any branch matches without producing errors.
      for (const branch of node.anyOf) {
        const probeErrors = [];
        const probe = { ids: vctx.ids, err: (p, m) => probeErrors.push({ p, m }) };
        walkSchema(value, branch, path, probe);
        if (probeErrors.length === 0) return;
      }
      err(path, `Value ${describe(value)} matched no allowed variant`);
      return;
    }
    case 'ref':
      if (typeof value !== 'string') {
        err(path, `Expected ${node.reg} id string, got ${describe(value)}`);
      } else if (!vctx.ids[node.reg] || !vctx.ids[node.reg].has(value)) {
        err(path, `Dangling reference: unknown ${node.reg} id '${value}'`);
      }
      return;
    case 'effects':
      validateEffects(value, path, vctx);
      return;
    case 'triggers':
      validateTriggers(value, path, vctx);
      return;
    case 'predicate':
      validatePredicate(value, path, vctx);
      return;
    case 'formulaOrNum':
      validateFormula(value, path, vctx);
      return;
    default:
      err(path, `Internal: unknown schema kind '${node.k}'`);
  }
}

function describe(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined'; // JSON.stringify(undefined) is undefined — 'undefined undefined' otherwise
  if (Array.isArray(v)) return 'array';
  // NaN and ±Infinity JSON.stringify to "null", so without this branch a NaN
  // red printed the riddle "Expected number, got number null" (Vira, #46).
  if (typeof v === 'number' && !Number.isFinite(v)) return `number ${String(v)}`;
  return typeof v === 'object' ? 'object' : `${typeof v} ${JSON.stringify(v)}`;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Effects / triggers / predicates / formulas (closed-set checks)
// ---------------------------------------------------------------------------

const COMMON_EFFECT_FIELDS = ['op', 'target', 'amount', 'if', 'repeat'];

export function validateEffects(effects, path, vctx) {
  const { err } = vctx;
  if (!Array.isArray(effects)) {
    err(path, `Expected effects array, got ${describe(effects)}`);
    return;
  }
  effects.forEach((eff, i) => {
    const p = `${path}[${i}]`;
    if (!isPlainObject(eff)) {
      err(p, `Effect must be an object, got ${describe(eff)}`);
      return;
    }
    // Budgeted escape hatch: { script: 'name', ...args } (SPEC §3.1(6)).
    if (typeof eff.script === 'string') {
      if (!vctx.ids.scripts.has(eff.script)) err(`${p}.script`, `Dangling reference: unknown script '${eff.script}'`);
      return;
    }
    if (typeof eff.op !== 'string') {
      err(p, 'Effect missing op');
      return;
    }
    if (!OPCODES.includes(eff.op)) {
      err(p, `Unknown opcode '${eff.op}' (closed set, SPEC §3.4)`);
      return;
    }
    const spec = EFFECT_SPECS[eff.op];
    const allowed = new Set([...COMMON_EFFECT_FIELDS, ...spec.allowed]);
    for (const key of Object.keys(eff)) {
      if (!allowed.has(key)) err(`${p}.${key}`, `Unknown field '${key}' on opcode '${eff.op}'`);
    }
    for (const req of spec.required) {
      if (eff[req] === undefined) err(p, `Opcode '${eff.op}' missing required field '${req}'`);
    }
    if (eff.target !== undefined && !TARGETS.includes(eff.target)) {
      err(`${p}.target`, `Unknown target '${eff.target}' (closed set: ${TARGETS.join(', ')})`);
    }
    for (const numeric of ['amount', 'stacks', 'hits', 'pct', 'count', 'repeat']) {
      if (eff[numeric] !== undefined) validateFormula(eff[numeric], `${p}.${numeric}`, vctx);
    }
    if (eff.if !== undefined) validatePredicate(eff.if, `${p}.if`, vctx);
    for (const [field, reg] of Object.entries(spec.refs)) {
      const v = eff[field];
      if (typeof v === 'string' && !vctx.ids[reg].has(v)) {
        err(`${p}.${field}`, `Dangling reference: unknown ${reg} id '${v}'`);
      }
    }
    if (eff.op === 'damage' && eff.tags !== undefined) {
      if (!Array.isArray(eff.tags) || !eff.tags.length) {
        err(`${p}.tags`, 'damage tags must be a non-empty array of effect-tag ids');
      } else {
        for (const tag of eff.tags) {
          if (!vctx.tagIds.has(tag)) {
            err(`${p}.tags`, `unknown effect tag '${tag}' (legal: ${[...vctx.tagIds].join(', ')})`);
          }
        }
      }
    }
    if (eff.op === 'stagger' && ['self', 'player', 'owner', 'ally'].includes(eff.target)) {
      err(`${p}.target`, `stagger targets enemies only, got '${eff.target}'`);
    }
    if (eff.op === 'addFlaskCapacity') {
      if (!['hp', 'mana'].includes(eff.kind)) err(`${p}.kind`, `must be 'hp' or 'mana'`);
      if (!Number.isInteger(eff.amount) || eff.amount <= 0) err(`${p}.amount`, 'must be a positive integer');
    }
    if (eff.op === 'addCard') {
      // PILES / PILE_POSITIONS, not the same words typed again. Both sets were
      // declared closed in schemas.js and read by NOBODY, while these two lines
      // re-typed them as literals and did the actual refusing — the vocabulary
      // an author would edit was decoration, the copy nobody would think to edit
      // was the law. The legal values in the message come off the set too, so a
      // new pile cannot be legal and unmentioned.
      if (eff.pile !== undefined && !PILES.includes(eff.pile)) {
        err(`${p}.pile`, `Unknown pile '${eff.pile}' (legal: ${PILES.join(', ')})`);
      }
      if (eff.position !== undefined && !PILE_POSITIONS.includes(eff.position)) {
        err(`${p}.position`, `Unknown position '${eff.position}' (legal: ${PILE_POSITIONS.join(', ')})`);
      }
    }
  });
}

const TRIGGER_FIELDS = new Set(['on', 'if', 'do', 'once', 'limitPerTurn']);

export function validateTriggers(triggers, path, vctx) {
  const { err } = vctx;
  if (!Array.isArray(triggers)) {
    err(path, `Expected triggers array, got ${describe(triggers)}`);
    return;
  }
  triggers.forEach((trig, i) => {
    const p = `${path}[${i}]`;
    if (!isPlainObject(trig)) {
      err(p, `Trigger must be an object, got ${describe(trig)}`);
      return;
    }
    for (const key of Object.keys(trig)) {
      if (!TRIGGER_FIELDS.has(key)) err(`${p}.${key}`, `Unknown trigger field '${key}'`);
    }
    if (!TRIGGER_EVENTS.includes(trig.on)) {
      err(`${p}.on`, `Unknown trigger event '${trig.on}' (closed set, SPEC §3.10)`);
    }
    if (trig.if !== undefined) validatePredicate(trig.if, `${p}.if`, vctx);
    if (trig.once !== undefined && typeof trig.once !== 'boolean') err(`${p}.once`, 'once must be boolean');
    if (trig.limitPerTurn !== undefined && !Number.isInteger(trig.limitPerTurn)) {
      err(`${p}.limitPerTurn`, 'limitPerTurn must be an integer');
    }
    validateEffects(trig.do, `${p}.do`, vctx);
  });
}

const PREDICATE_FIELDS = {
  inStance: ['stance'],
  hasStatus: ['of', 'status', 'atLeast'],
  hasBlock: ['of'],
  hpBelowPct: ['of', 'pct'],
  firstCardThisTurn: [],
  firstAttackThisCombat: [],
  cardTypeIs: ['type'],
  everyNthCardThisCombat: ['n'],
  random: ['pct'],
  eventIsAttack: [],
  eventSourceIsOwner: [],
  eventTargetIsOwner: [],
  eventStatusIs: ['status'],
  all: ['preds'],
  any: ['preds'],
  not: ['pred'],
};

export function validatePredicate(pred, path, vctx) {
  const { err } = vctx;
  if (!isPlainObject(pred) || typeof pred.p !== 'string') {
    err(path, `Predicate must be an object with a 'p' field, got ${describe(pred)}`);
    return;
  }
  if (!PREDICATES.includes(pred.p)) {
    err(path, `Unknown predicate '${pred.p}' (closed set, SPEC §3.6)`);
    return;
  }
  const allowed = new Set(['p', ...PREDICATE_FIELDS[pred.p]]);
  for (const key of Object.keys(pred)) {
    if (!allowed.has(key)) err(`${path}.${key}`, `Unknown field '${key}' on predicate '${pred.p}'`);
  }
  const PRED_OF = ['self', 'owner', 'player', 'enemy', 'target'];
  if (pred.of !== undefined && !PRED_OF.includes(pred.of)) {
    err(`${path}.of`, `Unknown entity ref '${pred.of}' (allowed: ${PRED_OF.join(', ')})`);
  }
  switch (pred.p) {
    case 'inStance':
      if (typeof pred.stance !== 'string' || !vctx.ids.stances.has(pred.stance)) {
        err(`${path}.stance`, `Dangling reference: unknown stance id '${pred.stance}'`);
      }
      break;
    case 'hasStatus':
    case 'eventStatusIs':
      if (typeof pred.status !== 'string' || !vctx.ids.statuses.has(pred.status)) {
        err(`${path}.status`, `Dangling reference: unknown status id '${pred.status}'`);
      }
      break;
    case 'cardTypeIs':
      if (!CARD_TYPES.includes(pred.type)) err(`${path}.type`, `Unknown card type '${pred.type}'`);
      break;
    case 'everyNthCardThisCombat':
      if (!Number.isInteger(pred.n) || pred.n < 1) err(`${path}.n`, 'n must be a positive integer');
      break;
    case 'random':
      if (typeof pred.pct !== 'number') err(`${path}.pct`, 'pct must be a number');
      break;
    case 'all':
    case 'any':
      if (!Array.isArray(pred.preds)) err(`${path}.preds`, `'${pred.p}' requires a preds array`);
      else pred.preds.forEach((sub, i) => validatePredicate(sub, `${path}.preds[${i}]`, vctx));
      break;
    case 'not':
      validatePredicate(pred.pred, `${path}.pred`, vctx);
      break;
    default:
      break;
  }
}

const FORMULA_FIELDS = {
  add: ['args'],
  mul: ['args'],
  percentMaxHp: ['of', 'pct', 'min', 'max'],
  missingHp: ['of', 'min', 'max'],
  stacks: ['status', 'of', 'per', 'min', 'max'],
  energySpent: ['per', 'min', 'max'],
  blockOf: ['of', 'min', 'max'],
  hpOf: ['of', 'min', 'max'],
  cardsPlayedThisTurn: ['per', 'min', 'max'],
};

export function validateFormula(value, path, vctx) {
  const { err } = vctx;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) err(path, 'Formula literal is NaN');
    return;
  }
  if (!isFormula(value)) {
    err(path, `Expected number or formula object, got ${describe(value)}`);
    return;
  }
  if (!FORMULA_OPS.includes(value.f)) {
    err(path, `Unknown formula op '${value.f}' (closed set, SPEC §3.5)`);
    return;
  }
  const allowed = new Set(['f', ...FORMULA_FIELDS[value.f]]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) err(`${path}.${key}`, `Unknown field '${key}' on formula '${value.f}'`);
  }
  if (value.of !== undefined && !FORMULA_OF.includes(value.of)) {
    err(`${path}.of`, `Unknown entity ref '${value.of}' (allowed: ${FORMULA_OF.join(', ')})`);
  }
  if (value.f === 'add' || value.f === 'mul') {
    if (!Array.isArray(value.args)) err(`${path}.args`, `'${value.f}' requires an args array`);
    else value.args.forEach((a, i) => validateFormula(a, `${path}.args[${i}]`, vctx));
  }
  if (value.f === 'stacks') {
    if (typeof value.status !== 'string' || !vctx.ids.statuses.has(value.status)) {
      err(`${path}.status`, `Dangling reference: unknown status id '${value.status}'`);
    }
    if (value.of === undefined) err(`${path}.of`, "'stacks' requires 'of'");
  }
  if (['percentMaxHp', 'missingHp', 'blockOf', 'hpOf'].includes(value.f) && value.of === undefined) {
    err(`${path}.of`, `'${value.f}' requires 'of'`);
  }
  if (value.f === 'percentMaxHp' && typeof value.pct !== 'number') {
    err(`${path}.pct`, "'percentMaxHp' requires a numeric pct");
  }
}

// ---------------------------------------------------------------------------
// Text templating (SPEC §3.13)
// ---------------------------------------------------------------------------

function checkTemplate(template, effects, path, err, extraBindings = []) {
  const bindings = [...computeTokenBindings(effects), ...extraBindings];
  const bound = new Set(bindings.map((bd) => bd.token));
  for (const token of extractTemplateTokens(template)) {
    if (!bound.has(token)) {
      err(path, `Template token '{${token}}' does not bind to any effect value`);
    }
  }
  const used = new Set(extractTemplateTokens(template));
  for (const bd of bindings) {
    if (bd.literal && (bd.required || REQUIRED_TOKEN_OPS.includes(bd.op)) && !used.has(bd.token)) {
      err(path, `Player-visible numeric effect (op '${bd.op}', token '{${bd.token}}') lacks a template token`);
    }
  }
}

function validateCardTemplates(card, path, err) {
  if (typeof card.textTemplate !== 'string' || !Array.isArray(card.effects)) return; // schema pass reports
  checkTemplate(card.textTemplate, card.effects, `${path}.textTemplate`, err);
  if (card.upgrade) {
    const upTemplate = card.upgrade.textTemplate != null ? card.upgrade.textTemplate : card.textTemplate;
    const upEffects = card.upgrade.effects != null ? card.upgrade.effects : card.effects;
    if (typeof upTemplate === 'string' && Array.isArray(upEffects)) {
      checkTemplate(upTemplate, upEffects, `${path}.upgrade.textTemplate`, err);
    }
  }
}

function validateRelicTemplate(relic, path, err) {
  if (typeof relic.textTemplate !== 'string' || !Array.isArray(relic.triggers)) return;
  const effects = [];
  for (const trig of relic.triggers) {
    if (trig && Array.isArray(trig.do)) effects.push(...trig.do);
  }
  checkTemplate(relic.textTemplate, effects, `${path}.textTemplate`, err, relicModifierTokenBindings(relic));
}

// ---------------------------------------------------------------------------
// Scripts budget helpers
// ---------------------------------------------------------------------------

function usesScript(node) {
  if (Array.isArray(node)) return node.some(usesScript);
  if (node !== null && typeof node === 'object') {
    if (typeof node.script === 'string') return true;
    return Object.values(node).some(usesScript);
  }
  return false;
}
