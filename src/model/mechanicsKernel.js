// Shared attachment compiler and calculation-stage evaluator. No host state is
// replaced here: live mounts supply active sources, and receipts are pure data.
import { evaluateRaw } from './formulas.js';

export const jsonEqual = (a, b) => {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && jsonEqual(a[k], b[k]));
};
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const fail = (path, message) => { throw new Error(`${path}: ${message}`); };
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const merge = (a, b) => {
  const out = structuredClone(a);
  for (const [k, v] of Object.entries(b)) out[k] = plain(v) && plain(out[k]) ? merge(out[k], v) : structuredClone(v);
  return out;
};
export function parameterDefaults(schema) {
  const out = {};
  for (const [key, row] of Object.entries(schema?.properties || {})) {
    if (Object.hasOwn(row, 'default')) out[key] = structuredClone(row.default);
    else if (row.type === 'object') out[key] = parameterDefaults(row);
  }
  return out;
}
// The supported parameter subset is deliberately closed; misspelled gameplay
// fields must never become an apparently valid but inert configuration.
export function validateParameters(schema, value, path = '$parameters', partial = false) {
  if (!schema) { if (Object.keys(value || {}).length) fail(path, 'mechanic declares no parameters'); return value; }
  if (schema.type === 'object') {
    if (!plain(value)) fail(path, 'expected object');
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(schema.properties || {}, key)) fail(`${path}.${key}`, 'unknown parameter');
      validateParameters(schema.properties[key], value[key], `${path}.${key}`, partial);
    }
    if (!partial) for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, 'required parameter');
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) fail(path, 'expected array');
    value.forEach((x, i) => validateParameters(schema.items, x, `${path}[${i}]`));
  } else if (['number', 'integer'].includes(schema.type)) {
    if (!Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value))) fail(path, `expected finite ${schema.type}`);
    if (schema.minimum !== undefined && value < schema.minimum) fail(path, `must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) fail(path, `must be <= ${schema.maximum}`);
  } else if (schema.type && typeof value !== schema.type) fail(path, `expected ${schema.type}`);
  if (schema.enum && !schema.enum.includes(value)) fail(path, `must be one of ${schema.enum.join(', ')}`);
  return value;
}

export function validateParameterSchema(schema, path = '$schema') {
  if (!plain(schema) || !['object','array','number','integer','string','boolean'].includes(schema.type)) fail(path, 'unsupported parameter schema type');
  const allowed = ['type','properties','required','additionalProperties','items','default','minimum','maximum','enum','description','title'];
  for (const key of Object.keys(schema)) if (!allowed.includes(key)) fail(`${path}.${key}`, 'unsupported parameter schema field');
  if ((schema.minimum !== undefined || schema.maximum !== undefined) && !['number','integer'].includes(schema.type)) fail(path, 'numeric bounds require a numeric parameter');
  if (schema.enum !== undefined && (!Array.isArray(schema.enum) || !schema.enum.length)) fail(`${path}.enum`, 'expected nonempty array');
  if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) fail(`${path}.additionalProperties`, 'parameters must be closed');
  if (schema.minimum !== undefined && !Number.isFinite(schema.minimum) || schema.maximum !== undefined && !Number.isFinite(schema.maximum)) fail(path, 'parameter bounds must be finite');
  if (schema.minimum !== undefined && schema.maximum !== undefined && schema.minimum > schema.maximum) fail(path, 'inverted parameter bounds');
  if (schema.type === 'object') {
    if (!plain(schema.properties)) fail(`${path}.properties`, 'expected object');
    for (const [key, child] of Object.entries(schema.properties)) validateParameterSchema(child, `${path}.properties.${key}`);
    for (const key of schema.required || []) if (!Object.hasOwn(schema.properties,key)) fail(`${path}.required`, `unknown parameter ${key}`);
  }
  if (schema.type === 'array') validateParameterSchema(schema.items, `${path}.items`);
  if (Object.hasOwn(schema,'default')) validateParameters(schema,schema.default,`${path}.default`);
}

export function compileBindings({ mechanics, attachments = [], moduleParameters = {}, enabledMechanics } = {}) {
  if (!(mechanics instanceof Map)) fail('$mechanics', 'expected registered mechanic Map');
  for (const [slug, mechanic] of mechanics) if (mechanic.manifest.parameters) validateParameterSchema(mechanic.manifest.parameters, `mechanics.${slug}.parameters`);
  for (const [slug, values] of Object.entries(moduleParameters)) {
    if (!mechanics.has(slug)) fail(`moduleParameters.${slug}`, 'unknown mechanic');
    validateParameters(mechanics.get(slug).manifest.parameters, values, `moduleParameters.${slug}`, true);
  }
  const tags = new Map();
  for (const [slug, mechanic] of mechanics) {
    const tag = mechanic.manifest.tag;
    if (!tag || mechanic.manifest.portability === 'data') continue;
    if (tags.has(tag)) fail(`mechanics.${slug}.tag`, `duplicate behavior tag ${tag}`);
    tags.set(tag, mechanic);
  }
  const knownTags = new Set([...mechanics.values()].map(m => m.manifest.tag));
  const behaviorFamilies = new Set([...tags.keys()].map(tag => tag.split(':')[0]));
  const out = [], seen = new Set();
  for (const [i, source] of attachments.entries()) {
    const path = `attachments[${i}]`;
    for (const key of ['ownerId', 'sourceInstanceId', 'kind']) if (typeof source[key] !== 'string' || !source[key]) fail(`${path}.${key}`, 'required nonempty string');
    for (const tag of source.tags || []) if (behaviorFamilies.has(String(tag).split(':')[0]) && !knownTags.has(tag)) fail(`${path}.tags`, `unknown behavior tag ${tag}`);
    for (const tag of source.mechanicTags || []) if (!tags.has(tag)) fail(`${path}.mechanicTags`, `unknown behavior tag ${tag}`);
    const explicit = new Map();
    for (const [j, row] of (source.mechanicBindings || []).entries()) {
      const at = `${path}.mechanicBindings[${j}]`;
      for (const key of Object.keys(row)) if (!['tag', 'parameters', 'upgradeParameters', 'enabled'].includes(key)) fail(`${at}.${key}`, 'unknown binding field');
      if (!tags.has(row.tag)) fail(`${at}.tag`, `unknown behavior tag ${row.tag}`);
      if (explicit.has(row.tag)) fail(`${at}.tag`, `duplicate binding ${row.tag}`);
      if (row.enabled !== undefined && typeof row.enabled !== 'boolean') fail(`${at}.enabled`, 'expected boolean');
      explicit.set(row.tag, row);
    }
    // Classification/presentation tags do not activate behavior; an explicit
    // mechanicBindings row always requires a registered behavior tag.
    for (const tag of new Set([...(source.tags || []).filter(t => tags.has(t)), ...(source.mechanicTags || []), ...explicit.keys()])) {
      const mechanic = tags.get(tag), manifest = mechanic.manifest, row = explicit.get(tag) || {};
      if (!(manifest.attaches || []).includes(source.kind)) fail(`${path}.${tag}`, `cannot attach to ${source.kind}`);
      for (const required of mechanic.interface?.requires || []) {
        if (!mechanics.has(required)) fail(`${path}.${tag}`, `requires unknown mechanic ${required}`);
        if (enabledMechanics && !enabledMechanics.has(required)) fail(`${path}.${tag}`, `requires disabled mechanic ${required}`);
      }
      const schema = manifest.parameters;
      let config = parameterDefaults(schema);
      validateParameters(schema, config, `${path}.${tag}.defaults`, true);
      for (const [layer, values] of [['module', moduleParameters[manifest.id] || {}], ['parameters', row.parameters || {}], ['upgradeParameters', row.upgradeParameters || {}]]) {
        validateParameters(schema, values, `${path}.${tag}.${layer}`, true);
        config = merge(config, values);
      }
      validateParameters(schema, config, `${path}.${tag}.config`);
      if (source.active === false || row.enabled === false || (enabledMechanics && !enabledMechanics.has(manifest.id))) continue;
      const id = JSON.stringify([source.ownerId, source.sourceInstanceId, manifest.id]);
      if (seen.has(id)) fail(path, `duplicate attachment ${id}`);
      seen.add(id);
      validateModifiers((mechanic.service.modifiers || []).filter(x => x.phase !== undefined), `${path}.${tag}.modifiers`);
      const behaviors = (mechanic.service.handlers || []).length + (mechanic.service.modifiers || []).length + Object.keys(mechanic.interface?.queries || {}).length;
      if (!behaviors) fail(`${path}.${tag}`, 'required mechanic has no executable behavior');
      out.push(freeze({ id, mechanicId: manifest.id, tag, ownerId: source.ownerId, sourceInstanceId: source.sourceInstanceId,
        stateKey: manifest.stateScope === 'run' || manifest.stateScope === 'combat' ? JSON.stringify([manifest.stateScope, manifest.id]) : id,
        label: source.label || manifest.label, config, interface: structuredClone(mechanic.interface || {}), service: structuredClone(mechanic.service) }));
    }
  }
  return Object.freeze(out.sort((a, b) => compare(a.id,b.id)));
}

export function resolveValue(node, scope = {}) {
  if (typeof node === 'string' && node.startsWith('$')) {
    let value = scope;
    for (const key of node.slice(1).split('.')) {
      if (value == null || !Object.hasOwn(value, key)) fail(node, 'unresolved reference');
      value = value[key];
    }
    return value;
  }
  if (Array.isArray(node)) return node.map(x => resolveValue(x, scope));
  if (plain(node)) {
    const value = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, resolveValue(v, scope)]));
    if (typeof value.f === 'string') {
      const scalar = evaluateRaw(value, scope);
      if (!Number.isFinite(scalar)) fail('$formula', 'nonfinite scalar');
      return scalar;
    }
    return value;
  }
  return node;
}
export function evaluateCondition(node, scope, resolve = value => resolveValue(value, scope)) {
  if (!plain(node) || Object.keys(node).length !== 1) fail('$when', 'expected one condition operator');
  if (node.all) return node.all.every(c => evaluateCondition(c, scope, resolve));
  if (node.any) return node.any.some(c => evaluateCondition(c, scope, resolve));
  if (node.not) return !evaluateCondition(node.not, scope, resolve);
  if (node.cmp) {
    const [op, a, b] = node.cmp, x = resolve(a), y = resolve(b);
    if (!['==', '!='].includes(op) && !(Number.isFinite(x) && Number.isFinite(y))) fail('$when.cmp', 'cmp ordering needs two numbers (finite)');
    switch (op) { case '>': return x > y; case '>=': return x >= y; case '<': return x < y; case '<=': return x <= y; case '==': return jsonEqual(x, y); case '!=': return !jsonEqual(x, y); default: fail('$when.cmp', `unknown comparator ${op}`); }
  }
  for (const operator of ['hasTag', 'hasStatus']) if (node[operator]) {
    const [ref, name] = node[operator], target = resolve(ref), id = resolve(name);
    const entity = typeof target === 'string' ? scope.entities?.[target] : target;
    if (!entity) fail('$when.'+operator, 'unknown entity reference');
    return operator === 'hasTag' ? (entity.tags || []).includes(id) : (typeof entity.statuses?.[id] === 'number' ? entity.statuses[id] : entity.statuses?.[id]?.stacks || 0) > 0;
  }
  fail('$when', 'unknown condition');
}

export function queryBinding(binding, query = 'parameters', params = {}) {
  const definition = binding.interface?.queries?.[query];
  if (!definition) fail(`${binding.mechanicId}.${query}`, 'unknown binding query');
  for (const key of Object.keys(params)) if (!Object.hasOwn(definition.params || {},key)) fail(`${binding.mechanicId}.${query}.${key}`, 'unknown query parameter');
  // Parameter config is immutable; the returned query is a separate frozen
  // value, so inspection never exposes a mutable reference to live state.
  return freeze(structuredClone(resolveValue(definition.value, {...params,config:binding.config})));
}

export const CALCULATION_PHASES = Object.freeze(['stat.derived', 'cost.resource', 'effect.amount', 'damage.mitigation', 'roll.accuracy', 'roll.perception']);
const MODIFIER_FIELDS = ['id', 'phase', 'subject', 'when', 'select', 'operation', 'value', 'stacking', 'priority', 'after'];
export function validateModifiers(modifiers = [], path = '$modifiers') {
  const ids = new Set();
  for (const [i, row] of modifiers.entries()) {
    const at = `${path}[${i}]`;
    for (const key of Object.keys(row)) if (!MODIFIER_FIELDS.includes(key)) fail(`${at}.${key}`, 'unknown modifier field');
    for (const key of ['id', 'phase']) if (typeof row[key] !== 'string' || !row[key]) fail(`${at}.${key}`, 'required nonempty string');
    if (!CALCULATION_PHASES.includes(row.phase)) fail(`${at}.phase`, `unknown calculation phase ${row.phase}`);
    if (ids.has(row.id)) fail(`${at}.id`, `duplicate modifier ${row.id}`); ids.add(row.id);
    if (!['target', 'actor', 'owner'].includes(row.subject)) fail(`${at}.subject`, 'expected target, actor or owner');
    if (!['multiply', 'add'].includes(row.operation)) fail(`${at}.operation`, `unknown operation ${row.operation}`);
    if (row.value === undefined || !(Number.isFinite(row.value) || typeof row.value === 'string' && row.value.startsWith('$') || plain(row.value) && typeof row.value.f === 'string')) fail(`${at}.value`, 'expected scalar or reference/formula');
    if (row.priority !== undefined && !Number.isFinite(row.priority)) fail(`${at}.priority`, 'expected finite number');
    if (!row.stacking?.group || !['strongest', 'additive', 'multiplicative', 'exclusive'].includes(row.stacking.mode)) fail(`${at}.stacking`, 'explicit group and supported mode required');
    for (const key of Object.keys(row.stacking)) if (!['group','mode','selection'].includes(key)) fail(`${at}.stacking.${key}`, 'unknown stacking field');
    if (row.stacking.selection !== undefined && !['minimum','maximum'].includes(row.stacking.selection)) fail(`${at}.stacking.selection`, 'expected minimum or maximum');
    if (row.stacking.mode === 'additive' && row.operation !== 'add' || row.stacking.mode === 'multiplicative' && row.operation !== 'multiply') fail(`${at}.stacking`, 'stacking mode does not match operation');
    if (row.select && (!plain(row.select) || Object.keys(row.select).some(k => k !== 'damageKind') || !['physical', 'magical'].includes(row.select.damageKind))) fail(`${at}.select`, 'unknown damage selector');
    if (row.after !== undefined && (!Array.isArray(row.after) || row.after.some(x => typeof x !== 'string'))) fail(`${at}.after`, 'expected modifier ID array');
  }
  const visiting = new Set(), visited = new Set();
  const visit = id => {
    if (visiting.has(id)) fail(path, `dependency cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of modifiers.find(x => x.id === id)?.after || []) {
      if (!ids.has(dep)) fail(path, `unknown modifier dependency ${dep}`);
      visit(dep);
    }
    visiting.delete(id); visited.add(id);
  };
  ids.forEach(visit);
}

export function evaluateModifiers({ bindings = [], phase, subjectId, actorId, context = {}, amount, quantity = false }) {
  if (!Number.isFinite(amount)) fail('$amount', 'expected finite number');
  const candidates = [];
  for (const binding of bindings) {
    validateModifiers(binding.service.modifiers);
    const scope = { ...context, config: binding.config, owner: context.entities?.[binding.ownerId] || context.owner };
    for (const row of binding.service.modifiers || []) {
      if (row.phase !== phase || row.subject === 'target' && binding.ownerId !== subjectId || row.subject === 'actor' && binding.ownerId !== actorId) continue;
      if (row.select && Object.entries(row.select).some(([key, value]) => context[key] !== value)) continue;
      if (row.when && !evaluateCondition(row.when, scope)) continue;
      const value = resolveValue(row.value, scope);
      if (!Number.isFinite(value)) fail(`${binding.id}.${row.id}`, 'expected finite scalar');
      candidates.push({ ...row, value, binding });
    }
  }
  const groups = new Map();
  for (const row of candidates.sort((a, b) => compare(a.binding.id,b.binding.id) || compare(a.id,b.id))) {
    const group = row.stacking.group, previous = groups.get(group);
    if (previous && (previous[0].stacking.mode !== row.stacking.mode || previous[0].operation !== row.operation || previous[0].stacking.selection !== row.stacking.selection)) fail(group, 'conflicting stacking policy');
    if (!previous) groups.set(group, [row]);
    else if (row.stacking.mode === 'exclusive') fail(group, 'conflicting exclusive modifiers');
    else if (row.stacking.mode === 'strongest') { const minimum = row.stacking.selection ? row.stacking.selection === 'minimum' : row.operation === 'multiply'; if (minimum ? row.value < previous[0].value : row.value > previous[0].value) groups.set(group, [row]); }
    else previous.push(row);
  }
  const pending = [...groups.values()].flat().sort((a, b) => (a.priority || 0) - (b.priority || 0) || compare(a.stacking.group,b.stacking.group) || compare(a.binding.id,b.binding.id) || compare(a.id,b.id));
  const ordered = [], done = new Set();
  while (pending.length) {
    const index = pending.findIndex(row => (row.after || []).every(dep => done.has(`${row.binding.id}/${dep}`) || !pending.some(x => x.binding.id === row.binding.id && x.id === dep)));
    if (index < 0) fail('$modifiers', 'dependency cycle');
    const [row] = pending.splice(index, 1); ordered.push(row); done.add(`${row.binding.id}/${row.id}`);
  }
  let value = amount;
  const sources = ordered.map(row => {
    const before = value; value = row.operation === 'multiply' ? value * row.value : value + row.value;
    if (!Number.isFinite(value)) fail(row.id, 'nonfinite result');
    return { id: row.binding.id, modifierId: row.id, mechanicId: row.binding.mechanicId, tag: row.binding.tag,
      ownerId: row.binding.ownerId, sourceInstanceId: row.binding.sourceInstanceId, label: row.binding.label,
      group: row.stacking.group, stage: phase, operation: row.operation, multiplier: row.operation === 'multiply' ? row.value : undefined,
      value: row.value, requested: before, effective: value, amount: value - before };
  });
  const final = quantity ? Math.max(0, Math.floor(value)) : value;
  return { requested: amount, amount: final, unrounded: value, rounding: final - value, sources };
}
