import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { attackDescriptor } from '../src/model/attackTags.js';
import { cardEquipmentCompatibility } from '../src/model/loadout.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { foundationCarrier, foundationSource, cardActions, previewFoundationAction } from '../src/engine/combatRules.js';
import { executeAction as applyAction } from '../src/engine/actions.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { withWeaponRack } from './withWeaponRack.mjs';

const regs = createRegistries(withWeaponRack(contentBundle));
function inHand(c, cardId) {
  for (const pile of ['hand', 'draw', 'discard', 'exhaust']) {
    const i = c.piles[pile].findIndex((card) => card.cardId === cardId);
    if (i < 0) continue;
    const [card] = c.piles[pile].splice(i, 1); c.piles.hand.push(card); return card.instanceId;
  }
  throw new Error(`Missing ${cardId}`);
}
const blade = { id: 'sword-copy-with-blood-rune', sourceType: 'weapon', family: 'blade', grip: 'oneHand', weight: 18, damageType: 'slashing', tags: ['theme:blood', 'damage:slashing', 'source:weapon', 'fx:blood'], buildup: [{ status: 'bleed', amount: 1 }] };
const focus = { id: 'focus-copy-with-frost-rune', sourceType: 'spell', family: 'focus', grip: 'oneHand', weight: 3, damageType: 'arcane', tags: ['theme:astral', 'source:spell'], buildup: [{ status: 'frost', amount: 1 }] };
function mixedInput() {
  const input = prototypeInput('caster', 'basic', 123);
  input.combatProfiles.player.sources = { mainHand: structuredClone(blade), offHand: structuredClone(focus) };
  return input;
}
const stored = (c) => JSON.stringify({ snapshot: serializeCombatSnapshot(c), rng: c.rng.getCounters() });

test('every direct card, attack profile and armament has an explicit categorized source', () => {
  for (const card of regs.cards.all()) {
    if (![...card.effects, ...(card.upgrade?.effects || [])].some((e) => e.op === 'damage')) continue;
    for (const effect of [...card.effects, ...(card.upgrade?.effects || [])].filter(e => e.op === 'damage')) {
      assert(attackDescriptor({ ...card, attack: { ...card.attack, ...effect.attack }, tags: effect.tags || card.tags }).source, `card ${card.id} damage effect missing source mapping`);
    }
  }
  for (const profile of regs.equipment.basicCardProfiles.filter((p) => p.role === 'attack')) assert(attackDescriptor(profile).source, profile.id);
  for (const item of regs.equipment.armaments) {
    assert(attackDescriptor(item).source, item.id);
    assert(attackDescriptor(item).damageType, `${item.id} missing damage type`);
  }
});

test('contradictory sources and damage types fail content validation with the card ID', () => {
  for (const extra of ['source:spell', 'damage:fire']) {
    const id = extra === 'source:spell' ? 'gorefireSlash' : 'starstonePebble';
    const b = { ...contentBundle, tagging: [...contentBundle.tagging, { family: 'card', scope: '', objectId: id, tagId: extra }] };
    assert(validateContent(b).errors.some((e) => JSON.stringify(e).includes(id)), `${id} should fail`);
  }
});

test('broad source categories do not grant cross-class equipment permission', () => {
  // This card has no old shared school with the sword. Source and melee alone
  // must not change that even though both are now authored on the pair.
  const r = cardEquipmentCompatibility(regs, { cardId: 'sunderplate', classId: 'starseer', pieceId: 'straightSword' });
  assert.equal(r.ok, false);
});

