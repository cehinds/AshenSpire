// .agentops/tools/opsctl.mjs — the AgentOps control-plane validator and view
// generator. Dependency-free Node ESM, matching this repository's tooling
// convention (pure stdlib, `--check`/`--selftest` self-verification).
//
// Subcommands:
//   validate            Parse + schema-validate + cross-contract checks. Exit 1 on any failure.
//   render              (Re)generate .agentops/generated/GOVERNANCE.md from validated JSON.
//   render --check      Regenerate in memory and fail (exit 1) if the committed view has drifted.
//   verify              validate, then render --check. The CI entry point.
//   --selftest          Prove every check can actually fail, using in-memory negative plants.
//
// Design invariants:
//   * Git history + validated JSON are authoritative; the Markdown view is a
//     generated projection with the sole writer being `render`.
//   * The generated view is deterministic — no timestamps or volatile state —
//     so `render --check` is a reliable drift gate.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// A role that is a machine writer rather than a governed human/agent role.
// `generator` is the sole writer of .agentops/generated/** (opsctl render).
const SYNTHETIC_ROLES = new Set(['generator']);

// ---------------------------------------------------------------------------
// Strict JSON parser: rejects duplicate keys within an object (native
// JSON.parse silently keeps the last). Returns the parsed value or throws.
// ---------------------------------------------------------------------------
export function strictParse(text) {
  let i = 0;
  const n = text.length;

  function err(msg) {
    // 1-indexed line/col for a legible message.
    let line = 1, col = 1;
    for (let k = 0; k < i && k < n; k++) {
      if (text[k] === '\n') { line++; col = 1; } else { col++; }
    }
    throw new SyntaxError(`${msg} at line ${line} col ${col}`);
  }
  function ws() { while (i < n && ' \t\r\n'.includes(text[i])) i++; }
  function value() {
    ws();
    if (i >= n) err('unexpected end of input');
    const c = text[i];
    if (c === '{') return object();
    if (c === '[') return array();
    if (c === '"') return string();
    if (c === '-' || (c >= '0' && c <= '9')) return number();
    if (text.startsWith('true', i)) { i += 4; return true; }
    if (text.startsWith('false', i)) { i += 5; return false; }
    if (text.startsWith('null', i)) { i += 4; return null; }
    err(`unexpected token '${c}'`);
  }
  function object() {
    i++; // {
    const obj = {};
    const seen = new Set();
    ws();
    if (text[i] === '}') { i++; return obj; }
    for (;;) {
      ws();
      if (text[i] !== '"') err('expected object key');
      const key = string();
      if (seen.has(key)) err(`duplicate object key '${key}'`);
      seen.add(key);
      ws();
      if (text[i] !== ':') err("expected ':'");
      i++;
      obj[key] = value();
      ws();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === '}') { i++; return obj; }
      err("expected ',' or '}'");
    }
  }
  function array() {
    i++; // [
    const arr = [];
    ws();
    if (text[i] === ']') { i++; return arr; }
    for (;;) {
      arr.push(value());
      ws();
      if (text[i] === ',') { i++; continue; }
      if (text[i] === ']') { i++; return arr; }
      err("expected ',' or ']'");
    }
  }
  function string() {
    i++; // opening quote
    let s = '';
    for (;;) {
      if (i >= n) err('unterminated string');
      const c = text[i++];
      if (c === '"') return s;
      if (c === '\\') {
        const e = text[i++];
        if (e === '"') s += '"';
        else if (e === '\\') s += '\\';
        else if (e === '/') s += '/';
        else if (e === 'b') s += '\b';
        else if (e === 'f') s += '\f';
        else if (e === 'n') s += '\n';
        else if (e === 'r') s += '\r';
        else if (e === 't') s += '\t';
        else if (e === 'u') { s += String.fromCharCode(parseInt(text.substr(i, 4), 16)); i += 4; }
        else err(`invalid escape '\\${e}'`);
      } else {
        s += c;
      }
    }
  }
  function number() {
    const start = i;
    if (text[i] === '-') i++;
    while (i < n && text[i] >= '0' && text[i] <= '9') i++;
    if (text[i] === '.') { i++; while (i < n && text[i] >= '0' && text[i] <= '9') i++; }
    if (text[i] === 'e' || text[i] === 'E') {
      i++;
      if (text[i] === '+' || text[i] === '-') i++;
      while (i < n && text[i] >= '0' && text[i] <= '9') i++;
    }
    return Number(text.slice(start, i));
  }

  const result = value();
  ws();
  if (i !== n) err('trailing content after JSON value');
  return result;
}

// ---------------------------------------------------------------------------
// Mini JSON-schema validator. Supported keywords: type (string or array of
// strings), required, properties, additionalProperties (false|schema), items,
// enum, const, pattern, minLength, minItems. Returns an array of error strings.
// ---------------------------------------------------------------------------
export function validateSchema(data, schema, path = '$') {
  const errors = [];
  const typeOf = (v) => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v;

  if (schema.const !== undefined && data !== schema.const) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(data)}`);
  }
  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`${path}: value ${JSON.stringify(data)} not in enum ${JSON.stringify(schema.enum)}`);
  }
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    let t = typeOf(data);
    // integer satisfies number
    const ok = types.some((want) => want === t || (want === 'number' && t === 'integer'));
    if (!ok) errors.push(`${path}: expected type ${types.join('|')}, got ${t}`);
  }
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`${path}: string shorter than minLength ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${path}: string does not match pattern ${schema.pattern}`);
    }
  }
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push(`${path}: array shorter than minItems ${schema.minItems}`);
    }
    if (schema.items) {
      data.forEach((el, idx) => errors.push(...validateSchema(el, schema.items, `${path}[${idx}]`)));
    }
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in data)) errors.push(`${path}: missing required property '${key}'`);
      }
    }
    if (schema.properties) {
      for (const [key, sub] of Object.entries(schema.properties)) {
        if (key in data) errors.push(...validateSchema(data[key], sub, `${path}.${key}`));
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(data)) {
        if (!(key in schema.properties)) errors.push(`${path}: additional property '${key}' not allowed`);
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Contract loading.
// ---------------------------------------------------------------------------
const CONTRACTS = [
  { name: 'project', file: 'project.json', schema: 'schemas/project.schema.json' },
  { name: 'owner-intent', file: 'governance/owner-intent.json', schema: 'schemas/owner-intent.schema.json' },
  { name: 'hierarchy', file: 'governance/hierarchy.json', schema: 'schemas/hierarchy.schema.json' },
  { name: 'roles', file: 'governance/roles.json', schema: 'schemas/roles.schema.json' },
  { name: 'authority', file: 'governance/authority.json', schema: 'schemas/authority.schema.json' },
  { name: 'git-ownership', file: 'governance/git-ownership.json', schema: 'schemas/git-ownership.schema.json' },
  { name: 'raci', file: 'governance/raci.json', schema: 'schemas/raci.schema.json' },
  { name: 'delegation', file: 'governance/delegation.json', schema: 'schemas/delegation.schema.json' },
  { name: 'escalation', file: 'governance/escalation.json', schema: 'schemas/escalation.schema.json' },
  { name: 'transitions', file: 'governance/transitions.json', schema: 'schemas/transitions.schema.json' },
  { name: 'information-access', file: 'governance/information-access.json', schema: 'schemas/information-access.schema.json' },
  { name: 'qa', file: 'governance/qa.json', schema: 'schemas/qa.schema.json' },
  { name: 'evidence', file: 'governance/evidence.json', schema: 'schemas/evidence.schema.json' }
];

export function loadContracts(root = ROOT) {
  const out = {};
  const errors = [];
  for (const c of CONTRACTS) {
    let data, schema;
    try { data = strictParse(readFileSync(resolve(root, c.file), 'utf8')); }
    catch (e) { errors.push(`[${c.name}] parse: ${e.message}`); continue; }
    try { schema = JSON.parse(readFileSync(resolve(root, c.schema), 'utf8')); }
    catch (e) { errors.push(`[${c.name}] schema load: ${e.message}`); continue; }
    for (const err of validateSchema(data, schema, '$')) errors.push(`[${c.name}] schema: ${err}`);
    out[c.name] = data;
  }
  return { contracts: out, errors };
}

// ---------------------------------------------------------------------------
// Cross-contract semantic checks. Pure function over already-parsed contracts
// so the test harness can plant defects without touching the filesystem.
// ---------------------------------------------------------------------------
export function semanticChecks(c) {
  const errors = [];
  const roles = c.roles ? new Set(c.roles.roles.map((r) => r.role)) : new Set();
  const knownRoles = new Set([...roles, ...SYNTHETIC_ROLES]);

  // 1. Authority references only declared roles.
  if (c.authority) {
    for (const g of c.authority.grants) {
      if (!roles.has(g.routine_owner_role)) {
        errors.push(`authority: grant '${g.action}' names unknown role '${g.routine_owner_role}'`);
      }
    }
  }

  // 2. Git-ownership references only known roles (declared or synthetic writer).
  if (c['git-ownership']) {
    for (const p of c['git-ownership'].paths) {
      if (!knownRoles.has(p.owner_role)) errors.push(`git-ownership: path '${p.glob}' names unknown role '${p.owner_role}'`);
      if (p.glob.split('/').includes('..')) errors.push(`git-ownership: path glob '${p.glob}' contains a '..' traversal segment`);
    }
    for (const r of c['git-ownership'].refs) {
      if (!knownRoles.has(r.owner_role)) errors.push(`git-ownership: ref '${r.ref}' names unknown role '${r.owner_role}'`);
    }
    // 3. One writer per overlapping path: two path globs whose literal prefixes
    //    nest must be owned by the same role, else it is a collision.
    const paths = c['git-ownership'].paths;
    const literalPrefix = (glob) => {
      const star = glob.search(/[*?[]/);
      const cut = star === -1 ? glob : glob.slice(0, star);
      const slash = cut.lastIndexOf('/');
      return slash === -1 ? '' : cut.slice(0, slash + 1);
    };
    for (let a = 0; a < paths.length; a++) {
      for (let b = a + 1; b < paths.length; b++) {
        const pa = literalPrefix(paths[a].glob), pb = literalPrefix(paths[b].glob);
        const nests = pa.startsWith(pb) || pb.startsWith(pa);
        if (nests && paths[a].owner_role !== paths[b].owner_role) {
          errors.push(`git-ownership: overlapping paths '${paths[a].glob}' and '${paths[b].glob}' have different writers ('${paths[a].owner_role}' vs '${paths[b].owner_role}')`);
        }
      }
    }
  }

  // 4. Hierarchy: single root, root is the owner, parents resolve, no cycles.
  if (c.hierarchy) {
    const nodes = c.hierarchy.nodes;
    const ids = new Set(nodes.map((x) => x.actor_id));
    const roots = nodes.filter((x) => x.escalation_parent === null);
    if (roots.length !== 1) errors.push(`hierarchy: expected exactly one root node, found ${roots.length}`);
    else if (roots[0].role !== 'owner') errors.push(`hierarchy: root node '${roots[0].actor_id}' is not the owner role`);
    for (const node of nodes) {
      if (node.escalation_parent !== null && !ids.has(node.escalation_parent)) {
        errors.push(`hierarchy: node '${node.actor_id}' has unknown escalation_parent '${node.escalation_parent}'`);
      }
    }
    // cycle detection
    const parent = new Map(nodes.map((x) => [x.actor_id, x.escalation_parent]));
    for (const start of ids) {
      let cur = start, hops = 0;
      const seen = new Set();
      while (cur !== null && parent.has(cur)) {
        if (seen.has(cur)) { errors.push(`hierarchy: escalation cycle involving '${start}'`); break; }
        seen.add(cur);
        cur = parent.get(cur);
        if (++hops > nodes.length + 1) { errors.push(`hierarchy: escalation chain from '${start}' does not terminate`); break; }
      }
    }
  }

  // 5. Deputy grant is non-amplifying: included ∩ excluded = ∅, and owner/deputy
  //    identities reconcile with the hierarchy.
  if (c['owner-intent']) {
    const oi = c['owner-intent'];
    const inc = new Set(oi.deputy.included_actions);
    for (const ex of oi.deputy.excluded_actions) {
      if (inc.has(ex)) errors.push(`owner-intent: deputy action '${ex}' is both included and excluded (amplifying grant)`);
    }
    if (c.hierarchy) {
      const ids = new Set(c.hierarchy.nodes.map((x) => x.actor_id));
      const ownerNode = c.hierarchy.nodes.find((x) => x.role === 'owner');
      if (ownerNode && ownerNode.actor_id !== oi.owner.actor_id) {
        errors.push(`owner-intent: owner actor '${oi.owner.actor_id}' does not match hierarchy owner '${ownerNode.actor_id}'`);
      }
      if (!ids.has(oi.deputy.actor_id)) {
        errors.push(`owner-intent: deputy actor '${oi.deputy.actor_id}' is not present in the hierarchy`);
      }
    }
    if (c.roles) {
      const roleSet = new Set(c.roles.roles.map((r) => r.role));
      if (!roleSet.has(oi.deputy.role)) errors.push(`owner-intent: deputy role '${oi.deputy.role}' is not a declared role`);
    }
  }

  // ---- Stage 2: operational governance contracts ----
  const actorIds = c.hierarchy ? new Set(c.hierarchy.nodes.map((x) => x.actor_id)) : new Set();

  // 6. RACI: exactly one Accountable; named roles declared; no maker self-acceptance.
  if (c.raci) {
    for (const it of c.raci.items) {
      if (it.accountable.length !== 1) {
        errors.push(`raci: item '${it.id}' must have exactly one Accountable, found ${it.accountable.length}`);
      }
      for (const grp of ['responsible', 'accountable', 'consulted', 'informed']) {
        for (const r of it[grp]) if (!roles.has(r)) errors.push(`raci: item '${it.id}' ${grp} names unknown role '${r}'`);
      }
      const isAcceptance = it.kind === 'decision' && (it.id.includes('qa') || it.id.includes('acceptance'));
      if (isAcceptance && it.accountable.includes('maker')) {
        errors.push(`raci: acceptance decision '${it.id}' makes 'maker' Accountable (self-approval)`);
      }
    }
  }

  // 7. Delegation: subset-of-parent, decreasing depth, deputy cannot delegate an
  //    Owner-excluded action, time-bound, path-safe, declared roles.
  if (c.delegation) {
    const byId = new Map(c.delegation.envelopes.map((e) => [e.id, e]));
    const deputyRole = c['owner-intent'] ? c['owner-intent'].deputy.role : null;
    const excluded = c['owner-intent'] ? new Set(c['owner-intent'].deputy.excluded_actions) : new Set();
    for (const e of c.delegation.envelopes) {
      if (!roles.has(e.delegator_role)) errors.push(`delegation: envelope '${e.id}' delegator role '${e.delegator_role}' is unknown`);
      if (!roles.has(e.delegatee_role)) errors.push(`delegation: envelope '${e.id}' delegatee role '${e.delegatee_role}' is unknown`);
      for (const p of e.scope_paths) if (p.split('/').includes('..')) errors.push(`delegation: envelope '${e.id}' scope path '${p}' contains a '..' traversal segment`);
      if (e.expiry <= e.effective) errors.push(`delegation: envelope '${e.id}' expiry is at or before effective (already expired)`);
      if (deputyRole && e.delegator_role === deputyRole) {
        for (const a of e.delegated_actions) if (excluded.has(a)) errors.push(`delegation: envelope '${e.id}' amplifies authority — deputy delegates Owner-excluded action '${a}'`);
      }
      if (e.parent_id !== null) {
        const parent = byId.get(e.parent_id);
        if (!parent) errors.push(`delegation: envelope '${e.id}' has unknown parent_id '${e.parent_id}'`);
        else {
          const pset = new Set(parent.delegated_actions);
          for (const a of e.delegated_actions) if (!pset.has(a)) errors.push(`delegation: envelope '${e.id}' amplifies authority — action '${a}' not held by parent '${parent.id}'`);
          if (!(e.max_subdelegation_depth < parent.max_subdelegation_depth)) errors.push(`delegation: envelope '${e.id}' subdelegation depth ${e.max_subdelegation_depth} is not less than parent '${parent.id}' (${parent.max_subdelegation_depth})`);
        }
      }
    }
  }

  // 8. Escalation: routes are acyclic and name known actors.
  if (c.escalation) {
    for (const cl of c.escalation.classes) {
      const seen = new Set();
      for (const a of cl.route) {
        if (seen.has(a)) { errors.push(`escalation: class '${cl.id}' has a circular route (revisits '${a}')`); break; }
        seen.add(a);
        if (actorIds.size && !actorIds.has(a)) errors.push(`escalation: class '${cl.id}' route names unknown actor '${a}'`);
      }
      if (cl.wake && actorIds.size && !actorIds.has(cl.wake)) errors.push(`escalation: class '${cl.id}' wake names unknown actor '${cl.wake}'`);
    }
  }

  // 9. Transitions: known states; protected transitions exclude maker/qa actors.
  if (c.transitions) {
    const states = new Set(c.transitions.states);
    const protectedStates = new Set(c.transitions.protected_states);
    for (const t of c.transitions.transitions) {
      if (!states.has(t.from)) errors.push(`transitions: transition from unknown state '${t.from}'`);
      if (!states.has(t.to)) errors.push(`transitions: transition to unknown state '${t.to}'`);
      for (const r of t.permitted_actor_roles) if (!roles.has(r)) errors.push(`transitions: transition ${t.from}->${t.to} names unknown role '${r}'`);
      if (t.protected || protectedStates.has(t.to)) {
        for (const r of t.permitted_actor_roles) {
          if (r === 'maker' || r === 'qa-independent') errors.push(`transitions: illegal transition ${t.from}->${t.to} permits '${r}' on a protected transition`);
        }
      }
    }
  }

  // 10. Information access: bounded startup and no forbidden preload.
  if (c['information-access']) {
    const ia = c['information-access'];
    if (ia.startup.length > ia.max_startup_items) errors.push(`information-access: startup has ${ia.startup.length} items, exceeding max_startup_items ${ia.max_startup_items}`);
    const forbidden = new Set(ia.forbidden);
    for (const s of ia.startup) if (forbidden.has(s)) errors.push(`information-access: forbidden class '${s}' present in startup (forbidden preload)`);
    for (const s of ia.on_demand) if (forbidden.has(s)) errors.push(`information-access: forbidden class '${s}' present in on_demand (forbidden preload)`);
  }

  // 11. QA: independent verifier (never maker), valid waiver authority, evidence ownership.
  if (c.qa) {
    const evIds = c.evidence ? new Set(c.evidence.evidence.map((e) => e.id)) : new Set();
    const riskIds = new Set(c.qa.risk_classes.map((r) => r.id));
    for (const g of c.qa.gates) {
      if (!roles.has(g.verifier_role)) errors.push(`qa: gate '${g.id}' verifier role '${g.verifier_role}' is unknown`);
      if (g.verifier_role === 'maker') errors.push(`qa: gate '${g.id}' allows the maker to self-approve (verifier_role 'maker')`);
      if (!(g.waiver_authority_role === 'owner' || g.waiver_authority_role === 'it-manager-iii')) errors.push(`qa: gate '${g.id}' waiver authority '${g.waiver_authority_role}' must be owner or it-manager-iii`);
      if (!riskIds.has(g.risk_class)) errors.push(`qa: gate '${g.id}' references unknown risk_class '${g.risk_class}'`);
      for (const ev of g.required_evidence) if (!evIds.has(ev)) errors.push(`qa: gate '${g.id}' required evidence '${ev}' has no owner in evidence.json`);
    }
  }

  // 12. Evidence: producer and verifier roles are declared (or the generator writer).
  if (c.evidence) {
    for (const e of c.evidence.evidence) {
      if (!knownRoles.has(e.producer_role)) errors.push(`evidence: type '${e.id}' producer role '${e.producer_role}' is unknown`);
      if (!knownRoles.has(e.verifier_role)) errors.push(`evidence: type '${e.id}' verifier role '${e.verifier_role}' is unknown`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Deterministic Markdown view. No timestamps or volatile state — the output is
// a pure function of the JSON so `render --check` is a reliable drift gate.
// ---------------------------------------------------------------------------
export function renderGovernance(c) {
  const L = [];
  L.push('<!-- GENERATED by .agentops/tools/opsctl.mjs render — do not edit by hand. -->');
  L.push('<!-- Source of truth: the validated JSON in .agentops/governance/. Regenerate with `node .agentops/tools/opsctl.mjs render`. -->');
  L.push('');
  L.push('# AgentOps governance (generated view)');
  L.push('');
  L.push(`Project: **${c.project.project_name}** — policy version \`${c['owner-intent'].policy_version}\` — installed stage: \`${c.project.installed_stage}\``);
  L.push('');
  L.push('This Markdown is a projection of validated JSON contracts. It carries no');
  L.push('authority of its own and is regenerated deterministically from');
  L.push('`.agentops/governance/*.json`.');
  L.push('');

  L.push('## Owner intent');
  L.push('');
  L.push(`- **Mission:** ${c['owner-intent'].mission}`);
  L.push(`- **End state:** ${c['owner-intent'].measurable_end_state}`);
  L.push(`- **Risk tolerance:** ${c['owner-intent'].risk_tolerance}`);
  L.push('- **Priority order:**');
  c['owner-intent'].priority_order.forEach((p, i) => L.push(`  ${i + 1}. ${p}`));
  L.push('- **Non-negotiable invariants:**');
  c['owner-intent'].non_negotiable_invariants.forEach((x) => L.push(`  - ${x}`));
  L.push('');

  L.push('## Owner and deputy');
  L.push('');
  const owner = c['owner-intent'].owner;
  L.push(`- **Owner:** ${owner.display_name} (\`${owner.actor_id}\`) — reserves: ${owner.reserved_authority.join('; ')}.`);
  const dep = c['owner-intent'].deputy;
  L.push(`- **Deputy:** ${dep.display_name} (\`${dep.actor_id}\`, role \`${dep.role}\`). ${dep.grant_summary}`);
  L.push(`  - Non-amplifying rule: \`${dep.non_amplifying_rule}\``);
  L.push('  - Included actions:');
  dep.included_actions.forEach((x) => L.push(`    - ${x}`));
  L.push('  - Excluded actions:');
  dep.excluded_actions.forEach((x) => L.push(`    - ${x}`));
  L.push('');

  L.push('## Hierarchy and escalation');
  L.push('');
  L.push('| Actor | Role | Escalates to | Owns escalation classes |');
  L.push('|---|---|---|---|');
  for (const node of c.hierarchy.nodes) {
    L.push(`| \`${node.actor_id}\` | ${node.role} | ${node.escalation_parent ? '`' + node.escalation_parent + '`' : '— (root)'} | ${node.owns_escalations.join(', ')} |`);
  }
  const er = c.hierarchy.escalation_routing;
  L.push('');
  L.push(`Routing SLA: deputy custody at ${er.deputy_custody_at_minutes} min, owner-overdue at ${er.deputy_overdue_to_owner_at_minutes} min. Immediate-to-owner classes: ${er.immediate_owner_classes.join(', ')}.`);
  L.push('');

  L.push('## Roles');
  L.push('');
  for (const r of c.roles.roles) {
    L.push(`### \`${r.role}\``);
    L.push('');
    L.push(`- **Mission:** ${r.mission}`);
    L.push(`- **May:** ${r.may.join(', ') || '—'}`);
    L.push(`- **Must:** ${r.must.join('; ') || '—'}`);
    L.push(`- **Must not:** ${r.must_not.join(', ') || '—'}`);
    L.push(`- **Approval ceiling:** ${r.approval_ceiling}`);
    L.push('');
  }

  L.push('## Authority matrix');
  L.push('');
  L.push('| Action | Routine owner role | Scope | Protected | Required evidence |');
  L.push('|---|---|---|---|---|');
  for (const g of c.authority.grants) {
    L.push(`| ${g.action} | ${g.routine_owner_role} | ${g.scope} | ${g.protected ? 'yes' : 'no'} | ${g.required_evidence} |`);
  }
  L.push('');

  L.push('## Git ownership (one writer per overlapping path or ref)');
  L.push('');
  L.push(`${c['git-ownership'].principle}`);
  L.push('');
  L.push('### Refs');
  L.push('');
  L.push('| Ref | Owner role | Mutation |');
  L.push('|---|---|---|');
  for (const r of c['git-ownership'].refs) L.push(`| \`${r.ref}\` | ${r.owner_role} | ${r.mutation} |`);
  L.push('');
  L.push('### Paths');
  L.push('');
  L.push('| Path glob | Owner role | Serialized lane |');
  L.push('|---|---|---|');
  for (const p of c['git-ownership'].paths) L.push(`| \`${p.glob}\` | ${p.owner_role} | ${p.serialized_lane} |`);
  L.push('');
  L.push(`Collision rule: ${c['git-ownership'].collision_rule}`);
  L.push('');

  // ---- Stage 2 sections ----
  if (c.raci) {
    L.push('## RACI (exactly one Accountable per item)');
    L.push('');
    L.push(c.raci.principle);
    L.push('');
    L.push('| Item | Kind | Responsible | Accountable | Consulted | Informed |');
    L.push('|---|---|---|---|---|---|');
    for (const it of c.raci.items) {
      L.push(`| ${it.id} | ${it.kind} | ${it.responsible.join(', ')} | ${it.accountable.join(', ')} | ${it.consulted.join(', ') || '—'} | ${it.informed.join(', ') || '—'} |`);
    }
    L.push('');
  }

  if (c.delegation) {
    L.push('## Delegation envelopes (non-amplifying)');
    L.push('');
    L.push(`Rule: \`${c.delegation.non_amplification_rule}\``);
    L.push('');
    L.push('| Envelope | Parent | Delegator → Delegatee | Actions | Max subdepth | Effective → Expiry |');
    L.push('|---|---|---|---|---|---|');
    for (const e of c.delegation.envelopes) {
      L.push(`| ${e.id} | ${e.parent_id || '—'} | ${e.delegator_role} → ${e.delegatee_role} | ${e.delegated_actions.join(', ')} | ${e.max_subdelegation_depth} | ${e.effective} → ${e.expiry} |`);
    }
    L.push('');
  }

  if (c.escalation) {
    L.push('## Escalation (time requests a decision, never authority)');
    L.push('');
    L.push(c.escalation.principle);
    L.push('');
    L.push('| Class | Attempts | SLA (min) | Route | Wake | Authority effect | Continues work |');
    L.push('|---|---|---|---|---|---|---|');
    for (const cl of c.escalation.classes) {
      L.push(`| ${cl.id} | ${cl.attempts_before_escalate} | ${cl.sla_minutes} | ${cl.route.join(' → ')} | ${cl.wake} | ${cl.authority_effect} | ${cl.continuing_work_allowed ? 'yes' : 'no'} |`);
    }
    L.push('');
  }

  if (c.transitions) {
    L.push('## Lifecycle transitions and permitted actors');
    L.push('');
    L.push(`States: ${c.transitions.states.map((s) => '`' + s + '`').join(' → ')}`);
    L.push('');
    L.push(`Protected states: ${c.transitions.protected_states.map((s) => '`' + s + '`').join(', ')}`);
    L.push('');
    L.push('| From | To | Guard | Permitted actors | Protected |');
    L.push('|---|---|---|---|---|');
    for (const t of c.transitions.transitions) {
      L.push(`| ${t.from} | ${t.to} | ${t.guard} | ${t.permitted_actor_roles.join(', ')} | ${t.protected ? 'yes' : 'no'} |`);
    }
    L.push('');
  }

  if (c['information-access']) {
    const ia = c['information-access'];
    L.push('## Information access and context loading');
    L.push('');
    L.push(ia.principle);
    L.push('');
    L.push(`- **Startup** (≤ ${ia.max_startup_items}, target ${ia.startup_token_target} / hard ${ia.startup_token_hard_limit} tokens): ${ia.startup.map((s) => '`' + s + '`').join(', ')}`);
    L.push(`- **On demand:** ${ia.on_demand.join('; ')}`);
    L.push(`- **Restricted:** ${ia.restricted.join('; ')}`);
    L.push(`- **Forbidden (never loaded):** ${ia.forbidden.join('; ')}`);
    L.push('');
  }

  if (c.qa) {
    L.push('## QA independence and risk-selected gates');
    L.push('');
    L.push(c.qa.principle);
    L.push('');
    L.push('| Risk class | Required suites | Independent QA |');
    L.push('|---|---|---|');
    for (const r of c.qa.risk_classes) L.push(`| ${r.id} | ${r.required_suites.join(', ')} | ${r.independent_qa ? 'yes' : 'no'} |`);
    L.push('');
    L.push('| Gate | Risk | Verifier | Independent of maker | Waiver authority | Required evidence |');
    L.push('|---|---|---|---|---|---|');
    for (const g of c.qa.gates) {
      L.push(`| ${g.id} | ${g.risk_class} | ${g.verifier_role} | ${g.independent_of_maker ? 'yes' : 'no'} | ${g.waiver_authority_role} | ${g.required_evidence.join(', ')} |`);
    }
    L.push('');
  }

  if (c.evidence) {
    L.push('## Evidence responsibility');
    L.push('');
    L.push(c.evidence.principle);
    L.push('');
    L.push('| Evidence | Producer | Exact object | Verifier | Invalidation keys |');
    L.push('|---|---|---|---|---|');
    for (const e of c.evidence.evidence) {
      L.push(`| ${e.id} | ${e.producer_role} | ${e.exact_object} | ${e.verifier_role} | ${e.invalidation_keys.join(', ')} |`);
    }
    L.push('');
  }

  return L.join('\n');
}

// ---------------------------------------------------------------------------
// Runners.
// ---------------------------------------------------------------------------
const GENERATED_VIEW = 'generated/GOVERNANCE.md';

export function runValidate(root = ROOT) {
  const { contracts, errors } = loadContracts(root);
  const all = [...errors];
  // Only run semantic checks when all six contracts parsed + schema-validated.
  if (Object.keys(contracts).length === CONTRACTS.length && errors.length === 0) {
    all.push(...semanticChecks(contracts));
  }
  return { contracts, errors: all };
}

function runRender(root, check) {
  const { contracts, errors } = runValidate(root);
  if (errors.length) return { errors, drift: false };
  const view = renderGovernance(contracts) + '\n';
  const target = resolve(root, GENERATED_VIEW);
  if (check) {
    let current = null;
    try { current = readFileSync(target, 'utf8'); } catch { /* missing */ }
    if (current !== view) return { errors: [], drift: true };
    return { errors: [], drift: false };
  }
  writeFileSync(target, view);
  return { errors: [], drift: false, wrote: target };
}

// Self-test: prove each check can fail. Each plant deep-clones the valid corpus,
// injects exactly one defect, and asserts the relevant checker reports it.
export function runSelftest(root = ROOT) {
  const { contracts, errors } = loadContracts(root);
  if (errors.length) return { ok: false, detail: [`baseline corpus is invalid: ${errors[0]}`] };
  const base = () => JSON.parse(JSON.stringify(contracts));
  const results = [];
  const expectSemantic = (label, mutate, needle) => {
    const c = base();
    mutate(c);
    const errs = semanticChecks(c);
    const hit = errs.some((e) => e.includes(needle));
    results.push({ label, pass: hit, errs: hit ? [] : errs });
  };

  // Parser: duplicate keys.
  let dupCaught = false;
  try { strictParse('{"a":1,"a":2}'); } catch { dupCaught = true; }
  results.push({ label: 'parser rejects duplicate keys', pass: dupCaught });

  // Parser: trailing content.
  let trailCaught = false;
  try { strictParse('{"a":1} garbage'); } catch { trailCaught = true; }
  results.push({ label: 'parser rejects trailing content', pass: trailCaught });

  // Schema: unknown enum.
  {
    const schema = { type: 'object', properties: { risk: { enum: ['LOW', 'HIGH'] } } };
    const errs = validateSchema({ risk: 'WILD' }, schema);
    results.push({ label: 'schema rejects unknown enum', pass: errs.length > 0 });
  }
  // Schema: missing required.
  {
    const errs = validateSchema({}, { type: 'object', required: ['x'] });
    results.push({ label: 'schema rejects missing required', pass: errs.length > 0 });
  }
  // Schema: additionalProperties.
  {
    const errs = validateSchema({ x: 1, sneaky: 2 }, { type: 'object', properties: { x: {} }, additionalProperties: false });
    results.push({ label: 'schema rejects unknown property', pass: errs.length > 0 });
  }

  expectSemantic('dangling authority role', (c) => { c.authority.grants[0].routine_owner_role = 'ghost-role'; }, 'unknown role');
  expectSemantic('path traversal glob', (c) => { c['git-ownership'].paths.push({ glob: '../etc/**', owner_role: 'maker', serialized_lane: 'x' }); }, 'traversal');
  expectSemantic('overlapping writers', (c) => { c['git-ownership'].paths.push({ glob: '.agentops/governance/extra/**', owner_role: 'maker', serialized_lane: 'x' }); }, 'overlapping paths');
  expectSemantic('amplifying deputy grant', (c) => { c['owner-intent'].deputy.excluded_actions.push(c['owner-intent'].deputy.included_actions[0]); }, 'amplifying grant');
  expectSemantic('hierarchy dangling parent', (c) => { c.hierarchy.nodes[1].escalation_parent = 'nobody'; }, 'unknown escalation_parent');
  expectSemantic('hierarchy two roots', (c) => { c.hierarchy.nodes[1].escalation_parent = null; }, 'exactly one root');
  expectSemantic('deputy not in hierarchy', (c) => { c['owner-intent'].deputy.actor_id = 'phantom'; }, 'not present in the hierarchy');

  // Stage 2 required negative plants.
  expectSemantic('invalid RACI (two Accountable)', (c) => { c.raci.items[0].accountable = ['maker', 'it-manager-iii']; }, 'exactly one Accountable');
  expectSemantic('authority amplification (deputy delegates excluded)', (c) => { c.delegation.envelopes[0].delegated_actions.push('mutate main or release'); }, 'amplifies authority');
  expectSemantic('circular escalation', (c) => { c.escalation.classes[0].route = ['it-manager-iii', 'project-management-lead', 'it-manager-iii']; }, 'circular route');
  expectSemantic('illegal transition (maker on protected)', (c) => { c.transitions.transitions[c.transitions.transitions.length - 1].permitted_actor_roles.push('maker'); }, 'illegal transition');
  expectSemantic('maker self-approval (QA verifier)', (c) => { c.qa.gates[0].verifier_role = 'maker'; }, 'self-approve');
  expectSemantic('forbidden information preload', (c) => { c['information-access'].startup.push('all-chat-transcripts'); }, 'forbidden preload');
  expectSemantic('expired delegation', (c) => { c.delegation.envelopes[0].expiry = '2020-01-01T00:00:00Z'; }, 'already expired');
  expectSemantic('missing evidence ownership', (c) => { c.qa.gates[0].required_evidence.push('ghost-evidence'); }, 'no owner in evidence.json');

  const failed = results.filter((r) => !r.pass);
  return { ok: failed.length === 0, results, detail: failed.map((r) => `PLANT NOT CAUGHT: ${r.label}${r.errs ? ' | got: ' + JSON.stringify(r.errs) : ''}`) };
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------
function main(argv) {
  const cmd = argv[0] || 'verify';
  const flags = new Set(argv.slice(1));
  if (cmd === 'validate') {
    const { errors } = runValidate();
    if (errors.length) { console.error('VALIDATE FAIL:'); errors.forEach((e) => console.error('  - ' + e)); return 1; }
    console.log(`VALIDATE OK: ${CONTRACTS.length} contracts parsed, schema-valid, and cross-consistent.`);
    return 0;
  }
  if (cmd === 'render') {
    const { errors, drift, wrote } = runRender(ROOT, flags.has('--check'));
    if (errors.length) { console.error('RENDER blocked — contracts invalid:'); errors.forEach((e) => console.error('  - ' + e)); return 1; }
    if (flags.has('--check')) {
      if (drift) { console.error(`RENDER --check FAIL: ${GENERATED_VIEW} is stale; run \`node .agentops/tools/opsctl.mjs render\`.`); return 1; }
      console.log(`RENDER --check OK: ${GENERATED_VIEW} matches its sources.`);
      return 0;
    }
    console.log(`RENDER OK: wrote ${wrote}`);
    return 0;
  }
  if (cmd === 'verify') {
    const v = runValidate();
    if (v.errors.length) { console.error('VERIFY FAIL (validate):'); v.errors.forEach((e) => console.error('  - ' + e)); return 1; }
    const r = runRender(ROOT, true);
    if (r.drift) { console.error(`VERIFY FAIL: ${GENERATED_VIEW} is stale; run \`node .agentops/tools/opsctl.mjs render\`.`); return 1; }
    console.log('VERIFY OK: contracts valid, consistent, and generated view in sync.');
    return 0;
  }
  if (cmd === '--selftest' || cmd === 'selftest') {
    const s = runSelftest();
    if (!s.ok) { console.error('SELFTEST FAIL:'); s.detail.forEach((d) => console.error('  - ' + d)); return 1; }
    console.log(`SELFTEST OK: all ${s.results.length} negative plants correctly caught.`);
    return 0;
  }
  console.error(`Unknown command '${cmd}'. Use: validate | render [--check] | verify | --selftest`);
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
