// Owner 2026-11-01: each element has a family of 3-5 Core cantrips (SPEC, "Elemental cantrip families").
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { combatProfileFor } from '../src/model/combatCardProfile.js';
import { hitWeaknessTriggers } from '../src/engine/weaknesses.js';

const profile = resolveGameProfile('core');
const cards = new Map(profile.content.cards.map(c => [c.id, c]));
const FAMILIES = {
  fire: ['cinderDart', 'emberFlick', 'dazzleFlare', 'palmFlame', 'cinderWard'],
  frost: ['frostNip', 'rimeBite', 'brittleTouch'],
  divine: ['mendingTouch', 'steadyHands', 'guidingWhisper', 'hallowedWard', 'dawnFlame'],
  decay: ['venomSpray', 'graveToll', 'wearyingTouch', 'rendingHex', 'acidSplash'],
  lightning: ['jolt', 'shockingGrasp', 'stormLash'], // gain the Lightning tag behaviour when ElementsLightning merges
};

test('every family has 3-5 cantrips, each tagged with its element and shaped like the existing cantrips', () => {
  for (const [element, ids] of Object.entries(FAMILIES)) {
    assert.ok(ids.length >= 3 && ids.length <= 5, element);
    for (const id of ids) {
      const c = cards.get(`core.${id}`);
      assert.ok(c, id);
      for (const tag of ['rank.cantrip', 'camp:spell', 'source:spell', `school:${element}`]) assert.ok(c.tags.includes(tag), `${id} ${tag}`);
      assert.equal(c.staminaCost, 1, id);
      assert.equal(c.manaCost, 0, id);
      assert.ok(c.upgrade?.effects?.length, `${id} has an upgrade`);
      assert.equal(c.upgrade.effects.length, c.effects.length, `${id} upgrade keeps its effects`);
    }
  }
});

const reg = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);

test('Steady Hands exhausts when played, like Mending Touch', () => {
  for (const id of ['core.steadyHands', 'core.mendingTouch']) {
    const def = reg.cards.get(id);
    assert.ok(def.keywords.includes('exhaust'), id);
    assert.equal(reg.framework.afterPlayDestination(def), 'EXHAUST_PILE', id);
  }
});

test('Hallowed Ward grants 1 Barrier at both grades', () => {
  const ward = reg.cards.get('core.hallowedWard');
  assert.equal(ward.effects.find(e => e.op === 'gainBarrier').amount, 1);
  assert.equal(ward.upgrade.effects.find(e => e.op === 'gainBarrier').amount, 1);
});

test('one cantrip per school probes its own weakness trigger', () => {
  const probes = { 'core.cinderDart': 'fire', 'core.frostNip': 'frost', 'core.dawnFlame': 'sacred', 'core.venomSpray': 'decay', 'core.jolt': 'lightning' };
  for (const [id, trigger] of Object.entries(probes)) {
    const triggers = hitWeaknessTriggers({}, null, { combatProfile: combatProfileFor(reg.cards.get(id)) });
    assert.ok(triggers.includes('magic'), `${id} magic`);
    assert.ok(triggers.includes(trigger), `${id} -> ${trigger}: got ${triggers}`);
  }
});

test('Steady Hands is excluded from the graduate Magic Adept unlimited copies', async () => {
  const { readFileSync } = await import('node:fs');
  const bundle = JSON.parse(readFileSync(new URL('../games/ashenspire/bundles/core/bundle.json', import.meta.url), 'utf8'));
  assert.ok(JSON.stringify(bundle).includes('"excludeCards":["core.mendingTouch","core.steadyHands"]'.replace(/\s/g, '')) || /"excludeCards":\s*\[\s*"core.mendingTouch",\s*"core.steadyHands"\s*\]/.test(JSON.stringify(bundle, null, 2).replace(/\n\s*/g, '')));
});
