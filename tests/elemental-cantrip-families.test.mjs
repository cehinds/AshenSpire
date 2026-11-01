// Owner 2026-11-01: each element has a family of 3-5 Core cantrips (SPEC, "Elemental cantrip families").
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGameProfile } from '../src/model/gameProfile.js';

const profile = resolveGameProfile('core');
const cards = new Map(profile.content.cards.map(c => [c.id, c]));
const FAMILIES = {
  fire: ['cinderDart', 'emberFlick', 'dazzleFlare', 'palmFlame', 'cinderWard'],
  frost: ['frostNip', 'rimeBite', 'brittleTouch'],
  divine: ['mendingTouch', 'steadyHands', 'guidingWhisper', 'hallowedWard', 'dawnFlame'],
  necrotic: ['venomSpray', 'graveToll', 'wearyingTouch', 'rendingHex', 'acidSplash'],
  lightning: ['jolt', 'shockingGrasp', 'stormLash'], // gain the Lightning tag behaviour when ElementsLightning merges
};

test('every family has 3-5 cantrips, each tagged with its element and shaped like the existing cantrips', () => {
  for (const [element, ids] of Object.entries(FAMILIES)) {
    assert.ok(ids.length >= 3 && ids.length <= 5, element);
    for (const id of ids) {
      const c = cards.get(`core.${id}`);
      assert.ok(c, id);
      for (const tag of ['rank.cantrip', 'camp:spell', 'source:spell', `element:${element}`]) assert.ok(c.tags.includes(tag), `${id} ${tag}`);
      assert.equal(c.staminaCost, 1, id);
      assert.equal(c.manaCost, 0, id);
      assert.ok(c.upgrade?.effects?.length, `${id} has an upgrade`);
      assert.equal(c.upgrade.effects.length, c.effects.length, `${id} upgrade keeps its effects`);
    }
  }
});
