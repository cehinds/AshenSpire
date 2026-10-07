import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyEntityKey,importLegacyContent} from '../src/framework/importer.js';
import {contentBundle} from '../src/content/index.js';
import {ContentRegistry} from '../src/framework/registries.js';
test('framework encodes punctuation without changing saved content identity or colliding',()=>{
  const ids=['progression-ember-hew','progression.ember.hew','progressionEmberHew','ability:one','ability-one','-','encoded.x00002d'];
  const keys=ids.map(id=>legacyEntityKey('card',id));
  assert.equal(new Set(keys).size,ids.length);
  for(const key of keys)assert.match(key,/^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/);
  assert.equal(legacyEntityKey('card','strike'),'card.strike');
  const imported=importLegacyContent(contentBundle);
  const source=imported.entities.find(entity=>entity.explicitOverrides?.legacyId==='progression-ember-hew');
  assert.equal(source.id,legacyEntityKey('card','progression-ember-hew'));
  assert.equal(source.explicitOverrides.legacyId,'progression-ember-hew');
  assert.ok(new ContentRegistry(imported.entities).has(source.id));
});
