// .agentops/tools/opsctl.mjs — the AgentOps control-plane validator and view
// generator. Dependency-free Node ESM, matching this repository's tooling
// convention (pure stdlib, `--check`/`--selftest` self-verification).
//
// Subcommands:
//   validate            Parse + schema-validate + cross-contract checks. Exit 1 on any failure.
//   render              (Re)generate every view under .agentops/generated/ plus the published
//                       mirrors (/hud/, /review-approval-hub/) from validated JSON.
//   render --check      Regenerate in memory and fail (exit 1) if a committed view has drifted.
//   verify              validate, then render --check. The CI entry point.
//   wake                Compile one seat's bounded startup capsule. --frozen for the goldens.
//   dispatch            Which seats are due and who each wakes, derived from the contracts.
//                       --json for the seat executor. Nothing is decided here.
//   reseat              Advance an unstarted seat's base_oid to live HEAD and reseal.
//                       --all for every eligible seat. Refuses started seats and a detached HEAD.
//   reseal              Re-establish a capsule's compare-and-swap seal after a legitimate
//                       content change, keeping the chain. Requires --reason.
//   command             Owner-command path: --dry-run to decide, --apply to write.
//   drill               Clean-clone / context-wipe reconstruction drill.
//   migrate             Read-only legacy inventory; --plan proposes genesis stubs.
//   --selftest          Prove every check can actually fail, using in-memory negative plants.
//
// This list is not maintained by hand: `--selftest` fails if a dispatched
// subcommand is missing from it. It had drifted to 5 of 8 before that check
// existed (issue #392, D8), and the one it omitted was `wake` — the single
// command a cold-start seat depends on.
//
// Design invariants:
//   * Git history + validated JSON are authoritative; the Markdown view is a
//     generated projection with the sole writer being `render`.
//   * The generated view is deterministic — no timestamps or volatile state —
//     so `render --check` is a reliable drift gate.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execSync, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// A role that is a machine writer rather than a governed human/agent role.
// `generator` is the sole writer of .agentops/generated/** (opsctl render).
const SYNTHETIC_ROLES = new Set(['generator']);

// The actor a machine process writes under when it appends on its own account.
// A process acting on a seat's behalf must never carry that seat's actor:
// evidence.json binds a producer to an exact object, and an event signed
// `maker` that no maker performed binds a producer who did not produce.
// Ruling AS-HD-029-0052, point 3.
export const TOOL_ACTOR = 'opsctl';
// Events recorded before that ruling carry seat actors for tool-initiated
// reseats. The ledger is append-only and history rewrite is protected, so they
// stand permanently and AS-HD-029-0052 is their correction of record. The check
// below therefore binds only events recorded from the ruling forward.
export const TOOL_ACTOR_EFFECTIVE = '2026-08-30T02:14:08Z';

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
  { name: 'teams', file: 'governance/teams.json', schema: 'schemas/teams.schema.json' },
  { name: 'promotion-gates', file: 'governance/promotion-gates.json', schema: 'schemas/promotion-gates.schema.json' },
  { name: 'model-effort', file: 'governance/model-effort.json', schema: 'schemas/model-effort.schema.json' },
  { name: 'delivery', file: 'governance/delivery.json', schema: 'schemas/delivery.schema.json' },
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
  { name: 'migration', file: 'governance/migration.json', schema: 'schemas/migration.schema.json' },
  { name: 'directives', file: 'governance/directives.json', schema: 'schemas/directives.schema.json' },
  { name: 'retention', file: 'governance/retention.json', schema: 'schemas/retention.schema.json' }
];

// Derived, never restated. The test asserted a hardcoded 19 with the number
// spelled out in its own label, so registering a contract failed a check whose
// real subject is "every registered contract loads".
export const CONTRACT_COUNT = CONTRACTS.length;

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
// A shape-valid timestamp is not a real instant. The schema patterns accept
// `2026-02-30T00:00:00Z` and `2026-01-01T25:00:00Z`, and `new Date()` silently
// normalises both — to March 2 and to the next day — so a window can validate,
// render, and mean a different moment than it says. Round-tripping the parsed
// UTC fields back against the written ones is the only way to reject that.
// Returns epoch ms, or null when the string does not denote the instant it
// spells. Callers compare the numbers: '<=' on the strings is lexicographic and
// only happens to work while every timestamp is the same fixed-width UTC shape.
export function utcInstant(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(String(s));
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m.map(Number);
  const t = Date.UTC(y, mo - 1, d, h, mi, se);
  const back = new Date(t);
  const ok = back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d
    && back.getUTCHours() === h && back.getUTCMinutes() === mi && back.getUTCSeconds() === se;
  return ok ? t : null;
}

// This function used to take an injectable `now`, with a comment claiming
// validation was time-aware. It was not: the only clock-relative rule went out
// with the withdrawn self-certification block, and the parameter sat unused
// behind a comment asserting a property nothing enforced — the same defect
// class this file exists to catch, in this file. It is gone.
//
// Where the clock does belong is the wake surface, which already reports a
// lease as expired against `now` when deciding whether a seat may act. A
// contract window is different: making `verify` fail because a date passed
// would turn CI red with no change to the corpus and nobody to blame, so the
// checks below validate that a window is a REAL, ordered pair of instants and
// leave the lapse to the surface that reads it.
export function semanticChecks(c) {
  const errors = [];

  // --- authority tiers (P0-P4) and ticket flow ----------------------------
  // A rank system is dangerous in exactly two ways: an actor can fall outside
  // it and be ungoverned, and it can start deciding things ranks must not
  // decide. Both are checked here.
  if (c.hierarchy && c.hierarchy.authority_tiers && c.roles) {
    const at = c.hierarchy.authority_tiers;
    const nodes = new Set(c.hierarchy.nodes.map((n) => n.actor_id));
    const placed = new Map();
    for (const lv of at.levels) {
      for (const a of lv.actors) {
        if (!nodes.has(a)) errors.push(`hierarchy: authority tier P${lv.p} names '${a}', which is not a hierarchy node`);
        if (placed.has(a)) errors.push(`hierarchy: '${a}' is placed in both P${placed.get(a)} and P${lv.p}; an actor holds one tier`);
        placed.set(a, lv.p);
      }
    }
    // An actor outside the ladder has authority nobody wrote down.
    for (const n of nodes) if (!placed.has(n)) errors.push(`hierarchy: '${n}' is a hierarchy node in no authority tier; its decision authority is undeclared`);

    // The same hole one level up. The ladder places ACTORS, so a role with no
    // standing actor sits outside it entirely: the nine seniority roles that
    // arrived with the programmers, art and QA rosters hold `may`, `must_not`
    // and an approval ceiling that nothing in the ladder constrains. Their own
    // missions say what they are — "the maker archetype at entry level" — but
    // prose is not a constraint. A role either has a standing actor in the
    // hierarchy, or it declares the archetype it derives from, and then it
    // carries exactly that archetype's authority.
    const AUTHORITY_FIELDS = ['may', 'must', 'must_not', 'approval_ceiling'];
    const byRole = new Map(c.roles.roles.map((r) => [r.role, r]));
    const staffed = new Set(c.hierarchy.nodes.map((n) => n.role));
    for (const r of c.roles.roles) {
      if (!r.archetype) {
        if (!staffed.has(r.role)) errors.push(`roles: '${r.role}' has no actor in the hierarchy and declares no archetype, so no authority tier governs what it may do`);
        continue;
      }
      const a = byRole.get(r.archetype);
      if (!a) { errors.push(`roles: '${r.role}' derives from archetype '${r.archetype}', which is not a declared role`); continue; }
      if (a.archetype) { errors.push(`roles: '${r.role}' derives from '${r.archetype}', which is itself derived; an archetype chain lets authority drift a link at a time`); continue; }
      if (!staffed.has(a.role)) { errors.push(`roles: '${r.role}' derives from '${a.role}', which has no actor in the hierarchy either, so neither is placed in a tier`); continue; }
      for (const f of AUTHORITY_FIELDS) {
        if (JSON.stringify(r[f]) !== JSON.stringify(a[f])) {
          errors.push(`roles: '${r.role}' derives from '${a.role}' but its ${f} differs; a seniority level is assignment scope, never a wider authority ceiling`);
        }
      }
    }
    const owner = c['owner-intent'] && c['owner-intent'].owner.actor_id;
    const p0 = at.levels.find((l) => l.p === 0);
    if (owner && p0 && !p0.actors.includes(owner)) errors.push(`hierarchy: P0 does not contain the owner '${owner}'`);
    if (owner && at.levels.some((l) => l.p !== 0 && l.actors.includes(owner))) errors.push(`hierarchy: the owner '${owner}' appears below P0`);
    // The ladder must keep saying it is not a capability ladder; 0006 forbids
    // selection by rank, and this is where that would quietly erode.
    if (!/never.*(model|effort)|not.*(model|effort)/i.test(at.rules.not_a_capability_ladder || '')) {
      errors.push('hierarchy: authority tiers no longer state that a level never selects model or effort');
    }
    // P<n> means two things here, and that is the owner's decision: on a team or
    // actor it is authority, on an issue or ticket it is priority. A shared
    // letter is safe only while the rule separating them is written down and the
    // two subject lists stay disjoint — an overlap would make some subject
    // readable both ways, which is the actual hazard.
    const dis = at.disambiguation;
    if (at.namespace === 'P') {
      if (!dis) {
        errors.push("hierarchy: authority tiers share the 'P' namespace with incident priority but declare no disambiguation rule");
      } else {
        const overlap = dis.authority_subjects.filter((a) => dis.priority_subjects.some((b) => b.toLowerCase() === a.toLowerCase()));
        if (overlap.length) {
          errors.push(`hierarchy: '${overlap.join(', ')}' is listed as both an authority and a priority subject; a P-code on it would be readable both ways`);
        }
        if (!/subject/i.test(dis.rule)) {
          errors.push('hierarchy: the disambiguation rule no longer says the subject decides the meaning');
        }
      }
    }
  }
  if (c.escalation && c.escalation.ticket_flow && c.roles) {
    const tf = c.escalation.ticket_flow;
    const roleSet = new Set(c.roles.roles.map((r) => r.role));
    const owner = c['owner-intent'] && c['owner-intent'].owner.actor_id;
    for (const st of tf.steps) {
      if (!roleSet.has(st.actor)) errors.push(`escalation: ticket_flow step ${st.n} names actor '${st.actor}', which roles.json does not declare`);
      // The whole point: the Owner is not a step in the ordinary flow. Both
      // spellings must be rejected — the owner's actor id AND the 'owner' role,
      // since routing to the role reaches the same person by another name.
      const ownerRole = (c.roles.roles.find((r) => /^owner$/i.test(r.role)) || {}).role;
      if ((owner && st.actor === owner) || (ownerRole && st.actor === ownerRole)) {
        errors.push(`escalation: ticket_flow step ${st.n} routes to the owner; the owner is reached only through an owner-exclusive escalation class`);
      }
    }
    for (const e of ['SENT', 'RECEIVED', 'ACKNOWLEDGED']) {
      if (!tf.handoff_events.includes(e)) errors.push(`escalation: ticket_flow drops the '${e}' handoff event; a failed transport would prove receipt`);
    }
  }

  // --- branch hygiene -----------------------------------------------------
  // Rebase is the standard way to bring a branch forward, but it rewrites
  // history someone else may already hold. The permission that makes that
  // acceptable has to name a real standing role, and no rewrite may touch a
  // ref whose mutation policy forbids it.
  if (c['git-ownership'] && c['git-ownership'].branch_hygiene) {
    const bh = c['git-ownership'].branch_hygiene;
    if (c.roles && !c.roles.roles.some((r) => r.role === bh.permission_role)) {
      errors.push(`git-ownership: branch_hygiene permission_role '${bh.permission_role}' is not a declared role`);
    }
    // Any standing role satisfied this, so it could move to help-desk and still
    // validate. The ladder already names who holds branch-rewrite permission;
    // derive it from there instead of restating it.
    if (c.hierarchy && c.hierarchy.authority_tiers) {
      // Deriving from the tier text was itself two mutable declarations: move
      // 'branch-rewrite permission' to P2 and permission_role to help-desk and
      // they agree. Rewriting history is the deputy's, by decision.
      const deputy = c['owner-intent'] && c['owner-intent'].deputy.actor_id;
      if (deputy && bh.permission_role !== deputy) {
        errors.push(`git-ownership: branch_hygiene permission_role is '${bh.permission_role}'; rewriting a branch that is not your own is the deputy's ('${deputy}'), and moving the tier text does not transfer it`);
      }
      const holder = c.hierarchy.authority_tiers.levels.find((l) => l.holds.some((h) => /branch-rewrite/i.test(h)));
      if (!holder) errors.push('hierarchy: no authority tier claims branch-rewrite permission, so the ladder and git-ownership disagree about who holds it');
      else if (deputy && !holder.actors.includes(deputy)) {
        errors.push(`hierarchy: branch-rewrite permission sits at P${holder.p}, which does not include the deputy '${deputy}'`);
      }
    }
    if (c.teams && !c.teams.standing_roles.some((r) => r.id === bh.permission_role)) {
      errors.push(`git-ownership: branch_hygiene permission_role '${bh.permission_role}' is not a standing role; a rewrite permission cannot rest with a pool or an absent role`);
    }
    if (!bh.never.some((n) => /protected|pr-only/i.test(n))) {
      errors.push('git-ownership: branch_hygiene does not forbid rewriting a protected or pr-only ref');
    }
    if (!bh.records.some((r) => /prior head/i.test(r))) {
      errors.push('git-ownership: branch_hygiene records no prior head; a rewrite with no recorded predecessor cannot be undone');
    }
  }

  // --- canonical documents ------------------------------------------------
  // Decision 0004 moved the art policy to one live path and said plainly:
  // never recreate two live copies. A duplicate policy is worse than none,
  // because both look authoritative. Checked against the working tree, and
  // skipped in an .agentops-only clean room where docs/ does not exist.
  if (c['information-access'] && c['information-access'].canonical_documents && existsSync(resolve(ROOT, '../docs'))) {
    for (const doc of c['information-access'].canonical_documents) {
      if (!existsSync(resolve(ROOT, '..', doc.path))) {
        errors.push(`information-access: the canonical document for '${doc.topic}' is declared at '${doc.path}', which does not exist`);
      }
      for (const old of doc.superseded_paths) {
        if (existsSync(resolve(ROOT, '..', old))) {
          errors.push(`information-access: '${old}' still exists alongside the canonical '${doc.path}' for '${doc.topic}'; two live copies both look authoritative`);
        }
      }
    }
  }

  // --- delivery and Pages -------------------------------------------------
  // Decision 0005 governs delivery to dev, promotion readiness and the Pages
  // source. The Pages half is the part with teeth: a source switch must record
  // its rollback BEFORE it happens, so a failed deployment has somewhere to go
  // back to. Encoded after a Pages deployment replaced a live site in this
  // repository with no recorded prior state to restore.
  if (c.delivery) {
    const d = c.delivery;
    if (c.roles) {
      const roleSet = new Set(c.roles.roles.map((r) => r.role));
      for (const [label, role] of [['dev_delivery', d.dev_delivery.actor_role], ['promotion_readiness', d.promotion_readiness.actor_role], ['pages.switch_requires', d.pages.switch_requires.authorizing_role]]) {
        if (!roleSet.has(role)) errors.push(`delivery: ${label} names actor role '${role}', which roles.json does not declare`);
      }
    }
    // Declaring a packet ready must grant nothing; that is the whole difference
    // between "ready to be considered" and "release-ready".
    if (d.promotion_readiness.grants.length) {
      errors.push(`delivery: promotion_readiness declares grants (${d.promotion_readiness.grants.join(', ')}); declaring a packet ready grants no promotion authority`);
    }
    // The Pages source must be a ref the policy actually knows, and a protected
    // one — an unprotected desired source is a site anyone can repoint.
    if (c['git-ownership']) {
      const ref = c['git-ownership'].refs.find((r) => r.ref === d.pages.desired_source);
      if (!ref) errors.push(`delivery: the desired Pages source '${d.pages.desired_source}' is not a declared ref`);
      else if (ref.mutation !== 'protected') errors.push(`delivery: the desired Pages source '${d.pages.desired_source}' is '${ref.mutation}', not protected`);
    }
    // A switch must escalate to the owner, and must record a rollback.
    if (c.escalation) {
      const cls = c.escalation.classes.find((x) => x.id === d.pages.switch_requires.escalation_class);
      if (!cls) errors.push(`delivery: a Pages switch escalates as '${d.pages.switch_requires.escalation_class}', which escalation.json does not declare`);
      else if (c['owner-intent'] && cls.wake !== c['owner-intent'].owner.actor_id) {
        errors.push(`delivery: a Pages switch escalates as '${cls.id}', which wakes '${cls.wake}' rather than the owner`);
      }
    }
    if (!d.pages.switch_packet_records.some((x) => /rollback/i.test(x))) {
      errors.push('delivery: the Pages switch packet records no rollback; a failed deployment would have nowhere to return to');
    }
    if (!d.promotion_packet.required_fields.some((x) => /rollback/i.test(x))) {
      errors.push('delivery: the promotion packet requires no rollback field');
    }
  }

  // --- model and effort ---------------------------------------------------
  // Decision 0006's load-bearing sentence is that selecting a model grants
  // nothing and a stronger model does not outrank a weaker one. Encoded as a
  // rule so a tier cannot quietly acquire authority by being the "big" one.
  if (c['model-effort']) {
    const me = c['model-effort'];
    if (me.grants.length) errors.push(`model-effort: the contract declares grants (${me.grants.join(', ')}); model selection grants no authority`);
    const seenTier = new Set();
    for (const t of me.tiers) {
      if (seenTier.has(t.id)) errors.push(`model-effort: tier '${t.id}' is declared twice`);
      seenTier.add(t.id);
      // A tier that permits max effort without demanding the exceptional reason
      // turns the escape hatch into the default.
      if (t.allowed_efforts.includes('max') && t.requires_exceptional_reason !== true) {
        errors.push(`model-effort: tier '${t.id}' allows 'max' effort without requiring an exceptional reason`);
      }
    }
    // Selection is by risk and station, never role rank: a tier naming a role
    // would reintroduce exactly that.
    if (c.roles) {
      const roleSet = new Set(c.roles.roles.map((r) => r.role));
      for (const t of me.tiers) {
        if (roleSet.has(t.id)) errors.push(`model-effort: tier '${t.id}' is named after a role; selection follows risk and station, never role rank`);
      }
    }
  }

  // --- promotion gates ---------------------------------------------------
  // Decision 0009 defines Gates A-F: who may act, what evidence each needs,
  // and — the part that matters most — what each explicitly does NOT grant.
  // It lived only as a decision record, so nothing stopped a transition guard
  // paraphrasing a gate wrongly, or a gate quietly claiming release authority.
  // An action whose lifecycle_target is reached by a protected transition is a
  // protected action. Restating the flag by hand let fast-forward-test declare
  // itself unprotected while moving through transitions.json's protected
  // `dev-integrated -> hosted-verified`, so generated governance and every
  // decision event reported a protected promotion as ordinary.
  if (c['owner-command'] && c.transitions) {
    for (const a of c['owner-command'].actions) {
      if (!a.lifecycle_target) continue;
      const moves = c.transitions.transitions.filter((t) => t.to === a.lifecycle_target);
      if (moves.length && moves.every((t) => t.protected) && !a.protected) {
        errors.push(`owner-command: action '${a.id}' moves to '${a.lifecycle_target}', which transitions.json reaches only by protected moves, but declares protected:false; a consumer filtering on that flag would omit it`);
      }
    }
  }

  // An action that performs a gate must move the lifecycle that gate guards.
  // fast-forward-test advanced `test` and left the capsule at dev-integrated,
  // so Gate D's declared hosted-verified -> resolved transition was unreachable:
  // the ref said promoted and the authoritative lifecycle did not.
  if (c['owner-command'] && c['promotion-gates']) {
    const gateC = c['promotion-gates'].gates.find((g) => (g.guards_transitions || []).length && /fast-forward/i.test(g.entry || ''));
    const ffAction = c['owner-command'].actions.find((a) => a.id === 'fast-forward-test');
    if (gateC && ffAction) {
      const to = (gateC.guards_transitions[0] || {}).to;
      if (to && ffAction.lifecycle_target !== to) {
        errors.push(`owner-command: action 'fast-forward-test' performs Gate ${gateC.id}, which guards the move to '${to}', but declares lifecycle_target '${ffAction.lifecycle_target || 'none'}'; the ref would advance while the capsule stood still`);
      }
    }
  }

  // A gate requiring evidence nobody declares is a gate nothing can pass.
  // Gate B required 'hosted-evidence-url' while evidence.json declares
  // 'hosted-verification-receipt' — the same concept under a name the manifest
  // never had — so a capsule could neither hold it (runtimeChecks rejects an
  // undeclared pointer) nor omit it. Nothing caught that until a check depended
  // on it, which is the point of checking it here.
  if (c['promotion-gates'] && c.evidence) {
    const declared = new Set(c.evidence.evidence.map((e) => e.id));
    for (const g of c['promotion-gates'].gates) {
      for (const need of g.required_evidence || []) {
        if (!declared.has(need)) {
          errors.push(`promotion-gates: gate ${g.id} requires evidence '${need}', which evidence.json does not declare; a capsule can neither hold it nor pass without it`);
        }
      }
    }
  }

  if (c['promotion-gates'] && c.roles && c.transitions) {
    const pg = c['promotion-gates'];
    const roleSet = new Set(c.roles.roles.map((r) => r.role));
    const states = new Set(c.transitions.states);
    const seenGate = new Set();
    const ownerReserved = new Set(['main', 'release', 'tag', 'publication', 'Pages']);
    for (const g of pg.gates) {
      if (seenGate.has(g.id)) errors.push(`promotion-gates: gate '${g.id}' is declared twice`);
      seenGate.add(g.id);
      // An actor that is not a declared role cannot be held to the gate.
      // 'owner' is a declared role in roles.json, so this covers E and F too.
      if (!roleSet.has(g.actor_role)) errors.push(`promotion-gates: gate ${g.id} names actor role '${g.actor_role}', which roles.json does not declare`);
      // Widening transitions alongside this made it self-consistent: the gate
      // and the lifecycle agreed that a maker could act, and nothing objected.
      if (g.actor_role === 'maker') errors.push(`promotion-gates: gate ${g.id} names 'maker' as its actor; a gate is never passed by the seat whose work it gates`);
      for (const { from, to } of g.guards_transitions || []) {
        if (!states.has(from)) errors.push(`promotion-gates: gate ${g.id} guards a move from '${from}', which is not a declared lifecycle state`);
        if (!states.has(to)) errors.push(`promotion-gates: gate ${g.id} guards a move to '${to}', which is not a declared lifecycle state`);
        if (!c.transitions.transitions.some((m) => m.from === from && m.to === to)) {
          errors.push(`promotion-gates: gate ${g.id} guards '${from}' -> '${to}', which transitions.json does not declare`);
        }
      }
      // "Authority for one action implies none of the others." Only Gate F may
      // touch the owner-reserved surfaces, and only per individual action.
      for (const grant of g.grants || []) {
        if (ownerReserved.has(grant) && g.id !== 'F') {
          errors.push(`promotion-gates: gate ${g.id} grants '${grant}', which is owner-reserved and belongs to Gate F alone`);
        }
      }
      for (const r of g.required_roles || []) if (!roleSet.has(r)) errors.push(`promotion-gates: gate ${g.id} requires role '${r}', which roles.json does not declare`);
    }
    // Every protected promotion move should be gated. An ungated protected move
    // is one a seat could argue its way through with no named evidence.
    const gated = new Set(pg.gates.flatMap((g) => (g.guards_transitions || []).map((t) => `${t.from}->${t.to}`)));
    for (const m of c.transitions.transitions) {
      if (m.protected && !gated.has(`${m.from}->${m.to}`)) {
        errors.push(`promotion-gates: protected transition '${m.from}' -> '${m.to}' is not guarded by any declared gate`);
      }
    }
  }

  // --- teams -----------------------------------------------------------
  // The charter is the authority on who stands and who is pooled. Encoding it
  // as prose let a capsule contradict it silently; these make that a hard error.
  if (c.teams && c.roles && c.hierarchy) {
    const declaredRoles = new Set(c.roles.roles.map((r) => r.role));
    const hier = new Set(c.hierarchy.nodes.map((n) => n.actor_id));
    const poolIds = new Set();
    const standingIds = new Set();
    for (const r of c.teams.standing_roles) {
      if (standingIds.has(r.id)) errors.push(`teams: standing role '${r.id}' is declared twice`);
      standingIds.add(r.id);
      // A standing role that no role contract declares, or that has no
      // hierarchy node, cannot actually receive or escalate anything.
      if (!declaredRoles.has(r.id)) errors.push(`teams: standing role '${r.id}' is not a declared role`);
      if (!hier.has(r.id)) errors.push(`teams: standing role '${r.id}' has no hierarchy node`);
    }
    for (const p of c.teams.capability_pools) {
      if (poolIds.has(p.id)) errors.push(`teams: capability pool '${p.id}' is declared twice`);
      poolIds.add(p.id);
      // "Pools are not standing delivery teams." A pool that is also a declared
      // role would become one the moment a capsule named it as an owner.
      if (declaredRoles.has(p.id)) errors.push(`teams: capability pool '${p.id}' is also a declared role; a pool must not be able to hold a seat`);
    }
    // The contract is a projection of docs/governance/TEAM-CHARTERS.md. If an
    // entry is renamed here and not there, the two have silently diverged and
    // the prose stops being the thing this encodes.
    let charterText = null;
    try { charterText = readFileSync(resolve(ROOT, '../docs/governance/TEAM-CHARTERS.md'), 'utf8'); } catch { /* .agentops-only checkout */ }
    if (charterText !== null) {
      for (const e of [...c.teams.standing_roles, ...c.teams.capability_pools]) {
        if (!charterText.includes(e.charter_heading)) {
          errors.push(`teams: '${e.id}' claims charter heading '${e.charter_heading}', which has no heading in the charter prose`);
        }
      }
    }
    // Every legacy dropdown name must land somewhere real. An alias pointing at
    // nothing routes a ticket into silence, which is the failure the Help Desk
    // exists to prevent.
    const targets = new Set([...standingIds, ...poolIds]);
    const seenLegacy = new Set();
    for (const a of c.teams.legacy_aliases) {
      if (seenLegacy.has(a.legacy)) errors.push(`teams: legacy alias '${a.legacy}' is declared twice`);
      seenLegacy.add(a.legacy);
      if (!targets.has(a.routes_to)) errors.push(`teams: legacy alias '${a.legacy}' routes to '${a.routes_to}', which is neither a standing role nor a capability pool`);
    }
    if (!standingIds.has(c.teams.pods.formed_by)) errors.push(`teams: pods are formed by '${c.teams.pods.formed_by}', which is not a standing role; a delivery seat cannot convene its own pod`);
    const ce = c.teams.charter_exception;
    for (const role of ce.requires_concurrence) {
      if (!declaredRoles.has(role)) errors.push(`teams: charter_exception requires concurrence from '${role}', which is not a declared role`);
      if (!standingIds.has(role)) errors.push(`teams: charter_exception requires concurrence from '${role}', which is not a standing role; only standing roles may carry an exception to the owner`);
    }
    if (c.escalation && !c.escalation.classes.some((x) => x.id === ce.escalation_class)) {
      errors.push(`teams: charter_exception escalates as '${ce.escalation_class}', which escalation.json does not declare`);
    }
    // The exception must actually reach the Owner. A class that wakes anyone
    // else would let the two roles "escalate" to themselves.
    const ownerId = c['owner-intent'] && c['owner-intent'].owner.actor_id;
    const cls = c.escalation && c.escalation.classes.find((x) => x.id === ce.escalation_class);
    // Requiring only that the class wakes the owner let the class and its wake
    // move together: point technical-blocker at the owner and the exception
    // escalates through a class every seat can raise.
    if (cls && cls.attempts_before_escalate !== 0) {
      errors.push(`teams: charter_exception escalates as '${ce.escalation_class}', which allows ${cls.attempts_before_escalate} attempt(s) first; an exception to the charter must reach the owner immediately`);
    }
    if (cls && cls.continuing_work_allowed) {
      errors.push(`teams: charter_exception escalates as '${ce.escalation_class}', which lets work continue; an unresolved charter exception must stop it`);
    }
    if (cls && ownerId && cls.wake !== ownerId) {
      errors.push(`teams: charter_exception escalates as '${ce.escalation_class}', which wakes '${cls.wake}' rather than the owner`);
    }

    // Team leads. The owner made a lead able to waive QA independence for its
    // own team's seats, which is the most load-bearing grant in this contract:
    // every way it could be quietly widened is checked here rather than left to
    // a reader of the prose.
    if (c.teams.team_leads) {
      const tl = c.teams.team_leads;
      if (!declaredRoles.has(tl.role)) errors.push(`teams: team_leads.role '${tl.role}' is not a declared role`);
      // Pinned, not merely reconciled. authority_tier and the ladder could be
      // moved to P1 together and agree with each other, putting every team lead
      // in the Deputy tier with its integration and assignment authority while
      // the `team-lead` role grant stayed narrow. Two mutable fields certifying
      // each other is the recurring defect of this branch; this is the fifth.
      if (tl.authority_tier !== 2) errors.push(`teams: team_leads.authority_tier is P${tl.authority_tier}; leads are standing coordination and belong at P2, and moving the ladder with it does not make that true`);
      // Binding each node to tl.role proved only that they agreed. tl.role was
      // still free, so setting it and every node to 'app-dev-i' validated and
      // gave every lead that role's implement/commit capabilities.
      if (tl.role !== 'team-lead') errors.push(`teams: team_leads.role is '${tl.role}'; the roster must name the dedicated 'team-lead' role, or leads inherit whatever grant that role carries`);
      if (poolIds.has(tl.role)) errors.push(`teams: team_leads.role '${tl.role}' is also a capability pool, which must not be able to hold a seat`);
      // A lead is an actor, not a role. Every lead shares the 'team-lead' role,
      // so a role-only check could not tell which team a lead owns and one
      // team's lead satisfied the grant for another team's maker — defeating
      // approver_must_lead_the_certifying_seats_team, which was a boolean the
      // contract asserted and nothing could enforce. Identity is checked here.
      const ledTeams = new Map();
      const leadActors = new Map();
      for (const l of tl.leads) {
        if (!poolIds.has(l.team)) errors.push(`teams: team lead '${l.actor_id}' leads '${l.team}', which is not a declared capability pool`);
        if (ledTeams.has(l.team)) errors.push(`teams: team '${l.team}' is led by both '${ledTeams.get(l.team)}' and '${l.actor_id}'; one_lead_per_team allows one`);
        else ledTeams.set(l.team, l.actor_id);
        if (leadActors.has(l.actor_id)) errors.push(`teams: lead actor '${l.actor_id}' is declared twice`);
        else leadActors.set(l.actor_id, l.team);
        // A shared actor id across two teams would reintroduce exactly the
        // ambiguity the per-lead identity exists to remove.
        if (declaredRoles.has(l.actor_id)) errors.push(`teams: lead actor '${l.actor_id}' collides with the role of the same name; a lead is an actor, not a role`);
        if (c.teams.naming_convention && !l.seat_name.startsWith('P | ')) errors.push(`teams: lead '${l.actor_id}' has seat_name ${JSON.stringify(l.seat_name)}, which does not follow naming_convention.persistent_lead`);
        // `includes` matched the team id anywhere in the string, so
        // 'P | art-tech-art Lead III | qa-guild | Ashenspire' passed while
        // declaring one team and labelling another. The format is
        // `P | <role> III | <team> | Ashenspire`, so compare that segment.
        const seg = l.seat_name.split('|').map((x) => x.trim());
        if (seg.length !== 4) errors.push(`teams: lead '${l.actor_id}' seat_name ${JSON.stringify(l.seat_name)} is not the four-segment 'P | <role> III | <team> | Ashenspire' form`);
        else {
          // Derived from naming_convention.persistent_lead rather than hardcoded:
        // the template and the roster checks were two separate statements of
        // the same rule, so the template could drift to 'P | nonsense' while
        // the roster still validated against the old shape.
        const tpl = c.teams.naming_convention ? c.teams.naming_convention.persistent_lead.split('|').map((x) => x.trim()) : null;
        if (tpl && tpl.length === seg.length) {
          for (let i = 0; i < tpl.length; i++) {
            const ph = tpl[i].match(/^(.*?)<([a-z]+)>(.*)$/);
            if (!ph) {                                  // a fixed segment
              if (seg[i] !== tpl[i]) errors.push(`teams: lead '${l.actor_id}' seat_name segment ${i + 1} is '${seg[i]}', but the convention fixes it as '${tpl[i]}'`);
              continue;
            }
            const [, pre, name, post] = ph;
            if (pre && !seg[i].startsWith(pre)) errors.push(`teams: lead '${l.actor_id}' seat_name segment ${i + 1} does not start with '${pre}' as the convention requires`);
            if (post && !seg[i].endsWith(post)) errors.push(`teams: lead '${l.actor_id}' seat_name segment ${i + 1} '${seg[i]}' does not end with '${post}' as the convention requires`);
            const value = seg[i].slice(pre.length, seg[i].length - post.length).trim();
            if (!value) errors.push(`teams: lead '${l.actor_id}' seat_name segment ${i + 1} supplies no <${name}>`);
            else if (name === 'team' && value !== l.team) errors.push(`teams: lead '${l.actor_id}' leads '${l.team}' but its seat_name's team segment says '${value}'`);
            else if (name === 'role' && !/lead/i.test(value)) errors.push(`teams: lead '${l.actor_id}' seat_name role segment '${value}' does not name a lead`);
          }
        }
        }
      }
      // Every team gets a lead, or the ones left out have no approver and the
      // roster silently means something narrower than it says.
      for (const p of c.teams.capability_pools) {
        if (!ledTeams.has(p.id)) errors.push(`teams: capability pool '${p.id}' has no team lead; team_leads must name every team`);
      }
      // A tier declared here and a tier declared in the ladder must agree.
      if (c.hierarchy && c.hierarchy.authority_tiers) {
        for (const l of tl.leads) {
          const lv = c.hierarchy.authority_tiers.levels.find((x) => x.actors.includes(l.actor_id));
          if (!lv) errors.push(`teams: team lead '${l.actor_id}' is in no authority tier; its decision authority is undeclared`);
          else if (lv.p !== tl.authority_tier) errors.push(`teams: team_leads declares tier P${tl.authority_tier} but the ladder places '${l.actor_id}' at P${lv.p}`);
          // Checking only the tier left the node's ROLE free. A lead whose node
          // said 'maker' would resolve to maker through actorRole() and be
          // granted maker capabilities, while teams.json still called it a lead.
          const node = c.hierarchy.nodes.find((n) => n.actor_id === l.actor_id);
          if (!node) errors.push(`teams: team lead '${l.actor_id}' has no hierarchy node, so it cannot hold work`);
          else if (node.role !== tl.role) errors.push(`teams: team lead '${l.actor_id}' has hierarchy role '${node.role}', not '${tl.role}'; its runtime authority would be resolved from the wrong role`);
        }
        if (c.hierarchy.authority_tiers.levels.some((x) => x.actors.includes(tl.role))) {
          errors.push(`teams: the ladder places the shared role '${tl.role}' rather than each lead actor; that collapses every team into one slot and loses the identity the roster carries`);
        }
      }
    }

    // The naming convention shares its leading letter with the tier namespace,
    // and a convention that stops saying so is how the two get conflated.
    if (c.teams.naming_convention) {
      const nc = c.teams.naming_convention;
      if (!/^P\s*\|/.test(nc.persistent_lead)) errors.push(`teams: naming_convention.persistent_lead '${nc.persistent_lead}' does not begin with the P seat-kind marker`);
      // Prefix-only checks accepted 'P | nonsense', leaving the convention
      // describing a shape nothing in the roster actually has.
      for (const [field, marker, needs] of [['persistent_lead', 'P', ['<role>', '<team>']], ['agent_seat', 'A', ['<role>', '<team>']]]) {
        const parts = nc[field].split('|').map((x) => x.trim());
        if (parts.length !== 4) errors.push(`teams: naming_convention.${field} '${nc[field]}' is not four '|'-separated segments`);
        else {
          if (parts[0] !== marker) errors.push(`teams: naming_convention.${field} starts with '${parts[0]}', not the '${marker}' seat-kind marker`);
          if (parts[3] !== 'Ashenspire') errors.push(`teams: naming_convention.${field} names project '${parts[3]}', not 'Ashenspire'`);
        }
        for (const ph of needs) if (!nc[field].includes(ph)) errors.push(`teams: naming_convention.${field} declares no ${ph} placeholder, so it constrains nothing`);
      }
      if (!/^A\s*\|/.test(nc.agent_seat)) errors.push(`teams: naming_convention.agent_seat '${nc.agent_seat}' does not begin with the A seat-kind marker`);
      if (/^P[0-9]/.test(nc.persistent_lead)) errors.push('teams: naming_convention.persistent_lead uses a numbered P, which is the authority-tier namespace, not a seat kind');
      if (!/P<n>|P[0-9]/.test(nc.not_the_tier_namespace)) errors.push('teams: naming_convention does not distinguish the bare seat-kind P from the numbered authority tier; the two namespaces would be read as one');
    }
  }

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
    const ledger = c['git-ownership'].ledger_serialization;
    for (const p of c['git-ownership'].paths) {
      // A per_seat path is owned by whichever lease holds the ticket, so its
      // owner_role is a marker rather than a declared role — the same shape
      // refs already use for `recovery/*`.
      if (!p.per_seat && !knownRoles.has(p.owner_role)) errors.push(`git-ownership: path '${p.glob}' names unknown role '${p.owner_role}'`);
      if (p.glob.split('/').includes('..')) errors.push(`git-ownership: path glob '${p.glob}' contains a '..' traversal segment`);
      // per_seat is not a way out of ownership. It is only sound where a single
      // tool is the sole writer and the lane is serialized per ticket: that is
      // what keeps two seats holding the same glob from being a collision. A
      // product path marked per_seat would just be unowned.
      if (p.per_seat) {
        if (p.owner_role !== 'per-seat') errors.push(`git-ownership: path '${p.glob}' is per_seat but names owner_role '${p.owner_role}'; a per-seat path declares the marker, not a role that does not own it`);
        if (!ledger || p.serialized_lane !== ledger.lane) errors.push(`git-ownership: path '${p.glob}' is per_seat but its lane '${p.serialized_lane}' declares no sole writer; per-seat ownership is only safe where one tool writes and the lane serializes per ticket`);
      } else if (p.owner_role === 'per-seat') {
        errors.push(`git-ownership: path '${p.glob}' names owner_role 'per-seat' without the per_seat marker, so nothing checks the conditions that make per-seat ownership safe`);
      }
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
    // Two globs overlap when one's matched set could contain the other's. The
    // earlier form compared directory prefixes alone, and a root-level file has
    // no directory — its prefix is '', which every string starts with, so any
    // root-level path was reported as overlapping the whole tree. That made the
    // one-writer rule unable to express a root-level owner at all, which is
    // exactly what the generated build output needs.
    const overlaps = (ga, gb) => {
      const dirA = literalPrefix(ga), dirB = literalPrefix(gb);
      const rootA = dirA === '', rootB = dirB === '';
      // Root-level globs never reach into a subdirectory, and a subdirectory
      // glob never reaches back up to the root.
      if (rootA !== rootB) return false;
      if (rootA && rootB) return globCovers(ga, gb) || globCovers(gb, ga);
      return dirA.startsWith(dirB) || dirB.startsWith(dirA);
    };
    for (let a = 0; a < paths.length; a++) {
      for (let b = a + 1; b < paths.length; b++) {
        const nests = overlaps(paths[a].glob, paths[b].glob);
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
      // The deputy is a recorded decision, not a field that may move as long as
      // a matching hierarchy node moves with it. This sat inside the branch
      // above on its first attempt, so it only fired for a deputy that was
      // already invalid — a pin that could never catch the case it was for.
      if (oi.deputy.actor_id !== 'it-manager-iii') {
        errors.push(`owner-intent: deputy is '${oi.deputy.actor_id}'; the deputy is the IT Manager III by decision, and a matching hierarchy node does not make another actor the deputy`);
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

  // B3 (#430): standing directives. The cap the routing package demands is
  // non-amplification — a directive changes what a seat MUST do, never what it
  // MAY do. Everything else here exists because a directive that claims
  // enforcement it does not have is worse than one that claims none.
  // #430 (seat display names): both schemas were additionalProperties:false with
  // no such field, so any display_name failed validation and the owner's naming
  // convention could not be applied at all. The field exists now, and a
  // populated one is checked against the template teams.json declares rather
  // than being free text — an unchecked display field drifts into a second,
  // contradictory naming scheme, which is how there came to be two shapes here
  // already.
  if (c.teams && c.teams.naming_convention) {
    const nc = c.teams.naming_convention;
    const shape = (tpl) => {
      const segs = String(tpl).split('|').map((x) => x.trim());
      return { kind: segs[0], segments: segs.length, suffix: (segs[segs.length - 1].split('-').pop() || '').trim() };
    };
    const persistent = shape(nc.display_name_persistent);
    const agent = shape(nc.display_name_agent);
    // Accepting either template for every seat was the whole check: a standing
    // seat could be presented as `A | ...` and nothing objected, so the ledger's
    // one persistent coordination seat could read as an agent a lead spins out
    // and discards. The permitted kind is the seat's own, and a seat declared in
    // roles.json or hierarchy.json is standing by construction — agent seats are
    // spun out per ticket under agent_seat and are never declared there. Stated
    // in teams.naming_convention.display_name_kind_is_not_a_choice.
    const checkDisplay = (where, id, value, requiredKind) => {
      const segs = String(value).split('|').map((x) => x.trim());
      const kind = segs[0];
      if (kind !== persistent.kind && kind !== agent.kind) {
        errors.push(`${where} '${id}' display_name starts with '${kind}', which is neither seat kind the convention declares ('${persistent.kind}' or '${agent.kind}')`);
        return;
      }
      if (kind !== requiredKind) {
        errors.push(`${where} '${id}' is a declared standing seat but its display_name opens '${kind}', the kind a lead spins out; a declared seat carries '${requiredKind}'`);
        return;
      }
      const tpl = kind === agent.kind ? agent : persistent;
      const tplText = kind === agent.kind ? nc.display_name_agent : nc.display_name_persistent;
      if (segs.length !== tpl.segments) {
        errors.push(`${where} '${id}' display_name has ${segs.length} segments; the declared template '${tplText}' has ${tpl.segments}`);
        return;
      }
      // Every segment the template declares must carry content. Checking only
      // the last one let `P |  | Coordination Specialist - AshenSpire` pass with
      // the role and level missing — right shape, no name.
      const tplSegs = String(tplText).split('|').map((x) => x.trim());
      for (let k = 1; k < segs.length; k++) {
        if (segs[k] === '') {
          errors.push(`${where} '${id}' display_name leaves segment ${k + 1} empty, where the template declares '${tplSegs[k]}'; a name with the right shape and nothing in it is not a name`);
        }
      }
      const last = segs[segs.length - 1];
      if (!last.endsWith(`- ${tpl.suffix}`)) {
        errors.push(`${where} '${id}' display_name ends '${last}'; the declared template closes with '- ${tpl.suffix}'`);
      } else if (last.slice(0, -(`- ${tpl.suffix}`).length).trim() === '') {
        errors.push(`${where} '${id}' display_name carries no title before the project; a display name without a title says less than the role id it decorates`);
      }
    };
    for (const r of (c.roles ? c.roles.roles : [])) if (r.display_name) checkDisplay('roles', r.role, r.display_name, persistent.kind);
    for (const n of (c.hierarchy ? c.hierarchy.nodes : [])) if (n.display_name) checkDisplay('hierarchy node', n.actor_id, n.display_name, persistent.kind);
    // A role and its actor must not disagree about the same seat's name.
    if (c.roles && c.hierarchy) {
      const byRole = new Map(c.roles.roles.filter((r) => r.display_name).map((r) => [r.role, r.display_name]));
      for (const n of c.hierarchy.nodes) {
        if (!n.display_name) continue;
        const rd = byRole.get(n.role);
        if (rd && rd !== n.display_name) {
          errors.push(`hierarchy node '${n.actor_id}' display_name differs from role '${n.role}' display_name; one seat, two names, and nothing says which is shown`);
        }
      }
    }
  }

  // The same shape as the directive status the review flagged, found by sweeping
  // the two contracts this PR added for unconstrained strings that other code
  // then compares against. Both of these are read by checks, so a typo does not
  // fail loudly — it makes the check quietly match nothing.
  if (c.retention) {
    const ret = c.retention;
    if (c.roles && !c.roles.roles.some((r) => r.role === ret.authority.actor_role)) {
      errors.push(`retention: authority.actor_role '${ret.authority.actor_role}' is not a declared role; the consolidation authority check would compare against a role nobody holds and refuse every consolidation`);
    }
    // The event kind consolidations use must be one events can actually carry,
    // or runtimeChecks matches no event and every range, authority and
    // protected-ticket check silently never runs.
    let kinds = [];
    try { kinds = JSON.parse(readFileSync(resolve(ROOT, RUNTIME_SCHEMAS.event), 'utf8')).properties.kind.enum || []; } catch { kinds = []; }
    if (kinds.length && !kinds.includes(ret.consolidation.kind)) {
      errors.push(`retention: consolidation.kind '${ret.consolidation.kind}' is not a declared event kind (${kinds.join(', ')}); no event could ever match it, so every consolidation check would pass by never running`);
    }
  }

  if (c.directives) {
    const ids = new Set();
    const known = new Set(Object.keys(c));
    const actorIds = c.hierarchy ? new Set(c.hierarchy.nodes.map((n) => n.actor_id)) : new Set();
    const ownerActor = c['owner-intent'] && c['owner-intent'].owner.actor_id;
    const ownerReserved = new Set((c['owner-intent'] && c['owner-intent'].owner.reserved_authority) || []);
    for (const d of c.directives.directives) {
      if (ids.has(d.id)) errors.push(`directives: '${d.id}' is declared twice`);
      ids.add(d.id);
      if (actorIds.size && !actorIds.has(d.issued_by)) {
        errors.push(`directives: '${d.id}' is issued by '${d.issued_by}', which is not a hierarchy actor; an instruction from nobody in particular binds nobody`);
      }
      if (utcInstant(d.issued_at) === null) errors.push(`directives: '${d.id}' issued_at '${d.issued_at}' is not a real instant`);
      // Non-amplification. An action a directive purports to grant must already
      // be held by its issuer, and owner-reserved authority is never reachable
      // by instruction — that is how a directive would become a back door.
      for (const a of d.grants_actions || []) {
        if (ownerReserved.has(a) && d.issued_by !== ownerActor) {
          errors.push(`directives: '${d.id}' purports to grant owner-reserved authority '${a}'; a directive constrains a seat, it does not empower one`);
        }
        errors.push(`directives: '${d.id}' grants action '${a}'; a directive changes what a seat must do, never what it may do — grants belong in authority.json or a delegation envelope`);
      }
      // A claimed codification is checked against the corpus, not trusted.
      // Half a codification claim is still a claim. `codified_in` alone skipped
      // the field check entirely, so a directive could name a contract without
      // naming what in it enforces the directive — which is the invariant this
      // contract was written to hold.
      if (!!d.codified_in !== !!d.codified_as) {
        errors.push(`directives: '${d.id}' names ${d.codified_in ? 'codified_in without codified_as' : 'codified_as without codified_in'}; a codification claim names the contract AND the exact field, or it names neither`);
      }
      if (d.codified_in) {
        if (!known.has(d.codified_in)) {
          errors.push(`directives: '${d.id}' claims codification in '${d.codified_in}', which is not a declared contract`);
        } else if (d.codified_as && contractFieldAt(c[d.codified_in], d.codified_as) === undefined) {
          errors.push(`directives: '${d.id}' claims codification at '${d.codified_in}.${d.codified_as}', which does not exist; a directive claiming enforcement it does not have is worse than one claiming none`);
        }
      }
      if (d.status === 'superseded' && !d.superseded_by) {
        errors.push(`directives: '${d.id}' is superseded but names no successor; the record of what replaced it is the point of keeping it`);
      }
      if (d.superseded_by && !c.directives.directives.some((x) => x.id === d.superseded_by)) {
        errors.push(`directives: '${d.id}' names successor '${d.superseded_by}', which is not a declared directive`);
      }
      // Existence is not succession. A directive naming itself, or two naming
      // each other, leaves every one of them claiming to be replaced by
      // something that was also replaced — a supersession chain with no live
      // end, which is not a record of what is in force.
      if (d.superseded_by) {
        const seen = new Set([d.id]);
        let cur = d.superseded_by;
        while (cur) {
          if (seen.has(cur)) {
            errors.push(`directives: supersession from '${d.id}' closes a loop at '${cur}'; a chain of replacements with no live end says nothing about what is in force`);
            break;
          }
          seen.add(cur);
          const nxt = c.directives.directives.find((x) => x.id === cur);
          cur = nxt ? nxt.superseded_by : null;
        }
      }
      if (d.status !== 'superseded' && d.superseded_by) {
        errors.push(`directives: '${d.id}' names a successor but is still '${d.status}'; two live directives on one instruction is a contradiction nothing resolves`);
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
      const eff = utcInstant(e.effective), exp = utcInstant(e.expiry);
      if (eff === null) errors.push(`delegation: envelope '${e.id}' effective '${e.effective}' is not a real instant; it validates against the schema pattern but denotes a different moment than it spells`);
      if (exp === null) errors.push(`delegation: envelope '${e.id}' expiry '${e.expiry}' is not a real instant; it validates against the schema pattern but denotes a different moment than it spells`);
      if (eff !== null && exp !== null && exp <= eff) errors.push(`delegation: envelope '${e.id}' expiry is at or before effective (already expired)`);
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
      if ((a.id === 'grant-dev-delivery-authority' || a.id === 'authorize-release' || a.id === 'record-owner-override') && !(a.authenticator_roles.length === 1 && a.authenticator_roles[0] === 'owner')) {
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
  // The grant's own window. It rendered nowhere, so the document said what the
  // deputy may do without saying when the grant starts, when it ends, or what
  // replaces it.
  L.push(`  - Grant window: effective \`${dep.effective}\`, expiry \`${dep.expiry}\`. ${dep.supersession}`);
  const auto = c['owner-intent'].default_autonomy;
  L.push(`- **Default autonomy:** reversible local work is \`${auto.reversible_local_work}\`. ${auto.description}`);
  const ovr = c['owner-intent'].override_rules;
  L.push('- **Override rules:**');
  L.push(`  - Recording: ${ovr.recording}`);
  L.push(`  - Invalidation: ${ovr.invalidation}`);
  L.push('  - An override may never:');
  ovr.forbidden.forEach((x) => L.push(`    - ${x}`));
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
  L.push(er.note);
  L.push('');

  L.push('## Roles');
  L.push('');
  for (const r of c.roles.roles) {
    L.push(`### \`${r.role}\``);
    L.push('');
    L.push(`- **Mission:** ${r.mission}`);
    if (r.display_name) L.push(`- **Seat:** ${mdCell(r.display_name)}`);
    if (r.archetype) L.push(`- **Derives from:** \`${r.archetype}\` — a seniority level, carrying exactly that archetype's authority and no more.`);
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
  for (const p of c['git-ownership'].paths) L.push(`| \`${mdCell(p.glob)}\` | ${p.per_seat ? '`per-seat` — the ticket\u2019s lease' : p.owner_role} | ${p.serialized_lane} |`);
  if (c['git-ownership'].branch_hygiene) {
    const bh = c['git-ownership'].branch_hygiene;
    L.push('');
    L.push('### Branch hygiene');
    L.push('');
    L.push(bh.principle);
    L.push('');
    L.push(`Default: \`${bh.default_update_method}\`. Rewriting needs \`${bh.permission_role}\` when ${bh.rewrite_requires_permission_when}; absent that, ${bh.alternative_when_permission_is_absent}. Records: ${bh.records.join(', ')}. Never: ${bh.never.join('; ')}.`);
  }
  L.push('');
    L.push(`Generated lane \`${c['git-ownership'].generated_serialization.lane}\`: ${c['git-ownership'].generated_serialization.rule}`);
    const led = c['git-ownership'].ledger_serialization;
    L.push('');
    L.push(`Ledger lane \`${led.lane}\`, written solely by \`${led.writer}\`: ${led.rule}`);
    L.push('');
    L.push(led.actor_rule);
    L.push('');
  L.push(`Collision rule: ${c['git-ownership'].collision_rule}`);
  L.push('');

  if (c['promotion-gates']) {
    const pg = c['promotion-gates'];
    L.push('');
    L.push('## Promotion gates');
    L.push('');
    L.push(pg.principle);
    L.push('');
    L.push('| Gate | Name | Who acts | Guards | Required evidence | Grants |');
    L.push('|---|---|---|---|---|---|');
    for (const g of pg.gates) {
      const guards = (g.guards_transitions || []).map((t) => `\`${t.from}\` → \`${t.to}\``).join('<br>') || '—';
      L.push(`| **${g.id}** | ${g.name} | \`${g.actor_role}\` | ${guards} | ${g.required_evidence.join(', ') || '—'} | ${g.grants.length ? g.grants.join(', ') : 'nothing'} |`);
    }
    L.push('');
    L.push(`${pg.immutable_candidate}`);
    for (const g of pg.gates) {
      const detail = gateDetailLines(g);
      if (!detail.length) continue;
      L.push('');
      L.push(`#### Gate ${g.id} \u2014 ${g.name}`);
      L.push('');
      for (const line of detail) L.push(line);
    }
    L.push('');
  }
  if (c.teams) {
    L.push('');
    L.push('## Teams');
    L.push('');
    L.push(`${c.teams.principle}`);
    L.push('');
    L.push('### Standing coordination roles');
    L.push('');
    L.push('| Role | Standing responsibility | Boundary |');
    L.push('|---|---|---|');
    for (const r of c.teams.standing_roles) L.push(`| \`${r.id}\` | ${r.responsibility} | ${r.boundary} |`);
    L.push('');
    L.push('### Capability pools');
    L.push('');
    L.push(`Not standing teams: they own no backlog, no decision stream and no source path, and none may hold a seat or a writer lease. ${c.teams.pool_rules.note}`);
    L.push('');
    L.push('| Pool | Delivery capability | Stewardship between tickets |');
    L.push('|---|---|---|');
    for (const p of c.teams.capability_pools) L.push(`| \`${p.id}\` | ${p.delivery_capability} | ${p.stewardship} |`);
    L.push('');
    L.push('### Charter exception');
    L.push('');
    L.push(`${c.teams.charter_exception.principle} Concurrence: ${c.teams.charter_exception.requires_concurrence.map((r) => '`' + r + '`').join(' + ')}; escalates as \`${c.teams.charter_exception.escalation_class}\`.`);
    if (c.teams.team_leads) {
      const tl = c.teams.team_leads;
      L.push('');
      L.push('### Team leads');
      L.push('');
      L.push(tl.principle);
      L.push('');
      L.push(`Role \`${tl.role}\` at **P${tl.authority_tier}**, one per team. Spins out ${tl.spins_out}. Holds no waiver over independent QA (decision 0010).`);
      L.push('');
      L.push(tl.identity_rule);
      L.push('');
      L.push('| Team | Lead actor | Seat |');
      L.push('|---|---|---|');
      for (const l of tl.leads) L.push(`| \`${l.team}\` | \`${l.actor_id}\` | ${mdCell(l.seat_name)} |`);
    }
    if (c.teams.naming_convention) {
      const nc = c.teams.naming_convention;
      L.push('');
      L.push('### Seat naming');
      L.push('');
      L.push(nc.principle);
      L.push('');
      L.push(`- Persistent team lead: \`${nc.persistent_lead}\``);
      L.push(`- Agent seat it spins out: \`${nc.agent_seat}\``);
      L.push(`- Persistent display name: \`${nc.display_name_persistent}\``);
      L.push(`- Agent display name: \`${nc.display_name_agent}\``);
      L.push('');
      L.push(nc.display_name_is_not_the_seat_name);
      L.push('');
      L.push(nc.display_name_kind_is_not_a_choice);
      L.push('');
      L.push(`${nc.leading_letter_is_seat_kind} ${nc.not_the_tier_namespace}`);
    }
    // What a seat may do with spare capacity is policy, not a footnote: it is
    // the line between an idle seat auditing and an idle seat patching.
    L.push('');
    L.push('### Work in progress');
    L.push('');
    L.push(`Idle capacity: ${c.teams.wip_limits.idle_capacity}`);
    L.push('');
    L.push('### Legacy team names');
    L.push('');
    L.push('| Legacy name | Routes to | Why |');
    L.push('|---|---|---|');
    for (const a of c.teams.legacy_aliases) L.push(`| \`${mdCell(a.legacy)}\` | \`${mdCell(a.routes_to)}\` | ${mdCell(a.note)} |`);
    L.push('');
  }
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
    L.push('| Envelope | Parent | Delegator → Delegatee | Actions | Scope paths | Max subdepth | Effective → Expiry |');
    L.push('|---|---|---|---|---|---|---|');
    for (const e of c.delegation.envelopes) {
      L.push(`| ${e.id} | ${e.parent_id || '—'} | ${e.delegator_role} → ${e.delegatee_role} | ${e.delegated_actions.join(', ')} | ${e.scope_paths.map((g) => '`' + mdCell(g) + '`').join(', ') || '— (no path scope)'} | ${e.max_subdelegation_depth} | ${e.effective} → ${e.expiry} |`);
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
    // The hazard each class exists to answer. It named the reason a route
    // exists and rendered nowhere, so the table said where a thing goes without
    // saying what it is for.
    for (const cl of c.escalation.classes) L.push(`- \`${cl.id}\` — ${cl.hazard}`);
    L.push('');
    if (c.escalation.ticket_flow) {
      const tf = c.escalation.ticket_flow;
      L.push('### Where a question goes');
      L.push('');
      L.push(tf.principle);
      L.push('');
      L.push('| # | Actor | Does |');
      L.push('|---|---|---|');
      for (const st of tf.steps) L.push(`| ${st.n} | \`${st.actor}\` | ${mdCell(st.does)} |`);
      L.push('');
      L.push(`Handoffs keep ${tf.handoff_events.map((e) => '`' + e + '`').join(', ')} distinct. ${tf.handoff_rule}`);
      L.push('');
      L.push(`**${tf.owner_is_last_resort}**`);
      L.push('');
    }
  }

  if (c.transitions) {
    L.push('## Lifecycle transitions and permitted actors');
    L.push('');
    L.push(c.transitions.principle);
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
    // The legacy map. Old status values still appear in recovered evidence, and
    // how each is read now decided whether that evidence is misread. It
    // rendered nowhere.
    if (c.transitions.legacy_values) {
      L.push(c.transitions.legacy_rule);
      L.push('');
      L.push('| Legacy value | Canonical treatment |');
      L.push('|---|---|');
      for (const lv of c.transitions.legacy_values) L.push(`| \`${mdCell(lv.legacy)}\` | ${mdCell(lv.canonical_treatment)} |`);
      L.push('');
    }
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
    // The one carve-out from concise output, and the shape it must take. Both
    // arrived as owner directives and are codified here; directives.json names
    // this field as their enforcement, and a claim of codification is checked
    // against the corpus rather than believed.
    L.push(`**Owner decision surfaces are the exception.** ${ia.reporting.owner_decision_exception}`);
    L.push('');
    L.push(`The packet shape is ${ia.reporting.decision_packet.source}:`);
    L.push('');
    for (const part of ia.reporting.decision_packet.parts) L.push(`- ${part}`);
    L.push('');
    L.push(ia.reporting.decision_packet.open_question_is_a_failure);
    L.push('');
    if (ia.canonical_documents) {
      L.push('');
      L.push('### Canonical documents');
      L.push('');
      L.push('| Topic | Canonical path | Superseded | Decision |');
      L.push('|---|---|---|---|');
      for (const d of c['information-access'].canonical_documents) {
        L.push(`| ${d.topic} | \`${d.path}\` | ${d.superseded_paths.map((x) => '`' + x + '`').join(', ') || '—'} | \`${d.decision}\` |`);
      }
    }
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
    L.push('| Gate | Risk | Verifier | Independent of maker | Required checks | Waiver authority | Required evidence |');
    L.push('|---|---|---|---|---|---|---|');
    for (const g of c.qa.gates) {
      L.push(`| ${g.id} | ${g.risk_class} | ${g.verifier_role} | ${g.independent_of_maker ? 'yes' : 'no'} | ${g.required_checks.join(', ')} | ${g.waiver_authority_role} | ${g.required_evidence.join(', ')} |`);
    }
    L.push('');
    L.push('');
  }

  if (c.hierarchy && c.hierarchy.authority_tiers) {
    const at = c.hierarchy.authority_tiers;
    L.push('## Authority tiers');
    L.push('');
    L.push(at.principle);
    L.push('');
    if (at.disambiguation) {
      L.push(`**P-codes mean two things.** ${at.disambiguation.rule} Authority subjects: ${at.disambiguation.authority_subjects.map((x) => '`' + x + '`').join(', ')}. Priority subjects: ${at.disambiguation.priority_subjects.map((x) => '`' + x + '`').join(', ')}.`);
      L.push('');
      L.push(at.namespace_note);
      L.push('');
      L.push(at.disambiguation.known_ambiguous_artifact);
      L.push('');
    }
    L.push('| Tier | Who | Holds | Cannot |');
    L.push('|---|---|---|---|');
    for (const lv of at.levels) {
      L.push(`| **P${lv.p}** ${lv.label} | ${lv.actors.map((a) => '`' + a + '`').join(', ')} | ${lv.holds.join('; ')} | ${lv.cannot.join('; ')} |`);
    }
    L.push('');
    L.push(Object.values(at.rules).join(' '));
    L.push('');
  }

  if (c.delivery) {
    const d = c.delivery;
    L.push('## Delivery and the Pages source');
    L.push('');
    L.push(d.principle);
    L.push('');
    L.push(`Delivery to \`dev\` is held by \`${d.dev_delivery.actor_role}\`: a discretion, never a duty, and never a direct push. Every item below must be \`PASS\` at one exact head; \`FAIL\` and \`UNKNOWN\` both require \`WAIT\`.`);
    L.push('');
    for (const cond of d.dev_delivery.all_must_pass_at_one_exact_head) L.push(`- ${cond}`);
    L.push('');
    L.push(`Desired Pages source: \`${d.pages.desired_source}\`. A switch needs the \`${d.pages.switch_requires.authorizing_role}\`, a change window, and a candidate already on \`${d.pages.switch_requires.candidate_must_have_reached}\`. ${d.pages.on_failure}`);
    L.push('');
    L.push(`The promotion packet carries ${d.promotion_packet.required_fields.length} required fields; missing, contradictory, stale or unverified is \`UNKNOWN\`, and \`UNKNOWN\` blocks.`);
    L.push('');
    for (const f of d.promotion_packet.required_fields) L.push(`- ${f}`);
    L.push('');
    // What promotion readiness does and does not mean, and which actions stay
    // the Owner's whatever a packet says. All three rendered nowhere.
    L.push(`Promotion readiness means: ${d.promotion_readiness.means} It does not mean: ${d.promotion_readiness.does_not_mean} These stay owner-exclusive whatever the packet says: ${d.promotion_readiness.owner_exclusive_actions.join(', ')}.`);
    L.push('');
    L.push(`Delivery process: ${d.dev_delivery.process} ${d.dev_delivery.waiting_does_not_authorize}`);
    L.push('');
    L.push(`A Pages switch is complete only when ${d.pages.complete_only_when.join(' and ')}. The switch packet records:`);
    L.push('');
    for (const r of d.pages.switch_packet_records) L.push(`- ${r}`);
    L.push('');
  }

  if (c['model-effort']) {
    const me = c['model-effort'];
    L.push('## Model and effort selection');
    L.push('');
    L.push(me.principle);
    L.push('');
    L.push(`Every assignment and reassignment records: \`${me.assignment_record.format}\``);
    L.push('');
    L.push('| Risk and station | Default model | Efforts | Typical work |');
    L.push('|---|---|---|---|');
    for (const t of me.tiers) {
      L.push(`| ${t.risk_and_station} | \`${t.default_model}\` | ${t.allowed_efforts.join(', ')}${t.requires_exceptional_reason ? ' (needs a recorded exceptional reason)' : ''} | ${t.typical_work} |`);
    }
    L.push('');
    L.push(`Selection stability: ${me.stability} Substitution: ${me.substitution}`);
    L.push('');
    L.push(`Every assignment record carries: ${me.assignment_record.required_fields.join(', ')}.`);
    L.push('');
  }

  if (c['owner-command']) {
    L.push('## Owner commands');
    L.push('');
    L.push(c['owner-command'].principle);
    L.push('');
    L.push('| Action | Authenticator roles | CAS | Protected | Required fields | Affects |');
    L.push('|---|---|---|---|---|---|');
    for (const a of c['owner-command'].actions) {
      L.push(`| ${a.id} | ${a.authenticator_roles.join(', ')} | ${a.requires_cas ? 'yes' : 'no'} | ${a.protected ? 'yes' : 'no'} | ${a.required_fields.map((f) => '\`' + f + '\`').join(', ')} | ${mdCell(a.affects)} |`);
    }
    L.push('');
  }

  if (c.retention) {
    const rt2 = c.retention;
    L.push('## Retention and consolidation');
    L.push('');
    L.push(rt2.principle);
    L.push('');
    L.push(`Authority: \`${rt2.authority.actor_role}\`, from ${rt2.authority.source}. This is ${rt2.authority.is_a_new_grant ? 'a new grant' : 'not a new grant — the authority already exists and this is its machine-readable form'}. Preconditions:`);
    L.push('');
    for (const pc of rt2.authority.preconditions) L.push(`- ${pc}`);
    L.push('');
    L.push(rt2.consolidation.rule);
    L.push('');
    L.push(`A \`${rt2.consolidation.kind}\` names ${rt2.consolidation.summary_must_name.join(', ')}, and covers at least ${rt2.consolidation.min_range} events.`);
    L.push('');
    L.push(`**Never:** ${rt2.never.join('; ')}.`);
    L.push('');
    L.push(rt2.corrections_are_never_consolidated.rule);
    L.push('');
  }

  if (c.directives) {
    const dv = c.directives;
    L.push('## Standing directives');
    L.push('');
    L.push(dv.principle);
    L.push('');
    L.push(dv.non_amplification);
    L.push('');
    L.push('| Directive | Issued by | Issued | Status | Codified in | Instruction |');
    L.push('|---|---|---|---|---|---|');
    for (const d of dv.directives) {
      const cod = d.codified_in ? `\`${d.codified_in}.${d.codified_as}\`` : '— (nothing enforces it)';
      L.push(`| ${d.id} | \`${d.issued_by}\` | ${d.issued_at} | ${d.status}${d.superseded_by ? ` → \`${d.superseded_by}\`` : ''} | ${cod} | ${mdCell(d.text)} |`);
    }
    L.push('');
  }

  if (c.migration) {
    L.push('## Legacy migration');
    L.push('');
    L.push(c.migration.principle);
    L.push('');
  }

  if (c.evidence) {
    L.push('## Evidence responsibility');
    L.push('');
    L.push(c.evidence.principle);
    L.push('');
    L.push('| Evidence | Producer | Exact object | Verifier | Invalidation keys | Freshness |');
    L.push('|---|---|---|---|---|---|');
    for (const e of c.evidence.evidence) {
      L.push(`| ${e.id} | ${e.producer_role} | ${e.exact_object} | ${e.verifier_role} | ${e.invalidation_keys.join(', ')} | ${mdCell(e.freshness_rule)} |`);
    }
    L.push('');
  }


  // Every contract's `rules` block is the set of invariants opsctl enforces, in
  // the words the contract uses. Most of them rendered nowhere: 41 values across
  // twelve contracts were machine-checked and humanly invisible, so the view a
  // person reads to learn what the system guarantees did not state the
  // guarantees. They are projected here, grouped by contract, and each value is
  // a probe — dropping one fails the coverage gate.
  const ruled = Object.keys(c).filter((k) => c[k] && typeof c[k] === 'object' && c[k].rules && !Array.isArray(c[k].rules)).sort();
  if (ruled.length) {
    L.push('## Enforced invariants');
    L.push('');
    for (const k of ruled) {
      L.push(`**\`${k}\`**`);
      L.push('');
      for (const line of ruleLines(c[k])) L.push(line);
      L.push('');
    }
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
  if (!refNameValid(ref)) return [`${label} ref '${ref}' is not a valid git branch name; git could not create it`];
  // A seat works on an isolated continuation branch and nothing else.
  // Rejecting only `protected` left `dev` reachable: it is pr-only, but it is
  // owned by it-manager-iii, so an ITM3 seat could name it and pass — local
  // readiness would then point work straight at the integration ref.
  if (d.mutation !== 'isolated-continuation') {
    return [`${label} ref '${ref}' is '${d.mutation}', not an isolated-continuation branch; a seat may only work on an isolated ref`];
  }
  if (d.per_seat) return [];
  // Resolve: `actor` arrives as an actor id, `owner_role` is a role.
  if (d.owner_role !== actorRole(contracts, actor)) return [`${label} ref '${ref}' is owned by '${d.owner_role}', not '${actor}'`];
  return [];
}

// Every role that actually holds work must resolve to a hierarchy node, or a
// blocked seat has no escalation parent and its only outcome is silence.
export function hierarchyRoles(contracts) {
  const h = contracts.hierarchy || {};
  return new Set((h.nodes || []).map((n) => n.role));
}

// Membership in the hierarchy is by ACTOR, not by role. hierarchyRoles was
// being queried with an actor id, which happened to work only while the two
// namespaces coincided.
export function hierarchyActors(contracts) {
  const h = contracts.hierarchy || {};
  return new Set((h.nodes || []).map((n) => n.actor_id));
}

// D5: a lease may only grant path globs that git-ownership actually declares,
// and only to the role that owns them. Without this, "one writer per
// overlapping path" is unenforced for every path outside .agentops/ — a lease
// could grant any role any glob and verify would stay green. A lease may
// declare `undeclared_paths_ok: true` for a deliberate exception; that is an
// explicit, reviewable choice rather than a silent gap.
// Does a declared git-ownership path cover this glob? A declared root-level
// path (buildordinal.json, *.html) has no directory prefix, and every string
// starts with '' — so the prefix form let the first root-level declaration
// claim ownership of every lease glob in the repository, silently disabling the
// grant check entirely. Shared with the overlap detector so the two cannot
// drift apart.
export function globCovers(declGlob, glob) {
  const dirD = globPrefix(declGlob), dirG = globPrefix(glob);
  const rootD = dirD === '', rootG = dirG === '';
  if (rootD !== rootG) return false;              // root never covers a subtree, nor the reverse
  if (rootD && rootG) {
    const rx = new RegExp('^' + declGlob.split('*').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');
    return rx.test(glob) || declGlob === glob;
  }
  return dirG.startsWith(dirD);
}

// Read a dotted field path out of a contract, for checking that a claimed
// codification really exists rather than taking the claim's word for it.
export function contractFieldAt(contract, path) {
  let node = contract;
  for (const key of String(path).split('.')) {
    // Own properties only. Parsed JSON inherits from Object.prototype, so plain
    // access made `constructor`, `__proto__` and `toString` resolve to defined
    // values — a codification claim naming no field in the contract passed as
    // though it named one.
    if (node === null || node === undefined || typeof node !== 'object') return undefined;
    if (!Object.hasOwn(node, key)) return undefined;
    node = node[key];
  }
  return node;
}

// How a ledger glob is scoped, as three cases rather than a nullable ticket.
// The nullable form conflated "grants the whole root" with "cannot be proven to
// name one ticket", so `.agentops/events/AS-HD-040*/**` on an AS-HD-055 lease
// read as a broad root grant and passed: the per-ticket check was bypassable by
// putting a wildcard where the ticket goes.
//
//   root        exactly the declared root. Broad, and authorized only for the
//               lease's own subtree, which the affected-path check enforces.
//   ticket      a literal ticket name in the first component.
//   unprovable  anything else, a wildcard in the ticket position included.
export function ledgerScopeOf(rootGlob, granted) {
  const root = rootGlob.replace(/\*+$/, '');
  if (!granted.startsWith(root)) return { kind: 'outside' };
  const rest = granted.slice(root.length).replace(/^\/+/, '');
  if (rest === '' || rest === '**') return { kind: 'root' };
  const first = rest.split('/')[0];
  if (!first || /[*?\[]/.test(first)) return { kind: 'unprovable' };
  return { kind: 'ticket', ticket: first };
}

export function pathGrantErrors(contracts, lease) {
  const errors = [];
  // An exception covers only the globs it names. A lease carrying one is still
  // fully validated for every other glob, so a grandfathered lease cannot be
  // widened later under cover of its own exception.
  const exempt = new Set(((lease.path_grant_exception || {}).globs) || []);
  const decls = (contracts['git-ownership'] && contracts['git-ownership'].paths) || [];
  const ticketCustody = new Set([
    `.agentops/work/${lease.ticket}/**`,
    `.agentops/events/${lease.ticket}/**`,
  ]);
  for (const g of lease.path_globs) {
    // Work capsules and their event chains are owned by the ticket's current
    // writer even when that actor's standing role does not own every
    // .agentops/work/** path. Keep this exception exact and ticket-scoped.
    if (ticketCustody.has(g)) continue;
    if (exempt.has(g)) continue;
    const owner = decls.find((d) => globCovers(d.glob, g));
    if (!owner) {
      errors.push(`lease '${lease.id}' grants '${g}', which no git-ownership path declares (declare it, or record a path_grant_exception with a reason)`);
    } else if (owner.per_seat) {
      // Ownership follows the ticket's writer lease, so any role may hold its
      // own ledger. This is the A2 fix: with these globs owned by `maker`, a
      // qa-independent or help-desk seat could not be granted its own capsule
      // or event chain, and therefore could not record what it did.
      //
      // "Follows the ticket's lease" is the whole safety argument, and the first
      // version of this branch did not check it: an unconditional `continue`
      // accepted `.agentops/work/**` and authorized the holder for EVERY
      // ticket's ledger. `ledger_serialization` claimed the per-ticket lane kept
      // two seats off one ticket while nothing enforced it — the same
      // self-consistency defect this work keeps finding.
      //
      // A glob scoped to a ticket must name the lease's own; a broad root grant
      // stays legal (AS-1001 holds one) but authorizes only that subtree, which
      // ledgerScopeErrors enforces where the writes actually are.
      const scope = ledgerScopeOf(owner.glob, g);
      if (scope.kind === 'ticket' && lease.ticket && scope.ticket !== lease.ticket) {
        errors.push(`lease '${lease.id}' is issued for '${lease.ticket}' but grants '${g}', which is ${scope.ticket}'s ledger; a seat records what it did, not what another seat did`);
      } else if (scope.kind === 'unprovable') {
        errors.push(`lease '${lease.id}' grants '${g}', whose ticket segment is a pattern; a ledger scope is either the whole root or one literal ticket, because a wildcard there cannot be proven to name this lease's own`);
      }
      continue;
    } else if (owner.owner_role !== actorRole(contracts, lease.actor)) {
      errors.push(`lease '${lease.id}' grants '${g}' to '${lease.actor}', but git-ownership assigns that path to '${owner.owner_role}'`);
    }
  }
  for (const x of lease.excluded_globs || []) {
    if (!lease.path_globs.some((g) => leaseGlobCovers(g, x))) {
      errors.push(`lease '${lease.id}' excludes '${x}', but no granted path covers that exclusion`);
    }
  }
  return errors;
}

export function computeCapsuleHash(capsule) {
  const clone = { ...capsule, current_hash: '' };
  return 'sha256:' + createHash('sha256').update(stableStringify(clone)).digest('hex');
}

// Lease v2 is an append-only successor: the prior lease remains as history,
// receives only the explicit revoked transition, and the child binds those
// exact parent bytes. Multiple children may split one parent only when their
// effective scopes do not overlap.
export function computeLeaseHash(lease) {
  const clone = { ...lease, current_hash: '' };
  return 'sha256:' + createHash('sha256').update(stableStringify(clone)).digest('hex');
}

// Literal directory prefix of a glob, for conservative overlap/coverage tests.
function globPrefix(glob) {
  const s = glob.search(/[*?[]/);
  const cut = s === -1 ? glob : glob.slice(0, s);
  const i = cut.lastIndexOf('/');
  return i === -1 ? '' : cut.slice(0, i + 1);
}

function globOverlap(a, b) {
  const pa = globPrefix(a), pb = globPrefix(b);
  return pa.startsWith(pb) || pb.startsWith(pa);
}

// Unlike the older ownership helper, this comparison must distinguish an
// exact file from the directory-wide glob beside it. Otherwise excluding
// tools/ui-preview-gallery.mjs would incorrectly appear to exclude tools/**.
function leaseGlobCovers(a, b) {
  const wildcard = /[*?[]/.test(a);
  if (!wildcard) return a === b;
  if (a.endsWith('/**')) return b.startsWith(a.slice(0, -2));
  return a === b;
}

function leaseExcludes(lease, glob) {
  return (lease.excluded_globs || []).some((x) => leaseGlobCovers(x, glob));
}

function leaseCovers(lease, glob) {
  return lease.path_globs.some((g) => leaseGlobCovers(g, glob)) && !leaseExcludes(lease, glob);
}

function ticketCustodyScope(lease, glob) {
  return glob === `.agentops/work/${lease.ticket}/**`
    || glob === `.agentops/events/${lease.ticket}/**`;
}

function effectiveLeaseOverlap(a, b) {
  for (const ga of a.path_globs) for (const gb of b.path_globs) {
    if (!globOverlap(ga, gb)) continue;
    const narrower = leaseGlobCovers(ga, gb) ? gb : leaseGlobCovers(gb, ga) ? ga : null;
    if (narrower && (leaseExcludes(a, narrower) || leaseExcludes(b, narrower))) continue;
    return true;
  }
  return false;
}

function activeRuntimeLeases(rt) {
  // A successor never shadows a parent merely by existing. The issuer first
  // revokes the parent, then appends the sealed child. This prevents a
  // malformed or revoked child from disabling otherwise-live custody in code
  // paths that compute dispatch before a separate validation call.
  return rt.leases.filter((l) => !l.revoked);
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
  const leaseById = new Map(rt.leases.map((l) => [l.id, l]));
  const activeLeases = activeRuntimeLeases(rt);
  const roles = g.roles ? new Set(g.roles.roles.map((r) => r.role)) : new Set();
  // A role that holds work but has no hierarchy node has no escalation parent:
  // when it blocks, escalation routing has nowhere to send it and the only
  // recorded outcome is silence. Declaring the role is not enough.
  const hierRoles = hierarchyRoles(g);
  const hierActors = hierarchyActors(g);
  // A blocker names an escalation CLASS, never a wake target. escalation.json
  // owns who a class reaches, so a capsule cannot route itself to the Owner to
  // jump the queue, nor away from the Owner to dodge a protected decision.
  const escClasses = g.escalation ? new Set(g.escalation.classes.map((c) => c.id)) : new Set();
  for (const t of Object.keys(rt.capsules)) {
    const b = rt.capsules[t].blocker;
    if (b && !escClasses.has(b.escalation_class)) {
      errors.push(`capsule ${t}: blocker names escalation class '${b.escalation_class}', which escalation.json does not declare`);
    }
  }
  // A seat whose own role may not move it out of its current state is stranded:
  // it holds a lease and a capsule, and no permitted transition exists for it.
  // Six of seven seat-holding roles sat like this — assigned forever, with
  // nothing in validate that noticed. A dead seat must be a hard error.
  if (g.transitions) {
    for (const t of Object.keys(rt.capsules)) {
      const cap = rt.capsules[t];
      if (cap.blocker) continue;                      // blocked seats route by escalation, not transition
      const out = g.transitions.transitions.filter((m) => m.from === cap.lifecycle_state && !m.protected);
      if (!out.length) continue;                      // terminal or owner-only: not the seat's move to make
      const actingRole = actorRole(g, cap.owner_actor);
      if (!out.some((m) => m.permitted_actor_roles.includes(actingRole))) {
        errors.push(`capsule ${t}: owner_actor '${cap.owner_actor}' (role '${actingRole}') is permitted no move out of '${cap.lifecycle_state}'; the seat is stranded`);
      }
    }
  }
  // "Pools are not standing delivery teams and do not own a backlog, decision
  // stream, or source path merely because the path fits their specialty."
  // Enforced where it can actually be violated: a capsule or a lease naming a
  // pool as its holder would make it one.
  if (g['model-effort']) {
    const me = g['model-effort'];
    for (const t of Object.keys(rt.capsules)) {
      const mx = rt.capsules[t].model_effort;
      if (mx == null) continue;
      const tiers = me.tiers.filter((x) => x.allowed_efforts.includes(mx.effort));
      if (!tiers.length) {
        errors.push(`capsule ${t}: effort '${mx.effort}' matches no declared risk-and-station tier`);
      } else if (tiers.every((x) => x.requires_exceptional_reason) && !mx.exceptional_reason) {
        errors.push(`capsule ${t}: effort '${mx.effort}' is only allowed with a recorded exceptional reason`);
      }
    }
  }
  if (g.teams) {
    const pools = new Set(g.teams.capability_pools.map((p) => p.id));
    // A capsule may name the team it serves. Optional, because most work is
    // path-scoped rather than team-scoped — but if it names one, that name must
    // be a current standing role or pool, or a legacy alias that resolves to
    // one. An unresolvable team is a ticket nobody owns.
    const roster = new Set([...pools, ...g.teams.standing_roles.map((r) => r.id)]);
    const aliases = new Map(g.teams.legacy_aliases.map((a) => [a.legacy, a.routes_to]));
    for (const t of Object.keys(rt.capsules)) {
      const team = rt.capsules[t].team;
      if (team == null) continue;
      if (!roster.has(team) && !aliases.has(team)) {
        errors.push(`capsule ${t}: team '${team}' is neither a standing role, a capability pool, nor a declared legacy alias`);
      }
    }
    for (const t of Object.keys(rt.capsules)) {
      if (pools.has(rt.capsules[t].owner_actor)) {
        errors.push(`capsule ${t}: owner_actor '${rt.capsules[t].owner_actor}' is a capability pool, not a standing team; a pool cannot hold a seat or own a backlog`);
      }
    }
    for (const l of activeLeases) {
      if (pools.has(l.actor)) {
        errors.push(`lease ${l.id}: actor '${l.actor}' is a capability pool, not a standing team; a pool cannot hold a writer lease`);
      }
    }
  }

  // Lease-v2 successors preserve the old file as immutable history while
  // binding the exact parent content. Sibling successors are a permitted
  // split only when their effective scopes are disjoint.
  const childrenByParent = new Map();
  for (const l of rt.leases) {
    if (l.schema !== 'agentops/lease/v2') continue;
    for (const key of ['revision', 'parent_lease', 'parent_hash', 'current_hash']) {
      if (l[key] === undefined) errors.push(`lease '${l.id}' v2 is missing '${key}'`);
    }
    if (l.current_hash !== undefined && l.current_hash !== computeLeaseHash(l)) {
      errors.push(`lease '${l.id}' seal mismatch: current_hash does not match content (stale expected-old-value or tampered)`);
    }
    const parent = leaseById.get(l.parent_lease);
    if (!parent) {
      errors.push(`lease '${l.id}' names unknown parent_lease '${l.parent_lease}'`);
      continue;
    }
    if (!parent.revoked) errors.push(`lease '${l.id}' cannot succeed live parent '${parent.id}'; revoke the parent first`);
    const parentRevision = parent.schema === 'agentops/lease/v2' ? parent.revision : 1;
    if (l.revision !== parentRevision + 1) errors.push(`lease '${l.id}' revision ${l.revision} is not parent revision ${parentRevision} + 1`);
    if (l.parent_hash !== computeLeaseHash(parent)) errors.push(`lease '${l.id}' parent_hash does not match '${parent.id}'`);
    if (l.actor !== parent.actor) errors.push(`lease '${l.id}' changes actor '${parent.actor}' to '${l.actor}'; succession cannot transfer identity`);
    if (l.issuer !== parent.issuer) errors.push(`lease '${l.id}' changes issuer '${parent.issuer}' to '${l.issuer}'`);
    if (l.ticket !== parent.ticket) errors.push(`lease '${l.id}' changes ticket '${parent.ticket}' to '${l.ticket}'`);
    for (const g0 of l.path_globs) {
      if (!leaseCovers(parent, g0) && !ticketCustodyScope(l, g0)) {
        errors.push(`lease '${l.id}' grants '${g0}' outside parent '${parent.id}' effective scope or exact ticket custody`);
      }
    }
    for (const a of l.actions) if (!parent.actions.includes(a)) errors.push(`lease '${l.id}' action '${a}' is not granted by parent '${parent.id}'`);
    for (const x of parent.excluded_globs || []) {
      if (l.path_globs.some((g0) => leaseGlobCovers(g0, x)) && !(l.excluded_globs || []).some((y) => leaseGlobCovers(y, x))) {
        errors.push(`lease '${l.id}' re-grants parent exclusion '${x}'`);
      }
    }
    if (utcInstant(l.issued) !== null && utcInstant(parent.issued) !== null && utcInstant(l.issued) < utcInstant(parent.issued)) {
      errors.push(`lease '${l.id}' issued before parent '${parent.id}'`);
    }
    if (utcInstant(l.expiry) !== null && utcInstant(parent.expiry) !== null && utcInstant(l.expiry) > utcInstant(parent.expiry)) {
      errors.push(`lease '${l.id}' expiry exceeds parent '${parent.id}'`);
    }
    const siblings = childrenByParent.get(parent.id) || [];
    siblings.push(l); childrenByParent.set(parent.id, siblings);
  }
  for (const [parent, children] of childrenByParent) {
    for (let a = 0; a < children.length; a++) for (let b = a + 1; b < children.length; b++) {
      if (effectiveLeaseOverlap(children[a], children[b])) {
        errors.push(`lease successor collision: '${children[a].id}' and '${children[b].id}' split parent '${parent}' with overlapping effective paths`);
      }
    }
  }

  for (const l of activeLeases) errors.push(...pathGrantErrors(g, l));
  // Entitlement must hold for every active lease, not only the one a capsule
  // happens to select: a second unrevoked lease on a protected ref is
  // authoritative too, and would otherwise never be looked at.
  for (const l of activeLeases) errors.push(...refEntitlementErrors(g, `lease '${l.id}'`, l.ref, l.actor));
  // A per-seat ref is isolated by definition, so exactly one active lease may
  // hold it. Path-overlap alone does not catch two seats pointed at the same
  // branch with disjoint paths — they would still collide on the ref.
  {
    const byRef = new Map();
    for (const l of activeLeases) {
      const d = refDeclaration(g, l.ref);
      // Every isolated ref is one seat's branch, per_seat or not: two makers
      // on one claude/* ref collide even with disjoint paths.
      if (!d || d.mutation !== 'isolated-continuation') continue;
      if (byRef.has(l.ref)) {
        errors.push(`isolated ref '${l.ref}' is held by both '${byRef.get(l.ref)}' and '${l.id}'; an isolated ref belongs to exactly one seat`);
      } else byRef.set(l.ref, l.id);
    }
  }
  const roleMay = new Map(g.roles ? g.roles.roles.map((r) => [r.role, new Set(r.may)]) : []);
  const evIds = g.evidence ? new Set(g.evidence.evidence.map((e) => e.id)) : new Set();

  // Leases: role validity, time-bound, path safety.
  for (const l of rt.leases) {
    if (!roles.has(actorRole(g, l.actor))) errors.push(`lease '${l.id}' actor '${l.actor}' resolves to no declared role`);
    if (!roles.has(l.issuer)) errors.push(`lease '${l.id}' issuer role '${l.issuer}' is unknown`);
    const li = utcInstant(l.issued), lx = utcInstant(l.expiry);
    if (li === null) errors.push(`lease '${l.id}' issued '${l.issued}' is not a real instant`);
    if (lx === null) errors.push(`lease '${l.id}' expiry '${l.expiry}' is not a real instant`);
    if (li !== null && lx !== null && lx <= li) errors.push(`lease '${l.id}' expiry is at or before issued (already expired)`);
    for (const p of l.path_globs) if (p.split('/').includes('..')) errors.push(`lease '${l.id}' path glob '${p}' contains a '..' traversal segment`);
  }
  // One writer per overlapping path/ref: two active leases on the same ref with
  // overlapping globs held by different actors are a collision.
  for (let a = 0; a < activeLeases.length; a++) for (let b = a + 1; b < activeLeases.length; b++) {
    const la = activeLeases[a], lb = activeLeases[b];
    if (la.ref !== lb.ref || la.actor === lb.actor) continue;
    const overlap = la.path_globs.some((ga) => lb.path_globs.some((gb) => {
      const pa = globPrefix(ga), pb = globPrefix(gb);
      return pa.startsWith(pb) || pb.startsWith(pa);
    }));
    if (overlap) errors.push(`lease collision: '${la.id}' and '${lb.id}' hold overlapping paths on ref '${la.ref}' for different actors ('${la.actor}' vs '${lb.actor}')`);
  }

  // Append-only event chains per ticket: one genesis, contiguous seq, unbroken parent chain.
  // B4 (#430): consolidation. The whole safety argument is that a summary ADDS
  // a node and removes nothing, so every check here exists to keep it that way.
  // A summary whose range has gone is not a shorter record — it is a claim about
  // events nobody can read.
  // A payload belongs to the kind that owns it. The schema lists `consolidates`
  // and `promotion` as free properties, and runtimeChecks skips a payload whose
  // kind does not match — so a `genesis` event carrying a schema-valid
  // `consolidates` passed verify with an unchecked consolidation claim sitting
  // in the authoritative ledger. `promotion` arrived in this same PR with the
  // identical flaw; both are paired here.
  // Binding `promotion` to kind 'owner-decision' was not enough: every owner
  // command produces that kind, so a delegate or defer event could carry a
  // fabricated promotion and nothing would look at it. The event records the
  // ACTION that produced it now, and the payload is bound to the action.
  const KIND_PAYLOAD = [
    { field: 'consolidates', kind: 'consolidation', action: null },
    { field: 'promotion', kind: 'owner-decision', action: 'fast-forward-test' },
  ];
  for (const [ticket, list] of Object.entries(rt.events)) {
    for (const ev of list) {
      for (const { field, kind, action } of KIND_PAYLOAD) {
        if (ev[field] === undefined) continue;
        if (ev.kind !== kind) {
          errors.push(`event '${ev.id}' is kind '${ev.kind}' but carries a '${field}' payload, which only a '${kind}' event may carry; nothing would check it there`);
        } else if (action && ev.action !== action) {
          errors.push(`event '${ev.id}' carries a '${field}' payload but records action '${ev.action || 'none'}', not '${action}'; the ledger would claim a promotion no command performed`);
        }
      }
    }
  }

  // Binding the payload to its action still validated only the LABEL. An
  // `owner-decision` with action 'fast-forward-test' and `ref: 'main'`,
  // `from: 'x'`, `to: 'y'`, `hosted_verified_dev_oid: 'z'` satisfied both the
  // schema (minLength 1 strings) and every check above, so the authoritative
  // ledger could claim a protected promotion that could not have occurred.
  // The recorded facts are checked against the same contracts the command path
  // derives them from — the ref from git-ownership, the evidence from the gate
  // that guards the move — so a hand-written event cannot name its own ref or
  // invent its own evidence.
  const ffDecl = ((g['git-ownership'] || {}).refs || []).find((r) => /gate-c-fast-forward/i.test(r.mutation || ''));
  const ffGate = ((g['promotion-gates'] || {}).gates || []).find((x) => (x.guards_transitions || []).length && /fast-forward/i.test(x.entry || ''));
  const declaredEvidence = new Set(((g.evidence || {}).evidence || []).map((x) => x.id));
  const fullOid = (v) => typeof v === 'string' && /^[0-9a-f]{40}$/.test(v);
  for (const [, list] of Object.entries(rt.events)) {
    for (const ev of list) {
      const pr = ev.promotion;
      if (!pr || ev.kind !== 'owner-decision' || ev.action !== 'fast-forward-test') continue;
      if (!ffDecl) {
        errors.push(`event '${ev.id}' records a promotion, but git-ownership declares no gate-c-fast-forward ref; there is no ref this promotion could have moved`);
      } else if (pr.ref !== ffDecl.ref) {
        errors.push(`event '${ev.id}' records a promotion of '${pr.ref}', but the only ref this action may move is '${ffDecl.ref}' (git-ownership); the ledger names the ref, so it must be the one the command was permitted to touch`);
      }
      for (const k of ['from', 'to', 'hosted_verified_dev_oid']) {
        if (!fullOid(pr[k])) {
          errors.push(`event '${ev.id}' promotion.${k} is '${String(pr[k]).slice(0, 24)}', not a full 40-character commit id; a promotion recorded against something that is not a commit cannot be verified or undone`);
        }
      }
      if (fullOid(pr.to) && fullOid(pr.hosted_verified_dev_oid) && pr.to !== pr.hosted_verified_dev_oid) {
        errors.push(`event '${ev.id}' promotion moved to ${pr.to.slice(0, 12)}, which is not the recorded hosted-verified dev SHA ${pr.hosted_verified_dev_oid.slice(0, 12)}; decision 0009 permits exactly that commit and no other`);
      }
      if (fullOid(pr.from) && fullOid(pr.to) && pr.from === pr.to) {
        errors.push(`event '${ev.id}' promotion records the same commit as predecessor and target; a ref that did not move is not a promotion, and the rollback target it names restores nothing`);
      }
      const ev_ = Array.isArray(pr.evidence) ? pr.evidence : [];
      for (const item of ev_) {
        if (!declaredEvidence.has(item)) {
          errors.push(`event '${ev.id}' promotion cites evidence '${item}', which evidence.json does not declare; the ledger would justify a protected move with a name nothing defines`);
        }
      }
      if (ffGate) {
        for (const need of ffGate.required_evidence || []) {
          if (!ev_.includes(need)) {
            errors.push(`event '${ev.id}' promotion cites no '${need}', which Gate ${ffGate.id} requires to open this move; the recorded justification is short of the gate it claims to have passed`);
          }
        }
      }
    }
  }

  if (g.retention) {
    const ret = g.retention;
    const protectedTickets = new Set(ret.corrections_are_never_consolidated.protected_tickets || []);
    for (const [ticket, list] of Object.entries(rt.events)) {
      const byId = new Map(list.map((e) => [e.id, e]));
      for (const ev of list) {
        if (ev.kind !== ret.consolidation.kind) continue;
        const c = ev.consolidates;
        if (!c) { errors.push(`event '${ev.id}' is a ${ret.consolidation.kind} but names no range; a summary of nothing is not a record`); continue; }
        if (protectedTickets.has(ticket)) {
          errors.push(`event '${ev.id}' consolidates '${ticket}', whose chain carries a correction of record; summarising it away would remove the history the correction exists to preserve`);
        }
        const from = byId.get(c.from_event), to = byId.get(c.to_event);
        if (!from) errors.push(`event '${ev.id}' consolidates from '${c.from_event}', which is not an event on '${ticket}'; the range must be present to be summarised`);
        if (!to) errors.push(`event '${ev.id}' consolidates to '${c.to_event}', which is not an event on '${ticket}'; the range must be present to be summarised`);
        if (from && to) {
          if (from.seq > to.seq) errors.push(`event '${ev.id}' consolidates ${c.from_event}..${c.to_event}, which runs backwards`);
          if (to.seq >= ev.seq) errors.push(`event '${ev.id}' consolidates a range reaching itself or later; a summary describes what is already recorded`);
          const span = list.filter((e) => e.seq >= from.seq && e.seq <= to.seq);
          if (span.length !== c.count) errors.push(`event '${ev.id}' claims ${c.count} events but ${span.length} are present in ${c.from_event}..${c.to_event}; a count that does not match the range is a dangling claim`);
          if (span.length < ret.consolidation.min_range) errors.push(`event '${ev.id}' consolidates ${span.length} events, below the declared minimum ${ret.consolidation.min_range}; a summary shorter than what it replaces reads worse, not better`);
          if (span.some((e) => e.kind === ret.consolidation.kind)) errors.push(`event '${ev.id}' consolidates a range containing another consolidation; summaries of summaries lose the range they both point at`);
        }
        // Existing is not authorised. retention.authority.actor_role names who
        // may consolidate, and checking only that the identity is known let any
        // actor — `maker` included — claim one while the corpus still validated.
        const authRole = actorRole(g, c.authorised_by);
        const ownerActor = g['owner-intent'] && g['owner-intent'].owner.actor_id;
        if (!roles.has(authRole) && !hierarchyActors(g).has(c.authorised_by)) {
          errors.push(`event '${ev.id}' names '${c.authorised_by}' as authorising the consolidation, which is not a declared actor`);
        } else if (authRole !== ret.authority.actor_role && c.authorised_by !== ownerActor) {
          errors.push(`event '${ev.id}' is authorised by '${c.authorised_by}' (role '${authRole}'), but retention declares '${ret.authority.actor_role}' as the consolidation authority; existing is not the same as being allowed`);
        }
      }
    }
  }

  // Ruling AS-HD-029-0052 point 3, enforced: a tool-initiated reseat must carry
  // the process as its actor. An event signed `maker` that no maker performed
  // binds a producer who did not produce, which is exactly what evidence.json
  // forbids — and it is invisible, because the event validates in every other
  // respect. Bound to events recorded from the ruling forward; the 423 that
  // predate it stand permanently under an append-only ledger and are corrected
  // by AS-HD-029-0052 itself, not by a rewrite.
  for (const [ticket, list] of Object.entries(rt.events)) {
    for (const ev of list) {
      if (!/^Reseated from /.test(ev.summary || '')) continue;
      if (Date.parse(ev.at) < Date.parse(TOOL_ACTOR_EFFECTIVE)) continue;
      if (ev.actor !== TOOL_ACTOR) {
        errors.push(`event '${ev.id}' records a reseat under actor '${ev.actor}', but no seat performed it; a process appending on a seat's behalf names itself ('${TOOL_ACTOR}'), per ruling AS-HD-029-0052`);
      }
    }
  }

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
    // Ruling AS-HD-029-0052 point 2. A tracking pointer belongs only to a seat
    // that has not started: once work stands on a tree, the base is that tree
    // and following the branch would silently rebase the seat's assumptions.
    // The freeze is what makes the pointer safe, so it is checked rather than
    // trusted to the writer.
    if (cap.base_ref) {
      if (!RESEATABLE.has(cap.lifecycle_state)) {
        errors.push(`capsule '${ticket}' is '${cap.lifecycle_state}' and still tracks '${cap.base_ref}'; work stands on a tree, so the base freezes into base_oid when the seat starts`);
      }
      if (/^[0-9a-f]{7,40}$/.test(cap.base_ref)) {
        errors.push(`capsule '${ticket}' base_ref '${cap.base_ref}' is a commit id, not a branch; a pinned value recorded as a pointer is neither`);
      }
      // git decides what a branch name is. The hand-rolled character filter that
      // stood here passed `dev..bad`, `foo//bar`, `trailing/`, `-lead`,
      // `.hidden` and `a.lock` — six names git rejects — while this file already
      // used refNameValid() for a capsule's own ref 400 lines up. Restating a
      // rule instead of reusing it is the defect this branch keeps finding.
      if (!refNameValid(cap.base_ref)) {
        errors.push(`capsule '${ticket}' base_ref '${cap.base_ref}' is not a valid git branch name; git could not create it`);
      }
    }
    if (cap.current_hash !== computeCapsuleHash(cap)) errors.push(`capsule '${ticket}' seal mismatch: current_hash does not match content (stale expected-old-value or tampered)`);
    if (cap.evidence_pointers.length > 8) errors.push(`capsule '${ticket}' has ${cap.evidence_pointers.length} evidence pointers, exceeding the max of 8`);
    for (const ep of cap.evidence_pointers) if (!evIds.has(ep)) errors.push(`capsule '${ticket}' evidence pointer '${ep}' is not a declared evidence type in evidence.json`);
    const ownerRole = actorRole(g, cap.owner_actor);
    const may = roleMay.get(ownerRole);
    if (!may) errors.push(`capsule '${ticket}' owner_actor '${cap.owner_actor}' resolves to no declared role`);
    else for (const a of cap.authority.may) if (!may.has(a)) errors.push(`capsule '${ticket}' authority amplification: may '${a}' is not permitted for role '${ownerRole}'`);
    const lease = leaseById.get(cap.writer_lease);
    if (!lease) errors.push(`capsule '${ticket}' references unknown writer_lease '${cap.writer_lease}'`);
    else {
      if (lease.revoked) errors.push(`capsule '${ticket}' writer_lease '${lease.id}' is revoked`);
      if (!activeLeases.includes(lease)) errors.push(`capsule '${ticket}' writer_lease '${lease.id}' is superseded by an append-only successor`);
      if (lease.ticket !== ticket) errors.push(`capsule '${ticket}' writer_lease '${lease.id}' belongs to ticket '${lease.ticket}'`);
      if (lease.actor !== cap.owner_actor) errors.push(`capsule '${ticket}' owner_actor '${cap.owner_actor}' does not match lease actor '${lease.actor}'`);
      if (hierActors.size && !hierActors.has(cap.owner_actor)) {
        errors.push(`capsule '${ticket}' owner_actor '${cap.owner_actor}' has no node in hierarchy.json, so a blocked seat has no escalation parent`);
      }
      if (lease.ref !== cap.ref) errors.push(`capsule '${ticket}' ref '${cap.ref}' does not match lease ref '${lease.ref}'`);
      // Capsule and lease agreeing proves nothing if both name a ref namespace
      // no policy declares. Every working ref must fall under a declared
      // git-ownership ref pattern, so `wake` cannot hand a seat a checkout
      // instruction the control plane never sanctioned.
      errors.push(...refEntitlementErrors(g, `capsule '${ticket}'`, cap.ref, cap.owner_actor));
      const capExcluded = new Set(cap.excluded_paths || []);
      for (const x of lease.excluded_globs || []) if (!capExcluded.has(x)) errors.push(`capsule '${ticket}' omits writer lease exclusion '${x}'`);
      for (const x of cap.excluded_paths || []) if (!(lease.excluded_globs || []).includes(x)) errors.push(`capsule '${ticket}' excludes '${x}' without its writer lease excluding it`);
      for (const p of cap.affected_paths) {
        const covered = leaseCovers(lease, p);
        if (!covered) errors.push(`capsule '${ticket}' affected path '${p}' is not covered by its writer lease '${lease.id}'`);
        // A broad ledger grant is legal but authorizes only this seat's own
        // subtree. Without this, holding `.agentops/work/**` let a capsule
        // declare another ticket's ledger among its affected paths, which is
        // what the per-ticket lane was supposed to prevent.
        for (const decl of (g['git-ownership'] || {}).paths || []) {
          if (!decl.per_seat || !globCovers(decl.glob, p)) continue;
          const scope = ledgerScopeOf(decl.glob, p);
          if (scope.kind === 'ticket' && scope.ticket !== ticket) {
            errors.push(`capsule '${ticket}' claims affected path '${p}', which is ${scope.ticket}'s ledger; a per-seat grant authorizes the lease's own ticket, not the whole root`);
          } else if (scope.kind === 'unprovable') {
            errors.push(`capsule '${ticket}' claims affected path '${p}', whose ticket segment is a pattern; it cannot be proven to stay inside this seat's own ledger`);
          }
        }
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

// Is HEAD on a branch, or detached? Reseating onto a detached HEAD would pin a
// capsule to a commit no branch carries — see runReseat.
function onBranch(root) {
  try {
    execFileSync('git', ['symbolic-ref', '--quiet', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch { return false; }
}

// Advisory: does this working ref exist yet? A seat's ref is where it SHOULD
// work, so an absent ref is normal for an unstarted seat — but wake must say so
// rather than printing a checkout instruction that silently cannot be followed.
// Any local branch, for fixtures that need a ref that genuinely resolves. A CI
// pull-request checkout is detached with no local branches at all, so callers
// must handle null rather than assume a well-known name exists: hardcoding
// `dev` is what turned the reseat control plant red on a checkout that had none.
function anyLocalBranch(root) {
  try {
    const out = execFileSync('git', ['for-each-ref', '--format=%(refname:short)', '--count=1', 'refs/heads/'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return out || null;
  } catch { return null; }
}

// Does this repository carry the object, and is it a commit? Same execFileSync
// discipline as resolveRef: the value comes from a command request.
function commitExists(root, oid) {
  try {
    const t = execFileSync('git', ['cat-file', '-t', oid], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return t === 'commit';
  } catch { return false; }
}

// Resolve a branch name to its current OID. Same execFileSync discipline as
// refExists: the ref comes from capsule JSON and a shell would expand `$(...)`
// in it. Returns null when the ref does not exist in this checkout.
function resolveRef(root, ref) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${ref}`], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch { return null; }
}

function refExists(root, ref) {
  try {
    // execFileSync, never execSync: the ref comes from capsule JSON, and a
    // shell would expand `$(...)` in it — waking a seat would then run
    // arbitrary commands. An argument array cannot be interpreted as syntax.
    // Fully qualified as refs/heads/: an unqualified name is ambiguous and
    // would report a same-named TAG as an existing working branch.
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${ref}`], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch { return false; }
}

// A ref that passes policy must still be a name git can actually create;
// otherwise wake hands a seat a branch that cannot exist. Checked with git's
// own rules, again without a shell.
export function refNameValid(ref) {
  try {
    execFileSync('git', ['check-ref-format', '--branch', ref], { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch { return false; }
}

// Build the capsule text from already-loaded contracts + runtime. Pure and
// deterministic in `frozen` mode (no live-HEAD lookup) — that mode is the basis
// of the reconstruction goldens and the clean-clone drill.
export function buildCapsule(contracts, rt, work, { frozen = false, head = null, root = ROOT } = {}) {
  const cap = rt.capsules[work];
  if (!cap) return { errors: [`no work capsule for '${work}' under .agentops/work/`] };
  const oi = contracts['owner-intent'];
  const lease = rt.leases.find((l) => l.id === cap.writer_lease);
  const leaseIsActive = !!lease && activeRuntimeLeases(rt).includes(lease);
  const shrt = (o) => (o && o.length > 12) ? o.slice(0, 12) : (o || '?');
  // Ruling AS-HD-029-0052 point 2: an unstarted seat's base may TRACK a branch
  // rather than pin a commit it never worked from. The pointer is resolved here,
  // at read time, and nothing is appended to say so — chasing HEAD with an event
  // per commit is what wrote 423 no-op entries. A tracking capsule is never
  // stale, because there is no pinned value to fall behind.
  let freshness;
  const tracked = cap.base_ref ? resolveRef(root, cap.base_ref) : null;
  if (cap.base_ref && frozen) freshness = `tracking \`${cap.base_ref}\` (as recorded); resolve the ref in this checkout`;
  else if (cap.base_ref && tracked) freshness = `tracking \`${cap.base_ref}\` @ ${shrt(tracked)}; an unstarted seat follows the branch, so it does not go stale`;
  else if (cap.base_ref) freshness = `UNRESOLVABLE — capsule tracks \`${cap.base_ref}\`, which this checkout does not carry; a pointer that cannot be resolved is not a base`;
  else if (frozen) freshness = `as-recorded (base ${shrt(cap.base_oid)}); verify live HEAD out-of-band`;
  else if (!head) freshness = 'unknown (no live HEAD)';
  else if (head.startsWith(cap.base_oid) || cap.base_oid.startsWith(head)) freshness = `current (base matches HEAD ${shrt(head)})`;
  else freshness = `STALE — capsule base ${shrt(cap.base_oid)} != live HEAD ${shrt(head)}; re-seat before mutating`;
  const leaseState = !lease ? 'MISSING' : lease.revoked ? 'REVOKED' : !leaseIsActive ? 'SUPERSEDED' : `active until ${lease.expiry}`;

  const L = [];
  L.push('=== AGENTOPS WAKE CAPSULE ===');
  L.push(`IDENTITY   : actor=${cap.owner_actor} role=${actorRole(contracts, cap.owner_actor)} ticket=${cap.ticket} lease=${cap.writer_lease} (${leaseState})`);
  L.push(`MISSION    : ${oi.mission}`);
  L.push(`WORK       : ${cap.objective}`);
  L.push(`DONE-WHEN  : ${cap.done_when}`);
  L.push(`AUTHORITY  : may ${cap.authority.may.join(', ')} | must-not ${cap.authority.must_not.join(', ')} | expiry ${cap.authority.expiry}`);
  L.push(`FORBIDDEN  : ${oi.protected_decision_classes.join('; ')}`);
  const refNote = frozen ? '' : (refExists(root, cap.ref) ? ' (exists)' : ' (NOT CREATED YET — create it before working; it is an isolated continuation branch)');
  L.push(`REPO/REF   : ${cap.repo} @ ${cap.ref}${refNote}`);
  // While tracking, the RESOLVED commit is the base the seat works from — naming
  // the last-recorded one here told the seat to follow a branch and then handed
  // it a different commit. Frozen mode resolves nothing and says so, keeping the
  // reconstruction goldens deterministic.
  const effectiveBase = tracked || cap.base_oid;
  const baseLine = cap.base_ref
    ? (frozen
      ? `${cap.base_ref} (tracked; resolve in this checkout, recorded ${cap.base_oid})`
      : tracked
        ? `${tracked} (tracking \`${cap.base_ref}\`)`
        : `${cap.base_ref} (tracked; UNRESOLVED in this checkout)`)
    : cap.base_oid;
  L.push(`BASE       : ${baseLine} tree ${cap.tree} dirty=${cap.expected_dirty_state}`);
  L.push(`NEXT ACTION: ${cap.next_action}`);
  // A seat at a gated state must know which gate stands in front of it, who
  // may open it, and what evidence it needs — otherwise it discovers the wall
  // by walking into it. Decision 0009 named them; this is where a seat reads it.
  const pgc = contracts['promotion-gates'];
  if (pgc) {
    const ahead = pgc.gates.filter((g) => (g.guards_transitions || []).some((t) => t.from === cap.lifecycle_state));
    for (const g of ahead) {
      const to = (g.guards_transitions || []).filter((t) => t.from === cap.lifecycle_state).map((t) => t.to).join('/');
      L.push(`GATE       : ${g.id} (${g.name}) stands before ${to} — ${g.actor_role} acts; evidence ${g.required_evidence.join(', ') || 'none declared'}`);
    }
  }
  // A tracking seat is not stopped by its base moving — that is the whole point
  // of the pointer. Leaving the pinned-base clause in place emitted a capsule
  // that said follow the branch and must not work, in the same breath.
  const stopBase = cap.base_ref
    ? 'the tracked branch cannot be resolved, or the base freezes when work starts'
    : 'base_oid moved from HEAD';
  L.push(`STOP       : lease expired or revoked; ${stopBase}; independent QA WITHHOLD; any protected transition (see FORBIDDEN)`);
  const rep = contracts['information-access'].reporting;
  L.push(`REPORTING  : ${rep.style} Must: ${rep.must.join('; ')}. Never: ${rep.must_not.join('; ')}.`);
  L.push(`EVIDENCE   : ${cap.evidence_pointers.slice(0, 8).join(', ') || '—'}`);
  L.push(`SOURCE     : ${frozen ? cap.base_oid : effectiveBase}`);
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
  return buildCapsule(contracts, rt, work, { frozen, head: frozen ? null : currentHead(root), root });
}

// ===========================================================================
// Stage 5: authenticated owner-command path (dry-run) and the read-only Owner
// HUD. The command processor accepts only enumerated, authenticated, allowlisted
// actions with a compare-and-swap precondition; this stage ships the dry-run
// (records what it WOULD do) and performs no repository mutation. The HUD is a
// redacted, deterministic projection of validated state — never a write path.
// ===========================================================================

const REQUEST_SCHEMA_FILE = 'schemas/owner-command-request.schema.json';
const DEV_DELIVERY_ACTION = 'integrate-to-dev-via-pr';
const LEGACY_DELIVERY_DENIAL = 'push-pr-merge-deploy-or-release';
const DEV_DELIVERY_PROTECTED_DENIALS = Object.freeze([
  'direct-push-to-dev',
  'mutate-main-or-release',
  'tag-publish-deploy-or-change-pages-source'
]);

// Validate an owner-command request against the policy: enumerated action,
// authenticated actor, required fields, and the compare-and-swap precondition.
// Pure over already-loaded contracts + runtime so the harness can plant defects.
// A3 (#430): reseat as an enumerated, authenticated, compare-and-swap-checked
// action, so the precondition a stale wake demands is satisfiable by a declared
// path rather than only by a seat running the CLI.
//
// Scope is narrow by ruling, not by omission. AS-HD-029-0052 rule 1 makes reseat
// seat-initiated at the start of work, and rule 2 gives an unstarted seat a
// base_ref that follows a branch without appending anything. What is left for a
// COMMAND is the case those two do not cover: a base a seat did not set for
// itself, moved by the deputy — one named target, under CAS, never a sweep.
// B2 (#430): Gate C, as five refusals rather than five hopes.
//
// Decision 0009 gives the IT Manager III standing conditional authority to
// fast-forward `test`. Every one of its conditions is checked here, and a
// condition that cannot be SHOWN is a refusal — an unprovable precondition on a
// shared-ref mutation is the one place "probably fine" must not be reachable.
//
// Repository-dependent checks run only where a checkout is available, so the
// function stays pure for the plant harness; the apply path always passes root.
export function fastForwardTestErrors(contracts, rt, request, root = null) {
  const errors = [];
  const p = (request.params && typeof request.params === 'object') ? request.params : null;
  if (!p) return [`command 'fast-forward-test' requires params naming the target and its evidence`];
  for (const k of Object.keys(p)) {
    if (!['target_oid', 'hosted_verified_dev_oid', 'rollback_oid', 'evidence'].includes(k)) {
      errors.push(`command 'fast-forward-test' params carries unknown field '${k}'`);
    }
  }
  // The ref it may touch comes from git-ownership, not from the request: a
  // command must not be able to name the ref it mutates.
  const decl = ((contracts['git-ownership'] || {}).refs || []).find((r) => /gate-c-fast-forward/i.test(r.mutation || ''));
  if (!decl) return [`git-ownership declares no ref whose mutation is gate-c-fast-forward-only; there is nothing this action may move`];
  const ref = decl.ref;

  // 2. The target is exactly the hosted-verified dev SHA.
  const full = (v) => typeof v === 'string' && /^[0-9a-f]{40}$/.test(v);
  if (!full(p.target_oid)) errors.push(`command 'fast-forward-test' params.target_oid must be a full 40-character commit id`);
  if (!full(p.hosted_verified_dev_oid)) errors.push(`command 'fast-forward-test' params.hosted_verified_dev_oid must be a full 40-character commit id`);
  if (full(p.target_oid) && full(p.hosted_verified_dev_oid) && p.target_oid !== p.hosted_verified_dev_oid) {
    errors.push(`command 'fast-forward-test' target ${p.target_oid.slice(0, 12)} is not the hosted-verified dev SHA ${p.hosted_verified_dev_oid.slice(0, 12)}; decision 0009 permits exactly that commit and no other`);
  }
  // ...but comparing two fields of the same request is not a constraint: put the
  // same OID in both and the check agrees with itself. The integration ref is
  // the authority for what dev is, and git-ownership names it, so the claim is
  // checked against the repository below rather than against its own restatement.
  const devDecl = ((contracts['git-ownership'] || {}).refs || []).find((r) => (r.mutation || '') === 'pr-only');
  if (!devDecl) errors.push(`git-ownership declares no pr-only integration ref, so there is nothing to check the hosted-verified SHA against`);
  // 4. The rollback target is recorded BEFORE the mutation, and is the ref's
  //    current head — a rollback to anything else does not restore what was
  //    replaced.
  if (!full(p.rollback_oid)) errors.push(`command 'fast-forward-test' params.rollback_oid must be a full 40-character commit id; a ref mutation with no recorded predecessor cannot be undone`);
  if (!Array.isArray(p.evidence) || p.evidence.length === 0) {
    errors.push(`command 'fast-forward-test' params.evidence must record the mutation evidence decision 0009 requires`);
  } else if (!p.evidence.every((x) => typeof x === 'string' && x.trim() !== '')) {
    // `[null]` is a non-empty array. Length was never the question.
    errors.push(`command 'fast-forward-test' params.evidence must be non-empty strings; an array with nothing readable in it records nothing`);
  }

  // 1 and 5. Gate freshness and the absence of a withhold are read from the
  //    capsule, never from the request: a command does not get to assert that
  //    the gates in front of it have passed.
  const cap = rt.capsules[request.target];
  if (cap && cap.blocker) {
    errors.push(`command 'fast-forward-test' target '${request.target}' carries an unresolved blocker (${cap.blocker.escalation_class}); decision 0009 condition 5 forbids promoting past one`);
  }
  // Condition 1: gates A and B pass and remain fresh. Absence of a blocker is
  // not evidence that they passed — it is only the absence of a record that
  // they did not. The evidence each gate requires is derived from
  // promotion-gates rather than restated here, and must be present on the
  // capsule being promoted.
  if (cap) {
    const held = new Set(cap.evidence_pointers || []);
    for (const gate of ((contracts['promotion-gates'] || {}).gates || [])) {
      if (gate.id !== 'A' && gate.id !== 'B') continue;
      for (const need of gate.required_evidence || []) {
        if (!held.has(need)) {
          errors.push(`command 'fast-forward-test' target '${request.target}' does not carry '${need}', which Gate ${gate.id} requires; decision 0009 condition 1 needs gates A and B shown to have passed, not merely not recorded as failing`);
        }
      }
      // ...and carrying the type name is still not proof. evidence_pointers
      // name TYPES; nothing in this corpus records a receipt bound to an exact
      // object, so freshness cannot be evaluated for this candidate. Condition 1
      // asks for fresh gate results, and a condition that cannot be shown is a
      // refusal. Declared in evidence.rules.pointers_are_types_not_receipts and
      // raised on #430 rather than papered over with a membership test.
      if ((gate.required_evidence || []).length && contracts.evidence && contracts.evidence.rules.pointers_are_types_not_receipts) {
        errors.push(`command 'fast-forward-test' cannot show Gate ${gate.id} evidence is FRESH for this candidate: evidence_pointers name types, and no receipt is recorded against an exact object anywhere in the corpus. Decision 0009 condition 1 asks for fresh gate results, so this refuses until a per-candidate receipt exists`);
      }
    }
  }

  if (root) {
    const current = resolveRef(root, ref);
    if (current === null) {
      errors.push(`command 'fast-forward-test' cannot resolve '${ref}' in this checkout; the ref it would move must be present to be moved safely`);
    } else {
      if (full(p.rollback_oid) && p.rollback_oid !== current) {
        errors.push(`command 'fast-forward-test' records rollback ${p.rollback_oid.slice(0, 12)} but '${ref}' is at ${current.slice(0, 12)}; the recorded predecessor must be what is actually being replaced`);
      }
      // A local ref move in an ephemeral checkout is not a promotion. The
      // owner-command workflow checks out `dev` and pushes only HEAD:dev, so
      // moving refs/heads/test there would report success while the hosted ref
      // stood still. Refuse unless the local ref is at the published state, so
      // the move is at least from something real — and see the publication
      // blocker raised on this PR, which this check does not close.
      const published = resolveRemoteRef(root, ref);
      if (published === null) {
        errors.push(`command 'fast-forward-test' cannot see 'origin/${ref}' in this checkout; a ref move that no one can publish is not a promotion, and this tool does not push`);
      } else if (current !== null && published !== current) {
        errors.push(`command 'fast-forward-test' refused: local '${ref}' at ${current.slice(0, 12)} differs from 'origin/${ref}' at ${published.slice(0, 12)}; promoting from an unpublished state would move a ref no one else has`);
      }

      // The hosted-verified claim, checked against the ref rather than the
      // request that makes it.
      if (devDecl && full(p.hosted_verified_dev_oid)) {
        const devHead = resolveRef(root, devDecl.ref);
        if (devHead === null) {
          errors.push(`command 'fast-forward-test' cannot resolve '${devDecl.ref}' in this checkout, so the hosted-verified claim cannot be checked against it`);
        } else if (devHead !== p.hosted_verified_dev_oid) {
          errors.push(`command 'fast-forward-test' claims ${p.hosted_verified_dev_oid.slice(0, 12)} as the hosted-verified '${devDecl.ref}' SHA, but '${devDecl.ref}' is at ${devHead.slice(0, 12)}; the ref is the authority for that, not the request`);
        }
      }
      if (full(p.target_oid)) {
        if (!commitExists(root, p.target_oid)) {
          errors.push(`command 'fast-forward-test' target ${p.target_oid.slice(0, 12)} is not a commit in this repository`);
        } else if (p.target_oid === current) {
          errors.push(`command 'fast-forward-test' target is already '${ref}'; a command that moves nothing still appends an event`);
        } else if (!isAncestor(root, current, p.target_oid)) {
          // 3. A true fast-forward, or nothing.
          errors.push(`command 'fast-forward-test' refused: '${ref}' at ${current.slice(0, 12)} is not an ancestor of ${p.target_oid.slice(0, 12)}, so this is not a fast-forward. Decision 0009 permits no other shape of move`);
        }
      }
    }
  }
  return errors;
}

// writeFileSync truncates before it writes, so a failure part-way leaves an
// empty or half-written event on disk. That file is not a record of anything —
// it is a malformed entry the next loadRuntime chokes on, and the next attempt
// at the same sequence number would collide with it. Removing a file this call
// created moments ago is not a history rewrite; it is not letting a failed write
// become history in the first place.
function discardPartialEvent(evPath) {
  try { if (existsSync(evPath)) rmSync(evPath, { force: true }); return true; } catch { return false; }
}

// Move a ref forward, atomically, refusing if it is not where we last saw it.
// `git update-ref <ref> <new> <old>` fails when the ref has moved since
// validation — the same compare-and-swap discipline the capsule seal uses, at
// the level where a concurrent writer would otherwise be clobbered. No force,
// no delete, no rewrite: this is the only ref write in the tool.
function fastForwardRef(root, ref, newOid, oldOid) {
  try {
    execFileSync('git', ['update-ref', `refs/heads/${ref}`, newOid, oldOid], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `update-ref refused to move '${ref}' from ${oldOid.slice(0, 12)} to ${newOid.slice(0, 12)}: ${String((e && e.stderr) || e.message || e).trim()}` };
  }
}

// The published counterpart of a local branch, or null when this checkout has
// none. A promotion is a statement about the hosted ref, not about a working
// copy that will be discarded when the job ends.
export function resolveRemoteRefForTest(root, ref) { return resolveRemoteRef(root, ref); }
function resolveRemoteRef(root, ref) {
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${ref}`], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || null;
  } catch { return null; }
}

// Is `maybe` an ancestor of `of`? The exact question a fast-forward asks.
export function isAncestorForTest(root, maybe, of) { return isAncestor(root, maybe, of); }
function isAncestor(root, maybe, of) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', maybe, of], { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch { return false; }
}

export function reseatParamErrors(rt, request, root = null) {
  const errors = [];
  const cap = rt.capsules[request.target];
  const p = (request.params && typeof request.params === 'object') ? request.params : null;
  if (!p) return [`command 'reseat' requires params naming the new base`];
  const hasOid = typeof p.base_oid === 'string' && p.base_oid !== '';
  const hasRef = typeof p.base_ref === 'string' && p.base_ref !== '';
  if (hasOid === hasRef) {
    errors.push(`command 'reseat' takes exactly one of params.base_oid (pin an exact commit) or params.base_ref (track a branch); it was given ${hasOid ? 'both' : 'neither'}`);
  }
  for (const k of Object.keys(p)) {
    if (k !== 'base_oid' && k !== 'base_ref') errors.push(`command 'reseat' params carries unknown field '${k}'; the action reads base_oid and base_ref only`);
  }
  if (cap && !RESEATABLE.has(cap.lifecycle_state)) {
    errors.push(`command 'reseat' target '${request.target}' is '${cap.lifecycle_state}', not unstarted; work already stands on its base, and moving it would silently rebase what the seat assumed`);
  }
  if (hasOid && !/^[0-9a-f]{40}$/.test(p.base_oid)) {
    errors.push(`command 'reseat' params.base_oid '${p.base_oid}' is not a full 40-character commit id; an abbreviated base is ambiguous in a growing repository`);
  }
  if (hasRef && /^[0-9a-f]{7,40}$/.test(p.base_ref)) {
    errors.push(`command 'reseat' params.base_ref '${p.base_ref}' is a commit id, not a branch; a pinned value recorded as a pointer is neither`);
  }
  if (cap && hasOid && cap.base_oid === p.base_oid && !cap.base_ref) {
    errors.push(`command 'reseat' would set '${request.target}' to the base it already records; a command that changes nothing still appends an event`);
  }
  if (cap && hasRef && cap.base_ref === p.base_ref) {
    errors.push(`command 'reseat' would set '${request.target}' to the pointer it already records; a command that changes nothing still appends an event`);
  }
  // Repository-dependent checks run only where a checkout is available, so the
  // function stays pure for the plant harness.
  if (root) {
    if (hasOid && !commitExists(root, p.base_oid)) errors.push(`command 'reseat' params.base_oid '${p.base_oid.slice(0, 12)}' is not a commit in this repository`);
    if (hasRef && resolveRef(root, p.base_ref) === null) errors.push(`command 'reseat' params.base_ref '${p.base_ref}' is not a branch in this repository`);
  }
  return errors;
}

export function validateCommand(contracts, rt, request, { root = null } = {}) {
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
  if (action.id === 'grant-dev-delivery-authority') {
    const cap = rt.capsules[request.target];
    if (!cap) errors.push(`command target '${request.target}' has no work capsule`);
    else {
      const ownerRole = actorRole(contracts, cap.owner_actor);
      const role = contracts.roles.roles.find((r) => r.role === ownerRole);
      if (ownerRole !== 'it-manager-iii') errors.push(`command '${action.id}' may target only an it-manager-iii-owned capsule (target resolves to '${ownerRole}')`);
      if (!role || !role.may.includes(DEV_DELIVERY_ACTION)) errors.push(`command '${action.id}' cannot grant '${DEV_DELIVERY_ACTION}' because the target role does not hold it`);
      if (cap.authority.may.includes(DEV_DELIVERY_ACTION)) errors.push(`command '${action.id}' target '${request.target}' already has '${DEV_DELIVERY_ACTION}'`);
      if (!cap.authority.must_not.includes(LEGACY_DELIVERY_DENIAL)) errors.push(`command '${action.id}' target '${request.target}' has no exact legacy delivery denial to narrow`);
    }
  }
  let cas = 'n/a';
  if (action.requires_cas) {
    const cap = rt.capsules[request.target];
    if (!cap) errors.push(`command target '${request.target}' has no work capsule`);
    else if (request.expected_current_hash && computeCapsuleHash(cap) !== request.expected_current_hash) {
      errors.push(`stale command: expected_current_hash does not match the live state of '${request.target}' (compare-and-swap failed)`);
    } else if (request.expected_current_hash) cas = 'OK';
  }
  // Action-specific shape. `params` is an open object in the request schema, so
  // an action that reads it validates what it reads — otherwise no_arbitrary_input
  // holds for every field except the one that carries the payload. Checked here
  // rather than at apply so dry_run_first actually reports it.
  if (action.id === 'reseat') errors.push(...reseatParamErrors(rt, request, root));
  if (action.id === 'fast-forward-test') errors.push(...fastForwardTestErrors(contracts, rt, request, root));

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

  let pendingCapsule = null;
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
      : request.action === 'reseat' && capsule
        ? `Owner-command 'reseat' by ${request.actor}: ${capsule.base_ref ? `base_ref ${capsule.base_ref}` : `base ${String(capsule.base_oid).slice(0, 12)}`} -> ${request.params.base_ref ? `base_ref ${request.params.base_ref} (resolved at read time)` : `base ${String(request.params.base_oid).slice(0, 12)}`}. The seat did not perform this; the authenticating actor did.`
        : request.action === 'fast-forward-test'
        ? `Owner-command 'fast-forward-test' by ${request.actor}: fast-forwarded '${(contracts['git-ownership'].refs.find((r) => /gate-c-fast-forward/i.test(r.mutation || '')) || {}).ref}' from ${String(request.params.rollback_oid).slice(0, 12)} to ${String(request.params.target_oid).slice(0, 12)}, the hosted-verified dev SHA. Rollback target is the recorded predecessor.`
        : `Owner-command '${request.action}' by ${request.actor} recorded${reason ? `: ${reason}` : ''}.`,
    clearsBlocker ? 'Blocker cleared: the decision it was waiting on is now recorded.' : ''
  ].filter(Boolean).join(' ');
  const event = {
    schema: 'agentops/event/v1', id, ticket, seq,
    parent_event: last ? last.id : null,
    kind: 'owner-decision', actor: request.actor, action: request.action, at: now, summary
  };
  // The ledger is the authoritative record of the promotion, so it carries the
  // exact facts rather than the 12-character prefixes the summary reads with.
  // The evidence was validated and then discarded, which left the chain unable
  // to reconstruct what the promotion was justified by.
  if (request.action === 'fast-forward-test' && request.params) {
    event.promotion = {
      ref: (contracts['git-ownership'].refs.find((r) => /gate-c-fast-forward/i.test(r.mutation || '')) || {}).ref,
      from: request.params.rollback_oid,
      to: request.params.target_oid,
      hosted_verified_dev_oid: request.params.hosted_verified_dev_oid,
      evidence: request.params.evidence,
    };
  }

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
    // A3: move the base. Re-validated here against the same function the dry run
    // used, because apply must never trust a decision taken against older state.
    if (action.id === 'reseat') {
      const bad = reseatParamErrors(rt, request, root);
      if (bad.length) return { ok: false, errors: bad, written };
      if (request.params.base_ref) { next.base_ref = request.params.base_ref; }
      else { next.base_oid = request.params.base_oid; delete next.base_ref; }
    }
    if (action.id === 'grant-dev-delivery-authority') {
      next.authority.may.push(DEV_DELIVERY_ACTION);
      next.authority.must_not = next.authority.must_not.filter((item) => item !== LEGACY_DELIVERY_DENIAL);
      for (const denial of DEV_DELIVERY_PROTECTED_DENIALS) {
        if (!next.authority.must_not.includes(denial)) next.authority.must_not.push(denial);
      }
    }
    // The appended event is the decision's record; evidence_pointers carries
    // declared evidence types only (evidence.json), never event ids.
    delete next.current_hash;
    next.current_hash = computeCapsuleHash(next);
    // Computed, NOT written. I called the earlier ordering deliberate and it was
    // still wrong: a refusal after this point left CURRENT.json rewritten and
    // its revision advanced with no event appended. Nothing persists until every
    // preflight has passed.
    pendingCapsule = { path: resolve(root, `work/${ticket}/CURRENT.json`), body: JSON.stringify(reorderCapsule(next), null, 2) + '\n' };
  }

  // Three rounds of review landed on this block, each time on a narrower window,
  // because each fix moved the fallible step rather than removing the window.
  // The rule now, stated once: NOTHING that another reader can see is written
  // until every step that can still refuse has passed, and every write after
  // that point has an undo. The order is preflight, ref, capsule, event; a
  // failure at any point restores what came before it, in reverse.
  const evDir = resolve(root, `events/${ticket}`);
  mkdirSync(evDir, { recursive: true });
  const evPath = resolve(evDir, `${id}.json`);
  if (existsSync(evPath)) return { ok: false, errors: [`event '${id}' already exists; refusing to overwrite an append-only record`], written };

  // The capsule's prior bytes, so a later failure can put them back. A capsule
  // whose revision advanced with no ledger entry is a seal mismatch the next
  // verify reports and nobody asked for.
  const capPath = pendingCapsule ? pendingCapsule.path : null;
  let priorCapsule = null;
  if (capPath) { try { priorCapsule = readFileSync(capPath, 'utf8'); } catch { priorCapsule = null; } }
  const restoreCapsule = () => {
    if (capPath && priorCapsule !== null) { try { writeFileSync(capPath, priorCapsule); return true; } catch { return false; } }
    return true;
  };

  let refMove = null;
  if (action.id === 'fast-forward-test') {
    const bad = fastForwardTestErrors(contracts, rt, request, root);
    if (bad.length) return { ok: false, errors: bad, written };
    const decl = contracts['git-ownership'].refs.find((r) => /gate-c-fast-forward/i.test(r.mutation || ''));
    // The ref moves FIRST among the writes, because it is the only one whose
    // failure mode is a lost race rather than an I/O error, and losing it must
    // cost nothing. The previous version wrote the capsule immediately before
    // this call, so a lost CAS left a resealed capsule with no event.
    const moved = fastForwardRef(root, decl.ref, request.params.target_oid, request.params.rollback_oid);
    if (!moved.ok) return { ok: false, errors: [moved.error], written };
    refMove = { ref: decl.ref, from: request.params.rollback_oid, to: request.params.target_oid };
    written.push(`ref:refs/heads/${decl.ref}`);
    const undoRef = () => fastForwardRef(root, decl.ref, request.params.rollback_oid, request.params.target_oid);
    try {
      if (pendingCapsule) { writeFileSync(pendingCapsule.path, pendingCapsule.body); written.push(`work/${ticket}/CURRENT.json`); }
      writeFileSync(evPath, JSON.stringify(event, null, 2) + '\n');
    } catch (e) {
      const evGone = discardPartialEvent(evPath);
      const capBack = restoreCapsule();
      const undo = undoRef();
      return { ok: false, errors: [`promotion failed after '${decl.ref}' moved: ${String(e.message || e)}. ${undo.ok ? `'${decl.ref}' was restored to ${request.params.rollback_oid.slice(0, 12)}` : `RESTORE FAILED — '${decl.ref}' stands at ${request.params.target_oid.slice(0, 12)}: ${undo.error}`}; ${capBack ? 'the capsule was restored to its prior revision' : 'THE CAPSULE COULD NOT BE RESTORED and its revision has advanced with no event'}${evGone ? '' : `; A PARTIAL EVENT REMAINS AT ${evPath} and must be removed before the next run`}.`], written };
    }
    written.push(`events/${ticket}/${id}.json`);
  } else {
    try {
      if (pendingCapsule) { writeFileSync(pendingCapsule.path, pendingCapsule.body); written.push(`work/${ticket}/CURRENT.json`); }
      writeFileSync(evPath, JSON.stringify(event, null, 2) + '\n');
    } catch (e) {
      const evGone = discardPartialEvent(evPath);
      const capBack = restoreCapsule();
      return { ok: false, errors: [`decision write failed: ${String(e.message || e)}. ${capBack ? 'The capsule was restored to its prior revision.' : 'THE CAPSULE COULD NOT BE RESTORED and its revision has advanced with no event.'}${evGone ? '' : ` A PARTIAL EVENT REMAINS AT ${evPath} and must be removed before the next run.`}`], written };
    }
    written.push(`events/${ticket}/${id}.json`);
  }
  pendingCapsule = null;

  return { ok: true, errors: [], written, event, transition: move || null, refMove };
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
  const res = validateCommand(contracts, rt, request, { root });
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
  const activeLeases = activeRuntimeLeases(rt);
  const protectedStates = new Set(contracts.transitions.protected_states);
  const ownerActor = oi.owner.actor_id;

  // Derived through the same dispatch the executor uses, so the HUD and the
  // wake issues can never disagree about what is the Owner's. Reading
  // `blocker.wake` here was wrong twice over: a capsule no longer carries a
  // wake target at all, so this silently showed nothing, and even when it did,
  // it trusted the capsule's own claim about who it reached.
  const dispatch = computeDispatch(contracts, rt);
  const needsYou = dispatch.filter((e) => e.kind === 'owner-decision').map((e) => e.ticket);
  const dispatchReason = new Map(dispatch.map((e) => [e.ticket, e]));
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
  else { L.push('<div class="wrap"><table><tr><th>Ticket</th><th>Why it reached you</th></tr>'); for (const t of needsYou) L.push(`<tr><td><code>${esc(t)}</code></td><td>${esc(dispatchReason.get(t).reason)}</td></tr>`); L.push('</table></div>'); }
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
// The Review & Approval Hub — a multi-page static site generated from the same
// validated state everything else reads.
//
// It replaces a committed Next.js export: 1457 build-output files with no
// source on any branch, unbuildable, uneditable, and already drifted from the
// control plane it claimed to show. Nothing here is built or fetched; every
// page is a projection of contracts + capsules + leases + events, so `verify`
// drift-gates the site exactly as it gates GOVERNANCE.md, and it cannot rot
// away from the truth again without CI saying so.
// ---------------------------------------------------------------------------
const HUB_DIR = 'generated/hub';
// Versioned owner-page shell. Every current and future Review & Approval Hub
// route must render through `renderOwnerPage` so a new page cannot quietly
// fall back to an unstyled document or fork its own copy of the motif.
export const OWNER_PAGE_LAYOUT_ID = 'ashenspire-owner-hub-v1';

const hubEsc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export const OWNER_PAGE_CSS = [
  ':root{--ink:#171a18;--muted:#666a64;--paper:#f4f0e8;--paper-bright:#fbf8f2;--line:#d8d1c4;--charcoal:#202622;--charcoal-soft:#2a312c;--mint:#a7e2c2;--mint-deep:#1f6b4b;--amber:#d49245;--amber-deep:#8c581e;--rose:#984e59;--shadow:0 18px 48px rgba(37,35,29,.09)}',
  '*{box-sizing:border-box}html{scroll-behavior:smooth;background:var(--paper)}body{margin:0;color:var(--ink);background:radial-gradient(circle at 85% 4%,rgba(167,226,194,.18),transparent 28rem),linear-gradient(90deg,rgba(23,26,24,.025) 1px,transparent 1px),var(--paper);background-size:auto,42px 42px,auto;font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}',
  'a{color:inherit}code{font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace}button,a,summary{touch-action:manipulation}.sub{color:var(--muted);font-size:12px;line-height:1.55}',
  '.hero{color:#eef3ef;background:linear-gradient(135deg,rgba(167,226,194,.08),transparent 44%),var(--charcoal);border-bottom:1px solid #3b443e;padding:24px clamp(24px,3vw,56px) 34px}',
  '.hero-topline{color:#d2dad4;letter-spacing:.03em;display:flex;align-items:center;gap:12px;font-size:13px}.priority{width:34px;height:34px;color:var(--mint);border:1px solid rgba(167,226,194,.46);border-radius:50%;display:grid;place-items:center;font-weight:800;flex:none}.divider{width:1px;height:16px;background:#566159}.hero-brand{text-decoration:none}.hero-brand:hover,.hero-brand:focus-visible{color:var(--mint);text-decoration:underline;text-underline-offset:4px}.hero-grid{width:min(90vw,1440px);margin:0 auto;padding:clamp(42px,6vw,74px) 0 18px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:32px;align-items:end}.eyebrow,.kicker,.card-index{text-transform:uppercase;letter-spacing:.15em;font-size:11px;font-weight:850}.eyebrow{color:var(--mint);margin:0 0 12px}.hero h1,.display-title{font-family:Georgia,Cambria,serif}.hero h1{max-width:900px;margin:0 0 18px;font-size:clamp(48px,7vw,92px);font-weight:600;letter-spacing:-.055em;line-height:.9}.lede{max-width:780px;margin:0;color:#bdc7bf;font-size:clamp(15px,1.6vw,19px);line-height:1.65}',
  'nav{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}nav a{color:#c7d0c9;border:1px solid #465149;border-radius:999px;padding:9px 14px;font-size:12px;text-decoration:none;white-space:nowrap}nav a:hover,nav a:focus-visible,nav a[aria-current=page]{border-color:var(--mint);color:var(--mint);outline:none;background:rgba(167,226,194,.06)}',
  '.truth-panel{width:min(90vw,1440px);margin:0 auto;background:#465149;border:1px solid #465149;border-radius:18px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;overflow:hidden}.truth-button{min-height:92px;color:inherit;background:var(--charcoal-soft);text-align:center;padding:17px 12px;text-decoration:none;display:grid;align-content:center}.truth-button:hover,.truth-button:focus-visible{color:#fff;box-shadow:inset 0 -3px 0 var(--mint);background:#354139;outline:none}.truth-button strong{color:var(--mint);font:600 34px/1 Georgia,Cambria,serif}.truth-button span{color:#d2ddd5;margin-top:7px;font-size:11px}.truth-button small{color:#89958c;margin-top:4px;font-size:9px}.truth-button.blocker-metric strong{color:#efc07c}',
  'main{width:min(90vw,1440px);margin:0 auto;padding:clamp(36px,5vw,72px) 0;display:grid;gap:22px}.section-heading{max-width:820px;margin:0 0 22px}.section-heading .kicker{color:var(--mint-deep);margin:0 0 8px}.section-heading h2{font:600 clamp(30px,4vw,50px)/1 Georgia,Cambria,serif;letter-spacing:-.035em;margin:0 0 12px}.section-heading p{color:var(--muted);margin:0}',
  'section,.panel{background:var(--paper-bright);border:1px solid var(--line);border-radius:20px;padding:clamp(22px,3vw,38px);box-shadow:var(--shadow)}section>h2{margin:0 0 18px;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.14em}',
  '.section-fold{background:var(--paper-bright);border:1px solid var(--line);border-radius:20px;overflow:hidden;box-shadow:var(--shadow)}.fold-summary{cursor:pointer;list-style:none;min-height:92px;padding:20px clamp(20px,2.4vw,34px);display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:center}.fold-summary::-webkit-details-marker,.ticket-summary::-webkit-details-marker{display:none}.fold-summary:hover,.fold-summary:focus-visible{background:#fff;outline:none}.fold-summary-copy{display:grid;gap:5px}.fold-summary-copy strong{font:600 clamp(25px,3vw,38px)/1 Georgia,Cambria,serif;letter-spacing:-.025em}.fold-summary-copy span{color:var(--muted);font-size:13px}.fold-toggle{min-height:42px;padding:9px 14px;border:1px solid #b9b09f;border-radius:999px;color:#4d514d;font-size:10px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:9px}.fold-toggle:after{content:"+";font-size:18px;font-weight:400;line-height:1}.section-fold[open]>.fold-summary{border-bottom:1px solid var(--line)}.section-fold[open] .fold-toggle:after{content:"−"}.section-content{padding:clamp(20px,3vw,36px)}',
  '.notice{border-left:4px solid var(--mint-deep);background:#edf4ef;padding:18px 20px;border-radius:0 14px 14px 0}.notice.warn{border-color:var(--amber);background:#fbf1e3}.notice p:last-child{margin-bottom:0}.none{color:var(--muted);font-style:italic}.ok{color:var(--mint-deep)}.warn{color:var(--amber-deep)}',
  '.ticket-list{display:grid;gap:10px}.ticket-card{background:#fffdf8;border:1px solid var(--line);border-radius:15px;overflow:hidden}.ticket-summary{cursor:pointer;list-style:none;min-height:74px;padding:14px 18px;display:grid;grid-template-columns:minmax(105px,.38fr) minmax(0,1.45fr) minmax(120px,.58fr) auto;gap:14px;align-items:center}.ticket-summary:hover,.ticket-summary:focus-visible{background:#fff;outline:2px solid rgba(31,107,75,.32);outline-offset:-2px}.ticket-id{font-weight:850;color:var(--mint-deep)}.ticket-title{min-width:0}.ticket-title strong{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ticket-title small,.ticket-seat small{display:block;color:var(--muted);font-size:11px}.ticket-seat{font-size:12px;min-width:0}.state-pill,.pill{display:inline-flex;align-items:center;width:max-content;max-width:100%;padding:5px 9px;border:1px solid var(--line);border-radius:999px;background:#f3efe7;font-size:10px;font-weight:850;letter-spacing:.05em;text-transform:uppercase}.state-pill.active{color:#fff;background:var(--mint-deep);border-color:var(--mint-deep)}.state-pill.blocked{color:#fff;background:var(--rose);border-color:var(--rose)}.state-pill.complete{color:#58605a;background:#e1e3df;border-color:#c8ccc7}.ticket-body{border-top:1px solid var(--line);padding:22px;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(240px,.75fr);gap:28px}.ticket-body p{margin:0;color:#505650}.ticket-actions{display:grid;align-content:start;gap:9px}.button-link{min-height:44px;border:1px solid var(--mint-deep);border-radius:999px;padding:10px 15px;color:#fff;background:var(--mint-deep);display:inline-flex;align-items:center;justify-content:center;text-align:center;font-size:11px;font-weight:850;text-decoration:none}.button-link.secondary{color:var(--mint-deep);background:transparent}.button-link:hover,.button-link:focus-visible{filter:brightness(.92);outline:3px solid rgba(31,107,75,.22);outline-offset:2px}',
  '.card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:14px}.mini-card{background:#fffdf8;border:1px solid var(--line);border-radius:15px;padding:20px}.mini-card .kicker{color:var(--mint-deep);margin:0 0 7px}.mini-card h3{font:600 25px/1.05 Georgia,Cambria,serif;margin:0 0 12px}.mini-card p{color:var(--muted);margin:0 0 15px}.mini-card dl{margin-top:14px}',
  '.wrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px}table{width:100%;border-collapse:collapse;font-size:13px;background:#fffdf8}th,td{text-align:left;padding:11px 12px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.1em}tr:last-child td{border-bottom:0}tbody tr:hover{background:#fff}',
  'dl{margin:0;display:grid;grid-template-columns:minmax(110px,.35fr) minmax(0,1fr);gap:8px 16px;font-size:13px}dt{color:var(--muted);font-weight:700}dd{margin:0;min-width:0;overflow-wrap:anywhere}ol.chain{margin:0;padding-left:20px;font-size:13px}ol.chain li{margin-bottom:12px;padding-left:4px}',
  'footer{width:min(90vw,1440px);margin:0 auto;padding:0 0 38px;color:var(--muted);font-size:12px}',
  '@media(max-width:900px){.hero-grid{grid-template-columns:1fr}.hero-grid nav{justify-content:flex-start}.truth-panel{grid-template-columns:repeat(2,minmax(0,1fr))}.ticket-summary{grid-template-columns:minmax(100px,.5fr) minmax(0,1.5fr) auto}.ticket-seat{display:none}.ticket-body{grid-template-columns:1fr}}',
  '@media(max-width:620px){.hero{padding-left:20px;padding-right:20px}.hero-topline .divider,.hero-topline .muted{display:none}.hero-grid,main,.truth-panel,footer{width:min(100% - 28px,1440px)}.hero h1{font-size:49px}.truth-panel{grid-template-columns:1fr 1fr}.truth-button{min-height:78px;padding:13px 8px}.truth-button strong{font-size:27px}.fold-summary{grid-template-columns:1fr;gap:12px}.fold-toggle{width:max-content}.ticket-summary{grid-template-columns:1fr auto;gap:7px 10px}.ticket-id{grid-column:1}.ticket-title{grid-column:1/-1}.state-pill{grid-column:2;grid-row:1}.ticket-body{padding:18px}.section-content,section,.panel{padding:20px 16px}dl{grid-template-columns:1fr;gap:3px}dd{margin-bottom:9px}.wrap{margin-left:-8px;margin-right:-8px}}',
  '@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}',
].join('');

// One shell so every page shares chrome and a reader never lands somewhere with
// no way back. `up` is '' at the site root and '../' one level down.
export function renderOwnerPage(project, title, up, bodyHtml, { eyebrow = 'Owner command center', lede = 'Current decisions, accountable work, evidence and routing — projected from validated repository state.', metrics = '' } = {}) {
  const current = title === 'Overview' ? 'index.html' : title === 'Decisions' ? 'decisions.html' : title === 'Help desk' ? 'help-desk.html' : title === 'Seats and teams' ? 'seats.html' : '';
  const navLink = (href, label) => `<a href="${up}${href}"${current === href ? ' aria-current="page"' : ''}>${label}</a>`;
  const displayTitle = title === 'Overview' ? 'Review &amp; Approval Hub' : title;
  return [
    '<!DOCTYPE html>',
    '<!-- GENERATED by .agentops/tools/opsctl.mjs render — do not edit by hand. Deterministic projection of validated repository state. -->',
    `<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="ashenspire-owner-layout" content="${OWNER_PAGE_LAYOUT_ID}">`,
    `<title>${hubEsc(project.project_name)} — ${hubEsc(title)}</title>`,
    `<style>${OWNER_PAGE_CSS}</style></head><body class="owner-page" data-owner-layout="${OWNER_PAGE_LAYOUT_ID}">`,
    '<header class="hero">',
    '<div class="hero-topline"><span class="priority">P2</span><span class="divider"></span>',
    `<a class="hero-brand" href="${up}index.html">${hubEsc(project.project_name)} · Review &amp; Approval Hub</a><span class="muted">generated by <code>opsctl render</code></span></div>`,
    '<div class="hero-grid"><div>',
    `<p class="eyebrow">${hubEsc(eyebrow)}</p><h1>${hubEsc(displayTitle)}</h1><p class="lede">${hubEsc(lede)}</p>`,
    '</div><nav aria-label="Hub sections">',
    navLink('index.html', 'Overview'), navLink('decisions.html', 'Decisions'), navLink('help-desk.html', 'Help desk'), navLink('seats.html', 'Seats &amp; teams'),
    '</nav></div>',
    metrics,
    '</header><main>',
    bodyHtml,
    '</main><footer>Read-only projection. Repository contracts and ticket capsules remain authoritative; this interface is regenerated, not hand-maintained.</footer>',
    '</body></html>',
  ].join('\n');
}

export function renderHubSite(contracts, rt) {
  const project = contracts.project;
  const oi = contracts['owner-intent'];
  const tickets = Object.keys(rt.capsules).sort();
  const dispatch = computeDispatch(contracts, rt);
  const byTicket = new Map(dispatch.map((e) => [e.ticket, e]));
  const owner = oi.owner.actor_id;
  const issueBase = `${String(project.repository).replace(/\.git$/, '')}/issues/new`;
  const q = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const ownerDue = dispatch.filter((e) => e.kind === 'owner-decision');
  const blockedTickets = tickets.filter((t) => rt.capsules[t].blocker);
  const leases = activeRuntimeLeases(rt);
  const out = [];

  // --- Overview -------------------------------------------------------------
  {
    const L = [];
    L.push(`<details class="section-fold" id="needs-you"${ownerDue.length ? ' open' : ''}><summary class="fold-summary"><span class="fold-summary-copy"><span class="kicker">Owner decisions</span><strong>Needs you now</strong><span>${ownerDue.length ? `${ownerDue.length} decision${ownerDue.length === 1 ? '' : 's'} need your authority.` : `Nothing is waiting on ${hubEsc(owner)}.`}</span></span><span class="fold-toggle">${ownerDue.length ? 'Review' : 'Clear'}</span></summary><div class="section-content">`);
    if (!ownerDue.length) L.push(`<div class="notice"><p><strong>You are clear.</strong></p><p>${dispatch.length} item(s) are moving as seat work; no owner command is currently required.</p></div>`);
    else {
      L.push('<div class="card-grid">');
      for (const e of ownerDue) L.push(`<article class="mini-card"><p class="kicker">Decision required</p><h3>${hubEsc(e.ticket)}</h3><p>${hubEsc(e.reason)}</p><a class="button-link" href="tickets/${hubEsc(e.ticket)}.html">Review decision</a></article>`);
      L.push('</div>');
    }
    L.push('</div></details>');

    L.push(`<details class="section-fold" id="ticket-queue" open><summary class="fold-summary"><span class="fold-summary-copy"><span class="kicker">Current work</span><strong>Every ticket</strong><span>${tickets.length} validated work capsule${tickets.length === 1 ? '' : 's'}, each with one accountable seat.</span></span><span class="fold-toggle">Browse</span></summary><div class="section-content"><div class="ticket-list">`);
    for (const t of tickets) {
      const cap = rt.capsules[t];
      const d = byTicket.get(t);
      const stateClass = cap.blocker ? 'blocked' : ['resolved', 'released'].includes(cap.lifecycle_state) ? 'complete' : 'active';
      const wake = d ? d.wake : 'nobody';
      L.push(`<details class="ticket-card"><summary class="ticket-summary"><span class="ticket-id">${hubEsc(t)}</span><span class="ticket-title"><strong>${hubEsc(cap.objective)}</strong><small>${d ? hubEsc(d.reason) : 'No transition is currently due.'}</small></span><span class="ticket-seat">${hubEsc(cap.owner_actor)}<small>Wakes ${hubEsc(wake)}</small></span><span class="state-pill ${stateClass}">${hubEsc(cap.lifecycle_state)}</span></summary><div class="ticket-body"><div><p class="kicker">Next action</p><p>${hubEsc(cap.next_action)}</p></div><div class="ticket-actions"><a class="button-link" href="tickets/${hubEsc(t)}.html">Open ticket details</a><a class="button-link secondary" href="${d && d.kind === 'owner-decision' ? 'decisions.html' : 'seats.html'}">${d && d.kind === 'owner-decision' ? 'Review decision route' : 'View routing'}</a></div></div></details>`);
    }
    L.push('</div><p class="sub">Routing is derived by <code>opsctl dispatch</code>: blockers follow their declared escalation class; unblocked tickets wake whoever may advance the current state.</p></div></details>');
    const metrics = `<div class="truth-panel" aria-label="Current Hub totals"><a class="truth-button" href="#ticket-queue"><strong>${tickets.length}</strong><span>Tracked tickets</span><small>validated capsules</small></a><a class="truth-button" href="decisions.html"><strong>${ownerDue.length}</strong><span>Owner decisions</span><small>${ownerDue.length ? 'review now' : 'nothing waiting'}</small></a><a class="truth-button" href="seats.html"><strong>${leases.length}</strong><span>Writer seats</span><small>active leases</small></a><a class="truth-button blocker-metric" href="help-desk.html"><strong>${blockedTickets.length}</strong><span>Blockers</span><small>routed, not hidden</small></a></div>`;
    out.push({ rel: `${HUB_DIR}/index.html`, text: renderOwnerPage(project, 'Overview', '', L.join('\n'), { eyebrow: 'P2 · owner overview', lede: 'The familiar Hub presentation, now driven by validated AgentOps state so the design and the truth stay together.', metrics }) + '\n' });
  }

  // --- Decisions ------------------------------------------------------------
  {
    const L = [];
    L.push('<section><h2>Waiting on the owner</h2>');
    if (!ownerDue.length) L.push('<p class="none">No decision is pending on the current committed state.</p>');
    else {
      L.push('<div class="wrap"><table><tr><th>Ticket</th><th>Reason</th></tr>');
      for (const e of ownerDue) L.push(`<tr><td><a href="tickets/${hubEsc(e.ticket)}.html"><code>${hubEsc(e.ticket)}</code></a></td><td>${hubEsc(e.reason)}</td></tr>`);
      L.push('</table></div>');
    }
    L.push('</section>');

    L.push('<section><h2>File a decision</h2><div class="wrap"><table><tr><th>Ticket</th><th>State</th><th>Compare-and-swap hash</th><th></th></tr>');
    for (const t of tickets) {
      const cap = rt.capsules[t];
      const hash = computeCapsuleHash(cap);
      const link = `${issueBase}?${q({ template: 'owner-decision.yml', title: `[decision] ${t}`, target: t, hash })}`;
      L.push(`<tr><td><code>${hubEsc(t)}</code></td><td>${hubEsc(cap.lifecycle_state)}</td><td><code>${hubEsc(hash.slice(0, 23))}…</code></td><td><a href="${hubEsc(link)}">File →</a></td></tr>`);
    }
    L.push('</table></div>');
    L.push('<p class="sub">Each link carries the capsule’s live hash. A decision filed against a hash that has since moved is rejected as stale rather than applied to state you did not see, and only the owner’s own issues execute.</p></section>');

    const reserved = contracts['owner-command'].actions.filter((a) => a.protected).map((a) => a.id);
    L.push(`<section><h2>Protected — owner only</h2><p class="sub">${reserved.map((a) => `<span class="pill">${hubEsc(a)}</span>`).join(' ')}</p>`);
    L.push(`<p class="sub">${oi.protected_decision_classes.map(hubEsc).join(' · ')}</p></section>`);
    out.push({ rel: `${HUB_DIR}/decisions.html`, text: renderOwnerPage(project, 'Decisions', '', L.join('\n')) + '\n' });
  }

  // --- Seats ----------------------------------------------------------------
  {
    const L = [];
    L.push('<section><h2>Seats and their writer leases</h2><div class="wrap"><table><tr><th>Lease</th><th>Seat</th><th>Ticket</th><th>Ref</th><th>Paths</th><th>Expiry</th></tr>');
    for (const l of activeRuntimeLeases(rt)) {
      L.push(`<tr><td><code>${hubEsc(l.id)}</code></td><td>${hubEsc(l.actor)}</td><td><a href="tickets/${hubEsc(l.ticket)}.html"><code>${hubEsc(l.ticket)}</code></a></td><td><code>${hubEsc(l.ref)}</code></td><td>${l.path_globs.map((g) => `<code>${hubEsc(g)}</code>`).join(' ')}</td><td>${hubEsc(l.expiry)}</td></tr>`);
    }
    L.push('</table></div><p class="sub">One writer per overlapping path or ref. Collisions, undeclared refs and path grants a role was never given are rejected by <code>opsctl verify</code>.</p></section>');

    L.push('<section><h2>Escalation routing</h2><div class="wrap"><table><tr><th>Class</th><th>Route</th><th>Wakes</th><th>Work continues</th></tr>');
    for (const c of contracts.escalation.classes) {
      L.push(`<tr><td><code>${hubEsc(c.id)}</code></td><td>${c.route.map(hubEsc).join(' → ')}</td><td>${hubEsc(c.wake)}</td><td>${c.continuing_work_allowed ? 'yes' : '<span class="warn">no</span>'}</td></tr>`);
    }
    L.push('</table></div><p class="sub">A ticket names a class, never a wake target, so nothing can route itself to the owner to jump the queue or away from the owner to dodge a protected decision.</p></section>');
    if (contracts.teams) {
      const tm = contracts.teams;
      L.push('<section><h2>Standing coordination roles</h2><div class="wrap"><table><tr><th>Role</th><th>Standing responsibility</th><th>Boundary</th></tr>');
      for (const r of tm.standing_roles) L.push(`<tr><td><code>${hubEsc(r.id)}</code></td><td>${hubEsc(r.responsibility)}</td><td>${hubEsc(r.boundary)}</td></tr>`);
      L.push('</table></div></section>');
      L.push('<section><h2>Capability pools</h2>');
      L.push('<p class="sub">Not standing teams. They own no backlog, no decision stream and no source path, and validate rejects a capsule or lease that names one as its holder.</p>');
      L.push('<div class="wrap"><table><tr><th>Pool</th><th>Delivery capability</th><th>Stewardship between tickets</th></tr>');
      for (const p of tm.capability_pools) L.push(`<tr><td><code>${hubEsc(p.id)}</code></td><td>${hubEsc(p.delivery_capability)}</td><td>${hubEsc(p.stewardship)}</td></tr>`);
      L.push('</table></div></section>');
      const at = contracts.hierarchy && contracts.hierarchy.authority_tiers;
      if (at) {
        L.push('<section><h2>Authority tiers</h2>');
        L.push(`<p class="sub">${hubEsc(at.principle)}</p>`);
        if (at.disambiguation) {
          L.push(`<p class="sub"><strong>P-codes mean two things.</strong> ${hubEsc(at.disambiguation.rule)} `
            + `Authority: ${at.disambiguation.authority_subjects.map((x) => `<span class="pill">${hubEsc(x)}</span>`).join(' ')} · `
            + `Priority: ${at.disambiguation.priority_subjects.map((x) => `<span class="pill">${hubEsc(x)}</span>`).join(' ')}</p>`);
          L.push(`<p class="sub warn">${hubEsc(at.disambiguation.never)}</p>`);
        }
        L.push('<div class="wrap"><table><tr><th>Tier</th><th>Who</th><th>Holds</th><th>Cannot</th></tr>');
        for (const lv of at.levels) {
          L.push(`<tr><td><strong>P${lv.p}</strong><br><span class="sub">${hubEsc(lv.label)}</span></td>`
            + `<td>${lv.actors.map((a) => `<code>${hubEsc(a)}</code>`).join('<br>')}</td>`
            + `<td>${lv.holds.map(hubEsc).join('; ')}</td>`
            + `<td class="warn">${lv.cannot.map(hubEsc).join('; ')}</td></tr>`);
          if (lv.note) L.push(`<tr><td></td><td colspan="3" class="sub">${hubEsc(lv.note)}</td></tr>`);
        }
        L.push('</table></div>');
        L.push(`<p class="sub">${Object.values(at.rules).map(hubEsc).join(' · ')}</p></section>`);
      }
      const tf = contracts.escalation && contracts.escalation.ticket_flow;
      if (tf) {
        L.push('<section><h2>Where a question goes</h2>');
        L.push(`<p class="sub">${hubEsc(tf.principle)}</p>`);
        L.push('<div class="wrap"><table><tr><th>#</th><th>Actor</th><th>Does</th></tr>');
        for (const st of tf.steps) L.push(`<tr><td>${st.n}</td><td><code>${hubEsc(st.actor)}</code></td><td>${hubEsc(st.does)}</td></tr>`);
        L.push('</table></div>');
        L.push(`<p class="sub">Handoffs keep ${tf.handoff_events.map((e) => `<span class="pill">${hubEsc(e)}</span>`).join(' ')} distinct. ${hubEsc(tf.handoff_rule)}</p>`);
        L.push(`<p class="sub"><strong>${hubEsc(tf.owner_is_last_resort)}</strong></p></section>`);
      }
      const pg2 = contracts['promotion-gates'];
      if (pg2) {
        L.push('<section><h2>Promotion gates</h2>');
        L.push(`<p class="sub">${hubEsc(pg2.principle)}</p>`);
        L.push('<div class="wrap"><table><tr><th>Gate</th><th>Name</th><th>Who acts</th><th>Guards</th><th>Evidence</th><th>Grants</th></tr>');
        for (const g of pg2.gates) {
          const guards = (g.guards_transitions || []).map((t) => `<code>${hubEsc(t.from)}</code> → <code>${hubEsc(t.to)}</code>`).join('<br>') || '—';
          L.push(`<tr><td><strong>${hubEsc(g.id)}</strong></td><td>${hubEsc(g.name)}</td><td>${hubEsc(g.actor_role)}</td><td>${guards}</td><td>${g.required_evidence.map(hubEsc).join(', ') || '—'}</td><td>${g.grants.length ? g.grants.map(hubEsc).join(', ') : '<span class="none">nothing</span>'}</td></tr>`);
        }
        L.push(`</table></div><p class="sub">${hubEsc(pg2.immutable_candidate)}</p></section>`);
      }
      const ce = tm.charter_exception;
      L.push('<section><h2>When the charter cannot resolve it</h2>');
      L.push(`<p>${hubEsc(ce.principle)}</p>`);
      L.push(`<p class="sub">Concurrence required: ${ce.requires_concurrence.map((r) => `<span class="pill">${hubEsc(r)}</span>`).join(' ')} · escalates as <code>${hubEsc(ce.escalation_class)}</code> · records ${ce.records.map(hubEsc).join('; ')}.</p>`);
      L.push(`<p class="sub">Pods dissolve after ${hubEsc(tm.pods.dissolves_after)}; one lead and at most ${tm.pods.max_helpers} helpers. A pod's chat is never an authority source.</p></section>`);
    }
    out.push({ rel: `${HUB_DIR}/seats.html`, text: renderOwnerPage(project, 'Seats and teams', '', L.join('\n')) + '\n' });
  }

  // --- Help desk ------------------------------------------------------------
  {
    const L = [];
    L.push(`<section><h2>Raise something</h2><p><a href="${hubEsc(issueBase)}?${q({ template: 'help-desk-ticket.yml' })}">File a Help Desk ticket →</a></p>`);
    L.push('<p class="sub">Help Desk is the intake route. A ticket that turns out to need a protected decision escalates to the owner through the routing on the Seats page rather than being answered here.</p></section>');
    const blocked = tickets.filter((t) => rt.capsules[t].blocker);
    L.push('<section><h2>Open blockers</h2>');
    if (!blocked.length) L.push('<p class="none">Nothing is blocked.</p>');
    else {
      L.push('<div class="wrap"><table><tr><th>Ticket</th><th>Kind</th><th>Escalation class</th><th>Summary</th></tr>');
      for (const t of blocked) {
        const b = rt.capsules[t].blocker;
        L.push(`<tr><td><a href="tickets/${hubEsc(t)}.html"><code>${hubEsc(t)}</code></a></td><td>${hubEsc(b.kind)}</td><td><code>${hubEsc(b.escalation_class)}</code></td><td>${hubEsc(b.summary)}</td></tr>`);
      }
      L.push('</table></div>');
    }
    L.push('</section>');
    out.push({ rel: `${HUB_DIR}/help-desk.html`, text: renderOwnerPage(project, 'Help desk', '', L.join('\n')) + '\n' });
  }

  // --- One page per ticket --------------------------------------------------
  for (const t of tickets) {
    const cap = rt.capsules[t];
    const lease = rt.leases.find((l) => l.id === cap.writer_lease);
    const d = byTicket.get(t);
    const events = (rt.events && rt.events[t]) ? rt.events[t] : [];
    const L = [];

    L.push('<section><h2>Assignment</h2><dl>');
    const row = (k, v) => L.push(`<dt>${hubEsc(k)}</dt><dd>${v}</dd>`);
    row('Seat', hubEsc(cap.owner_actor));
    row('State', hubEsc(cap.lifecycle_state));
    row('Objective', hubEsc(cap.objective));
    row('Done when', hubEsc(cap.done_when));
    row('Next action', hubEsc(cap.next_action));
    row('Branch', `<code>${hubEsc(cap.ref)}</code>`);
    row('Base', `<code>${hubEsc(cap.base_oid.slice(0, 12))}</code>`);
    row('Revision', `${cap.revision} · seal <code>${hubEsc(String(cap.current_hash).slice(0, 23))}…</code>`);
    row('Succeeds', cap.parent_hash ? `<code>${hubEsc(cap.parent_hash.slice(0, 23))}…</code>` : '<span class="none">nothing (genesis)</span>');
    L.push('</dl></section>');

    L.push('<section><h2>Authority</h2><dl>');
    row('May', cap.authority.may.map((a) => `<span class="pill">${hubEsc(a)}</span>`).join(' '));
    row('Must not', cap.authority.must_not.map((a) => `<span class="pill">${hubEsc(a)}</span>`).join(' '));
    row('Expires', hubEsc(cap.authority.expiry));
    if (lease) {
      row('Writer lease', `<code>${hubEsc(lease.id)}</code> issued by ${hubEsc(lease.issuer)}`);
      row('Paths', lease.path_globs.map((g) => `<code>${hubEsc(g)}</code>`).join(' '));
    }
    L.push('</dl></section>');

    L.push('<section><h2>Status</h2>');
    if (cap.blocker) {
      L.push(`<p class="warn">Blocked — ${hubEsc(cap.blocker.kind)}, escalating as <code>${hubEsc(cap.blocker.escalation_class)}</code>.</p><p>${hubEsc(cap.blocker.summary)}</p>`);
    } else if (d) {
      L.push(`<p class="ok">Due: ${hubEsc(d.reason)} — waking ${hubEsc(d.wake)}.</p>`);
    } else {
      L.push('<p class="none">Nothing due; this ticket wakes nobody.</p>');
    }
    L.push('</section>');

    L.push('<section><h2>Event chain</h2>');
    if (!events.length) L.push('<p class="none">No events recorded.</p>');
    else {
      L.push('<ol class="chain">');
      for (const ev of [...events].sort((a, b) => a.seq - b.seq)) {
        L.push(`<li><code>${hubEsc(ev.id)}</code> · ${hubEsc(ev.kind)} · ${hubEsc(ev.actor)} · ${hubEsc(ev.at)}<br>${hubEsc(ev.summary)}</li>`);
      }
      L.push('</ol>');
    }
    L.push('<p class="sub">Append-only. The chain is what a clean clone replays to reconstruct this ticket with no other context.</p></section>');

    out.push({ rel: `${HUB_DIR}/tickets/${t}.html`, text: renderOwnerPage(project, t, '../', L.join('\n')) + '\n' });
  }

  return out;
}


// ---------------------------------------------------------------------------
// The tool's own header, kept honest.
//
// The docblock had drifted to 5 of 8 subcommands (issue #392, D8) and the one
// it omitted was `wake` — the command the cold-start bootstrap depends on. A
// header a cold seat reads to learn the interface is documentation the same
// way a capsule is: wrong is worse than absent. Pure over both texts, so a
// negative plant enters exactly where the live check does.
// ---------------------------------------------------------------------------
export function subcommandDocErrors(headerText, sourceText) {
  const dispatched = [...new Set([...sourceText.matchAll(/cmd === '([a-z-]+)'/g)].map((m) => m[1]))]
    // `selftest` is the bare alias of `--selftest`; documenting one covers both.
    .filter((c) => c !== 'selftest');
  const errors = [];
  for (const c of dispatched.sort()) {
    const token = c.startsWith('--') ? c : `//   ${c} `;
    const documented = c.startsWith('--')
      ? new RegExp(`^//\\s+${c}\\s`, 'm').test(headerText)
      : headerText.includes(token);
    if (!documented) errors.push(`opsctl header does not document dispatched subcommand '${c}'`);
  }
  return errors;
}

// The header is everything above the first non-comment line: the block a reader
// sees before any code.
export function opsctlHeader(sourceText) {
  const lines = sourceText.split('\n');
  const end = lines.findIndex((l) => l.trim() !== '' && !l.startsWith('//'));
  return lines.slice(0, end === -1 ? lines.length : end).join('\n');
}


// ---------------------------------------------------------------------------
// The Help Desk intake form, generated from the roster.
//
// Its team dropdown was the only place in the repository the thirteen team
// names existed (issue #392, D9), and it had already diverged from the charter:
// it offered names the charter calls legacy task names, and omitted pools the
// charter declares. Generating it means the form a person files a ticket into
// and the contract that routes it cannot disagree.
// ---------------------------------------------------------------------------
export function renderHelpDeskTemplate(contracts) {
  const tm = contracts.teams;
  // Legacy names stay selectable: open tickets and muscle memory both use them,
  // and the alias map is what turns one into a current owner.
  const options = ['unsure / route it', ...tm.legacy_aliases.map((a) => a.legacy).sort()];
  const L = [];
  L.push('# GENERATED by .agentops/tools/opsctl.mjs render — do not edit by hand.');
  L.push('# The team list is projected from .agentops/governance/teams.json so the');
  L.push('# intake form and the roster that routes it cannot diverge.');
  L.push('name: Help Desk ticket');
  L.push('description: File work for the Help Desk queue — a request, a bug, a blocker, or a question.');
  L.push('title: "[ticket] "');
  L.push('labels: ["help-desk"]');
  L.push('body:');
  L.push('  - type: markdown');
  L.push('    attributes:');
  L.push('      value: |');
  L.push('        Files a Help Desk ticket. This is **intake only** — it records and routes');
  L.push('        the request; it does not authorize any protected transition. Decisions');
  L.push('        that need owner authority go through the *Owner decision* form instead.');
  L.push('');
  L.push('  - type: dropdown');
  L.push('    id: kind');
  L.push('    attributes:');
  L.push('      label: Kind');
  L.push('      options:');
  for (const k of ['request — new work', 'bug — something is wrong', 'blocker — work is stopped', 'question — needs an answer', 'evidence — recording a result']) L.push(`        - ${k}`);
  L.push('    validations:');
  L.push('      required: true');
  L.push('');
  L.push('  - type: dropdown');
  L.push('    id: team');
  L.push('    attributes:');
  L.push('      label: Suggested team');
  L.push('      description: Best guess is fine; Help Desk routes it.');
  L.push('      options:');
  for (const o of options) L.push(`        - ${o}`);
  L.push('    validations:');
  L.push('      required: true');
  L.push('');
  L.push('  - type: textarea');
  L.push('    id: what');
  L.push('    attributes:');
  L.push('      label: What is needed');
  L.push('      description: What should be true when this is done.');
  L.push('    validations:');
  L.push('      required: true');
  L.push('');
  L.push('  - type: textarea');
  L.push('    id: evidence');
  L.push('    attributes:');
  L.push('      label: Evidence / where to look');
  L.push('      description: Screenshots, exact paths, commits, or a URL. Optional.');
  L.push('');
  L.push('  - type: dropdown');
  L.push('    id: urgency');
  L.push('    attributes:');
  L.push('      label: Urgency');
  L.push('      options:');
  for (const u of ['normal', 'blocking other work', 'needs owner attention']) L.push(`        - ${u}`);
  L.push('    validations:');
  L.push('      required: true');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// Runners.
// ---------------------------------------------------------------------------
const GENERATED_VIEW = 'generated/GOVERNANCE.md';
const RECON_DIR = 'generated/reconstruction';
const HUD_VIEW = 'generated/hud/index.html';
const MIGRATION_VIEW = 'generated/migration/PLAN.md';
const HELPDESK_VIEW = 'generated/intake/help-desk-ticket.yml';

// A contract that never reaches the human view is policy nobody reads. `verify`
// only proves the committed view matches what `render` emits — it cannot notice
// that render emits nothing for a whole contract. Five contracts were in exactly
// that state (delivery, model-effort, owner-command, transitions, migration),
// three of them since well before the tiers work.
//
// A first cut probed each contract's `principle` and skipped the six that state
// none. Codex was right that this proved nothing for those six: `renderGovernance`
// could drop the Roles or Authority matrix block entirely and `verify` would still
// pass. So every contract now names a probe, and every probe is drawn from the
// contract's OWN data rather than from a heading — a heading is prose this file
// could rename, while an actor id or a grant action cannot be renamed without
// changing the contract it came from.
//
// A probe value must also be UNIQUE to its block. `roles` first probed role ids,
// and dropping the whole Roles section did not fail: `owner`, `maker` and the
// rest still appeared in the hierarchy and authority tables. Probes therefore
// name text only their own section renders (a role's mission, a node's owned
// escalation classes), and probeStrengthErrors below proves each one still fails
// when its block is removed.
const VIEW_PROBES = {
  authority: (x) => x.grants.map((g) => `| ${g.action} | ${g.routine_owner_role} | ${g.scope} | ${g.protected ? 'yes' : 'no'} | ${g.required_evidence} |`),
  delegation: (x) => [x.non_amplification_rule, ...x.envelopes.map((e) => `| ${e.id} | ${e.parent_id || '\u2014'} | ${e.delegator_role} \u2192 ${e.delegatee_role} | ${e.delegated_actions.join(', ')} | ${e.scope_paths.map((g) => '\`' + mdCell(g) + '\`').join(', ') || '\u2014 (no path scope)'} | ${e.max_subdelegation_depth} | ${e.effective} \u2192 ${e.expiry} |`)],
  delivery: (x) => [x.principle, ...x.dev_delivery.all_must_pass_at_one_exact_head.map((cond) => `- ${cond}`), `Delivery to \`dev\` is held by \`${x.dev_delivery.actor_role}\``,
    `Desired Pages source: \`${x.pages.desired_source}\``,
    `a candidate already on \`${x.pages.switch_requires.candidate_must_have_reached}\``,
    `The promotion packet carries ${x.promotion_packet.required_fields.length} required fields`,
    ...x.promotion_packet.required_fields.map((f) => `- ${f}`),
    `Promotion readiness means: ${x.promotion_readiness.means} It does not mean: ${x.promotion_readiness.does_not_mean} These stay owner-exclusive whatever the packet says: ${x.promotion_readiness.owner_exclusive_actions.join(', ')}.`,
    `Delivery process: ${x.dev_delivery.process} ${x.dev_delivery.waiting_does_not_authorize}`,
    `A Pages switch is complete only when ${x.pages.complete_only_when.join(' and ')}. The switch packet records:`,
    ...x.pages.switch_packet_records.map((r) => `- ${r}`)],
  escalation: (x) => [x.principle, ...x.classes.map((cl) => `| ${cl.id} | ${cl.attempts_before_escalate} | ${cl.sla_minutes} | ${cl.route.join(' \u2192 ')} | ${cl.wake} | ${cl.authority_effect} | ${cl.continuing_work_allowed ? 'yes' : 'no'} |`), ...x.classes.map((cl) => `- \`${cl.id}\` \u2014 ${cl.hazard}`), x.ticket_flow.principle, x.ticket_flow.owner_is_last_resort, ...x.ticket_flow.handoff_events, x.ticket_flow.handoff_rule, ...x.ticket_flow.steps.map((st) => `| ${st.n} | \`${st.actor}\` | ${mdCell(st.does)} |`)],
  evidence: (x) => [x.principle, ...x.evidence.map((e) => `| ${e.id} | ${e.producer_role} | ${e.exact_object} | ${e.verifier_role} | ${e.invalidation_keys.join(', ')} | ${mdCell(e.freshness_rule)} |`)],
  'git-ownership': (x) => [x.principle, ...x.refs.map((r) => `| \`${r.ref}\` | ${r.owner_role} | ${r.mutation} |`), ...x.paths.map((pp) => `| \`${mdCell(pp.glob)}\` | ${pp.per_seat ? '\`per-seat\` \u2014 the ticket\u2019s lease' : pp.owner_role} | ${pp.serialized_lane} |`), x.branch_hygiene.principle, x.collision_rule, `Rewriting needs \`${x.branch_hygiene.permission_role}\` when ${x.branch_hygiene.rewrite_requires_permission_when}; absent that, ${x.branch_hygiene.alternative_when_permission_is_absent}.`, `Generated lane \`${x.generated_serialization.lane}\`: ${x.generated_serialization.rule}`, `Ledger lane \`${x.ledger_serialization.lane}\`, written solely by \`${x.ledger_serialization.writer}\`: ${x.ledger_serialization.rule}`, x.ledger_serialization.actor_rule, x.branch_hygiene.records.join(', '), x.branch_hygiene.never.join('; ')],
  hierarchy: (x) => [...x.nodes.map((n) => `| \`${n.actor_id}\` | ${n.role} | ${n.escalation_parent ? '\`' + n.escalation_parent + '\`' : '\u2014 (root)'} | ${n.owns_escalations.join(', ')} |`), x.authority_tiers.principle, x.authority_tiers.disambiguation.rule, ...Object.values(x.authority_tiers.rules), `Routing SLA: deputy custody at ${x.escalation_routing.deputy_custody_at_minutes} min`, x.escalation_routing.note, x.authority_tiers.namespace_note, x.authority_tiers.disambiguation.known_ambiguous_artifact, x.escalation_routing.immediate_owner_classes.join(', '), ...x.authority_tiers.levels.map((lv) => `| **P${lv.p}** ${lv.label} | ${lv.actors.map((a) => '\`' + a + '\`').join(', ')} | ${lv.holds.join('; ')} | ${lv.cannot.join('; ')} |`)],
  'information-access': (x) => [x.principle, ...x.canonical_documents.map((d) => `| ${d.topic} | \`${d.path}\` | ${d.superseded_paths.map((y) => '\`' + y + '\`').join(', ') || '\u2014'} | \`${d.decision}\` |`),
    `- **On demand:** ${x.on_demand.join('; ')}`, `- **Restricted:** ${x.restricted.join('; ')}`,
    `- **Forbidden (never loaded):** ${x.forbidden.join('; ')}`,
    `**Owner decision surfaces are the exception.** ${x.reporting.owner_decision_exception}`,
    `The packet shape is ${x.reporting.decision_packet.source}:`,
    ...x.reporting.decision_packet.parts.map((y) => `- ${y}`),
    x.reporting.decision_packet.open_question_is_a_failure,
    `- **Startup** (\u2264 ${x.max_startup_items}, target ${x.startup_token_target} / hard ${x.startup_token_hard_limit} tokens)`],
  retention: (x) => [x.principle, x.consolidation.rule, x.corrections_are_never_consolidated.rule,
    `Authority: \`${x.authority.actor_role}\`, from ${x.authority.source}.`,
    ...x.authority.preconditions.map((y) => `- ${y}`),
    `A \`${x.consolidation.kind}\` names ${x.consolidation.summary_must_name.join(', ')}, and covers at least ${x.consolidation.min_range} events.`,
    `**Never:** ${x.never.join('; ')}.`],
  directives: (x) => [x.principle, x.non_amplification, ...x.directives.map((d) => `| ${d.id} | \`${d.issued_by}\` | ${d.issued_at} | ${d.status}${d.superseded_by ? ' \u2192 \`' + d.superseded_by + '\`' : ''} | ${d.codified_in ? '\`' + d.codified_in + '.' + d.codified_as + '\`' : '\u2014 (nothing enforces it)'} | ${mdCell(d.text)} |`)],
  migration: (x) => [x.principle],
  'model-effort': (x) => [x.principle, x.assignment_record.format,
    `Selection stability: ${x.stability} Substitution: ${x.substitution}`,
    `Every assignment record carries: ${x.assignment_record.required_fields.join(', ')}.`, ...x.tiers.map((t) => `| ${t.risk_and_station} | \`${t.default_model}\` | ${t.allowed_efforts.join(', ')}${t.requires_exceptional_reason ? ' (needs a recorded exceptional reason)' : ''} | ${t.typical_work} |`)],
  'owner-command': (x) => [x.principle, ...x.actions.map((a) => `| ${a.id} | ${a.authenticator_roles.join(', ')} | ${a.requires_cas ? 'yes' : 'no'} | ${a.protected ? 'yes' : 'no'} | ${a.required_fields.map((f) => '\`' + f + '\`').join(', ')} | ${mdCell(a.affects)} |`)],
  'owner-intent': (x) => [x.mission, x.measurable_end_state, `- **Risk tolerance:** ${x.risk_tolerance}`, ...x.non_negotiable_invariants.map((i) => `  - ${i}`), ...x.priority_order.map((pr, i) => `  ${i + 1}. ${pr}`), x.owner.reserved_authority.join('; '), x.deputy.grant_summary,
    `  - Non-amplifying rule: \`${x.deputy.non_amplifying_rule}\``,
    ...x.deputy.included_actions.map((a) => `    - ${a}`), ...x.deputy.excluded_actions.map((a) => `    - ${a}`),
    `  - Grant window: effective \`${x.deputy.effective}\`, expiry \`${x.deputy.expiry}\`. ${x.deputy.supersession}`,
    `- **Default autonomy:** reversible local work is \`${x.default_autonomy.reversible_local_work}\`. ${x.default_autonomy.description}`,
    `  - Recording: ${x.override_rules.recording}`, `  - Invalidation: ${x.override_rules.invalidation}`,
    ...x.override_rules.forbidden.map((f) => `    - ${f}`)],
  project: (x) => [`Project: **${x.project_name}** \u2014 policy version`, `installed stage: \`${x.installed_stage}\``],
  'promotion-gates': (x) => [x.principle, x.immutable_candidate, ...x.gates.map((g) => gateDetailLines(g).length ? [`#### Gate ${g.id} \u2014 ${g.name}`, '', ...gateDetailLines(g)].join('\n') : null).filter((y) => y !== null), ...x.gates.map((g) => `| **${g.id}** | ${g.name} | \`${g.actor_role}\` | ${(g.guards_transitions || []).map((t) => '\`' + t.from + '\` \u2192 \`' + t.to + '\`').join('<br>') || '\u2014'} | ${g.required_evidence.join(', ') || '\u2014'} | ${g.grants.length ? g.grants.join(', ') : 'nothing'} |`)],
  qa: (x) => [x.principle, ...x.risk_classes.map((r) => `| ${r.id} | ${r.required_suites.join(', ')} | ${r.independent_qa ? 'yes' : 'no'} |`), ...x.gates.map((g) => `| ${g.id} | ${g.risk_class} | ${g.verifier_role} | ${g.independent_of_maker ? 'yes' : 'no'} | ${g.required_checks.join(', ')} | ${g.waiver_authority_role} | ${g.required_evidence.join(', ')} |`)],
  raci: (x) => [x.principle, ...x.items.map((i) => `| ${i.id} | ${i.kind} | ${i.responsible.join(', ')} | ${i.accountable.join(', ')} | ${i.consulted.join(', ') || '\u2014'} | ${i.informed.join(', ') || '\u2014'} |`)],
  roles: (x) => x.roles.map((r) => [
    '### `' + r.role + '`',
    '',
    `- **Mission:** ${r.mission}`,
    r.display_name ? `- **Seat:** ${mdCell(r.display_name)}` : null,
    r.archetype ? `- **Derives from:** \`${r.archetype}\` \u2014 a seniority level, carrying exactly that archetype's authority and no more.` : null,
    `- **May:** ${r.may.join(', ') || '\u2014'}`,
    `- **Must:** ${r.must.join('; ') || '\u2014'}`,
    `- **Must not:** ${r.must_not.join(', ') || '\u2014'}`,
    `- **Approval ceiling:** ${r.approval_ceiling}`,
  ].filter((l) => l !== null).join('\n')),
  teams: (x) => [x.principle, x.pool_rules.note, `Idle capacity: ${x.wip_limits.idle_capacity}`, ...x.legacy_aliases.map((a) => `| \`${mdCell(a.legacy)}\` | \`${mdCell(a.routes_to)}\` | ${mdCell(a.note)} |`), x.team_leads.spins_out, ...x.standing_roles.map((r) => `| \`${r.id}\` | ${r.responsibility} | ${r.boundary} |`), ...x.capability_pools.map((pp) => `| \`${pp.id}\` | ${pp.delivery_capability} | ${pp.stewardship} |`), x.charter_exception.principle, x.team_leads.principle, x.team_leads.identity_rule, ...x.team_leads.leads.map((l) => `| \`${l.team}\` | \`${l.actor_id}\` | ${mdCell(l.seat_name)} |`), x.naming_convention.principle, x.naming_convention.not_the_tier_namespace, `- Persistent team lead: \`${x.naming_convention.persistent_lead}\``, `- Agent seat it spins out: \`${x.naming_convention.agent_seat}\``, `- Persistent display name: \`${x.naming_convention.display_name_persistent}\``, `- Agent display name: \`${x.naming_convention.display_name_agent}\``, x.naming_convention.display_name_is_not_the_seat_name, x.naming_convention.display_name_kind_is_not_a_choice],
  transitions: (x) => [x.principle, `States: ${x.states.map((st) => '\`' + st + '\`').join(' \u2192 ')}`, `Protected states: ${x.protected_states.map((st) => '\`' + st + '\`').join(', ')}`, ...x.transitions.map((t) => `| ${t.from} | ${t.to} | ${t.guard} | ${t.permitted_actor_roles.join(', ')} | ${t.protected ? 'yes' : 'no'} |`), x.legacy_rule, ...(x.legacy_values || []).map((lv) => `| \`${mdCell(lv.legacy)}\` | ${mdCell(lv.canonical_treatment)} |`)],
};

// Every contract's rules render in the Enforced invariants section, so every
// probe carries its own rule lines. Doing it here rather than in twelve edited
// probe entries means a rule added to a contract tomorrow is probed the same
// day: it must appear in the view or the coverage gate fails.
for (const [k, fn] of Object.entries(VIEW_PROBES)) {
  VIEW_PROBES[k] = (x) => {
    const rules = ruleLines(x);
    // The per-contract heading is rendered only when that contract has rules,
    // so it is probed only then. Static prose with no contract behind it is not
    // added to this view: the projection disclaimer stays the single exemption
    // the prose sweep allows.
    return rules.length ? [...fn(x), `**\`${k}\`**`, ...rules] : fn(x);
  };
}

// A probe value shared by two contracts lets one mask the other: the masked
// contract's block can vanish while its values still appear, rendered by the
// other. That is exactly how `roles` first slipped through. Probe sets must
// therefore be disjoint, and this is checked alongside coverage rather than
// left to a reviewer to notice.
// `runRender` reports two independent failures — `errors` (the view is wrong)
// and `drift` (the committed copy is stale) — and every caller must read both.
// Reading only `drift` is how the coverage gate stayed invisible in `verify`,
// and then, after that was fixed, in `verifyErrors`, where the drill could
// report a clean reconstruction of a tree `verify` rejects. Two call sites, the
// same one-line omission, found weeks apart. This is a source-level check for
// the class, in the same spirit as the subcommand-header check: it reads this
// file and requires each call site to mention both fields.
// Blanks out comments and string/template literals, preserving length so byte
// offsets and line numbers still line up. Source-level checks that skip this
// match their own error messages: the first version of the call-shape sweep
// reported seven "call sites" that were all its own text.
// Known limitation: this does not parse regex literals, so a backtick inside
// one (`/^\x60\x60\x60/`) would be read as a template-literal opener and blank the
// rest of the file. That happened, silently disabling the consumer check until
// a plant that should have failed did not. Regex literals in this file avoid
// literal backticks, and countRenderCallSites below refuses to let the blanking
// swallow the source unnoticed.
export function blankNonCode(src) {
  const out = src.split('');
  let i = 0;
  const blank = (from, to) => { for (let k = from; k < to && k < out.length; k++) if (out[k] !== '\n') out[k] = ' '; };
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { let j = src.indexOf('\n', i); if (j < 0) j = src.length; blank(i, j); i = j; continue; }
    if (c === '/' && d === '*') { let j = src.indexOf('*/', i + 2); j = j < 0 ? src.length : j + 2; blank(i, j); i = j; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === c) { j++; break; }
        j++;
      }
      blank(i, j); i = j; continue;
    }
    i++;
  }
  return out.join('');
}

// A cheap canary on blankNonCode: if the blanking ever eats the file, every
// call site disappears and this drops to zero rather than reporting success.
export function countRenderCallSites(rawSource) {
  return (blankNonCode(rawSource).match(/runRender\s*\(/g) || []).length;
}

export function renderResultConsumerErrors(rawSource) {
  const errors = [];
  // Comments and string literals are not call sites. Scanning them made this
  // check report its own error messages as violations.
  const sourceText = blankNonCode(rawSource);
  const lines = sourceText.split('\n');
  const lineOf = (idx) => sourceText.slice(0, idx).split('\n').length;

  // Both failure modes. Checking only `errors` was the same omission this
  // function exists to catch, one level up.
  const MODES = [
    ['errors', 'a view failure'],
    ['drift', 'a stale committed artifact'],
  ];
  // Scanning line by line missed `const r =` with the call on the next line, so
  // ordinary multiline formatting silently exempted a caller — and because the
  // one-line callers still matched, the "no call sites" guard stayed quiet too.
  // The pattern spans newlines and the line number comes from the offset.
  const DECL = /(?:const|let)\s+(?:\{([^}]*)\}|(\w+))\s*=\s*(?:\r?\n\s*)?runRender\s*\(/g;

  const inspected = [];
  for (const m of sourceText.matchAll(DECL)) {
    inspected.push(m.index + m[0].length);
    const i = lineOf(m.index) - 1;
    if (m[1] !== undefined) {                       // destructured at the call site
      const named = m[1].split(',').map((x) => x.trim().split(':')[0].trim());
      for (const [field, what] of MODES) {
        if (!named.includes(field)) errors.push(`line ${i + 1}: destructures runRender() without '${field}'; ${what} would be silently dropped`);
      }
      continue;
    }
    const v = m[2];
    const window = lines.slice(i, i + 12).join('\n');
    for (const [field, what] of MODES) {
      if (!window.includes(`${v}.${field}`)) errors.push(`line ${i + 1}: reads runRender() result '${v}' without checking '${v}.${field}'; ${what} would be silently dropped`);
    }
  }

  // Every remaining call is a shape this check cannot reason about — a bare
  // call, a return, a property assignment — and silence about it would be the
  // same fail-open the check exists to close. The declaration itself is skipped.
  for (const m of sourceText.matchAll(/runRender\s*\(/g)) {
    const declHere = /function\s+$/.test(sourceText.slice(Math.max(0, m.index - 20), m.index));
    if (declHere) continue;
    const covered = inspected.some((end) => Math.abs(end - (m.index + m[0].length)) < 2);
    if (!covered) errors.push(`line ${lineOf(m.index)}: runRender() is called in a shape this check cannot inspect; bind it to a name or a destructure so both failure modes can be verified`);
  }

  if (!/runRender\s*\(/.test(sourceText)) errors.push('no runRender() call sites found; the consumer check is looking at the wrong source');
  return errors;
}

// The whole governance gate over a rendered artifact list, extracted so the
// absent-view case can be exercised rather than asserted about. `if (gov)` used
// to skip the gate entirely when generatedArtifacts stopped registering the
// view, and the drift loop walks the same list so it could not report it
// either — the human view could be abandoned with `verify` still green.
export function governanceGateErrors(contracts, arts) {
  const gov = arts.find((a) => a.rel === GENERATED_VIEW);
  if (!gov) return [`generated artifacts do not include '${GENERATED_VIEW}'; the human governance view is missing and nothing downstream can check it`];
  return [...tableShapeErrors(gov.text), ...probeStrengthErrors(contracts, gov.text), ...viewCoverageErrors(contracts, gov.text)];
}

// An actor is not its role. That held only while every actor_id happened to
// equal a role name; team leads are the first actors where it does not, and the
// conflation was independently present in four places — the stranded-seat
// check, the capsule authority check, dispatch's wake selection, and the wake
// capsule's own IDENTITY line, which printed `role=<actor id>`. One helper
// instead of four fixes, so the fifth site cannot drift.
export function actorRole(g, actorId) {
  const node = g && g.hierarchy && g.hierarchy.nodes.find((n) => n.actor_id === actorId);
  return node ? node.role : actorId;
}

// The sweeps prove that nothing RENDERED can be deleted unnoticed. They cannot
// see a contract field that renders nowhere at all — there is no line to delete
// — and an audit found 105 such field paths across every generated view, in all
// eighteen contracts. Two were reported (delegation scope_paths, qa
// required_checks); the rest had never been looked for.
//
// Rendering all of them is a larger change than this branch should carry, so
// the debt is measured instead of hidden: this returns the count, and a ratchet
// in the selftest refuses to let it grow. The number may fall; it may not rise.
export function unrenderedFieldPaths(contracts, renderedText) {
  const SKIP = new Set(['schema', 'policy_version', 'source', 'charter_heading']);
  const found = [];
  const walk = (name, node, path) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) return node.forEach((v) => walk(name, v, path));
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) if (!SKIP.has(k)) walk(name, v, path ? `${path}.${k}` : k);
      return;
    }
    if (typeof node === 'boolean') return;
    const value = String(node);
    if (value.length < 3) return;                    // ids too short to be evidence
    // A value that renders correctly through mdCell appears ESCAPED, so a raw
    // substring test reported the nine lead seat names as unrendered precisely
    // because they were rendered properly. Both forms count.
    if (!renderedText.includes(value) && !renderedText.includes(mdCell(value))) found.push(`${name}.${path}`);
  };
  for (const [name, contract] of Object.entries(contracts)) walk(name, contract, '');
  return [...new Set(found)].sort();
}

// Contract values go into Markdown tables, and a value containing `|` or a
// newline silently becomes extra cells or extra rows. Fixed once for seat names
// and reintroduced one commit later in delegation scope paths, so this is the
// shared helper and tableShapeErrors below is the structural guard: a row whose
// cell count differs from its header cannot be rendered unnoticed, whatever
// field it came from.
export function mdCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

// One gate's detail block. The gates table carries id, name, actor, guarded
// transitions, required evidence and grants; every OTHER field a gate declares
// rendered nowhere — entry conditions, what invalidates the gate, what blocks
// it, what does not satisfy it, what happens on fail or unknown, the roles it
// conditionally requires. Nine field paths, all authority-bearing, all
// invisible. Shared by the renderer and the probe, like ruleLines and mdCell,
// so the two cannot drift. Fields the table already renders are deliberately
// absent here: a probe satisfied in two sections proves nothing about either.
const GATE_DETAIL = [
  ['entry', 'Entry'],
  ['required_roles', 'Required roles'],
  ['conditional_roles', 'Conditional roles'],
  ['blocks_on', 'Blocks on'],
  ['not_satisfied_by', 'Not satisfied by'],
  ['invalidated_by', 'Invalidated by'],
  ['on_fail_or_unknown', 'On fail or unknown'],
  ['returns_to_gate_on_correction', 'Returns to gate on correction'],
  ['separate_actions', 'Separate actions'],
  ['explicitly_not_granted', 'Explicitly not granted'],
  ['authority_is_per_action', 'Authority is per action'],
  ['note', 'Note'],
];

export function gateDetailLines(gate) {
  const out = [];
  for (const [key, label] of GATE_DETAIL) {
    const v = gate[key];
    if (v === undefined || v === null) continue;
    if (key === 'conditional_roles') {
      for (const cr of v) out.push(`- **${label}:** \`${cr.role}\` \u2014 ${cr.when}`);
      continue;
    }
    const text = Array.isArray(v) ? v.map((y) => `\`${y}\``).join(', ') : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v);
    out.push(`- **${label}:** ${text}`);
  }
  return out;
}

// The rendered form of one contract's `rules` block. Shared by the renderer and
// by the view probes for the same reason mdCell is: two copies of a rendered
// string drift, and a probe that drifts stops proving anything.
export function ruleLines(contract) {
  const r = contract && contract.rules;
  if (!r || typeof r !== 'object' || Array.isArray(r)) return [];
  return Object.entries(r).filter(([, v]) => typeof v === 'string').map(([n, v]) => `- \`${n}\` \u2014 ${v}`);
}

export function tableShapeErrors(viewText) {
  const errors = [];
  const lines = viewText.split('\n');
  const cells = (l) => l.split(/(?<!\\)\|/).length;
  for (let i = 0; i < lines.length; i++) {
    if (!/^\|---/.test(lines[i])) continue;          // a separator anchors a table
    const width = cells(lines[i]);
    for (let j = i - 1; j >= 0 && /^\|/.test(lines[j]); j--) {
      if (cells(lines[j]) !== width) errors.push(`generated view line ${j + 1}: header has ${cells(lines[j]) - 2} cells but the table declares ${width - 2}`);
    }
    for (let j = i + 1; j < lines.length && /^\|/.test(lines[j]); j++) {
      if (cells(lines[j]) !== width) errors.push(`generated view line ${j + 1}: row has ${cells(lines[j]) - 2} cells, the table declares ${width - 2}; an unescaped '|' in a contract value splits the row`);
    }
  }
  return errors;
}

export function probeStrengthErrors(contracts, viewText) {
  const errors = [];
  const seen = new Map();
  for (const name of Object.keys(contracts).sort()) {
    const probe = VIEW_PROBES[name];
    if (!probe) continue;                       // viewCoverageErrors reports this
    let needles = [];
    try { needles = probe(contracts[name]).filter((n) => typeof n === 'string' && n.length); } catch { continue; }
    for (const n of needles) {
      if (seen.has(n) && seen.get(n) !== name) {
        errors.push(`view probe ${JSON.stringify(n.slice(0, 60))} is claimed by both '${seen.get(n)}' and '${name}'; a shared probe lets one contract mask the other`);
      } else seen.set(n, name);
    }
  }
  // Comparing the declared sets to each other was not enough: a probe value can
  // also appear in another section's rendered prose without being that
  // section's declared probe, and then deleting the row it came from changes
  // nothing the gate can see. `record-triage-route-report-status` was an
  // authority row and also a line in the Roles `may` list, so the row could be
  // dropped with `verify` green. Probes are therefore checked against the
  // rendered view too: a probe must identify one place in it.
  if (typeof viewText === 'string' && viewText.length) {
    const lines = viewText.split('\n');
    const heads = [];
    lines.forEach((l, i) => { if (/^#{2,3} /.test(l)) heads.push(i); });
    const sectionOf = (idx) => {
      let last = 'preamble';
      for (const h of heads) { if (h <= idx) last = lines[h]; else break; }
      return last;
    };
    for (const [needle, owner] of seen) {
      const hit = new Set();
      lines.forEach((l, i) => { if (l.includes(needle)) hit.add(sectionOf(i)); });
      if (hit.size > 1) {
        errors.push(`view probe ${JSON.stringify(needle.slice(0, 60))} for '${owner}' appears in ${hit.size} rendered sections (${[...hit].join(' / ')}); deleting any one of them leaves the probe satisfied`);
      }
    }
  }
  return errors;
}

export function viewCoverageErrors(contracts, viewText) {
  const errors = [];
  for (const name of Object.keys(contracts).sort()) {
    const probe = VIEW_PROBES[name];
    // No opt-out. A new contract with no probe is the same silent gap this check
    // exists to close, so its absence is itself the failure.
    if (!probe) { errors.push(`contract '${name}' declares no view probe; add one to VIEW_PROBES so its projection is provable`); continue; }
    let needles;
    try { needles = probe(contracts[name]).filter((n) => typeof n === 'string' && n.length); }
    catch (e) { errors.push(`view probe for '${name}' could not read the contract: ${e && e.message || e}`); continue; }
    if (!needles.length) { errors.push(`view probe for '${name}' yielded nothing to look for`); continue; }
    const missing = needles.filter((n) => !viewText.includes(n));
    if (missing.length === needles.length) {
      errors.push(`generated view omits the '${name}' contract entirely; none of its ${needles.length} probe value(s) appear`);
    } else if (missing.length) {
      errors.push(`generated view drops ${missing.length} of ${needles.length} '${name}' probe value(s), first: ${JSON.stringify(missing[0].slice(0, 80))}`);
    }
  }
  return errors;
}

// Every committed generated artifact, as {rel, text}. These are the sole
// writes of `render` and the drift gate of `verify`. Frozen wake goldens make
// reconstruction output part of the committed, deterministic surface: any clean
// clone on any provider must reproduce them byte-for-byte.
export function generatedArtifacts(contracts, rt) {
  const out = [{ rel: GENERATED_VIEW, text: renderGovernance(contracts) + '\n' }];
  for (const ticket of Object.keys(rt.capsules).sort()) {
    const cap = buildCapsule(contracts, rt, ticket, { frozen: true });
    if (cap.errors && cap.errors.length) continue;
    out.push({ rel: `${RECON_DIR}/${ticket}.wake.txt`, text: cap.text + '\n' });
  }
  out.push({ rel: HUD_VIEW, text: renderHud(contracts, rt) + '\n' });
  out.push(...renderHubSite(contracts, rt));
  if (contracts.teams) out.push({ rel: HELPDESK_VIEW, text: renderHelpDeskTemplate(contracts) + '\n' });
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

// Published mirrors. The repository serves its own tree, so the generated HUD
// and Hub need a copy at a tidy URL outside .agentops/. Keeping these as a
// hand-run `cp` drifted twice in one session, both times caught only by a test
// telling a human to go and copy a file; render now writes them itself.
//
// They are deliberately NOT generatedArtifacts: those are resolved against
// `root`, and the reconstruction drill reconstructs from a copy of .agentops
// alone, where a path outside it cannot exist. A mirror is therefore written
// only when its destination tree is actually present.
const MIRRORS = [
  { from: HUD_VIEW, to: '../hud/index.html' },
  { from: `${HUB_DIR}/`, to: '../review-approval-hub/' },
  { from: HELPDESK_VIEW, to: '../.github/ISSUE_TEMPLATE/help-desk-ticket.yml' },
];

function mirrorTargets(root, arts) {
  const out = [];
  for (const m of MIRRORS) {
    const destRoot = resolve(root, m.to);
    // The published tree itself must already exist. Testing its PARENT instead
    // was wrong for a directory mirror: the parent is the repository root,
    // which exists in the drill's .agentops-only clean room too, so verify
    // there demanded a review-approval-hub/ that a clean room never has. Both
    // published trees are committed, so a real checkout always has them; a
    // clean room has neither and mirrors nothing.
    const publishedTree = m.from.endsWith('/') ? destRoot : dirname(destRoot);
    if (!existsSync(publishedTree)) continue;
    if (m.from.endsWith('/')) {
      for (const a of arts.filter((x) => x.rel.startsWith(m.from))) {
        out.push({ rel: a.rel, target: resolve(destRoot, a.rel.slice(m.from.length)), text: a.text });
      }
    } else {
      const a = arts.find((x) => x.rel === m.from);
      if (a) out.push({ rel: a.rel, target: destRoot, text: a.text });
    }
  }
  return out;
}

function runRender(root, check) {
  const { contracts, errors } = runValidate(root);
  if (errors.length) return { errors, drift: false };
  const rt = loadRuntime(root);
  const arts = generatedArtifacts(contracts, rt);
  // A missing governance artifact must fail, not skip. `if (gov)` meant that if
  // generatedArtifacts ever stopped registering the view, the coverage gate was
  // silently bypassed and the drift loop could not report it either — it walks
  // the same shortened list. The whole point of this gate is that the human view
  // cannot quietly disappear, so its absence is the loudest case, not an
  // optional one.
  const missed = governanceGateErrors(contracts, arts);
  if (missed.length) return { errors: missed, drift: false };
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
  for (const m of mirrorTargets(root, arts)) {
    if (check) {
      let current = null;
      try { current = readFileSync(m.target, 'utf8'); } catch { /* missing */ }
      if (current !== m.text) drifted.push(`${m.rel} (published mirror)`);
    } else {
      mkdirSync(dirname(m.target), { recursive: true });
      writeFileSync(m.target, m.text);
      wrote.push(`${m.rel} -> mirror`);
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
  // runRender reports two independent failures and the drill must see both. It
  // read only `drift`, so a working tree failing the coverage gate could still
  // be reported as reconstructing cleanly: the clean room is archived from HEAD,
  // which is still valid, while `opsctl verify` fails on the same tree.
  if (r.errors && r.errors.length) return r.errors;
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

  // D6 (issue #392): the drill proves render determinism, and its one-line
  // verdict was read as proving continuity. It printed "zero evidence loss"
  // for a fleet where every seat's own wake said `re-seat before mutating`.
  // The goldens are deliberately frozen — a golden must be deterministic — so
  // staleness cannot show up there. It is reported here instead: non-fatal,
  // because a stale base is not evidence loss, but never invisible again.
  const stale = [];
  const head = currentHead(root);
  let total = 0;
  if (head) {
    const rtNow = loadRuntime(root);
    total = Object.keys(rtNow.capsules).length;
    for (const t of Object.keys(rtNow.capsules).sort()) {
      const cap = rtNow.capsules[t];
      // A capsule tracking a branch has no pinned value to fall behind, so it is
      // not stale — that is the point of ruling AS-HD-029-0052's pointer. An
      // UNRESOLVABLE pointer is a different matter and wake reports it.
      if (cap.base_ref) continue;
      if (cap.base_oid !== head) stale.push({ ticket: t, base: cap.base_oid, state: cap.lifecycle_state });
    }
  }

  const ok = steps.every((s) => s.ok);
  return { ok, steps, stale, head, total };
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
  expectSemantic('overlapping root-level writers', (c) => { c['git-ownership'].paths.push({ glob: 'index.html', owner_role: 'it-support', serialized_lane: 'x' }); }, 'overlapping paths');
  expectSemantic('a root glob colliding with a root file', (c) => { c['git-ownership'].paths.push({ glob: 'buildordinal.*', owner_role: 'help-desk', serialized_lane: 'x' }); }, 'overlapping paths');
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
  // A shape-valid timestamp that is not a real instant. Both of these pass the
  // schema pattern; `new Date()` normalises the first to March 2 and the second
  // to the next day, so the window would validate and render while meaning a
  // moment it does not spell.
  expectSemantic('delegation window naming a day that does not exist', (c) => { c.delegation.envelopes[0].effective = '2026-02-30T00:00:00Z'; }, "is not a real instant");
  expectSemantic('delegation window naming an hour that does not exist', (c) => { c.delegation.envelopes[0].expiry = '2026-12-31T25:00:00Z'; }, "is not a real instant");
  // ...and the ordering check must not be fooled by them either: 2026-02-30
  // normalises to March 2, which is AFTER the March 1 expiry it is compared
  // against, so a lexicographic '<=' saw a valid window here.
  expectSemantic('delegation window ordered only after normalisation', (c) => { const e = c.delegation.envelopes[0]; e.effective = '2026-02-30T00:00:00Z'; e.expiry = '2026-03-01T00:00:00Z'; }, "is not a real instant");
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
  expectRuntime('lease window naming a day that does not exist', (rt) => { rt.leases[0].expiry = '2026-11-31T00:00:00Z'; }, "is not a real instant");
  expectRuntime('lease issued at a minute that does not exist', (rt) => { rt.leases[0].issued = '2026-01-01T00:60:00Z'; }, "is not a real instant");
  // Ruling AS-HD-029-0052 point 3. Both directions: an event recorded after the
  // ruling under a seat's actor must fail, and the 423 recorded before it must
  // not — they are permanent under an append-only ledger and rewriting them is
  // a protected transition.
  expectRuntime('a reseat signed with a seat actor after the ruling', (rt) => {
    const list = rt.events['AS-HD-040'];
    const last = list[list.length - 1];
    list.push({ ...last, id: 'AS-HD-040-9001', seq: last.seq + 1, parent_event: last.id, actor: 'maker', at: '2026-09-01T00:00:00Z', summary: 'Reseated from aaaaaaaaaaaa to live HEAD bbbbbbbbbbbb; the seat had not started.' });
  }, 'no seat performed it');
  {
    const rt = baseRt();
    const list = rt.events['AS-HD-040'];
    const last = list[list.length - 1];
    list.push({ ...last, id: 'AS-HD-040-9002', seq: last.seq + 1, parent_event: last.id, actor: TOOL_ACTOR, at: '2026-09-01T00:00:00Z', summary: 'Reseated from aaaaaaaaaaaa to live HEAD bbbbbbbbbbbb; the seat had not started.' });
    const errs = runtimeChecks(contracts, rt).filter((e) => e.includes('no seat performed it'));
    results.push({ label: 'the same reseat signed by the process itself passes', pass: errs.length === 0, errs });
  }
  results.push({ label: 'the historical reseats predating the ruling are not retroactively failed', pass: runtimeChecks(contracts, baseRt()).filter((e) => e.includes('no seat performed it')).length === 0, errs: [] });
  // ...and the default that caused it is gone at the source, not merely unused.
  {
    const self = readFileSync(resolve(ROOT, 'tools/opsctl.mjs'), 'utf8');
    results.push({ label: 'reseat no longer defaults its actor to the seat', pass: !/actor:\s*actor \|\| cap\.owner_actor/.test(self), errs: [] });
    const sweepName = 'runReseat' + 'All';
    results.push({ label: 'the reseat sweep is gone, not merely undocumented', pass: !new RegExp('function ' + sweepName).test(self), errs: [] });
  }

  // Ruling AS-HD-029-0052 point 2. The pointer is only safe because it freezes
  // when work starts; every way of loosening that is planted.
  expectRuntime('a started capsule still tracking a branch', (rt) => {
    const cap = Object.values(rt.capsules).find((c) => !RESEATABLE.has(c.lifecycle_state));
    cap.base_ref = 'dev';
  }, 'work stands on a tree, so the base freezes');
  expectRuntime('a commit id recorded as a tracking pointer', (rt) => {
    const cap = Object.values(rt.capsules).find((c) => RESEATABLE.has(c.lifecycle_state));
    cap.base_ref = 'a72cac9611df';
  }, 'a pinned value recorded as a pointer is neither');
  expectRuntime('a tracking pointer that is not a branch name', (rt) => {
    const cap = Object.values(rt.capsules).find((c) => RESEATABLE.has(c.lifecycle_state));
    cap.base_ref = 'dev^{tree}';
  }, 'is not a valid git branch name');
  {
    // ...and the pointer actually removes the staleness it was ruled against:
    // an unstarted capsule tracking a branch reads as tracking, not STALE.
    const rt = baseRt();
    const t = Object.keys(rt.capsules).find((k) => RESEATABLE.has(rt.capsules[k].lifecycle_state));
    rt.capsules[t].base_ref = 'dev';
    const built = buildCapsule(contracts, rt, t, { head: 'ffffffffffffffffffffffffffffffffffffffff', root });
    const line = (built.text || '').split('\n').find((l) => l.startsWith('FRESHNESS'));
    results.push({ label: 'an unstarted capsule tracking a branch never reads STALE', pass: !!line && !line.includes('STALE'), errs: [String(line)] });
    const frozenBuilt = buildCapsule(contracts, rt, t, { frozen: true, root });
    const fline = (frozenBuilt.text || '').split('\n').find((l) => l.startsWith('FRESHNESS'));
    results.push({ label: 'a tracking capsule reconstructs deterministically when frozen', pass: !!fline && fline.includes('as recorded'), errs: [String(fline)] });
    // ...and a pointer this checkout cannot resolve is reported, not silently
    // treated as a base.
    rt.capsules[t].base_ref = 'no-such-branch-anywhere';
    const missing = buildCapsule(contracts, rt, t, { head: 'ffffffffffffffffffffffffffffffffffffffff', root });
    const mline = (missing.text || '').split('\n').find((l) => l.startsWith('FRESHNESS'));
    results.push({ label: 'an unresolvable tracking pointer is reported, not assumed', pass: !!mline && mline.includes('UNRESOLVABLE'), errs: [String(mline)] });
  }

  // Codex finding: a hand-rolled character filter is not git's branch-name rule.
  for (const badName of ['dev..bad', 'foo//bar', 'trailing/', '-lead', '.hidden', 'a.lock']) {
    expectRuntime(`a base_ref git would reject: ${badName}`, (rt) => {
      const cap = Object.values(rt.capsules).find((c) => RESEATABLE.has(c.lifecycle_state));
      cap.base_ref = badName;
    }, 'not a valid git branch name');
  }
  {
    // Codex finding: while tracking, the resolved commit is the effective base.
    // A capsule that says follow the branch and then names a different commit —
    // or tells the seat to stop because its base moved — defeats the pointer.
    const rt = baseRt();
    const t = Object.keys(rt.capsules).find((k) => RESEATABLE.has(rt.capsules[k].lifecycle_state));
    const branch = anyLocalBranch(root);
    // Visible, not silent: these four assertions need a branch that resolves,
    // and a CI pull-request checkout carries none. A block that quietly stops
    // running is the failure mode this file has already been bitten by twice, so
    // the skip is itself a reported result.
    results.push({ label: 'tracking-capsule assertions ' + (branch ? 'ran against ' + branch : 'skipped — this checkout carries no local branch to resolve'), pass: true, errs: [] });
    if (branch) {
      const resolved = resolveRef(root, branch);
      rt.capsules[t].base_ref = branch;
      const lines = (buildCapsule(contracts, rt, t, { head: 'f'.repeat(40), root }).text || '').split('\n');
      const get = (k) => lines.find((l) => l.startsWith(k)) || '';
      results.push({ label: 'a tracking capsule names the resolved commit as its base', pass: get('BASE').includes(resolved), errs: [get('BASE')] });
      results.push({ label: 'a tracking capsule sources the resolved commit', pass: get('SOURCE').includes(resolved), errs: [get('SOURCE')] });
      results.push({ label: 'a tracking capsule does not report the old recorded base as its base', pass: !get('BASE').includes(rt.capsules[t].base_oid) || rt.capsules[t].base_oid === resolved, errs: [get('BASE')] });
      results.push({ label: 'a tracking capsule is not told to stop because its base moved', pass: !get('STOP').includes('base_oid moved from HEAD'), errs: [get('STOP')] });
    }
    // ...and a pinned capsule keeps the pinned-base stop condition.
    const pinned = baseRt();
    const pt = Object.keys(pinned.capsules).find((k) => RESEATABLE.has(pinned.capsules[k].lifecycle_state));
    const pLines = (buildCapsule(contracts, pinned, pt, { head: 'f'.repeat(40), root }).text || '').split('\n');
    const pStop = pLines.find((l) => l.startsWith('STOP')) || '';
    results.push({ label: 'a pinned capsule still stops when its base moves', pass: pStop.includes('base_oid moved from HEAD'), errs: [pStop] });
  }

  // Codex P1: a per-seat grant authorizes the lease's OWN ticket. The first
  // version accepted `.agentops/work/**` unconditionally, so every holder was
  // authorized for every seat's ledger while the contract claimed otherwise.
  expectRuntime('a lease granting another ticket\'s ledger', (rt) => {
    rt.leases.find((l) => l.id === 'lease-AS-HD-055-qa-independent').path_globs.push('.agentops/events/AS-HD-040/**');
  }, "is AS-HD-040's ledger");
  expectRuntime('a capsule claiming another ticket\'s ledger as an affected path', (rt) => {
    const l = rt.leases.find((x) => x.id === 'lease-AS-1001-maker');
    l.path_globs.push('.agentops/events/**');
    rt.capsules['AS-1001'].affected_paths.push('.agentops/events/AS-HD-055/**');
  }, "is AS-HD-055's ledger");
  {
    // ...and a seat's own ticket-scoped ledger grant stays legal.
    const rt = baseRt();
    const lease = rt.leases.find((l) => l.id === 'lease-AS-HD-055-qa-independent');
    lease.path_globs.push('.agentops/events/AS-HD-055/**', '.agentops/work/AS-HD-055/**');
    const errs = pathGrantErrors(contracts, lease);
    results.push({ label: 'a seat may hold its own ticket-scoped ledger', pass: errs.length === 0, errs });
  }

  // B4 consolidation plants. Every one guards the same property: a summary adds
  // a node and removes nothing, so a summary whose range is gone, wrong, or
  // protected must fail rather than quietly stand in for evidence.
  const consolidate = (rt, ticket, over) => {
    const list = rt.events[ticket];
    const last = list[list.length - 1];
    const span = list.slice(0, over);
    list.push({
      schema: 'agentops/event/v1', id: `${ticket}-9100`, ticket, seq: last.seq + 1, parent_event: last.id,
      kind: 'consolidation', actor: 'it-manager-iii', at: '2026-09-01T00:00:00Z',
      summary: 'Consolidated an early range for readability.',
      consolidates: { from_event: span[0].id, to_event: span[span.length - 1].id, count: span.length, authorised_by: 'it-manager-iii', recovery_consequence: 'the individual summaries in the range are no longer read line by line' },
    });
    return list[list.length - 1];
  };
  const bigTicket = Object.keys(rt0.events).find((t) => rt0.events[t].length > 20 && t !== 'AS-HD-029');
  if (bigTicket) {
    {
      const rt = baseRt();
      consolidate(rt, bigTicket, 12);
      const errs = runtimeChecks(contracts, rt).filter((e) => e.includes('-9100'));
      results.push({ label: 'consolidation control: a well-formed summary of a present range validates', pass: errs.length === 0, errs });
    }
    // A payload on the wrong kind is never checked, so it must never be accepted.
  expectRuntime('a consolidation payload on a genesis event', (rt) => {
    const t = Object.keys(rt.events)[0];
    const g = rt.events[t].find((e) => e.kind === 'genesis') || rt.events[t][0];
    g.consolidates = { from_event: 'x', to_event: 'y', count: 2, authorised_by: 'maker', recovery_consequence: 'none' };
  }, "only a 'consolidation' event may carry");
  expectRuntime('a promotion payload on a decision that is not a fast-forward', (rt) => {
    const t = Object.keys(rt.events).find((k) => rt.events[k].some((e) => e.kind === 'owner-decision'));
    const e = rt.events[t].find((x) => x.kind === 'owner-decision');
    e.action = 'delegate';
    e.promotion = { ref: 'test', from: 'a'.repeat(40), to: 'b'.repeat(40), hosted_verified_dev_oid: 'b'.repeat(40), evidence: ['fabricated'] };
  }, 'the ledger would claim a promotion no command performed');
  expectRuntime('a promotion payload on a state-change event', (rt) => {
    const t = Object.keys(rt.events)[0];
    const e = rt.events[t].find((x) => x.kind === 'state-change') || rt.events[t][0];
    e.promotion = { ref: 'test', from: 'a'.repeat(40), to: 'b'.repeat(40), hosted_verified_dev_oid: 'b'.repeat(40), evidence: ['x'] };
  }, "only a 'owner-decision' event may carry");

  // Binding the payload to the action validated the LABEL only. These plant the
  // payload itself: a promotion the ledger records must name the ref
  // git-ownership permits, full commits, the hosted-verified SHA it claims, and
  // the evidence its gate requires — or the authoritative record asserts a
  // protected move that could not have occurred.
  const ffRef = ((contracts['git-ownership'] || {}).refs || []).find((r) => /gate-c-fast-forward/i.test(r.mutation || '')).ref;
  const ffGateId = ((contracts['promotion-gates'] || {}).gates || []).find((x) => (x.guards_transitions || []).length && /fast-forward/i.test(x.entry || ''));
  const plantPromotion = (rt, mutate) => {
    const t = Object.keys(rt.events).find((k) => rt.events[k].some((e) => e.kind === 'owner-decision'));
    const e = rt.events[t].find((x) => x.kind === 'owner-decision');
    e.action = 'fast-forward-test';
    e.promotion = {
      ref: ffRef, from: 'a'.repeat(40), to: 'b'.repeat(40), hosted_verified_dev_oid: 'b'.repeat(40),
      evidence: [...(ffGateId.required_evidence || [])],
    };
    if (mutate) mutate(e.promotion);
    return e;
  };
  {
    const rt = baseRt();
    const e = plantPromotion(rt, null);
    const errs = runtimeChecks(contracts, rt).filter((x) => x.includes(e.id) && x.includes('promotion'));
    results.push({ label: 'promotion control: a well-formed recorded promotion validates', pass: errs.length === 0, errs });
  }
  expectRuntime('promotion: a ref the command was never permitted to move', (rt) => { plantPromotion(rt, (pr) => { pr.ref = 'main'; }); }, 'the only ref this action may move is');
  expectRuntime('promotion: a target that is not a commit id', (rt) => { plantPromotion(rt, (pr) => { pr.to = 'y'; pr.hosted_verified_dev_oid = 'y'; }); }, 'not a full 40-character commit id');
  expectRuntime('promotion: a predecessor that is not a commit id', (rt) => { plantPromotion(rt, (pr) => { pr.from = 'x'; }); }, 'not a full 40-character commit id');
  expectRuntime('promotion: a target that is not the hosted-verified dev SHA', (rt) => { plantPromotion(rt, (pr) => { pr.to = 'c'.repeat(40); }); }, 'decision 0009 permits exactly that commit and no other');
  expectRuntime('promotion: a ref that did not move', (rt) => { plantPromotion(rt, (pr) => { pr.from = pr.to; }); }, 'a ref that did not move is not a promotion');
  expectRuntime('promotion: evidence nothing declares', (rt) => { plantPromotion(rt, (pr) => { pr.evidence = ['looks-fine']; }); }, 'which evidence.json does not declare');
  expectRuntime('promotion: short of the evidence its own gate requires', (rt) => { plantPromotion(rt, (pr) => { pr.evidence = [pr.evidence[0]]; }); }, 'short of the gate it claims to have passed');
  expectRuntime('consolidation: a range that is not present', (rt) => { consolidate(rt, bigTicket, 12).consolidates.from_event = `${bigTicket}-8888`; }, 'must be present to be summarised');
    expectRuntime('consolidation: a count that does not match the range', (rt) => { consolidate(rt, bigTicket, 12).consolidates.count = 3; }, 'a dangling claim');
    expectRuntime('consolidation: a range that runs backwards', (rt) => { const e = consolidate(rt, bigTicket, 12); const f = e.consolidates.from_event; e.consolidates.from_event = e.consolidates.to_event; e.consolidates.to_event = f; }, 'runs backwards');
    expectRuntime('consolidation: fewer events than the declared minimum', (rt) => { consolidate(rt, bigTicket, 3); }, 'below the declared minimum');
    expectRuntime('consolidation: a summary naming no range at all', (rt) => { delete consolidate(rt, bigTicket, 12).consolidates; }, 'a summary of nothing is not a record');
    expectRuntime('consolidation: an authoriser who is not a declared actor', (rt) => { consolidate(rt, bigTicket, 12).consolidates.authorised_by = 'someone'; }, 'not a declared actor');
    expectRuntime('consolidation: a summary of a summary', (rt) => { consolidate(rt, bigTicket, 12); const e = consolidate(rt, bigTicket, rt.events[bigTicket].length); e.id = `${bigTicket}-9101`; }, 'summaries of summaries');
  }
  expectRuntime('consolidation: authorised by a seat that is not the declared authority', (rt) => { consolidate(rt, bigTicket, 12).consolidates.authorised_by = 'maker'; }, 'existing is not the same as being allowed');

  // ...and the correction of record is unreachable, which is the point.
  expectRuntime('consolidation: a ticket carrying a correction of record', (rt) => { consolidate(rt, 'AS-HD-029', 12); }, 'the history the correction exists to preserve');

  expectRuntime('capsule seal / CAS mismatch', (rt) => { rt.capsules['AS-1001'].objective = 'tampered objective'; }, 'seal mismatch');
  expectRuntime('capsule missing evidence pointer', (rt) => { rt.capsules['AS-1001'].evidence_pointers.push('ghost-evidence'); }, 'not a declared evidence type');
  expectRuntime('capsule authority amplification', (rt) => { rt.capsules['AS-1001'].authority.may.push('mutate-main-or-release'); }, 'authority amplification');
  expectRuntime('broken event chain', (rt) => { rt.events['AS-1001'][2].parent_event = 'AS-1001-0001'; }, 'breaks the chain');
  expectRuntime('affected path outside lease', (rt) => { rt.capsules['AS-1001'].affected_paths.push('src/**'); }, 'not covered by its writer lease');
  expectRuntime('exempted lease cannot be widened with an unnamed glob', (rt) => { rt.leases.find((x) => x.id === 'lease-GH-183-current-build-links').path_globs.push('content/**'); }, 'git-ownership assigns that path to');
  expectRuntime('lease grants an undeclared path glob', (rt) => { const l = rt.leases.find((x) => x.id === 'lease-GH-183-current-build-links'); delete l.path_grant_exception; l.path_globs = ['wildcat/**']; }, 'no git-ownership path declares');
  expectRuntime('lease grants a path owned by a different role', (rt) => { const l = rt.leases.find((x) => x.id === 'lease-GH-183-current-build-links'); delete l.path_grant_exception; l.path_globs = ['.agentops/governance/**']; }, 'git-ownership assigns that path to');
  const appendLeaseSuccessor = (rt, overrides = {}) => {
    const parent = rt.leases.find((l) => l.id === 'lease-AS-HD-057-it-support');
    const child = {
      ...parent,
      schema: 'agentops/lease/v2',
      id: 'lease-AS-HD-057-it-support-r2-plant',
      revision: 2,
      parent_lease: parent.id,
      parent_hash: computeLeaseHash(parent),
      current_hash: '',
      excluded_globs: ['tools/ui-preview-gallery.mjs'],
      issued: '2026-08-31T15:11:18Z',
      revoked: false,
      ...overrides,
    };
    child.current_hash = computeLeaseHash(child);
    rt.leases.push(child);
    return child;
  };
  expectRuntime('lease v2 stale parent hash', (rt) => { const l = appendLeaseSuccessor(rt); l.parent_hash = 'sha256:stale'; l.current_hash = computeLeaseHash(l); }, 'parent_hash does not match');
  expectRuntime('lease v2 seal mismatch', (rt) => { const l = appendLeaseSuccessor(rt); l.expiry = '2026-10-30T23:59:59Z'; }, 'lease-AS-HD-057-it-support-r2-plant\' seal mismatch');
  expectRuntime('lease exclusion outside its granted scope', (rt) => { const l = appendLeaseSuccessor(rt); l.excluded_globs = ['src/main.js']; l.current_hash = computeLeaseHash(l); }, 'no granted path covers that exclusion');
  expectRuntime('an exact-file lease cannot exclude a sibling file', (rt) => {
    appendLeaseSuccessor(rt, { path_globs: ['tools/ui-preview-gallery.mjs'], excluded_globs: ['tools/other.mjs'] });
  }, 'no granted path covers that exclusion');
  expectRuntime('lease successor cannot re-grant a parent exclusion', (rt) => {
    const first = appendLeaseSuccessor(rt);
    const second = { ...first, id: 'lease-AS-HD-057-it-support-r3-plant', revision: 3, parent_lease: first.id, parent_hash: computeLeaseHash(first), excluded_globs: undefined, current_hash: '' };
    delete second.excluded_globs; second.current_hash = computeLeaseHash(second); rt.leases.push(second);
  }, 're-grants parent exclusion');
  expectRuntime('sibling lease successors must have disjoint effective paths', (rt) => {
    appendLeaseSuccessor(rt, { id: 'lease-AS-HD-057-retained-plant' });
    appendLeaseSuccessor(rt, { id: 'lease-AS-HD-057-overlap-plant', ref: 'recovery/as-hd-057-overlap-plant', excluded_globs: ['tools/other.mjs'] });
  }, 'lease successor collision');
  {
    const rt = baseRt();
    rt.leases = rt.leases.filter((l) => l.id !== 'lease-AS-HD-057-it-support-r2');
    const parent = rt.leases.find((l) => l.id === 'lease-AS-HD-057-it-support');
    const retained = appendLeaseSuccessor(rt, { id: 'lease-AS-HD-057-retained-positive' });
    const carveout = appendLeaseSuccessor(rt, { id: 'lease-GH-194-ui-preview-gallery-positive', ref: 'recovery/gh-194-ui-preview-gallery-plant', path_globs: ['tools/ui-preview-gallery.mjs'], excluded_globs: undefined });
    delete carveout.excluded_globs; carveout.current_hash = computeLeaseHash(carveout);
    const cap = rt.capsules['AS-HD-057'];
    cap.writer_lease = retained.id; cap.affected_paths = ['tools/**']; cap.excluded_paths = ['tools/ui-preview-gallery.mjs']; cap.blocker = null;
    cap.authority.may = [...retained.actions]; cap.parent_hash = cap.current_hash; cap.revision += 1; cap.current_hash = computeCapsuleHash(cap);
    rt.leases = [...rt.leases.filter((l) => l !== retained && l !== carveout), carveout, retained];
    const errs = runtimeChecks(contracts, rt).filter((e) => e.includes(retained.id) || e.includes(carveout.id) || e.includes(parent.id) || e.includes("capsule 'AS-HD-057'"));
    results.push({ label: 'append-only lease split is disjoint regardless of successor order', pass: errs.length === 0, errs });
  }
  expectRuntime('capsule cannot claim a sibling of an exact-file lease', (rt) => {
    const l = rt.leases.find((x) => x.id === 'lease-AS-HD-057-it-support-r2');
    l.path_globs = ['.agentops/work/AS-HD-057/CURRENT.json']; l.current_hash = computeLeaseHash(l);
    const cap = rt.capsules['AS-HD-057']; cap.affected_paths = ['.agentops/work/AS-HD-057/OTHER.json']; cap.current_hash = computeCapsuleHash(cap);
  }, 'affected path');
  expectRuntime('capsule cannot claim a file excluded by its lease', (rt) => {
    rt.leases = rt.leases.filter((l) => l.id !== 'lease-AS-HD-057-it-support-r2');
    const l = appendLeaseSuccessor(rt);
    const cap = rt.capsules['AS-HD-057']; cap.writer_lease = l.id; cap.affected_paths = ['tools/ui-preview-gallery.mjs'];
    cap.excluded_paths = ['tools/ui-preview-gallery.mjs']; cap.blocker = null; cap.authority.may = [...l.actions]; cap.current_hash = computeCapsuleHash(cap);
  }, 'affected path');
  {
    const rt = baseRt();
    const parent = rt.leases.find((l) => l.id === 'lease-AS-HD-057-it-support'); parent.revoked = false;
    const child = rt.leases.find((l) => l.id === 'lease-AS-HD-057-it-support-r2'); child.revoked = true;
    const cap = rt.capsules['AS-HD-057']; cap.writer_lease = parent.id; cap.affected_paths = ['tools/**']; cap.blocker = null; cap.authority.may = [...parent.actions];
    const wake = computeDispatch(contracts, rt).find((e) => e.ticket === 'AS-HD-057');
    results.push({ label: 'a revoked successor cannot shadow its live parent during dispatch', pass: wake && wake.wake === 'it-support', errs: wake ? [JSON.stringify(wake)] : ['missing wake'] });
  }
  expectRuntime('an active lease on a protected ref', (rt) => { const l = rt.leases.find((x) => x.id === 'lease-AS-HD-057-it-support-r2'); l.ref = 'main'; l.current_hash = computeLeaseHash(l); }, 'not an isolated-continuation branch');
  expectRuntime('two seats holding the same isolated ref', (rt) => { rt.leases.find((l) => l.id === 'lease-AS-HD-040-maker').ref = 'claude/ashenspire-agentops-stage3-capsules'; }, 'belongs to exactly one seat');
  expectRuntime('capsule ref that git cannot create', (rt) => { rt.capsules['AS-HD-040'].ref = 'recovery/foo..bar'; rt.leases.find((l) => l.id === 'lease-AS-HD-040-maker').ref = 'recovery/foo..bar'; }, 'not a valid git branch name');
  expectRuntime('two seats holding the same per-seat ref', (rt) => {
    const l = rt.leases.find((x) => x.id === 'lease-AS-HD-057-it-support-r2'); l.ref = 'recovery/as-hd-029'; l.current_hash = computeLeaseHash(l);
    const cap = rt.capsules['AS-HD-057']; cap.ref = l.ref; cap.parent_hash = cap.current_hash; cap.revision += 1; cap.current_hash = computeCapsuleHash(cap);
  }, 'belongs to exactly one seat');
  expectRuntime('capsule claiming a protected ref', (rt) => { rt.capsules['AS-1001'].ref = 'main'; rt.leases.find((l) => l.id === rt.capsules['AS-1001'].writer_lease).ref = 'main'; }, 'not an isolated-continuation branch');
  expectRuntime('capsule claiming the pr-only integration ref', (rt) => { rt.capsules['AS-HD-029'].ref = 'dev'; rt.leases.find((l) => l.id === rt.capsules['AS-HD-029'].writer_lease).ref = 'dev'; }, 'not an isolated-continuation branch');

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
  expectCommand('owner-command: owner-exclusive dev-delivery grant by deputy rejected', (r) => { r.action = 'grant-dev-delivery-authority'; r.target = 'AS-HD-029'; r.expected_current_hash = computeCapsuleHash(rt0.capsules['AS-HD-029']); r.reason = 'bounded grant'; delete r.candidate_oid; }, 'not authorized');

  // A3 reseat plants, through the same validateCommand() the live dry run uses.
  // The control is a real unstarted seat: AS-1001 is in-progress, so it doubles
  // as the started-target rejection below.
  const rsTicket = Object.keys(rt0.capsules).find((t) => RESEATABLE.has(rt0.capsules[t].lifecycle_state));
  const rsHash = computeCapsuleHash(rt0.capsules[rsTicket]);
  const rsReq = (params) => ({ schema: 'agentops/owner-command-request/v1', action: 'reseat', actor: 'it-manager-iii', target: rsTicket, expected_current_hash: rsHash, params });
  // Fixtures come from the repository, never from a well-known name. The first
  // version of this control used `dev`, which exists in a working clone and does
  // NOT exist in a CI pull-request checkout — detached, with no local branches —
  // so it failed there and only there.
  const rsBranch = anyLocalBranch(root);
  const rsHead = currentHead(root);
  const rsPin = (rsHead && rsHead !== rt0.capsules[rsTicket].base_oid) ? rsHead : null;
  if (rsPin) {
    const pinned = validateCommand(contracts, rt0, rsReq({ base_oid: rsPin }), { root });
    results.push({ label: 'reseat control: an unstarted seat pinned to a real commit is accepted', pass: pinned.ok, errs: pinned.errors });
  }
  // The pointer control needs a branch that resolves. Where the checkout has
  // none, the same request runs in pure mode — the shape logic is what this
  // asserts, and the repository check is environment-dependent by design, which
  // is exactly why reseatParamErrors takes root as an option rather than always
  // reaching for git.
  const ptrReq = rsReq({ base_ref: rsBranch || 'any-branch-name' });
  const ptr = validateCommand(contracts, rt0, ptrReq, rsBranch ? { root } : {});
  results.push({ label: `reseat control: an unstarted seat pointed at a branch is accepted (${rsBranch ? 'resolved' : 'shape only — this checkout carries no local branch'})`, pass: ptr.ok, errs: ptr.errors });
  const expectReseat = (label, req, needle) => {
    const res = validateCommand(contracts, rt0, req, { root });
    const hit = !res.ok && res.errors.some((e) => e.includes(needle));
    results.push({ label, pass: hit, errs: hit ? [] : res.errors });
  };
  expectReseat('reseat: both a pin and a pointer', rsReq({ base_oid: 'a'.repeat(40), base_ref: 'dev' }), 'exactly one of');
  expectReseat('reseat: neither a pin nor a pointer', rsReq({}), 'exactly one of');
  expectReseat('reseat: an unknown params field', rsReq({ base_ref: 'dev', sweep: true }), 'unknown field');
  expectReseat('reseat: an abbreviated commit id', rsReq({ base_oid: 'a72cac96' }), 'not a full 40-character commit id');
  expectReseat('reseat: a commit this repository does not carry', rsReq({ base_oid: 'a'.repeat(40) }), 'not a commit in this repository');
  expectReseat('reseat: a branch this repository does not carry', rsReq({ base_ref: 'no-such-branch-anywhere' }), 'not a branch in this repository');
  // ...and the pin control's own fixture must have been real, or the control above proves nothing.
  results.push({ label: 'the reseat controls ran against a real commit', pass: rsPin !== null || rsHead === null, errs: [String(rsHead)] });
  expectReseat('reseat: a commit id recorded as a pointer', rsReq({ base_ref: 'a72cac9611df' }), 'a pinned value recorded as a pointer is neither');
  expectReseat('reseat: a no-op that would still append an event', rsReq({ base_oid: rt0.capsules[rsTicket].base_oid }), 'a command that changes nothing still appends');
  expectReseat('reseat: a seat that has already started', { ...rsReq({ base_ref: 'dev' }), target: 'AS-1001', expected_current_hash: computeCapsuleHash(rt0.capsules['AS-1001']) }, 'work already stands on its base');
  expectReseat('reseat: an unauthenticated actor', { ...rsReq({ base_ref: 'dev' }), actor: 'maker' }, 'not authorized');
  expectReseat('reseat: a stale compare-and-swap', { ...rsReq({ base_ref: 'dev' }), expected_current_hash: 'sha256:' + '0'.repeat(64) }, 'stale command');

  // B2 Gate-C plants. The accept control runs in PURE mode: a CI pull-request
  // checkout carries no local `test` branch, and hardcoding one is the mistake
  // that turned an earlier control red. The repository-dependent refusals run
  // only where the ref is present, and that skip is a reported result.
  // No capsule in the live corpus carries all of Gate A and B's evidence, which
  // is the honest state: nothing is currently promotable to `test`. The control
  // therefore constructs one rather than pretending a real capsule qualifies —
  // the alternative is a control that passes because the check it exercises was
  // never reached.
  const gateAB = [...new Set(contracts['promotion-gates'].gates.filter((gt) => gt.id === 'A' || gt.id === 'B').flatMap((gt) => gt.required_evidence || []))];
  const rtFF = baseRt();
  const ffTicket = Object.keys(rtFF.capsules).find((t) => !rtFF.capsules[t].blocker);
  if (ffTicket) {
    const cp = rtFF.capsules[ffTicket];
    cp.evidence_pointers = [...new Set([...(cp.evidence_pointers || []), ...gateAB])];
    delete cp.current_hash;
    cp.current_hash = computeCapsuleHash(cp);
  }
  const ffHash = ffTicket ? computeCapsuleHash(rtFF.capsules[ffTicket]) : null;
  const OID = (ch) => ch.repeat(40);
  const ffReq = (params, x = {}) => ({ schema: 'agentops/owner-command-request/v1', action: 'fast-forward-test', actor: 'it-manager-iii', target: ffTicket, expected_current_hash: ffHash, params, ...x });
  const ffEv = ['hosted smoke pass'];
  if (ffTicket) {
    const good = ffReq({ target_oid: OID('a'), hosted_verified_dev_oid: OID('a'), rollback_oid: OID('b'), evidence: ffEv });
    const ctl = validateCommand(contracts, rtFF, good);
    // The control cannot be "accepted" any more, and saying so is the point.
    // Gate C refuses every request until a per-candidate receipt exists, which
    // no artifact in this corpus records. So the control asserts the honest
    // property instead: a shape-valid request is refused ONLY for the declared
    // structural gap, and for nothing else. If a shape defect ever slips in,
    // this fails because a second, different reason appears.
    const structural = (e) => e.includes('cannot show Gate') && e.includes('no receipt is recorded');
    const other = ctl.errors.filter((e) => !structural(e));
    results.push({ label: 'gate C control: a shape-valid request fails only on the declared receipt gap', pass: !ctl.ok && ctl.errors.some(structural) && other.length === 0, errs: other });
    const expectFF = (label, req, needle) => {
      const res = validateCommand(contracts, rtFF, req);
      const hit = !res.ok && res.errors.some((e) => e.includes(needle));
      results.push({ label, pass: hit, errs: hit ? [] : res.errors });
    };
    expectFF('gate C: target is not the hosted-verified dev SHA', ffReq({ target_oid: OID('a'), hosted_verified_dev_oid: OID('c'), rollback_oid: OID('b'), evidence: ffEv }), 'permits exactly that commit and no other');
    expectFF('gate C: no mutation evidence recorded', ffReq({ target_oid: OID('a'), hosted_verified_dev_oid: OID('a'), rollback_oid: OID('b'), evidence: [] }), 'must record the mutation evidence');
    expectFF('gate C: no rollback target recorded', ffReq({ target_oid: OID('a'), hosted_verified_dev_oid: OID('a'), evidence: ffEv }), 'cannot be undone');
    expectFF('gate C: an abbreviated target', ffReq({ target_oid: 'a72cac96', hosted_verified_dev_oid: OID('a'), rollback_oid: OID('b'), evidence: ffEv }), 'full 40-character commit id');
    expectFF('gate C: an unknown params field', ffReq({ target_oid: OID('a'), hosted_verified_dev_oid: OID('a'), rollback_oid: OID('b'), evidence: ffEv, force: true }), 'unknown field');
    expectFF('gate C: an unauthenticated actor', ffReq({ target_oid: OID('a'), hosted_verified_dev_oid: OID('a'), rollback_oid: OID('b'), evidence: ffEv }, { actor: 'maker' }), 'not authorized');
    const blockedTicket = Object.keys(rtFF.capsules).find((t) => rtFF.capsules[t].blocker);
    if (blockedTicket) {
      expectFF('gate C: a target carrying an unresolved blocker', ffReq({ target_oid: OID('a'), hosted_verified_dev_oid: OID('a'), rollback_oid: OID('b'), evidence: ffEv }, { target: blockedTicket, expected_current_hash: computeCapsuleHash(rtFF.capsules[blockedTicket]) }), 'condition 5 forbids promoting past one');
    }
    expectFF('gate C: an evidence array with nothing readable in it', ffReq({ target_oid: OID('a'), hosted_verified_dev_oid: OID('a'), rollback_oid: OID('b'), evidence: [null] }), 'nothing readable in it');
    expectFF('gate C: an evidence array of blank strings', ffReq({ target_oid: OID('a'), hosted_verified_dev_oid: OID('a'), rollback_oid: OID('b'), evidence: ['   '] }), 'nothing readable in it');

    // Codex P1: absence of a blocker is not evidence that gates A and B passed.
    for (const ev of gateAB) {
      const stripped = baseRt();
      const cp = stripped.capsules[ffTicket];
      cp.evidence_pointers = gateAB.filter((x) => x !== ev);
      delete cp.current_hash; cp.current_hash = computeCapsuleHash(cp);
      const res = validateCommand(contracts, stripped, { ...ffReq({ target_oid: OID('a'), hosted_verified_dev_oid: OID('a'), rollback_oid: OID('b'), evidence: ffEv }), expected_current_hash: computeCapsuleHash(cp) });
      const hit = !res.ok && res.errors.some((e) => e.includes(`does not carry '${ev}'`));
      results.push({ label: `gate C: promoting without ${ev}`, pass: hit, errs: hit ? [] : res.errors });
    }
    // ...and a corpus with no pr-only integration ref has nothing to check the
    // hosted-verified claim against.
    const noDev = { ...contracts, 'git-ownership': { ...contracts['git-ownership'], refs: contracts['git-ownership'].refs.filter((r) => r.mutation !== 'pr-only') } };
    const noDevRes = validateCommand(noDev, rtFF, ffReq({ target_oid: OID('a'), hosted_verified_dev_oid: OID('a'), rollback_oid: OID('b'), evidence: ffEv }));
    results.push({ label: 'gate C: no pr-only integration ref to check the hosted claim against', pass: !noDevRes.ok && noDevRes.errors.some((e) => e.includes('no pr-only integration ref')), errs: noDevRes.errors });

    // ...and the action must not be able to name the ref it moves.
    const noRef = { ...contracts, 'git-ownership': { ...contracts['git-ownership'], refs: contracts['git-ownership'].refs.filter((r) => !/gate-c-fast-forward/i.test(r.mutation || '')) } };
    const orphan = validateCommand(noRef, rtFF, ffReq({ target_oid: OID('a'), hosted_verified_dev_oid: OID('a'), rollback_oid: OID('b'), evidence: ffEv }));
    results.push({ label: 'gate C: no declared gate-c ref means nothing to move', pass: !orphan.ok && orphan.errors.some((e) => e.includes('nothing this action may move')), errs: orphan.errors });

    // Repository-dependent refusals: the ancestor check and the live-ref checks.
    const ffRefDecl = contracts['git-ownership'].refs.find((r) => /gate-c-fast-forward/i.test(r.mutation || ''));
    const liveRef = ffRefDecl ? resolveRef(root, ffRefDecl.ref) : null;
    results.push({ label: 'gate C repository checks ' + (liveRef ? 'ran against ' + ffRefDecl.ref : 'skipped — this checkout carries no ' + (ffRefDecl ? ffRefDecl.ref : 'gate-c') + ' branch'), pass: true, errs: [] });
    if (liveRef) {
      const head = currentHead(root);
      // These four are the repository checks, so they must be validated WITH a
      // checkout — expectFF runs pure, which silently passed them.
      const expectFFRepo = (label, req, needle) => {
        const res = validateCommand(contracts, rtFF, req, { root });
        const hit = !res.ok && res.errors.some((e) => e.includes(needle));
        results.push({ label, pass: hit, errs: hit ? [] : res.errors });
      };
      // Codex P1: the request asserting its own hosted-verified SHA proved
      // nothing; the ref is the authority.
      // Codex P1: a local ref move nobody publishes is not a promotion.
      const pub = resolveRemoteRefForTest(root, ffRefDecl.ref);
      if (pub === null) {
        results.push({ label: 'gate C: refuses when the ref has no published counterpart', pass: validateCommand(contracts, rtFF, ffReq({ target_oid: liveRef, hosted_verified_dev_oid: liveRef, rollback_oid: liveRef, evidence: ffEv }), { root }).errors.some((e) => e.includes('this tool does not push')), errs: [] });
      }
      expectFFRepo('gate C: a hosted-verified claim the dev ref contradicts', ffReq({ target_oid: liveRef, hosted_verified_dev_oid: liveRef, rollback_oid: liveRef, evidence: ffEv }), 'the ref is the authority for that');
      expectFFRepo('gate C: a rollback that is not the ref being replaced', ffReq({ target_oid: head, hosted_verified_dev_oid: head, rollback_oid: OID('b'), evidence: ffEv }), 'must be what is actually being replaced');
      expectFFRepo('gate C: a target this repository does not carry', ffReq({ target_oid: OID('a'), hosted_verified_dev_oid: OID('a'), rollback_oid: liveRef, evidence: ffEv }), 'not a commit in this repository');
      expectFFRepo('gate C: a move to where the ref already is', ffReq({ target_oid: liveRef, hosted_verified_dev_oid: liveRef, rollback_oid: liveRef, evidence: ffEv }), 'a command that moves nothing');
      if (head && head !== liveRef && !isAncestorForTest(root, liveRef, head)) {
        expectFFRepo('gate C: a move that is not a fast-forward', ffReq({ target_oid: head, hosted_verified_dev_oid: head, rollback_oid: liveRef, evidence: ffEv }), 'is not a fast-forward');
      }
    }
  }

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

  // Stage 7 dispatch plants — the routing surface. A capsule must not be able
  // to choose who it escalates to, and a seat must not be able to exist with no
  // move it is permitted to make.
  expectRuntime('blocker naming an undeclared escalation class', (rt) => { rt.capsules['AS-HD-056'].blocker.escalation_class = 'ghost-class'; }, 'escalation.json does not declare');
  // ...and the wake surface fails closed on a lease whose expiry is not a real
  // instant. runtimeChecks rejects one too, but dispatch takes the runtime as
  // given: an expiry it cannot place in the future must stop the seat rather
  // than wake it. The lexicographic '<=' it replaced quietly read such a value
  // as live.
  {
    const rt = baseRt();
    const live = Object.entries(rt.capsules).find(([, cp]) => cp.writer_lease && !cp.blocker);
    let hit = false, got = [];
    if (live) {
      const lease = rt.leases.find((l) => l.id === live[1].writer_lease);
      if (lease) {
        lease.expiry = '2026-11-31T00:00:00Z';
        const d = computeDispatch(contracts, rt, { now: '2026-01-01T00:00:00Z' });
        got = d.map((x) => x.reason || JSON.stringify(x));
        hit = got.some((w) => String(w).includes('is not a real instant'));
      }
    }
    results.push({ label: 'dispatch fails closed on a lease expiry that is not a real instant', pass: hit, errs: hit ? [] : got.slice(0, 4) });
  }
  expectMigration('transition narrowed until a live seat is stranded', (c) => {
    for (const m of c.transitions.transitions) if (m.from === 'assigned' && m.to === 'in-progress') m.permitted_actor_roles = ['maker'];
  }, 'the seat is stranded');

  // Stage 8 teams plants — the charter, now enforceable. Each reproduces a way
  // the prose could be contradicted while everything else still validated.
  expectSemantic('teams: standing role with no hierarchy node', (c) => { c.teams.standing_roles.push({ id: 'ghost-lead', responsibility: 'x', boundary: 'y' }); }, 'is not a declared role');
  expectSemantic('teams: a pool that is also a role could hold a seat', (c) => { c.teams.capability_pools.push({ id: 'maker', delivery_capability: 'x', stewardship: 'y' }); }, 'must not be able to hold a seat');
  expectSemantic('teams: charter exception escalating away from the owner', (c) => { c.teams.charter_exception.escalation_class = 'technical-blocker'; }, 'rather than the owner');
  expectSemantic('teams: charter exception naming a non-standing concurrer', (c) => { c.teams.charter_exception.requires_concurrence = ['it-manager-iii', 'maker']; }, 'is not a standing role');
  expectSemantic('teams: a pool renamed until it no longer matches the charter', (c) => { c.teams.capability_pools[0].charter_heading = 'Art Department'; }, 'no heading in the charter prose');
  expectSemantic('tiers: a shared namespace with no disambiguation rule', (c) => { delete c.hierarchy.authority_tiers.disambiguation; }, 'declare no disambiguation rule');
  expectSemantic('tiers: a subject readable as both authority and priority', (c) => { c.hierarchy.authority_tiers.disambiguation.priority_subjects.push('team'); }, 'readable both ways');
  expectSemantic('tiers: the disambiguation rule losing its subject test', (c) => { c.hierarchy.authority_tiers.disambiguation.rule = 'use judgement'; }, 'subject decides the meaning');
  expectSemantic('tiers: an actor in no tier', (c) => { c.hierarchy.authority_tiers.levels = c.hierarchy.authority_tiers.levels.filter((l) => l.p !== 4); }, 'in no authority tier');
  expectSemantic('tiers: an actor in two tiers', (c) => { c.hierarchy.authority_tiers.levels.find((l) => l.p === 2).actors.push('maker'); }, 'an actor holds one tier');
  expectSemantic('tiers: the owner demoted below P0', (c) => { c.hierarchy.authority_tiers.levels.find((l) => l.p === 1).actors.push('constantine'); }, 'appears below P0');
  expectSemantic('tiers: the ladder starting to pick models', (c) => { c.hierarchy.authority_tiers.rules.not_a_capability_ladder = 'higher tiers get better tools'; }, 'never selects model or effort');
  expectSemantic('ticket flow: a step routed straight to the owner', (c) => { c.escalation.ticket_flow.steps[0].actor = 'owner'; }, 'routes to the owner');
  expectSemantic('ticket flow: a dropped handoff event', (c) => { c.escalation.ticket_flow.handoff_events = ['SENT', 'RECEIVED']; }, "drops the 'ACKNOWLEDGED' handoff event");
  // A2 (#430): with `.agentops/work/**` and `.agentops/events/**` owned by
  // `maker`, no non-maker seat could be granted its own capsule or event chain,
  // so qa-independent, help-desk and it-support seats existed but could not
  // record what they did — the item on the AS-HD-029 P0 critical path. The fix
  // is demonstrated positively, then fenced on every side, because a marker
  // that exempts a path from ownership is exactly the kind of thing that grows.
  {
    const qaLease = { id: 'lease-probe-qa', actor: 'qa-independent', issuer: 'it-manager-iii', path_globs: ['.agentops/work/**', '.agentops/events/**'] };
    const errs = pathGrantErrors(contracts, qaLease);
    results.push({ label: 'a non-maker seat may hold its own capsule and event chain', pass: errs.length === 0, errs });
    // ...and the exemption is narrow: an ordinary owned path still rejects a
    // seat whose role does not own it.
    const bad = pathGrantErrors(contracts, { ...qaLease, path_globs: ['src/**'] });
    results.push({ label: 'a per-seat ledger does not exempt ordinary owned paths', pass: bad.some((e) => e.includes('git-ownership assigns that path to')), errs: bad });
  }
  expectSemantic('per-seat path whose owner_role is a real role', (c) => { c['git-ownership'].paths.find((pp) => pp.glob === '.agentops/events/**').owner_role = 'maker'; }, 'declares the marker, not a role that does not own it');
  expectSemantic('per-seat path on a lane with no sole writer', (c) => { c['git-ownership'].paths.find((pp) => pp.glob === '.agentops/events/**').serialized_lane = 'product-source'; }, 'declares no sole writer');
  expectSemantic('per-seat owner_role without the marker', (c) => { const pp = c['git-ownership'].paths.find((x) => x.glob === '.agentops/work/**'); delete pp.per_seat; }, 'without the per_seat marker');
  expectSemantic('the ledger lane losing its sole writer', (c) => { delete c['git-ownership'].ledger_serialization; }, 'declares no sole writer');
  // B3 (#430): standing directives. The cap the routing package demands is
  // non-amplification; the rest exists because a directive claiming enforcement
  // it does not have is worse than one claiming none.
  // #430 seat display names. The field was unusable (additionalProperties:false
  // in both schemas); now that it exists, an unchecked one would drift into a
  // second naming scheme, so every way of drifting is planted.
  expectSemantic('display name: a seat kind the convention does not declare', (c) => { c.roles.roles.find((r) => r.display_name).display_name = 'X | IT Manager III | Coordination - AshenSpire'; }, 'neither seat kind the convention declares');
  expectSemantic('display name: the wrong number of segments', (c) => { c.roles.roles.find((r) => r.display_name).display_name = 'P | IT Manager III | team | Coordination - AshenSpire'; }, 'segments; the declared template');
  expectSemantic('display name: an empty role-and-level segment', (c) => { c.roles.roles.find((r) => r.display_name).display_name = 'P |  | Coordination Specialist - AshenSpire'; }, 'a name with the right shape and nothing in it is not a name');
  expectSemantic('display name: a different project suffix', (c) => { c.roles.roles.find((r) => r.display_name).display_name = 'P | IT Manager III | Coordination - SomeOtherProject'; }, 'closes with');
  expectSemantic('display name: no title before the project', (c) => { c.roles.roles.find((r) => r.display_name).display_name = 'P | IT Manager III | - AshenSpire'; }, 'carries no title before the project');
  expectSemantic('display name: a standing seat presented as an agent seat', (c) => {
    const r = c.roles.roles.find((x) => x.display_name);
    const n = c.hierarchy.nodes.find((x) => x.display_name);
    r.display_name = r.display_name.replace(/^P /, 'A ');
    if (n) n.display_name = n.display_name.replace(/^P /, 'A ');
  }, 'the kind a lead spins out');
  expectSemantic('display name: a role and its actor disagreeing', (c) => { c.hierarchy.nodes.find((n) => n.display_name).display_name = 'P | IT Manager III | Something Else - AshenSpire'; }, 'one seat, two names');

  expectSemantic('directives: an issuer who is nobody in particular', (c) => { c.directives.directives[0].issued_by = 'someone'; }, 'binds nobody');
  expectSemantic('directives: a duplicate id', (c) => { c.directives.directives.push({ ...c.directives.directives[0] }); }, 'is declared twice');
  expectSemantic('directives: an issued_at that is not a real instant', (c) => { c.directives.directives[0].issued_at = '2026-02-30T00:00:00Z'; }, 'not a real instant');
  expectSemantic('directives: a directive that grants an action', (c) => { c.directives.directives[0].grants_actions = ['integrate-to-dev']; }, 'never what it may do');
  expectSemantic('directives: a directive reaching for owner-reserved authority', (c) => { const d = c.directives.directives[0]; d.issued_by = 'it-manager-iii'; d.grants_actions = [c['owner-intent'].owner.reserved_authority[0]]; }, 'it does not empower one');
  // Parsed JSON inherits from Object.prototype, so a plain lookup made these
  // resolve to defined values and a codification claim naming no field passed.
  for (const ghost of ['constructor', 'toString', 'reporting.__proto__', 'reporting.toString']) {
    expectSemantic(`directives: an inherited codification path (${ghost})`, (c) => { const d = c.directives.directives[0]; d.codified_in = 'information-access'; d.codified_as = ghost; }, 'which does not exist');
  }
  expectSemantic('owner-command: a protected move declared unprotected', (c) => { c['owner-command'].actions.find((x) => x.id === 'fast-forward-test').protected = false; }, 'a consumer filtering on that flag would omit it');
  expectSemantic('retention: an authority role nobody holds', (c) => { c.retention.authority.actor_role = 'it-manger-iii'; }, 'refuse every consolidation');
  expectSemantic('retention: a consolidation kind no event can carry', (c) => { c.retention.consolidation.kind = 'consolidaton'; }, 'pass by never running');
  expectSemantic('directives: a directive superseded by itself', (c) => { const d = c.directives.directives[0]; d.status = 'superseded'; d.superseded_by = d.id; }, 'closes a loop at');
  expectSemantic('directives: two directives superseding each other', (c) => { const [x, y] = c.directives.directives; x.status = 'superseded'; y.status = 'superseded'; x.superseded_by = y.id; y.superseded_by = x.id; }, 'closes a loop at');
  expectSemantic('gate C: the action no longer moves the lifecycle its gate guards', (c) => { delete c['owner-command'].actions.find((x) => x.id === 'fast-forward-test').lifecycle_target; }, 'the ref would advance while the capsule stood still');
  expectSemantic('directives: a contract named with no field named', (c) => { delete c.directives.directives[0].codified_as; }, 'names the contract AND the exact field');
  expectSemantic('directives: a field named with no contract named', (c) => { delete c.directives.directives[0].codified_in; }, 'names the contract AND the exact field');
  expectSemantic('directives: codification in a contract that does not exist', (c) => { c.directives.directives[0].codified_in = 'ghost-contract'; }, 'not a declared contract');
  expectSemantic('directives: codification at a field that does not exist', (c) => { c.directives.directives[0].codified_as = 'reporting.imaginary_clause'; }, 'claiming enforcement it does not have');
  expectSemantic('directives: superseded with no successor named', (c) => { c.directives.directives[0].status = 'superseded'; }, 'names no successor');
  expectSemantic('directives: a successor that does not exist', (c) => { const d = c.directives.directives[0]; d.status = 'superseded'; d.superseded_by = 'no-such-directive'; }, 'not a declared directive');
  expectSemantic('directives: a live directive that also names a successor', (c) => { c.directives.directives[0].superseded_by = c.directives.directives[1].id; }, 'two live directives on one instruction');

  // Codex P1: a wildcard where the ticket goes made the per-ticket ledger check
  // bypassable, because "cannot be proven" read as "whole root, allowed".
  expectRuntime('a wildcarded cross-ticket ledger grant', (rt) => {
    rt.leases.find((l) => l.id === 'lease-AS-HD-055-qa-independent').path_globs.push('.agentops/events/AS-HD-040*/**');
  }, 'ticket segment is a pattern');
  expectRuntime('a bare wildcard in the ticket position', (rt) => {
    rt.leases.find((l) => l.id === 'lease-AS-HD-055-qa-independent').path_globs.push('.agentops/work/*/**');
  }, 'ticket segment is a pattern');
  expectRuntime('a capsule claiming a wildcarded ledger path', (rt) => {
    const l = rt.leases.find((x) => x.id === 'lease-AS-1001-maker');
    l.path_globs.push('.agentops/events/**');
    rt.capsules['AS-1001'].affected_paths.push('.agentops/events/AS*/**');
  }, 'cannot be proven to stay inside');

  expectSemantic('branch hygiene: rewrite permission held by a pool', (c) => { c['git-ownership'].branch_hygiene.permission_role = 'qa-guild'; }, 'is not a declared role');
  expectSemantic('branch hygiene: rewrite permission held by a non-standing role', (c) => { c['git-ownership'].branch_hygiene.permission_role = 'maker'; }, 'is not a standing role');
  expectSemantic('branch hygiene: no prior head recorded', (c) => { c['git-ownership'].branch_hygiene.records = ['the branch']; }, 'cannot be undone');
  expectSemantic('branch hygiene: protected refs left rewritable', (c) => { c['git-ownership'].branch_hygiene.never = ['nothing in particular']; }, 'does not forbid rewriting a protected or pr-only ref');
  expectSemantic('canonical docs: a canonical path that does not exist', (c) => { c['information-access'].canonical_documents[0].path = 'docs/governance/RUNBOOKS/ghost.md'; }, 'which does not exist');
  expectSemantic('canonical docs: a superseded copy still live', (c) => { c['information-access'].canonical_documents[0].superseded_paths = ['docs/governance/TEAM-CHARTERS.md']; }, 'both look authoritative');
  expectSemantic('delivery: promotion readiness claiming a grant', (c) => { c.delivery.promotion_readiness.grants = ['release']; }, 'grants no promotion authority');
  expectSemantic('delivery: a Pages source that is not protected', (c) => { c.delivery.pages.desired_source = 'dev'; }, "is 'pr-only', not protected");
  expectSemantic('delivery: a Pages switch that skips the owner', (c) => { c.delivery.pages.switch_requires.escalation_class = 'technical-blocker'; }, 'rather than the owner');
  expectSemantic('delivery: a Pages switch packet with no rollback', (c) => { c.delivery.pages.switch_packet_records = c.delivery.pages.switch_packet_records.filter((x) => !/rollback/i.test(x)); }, 'nowhere to return to');
  expectSemantic('model-effort: the contract claiming a grant', (c) => { c['model-effort'].grants = ['integration']; }, 'model selection grants no authority');
  expectSemantic('model-effort: max effort with no exceptional reason required', (c) => { delete c['model-effort'].tiers.find((t) => t.allowed_efforts.includes('max')).requires_exceptional_reason; }, "allows 'max' effort without requiring an exceptional reason");
  expectSemantic('model-effort: a tier named after a role', (c) => { c['model-effort'].tiers[0].id = 'it-manager-iii'; }, 'never role rank');
  expectRuntime('a capsule claiming max effort with no reason', (rt) => { rt.capsules['AS-1001'].model_effort = { model: 'x', effort: 'max', why: 'y', escalate_when: 'z' }; }, 'recorded exceptional reason');
  expectRuntime('a capsule claiming an undeclared effort', (rt) => { rt.capsules['AS-1001'].model_effort = { model: 'x', effort: 'ludicrous', why: 'y', escalate_when: 'z' }; }, 'matches no declared risk-and-station tier');
  expectSemantic('gates: a gate claiming owner-reserved authority', (c) => { c['promotion-gates'].gates.find((g) => g.id === 'C').grants = ['release']; }, 'owner-reserved and belongs to Gate F alone');
  expectSemantic('gates: a protected transition left ungated', (c) => { c['promotion-gates'].gates = c['promotion-gates'].gates.filter((g) => g.id !== 'C'); }, 'is not guarded by any declared gate');
  expectSemantic('gates: a gate guarding an undeclared move', (c) => { c['promotion-gates'].gates.find((g) => g.id === 'A').guards_transitions = [{ from: 'accepted', to: 'released' }]; }, 'which transitions.json does not declare');
  // A gate requiring evidence nobody declares is a gate nothing can pass. Gate B
  // required 'hosted-evidence-url' against a manifest that declares
  // 'hosted-verification-receipt', and four more gates named types that existed
  // nowhere; nothing caught it until a runtime check depended on one.
  expectSemantic('gates: a gate requiring evidence the manifest does not declare', (c) => { c['promotion-gates'].gates.find((g) => g.id === 'B').required_evidence = ['hosted-evidence-url']; }, 'evidence.json does not declare');

  expectSemantic('gates: a gate whose actor is not a declared role', (c) => { c['promotion-gates'].gates.find((g) => g.id === 'A').actor_role = 'qa-team-1'; }, 'which roles.json does not declare');
  // Team-lead roster. These checks lost their plants when the self-certification
  // withdrawal removed the surrounding block; the checks survived, so the proof
  // that each can fail is restored here.
  expectSemantic('team lead: a role that is not declared', (c) => { c.teams.team_leads.role = 'ghost-lead'; }, 'is not a declared role');
  expectSemantic('team lead: a capability pool made into the lead role', (c) => { c.teams.team_leads.role = 'qa-guild'; }, 'is also a capability pool');
  expectSemantic('team lead: a team with no lead', (c) => { c.teams.team_leads.leads = c.teams.team_leads.leads.filter((l) => l.team !== 'game-systems'); }, "capability pool 'game-systems' has no team lead");
  expectSemantic('team lead: two leads claiming one team', (c) => { c.teams.team_leads.leads[1].team = c.teams.team_leads.leads[0].team; }, 'one_lead_per_team allows one');
  expectSemantic('team lead: one actor leading two teams', (c) => { c.teams.team_leads.leads[1].actor_id = c.teams.team_leads.leads[0].actor_id; }, 'is declared twice');
  expectSemantic('team lead: a lead named after a role rather than an actor', (c) => { c.teams.team_leads.leads[0].actor_id = 'maker'; }, 'a lead is an actor, not a role');
  expectSemantic('team lead: a seat name for the wrong team', (c) => { c.teams.team_leads.leads[0].seat_name = 'P | Some Lead III | qa-guild | Ashenspire'; }, "but its seat_name's team segment says");
  expectSemantic('team lead: a seat name outside the naming convention', (c) => { c.teams.team_leads.leads[0].seat_name = 'A | art helper | art-tech-art | Ashenspire'; }, 'does not follow naming_convention');
  // Leads are placed in the ladder as actors; a shared-role entry would put
  // nine teams in one slot and lose the identity the roster carries.
  // Checking only the tier left the node's ROLE free: a lead whose node said
  // 'maker' would resolve to maker through actorRole() and get maker
  // capabilities while teams.json still called it a lead.
  // Binding nodes to tl.role proved only that they agreed with each other.
  expectSemantic('team lead: the roster renaming the lead role itself', (c) => {
    c.teams.team_leads.role = 'app-dev-i';
    for (const n of c.hierarchy.nodes) if (n.role === 'team-lead') n.role = 'app-dev-i';
  }, "the roster must name the dedicated 'team-lead' role");
  // A substring match accepted a seat name whose team segment named another team.
  expectSemantic('team lead: a seat name whose team segment is a different team', (c) => { c.teams.team_leads.leads[0].seat_name = 'P | art-tech-art Lead III | qa-guild | Ashenspire'; }, "team segment says 'qa-guild'");
  // Validating only the team segment left the other three free.
  // Seat names are validated against the declared template, so both the
  // template and the names it governs are planted.
  expectSemantic('naming: a template that declares no segments', (c) => { c.teams.naming_convention.persistent_lead = 'P | nonsense'; }, 'is not four');
  expectSemantic('naming: an agent-seat template with no placeholders', (c) => { c.teams.naming_convention.agent_seat = 'A | x | y | Ashenspire'; }, 'declares no <role>');
  expectSemantic('naming: a template naming another project', (c) => { c.teams.naming_convention.persistent_lead = 'P | <role> III | <team> | OtherProject'; }, "not 'Ashenspire'");
  expectSemantic('team lead: a seat name for another project', (c) => { c.teams.team_leads.leads[0].seat_name = 'P | Art Lead III | art-tech-art | Other'; }, 'fixes it as');
  expectSemantic('team lead: a seat name missing the III level', (c) => { c.teams.team_leads.leads[0].seat_name = 'P | Art Lead | art-tech-art | Ashenspire'; }, 'does not end with');
  expectSemantic('team lead: a seat name whose role names no lead', (c) => { c.teams.team_leads.leads[0].seat_name = 'P | Something III | art-tech-art | Ashenspire'; }, 'does not name a lead');
  expectSemantic('team lead: a seat name for the wrong team', (c) => { c.teams.team_leads.leads[0].seat_name = 'P | Art Lead III | qa-guild | Ashenspire'; }, 'team segment says');
  // Six pairs that certified each other. Each plant moves BOTH halves together,
  // which is what a self-consistency check cannot see and a pin can.
  expectSemantic('pin: leads and the ladder moved to P1 together', (c) => {
    c.teams.team_leads.authority_tier = 1;
    const l2 = c.hierarchy.authority_tiers.levels.find((l) => l.p === 2);
    const l1 = c.hierarchy.authority_tiers.levels.find((l) => l.p === 1);
    const ids = c.teams.team_leads.leads.map((l) => l.actor_id);
    l2.actors = l2.actors.filter((a) => !ids.includes(a)); l1.actors.push(...ids);
  }, 'belong at P2');
  expectSemantic('pin: the charter exception routed through a class every seat can raise', (c) => {
    c.teams.charter_exception.escalation_class = 'technical-blocker';
    c.escalation.classes.find((x) => x.id === 'technical-blocker').wake = c['owner-intent'].owner.actor_id;
  }, 'must reach the owner immediately');
  // A role outside the ladder. The nine seniority roles have no standing actor,
  // so nothing placed them in a tier until they declared an archetype; each way
  // of loosening that declaration has to fail.
  expectSemantic('roles: a role with no actor and no archetype is ungoverned', (c) => { delete c.roles.roles.find((r) => r.role === 'app-dev-i').archetype; }, 'no authority tier governs what it may do');
  expectSemantic('roles: an archetype that is not a declared role', (c) => { c.roles.roles.find((r) => r.role === 'artist-ii').archetype = 'principal-engineer'; }, 'is not a declared role');
  expectSemantic('roles: an archetype chain', (c) => { c.roles.roles.find((r) => r.role === 'app-dev-i').archetype = 'app-dev-iii'; }, 'an archetype chain lets authority drift a link at a time');
  expectSemantic('roles: an archetype with no actor of its own', (c) => { c.roles.roles.find((r) => r.role === 'qa-technician-i').archetype = 'artist-iii'; c.roles.roles.find((r) => r.role === 'artist-iii').archetype = undefined; delete c.roles.roles.find((r) => r.role === 'artist-iii').archetype; }, 'has no actor in the hierarchy either');
  expectSemantic('roles: a seniority level widening its approval ceiling', (c) => { c.roles.roles.find((r) => r.role === 'app-dev-iii').approval_ceiling = 'integration-to-dev'; }, 'never a wider authority ceiling');
  expectSemantic('roles: a seniority level granting itself an extra action', (c) => { c.roles.roles.find((r) => r.role === 'app-dev-iii').may.push('push-pr-merge-deploy-or-release'); }, 'its may differs');
  expectSemantic('roles: a seniority level dropping one of its must_nots', (c) => { const r = c.roles.roles.find((x) => x.role === 'qa-technician-iii'); r.must_not = r.must_not.filter((m) => m !== 'review-own-implementation'); }, 'its must_not differs');
  expectSemantic('roles: a seniority level dropping one of its musts', (c) => { const r = c.roles.roles.find((x) => x.role === 'artist-i'); r.must = []; }, 'its must differs');
  expectSemantic('pin: branch-rewrite permission moved off the deputy', (c) => { c['git-ownership'].branch_hygiene.permission_role = 'help-desk'; }, 'moving the tier text does not transfer it');
  // Deriving one mutable declaration from another is not a constraint: move the
  // tier text to P2 as well and the two agree again, which is exactly what the
  // previous version of this check permitted. Both halves are pinned to the
  // recorded deputy identity now, so moving them together still fails.
  const moveRewriteTierTo = (c, p) => {
    for (const l of c.hierarchy.authority_tiers.levels) {
      const at = l.holds.findIndex((h) => /branch-rewrite/i.test(h));
      if (at >= 0) { const [text] = l.holds.splice(at, 1); c.hierarchy.authority_tiers.levels.find((x) => x.p === p).holds.push(text); return; }
    }
  };
  expectSemantic('pin: tier text and permission_role moved together still fails', (c) => { c['git-ownership'].branch_hygiene.permission_role = 'help-desk'; moveRewriteTierTo(c, 2); }, 'moving the tier text does not transfer it');
  expectSemantic('pin: the ladder itself moved off the deputy', (c) => { moveRewriteTierTo(c, 2); }, 'does not include the deputy');
  expectSemantic('pin: no tier claims branch-rewrite permission at all', (c) => { for (const l of c.hierarchy.authority_tiers.levels) l.holds = l.holds.filter((h) => !/branch-rewrite/i.test(h)); }, 'the ladder and git-ownership disagree about who holds it');
  expectSemantic('pin: a promotion gate gated by the seat it gates', (c) => {
    c['promotion-gates'].gates.find((x) => x.id === 'A').actor_role = 'maker';
    for (const tr of c.transitions.transitions) if (!tr.protected) tr.permitted_actor_roles.push('maker');
  }, 'never passed by the seat whose work it gates');
  expectSemantic('pin: the deputy moved to another actor', (c) => { c['owner-intent'].deputy.actor_id = 'help-desk'; }, 'the deputy is the IT Manager III by decision');
  expectSemantic('pin: a delivery seat convening its own pod', (c) => { c.teams.pods.formed_by = 'maker'; }, 'cannot convene its own pod');

  expectSemantic('team lead: an actor in no authority tier', (c) => {
    const lv = c.hierarchy.authority_tiers.levels.find((l) => l.p === 2);
    lv.actors = lv.actors.filter((a) => a !== 'lead-qa-guild');
  }, "team lead 'lead-qa-guild' is in no authority tier");
  expectSemantic('team lead: the ladder placing the shared role instead of the actors', (c) => {
    c.hierarchy.authority_tiers.levels.find((l) => l.p === 2).actors.push('team-lead');
    c.hierarchy.nodes.push({ actor_id: 'team-lead', role: 'team-lead', escalation_parent: 'it-manager-iii', owns_escalations: ['x'] });
  }, 'collapses every team into one slot');
  // An actor is not its role: both of these read the id directly until leads
  // got identities that differ from the role they hold.
  // Dispatch compared the actor id against a list of roles, so a lead-owned
  // ticket woke 'maker'. One helper now serves all four sites that had this.
  {
    const rtLead = baseRt();
    rtLead.capsules['AS-HD-050'].owner_actor = 'lead-game-systems';
    // The plant tests the actor-vs-role conflation only; clear the live blocker
    // so a blocked capsule (which wakes the blocker's owner) cannot mask it.
    rtLead.capsules['AS-HD-050'].blocker = null;
    const d = computeDispatch(contracts, rtLead, { now: new Date().toISOString() }).find((x) => x.ticket === 'AS-HD-050');
    results.push({ label: 'dispatch wakes the lead that owns the capsule, not a role that does not', pass: !!d && d.wake === 'lead-game-systems', errs: [d ? d.wake : '(no entry)'] });
    const w = runWake(root, 'maker', 'AS-1001');
    results.push({ label: "the wake capsule reports the actor's role, not its id again", pass: !!w.text && /role=maker/.test(w.text), errs: [] });
  }

  // The path and ref entitlement checks compared an actor id against an
  // owner ROLE — the sixth and seventh sites of the same conflation.
  {
    const rtLead = baseRt();
    const c = rtLead.capsules['AS-HD-050'];
    c.owner_actor = 'lead-game-systems'; c.authority.may = ['spin-out-agent-seat']; c.affected_paths = [];
    const l = rtLead.leases.find((x) => x.id === c.writer_lease);
    l.actor = 'lead-game-systems'; l.path_globs = []; delete l.path_grant_exception;
    const errs = runtimeChecks(contracts, rtLead).filter((e) => e.includes('lead-game-systems'));
    results.push({ label: 'a lead can hold a path-free lease on its own ticket', pass: errs.length === 0, errs });
  }
  expectRuntime('a lease claiming a path its actor\'s role does not own', (rt) => {
    const l = rt.leases.find((x) => x.id === 'lease-AS-HD-050-maker');
    l.actor = 'lead-game-systems'; delete l.path_grant_exception;
  }, 'git-ownership assigns that path to');

  expectRuntime('a seat whose actor resolves to no role at all', (rt) => { rt.capsules['AS-1001'].owner_actor = 'nobody-at-all'; }, 'resolves to no declared role');

  expectSemantic('naming: a numbered P used as a seat kind', (c) => { c.teams.naming_convention.persistent_lead = 'P2 | <role> III | <team> | Ashenspire'; }, 'authority-tier namespace, not a seat kind');
  expectSemantic('naming: the two P namespaces no longer distinguished', (c) => { c.teams.naming_convention.not_the_tier_namespace = 'use judgement'; }, 'would be read as one');
  expectSemantic('teams: a legacy alias routing nowhere', (c) => { c.teams.legacy_aliases[0].routes_to = 'ghost-pool'; }, 'neither a standing role nor a capability pool');
  expectRuntime('a capsule naming a team that is on no roster', (rt) => { rt.capsules['AS-HD-050'].team = 'audio'; }, 'nor a declared legacy alias');
  expectRuntime('a capability pool holding a seat', (rt) => { rt.capsules['AS-HD-040'].owner_actor = 'art-tech-art'; }, 'is a capability pool, not a standing team');

  // Stage 9 — the tool's own header (issue #392, D8). Enters through the same
  // pure function the live check uses, with a header that omits one command.
  {
    const src = readFileSync(resolve(ROOT, 'tools/opsctl.mjs'), 'utf8');
    const live = subcommandDocErrors(opsctlHeader(src), src);
    results.push({ label: 'opsctl header documents every dispatched subcommand', pass: live.length === 0, errs: live });

    // Stage 9b — every runRender() consumer reads both failure modes.
    const consumers = renderResultConsumerErrors(src);
    results.push({ label: 'every runRender() call site checks .errors as well as .drift', pass: consumers.length === 0, errs: consumers });
    const reverted = src.replace(/  if \(r\.errors && r\.errors\.length\) return r\.errors;\r?\n/, '');
    const caughtC = renderResultConsumerErrors(reverted);
    results.push({ label: 'consumer check catches a call site that drops .errors', pass: caughtC.some((e) => e.includes("checking 'r.errors'")), errs: caughtC });
    // Both failure modes, or the check only half does its job.
    // Replace the LAST occurrence: the plant's own needle appears earlier in
    // this file as a string literal, so a plain .replace() edited the plant
    // rather than the call site. That went unnoticed while string literals were
    // still being scanned as code, and became a silent no-op once they were not.
    const needle = 'const { errors, drift, drifted, wrote } = runRender(';
    const cut = src.lastIndexOf(needle);
    const noDrift = src.slice(0, cut) + 'const { errors, drifted, wrote } = runRender(' + src.slice(cut + needle.length);
    // A line-oriented scan missed ordinary multiline formatting entirely.
    const newline = src.includes('\r\n') ? '\r\n' : '\n';
    const multiline = src.replace('  const r = runRender(root, true);', `  const r =${newline}    runRender(root, true);`).replace(/  if \(r\.errors && r\.errors\.length\) return r\.errors;\r?\n/, '');
    const caughtM = renderResultConsumerErrors(multiline);
    results.push({ label: 'consumer check sees a call site split across lines', pass: caughtM.some((e) => e.includes("checking 'r.errors'")), errs: caughtM });
    // ...and a call shape it cannot inspect must be reported, not passed over.
    const caughtB = renderResultConsumerErrors(src + '\nfunction sneak() { runRender(ROOT, true); }\n');
    results.push({ label: 'consumer check reports an uninspectable call shape', pass: caughtB.some((e) => e.includes('cannot inspect')), errs: caughtB });
    // ...while its own error strings and comments are not call sites.
    results.push({ label: 'consumer check does not match its own message text', pass: renderResultConsumerErrors(src).length === 0, errs: renderResultConsumerErrors(src) });
    // ...and the blanking must not have swallowed the source. A stray backtick
    // in a regex literal did exactly that, and the checks it disabled all
    // reported success.
    const sites = countRenderCallSites(src);
    results.push({ label: 'blanking leaves every runRender() call site visible', pass: sites >= 4, errs: [String(sites)] });
    const caughtD = renderResultConsumerErrors(noDrift);
    results.push({ label: 'consumer check catches a call site that drops .drift', pass: caughtD.some((e) => e.includes("without 'drift'")), errs: caughtD });
    const gutted = opsctlHeader(src).split('\n').filter((l) => !/^\/\/   wake /.test(l)).join('\n');
    const caught = subcommandDocErrors(gutted, src);
    const hit = caught.some((e) => e.includes("'wake'"));
    results.push({ label: 'header check catches an undocumented subcommand', pass: hit, errs: hit ? [] : caught });
  }

  // Stage 10 — the human view's completeness. `verify` proves only that the
  // committed view matches what `render` emits; it cannot notice that `render`
  // emits nothing at all for a whole contract, and five were in exactly that
  // state. Every contract must therefore reach the view, including the six that
  // state no `principle` — an earlier cut exempted those, which Codex correctly
  // called out as proving nothing for them. Each block is deleted in turn.
  {
    const govText = renderGovernance(contracts);
    results.push({ label: 'generated governance view projects every contract', pass: viewCoverageErrors(contracts, govText).length === 0, errs: viewCoverageErrors(contracts, govText) });
    results.push({ label: 'no two contracts share a view probe', pass: probeStrengthErrors(contracts, govText).length === 0, errs: probeStrengthErrors(contracts, govText) });

    // Every rendered section, swept generically. A hardcoded section list was
    // the first attempt and it hid the same bug one level down: contracts that
    // render several blocks were probed by one value that lived in the earliest
    // block, so `## Authority tiers`, `### Branch hygiene`, `### Paths`,
    // `### Canonical documents`, `### Charter exception`, `### Where a question
    // goes` and `## Owner and deputy` could all be deleted with `verify` still
    // green (Codex named three; the sweep found seven). Enumerating headings
    // from the rendered text instead means a section added later is covered the
    // day it appears, with no list to remember to update.
    const lines = govText.split('\n');
    const heads = [];
    lines.forEach((l, i) => { if (/^#{2,3} /.test(l)) heads.push(i); });
    let swept = 0;
    for (let k = 0; k < heads.length; k++) {
      const a = heads[k];
      const b = k + 1 < heads.length ? heads[k + 1] : lines.length;
      // A heading with no body of its own carries no contract data, so its
      // removal is a formatting loss rather than a policy loss.
      if (!lines.slice(a + 1, b).some((x) => x.trim())) continue;
      swept++;
      const blinded = lines.slice(0, a).concat(lines.slice(b)).join('\n');
      const errs = viewCoverageErrors(contracts, blinded);
      results.push({ label: `coverage check catches the deletion of ${JSON.stringify(lines[a])}`, pass: errs.length > 0, errs: errs.length ? [] : ['deleted with no error reported'] });
    }
    results.push({ label: 'the section sweep found sections to sweep', pass: swept >= 25, errs: [String(swept)] });

    // Sections were swept; rows were not, and a section survives losing a row.
    // 53 of 163 rendered rows could be deleted with the gate green, because
    // most probes were bare ids that also appear in prose elsewhere. Probes are
    // rendered-row shaped now, and this holds that. Table headers are excluded
    // on the same ground as a body-less section: losing one is a formatting
    // loss, not a policy loss.
    let rows = 0;
    const undeletable = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      // Table rows AND bullet policy lines. Sweeping only `| ` rows left the
      // Roles section — which renders as bullets — entirely unswept, so a
      // role's `May`, `Must`, `Must not` or ceiling line could be dropped with
      // the gate green. That is the same "I checked one shape and reported it
      // as all shapes" error the section sweep was written to end.
      const isRow = /^\| /.test(l) && !/^\|---/.test(l) && !/^\| *[A-Z#]/.test(l);
      const isPolicyBullet = (/^- /.test(l) || /^  - /.test(l)) && !/:\*\*$/.test(l) && !/:$/.test(l);
      if (!isRow && !isPolicyBullet) continue;
      rows++;
      const without = lines.slice(0, i).concat(lines.slice(i + 1)).join('\n');
      if (viewCoverageErrors(contracts, without).length === 0) undeletable.push(l.slice(0, 70));
    }
    results.push({ label: 'deleting any rendered policy row or bullet fails the coverage gate', pass: undeletable.length === 0, errs: undeletable.slice(0, 8) });
    results.push({ label: 'the row sweep found rows to sweep', pass: rows >= 100, errs: [String(rows)] });

    // A row can survive losing a COLUMN. Probes that stopped at a prefix let 58
    // rows across ten tables blank their last cell — including whether an
    // authority grant is protected, what evidence authorizes it, and an
    // envelope's actions and validity window. Every table probe is the whole
    // rendered row now; this is what holds that, since my judgement of which
    // columns "obviously" needed probing was wrong ten times.
    let cells = 0;
    const blankable = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!/^\| /.test(l) || /^\|---/.test(l) || /^\| *[A-Z#]/.test(l)) continue;
      const parts = l.split('|');
      if (parts.length < 5) continue;
      cells++;
      // Every cell, not just the last: blanking only the trailing one left the
      // hierarchy rows' actor, role and escalation-parent cells untested.
      for (let k = 1; k < parts.length - 1; k++) {
        const cells = parts.slice();
        cells[k] = ' OMITTED ';
        const mutated = lines.slice(0, i).concat([cells.join('|')], lines.slice(i + 1)).join('\n');
        if (viewCoverageErrors(contracts, mutated).length === 0) blankable.push(`${l.slice(0, 50)} [cell ${k}]`);
      }
    }
    results.push({ label: 'blanking any cell of any table row fails the coverage gate', pass: blankable.length === 0, errs: blankable.slice(0, 8) });
    results.push({ label: 'the column sweep found rows to sweep', pass: cells >= 80, errs: [String(cells)] });

    // Prose paragraphs. Sections, bullets and table cells were each swept; the
    // sentences between them were not, and 22 of them were unprobed — the
    // handoff receipt rule, the routing SLA, the lifecycle state list, the
    // branch-hygiene default, "a changed candidate restarts Gate A", and the
    // rule that a P-level never selects a model. The three lines of the
    // generated-projection disclaimer are static text with no contract behind
    // them, so they are the only exemption.
    const DISCLAIMER = 'This Markdown is a projection of validated JSON contracts';
    const disclaimerAt = lines.findIndex((l) => l.startsWith(DISCLAIMER));
    let prose = 0;
    const unprobed = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.trim() || /^#{1,3} /.test(l) || /^\|/.test(l) || /^- /.test(l) || /^  - /.test(l) || /^\x60\x60\x60/.test(l) || /^<!--/.test(l)) continue;
      if (disclaimerAt >= 0 && i >= disclaimerAt && i <= disclaimerAt + 2) continue;
      prose++;
      const without = lines.slice(0, i).concat(lines.slice(i + 1)).join('\n');
      if (viewCoverageErrors(contracts, without).length === 0) unprobed.push(l.slice(0, 60));
    }
    results.push({ label: 'deleting any rendered prose line fails the coverage gate', pass: unprobed.length === 0, errs: unprobed.slice(0, 8) });
    results.push({ label: 'the prose sweep found lines to sweep', pass: prose >= 20, errs: [String(prose)] });

    // Unrendered contract fields. No deletion sweep can see these, so the count
    // is ratcheted: it may fall, never rise. 105 when the audit was written;
    // 21 now, after the rules blocks, the gate detail blocks, the owner override
    // rules, the deputy's grant window, the promotion-packet fields, the
    // escalation hazards, the evidence freshness rules and the legacy maps were
    // all projected — and after the audit stopped counting a correctly escaped
    // value as unrendered.
    //
    // What is left is deliberate, not deferred: `project.*` is tool scaffolding
    // (engine stack, runtime artifact paths, provider names) rather than
    // governance a reader needs, a handful of `note` fields are provenance for
    // the contract author, and owner-intent.owner.identifiers carries a personal
    // email address that should not be projected into more artifacts than
    // already hold it.
    const rtAll = loadRuntime(root);
    const everything = generatedArtifacts(contracts, rtAll).map((a) => a.text).join('\n');
    const unrendered = unrenderedFieldPaths(contracts, everything);
    const RATCHET = 21;
    results.push({ label: `unrendered contract fields do not grow past ${RATCHET}`, pass: unrendered.length <= RATCHET, errs: unrendered.slice(0, 10) });
    results.push({ label: 'the unrendered-field audit is actually looking at contracts', pass: unrendered.length < 400, errs: [String(unrendered.length)] });

    // ...and every contract's rules are projected and probed. 41 rule values
    // across twelve contracts were machine-checked and humanly invisible until
    // the Enforced invariants section; the probe augmentation means a rule
    // added tomorrow is probed the same day, so both directions are planted:
    // a rule whose text drifts from the view, and a rule the view never gained.
    const drifted = { ...contracts, delegation: { ...contracts.delegation, rules: { ...contracts.delegation.rules, subset_of_parent: 'a child may delegate whatever it likes' } } };
    const driftErrs = viewCoverageErrors(drifted, govText);
    results.push({ label: 'a rule reworded in the contract but not the view fails coverage', pass: driftErrs.length > 0, errs: driftErrs });
    const gained = { ...contracts, raci: { ...contracts.raci, rules: { ...contracts.raci.rules, brand_new_rule: 'a rule nobody projected' } } };
    const gainedErrs = viewCoverageErrors(gained, govText);
    results.push({ label: 'a rule added to a contract but absent from the view fails coverage', pass: gainedErrs.length > 0, errs: gainedErrs });

    // ...and a gate's detail block. The gates table carries six columns; the
    // other nine field paths a gate declares rendered nowhere, and they are the
    // ones that say what invalidates the gate and what does not satisfy it.
    // Two gates share an `invalidated_by` value, so a per-bullet probe was
    // satisfied by the other gate's copy — the probe is the whole block.
    const gateDrift = { ...contracts, 'promotion-gates': { ...contracts['promotion-gates'], gates: contracts['promotion-gates'].gates.map((g) => (g.id === 'B' ? { ...g, not_satisfied_by: ['a PR alone'] } : g)) } };
    const gateErrs = viewCoverageErrors(gateDrift, govText);
    results.push({ label: "a gate's not_satisfied_by narrowed in the contract but not the view fails coverage", pass: gateErrs.length > 0, errs: gateErrs });
    const gateGain = { ...contracts, 'promotion-gates': { ...contracts['promotion-gates'], gates: contracts['promotion-gates'].gates.map((g) => (g.id === 'A' ? { ...g, blocks_on: ['a condition nobody projected'] } : g)) } };
    const gainErrs = viewCoverageErrors(gateGain, govText);
    results.push({ label: 'a gate condition added to the contract but absent from the view fails coverage', pass: gainErrs.length > 0, errs: gainErrs });

    // ...and a contract added with no probe at all must fail rather than skip.
    const withGhost = { ...contracts, 'ghost-contract': { principle: 'a contract nobody projected' } };
    const ghost = viewCoverageErrors(withGhost, govText);
    results.push({ label: 'a contract with no declared view probe is a failure, not a skip', pass: ghost.some((e) => e.includes('declares no view probe')), errs: ghost });
    // ...and a missing governance artifact is the loudest case, not a skipped one.
    const rtNow2 = loadRuntime(root);
    const artsNow = generatedArtifacts(contracts, rtNow2);
    results.push({ label: 'the governance gate passes on the real artifact list', pass: governanceGateErrors(contracts, artsNow).length === 0, errs: governanceGateErrors(contracts, artsNow) });
    const without = governanceGateErrors(contracts, artsNow.filter((a) => a.rel !== GENERATED_VIEW));
    results.push({ label: 'a missing governance view fails rather than skipping the gate', pass: without.some((e) => e.includes('is missing and nothing downstream')), errs: without });

    // ...and a probe shared between two contracts must be reported. Probes are
    // rendered-row shaped now, so the collision is planted on a principle,
    // which two contracts can state identically.
    const shared = probeStrengthErrors({ ...contracts, evidence: { ...contracts.evidence, principle: contracts.qa.principle } }, govText);
    results.push({ label: 'probe-strength check catches a shared probe value', pass: shared.some((e) => e.includes('lets one contract mask the other')), errs: shared });
    // ...and a probe that is unique among the declared sets but still appears
    // in two rendered sections is equally useless, which is how an authority
    // row survived deletion: its action was also a line in the Roles `may` list.
    const dupLine = govText.split('\n').find((l) => l.startsWith('Project: **'));
    const crossSection = probeStrengthErrors(contracts, `${govText}\n## Elsewhere\n\n${dupLine}\n`);
    results.push({ label: 'probe-strength check catches a probe spanning two rendered sections', pass: crossSection.some((e) => e.includes('rendered sections')), errs: crossSection });

    // ...and a contract value carrying a raw '|' must not be able to split a
    // rendered row unnoticed. This is planted on owner_role, which is NOT
    // wrapped in mdCell, precisely because the guard has to hold for the fields
    // nobody remembered to escape — that is how the delegation scope paths
    // shipped one commit after the same bug was fixed for seat names.
    const piped = base();
    piped['git-ownership'].paths[0].owner_role = 'maker | or whoever';
    const split = tableShapeErrors(renderGovernance(piped));
    results.push({ label: "an unescaped '|' in a contract value fails the table-shape gate", pass: split.some((e) => e.includes("unescaped '|'")), errs: split });
    // ...and the escape has to actually work where it IS applied: the same
    // pipe, in a field routed through mdCell, must render a well-shaped table.
    const escaped = base();
    escaped.delegation.envelopes[0].scope_paths.push('src/a|b/**');
    const escapedText = renderGovernance(escaped);
    results.push({ label: 'mdCell keeps a piped scope path inside one cell', pass: tableShapeErrors(escapedText).length === 0 && escapedText.includes('a\\|b'), errs: tableShapeErrors(escapedText) });
    // ...and the table-shape gate is reachable from the gate the renderer runs,
    // not merely exported.
    const shapeGate = governanceGateErrors(piped, [{ rel: GENERATED_VIEW, text: renderGovernance(piped) }]);
    results.push({ label: 'the governance gate runs the table-shape check', pass: shapeGate.some((e) => e.includes("unescaped '|'")), errs: shapeGate.slice(0, 3) });
  }

  const failed = results.filter((r) => !r.pass);
  return { ok: failed.length === 0, results, detail: failed.map((r) => `PLANT NOT CAUGHT: ${r.label}${r.errs ? ' | got: ' + JSON.stringify(r.errs) : ''}`) };
}


// ---------------------------------------------------------------------------
// Dispatch: which seats are due to be woken, and who reaches the Owner.
//
// Every answer is DERIVED from the contracts, never from a hand-maintained
// list and never from the capsule's own say-so:
//   - a blocked capsule routes by its declared escalation_class, and the class
//     in escalation.json names the wake target. A capsule cannot nominate who
//     it escalates to, so nothing can route itself to the Owner to jump a queue
//     or route away from the Owner to dodge a protected decision.
//   - an unblocked capsule is due for whoever transitions.json says may move it
//     out of its current state. Terminal states have no outgoing move and wake
//     nobody; a state whose every outgoing move is protected is the Owner's.
// The workflow that consumes this stays dumb: it files issues, it decides
// nothing.
// ---------------------------------------------------------------------------
export function computeDispatch(contracts, rt, { now = new Date().toISOString() } = {}) {
  const esc = contracts.escalation;
  const owner = contracts['owner-intent'].owner.actor_id;
  const classById = new Map(esc.classes.map((c) => [c.id, c]));
  const moves = contracts.transitions.transitions;
  const entries = [];

  const escalate = (cap, classId, why) => {
    const cls = classById.get(classId);
    // Unreachable via validate (a declared class is enforced there); belt and
    // braces so a dispatch can never silently drop a blocked seat.
    if (!cls) return { ticket: cap.ticket, kind: 'owner-decision', wake: owner, reason: `${why} (undeclared escalation class '${classId}')`, escalation_class: classId };
    return {
      ticket: cap.ticket,
      kind: cls.wake === owner ? 'owner-decision' : 'seat-wake',
      wake: cls.wake,
      route: cls.route,
      reason: why,
      escalation_class: classId,
      continuing_work_allowed: cls.continuing_work_allowed,
    };
  };

  for (const ticket of Object.keys(rt.capsules).sort()) {
    const cap = rt.capsules[ticket];
    const lease = rt.leases.find((l) => l.id === cap.writer_lease);
    const leaseIsActive = !!lease && activeRuntimeLeases(rt).includes(lease);
    const outgoing = moves.filter((m) => m.from === cap.lifecycle_state);
    if (!outgoing.length) continue;                       // terminal: wakes nobody

    if (cap.blocker) {
      entries.push(escalate(cap, cap.blocker.escalation_class, cap.blocker.summary));
      continue;
    }

    // A seat with no live lease cannot act, and the lease is not its own to
    // reissue — that is an ownership question, so it escalates rather than
    // waking a seat that would immediately stop.
    // Numeric, and fail-closed: an expiry that does not denote a real instant
    // cannot be shown to be in the future, so the seat does not act on it.
    // '<=' on the strings was lexicographic and only worked while every
    // timestamp happened to be the same fixed-width UTC shape.
    const lx = lease ? utcInstant(lease.expiry) : null;
    const nowMs = utcInstant(now) ?? Date.parse(now);
    const dead = !lease ? 'writer lease is missing'
      : lease.revoked ? `writer lease ${lease.id} is revoked`
      : !leaseIsActive ? `writer lease ${lease.id} is superseded`
      : lx === null ? `writer lease ${lease.id} records expiry '${lease.expiry}', which is not a real instant`
      : (lx <= nowMs) ? `writer lease ${lease.id} expired ${lease.expiry}`
      : null;
    if (dead) { entries.push(escalate(cap, 'technical-blocker', dead)); continue; }

    const open = outgoing.filter((m) => !m.protected);
    if (!open.length) {
      entries.push({
        ticket, kind: 'owner-decision', wake: owner,
        reason: `every move out of '${cap.lifecycle_state}' is a protected transition`,
        next_states: outgoing.map((m) => m.to),
      });
      continue;
    }
    const roles = [...new Set(open.flatMap((m) => m.permitted_actor_roles))];
    entries.push({
      ticket,
      kind: 'seat-wake',
      // The capsule's own actor only gets the wake when the contract agrees it
      // may move this state; otherwise the permitted role does, whoever holds it.
      // Resolve the owner's ROLE to test permission, but wake the ACTOR: a
      // lead-owned ticket used to wake 'maker' because the id was compared
      // against a list of roles and never matched.
      wake: roles.includes(actorRole(contracts, cap.owner_actor)) ? cap.owner_actor : roles[0],
      eligible_roles: roles,
      reason: `'${cap.lifecycle_state}' is ready to move to ${open.map((m) => m.to).join(' or ')}`,
      next_states: open.map((m) => m.to),
    });
  }
  return entries;
}


// ---------------------------------------------------------------------------
// Reseal: re-establish a capsule's compare-and-swap seal after its content
// legitimately changed, WITHOUT losing the chain that proves what it succeeded.
//
// Hand-resealing is how the AS-HD-029 chain broke twice: the content was
// updated and the file re-hashed, but `revision` stayed put and `parent_hash`
// stayed null, so the successor link to the previous seal was simply gone. The
// predecessor is therefore never taken from the working tree (which by then
// already holds the new content) — it is read from the last COMMITTED version
// of the same file, the one a clean clone would reconstruct.
// ---------------------------------------------------------------------------
export function committedCapsuleSeal(root, ticket) {
  const rel = `.agentops/work/${ticket}/CURRENT.json`;
  try {
    const raw = execFileSync('git', ['show', `HEAD:${rel}`], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const prev = JSON.parse(raw);
    return { seal: prev.current_hash || null, revision: prev.revision || 0 };
  } catch {
    return { seal: null, revision: 0 };   // genesis: never committed before
  }
}

export function runReseal(root, ticket, { reason, actor, now = new Date().toISOString() } = {}) {
  const file = resolve(root, 'work', ticket, 'CURRENT.json');
  if (!existsSync(file)) return { ok: false, errors: [`no capsule for '${ticket}' under .agentops/work/`] };
  if (!reason) return { ok: false, errors: ['reseal requires --reason: an unexplained reseal is indistinguishable from tampering'] };

  const cap = JSON.parse(readFileSync(file, 'utf8'));
  const prior = committedCapsuleSeal(root, ticket);
  const who = actor || cap.owner_actor;

  // Nothing changed but the seal? Then there is nothing to record and no new
  // revision to mint — resealing anyway would inflate the chain with a link
  // that proves nothing.
  const restored = { ...cap, current_hash: prior.seal || '' };
  if (prior.seal && computeCapsuleHash(restored) === prior.seal && cap.revision === prior.revision) {
    return { ok: true, unchanged: true, ticket, seal: prior.seal };
  }

  cap.revision = prior.revision + 1;
  cap.parent_hash = prior.seal;
  cap.current_hash = '';
  cap.current_hash = computeCapsuleHash(cap);
  writeFileSync(file, JSON.stringify(cap, null, 2) + '\n');

  const dir = resolve(root, 'events', ticket);
  mkdirSync(dir, { recursive: true });
  const seq = readdirSync(dir).filter((f) => f.endsWith('.json')).length + 1;
  const id = `${ticket}-${String(seq).padStart(4, '0')}`;
  const ev = {
    schema: 'agentops/event/v1',
    id,
    ticket,
    seq,
    parent_event: seq > 1 ? `${ticket}-${String(seq - 1).padStart(4, '0')}` : null,
    kind: 'state-change',
    actor: who,
    at: now,
    summary: `${reason} Resealed as revision ${cap.revision}; parent_hash names ${prior.seal || 'no predecessor (genesis)'}.`,
  };
  writeFileSync(resolve(dir, `${id}.json`), JSON.stringify(ev, null, 2) + '\n');
  return { ok: true, ticket, revision: cap.revision, seal: cap.current_hash, parent: prior.seal, event: id };
}


// ---------------------------------------------------------------------------
// Reseat: advance an UNSTARTED seat's base to live HEAD.
//
// A capsule's base_oid pins the commit its instructions were written against.
// Every merge to dev moves HEAD, so a seat that was assigned days ago wakes to
// `FRESHNESS: STALE ... re-seat before mutating` and correctly stops. Without a
// tool for this, every seat stops forever and the executor just files issues
// nobody can act on.
//
// Only 'proposed' and 'assigned' reseat. Those seats have done nothing, so
// starting from current HEAD is what they wanted anyway. A capsule that is
// already in-progress has work standing on its base: moving it would silently
// rebase a seat's assumptions, so that stays a human decision.
// ---------------------------------------------------------------------------
const RESEATABLE = new Set(['proposed', 'assigned']);

export function runReseat(root, ticket, { actor = null, now = new Date().toISOString() } = {}) {
  const file = resolve(root, 'work', ticket, 'CURRENT.json');
  if (!existsSync(file)) return { ok: false, errors: [`no capsule for '${ticket}' under .agentops/work/`] };
  const cap = JSON.parse(readFileSync(file, 'utf8'));
  if (!RESEATABLE.has(cap.lifecycle_state)) {
    return { ok: false, errors: [`capsule ${ticket} is '${cap.lifecycle_state}', not unstarted; work already stands on its base, so re-seating it is not automatic`] };
  }
  const head = currentHead(root);
  if (!head) return { ok: false, errors: ['no live HEAD to reseat onto'] };
  // A detached HEAD is not a place a seat can be sent. CI checks a pull request
  // out as a synthetic merge commit that no branch carries and nothing keeps;
  // reseating there would pin every capsule to a SHA that disappears when the
  // run ends, and a clean clone could never reconstruct the base. Caught in CI
  // by exactly that mechanism.
  if (!onBranch(root)) {
    return { ok: false, errors: [`HEAD is detached at ${head.slice(0, 12)}; reseating would pin the capsule to a commit no branch carries`] };
  }
  // A tracking capsule freezes here. runtimeChecks rejects a started capsule
  // that still carries base_ref, and the first version of this branch shipped
  // that check with no action that clears it — so a capsule that adopted the
  // pointer could never start. The freeze and its check now exist together, and
  // the early return below must not pre-empt it: a tracking capsule whose
  // recorded base already equals HEAD still has a pointer to drop.
  const freezing = !!cap.base_ref;
  if (!freezing && cap.base_oid === head) return { ok: true, unchanged: true, ticket, base: head };

  const from = cap.base_oid;
  const tracked = freezing ? resolveRef(root, cap.base_ref) : null;
  if (freezing && tracked === null) {
    return { ok: false, errors: [`capsule ${ticket} tracks '${cap.base_ref}', which this checkout does not carry; a pointer that cannot be resolved cannot be frozen into a base`] };
  }
  const frozenRef = cap.base_ref;
  cap.base_oid = freezing ? tracked : head;
  if (freezing) delete cap.base_ref;
  writeFileSync(file, JSON.stringify(cap, null, 2) + '\n');
  const r = runReseal(root, ticket, {
    actor: actor || TOOL_ACTOR,
    now,
    reason: freezing
      ? `Froze tracked base '${frozenRef}' to ${tracked.slice(0, 12)}; the seat is starting work, so the branch it followed becomes the tree it works from and the pointer is dropped.`
      : `Reseated from ${from.slice(0, 12)} to live HEAD ${head.slice(0, 12)}; the seat had not started, so its base follows the branch rather than pinning a commit it never worked from.`,
  });
  if (!r.ok) return r;
  // The OID actually written, not HEAD: on the freezing path the base becomes
  // the resolved ref, which need not be HEAD, so returning `head` made the CLI
  // report a move that did not happen.
  return { ok: true, ticket, from, base: cap.base_oid, froze: freezing ? frozenRef : null, revision: r.revision, event: r.event };
}

// `reseat --all` used to live here. It is gone, and the reason is on the record:
// running it after every governance commit appended 423 no-op events across
// nine seats in one session — 92.6% of the ledger on `dev` — each signed with
// the seat's own actor although no seat acted. Ruling AS-HD-029-0052:
// > A capsule in `assigned` with no prior work state-change does not need its
// > base chased. Reseat is seat-initiated at start of work, never a post-commit
// > sweep.
// A seat that is about to start work reseats its own capsule, once. Nothing
// sweeps.

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
  if (cmd === 'reseat') {
    let work = null, actor = null;
    for (let i = 1; i < argv.length; i++) {
      if (argv[i] === '--work') work = argv[++i];
      else if (argv[i] === '--actor') actor = argv[++i];
    }
    if (flags.has('--all')) {
      console.error('reseat --all is withdrawn: a post-commit sweep appends a no-op event per seat, signed with that seat\'s actor although no seat acted (ruling AS-HD-029-0052). Reseat one ticket, at the seat that is starting work.');
      return 2;
    }
    if (!work) { console.error('reseat requires --work <ticket>'); return 2; }
    const r = runReseat(ROOT, work, { actor });
    if (!r.ok) { console.error('RESEAT FAIL:'); r.errors.forEach((e) => console.error('  - ' + e)); return 1; }
    if (r.unchanged) { console.log(`RESEAT: ${r.ticket} is already on live HEAD.`); return 0; }
    console.log(`RESEAT OK: ${r.ticket} ${r.from.slice(0, 12)} -> ${r.base.slice(0, 12)} (revision ${r.revision}, ${r.event})`);
    return 0;
  }
  if (cmd === 'reseal') {
    let work = null, reason = null, actor = null;
    for (let i = 1; i < argv.length; i++) {
      if (argv[i] === '--work') work = argv[++i];
      else if (argv[i] === '--reason') reason = argv[++i];
      else if (argv[i] === '--actor') actor = argv[++i];
    }
    if (!work) { console.error('reseal requires --work <ticket> --reason "<why>" [--actor <role>]'); return 2; }
    const r = runReseal(ROOT, work, { reason, actor });
    if (!r.ok) { console.error('RESEAL FAIL:'); r.errors.forEach((e) => console.error('  - ' + e)); return 1; }
    if (r.unchanged) { console.log(`RESEAL: ${r.ticket} already matches its committed seal; nothing to record.`); return 0; }
    console.log(`RESEAL OK: ${r.ticket} revision ${r.revision}\n  seal   ${r.seal}\n  parent ${r.parent || '(genesis)'}\n  event  ${r.event}`);
    return 0;
  }
  if (cmd === 'dispatch') {
    const json = flags.has('--json');
    const { contracts, errors } = runValidate();
    if (errors.length) { console.error('DISPATCH FAIL: state is not valid; refusing to wake anyone.'); errors.forEach((e) => console.error('  - ' + e)); return 1; }
    const entries = computeDispatch(contracts, loadRuntime());
    if (json) { console.log(JSON.stringify(entries, null, 2)); return 0; }
    if (!entries.length) { console.log('DISPATCH: nothing due.'); return 0; }
    for (const e of entries) console.log(`${e.kind === 'owner-decision' ? 'OWNER ' : 'SEAT  '} ${e.ticket}  wake=${e.wake}  ${e.reason}`);
    const owed = entries.filter((e) => e.kind === 'owner-decision').length;
    console.log(`\nDISPATCH: ${entries.length} due (${owed} need the Owner, ${entries.length - owed} are seat work).`);
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
    // runRender reports two different failures. Reading only `drift` let a
    // whole contract go unprojected in silence, which is what this check exists
    // to prevent — so both are surfaced.
    if (r.errors && r.errors.length) { console.error('VERIFY FAIL (generated view):'); r.errors.forEach((e) => console.error('  - ' + e)); return 1; }
    if (r.drift) { console.error('VERIFY FAIL: stale generated artifacts; run `node .agentops/tools/opsctl.mjs render`:'); r.drifted.forEach((d) => console.error('  - ' + d)); return 1; }
    console.log('VERIFY OK: contracts + runtime valid, consistent, and all generated views in sync.');
    return 0;
  }
  if (cmd === 'drill') {
    const d = runDrill();
    for (const s of d.steps) console.log(`  ${s.ok ? 'PASS' : 'FAIL'}  ${s.name}${s.detail ? ' — ' + s.detail : ''}`);
    if (!d.ok) { console.error('\nDRILL FAIL: clean-clone reconstruction did not reproduce exact state.'); return 1; }
    if (d.stale && d.stale.length) {
      console.log('');
      for (const s of d.stale) console.log(`  STALE  ${s.ticket} (${s.state}) base ${s.base.slice(0, 12)} != HEAD ${d.head.slice(0, 12)}`);
      console.log(`\nDRILL OK: reconstruction reproduces exact state with zero evidence loss — but ${d.stale.length} of ${d.total} capsule(s) are pinned behind live HEAD, and their own wake says re-seat before mutating. Not evidence loss; each reseats its own capsule when it starts work.`);
    } else {
      console.log('\nDRILL OK: clean-clone / context-wipe reconstruction reproduces exact state with zero evidence loss; every capsule is seated on live HEAD.');
    }
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
