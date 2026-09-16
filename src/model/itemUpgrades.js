// Closed, data-owned upgrade vocabulary. Content selects exact item/tier rows;
// runtime code only interprets the registered tags and never invents a delta.

export const UPGRADE_COST_TAG = 'upgrade:cost:smithing-stone';
export const UPGRADE_CARD_ROLES = Object.freeze(['attack', 'guard', 'technique']);
export const UPGRADE_CARD_EFFECTS = Object.freeze(['damage', 'block', 'draw', 'discard']);
export const UPGRADE_CARD_RESOURCES = Object.freeze(['action', 'mana', 'stamina']);
export const UPGRADE_EQUIPMENT_POISE_TAG = 'equipment:poise-threshold';
export const UPGRADE_RELIC_PASSIVE_TAGS = Object.freeze({
  'relic:passive:poise-threshold-add': 'poiseThresholdAdd',
  'relic:passive:power-cost-reduction': 'powerCostReduction',
});

export function itemRefIdentity(itemRef) {
  const parts = typeof itemRef === 'string' ? itemRef.split('/') : [];
  if (parts[0] === 'armament' && parts.length === 2 && parts[1]) {
    return Object.freeze({ itemRef, itemKind: 'armament', itemId: parts[1], classId: null });
  }
  if (parts[0] === 'armor' && parts.length === 3 && parts[1] && parts[2]) {
    return Object.freeze({ itemRef, itemKind: 'armor', itemId: parts[2], classId: parts[1] });
  }
  if (parts[0] === 'relic' && parts.length === 2 && parts[1]) {
    return Object.freeze({ itemRef, itemKind: 'relic', itemId: parts[1], classId: null });
  }
  return null;
}

export function parseItemUpgradeTag(tag, attributeIds = []) {
  if (tag === UPGRADE_COST_TAG) return Object.freeze({ kind: 'upgradeCost', resource: 'smithingStone' });
  if (tag === UPGRADE_EQUIPMENT_POISE_TAG) return Object.freeze({ kind: 'equipmentPoise', field: 'poiseThreshold' });
  if (Object.hasOwn(UPGRADE_RELIC_PASSIVE_TAGS, tag)) {
    return Object.freeze({ kind: 'relicPassive', passiveKey: UPGRADE_RELIC_PASSIVE_TAGS[tag] });
  }
  const parts = typeof tag === 'string' ? tag.split(':') : [];
  if (parts[0] === 'requirement' && parts.length === 2 && attributeIds.includes(parts[1])) {
    return Object.freeze({ kind: 'requirement', attributeId: parts[1] });
  }
  if (parts[0] !== 'card' || parts.length !== 4 || !UPGRADE_CARD_ROLES.includes(parts[1])) return null;
  if (parts[2] === 'effect' && UPGRADE_CARD_EFFECTS.includes(parts[3])) {
    return Object.freeze({ kind: 'cardEffect', role: parts[1], op: parts[3] });
  }
  if (parts[2] === 'cost' && UPGRADE_CARD_RESOURCES.includes(parts[3])) {
    return Object.freeze({ kind: 'cardCost', role: parts[1], resource: parts[3] });
  }
  return null;
}

export function itemUpgradeTagMatchesKind(descriptor, itemKind) {
  if (!descriptor) return false;
  if (descriptor.kind === 'upgradeCost') return ['armament', 'armor', 'relic'].includes(itemKind);
  if (itemKind === 'armament') return ['requirement', 'cardEffect', 'cardCost'].includes(descriptor.kind);
  if (itemKind === 'armor') return descriptor.kind === 'equipmentPoise';
  if (itemKind === 'relic') return descriptor.kind === 'relicPassive';
  return false;
}

export function itemUpgradeRows(registries, itemRef, nextTier) {
  return Object.freeze(((registries?.equipment?.itemUpgradeChanges) || [])
    .filter((row) => row.itemRef === itemRef && row.nextTier === nextTier));
}

export function itemUpgradeTiers(registries, itemRef) {
  return Object.freeze([...new Set(((registries?.equipment?.itemUpgradeChanges) || [])
    .filter((row) => row.itemRef === itemRef)
    .map((row) => row.nextTier))].sort((a, b) => a - b));
}

export function itemUpgradeCost(rows) {
  const row = rows.find((entry) => entry.tag === UPGRADE_COST_TAG);
  if (!row) throw new Error('Authored upgrade tier is missing upgrade:cost:smithing-stone');
  return row.value;
}

export function cumulativeRequirementDelta(registries, itemRef, attributeId, level) {
  let delta = 0;
  for (let tier = 1; tier <= level; tier += 1) {
    for (const row of itemUpgradeRows(registries, itemRef, tier)) {
      if (row.tag === `requirement:${attributeId}`) delta += row.value;
    }
  }
  return delta;
}

function itemDefinition(registries, identity) {
  if (!identity) return null;
  if (identity.itemKind === 'armament') {
    return (registries?.equipment?.armaments || []).find((row) => row.id === identity.itemId) || null;
  }
  if (identity.itemKind === 'armor') {
    return (registries?.equipment?.armour || [])
      .find((row) => row.classId === identity.classId && row.id === identity.itemId) || null;
  }
  if (identity.itemKind === 'relic') {
    return registries?.relics?.has(identity.itemId) ? registries.relics.get(identity.itemId) : null;
  }
  return null;
}

function cumulativeRows(registries, itemRef, level) {
  const rows = [];
  for (let tier = 1; tier <= level; tier += 1) rows.push(...itemUpgradeRows(registries, itemRef, tier));
  return rows;
}

/** Resolve one equipment definition at a tier without mutating frozen content. */
export function resolveUpgradedEquipment(registries, itemRef, level = 0) {
  const identity = itemRefIdentity(itemRef);
  if (!identity || !['armament', 'armor'].includes(identity.itemKind)) {
    throw new Error(`'${itemRef}' is not a namespaced equipment item`);
  }
  const base = itemDefinition(registries, identity);
  if (!base) throw new Error(`Unknown upgrade item '${itemRef}'`);
  let poiseThreshold = base.poiseThreshold;
  for (const row of cumulativeRows(registries, itemRef, level)) {
    const descriptor = parseItemUpgradeTag(row.tag, registries.attributes.ids());
    if (!itemUpgradeTagMatchesKind(descriptor, identity.itemKind)) {
      throw new Error(`${itemRef} tier ${row.nextTier} tag '${row.tag}' is invalid for ${identity.itemKind}`);
    }
    if (descriptor.kind === 'equipmentPoise') {
      if (!Number.isInteger(poiseThreshold)) throw new Error(`${itemRef} poiseThreshold must be an integer`);
      poiseThreshold += row.value;
      if (poiseThreshold < 0) throw new Error(`${itemRef} poiseThreshold would fall below zero`);
    }
  }
  return Object.freeze({ ...base, poiseThreshold });
}

/** Resolve one relic definition at a tier without mutating frozen content. */
export function resolveUpgradedRelic(registries, itemRef, level = 0) {
  const identity = itemRefIdentity(itemRef);
  if (!identity || identity.itemKind !== 'relic') throw new Error(`'${itemRef}' is not a namespaced relic`);
  const base = itemDefinition(registries, identity);
  if (!base) throw new Error(`Unknown upgrade item '${itemRef}'`);
  const passives = { ...(base.passives || {}) };
  for (const row of cumulativeRows(registries, itemRef, level)) {
    const descriptor = parseItemUpgradeTag(row.tag, registries.attributes.ids());
    if (!itemUpgradeTagMatchesKind(descriptor, identity.itemKind)) {
      throw new Error(`${itemRef} tier ${row.nextTier} tag '${row.tag}' is invalid for relic`);
    }
    if (descriptor.kind === 'relicPassive') {
      const before = passives[descriptor.passiveKey];
      if (!Number.isInteger(before)) {
        throw new Error(`${itemRef} passive '${descriptor.passiveKey}' must already be an authored integer`);
      }
      const after = before + row.value;
      if (after < 0) throw new Error(`${itemRef} passive '${descriptor.passiveKey}' would fall below zero`);
      passives[descriptor.passiveKey] = after;
    }
  }
  return Object.freeze({ ...base, passives: Object.freeze(passives) });
}

export function resolveUpgradedItem(registries, itemRef, level = 0) {
  const identity = itemRefIdentity(itemRef);
  if (!identity) throw new Error(`Unknown namespaced upgrade item '${itemRef}'`);
  return identity.itemKind === 'relic'
    ? resolveUpgradedRelic(registries, itemRef, level)
    : resolveUpgradedEquipment(registries, itemRef, level);
}

/** Typed, value-bearing receipts for the non-card rows in one exact tier. */
export function itemUpgradeValueReceipts(registries, itemRef, currentLevel, nextLevel) {
  if (nextLevel !== currentLevel + 1) throw new Error('Upgrade receipts require exactly one tier step');
  const identity = itemRefIdentity(itemRef);
  if (!identity) throw new Error(`Unknown namespaced upgrade item '${itemRef}'`);
  if (identity.itemKind === 'armament') return Object.freeze([]);
  const before = resolveUpgradedItem(registries, itemRef, currentLevel);
  const after = resolveUpgradedItem(registries, itemRef, nextLevel);
  const receipts = [];
  for (const row of itemUpgradeRows(registries, itemRef, nextLevel)) {
    const descriptor = parseItemUpgradeTag(row.tag, registries.attributes.ids());
    if (descriptor?.kind === 'equipmentPoise') {
      receipts.push(Object.freeze({ kind: descriptor.kind, tag: row.tag, label: 'Poise threshold', before: before.poiseThreshold, after: after.poiseThreshold }));
    } else if (descriptor?.kind === 'relicPassive') {
      receipts.push(Object.freeze({
        kind: descriptor.kind,
        tag: row.tag,
        passiveKey: descriptor.passiveKey,
        label: descriptor.passiveKey === 'poiseThresholdAdd' ? 'Poise threshold bonus' : 'Power cost reduction',
        before: before.passives[descriptor.passiveKey],
        after: after.passives[descriptor.passiveKey],
      }));
    }
  }
  if (!receipts.length || receipts.every((row) => row.before === row.after)) {
    throw new Error(`${itemRef} tier ${nextLevel} has no effective authored change`);
  }
  return Object.freeze(receipts);
}

export function applyItemCardUpgradeRows(def, role, rows, attributeIds = []) {
  let result = {
    ...def,
    effects: (def.effects || []).map((effect) => ({ ...effect })),
  };
  let changed = false;
  for (const row of rows) {
    const descriptor = parseItemUpgradeTag(row.tag, attributeIds);
    if (!descriptor || descriptor.role !== role) continue;
    if (descriptor.kind === 'cardEffect') {
      const matches = result.effects.filter((effect) => effect.op === descriptor.op);
      if (matches.length !== 1) {
        throw new Error(`${row.itemRef} tier ${row.nextTier} tag '${row.tag}' expected exactly one '${descriptor.op}' effect for role '${role}', found ${matches.length}`);
      }
      const target = matches[0];
      const field = 'amount';
      if (typeof target[field] !== 'number') throw new Error(`${row.itemRef} tier ${row.nextTier} tag '${row.tag}' targets a non-numeric ${field}`);
      const next = target[field] + row.value;
      if (next < 0) throw new Error(`${row.itemRef} tier ${row.nextTier} tag '${row.tag}' would reduce ${field} below zero`);
      target[field] = next;
      changed = true;
    } else if (descriptor.kind === 'cardCost') {
      const field = descriptor.resource === 'action' ? 'cost' : `${descriptor.resource}Cost`;
      const before = result[field] == null ? 0 : result[field];
      if (typeof before !== 'number') throw new Error(`${row.itemRef} tier ${row.nextTier} tag '${row.tag}' targets non-numeric ${field}`);
      const next = before + row.value;
      if (next < 0) throw new Error(`${row.itemRef} tier ${row.nextTier} tag '${row.tag}' would reduce ${field} below zero`);
      result[field] = next;
      changed = true;
    }
  }
  if (changed) result.name = `${String(result.name || '').replace(/\++$/, '')}+`;
  return Object.freeze(result);
}
