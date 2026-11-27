import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SCHEMAS } from '../src/model/schemas.js';
import { ratingIds } from '../src/model/ratingFormula.js';
import { walkSchema } from '../src/model/validate/schemaWalk.js';
import { validateContent } from '../src/model/validate.js';
import { contentBundle } from '../src/content/index.js';
import { gameProfileCatalog, gameProfileAuthors } from '../src/content/generated/gameProfiles.js';
import { resolveGameAuthor } from '../engine/kernel/gameConfig.js';
import { applyGameProfileToContent } from '../src/model/gameProfile.js';

const card = { id: 'schemaProbe', name: 'Schema probe', class: 'colorless', rarity: 'common', cost: 0, type: 'skill', keywords: [], effects: [], textTemplate: '' };
function errorsFor(values, upgraded) {
  const errors = [];
  const def = { ...card, ...(upgraded ? { upgrade: { cardRatingValues: values } } : { cardRatingValues: values }) };
  walkSchema(def, SCHEMAS.card, 'cards.schemaProbe', { ids: {}, err: (path, message) => errors.push({ path, message }) });
  return errors;
}

for (const upgraded of [false, true]) {
  const label = upgraded ? 'upgrade' : 'base';
  test(`${label} card rating values accept only finite numbers from the canonical rating vocabulary`, () => {
    for (const values of [{}, { ward: 0 }, { ward: 4 }, Object.fromEntries(ratingIds.map((id, index) => [id, index + 0.5]))]) assert.deepEqual(errorsFor(values, upgraded), []);
    for (const values of [{ unknown: 4 }, { ward: Infinity }, { ward: -Infinity }, { ward: NaN }, { ward: '4' }, { ward: { f: 'add', args: [4] } }, [], null]) {
      const errors = errorsFor(values, upgraded);
      assert.ok(errors.length > 0, `${label}: ${String(values)}`);
      assert.ok(errors.every(error => error.path.startsWith(`cards.schemaProbe.${upgraded ? 'upgrade.' : ''}cardRatingValues`)));
    }
    for (const key of ['toString', 'constructor', '__proto__']) {
      const errors = errorsFor(JSON.parse(`{"${key}":4}`), upgraded);
      assert.deepEqual(errors.map(error => error.path), [`cards.schemaProbe.${upgraded ? 'upgrade.' : ''}cardRatingValues.${key}`]);
      assert.match(errors[0].message, /Unknown field/);
    }
  });
}

test('finite validation is opt-in and leaves existing numeric descriptors unchanged', () => {
  const errors = [];
  walkSchema(Infinity, { k: 'num' }, 'legacyNumber', { err: (path, message) => errors.push({ path, message }) });
  assert.deepEqual(errors, []);
});

test('real profile application carries explicit Exposure metadata for an upgrade-only damage card through boot validation', () => {
  const catalog = structuredClone(gameProfileCatalog);
  const core = Object.values(catalog.packs).find(pack => pack.manifest.id === 'ashen.core-content');
  const authored = JSON.parse(readFileSync(new URL('../games/ashenspire/packs/core/cards.json', import.meta.url), 'utf8')).find(row => row.id === 'core.arcaneSiphon');
  assert.ok(authored);
  assert.equal(authored.effects.some(effect => effect.op === 'damage'), false);
  assert.ok(authored.upgrade.effects.some(effect => effect.op === 'damage'));
  core.content.cards = core.content.cards.map(row => row.id === authored.id ? structuredClone(authored) : row);
  const profile = resolveGameAuthor(gameProfileAuthors.core, catalog);
  const applied = applyGameProfileToContent(contentBundle, profile);
  const projected = applied.cards.find(row => row.id === authored.id);
  assert.deepEqual(projected.cardRatingValues, { ward: 4 });
  assert.deepEqual(projected.upgrade.cardRatingValues, { ward: 4 });
  assert.deepEqual(applied.equipment.cardExposure.filter(row => row.cardId === authored.id), [{
    cardId: authored.id, damageSchool: authored.damageSchool, exposureBuildupPerHit: authored.exposureBuildupPerHit,
  }]);
  const validation = validateContent(applied);
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.ok, true);
});
