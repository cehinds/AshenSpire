import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { frameOwnsHit } from '../tools/lib/combat-reach.mjs';

test('frame reach accepts its artwork and rejects reading or inspection descendants', () => {
  const pixels = {}, info = {}, hp = {}, ability = {};
  const sprite = { contains: hit => hit === pixels };
  const frame = { contains: () => true };
  for (const hit of [frame, sprite, pixels]) assert.equal(frameOwnsHit(frame, sprite, hit), true);
  for (const hit of [info, hp, ability, null]) assert.equal(frameOwnsHit(frame, sprite, hit), false);
  assert.equal(frameOwnsHit(frame, null, info), false);
});

test('screenreach checks the independent frame before descendant centre shortcuts', () => {
  const source = readFileSync(new URL('../tools/screenreach.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes('top => frameOwnsHit(c, sprite, top)'));
  assert.ok(source.includes('!c.matches(\'.combatant[data-ui-component="combatant-frame"]\') && hit'));
  assert.ok(!source.includes("exposedPatch(c.querySelector('.combatant-mini-hud'), 24)"));
  assert.ok(source.includes('a silhouette loses its frame-level tap area'));
  assert.ok(source.includes('a player loses its exposed artwork or frame-level tap area'));
});
