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
    .reduce((sum, id) => sum + (config.statusMultipliers[id] ?? 0), 0);
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

function projectCard(card, configs, tags = []) {
  const baseFace = { ...card, tags, effects: card.effects || [] };
  const upgradedFace = card.upgrade ? {
    ...card,
    ...card.upgrade,
    tags,
    effects: card.upgrade.effects ?? card.effects ?? [],
  } : null;
  const references = Object.fromEntries(VALUE_CONFIGS.map((name) => [
    name,
    numericBaseline(baseFace.effects, referenceOperation(baseFace, name))
      ?? numericBaseline(upgradedFace?.effects, referenceOperation(baseFace, name)),
  ]));
  const projected = {
    ...card,
    effects: projectEffects(baseFace, configs, references),
    ...(ratingValues(baseFace, configs) ? { cardRatingValues: ratingValues(baseFace, configs) } : {}),
  };
  if (!card.upgrade) return projected;

  projected.upgrade = {
    ...card.upgrade,
    effects: projectEffects(upgradedFace, configs, references),
    ...(ratingValues(upgradedFace, configs) ? { cardRatingValues: ratingValues(upgradedFace, configs) } : {}),
  };
  return projected;
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

  const cards = (materialized.cards || []).map((card) => (
    projectCard(card, configs, authoredCardTags(materialized, card.id))
  ));

  return {
    ...materialized,
    cards,
  };
}

function eligibleCards(bundle, configName) {
  const eligible = [];
  const has = (card, op) => [card.effects, card.upgrade?.effects]
    .some((effects) => (effects || []).some((effect) => effect.op === op));
  for (const card of bundle.cards || []) {
    const magical = cardIsMagical({ ...card, tags: authoredCardTags(bundle, card.id) });
    if (configName === 'attackCards' && card.type === 'attack' && !magical) eligible.push(card);
    if (configName === 'potencyCards' && magical && (has(card, 'damage') || has(card, 'block'))) eligible.push(card);
    if (configName === 'defenseCards' && !magical && has(card, 'block')) eligible.push(card);
    if (configName === 'poiseCards' && card.type === 'attack' && !magical) eligible.push(card);
    if (configName === 'wardCards' && card.type === 'attack' && magical) eligible.push(card);
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

export function attackCardDamageConfigProblems(bundle = {}) {
  bundle = materializeCardValueBonuses(bundle);
  const problems = [];
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
