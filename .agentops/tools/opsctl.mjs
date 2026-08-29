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

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';

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
    // RFC 8259 number grammar: [ "-" ] int [ frac ] [ exp ], where int is
    // "0" or a non-zero digit followed by digits, and both frac and exp require
    // at least one digit. Consuming an optional-digit run here would let `1.`,
    // `1e`, or a lone `-` through — invalid JSON that a standard parser rejects,
    // silently diverging the authoritative contract from what clean-clone
    // reconstruction reads back.
    const start = i;
    const digit = () => i < n && text[i] >= '0' && text[i] <= '9';
    if (text[i] === '-') i++;
    if (text[i] === '0') {
      i++;
    } else if (i < n && text[i] >= '1' && text[i] <= '9') {
      while (digit()) i++;
    } else {
      err('invalid number: expected digit');
    }
    if (text[i] === '.') {
      i++;
      if (!digit()) err('invalid number: expected digit after decimal point');
      while (digit()) i++;
    }
    if (text[i] === 'e' || text[i] === 'E') {
      i++;
      if (text[i] === '+' || text[i] === '-') i++;
      if (!digit()) err('invalid number: expected digit in exponent');
      while (digit()) i++;
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
  { name: 'evidence', file: 'governance/evidence.json', schema: 'schemas/evidence.schema.json' },
  { name: 'owner-command', file: 'governance/owner-command.json', schema: 'schemas/owner-command.schema.json' },
  { name: 'migration', file: 'governance/migration.json', schema: 'schemas/migration.schema.json' }
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
      // A per_seat namespace is owned by whichever lease holds the ticket, so
      // its owner_role is a marker rather than a declared role.
      if (!r.per_seat && !knownRoles.has(r.owner_role)) errors.push(`git-ownership: ref '${r.ref}' names unknown role '${r.owner_role}'`);
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

  // 13. Owner-command: enumerated actions authenticate declared roles; owner-exclusive
  //     actions admit only the owner; the actor map reconciles with owner intent.
  if (c['owner-command']) {
    const oc = c['owner-command'];
    const ids = new Set();
    for (const a of oc.actions) {
      if (ids.has(a.id)) errors.push(`owner-command: duplicate action id '${a.id}'`);
      ids.add(a.id);
      for (const r of a.authenticator_roles) if (!roles.has(r)) errors.push(`owner-command: action '${a.id}' names unknown authenticator role '${r}'`);
      if ((a.id === 'authorize-release' || a.id === 'record-owner-override') && !(a.authenticator_roles.length === 1 && a.authenticator_roles[0] === 'owner')) {
        errors.push(`owner-command: action '${a.id}' must be owner-exclusive`);
      }
    }
    if (c['owner-intent']) {
      if (oc.authenticated_actors.owner !== c['owner-intent'].owner.actor_id) errors.push(`owner-command: authenticated owner '${oc.authenticated_actors.owner}' does not match owner-intent owner '${c['owner-intent'].owner.actor_id}'`);
      if (oc.authenticated_actors.deputy !== c['owner-intent'].deputy.role) errors.push(`owner-command: authenticated deputy '${oc.authenticated_actors.deputy}' does not match owner-intent deputy role '${c['owner-intent'].deputy.role}'`);
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

// ===========================================================================
// Stage 3: runtime artifact classes — work capsules, writer leases, append-only
// events — plus the token-bounded `opsctl wake` compiler. These are per-ticket
// collections (not singletons), so they load and validate separately from the
// governance contracts. The wake capsule is disposable stdout, never committed.
// ===========================================================================

const RUNTIME_SCHEMAS = {
  capsule: 'schemas/work-capsule.schema.json',
  lease: 'schemas/lease.schema.json',
  event: 'schemas/event.schema.json'
};

// Deterministic, key-sorted JSON — the basis for a stable content hash.
export function stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

// A capsule's seal is the sha256 over the capsule with current_hash blanked.
// It is the compare-and-swap value: a stale expected-old-value or any tamper
// changes the content and so fails to match the stored current_hash.
// A ref is declared when it equals a git-ownership ref, or matches one written
// as a `prefix/*` namespace. Nothing else is a sanctioned working ref.
export function refDeclaration(contracts, ref) {
  const decls = (contracts['git-ownership'] && contracts['git-ownership'].refs) || [];
  return decls.find((d) => d.ref === ref || (d.ref.endsWith('/*') && ref.startsWith(d.ref.slice(0, -1)))) || null;
}

// A ref must be declared AND the seat must be entitled to it. Matching the name
// alone would let a capsule name `main` — owner-exclusive and protected — and
// pass, after which wake would hand a seat a protected branch as its working
// ref. A per_seat namespace is owned by whichever lease holds the ticket, so
// any role may hold its own; a protected ref is never a working ref at all.
export function refEntitlementErrors(contracts, label, ref, actor) {
  const d = refDeclaration(contracts, ref);
  if (!d) return [`${label} ref '${ref}' matches no declared ref in git-ownership.refs`];
  if (d.mutation === 'protected') return [`${label} ref '${ref}' is a protected ref and may never be a seat working ref`];
  if (d.per_seat) return [];
  if (d.owner_role !== actor) return [`${label} ref '${ref}' is owned by '${d.owner_role}', not '${actor}'`];
  return [];
}

// Every role that actually holds work must resolve to a hierarchy node, or a
// blocked seat has no escalation parent and its only outcome is silence.
export function hierarchyRoles(contracts) {
  const h = contracts.hierarchy || {};
  return new Set((h.nodes || []).map((n) => n.role));
}

// D5: a lease may only grant path globs that git-ownership actually declares,
// and only to the role that owns them. Without this, "one writer per
// overlapping path" is unenforced for every path outside .agentops/ — a lease
// could grant any role any glob and verify would stay green. A lease may
// declare `undeclared_paths_ok: true` for a deliberate exception; that is an
// explicit, reviewable choice rather than a silent gap.
export function pathGrantErrors(contracts, lease) {
  const errors = [];
  // An exception covers only the globs it names. A lease carrying one is still
  // fully validated for every other glob, so a grandfathered lease cannot be
  // widened later under cover of its own exception.
  const exempt = new Set(((lease.path_grant_exception || {}).globs) || []);
  const decls = (contracts['git-ownership'] && contracts['git-ownership'].paths) || [];
  for (const g of lease.path_globs) {
    if (exempt.has(g)) continue;
    const owner = decls.find((d) => globPrefix(g).startsWith(globPrefix(d.glob)));
    if (!owner) {
      errors.push(`lease '${lease.id}' grants '${g}', which no git-ownership path declares (declare it, or record a path_grant_exception with a reason)`);
    } else if (owner.owner_role !== lease.actor) {
      errors.push(`lease '${lease.id}' grants '${g}' to '${lease.actor}', but git-ownership assigns that path to '${owner.owner_role}'`);
    }
  }
  return errors;
}

export function computeCapsuleHash(capsule) {
  const clone = { ...capsule, current_hash: '' };
  return 'sha256:' + createHash('sha256').update(stableStringify(clone)).digest('hex');
}

// Literal directory prefix of a glob, for conservative overlap/coverage tests.
function globPrefix(glob) {
  const s = glob.search(/[*?[]/);
  const cut = s === -1 ? glob : glob.slice(0, s);
  const i = cut.lastIndexOf('/');
  return i === -1 ? '' : cut.slice(0, i + 1);
}

export function loadRuntime(root = ROOT) {
  const errors = [];
  const schemas = {};
  for (const [k, rel] of Object.entries(RUNTIME_SCHEMAS)) {
    try { schemas[k] = JSON.parse(readFileSync(resolve(root, rel), 'utf8')); }
    catch (e) { errors.push(`[runtime] schema load ${rel}: ${e.message}`); }
  }
  const capsules = {}, leases = [], events = {};

  const workDir = resolve(root, 'work');
  if (existsSync(workDir)) {
    for (const ticket of readdirSync(workDir).sort()) {
      const f = resolve(workDir, ticket, 'CURRENT.json');
      if (!existsSync(f)) continue;
      let cap; try { cap = strictParse(readFileSync(f, 'utf8')); } catch (e) { errors.push(`[capsule ${ticket}] parse: ${e.message}`); continue; }
      if (schemas.capsule) for (const err of validateSchema(cap, schemas.capsule, '$')) errors.push(`[capsule ${ticket}] schema: ${err}`);
      capsules[ticket] = cap;
    }
  }

  const leaseDir = resolve(root, 'leases');
  if (existsSync(leaseDir)) {
    for (const name of readdirSync(leaseDir).sort()) {
      if (!name.endsWith('.json')) continue;
      let l; try { l = strictParse(readFileSync(resolve(leaseDir, name), 'utf8')); } catch (e) { errors.push(`[lease ${name}] parse: ${e.message}`); continue; }
      if (schemas.lease) for (const err of validateSchema(l, schemas.lease, '$')) errors.push(`[lease ${name}] schema: ${err}`);
      leases.push(l);
    }
  }

  const evDir = resolve(root, 'events');
  if (existsSync(evDir)) {
    for (const ticket of readdirSync(evDir).sort()) {
      const tdir = resolve(evDir, ticket);
      const list = [];
      for (const name of readdirSync(tdir).sort()) {
        if (!name.endsWith('.json')) continue;
        let ev; try { ev = strictParse(readFileSync(resolve(tdir, name), 'utf8')); } catch (e) { errors.push(`[event ${ticket}/${name}] parse: ${e.message}`); continue; }
        if (schemas.event) for (const err of validateSchema(ev, schemas.event, '$')) errors.push(`[event ${ticket}/${name}] schema: ${err}`);
        list.push(ev);
      }
      list.sort((a, b) => a.seq - b.seq);
      events[ticket] = list;
    }
  }
  return { capsules, leases, events, errors };
}

// Cross-checks tying runtime artifacts to the governance contracts and to each
// other: one-writer lease collisions, lease expiry, append-only event chains,
// capsule seal (CAS) integrity, evidence ownership, and non-amplifying authority.
export function runtimeChecks(g, rt) {
  const errors = [];
  const roles = g.roles ? new Set(g.roles.roles.map((r) => r.role)) : new Set();
  // A role that holds work but has no hierarchy node has no escalation parent:
  // when it blocks, escalation routing has nowhere to send it and the only
  // recorded outcome is silence. Declaring the role is not enough.
  const hierRoles = hierarchyRoles(g);
  for (const l of rt.leases) if (!l.revoked) errors.push(...pathGrantErrors(g, l));
  const roleMay = new Map(g.roles ? g.roles.roles.map((r) => [r.role, new Set(r.may)]) : []);
  const evIds = g.evidence ? new Set(g.evidence.evidence.map((e) => e.id)) : new Set();
  const leaseById = new Map(rt.leases.map((l) => [l.id, l]));

  // Leases: role validity, time-bound, path safety.
  for (const l of rt.leases) {
    if (!roles.has(l.actor)) errors.push(`lease '${l.id}' actor role '${l.actor}' is unknown`);
    if (!roles.has(l.issuer)) errors.push(`lease '${l.id}' issuer role '${l.issuer}' is unknown`);
    if (l.expiry <= l.issued) errors.push(`lease '${l.id}' expiry is at or before issued (already expired)`);
    for (const p of l.path_globs) if (p.split('/').includes('..')) errors.push(`lease '${l.id}' path glob '${p}' contains a '..' traversal segment`);
  }
  // One writer per overlapping path/ref: two active leases on the same ref with
  // overlapping globs held by different actors are a collision.
  const active = rt.leases.filter((l) => !l.revoked);
  for (let a = 0; a < active.length; a++) for (let b = a + 1; b < active.length; b++) {
    const la = active[a], lb = active[b];
    if (la.ref !== lb.ref || la.actor === lb.actor) continue;
    const overlap = la.path_globs.some((ga) => lb.path_globs.some((gb) => {
      const pa = globPrefix(ga), pb = globPrefix(gb);
      return pa.startsWith(pb) || pb.startsWith(pa);
    }));
    if (overlap) errors.push(`lease collision: '${la.id}' and '${lb.id}' hold overlapping paths on ref '${la.ref}' for different actors ('${la.actor}' vs '${lb.actor}')`);
  }

  // Append-only event chains per ticket: one genesis, contiguous seq, unbroken parent chain.
  for (const [ticket, list] of Object.entries(rt.events)) {
    let prevId = null;
    list.forEach((ev, i) => {
      if (ev.ticket !== ticket) errors.push(`event '${ev.id}' ticket '${ev.ticket}' does not match its directory '${ticket}'`);
      if (ev.seq !== i + 1) errors.push(`event chain for '${ticket}' is not contiguous at seq ${ev.seq} (expected ${i + 1})`);
      if (i === 0) { if (ev.parent_event !== null) errors.push(`event chain for '${ticket}': first event '${ev.id}' must be genesis (null parent)`); }
      else if (ev.parent_event !== prevId) errors.push(`event chain for '${ticket}': event '${ev.id}' parent '${ev.parent_event}' breaks the chain (expected '${prevId}')`);
      if (ev.evidence_pointer && !evIds.has(ev.evidence_pointer)) errors.push(`event '${ev.id}' evidence_pointer '${ev.evidence_pointer}' has no owner in evidence.json`);
      prevId = ev.id;
    });
  }

  // Evidence-loss guard: any ticket that has a lease or an event chain MUST have
  // a live work capsule. Without this, deleting one capsule among several would
  // silently drop it from the capsule inventory instead of failing closed.
  const capsuleTickets = new Set(Object.keys(rt.capsules));
  const declaredTickets = new Set();
  for (const l of rt.leases) declaredTickets.add(l.ticket);
  for (const t of Object.keys(rt.events)) declaredTickets.add(t);
  for (const t of declaredTickets) {
    if (!capsuleTickets.has(t)) errors.push(`ticket '${t}' has a lease or event chain but no work capsule (evidence loss)`);
  }

  // Capsules: seal/CAS integrity, evidence ownership, authority, lease binding.
  for (const [ticket, cap] of Object.entries(rt.capsules)) {
    if (cap.ticket !== ticket) errors.push(`capsule for '${ticket}' has mismatched ticket field '${cap.ticket}'`);
    if (cap.current_hash !== computeCapsuleHash(cap)) errors.push(`capsule '${ticket}' seal mismatch: current_hash does not match content (stale expected-old-value or tampered)`);
    if (cap.evidence_pointers.length > 8) errors.push(`capsule '${ticket}' has ${cap.evidence_pointers.length} evidence pointers, exceeding the max of 8`);
    for (const ep of cap.evidence_pointers) if (!evIds.has(ep)) errors.push(`capsule '${ticket}' evidence pointer '${ep}' is not a declared evidence type in evidence.json`);
    const may = roleMay.get(cap.owner_actor);
    if (!may) errors.push(`capsule '${ticket}' owner_actor '${cap.owner_actor}' is not a declared role`);
    else for (const a of cap.authority.may) if (!may.has(a)) errors.push(`capsule '${ticket}' authority amplification: may '${a}' is not permitted for role '${cap.owner_actor}'`);
    const lease = leaseById.get(cap.writer_lease);
    if (!lease) errors.push(`capsule '${ticket}' references unknown writer_lease '${cap.writer_lease}'`);
    else {
      if (lease.revoked) errors.push(`capsule '${ticket}' writer_lease '${lease.id}' is revoked`);
      if (lease.ticket !== ticket) errors.push(`capsule '${ticket}' writer_lease '${lease.id}' belongs to ticket '${lease.ticket}'`);
      if (lease.actor !== cap.owner_actor) errors.push(`capsule '${ticket}' owner_actor '${cap.owner_actor}' does not match lease actor '${lease.actor}'`);
      if (hierRoles.size && !hierRoles.has(cap.owner_actor)) {
        errors.push(`capsule '${ticket}' owner_actor '${cap.owner_actor}' has no node in hierarchy.json, so a blocked seat has no escalation parent`);
      }
      if (lease.ref !== cap.ref) errors.push(`capsule '${ticket}' ref '${cap.ref}' does not match lease ref '${lease.ref}'`);
      // Capsule and lease agreeing proves nothing if both name a ref namespace
      // no policy declares. Every working ref must fall under a declared
      // git-ownership ref pattern, so `wake` cannot hand a seat a checkout
      // instruction the control plane never sanctioned.
      errors.push(...refEntitlementErrors(g, `capsule '${ticket}'`, cap.ref, cap.owner_actor));
      for (const p of cap.affected_paths) {
        const covered = lease.path_globs.some((g) => globPrefix(p).startsWith(globPrefix(g)));
        if (!covered) errors.push(`capsule '${ticket}' affected path '${p}' is not covered by its writer lease '${lease.id}'`);
      }
    }
  }

  // Migration policy cross-checks (pure over migration.json + capsules — no
  // legacy-filesystem access, so this stays clean-clone safe; the on-disk legacy
  // path existence is checked separately by `opsctl migrate`).
  if (g.migration) {
    const m = g.migration;
    const SAFE_DISPOSITIONS = new Set(['preserve-read-only', 'reference-only', 'migrate-to-capsule']);
    const srcIds = new Set(m.legacy_sources.map((s) => s.id));
    for (const s of m.legacy_sources) {
      if (!SAFE_DISPOSITIONS.has(s.disposition)) errors.push(`migration: legacy source '${s.id}' has a destructive disposition '${s.disposition}' (migration preserves legacy evidence, never deletes/overwrites)`);
    }
    const capsuleKeys = new Set(Object.keys(rt.capsules));
    const claimed = new Map();
    for (const w of m.work_items) {
      if (w.legacy_ref !== null && !srcIds.has(w.legacy_ref)) errors.push(`migration: work item '${w.id}' legacy_ref '${w.legacy_ref}' is not a declared legacy source`);
      if (w.new_capsule !== 'none') {
        if (claimed.has(w.new_capsule)) errors.push(`migration: capsule '${w.new_capsule}' is claimed by two work items ('${claimed.get(w.new_capsule)}' and '${w.id}')`);
        claimed.set(w.new_capsule, w.id);
      }
      if (w.status === 'migrated' && (w.new_capsule === 'none' || !capsuleKeys.has(w.new_capsule))) errors.push(`migration: work item '${w.id}' is 'migrated' but its capsule '${w.new_capsule}' does not exist`);
      if (w.status === 'proposed' && w.new_capsule !== 'none' && capsuleKeys.has(w.new_capsule)) errors.push(`migration: work item '${w.id}' is 'proposed' but capsule '${w.new_capsule}' already exists (should be 'migrated')`);
    }
  }
  return errors;
}

// Advisory live HEAD (never a validation gate — CI checks out a different SHA).
function currentHead(root) {
  try { return execSync('git rev-parse HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return null; }
}

// Advisory: does this working ref exist yet? A seat's ref is where it SHOULD
// work, so an absent ref is normal for an unstarted seat — but wake must say so
// rather than printing a checkout instruction that silently cannot be followed.
function refExists(root, ref) {
  try {
    execSync(`git rev-parse --verify --quiet ${JSON.stringify(ref)}`, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch { return false; }
}

// Build the capsule text from already-loaded contracts + runtime. Pure and
// deterministic in `frozen` mode (no live-HEAD lookup) — that mode is the basis
// of the reconstruction goldens and the clean-clone drill.
export function buildCapsule(contracts, rt, work, { frozen = false, head = null } = {}) {
  const cap = rt.capsules[work];
  if (!cap) return { errors: [`no work capsule for '${work}' under .agentops/work/`] };
  const oi = contracts['owner-intent'];
  const lease = rt.leases.find((l) => l.id === cap.writer_lease);
  const shrt = (o) => (o && o.length > 12) ? o.slice(0, 12) : (o || '?');
  let freshness;
  if (frozen) freshness = `as-recorded (base ${shrt(cap.base_oid)}); verify live HEAD out-of-band`;
  else if (!head) freshness = 'unknown (no live HEAD)';
  else if (head.startsWith(cap.base_oid) || cap.base_oid.startsWith(head)) freshness = `current (base matches HEAD ${shrt(head)})`;
  else freshness = `STALE — capsule base ${shrt(cap.base_oid)} != live HEAD ${shrt(head)}; re-seat before mutating`;
  const leaseState = !lease ? 'MISSING' : lease.revoked ? 'REVOKED' : `active until ${lease.expiry}`;

  const L = [];
  L.push('=== AGENTOPS WAKE CAPSULE ===');
  L.push(`IDENTITY   : actor=${cap.owner_actor} role=${cap.owner_actor} ticket=${cap.ticket} lease=${cap.writer_lease} (${leaseState})`);
  L.push(`MISSION    : ${oi.mission}`);
  L.push(`WORK       : ${cap.objective}`);
  L.push(`DONE-WHEN  : ${cap.done_when}`);
  L.push(`AUTHORITY  : may ${cap.authority.may.join(', ')} | must-not ${cap.authority.must_not.join(', ')} | expiry ${cap.authority.expiry}`);
  L.push(`FORBIDDEN  : ${oi.protected_decision_classes.join('; ')}`);
  const refNote = frozen ? '' : (refExists(ROOT, cap.ref) ? ' (exists)' : ' (NOT CREATED YET — create it before working; it is an isolated continuation branch)');
  L.push(`REPO/REF   : ${cap.repo} @ ${cap.ref}${refNote}`);
  L.push(`BASE       : ${cap.base_oid} tree ${cap.tree} dirty=${cap.expected_dirty_state}`);
  L.push(`NEXT ACTION: ${cap.next_action}`);
  L.push(`STOP       : lease expired or revoked; base_oid moved from HEAD; independent QA WITHHOLD; any protected transition (see FORBIDDEN)`);
  const rep = contracts['information-access'].reporting;
  L.push(`REPORTING  : ${rep.style} Must: ${rep.must.join('; ')}. Never: ${rep.must_not.join('; ')}.`);
  L.push(`EVIDENCE   : ${cap.evidence_pointers.slice(0, 8).join(', ') || '—'}`);
  L.push(`SOURCE     : ${cap.base_oid}`);
  L.push(`FRESHNESS  : ${freshness}`);
  L.push(`INVALIDATION: ${cap.invalidation_keys.join(', ')}`);
  if (cap.blocker) L.push(`BLOCKER    : ${JSON.stringify(cap.blocker)}`);
  const text = L.join('\n');
  return { errors: [], text, tokens: Math.ceil(text.length / 4), capsule: cap };
}

// The token-bounded wake compiler: emits ONE disposable capsule for an actor and
// a work item, reading only the governance contracts it needs plus that ticket's
// capsule and lease — never dumping full files or history. `--frozen` drops the
// live-HEAD lookup so output is byte-deterministic across clones/providers.
export function runWake(root, actor, work, { frozen = false } = {}) {
  const { contracts, errors } = loadContracts(root);
  if (errors.length) return { errors };
  const rt = loadRuntime(root);
  const cap = rt.capsules[work];
  if (!cap) return { errors: [`no work capsule for '${work}' under .agentops/work/`] };
  if (actor && actor !== cap.owner_actor) return { errors: [`actor '${actor}' does not own capsule '${work}' (owner is '${cap.owner_actor}')`] };
  return buildCapsule(contracts, rt, work, { frozen, head: frozen ? null : currentHead(root) });
}

// ===========================================================================
// Stage 5: authenticated owner-command path (dry-run) and the read-only Owner
// HUD. The command processor accepts only enumerated, authenticated, allowlisted
// actions with a compare-and-swap precondition; this stage ships the dry-run
// (records what it WOULD do) and performs no repository mutation. The HUD is a
// redacted, deterministic projection of validated state — never a write path.
// ===========================================================================

const REQUEST_SCHEMA_FILE = 'schemas/owner-command-request.schema.json';

// Validate an owner-command request against the policy: enumerated action,
// authenticated actor, required fields, and the compare-and-swap precondition.
// Pure over already-loaded contracts + runtime so the harness can plant defects.
export function validateCommand(contracts, rt, request) {
  const errors = [];
  const policy = contracts['owner-command'];
  if (!policy) return { ok: false, errors: ['owner-command policy not loaded'], decision: null };
  const roles = new Set(contracts.roles.roles.map((r) => r.role));
  const action = policy.actions.find((a) => a.id === request.action);
  if (!action) { errors.push(`action '${request.action}' is not in the owner-command allowlist`); return { ok: false, errors, decision: null }; }
  if (!roles.has(request.actor)) errors.push(`actor role '${request.actor}' is not a declared role`);
  if (!action.authenticator_roles.includes(request.actor)) errors.push(`actor '${request.actor}' is not authorized for action '${request.action}' (allowed: ${action.authenticator_roles.join(', ')})`);
  for (const f of action.required_fields) {
    const v = request[f];
    if (v === undefined || v === null || (typeof v === 'string' && v === '')) errors.push(`command '${request.action}' is missing required field '${f}'`);
  }
  let cas = 'n/a';
  if (action.requires_cas) {
    const cap = rt.capsules[request.target];
    if (!cap) errors.push(`command target '${request.target}' has no work capsule`);
    else if (request.expected_current_hash && computeCapsuleHash(cap) !== request.expected_current_hash) {
      errors.push(`stale command: expected_current_hash does not match the live state of '${request.target}' (compare-and-swap failed)`);
    } else if (request.expected_current_hash) cas = 'OK';
  }
  const ok = errors.length === 0;
  const decision = ok ? {
    schema: 'agentops/decision-event/v1',
    action: request.action, actor: request.actor, target: request.target,
    protected: action.protected, requires_cas: action.requires_cas, cas_precondition: cas,
    affects: action.affects,
    result: 'DRY-RUN — would append this decision event and CAS-update only the affected state; no repository mutation performed'
  } : null;
  return { ok, errors, decision };
}

// Resolve the lifecycle transition an action would perform, if it declares one.
// Returns { target, from } when a move is required, null when the action records
// a decision without changing state, or { error } when the move is not a
// declared, permitted transition. Legality comes from transitions.json alone:
// the transition must exist from the capsule's current state, and must permit
// the authenticating role — the owner role is additionally permitted on
// protected transitions, per transitions.rules.protected_actor.
export function resolveTransition(contracts, capsule, action, actorRole) {
  if (!action.lifecycle_target) return null;
  const target = action.lifecycle_target;
  const tr = contracts.transitions;
  if (!tr.states.includes(target)) return { error: `action '${action.id}' declares lifecycle_target '${target}', which is not a declared state` };
  if (!capsule) return { error: `action '${action.id}' moves lifecycle state but the target has no work capsule` };
  const from = capsule.lifecycle_state;
  const move = tr.transitions.find((t) => t.from === from && t.to === target);
  if (!move) return { error: `no declared transition '${from}' -> '${target}' for action '${action.id}'; the target is not at a state this decision can advance` };
  const permitted = move.permitted_actor_roles.includes(actorRole) || (actorRole === 'owner' && (move.protected || tr.protected_states.includes(target)));
  if (!permitted) return { error: `actor '${actorRole}' may not perform the transition '${from}' -> '${target}' (permitted: ${move.permitted_actor_roles.join(', ')})` };
  return { target, from };
}

// Apply a validated command: append one event and re-seal the target capsule
// under compare-and-swap. Append-only — it never rewrites an existing event or
// touches another ticket. Callers must pass a request that validateCommand has
// already accepted; this re-checks the CAS immediately before writing so a
// concurrent change cannot be overwritten.
export function applyCommand(root, contracts, rt, request, { now = new Date().toISOString() } = {}) {
  const action = contracts['owner-command'].actions.find((a) => a.id === request.action);
  const ticket = request.target;
  const capsule = rt.capsules[ticket];
  const written = [];

  const move = resolveTransition(contracts, capsule, action, request.actor);
  if (move && move.error) return { ok: false, errors: [move.error], written };

  const chain = (rt.events[ticket] || []).slice().sort((a, b) => a.seq - b.seq);
  const last = chain[chain.length - 1] || null;
  const seq = last ? last.seq + 1 : 1;
  const id = `${ticket}-${String(seq).padStart(4, '0')}`;
  const clearsBlocker = !!(action.resolves_blocker && capsule && capsule.blocker);
  const reason = request.reason ? String(request.reason).replace(/\s*\.\s*$/, '') : '';
  const summary = [
    move
      ? `Owner-command '${request.action}' by ${request.actor}: lifecycle ${move.from} -> ${move.target}.${request.candidate_oid ? ` Exact object ${request.candidate_oid}.` : ''}`
      : `Owner-command '${request.action}' by ${request.actor} recorded${reason ? `: ${reason}` : ''}.`,
    clearsBlocker ? 'Blocker cleared: the decision it was waiting on is now recorded.' : ''
  ].filter(Boolean).join(' ');
  const event = {
    schema: 'agentops/event/v1', id, ticket, seq,
    parent_event: last ? last.id : null,
    kind: 'owner-decision', actor: request.actor, at: now, summary
  };

  if (capsule) {
    // Re-check the seal immediately before writing: a capsule that changed since
    // validation must not be overwritten by a now-stale decision.
    if (action.requires_cas && computeCapsuleHash(capsule) !== request.expected_current_hash) {
      return { ok: false, errors: [`stale command at apply time: '${ticket}' changed after validation (compare-and-swap failed); nothing written`], written };
    }
    const next = JSON.parse(JSON.stringify(capsule));
    next.parent_hash = capsule.current_hash;
    next.revision = capsule.revision + 1;
    if (move) next.lifecycle_state = move.target;
    // A decision the blocker was waiting on has now been recorded, so the
    // blocker is cleared for actions that declare resolves_blocker. Without
    // this the capsule would keep reporting itself blocked after the answer
    // arrived, and the HUD would list a resolved decision forever.
    if (action.resolves_blocker && next.blocker) next.blocker = null;
    // The appended event is the decision's record; evidence_pointers carries
    // declared evidence types only (evidence.json), never event ids.
    delete next.current_hash;
    next.current_hash = computeCapsuleHash(next);
    const capPath = resolve(root, `work/${ticket}/CURRENT.json`);
    writeFileSync(capPath, JSON.stringify(reorderCapsule(next), null, 2) + '\n');
    written.push(`work/${ticket}/CURRENT.json`);
  }

  const evDir = resolve(root, `events/${ticket}`);
  mkdirSync(evDir, { recursive: true });
  const evPath = resolve(evDir, `${id}.json`);
  if (existsSync(evPath)) return { ok: false, errors: [`event '${id}' already exists; refusing to overwrite an append-only record`], written };
  writeFileSync(evPath, JSON.stringify(event, null, 2) + '\n');
  written.push(`events/${ticket}/${id}.json`);

  return { ok: true, errors: [], written, event, transition: move || null };
}

// Keep the capsule's key order stable so an applied decision produces a minimal,
// readable diff rather than reshuffling the whole file.
function reorderCapsule(cap) {
  const order = ['schema', 'revision', 'current_hash', 'parent_hash', 'ticket', 'lifecycle_state', 'objective', 'done_when', 'next_action', 'repo', 'ref', 'base_oid', 'tree', 'expected_dirty_state', 'owner_actor', 'writer_lease', 'affected_paths', 'evidence_pointers', 'blocker', 'authority', 'runtime_residue', 'rollback', 'invalidation_keys'];
  const out = {};
  for (const k of order) if (k in cap) out[k] = cap[k];
  for (const k of Object.keys(cap)) if (!(k in out)) out[k] = cap[k];
  return out;
}

// Parse a GitHub Issue Form body into an owner-command request. Issue forms
// render as "### <Label>" followed by the value, and unfilled optional fields
// render as "_No response_". This is a strict field-to-field mapping: it never
// evaluates the body, accepts only the known labels, and drops everything else,
// so free text an issue author writes cannot introduce a field. The resulting
// request still goes through the full schema + allowlist + CAS validation.
export function parseIssueCommand(body, { actor } = {}) {
  const FIELDS = {
    'action': 'action',
    'target ticket': 'target',
    'expected current hash': 'expected_current_hash',
    'candidate oid': 'candidate_oid',
    'reason': 'reason'
  };
  const errors = [];
  const out = { schema: 'agentops/owner-command-request/v1' };
  const text = String(body || '').replace(/\r\n/g, '\n');
  const sections = text.split(/^###[ \t]+/m).slice(1);
  for (const sec of sections) {
    const nl = sec.indexOf('\n');
    const label = (nl === -1 ? sec : sec.slice(0, nl)).trim().toLowerCase();
    const key = FIELDS[label];
    if (!key) continue; // unknown heading: ignored, never becomes a field
    const value = (nl === -1 ? '' : sec.slice(nl + 1)).trim();
    if (!value || value === '_No response_') continue;
    // One line only; a multi-line paste cannot smuggle structure into a field.
    out[key] = value.split('\n')[0].trim();
  }
  if (actor) out.actor = actor;
  if (!out.action) errors.push('issue form is missing the Action field');
  if (!out.target) errors.push('issue form is missing the Target ticket field');
  if (!out.actor) errors.push('no actor role resolved for this request');
  return { ok: errors.length === 0, errors, request: out };
}

// Run a command. Dry-run validates and reports what it would do without
// touching the repository; --apply performs the same validation and then writes
// the append-only decision event plus the compare-and-swap capsule re-seal.
export function runCommand(root, request, { dryRun = true } = {}) {
  const { contracts, errors } = loadContracts(root);
  if (errors.length) return { ok: false, errors, decision: null };
  let reqSchema;
  try { reqSchema = JSON.parse(readFileSync(resolve(root, REQUEST_SCHEMA_FILE), 'utf8')); }
  catch (e) { return { ok: false, errors: [`request schema load: ${e.message}`], decision: null }; }
  const schemaErrs = validateSchema(request, reqSchema, '$');
  if (schemaErrs.length) return { ok: false, errors: schemaErrs.map((e) => `request schema: ${e}`), decision: null };
  const rt = loadRuntime(root);
  if (rt.errors.length) return { ok: false, errors: rt.errors.map((e) => `runtime: ${e}`), decision: null };
  const res = validateCommand(contracts, rt, request);
  if (!res.ok || dryRun) return res;

  const applied = applyCommand(root, contracts, rt, request);
  if (!applied.ok) return { ok: false, errors: applied.errors, decision: null };
  return {
    ok: true, errors: [], written: applied.written,
    decision: {
      ...res.decision,
      result: applied.transition
        ? `APPLIED — appended ${applied.event.id} and moved ${request.target} ${applied.transition.from} -> ${applied.transition.target} under compare-and-swap`
        : `APPLIED — appended ${applied.event.id}; no lifecycle change is declared for this action`
    }
  };
}

// Deterministic, redacted, theme-aware Owner HUD. A pure function of validated
// JSON (no wall-clock, no secrets, no tokens): the deploying commit SHA is
// injected at publish time by the Pages workflow, so the committed file is
// drift-gateable. The HUD is read-only; decisions go through the owner-command
// path, never through this page.
export function renderHud(contracts, rt) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const oi = contracts['owner-intent'];
  const project = contracts.project;
  const tickets = Object.keys(rt.capsules).sort();
  const activeLeases = rt.leases.filter((l) => !l.revoked);
  const protectedStates = new Set(contracts.transitions.protected_states);
  const ownerActor = oi.owner.actor_id;

  const needsYou = tickets.filter((t) => { const b = rt.capsules[t].blocker; return b && b.wake === ownerActor; });
  const promotion = tickets.filter((t) => protectedStates.has(rt.capsules[t].lifecycle_state));
  const ownerReserved = contracts['owner-command'].actions.filter((a) => a.protected && a.authenticator_roles.length === 1 && a.authenticator_roles[0] === 'owner').map((a) => a.id);

  const L = [];
  L.push('<!DOCTYPE html>');
  L.push('<!-- GENERATED by .agentops/tools/opsctl.mjs render — do not edit by hand. Deterministic projection of validated repository state, served as a static file from the repository\'s published branch. -->');
  L.push('<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">');
  L.push(`<title>${esc(project.project_name)} — Owner HUD</title>`);
  L.push('<style>');
  L.push(':root{--bg:#f7f7f8;--fg:#1b1d21;--card:#fff;--line:#e2e3e7;--muted:#5c6169;--accent:#6b4bd6;--warn:#b23b2e;--ok:#1c7d4d}');
  L.push('@media(prefers-color-scheme:dark){:root{--bg:#15161a;--fg:#e9eaee;--card:#1e2026;--line:#2c2f37;--muted:#9aa0aa;--accent:#a48bff;--warn:#ff7a6b;--ok:#4bd694}}');
  L.push('*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}');
  L.push('header{padding:24px 20px;border-bottom:1px solid var(--line)}h1{margin:0 0 4px;font-size:20px}.sub{color:var(--muted);font-size:13px}');
  L.push('main{max-width:1000px;margin:0 auto;padding:20px;display:grid;gap:16px}');
  L.push('section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px}h2{margin:0 0 12px;font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}');
  L.push('table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600}');
  L.push('code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}.pill{display:inline-block;padding:1px 8px;border-radius:999px;border:1px solid var(--line);font-size:12px}');
  L.push('.none{color:var(--muted);font-style:italic}.ok{color:var(--ok)}.warn{color:var(--warn)}footer{max-width:1000px;margin:0 auto;padding:12px 20px 32px;color:var(--muted);font-size:12px}.wrap{overflow-x:auto}');
  L.push('</style></head><body>');
  L.push('<header>');
  L.push(`<h1>${esc(project.project_name)} — Owner HUD</h1>`);
  L.push(`<div class="sub">Read-only projection of validated repository state · policy <code>${esc(oi.policy_version)}</code> · stage <code>${esc(project.installed_stage)}</code> · regenerate with <code>opsctl render</code></div>`);
  L.push('</header><main>');

  L.push('<section><h2>Needs you now</h2>');
  if (needsYou.length === 0) L.push('<p class="none">No owner decisions are pending on the current committed state.</p>');
  else { L.push('<div class="wrap"><table><tr><th>Ticket</th><th>Blocker</th></tr>'); for (const t of needsYou) L.push(`<tr><td><code>${esc(t)}</code></td><td>${esc(JSON.stringify(rt.capsules[t].blocker))}</td></tr>`); L.push('</table></div>'); }
  L.push(`<p class="sub">Owner-exclusive command actions: ${ownerReserved.map((a) => `<span class="pill">${esc(a)}</span>`).join(' ')}</p>`);
  L.push('</section>');

  L.push('<section><h2>Promotion candidates &amp; protected risks</h2>');
  if (promotion.length === 0) L.push(`<p class="none">No ticket is at a protected state (${[...protectedStates].map(esc).join(', ')}) awaiting promotion.</p>`);
  else { L.push('<div class="wrap"><table><tr><th>Ticket</th><th>State</th></tr>'); for (const t of promotion) L.push(`<tr><td><code>${esc(t)}</code></td><td>${esc(rt.capsules[t].lifecycle_state)}</td></tr>`); L.push('</table></div>'); }
  L.push('</section>');

  L.push('<section><h2>Writer leases &amp; collisions</h2><div class="wrap"><table><tr><th>Lease</th><th>Actor</th><th>Ticket</th><th>Ref</th><th>Expiry</th></tr>');
  for (const l of activeLeases) L.push(`<tr><td><code>${esc(l.id)}</code></td><td>${esc(l.actor)}</td><td><code>${esc(l.ticket)}</code></td><td><code>${esc(l.ref)}</code></td><td>${esc(l.expiry)}</td></tr>`);
  L.push('</table></div><p class="sub">One writer per overlapping path/ref; collisions are rejected by <code>opsctl verify</code>.</p></section>');

  L.push('<section><h2>Traceability — ticket → actor → task → branch → commit → evidence</h2><div class="wrap"><table><tr><th>Ticket</th><th>Owner</th><th>State</th><th>Ref</th><th>Base</th><th>Evidence</th><th>Wake tokens</th></tr>');
  for (const t of tickets) {
    const cap = rt.capsules[t];
    const w = buildCapsule(contracts, rt, t, { frozen: true });
    L.push(`<tr><td><code>${esc(t)}</code></td><td>${esc(cap.owner_actor)}</td><td>${esc(cap.lifecycle_state)}</td><td><code>${esc(cap.ref)}</code></td><td><code>${esc(cap.base_oid.slice(0, 12))}</code></td><td>${cap.evidence_pointers.map(esc).join(', ') || '—'}</td><td>${w.tokens || '—'}</td></tr>`);
  }
  L.push('</table></div></section>');

  // Act on it: each ticket gets a prefilled owner-decision link carrying its
  // live compare-and-swap hash, so a decision is never filed against state the
  // owner did not see. The page stays read-only — the link opens an issue form,
  // and the workflow performs the enumerated, authenticated, CAS-checked write.
  const issueBase = `${String(project.repository).replace(/\.git$/, '')}/issues/new`;
  // Build the raw query; esc() performs the single HTML escape at output.
  const q = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  L.push('<section><h2>Decide</h2>');
  if (tickets.length === 0) L.push('<p class="none">No tickets are open.</p>');
  else {
    L.push('<div class="wrap"><table><tr><th>Ticket</th><th>State</th><th>Compare-and-swap hash</th><th>Decision</th></tr>');
    for (const t of tickets) {
      const cap = rt.capsules[t];
      const hash = computeCapsuleHash(cap);
      const link = `${issueBase}?${q({ template: 'owner-decision.yml', title: `[decision] ${t}`, target: t, hash })}`;
      L.push(`<tr><td><code>${esc(t)}</code></td><td>${esc(cap.lifecycle_state)}</td><td><code>${esc(hash.slice(0, 23))}…</code></td><td><a href="${esc(link)}">File a decision →</a></td></tr>`);
    }
    L.push('</table></div>');
  }
  L.push(`<p class="sub">Decisions are enumerated and compare-and-swap-checked: a command filed against a hash that has since moved is rejected as stale, never applied to unseen state. Only the owner's own issues execute. <a href="${esc(issueBase)}?${q({ template: 'help-desk-ticket.yml' })}">File a Help Desk ticket →</a></p>`);
  L.push('</section>');

  L.push('<section><h2>Context efficiency</h2>');
  const ia = contracts['information-access'];
  L.push(`<p class="sub">Startup budget: ≤ ${ia.max_startup_items} reads, target ${ia.startup_token_target} / hard ${ia.startup_token_hard_limit} tokens. Wake capsules above are the token-bounded resume unit.</p>`);
  L.push('</section>');

  L.push('</main><footer>Generated deterministically from <code>.agentops/</code> by <code>opsctl render</code>. No tokens, secrets, or write paths are present. Decisions flow through the authenticated owner-command path, never this page.</footer>');
  L.push('</body></html>');
  return L.join('\n');
}

// ===========================================================================
// Stage 6: migration tooling. Read-only over legacy evidence — it inventories
// the old coordination artifacts, classifies them, and proposes genesis work
// capsules that reference (never rewrite) old evidence. The destructive cutover
// and legacy-entrypoint replacement are owner-gated and out of scope here.
// ===========================================================================

// Deterministic migration plan from migration.json + capsule presence (both live
// in .agentops, so this is clean-clone safe — no legacy-filesystem access here).
export function renderMigration(contracts, rt) {
  const m = contracts.migration;
  const capsuleKeys = new Set(Object.keys(rt.capsules));
  const L = [];
  L.push('<!-- GENERATED by .agentops/tools/opsctl.mjs render — do not edit by hand. -->');
  L.push('');
  L.push('# AgentOps migration plan (generated view)');
  L.push('');
  L.push(m.principle);
  L.push('');
  L.push('## Legacy sources (read-only)');
  L.push('');
  L.push('| Source | Path | Kind | Classification | Disposition | Superseded by |');
  L.push('|---|---|---|---|---|---|');
  for (const s of m.legacy_sources) L.push(`| \`${s.id}\` | \`${s.path}\` | ${s.kind} | ${s.classification} | ${s.disposition} | ${s.superseded_by ? '`' + s.superseded_by + '`' : '—'} |`);
  L.push('');
  L.push('## Work items');
  L.push('');
  L.push('| Work item | Legacy ref | New capsule | Status | Capsule present |');
  L.push('|---|---|---|---|---|');
  for (const w of m.work_items) {
    const present = w.new_capsule === 'none' ? 'n/a' : (capsuleKeys.has(w.new_capsule) ? 'yes' : 'no (stub)');
    L.push(`| \`${w.id}\` | ${w.legacy_ref ? '`' + w.legacy_ref + '`' : '— (native)'} | ${w.new_capsule === 'none' ? '—' : '`' + w.new_capsule + '`'} | ${w.status} | ${present} |`);
  }
  L.push('');
  const counts = {};
  for (const s of m.legacy_sources) counts[s.classification] = (counts[s.classification] || 0) + 1;
  L.push(`Classification totals: ${Object.entries(counts).sort().map(([k, v]) => `${k} ${v}`).join(', ')}.`);
  L.push('');
  return L.join('\n');
}

// A genesis work-capsule stub for a proposed migration work item: schema-shaped,
// referencing the legacy source, with placeholders a human/tool fills and seals.
// Never written by this tool — proposal only.
export function genesisStub(contracts, workItem) {
  const src = contracts.migration.legacy_sources.find((s) => s.id === workItem.legacy_ref);
  return {
    schema: 'agentops/work-capsule/v1',
    revision: 1,
    current_hash: 'TO_BE_SEALED (opsctl seal on write)',
    parent_hash: null,
    ticket: workItem.new_capsule,
    lifecycle_state: 'proposed',
    objective: `Migrate legacy source '${workItem.legacy_ref}' (${src ? src.classification : 'unknown'}) into governed runtime state.`,
    done_when: 'TO_BE_FILLED',
    next_action: 'TO_BE_FILLED',
    repo: contracts.project.repository,
    ref: 'TO_BE_FILLED',
    base_oid: 'TO_BE_FILLED',
    tree: 'TO_BE_FILLED',
    expected_dirty_state: 'clean',
    owner_actor: 'it-manager-iii',
    writer_lease: 'TO_BE_ISSUED',
    affected_paths: src ? [src.path] : [],
    evidence_pointers: [],
    blocker: null,
    authority: { may: ['implement-locally-on-exclusive-paths'], must_not: ['push-pr-merge-deploy-or-release'], expiry: 'TO_BE_FILLED' },
    runtime_residue: 'none',
    rollback: 'discard the proposed stub; no legacy evidence is modified.',
    invalidation_keys: ['base_oid', 'tree', 'writer_lease']
  };
}

// The migration inventory tool. Runs on a FULL checkout: validates the policy,
// reports legacy classification, checks that each declared legacy path exists on
// disk (read-only), and — with `--plan` — proposes genesis stubs. Mutates nothing.
export function runMigrate(root, { plan = false } = {}) {
  const { contracts, errors } = runValidate(root);
  if (errors.length) return { ok: false, errors };
  const m = contracts.migration;
  const repoRoot = resolve(root, '..');
  const missing = [];
  for (const s of m.legacy_sources) {
    if (!existsSync(resolve(repoRoot, s.path))) missing.push(s.path);
  }
  const summary = m.legacy_sources.map((s) => ({ id: s.id, path: s.path, classification: s.classification, disposition: s.disposition, present: existsSync(resolve(repoRoot, s.path)) }));
  const stubs = plan ? m.work_items.filter((w) => w.status === 'proposed').map((w) => genesisStub(contracts, w)) : [];
  return { ok: true, errors: [], summary, missing, workItems: m.work_items, stubs };
}

// ---------------------------------------------------------------------------
// Runners.
// ---------------------------------------------------------------------------
const GENERATED_VIEW = 'generated/GOVERNANCE.md';
const RECON_DIR = 'generated/reconstruction';
const HUD_VIEW = 'generated/hud/index.html';
const MIGRATION_VIEW = 'generated/migration/PLAN.md';

// Every committed generated artifact, as {rel, text}. These are the sole
// writes of `render` and the drift gate of `verify`. Frozen wake goldens make
// reconstruction output part of the committed, deterministic surface: any clean
// clone on any provider must reproduce them byte-for-byte.
function generatedArtifacts(contracts, rt) {
  const out = [{ rel: GENERATED_VIEW, text: renderGovernance(contracts) + '\n' }];
  for (const ticket of Object.keys(rt.capsules).sort()) {
    const cap = buildCapsule(contracts, rt, ticket, { frozen: true });
    if (cap.errors && cap.errors.length) continue;
    out.push({ rel: `${RECON_DIR}/${ticket}.wake.txt`, text: cap.text + '\n' });
  }
  out.push({ rel: HUD_VIEW, text: renderHud(contracts, rt) + '\n' });
  if (contracts.migration) out.push({ rel: MIGRATION_VIEW, text: renderMigration(contracts, rt) + '\n' });
  return out;
}

export function runValidate(root = ROOT) {
  const { contracts, errors } = loadContracts(root);
  const all = [...errors];
  // Governance semantic checks run only once all contracts parsed + schema-valid.
  if (Object.keys(contracts).length === CONTRACTS.length && errors.length === 0) {
    all.push(...semanticChecks(contracts));
    // Runtime artifacts (capsules/leases/events) validate against the now-valid
    // governance contracts. Zero runtime artifacts is valid (no active tickets).
    const rt = loadRuntime(root);
    all.push(...rt.errors);
    if (rt.errors.length === 0) all.push(...runtimeChecks(contracts, rt));
  }
  return { contracts, errors: all };
}

function runRender(root, check) {
  const { contracts, errors } = runValidate(root);
  if (errors.length) return { errors, drift: false };
  const rt = loadRuntime(root);
  const arts = generatedArtifacts(contracts, rt);
  const drifted = [];
  const wrote = [];
  for (const a of arts) {
    const target = resolve(root, a.rel);
    if (check) {
      let current = null;
      try { current = readFileSync(target, 'utf8'); } catch { /* missing */ }
      if (current !== a.text) drifted.push(a.rel);
    } else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, a.text);
      wrote.push(a.rel);
    }
  }
  return { errors: [], drift: drifted.length > 0, drifted, wrote };
}

// Full verify semantics — contracts + runtime AND generated-view drift — so the
// drill's "verify green" claim matches the `verify` command exactly.
function verifyErrors(root) {
  const v = runValidate(root);
  if (v.errors.length) return v.errors;
  const r = runRender(root, true);
  return r.drift ? [`stale generated artifacts: ${r.drifted.join(', ')}`] : [];
}

// Materialize a clean-room reconstruction source from COMMITTED Git state
// (`git archive HEAD .agentops`) — never the working tree, so uncommitted or
// regenerated bytes cannot masquerade as the committed clean clone. Returns the
// path to the extracted `.agentops` dir, plus how it was sourced. Falls back to a
// working-tree copy only when git/archive is unavailable, and says so.
function materializeCommittedClone(root, dest) {
  const repoRoot = resolve(root, '..');
  const cloneAgentops = resolve(dest, '.agentops');
  mkdirSync(dest, { recursive: true });
  try {
    execSync(`git archive --format=tar HEAD .agentops | tar -x -C ${JSON.stringify(dest)}`,
      { cwd: repoRoot, stdio: ['ignore', 'ignore', 'ignore'], shell: '/bin/sh' });
    if (!existsSync(cloneAgentops)) throw new Error('git archive produced no .agentops');
    return { cloneAgentops, sourced: 'git archive (committed HEAD)' };
  } catch {
    cpSync(root, cloneAgentops, { recursive: true });
    return { cloneAgentops, sourced: 'working-tree copy (git archive unavailable)' };
  }
}

// The clean-clone / context-wipe reconstruction drill. Reconstructs ONLY from
// committed Git state and runs the CLONE'S OWN opsctl (code AND data both from
// the committed snapshot), so the drill is fully self-contained and independent
// of the working tree. It proves the committed clone (a) verifies via its own
// tooling, (b) that every ticket declared by any tracked artifact still has a
// live capsule (no silent evidence loss), and (c) that each ticket's frozen wake
// reproduces the clone's own committed golden.
export function runDrill(root = ROOT) {
  const steps = [];
  const record = (name, ok, detail = '') => steps.push({ name, ok, detail });

  // The working tree itself must fully verify (current code + current data).
  const liveErrs = verifyErrors(root);
  record('in-place verify (contracts + runtime + generated views)', liveErrs.length === 0, liveErrs.slice(0, 3).join(' | '));
  if (liveErrs.length) return { ok: false, steps };

  const clone = resolve(tmpdir(), `agentops-drill-${process.pid}-${Date.now()}`);
  try {
    const { cloneAgentops, sourced } = materializeCommittedClone(root, clone);
    record(`clean-room source materialized from committed state (${sourced})`, existsSync(cloneAgentops));
    const cloneCli = resolve(cloneAgentops, 'tools/opsctl.mjs');
    const repoDir = resolve(cloneAgentops, '..');
    const runClone = (args) => execSync(`node ${JSON.stringify(cloneCli)} ${args}`, { cwd: repoDir, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

    let cloneVerified = false;
    try { runClone('verify'); cloneVerified = true; }
    catch (e) { record('clean-room clone verifies via its own opsctl', false, String((e.stderr || '').toString() || e.message).trim().split('\n').slice(-3).join(' ')); }
    if (cloneVerified) record('clean-room clone verifies via its own opsctl', true);

    // Expected ticket set from EVERY tracked artifact in the clone — capsules,
    // leases, event chains, goldens — so a deleted capsule is caught, not dropped.
    const workDir = resolve(cloneAgentops, 'work');
    const capsuleTickets = existsSync(workDir) ? readdirSync(workDir).filter((t) => existsSync(resolve(workDir, t, 'CURRENT.json'))).sort() : [];
    const capsuleSet = new Set(capsuleTickets);
    const expected = new Set(capsuleTickets);
    const leaseDir = resolve(cloneAgentops, 'leases');
    if (existsSync(leaseDir)) for (const f of readdirSync(leaseDir)) if (f.endsWith('.json')) { try { expected.add(strictParse(readFileSync(resolve(leaseDir, f), 'utf8')).ticket); } catch { /* schema-checked by clone verify */ } }
    const evDir = resolve(cloneAgentops, 'events');
    if (existsSync(evDir)) for (const t of readdirSync(evDir)) expected.add(t);
    const reconDir = resolve(cloneAgentops, RECON_DIR);
    if (existsSync(reconDir)) for (const f of readdirSync(reconDir)) { const m = f.match(/^(.+)\.wake\.txt$/); if (m) expected.add(m[1]); }
    record('at least one work item to reconstruct', expected.size > 0, `${expected.size} tickets`);
    for (const t of [...expected].sort()) record(`ticket ${t}: has a live work capsule (no evidence loss)`, capsuleSet.has(t), capsuleSet.has(t) ? '' : 'declared by lease/events/golden but capsule missing');

    for (const t of capsuleTickets) {
      let there = null;
      try { there = runClone(`wake --work ${t} --frozen`); } catch { /* recorded as mismatch below */ }
      let golden = null;
      try { golden = readFileSync(resolve(reconDir, `${t}.wake.txt`), 'utf8'); } catch { /* missing */ }
      const matches = there !== null && golden !== null && there === golden;
      record(`reconstruct ${t}: clone wake reproduces its committed golden`, matches,
        golden === null ? 'golden missing — run render' : (matches ? '' : 'reconstruction differs from golden'));
    }
  } catch (e) {
    record('clean-room reconstruction completed', false, String(e && e.message || e));
  } finally {
    try { rmSync(clone, { recursive: true, force: true }); } catch { /* best effort */ }
  }

  const ok = steps.every((s) => s.ok);
  return { ok, steps };
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

  // Parser: incomplete number forms that a standard JSON parser rejects. Each
  // must throw — otherwise `1.`/`1e` slip through as `1`/`NaN` and `opsctl
  // verify` would greenlight a contract that clean-clone reconstruction cannot
  // read back with a conformant parser.
  for (const bad of ['1.', '1e', '1e+', '1E-', '-', '01', '-.5', '1.2.3']) {
    let caught = false;
    try { strictParse(bad); } catch { caught = true; }
    results.push({ label: `parser rejects incomplete number '${bad}'`, pass: caught });
  }

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

  // Stage 3 runtime plants — cloned from the real on-disk runtime corpus and run
  // through the same runtimeChecks() the live validate uses.
  const rt0 = loadRuntime(root);
  if (rt0.errors.length) return { ok: false, detail: [`baseline runtime corpus is invalid: ${rt0.errors[0]}`] };
  const baseRt = () => JSON.parse(JSON.stringify(rt0));
  const expectRuntime = (label, mutate, needle) => {
    const rt = baseRt();
    mutate(rt);
    const errs = runtimeChecks(contracts, rt);
    const hit = errs.some((e) => e.includes(needle));
    results.push({ label, pass: hit, errs: hit ? [] : errs });
  };
  expectRuntime('overlapping active lease (two writers)', (rt) => { rt.leases.push({ ...rt.leases[0], id: 'lease-collide', actor: 'data-architecture-lead' }); }, 'lease collision');
  expectRuntime('expired lease', (rt) => { rt.leases[0].expiry = '2019-01-01T00:00:00Z'; }, 'already expired');
  expectRuntime('capsule seal / CAS mismatch', (rt) => { rt.capsules['AS-1001'].objective = 'tampered objective'; }, 'seal mismatch');
  expectRuntime('capsule missing evidence pointer', (rt) => { rt.capsules['AS-1001'].evidence_pointers.push('ghost-evidence'); }, 'not a declared evidence type');
  expectRuntime('capsule authority amplification', (rt) => { rt.capsules['AS-1001'].authority.may.push('mutate-main-or-release'); }, 'authority amplification');
  expectRuntime('broken event chain', (rt) => { rt.events['AS-1001'][2].parent_event = 'AS-1001-0001'; }, 'breaks the chain');
  expectRuntime('affected path outside lease', (rt) => { rt.capsules['AS-1001'].affected_paths.push('src/**'); }, 'not covered by its writer lease');
  expectRuntime('exempted lease cannot be widened with an unnamed glob', (rt) => { rt.leases.find((x) => x.id === 'lease-AS-1001-maker').path_globs.push('content/**'); }, 'git-ownership assigns that path to');
  expectRuntime('lease grants an undeclared path glob', (rt) => { const l = rt.leases.find((x) => x.id === 'lease-AS-1001-maker'); delete l.path_grant_exception; l.path_globs = ['wildcat/**']; }, 'no git-ownership path declares');
  expectRuntime('lease grants a path owned by a different role', (rt) => { const l = rt.leases.find((x) => x.id === 'lease-AS-1001-maker'); delete l.path_grant_exception; l.path_globs = ['.agentops/governance/**']; }, 'git-ownership assigns that path to');
  expectRuntime('capsule claiming a protected ref', (rt) => { rt.capsules['AS-1001'].ref = 'main'; rt.leases.find((l) => l.id === rt.capsules['AS-1001'].writer_lease).ref = 'main'; }, 'protected ref and may never be a seat working ref');
  expectRuntime('capsule claiming a ref owned by another role', (rt) => { rt.capsules['AS-1001'].ref = 'dev'; rt.leases.find((l) => l.id === rt.capsules['AS-1001'].writer_lease).ref = 'dev'; }, "is owned by 'it-manager-iii'");
  expectRuntime('capsule ref outside any declared ref namespace', (rt) => { rt.capsules['AS-1001'].ref = 'wildcat/not-declared'; rt.leases.find((l) => l.id === rt.capsules['AS-1001'].writer_lease).ref = 'wildcat/not-declared'; }, 'no declared ref');
  expectRuntime('capsule owner role with no hierarchy node', (rt) => { rt.capsules['AS-1001'].owner_actor = 'generator'; rt.leases.find((l) => l.id === rt.capsules['AS-1001'].writer_lease).actor = 'generator'; }, 'no node in hierarchy');
  expectRuntime('capsule references missing lease', (rt) => { rt.capsules['AS-1001'].writer_lease = 'no-such-lease'; }, 'unknown writer_lease');
  expectRuntime('evidence loss: capsule deleted, lease/events orphaned', (rt) => { delete rt.capsules['AS-1001']; }, 'no work capsule');

  // Stage 5 owner-command plants — run through the same validateCommand() the
  // live dry-run uses. A valid control command must pass first.
  const capHash = computeCapsuleHash(rt0.capsules['AS-1001']);
  const baseReq = () => ({ schema: 'agentops/owner-command-request/v1', action: 'authorize-integration', actor: 'it-manager-iii', target: 'AS-1001', expected_current_hash: capHash, candidate_oid: '0'.repeat(40) });
  if (!validateCommand(contracts, rt0, baseReq()).ok) return { ok: false, detail: ['baseline owner-command control did not pass'] };
  const expectCommand = (label, mutate, needle) => {
    const r = baseReq();
    mutate(r);
    const res = validateCommand(contracts, rt0, r);
    const hit = !res.ok && res.errors.some((e) => e.includes(needle));
    results.push({ label, pass: hit, errs: hit ? [] : res.errors });
  };
  expectCommand('owner-command: unknown action rejected', (r) => { r.action = 'nuke'; }, 'not in the owner-command allowlist');
  expectCommand('owner-command: unauthorized actor rejected', (r) => { r.actor = 'maker'; }, 'not authorized');
  expectCommand('owner-command: stale compare-and-swap rejected', (r) => { r.expected_current_hash = 'sha256:stale'; }, 'stale command');
  expectCommand('owner-command: missing required field rejected', (r) => { delete r.candidate_oid; }, 'missing required field');
  expectCommand('owner-command: owner-exclusive release by deputy rejected', (r) => { r.action = 'authorize-release'; }, 'not authorized');

  // Stage 6 migration plants — run through the same runtimeChecks the live
  // validate uses (pure over migration.json + capsules).
  const expectMigration = (label, mutate, needle) => {
    const c = base();
    mutate(c);
    const errs = runtimeChecks(c, rt0);
    const hit = errs.some((e) => e.includes(needle));
    results.push({ label, pass: hit, errs: hit ? [] : errs });
  };
  expectMigration('migration: destructive disposition rejected', (c) => { c.migration.legacy_sources[0].disposition = 'delete-legacy'; }, 'destructive disposition');
  expectMigration('migration: dangling legacy_ref rejected', (c) => { c.migration.work_items[1].legacy_ref = 'ghost-source'; }, 'not a declared legacy source');
  expectMigration('migration: migrated item without a capsule rejected', (c) => { c.migration.work_items[0].new_capsule = 'AS-9999'; }, "but its capsule 'AS-9999' does not exist");
  expectMigration('migration: two work items claim one capsule', (c) => { c.migration.work_items[1].new_capsule = 'AS-1001'; c.migration.work_items[1].status = 'migrated'; }, 'claimed by two work items');
  expectMigration('migration: proposed item whose capsule already exists', (c) => { c.migration.work_items[2].new_capsule = 'AS-1001'; }, "'proposed' but capsule 'AS-1001' already exists");

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
    console.log(`VALIDATE OK: ${CONTRACTS.length} governance contracts + runtime artifacts parsed, schema-valid, and cross-consistent.`);
    return 0;
  }
  if (cmd === 'wake') {
    let actor = null, work = null;
    for (let i = 1; i < argv.length; i++) {
      if (argv[i] === '--actor') actor = argv[++i];
      else if (argv[i] === '--work') work = argv[++i];
    }
    if (!work) { console.error('wake requires --work <ticket> (and optionally --actor <role>)'); return 2; }
    const r = runWake(ROOT, actor, work, { frozen: flags.has('--frozen') });
    if (r.errors && r.errors.length) { console.error('WAKE blocked:'); r.errors.forEach((e) => console.error('  - ' + e)); return 1; }
    process.stdout.write(r.text + '\n');
    process.stderr.write(`\n[wake] ~${r.tokens} tokens (startup target 1200 / hard 1500)\n`);
    return 0;
  }
  if (cmd === 'render') {
    const { errors, drift, drifted, wrote } = runRender(ROOT, flags.has('--check'));
    if (errors.length) { console.error('RENDER blocked — contracts invalid:'); errors.forEach((e) => console.error('  - ' + e)); return 1; }
    if (flags.has('--check')) {
      if (drift) { console.error('RENDER --check FAIL: stale generated artifacts; run `node .agentops/tools/opsctl.mjs render`:'); drifted.forEach((d) => console.error('  - ' + d)); return 1; }
      console.log('RENDER --check OK: all generated artifacts match their sources.');
      return 0;
    }
    console.log(`RENDER OK: wrote ${wrote.length} artifact(s): ${wrote.join(', ')}`);
    return 0;
  }
  if (cmd === 'verify') {
    const v = runValidate();
    if (v.errors.length) { console.error('VERIFY FAIL (validate):'); v.errors.forEach((e) => console.error('  - ' + e)); return 1; }
    const r = runRender(ROOT, true);
    if (r.drift) { console.error('VERIFY FAIL: stale generated artifacts; run `node .agentops/tools/opsctl.mjs render`:'); r.drifted.forEach((d) => console.error('  - ' + d)); return 1; }
    console.log('VERIFY OK: contracts + runtime valid, consistent, and all generated views in sync.');
    return 0;
  }
  if (cmd === 'drill') {
    const d = runDrill();
    for (const s of d.steps) console.log(`  ${s.ok ? 'PASS' : 'FAIL'}  ${s.name}${s.detail ? ' — ' + s.detail : ''}`);
    if (!d.ok) { console.error('\nDRILL FAIL: clean-clone reconstruction did not reproduce exact state.'); return 1; }
    console.log('\nDRILL OK: clean-clone / context-wipe reconstruction reproduces exact state with zero evidence loss.');
    return 0;
  }
  if (cmd === 'command') {
    let file = null, json = null, issueFile = null, actor = null;
    for (let i = 1; i < argv.length; i++) {
      if (argv[i] === '--file') file = argv[++i];
      else if (argv[i] === '--request') json = argv[++i];
      else if (argv[i] === '--issue-file') issueFile = argv[++i];
      else if (argv[i] === '--actor') actor = argv[++i];
    }
    if (issueFile !== null) {
      let bodyText;
      try { bodyText = readFileSync(resolve(process.cwd(), issueFile), 'utf8'); }
      catch (e) { console.error(`command: could not read issue body (${e.message})`); return 2; }
      const parsed = parseIssueCommand(bodyText, { actor });
      if (!parsed.ok) { console.error('COMMAND REJECTED (issue form could not be read):'); parsed.errors.forEach((e) => console.error('  - ' + e)); return 1; }
      json = JSON.stringify(parsed.request);
    }
    const apply = flags.has('--apply');
    if (!apply && !flags.has('--dry-run')) { console.error('command requires --dry-run (validate only) or --apply (validate, then write the decision)'); return 2; }
    if (apply && flags.has('--dry-run')) { console.error('command: pass either --dry-run or --apply, not both'); return 2; }
    let request;
    try { request = strictParse(json !== null ? json : readFileSync(resolve(process.cwd(), file), 'utf8')); }
    catch (e) { console.error(`command: could not read request (${e.message}); pass --request '<json>' or --file <path>`); return 2; }
    const res = runCommand(ROOT, request, { dryRun: !apply });
    if (!res.ok) { console.error(`COMMAND REJECTED (${apply ? 'nothing written' : 'dry-run, no mutation'}):`); res.errors.forEach((e) => console.error('  - ' + e)); return 1; }
    if (!apply) {
      console.log('COMMAND ACCEPTED (dry-run, no mutation). Would append this decision event:');
      console.log(JSON.stringify(res.decision, null, 2));
      return 0;
    }
    console.log('COMMAND APPLIED. Wrote:');
    (res.written || []).forEach((w) => console.log('  - ' + w));
    console.log(JSON.stringify(res.decision, null, 2));
    console.log('\nRegenerate the drift-gated views before committing: node .agentops/tools/opsctl.mjs render');
    return 0;
  }
  if (cmd === 'migrate') {
    const r = runMigrate(ROOT, { plan: flags.has('--plan') });
    if (!r.ok) { console.error('MIGRATE blocked — policy invalid:'); r.errors.forEach((e) => console.error('  - ' + e)); return 1; }
    console.log('MIGRATION INVENTORY (read-only — no legacy evidence modified):');
    for (const s of r.summary) console.log(`  ${s.present ? 'present ' : 'MISSING '} ${s.id} [${s.classification}/${s.disposition}] ${s.path}`);
    console.log(`Work items: ${r.workItems.map((w) => `${w.id}=${w.status}`).join(', ')}`);
    if (r.missing.length) { console.error(`\nMIGRATE WARN: ${r.missing.length} declared legacy path(s) not found on disk: ${r.missing.join(', ')}`); return 1; }
    if (flags.has('--plan')) {
      console.log(`\nProposed genesis stubs (${r.stubs.length}, not written):`);
      console.log(JSON.stringify(r.stubs, null, 2));
    }
    console.log('\nMIGRATE OK: legacy sources classified; no mutation performed.');
    return 0;
  }
  if (cmd === '--selftest' || cmd === 'selftest') {
    const s = runSelftest();
    if (!s.ok) { console.error('SELFTEST FAIL:'); s.detail.forEach((d) => console.error('  - ' + d)); return 1; }
    console.log(`SELFTEST OK: all ${s.results.length} negative plants correctly caught.`);
    return 0;
  }
  console.error(`Unknown command '${cmd}'. Use: validate | render [--check] | verify | wake --work <ticket> [--actor <role>] [--frozen] | drill | command (--dry-run | --apply) (--request <json> | --file <path>) | migrate [--plan] | --selftest`);
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
