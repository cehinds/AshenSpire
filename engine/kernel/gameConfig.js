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
    if (schema.uniqueItems && new Set(value.map(canonicalGameJSON)).size !== value.length) fail(path, 'duplicate array item');
    value.forEach((item, i) => validateGameSchema(item, schema.items || {}, `${path}/${i}`));
  } else if (type === 'string' && (typeof value !== 'string' || value.length < (schema.minLength || 0))) fail(path, 'expected nonempty string');
  else if (type === 'boolean' && typeof value !== 'boolean') fail(path, 'expected boolean');
  else if (type === 'integer' && !Number.isSafeInteger(value)) fail(path, 'expected safe integer');
  else if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) fail(path, 'expected finite number');
  if (typeof value === 'number' && (value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity))) fail(path, 'outside permitted numeric range');
}
function verifyContent(content) {
  if (!content.classes) return;
  const cards = new Set(content.cards.map(card => card.id));
  if (cards.size !== content.cards.length) fail('$/content/cards', 'duplicate card ID');
  for (const row of content.classes) if (!cards.has(row.specialCardId)) fail(`$/content/classes/${row.id}/specialCardId`, 'unresolved card reference');
  for (const row of content.starterDeck.shared) if (!cards.has(row.card) || !Number.isSafeInteger(row.copies) || row.copies < 1) fail('$/content/starterDeck/shared', 'invalid starter card reference/count');
}
function verifySettings(modules) {
  const defenses = modules.defenses;
  if (defenses && (defenses.include.length !== defenses.order.length || defenses.include.some(id => !defenses.order.includes(id)))) fail('$/modules/defenses/order', 'must contain selected defenses exactly once');
  for (const [id, available] of [['resources',['hp','sp','mp','actions']],['defenses',['block','poise','barrier','ward']],['stances',['attack','smash','defend','counter','sweep','prepared','evade']],['damage-types',['physical','magic']]]) {
    if (modules[id] && modules[id].include.some(key => !available.includes(key))) fail(`$/modules/${id}/include`, 'unresolved instance reference');
  }
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
  const modules = {}, schemas = {}, provenance = {};
  for (const id of Object.keys(source.modules)) if (!catalog.modules[id]) fail(`$/modules/${id}`, 'unknown module ID');
  for (const [id, module] of Object.entries(catalog.modules)) {
    const entry = Object.hasOwn(source.modules,id) ? source.modules[id] : undefined, bundled = bundle.manifest.modules[id];
    if (entry !== undefined && entry !== false && entry !== true && !record(entry)) fail(`$/modules/${id}`, 'expected false, true or settings object');
    if (entry === false || (entry === undefined && !bundled)) { modules[id] = false; continue; }
    if (bundled && bundled.version !== module.manifest.version) fail(`$/modules/${id}`, 'exact module version unavailable');
    const defaults = mergeGameSettings(module.defaults, bundled?.settings || {});
    modules[id] = record(entry) ? mergeGameSettings(defaults, entry) : defaults;
    validateGameSchema(modules[id], module.schema, `$/modules/${id}`); schemas[id] = module.schema;
    provenance[id] = entry === undefined ? 'bundle' : 'author';
  }
  verifySettings(modules);
  let content = {};
  for (const ref of bundle.manifest.packs) {
    const pack = catalog.packs[`${ref.id}@${ref.version}`];
    if (!pack) fail('$/core/packs', `unresolved exact pack ${ref.id}@${ref.version}`);
    for (const [key,value] of Object.entries(pack.content)) { if (key in content) fail(`$/content/${key}`, 'duplicate pack content key'); content[key] = dataClone(value); }
  }
  verifyContent(content);
  if (content.classes) {
    content.classAttributes = Object.fromEntries(content.classes.map(row => [row.id, row.attributes]));
    content.startingHands = Object.fromEntries(content.classes.map(row => [row.id, content.stats.handBase + row.attributes.intelligence]));
  }
  const artifacts = [...catalog.runtimeArtifacts, ...bundle.artifacts,
    ...Object.entries(modules).filter(([,v]) => v).flatMap(([id]) => catalog.modules[id].artifacts),
    ...bundle.manifest.packs.flatMap(ref => catalog.packs[`${ref.id}@${ref.version}`].artifacts)];
  const profile = {id:bundle.manifest.profileId,formatVersion:1,author:source,modules,content,
    foundation:{...catalog.foundation,mode:bundle.manifest.foundationMode},
    contracts:catalog.contracts,schemas,provenance,
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
  verifySettings(value.modules); verifyContent(value.content);
  return freezeGameData({...value,hash});
}
