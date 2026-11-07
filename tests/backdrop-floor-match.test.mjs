import test from 'node:test';
import assert from 'node:assert/strict';
import { alternativeArtCatalog as catalog } from '../src/ui/alternativeArtCatalog.js';
import { LAYERED_SCENES } from '../src/content/layeredEnvironments.js';
import { locationPresentation as data } from '../src/content/generated/locationPresentation.js';
import { MISMATCHED_ATLAS_SCENES } from '../src/content/sceneThemes.js';
import { REGION_SETTINGS } from '../src/model/layeredEnvironments.js';
import { resolveLocationPresentation } from '../src/model/locationPresentation.js';

const setOf = file => file.split('/').pop().replace(/\.webp$/, '').split('--').slice(0, 2).join('--');
const layeredSelf = scene => new Set(scene.layers.filter(l => ['backdrop', 'ground'].includes(l.role)).map(l => setOf(l.asset))).size === 1;
const theme = id => id.replace(/-(far|ground)$/, '');
const atlasPair = scene => {
  const kinds = scene.devices.phone.layers.map(l => [l.id, catalog.sceneLayers[l.id].kind]);
  return { far: theme(kinds.find(k => k[1] === 'far')[0]), ground: theme(kinds.find(k => k[1] === 'ground')[0]) };
};

test('the mismatch table is exactly the atlas scenes whose background and floor differ', () => {
  const found = new Set();
  for (const [id, scene] of Object.entries(catalog.scenes)) {
    const { far, ground } = atlasPair(scene);
    // BS/HM/FC scenes carry one prefix per set; a differing region prefix is still one set per scene.
    if (far !== ground && !/^(BS|HM|FC)$/.test(far)) found.add(id);
  }
  assert.deepEqual([...found].sort(), Object.keys(MISMATCHED_ATLAS_SCENES).sort());
});

test('every terrain profile that can be matched picks only matched atlas scenes', () => {
  for (const p of data.profiles) {
    const rows = data.sceneProfiles.filter(r => r.profileId === p.profileId);
    const hasMatched = rows.some(r => !MISMATCHED_ATLAS_SCENES[r.sceneId]);
    for (let n = 0; n < 40; n++) {
      const pick = resolveLocationPresentation({ nodeId: 'x', seedString: 's' + n, profileId: p.profileId }).sceneId;
      if (hasMatched) assert.ok(!MISMATCHED_ATLAS_SCENES[pick], `${p.profileId} drew ${pick}`);
    }
  }
});

test('city terrain never draws the starwatch sky over the coast ground', () => {
  const seen = new Set();
  for (let n = 0; n < 60; n++) seen.add(resolveLocationPresentation({ nodeId: 'x', seedString: 'c' + n, profileId: 'drowned-coast/city' }).sceneId);
  assert.deepEqual([...seen], ['drowned-coast-1']);
});

test('every layered scene a city or castle terrain selects keeps its backdrop and floor in one set', () => {
  for (const [region, settings] of Object.entries(REGION_SETTINGS)) {
    for (const [setting, sceneId] of Object.entries(settings)) {
      const scene = LAYERED_SCENES[sceneId];
      assert.ok(scene, `${region}/${setting} names a real scene`);
      if (['city', 'town', 'street', 'castle'].includes(setting)) assert.ok(layeredSelf(scene), `${region}/${setting} -> ${sceneId}`);
    }
  }
  for (const id of ['city-street', 'city-street-night', 'city-street-rain', 'castle-grounds', 'volcanic-castle-exterior', 'village-lane', 'snowy-street']) {
    assert.ok(layeredSelf(LAYERED_SCENES[id]), id);
  }
});
