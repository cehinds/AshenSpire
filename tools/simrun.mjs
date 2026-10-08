import {rollPendingAbilityOffers} from '../src/model/abilityOffers.js';
import {abilityDraftChoice} from '../src/model/abilityDraftReceipts.js';
import {isAbilitySkill} from '../src/model/abilityGrades.js';
import { openRunClassMastery, registriesForClassMastery } from '../src/model/classMasteryRun.js';
import { initialClassTreeChoices, pickInitialClassTreeNode } from '../src/model/classTree.js';
import { commitEventChoice } from '../src/engine/quests.js';
// tools/simrun.mjs — the simulators' ONE run loop between fights.
//
// runsim and measure-classes both play whole seeded runs: the map path, the
// events and their recorded history, the shrines (grace refill, rest or smith,
// the level-up points), treasure, the act bosses, and after every fight the
// rewards (cinders, the class-tree and skill drafts, the card rows of
// cardRewardPlan, flask drops, elite and boss relics) and the XP a fight pays.
// measure-classes used to keep a copy of this loop, and the copy fell behind
// (no XP, drafts, level-ups or event history), so its runs left runsim's after
// the first few fights and `--check` at n=500 went red on wins. Both tools now
// call this module, and each passes only its own fight bot.
//
// Nothing here is a game rule or a balance number. The two pilot thresholds
// (take a shrine path below 55% HP, rest below 60%) are the bot's own habits,
// named in `PILOT`, and a caller may override them (measure-classes' `path` and
// `shrine` plants do, to prove its check sees a run-loop drift).

import { createRunState, createIdGen } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { skillXpReceipt, applySkillXp } from '../src/engine/skillXp.js';
import { skillTracks, spendSkillDraft, classSkillId } from '../src/model/skills.js';
import { awardClassXp, pickClassNode } from '../src/model/classTree.js';
import { buildActMap, bossEncounterForNode, drawSeatOrder } from '../src/engine/actmap.js';
import { seatAtTier, seatTierHpMult } from '../src/model/seats.js';
import { levelUpPlan, applyLevelUp, awardLevelXp, combatLevelXp, xpToNext as xpToNextLevel } from '../src/model/levelup.js';
import { executeRunEffects } from '../src/engine/actions.js';
import { availableEventChoices, recordEventChoice } from '../src/model/quests.js';
import { eventChoicesWithHistory } from '../src/content/events.js';
import {
  rollEncounter, rollRuneReward, rollCardRewardIds, rollSkillDraftIds, rollClassDraftIds, rollFlaskDrop,
  rollRelicReward,
} from '../src/engine/encounters.js';
import { createLocationVisit, arriveAt, restAt, leaveLocation } from '../src/engine/locations.js';
import { cardRewardPlan } from '../src/model/rewardplan.js';
import { endlessActInfo, ENDLESS_HP_PER_LOOP, ENDLESS_STR_PER_LOOP } from '../src/content/customMods.js';

/** A run that stops making progress (a fight that never resolves, a walk that never reaches its boss). */
export class SoftLock extends Error {}

/** The pilot's habits between fights: fractions of max HP. Bot behaviour, not game balance. */
export const PILOT = Object.freeze({ pathHurtBelow: 0.55, restBelow: 0.6 });

/** The run's seed for fleet index i (1-based): runsim's formula, shared so every n nests a smaller one. */
export const fleetSeed = (i) => (i * 2654435761) >>> 0;

/**
 * The XP a settled fight pays, as main.js onCombatEnd pays it after
 * runCombatEnd: the skill receipt (plan phase 4a), then the character level
 * (plan phase 6) for a won fight and every kill by the door's pool. The levels
 * it bought are kept for afterVictory's card rows (the level card, SPEC §15.1).
 */
export function payFightXp(REG, run, combat, enc) {
  applySkillXp(REG, run, skillXpReceipt(combat));
  run._fightLevelUps = awardLevelXp(REG, run, combatLevelXp(REG, {
    victory: combat.result === 'victory', pool: enc.pool, enemies: combat.enemies,
  })).levelUps;
}

/**
 * createRunLoop(REG, config) → { simulateRun, afterVictory, counters, resetCounters }
 *
 * config (read live, so a caller may flip a field between fleets):
 *   fight(run, rng, encounterId, cm, ctx) → 'victory' | 'defeat' | 'stalemate'
 *     the caller's bot; it must settle the fight (runCombatEnd + payFightXp).
 *   pilot: { pathHurtBelow, restBelow }   defaults PILOT
 *   levelPick(run) → attribute id         default 'constitution'
 *   attributes(classId) → allocation      default the shipped preset
 *   graceOn (default true), seededSeats, endless, endlessActCap (default 15),
 *   stepBudget (default: the act map's node count), mapCycle (the runsim plant)
 *   hooks: onRunStart(run, ctx), onActOpen(run, act, ctx),
 *          onDeath(run, act, hpIn, ctx), onFightWon(run, { act, floor, pool }, ctx)
 */
export function createRunLoop(REG, config) {
  const sourceRegistries = REG;
  const counters = {};
  const resetCounters = () => Object.assign(counters, {
    poured: 0, graces: 0, levelUps: 0, levelsReached: 0, levelsReachedInWins: 0, xpEarnedInWins: 0,
    cinderLeftAtEnd: 0, skillDraftsTaken: 0, classDraftsTaken: 0, levelUpsInWins: 0,
  });
  resetCounters();
  const hook = (name, ...args) => { const h = config.hooks && config.hooks[name]; if (h) h(...args); };
  const pilot = () => ({ ...PILOT, ...(config.pilot || {}) });
  const levelPick = (run) => (config.levelPick ? config.levelPick(run) : 'constitution');

  // The XP a run has earned in all: every step it climbed plus what waits toward the next.
  const xpEarnedBy = (run) => {
    const row = run.level || { level: 1, xp: 0 };
    let total = row.xp || 0;
    for (let l = 1; l < (row.level || 1); l++) total += xpToNextLevel(REG, l);
    return total;
  };

  function afterVictory(run, rng, pool) {
    run.cinders += rollRuneReward(REG, rng, pool, run.relics);
    // The class track, paid by the run's owner (plan phase 5b), and its draft,
    // one per door as main.js offers it: the bot picks the first node offered.
    awardClassXp(REG, run, { victory: true, pool });
    let classDrafts = 0;
    {
      const row = run.skills && run.skills[classSkillId(run.class)];
      if (row && row.pendingDrafts > 0) {
        const ids = rollClassDraftIds(REG, rng, { classId: run.class, coreTags: run.coreTags, level: row.level });
        if (ids.length && pickClassNode(REG, run, ids[0])) { spendSkillDraft(run, classSkillId(run.class)); classDrafts += 1; }
      }
    }
    counters.classDraftsTaken += classDrafts;
    // The skill drafts, as main.js offers them (plan phase 4b): one per track
    // with a draft queued, capped per door, the bot taking the first card; a
    // draft on the table takes the card row's seat.
    let drafts = 0;
    for (const track of skillTracks(REG)) {
      const row = run.skills && run.skills[track.id];
      if (!row || !(row.pendingDrafts > 0)) continue;
      if(run.progressionRulesVersion===1 && isAbilitySkill(track.id)){
        for(const offer of rollPendingAbilityOffers(REG,rng,run,{skillId:track.id})){
          const choice=abilityDraftChoice(offer,offer.choiceIds[0]);
          if(spendSkillDraft(run,track.id,offer.offerId,choice.choiceId)){run.deck.push({instanceId:run._id(),cardId:choice.cardId,upgraded:false,abilityRank:choice.abilityRank,abilityOfferId:offer.offerId});drafts++;}
        }
        continue;
      }
      for (let i = 0; i < Math.min(REG.balance.skill.draftsPerCombat, row.pendingDrafts); i++) {
        const ids = rollSkillDraftIds(REG, rng, { classId: run.class, loadout: run.loadout, skillId: track.id, level: row.level, pool });
        if (!ids.length) break;
        spendSkillDraft(run, track.id);
        run.deck.push({ instanceId: run._id(), cardId: ids[0], upgraded: false });
        drafts += 1;
      }
    }
    counters.skillDraftsTaken += drafts;
    // The card rows, through the one schedule door main.js and co-op read
    // (model/rewardplan.js cardRewardPlan, SPEC §15.1): the plain offer unless
    // a draft holds its seat, the pool is off or the chance misses, then a
    // level card per level bought when onLevelUp is on. The bot takes the
    // first card of each.
    const cardPlan = cardRewardPlan(REG.balance, { pool, levelsGained: run._fightLevelUps || 0, draftWaiting: !!(drafts || classDrafts) }, rng);
    run._fightLevelUps = 0;
    const cards = cardPlan.offerCard ? rollCardRewardIds(REG, rng, { classId: run.class, pool, relicIds: run.relics }) : [];
    if (cards.length) run.deck.push({ instanceId: run._id(), cardId: cards[0], upgraded: false });
    for (let i = 0; i < cardPlan.levelCards; i++) {
      const levelCard = rollCardRewardIds(REG, rng, { classId: run.class, pool, relicIds: run.relics });
      if (levelCard.length) run.deck.push({ instanceId: run._id(), cardId: levelCard[0], upgraded: false });
    }
    const flask = rollFlaskDrop(REG, rng, run);
    if (flask && run.flasks.length < (REG.balance.flaskSlots || 3)) run.flasks.push({ flaskId: flask });
    if (pool === 'elite') {
      const r = rollRelicReward(REG, rng, run.relics);
      if (r) run.relics.push(r);
    }
  }

  function simulateRun(classId, seed, ctx = null) {
    REG = sourceRegistries;
    const attributes = config.attributes ? config.attributes(classId) : undefined;
    const run = createRunState({ seed, classId, registries: REG, attributes, combatExpansionVersion: config.combatExpansionVersion ?? 2 });
    if (config.classMastery) {
      openRunClassMastery(REG, run, {}, { receiptId: `sim:${classId}:${seed}`, bankable: false });
      REG = registriesForClassMastery(REG, run);
      while (run.classMasteryState.initialTreeTiers.length) {
        const first = initialClassTreeChoices(REG, run)[0];
        if (!first || !pickInitialClassTreeNode(REG, run, first)) throw new Error('sim cannot choose a legal initial class node');
      }
    }
    run._id = createIdGen('sim');
    run.seenEvents = [];
    hook('onRunStart', run, ctx);
    const rng = createRng(seed);
    // SPEC §13.4: the seeded order rides its own stream, so drawing it here moves
    // no map, event or reward roll below.
    if (config.seededSeats) run.seatOrder = drawSeatOrder(REG, rng);
    const result = { classId, seed, victory: false, act: 1, floor: 0, deaths: null, tiers: [] };
    // ONE exit for every path out of a run, win or death: the purse a run ends
    // with is part of the cinder economy whichever way it ended, and the report
    // divides by every run — a death that skipped this line underreported it.
    const finish = () => {
      counters.cinderLeftAtEnd += run.cinders;
      counters.levelsReached += Math.max(0, (run.level && run.level.level ? run.level.level : 1) - 1);
      // E12 receipts: how many event choices this run recorded, and how many of
      // them answered a GATED step (a quest step earned by an earlier choice) —
      // zero across a fleet means gated content never entered the simulation.
      const gates = REG.eventHistoryRequirements || {};
      const choices = run.history.filter((row) => row && row.kind === 'eventChoice');
      result.eventChoices = choices.length;
      result.questSteps = choices.filter((row) => gates[row.eventId]).length;
      result.skills = run.skills;
      result.masteryXpByClass = { ...run.classMasteryState?.earnedXp };
      result.masteryXp = Object.values(result.masteryXpByClass).reduce((sum, xp) => sum + xp, 0);
      return result;
    };
    // The death book: the caller's hook gets the act and the HP the run walked
    // into the fatal node with (the fight writes the pools back on a loss too,
    // so each caller of the bot captures hpIn before the fight).
    const died = (deaths, act, floor, enc, hpIn) => {
      result.deaths = deaths;
      if (enc) result.deathInfo = { act, floor, enc, hpIn, maxHp: run.maxHp };
      hook('onDeath', run, act, hpIn, ctx);
      return finish();
    };
    const fightAt = (act, floor, encId, cm, pool, deathPrefix) => {
      const hpIn = run.hp;
      const fought = config.fight(run, rng, encId, cm, ctx);
      if (fought !== 'victory') return died(`${deathPrefix}${fought === 'stalemate' ? '·stalemate' : ''}:${encId}`, act, floor, encId, hpIn);
      afterVictory(run, rng, pool);
      hook('onFightWon', run, { act, floor, pool }, ctx);
      return null;
    };

    const lastAct = config.endless ? (config.endlessActCap || 15) : 3;
    for (let act = 1; act <= lastAct; act++) {
      run.actNumber = act;
      result.act = act;
      hook('onActOpen', run, act, ctx);
      // Endless: acts past 3 reuse act 1-3 content, scaled per completed cycle.
      const { contentAct, loop } = config.endless ? endlessActInfo(act) : { contentAct: act, loop: 0 };
      const seat = seatAtTier(run.seatOrder, contentAct);
      result.tiers.push({ tier: contentAct, seat, cleared: false });
      // Endless cycle scaling × the seat's tier ratio (SPEC §13.3; exactly 1
      // when the seat is climbed at its authored baseline, i.e. every default-
      // order run).
      const tierMult = seatTierHpMult(REG, seat, contentAct);
      const hpMult = (1 + ENDLESS_HP_PER_LOOP * loop) * tierMult;
      const cm = hpMult !== 1 || loop > 0
        ? { hpMult, loopMult: 1 + ENDLESS_HP_PER_LOOP * loop, enemyStatuses: loop > 0 ? [{ status: 'strength', stacks: ENDLESS_STR_PER_LOOP * loop }] : [] }
        : {};
      // The ONE boot path (#54) — same module main.js and session.mjs use, so a
      // signature change lands on the game and the harnesses in the same act.
      const map = buildActMap(REG, rng, seat, contentAct, null, { history: run.history });
      // Plant (runsim --selftest): every node a skipped merchant whose only exit
      // is itself — a walk that never fights, never dies and never reaches a boss.
      if (config.mapCycle) for (const node of Object.values(map.nodes)) { node.type = 'merchant'; node.resolved = null; node.next = [node.id]; }
      const stepBudget = config.stepBudget || Object.keys(map.nodes).length;
      let steps = 0;
      const { pathHurtBelow, restBelow } = pilot();

      let currentId = null;
      let nextIds = map.startIds;
      while (true) {
        // pilot: prefer a shrine when hurt, else the first option
        const options = nextIds.map((id) => map.nodes[id]);
        const hurt = run.hp < run.maxHp * pathHurtBelow;
        const pick = (hurt && options.find((n) => n.type === 'shrine')) || options[0];
        if (++steps > stepBudget) {
          throw new SoftLock(`act ${act} walked ${steps - 1} map nodes (budget ${stepBudget}) without reaching its boss`);
        }
        currentId = pick.id;
        result.floor = pick.floor;

        let kind = pick.type;
        if (kind === 'event') {
          const res = pick.resolved || { kind: 'fight' };
          if (res.kind === 'event') {
            run.seenEvents.push(res.eventId);
            const ev = REG.events.get(res.eventId);
            // The same door the Event screen walks: the choices the run's history
            // allows, then the first the purse affords — and the choice is
            // RECORDED, so a later act's map can roll the quest step it earned
            // (E12). Without the record no gated content ever enters a sim.
            const offered = availableEventChoices(eventChoicesWithHistory(ev), run).map(({ choice: c }) => c);
            const choice = offered.find((c) => !c.requires || (c.requires.cinders || 0) <= run.cinders) || offered[offered.length - 1];
            const hpBeforeEvent = run.hp;
            run.floor = pick.floor;
            run.mapNodeId = pick.id;
            if (config.classMastery) commitEventChoice({ run, registries: REG, rng }, { eventId: res.eventId, choiceId: choice.id });
            else {
              executeRunEffects({ run, registries: REG, rng }, choice.effects);
              recordEventChoice(run, { eventId: res.eventId, choiceId: choice.id });
            }
            if (run.hp <= 0) return died(`event:${res.eventId}`, act, pick.floor, null, hpBeforeEvent);
            if (run.combatEntered) {
              const encId = typeof run.combatEntered === 'string' ? run.combatEntered : run.combatEntered.encounterId;
              run.combatEntered = null;
              const dead = fightAt(act, pick.floor, encId, cm, 'normal', 'ambush');
              if (dead) return dead;
            }
            kind = null;
          } else kind = res.kind;
        }

        if (kind === 'monster' || kind === 'fight' || kind === 'elite' || kind === 'boss') {
          const pool = kind === 'monster' || kind === 'fight' ? 'normal' : kind;
          const encId = pool === 'boss' ? bossEncounterForNode(REG, map, pick.id, { seat, tier: contentAct })
            : rollEncounter(REG, rng, { pool, seat });
          if (pool === 'boss') result.tiers[result.tiers.length - 1].boss = encId;
          const dead = fightAt(act, pick.floor, encId, cm, pool, pool);
          if (dead) return dead;
          if (pool === 'boss') {
            result.tiers[result.tiers.length - 1].cleared = true;
            const boss = rollRelicReward(REG, rng, run.relics, { rarities: ['boss'] });
            if (boss) run.relics.push(boss);
            break; // act cleared
          }
        } else if (kind === 'shrine') {
          // THE SHRINE IS A LOCATION VISIT (plan phase 7, engine/locations.js):
          // its tags' rules mount, `arrived` refills (the restFlasks rule —
          // AUTOMATIC AND BEFORE THE CHOICE, exactly as src/main.js showRest
          // does) and `rested` heals and restores Mana by the tag set. The bot
          // walks the same door the game does, so a retune of the shrine's rows
          // moves this measurement without an edit here.
          counters.graces++;
          const visit = createLocationVisit({ run, registries: REG, rng }, 'shrine');
          if (config.graceOn !== false) {
            // COUNT THE CHARGE MODEL, NOT ONLY THE GRANT MODEL. applyGraceRefill
            // returns `total: 0` BY CONSTRUCTION for a run on charge vessels — it
            // tops up hpCurrent/manaCurrent and grants no flask objects — so the
            // grant total alone read 0 forever under a refill that was working.
            const before = run.flaskCharges
              ? (run.flaskCharges.hpCurrent || 0) + (run.flaskCharges.manaCurrent || 0) : 0;
            const arrival = arriveAt(visit);
            counters.poured += arrival.refill ? arrival.refill.total : 0;
            if (run.flaskCharges) {
              counters.poured += Math.max(0, ((run.flaskCharges.hpCurrent || 0) + (run.flaskCharges.manaCurrent || 0)) - before);
            }
          }
          if (run.hp < run.maxHp * restBelow && !visit.restDenied) restAt(visit);
          else { const c = run.deck.find((d) => !d.upgraded); if (c) c.upgraded = true; }
          leaveLocation(visit);
          // THE BOT ASSIGNS EVERY POINT IT HAS EARNED — the shrine is where the
          // level's points land (plan phase 6).
          for (let plan = levelUpPlan(REG, run); plan.offerable; plan = levelUpPlan(REG, run)) {
            applyLevelUp(REG, run, levelPick(run));
            result.levelUps = (result.levelUps || 0) + 1;
            counters.levelUps += 1;
          }
        } else if (kind === 'treasure') {
          const r = rollRelicReward(REG, rng, run.relics);
          if (r) run.relics.push(r);
        } // merchant: skip

        nextIds = map.nodes[currentId].next;
        if (!nextIds || !nextIds.length) nextIds = map.bossIds || [map.bossId];
      }
      run.hp = run.maxHp; // between acts, like main.js
    }
    result.victory = true;
    counters.levelUpsInWins += result.levelUps || 0;
    counters.levelsReachedInWins += Math.max(0, (run.level && run.level.level ? run.level.level : 1) - 1);
    counters.xpEarnedInWins += xpEarnedBy(run);
    return finish();
  }

  return { simulateRun, afterVictory, counters, resetCounters };
}
