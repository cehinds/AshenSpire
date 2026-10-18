// Shared attachment compiler and calculation-stage evaluator. No host state is
// replaced here: live mounts supply active sources, and receipts are pure data.
import { evaluateRaw } from './formulas.js';

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

export function compileBindings({ mechanics, attachments = [], moduleParameters = {}, enabledMechanics } = {}) {
  if (!(mechanics instanceof Map)) fail('$mechanics', 'expected registered mechanic Map');
  const tags = new Map();
  for (const [slug, mechanic] of mechanics) {
    const tag = mechanic.manifest.tag;
    if (!tag || mechanic.manifest.portability === 'data') continue;
    if (tags.has(tag)) fail(`mechanics.${slug}.tag`, `duplicate behavior tag ${tag}`);
    tags.set(tag, mechanic);
  }
  const out = [], seen = new Set();
  for (const [i, source] of attachments.entries()) {
    const path = `attachments[${i}]`;
    for (const key of ['ownerId', 'sourceInstanceId', 'kind']) if (typeof source[key] !== 'string' || !source[key]) fail(`${path}.${key}`, 'required nonempty string');
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
    for (const tag of new Set([...(source.tags || []).filter(t => tags.has(t)), ...explicit.keys()])) {
      const mechanic = tags.get(tag), manifest = mechanic.manifest, row = explicit.get(tag) || {};
      if (!(manifest.attaches || []).includes(source.kind)) fail(`${path}.${tag}`, `cannot attach to ${source.kind}`);
      const schema = manifest.parameters;
      let config = parameterDefaults(schema);
      validateParameters(schema, config, `${path}.${tag}.defaults`);
      for (const [layer, values] of [['module', moduleParameters[manifest.id] || {}], ['parameters', row.parameters || {}], ['upgradeParameters', row.upgradeParameters || {}]]) {
        validateParameters(schema, values, `${path}.${tag}.${layer}`, true);
        config = merge(config, values);
      }
      validateParameters(schema, config, `${path}.${tag}.config`);
      if (source.active === false || row.enabled === false || (enabledMechanics && !enabledMechanics.has(manifest.id))) continue;
      const id = JSON.stringify([source.ownerId, source.sourceInstanceId, manifest.id]);
      if (seen.has(id)) fail(path, `duplicate attachment ${id}`);
      seen.add(id);
      const behaviors = (mechanic.service.handlers || []).length + (mechanic.service.modifiers || []).length;
      if (!behaviors && manifest.portability === 'portable') fail(`${path}.${tag}`, 'required mechanic has no executable behavior');
      out.push(freeze({ id, mechanicId: manifest.id, tag, ownerId: source.ownerId, sourceInstanceId: source.sourceInstanceId,
        label: source.label || manifest.label, config, service: structuredClone(mechanic.service) }));
    }
  }
  return Object.freeze(out.sort((a, b) => a.id.localeCompare(b.id)));
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
export function evaluateCondition(node, scope) {
  if (!plain(node) || Object.keys(node).length !== 1) fail('$when', 'expected one condition operator');
  if (node.all) return node.all.every(c => evaluateCondition(c, scope));
  if (node.any) return node.any.some(c => evaluateCondition(c, scope));
  if (node.not) return !evaluateCondition(node.not, scope);
  if (node.cmp) {
    const [op, a, b] = node.cmp, x = resolveValue(a, scope), y = resolveValue(b, scope);
    if (!['==', '!='].includes(op) && !(Number.isFinite(x) && Number.isFinite(y))) fail('$when.cmp', 'ordered comparison needs finite numbers');
    switch (op) { case '>': return x > y; case '>=': return x >= y; case '<': return x < y; case '<=': return x <= y; case '==': return x === y; case '!=': return x !== y; default: fail('$when.cmp', `unknown comparator ${op}`); }
  }
  fail('$when', 'unknown condition');
}

const MODIFIER_FIELDS = ['id', 'phase', 'subject', 'when', 'select', 'operation', 'value', 'stacking', 'priority', 'after'];
export function validateModifiers(modifiers = [], path = '$modifiers') {
  const ids = new Set();
  for (const [i, row] of modifiers.entries()) {
    const at = `${path}[${i}]`;
    for (const key of Object.keys(row)) if (!MODIFIER_FIELDS.includes(key)) fail(`${at}.${key}`, 'unknown modifier field');
    for (const key of ['id', 'phase']) if (typeof row[key] !== 'string' || !row[key]) fail(`${at}.${key}`, 'required nonempty string');
    if (ids.has(row.id)) fail(`${at}.id`, `duplicate modifier ${row.id}`); ids.add(row.id);
    if (!['target', 'actor', 'owner'].includes(row.subject)) fail(`${at}.subject`, 'expected target, actor or owner');
    if (!['multiply', 'add'].includes(row.operation)) fail(`${at}.operation`, `unknown operation ${row.operation}`);
    if (row.value === undefined || !(Number.isFinite(row.value) || typeof row.value === 'string' && row.value.startsWith('$') || plain(row.value) && typeof row.value.f === 'string')) fail(`${at}.value`, 'expected scalar or reference/formula');
    if (row.priority !== undefined && !Number.isFinite(row.priority)) fail(`${at}.priority`, 'expected finite number');
    if (!row.stacking?.group || !['strongest', 'additive', 'multiplicative', 'exclusive'].includes(row.stacking.mode)) fail(`${at}.stacking`, 'explicit group and supported mode required');
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
  for (const row of candidates.sort((a, b) => a.binding.id.localeCompare(b.binding.id) || a.id.localeCompare(b.id))) {
    const group = row.stacking.group, previous = groups.get(group);
    if (previous && (previous[0].stacking.mode !== row.stacking.mode || previous[0].operation !== row.operation)) fail(group, 'conflicting stacking policy');
    if (!previous) groups.set(group, [row]);
    else if (row.stacking.mode === 'exclusive') fail(group, 'conflicting exclusive modifiers');
    else if (row.stacking.mode === 'strongest') { if (row.value < previous[0].value) groups.set(group, [row]); }
    else previous.push(row);
  }
  const pending = [...groups.values()].flat().sort((a, b) => (a.priority || 0) - (b.priority || 0) || a.stacking.group.localeCompare(b.stacking.group) || a.binding.id.localeCompare(b.binding.id) || a.id.localeCompare(b.id));
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
