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
// Run: node tools/runsim.mjs [runsPerClass=30] [--endless]
//   --endless: Endless Spire mode — acts loop past 3 with per-cycle scaling
//   (capped at act 15 here); reports climb depth instead of win rate.

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { buildActMap } from '../src/engine/actmap.js';
import { createRunState, createIdGen } from '../src/model/state.js';
import { resolveStartingKit } from '../src/model/startingKits.js';
import { levelUpPlan, applyLevelUp } from '../src/model/levelup.js';
import { executeRunEffects } from '../src/engine/actions.js';
import {
  rollEncounter, rollRuneReward, rollCardRewardIds, rollFlaskDrop,
  rollRelicReward, shrineHealAmount, applyGraceRefill,
} from '../src/engine/encounters.js';
import { endlessActInfo, ENDLESS_HP_PER_LOOP, ENDLESS_STR_PER_LOOP } from '../src/content/customMods.js';

const argv = process.argv.slice(2);
// THE LEVEL-LADDER A/B (E13, #258). Constantine's acceptance test for shrine
// levelling is a range with a unit — "10-20 level-ups a run, scalable" — so
// the sim counts them, and `--level-cost=first,step` reruns the fleet under a
// different ladder without touching content: the A-side is the shipped
// balance.levelUp, the B-side whatever the flag names.
const LEVEL_COST = (argv.find((a) => a.startsWith('--level-cost=')) || '').slice('--level-cost='.length);
const levelBundle = LEVEL_COST
  ? (() => {
    // Exactly two non-empty fields: `20,` would read as 20/0 (Number('') is 0)
    // and `20,4,999` would silently drop its tail — both mislabel a fleet.
    const fields = LEVEL_COST.split(',');
    if (fields.length !== 2 || fields.some((f) => f.trim() === '')) throw new Error(`--level-cost expects exactly first,step — got '${LEVEL_COST}'`);
    const [firstCost, costStep] = fields.map(Number);
    if (!Number.isFinite(firstCost) || !Number.isFinite(costStep)) throw new Error(`--level-cost expects first,step — got '${LEVEL_COST}'`);
    // A ladder the shrine could not price: a first purchase that is free or
    // negative, or a step that walks the price DOWN, is a typo, not an
    // experiment. Refuse it at the door, before a fleet reports on it.
    // Integers, because the shrine rounds its price: a fractional first cost
    // below one half (`0.1,0`) passed the sign check and still priced every
    // level at zero — the same endless loop by another door.
    if (!Number.isInteger(firstCost) || firstCost < 1) throw new Error(`--level-cost: first must be a whole cinder cost of at least 1 — got ${firstCost}`);
    if (!Number.isInteger(costStep) || costStep < 0) throw new Error(`--level-cost: step must be a whole number of zero or more — got ${costStep}`);
    return { ...contentBundle, balance: { ...contentBundle.balance, levelUp: { ...contentBundle.balance.levelUp, firstCost, costStep } } };
  })()
  : contentBundle;
const REG = createRegistries(levelBundle);
const ENDLESS = argv.includes('--endless');
// THE GRACE REFILL A/B (Sten, 2026-08-08). Constantine flagged the cost himself
// — "However, that would mean making combat harder" — and a nod is not an
// answer. `--grace-ab` runs the whole fleet twice, refill OFF then ON, same
// seeds, and prints the delta. OFF is the tree as it was at dev = 08e184a: the
// bot's shrine behaviour is untouched, only the refill is withheld.
const GRACE_AB = argv.includes('--grace-ab');
let GRACE_ON = !argv.includes('--no-grace-refill');
// THE CLASS-SPREAD DEEPENING (Vira, 2026-08-15). `--deep` tallies each fight's
// own eventLog — playerTurnStart / cardPlayed / blockGained / healed / hpLost /
// damageDealt / energySpent / flaskUsed — into per-class counters, plus the
// death book (act, maxHp, HP entering the fatal fight). READ-ONLY: the tally
// consumes the log after the fight resolved; a deep fleet must reproduce the
// plain fleet's wins exactly, same seeds, or the instrument perturbed the
// measurement. (Invariant, not a boast: re-run both ways and diff the wins.)
const DEEP = argv.includes('--deep');
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
function spendAllocation(classId) {
  if (!SPEND) return undefined;
  const ids = REG.attributes.ids();
  if (!ids.includes(SPEND)) throw new Error(`--spend=${SPEND} is not an attribute id (${ids.join(', ')})`);
  const mode = REG.creationModes.all().find((m) => m.id === 'standard');
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
// How many flasks a grace actually poured, across the fleet — the mechanism's
// own counter, so a green win-rate cannot be read as "the refill happened".
let poured = 0;
let graces = 0;
let levelUps = 0;
let cinderSpentOnLevels = 0;
let cinderLeftAtEnd = 0;
let levelUpsInWins = 0;
// Every per-fleet counter, zeroed together: the A/B runs fleet() twice and a
// counter that survived the first fleet would report the OFF side's level-ups
// and cinders inside the ON side's lines.
function resetFleetCounters() {
  poured = 0; graces = 0;
  levelUps = 0; cinderSpentOnLevels = 0; cinderLeftAtEnd = 0; levelUpsInWins = 0;
}
const N = Number(argv.find((a) => /^\d+$/.test(a)) || 30);
const ENDLESS_ACT_CAP = 15; // sim guard only — the game itself has no cap

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

// ---- the combat bot (same policy as tests/balance) --------------------------
function botFight(run, rng, encounterId, cm = {}, deepStats = null) {
  const enc = REG.encounters.get(encounterId);
  const combat = createCombat({
    registries: REG, rng,
    // The run's own stamped pools and loadout, whole. createPlayerCombatEntity
    // REFUSES an unstamped energyMax/drawPerTurn since the derived-stat train,
    // and this sim crashed on its first seed from the day that landed until
    // 2026-08-14 — a fleet simulator dead at the door, found only when the
    // vigour rebalance needed before/after fleets. Passing run fields by name
    // (not `...run`) keeps the sim honest about what a fight consumes.
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
    hpMult: cm.hpMult || 1,
    enemyStatuses: cm.enemyStatuses || [],
  });
  let guard = 0;
  while (!combat.result && guard++ < 9000) {
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
        try { dispatch(combat, { type: 'useFlask', chargeKind: 'hp' }); continue; } catch (e) { /* fall through */ }
      }
      if (combat.player.flasks.length) {
        const fdef = REG.flasks.get(combat.player.flasks[0].flaskId);
        const ftgt = combat.enemies.find((e) => e.alive);
        try {
          dispatch(combat, { type: 'useFlask', slot: 0, targetId: fdef.targeted ? ftgt && ftgt.id : undefined });
          continue;
        } catch (e) {
          /* flask rejected — fall through to cards */
        }
      }
    }
    const card = combat.piles.hand.find((h) => {
      const def = resolveCard(REG, { cardId: h.cardId, upgraded: h.upgraded });
      if ((def.keywords || []).includes('unplayable')) return false;
      return (def.cost === 'X' ? 0 : def.cost) <= combat.player.energy && (def.manaCost || 0) <= combat.player.mana;
    });
    const tgt = combat.enemies.find((e) => e.alive);
    try {
      if (card) dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: tgt && tgt.id });
      else dispatch(combat, { type: 'endTurn' });
    } catch (e) {
      dispatch(combat, { type: 'endTurn' });
    }
  }
  if (guard >= 9000) throw new Error(`combat stalled: ${encounterId}`);
  if (deepStats) tallyFight(deepStats, combat, run.hp);
  run.flasks = combat.player.flasks;
  // THE WRITE-BACK THE REAL RUN LOOP PERFORMS (src/main.js:1335), and without
  // it the vessels are INFINITE. createPlayerCombatEntity COPIES flaskCharges
  // ({ ...flaskCharges }), so a fight spends the copy; main.js copies the spent
  // pool back onto the run and the next fight starts where the last one ended.
  // The sim never did, so every fight re-opened with a full vessel — a bot with
  // unlimited flasks, which is not this game. Charges are spent here, refilled
  // at a grace, and scarce in between: that is the loop being measured.
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

// ---- one full run ------------------------------------------------------------
function simulateRun(classId, seed, ds = null) {
  const run = createRunState({ seed, classId, registries: REG, attributes: spendAllocation(classId) });
  run._id = createIdGen('sim');
  run.seenEvents = [];
  const rng = createRng(seed);
  const result = { classId, seed, victory: false, act: 1, floor: 0, deaths: null };
  // ONE exit for every path out of a run, win or death: the purse a run ends
  // with is part of the cinder economy whichever way it ended, and the report
  // divides by every run — a death that skipped this line underreported it.
  const finish = () => { cinderLeftAtEnd += run.cinders; return result; };
  // The death book: act, the run's maxHp, and the HP it walked into the fatal
  // node with. On a lost fight botFight does NOT write hp back, so run.hp
  // still holds the entering value at the moment of the record.
  const recordDeath = (ds2, act, hpIn) => {
    if (!ds2) return;
    ds2.deaths++; ds2.deathActs[Math.min(act, 3) - 1]++;
    ds2.deathMaxHp += run.maxHp; ds2.deathHpIn += hpIn;
  };

  const lastAct = ENDLESS ? ENDLESS_ACT_CAP : 3;
  for (let act = 1; act <= lastAct; act++) {
    run.actNumber = act;
    result.act = act;
    // Endless: acts past 3 reuse act 1-3 content, scaled per completed cycle.
    const { contentAct, loop } = ENDLESS ? endlessActInfo(act) : { contentAct: act, loop: 0 };
    const cm = loop > 0
      ? { hpMult: 1 + ENDLESS_HP_PER_LOOP * loop, enemyStatuses: [{ status: 'strength', stacks: ENDLESS_STR_PER_LOOP * loop }] }
      : {};
    // The ONE boot path (#54) — same module main.js and session.mjs use, so a
    // signature change lands on the game and the harnesses in the same act.
    const map = buildActMap(REG, rng, contentAct);

    let currentId = null;
    let nextIds = map.startIds;
    while (true) {
      // pilot: prefer a shrine when hurt, else the first option
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
          const hpBeforeEvent = run.hp;
          executeRunEffects({ run, registries: REG, rng }, choice.effects);
          if (run.hp <= 0) { result.deaths = `event:${res.eventId}`; recordDeath(ds, act, hpBeforeEvent); return finish(); }
          if (run.combatEntered) {
            const encId = typeof run.combatEntered === 'string' ? run.combatEntered : run.combatEntered.encounterId;
            run.combatEntered = null;
            if (botFight(run, rng, encId, cm, ds) !== 'victory') { result.deaths = `ambush:${encId}`; recordDeath(ds, act, run.hp); return finish(); }
            afterVictory(run, rng, 'normal');
          }
          kind = null;
        } else kind = res.kind;
      }

      if (kind === 'monster' || kind === 'fight' || kind === 'elite' || kind === 'boss') {
        const pool = kind === 'monster' || kind === 'fight' ? 'normal' : kind;
        const encId = rollEncounter(REG, rng, { pool, act: contentAct });
        if (botFight(run, rng, encId, cm, ds) !== 'victory') { result.deaths = `${pool}:${encId}`; recordDeath(ds, act, run.hp); return finish(); }
        afterVictory(run, rng, pool);
        if (pool === 'boss') {
          const boss = rollRelicReward(REG, rng, run.relics, { rarities: ['boss'] });
          if (boss) run.relics.push(boss);
          break; // act cleared
        }
      } else if (kind === 'shrine') {
        // AUTOMATIC AND BEFORE THE CHOICE, exactly as src/main.js showRest does
        // — a run that comes to smith is refilled like a run that comes to rest.
        graces++;
        if (GRACE_ON) {
          // COUNT THE CHARGE MODEL, NOT ONLY THE GRANT MODEL. applyGraceRefill
          // returns `total: 0` BY CONSTRUCTION for a run on charge vessels — it
          // tops up hpCurrent/manaCurrent and grants no flask objects — so this
          // line read 0 forever and the fleet printed `REFILL RAN DEAD` under a
          // refill that was working. A FALSE RED, and it was cited as a real one
          // (my own F1 log, 2026-08-14: "measured with zero flask sustain on
          // both sides"). The sustain was live; the counter was blind.
          const before = run.flaskCharges
            ? (run.flaskCharges.hpCurrent || 0) + (run.flaskCharges.manaCurrent || 0) : 0;
          poured += applyGraceRefill(REG, run).total;
          if (run.flaskCharges) {
            poured += Math.max(0, ((run.flaskCharges.hpCurrent || 0) + (run.flaskCharges.manaCurrent || 0)) - before);
          }
        }
        if (run.hp < run.maxHp * 0.6) run.hp = Math.min(run.maxHp, run.hp + shrineHealAmount(REG, run));
        else { const c = run.deck.find((d) => !d.upgraded); if (c) c.upgraded = true; }
        // THE BOT LEVELS WHILE IT CAN AFFORD TO — the whole point of E13's shrine:
        // cinders become permanent points here. Constitution every time: the
        // greedy pilot measures how many levels the economy allows, not which.
        for (let plan = levelUpPlan(REG, run); plan.offerable; plan = levelUpPlan(REG, run)) {
          cinderSpentOnLevels += plan.cost;
          applyLevelUp(REG, run, 'constitution');
          result.levelUps = (result.levelUps || 0) + 1;
          levelUps += 1;
        }
      } else if (kind === 'treasure') {
        const r = rollRelicReward(REG, rng, run.relics);
        if (r) run.relics.push(r);
      } // merchant: skip

      nextIds = map.nodes[currentId].next;
      if (!nextIds || !nextIds.length) nextIds = [map.bossId];
    }
    run.hp = run.maxHp; // between acts, like main.js
  }
  result.victory = true;
  levelUpsInWins += result.levelUps || 0;
  return finish();
}

// ---- fleet -------------------------------------------------------------------
function fleet() {
console.log(`AshenSpire ${ENDLESS ? `ENDLESS simulation (act cap ${ENDLESS_ACT_CAP})` : 'full-run simulation'} — ${N} runs/class, greedy bot`);
console.log(`grace refill: ${GRACE_ON ? 'ON' : 'OFF'}` + (SPEND ? `  |  allocation: shipped preset with every movable point moved into ${SPEND}` : '  |  allocation: shipped class presets') + '\n');
let crash = null;
const tally = { wins: 0, runs: 0, acts: 0 };
for (const cls of REG.classes.all()) {
  let wins = 0, acts = 0, floors = 0, maxAct = 0;
  const deaths = {};
  const ds = DEEP ? newDeepStats() : null;
  for (let i = 1; i <= N; i++) {
    let r;
    try {
      r = simulateRun(cls.id, (i * 2654435761) >>> 0, ds);
    } catch (e) {
      crash = `${cls.id} seed#${i}: ${e.message}`;
      console.error(`CRASH ${crash}`);
      break;
    }
    if (r.victory) wins++;
    tally.runs++; if (r.victory) tally.wins++; tally.acts += r.act;
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
  if (ds && ds.fights) {
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
if (crash) { console.error('\nFULL-RUN SIM FAILED'); process.exit(1); }
console.log(`\ngraces visited ${graces}, flask charges/grants poured ${poured}` + (GRACE_ON && graces && !poured ? '  <-- REFILL RAN DEAD' : ''));
console.log(`level-ups bought at shrines: ${levelUps} over ${tally.runs} runs = ${(levelUps / Math.max(1, tally.runs)).toFixed(1)} per run` + (LEVEL_COST ? ` (ladder ${LEVEL_COST})` : ' (shipped ladder)') + ` — E13's acceptance range is 10-20 per run; over the ${tally.wins} full (victorious) runs: ${(levelUpsInWins / Math.max(1, tally.wins)).toFixed(1)} per run`);
console.log(`cinder economy: ${cinderSpentOnLevels} spent on levels + ${cinderLeftAtEnd} left at run end = ${((cinderSpentOnLevels + cinderLeftAtEnd) / Math.max(1, tally.runs)).toFixed(0)} cinders per run available to a shrine (the bot buys nothing at merchants)`);
console.log('No crashes across all simulated runs — full loop (map → combat → rewards → events → acts) is integration-clean.');
return { ...tally, graces, poured };
}

if (!GRACE_AB) {
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
