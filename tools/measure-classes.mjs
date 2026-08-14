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
//   - policy variants (--policy=greedy|skillfirst|random) as the
//     policy-sensitivity control: greedy is runsim's leftmost-affordable;
//     skillfirst plays affordable skills before attacks (class-agnostic);
//     random picks uniformly among affordable cards using a SEPARATE seeded
//     LCG so the game's own rng streams are never perturbed by the picker.
//     If the class ranking holds across policies, the split is not an
//     artifact of one card ordering.
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
import { createCombat, dispatch } from '../src/engine/combat.js';
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
if (!['greedy', 'skillfirst', 'random', 'reaverkit'].includes(POLICY)) {
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
let MUTATE = (argv.find((a) => a.startsWith('--mutate=')) || '').slice(9) || null;
if (MUTATE && !(MUTATE in MUTATIONS)) {
  console.error(`unknown mutation '${MUTATE}'; known: ${Object.keys(MUTATIONS).join(', ')}`);
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

// Separate LCG for the random policy only — never the game's rng.
function makeLcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ---- the combat bot (runsim.mjs verbatim, except the card picker) -----------
function botFight(run, rng, encounterId, stats, pickRandom) {
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
    },
    enemyIds: enc.enemies,
  });
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
      const def = resolveCard(REG, { cardId: h.cardId, upgraded: h.upgraded });
      if ((def.keywords || []).includes('unplayable')) return false;
      return (def.cost === 'X' ? 0 : def.cost) <= combat.player.energy && (def.manaCost || 0) <= combat.player.mana;
    });
    let card;
    if (POLICY === 'greedy') card = affordable[0];
    else if (POLICY === 'reaverkit') card = affordable.length ? reaverkitPick(combat, affordable) : undefined;
    else if (POLICY === 'skillfirst') {
      card = affordable.find((h) => resolveCard(REG, { cardId: h.cardId, upgraded: h.upgraded }).type !== 'attack') || affordable[0];
    } else { // random
      card = affordable.length ? affordable[Math.floor(pickRandom() * affordable.length)] : undefined;
    }
    const tgt = combat.enemies.find((e) => e.alive);
    try {
      if (card) dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: tgt && tgt.id });
      else dispatch(combat, { type: 'endTurn' });
    } catch (e) {
      dispatch(combat, { type: 'endTurn' });
    }
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
function simulateRun(classId, seed) {
  const run = createRunState({ seed, classId, registries: REG });
  run._id = createIdGen('sim');
  run.seenEvents = [];
  const rng = createRng(seed);
  const pickRandom = makeLcg(seed ^ 0x9e3779b9);
  const stats = { combats: 0, statusOut: {}, statusSelf: {}, stanceEnters: 0, staggers: 0, dmgDealt: 0, dmgTaken: 0,
    bleedApplied: 0, bleedFills: 0, bleedStranded: 0, burstDmg: 0,
    winTotal: 0, winConverted: 0, winExpired: 0, winDiedOpen: 0,
    selfTax: 0, healed: 0, act1Curve: [] };
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
            if (botFight(run, rng, encId, stats, pickRandom) !== 'victory') {
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
        if (botFight(run, rng, encId, stats, pickRandom) !== 'victory') {
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

// ---- fleet ------------------------------------------------------------------
function runFleet(n) {
  const out = {};
  for (const cls of REG.classes.all()) {
    const rows = [];
    for (let i = 1; i <= n; i++) rows.push(simulateRun(cls.id, (i * 2654435761) >>> 0));
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

function checkBoundary(n) {
  console.log('\nwhat this check did NOT check (SPEC §8 clause 5):');
  console.log('  · CONSISTENCY, not correctness — it proves this file agrees with runsim.mjs.');
  console.log('    It says nothing about whether runsim is right. Both can be wrong together');
  console.log('    and this check still prints PASSED.');
  console.log(`  · the greedy policy at n=${n} only — nothing about skillfirst, random or reaverkit,`);
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
  console.log(`measure-classes --selftest — ${Object.keys(MUTATIONS).length} planted drifts at n=${n}, each must be CAUGHT\n`);
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
  MUTATE = null;
  console.log(failures === 0
    ? `\nSELFTEST PASSED — clean tree agrees, all ${Object.keys(MUTATIONS).length} planted drifts were caught.`
    : `\nSELFTEST FAILED — ${failures} case(s) went the wrong way. This check cannot be cited as coverage.`);
  console.log('\nwhat this selftest did NOT check (SPEC §8 clause 5):');
  console.log('  · that the four plants are the ONLY ways this file can drift from runsim.');
  console.log('    They are the four sites where the copy was made; a fifth divergence nobody');
  console.log('    thought to plant is not covered by a green here.');
  console.log('  · anything about correctness — a caught plant proves the check can go red,');
  console.log('    not that either implementation plays the game well.');
  process.exit(failures === 0 ? 0 : 1);
}

console.log(`measure-classes — ${N} runs/class, policy=${POLICY}${CHECK ? ', CHECK mode' : ''}${MUTATE ? `, MUTATED (${MUTATE})` : ''}`);
console.log(`seeds: runsim's own formula (i*2654435761)>>>0, i=1..${N} — any n nests a smaller n as its prefix\n`);
if (MUTATE) console.log(`!! planted drift active: ${MUTATIONS[MUTATE]} — these numbers are about the plant, not the game\n`);

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
    console.log(`  ${ids[a]} ${wa}/${N} vs ${ids[b]} ${wb}/${N}: p = ${twoPropP(wa, N, wb, N).toPrecision(3)}`);
  }
}
console.log('\nwhat this run did NOT check (SPEC §8 clause 5):');
console.log('  · this invocation ran NO check against runsim.mjs. These numbers are not');
console.log('    consistency-verified — run `--check` (and `--selftest` to see it go red).');
console.log('  · and --check would only prove CONSISTENCY with runsim, never correctness:');
console.log('    two copies of one bot can agree and both be wrong about the game.');
console.log(`  · naive-bot floor only under policy=${POLICY} — no combo piloting, no deck curation,`);
console.log('    no merchant. Absolute rates say nothing about the spec band for experienced');
console.log('    players (SPEC.md M3: ~35–50%); only the BETWEEN-CLASS split under an identical');
console.log('    policy is evidence about classes.');
console.log('  · the counters above (kit, bleed economy, stagger windows, hp economy) are read');
console.log('    from the event log and have no independent oracle — nothing here cross-checks');
console.log('    them against the engine\'s own accounting.');
