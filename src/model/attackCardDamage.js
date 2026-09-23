const VALUE_CONFIGS = Object.freeze([
  'attackCards',
  'defenseCards',
  'potencyCards',
  'poiseCards',
  'wardCards',
]);

function statusIds(effects = []) {
  return [...new Set(effects
    .filter((effect) => effect?.op === 'applyStatus' && typeof effect.status === 'string')
    .map((effect) => effect.status))].sort();
}

function costOf(face, key) {
  const value = face?.[key];
  if (key === 'cost' && value === 'X') return 1;
  return Number.isFinite(value) ? value : 0;
}

function addToAmount(amount, bonus) {
  if (!bonus) return amount;
  if (typeof amount === 'number') return Math.max(0, amount + bonus);
  return { f: 'add', args: [amount, bonus], min: 0 };
}

function costDerivedValue(face, config) {
  const action = costOf(face, 'cost');
  const mana = costOf(face, 'manaCost');
  const stamina = costOf(face, 'staminaCost');
  const reduction = config.statusEffectReductionMultiplier * statusIds(face?.effects)
    .reduce((sum, id) => sum + (config.statusMultipliers?.[id] ?? 0), 0);
  return Math.floor(config.globalMultiplier * (
    action * config.actionCostMultiplier
    + mana * config.manaCostMultiplier
    + stamina * config.staminaCostMultiplier
  ) - reduction);
}

/**
 * The deterministic base damage contributed by a card's three resource costs.
 * X-cost cards spend one Action per repeated hit, so their per-hit base uses
 * one Action while the existing hit formula controls how many times it lands.
 */
export function attackCardBaseDamage(face, config) {
  const cardBonus = config.cardBonuses[face?.id] ?? 0;
  return Math.max(0, costDerivedValue(face, config) + cardBonus);
}

export function cardIsMagical(face) {
  if (face?.damageSchool) return face.damageSchool !== 'physical';
  const tags = face?.cardTags || face?.tags || [];
  if (tags.some((tag) => ['magic', 'magical', 'arcane', 'holy', 'fire', 'spell']
    .includes(String(typeof tag === 'string' ? tag : tag?.id).split(':').at(-1)))) {
    return true;
  }
  return (face?.manaCost || 0) > 0;
}

function authoredCardTags(bundle, cardId) {
  return (bundle.tagging || [])
    .filter((row) => row?.family === 'card' && row.objectId === cardId)
    .map((row) => row.tagId);
}

function numericBaseline(effects, op) {
  const numeric = (effects || []).filter((effect) => effect.op === op && typeof effect.amount === 'number');
  return numeric.find((effect) => !effect.if)?.amount
    ?? (numeric.length ? Math.min(...numeric.map((effect) => effect.amount)) : null);
}

function referenceOperation(card, configName) {
  if (configName === 'attackCards') return 'damage';
  if (configName === 'defenseCards') return 'block';
  if (configName === 'potencyCards') {
    return [card.effects, card.upgrade?.effects]
      .some((effects) => (effects || []).some((effect) => effect.op === 'damage')) ? 'damage' : 'block';
  }
  return 'poiseDamage';
}

function projectOperation(face, effects, op, baseValue, authoredReference) {
  const matching = effects
    .map((effect, index) => ({ effect, index }))
    .filter(({ effect }) => effect.op === op && typeof effect.amount === 'number');
  const primary = matching.find(({ effect }) => !effect.if);
  const currentBase = numericBaseline(face.effects, op);
  const adjustedBase = addToAmount(baseValue,
    currentBase !== null && authoredReference !== null ? currentBase - authoredReference : 0);

  if (primary) {
    primary.effect.amount = adjustedBase;
    return;
  }

  if (matching.length) {
    const authoredBase = Math.min(...matching.map(({ effect }) => effect.amount));
    for (const { effect } of matching) {
      effect.amount = addToAmount(adjustedBase, effect.amount - authoredBase);
    }
    return;
  }

  // Only formula-valued amounts remain (Blight Nova, Last Stand). SPEC §3.4:
  // they stay bonus values, and the cost-derived base is added in front of
  // them — which the card's text has to say ("{block} Block plus …").
  const first = effects.find((effect) => effect.op === op);
  if (first) {
    effects.unshift({
      op,
      target: first.target,
      amount: adjustedBase,
      ...(first.tags ? { tags: [...first.tags] } : {}),
    });
  }
}

function projectEffects(face, configs, references) {
  const effects = (face.effects || []).map((effect) => ({ ...effect }));
  const magical = cardIsMagical(face);
  if (face.type === 'attack') {
    const config = magical ? configs.potencyCards : configs.attackCards;
    const name = magical ? 'potencyCards' : 'attackCards';
    projectOperation(face, effects, 'damage', attackCardBaseDamage(face, config), references[name]);
  }
  if (effects.some((effect) => effect.op === 'block')) {
    const config = magical ? configs.potencyCards : configs.defenseCards;
    const name = magical ? 'potencyCards' : 'defenseCards';
    projectOperation(face, effects, 'block', attackCardBaseDamage(face, config), references[name]);
  }
  if (face.type === 'attack' && effects.some((effect) => effect.op === 'poiseDamage')) {
    const config = magical ? configs.wardCards : configs.poiseCards;
    const name = magical ? 'wardCards' : 'poiseCards';
    projectOperation(face, effects, 'poiseDamage', attackCardBaseDamage(face, config), references[name]);
  }
  return effects;
}

function ratingValues(face, configs) {
  if (face.type !== 'attack') return undefined;
  const magical = cardIsMagical(face);
  return {
    [magical ? 'ward' : 'poise']: attackCardBaseDamage(
      face,
      magical ? configs.wardCards : configs.poiseCards,
    ),
  };
}

function projectFaces(card, configs, tags, school) {
  const withSchool = (face) => (school ? { ...face, damageSchool: school } : face);
  const baseFace = withSchool({ ...card, tags, effects: card.effects || [] });
  const upgradedFace = card.upgrade ? withSchool({
    ...card,
    ...card.upgrade,
    tags,
    effects: card.upgrade.effects ?? card.effects ?? [],
  }) : null;
  const references = Object.fromEntries(VALUE_CONFIGS.map((name) => [
    name,
    numericBaseline(baseFace.effects, referenceOperation(baseFace, name))
      ?? numericBaseline(upgradedFace?.effects, referenceOperation(baseFace, name)),
  ]));
  const face = (source) => {
    const values = ratingValues(source, configs);
    return {
      effects: projectEffects(source, configs, references),
      ...(values ? { cardRatingValues: values } : {}),
    };
  };
  return { base: face(baseFace), upgrade: upgradedFace ? face(upgradedFace) : null };
}

/**
 * The schools a basic-card profile can put a card in (`staffMagicAttack`
 * makes Strike magical). Magic-ness is all the projection reads, so one
 * representative school per side is enough.
 */
function profileSchools(bundle) {
  const schools = new Map();
  for (const profile of bundle.equipment?.basicCardProfiles || []) {
    if (!profile?.baseCardId || typeof profile.damageSchool !== 'string') continue;
    if (!schools.has(profile.baseCardId)) schools.set(profile.baseCardId, []);
    schools.get(profile.baseCardId).push(profile.damageSchool);
  }
  return schools;
}

function alternateSchool(card, tags, schools) {
  const authoredMagical = cardIsMagical({ ...card, tags });
  return (schools.get(card.id) || [])
    .find((school) => cardIsMagical({ ...card, tags, damageSchool: school }) !== authoredMagical) || null;
}

function projectCard(card, configs, tags = [], otherSchool = null) {
  const { base, upgrade } = projectFaces(card, configs, tags, null);
  const projected = { ...card, ...base };
  if (card.upgrade) projected.upgrade = { ...card.upgrade, ...upgrade };
  // A profile that moves this card across the physical/magical line resolves
  // it through the OTHER formulas (PR for damage and Block, Ward for impact);
  // registries.resolveCard swaps this face in once the resolved school is
  // known. Projecting it here keeps the result deterministic and frozen.
  if (otherSchool) {
    const other = projectFaces(card, configs, tags, otherSchool);
    projected.schoolVariant = {
      magical: cardIsMagical({ ...card, tags, damageSchool: otherSchool }),
      ...other.base,
      ...(other.upgrade ? { upgrade: other.upgrade } : {}),
    };
  }
  return projected;
}

/**
 * The card definition as it resolves in `school`: the projected face for that
 * side of the physical/magical line. A card no profile moves, or a school on
 * the side it was projected for, is returned unchanged.
 */
export function cardForSchool(def, school) {
  const variant = def?.schoolVariant;
  if (!variant || typeof school !== 'string') return def;
  if (cardIsMagical({ ...def, damageSchool: school }) !== variant.magical) return def;
  const { schoolVariant, cardRatingValues, ...rest } = def;
  const resolved = {
    ...rest,
    effects: variant.effects,
    ...(variant.cardRatingValues ? { cardRatingValues: variant.cardRatingValues } : {}),
  };
  if (def.upgrade) {
    const { cardRatingValues: upgradedValues, ...upgradeRest } = def.upgrade;
    resolved.upgrade = {
      ...upgradeRest,
      effects: variant.upgrade.effects,
      ...(variant.upgrade.cardRatingValues ? { cardRatingValues: variant.upgrade.cardRatingValues } : {}),
    };
  }
  return resolved;
}

/**
 * Apply the configured formula before registries freeze definitions. The
 * authored bundle remains unchanged, so rebuilding with another settings
 * snapshot is deterministic and cannot compound prior projections.
 */
export function projectAttackCardDamageBundle(source = {}) {
  const materialized = materializeCardValueBonuses(source);
  const configs = materialized.balance?.damage;
  for (const name of VALUE_CONFIGS) {
    if (!configs?.[name]) throw new Error(`balance.damage.${name} is required`);
  }

  const schools = profileSchools(materialized);
  const cards = (materialized.cards || []).map((card) => {
    const tags = authoredCardTags(materialized, card.id);
    return projectCard(card, configs, tags, alternateSchool(card, tags, schools));
  });

  return {
    ...materialized,
    cards,
  };
}

function eligibleCards(bundle, configName) {
  const eligible = [];
  const has = (card, op) => [card.effects, card.upgrade?.effects]
    .some((effects) => (effects || []).some((effect) => effect.op === op));
  const schools = profileSchools(bundle);
  for (const card of bundle.cards || []) {
    const tags = authoredCardTags(bundle, card.id);
    const authored = cardIsMagical({ ...card, tags });
    const other = alternateSchool(card, tags, schools);
    const sides = other ? [authored, !authored] : [authored];
    const fits = (magical) => (
      (configName === 'attackCards' && card.type === 'attack' && !magical)
      || (configName === 'potencyCards' && magical && (has(card, 'damage') || has(card, 'block')))
      || (configName === 'defenseCards' && !magical && has(card, 'block'))
      || (configName === 'poiseCards' && card.type === 'attack' && !magical)
      || (configName === 'wardCards' && card.type === 'attack' && magical)
    );
    if (sides.some(fits)) eligible.push(card);
  }
  return eligible;
}

function defaultCardBonus(bundle, row, configName, config) {
  const op = referenceOperation(row, configName);
  const baseFace = { ...row, effects: row.effects || [] };
  const upgradedFace = row.upgrade ? {
    ...row,
    ...row.upgrade,
    effects: row.upgrade.effects ?? row.effects ?? [],
  } : null;
  const face = numericBaseline(baseFace.effects, op) === null ? upgradedFace : baseFace;
  const authored = numericBaseline(face?.effects, op);
  if (authored === null) return 0;
  return authored - costDerivedValue(face, config);
}

export function materializeCardValueBonuses(source = {}) {
  const damage = source.balance?.damage;
  if (!damage) return source;
  const materializedDamage = Object.fromEntries(VALUE_CONFIGS.map((configName) => {
    const config = damage[configName] || {};
    const defaults = Object.fromEntries(eligibleCards(source, configName)
      .map((row) => [row.id, defaultCardBonus(source, row, configName, config)]));
    const statusDefaults = Object.fromEntries((source.statuses || []).map((status) => [status.id, 0]));
    return [configName, {
      ...config,
      statusMultipliers: { ...statusDefaults, ...(config.statusMultipliers || {}) },
      cardBonuses: { ...defaults, ...(config.cardBonuses || {}) },
    }];
  }));
  return {
    ...source,
    balance: { ...source.balance, damage: { ...damage, ...materializedDamage } },
  };
}

const CONTAINERS = Object.freeze({
  statusMultipliers: 'must be an object keyed by every status id',
  cardBonuses: 'must be an object keyed by every applicable card id',
});

export function attackCardDamageConfigProblems(bundle = {}) {
  const problems = [];
  // Read the containers' shape BEFORE materializing: materializing spreads
  // them over the defaults, which turns an array into an object and a null
  // into nothing, so a malformed container would pass (or, for a null, throw)
  // instead of being named. A malformed one is reported here and replaced by
  // an empty object so the rest of the checks still run.
  const raw = bundle.balance?.damage;
  if (raw && typeof raw === 'object') {
    const repaired = {};
    for (const name of VALUE_CONFIGS) {
      const config = raw[name];
      if (!config || typeof config !== 'object' || Array.isArray(config)) continue;
      for (const [key, msg] of Object.entries(CONTAINERS)) {
        const value = config[key];
        if (value === undefined || (value && typeof value === 'object' && !Array.isArray(value))) continue;
        problems.push({ path: `balance.damage.${name}.${key}`, msg });
        repaired[name] = { ...(repaired[name] || config), [key]: {} };
      }
    }
    if (Object.keys(repaired).length) {
      bundle = { ...bundle, balance: { ...bundle.balance, damage: { ...raw, ...repaired } } };
    }
  }
  bundle = materializeCardValueBonuses(bundle);
  const knownStatuses = new Set((bundle.statuses || []).map((status) => status.id));

  for (const configName of VALUE_CONFIGS) {
    const configPath = `balance.damage.${configName}`;
    const config = bundle.balance?.damage?.[configName];
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      problems.push({ path: configPath, msg: 'must be a formula configuration object' });
      continue;
    }

    for (const key of [
      'globalMultiplier',
      'actionCostMultiplier',
      'manaCostMultiplier',
      'staminaCostMultiplier',
      'statusEffectReductionMultiplier',
    ]) {
      if (!Number.isFinite(config[key]) || config[key] < 0) {
        problems.push({ path: `${configPath}.${key}`, msg: 'must be finite and non-negative' });
      }
    }

    const multipliers = config.statusMultipliers;
    if (!multipliers || typeof multipliers !== 'object' || Array.isArray(multipliers)) {
      problems.push({ path: `${configPath}.statusMultipliers`, msg: 'must be an object keyed by every status id' });
    } else {
      for (const statusId of knownStatuses) {
        if (!Number.isFinite(multipliers[statusId]) || multipliers[statusId] < 0) {
          problems.push({
            path: `${configPath}.statusMultipliers.${statusId}`,
            msg: 'must be finite and non-negative',
          });
        }
      }
      for (const statusId of Object.keys(multipliers)) {
        if (!knownStatuses.has(statusId)) {
          problems.push({ path: `${configPath}.statusMultipliers.${statusId}`, msg: `unknown status '${statusId}'` });
        }
      }
    }

    const eligible = new Set(eligibleCards(bundle, configName).map((row) => row.id));

    const bonuses = config.cardBonuses;
    if (!bonuses || typeof bonuses !== 'object' || Array.isArray(bonuses)) {
      problems.push({ path: `${configPath}.cardBonuses`, msg: 'must be an object keyed by every applicable card id' });
      continue;
    }
    for (const cardId of Object.keys(bonuses)) {
      if (!Number.isFinite(bonuses[cardId])) {
        problems.push({ path: `${configPath}.cardBonuses.${cardId}`, msg: 'must be finite' });
      } else if (!eligible.has(cardId)) {
        problems.push({ path: `${configPath}.cardBonuses.${cardId}`, msg: `unknown or inapplicable card '${cardId}'` });
      }
    }
  }
  return problems;
}
