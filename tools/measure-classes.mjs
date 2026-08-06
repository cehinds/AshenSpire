// tools/measure-classes.mjs — instrumented per-class win-rate measurement
// (EldenSpire issue #55: Reaver 1/30 — sim skill floor or class defect?).
//
// This is runsim.mjs's exact bot and run loop (copied, not imported — runsim
// exports nothing) plus passive instrumentation: after each combat it reads
// combat.eventLog, which consumes no RNG and touches no state, so the default
// policy reproduces runsim's runs seed-for-seed. `--check` asserts that: at
// n=30 the wins must equal runsim's published datum (Reaver 1, Starseer 4,
// Herald 6). If the check fails, this file has drifted from runsim and every
// number it prints is about the drift, not the game.
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
// Run: node tools/measure-classes.mjs [runsPerClass=500] [--policy=greedy] [--check]
// Boundary this tool does NOT cover: it measures the naive bot only — no
// combo piloting, no deck curation, no merchant. Absolute rates are the sim's
// floor, never the game's difficulty; only the BETWEEN-CLASS split under an
// identical policy is evidence about classes.

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { generateActMap } from '../src/engine/mapgen.js';
import { createRunState, createIdGen } from '../src/model/state.js';
import { executeRunEffects } from '../src/engine/actions.js';
import {
  rollEncounter, rollRuneReward, rollCardRewardIds, rollFlaskDrop,
  rollRelicReward, resolveUnknownNode, shrineHealAmount,
} from '../src/engine/encounters.js';

const REG = createRegistries(contentBundle);
const argv = process.argv.slice(2);
const N = Number(argv.find((a) => /^\d+$/.test(a)) || 500);
const POLICY = (argv.find((a) => a.startsWith('--policy=')) || '--policy=greedy').slice(9);
const CHECK = argv.includes('--check');
if (!['greedy', 'skillfirst', 'random'].includes(POLICY)) {
  console.error(`unknown policy '${POLICY}'`); process.exit(2);
}

// Signature statuses per class — the kit the instrument rule says we must see
// firing before any rate is trusted.
const SIGNATURE = {
  reaver: ['bleed'], // poise breaks counted via the enemyStaggered event, not a status
  starseer: ['starstoneCharge'],
  herald: ['crimsonBlight'],
};

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
    player: { classId: run.class, maxHp: run.maxHp, hp: run.hp, deck: run.deck, relicIds: run.relics, flasks: run.flasks },
    enemyIds: enc.enemies,
  });
  let guard = 0;
  while (!combat.result && guard++ < 9000) {
    if (combat.player.hp < combat.player.maxHp * 0.55 && combat.player.flasks.length) {
      const fdef = REG.flasks.get(combat.player.flasks[0].flaskId);
      const ftgt = combat.enemies.find((e) => e.alive);
      try {
        dispatch(combat, { type: 'useFlask', slot: 0, targetId: fdef.targeted ? ftgt && ftgt.id : undefined });
        continue;
      } catch (e) { /* flask rejected — fall through to cards */ }
    }
    const affordable = combat.piles.hand.filter((h) => {
      const def = resolveCard(REG, { cardId: h.cardId, upgraded: h.upgraded });
      if ((def.keywords || []).includes('unplayable')) return false;
      return (def.cost === 'X' ? 0 : def.cost) <= combat.player.energy;
    });
    let card;
    if (POLICY === 'greedy') card = affordable[0];
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
  const stats = { combats: 0, statusOut: {}, statusSelf: {}, stanceEnters: 0, staggers: 0, dmgDealt: 0, dmgTaken: 0 };
  const result = { classId, seed, victory: false, act: 1, floor: 0, deaths: null, stats };

  for (let act = 1; act <= 3; act++) {
    run.actNumber = act;
    result.act = act;
    const map = generateActMap({ config: REG.mapConfig(act), rng });
    const assigned = [];
    for (const n of Object.values(map.nodes)) {
      if (n.type === 'event') {
        n.resolved = resolveUnknownNode(REG, rng, { seenEvents: assigned, act });
        if (n.resolved.kind === 'event') assigned.push(n.resolved.eventId);
      }
    }

    let currentId = null;
    let nextIds = map.startIds;
    while (true) {
      const options = nextIds.map((id) => map.nodes[id]);
      const hurt = run.hp < run.maxHp * 0.55;
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
            if (botFight(run, rng, encId, stats, pickRandom) !== 'victory') { result.deaths = `ambush:${encId}`; return result; }
            afterVictory(run, rng, 'normal');
          }
          kind = null;
        } else kind = res.kind;
      }

      if (kind === 'monster' || kind === 'fight' || kind === 'elite' || kind === 'boss') {
        const pool = kind === 'monster' || kind === 'fight' ? 'normal' : kind;
        const encId = rollEncounter(REG, rng, { pool, act });
        if (botFight(run, rng, encId, stats, pickRandom) !== 'victory') { result.deaths = `${pool}:${encId}`; return result; }
        afterVictory(run, rng, pool);
        if (pool === 'boss') {
          const boss = rollRelicReward(REG, rng, run.relics, { rarities: ['boss'] });
          if (boss) run.relics.push(boss);
          break;
        }
      } else if (kind === 'shrine') {
        if (run.hp < run.maxHp * 0.6) run.hp = Math.min(run.maxHp, run.hp + shrineHealAmount(REG, run));
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
console.log(`measure-classes — ${N} runs/class, policy=${POLICY}${CHECK ? ', CHECK mode' : ''}`);
console.log(`seeds: runsim's own formula (i*2654435761)>>>0, i=1..${N} — the 30-run datum is this set's prefix\n`);

const perClass = {};
for (const cls of REG.classes.all()) {
  const rows = [];
  for (let i = 1; i <= N; i++) rows.push(simulateRun(cls.id, (i * 2654435761) >>> 0));
  perClass[cls.id] = { name: cls.name, rows };
}

if (CHECK) {
  const expect = { reaver: 1, starseer: 4, herald: 6 };
  if (N !== 30 || POLICY !== 'greedy') { console.error('CHECK requires n=30 --policy=greedy'); process.exit(2); }
  let ok = true;
  for (const [id, want] of Object.entries(expect)) {
    const got = perClass[id].rows.filter((r) => r.victory).length;
    console.log(`  ${id}: ${got}/30 (runsim datum ${want}/30) ${got === want ? 'MATCH' : 'DRIFT'}`);
    if (got !== want) ok = false;
  }
  console.log(ok ? '\nCHECK PASSED — this tool is runsim, plus counters.' : '\nCHECK FAILED — drift from runsim; numbers untrustworthy.');
  process.exit(ok ? 0 : 1);
}

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
console.log('\nboundary: naive-bot floor only — absolute rates say nothing about the spec band for experienced players (SPEC.md M3: ~35–50%).');
