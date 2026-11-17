// Theme G of the 2026-11-17 playtest (owner, item 48): the procedural card art generator paints an effect layer for
// every presentation `fx:` tag. Each layer reuses one already-approved PNG from the reviewed library; the exporter
// compiles it like any recipe layer, and the generator adds it while the four visual identities have room.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { proceduralCardArt } from '../src/ui/proceduralCardArt.js';
import { cardArtLayersHtml } from '../src/ui/cardArtLayers.js';
import { reviewedCardArtCatalog as reviewed } from '../src/content/reviewedCardArt.generated.js';

const FX_TAGS = readFileSync(new URL('../content/source/nodes.csv', import.meta.url), 'utf8').split(/\r?\n/)
  .filter(line => line.startsWith('fx:')).map(line => line.split(',')[0]);
// heal and cleanse were already art identities: they select approved utility objects (effect:heal, effect:cleanse).
const UTILITY_FX = new Set(['fx:heal', 'fx:cleanse']);
const layered = FX_TAGS.filter(tag => !UTILITY_FX.has(tag));
const objectIds = /^(?:object|secondaryObject)(?:-|$)/;

test('every presentation fx tag without an art identity has an approved effect layer', () => {
  assert.ok(layered.length >= 27, `fx tags read from nodes.csv (${layered.length})`);
  assert.deepEqual(Object.keys(reviewed.effectLayers).sort(), layered.slice().sort());
  for (const [tag, layer] of Object.entries(reviewed.effectLayers)) {
    assert.equal(layer.id, `fx-${tag.slice(3)}`);
    assert.ok(reviewed.assets[layer.assetId], `${tag}: ${layer.assetId} is a registered approved PNG`);
    assert.equal(layer.path, reviewed.assets[layer.assetId].path);
    assert.match(layer.path, /^assets-display\/card-cutouts\/[A-Za-z0-9.]+\.png$/);
    assert.ok(layer.transform.opacity > 0 && layer.transform.opacity <= 1);
  }
});

test('each effect layer produces a valid procedural card above its weapon, for both camps and every rank', () => {
  for (const tag of layered) for (const camp of ['physical', 'spell']) for (const rank of [1, 3, 5]) {
    const art = proceduralCardArt({ type: 'attack', tags: [`camp:${camp}`, 'maneuver:attack', tag], rank });
    assert.ok(art, `${tag}/${camp}: a recipe`);
    const sprites = art.componentArt.sprites;
    const effect = sprites.find(sprite => sprite.id === `fx-${tag.slice(3)}`);
    assert.ok(effect, `${tag}/${camp}: paints its effect layer`);
    assert.equal(sprites.filter(sprite => sprite.id === 'background').length, 1);
    const objects = sprites.filter(sprite => objectIds.test(sprite.id));
    assert.ok(Number(effect.css.zIndex) > Math.max(...objects.map(sprite => Number(sprite.css.zIndex))), `${tag}: above the weapon`);
    assert.ok(Number(effect.css.opacity) < reviewed.effectLayers[tag].transform.opacity + 1e-9, `${tag}: rank intensity scales it`);
    assert.ok(art.visualCues.includes(tag));
    assert.ok(art.visualCues.length <= 4);
    assert.match(cardArtLayersHtml(art), new RegExp(`data-card-art-component="${reviewed.effectLayers[tag].assetId.replace(/\./g, '\\.')}"`));
  }
});

test('the effect layer yields to elements and statuses: never more than four visual identities', () => {
  const full = proceduralCardArt({ type: 'attack', tags: ['camp:spell', 'element:fire', 'status:burn', 'status:weak', 'fx:blade'] });
  assert.equal(full.visualCues.length, 4);
  assert.ok(!full.componentArt.sprites.some(sprite => sprite.id.startsWith('fx-')), 'no room left for an effect layer');
  const roomy = proceduralCardArt({ type: 'attack', tags: ['camp:physical', 'fx:blade', 'fx:blood'] });
  assert.equal(roomy.componentArt.sprites.filter(sprite => sprite.id.startsWith('fx-')).length, 1, 'one effect layer at most');
  assert.notEqual(proceduralCardArt({ type: 'attack', tags: ['camp:physical'] }), roomy, 'the effect layer is part of the cache identity');
});

test('heal and cleanse keep their approved utility objects', () => {
  for (const tag of UTILITY_FX) {
    const art = proceduralCardArt({ type: 'skill', tags: ['camp:spell', tag] });
    assert.ok(art && !art.componentArt.sprites.some(sprite => sprite.id.startsWith('fx-')), tag);
  }
});
