import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { basicCardProfiles } from '../src/content/generated/basicCardProfiles.js';
import { LORE_FACES, LORE_SIZES, LORE_TYPE_DEFAULTS, loreParts, resolveLoreType, applyLoreType } from '../src/ui/models/LoreTypeModel.js';

// Card lore is written in three parts (LORE.md §7): an identity line, the
// history, and a closing line. Card inspection shows only the identity line,
// so it has to be short enough to sit on one line there. Afflictions (status
// and curse cards) and basic profiles may run under the forty-word floor.
const AFFLICTION_TYPES = new Set(['status', 'curse']);
const lore = [
  ...contentBundle.cards.filter((card) => card.flavor)
    .map((card) => [card.id, card.flavor, !AFFLICTION_TYPES.has(card.type)]),
  ...basicCardProfiles.map((profile) => [profile.id, profile.flavor, false]),
];

test('every card and basic profile carries lore', () => {
  const missing = contentBundle.cards.filter((card) => !card.flavor).map((card) => card.id);
  assert.deepEqual(missing, []);
  assert.ok(basicCardProfiles.every((profile) => profile.flavor), 'a basic profile has no lore');
});

test('each identity line is twelve words or fewer and the whole runs forty to eighty', () => {
  for (const [id, text, floored] of lore) {
    const { identity } = loreParts(text);
    assert.ok(identity, `${id}: no identity line`);
    assert.ok(identity.split(/\s+/).length <= 12, `${id}: identity line "${identity}" is over twelve words`);
    const words = text.split(/\s+/).length;
    assert.ok(words <= 80, `${id}: lore is over eighty words`);
    if (floored) assert.ok(words >= 40, `${id}: lore is under forty words (${words})`);
  }
});

test('lore never signs a source line', () => {
  for (const [id, text] of lore) assert.ok(!/\n— /.test(text), `${id}: lore ends on a "— source" signature`);
});

test('loreParts splits identity, history and a closing line set apart', () => {
  assert.deepEqual(loreParts('Art.\n\nHistory one.\n\nClosing.'), { identity: 'Art.', body: ['History one.'], closing: 'Closing.' });
  assert.deepEqual(loreParts('Art.\n\nOnly history.'), { identity: 'Art.', body: ['Only history.'], closing: '' });
  assert.deepEqual(loreParts('Honest steel.'), { identity: 'Honest steel.', body: [], closing: '' });
  assert.deepEqual(loreParts(''), { identity: '', body: [], closing: '' });
});

test('lore type resolves unknown values to the defaults and stamps words, not lengths', () => {
  const fallback = resolveLoreType({ loreFace: 'Comic Sans', loreSize: 'XXL', loreSlant: 'oblique' });
  assert.equal(fallback.face, LORE_FACES.find((face) => face.label === LORE_TYPE_DEFAULTS.loreFace).id);
  assert.equal(fallback.size, LORE_TYPE_DEFAULTS.loreSize);
  assert.equal(fallback.slant, LORE_TYPE_DEFAULTS.loreSlant);
  const root = { dataset: {} };
  applyLoreType({ loreFace: 'EB Garamond', loreSize: 'XL', loreIdentitySlant: 'upright' }, root);
  assert.deepEqual(root.dataset, { loreFace: 'garamond', loreSize: 'XL', loreLeading: 'normal', loreTracking: 'normal', loreSlant: 'italic', loreIdentitySlant: 'upright' });
  assert.ok(LORE_SIZES.includes(root.dataset.loreSize));
  for (const value of Object.values(root.dataset)) assert.ok(!/\d(px|rem|em)$/.test(value), `a length was written: ${value}`);
});
