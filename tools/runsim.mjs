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
import { generateActMap } from '../src/engine/mapgen.js';
import { createRunState, createIdGen } from '../src/model/state.js';
import { executeRunEffects } from '../src/engine/actions.js';
import {
  rollEncounter, rollRuneReward, rollCardRewardIds, rollFlaskDrop,
  rollRelicReward, resolveUnknownNode, shrineHealAmount,
} from '../src/engine/encounters.js';
import { endlessActInfo, ENDLESS_HP_PER_LOOP, ENDLESS_STR_PER_LOOP } from '../src/content/customMods.js';

const REG = createRegistries(contentBundle);
const argv = process.argv.slice(2);
const ENDLESS = argv.includes('--endless');
const N = Number(argv.find((a) => /^\d+$/.test(a)) || 30);
const ENDLESS_ACT_CAP = 15; // sim guard only — the game itself has no cap

// ---- the combat bot (same policy as tests/balance) --------------------------
function botFight(run, rng, encounterId, cm = {}) {
  const enc = REG.encounters.get(encounterId);
  const combat = createCombat({
    registries: REG, rng,
    player: { classId: run.class, maxHp: run.maxHp, hp: run.hp, deck: run.deck, relicIds: run.relics, flasks: run.flasks },
    enemyIds: enc.enemies,
    hpMult: cm.hpMult || 1,
    enemyStatuses: cm.enemyStatuses || [],
  });
  let guard = 0;
  while (!combat.result && guard++ < 9000) {
    // Drink a flask when hurt (below 55% HP) — humans use them; a bot that
    // hoards flasks under-measures the sustain the game actually provides.
    if (combat.player.hp < combat.player.maxHp * 0.55 && combat.player.flasks.length) {
      const fdef = REG.flasks.get(combat.player.flasks[0].flaskId);
      const ftgt = combat.enemies.find((e) => e.alive);
      try {
        dispatch(combat, { type: 'useFlask', slot: 0, targetId: fdef.targeted ? ftgt && ftgt.id : undefined });
        continue;
      } catch (e) {
        /* flask rejected — fall through to cards */
      }
    }
    const card = combat.piles.hand.find((h) => {
      const def = resolveCard(REG, { cardId: h.cardId, upgraded: h.upgraded });
      if ((def.keywords || []).includes('unplayable')) return false;
      return (def.cost === 'X' ? 0 : def.cost) <= combat.player.energy;
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
  run.flasks = combat.player.flasks;
  if (combat.result === 'victory') run.hp = combat.player.hp;
  return combat.result;
}

function afterVictory(run, rng, pool) {
  run.runes += rollRuneReward(REG, rng, pool, run.relics);
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
function simulateRun(classId, seed) {
  const run = createRunState({ seed, classId, registries: REG });
  run._id = createIdGen('sim');
  run.seenEvents = [];
  const rng = createRng(seed);
  const result = { classId, seed, victory: false, act: 1, floor: 0, deaths: null };

  const lastAct = ENDLESS ? ENDLESS_ACT_CAP : 3;
  for (let act = 1; act <= lastAct; act++) {
    run.actNumber = act;
    result.act = act;
    // Endless: acts past 3 reuse act 1-3 content, scaled per completed cycle.
    const { contentAct, loop } = ENDLESS ? endlessActInfo(act) : { contentAct: act, loop: 0 };
    const cm = loop > 0
      ? { hpMult: 1 + ENDLESS_HP_PER_LOOP * loop, enemyStatuses: [{ status: 'strength', stacks: ENDLESS_STR_PER_LOOP * loop }] }
      : {};
    const map = generateActMap({ config: REG.mapConfig(contentAct), rng });
    // pre-roll unknowns like main.js does
    const assigned = [];
    for (const n of Object.values(map.nodes)) {
      if (n.type === 'event') {
        n.resolved = resolveUnknownNode(REG, rng, { seenEvents: assigned });
        if (n.resolved.kind === 'event') assigned.push(n.resolved.eventId);
      }
    }

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
          const choice = ev.choices.find((c) => !c.requires || (c.requires.runes || 0) <= run.runes) || ev.choices[ev.choices.length - 1];
          executeRunEffects({ run, registries: REG, rng }, choice.effects);
          if (run.hp <= 0) { result.deaths = `event:${res.eventId}`; return result; }
          if (run.combatEntered) {
            const encId = typeof run.combatEntered === 'string' ? run.combatEntered : run.combatEntered.encounterId;
            run.combatEntered = null;
            if (botFight(run, rng, encId, cm) !== 'victory') { result.deaths = `ambush:${encId}`; return result; }
            afterVictory(run, rng, 'normal');
          }
          kind = null;
        } else kind = res.kind;
      }

      if (kind === 'monster' || kind === 'fight' || kind === 'elite' || kind === 'boss') {
        const pool = kind === 'monster' || kind === 'fight' ? 'normal' : kind;
        const encId = rollEncounter(REG, rng, { pool, act: contentAct });
        if (botFight(run, rng, encId, cm) !== 'victory') { result.deaths = `${pool}:${encId}`; return result; }
        afterVictory(run, rng, pool);
        if (pool === 'boss') {
          const boss = rollRelicReward(REG, rng, run.relics, { rarities: ['boss'] });
          if (boss) run.relics.push(boss);
          break; // act cleared
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
    run.hp = run.maxHp; // between acts, like main.js
  }
  result.victory = true;
  return result;
}

// ---- fleet -------------------------------------------------------------------
console.log(`EldenSpire ${ENDLESS ? `ENDLESS simulation (act cap ${ENDLESS_ACT_CAP})` : 'full-run simulation'} — ${N} runs/class, greedy bot\n`);
let crash = null;
for (const cls of REG.classes.all()) {
  let wins = 0, acts = 0, floors = 0, maxAct = 0;
  const deaths = {};
  for (let i = 1; i <= N; i++) {
    let r;
    try {
      r = simulateRun(cls.id, (i * 2654435761) >>> 0);
    } catch (e) {
      crash = `${cls.id} seed#${i}: ${e.message}`;
      console.error(`CRASH ${crash}`);
      break;
    }
    if (r.victory) wins++;
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
}
if (crash) { console.error('\nFULL-RUN SIM FAILED'); process.exit(1); }
console.log('\nNo crashes across all simulated runs — full loop (map → combat → rewards → events → acts) is integration-clean.');
