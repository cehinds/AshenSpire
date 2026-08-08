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

import { resolveFloorPlan } from './floorplan.js';
import { viewRefusals, geometryRefusals } from './mapview.js';
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
  SFX_LAYER_KINDS,
  SFX_LAYER_SCHEMAS,
  MUSIC_SILENCE_WORD,
  MUSIC_BED_SCHEMA,
  CREATURE_TAGS,
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
  'equipment',
  'unlocks',
  'sfx',
  'music',
  'tags', // card/effect tag registry — one vocabulary, two carriers (#61)
]);

/**
 * computeTokenBindings(effects) → [{ token, index, field, op, literal }]
 *
 * Deterministic binding of template tokens to opcode values, in effect order.
 * The first occurrence of a token base binds as `{base}`, repeats as
 * `{base.2}`, `{base.3}` ... (SPEC §3.13). `hits` on a damage op binds as
 * `{hits}` (then `{hits.2}` ...). Shared by validation, previewCard, and the UI.
 */
/**
 * relicTokens(def) → { token: number }
 *
 * A relic's template says `{block}` and its data says `do: [{ op: 'block',
 * amount: 2 }]`. The token IS the opcode and the value is the field the opcode
 * carries, so the number a player reads is DERIVED from the entry that produces
 * it — never a second copy typed into the prose (Law 1 clause 2, which calls a
 * restatement a defect "even in tooltip prose").
 *
 * EldenSpire#38. Three call sites rendered relic text as
 * `textTemplate.replace(/[{}]/g, '')` — strip the braces, ship the key. Sunna
 * caught it on the ugliest one, "also deals poiseDamage Poise damage", and it
 * turned out to be 51 tokens across 46 token-carrying relics of 54: "gain block Block", "heal heal
 * HP", "draw draw extra card". The camelCase one was visible; the rest read as
 * clumsy English and hid in plain sight. EVERY relic number in the game was
 * invisible to the player.
 *
 * WHAT 51/51 IS AND IS NOT (Vira, #41): it is a fact about today's 54 entries,
 * not about this function. `starstoneShard` already ships
 * `stacks: { f: 'add', args: [1] }` — a formula, not a number — and any template
 * binding it renders `{token}` unresolved. That is the honest degrade and not a
 * silent one, but "every relic number resolves" is a census, and a census is not
 * an invariant. The invariant belongs with validateRelicTemplate, which is the
 * other decider of this same fact and should own it.
 *
 * Numbers only, and deliberately: a token bound to a non-number would render
 * "[object Object]", so an unresolved token is left as `{token}` for the caller
 * to decide about rather than papered over. Bad data stays visible (clause 5).
 */
/**
 * The template-token grammar, in ONE place. `{block}`, `{bleed}`, `{damage.2}`.
 *
 * EldenSpire#41, Bjorn's deletability review: this regex had FOUR copies —
 * validate.js:150, loadout.js:258 (already named TOKEN_RE), and twice in
 * card.js. A factory rather than a shared instance on purpose: a `g` regex
 * carries `lastIndex`, so one exported object shared across modules is a
 * cross-module mutable, and loadout.js was already resetting it defensively at
 * three call sites. Each caller gets its own.
 */
export const TOKEN_PATTERN = '\\{([A-Za-z][\\w.]*)\\}';
export const tokenRe = () => new RegExp(TOKEN_PATTERN, 'g');

export function relicTokens(def) {
  // DELEGATES. It used to carry its own grammar — a `['amount','stacks','value',
  // 'n']` scan plus status/id keying — and Bjorn's review found 3 of 4 synthetic
  // relics built from DECLARED vocabulary rendering a raw token, with a green
  // control. computeTokenBindings twelve lines up already owns this rule and
  // owns it better: TOKENIZABLE_OPS gates it, `applyStatus` keys on the status
  // and reads `stacks`, `loseMaxHpPct` reads `pct`, `damage` also binds `hits`,
  // and a repeated op disambiguates to `{block.2}`. My version had none of that.
  //
  // What this function is FOR is the other half: a card carries a flat
  // `effects` array and a relic carries ops spread across `triggers[].do`. So
  // this flattens, and the grammar stays where it already lived.
  const ops = [];
  for (const t of def.triggers || []) for (const op of t.do || []) ops.push(op);
  for (const op of def.effects || []) ops.push(op);
  for (const op of def.do || []) ops.push(op);
  const tokens = {};
  for (const b of computeTokenBindings(ops)) {
    const v = (ops[b.index] || {})[b.field];
    if (typeof v === 'number') tokens[b.token] = v;
  }
  return tokens;
}

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
  const re = tokenRe();
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

  // Effect-tag vocabulary: the card-tag registry rides the bundle so effect
  // `tags` and taggedVulnerability lists validate against ONE home (#61).
  const tagIds = new Set((Array.isArray(b.tags) ? b.tags : []).map((t) => t && t.id).filter(Boolean));
  const vctx = { ids, err, tagIds };

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
  // balance.ui.holdConfirm — THE DIAL THAT DISABLES A SAFETY FEATURE WHEN IT IS
  // WRONG, so it is the last thing that may fail quiet. Vira's finding: it
  // validated against NOTHING. `steps: { normal: 'abc' }` reaches
  // `Number('abc') || 0` in ui/components/holdconfirm.js, resolves to 0 ms, and
  // the hold silently does not exist — while `validateContent` returns ok:true
  // with zero errors naming it. Law 1 clause 5 failing quiet, on the one control
  // whose failure is invisible by construction: nothing on the screen looks
  // different, the bars just commit on a tap again.
  //
  // Meaning, not shape, which is why it is here and not in SCHEMAS: whether
  // `def` names a step that EXISTS needs two fields to ask.
  if (b.balance && b.balance.ui && b.balance.ui.holdConfirm != null) {
    const hc = b.balance.ui.holdConfirm;
    if (typeof hc !== 'object' || Array.isArray(hc)) {
      err('balance.ui.holdConfirm', 'must be an object { def, steps }');
    } else {
      const steps = hc.steps;
      if (typeof steps !== 'object' || steps == null || Array.isArray(steps)) {
        err('balance.ui.holdConfirm.steps', 'must be an object of name -> milliseconds');
      } else {
        const names = Object.keys(steps);
        if (!names.length) err('balance.ui.holdConfirm.steps', 'must offer at least one position');
        for (const k of names) {
          const v = steps[k];
          if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
            err(`balance.ui.holdConfirm.steps.${k}`, `must be a non-negative number of milliseconds — got ${JSON.stringify(v)}. `
              + `A value the code cannot read resolves to 0 ms, which silently turns the confirm step OFF.`);
          }
        }
        if (!Object.hasOwn(steps, hc.def)) {
          err('balance.ui.holdConfirm.def', `${JSON.stringify(hc.def)} is not one of the steps offered (${names.join(', ')}) — `
            + `the default position must exist, or every player starts on a setting the row cannot show.`);
        }
      }
    }
  }
  // THE MAP'S COLLISION MARGIN, and it belongs here because it has exactly one
  // data input. `balance.ui.tapSize.def` is what EVERY map circle's radius is
  // SOLVED FROM (model/mapview.js), so raising it grows every circle while the
  // pitches they are measured against do not move — targets grow, the space
  // between them does not. Sunna's sentence, written about the event screen's
  // choice bars weeks ago and true here too: nothing in this game read a gap.
  // A refusal that prints a verdict and not a margin cannot be watched.
  //
  // IT RULES ON EVERY PAIR NOW. It held one exemption for a night — the
  // boss/shrine pair, red at the shipped default since #107, ungated because a
  // boot banner the player cannot act on is a worse failure than the overlap.
  // The exemption carried a latch asserting the pair was still red; Freja gave
  // the boss its own row pitch, the latch fired, and the hole is closed
  // (`BOOT_GATED_PAIRS`, model/mapview.js). `node tools/mapplan.mjs --margins`
  // is the census, and it exits 0.
  //
  // Asked ONCE of the bundle rather than per act: it does not vary with
  // mapConfigs, and three identical errors would be three copies of one fact.
  // The corpus it has to turn red is `node tools/mapplan.mjs --selftest` — the
  // same corpus the mapConfigs block below points at, and its rows for this
  // refusal are in it, so neither pointer dangles.
  // Guarded on `balance` and NOT on `balance.ui.tapSize`, deliberately: guarding
  // on the entry means deleting the entry silences the check that watches it.
  if (b.balance != null && typeof b.balance === 'object' && !Array.isArray(b.balance)) {
    for (const e of geometryRefusals(b.balance)) err(e.key, e.msg);
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
        const cfg = b.mapConfigs[act];
        walkSchema(cfg, SCHEMAS.mapConfig, `mapConfigs.${act}`, vctx);
        // THE SECOND LAYER — meaning, not shape. The schema cannot know whether
        // floor 9 exists in THIS act; that needs `floors`, so it is asked here.
        // This is the boot-time half of Law 1 clause 5: bad data fails loud and
        // NAMES THE ENTRY, rather than being clamped, defaulted, or ignored.
        // The corpus it has to turn red is in tools/mapplan.mjs --selftest.
        if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
          for (const e of resolveFloorPlan(cfg).errors) {
            err(`mapConfigs.${act}.${e.key}`, e.msg);
          }
          // AND THE SAME LAYER FOR THE KNOBS WHOSE FAILURE IS A VIEW FAILURE.
          // `floors: 2` already refused by name; `columns: 10` did not, and it
          // makes Constantine's "the current node and its connecting nodes fit"
          // unsatisfiable at every zoom the ladder has — a knob that hands him a
          // broken climb instead of a reason (Law 1 clause 5).
          //
          // AND EVERY ONE OF THESE NOW CARRIES ITS MARGIN, not just its verdict.
          // `columns: 9` was accepted at 1.02x with zero spare columns and the
          // word "accepted" was the whole answer (Vira, 2026-08-08).
          for (const e of viewRefusals(cfg)) {
            err(`mapConfigs.${act}.${e.key}`, e.msg);
          }
        }
      }
    }
  }

  if (b.sfx != null) validateSfxRecipes(b.sfx, 'sfx', vctx);
  if (b.music != null) validateMusicBeds(b.music, 'music', vctx);

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

  // ---- threshold-proc second layer (#61): meaning, not shape ---------------
  // Every red names its row and, for tag errors, lists the legal tags — a
  // wrong tag teaches the vocabulary instead of just refusing (silence-word
  // standard).
  //
  // finitePositive is the SHARED gate for every numeric knob in this layer
  // (Vira's gate finding 1 — the recurring class: `typeof x === 'number' &&
  // x > 0` waves Infinity through, and Infinity validates green then
  // multiplies damage at play). One helper, every site, instead of a fourth
  // hand-written patch.
  const finitePositive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  const finitePositiveInt = (v) => Number.isInteger(v) && v > 0; // isInteger already rejects ±Infinity/NaN
  const finitePercent = (v) => finitePositive(v) && v <= 100;
  for (const st of b.statuses || []) {
    const path = `statuses.${st.id}`;
    if (st.proc) {
      const p = st.proc;
      if (!finitePositiveInt(p.threshold)) {
        err(`${path}.proc.threshold`, `threshold must be a finite integer > 0, got ${JSON.stringify(p.threshold)}`);
      }
      if (!finitePercent(p.burstPercent)) {
        err(`${path}.proc.burstPercent`, `burstPercent must be a finite number in (0, 100], got ${JSON.stringify(p.burstPercent)}`);
      }
      // The burst band is a damage floor/ceiling: negatives validate a proc
      // that fires and silently no-ops (loseHp clamps at 0) — a dead row in
      // burst clothing (Vira's finding 1, second half).
      if (!(Number.isInteger(p.burstMin) && p.burstMin >= 0)) {
        err(`${path}.proc.burstMin`, `burstMin must be a finite integer ≥ 0, got ${JSON.stringify(p.burstMin)}`);
      }
      if (!finitePositiveInt(p.burstMax)) {
        err(`${path}.proc.burstMax`, `burstMax must be a finite integer > 0 — a 0-or-negative cap is a proc that silently no-ops, got ${JSON.stringify(p.burstMax)}`);
      }
      if (Number.isInteger(p.burstMin) && Number.isInteger(p.burstMax) && p.burstMin > p.burstMax) {
        err(`${path}.proc`, `burstMin ${p.burstMin} exceeds burstMax ${p.burstMax}`);
      }
      if (p.poiseDamage != null && !(Number.isInteger(p.poiseDamage) && p.poiseDamage >= 0)) {
        err(`${path}.proc.poiseDamage`, `poiseDamage must be an integer ≥ 0, got ${JSON.stringify(p.poiseDamage)}`);
      }
      if (p.resistance) {
        for (const tag of p.resistance.tags || []) {
          if (!CREATURE_TAGS.includes(tag)) {
            err(`${path}.proc.resistance.tags`, `unknown creature tag '${tag}' (legal: ${CREATURE_TAGS.join(', ')})`);
          }
        }
        // Empty tag list = a resistance the proc can never grant — same dead
        // shape as an empty taggedVulnerability list, held to the same red
        // (Vira's finding 3: one screen, one rule).
        if (!(p.resistance.tags || []).length) {
          err(`${path}.proc.resistance.tags`, 'tag list must be non-empty — a resistance no creature tag can trigger is a dead row; omit resistance instead');
        }
        const resistDef = (b.statuses || []).find((s) => s && s.id === p.resistance.status);
        if (resistDef && !resistDef.resists) {
          err(`${path}.proc.resistance.status`, `'${p.resistance.status}' has no resists block — a proc's resistance status must declare what it resists`);
        }
      }
    }
    if (st.resists) {
      if (!finitePercent(st.resists.percent)) {
        err(`${path}.resists.percent`, `resist percent must be a finite number in (0, 100], got ${JSON.stringify(st.resists.percent)}`);
      }
      // Reverse-direction check (Vira's finding 2): a resist row naming a
      // status that never procs is consulted by nobody — dead, silently.
      const resisted = (b.statuses || []).find((s) => s && s.id === st.resists.status);
      if (resisted && !resisted.proc) {
        err(`${path}.resists.status`, `'${st.resists.status}' is not a threshold-proc status — this resist row would never be consulted`);
      }
      if (!(st.decay && typeof st.decay === 'object' && Number.isInteger(st.decay.duration) && st.decay.duration > 0)) {
        err(`${path}.decay`, `a resist row needs decay {duration: int > 0} — its duration is a table knob, got ${JSON.stringify(st.decay)}`);
      }
    }
    if (st.taggedVulnerability) {
      const tv = st.taggedVulnerability;
      for (const tag of tv.tags || []) {
        if (!tagIds.has(tag)) {
          err(`${path}.taggedVulnerability.tags`, `unknown effect tag '${tag}' (legal: ${[...tagIds].join(', ')})`);
        }
      }
      if (!finitePositive(tv.mult)) {
        err(`${path}.taggedVulnerability.mult`, `mult must be a finite number > 0, got ${JSON.stringify(tv.mult)}`);
      }
      if (!(tv.tags || []).length) {
        err(`${path}.taggedVulnerability.tags`, 'tag list must be non-empty — an unscoped extra vulnerability is plain Vulnerable, use modifiers instead');
      }
    }
  }

  for (const enemy of b.enemies || []) {
    const path = `enemies.${enemy.id}`;
    for (const tag of enemy.tags || []) {
      if (!CREATURE_TAGS.includes(tag)) {
        err(`${path}.tags`, `unknown creature tag '${tag}' (legal: ${CREATURE_TAGS.join(', ')})`);
      }
    }
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
// SFX recipes (#46) — shape via the layer schemas, meaning via the ramp checks
// ---------------------------------------------------------------------------

/**
 * A recipe is a non-empty array of layers; a layer is discriminated on `kind`
 * FIRST so an error names the field that is wrong, not "matched no variant".
 * The second layer here is meaning, not shape: WebAudio's exponential ramps
 * throw on a target of 0 or below, so a freq/peak/dur a schema would accept
 * as "a number" can still be a sound that dies at play time. Both layers
 * report through `err`, so bad data fails loud and NAMES THE RECIPE
 * (Law 1 clause 5) — at boot via main.js's banner, and in tests.
 */
function validateSfxRecipes(sfx, path, vctx) {
  const { err } = vctx;
  if (!isPlainObject(sfx)) {
    err(path, `Expected an object map of recipe ids, got ${describe(sfx)}`);
    return;
  }
  if (sfx.default === undefined) {
    err(`${path}.default`, "Missing 'default' recipe — the audible fallback for an id with no entry");
  }
  for (const id of Object.keys(sfx)) {
    const p = `${path}.${id}`;
    const layers = sfx[id];
    if (!Array.isArray(layers) || layers.length === 0) {
      err(p, `Recipe must be a non-empty array of layers, got ${Array.isArray(layers) ? 'empty array' : describe(layers)}`);
      continue;
    }
    layers.forEach((layer, i) => {
      const lp = `${p}[${i}]`;
      if (!isPlainObject(layer)) {
        err(lp, `Layer must be an object, got ${describe(layer)}`);
        return;
      }
      if (!SFX_LAYER_KINDS.includes(layer.kind)) {
        err(`${lp}.kind`, `Unknown layer kind '${layer.kind}' (closed set: ${SFX_LAYER_KINDS.join(', ')})`);
        return;
      }
      walkSchema(layer, SFX_LAYER_SCHEMAS[layer.kind], lp, vctx);
      // Meaning: values the engine's ramps would throw on or render as
      // silence. Finite is part of the claim, not a nicety — Infinity is
      // typeof 'number', slides past the schema, and is exactly the class
      // this comment promises to reject (Vira's gate finding on #46: the
      // first version checked > 0 only, and Infinity > 0 is true).
      for (const f of ['freq', 'to', 'dur', 'peak', 'hp', 'lp']) {
        if (typeof layer[f] === 'number' && !(Number.isFinite(layer[f]) && layer[f] > 0)) {
          err(`${lp}.${f}`, `'${f}' must be a finite number > 0, got ${layer[f]} (WebAudio's exponential ramps throw on 0 and on non-finite targets)`);
        }
      }
      if (typeof layer.t0 === 'number' && !(Number.isFinite(layer.t0) && layer.t0 >= 0)) {
        err(`${lp}.t0`, `'t0' must be a finite number >= 0, got ${layer.t0}`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Music beds + the silence word (word 3; Sunna's lift condition)
// ---------------------------------------------------------------------------

/**
 * A context's bed value is either a bed object or the exact word 'silence'
 * (MUSIC_SILENCE_WORD) — deliberate quiet a human typed on purpose. Everything
 * that LOOKS like quiet but wasn't typed as the word is a distinct, named
 * error: null, [], {}, a wrong or miscased word, a zero gain. That is the
 * whole point of the word — quiet-by-intent is never confusable with
 * quiet-by-bug, at boot (main.js banner) and in tests.
 */
function validateMusicBeds(music, path, vctx) {
  const { err } = vctx;
  if (!isPlainObject(music)) {
    err(path, `Expected { scales, beds }, got ${describe(music)}`);
    return;
  }
  for (const key of Object.keys(music)) {
    if (key !== 'scales' && key !== 'beds') err(`${path}.${key}`, `Unknown field '${key}'`);
  }
  const scales = music.scales;
  const scaleIds = new Set();
  if (!isPlainObject(scales)) {
    err(`${path}.scales`, `Expected an object map of scales, got ${describe(scales)}`);
  } else {
    for (const id of Object.keys(scales)) {
      const s = scales[id];
      if (!Array.isArray(s) || s.length === 0) {
        err(`${path}.scales.${id}`, `Scale must be a non-empty array of semitone offsets, got ${Array.isArray(s) ? 'empty array' : describe(s)}`);
        continue;
      }
      scaleIds.add(id);
      s.forEach((v, i) => {
        if (typeof v !== 'number' || !Number.isFinite(v)) err(`${path}.scales.${id}[${i}]`, `Expected finite number, got ${describe(v)}`);
      });
    }
  }
  const beds = music.beds;
  if (!isPlainObject(beds)) {
    err(`${path}.beds`, `Expected an object map of context beds, got ${describe(beds)}`);
    return;
  }
  for (const context of Object.keys(beds)) {
    const p = `${path}.beds.${context}`;
    const bed = beds[context];
    if (bed === MUSIC_SILENCE_WORD) continue; // deliberate quiet, spelled on purpose
    if (bed === null) {
      err(p, `null is not silence — deliberate quiet is spelled '${MUSIC_SILENCE_WORD}'; a null bed is a mistake, not a decision`);
      continue;
    }
    if (typeof bed === 'string') {
      err(p, `The only word for deliberate quiet is '${MUSIC_SILENCE_WORD}' (exact, lowercase), got '${bed}'`);
      continue;
    }
    if (Array.isArray(bed)) {
      err(p, `An array is not a bed and not silence — a bed is an object, deliberate quiet is '${MUSIC_SILENCE_WORD}'`);
      continue;
    }
    walkSchema(bed, MUSIC_BED_SCHEMA, p, vctx);
    if (!isPlainObject(bed)) continue;
    // Meaning: quiet spelled as numbers, and refs the schema cannot see.
    if (typeof bed.gain === 'number' && !(Number.isFinite(bed.gain) && bed.gain > 0)) {
      err(`${p}.gain`, `'gain' must be a finite number > 0, got ${bed.gain} — a zero gain is silence spelled as a number; deliberate quiet is the word '${MUSIC_SILENCE_WORD}'`);
    }
    if (Array.isArray(bed.variants)) {
      if (bed.variants.length === 0) err(`${p}.variants`, `'variants' must be non-empty — a bed with nothing to play is silence by accident; deliberate quiet is '${MUSIC_SILENCE_WORD}'`);
      bed.variants.forEach((v, i) => {
        if (!isPlainObject(v)) return; // schema pass reported it
        for (const f of ['root', 'cadence']) {
          if (typeof v[f] === 'number' && !(Number.isFinite(v[f]) && v[f] > 0)) {
            err(`${p}.variants[${i}].${f}`, `'${f}' must be a finite number > 0, got ${v[f]}`);
          }
        }
        // Vira's gate finding on word 3: 'lift' was missing from this sweep,
        // and a validator-green `lift: Infinity` or `lift: -3` crashed the
        // music loop per note (NaN / negative scale index → non-finite
        // oscillator frequency). Integer, not just finite-positive: the
        // stride INDEXES the scale, and a fractional stride reads
        // scale[4.5] — the same NaN wearing a friendlier number.
        if (typeof v.lift === 'number' && !(Number.isInteger(v.lift) && v.lift > 0)) {
          err(`${p}.variants[${i}].lift`, `'lift' must be a positive integer, got ${v.lift} — the melodic stride indexes the scale, and a negative, fractional, or non-finite stride reads notes that do not exist`);
        }
        if (typeof v.scale === 'string' && !scaleIds.has(v.scale)) {
          err(`${p}.variants[${i}].scale`, `Dangling reference: unknown scale '${v.scale}'`);
        }
      });
    }
  }
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
  if (v === undefined) return 'undefined'; // JSON.stringify(undefined) is undefined — 'undefined undefined' otherwise
  if (Array.isArray(v)) return 'array';
  // NaN and ±Infinity JSON.stringify to "null", so without this branch a NaN
  // red printed the riddle "Expected number, got number null" (Vira, #46).
  if (typeof v === 'number' && !Number.isFinite(v)) return `number ${String(v)}`;
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
    if (eff.op === 'damage' && eff.tags !== undefined) {
      if (!Array.isArray(eff.tags) || !eff.tags.length) {
        err(`${p}.tags`, 'damage tags must be a non-empty array of effect-tag ids');
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
