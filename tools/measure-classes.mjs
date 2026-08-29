// tools/measure-classes.mjs — instrumented per-class win-rate measurement
// (EldenSpire issue #55: Reaver 1/30 — sim skill floor or class defect?).
//
// This is runsim.mjs's exact bot and run loop (copied, not imported — runsim
// exports nothing) plus passive instrumentation: after each combat it reads
// combat.eventLog, which consumes no RNG and touches no state, so the default
// policy reproduces runsim's runs seed-for-seed. `--check` asserts exactly
// that, and nothing more.
//
// WHAT `--check` IS, said plainly: a CONSISTENCY check, never a correctness
// one. It proves this file's copied bot still agrees with runsim's. It says
// nothing about whether runsim is right, whether the bot is a good pilot, or
// whether the game is balanced. Two implementations that agree can be wrong
// together, and this check would print PASSED.
//
// HOW THE BASELINE IS OBTAINED, and why it is not a number in this file.
// Until 2026-08-07 the comparison was a frozen constant — the wins runsim
// happened to produce on the day the datum was collected. A frozen baseline is
// a fact with a half-life: every legitimate balance edit moves the game away
// from it, and the check then reports DRIFT while naming the wrong defendant
// ("this file has drifted from runsim") when the two files agree perfectly. On
// a healthy tree at 18aab6f it read 3/5/7 against a frozen 1/4/6 and failed all
// three classes while the actual drift was ZERO. Updating the number would only
// reset the clock on the same defect, so the constant is DELETED: the baseline
// is now derived at run time by executing tools/runsim.mjs in this same tree
// and reading its wins. Same tree, same commit, no stored fact to rot.
// If runsim cannot be run or its output cannot be parsed, this check EXITS 2
// as an error — it never degrades to a pass (Law 0 clause 5: a green that
// could not do its own measurement is the dangerous failure).
//
// What it adds over runsim:
//   - honest n (default 500/class; seeds are runsim's own formula, so any n
//     nests the 30-run datum as its prefix)
//   - Wilson 95% CI per class + pairwise two-proportion z-tests
//   - deaths by act and by pool; top killer encounters
//   - kit-expression counters (the instrument rule: a sim that never triggers
//     the kit measures the sim): per-class signature statuses actually applied
//     (Reaver bleed/staggered, Herald crimsonBlight, Starseer starstoneCharge),
//     Reaver stance entries, damage dealt/taken per combat
//   - class-agnostic policy variants (--policy=greedy|skillfirst|random) as the
//     policy-sensitivity control: greedy is runsim's leftmost-affordable;
//     skillfirst plays affordable skills before attacks (class-agnostic);
//     random picks uniformly among affordable cards using a SEPARATE seeded
//     LCG so the game's own rng streams are never perturbed by the picker.
//     If the class ranking holds across policies, the split is not an
//     artifact of one card ordering.
//   - targeted falsifiers reaverkit and starseerkit. Each changes only its
//     named class; complete non-target rows must remain seed-identical to
//     greedy. Their evidence is paired within the named class, not a claim
//     that every class was piloted by one identical policy.
//
// Run: node tools/measure-classes.mjs [runsPerClass=500] [--policy=greedy]
//      node tools/measure-classes.mjs [n=30] --check        derive + compare
//      node tools/measure-classes.mjs --selftest            observed red, built in
//      node tools/measure-classes.mjs --mutate=<name>        one planted drift
// Boundary this tool does NOT cover: it measures the naive bot only — no
// combo piloting, no deck curation, no merchant. Absolute rates are the sim's
// floor, never the game's difficulty; only the BETWEEN-CLASS split under an
// identical policy is evidence about classes. That boundary is printed in the
// run output too, not only here (SPEC §8 clause 5) — a header is read by the
// author, the output by whoever is about to trust the number.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch, previewCard, previewIntent } from '../src/engine/combat.js';
import { emitEvent } from '../src/engine/triggers.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRunState, createIdGen } from '../src/model/state.js';
import { hasStatus } from '../src/engine/statuses.js';
import { executeRunEffects } from '../src/engine/actions.js';
import {
  rollEncounter, rollRuneReward, rollCardRewardIds, rollFlaskDrop,
  rollRelicReward, shrineHealAmount, applyGraceRefill,
} from '../src/engine/encounters.js';

const REG = createRegistries(contentBundle);
const argv = process.argv.slice(2);
const N = Number(argv.find((a) => /^\d+$/.test(a)) || 500);
const POLICY = (argv.find((a) => a.startsWith('--policy=')) || '--policy=greedy').slice(9);
const CHECK = argv.includes('--check');
const SELFTEST = argv.includes('--selftest');
if (!['greedy', 'skillfirst', 'random', 'reaverkit', 'starseerkit'].includes(POLICY)) {
  console.error(`unknown policy '${POLICY}'`); process.exit(2);
}

// ---- planted drift, for the observed red (SPEC §8 clause 4) -----------------
// The defect class --check exists to catch is THIS file's copied bot silently
// diverging from runsim's. Each mutation below reinstates one such divergence
// at the exact site where the copy was made; each must be CAUGHT. Inverted
// expectation, so the corpus is not one anybody has to take on trust.
//
// `rng` is the sharpest of the four: the header's central claim is that the
// instrumentation consumes no RNG, so the runs nest seed-for-seed. `rng` burns
// one draw per combat — the claim's own falsifier, failing for the right
// reason rather than for a coincidence of win counts.
const MUTATIONS = {
  rng: 'instrumentation stops being passive — burns one misc draw per combat',
  flask: 'flask threshold 0.55 → 0.75 (runsim drinks at 0.55)',
  path: 'shrine-preference gate 0.55 → 0.95 (map pathing diverges)',
  shrine: 'shrine rest gate 0.60 → 0.20 (rest/smith decision diverges)',
};
const STAR_MUTATIONS = {
  starseerFollowup: 'charged follow-up prioritization is removed while the policy name remains',
  starChargeGain: 'statusApplied(starstoneCharge) receipts are ignored',
  starOpportunity: 'eligible charged decision points are not counted',
  starTurnReach: 'turns containing an eligible charged decision point are not counted',
  starConversion: 'the charged outcome receipt is ignored',
  starStranded: 'statusExpired(starstoneCharge) receipts at player turn end are ignored',
  starEnergy: 'playerTurnEnd receipts do not record the energy being abandoned',
  starCards: 'cardPlayed receipts are ignored for cards-per-turn',
  starOutcomes: 'charged outcome-family receipts are ignored',
  starLethalOutcome: 'a lethal unconditional hit is allowed to impersonate a skipped charged branch',
  starLethalTarget: 'a later low-HP enemy is allowed to force a lethal pick against the wrong target',
  starStampedTrace: 'the selected hand instance is stripped before its charged effect is traced',
  starLethalUnderestimate: 'authored damage ignores stamped card and player modifiers that make the live hit lethal',
  starLethalOverestimate: 'authored damage ignores target modifiers and Block that keep the live target alive',
  starOrderedDispatch: 'static effect-row previews miss status amplification created earlier in the same card',
  starControlOutcome: 'charged Frost/Vulnerable outcomes are omitted from conversion receipts',
  starDelayedIntent: 'a delayed attack is treated as incoming on its charging turn',
};
let MUTATE = (argv.find((a) => a.startsWith('--mutate=')) || '').slice(9) || null;
if (MUTATE && !(MUTATE in MUTATIONS) && !(MUTATE in STAR_MUTATIONS)) {
  console.error(`unknown mutation '${MUTATE}'; known: ${[...Object.keys(MUTATIONS), ...Object.keys(STAR_MUTATIONS)].join(', ')}`);
  process.exit(2);
}

// Signature statuses per class — the kit the instrument rule says we must see
// firing before any rate is trusted.
const SIGNATURE = {
  reaver: ['bleed'], // poise breaks counted via the enemyStaggered event, not a status
  starseer: ['starstoneCharge'],
  herald: ['crimsonBlight'],
};

// ---- reaverkit: the #55 falsifier policy ------------------------------------
// "A modestly kit-aware Reaver policy at n=1000; if he's still CI-below both,
// the class-defect reading returns" — my own verdict's falsifier, built as
// promised. MODEST means ordered heuristics a tired player would find in one
// evening, not a solver. Classification is data-driven — it reads card
// EFFECTS (enterStance / applyStatus bleed / poiseDamage / block / staggered
// conditionals), never card ids, so a new Reaver card is picked up by shape
// (Law 1 clause 3: data says what, engine decides how — this bot reads what).
//
// Decision rule, pre-registered before the run: Reaver under reaverkit at
// n=1000 vs Starseer and Herald under their best-known policy at n=1000 —
// if Reaver's Wilson upper bound is still below BOTH classes' lower bounds,
// the class-defect card is filed; otherwise the split reads as sim skill
// floor. The tools card lands either way.
const hasEff = (def, pred) => (def.effects || []).some(pred);
const appliesStatus = (def, status) => hasEff(def, (e) => e.op === 'applyStatus' && e.status === status);
const hasStaggerPayoff = (def) => hasEff(def, (e) => e.if && e.if.p === 'hasStatus' && e.if.status === 'staggered');
const entersStance = (def, stanceId) => hasEff(def, (e) => e.op === 'enterStance' && (!stanceId || e.stance === stanceId));
const givesBlock = (def) => hasEff(def, (e) => e.op === 'block' && (e.target === 'self' || e.target === 'owner'));
const doesPoiseDamage = (def) => hasEff(def, (e) => e.op === 'poiseDamage');

function reaverkitPick(combat, affordable) {
  const defs = affordable.map((h) => ({ h, def: resolveCard(REG, { cardId: h.cardId, upgraded: h.upgraded }) }));
  const find = (pred) => { const x = defs.find((d) => pred(d.def)); return x && x.h; };
  const hp = combat.player.hp / combat.player.maxHp;
  // 1. No stance yet: enter one — Gorefire while healthy (it costs hp per
  //    entry), Bulwark when hurting; any stance beats none.
  if (!combat.player.stanceId) {
    const pick = hp >= 0.5
      ? (find((d) => entersStance(d, 'gorefire')) || find((d) => entersStance(d)))
      : (find((d) => entersStance(d, 'bulwark')) || find((d) => entersStance(d)));
    if (pick) return pick;
  }
  // 2. An enemy is staggered: spend the window on a stagger-payoff card.
  const staggeredUp = combat.enemies.some((e) => e.alive && hasStatus(e, 'staggered'));
  if (staggeredUp) {
    const pick = find((d) => d.type === 'attack' && hasStaggerPayoff(d));
    if (pick) return pick;
  }
  // 3. Hurting: block first (in Bulwark every skill is +2 block on top).
  if (hp < 0.45) {
    const pick = find((d) => d.type === 'skill' && givesBlock(d));
    if (pick) return pick;
  }
  // 4. Bleed ramp; 5. poise pressure toward the next stagger; 6. greedy.
  return find((d) => d.type === 'attack' && appliesStatus(d, 'bleed'))
    || find((d) => d.type === 'attack' && doesPoiseDamage(d))
    || affordable[0];
}

// ---- starseerkit: #205's effect-shaped policy and decision receipts ---------
// The policy never names a card. It reads the same declarative effects the
// engine interprets, and for non-Starseer classes returns the greedy pick
// immediately. That last boundary is checked seed-for-seed below.
const predContainsCharge = (pred) => {
  if (!pred || typeof pred !== 'object') return false;
  if (pred.p === 'hasStatus' && pred.status === 'starstoneCharge') return true;
  return Object.values(pred).some((v) => Array.isArray(v)
    ? v.some(predContainsCharge)
    : predContainsCharge(v));
};
// Three-valued abstract evaluation with Starstone charge known present and
// every unrelated predicate left unknown. A `not(hasStatus(charge))` branch is
// therefore excluded from the charged opportunity set; `all(charge, X)` stays
// possible because X may hold at the real decision boundary.
const predWithCharge = (pred) => {
  if (!pred || typeof pred !== 'object') return null;
  if (pred.p === 'hasStatus' && pred.status === 'starstoneCharge'
      && ['self', 'owner', 'player'].includes(pred.of)) return true;
  if (pred.p === 'not') {
    const value = predWithCharge(pred.pred);
    return value === null ? null : !value;
  }
  if (pred.p === 'all') {
    const values = (pred.preds || []).map(predWithCharge);
    if (values.includes(false)) return false;
    return values.every((value) => value === true) ? true : null;
  }
  if (pred.p === 'any') {
    const values = (pred.preds || []).map(predWithCharge);
    if (values.includes(true)) return true;
    return values.every((value) => value === false) ? false : null;
  }
  return null;
};
const chargedEffectEntries = (def) => (def.effects || [])
  .map((effect, index) => ({ effect, index }))
  .filter(({ effect }) => predContainsCharge(effect.if) && predWithCharge(effect.if) !== false);
const chargedEffects = (def) => chargedEffectEntries(def).map(({ effect }) => effect);
const establishesCharge = (def) => (def.effects || []).some((e) => e.op === 'applyStatus'
  && e.status === 'starstoneCharge' && !e.if && (e.target === 'self' || e.target === 'owner'));
const conditionalFamily = (effect) => {
  if (effect.op === 'damage') return 'damage';
  if (effect.op === 'block' || (effect.op === 'applyStatus' && effect.status === 'weak')) return 'defense';
  if (effect.op === 'applyStatus' && ['frost', 'vulnerable'].includes(effect.status)) return 'control';
  if (effect.op === 'draw' || effect.op === 'gainEnergy') return 'continuation';
  return null;
};
const conditionalFamilies = (def) => {
  const out = new Set();
  for (const e of chargedEffects(def)) {
    const family = conditionalFamily(e);
    if (family) out.add(family);
  }
  return out;
};
const hasDefensiveEffect = (def) => (def.effects || []).some((e) => e.op === 'block'
  || (e.op === 'applyStatus' && e.status === 'weak'));
const numericDamage = (def) => (def.effects || []).reduce((sum, e) => {
  if (e.op !== 'damage' || typeof e.amount !== 'number') return sum;
  if (predContainsCharge(e.if) && predWithCharge(e.if) === false) return sum;
  return sum + e.amount * (typeof e.hits === 'number' ? e.hits : 1);
}, 0);
const resolvedHandDef = (hand) => resolveCard(REG, MUTATE === 'starStampedTrace'
  ? { cardId: hand.cardId, upgraded: hand.upgraded }
  : hand);

// Lethal means HP actually removed from the exact entity botFight will aim at,
// not authored numbers on the card row. previewCard is the engine's shared
// damage authority: it resolves this stamped hand instance (mods/profile and
// damage carrier), player adds/multipliers, target multipliers/resistance and
// per-target AoE values. Block is then consumed across the same ordered hits.
// Starseer damage predicates are charge gates; this picker reaches the helper
// only while charge is live, so the false branch is excluded exactly.
function resolvedLiveHpLoss(combat, hand, def, target) {
  if (!hand || !target || !target.alive) return 0;
  const preview = previewCard(combat, hand.instanceId, target.id);
  let resolvedDamage = 0;
  for (let index = 0; index < (def.effects || []).length; index++) {
    const effect = def.effects[index];
    if (effect.op !== 'damage' || !['enemy', 'allEnemies'].includes(effect.target)) continue;
    if (predContainsCharge(effect.if) && predWithCharge(effect.if) === false) continue;
    const row = preview.values[index];
    if (!row) continue;
    const perHit = row.perTarget && Number.isFinite(row.perTarget[target.id])
      ? row.perTarget[target.id]
      : row.value;
    if (!Number.isFinite(perHit)) continue;
    resolvedDamage += perHit * (Number.isFinite(row.hits) ? row.hits : 1);
  }
  return Math.min(target.hp, Math.max(0, resolvedDamage - Math.max(0, target.block || 0)));
}

// A lethal decision must answer the same ordered question as playCard. A
// static preview resolves every row from pre-play state, so it cannot see an
// earlier effect applying Vulnerable before a later hit. Clone only mutable
// combat state, give it an independent RNG at the exact same counters, rebind
// the event/queue doors to the clone, and dispatch the exact hand instance at
// the exact authoritative target. No product state, RNG counter, pile, log,
// target or trace object is touched by this probe.
function cloneCombatForOrderedProbe(combat) {
  if (combat.queue.length || combat._buffer) throw new Error('ordered lethal probe requires a settled dispatch boundary');
  const state = {};
  for (const [key, value] of Object.entries(combat)) {
    if (['registries', 'rng', 'emit', 'enqueue', 'nextInstanceId'].includes(key)) continue;
    state[key] = key === 'eventLog' ? [] : value;
  }
  const probe = structuredClone(state);
  probe.registries = combat.registries;
  probe.rng = createRng(combat.rng.seed, combat.rng.getCounters());
  probe.emit = (type, payload) => emitEvent(probe, type, payload);
  probe.enqueue = (action) => probe.queue.push(action);
  probe.nextInstanceId = () => `gen${++probe._idCounter}`;
  return probe;
}

function orderedDispatchHpLoss(combat, hand, target) {
  if (!hand || !target || !target.alive) return 0;
  const probe = cloneCombatForOrderedProbe(combat);
  const probeTarget = probe.enemies.find((enemy) => enemy.id === target.id);
  const hpBefore = probeTarget.hp;
  dispatch(probe, { type: 'playCard', cardInstanceId: hand.instanceId, targetId: probeTarget.id });
  return Math.min(hpBefore, Math.max(0, hpBefore - probeTarget.hp));
}
const cardCost = (def) => (def.cost === 'X' ? 99 : Number(def.cost || 0)) + Number(def.manaCost || 0);
const incomingDamage = (combat) => combat.enemies.reduce((sum, enemy) => {
  if (!enemy.alive) return sum;
  try {
    const preview = previewIntent(combat, enemy.id);
    if (preview.delayed && MUTATE !== 'starDelayedIntent') {
      // A delayed intent first COMMITs and performs only whileCharging. Its
      // payload is incoming only on a later player turn whose next enemy phase
      // can resolve the committed pending move. Ordinary Block gained on the
      // commit turn is cleared at that later player-turn start and cannot
      // protect the hit.
      const pending = enemy.pendingMove;
      if (!pending || combat.turn < pending.resolveOnTurn) return sum;
    }
    return sum + Number(preview.totalDamage || 0);
  } catch { return sum; }
}, 0);
const containsChargeApplication = (node) => {
  if (!node || typeof node !== 'object') return false;
  if (node.op === 'applyStatus' && node.status === 'starstoneCharge') return true;
  return Object.values(node).some((v) => Array.isArray(v)
    ? v.some(containsChargeApplication)
    : containsChargeApplication(v));
};
const persistentStarstonePower = (def) => {
  if (def.type !== 'power') return false;
  return (def.effects || []).some((e) => {
    if (e.op !== 'applyStatus' || !['self', 'owner'].includes(e.target)) return false;
    let status;
    try { status = REG.statuses.get(e.status); } catch { return false; }
    return containsChargeApplication(status);
  });
};

function starseerkitPick(combat, affordable, dispatchTarget = combat.enemies.find((enemy) => enemy.alive)) {
  if (combat.player.classId !== 'starseer') return affordable[0];
  const defs = affordable.map((h) => ({ h, def: resolvedHandDef(h) }));
  const incoming = incomingDamage(combat);
  const protectedNow = combat.player.block >= incoming;
  const stableCheapest = (rows) => rows.slice().sort((a, b) => cardCost(a.def) - cardCost(b.def))[0];

  // Establish a persistent combo engine early, but never spend the action when
  // the telegraphed hit already exceeds both current block and current HP.
  const charged = hasStatus(combat.player, 'starstoneCharge');
  if (!charged && combat.turn <= 3 && incoming < combat.player.hp + combat.player.block) {
    const power = stableCheapest(defs.filter(({ def }) => persistentStarstonePower(def)));
    if (power) return power.h;
  }

  if (charged) {
    // The observed-red plant removes only this charged prioritization. The
    // policy still exists, still establishes charge, and still falls back.
    if (MUTATE !== 'starseerFollowup') {
      const followups = defs.filter(({ def }) => chargedEffects(def).length > 0);
      // Lethality is about the exact entity botFight will dispatch to. A later
      // low-HP enemy must not force an early return for a card that is nonlethal
      // against the first living (authoritative) target.
      const lethal = followups.find(({ h, def }) => {
        if (def.type !== 'attack') return false;
        if (MUTATE === 'starLethalTarget') {
          return combat.enemies.some((enemy) => enemy.alive
            && orderedDispatchHpLoss(combat, h, enemy) >= enemy.hp);
        }
        if (!dispatchTarget) return false;
        if (['starLethalUnderestimate', 'starLethalOverestimate'].includes(MUTATE)) {
          return numericDamage(def) >= dispatchTarget.hp;
        }
        const hpLoss = MUTATE === 'starOrderedDispatch'
          ? resolvedLiveHpLoss(combat, h, def, dispatchTarget)
          : orderedDispatchHpLoss(combat, h, dispatchTarget);
        return hpLoss >= dispatchTarget.hp;
      });
      if (lethal) return lethal.h;
      if (!protectedNow) {
        const defense = stableCheapest(followups.filter(({ def }) => conditionalFamilies(def).has('defense')));
        if (defense) return defense.h;
      }
      const damage = stableCheapest(followups.filter(({ def }) => conditionalFamilies(def).has('damage')));
      if (damage) return damage.h;
      const continuation = stableCheapest(followups.filter(({ def }) => conditionalFamilies(def).has('continuation')));
      if (continuation) return continuation.h;
      if (followups.length) return stableCheapest(followups).h;
    }
    return affordable[0];
  }

  // Uncharged: a cheap charge-establishing spell, with defense first only
  // when the current intent penetrates block. Stable sort preserves greedy
  // order among cards with the same total Energy+Mana cost.
  const starters = defs.filter(({ def }) => establishesCharge(def));
  if (!protectedNow) {
    const defense = stableCheapest(starters.filter(({ def }) => hasDefensiveEffect(def)));
    if (defense) return defense.h;
  }
  return (stableCheapest(starters) || defs[0] || {}).h;
}

// Trace one selected card without changing its state, RNG, queue order or
// event log. Every queued action is wrapped so reading `script` marks the start
// of that action; `op` is not read until AFTER executeAction has accepted the
// predicate. Events emitted by that exact effect are then kept by effect index.
// This is the effect-log half of the preregistered conversion definition: an
// unconditional event elsewhere in the card cannot impersonate the conditional
// branch, and a branch skipped because an earlier lethal effect ended combat
// has neither an executed index nor an attributed receipt.
function traceCardDispatch(combat, def, cardInstanceId, invoke) {
  const indexByEffect = new Map((def.effects || []).map((effect, index) => [effect, index]));
  const executed = new Set();
  const eventsByIndex = new Map();
  let activeIndex = null;
  const enqueue = combat.enqueue;
  const emit = combat.emit;
  combat.enqueue = (action) => {
    const raw = action.effect;
    const ownIndex = action.card && action.card.instanceId === cardInstanceId
      ? indexByEffect.get(raw) : undefined;
    const effect = new Proxy(raw, {
      get(target, prop, receiver) {
        if (prop === 'script') activeIndex = null;
        const value = Reflect.get(target, prop, receiver);
        if (prop === 'op' && ownIndex !== undefined) {
          activeIndex = ownIndex;
          executed.add(ownIndex);
        }
        return value;
      },
    });
    enqueue({ ...action, effect });
  };
  combat.emit = (type, payload) => {
    const owner = activeIndex;
    const event = emit(type, payload);
    if (owner !== null) {
      if (!eventsByIndex.has(owner)) eventsByIndex.set(owner, []);
      eventsByIndex.get(owner).push(event);
    }
    return event;
  };
  try {
    const result = invoke();
    return { result, executed, eventsByIndex };
  } finally {
    combat.enqueue = enqueue;
    combat.emit = emit;
  }
}

function effectHasReceipt(effect, events) {
  if (effect.op === 'damage') return events.some((e) => e.type === 'damageDealt' && e.sourceId === 'player');
  if (effect.op === 'block') return events.some((e) => e.type === 'blockGained' && e.targetId === 'player');
  if (effect.op === 'applyStatus') return events.some((e) => e.type === 'statusApplied'
    && e.sourceId === 'player' && e.status === effect.status);
  if (effect.op === 'draw') return events.some((e) => e.type === 'cardDrawn');
  if (effect.op === 'gainEnergy') return events.some((e) => e.type === 'energyGained');
  return false;
}

// The deliberately bad path reproduces the old broad-family counter for the
// lethal-Pebble plant. It is never used by a clean run.
function broadOutcomeReceipts(def, events) {
  const wanted = conditionalFamilies(def);
  const got = new Set();
  if (wanted.has('damage') && events.some((e) => e.type === 'damageDealt' && e.sourceId === 'player')) got.add('damage');
  if (wanted.has('defense') && events.some((e) => (e.type === 'blockGained' && e.targetId === 'player')
      || (e.type === 'statusApplied' && e.sourceId === 'player' && e.status === 'weak'))) got.add('defense');
  if (wanted.has('control') && events.some((e) => e.type === 'statusApplied' && e.sourceId === 'player'
      && ['frost', 'vulnerable'].includes(e.status))) got.add('control');
  if (wanted.has('continuation') && events.some((e) => e.type === 'cardDrawn' || e.type === 'energyGained')) got.add('continuation');
  return got;
}

function outcomeReceipts(def, trace, decisionEvents) {
  if (MUTATE === 'starLethalOutcome') return broadOutcomeReceipts(def, decisionEvents);
  const got = new Set();
  for (const { effect, index } of chargedEffectEntries(def)) {
    const family = conditionalFamily(effect);
    if (!family || (family === 'control' && MUTATE === 'starControlOutcome')) continue;
    if (!trace.executed.has(index)) continue;
    if (effectHasReceipt(effect, trace.eventsByIndex.get(index) || [])) got.add(family);
  }
  return got;
}

// Decision-point contract from #205's preregistration clarification:
// one denominator when an already-charged selection boundary has >=1 legal,
// affordable conditional card; no denominator for the card that first gains
// charge; a later eligible boundary is another denominator. Selection alone
// is not a conversion — the effect-index trace must prove the charged branch
// executed and that exact effect emitted its damage, block/status, draw or
// Energy receipt. Frost and Vulnerable are first-class control receipts.
function recordStarDecision(stats, turnSet, { combat, eligible, selectedDef, events, trace }) {
  if (combat.player.classId !== 'starseer' || !eligible.length) return;
  if (MUTATE !== 'starOpportunity') stats.starOpportunityDecisions++;
  if (MUTATE !== 'starTurnReach' && !turnSet.has(combat.turn)) {
    turnSet.add(combat.turn); stats.starOpportunityTurns++;
  }
  if (!selectedDef || chargedEffects(selectedDef).length === 0) return;
  const receipts = outcomeReceipts(selectedDef, trace, events);
  if (MUTATE !== 'starConversion' && receipts.size > 0) stats.starFollowups++;
  if (MUTATE !== 'starOutcomes') for (const family of receipts) stats.starOutcomes[family]++;
}

function recordStarEvents(stats, events, energyAtEndTurn) {
  for (const ev of events) {
    if (ev.type === 'statusApplied' && ev.targetId === 'player' && ev.status === 'starstoneCharge'
        && MUTATE !== 'starChargeGain') stats.starCharges++;
    if (ev.type === 'statusExpired' && ev.targetId === 'player' && ev.status === 'starstoneCharge' && ev.reason === 'decayed'
        && MUTATE !== 'starStranded') stats.starStranded++;
    if (ev.type === 'playerTurnStart') stats.playerTurns++;
    if (ev.type === 'playerTurnEnd') stats.endTurns++;
    if (ev.type === 'cardPlayed' && MUTATE !== 'starCards') stats.cardsPlayed++;
  }
  if (MUTATE !== 'starEnergy') stats.unspentEnergy += energyAtEndTurn.reduce((sum, n) => sum + n, 0);
}

// Separate LCG for the random policy only — never the game's rng.
function makeLcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---- the combat bot (runsim.mjs verbatim, except the card picker) -----------
function botFight(run, rng, encounterId, stats, pickRandom, policy) {
  const enc = REG.encounters.get(encounterId);
  const combat = createCombat({
    registries: REG, rng,
    // runsim.mjs's stamped-player hunk, verbatim (this file's rule: the bot is
    // runsim's, copied not imported; both crashed unstamped from the day the
    // combat entity began refusing an unstamped energyMax).
    player: {
      classId: run.class, attributes: run.attributes, loadout: run.loadout,
      maxHp: run.maxHp, hp: run.hp,
      maxMana: run.maxMana, mana: run.mana,
      maxStamina: run.maxStamina, stamina: run.stamina,
      energyMax: run.energyMax, drawPerTurn: run.drawPerTurn,
      equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot,
      deck: run.deck, relicIds: run.relics, flasks: run.flasks,
      flaskCharges: run.flaskCharges,
      // The relic damage authority the host stamps at run creation
      // (D23, model/relicModifiers.js). Both fleets built their player
      // literal by name and NOBODY added this field when it landed, so
      // every simulated Starseer fought without the Starstone Shard's
      // +1 magic — a live pool the game reads and the sim did not.
      damageBySchoolAdd: run.damageBySchoolAdd,
    },
    enemyIds: enc.enemies,
  });
  const opportunityTurns = new Set();
  const energyAtEndTurn = [];
  if (MUTATE === 'rng') rng.float('misc'); // planted: the instrumentation is no longer passive
  let guard = 0;
  while (!combat.result && guard++ < 9000) {
    if (combat.player.hp < combat.player.maxHp * (MUTATE === 'flask' ? 0.75 : 0.55)) {
      // CHARGE VESSEL FIRST — mirrors runsim.mjs, which carries the reason in
      // full: `chargeKind` is the door the player's own flask buttons use, and
      // both bots only ever sent `slot`. Copied deliberately (this file's
      // header: copied, not imported), so --check keeps the two honest.
      const ch = combat.player.flaskCharges;
      if (ch && (ch.hpCurrent || 0) > 0) {
        try { dispatch(combat, { type: 'useFlask', chargeKind: 'hp' }); continue; } catch (e) { /* fall through */ }
      }
      if (combat.player.flasks.length) {
        const fdef = REG.flasks.get(combat.player.flasks[0].flaskId);
        const ftgt = combat.enemies.find((e) => e.alive);
        try {
          dispatch(combat, { type: 'useFlask', slot: 0, targetId: fdef.targeted ? ftgt && ftgt.id : undefined });
          continue;
        } catch (e) { /* flask rejected — fall through to cards */ }
      }
    }
    const affordable = combat.piles.hand.filter((h) => {
      const def = resolvedHandDef(h);
      if ((def.keywords || []).includes('unplayable')) return false;
      return (def.cost === 'X' ? 0 : def.cost) <= combat.player.energy && (def.manaCost || 0) <= combat.player.mana;
    });
    const chargedAtDecision = run.class === 'starseer' && hasStatus(combat.player, 'starstoneCharge');
    const eligible = chargedAtDecision
      ? affordable.filter((h) => chargedEffects(resolvedHandDef(h)).length > 0)
      : [];
    // One authoritative target feeds both policy scoring and dispatch. Keeping
    // these as the same object prevents a multi-enemy lethal check from naming
    // one enemy while the action lands on another.
    const tgt = combat.enemies.find((e) => e.alive);
    let card;
    if (policy === 'greedy') card = affordable[0];
    else if (policy === 'reaverkit') card = affordable.length ? reaverkitPick(combat, affordable) : undefined;
    else if (policy === 'starseerkit') card = affordable.length ? starseerkitPick(combat, affordable, tgt) : undefined;
    else if (policy === 'skillfirst') {
      card = affordable.find((h) => resolveCard(REG, { cardId: h.cardId, upgraded: h.upgraded }).type !== 'attack') || affordable[0];
    } else { // random
      card = affordable.length ? affordable[Math.floor(pickRandom() * affordable.length)] : undefined;
    }
    const selectedDef = card ? resolvedHandDef(card) : null;
    if (policy === 'starseerkit' && chargedAtDecision && card && affordable[0]
        && card.instanceId !== affordable[0].instanceId) stats.starChargedPriorityChanges++;
    const eventStart = combat.eventLog.length;
    const endingEnergy = card ? null : combat.player.energy;
    let decisionTrace = { executed: new Set(), eventsByIndex: new Map() };
    try {
      if (card && chargedAtDecision) {
        decisionTrace = traceCardDispatch(combat, selectedDef, card.instanceId,
          () => dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: tgt && tgt.id }));
      } else if (card) dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: tgt && tgt.id });
      else dispatch(combat, { type: 'endTurn' });
    } catch (e) {
      dispatch(combat, { type: 'endTurn' });
    }
    const decisionEvents = combat.eventLog.slice(eventStart);
    recordStarDecision(stats, opportunityTurns, {
      combat, eligible, selectedDef, events: decisionEvents, trace: decisionTrace,
    });
    if (endingEnergy != null && decisionEvents.some((e) => e.type === 'playerTurnEnd')) energyAtEndTurn.push(endingEnergy);
  }
  if (guard >= 9000) throw new Error(`combat stalled: ${encounterId}`);

  // ---- passive instrumentation: read the log, touch nothing -----------------
  stats.combats++;
  // #61 diagnosis walk — per-enemy bleed-meter replay (the meter math is
  // statuses.js checkMeterFill verbatim: overflow carries, threshold grows
  // ceil(×1.5) per fill — replayed here from events, never touched live) and
  // stagger-window conversion. All from eventLog, zero extra RNG.
  const enemies = {}; // targetId -> bleed/window tallies
  const eTally = (t) => (enemies[t] || (enemies[t] = { applied: 0, fillPts: 0, fills: 0, window: null }));
  for (const ev of combat.eventLog) {
    if (ev.type === 'statusApplied' && ev.status === 'bleed' && ev.targetId !== 'player') {
      eTally(ev.targetId).applied += ev.stacks;
    }
    // #61 branch adaptation: bleed procs emit procBurst (own-proc event), not
    // meterFilled; the consumed points per proc are the CONSTANT threshold
    // (reset-to-zero drops overflow, so consumed = threshold exactly).
    if ((ev.type === 'meterFilled' || ev.type === 'procBurst') && ev.status === 'bleed') {
      const e = eTally(ev.targetId); e.fills++; e.fillPts += ev.threshold;
    }
    if (ev.type === 'enemyStaggered') {
      const e = eTally(ev.targetId);
      if (!e.window) { e.window = { converted: false }; stats.winTotal++; }
    }
    if (ev.type === 'cardPlayed' && ev.targetId && enemies[ev.targetId] && enemies[ev.targetId].window
        && !enemies[ev.targetId].window.converted
        && hasStaggerPayoff(resolveCard(REG, { cardId: ev.cardId, upgraded: false }))) {
      enemies[ev.targetId].window.converted = true; stats.winConverted++;
    }
    if (ev.type === 'statusExpired' && ev.status === 'staggered' && enemies[ev.targetId] && enemies[ev.targetId].window) {
      if (!enemies[ev.targetId].window.converted) stats.winExpired++;
      enemies[ev.targetId].window = null;
    }
    if (ev.type === 'enemyDied' && enemies[ev.targetId] && enemies[ev.targetId].window) {
      if (!enemies[ev.targetId].window.converted) stats.winDiedOpen++;
      enemies[ev.targetId].window = null;
    }
    if (ev.type === 'hpLost' && ev.targetId !== 'player' && ev.cause !== 'attack') {
      // ALL effect-sourced enemy HP loss — for Reaver this is ≈ bleed bursts;
      // for Herald it is ≈ crimsonBlight ticks. Named approximation, not an
      // exact attribution (an enemy self-loseHp move would land here too).
      stats.burstDmg += ev.amount;
    }
    if (ev.type === 'hpLost' && ev.targetId === 'player' && ev.cause !== 'attack') {
      stats.selfTax += ev.amount; // Gorefire entry cost and kin — HP paid to the kit, not to enemies
    }
    if (ev.type === 'healed' && ev.targetId === 'player') {
      stats.healed += ev.amount;
    }
  }
  for (const e of Object.values(enemies)) {
    stats.bleedApplied += e.applied;
    stats.bleedFills += e.fills;
    stats.bleedStranded += Math.max(0, e.applied - e.fillPts); // points that never burst — died or combat ended sub-threshold
  }
  for (const ev of combat.eventLog) {
    if (ev.type === 'statusApplied' && ev.sourceId === 'player' && ev.targetId !== 'player') {
      stats.statusOut[ev.status] = (stats.statusOut[ev.status] || 0) + ev.stacks;
    }
    if (ev.type === 'statusApplied' && ev.targetId === 'player') {
      stats.statusSelf[ev.status] = (stats.statusSelf[ev.status] || 0) + ev.stacks;
    }
    if (ev.type === 'stanceEntered') stats.stanceEnters++;
    // Poise breaks are emitted as enemyStaggered, not as a player-sourced
    // statusApplied — counting the status alone reads 0 forever (found the
    // hard way: first run of this tool reported staggered 0.00/combat).
    if (ev.type === 'enemyStaggered') stats.staggers++;
    if (ev.type === 'damageDealt') {
      if (ev.sourceId === 'player') stats.dmgDealt += ev.amount;
      else if (ev.targetId === 'player') stats.dmgTaken += ev.amount;
    }
  }
  recordStarEvents(stats, combat.eventLog, energyAtEndTurn);

  run.flasks = combat.player.flasks;
  // The write-back src/main.js:1335 performs — without it the vessels are
  // infinite, because createPlayerCombatEntity copies them. Mirrors runsim.mjs.
  run.flaskCharges = combat.player.flaskCharges ? { ...combat.player.flaskCharges } : run.flaskCharges;
  if (combat.result === 'victory') run.hp = combat.player.hp;
  return combat.result;
}

function afterVictory(run, rng, pool) {
  run.cinders += rollRuneReward(REG, rng, pool, run.relics);
  const cards = rollCardRewardIds(REG, rng, { classId: run.class, pool, relicIds: run.relics });
  if (cards.length) run.deck.push({ instanceId: run._id(), cardId: cards[0], upgraded: false });
  const flask = rollFlaskDrop(REG, rng, run);
  if (flask && run.flasks.length < (REG.balance.flaskSlots || 3)) run.flasks.push({ flaskId: flask });
  if (pool === 'elite') {
    const r = rollRelicReward(REG, rng, run.relics);
    if (r) run.relics.push(r);
  }
}

// ---- one full run (runsim.mjs verbatim, non-endless path) -------------------
function emptyStats() {
  return { combats: 0, statusOut: {}, statusSelf: {}, stanceEnters: 0, staggers: 0, dmgDealt: 0, dmgTaken: 0,
    bleedApplied: 0, bleedFills: 0, bleedStranded: 0, burstDmg: 0,
    winTotal: 0, winConverted: 0, winExpired: 0, winDiedOpen: 0,
    selfTax: 0, healed: 0, act1Curve: [],
    starCharges: 0, starOpportunityDecisions: 0, starOpportunityTurns: 0,
    starFollowups: 0, starStranded: 0, starChargedPriorityChanges: 0,
    starOutcomes: { damage: 0, defense: 0, control: 0, continuation: 0 },
    unspentEnergy: 0, cardsPlayed: 0, playerTurns: 0, endTurns: 0 };
}

function simulateRun(classId, seed, policy = POLICY) {
  const run = createRunState({ seed, classId, registries: REG });
  run._id = createIdGen('sim');
  run.seenEvents = [];
  const rng = createRng(seed);
  const pickRandom = makeLcg(seed ^ 0x9e3779b9);
  const stats = emptyStats();
  const result = { classId, seed, victory: false, act: 1, floor: 0, deaths: null, stats };

  for (let act = 1; act <= 3; act++) {
    run.actNumber = act;
    result.act = act;
    // The ONE boot path (#54) — this tool was the fourth playable-act caller
    // the actmap.js header warns about; it imports the module like the
    // harnesses do. --check below proves the datum still nests seed-for-seed.
    const map = buildActMap(REG, rng, act);

    let currentId = null;
    let nextIds = map.startIds;
    while (true) {
      const options = nextIds.map((id) => map.nodes[id]);
      const hurt = run.hp < run.maxHp * (MUTATE === 'path' ? 0.95 : 0.55);
      const pick = (hurt && options.find((n) => n.type === 'shrine')) || options[0];
      currentId = pick.id;
      result.floor = pick.floor;

      let kind = pick.type;
      if (kind === 'event') {
        const res = pick.resolved || { kind: 'fight' };
        if (res.kind === 'event') {
          run.seenEvents.push(res.eventId);
          const ev = REG.events.get(res.eventId);
          const choice = ev.choices.find((c) => !c.requires || (c.requires.cinders || 0) <= run.cinders) || ev.choices[ev.choices.length - 1];
          executeRunEffects({ run, registries: REG, rng }, choice.effects);
          if (run.hp <= 0) { result.deaths = `event:${res.eventId}`; return result; }
          if (run.combatEntered) {
            const encId = typeof run.combatEntered === 'string' ? run.combatEntered : run.combatEntered.encounterId;
            run.combatEntered = null;
            const hpIn = run.hp;
            if (botFight(run, rng, encId, stats, pickRandom, policy) !== 'victory') {
              result.deaths = `ambush:${encId}`;
              result.deathInfo = { act, floor: pick.floor, enc: encId, hpIn, maxHp: run.maxHp };
              return result;
            }
            afterVictory(run, rng, 'normal');
            if (act === 1) stats.act1Curve.push([pick.floor, run.hp / run.maxHp]);
          }
          kind = null;
        } else kind = res.kind;
      }

      if (kind === 'monster' || kind === 'fight' || kind === 'elite' || kind === 'boss') {
        const pool = kind === 'monster' || kind === 'fight' ? 'normal' : kind;
        const encId = rollEncounter(REG, rng, { pool, act });
        const hpIn = run.hp;
        if (botFight(run, rng, encId, stats, pickRandom, policy) !== 'victory') {
          result.deaths = `${pool}:${encId}`;
          result.deathInfo = { act, floor: pick.floor, enc: encId, hpIn, maxHp: run.maxHp };
          return result;
        }
        afterVictory(run, rng, pool);
        if (act === 1) stats.act1Curve.push([pick.floor, run.hp / run.maxHp]);
        if (pool === 'boss') {
          const boss = rollRelicReward(REG, rng, run.relics, { rarities: ['boss'] });
          if (boss) run.relics.push(boss);
          break;
        }
      } else if (kind === 'shrine') {
        // THE GRACE REFILL, automatic and BEFORE the rest/smith decision —
        // exactly as src/main.js showRest and runsim.mjs do. This file never
        // had it (runsim gained it 2026-08-08), and --check could not see the
        // divergence: with the bots never spending a charge, a refill was a
        // no-op on both sides. Two sims disagreed about the game's sustain loop
        // and agreed on the answer, because the subsystem was dead in both.
        applyGraceRefill(REG, run);
        if (run.hp < run.maxHp * (MUTATE === 'shrine' ? 0.2 : 0.6)) run.hp = Math.min(run.maxHp, run.hp + shrineHealAmount(REG, run));
        else { const c = run.deck.find((d) => !d.upgraded); if (c) c.upgraded = true; }
      } else if (kind === 'treasure') {
        const r = rollRelicReward(REG, rng, run.relics);
        if (r) run.relics.push(r);
      } // merchant: skip

      nextIds = map.nodes[currentId].next;
      if (!nextIds || !nextIds.length) nextIds = [map.bossId];
    }
    run.hp = run.maxHp;
  }
  result.victory = true;
  return result;
}

// ---- statistics -------------------------------------------------------------
function wilson(wins, n) {
  const z = 1.959963985; // 95%
  const p = wins / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

// Two-proportion z-test (pooled). Returns two-sided p-value.
function twoPropP(w1, n1, w2, n2) {
  const p = (w1 + w2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return 1;
  const z = Math.abs(w1 / n1 - w2 / n2) / se;
  // normal CDF tail via erfc approximation (Abramowitz-Stegun 7.1.26)
  const t = 1 / (1 + 0.3275911 * (z / Math.SQRT2));
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return Math.max(0, Math.min(1, 1 - erf));
}

function exactMcNemarP(improved, regressed) {
  const discordant = improved + regressed;
  if (discordant === 0) return 1;
  const edge = Math.min(improved, regressed);
  const logFact = [0];
  for (let i = 1; i <= discordant; i++) logFact[i] = logFact[i - 1] + Math.log(i);
  const terms = [];
  for (let k = 0; k <= edge; k++) {
    terms.push(logFact[discordant] - logFact[k] - logFact[discordant - k] - discordant * Math.log(2));
  }
  const max = Math.max(...terms);
  const tail = Math.exp(max) * terms.reduce((sum, x) => sum + Math.exp(x - max), 0);
  return Math.min(1, 2 * tail);
}

function policyControlReceipt(kitFleet, greedyFleet, n) {
  const mismatches = [];
  for (const id of ['reaver', 'herald']) {
    for (let i = 0; i < n; i++) {
      if (JSON.stringify(kitFleet[id].rows[i]) !== JSON.stringify(greedyFleet[id].rows[i])) mismatches.push(`${id}:seed#${i + 1}`);
    }
  }
  const kit = kitFleet.starseer.rows;
  const greedy = greedyFleet.starseer.rows;
  let improved = 0; let regressed = 0; let unchangedWin = 0; let unchangedLoss = 0;
  for (let i = 0; i < n; i++) {
    if (!greedy[i].victory && kit[i].victory) improved++;
    else if (greedy[i].victory && !kit[i].victory) regressed++;
    else if (kit[i].victory) unchangedWin++;
    else unchangedLoss++;
  }
  const kitStar = starTotals(kitFleet);
  const greedyStar = starTotals(greedyFleet);
  const kitConversion = kitStar.opportunities ? kitStar.conversions / kitStar.opportunities : 0;
  const greedyConversion = greedyStar.opportunities ? greedyStar.conversions / greedyStar.opportunities : 0;
  return { mismatches, improved, regressed, unchangedWin, unchangedLoss,
    kitConversion, greedyConversion, conversionLift: kitConversion - greedyConversion,
    mcnemarP: exactMcNemarP(improved, regressed) };
}

// ---- fleet ------------------------------------------------------------------
function runFleet(n, policy = POLICY, classIds = REG.classes.all().map((c) => c.id)) {
  const out = {};
  for (const cls of REG.classes.all().filter((c) => classIds.includes(c.id))) {
    const rows = [];
    for (let i = 1; i <= n; i++) rows.push(simulateRun(cls.id, (i * 2654435761) >>> 0, policy));
    out[cls.id] = { name: cls.name, rows };
  }
  return out;
}
const winsOf = (fleet, id) => fleet[id].rows.filter((r) => r.victory).length;

// ---- the baseline, DERIVED — no constant lives in this file -----------------
// Runs runsim.mjs in this same tree at the same n and reads its wins. Every
// failure path here is an ERROR (exit 2), never a pass: a check that could not
// perform its own measurement has produced `unknown`, and unknown blocks.
const RUNSIM = fileURLToPath(new URL('runsim.mjs', import.meta.url));

function deriveRunsimWins(n) {
  const r = spawnSync(process.execPath, [RUNSIM, String(n)], { encoding: 'utf8' });
  if (r.error) throw new Error(`could not run runsim.mjs: ${r.error.message}`);
  if (r.status !== 0) {
    throw new Error(`runsim.mjs exited ${r.status} — the baseline could not be derived.\n${(r.stderr || '').trim()}`);
  }
  // Class NAME → id from the registry, never a table typed here (Law 0
  // clause 1: the machinery derives what the data already states).
  const byName = new Map(REG.classes.all().map((c) => [c.name, c.id]));
  const wins = {};
  for (const line of String(r.stdout).split('\n')) {
    const m = /^(.+?)\s+full-run wins\s+(\d+)\/(\d+)\b/.exec(line);
    if (!m) continue;
    const id = byName.get(m[1].trim());
    if (!id) throw new Error(`runsim.mjs reported class '${m[1].trim()}', which is not in the registry`);
    if (Number(m[3]) !== n) throw new Error(`runsim.mjs ran n=${m[3]}, this tool ran n=${n} — not comparable`);
    wins[id] = Number(m[2]);
  }
  // "An empty result is not a zero" — prove the parse had a referent.
  const missing = REG.classes.all().map((c) => c.id).filter((id) => !(id in wins));
  if (missing.length) {
    throw new Error(`parsed no wins line for ${missing.join(', ')} from runsim.mjs output — the baseline is unknown, not zero`);
  }
  return wins;
}

// Returns true when this file agrees with runsim across every class.
function runCheck(n, baseline, { quiet = false } = {}) {
  const fleet = runFleet(n);
  let ok = true;
  for (const cls of REG.classes.all()) {
    const got = winsOf(fleet, cls.id);
    const want = baseline[cls.id];
    if (got !== want) ok = false;
    if (!quiet) console.log(`  ${cls.id}: ${got}/${n} (runsim, derived just now: ${want}/${n}) ${got === want ? 'MATCH' : 'DRIFT'}`);
  }
  return ok;
}

function starTotals(fleet) {
  const rows = fleet.starseer.rows;
  const sum = (f) => rows.reduce((n, r) => n + f(r.stats), 0);
  return {
    opportunities: sum((s) => s.starOpportunityDecisions),
    conversions: sum((s) => s.starFollowups),
    priorityChanges: sum((s) => s.starChargedPriorityChanges),
  };
}

function starCounterFixture(mutation = null) {
  MUTATE = mutation;
  const stats = emptyStats();
  const chargedDef = { effects: [{ op: 'damage', amount: 3,
    if: { p: 'hasStatus', of: 'self', status: 'starstoneCharge' } }] };
  const damageEvent = { type: 'damageDealt', sourceId: 'player', amount: 3 };
  recordStarDecision(stats, new Set(), {
    combat: { turn: 2, player: { classId: 'starseer' } },
    eligible: [{}], selectedDef: chargedDef,
    events: [damageEvent],
    trace: { executed: new Set([0]), eventsByIndex: new Map([[0, [damageEvent]]]) },
  });
  recordStarEvents(stats, [
    { type: 'playerTurnStart', turn: 2 },
    { type: 'statusApplied', targetId: 'player', status: 'starstoneCharge' },
    { type: 'cardPlayed', cardId: 'fixture' },
    { type: 'statusExpired', targetId: 'player', status: 'starstoneCharge', reason: 'decayed' },
    { type: 'playerTurnEnd', turn: 2 },
  ], [2]);
  return stats;
}

function fixtureCombat(cardIds, { charge = true, enemyIds = ['fellWarden'] } = {}) {
  const seed = 0x205;
  const run = createRunState({ seed, classId: 'starseer', registries: REG });
  run._id = createIdGen('fixture');
  run.deck = cardIds.map((card, index) => (typeof card === 'string'
    ? { instanceId: `fixture${index + 1}`, cardId: card, upgraded: false }
    : { instanceId: `fixture${index + 1}`, upgraded: false, ...card }));
  return createCombat({
    registries: REG,
    rng: createRng(seed),
    player: {
      classId: run.class, attributes: run.attributes, loadout: run.loadout,
      maxHp: run.maxHp, hp: run.hp, maxMana: run.maxMana, mana: run.mana,
      maxStamina: run.maxStamina, stamina: run.stamina,
      energyMax: run.energyMax, drawPerTurn: run.drawPerTurn,
      equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot,
      deck: run.deck, relicIds: run.relics, flasks: [], flaskCharges: run.flaskCharges,
      damageBySchoolAdd: run.damageBySchoolAdd,
    },
    enemyIds,
    playerStatuses: charge ? [{ status: 'starstoneCharge', stacks: 1 }] : [],
  });
}

function realStarOutcomeFixture(cardId, { enemyHp = 120, mutation = null, stamped = false } = {}) {
  MUTATE = mutation;
  const combat = fixtureCombat([stamped
    ? { cardId, mods: ['potency=+1'], damageSchool: 'magic', exposureBuildupPerHit: 1 }
    : cardId]);
  const card = combat.piles.hand.find((entry) => entry.cardId === cardId);
  const enemy = combat.enemies.find((entry) => entry.alive);
  enemy.hp = enemyHp;
  const def = resolvedHandDef(card);
  const start = combat.eventLog.length;
  const trace = traceCardDispatch(combat, def, card.instanceId,
    () => dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: enemy.id }));
  const events = combat.eventLog.slice(start);
  const stats = emptyStats();
  recordStarDecision(stats, new Set(), {
    combat, eligible: [card], selectedDef: def, events, trace,
  });
  return { stats, events, trace };
}

function delayedIntentFixture(mutation = null) {
  MUTATE = mutation;
  const combat = fixtureCombat(['shootingShard', 'crystalBarrier']);
  const enemy = combat.enemies[0];
  enemy.intent = {
    kind: 'attack', moveId: 'heldBlade', damage: 14, hits: 1, delayed: true, pending: false,
  };
  enemy.pendingMove = null;
  const charging = starseerkitPick(combat, combat.piles.hand).cardId;
  enemy.pendingMove = { moveId: 'heldBlade', resolveOnTurn: combat.turn };
  enemy.intent = { ...enemy.intent, pending: true };
  const due = starseerkitPick(combat, combat.piles.hand).cardId;
  return { charging, due };
}

function multiEnemyLethalFixture(mutation = null, hp = [120, 20]) {
  MUTATE = mutation;
  const combat = fixtureCombat(['shootingShard', 'celestialLance'], {
    enemyIds: ['fellWarden', 'fellWarden'],
  });
  combat.enemies[0].hp = hp[0];
  combat.enemies[1].hp = hp[1];
  const target = combat.enemies.find((enemy) => enemy.alive);
  const chosen = starseerkitPick(combat, combat.piles.hand, target);
  return {
    chosen: chosen.cardId,
    targetId: target.id,
    firstEnemyId: combat.enemies[0].id,
    targetHp: target.hp,
    laterHp: combat.enemies[1].hp,
  };
}

function liveLethalFixture(kind, mutation = null) {
  MUTATE = mutation;
  const positive = kind === 'positive';
  const cards = positive
    ? [
        'shootingShard',
        { cardId: 'starstonePebble', mods: ['potency=+1'], damageSchool: 'magic', exposureBuildupPerHit: 1 },
      ]
    : [
        { cardId: 'celestialLance', damageSchool: 'magic', exposureBuildupPerHit: 1 },
        'shootingShard',
      ];
  const combat = fixtureCombat(cards);
  const enemy = combat.enemies[0];
  enemy.hp = positive ? 18 : 20;
  enemy.block = positive ? 0 : 5;
  if (positive) enemy.statuses.vulnerable = { stacks: 1 };
  else enemy.damageResistanceBySchool = { magic: 50 };
  const ordered = positive
    ? ['shootingShard', 'starstonePebble']
    : ['celestialLance', 'shootingShard'];
  const affordable = ordered.map((cardId) => combat.piles.hand.find((card) => card.cardId === cardId));
  const chosen = starseerkitPick(combat, affordable, enemy);
  return {
    chosen: chosen.cardId,
    hpLoss: orderedDispatchHpLoss(combat, chosen, enemy),
    targetHp: enemy.hp,
    targetBlock: enemy.block,
  };
}

function orderedLethalFixture(kind, mutation = null) {
  MUTATE = mutation;
  const radiant = { cardId: 'radiantSpray', damageSchool: 'magic', exposureBuildupPerHit: 1 };
  const cards = kind === 'noAmplification'
    ? ['shootingShard', 'crystalBarrier']
    : [radiant, 'crystalBarrier'];
  const combat = fixtureCombat(cards);
  const enemy = combat.enemies[0];
  enemy.hp = kind === 'noAmplification' ? 7 : 12;
  enemy.block = kind === 'blocked' ? 1 : 0;
  const ordered = cards.map((spec) => combat.piles.hand.find((card) => card.cardId === (typeof spec === 'string' ? spec : spec.cardId)));
  const before = JSON.stringify({
    player: combat.player, enemies: combat.enemies, piles: combat.piles,
    triggerState: [...combat.triggerState], rng: combat.rng.getCounters(),
    events: combat.eventLog.length, idCounter: combat._idCounter,
  });
  const chosen = starseerkitPick(combat, ordered, enemy);
  const after = JSON.stringify({
    player: combat.player, enemies: combat.enemies, piles: combat.piles,
    triggerState: [...combat.triggerState], rng: combat.rng.getCounters(),
    events: combat.eventLog.length, idCounter: combat._idCounter,
  });
  return { chosen: chosen.cardId, unchanged: before === after, targetHp: enemy.hp, targetBlock: enemy.block };
}

function checkBoundary(n) {
  console.log('\nwhat this check did NOT check (SPEC §8 clause 5):');
  console.log('  · CONSISTENCY, not correctness — it proves this file agrees with runsim.mjs.');
  console.log('    It says nothing about whether runsim is right. Both can be wrong together');
  console.log('    and this check still prints PASSED.');
  console.log(`  · the greedy policy at n=${n} only — nothing about skillfirst, random, reaverkit or starseerkit,`);
  console.log('    and nothing about any seed outside i=1..' + n + '.');
  console.log('  · not the game: no balance claim, no spec band, no statement about a human pilot.');
  console.log('  · not the counters — the per-class kit/bleed/stagger tallies this tool adds over');
  console.log('    runsim have no runsim counterpart, so agreement here leaves them unverified.');
}

if (SELFTEST) {
  // Observed red, built in and re-runnable by anyone (SPEC §8 clause 4).
  // The baseline is derived ONCE: a mutation perturbs only this file's
  // in-process bot, never the runsim subprocess, so re-deriving per mutation
  // would measure the same tree four times for the same answer.
  const n = 30;
  console.log(`measure-classes --selftest — ${Object.keys(MUTATIONS).length + Object.keys(STAR_MUTATIONS).length} planted drifts at n=${n}, each must be CAUGHT\n`);
  let baseline;
  try { baseline = deriveRunsimWins(n); } catch (e) {
    console.error(`SELFTEST ERROR — ${e.message}`); process.exit(2);
  }
  console.log(`derived baseline from runsim.mjs: ${REG.classes.all().map((c) => `${c.id} ${baseline[c.id]}/${n}`).join(' · ')}\n`);
  let failures = 0;
  MUTATE = null;
  if (!runCheck(n, baseline, { quiet: true })) {
    console.log('  CLEAN     unmutated tree — NOT MATCHING runsim  ✘ (the check is red before any plant)');
    failures++;
  } else {
    console.log('  CLEAN     unmutated tree — matches runsim  ✔');
  }
  for (const [name, why] of Object.entries(MUTATIONS)) {
    MUTATE = name;
    const agreed = runCheck(n, baseline, { quiet: true });
    if (agreed) { console.log(`  ${name.padEnd(9)} NOT CAUGHT ✘ — ${why}`); failures++; }
    else console.log(`  ${name.padEnd(9)} caught ✔ — ${why}`);
  }
  console.log('\n  Starseer counter receipts (same live summarizers, synthetic event trace):');
  const cleanStar = starCounterFixture(null);
  const counterPlants = {
    starChargeGain: [(s) => s.starCharges, 'statusApplied(starstoneCharge)'],
    starOpportunity: [(s) => s.starOpportunityDecisions, 'eligible charged decision boundary'],
    starTurnReach: [(s) => s.starOpportunityTurns, 'playerTurnStart + charged decision turn'],
    starConversion: [(s) => s.starFollowups, 'card outcome receipt after the eligible decision'],
    starStranded: [(s) => s.starStranded, 'statusExpired(starstoneCharge)'],
    starEnergy: [(s) => s.unspentEnergy, 'playerTurnEnd-confirmed Energy snapshot'],
    starCards: [(s) => s.cardsPlayed, 'cardPlayed'],
    starOutcomes: [(s) => s.starOutcomes.damage, 'damageDealt charged outcome family'],
  };
  for (const [name, [read, source]] of Object.entries(counterPlants)) {
    const planted = starCounterFixture(name);
    if (read(cleanStar) > 0 && read(planted) === 0) console.log(`  ${name.padEnd(18)} caught ✔ — source ${source}`);
    else { console.log(`  ${name.padEnd(18)} NOT CAUGHT ✘ — source ${source}`); failures++; }
  }

  console.log('\n  Starseer conditional-effect receipts (real dispatch path):');
  const lethalClean = realStarOutcomeFixture('starstonePebble', { enemyHp: 1 });
  const lethalPlant = realStarOutcomeFixture('starstonePebble', { enemyHp: 1, mutation: 'starLethalOutcome' });
  if (lethalClean.stats.starFollowups === 0 && lethalPlant.stats.starFollowups === 1) {
    console.log('  starLethalOutcome caught ✔ — lethal base damage ended combat; skipped charged damage cannot convert');
  } else {
    console.log(`  starLethalOutcome NOT CAUGHT ✘ — clean ${lethalClean.stats.starFollowups}, plant ${lethalPlant.stats.starFollowups}`);
    failures++;
  }
  const frostClean = realStarOutcomeFixture('frostNova');
  const arcClean = realStarOutcomeFixture('starstoneArc');
  const frostPlant = realStarOutcomeFixture('frostNova', { mutation: 'starControlOutcome' });
  const arcPlant = realStarOutcomeFixture('starstoneArc', { mutation: 'starControlOutcome' });
  if (frostClean.stats.starFollowups === 1 && frostClean.stats.starOutcomes.control === 1
      && arcClean.stats.starFollowups === 1 && arcClean.stats.starOutcomes.control === 1
      && frostPlant.stats.starFollowups === 0 && arcPlant.stats.starFollowups === 0) {
    console.log('  starControlOutcome caught ✔ — charged Frost and Vulnerable each confirm a control conversion');
  } else {
    console.log(`  starControlOutcome NOT CAUGHT ✘ — clean frost/arc ${frostClean.stats.starFollowups}/${arcClean.stats.starFollowups}, plant ${frostPlant.stats.starFollowups}/${arcPlant.stats.starFollowups}`);
    failures++;
  }
  const stampedClean = realStarOutcomeFixture('starstonePebble', { stamped: true });
  const stampedPlant = realStarOutcomeFixture('starstonePebble', { stamped: true, mutation: 'starStampedTrace' });
  if (stampedClean.stats.starFollowups === 1 && stampedClean.stats.starOutcomes.damage === 1
      && stampedPlant.stats.starFollowups === 0) {
    console.log('  starStampedTrace caught ✔ — the full stamped Pebble effect owns its charged execution receipt');
  } else {
    console.log(`  starStampedTrace NOT CAUGHT ✘ — clean/plant ${stampedClean.stats.starFollowups}/${stampedPlant.stats.starFollowups}`);
    failures++;
  }

  console.log('\n  Starseer delayed-intent policy (real Held Blade intent state):');
  const delayedClean = delayedIntentFixture(null);
  const delayedPlant = delayedIntentFixture('starDelayedIntent');
  if (delayedClean.charging === 'shootingShard' && delayedClean.due === 'crystalBarrier'
      && delayedPlant.charging === 'crystalBarrier') {
    console.log('  starDelayedIntent caught ✔ — charging turn picks damage; due turn picks defense; old preview picks early defense');
  } else {
    console.log(`  starDelayedIntent NOT CAUGHT ✘ — clean ${delayedClean.charging}/${delayedClean.due}, plant ${delayedPlant.charging}/${delayedPlant.due}`);
    failures++;
  }

  console.log('\n  Starseer multi-enemy lethal target (real ordered enemy state):');
  const targetClean = multiEnemyLethalFixture(null);
  const targetPlant = multiEnemyLethalFixture('starLethalTarget');
  const targetChanged = multiEnemyLethalFixture(null, [20, 120]);
  if (targetClean.targetId === targetClean.firstEnemyId && targetClean.chosen === 'shootingShard'
      && targetPlant.chosen === 'celestialLance' && targetChanged.chosen === 'celestialLance') {
    console.log('  starLethalTarget caught ✔ — later low HP cannot force lethal; changing the dispatched target changes the pick');
  } else {
    console.log(`  starLethalTarget NOT CAUGHT ✘ — clean/plant/retarget ${targetClean.chosen}/${targetPlant.chosen}/${targetChanged.chosen}`);
    failures++;
  }

  console.log('\n  Starseer resolved live lethal scoring (stamped card/player/target/Block state):');
  const livePositive = liveLethalFixture('positive');
  const rawUnder = liveLethalFixture('positive', 'starLethalUnderestimate');
  if (livePositive.chosen === 'starstonePebble' && livePositive.hpLoss === 18
      && rawUnder.chosen === 'shootingShard') {
    console.log('  starLethalUnderestimate caught ✔ — stamped Pebble + player magic + target Vulnerable is lethal at 18 HP; authored sum misses it');
  } else {
    console.log(`  starLethalUnderestimate NOT CAUGHT ✘ — clean/plant ${livePositive.chosen}/${rawUnder.chosen}, live loss ${livePositive.hpLoss}`);
    failures++;
  }
  const liveNegative = liveLethalFixture('negative');
  const rawOver = liveLethalFixture('negative', 'starLethalOverestimate');
  if (liveNegative.chosen === 'shootingShard' && liveNegative.hpLoss < liveNegative.targetHp
      && rawOver.chosen === 'celestialLance') {
    console.log('  starLethalOverestimate caught ✔ — target magic resistance + Block keeps authored 22 nonlethal; raw sum falsely picks Lance');
  } else {
    console.log(`  starLethalOverestimate NOT CAUGHT ✘ — clean/plant ${liveNegative.chosen}/${rawOver.chosen}, live loss ${liveNegative.hpLoss}/${liveNegative.targetHp}`);
    failures++;
  }

  console.log('\n  Starseer ordered dispatch lethal scoring (in-card target state changes):');
  const orderedClean = orderedLethalFixture('radiant');
  const orderedPlant = orderedLethalFixture('radiant', 'starOrderedDispatch');
  const noAmplification = orderedLethalFixture('noAmplification');
  const noAmplificationPlant = orderedLethalFixture('noAmplification', 'starOrderedDispatch');
  const blocked = orderedLethalFixture('blocked');
  const blockedPlant = orderedLethalFixture('blocked', 'starOrderedDispatch');
  if (orderedClean.chosen === 'radiantSpray' && orderedPlant.chosen === 'crystalBarrier'
      && noAmplification.chosen === 'shootingShard' && noAmplificationPlant.chosen === 'shootingShard'
      && blocked.chosen === 'crystalBarrier' && blockedPlant.chosen === 'crystalBarrier'
      && [orderedClean, orderedPlant, noAmplification, noAmplificationPlant, blocked, blockedPlant].every((row) => row.unchanged)) {
    console.log('  starOrderedDispatch caught ✔ — Radiant Spray kills 12 HP only after its Vulnerable step; plain damage agrees and 1 Block prevents lethal; every probe leaves source state/RNG untouched');
  } else {
    console.log(`  starOrderedDispatch NOT CAUGHT ✘ — radiant ${orderedClean.chosen}/${orderedPlant.chosen}, plain ${noAmplification.chosen}/${noAmplificationPlant.chosen}, blocked ${blocked.chosen}/${blockedPlant.chosen}`);
    failures++;
  }

  console.log('\n  Starseer policy plant (real deterministic 30-seed fleet):');
  MUTATE = null;
  const kit = starTotals(runFleet(n, 'starseerkit', ['starseer']));
  MUTATE = 'starseerFollowup';
  const noFollow = starTotals(runFleet(n, 'starseerkit', ['starseer']));
  const kitRate = kit.opportunities ? kit.conversions / kit.opportunities : 0;
  const plantRate = noFollow.opportunities ? noFollow.conversions / noFollow.opportunities : 0;
  if (kit.priorityChanges > 0 && noFollow.priorityChanges === 0 && plantRate < kitRate) {
    console.log(`  starseerFollowup  caught ✔ — conversion ${(kitRate * 100).toFixed(1)}% → ${(plantRate * 100).toFixed(1)}%; charged priority changes ${kit.priorityChanges} → 0`);
  } else {
    console.log(`  starseerFollowup  NOT CAUGHT ✘ — conversion ${(kitRate * 100).toFixed(1)}% → ${(plantRate * 100).toFixed(1)}%; charged priority changes ${kit.priorityChanges} → ${noFollow.priorityChanges}`);
    failures++;
  }
  MUTATE = null;
  console.log(failures === 0
    ? `\nSELFTEST PASSED — clean tree agrees, all ${Object.keys(MUTATIONS).length + Object.keys(STAR_MUTATIONS).length} planted drifts were caught.`
    : `\nSELFTEST FAILED — ${failures} case(s) went the wrong way. This check cannot be cited as coverage.`);
  console.log('\nwhat this selftest did NOT check (SPEC §8 clause 5):');
  console.log('  · that these plants are the ONLY ways either copied bot or new counter can drift.');
  console.log('    They cover named doors; another divergence nobody');
  console.log('    thought to plant is not covered by a green here.');
  console.log('  · anything about correctness — a caught plant proves the check can go red,');
  console.log('    not that either implementation plays the game well.');
  process.exit(failures === 0 ? 0 : 1);
}

console.log(`measure-classes — ${N} runs/class, policy=${POLICY}${CHECK ? ', CHECK mode' : ''}${MUTATE ? `, MUTATED (${MUTATE})` : ''}`);
console.log(`seeds: runsim's own formula (i*2654435761)>>>0, i=1..${N} — any n nests a smaller n as its prefix\n`);
if (MUTATE) console.log(`!! planted drift active: ${MUTATIONS[MUTATE] || STAR_MUTATIONS[MUTATE]} — these numbers are about the plant, not the game\n`);

if (CHECK) {
  if (POLICY !== 'greedy') {
    console.error('CHECK requires --policy=greedy — runsim.mjs has only the greedy bot, so any other policy has no baseline to compare against.');
    process.exit(2);
  }
  let baseline;
  try { baseline = deriveRunsimWins(N); } catch (e) {
    console.error(`CHECK ERROR — ${e.message}`);
    console.error('The baseline is unknown, which blocks exactly as a red does. Not reporting a pass.');
    process.exit(2);
  }
  const ok = runCheck(N, baseline);
  console.log(ok
    ? '\nCHECK PASSED — this tool is runsim, plus counters. (Consistency, not correctness.)'
    : '\nCHECK FAILED — drift from runsim; numbers untrustworthy.');
  checkBoundary(N);
  process.exit(ok ? 0 : 1);
}

const perClass = runFleet(N);
// A kit policy may never perturb the two control classes. Re-run the same
// seeds under greedy and compare the complete result objects, not only wins.
const greedyControl = POLICY === 'starseerkit' ? runFleet(N, 'greedy') : null;
const starseerkitControl = greedyControl ? policyControlReceipt(perClass, greedyControl, N) : null;

for (const [id, { name, rows }] of Object.entries(perClass)) {
  const wins = rows.filter((r) => r.victory).length;
  const [lo, hi] = wilson(wins, N);
  const deathsByAct = {}; const deathsByPool = {}; const killers = {};
  let floorSum = 0;
  for (const r of rows) {
    floorSum += r.floor;
    if (!r.victory) {
      deathsByAct[r.act] = (deathsByAct[r.act] || 0) + 1;
      const [pool, enc] = (r.deaths || 'unknown:?').split(':');
      deathsByPool[pool] = (deathsByPool[pool] || 0) + 1;
      killers[r.deaths] = (killers[r.deaths] || 0) + 1;
    }
  }
  const combats = rows.reduce((s, r) => s + r.stats.combats, 0);
  const agg = (f) => rows.reduce((s, r) => s + f(r.stats), 0);
  const sig = SIGNATURE[id] || [];
  let sigLine = sig.map((st) => `${st} ${(agg((s) => s.statusOut[st] || s.statusSelf[st] || 0) / combats).toFixed(2)}/combat`).join(' · ');
  if (id === 'reaver') sigLine += ` · poiseBreaks ${(agg((s) => s.staggers) / combats).toFixed(2)}/combat`;
  const runsWithStance = rows.filter((r) => r.stats.stanceEnters > 0).length;

  console.log(`${name.padEnd(9)} wins ${String(wins).padStart(3)}/${N} = ${((wins / N) * 100).toFixed(1)}%  Wilson95 [${(lo * 100).toFixed(1)}%, ${(hi * 100).toFixed(1)}%]`);
  console.log(`  deaths by act: ${[1, 2, 3].map((a) => `act${a}×${deathsByAct[a] || 0}`).join(' ')}  by pool: ${Object.entries(deathsByPool).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' ')}`);
  console.log(`  top killers: ${Object.entries(killers).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}×${v}`).join('  ')}`);
  console.log(`  dmg/combat dealt ${(agg((s) => s.dmgDealt) / combats).toFixed(1)} taken ${(agg((s) => s.dmgTaken) / combats).toFixed(1)}  kit: ${sigLine || '—'}${id === 'reaver' ? `  stanceEnters ${(agg((s) => s.stanceEnters) / N).toFixed(2)}/run (runs with ≥1: ${runsWithStance}/${N})` : ''}`);

  // ---- #61 diagnosis block --------------------------------------------------
  const applied = agg((s) => s.bleedApplied);
  if (applied > 0) {
    const fills = agg((s) => s.bleedFills);
    const stranded = agg((s) => s.bleedStranded);
    const burst = agg((s) => s.burstDmg);
    console.log(`  bleed economy: applied ${(applied / combats).toFixed(2)} pts/combat → fills ${(fills / combats).toFixed(3)}/combat, effect dmg ${(burst / combats).toFixed(2)}/combat (≈bursts for Reaver, ≈DoT ticks for Herald) — stranded ${(stranded / combats).toFixed(2)} pts/combat = ${((stranded / applied) * 100).toFixed(1)}% of all applied bleed never burst`);
  }
  const wTot = agg((s) => s.winTotal);
  if (wTot > 0) {
    console.log(`  stagger windows: ${(wTot / N).toFixed(2)}/run — converted ${agg((s) => s.winConverted)}/${wTot} (${((agg((s) => s.winConverted) / wTot) * 100).toFixed(1)}%), expired unused ${agg((s) => s.winExpired)}, enemy died mid-window ${agg((s) => s.winDiedOpen)}`);
  }
  console.log(`  hp economy/combat: self-tax ${(agg((s) => s.selfTax) / combats).toFixed(2)} · healed ${(agg((s) => s.healed) / combats).toFixed(2)} · net attrition ${((agg((s) => s.dmgTaken) + agg((s) => s.selfTax) - agg((s) => s.healed)) / combats).toFixed(2)}`);
  const turns = agg((s) => s.playerTurns);
  const endTurns = agg((s) => s.endTurns);
  console.log(`  action economy/turn: cards ${turns ? (agg((s) => s.cardsPlayed) / turns).toFixed(2) : '0.00'} · unspent Energy ${endTurns ? (agg((s) => s.unspentEnergy) / endTurns).toFixed(2) : '0.00'} (${turns} playerTurnStart / ${endTurns} playerTurnEnd receipts)`);
  if (id === 'starseer') {
    const opportunities = agg((s) => s.starOpportunityDecisions);
    const followups = agg((s) => s.starFollowups);
    console.log(`  Starstone decisions: charges gained ${(agg((s) => s.starCharges) / combats).toFixed(2)}/combat · opportunity turns ${agg((s) => s.starOpportunityTurns)} · eligible decision points ${opportunities}`);
    console.log(`  charge conversion: ${followups}/${opportunities} = ${opportunities ? ((followups / opportunities) * 100).toFixed(1) : '0.0'}% · stranded at turn end ${agg((s) => s.starStranded)} · charged priority changed ${agg((s) => s.starChargedPriorityChanges)} selections`);
    console.log(`  charged outcome receipts: damage ${agg((s) => s.starOutcomes.damage)} · block/Weak ${agg((s) => s.starOutcomes.defense)} · Frost/Vulnerable ${agg((s) => s.starOutcomes.control)} · draw/Energy ${agg((s) => s.starOutcomes.continuation)}`);
  }
  const a1d = rows.filter((r) => !r.victory && r.deathInfo && r.deathInfo.act === 1);
  if (a1d.length) {
    const byFloor = {}; const a1k = {};
    let hpSum = 0;
    for (const r of a1d) {
      byFloor[r.deathInfo.floor] = (byFloor[r.deathInfo.floor] || 0) + 1;
      a1k[r.deaths] = (a1k[r.deaths] || 0) + 1;
      hpSum += r.deathInfo.hpIn / r.deathInfo.maxHp;
    }
    console.log(`  act1 deaths ${a1d.length}/${N}: by floor ${Object.entries(byFloor).sort((a, b) => a[0] - b[0]).map(([f, c]) => `f${f}×${c}`).join(' ')} — mean hp entering the fatal fight ${((hpSum / a1d.length) * 100).toFixed(1)}%`);
    console.log(`  act1 killers: ${Object.entries(a1k).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k}×${v}`).join('  ')}`);
  }
  const curve = {};
  for (const r of rows) for (const [f, frac] of r.stats.act1Curve) { (curve[f] || (curve[f] = [])).push(frac); }
  const curveLine = Object.entries(curve).sort((a, b) => a[0] - b[0])
    .map(([f, v]) => `f${f} ${((v.reduce((x, y) => x + y, 0) / v.length) * 100).toFixed(0)}%`).join(' · ');
  if (curveLine) console.log(`  act1 mean hp%% after each fight floor: ${curveLine}`);
  console.log();
}

const ids = Object.keys(perClass);
console.log('pairwise two-proportion tests (pooled z, two-sided):');
for (let a = 0; a < ids.length; a++) {
  for (let b = a + 1; b < ids.length; b++) {
    const wa = perClass[ids[a]].rows.filter((r) => r.victory).length;
    const wb = perClass[ids[b]].rows.filter((r) => r.victory).length;
    const p = twoPropP(wa, N, wb, N);
    console.log(`  ${ids[a]} ${wa}/${N} vs ${ids[b]} ${wb}/${N}: p ${p === 0 ? '< 1e-15' : `= ${p.toPrecision(3)}`}`);
  }
}
if (starseerkitControl) {
  const c = starseerkitControl;
  console.log('\nstarseerkit scope + paired-seed control:');
  console.log(`  Reaver + Herald complete rows: ${c.mismatches.length ? `MISMATCH (${c.mismatches.slice(0, 5).join(', ')})` : `IDENTICAL ${N}/${N} seeds each`}`);
  console.log(`  Starseer greedy → kit: improved ${c.improved} · regressed ${c.regressed} · unchanged win ${c.unchangedWin} · unchanged loss ${c.unchangedLoss}`);
  console.log(`  charge conversion greedy ${(c.greedyConversion * 100).toFixed(1)}% → kit ${(c.kitConversion * 100).toFixed(1)}% = ${c.conversionLift >= 0 ? '+' : ''}${(c.conversionLift * 100).toFixed(1)} percentage points`);
  console.log(`  exact McNemar p = ${c.mcnemarP.toPrecision(5)} (${c.improved + c.regressed} discordant paired seeds)`);
  if (N < 1000) console.log('  qualification: PREFLIGHT ONLY — Rule 1 requires n=1000/class.');
  else if (c.mismatches.length || c.conversionLift < 0.10) {
    console.log('  qualification: INVALID — Rule 1 control or +10 point conversion threshold failed; draw no class conclusion.');
    process.exitCode = 1;
  } else console.log('  qualification: QUALIFIED — n=1000, scope identity, and +10 point conversion threshold all pass.');
}
console.log('\nwhat this run did NOT check (SPEC §8 clause 5):');
console.log('  · this invocation ran NO check against runsim.mjs. These numbers are not');
console.log('    consistency-verified — run `--check` (and `--selftest` to see it go red).');
console.log('  · and --check would only prove CONSISTENCY with runsim, never correctness:');
console.log('    two copies of one bot can agree and both be wrong about the game.');
console.log(`  · naive-bot floor only under policy=${POLICY} — no combo piloting, no deck curation,`);
console.log('    no merchant. Absolute rates say nothing about the spec band for experienced');
console.log('    players (SPEC.md M3: ~35–50%). Class-agnostic arms support between-class');
console.log('    comparisons; targeted kit arms support paired policy effects plus their');
console.log('    explicitly checked non-target identity controls.');
console.log('  · the counters above read the event log; Starseer conversion also attributes');
console.log('    receipts to the exact conditional effect executed by the real queue. The');
console.log('    named plants prove those doors can red, not an independent accounting oracle.');
