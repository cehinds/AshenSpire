// Owner, 2026-11-18 (docs/balance/owner-ruling-2026-11-18.md section 8): AR, DR and PR are not stats. Physical damage adds STR, Block adds DEX,
// magic damage adds max(INT, WIS); no armament or armour piece authors a rating; nothing printed names AR, DR or PR.
import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { gameDigest } from '../engine/kernel/gameConfig.js';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import * as Profile from '../src/model/gameProfile.js';
import { createRunState } from '../src/model/state.js';
import { createRng } from '../src/engine/rng.js';
import { createRunCombat } from '../src/engine/runCombat.js';
import { dispatch, previewCard } from '../src/engine/combat.js';
import { computeBlockGain } from '../src/engine/actions.js';
import { resolveDerivedStatRules, resolvedRuleRow, derivedStatIdsFor, deriveStat } from '../src/model/derivedStats.js';
import { ChannelAttribute, ChannelLabel } from '../src/model/damageChannels.js';
import { ItemStatBonus } from '../src/model/itemPicks.js';
import { statProjection } from '../src/model/statProjection.js';
import { progressionStats } from '../src/ui/models/ProgressionInspectionModel.js';
import { primeAccuracyRolls } from './accuracyFixture.mjs';

const shipped = Profile.resolveGameProfile('default');
const NEUTRAL = ['playerDamageMultiplier', 'enemyDamageMultiplier', 'blockGainMultiplier'];
function neutralWorld() {
  const profile = structuredClone(shipped);
  for (const key of NEUTRAL) profile.modules.effects[key] = 1;
  delete profile.hash;
  profile.hash = gameDigest(profile);
  return Profile.bindGameProfileRegistries(createRegistries(Profile.applyGameProfileToContent(contentBundle, profile)), profile);
}
const registries = neutralWorld();
const META = { gameProfileUnlocks: { [shipped.id]: { completedRunIds: ['a', 'b', 'c'] } } };

function fight(classId, attributes = {}) {
  const run = createRunState({ registries, classId, seed: 31, profileMeta: META });
  Object.assign(run.attributes, attributes);
  run.relics = [];
  const combat = createRunCombat({ registries, run, rng: createRng(31), enemyIds: ['wanderingSoldier'] });
  primeAccuracyRolls(combat, { count: 2 });
  dispatch(combat, { type: 'setReactions', enabled: false });
  combat.enemies[0].actorIntentRevealed = true;
  return { run, combat };
}
function damageOf(combat, cardId) {
  combat.piles.hand.push({ instanceId: 'probe', cardId });
  const resolved = previewCard(combat, 'probe', combat.enemies[0].id);
  const hit = resolved.values.find(v => v.op === 'damage').damageReceipt.hits[0];
  combat.piles.hand.pop();
  return hit;
}
// The stage that adds the attribute channel (STR for physical, INT/WIS for magic): its running total is the card's damage after the stat.
const statStage = hit => hit.sources.find(row => /^(ar|pr):\d/.test(String(row.id))).effective;

test('physical damage adds STR: one more STR is one more damage', () => {
  const a = fight('reaver'), b = fight('reaver', { strength: fight('reaver').run.attributes.strength + 4 });
  const base = damageOf(a.combat, 'core.strike'), more = damageOf(b.combat, 'core.strike');
  assert.equal(b.combat.player.attributes.strength - a.combat.player.attributes.strength, 4);
  assert.equal(statStage(more) - statStage(base), 4);
  assert.ok(base.sources.some(row => row.label === 'STR' || /STR/.test(row.label)), 'the receipt names STR, not Attack rating');
  assert.ok(!base.sources.some(row => /\b(AR|DR|PR)\b|Attack rating/.test(row.label)));
});

test('Block adds DEX', () => {
  const dex = fight('rogue').run.attributes.dexterity;
  const base = fight('rogue'), more = fight('rogue', { dexterity: dex + 4 });
  assert.equal(computeBlockGain(more.combat, more.combat.player, 5) - computeBlockGain(base.combat, base.combat.player, 5), 4);
});

test('magic damage adds max(INT, WIS): the higher of the two, not their sum', () => {
  const start = fight('starseer').run.attributes;
  const top = Math.max(start.intelligence, start.wisdom);
  const baseFight = fight('starseer');
  const lead = Math.max(baseFight.combat.player.attributes.intelligence, baseFight.combat.player.attributes.wisdom);
  const base = statStage(damageOf(baseFight.combat, 'core.cantrip'));
  // Raising either stat past the leader by 3 lifts the magic stage by exactly the gap to the old leader; raising both is not a sum.
  for (const raise of [{ wisdom: top + 5 }, { intelligence: top + 5 }, { intelligence: top + 5, wisdom: top + 5 }]) {
    const raised = fight('starseer', raise);
    const newLead = Math.max(raised.combat.player.attributes.intelligence, raised.combat.player.attributes.wisdom);
    assert.equal(statStage(damageOf(raised.combat, 'core.cantrip')) - base, newLead - lead, JSON.stringify(raise));
  }
  // The lower stat moving below the leader changes nothing.
  const lower = fight('starseer', { wisdom: Math.min(start.intelligence, start.wisdom) + 0 });
  assert.equal(statStage(damageOf(lower.combat, 'core.cantrip')), base);
});

test('no armament or armour piece authors or contributes a rating', () => {
  for (const piece of [...contentBundle.equipment.armaments, ...contentBundle.equipment.armour]) {
    assert.ok(!('attackRating' in piece) || !piece.attackRating, `${piece.id} has no attackRating`);
    assert.ok(!('defenseRating' in piece) || !piece.defenseRating, `${piece.id} has no defenseRating`);
  }
  for (const item of Profile.resolveGameProfile('default').content.gear) assert.equal(item.points?.dr, undefined, `${item.id} has no points.dr`);
  for (const classId of ['reaver', 'starseer', 'rogue', 'herald']) {
    const { combat } = fight(classId);
    const attributeRow = combat.player.ratingSources.find(row => row.kind === 'attribute');
    for (const row of combat.player.ratingSources.filter(row => row.kind === 'equipment')) {
      for (const id of ['ar', 'dr', 'pr']) assert.equal(row[id] || 0, 0, `${classId} ${row.name} adds no ${id}`);
    }
    assert.equal(combat.player.ratings.ar, combat.player.attributes.strength, `${classId} physical channel is its STR`);
    assert.equal(combat.player.ratings.dr, combat.player.attributes.dexterity, `${classId} Block channel is its DEX`);
    assert.equal(combat.player.ratings.pr, Math.max(combat.player.attributes.intelligence, combat.player.attributes.wisdom), `${classId} magic channel is max(INT, WIS)`);
    assert.ok(attributeRow, 'attributes remain one source row');
  }
});

test('the stat table has no AR, DR or PR row, and nothing the sheet draws names them', () => {
  assert.equal(contentBundle.derivedStatRules.rulesetVersion, 8);
  for (const id of ['ar', 'dr', 'pr']) {
    assert.equal(contentBundle.derivedStatRules.rules[id], undefined, `no ${id} row`);
    assert.equal(contentBundle.derivedStatRules.presentation[id], undefined, `no ${id} presentation`);
  }
  const { run } = fight('reaver');
  const rows = progressionStats(registries, run).rows;
  assert.deepEqual(rows.map(row => row.id).filter(id => ['ar', 'dr', 'pr'].includes(id)), []);
  const text = JSON.stringify([rows, statProjection(registries, run).derived]);
  assert.ok(!/\b(AR|DR|PR)\b|Attack Rating|Defense Rating|Potency Rating/.test(text), 'the sheet rows name no AR, DR or PR');
  for (const id of ['ar', 'dr', 'pr']) assert.ok(!/^(AR|DR|PR)$/.test(ChannelLabel(id)));
});

test('no player-facing card face or tag text names AR, DR or PR', async () => {
  const { cardFaceLines } = await import('../src/model/cardFaceText.js');
  const { playingCardDefinition } = await import('../src/model/playingCard.js');
  const { combat } = fight('reaver');
  const pattern = /\b(AR|DR|PR)\b|Attack Rating|Defense Rating|Potency Rating/;
  for (const card of registries.cards.values?.() ?? []) {
    const lines = cardFaceLines(combat, playingCardDefinition(combat, { cardId: card.id, upgraded: false }));
    assert.ok(!pattern.test(JSON.stringify(lines)), `${card.id} face: ${JSON.stringify(lines).slice(0, 120)}`);
  }
});

test('a save from before the ruling loads: old rating rows are ignored and old picks are read as attributes', () => {
  // A ruleset-7 table carries ar, dr and pr rows; the one in this fixture even prices them at 9 per point.
  const old = JSON.parse(readFileSync(new URL('../content/source/derivedStatRules.json', import.meta.url), 'utf8'));
  old.rulesetVersion = 7;
  old.rules.ar = { base: 0, strength: 9 };
  old.rules.dr = { base: 0, dexterity: 9 };
  old.rules.pr = { base: 0, intelligence: 9 };
  for (const id of ['ar', 'dr', 'pr']) old.presentation[id] = { label: id.toUpperCase(), order: 20 + ['ar', 'dr', 'pr'].indexOf(id), disclosure: 'reveal', sense: 'old' };
  assert.deepEqual(derivedStatIdsFor(7).filter(id => ['ar', 'dr', 'pr'].includes(id)), ['ar', 'dr', 'pr']);
  assert.deepEqual(derivedStatIdsFor(8).filter(id => ['ar', 'dr', 'pr'].includes(id)), []);
  const options = { attributeIds: ['strength', 'dexterity', 'constitution', 'wisdom', 'intelligence'], classFields: ['maxHp'] };
  const table = resolveDerivedStatRules(old, options);
  const attributes = { strength: 4, dexterity: 3, constitution: 1, wisdom: 1, intelligence: 2 };
  assert.equal(deriveStat(table, 'ar', { attributes }).value, 4, 'STR, not the saved 9 per point');
  assert.equal(deriveStat(table, 'dr', { attributes }).value, 3);
  assert.equal(resolvedRuleRow(table, 'pr').intelligence, 1);
  // An Advanced edit saved against a retired row is dropped, not thrown on, by a ruleset-8 table.
  assert.doesNotThrow(() => resolveDerivedStatRules(JSON.parse(readFileSync(new URL('../content/source/derivedStatRules.json', import.meta.url), 'utf8')), { ...options, explicitOverride: { rules: { ar: { strength: 5 } } } }));
  // An item pick or property that granted `ar` / `dr` / `pr` stat points is the attribute now.
  assert.deepEqual([ChannelAttribute('ar'), ChannelAttribute('dr'), ChannelAttribute('pr'), ChannelAttribute('poise')], ['strength', 'dexterity', 'intelligence', 'poise']);
  const run = { itemUpgradePicks: { 'armament/straightSword': [{ id: 'ar', k: 'stat', stat: 'ar', n: 1 }, { id: 'dr', k: 'stat', stat: 'dr', n: 2 }] } };
  assert.deepEqual(ItemStatBonus(run, 'armament/straightSword'), { strength: 1, dexterity: 2 });
});

test('item upgrade options and stance properties name the attribute', () => {
  const text = JSON.stringify(contentBundle.itemProperties ?? {});
  assert.ok(!/\+\d AR|\+\d DR|\(PR\)|magic damage while/.test(text), 'no rating text in the item option pool');
});
