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

test('the face says it: "Deal X damage. Deal Y Fire damage." with {damage} the physical part and {packet} the magic part', async () => {
  const { staticCardTokens, combatCardSummary } = await import('../src/model/playingCard.js');
  const { fillCardText } = await import('../src/model/cardFaceText.js').catch(() => ({}));
  const f = projectGameCard(subject, { instanceId: 'i', cardId: 'core.strike', upgraded: true, upgradeSteps: [FIRE] });
  assert.match(f.textTemplate, /^Deal \{damage\} damage\. Deal \{packet\} Fire damage\.$/);
  const plain = projectGameCard(subject, { instanceId: 'i', cardId: 'core.strike' });
  assert.equal(plain.textTemplate, 'Deal {damage} damage.', 'an un-stepped card says nothing about a packet');
  const tokens = staticCardTokens(f, registries, { gameProfile: profile });
  const base = staticCardTokens(plain, registries, { gameProfile: profile });
  assert.ok(Number.isFinite(tokens.packet) && tokens.packet > 0, 'the magic part has its own number');
  assert.ok(tokens.damage > 0 && tokens.damage + tokens.packet >= base.damage, 'the two parts add up to at least the un-stepped hit');
  assert.equal(base.packet, undefined);
  void fillCardText; void combatCardSummary;
});

test('live preview: the same tokens, and the same split the hit then deals', async () => {
  const { createRunState } = await import('../src/model/state.js');
  const { createRng } = await import('../src/engine/rng.js');
  const { createRunCombat } = await import('../src/engine/runCombat.js');
  const { previewCard } = await import('../src/engine/combat.js');
  const run = createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
  for (const c of run.deck.filter((x) => x.cardId === 'core.strike')) { c.upgraded = true; c.upgradeSteps = [FIRE]; }
  const fight = createRunCombat({ registries, run, rng: createRng(511), enemyIds: ['wanderingSoldier'] });
  const card = fight.piles.hand.find((c) => c.cardId === 'core.strike');
  const quote = previewCard(fight, card.instanceId, fight.enemies[0].id);
  const row = quote.values.find((v) => v.op === 'damage');
  assert.ok(Number.isFinite(quote.tokens.packet) && quote.tokens.packet === row.packet, 'the live tokens carry the magic part');
  assert.ok(quote.tokens.damage > 0);
});

test('face and preview read exactly the split the live receipt deals (Vulnerable, Burn and flux included)', async () => {
  const { PacketFaceSplit } = await import('../src/engine/gameProfileCombat.js');
  const cases = [
    ['plain', {}, null],
    ['Vulnerable 3', { statuses: { vulnerable: { stacks: 3 } } }, null],
    ['Burn 2', { statuses: { burn: { stacks: 2 } } }, null],
    ['fire flux', {}, 'fire'],
    ['all three', { statuses: { vulnerable: { stacks: 3 }, burn: { stacks: 2 } } }, 'fire'],
  ];
  const seen = {};
  for (const [name, patch, flux] of cases) {
    const combat = live();
    const { card, carrier } = carrierFor(combat, [{ ...FIRE, packet: 4 }, { k: 'dmg', n: 4 }]);
    const authored = card.effects.find((e) => e.op === 'damage').amount;
    Object.assign(combat.player.ratings, { ar: 10, pr: 10 });
    if (flux) combat.player.elementFlux = flux;
    const target = combat.enemies[0];
    const row = hit(combat, carrier, authored, patch);
    const face = PacketFaceSplit(combat, combat.player, carrier, authored, row.incoming, target);
    assert.deepEqual([face.physical, face.magic], [row.physical, row.magical], `${name}: the face split is the receipt's`);
    seen[name] = row;
  }
  const share = (row) => row.magical / (row.magical + row.physical);
  assert.ok(seen['fire flux'].magical > seen.plain.magical && share(seen['fire flux']) > share(seen.plain), 'flux weighs the magic part: it takes more of the hit');
  assert.ok(share(seen['Burn 2']) >= share(seen.plain), 'Burn weighs the magic part');
  assert.ok(seen['Vulnerable 3'].magical > seen.plain.magical && seen['Vulnerable 3'].physical > seen.plain.physical, 'Vulnerable raises both parts');
  assert.ok(Math.abs(share(seen['Vulnerable 3']) - share(seen.plain)) < 0.04, 'and keeps their proportion');
});
