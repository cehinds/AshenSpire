// Pure, host-neutral configuration resolution. No runtime code is evaluated.
export class GameConfigError extends Error {
  constructor(path, message) { super(`${path}: ${message}`); this.name = 'GameConfigError'; this.path = path; }
}
const fail = (path, message) => { throw new GameConfigError(path, message); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
export function dataClone(value, path = '$', seen = new Set()) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || seen.has(value)) fail(path, 'expected finite acyclic JSON data');
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== Array.prototype && Object.getPrototypeOf(value) !== null) fail(path, 'expected plain JSON object');
  seen.add(value);
  const out = Array.isArray(value) ? value.map((item, i) => dataClone(item, `${path}/${i}`, seen)) : {};
  if (!Array.isArray(value)) for (const [key, item] of Object.entries(value)) {
    if (unsafe.has(key)) fail(`${path}/${key}`, 'reserved object key');
    if (key !== '$comment') out[key] = dataClone(item, `${path}/${key}`, seen);
  }
  seen.delete(value); return out;
}
export function freezeGameData(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freezeGameData); Object.freeze(value); }
  return value;
}
export function canonicalGameJSON(value) {
  const sort = item => Array.isArray(item) ? item.map(sort) : record(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])])) : item;
  return JSON.stringify(sort(dataClone(value)));
}
// SHA-256 over UTF-8; kept synchronous so browser snapshots and CLI use one contract.
export function gameDigest(value) {
  const bytes = new TextEncoder().encode(typeof value === 'string' ? value : canonicalGameJSON(value));
  const primes = [], initial = [], constants = [];
  for (let n = 2; primes.length < 64; n++) if (!primes.some(p => p * p <= n && n % p === 0)) {
    primes.push(n); initial.push((Math.sqrt(n) % 1 * 0x100000000) | 0); constants.push((Math.cbrt(n) % 1 * 0x100000000) | 0);
  }
  const count = Math.ceil((bytes.length + 9) / 64) * 64, data = new Uint8Array(count); data.set(bytes); data[bytes.length] = 128;
  const view = new DataView(data.buffer), bitLength = bytes.length * 8;
  view.setUint32(count - 8, Math.floor(bitLength / 0x100000000)); view.setUint32(count - 4, bitLength >>> 0);
  const h = initial.slice(0, 8), w = new Int32Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < count; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getInt32(offset + i * 4);
    for (let i = 16; i < 64; i++) w[i] = (w[i - 16] + (r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3)) + w[i - 7] + (r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10))) | 0;
    let [a,b,c,d,e,f,g,z] = h;
    for (let i = 0; i < 64; i++) { const t1 = (z + (r(e,6)^r(e,11)^r(e,25)) + ((e&f)^(~e&g)) + constants[i] + w[i]) | 0; const t2 = ((r(a,2)^r(a,13)^r(a,22)) + ((a&b)^(a&c)^(b&c))) | 0; z=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0; }
    [a,b,c,d,e,f,g,z].forEach((x,i) => { h[i] = (h[i] + x) | 0; });
  }
  return `sha256:${h.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('')}`;
}
export function mergeGameSettings(base, override) {
  const out = dataClone(base);
  for (const [key, value] of Object.entries(dataClone(override))) out[key] = record(value) && record(out[key]) ? mergeGameSettings(out[key], value) : value;
  return out;
}
export function validateGameSchema(value, schema, path = '$') {
  if (schema.enum && !schema.enum.includes(value)) fail(path, `expected one of ${schema.enum.join(', ')}`);
  const type = schema.type;
  if (type === 'object') {
    if (!record(value)) fail(path, 'expected object');
    for (const key of schema.required || []) if (!(key in value)) fail(`${path}/${key}`, 'required setting');
    for (const [key, item] of Object.entries(value)) {
      const child = schema.properties?.[key] || (record(schema.additionalProperties) ? schema.additionalProperties : null);
      if (!child && schema.additionalProperties === false) fail(`${path}/${key}`, 'unknown setting');
      if (child) validateGameSchema(item, child, `${path}/${key}`);
    }
  } else if (type === 'array') {
    if (!Array.isArray(value)) fail(path, 'expected array');
    if (value.length < (schema.minItems || 0) || value.length > (schema.maxItems ?? Infinity)) fail(path, 'array length outside permitted range');
    if (schema.uniqueItems && new Set(value.map(canonicalGameJSON)).size !== value.length) fail(path, 'duplicate array item');
    value.forEach((item, i) => validateGameSchema(item, schema.items || {}, `${path}/${i}`));
  } else if (type === 'string' && (typeof value !== 'string' || value.length < (schema.minLength || 0))) fail(path, 'expected nonempty string');
  else if (type === 'boolean' && typeof value !== 'boolean') fail(path, 'expected boolean');
  else if (type === 'integer' && !Number.isSafeInteger(value)) fail(path, 'expected safe integer');
  else if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) fail(path, 'expected finite number');
  if (typeof value === 'number' && (value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) fail(path, 'outside permitted numeric range');
}
// Structured adapter formulas remain finite JSON; the host's closed formula/
// opcode validator checks their vocabulary when definitions are compiled/loaded.
function adapterAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
  return record(value) && typeof value.f === 'string' && value.f.length > 0;
}
function appendBaseCardContent(content, modules, foundationMode) {
  if (!content.baseCards) return;
  const { cards, helpers = [] } = content.baseCards;
  const rows = [...cards, ...helpers], ids = new Set();
  for (const row of rows) {
    const id = row.definition?.id;
    if (!id || ids.has(id)) fail('$/content/baseCards', `duplicate or missing card ID '${id}'`);
    ids.add(id);
  }
  const groupId = foundationMode === 'configured' ? 'base.core-rewards' : 'base.current-rewards';
  const groups = content.baseCardGroups;
  if (!groups?.[groupId]?.members) fail('$/content/baseCardGroups', `missing '${groupId}'`);
  const admitted = new Set([...groups[groupId].members, ...groups['base.generated-helpers'].members, ...groups['base.generated-burdens'].members]);
  const additions = [], unavailable = [];
  const requirementsFor = (row, seen = new Set()) => {
    if (seen.has(row.definition.id)) fail('$/content/baseCards', 'cyclic linked card requirements');
    const nextSeen = new Set([...seen, row.definition.id]);
    const required = { modules: [], elements: [], protections: [] };
    const merge = requirement => { for (const key of Object.keys(required)) required[key].push(...(requirement?.[key] || [])); };
    merge(row.requirements);
    for (const effect of [...row.definition.effects, ...(row.definition.effectVariants || []).flatMap(variant => variant.effects)]) {
      if (effect.op === 'applyStatus') merge(content.baseCardStatusSource.rules[effect.status]?.requires);
      if (effect.op === 'castLinkedSpell') {
        const linked = rows.find(other => other.definition.id === effect.card);
        if (!linked) fail('$/content/baseCards', `unknown linked spell '${effect.card}'`);
        merge(requirementsFor(linked, nextSeen));
      }
    }
    return required;
  };
  for (const row of rows) {
    const required = requirementsFor(row);
    const missing = required.modules.filter(id => !modules[id]);
    if (foundationMode === 'configured') {
      if (required.elements.length && !modules.effects?.elements) missing.push('elements');
      for (const protection of required.protections) if (!modules.defenses?.include?.includes(protection)) missing.push(`protection:${protection}`);
    }
    if (!admitted.has(row.definition.id) || missing.length) { unavailable.push({ id: row.definition.id, reasons: missing.length ? missing : row.requirements?.features || ['profile-group'] }); continue; }
    additions.push({...dataClone(row.definition), tags:dataClone(row.tags)});
  }
  const existing = content.cards || [];
  for (const card of additions) if (existing.some(row => row.id === card.id)) fail('$/content/cards', `duplicate card ID '${card.id}'`);
  content.cards = [...existing, ...additions];
  content.resourceVariants = {...(content.resourceVariants || {}), ...dataClone(content.baseCardVariants)};
  content.baseCardAdmission = { group: groupId, admitted: additions.map(row => row.id), unavailable };
}
function verifyContent(content) {
  if (content.cards && new Set(content.cards.map(card => card.id)).size !== content.cards.length) fail('$/content/cards', 'duplicate card ID');
  if (!content.classes) return;
  if (!Array.isArray(content.classes) || !Array.isArray(content.cards) || !record(content.starterDeck)) fail('$/content', 'missing typed classes/cards/starterDeck');
  const classIDs = new Set(content.classes.map(row => row.id));
  if (classIDs.size !== content.classes.length) fail('$/content/classes', 'duplicate class ID');
  for (const row of content.classes) {
    const values = Object.values(row.attributes || {});
    if (values.length !== 5 || values.some(n => !Number.isSafeInteger(n) || n < 0) || values.reduce((a,b)=>a+b,0) !== content.stats.attributePointTotal) fail(`$/content/classes/${row.id}/attributes`, 'invalid fixed attribute allocation');
    if (!Number.isSafeInteger(row.maxHp) || row.maxHp < 1) fail(`$/content/classes/${row.id}/maxHp`, 'expected positive HP');
  }
  for (const row of content.cards) {
    for (const key of ['cost','staminaCost','manaCost']) if (!(key === 'cost' && row[key] === 'X') && (!Number.isSafeInteger(row[key]) || row[key] < 0)) fail(`$/content/cards/${row.id}/${key}`, 'expected nonnegative integer price');
    for (const [i,effect] of (row.effects || []).entries()) if ((effect.amount !== undefined || ['damage','block'].includes(effect.op)) && !adapterAmount(effect.amount)) fail(`$/content/cards/${row.id}/effects/${i}/amount`, 'expected nonnegative finite adapter amount');
  }
  if (content.stats.poolBasesByClass !== undefined) {
    if (!record(content.stats.poolBasesByClass)) fail('$/content/stats/poolBasesByClass', 'expected class pool-base map');
    for (const [classId, pools] of Object.entries(content.stats.poolBasesByClass)) {
      if (!classIDs.has(classId)) fail(`$/content/stats/poolBasesByClass/${classId}`, 'unknown class');
      if (!record(pools)) fail(`$/content/stats/poolBasesByClass/${classId}`, 'expected pool-base map');
      for (const [pool, base] of Object.entries(pools)) {
        if (!['hp', 'mana', 'stamina'].includes(pool) || !Number.isFinite(base) || base < 0) fail(`$/content/stats/poolBasesByClass/${classId}/${pool}`, 'expected known pool and nonnegative finite base');
      }
    }
  }
  const cards = new Set(content.cards.map(card => card.id));
  if (cards.size !== content.cards.length) fail('$/content/cards', 'duplicate card ID');
  for (const row of content.classes) if (!cards.has(row.specialCardId)) fail(`$/content/classes/${row.id}/specialCardId`, 'unresolved card reference');
  for (const row of content.starterDeck.shared) if (!cards.has(row.card) || !Number.isSafeInteger(row.copies) || row.copies < 1) fail('$/content/starterDeck/shared', 'invalid starter card reference/count');
}
// Gear module (owner 2026-10-17): every item has a ratings pool (AR/DR/Poise) and a bonus pool
// (attributes; effect tags cost points, penalty tags refund), sized by rarity; `pools: merged`
// joins them. Points an item sets are kept; the rest are filled by weights: the item's own,
// else the sum of its tags' weights scaled by tag priority (gear-type tags such as
// `greatsword` lead), else kind, then slot, then global. Largest remainder, deterministic.
const GEAR_RATINGS = ['ar', 'dr', 'poise'];
const GEAR_KEYS = [...GEAR_RATINGS, ...['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence']];
function gearSplit(total, weights) {
  const keys = Object.keys(weights).filter(k => weights[k] > 0), out = Object.fromEntries(keys.map(k => [k, 0]));
  const sum = keys.reduce((s, k) => s + weights[k], 0);
  if (total <= 0 || !sum) return out;
  const raw = keys.map(k => [k, (weights[k] / sum) * total]);
  for (const [k, v] of raw) out[k] = Math.floor(v);
  let left = total - keys.reduce((s, k) => s + out[k], 0);
  for (const [k] of raw.sort((a, b) => (b[1] - Math.floor(b[1])) - (a[1] - Math.floor(a[1])) || keys.indexOf(a[0]) - keys.indexOf(b[0]))) if (left-- > 0) out[k]++;
  return out;
}
function gearWeights(item, settings, pool) {
  if (record(item.weights?.[pool]) && Object.keys(item.weights[pool]).length) return { ...item.weights[pool] };
  const summed = {};
  for (const tag of item.tags || []) {
    const rule = settings.tags[tag], w = rule?.weights?.[pool];
    if (w) for (const [k, v] of Object.entries(w)) summed[k] = (summed[k] || 0) + v * rule.priority / 100;
  }
  if (Object.keys(summed).length) return summed;
  return { ...(settings.weights.kinds[item.kind]?.[pool] || settings.weights.slots[item.slot]?.[pool] || settings.weights.global[pool] || {}) };
}
export function resolveGearItem(item, settings) {
  const size = pool => settings.poolSizes[pool][item.rarity] || { min: 0, max: 0 };
  const target = pool => settings.fillTo === 'none' ? 0 : settings.fillTo === 'min' ? size(pool).min : size(pool).max;
  const explicit = Object.fromEntries(GEAR_KEYS.map(k => [k, item.points?.[k] || 0]));
  const tagCost = (item.tags || []).reduce((s, t) => s + (settings.tags[t]?.cost || 0), 0);
  const sum = keys => keys.reduce((s, k) => s + explicit[k], 0);
  const attrKeys = GEAR_KEYS.slice(3);
  // At most maxAttributes attributes: those the item set, then the heaviest-weighted.
  const limitAttributes = weights => {
    const chosen = attrKeys.filter(k => explicit[k] > 0);
    for (const k of attrKeys.filter(k => !chosen.includes(k) && weights[k] > 0).sort((a, b) => weights[b] - weights[a])) if (chosen.length < settings.maxAttributes) chosen.push(k);
    return Object.fromEntries(Object.entries(weights).filter(([k]) => GEAR_RATINGS.includes(k) || chosen.includes(k)));
  };
  const ratingsW = gearWeights(item, settings, 'ratings'), bonusW = limitAttributes(gearWeights(item, settings, 'bonus'));
  let fill;
  if (settings.pools === 'merged') {
    const norm = (w, share) => { const s = Object.values(w).reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / s * share])); };
    const merged = settings.poolSizes.merged?.[item.rarity];
    const whole = merged ? (settings.fillTo === 'none' ? 0 : settings.fillTo === 'min' ? merged.min : merged.max) : target('ratings') + target('bonus');
    const remaining = whole - sum(GEAR_KEYS) - tagCost;
    // Share of the single pool by rarity (owner: most commons give AR/DR/Poise only).
    const share = settings.mergedShare[item.rarity] || settings.mergedShare.default;
    fill = gearSplit(remaining, { ...norm(ratingsW, share.ratings), ...norm(bonusW, share.bonus) });
  } else {
    fill = { ...gearSplit(target('ratings') - sum(GEAR_RATINGS), ratingsW), ...gearSplit(target('bonus') - sum(attrKeys) - tagCost, bonusW) };
  }
  const points = Object.fromEntries(GEAR_KEYS.map(k => [k, explicit[k] + (fill[k] || 0)]));
  const values = Object.fromEntries(GEAR_KEYS.map(k => [k, points[k] * settings.pointValues[k]]));
  const modifiers = (item.tags || []).map(t => settings.tags[t]).filter(r => r?.modifier).map(r => `${r.modifier}=${r.amount >= 0 ? '+' : ''}${r.amount}`);
  return { id: item.id, points, values, tags: [...(item.tags || [])], modifiers, tagCost, pools: { ratings: size('ratings'), bonus: size('bonus'), merged: settings.poolSizes.merged?.[item.rarity] || null, mode: settings.pools } };
}
function verifyGearContent(content, settings) {
  if (!settings || !content.gear) return;
  const ids = new Set();
  for (const item of content.gear) {
    const at = `$/content/gear/${item.id}`;
    if (!item.id || ids.has(item.id)) fail('$/content/gear', `duplicate or missing gear ID '${item.id}'`);
    ids.add(item.id);
    if (!settings.rarities.includes(item.rarity)) fail(`${at}/rarity`, `unknown rarity '${item.rarity}'`);
    for (const t of item.tags || []) if (!settings.tags[t]) fail(`${at}/tags`, `unknown tag '${t}'`);
    for (const k of Object.keys(item.points || {})) if (!GEAR_KEYS.includes(k) || !Number.isSafeInteger(item.points[k]) || item.points[k] < 0) fail(`${at}/points/${k}`, 'expected known key and nonnegative integer');
    const attrs = GEAR_KEYS.slice(3).filter(k => item.points?.[k] > 0);
    if (attrs.length > settings.maxAttributes) fail(`${at}/points`, `more than ${settings.maxAttributes} attributes`);
    const r = settings.poolSizes.ratings[item.rarity], b = settings.poolSizes.bonus[item.rarity];
    const setR = GEAR_RATINGS.reduce((s, k) => s + (item.points?.[k] || 0), 0), setB = attrs.reduce((s, k) => s + item.points[k], 0);
    const cost = (item.tags || []).reduce((s, t) => s + (settings.tags[t]?.cost || 0), 0);
    const whole = settings.poolSizes.merged?.[item.rarity]?.max ?? r.max + b.max;
    if (settings.pools === 'merged' ? setR + setB + cost > whole : setR > r.max || setB + cost > b.max) fail(`${at}/points`, 'set points and tag costs exceed the pool');
  }
}
// Enemies module (docs/plans/enemy-decks.md): enemies are characters with decks. Refuses unknown
// card/gear/relic references, decks outside the configured bounds, attribute totals outside the
// tier budget, and any deck card the enemy's own pools can never pay for.
const ENEMY_ATTRIBUTES = ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'];
// Same shape as the player's derived-stat rows (src/content/derivedStats.js): base, plus each
// attribute's contribution and the level term, each floored on its own (owner 2026-10-17:
// HP, SP and MP from attributes and level via statRules).
// Pass enemyItemBonuses() as `bonus` to include gear and relics.
export function enemyLevel(row, settings) {
  const profile = row.levelProfile || {};
  return Math.max(1, settings.levelFrom === 'levelProfile.max' ? profile.max ?? 1 : profile.min ?? 1);
}
// Gear and relics grant attribute points only (owner 2026-10-17): `self.<attribute>=+N`,
// 0-5 points across at most 3 attributes per item. Returns the summed bonus for one enemy.
const ITEM_MODIFIER = /^self\.(strength|dexterity|constitution|wisdom|intelligence|sp|mp|hp)=([+-]\d+)$/;
const ENEMY_POOL_MODS = ['sp', 'mp', 'hp'];
// Gear is the player's gear (content.gear, resolved by the gear module) so it can be looted;
// relics are enemy relics (content.enemyRelics) with attribute modifiers.
export function enemyItemBonuses(row, content = {}, gearSettings = null) {
  const bonus = Object.fromEntries([...ENEMY_ATTRIBUTES, ...ENEMY_POOL_MODS].map(id => [id, 0]));
  const gear = new Map((content.gear || []).map(item => [item.id, item]));
  for (const id of row.gear || []) {
    const item = gear.get(id);
    if (item && gearSettings) { const resolved = resolveGearItem(item, gearSettings); for (const a of ENEMY_ATTRIBUTES) bonus[a] += resolved.points[a]; }
  }
  const relics = new Map((content.enemyRelics || []).map(item => [item.id, item]));
  for (const id of row.relics || []) for (const modifier of relics.get(id)?.modifiers || []) {
    const match = ITEM_MODIFIER.exec(modifier);
    if (match) bonus[match[1]] += Number(match[2]);
  }
  return bonus;
}
export function enemyPools(row, settings, level = enemyLevel(row, settings), bonus = null) {
  const tier = settings.tiers[row.tier], round = settings.rounding === 'up' ? Math.ceil : settings.rounding === 'nearest' ? Math.round : Math.floor;
  const base = { hp: tier.pools.hp, sp: tier.pools.sp, mp: tier.pools.mp, hand: tier.hand, ar: 0, dr: 0 };
  const attributes = Object.fromEntries(ENEMY_ATTRIBUTES.map(id => [id, Math.max(0, (row.attributes[id] || 0) + (bonus?.[id] || 0))]));
  const pools = {};
  for (const [stat, rule] of Object.entries(settings.statRules)) {
    let value = base[stat] ?? 0;
    for (const id of ENEMY_ATTRIBUTES) if (rule[id]) value += round((attributes[id] || 0) * rule[id]);
    if (rule.perLevel) value += round((level - 1) * rule.perLevel);
    // Pool penalties floor at penaltyFloor (SP = max(SP - x, 1)); bonuses add freely.
    const mod = ENEMY_POOL_MODS.includes(stat) ? bonus?.[stat] || 0 : 0, floor = settings.penaltyFloor?.[stat] ?? 0;
    pools[stat] = mod < 0 ? Math.max(value + mod, Math.min(value, floor)) : value + mod;
  }
  return pools;
}
// What a viewer may see of an enemy: the always-shown fields plus any field one of the viewer's
// tags reveals (owner 2026-10-17: SP/MP etc. stay hidden unless insight, a bestiary, … reveals them).
export function enemyVisibleFields(settings, viewerTags = []) {
  const shown = new Set(settings.visibility.shown);
  for (const [field, tags] of Object.entries(settings.visibility.revealedBy)) if (tags.some(tag => viewerTags.includes(tag))) shown.add(field);
  return shown;
}
function verifyEnemyContent(content, settings, gearSettings = null) {
  if (!settings) return;
  const base = '$/content/enemies';
  if (!Array.isArray(content.enemies) || !Array.isArray(content.enemyCards)) fail(base, 'enemies module requires enemies and enemyCards pack content');
  const cards = new Map(content.enemyCards.map(card => [card.id, card]));
  if (cards.size !== content.enemyCards.length) fail('$/content/enemyCards', 'duplicate enemy card ID');
  const playerCards = new Set((content.cards || []).map(card => card.id));
  // Enemy gear is player gear (lootable); relics are enemy relics with attribute modifiers.
  const gear = new Set((content.gear || []).map(row => row.id)), relics = new Set((content.enemyRelics || []).map(row => row.id));
  for (const [kind, rows] of [['enemyRelics', content.enemyRelics || []]])
    for (const row of rows) {
      const at = `$/content/${kind}/${row.id}/modifiers`, rules = settings.equipment;
      if (!Array.isArray(row.modifiers) || row.modifiers.some(m => typeof m !== 'string' || !ITEM_MODIFIER.test(m))) fail(at, 'expected self.<attribute|sp|mp|hp>=±N modifiers');
      const parsed = row.modifiers.map(m => ITEM_MODIFIER.exec(m)), attrs = parsed.filter(p => ENEMY_ATTRIBUTES.includes(p[1]));
      // Bonuses are capped; penalties (negative values) are free and not counted.
      const stats = attrs.map(p => p[1]), points = attrs.reduce((sum, p) => sum + Math.max(0, Number(p[2])), 0);
      if (new Set(stats).size !== stats.length) fail(at, 'duplicate attribute');
      if (stats.length > rules.maxStats) fail(at, `more than ${rules.maxStats} attributes`);
      if (points > rules.maxPoints) fail(at, `grants ${points} points; at most ${rules.maxPoints}`);
    }
  // Enemy cards are player cards (same fields, same price and amount rules); targets are relative to
  // the card's owner (`enemy` = the opponent), so a future module can hand an enemy's deck to any controller.
  const TARGETS = new Set(['enemy', 'self', 'allEnemies', 'randomEnemy', 'ally', 'allAllies']);
  // Owner 2026-10-17: values are letters, words or numbers, never glyphs.
  const WORD = /^[A-Za-z0-9][A-Za-z0-9 _.-]*$/;
  const words = (at, row, keys) => { for (const key of keys) if (row[key] !== undefined && !WORD.test(String(row[key]))) fail(`${at}/${key}`, 'expected letters, words or numbers, not symbols'); };
  for (const row of content.enemies) words(`$/content/enemies/${row.id}`, row, ['art', 'tint', 'size', 'artFaces']);
  for (const card of content.enemyCards) {
    const at = `$/content/enemyCards/${card.id}`;
    for (const key of ['cost', 'staminaCost', 'manaCost']) if (!(key === 'cost' && card[key] === 'X') && (!Number.isSafeInteger(card[key]) || card[key] < 0)) fail(`${at}/${key}`, 'expected nonnegative integer price');
    for (const key of ['name', 'class', 'rarity', 'costRule', 'type', 'textTemplate']) if (typeof card[key] !== 'string') fail(`${at}/${key}`, 'expected player-card string field');
    words(at, card, ['icon', 'type', 'class', 'rarity']);
    if (!Array.isArray(card.tags) || !Array.isArray(card.effects) || !Array.isArray(card.keywords)) fail(at, 'expected tags, keywords and effects arrays');
    for (const [i, effect] of card.effects.entries()) {
      if (effect.target !== undefined && !TARGETS.has(effect.target)) fail(`${at}/effects/${i}/target`, `unknown owner-relative target '${effect.target}'`);
      if ((effect.amount !== undefined || ['damage', 'block'].includes(effect.op)) && !adapterAmount(effect.amount)) fail(`${at}/effects/${i}/amount`, 'expected nonnegative finite adapter amount');
    }
    if (card.costSource === 'healRules') {
      const shapes = settings.healRules.shapes.filter(s => s.tags.every(t => card.tags.includes(t)));
      if (!shapes.length) fail(`$/content/enemyCards/${card.id}/tags`, 'healRules cost source but no heal shape matches its tags');
      const shape = settings.healRules.match === 'first' ? shapes[0] : shapes.sort((a, b) => b.tags.length - a.tags.length)[0];
      if (card.staminaCost !== shape.cost.sp || card.manaCost !== shape.cost.mp) fail(`$/content/enemyCards/${card.id}`, `cost must match heal shape '${shape.id}'`);
    }
  }
  const ids = new Set();
  for (const row of content.enemies) {
    const at = `${base}/${row.id}`;
    if (!row.id || ids.has(row.id)) fail(base, `duplicate or missing enemy ID '${row.id}'`);
    ids.add(row.id);
    const tier = settings.tiers[row.tier];
    if (!tier || !settings.include.includes(row.tier)) fail(`${at}/tier`, 'unknown or excluded tier');
    if (!record(row.attributes) || Object.keys(row.attributes).some(k => !ENEMY_ATTRIBUTES.includes(k)) || Object.values(row.attributes).some(n => !Number.isSafeInteger(n) || n < 0)) fail(`${at}/attributes`, 'expected nonnegative integer attributes');
    const total = Object.values(row.attributes).reduce((a, b) => a + b, 0);
    if (total < tier.attributeBudget[0] || total > tier.attributeBudget[1]) fail(`${at}/attributes`, `total ${total} outside ${row.tier} budget`);
    if (!Array.isArray(row.deck)) fail(`${at}/deck`, 'expected deck array');
    const [min, max] = [Math.max(settings.deck.min, tier.deckSize[0]), Math.min(settings.deck.max, tier.deckSize[1])];
    if (row.deck.length < min || row.deck.length > max) fail(`${at}/deck`, `deck size ${row.deck.length} outside ${min}-${max}`);
    const pools = enemyPools(row, settings, enemyLevel(row, settings), enemyItemBonuses(row, content, gearSettings));
    if (tier.spRange && (pools.sp < tier.spRange[0] || pools.sp > tier.spRange[1])) fail(`${at}/attributes`, `SP ${pools.sp} outside ${row.tier} range ${tier.spRange[0]}-${tier.spRange[1]}`);
    for (const id of [...row.deck, ...(row.unlockCards || []), ...(row.firstCard ? [row.firstCard] : [])]) {
      const card = cards.get(id);
      if (!card && !playerCards.has(id)) fail(`${at}/deck`, `unresolved card reference '${id}'`);
      if (card && (card.staminaCost > pools.sp || card.manaCost > pools.mp)) fail(`${at}/deck`, `'${id}' costs ${card.staminaCost} SP/${card.manaCost} MP; enemy has ${pools.sp} SP/${pools.mp} MP`);
    }
    for (const id of row.gear || []) if (!gear.has(id)) fail(`${at}/gear`, `unresolved gear '${id}'`);
    for (const id of row.relics || []) if (!relics.has(id)) fail(`${at}/relics`, `unresolved relic '${id}'`);
  }
}
function verifySettings(modules, instances = {}) {
  const defenses = modules.defenses;
  if (defenses && (defenses.include.length !== defenses.order.length || defenses.include.some(id => !defenses.order.includes(id)))) fail('$/modules/defenses/order', 'must contain selected defenses exactly once');
  for (const [id, registry] of Object.entries(instances)) {
    const settings = modules[id]; if (!settings) continue;
    if (settings.include?.some(key => !registry.ids.includes(key))) fail(`$/modules/${id}/include`, 'unresolved instance reference');
    if (settings.mode === 'configured' && settings.include?.some(key => registry.unsupported.includes(key))) fail(`$/modules/${id}/include`, 'unsupported configured instance; the legacy adapter is required');
  }
  if (modules.routes?.mode === 'configured') {
    const {restFloors,restsPerAct,prebossNodes,minimumThreatFloor} = modules.routes;
    if (prebossNodes + 1 < minimumThreatFloor) fail('$/modules/routes/prebossNodes', 'boss depth must reach minimumThreatFloor');
    if (restFloors.length !== restsPerAct || restFloors.some(n=>n>prebossNodes)) fail('$/modules/routes/restFloors', 'must provide one valid preboss position per rest');
  }
  if (modules.rest?.mode === 'configured' && !modules.rest.services.includes('strategize')) fail('$/modules/rest/services', 'Strategize recovery fallback is required by this adapter');
  if (modules.rewards && modules.rewards.takeCount > modules.rewards.offerCount) fail('$/modules/rewards/takeCount', 'cannot exceed offerCount');
  if (modules.stances && modules.stances.minimumHitChance > modules.stances.maximumHitChance) fail('$/modules/stances/minimumHitChance','must not exceed maximumHitChance');
}
export function resolveGameAuthor(author, catalog) {
  const source = dataClone(author);
  if (!record(source)) fail('$', 'expected author object');
  for (const key of Object.keys(source)) if (!['formatVersion','core','modules'].includes(key)) fail(`$/${key}`, 'unknown author property');
  if (source.formatVersion !== 1) fail('$/formatVersion', 'expected 1');
  if (!record(source.modules)) fail('$/modules', 'expected module map');
  const bundle = catalog.bundles[source.core];
  if (!bundle) fail('$/core', 'unknown exact bundle pin');
  const modules = {}, schemas = {}, provenance = {}, instances = {};
  for (const [id,module] of Object.entries(catalog.modules)) if (module.manifest.instances) instances[id] = {ids:module.manifest.instances,unsupported:module.manifest.unsupportedConfiguredInstances || []};
  for (const id of Object.keys(source.modules)) if (!catalog.modules[id]) fail(`$/modules/${id}`, 'unknown module ID');
  for (const [id, module] of Object.entries(catalog.modules)) {
    const entry = Object.hasOwn(source.modules,id) ? source.modules[id] : undefined, bundled = bundle.manifest.modules[id];
    if (entry !== undefined && entry !== false && entry !== true && !record(entry)) fail(`$/modules/${id}`, 'expected false, true or settings object');
    if (bundle.manifest.foundationMode === 'legacy' && !catalog.modules[id].manifest.legacySettingsAdapter && entry === false && bundled) fail(`$/modules/${id}`, 'legacy adapter cannot disable this feature through game.json; use the configured core or existing legacy settings');
    if (entry === false || (entry === undefined && !bundled)) { modules[id] = false; continue; }
    if (bundled && bundled.version !== module.manifest.version) fail(`$/modules/${id}`, 'exact module version unavailable');
    const defaults = mergeGameSettings(module.defaults, bundled?.settings || {});
    modules[id] = record(entry) ? mergeGameSettings(defaults, entry) : defaults;
    if (bundle.manifest.foundationMode === 'legacy' && !module.manifest.legacySettingsAdapter && record(entry)) {
      for (const key of Object.keys(entry)) if (!(key in defaults) || canonicalGameJSON(modules[id][key]) !== canonicalGameJSON(defaults[key])) fail(`$/modules/${id}/${key}`, 'legacy adapter does not consume game.json setting overrides; use the configured core or existing legacy settings');
    }
    if (modules[id].mode !== bundle.manifest.foundationMode) fail(`$/modules/${id}/mode`, 'mode must match selected bundle adapter; select the core or current bundle explicitly');
    if (modules[id].mode === 'configured' && !module.manifest.configuredAdapter) fail(`$/modules/${id}`, 'configured adapter not implemented for this feature');
    validateGameSchema(modules[id], module.schema, `$/modules/${id}`); schemas[id] = module.schema;
    provenance[id] = entry === undefined ? 'bundle' : 'author';
  }
  // The authored order describes all registered channels; include selects active stages.
  if (modules.defenses) modules.defenses.order = modules.defenses.order.filter(id => modules.defenses.include.includes(id));
  verifySettings(modules, instances);
  let content = {};
  for (const ref of bundle.manifest.packs) {
    const pack = catalog.packs[`${ref.id}@${ref.version}`];
    if (!pack) fail('$/core/packs', `unresolved exact pack ${ref.id}@${ref.version}`);
    for (const [key,value] of Object.entries(pack.content)) { if (key in content) fail(`$/content/${key}`, 'duplicate pack content key'); content[key] = dataClone(value); }
  }
  appendBaseCardContent(content, modules, bundle.manifest.foundationMode);
  for (const binding of bundle.manifest.policyBindings || []) {
    if (!modules[binding.module]) continue;
    const policy = content[binding.content];
    if (!record(policy)) fail(`$/content/${binding.content}`, 'unresolved policy binding');
    const policyDefaults = {};
    for (const [field, setting] of Object.entries(binding.settings)) {
      if (!(field in policy)) fail(`$/content/${binding.content}/${field}`, 'unresolved setting binding');
      policyDefaults[setting] = policy[field];
    }
    const module = catalog.modules[binding.module], authorEntry = source.modules[binding.module];
    const base = mergeGameSettings(mergeGameSettings(module.defaults, policyDefaults), bundle.manifest.modules[binding.module]?.settings || {});
    // Preserve other resolved settings if the same module has more than one binding.
    for (const setting of Object.values(binding.settings)) modules[binding.module][setting] = record(authorEntry) && setting in authorEntry ? mergeGameSettings({value:base[setting]},{value:authorEntry[setting]}).value : base[setting];
    validateGameSchema(modules[binding.module], module.schema, `$/modules/${binding.module}`);
    for (const [field, setting] of Object.entries(binding.settings)) policy[field] = dataClone(modules[binding.module][setting]);
  }
  verifySettings(modules, instances);
  verifyContent(content); verifyGearContent(content, modules.gear); verifyEnemyContent(content, modules.enemies, modules.gear);
  if (content.classes) {
    content.classAttributes = Object.fromEntries(content.classes.map(row => [row.id, row.attributes]));
    content.startingHands = Object.fromEntries(content.classes.map(row => [row.id, content.stats.handBase + row.attributes.intelligence]));
  }
  const artifacts = [...catalog.runtimeArtifacts, ...bundle.artifacts,
    ...Object.entries(modules).filter(([,v]) => v).flatMap(([id]) => catalog.modules[id].artifacts),
    ...bundle.manifest.packs.flatMap(ref => catalog.packs[`${ref.id}@${ref.version}`].artifacts)];
  const profile = {id:bundle.manifest.profileId,formatVersion:1,author:source,modules,content,
    foundation:{...catalog.foundation,mode:bundle.manifest.foundationMode},
    contracts:catalog.contracts,schemas,provenance,instances,
    lock:{formatVersion:1,core:source.core,artifacts:artifacts.sort((a,b)=>a.path < b.path ? -1 : a.path > b.path ? 1 : 0),runtimeABI:catalog.contracts.runtimeABI,numericPolicy:catalog.contracts.numericPolicy,runtimeHash:catalog.runtimeHash},
    portability:{portable:false,requiredCapabilities:['ashen.legacy-adapter@1'],reason:'Host gameplay adapter; no portable rules VM is claimed.'}};
  profile.hash = gameDigest(profile);
  return freezeGameData(profile);
}
export function validateResolvedGameProfile(snapshot, supportedRuntimeHash) {
  const value = dataClone(snapshot), hash = value.hash; delete value.hash;
  if (typeof hash !== 'string' || gameDigest(value) !== hash) fail('$/hash', 'profile snapshot digest mismatch');
  if (supportedRuntimeHash && value.lock?.runtimeHash !== supportedRuntimeHash) fail('$/lock/runtimeHash', 'unsupported runtime artifact snapshot; preserve original save and use its matching build');
  if (value.formatVersion !== 1 || !record(value.modules) || !record(value.schemas)) fail('$', 'invalid profile snapshot envelope');
  for (const [id, settings] of Object.entries(value.modules)) if (settings !== false) {
    if (!value.schemas[id]) fail(`$/modules/${id}`, 'missing pinned settings schema');
    validateGameSchema(settings,value.schemas[id],`$/modules/${id}`);
  }
  verifySettings(value.modules, value.instances); verifyContent(value.content); verifyGearContent(value.content, value.modules.gear); verifyEnemyContent(value.content, value.modules.enemies, value.modules.gear);
  return freezeGameData({...value,hash});
}
