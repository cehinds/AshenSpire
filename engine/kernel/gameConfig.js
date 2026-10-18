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
  // anyOf / const / pattern: used by the mechanics, UI, map and build contracts (engine/contracts).
  if (Array.isArray(schema.anyOf)) {
    const errors = [];
    for (const option of schema.anyOf) { try { validateGameSchema(value, option, path); return; } catch (error) { errors.push(error.message); } }
    fail(path, `matched no anyOf option (${errors.length})`);
  }
  if ('const' in schema && canonicalGameJSON(value) !== canonicalGameJSON(schema.const)) fail(path, `expected ${JSON.stringify(schema.const)}`);
  if (typeof schema.pattern === 'string' && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) fail(path, `does not match ${schema.pattern}`);
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
// Names (owner 2026-10-17): no spaces. "_" stands for a space and is turned back into one for
// display; "-" is a real hyphen and is kept. "Ember-Starved_Pilgrim" shows as "Ember-Starved Pilgrim".
export const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.'-]*$/;
export const displayName = name => String(name ?? '').replace(/_/g, ' ');
const verifyNames = (rows, base) => { for (const row of rows || []) if (row.name !== undefined && !NAME_PATTERN.test(row.name)) fail(`${base}/${row.id}/name`, 'names use _ for spaces and - for hyphens; no spaces or symbols'); };
// Gear module (owner 2026-10-17): every item has a ratings pool (AR/DR/Poise) and a bonus pool
// (attributes; effect tags cost points, penalty tags refund), sized by rarity; `pools: merged`
// joins them. Points an item sets are kept; the rest are filled by weights: the item's own,
// else the sum of its tags' weights scaled by tag priority (gear-type tags such as
// `greatsword` lead), else kind, then slot, then global. Largest remainder, deterministic.
const GEAR_RATINGS = ['ar', 'dr', 'poise', 'hp', 'mp', 'sp', 'ward', 'evasion', 'precision'];
const GEAR_ATTRIBUTES = ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'];
const GEAR_KEYS = [...GEAR_RATINGS, ...GEAR_ATTRIBUTES];
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
export function resolveGearItem(item, settings, { rank = item.rank ?? 1 } = {}) {
  if (!Number.isSafeInteger(rank) || rank < 1) throw new Error('Gear rank must be a positive integer');
  const armorBudget = item.kind === 'armor' && settings.armorBudget
    ? settings.armorBudget.baseline + (rank - 1) * settings.armorBudget.perRank : null;
  const size = pool => settings.poolSizes[pool][item.rarity] || { min: 0, max: 0 };
  const target = pool => settings.fillTo === 'none' ? 0 : settings.fillTo === 'min' ? size(pool).min : size(pool).max;
  const explicit = Object.fromEntries(GEAR_KEYS.map(k => [k, item.points?.[k] || 0]));
  const tagCost = (item.tags || []).reduce((s, t) => s + (settings.tags[t]?.cost || 0), 0);
  const sum = keys => keys.reduce((s, k) => s + explicit[k], 0);
  const attrKeys = GEAR_ATTRIBUTES;
  // At most maxAttributes attributes: those the item set, then the heaviest-weighted.
  const limitAttributes = weights => {
    const chosen = attrKeys.filter(k => explicit[k] > 0);
    for (const k of attrKeys.filter(k => !chosen.includes(k) && weights[k] > 0).sort((a, b) => weights[b] - weights[a])) if (chosen.length < settings.maxAttributes) chosen.push(k);
    return Object.fromEntries(Object.entries(weights).filter(([k]) => GEAR_RATINGS.includes(k) || chosen.includes(k)));
  };
  const ratingsW = gearWeights(item, settings, 'ratings'), bonusW = limitAttributes(gearWeights(item, settings, 'bonus'));
  let fill;
  if (settings.pools === 'merged' || armorBudget !== null) {
    const norm = (w, share) => { const s = Object.values(w).reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / s * share])); };
    const merged = settings.poolSizes.merged?.[item.rarity];
    const whole = armorBudget ?? (merged ? (settings.fillTo === 'none' ? 0 : settings.fillTo === 'min' ? merged.min : merged.max) : target('ratings') + target('bonus'));
    const remaining = (settings.fillTo === 'none' ? 0 : whole) - sum(GEAR_KEYS) - tagCost;
    // Share of the single pool by rarity (owner: most commons give AR/DR/Poise only).
    const share = settings.mergedShare[item.rarity] || settings.mergedShare.default;
    fill = gearSplit(remaining, { ...norm(ratingsW, share.ratings), ...norm(bonusW, share.bonus) });
  } else {
    fill = { ...gearSplit(target('ratings') - sum(GEAR_RATINGS), ratingsW), ...gearSplit(target('bonus') - sum(attrKeys) - tagCost, bonusW) };
  }
  const points = Object.fromEntries(GEAR_KEYS.map(k => [k, explicit[k] + (fill[k] || 0)]));
  const values = Object.fromEntries(GEAR_KEYS.map(k => [k, points[k] * (settings.pointValues[k] ?? 0)]));
  const modifiers = (item.tags || []).map(t => settings.tags[t]).filter(r => r?.modifier).map(r => `${r.modifier}=${r.amount >= 0 ? '+' : ''}${r.amount}`);
  return { id: item.id, rank, budget: armorBudget, points, values, tags: [...(item.tags || [])], modifiers, tagCost, pools: { ratings: size('ratings'), bonus: size('bonus'), merged: settings.poolSizes.merged?.[item.rarity] || null, mode: settings.pools } };
}
function verifyGearContent(content, settings) {
  if (!settings) return;
  for (const [pool, byRarity] of Object.entries(settings.poolSizes || {})) for (const [rarity, range] of Object.entries(byRarity || {}))
    if (range && Number.isFinite(range.min) && Number.isFinite(range.max) && range.min > range.max) fail(`$/modules/gear/poolSizes/${pool}/${rarity}`, `min ${range.min} exceeds max ${range.max}`);
  if (!content.gear) return;
  verifyNames(content.gear, '$/content/gear');
  const ids = new Set();
  for (const item of content.gear) {
    const at = `$/content/gear/${item.id}`;
    if (!item.id || ids.has(item.id)) fail('$/content/gear', `duplicate or missing gear ID '${item.id}'`);
    ids.add(item.id);
    if (!settings.rarities.includes(item.rarity)) fail(`${at}/rarity`, `unknown rarity '${item.rarity}'`);
    for (const t of item.tags || []) if (!settings.tags[t]) fail(`${at}/tags`, `unknown tag '${t}'`);
    for (const k of Object.keys(item.points || {})) if (!GEAR_KEYS.includes(k) || !Number.isSafeInteger(item.points[k]) || item.points[k] < 0) fail(`${at}/points/${k}`, 'expected known key and nonnegative integer');
    for (const [pool, weights] of Object.entries(item.weights || {})) {
      if (!['ratings','bonus'].includes(pool)) fail(`${at}/weights/${pool}`, 'unknown weight pool');
      for (const [key, weight] of Object.entries(weights)) if (!(pool === 'ratings' ? GEAR_RATINGS : GEAR_ATTRIBUTES).includes(key) || !Number.isFinite(weight) || weight < 0) fail(`${at}/weights/${pool}/${key}`, 'expected a supported stat and nonnegative weight');
    }
    const attrs = GEAR_ATTRIBUTES.filter(k => item.points?.[k] > 0);
    if (attrs.length > settings.maxAttributes) fail(`${at}/points`, `more than ${settings.maxAttributes} attributes`);
    const r = settings.poolSizes.ratings[item.rarity], b = settings.poolSizes.bonus[item.rarity];
    const setR = GEAR_RATINGS.reduce((s, k) => s + (item.points?.[k] || 0), 0), setB = attrs.reduce((s, k) => s + item.points[k], 0);
    const cost = (item.tags || []).reduce((s, t) => s + (settings.tags[t]?.cost || 0), 0);
    const armorBudget = item.kind === 'armor' && settings.armorBudget ? settings.armorBudget.baseline + ((item.rank ?? 1) - 1) * settings.armorBudget.perRank : null;
    if (item.rank !== undefined && (!Number.isSafeInteger(item.rank) || item.rank < 1)) fail(`${at}/rank`, 'expected positive integer rank');
    const whole = armorBudget ?? settings.poolSizes.merged?.[item.rarity]?.max ?? r.max + b.max;
    if (settings.pools === 'merged' || armorBudget !== null ? setR + setB + cost > whole : setR > r.max || setB + cost > b.max) fail(`${at}/points`, 'set points and tag costs exceed the pool');
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
// Enemy attributes (owner 2026-10-17): points the row sets in `attributes` are kept; the rest of the
// tier budget is split by `attributePriority` (rank weights from `priorityWeights`), respecting caps.
// `variance` moves up to N points between the top `among` priorities, seeded, so copies differ.
function enemyAttributeWeights(row, settings) {
  const fill = settings.attributeFill, order = row.attributePriority || fill.defaultPriority, ranks = row.priorityWeights || fill.priorityWeights;
  return Object.fromEntries(order.map((id, i) => [id, ranks[i] ?? 0]));
}
export function resolveEnemyAttributes(row, settings, seed = null) {
  const fill = settings.attributeFill, tier = characterRule(row, settings);
  const budget = Number.isSafeInteger(row.attributePoints) ? row.attributePoints : tier.attributeBudget[1];
  const set = Object.fromEntries(ENEMY_ATTRIBUTES.map(id => [id, row.attributes?.[id] || 0]));
  const out = { ...set }, caps = { ...fill.caps, ...(row.attributeCaps || {}) };
  let weights = enemyAttributeWeights(row, settings), left = budget - Object.values(set).reduce((a, b) => a + b, 0);
  for (let guard = 0; left > 0 && guard < 10; guard++) {
    const open = Object.fromEntries(Object.entries(weights).filter(([id]) => caps[id] === undefined || out[id] < caps[id]));
    if (!Object.keys(open).length) break;
    const share = gearSplit(left, open);
    for (const [id, n] of Object.entries(share)) { const room = caps[id] === undefined ? n : Math.min(n, caps[id] - out[id]); out[id] += room; left -= room; }
    weights = open;
  }
  const v = { points: 0, among: 2, ...(settings.variance || {}), ...(row.variance || {}) };
  if (seed !== null && settings.variance && v.points > 0 && tier.variance) {
    const order = (row.attributePriority || fill.defaultPriority).slice(0, v.among);
    let h = [...String(seed) + row.id].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
    for (let i = 0; i < v.points; i++) {
      const from = order[h % order.length], to = order[(h >>> 3) % order.length];
      h = (h * 1103515245 + 12345) >>> 0;
      if (from !== to && out[from] > set[from] && (caps[to] === undefined || out[to] < caps[to])) { out[from]--; out[to]++; }
    }
  }
  return out;
}
// Every attribute spread variance can produce (for validation): the base plus each single-point move.
export function enemyAttributeOutcomes(row, settings) {
  const fill = settings.attributeFill, v = { points: 0, among: 2, ...(settings.variance || {}), ...(row.variance || {}) }, base = resolveEnemyAttributes(row, settings);
  const outcomes = [base];
  if (!settings.variance || !v.points || !characterRule(row, settings).variance) return outcomes;
  const order = (row.attributePriority || fill.defaultPriority).slice(0, v.among), caps = { ...fill.caps, ...(row.attributeCaps || {}) };
  // Track unique spreads only: many move orders reach the same spread, and expanding duplicates grows
  // exponentially with variance.points (the schema allows up to 10).
  const seen = new Set([canonicalGameJSON(base)]);
  let frontier = [base];
  for (let step = 0; step < v.points && frontier.length; step++) {
    const next = [];
    for (const a of frontier) for (const from of order) for (const to of order) {
      if (from === to || a[from] <= (row.attributes?.[from] || 0) || (caps[to] !== undefined && a[to] >= caps[to])) continue;
      const moved = { ...a, [from]: a[from] - 1, [to]: a[to] + 1 }, key = canonicalGameJSON(moved);
      if (!seen.has(key)) { seen.add(key); next.push(moved); outcomes.push(moved); }
    }
    frontier = next;
  }
  return outcomes;
}
// A character's base rule (owner 2026-10-17: one algorithm for players and enemies). Every tag it
// carries that has a tagRules entry adds its pools and hand; budget/deck/SP ranges come from the last
// tag that sets them. Rows without tags fall back to the legacy `tier` field.
export function characterTags(row) {
  return row.tags || [`character.${row.player ? 'player' : 'enemy'}`, ...(row.tier ? [`tier.${row.tier}`] : [])];
}
export function characterRule(row, settings) {
  const rule = { pools: { hp: 0, sp: 0, mp: 0 }, hand: 0, attributeBudget: [0, 0], deckSize: [0, 99] };
  for (const tag of characterTags(row)) {
    const r = settings.tagRules?.[tag];
    if (!r) continue;
    for (const k of ['hp', 'sp', 'mp']) rule.pools[k] += r.pools?.[k] || 0;
    rule.hand += r.hand || 0;
    for (const k of ['attributeBudget', 'deckSize', 'spRange', 'deckDefault']) if (r[k]) rule[k] = r[k];
    if (r.variance) rule.variance = true;
  }
  return rule;
}
export function enemyLevel(row, settings) {
  if (Number.isSafeInteger(row.level)) return Math.max(1, row.level);
  const profile = row.levelProfile || {};
  return Math.max(1, settings.levelFrom === 'levelProfile.max' ? profile.max ?? 1 : profile.min ?? 1);
}
// Gear and relics grant attribute points only (owner 2026-10-17): `self.<attribute>=+N`,
// 0-5 points across at most 3 attributes per item. Returns the summed bonus for one enemy.
const ITEM_MODIFIER = /^self\.(strength|dexterity|constitution|wisdom|intelligence|sp|mp|hp)=([+-]\d+)$/;
const ENEMY_POOL_MODS = ['sp', 'mp', 'hp'];
// Gear is the player's gear (content.gear, resolved by the gear module) so it can be looted;
// relics are enemy relics (content.enemyRelics) with attribute modifiers.
// An enemy's default loadout (owner 2026-10-17): defaultDeck (card ids, copies allowed), defaultGear and
// defaultRelics ({ key, id } entries; key unique per enemy, e.g. mainHand, so a module can swap one slot).
export const enemyDeck = row => row.defaultDeck || [];
export const enemyGearIds = row => (row.defaultGear || []).map(entry => entry.id);
export const enemyRelicIds = row => (row.defaultRelics || []).map(entry => entry.id);
export function enemyItemBonuses(row, content = {}, gearSettings = null) {
  const bonus = Object.fromEntries([...new Set([...ENEMY_ATTRIBUTES, ...ENEMY_POOL_MODS, ...GEAR_KEYS])].map(id => [id, 0]));
  const gear = new Map((content.gear || []).map(item => [item.id, item]));
  for (const id of enemyGearIds(row)) {
    const item = gear.get(id);
    if (item && gearSettings) { const resolved = resolveGearItem(item, gearSettings); for (const a of (gearSettings.armorBudget ? GEAR_KEYS : ENEMY_ATTRIBUTES)) bonus[a] += gearSettings.armorBudget ? resolved.values[a] : resolved.points[a]; }
  }
  const relics = new Map((content.enemyRelics || []).map(item => [item.id, item]));
  for (const id of enemyRelicIds(row)) for (const modifier of relics.get(id)?.modifiers || []) {
    const match = ITEM_MODIFIER.exec(modifier);
    if (match) bonus[match[1]] += Number(match[2]);
  }
  return bonus;
}
export function enemyPools(row, settings, level = enemyLevel(row, settings), bonus = null) {
  const tier = characterRule(row, settings), round = settings.rounding === 'up' ? Math.ceil : settings.rounding === 'nearest' ? Math.round : Math.floor;
  const base = { hp: tier.pools.hp, sp: tier.pools.sp, mp: tier.pools.mp, hand: tier.hand, ar: 0, dr: 0 };
  const own = row.resolvedAttributes || resolveEnemyAttributes(row, settings);
  const attributes = Object.fromEntries(ENEMY_ATTRIBUTES.map(id => [id, Math.max(0, (own[id] || 0) + (bonus?.[id] || 0))]));
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
  if (!settings.visibility) return new Set(['hp', 'poise', 'intent', 'defense', 'statuses', 'sp', 'mp', 'cardCosts', 'deck', 'hand', 'gear', 'relics', 'attributes']);
  const shown = new Set(settings.visibility.shown);
  for (const [field, tags] of Object.entries(settings.visibility.revealedBy)) if (tags.some(tag => viewerTags.includes(tag))) shown.add(field);
  return shown;
}
// Default decks (owner 2026-10-17): entries are mostly pool keys, { pool: "strike", copies: 3 }, resolved
// through content.cardPools by the character's class tag and the gear-type tag of the item in the pool's
// slot: byClass[class][type] -> byClass[class].default -> byTag[type] -> byTag.default. Plain card ids and
// { card, copies } entries are used as written. Players and enemies draw from the same card pool.
export function resolveCharacterDeck(row, content = {}, gearSettings = null, poolRules = { weaponTypes: true }) {
  const pools = content.cardPools || {}, gear = new Map((content.gear || []).map(item => [item.id, item]));
  const bySlot = Object.fromEntries((row.defaultGear || []).map(entry => [entry.key, gear.get(entry.id)]));
  const typeTag = item => (item?.tags || []).find(tag => gearSettings?.tags?.[tag]?.group === 'type') || null;
  const classTag = characterTags(row).find(tag => tag.startsWith('class.')) || null;
  const out = [];
  for (const entry of row.defaultDeck || []) {
    if (typeof entry === 'string') { out.push(entry); continue; }
    const copies = Number.isSafeInteger(entry.copies) ? entry.copies : 1;
    let id = entry.card;
    if (entry.pool) {
      const pool = pools[entry.pool];
      if (!pool) fail(`$/content/characters/${row.id}/defaultDeck`, `unknown card pool '${entry.pool}'`);
      const type = poolRules?.weaponTypes ? typeTag(bySlot[pool.slot]) || typeTag(bySlot[pool.fallbackSlot]) : null;
      const byClass = classTag ? pool.byClass?.[classTag] : null;
      id = (type && byClass?.[type]) || byClass?.default || (type && pool.byTag?.[type]) || pool.byTag?.default;
      if (!id) fail(`$/content/characters/${row.id}/defaultDeck`, `pool '${entry.pool}' has no card for this character`);
    }
    for (let i = 0; i < copies; i++) out.push(id);
  }
  return out;
}
// Deck editing copy limits (owner 2026-10-17): basic cards (whatever the basic pools resolve to for this
// character, or a basic tag) have no limit; weapon arts, spells, specials and picked-up cards are limited
// to the copies owned. "owned" rules win over "unlimited" when a card matches both.
// Unlimited copies are earned by character tags (owner 2026-10-17): training.basic → basic-rank combat
// maneuvers; training.graduate → cantrips. Without the tag, those cards count owned copies.
export function deckCopyLimit(cardId, row, content = {}, settings = {}, gearSettings = null, owned = {}) {
  const rules = settings.deckEditing, card = (content.cards || []).find(c => c.id === cardId);
  if (!rules || !card) return owned[cardId] || 0;
  const tags = card.tags || [], have = owned[cardId] || 0, charTags = characterTags(row);
  const fromPools = pools => new Set((pools || []).flatMap(pool => content.cardPools?.[pool] ? resolveCharacterDeck({ ...row, defaultDeck: [{ pool, copies: 1 }] }, content, gearSettings, settings.cardPoolRules) : []));
  if ((rules.owned.tags || []).some(t => tags.includes(t)) || fromPools(rules.owned.pools).has(cardId)) return have;
  for (const rule of rules.unlimited) {
    if (!charTags.includes(rule.requiresTag)) continue;
    const c = rule.cards || {};
    const matches = (!c.rarity || c.rarity.includes(card.rarity)) && (!c.tagsAny || c.tagsAny.some(t => tags.includes(t))) && (!c.tagsAll || c.tagsAll.every(t => tags.includes(t)));
    if (fromPools(rule.pools).has(cardId) || ((c.rarity || c.tagsAny || c.tagsAll) && matches)) return Infinity;
  }
  return rules.default === 'unlimited' ? Infinity : have;
}
// Enemies and players share the characters module's rules; enemy-only rules stay in the enemies module.
// One settings view over the character-related modules (owner 2026-10-17: features split into modules).
// A missing module leaves its field null, and that feature is off.
export function characterSettings(modules) {
  if (!modules.enemies && !modules.characters) return null;
  return { ...(modules.enemies || {}), ...(modules.characters || {}),
    healRules: modules['heal-rules'] || null, stagger: modules.stagger || null, visibility: modules['enemy-visibility'] || null,
    equipment: modules['enemy-relics']?.equipment || null, variance: modules['attribute-variance'] || null,
    deckEditing: modules['deck-training'] || null, cardPoolRules: modules['card-pools'] || null, rewardRanks: modules['reward-ranks'] || null };
}
// characters.json (owner 2026-10-17): players and enemies in one shape; tags decide which block applies.
// Derives the legacy views the game still reads (content.classes, content.enemies) and merges enemy cards
// into the one shared card pool. HP etc. use the same algorithm for both (characterRule + statRules).
function deriveCharacterContent(content, modules) {
  // enemies off: the enemy pack data is ignored (enemies/guide.md, Disabled), whatever characters is set to.
  if (!modules.enemies) {
    delete content.enemyCards; delete content.enemies; delete content.enemyRelics;
    if (!modules.characters && Array.isArray(content.characters)) content.characters = content.characters.filter(c => !c.tags?.includes('character.enemy'));
  }
  // Enemy rows, stats and decks come from the characters module (characters.json); enemies cannot run without it.
  if (modules.enemies && !modules.characters) fail('$/modules/enemies', 'requires the characters module; enable characters or disable enemies');
  if (!modules.characters || !Array.isArray(content.characters)) return;
  const settings = characterSettings(modules);
  // enemy-relics off: enemies carry no relics.
  if (!settings.equipment) for (const c of content.characters) if (c.tags?.includes('character.enemy')) c.defaultRelics = [];
  if (Array.isArray(content.enemyCards) && !content.enemyCardsMerged) {
    const existing = new Set((content.cards || []).map(card => card.id));
    const added = content.enemyCards.filter(card => !existing.has(card.id));
    content.cards = [...(content.cards || []), ...added];
    // Same rule as player cards: a disabled pool's cost drops to 0 in that profile's variant.
    content.resourceVariants = { ...(content.resourceVariants || {}) };
    for (const card of added) if (!content.resourceVariants[card.id]) content.resourceVariants[card.id] = Object.fromEntries([['none', [false, false]], ['sp', [true, false]], ['mp', [false, true]], ['sp,mp', [true, true]]]
      .map(([key, [sp, mp]]) => [key, { cost: sp ? card.staminaCost : 0, staminaCost: sp ? card.staminaCost : 0, manaCost: mp ? card.manaCost : 0 }]));
    content.enemyCardsMerged = true;
  }
  const players = content.characters.filter(c => c.tags?.includes('character.player'));
  const enemies = content.characters.filter(c => c.tags?.includes('character.enemy'));
  const flat = c => ({ ...c, ...(c.presentation || {}), ...(c.enemy || {}), ...(c.player || {}) });
  if (modules.enemies) content.enemies = enemies.map(c => { const row = flat(c); row.defaultDeck = resolveCharacterDeck(c, content, modules.gear, settings.cardPoolRules); row.tier = (c.tags.find(t => t.startsWith('tier.')) || 'tier.minion').slice(5); delete row.presentation; delete row.enemy; return row; })
    // include picks the fielded tiers: rows of a known but unselected tier are dropped; an unknown tier still fails validation.
    .filter(row => !Array.isArray(settings.include) || settings.include.includes(row.tier) || !settings.tagRules?.[`tier.${row.tier}`]);
  content.classes = players.map(c => {
    const row = flat(c), gear = Object.fromEntries((c.defaultGear || []).map(g => [g.key, g.id]));
    // Player loadouts slot real items (createLoadout): an unknown gear id would start the run without its cards/stats.
    if (Array.isArray(content.gear)) { const known = new Set(content.gear.map(g => g.id)); for (const g of c.defaultGear || []) if (!known.has(g.id)) fail(`$/content/characters/${c.id}/defaultGear`, `unresolved gear '${g.id}'`); }
    const attributes = resolveEnemyAttributes(c, settings);
    const pools = enemyPools({ ...c, resolvedAttributes: attributes }, settings, enemyLevel(c, settings), enemyItemBonuses(c, content, modules.gear));
    const deck = resolveCharacterDeck(c, content, modules.gear, settings.cardPoolRules), cards = new Set((content.cards || []).map(card => card.id));
    for (const id of deck) if (!cards.has(id)) fail(`$/content/characters/${c.id}/defaultDeck`, `unresolved card '${id}'`);
    return { id: c.id, name: row.displayName || displayName(c.name), attributes, defaultDeck: deck, loadout: { rightHand: gear.mainHand ?? null, leftHand: gear.offHand ?? null }, specialCardId: row.specialCardId, maxHp: pools.hp, ...(row.description ? { description: row.description } : {}) };
  });
  if (Array.isArray(content.enemyCards) && !content.enemyCardsMerged) {
    const existing = new Set((content.cards || []).map(card => card.id));
    content.cards = [...(content.cards || []), ...content.enemyCards.filter(card => !existing.has(card.id))];
    content.enemyCardsMerged = true;
  }
}
function verifyEnemyContent(content, settings, gearSettings = null) {
  if (!settings) return;
  const base = '$/content/enemies';
  if (!Array.isArray(content.enemies) || !Array.isArray(content.enemyCards)) fail(base, 'enemies module requires enemies and enemyCards pack content');
  const cards = new Map(content.enemyCards.map(card => [card.id, card]));
  if (cards.size !== content.enemyCards.length) fail('$/content/enemyCards', 'duplicate enemy card ID');
  const playerCards = new Map((content.cards || []).map(card => [card.id, card]));
  // Enemy gear is player gear (lootable); relics are enemy relics with attribute modifiers.
  const gear = new Set((content.gear || []).map(row => row.id)), relics = new Set((content.enemyRelics || []).map(row => row.id));
  for (const [kind, rows] of settings.equipment ? [['enemyRelics', content.enemyRelics || []]] : [])
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
  verifyNames(content.enemies, '$/content/enemies'); verifyNames(content.enemyCards, '$/content/enemyCards'); verifyNames(content.enemyRelics, '$/content/enemyRelics');
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
    const hint = (content.enemies || []).map(e => e.cardHints?.[card.id]).find(Boolean);
    if (settings.healRules && card.tags.includes('fx:heal') && (hint?.costSource ?? 'healRules') === 'healRules') {
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
    const tier = characterRule(row, settings);
    if (!settings.include.includes(row.tier)) fail(`${at}/tier`, 'unknown or excluded tier');
    if (row.attributes !== undefined && (!record(row.attributes) || Object.keys(row.attributes).some(k => !ENEMY_ATTRIBUTES.includes(k)) || Object.values(row.attributes).some(n => !Number.isSafeInteger(n) || n < 0))) fail(`${at}/attributes`, 'expected nonnegative integer attributes');
    for (const id of row.attributePriority || []) if (!ENEMY_ATTRIBUTES.includes(id)) fail(`${at}/attributePriority`, `unknown attribute '${id}'`);
    const total = Object.values(resolveEnemyAttributes(row, settings)).reduce((a, b) => a + b, 0);
    if (total < tier.attributeBudget[0] || total > tier.attributeBudget[1]) fail(`${at}/attributes`, `total ${total} outside ${row.tier} budget`);
    if (!Array.isArray(row.defaultDeck)) fail(`${at}/defaultDeck`, 'expected defaultDeck array');
    for (const list of ['defaultGear', 'defaultRelics']) {
      const entries = row[list] || [];
      if (!Array.isArray(entries) || entries.some(e => !record(e) || typeof e.key !== 'string' || typeof e.id !== 'string')) fail(`${at}/${list}`, 'expected [{ key, id }] entries');
      if (new Set(entries.map(e => e.key)).size !== entries.length) fail(`${at}/${list}`, 'duplicate key');
    }
    const [min, max] = [Math.max(settings.deck.min, tier.deckSize[0]), Math.min(settings.deck.max, tier.deckSize[1])];
    if (row.defaultDeck.length < min || row.defaultDeck.length > max) fail(`${at}/defaultDeck`, `deck size ${row.defaultDeck.length} outside ${min}-${max}`);
    // Check the worst case: every spread variance can produce must still pay for every card.
    const bonus = enemyItemBonuses(row, content, gearSettings), outcomes = enemyAttributeOutcomes(row, settings).map(a => enemyPools({ ...row, resolvedAttributes: a }, settings, enemyLevel(row, settings), bonus));
    const pools = { ...outcomes[0], sp: Math.min(...outcomes.map(o => o.sp)), mp: Math.min(...outcomes.map(o => o.mp)) };
    if (tier.spRange && (pools.sp < tier.spRange[0] || pools.sp > tier.spRange[1])) fail(`${at}/attributes`, `SP ${pools.sp} outside ${row.tier} range ${tier.spRange[0]}-${tier.spRange[1]}`);
    for (const id of [...row.defaultDeck, ...(row.unlockCards || []), ...(row.firstCard ? [row.firstCard] : [])]) {
      const card = cards.get(id) || playerCards.get(id);
      if (!card) fail(`${at}/defaultDeck`, `unresolved card reference '${id}'`);
      if (card && ((card.staminaCost || 0) > pools.sp || (card.manaCost || 0) > pools.mp)) fail(`${at}/defaultDeck`, `'${id}' costs ${card.staminaCost || 0} SP/${card.manaCost || 0} MP; enemy has ${pools.sp} SP/${pools.mp} MP`);
    }
    for (const id of enemyGearIds(row)) if (!gear.has(id)) fail(`${at}/defaultGear`, `unresolved gear '${id}'`);
    for (const id of enemyRelicIds(row)) if (!relics.has(id)) fail(`${at}/defaultRelics`, `unresolved relic '${id}'`);
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
// firstFloor must hold the rules the map build applies (src/engine/actmap.js), so a Rest-first author fails at resolve time, where a stored
// profile falls back, instead of at New Game. The node types live in the pack's route content, not in the module settings.
function verifyRouteFirstFloor(modules, content) {
  const routes = modules.routes;
  if (routes?.mode !== 'configured' || !record(content?.routes)) return;
  const {firstFloor = null, restFloors, minimumThreatFloor} = routes;
  if (firstFloor === null) return;
  const alternatives = [...new Set([...(content.routes.hiddenTypes || []), ...(content.routes.visibleTypes || [])])].filter(type => !['rest', 'boss'].includes(type));
  if (!alternatives.includes(firstFloor) || restFloors.includes(1) || (firstFloor === 'elite' && minimumThreatFloor > 1)) fail('$/modules/routes/firstFloor', 'must be a non-rest, non-boss route node type, depth 1 cannot be a rest floor, and an elite needs minimumThreatFloor of 1');
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
  deriveCharacterContent(content, modules);
  if (modules['reward-ranks'] && record(content.rewards)) { const { mode: _m, ...rule } = modules['reward-ranks']; content.rewards = { ...content.rewards, eligibility: { ...(content.rewards.eligibility || {}), combatCards: rule } }; }
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
  verifyRouteFirstFloor(modules, content);
  verifyContent(content); verifyGearContent(content, modules.gear); verifyEnemyContent(content, modules.enemies ? characterSettings(modules) : null, modules.gear);
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
  verifySettings(value.modules, value.instances); verifyRouteFirstFloor(value.modules, value.content); verifyContent(value.content); verifyGearContent(value.content, value.modules.gear); verifyEnemyContent(value.content, value.modules.enemies ? characterSettings(value.modules) : null, value.modules.gear);
  return freezeGameData({...value,hash});
}
