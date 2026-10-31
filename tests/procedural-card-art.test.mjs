import test from 'node:test';
import assert from 'node:assert/strict';
import { proceduralCardArt } from '../src/ui/proceduralCardArt.js';
import { cardArtLayersHtml } from '../src/ui/cardArtLayers.js';
import { layeredCardArtCatalog as base } from '../src/content/layeredCardArt.generated.js';
import { reviewedCardArtCatalog as reviewed } from '../src/content/reviewedCardArt.generated.js';

const recipe = (type = 'attack', tags = ['camp:physical'], rank = 1) => proceduralCardArt({ type, tags, rank });
test('pure art depends only on canonical tags, type and rank, never identity or optional mechanics', () => {
  const tags = Object.freeze(['status:burn', 'camp:spell', 'element:fire', 'delivery:projectile']);
  const input = Object.freeze({ type: 'attack', tags, rank: 3, id: 'known', effects: [{ op: 'heal' }] });
  const first = proceduralCardArt(input);
  const second = proceduralCardArt({ ...input, tags: [...tags].reverse().map(id => ({ id })), id: '', name: 'different', profileId: 'axe', variant: 5, effects: [] });
  assert.strictEqual(first, second, 'canonical semantic cache also ignores unrelated fields');
  assert.ok(Object.isFrozen(first.componentArt.sprites[1].css));
  assert.throws(() => { first.componentArt.sprites[1].css.opacity = '0'; });
});
test('all actions, utilities, aliases and explicit maneuver overrides use shipped PNGs', () => {
  const assets = { ...base.assets, ...reviewed.assets };
  for (const camp of ['physical', 'spell']) for (const type of ['attack', 'smash', 'counter', 'evade', 'sweep', 'defend', 'defense', 'evasion', 'skill', 'power']) {
    const art = recipe(type, [`camp:${camp}`]);
    assert.ok(art?.componentArt, `${camp}/${type}`);
    for (const sprite of art.componentArt.sprites) assert.equal(sprite.path, assets[sprite.assetId].path);
    assert.ok(art.visualCues.length <= 4);
  }
  assert.equal(recipe('attack', ['camp:physical', 'maneuver:sweep']).maneuver, 'sweep');
  for (const [effect, asset] of [['heal', 'G.object.0'], ['draw', 'F.object.0'], ['cleanse', 'H.object.0']]) {
    assert.ok(recipe('skill', ['camp:physical', `effect:${effect}`]).componentArt.sprites.some(sprite => sprite.assetId === asset));
  }
  const counter = recipe('counter', ['camp:spell']).componentArt.sprites;
  assert.ok(counter.some(sprite => sprite.id === 'secondaryObject'), 'counter retains separate shield and sword');
  assert.ok(recipe('evade').componentArt.sprites.some(sprite => sprite.assetId === 'symbol.feather'));
});
test('rank changes rendered decorative intensity without changing weapon geometry or silhouette', () => {
  for (const type of ['attack', 'sweep', 'counter', 'evade', 'skill']) {
    const rows = [1, 3, 5].map(rank => recipe(type, ['camp:spell', 'status:burn'], rank));
    assert.equal(new Set(rows.map(cardArtLayersHtml)).size, 3);
    const objects = art => art.componentArt.sprites.filter(sprite => /^(object|secondaryObject)(-|$)/.test(sprite.id));
    assert.deepEqual(objects(rows[0]), objects(rows[2]));
    assert.deepEqual(recipe(type, ['camp:spell', 'status:burn'], 9).componentArt.sprites, rows[2].componentArt.sprites);
  }
  for (const rank of [undefined, null, 0, -1, NaN, Infinity, '3']) assert.equal(recipe('attack', ['camp:physical'], rank).rank, 1);
});
test('elements, spell delivery, bounded status PNGs and unknown registry statuses are semantic', () => {
  for (const element of ['force', 'fire', 'lightning', 'earth', 'frost', 'psychic', 'alteration', 'divine', 'necrotic', 'wind']) {
    const art = recipe('attack', ['camp:spell', `element:${element}`, 'delivery:projectile']);
    assert.ok(art.componentArt.sprites.some(sprite => sprite.assetId === `Z.effect.${base.selection.projectiles[element]}`));
  }
  const melee = recipe('attack', ['camp:spell', 'maneuver:casting', 'delivery:melee']);
  assert.ok(melee.componentArt.sprites.some(sprite => sprite.assetId.startsWith('Y.effect.')));
  const tags = ['status:burn', 'status:frost', 'status:sleep', 'status:weak', 'status:burn'];
  assert.equal(recipe('attack', ['camp:spell', ...tags]).statuses.length, 2);
  assert.equal(recipe('attack', ['camp:physical', ...tags]).statuses.length, 3);
  const registry = { statuses: new Map([['futureStatus', { id: 'futureStatus', tint: 'url(evil)' }]]) };
  const generic = proceduralCardArt({ type: 'skill', tags: ['camp:spell', 'status:futureStatus'] }, { registries: registry });
  assert.deepEqual(generic.statuses, [{ id: 'futureStatus' }]);
  assert.ok(generic.componentArt.sprites.some(sprite => sprite.assetId.startsWith('cue.prepared.')));
  assert.doesNotMatch(cardArtLayersHtml(generic), /evil/);
});
test('missing, empty, conflicting and unsupported camp or action identities fail safely', () => {
  for (const tags of [[], ['camp:physical', 'camp:spell'], ['camp:unknown'], ['camp:spell', 'maneuver:invented'], ['camp:spell', 'maneuver:attack', 'maneuver:sweep']]) {
    assert.equal(recipe('attack', tags), null);
  }
  assert.equal(recipe('unknown'), null);
  assert.equal(recipe('attack', ['camp:physical', 'element:__proto__']).element, null);
});
