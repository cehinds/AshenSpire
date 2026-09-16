import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries, resolveCard } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { attackDescriptor } from '../src/model/attackTags.js';
import { cardEquipmentCompatibility } from '../src/model/loadout.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createCoopCombat, playCard } from '../src/engine/coopCombat.js';
import { foundationCarrier, foundationSource, cardActions, previewFoundationAction } from '../src/engine/combatRules.js';
import { executeAction as applyAction } from '../src/engine/actions.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { createRng } from '../src/engine/rng.js';
import { prototypeInput, prototypeBundle } from '../src/content/prototypes/combatBuilds.js';

const regs = createRegistries(contentBundle);
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
    assert(attackDescriptor(card).source, `card ${card.id} missing source mapping`);
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

test('spell preview and execution use only the offhand focus and its buildup', () => {
  const c = createCombat(mixedInput());
  const id = inHand(c, 'prototypeSpell');
  const before = stored(c);
  const shown = previewCard(c, id, 'e1').values.find((v) => v.op === 'damage');
  assert.equal(stored(c), before);
  assert.equal(shown.sourceInstanceId, focus.id);
  assert(shown.tags.includes('theme:astral'));
  assert(!shown.tags.includes('theme:blood'));
  const result = dispatch(c, { type: 'playCard', cardInstanceId: id, targetId: 'e1' });
  const hit = result.events.find((e) => e.type === 'damageDealt');
  assert.equal(hit.sourceInstanceId, focus.id);
  assert.equal(hit.amount, shown.value);
  assert.deepEqual(hit.tags, shown.tags);
  assert.equal(c.enemies[0].statuses.bleed, undefined);
  assert.equal(c.enemies[0].statuses.frost.meter.value, 1);
});

test('explicit wrong-hand spells fail atomically instead of borrowing the sword', () => {
  const input = mixedInput();
  const bundle = prototypeBundle();
  bundle.cards = bundle.cards.map((c) => c.id === 'prototypeSpell' ? { ...c, attack: { ...c.attack, hand: 'mainHand' } } : c);
  input.registries = createRegistries(bundle);
  const c = createCombat(input), id = inHand(c, 'prototypeSpell'), before = stored(c);
  assert.throws(() => dispatch(c, { type: 'playCard', cardInstanceId: id, targetId: 'e1' }), /No spell source/);
  assert.equal(stored(c), before);
});

test('solo and co-op capture the focus before a resource-spent event changes it', () => {
  for (const coop of [false, true]) {
    const input = mixedInput();
    const c = coop ? createCoopCombat({ ...input, players: [{ ...input.player, id: 'p1' }], combatProfiles: {
      p1: input.combatProfiles.player, e1: input.combatProfiles.e1,
    } }) : createCombat(input);
    const actorId = coop ? 'p1' : 'player';
    const id = inHand(coop ? { piles: c.players.get('p1').piles } : c, 'prototypeSpell');
    const emit = c._emitEvent;
    c._emitEvent = (candidate, type, payload) => {
      if (type === 'energySpent') candidate.foundation.profiles[actorId].sources.offHand = { ...focus, id: 'replacement-focus', buildup: [] };
      return emit(candidate, type, payload);
    };
    const result = coop ? playCard(c, 'p1', id, 'e1') : dispatch(c, { type: 'playCard', cardInstanceId: id, targetId: 'e1' });
    assert.equal(c.foundation.profiles[actorId].sources.offHand.id, 'replacement-focus');
    assert.equal(result.events.find((event) => event.type === 'damageDealt').sourceInstanceId, focus.id);
    assert.equal(c.enemies[0].statuses.frost.meter.value, 1);
  }
});

test('live equipment maps staff, hammer, and left/right hand carriers correctly', () => {
  const input = prototypeInput('heavy', 'basic', 5);
  delete input.combatProfiles.player.sources;
  input.player.loadout = { sets: { rightHand: ['warhammer', 'katana', null], leftHand: ['ashStaff', null], armor: ['default'] }, active: { rightHand: 0, leftHand: 0, armor: 0 } };
  const c = createCombat(input);
  const hammer = foundationSource(c, c.player, { tags: ['source:weapon'], sourceHand: 'right' });
  assert.equal(hammer.itemId, 'warhammer'); assert.equal(hammer.family, 'hammer'); assert.equal(hammer.damageType, 'blunt');
  const spell = foundationSource(c, c.player, { tags: ['source:spell'] });
  assert.equal(spell.itemId, 'ashStaff'); assert.equal(spell.hand, 'offHand');
  c.loadout.active.rightHand = 2;
  const empty = foundationSource(c, c.player, { tags: ['source:weapon'], sourceHand: 'right' });
  assert.equal(empty.sourceType, 'unarmed'); assert.equal(empty.buildup.length, 0);
});

test('real equipment swap refreshes all piles without persisting inherited tags', () => {
  const input = prototypeInput('heavy', 'basic', 5);
  delete input.combatProfiles.player.sources;
  input.player.loadout = { sets: { rightHand: ['katana', 'straightSword', null], leftHand: [null], armor: ['default'] }, active: { rightHand: 0, leftHand: 0, armor: 0 } };
  const c = createCombat(input);
  for (const [i, pile] of ['hand', 'draw', 'discard', 'exhaust'].entries()) c.piles[pile].push({ instanceId: `owned-${i}`, cardId: 'prototypeHeavy', upgraded: i === 3, damageSchool: 'physical', exposureBuildupPerHit: 0 });
  const positions = () => Object.fromEntries(Object.entries(c.piles).map(([pile, cards]) => [pile, cards.filter((x) => x.instanceId.startsWith('owned-'))]));
  const before = JSON.stringify(positions());
  for (let i = 0; i < 4; i++) assert(previewCard(c, `owned-${i}`, 'e1').values[0].tags.includes('theme:blood'));
  dispatch(c, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
  assert.equal(JSON.stringify(positions()), before);
  for (let i = 0; i < 4; i++) assert(!previewCard(c, `owned-${i}`, 'e1').values[0].tags.includes('theme:blood'));
  assert(!JSON.stringify(positions()).includes('tags'));
});

test('paid multi-hit actions hold a source snapshot and do not reread changed equipment', () => {
  const input = prototypeInput('bleed', 'basic', 123);
  input.combatProfiles.player.sources.mainHand = structuredClone(blade);
  const c = createCombat(input);
  const def = resolveCard(c.registries, { cardId: 'prototypeFast' });
  const actions = cardActions(c, def, c.player, c.enemies[0], { cardId: def.id, tags: def.tags, attack: def.attack }, { energySpent: 1 });
  c.foundation.profiles.player.sources.mainHand = { ...blade, id: 'replacement', buildup: [], tags: [] };
  for (const action of actions) applyAction(c, action);
  assert.equal(c.enemies[0].statuses.bleed.meter.value, 2);
  assert(c.eventLog.filter((e) => e.type === 'damageDealt').every((e) => e.sourceInstanceId === blade.id));
});

test('source themes do not fabricate ailments or replace explicit damage components', () => {
  const input = prototypeInput('heavy', 'basic', 6);
  input.combatProfiles.player.sources.mainHand = { ...blade, buildup: [] };
  const c = createCombat(input);
  const carrier = foundationCarrier(c, c.player, { tags: ['delivery:projectile'], attack: { source: 'weapon', components: [{ type: 'slashing', weight: 2 }, { type: 'fire', weight: 1 }] } });
  assert(carrier.tags.includes('theme:blood'));
  assert(carrier.tags.includes('damage:fire'));
  assert(!carrier.tags.some((tag) => tag.startsWith('fx:')));
  const id = inHand(c, 'prototypeHeavy');
  dispatch(c, { type: 'playCard', cardInstanceId: id, targetId: 'e1' });
  assert.equal(c.enemies[0].statuses.bleed, undefined);
});

test('save restoration preserves source ownership and exact-preview behavior', () => {
  const c = createCombat(mixedInput()), id = inHand(c, 'prototypeSpell');
  const copy = restoreCombatSnapshot({ registries: c.registries, rng: createRng(c.rng.seed, c.rng.getCounters()), snapshot: serializeCombatSnapshot(c) });
  const intent = { type: 'playCard', cardInstanceId: id, targetId: 'e1' };
  const expected = previewFoundationAction(copy, (draft) => dispatch(draft, intent)).result;
  assert.deepEqual(dispatch(c, intent), expected);
  assert.deepEqual(dispatch(copy, intent), expected);
});

test('co-op spells inherit from their own focus rather than another seat or their sword', () => {
  const input = mixedInput();
  const c = createCoopCombat({ ...input, players: [{ ...input.player, id: 'p1' }, { ...input.player, id: 'p2' }], combatProfiles: {
    p1: input.combatProfiles.player,
    p2: { ...input.combatProfiles.player, sources: { offHand: { ...focus, id: 'p2-focus', buildup: [] } } }, e1: input.combatProfiles.e1,
  } });
  for (const playerId of ['p1', 'p2']) {
    const id = inHand({ piles: c.players.get(playerId).piles }, 'prototypeSpell');
    playCard(c, playerId, id, 'e1');
  }
  const hits = c.eventLog.filter((e) => e.type === 'damageDealt' && e.sourcePlayerId);
  assert.deepEqual(hits.map((e) => [e.sourcePlayerId, e.sourceInstanceId]), [['p1', focus.id], ['p2', 'p2-focus']]);
  assert.equal(c.enemies[0].statuses.bleed, undefined);
  assert.equal(c.enemies[0].statuses.frost.meter.value, 1);
});
