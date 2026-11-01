// tests/enemy-sheets.test.mjs - enemy character sheets (tools/enemy-sheets.mjs) are the source of the enemy rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_PACK, check, write, extract, plan } from '../tools/enemy-sheets.mjs';

const clone = () => {
  const dir = mkdtempSync(join(tmpdir(), 'enemy-sheets-'));
  for (const f of ['characters.json', 'enemyCards.json', 'gear.json', 'enemyRelics.json']) cpSync(join(DEFAULT_PACK, f), join(dir, f));
  cpSync(join(DEFAULT_PACK, 'enemies'), join(dir, 'enemies'), { recursive: true });
  return dir;
};
const edit = (dir, id, fn) => { const f = join(dir, 'enemies', `${id}.json`); const s = JSON.parse(readFileSync(f, 'utf8')); fn(s); writeFileSync(f, `${JSON.stringify(s, null, 2)}\n`); };
const rows = dir => JSON.parse(readFileSync(join(dir, 'characters.json'), 'utf8'));

test('committed sheets agree with characters.json and every ref resolves', () => {
  assert.deepEqual(check(), []);
  assert.equal(readdirSync(join(DEFAULT_PACK, 'enemies')).filter(f => !f.startsWith('_')).length, 33);
});

test('extract then write is byte-identical', () => {
  const dir = clone();
  try {
    const before = readFileSync(join(dir, 'characters.json'), 'utf8');
    rmSync(join(dir, 'enemies'), { recursive: true });
    assert.equal(extract(dir).length, 33);
    assert.deepEqual(write(dir).problems, []);
    assert.equal(readFileSync(join(dir, 'characters.json'), 'utf8'), before);
    assert.deepEqual(check(dir), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('unknown refs are rejected with a clear message', () => {
  const dir = clone();
  try {
    edit(dir, 'wanderingSoldier', s => { s.deck[0] = 'card:wanderingSoldier.slsh'; });
    assert.match(plan(dir).problems.join('\n'), /wanderingSoldier\.json deck\[0\]: unknown card id "wanderingSoldier\.slsh"/);
    edit(dir, 'wanderingSoldier', s => { s.deck[0] = 'card:wanderingSoldier.slash'; s.equipment[0].ref = 'gear:nopeSword'; });
    assert.match(check(dir).join('\n'), /equipment\[0\]: unknown gear id "nopeSword"/);
    edit(dir, 'wanderingSoldier', s => { s.equipment[0].ref = 'dagger'; });
    assert.match(check(dir).join('\n'), /no reference prefix/);
    edit(dir, 'wanderingSoldier', s => { s.equipment[0].ref = 'relic:enemy.relic.graveSeal'; });
    assert.match(check(dir).join('\n'), /takes gear: references/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a duplicate enemy id is rejected', () => {
  const dir = clone();
  try {
    cpSync(join(dir, 'enemies', 'blightHound.json'), join(dir, 'enemies', 'copy.json'));
    assert.match(check(dir).join('\n'), /duplicate enemy id "blightHound"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('editing a stat, the deck or the reserve changes the built row; check demands --write first', () => {
  const dir = clone();
  try {
    edit(dir, 'fellWarden', s => { s.stats.poiseMax = 99; s.deck.push('card:fellWarden.caneStrike'); s.reserve = []; delete s.ai['card:fellWarden.twinDaggers']; s.behaviour.phases[0].unlockCards = []; });
    assert.ok(check(dir).some(p => /row "fellWarden" disagrees/.test(p)));
    assert.deepEqual(write(dir).problems, []);
    const row = rows(dir).find(r => r.id === 'fellWarden');
    assert.equal(row.enemy.poiseMax, 99);
    assert.equal(row.defaultDeck.length, 9);
    assert.equal(row.enemy.unlockCards, undefined);
    assert.deepEqual(check(dir), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('unknown behaviour fields (element, startStatuses) pass through to the row', () => {
  const dir = clone();
  try {
    edit(dir, 'stitchCrab', s => { s.behaviour.element = 'earth'; s.behaviour.startStatuses = [{ status: 'damp', stacks: 2 }]; });
    write(dir);
    const e = rows(dir).find(r => r.id === 'stitchCrab').enemy;
    assert.equal(e.element, 'earth');
    assert.deepEqual(e.startStatuses, [{ status: 'damp', stacks: 2 }]);
    assert.deepEqual(check(dir), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the reference table lists every referenced id', () => {
  const ref = JSON.parse(readFileSync(join(DEFAULT_PACK, 'enemies', '_reference.json'), 'utf8'));
  const md = readFileSync(join(DEFAULT_PACK, 'enemies', '_reference.md'), 'utf8');
  for (const f of readdirSync(join(DEFAULT_PACK, 'enemies')).filter(f => !f.startsWith('_'))) {
    const s = JSON.parse(readFileSync(join(DEFAULT_PACK, 'enemies', f), 'utf8'));
    assert.ok(ref.enemies[`enemy:${s.id}`], s.id);
    for (const c of [...s.deck, ...s.reserve, ...Object.keys(s.ai)]) { assert.ok(ref.cards[c], c); assert.ok(md.includes(`| ${c} |`), c); }
    for (const g of s.equipment) assert.ok(ref.gear[g.ref], g.ref);
    for (const g of s.relics) assert.ok(ref.relics[g.ref], g.ref);
  }
});
