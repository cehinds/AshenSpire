// src/framework/importer.js — importEveryExistingContentEntity (framework
// contract: One-shot replacement and atomic cutover).
//
// Maps the legacy content bundle into the canonical relational model WITHOUT
// inventing mechanics: every mapping below reads a mechanical field the engine
// already honors (type, cost, manaCost, keywords, damageSchool, effect
// targets), never display text or artwork (authority boundary: NEVER derive
// mechanics from display text). Legacy stable ids are preserved verbatim; the
// one exception is armour, whose legacy id is only unique per class — the
// import key is `armor.<classId>.<id>` and the original pair rides in
// explicitOverrides so save identity is untouched.
//
// Unknown ids and vocabulary members THROW by name. A silent skip here would
// be a silently-accepted unknown, which the authority boundaries forbid.

import { EQUIPMENT_CATEGORIES, EQUIPMENT_RARITIES } from './schema.js';

export class ImportError extends Error {
  constructor(message) { super(`import: ${message}`); this.name = 'ImportError'; }
}

function checkCategory(category, where) {
  if (!EQUIPMENT_CATEGORIES.includes(category)) {
    throw new ImportError(`${where}: unknown equipment category ${JSON.stringify(category)}`);
  }
  return category;
}

const CARD_TYPE_PROPERTY = Object.freeze({
  attack: 'classification.attack',
  skill: 'classification.skill',
  power: 'classification.power',
  curse: 'classification.curse',
  status: 'classification.statusCard',
});

export const KEYWORD_PROPERTY = Object.freeze({
  exhaust: 'lifecycle.exhaust',
  ethereal: 'lifecycle.ethereal',
  innate: 'lifecycle.innate',
  retain: 'lifecycle.retain',
  unplayable: 'internal.unplayable',
});

const DAMAGE_SCHOOL_PROPERTY = Object.freeze({
  physical: 'damage.physical',
  magic: 'damage.magic',
  arcane: 'damage.arcane',
});

const TARGET_PROPERTY = Object.freeze({
  self: 'targeting.self',
  enemy: 'targeting.enemy',
  allEnemies: 'targeting.allEnemies',
  randomEnemy: 'targeting.randomEnemy',
  ally: 'targeting.ally',
});

const SCALING_PROPERTY = Object.freeze({
  strength: 'scaling.strength',
  dexterity: 'scaling.dexterity',
  constitution: 'scaling.constitution',
  intelligence: 'scaling.intelligence',
  wisdom: 'scaling.wisdom',
});

const PROFILE_ROLE_PROPERTY = Object.freeze({
  attack: 'classification.strike',
  guard: 'classification.guard',
  technique: 'classification.skill',
});

// The union of the legacy rarity vocabularies ('starter'/'special'/'boss' are
// legacy pool markers) and the contract's equipment ladder, lowercased at import.
const RARITIES = Object.freeze([
  'starter', 'special', 'boss', 'uncommon',
  ...EQUIPMENT_RARITIES.map((r) => r.toLowerCase()),
]);

function mapped(table, key, what) {
  const value = table[key];
  if (!value) throw new ImportError(`unknown ${what} ${JSON.stringify(key)}`);
  return value;
}

function checkRarity(value, where) {
  const rarity = value == null || value === '' ? 'basic' : value;
  if (!RARITIES.includes(rarity)) throw new ImportError(`${where}: unknown rarity ${JSON.stringify(value)}`);
  return rarity;
}

/**
 * cardPropertyInstances(card) — the ONE mapping from a legacy card def's
 * mechanics fields (type, cost, manaCost, keywords, damageSchool, effect
 * targets) to canonical PropertyInstances. The import loop uses it for
 * authored cards; the runtime bridge uses it for RESOLVED defs (upgrades and
 * mods can change keywords, so live decisions must map the resolved def,
 * never the base row). Unknown vocabulary throws by name.
 */
export function cardPropertyInstances(card) {
  const properties = [
    { propertyId: mapped(CARD_TYPE_PROPERTY, card.type, `card ${card.id} type`), source: 'AUTHORED' },
  ];
  if (card.cost !== undefined) {
    properties.push({
      propertyId: 'cost.action',
      parameters: card.cost === 'X' ? { amount: 0, variable: true } : { amount: card.cost },
      source: 'AUTHORED',
    });
  }
  if (card.manaCost != null) {
    properties.push({ propertyId: 'cost.mana', parameters: { amount: card.manaCost }, source: 'AUTHORED' });
  }
  if (card.staminaCost != null) {
    properties.push({ propertyId: 'cost.stamina', parameters: { amount: card.staminaCost }, source: 'AUTHORED' });
  }
  for (const keyword of card.keywords || []) {
    properties.push({ propertyId: mapped(KEYWORD_PROPERTY, keyword, `card ${card.id} keyword`), source: 'AUTHORED' });
  }
  if (card.damageSchool) {
    properties.push({ propertyId: mapped(DAMAGE_SCHOOL_PROPERTY, card.damageSchool, `card ${card.id} damageSchool`), source: 'AUTHORED' });
  }
  const targets = [...new Set((card.effects || []).map((e) => e.target).filter(Boolean))].sort();
  for (const target of targets) {
    properties.push({ propertyId: mapped(TARGET_PROPERTY, target, `card ${card.id} effect target`), source: 'AUTHORED' });
  }
  // A dodge effect is the contract's utility.evasion (the framework entities
  // framework.evasiveGuard / framework.dodgeRoll author it the same way).
  if ((card.effects || []).some((e) => e.op === 'dodgeRoll')) {
    properties.push({ propertyId: 'utility.evasion', source: 'AUTHORED' });
  }
  return properties;
}

/**
 * The PURE dodge — a card whose whole action is the dodge roll (the contract's
 * framework.dodgeRoll: classification.weaponArt + utility.evasion). Its price
 * is the Weight Class's dodge cost, not the authored one; a guard that also
 * dodges (framework.evasiveGuard) keeps its authored price.
 */
export function isPureDodge(card) {
  const effects = card.effects || [];
  return effects.length > 0 && effects.every((e) => e.op === 'dodgeRoll');
}

/**
 * importLegacyContent(bundle) → {entities, terms, assets, counts, drift}
 * Pure data out; the caller merges with the authored framework rows and
 * builds registries. `drift` lists canonical-vs-legacy wording mismatches for
 * assertNoTerminologyDrift.
 */
export function importLegacyContent(bundle, { canonicalTerms = [] } = {}) {
  const entities = [];
  const terms = [];
  const assets = [];
  const termIds = new Set();
  const entityIds = new Set();

  const addTerm = (id, canonicalText, extra = {}) => {
    if (termIds.has(id)) throw new ImportError(`duplicate term id ${id}`);
    if (typeof canonicalText !== 'string' || !canonicalText) throw new ImportError(`term ${id}: empty text`);
    termIds.add(id);
    terms.push({ id, canonicalText, ...extra });
    return id;
  };

  const addEntity = (entity) => {
    if (entityIds.has(entity.id)) throw new ImportError(`duplicate stable id ${entity.id} (kind ${entity.kind})`);
    entityIds.add(entity.id);
    entities.push(entity);
    return entity;
  };

  const addAsset = (id, kind, sourcePath, fallbackAssetId) => {
    assets.push({ id, kind, sourcePath, fallbackAssetId });
    return id;
  };

  // Legacy ids are unique per pool but not across pools; entity ids must be
  // globally unique, so every import key is namespaced by kind. The legacy id
  // stays verbatim in explicitOverrides.legacyId — save identity is the
  // legacy id and is never rewritten (ALWAYS preserve stable content IDs).
  const key = (kind, id) => `${kind}.${id}`;

  // ---- cards ---------------------------------------------------------------
  for (const card of bundle.cards) {
    const id = key('card', card.id);
    const properties = cardPropertyInstances(card);
    addEntity({
      id,
      kind: 'CARD',
      nameTermId: addTerm(`term.entity.${id}.name`, card.name),
      descriptionTermId: card.textTemplate
        ? addTerm(`term.entity.${id}.text`, card.textTemplate)
        : undefined,
      properties,
      explicitOverrides: {
        legacyId: card.id,
        legacyClass: card.class,
        rarity: checkRarity(card.rarity, `card ${card.id}`),
        icon: card.icon,
        effects: card.effects,
        upgrade: card.upgrade,
        exposureBuildupPerHit: card.exposureBuildupPerHit,
      },
    });
  }

  // ---- equipment-granted basic card profiles -------------------------------
  // These ARE the equipment-bound replacement cards (framework contract:
  // Equipment contract / Deck composition): each profile row already carries
  // role, damage school and scaling stat as mechanics fields.
  for (const profile of bundle.equipment.basicCardProfiles) {
    const id = key('profile', profile.id);
    const properties = [
      { propertyId: mapped(PROFILE_ROLE_PROPERTY, profile.role, `profile ${profile.id} role`), source: 'AUTHORED' },
      { propertyId: 'equipment.bound', source: 'AUTHORED' },
      { propertyId: 'cost.action', parameters: { amount: 1 }, source: 'AUTHORED' },
    ];
    if (profile.damageSchool) {
      properties.push({ propertyId: mapped(DAMAGE_SCHOOL_PROPERTY, profile.damageSchool, `profile ${profile.id} damageSchool`), source: 'AUTHORED' });
    }
    if (profile.scalingStat) {
      properties.push({ propertyId: mapped(SCALING_PROPERTY, profile.scalingStat, `profile ${profile.id} scalingStat`), source: 'AUTHORED' });
    }
    addEntity({
      id,
      kind: 'CARD',
      nameTermId: addTerm(`term.entity.${id}.name`, profile.displayName),
      descriptionTermId: profile.flavor ? addTerm(`term.entity.${id}.text`, profile.flavor) : undefined,
      properties,
      explicitOverrides: {
        legacyId: profile.id,
        baseCardId: profile.baseCardId,
        role: profile.role,
        baseValue: profile.baseValue,
        pointsPerTier: profile.pointsPerTier,
        gainPerTier: profile.gainPerTier,
        rounding: profile.rounding,
        cap: profile.cap,
        icon: profile.icon,
        tags: profile.tags,
        compatibility: profile.compatibility,
      },
    });
  }

  // ---- armaments and armour ------------------------------------------------
  for (const piece of bundle.equipment.armaments) {
    const id = key(piece.kind, piece.id); // weapon.x / shield.x / staff.x
    addEntity({
      id,
      kind: 'EQUIPMENT',
      nameTermId: addTerm(`term.entity.${id}.name`, piece.name),
      descriptionTermId: piece.blurb ? addTerm(`term.entity.${id}.text`, piece.blurb) : undefined,
      properties: [],
      explicitOverrides: {
        legacyId: piece.id,
        category: checkCategory(piece.kind === 'shield' ? 'SHIELD' : 'WEAPON', `armament ${piece.id}`),
        hand: piece.hand,
        rarity: checkRarity(piece.rarity, `armament ${piece.id}`),
        tags: piece.tags,
        mods: piece.mods,
        requirements: piece.requirements,
        poiseThreshold: piece.poiseThreshold,
        dropWeight: piece.dropWeight,
        unlock: piece.unlock,
        artKey: piece.artKey,
        cardPackage: {
          strikeCardId: piece.attackProfile ? key('profile', piece.attackProfile) : undefined,
          guardCardId: piece.guardProfile ? key('profile', piece.guardProfile) : undefined,
          techniqueCardId: piece.techniqueProfile ? key('profile', piece.techniqueProfile) : undefined,
        },
        // Contract fields the legacy tables do not author yet — imported as
        // inert defaults, listed in the cutover report as open authoring work.
        itemWeight: 0,
        attackRatingBonus: 0,
        defenseRating: 0,
      },
    });
  }
  for (const outfit of bundle.equipment.armour) {
    const id = key('armor', `${outfit.classId}.${outfit.id}`);
    addEntity({
      id,
      kind: 'EQUIPMENT',
      nameTermId: addTerm(`term.entity.${id}.name`, outfit.name),
      properties: [],
      explicitOverrides: {
        legacyId: outfit.id,
        legacyClassId: outfit.classId,
        category: checkCategory('ARMOR', `armour ${outfit.classId}/${outfit.id}`),
        rarity: checkRarity(outfit.rarity, `armour ${outfit.classId}/${outfit.id}`),
        tags: outfit.tags,
        mods: outfit.mods,
        artKey: outfit.artKey,
        itemWeight: 0,
        defenseRating: 0,
      },
    });
  }

  // ---- statuses ------------------------------------------------------------
  for (const status of bundle.statuses) {
    const id = key('status', status.id);
    addEntity({
      id,
      kind: 'STATUS',
      nameTermId: addTerm(`term.entity.${id}.name`, status.name),
      descriptionTermId: status.tooltip ? addTerm(`term.entity.${id}.tooltip`, status.tooltip) : undefined,
      properties: [],
      explicitOverrides: {
        legacyId: status.id,
        stackMode: status.stackMode,
        decay: status.decay,
        modifiers: status.modifiers,
        hooks: status.hooks,
        icon: status.icon,
        tint: status.tint,
      },
    });
  }

  // ---- enemies -------------------------------------------------------------
  for (const enemy of bundle.enemies) {
    const id = key('enemy', enemy.id);
    addEntity({
      id,
      kind: 'ENEMY',
      nameTermId: addTerm(`term.entity.${id}.name`, enemy.name),
      properties: [],
      explicitOverrides: {
        legacyId: enemy.id,
        hp: enemy.hp,
        poiseMax: enemy.poiseMax,
        levelProfile: enemy.levelProfile,
        moves: enemy.moves,
        tags: enemy.tags,
        arcaneExposure: enemy.arcaneExposure,
        art: enemy.art,
        size: enemy.size,
      },
    });
  }

  // ---- classes -------------------------------------------------------------
  for (const klass of bundle.classes) {
    const id = key('class', klass.id);
    addEntity({
      id,
      kind: 'CLASS',
      nameTermId: addTerm(`term.entity.${id}.name`, klass.name),
      descriptionTermId: klass.description ? addTerm(`term.entity.${id}.text`, klass.description) : undefined,
      properties: [],
      explicitOverrides: {
        legacyId: klass.id,
        maxHp: klass.maxHp,
        hpPerConTier: klass.hpPerConTier,
        startingFlaskAllocation: klass.startingFlaskAllocation,
        startingRelic: klass.startingRelic,
        startingSignatureCard: klass.startingSignatureCard,
        eligibleStartingKitIds: klass.eligibleStartingKitIds,
        cardPool: klass.cardPool,
        glyph: klass.glyph,
        cardTint: klass.cardTint,
      },
    });
  }

  // ---- relics --------------------------------------------------------------
  for (const relic of bundle.relics) {
    const id = key('relic', relic.id);
    addEntity({
      id,
      kind: 'RELIC',
      nameTermId: addTerm(`term.entity.${id}.name`, relic.name),
      descriptionTermId: relic.tooltip ? addTerm(`term.entity.${id}.tooltip`, relic.tooltip) : undefined,
      properties: [],
      explicitOverrides: {
        legacyId: relic.id,
        rarity: checkRarity(relic.rarity, `relic ${relic.id}`),
        passives: relic.passives,
        triggers: relic.triggers,
        icon: relic.icon,
      },
    });
  }

  // ---- flasks (consumables) ------------------------------------------------
  for (const flask of bundle.flasks) {
    const id = key('flask', flask.id);
    const artId = flask.artAsset
      ? addAsset(`asset.entity.${id}`, 'ICON', flask.artAsset, 'asset.fallback.icon')
      : undefined;
    addEntity({
      id,
      kind: 'CONSUMABLE',
      nameTermId: addTerm(`term.entity.${id}.name`, flask.name),
      descriptionTermId: flask.textTemplate ? addTerm(`term.entity.${id}.text`, flask.textTemplate) : undefined,
      artId,
      properties: [],
      explicitOverrides: {
        legacyId: flask.id,
        rarity: checkRarity(flask.rarity, `flask ${flask.id}`),
        effects: flask.effects,
        icon: flask.icon,
        tint: flask.tint,
        artKey: flask.artKey,
      },
    });
  }

  // ---- events (map locations) ----------------------------------------------
  for (const event of bundle.events) {
    const id = key('event', event.id);
    addEntity({
      id,
      kind: 'LOCATION',
      nameTermId: addTerm(`term.entity.${id}.name`, event.name),
      properties: [],
      explicitOverrides: { legacyId: event.id, text: event.text, choices: event.choices, art: event.art },
    });
  }

  // ---- the armoury screen (UI surface) -------------------------------------
  if (bundle.equipment.armouryUi) {
    addEntity({
      id: 'uiSurface.armoury',
      kind: 'UI_SURFACE',
      nameTermId: addTerm('term.entity.uiSurface.armoury.name', 'Armoury'),
      properties: [],
      explicitOverrides: { legacyId: 'armoury', config: bundle.equipment.armouryUi },
    });
  }

  // ---- terminology drift check inputs --------------------------------------
  // Legacy keyword tooltips vs the canonical framework terms: any wording
  // mismatch is drift, reported by assertNoTerminologyDrift rather than fixed
  // silently here.
  const canonicalById = new Map(canonicalTerms.map((t) => [t.id, t]));
  const drift = [];
  const KEYWORD_TERM = { exhaust: 'term.tooltip.exhaust', ethereal: 'term.tooltip.ethereal', innate: 'term.tooltip.innate', retain: 'term.tooltip.retain', unplayable: 'term.tooltip.unplayable' };
  for (const keyword of bundle.keywords) {
    const termId = KEYWORD_TERM[keyword.id];
    if (!termId) { drift.push({ id: keyword.id, reason: 'legacy keyword with no canonical term' }); continue; }
    const canonical = canonicalById.get(termId);
    if (!canonical) drift.push({ id: keyword.id, reason: `canonical term ${termId} missing` });
    else if (canonical.canonicalText !== keyword.tooltip) {
      drift.push({ id: keyword.id, reason: `tooltip drift: legacy ${JSON.stringify(keyword.tooltip)} vs canonical ${JSON.stringify(canonical.canonicalText)}` });
    }
  }

  const counts = {};
  for (const entity of entities) counts[entity.kind] = (counts[entity.kind] || 0) + 1;

  return { entities, terms, assets, counts, drift };
}

/** The expected per-kind entity counts, derived from the bundle itself. */
export function expectedCounts(bundle) {
  return {
    CARD: bundle.cards.length + bundle.equipment.basicCardProfiles.length,
    EQUIPMENT: bundle.equipment.armaments.length + bundle.equipment.armour.length,
    STATUS: bundle.statuses.length,
    ENEMY: bundle.enemies.length,
    CLASS: bundle.classes.length,
    RELIC: bundle.relics.length,
    CONSUMABLE: bundle.flasks.length,
    LOCATION: bundle.events.length,
    UI_SURFACE: bundle.equipment.armouryUi ? 1 : 0,
  };
}
