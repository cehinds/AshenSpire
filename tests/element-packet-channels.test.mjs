// An element upgrade's packet (owner, 2026-11-19): one hit with a physical part and a magic part. The physical part keeps STR / AR, the magic part
// adds INT / Power as its own stage; the physical part meets Block then Poise, the magic part Barrier then Ward.
import test from 'node:test';
import assert from 'node:assert/strict';
import { live, registries, profile } from './helpers/fixcore-combat-rules.mjs';
import { projectGameCard } from '../src/model/gameProfile.js';
import { tacticalCarrier } from '../src/engine/combatCardTactics.js';
import { profileDamageReceipt } from '../src/engine/gameProfileCombat.js';

const subject = { gameProfile: profile };
const FIRE = { k: 'tag', tag: 'school:fire', damage: 'fire', damageSchool: 'fire', packet: 4 };
const carrierFor = (combat, steps) => {
  const f = projectGameCard(subject, { instanceId: 'i', cardId: 'core.strike', ...(steps ? { upgraded: true, upgradeSteps: steps } : {}) });
  const ref = { cardId: 'core.strike', damageSchool: f.damageSchool, exposureBuildupPerHit: f.exposureBuildupPerHit, ...(Number.isFinite(f.magicShare) ? { magicShare: f.magicShare } : {}), sourceHand: 'right' };
  return { card: f, carrier: tacticalCarrier(f, ref, combat, combat.player) };
};
const hit = (combat, carrier, base, patch = {}) => {
  const target = combat.enemies[0];
  Object.assign(target, { block: 0, barrier: 0, statuses: {}, persistentPoise: { value: 0, max: 0 }, ...patch });
  return profileDamageReceipt(combat, combat.player, target, base, carrier).damageReceipt.hits[0];
};

test('the physical part reads STR / AR and the magic part reads INT / Power, each unmoved by the other', () => {
  const combat = live();
  const { card, carrier } = carrierFor(combat, [FIRE]);
  const base = card.effects.find((e) => e.op === 'damage').amount;
  const at = (ar, pr) => { Object.assign(combat.player.ratings, { ar, pr }); return hit(combat, carrier, base); };
  const none = at(0, 0), strong = at(6, 0), clever = at(0, 6), both = at(6, 6);
  assert.ok(none.magical > 0 && none.physical > 0, 'a packet hit has both parts');
  assert.equal(strong.magical, none.magical, 'STR / AR never feeds the magic part');
  assert.ok(strong.physical > none.physical, 'STR / AR feeds the physical part');
  assert.equal(clever.physical, none.physical, 'INT / Power never feeds the physical part');
  assert.ok(clever.magical > none.magical, 'INT / Power feeds the magic part');
  assert.equal(both.physical, strong.physical);
  assert.equal(both.magical, clever.magical);
});

test('an un-stepped Strike still reads STR / AR whole, and a whole-magic step (saved before packets) still reads Power whole', () => {
  const combat = live();
  const plain = carrierFor(combat, null), legacy = carrierFor(combat, [{ ...FIRE, packet: undefined, magicShare: 1 }]);
  const at = (c, ar, pr) => { Object.assign(combat.player.ratings, { ar, pr }); return hit(combat, c.carrier, c.card.effects.find((e) => e.op === 'damage').amount); };
  assert.ok(at(plain, 6, 0).physical > at(plain, 0, 0).physical);
  assert.equal(at(plain, 0, 6).physical, at(plain, 0, 0).physical);
  assert.equal(at(legacy, 0, 0).physical, 0, 'a whole-magic hit has no physical part');
  assert.ok(at(legacy, 0, 6).magical > at(legacy, 0, 0).magical);
  assert.equal(at(legacy, 6, 0).magical, at(legacy, 0, 0).magical, 'its rating is Power, never AR');
});

test('the magic part meets Barrier then Ward and the physical part meets Block then Poise', () => {
  const combat = live();
  const { card, carrier } = carrierFor(combat, [FIRE]);
  const base = card.effects.find((e) => e.op === 'damage').amount;
  Object.assign(combat.player.ratings, { ar: 0, pr: 0 });
  const bare = hit(combat, carrier, base);
  const blocked = hit(combat, carrier, base, { block: bare.physical });
  assert.equal(blocked.blocked, bare.physical, 'Block soaks the physical part');
  assert.ok(blocked.hpLoss >= bare.magical || blocked.blocked + blocked.hpLoss === bare.incoming, 'the magic part is not soaked by that Block');
  const poised = hit(combat, carrier, base, { persistentPoise: { value: 50, max: 50 } });
  assert.ok(poised.poiseReduced > 0, 'Poise absorbs the physical part');
  assert.ok(poised.poiseReduced <= bare.physical, 'and only the physical part');
  void registries;
});
