// Pure equipment projection for the opt-in ruleset. Call before an action starts;
// the combat adapter captures its returned sources before payment.
import { assertNumber, validateCombatProfile } from './combatRules.js';

export function deriveEquipmentCombatProfile(equipment, rules, config) {
  const fail = (message) => { throw new Error(`Equipment: ${message}`); };
  const number = (value, path, min = 0) => assertNumber(value, `Equipment.${path}`, min);
  if (!equipment || !Array.isArray(equipment.items)) fail('items must be an array');
  if (!Array.isArray(config?.runeTags) || !Array.isArray(config?.buildupStatuses)) fail('rune tag/status registries required');
  number(config?.oneHandStrengthMultiplier, 'oneHandStrengthMultiplier', 1);
  if (!Array.isArray(config.loadBands) || !config.loadBands.length) fail('load bands required');
  let previous = -1;
  for (const band of config.loadBands) {
    number(band.minimum, 'load band minimum');
    if (band.minimum <= previous || !(band.id in rules.dodge.stamina)) fail('invalid load bands');
    previous = band.minimum;
  }
  if (config.loadBands[0].minimum !== 0) fail('load bands must start at zero');
  const items = new Map(), runeIds = new Set();
  for (const item of equipment.items) {
    if (typeof item?.instanceId !== 'string' || !item.instanceId || items.has(item.instanceId)) fail('duplicate or missing item instance');
    if (!['armament', 'armor'].includes(item.kind)) fail(`${item.instanceId}: unknown kind`);
    if (!item.itemId || !item.name) fail(`${item.instanceId}: catalog identity required`);
    number(item.weight, `${item.instanceId}.weight`);
    number(item.value, `${item.instanceId}.value`);
    const quality = config.qualities?.[item.quality];
    if (!quality || !Number.isInteger(quality.sockets) || quality.sockets < 0) fail(`${item.instanceId}: invalid quality`);
    if (!Array.isArray(item.runes) || item.runes.length > quality.sockets) fail(`${item.instanceId}: socket capacity exceeded`);
    for (const rune of item.runes) {
      if (typeof rune?.instanceId !== 'string' || !rune.instanceId || runeIds.has(rune.instanceId)) fail('duplicate or missing rune instance');
      runeIds.add(rune.instanceId);
      if (rune.scope !== 'source') fail(`${rune.instanceId}: unsupported rune scope`);
      if (!Array.isArray(rune.families) || !rune.families.includes(item.family)) fail(`${item.instanceId}: incompatible rune`);
      number(rune.value, `${rune.instanceId}.value`);
      if (!Array.isArray(rune.tags) || rune.tags.some(tag => !config.runeTags.includes(tag))) fail(`${rune.instanceId}: unregistered rune tag`);
      if (!Array.isArray(rune.buildup)) fail(`${rune.instanceId}: buildup required`);
      for (const effect of rune.buildup) {
        if (!config.buildupStatuses.includes(effect.status)) fail(`${rune.instanceId}: unknown buildup status`);
        number(effect.amount, `${rune.instanceId}.buildup`);
      }
    }
    items.set(item.instanceId, item);
  }
  const sources = {}, worn = new Set(), receipts = [];
  let weight = 0, armor = 0;
  const wear = (id) => {
    const item = items.get(id);
    if (!item) fail(`unknown item instance '${id}'`);
    if (worn.has(id)) fail(`${id}: cannot occupy two slots`);
    worn.add(id); weight += item.weight;
    receipts.push({ instanceId: id, itemId: item.itemId, name: item.name, quality: item.quality,
      weight: item.weight, value: item.value + item.runes.reduce((sum, rune) => sum + rune.value, 0),
      runes: item.runes.map(rune => ({ instanceId: rune.instanceId, name: rune.name, value: rune.value })) });
    return item;
  };
  for (const hand of Object.keys(equipment.hands || {})) if (!['mainHand', 'offHand'].includes(hand)) fail(`unknown hand '${hand}'`);
  for (const hand of ['mainHand', 'offHand']) {
    const selection = equipment.hands?.[hand];
    if (selection == null) continue;
    const item = wear(selection.instanceId);
    if (item.kind !== 'armament') fail(`${item.instanceId}: hand needs an armament`);
    if (![1, 2].includes(item.nativeHands) || !Array.isArray(item.allowedGrips) || !item.allowedGrips.includes(selection.grip)) fail(`${item.instanceId}: unsupported grip`);
    if (selection.grip === 'twoHand' && equipment.hands[hand === 'mainHand' ? 'offHand' : 'mainHand'] != null) fail('two-handed grip needs the other hand empty');
    const requirements = { ...item.requirements };
    if (item.nativeHands === 2 && selection.grip === 'oneHand') {
      requirements.strength = Math.ceil((requirements.strength || 0) * config.oneHandStrengthMultiplier);
    }
    for (const [attribute, minimum] of Object.entries(requirements)) {
      number(minimum, `${item.instanceId}.requirements.${attribute}`);
      const actual = equipment.attributes?.[attribute] ?? 0;
      number(actual, `attributes.${attribute}`);
      if (actual < minimum) fail(`${item.name} requires ${minimum} ${attribute} for this grip (have ${actual})`);
    }
    sources[hand] = { id: item.instanceId, itemId: item.itemId, name: item.name, hand,
      sourceType: item.sourceType, family: item.family, grip: selection.grip, weight: item.weight, damageType: item.damageType,
      tags: [...new Set([...(item.tags || []), ...item.runes.flatMap(rune => rune.tags)])],
      buildup: [...(item.buildup || []), ...item.runes.flatMap(rune => rune.buildup)].map(effect => ({ ...effect })) };
    Object.assign(receipts.at(-1), { hand, grip: selection.grip, nativeHands: item.nativeHands, requirements });
  }
  if (equipment.armorId != null) {
    const item = wear(equipment.armorId);
    if (item.kind !== 'armor') fail('armor slot needs armor');
    number(item.armor, `${item.instanceId}.armor`); armor += item.armor;
  }
  const weightClass = config.loadBands.filter(band => weight >= band.minimum).at(-1).id;
  const profile = { armor, weightClass, sources, equipmentReceipt: { weight, items: receipts } };
  validateCombatProfile(profile, rules);
  return structuredClone(profile);
}
