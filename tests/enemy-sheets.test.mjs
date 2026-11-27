// tests/enemy-sheets.test.mjs - enemy character sheets (tools/enemy-sheets.mjs) are the source of the enemy rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PACK, check, write, extract, plan, WriteSheetIfUnchanged } from '../tools/enemy-sheets.mjs';

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
  assert.equal(readdirSync(join(DEFAULT_PACK, 'enemies')).filter(f => !f.startsWith('_')).length, 65);
});

test('extract then write is byte-identical', () => {
  const dir = clone();
  try {
    const before = readFileSync(join(dir, 'characters.json'), 'utf8');
    rmSync(join(dir, 'enemies'), { recursive: true });
    assert.equal(extract(dir).length, 65);
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

test('unknown sheet and stats keys are rejected, naming file and key', () => {
  const dir = clone();
  try {
    edit(dir, 'huskBrute', s => { s.stats.maxHp = 50; });
    assert.match(plan(dir).problems.join('\n'), /huskBrute\.json stats: unknown key "maxHp"\. Allowed keys: attributes, attributePriority, levelProfile, poiseMax, spFloor/);
    edit(dir, 'huskBrute', s => { delete s.stats.maxHp; s.loot = []; });
    assert.match(check(dir).join('\n'), /huskBrute\.json: unknown key "loot"/);
    edit(dir, 'huskBrute', s => { delete s.loot; s.behaviour.loot = []; });
    write(dir);
    assert.deepEqual(check(dir), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('stats.hp carries to the row as hpOverride and back; absent leaves the row unchanged', () =>
{
    const dir = clone();
    try
    {
        const before = rows(dir).find(row => row.id === 'huskBrute');
        assert.equal(before.hpOverride, undefined);
        edit(dir, 'huskBrute', sheet =>
        {
            sheet.stats.hp = 50;
        });
        assert.deepEqual(write(dir).problems, []);
        const after = rows(dir).find(row => row.id === 'huskBrute');
        assert.equal(after.hpOverride, 50);
        assert.deepEqual(check(dir), []);
        rmSync(join(dir, 'enemies'), { recursive: true });
        extract(dir);
        const sheet = JSON.parse(readFileSync(join(dir, 'enemies', 'huskBrute.json'), 'utf8'));
        assert.equal(sheet.stats.hp, 50);
        assert.deepEqual(write(dir).problems, []);
        assert.deepEqual(check(dir), []);
    }
    finally
    {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('a stats.hp that is not a whole number of 1 or more is rejected, naming the enemy', () =>
{
    const dir = clone();
    try
    {
        const badValues = [
            0,
            -5,
            12.5,
            '40',
        ];
        for (const value of badValues)
        {
            edit(dir, 'huskBrute', sheet =>
            {
                sheet.stats.hp = value;
            });
            const problems = plan(dir).problems.join('\n');
            assert.match(problems, /huskBrute\.json stats\.hp: huskBrute has HP /);
            assert.match(problems, /Use a whole number of 1 or more/);
        }
    }
    finally
    {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('a JSON syntax error names the file', () => {
  const dir = clone();
  try {
    writeFileSync(join(dir, 'enemies', 'huskBrute.json'), '{ "id": ');
    assert.throws(() => check(dir), /^Error: enemies\/huskBrute\.json: /);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a deleted sheet is reported as missing, with the removal warning', () => {
  const dir = clone();
  try {
    rmSync(join(dir, 'enemies', 'huskBrute.json'));
    assert.match(check(dir).join('\n'), /enemies\/huskBrute\.json is missing; restore it, or run --write to REMOVE enemy huskBrute from characters\.json/);
    assert.equal(rows(dir).some(r => r.id === 'huskBrute'), true);
    write(dir);
    assert.equal(rows(dir).some(r => r.id === 'huskBrute'), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a stale characters.json row hints at --extract --force', () => {
  const dir = clone();
  try {
    const r = rows(dir); r.find(x => x.id === 'huskBrute').enemy.poiseMax = 1;
    writeFileSync(join(dir, 'characters.json'), `${JSON.stringify(r, null, 2)}\n`);
    assert.match(check(dir).join('\n'), /row "huskBrute" disagrees.*--extract --force/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('reserve and phase unlocks must agree', () => {
  const dir = clone();
  try {
    edit(dir, 'fellWarden', s => { s.behaviour.phases[0].unlockCards = []; });
    assert.match(plan(dir).problems.join('\n'), /reserve card "card:fellWarden\.twinDaggers" is not listed in any behaviour\.phases\[\]\.unlockCards/);
    edit(dir, 'fellWarden', s => { s.behaviour.phases[0].unlockCards = ['card:fellWarden.twinDaggers']; s.reserve = []; });
    assert.match(plan(dir).problems.join('\n'), /phase unlocks "card:fellWarden\.twinDaggers" but it is not in reserve/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the write command refuses cardHints shadowed under behaviour and leaves the pack bytes intact', () => {
  const dir = clone();
  try {
    edit(dir, 'ashheartDragon', sheet => { sheet.behaviour.cardHints = { 'ashheartDragon.ashBreath': null }; });
    const files = ['characters.json', ...readdirSync(join(dir, 'enemies')).map(file => join('enemies', file))];
    const bytes = files.map(file => readFileSync(join(dir, file)));
    const tool = fileURLToPath(new URL('../tools/enemy-sheets.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [tool, '--write', '--pack', dir], { encoding: 'utf8' });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /ashheartDragon\.json behaviour\/cardHints: author card hints under ai/);
    assert.deepEqual(files.map(file => readFileSync(join(dir, file))), bytes);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a sheet saved while --write runs keeps the saved text', () =>
{
    const dir = clone();
    try
    {
        const sheetPath = join(dir, 'enemies', 'huskBrute.json');
        const saveMidBuild = () =>
        {
            edit(dir, 'huskBrute', (sheet) =>
            {
                sheet.stats.poiseMax = 9;
            });
        };
        const savedText = () => readFileSync(sheetPath, 'utf8');
        const result = write(dir, { afterPlan: saveMidBuild });
        assert.deepEqual(result.skipped, ['huskBrute.json']);
        assert.equal(JSON.parse(savedText()).stats.poiseMax, 9);
        const rerun = write(dir);
        assert.deepEqual(rerun.skipped, []);
        assert.equal(JSON.parse(savedText()).stats.poiseMax, 9);
        assert.deepEqual(check(dir), []);
    }
    finally
    {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('WriteSheetIfUnchanged leaves an unchanged file untouched and refuses a changed one', () =>
{
    const dir = mkdtempSync(join(tmpdir(), 'enemy-sheet-cas-'));
    try
    {
        const path = join(dir, 'sheet.json');
        writeFileSync(path, 'A\n');
        assert.equal(WriteSheetIfUnchanged(path, 'A\n', 'B\n'), true);
        assert.equal(readFileSync(path, 'utf8'), 'B\n');
        assert.equal(WriteSheetIfUnchanged(path, 'A\n', 'C\n'), false);
        assert.equal(readFileSync(path, 'utf8'), 'B\n');
    }
    finally
    {
        rmSync(dir, { recursive: true, force: true });
    }
});
