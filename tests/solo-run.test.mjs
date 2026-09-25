// tests/solo-run.test.mjs — THE SOLO RUN SCENARIO. One broad test in place of
// many narrow ones: every class climbs seeded runs toward act 3 through the real engine
// and model (the tools/runsim.mjs greedy bot, with the main.js run loop around
// it), and at EVERY node, every reward row and one committed turn of every
// fight the run goes through the real save door (createSaveManager →
// saveRun → loadRun) and the climb continues from the loaded run. The same
// seed is then replayed with no reloads and must produce the identical trace,
// so one comparison proves both determinism and a lossless save door. The
// legacy save fixtures come through the migration path and are played on.
//
// Invariants asserted at every step (a failure names seed/class/node):
// HP/Mana/Stamina bounds, deck instance ids unique, pile conservation inside a
// fight, card-pity counters in band, elite chest options valid and takeable,
// boss relic choice (distinct, unowned, boss rarity; consolation when the pool
// is exhausted), character level/XP monotonic, weapon Art charge in 0..max,
// flask growth synced with held relics, grace refill fills the vessels,
// statusApplied events land on living combatants, validateRunShape after
// every load, and a load→save is a fixed point of the save bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { createRng } from '../src/engine/rng.js';
import { dispatch } from '../src/engine/combat.js';
import { skillXpReceipt, applySkillXp } from '../src/engine/skillXp.js';
import { skillTracks, spendSkillDraft, skillUpgradesCards, skillLevel, classSkillId, joinDeck, deckInstanceId } from '../src/model/skills.js';
import { awardClassXp, pickClassNode } from '../src/model/classTree.js';
import { buildActMap, bossEncounterForNode, drawSeatOrder } from '../src/engine/actmap.js';
import { seatAtTier } from '../src/model/seats.js';
import { createRunState, validateRunShape, RUN_SCHEMA_VERSION } from '../src/model/state.js';
import { levelUpPlan, applyLevelUp, awardLevelXp, combatLevelXp, xpToNext } from '../src/model/levelup.js';
import { executeRunEffects } from '../src/engine/actions.js';
import { availableEventChoices, recordEventChoice } from '../src/model/quests.js';
import { eventChoicesWithHistory } from '../src/content/events.js';
import {
  rollEncounter, rollRuneReward, rollCardRewardIds, rollSkillDraftIds, rollClassDraftIds, rollFlaskDrop,
  rollRelicReward, rollBossRelicChoices, rollEliteChest, buildShopStock,
} from '../src/engine/encounters.js';
import { applyChestOption, chestUpgradeable, chestShapeProblems, chestOptionReferenceProblems } from '../src/model/rewardChest.js';
import { syncFlaskGrowth, flaskGrowthPlan } from '../src/model/flaskgrowth.js';
import { flaskSlotCap } from '../src/model/gracerefill.js';
import { CAMP_LOCATION } from '../src/model/locations.js';
import { createLocationVisit, arriveAt, restAt, leaveLocation } from '../src/engine/locations.js';
import { createSaveManager, createMemoryStorage, RUN_KEY, RUN_ARCHIVE_KEY } from '../src/engine/save.js';
import { commitCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { rewardPlan, resolveContinue } from '../src/model/rewardplan.js';
import { combatXpGains } from '../src/model/rewardprogress.js';
import { grantSmithingReward, smithingPlan, commitSmithing } from '../src/model/smithing.js';
import { stampDeck } from '../src/model/loadout.js';
import { createRunCombat, runCombatEnd } from '../src/engine/runCombat.js';
import { artChargeView } from '../src/model/artCharge.js';

const REG = createRegistries(contentBundle);
const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1).map((i) => (i * 2654435761) >>> 0);
const PILES = ['draw', 'hand', 'discard', 'exhaust'];

// ---- invariants -------------------------------------------------------------
function where(ctx, node) {
  return `[${ctx.classId} seed ${ctx.seed}${ctx.reload ? ' reload' : ''} act ${ctx.run.actNumber} floor ${ctx.run.floor} ${node}]`;
}

function checkRun(ctx, node) {
  const run = ctx.run;
  const at = where(ctx, node);
  assert.ok(Number.isInteger(run.hp) && run.hp >= 0 && run.hp <= run.maxHp, `${at} hp ${run.hp}/${run.maxHp} out of bounds`);
  assert.ok(run.maxHp > 0, `${at} maxHp ${run.maxHp}`);
  for (const f of ['mana', 'stamina']) {
    const max = run[`max${f[0].toUpperCase()}${f.slice(1)}`];
    if (run[f] !== undefined) assert.ok(run[f] >= 0 && run[f] <= max, `${at} ${f} ${run[f]}/${max} out of bounds`);
  }
  assert.ok(Number.isInteger(run.cinders) && run.cinders >= 0, `${at} cinders ${run.cinders}`);
  const ids = run.deck.map((c) => c.instanceId);
  assert.equal(new Set(ids).size, ids.length, `${at} duplicate deck instance ids`);
  for (const c of run.deck) assert.ok(REG.cards.has(c.cardId), `${at} unknown card ${c.cardId}`);
  assert.equal(new Set(run.relics).size, run.relics.length, `${at} a relic is held twice`);
  for (const r of run.relics) assert.ok(REG.relics.has(r), `${at} unknown relic ${r}`);
  assert.ok(run.flasks.length <= flaskSlotCap(REG.balance), `${at} flask belt over its cap`);
  // Card-rarity pity (SPEC §3.8.1).
  const pity = REG.balance.rewards.cardPity;
  if (run.cardRarityOffset !== undefined) {
    assert.ok(run.cardRarityOffset >= pity.offsetStart && run.cardRarityOffset <= pity.offsetMax, `${at} cardRarityOffset ${run.cardRarityOffset}`);
    assert.ok(Number.isInteger(run.cardRewardsSinceRare) && run.cardRewardsSinceRare >= 0
      && run.cardRewardsSinceRare <= pity.rareGuaranteeAfter + 1, `${at} cardRewardsSinceRare ${run.cardRewardsSinceRare}`);
  }
  // Flask vessels and the growth chain.
  const f = run.flaskCharges;
  if (f) {
    assert.ok(f.hpCurrent >= 0 && f.hpCurrent <= f.hp && f.manaCurrent >= 0 && f.manaCurrent <= f.mana, `${at} flask charges ${JSON.stringify(f)}`);
    assert.ok(f.hp + f.mana <= f.capacity, `${at} flask allocation exceeds capacity ${JSON.stringify(f)}`);
    const plan = flaskGrowthPlan(REG, run).perKind;
    assert.deepEqual({ hp: f.grown?.hp || 0, mana: f.grown?.mana || 0 }, plan, `${at} flask growth out of sync with held sources`);
  }
  // Character level / XP never go backwards.
  const lvl = run.level || { level: 1, xp: 0 };
  let total = lvl.xp || 0;
  for (let l = 1; l < lvl.level; l++) total += xpToNext(REG, l);
  assert.ok(lvl.level >= ctx.maxLevel && total >= ctx.maxXp, `${at} level/XP went backwards: ${lvl.level}/${total} after ${ctx.maxLevel}/${ctx.maxXp}`);
  ctx.maxLevel = lvl.level; ctx.maxXp = total;
  assert.ok(lvl.xp >= 0 && lvl.xp < xpToNext(REG, lvl.level), `${at} xp ${lvl.xp} not below the next threshold`);
}

function fingerprint(run) {
  const view = {
    act: run.actNumber, floor: run.floor, node: run.mapNodeId, hp: run.hp, maxHp: run.maxHp, mana: run.mana, stamina: run.stamina,
    cinders: run.cinders, stones: run.smithingStones, deck: run.deck.map((c) => `${c.instanceId}:${c.cardId}:${c.upgraded ? 1 : 0}`),
    relics: run.relics, flasks: run.flasks, charges: run.flaskCharges, level: run.level, skills: run.skills, coreTags: run.coreTags,
    pity: [run.cardRarityOffset, run.cardRewardsSinceRare], counters: run.streamCounters, attributes: run.attributes,
    pending: run.pendingReward ? run.pendingReward.states : null, history: run.history.length,
  };
  return view;
}

// ---- the save door: every checkpoint saves; a reload run continues from the load
const stripSavedAt = (json) => json.replace(/"savedAt":"[^"]*"/, '');

function checkpoint(ctx, node) {
  ctx.saves.saveRun(ctx.run, ctx.rng);
  ctx.saveCount++;
  if (ctx.reload) {
    const loaded = ctx.saves.loadRun(REG);
    if (!loaded) {
      const archive = JSON.parse(ctx.storage.getItem(RUN_ARCHIVE_KEY) || '{"entries":[]}');
      assert.fail(`${where(ctx, node)} loadRun refused the save it just wrote: ${archive.entries.at(-1)?.reason}`);
    }
    assert.deepEqual(validateRunShape(loaded), [], `${where(ctx, node)} validateRunShape after load`);
    // Once through the door, a save is a fixed point: load→save→load→save
    // writes the same bytes (the first load may stamp what the game pushed raw).
    ctx.saves.saveRun(loaded, createRng(loaded.seed, loaded.streamCounters));
    const bytes = ctx.storage.getItem(RUN_KEY);
    const twice = ctx.saves.loadRun(REG);
    ctx.saves.saveRun(twice, createRng(twice.seed, twice.streamCounters));
    const again = ctx.storage.getItem(RUN_KEY);
    if (stripSavedAt(again) !== stripSavedAt(bytes)) {
      const x = JSON.parse(bytes); const y = JSON.parse(again);
      const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => k !== 'savedAt' && JSON.stringify(x[k]) !== JSON.stringify(y[k]));
      assert.fail(`${where(ctx, node)} save→load→save changed the bytes of: ${keys.join(', ')}`);
    }
    ctx.run = loaded;
    ctx.rng = createRng(loaded.seed, loaded.streamCounters);
  } else {
    assert.deepEqual(validateRunShape(ctx.run), [], `${where(ctx, node)} validateRunShape`);
  }
  checkRun(ctx, node);
  ctx.trace.push({ node, view: JSON.stringify(fingerprint(ctx.run)) });
}

// ---- the fight (tools/runsim.mjs bot, main.js player literal) ---------------
function checkCombat(ctx, combat, deckIds, at) {
  const seen = new Set();
  for (const pile of PILES) for (const c of combat.piles[pile]) {
    assert.ok(!seen.has(c.instanceId), `${at} card ${c.instanceId} sits in two piles`);
    seen.add(c.instanceId);
  }
  // Conservation: a deck card is in exactly one pile, unless it was played as
  // a card the framework removes from play (a Power), or the fight ended with
  // it mid-resolution.
  if (!combat.result) {
    const removed = new Set(combat.eventLog.filter((ev) => ev.type === 'cardPlayed'
      && REG.framework.afterPlayDestination(resolveCard(REG, { cardId: ev.cardId, upgraded: false })) === 'REMOVED_FROM_PLAY')
      .map((ev) => ev.cardInstanceId));
    for (const id of deckIds) assert.ok(seen.has(id) || removed.has(id), `${at} deck card ${id} vanished from every pile`);
  }
  const p = combat.player;
  assert.ok(p.hp <= p.maxHp && p.hp >= 0, `${at} combat hp ${p.hp}/${p.maxHp}`);
  assert.ok(p.mana >= 0 && p.mana <= p.maxMana, `${at} combat mana ${p.mana}/${p.maxMana}`);
  assert.ok(p.energy >= 0, `${at} energy ${p.energy}`);
  for (const e of combat.enemies) assert.ok(e.hp >= 0 && e.hp <= e.maxHp, `${at} enemy ${e.id} hp ${e.hp}/${e.maxHp}`);
  for (const row of artChargeView(combat)) {
    assert.ok(row.value >= 0 && row.value <= row.max, `${at} Art charge ${row.weaponId} ${row.value}/${row.max}`);
    ctx.stats.artMeters++;
    if (row.value > 0) ctx.stats.artCharged++;
  }
  for (const [weaponId, raw] of Object.entries(combat.artCharge || {})) {
    assert.ok(Number.isInteger(raw) && raw >= 0, `${at} raw Art charge ${weaponId}=${raw}`);
  }
}

function botStep(combat) {
  if (combat.player.hp < combat.player.maxHp * 0.55) {
    const ch = combat.player.flaskCharges;
    if (ch && (ch.hpCurrent || 0) > 0) {
      try { dispatch(combat, { type: 'useFlask', chargeKind: 'hp' }); return; } catch { /* cards */ }
    }
    if (combat.player.flasks.length) {
      const fdef = REG.flasks.get(combat.player.flasks[0].flaskId);
      const tgt = combat.enemies.find((e) => e.alive);
      try { dispatch(combat, { type: 'useFlask', slot: 0, targetId: fdef.targeted ? tgt && tgt.id : undefined }); return; } catch { /* cards */ }
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
  } catch {
    dispatch(combat, { type: 'endTurn' });
  }
}

function fight(ctx, nodeId, encounterId) {
  const enc = REG.encounters.get(encounterId);
  ctx.run.combatEntered = { nodeId, encounterId };
  checkpoint(ctx, `${nodeId}:enter:${encounterId}`);
  const run = ctx.run;
  const deckIds = run.deck.map((c) => c.instanceId);
  // The one door a run's fight is built through (engine/runCombat.js): the
  // live game and every simulator open it, so the hand and rating rows are
  // this run's own (ruleset 7) and the Stamina entry rule applies.
  let combat = createRunCombat({
    registries: REG, rng: ctx.rng, run, enemyIds: enc.enemies,
    settings: (ctx.saves.loadMeta() || {}).settings || {},
  });
  const at = () => where(ctx, `${nodeId}:${encounterId}:turn ${combat.turn}`);
  // The shipped Stamina entry rule is full: every fight opens on full Stamina
  // whatever the last one drained (plan A2).
  assert.equal(combat.player.stamina, combat.player.maxStamina, `${at()} the fight did not open on full Stamina`);
  checkCombat(ctx, combat, deckIds, at());
  let guard = 0;
  let snapshotted = false;
  while (!combat.result && guard++ < 9000) {
    const turn = combat.turn;
    botStep(combat);
    checkCombat(ctx, combat, deckIds, at());
    // One committed turn boundary per fight crosses the save door (main.js
    // onSave): commit the snapshot, save, load, and fight on from the restore.
    if (!snapshotted && !combat.result && combat.turn > turn) {
      snapshotted = true;
      commitCombatSnapshot({ run: ctx.run, combat, nodeId, encounterId });
      checkpoint(ctx, `${nodeId}:snapshot`);
      if (ctx.reload) {
        const snap = ctx.run.combatEntered.snapshot;
        assert.ok(snap && !snap.result, `${at()} the loaded run lost its combat snapshot`);
        combat = restoreCombatSnapshot({
          registries: REG, rng: ctx.rng, snapshot: snap,
          fallbackAttackSlotCount: ctx.run.equipmentAttackSlotCount,
          fallbackRemovedAttackSlotIds: ctx.run.removedAttackSlotIds,
          fallbackDerivedStatRuleSnapshot: ctx.run.derivedStatRuleSnapshot,
        });
        checkCombat(ctx, combat, deckIds, at());
      }
    }
  }
  assert.ok(guard < 9000, `${at()} combat stalled`);
  // Statuses reach living combatants, and every event names a real target.
  const targets = new Set(['player', ...combat.enemies.map((e) => e.id)]);
  for (const ev of combat.eventLog) {
    if (ev.type !== 'statusApplied') continue;
    assert.ok(targets.has(ev.targetId), `${at()} statusApplied on unknown target ${ev.targetId}`);
    assert.ok(REG.statuses.has(ev.status) && ev.stacks >= 0, `${at()} statusApplied ${ev.status} x${ev.stacks}`);
    if (ev.targetId === 'player') ctx.stats.statusOnPlayer++; else ctx.stats.statusOnEnemy++;
  }
  ctx.stats.fights++;

  // onCombatEnd (src/main.js): write back, pay every ledger, stamp the deck.
  const r = ctx.run;
  runCombatEnd(r, combat);
  const receipt = skillXpReceipt(combat);
  applySkillXp(REG, r, receipt);
  const classAward = awardClassXp(REG, r, { victory: combat.result === 'victory', pool: enc.pool });
  const levelAward = awardLevelXp(REG, r, combatLevelXp(REG, {
    victory: combat.result === 'victory', pool: enc.pool, kills: combat.eventLog.filter((e) => e.type === 'enemyDied').length,
  }));
  if (levelAward.levelUps) ctx.stats.levelUps += levelAward.levelUps;
  const xpGains = combatXpGains({ receipt, awards: [classAward], levelGained: levelAward.gained, levelUps: levelAward.levelUps });
  stampDeck(REG, r, undefined, { adoptEquipmentBonuses: combat.equipmentChanged });
  const deckAfter = new Set(r.deck.map((c) => c.instanceId));
  for (const id of deckIds) assert.ok(deckAfter.has(id), `${at()} deck card ${id} lost across the fight`);
  if (combat.result !== 'victory') { r.hp = 0; return null; }
  r.combatEntered = null;
  r.stats.fightsWon += 1;
  const smithingStoneReceipt = grantSmithingReward(REG, r, enc.pool, `combat:${r.actNumber}:${r.floor}:${nodeId}:${enc.pool}`);
  return { enc, xpGains, smithingStoneReceipt };
}

// ---- the reward door (main.js beginPendingReward + ui/screens/reward.js apply)
function rollSkillDrafts(ctx, pool) {
  const out = [];
  for (const track of skillTracks(REG)) {
    const row = ctx.run.skills && ctx.run.skills[track.id];
    if (!row || !(row.pendingDrafts > 0)) continue;
    for (let i = 0; i < Math.min(REG.balance.skill.draftsPerCombat, row.pendingDrafts); i++) {
      const cardIds = rollSkillDraftIds(REG, ctx.rng, { classId: ctx.run.class, loadout: ctx.run.loadout, skillId: track.id, level: row.level, pool });
      if (cardIds.length) out.push({ skillId: track.id, level: row.level, cardIds });
    }
  }
  return out;
}

function rollClassDrafts(ctx) {
  const row = ctx.run.skills && ctx.run.skills[classSkillId(ctx.run.class)];
  if (!row || !(row.pendingDrafts > 0)) return [];
  const nodeIds = rollClassDraftIds(REG, ctx.rng, { classId: ctx.run.class, coreTags: ctx.run.coreTags, level: row.level });
  return nodeIds.length ? [{ classId: ctx.run.class, level: row.level, nodeIds }] : [];
}

function beginPendingReward(ctx, won, nodeId) {
  const { enc, xpGains, smithingStoneReceipt } = won;
  const run = ctx.run;
  const rng = ctx.rng;
  const at = where(ctx, `${nodeId}:reward`);
  let rewards;
  if (enc.pool === 'boss') {
    const unowned = REG.relics.all().filter((r) => r.rarity === 'boss' && !run.relics.includes(r.id));
    const relicIds = rollBossRelicChoices(REG, rng, run.relics);
    assert.equal(new Set(relicIds).size, relicIds.length, `${at} boss relic choices repeat`);
    assert.ok(relicIds.every((id) => !run.relics.includes(id) && REG.relics.get(id).rarity === 'boss'), `${at} boss relic offered is owned or not boss rarity`);
    assert.ok(relicIds.length === Math.min(REG.balance.rewards.bossRelicChoices, relicIds.length) && (relicIds.length > 0 || unowned.length === 0 || unowned.every((r) => r.pool)),
      `${at} boss relic choice short: ${relicIds.length}`);
    if (relicIds.length) ctx.stats.bossChoices++;
    const classDrafts = rollClassDrafts(ctx);
    const skillDrafts = rollSkillDrafts(ctx, 'boss');
    const consolation = relicIds.length ? 0 : REG.balance.rewards.bossRelicConsolationCinders || 0;
    rewards = {
      title: enc.id, cinders: rollRuneReward(REG, rng, 'boss', run.relics) + consolation, classDrafts, skillDrafts,
      cardIds: skillDrafts.length || classDrafts.length ? [] : rollCardRewardIds(REG, rng, { classId: run.class, pool: 'boss', relicIds: run.relics, run }),
      relicIds, armamentId: null, smithingStoneReceipt, xpGains,
    };
  } else {
    const skillDrafts = rollSkillDrafts(ctx, enc.pool);
    const classDrafts = rollClassDrafts(ctx);
    rewards = {
      title: enc.id, cinders: rollRuneReward(REG, rng, enc.pool, run.relics), classDrafts, skillDrafts,
      cardIds: skillDrafts.length || classDrafts.length ? [] : rollCardRewardIds(REG, rng, { classId: run.class, pool: enc.pool, relicIds: run.relics, run }),
      flaskId: rollFlaskDrop(REG, rng, run),
      chest: enc.pool === 'elite' ? rollEliteChest(REG, rng, run, { found: [], exclude: [] }) : null,
      armamentId: null, smithingStoneReceipt, xpGains,
    };
    if (rewards.chest) {
      const chest = rewards.chest;
      assert.deepEqual(chestShapeProblems(chest), [], `${at} chest shape`);
      assert.ok(chest.options.length >= 1 && chest.options.length <= REG.balance.rewards.eliteChest.choices, `${at} chest size ${chest.options.length}`);
      assert.equal(new Set(chest.options.map((o) => o.category)).size, chest.options.length, `${at} chest categories repeat`);
      for (const o of chest.options) {
        assert.deepEqual(chestOptionReferenceProblems(REG, o), [], `${at} chest option ${JSON.stringify(o)}`);
        if (o.category === 'relic') assert.ok(!run.relics.includes(o.relicId), `${at} chest offers owned relic ${o.relicId}`);
        if (o.category === 'upgrade' && o.mode === 'owned') assert.ok(chestUpgradeable(REG, run, run.deck.find((c) => c.instanceId === o.instanceId)), `${at} chest upgrade not upgradeable`);
      }
      ctx.stats.chests++;
    }
  }
  run.pendingReward = {
    schemaVersion: 1, source: enc.pool, after: enc.pool === 'boss' ? 'advanceAct' : 'map',
    rewards: structuredClone(rewards),
    states: smithingStoneReceipt?.amount > 0 ? { smithingStone: 'taken' } : {},
    chosenCardId: null, chosenDraftCardIds: {}, chosenDraftNodeIds: {}, chosenRelicId: null,
  };
  checkpoint(ctx, `${nodeId}:reward-open`);
}

function applyRow(ctx, row, cp) {
  const run = ctx.run;
  switch (row.kind) {
    case 'cinders': run.cinders += row.amount; return true;
    case 'card':
      joinDeck(REG, run, { instanceId: deckInstanceId(run, 'r', row.cardId), cardId: row.cardId, upgraded: false });
      cp.chosenCardId = row.cardId; return true;
    case 'classDraft':
      if (!pickClassNode(REG, run, row.nodeId)) return false;
      if (!spendSkillDraft(run, classSkillId(run.class))) { run.coreTags.pop(); return false; }
      cp.chosenDraftNodeIds[row.key] = row.nodeId; return true;
    case 'skillDraft':
      if (!spendSkillDraft(run, row.skillId)) return false;
      joinDeck(REG, run, { instanceId: deckInstanceId(run, 'r', row.cardId), cardId: row.cardId, upgraded: skillUpgradesCards(REG, skillLevel(run, row.skillId)) });
      cp.chosenDraftCardIds[row.key] = row.cardId; return true;
    case 'flask': run.flasks.push({ flaskId: row.flaskId }); return true;
    case 'relic':
      if (!row.relicId || run.relics.includes(row.relicId)) return false;
      if (row.choice) cp.chosenRelicId = row.relicId;
      run.relics.push(row.relicId);
      syncFlaskGrowth(REG, run);
      ctx.stats.relicsTaken++;
      return true;
    case 'chest': {
      const option = row.options[row.optionIndex];
      if (!option || !row.takeable[row.optionIndex]) return false;
      if (!applyChestOption(REG, run, option)) return false;
      if (option.category === 'relic') syncFlaskGrowth(REG, run);
      cp.chosenChestIndex = row.optionIndex;
      ctx.stats.chestsTaken++;
      return true;
    }
    default: return false;
  }
}

// One row per call, then save and (in reload mode) load: every mid-reward state
// crosses the door, and a resumed door never grants a row twice.
function stepPendingReward(ctx) {
  const run = ctx.run;
  const cp = run.pendingReward;
  const facts = {
    flaskSlotsFree: Math.max(0, flaskSlotCap(REG.balance) - run.flasks.length),
    armamentSlotsFree: 0,
    armamentRowSettled: !!cp.states.armament,
    chestOptionsSpent: (cp.rewards.chest?.options || []).map((o) => o?.category === 'upgrade' && o.mode === 'owned'
      && !chestUpgradeable(REG, run, run.deck.find((c) => c.instanceId === o.instanceId))),
  };
  const plan = rewardPlan(cp.rewards, facts);
  const next = plan.rows.find((row) => !cp.states[row.key]);
  if (!next) {
    const after = cp.after;
    delete run.pendingReward;
    if (after === 'advanceAct') return advanceAct(ctx);
    return checkpoint(ctx, `${run.mapNodeId}:reward-done`);
  }
  const { take } = resolveContinue({ rows: [next] }, cp.states, 'auto', (n) => ctx.rng.int('cardRewards', 0, n - 1));
  const before = { deck: run.deck.length, relics: run.relics.length, cinders: run.cinders };
  if (take.length && applyRow(ctx, take[0], cp)) cp.states[next.key] = 'taken';
  else cp.states[next.key] = 'skipped';
  if (next.kind === 'card' && cp.states[next.key] === 'taken') assert.equal(run.deck.length, before.deck + 1, `${where(ctx, next.key)} card row landed twice`);
  checkpoint(ctx, `${run.mapNodeId}:${next.key}`);
  if (ctx.reload) {
    // The resumed door reads the row as settled.
    assert.ok(ctx.run.pendingReward.states[next.key], `${where(ctx, next.key)} reload forgot the row's state`);
  }
}

// ---- the map loop -----------------------------------------------------------
function advanceAct(ctx) {
  const run = ctx.run;
  if (run.actNumber >= 3) { ctx.victory = true; return; }
  run.actNumber += 1;
  run.floor = 0; run.mapNodeId = null; run.path = []; run.lastEncounters = [];
  run.hp = run.maxHp;
  run.mapGraph = buildActMap(REG, ctx.rng, seatAtTier(run.seatOrder, run.actNumber), run.actNumber, null, { history: run.history });
  ctx.stats.maxAct = Math.max(ctx.stats.maxAct, run.actNumber);
  checkpoint(ctx, `act${run.actNumber}:start`);
}

function shrine(ctx, node) {
  const run = ctx.run;
  const visit = createLocationVisit({ run, registries: REG, rng: ctx.rng }, node.type === 'event' ? CAMP_LOCATION : 'shrine');
  arriveAt(visit);
  const f = run.flaskCharges;
  if (visit.locationId === 'shrine' && f) {
    assert.ok(f.hpCurrent === f.hp && f.manaCurrent === f.mana, `${where(ctx, node.id)} grace did not refill the vessels ${JSON.stringify(f)}`);
    ctx.stats.graces++;
  }
  if (run.hp < run.maxHp * 0.6 && !visit.restDenied) {
    const hpBefore = run.hp;
    restAt(visit);
    assert.ok(run.hp >= hpBefore && run.hp <= run.maxHp, `${where(ctx, node.id)} rest hp ${hpBefore}→${run.hp}`);
  } else {
    // The shrine's smith (ui/screens/rest.js): the first affordable item upgrade.
    const candidate = smithingPlan(REG, run).candidates.find((c) => c.shortfall === 0);
    if (candidate) {
      const stones = run.smithingStones;
      commitSmithing(REG, run, candidate.itemRef);
      assert.ok(run.smithingStones < stones, `${where(ctx, node.id)} smithing ${candidate.itemRef} cost nothing`);
      ctx.stats.smithed++;
    }
  }
  leaveLocation(visit);
  // The guard counts THIS visit's loop: the shared tally spans every climb,
  // and the ruleset-7 curve (10 XP a step) spends far more points per climb.
  let spent = 0;
  for (let plan = levelUpPlan(REG, run); plan.offerable; plan = levelUpPlan(REG, run)) {
    const attrs = { ...run.attributes };
    applyLevelUp(REG, run, 'constitution');
    assert.ok(run.attributes.constitution >= attrs.constitution, `${where(ctx, node.id)} level-up lowered constitution`);
    ctx.stats.shrineLevelUps++;
    if (++spent > 500) assert.fail(`${where(ctx, node.id)} level-up loop does not converge`);
  }
}

function enterNode(ctx, id) {
  const run = ctx.run;
  const node = run.mapGraph.nodes[id];
  run.mapNodeId = id;
  if (!run.path.includes(id)) run.path.push(id);
  run.floor = node.floor;
  let kind = node.type;
  if (kind === 'event') {
    const res = node.resolved || { kind: 'fight' };
    if (res.kind === 'event') {
      run.seenEvents.push(res.eventId);
      const ev = REG.events.get(res.eventId);
      const offered = availableEventChoices(eventChoicesWithHistory(ev), run).map(({ choice }) => choice);
      const choice = offered.find((c) => !c.requires || (c.requires.cinders || 0) <= run.cinders) || offered[offered.length - 1];
      executeRunEffects({ run, registries: REG, rng: ctx.rng }, choice.effects);
      syncFlaskGrowth(REG, run);
      recordEventChoice(run, { eventId: res.eventId, choiceId: choice.id });
      ctx.stats.events++;
      if (run.hp <= 0) { run.hp = 0; ctx.dead = `event:${res.eventId}`; return; }
      if (run.combatEntered) {
        const encId = typeof run.combatEntered === 'string' ? run.combatEntered : run.combatEntered.encounterId;
        run.combatEntered = null;
        const won = fight(ctx, id, encId);
        if (!won) { ctx.dead = `ambush:${encId}`; return; }
        return beginPendingReward(ctx, won, id);
      }
      return checkpoint(ctx, `${id}:event:${res.eventId}`);
    }
    kind = res.kind;
  }
  if (kind === 'monster' || kind === 'fight' || kind === 'elite' || kind === 'boss') {
    const pool = kind === 'monster' || kind === 'fight' ? 'normal' : kind;
    const seat = seatAtTier(run.seatOrder, run.actNumber);
    const encId = pool === 'boss' ? bossEncounterForNode(REG, run.mapGraph, id, { seat, tier: run.actNumber })
      : rollEncounter(REG, ctx.rng, { pool, seat, exclude: run.lastEncounters });
    if (pool === 'normal') { run.lastEncounters.push(encId); if (run.lastEncounters.length > 2) run.lastEncounters.shift(); }
    const won = fight(ctx, id, encId);
    if (!won) { ctx.dead = `${pool}:${encId}`; return; }
    if (pool === 'boss') {
      ctx.run.bossesBeaten = ctx.run.bossesBeaten || [];
      for (const e of won.enc.enemies) if (!ctx.run.bossesBeaten.includes(e)) ctx.run.bossesBeaten.push(e);
      ctx.stats.bosses++;
      if (ctx.run.actNumber >= 3) { ctx.victory = true; return; }
    }
    return beginPendingReward(ctx, won, id);
  }
  if (kind === 'shrine') shrine(ctx, node);
  else if (kind === 'treasure') {
    const r = rollRelicReward(REG, ctx.rng, run.relics);
    if (r) { run.relics.push(r); syncFlaskGrowth(REG, run); ctx.stats.relicsTaken++; }
  } else if (kind === 'merchant') {
    run.shopStock = buildShopStock(REG, ctx.rng, run);
    checkpoint(ctx, `${id}:shop`);
    const stock = ctx.run.shopStock;
    assert.ok(stock && Array.isArray(stock.cards), `${where(ctx, id)} shop stock lost across the save`);
    const buy = stock.cards.find((c) => c.cost <= ctx.run.cinders);
    if (buy) {
      ctx.run.cinders -= buy.cost;
      joinDeck(REG, ctx.run, { instanceId: `r${ctx.run.deck.length}_${buy.id}`, cardId: buy.id, upgraded: false });
      ctx.stats.purchases++;
    }
    delete ctx.run.shopStock;
  }
  checkpoint(ctx, `${id}:${kind}`);
}

function nextNodeId(ctx) {
  const run = ctx.run;
  const map = run.mapGraph;
  let options = run.mapNodeId ? map.nodes[run.mapNodeId].next : map.startIds;
  if (!options || !options.length) options = map.bossIds || [map.bossId];
  const nodes = options.map((id) => map.nodes[id]);
  const hurt = run.hp < run.maxHp * 0.55;
  // Two pilots, alternating by seed: the runsim pilot (a shrine when hurt,
  // else the first door) and a bold one that takes an elite when healthy so
  // the chest door is walked, else a seed-varied branch so the corpus spreads.
  if (!ctx.bold) return ((hurt && nodes.find((n) => n.type === 'shrine')) || nodes[0]).id;
  const fresh = run.hp > run.maxHp * 0.8;
  return ((hurt && nodes.find((n) => n.type === 'shrine')) || (fresh && nodes.find((n) => n.type === 'elite'))
    || nodes[(run.floor + ctx.seed) % nodes.length]).id;
}

function newCtx(classId, seed, reload, stats) {
  const storage = createMemoryStorage();
  const ctx = {
    classId, seed, reload, storage, saves: createSaveManager(storage), trace: [], stats,
    saveCount: 0, maxLevel: 1, maxXp: 0, victory: false, dead: null,
  };
  return ctx;
}

// Continue a climb from whatever state ctx.run is in, to victory, death or cap.
function playOn(ctx, nodeCap = Infinity) {
  let nodes = 0;
  while (!ctx.victory && !ctx.dead && nodes < nodeCap) {
    if (ctx.run.pendingReward) { stepPendingReward(ctx); continue; }
    if (ctx.run.combatEntered) {
      // A save that stood at a fight's door re-enters it (main.js resumeRun).
      const { nodeId, encounterId } = ctx.run.combatEntered;
      ctx.run.combatEntered = null;
      const won = fight(ctx, nodeId, encounterId);
      if (!won) { ctx.dead = `resume:${encounterId}`; break; }
      beginPendingReward(ctx, won, nodeId);
      continue;
    }
    enterNode(ctx, nextNodeId(ctx));
    nodes++;
  }
}

function playRun(classId, seed, reload, stats, bold) {
  const ctx = newCtx(classId, seed, reload, stats);
  ctx.bold = bold;
  const run = createRunState({ seed, classId, registries: REG });
  run.stats = { fightsWon: 0, damageDealt: 0, damageTaken: 0 };
  run.path = []; run.seenEvents = []; run.lastEncounters = [];
  ctx.run = run;
  ctx.rng = createRng(seed);
  run.seatOrder = drawSeatOrder(REG, ctx.rng);
  run.mapGraph = buildActMap(REG, ctx.rng, seatAtTier(run.seatOrder, 1), 1, null, { history: run.history });
  checkpoint(ctx, 'act1:start');
  playOn(ctx);
  ctx.trace.push({ node: ctx.victory ? 'VICTORY' : `DEAD ${ctx.dead}`, view: '' });
  return ctx;
}

// ---- legacy saves -------------------------------------------------------------
function legacySaves() {
  const read = (p) => readFileSync(new URL(`./fixtures/${p}`, import.meta.url), 'utf8');
  const window = JSON.parse(read('run-save-vigour-window.json'));
  const out = Object.keys(window).filter((k) => !k.startsWith('_')).map((k) => [`vigour-window:${k}`, JSON.stringify(window[k])]);
  const acb = read('run-save-constitution-acb8ffe.json');
  out.push(['constitution-acb8ffe', acb]);
  out.push(['constitution-acb8ffe-as-vigour', acb.replaceAll('"constitution"', '"vigour"')]);
  out.push(['hp-5597166', read('run-save-hp-5597166.json')]);
  return out;
}

test('solo run scenario: seeded solo climbs through acts 1-3 stay valid across save/load and replay', () => {
  const t0 = Date.now();
  const stats = {
    runs: 0, victories: 0, maxAct: 1, fights: 0, bosses: 0, bossChoices: 0, chests: 0, chestsTaken: 0, relicsTaken: 0,
    graces: 0, events: 0, purchases: 0, levelUps: 0, shrineLevelUps: 0, statusOnEnemy: 0, statusOnPlayer: 0,
    artMeters: 0, smithed: 0, artCharged: 0, saves: 0, legacy: 0,
  };
  const classes = REG.classes.all().map((c) => c.id);
  assert.ok(classes.length >= 3, 'every playable class is in the scenario');
  // Structural progress per class, not a balance outcome: how far each climb
  // got (floor, act) and how many fights it resolved, win or lose.
  const progress = {};
  for (const classId of classes) {
    const p = progress[classId] = { climbs: 0, minFights: Infinity, maxFloor: 0, maxAct: 0 };
    for (const [i, seed] of SEEDS.entries()) {
      const bold = i % 2 === 1;
      const fightsBefore = stats.fights;
      const a = playRun(classId, seed, true, stats, bold);
      const fights = stats.fights - fightsBefore;
      assert.ok(a.victory || a.dead, `[${classId} seed ${seed}] the climb ended without a victory or a death`);
      assert.ok(fights >= 1, `[${classId} seed ${seed}] the climb resolved no fight`);
      p.climbs++; p.minFights = Math.min(p.minFights, fights);
      p.maxFloor = Math.max(p.maxFloor, a.run.floor); p.maxAct = Math.max(p.maxAct, a.run.actNumber);
      const b = playRun(classId, seed, false, { ...stats }, bold);
      stats.runs++; stats.saves += a.saveCount;
      if (a.victory) stats.victories++;
      // Determinism + a lossless door: the reload-at-every-step climb and the
      // uninterrupted climb of the same seed are the same climb.
      const diverge = a.trace.findIndex((step, i) => !b.trace[i] || step.node !== b.trace[i].node || step.view !== b.trace[i].view);
      if (diverge !== -1 || a.trace.length !== b.trace.length) {
        const x = a.trace[diverge] || {}; const y = b.trace[diverge] || {};
        const vx = x.view ? JSON.parse(x.view) : {}; const vy = y.view ? JSON.parse(y.view) : {};
        const keys = Object.keys({ ...vx, ...vy }).filter((k) => JSON.stringify(vx[k]) !== JSON.stringify(vy[k]));
        assert.fail(`[${classId} seed ${seed}] the reload climb diverges from the uninterrupted climb at step ${diverge} (${x.node} vs ${y.node}): ${keys.map((k) => `${k}: ${JSON.stringify(vx[k])} vs ${JSON.stringify(vy[k])}`).join('; ').slice(0, 1500)}`);
      }
    }
  }

  // Legacy saves come forward through the migration path and play on.
  for (const [name, bytes] of legacySaves()) {
    const stats2 = { ...stats, maxAct: 0 };
    const ctx = newCtx(`legacy:${name}`, 0, true, stats2);
    ctx.storage.setItem(RUN_KEY, bytes);
    const run = ctx.saves.loadRun(REG);
    assert.ok(run, `[legacy ${name}] loadRun refused a legacy save`);
    assert.deepEqual(validateRunShape(run), [], `[legacy ${name}] validateRunShape after migration`);
    assert.ok(!JSON.stringify(run).includes('"vigour"'), `[legacy ${name}] the retired attribute name survived migration`);
    const old = JSON.parse(bytes);
    for (const k of ['seed', 'class', 'floor', 'actNumber', 'cinders', 'relics']) {
      assert.deepEqual(run[k], old[k], `[legacy ${name}] migration moved player-owned '${k}'`);
    }
    // The player's own cards survive (the load door may add the equipment's
    // generated kit and Art cards, which older builds did not store).
    const kept = new Map(run.deck.map((c) => [c.instanceId, c.cardId]));
    for (const c of old.deck.filter((c) => !c.equipmentRole && !c.sourceArmamentId)) {
      assert.equal(kept.get(c.instanceId), c.cardId, `[legacy ${name}] migration lost card ${c.instanceId}`);
    }
    run.stats ||= { fightsWon: 0, damageDealt: 0, damageTaken: 0 };
    run.path ||= []; run.seenEvents ||= []; run.lastEncounters ||= [];
    ctx.seed = run.seed; ctx.classId = `legacy:${name}:${run.class}`;
    ctx.run = run;
    ctx.rng = createRng(run.seed, run.streamCounters);
    if (!run.mapGraph) {
      run.mapGraph = buildActMap(REG, ctx.rng, seatAtTier(run.seatOrder, run.actNumber), run.actNumber, null, { history: run.history });
    }
    checkpoint(ctx, 'legacy:loaded');
    playOn(ctx, 6);
    stats.legacy++;
  }

  // A save from a NEWER build is refused by name and kept byte for byte: the
  // slot stays occupied and nothing is archived (#1304).
  {
    const ctx = newCtx('newer', 0, true, { ...stats });
    const current = JSON.parse(JSON.stringify(createRunState({ seed: 11, classId: classes[0], registries: REG })));
    ctx.saves.saveRun(current, createRng(11));
    const saved = JSON.parse(ctx.storage.getItem(RUN_KEY));
    const bytes = JSON.stringify({ ...saved, schemaVersion: RUN_SCHEMA_VERSION + 1, fieldOnlyTheNewerBuildKnows: { kept: true } });
    ctx.storage.setItem(RUN_KEY, bytes);
    assert.equal(ctx.saves.loadRun(REG), null, 'a newer-schema save is refused');
    assert.equal(ctx.saves.runStatus().state, 'newer', 'the refusal is named as a newer save, not a corrupt one');
    assert.equal(ctx.storage.getItem(RUN_KEY), bytes, 'the slot still holds the newer build\'s exact bytes');
    assert.equal(ctx.storage.getItem(RUN_ARCHIVE_KEY), null, 'nothing was archived');
  }

  // The boss relic door when the pool is exhausted: nothing is offered, and the
  // game pays consolation cinders instead (SPEC §6.1).
  const allBoss = REG.relics.all().filter((r) => r.rarity === 'boss').map((r) => r.id);
  assert.deepEqual(rollBossRelicChoices(REG, createRng(7), allBoss), [], 'an exhausted boss pool offers nothing');
  assert.ok(REG.balance.rewards.bossRelicConsolationCinders > 0, 'and the consolation is a real payout');

  // The corpus really exercised what it claims to.
  const ms = Date.now() - t0;
  const summary = JSON.stringify({ ...stats, ms, progress });
  for (const [classId, p] of Object.entries(progress)) {
    assert.equal(p.climbs, SEEDS.length, `[${classId}] every seed was climbed: ${summary}`);
    assert.ok(p.maxFloor >= 2, `[${classId}] some climb got past its first floor: ${summary}`);
  }
  assert.ok(stats.victories >= 1 && stats.maxAct === 3, `the corpus reaches act 3 and a boss victory (acts 2-3 doors walked): ${summary}`);
  assert.ok(stats.bosses >= 2 && stats.bossChoices >= 1, `boss doors and relic choices were exercised: ${summary}`);
  assert.ok(stats.chests >= 1 && stats.chestsTaken >= 1, `an elite chest was opened and taken: ${summary}`);
  assert.ok(stats.graces >= 1 && stats.events >= 1 && stats.levelUps >= 1, `graces, events and level-ups happened: ${summary}`);
  assert.ok(stats.statusOnEnemy >= 1, `statuses reached enemies: ${summary}`);
  assert.ok(stats.legacy >= 6, `every legacy fixture came through: ${summary}`);
  console.log(`solo-run scenario: ${summary}`);
});
