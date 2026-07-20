// src/model/validate.js — content validation (SPEC §3.14)
//
// Runs at boot in dev mode and from the test page. Checks, across ALL content:
//   1. Schema conformance (fields, types, enums; unknown fields fail loudly).
//   2. Every id cross-reference resolves (no dangling ids).
//   3. Every opcode, formula op, trigger event, and predicate is in the
//      closed sets of SPEC §3.4–§3.6.
//   4. Every text-template token binds, and every player-visible literal
//      numeric effect has a token (SPEC §3.13) — enforced for cards + relics.
//   5. scripts.js budget report: script-using content stays < 5% of content.
//
// Headless: no document/window/localStorage/timers.

import {
  SCHEMAS,
  OPCODES,
  EFFECT_SPECS,
  TARGETS,
  TRIGGER_EVENTS,
  PREDICATES,
  CARD_TYPES,
  MODIFIER_KEYS,
  REGISTRY_TYPES,
} from './schemas.js';
import { FORMULA_OPS, FORMULA_OF, isFormula } from './formulas.js';

// Ops whose value binds to a text-template token; token name = op name,
// except applyStatus which binds under its status id (SPEC §3.13).
export const TOKENIZABLE_OPS = Object.freeze([
  'damage',
  'block',
  'heal',
  'loseHp',
  'applyStatus',
  'poiseDamage',
  'draw',
  'gainEnergy',
  'addCinders',
  'loseMaxHpPct',
]);

// Ops whose LITERAL numeric value MUST have a bound token in the template
// (a player-visible number with no token is a validation error).
export const REQUIRED_TOKEN_OPS = Object.freeze([
  'damage',
  'block',
  'heal',
  'loseHp',
  'applyStatus',
  'poiseDamage',
  'draw',
  'gainEnergy',
]);

const KNOWN_BUNDLE_KEYS = new Set([
  ...REGISTRY_TYPES,
  'version',
  'contentVersion',
  'balance',
  'mapConfigs',
  'scripts',
]);

/**
 * computeTokenBindings(effects) → [{ token, index, field, op, literal }]
 *
 * Deterministic binding of template tokens to opcode values, in effect order.
 * The first occurrence of a token base binds as `{base}`, repeats as
 * `{base.2}`, `{base.3}` ... (SPEC §3.13). `hits` on a damage op binds as
 * `{hits}` (then `{hits.2}` ...). Shared by validation, previewCard, and the UI.
 */
export function computeTokenBindings(effects) {
  const counts = {};
  const out = [];
  const push = (base, index, field, op, literal) => {
    counts[base] = (counts[base] || 0) + 1;
    const token = counts[base] === 1 ? base : `${base}.${counts[base]}`;
    out.push({ token, index, field, op, literal });
  };
  (effects || []).forEach((eff, i) => {
    if (!eff || typeof eff !== 'object' || typeof eff.op !== 'string') return;
    if (!TOKENIZABLE_OPS.includes(eff.op)) return;
    const field = eff.op === 'applyStatus' ? 'stacks' : eff.op === 'loseMaxHpPct' ? 'pct' : 'amount';
    const base = eff.op === 'applyStatus' ? eff.status : eff.op;
    if (typeof base !== 'string') return; // malformed; schema pass reports it
    push(base, i, field, eff.op, typeof eff[field] === 'number');
    if (eff.op === 'damage' && eff.hits != null) {
      push('hits', i, 'hits', eff.op, typeof eff.hits === 'number');
    }
  });
  return out;
}

export function extractTemplateTokens(template) {
  const tokens = [];
  const re = /\{([A-Za-z][\w.]*)\}/g;
  let m;
  while ((m = re.exec(template)) !== null) tokens.push(m[1]);
  return tokens;
}

/**
 * validateContent(bundle) → { ok, errors: [{ path, msg }], scriptReport }.
 * `bundle` is the raw content bundle (same shape createRegistries takes).
 */
export function validateContent(bundle) {
  const errors = [];
  const err = (path, msg) => errors.push({ path, msg });
  const b = bundle || {};

  for (const key of Object.keys(b)) {
    if (!KNOWN_BUNDLE_KEYS.has(key)) err(key, `Unknown content bundle key '${key}'`);
  }

  // ---- collect id sets for cross-reference checks -------------------------
  const ids = { scripts: new Set(Object.keys(b.scripts || {})) };
  for (const type of REGISTRY_TYPES) {
    ids[type] = new Set();
    const defs = b[type] || [];
    if (!Array.isArray(defs)) {
      err(type, `Bundle key '${type}' must be an array of defs`);
      continue;
    }
    defs.forEach((def, i) => {
      if (!def || typeof def.id !== 'string') err(`${type}[${i}]`, 'Def missing string id');
      else if (ids[type].has(def.id)) err(`${type}.${def.id}`, `Duplicate id '${def.id}'`);
      else ids[type].add(def.id);
    });
  }

  const vctx = { ids, err };

  // ---- schema walks --------------------------------------------------------
  const typeToSchema = {
    cards: SCHEMAS.card,
    relics: SCHEMAS.relic,
    statuses: SCHEMAS.status,
    stances: SCHEMAS.stance,
    keywords: SCHEMAS.keyword,
    enemies: SCHEMAS.enemy,
    encounters: SCHEMAS.encounter,
    events: SCHEMAS.event,
    flasks: SCHEMAS.flask,
    classes: SCHEMAS.class,
  };
  for (const type of REGISTRY_TYPES) {
    const defs = Array.isArray(b[type]) ? b[type] : [];
    defs.forEach((def) => {
      const path = `${type}.${(def && def.id) || '?'}`;
      walkSchema(def, typeToSchema[type], path, vctx);
    });
  }

  if (b.balance != null && (typeof b.balance !== 'object' || Array.isArray(b.balance))) {
    err('balance', 'balance must be a plain object of constants');
  }
  // balance.poise is engine-consulted data: { growthMult?, onFill? } (see ENGINE-API.md)
  if (b.balance && b.balance.poise) {
    const p = b.balance.poise;
    if (p.growthMult != null && typeof p.growthMult !== 'number') err('balance.poise.growthMult', 'must be a number');
    if (p.onFill != null) validateEffects(p.onFill, 'balance.poise.onFill', vctx);
  }

  if (b.mapConfigs != null) {
    if (typeof b.mapConfigs !== 'object' || Array.isArray(b.mapConfigs)) {
      err('mapConfigs', 'mapConfigs must be an object keyed by act number');
    } else {
      for (const act of Object.keys(b.mapConfigs)) {
        walkSchema(b.mapConfigs[act], SCHEMAS.mapConfig, `mapConfigs.${act}`, vctx);
      }
    }
  }

  // ---- entity-specific cross checks ----------------------------------------
  for (const card of b.cards || []) {
    const path = `cards.${card.id}`;
    if (typeof card.class === 'string' && card.class !== 'colorless' && !ids.classes.has(card.class)) {
      err(`${path}.class`, `class '${card.class}' is neither a class id nor 'colorless'`);
    }
    validateCardTemplates(card, path, err);
  }

  for (const relic of b.relics || []) {
    validateRelicTemplate(relic, `relics.${relic.id}`, err);
  }

  for (const enemy of b.enemies || []) {
    const path = `enemies.${enemy.id}`;
    const moveIds = new Set(Object.keys(enemy.moves || {}));
    if (enemy.firstMove != null && !moveIds.has(enemy.firstMove)) {
      err(`${path}.firstMove`, `firstMove '${enemy.firstMove}' is not one of this enemy's moves`);
    }
    for (const [pi, phase] of (enemy.phases || []).entries()) {
      for (const mv of phase.unlockMoves || []) {
        if (!moveIds.has(mv)) err(`${path}.phases[${pi}].unlockMoves`, `unlockMoves '${mv}' is not one of this enemy's moves`);
      }
      if (phase.on === 'hpBelowPct' && typeof phase.pct !== 'number') {
        err(`${path}.phases[${pi}]`, "phases with on:'hpBelowPct' require a numeric pct");
      }
    }
  }

  // ---- scripts budget (SPEC §3.1(6), §3.14(5)) -----------------------------
  const scriptUsers = [];
  let totalObjects = 0;
  for (const type of REGISTRY_TYPES) {
    for (const def of b[type] || []) {
      totalObjects++;
      if (usesScript(def)) scriptUsers.push(`${type}.${def.id}`);
    }
  }
  const scriptPct = totalObjects === 0 ? 0 : (scriptUsers.length / totalObjects) * 100;
  if (scriptPct >= 5) {
    err('scripts', `scripts budget exceeded: ${scriptUsers.length}/${totalObjects} content objects (${scriptPct.toFixed(1)}%) use scripts (must stay < 5%). Users: ${scriptUsers.join(', ')}`);
  }
  const scriptReport = {
    count: scriptUsers.length,
    total: totalObjects,
    pct: scriptPct,
    users: scriptUsers,
  };

  return { ok: errors.length === 0, errors, scriptReport };
}

// ---------------------------------------------------------------------------
// Schema walker
// ---------------------------------------------------------------------------

function walkSchema(value, node, path, vctx) {
  const { err } = vctx;
  if (!node) {
    err(path, 'Internal: missing schema node');
    return;
  }
  switch (node.k) {
    case 'any':
      return;
    case 'str':
      if (typeof value !== 'string') err(path, `Expected string, got ${describe(value)}`);
      return;
    case 'num':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        err(path, `Expected number, got ${describe(value)}`);
      } else if (node.int && !Number.isInteger(value)) {
        err(path, `Expected integer, got ${value}`);
      }
      return;
    case 'bool':
      if (typeof value !== 'boolean') err(path, `Expected boolean, got ${describe(value)}`);
      return;
    case 'enum':
      if (!node.values.includes(value)) {
        err(path, `Expected one of [${node.values.join(', ')}], got ${describe(value)}`);
      }
      return;
    case 'arr':
      if (!Array.isArray(value)) {
        err(path, `Expected array, got ${describe(value)}`);
        return;
      }
      if (node.len != null && value.length !== node.len) {
        err(path, `Expected array of length ${node.len}, got ${value.length}`);
      }
      value.forEach((v, i) => walkSchema(v, node.of, `${path}[${i}]`, vctx));
      return;
    case 'map':
      if (!isPlainObject(value)) {
        err(path, `Expected object map, got ${describe(value)}`);
        return;
      }
      for (const key of Object.keys(value)) walkSchema(value[key], node.of, `${path}.${key}`, vctx);
      return;
    case 'obj': {
      if (!isPlainObject(value)) {
        err(path, `Expected object, got ${describe(value)}`);
        return;
      }
      for (const key of Object.keys(value)) {
        if (!(key in node.fields)) err(`${path}.${key}`, `Unknown field '${key}'`);
      }
      for (const [key, fieldNode] of Object.entries(node.fields)) {
        if (value[key] === undefined) {
          if (!fieldNode.opt) err(`${path}.${key}`, `Missing required field '${key}'`);
          continue;
        }
        walkSchema(value[key], fieldNode, `${path}.${key}`, vctx);
      }
      return;
    }
    case 'union': {
      // Accept if any branch matches without producing errors.
      for (const branch of node.anyOf) {
        const probeErrors = [];
        const probe = { ids: vctx.ids, err: (p, m) => probeErrors.push({ p, m }) };
        walkSchema(value, branch, path, probe);
        if (probeErrors.length === 0) return;
      }
      err(path, `Value ${describe(value)} matched no allowed variant`);
      return;
    }
    case 'ref':
      if (typeof value !== 'string') {
        err(path, `Expected ${node.reg} id string, got ${describe(value)}`);
      } else if (!vctx.ids[node.reg] || !vctx.ids[node.reg].has(value)) {
        err(path, `Dangling reference: unknown ${node.reg} id '${value}'`);
      }
      return;
    case 'effects':
      validateEffects(value, path, vctx);
      return;
    case 'triggers':
      validateTriggers(value, path, vctx);
      return;
    case 'predicate':
      validatePredicate(value, path, vctx);
      return;
    case 'formulaOrNum':
      validateFormula(value, path, vctx);
      return;
    default:
      err(path, `Internal: unknown schema kind '${node.k}'`);
  }
}

function describe(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v === 'object' ? 'object' : `${typeof v} ${JSON.stringify(v)}`;
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Effects / triggers / predicates / formulas (closed-set checks)
// ---------------------------------------------------------------------------

const COMMON_EFFECT_FIELDS = ['op', 'target', 'amount', 'if', 'repeat'];

export function validateEffects(effects, path, vctx) {
  const { err } = vctx;
  if (!Array.isArray(effects)) {
    err(path, `Expected effects array, got ${describe(effects)}`);
    return;
  }
  effects.forEach((eff, i) => {
    const p = `${path}[${i}]`;
    if (!isPlainObject(eff)) {
      err(p, `Effect must be an object, got ${describe(eff)}`);
      return;
    }
    // Budgeted escape hatch: { script: 'name', ...args } (SPEC §3.1(6)).
    if (typeof eff.script === 'string') {
      if (!vctx.ids.scripts.has(eff.script)) err(`${p}.script`, `Dangling reference: unknown script '${eff.script}'`);
      return;
    }
    if (typeof eff.op !== 'string') {
      err(p, 'Effect missing op');
      return;
    }
    if (!OPCODES.includes(eff.op)) {
      err(p, `Unknown opcode '${eff.op}' (closed set, SPEC §3.4)`);
      return;
    }
    const spec = EFFECT_SPECS[eff.op];
    const allowed = new Set([...COMMON_EFFECT_FIELDS, ...spec.allowed]);
    for (const key of Object.keys(eff)) {
      if (!allowed.has(key)) err(`${p}.${key}`, `Unknown field '${key}' on opcode '${eff.op}'`);
    }
    for (const req of spec.required) {
      if (eff[req] === undefined) err(p, `Opcode '${eff.op}' missing required field '${req}'`);
    }
    if (eff.target !== undefined && !TARGETS.includes(eff.target)) {
      err(`${p}.target`, `Unknown target '${eff.target}' (closed set: ${TARGETS.join(', ')})`);
    }
    for (const numeric of ['amount', 'stacks', 'hits', 'pct', 'count', 'repeat']) {
      if (eff[numeric] !== undefined) validateFormula(eff[numeric], `${p}.${numeric}`, vctx);
    }
    if (eff.if !== undefined) validatePredicate(eff.if, `${p}.if`, vctx);
    for (const [field, reg] of Object.entries(spec.refs)) {
      const v = eff[field];
      if (typeof v === 'string' && !vctx.ids[reg].has(v)) {
        err(`${p}.${field}`, `Dangling reference: unknown ${reg} id '${v}'`);
      }
    }
    if (eff.op === 'addCard') {
      if (eff.pile !== undefined && !['draw', 'hand', 'discard', 'exhaust'].includes(eff.pile)) {
        err(`${p}.pile`, `Unknown pile '${eff.pile}'`);
      }
      if (eff.position !== undefined && !['top', 'bottom', 'random'].includes(eff.position)) {
        err(`${p}.position`, `Unknown position '${eff.position}'`);
      }
    }
  });
}

const TRIGGER_FIELDS = new Set(['on', 'if', 'do', 'once', 'limitPerTurn']);

export function validateTriggers(triggers, path, vctx) {
  const { err } = vctx;
  if (!Array.isArray(triggers)) {
    err(path, `Expected triggers array, got ${describe(triggers)}`);
    return;
  }
  triggers.forEach((trig, i) => {
    const p = `${path}[${i}]`;
    if (!isPlainObject(trig)) {
      err(p, `Trigger must be an object, got ${describe(trig)}`);
      return;
    }
    for (const key of Object.keys(trig)) {
      if (!TRIGGER_FIELDS.has(key)) err(`${p}.${key}`, `Unknown trigger field '${key}'`);
    }
    if (!TRIGGER_EVENTS.includes(trig.on)) {
      err(`${p}.on`, `Unknown trigger event '${trig.on}' (closed set, SPEC §3.10)`);
    }
    if (trig.if !== undefined) validatePredicate(trig.if, `${p}.if`, vctx);
    if (trig.once !== undefined && typeof trig.once !== 'boolean') err(`${p}.once`, 'once must be boolean');
    if (trig.limitPerTurn !== undefined && !Number.isInteger(trig.limitPerTurn)) {
      err(`${p}.limitPerTurn`, 'limitPerTurn must be an integer');
    }
    validateEffects(trig.do, `${p}.do`, vctx);
  });
}

const PREDICATE_FIELDS = {
  inStance: ['stance'],
  hasStatus: ['of', 'status', 'atLeast'],
  hasBlock: ['of'],
  hpBelowPct: ['of', 'pct'],
  firstCardThisTurn: [],
  firstAttackThisCombat: [],
  cardTypeIs: ['type'],
  everyNthCardThisCombat: ['n'],
  random: ['pct'],
  eventIsAttack: [],
  eventSourceIsOwner: [],
  eventTargetIsOwner: [],
  eventStatusIs: ['status'],
  all: ['preds'],
  any: ['preds'],
  not: ['pred'],
};

export function validatePredicate(pred, path, vctx) {
  const { err } = vctx;
  if (!isPlainObject(pred) || typeof pred.p !== 'string') {
    err(path, `Predicate must be an object with a 'p' field, got ${describe(pred)}`);
    return;
  }
  if (!PREDICATES.includes(pred.p)) {
    err(path, `Unknown predicate '${pred.p}' (closed set, SPEC §3.6)`);
    return;
  }
  const allowed = new Set(['p', ...PREDICATE_FIELDS[pred.p]]);
  for (const key of Object.keys(pred)) {
    if (!allowed.has(key)) err(`${path}.${key}`, `Unknown field '${key}' on predicate '${pred.p}'`);
  }
  const PRED_OF = ['self', 'owner', 'player', 'enemy', 'target'];
  if (pred.of !== undefined && !PRED_OF.includes(pred.of)) {
    err(`${path}.of`, `Unknown entity ref '${pred.of}' (allowed: ${PRED_OF.join(', ')})`);
  }
  switch (pred.p) {
    case 'inStance':
      if (typeof pred.stance !== 'string' || !vctx.ids.stances.has(pred.stance)) {
        err(`${path}.stance`, `Dangling reference: unknown stance id '${pred.stance}'`);
      }
      break;
    case 'hasStatus':
    case 'eventStatusIs':
      if (typeof pred.status !== 'string' || !vctx.ids.statuses.has(pred.status)) {
        err(`${path}.status`, `Dangling reference: unknown status id '${pred.status}'`);
      }
      break;
    case 'cardTypeIs':
      if (!CARD_TYPES.includes(pred.type)) err(`${path}.type`, `Unknown card type '${pred.type}'`);
      break;
    case 'everyNthCardThisCombat':
      if (!Number.isInteger(pred.n) || pred.n < 1) err(`${path}.n`, 'n must be a positive integer');
      break;
    case 'random':
      if (typeof pred.pct !== 'number') err(`${path}.pct`, 'pct must be a number');
      break;
    case 'all':
    case 'any':
      if (!Array.isArray(pred.preds)) err(`${path}.preds`, `'${pred.p}' requires a preds array`);
      else pred.preds.forEach((sub, i) => validatePredicate(sub, `${path}.preds[${i}]`, vctx));
      break;
    case 'not':
      validatePredicate(pred.pred, `${path}.pred`, vctx);
      break;
    default:
      break;
  }
}

const FORMULA_FIELDS = {
  add: ['args'],
  mul: ['args'],
  percentMaxHp: ['of', 'pct', 'min', 'max'],
  missingHp: ['of', 'min', 'max'],
  stacks: ['status', 'of', 'per', 'min', 'max'],
  energySpent: ['per', 'min', 'max'],
  blockOf: ['of', 'min', 'max'],
  hpOf: ['of', 'min', 'max'],
  cardsPlayedThisTurn: ['per', 'min', 'max'],
};

export function validateFormula(value, path, vctx) {
  const { err } = vctx;
  if (typeof value === 'number') {
    if (Number.isNaN(value)) err(path, 'Formula literal is NaN');
    return;
  }
  if (!isFormula(value)) {
    err(path, `Expected number or formula object, got ${describe(value)}`);
    return;
  }
  if (!FORMULA_OPS.includes(value.f)) {
    err(path, `Unknown formula op '${value.f}' (closed set, SPEC §3.5)`);
    return;
  }
  const allowed = new Set(['f', ...FORMULA_FIELDS[value.f]]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) err(`${path}.${key}`, `Unknown field '${key}' on formula '${value.f}'`);
  }
  if (value.of !== undefined && !FORMULA_OF.includes(value.of)) {
    err(`${path}.of`, `Unknown entity ref '${value.of}' (allowed: ${FORMULA_OF.join(', ')})`);
  }
  if (value.f === 'add' || value.f === 'mul') {
    if (!Array.isArray(value.args)) err(`${path}.args`, `'${value.f}' requires an args array`);
    else value.args.forEach((a, i) => validateFormula(a, `${path}.args[${i}]`, vctx));
  }
  if (value.f === 'stacks') {
    if (typeof value.status !== 'string' || !vctx.ids.statuses.has(value.status)) {
      err(`${path}.status`, `Dangling reference: unknown status id '${value.status}'`);
    }
    if (value.of === undefined) err(`${path}.of`, "'stacks' requires 'of'");
  }
  if (['percentMaxHp', 'missingHp', 'blockOf', 'hpOf'].includes(value.f) && value.of === undefined) {
    err(`${path}.of`, `'${value.f}' requires 'of'`);
  }
  if (value.f === 'percentMaxHp' && typeof value.pct !== 'number') {
    err(`${path}.pct`, "'percentMaxHp' requires a numeric pct");
  }
}

// ---------------------------------------------------------------------------
// Text templating (SPEC §3.13)
// ---------------------------------------------------------------------------

function checkTemplate(template, effects, path, err) {
  const bindings = computeTokenBindings(effects);
  const bound = new Set(bindings.map((bd) => bd.token));
  for (const token of extractTemplateTokens(template)) {
    if (!bound.has(token)) {
      err(path, `Template token '{${token}}' does not bind to any effect value`);
    }
  }
  const used = new Set(extractTemplateTokens(template));
  for (const bd of bindings) {
    if (bd.literal && REQUIRED_TOKEN_OPS.includes(bd.op) && !used.has(bd.token)) {
      err(path, `Player-visible numeric effect (op '${bd.op}', token '{${bd.token}}') lacks a template token`);
    }
  }
}

function validateCardTemplates(card, path, err) {
  if (typeof card.textTemplate !== 'string' || !Array.isArray(card.effects)) return; // schema pass reports
  checkTemplate(card.textTemplate, card.effects, `${path}.textTemplate`, err);
  if (card.upgrade) {
    const upTemplate = card.upgrade.textTemplate != null ? card.upgrade.textTemplate : card.textTemplate;
    const upEffects = card.upgrade.effects != null ? card.upgrade.effects : card.effects;
    if (typeof upTemplate === 'string' && Array.isArray(upEffects)) {
      checkTemplate(upTemplate, upEffects, `${path}.upgrade.textTemplate`, err);
    }
  }
}

function validateRelicTemplate(relic, path, err) {
  if (typeof relic.textTemplate !== 'string' || !Array.isArray(relic.triggers)) return;
  const effects = [];
  for (const trig of relic.triggers) {
    if (trig && Array.isArray(trig.do)) effects.push(...trig.do);
  }
  checkTemplate(relic.textTemplate, effects, `${path}.textTemplate`, err);
}

// ---------------------------------------------------------------------------
// Scripts budget helpers
// ---------------------------------------------------------------------------

function usesScript(node) {
  if (Array.isArray(node)) return node.some(usesScript);
  if (node !== null && typeof node === 'object') {
    if (typeof node.script === 'string') return true;
    return Object.values(node).some(usesScript);
  }
  return false;
}
