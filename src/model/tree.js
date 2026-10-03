// src/model/tree.js — the node tree's rules, as one validation pass, and its
// two runtime readers.
//
// The whole tag vocabulary is one tree (content/source/nodes.csv): a node's
// parent is its parentId and nothing else, roots are what the five tag tables
// call domains, and tools/content-build.mjs derives those tables, the property
// rules and the framework's property rows from it. Six companion tables hang
// off it — nodeRelations, familyNodes, nodeTerms, nodeVariables,
// variableBindings, nodeEffects — and this pass is what holds the seven
// together. Every refusal names its row.
//
// What this refuses:
//   nodes       a duplicate id, a blank id, a parentId naming no node, a parent
//               cycle, `domain` or `aside` written on a non-root, a visibility
//               with no integer priority
//   relations   an endpoint naming no node, a verb outside NODE_RELATIONS, a
//               self-edge, a duplicate (source, relation, target)
//   columns     an unknown column on any of the six CSV tables
//   nodes       (also) a visibility or root domain outside the framework's
//               words, and a framework node's dotted id that its parents do
//               not spell
//   familyNodes an unknown family, a nodeId naming no node, a duplicate pair,
//               a collection-backed family with no row into classification,
//               and a tagging row outside every subtree its family is paired
//               with (a branch-scoped pairing is enforced as the branch)
//   terms       a nodeId naming no node, a template {token} naming no variable
//               of that node
//   variables   a nodeId naming no node, a duplicate (node, variable), a
//               variable no effect of the node reads, an effect reading a
//               variable the node does not declare, a role that is not the
//               key the effect reads the variable at, and an effects entry on
//               a node outside the property subtree
//   bindings    a scope outside VARIABLE_SCOPES, a scopeId given for `default`
//               or missing for any other, a variable the node does not
//               declare, a duplicate key, a balancePath that is not a finite
//               number in balance.js, a literal number in place of a path, and
//               a declared variable with no `default` row
//   kinds       an object with no classification row, or two; a kind whose id
//               names a family other than the row's; a card whose kind is not
//               the node its `type` names
//
// Headless and pure: reads the bundle, allocates nothing on it.

import { NODE_RELATIONS, VARIABLE_SCOPES, NODE_VISIBILITIES, NODE_DOMAINS, TREE_COLUMNS } from './schemas.js';
import { TOKEN_PATTERN } from './tokens.js';

/** The classification node a card's `type` names — the one place the map lives. */
export const CARD_TYPE_KIND = Object.freeze({
  attack: 'classification.attack',
  skill: 'classification.skill',
  power: 'classification.power',
  curse: 'classification.curse',
  status: 'classification.statusCard',
});
const KIND_CARD_TYPE = Object.freeze(Object.fromEntries(Object.entries(CARD_TYPE_KIND).map(([t, k]) => [k, t])));

/**
 * cardKind(def) → 'attack' | 'skill' | 'power' | 'curse' | 'status' | null
 *
 * WHAT A CARD IS, read off its kind tag (`kindIds`, stamped by registries.js
 * from the classification row every card carries) — never off `def.type`.
 * The engine's attack counter, the cardTypeIs predicate, the animation
 * grouping, the combat screen's skill highlight and the consequence check all
 * ask this. validate.js refuses a card whose kind and type disagree, so the
 * answer equals `def.type` for every shipped card; a def with no kind row (a
 * fixture that forgot one) answers null, and null is no kind — it is not
 * quietly the type. Pure: reads the def, needs no registries.
 */
export function cardKind(def) {
  for (const id of (def && Array.isArray(def.kindIds)) ? def.kindIds : []) {
    if (KIND_CARD_TYPE[id]) return KIND_CARD_TYPE[id];
  }
  return null;
}

/**
 * The spelling bridge between a variable and its template token. A variable is
 * a plain name (`restoreMana_2`, CSV- and path-safe); the token grammar counts
 * a repeat as `{restoreMana.2}` (validate.js TOKEN_PATTERN). One rule each way,
 * so a sentence binds BY NAME: `{poiseDamage}` reads the variable poiseDamage.
 */
export const tokenForVariable = (variable) => String(variable).replace(/_(\d+)$/, '.$1');
export const variableForToken = (token) => String(token).replace(/\.(\d+)$/, '_$1');

/**
 * nodeVariableBindings(bundle, nodeId) → [{ token, variable, op, literal, required }]
 *
 * The template bindings a conferring node offers, BY NAME: one per declared
 * variable, with the op of the effect that reads it (null for a predicate or
 * a passive) so validate.js can keep asking "is every player-visible number
 * stated" exactly as it asked when the numbers were op positions.
 */
export function nodeVariableBindings(bundle, nodeId) {
  const b = bundle || {};
  const declared = (Array.isArray(b.nodeVariables) ? b.nodeVariables : []).filter((v) => v && v.nodeId === nodeId);
  // `literal` keeps the meaning it had when bindings were op positions: a
  // variable that IS the op's magnitude is literal and, for a REQUIRED_TOKEN_OPS
  // op, must be stated in the sentence; one nested in a formula's args
  // (`stacks: { f: 'add', args: [{ variable }] }`) is not — the formula was
  // never a literal number and the sentence was never made to state it.
  const opOf = new Map();
  const literal = new Set();
  const tree = b.nodeEffects && b.nodeEffects[nodeId];
  for (const trig of (tree && Array.isArray(tree.triggers)) ? tree.triggers : []) {
    for (const eff of (trig && Array.isArray(trig.do)) ? trig.do : []) {
      if (!eff || typeof eff.op !== 'string') continue;
      for (const value of Object.values(eff)) {
        if (value && typeof value === 'object' && typeof value.variable === 'string') { opOf.set(value.variable, eff.op); literal.add(value.variable); }
        if (value && typeof value === 'object' && Array.isArray(value.args)) {
          for (const a of value.args) if (a && typeof a === 'object' && typeof a.variable === 'string') opOf.set(a.variable, eff.op);
        }
      }
    }
  }
  return declared.map((v) => ({ token: tokenForVariable(v.variable), variable: v.variable, op: opOf.get(v.variable) || null, literal: literal.has(v.variable), required: false }));
}

/**
 * nodeTokens(registries, nodeId, scope) → { [token]: number } — every variable
 * of the node, resolved through its binding, keyed by its token spelling. This
 * is how a relic's sentence reads the numbers of the powers it carries.
 */
export function nodeTokens(registries, nodeId, scope = {}) {
  const out = {};
  for (const v of (registries.nodeVariables || []).filter((r) => r.nodeId === nodeId)) {
    const value = resolveVariable(registries, nodeId, v.variable, scope);
    if (Number.isFinite(value)) out[tokenForVariable(v.variable)] = value;
  }
  return out;
}

function atPath(obj, path) {
  let node = obj;
  for (const part of String(path).split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return node;
}

/** Every `{ variable: name }` leaf under a value, in walk order. */
function variableRefs(value, out = []) {
  if (Array.isArray(value)) value.forEach((v) => variableRefs(v, out));
  else if (value && typeof value === 'object') {
    if (Object.keys(value).length === 1 && typeof value.variable === 'string') out.push(value.variable);
    else Object.values(value).forEach((v) => variableRefs(v, out));
  }
  return out;
}

/**
 * treeProblems(bundle) -> [{ path, message }]
 */
export function treeProblems(bundle) {
  const problems = [];
  const err = (path, message) => problems.push({ path, message });
  const b = bundle || {};
  const table = (name) => (Array.isArray(b[name]) ? b[name] : null);
  const nodes = table('nodes');
  const relations = table('nodeRelations');
  const familyNodes = table('familyNodes');
  const terms = table('nodeTerms');
  const variables = table('nodeVariables');
  const bindings = table('variableBindings');
  const effects = b.nodeEffects && typeof b.nodeEffects === 'object' && !Array.isArray(b.nodeEffects) ? b.nodeEffects : null;
  for (const [name, rows] of [['nodes', nodes], ['nodeRelations', relations], ['familyNodes', familyNodes],
    ['nodeTerms', terms], ['nodeVariables', variables], ['variableBindings', bindings]]) {
    if (!rows) err(name, `Missing required ${name} array`);
  }
  if (!effects) err('nodeEffects', 'Missing required nodeEffects object');
  if (!nodes || !relations || !familyNodes || !terms || !variables || !bindings || !effects) return problems;

  // ---- columns: a mis-spelt column is a silent nothing, so it is refused -------
  for (const [name, rows] of [['nodes', nodes], ['nodeRelations', relations], ['familyNodes', familyNodes],
    ['nodeTerms', terms], ['nodeVariables', variables], ['variableBindings', bindings]]) {
    const allowed = new Set(TREE_COLUMNS[name]);
    rows.forEach((row, i) => {
      if (!row || typeof row !== 'object') return;
      for (const key of Object.keys(row)) {
        if (!allowed.has(key)) err(`${name}[${i}].${key}`, `Unknown column '${key}' (columns: ${TREE_COLUMNS[name].join(', ')})`);
      }
    });
  }

  // ---- nodes -----------------------------------------------------------------
  const byId = new Map();
  for (const row of nodes) {
    const id = (row && row.id) || '?';
    const path = `nodes.${id}`;
    if (!row || typeof row.id !== 'string' || !row.id) { err(path, 'every node needs a non-empty `id`'); continue; }
    if (byId.has(row.id)) { err(path, `duplicate node '${row.id}' — one row per node`); continue; }
    byId.set(row.id, row);
  }
  for (const row of byId.values()) {
    const path = `nodes.${row.id}`;
    const isRoot = !row.parentId;
    if (!isRoot && !byId.has(row.parentId)) err(`${path}.parentId`, `names '${row.parentId}', which is not a node`);
    if (!isRoot && row.domain) err(`${path}.domain`, `is written on a non-root — a node's domain is its root's, stated once on the root`);
    if (!isRoot && (row.aside === true || row.aside === 'true')) err(`${path}.aside`, `is written on a non-root — aside is a root attribute`);
    if (row.visibility && !Number.isInteger(row.priority)) err(`${path}.priority`, `must be an integer on a node with a visibility, got ${JSON.stringify(row.priority)}`);
    if (row.visibility && !NODE_VISIBILITIES.includes(row.visibility)) err(`${path}.visibility`, `'${row.visibility}' is not a visibility (legal: ${NODE_VISIBILITIES.join(', ')})`);
    if (row.domain && !NODE_DOMAINS.includes(row.domain)) err(`${path}.domain`, `'${row.domain}' is not a framework domain (legal: ${NODE_DOMAINS.join(', ')})`);
  }
  // cycles: walk up from every node; a revisit within one walk is a cycle.
  const reported = new Set();
  for (const row of byId.values()) {
    const seen = new Set();
    let cur = row;
    while (cur && cur.parentId && byId.has(cur.parentId)) {
      if (seen.has(cur.id)) {
        const key = [...seen].sort().join('|');
        if (!reported.has(key)) { reported.add(key); err(`nodes.${cur.id}.parentId`, `parent cycle through ${[...seen].join(' → ')} — a node cannot be its own ancestor`); }
        break;
      }
      seen.add(cur.id);
      cur = byId.get(cur.parentId);
    }
  }
  const rootOf = (id) => {
    let cur = byId.get(id);
    const seen = new Set();
    while (cur && cur.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) { seen.add(cur.id); cur = byId.get(cur.parentId); }
    return cur || null;
  };
  const isUnder = (id, ancestorId) => {
    let cur = byId.get(id);
    const seen = new Set();
    while (cur && !seen.has(cur.id)) {
      if (cur.id === ancestorId) return true;
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : null;
    }
    return false;
  };

  // A FRAMEWORK NODE'S DOTTED ID IS CHECKED AGAINST THE TREE, never read as the
  // tree: the id `lifecycle.recall.afterUse` is an opaque key kept so no reader
  // changed, and this is what keeps it honest — if its parentIds do not spell
  // that path, the key is lying about where the node sits.
  const labelPath = (id) => {
    const parts = [];
    let cur = byId.get(id);
    const seen = new Set();
    while (cur && !seen.has(cur.id)) { seen.add(cur.id); parts.unshift(String(cur.label || cur.id)); cur = cur.parentId ? byId.get(cur.parentId) : null; }
    return parts.join('.');
  };
  for (const row of byId.values()) {
    if (!row.visibility || !row.parentId) continue;
    const spelled = labelPath(row.id);
    if (spelled !== row.id) err(`nodes.${row.id}.parentId`, `the id spells the path '${row.id}' but its parents spell '${spelled}' — the parentId chain is the tree; make them agree`);
  }

  // ---- relations -------------------------------------------------------------
  const seenEdge = new Set();
  relations.forEach((row, i) => {
    const path = `nodeRelations[${i}]`;
    if (!row) { err(path, 'malformed row'); return; }
    for (const end of ['sourceId', 'targetId']) {
      if (!byId.has(row[end])) err(`${path}.${end}`, `names '${row[end]}', which is not a node`);
    }
    if (!NODE_RELATIONS.includes(row.relation)) err(`${path}.relation`, `'${row.relation}' is not a relation (legal: ${NODE_RELATIONS.join(', ')})`);
    if (row.sourceId === row.targetId) err(path, `'${row.sourceId}' relates to itself`);
    if (!Number.isInteger(row.precedence)) err(`${path}.precedence`, `must be an integer, got ${JSON.stringify(row.precedence)}`);
    const key = `${row.sourceId}\u0000${row.relation}\u0000${row.targetId}`;
    if (seenEdge.has(key)) err(path, `duplicate edge ${row.sourceId} ${row.relation} ${row.targetId}`);
    seenEdge.add(key);
  });

  // ---- familyNodes -----------------------------------------------------------
  const families = new Map((Array.isArray(b.tagFamilies) ? b.tagFamilies : []).filter((f) => f && f.family).map((f) => [f.family, f]));
  const seenPair = new Set();
  const subtreesOf = new Map();
  for (const row of familyNodes) {
    const family = (row && row.family) || '?';
    const path = `familyNodes.${family}.${(row && row.nodeId) || '?'}`;
    if (!families.has(family)) { err(path, `unknown family '${family}' — add it to content/source/tagFamilies.csv`); continue; }
    if (!row || !byId.has(row.nodeId)) { err(path, `names '${row && row.nodeId}', which is not a node`); continue; }
    const key = `${family}\u0000${row.nodeId}`;
    if (seenPair.has(key)) err(path, 'duplicate pair');
    seenPair.add(key);
    if (!subtreesOf.has(family)) subtreesOf.set(family, []);
    subtreesOf.get(family).push(row.nodeId);
  }
  for (const spec of families.values()) {
    if (!spec.source || typeof spec.source !== 'string') continue;
    const roots = subtreesOf.get(spec.family) || [];
    if (!roots.some((id) => id === 'classification' || isUnder(id, 'classification'))) {
      err(`familyNodes.${spec.family}`, `no row lets '${spec.family}' carry the classification subtree, so no object of the family could state its kind — add the row (family, classification)`);
    }
  }
  // THE SUBTREE IS THE LAW, NOT ITS ROOT. familyNodes may name a branch
  // (`card → classification.attack` would let a card carry attack kinds and
  // nothing else under classification); the derived tagFamilyDomains lifts
  // every row to its root because the old table had no narrower word, so
  // model/tags.js alone would let a branch-scoped family carry any sibling.
  // Every tagging row is checked here against the subtrees its family is
  // actually paired with.
  for (const row of (Array.isArray(b.tagging) ? b.tagging : [])) {
    if (!row || !families.has(row.family) || !byId.has(row.tagId)) continue;
    const allowed = subtreesOf.get(row.family) || [];
    if (!allowed.some((top) => isUnder(row.tagId, top))) {
      const under = allowed.filter((top) => rootOf(row.tagId) && rootOf(row.tagId).id === rootOf(top)?.id);
      err(`tagging.${row.family}.${row.objectId}`, `holds '${row.tagId}', which is outside every subtree '${row.family}' is paired with in familyNodes.csv${under.length ? ` (the family may carry only ${under.join(', ')} under that root)` : ''}`);
    }
  }

  // ---- variables and effects ---------------------------------------------------
  const declared = new Map(); // nodeId → Set(variable)
  const roleOf = new Map();
  for (const row of variables) {
    const nodeId = (row && row.nodeId) || '?';
    const path = `nodeVariables.${nodeId}.${(row && row.variable) || '?'}`;
    if (!byId.has(nodeId)) { err(path, `names '${nodeId}', which is not a node`); continue; }
    if (!row.variable || typeof row.variable !== 'string') { err(path, 'a variable needs a name'); continue; }
    if (!declared.has(nodeId)) declared.set(nodeId, new Set());
    if (declared.get(nodeId).has(row.variable)) err(path, 'duplicate variable');
    declared.get(nodeId).add(row.variable);
    if (!String(row.role || '').length) err(`${path}.role`, 'a variable states the role it plays (amount, stacks, pct, hits, n, level, or a passive key)');
    else roleOf.set(`${nodeId}\u0000${row.variable}`, String(row.role));
  }
  const read = new Map(); // nodeId → Set(variable) referenced by effects
  const fieldOf = new Map(); // `${nodeId}\u0000${variable}` → the key the variable sits at
  const walkFields = (v, nodeId, key) => {
    if (Array.isArray(v)) { v.forEach((x) => walkFields(x, nodeId, key)); return; }
    if (v && typeof v === 'object') {
      if (Object.keys(v).length === 1 && typeof v.variable === 'string') { if (key) fieldOf.set(`${nodeId}\u0000${v.variable}`, key); return; }
      for (const [k, x] of Object.entries(v)) walkFields(x, nodeId, Array.isArray(x) ? key : k);
    }
  };
  for (const [nodeId, tree] of Object.entries(effects)) {
    if (!byId.has(nodeId)) { err(`nodeEffects.${nodeId}`, `is not a node`); continue; }
    if (!isUnder(nodeId, 'property')) err(`nodeEffects.${nodeId}`, `confers behaviour on a node outside the property subtree — only a property node is mounted; move the node under property or drop the entry`);
    walkFields(tree, nodeId, '');
    const refs = new Set(variableRefs(tree));
    read.set(nodeId, refs);
    for (const v of refs) {
      if (!declared.has(nodeId) || !declared.get(nodeId).has(v)) {
        err(`nodeEffects.${nodeId}`, `reads variable '${v}', which nodeVariables.csv does not declare for it`);
      }
    }
  }
  // THE ROLE IS THE KEY THE VARIABLE SITS AT — `amount` on a damage op, `stacks`
  // on applyStatus, `n` on a predicate, a passive's own name — so the column is
  // read, and a row that says `amount` for a variable an op reads as `stacks`
  // is refused rather than decorating.
  for (const [key, field] of fieldOf) {
    const role = roleOf.get(key);
    if (role && role !== field) {
      const [nodeId, v] = key.split('\u0000');
      err(`nodeVariables.${nodeId}.${v}.role`, `says '${role}' but the effect reads the variable as '${field}'`);
    }
  }
  for (const [nodeId, vars] of declared) {
    for (const v of vars) {
      if (!read.has(nodeId) || !read.get(nodeId).has(v)) {
        // A framework node's variables are its defaultParameters (the build
        // resolves them into the property row); they are read there, not by an
        // effect, so a visibility-bearing node is exempt from "no effect reads it".
        if (byId.get(nodeId).visibility) continue;
        err(`nodeVariables.${nodeId}.${v}`, `is declared but no effect of '${nodeId}' reads it — drop the row or name it in nodeEffects.json`);
      }
    }
  }

  // ---- bindings ----------------------------------------------------------------
  const classIds = new Set((Array.isArray(b.classes) ? b.classes : []).map((c) => c && c.id).filter(Boolean));
  const seenBinding = new Set();
  const hasDefault = new Set();
  for (const row of bindings) {
    const nodeId = (row && row.nodeId) || '?';
    const path = `variableBindings.${row && row.scope}.${(row && row.scopeId) || ''}.${nodeId}.${(row && row.variable) || '?'}`;
    if (!row) { err(path, 'malformed row'); continue; }
    if (!VARIABLE_SCOPES.includes(row.scope)) { err(`${path}.scope`, `'${row.scope}' is not a scope (legal: ${VARIABLE_SCOPES.join(', ')})`); continue; }
    const scopeId = row.scopeId == null ? '' : String(row.scopeId);
    if (row.scope === 'default' && scopeId) err(`${path}.scopeId`, 'a default binding has no scopeId');
    if (row.scope !== 'default' && !scopeId) err(`${path}.scopeId`, `a '${row.scope}' binding names what it is scoped to`);
    if (row.scope === 'class' && scopeId && !classIds.has(scopeId)) err(`${path}.scopeId`, `'${scopeId}' is not a class id`);
    if (row.scope === 'upgrade' && scopeId && !/^\d+$/.test(scopeId)) err(`${path}.scopeId`, `an upgrade scope names a level, got '${scopeId}'`);
    if (!byId.has(nodeId)) { err(path, `names '${nodeId}', which is not a node`); continue; }
    if (!declared.has(nodeId) || !declared.get(nodeId).has(row.variable)) err(path, `binds '${row.variable}', which nodeVariables.csv does not declare for '${nodeId}'`);
    const key = `${row.scope}\u0000${scopeId}\u0000${nodeId}\u0000${row.variable}`;
    if (seenBinding.has(key)) err(path, 'duplicate binding');
    seenBinding.add(key);
    if (typeof row.balancePath === 'number') {
      err(`${path}.balancePath`, `is the number ${row.balancePath} — numbers live in src/content/balance.js; name the row`);
    } else {
      const value = atPath(b.balance, row.balancePath);
      if (!Number.isFinite(value)) err(`${path}.balancePath`, `'${row.balancePath}' is not a number in src/content/balance.js`);
    }
    if (row.scope === 'default') hasDefault.add(`${nodeId}\u0000${row.variable}`);
  }
  for (const [nodeId, vars] of declared) {
    for (const v of vars) if (!hasDefault.has(`${nodeId}\u0000${v}`)) err(`nodeVariables.${nodeId}.${v}`, `has no default binding — every variable reads a balance row in the default scope`);
  }

  // ---- terms ---------------------------------------------------------------------
  const tokenRe = new RegExp(TOKEN_PATTERN, 'g');
  for (const row of terms) {
    const nodeId = (row && row.nodeId) || '?';
    const path = `nodeTerms.${nodeId}`;
    if (!byId.has(nodeId)) { err(path, `names '${nodeId}', which is not a node`); continue; }
    const template = row.template == null ? '' : String(row.template);
    let m;
    tokenRe.lastIndex = 0;
    while ((m = tokenRe.exec(template)) !== null) {
      const variable = m[1].replace(/\./g, '_');
      if (!declared.has(nodeId) || !declared.get(nodeId).has(variable)) {
        err(`${path}.template`, `{${m[1]}} names no variable of '${nodeId}' (declared: ${[...(declared.get(nodeId) || [])].join(', ') || 'none'})`);
      }
    }
  }

  // ---- kinds: every object states what it is, once, and truly -------------------
  const kindIds = new Set([...byId.keys()].filter((id) => id !== 'classification' && isUnder(id, 'classification')));
  const kindsOf = new Map();
  for (const row of (Array.isArray(b.tagging) ? b.tagging : [])) {
    if (!row || !kindIds.has(row.tagId)) continue;
    const key = `${row.family}\u0000${row.scope || ''}\u0000${row.objectId}`;
    if (!kindsOf.has(key)) kindsOf.set(key, []);
    kindsOf.get(key).push(row.tagId);
    const named = row.tagId.startsWith('classification.') ? row.tagId.slice('classification.'.length) : '';
    if (families.has(named) && named !== row.family) {
      err(`tagging.${row.family}.${row.objectId}`, `holds '${row.tagId}', the kind of the '${named}' family, on a row of the '${row.family}' family — an object's kind and its collection are one fact stated twice, so they must agree`);
    }
  }
  for (const spec of families.values()) {
    if (!spec.source || typeof spec.source !== 'string') continue;
    const collection = atPath(b, spec.source);
    if (!Array.isArray(collection)) continue;
    for (const def of collection) {
      if (!def || typeof def.id !== 'string') continue;
      const scope = spec.scopeField ? (def[spec.scopeField] || '') : '';
      const held = kindsOf.get(`${spec.family}\u0000${scope}\u0000${def.id}`) || [];
      const path = `tagging.${spec.family}.${def.id}`;
      if (held.length === 0) { err(path, `states no kind — every object carries one tagging row into the classification subtree (${spec.family === 'card' ? 'the node its type names' : `classification.${spec.family}`})`); continue; }
      if (held.length > 1) err(path, `states ${held.length} kinds (${held.join(', ')}) — exactly one`);
      const want = spec.family === 'card' ? CARD_TYPE_KIND[def.type] : `classification.${spec.family}`;
      if (want && held[0] !== want) err(path, `states '${held[0]}' but is ${spec.family === 'card' ? `a ${def.type}, whose kind is '${want}'` : `in the ${spec.family} collection, whose kind is '${want}'`}`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Runtime readers
// ---------------------------------------------------------------------------

/**
 * nodeTree(registries) → { get, parentOf, rootOf, ancestorsOf, childrenOf,
 * isUnder, pathOf } over registries.nodes. `pathOf` is the dotted spelling the
 * framework reads (`lifecycle.recall.afterUse`): DERIVED from parentIds, never
 * from the id, so an id that happens to contain a dot is only a key.
 */
export function nodeTree(registries) {
  const rows = registries.nodes || [];
  const byId = new Map(rows.map((n) => [n.id, n]));
  const children = new Map();
  for (const n of rows) {
    if (!n.parentId) continue;
    if (!children.has(n.parentId)) children.set(n.parentId, []);
    children.get(n.parentId).push(n.id);
  }
  const parentOf = (id) => { const n = byId.get(id); return n && n.parentId ? n.parentId : null; };
  const ancestorsOf = (id) => { const out = []; let p = parentOf(id); const seen = new Set(); while (p && !seen.has(p)) { out.push(p); seen.add(p); p = parentOf(p); } return out; };
  return Object.freeze({
    get: (id) => byId.get(id) || null,
    parentOf,
    rootOf: (id) => { const a = ancestorsOf(id); return a.length ? a[a.length - 1] : (byId.has(id) ? id : null); },
    ancestorsOf,
    childrenOf: (id) => [...(children.get(id) || [])],
    isUnder: (id, ancestorId) => id === ancestorId || ancestorsOf(id).includes(ancestorId),
    // The framework's dotted spelling, from the LABELS down the parentId chain
    // (a framework node's label is its leaf; treeProblems refuses a dotted id
    // that disagrees with it). The id is never split — it is only a key.
    pathOf: (id) => { const n = byId.get(id); if (!n) return null; return [...ancestorsOf(id).reverse(), id].map((a) => { const r = byId.get(a); return String(r.label || r.id); }).join('.'); },
  });
}

/**
 * resolveVariable(registries, nodeId, variable, scope) → number | undefined
 *
 * The ladder: instance › upgrade › class › default (VARIABLE_SCOPES, reversed).
 * `scope` is { instanceId?, upgradeLevel?, classId? }; a rung with no scopeId
 * supplied is skipped. The value is read from registries.balance by the
 * binding's path — the node never held it.
 */
export function resolveVariable(registries, nodeId, variable, scope = {}) {
  const rows = (registries.variableBindings || []).filter((r) => r.nodeId === nodeId && r.variable === variable);
  const ids = { instance: scope.instanceId, upgrade: scope.upgradeLevel == null ? undefined : String(scope.upgradeLevel), class: scope.classId, default: '' };
  for (const s of [...VARIABLE_SCOPES].reverse()) {
    const want = ids[s];
    if (want === undefined) continue;
    const row = rows.find((r) => r.scope === s && String(r.scopeId == null ? '' : r.scopeId) === String(want));
    if (!row) continue;
    const value = atPath(registries.balance, row.balancePath);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}
