// src/model/loadout/applyVocab.js — the two `apply` vocabularies (card mods and run mods) and the pool-moving helper.
// A part of src/model/loadout.js (split from one file; behaviour unchanged).

//
// equipMods.csv's header has always called `apply` a closed set and NOTHING HAS
// EVER CHECKED IT. `validateEquipment` checks the field name, the scope and the
// status; a row reading `apply=swapcost` or `apply=maxhp` passes every one of
// those, is collected by neither `cardMods` nor `runMods`, and does nothing —
// silently, forever. That is a legal-looking entry with a wrong-but-reasonable
// result, which is the failure Law 0 clause 5 names as the dangerous one.
//
// So the vocabulary lives beside its consumers, and each list is the set of
// values the function two hundred lines below actually branches on. A new
// `apply` is a WORD, not a row: it means teaching a consumer something, and the
// validator goes red until one has been taught (Law 0 clause 2).
export const CARD_MOD_APPLIES = Object.freeze(['amount', 'hits', 'cost', 'scale', 'status']);
export const EQUIPMENT_POOL_FIELDS = Object.freeze(['maxHp', 'maxMana', 'maxStamina']);
export const RUN_MOD_APPLIES = Object.freeze([...EQUIPMENT_POOL_FIELDS, 'startStatus', 'swapCost']);
export const EQUIPMENT_POOL_CURRENT = Object.freeze({ maxHp: 'hp', maxMana: 'mana', maxStamina: 'stamina' });

/** Move one maximum while retaining deficit that may exceed the smaller vessel. */
export function moveEquipmentPool(holder, maxField, nextMax, carriedDeficit = undefined) {
  const currentField = EQUIPMENT_POOL_CURRENT[maxField];
  if (!currentField || !Number.isFinite(holder[maxField]) || !Number.isFinite(holder[currentField])) {
    throw new Error(`moveEquipmentPool requires finite ${maxField}/${currentField}`);
  }
  const oldMax = holder[maxField];
  const surplus = currentField === 'stamina' ? Math.max(0, holder[currentField] - oldMax) : 0;
  const observedDeficit = Math.max(0, oldMax - holder[currentField]);
  const priorDeficit = Number.isInteger(carriedDeficit) && carriedDeficit >= 0 ? carriedDeficit : observedDeficit;
  // A hidden deficit can be larger than a temporarily shrunken vessel. Account
  // for spending/healing since the prior equipment move before resizing again.
  const representedDeficit = Math.min(priorDeficit, oldMax);
  const deficit = Math.max(0, priorDeficit + observedDeficit - representedDeficit);
  holder[maxField] = nextMax;
  holder[currentField] = Math.max(0, nextMax - deficit) + surplus;
  return deficit;
}
