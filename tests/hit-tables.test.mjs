// The hit tables the combat screen and the counter still read (SPEC §5): accuracy, evasion, the stance-advantage
// table and the target outline (src/engine/combatRounds/resolver.js). These tests are the survivors of the
// combat-rounds resolver's suite; its round, timeline and momentum tests were removed with the system (cleanup 3i-A).
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { accuracyFor, evasionFor, parseEvasionArmor, parseStanceAdvantage, stanceBonus, stanceOutline } from '../src/engine/combatRounds/resolver.js';
import { EVASION_ARMOR_CSV, STANCE_ADVANTAGE_CSV } from '../src/content/combatRounds.js';

const REAVER = { STR: 3, DEX: 1, WIS: 1, INT: 1 };

// A card table with the one row these tests price; the engine reads armor only.
const tables = () => ({ armor: parseEvasionArmor(EVASION_ARMOR_CSV), cards: new Map([['Backstep', 5]]) });

test('accuracyFor: level 1 Reaver STR3 DEX1 WIS1 INT1 has accuracy 5, and level 5 adds one', () => {
  assert.equal(accuracyFor({ attrs: REAVER, level: 1, tags: [] }), 5);
  assert.equal(accuracyFor({ attrs: REAVER, level: 5, tags: [] }), 6);
  assert.equal(accuracyFor({ attrs: REAVER, level: 4, tags: [] }), 5);
});

test('accuracyFor: the quick tag adds 1 and the telegraphed tag takes away 2', () => {
  assert.equal(accuracyFor({ attrs: REAVER, level: 1, tags: ['quick'] }), 6);
  assert.equal(accuracyFor({ attrs: REAVER, level: 1, tags: ['telegraphed'] }), 3);
  assert.equal(accuracyFor({ attrs: REAVER, level: 1, tags: ['stun'] }), 5, 'other tags add nothing');
});

test('accuracyFor: a plain numeric accuracy still works, and an extra bonus adds to the total', () => {
  assert.equal(accuracyFor({ accuracy: 5 }), 5);
  assert.equal(accuracyFor({ attrs: REAVER, accuracy: 2 }), 7);
  assert.equal(accuracyFor({}), 0);
});

test('parseEvasionArmor: an empty base or dexCap cell throws, and the shipped table parses', () => {
  assert.throws(() => parseEvasionArmor('armor,base,dexCap\nLeather,,6'), TypeError, 'empty base');
  assert.throws(() => parseEvasionArmor('armor,base,dexCap\nLeather,1,'), TypeError, 'empty dexCap');
  assert.throws(() => parseEvasionArmor('armor,base,dexCap\nLeather,1'), TypeError, 'missing dexCap cell');
  assert.equal(parseEvasionArmor('armor,base,dexCap\nCloth,0,0').get('Cloth').base, 0, 'a real 0 is still valid');
  assert.equal(parseEvasionArmor(EVASION_ARMOR_CSV).get('Plated').dexCap, 0);
});

test('evasionFor: Cloth, Leather and Plated follow base + min(DEX - 1, dexCap)', () => {
  assert.equal(evasionFor({ evasionArmor: 'Cloth', dex: 1 }, tables()), 0);
  assert.equal(evasionFor({ evasionArmor: 'Leather', dex: 3 }, tables()), 2);
  assert.equal(evasionFor({ evasionArmor: 'Plated', dex: 5 }, tables()), 1, 'Plated caps DEX at 0');
  assert.equal(evasionFor({ evasionArmor: 'Chain', dex: 9 }, tables()), 1 + 2, 'Chain caps DEX at 2');
  assert.equal(evasionFor({ evasionArmor: 'Leather', dex: 0 }, tables()), 0, 'DEX 0 adds nothing');
});

test('evasionFor: Leather, DEX 3 and a buckler is evasion 3; another shield adds 0', () => {
  assert.equal(evasionFor({ evasionArmor: 'Leather', dex: 3, shield: 'buckler' }, tables()), 3);
  assert.equal(evasionFor({ evasionArmor: 'Cloth', dex: 1, shield: 'kite' }, tables()), 0);
});

test('evasionFor: a card adds its bonus, and an unknown card or armor throws', () => {
  assert.equal(evasionFor({ evasionArmor: 'Cloth', dex: 1, evasionCard: 'Backstep' }, tables()), 5);
  assert.throws(() => evasionFor({ evasionArmor: 'Cloth', dex: 1, evasionCard: 'Strike' }, tables()), RangeError);
  assert.throws(() => evasionFor({ evasionArmor: 'Tinsel', dex: 1 }, tables()), RangeError);
  assert.equal(evasionFor({ evasionArmor: 'Cloth', dex: 1, evasionCard: null }, tables()), 0);
});

test('evasionFor: a missing dex takes attrs.DEX, and attrs.DEX alone counts as Cloth', () => {
  assert.equal(evasionFor({ evasionArmor: 'Leather', attrs: { DEX: 4 } }, tables()), 3);
  assert.equal(evasionFor({ evasionArmor: 'Leather', dex: 2, attrs: { DEX: 4 } }, tables()), 1, 'an explicit dex wins');
  assert.equal(evasionFor({ attrs: { DEX: 4 } }), 3, 'built-in Cloth row, no tables');
  assert.equal(evasionFor({ attrs: { DEX: 9 } }), 4, 'capped at the Cloth dexCap 4');
  assert.equal(evasionFor({ attrs: { DEX: 4 }, evasion: 1 }), 4, 'flat evasion adds on top');
  assert.equal(evasionFor({ evasion: 4 }), 4);
  assert.equal(evasionFor({}), 0);
  assert.throws(() => evasionFor({ evasionArmor: 'Leather', dex: 3 }), RangeError, 'Leather with no tables throws');
});

test('stance-advantage table: the owner rows are present and every stance is in the tree', () => {
  const table = parseStanceAdvantage(STANCE_ADVANTAGE_CSV);
  assert.equal(table.get('smash>block'), 2, 'smash beats guard and breaks it for +2');
  assert.equal(table.get('counter>attack'), 1);
  assert.equal(table.get('attack>smash'), 1);
  assert.equal(table.get('attack>sweep'), 1);
  assert.equal(table.get('block>attack'), 1);
  const tree = new Set(['attack', 'smash', 'sweep', 'block', 'evade', 'counter']);
  for (const key of table.keys()) {
    const [a, d] = key.split('>');
    assert.equal(tree.has(a) && tree.has(d), true, `unknown stance in ${key}`);
  }
});

test('parseStanceAdvantage: a blank bonus defaults to 1, and a bad header throws', () => {
  const t = parseStanceAdvantage('attacker_stance,defender_stance,bonus,note\nsmash,block,,blank\nsweep,evade,3,x\n');
  assert.equal(t.get('smash>block'), 1);
  assert.equal(t.get('sweep>evade'), 3);
  assert.throws(() => parseStanceAdvantage('stance,against\n'), TypeError);
});

test('stanceBonus and stanceOutline: green when the card wins, red when the foe wins, none when neutral or hidden', () => {
  const table = parseStanceAdvantage(STANCE_ADVANTAGE_CSV);
  assert.equal(stanceBonus(table, 'smash', 'block'), 2);
  assert.equal(stanceBonus(null, 'smash', 'block'), 0);
  const aim = (card, foe, stage = 3) => stanceOutline({ card, foe, stage, stanceTable: table });
  assert.equal(aim({ stance: 'smash', target: 'e1' }, { stance: 'block' }), 'green');
  assert.equal(aim({ stance: 'block', target: 'e1' }, { stance: 'smash' }), 'red');
  assert.equal(aim({ stance: 'attack', target: 'e1' }, { stance: 'attack' }), null, 'neutral');
  assert.equal(aim({ stance: 'smash', target: 'e1' }, { stance: 'block' }, 1), null, 'unrevealed below stage 2');
  assert.equal(aim({ stance: 'smash', target: 'self' }, { stance: 'block' }), null, 'aimed at its own side');
});

test('the content tables equal the CSVs in docs/alternative-combat-rounds, byte for byte', () => {
  const dir = fileURLToPath(new URL('../docs/alternative-combat-rounds/', import.meta.url));
  assert.equal(EVASION_ARMOR_CSV, readFileSync(`${dir}evasion-armor.csv`, 'utf8'), 'EVASION_ARMOR_CSV drifted');
  assert.equal(STANCE_ADVANTAGE_CSV, readFileSync(`${dir}stance-advantage.csv`, 'utf8'), 'STANCE_ADVANTAGE_CSV drifted');
});
