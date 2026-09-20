const PREFIX = 'gameConfig.startingStats.';

export function startingStatRows(bundle) {
  const rows = [];
  const add = (key, def, label, topic, extra = {}) => rows.push({
    cat: 'Advanced', advancedGroup: 'Progression', statTopic: topic, key, def, label,
    ...(typeof def === 'number' ? { type: 'number', integer: false, step: 0.1, min: 0, max: 999 } : {}),
    ...extra,
  });
  add(PREFIX + 'autoScale', true, 'Automatically scale stat conversions', 'Starting values', {
    note: 'On: conversion thresholds follow each mode’s pool relative to its original size. Off: use the conversion values below unchanged. Whole-number attributes can still cause rounding differences. Applies to new runs.',
  });
  for (const mode of bundle.creationModes) {
    add(PREFIX + mode.id + '.total', mode.baseline * bundle.attributes.length + mode.bonusPool,
      `${mode.label} — starting stat pool`, 'Starting values', {
        integer: true, step: 1, min: bundle.attributes.length, max: 495,
        note: 'Total across all attributes, including the baseline. Class allocations and creation limits scale to fit this budget. Existing runs keep their saved rules.',
      });
  }
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

function redistribute(values, total, minimum, maximum) {
  const original = values.reduce((a, b) => a + b, 0);
  const ideals = values.map(v => v * total / original);
  const result = ideals.map(v => Math.max(minimum, Math.min(maximum, Math.floor(v))));
  let remaining = total - result.reduce((a, b) => a + b, 0);
  while (remaining !== 0) {
    const direction = Math.sign(remaining);
    let best = -1;
    for (let i = 0; i < result.length; i++) {
      if (direction > 0 ? result[i] >= maximum : result[i] <= minimum) continue;
      if (best < 0 || direction * (ideals[i] - result[i]) > direction * (ideals[best] - result[best])) best = i;
    }
    if (best < 0) throw new Error('Starting stat pool cannot fit the creation limits');
    result[best] += direction;
    remaining -= direction;
  }
  return result;
}

export function applyStartingStatConfig(configured, authored, settings) {
  const ids = authored.attributes.map(a => a.id);
  for (const mode of configured.creationModes) {
    const original = authored.creationModes.find(m => m.id === mode.id);
    const oldTotal = original.baseline * ids.length + original.bonusPool;
    const raw = settings[PREFIX + mode.id + '.total'];
    const total = Number.isInteger(raw) && raw >= ids.length && raw <= 495 ? raw : oldTotal;
    const ratio = total / oldTotal;
    if (total !== oldTotal) {
      mode.baseline = Math.max(1, Math.floor(original.baseline * ratio));
      mode.minimum = Math.max(1, Math.floor(original.minimum * ratio));
      mode.maximum = Math.max(mode.baseline, Math.ceil(original.maximum * ratio));
      mode.bonusPool = total - mode.baseline * ids.length;
      const floor = mode.belowBaseline === 'forbid' ? mode.baseline : mode.minimum;
      for (const [classId, preset] of Object.entries(configured.attributeRules.presets[mode.id])) {
        const values = redistribute(ids.map(id => preset[id]), total, floor, mode.maximum);
        configured.attributeRules.presets[mode.id][classId] = Object.fromEntries(ids.map((id, i) => [id, values[i]]));
      }
    }
    const scale = settings[PREFIX + 'autoScale'] === false ? 1 : ratio;
    if (scale !== 1) mode.statConversionScale = scale;
  }
}
