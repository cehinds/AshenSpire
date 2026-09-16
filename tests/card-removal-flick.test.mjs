import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { createRunState, validateRunShape } from '../src/model/state.js';
import { removeDeckCard, canRemoveDeckCard, retiredAttackSlots } from '../src/model/cardRemoval.js';
import { stampDeck } from '../src/model/loadout.js';
import { createCombat, dispatch } from '../src/engine/combat.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createSaveManager, createMemoryStorage } from '../src/engine/save.js';
import { createRng } from '../src/engine/rng.js';
import { flickPreferences, flickVerdict, nearestFlickTarget } from '../src/ui/models/TouchFlickModel.js';

export function runCardRemovalFlickTests() {
  let checks = 0;
  const check = (value, message) => { assert.ok(value, message); checks++; };
  const rules = contentBundle.balance.ui.touchFlick;
  const start = { x: 90, y: 700, time: 0 };
  const end = { x: 100, y: 630, time: 100 };
  const verdict = (point = end, settings = {}) => flickVerdict(start, point, [start, end], settings, rules);
  check(verdict().qualifies, 'a short intentional upward flick qualifies');
  check(!verdict(end, { touchFlickPlay: false }).qualifies, 'disabled stays disabled');
  check(!verdict(end, { touchFlickDistance: 160 }).qualifies, 'live distance changes recognition');
  check(verdict({ x: 90, y: 668, time: 80 }, { touchFlickDistance: 32 }).qualifies, 'minimum configured distance is usable');
  check(!verdict({ x: 90, y: 690, time: 100 }).qualifies, 'small tap movement is not play');
  check(!verdict({ x: 90, y: 730, time: 100 }).qualifies, 'downward release is not play');
  check(!verdict({ x: 180, y: 630, time: 100 }).qualifies, 'sideways hand movement is not play');
  check(!verdict({ ...end, time: 500 }).qualifies, 'pausing above threshold is not a flick');
  check(!flickVerdict(start, { x: 90, y: 645, time: 110 }, [start, end], {}, rules).qualifies, 'reversing toward hand cancels');
  check(flickPreferences({ touchFlickDistance: NaN }, rules).distance === 64, 'invalid settings fall back');
  check(flickPreferences({ touchFlickDistance: 999 }, rules).distance === 160, 'settings clamp to the upper bound');
  check(nearestFlickTarget([{ id: 'b', x: 0, y: 0 }, { id: 'a', x: 2, y: 0 }], { x: 1, y: 0 }).id === 'a', 'equidistant targets have a stable tie-break');
  check(nearestFlickTarget([], end) === null, 'no legal target returns none');

  const registries = createRegistries(contentBundle);
  const run = createRunState({ seed: 671, classId: 'reaver', registries });
  const attacks = run.deck.filter(card => card.equipmentAttackSlotId);
  const retired = attacks[1];
  check(removeDeckCard(run, retired.instanceId, { keepOne: true }), 'merchant can remove a middle basic attack');
  check(!removeDeckCard(run, retired.instanceId), 'stale instance cannot be removed twice');
  const survivorIds = run.deck.filter(c => c.equipmentAttackSlotId).map(c => c.equipmentAttackSlotId);
  run.loadout.sets.rightHand[1] = 'dagger';
  stampDeck(registries, run);
  check(JSON.stringify(run.deck.filter(c => c.equipmentAttackSlotId).map(c => c.equipmentAttackSlotId)) === JSON.stringify(survivorIds), 'restamp preserves surviving identities');
  const saves = createSaveManager(createMemoryStorage());
  saves.saveRun(run, createRng(671));
  const loaded = saves.loadRun(registries);
  check(loaded && loaded.removedAttackSlotIds.includes(retired.equipmentAttackSlotId), 'run save/load retains removal');
  stampDeck(registries, loaded);
  check(!loaded.deck.some(c => c.instanceId === retired.instanceId), 'load does not resurrect removed copy');
  const combat = createCombat({ registries, rng: createRng(671), enemyIds: [contentBundle.enemies[0].id], player: {
    classId: loaded.class, attributes: loaded.attributes, maxHp: loaded.maxHp, hp: loaded.hp,
    maxMana: loaded.maxMana, mana: loaded.mana, maxStamina: loaded.maxStamina, stamina: loaded.stamina,
    energyMax: loaded.energyMax, drawPerTurn: loaded.drawPerTurn, damageBySchoolAdd: loaded.damageBySchoolAdd,
    equipmentProfileRuleSnapshot: loaded.equipmentProfileRuleSnapshot, equipmentAttackSlotCount: loaded.equipmentAttackSlotCount,
    removedAttackSlotIds: loaded.removedAttackSlotIds, equipmentPoolDeficits: loaded.equipmentPoolDeficits,
    itemUpgradeLevels: loaded.itemUpgradeLevels, deck: loaded.deck, relicIds: loaded.relics,
    flasks: loaded.flasks, flaskCharges: loaded.flaskCharges, loadout: loaded.loadout,
  } });
  dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
  const snapshot = serializeCombatSnapshot(combat);
  loaded.combatEntered = { nodeId: 'n1', encounterId: 'e1', snapshot };
  saves.saveRun(loaded, createRng(671));
  const resumed = saves.loadRun(registries);
  check(!!resumed && resumed.removedAttackSlotIds.includes(retired.equipmentAttackSlotId), 'saved fight passes the run migration and load door');
  const restored = restoreCombatSnapshot({ registries, rng: createRng(671), snapshot });
  restored.player.energy = 10; // isolate slot persistence from the second swap's resource cost
  dispatch(restored, { type: 'swapArmament', slotId: 'rightHand', setIndex: 0 });
  const combatCards = Object.values(restored.piles).flat().filter(c => c?.equipmentAttackSlotId);
  check(combatCards.length === attacks.length - 1 && !combatCards.some(c => c.equipmentAttackSlotId === retired.equipmentAttackSlotId), 'combat save and swaps keep the slot retired');
  for (const card of [...loaded.deck].filter(c => c.equipmentAttackSlotId)) removeDeckCard(loaded, card.instanceId);
  stampDeck(registries, loaded);
  check(loaded.deck.every(c => !c.equipmentAttackSlotId), 'removing all attacks leaves an intentional zero');
  check(!canRemoveDeckCard({ grantedBy: 'armament/sword' }), 'item-owned grants remain protected');
  check(!removeDeckCard({ deck: [{ instanceId: 'only' }] }, 'only', { keepOne: true }), 'merchant cannot remove the final card');
  check(validateRunShape({ ...loaded, removedAttackSlotIds: ['attack:999'] }).some(p => p.includes('removedAttackSlotIds')), 'invalid retired slots are rejected at save validation');
  assert.throws(() => retiredAttackSlots(4, ['attack:0', 'attack:0'])); checks++;
  return { checks };
}
