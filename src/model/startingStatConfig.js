const PREFIX = 'gameConfig.startingStats.';
const TOTAL_MAX = 495;

// ---- ONE DRIVER FOR STARTING STATS (owner, 2026-09-20) ---------------------
//
// He had four dials for one idea: a "starting stat pool" per creation mode
// (three near-identical rows, two of them for modes no player can pick), a
// per-class attribute table in a separate tab, "Stat points per tier" filed
// under Assign points, and "Level-up value" under Progression. In his words:
// "changing class defaults and starting stats seem to be in multiple menus
// instead of having just one driver."
//
// So the pool is now TWO NUMBERS IN HIS WORDS, on the mode creation actually
// offers: how many points are AVAILABLE TO ASSIGN, and the TOTAL a character
// carries. Everything else — the per-attribute baseline, the floor, the
// ceiling, each class's preset — is derived from those two and sits under the
// same topic. The keys are unchanged (`…<modeId>.total`), so an exported
// configuration still loads.

/**
 * kitAttributeMinimums(bundle) → { [classId]: { [attributeId]: {minimum, itemId, kit} } }
 *
 * THE FLOOR THAT WAS NEVER READ, and the root cause of "the new game assign
 * and standard loadout don't seem to change on a new game despite having the
 * values change in the settings". `validateContent` refuses a preset that
 * cannot hold the kit its class starts in (validate.js, "the preset cannot
 * hold the kit it starts in"), but the pool row's domain knew nothing about
 * equipment: setting the pool to 8 scaled every preset down to 1–2, the whole
 * configured bundle failed validation, and `rebuildRegistries` fell back to
 * AUTHORED DEFAULTS — silently dropping every other value he had tuned.
 *
 * Reading the same table the validator reads is what lets the dial be bounded
 * at entry and the redistribution keep each class wearing its own kit.
 */
export function kitAttributeMinimums(bundle) {
  const kits = bundle?.equipment?.startingKits || [];
  const requirements = bundle?.equipment?.equipmentRequirements || [];
  const byClass = {};
  for (const kit of kits) {
    if (!kit?.baseline || !kit.classId) continue;
    const need = byClass[kit.classId] ||= {};
    for (const itemId of [kit.rightHand, kit.leftHand].filter(Boolean)) {
      for (const row of requirements) {
        if (row?.itemId !== itemId || !Number.isInteger(row.minimum)) continue;
        if (!need[row.attributeId] || need[row.attributeId].minimum < row.minimum) {
          need[row.attributeId] = { minimum: row.minimum, itemId, kit: kit.label || kit.id };
        }
      }
    }
  }
  return byClass;
}

/** The kit minimum for one class/attribute, as a plain number (0 when free). */
export function kitMinimum(needs, classId, attributeId) {
  return needs?.[classId]?.[attributeId]?.minimum || 0;
}

/**
 * startingStatBounds(bundle, modeId) → { min, max }
 *
 * The lowest total a character can carry and still put on the kit its class
 * starts in. validate.js applies the kit rule to the DEFAULT mode only, so the
 * retired modes keep the bare "one point per attribute" floor they always had.
 */
export function startingStatBounds(bundle, modeId) {
  const ids = (bundle.attributes || []).map((attribute) => attribute.id);
  let min = ids.length;
  let because = null;
  if (modeId === bundle.attributeRules?.defaultMode) {
    for (const [classId, need] of Object.entries(kitAttributeMinimums(bundle))) {
      const floor = ids.reduce((sum, id) => sum + Math.max(1, need[id]?.minimum || 0), 0);
      if (floor <= min) continue;
      min = floor;
      because = { classId, need };
    }
  }
  return { min, max: TOTAL_MAX, because };
}

/** One sentence naming the class and kit that set the floor, or ''. */
function floorSentence(bundle, bounds) {
  if (!bounds.because) return '';
  const className = (bundle.classes || []).find((row) => row.id === bounds.because.classId)?.name || bounds.because.classId;
  const labels = Object.fromEntries((bundle.attributes || []).map((row) => [row.id, row.label || row.id]));
  const asks = Object.entries(bounds.because.need).map(([id, entry]) => `${entry.minimum} ${labels[id]}`).join(' and ');
  const kit = Object.values(bounds.because.need)[0]?.kit || 'starting kit';
  return ` ${bounds.min} is the least a character can carry: the ${className}'s ${kit} kit asks ${asks}, and every other attribute needs at least 1.`;
}

/**
 * visibleCreationModes(bundle) → the modes a player can actually pick.
 *
 * `characterCreation.visibleModeIds` is what the creation screen offers, and
 * the screen resolves its one editable mode from `attributeRules.defaultMode`
 * (customize.js, #1217). A pool row for a mode nobody can choose is a dial
 * whose only reachable effect is to invalidate an old save.
 */
export function visibleCreationModes(bundle) {
  const visible = bundle.characterCreation?.visibleModeIds;
  const ids = new Set(Array.isArray(visible) && visible.length ? visible : [bundle.attributeRules?.defaultMode]);
  ids.add(bundle.attributeRules?.defaultMode);
  return (bundle.creationModes || []).filter((mode) => ids.has(mode.id));
}

export function startingStatRows(bundle) {
  const rows = [];
  const add = (key, def, label, topic, extra = {}) => rows.push({
    cat: 'Advanced', advancedGroup: 'Progression', statTopic: topic, key, def, label,
    ...(typeof def === 'number' ? { type: 'number', integer: false, step: 0.1, min: 0, max: 999 } : {}),
    ...extra,
  });
  const ids = (bundle.attributes || []).map((attribute) => attribute.id);
  const visible = new Set(visibleCreationModes(bundle).map((mode) => mode.id));
  const named = visible.size > 1;
  for (const mode of bundle.creationModes) {
    const total = mode.baseline * ids.length + mode.bonusPool;
    const bounds = startingStatBounds(bundle, mode.id);
    // A row for a retired mode keeps its KEY (an exported configuration still
    // imports) and stays off the screen (`retired`), so one concept is one
    // place. See visibleCreationModes above.
    const retired = visible.has(mode.id) ? {} : { retired: true };
    const prefix = named ? `${mode.label} — ` : '';
    add(PREFIX + mode.id + '.bonusPool', mode.bonusPool,
      `${prefix}Points available to assign`, 'Assign points', {
        integer: true, step: 1, min: 0, max: TOTAL_MAX - ids.length, ...retired,
        note: `How many of the character's points are yours to place at creation. The rest is the baseline every attribute opens at — (total − available) ÷ ${ids.length} attributes, rounded down, with any remainder joining the points you assign. Applies to a new run.`,
      });
    add(PREFIX + mode.id + '.total', total,
      `${prefix}Total points on a character`, 'Assign points', {
        integer: true, step: 1, min: bounds.min, max: bounds.max, ...retired,
        note: `Every attribute point a character carries when the climb begins, baseline plus the points assigned. Class defaults below rescale to fit.${floorSentence(bundle, bounds)} Applies to a new run.`,
      });
  }
  add(PREFIX + 'autoScale', true, 'Automatically scale stat conversions', 'Assign points', {
    note: 'On: conversion thresholds follow each mode’s pool relative to its original size. Off: use the conversion values below unchanged. Whole-number attributes can still cause rounding differences. Applies to new runs.',
  });
  for (const [id, rule] of Object.entries(bundle.derivedStatRules.rules)) {
    const label = bundle.derivedStatRules.presentation[id].faceLabel || bundle.derivedStatRules.presentation[id].label;
    for (const [field, title] of [['base', 'base amount'], ['pointsPerTier', 'stat points per increase'], ['gainPerTier', 'gain per increase']]) {
      const value = rule[field] ?? bundle.derivedStatRules.defaults[field];
      if (!Number.isFinite(value)) continue;
      add(`gameConfig.derivedStatRules.rules.${id}.${field}`, value, `${label} — ${title}`, 'Stat conversions', {
        min: field === 'pointsPerTier' ? 0.01 : 0, step: 0.01,
        configPath: ['derivedStatRules', 'rules', id, field],
        note: `Uses ${rule.sourceStat}. Automatic scaling adjusts the points required; base and gain stay unchanged.`,
      });
    }
  }
  return rows;
}

/**
 * redistribute(values, total, minimums, maximum)
 *
 * `minimums` is PER ATTRIBUTE, not one number for the row. A uniform floor is
 * what scaled the Starseer's Intelligence from 11 to 2 while its own staff
 * asked for 8 — the proportional share of a small pool is blind to what the
 * class has to wear.
 */
function redistribute(values, total, minimums, maximum) {
  const original = values.reduce((a, b) => a + b, 0);
  const ideals = values.map(v => v * total / original);
  const result = ideals.map((v, i) => Math.max(minimums[i], Math.min(maximum, Math.floor(v))));
  let remaining = total - result.reduce((a, b) => a + b, 0);
  while (remaining !== 0) {
    const direction = Math.sign(remaining);
    let best = -1;
    for (let i = 0; i < result.length; i++) {
      if (direction > 0 ? result[i] >= maximum : result[i] <= minimums[i]) continue;
      if (best < 0 || direction * (ideals[i] - result[i]) > direction * (ideals[best] - result[best])) best = i;
    }
    if (best < 0) throw new Error('Starting stat pool cannot fit the creation limits');
    result[best] += direction;
    remaining -= direction;
  }
  return result;
}

function storedTotal(settings, mode) {
  return settings[PREFIX + mode.id + '.total'];
}

function storedPool(settings, mode) {
  return settings[PREFIX + mode.id + '.bonusPool'];
}

/**
 * resolveStartingStatMode(authored, mode, settings) → the mode a new run gets,
 * plus the presets that fit it, plus what was REFUSED and why.
 *
 * Nothing here throws and nothing here mutates: a total the classes cannot
 * live in leaves the authored mode standing and reports itself, so one bad row
 * costs that row and nothing else. Before this, `redistribute` threw or the
 * bundle failed validation and `rebuildRegistries` discarded EVERY configured
 * value the owner had set.
 */
export function resolveStartingStatMode(authored, mode, settings = {}) {
  const ids = (authored.attributes || []).map((attribute) => attribute.id);
  const oldTotal = mode.baseline * ids.length + mode.bonusPool;
  const bounds = startingStatBounds(authored, mode.id);
  const refusals = [];
  const rawTotal = storedTotal(settings, mode);
  let total = oldTotal;
  if (rawTotal !== undefined && rawTotal !== null && rawTotal !== '') {
    if (Number.isInteger(rawTotal) && rawTotal >= bounds.min && rawTotal <= bounds.max) total = rawTotal;
    else refusals.push({ key: PREFIX + mode.id + '.total', value: rawTotal, bounds, kept: oldTotal });
  }
  const poolMax = total - ids.length;
  const rawPool = storedPool(settings, mode);
  let pool = Math.min(mode.bonusPool, Math.max(0, poolMax));
  if (rawPool !== undefined && rawPool !== null && rawPool !== '') {
    if (Number.isInteger(rawPool) && rawPool >= 0 && rawPool <= poolMax) pool = rawPool;
    else refusals.push({ key: PREFIX + mode.id + '.bonusPool', value: rawPool, bounds: { min: 0, max: poolMax }, kept: pool });
  }
  if (total === oldTotal && pool === mode.bonusPool) return { mode: null, presets: null, refusals };

  const needs = mode.id === authored.attributeRules?.defaultMode ? kitAttributeMinimums(authored) : {};
  const kitCeiling = Math.max(0, ...Object.values(needs).flatMap((need) => Object.values(need).map((entry) => entry.minimum)));
  const ratio = total / oldTotal;
  const baseline = Math.max(1, Math.floor((total - pool) / ids.length));
  // ONLY THE FOUR NUMBERS THIS DIAL OWNS. Spreading the authored mode would
  // alias its `equipmentProfiles` object into the configured bundle, and the
  // combat-ratings block below writes through that reference.
  const next = {
    baseline,
    bonusPool: total - baseline * ids.length,
    minimum: Math.max(1, Math.min(baseline, Math.floor(mode.minimum * ratio))),
    maximum: Math.min(bounds.max, Math.max(baseline, Math.ceil(mode.maximum * ratio), kitCeiling)),
  };
  const floor = mode.belowBaseline === 'forbid' ? Math.max(next.minimum, next.baseline) : next.minimum;
  const presets = {};
  const authoredPresets = authored.attributeRules?.presets?.[mode.id] || {};
  for (const [classId, preset] of Object.entries(authoredPresets)) {
    const minimums = ids.map((id) => Math.max(floor, kitMinimum(needs, classId, id)));
    if (minimums.reduce((a, b) => a + b, 0) > total) {
      return {
        mode: null, presets: null,
        refusals: [...refusals, {
          key: PREFIX + mode.id + '.total', value: total, bounds, kept: oldTotal,
          classId, minimum: minimums.reduce((a, b) => a + b, 0),
        }],
      };
    }
    try {
      const values = redistribute(ids.map((id) => preset[id]), total, minimums, next.maximum);
      presets[classId] = Object.fromEntries(ids.map((id, index) => [id, values[index]]));
    } catch {
      return {
        mode: null, presets: null,
        refusals: [...refusals, { key: PREFIX + mode.id + '.total', value: total, bounds, kept: oldTotal, classId }],
      };
    }
  }
  if (settings[PREFIX + 'autoScale'] !== false && ratio !== 1) next.statConversionScale = ratio;
  return { mode: next, presets, refusals };
}

export function applyStartingStatConfig(configured, authored, settings) {
  for (let index = 0; index < configured.creationModes.length; index += 1) {
    const original = authored.creationModes.find((m) => m.id === configured.creationModes[index].id);
    if (!original) continue;
    const { mode, presets } = resolveStartingStatMode(authored, original, settings);
    if (!mode) continue;
    Object.assign(configured.creationModes[index], mode);
    for (const [classId, preset] of Object.entries(presets)) {
      configured.attributeRules.presets[original.id][classId] = preset;
    }
  }
}

/**
 * startingStatPoolProblems(bundle, settings) → [{ keys, message }]
 *
 * THE SENTENCE THAT KEEPS HIM FROM CONCLUDING THE DIAL IS BROKEN. A refused
 * total used to fall back to the authored value in silence; the run then
 * started on stock numbers and every other tuned value went with it.
 */
export function startingStatPoolProblems(bundle, settings = {}) {
  const problems = [];
  const needs = kitAttributeMinimums(bundle);
  const classNames = Object.fromEntries((bundle.classes || []).map((row) => [row.id, row.name || row.id]));
  const attributeNames = Object.fromEntries((bundle.attributes || []).map((row) => [row.id, row.label || row.id]));
  for (const mode of visibleCreationModes(bundle)) {
    for (const refusal of resolveStartingStatMode(bundle, mode, settings).refusals) {
      const isTotal = refusal.key.endsWith('.total');
      const label = isTotal ? 'Total points on a character' : 'Points available to assign';
      // Two shapes, because they are two different refusals and one wording
      // for both would be a lie in one of them: a number OUTSIDE the row's
      // range, and a number inside it that no set of class tables can fit.
      const why = refusal.classId
        ? `cannot be shared out: the ${classNames[refusal.classId]}`
          + (Number.isFinite(refusal.minimum) ? ` needs at least ${refusal.minimum}` : ' cannot be fitted')
          + ` to hold ${Object.entries(needs[refusal.classId] || {}).map(([id, entry]) => `${entry.minimum} ${attributeNames[id]}`).join(' and ') || 'its starting kit'}`
          + ` for its ${(Object.values(needs[refusal.classId] || {})[0] || {}).kit || 'starting kit'}.`
        : `is outside ${refusal.bounds.min}–${refusal.bounds.max} and was refused.`
          + (isTotal ? floorSentence(bundle, refusal.bounds) : '');
      problems.push({
        keys: [refusal.key],
        message: `${label}: ${JSON.stringify(refusal.value)} ${why} The value in use is ${refusal.kept}; every other setting you changed is still applied.`,
      });
    }
  }
  return problems;
}
