// Ward off (Core 2 ward.enabled:false): a wardDamage effect drains Poise, so card text reads it as Poise damage,
// merged with the card's own Poise damage into one figure. Current (and any profile that keeps Ward) reads as authored.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentBundle } from '../src/content/index.js';
import { createRegistries } from '../src/model/registries.js';
import { resolveGameProfile, applyGameProfileToContent, bindGameProfileRegistries } from '../src/model/gameProfile.js';
import { cardFaceLines } from '../src/model/cardFaceText.js';
import { combatCardSummary } from '../src/model/playingCard.js';
import { wardReadsAsPoise, poiseMergeGroups } from '../src/model/wardOffCardText.js';

const profile = resolveGameProfile({ formatVersion: 1, core: 'ashen.core@2.0.0', modules: {} });
const core = bindGameProfileRegistries(createRegistries(applyGameProfileToContent(contentBundle, profile)), profile);
const current = createRegistries(contentBundle);
const plain = lines => lines.map(line => line.html.replace(/<[^>]+>/g, ''));

const def = effects => ({ id: 'test.ward-card', name: 'Test', type: 'attack', class: 'colorless', rarity: 'common', cost: 1, keywords: [], effects, textTemplate: 'x',
  combatProfile: { camp: 'physical', maneuver: 'attack', range: 'melee', targeting: 'single' } });
const WARD = def([{ op: 'wardDamage', target: 'enemy', amount: 8 }]);
const MULTI = def([{ op: 'damage', target: 'enemy', amount: 4, hits: 3 }, { op: 'wardDamage', target: 'enemy', amount: 3 }, { op: 'poiseDamage', target: 'enemy', amount: 3 }]);

test('the predicate follows the profile: Core 2 reads Ward as Poise, Current does not', () => {
  assert.equal(wardReadsAsPoise(core), true);
  assert.equal(wardReadsAsPoise(current), false);
  assert.equal(wardReadsAsPoise(null), false);
});

test('merge groups: Ward and Poise damage on one target merge; other targets and Poise-only cards do not', () => {
  assert.deepEqual([...poiseMergeGroups(MULTI.effects)].map(([i, g]) => [i, g.leader]), [[1, true], [2, false]]);
  assert.equal(poiseMergeGroups([{ op: 'poiseDamage', target: 'enemy', amount: 4 }]).size, 0);
  assert.equal(poiseMergeGroups([{ op: 'wardDamage', target: 'enemy', amount: 4 }, { op: 'poiseDamage', target: 'allEnemies', amount: 4 }]).get(0).indices.length, 1);
});

test('Core: a Ward damage face reads Poise damage; Current keeps Ward damage', () => {
  assert.deepEqual(plain(cardFaceLines(WARD, null, core)), ['Inflict 8 Poise damage']);
  assert.deepEqual(plain(cardFaceLines(WARD, null, current)), ['Inflict 8 Ward damage']);
});

test('Core: multi-hit shows one combined Poise figure; Current lists Ward and Poise apart', () => {
  const coreText = plain(cardFaceLines(MULTI, null, core)).join(' | ');
  assert.match(coreText, /6 Poise damage/);
  assert.doesNotMatch(coreText, /Ward/);
  assert.equal((coreText.match(/Poise damage/g) || []).length, 1, coreText);
  const currentText = plain(cardFaceLines(MULTI, null, current)).join(' | ');
  assert.match(currentText, /3 Ward damage/);
  assert.match(currentText, /3 Poise damage/);
});

test('Core: a live preview moves the combined figure', () => {
  const preview = { values: [{ op: 'damage', value: 4, hits: 3 }, { op: 'wardDamage', value: 5 }, { op: 'poiseDamage', value: 3 }], tokens: {} };
  assert.match(plain(cardFaceLines(MULTI, preview, core)).join(' | '), /8 Poise damage/);
});

test('Core: the plain summary reads Poise too', () => {
  assert.equal(combatCardSummary(WARD, null, core), 'Deal 8 Poise.');
  assert.equal(combatCardSummary(WARD, null, current), 'Deal 8 Ward impact.');
  assert.match(combatCardSummary(MULTI, null, core), /Deal 6 Poise/);
  assert.doesNotMatch(combatCardSummary(MULTI, null, core), /Ward/);
});
