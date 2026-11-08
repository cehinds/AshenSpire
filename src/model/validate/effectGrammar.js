// src/model/validate/effectGrammar.js — the effect / trigger / predicate / formula grammar checks (SPEC §3.4–§3.6).
// Split out of validate.js; validate.js re-exports the four exported validators, so importers are unchanged.

import { validateZoneEffect } from '../../engine/cardZones.js';
import { validateAttack } from '../combatRules.js';
import {
  OPCODES,
  EFFECT_SPECS,
  TARGETS,
  TRIGGER_EVENTS,
  PREDICATES,
  ABILITY_TURN_METRICS,
  CARD_TYPES,
  PILES,
  PILE_POSITIONS,
} from '../schemas.js';
import { FORMULA_OPS, FORMULA_OF, isFormula } from '../formulas.js';
import { STANCE_CHOICE_SELECTORS } from '../cardChoices.js';
import { describe, isPlainObject } from './shared.js';

const COMMON_EFFECT_FIELDS = ['op', 'target', 'amount', 'if', 'repeat', 'oncePerTurn'];

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
    if (eff.attack !== undefined) {
      try { validateAttack(eff.attack); } catch (e) { err(`${p}.attack`, e.message); }
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
    if (['moveCards','modifyCards'].includes(eff.op)) { try { validateZoneEffect(eff); } catch (error) { err(p, error.message); } }
    if(eff.op==='modifyCards' && eff.changes?.hideTurns && typeof eff.changes.hideTurns==='object') validateFormula(eff.changes.hideTurns,`${p}.changes.hideTurns`,vctx);
    if (eff.oncePerTurn !== undefined && (typeof eff.oncePerTurn !== 'string' || !eff.oncePerTurn.trim())) err(`${p}.oncePerTurn`, 'must be a non-empty family marker');
    for (const flag of ['nonlethal', 'offering', ...(eff.op === 'discard' ? ['choose'] : [])]) if (eff[flag] !== undefined && typeof eff[flag] !== 'boolean') err(`${p}.${flag}`, 'must be a boolean');
    if(eff.op==='addBurden' && eff.pile!==undefined && !['draw','hand'].includes(eff.pile)) err(`${p}.pile`,'Enemy burden pile must be draw or hand');
    if (eff.op === 'discard' && eff.choose && eff.random) err(p, 'chosen discard cannot also be random');
    if (eff.op === 'grantCardCharge') {
      if (typeof eff.key !== 'string' || !eff.key.trim()) err(`${p}.key`, 'must be a non-empty charge key');
      if (eff.cardType !== undefined && !CARD_TYPES.includes(eff.cardType)) err(`${p}.cardType`, 'unknown card type');
      if (eff.cardTag !== undefined && !vctx.nodeIds.has(eff.cardTag)) err(`${p}.cardTag`, 'unknown card tag');
      if (eff.abilityKind !== undefined && !['spell', 'maneuver'].includes(eff.abilityKind)) err(`${p}.abilityKind`, 'must be spell or maneuver');
      const chargeFields = ['damage', 'manaDiscount', 'block', 'heal', 'break', 'buildup'];
      if (!chargeFields.some(field => eff[field] !== undefined)) err(p, 'charge must grant a numeric bonus');
      for (const field of chargeFields) if (eff[field] !== undefined) {
        if (typeof eff[field] === 'number' && (!Number.isInteger(eff[field]) || eff[field] < 0)) err(`${p}.${field}`, 'must be a non-negative integer');
        else validateFormula(eff[field], `${p}.${field}`, vctx);
      }
      if (eff.buildup !== undefined && !vctx.ids.statuses.has(eff.buildupStatus)) err(`${p}.buildupStatus`, 'must name a status');
      if (eff.damageScope !== undefined && !['effect', 'hit'].includes(eff.damageScope)) err(`${p}.damageScope`, 'must be effect or hit');
    }
    const allowed = new Set([...COMMON_EFFECT_FIELDS, ...spec.allowed]);
    for (const key of Object.keys(eff)) {
      if (!allowed.has(key)) err(`${p}.${key}`, `Unknown field '${key}' on opcode '${eff.op}'`);
    }
    for (const req of spec.required) {
      if (eff[req] === undefined) err(p, `Opcode '${eff.op}' missing required field '${req}'`);
    }
    if (eff.target !== undefined && !TARGETS.includes(eff.target) && !(eff.op === 'moveEngagement' && eff.target === 'pendingAttacker')) {
      err(`${p}.target`, `Unknown target '${eff.target}' (closed set: ${TARGETS.join(', ')})`);
    }
    if (eff.op === 'moveEngagement' && (!['enemy', 'pendingAttacker'].includes(eff.target) || ![-1, 1].includes(eff.bands))) err(p, 'moveEngagement requires enemy or pendingAttacker and bands -1 or 1');
    // swapClass is `{ classId } | { random: true }` — one selector, never
    // neither (the door would swap to nothing) nor both (one would be ignored).
    if (eff.op === 'swapClass') {
      const named = eff.classId !== undefined;
      const random = eff.random !== undefined;
      if (random && eff.random !== true) err(`${p}.random`, `'random' must be true on opcode 'swapClass' (omit it for a named swap)`);
      if (named === random) err(p, `Opcode 'swapClass' takes exactly one of 'classId' or 'random: true'`);
      else if (named && typeof eff.classId !== 'string') err(`${p}.classId`, `'classId' must be a class id`);
    }
    // restoreMana restores BY an amount or TO a floor (plan phase 7) — one
    // selector, never neither (nothing to restore) nor both (one ignored).
    if (eff.op === 'restoreMana') {
      const by = eff.amount !== undefined;
      const to = eff.toFloorPct !== undefined;
      if (by === to) err(p, `Opcode 'restoreMana' takes exactly one of 'amount' or 'toFloorPct'`);
    }
    // enterStance enters a named stance OR offers a choice (Warrior's Vow,
    // model/cardChoices.js) — one selector, never neither nor both.
    // BOUNDARY: this check does not know which context the effect list is
    // in, so it also accepts `choose` in a stance onEnter, a status hook or an
    // enemy move, where no play intent supplies a pick. No shipped row does
    // that (only a card's own effects carry `choose`); such a row throws
    // when it resolves (engine/actions.js enterStance;
    // tests/warriors-vow.test.mjs pins the throw).
    if (eff.op === 'enterStance') {
      const named = eff.stance !== undefined || eff.maneuver!==undefined;
      if(eff.maneuver!==undefined && !['attack','smash','defend','sweep','counter','casting'].includes(eff.maneuver))err(`${p}.maneuver`,'Unknown maneuver');
      const chosen = eff.choose !== undefined;
      if (named === chosen) err(p, `Opcode 'enterStance' takes exactly one of 'stance' or 'choose'`);
      else if (chosen && !STANCE_CHOICE_SELECTORS.includes(eff.choose)) err(`${p}.choose`, `Opcode 'enterStance' choose must be one of: ${STANCE_CHOICE_SELECTORS.join(', ')}`);
    }
    // arcaneBuildup pours BY an amount or a percent OF the target's threshold
    // (plan phase 8) — one selector, never neither nor both.
    if (eff.op === 'arcaneBuildup') {
      const by = eff.amount !== undefined;
      const pct = eff.pct !== undefined;
      if (by === pct) err(p, `Opcode 'arcaneBuildup' takes exactly one of 'amount' or 'pct'`);
    }
    for (const numeric of ['amount', 'stacks', 'hits', 'pct', 'count', 'repeat', 'toFloorPct']) {
      if (eff[numeric] !== undefined) validateFormula(eff[numeric], `${p}.${numeric}`, vctx);
    }
    if (eff.if !== undefined) validatePredicate(eff.if, `${p}.if`, vctx);
    for (const [field, reg] of Object.entries(spec.refs)) {
      const v = eff[field];
      if (typeof v === 'string' && !vctx.ids[reg].has(v)) {
        err(`${p}.${field}`, `Dangling reference: unknown ${reg} id '${v}'`);
      }
    }
    if (['damage', 'applyStatus'].includes(eff.op) && eff.tags !== undefined) {
      if (!Array.isArray(eff.tags) || !eff.tags.length) {
        err(`${p}.tags`, `${eff.op} tags must be a non-empty array of effect-tag ids`);
      } else {
        for (const tag of eff.tags) {
          if (!vctx.tagIds.has(tag)) {
            err(`${p}.tags`, `unknown effect tag '${tag}' (legal: ${[...vctx.tagIds].join(', ')})`);
          }
        }
      }
    }
    if (eff.op === 'stagger' && ['self', 'player', 'owner', 'ally'].includes(eff.target)) {
      err(`${p}.target`, `stagger targets enemies only, got '${eff.target}'`);
    }
    if (eff.op === 'addFlaskCapacity') {
      if (!['hp', 'mana'].includes(eff.kind)) err(`${p}.kind`, `must be 'hp' or 'mana'`);
      if (!Number.isInteger(eff.amount) || eff.amount <= 0) err(`${p}.amount`, 'must be a positive integer');
    }
    if (eff.op === 'addCard') {
      // PILES / PILE_POSITIONS, not the same words typed again. Both sets were
      // declared closed in schemas.js and read by NOBODY, while these two lines
      // re-typed them as literals and did the actual refusing — the vocabulary
      // an author would edit was decoration, the copy nobody would think to edit
      // was the law. The legal values in the message come off the set too, so a
      // new pile cannot be legal and unmentioned.
      if (eff.pile !== undefined && !PILES.includes(eff.pile)) {
        err(`${p}.pile`, `Unknown pile '${eff.pile}' (legal: ${PILES.join(', ')})`);
      }
      if (eff.position !== undefined && !PILE_POSITIONS.includes(eff.position)) {
        err(`${p}.position`, `Unknown position '${eff.position}' (legal: ${PILE_POSITIONS.join(', ')})`);
      }
    }
  });
}

const TRIGGER_FIELDS = new Set(['on', 'if', 'do', 'once', 'limitPerTurn', 'chance', 'rollScope', 'limitPerAction', 'priority', 'allowSecondary']);

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
    if (trig.chance !== undefined && (!Number.isFinite(trig.chance) || trig.chance < 0 || trig.chance > 1)) err(`${p}.chance`, 'chance must be between 0 and 1');
    if (trig.rollScope !== undefined && !['play', 'target', 'hit'].includes(trig.rollScope)) err(`${p}.rollScope`, 'invalid roll scope');
    if (trig.limitPerAction !== undefined && (!Number.isInteger(trig.limitPerAction) || trig.limitPerAction < 1)) err(`${p}.limitPerAction`, 'must be positive integer');
    if (trig.priority !== undefined && !Number.isInteger(trig.priority)) err(`${p}.priority`, 'must be integer');
    if (trig.allowSecondary !== undefined && typeof trig.allowSecondary !== 'boolean') err(`${p}.allowSecondary`, 'must be boolean');
    if (trig.limitPerTurn !== undefined && !Number.isInteger(trig.limitPerTurn)) {
      err(`${p}.limitPerTurn`, 'limitPerTurn must be an integer');
    }
    validateEffects(trig.do, `${p}.do`, vctx);
  });
}

const PREDICATE_FIELDS = {
  turnMetric: ['metric', 'tag', 'cardId', 'atLeast', 'atMost', 'snapshot'],
  chargeAvailable: ['key'],
  eventChargeConsumed: ['key'],
  eventDiscardExplicit: [],
  enemyKilledWithStatus: ['status'],
  enemyNegativeStatusNew: ['statuses'],
  cardAbilityKindIs: ['kind'],
  cardTargetsAllEnemies: [],
  resourcePaid:['resource','amount'],
  inStance: ['stance'],
  hasStatus: ['of', 'status', 'atLeast', 'snapshot'],
  hasBlock: ['of', 'snapshot'],
  hpBelowPct: ['of', 'pct', 'snapshot'],
  firstCardThisTurn: [],
  firstAttackThisCombat: [],
  cardTypeIs: ['type'],
  cardTagIs: ['tag'],
  everyNthCardThisCombat: ['n'],
  random: ['pct'],
  eventIsAttack: [],
  hpDamagePositive: [],
  healPositive: [],
  manaPositive: [],
  eventSourceIsOwner: [],
  eventTargetIsOwner: [],
  eventStatusIs: ['status'],
  skillLevelAtLeast: ['skill', 'level'],
  classLevelAtLeast: ['level'],
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
  const PRED_OF = ['self', 'owner', 'player', 'enemy', 'target', ...(pred.p === 'hasStatus' ? ['allEnemies'] : [])];
  if (pred.snapshot !== undefined && !(pred.p === 'turnMetric' ? ['beforePlay', 'current'] : ['beforePlay', 'beforeEvent']).includes(pred.snapshot)) err(`${path}.snapshot`, 'unknown predicate snapshot');
  if (pred.of !== undefined && !PRED_OF.includes(pred.of)) {
    err(`${path}.of`, `Unknown entity ref '${pred.of}' (allowed: ${PRED_OF.join(', ')})`);
  }
  switch (pred.p) {
    case 'turnMetric':
      if (!ABILITY_TURN_METRICS.includes(pred.metric)) err(`${path}.metric`, 'unknown ability turn metric');
      if (['tagPlays', 'distinctTagPlays'].includes(pred.metric) && !vctx.nodeIds.has(pred.tag)) err(`${path}.tag`, 'must name a card tag');
      if (pred.metric === 'sameCardPlays' && pred.cardId !== 'event' && !vctx.ids.cards.has(pred.cardId)) err(`${path}.cardId`, 'must name a card or event');
      if (pred.atLeast === undefined && pred.atMost === undefined) err(path, 'turn metric requires a bound');
      for (const key of ['atLeast', 'atMost']) if (pred[key] !== undefined && (!Number.isFinite(pred[key]) || pred[key] < 0)) err(`${path}.${key}`, 'must be a finite non-negative bound');
      if (pred.atLeast !== undefined && pred.atMost !== undefined && pred.atLeast > pred.atMost) err(path, 'turn metric bounds are reversed');
      break;
    case 'inStance':
      if (typeof pred.stance !== 'string' || !vctx.ids.stances.has(pred.stance) && !['attack','smash','defend','counter','sweep','casting','prepared'].includes(pred.stance)) {
        err(`${path}.stance`, `Dangling reference: unknown stance id '${pred.stance}'`);
      }
      break;
    case 'hasStatus':
    case 'eventStatusIs':
    case 'enemyKilledWithStatus':
      if (typeof pred.status !== 'string' || !vctx.ids.statuses.has(pred.status)) {
        err(`${path}.status`, `Dangling reference: unknown status id '${pred.status}'`);
      }
      break;
    case 'chargeAvailable':
    case 'eventChargeConsumed':
      if (typeof pred.key !== 'string' || !pred.key.trim()) err(`${path}.key`, 'must be a nonempty charge key');
      break;
    case 'cardAbilityKindIs':
      if (!['spell', 'maneuver'].includes(pred.kind)) err(`${path}.kind`, 'must be spell or maneuver');
      break;
    case 'enemyNegativeStatusNew':
      if (!Array.isArray(pred.statuses) || !pred.statuses.length || pred.statuses.some(id => !vctx.ids.statuses.has(id))) err(`${path}.statuses`, 'must name negative statuses');
      break;
    case 'cardTypeIs':
      if (!CARD_TYPES.includes(pred.type)) err(`${path}.type`, `Unknown card type '${pred.type}'`);
      break;
    case 'cardTagIs':
      // Any node of the tree may be asked about: a card's authored tags and
      // the grip's derived framework tags (equipment.dualWield) alike.
      if (typeof pred.tag !== 'string' || !vctx.nodeIds || !vctx.nodeIds.has(pred.tag)) {
        err(`${path}.tag`, `Unknown tag '${pred.tag}' — not a node in content/source/nodes.csv`);
      }
      break;
    case 'everyNthCardThisCombat':
      if (!Number.isInteger(pred.n) || pred.n < 1) err(`${path}.n`, 'n must be a positive integer');
      break;
    case 'random':
      if (typeof pred.pct !== 'number') err(`${path}.pct`, 'pct must be a number');
      break;
    // The skill id is one of the derived tracks (model/skills.js): a gate on
    // a name the ledger never holds would be false forever, silently.
    case 'skillLevelAtLeast':
      if (typeof pred.skill !== 'string' || !pred.skill) {
        err(`${path}.skill`, `skillLevelAtLeast names a skill track id, got ${describe(pred.skill)}`);
      } else if (vctx.skillIds && !vctx.skillIds.has(pred.skill)) {
        err(`${path}.skill`, `Unknown skill track '${pred.skill}' — the tracks are ${[...vctx.skillIds].join(', ')}`);
      }
      if (!Number.isInteger(pred.level) || pred.level < 1) err(`${path}.level`, 'level must be a positive integer');
      break;
    case 'classLevelAtLeast':
      if (!Number.isInteger(pred.level) || pred.level < 1) err(`${path}.level`, 'level must be a positive integer');
      break;
    case 'resourcePaid':
      if (!['mana','stamina'].includes(pred.resource) || !Number.isSafeInteger(pred.amount ?? 1) || (pred.amount ?? 1)<0) err(path,'resourcePaid requires mana/stamina and nonnegative amount');
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
  add: ['args', 'min', 'max'], // evaluateRaw clamps any node; a graded sum (Reclamation) caps the total
  mul: ['args', 'min', 'max'],
  percentMaxHp: ['of', 'pct', 'min', 'max'],
  missingHp: ['of', 'min', 'max'],
  missingMana: ['of', 'min', 'max'],
  stacks: ['status', 'of', 'per', 'min', 'max'],
  energySpent: ['per', 'min', 'max'],
  blockOf: ['of', 'min', 'max'],
  hpOf: ['of', 'min', 'max'],
  cardsPlayedThisTurn: ['per', 'min', 'max'],
  metric: ['metric','statuses','of','per','min','max'],
  traitBonus: ['base', 'pct', 'min', 'max'],
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
  if (value.f === 'metric' && value.statuses !== undefined && (!Array.isArray(value.statuses) || value.statuses.some(id=>!vctx.ids.statuses.has(id)))) err(`${path}.statuses`,'Unknown metric status reference');
  if (value.f === 'metric' && !['weaponDamage','negativeStatusTypes','negativeStatusStacks','damageTakenThisTurn','sameCardPlays','cardsPlayed','distinctTypes','manaSpent','staminaSpent','evadeStackGain'].includes(value.metric)) err(`${path}.metric`, 'Unknown combat metric');
  if (value.f === 'stacks') {
    if (typeof value.status !== 'string' || !vctx.ids.statuses.has(value.status)) {
      err(`${path}.status`, `Dangling reference: unknown status id '${value.status}'`);
    }
    if (value.of === undefined) err(`${path}.of`, "'stacks' requires 'of'");
  }
  if (['percentMaxHp', 'missingHp', 'missingMana', 'blockOf', 'hpOf'].includes(value.f) && value.of === undefined) {
    err(`${path}.of`, `'${value.f}' requires 'of'`);
  }
  if (value.f === 'traitBonus') {
    if (value.base === undefined) err(`${path}.base`, "'traitBonus' requires a base");
    else validateFormula(value.base, `${path}.base`, vctx);
    if (typeof value.pct !== 'number') err(`${path}.pct`, "'traitBonus' requires a numeric pct");
  }
  if (value.f === 'percentMaxHp' && typeof value.pct !== 'number') {
    err(`${path}.pct`, "'percentMaxHp' requires a numeric pct");
  }
}

// ---------------------------------------------------------------------------
// Text templating (SPEC §3.13)
// ---------------------------------------------------------------------------
