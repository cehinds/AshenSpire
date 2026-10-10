import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { playerAttackSprites } from '../src/content/playerAttackSprites.js';
import { playerAttackFamily, playerAttackSequence } from '../src/model/playerAttackSprites.js';
import { resolveCombatAnimation } from '../src/model/combatAnimation.js';
import { durationFor, sampleSequence } from '../src/model/alternativeCardAnimation.js';

const card = (maneuver = 'attack', camp = 'physical', extra = {}) => ({ cardTags: ['maneuver:' + maneuver, 'camp:' + camp], ...extra });
const gear = (...ids) => ids.map(id => ({ id }));
test('only authored weapon combinations replace ordinary attacks', () => {
  for (const [ids, expected] of [[['greatsword'], 'greatsword'], [['straightSword'], 'single-sword'], [['dagger'], 'single-dagger'], [['dagger', 'parryDagger'], 'dual-daggers'], [['straightSword', 'buckler'], 'sword-shield'], [['ashStaff'], 'staff-casting']]) {
    assert.equal(playerAttackFamily(card(), gear(...ids), 'attack'), expected);
    assert.equal(playerAttackFamily(card(), gear(...ids.reverse()), 'attack'), expected);
  }
  for (const ids of [[], ['frostSpear'], ['halberd'], ['warhammer'], ['dagger', 'buckler'], ['straightSword', 'lantern'], ['straightSword', 'unknown']]) {
    assert.equal(playerAttackFamily(card(), gear(...ids), 'attack'), null);
  }
  assert.equal(playerAttackFamily(card('attack', 'physical', { sourceArmamentId: 'buckler' }), gear('straightSword', 'buckler'), 'attack'), null);
  assert.equal(playerAttackFamily(card('attack', 'physical', { sourceArmamentId: 'dagger' }), gear('straightSword'), 'attack'), null);
});

test('spell and ranged identities keep their effects while selecting reviewed paintings', () => {
  const plan = (c, items = []) => resolveCombatAnimation(c, items, { classId: 'herald' });
  assert.equal(plan(card('attack', 'spell')).technique, 'weapon:spell:energy-blade');
  assert.equal(plan(card('casting', 'spell')).technique, 'weapon:spell:staff-casting');
  assert.equal(plan(card('ranged'), gear('shortbow')).technique, 'weapon:ranged:bow');
  assert.equal(plan(card('ranged'), gear('dagger')).technique, 'ranged');
  for (const action of ['smash', 'sweep', 'counter', 'defend']) assert.equal(plan(card(action), gear('greatsword')).technique, action === 'counter' ? 'counterPrepare' : action);
  assert.equal(plan(card('attack', 'spell')).family, 'spell');
});

test('all 32 reviewed sequences keep four distinct phases and capped strike timing', () => {
  const manifest=JSON.parse(readFileSync(new URL('../art-manifest.json',import.meta.url)));
  assert.equal(Object.keys(playerAttackSprites).length, 4);
  for (const [classId, families] of Object.entries(playerAttackSprites)) {
    assert.equal(Object.keys(families).length, 8);
    assert.equal(families.spear, undefined);
    for (const [family, entry] of Object.entries(families)) {
      const sequence = playerAttackSequence(classId, 'weapon:attack:' + family);
      assert.equal(sequence.poses.length, 4);
      assert.equal(new Set(Object.values(entry.frames).map(f => f.sha256)).size, 4);
      const total = sequence.durations.reduce((a, b) => a + b, 0);
      const duration = durationFor(sequence, { lungeMs: 260, impactCapMs: 120 });
      const impact = duration * sequence.durations[0] / total;
      assert.ok(impact <= 120.00001);
      assert.equal(sampleSequence(sequence, impact + .001, duration).index, 1);
      assert.ok(Object.values(entry.frames).every(f => f.path.startsWith('assets/animations/player-attacks/')));
      for(const frame of Object.values(entry.frames)) {
        const row=manifest.assets[frame.path];
        assert.equal(row.high.sha256,frame.sha256);
        const light=readFileSync(new URL('../'+row.light.path,import.meta.url));
        assert.equal(createHash('sha256').update(light).digest('hex'),row.light.sha256);
      }
    }
  }
});
