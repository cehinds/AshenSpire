// W25-C2 (owner, 2026-11-14): "remove all ranged tag from cards", cantrips that matter, school-matched status cards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { rollUpgradeOptions, upgradeStepRng } from '../src/model/cardUpgradeSteps.js';
import { objectTagIds } from '../src/content/tags.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { applyCombatExpansionMartial, combatExpansionMartialOverlay } from '../src/content/combatExpansionMartial.js';

const profile = resolveGameProfile('core');
const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const cards = profile.content.cards;
const tagsOf = card => card.cardTags ?? card.tags ?? [];
const schoolOf = card => tagsOf(card).find(tag => tag.startsWith('school:'))?.slice(7) || '';
const statusesOf = effects => (effects || []).filter(e => e.op === 'applyStatus').map(e => e.status);
// The status a school's cards carry (owner: fire -> Burn, frost -> Chill, necrotic/decay -> Weak or its build-up, divine -> heal over time).
// Lightning cantrips Shock through the Lightning contest rule on the hit (tests/element-lightning.test.mjs), so they print no status.
// TODO(batch2): frost -> chill and lightning -> shock once content/source/statuses.json carries them on this branch.
const SCHOOL_STATUS = { fire: ['burn'], frost: ['frost', 'chill'], divine: ['regen'], decay: ['venom', 'necroticBlight', 'weak', 'frail'], lightning: ['shocked', 'shock'] };

test('no shipped card, authored or projected, carries maneuver:ranged; the nine bow cards are Reach attacks', () => {
  for (const card of contentBundle.cards) assert.ok(!objectTagIds('card', card.id).includes('maneuver:ranged'), card.id);
  for (const card of reg.cards.all()) assert.ok(!tagsOf(card).includes('maneuver:ranged'), card.id);
  for (const id of ['aspDart', 'ricochet', 'fanOfKnives', 'toxicVolley', 'pinningShot', 'arrowVolley', 'aimedShot', 'barbedArrow', 'lethalDose']) {
    const row = combatExpansionMartialOverlay[id];
    assert.equal(row.maneuver, 'attack', id);
    assert.equal(row.range, 'reach', id);
    assert.equal(row.projectile, true, id);
  }
  assert.equal(combatExpansionMartialOverlay.nockAndWait.maneuver, 'counter');
});

test('a bow card plays as an attack at Reach', () => {
  for (const id of ['aimedShot', 'barbedArrow', 'arrowVolley']) {
    const card = reg.cards.get(id);
    const profileOf = combatProfileFor(applyCombatExpansionMartial(card));
    assert.equal(profileOf.maneuver, 'attack', id);
    assert.equal(profileOf.range, 'reach', id);
  }
});

const cantrips = cards.filter(card => tagsOf(card).includes('rank.cantrip'));

test('every cantrip is free of Mana and costs at most 1 Stamina (SPEC: a 0 SP / 0 MP card is not a cantrip)', () => {
  assert.ok(cantrips.length >= 24, `found ${cantrips.length}`);
  for (const card of cantrips) {
    assert.equal(card.manaCost, 0, card.id);
    assert.ok(card.staminaCost <= 1, card.id);
  }
});

test('every school cantrip applies at least 1 stack of its school status, at both grades', () => {
  for (const card of cantrips) {
    const school = schoolOf(card);
    if (!school || school === 'lightning') continue;
    for (const [grade, effects] of [['base', card.effects], ['upgrade', card.upgrade.effects]]) {
      const found = (effects || []).filter(e => e.op === 'applyStatus' && SCHOOL_STATUS[school].includes(e.status));
      assert.ok(found.length && found.every(e => e.stacks >= 1), `${card.id} (${school}) ${grade}`);
    }
  }
});

test('a cantrip upgrade can add +1 stack of its status, Retain or a draw', () => {
  for (const id of ['core.frostNip', 'core.venomSpray', 'core.mendingTouch', 'core.cinderDart', 'core.dawnFlame']) {
    const base = reg.cards.get(id);
    const kinds = new Set();
    for (let seed = 1; seed <= 12; seed += 1) {
      for (const step of rollUpgradeOptions(base, [], 0, upgradeStepRng(seed, 'probe', 0), {}, 30)) kinds.add(step.k === 'fx' ? `fx:${step.fx}` : step.k);
    }
    assert.ok(kinds.has('stk'), `${id} offers +1 stack`);
    assert.ok(kinds.has('fx:retain'), `${id} offers Retain`);
    assert.ok(kinds.has('fx:draw'), `${id} offers draw 1`);
  }
});
