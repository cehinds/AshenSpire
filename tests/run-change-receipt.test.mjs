// The what-changed receipt model: one row per kind, on real Core registries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registries } from './helpers/fixcore-combat-rules.mjs';
import { createRunState } from '../src/model/state.js';
import { snapshotRunForDiff, diffRunSnapshots } from '../src/model/runChangeReceipt.js';
import { nextUpgradeStep } from '../src/model/cardUpgradeLimits.js';

const newRun = () => createRunState({ registries, classId: 'reaver', seed: 511, profileMeta: { gameProfileUnlocks: { core: { completedRunIds: ['a', 'b', 'c'] } } } });
const diff = (run, mutate) => { const before = snapshotRunForDiff(run); mutate(run); return diffRunSnapshots(before, snapshotRunForDiff(run), registries); };
const rowOf = (d, kind) => d.rows.find((r) => r.kind === kind);

test('no change is an empty frozen diff', () => {
  const d = diff(newRun(), () => {});
  assert.equal(d.empty, true); assert.deepEqual(d.rows, []); assert.ok(Object.isFrozen(d));
});
test('stat and resource rows carry before, after and delta', () => {
  const d = diff(newRun(), (r) => { r.hp -= 5; r.cinders += 12; r.smithingStones += 1; });
  assert.deepEqual(d.rows.map((r) => [r.kind, r.label, r.before, r.after, r.delta]).sort(), [
    ['resource', 'CINDERS', '20', '32', 12], ['resource', 'SMITHING STONES', '0', '1', 1], ['stat', 'HP', '71', '66', -5]].sort());
});
test('a relic gained and lost', () => {
  const run = newRun();
  const d = diff(run, (r) => { r.relics = [...r.relics.slice(1), 'forsakenMedallion'].filter((v, i, a) => a.indexOf(v) === i); r.relics.push('emberHeart'); });
  assert.ok(d.rows.some((r) => r.kind === 'relic' && r.gained === true && r.relicId === 'emberHeart'));
});
test('a card upgrade carries before and after faces; add and remove are rows', () => {
  const run = newRun();
  const card = run.deck.find((c) => c.cardId === 'core.strike');
  const step = nextUpgradeStep(run, card, registries.cards.get('core.strike'), registries);
  const d = diff(run, (r) => { card.upgradeSteps = [step]; card.upgraded = true; r.deck.push({ instanceId: 'new1', cardId: 'core.strike' }); r.deck.splice(r.deck.findIndex((c) => c.instanceId !== card.instanceId && c.cardId === 'core.strike'), 1); });
  const up = d.rows.find((r) => r.change === 'upgraded');
  assert.equal(up.cardId, 'core.strike'); assert.equal(up.instanceId, card.instanceId);
  assert.notDeepEqual(up.faces.before, up.faces.after);
  assert.equal(up.after, '+1');
  assert.ok(d.rows.some((r) => r.change === 'added' && r.instanceId === 'new1'));
  assert.ok(d.rows.some((r) => r.change === 'removed'));
});
test('rank change is a card row', () => {
  const run = newRun();
  const d = diff(run, (r) => { r.deck[0].rank = 3; });
  assert.equal(rowOf(d, 'card').change, 'ranked'); assert.equal(rowOf(d, 'card').after, 'RANK 3');
});
test('armament bought and tiered', () => {
  const run = newRun();
  const id = registries.equipment.armaments.find((p) => !JSON.stringify(run.loadout).includes(p.id)).id;
  const d = diff(run, (r) => { r.loadout.storage = [...(r.loadout.storage || []), id]; r.itemUpgradeLevels = { [`armament/${id}`]: 1 }; });
  assert.ok(d.rows.some((r) => r.kind === 'armament' && r.change === 'added' && r.armamentId === id));
  assert.ok(!d.rows.some((r) => r.change === 'tier'), 'a piece bought at a tier is one gained row');
  const d2 = diff(run, (r) => { r.itemUpgradeLevels = { [`armament/${id}`]: 2 }; });
  const tier = d2.rows.find((r) => r.change === 'tier');
  assert.equal(tier.tierBefore, 1); assert.equal(tier.tierAfter, 2); assert.equal(tier.label, registries.equipment.armaments.find((p) => p.id === id).name);
});
test('class swap and flask rows', () => {
  const d = diff(newRun(), (r) => { r.class = 'warden'; r.flasks = [{ flaskId: [...registries.flasks.ids()][0] }]; r.flaskCharges.capacity += 1; });
  const cls = rowOf(d, 'class');
  assert.equal(cls.before, registries.classes.get('reaver').name);
  assert.ok(d.rows.some((r) => r.kind === 'resource' && r.label === registries.flasks.get([...registries.flasks.ids()][0]).name.toUpperCase()), 'the flask is named, not [object Object]');
  assert.ok(d.rows.some((r) => r.label === 'FLASK CHARGES'));
  assert.ok(!d.rows.some((r) => /object/.test(r.label)));
});

test('a weapon art lands in the sideboard: a gained card row with its face', () => {
  const run = newRun();
  const d = diff(run, (r) => { r.sideboard = [...(r.sideboard || []), { instanceId: 'shop-art:1:core.strike', cardId: 'core.strike', upgraded: false }]; });
  const row = d.rows.find((r) => r.instanceId === 'shop-art:1:core.strike');
  assert.equal(row.kind, 'card'); assert.equal(row.change, 'gained');
});
test('a rank-up shows two different faces, and an already-ranked card keeps its rank bonus', () => {
  const run = newRun();
  const card = run.deck.find((c) => c.cardId === 'core.strike');
  const d = diff(run, () => { card.rank = 2; });
  const row = d.rows.find((r) => r.change === 'ranked');
  assert.notDeepEqual(row.faces.before.effects, row.faces.after.effects);
  const d2 = diff(run, () => { card.rank = 3; });
  const face2 = d2.rows.find((r) => r.change === 'ranked').faces;
  assert.notDeepEqual(face2.before.effects, row.faces.before.effects, 'rank 2 face carries its bonus');
});
test('sigil install and removal are rows', () => {
  const run = newRun();
  const sigilId = [...registries.sigils.all()][0].id;
  const ref = 'armament/greatsword';
  const d = diff(run, (r) => { r.sigilSlots = { [ref]: [sigilId] }; });
  assert.equal(d.rows.find((r) => r.change).change, 'installed');
  const d2 = diff(run, (r) => { r.sigilSlots = { [ref]: [null] }; });
  assert.equal(d2.rows.find((r) => r.change).change, 'removed');
});

test('a ramped card upgraded after plays shows the faces the live resolver gives (playsEver is kept)', async () => {
  const { projectGameCard } = await import('../src/model/gameProfile.js');
  const run = newRun();
  const nick = { instanceId: 'nick1', cardId: 'core.whetstoneNick', upgraded: false, playsEver: 5 };
  run.deck.push(nick);
  const beforeInstance = structuredClone(nick);
  const d = diff(run, () => { nick.upgraded = true; nick.upgradeSteps = [{ k: 'authored' }]; });
  const row = d.rows.find((r) => r.instanceId === 'nick1');
  assert.ok(row?.faces, 'faces present');
  const afterInstance = structuredClone(nick);
  assert.deepEqual(JSON.parse(JSON.stringify(row.faces.before)), JSON.parse(JSON.stringify(projectGameCard(run, beforeInstance))));
  assert.deepEqual(JSON.parse(JSON.stringify(row.faces.after)), JSON.parse(JSON.stringify(projectGameCard(run, afterInstance))));
  const amount = (face) => JSON.stringify(face.effects[0].amount);
  assert.match(amount(row.faces.before), /7/, 'the base 2 plus five plays is in the face');
});
