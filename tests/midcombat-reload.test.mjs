// SPEC §9 M2 — "reload restores exactly" and "abandoning mid-combat restarts
// that combat", as one named headless test.
//
// What already covered neighbours of this (and why it was not enough):
//   · engine test 13 round-trips a bare createRunState (no map) through
//     saveRun/loadRun;
//   · engine test 75 restores an EXPLICIT Save Game snapshot and resumes the
//     committed turn — the opposite branch of enterCombat;
//   · nothing drove the entry receipt: enter a fight the way main.js does,
//     play some cards, walk away without saving, and load the slot.
//
// main.js cannot be imported headless (it mounts the DOM), so `enterCombat`
// below mirrors main.js enterCombat's non-UI half line for line: the entry
// receipt, the persist BEFORE the fight is built, and the createCombat player
// literal. The reload mirrors loadActiveSlot: loadRun → createRng(seed,
// streamCounters) → enterCombat(..., { resuming: true }).
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState } from '../src/model/state.js';
import { resolveHandRules } from '../src/model/handRules.js';
import { runMods, resolveSwapCostRule } from '../src/model/loadout.js';
import { seatAtTier, seatTierHpMult } from '../src/model/seats.js';
import { createRng, seedToString } from '../src/engine/rng.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { buildActMap, drawSeatOrder } from '../src/engine/actmap.js';
import { rollEncounter } from '../src/engine/encounters.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';

const SEED = 0x2b0d;
const registries = createRegistries(contentBundle);

// newRun → startClimb, minus the screens: the same fields main.js stamps, the
// same stream order (seats, then map), and the same persist.
function newSeededRun(saves) {
  saves.ensureProfile();
  const run = createRunState({ seed: SEED, classId: 'reaver', registries, profileMeta: saves.loadMeta() });
  run.seedString = seedToString(SEED);
  run.customization = { name: 'Forsaken', glyph: '⚔', tint: 'gold' };
  run.custom = { ascension: 0, mods: {}, deckMode: 'standard' };
  run.stats = { fightsWon: 0, damageDealt: 0, damageTaken: 0 };
  run.path = [];
  run.seenEvents = [];
  run.lastEncounters = [];
  const rng = createRng(SEED);
  run.seatOrder = drawSeatOrder(registries, rng, { firstSeat: null });
  run.mapGraph = buildActMap(registries, rng, seatAtTier(run.seatOrder, run.actNumber), run.actNumber, null, { history: run.history });
  saves.saveRun(run, rng);
  return { run, rng };
}

// main.js enterCombat, non-UI half. Returns the live combat.
function enterCombat(saves, run, rng, nodeId, encounterId, { resuming = false } = {}) {
  const storedSnapshot = resuming ? run.combatEntered?.snapshot : null;
  const savedSnapshot = storedSnapshot && !storedSnapshot.result ? storedSnapshot : null;
  run.combatEntered = { nodeId, encounterId, ...(savedSnapshot ? { snapshot: savedSnapshot } : {}) };
  if (!resuming) saves.saveRun(run, rng);
  const enc = registries.encounters.get(encounterId);
  if (savedSnapshot) return restoreCombatSnapshot({ registries, rng, snapshot: savedSnapshot });
  const seat = seatAtTier(run.seatOrder, run.actNumber);
  return createCombat({
    ratingsRules: registries.balance.combatRatings || null,
    handRules: resolveHandRules(saves.loadMeta().settings || {}, contentBundle.attributes),
    registries,
    rng,
    player: {
      classId: run.class, attributes: run.attributes, derivedStatRuleSnapshot: run.derivedStatRuleSnapshot,
      skills: run.skills, coreTags: run.coreTags,
      maxHp: run.maxHp, hp: run.hp, maxMana: run.maxMana, mana: run.mana,
      maxStamina: run.maxStamina, stamina: run.stamina,
      energyMax: run.energyMax, drawPerTurn: run.drawPerTurn,
      damageBySchoolAdd: run.damageBySchoolAdd,
      equipmentProfileRuleSnapshot: run.equipmentProfileRuleSnapshot,
      equipmentAttackSlotCount: run.equipmentAttackSlotCount,
      removedAttackSlotIds: run.removedAttackSlotIds,
      equipmentPoolDeficits: run.equipmentPoolDeficits,
      itemUpgradeLevels: run.itemUpgradeLevels, itemMounts: run.itemMounts, armamentLevels: run.armamentLevels,
      deck: run.deck, relicIds: run.relics, flasks: run.flasks, flaskCharges: run.flaskCharges,
      loadout: run.loadout,
    },
    enemyIds: enc.enemies,
    hpMult: seatTierHpMult(registries, seat, run.actNumber),
    enemyStatuses: [],
    swapCostRule: resolveSwapCostRule(registries, saves.loadMeta()),
    playerStatuses: [...runMods(registries, run.loadout, run.class).startStatuses],
  });
}

// startFight('normal', nodeId) on the classic map: the roll and the
// lastEncounters bookkeeping happen BEFORE the entry persist, as in main.js.
function startNormalFight(saves, run, rng) {
  const nodeId = Object.keys(run.mapGraph.nodes).find((id) => run.mapGraph.nodes[id].floor === 1 && run.mapGraph.nodes[id].type === 'monster')
    || Object.keys(run.mapGraph.nodes).find((id) => run.mapGraph.nodes[id].type === 'monster');
  assert.ok(nodeId, 'the seeded map has a monster node to walk into');
  run.mapNodeId = nodeId;
  run.path.push(nodeId);
  run.floor = run.mapGraph.nodes[nodeId].floor;
  const encounterId = rollEncounter(registries, rng, { pool: 'normal', seat: seatAtTier(run.seatOrder, run.actNumber), exclude: run.lastEncounters });
  run.lastEncounters.push(encounterId);
  return { nodeId, encounterId, combat: enterCombat(saves, run, rng, nodeId, encounterId) };
}

function playOneCard(combat) {
  const target = combat.enemies.find((enemy) => enemy.alive !== false && enemy.hp > 0);
  for (const card of combat.piles.hand) {
    const before = combat.piles.hand.length;
    dispatch(combat, { type: 'playCard', cardInstanceId: card.instanceId, targetId: target.instanceId });
    if (combat.piles.hand.length < before) return card.instanceId;
  }
  throw new Error(`no card in the opening hand could be played: [${combat.piles.hand.map((c) => c.cardId).join(', ')}]`);
}

const view = (combat) => ({
  turn: combat.turn,
  phase: combat.phase,
  enemies: combat.enemies.map((enemy) => ({ id: enemy.enemyId, hp: enemy.hp, maxHp: enemy.maxHp })),
  hand: combat.piles.hand.map((card) => card.instanceId),
  draw: combat.piles.draw.map((card) => card.instanceId),
  discard: combat.piles.discard.map((card) => card.instanceId),
  playerHp: combat.player.hp,
  counters: combat.rng.getCounters(),
});

const withoutTimestamps = (run) => {
  const copy = JSON.parse(JSON.stringify(run));
  delete copy.savedAt;
  return copy;
};

test('M2: a save → load round trip on the map restores the run exactly (minus timestamps)', () => {
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  const { run, rng } = newSeededRun(saves);
  const loaded = saves.loadRun(registries);
  assert.ok(loaded, 'the map-state save loads');
  assert.deepEqual(withoutTimestamps(loaded), withoutTimestamps(run));
  assert.deepEqual(loaded.streamCounters, rng.getCounters(), 'the stream counters persist exactly');
  assert.deepEqual(createRng(loaded.seed, loaded.streamCounters).getCounters(), rng.getCounters(),
    'the reloaded rng continues from the same place');
});

test('M2: abandoning mid-combat without saving restarts that combat at turn 1 from the entry receipt', () => {
  const storage = createMemoryStorage();
  const saves = createSaveManager(storage);
  const { run, rng } = newSeededRun(saves);
  const deckAtEntry = structuredClone(run.deck);
  const hpAtEntry = run.hp;
  const { nodeId, encounterId, combat } = startNormalFight(saves, run, rng);
  const opening = view(combat);
  assert.equal(opening.turn, 1, 'a fresh fight opens on turn 1');
  assert.equal(opening.playerHp, hpAtEntry, 'the fight opens at the run HP');

  playOneCard(combat);
  playOneCard(combat);
  assert.notDeepEqual(view(combat).hand, opening.hand, 'two cards left the opening hand');

  // Walk away: no Save Game, no commitCombatSnapshot. Everything in memory is
  // gone; only the slot survives. This is loadActiveSlot's order.
  const reloaded = saves.loadRun(registries);
  assert.ok(reloaded, 'the slot written at combat entry loads');
  assert.deepEqual(reloaded.combatEntered, { nodeId, encounterId },
    'the slot holds the entry receipt only — no exact snapshot was ever committed');
  assert.equal(reloaded.hp, hpAtEntry, 'player HP is the value at combat entry');
  assert.deepEqual(reloaded.deck, deckAtEntry, 'the deck is the deck at combat entry');
  const reloadRng = createRng(reloaded.seed, reloaded.streamCounters);
  const restarted = enterCombat(saves, reloaded, reloadRng, reloaded.combatEntered.nodeId, reloaded.combatEntered.encounterId, { resuming: true });

  const again = view(restarted);
  assert.equal(again.turn, 1, 'the restarted fight is on turn 1');
  assert.deepEqual(again.enemies, opening.enemies, 'the same enemies roll the same HP');
  assert.deepEqual(again.hand, opening.hand, 'the opening hand is drawn in the same order');
  assert.deepEqual(again.draw, opening.draw, 'the draw pile is shuffled identically');
  assert.deepEqual(again.discard, [], 'nothing played before the abandon is in the discard pile');
  assert.equal(again.playerHp, hpAtEntry, 'player HP is restored to the entry value');
  assert.deepEqual(again.counters, opening.counters, 'the restart consumed exactly the draws the first entry did');
});
