import { registriesForClassMastery } from '../src/model/classMasteryRun.js';
// tools/runsim.mjs — headless FULL-RUN simulator (M3 acceptance: "all 3
// classes can complete 3-act runs").
//
// Plays whole seeded runs — map path → encounters → combats → rewards →
// shrines/events/treasure → act bosses → Acts 1-3 — using the same naive
// greedy bot as the tests (leftmost affordable card, first living target),
// with a simple pilot for run decisions:
//   path: prefer a shrine node when hurt, else first reachable;
//   rewards: always take the first card; elite/boss relics accepted;
//   shrine: rest when below 60% HP, else smith (upgrade first unupgraded);
//   merchant: skipped (no purchases); events: first affordable choice
//   (startCombat consequences are fought); treasure: take the relic.
//
// This is a completability floor, not a balance target: the bot can't pilot
// combos or curate a deck. Any full-run crash = a real integration bug.
//
// Run: node tools/runsim.mjs [runsPerClass=30] [--endless] [--incoming] [--level-stat=<attr>]
//   --single-break-meter: use the configured ratings and version-1 run stamp
//   from SPEC §13.4p; assert that each measured fight uses the shared meter.
//   --endless: Endless Spire mode — acts loop past 3 with per-cycle scaling
//   (capped at act 15 here); reports climb depth instead of win rate.
//   --seeded-seats: draw the seat order per seed (SPEC §13.4) instead of the
//   default order. Off by default so the win-rate corpus keeps comparing the
//   same climbs it always measured (§13.6); on, it measures every order — the
//   distribution a real run draws, and the one balance.bossTiers is tuned on.
//   --selftest: the CI rung's own integrity (FINISH §3, *A headless full run in
//   CI*). Plants a throw inside a card's resolution, a fight that never advances and a map
//   whose path never reaches its boss, and requires each to exit 1 with a
//   CRASH or SOFT-LOCK line; then requires a clean fleet to exit 0 and two
//   fleets on the same seeds to print the same report.
//   --plant=<fight-throw|combat-stall|map-cycle>: one of those plants alone.
//   --step-budget=<n>: map nodes an act may walk before it is a soft-lock
//   (default: the act map's own node count — a path visits one node a floor,
//   so a walk longer than the map has nodes is going round in a circle).
//   --mana-ab: the Mana-aware A/B (SPEC §5.5.1, a release gate). The fleet runs
//   twice on the same seeds, Mana OFF then ON, and prints each class's win rate
//   and mean Mana spent per run for both arms. OFF waives the Mana line at the
//   bot's door (see MANA_ON below); ON is the shipped game.
//   --seat-tiers: per tier (SPEC §13.3), how many runs reached it and how many
//   cleared it, per class and per seat, beside the configured balance.seatTiers
//   and balance.bossTiers rows (read from content, never restated here).

import { contentBundle } from '../src/content/index.js';
import { configuredContentBundle, advancedConfigSnapshot } from '../src/model/advancedConfig.js';
import { createRegistries } from '../src/model/registries.js';
import { dispatch, cardChoicePlan, cardPlayCosts } from '../src/engine/combat.js';
import { createRunCombat, runCombatEnd } from '../src/engine/runCombat.js';
import { botCardTargetId, affordableCards, refusalsFor, outOfPlaysAction, botControlAction, createDecisionDigest, fightFingerprint, digestLine } from './simbot.mjs';
import { createRunLoop, payFightXp, SoftLock, fleetSeed } from './simrun.mjs';
import { chargeFlaskId } from '../src/model/gracerefill.js';
import { skillTracks } from '../src/model/skills.js';
import { seatTierHpMult, bossTierScale } from '../src/model/seats.js';
import { resolveStartingKit } from '../src/model/startingKits.js';
import { xpToNext as xpToNextLevel } from '../src/model/levelup.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RUNSIM_PLANTS as PLANTS, RUNSIM_PLANT_TIMEOUT_MS, RUNSIM_FLEET_TIMEOUT_MS, completedFleet, repeatedCompleteFleets } from './runsim-selftest-policy.mjs';

const argv = process.argv.slice(2);
// THE XP-CURVE A/B (plan phase 6). Constantine's acceptance test for
// levelling is a range with a unit — "10-20 level-ups a run, scalable" — so
// the sim pays the character XP a real run pays (a won fight, each kill by
// the door's pool), counts the levels reached, and says whether the fleet's
// mean over its full (victorious) runs sits in the band. `--xp-levels` alone
// prints the measurement against the shipped curve; `--xp-levels=base,growth,
// roundTo` reruns the fleet under another curve without touching content.
const XP_LEVELS = argv.find((a) => a === '--xp-levels' || a.startsWith('--xp-levels='));
const XP_CURVE = XP_LEVELS && XP_LEVELS.includes('=') ? XP_LEVELS.slice('--xp-levels='.length) : '';
const levelBundle = XP_CURVE
  ? (() => {
    const fields = XP_CURVE.split(',');
    if (fields.length !== 3 || fields.some((f) => f.trim() === '')) throw new Error(`--xp-levels expects exactly base,growth,roundTo — got '${XP_CURVE}'`);
    const [base, growth, roundTo] = fields.map(Number);
    if (!Number.isFinite(base) || base <= 0) throw new Error(`--xp-levels: base must be a positive number — got ${base}`);
    if (!Number.isFinite(growth) || growth < 1) throw new Error(`--xp-levels: growth must be at least 1 — got ${growth}`);
    if (!Number.isInteger(roundTo) || roundTo < 1) throw new Error(`--xp-levels: roundTo must be a positive integer — got ${roundTo}`);
    return { ...contentBundle, balance: { ...contentBundle.balance, level: { ...contentBundle.balance.level, xp: { base, growth, roundTo } } } };
  })()
  : contentBundle;
// SPEC §13.4p: explicitly exercise new rated runs; preserve the historical
// simulator corpus when the flag is absent.
const CLASS_MASTERY = argv.includes('--class-mastery');
const SINGLE_BREAK = argv.includes('--single-break-meter') || CLASS_MASTERY;
const REG = createRegistries(SINGLE_BREAK ? configuredContentBundle(levelBundle, advancedConfigSnapshot()) : levelBundle);
const ENDLESS = argv.includes('--endless');
// THE GRACE REFILL A/B (Sten, 2026-08-08). Constantine flagged the cost himself
// — "However, that would mean making combat harder" — and a nod is not an
// answer. `--grace-ab` runs the whole fleet twice, refill OFF then ON, same
// seeds, and prints the delta. OFF is the tree as it was at dev = 08e184a: the
// bot's shrine behaviour is untouched, only the refill is withheld.
const GRACE_AB = argv.includes('--grace-ab');
let GRACE_ON = !argv.includes('--no-grace-refill');
const SEEDED_SEATS = argv.includes('--seeded-seats');
// THE MANA-AWARE A/B (SPEC §5.5.1: "the old no-Mana simulation is stale … a
// Mana-aware A/B balance run remains a release gate"). OFF is that old
// simulation's reading: the Mana pool never refuses a card. Before each bot
// decision the player's Mana is raised to the dearest Mana price in hand, so
// the Mana line is paid but never binds; nothing else moves — card damage,
// which content derives from all three cost lines at registry build, is the
// same card on both arms, and the seeds are the same. ON is the shipped game.
// Mana spent is the fight's own `manaSpent` events, so OFF reports the Mana a
// fleet would spend if Mana were free and ON the Mana it could afford.
const MANA_AB = argv.includes('--mana-ab');
let MANA_ON = true;
// THE SEAT-TIER REPORT (SPEC §13.3, FINISH §4 *Seat-tier tolerance is stated*).
// READ-ONLY: it records which seat each act climbed and whether its boss fell.
const SEAT_TIERS = argv.includes('--seat-tiers');
// Endless acts past 3 repeat content tiers 1..3 with cycle HP and Strength on
// top, so a per-tier table would pool act 4 with act 1 under tier 1's base
// multipliers and label both wrongly. The combination is refused, not guessed.
if (SEAT_TIERS && ENDLESS) {
  console.error('runsim: --seat-tiers cannot be combined with --endless — endless acts past 3 reuse tiers 1-3 with cycle scaling the per-tier report does not carry. Run --seat-tiers on the 3-act climb.');
  process.exit(2);
}
// THE CLASS-SPREAD DEEPENING (Vira, 2026-08-15). `--deep` tallies each fight's
// own eventLog — playerTurnStart / cardPlayed / blockGained / healed / hpLost /
// damageDealt / energySpent / flaskUsed — into per-class counters, plus the
// death book (act, maxHp, HP entering the fatal fight). READ-ONLY: the tally
// consumes the log after the fight resolved; a deep fleet must reproduce the
// plain fleet's wins exactly, same seeds, or the instrument perturbed the
// measurement. (Invariant, not a boast: re-run both ways and diff the wins.)
const DEEP = argv.includes('--deep');
// Plan phase 4a: report the skill level each track reached, averaged per class.
const SKILL_LEVELS = argv.includes('--skill-levels');
// THE INCOMING-DAMAGE BOOK (A3, 2026-09-27). `--incoming` tallies, per class,
// act and pool, what the enemies swung at the player in each fight (before
// block) and the HP that got through, plus the maxHp and level each act opened
// on. Starting pools are retuned from this measurement, not from an older
// figure. READ-ONLY over the finished fight's eventLog, as `--deep` is.
const INCOMING = argv.includes('--incoming');
// THE DECISION DIGEST (PR #1473 review). `--digest` prints, per class, how many
// actions the fight bot dispatched and a hash of them in order. measure-classes
// --check reads it, so its copied bot must make runsim's decisions seed for
// seed, not merely reach the same win count. READ-ONLY: recorded after each
// successful dispatch, no RNG, no state.
const DIGEST = argv.includes('--digest');
const decisionDigest = createDecisionDigest();
function botDispatch(combat, action) {
  dispatch(combat, action);
  decisionDigest.record(action);
}
// `--level-stat=<attributeId>` — which attribute the bot puts its level-up
// points into (default constitution, as it always has). The Actions breakpoint
// is judged by comparing fleets that differ only here.
// A PATH is a comma list of `attribute[:cap]`: each point goes to the first
// entry still under its cap, so `dexterity:5,constitution` is "DEX to 5, then
// CON" — the question a player at a shrine actually asks.
const LEVEL_STAT = (argv.find((a) => a.startsWith('--level-stat=')) || '').slice('--level-stat='.length) || 'constitution';
const LEVEL_PATH = LEVEL_STAT.split(',').map((entry) => {
  const [id, cap] = entry.split(':');
  return { id: id.trim(), cap: cap === undefined ? Infinity : Number(cap) };
});
const levelPick = (run) => (LEVEL_PATH.find((step) => ((run.attributes && run.attributes[step.id]) || 0) < step.cap) || LEVEL_PATH[LEVEL_PATH.length - 1]).id;
// THE CON BAND (Vira, 2026-08-15). D22 put HP back on Constitution while D10
// already had Stamina there, so one attribute now pays two resources and the
// creation screen's five bonus points became a question nobody had measured.
//
// `--spend=<attributeId>` asks the ONE question a player actually faces at
// creation: the class preset already spends the five bonus points somewhere —
// what happens if they all go here instead? It starts from the shipped preset
// and moves every movable point into the named attribute, where "movable" is
// bounded by three authored facts and by nothing this tool decides:
//   · the creation mode's minimum and maximum (content: creationModes);
//   · the starting kit's own attribute requirements (content: equipment
//     `requirements.attributes` — Starseer's ash staff wants INT 12, so a
//     Starseer cannot legally strip Intelligence to the baseline and the tool
//     must not pretend otherwise);
//   · the mode's fixedTotal, which is why this is a MOVE and never a raise.
// The result goes in through createRunState's own `attributes` door, i.e.
// normalizeRunAttributes, so an illegal spread is refused there by name rather
// than silently clamped into a number this tool would then report as a band.
// Omit the flag and the fleet runs the shipped presets, exactly as before.
const SPEND = (argv.find((a) => a.startsWith('--spend=')) || '').slice('--spend='.length) || null;
for (const step of LEVEL_PATH) {
  if (!REG.attributes.ids().includes(step.id)) throw new Error(`--level-stat: '${step.id}' is not an attribute id (${REG.attributes.ids().join(', ')})`);
  if (!(step.cap > 0)) throw new Error(`--level-stat: '${step.id}' cap must be a positive number`);
}
function spendAllocation(classId) {
  if (!SPEND) return undefined;
  const ids = REG.attributes.ids();
  if (!ids.includes(SPEND)) throw new Error(`--spend=${SPEND} is not an attribute id (${ids.join(', ')})`);
  // The mode a run is born under when no mode is named: Standard (`lean`)
  // since 2026-09-20. This read 'standard' — the retired 10-scale mode — so
  // its presets were refused at createRunState's door, which judges an
  // unnamed mode as the default.
  const mode = REG.creationModes.all().find((m) => m.id === REG.attributeRules.defaultMode);
  const alloc = { ...REG.attributeRules.presets[mode.id][classId] };
  const kit = resolveStartingKit(REG, classId, undefined, {});
  const floors = Object.fromEntries(ids.map((id) => [id, Math.max(mode.minimum, mode.baseline)]));
  for (const slot of ['rightHand', 'leftHand']) {
    const piece = (REG.equipment.armaments || []).find((row) => row.id === kit[slot]);
    for (const [id, req] of Object.entries((piece && piece.requirements && piece.requirements.attributes) || {})) {
      floors[id] = Math.max(floors[id], req);
    }
  }
  for (const donor of ids) {
    if (donor === SPEND) continue;
    while (alloc[donor] > floors[donor] && alloc[SPEND] < mode.maximum) { alloc[donor]--; alloc[SPEND]++; }
  }
  return alloc;
}
// Per-class Mana book for --mana-ab, zeroed at each class's first seed.
let manaBook = { spent: 0, waived: 0, fights: 0, flasks: 0 };
// Every per-fleet counter, zeroed together: the A/B runs fleet() twice and a
// counter that survived the first fleet would report the OFF side's level-ups
// and cinders inside the ON side's lines.
function resetFleetCounters() {
  openingAll.length = 0;
  loop.resetCounters();
}
const N = Number(argv.find((a) => /^\d+$/.test(a)) || 30);
const ENDLESS_ACT_CAP = 15; // sim guard only — the game itself has no cap
const STALEMATE_TURNS = 150; // a fight still open this long is conceded (botFight)
// THE CI RUNG (FINISH §3). A crash is an exception out of a run; a SOFT-LOCK is
// a run that stops making progress — a fight whose actions never resolve it, or
// a map walk that never reaches its boss. Both exit 1. Neither number below is
// game balance: they are the simulator's own patience, and both are flags.
const PLANT = (argv.find((a) => a.startsWith('--plant=')) || '').slice('--plant='.length) || null;
if (PLANT && !PLANTS.includes(PLANT)) throw new Error(`--plant=${PLANT} is not a plant (${PLANTS.join(', ')})`);
const STEP_BUDGET_ARG = (argv.find((a) => a.startsWith('--step-budget=')) || '').slice('--step-budget='.length);
const STEP_BUDGET = STEP_BUDGET_ARG ? Number(STEP_BUDGET_ARG) : null;
if (STEP_BUDGET_ARG && !(Number.isInteger(STEP_BUDGET) && STEP_BUDGET > 0)) throw new Error(`--step-budget expects a positive integer — got '${STEP_BUDGET_ARG}'`);
const ACTION_GUARD = 9000; // bot actions one fight may take before it is a soft-lock
// THE ENGINE'S DOOR REFUSALS (src/engine/combat.js doPlayCard / doUseFlask and
// combatRules.js assertFoundationPlayable): the checks that turn an intent away
// before anything resolves. The bot may set a card or flask aside for one of
// these and play on. ANY OTHER error out of a dispatch is an engine bug in the
// middle of resolution and escapes as a CRASH — a catch-all here once let a
// throw in card resolution pass the rung green (#1437 review).
const ENGINE_REFUSALS = [
  /^Cards can only be played on the player turn$/,
  /^Flasks can only be used on the player turn$/,
  /^Card '.*' is not in hand$/,
  /^'.*' is unplayable$/,
  /^Not enough (energy|mana|stamina) \(need -?\d+, have -?\d+\)$/,
  /^Invalid target '.*'$/,
  /^No living enemy to target$/,
  /^Evade is already active$/,
  /^Dodge Roll already used this turn$/,
  /^That stance is already active$/,
  /^No \w+ flask charges$/,
  /^No flask in slot .*$/,
];
function setAsideOrCrash(e) {
  if (!ENGINE_REFUSALS.some((re) => re.test(String(e && e.message)))) throw e;
}

// ---- the deep tally (read-only over a finished fight's eventLog) ------------
function newDeepStats() {
  return {
    fights: 0, turns: 0, cards: 0, comboPlays: 0,
    energySpent: 0, energyBudget: 0,
    dmgDealt: 0, dmgBlockedByEnemy: 0,
    playerHpLost: 0, playerBlock: 0, playerHealed: 0, flasksDrunk: 0,
    deaths: 0, deathActs: [0, 0, 0], deathMaxHp: 0, deathHpIn: 0,
    hpInSum: 0, // HP entering every fight, victories included
  };
}
function tallyFight(ds, combat, hpEntering) {
  ds.fights++;
  ds.hpInSum += hpEntering;
  let turns = 0;
  for (const ev of combat.eventLog) {
    switch (ev.type) {
      case 'playerTurnStart': turns++; break;
      case 'cardPlayed': ds.cards++; if (ev.ordinalThisTurn >= 2) ds.comboPlays++; break;
      case 'energySpent': ds.energySpent += ev.amount; break;
      case 'flaskUsed': ds.flasksDrunk++; break;
      case 'blockGained': if (ev.targetId === 'player') ds.playerBlock += ev.amount; break;
      case 'healed': if (ev.targetId === 'player') ds.playerHealed += ev.amount; break;
      case 'hpLost': if (ev.targetId === 'player') ds.playerHpLost += ev.amount; break;
      case 'damageDealt': if (ev.targetId !== 'player') { ds.dmgDealt += ev.amount; ds.dmgBlockedByEnemy += ev.blocked; } break;
    }
  }
  ds.turns += turns;
  // Approximate budget: turns × stamped energyMax. Statuses that grant or steal
  // energy make this a floor/ceiling blur, so it prints as "≈" — read the
  // utilisation as a ratio between classes, not as an absolute.
  ds.energyBudget += turns * combat.player.energyMax;
}

// ---- the incoming-damage book (read-only, --incoming) ------------------------
function newIncomingBook() { return { fights: {}, acts: {} }; }
// Every class's opening-three total, pooled across the fleet: the one figure
// a shared pool row (derivedStats hp.base) is sized against.
const openingAll = [];
function tallyIncoming(book, combat, run, pool) {
  let incoming = 0; let hpLost = 0;
  for (const ev of combat.eventLog) {
    if (ev.targetId !== 'player') continue;
    if (ev.type === 'damageDealt') incoming += ev.amount;
    else if (ev.type === 'hpLost') hpLost += ev.amount;
  }
  const key = `${Math.min(run.actNumber || 1, 3)}:${pool}`;
  (book.fights[key] = book.fights[key] || []).push({ incoming, hpLost, maxHp: combat.player.maxHp });
  // THE OPENING FIGHTS: the starting pool is what the first fights of a run
  // are fought on, before a level or a shrine has raised it. Bucketed by the
  // run's fight ordinal (1, 2, 3), with the HP it walked in on and whether it
  // walked out.
  run._fightOrdinal = (run._fightOrdinal || 0) + 1;
  if (run._fightOrdinal <= 3) {
    run._openingLost = (run._openingLost || 0) + hpLost;
    if (run._fightOrdinal === 3 || combat.result !== 'victory') {
      (book.fights.openingSum = book.fights.openingSum || []).push(run._openingLost);
      openingAll.push(run._openingLost);
    }
    const k = `open:${run._fightOrdinal}`;
    (book.fights[k] = book.fights[k] || []).push({ incoming, hpLost, maxHp: combat.player.maxHp, hpIn: run.hp, lost: combat.result !== 'victory' });
  }
}
function noteActOpen(book, run, act) {
  if (!book) return;
  const row = book.acts[act] = book.acts[act] || { runs: 0, maxHp: 0, level: 0, energyMax: 0 };
  row.runs++; row.maxHp += run.maxHp; row.level += (run.level && run.level.level) || 1; row.energyMax += run.energyMax || 0;
}
function printIncoming(book, runs) {
  const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  for (const n of [1, 2, 3]) {
    const rows = book.fights[`open:${n}`] || [];
    if (!rows.length) continue;
    const lost = rows.map((r) => r.hpLost);
    console.log(`  incoming run fight #${n}: ${rows.length} fights on mean maxHp ${mean(rows.map((r) => r.maxHp)).toFixed(1)}, walked in on ${mean(rows.map((r) => r.hpIn)).toFixed(1)}` +
      `  incoming mean ${mean(rows.map((r) => r.incoming)).toFixed(1)}  hp lost mean ${mean(lost).toFixed(1)} median ${q(lost, 0.5)} p90 ${q(lost, 0.9)} max ${Math.max(...lost)}  lost ${rows.filter((r) => r.lost).length}`);
  }
  if (book.fights.openingSum) {
    const sum = book.fights.openingSum;
    console.log(`  incoming run fights #1-#3 together: hp lost mean ${mean(sum).toFixed(1)} median ${q(sum, 0.5)} p90 ${q(sum, 0.9)} max ${Math.max(...sum)}`);
  }
  for (const act of [1, 2, 3]) {
    const open = book.acts[act];
    if (open) console.log(`  incoming act ${act}: opened by ${open.runs}/${runs} runs on mean maxHp ${(open.maxHp / open.runs).toFixed(1)} at mean level ${(open.level / open.runs).toFixed(1)}, mean Actions ${(open.energyMax / open.runs).toFixed(2)}`);
    for (const pool of ['normal', 'elite', 'boss']) {
      const rows = book.fights[`${act}:${pool}`] || [];
      if (!rows.length) continue;
      const inc = rows.map((r) => r.incoming); const lost = rows.map((r) => r.hpLost);
      console.log(`    ${pool.padEnd(6)} fights ${String(rows.length).padStart(4)} (${(rows.length / runs).toFixed(1)}/run)` +
        `  incoming mean ${mean(inc).toFixed(1)} p90 ${q(inc, 0.9)}` +
        `  hp lost mean ${mean(lost).toFixed(1)} median ${q(lost, 0.5)} p90 ${q(lost, 0.9)} max ${Math.max(...lost)}`);
    }
  }
}

// ---- the combat bot (same policy as tests/balance) --------------------------
const sourceRegistries = REG;
function botFight(run, rng, encounterId, cm = {}, deepStats = null) {
  const REG = registriesForClassMastery(sourceRegistries, run);
  const enc = REG.encounters.get(encounterId);
  // A boss scales by the tier it is met at (balance.bossTiers) in place of
  // the seat ratio, as main.js's combatMods does.
  const boss = bossTierScale(REG, { encounter: enc, tier: run.actNumber });
  // THE LIVE DOOR (engine/runCombat.js): the fight main.js builds for this
  // run on a fresh profile — its hand rules, rating rules, swap price and
  // equipment start statuses, which this sim's own option list never carried.
  const combat = createRunCombat({
    registries: REG, rng, run,
    enemyIds: enc.enemies,
    encounter: enc,
    hpMult: boss ? (cm.loopMult || 1) * boss.hp : (cm.hpMult || 1),
    enemyDamageMult: boss ? boss.damage : 1,
    enemyStatuses: cm.enemyStatuses || [],
  });
  if (SINGLE_BREAK && (combat.breakMeterVersion !== 1 || !combat.ratingsRules || combat.player.wardMeter || combat.enemies.some(e => e.wardMeter || e.arcaneExposure))) {
    throw new Error('single-break-meter fleet reached a fight outside its stamped rules');
  }
  if (DIGEST) decisionDigest.beginFight(run.class, run.seed, fightFingerprint(combat, rng));
  let guard = 0;
  // A STALEMATE IS A LOSS, NOT A CRASH. Neither side can finish the other: a
  // retained hand full of cards the pools cannot pay for, block and healing
  // outpacing the enemy. A player there can only concede, so a fight still
  // open after STALEMATE_TURNS turns is scored as lost and counted as a
  // stalemate, and the crash below is kept for a bot stuck inside one turn.
  while (!combat.result && guard++ < ACTION_GUARD && combat.turn <= STALEMATE_TURNS) {
    const control = botControlAction(combat);
    if (control) { botDispatch(combat, control); continue; }
    // Drink a flask when hurt (below 55% HP) — humans use them; a bot that
    // hoards flasks under-measures the sustain the game actually provides.
    if (combat.player.hp < combat.player.maxHp * 0.55) {
      // THE CHARGE VESSEL FIRST — the game's PRIMARY flask system, and the one
      // this bot never drank from. doUseFlask has two doors: `chargeKind`
      // (spends flaskCharges.hpCurrent, what the player's flask buttons send)
      // and `slot` (splices a drop-granted flask object). The bot only ever
      // sent `slot`, so every run was simulated with the vessels FULL AND
      // UNUSED from birth to death — measuring a game whose main heal faucet
      // does not exist. Starting charges are not symmetric either (Reaver and
      // Herald hp:2, Starseer hp:1), so the omission was not even a shared
      // bias. Found 2026-08-15 while checking why the grace refill counter
      // read zero: the refill was topping up a pool nothing ever spent.
      const ch = combat.player.flaskCharges;
      if (ch && (ch.hpCurrent || 0) > 0) {
        try { botDispatch(combat, { type: 'useFlask', chargeKind: 'hp' }); continue; } catch (e) { setAsideOrCrash(e); /* refused: fall through */ }
      }
      if (combat.player.flasks.length) {
        const fdef = REG.flasks.get(combat.player.flasks[0].flaskId);
        const ftgt = combat.enemies.find((e) => e.alive);
        try {
          botDispatch(combat, { type: 'useFlask', slot: 0, targetId: fdef.targeted ? ftgt && ftgt.id : undefined });
          continue;
        } catch (e) {
          setAsideOrCrash(e); /* flask refused — fall through to cards */
        }
      }
    }
    // Leftmost card affordable in every pool (tools/simbot.mjs); a card the
    // engine still refuses at its door (ENGINE_REFUSALS) is set aside for the
    // turn, and the bot plays on. Any other throw is a CRASH.
    const refused = refusalsFor(combat);
    if (!MANA_ON) waiveMana(combat, refused);
    const card = affordableCards(REG, combat, refused)[0];
    const tgt = combat.enemies.find((e) => e.alive);
    if (!card) {
      // AN AZURE CHARGE BEFORE THE TURN ENDS (shipped rules only). Nothing is
      // affordable, but a card short only on Mana would be once a Mana charge
      // is drunk: a player drinks it, so the bot does. Without this the ON arm
      // carried its Azure charges unspent and scored the plays they would have
      // paid for against the Mana line. The OFF arm never reaches here short
      // of Mana, so its charges stay where they are.
      // The decision itself is tools/simbot.mjs outOfPlaysAction, which
      // measure-classes' copied bot calls too.
      const drink = MANA_ON ? outOfPlaysAction(REG, combat, refused) : null;
      if (drink) {
        try { botDispatch(combat, drink); continue; } catch (e) { setAsideOrCrash(e); /* refused: end the turn */ }
      }
      // Plants (--selftest): a throw inside a fight must surface as a CRASH,
      // and a turn that never ends must surface as a SOFT-LOCK.
      if (PLANT !== 'combat-stall') botDispatch(combat, { type: 'endTurn' });
      continue;
    }
    try {
      // The fight-throw plant throws from INSIDE this dispatch, the way an
      // engine bug in card resolution would, so the selftest proves the catch
      // below lets it escape as a CRASH rather than set the card aside.
      if (PLANT === 'fight-throw') throw new Error(`planted: card resolution threw inside ${encounterId}`);
      // A card that offers a choice (Warrior's Vow) takes its first option.
      botDispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: botCardTargetId(REG, combat, card, tgt?.id), choice: cardChoicePlan(combat, card.instanceId)?.options[0]?.id });
    } catch (e) {
      setAsideOrCrash(e);
      refused.add(card.instanceId);
    }
  }
  // Still open, not conceded, and out of actions: a fight that resolves on
  // exactly the last allowed action is not a soft-lock.
  if (!combat.result && combat.turn <= STALEMATE_TURNS && guard >= ACTION_GUARD) throw new SoftLock(`combat stalled: ${encounterId} took ${ACTION_GUARD} bot actions on turn ${combat.turn} without resolving`);
  const outcome = combat.result || 'stalemate';
  if (MANA_AB) {
    manaBook.fights++;
    const azure = chargeFlaskId(REG, 'mana');
    for (const ev of combat.eventLog) {
      if (ev.type === 'manaSpent') manaBook.spent += ev.amount;
      else if (ev.type === 'flaskUsed' && ev.flaskId === azure && ev.slot === undefined) manaBook.flasks++;
    }
  }
  if (deepStats) tallyFight(deepStats, combat, run.hp);
  if (INCOMING && run._incoming) tallyIncoming(run._incoming, combat, run, enc.pool);
  // THE WRITE-BACK THE REAL RUN LOOP PERFORMS (engine/runCombat.js runCombatEnd,
  // the first thing main.js onCombatEnd does): HP, Mana and Stamina carry to
  // the next fight, as they do for a player. Only HP used to, so every fight
  // opened on full pools and cross-fight starvation was invisible here.
  //
  // Flask charges, the reason this write-back first existed (src/main.js:1335), and without
  // it the vessels are INFINITE. createPlayerCombatEntity COPIES flaskCharges
  // ({ ...flaskCharges }), so a fight spends the copy; main.js copies the spent
  // pool back onto the run and the next fight starts where the last one ended.
  // The sim never did, so every fight re-opened with a full vessel — a bot with
  // unlimited flasks, which is not this game. Charges are spent here, refilled
  // at a grace, and scarce in between: that is the loop being measured.
  runCombatEnd(run, combat);
  // A waived arm may have lifted the pool past its maximum; the run keeps no
  // more than it could hold.
  if (!MANA_ON && run.mana > run.maxMana) run.mana = run.maxMana;
  // The XP the fight pays (skill receipt, character level), as main.js
  // onCombatEnd pays it after the write-back — tools/simrun.mjs payFightXp.
  payFightXp(REG, run, combat, enc);
  return outcome;
}

// The Mana-OFF arm's one intervention: raise the pool to the dearest Mana price
// among the hand's playable cards, so the Mana line never refuses one. The
// lift is counted (manaBook.waived) so the OFF arm says how much it gave away.
// Skipping a card already in `refused` loses nothing: the lift runs before
// every play and prices each card with the engine's own cardPlayCosts, so in
// this arm a card is never set aside for "Not enough mana" — anything in the
// set was refused for another reason and is not played this turn anyway.
function waiveMana(combat, refused) {
  const p = combat.player;
  let need = 0;
  for (const h of combat.piles.hand) {
    if (refused.has(h.instanceId)) continue;
    need = Math.max(need, cardPlayCosts(combat, h.instanceId).mana || 0);
  }
  if (need > p.mana) { manaBook.waived += need - p.mana; p.mana = need; }
}

// ---- one full run: the shared loop (tools/simrun.mjs) ------------------------
// The map path, events, shrines, rewards and acts between fights are
// tools/simrun.mjs's, which measure-classes runs too, so the two tools cannot
// drift apart between fights. This file passes its bot and its flags.
const loop = createRunLoop(REG, {
  fight: (run, rng, encId, cm, ds) => botFight(run, rng, encId, cm, ds),
  levelPick,
  classMastery: CLASS_MASTERY,
  attributes: spendAllocation,
  get graceOn() { return GRACE_ON; },
  seededSeats: SEEDED_SEATS,
  endless: ENDLESS,
  endlessActCap: ENDLESS_ACT_CAP,
  stepBudget: STEP_BUDGET,
  mapCycle: PLANT === 'map-cycle',
  hooks: {
    onRunStart: (run, ds) => { if (INCOMING && ds && ds.incoming) run._incoming = ds.incoming; },
    onActOpen: (run, act) => noteActOpen(run._incoming, run, act),
    // The death book: act, the run's maxHp, and the HP it walked into the fatal node with.
    onDeath: (run, act, hpIn, ds) => {
      if (!ds) return;
      ds.deaths++; ds.deathActs[Math.min(act, 3) - 1]++;
      ds.deathMaxHp += run.maxHp; ds.deathHpIn += hpIn;
    },
  },
});
const { simulateRun, counters } = loop;

// ---- fleet -------------------------------------------------------------------
function fleet() {
console.log(`AshenSpire ${ENDLESS ? `ENDLESS simulation (act cap ${ENDLESS_ACT_CAP})` : 'full-run simulation'} — ${N} runs/class, greedy bot`);
console.log(`grace refill: ${GRACE_ON ? 'ON' : 'OFF'}  |  level-up points into ${LEVEL_STAT}` + (SPEND ? `  |  allocation: shipped preset with every movable point moved into ${SPEND}` : '  |  allocation: shipped class presets') + '\n');
let crash = null;
let crashes = 0, softLocks = 0;
const tally = { wins: 0, runs: 0, acts: 0, eventChoices: 0, questSteps: 0 };
const skillLevelsByClass = {};
const classRows = [];
// tierBook[`${classId}|${tier}`] and [`*|${tier}|${seat}`]: { reached, cleared }
const tierBook = {};
const tierRow = (key) => (tierBook[key] = tierBook[key] || { reached: 0, cleared: 0 });
for (const cls of REG.classes.all()) {
  let wins = 0, acts = 0, floors = 0, maxAct = 0;
  const masteryXp = [];
  manaBook = { spent: 0, waived: 0, fights: 0, flasks: 0 };
  const deaths = {};
  const ds = DEEP || INCOMING ? newDeepStats() : null;
  if (ds && INCOMING) ds.incoming = newIncomingBook();
  for (let i = 1; i <= N; i++) {
    let r;
    try {
      r = simulateRun(cls.id, fleetSeed(i), ds);
    } catch (e) {
      crash = `${cls.id} seed#${i}: ${e.message}`;
      if (e instanceof SoftLock) { softLocks++; console.error(`SOFT-LOCK ${crash}`); }
      else { crashes++; console.error(`CRASH ${crash}`); }
      break;
    }
    // Every run ends in a win or a death; one that returns neither stopped
    // without an outcome, which is a soft-lock by another road.
    if (!r.victory && !r.deaths) {
      crash = `${cls.id} seed#${i}: the run returned neither a win nor a death`;
      softLocks++; console.error(`SOFT-LOCK ${crash}`);
      break;
    }
    if (r.victory) wins++;
    masteryXp.push(r.masteryXp || 0);
    if (SEAT_TIERS) {
      for (const t of r.tiers) {
        const keys = [`${cls.id}|${t.tier}`, `*|${t.tier}|${t.seat}`, `*|${t.tier}`];
        if (t.boss) keys.push(`*|${t.tier}|${t.seat}|${t.boss}`);
        for (const key of keys) {
          const row = tierRow(key); row.reached++; if (t.cleared) row.cleared++;
        }
      }
    }
    if (SKILL_LEVELS) {
      skillLevelsByClass[cls.id] = skillLevelsByClass[cls.id] || {};
      for (const [id, row] of Object.entries(r.skills || {})) skillLevelsByClass[cls.id][id] = (skillLevelsByClass[cls.id][id] || 0) + (row.level || 0);
    }
    tally.runs++; if (r.victory) tally.wins++; tally.acts += r.act;
    tally.eventChoices += r.eventChoices || 0; tally.questSteps += r.questSteps || 0;
    acts += r.act; floors += r.floor; maxAct = Math.max(maxAct, r.act);
    if (r.deaths) deaths[r.deaths.split(':')[0]] = (deaths[r.deaths.split(':')[0]] || 0) + 1;
  }
  if (crash) break;
  console.log(
    ENDLESS
      ? `${cls.name.padEnd(11)} avg depth act ${(acts / N).toFixed(2)}  deepest act ${maxAct}` +
        `  deaths: ${Object.entries(deaths).map(([k, v]) => `${k}×${v}`).join(' ') || '—'}`
      : `${cls.name.padEnd(11)} full-run wins ${String(wins).padStart(2)}/${N}` +
        `  avg act ${(acts / N).toFixed(2)}  avg floor ${(floors / N).toFixed(1)}` +
        `  deaths: ${Object.entries(deaths).map(([k, v]) => `${k}×${v}`).join(' ') || '—'}`
  );
  if (CLASS_MASTERY) {
    const sorted = [...masteryXp].sort((a,b)=>a-b);
    console.log(`  mastery XP/run: mean ${(masteryXp.reduce((a,b)=>a+b,0)/N).toFixed(1)}, median ${sorted[Math.floor(N/2)]}, p90 ${sorted[Math.min(N-1,Math.floor(N*.9))]}, min ${sorted[0]}, max ${sorted.at(-1)} (${N} fresh-profile seeds)`);
  }
  if (DIGEST) {
    for (const f of decisionDigest.fightsOf(cls.id)) console.log(digestLine(cls.name, f));
  }
  classRows.push({ id: cls.id, name: cls.name, wins, runs: N, manaSpent: manaBook.spent, manaWaived: manaBook.waived, fights: manaBook.fights });
  if (MANA_AB) {
    console.log(`  mana: spent ${(manaBook.spent / N).toFixed(1)} per run (${(manaBook.spent / Math.max(1, manaBook.fights)).toFixed(2)} per fight over ${manaBook.fights} fights)` +
      `, ${(manaBook.flasks / N).toFixed(1)} Mana flask charges drunk per run` +
      (MANA_ON ? '' : `, ${(manaBook.waived / N).toFixed(1)} per run waived by the OFF arm`));
  }
  if (SKILL_LEVELS) {
    const levels = skillLevelsByClass[cls.id] || {};
    const line = skillTracks(REG).map((t) => `${t.id} ${((levels[t.id] || 0) / N).toFixed(1)}`).join('  ');
    console.log(`  skill levels/run: ${line}`);
  }
  if (ds && ds.incoming) printIncoming(ds.incoming, N);
  if (DEEP && ds && ds.fights) {
    const perTurn = (x) => (x / ds.turns).toFixed(2);
    const perFight = (x) => (x / ds.fights).toFixed(1);
    console.log(
      `  deep: fights ${ds.fights} (${(ds.fights / N).toFixed(1)}/run)  turns/fight ${(ds.turns / ds.fights).toFixed(1)}` +
      `  cards/turn ${perTurn(ds.cards)} (combo-position ${perTurn(ds.comboPlays)})` +
      `  energy ${(100 * ds.energySpent / ds.energyBudget).toFixed(0)}%≈of budget`
    );
    console.log(
      `        per fight: dealt ${perFight(ds.dmgDealt)} (enemy blocked ${perFight(ds.dmgBlockedByEnemy)})` +
      `  hp lost ${perFight(ds.playerHpLost)}  block ${perFight(ds.playerBlock)}  healed ${perFight(ds.playerHealed)}` +
      `  flasks drunk ${ds.flasksDrunk}`
    );
    if (ds.deaths) {
      console.log(
        `        deaths ${ds.deaths}: by act ${ds.deathActs.join('/')}` +
        `  mean maxHp at death ${(ds.deathMaxHp / ds.deaths).toFixed(1)}` +
        `  mean HP entering fatal node ${(ds.deathHpIn / ds.deaths).toFixed(1)}` +
        `  (mean HP entering ANY fight ${(ds.hpInSum / ds.fights).toFixed(1)})`
      );
    }
  }
}
if (crash) {
  console.error('\nFULL-RUN SIM FAILED');
  console.log(`RESULT: FAILED — ${crashes} crash${crashes === 1 ? '' : 'es'}, ${softLocks} soft-lock${softLocks === 1 ? '' : 's'}: ${crash}.`);
  process.exit(1);
}
if (INCOMING && openingAll.length) {
  const sorted = [...openingAll].sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  console.log(`\nincoming, every class pooled: HP lost over a run's first three fights — mean ${(sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(1)} median ${at(0.5)} p75 ${at(0.75)} p90 ${at(0.9)} over ${sorted.length} runs`);
}
console.log(`\ngraces visited ${counters.graces}, flask charges/grants poured ${counters.poured}` + (GRACE_ON && counters.graces && !counters.poured ? '  <-- REFILL RAN DEAD' : ''));
const levelsPerWin = counters.levelsReachedInWins / Math.max(1, tally.wins);
const inBand = tally.wins > 0 && levelsPerWin >= 10 && levelsPerWin <= 20;
console.log(`character levels earned: ${(counters.levelsReached / Math.max(1, tally.runs)).toFixed(1)} per run over ${tally.runs} runs; ${levelsPerWin.toFixed(1)} per full (victorious) run over ${tally.wins}` + (XP_CURVE ? ` (curve ${XP_CURVE})` : ' (shipped curve)') + ` — the acceptance band is 10-20 per full run: ${tally.wins ? (inBand ? 'IN BAND' : '<-- OUT OF BAND') : 'no full run to measure'} (plan phase 6; a greedy bot, the ceiling a real climb approaches)`);
console.log(`XP earned per full run: ${(counters.xpEarnedInWins / Math.max(1, tally.wins)).toFixed(0)} (this curve's receipt: ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].reduce((sum, l) => sum + xpToNextLevel(REG, l), 0)} reaches level 11)`);
console.log(`attribute points assigned at shrines: ${counters.levelUps} over ${tally.runs} runs = ${(counters.levelUps / Math.max(1, tally.runs)).toFixed(1)} per run; over the ${tally.wins} full runs: ${(counters.levelUpsInWins / Math.max(1, tally.wins)).toFixed(1)} per run`);
console.log(`event choices recorded: ${tally.eventChoices} over ${tally.runs} runs, ${tally.questSteps} of them answering a gated quest step (E12) — 0 gated steps across a fleet means the chain never entered the simulation`);
console.log(`class tree picks: ${counters.classDraftsTaken} over ${tally.runs} runs = ${(counters.classDraftsTaken / Math.max(1, tally.runs)).toFixed(1)} per run (plan phase 5b: the bot picks the first node offered)`);
console.log(`skill drafts taken: ${counters.skillDraftsTaken} over ${tally.runs} runs = ${(counters.skillDraftsTaken / Math.max(1, tally.runs)).toFixed(1)} per run (plan phase 4b: one per track per door, the bot takes the first card)`);
console.log(`cinder economy: ${counters.cinderLeftAtEnd} left at run end = ${(counters.cinderLeftAtEnd / Math.max(1, tally.runs)).toFixed(0)} cinders per run unspent (the bot buys nothing at merchants; cinders buy no level since plan phase 6)`);
console.log('No crashes across all simulated runs — full loop (map → combat → rewards → events → acts) is integration-clean.');
if (SEAT_TIERS) printSeatTiers(tierBook);
const classCount = REG.classes.all().length;
console.log(`RESULT: ${tally.runs} runs over ${classCount} classes (${N} fixed seeds each), every one to a win or a death — ${tally.wins} win${tally.wins === 1 ? '' : 's'}, 0 crashes, 0 soft-locks.`);
return { ...tally, graces: counters.graces, poured: counters.poured, classes: classRows };
}

// ---- --seat-tiers: per-tier clear rates beside the configured multipliers ----
// A tier's clear rate is the runs that beat its boss over the runs that reached
// it. Reported, never judged: owner ruling D1 sets no win-rate band for 1.0.
function printSeatTiers(book) {
  const pct = (row) => (row && row.reached ? `${((100 * row.cleared) / row.reached).toFixed(1)}%` : '—');
  const cell = (row) => (row ? `${row.cleared}/${row.reached} (${pct(row)})` : '—');
  const tiers = Object.keys(REG.balance.seatTiers).map(Number).filter(Number.isInteger).sort((a, b) => a - b);
  const seats = REG.seats.all();
  console.log(`\nSEAT TIERS — seat order: ${SEEDED_SEATS ? 'seeded per run (SPEC §13.4)' : `fixed ${seats.map((s) => s.id).join(' → ')}`}`);
  console.log('  configured balance.seatTiers: ' + tiers.map((t) => `${t}: ${REG.balance.seatTiers[t]}`).join(', '));
  console.log('  configured balance.bossTiers: ' + tiers.map((t) => `${t}: hp ${REG.balance.bossTiers[t].hp} damage ${REG.balance.bossTiers[t].damage}`).join(', '));
  console.log('  per tier, every class: ' + tiers.map((t) => `tier ${t} ${cell(book[`*|${t}`])}`).join('  '));
  for (const cls of REG.classes.all()) {
    console.log(`  ${cls.name.padEnd(11)} ` + tiers.map((t) => `tier ${t} ${cell(book[`${cls.id}|${t}`])}`).join('  '));
  }
  for (const t of tiers) {
    for (const seat of seats) {
      const row = book[`*|${t}|${seat.id}`];
      if (!row) continue;
      console.log(`  tier ${t} in ${seat.id.padEnd(8)} enemy HP x${seatTierHpMult(REG, seat.id, t).toFixed(3)}  cleared ${cell(row)}`);
      // THE BOSS ACTUALLY FOUGHT, and its own scale. The final tier can send a
      // seat to the null-seat boss (SPEC §13.5), whose baseline is the final
      // tier, so a multiplier derived from the seat would name a fight that
      // never happened. Each boss met here is listed with the scale botFight
      // used for it (bossTierScale on that encounter).
      const prefix = `*|${t}|${seat.id}|`;
      for (const key of Object.keys(book).filter((k) => k.startsWith(prefix)).sort()) {
        const id = key.slice(prefix.length);
        const scale = bossTierScale(REG, { encounter: REG.encounters.get(id), tier: t });
        console.log(`    boss ${id} at tier ${t}: hp x${scale.hp.toFixed(3)} damage x${scale.damage.toFixed(3)}  fought ${book[key].reached}, cleared ${book[key].cleared}`);
      }
    }
  }
}

if (argv.includes('--selftest')) {
  selftest();
} else if (MANA_AB) {
  // Same seeds both arms (simulateRun's seed is the class index's), so the
  // delta is the Mana line and nothing else. Reported, not judged (D1).
  MANA_ON = false; resetFleetCounters();
  const off = fleet();
  console.log('\n' + '-'.repeat(72) + '\n');
  MANA_ON = true; resetFleetCounters();
  const on = fleet();
  const pct = (w, n) => `${((100 * w) / Math.max(1, n)).toFixed(1)}%`;
  console.log('\nMANA A/B — same seeds, the Mana line the only difference (OFF: never refuses a card; ON: the shipped game)');
  console.log('  class        OFF wins          OFF mana/run   ON wins           ON mana/run   delta');
  for (const a of off.classes) {
    const b = on.classes.find((row) => row.id === a.id);
    console.log(`  ${a.name.padEnd(11)}  ${`${a.wins}/${a.runs} (${pct(a.wins, a.runs)})`.padEnd(16)}  ${(a.manaSpent / a.runs).toFixed(1).padStart(12)}   ${`${b.wins}/${b.runs} (${pct(b.wins, b.runs)})`.padEnd(16)}  ${(b.manaSpent / b.runs).toFixed(1).padStart(11)}   ${(((b.wins / b.runs) - (a.wins / a.runs)) * 100).toFixed(1)} pts`);
  }
  console.log(`  all          ${`${off.wins}/${off.runs} (${pct(off.wins, off.runs)})`.padEnd(16)}  ${(off.classes.reduce((s, r) => s + r.manaSpent, 0) / off.runs).toFixed(1).padStart(12)}   ${`${on.wins}/${on.runs} (${pct(on.wins, on.runs)})`.padEnd(16)}  ${(on.classes.reduce((s, r) => s + r.manaSpent, 0) / on.runs).toFixed(1).padStart(11)}   ${(((on.wins / on.runs) - (off.wins / off.runs)) * 100).toFixed(1)} pts`);
  console.log(`MANA-AB: ${off.classes.length} classes x ${N} seeds, two arms — a report, not a pass band (owner ruling D1).`);
} else if (!GRACE_AB) {
  fleet();
} else {
  // A/B. Same seeds both sides (simulateRun derives its seed from the class and
  // the index, not from a global rng), so the delta is the refill and nothing
  // else. Reported as counts, never as a verdict: whether this is the right
  // difficulty is Marina's and Sunna's, not a simulator's.
  GRACE_ON = false; resetFleetCounters();
  const off = fleet();
  console.log('\n' + '-'.repeat(72) + '\n');
  GRACE_ON = true; resetFleetCounters();
  const on = fleet();
  const pct = (t) => `${((t.wins / t.runs) * 100).toFixed(1)}%`;
  console.log('\nGRACE REFILL A/B — same seeds, refill the only difference');
  console.log(`  OFF  wins ${off.wins}/${off.runs} (${pct(off)})  avg act ${(off.acts / off.runs).toFixed(2)}`);
  console.log(`  ON   wins ${on.wins}/${on.runs} (${pct(on)})  avg act ${(on.acts / on.runs).toFixed(2)}  |  ${on.poured} flasks poured over ${on.graces} graces`);
  console.log(`  DELTA  ${(((on.wins / on.runs) - (off.wins / off.runs)) * 100).toFixed(1)} percentage points, ${((on.acts / on.runs) - (off.acts / off.runs)).toFixed(2)} acts`);
  console.log('\nBOUNDARY: one greedy bot that drinks slot 0 below 55% HP and hoards nothing else,');
  console.log(`  ${N} seeds per class, three classes. It measures SUSTAIN, not play. A human curates`);
  console.log('  a deck and saves a flask for a boss; this bot does neither, so read the sign and');
  console.log('  the order of magnitude, not the decimal. It is a number to argue from, not a verdict.');
}

// ---- --selftest: can the CI rung still go red? -------------------------------
// Each plant runs in its own process through the same argv door a user types,
// one seed a class, and must exit 1 naming the kind of failure it planted. A
// plant that runs past its time limit counts as NOT caught: the rung would
// have hung CI instead of failing it.
function selftest() {
  const self = fileURLToPath(import.meta.url);
  const runSelf = (args, timeout) => spawnSync(process.execPath, [self, ...args], { encoding: 'utf8', timeout });
  const expect = { 'fight-throw': 'CRASH', 'combat-stall': 'SOFT-LOCK', 'map-cycle': 'SOFT-LOCK' };
  const bad = [];
  for (const plant of PLANTS) {
    const r = runSelf([`--plant=${plant}`, '1'], RUNSIM_PLANT_TIMEOUT_MS);
    const kind = expect[plant];
    const said = new RegExp(`^${kind} `, 'm').test(r.stderr || '');
    if (r.error || r.status !== 1 || !said) {
      bad.push(`${plant}: wanted exit 1 and a ${kind} line, got ${r.error ? r.error.code || r.error.message : `exit ${r.status}`}${said ? '' : `, no ${kind} line`}`);
    } else console.log(`  caught  ${plant} → ${kind}`);
  }
  // Clean fleets get the ordinary fleet budget; plant deadlines remain strict.
  const a = runSelf(['2'], RUNSIM_FLEET_TIMEOUT_MS);
  const b = runSelf(['2'], RUNSIM_FLEET_TIMEOUT_MS);
  const diagnostic = (r) => `exit ${r.status}, signal ${r.signal || 'none'}, error ${r.error?.code || 'none'}`;
  if (!completedFleet(a)) bad.push(`clean control: wanted exit 0 and a complete RESULT, got ${diagnostic(a)}\n${a.stderr || ''}`);
  else console.log('  green   clean control (2 seeds a class) exits 0');
  if (!repeatedCompleteFleets(a, b)) bad.push(`determinism: both fleets must finish successfully with complete identical reports; first ${diagnostic(a)}; second ${diagnostic(b)}`);
  else console.log('  same    two fleets on the same seeds print the same report');
  if (bad.length) {
    for (const line of bad) console.error(`SELFTEST FAIL ${line}`);
    console.log(`RESULT: FAILED — ${bad.length} of ${PLANTS.length + 2} selftest checks did not hold.`);
    process.exit(1);
  }
  console.log(`RESULT: ${PLANTS.length}/${PLANTS.length} plants caught (a throw inside a fight, a stalled fight, a map walk that never reaches its boss), a clean fleet exits 0 and repeats seed for seed.`);
}
