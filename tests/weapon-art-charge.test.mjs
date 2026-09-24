// tests/weapon-art-charge.test.mjs — SPEC §12.2.1, the Weapon Art charge
// meter: accrual, cap, stagger credit, unleash and its spend, per-weapon
// swap behaviour, snapshot round-trip and old-snapshot load, and the content
// door that refuses a malformed unleashed form.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { validateContent } from '../src/model/validate.js';
import { createRunState } from '../src/model/state.js';
import { startingDeckRefs, stampDeck } from '../src/model/loadout.js';
import { artChargeMax, artChargeView, artUnleashFor } from '../src/model/artCharge.js';
import { createCombat, dispatch, previewCard } from '../src/engine/combat.js';
import { createRng } from '../src/engine/rng.js';
import { serializeCombatSnapshot, restoreCombatSnapshot } from '../src/engine/combatSnapshot.js';
import { assertCombatSnapshot } from '../src/model/combatSnapshot.js';

const registries = createRegistries(contentBundle);
const rules = contentBundle.balance.weaponArtCharge;

function fight({ right = 'greatsword', rightSets = null, left = null, seed = 812 } = {}) {
  const run = createRunState({ seed, classId: 'reaver', registries });
  run.loadout.active.rightHand = 0;
  run.loadout.sets.rightHand = rightSets ? [...rightSets] : [right, null, null];
  run.loadout.active.leftHand = 0;
  run.loadout.sets.leftHand[0] = left;
  run.deck = startingDeckRefs(registries, run.loadout, 'reaver').map((ref, i) => ({ ...ref, instanceId: `art-charge:${i}`, upgraded: false }));
  run.equipmentAttackSlotCount = run.deck.filter((c) => c.equipmentRole === 'attack').length;
  stampDeck(registries, run);
  const combat = createCombat({ registries, rng: createRng(seed), enemyIds: ['wanderingSoldier'], player: {
    ...structuredClone(run), classId: run.class, relicIds: run.relics, loadout: run.loadout,
  } });
  // Tough, unstaggerable-by-default targets so a test controls every fill.
  for (const enemy of combat.enemies) { enemy.hp = enemy.maxHp = 999; if (enemy.poiseMeter) enemy.poiseMeter.max = 999; }
  return combat;
}

const everyCard = (combat) => Object.values(combat.piles).flat();

function play(combat, pred) {
  const ref = everyCard(combat).find(pred);
  assert.ok(ref, 'the card to play is somewhere in the fight');
  for (const pile of Object.values(combat.piles)) { const i = pile.indexOf(ref); if (i >= 0) pile.splice(i, 1); }
  combat.piles.hand.push(ref);
  combat.player.energy = 20;
  combat.player.stamina = combat.player.maxStamina;
  combat.player.mana = combat.player.maxMana;
  const { events } = dispatch(combat, { type: 'playCard', cardInstanceId: ref.instanceId, targetId: combat.enemies[0].id });
  return { ref, events };
}

const kitAttack = (weaponId) => (c) => c.kitRole === 'attack' && c.grantedBy === weaponId;
const artOf = (weaponId) => (c) => c.equipmentRole === 'weaponArt' && c.grantedBy === weaponId;

test('a fight starts with every meter empty, sized from balance data', () => {
  const combat = fight();
  assert.deepEqual(combat.artCharge, {});
  assert.equal(artChargeMax(registries, 'greatsword'), rules.maxByWeapon.greatsword);
  assert.equal(artChargeMax(registries, 'katana'), rules.defaultMax);
  const [row] = artChargeView(combat);
  assert.equal(row.weaponId, 'greatsword');
  assert.equal(row.value, 0);
  assert.equal(row.full, false);
});

test('each hit with the weapon\'s own cards charges its meter, the Art itself never does, and the cap holds', () => {
  const combat = fight();
  const max = artChargeMax(registries, 'greatsword');
  const { events } = play(combat, kitAttack('greatsword'));
  const changed = events.filter((e) => e.type === 'artChargeChanged');
  assert.deepEqual(changed.map((e) => [e.weaponId, e.value, e.reason]), [['greatsword', rules.gainPerHit, 'hit']]);
  assert.equal(combat.artCharge.greatsword, rules.gainPerHit);
  // The Art below full is a plain play: no charge, no unleash.
  const art = play(combat, artOf('greatsword'));
  assert.ok(!art.events.some((e) => e.type === 'artChargeChanged' || e.type === 'artUnleashed'));
  assert.equal(art.events.find((e) => e.type === 'cardPlayed').unleashed, undefined);
  assert.equal(combat.artCharge.greatsword, rules.gainPerHit);
  for (let i = 0; i < max + 3; i++) play(combat, kitAttack('greatsword'));
  assert.equal(combat.artCharge.greatsword, max, 'overflow is dropped at the cap');
  assert.equal(artChargeView(combat)[0].full, true);
});

test('a stagger caused by the weapon\'s hit adds its bonus charge', () => {
  const combat = fight();
  const enemy = combat.enemies[0];
  enemy.poiseMeter.max = 1; // the kit attack's own impact fills it
  const { events } = play(combat, kitAttack('greatsword'));
  if (events.some((e) => e.type === 'enemyStaggered')) {
    const reasons = events.filter((e) => e.type === 'artChargeChanged').map((e) => e.reason);
    assert.ok(reasons.includes('stagger'), `stagger credited: ${reasons}`);
    const staggers = events.filter((e) => e.type === 'enemyStaggered').length;
    assert.equal(combat.artCharge.greatsword, Math.min(artChargeMax(registries, 'greatsword'), rules.gainPerHit + staggers * rules.gainOnStagger));
  } else {
    // No impact on this card in this ruleset: prove the credit through the
    // listener with the same event the engine would emit.
    combat.emit('damageDealt', { sourceId: 'player', targetId: enemy.id, amount: 3, blocked: 0, cardInstanceId: 'x', grantedBy: 'greatsword', equipmentRole: 'granted', isAttack: true });
    const before = combat.artCharge.greatsword;
    combat.emit('enemyStaggered', { targetId: enemy.id, enemyId: enemy.enemyId });
    assert.equal(combat.artCharge.greatsword, before + rules.gainOnStagger);
  }
  // A new card announcement forgets the last hit: a later stagger credits nobody.
  combat.emit('cardPlayed', { cardInstanceId: 'y' });
  const settled = combat.artCharge.greatsword;
  combat.emit('enemyStaggered', { targetId: enemy.id, enemyId: enemy.enemyId });
  assert.equal(combat.artCharge.greatsword, settled);
});

test('a build-up burst caused by the weapon\'s hit adds its bonus charge; the Poise fill does not count twice', () => {
  const combat = fight();
  const enemy = combat.enemies[0];
  combat.emit('cardPlayed', { cardInstanceId: 'k' });
  combat.emit('damageDealt', { sourceId: 'player', targetId: enemy.id, amount: 4, blocked: 0, cardInstanceId: 'k', grantedBy: 'greatsword', equipmentRole: 'granted', isAttack: true });
  assert.equal(combat.artCharge.greatsword, rules.gainPerHit);
  combat.emit('procBurst', { targetId: enemy.id, status: 'bleed', amount: 5, threshold: 10 });
  assert.equal(combat.artCharge.greatsword, rules.gainPerHit + rules.gainOnBurst);
  combat.emit('meterFilled', { targetId: enemy.id, meter: 'poise', threshold: 10 });
  assert.equal(combat.artCharge.greatsword, rules.gainPerHit + rules.gainOnBurst, 'the Poise fill is counted by its stagger, not here');
  // A burst on the player, or after the turn ends, credits nobody.
  combat.emit('procBurst', { targetId: 'player', status: 'bleed', amount: 5, threshold: 10 });
  combat.emit('playerTurnEnd', { turn: 1 });
  combat.emit('procBurst', { targetId: enemy.id, status: 'bleed', amount: 5, threshold: 10 });
  assert.equal(combat.artCharge.greatsword, rules.gainPerHit + rules.gainOnBurst);
});

test('a full meter unleashes the Art: its extra effects resolve and the meter empties', () => {
  const plain = fight();
  const plainHp = plain.enemies[0].hp;
  play(plain, artOf('greatsword'));
  const plainDealt = plainHp - plain.enemies[0].hp;

  const combat = fight();
  const max = artChargeMax(registries, 'greatsword');
  for (let i = 0; i < max; i++) play(combat, kitAttack('greatsword'));
  const art = everyCard(combat).find(artOf('greatsword'));
  const pv = previewCard(combat, art.instanceId);
  assert.equal(pv.artCharge.unleashed, true);
  assert.deepEqual([pv.artCharge.value, pv.artCharge.max], [max, max]);
  // The printed card text gains the unleashed line, its numbers bound as
  // ordinary template tokens (SPEC §3.13).
  assert.equal(pv.artCharge.textTemplate, 'Unleashed: +{unleashed.0} Poise, apply {unleashed.1} Vulnerable.');
  assert.deepEqual([pv.tokens['unleashed.0'], pv.tokens['unleashed.1']], [4, 1]);
  const enemy = combat.enemies[0];
  const poiseBefore = enemy.poiseMeter.value;
  const hpBefore = enemy.hp;
  const energyBefore = 20;
  const { events } = play(combat, artOf('greatsword'));
  assert.ok(events.some((e) => e.type === 'artUnleashed' && e.weaponId === 'greatsword' && e.cardId === art.cardId));
  assert.ok(events.some((e) => e.type === 'artChargeChanged' && e.reason === 'unleash' && e.value === 0));
  assert.equal(events.find((e) => e.type === 'cardPlayed').unleashed, true);
  assert.equal(combat.artCharge.greatsword, 0, 'consuming the Art spends the charge');
  // Sundering Hew unleashed: +Poise and Vulnerable, same payment.
  assert.ok(enemy.statuses.vulnerable, 'the unleashed form applied its status');
  assert.ok(enemy.poiseMeter.value > poiseBefore || events.some((e) => e.type === 'enemyStaggered'), 'the unleashed form dealt extra Poise');
  assert.equal(hpBefore - enemy.hp, plainDealt, 'the Art\'s own damage is unchanged');
  assert.equal(events.find((e) => e.type === 'energySpent').amount, energyBefore - combat.player.energy, 'payment is the plain payment');
  assert.equal(artUnleashFor(combat, art).ready, false);
});

test('a loose copy of the same card is not the weapon\'s Art and never unleashes', () => {
  const combat = fight();
  const max = artChargeMax(registries, 'greatsword');
  combat.artCharge.greatsword = max;
  const art = everyCard(combat).find(artOf('greatsword'));
  combat.piles.hand.push({ instanceId: 'loose-copy', cardId: art.cardId, upgraded: false });
  assert.equal(previewCard(combat, 'loose-copy').artCharge, undefined);
  const { events } = play(combat, (c) => c.instanceId === 'loose-copy');
  assert.ok(!events.some((e) => e.type === 'artUnleashed'));
  assert.equal(combat.artCharge.greatsword, max);
});

test('the meter belongs to the weapon: a swap keeps each weapon\'s charge apart', () => {
  const combat = fight({ rightSets: ['greatsword', 'katana', null] });
  play(combat, kitAttack('greatsword'));
  play(combat, kitAttack('greatsword'));
  assert.equal(combat.artCharge.greatsword, 2 * rules.gainPerHit);
  combat.player.energy = 99;
  dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 1 });
  assert.deepEqual(artChargeView(combat).map((r) => [r.weaponId, r.value]), [['katana', 0]], 'the swapped-in weapon starts from its own value');
  // The swapped-out weapon neither gains nor shows while stowed.
  combat.emit('damageDealt', { sourceId: 'player', targetId: combat.enemies[0].id, amount: 3, blocked: 0, cardInstanceId: 'x', grantedBy: 'greatsword', equipmentRole: 'granted', isAttack: true });
  assert.equal(combat.artCharge.greatsword, 2 * rules.gainPerHit);
  play(combat, kitAttack('katana'));
  assert.equal(combat.artCharge.katana, rules.gainPerHit);
  combat.player.energy = 99;
  dispatch(combat, { type: 'swapArmament', slotId: 'rightHand', setIndex: 0 });
  assert.deepEqual(artChargeView(combat).map((r) => [r.weaponId, r.value]), [['greatsword', 2 * rules.gainPerHit]], 'swapping back resumes the stored value');
  assert.equal(combat.artCharge.katana, rules.gainPerHit);
});

test('two armed hands keep two meters, each charged only by its own cards', () => {
  const combat = fight({ right: 'greatsword', left: 'kiteShield' });
  assert.deepEqual(artChargeView(combat).map((r) => r.weaponId), ['greatsword', 'kiteShield']);
  play(combat, kitAttack('kiteShield'));
  assert.equal(combat.artCharge.kiteShield, rules.gainPerHit);
  assert.equal(combat.artCharge.greatsword, undefined);
});

test('a mid-combat save carries the meters; a snapshot from before them loads at zero', () => {
  const combat = fight();
  play(combat, kitAttack('greatsword'));
  const saved = serializeCombatSnapshot(combat);
  assert.deepEqual(saved.artCharge, { greatsword: rules.gainPerHit });
  const restored = restoreCombatSnapshot({ registries, rng: createRng(812), snapshot: saved });
  assert.equal(restored.artCharge.greatsword, rules.gainPerHit);
  for (const enemy of restored.enemies) { enemy.hp = enemy.maxHp = 999; }
  play(restored, kitAttack('greatsword'));
  assert.equal(restored.artCharge.greatsword, 2 * rules.gainPerHit, 'the restored fight keeps charging');

  const legacy = structuredClone(saved);
  delete legacy.artCharge;
  assert.doesNotThrow(() => assertCombatSnapshot(legacy));
  const old = restoreCombatSnapshot({ registries, rng: createRng(812), snapshot: legacy });
  assert.deepEqual(old.artCharge, {});
  assert.equal(artChargeView(old)[0].value, 0);

  const broken = structuredClone(saved);
  broken.artCharge = { greatsword: -1 };
  assert.throws(() => assertCombatSnapshot(broken), /artCharge\.greatsword/);
});

test('content validation refuses malformed meter rules and unleashed forms', () => {
  const problems = (bundle) => validateContent(bundle).errors.map((p) => `${p.path}: ${p.msg || p.message || ''}`).join('\n');
  assert.equal(problems(contentBundle), '');
  const missing = { ...contentBundle, weaponArtUnleashed: { ...contentBundle.weaponArtUnleashed } };
  delete missing.weaponArtUnleashed.greatswordSunderingHew;
  assert.match(problems(missing), /weaponArtUnleashed\.greatswordSunderingHew/);
  const selfTargeted = { ...contentBundle, weaponArtUnleashed: { ...contentBundle.weaponArtUnleashed, quickstep: { effects: [{ op: 'damage', target: 'enemy', amount: 3 }] } } };
  assert.match(problems(selfTargeted), /quickstep\.effects\[0\]\.target/);
  const badOp = { ...contentBundle, weaponArtUnleashed: { ...contentBundle.weaponArtUnleashed, twinFang: { effects: [{ op: 'notAnOpcode' }] } } };
  assert.match(problems(badOp), /weaponArtUnleashed\.twinFang\.effects/);
  const badRule = { ...contentBundle, balance: { ...contentBundle.balance, weaponArtCharge: { ...rules, maxByWeapon: { noSuchWeapon: 3 } } } };
  assert.match(problems(badRule), /maxByWeapon\.noSuchWeapon/);
});
